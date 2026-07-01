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
  throw new Error(`Version alignment check failed: ${message}`);
}

function requiredMatch(pattern, text, label) {
  const match = pattern.exec(text);
  if (!match) fail(`${label} marker was not found`);
  return match[1];
}

function appVersionFromPackageVersion(version, label) {
  const match = /^0\.(\d+)\.0$/.exec(version || "");
  if (!match) fail(`${label} ${version || "(missing)"} must use 0.APP_VER.0 format`);
  return Number(match[1]);
}

const storageScript = readText("scripts/10-storage-native.js");
const versionJson = readJson("version.json");
const serviceWorker = readText("sw.js");
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");

const appVer = Number(requiredMatch(/\bconst\s+APP_VER\s*=\s*(\d+)\s*;/, storageScript, "APP_VER"));
const versionJsonVer = Number(versionJson.v);
const swCacheMarker = requiredMatch(
  /\bconst\s+CACHE\s*=\s*["'](archery-note-v\d+)["']\s*;/,
  serviceWorker,
  "Service Worker cache",
);
const swCacheVersionMatch = /^archery-note-v(\d+)$/.exec(swCacheMarker);
if (!swCacheVersionMatch) {
  fail(`Service Worker cache marker has unexpected format: ${swCacheMarker}`);
}
const swCacheVer = Number(swCacheVersionMatch[1]);

if (!Number.isInteger(appVer)) fail(`APP_VER is not an integer: ${appVer}`);
if (!Number.isInteger(versionJsonVer)) {
  fail(`version.json.v is not an integer: ${versionJson.v}`);
}
if (!Number.isInteger(swCacheVer)) {
  fail(`Service Worker cache version is not an integer: ${swCacheVer}`);
}

if (appVer !== versionJsonVer) {
  fail(`APP_VER ${appVer} does not match version.json.v ${versionJsonVer}`);
}
if (appVer !== swCacheVer) {
  fail(`APP_VER ${appVer} does not match sw.js cache version ${swCacheVer}`);
}

if (!packageJson.version) fail("package.json.version is missing");
if (!packageLock.version) fail("package-lock.json.version is missing");
const packageAppVer = appVersionFromPackageVersion(packageJson.version, "package.json.version");
if (packageAppVer !== appVer) {
  fail(`package.json.version ${packageJson.version} implies APP_VER ${packageAppVer}, but APP_VER is ${appVer}`);
}

const expectedSwCacheMarker = `archery-note-v${appVer}`;
if (swCacheMarker !== expectedSwCacheMarker) {
  fail(`sw.js cache marker ${swCacheMarker} does not match expected ${expectedSwCacheMarker}`);
}

if (packageJson.version !== packageLock.version) {
  fail(
    `package.json.version ${packageJson.version} does not match package-lock.json.version ${packageLock.version}`,
  );
}

const lockRootVersion = packageLock.packages?.[""]?.version;
if (lockRootVersion && packageJson.version !== lockRootVersion) {
  fail(
    `package.json.version ${packageJson.version} does not match package-lock.json packages[""].version ${lockRootVersion}`,
  );
}

console.log("Version alignment checks OK");
