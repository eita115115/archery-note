"use strict";
/* 数理コアの特性テスト（characterization test）。
   現在の実装の出力を「正」として固定し、リファクタ時の出力不変を保証する。
   対象: scoreAt / 線かみ半径 / robustStats / 回帰3種 / windModel / セッション統計キャッシュ */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scoringScript = fs.readFileSync(path.join(root, "scripts", "20-scoring.js"), "utf8");
const analysisScript = fs.readFileSync(
  path.join(root, "scripts", "40-analysis-physics.js"),
  "utf8",
);

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function assertEqual(actual, expected, label) {
  assert(
    Object.is(actual, expected),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function assertClose(actual, expected, eps, label) {
  assert(
    Number.isFinite(actual) && Math.abs(actual - expected) <= eps,
    `${label}: expected ${expected} (±${eps}), got ${actual}`,
  );
}

function section(source, start, end) {
  const a = source.indexOf(start);
  assert(a >= 0, `Missing start marker: ${start}`);
  const b = source.indexOf(end, a);
  assert(b > a, `Missing end marker: ${end}`);
  return source.slice(a, b);
}

const scoring = new Function(
  `${scoringScript}
return {ringW, arrowMarkRadius, lineCutRadius, scoreAt, isLineCutting, hitFromGlobal, robustStats, groupStats, median, clamp};`,
)();

const analysis = new Function(
  `${scoringScript}
${section(analysisScript, "function num(", "function estimatedTotalArrowWeight")}
${section(analysisScript, "function sessionWindSpeed", "function windDriftText")}
${section(analysisScript, "const SESSION_METRIC_CACHE", "function sessionQuality")}
${section(analysisScript, "function regress(", "function solve3(")}
return {sessionWindSpeed, windModel, sessionMetricSignature, sessionMetrics, regress, robustLine, robustWeightedLine};`,
)();

/* ---------- scoreAt / 線かみ ---------- */

// 122cm単的: リング幅 6.1cm、矢円半径 122/85、的線半幅 122/1200
assertClose(scoring.ringW(122, "single"), 6.1, 1e-9, "ringW 122 single");
assertClose(scoring.lineCutRadius(122, "single"), 122 / 85 + 122 / 1200, 1e-9, "lineCutRadius 122 single");

// 中心は X
{
  const hit = scoring.scoreAt(0, 0, 122, "single");
  assertEqual(hit.s, 10, "center score");
  assertEqual(hit.X, true, "center is X");
}
// X 境界（touch=0 で幾何のみを確認）: w/2 ちょうどは X、僅かに外は 10 で X なし
assertEqual(scoring.scoreAt(3.05, 0, 122, "single", 0).X, true, "X boundary inclusive");
{
  const hit = scoring.scoreAt(3.06, 0, 122, "single", 0);
  assertEqual(hit.s, 10, "just outside X keeps 10");
  assertEqual(hit.X, false, "just outside X is not X");
}
// 線かみ: 10リング(6.1cm)の外 7.6cm でも矢円+線幅ぶんで 10 になる
assertEqual(scoring.scoreAt(7.6, 0, 122, "single").s, 10, "line cutter promotes to 10");
assertEqual(scoring.scoreAt(7.6, 0, 122, "single", 0).s, 9, "same point without touch is 9");
assertEqual(scoring.isLineCutting(7.6, 0, 122, "single"), true, "isLineCutting at 7.6cm");
assertEqual(scoring.isLineCutting(9, 0, 122, "single"), false, "no line cutting mid-ring");

// 三つ目的: 6点未満は 0 に切り捨て
assertEqual(scoring.scoreAt(11, 0, 40, "triple", 0).s, 0, "triple cuts below 6 to 0");
assertEqual(scoring.scoreAt(9.9, 0, 40, "triple", 0).s, 6, "triple keeps 6");
// 三つ目的のスポット吸着: (0.5, 20) は上スポット(y=22)に属し 9 点
{
  const hit = scoring.hitFromGlobal(0.5, 20, 40, "triple", 0);
  assertEqual(hit.spot, 0, "triple snaps to top spot");
  assertEqual(hit.s, 9, "triple relative score");
}

// フィールド的(40cm): リング幅 40/12、中心 6 点、6リング外は 0
assertEqual(scoring.scoreAt(0, 0, 40, "field", 0).s, 6, "field center is 6");
assertEqual(scoring.scoreAt(5, 0, 40, "field", 0).s, 5, "field 5 zone");
assertEqual(scoring.scoreAt(21, 0, 40, "field", 0).s, 0, "field miss");
assertEqual(scoring.scoreAt(0, 0, 40, "field", 0).X, false, "field has no X");

/* ---------- robustStats ---------- */

// 5本未満は simple 法 + 低信頼度
{
  const st = scoring.robustStats([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]);
  assertEqual(st.method, "simple", "small sample uses simple method");
  assertClose(st.confidence, 0.55, 1e-9, "3-arrow confidence");
  assertEqual(st.total, 3, "small sample total");
}
{
  const st = scoring.robustStats([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  assertClose(st.confidence, 0.35, 1e-9, "2-arrow confidence");
}

// 明白な外れ値 1 本はクラスタ中心を保ったまま除外される
{
  const cluster = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 },
  ];
  const st = scoring.robustStats([...cluster, { x: 40, y: 40 }]);
  assertEqual(st.method, "ellipse-biweight", "large sample uses ellipse-biweight");
  assertEqual(st.excluded.length, 1, "one outlier excluded");
  assertEqual(st.excluded[0].x, 40, "the excluded arrow is the outlier");
  assert(Math.abs(st.mx) < 0.5 && Math.abs(st.my) < 0.5, `center stays near origin, got (${st.mx}, ${st.my})`);
  assert(st.confidence > 0.3 && st.confidence <= 1, `confidence in range, got ${st.confidence}`);
}

/* ---------- 回帰 ---------- */

{
  const r = analysis.regress([[0, 1], [1, 3], [2, 5]]);
  assertClose(r.b, 2, 1e-9, "regress slope");
  assertClose(r.a, 1, 1e-9, "regress intercept");
  assertClose(r.zero, -0.5, 1e-9, "regress zero");
  assertClose(r.r2, 1, 1e-9, "regress r2");
}
{
  const r = analysis.robustLine([[0, 1], [1, 3], [2, 5]]);
  assertClose(r.b, 2, 1e-9, "robustLine slope");
  assertClose(r.zero, -0.5, 1e-9, "robustLine zero");
}
{
  const r = analysis.robustWeightedLine([[0, 1, 1], [1, 3, 1], [2, 5, 1], [3, 7, 1]]);
  assertEqual(r.kind, "weighted-robust", "robustWeightedLine kind");
  assertClose(r.zero, -0.5, 1e-6, "robustWeightedLine zero");
  assert(r.quality > 0.8, `clean-line quality should be high, got ${r.quality}`);
}
assertEqual(analysis.regress([[1, 2]]), null, "regress needs 2 points");

/* ---------- windModel ---------- */

{
  const w = analysis.windModel({ windSpeed: "4", windDir: "向かい" });
  assertEqual(w.down, -4, "headwind down");
  assertEqual(w.side, 0, "headwind side");
  assertEqual(w.label, "向かい風", "headwind label");
}
assertEqual(analysis.windModel({ windSpeed: "4", windDir: "追い" }).down, 4, "tailwind down");
assertEqual(analysis.windModel({ windSpeed: "4", windDir: "左から" }).side, 4, "left crosswind side");
assertEqual(analysis.windModel({ windSpeed: "4", windDir: "右から" }).side, -4, "right crosswind side");
{
  const w = analysis.windModel({ windSpeed: "4", windDir: "巻き" });
  assertClose(w.side, 2.2, 1e-9, "swirl side");
  assertClose(w.down, -0.8, 1e-9, "swirl down");
  assertClose(w.variability, 0.55, 1e-9, "swirl variability");
}
{
  const w = analysis.windModel({});
  assertEqual(w.speed, 0, "no wind speed");
  assertEqual(w.known, false, "no wind known");
  assertEqual(w.label, "無風扱い", "no wind label");
}
assertEqual(analysis.sessionWindSpeed({ wx: "風 強" }), 5, "strong wind text maps to 5m/s");
assertEqual(analysis.sessionWindSpeed({ windSpeed: "99" }), 18, "wind speed clamps to 18");

/* ---------- セッション統計キャッシュ ---------- */

function sampleSession() {
  return {
    id: "s1",
    date: "2026-01-01",
    dist: 70,
    faceD: 122,
    faceType: "single",
    ends: [
      [{ x: 0, y: 0, s: 10, X: true }, { x: 1, y: 2, s: 9 }],
      [{ x: -1, y: 0, s: 10 }, { x: 2, y: -1, s: 9 }],
    ],
  };
}

{
  const a = analysis.sessionMetricSignature(sampleSession());
  const b = analysis.sessionMetricSignature(sampleSession());
  assertEqual(a, b, "same session gives same signature");

  const scored = sampleSession();
  scored.ends[1][1].s = 8;
  assert(analysis.sessionMetricSignature(scored) !== a, "score change changes signature");

  const extra = sampleSession();
  extra.ends[1].push({ x: 0, y: 0, s: 10 });
  assert(analysis.sessionMetricSignature(extra) !== a, "added arrow changes signature");

  // 途中の矢の位置だけ動かしても（点数不変でも）キャッシュキーが変わること
  const nudged = sampleSession();
  nudged.ends[0][1].x += 0.4;
  assert(analysis.sessionMetricSignature(nudged) !== a, "mid-session position nudge changes signature");
}

{
  const s = sampleSession();
  const m1 = analysis.sessionMetrics(s);
  assertEqual(m1.total, 38, "session total");
  assertClose(m1.avg, 9.5, 1e-9, "session average");
  assertEqual(m1.all.length, 4, "session arrow count");
  const m2 = analysis.sessionMetrics(s);
  assert(m1 === m2, "identical session hits the metrics cache");
}

console.log("Analysis core characterization checks OK");
