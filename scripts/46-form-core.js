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
  CONFIRM_MS: 400, // リリース確定猶予: この間にアンカー圏へ戻ったら取消（自己修復）
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
  return { cur: FORM_PHASES.SETUP, anchorSince: 0, lastReleaseTs: 0, lastRise: 0, pendingRelease: null };
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
  if (!raw) { st.cur = FORM_PHASES.IDLE; st.anchorSince = 0; return { phase: st.cur, released: false }; }
  if (st.pendingRelease && now - st.pendingRelease.ts <= FORM_PH.CONFIRM_MS) {
    if (raw.anchorNorm < FORM_PH.CLOSE_IN) {
      // アンカー圏へ即座に戻った = 離脱ではなく一時的な検出ノイズ/引き戻しだった。取消
      st.pendingRelease = null; st.lastReleaseTs = 0; st.anchorSince = now; st.cur = FORM_PHASES.ANCHORING;
      return { phase: st.cur, released: false, canceled: true };
    }
  } else if (st.pendingRelease) {
    st.pendingRelease = null; // 猶予終了、確定（取消なし）
  }
  if (st.lastReleaseTs && now - st.lastReleaseTs < 250) { st.cur = FORM_PHASES.RELEASE; return { phase: st.cur, released: false }; }
  if (st.lastReleaseTs && now - st.lastReleaseTs < 1100) { st.cur = FORM_PHASES.FOLLOW; st.anchorSince = 0; return { phase: st.cur, released: false }; }
  const close = raw.anchorNorm < FORM_PH.CLOSE_IN;
  const win = history.filter((h) => h.m && h.ts >= now - FORM_PH.RISE_WINDOW_MS);
  const closeFrames = win.filter((h) => h.m.anchorNorm < FORM_PH.CLOSE_IN);
  const minAnchor = win.length ? Math.min(...win.map((h) => h.m.anchorNorm)) : raw.anchorNorm;
  const rise = raw.anchorNorm - minAnchor;
  st.lastRise = rise;
  const maxV = win.length ? Math.max(...win.map((h) => h.vel || 0)) : 0;
  if (closeFrames.length >= 2 && !close && now - st.lastReleaseTs > FORM_PH.REFRACTORY_MS
    && maxV > FORM_PH.RELEASE_TH / s) {
    st.lastReleaseTs = now; st.cur = FORM_PHASES.RELEASE; st.anchorSince = 0;
    st.pendingRelease = { ts: now };
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
   4 区分で、断定を避けた日本語文を返す。prevRecord があれば前回比も述べる */
function formRecordInsights(record, prevRecord){
  const st=formRecordStats(record);
  if(!st) return null;
  const prev=prevRecord?formRecordStats(prevRecord):null;
  const facts=[], causes=[], checks=[], next=[];
  if(st.holdMs!=null) facts.push(`フルドロー保持は中央値 ${(st.holdMs/1000).toFixed(1)} 秒でした。`);
  if(st.bowArm!=null) facts.push(`弓手肘は中央値 ${st.bowArm.toFixed(0)}°（エリート基準 ${FORM_REF.bowArmAngle.ideal}°±${FORM_REF.bowArmAngle.sigma}°）です。`);
  if(st.drawArm!=null) facts.push(`引き手肘は中央値 ${st.drawArm.toFixed(0)}°（基準 ${FORM_REF.drawArmAngle.ideal}°）です。`);
  if(st.anchorStd!=null) facts.push(`${st.shots}射のアンカー位置ばらつきは σ=${st.anchorStd.toFixed(3)}（${st.anchorLabel}）です。`);
  if(st.driftRate!=null&&st.driftRate>0) facts.push(`${Math.round(st.driftRate*100)}% の射で、リリース前 0.5 秒に弓手/引き手のドリフトを観測しました。`);
  if(st.confidence!=null) facts.push(`骨格検出の鮮明さは平均 ${(st.confidence*100).toFixed(0)}% です（カメラの角度による測定誤差は反映されません）。`);

  if(st.driftRate!=null&&st.driftRate>=0.5) causes.push("保持中に押し引きの張り合いが緩んでいる可能性があります（断定ではありません）。");
  if(st.bowArm!=null&&st.bowArm<FORM_REF.bowArmAngle.ideal-FORM_REF.bowArmAngle.sigma) causes.push("弓手肘が曲がり気味で、押しが的方向へ届いていない可能性があります。");
  if(st.drawArm!=null&&st.drawArm<FORM_REF.drawArmAngle.ideal-FORM_REF.drawArmAngle.sigma) causes.push("引き手肘の張りが浅く、力線から外れやすい姿勢の可能性があります。");
  if(st.anchorStd!=null&&st.anchorStd>0.045) causes.push("アンカー位置の再現性が不足している可能性があります。");
  if(prev&&st.holdMs!=null&&prev.holdMs!=null){
    const d=(st.holdMs-prev.holdMs)/1000;
    if(d>=0.4) causes.push(`保持時間が前回より ${d.toFixed(1)} 秒長くなっています。`);
    else if(d<=-0.4) causes.push(`保持時間が前回より ${(-d).toFixed(1)} 秒短くなっています。`);
  }
  if(prev&&st.anchorStd!=null&&prev.anchorStd!=null&&st.anchorStd>prev.anchorStd*1.5&&st.anchorStd>0.03) causes.push("アンカーの再現性が前回より不安定になっています。");

  if(st.driftRate!=null&&st.driftRate>0) checks.push("リリース直前に弓手のグリップ位置が下がっていないか、横からの映像で確認してください。");
  if(st.anchorStd!=null&&st.anchorStd>0.045) checks.push("アンカーの接触点（顎の位置）が射ごとにずれていないか確認してください。");
  if(st.bowArm!=null&&Math.abs(st.bowArm-FORM_REF.bowArmAngle.ideal)>FORM_REF.bowArmAngle.sigma) checks.push("セットアップの時点で弓手肘の向きが決まっているかを確認してください。");
  if(st.holdMs!=null&&st.holdMs>4500) checks.push("保持が長め（4.5秒超）です。狙い直しの回数が増えていないか振り返ってください。");

  if(st.driftRate!=null&&st.driftRate>=0.5) next.push("次の練習ではリリース前 0.5 秒の弓手固定を意識ポイントに入れてください。");
  if(st.anchorStd!=null&&st.anchorStd>0.045) next.push("同じ接触点で止まる練習（ミラー・ゴム弓）を数本足してください。");
  if(st.bowArm!=null&&st.bowArm<FORM_REF.bowArmAngle.ideal-FORM_REF.bowArmAngle.sigma) next.push("押し手の伸びを1項目だけ意識して、次の記録で弓手肘の中央値の変化を見てください。");
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
