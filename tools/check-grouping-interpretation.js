"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, "scripts", file), "utf8");
const view = read("50-record-view.js");
/* 分析 > 着弾 の数値（v5 段 7。旧 KPI の枠と「練習のまとめ」は廃止）。全射の値は 3射以上でだけ出す */
const kpi = view.slice(
  view.indexOf("function analysisImpactModel("),
  view.indexOf("/* エンドごとの RMS（全射と同じ定義）"),
);
assert(kpi.includes("function analysisImpactModel("), "analysisImpactModel source missing");
const api = new Function(`let DB_REV=0;
const db={settings:{eyeSight:850}};
const esc=String, icon=()=>"", fmtD=String;
${read("20-scoring.js")}
${read("40-analysis-physics.js")}
${read("45-analysis-core.js")}
${read("49-todays-result.js")}
${kpi}
return {scoreAt,lineCutRadius,sessionMetrics,buildAnalysisRows,
aggregateByPeriod,conditionSplit,analysisImpactModel,trHasGroupingEvidence};`)();
const failures = [];
let checks = 0;
function check(label, fn) {
  checks++;
  try {
    fn();
  } catch (e) {
    failures.push(label + ": " + e.message);
  }
}
const base = { dist: 18, faceD: 40, faceType: "single", perEnd: 6, round: "free", shaft: 0.65 };
const arrow = (x, y) => ({
  x,
  y,
  ...api.scoreAt(x, y, 40, "single", api.lineCutRadius(40, "single")),
});
const old = [0, 1, 2].map((i) => ({
  ...base,
  id: "owned-prior-" + i,
  date: "2026-10-0" + (i + 1),
  ends: [
    Array.from({ length: 6 }, (_, j) =>
      arrow(Math.cos((j / 6) * Math.PI * 2) * 4, Math.sin((j / 6) * Math.PI * 2) * 4),
    ),
  ],
}));
const rowsFor = (sessions) => api.buildAnalysisRows(sessions, [], api.sessionMetrics);
const before = JSON.stringify(old);
const average = (vals) => vals.reduce((a, v) => a + v, 0) / vals.length;
for (const n of [0, 1, 2, 3, 6]) {
  const current = {
    ...base,
    id: "owned-current",
    date: "2026-10-05",
    ends: [Array.from({ length: n }, () => arrow(3.2, 0))],
  };
  const sessions = [...old, current],
    rows = rowsFor(sessions);
  const qualified = rows.filter((r) => api.trHasGroupingEvidence(r.st));
  check(`score population n${n}`, () => {
    assert.equal(
      rows.reduce((a, r) => a + r.n, 0),
      18 + n,
    );
    assert.equal(api.aggregateByPeriod(rows, "month")[0].arrows, 18 + n);
    assert.equal(api.conditionSplit(rows, () => false).calm.arrows, 18 + n);
  });
  check(`RMS population n${n}`, () => {
    assert.equal(qualified.length, n >= 3 ? 4 : 3);
    assert.equal(
      api.aggregateByPeriod(rows, "month")[0].avgRms,
      average(qualified.map((r) => r.st.rr)),
    );
    assert.equal(
      api.conditionSplit(rows, () => false).calm.avgRms,
      average(qualified.map((r) => r.st.rr)),
    );
    assert.equal(
      api.conditionSplit(rows, () => false).calm.biasX,
      average(qualified.map((r) => r.st.mx)),
    );
  });
  if (n === 1 || n === 2) {
    check(`pending current impact figures n${n}`, () => {
      const im = api.analysisImpactModel(current);
      assert.equal(im.ok, false);
      assert.equal(im.positioned, n);
      assert.equal(im.rms, undefined);
      // 半径4cmの円周上の6本: 不偏RMS = 4·√(6/5) ≈ 4.38cm
      assert.equal(api.analysisImpactModel(old[0]).rms.toFixed(1), "4.4");
    });
  }
  check(`no mutation n${n}`, () => assert.equal(JSON.stringify(old), before));
}
for (const [kind, arrs, eligible] of [
  ["missing", [arrow(3.2, 0), arrow(3.2, 0), { s: 9, X: false }], false],
  ["invalid", [arrow(3.2, 0), arrow(3.2, 0), { x: "invalid", y: 0, s: 9, X: false }], false],
  ["strings", Array.from({ length: 3 }, () => ({ ...arrow(3.2, 0), x: "3.2", y: "0" })), true],
]) {
  const s = { ...base, id: kind, date: "2026-10-05", ends: [arrs] },
    rows = rowsFor([...old, s]);
  check(`coordinates ${kind}`, () => {
    assert.equal(api.sessionMetrics(s).total, 27);
    assert.equal(api.trHasGroupingEvidence(api.sessionMetrics(s).st), eligible);
    assert.equal(rows.filter((r) => api.trHasGroupingEvidence(r.st)).length, eligible ? 4 : 3);
  });
}
const scoreOnly = { ...base, id: "owned-score-only", date: "2026-10-05", ends: [[{ s: 7 }]] };
check("score-only record keeps its score and stays out of grouping", () => {
  const rows = rowsFor([...old, scoreOnly]),
    row = rows.find((r) => r.id === "owned-score-only");
  assert.equal(row.total, 7);
  assert.equal(row.n, 1);
  assert.equal(api.trHasGroupingEvidence(row.st), false);
  assert.equal(api.aggregateByPeriod(rows, "month")[0].arrows, 19);
});
for (const st of [
  null,
  { total: 3, n: 2, rr: 0 },
  { total: 2, n: 3, rr: 0 },
  { total: 3, n: 3, rr: Infinity },
  { total: 3, n: 3, rr: NaN },
])
  check("invalid qualification " + JSON.stringify(st), () =>
    assert.equal(api.trHasGroupingEvidence(st), false),
  );
if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`${failures.length} failed / ${checks} grouping interpretation checks`);
  process.exitCode = 1;
} else
  console.log(
    `Grouping interpretation checks OK (${checks} checks; real scoring/statistics, score populations retained)`,
  );
