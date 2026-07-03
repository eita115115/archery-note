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
    score:shot.score==null?null:Math.round(shot.score)
  };
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

function formTrendMiniHtml(){
  const series=formTrendSeries(db.formAnalyses||[]).filter(p=>Number.isFinite(p.bowArm));
  if(series.length<3) return "";
  const W=300,H=54;
  const vals=series.map(p=>p.bowArm);
  const min=Math.min(...vals,FORM_REF.bowArmAngle.ideal-10), max=Math.max(...vals,FORM_REF.bowArmAngle.ideal+4);
  const span=(max-min)||1;
  const px=i=>(i/(series.length-1))*W;
  const py=v=>H-6-((v-min)/span)*(H-12);
  const idealY=py(FORM_REF.bowArmAngle.ideal);
  const path=series.map((p,i)=>`${i?"L":"M"}${px(i).toFixed(1)},${py(p.bowArm).toFixed(1)}`).join("");
  return `<div class="note"><b>弓手肘の推移</b>（点線 = 基準 ${FORM_REF.bowArmAngle.ideal}°）</div>
  <svg width="100%" viewBox="0 0 ${W} ${H}" style="max-height:${H}px" role="img" aria-label="弓手肘角度の推移">
    <line x1="0" y1="${idealY.toFixed(1)}" x2="${W}" y2="${idealY.toFixed(1)}" stroke="var(--sub)" stroke-dasharray="5 4" stroke-width="1"/>
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
  const recs=[...(db.formAnalyses||[])].sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,5);
  const rows=recs.map(r=>{
    const s=formRecordSummary(r);
    return `<div class="listItem recordReadOnlyItem" data-form-id="${r.id}">
      <div><div class="t">${fmtD(r.date)} ・ ${s.shots}射${r.sessionId?" ・ 練習に紐付け":""}</div>
      <div class="d">保持 ${s.holdS!=null?s.holdS.toFixed(1)+"秒":"—"} / アンカー ${esc(s.anchorLabel)} / タップで詳細</div></div>
      <div class="big">${s.bowArm!=null?s.bowArm.toFixed(0)+"°":"—"}<small> / 引き手${s.drawArm!=null?s.drawArm.toFixed(0)+"°":"—"}</small></div>
      <button class="btn sm ghost histDelBtn" data-del-form="${r.id}">✕</button>
    </div>`;
  }).join("");
  return `<div class="card"><h2>射形トラッキング <span class="mini">ベータ / 端末内解析</span></h2>
    <div class="btnrow"><button class="btn" id="formStart">📷 射形を解析する</button></div>
    ${formTrendMiniHtml()}
    ${rows||`<div class="empty">まだ射形記録がありません。カメラを横に置いて数射解析してみましょう。</div>`}
    ${formScoreLinkHtml()}
    <div class="hint">数値は弓手肘の中央値（エリート基準 172°）。記録をタップすると、観測にもとづくコーチングコメントが見られます。</div>
  </div>`;
}

function bindFormTrackingCard(){
  const start=$("#formStart");
  if(start) start.onclick=openFormCapture;
  document.querySelectorAll("[data-form-id]").forEach(li=>li.onclick=()=>{
    const rec=(db.formAnalyses||[]).find(r=>r.id===li.dataset.formId);
    if(rec) openFormDetail(rec);
  });
  document.querySelectorAll("[data-del-form]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const rec=(db.formAnalyses||[]).find(r=>r.id===b.dataset.delForm);
    if(!rec) return;
    if(confirm("この射形記録を削除しますか？")){
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
    ${(rec.features||[]).map((f,i)=>`<tr><td>${i+1}</td><td>${f.angles&&Number.isFinite(f.angles.bowArm)?f.angles.bowArm.toFixed(0)+"°":"—"}${f.release&&f.release.stable===false?" ⚠":""}</td><td>${f.angles&&Number.isFinite(f.angles.drawArm)?f.angles.drawArm.toFixed(0)+"°":"—"}</td><td class="right">${f.phase&&Number.isFinite(f.phase.anchorMs)?(f.phase.anchorMs/1000).toFixed(1)+"s":"—"}</td></tr>`).join("")}</table>
    <div class="hint">⚠ = リリース前0.5秒にドリフトを観測した射。コメントは観測にもとづく候補で、断定ではありません。</div>
    <div class="btnrow"><button class="btn ghost" id="fdClose">閉じる</button></div>
  </div>`;
  document.body.appendChild(ovl);
  ovl.querySelector("#fdClose").onclick=()=>ovl.remove();
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
  ovl.innerHTML=`<div class="sheet">
    <h3>射形トラッキング <span class="mini">ベータ</span></h3>
    <div class="formCamWrap"><video id="fcVideo" playsinline muted></video><canvas id="fcCanvas"></canvas><div class="formPhaseTag" id="fcPhase">準備中</div></div>
    <div class="note" id="fcHud">解析モデルを読み込んでいます…（初回のみ約15MB）</div>
    <div id="fcShots"></div>
    <div class="btnrow">
      <button class="btn sec sm" id="fcSwap">前/背面</button>
      <button class="btn sec sm" id="fcHand">利き手: ${db.settings.formHandedness==="left"?"左":"右"}</button>
    </div>
    <div class="btnrow">
      <button class="btn" id="fcSave" disabled>保存して終了</button>
      <button class="btn ghost" id="fcClose">保存せず閉じる</button>
    </div>
    <div class="hint">リリースは自動検出されます。映像は保存・送信されず、保存されるのは角度・保持時間などの要約だけです。</div>
  </div>`;
  document.body.appendChild(ovl);
  beginActiveWorkflow();
  const video=ovl.querySelector("#fcVideo"), canvas=ovl.querySelector("#fcCanvas");
  const ctx=canvas.getContext("2d");
  const hud=ovl.querySelector("#fcHud"), phaseEl=ovl.querySelector("#fcPhase");
  let facing="environment";
  let handedness=db.settings.formHandedness==="left"?"left":"right";
  let running=true, raf=0, stream=null, landmarker=null;
  let history=[], detector=makeFormPhaseDetector(), ema=makeFormEma(0.38);
  let anchorStartTs=0, shots=[], frames=0, lastFpsAt=performance.now(), fps=0;

  function stop(){
    running=false;
    if(raf) cancelAnimationFrame(raf);
    try{ if(stream) stream.getTracks().forEach(t=>t.stop()); }catch(e){}
    endActiveWorkflow();
    ovl.remove();
  }
  async function startCamera(){
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=stream;
    await video.play();
    canvas.width=video.videoWidth; canvas.height=video.videoHeight;
  }
  function onShot(now){
    const shot=summarizeFormShot(history,anchorStartTs,now);
    if(!shot) return;
    shots.push(shot);
    const div=document.createElement("div");
    div.className="listItem recordReadOnlyItem";
    div.innerHTML=`<div><div class="t">第${shots.length}射</div>
      <div class="d">保持 ${(shot.holdMs/1000).toFixed(1)}秒${shot.pre&&(shot.pre.bowDrift||shot.pre.drawDrift)?" / ⚠ リリース前ドリフト":""}</div></div>
      <div class="big">${shot.angles.bowArm!=null?shot.angles.bowArm.toFixed(0)+"°":"—"}<small> / 引き手${shot.angles.drawArm!=null?shot.angles.drawArm.toFixed(0)+"°":"—"}</small></div>`;
    ovl.querySelector("#fcShots").prepend(div);
    const saveBtn=ovl.querySelector("#fcSave");
    saveBtn.disabled=false;
    saveBtn.textContent=`保存して終了（${shots.length}射）`;
    nativePulse("light");
  }
  function loop(){
    if(!running) return;
    if(landmarker && video.readyState>=2){
      const now=performance.now();
      const res=landmarker.detectForVideo(video,now);
      frames++;
      if(now-lastFpsAt>=1000){ fps=frames*1000/(now-lastFpsAt); frames=0; lastFpsAt=now; }
      const lms=res.landmarks&&res.landmarks[0];
      const raw=lms?computeFormMetrics(lms,handedness):null;
      const disp=ema(raw);
      let vel=0;
      const last=history[history.length-1];
      if(raw&&last&&last.m){ const dt=(now-last.ts)/1000; if(dt>0) vel=formDist(raw.dW,last.m.dW)/dt/raw.bodyScale; }
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
        hud.innerHTML=`FPS <b>${fps.toFixed(0)}</b> ・ 信頼度 <b>${Math.round(disp.conf*100)}%</b> ・ 弓手肘 <b>${disp.bowArm.toFixed(0)}°</b> ・ 引き手肘 <b>${disp.drawArm.toFixed(0)}°</b>${raw.occluded.length?`<br>⚠ 検出低下: ${raw.occluded.map(esc).join("・")}`:""}`;
      }else{
        hud.innerHTML=`FPS <b>${fps.toFixed(0)}</b> ・ 人物を検出中…（横向き全身が写る位置に置いてください）`;
      }
    }
    raf=requestAnimationFrame(loop);
  }
  ovl.querySelector("#fcClose").onclick=()=>{
    if(!shots.length || confirm(`${shots.length}射の解析結果を保存せずに閉じますか？`)) stop();
  };
  ovl.querySelector("#fcSave").onclick=()=>{
    if(!shots.length) return;
    /* 同日の練習セッションがあれば自動で紐付ける（射形×得点の関係分析に使う） */
    const todays=db.sessions.filter(s=>s.date===today());
    const linked=todays.length?todays[todays.length-1]:null;
    db.formAnalyses=db.formAnalyses||[];
    db.formAnalyses.push({
      id:uid(), date:today(), ts:Date.now(), sessionId:linked?linked.id:null, setupId:linked?linked.setupId||null:null,
      shots:shots.length, modelVer:"pose_landmarker_lite v1 (tasks-vision 0.10.14)",
      appVer:APP_VER, fps:+fps.toFixed(1),
      features:shots.map(formFeatureFromShot), note:""
    });
    save({reason:"form-analysis",forceSnapshot:true});
    toast(linked?`射形記録を保存し、今日の練習に紐付けました（${shots.length}射）`:`射形記録を保存しました（${shots.length}射）`);
    nativePulse("success");
    stop(); render();
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