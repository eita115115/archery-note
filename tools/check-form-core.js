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
  formMedian, computeFormMetrics, makeFormEma, makeFormPhaseDetector, stepFormPhase, computeFormVelocity,
  FORM_VEL_FILTER, makeFormVelocitySource,
  formPreReleaseWindow, formAnchorVariation, summarizeFormShot,
  formRecordStats, formRecordInsights, formTrendSeries, formScoreLink,
  ARROW_PRESENCE, arrowPresence, ARROW_CHECK, judgeArrowCheck};`,
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

function runSequence(seq, coreObj) {
  const c = coreObj || core;
  const st = c.makeFormPhaseDetector();
  const hist = [];
  let t = 0, phases = [], releases = 0;
  for (const [m, vel, dt] of seq) {
    t += dt;
    hist.push({ ts: t, m, vel });
    if (hist.length > 150) hist.shift();
    const r = c.stepFormPhase(st, m, hist, 1.0, t);
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
  // null フレームブリッジ: リリース中に MediaPipe がトラッキングを見失っても検出できる
  const dt = 20;
  const seq = [];
  for (let i = 0; i < 60; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
  // リリース開始: 2フレーム分の速度スパイク
  seq.push([mkRaw(0.35, 140), 6, dt]);
  seq.push([mkRaw(0.50, 130), 8, dt]);
  // MediaPipe ドロップアウト: null フレームが3つ
  seq.push([null, 0, dt]);
  seq.push([null, 0, dt]);
  seq.push([null, 0, dt]);
  // 復帰: アンカーから離れた位置
  seq.push([mkRaw(1.0, 90), 0.2, dt]);
  for (let i = 0; i < 20; i++) seq.push([mkRaw(1.0, 90), 0.02, dt]);
  assertEqual(runSequence(seq).releases, 1, "null-frame bridged release detected");
}
{
  /* D'（Stage 1）: nullBridged の時間ベースギャップ上限 NB_MAX_GAP_MS=150 の両側境界。
     ギャップ span = 窓内の最初のnullフレーム→最後のnullフレームの経過時間（実装と同定義）。
     140ms は検出 / 200ms は非検出。復帰フレームの vel=8 は NB_MAXV(2) 超・RELEASE_TH(9) 未満
     に置き、velOk でなく nullBridged 経路が判定を決めることを保証する。 */
  function gapBridgedSequence(nullCount) {
    const seq = [];
    // アンカー保持（10ms間隔）。110フレーム=1100ms: REFRACTORY_MS(1000ms、起点 lastReleaseTs=0)を
    // 追い越しつつ、窓内に十分な closeFrames を残す
    for (let i = 0; i < 110; i++) seq.push([mkRaw(0.22, 150), 0.02, 10]);
    for (let i = 0; i < nullCount; i++) seq.push([null, 0, 20]); // 姿勢ロス: span=(nullCount-1)*20ms
    seq.push([mkRaw(1.0, 90), 8, 10]); // 復帰: アンカー圏外・大きめの見かけ速度
    for (let i = 0; i < 10; i++) seq.push([mkRaw(1.0, 90), 0.2, 20]);
    return seq;
  }
  assertEqual(runSequence(gapBridgedSequence(8)).releases, 1, "140ms null gap is bridged (fires)");
  assertEqual(runSequence(gapBridgedSequence(11)).releases, 0, "200ms null gap is not bridged (does not fire)");
  // 定数を無効値（∞）へ戻すと現行（導入前）と同値 = 200ms ギャップでも発火する。
  // これは同時に「上の非検出テストが NB_MAX_GAP_MS によって落ちている」ことの証明でもある
  assert(coreScript.includes("NB_MAX_GAP_MS: 150,"), "NB_MAX_GAP_MS constant present for ∞-substitution test");
  const coreInfGap = new Function(
    `${coreScript.replace("NB_MAX_GAP_MS: 150,", "NB_MAX_GAP_MS: Infinity,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  assertEqual(runSequence(gapBridgedSequence(11), coreInfGap).releases, 1,
    "disabling NB_MAX_GAP_MS (Infinity) restores pre-D' behavior on the 200ms gap");
}
/* [既知の制約・文書化のみ、strict-review 2026-07-11 finding]: 上の140/200ms境界テストが
   計測するギャップ span は「窓内に現れた最初のnullフレームts→最後のnullフレームts」であり、
   ギャップが250ms窓(RISE_WINDOW_MS)の左端に接している場合（＝本当のロス区間が窓外へ続いて
   いる可能性がある場合）、実際の姿勢ロス時間を過小評価しうる。合成再現で確認済みの経路:
   アンカー保持 → 実スパン220msの姿勢ロス（null 12フレーム, dt=20ms）→ 復帰close 2フレーム
   → vel=3 の緩慢な引き戻し、という系列が released=1（発火）になる。理由は releaseTs 直前の
   250ms窓にギャップの先頭部分が入らず、在窓の計測値が 140ms ≤ NB_MAX_GAP_MS(150) に収まる
   ため。加えてスパン定義そのものが「先頭null ts→末尾null ts」なので、真のロス時間（有効
   フレーム→有効フレーム間隔）を約2フレーム間隔ぶん恒常的に過小評価する（低fpsほど誤差が
   拡大: dt=66msでは null 3枚=132msの計測でも実ロスは約264ms）。
   strict-reviewの総合判断はこれを「push可・T8前の必須修正ではない」と結論しており（次工程
   条件は診断解釈時にこの経路を前提として読むことのみ）、本コミットではロジック変更をしない。
   修正方向（案）: (a) ギャップを「直前の有効フレームts→直後の有効フレームts」で計測する、
   (b) ギャップが窓左端に接している場合は上限超過側に倒す。実施する場合は設計書
   form-phase-final-design.md §6-D' への差し戻しフィードバックとセットで、境界テスト
   （140/200ms）の再導出込みの別タスクとする。 */
{
  /* B'（Stage 1・中立スキャフォールド）: conf ゲート。出荷値 CONF_GATE=0 は完全無効＝現行同値。
     0.45 へ差し替えたコアでは conf<0.45 のフレームが窓から除外される（ロジック検証のみ、発動はしない）。 */
  assertEqual(core.FORM_PH.CONF_GATE, 0, "CONF_GATE ships disabled (0)");
  assertEqual(core.FORM_PH.DW_VIS_GATE, 0, "DW_VIS_GATE ships disabled (0)");
  const mkRawC = (anchorNorm, drawArm, conf) => ({ anchorNorm, drawArm, conf, bodyScale: 0.25, dW: { x: 0, y: 0 } });
  const confMixedSeq = [];
  for (let i = 0; i < 60; i++) confMixedSeq.push([mkRawC(0.22, 150, 0.4), 0.02, 20]); // 低conf(0.4)のアンカー保持
  confMixedSeq.push([mkRawC(0.6, 140, 0.5), 10, 20]); // 高conf(0.5)の速度スパイク
  for (let i = 0; i < 10; i++) confMixedSeq.push([mkRawC(1.0, 90, 0.5), 0.2, 20]);
  assertEqual(runSequence(confMixedSeq).releases, 1, "conf-mixed release fires with CONF_GATE=0 (current behavior)");
  assert(coreScript.includes("CONF_GATE: 0,"), "CONF_GATE constant present for substitution test");
  const coreConfGate = new Function(
    `${coreScript.replace("CONF_GATE: 0,", "CONF_GATE: 0.45,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  assertEqual(runSequence(confMixedSeq, coreConfGate).releases, 0,
    "CONF_GATE=0.45 excludes conf-0.4 frames from the window (closeFrames starve, no fire)");
  // 除外の観測: ゲート済みフレームは窓内で null 側に数えられる（debug.nullFrames）
  const trace = (coreObj) => {
    const st = coreObj.makeFormPhaseDetector();
    const hist = [];
    let t = 0, spikeDebug = null;
    for (const [m, vel, dt] of confMixedSeq) {
      t += dt; hist.push({ ts: t, m, vel });
      const r = coreObj.stepFormPhase(st, m, hist, 1.0, t);
      if (m && m.anchorNorm === 0.6 && r.debug) spikeDebug = r.debug;
    }
    return spikeDebug;
  };
  const gated = trace(coreConfGate), ungated = trace(core);
  assert(gated && gated.nullFrames > 0, "gated low-conf frames counted as window gaps under CONF_GATE=0.45");
  assert(ungated && ungated.nullFrames === 0, "no window gaps with CONF_GATE=0 on the same sequence");
}
{
  /* B': dW 可視性ゲート。出荷値 DW_VIS_GATE=0 は完全無効＝現行同値。
     0.5 へ差し替えたコアでは低可視性 dW フレームの vel が maxV 評価から除外される。 */
  const mkRawV = (anchorNorm, drawArm, dwVis) => ({ anchorNorm, drawArm, bodyScale: 0.25, dW: { x: 0, y: 0, visibility: dwVis } });
  const visMixedSeq = [];
  for (let i = 0; i < 60; i++) visMixedSeq.push([mkRawV(0.22, 150, 0.9), 0.02, 20]);
  visMixedSeq.push([mkRawV(0.6, 140, 0.4), 10, 20]); // 速度スパイクだが dW 可視性が低い（遮蔽由来の偽値を模擬）
  for (let i = 0; i < 10; i++) visMixedSeq.push([mkRawV(1.0, 90, 0.9), 0.2, 20]);
  assertEqual(runSequence(visMixedSeq).releases, 1, "low-dW-visibility spike fires with DW_VIS_GATE=0 (current behavior)");
  assert(coreScript.includes("DW_VIS_GATE: 0,"), "DW_VIS_GATE constant present for substitution test");
  const coreDwGate = new Function(
    `${coreScript.replace("DW_VIS_GATE: 0,", "DW_VIS_GATE: 0.5,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  assertEqual(runSequence(visMixedSeq, coreDwGate).releases, 0,
    "DW_VIS_GATE=0.5 removes the low-visibility spike from velocity evaluation (no fire)");
}
{
  /* B'×D'相互作用（設計 form-phase-final-design.md §9-8、strict-review 2026-07-11
     「T8前の必須解消事項」）: 低confフレーム混在（conf除外がhasNullGapを増やすが実nullでは
     ない）系列で、CONF_GATE(0/0.45) × NB_MAX_GAP_MS(150/∞) の4通りの検出結果を固定する。
     シナリオは strict-review の合成再現条件と同一: 高confアンカー保持 → conf=0.3 の遮蔽
     180ms（実nullではない）→ NB_MAXV(2)超・RELEASE_TH(9)未満の vel=3 の緩慢な引き戻し。
       - CONF_GATE=0（出荷値）: ゲート無効なので遮蔽フレームも通常フレームとして扱われ、
         実nullが存在しない → hasNullGap 自体が立たず、NB_MAX_GAP_MS の値に関わらず非発火
         （0/150, 0/∞ の2通り）。
       - CONF_GATE=0.45 & NB_MAX_GAP_MS=150（両ゲートがT8で有効化される想定の組み合わせ）:
         conf除外フレームが hasNullGap を立てる一方、maxGapMs も同じ「win 基準」で 180ms を
         計測するため NB_MAX_GAP_MS(150) を超過し nullBridged は不成立＝非発火。ここが本コミット
         で修正した maxGapMs のゲート非対称の直接の回帰対象（46-form-core.js のループが旧来の
         `!h.m` 基準のままなら、conf除外フレームはここでカウントされず maxGapMs=0 のままとなり、
         誤って発火していたはずの組み合わせ）。
       - CONF_GATE=0.45 & NB_MAX_GAP_MS=∞: D' の時間上限そのものを無効化した組み合わせ。
         conf除外による仮想ギャップが無制限に橋渡しされるため発火する（D'を切った結果であり
         今回のfindingの対象外＝想定どおりの挙動）。 */
  const mkRawG = (anchorNorm, drawArm, conf) => ({ anchorNorm, drawArm, conf, bodyScale: 0.25, dW: { x: 0, y: 0 } });
  function confGapInteractionSequence() {
    const seq = [];
    // 高confアンカー保持（10ms間隔110フレーム=1100ms）: REFRACTORY_MS(1000ms)を追い越しつつ
    // 250ms窓に十分な closeFrames を残す（gapBridgedSequence と同構成）
    for (let i = 0; i < 110; i++) seq.push([mkRawG(0.22, 150, 0.9), 0.02, 10]);
    // 遮蔽180ms: 実nullではなく conf=0.3 の低信頼フレーム（10フレーム×20ms、span=180ms）
    for (let i = 0; i < 10; i++) seq.push([mkRawG(0.22, 150, 0.3), 0.02, 20]);
    // 復帰: NB_MAXV(2)超・RELEASE_TH(9)未満の緩慢な引き戻し（velOkでなくnullBridged経路を狙う）
    seq.push([mkRawG(1.0, 90, 0.9), 3, 10]);
    for (let i = 0; i < 10; i++) seq.push([mkRawG(1.0, 90, 0.9), 0.2, 20]);
    return seq;
  }
  assert(coreScript.includes("CONF_GATE: 0,"), "CONF_GATE constant present for interaction substitution");
  assert(coreScript.includes("NB_MAX_GAP_MS: 150,"), "NB_MAX_GAP_MS constant present for interaction substitution");
  const coreGateOffGapInf = new Function(
    `${coreScript.replace("NB_MAX_GAP_MS: 150,", "NB_MAX_GAP_MS: Infinity,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  const coreGateOnGapOn = new Function(
    `${coreScript.replace("CONF_GATE: 0,", "CONF_GATE: 0.45,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  const coreGateOnGapInf = new Function(
    `${coreScript.replace("CONF_GATE: 0,", "CONF_GATE: 0.45,").replace("NB_MAX_GAP_MS: 150,", "NB_MAX_GAP_MS: Infinity,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  const interactionSeq = confGapInteractionSequence();
  assertEqual(runSequence(interactionSeq, core).releases, 0,
    "CONF_GATE=0 x NB_MAX_GAP_MS=150 (shipped): no real null frame, no fire");
  assertEqual(runSequence(interactionSeq, coreGateOffGapInf).releases, 0,
    "CONF_GATE=0 x NB_MAX_GAP_MS=Infinity: gate disabled, still no fire regardless of the gap cap");
  assertEqual(runSequence(interactionSeq, coreGateOnGapOn).releases, 0,
    "CONF_GATE=0.45 x NB_MAX_GAP_MS=150: conf-excluded 180ms gap exceeds the cap, correctly suppressed (maxGapMs fix under test)");
  assertEqual(runSequence(interactionSeq, coreGateOnGapInf).releases, 1,
    "CONF_GATE=0.45 x NB_MAX_GAP_MS=Infinity: D' time cap disabled, virtual gap bridges unconditionally (fires)");
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
{
  /* Plan-0（release-detection-triage-2026-07-13 §3.3/§5）: stepFormPhase の
     非発火・取消 return パスでも debug が返ることを検証する。判定ロジック（phase/
     released/canceled/anchorStartTs の値）は既存ケースが担保するのでここでは触らない。 */
  const assertDebugShape = (debug, label) => {
    assert(typeof debug === "object" && debug !== null, `${label}: debug returned on non-fire path`);
    assert("maxV" in debug && "anchorNorm" in debug && "closeFrames" in debug && "hasNullGap" in debug,
      `${label}: debug has maxV/anchorNorm/closeFrames/hasNullGap`);
    ["rise", "nullFrames", "conf", "refractoryRemaining"].forEach((k) =>
      assert(k in debug, `${label}: debug has key ${k}`));
  };

  // !usable（人物未検出）: win/closeFrames 未計算のため null で埋まるが debug 自体は必ず返る
  const rU = core.stepFormPhase(core.makeFormPhaseDetector(), null, [], 1.0, 100);
  assertDebugShape(rU.debug, "!usable path");
  assertEqual(rU.debug.anchorNorm, null, "!usable path: anchorNorm unknown, filled with null (not fabricated)");

  // release-fire → canceled（確定猶予内にアンカー圏へ復帰）
  const dtC = 20;
  const stC = core.makeFormPhaseDetector();
  const histC = [];
  let tC = 0;
  const pushC = (m, vel) => { tC += dtC; histC.push({ ts: tC, m, vel }); return core.stepFormPhase(stC, m, histC, 1.0, tC); };
  for (let i = 0; i < 60; i++) pushC(mkRaw(0.22, 150), 0.02);
  const rRelC = pushC(mkRaw(0.6, 140), 10); // 瞬間的な検出ノイズでTH超え(released)
  assertEqual(rRelC.released, true, "sanity: release fires before cancel scenario");
  assertDebugShape(rRelC.debug, "release-fire path");
  const rCancel = pushC(mkRaw(0.23, 150), 0.05); // CONFIRM_MS以内にアンカー圏へ復帰(canceled)
  assertEqual(rCancel.canceled, true, "sanity: cancel path reached");
  assertDebugShape(rCancel.debug, "canceled path");
  assertClose(rCancel.debug.anchorNorm, 0.23, 1e-9, "canceled path: anchorNorm captured (not lost) before state reset");

  // sticky RELEASE lock（<250ms）と FOLLOW（250-1100ms）: 発火が確定し取消されないシナリオ
  const dtS = 20;
  const stS = core.makeFormPhaseDetector();
  const histS = [];
  let tS = 0;
  const pushS = (m, vel) => { tS += dtS; histS.push({ ts: tS, m, vel }); return core.stepFormPhase(stS, m, histS, 1.0, tS); };
  for (let i = 0; i < 60; i++) pushS(mkRaw(0.22, 150), 0.02);
  const rRelS = pushS(mkRaw(0.6, 140), 10); // TH超えでreleased
  assertEqual(rRelS.released, true, "sanity: release fires before sticky/follow scenario");
  const rSticky = pushS(mkRaw(1.0, 90), 0.2); // アンカー圏外へ離脱、250ms未満のsticky lock
  assertEqual(rSticky.phase, "RELEASE", "sanity: sticky RELEASE lock active");
  assertDebugShape(rSticky.debug, "sticky RELEASE-lock path");
  for (let i = 0; i < 12; i++) pushS(mkRaw(1.0, 90), 0.2); // 250ms超過させる
  const rFollow = pushS(mkRaw(1.0, 90), 0.2);
  assertEqual(rFollow.phase, "FOLLOW", "sanity: FOLLOW window active");
  assertDebugShape(rFollow.debug, "FOLLOW path");

  // 通常の非発火パス（アンカー保持中、release条件未達）
  const stN = core.makeFormPhaseDetector();
  const histN = [];
  let tN = 0, rNormal;
  for (let i = 0; i < 5; i++) { tN += 20; histN.push({ ts: tN, m: mkRaw(0.22, 150), vel: 0.02 }); rNormal = core.stepFormPhase(stN, mkRaw(0.22, 150), histN, 1.0, tN); }
  assertDebugShape(rNormal.debug, "normal non-fire path");
  assert(rNormal.debug.closeFrames >= 0, "normal non-fire path: closeFrames is a real count, not null");
}
{
  // DRAWING 方向チェック（Stage 0 E'）: anchorNorm 増加方向（レットダウン等）は DRAWING に遷移しない。
  // trend +0.1/フレーム、vel 0.5〜7.8 の範囲のレットダウン系列で DRAWING が一度も出ないこと
  [20, 66].forEach((dt) => {
    const seq = [];
    for (let i = 0; i < 30; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
    for (let i = 1; i <= 9; i++) seq.push([mkRaw(0.22 + i * 0.1, 140), 0.1 / (dt / 1000), dt]); // 0.32→1.12
    for (let i = 0; i < 20; i++) seq.push([mkRaw(1.5, 90), 0.02, dt]);
    const r = runSequence(seq);
    assert(!r.phases.includes("DRAWING"), `let-down (dt=${dt}) never classified as DRAWING, got ${r.phases}`);
    assertEqual(r.releases, 0, `let-down (dt=${dt}) direction-check sequence does not fire`);
  });
}
{
  // ゆっくりしたドロー（vel 0.3-0.5、trend 負）は引き続き DRAWING に到達する
  const dt = 66;
  const seq = [];
  for (let i = 0; i < 10; i++) seq.push([mkRaw(1.5, 90), 0.05, dt]);
  for (let i = 0; i < 25; i++) seq.push([mkRaw(1.15 - i * 0.03, 110), 0.45, dt]);
  const r = runSequence(seq);
  assert(r.phases.includes("DRAWING"), `slow draw with negative trend reaches DRAWING, got ${r.phases}`);
}

/* ---------- computeFormVelocity（Stage 0 A1: 47の旧インライン実装と同値であること） ---------- */

{
  const mkM = (x, y) => ({ dW: { x, y }, bodyScale: 0.25 });
  // 通常系: 旧インライン実装 formDist(raw.dW, lv.m.dW)/dt/raw.bodyScale と同値
  const hist = [
    { ts: 100, m: mkM(0.5, 0.3), vel: 0 },
    { ts: 150, m: null, vel: 0 },
    { ts: 200, m: mkM(0.6, 0.3), vel: 1 },
  ];
  const raw = mkM(0.7, 0.3);
  const expected = core.formDist(raw.dW, hist[2].m.dW) / 0.05 / raw.bodyScale;
  assertClose(core.computeFormVelocity(hist, raw, 250), expected, 1e-9, "velocity matches legacy inline computation");
  assertClose(core.computeFormVelocity(hist, raw, 250), 8, 1e-9, "velocity value (0.1 / 0.05s / 0.25 torso)");
  // 末尾が null フレームでも直近の有効フレームまで遡って基準にする
  const histNullTail = [
    { ts: 100, m: mkM(0.5, 0.3), vel: 0 },
    { ts: 200, m: null, vel: 0 },
  ];
  const expected2 = core.formDist(raw.dW, histNullTail[0].m.dW) / 0.15 / raw.bodyScale;
  assertClose(core.computeFormVelocity(histNullTail, raw, 250), expected2, 1e-9, "trailing null frames are skipped");
}
{
  const mkM = (x, y) => ({ dW: { x, y }, bodyScale: 0.25 });
  const raw = mkM(0.7, 0.3);
  // dt 境界: 0 以下と 0.5秒以上は 0（旧実装の dt>0 && dt<0.5 と同一）
  assertEqual(core.computeFormVelocity([{ ts: 250, m: mkM(0.5, 0.3), vel: 0 }], raw, 250), 0, "dt=0 returns 0");
  assertEqual(core.computeFormVelocity([{ ts: 300, m: mkM(0.5, 0.3), vel: 0 }], raw, 250), 0, "negative dt returns 0");
  assertEqual(core.computeFormVelocity([{ ts: 0, m: mkM(0.5, 0.3), vel: 0 }], raw, 500), 0, "dt=0.5s boundary returns 0");
  assert(core.computeFormVelocity([{ ts: 1, m: mkM(0.5, 0.3), vel: 0 }], raw, 500) > 0, "dt just under 0.5s is computed");
  // 有効フレーム無し・raw 無しは 0
  assertEqual(core.computeFormVelocity([{ ts: 100, m: null, vel: 0 }, { ts: 200, m: null, vel: 0 }], raw, 250), 0, "all-null history returns 0");
  assertEqual(core.computeFormVelocity([], raw, 250), 0, "empty history returns 0");
  assertEqual(core.computeFormVelocity([{ ts: 100, m: mkM(0.5, 0.3), vel: 0 }], null, 250), 0, "null raw returns 0");
}

/* ---------- makeFormVelocitySource（Stage 1 A2: 中立スキャフォールド） ---------- */

{
  // 出荷値は無効（pass-through）。発動は FORM_VEL_FILTER.ENABLED の1行変更のみ
  assertEqual(core.FORM_VEL_FILTER.ENABLED, false, "1-Euro velocity filter ships disabled");
}
{
  // ENABLED:false は computeFormVelocity と完全同値（null フレーム・空 history 含む）
  const mkM = (x, y) => ({ dW: { x, y }, bodyScale: 0.25 });
  const src = core.makeFormVelocitySource();
  const hist = [];
  let t = 0;
  [0.5, 0.51, 0.53, null, 0.56, 0.6, 0.6, 0.61].forEach((x) => {
    t += 33;
    const raw = x == null ? null : mkM(x, 0.3);
    assertEqual(src.step(hist, raw, t), core.computeFormVelocity(hist, raw, t),
      `disabled source matches computeFormVelocity at t=${t}`);
    hist.push({ ts: t, m: raw, vel: 0 });
  });
  assertEqual(core.makeFormVelocitySource().step([], mkM(0.5, 0.3), 100), 0, "disabled source on empty history returns 0");
}
{
  // ENABLED:true（オプトインのロジック検証のみ・出荷値では動かない）
  const mkM = (x, y) => ({ dW: { x, y }, bodyScale: 0.25 });
  // (1) 等速運動: 収束後の速度が真値（0.01/0.02s/0.25 = 2.0 胴体長/秒）に近い
  const f1 = core.makeFormVelocitySource({ ENABLED: true });
  let t = 0, vel = 0;
  for (let i = 0; i < 60; i++) { t += 20; vel = f1.step([], mkM(0.3 + i * 0.01, 0.3), t); }
  assertClose(vel, 2.0, 0.2, "enabled filter converges to true velocity on constant motion");
  // (2) ジッター抑制: 交互±0.02ジッターの生速度は 8.0（RELEASE_TH級の偽スパイク）だが、フィルタ後は大幅減
  const f2 = core.makeFormVelocitySource({ ENABLED: true });
  t = 0;
  let maxFiltered = 0;
  for (let i = 0; i < 60; i++) {
    t += 20;
    const v = f2.step([], mkM(0.5 + (i % 2 ? 0.02 : -0.02), 0.3), t);
    if (i > 10) maxFiltered = Math.max(maxFiltered, v);
  }
  assert(maxFiltered < 2, `jitter velocity suppressed well below raw 8.0, got ${maxFiltered}`);
  // (3) RESET_GAP_MS 超のギャップで内部状態を作り直す（直後のフレームは vel 0）
  const f3 = core.makeFormVelocitySource({ ENABLED: true });
  f3.step([], mkM(0.5, 0.3), 100);
  f3.step([], mkM(0.52, 0.3), 120);
  assertEqual(f3.step([], mkM(0.9, 0.3), 800), 0, "gap over RESET_GAP_MS reseeds the filter (vel 0)");
  // (4) reset() で明示リセット（利き手切替等、history 破棄と同時に呼ぶ想定）
  const f4 = core.makeFormVelocitySource({ ENABLED: true });
  f4.step([], mkM(0.5, 0.3), 100);
  f4.reset();
  assertEqual(f4.step([], mkM(0.9, 0.3), 200), 0, "explicit reset reseeds (vel 0)");
}

/* ---------- anchorStartTs のコア内包化（Stage 0 C: sticky 仕様） ---------- */

function makeStepper(dt) {
  const st = core.makeFormPhaseDetector();
  const hist = [];
  let t = 0;
  return {
    push(m, vel) {
      t += dt;
      hist.push({ ts: t, m, vel });
      if (hist.length > 150) hist.shift();
      return { r: core.stepFormPhase(st, m, hist, 1.0, t), t };
    },
  };
}

{
  // sticky: ANCHORING → DRAWING（約200msの一時離脱・ジッター相当の微小トレンド）→ ANCHORING → release
  // で anchorStartTs（= hold の起点）が通しで保持される
  const s = makeStepper(66);
  let firstAnchorTs = 0;
  for (let i = 0; i < 10; i++) {
    const { r, t } = s.push(mkRaw(0.33, 150), 0.05);
    if (!firstAnchorTs && (r.phase === "ANCHORING" || r.phase === "FULL_DRAW")) {
      firstAnchorTs = t;
      assertEqual(r.anchorStartTs, t, "anchorStartTs set on first anchoring frame");
    }
  }
  assert(firstAnchorTs > 0, "anchoring reached in sticky scenario");
  for (let i = 0; i < 3; i++) {
    const { r } = s.push(mkRaw(0.37, 150), 0.5); // アンカー圏外だが微小トレンド → DRAWING
    assertEqual(r.phase, "DRAWING", "brief excursion is DRAWING");
    assertEqual(r.anchorStartTs, firstAnchorTs, "anchorStartTs sticky through DRAWING excursion");
  }
  for (let i = 0; i < 5; i++) {
    const { r } = s.push(mkRaw(0.33, 150), 0.05);
    assertEqual(r.anchorStartTs, firstAnchorTs, "anchorStartTs unchanged after re-anchoring");
  }
  const rel = s.push(mkRaw(0.6, 140), 10); // 速度スパイクでリリース
  assertEqual(rel.r.released, true, "release fires after sticky excursion");
  assertEqual(rel.r.anchorStartTs, firstAnchorTs, "released frame returns pre-clear anchorStartTs (hold spans excursion)");
  const after = s.push(mkRaw(1.0, 90), 0.2);
  assertEqual(after.r.anchorStartTs, 0, "anchorStartTs cleared after release");
}
{
  // リセット: ANCHORING → SETUP（完全離脱・低速）で anchorStartTs=0、再アンカーで新しい値
  const s = makeStepper(66);
  let firstAnchorTs = 0;
  for (let i = 0; i < 10; i++) {
    const { r, t } = s.push(mkRaw(0.30, 150), 0.05);
    if (!firstAnchorTs && (r.phase === "ANCHORING" || r.phase === "FULL_DRAW")) firstAnchorTs = t;
  }
  assert(firstAnchorTs > 0, "anchoring reached in reset scenario");
  let last = null;
  for (let i = 0; i < 6; i++) last = s.push(mkRaw(1.5, 90), 0.05);
  assertEqual(last.r.phase, "SETUP", "slow full withdrawal is SETUP");
  assertEqual(last.r.anchorStartTs, 0, "anchorStartTs reset on SETUP");
  let secondAnchorTs = 0;
  for (let i = 0; i < 5; i++) {
    const { r, t } = s.push(mkRaw(0.30, 150), 0.05);
    if (!secondAnchorTs && (r.phase === "ANCHORING" || r.phase === "FULL_DRAW")) secondAnchorTs = t;
  }
  assert(secondAnchorTs > firstAnchorTs, "re-anchor starts a new anchorStartTs");
}
{
  // canceled: 取消フレームで anchorStartTs=now（アンカー継続として仕切り直し）
  const s = makeStepper(20);
  for (let i = 0; i < 60; i++) s.push(mkRaw(0.22, 150), 0.02);
  const rel = s.push(mkRaw(0.6, 140), 10); // 瞬間ノイズで released
  assertEqual(rel.r.released, true, "noise spike releases before cancel");
  assert(rel.r.anchorStartTs > 0, "released frame carries pre-clear anchorStartTs");
  const cancel = s.push(mkRaw(0.23, 150), 0.05); // CONFIRM_MS 以内にアンカー圏へ復帰 → 取消
  assertEqual(cancel.r.canceled, true, "return to anchor cancels");
  assertEqual(cancel.r.anchorStartTs, cancel.t, "canceled frame restarts anchorStartTs at now");
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

/* ---------- T-Anchor（Stage 1 §12.3）: pre-release 窓の anchorStartTs クランプ ---------- */

/* 短ホールド射の合成履歴（60ms間隔）。anchorStartTs より前は DRAWING 相当
   （手首が大きく移動・アンカー圏外）、以降は完全に静止したホールド。 */
function shortHoldHistory(releaseTs, anchorStartTs) {
  const hist = [];
  for (let ts = releaseTs - 900; ts <= releaseTs; ts += 60) {
    const drawing = ts < anchorStartTs;
    const k = drawing ? (anchorStartTs - ts) / 1000 : 0; // 遡るほどアンカーから遠い位置
    hist.push({
      ts,
      m: {
        anchorNorm: drawing ? 0.8 : 0.22,
        bowArm: 171, drawArm: 150, shoulderDrop: 0.07, headOffset: 0.09, forceLine: 0.07,
        score: 80, conf: 0.9, bodyScale: 0.25,
        bW: { x: 0.2 + k * 0.5, y: 0.4 }, dW: { x: 0.6 + k * 0.5, y: 0.31 },
      },
      vel: drawing ? 3 : 0.05,
    });
  }
  return hist;
}

{
  // ホールド300ms（<FULLDRAW_MS=350ms）の射: クランプ無しでは固定500ms窓の前半が
  // DRAWING 区間へ食い込み、静止ホールドなのにドリフト扱いになる（実射で確認した症状）
  const hist = shortHoldHistory(10000, 9700);
  const unclamped = core.formPreReleaseWindow(hist, 10000);
  assert(unclamped && unclamped.bowDrift && unclamped.drawDrift,
    "short-hold shot without clamp is contaminated by DRAWING frames (documents the symptom)");
  // クランプあり: 窓が anchorStartTs 以降に限定され、静止ホールドが正しく stable 判定になる
  const clamped = core.formPreReleaseWindow(hist, 10000, null, 9700);
  assert(clamped, "clamped window still has enough frames");
  assertEqual(clamped.frames, 4, "clamped window contains only frames at/after anchorStartTs");
  assert(!clamped.bowDrift && !clamped.drawDrift && !clamped.headDrift,
    `clamped short-hold window is stable, got bowMove=${clamped.bowMove} drawMove=${clamped.drawMove}`);
  assert(unclamped.frames > clamped.frames, "clamp strictly narrows the window");
}
{
  // アンカー未保持（anchorStartTs が 0/null/未指定）は現行と同値
  const hist = shortHoldHistory(10000, 9700);
  const legacy = core.formPreReleaseWindow(hist, 10000);
  assertEqual(JSON.stringify(core.formPreReleaseWindow(hist, 10000, null, 0)), JSON.stringify(legacy),
    "anchorStartTs=0 behaves exactly like current code");
  assertEqual(JSON.stringify(core.formPreReleaseWindow(hist, 10000, null, null)), JSON.stringify(legacy),
    "anchorStartTs=null behaves exactly like current code");
  // ホールドが窓より長い（anchorStartTs が releaseTs-500ms より前）ならクランプは no-op
  assertEqual(JSON.stringify(core.formPreReleaseWindow(hist, 10000, null, 9000)), JSON.stringify(legacy),
    "anchorStartTs earlier than the 500ms window is a no-op");
  // ホールドが極端に短く窓内に2フレーム残らない場合は汚染値でなく null
  assertEqual(core.formPreReleaseWindow(hist, 10000, null, 9860), null,
    "ultra-short hold yields null instead of DRAWING-contaminated values");
}
{
  // summarizeFormShot 経由（エンドツーエンド）: ホールド300msの射でも pre が stable になる
  const hist = shortHoldHistory(10000, 9700);
  const shot = core.summarizeFormShot(hist, 9700, 10000);
  assert(shot && shot.pre, "short-hold shot summary has a pre-release window");
  assertEqual(shot.holdMs, 300, "short hold time");
  assert(!shot.pre.bowDrift && !shot.pre.drawDrift, "short-hold pre window is stable via summarizeFormShot");
  // アンカー未保持の射は現行と同値（クランプ不発）
  const noAnchor = core.summarizeFormShot(hist, null, 10000);
  assertEqual(JSON.stringify(noAnchor && noAnchor.pre), JSON.stringify(core.formPreReleaseWindow(hist, 10000)),
    "summary without anchorStartTs keeps the legacy unclamped window");
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

/* ---------- 矢プレゼンス検出（合成フレーム） ---------- */

/* mulberry32: 低ビットの周期性が弱い簡易 PRNG。ANSI C 由来の単純 LCG は低ビットに
   短周期があり、背景ノイズが偶然「線っぽい」周期パターンを作ってしまい検出器の
   分離性テストとして不適切だったため、こちらに置き換えた。 */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 合成 RGBA バッファを作る。bg=背景輝度(0-255), noiseAmp=一様乱数ノイズ振幅。
   seed 付き PRNG でテストの再現性を保つ。 */
function makeFrame(w, h, bg, noiseAmp, seed) {
  const data = new Uint8ClampedArray(w * h * 4);
  const rnd = makeRng(seed == null ? 1 : seed);
  for (let i = 0; i < w * h; i++) {
    const n = noiseAmp ? (rnd() * 2 - 1) * noiseAmp : 0;
    const v = Math.max(0, Math.min(255, bg + n));
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

/* frame に p1-p2 を結ぶ細線（幅 lineW px, 輝度 lineVal）を描く。occludeFrac が
   与えられれば線分中央付近をその比率だけ背景輝度で塗り戻す（レスト付近の部分遮蔽を模擬）。 */
function drawLine(frame, p1, p2, lineVal, lineW, occludeFrac) {
  const { data, width: w, height: h } = frame;
  const x1 = p1.x * w, y1 = p1.y * h, x2 = p2.x * w, y2 = p2.y * h;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.ceil(len * 2);
  const halfW = lineW / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (occludeFrac && Math.abs(t - 0.5) < occludeFrac / 2) continue; // 中央部を遮蔽
    const cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t;
    for (let ox = -halfW; ox <= halfW; ox++) {
      for (let oy = -halfW; oy <= halfW; oy++) {
        const xi = Math.round(cx + ox), yi = Math.round(cy + oy);
        if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue;
        const i2 = (yi * w + xi) * 4;
        data[i2] = lineVal; data[i2 + 1] = lineVal; data[i2 + 2] = lineVal;
      }
    }
  }
  return frame;
}

/* p1-p2 を中点まわりに deg 度だけ回転させた新しい点対を返す（傾き検証用） */
function rotatePts(p1, p2, deg) {
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const rot = (p) => {
    const dx = p.x - mx, dy = p.y - my;
    return { x: mx + dx * cos - dy * sin, y: my + dx * sin + dy * cos };
  };
  return [rot(p1), rot(p2)];
}

const AP_P1 = { x: 0.2, y: 0.5 }, AP_P2 = { x: 0.8, y: 0.5 };
const AP_W = 200, AP_H = 200;

{
  // (a) 黒地に細線あり → 高スコア
  const f = drawLine(makeFrame(AP_W, AP_H, 20, 0, 1), AP_P1, AP_P2, 230, 2);
  const score = core.arrowPresence(f, AP_P1, AP_P2);
  assert(score > 0.8, `synthetic line on dark bg scores high, got ${score}`);
}
{
  // (b) 線なし → 低スコア
  const f = makeFrame(AP_W, AP_H, 20, 0, 1);
  const score = core.arrowPresence(f, AP_P1, AP_P2);
  assertEqual(score, 0, `no line present scores zero, got ${score}`);
}

const scoreTable = [];
function recordCase(label, score) { scoreTable.push({ label, score: +score.toFixed(3) }); }

{
  // (c) ノイズ・背景テクスチャ・部分遮蔽・傾き±15° の合成条件下での分離性
  const withLine = [];
  const withoutLine = [];

  // ノイズ背景（線あり/なし）
  {
    const f = drawLine(makeFrame(AP_W, AP_H, 40, 12, 7), AP_P1, AP_P2, 220, 2);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("noisy bg + line", s); withLine.push(s);
  }
  {
    const f = makeFrame(AP_W, AP_H, 40, 12, 7);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("noisy bg, no line", s); withoutLine.push(s);
  }
  // 背景テクスチャ（強めノイズ、線あり/なし）
  {
    const f = drawLine(makeFrame(AP_W, AP_H, 60, 25, 42), AP_P1, AP_P2, 210, 2);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("textured bg + line", s); withLine.push(s);
  }
  {
    const f = makeFrame(AP_W, AP_H, 60, 25, 42);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("textured bg, no line", s); withoutLine.push(s);
  }
  // 部分遮蔽（レスト付近、線の中央20%を欠損させても検出できるか）
  {
    const f = drawLine(makeFrame(AP_W, AP_H, 30, 8, 3), AP_P1, AP_P2, 220, 2, 0.2);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("partially occluded line (rest area)", s); withLine.push(s);
  }
  // 傾き ±15°（線あり/なし）
  [15, -15].forEach((deg) => {
    const [q1, q2] = rotatePts(AP_P1, AP_P2, deg);
    const f = drawLine(makeFrame(AP_W, AP_H, 35, 10, 11 + deg), q1, q2, 215, 2);
    const s = core.arrowPresence(f, q1, q2);
    recordCase(`tilted ${deg}deg + line`, s); withLine.push(s);
    const fNo = makeFrame(AP_W, AP_H, 35, 10, 11 + deg);
    const sNo = core.arrowPresence(fNo, q1, q2);
    recordCase(`tilted ${deg}deg, no line`, sNo); withoutLine.push(sNo);
  });
  // (d) 明暗2条件（明るい背景+暗い線／暗い背景+明るい線）
  {
    const f = drawLine(makeFrame(AP_W, AP_H, 220, 6, 5), AP_P1, AP_P2, 30, 2);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("bright bg, dark line", s); withLine.push(s);
  }
  {
    const f = drawLine(makeFrame(AP_W, AP_H, 15, 6, 6), AP_P1, AP_P2, 200, 2);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("dark bg, bright line", s); withLine.push(s);
  }

  const minWith = Math.min(...withLine);
  const maxWithout = Math.max(...withoutLine);

  console.log("\n矢プレゼンス検出: 合成フレーム分離性テーブル");
  console.log("label".padEnd(36), "score");
  scoreTable.forEach((r) => console.log(r.label.padEnd(36), r.score));
  console.log(`  min(あり)=${minWith.toFixed(3)}  max(なし)=${maxWithout.toFixed(3)}  分離しきい値候補=${core.ARROW_PRESENCE.PRESENT_TH}`);

  assert(minWith > maxWithout, `presence/absence score distributions must not overlap: min(with)=${minWith} <= max(without)=${maxWithout}`);
  assert(minWith > core.ARROW_PRESENCE.PRESENT_TH, `weakest "present" case must clear PRESENT_TH, got ${minWith}`);
  assert(maxWithout < core.ARROW_PRESENCE.PRESENT_TH, `strongest "absent" case must stay below PRESENT_TH, got ${maxWithout}`);
}
{
  // 境界: null 入力
  assertEqual(core.arrowPresence(null, AP_P1, AP_P2), 0, "null imageData scores zero");
  assertEqual(core.arrowPresence(makeFrame(10, 10, 0, 0, 1), null, AP_P2), 0, "null p1 scores zero");
  assertEqual(core.arrowPresence(makeFrame(10, 10, 0, 0, 1), AP_P1, AP_P1), 0, "degenerate zero-length segment scores zero");
}

/* ---------- 矢プレゼンス シャドー判定 (judgeArrowCheck) ---------- */

{
  // 矢が消えた（発射と一致）: 猶予窓のスコアが低い
  const r = core.judgeArrowCheck([0.9, 0.85, 0.95], [0.1, 0.0, 0.05]);
  assertEqual(r.judgment, "shot-match", "arrow gone in confirm window matches shot");
}
{
  // 矢がまだある（レットダウンの疑い）: 猶予窓のスコアが高いまま
  const r = core.judgeArrowCheck([0.9, 0.85, 0.95], [0.8, 0.75, 0.9]);
  assertEqual(r.judgment, "letdown-mismatch", "arrow still present in confirm window flags mismatch");
}
{
  // グレーゾーン: しきい値の間
  const r = core.judgeArrowCheck([0.9, 0.85], [0.45, 0.48]);
  assertEqual(r.judgment, "unclear", "mid-range confirm score is unclear");
}
{
  // 猶予窓のスコアが無い（フレーム取得失敗等）
  const r = core.judgeArrowCheck([0.9], []);
  assertEqual(r.judgment, "unclear", "no confirm-window samples is unclear");
  assertEqual(r.confirmScore, null, "confirmScore null when no samples");
}
{
  // preScores が空でも confirm 側だけで判定できる
  const r = core.judgeArrowCheck([], [0.05, 0.1]);
  assertEqual(r.judgment, "shot-match", "judgment works without pre-release samples");
  assertEqual(r.preScore, null, "preScore null when no samples");
}

console.log("Form core checks OK");
