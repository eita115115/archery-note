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

function formFeatureFromShot(shot,includeDiagnostics){
  const f={
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
  if(includeDiagnostics===true){
    if(shot.diag) f.diag={maxV:+shot.diag.maxV.toFixed(2),rise:+shot.diag.rise.toFixed(3),nullFrames:shot.diag.nullFrames,conf:shot.diag.conf==null?null:+shot.diag.conf.toFixed(2)};
    f.receiptId=shot.id;
  }
  return f;
}

/* 検証計装（H-2, release-detection-triage-2026-07-13 Plan-0）: canceled/近接rejectedフレームの
   ring buffer push（上限200件）。db.settings.formDebug===true のときだけ呼び出し側から呼ばれる想定。 */
function formDiagPush(arr,item,cap){
  arr.push(item);
  if(arr.length>(cap||200)) arr.shift();
}

/* FORM_DIAGNOSTIC_TRANSACTION_START */
function commitFormDiagnosticDbCandidate(database,candidate,saveOptions,saveFn){
  const invalid=message=>({ok:false,error:new TypeError(message)});
  if(!database||typeof database!=="object"||!candidate||typeof candidate!=="object"||Array.isArray(candidate)||!saveOptions||typeof saveOptions!=="object"||typeof saveFn!=="function"){
    return invalid("invalid form diagnostic transaction arguments");
  }
  const allowed=new Set(["formAnalyses","trash","formDiagnosticMatrixBatch"]);
  const keys=Reflect.ownKeys(candidate);
  if(!keys.length||keys.some(key=>typeof key!=="string"||!allowed.has(key))||(Object.hasOwn(candidate,"formAnalyses")&&!Array.isArray(candidate.formAnalyses))||(Object.hasOwn(candidate,"trash")&&!Array.isArray(candidate.trash))||(Object.hasOwn(candidate,"formDiagnosticMatrixBatch")&&(!database.settings||typeof database.settings!=="object"))){
    return invalid("invalid form diagnostic transaction candidate");
  }

  const touched=[];
  const assign=(target,key,value)=>{
    touched.push({target,key,hadOwn:Object.hasOwn(target,key),value:target[key]});
    target[key]=value;
  };
  const hadUpdatedAt=Object.hasOwn(database,"updatedAt");
  const updatedAt=database.updatedAt;

  if(Object.hasOwn(candidate,"formAnalyses")) assign(database,"formAnalyses",candidate.formAnalyses);
  if(Object.hasOwn(candidate,"trash")) assign(database,"trash",candidate.trash);
  if(Object.hasOwn(candidate,"formDiagnosticMatrixBatch")){
    assign(database.settings,"formDiagnosticMatrixBatch",candidate.formDiagnosticMatrixBatch);
  }

  let saved=false;
  let error=null;
  try{ saved=saveFn(saveOptions)===true; }catch(caught){ error=caught; }
  if(saved) return {ok:true,error:null};

  for(let index=touched.length-1;index>=0;index--){
    const prior=touched[index];
    if(prior.hadOwn) prior.target[prior.key]=prior.value;
    else delete prior.target[prior.key];
  }
  if(hadUpdatedAt) database.updatedAt=updatedAt;
  else delete database.updatedAt;
  return {ok:false,error};
}

function captureFormDiagnosticCoordinatorToken(coordinator){
  if(!coordinator||typeof coordinator!=="object"||!Array.isArray(coordinator.recordIds)) return null;
  return {reference:coordinator,version:coordinator.version,batchId:coordinator.batchId,appVer:coordinator.appVer,nextSlot:coordinator.nextSlot,invalidated:coordinator.invalidated,recordIds:coordinator.recordIds.slice()};
}
function formDiagnosticCoordinatorTokenMatches(database,token){
  if(token===null) return true;
  const current=database&&database.settings&&database.settings.formDiagnosticMatrixBatch;
  return current===token.reference&&current.version===token.version&&current.batchId===token.batchId&&current.appVer===token.appVer&&current.nextSlot===token.nextSlot&&current.invalidated===token.invalidated&&Array.isArray(current.recordIds)&&current.recordIds.length===token.recordIds.length&&current.recordIds.every((id,index)=>id===token.recordIds[index]);
}
function createFrozenFormDiagnosticSave(database,record,options){
  const fail=code=>({ok:false,code,frozen:null});
  if(!database||!Array.isArray(database.formAnalyses)||!database.settings||database.settings.formDebug!==true||!record||typeof record!=="object"||record.formDiagnosticVersion!==1||!["live","replay"].includes(record.captureMode)||!Number.isSafeInteger(record.shots)||record.shots<0||Object.hasOwn(record,"formDiagnosticMatrix")||!options||!Number.isSafeInteger(options.appVer)||options.appVer<=0||!options.saveOptions||typeof options.saveOptions!=="object"||typeof options.planMatrixRecord!=="function") return fail(database&&database.settings&&database.settings.formDebug!==true?"diagnostics-disabled":"invalid-record");
  const currentCoordinator=database.settings.formDiagnosticMatrixBatch;
  const prePlanCoordinatorToken=captureFormDiagnosticCoordinatorToken(currentCoordinator);
  let savedRecord=record,advancedCoordinator=null,matrixAdvanced=false;
  let matrixCode=record.captureMode==="replay"?"replay-excluded":record.shots===0?"zero-shot-excluded":"record-ineligible";
  if(record.captureMode==="live"&&record.shots===6){
    const planned=options.planMatrixRecord(record,currentCoordinator,options.appVer);
    if(planned&&planned.ok===true){ savedRecord=planned.record; advancedCoordinator=planned.coordinator; matrixAdvanced=true; matrixCode=null; }
    else matrixCode=(planned&&planned.code)||"record-ineligible";
  }
  const candidate={formAnalyses:database.formAnalyses.concat(savedRecord)};
  let coordinatorToken=null;
  if(matrixAdvanced){ coordinatorToken=prePlanCoordinatorToken; if(!coordinatorToken) return fail("coordinator-changed"); candidate.formDiagnosticMatrixBatch=advancedCoordinator; }
  return {ok:true,code:null,frozen:{candidate,record:savedRecord,matrixAdvanced,matrixCode,coordinatorToken,saveOptions:options.saveOptions,attempts:0,committed:false}};
}
function attemptFrozenFormDiagnosticSave(database,frozen,saveFn){
  const fail=(code,error)=>({ok:false,code,error:error||null});
  if(!frozen||typeof frozen!=="object"||!frozen.candidate||typeof saveFn!=="function") return fail("invalid-frozen",null);
  if(frozen.committed) return fail("already-committed",null);
  if(!database||!database.settings||database.settings.formDebug!==true) return fail("diagnostics-disabled",null);
  if(!formDiagnosticCoordinatorTokenMatches(database,frozen.coordinatorToken)) return fail("coordinator-changed",null);
  const committed=commitFormDiagnosticDbCandidate(database,frozen.candidate,frozen.saveOptions,saveFn);
  frozen.attempts++;
  if(!committed.ok) return fail("save-failed",committed.error);
  frozen.committed=true;
  return {ok:true,code:null,error:null};
}

function planFormAnalysisDeletionCandidate(database,recordId,trashEntry,appVer,trashLimit,invalidateFn){
  const fail=code=>({ok:false,code,record:null,candidate:null});
  if(!database||!Array.isArray(database.formAnalyses)||!Array.isArray(database.trash)||!database.settings||typeof database.settings!=="object"||typeof recordId!=="string"||!recordId||!trashEntry||typeof trashEntry!=="object"||trashEntry.type!=="formAnalysis"||!trashEntry.data||trashEntry.data.id!==recordId||!Number.isSafeInteger(appVer)||appVer<=0||!Number.isSafeInteger(trashLimit)||trashLimit<=0||typeof invalidateFn!=="function"){
    return fail("invalid-input");
  }
  const matches=database.formAnalyses.filter(record=>record&&record.id===recordId);
  if(matches.length===0) return fail("missing-record");
  if(matches.length!==1) return fail("ambiguous-record");

  const record=matches[0];
  const candidate={
    formAnalyses:database.formAnalyses.filter(item=>item!==record),
    trash:[trashEntry,...database.trash].slice(0,trashLimit)
  };
  const invalidated=invalidateFn(database.settings.formDiagnosticMatrixBatch,recordId,appVer);
  if(!invalidated||invalidated.ok!==true) return fail("invalidation-failed");
  if(invalidated.changed) candidate.formDiagnosticMatrixBatch=invalidated.coordinator;
  return {ok:true,code:null,record,candidate};
}
/* FORM_DIAGNOSTIC_TRANSACTION_END */

function copyFormPhaseDiagnosticsForRecord(formPhaseDiag,phaseCounts,receiptSnapshot){
  return {
    rejectedFramesNear:formPhaseDiag.rejectedFramesNear.map(item=>({...item})),
    canceledEvents:formPhaseDiag.canceledEvents.map(item=>({...item})),
    releaseFires:formPhaseDiag.releaseFires.map(item=>({...item,framesBefore:(item.framesBefore||[]).map(frame=>({...frame}))})),
    phaseHistogram:{...phaseCounts},
    releaseReceipts:receiptSnapshot.releaseReceipts.map(receipt=>({...receipt,fire:receipt.fire?{...receipt.fire}:null})),
    receiptOverflow:receiptSnapshot.receiptOverflow,
    receiptInvariantCounts:{...receiptSnapshot.receiptInvariantCounts},
    receiptDesynchronized:receiptSnapshot.desynchronized
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
    const recordId=b.dataset.delForm;
    let matches=(db.formAnalyses||[]).filter(record=>record&&record.id===recordId);
    if(matches.length!==1){
      toast("削除対象を一意に特定できないため、削除していません",6000);
      return;
    }
    if(!(await appConfirm("この射形記録を削除しますか？",{danger:true,okLabel:"削除"}))) return;

    matches=(db.formAnalyses||[]).filter(record=>record&&record.id===recordId);
    if(matches.length!==1){
      toast("削除対象を一意に特定できないため、削除していません",6000);
      return;
    }
    const record=matches[0];
    const trashEntry={
      id:uid(),
      type:"formAnalysis",
      label:`${fmtD(record.date)} 射形${record.shots||0}射`,
      data:cloneData(record),
      date:today(),
      ts:Date.now()
    };
    const planned=planFormAnalysisDeletionCandidate(
      db,recordId,trashEntry,APP_VER,TRASH_LIMIT,invalidateFormDiagnosticMatrixForRecord
    );
    if(!planned.ok){
      toast("削除対象を一意に特定できないため、削除していません",6000);
      return;
    }
    const committed=commitFormDiagnosticDbCandidate(
      db,planned.candidate,{reason:"delete-form-analysis",forceSnapshot:true},save
    );
    if(!committed.ok){
      toast("射形記録を保存できなかったため、削除していません",6000);
      return;
    }
    render();
    toast("削除しました。設定から復元できます");
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
  if(window.isSecureContext!==true){
    appConfirm(
      "ライブ撮影には信頼済みのHTTPS接続が必要です。この接続では、保存済み動画の解析を利用できます。",
      {
        title:"ライブ撮影を開始できません",
        cancelLabel:"閉じる",
        okLabel:"保存動画を選ぶ"
      }
    ).then(useReplay=>{ if(useReplay) openFormReplay(); });
    return;
  }
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
      <button class="btn sec sm" id="fcSwap" disabled>前/背面</button>
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
  let running=true, raf=0, stream=null, landmarker=null, receiptFailure=false;
  let inFlightStream=null;
  let cameraSwapReady=false;
  let cameraSwapInProgress=false;
  let history=[], detector=makeFormPhaseDetector(), ema=makeFormEma(0.38);
  const receiptTracker=makeFormReleaseReceiptTracker({maxDiagnosticReceipts:32});
  const tracker=receiptTracker;
  const velSrc=makeFormVelocitySource(); // A2 中立スキャフォールド: 既定は computeFormVelocity への pass-through
  let shots=[], frames=0, lastFpsAt=performance.now(), fps=0;
  const formPhaseDiag={rejectedFramesNear:[],canceledEvents:[],releaseFires:[]}; // 検証計装(H-2/Plan-0.2): formDebug時のみ push・保存
  let lastReleaseNow=0; // canceledEvents.tsAgo 算出用（release fire〜cancel の経過ms）
  /* Plan-0.2（release-detection-triage-2026-07-13 §3.3/§8）: 広域計装。
     lastAnchoringSampleAt=ANCHORINGフレーム間引き用、recentFrames=release fire時に
     releaseFiresへsnapshot化する直近フレームバッファ、phaseCounts=セッション全体のphase滞在カウント。
     いずれも db.settings.formDebug===true のときのみ蓄積・保存（判定ロジックには一切使わない）。 */
  let lastAnchoringSampleAt=0;
  let recentFrames=[]; // {ts, phase, ...debug}
  const RECENT_MAX=40; // fire ±20フレーム相当のバッファ
  const phaseCounts={SETUP:0,IDLE:0,ANCHORING:0,FULL_DRAW:0,RELEASE:0,FOLLOW:0};
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
  function freezeForReceiptFailure(){
    if(receiptFailure) return;
    receiptFailure=true;
    running=false;
    cameraSwapReady=false;
    if(raf){
      cancelAnimationFrame(raf);
      raf=0;
    }
    stopRec();
    const pendingStream=inFlightStream, activeStream=stream;
    inFlightStream=null;
    stream=null;
    video.srcObject=null;
    try{
      if(pendingStream) pendingStream.getTracks().forEach(track=>track.stop());
      if(activeStream&&activeStream!==pendingStream){
        activeStream.getTracks().forEach(track=>track.stop());
      }
    }catch(e){}
    ["#fcSwap", "#fcHand", "#fcCrop", "#fcRec"].forEach(selector=>{
      const control=ovl.querySelector(selector);
      if(control) control.disabled=true;
    });
    hud.textContent="射の識別状態を継続できません。結果を保存するか、この画面を閉じて解析をやり直してください。";
  }
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

  function discardCameraStream(candidate){
    try{ if(candidate) candidate.getTracks().forEach(t=>t.stop()); }catch(e){}
    if(video.srcObject===candidate) video.srcObject=null;
    if(inFlightStream===candidate) inFlightStream=null;
  }
  let captureFrozen=false,captureTornDown=false,hadRecorderAtFreeze=false;
  function freezeCaptureForSave(){
    if(captureFrozen) return false;
    captureFrozen=true; running=false;
    if(raf){ cancelAnimationFrame(raf); raf=0; }
    if(pendingCheck) finalizeArrowCheck();
    hadRecorderAtFreeze=!!recorder; stopRec();
    const pendingStream=inFlightStream,activeStream=stream;
    inFlightStream=null; stream=null; video.srcObject=null;
    try{ if(pendingStream) pendingStream.getTracks().forEach(t=>t.stop()); if(activeStream&&activeStream!==pendingStream) activeStream.getTracks().forEach(t=>t.stop()); }catch(e){}
    cameraSwapReady=false;
    ["#fcSwap","#fcHand","#fcCrop","#fcRec"].forEach(selector=>{ const control=ovl.querySelector(selector); if(control) control.disabled=true; });
    ovl.querySelectorAll("[data-rm-shot]").forEach(button=>button.disabled=true);
    const saveButton=ovl.querySelector("#fcSave"); if(saveButton) saveButton.disabled=true;
    return true;
  }
  function finishCapture(){
    if(captureTornDown) return false;
    captureTornDown=true; freezeCaptureForSave();
    if(db.active) wakeLock.acquire(); else wakeLock.release();
    endActiveWorkflow(); closeModal(ovl); return true;
  }
  async function offerRecordedVideoAfterSave(){
    if(!hadRecorderAtFreeze) return;
    await new Promise(resolve=>setTimeout(resolve,200));
    if(!recBlob) return;
    if(await appConfirm("トラッキング動画をカメラロールに保存しますか？",{okLabel:"保存する"})) await shareRec(); else recBlob=null;
  }
  async function startCamera(){
    if(!running) return false;
    let nextStream=null;
    try{
      nextStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1280},height:{ideal:720}},audio:false});
      inFlightStream=nextStream;
      if(!running||inFlightStream!==nextStream){ discardCameraStream(nextStream); return false; }
      video.srcObject=nextStream;
      await video.play();
      if(!running||inFlightStream!==nextStream){ discardCameraStream(nextStream); return false; }
      canvas.width=video.videoWidth; canvas.height=video.videoHeight;
      stream=nextStream;
      inFlightStream=null;
      return true;
    }catch(e){
      discardCameraStream(nextStream);
      if(!running) return false;
      throw e;
    }
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
  function applyReceiptCancellation(action){
    const target=action&&action.deletionTarget;
    if(!target) return;
    shots=shots.filter(shot=>shot.id!==target);
    const div=ovl.querySelector(`#fcShots [data-shot-id="${target}"]`);
    if(div) div.remove();
    if(pendingCheck&&pendingCheck.shotId===target) pendingCheck=null;
    renumberShots();
    refreshShotsHint();
  }
  function abandonActiveReceipt(reason){
    if(receiptTracker.current()) receiptTracker.abandon(reason);
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
  function onShot(receiptId,now,anchorStartTs,activeAnchorEnter,debug){
    const shot=summarizeFormShot(history,anchorStartTs,now,activeAnchorEnter);
    if(!shot) return null;
    shot.id=receiptId;
    shot.arrowCheck=null; // 確定猶予窓の計測後に judgeArrowCheck の結果を書き込む（シャドー）
    shot.diag=(db.settings.formDebug===true&&debug)?debug:null; // 検証計装（H）: 既定OFF
    shots.push(shot);
    receiptTracker.markShotCreated(receiptId);
    const div=document.createElement("div");
    div.className="listItem recordReadOnlyItem";
    div.dataset.shotId=shot.id;
    div.innerHTML=`<div><div class="t">第${shots.length}射</div>
      <div class="d" data-shot-desc>保持 ${(shot.holdMs/1000).toFixed(1)}秒${shot.pre&&(shot.pre.bowDrift||shot.pre.drawDrift)?` / ${icon("warn")} リリース前ドリフト`:""}</div></div>
      <div class="big">${shot.angles.bowArm!=null?shot.angles.bowArm.toFixed(0)+"°":"—"}<small> / 引き手${shot.angles.drawArm!=null?shot.angles.drawArm.toFixed(0)+"°":"—"}</small></div>
      <button class="btn sm ghost" data-rm-shot="${esc(shot.id)}" aria-label="この射を取り消す">${icon("del")}</button>`;
    div.querySelector("[data-rm-shot]").onclick=()=>{
      receiptTracker.manualRemove(shot.id);
      shots=shots.filter(candidate=>candidate.id!==shot.id);
      if(pendingCheck&&pendingCheck.shotId===shot.id) pendingCheck=null;
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
  function resetCaptureGeometry(){
    abandonActiveReceipt("geometry-reset");
    if(pendingCheck) finalizeArrowCheck();
    detector=makeFormPhaseDetector();
    ema=makeFormEma(0.38);
    history=[];
    velSrc.reset();
    presenceRing=[];
    pendingCheck=null;
    recentFrames=[];
    lastAnchoringSampleAt=0;
  }
  function loop(){
    if(!running) return;
    if(landmarker && !cameraSwapInProgress && stream && stream.getVideoTracks().some(t=>t.readyState==="live") && video.srcObject===stream && video.readyState>=2){
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
      const vel=velSrc.step(history,raw,now);
      history.push({ts:now,m:raw,vel});
      if(history.length>200) history.shift();
      const hadPendingRelease=detector.pendingRelease!=null;
      const result=stepFormPhase(detector,raw,history,1.0,now);
      const {phase,released,canceled,debug,anchorStartTs}=result;
      const releaseFire=result.released&&db.settings.formDebug===true?copyFormReleaseFireSnapshot(result.debug):null;
      let releaseAction=null;
      let releasedShotId=null;
      let releasedPreScores=null;
      if(result.canceled){
        const action=receiptTracker.cancel(debug&&debug.cancelReason);
        if(db.settings.formDebug===true){
          formDiagPush(formPhaseDiag.canceledEvents,{ts:now,reason:(debug&&debug.cancelReason)||null,anchorNorm:debug?debug.anchorNorm:null,tsAgo:now-lastReleaseNow,shotId:action.id},200);
        }
        applyReceiptCancellation(action);
      }else if(result.released){
        releaseAction=receiptTracker.begin({fireTs:now,fire:releaseFire});
        if(releaseAction.fatal){
          freezeForReceiptFailure();
        }else{
          lastReleaseNow=now;
          releasedPreScores=presenceRing.map(point=>point.score);
          const action=releaseAction;
          const shotId=onShot(action.id,now,anchorStartTs,result.anchorEnter,debug);
          releasedShotId=shotId;
        }
      }else if(hadPendingRelease&&detector.pendingRelease==null){
        receiptTracker.confirm();
      }
      /* Plan-0.2（release-detection-triage-2026-07-13 §3.3/§8）: debugが返る全フレームで
         recentFrames（release fire snapshot用バッファ）とphaseCounts（session全体の
         phase滞在ヒストグラム）を更新する。判定ロジックには一切使わない。 */
      if(db.settings.formDebug===true&&debug){
        recentFrames.push({ts:now,phase,...debug});
        if(recentFrames.length>RECENT_MAX) recentFrames.shift();
        phaseCounts[phase]=(phaseCounts[phase]||0)+1;
      }
      /* 検証計装(H-2 → Plan-0.2, release-detection-triage-2026-07-13 §3.3): RELEASEを
         出しそうで出ていないフレーム（release momentの前後を捉える）。実測
         rejectedFramesNear:[]（FULL_DRAW未到達で4/6射が消失）を受け、FULL_DRAWだけでなく
         ANCHORINGも対象にする。ANCHORINGは常時発生しうるため100ms毎に間引いてサイズを抑える。 */
      if(db.settings.formDebug===true&&debug){
        /* 2026-07-15 拡張: 誤配置アンカーは DRAWING/SETUP とラベルされるためフェーズ限定の
           捕捉では診断に写らない。フェーズ不問で (a) スパイク (maxV>4) と (b) 緩アンカー保持
           (anchorNorm<CLOSE_LOOSE、100ms間引き) を捕捉する */
        const isSpike=debug.maxV!=null&&debug.maxV>4;
        const isCloseHold=phase==="FULL_DRAW"&&debug.closeFrames>=1;
        const isHold=(phase==="ANCHORING"||(debug.anchorNorm!=null&&debug.anchorNorm<FORM_PH.CLOSE_LOOSE))&&(now-(lastAnchoringSampleAt||0)>=100);
        if(isSpike||isCloseHold||isHold){
          if(isHold) lastAnchoringSampleAt=now;
          formDiagPush(formPhaseDiag.rejectedFramesNear,{ts:now,phase,...debug},400);
        }
      }
      /* 矢プレゼンスのシャドー計測: アンカー保持中（anchorStartTs非null、T-Anchor §12.3）と
        確定猶予窓のみ ROI を処理する（常時処理しないことでモバイル負荷を抑える）。
        以前は phase==="FULL_DRAW" を条件にしていたが、FULL_DRAW 昇格は FULLDRAW_MS(350ms)
        連続保持を要求する一方、RELEASE 発火はそれより大幅に緩い条件で起こり得るため、
        ホールドが短い射では presenceRing が一度も積まれず preScore が恒常的に null に
        なっていた（arrowcheck-investigation-2026-07-10.md 観点1）。released フレーム自体は
        除外する（返り値の anchorStartTs はクリア前の値だが、検出器内部では保持は終了しており、
        離れ動作中のフレームを preScores に混ぜない。旧 FULL_DRAW 条件でも RELEASE フレームは
        蓄積対象外だった）。1フレームあたりの処理時間を report用に実測・記録する（先頭200件のみ保持）。 */
      const anchorHeld=!!anchorStartTs&&!released;
      if(anchorHeld||pendingCheck){
        const t0=performance.now();
        const presenceScore=raw?sampleArrowPresence(raw):null;
        const dt=performance.now()-t0;
        if(samplePerfMs.length<200) samplePerfMs.push(dt);
        if(anchorHeld&&presenceScore!=null){
          presenceRing.push({ts:now,score:presenceScore});
          const cutoff=now-1500;
          while(presenceRing.length&&presenceRing[0].ts<cutoff) presenceRing.shift();
        }
        if(pendingCheck){
          if(presenceScore!=null) pendingCheck.confirmScores.push(presenceScore);
          if(now-pendingCheck.startTs>=FORM_PH.CONFIRM_MS) finalizeArrowCheck();
        }
      }
      if(releaseAction&&!releaseAction.fatal){
        if(db.settings.formDebug===true){
          formDiagPush(formPhaseDiag.releaseFires,{ts:now,shotId:releaseAction.id,framesBefore:recentFrames.slice(0,-1).slice(-20)},32);
        }
        if(releasedShotId){
          pendingCheck={shotId:releasedShotId,preScores:releasedPreScores,confirmScores:[],startTs:now};
        }
      }
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
      const lowFpsHtml=(fps>0&&fps<15)?`<br>${icon("warn")} フレームレート低下中（${fps.toFixed(0)}fps）: この端末では検出精度が落ちます`:""; // 提案G2
      if(raw&&disp){
        hud.innerHTML=`FPS <b>${fps.toFixed(0)}</b> ・ 検出の鮮明さ <b>${Math.round(disp.conf*100)}%</b> ・ 弓手肘 <b>${disp.bowArm.toFixed(0)}°</b> ・ 引き手肘 <b>${disp.drawArm.toFixed(0)}°</b>${raw.occluded.length?`<br>${icon("warn")} 検出低下: ${raw.occluded.map(esc).join("・")}`:""}${lowFpsHtml}`;
      }else{
        hud.innerHTML=`FPS <b>${fps.toFixed(0)}</b> ・ 人物を検出中…（横向き全身が写る位置に置いてください）${lowFpsHtml}`;
      }
    }
    raf=requestAnimationFrame(loop);
  }
  function buildLiveFormRecord(includeDiagnostics,trackerSnapshot,zeroShot){
    const todays=db.sessions.filter(s=>s.date===today()),linked=todays.length?todays[todays.length-1]:null;
    const record={id:uid(),date:today(),ts:Date.now(),sessionId:linked?linked.id:null,setupId:linked?linked.setupId||null:null,shots:zeroShot?0:shots.length,modelVer:"pose_landmarker_lite v1 (tasks-vision 0.10.14)",appVer:APP_VER,fps:+fps.toFixed(1),features:zeroShot?[]:shots.map(shot=>formFeatureFromShot(shot,includeDiagnostics)),note:zeroShot?"(診断用: 0射で保存)":""};
    if(!includeDiagnostics) return {record,linked};
    record.formDiagnosticVersion=1; record.captureMode="live"; record.diag=formDiagSummary(zeroShot?[]:shots,samplePerfMs);
    record.formPhaseDiag=copyFormPhaseDiagnosticsForRecord(formPhaseDiag,phaseCounts,trackerSnapshot);
    return {record,linked};
  }
  let frozenDiagnosticSave=null,frozenDiagnosticLinked=null;
  function prepareLiveDiagnosticSave(zeroShot){
    if(frozenDiagnosticSave) return {ok:true,code:null,frozen:frozenDiagnosticSave,linked:frozenDiagnosticLinked};
    freezeCaptureForSave(); if(tracker.current()) tracker.abandon("workflow-save");
    const trackerSnapshot=tracker.snapshot();
    const built=buildLiveFormRecord(true,trackerSnapshot,zeroShot);
    const created=createFrozenFormDiagnosticSave(db,built.record,{appVer:APP_VER,saveOptions:{reason:zeroShot?"form-analysis-diag-only":"form-analysis"},planMatrixRecord:planFormDiagnosticMatrixRecord});
    if(created.ok){ frozenDiagnosticSave=created.frozen; frozenDiagnosticLinked=built.linked; }
    return {...created,linked:built.linked};
  }
  function attemptLiveDiagnosticSave(zeroShot){ const prepared=prepareLiveDiagnosticSave(zeroShot); return !prepared.ok?{result:prepared,linked:prepared.linked}:{result:attemptFrozenFormDiagnosticSave(db,frozenDiagnosticSave,save),linked:prepared.linked}; }
  /* Plan-0.2 D（release-detection-triage-2026-07-13 §8）: shots:0 でも診断保存できるように
     する。UIボタンは増やさず、formDebug ON時のみ close ボタンの動作を「診断用に保存してから
     閉じる」へ切替える（採用理由: 通常ユーザー(formDebug OFF)の close 挙動を完全に不変のまま
     保ちつつ、UI追加コストを避ける。判断は完了報告に明記）。 */
  async function finishLiveDiagnosticAttempt(zeroShot){
    const {result,linked}=attemptLiveDiagnosticSave(zeroShot),saveButton=ovl.querySelector("#fcSave");
    if(!result.ok){ hud.textContent=result.code==="diagnostics-disabled"||result.code==="coordinator-changed"?"診断設定または18射バッチが変わったため、保存を再試行できません。":"診断を保存できませんでした。保存を再試行するか、閉じて破棄してください。"; saveButton.disabled=false; saveButton.textContent="保存を再試行"; return false; }
    toast(zeroShot?"診断用に0射で保存しました":linked?`射形記録を保存し、今日の練習に紐付けました（${shots.length}射）`:`射形記録を保存しました（${shots.length}射）`);
    nativePulse("success"); finishCapture(); render(); await offerRecordedVideoAfterSave(); return true;
  }
  ovl.querySelector("#fcClose").onclick=async()=>{
    if(frozenDiagnosticSave&&!frozenDiagnosticSave.committed){ const discard=await appConfirm("保存できていない診断を破棄して閉じますか？",{danger:true,okLabel:"破棄して閉じる"}); if(!discard) return; frozenDiagnosticSave=null; finishCapture(); return; }
    if(!shots.length&&db.settings.formDebug===true){ await finishLiveDiagnosticAttempt(true); return; }
    if(!shots.length){ abandonActiveReceipt("workflow-close"); finishCapture(); return; }
    if(await appConfirm(`${shots.length}射の解析結果を保存せずに閉じますか？`,{danger:true,okLabel:"閉じる"})){ abandonActiveReceipt("workflow-close"); finishCapture(); }
  };
  ovl.querySelector("#fcSave").onclick=async()=>{
    if(frozenDiagnosticSave){ await finishLiveDiagnosticAttempt(frozenDiagnosticSave.record.shots===0); return; }
    if(db.settings.formDebug===true){ await finishLiveDiagnosticAttempt(shots.length===0); return; }
    if(!shots.length) return;
    if(tracker.current()) tracker.abandon("workflow-save");
    const {record:rec,linked}=buildLiveFormRecord(false,null,false);
    db.formAnalyses=db.formAnalyses||[];
    /* 検証計装（H）: db.settings.formDebug===true のときだけ arrowCheck分布とsamplePerfMsの
       中央値/最大値をレコードへ添える（既定OFF、ストレージ肥大防止）。前方互換の追加フィールド */
    db.formAnalyses.push(rec);
    save({reason:"form-analysis"});
    toast(linked?`射形記録を保存し、今日の練習に紐付けました（${shots.length}射）`:`射形記録を保存しました（${shots.length}射）`);
    nativePulse("success");
    finishCapture(); render(); await offerRecordedVideoAfterSave();
  };
  ovl.querySelector("#fcSwap").onclick=async()=>{
    if(!cameraSwapReady||cameraSwapInProgress) return;
    cameraSwapInProgress=true;
    const previousFacing=facing;
    facing=facing==="environment"?"user":"environment";
    resetCaptureGeometry();
    const oldStream=stream;
    stream=null;
    video.srcObject=null;
    try{
      if(oldStream) oldStream.getTracks().forEach(t=>t.stop());
      const cameraStarted=await startCamera();
      if(!cameraStarted){ if(running) facing=previousFacing; return; }
    }
    catch(e){ facing=previousFacing; hud.textContent="カメラを切り替えられませんでした: "+e.message; }
    finally{ cameraSwapInProgress=false; }
  };
  ovl.querySelector("#fcHand").onclick=e=>{
    handedness=handedness==="right"?"left":"right";
    db.settings.formHandedness=handedness; save();
    e.target.textContent="利き手: "+(handedness==="right"?"右":"左");
    resetCaptureGeometry();
  };
  ovl.querySelector("#fcCrop").onclick=e=>{
    cropActive=!cropActive;
    e.currentTarget.setAttribute("aria-pressed",String(cropActive));
    e.currentTarget.classList.toggle("active",cropActive);
    resetCaptureGeometry();
    nativePulse("light");
  };
  ovl.querySelector("#fcRec").onclick=e=>{
    const btn=e.currentTarget;
    if(recorder){ stopRec(); btn.setAttribute("aria-pressed","false"); btn.classList.remove("active"); toast("録画を停止しました"); }
    else{ startRec(); btn.setAttribute("aria-pressed","true"); btn.classList.add("active"); toast("録画中…保存時にカメラロールへ保存できます"); }
    nativePulse("light");
  };
  loadFormPose().then(async lm=>{
    if(!running) return;
    landmarker=lm;
    hud.textContent="カメラを起動しています…";
    const cameraStarted=await startCamera();
    if(!cameraStarted) return;
    cameraSwapReady=true;
    ovl.querySelector("#fcSwap").disabled=false;
    wakeLock.acquire();
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
  let running=true, raf=0, landmarker=null, receiptFailure=false;
  let history=[], detector=makeFormPhaseDetector(), ema=makeFormEma(0.38);
  const receiptTracker=makeFormReleaseReceiptTracker({maxDiagnosticReceipts:32});
  const tracker=receiptTracker;
  const velSrc=makeFormVelocitySource(); // A2 中立スキャフォールド: 既定は computeFormVelocity への pass-through
  let shots=[], frames=0, lastFpsAt=performance.now(), fps=0, lastDetectTs=-1;
  const formPhaseDiag={rejectedFramesNear:[],canceledEvents:[],releaseFires:[]}; // 検証計装(H-2/Plan-0.2): formDebug時のみ push・保存
  let lastReleaseNow=0; // canceledEvents.tsAgo 算出用（release fire〜cancel の経過ms）
  /* Plan-0.2（release-detection-triage-2026-07-13 §3.3/§8）: 広域計装（capture側と同型）。 */
  let lastAnchoringSampleAt=0;
  let recentFrames=[]; // {ts, phase, ...debug}
  const RECENT_MAX=40; // fire ±20フレーム相当のバッファ
  const phaseCounts={SETUP:0,IDLE:0,ANCHORING:0,FULL_DRAW:0,RELEASE:0,FOLLOW:0};
  let replayFrozen=false,replayTornDown=false;
  function freezeReplayForSave(){
    if(replayFrozen) return false;
    replayFrozen=true; running=false;
    if(raf){ cancelAnimationFrame(raf); raf=0; }
    try{ video.pause(); }catch(e){}
    const hand=ovl.querySelector("#frHand"),saveButton=ovl.querySelector("#frSave");
    if(hand) hand.disabled=true; if(saveButton) saveButton.disabled=true;
    return true;
  }
  function finishReplay(){
    if(replayTornDown) return false;
    replayTornDown=true; freezeReplayForSave(); URL.revokeObjectURL(videoUrl); endActiveWorkflow(); closeModal(ovl); return true;
  }
  function freezeForReceiptFailure(){
    if(receiptFailure) return;
    receiptFailure=true;
    running=false;
    if(raf){
      cancelAnimationFrame(raf);
      raf=0;
    }
    try{ video.pause(); }catch(e){}
    const hand=ovl.querySelector("#frHand");
    if(hand) hand.disabled=true;
    hud.textContent="射の識別状態を継続できません。結果を保存するか、この画面を閉じて解析をやり直してください。";
  }
  function refreshSave(){
    const b=ovl.querySelector("#frSave");
    b.disabled=!shots.length;
    b.textContent=shots.length?`保存して終了（${shots.length}射）`:"保存して終了";
  }
  function renumberShots(){
    ovl.querySelectorAll("#frShots [data-shot-id]").forEach((div,i)=>{
      const idx=shots.length-1-i; // 一覧は新しい射が先頭（prepend）
      const t=div.querySelector(".t");
      if(t) t.textContent=`第${idx+1}射`;
    });
  }
  function applyReceiptCancellation(action){
    const target=action&&action.deletionTarget;
    if(!target) return;
    shots=shots.filter(shot=>shot.id!==target);
    const div=ovl.querySelector(`#frShots [data-shot-id="${target}"]`);
    if(div) div.remove();
    renumberShots();
    refreshSave();
  }
  function abandonActiveReceipt(reason){
    if(receiptTracker.current()) receiptTracker.abandon(reason);
  }
  function onShot(receiptId,now,anchorStartTs,activeAnchorEnter,debug){
    const shot=summarizeFormShot(history,anchorStartTs,now,activeAnchorEnter);
    if(!shot) return null;
    shot.id=receiptId; shot.arrowCheck=null; shot.diag=(db.settings.formDebug===true&&debug)?debug:null; shots.push(shot);
    receiptTracker.markShotCreated(receiptId);
    const div=document.createElement("div");
    div.className="listItem recordReadOnlyItem"; div.dataset.shotId=shot.id;
    div.innerHTML=`<div><div class="t">第${shots.length}射</div>
      <div class="d">保持 ${(shot.holdMs/1000).toFixed(1)}秒${shot.pre&&(shot.pre.bowDrift||shot.pre.drawDrift)?` / ${icon("warn")} リリース前ドリフト`:""}</div></div>
      <div class="big">${shot.angles.bowArm!=null?shot.angles.bowArm.toFixed(0)+"°":"—"}<small> / 引き手${shot.angles.drawArm!=null?shot.angles.drawArm.toFixed(0)+"°":"—"}</small></div>`;
    ovl.querySelector("#frShots").prepend(div);
    refreshSave(); nativePulse("light");
    return shot.id; // Plan-0.2 Block B: releaseFires への shotId 紐付けに使う（既存呼び出し側の挙動は不変）
  }
  function loop(){
    if(!running) return;
    if(landmarker&&video.readyState>=2&&!video.paused&&!video.ended){
      const now=video.currentTime*1000;
      if(now>lastDetectTs){
        /* video.currentTime が前フレームから進まない（60fps rAF vs 30fps 動画などで容易に起こる）
           と同一/逆行タイムスタンプが MediaPipe の CalculatorGraph に渡り、
           "Packet timestamp mismatch"（単調増加違反）で以後の detectForVideo が
           恒久的に失敗し続ける。単調増加を保証してスキップすることで重複回避と
           無駄な推論の削減を両立する。 */
        lastDetectTs=now;
        let res;
        try{
          res=landmarker.detectForVideo(video,now);
        }catch(e){
          running=false;
          phaseEl.textContent="エラー";
          hud.textContent="解析に失敗しました。動画を閉じてやり直してください（"+(e&&e.message||String(e))+"）";
          return;
        }
        frames++;
        const wallNow=performance.now();
        if(wallNow-lastFpsAt>=1000){ fps=frames*1000/(wallNow-lastFpsAt); frames=0; lastFpsAt=wallNow; }
        const lms=res.landmarks&&res.landmarks[0];
        const raw=lms?computeFormMetrics(lms,handedness):null;
        const disp=ema(raw);
        const vel=velSrc.step(history,raw,now);
        history.push({ts:now,m:raw,vel});
        if(history.length>200) history.shift();
        const hadPendingRelease=detector.pendingRelease!=null;
        const result=stepFormPhase(detector,raw,history,1.0,now);
        const {phase,released,canceled,debug}=result;
        const releaseFire=result.released&&db.settings.formDebug===true?copyFormReleaseFireSnapshot(result.debug):null;
        if(result.canceled){
          const action=receiptTracker.cancel(debug&&debug.cancelReason);
          if(db.settings.formDebug===true){
            formDiagPush(formPhaseDiag.canceledEvents,{ts:now,reason:(debug&&debug.cancelReason)||null,anchorNorm:debug?debug.anchorNorm:null,tsAgo:now-lastReleaseNow,shotId:action.id},200);
          }
          applyReceiptCancellation(action);
        }else if(result.released){
          const action=receiptTracker.begin({fireTs:now,fire:releaseFire});
          if(action.fatal){
            freezeForReceiptFailure();
          }else{
            lastReleaseNow=now;
            const shotId=onShot(action.id,now,result.anchorStartTs,result.anchorEnter,debug);
            if(db.settings.formDebug===true){
              formDiagPush(formPhaseDiag.releaseFires,{ts:now,shotId:action.id,framesBefore:recentFrames.slice(0,-1).slice(-20)},32);
            }
          }
        }else if(hadPendingRelease&&detector.pendingRelease==null){
          receiptTracker.confirm();
        }
        /* Plan-0.2（release-detection-triage-2026-07-13 §3.3/§8）: debugが返る全フレームで
           recentFrames（release fire snapshot用バッファ）とphaseCounts（session全体の
           phase滞在ヒストグラム）を更新する。判定ロジックには一切使わない。 */
        if(db.settings.formDebug===true&&debug){
          recentFrames.push({ts:now,phase,...debug});
          if(recentFrames.length>RECENT_MAX) recentFrames.shift();
          phaseCounts[phase]=(phaseCounts[phase]||0)+1;
        }
        /* 検証計装(H-2 → Plan-0.2, release-detection-triage-2026-07-13 §3.3): RELEASEを
           出しそうで出ていないフレーム。FULL_DRAWだけでなくANCHORINGも対象にし、ANCHORINGは
           100ms毎に間引く（capture側と同型）。 */
        if(db.settings.formDebug===true&&debug){
          /* 2026-07-15 拡張: 誤配置アンカーは DRAWING/SETUP とラベルされるためフェーズ限定の
             捕捉では診断に写らない。フェーズ不問で (a) スパイク (maxV>4) と (b) 緩アンカー保持
             (anchorNorm<CLOSE_LOOSE、100ms間引き) を捕捉する */
          const isSpike=debug.maxV!=null&&debug.maxV>4;
          const isCloseHold=phase==="FULL_DRAW"&&debug.closeFrames>=1;
          const isHold=(phase==="ANCHORING"||(debug.anchorNorm!=null&&debug.anchorNorm<FORM_PH.CLOSE_LOOSE))&&(now-(lastAnchoringSampleAt||0)>=100);
          if(isSpike||isCloseHold||isHold){
            if(isHold) lastAnchoringSampleAt=now;
            formDiagPush(formPhaseDiag.rejectedFramesNear,{ts:now,phase,...debug},400);
          }
        }
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
    }
    if(video.ended&&running){
      abandonActiveReceipt("replay-eos");
      phaseEl.textContent="完了";
      hud.innerHTML=`解析完了 ・ ${shots.length}射を検出しました`;
      running=false; return;
    }
    raf=requestAnimationFrame(loop);
  }
  function buildReplayFormRecord(includeDiagnostics,trackerSnapshot,zeroShot){
    const todays=db.sessions.filter(s=>s.date===today()),linked=todays.length?todays[todays.length-1]:null;
    const record={id:uid(),date:today(),ts:Date.now(),sessionId:linked?linked.id:null,setupId:linked?linked.setupId||null:null,shots:zeroShot?0:shots.length,modelVer:"pose_landmarker_lite v1 (tasks-vision 0.10.14)",appVer:APP_VER,fps:+fps.toFixed(1),features:zeroShot?[]:shots.map(shot=>formFeatureFromShot(shot,includeDiagnostics)),note:zeroShot?"(診断用: 0射で保存/保存済み動画)":"(保存済み動画から解析)"};
    if(!includeDiagnostics) return {record,linked};
    record.formDiagnosticVersion=1; record.captureMode="replay"; record.formPhaseDiag=copyFormPhaseDiagnosticsForRecord(formPhaseDiag,phaseCounts,trackerSnapshot);
    return {record,linked};
  }
  let frozenDiagnosticSave=null,frozenDiagnosticLinked=null;
  function prepareReplayDiagnosticSave(zeroShot){
    if(frozenDiagnosticSave) return {ok:true,code:null,frozen:frozenDiagnosticSave,linked:frozenDiagnosticLinked};
    freezeReplayForSave(); if(tracker.current()) tracker.abandon("workflow-save");
    const trackerSnapshot=tracker.snapshot();
    const built=buildReplayFormRecord(true,trackerSnapshot,zeroShot);
    const created=createFrozenFormDiagnosticSave(db,built.record,{appVer:APP_VER,saveOptions:{reason:zeroShot?"form-analysis-diag-only":"form-analysis"},planMatrixRecord:planFormDiagnosticMatrixRecord});
    if(created.ok){ frozenDiagnosticSave=created.frozen; frozenDiagnosticLinked=built.linked; }
    return {...created,linked:built.linked};
  }
  function attemptReplayDiagnosticSave(zeroShot){ const prepared=prepareReplayDiagnosticSave(zeroShot); return !prepared.ok?{result:prepared,linked:prepared.linked}:{result:attemptFrozenFormDiagnosticSave(db,frozenDiagnosticSave,save),linked:prepared.linked}; }
  /* Plan-0.2 D（release-detection-triage-2026-07-13 §8）: shots:0 でも診断保存できるように
     する（capture側と同型。採用理由は同関数のcapture側コメント参照）。 */
  function saveDiagOnlyRecord(){
    const todays=db.sessions.filter(s=>s.date===today());
    const linked=todays.length?todays[todays.length-1]:null;
    db.formAnalyses=db.formAnalyses||[];
    const receiptSnapshot=tracker.snapshot();
    const includeDiagnostics=db.settings.formDebug===true;
    const rec={
      id:uid(), date:today(), ts:Date.now(), sessionId:linked?linked.id:null, setupId:linked?linked.setupId||null:null,
      shots:0, modelVer:"pose_landmarker_lite v1 (tasks-vision 0.10.14)",
      appVer:APP_VER, fps:+fps.toFixed(1),
      features:[], note:"(診断用: 0射で保存/保存済み動画)"
    };
    if(includeDiagnostics){
      rec.formDiagnosticVersion=1;
      rec.captureMode="replay";
      rec.formPhaseDiag=copyFormPhaseDiagnosticsForRecord(formPhaseDiag,phaseCounts,receiptSnapshot);
    }
    db.formAnalyses.push(rec);
    save({reason:"form-analysis-diag-only"});
    toast("診断用に0射で保存しました");
  }
  function finishReplayDiagnosticAttempt(zeroShot){
    const {result,linked}=attemptReplayDiagnosticSave(zeroShot),saveButton=ovl.querySelector("#frSave");
    if(!result.ok){ hud.textContent=result.code==="diagnostics-disabled"||result.code==="coordinator-changed"?"診断設定または18射バッチが変わったため、保存を再試行できません。":"診断を保存できませんでした。保存を再試行するか、閉じて破棄してください。"; saveButton.disabled=false; saveButton.textContent="保存を再試行"; return false; }
    toast(zeroShot?"診断用に0射で保存しました":linked?`射形記録を保存し、今日の練習に紐付けました（${shots.length}射）`:`射形記録を保存しました（${shots.length}射）`);
    nativePulse("success"); finishReplay(); render(); return true;
  }
  ovl.querySelector("#frClose").onclick=async()=>{
    if(frozenDiagnosticSave&&!frozenDiagnosticSave.committed){ const discard=await appConfirm("保存できていない診断を破棄して閉じますか？",{danger:true,okLabel:"破棄して閉じる"}); if(!discard) return; frozenDiagnosticSave=null; finishReplay(); return; }
    if(!shots.length&&db.settings.formDebug===true){ finishReplayDiagnosticAttempt(true); return; }
    if(!shots.length){ abandonActiveReceipt("workflow-close"); finishReplay(); return; }
    if(await appConfirm(`${shots.length}射の解析結果を保存せずに閉じますか？`,{danger:true,okLabel:"閉じる"})){ abandonActiveReceipt("workflow-close"); finishReplay(); }
  };
  ovl.querySelector("#frSave").onclick=()=>{
    if(frozenDiagnosticSave){ finishReplayDiagnosticAttempt(frozenDiagnosticSave.record.shots===0); return; }
    if(db.settings.formDebug===true){ finishReplayDiagnosticAttempt(shots.length===0); return; }
    if(!shots.length) return;
    const todays=db.sessions.filter(s=>s.date===today());
    const linked=todays.length?todays[todays.length-1]:null;
    db.formAnalyses=db.formAnalyses||[];
    const includeDiagnostics=false;
    const rec={
      id:uid(), date:today(), ts:Date.now(), sessionId:linked?linked.id:null, setupId:linked?linked.setupId||null:null,
      shots:shots.length, modelVer:"pose_landmarker_lite v1 (tasks-vision 0.10.14)",
      appVer:APP_VER, fps:+fps.toFixed(1),
      features:shots.map(shot=>formFeatureFromShot(shot,includeDiagnostics)), note:"(保存済み動画から解析)"
    };
    /* 検証計装（H-2, release-detection-triage-2026-07-13 Plan-0）: 非発火/取消フレームの集約。
       formDebug フラグでのみ保存（OFF時は既存と同一サイズ）。前方互換の追加フィールド */
    db.formAnalyses.push(rec);
    save({reason:"form-analysis"});
    toast(linked?`射形記録を保存し、今日の練習に紐付けました（${shots.length}射）`:`射形記録を保存しました（${shots.length}射）`);
    nativePulse("success"); finishReplay(); render();
  };
  ovl.querySelector("#frHand").onclick=e=>{
    handedness=handedness==="right"?"left":"right";
    db.settings.formHandedness=handedness; save();
    e.target.textContent="利き手: "+(handedness==="right"?"右":"左");
    abandonActiveReceipt("geometry-reset");
    detector=makeFormPhaseDetector(); ema=makeFormEma(0.38); history=[]; velSrc.reset();
  };
  loadFormPose().then(async lm=>{
    if(!running) return;
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
