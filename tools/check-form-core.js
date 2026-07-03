"use strict";
/* 射形コア (scripts/46-form-core.js) の単体テスト。
   合成ランドマーク・合成時系列のみで検証する（カメラ・MediaPipe 不要）。
   フェーズ検出のケース（低速リリース検出 / レットダウン非誤検出 / 連続2射）は
   F1 実射検証で確定した仕様なので、しきい値変更時も必ず維持すること。 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const coreScript = fs.readFileSync(path.join(root, "scripts", "46-form-core.js"), "utf8");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}
function assertEqual(actual, expected, label) {
  assert(Object.is(actual, expected), `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertClose(actual, expected, eps, label) {
  assert(Number.isFinite(actual) && Math.abs(actual - expected) <= eps, `${label}: expected ${expected} (±${eps}), got ${actual}`);
}

const core = new Function(
  `${coreScript}
return {FORM_LM, FORM_REF, FORM_PH, FORM_PHASES, formGaussScore, formAngleDeg, formDist, formLineDist,
  formMedian, computeFormMetrics, makeFormEma, makeFormPhaseDetector, stepFormPhase,
  formPreReleaseWindow, formAnchorVariation, summarizeFormShot};`,
)();

/* ---------- 幾何ヘルパー ---------- */

assertClose(core.formAngleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }), 180, 1e-9, "straight line angle");
assertClose(core.formAngleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }), 90, 1e-9, "right angle");
assertEqual(core.formAngleDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 180, "degenerate angle defaults to 180");
assertClose(core.formLineDist({ x: 0.5, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 1, 1e-9, "point-segment distance");
assertClose(core.formLineDist({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 1, 1e-9, "distance clamps to segment end");
assertEqual(core.formMedian([]), null, "median of empty");
assertClose(core.formMedian([3, 1, 2]), 2, 1e-9, "odd median");
assertClose(core.formMedian([1, 2, 3, 4]), 2.5, 1e-9, "even median");
assertEqual(core.formGaussScore(core.FORM_REF.bowArmAngle.ideal, core.FORM_REF.bowArmAngle), 100, "gauss peak at ideal");
assert(core.formGaussScore(120, core.FORM_REF.bowArmAngle) < 5, "gauss far from ideal is near zero");

/* ---------- computeFormMetrics（合成フルドロー姿勢・右利き） ---------- */

function fullDrawLandmarks() {
  const P = (x, y, v) => ({ x, y, visibility: v == null ? 0.95 : v });
  const l = [];
  l[0] = P(0.52, 0.30);                 // 鼻
  l[11] = P(0.45, 0.40); l[12] = P(0.55, 0.42);   // 肩 L/R
  l[13] = P(0.32, 0.41); l[14] = P(0.62, 0.40);   // 肘 L/R
  l[15] = P(0.20, 0.40); l[16] = P(0.56, 0.32);   // 手首 L(弓手伸展)/R(顎アンカー: 鼻から約0.2胴体長)
  l[23] = P(0.47, 0.62); l[24] = P(0.53, 0.62);   // 腰 L/R
  return l;
}

{
  const m = core.computeFormMetrics(fullDrawLandmarks(), "right");
  assert(m, "metrics computed");
  assertClose(m.bowArm, 170.8, 0.5, "bow arm angle near extension");
  assert(m.anchorNorm < core.FORM_PH.CLOSE_IN, `full draw is inside anchor zone, got ${m.anchorNorm}`);
  assert(m.bodyScale > 0.15 && m.bodyScale < 0.35, `plausible torso scale, got ${m.bodyScale}`);
  assert(m.sc.bow > 90, `bow arm score high, got ${m.sc.bow}`);
  assert(m.score > 0 && m.score <= 100, "composite score in range");
  assert(m.conf > 0.9, "confidence from visibilities");
  assertEqual(m.occluded.length, 0, "no occlusion in synthetic pose");
}
{
  // 左利き: 腕の割り当てが入れ替わる（同じ姿勢なら弓手角度が変わる）
  const r = core.computeFormMetrics(fullDrawLandmarks(), "right");
  const lft = core.computeFormMetrics(fullDrawLandmarks(), "left");
  assert(Math.abs(r.bowArm - lft.bowArm) > 10, "handedness swaps arm roles");
}
{
  // 欠損・低可視性
  assertEqual(core.computeFormMetrics(null, "right"), null, "null landmarks");
  assertEqual(core.computeFormMetrics([], "right"), null, "empty landmarks");
  const l = fullDrawLandmarks();
  l[13].visibility = 0.3; // 弓側肘（右利き時は LEFT_ELBOW）
  const m = core.computeFormMetrics(l, "right");
  assert(m.occluded.includes("弓側肘"), "low-visibility joint reported");
  const missing = fullDrawLandmarks();
  delete missing[23];
  assertEqual(core.computeFormMetrics(missing, "right"), null, "missing hip returns null");
}

/* ---------- EMA ---------- */

{
  const ema = core.makeFormEma(0.5);
  const m1 = { bowArm: 100, drawArm: 100, score: 100, conf: 1 };
  const m2 = { bowArm: 200, drawArm: 200, score: 0, conf: 0 };
  assertEqual(ema(m1).bowArm, 100, "EMA first value passes through");
  assertClose(ema(m2).bowArm, 150, 1e-9, "EMA smooths");
  assertEqual(ema(null), null, "EMA of null");
}

/* ---------- フェーズ検出（F1 実射検証で確定した3ケース） ---------- */

const mkRaw = (anchorNorm, drawArm) => ({ anchorNorm, drawArm, bodyScale: 0.25, dW: { x: 0, y: 0 } });

function runSequence(seq) {
  const st = core.makeFormPhaseDetector();
  const hist = [];
  let t = 0, phases = [], releases = 0;
  for (const [m, vel, dt] of seq) {
    t += dt;
    hist.push({ ts: t, m, vel });
    if (hist.length > 150) hist.shift();
    const r = core.stepFormPhase(st, m, hist, 1.0, t);
    phases.push(r.phase);
    if (r.released) releases++;
  }
  return { phases: [...new Set(phases)], releases, hist, lastTs: t };
}

function shotSequence() {
  const seq = [];
  for (let i = 0; i < 10; i++) seq.push([mkRaw(1.5, 90), 0.05, 66]);
  for (let i = 0; i < 8; i++) seq.push([mkRaw(1.2 - i * 0.12, 110 + i * 5), 0.5, 66]);
  for (let i = 0; i < 10; i++) seq.push([mkRaw(0.22, 150), 0.05, 66]);
  seq.push([mkRaw(0.30, 150), 0.6, 66]);
  seq.push([mkRaw(0.48, 130), 0.6, 66]); // 変位で発火（速度スパイクなし）
  for (let i = 0; i < 5; i++) seq.push([mkRaw(1.4, 90), 0.2, 66]);
  return seq;
}

{
  const r = runSequence(shotSequence());
  ["SETUP", "DRAWING", "ANCHORING", "FULL_DRAW", "RELEASE", "FOLLOW"].forEach((p) =>
    assert(r.phases.includes(p), `phase ${p} reached`));
  assertEqual(r.releases, 1, "slow-fps release detected once");
}
{
  // レットダウン（漸進的変位）は誤検出しない — 通常/速めの2速度
  [0.035, 0.053].forEach((step) => {
    const seq = [];
    for (let i = 0; i < 10; i++) seq.push([mkRaw(0.22, 150), 0.05, 66]);
    for (let i = 0; i < 24; i++) seq.push([mkRaw(0.22 + i * step, 140), 0.2, 66]);
    assertEqual(runSequence(seq).releases, 0, `let-down (step=${step}) does not fire`);
  });
}
{
  // 連続2射: 不応期を挟んで両方検出
  const seq = [...shotSequence()];
  for (let i = 0; i < 10; i++) seq.push([mkRaw(1.5, 90), 0.05, 66]);
  for (let i = 0; i < 10; i++) seq.push([mkRaw(0.22, 150), 0.05, 66]);
  seq.push([mkRaw(0.55, 130), 2.0, 66]);
  for (let i = 0; i < 5; i++) seq.push([mkRaw(1.4, 90), 0.2, 66]);
  assertEqual(runSequence(seq).releases, 2, "two shots both detected");
}
{
  // 人物未検出は IDLE
  const st = core.makeFormPhaseDetector();
  assertEqual(core.stepFormPhase(st, null, [], 1.0, 100).phase, "IDLE", "null metrics is IDLE");
}

/* ---------- リリース前ドリフト・アンカー再現性・1射要約 ---------- */

function anchorHistory(releaseTs, drift) {
  const hist = [];
  for (let ts = releaseTs - 900; ts <= releaseTs; ts += 60) {
    const k = drift ? (ts - (releaseTs - 900)) / 900 : 0;
    hist.push({
      ts,
      m: {
        anchorNorm: 0.22 + k * 0.02,
        bowArm: 171, drawArm: 150, shoulderDrop: 0.07, headOffset: 0.09, forceLine: 0.07,
        score: 80, conf: 0.9, bodyScale: 0.25,
        bW: { x: 0.2 + k * 0.06, y: 0.4 }, dW: { x: 0.6, y: 0.31 },
      },
      vel: 0.05,
    });
  }
  return hist;
}

{
  const pre = core.formPreReleaseWindow(anchorHistory(10000, true), 10000);
  assert(pre && pre.frames >= 2, "pre-release window has frames");
  assert(pre.bowDrift, "bow-hand drift flagged");
  const stable = core.formPreReleaseWindow(anchorHistory(10000, false), 10000);
  assert(stable && !stable.bowDrift && !stable.drawDrift, "stable window not flagged");
  assertEqual(core.formPreReleaseWindow([], 10000), null, "empty history");
}
{
  const av = core.formAnchorVariation([{ anchorNorm: 0.20 }, { anchorNorm: 0.21 }, { anchorNorm: 0.22 }]);
  assertEqual(av.label, "安定", "tight anchors are stable");
  const loose = core.formAnchorVariation([{ anchorNorm: 0.15 }, { anchorNorm: 0.40 }]);
  assertEqual(loose.label, "ばらつき大", "loose anchors flagged");
  assertEqual(core.formAnchorVariation([]).std, null, "no shots no std");
}
{
  const hist = anchorHistory(10000, false);
  const shot = core.summarizeFormShot(hist, 9100, 10000);
  assert(shot, "shot summary computed");
  assertEqual(shot.holdMs, 900, "hold time");
  assertClose(shot.angles.bowArm, 171, 1e-9, "median bow arm");
  assert(shot.confidence > 0.8, "summary confidence");
  assertEqual(core.summarizeFormShot([], 0, 10000), null, "no history no summary");
}

console.log("Form core checks OK");
