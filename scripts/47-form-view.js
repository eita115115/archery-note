"use strict";
/* Archery Note: 射形トラッキング ビュー（ベータ）
   カメラ + オンデバイス姿勢推定。計算は 46-form-core.js の純関数、
   資産は assets/pose/（自己ホスト・機能有効時のみ遅延ロード）。
   映像・生ランドマークは保存しない。保存は formAnalyses の派生特徴量のみ。 */

function formTrackingEnabled(){ return !!(db.settings&&db.settings.formTrackingEnabled); }

let formPosePromise=null;
function loadFormPose(){
  if(!formPosePromise){
    /* 動的 import はこのスクリプトのURL基準で解決されるため、ページURL基準で絶対化する
       （GitHub Pages のサブパス配信でも正しく assets/pose/ を指す） */
    const base=new URL("assets/pose/",location.href);
    formPosePromise=import(new URL("vision_bundle.mjs",base).href).then(async mod=>{
      const fileset=await mod.FilesetResolver.forVisionTasks(base.href.replace(/\/$/,""));
      const landmarker=await mod.PoseLandmarker.createFromOptions(fileset,{
        baseOptions:{modelAssetPath:new URL("pose_landmarker_lite.task",base).href,delegate:"GPU"},
        runningMode:"VIDEO",numPoses:1
      });
      return landmarker;
    }).catch(e=>{ formPosePromise=null; throw e; });
  }
  return formPosePromise;
}

function formFeatureFromShot(shot){
  return {
    phase:{anchorMs:shot.holdMs},
    angles:shot.angles,
    anchorNorm:shot.anchorNorm,
    release:shot.pre?{bowMove:+shot.pre.bowMove.toFixed(3),drawMove:+shot.pre.drawMove.toFixed(3),stable:!shot.pre.bowDrift&&!shot.pre.drawDrift}:null,
    confidence:shot.confidence==null?null:+shot.confidence.toFixed(2),
    score:shot.score==null?null:Math.round(shot.score),
    /* シャドー: 矢プレゼンス検出による発射/レットダウン一致判定（取消動作には未使用、注釈のみ）。
       前方互換: formAnalyses.features[].arrowCheck は既存レコードに存在しない追加フィールド */
    arrowCheck:shot.arrowCheck?{
      judgment:shot.arrowCheck.judgment,
      preScore:shot.arrowCheck.preScore==null?null:+shot.arrowCheck.preScore.toFixed(2),
      confirmScore:shot.arrowCheck.confirmScore==null?null:+shot.arrowCheck.confirmScore.toFixed(2)
    }:null
  };
}

/* シャドー判定のショット一覧タグ（撮影画面）。judgment を利用者向けの短い日本語に変換する。
   あくまで参考表示（ベータ）で、既存のリリース検出結果を変えるものではない旨は撮影画面のhintで案内。 */
function formArrowCheckLabel(judgment){
  if(judgment==="shot-match") return "矢: 発射と一致";
  if(judgment==="letdown-mismatch") return "矢: 引き戻しの疑い（要確認）";
  return null; // unclear は表示しない（判定材料不足を煽らない）
}
function formArrowCheckTagHtml(arrowCheck){
  if(!arrowCheck) return "";
  const label=formArrowCheckLabel(arrowCheck.judgment);
  if(!label) return "";
  const mismatch=arrowCheck.judgment==="letdown-mismatch";
  return ` / ${mismatch?icon("warn")+" ":""}${esc(label)}`;
}

function formRecordSummary(r){
  const feats=Array.isArray(r.features)?r.features:[];
  const med=key=>{
    const vals=feats.map(f=>f.angles&&f.angles[key]).filter(Number.isFinite);
    return vals.length?formMedian(vals):null;
  };
  const holds=feats.map(f=>f.phase&&f.phase.anchorMs).filter(Number.isFinite);
  const av=formAnchorVariation(feats.map(f=>({anchorNorm:f.anchorNorm})));
  return {
    bowArm:med("bowArm"), drawArm:med("drawArm"),
    holdS:holds.length?formMedian(holds)/1000:null,
    anchorLabel:av.label, shots:feats.length
  };
}

/* 自分基準の表示ラベルを作る。2026-07-05: エリート基準（172°等）との比較は
   撮影角度に飲まれるため停止し、直近の自分の記録との差で表す。
   直近3件未満（中央値の元になる記録がまだ少ない）場合は生値のみ返す。 */
function formSelfBaselineLabel(value, key, priorRecords){
  if(!Number.isFinite(value)) return "—";
  const priorVals=(priorRecords||[]).map(r=>formRecordStats(r)).filter(Boolean)
    .map(st=>st[key]).filter(Number.isFinite);
  if(priorVals.length<3) return `${value.toFixed(0)}°`;
  const base=formMedian(priorVals);
  const d=value-base;
  if(Math.abs(d)<1) return `${value.toFixed(0)}°（いつも通り）`;
  return `${value.toFixed(0)}°（いつもより ${d>=0?"+":""}${d.toFixed(0)}°）`;
}

function formTrendMiniHtml(){
  const series=formTrendSeries(db.formAnalyses||[]).filter(p=>Number.isFinite(p.bowArm));
  if(series.length<3) return "";
  const W=300,H=54;
  const vals=series.map(p=>p.bowArm);
  const min=Math.min(...vals), max=Math.max(...vals);
  const span=(max-min)||1;
  const px=i=>(i/(series.length-1))*W;
  const py=v=>H-6-((v-min)/span)*(H-12);
  const path=series.map((p,i)=>`${i?"L":"M"}${px(i).toFixed(1)},${py(p.bowArm).toFixed(1)}`).join("");
  return `<div class="note"><b>弓手肘の推移</b>（自分の記録の変化。基準値との比較ではありません）</div>
  <svg width="100%" viewBox="0 0 ${W} ${H}" style="max-height:${H}px" role="img" aria-label="弓手肘角度の推移">
    <title>弓手肘角度の推移: ${series.length}回、${min.toFixed(0)}〜${max.toFixed(0)}°</title>
    <path d="${path}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linejoin="round"/>
    ${series.map((p,i)=>`<circle cx="${px(i).toFixed(1)}" cy="${py(p.bowArm).toFixed(1)}" r="3" fill="var(--green)"/>`).join("")}
  </svg>`;
}
function formScoreLinkHtml(){
  const link=formScoreLink(db.formAnalyses||[], db.sessions, sessionMetrics);
  if(!link.split) return "";
  const s=link.split;
  const diff=s.stableAvg-s.driftAvg;
  return `<div class="advice" style="background:var(--card);border-color:var(--line)">
    <div class="note"><b>射形と得点の関係</b>（練習に紐付いた ${link.n} 記録）</div>
    <div class="kv"><span>リリース安定の日</span><span>平均 <b>${s.stableAvg.toFixed(2)}</b>（${s.stableN}回）</span></div>
    <div class="kv"><span>ドリフト多めの日</span><span>平均 <b>${s.driftAvg.toFixed(2)}</b>（${s.driftN}回）</span></div>
    ${Math.abs(diff)>=.1?`<div class="note">${diff>0?`リリースが安定していた日の方が平均 ${diff.toFixed(2)} 点/本 高い傾向です。`:`この期間はドリフトの有無と点数の差が出ていません（他要因が大きい可能性）。`}</div>`:""}
  </div>`;
}
function formTrackingCard(){
  if(!formTrackingEnabled()) return "";
  const allRecs=[...(db.formAnalyses||[])].sort((a,b)=>(b.ts||0)-(a.ts||0));
  const recs=allRecs.slice(0,5);
  const rows=recs.map((r,i)=>{
    const s=formRecordSummary(r);
    const prior=allRecs.slice(i+1); // このカードより古い記録＝自分基準の母集団
    return `<div class="formAnalysisRow">
      <button class="listItem recordReadOnlyItem" data-form-id="${esc(r.id)}" type="button">
      <div><div class="t">${fmtD(r.date)} ・ ${s.shots}射${r.sessionId?" ・ 練習に紐付け":""}</div>
      <div class="d">保持 ${s.holdS!=null?s.holdS.toFixed(1)+"秒":"—"} / アンカー ${esc(s.anchorLabel)} / タップで詳細</div></div>
      <div class="big">${formSelfBaselineLabel(s.bowArm,"bowArm",prior)}<small> / 引き手${s.drawArm!=null?s.drawArm.toFixed(0)+"°":"—"}</small></div>
      </button>
      <button class="btn sm ghost histDelBtn" data-del-form="${esc(r.id)}" type="button">${icon("del")}</button>
    </div>`;
  }).join("");
  return `<div class="card"><h2>射形トラッキング <span class="mini">ベータ / 端末内解析</span></h2>
    <div class="btnrow"><button class="btn" id="formStart">${icon("camera")} 射形を解析する</button><button class="btn sec sm" id="formReplay">保存済み動画を解析</button></div>
    ${formTrendMiniHtml()}
    ${rows||`<div class="empty">まだ射形記録がありません。カメラを横に置いて数射解析してみましょう。</div>`}
    ${formScoreLinkHtml()}
    <div class="hint">数値は弓手肘の中央値（直近の自分の記録と比較）。毎回同じ位置・角度で撮ると比較が正確になります。記録をタップすると、観測にもとづくコーチングコメントが見られます。</div>
  </div>`;
}

function bindFormTrackingCard(){
  const start=$("#formStart");
  if(start) start.onclick=openFormCapture;
  const replay=$("#formReplay");
  if(replay) replay.onclick=openFormReplay;
  document.querySelectorAll("[data-form-id]").forEach(li=>li.onclick=()=>{
    const rec=(db.formAnalyses||[]).find(r=>r.id===li.dataset.formId);
    if(rec) openFormDetail(rec);
  });
  document.querySelectorAll("[data-del-form]").forEach(b=>b.onclick=async e=>{
    e.stopPropagation();
    const rec=(db.formAnalyses||[]).find(r=>r.id===b.dataset.delForm);
    if(!rec) return;
    if(await appConfirm("この射形記録を削除しますか？",{danger:true,okLabel:"削除"})){
      trashItem("formAnalysis",`${fmtD(rec.date)} 射形${rec.shots||0}射`,rec);
      db.formAnalyses=db.formAnalyses.filter(r=>r.id!==rec.id);
      save({reason:"delete-form-analysis",forceSnapshot:true});
      render();
      toast("削除しました。設定から復元できます");
    }
  });
}

function formInsightBlockHtml(title, items){
  if(!items||!items.length) return "";
  return `<div class="advice" style="background:var(--card);border-color:var(--line)">
    <div class="note"><b>${esc(title)}</b></div>
    ${items.map(t=>`<div class="note">・${esc(t)}</div>`).join("")}
  </div>`;
}
function openFormDetail(rec){
  const sorted=[...(db.formAnalyses||[])].sort((a,b)=>(a.ts||0)-(b.ts||0));
  const idx=sorted.findIndex(r=>r.id===rec.id);
  const prev=idx>0?sorted[idx-1]:null;
  const ins=formRecordInsights(rec, prev);
  const linked=rec.sessionId?db.sessions.find(s=>s.id===rec.sessionId):null;
  const lm=linked?sessionMetrics(linked):null;
  const ovl=document.createElement("div"); ovl.className="ovl";
  ovl.innerHTML=`<div class="sheet">
    <h3>射形記録 ${fmtD(rec.date)} <span class="mini">${rec.shots||0}射 / ${esc(rec.modelVer||"")}</span></h3>
    ${linked?`<div class="kv"><span>紐付いた練習</span><span>${fmtD(linked.date)} ${linked.dist?linked.dist+"m":""} ・ 平均 ${lm&&lm.all.length?lm.avg.toFixed(2):"—"} 点/本</span></div>`:`<div class="subNote">練習セッションには紐付いていません（撮影日に練習記録があると自動で紐付きます）。</div>`}
    ${ins?`<div class="kv"><span>要約</span><span>弓手肘 ${ins.stats.bowArm!=null?ins.stats.bowArm.toFixed(0)+"°":"—"} / 引き手肘 ${ins.stats.drawArm!=null?ins.stats.drawArm.toFixed(0)+"°":"—"} / 保持 ${ins.stats.holdMs!=null?(ins.stats.holdMs/1000).toFixed(1)+"秒":"—"}</span></div>`:""}
    ${ins?formInsightBlockHtml("観測",ins.facts):""}
    ${ins?formInsightBlockHtml("原因候補",ins.causes):""}
    ${ins?formInsightBlockHtml("確認点",ins.checks):""}
    ${ins?formInsightBlockHtml("次の練習",ins.next):""}
    <table class="tbl mt8"><tr><th>射</th><th>弓手肘</th><th>引き手肘</th><th class="right">保持</th></tr>
    ${(rec.features||[]).map((f,i)=>`<tr><td>${i+1}</td><td>${f.angles&&Number.isFinite(f.angles.bowArm)?f.angles.bowArm.toFixed(0)+"°":"—"}${f.release&&f.release.stable===false?` ${icon("warn")}`:""}</td><td>${f.angles&&Number.isFinite(f.angles.drawArm)?f.angles.drawArm.toFixed(0)+"°":"—"}</td><td class="right">${f.phase&&Number.isFinite(f.phase.anchorMs)?(f.phase.anchorMs/1000).toFixed(1)+"s":"—"}</td></tr>`).join("")}</table>
    <div class="hint">${icon("warn")} = リリース前0.5秒にドリフトを観測した射。コメントは観測にもとづく候補で、断定ではありません。</div>
    <div class="btnrow"><button class="btn ghost" id="fdClose">閉じる</button></div>
  </div>`;
  openModal(ovl,{escapeTarget:"#fdClose"});
  ovl.querySelector("#fdClose").onclick=()=>closeModal(ovl);
}

function drawFormSkeleton(ctx,l,w,h){
  const seg=(a,b,color)=>{ if(!a||!b)return;
    ctx.strokeStyle=color; ctx.lineWidth=4; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(a.x*w,a.y*h); ctx.lineTo(b.x*w,b.y*h); ctx.stroke(); };
  const dot=(p,color)=>{ if(!p)return;
    ctx.fillStyle=color; ctx.beginPath(); ctx.arc(p.x*w,p.y*h,5,0,Math.PI*2); ctx.fill(); };
  const L=FORM_LM;
  seg(l[L.LEFT_SHOULDER],l[L.RIGHT_SHOULDER],"#7ee2a8");
  seg(l[L.LEFT_HIP],l[L.RIGHT_HIP],"#7ee2a8");
  seg(l[L.LEFT_SHOULDER],l[L.LEFT_HIP],"#7ee2a8");
  seg(l[L.RIGHT_SHOULDER],l[L.RIGHT_HIP],"#7ee2a8");
  seg(l[L.LEFT_SHOULDER],l[L.LEFT_ELBOW],"#ffb84d");
  seg(l[L.LEFT_ELBOW],l[L.LEFT_WRIST],"#ffb84d");
  seg(l[L.RIGHT_SHOULDER],l[L.RIGHT_ELBOW],"#78f3e2");
  seg(l[L.RIGHT_ELBOW],l[L.RIGHT_WRIST],"#78f3e2");
  [L.NOSE,L.LEFT_SHOULDER,L.RIGHT_SHOULDER,L.LEFT_ELBOW,L.RIGHT_ELBOW,L.LEFT_WRIST,L.RIGHT_WRIST].forEach(i=>dot(l[i],i===L.NOSE?"#ff6c8c":"#ffe14d"));
}

function openFormCapture(){
  const ovl=document.createElement("div"); ovl.className="ovl";
  ovl.innerHTML=`<div class="sheet formCapture">
    <div class="formCamWrap"><video id="fcVideo" playsinline muted></video><canvas id="fcCanvas"></canvas>
      <div class="formPhaseTag" id="fcPhase">準備中</div>
      <button class="formCloseBtn" id="fcClose" aria-label="閉じる">${icon("del")}</button>
      <button class="formCropBtn" id="fcCrop" aria-label="中央固定" aria-pressed="false">${icon("target")}</button>
      <button class="formRecBtn" id="fcRec" aria-label="録画" aria-pressed="false">${icon("camera")}</button>
      <div class="formHud" id="fcHud">解析モデルを読み込んでいます…（初回のみ約15MB）</div>
    </div>
    <div class="formShotScroll" id="fcShots"></div>
    <div class="formBar">
      <button class="btn sec sm" id="fcSwap">前/背面</button>
      <button class="btn sec sm" id="fcHand">利き手: ${db.settings.formHandedness==="left"?"左":"右"}</button>
      <button class="btn" id="fcSave" disabled>保存して終了</button>
    </div>
    <div class="formFootnote">検出の鮮明さは骨格検出の確からしさで、カメラの角度による測定誤差は反映されません。毎回同じ位置・角度で撮ると比較の精度が上がります。映像は保存・送信されず、保存されるのは角度・保持時間などの要約だけです。</div>
  </div>`;
  openModal(ovl,{escapeTarget:"#fcClose"});
  beginActiveWorkflow();
  const video=ovl.querySelector("#fcVideo"), canvas=ovl.querySelector("#fcCanvas");
  const ctx=canvas.getContext("2d");
  const hud=ovl.querySelector("#fcHud"), phaseEl=ovl.querySelector("#fcPhase");
  let facing="environment";
  let handedness=db.settings.formHandedness==="left"?"left":"right";
  let running=true, raf=0, stream=null, landmarker=null;
  let history=[], detector=makeFormPhaseDetector(), ema=makeFormEma(0.38);
  let anchorStartTs=0, shots=[], frames=0, lastFpsAt=performance.now(), fps=0;
  const CROP_FRAC=0.7, CROP_OFF=(1-0.7)/2;
  let cropActive=false;
  const cropCvs=document.createElement("canvas");
  const cropCx=cropCvs.getContext("2d");
  /* 矢プレゼンスのシャドー判定（ベータ）: releasedの取消動作には一切使わない。
     ROI サンプルはフルドロー中と確定猶予窓のみ実行し、常時のフレーム負荷を避ける。
     roiCanvas は ROI 帯の外接矩形だけを video から切り出す小さいオフスクリーンキャンバス
    （getImageData をフル解像度で呼ばないための軽量化）。 */
  const roiCanvas=document.createElement("canvas");
  const roiCtx=roiCanvas.getContext("2d",{willReadFrequently:true});
  let presenceRing=[]; // {ts, score} フルドロー中の直近スコア（最大約1.5秒分）
  let pendingCheck=null; // {shotId, preScores, confirmScores, startTs} 確定猶予窓の計測中
  let samplePerfMs=[]; // 実測処理時間(ms/frame)。報告用に先頭数十件だけ保持
  let recorder=null, recChunks=[], recBlob=null;
  function startRec(){
    if(!stream||recorder) return;
    recChunks=[]; recBlob=null;
    const mime=typeof MediaRecorder!=="undefined"&&MediaRecorder.isTypeSupported("video/mp4")?"video/mp4":"video/webm";
    try{
      recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1_500_000});
      recorder.ondataavailable=e=>{ if(e.data.size>0) recChunks.push(e.data); };
      recorder.onstop=()=>{ recBlob=new Blob(recChunks,{type:mime}); recChunks=[]; };
      recorder.start(1000);
    }catch(e){ recorder=null; }
  }
  function stopRec(){ if(recorder&&recorder.state!=="inactive"){ recorder.stop(); recorder=null; } }
  async function shareRec(){
    if(!recBlob) return;
    const ext=recBlob.type.includes("mp4")?"mp4":"webm";
    const file=new File([recBlob],`form-tracking-${today()}.${ext}`,{type:recBlob.type});
    try{
      if(navigator.canShare&&navigator.canShare({files:[file]})) await navigator.share({files:[file]});
      else{ const u=URL.createObjectURL(recBlob); const a=document.createElement("a"); a.href=u; a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); }
    }catch(e){ if(e.name!=="AbortError") toast("動画の保存に失敗しました"); }
    recBlob=null;
  }

  function stop(){
    running=false;
    if(raf) cancelAnimationFrame(raf);
    if(pendingCheck) finalizeArrowCheck();
    stopRec();
    try{ if(stream) stream.getTracks().forEach(t=>t.stop()); }catch(e){}
    endActiveWorkflow();
    closeModal(ovl);
  }
  async function startCamera(){
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=stream;
    await video.play();
    canvas.width=video.videoWidth; canvas.height=video.videoHeight;
  }
  function refreshShotsHint(){
    const saveBtn=ovl.querySelector("#fcSave");
    saveBtn.disabled=!shots.length;
    saveBtn.textContent=shots.length?`保存して終了（${shots.length}射）`:"保存して終了";
  }
  function renumberShots(){
    ovl.querySelectorAll("#fcShots [data-shot-id]").forEach((div,i)=>{
      const idx=shots.length-1-i; // 一覧は新しい射が先頭（prepend）
      const t=div.querySelector(".t");
      if(t) t.textContent=`第${idx+1}射`;
    });
  }
  /* ROI 帯の外接矩形だけを video から roiCanvas へ切り出し、そこで矢プレゼンスを測る
     （getImageData をフル解像度で呼ばない軽量化）。呼び出し側で performance.now() 差分を
     とって処理時間を記録できるよう、実測はここでは行わない（loop側で計測）。 */
  function sampleArrowPresence(raw){
    if(!raw||!raw.bW||!raw.dW||!video.videoWidth) return null;
    const vw=video.videoWidth, vh=video.videoHeight;
    const pad=0.06; // ROI外接矩形にわずかに余白（帯の走査幅ぶん）
    const minX=Math.min(raw.bW.x,raw.dW.x)-pad, maxX=Math.max(raw.bW.x,raw.dW.x)+pad;
    const minY=Math.min(raw.bW.y,raw.dW.y)-pad, maxY=Math.max(raw.bW.y,raw.dW.y)+pad;
    const sx=Math.max(0,Math.floor(minX*vw)), sy=Math.max(0,Math.floor(minY*vh));
    const ex=Math.min(vw,Math.ceil(maxX*vw)), ey=Math.min(vh,Math.ceil(maxY*vh));
    const rw=ex-sx, rh=ey-sy;
    if(rw<=1||rh<=1) return 0;
    roiCanvas.width=rw; roiCanvas.height=rh;
    roiCtx.drawImage(video,sx,sy,rw,rh,0,0,rw,rh);
    let img;
    try{ img=roiCtx.getImageData(0,0,rw,rh); }catch(e){ return null; }
    // p1/p2 を ROI 局所座標(0-1)へ変換
    const toLocal=(p)=>({x:(p.x*vw-sx)/rw, y:(p.y*vh-sy)/rh});
    return arrowPresence(img,toLocal(raw.bW),toLocal(raw.dW));
  }
  function onShot(now){
    const shot=summarizeFormShot(history,anchorStartTs,now);
    if(!shot) return null;
    shot.id=uid();
    shot.arrowCheck=null; // 確定猶予窓の計測後に judgeArrowCheck の結果を書き込む（シャドー）
    shots.push(shot);
    const div=document.createElement("div");
    div.className="listItem recordReadOnlyItem";
    div.dataset.shotId=shot.id;
    div.innerHTML=`<div><div class="t">第${shots.length}射</div>
      <div class="d" data-shot-desc>保持 ${(shot.holdMs/1000).toFixed(1)}秒${shot.pre&&(shot.pre.bowDrift||shot.pre.drawDrift)?` / ${icon("warn")} リリース前ドリフト`:""}</div></div>
      <div class="big">${shot.angles.bowArm!=null?shot.angles.bowArm.toFixed(0)+"°":"—"}<small> / 引き手${shot.angles.drawArm!=null?shot.angles.drawArm.toFixed(0)+"°":"—"}</small></div>
      <button class="btn sm ghost" data-rm-shot="${esc(shot.id)}" aria-label="この射を取り消す">${icon("del")}</button>`;
    div.querySelector("[data-rm-shot]").onclick=()=>{
      shots=shots.filter(s=>s.id!==shot.id);
      div.remove();
      renumberShots();
      refreshShotsHint();
      nativePulse("light");
    };
    ovl.querySelector("#fcShots").prepend(div);
    refreshShotsHint();
    nativePulse("light");
    return shot.id;
  }
  /* 確定猶予窓の計測が終わったら、シャドー判定結果を該当ショットに書き込み、
     ショット一覧の表示も更新する。released 判定自体（released/canceled）は一切変えない。 */
  function finalizeArrowCheck(){
    if(!pendingCheck) return;
    const {shotId,preScores,confirmScores}=pendingCheck;
    pendingCheck=null;
    const shot=shots.find(s=>s.id===shotId);
    if(!shot) return; // canceled で既に取り消し済み
    const result=judgeArrowCheck(preScores,confirmScores);
    shot.arrowCheck=result;
    const desc=ovl.querySelector(`#fcShots [data-shot-id="${shotId}"] [data-shot-desc]`);
    if(desc) desc.innerHTML=desc.innerHTML+formArrowCheckTagHtml(result);
  }
  function loop(){
    if(!running) return;
    if(landmarker && video.readyState>=2){
      const now=performance.now();
      let res;
      if(cropActive&&video.videoWidth){
        const cw=Math.round(video.videoWidth*CROP_FRAC), cx=Math.round(video.videoWidth*CROP_OFF);
        cropCvs.width=cw; cropCvs.height=video.videoHeight;
        cropCx.drawImage(video,cx,0,cw,video.videoHeight,0,0,cw,video.videoHeight);
        res=landmarker.detectForVideo(cropCvs,now);
        if(res.landmarks&&res.landmarks[0]) res.landmarks[0].forEach(l=>{l.x=l.x*CROP_FRAC+CROP_OFF;});
      }else{
        res=landmarker.detectForVideo(video,now);
      }
      frames++;
      if(now-lastFpsAt>=1000){ fps=frames*1000/(now-lastFpsAt); frames=0; lastFpsAt=now; }
      const lms=res.landmarks&&res.landmarks[0];
      const raw=lms?computeFormMetrics(lms,handedness):null;
      const disp=ema(raw);
      let vel=0;
      if(raw){let lv=null;for(let i=history.length-1;i>=0&&!lv;i--)if(history[i].m)lv=history[i];
      if(lv){const dt=(now-lv.ts)/1000;if(dt>0&&dt<0.5)vel=formDist(raw.dW,lv.m.dW)/dt/raw.bodyScale;}}
      history.push({ts:now,m:raw,vel});
      if(history.length>200) history.shift();
      const {phase,released,canceled}=stepFormPhase(detector,raw,history,1.0,now);
      if(canceled){
        /* 確定猶予で自己修復: 直前に誤検出したショットをUIごと取り消す（シャドー判定も破棄） */
        const last=shots[shots.length-1];
        if(last){
          shots=shots.filter(s=>s.id!==last.id);
          const div=ovl.querySelector(`#fcShots [data-shot-id="${last.id}"]`);
          if(div) div.remove();
          renumberShots();
          refreshShotsHint();
        }
        if(pendingCheck&&pendingCheck.shotId===(last&&last.id)) pendingCheck=null;
      }
      /* 矢プレゼンスのシャドー計測: フルドロー中と確定猶予窓のみ ROI を処理する
        （常時処理しないことでモバイル負荷を抑える）。1フレームあたりの処理時間を
        report用に実測・記録する（先頭200件のみ保持）。 */
      if(phase==="FULL_DRAW"||pendingCheck){
        const t0=performance.now();
        const presenceScore=raw?sampleArrowPresence(raw):null;
        const dt=performance.now()-t0;
        if(samplePerfMs.length<200) samplePerfMs.push(dt);
        if(phase==="FULL_DRAW"&&presenceScore!=null){
          presenceRing.push({ts:now,score:presenceScore});
          const cutoff=now-1500;
          while(presenceRing.length&&presenceRing[0].ts<cutoff) presenceRing.shift();
        }
        if(pendingCheck){
          if(presenceScore!=null) pendingCheck.confirmScores.push(presenceScore);
          if(now-pendingCheck.startTs>=FORM_PH.CONFIRM_MS) finalizeArrowCheck();
        }
      }
      if((phase==="ANCHORING"||phase==="FULL_DRAW")&&!anchorStartTs) anchorStartTs=now;
      if(released){
        const preScores=presenceRing.map(p=>p.score);
        const shotId=onShot(now);
        anchorStartTs=0;
        if(shotId) pendingCheck={shotId,preScores,confirmScores:[],startTs:now};
      }
      if(phase==="SETUP"||phase==="IDLE") anchorStartTs=0;
      phaseEl.textContent=phase;
      phaseEl.classList.toggle("release",phase==="RELEASE");
      phaseEl.classList.toggle("fulldraw",phase==="FULL_DRAW");
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if(cropActive){
        ctx.fillStyle="rgba(0,0,0,0.45)";
        const cx=canvas.width*CROP_OFF;
        ctx.fillRect(0,0,cx,canvas.height);
        ctx.fillRect(canvas.width-cx,0,cx,canvas.height);
      }
      if(lms) drawFormSkeleton(ctx,lms,canvas.width,canvas.height);
      if(raw&&disp){
        hud.innerHTML=`FPS <b>${fps.toFixed(0)}</b> ・ 検出の鮮明さ <b>${Math.round(disp.conf*100)}%</b> ・ 弓手肘 <b>${disp.bowArm.toFixed(0)}°</b> ・ 引き手肘 <b>${disp.drawArm.toFixed(0)}°</b>${raw.occluded.length?`<br>${icon("warn")} 検出低下: ${raw.occluded.map(esc).join("・")}`:""}`;
      }else{
        hud.innerHTML=`FPS <b>${fps.toFixed(0)}</b> ・ 人物を検出中…（横向き全身が写る位置に置いてください）`;
      }
    }
    raf=requestAnimationFrame(loop);
  }
  ovl.querySelector("#fcClose").onclick=async()=>{
    if(!shots.length || await appConfirm(`${shots.length}射の解析結果を保存せずに閉じますか？`,{danger:true,okLabel:"閉じる"})) stop();
  };
  ovl.querySelector("#fcSave").onclick=async()=>{
    if(!shots.length) return;
    const hadRec=!!recorder;
    const todays=db.sessions.filter(s=>s.date===today());
    const linked=todays.length?todays[todays.length-1]:null;
    db.formAnalyses=db.formAnalyses||[];
    db.formAnalyses.push({
      id:uid(), date:today(), ts:Date.now(), sessionId:linked?linked.id:null, setupId:linked?linked.setupId||null:null,
      shots:shots.length, modelVer:"pose_landmarker_lite v1 (tasks-vision 0.10.14)",
      appVer:APP_VER, fps:+fps.toFixed(1),
      features:shots.map(formFeatureFromShot), note:""
    });
    save({reason:"form-analysis"});
    toast(linked?`射形記録を保存し、今日の練習に紐付けました（${shots.length}射）`:`射形記録を保存しました（${shots.length}射）`);
    nativePulse("success");
    stop(); render();
    if(hadRec&&recBlob){
      await new Promise(r=>setTimeout(r,200));
      if(await appConfirm("トラッキング動画をカメラロールに保存しますか？",{okLabel:"保存する"})) await shareRec();
      else recBlob=null;
    }
  };
  ovl.querySelector("#fcSwap").onclick=async()=>{
    facing=facing==="environment"?"user":"environment";
    try{ if(stream) stream.getTracks().forEach(t=>t.stop()); await startCamera(); }
    catch(e){ hud.textContent="カメラを切り替えられませんでした: "+e.message; }
  };
  ovl.querySelector("#fcHand").onclick=e=>{
    handedness=handedness==="right"?"left":"right";
    db.settings.formHandedness=handedness; save();
    e.target.textContent="利き手: "+(handedness==="right"?"右":"左");
    detector=makeFormPhaseDetector(); ema=makeFormEma(0.38); history=[]; anchorStartTs=0;
  };
  ovl.querySelector("#fcCrop").onclick=e=>{
    cropActive=!cropActive;
    e.currentTarget.setAttribute("aria-pressed",String(cropActive));
    e.currentTarget.classList.toggle("active",cropActive);
    nativePulse("light");
  };
  ovl.querySelector("#fcRec").onclick=e=>{
    const btn=e.currentTarget;
    if(recorder){ stopRec(); btn.setAttribute("aria-pressed","false"); btn.classList.remove("active"); toast("録画を停止しました"); }
    else{ startRec(); btn.setAttribute("aria-pressed","true"); btn.classList.add("active"); toast("録画中…保存時にカメラロールへ保存できます"); }
    nativePulse("light");
  };
  loadFormPose().then(async lm=>{
    landmarker=lm;
    hud.textContent="カメラを起動しています…";
    await startCamera();
    hud.textContent="準備完了。横向き全身が写る位置で数射どうぞ。";
    loop();
  }).catch(e=>{
    hud.textContent="射形解析を開始できませんでした: "+(e&&e.message||e)+"（カメラ許可と、iOS 16.4以降/最新ブラウザをご確認ください）";
  });
}

function openFormReplay(){
  const input=document.createElement("input");
  input.type="file"; input.accept="video/*";
  input.onchange=()=>{ const f=input.files[0]; if(f) startFormReplay(URL.createObjectURL(f)); };
  input.click();
}
function startFormReplay(videoUrl){
  const ovl=document.createElement("div"); ovl.className="ovl";
  ovl.innerHTML=`<div class="sheet formCapture">
    <div class="formCamWrap"><video id="frVideo" playsinline muted></video><canvas id="frCanvas"></canvas>
      <div class="formPhaseTag" id="frPhase">読込中</div>
      <button class="formCloseBtn" id="frClose" aria-label="閉じる">${icon("del")}</button>
      <div class="formHud" id="frHud">動画を読み込んでいます…</div>
    </div>
    <div class="formShotScroll" id="frShots"></div>
    <div class="formBar">
      <button class="btn sec sm" id="frHand">利き手: ${db.settings.formHandedness==="left"?"左":"右"}</button>
      <button class="btn" id="frSave" disabled>保存して終了</button>
    </div>
    <div class="formFootnote">保存済み動画からの射形解析。検出の鮮明さは骨格検出の確からしさで、カメラの角度による測定誤差は反映されません。毎回同じ位置・角度で撮ると比較の精度が上がります。</div>
  </div>`;
  openModal(ovl,{escapeTarget:"#frClose"});
  beginActiveWorkflow();
  const video=ovl.querySelector("#frVideo"), canvas=ovl.querySelector("#frCanvas");
  const ctx=canvas.getContext("2d");
  const hud=ovl.querySelector("#frHud"), phaseEl=ovl.querySelector("#frPhase");
  let handedness=db.settings.formHandedness==="left"?"left":"right";
  let running=true, raf=0, landmarker=null;
  let history=[], detector=makeFormPhaseDetector(), ema=makeFormEma(0.38);
  let anchorStartTs=0, shots=[], frames=0, lastFpsAt=performance.now(), fps=0;
  function stop(){
    running=false; if(raf) cancelAnimationFrame(raf);
    try{ video.pause(); }catch(e){}
    URL.revokeObjectURL(videoUrl);
    endActiveWorkflow(); closeModal(ovl);
  }
  function refreshSave(){
    const b=ovl.querySelector("#frSave");
    b.disabled=!shots.length;
    b.textContent=shots.length?`保存して終了（${shots.length}射）`:"保存して終了";
  }
  function onShot(now){
    const shot=summarizeFormShot(history,anchorStartTs,now);
    if(!shot) return;
    shot.id=uid(); shot.arrowCheck=null; shots.push(shot);
    const div=document.createElement("div");
    div.className="listItem recordReadOnlyItem"; div.dataset.shotId=shot.id;
    div.innerHTML=`<div><div class="t">第${shots.length}射</div>
      <div class="d">保持 ${(shot.holdMs/1000).toFixed(1)}秒${shot.pre&&(shot.pre.bowDrift||shot.pre.drawDrift)?` / ${icon("warn")} リリース前ドリフト`:""}</div></div>
      <div class="big">${shot.angles.bowArm!=null?shot.angles.bowArm.toFixed(0)+"°":"—"}<small> / 引き手${shot.angles.drawArm!=null?shot.angles.drawArm.toFixed(0)+"°":"—"}</small></div>`;
    ovl.querySelector("#frShots").prepend(div);
    refreshSave(); nativePulse("light");
  }
  function loop(){
    if(!running) return;
    if(landmarker&&video.readyState>=2&&!video.paused&&!video.ended){
      const now=video.currentTime*1000;
      const res=landmarker.detectForVideo(video,now);
      frames++;
      const wallNow=performance.now();
      if(wallNow-lastFpsAt>=1000){ fps=frames*1000/(wallNow-lastFpsAt); frames=0; lastFpsAt=wallNow; }
      const lms=res.landmarks&&res.landmarks[0];
      const raw=lms?computeFormMetrics(lms,handedness):null;
      const disp=ema(raw);
      let vel=0;
      if(raw){let lv=null;for(let i=history.length-1;i>=0&&!lv;i--)if(history[i].m)lv=history[i];
      if(lv){const dt=(now-lv.ts)/1000;if(dt>0&&dt<0.5)vel=formDist(raw.dW,lv.m.dW)/dt/raw.bodyScale;}}
      history.push({ts:now,m:raw,vel});
      if(history.length>200) history.shift();
      const {phase,released}=stepFormPhase(detector,raw,history,1.0,now);
      if((phase==="ANCHORING"||phase==="FULL_DRAW")&&!anchorStartTs) anchorStartTs=now;
      if(released){ onShot(now); anchorStartTs=0; }
      if(phase==="SETUP"||phase==="IDLE") anchorStartTs=0;
      phaseEl.textContent=phase;
      phaseEl.classList.toggle("release",phase==="RELEASE");
      phaseEl.classList.toggle("fulldraw",phase==="FULL_DRAW");
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if(lms) drawFormSkeleton(ctx,lms,canvas.width,canvas.height);
      if(raw&&disp){
        const pct=video.duration?(video.currentTime/video.duration*100).toFixed(0):0;
        hud.innerHTML=`${pct}% ・ FPS <b>${fps.toFixed(0)}</b> ・ 弓手肘 <b>${disp.bowArm.toFixed(0)}°</b> ・ 引き手肘 <b>${disp.drawArm.toFixed(0)}°</b>`;
      }else{
        hud.innerHTML=`解析中… 人物を検出中`;
      }
    }
    if(video.ended&&running){
      phaseEl.textContent="完了";
      hud.innerHTML=`解析完了 ・ ${shots.length}射を検出しました`;
      running=false; return;
    }
    raf=requestAnimationFrame(loop);
  }
  ovl.querySelector("#frClose").onclick=async()=>{
    if(!shots.length||await appConfirm(`${shots.length}射の解析結果を保存せずに閉じますか？`,{danger:true,okLabel:"閉じる"})) stop();
  };
  ovl.querySelector("#frSave").onclick=()=>{
    if(!shots.length) return;
    const todays=db.sessions.filter(s=>s.date===today());
    const linked=todays.length?todays[todays.length-1]:null;
    db.formAnalyses=db.formAnalyses||[];
    db.formAnalyses.push({
      id:uid(), date:today(), ts:Date.now(), sessionId:linked?linked.id:null, setupId:linked?linked.setupId||null:null,
      shots:shots.length, modelVer:"pose_landmarker_lite v1 (tasks-vision 0.10.14)",
      appVer:APP_VER, fps:+fps.toFixed(1),
      features:shots.map(formFeatureFromShot), note:"(保存済み動画から解析)"
    });
    save({reason:"form-analysis"});
    toast(linked?`射形記録を保存し、今日の練習に紐付けました（${shots.length}射）`:`射形記録を保存しました（${shots.length}射）`);
    nativePulse("success"); stop(); render();
  };
  ovl.querySelector("#frHand").onclick=e=>{
    handedness=handedness==="right"?"left":"right";
    db.settings.formHandedness=handedness; save();
    e.target.textContent="利き手: "+(handedness==="right"?"右":"左");
    detector=makeFormPhaseDetector(); ema=makeFormEma(0.38); history=[]; anchorStartTs=0;
  };
  loadFormPose().then(async lm=>{
    landmarker=lm;
    hud.textContent="動画を読み込んでいます…";
    video.preload="auto";
    video.onerror=()=>{ hud.textContent="動画の読み込みに失敗しました。対応していない形式の可能性があります。"; };
    video.onloadeddata=()=>{
      canvas.width=video.videoWidth; canvas.height=video.videoHeight;
      hud.textContent="解析を開始します…";
      video.play(); loop();
    };
    video.src=videoUrl;
    video.load();
  }).catch(e=>{
    hud.textContent="射形解析を開始できませんでした: "+(e&&e.message||e);
  });
}