const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
  throw new Error(`PWA update flow check failed: ${message}`);
}

function assertMatch(pattern, text, message) {
  if (!pattern.test(text)) fail(message);
}

function assertNoMatch(pattern, text, message) {
  if (pattern.test(text)) fail(message);
}

function sliceBetween(text, startPattern, endText, label) {
  const startMatch = startPattern.exec(text);
  if (!startMatch) fail(`${label} start was not found`);
  const start = startMatch.index;
  const end = text.indexOf(endText, start);
  if (end < 0) fail(`${label} end was not found`);
  return text.slice(start, end);
}

function indexOfMatch(pattern, text, message) {
  const match = pattern.exec(text);
  if (!match) fail(message);
  return match.index;
}

function assertOrder(beforePattern, afterPattern, text, message) {
  const before = indexOfMatch(beforePattern, text, `${message}: first pattern was not found`);
  const after = indexOfMatch(afterPattern, text, `${message}: second pattern was not found`);
  if (before >= after) fail(message);
}

const initText = readText("scripts/90-init.js");
const swText = readText("sw.js");
const flowText = `${initText}\n${swText}`;
const freshReloadText = sliceBetween(
  initText,
  /function\s+freshReload\s*\(\)\s*\{/,
  '$("#updBar").onclick=freshReload;',
  "freshReload",
);

assertMatch(
  /fetch\(\s*["']version\.json\?ts=["']\s*\+\s*Date\.now\(\)\s*,\s*\{\s*cache\s*:\s*["']no-store["']\s*\}\s*\)/,
  initText,
  "version.json must be fetched with cache: \"no-store\"",
);

assertMatch(
  /updateAvailable\s*=\s*!!\(\s*j\s*&&\s*j\.v\s*>\s*APP_VER\s*\)/,
  initText,
  "updateAvailable must be derived from version.json.v > APP_VER",
);

assertMatch(
  /function\s+isUpdateReloadBlocked\s*\(\)\s*\{[\s\S]*?return\s+!!\(\s*db\s*&&\s*db\.active\s*\)\s*\|\|\s*activeWorkflowCount\s*>\s*0\s*;?\s*\}/,
  initText,
  "isUpdateReloadBlocked must guard against db.active and an active workflow count",
);

assertMatch(
  /function\s+beginActiveWorkflow\s*\(\)\s*\{[\s\S]*?activeWorkflowCount\+\+;[\s\S]*?syncUpdateBarVisibility\(\);[\s\S]*?\}/,
  initText,
  "beginActiveWorkflow must increment activeWorkflowCount and resync the update bar",
);

assertMatch(
  /function\s+endActiveWorkflow\s*\(\)\s*\{[\s\S]*?activeWorkflowCount\s*=\s*Math\.max\(\s*0\s*,\s*activeWorkflowCount\s*-\s*1\s*\);[\s\S]*?syncUpdateBarVisibility\(\);[\s\S]*?\}/,
  initText,
  "endActiveWorkflow must decrement activeWorkflowCount (never below zero) and resync the update bar",
);

assertMatch(
  /function\s+syncUpdateBarVisibility\s*\(\)\s*\{[\s\S]*?const\s+show\s*=\s*!!updateAvailable\s*&&\s*!isUpdateReloadBlocked\(\)/,
  initText,
  "update bar visibility must stay gated by the update reload guard",
);

assertMatch(
  /if\s*\(\s*isUpdateReloadBlocked\(\)\s*\)\s*\{[\s\S]*?syncUpdateBarVisibility\(\)[\s\S]*?return\s*;[\s\S]*?\}/,
  freshReloadText,
  "freshReload must re-check update reload safety before proceeding",
);

assertOrder(
  /isUpdateReloadBlocked\(\)/,
  /navigator\.serviceWorker\.getRegistrations\(\)/,
  freshReloadText,
  "freshReload safety re-check must happen before registration.update()",
);

assertOrder(
  /isUpdateReloadBlocked\(\)/,
  /location\.replace\(\s*url\.toString\(\)\s*\)/,
  freshReloadText,
  "freshReload safety re-check must happen before location.replace()",
);

assertOrder(
  /flushSafetySnapshot\(\)/,
  /location\.replace\(\s*url\.toString\(\)\s*\)/,
  freshReloadText,
  "freshReload should flush pending snapshots before location.replace()",
);

assertMatch(
  /navigator\.serviceWorker\.getRegistrations\(\)[\s\S]*?\.map\(\s*([A-Za-z_$][\w$]*)\s*=>\s*\1\.update\(\)\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)\s*\)/,
  initText,
  "update click path must ask existing Service Worker registrations to update",
);

assertMatch(
  /url\.searchParams\.set\(\s*["']appv["']\s*,\s*String\(Date\.now\(\)\)\s*\)/,
  initText,
  "update reload path must add an appv cache-busting query",
);

assertMatch(
  /location\.replace\(\s*url\.toString\(\)\s*\)/,
  initText,
  "update reload path must use location.replace(url.toString())",
);

assertNoMatch(
  /location\.reload\s*\(/,
  initText,
  "scripts/90-init.js should not introduce location.reload()",
);

assertMatch(
  /document\.addEventListener\(\s*["']visibilitychange["'][\s\S]*?flushSafetySnapshot\(\)[\s\S]*?checkUpdate\(\)/,
  initText,
  "visibilitychange should keep flushing snapshots and rechecking updates",
);

assertMatch(
  /window\.addEventListener\(\s*["']pagehide["'][\s\S]*?flushSafetySnapshot\(\)/,
  initText,
  "pagehide should flush pending safety snapshots",
);

assertNoMatch(
  /controllerchange|updatefound|SKIP_WAITING|\.waiting\b|\.installing\b/,
  flowText,
  "waiting-worker/controllerchange flow should not be introduced in this static check stage",
);

assertMatch(
  /self\.skipWaiting\(\)/,
  swText,
  "current Service Worker install flow should still contain self.skipWaiting()",
);

assertMatch(
  /self\.clients\.claim\(\)/,
  swText,
  "current Service Worker activate flow should still contain self.clients.claim()",
);

const poseCacheMatch = /\bconst\s+POSE_CACHE\s*=\s*["']([^"']+)["']\s*;/.exec(swText);
if (!poseCacheMatch) fail("sw.js must define POSE_CACHE for pose asset cache-first serving");
const cachePrefixMatch = /\bconst\s+CACHE_PREFIX\s*=\s*["']([^"']+)["']\s*;/.exec(swText);
if (!cachePrefixMatch) fail("sw.js must define CACHE_PREFIX");
if (poseCacheMatch[1].startsWith(cachePrefixMatch[1])) {
  fail(
    `POSE_CACHE (${poseCacheMatch[1]}) must not start with CACHE_PREFIX (${cachePrefixMatch[1]}); ` +
      "otherwise the activate cleanup would delete the pose cache on every app update",
  );
}

assertMatch(
  /url\.pathname\.includes\(\s*["']\/assets\/pose\/["']\s*\)/,
  swText,
  "sw.js fetch handler must special-case same-origin /assets/pose/ requests",
);

const swPoseBranch = sliceBetween(
  swText,
  /url\.pathname\.includes\(\s*["']\/assets\/pose\/["']\s*\)/,
  "return;",
  "pose fetch branch",
);

assertOrder(
  /caches\.open\(POSE_CACHE\)[\s\S]{0,200}?\.match\(\s*e\.request\s*\)/,
  /fetch\(\s*e\.request\s*\)/,
  swPoseBranch,
  "pose assets must be served cache-first: a POSE_CACHE-scoped cache lookup must appear before fetch(e.request)",
);

assertNoMatch(
  /caches\.match\(/,
  swPoseBranch,
  "pose branch must not use unscoped caches.match (entries in older/other caches would win over POSE_CACHE)",
);

assertMatch(
  /caches\.open\(POSE_CACHE\)/,
  swText,
  "pose asset responses must be stored in POSE_CACHE, not the versioned app cache",
);

const swAssetsBlock = sliceBetween(swText, /\bconst\s+ASSETS\s*=\s*\[/, "];", "ASSETS array");
assertNoMatch(
  /assets\/pose/,
  swAssetsBlock,
  "install precache (ASSETS) must not include assets/pose (about 15MB; loaded only when form tracking is enabled)",
);

const gearText = readText("scripts/70-gear-settings.js");
const analysisText = readText("scripts/40-analysis-physics.js");

assertMatch(
  /ovl\.querySelector\(\s*["']#dExp["']\s*\)\.onclick\s*=\s*\(\)\s*=>\s*\{[\s\S]*?beginActiveWorkflow\(\);[\s\S]*?shareOrDownloadText\([\s\S]*?\)\.finally\(\s*endActiveWorkflow\s*\);[\s\S]*?\};/,
  gearText,
  "backup/JSON export must be guarded by beginActiveWorkflow/endActiveWorkflow",
);

assertMatch(
  /function\s+exportSessionsCsv\s*\(\)\s*\{[\s\S]*?beginActiveWorkflow\(\);[\s\S]*?shareOrDownloadText\([\s\S]*?\)\.finally\(\s*endActiveWorkflow\s*\);[\s\S]*?\}/,
  analysisText,
  "CSV export must be guarded by beginActiveWorkflow/endActiveWorkflow",
);

assertMatch(
  /ovl\.querySelector\(\s*["']#dSnapRestore["']\s*\)\.onclick\s*=\s*(?:async\s*)?\(\)\s*=>\s*\{[\s\S]*?beginActiveWorkflow\(\);[\s\S]*?\}\s*finally\s*\{\s*endActiveWorkflow\(\);\s*\}/,
  gearText,
  "snapshot restore must be guarded by beginActiveWorkflow/endActiveWorkflow",
);

assertMatch(
  /ovl\.querySelector\(\s*["']#dFile["']\s*\)\.onchange\s*=[\s\S]*?beginActiveWorkflow\(\);[\s\S]*?r\.onload\s*=[\s\S]*?finally\s*\{\s*endActiveWorkflow\(\);\s*\}[\s\S]*?r\.onerror\s*=[\s\S]*?endActiveWorkflow\(\);/,
  gearText,
  "import must be guarded by beginActiveWorkflow/endActiveWorkflow on both the success and error paths",
);

assertMatch(
  /ovl\.querySelectorAll\(\s*["']\[data-restore-trash\]["']\s*\)\.forEach\([\s\S]*?onclick\s*=[\s\S]*?beginActiveWorkflow\(\);[\s\S]*?finally\s*\{\s*endActiveWorkflow\(\);\s*\}/,
  gearText,
  "trash restore must be guarded by beginActiveWorkflow/endActiveWorkflow",
);

console.log("PWA update flow checks OK");
