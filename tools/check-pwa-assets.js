const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message) {
  throw new Error(`PWA asset check failed: ${message}`);
}

function attrValue(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  return match?.[1] || "";
}

function isExternalAsset(asset) {
  return /^[a-z][a-z0-9+.-]*:/i.test(asset) || asset.startsWith("//");
}

function normalizeAsset(asset) {
  const clean = asset.split(/[?#]/, 1)[0].replace(/\\/g, "/").trim();
  return clean.replace(/^\.?\//, "");
}

function assertLocalFile(relativePath, label) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    fail(`${label} does not exist: ${relativePath}`);
  }
}

function extractArrayBlock(text, name) {
  const match = new RegExp(`\\bconst\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`).exec(text);
  if (!match) fail(`${name} array was not found in sw.js`);
  return match[1];
}

function quotedStrings(text) {
  return [...text.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function extractSwArray(text, name, stack = []) {
  if (stack.includes(name))
    fail(`Circular Service Worker asset spread: ${[...stack, name].join(" -> ")}`);

  const block = extractArrayBlock(text, name);
  const assets = quotedStrings(block);
  const spreads = [...block.matchAll(/\.\.\.([A-Z0-9_]+)/g)].map((match) => match[1]);

  for (const spread of spreads) {
    assets.push(...extractSwArray(text, spread, [...stack, name]));
  }

  return assets;
}

function localReferencesFromIndex(html) {
  const references = new Set(["index.html"]);

  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const src = match[1];
    if (!isExternalAsset(src)) references.add(normalizeAsset(src));
  }

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = attrValue(tag, "rel").toLowerCase();
    const href = attrValue(tag, "href");
    if (!href || isExternalAsset(href)) continue;

    const relevantLink =
      rel.split(/\s+/).includes("stylesheet") ||
      rel.split(/\s+/).includes("manifest") ||
      rel.split(/\s+/).includes("icon") ||
      rel.includes("apple-touch-icon");

    if (relevantLink) references.add(normalizeAsset(href));
  }

  return [...references];
}

function manifestIconReferences(manifestPath) {
  const manifest = readJson(manifestPath);
  return (manifest.icons || [])
    .map((icon) => icon.src)
    .filter((src) => src && !isExternalAsset(src))
    .map(normalizeAsset);
}

function assertCacheCleanupScope(text) {
  if (!/\bconst\s+CACHE_PREFIX\s*=\s*["']archery-note-v["']\s*;/.test(text)) {
    fail("Service Worker cache cleanup prefix guard was not found");
  }

  const scopedCleanupPattern =
    /\.filter\(\s*([A-Za-z_$][\w$]*)\s*=>\s*\1\.startsWith\(CACHE_PREFIX\)\s*&&\s*\1\s*!==\s*CACHE\s*\)/;
  if (!scopedCleanupPattern.test(text)) {
    fail("Service Worker cache cleanup must require key.startsWith(CACHE_PREFIX) and key !== CACHE");
  }
}

const swText = readText("sw.js");
const html = readText("index.html");

assertCacheCleanupScope(swText);

const rawAssets = extractSwArray(swText, "ASSETS");
const assets = rawAssets.map(normalizeAsset);
const assetSet = new Set(assets);

for (const asset of rawAssets) {
  if (isExternalAsset(asset)) fail(`ASSETS must not include external URLs: ${asset}`);
}

for (const asset of assets) {
  assertLocalFile(asset, "ASSETS entry");
}

const duplicates = assets.filter((asset, index) => assets.indexOf(asset) !== index);
if (duplicates.length) fail(`Duplicate ASSETS entries: ${[...new Set(duplicates)].join(", ")}`);

const requiredAssets = new Set(localReferencesFromIndex(html));
const manifestPath = [...requiredAssets].find((asset) => path.basename(asset) === "manifest.json");
if (manifestPath) {
  for (const icon of manifestIconReferences(manifestPath)) {
    requiredAssets.add(icon);
  }
}

for (const requiredAsset of requiredAssets) {
  assertLocalFile(requiredAsset, "Referenced local asset");
  if (!assetSet.has(requiredAsset)) {
    fail(`Referenced local asset is missing from sw.js ASSETS: ${requiredAsset}`);
  }
}

console.log("PWA asset checks OK");
