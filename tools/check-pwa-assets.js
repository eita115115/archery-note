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
    fail(
      "Service Worker cache cleanup must require key.startsWith(CACHE_PREFIX) and key !== CACHE",
    );
  }
}

function assertPreviewServerContracts(
  relativePath,
  { iphoneLan = false, localhostPoseRecovery = false } = {},
) {
  const text = readText(relativePath);
  const mimeEntries = new Map(
    [...text.matchAll(/["'](\.[a-z0-9]+)["']\s*=\s*["']([^"']+)["']/gi)].map(
      ([, extension, contentType]) => [extension.toLowerCase(), contentType.toLowerCase()],
    ),
  );
  const requiredMimeTypes = new Map([
    [".mjs", "text/javascript; charset=utf-8"],
    [".wasm", "application/wasm"],
  ]);

  for (const [extension, expected] of requiredMimeTypes) {
    const actual = mimeEntries.get(extension);
    if (actual !== expected) {
      fail(`${relativePath} must serve ${extension} as ${expected}; got ${actual || "missing"}`);
    }
  }

  const hasSeparatorBoundRoot =
    /\$rootPrefix\s*=[^\r\n]*DirectorySeparatorChar/.test(text) &&
    /\.StartsWith\(\$rootPrefix,\s*\[System\.StringComparison\]::OrdinalIgnoreCase\)/.test(text);
  if (!hasSeparatorBoundRoot) {
    fail(`${relativePath} must use a separator-bound, case-insensitive root containment check`);
  }

  if (localhostPoseRecovery) {
    if (
      !/Write-Warning\s+["']If form tracking was opened here before the MIME fix, delete only Cache Storage entry archery-note-pose-v1, then reload\.["']/.test(
        text,
      )
    ) {
      fail(`${relativePath} must explain how to remove only the stale pose cache`);
    }
    if (
      !/Write-Warning\s+["']Do not clear all site data; that can remove local practice records\.["']/.test(
        text,
      )
    ) {
      fail(`${relativePath} must warn against clearing user practice data`);
    }
  }

  if (!iphoneLan) return;

  if (
    !/Write-Warning\s+["']LAN HTTP preview\/replay only: iPhone live camera requires a trusted HTTPS origin\.["']/.test(
      text,
    )
  ) {
    fail(`${relativePath} must warn that iPhone live camera requires a trusted HTTPS origin`);
  }
  if (
    !/Write-Warning\s+["']This server exposes the repository root on all interfaces\. Use only on trusted private Wi-Fi\.["']/.test(
      text,
    )
  ) {
    fail(`${relativePath} must warn that the repository root is exposed on the LAN`);
  }
  if (!text.includes("Open preview/replay from iPhone")) {
    fail(`${relativePath} must label its iPhone URL as preview/replay only`);
  }
}

function assertIphoneHttpsPreviewContract(relativePath) {
  const text = readText(relativePath);
  const requiredMarkers = [
    "New-SelfSignedCertificate",
    "Export-Certificate",
    "HTTPS_PFX",
    "HTTPS_PASSWORD",
    "HostAddress",
    "127.0.0.1",
    "Get-NetConnectionProfile",
    "NetworkInterface",
    "Test-NetConnection",
    "Preview Git commit:",
    "Preview Git tree:",
    "Open trusted HTTPS preview from iPhone",
    "OpenCertificate",
    "Start-Process -FilePath $cerPath",
    "trusted private Wi-Fi",
    "Unable to create the temporary HTTPS certificate",
    "CertificateRequest",
    "SubjectAlternativeNameBuilder",
    "create-preview-certificate.ps1",
    "PowerShell 7 CertificateRequest fallback",
    "Port $Port is already in use",
    "TcpClient",
  ];
  for (const marker of requiredMarkers) {
    if (!text.includes(marker)) {
      fail(`${relativePath} is missing the trusted HTTPS preview marker: ${marker}`);
    }
  }
  if (!/Remove-Item\s+-LiteralPath\s+\$tempRoot\s+-Recurse\s+-Force/.test(text)) {
    fail(`${relativePath} must clean its temporary certificate directory`);
  }
  if (
    !/if\s*\(\$lanAddresses\.Count\s*-eq\s*0\s*-and\s*\$HostAddress\s*-ne\s*"127\.0\.0\.1"\)/.test(
      text,
    )
  ) {
    fail(`${relativePath} must allow explicit loopback previews without a LAN address`);
  }
}

const swText = readText("sw.js");
const html = readText("index.html");

assertCacheCleanupScope(swText);
assertPreviewServerContracts("tools/serve.ps1", { localhostPoseRecovery: true });
assertPreviewServerContracts("tools/serve-iphone.ps1", { iphoneLan: true });
assertIphoneHttpsPreviewContract("tools/serve-iphone-https.ps1");

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
