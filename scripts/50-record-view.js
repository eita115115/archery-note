"use strict";
/* Archery Note: record and active-session views */
/* ============ views ============ */
let view="record";
let ui={ selArrow:-1, sightSel:{setupId:null, dist:70}, histOpen:null, histFilter:{setupId:"",dist:"",round:""}, zoom:1, recordMode:"practice" };
function showView(v){ view=v; ui.selArrow=-1; nativePulse("light"); render(); }
document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>showView(b.dataset.v));

function render(){
  updateAppChrome();
  document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b.dataset.v===view));
  const m=$("#main");
  if(view==="record") renderRecord(m);
  else if(view==="history") renderHistory(m);
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
  return `${recordPhaseArcHtml(0,"今日はまず記録。詳しい材料はあとから足せます。")}
  <section class="missionPanel convergeMission">
    <div class="missionTop">
      <img class="startLogoMark" src="icon.svg" alt="">
      <div>
        <div class="eyebrow">Archery Note</div>
        <h2>${mode==="calibration"?"サイト値も残す":"練習を始める"}</h2>
        <p>点取りだけで始められます。サイト値・風・用具は、余裕がある時だけ詳しく残せます。</p>
      </div>
      <div class="readinessDial"><b>${scorePct(sys.score)}</b><span>${esc(sys.level)}</span></div>
    </div>
    <div class="simplePromise">距離を選ぶ <span>→</span> 的でタップ <span>→</span> 結果を見る</div>
    ${recordCoachCardHtml()}
    <details class="adv missionMore" ${mode==="calibration"?"open":""}>
      <summary>詳しいモード・準備度を見る</summary>
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
    <div class="lensCard"><div class="k">${dist?dist+"m サイト":"サイト台帳"}</div><b>${markText}</b><span>演算入力 ${gp.level} / 個人モデル ${mp.level}</span></div>
  </div>`;
}
function renderRecord(m){
  if(db.active){ renderActive(m); return; }
  const last=db.sessions[db.sessions.length-1];
  const defSetup=last?last.setupId:(db.setups[0]?db.setups[0].id:"");
  const defDist=last?last.dist:70;
  const mode=ui.recordMode||"practice";
  const sys=setupSystemSummary(defSetup);
  m.innerHTML=`
  ${recordIntroHtml(sys,mode)}
  <section class="launchPanel convergeLaunch">
    <div class="launchHead">
      <div class="launchTitle"><div class="stepBadge">01</div><h2>${mode==="calibration"?"サイト値を残す練習":"今日の練習"}</h2></div>
      <button class="tinyAction" id="jumpGear">用具</button>
    </div>
    <div class="launchBody">
    <p class="quickStartCopy">まずは距離・的・本数だけで始められます。サイト値や風は、必要な時だけ下で詳しく残せます。</p>
    <label class="f">距離</label>
    <div class="chips quickDists" id="fDistChips">
      ${[70,50,30,18].map(d=>`<div class="chip ${d===defDist?"on":""}" data-d="${d}">${d}m</div>`).join("")}
      <div class="chip" data-d="custom">カスタム</div>
    </div>
    <div id="fDistCustomWrap" style="display:none"><label class="f">距離 (m)</label><input class="inp" type="number" id="fDistCustom" min="5" max="90" step="1" placeholder="例: 60"></div>
    <div class="quickSelects">
      <div><label class="f">的</label><select class="inp" id="fFace">
        <optgroup label="ターゲット">
          ${[122,80,60,40].map(f=>`<option value="${f}">${f}cm</option>`).join("")}
          <option value="T40">40cm 三つ目（縦）</option>
        </optgroup>
        <optgroup label="フィールド">
          ${FIELD_FACE_SIZES.map(f=>`<option value="F${f}">${f}cm フィールド</option>`).join("")}
        </optgroup>
      </select></div>
      <div><label class="f">1エンドの本数</label><select class="inp" id="fArrows">${[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>`<option value="${n}" ${n===6?"selected":""}>${n}本</option>`).join("")}</select></div>
    </div>
    <div class="btnrow"><button class="btn startPrimary" id="fStart">${mode==="calibration"?"サイト値つきで開始":"記録開始"}</button></div>
    <div class="softDivider"></div>
    <details class="adv recordDetails" ${mode==="calibration"?"open":""}>
      <summary>詳しく残す（日付・用具・サイト値・天候）</summary>
      <div class="fieldBand">
        <div><label class="f">用具セッティング</label><select class="inp" id="fSetup">${setupOptions(defSetup)}</select></div>
        ${recordSetupSnapshot(defSetup,defDist)}
      </div>
      <label class="f">日付</label><input class="inp" type="date" id="fDate" value="${today()}">
      <label class="f">ラウンド</label><select class="inp" id="fRound">
        ${ROUND_TYPES.map(r=>`<option value="${r.id}">${r.label}</option>`).join("")}
      </select>
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
    ${mode==="calibration"?`<div class="advice" style="background:var(--card);border-color:var(--line)"><div class="note"><b>サイト値を残すコツ</b> — サイト値を必ず入力し、風があれば風向/風速も残します。同じ距離で2回以上残ると履歴推定が強くなります。</div></div>`:""}
    ${db.setups.length?"":`<div class="hint">「用具」タブでセッティングを登録しておくと、サイト台帳や調整提案がセッティングごとに管理できます。</div>`}
    </div>
  </section>`;
  const distState={d:defDist};
  const faceSel=$("#fFace");
  const suggestFace=d=>{ if(String(faceSel.value).startsWith("F")) return; faceSel.value = d>=60?122:(d<=18?40:80); };
  suggestFace(defDist);
  faceSel.onchange=()=>{
    if(String(faceSel.value).startsWith("F") && $("#fArrows").value==="6") $("#fArrows").value="3";
  };
  $("#fRound").onchange=e=>{
    if(e.target.value==="field72"){
      if(!String(faceSel.value).startsWith("F")) faceSel.value="F80";
      $("#fArrows").value="3";
    }
  };
  $("#jumpGear").onclick=()=>showView("gear");
  document.querySelectorAll("#flowMode .flowBtn").forEach(b=>b.onclick=()=>{
    if(b.dataset.mode==="diagnosis"){ showView("sight"); return; }
    ui.recordMode=b.dataset.mode; render();
  });
  function refreshLens(){
    const old=$("#setupLens");
    if(old) old.outerHTML=recordSetupSnapshot($("#fSetup").value, distState.d);
  }
  document.querySelectorAll("#fDistChips .chip").forEach(c=>c.onclick=()=>{
    document.querySelectorAll("#fDistChips .chip").forEach(x=>x.classList.remove("on"));
    c.classList.add("on");
    if(c.dataset.d==="custom"){ $("#fDistCustomWrap").style.display="block"; distState.d=null; }
    else{ $("#fDistCustomWrap").style.display="none"; distState.d=+c.dataset.d; suggestFace(distState.d); fillSight(); }
    refreshLens();
  });
  $("#fDistCustom").oninput=e=>{ distState.d=+e.target.value||null; if(distState.d) {suggestFace(distState.d); fillSight();} refreshLens(); };
  function fillSight(){
    const sid=$("#fSetup").value, d=distState.d;
    if(!sid||!d) return;
    const mk=latestMark(sid,d);
    if(mk){ $("#fSightV").value=mk.v??""; $("#fSightH").value=mk.h??""; }
  }
  $("#fSetup").onchange=()=>{ fillSight(); refreshLens(); };
  fillSight();
  $("#fStart").onclick=()=>{
    const d=distState.d;
    if(!d){ toast("距離を入力してください"); return; }
    const fv=faceSel.value;
    const face=parseFaceChoice(fv);
    db.active={
      id:uid(), date:$("#fDate").value||today(), setupId:$("#fSetup").value||null,
      dist:d, faceD: face.faceD, faceType: face.faceType, perEnd:+$("#fArrows").value,
      shaft:+lineCutRadius(face.faceD, face.faceType).toFixed(3),
      sightV:$("#fSightV").value.trim(), sightH:$("#fSightH").value.trim(),
      wx:$("#fWx").value, note:$("#fNote").value.trim(), windDir:$("#fWindDir").value, windSpeed:$("#fWindSpeed").value.trim(),
      round:$("#fRound").value||"free",
      purpose:ui.recordMode||"practice",
      ends:[], cur:[]
    };
    nativePulse("success");
    save(); render();
  };
}

function sessionArrows(sess){
  return [...((sess&&sess.ends)||[]).flat(), ...((sess&&sess.cur)||[])];
}
function heroMetricHtml(k,b,span){
  return `<div class="heroMetric"><div class="k">${esc(k)}</div><b>${esc(b)}</b><span>${esc(span||"")}</span></div>`;
}
function pageHeroHtml(type,ctx){
  ctx=ctx||{};
  if(type==="history"){
    const src=ctx.ss||db.sessions||[];
    const arrows=src.flatMap(s=>s.ends.flat());
    const total=arrows.reduce((a,x)=>a+x.s,0);
    const latest=src[0]||null;
    return `<section class="pageHero">
      <div class="kicker">Growth map</div>
      <h2>分布と偏移を読む</h2>
      <p>点数だけでなく、同じ用具・同じ距離の中心移動を追います。過去のグルーピングがあるほど、今回のズレが偶然か傾向か見えやすくなります。</p>
      <div class="heroMetrics">
        ${heroMetricHtml("練習",`${src.length}回`,`${arrows.length}本を集計`)}
        ${heroMetricHtml("平均",arrows.length?(total/arrows.length).toFixed(2):"—","フィルター後の平均点")}
        ${heroMetricHtml("直近",latest?`${fmtD(latest.date)} ${latest.dist}m`:"—",latest?roundLabel(latest.round):"記録待ち")}
      </div>
    </section>`;
  }
  if(type==="sight"){
    const setup=ctx.setup, dist=ctx.dist, marks=ctx.marks||[], adv=ctx.adv;
    const cur=marks[0];
    return `<section class="pageHero">
      <div class="kicker">Sight tuning</div>
      <h2>サイト値を整える</h2>
      <p>距離ごとのサイト値と最新グルーピングから、動かす時・保留する時・射形を優先する時を分けて見ます。</p>
      <div class="heroMetrics">
        ${heroMetricHtml("対象",setup?setup.name:"用具未指定",dist?`${dist}m`:"距離未指定")}
        ${heroMetricHtml("最新サイト",cur?`上下 ${cur.v||"—"}`:"未登録",cur?`左右 ${cur.h||"—"}`:"台帳へ記録")}
        ${heroMetricHtml("提案",adv&&adv.lines.length?adv.lines[0].text||"調整あり":"材料待ち",adv?`信頼 ${sessionQuality(ctx.lastSess||{},setup).label}`:"練習記録が必要")}
      </div>
    </section>`;
  }
  if(type==="gear"){
    const setups=db.setups||[];
    const profiles=setups.map(s=>gearPrecisionProfile(s));
    const avg=profiles.length?profiles.reduce((a,p)=>a+p.score,0)/profiles.length:0;
    const best=setups.map(s=>({s,p:gearPrecisionProfile(s),m:modelReadinessProfile(s.id)})).sort((a,b)=>(b.p.score+b.m.score)-(a.p.score+a.m.score))[0];
    return `<section class="pageHero">
      <div class="kicker">Equipment lab</div>
      <h2>用具を演算できるデータにする</h2>
      <p>ハンドルやリムの名前だけで終わらせず、矢重量・矢径・FOC・実測初速まで整理します。ここが整うほど物理モデルが現実の弓に近づきます。</p>
      <div class="heroMetrics">
        ${heroMetricHtml("登録",`${setups.length}件`,`${db.sessions.filter(s=>s.setupId).length}回の練習に接続`)}
        ${heroMetricHtml("演算入力",pct(avg),"用具データの平均充実度")}
        ${heroMetricHtml("主戦用具",best?best.s.name:"—",best?`演算 ${best.p.level} / 個人 ${best.m.level}`:"初回セットアップ待ち")}
      </div>
    </section>`;
  }
  return "";
}
function liveSessionHeroHtml(s,setup){
  const all=sessionArrows(s);
  const total=all.reduce((a,x)=>a+x.s,0);
  const avg=all.length?(total/all.length).toFixed(2):"—";
  const remain=Math.max(0,(s.perEnd||6)-(s.cur||[]).length);
  const r=ROUND_TYPES.find(x=>x.id===s.round);
  const roundRemain=r&&r.arrows?Math.max(0,r.arrows-all.length):null;
  return `<section class="liveHud">
    <div class="kicker">Live scoring desk</div>
    <h2>${s._edit?"過去記録を整える":"今このエンドに集中"}</h2>
    <div class="liveGrid">
      <div class="liveCell"><div class="k">合計</div><b>${total}</b></div>
      <div class="liveCell"><div class="k">平均</div><b>${avg}</b></div>
      <div class="liveCell"><div class="k">現在エンド</div><b>${(s.cur||[]).length}/${s.perEnd||6}</b></div>
      <div class="liveCell"><div class="k">残り</div><b>${roundRemain==null?`${remain}本`:roundRemain+"本"}</b></div>
    </div>
    <div class="nativeSignal">
      <span class="on">${setup?esc(setup.name):"用具未指定"}</span>
      <span>${s.dist}m / ${faceLabel(s)}</span>
      <span>${runtimeKind().label}</span>
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
  ${recordPhaseArcHtml(1,"的をタップして、このエンドを積み上げる。")}
  ${liveSessionHeroHtml(s,setup)}
  <div class="card targetFocusCard">
    <div class="targetTools">
      <h2>記録中${s._edit?"（過去記録の編集）":""} <span class="mini">${fmtD(s.date)} ・ ${s.dist}m ・ ${faceLabel(s)} ・ ${setup?esc(setup.name):"セッティング未指定"}</span></h2>
      ${s.faceType==="triple"?"":`<div class="chips" id="zoomChips">
        ${[[1,"全体"],[2,"×2"],[3,"×3"]].map(([z,lb])=>`<div class="chip ${(ui.zoom||1)===z?"on":""}" data-z="${z}">${lb}</div>`).join("")}
      </div>`}
    </div>
    <div class="tgWrap" id="tgWrap">
      ${targetMarkup(s.faceD,"tg",s.faceType)}
      <div class="lens" id="lens"><svg id="lensSvg" width="122" height="122"><use href="#tgmain"/><g id="lensCross"></g></svg></div>
      <div class="lensTag" id="lensTag">微調整モード</div>
    </div>
    <div class="targetHint">タップ＆ドラッグで確定。押したまま0.4秒で微調整、矢チップをタップで修正できます。</div>
    ${activeGuideHtml()}
    <div class="scoreChips" id="curChips"></div>
    <div class="nudge" id="nudge">
      <div style="font-size:12px;color:var(--sub)">選択中の矢を微調整（1目盛 = ${(s.faceD/200).toFixed(1)}cm）</div>
      <div class="npad">
        <span class="blank"></span><button data-n="u">▲</button><span class="blank"></span>
        <button data-n="l">◀</button><button data-n="del" style="color:var(--danger)">🗑</button><button data-n="r">▶</button>
        <span class="blank"></span><button data-n="d">▼</button><span class="blank"></span>
      </div>
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
    document.querySelectorAll("#zoomChips .chip").forEach(x=>x.classList.toggle("on",x===c));
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
function refreshActive(){
  const s=db.active; if(!s) return;
  // markers
  let html="";
  const gp=a=> s.faceType==="triple" ? {x:a.x, y:a.y+SPOT_Y[a.spot||0]} : a;
  s.ends.forEach((end,ei)=>end.forEach(a=>{ html+=markCircle(gp(a),s.faceD,"rgba(60,60,60,.45)"); }));
  s.cur.forEach((a,i)=>{ html+=markCircle(gp(a),s.faceD, i===ui.selArrow?"#111":"var(--green-l)", scoreLabel(a)); });
  $("#tgmarks").innerHTML=html;
  // chips
  $("#curChips").innerHTML = s.cur.map((a,i)=>{
    const z=zoneStyle(a.s,a.X,s.faceType);
    return `<div class="sc ${i===ui.selArrow?"sel":""}" data-i="${i}" style="background:${z.bg};color:${z.fg}">${scoreLabel(a)}</div>`;
  }).join("") || `<span style="font-size:12px;color:var(--sub);align-self:center">エンド${s.ends.length+1}：的をタップして記録</span>`;
  document.querySelectorAll("#curChips .sc").forEach(c=>c.onclick=()=>{
    ui.selArrow = (ui.selArrow===+c.dataset.i)? -1 : +c.dataset.i; nativePulse("light"); refreshActive();
  });
  $("#nudge").classList.toggle("on", ui.selArrow>=0);
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
        <td class="right"><button class="btn sm ghost" data-open="${i}" style="padding:4px 8px">✏</button></td></tr>`;
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
  nativePulse("light"); save(); refreshActive();
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
    nativePulse(isLineCuttingFromGlobal(p.x,p.y,s.faceD,s.faceType)?"success":"light");
    save(); refreshActive();
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
  const all=sess.ends.flat();
  const total=all.reduce((a,x)=>a+x.s,0);
  const st=robustStats(all);
  const adv=adviceFor(sess, setup);
  const ovl=document.createElement("div"); ovl.className="ovl";
  ovl.innerHTML=`<div class="sheet">
    ${recordPhaseArcHtml(2,"結果を確認して、次のエンドやサイト台帳へつなげる。")}
    <h3>${isNew?"おつかれさまでした！":""} ${fmtD(sess.date)} ・ ${sess.dist}m</h3>
    ${summaryDecisionHtml(adv,sess)}
    <div class="statbar">
      <div class="stat"><b>${total}</b><span>合計 (${all.length}本)</span></div>
      <div class="stat"><b>${(total/all.length).toFixed(2)}</b><span>平均/本</span></div>
      <div class="stat"><b>${perfectScoreCount(all,sess)}</b><span>${perfectScoreLabel(sess)}</span></div>
      <div class="stat"><b>${secondaryScoreCount(all,sess)}</b><span>${secondaryScoreLabel(sess)}</span></div>
    </div>
    <div id="sumPlot" style="margin-top:10px"></div>
    ${groupSummaryHtml(st)}
    ${summarySightDialHtml(sess,adv)}
    ${nextActionHtml(sess,adv,setup)}
    <details class="adv summaryDetails">
      <summary>分析根拠・個人モデルを見る</summary>
      ${trustHtml(sess,setup,st)}
      ${roundProgressHtml(sess)}
      ${(sess.sightV||sess.sightH)?`<div class="kv"><span>使用サイト</span><span>上下 ${esc(sess.sightV||"—")} / 左右 ${esc(sess.sightH||"—")}</span></div>`:""}
      ${adv?`<div class="advice"><div style="font-size:12px;color:var(--sub)">サイト調整の提案</div>${adv.lines.map(l=>`<div class="dir">${l.html}</div>`).join("")}
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
  document.body.appendChild(ovl);
  plotSession(sess, ovl.querySelector("#sumPlot"));
  const mk=ovl.querySelector("#sumMark");
  if(mk) mk.onclick=()=>{
    db.sightMarks.push({id:uid(), setupId:sess.setupId, dist:sess.dist,
      v:sess.sightV, h:sess.sightH, date:sess.date, ts:Date.now(),
      note:`練習記録より（${all.length}本 / 平均${(total/all.length).toFixed(1)}）`});
    save(); toast("サイト台帳に記録しました"); mk.disabled=true;
  };
  ovl.querySelector("#sumCard").onclick=()=>exportScorecardImage(sess);
  ovl.querySelector("#sumClose").onclick=()=>{ ovl.remove(); render(); };
}

/* ---------- 履歴 ---------- */
function historyOverviewHtml(allSs,ss){
  const src=ss&&ss.length?ss:allSs;
  if(!allSs.length) return "";
  const arrows=src.flatMap(s=>s.ends.flat());
  const total=arrows.reduce((a,x)=>a+x.s,0);
  const avg=arrows.length?total/arrows.length:0;
  const recent=[...src].sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.id<a.id?-1:1)).slice(0,5);
  const recentArrows=recent.flatMap(s=>s.ends.flat());
  const recentAvg=recentArrows.length?recentArrows.reduce((a,x)=>a+x.s,0)/recentArrows.length:0;
  const setupCount=new Set(src.map(s=>s.setupId||"none")).size;
  const distCount=new Set(src.map(s=>s.dist).filter(Boolean)).size;
  const quality=src.map(s=>sessionQuality(s,db.setups.find(x=>x.id===s.setupId))).filter(Boolean);
  const qAvg=quality.length?quality.reduce((a,q)=>a+q.score,0)/quality.length:0;
  return `<div class="insightStrip">
    <div class="insightTile"><div class="k">履歴の地図</div><b>${src.length}回</b><span>${arrows.length}本 / ${distCount}距離 / ${setupCount}用具</span></div>
    <div class="insightTile"><div class="k">平均点</div><b>${avg?avg.toFixed(2):"—"}</b><span>直近${recent.length}回 ${recentAvg?recentAvg.toFixed(2):"—"}</span></div>
    <div class="insightTile"><div class="k">判断材料</div><b>${pct(qAvg)}</b><span>サイト値・本数・用具入力の平均充実度</span></div>
  </div>`;
}
