"use strict";
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scripts = [
  "scripts/00-compat.js",
  "scripts/10-storage-native.js",
  "scripts/20-scoring.js",
  "scripts/30-target-svg.js",
].map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n");

let pass = 0;
let fail = 0;
function assert(ok, msg) {
  if (ok) { pass++; return; }
  fail++;
  console.error(`FAIL: ${msg}`);
}

/* ---- extract functions under test ---- */
const sandbox = new Function(
  "window", "document", "navigator", "localStorage",
  scripts +
  "\nreturn {esc,fmtD,sanitizeArrowList,normalizeDb,scoreLabel,csvCell,markCircle,faceLabel};"
)(
  {matchMedia:()=>({matches:false}),ArcheryNativeStorage:null},
  {querySelector:()=>null},
  {},
  {getItem:()=>null,setItem:()=>true}
);
const {esc,fmtD,sanitizeArrowList,normalizeDb,scoreLabel,csvCell,markCircle,faceLabel} = sandbox;

/* ==== 1. esc() covers HTML-sensitive characters ==== */
assert(esc('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;', "esc must escape angle brackets");
assert(esc('"onclick="alert(1)') === '&quot;onclick=&quot;alert(1)', "esc must escape double quotes");
assert(esc("a&b") === "a&amp;b", "esc must escape ampersand");
assert(esc(null) === "", "esc(null) must return empty string");
assert(esc(undefined) === "", "esc(undefined) must return empty string");

/* ==== 2. fmtD() rejects non-ISO dates ==== */
assert(fmtD("2026-07-04") === "2026/7/4", "fmtD must format valid ISO date");
assert(fmtD("<script>alert(1)</script>") === "", "fmtD must reject HTML injection");
assert(fmtD("not-a-date") === "", "fmtD must reject non-date strings");
assert(fmtD(null) === "", "fmtD(null) must return empty");
assert(fmtD(undefined) === "", "fmtD(undefined) must return empty");
assert(fmtD(42) === "", "fmtD(number) must return empty");
assert(fmtD("2026-01-01T00:00:00Z".slice(0,10)) === "2026/1/1", "fmtD must handle trimmed ISO datetime");

/* ==== 3. Arrow score sanitization ==== */
const malicious = [{s:'<img src=x onerror=alert(1)>', x:0, y:0}];
sanitizeArrowList(malicious);
assert(typeof malicious[0].s === "number" && malicious[0].s === 0,
  "sanitizeArrowList must force non-numeric score to 0");

const normal = [{s:10, x:5, y:-3, X:true}];
sanitizeArrowList(normal);
assert(normal[0].s === 10 && normal[0].X === true,
  "sanitizeArrowList must preserve valid numeric scores");

const strScore = [{s:"7", x:"2.5", y:"-1.3"}];
sanitizeArrowList(strScore);
assert(strScore[0].s === 7 && strScore[0].x === 2.5 && strScore[0].y === -1.3,
  "sanitizeArrowList must convert numeric strings to numbers");

/* ==== 4. scoreLabel() output is safe when escaped ==== */
const evilArrow = {s: 0};
assert(scoreLabel(evilArrow) === "M", "scoreLabel with s=0 must return M");
const xArrow = {s: 10, X: true};
assert(scoreLabel(xArrow) === "X", "scoreLabel with X flag must return X");

/* ==== 5. markCircle() escapes label in SVG ==== */
const svg = markCircle({x:0,y:0}, 122, "#000", '<script>alert(1)</script>', "");
assert(!svg.includes("<script>"), "markCircle must escape script tags in label");
assert(svg.includes("&lt;script&gt;"), "markCircle must HTML-encode label");

const safeSvg = markCircle({x:0,y:0}, 122, "#000", "10", "");
assert(safeSvg.includes(">10</text>"), "markCircle must render safe labels normally");

/* ==== 6. csvCell() formula injection protection ==== */
assert(csvCell("=1+2") === "\"'=1+2\"", "csvCell must prefix = with single quote");
assert(csvCell("+cmd|'/C calc'!A0") === "\"'+cmd|'/C calc'!A0\"", "csvCell must prefix + with single quote");
assert(csvCell("-1+1") === "\"'-1+1\"", "csvCell must prefix - with single quote");
assert(csvCell("@SUM(A1)") === "\"'@SUM(A1)\"", "csvCell must prefix @ with single quote");
assert(csvCell("normal text") === '"normal text"', "csvCell must not prefix normal text");
assert(csvCell(42) === '"42"', "csvCell must handle numbers");
assert(csvCell(null) === '""', "csvCell must handle null");
assert(csvCell('has "quotes"') === '"has ""quotes"""', "csvCell must double-escape quotes");
assert(csvCell(" =1+1").startsWith("\"'"), "csvCell must catch leading-space formula");
assert(csvCell("\t@evil").startsWith("\"'"), "csvCell must catch leading-tab formula");

/* ==== 7. normalizeDb sanitizes imported data ==== */
const evilDb = {
  sessions: [{
    id: "test1",
    date: "2026-01-01",
    ends: [[{s: '<img onerror=alert(1)>', x: '<script>', y: 'evil'}]],
    dist: 70, faceD: 122, faceType: "single", round: "free",
  }],
  setups: [{id: "s1", name: "test"}],
};
const cleaned = normalizeDb(evilDb);
const cleanedArrow = cleaned.sessions[0].ends[0][0];
assert(typeof cleanedArrow.s === "number" && cleanedArrow.s === 0,
  "normalizeDb must sanitize malicious arrow scores to 0");
assert(typeof cleanedArrow.x === "number" && cleanedArrow.x === 0,
  "normalizeDb must sanitize malicious arrow x to 0");
assert(typeof cleanedArrow.y === "number" && cleanedArrow.y === 0,
  "normalizeDb must sanitize malicious arrow y to 0");

/* ==== 8. normalizeDb validates session metadata ==== */
const metaDb = {
  sessions: [{
    id: "m1", date: "2026-01-01", ends: [],
    faceD: '<script>alert(1)</script>', faceType: "evil", dist: "not-a-number",
  }],
  setups: [{id: "s1", name: "test"}],
};
const metaCleaned = normalizeDb(metaDb);
const sess = metaCleaned.sessions[0];
assert(typeof sess.faceD === "number" && Number.isFinite(sess.faceD),
  "normalizeDb must force faceD to finite number");
assert(["single","triple","field"].includes(sess.faceType),
  "normalizeDb must force faceType to known value");
assert(typeof sess.dist === "number" && Number.isFinite(sess.dist),
  "normalizeDb must force dist to finite number");

/* ==== 9. faceLabel() is safe with coerced values ==== */
const safeLabel = faceLabel({faceD: '<script>', faceType: "single"});
assert(!safeLabel.includes("<script>"), "faceLabel must not pass through HTML");
assert(safeLabel.includes("0cm"), "faceLabel must coerce non-numeric faceD to 0");

/* ==== Summary ==== */
if (fail > 0) {
  console.error(`\nSecurity regression: ${fail} FAILED, ${pass} passed`);
  process.exit(1);
} else {
  console.log(`Security regression: all ${pass} checks passed`);
}
