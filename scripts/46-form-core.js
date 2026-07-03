"use strict";
/* Archery Note: 射形コア（純関数のみ・db/DOM 非依存）
   MediaPipe Pose の 33 ランドマークから射形メトリクスとフェーズを導出する。
   出所: archery-master scripts/37-form-coach.js を胴体長正規化・生値検出へ
   改良して移植（F1 実射検証済み、docs/form-tracking-feasibility.md 参照）。
   単位: 角度=度、時間=ms、距離・速度=胴体長比（構図非依存）。
   カメラ・MediaPipe 本体はここに import しない（呼び出し側の責務）。 */

const FORM_LM = Object.freeze({
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
});

/* エリートリカーブ基準（archery-master ELITE_FORM_REFERENCE 由来）。
   距離系は胴体長比へ換算済み（元値 ÷ 代表胴体長 0.25） */
const FORM_REF = Object.freeze({
  bowArmAngle: { ideal: 172, sigma: 9 },
  drawArmAngle: { ideal: 152, sigma: 14 },
  shoulderDrop: { ideal: 0.072, sigma: 0.056 },
  anchorNorm: { ideal: 0.4, sigma: 0.112 },
  headOffset: { ideal: 0.088, sigma: 0.072 },
  torsoLean: { ideal: 0.21, sigma: 0.045 },
  drawForceLine: { ideal: 0.072, sigma: 0.064 },
});

/* フェーズ検出しきい値（F1 実射調整済み。RISE_WINDOW を伸ばすと
   レットダウンを誤検出するので変更時は check-form-core のケースを必ず通す） */
const FORM_PH = Object.freeze({
  CLOSE_IN: 0.35,
  FULLDRAW_MS: 350,
  RELEASE_RISE: 0.18,
  RELEASE_TH: 1.2,
  RISE_WINDOW_MS: 250,
  REFRACTORY_MS: 1000,
  DRAW_SPEED: 0.25,
});

const FORM_PHASES = Object.freeze({
  IDLE: "IDLE", SETUP: "SETUP", DRAWING: "DRAWING",
  ANCHORING: "ANCHORING", FULL_DRAW: "FULL_DRAW",
  RELEASE: "RELEASE", FOLLOW: "FOLLOW",
});

function formGaussScore(value, ref) {
  const z = (value - ref.ideal) / Math.max(1e-4, ref.sigma);
  return Math.round(Math.max(0, Math.min(100, 100 * Math.exp(-0.5 * z * z))));
}

function formAngleDeg(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y);
  if (m1 < 1e-4 || m2 < 1e-4) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (m1 * m2)))) * 180) / Math.PI;
}

function formDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

/* 点 p と線分 a-b の距離（押し引き力線からの引き肘の乖離に使用） */
function formLineDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return formDist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function formMedian(vals) {
  const a = vals.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/* 33 ランドマーク → 射形メトリクス。handedness: "right"（既定、弓手=左腕）| "left"。
   戻り値の距離系はすべて胴体長比 */
function computeFormMetrics(landmarks, handedness) {
  if (!landmarks || !landmarks.length) return null;
  const l = landmarks;
  const righty = handedness !== "left";
  const bS = l[righty ? FORM_LM.LEFT_SHOULDER : FORM_LM.RIGHT_SHOULDER];
  const bE = l[righty ? FORM_LM.LEFT_ELBOW : FORM_LM.RIGHT_ELBOW];
  const bW = l[righty ? FORM_LM.LEFT_WRIST : FORM_LM.RIGHT_WRIST];
  const dS = l[righty ? FORM_LM.RIGHT_SHOULDER : FORM_LM.LEFT_SHOULDER];
  const dE = l[righty ? FORM_LM.RIGHT_ELBOW : FORM_LM.LEFT_ELBOW];
  const dW = l[righty ? FORM_LM.RIGHT_WRIST : FORM_LM.LEFT_WRIST];
  const nose = l[FORM_LM.NOSE];
  const lH = l[FORM_LM.LEFT_HIP], rH = l[FORM_LM.RIGHT_HIP];
  if (!bS || !bE || !bW || !dS || !dE || !dW || !nose || !lH || !rH) return null;
  const midSh = { x: (bS.x + dS.x) / 2, y: (bS.y + dS.y) / 2 };
  const midHip = { x: (lH.x + rH.x) / 2, y: (lH.y + rH.y) / 2 };
  const bodyScale = Math.max(0.04, formDist(midSh, midHip));
  const bowArm = formAngleDeg(bS, bE, bW);
  const drawArm = formAngleDeg(dS, dE, dW);
  const shoulderDrop = Math.max(0, dS.y - bS.y) / bodyScale;
  const headOffset = Math.abs(nose.y - midSh.y) / bodyScale;
  const anchorNorm = formDist(dW, nose) / bodyScale;
  const torsoLean = Math.abs(midSh.x - midHip.x) / bodyScale * 0.25 + Math.abs(midSh.y - midHip.y) * 0;
  const forceLine = formLineDist(dE, dS, dW) / bodyScale;
  const sc = {
    bow: formGaussScore(bowArm, FORM_REF.bowArmAngle),
    draw: formGaussScore(drawArm, FORM_REF.drawArmAngle),
    shoulder: formGaussScore(shoulderDrop, FORM_REF.shoulderDrop),
    head: formGaussScore(headOffset, FORM_REF.headOffset),
    anchor: formGaussScore(anchorNorm, FORM_REF.anchorNorm),
    lean: formGaussScore(torsoLean + FORM_REF.torsoLean.ideal, FORM_REF.torsoLean),
    force: formGaussScore(forceLine, FORM_REF.drawForceLine),
  };
  const score = Math.round(
    sc.bow * 0.2 + sc.draw * 0.16 + sc.force * 0.18 + sc.shoulder * 0.14
    + sc.head * 0.12 + sc.anchor * 0.12 + sc.lean * 0.08,
  );
  const visIdx = [FORM_LM.LEFT_SHOULDER, FORM_LM.RIGHT_SHOULDER, FORM_LM.LEFT_ELBOW,
    FORM_LM.RIGHT_ELBOW, FORM_LM.LEFT_WRIST, FORM_LM.RIGHT_WRIST, FORM_LM.NOSE];
  const conf = visIdx.reduce((a, i) => a + (l[i].visibility == null ? 0.55 : l[i].visibility), 0) / visIdx.length;
  const occluded = [[bE, "弓側肘"], [bW, "弓側手首"], [dE, "引き手肘"], [dW, "引き手手首"]]
    .filter(([p]) => p.visibility != null && p.visibility <= 0.5)
    .map(([, name]) => name);
  return { bowArm, drawArm, anchorNorm, bodyScale, shoulderDrop, headOffset, forceLine, sc, score, conf, occluded, bW, dW };
}

/* 表示用 EMA 平滑化。検出（stepFormPhase）には生値を使うこと */
function makeFormEma(alpha) {
  const a = alpha == null ? 0.38 : alpha;
  let s = null;
  return (m) => {
    if (!m) { return null; }
    if (!s) { s = { bowArm: m.bowArm, drawArm: m.drawArm, score: m.score, conf: m.conf }; return m; }
    s.bowArm = s.bowArm * (1 - a) + m.bowArm * a;
    s.drawArm = s.drawArm * (1 - a) + m.drawArm * a;
    s.score = s.score * (1 - a) + m.score * a;
    s.conf = s.conf * (1 - a) + m.conf * a;
    return { ...m, bowArm: s.bowArm, drawArm: s.drawArm, score: Math.round(s.score), conf: s.conf };
  };
}

function makeFormPhaseDetector() {
  return { cur: FORM_PHASES.SETUP, anchorSince: 0, lastReleaseTs: 0, lastRise: 0 };
}

/* フェーズ 1 ステップ。history は {ts, m(生メトリクス), vel(胴体長/秒)} の時系列。
   sens>1 で検出されやすくなる（しきい値を除算） */
function stepFormPhase(st, raw, history, sens, now) {
  const s = Math.max(0.2, sens || 1);
  if (!raw) { st.cur = FORM_PHASES.IDLE; st.anchorSince = 0; return { phase: st.cur, released: false }; }
  if (st.lastReleaseTs && now - st.lastReleaseTs < 250) { st.cur = FORM_PHASES.RELEASE; return { phase: st.cur, released: false }; }
  if (st.lastReleaseTs && now - st.lastReleaseTs < 1100) { st.cur = FORM_PHASES.FOLLOW; st.anchorSince = 0; return { phase: st.cur, released: false }; }
  const close = raw.anchorNorm < FORM_PH.CLOSE_IN;
  // 短窓の離脱量が主条件（低FPSで速度スパイクを取り逃すため）。窓を広げるとレットダウン誤検出
  const win = history.filter((h) => h.m && h.ts >= now - FORM_PH.RISE_WINDOW_MS);
  const closeFrames = win.filter((h) => h.m.anchorNorm < FORM_PH.CLOSE_IN);
  const minAnchor = win.length ? Math.min(...win.map((h) => h.m.anchorNorm)) : raw.anchorNorm;
  const rise = raw.anchorNorm - minAnchor;
  st.lastRise = rise;
  const maxV = win.length ? Math.max(...win.map((h) => h.vel || 0)) : 0;
  if (closeFrames.length >= 2 && !close && now - st.lastReleaseTs > FORM_PH.REFRACTORY_MS
    && (rise > FORM_PH.RELEASE_RISE / s || maxV > FORM_PH.RELEASE_TH / s)) {
    st.lastReleaseTs = now; st.cur = FORM_PHASES.RELEASE; st.anchorSince = 0;
    return { phase: st.cur, released: true };
  }
  if (close) {
    if (!st.anchorSince) st.anchorSince = now;
    st.cur = (now - st.anchorSince >= FORM_PH.FULLDRAW_MS && raw.drawArm > 125)
      ? FORM_PHASES.FULL_DRAW : FORM_PHASES.ANCHORING;
  } else {
    st.anchorSince = 0;
    st.cur = (maxV > FORM_PH.DRAW_SPEED && raw.anchorNorm < 1.2) ? FORM_PHASES.DRAWING : FORM_PHASES.SETUP;
  }
  return { phase: st.cur, released: false };
}

/* リリース前 windowSec 秒の安定性（ドリフト、胴体長比）。
   リリース直前 120ms は離れ動作そのものなので除外する */
function formPreReleaseWindow(history, releaseTs, windowSec) {
  const w = windowSec == null ? 0.5 : windowSec;
  const frames = (history || []).filter((h) => h.m && h.ts >= releaseTs - w * 1000 && h.ts <= releaseTs - 120);
  if (frames.length < 2) return null;
  const f = frames[0].m, l = frames[frames.length - 1].m;
  const scale = (f.bodyScale + l.bodyScale) / 2;
  const bowMove = formDist(f.bW, l.bW) / scale;
  const drawMove = formDist(f.dW, l.dW) / scale;
  const headMove = Math.abs(l.anchorNorm - f.anchorNorm);
  return {
    windowSec: w, frames: frames.length, bowMove, drawMove, headMove,
    bowDrift: bowMove > 0.05, drawDrift: drawMove > 0.06, headDrift: headMove > 0.05,
  };
}

/* 複数射のアンカー位置再現性（胴体長比の標準偏差） */
function formAnchorVariation(shots) {
  const vals = (shots || []).map((s) => s && s.anchorNorm).filter(Number.isFinite);
  if (vals.length < 2) return { n: vals.length, std: null, mean: vals[0] == null ? null : vals[0], label: "初回" };
  const mean = vals.reduce((a, x) => a + x, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((a, x) => a + (x - mean) ** 2, 0) / vals.length);
  return { n: vals.length, std, mean, label: std > 0.08 ? "ばらつき大" : std > 0.045 ? "ややばらつき" : "安定" };
}

/* 1 射の要約（formAnalysis.features 1 件分）。
   anchorStartTs=アンカー圏に入った時刻, releaseTs=リリース時刻 */
function summarizeFormShot(history, anchorStartTs, releaseTs) {
  if (!history || !history.length || !releaseTs) return null;
  const win = history.filter((h) => h.m && h.ts >= (anchorStartTs || 0) && h.ts <= releaseTs - 120 && h.m.anchorNorm < 0.45);
  if (win.length < 2) return null;
  const md = (key) => formMedian(win.map((h) => h.m[key]));
  const holdMs = anchorStartTs ? Math.max(0, releaseTs - anchorStartTs) : null;
  return {
    holdMs,
    angles: {
      bowArm: md("bowArm"),
      drawArm: md("drawArm"),
      shoulderDrop: md("shoulderDrop"),
      headOffset: md("headOffset"),
      forceLine: md("forceLine"),
    },
    anchorNorm: md("anchorNorm"),
    score: md("score"),
    confidence: md("conf"),
    pre: formPreReleaseWindow(history, releaseTs),
    frames: win.length,
  };
}
