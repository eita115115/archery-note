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

/* フェーズ検出しきい値。2026-07-05 レットダウン誤検出の修理で再調整
   （tools/check-form-core.js の境界ケースを必ず通すこと。docs/form-tracking-feasibility.md
   の「短窓の離脱量を主条件」という旧設計は、250ms窓では1.1秒未満の引き戻しが
   無条件に誤検出される欠陥があったため撤回した。実測境界は同ファイル冒頭コメント参照）。
   RELEASE_RISE は未使用化のみ（表示・別ロジックからの参照除去は今回のスコープ外）。 */
const FORM_PH = Object.freeze({
  CLOSE_IN: 0.35,
  FULLDRAW_MS: 350,
  RELEASE_RISE: 0.18, // 2026-07-05: リリース判定には使わない（下記 stepFormPhase 参照）。将来別用途で参照する可能性があるため残す
  RELEASE_TH: 9, // 瞬間速度スパイク（胴体長/秒）。単独主条件に昇格（2026-07-05）
  RISE_WINDOW_MS: 250, // 速度スパイクの短窓（maxV 算出用に流用）
  REFRACTORY_MS: 1000,
  DRAW_SPEED: 0.25,
  DRAW_DIR_EPS: 0.05, // DRAWING 方向チェックの許容幅（Stage 0 E'）。トレンドがこの値未満（=顔へ近づく方向）のみ DRAWING。ジッター誤差での取りこぼし防止に正側へ少し許す
  CONFIRM_MS: 400, // リリース確定猶予: この間にアンカー圏へ戻ったら取消（自己修復）
  /* nullBridged（velOk の代替経路）の条件定数（Stage 1 D'）。NB_RISE / NB_MAXV は
     従来ハードコードされていた現行値のまま（0.30 / 4 への切替は第2回実射データ後）。
     NB_MAX_GAP_MS は時間ベースの最大連続nullギャップ上限（新設・発動済み）:
     フレーム数上限は fps 依存で意味が変わるため時間で制限する。これを超える姿勢ロスは
     「リリースの瞬間を橋渡しした」とは言えず、遮蔽＋緩慢な引き戻しでの誤発火源になる
     （arrowcheck-investigation-2026-07-10.md 観点4）。 */
  NB_RISE: 0.25,
  NB_MAXV: 2,
  NB_MAX_GAP_MS: 150,
  /* B'（Stage 1・中立スキャフォールド）: conf / dW可視性ゲート。0 = 完全無効（現行挙動と同一）。
     発動候補（CONF_GATE 0.45 / DW_VIS_GATE 0.5）への切替は第2回実射データの判定表GO後のみ。
     ゲートで無効化したフレームは hasNullGap を増やし nullBridged 経路（D'）と相互作用するため、
     切替時は D' と同一セッションのデータで相互作用込みの検証が必須（単独切替禁止、設計§6-B'） */
  CONF_GATE: 0,
  DW_VIS_GATE: 0,
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

/* 矢プレゼンス検出しきい値。合成フレーム分離性テスト（tools/check-form-core.js）で
   決定。古典 CV のみ（勾配ベースの「細い線」検出＝リッジ連続率）、ML モデル・
   外部依存は使わない。ROI は両手首を結ぶ帯（±BAND_HALF_PX）に限定し、全画面
   Hough は行わない（モバイル負荷をフレーム数ms級に抑えるため）。
   単純な「隣接差分がしきい値超え」だけだとランダムノイズの単発エッジも拾って
   しまう（背景テクスチャで誤検出）。矢の線は直交プロファイル上で「山（または谷）
   が RIDGE_HALF_PX 以内の近距離に両側の反対符号エッジを伴う」形（=細いリッジ）
   になるため、その形状を要求して誤検出を抑える。 */
const ARROW_PRESENCE = Object.freeze({
  BAND_HALF_PX: 6, // ROI帯の半幅（線の中心から左右何pxを走査するか）
  RIDGE_HALF_PX: 2, // リッジ判定の近傍幅（線の実太さの想定上限に合わせる）
  MARGIN_FRAC: 0.12, // 手首付近（グリップ・レスト遮蔽）を除外する区間比率（線の両端）
  SAMPLE_STEP_PX: 3, // 線に沿ったサンプル間隔
  RIDGE_TH: 70, // 直交プロファイルの二階差分（凸凹の鋭さ）がこの値を超えたら「リッジあり」
  PRESENT_TH: 0.55, // スコアがこの値以上で「矢あり」と判定する既定しきい値
});

function formGray(data, w, h, x, y) {
  const xi = Math.max(0, Math.min(w - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(h - 1, Math.round(y)));
  const i = (yi * w + xi) * 4;
  // ITU-R BT.601 輝度近似（整数演算で軽量化）
  return (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
}

/* 弓手手首(p1)〜引き手手首(p2)を結ぶ帯状 ROI に沿って、線分方向と直交する
   輝度リッジ（細い線の断面形状）が連続して存在する割合(0-1)を返す。
   p1/p2 は正規化座標(0-1)、imageData は {data:Uint8ClampedArray(RGBA), width, height}
   （キャンバスのピクセル座標系）。ROI 限定のためフレームあたりの処理は
   数百点程度のサンプルのみ（Hough 全画面走査はしない）。 */
function arrowPresence(imageData, p1, p2, opts) {
  const o = Object.assign({}, ARROW_PRESENCE, opts || {});
  if (!imageData || !imageData.data || !p1 || !p2) return 0;
  const w = imageData.width, h = imageData.height;
  const x1 = p1.x * w, y1 = p1.y * h, x2 = p2.x * w, y2 = p2.y * h;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) return 0;
  const ux = dx / len, uy = dy / len; // 線方向単位ベクトル
  const nx = -uy, ny = ux; // 直交単位ベクトル
  const margin = len * o.MARGIN_FRAC;
  const start = margin, end = len - margin;
  if (end <= start) return 0;
  const steps = Math.max(1, Math.floor((end - start) / o.SAMPLE_STEP_PX));
  const rh = o.RIDGE_HALF_PX;
  const bandN = o.BAND_HALF_PX * 2 + 1;
  // 各サンプル位置の直交プロファイル(平滑化前)と、そこで最も鋭いリッジの位置・強度を求める
  const profiles = [];
  const peakOffset = []; // そのサンプルで最もリッジが強い直交オフセット(prof index)
  const peakRidge = [];
  for (let i = 0; i <= steps; i++) {
    const t = start + (i / steps) * (end - start);
    const cx = x1 + ux * t, cy = y1 + uy * t;
    const prof = new Array(bandN);
    for (let b = -o.BAND_HALF_PX; b <= o.BAND_HALF_PX; b++) {
      prof[b + o.BAND_HALF_PX] = formGray(imageData.data, w, h, cx + nx * b, cy + ny * b);
    }
    profiles.push(prof);
    let bestK = -1, bestRidge = 0;
    for (let k = rh; k < bandN - rh; k++) {
      const ridge = Math.abs(2 * prof[k] - prof[k - rh] - prof[k + rh]);
      if (ridge > bestRidge) { bestRidge = ridge; bestK = k; }
    }
    peakOffset.push(bestK);
    peakRidge.push(bestRidge);
  }
  // 「線」は隣接サンプル間でリッジの直交位置がほぼ同じまま連続する。
  // ランダムノイズのリッジは位置・強度が毎サンプル独立にばらつくため、
  // 前後 RUN 個のサンプルすべてでリッジが閾値を超え、かつ直交位置が
  // ±POS_TOL に収まって連続しているときだけ「矢の線」としてカウントする
  // （単発〜2連続の強いリッジは背景テクスチャの偶然として除外する）。
  const POS_TOL = rh;
  const RUN = 3;
  let hit = 0, total = 0;
  for (let i = 0; i < profiles.length; i++) {
    total++;
    if (peakRidge[i] <= o.RIDGE_TH || peakOffset[i] < 0) continue;
    let runLen = 1;
    for (let d = 1; d < RUN; d++) {
      const j = i - d;
      if (j < 0 || peakRidge[j] <= o.RIDGE_TH || Math.abs(peakOffset[j] - peakOffset[i]) > POS_TOL) break;
      runLen++;
    }
    for (let d = 1; d < RUN; d++) {
      const j = i + d;
      if (j >= profiles.length || peakRidge[j] <= o.RIDGE_TH || Math.abs(peakOffset[j] - peakOffset[i]) > POS_TOL) break;
      runLen++;
    }
    if (runLen >= Math.min(RUN, profiles.length)) hit++;
  }
  return total ? hit / total : 0;
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

/* 現在フレーム raw と history 内の最後の有効フレームから引き手手首の
   瞬間速度（胴体長/秒）を求める。47-form-view.js の撮影/リプレイ両 loop の
   重複実装を置換する（Stage 0 A1: 挙動完全一致のリファクタ、フィルタ等は入れない）。
   dt<=0 または dt>=0.5秒（基準フレームが古すぎる）は 0 を返す。 */
function computeFormVelocity(history, raw, now) {
  if (!raw) return 0;
  let lv = null;
  for (let i = history.length - 1; i >= 0 && !lv; i--) if (history[i].m) lv = history[i];
  if (!lv) return 0;
  const dt = (now - lv.ts) / 1000;
  if (dt <= 0 || dt >= 0.5) return 0;
  return formDist(raw.dW, lv.m.dW) / dt / raw.bodyScale;
}

/* A2（Stage 1・中立スキャフォールド）: 1-Euro フィルタ付き速度ソースの設定。
   ENABLED: false の間は完全 pass-through（computeFormVelocity と同値）で、
   発動は ENABLED の1行変更のみ。発動時は dW の正規化座標 (x,y) に各軸独立で
   1-Euro を適用し、フィルタ後の位置から速度を導出する（速度に直接掛けない。
   位置フィルタが 1-Euro の設計前提、設計§6-A2）。
   発動の前提: tools/check-form-core.js のレットダウン境界表をフィルタ経由で
   再導出し、新しい vel 上限に対して RELEASE_TH のマージンが 1.0 以上残ること
   （TH=8 の先決めは却下済み、設計§10-1）。 */
const FORM_VEL_FILTER = Object.freeze({
  ENABLED: false,
  MIN_CUTOFF: 1.5, // Hz。静止時の平滑化強度（小さいほど強く平滑化）
  BETA: 0.007, // 速度適応係数。速い動きでカットオフを引き上げラグを抑える
  D_CUTOFF: 1.0, // Hz。微分（速度推定）のローパスカットオフ
  RESET_GAP_MS: 500, // 有効フレーム間隔がこれを超えたらフィルタ内部状態をリセット
});

/* 1-Euro フィルタ付き速度ソースのファクトリ。撮影/リプレイの各セッションで
   1 つ生成し、フレームごとに step(history, raw, now) を呼ぶ。ENABLED: false の間は
   状態を持たず computeFormVelocity へ委譲する（挙動完全一致）。
   reset() はセッション条件の変更（利き手切替等、history を破棄する箇所）で呼ぶ。 */
function makeFormVelocitySource(opts) {
  const o = Object.assign({}, FORM_VEL_FILTER, opts || {});
  const alpha = (cutoff, dt) => { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); };
  // 各軸の 1-Euro 状態: {x: 前回のフィルタ後値, dx: 前回のフィルタ後微分}
  let ax = null, ay = null, lastTs = 0, lastOut = null;
  const stepAxis = (st2, v, dt) => {
    const dxRaw = (v - st2.x) / dt;
    const aD = alpha(o.D_CUTOFF, dt);
    const dx = st2.dx + aD * (dxRaw - st2.dx);
    const cutoff = o.MIN_CUTOFF + o.BETA * Math.abs(dx);
    const a = alpha(cutoff, dt);
    return { x: st2.x + a * (v - st2.x), dx };
  };
  return {
    step(history, raw, now) {
      if (!o.ENABLED) return computeFormVelocity(history, raw, now);
      if (!raw) return 0; // null フレーム: 状態は保持（ギャップ超過は次の有効フレームで判定）
      if (ax && now - lastTs > o.RESET_GAP_MS) { ax = null; ay = null; lastOut = null; }
      const dt = ax ? (now - lastTs) / 1000 : 0;
      if (!ax || dt <= 0) {
        ax = { x: raw.dW.x, dx: 0 }; ay = { x: raw.dW.y, dx: 0 };
        lastOut = { x: raw.dW.x, y: raw.dW.y }; lastTs = now;
        return 0;
      }
      ax = stepAxis(ax, raw.dW.x, dt);
      ay = stepAxis(ay, raw.dW.y, dt);
      const out = { x: ax.x, y: ay.x };
      const vel = formDist(out, lastOut) / dt / raw.bodyScale;
      lastOut = out; lastTs = now;
      return vel;
    },
    reset() { ax = null; ay = null; lastTs = 0; lastOut = null; },
  };
}

/* B'（Stage 1・中立スキャフォールド）: stepFormPhase 内でのみ使う可視性ゲート。
   history 自体は汚さない（summarizeFormShot 等の中央値系は現行のまま）。
   ゲート値 0 は完全無効＝pass-through（conf/visibility 未設定のフレームも通す）。
   ゲート有効時: conf 未設定または CONF_GATE 未満のフレームは null 扱い、
   dW.visibility が DW_VIS_GATE 以下のフレームは速度評価（maxV）から除外する
   （速度は dW のみから計算されるため、平均 conf では代用できない。設計§6-B'）。 */
function formConfOk(m) {
  return FORM_PH.CONF_GATE <= 0 || (m.conf != null && m.conf >= FORM_PH.CONF_GATE);
}
function formDwVisOk(m) {
  return FORM_PH.DW_VIS_GATE <= 0 || m.dW == null || m.dW.visibility == null
    || m.dW.visibility > FORM_PH.DW_VIS_GATE;
}

/* anchorStartTs は anchorSince と意味が異なる別フィールド（Stage 0 C）。
   anchorSince はアンカー圏を離れた全フレームでリセットされる（FULL_DRAW 昇格判定用）が、
   anchorStartTs は sticky: ANCHORING/FULL_DRAW で記録を開始し、DRAWING への一時離脱では
   保持し続け、SETUP/IDLE へ落ちたときのみリセットする。holdMs = releaseTs - anchorStartTs
   （summarizeFormShot）はこの sticky 仕様の上に成立している。 */
function makeFormPhaseDetector() {
  return { cur: FORM_PHASES.SETUP, anchorSince: 0, anchorStartTs: 0, lastReleaseTs: 0, lastRise: 0, pendingRelease: null };
}

/* フェーズ 1 ステップ。history は {ts, m(生メトリクス), vel(胴体長/秒)} の時系列。
   sens>1 で検出されやすくなる（しきい値を除算）。
   2026-07-05: リリース判定を「250ms窓の累積離脱量(rise)」主体から
   「短窓内の瞬間速度スパイク(maxV)」単独主体へ変更した。旧ロジックは
   rise>0.18 が単独でも発火したため、1.1秒未満のどんな速さの引き戻し
   （レットダウン）も無条件にリリースとして誤検出していた
   （tools/check-form-core.js のレットダウン境界ケース参照）。
   maxV 単独条件は 100ms〜2秒の線形レットダウンで発火せず、
   50-100msで完了する現実的なリリース速度プロファイルは確実に検出する
   （実測境界表は同ファイル）。
   加えて「確定猶予」(CONFIRM_MS) を設けた: released 判定後もアンカー圏へ
   即座に戻った場合は取消フラグ(canceled)を返す。呼び出し側は canceled=true の
   場合、直前に追加したショットを取り消すこと（誤検出の自己修復）。 */
function stepFormPhase(st, raw, history, sens, now) {
  const s = Math.max(0.2, sens || 1);
  // 検証計装（H-2, release-detection-triage-2026-07-13）: 早期return経路の共通項。判定には未使用
  const refractoryRemainingMs = () => Math.max(0, FORM_PH.REFRACTORY_MS - (now - st.lastReleaseTs));
  // B'（Stage 1）: conf ゲート。CONF_GATE=0 の間は usable === raw（完全 pass-through）。
  // ゲート有効時は低confの現在フレームを null フレームと同じ扱いにする
  const usable = raw && formConfOk(raw) ? raw : null;
  if (!usable) {
    if (st.cur === FORM_PHASES.IDLE || st.cur === FORM_PHASES.SETUP) { st.cur = FORM_PHASES.IDLE; st.anchorSince = 0; st.anchorStartTs = 0; }
    const debug = { maxV: null, rise: null, nullFrames: null, conf: raw ? raw.conf : null, anchorNorm: null, closeFrames: null, hasNullGap: null, refractoryRemaining: refractoryRemainingMs() };
    return { phase: st.cur, released: false, anchorStartTs: st.anchorStartTs, debug };
  }
  if (st.pendingRelease && now - st.pendingRelease.ts <= FORM_PH.CONFIRM_MS) {
    if (usable.anchorNorm < FORM_PH.CLOSE_IN) {
      // アンカー圏へ即座に戻った = 離脱ではなく一時的な検出ノイズ/引き戻しだった。取消
      // 計装: st.lastReleaseTs をリセットする前に refractoryRemainingMs() を評価する（取消直前の値を残す）
      const debug = { maxV: null, rise: null, nullFrames: null, conf: usable.conf, anchorNorm: usable.anchorNorm, closeFrames: null, hasNullGap: null, refractoryRemaining: refractoryRemainingMs() };
      st.pendingRelease = null; st.lastReleaseTs = 0; st.anchorSince = now; st.cur = FORM_PHASES.ANCHORING;
      st.anchorStartTs = now; // 取消＝アンカー継続。旧ビュー実装も同フレームで now を入れていた
      return { phase: st.cur, released: false, canceled: true, anchorStartTs: st.anchorStartTs, debug };
    }
  } else if (st.pendingRelease) {
    st.pendingRelease = null; // 猶予終了、確定（取消なし）
  }
  if (st.lastReleaseTs && now - st.lastReleaseTs < 250) {
    st.cur = FORM_PHASES.RELEASE;
    const debug = { maxV: null, rise: null, nullFrames: null, conf: usable.conf, anchorNorm: usable.anchorNorm, closeFrames: null, hasNullGap: null, refractoryRemaining: refractoryRemainingMs() };
    return { phase: st.cur, released: false, anchorStartTs: st.anchorStartTs, debug };
  }
  if (st.lastReleaseTs && now - st.lastReleaseTs < 1100) {
    st.cur = FORM_PHASES.FOLLOW; st.anchorSince = 0;
    const debug = { maxV: null, rise: null, nullFrames: null, conf: usable.conf, anchorNorm: usable.anchorNorm, closeFrames: null, hasNullGap: null, refractoryRemaining: refractoryRemainingMs() };
    return { phase: st.cur, released: false, anchorStartTs: st.anchorStartTs, debug };
  }
  const close = usable.anchorNorm < FORM_PH.CLOSE_IN;
  const winAll = history.filter(h => h.ts >= now - FORM_PH.RISE_WINDOW_MS);
  const win = winAll.filter(h => h.m && formConfOk(h.m));
  const closeFrames = win.filter((h) => h.m.anchorNorm < FORM_PH.CLOSE_IN);
  const minAnchor = win.length ? Math.min(...win.map((h) => h.m.anchorNorm)) : usable.anchorNorm;
  const rise = usable.anchorNorm - minAnchor;
  st.lastRise = rise;
  // B'（Stage 1）: 速度信頼性は dW 個別可視性でゲート（DW_VIS_GATE=0 の間は velWin === win）
  const velWin = win.filter((h) => formDwVisOk(h.m));
  const maxV = velWin.length ? Math.max(...velWin.map((h) => h.vel || 0)) : 0;
  const hasNullGap = winAll.length > win.length;
  const velOk = maxV > FORM_PH.RELEASE_TH / s;
  /* 窓内の最大連続ギャップ（win に入らなかった最初のフレーム→最後のフレームの経過時間）。
     hasNullGap と同じ「win 基準」（実null ∪ conf ゲート除外）で数える。2026-07-11
     strict-review 修正: 旧実装は `!h.m` のみで数えていたため、CONF_GATE 発動時に
     conf 除外フレーム（実nullではない「仮想null」）が hasNullGap は増やすのに
     maxGapMs には数えられず、D' の時間上限を素通りしていた（B' との単独切替禁止の
     根拠どおり、両ゲート発動後にのみ影響。CONF_GATE=0 の出荷状態では formConfOk が
     常に true を返すため本行の意味は `!h.m` と完全に同値＝挙動不変）。
     NB_MAX_GAP_MS 超の姿勢ロスは nullBridged の根拠にしない（Stage 1 D'） */
  let maxGapMs = 0, gapStart = null;
  for (const h of winAll) {
    if (h.m && formConfOk(h.m)) { gapStart = null; }
    else { if (gapStart == null) gapStart = h.ts; maxGapMs = Math.max(maxGapMs, h.ts - gapStart); }
  }
  const nullBridged = hasNullGap && rise > FORM_PH.NB_RISE && maxV > FORM_PH.NB_MAXV
    && maxGapMs <= FORM_PH.NB_MAX_GAP_MS;
  const debug = {
    maxV, rise, nullFrames: winAll.length - win.length, conf: usable.conf,
    anchorNorm: usable.anchorNorm, closeFrames: closeFrames.length, hasNullGap,
    refractoryRemaining: refractoryRemainingMs(),
  }; // 検証計装（H）: 判定ロジックには使わない、保存用の内部量そのまま
  if (closeFrames.length >= 2 && !close && now - st.lastReleaseTs > FORM_PH.REFRACTORY_MS
    && (velOk || nullBridged)) {
    st.lastReleaseTs = now; st.cur = FORM_PHASES.RELEASE; st.anchorSince = 0;
    st.pendingRelease = { ts: now };
    const anchorStartTs = st.anchorStartTs; // クリア前の値を返す（呼び出し側が summarizeFormShot へ渡す）
    st.anchorStartTs = 0;
    return { phase: st.cur, released: true, anchorStartTs, debug };
  }
  if (close) {
    if (!st.anchorSince) st.anchorSince = now;
    st.cur = (now - st.anchorSince >= FORM_PH.FULLDRAW_MS && usable.drawArm > 125)
      ? FORM_PHASES.FULL_DRAW : FORM_PHASES.ANCHORING;
  } else {
    st.anchorSince = 0;
    // 方向チェック（Stage 0 E'）: anchorNorm の減少方向（手首が顔へ近づく）のみ DRAWING。
    // 増加方向（レットダウン等）を DRAWING と誤分類すると sticky な anchorStartTs が
    // 保持されて hold にレットダウン前の時間が混入するため、SETUP へ落とす
    const anchorTrend = win.length ? usable.anchorNorm - win[0].m.anchorNorm : 0; // 負=顔へ近づく
    st.cur = (maxV > FORM_PH.DRAW_SPEED && usable.anchorNorm < 1.2 && anchorTrend < FORM_PH.DRAW_DIR_EPS)
      ? FORM_PHASES.DRAWING : FORM_PHASES.SETUP;
  }
  // sticky 更新: ANCHORING/FULL_DRAW で記録開始、DRAWING 一時離脱は保持、SETUP/IDLE でリセット
  if ((st.cur === FORM_PHASES.ANCHORING || st.cur === FORM_PHASES.FULL_DRAW) && !st.anchorStartTs) st.anchorStartTs = now;
  else if (st.cur === FORM_PHASES.SETUP || st.cur === FORM_PHASES.IDLE) st.anchorStartTs = 0;
  return { phase: st.cur, released: false, anchorStartTs: st.anchorStartTs, debug };
}

/* リリース前 windowSec 秒の安定性（ドリフト、胴体長比）。
   リリース直前 120ms は離れ動作そのものなので除外する。
   anchorStartTs が渡された場合、遡り窓の開始点を max(releaseTs-windowSec, anchorStartTs) に
   クランプする（Stage 1 T-Anchor, §12.3）。ホールドが windowSec より短い射では、
   クランプ無しだと窓の前半が DRAWING 区間（まだ手首が高速移動中）まで食い込み、
   bowMove/drawMove が異常値化して stable が恒常的に false になる問題への対処
   （arrowcheck-investigation-2026-07-10.md 観点3）。anchorStartTs が falsy
   （0/null/未指定）ならクランプなし＝現行動作と同一。 */
function formPreReleaseWindow(history, releaseTs, windowSec, anchorStartTs) {
  const w = windowSec == null ? 0.5 : windowSec;
  const earliest = anchorStartTs ? Math.max(releaseTs - w * 1000, anchorStartTs) : releaseTs - w * 1000;
  const frames = (history || []).filter((h) => h.m && h.ts >= earliest && h.ts <= releaseTs - 120);
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

/* 矢プレゼンスのシャドー判定しきい値。stepFormPhase の速度スパイク方式とは
   完全に独立し、取消動作には使わない（表示・保存の注釈専用）。 */
const ARROW_CHECK = Object.freeze({
  GONE_TH: 0.35, // 猶予窓の代表値がこの値未満なら「矢が消えた」とみなす
  STILL_TH: 0.55, // 猶予窓の代表値がこの値以上なら「矢がまだある」とみなす
  // 両者の間はグレーゾーン（"unclear"）。閾値は arrowPresence の PRESENT_TH と揃えつつ、
  // シャドー判定側は誤って「不一致」と煽らないよう GONE 側を保守的に低くしている。
});

/* 速度スパイクで released が発火した直後の確定猶予窓（CONFIRM_MS）における
   矢プレゼンス系列から、シャドー判定を作る。preScores=発火直前（フルドロー中）の
   スコア列、confirmScores=猶予窓中のスコア列（いずれも arrowPresence の返り値の配列）。
   戻り値の judgment は "shot-match"（矢が消えた=リリースと整合）/
   "letdown-mismatch"（矢がまだある=レットダウンの疑い、要確認）/
   "unclear"（判定材料不足 or グレーゾーン）のいずれか。
   この関数の戻り値は表示・保存注釈にのみ使い、released/canceled の判定を変えない。 */
function judgeArrowCheck(preScores, confirmScores) {
  const pre = (preScores || []).filter(Number.isFinite);
  const confirm = (confirmScores || []).filter(Number.isFinite);
  const preScore = pre.length ? formMedian(pre) : null;
  const confirmScore = confirm.length ? formMedian(confirm) : null;
  if (confirmScore == null) {
    return { judgment: "unclear", preScore, confirmScore, pre: pre.length, confirm: confirm.length };
  }
  let judgment;
  if (confirmScore < ARROW_CHECK.GONE_TH) judgment = "shot-match";
  else if (confirmScore >= ARROW_CHECK.STILL_TH) judgment = "letdown-mismatch";
  else judgment = "unclear";
  return { judgment, preScore, confirmScore, pre: pre.length, confirm: confirm.length };
}

/* 検証計装（H）: 撮影セッション終了時に shots(arrowCheck付与済み) と samplePerfMs
   計測列から、保存レコードへ添える診断サマリを作る。db.settings.formDebug===true
   のときのみ呼び出し側が保存する（既定OFF）。判定ロジックには一切使わない。 */
function formDiagSummary(shots, samplePerfMs) {
  const counts = { shotMatch: 0, letdownMismatch: 0, unclear: 0, none: 0 };
  (shots || []).forEach((sh) => {
    const j = sh && sh.arrowCheck && sh.arrowCheck.judgment;
    if (j === "shot-match") counts.shotMatch++;
    else if (j === "letdown-mismatch") counts.letdownMismatch++;
    else if (j === "unclear") counts.unclear++;
    else counts.none++;
  });
  const perf = (samplePerfMs || []).filter(Number.isFinite);
  return {
    arrowCheckCounts: counts,
    samplePerfMs: perf.length ? { median: +formMedian(perf).toFixed(2), max: +Math.max(...perf).toFixed(2), n: perf.length } : null,
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
    pre: formPreReleaseWindow(history, releaseTs, null, anchorStartTs),
    frames: win.length,
  };
}

/* ---------- 分析結果の活用: 記録統計・コーチングコメント・トレンド・得点との関係 ---------- */

/* 1 記録の要約統計。features 配列から中央値・ドリフト率・アンカー再現性を出す */
function formRecordStats(record){
  const feats=(record&&Array.isArray(record.features))?record.features:[];
  if(!feats.length) return null;
  const md=(key)=>formMedian(feats.map((f)=>f.angles&&f.angles[key]).filter(Number.isFinite));
  const holds=feats.map((f)=>f.phase&&f.phase.anchorMs).filter(Number.isFinite);
  const av=formAnchorVariation(feats.map((f)=>({anchorNorm:f.anchorNorm})));
  const withRelease=feats.filter((f)=>f.release);
  const drifted=withRelease.filter((f)=>f.release.stable===false).length;
  const confs=feats.map((f)=>f.confidence).filter(Number.isFinite);
  const scores=feats.map((f)=>f.score).filter(Number.isFinite);
  return {
    shots:feats.length,
    bowArm:md("bowArm"),
    drawArm:md("drawArm"),
    holdMs:holds.length?formMedian(holds):null,
    anchorStd:av.std,
    anchorLabel:av.label,
    driftRate:withRelease.length?drifted/withRelease.length:null,
    confidence:confs.length?confs.reduce((a,x)=>a+x,0)/confs.length:null,
    score:scores.length?formMedian(scores):null,
  };
}

/* 構造化コーチングコメント（archery-master buildStructuredFormComment を
   本アプリの formAnalysis 形状へ再構成）。観測→原因候補→確認点→次の練習の
   4 区分で、断定を避けた日本語文を返す。prevRecord があれば前回比も述べる。
   2026-07-05: エリート基準（FORM_REF.ideal/sigma）との比較表示を停止した。
   カメラ yaw 角 ±30° で引き手肘が基準 sigma の 1.1 倍相当ずれることが判明し、
   採点の物差しが撮影角度に飲まれるため（妥当性監査で確認）。FORM_REF・
   formGaussScore は削除せず未使用化のみ（出典が追跡できないため表示停止、
   将来根拠が得られたら復活可能）。代わりに「自分の直近中央値との差」で
   自分基準の変化を伝える。撮影角度が毎回同じであることが前提になるため、
   その旨の注記は呼び出し側（47-form-view.js）で行う。 */
function formRecordInsights(record, prevRecord){
  const st=formRecordStats(record);
  if(!st) return null;
  const prev=prevRecord?formRecordStats(prevRecord):null;
  const facts=[], causes=[], checks=[], next=[];
  if(st.holdMs!=null) facts.push(`フルドロー保持は中央値 ${(st.holdMs/1000).toFixed(1)} 秒でした。`);
  if(st.bowArm!=null) facts.push(`弓手肘は中央値 ${st.bowArm.toFixed(0)}°${prev&&prev.bowArm!=null?`（前回比 ${st.bowArm-prev.bowArm>=0?"+":""}${(st.bowArm-prev.bowArm).toFixed(0)}°）`:""}です。`);
  if(st.drawArm!=null) facts.push(`引き手肘は中央値 ${st.drawArm.toFixed(0)}°${prev&&prev.drawArm!=null?`（前回比 ${st.drawArm-prev.drawArm>=0?"+":""}${(st.drawArm-prev.drawArm).toFixed(0)}°）`:""}です。`);
  if(st.anchorStd!=null) facts.push(`${st.shots}射のアンカー位置ばらつきは σ=${st.anchorStd.toFixed(3)}（${st.anchorLabel}）です。`);
  if(st.driftRate!=null&&st.driftRate>0) facts.push(`${Math.round(st.driftRate*100)}% の射で、リリース前 0.5 秒に弓手/引き手のドリフトを観測しました。`);
  if(st.confidence!=null) facts.push(`骨格検出の鮮明さは平均 ${(st.confidence*100).toFixed(0)}% です（カメラの角度による測定誤差は反映されません）。`);

  if(st.driftRate!=null&&st.driftRate>=0.5) causes.push("保持中に押し引きの張り合いが緩んでいる可能性があります（断定ではありません）。");
  if(st.anchorStd!=null&&st.anchorStd>0.045) causes.push("アンカー位置の再現性が不足している可能性があります。");
  if(prev&&st.holdMs!=null&&prev.holdMs!=null){
    const d=(st.holdMs-prev.holdMs)/1000;
    if(d>=0.4) causes.push(`保持時間が前回より ${d.toFixed(1)} 秒長くなっています。`);
    else if(d<=-0.4) causes.push(`保持時間が前回より ${(-d).toFixed(1)} 秒短くなっています。`);
  }
  if(prev&&st.bowArm!=null&&prev.bowArm!=null&&Math.abs(st.bowArm-prev.bowArm)>=6) causes.push(`弓手肘が前回より ${Math.abs(st.bowArm-prev.bowArm).toFixed(0)}° 変化しています（撮影角度が前回と同じか確認してください）。`);
  if(prev&&st.drawArm!=null&&prev.drawArm!=null&&Math.abs(st.drawArm-prev.drawArm)>=6) causes.push(`引き手肘が前回より ${Math.abs(st.drawArm-prev.drawArm).toFixed(0)}° 変化しています（撮影角度が前回と同じか確認してください）。`);
  if(prev&&st.anchorStd!=null&&prev.anchorStd!=null&&st.anchorStd>prev.anchorStd*1.5&&st.anchorStd>0.03) causes.push("アンカーの再現性が前回より不安定になっています。");

  if(st.driftRate!=null&&st.driftRate>0) checks.push("リリース直前に弓手のグリップ位置が下がっていないか、横からの映像で確認してください。");
  if(st.anchorStd!=null&&st.anchorStd>0.045) checks.push("アンカーの接触点（顎の位置）が射ごとにずれていないか確認してください。");
  if(st.holdMs!=null&&st.holdMs>4500) checks.push("保持が長め（4.5秒超）です。狙い直しの回数が増えていないか振り返ってください。");

  if(st.driftRate!=null&&st.driftRate>=0.5) next.push("次の練習ではリリース前 0.5 秒の弓手固定を意識ポイントに入れてください。");
  if(st.anchorStd!=null&&st.anchorStd>0.045) next.push("同じ接触点で止まる練習（ミラー・ゴム弓）を数本足してください。");
  if(!next.length) next.push("同じ撮影角度で記録を重ね、前回比の変化量で確認を続けてください。");
  return {facts,causes,checks,next,stats:st,prev};
}

/* 記録の時系列（トレンド表示用）。日付昇順 */
function formTrendSeries(records){
  return (records||[]).map((r)=>{
    const st=formRecordStats(r);
    if(!st) return null;
    return {id:r.id,date:r.date||"",ts:r.ts||0,bowArm:st.bowArm,drawArm:st.drawArm,
      holdS:st.holdMs!=null?st.holdMs/1000:null,anchorStd:st.anchorStd,driftRate:st.driftRate,score:st.score};
  }).filter(Boolean).sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.ts-b.ts));
}

/* 射形×得点: sessionId で紐付いた記録から、リリース安定（ドリフト率<50%）の
   回とドリフトが多い回の平均点を比較する。metricsFn には sessionMetrics を渡す */
function formScoreLink(records, sessions, metricsFn){
  const byId={};
  (sessions||[]).forEach((s)=>{ if(s&&s.id) byId[s.id]=s; });
  const pairs=(records||[]).map((r)=>{
    const s=r&&r.sessionId?byId[r.sessionId]:null;
    if(!s) return null;
    const st=formRecordStats(r);
    if(!st) return null;
    const m=metricsFn(s);
    if(!m.all.length) return null;
    return {recordId:r.id,date:r.date||"",avg:m.avg,driftRate:st.driftRate,formScore:st.score,anchorStd:st.anchorStd};
  }).filter(Boolean);
  const stable=pairs.filter((p)=>p.driftRate!=null&&p.driftRate<0.5);
  const drifty=pairs.filter((p)=>p.driftRate!=null&&p.driftRate>=0.5);
  const avgOf=(a)=>a.length?a.reduce((x,p)=>x+p.avg,0)/a.length:null;
  const split=(stable.length&&drifty.length)
    ?{stableAvg:avgOf(stable),driftAvg:avgOf(drifty),stableN:stable.length,driftN:drifty.length}
    :null;
  return {n:pairs.length,pairs,split};
}
