"use strict";
/* Archery Note: record and active-session views */
/* ============ views ============ */
let view="record";
let ui={ selArrow:-1, sightSel:{setupId:null, dist:70}, histOpen:null, histFilter:{setupId:"",dist:"",round:""}, analysisFilter:{setupId:"",dist:"",round:"",period:"all"}, zoom:1, recordMode:"practice", freshArrow:-1, freshTimer:0 };
function showView(v){ if(view===v) return; view=v; ui.selArrow=-1; nativePulse("light"); render(); }
document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>showView(b.dataset.v));

function render(){
  updateAppChrome();
  if(typeof syncUpdateBarVisibility==="function") syncUpdateBarVisibility();
  const tabs=Array.prototype.slice.call(document.querySelectorAll("#tabs button"));
  const activeIndex=Math.max(0,tabs.findIndex(b=>b.dataset.v===view));
  const tabBar=$("#tabs");
  if(tabBar){
    tabBar.style.setProperty("--active-tab", activeIndex);
    tabBar.style.setProperty("--tab-count", tabs.length||1);
  }
  tabs.forEach(b=>{
    const on=b.dataset.v===view;
    b.classList.toggle("on",on);
    if(on) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current");
  });
  const m=$("#main");
  if(view==="record") renderRecord(m);
  else if(view==="history") renderHistory(m);
  else if(view==="analysis") renderAnalysis(m);
  else if(view==="sight") renderSight(m);
  else renderGear(m);
}

/* ---------- 記録 ---------- */
function setupOptions(sel){
  return `<option value="">（セッティング未指定）</option>`+db.setups.map(s=>`<option value="${s.id}" ${s.id===sel?"selected":""}>${esc(s.name)}</option>`).join("");
}
const RECORD_FLOW_MODES=[
  {id:"practice",icon:"◎",title:"練習記録",desc:"点取りから調整提案へ"},
  {id:"calibration",icon:"↕",title:"サイト値を残す",desc:"サイト値・風メモも一緒に"},
  {id:"diagnosis",icon:"?",title:"足りないデータを見る",desc:"提案の材料を確認"}
];
const RECORD_PHASES=["準備","記録","確認","蓄積"];
const SHOT_REASON_TAGS=["良射","押し手","リリース","クリッカー","風","狙いミス","矢が怪しい","不明"];
function scorePct(v){ return Math.round(clamp(v||0,0,1)*100); }
function readinessCellHtml(label,level,score){
  return `<div class="readinessCell"><div class="k">${label}</div><b>${esc(level)}</b><div class="bar"><i style="width:${scorePct(score)}%"></i></div></div>`;
}
function recordPhaseArcHtml(step, subtitle){
  const cur=Math.max(0,Math.min(RECORD_PHASES.length-1,Math.round(step||0)));
  const xs=[32,130,228,326];
  const rails=xs.slice(0,-1).map((x,i)=>`<line class="seg ${i<cur?"on":""} ${i===cur-1?"cur":""}" x1="${x}" y1="18" x2="${xs[i+1]}" y2="18"/>`).join("");
  const nodes=RECORD_PHASES.map((label,i)=>`<g>
      <circle class="node ${i<=cur?"on":""} ${i===cur?"cur":""}" cx="${xs[i]}" cy="18" r="10"/>
      <circle class="nodeCore" cx="${xs[i]}" cy="18" r="3.2"/>
      <text class="${i<=cur?"on":""}" x="${xs[i]}" y="44" text-anchor="middle">${esc(label)}</text>
    </g>`).join("");
  return `<section class="phaseArc" aria-label="記録フロー">
    <svg viewBox="0 0 360 50" role="img" aria-hidden="true">
      <line class="rail" x1="32" y1="18" x2="326" y2="18"/>
      ${rails}
      ${nodes}
    </svg>
    ${subtitle?`<div class="phaseSub">${esc(subtitle)}</div>`:""}
  </section>`;
}
function recordCoachCardHtml(){
  return `<div class="coachCard">
    <img src="icon.svg" alt="">
    <div><b>3ステップで使います</b><span>条件を決める → 的でタップ → 結果で次の調整を見る</span></div>
  </div>`;
}
function recordIntroHtml(sys, mode){
  const flow=RECORD_FLOW_MODES.map(f=>`
      <button class="flowBtn ${mode===f.id?"on":""}" data-mode="${f.id}"><span class="flowIcon">${f.icon}</span><span class="flowText"><b>${f.title}</b><span>${f.desc}</span></span></button>`).join("");
  const p=sys.profiles||{};
  const nf=nativeFeatureProfile();
  return `<section class="missionPanel convergeMission">
    <div class="missionTop">
      <img class="startLogoMark" src="icon.svg" alt="">
      <div>
        <div class="eyebrow">Archery Note</div>
        <h2>${mode==="calibration"?"サイト値も残す":"今日のズレを、次の一射へ。"}</h2>
        <p>得点・着弾・用具をまとめて残せる、アーチェリー練習ノート。結果で、サイトを動かすか・保留するかを見ます。</p>
      </div>
      <div class="readinessDial"><b>${scorePct(sys.score)}</b><span>${esc(sys.level)}</span></div>
    </div>
    <div class="simplePromise">記録する <span>→</span> ズレを見る <span>→</span> 次を決める</div>
    <details class="adv missionMore" ${mode==="calibration"?"open":""}>
      <summary>詳しく使う</summary>
      <div class="readinessRail">
        ${readinessCellHtml("用具",p.gear?p.gear.level:"低",p.gear?p.gear.score:0)}
        ${readinessCellHtml("履歴",p.model?p.model.level:"データ蓄積中",p.model?p.model.score:0)}
        ${readinessCellHtml("物理校正",p.physics?p.physics.level:"未校正",p.physics?p.physics.score:0)}
      </div>
      <div class="nativeSignal">
        <span class="on">${esc(nf.runtime.label)}</span>
        <span class="${nf.haptics?"on":""}">触感${nf.haptics?"ON":"待ち"}</span>
        <span class="${nf.share?"on":""}">共有${nf.share?"ON":"待ち"}</span>
      </div>
      <div class="missionFlow" id="flowMode">${flow}</div>
      <div class="missionNext"><b>次の材料</b><span>${esc(sys.next)} / ${sys.lines.map(esc).join(" / ")}</span></div>
    </details>
  </section>`;
}
function setupSystemSummary(setupId){
  const setup=db.setups.find(s=>s.id===setupId);
  if(!setup) return {score:0,level:"準備中", profiles:{}, lines:["用具セッティングを登録すると、サイト台帳・物理校正・個人モデルの材料が整います。"], next:"用具タブで初回セットアップ"};
  const gp=gearPrecisionProfile(setup), mp=modelReadinessProfile(setupId), pc=personalPhysicsCalibration(setupId), cp=calibrationProfile(setupId);
  const score=clamp(gp.score*.25 + mp.score*.25 + (pc?pc.score*.28:0) + (cp?cp.score*.22:0),0,1);
  const level=levelFromScore(score, LEVELS.system);
  const next=[];
  if(gp.score<.65) next.push((gp.missing||[])[0]||"用具入力");
  if(mp.good<5) next.push("6本以上の練習");
  if(cp.dists<3) next.push("複数距離のサイト値");
  if(pc && pc.wind.sample<2) next.push("横風メモつき練習");
  return {
    score,
    level,
    profiles:{gear:gp,model:mp,physics:pc||{score:0,level:"未校正"},calibration:cp},
    lines:[`用具 ${gp.level} / 履歴 ${mp.level} / 物理校正 ${pc?pc.level:"未校正"}`],
    next:next.slice(0,2).join("・") || "同条件で記録を重ねる"
  };
}
function recordSetupSnapshot(setupId,dist){
  const setup=db.setups.find(s=>s.id===setupId);
  if(!setup) return `<div class="setupLens" id="setupLens">
    <div class="lensCard"><div class="k">セッティング</div><b>未指定</b><span>用具登録で調整提案が強くなります</span></div>
    <div class="lensCard"><div class="k">サイト台帳</div><b>未接続</b><span>距離を選ぶと実測値を呼び出します</span></div>
  </div>`;
  const gp=gearPrecisionProfile(setup);
  const mp=modelReadinessProfile(setupId);
  const mk=dist?latestMark(setupId,dist):null;
  const markText=mk?`上下 ${esc(mk.v||"—")} / 左右 ${esc(mk.h||"—")}`:"記録なし";
  return `<div class="setupLens" id="setupLens">
    <div class="lensCard"><div class="k">セッティング</div><b>${esc(setup.name)}</b><span>${[setup.bow,setup.limbs,setup.poundage?setup.poundage+"lbs":""].filter(Boolean).map(esc).join(" / ")||"詳細入力待ち"}</span></div>
    <div class="lensCard"><div class="k">${dist?dist+"m サイト":"サイト台帳"}</div><b>${markText}</b><span>入力材料 ${gp.level} / 履歴 ${mp.level}</span></div>
  </div>`;
}
function faceChoiceValue(sess){
  if(!sess) return "122";
  if(sess.faceType==="triple") return "T40";
  if(sess.faceType==="field") return `F${sess.faceD||80}`;
  return String(sess.faceD||122);
}
function suggestedFaceValue(dist,last){
  if(last && last.faceD) return faceChoiceValue(last);
  return String((dist||70)>=60?122:((dist||70)<=18?40:80));
}
function actionFaceLabel(value){
  const f=parseFaceChoice(value);
  if(f.faceType==="triple") return "40cm三つ目";
  if(f.faceType==="field") return `${f.faceD}cmフィールド`;
  return `${f.faceD}cm`;
}
function recordFastActionsHtml(last,dist,faceValue){
  const currentLabel=`${dist}m / ${actionFaceLabel(faceValue)}`;
  const lastLabel=last?`${last.dist}m / ${actionFaceLabel(faceChoiceValue(last))}`:"なし";
  return `<section class="homeActions" aria-label="すぐ使う">
    <button class="homeAction primary" id="quickStart" type="button"><b>今日の記録を始める</b><span id="quickStartMeta">${esc(currentLabel)}</span></button>
    ${last?`<button class="homeAction" id="quickRepeat" type="button"><b>前回と同じ</b><span>${esc(lastLabel)}</span></button>
    <button class="homeAction" id="quickHistory" type="button"><b>履歴を見る</b><span>分析</span></button>`:""}
  </section>`;
}
/* 多距離ラウンド（IMP-09）: ラウンドIDが ROUND_TYPES に無く stages を持つ定義なら返す。それ以外は null */
function selectedMultiRound(roundId){
  if(!roundId || ROUND_TYPES.some(r=>r.id===roundId)) return null;
  const def=findRoundDef(roundId);
  return def&&Array.isArray(def.stages)&&def.stages.length?def:null;
}
/* ステージ一覧の1行表示（例「90m→70m→50m→30m（各36射）」） */
function multiRoundStagesText(def){
  const counts=[...new Set(def.stages.map(st=>st.arrows))];
  if(counts.length===1) return `${def.stages.map(st=>`${st.dist}m`).join("→")}（各${counts[0]}射）`;
  return def.stages.map(st=>`${st.dist}m ${st.arrows}射`).join("→");
}
function renderRecord(m){
  if(db.active){ renderActive(m); return; }
  const last=db.sessions[db.sessions.length-1];
  const defSetup=last?last.setupId:(db.setups[0]?db.setups[0].id:"");
  const defDist=last?last.dist:70;
  const mode=ui.recordMode||"practice";
  const defFace=suggestedFaceValue(defDist,last);
  const defPerEnd=last&&last.perEnd?last.perEnd:6;
  m.innerHTML=`
  ${recordFastActionsHtml(last,defDist,defFace)}
  <section class="launchPanel convergeLaunch startFirst">
    <div class="launchHead">
      <div class="launchTitle"><div class="stepBadge">01</div><h2>${mode==="calibration"?"サイト値を残す練習":"条件を選ぶ"}</h2></div>
      <button class="tinyAction" id="jumpGear">用具</button>
    </div>
    <div class="launchBody">
    <label class="f">距離</label>
    <div class="chips quickDists" id="fDistChips">
      ${[70,50,30,18].map(d=>`<button type="button" class="chip ${d===defDist?"on":""}" aria-pressed="${d===defDist}" data-d="${d}">${d}m</button>`).join("")}
      <button type="button" class="chip" aria-pressed="false" data-d="custom">カスタム</button>
    </div>
    <div id="fDistCustomWrap" class="recordDistCustomWrap"><label class="f">距離 (m)</label><input class="inp" type="number" id="fDistCustom" min="5" max="90" step="1" placeholder="例: 60"></div>
    <div class="quickSelects">
      <div><label class="f">的</label><select class="inp" id="fFace">
        <optgroup label="ターゲット">
          ${[122,80,60,40].map(f=>`<option value="${f}" ${String(defFace)===String(f)?"selected":""}>${f}cm</option>`).join("")}
          <option value="T40" ${defFace==="T40"?"selected":""}>40cm 三つ目（縦）</option>
        </optgroup>
        <optgroup label="フィールド">
          ${FIELD_FACE_SIZES.map(f=>`<option value="F${f}" ${defFace===`F${f}`?"selected":""}>${f}cm フィールド</option>`).join("")}
        </optgroup>
      </select></div>
      <div><label class="f">1エンドの本数</label><select class="inp" id="fArrows">${[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>`<option value="${n}" ${n===defPerEnd?"selected":""}>${n}本</option>`).join("")}</select></div>
    </div>
    <div class="btnrow"><button class="btn startPrimary" id="fStart">${mode==="calibration"?"サイト値つきで開始":"この条件で開始"}</button></div>
    <details class="adv recordDetails" ${mode==="calibration"?"open":""}>
      <summary>詳しく残す</summary>
      <div class="fieldBand">
        <div><label class="f">用具セッティング</label><select class="inp" id="fSetup">${setupOptions(defSetup)}</select></div>
        ${recordSetupSnapshot(defSetup,defDist)}
      </div>
      <label class="f">日付</label><input class="inp" type="date" id="fDate" value="${today()}">
      <label class="f">ラウンド</label><select class="inp" id="fRound">
        ${ROUND_TYPES.map(r=>`<option value="${r.id}">${r.label}</option>`).join("")}
        <optgroup label="多距離ラウンド">
          ${multiRoundDefs().map(r=>`<option value="${r.id}">${esc(r.label)}</option>`).join("")}
        </optgroup>
      </select>
      <div class="hint" id="fRoundStages" style="display:none"></div>
      <div class="row">
        <div><label class="f">サイト 上下（目盛り）</label><input class="inp" id="fSightV" inputmode="decimal" placeholder="例: 5.4"></div>
        <div><label class="f">サイト 左右（目盛り）</label><input class="inp" id="fSightH" inputmode="decimal" placeholder="例: 2 / -1.5"></div>
      </div>
      <div class="hint">サイトの目盛りをそのまま記入（左右は<b>右なら 2、左なら -2</b>）。台帳に記録があれば自動入力されます。</div>
      <label class="f">天候・コンディション</label>
      <div class="row">
        <select class="inp" id="fWx"><option value="">—</option><option>晴れ</option><option>くもり</option><option>雨</option><option>風 弱</option><option>風 強</option><option>室内</option></select>
        <input class="inp" id="fNote" placeholder="${mode==="calibration"?"例: サイト1目盛り確認":"メモ（任意）"}" value="${mode==="calibration"?"サイト値確認":""}">
      </div>
      <div class="row">
        <div><label class="f">風向</label><select class="inp" id="fWindDir"><option value="">—</option><option>向かい風</option><option>追い風</option><option>左から</option><option>右から</option><option>巻き風</option></select></div>
        <div><label class="f">風速 (m/s)</label><input class="inp" id="fWindSpeed" inputmode="decimal" placeholder="例: 2.5"></div>
      </div>
    </details>
    ${mode==="calibration"?`<div class="advice recordNeutralAdvice"><div class="note"><b>サイト値を残すコツ</b> — サイト値を必ず入力し、風があれば風向/風速も残します。同じ距離で2回以上残ると履歴推定が強くなります。</div></div>`:""}
    </div>
  </section>`;
  const distState={d:defDist};
  const faceSel=$("#fFace");
  const suggestFace=d=>{ if(String(faceSel.value).startsWith("F")) return; faceSel.value = d>=60?122:(d<=18?40:80); };
  function updateQuickStartMeta(){
    const meta=$("#quickStartMeta");
    if(meta && distState.d) meta.textContent=`${distState.d}m / ${actionFaceLabel(faceSel.value)}`;
  }
  faceSel.onchange=()=>{
    if(String(faceSel.value).startsWith("F") && $("#fArrows").value==="6") $("#fArrows").value="3";
    updateQuickStartMeta();
  };
  /* 多距離ラウンド選択時: stage[0] の距離・的・本数へフォームを合わせ、ステージ一覧を1行表示する */
  function applyMultiRoundStage0(def){
    const st0=def.stages[0];
    distState.d=st0.dist;
    const known=[70,50,30,18].includes(+st0.dist);
    const key=known?String(st0.dist):"custom";
    document.querySelectorAll("#fDistChips .chip").forEach(x=>{ const on=String(x.dataset.d)===key; x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on)); });
    $("#fDistCustomWrap").style.display=known?"none":"block";
    if(!known) $("#fDistCustom").value=st0.dist;
    faceSel.value=st0.faceType==="triple"?"T40":(st0.faceType==="field"?`F${st0.faceD}`:String(st0.faceD));
    $("#fArrows").value=st0.perEnd||6;
    fillSight(); refreshLens();
  }
  $("#fRound").onchange=e=>{
    const def=selectedMultiRound(e.target.value);
    const stagesEl=$("#fRoundStages");
    if(def){
      applyMultiRoundStage0(def);
      stagesEl.style.display="block";
      stagesEl.innerHTML=`<b>${esc(def.label)}</b>：${esc(multiRoundStagesText(def))}`;
    }else{
      stagesEl.style.display="none";
      stagesEl.textContent="";
      if(e.target.value==="field72"){
        if(!String(faceSel.value).startsWith("F")) faceSel.value="F80";
        $("#fArrows").value="3";
      }
    }
    updateQuickStartMeta();
  };
  $("#jumpGear").onclick=()=>showView("gear");
  $("#quickStart").onclick=()=>$("#fStart").click();
  const quickHistory=$("#quickHistory");
  if(quickHistory) quickHistory.onclick=()=>showView("history");
  if(last){
    $("#quickRepeat").onclick=()=>{
      distState.d=last.dist||defDist;
      const known=[70,50,30,18].includes(+distState.d);
      const key=known?String(distState.d):"custom";
      document.querySelectorAll("#fDistChips .chip").forEach(x=>{ const on=String(x.dataset.d)===key; x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on)); });
      $("#fDistCustomWrap").style.display=known?"none":"block";
      if(!known) $("#fDistCustom").value=distState.d||"";
      faceSel.value=faceChoiceValue(last);
      $("#fArrows").value=last.perEnd||6;
      $("#fSetup").value=last.setupId||"";
      $("#fRound").value=last.round||"free";
      fillSight();
      refreshLens();
      $("#fStart").click();
    };
  }
  document.querySelectorAll("#flowMode .flowBtn").forEach(b=>b.onclick=()=>{
    if(b.dataset.mode==="diagnosis"){ showView("sight"); return; }
    ui.recordMode=b.dataset.mode; render();
  });
  function refreshLens(){
    const old=$("#setupLens");
    if(old) old.outerHTML=recordSetupSnapshot($("#fSetup").value, distState.d);
  }
  document.querySelectorAll("#fDistChips .chip").forEach(c=>c.onclick=()=>{
    document.querySelectorAll("#fDistChips .chip").forEach(x=>{ x.classList.remove("on"); x.setAttribute("aria-pressed","false"); });
    c.classList.add("on"); c.setAttribute("aria-pressed","true");
    if(c.dataset.d==="custom"){ $("#fDistCustomWrap").style.display="block"; distState.d=null; }
    else{ $("#fDistCustomWrap").style.display="none"; distState.d=+c.dataset.d; suggestFace(distState.d); fillSight(); }
    updateQuickStartMeta();
    refreshLens();
  });
  $("#fDistCustom").oninput=e=>{ distState.d=+e.target.value||null; if(distState.d) {suggestFace(distState.d); fillSight();} updateQuickStartMeta(); refreshLens(); };
  function fillSight(){
    const sid=$("#fSetup").value, d=distState.d;
    if(!sid||!d) return;
    const mk=latestMark(sid,d);
    if(mk){ $("#fSightV").value=mk.v??""; $("#fSightH").value=mk.h??""; }
  }
  $("#fSetup").onchange=()=>{ fillSight(); refreshLens(); };
  fillSight();
  $("#fStart").onclick=()=>{
    const roundId=$("#fRound").value||"free";
    const mdef=selectedMultiRound(roundId);
    const st0=mdef?mdef.stages[0]:null;
    const d=st0?st0.dist:distState.d;
    if(!d){ toast("距離を入力してください"); return; }
    const fv=faceSel.value;
    /* 多距離ラウンドは dist/faceD/faceType/perEnd を stage[0] から採る */
    const face=st0?{faceD:st0.faceD, faceType:st0.faceType||"single"}:parseFaceChoice(fv);
    db.active={
      id:uid(), date:$("#fDate").value||today(), setupId:$("#fSetup").value||null,
      dist:d, faceD: face.faceD, faceType: face.faceType, perEnd:st0?(st0.perEnd||6):+$("#fArrows").value,
      shaft:+lineCutRadius(face.faceD, face.faceType).toFixed(3),
      sightV:$("#fSightV").value.trim(), sightH:$("#fSightH").value.trim(),
      wx:$("#fWx").value, note:$("#fNote").value.trim(), windDir:$("#fWindDir").value, windSpeed:$("#fWindSpeed").value.trim(),
      round:roundId,
      purpose:ui.recordMode||"practice",
      ends:[], cur:[]
    };
    if(st0) db.active.roundGroup={gid:uid(), roundId, stage:0, stageCount:mdef.stages.length};
    nativePulse("success");
    save(); render();
  };
}

function sessionArrows(sess){
  return [...((sess&&sess.ends)||[]).flat(), ...((sess&&sess.cur)||[])];
}
function arrowMetaSummaryHtml(sess){
  const arrows=((sess&&sess.ends)||[]).flat();
  const tagged=arrows.filter(a=>a&&(a.reason||a.no));
  if(!tagged.length) return "";
  const reasons={};
  const byNo={};
  tagged.forEach(a=>{
    if(a.reason) reasons[a.reason]=(reasons[a.reason]||0)+1;
    if(a.no){
      const k=String(a.no).trim();
      if(k){
        const b=byNo[k]||(byNo[k]={n:0,x:0,y:0,score:0,reasons:{}});
        b.n++; b.x+=a.x||0; b.y+=a.y||0; b.score+=a.s||0;
        if(a.reason) b.reasons[a.reason]=(b.reasons[a.reason]||0)+1;
      }
    }
  });
  const reasonLine=Object.entries(reasons).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${esc(k)} ${v}本`).join(" / ");
  const rows=Object.entries(byNo).sort((a,b)=>b[1].n-a[1].n || String(a[0]).localeCompare(String(b[0]))).slice(0,6).map(([no,b])=>{
    const rx=b.x/b.n, ry=b.y/b.n, avg=b.score/b.n;
    const topReason=Object.entries(b.reasons).sort((a,c)=>c[1]-a[1])[0];
    return `<div class="note">#${esc(no)}: ${b.n}本 / 平均${avg.toFixed(1)} / ${cmOffsetText(rx,"x")}・${cmOffsetText(ry,"y")}${topReason?` / ${esc(topReason[0])} ${topReason[1]}本`:""}</div>`;
  }).join("");
  return `<div class="advice recordNeutralAdvice">
    <div class="note"><b>矢番号・外れ理由メモ</b>${reasonLine?` — ${reasonLine}`:""}</div>
    ${rows}
  </div>`;
}
function heroMetricHtml(k,b,span){
  return `<div class="heroMetric"><div class="k">${esc(k)}</div><b>${esc(b)}</b><span>${esc(span||"")}</span></div>`;
}
function pageHeroHtml(type,ctx){
  ctx=ctx||{};
  if(type==="analysis"){
    return `<section class="pageHero">
      <div class="kicker">分析</div>
      <h2>傾向をまとめる入口</h2>
      <p>スコア・距離・サイト・グルーピングの読み取りを、ここへ段階的に集めます。</p>
      <div class="heroMetrics">
        ${heroMetricHtml("現在","分析タブ","推移と分布")}
        ${heroMetricHtml("対象","スコア・距離","サイト・グルーピング")}
        ${heroMetricHtml("履歴","記録一覧","練習本体を確認")}
      </div>
    </section>`;
  }
  if(type==="history"){
    const src=ctx.ss||db.sessions||[];
    const arrows=src.flatMap(s=>s.ends.flat());
    const total=arrows.reduce((a,x)=>a+x.s,0);
    const latest=src[0]||null;
    return `<section class="pageHero">
      <div class="kicker">履歴</div>
      <h2>分布と偏移を読む</h2>
      <p>点数だけでなく、同じ用具・同じ距離の中心移動を追います。過去のグルーピングがあるほど、今回のズレが偶然か傾向か見えやすくなります。</p>
      <div class="heroMetrics">
        ${heroMetricHtml("練習",`${src.length}回`,`${arrows.length}本を集計`)}
        ${heroMetricHtml("平均",arrows.length?(total/arrows.length).toFixed(2):"—","フィルター後の平均点")}
        ${heroMetricHtml("直近",latest?[fmtD(latest.date),distanceLabel(latest.dist)].filter(Boolean).join(" "):"—",latest?roundLabel(latest.round):"記録待ち")}
      </div>
    </section>`;
  }
  if(type==="sight"){
    const setup=ctx.setup, dist=ctx.dist, marks=ctx.marks||[], adv=ctx.adv;
    const cur=marks[0];
    const axes=adv?adv.lines.map(l=>l.axis):[];
    const hasV=axes.includes("v"), hasH=axes.includes("h");
    const advSummary=!adv?"材料待ち":hasV&&hasH?"上下・左右調整":hasV?"上下調整あり":hasH?"左右調整あり":"調整不要";
    return `<section class="pageHero">
      <div class="kicker">サイト調整</div>
      <h2>サイト値を整える</h2>
      <p>距離ごとのサイト値と最新グルーピングから、動かす時・保留する時・射形を優先する時を分けて見ます。</p>
      <div class="heroMetrics">
        ${heroMetricHtml("対象",setup?setup.name:"用具未指定",dist?`${dist}m`:"距離未指定")}
        ${heroMetricHtml("最新サイト",cur?`上下 ${cur.v||"—"}`:"未登録",cur?`左右 ${cur.h||"—"}`:"台帳へ記録")}
        ${heroMetricHtml("提案",advSummary,adv?`信頼 ${sessionQuality(ctx.lastSess||{},setup).label}`:"練習記録が必要")}
      </div>
    </section>`;
  }
  if(type==="gear"){
    const setups=db.setups||[];
    const profiles=setups.map(s=>gearPrecisionProfile(s));
    const avg=profiles.length?profiles.reduce((a,p)=>a+p.score,0)/profiles.length:0;
    const best=setups.map(s=>({s,p:gearPrecisionProfile(s),m:modelReadinessProfile(s.id)})).sort((a,b)=>(b.p.score+b.m.score)-(a.p.score+a.m.score))[0];
    return `<section class="pageHero">
      <div class="kicker">用具</div>
      <h2>いつものセッティングを残す</h2>
      <p>ハンドル、リム、矢、サイト値をまとめて保存します。分かる範囲だけで始めて、必要な時だけ細かい実測値を足せます。</p>
      <div class="heroMetrics">
        ${heroMetricHtml("登録",`${setups.length}件`,`${db.sessions.filter(s=>s.setupId).length}回の練習に接続`)}
        ${heroMetricHtml("入力材料",pct(avg),"用具データの平均充実度")}
        ${heroMetricHtml("主戦用具",best?best.s.name:"—",best?`入力 ${best.p.level} / 履歴 ${best.m.level}`:"初回セットアップ待ち")}
      </div>
    </section>`;
  }
  return "";
}
function analysisFilterBarHtml(allRows,f){
  const dists=[...new Set(allRows.map(r=>r.dist).filter(Boolean))].sort((a,b)=>b-a);
  const periods=[["all","全期間"],["3m","3ヶ月"],["1m","1ヶ月"]];
  return `<div class="card analysisFilterCard">
    <div class="row">
      <div><label class="f">用具</label><select class="inp" id="anSetup"><option value="">すべて</option><option value="__none" ${f.setupId==="__none"?"selected":""}>未指定</option>${db.setups.map(s=>`<option value="${s.id}" ${f.setupId===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select></div>
      <div><label class="f">距離</label><select class="inp" id="anDist"><option value="">すべて</option>${dists.map(d=>`<option value="${d}" ${String(f.dist)===String(d)?"selected":""}>${d}m</option>`).join("")}</select></div>
    </div>
    <label class="f">期間</label>
    <div class="chips" id="anPeriods">${periods.map(([id,lb])=>`<button type="button" class="chip ${f.period===id?"on":""}" aria-pressed="${f.period===id}" data-period="${id}">${lb}</button>`).join("")}</div>
  </div>`;
}
function analysisKpiHtml(rows){
  const scored=rows.filter(r=>r.n);
  if(!scored.length) return "";
  const sorted=[...scored].sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.id>b.id?1:-1));
  const arrows=scored.reduce((a,r)=>a+r.n,0);
  const avg=arrows?scored.reduce((a,r)=>a+r.total,0)/arrows:0;
  const ma=movingAverage(sorted.map(r=>r.avg),5);
  const latestMa=ma.length?ma[ma.length-1]:null;
  const prevMa=ma.length>1?ma[ma.length-2]:null;
  const delta=latestMa!=null&&prevMa!=null?latestMa-prevMa:null;
  const trend=delta==null?"—":delta>0.02?`↑ +${delta.toFixed(2)}`:delta<-0.02?`↓ ${delta.toFixed(2)}`:"→ 横ばい";
  const rrRows=sorted.filter(r=>r.st&&Number.isFinite(r.st.rr));
  const latestRr=rrRows.length?rrRows[rrRows.length-1].st.rr:null;
  const bestRr=rrRows.length?Math.min(...rrRows.map(r=>r.st.rr)):null;
  const best=[...scored].sort((a,b)=>b.total-a.total||(b.date||"").localeCompare(a.date||""))[0];
  return `<div class="insightStrip">
    <div class="insightTile"><div class="k">平均点</div><b>${avg.toFixed(2)}</b><span>${scored.length}回 ${arrows}本 / 移動平均 ${trend}</span></div>
    <div class="insightTile"><div class="k">グルーピング</div><b>${latestRr!=null?latestRr.toFixed(1)+"cm":"—"}</b><span>最新RMS / 最小 ${bestRr!=null?bestRr.toFixed(1)+"cm":"—"}</span></div>
    <div class="insightTile"><div class="k">最高合計</div><b>${best?best.total:"—"}</b><span>${best?[fmtD(best.date),best.dist?`${best.dist}m`:"",`${best.n}本`].filter(Boolean).join(" / "):"記録待ち"}</span></div>
  </div>`;
}
function analysisTrendChartHtml(rows){
  const sorted=rows.filter(r=>r.n).sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.id>b.id?1:-1));
  if(sorted.length<3) return "";
  const avgs=sorted.map(r=>r.avg);
  const ma=movingAverage(avgs,5).map((v,i)=>v==null?avgs[i]:v);
  const W=320,H=96;
  const min=Math.min(...avgs,...ma), max=Math.max(...avgs,...ma), span=(max-min)||1;
  const px=i=>(i/(sorted.length-1))*W;
  const py=v=>H-10-((v-min)/span)*(H-22);
  const maPath=ma.map((v,i)=>`${i?"L":"M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join("");
  return `<div class="card"><h2>スコア推移グラフ <span class="mini">${sorted.length}回 / 線は直近5回移動平均</span></h2>
    <svg width="100%" viewBox="0 0 ${W} ${H}" style="max-height:${H+20}px" role="img" aria-label="平均点の推移">
      <text x="2" y="10" font-size="9" fill="var(--sub)">${max.toFixed(1)}</text>
      <text x="2" y="${H-2}" font-size="9" fill="var(--sub)">${min.toFixed(1)}</text>
      ${sorted.map((r,i)=>`<circle cx="${px(i).toFixed(1)}" cy="${py(r.avg).toFixed(1)}" r="3" fill="var(--green)" opacity=".5"/>`).join("")}
      <path d="${maPath}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linejoin="round"/>
    </svg>
    <div class="hint">丸は各練習の平均点/本、線は移動平均です。用具・距離・期間で絞ると同条件の推移として読めます。</div>
  </div>`;
}
function personalBestCard(rows){
  const pbs=personalBests(rows).slice(0,6);
  if(!pbs.length) return "";
  const body=pbs.map(g=>{
    const lb=[g.dist?`${g.dist}m`:"距離未設定",g.round!=="free"?roundLabel(g.round):"自由練習"].join(" ・ ");
    return `<div class="listItem recordReadOnlyItem">
      <div><div class="t">${esc(lb)}</div><div class="d">${g.sessions}回 / ベスト日 ${g.bestTotal?fmtD(g.bestTotal.date):"—"}${g.bestTotal?` / ${g.bestTotal.arrows}本`:""}</div></div>
      <div class="big">${g.bestTotal?g.bestTotal.total:"—"}<small> / 平均ベスト${g.bestAvg?g.bestAvg.avg.toFixed(2):"—"}</small></div>
    </div>`;
  }).join("");
  return `<div class="card"><h2>自己ベスト <span class="mini">距離×ラウンド別</span></h2>${body}</div>`;
}
function conditionSplitCard(rows){
  const cs=conditionSplit(rows,isWindy);
  if(cs.windy.sessions<2 || cs.calm.sessions<2) return "";
  const line=g=>`<div class="listItem recordReadOnlyItem">
    <div><div class="t">${esc(g.label)}</div><div class="d">${g.sessions}回 / ${g.arrows}本${g.biasX!=null&&Math.abs(g.biasX)>=.3?` / 平均中心 ${cmOffsetText(g.biasX,"x")}`:""}</div></div>
    <div class="big">${g.avg!=null?g.avg.toFixed(2):"—"}<small> / RMS ${g.avgRms!=null?g.avgRms.toFixed(1)+"cm":"—"}</small></div>
  </div>`;
  return `<div class="card"><h2>条件比較 <span class="mini">風あり vs 風なし</span></h2>${line(cs.calm)}${line(cs.windy)}
    <div class="hint">風の有無で平均点とグルーピングがどれだけ変わるかの俯瞰です。風ありの平均中心が横へ流れていれば、風待ちやエイムオフの効果を検討できます。</div></div>`;
}
function reasonBreakdownCard(rows){
  const rb=reasonBreakdown(rows);
  if(rb.tagged<5) return "";
  const body=rb.items.slice(0,6).map(g=>`<div class="listItem recordReadOnlyItem">
    <div><div class="t">${esc(g.reason)}</div><div class="d">${g.count}本${(Math.abs(g.mx||0)>=.3||Math.abs(g.my||0)>=.3)?` / 平均ズレ ${driftText(g.mx||0,g.my||0)}`:""}</div></div>
    <div class="big">${g.avg!=null?g.avg.toFixed(2):"—"}<small> / 平均点</small></div>
  </div>`).join("");
  return `<div class="card"><h2>外れ理由タグ分析 <span class="mini">${rb.tagged}本にタグ</span></h2>${body}
  <div class="hint">記録中に付けた理由タグ別の平均点と平均ズレ方向です。特定のタグが同じ方向へ寄っていれば、次の練習の重点候補になります。</div></div>`;
}
function renderAnalysis(m){
  const f=ui.analysisFilter;
  const allRows=buildAnalysisRows(db.sessions, db.setups, sessionMetrics);
  const rows=filterAnalysisRows(allRows, {setupId:f.setupId, dist:f.dist, round:f.round, period:f.period, today:today()});
  const ss=rows.map(r=>r.s).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.id<a.id?-1:1));
  const cards=[
    analysisKpiHtml(rows),
    analysisTrendChartHtml(rows),
    formTrackingCard(),
    personalBestCard(rows),
    conditionSplitCard(rows),
    reasonBreakdownCard(rows),
    historySummaryDetailsHtml(historySessionRows(ss),{setupId:"",dist:""}),
    scoreTrendCard(ss),
    setupPerformanceCard(ss),
    sightHistoryCard(ss),
    groupingTrendCard(ss),
    distTrendCard(ss),
    scoreDistCard(ss),
    monthlyCard(ss)
  ].filter(Boolean).join("");
  m.innerHTML=`${pageHeroHtml("analysis")}
  ${allRows.length?analysisFilterBarHtml(allRows,f):""}
  ${cards||`<div class="card"><h2>分析</h2><div class="empty">${allRows.length?"この絞り込みに合う記録がありません。フィルタを広げてください。":"記録が増えると、グルーピング推移や月間サマリーがここに表示されます。"}</div></div>`}`;
  const anSetup=$("#anSetup");
  if(anSetup) anSetup.onchange=e=>{ f.setupId=e.target.value; render(); };
  const anDist=$("#anDist");
  if(anDist) anDist.onchange=e=>{ f.dist=e.target.value; render(); };
  document.querySelectorAll("#anPeriods .chip[data-period]").forEach(c=>c.onclick=()=>{
    const hadFocus=!!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest("#anPeriods"));
    f.period=c.dataset.period; render();
    if(hadFocus){ const chip=document.querySelector(`#anPeriods [data-period="${c.dataset.period}"]`); if(chip) chip.focus({preventScroll:true}); }
  });
  bindFormTrackingCard();
}
function liveSessionHeroHtml(s,setup){
  const all=sessionArrows(s);
  const total=all.reduce((a,x)=>a+x.s,0);
  const avg=all.length?(total/all.length).toFixed(2):"—";
  const remain=Math.max(0,(s.perEnd||6)-(s.cur||[]).length);
  const r=ROUND_TYPES.find(x=>x.id===s.round);
  const roundRemain=r&&r.arrows?Math.max(0,r.arrows-all.length):null;
  return `<section class="liveHud compactHud">
    <div class="liveContext">${s._edit?"過去記録の編集":`${s.dist}m / ${faceLabel(s)}`}<span>${setup?esc(setup.name):"用具未指定"}</span></div>
    <div class="liveGrid">
      <div class="liveCell"><div class="k">合計</div><b>${total}</b></div>
      <div class="liveCell"><div class="k">平均</div><b>${avg}</b></div>
      <div class="liveCell"><div class="k">現在エンド</div><b>${(s.cur||[]).length}/${s.perEnd||6}</b></div>
      <div class="liveCell"><div class="k">残り</div><b>${roundRemain==null?`${remain}本`:roundRemain+"本"}</b></div>
    </div>
  </section>`;
}
function activeGuideHtml(){
  if(db.settings.activeGuideSeen) return "";
  return `<details class="adv activeGuide" open>
    <summary>初回の操作ガイド</summary>
    <div class="guideLine"><b>記録</b><span>的をタップすると、その場所に1本入ります。少しずれたら矢チップを選びます。</span></div>
    <div class="guideLine"><b>微調整</b><span>選んだ矢だけ下の矢印で動かせます。押したままでも細かく合わせられます。</span></div>
    <div class="guideLine"><b>進行</b><span>${db.active&&db.active.perEnd?db.active.perEnd:6}本入れたらエンド確定。最後はセッション終了で結果を見ます。</span></div>
    <button class="btn sm ghost activeGuideDone" id="activeGuideDone">次から表示しない</button>
  </details>`;
}
function renderActive(m){
  const s=db.active;
  const setup=db.setups.find(x=>x.id===s.setupId);
  m.innerHTML=`
  ${liveSessionHeroHtml(s,setup)}
  <div class="card targetFocusCard">
    <div class="targetTools">
      <h2>記録中${s._edit?"（過去記録の編集）":""} <span class="mini">${fmtD(s.date)} ・ ${s.dist}m ・ ${faceLabel(s)} ・ ${setup?esc(setup.name):"セッティング未指定"}</span></h2>
      ${s.faceType==="triple"?"":`<div class="chips" id="zoomChips">
        ${[[1,"全体"],[2,"×2"],[3,"×3"]].map(([z,lb])=>`<button type="button" class="chip ${(ui.zoom||1)===z?"on":""}" aria-pressed="${(ui.zoom||1)===z}" data-z="${z}">${lb}</button>`).join("")}
      </div>`}
    </div>
    <div class="tgWrap" id="tgWrap">
      ${targetMarkup(s.faceD,"tg",s.faceType)}
      <div class="lens" id="lens"><svg id="lensSvg" width="122" height="122"><use href="#tgmain"/><g id="lensCross"></g></svg></div>
      <div class="lensTag" id="lensTag">微調整モード</div>
    </div>
    <div class="targetHint">タップで記録。矢チップで修正。</div>
    ${activeGuideHtml()}
    <div class="scoreChips" id="curChips"></div>
    <div class="nudge" id="nudge">
      <div class="recordNudgeHint">選択中の矢を微調整（1目盛 = ${(s.faceD/200).toFixed(1)}cm）</div>
      <div class="npad">
        <span class="blank"></span><button data-n="u">▲</button><span class="blank"></span>
        <button data-n="l">◀</button><button class="recordNudgeDelete" data-n="del">🗑</button><button data-n="r">▶</button>
        <span class="blank"></span><button data-n="d">▼</button><span class="blank"></span>
      </div>
      <div class="shotMeta" id="shotMeta"></div>
      <button class="btn sm ghost" id="nudgeDone">選択解除</button>
    </div>
    <div class="statbar" id="statbar"></div>
    <div class="btnrow">
      <button class="btn ghost" id="bUndo">↩ 1本取消</button>
      <button class="btn sec" id="bEnd">エンド確定</button>
    </div>
    <div class="btnrow"><button class="btn danger" id="bFinish">セッション終了</button></div>
  </div>
  <div class="card"><h2>エンド一覧</h2><div id="endsTbl"></div></div>`;
  attachTargetInput(s);
  function applyZoom(){ if(s.faceType==="triple") return; const M=s.faceD/2*1.18/(ui.zoom||1); $("#tgsvg").setAttribute("viewBox", `${-M} ${-M} ${2*M} ${2*M}`); }
  document.querySelectorAll("#zoomChips .chip").forEach(c=>c.onclick=()=>{
    ui.zoom=+c.dataset.z;
    document.querySelectorAll("#zoomChips .chip").forEach(x=>{ const on=x===c; x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on)); });
    applyZoom();
  });
  applyZoom();
  $("#bUndo").onclick=()=>{ if(s.cur.length){ s.cur.pop(); ui.selArrow=-1; nativePulse("light"); save(); refreshActive(); } else toast("このエンドに矢がありません"); };
  $("#bEnd").onclick=()=>{
    if(!s.cur.length){ toast("矢を記録してください"); return; }
    if(s.editIndex!=null){
      const at=Math.min(s.editIndex, s.ends.length);
      s.ends.splice(at,0,s.cur); toast(`エンド${at+1}を更新しました`); s.editIndex=null;
    }else{
      s.ends.push(s.cur); toast(`エンド${s.ends.length} 確定`);
    }
    s.cur=[]; ui.selArrow=-1; nativePulse("success"); save(); refreshActive();
  };
  $("#bFinish").onclick=()=>finishSession();
  const guideDone=$("#activeGuideDone");
  if(guideDone) guideDone.onclick=()=>{ db.settings.activeGuideSeen=true; save("active-guide"); render(); };
  document.querySelectorAll("#nudge .npad button").forEach(b=>b.onclick=()=>nudgeArrow(b.dataset.n));
  $("#nudgeDone").onclick=()=>{ ui.selArrow=-1; refreshActive(); };
  refreshActive();
}
function shotMetaHtml(a,index){
  const tags=SHOT_REASON_TAGS.map(tag=>`<button type="button" class="reasonTag ${a.reason===tag?"on":""}" aria-pressed="${a.reason===tag}" data-reason="${esc(tag)}">${esc(tag)}</button>`).join("");
  return `<div class="shotMetaGrid">
    <div>
      <label class="metaLabel" for="shotArrowNo">矢番号</label>
      <input class="inp" id="shotArrowNo" inputmode="numeric" maxlength="8" value="${esc(a.no||"")}" placeholder="${index+1}">
    </div>
    <div>
      <span class="metaLabel">外れ理由</span>
      <div class="reasonTags" id="shotReasonTags">${tags}</div>
    </div>
  </div>`;
}
function bindShotMeta(){
  const s=db.active, a=s&&s.cur&&s.cur[ui.selArrow];
  if(!a) return;
  const no=$("#shotArrowNo");
  if(no) no.oninput=e=>{
    a.no=e.target.value.trim();
    scheduleSave("shot-meta"); /* キーストロークごとの全量書き込みを避ける（flush は pagehide 等で保証） */
  };
  if(no) no.onchange=()=>refreshActive();
  document.querySelectorAll("#shotReasonTags .reasonTag").forEach(btn=>btn.onclick=()=>{
    const reason=btn.dataset.reason;
    /* refreshActive() が #shotMeta を innerHTML で作り直すため、フォーカス中のタグを data-reason で復元する */
    const hadFocus=!!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest("#shotReasonTags"));
    a.reason=a.reason===reason?"":reason;
    nativePulse("light");
    scheduleSave("shot-meta");
    refreshActive();
    if(hadFocus){ const back=document.querySelector(`#shotReasonTags .reasonTag[data-reason="${reason}"]`); if(back) back.focus({preventScroll:true}); }
  });
}
function refreshActive(){
  const s=db.active; if(!s) return;
  // markers
  let html="";
  const gp=a=> s.faceType==="triple" ? {x:a.x, y:a.y+SPOT_Y[a.spot||0]} : a;
  s.ends.forEach((end,ei)=>end.forEach(a=>{ html+=markCircle(gp(a),s.faceD,"rgba(60,60,60,.45)"); }));
  s.cur.forEach((a,i)=>{ html+=markCircle(gp(a),s.faceD, i===ui.selArrow?"#111":"var(--green-l)", scoreLabel(a), i===ui.freshArrow?"shotNew":""); });
  $("#tgmarks").innerHTML=html;
  // chips（innerHTML 全置換でフォーカス中のチップが消えるため、置換前に data-i を控えて復元する）
  const chipsBox=$("#curChips");
  const focused=document.activeElement;
  const focusI=(focused && focused.classList && focused.classList.contains("sc") && chipsBox.contains(focused))?focused.dataset.i:null;
  chipsBox.innerHTML = s.cur.map((a,i)=>{
    const z=zoneStyle(a.s,a.X,s.faceType);
    return `<button type="button" class="sc ${i===ui.selArrow?"sel":""} ${i===ui.freshArrow?"fresh":""}" aria-pressed="${i===ui.selArrow}" data-i="${i}" style="background:${z.bg};color:${z.fg}"><span>${scoreLabel(a)}</span>${a.no?`<small>#${esc(a.no)}</small>`:""}</button>`;
  }).join("") || `<span class="recordCurEmpty">エンド${s.ends.length+1}：的をタップして記録</span>`;
  if(focusI!=null){
    const back=chipsBox.querySelector(`.sc[data-i="${focusI}"]`);
    if(back) back.focus({preventScroll:true});
  }
  if(ui.freshArrow>=0){
    clearTimeout(ui.freshTimer);
    ui.freshTimer=setTimeout(()=>{
      ui.freshArrow=-1;
      document.querySelectorAll(".shotNew,.sc.fresh").forEach(el=>el.classList.remove("shotNew","fresh"));
    },640);
  }
  document.querySelectorAll("#curChips .sc").forEach(c=>c.onclick=()=>{
    ui.selArrow = (ui.selArrow===+c.dataset.i)? -1 : +c.dataset.i; nativePulse("light"); refreshActive();
  });
  $("#nudge").classList.toggle("on", ui.selArrow>=0);
  const meta=$("#shotMeta");
  if(meta){
    const a=s.cur[ui.selArrow];
    meta.innerHTML=a?shotMetaHtml(a,ui.selArrow):"";
    if(a) bindShotMeta();
  }
  // stats
  const all=[...s.ends.flat(), ...s.cur];
  const total=all.reduce((a,x)=>a+x.s,0);
  $("#statbar").innerHTML=`
    <div class="stat"><b>${total}</b><span>合計</span></div>
    <div class="stat"><b>${all.length?(total/all.length).toFixed(2):"-"}</b><span>平均/本</span></div>
    <div class="stat"><b>${perfectScoreCount(all,s)}</b><span>${perfectScoreLabel(s)}</span></div>
    <div class="stat"><b>${secondaryScoreCount(all,s)}</b><span>${secondaryScoreLabel(s)}</span></div>`;
  // ends table
  $("#endsTbl").innerHTML = s.ends.length? `<table class="tbl"><tr><th>#</th><th>得点</th><th class="right">計</th><th></th></tr>`+
    s.ends.map((end,i)=>{
      const sorted=[...end].sort((a,b)=>b.s-a.s || (b.X?1:0)-(a.X?1:0));
      return `<tr><td><span class="histChip" style="background:${ENDCOLORS[i%ENDCOLORS.length]}"></span>${i+1}</td>
        <td>${sorted.map(scoreLabel).join("・")}</td>
        <td class="right"><b>${end.reduce((a,x)=>a+x.s,0)}</b></td>
        <td class="right"><button class="btn sm ghost recordEndEditBtn" data-open="${i}">✏</button></td></tr>`;
    }).join("")+`</table>` : `<div class="empty">確定したエンドはまだありません</div>`;
  document.querySelectorAll("#endsTbl [data-open]").forEach(b=>b.onclick=()=>{
    if(s.cur.length){ toast("先に現在のエンドを確定（または取消）してください"); return; }
    s.editIndex=+b.dataset.open;
    s.cur=s.ends.splice(s.editIndex,1)[0];
    ui.selArrow=-1; save(); refreshActive();
    toast(`エンド${s.editIndex+1}を編集中（確定で戻ります）`);
  });
}
function nudgeArrow(dirKey){
  const s=db.active; if(!s || ui.selArrow<0 || !s.cur[ui.selArrow]) return;
  if(dirKey==="del"){ s.cur.splice(ui.selArrow,1); ui.selArrow=-1; nativePulse("heavy"); save(); refreshActive(); return; }
  const a=s.cur[ui.selArrow], step=s.faceD/200;
  if(dirKey==="u")a.y+=step; if(dirKey==="d")a.y-=step; if(dirKey==="l")a.x-=step; if(dirKey==="r")a.x+=step;
  Object.assign(a, scoreAt(a.x,a.y,s.faceD,s.faceType,lineCutRadius(s.faceD,s.faceType)));
  nativePulse("light"); scheduleSave("nudge"); refreshActive();
}

/* target pointer input with long-press fine mode + lens */
function attachTargetInput(s){
  const svg=$("#tgsvg"), lens=$("#lens"), lensSvg=$("#lensSvg"), lensTag=$("#lensTag"), cur=$("#tgcur");
  let drag=null, cursorFrame=0, cursorPoint=null;
  const raf=window.requestAnimationFrame||function(cb){ return setTimeout(cb,16); };
  const caf=window.cancelAnimationFrame||clearTimeout;
  function clientPoint(e){
    const t=(e.changedTouches&&e.changedTouches[0])||(e.touches&&e.touches[0])||e;
    if(!t || t.clientX==null) return null;
    return {x:t.clientX,y:t.clientY,id:e.pointerId!=null?e.pointerId:(t.identifier!=null?t.identifier:"mouse")};
  }
  function clientToSvg(x,y){
    const ctm=svg.getScreenCTM();
    if(!ctm) return {x:0,y:0};
    const inv=ctm.inverse();
    if(window.DOMPoint){
      const pt=new DOMPoint(x,y).matrixTransform(inv);
      return {x:pt.x, y:-pt.y};
    }
    const pt=svg.createSVGPoint();
    pt.x=x; pt.y=y;
    const p=pt.matrixTransform(inv);
    return {x:p.x, y:-p.y};
  }
  function drawCursor(p){
    const w=ringW(s.faceD,s.faceType);
    const fine=!!(drag&&drag.fine);
    const cutting=fine && isLineCuttingFromGlobal(p.x,p.y,s.faceD,s.faceType);
    const c=fine ? (cutting?"#0f9d58":"#c62828") : "#111";
    lens.classList.toggle("cut", cutting);
    lens.classList.toggle("miss", fine&&!cutting);
    lensTag.classList.toggle("cut", cutting);
    lensTag.classList.toggle("miss", fine&&!cutting);
    if(fine) lensTag.textContent=cutting?"線かみ":"線なし";
    cur.innerHTML=`<g>
      <line x1="${p.x-w}" y1="${-p.y}" x2="${p.x+w}" y2="${-p.y}" stroke="${c}" stroke-width="${s.faceD/500}"/>
      <line x1="${p.x}" y1="${-p.y-w}" x2="${p.x}" y2="${-p.y+w}" stroke="${c}" stroke-width="${s.faceD/500}"/>
      <circle cx="${p.x}" cy="${-p.y}" r="${arrowMarkRadius(s.faceD)}" fill="none" stroke="${c}" stroke-width="${s.faceD/400}"/>
    </g>`;
    const z=ringW(s.faceD,s.faceType)*2.2;
    lensSvg.setAttribute("viewBox", `${p.x-z} ${-p.y-z} ${2*z} ${2*z}`);
    // lens位置: 指と重ならない側へ
    const half = p.x<0;
    lens.style.left = half? "auto":"8px"; lens.style.right = half? "8px":"auto";
    lensTag.style.left = half? "auto":"12px"; lensTag.style.right = half? "12px":"auto";
  }
  function scheduleCursor(p){
    cursorPoint=p;
    if(cursorFrame) return;
    cursorFrame=raf(()=>{
      cursorFrame=0;
      if(cursorPoint) drawCursor(cursorPoint);
    });
  }
  function resetDrag(){
    if(drag&&drag.tm) clearTimeout(drag.tm);
    if(cursorFrame){ caf(cursorFrame); cursorFrame=0; }
    cursorPoint=null;
    drag=null; cur.innerHTML=""; lens.style.display="none";
    lens.classList.remove("fine","cut","miss");
    lensTag.classList.remove("fine","cut","miss"); lensTag.style.display="none";
  }
  svg.addEventListener("contextmenu", e=>e.preventDefault());
  svg.addEventListener("selectstart", e=>e.preventDefault());
  function down(e){
    if(s.cur.length>=s.perEnd){ toast(`1エンド${s.perEnd}本です。「エンド確定」を押してください`); return; }
    const cp=clientPoint(e); if(!cp) return;
    e.preventDefault();
    if(e.pointerId!=null && svg.setPointerCapture){ try{ svg.setPointerCapture(e.pointerId); }catch(_){} }
    const p=clientToSvg(cp.x,cp.y);
    drag={p, raw:{x:cp.x,y:cp.y}, fine:false, id:cp.id,
      tm:setTimeout(()=>{ if(drag){ drag.fine=true; lens.classList.add("fine"); lensTag.classList.add("fine"); lensTag.style.display="block"; scheduleCursor(drag.p); } },400)};
    lens.style.display="block"; lens.classList.remove("cut","miss"); lensTag.classList.remove("fine","cut","miss"); lensTag.textContent="位置調整中…"; lensTag.style.display="block";
    drawCursor(p);
  }
  function move(e){
    const cp=clientPoint(e); if(!drag || !cp || cp.id!==drag.id) return;
    e.preventDefault();
    const a=clientToSvg(cp.x,cp.y);
    const b=clientToSvg(drag.raw.x,drag.raw.y);
    const k=drag.fine?0.25:1;
    drag.p={x:drag.p.x+(a.x-b.x)*k, y:drag.p.y+(a.y-b.y)*k};
    drag.raw={x:cp.x,y:cp.y};
    scheduleCursor(drag.p);
  }
  function up(e){
    const cp=clientPoint(e); if(!drag || !cp || cp.id!==drag.id) return;
    e.preventDefault();
    clearTimeout(drag.tm);
    let MX=s.faceD/2*1.18, MY=MX;
    if(s.faceType==="triple"){ MX=14; MY=36; }
    const p={x:Math.max(-MX,Math.min(MX,drag.p.x)), y:Math.max(-MY,Math.min(MY,drag.p.y))};
    resetDrag();
    const hit=hitFromGlobal(p.x,p.y,s.faceD,s.faceType,lineCutRadius(s.faceD,s.faceType));
    const rec={x:+hit.x.toFixed(2), y:+hit.y.toFixed(2), s:hit.s, X:hit.X};
    if(hit.spot!=null) rec.spot=hit.spot;
    s.cur.push(rec);
    ui.freshArrow=s.cur.length-1;
    nativePulse(isLineCuttingFromGlobal(p.x,p.y,s.faceD,s.faceType)?"success":"light");
    scheduleSave("arrow-add"); refreshActive();
    toast(`${scoreLabel(hit)} 点を記録`);
  }
  function cancel(e){
    const cp=clientPoint(e);
    if(!drag || !cp || cp.id===drag.id) resetDrag();
  }
  if(window.PointerEvent){
    svg.addEventListener("pointerdown", down);
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", cancel);
  }else{
    svg.addEventListener("touchstart", down, {passive:false});
    svg.addEventListener("touchmove", move, {passive:false});
    svg.addEventListener("touchend", up, {passive:false});
    svg.addEventListener("touchcancel", cancel, {passive:false});
    svg.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }
}

function finishSession(){
  const s=db.active;
  const shot=s.ends.flat().length + s.cur.length;
  if(!shot){ if(confirm("矢が0本です。このセッションを破棄しますか？")){ db.active=null; nativePulse("heavy"); save(); render(); } return; }
  if(s.cur.length){
    if(s.editIndex!=null) s.ends.splice(Math.min(s.editIndex,s.ends.length),0,s.cur);
    else s.ends.push(s.cur);
    s.cur=[];
  }
  delete s.cur; delete s.editIndex;
  const isEdit=!!s._edit; delete s._edit;
  db.active=null;
  if(isEdit){
    const i=db.sessions.findIndex(x=>x.id===s.id);
    if(i>=0) db.sessions[i]=s; else db.sessions.push(s);
  }else{
    db.sessions.push(s);
  }
  nativePulse("success");
  save();
  openSummary(s, !isEdit);
}

/* ---------- summary modal ---------- */
function openSummary(sess, isNew){
  const setup=db.setups.find(x=>x.id===sess.setupId);
  const m=sessionMetrics(sess);
  const all=m.all, total=m.total, st=m.st;
  const adv=adviceFor(sess, setup);
  const ovl=document.createElement("div"); ovl.className="ovl";
  ovl.innerHTML=`<div class="sheet">
    <h3>${isNew?"おつかれさまでした！":""} ${fmtD(sess.date)} ・ ${sess.dist}m</h3>
    ${summaryDecisionHtml(adv,sess)}
    <div class="statbar">
      <div class="stat"><b>${total}</b><span>合計 (${all.length}本)</span></div>
      <div class="stat"><b>${(total/all.length).toFixed(2)}</b><span>平均/本</span></div>
      <div class="stat"><b>${perfectScoreCount(all,sess)}</b><span>${perfectScoreLabel(sess)}</span></div>
      <div class="stat"><b>${secondaryScoreCount(all,sess)}</b><span>${secondaryScoreLabel(sess)}</span></div>
    </div>
    <div id="sumPlot" class="recordSummaryPlot"></div>
    ${groupSummaryHtml(st)}
    ${summarySightDialHtml(sess,adv)}
    ${nextActionHtml(sess,adv,setup)}
    <details class="adv summaryDetails">
      <summary>詳しい根拠を見る</summary>
      ${trustHtml(sess,setup,st)}
      ${roundProgressHtml(sess)}
      ${(sess.sightV||sess.sightH)?`<div class="kv"><span>使用サイト</span><span>上下 ${esc(sess.sightV||"—")} / 左右 ${esc(sess.sightH||"—")}</span></div>`:""}
      ${arrowMetaSummaryHtml(sess)}
      ${adv?`<div class="advice"><div class="recordAdviceLabel">サイト調整の提案</div>${adv.lines.map(l=>`<div class="dir">${l.html}</div>`).join("")}
        ${judgementHtml(adv,sess)}
        ${shapeNote(adv.st)}
        ${adv.notes.map(n=>`<div class="note">・${n}</div>`).join("")}
        <div class="note">※「矢の集まった方向へサイトを動かす」が原則。mm目安はアイ〜サイト距離 ${db.settings.eyeSight||850}mm と弾道モデルから計算した参考値です（サイトタブで変更可）。</div></div>`:""}
      ${personalModelHtml(adv,sess,setup)}
      ${conditionHtml(sess,st,setup)}
    </details>
    ${sess.setupId&&(sess.sightV||sess.sightH)?`<div class="btnrow"><button class="btn sec" id="sumMark">📒 このサイト値を台帳に記録</button></div>`:""}
    <div class="btnrow"><button class="btn sec" id="sumCard">画像保存</button><button class="btn ghost" id="sumClose">閉じる</button></div>
  </div>`;
  openModal(ovl,{escapeTarget:"#sumClose"});
  plotSession(sess, ovl.querySelector("#sumPlot"));
  const mk=ovl.querySelector("#sumMark");
  if(mk) mk.onclick=()=>{
    db.sightMarks.push({id:uid(), setupId:sess.setupId, dist:sess.dist,
      v:sess.sightV, h:sess.sightH, date:sess.date, ts:Date.now(),
      note:`練習記録より（${all.length}本 / 平均${(total/all.length).toFixed(1)}）`});
    save(); toast("サイト台帳に記録しました"); mk.disabled=true;
  };
  ovl.querySelector("#sumCard").onclick=()=>exportScorecardImage(sess);
  ovl.querySelector("#sumClose").onclick=()=>{ closeModal(ovl); render(); };
}

/* ---------- 履歴 ---------- */
function historySessionRows(src){
  const rows=Array.isArray(src)?src:[];
  const arrowsOf=s=>Array.isArray(s&&s.ends)?s.ends.flatMap(end=>Array.isArray(end)?end:[]):[];
  const scoreOf=a=>{ const v=Number(a&&a.s); return Number.isFinite(v)?v:0; };
  return rows.map(s=>{
    const arrows=arrowsOf(s);
    const total=arrows.reduce((a,x)=>a+scoreOf(x),0);
    return {s,arrows,total};
  });
}
function historySummaryDetailsHtml(sessionRows,filter){
  return `${distanceSummaryHtml(sessionRows)}${sightSummaryHtml(sessionRows,filter)}${groupingSummaryHtml(sessionRows)}`;
}
function scoreTrendCard(ss){
  const rows=historySessionRows(ss).filter(r=>r.arrows.length).slice(0,8);
  if(!rows.length) return "";
  const body=rows.map(r=>{
    const avg=r.arrows.length?r.total/r.arrows.length:null;
    const avgText=Number.isFinite(avg)?avg.toFixed(2):"—";
    const totalText=Number.isFinite(r.total)?String(r.total):"—";
    const date=r.s&&r.s.date?fmtD(r.s.date):"日付未設定";
    const dist=distanceLabel(r.s&&r.s.dist);
    return `<div class="listItem recordReadOnlyItem">
      <div><div class="t">${esc(date)}</div><div class="d">${esc(dist)} / ${r.arrows.length}本</div></div>
      <div class="big">${avgText}<small> / 合計${totalText}</small></div>
    </div>`;
  }).join("");
  return `<div class="card"><h2>スコア推移 <span class="mini">直近${rows.length}回</span></h2>${body}</div>`;
}
function setupPerformanceLabel(setupId){
  if(!setupId) return {key:"setup:none",label:"セットアップ未設定"};
  const setup=(db.setups||[]).find(s=>s.id===setupId);
  if(setup) return {key:`setup:${setup.id}`,label:setup.name||"名称未設定"};
  return {key:"setup:deleted",label:"削除済みセットアップ"};
}
function setupPerformanceCard(ss){
  const rows=historySessionRows(ss);
  const groups=new Map();
  rows.forEach(r=>{
    const info=setupPerformanceLabel(r.s&&r.s.setupId);
    const g=groups.get(info.key)||{
      label:info.label,
      sessions:0,
      arrows:0,
      total:0,
      best:null,
      latestDate:""
    };
    g.sessions++;
    g.arrows+=r.arrows.length;
    g.total+=r.total;
    const date=r.s&&r.s.date||"";
    if(date>g.latestDate) g.latestDate=date;
    if(r.arrows.length && (!g.best || r.total>g.best.total || (r.total===g.best.total && date>(g.best.date||"")))){
      g.best={total:r.total,date,arrows:r.arrows.length};
    }
    groups.set(info.key,g);
  });
  const list=[...groups.values()]
    .filter(g=>g.sessions)
    .sort((a,b)=>
      b.sessions-a.sessions ||
      (b.latestDate||"").localeCompare(a.latestDate||"") ||
      (b.arrows?b.total/b.arrows:-1)-(a.arrows?a.total/a.arrows:-1) ||
      a.label.localeCompare(b.label)
    );
  if(!list.length) return "";
  const body=list.map(g=>{
    const avg=g.arrows?g.total/g.arrows:null;
    const avgText=Number.isFinite(avg)?avg.toFixed(2):"—";
    const bestText=g.best&&Number.isFinite(g.best.total)?String(g.best.total):"—";
    const latest=g.latestDate?fmtD(g.latestDate):"—";
    return `<div class="listItem recordReadOnlyItem">
      <div><div class="t">${esc(g.label)}</div><div class="d">記録 ${g.sessions}回 / 矢数 ${g.arrows} / 最新 ${esc(latest)}</div></div>
      <div class="big">${avgText}<small> / 最高${bestText}</small></div>
    </div>`;
  }).join("");
  return `<div class="card"><h2>セットアップ別成績 <span class="mini">${list.length}件</span></h2>${body}</div>`;
}
function sightHistoryCard(ss){
  const markRows=(Array.isArray(db.sightMarks)?db.sightMarks:[])
    .filter(m=>hasSightInput(m&&m.v)||hasSightInput(m&&m.h))
    .map(m=>Object.assign({source:"台帳"},m));
  const sessionRows=(Array.isArray(ss)?ss:[])
    .filter(s=>hasSightInput(s&&s.sightV)||hasSightInput(s&&s.sightH))
    .map(s=>({
      source:"練習",
      setupId:s.setupId,
      dist:s.dist,
      v:s.sightV,
      h:s.sightH,
      date:s.date,
      ts:0
    }));
  const rows=[...markRows,...sessionRows].map(row=>{
    const date=sightDateInfo(row);
    const setup=setupPerformanceLabel(row.setupId);
    const distInfo=distanceBucketInfo(row.dist);
    return {row,date,setup,distInfo};
  }).sort((a,b)=>
    (b.date.sort||"").localeCompare(a.date.sort||"") ||
    (b.distInfo.sort>0?1:0)-(a.distInfo.sort>0?1:0) ||
    (b.setup.key==="setup:none"?0:1)-(a.setup.key==="setup:none"?0:1) ||
    a.setup.label.localeCompare(b.setup.label)
  ).slice(0,10);
  if(!rows.length) return "";
  const body=rows.map(({row,date,setup,distInfo})=>{
    return `<div class="listItem recordReadOnlyItem">
      <div><div class="t">${esc(date.label)} ・ ${esc(distInfo.label)}</div><div class="d">${esc(setup.label)} / ${esc(row.source||"履歴")}</div></div>
      <div class="big">上下 ${esc(sightValueText(row.v))}<small> / 左右${esc(sightValueText(row.h))}</small></div>
    </div>`;
  }).join("");
  return `<div class="card"><h2>サイト履歴 <span class="mini">直近${rows.length}件</span></h2>${body}</div>`;
}
function historyOverviewHtml(allSs,ss){
  const src=Array.isArray(ss)?ss:allSs;
  if(!allSs.length) return "";
  const sessionRows=historySessionRows(src);
  const arrows=sessionRows.flatMap(r=>r.arrows);
  const total=sessionRows.reduce((a,r)=>a+r.total,0);
  const avg=arrows.length?total/arrows.length:0;
  const recent=[...src].sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.id<a.id?-1:1)).slice(0,5);
  const recentSet=new Set(recent);
  const recentRows=sessionRows.filter(r=>recentSet.has(r.s));
  const recentArrows=recentRows.flatMap(r=>r.arrows);
  const recentTotal=recentRows.reduce((a,r)=>a+r.total,0);
  const recentAvg=recentArrows.length?recentTotal/recentArrows.length:0;
  const setupCount=new Set(src.map(s=>s.setupId||"none")).size;
  const distCount=new Set(src.map(s=>s.dist).filter(Boolean)).size;
  const quality=src.map(s=>sessionQuality(s,db.setups.find(x=>x.id===s.setupId))).filter(Boolean);
  const qualityScores=quality.map(q=>Number(q.score)).filter(Number.isFinite);
  const qAvg=qualityScores.length?qualityScores.reduce((a,s)=>a+s,0)/qualityScores.length:0;
  const latest=recent[0]||null;
  const latestLabel=latest?[fmtD(latest.date),distanceLabel(latest.dist)].filter(Boolean).join(" "):"—";
  const best=sessionRows.filter(r=>r.arrows.length).sort((a,b)=>b.total-a.total || b.arrows.length-a.arrows.length || (b.s.date||"").localeCompare(a.s.date||""))[0];
  const bestMeta=best?[fmtD(best.s.date),distanceLabel(best.s.dist),`${best.arrows.length}本`].filter(Boolean).join(" / "):"記録待ち";
  return `<div class="insightStrip">
    <div class="insightTile"><div class="k">記録サマリー</div><b>${src.length}回</b><span>${arrows.length}本 / 最新 ${esc(latestLabel)}</span></div>
    <div class="insightTile"><div class="k">平均点</div><b>${avg?avg.toFixed(2):"—"}</b><span>直近${recent.length}回 ${recentAvg?recentAvg.toFixed(2):"—"} / 判断材料 ${pct(qAvg)}</span></div>
    <div class="insightTile"><div class="k">最高合計</div><b>${best?best.total:"—"}</b><span>${esc(bestMeta)} / ${distCount}距離・${setupCount}用具</span></div>
  </div>`;
}
function distanceLabel(dist){
  return distanceBucketInfo(dist).label;
}
function distanceBucketInfo(dist){
  const n=Number(dist);
  if(Number.isFinite(n) && n>0){
    const rounded=Math.round(n*10)/10;
    const label=`${Number.isInteger(rounded)?rounded:rounded.toFixed(1)}m`;
    return {key:`dist:${label}`,label,sort:rounded};
  }
  return {key:"dist:none",label:"距離未設定",sort:-1};
}
function historyAnalysisDetailsHtml(title, meta, bodyHtml){
  if(!bodyHtml) return "";
  return `<details class="adv historyAnalysisDetails">
    <summary>${esc(title)} <span class="mini">${esc(meta||"")}</span></summary>
    ${bodyHtml}
  </details>`;
}
function distanceSummaryHtml(sessionRows){
  const byDist=new Map();
  sessionRows.forEach(r=>{
    const info=distanceBucketInfo(r.s&&r.s.dist);
    const g=byDist.get(info.key)||{label:info.label,sort:info.sort,sessions:0,arrows:0,total:0,best:null,latestDate:""};
    g.sessions++;
    g.arrows+=r.arrows.length;
    g.total+=r.total;
    if((r.s&&r.s.date||"")>g.latestDate) g.latestDate=r.s.date||"";
    if(r.arrows.length && (!g.best || r.total>g.best.total || (r.total===g.best.total && (r.s&&r.s.date||"")>(g.best.date||"")))){
      g.best={total:r.total,date:r.s&&r.s.date||"",arrows:r.arrows.length};
    }
    byDist.set(info.key,g);
  });
  const rows=[...byDist.values()].sort((a,b)=>b.sort-a.sort || b.sessions-a.sessions || a.label.localeCompare(b.label));
  if(!rows.length) return "";
  const body=rows.map(g=>{
      const avg=g.arrows?(g.total/g.arrows).toFixed(2):"—";
      const latest=g.latestDate?fmtD(g.latestDate):"—";
      return `<div class="listItem recordReadOnlyItem">
        <div><div class="t">${esc(g.label)}</div><div class="d">${g.sessions}回 / ${g.arrows}本 / 最新 ${esc(latest)}</div></div>
        <div class="big">${avg}<small> / 最高${g.best?g.best.total:"—"}</small></div>
      </div>`;
    }).join("");
  return historyAnalysisDetailsHtml("距離別サマリー",`${rows.length}距離`,body);
}
function sightValueText(v){
  const raw=String(v==null?"":v).trim();
  if(!raw) return "—";
  const n=Number(raw);
  return Number.isFinite(n)?raw:"—";
}
function hasSightInput(v){
  return v!=null && String(v).trim()!=="";
}
function sightDateInfo(item){
  const iso=String(item&&item.date||"").trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(iso)) return {sort:iso,label:fmtD(iso)};
  const ts=Number(item&&item.ts);
  if(Number.isFinite(ts) && ts>0){
    const d=new Date(ts);
    if(Number.isFinite(d.getTime())){
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
      const fallback=`${y}-${m}-${day}`;
      return {sort:fallback,label:fmtD(fallback)};
    }
  }
  return {sort:"",label:"—"};
}
function setupNameFor(id){
  const setup=(db.setups||[]).find(s=>s.id===id);
  return setup&&setup.name?setup.name:"用具未指定";
}
function sightSummaryHtml(sessionRows,filter){
  const hf=filter||ui.histFilter||{setupId:"",dist:""};
  const setupOk=id=>!hf.setupId || (hf.setupId==="__none"?!id:hf.setupId===id);
  const distOk=dist=>!hf.dist || String(dist)===String(hf.dist);
  const markRows=(Array.isArray(db.sightMarks)?db.sightMarks:[])
    .filter(m=>setupOk(m&&m.setupId) && distOk(m&&m.dist))
    .map(m=>Object.assign({source:"台帳"},m));
  const sessionSightRows=(sessionRows||[]).map(r=>r.s).filter(s=>s && (hasSightInput(s.sightV)||hasSightInput(s.sightH)))
    .map(s=>({source:"練習",setupId:s.setupId,dist:s.dist,v:s.sightV,h:s.sightH,date:s.date,ts:0}));
  const rows=[...markRows,...sessionSightRows];
  if(!rows.length) return "";
  const byDist=new Map();
  rows.forEach(row=>{
    const info=distanceBucketInfo(row.dist);
    const date=sightDateInfo(row);
    const current=byDist.get(info.key)||{label:info.label,sort:info.sort,markCount:0,sessionCount:0,latest:null};
    if(row.source==="台帳") current.markCount++;
    else current.sessionCount++;
    const candidate={row,date,setupName:setupNameFor(row.setupId)};
    if(!current.latest || date.sort>current.latest.date.sort || (date.sort===current.latest.date.sort && row.source==="台帳")){
      current.latest=candidate;
    }
    byDist.set(info.key,current);
  });
  const groups=[...byDist.values()].sort((a,b)=>b.sort-a.sort || (b.latest&&b.latest.date.sort||"").localeCompare(a.latest&&a.latest.date.sort||"") || a.label.localeCompare(b.label));
  const totalMarks=markRows.length, totalSessions=sessionSightRows.length;
  const body=groups.map(g=>{
      const latest=g.latest||{};
      const row=latest.row||{};
      return `<div class="listItem recordReadOnlyItem">
        <div><div class="t">${esc(g.label)}</div><div class="d">${esc(latest.setupName||"用具未指定")} / 最新 ${esc(latest.date?latest.date.label:"—")} / 台帳${g.markCount}・練習${g.sessionCount}</div></div>
        <div class="big">${esc(sightValueText(row.v))}<small> / 左右${esc(sightValueText(row.h))}</small></div>
      </div>`;
    }).join("");
  return historyAnalysisDetailsHtml("サイトサマリー",`台帳${totalMarks}件 / 練習入力${totalSessions}回`,body);
}
function groupingMetricNumber(v){
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}
function groupingMetricText(v){
  const n=groupingMetricNumber(v);
  return n==null?"—":`${n.toFixed(1)}cm`;
}
function groupingSessionRow(row){
  /* robustStats 直呼びはやめ、同じ Number 化＋有限フィルタ済みの sessionMetrics キャッシュを経由する */
  const st=row&&row.s?sessionMetrics(row.s).st:null;
  if(!st || st.total<3 || st.n<3) return null;
  const rr=groupingMetricNumber(st.rr);
  if(rr==null) return null;
  return {
    session:row.s,
    distInfo:distanceBucketInfo(row.s&&row.s.dist),
    date:sightDateInfo(row.s||{}),
    rr,
    sx:groupingMetricNumber(st.sx),
    sy:groupingMetricNumber(st.sy),
    n:st.n
  };
}
function groupingSummaryHtml(sessionRows){
  const rows=(sessionRows||[]).map(groupingSessionRow).filter(Boolean);
  if(!rows.length) return "";
  const avg=rows.reduce((a,r)=>a+r.rr,0)/rows.length;
  const best=[...rows].sort((a,b)=>a.rr-b.rr || (b.date.sort||"").localeCompare(a.date.sort||""))[0];
  const latest=[...rows].sort((a,b)=>(b.date.sort||"").localeCompare(a.date.sort||"") || b.rr-a.rr)[0];
  const byDist=new Map();
  rows.forEach(r=>{
    const g=byDist.get(r.distInfo.key)||{label:r.distInfo.label,sort:r.distInfo.sort,sessions:0,total:0,best:null,latest:null};
    g.sessions++;
    g.total+=r.rr;
    if(!g.best || r.rr<g.best.rr) g.best=r;
    if(!g.latest || (r.date.sort||"")>(g.latest.date.sort||"")) g.latest=r;
    byDist.set(r.distInfo.key,g);
  });
  const groups=[...byDist.values()].sort((a,b)=>b.sort-a.sort || b.sessions-a.sessions || a.label.localeCompare(b.label));
  const meta=r=>[r.distInfo.label,r.date.label].filter(x=>x&&x!=="—").join(" / ")||"—";
  const body=`<div class="insightStrip">
      <div class="insightTile"><div class="k">平均RMS</div><b>${groupingMetricText(avg)}</b><span>${rows.length}セッションから集計</span></div>
      <div class="insightTile"><div class="k">最小RMS</div><b>${groupingMetricText(best&&best.rr)}</b><span>${esc(best?meta(best):"—")}</span></div>
      <div class="insightTile"><div class="k">最新RMS</div><b>${groupingMetricText(latest&&latest.rr)}</b><span>${esc(latest?meta(latest):"—")}</span></div>
    </div>
    ${groups.map(g=>{
      const distAvg=g.sessions?g.total/g.sessions:null;
      const latest=g.latest&&g.latest.date.label?g.latest.date.label:"—";
      return `<div class="listItem recordReadOnlyItem">
        <div><div class="t">${esc(g.label)}</div><div class="d">${g.sessions}回 / 最新 ${esc(latest)}</div></div>
        <div class="big">${groupingMetricText(distAvg)}<small> / 最小${groupingMetricText(g.best&&g.best.rr)}</small></div>
      </div>`;
    }).join("")}`;
  return historyAnalysisDetailsHtml("グルーピングサマリー",`対象${rows.length}回`,body);
}
