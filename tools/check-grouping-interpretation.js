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
return {scoreAt,lineCutRadius,sessionMetrics,buildAnalysisRows,growthDashboard,nextPracticeSuggestions,
aggregateByPeriod,conditionSplit,todayConclusion,analysisImpactModel,conditionInsights,shapeNote,trHasGroupingEvidence};`)();
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
    rows = rowsFor(sessions),
    dash = api.growthDashboard(rows, "2026-10-05");
  const st = api.sessionMetrics(current).st,
    qualified = rows.filter((r) => api.trHasGroupingEvidence(r.st));
  check(`score population n${n}`, () => {
    assert.equal(dash.recentAverage, 9);
    assert.equal(
      rows.reduce((a, r) => a + r.n, 0),
      18 + n,
    );
    assert.equal(api.aggregateByPeriod(rows, "month")[0].arrows, 18 + n);
    assert.equal(api.conditionSplit(rows, () => false).calm.arrows, 18 + n);
  });
  check(`RMS population n${n}`, () => {
    assert.equal(dash.groupingSamples, qualified.length);
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
    check(`pending current dashboard n${n}`, () => assert.equal(dash.groupingDelta, null));
    check(`pending current impact figures n${n}`, () => {
      const im = api.analysisImpactModel(current);
      assert.equal(im.ok, false);
      assert.equal(im.positioned, n);
      assert.equal(im.rms, undefined);
      // 半径4cmの円周上の6本: 不偏RMS = 4·√(6/5) ≈ 4.38cm
      assert.equal(api.analysisImpactModel(old[0]).rms.toFixed(1), "4.4");
    });
    check(`pending conclusion n${n}`, () =>
      assert.equal(api.todayConclusion(rows).kind, "grouping-pending"),
    );
    check(`collect coordinates n${n}`, () => {
      const suggestions = api.nextPracticeSuggestions(rows, "2026-10-05");
      assert(suggestions.some((s) => s.id === "collect-coordinates"));
      assert(!suggestions.some((s) => /spread/.test(s.id)));
    });
    check(`history does not claim good n${n}`, () =>
      assert(!api.conditionInsights(current, st, null).some((s) => /次の重点|中心ズレ/.test(s))),
    );
  } else if (n >= 3) {
    check(`qualified delta n${n}`, () => assert(dash.groupingDelta < 0));
    check(`zero direction n${n}`, () => {
      assert(!api.nextPracticeSuggestions(rows, "2026-10-05").some((s) => /spread/.test(s.id)));
      assert(
        !api.conditionInsights(current, st, null).some((s) => /左右の再現性|上下の再現性/.test(s)),
      );
      assert.equal(api.shapeNote(st), "");
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
    assert.equal(api.growthDashboard(rows, "2026-10-05").groupingDelta === null, !eligible);
  });
}
const one = { ...base, id: "owned-one", date: "2026-10-04", ends: [[arrow(3.2, 0)]] };
const valid = {
  ...base,
  id: "owned-valid",
  date: "2026-10-05",
  ends: [[arrow(3.2, 0), arrow(3.2, 0), arrow(3.2, 0)]],
};
check("unqualified previous stays pending", () =>
  assert.equal(
    api.growthDashboard(rowsFor([...old, one, valid]), "2026-10-05").groupingDelta,
    null,
  ),
);
const scoreOnly = { ...base, id: "owned-score-only", date: "2026-10-05", ends: [[{ s: 7 }]] };
check("score-only trend preserved", () => {
  const rows = rowsFor([...old, scoreOnly]);
  assert.equal(api.todayConclusion(rows).kind, "trend-down");
  assert(api.nextPracticeSuggestions(rows, "2026-10-05").some((s) => s.id === "score-drop"));
  assert.equal(api.growthDashboard(rows, "2026-10-05").scoreDelta, -2);
});
const spread = {
  ...base,
  id: "owned-spread",
  date: "2026-10-05",
  ends: [Array.from({ length: 18 }, (_, i) => arrow(i % 2 ? 2 : -2, i % 3 ? 0.1 : -0.1))],
};
check("visible direction preserved", () => {
  const rows = rowsFor([...old, spread]),
    st = api.sessionMetrics(spread).st;
  assert(api.nextPracticeSuggestions(rows, "2026-10-05").some((s) => s.id === "horizontal-spread"));
  assert(api.conditionInsights(spread, st, null).some((s) => /左右の再現性/.test(s)));
  assert.match(api.shapeNote(st), /横長/);
});
for (const [scale, visible] of [
  [0.01, false],
  [1, true],
]) {
  const s = {
    ...base,
    ends: [
      Array.from({ length: 18 }, (_, i) => {
        const t = (i / 18) * Math.PI * 2,
          x = Math.cos(t) * 4 * scale,
          y = Math.sin(t) * scale;
        return arrow((x - y) / Math.sqrt(2), (x + y) / Math.sqrt(2));
      }),
    ],
  };
  check(`tilt visible ${visible}`, () => {
    const note = api.shapeNote(api.sessionMetrics(s).st);
    if (visible) assert.match(note, /斜め方向/);
    else assert.equal(note, "");
  });
}
check("one flyer does not turn a round group into a vertical-spread diagnosis", () => {
  const round = Array.from({ length: 12 }, (_, i) =>
    arrow(Math.cos((i / 12) * Math.PI * 2) * 1.5, Math.sin((i / 12) * Math.PI * 2) * 1.5),
  );
  const s = { ...base, id: "owned-flyer", date: "2026-10-05", ends: [[...round, arrow(0.2, 15)]] };
  const st = api.sessionMetrics(s).st;
  assert.equal(st.excluded.length, 1);
  assert(st.sy > st.sx * 1.3, "the all-arrow spread really is vertical");
  assert.equal(api.shapeNote(st), "");
  assert(!api.conditionInsights(s, st, null).some((x) => /上下の再現性/.test(x)));
});
check("existing strict and inclusive ratio boundaries", () => {
  const st = { total: 6, n: 6, rr: 2, sx: 1, sy: 1.3, angleDeg: 0 };
  assert.equal(api.shapeNote(st), "");
  const row = { n: 6, total: 54, avg: 9, date: "2026-10-05", st };
  assert(api.nextPracticeSuggestions([row], row.date).some((s) => s.id === "vertical-spread"));
  assert(
    !api.conditionInsights(base, { ...st, sy: 1.35 }, null).some((s) => /上下の再現性/.test(s)),
  );
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
