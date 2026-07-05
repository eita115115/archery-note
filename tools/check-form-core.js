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
  formPreReleaseWindow, formAnchorVariation, summarizeFormShot,
  formRecordStats, formRecordInsights, formTrendSeries, formScoreLink};`,
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

/* 15fps(dt=66ms)で離脱が totalMs で完了する現実的なリリース区間を作る。
   ease-out（離脱直後が最速、その後減速）カーブを dt 間隔でサンプリングし、
   vel は実コードと同じ定義（区間のアンカー変化量/dt）で正しく算出する
   （速度をアンカー変化と無関係な固定値にすると検出ロジックの検証にならない）。 */
function releaseFrames(totalMs, dt, fromAnchor) {
  const frames = [];
  let prevA = fromAnchor;
  for (let t = dt; t <= totalMs + dt; t += dt) {
    const x = Math.min(1, t / totalMs);
    const eased = 1 - Math.pow(1 - x, 2);
    const a = fromAnchor + (1 - fromAnchor) * eased;
    const vel = Math.abs(a - prevA) / (dt / 1000);
    frames.push([mkRaw(a, 130), vel, dt]);
    prevA = a;
    if (x >= 1) break;
  }
  return frames;
}

function shotSequence(dt) {
  const d = dt || 66;
  const seq = [];
  for (let i = 0; i < 10; i++) seq.push([mkRaw(1.5, 90), 0.05, d]);
  for (let i = 0; i < 8; i++) seq.push([mkRaw(1.2 - i * 0.12, 110 + i * 5), 0.5, d]);
  for (let i = 0; i < 10; i++) seq.push([mkRaw(0.22, 150), 0.05, d]);
  seq.push(...releaseFrames(90, d, 0.22)); // 90msで離脱完了する現実的なリリース
  for (let i = 0; i < 5; i++) seq.push([mkRaw(1.4, 90), 0.2, d]);
  return seq;
}

{
  const r = runSequence(shotSequence());
  ["SETUP", "DRAWING", "ANCHORING", "FULL_DRAW", "RELEASE", "FOLLOW"].forEach((p) =>
    assert(r.phases.includes(p), `phase ${p} reached`));
  assertEqual(r.releases, 1, "low-fps (15fps) realistic release detected once");
}
{
  // レットダウン誤検出境界の回帰テスト（2026-07-05 修理）。
  // 実測: 100ms〜2000ms の線形レットダウンはいずれも誤検出しないことを確認済み
  // （境界表は 46-form-core.js の RELEASE_TH コメント参照）。50ms は 1 フレームで
  // 完了する極限ケースで、20fps 相当では速度スパイクがリリースと数値上区別できず
  // 対象外（停止条件の対象は「50ms〜2s」のうち計測可能な範囲）。
  [2000, 1500, 1200, 1100, 1000, 900, 800, 700, 600, 500, 400, 300, 250, 200, 150, 100].forEach((totalMs) => {
    [20, 50].forEach((dt) => {
      const seq = [];
      for (let i = 0; i < 60; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
      const frames = Math.max(1, Math.round(totalMs / dt));
      const step = 0.78 / frames;
      for (let i = 1; i <= frames; i++) seq.push([mkRaw(0.22 + i * step, 140), step / (dt / 1000), dt]);
      for (let i = 0; i < 30; i++) seq.push([mkRaw(1.0, 90), 0.02, dt]);
      assertEqual(runSequence(seq).releases, 0, `let-down ${totalMs}ms (dt=${dt}) does not fire`);
    });
  });
}
{
  // 現実的なリリース速度プロファイル（離脱 50-100ms で完了）は確実に検出する
  [50, 60, 80, 100].forEach((totalMs) => {
    [20, 50].forEach((dt) => {
      const seq = [];
      for (let i = 0; i < 60; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
      seq.push(...releaseFrames(totalMs, dt, 0.22));
      for (let i = 0; i < 20; i++) seq.push([mkRaw(1.0, 90), 0.02, dt]);
      assertEqual(runSequence(seq).releases, 1, `realistic release ${totalMs}ms (dt=${dt}) is detected`);
    });
  });
}
{
  // レットダウン → 本物のリリース の複合シナリオ: 1 射のみ検出（レットダウンが余分な射にならない）
  [2000, 1000, 500, 150].forEach((letdownMs) => {
    const dt = 20;
    const seq = [];
    for (let i = 0; i < 60; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
    const ldFrames = Math.max(1, Math.round(letdownMs / dt));
    const step = 0.78 / ldFrames;
    for (let i = 1; i <= ldFrames; i++) seq.push([mkRaw(0.22 + i * step, 140), step / (dt / 1000), dt]);
    for (let i = 0; i < 20; i++) seq.push([mkRaw(1.0, 90), 0.02, dt]);
    for (let i = 1; i <= 12; i++) seq.push([mkRaw(1.0 - 0.78 * (i / 12), 110 + i), 0.5, dt]); // 再度ドロー
    for (let i = 0; i < 20; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
    seq.push(...releaseFrames(80, dt, 0.22));
    for (let i = 0; i < 20; i++) seq.push([mkRaw(1.0, 90), 0.02, dt]);
    assertEqual(runSequence(seq).releases, 1, `let-down(${letdownMs}ms) then real release counts as one shot`);
  });
}
{
  // 連続2射: 不応期を挟んで両方検出
  const seq = [...shotSequence()];
  for (let i = 0; i < 10; i++) seq.push([mkRaw(1.5, 90), 0.05, 66]);
  for (let i = 0; i < 10; i++) seq.push([mkRaw(0.22, 150), 0.05, 66]);
  seq.push(...releaseFrames(80, 66, 0.22));
  for (let i = 0; i < 5; i++) seq.push([mkRaw(1.4, 90), 0.2, 66]);
  assertEqual(runSequence(seq).releases, 2, "two shots both detected");
}
{
  // 確定猶予: released 直後にアンカー圏へ即座に戻るスパイクは取消される
  const dt = 20;
  const st = core.makeFormPhaseDetector();
  const hist = [];
  let t = 0, releases = 0, canceled = 0;
  const push = (m, vel) => {
    t += dt;
    hist.push({ ts: t, m, vel });
    const r = core.stepFormPhase(st, m, hist, 1.0, t);
    if (r.released) releases++;
    if (r.canceled) canceled++;
  };
  for (let i = 0; i < 60; i++) push(mkRaw(0.22, 150), 0.02);
  push(mkRaw(0.6, 140), 10); // 瞬間的な検出ノイズでTH超え
  for (let i = 0; i < 10; i++) push(mkRaw(0.23, 150), 0.05); // CONFIRM_MS以内にアンカー圏へ復帰
  assertEqual(releases, 1, "noise spike still registers as released");
  assertEqual(canceled, 1, "but is canceled once anchor returns within confirm window");
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


/* ---------- 記録統計・コーチングコメント・トレンド・得点との関係 ---------- */

function makeFormRecord(id, date, opts) {
  const o = opts || {};
  const stable = o.stable == null ? true : o.stable;
  const feature = (i) => ({
    phase: { anchorMs: o.holdMs == null ? 1800 : o.holdMs },
    angles: { bowArm: o.bowArm == null ? 171 : o.bowArm, drawArm: o.drawArm == null ? 150 : o.drawArm },
    anchorNorm: 0.2 + i * (o.anchorSpread || 0.002),
    release: { bowMove: 0.02, drawMove: 0.02, stable },
    confidence: 0.9,
    score: 80,
  });
  return {
    id, date, ts: o.ts || 0, sessionId: o.sessionId || null, setupId: null,
    shots: o.shots || 3, modelVer: "test", appVer: 66, fps: 20,
    features: Array.from({ length: o.shots || 3 }, (_, i) => feature(i)), note: "",
  };
}

{
  const st = core.formRecordStats(makeFormRecord("r1", "2026-07-01", { holdMs: 2000, bowArm: 168 }));
  assertEqual(st.shots, 3, "record stats shot count");
  assertClose(st.bowArm, 168, 1e-9, "record stats bow arm median");
  assertClose(st.holdMs, 2000, 1e-9, "record stats hold median");
  assertEqual(st.driftRate, 0, "all-stable record has zero drift rate");
  assertEqual(core.formRecordStats({ features: [] }), null, "empty record stats");
  assertEqual(core.formRecordStats(null), null, "null record stats");
}
{
  // ドリフトが多い記録: 原因候補と「次の練習」にドリフト対策が入る
  const drifty = makeFormRecord("r2", "2026-07-02", { stable: false });
  const ins = core.formRecordInsights(drifty);
  assert(ins.facts.some((t) => t.includes("ドリフト")), "drift observed in facts");
  assert(ins.causes.length >= 1, "drifty record has causes");
  assert(ins.next.some((t) => t.includes("弓手固定")), "drift countermeasure in next");
}
{
  // 安定した記録: 既定の「次の練習」だけが出る
  const ins = core.formRecordInsights(makeFormRecord("r3", "2026-07-02", {}));
  assert(ins.next.length === 1 && ins.next[0].includes("同じ撮影角度"), "stable record gets default next");
}
{
  // 前回比: 保持時間の変化が原因候補に載る
  const prev = makeFormRecord("p", "2026-07-01", { holdMs: 1500 });
  const cur = makeFormRecord("c", "2026-07-02", { holdMs: 2600 });
  const ins = core.formRecordInsights(cur, prev);
  assert(ins.causes.some((t) => t.includes("前回より") && t.includes("長く")), "hold delta vs previous reported");
}
{
  // 2026-07-05: エリート基準（172°等）との比較表示は撤去。自分基準（前回比）のみ言及する
  const prev = makeFormRecord("p2", "2026-07-01", { bowArm: 168 });
  const cur = makeFormRecord("c2", "2026-07-02", { bowArm: 180 });
  const ins = core.formRecordInsights(cur, prev);
  const allText = [...ins.facts, ...ins.causes, ...ins.checks, ...ins.next].join(" ");
  assert(!allText.includes("エリート基準"), "no elite-reference wording in insights");
  assert(!allText.includes(String(core.FORM_REF.bowArmAngle.ideal)), "no elite ideal-angle number leaks into insights");
  assert(ins.facts.some((t) => t.includes("前回比") && t.includes("+12")), "bow-arm self-baseline delta reported");
}
{
  // 3射未満（中央値が出るまで）は formRecordStats 自体は計算できるが、
  // 呼び出し側（47-form-view.js）は生値表示に切り替える前提。ここではコア側が
  // 単純に中央値を返すだけであることを確認する（表示切替はビュー側の責務）。
  const single = makeFormRecord("s1", "2026-07-03", { shots: 1, bowArm: 175 });
  const st = core.formRecordStats(single);
  assertEqual(st.shots, 1, "single-shot record still yields stats");
}
{
  const series = core.formTrendSeries([
    makeFormRecord("b", "2026-07-02", { ts: 2 }),
    makeFormRecord("a", "2026-07-01", { ts: 1 }),
  ]);
  assertEqual(series.length, 2, "trend series length");
  assertEqual(series[0].id, "a", "trend series sorted by date");
  assert(Number.isFinite(series[0].bowArm) && Number.isFinite(series[0].holdS), "trend point fields");
  assertEqual(core.formTrendSeries([]).length, 0, "empty trend series");
}
{
  const sessions = [
    { id: "s1", ends: [[{ s: 10 }, { s: 9 }]] },
    { id: "s2", ends: [[{ s: 7 }, { s: 6 }]] },
  ];
  const metricsFn = (s) => {
    const all = s.ends.flat();
    const total = all.reduce((a, x) => a + x.s, 0);
    return { all, total, avg: all.length ? total / all.length : 0, st: null };
  };
  const records = [
    makeFormRecord("f1", "2026-07-01", { sessionId: "s1", stable: true }),
    makeFormRecord("f2", "2026-07-02", { sessionId: "s2", stable: false }),
    makeFormRecord("f3", "2026-07-03", {}), // 未紐付け
  ];
  const link = core.formScoreLink(records, sessions, metricsFn);
  assertEqual(link.n, 2, "only linked records pair up");
  assert(link.split, "split computed with both stable and drifty");
  assertClose(link.split.stableAvg, 9.5, 1e-9, "stable-day average");
  assertClose(link.split.driftAvg, 6.5, 1e-9, "drift-day average");
  const none = core.formScoreLink([makeFormRecord("f4", "2026-07-04", {})], sessions, metricsFn);
  assertEqual(none.n, 0, "unlinked records give no pairs");
  assertEqual(none.split, null, "no split without pairs");
}

console.log("Form core checks OK");
