"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const source = fs.readFileSync(path.join(__dirname, "../scripts/50-record-view.js"), "utf8");
const start = source.indexOf("function historySessionRows(");
const end = source.indexOf("function setupPerformanceLabel(", start);
assert.ok(start >= 0 && end > start, "Score trend public functions missing");
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);
const fmtD = (value) => String(value);
const distanceLabel = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "距離未設定";
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}m`;
};
const { scoreTrendCard } = new Function("esc", "fmtD", "distanceLabel",
  source.slice(start, end) + "\nreturn {scoreTrendCard};")(esc, fmtD, distanceLabel);

// Frozen v95 behavior: aggregate all rows, select eight nonempty records, format.
function legacyScoreTrendCard(src) {
  const rows = (Array.isArray(src) ? src : []).map((s) => {
    const arrows = Array.isArray(s && s.ends)
      ? s.ends.flatMap((end) => Array.isArray(end) ? end : []) : [];
    const total = arrows.reduce((sum, a) => {
      const v = Number(a && a.s);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    return { s, arrows, total };
  }).filter((r) => r.arrows.length).slice(0, 8);
  if (!rows.length) return "";
  const body = rows.map((r) => {
    const avg = r.arrows.length ? r.total / r.arrows.length : null;
    const avgText = Number.isFinite(avg) ? avg.toFixed(2) : "—";
    const totalText = Number.isFinite(r.total) ? String(r.total) : "—";
    const date = r.s && r.s.date ? fmtD(r.s.date) : "日付未設定";
    const dist = distanceLabel(r.s && r.s.dist);
    return `<div class="listItem recordReadOnlyItem">
      <div><div class="t">${esc(date)}</div><div class="d">${esc(dist)} / ${r.arrows.length}本</div></div>
      <div class="big">${avgText}<small> / 合計${totalText}</small></div>
    </div>`;
  }).join("");
  return `<div class="card"><h2>直近の得点 <span class="mini">直近${rows.length}回</span></h2>${body}</div>`;
}
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function same(src, label) {
  const before = structuredClone(src);
  freeze(src);
  assert.equal(scoreTrendCard(src), legacyScoreTrendCard(src), label);
  assert.deepEqual(src, before, `${label}: input mutated`);
}
for (const src of [null, undefined, {}, "records", [], [null, {}, { ends: [] }]]) {
  same(src, "empty/invalid source");
}
const sparseEnd = [];
sparseEnd[2] = { s: "9" };
const sparseSessions = [];
sparseSessions[3] = { ends: [sparseEnd], dist: 70, date: "<date>" };
sparseSessions[8] = { ends: [[], "bad", [null, false, { s: "" }, { s: Infinity }]] };
same(sparseSessions, "sparse source and ends");
same([{ ends: [[{ s: Number.MAX_VALUE }, { s: Number.MAX_VALUE }]] }], "overflow display");
const mixed = Array.from({ length: 24 }, (_, i) => i % 2
  ? { date: `date-${i}`, dist: 30, ends: [[{ s: 8 }]] } : { ends: [[], null] });
same(mixed, "empty records do not consume eight slots");
assert.ok(scoreTrendCard(mixed).includes("date-15"));
assert.ok(!scoreTrendCard(mixed).includes("date-17"));
assert.ok(scoreTrendCard([{ ends: [[{ s: "9" }, null, { s: "bad" }]] }])
  .includes("3.00<small> / 合計9</small>"));

let seed = 123456;
const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
const scores = [undefined, null, NaN, Infinity, -Infinity, "bad", "", "9", true, -1, 0, 10];
for (let trial = 0; trial < 1000; trial++) {
  const sessions = [];
  const count = next() % 45;
  for (let i = 0; i < count; i++) {
    const mode = next() % 6;
    if (mode === 0) { sessions.length++; continue; }
    if (mode === 1) { sessions.push(null); continue; }
    const ends = [];
    for (let e = 0, n = next() % 5; e < n; e++) {
      if (next() % 4 === 0) { ends.push("malformed"); continue; }
      const arrows = [];
      for (let a = 0, n = next() % 7; a < n; a++) {
        const value = next();
        if (value % 5 === 0) arrows.length++;
        else arrows.push(value % 7 === 0 ? null : { s: scores[value % scores.length] });
      }
      ends.push(arrows);
    }
    sessions.push({ date: i % 3 ? `date<&${i}` : "", dist: i % 2 ? "70" : null, ends });
  }
  same(sessions, `seeded history ${trial}`);
}
console.log("Score trend: 1000 seeded histories and empty/sparse/coercion/overflow HTML unchanged; inputs immutable");

let reads = 0;
const large = Array.from({ length: 1000 }, (_, i) => ({
  date: `record-${i}`, dist: 70,
  ends: [Array.from({ length: 36 }, () => ({ get s() { reads++; return 9; } }))],
}));
const html = scoreTrendCard(large);
assert.ok(html.includes("直近8回") && html.includes("合計324"));
assert.equal(reads, 8 * 36, `Invisible old records still aggregated (${reads} score reads)`);
const unreadTail = Array.from({ length: 8 }, () => ({ ends: [[{ s: 9 }]] }));
Object.defineProperty(unreadTail, 8, { get() { throw new Error("Old record read after eighth nonempty"); } });
assert.ok(scoreTrendCard(unreadTail).includes("直近8回"));
console.log(`Score trend: 1000x36 fixture, ${reads} score reads, tail after eighth record untouched`);
