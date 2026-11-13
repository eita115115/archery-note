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

/* ==== 7b. coordinate-less arrows and manual overrides (stage 3) ==== */
const keyDb = normalizeDb({
  sessions: [{
    id: "k1", date: "2026-01-01", dist: 70, faceD: 122, faceType: "single", round: "free",
    inputMode: "<img src=x onerror=alert(1)>",
    ends: [[
      {s: 9, src: "key"},
      {x: null, y: null, s: "<b>7</b>", src: "<script>"},
      {x: 1, y: 2, s: 10, manual: true, auto: {s: "<svg onload=alert(1)>", X: "<i>"}},
    ]],
  }],
  setups: [{id: "s1", name: "test"}],
  settings: {lastInputMode: "<script>alert(1)</script>"},
});
const keyEnd = keyDb.sessions[0].ends[0];
assert(keyEnd.length === 3, "normalizeDb must keep coordinate-less arrows");
assert(!("x" in keyEnd[0]) && !("y" in keyEnd[0]) && keyEnd[0].s === 9,
  "normalizeDb must not invent coordinates for a key arrow");
assert(keyEnd[1].x === null && keyEnd[1].y === null && keyEnd[1].s === 0,
  "normalizeDb must keep null coordinates and force a malicious score to 0");
assert(typeof keyEnd[2].auto.s === "number" && keyEnd[2].auto.s === 0,
  "normalizeDb must sanitize a malicious automatic score to 0");
assert(keyDb.settings.lastInputMode === "target",
  "normalizeDb must force lastInputMode to a known value");

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

/* ==== 10. normalizeDb keeps memo notes as text and forces their types ==== */
const HOSTILE = '<img src=x onerror=alert(1)>"\'&';
const notesDb = normalizeDb({
  sessions: [{ id: "n-s1", date: "2026-11-10", ends: [], note: HOSTILE, tags: [HOSTILE, { evil: 1 }, 7] }],
  setups: [],
  notes: [
    { id: HOSTILE, date: HOSTILE, ts: HOSTILE, text: HOSTILE, tags: [HOSTILE, { evil: 1 }] },
    { id: { evil: 1 }, date: { evil: 1 }, text: { toString: 1 }, tags: { evil: 1 } },
    HOSTILE,
    null,
  ],
  trash: [{ id: "t-n", type: "note", data: { id: 5, text: 9, date: 3, tags: "x" } }],
});
assert(notesDb.notes.length === 3, "normalizeDb must keep note objects and bare text, and drop null");
assert(notesDb.notes.every((n) => typeof n.id === "string" && n.id && typeof n.text === "string" && typeof n.date === "string" && Number.isFinite(n.ts)),
  "normalizeDb must force note id/text/date to strings and ts to a number");
assert(notesDb.notes[0].text === HOSTILE && notesDb.notes[2].text === HOSTILE, "normalizeDb must not rewrite note text");
assert(notesDb.notes.every((n) => !("tags" in n) || (Array.isArray(n.tags) && n.tags.every((t) => typeof t === "string"))),
  "normalizeDb must force note tags to a list of strings");
assert(Array.isArray(notesDb.sessions[0].tags) && notesDb.sessions[0].tags.every((t) => typeof t === "string"),
  "normalizeDb must force session tags to a list of strings");
assert(typeof notesDb.trash[0].data.text === "string" && typeof notesDb.trash[0].data.id === "string" && Array.isArray(notesDb.trash[0].data.tags),
  "normalizeDb must sanitize a trashed note");

/* ==== 11. notes list / tag rows escape every user string ==== */
const src50 = fs.readFileSync(path.join(root, "scripts/50-record-view.js"), "utf8");
const src60 = fs.readFileSync(path.join(root, "scripts/60-history-sight-view.js"), "utf8");
function topLevel(src, head) {
  const a = src.indexOf(head);
  if (a < 0) throw new Error(`check-security: ${head} not found`);
  const b = src.indexOf("\n}\n", a);
  return src.slice(a, b + 3);
}
function constLine(src, head) {
  const a = src.indexOf(head);
  if (a < 0) throw new Error(`check-security: ${head} not found`);
  return src.slice(a, src.indexOf(";\n", a) + 2);
}
const noteApi = new Function(
  "window", "document", "navigator", "localStorage", "hostileDb",
  scripts +
  constLine(src50, "const WEEKDAY_JA") + topLevel(src50, "function dateParts(") + topLevel(src50, "function sessionArrows(") +
  constLine(src50, "const sumScores") +
  constLine(src60, "const NOTE_TAGS") + topLevel(src60, "function noteDateOk(") + topLevel(src60, "function noteDayChanges(") +
  topLevel(src60, "function noteDayCellHtml(") + topLevel(src60, "function noteChangesHtml(") + topLevel(src60, "function historyRowHtml(") +
  topLevel(src60, "function memoRowHtml(") + topLevel(src60, "function historyDistanceLabel(") + topLevel(src60, "function noteTagsHtml(") +
  "\ndb = hostileDb; return {historyRowHtml,memoRowHtml,noteTagsHtml,noteDayChanges,noteChangesHtml};"
)(
  {}, { querySelector() { return null; } }, {}, { getItem() { return null; }, setItem() {} },
  normalizeDb({
    sessions: [],
    setups: [{ id: "hs", name: HOSTILE, history: [{ date: "2026-11-10", changes: [{ label: HOSTILE, from: HOSTILE, to: HOSTILE }] }] }],
    sightMarks: [{ id: "hm", setupId: "hs", dist: 70, v: HOSTILE, h: HOSTILE, date: "2026-11-10" }],
  }),
);
const dayChanges = noteApi.noteDayChanges().get("2026-11-10");
assert(Array.isArray(dayChanges) && dayChanges.length === 2, "noteDayChanges must collect the gear change and the sight record of the day");
const hostileHtml = [
  noteApi.historyRowHtml(
    { id: HOSTILE, date: "2026-11-10", dist: 70, faceD: 122, faceType: "single", setupId: "hs", wx: HOSTILE, note: HOSTILE, round: HOSTILE,
      roundGroup: { gid: HOSTILE, stage: HOSTILE, stageCount: HOSTILE, roundId: HOSTILE }, ends: [[{ s: 9, src: "key" }]] },
    dayChanges,
  ),
  noteApi.historyRowHtml({ id: "x", date: HOSTILE, dist: HOSTILE, faceD: 122, faceType: "single", ends: [] }, null),
  noteApi.memoRowHtml({ id: HOSTILE, date: HOSTILE, text: HOSTILE, tags: [HOSTILE] }, dayChanges),
  noteApi.noteTagsHtml([HOSTILE]),
].join("\n");
assert(!/<img/i.test(hostileHtml), "notes HTML must not let user text create an element");
assert(!/onerror=alert\(1\)>"/.test(hostileHtml), "notes HTML must escape quotes in user text");
assert(hostileHtml.includes("&lt;img src=x onerror=alert(1)&gt;"), "notes HTML must show user text as text");
assert(!/NaN|undefined|\[object/.test(hostileHtml), "notes HTML must not print NaN / undefined / [object");

/* ==== Summary ==== */
if (fail > 0) {
  console.error(`\nSecurity regression: ${fail} FAILED, ${pass} passed`);
  process.exit(1);
} else {
  console.log(`Security regression: all ${pass} checks passed`);
}
