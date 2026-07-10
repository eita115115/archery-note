"use strict";
/* Archery Note: storage, native bridge, exports, rounds */
/* ============ storage ============ */
const KEY="archeryNote.v1";
const SNAP_KEY="archeryNote.snapshots.v1";
const SCHEMA_VER=5; /* v5: customRounds 追加のみ。migration 不要（配列補完のみ） */
const APP_VER=75;
const TRASH_LIMIT=50;
const IMPORT_LIMITS={sessions:10000,setups:100,sightMarks:5000,formAnalyses:1000,customRounds:100};
const STORAGE_ADAPTER_VER="storage-adapter v32";
const ENGINE_VER="RK4-3D JS core v32";
const NATIVE_CHANNEL="PWA + Capacitor-ready";
let db = load();
function blankDb(){ return {schema:SCHEMA_VER,setups:[],sightMarks:[],sessions:[],trash:[],formAnalyses:[],customRounds:[],settings:{eyeSight:850,theme:"auto",lastBackupAt:null,activeGuideSeen:false},active:null}; }
/* 矢データの非破壊サニタイズ: 数値文字列 "1.2" は数値へ置換、変換できない値は矢を消さずそのまま残す（既存データ保全） */
function arrowNumberOrKeep(v){
  if(typeof v==="number") return v;
  if(typeof v==="string" && v.trim()!==""){
    const n=Number(v);
    if(Number.isFinite(n)) return n;
  }
  return v;
}
function sanitizeArrowList(arrows){
  if(!Array.isArray(arrows)) return;
  arrows.forEach(a=>{
    if(!a || typeof a!=="object") return;
    /* 変化時のみ代入: 元々キーが無い矢に own property (x: undefined 等) を生やさない */
    const x=arrowNumberOrKeep(a.x); if(x!==a.x) a.x=x;
    const y=arrowNumberOrKeep(a.y); if(y!==a.y) a.y=y;
    const s=arrowNumberOrKeep(a.s); if(s!==a.s) a.s=s;
    if(a.s!=null && typeof a.s!=="number") a.s=0;
    if(a.x!=null && typeof a.x!=="number") a.x=0;
    if(a.y!=null && typeof a.y!=="number") a.y=0;
  });
}
function sanitizeSessionArrows(sess){
  if(!sess || typeof sess!=="object" || !Array.isArray(sess.ends)) return;
  sess.ends.forEach(sanitizeArrowList);
}
function normalizeDb(d){
  const base=blankDb(), src=(d&&typeof d==="object")?d:{};
  const out=Object.assign(base,src);
  out.settings=Object.assign({},blankDb().settings,src.settings||{});
  ["setups","sightMarks","sessions","trash","formAnalyses","customRounds"].forEach(k=>{ if(!Array.isArray(out[k])) out[k]=[]; });
  out.sessions=out.sessions.filter(x=>x&&typeof x==="object"&&x.id).slice(0,IMPORT_LIMITS.sessions);
  out.setups=out.setups.filter(x=>x&&typeof x==="object"&&x.id&&x.name).slice(0,IMPORT_LIMITS.setups);
  out.sightMarks=out.sightMarks.filter(x=>x&&typeof x==="object"&&x.id).slice(0,IMPORT_LIMITS.sightMarks);
  out.formAnalyses=out.formAnalyses.filter(x=>x&&typeof x==="object"&&x.id).slice(0,IMPORT_LIMITS.formAnalyses);
  out.customRounds=out.customRounds.filter(x=>x&&typeof x==="object"&&x.id&&x.label&&Array.isArray(x.stages)).slice(0,IMPORT_LIMITS.customRounds);
  out.trash=out.trash.filter(x=>x&&x.id&&x.type&&x.data).slice(0,TRASH_LIMIT);
  if(out.active==null) out.active=null;
  out.schema=SCHEMA_VER;
  const VALID_FACE_TYPES=["single","triple","field"];
  out.sessions.forEach(s=>{
    if(typeof s.faceD!=="number"||!Number.isFinite(s.faceD)) s.faceD=122;
    if(!VALID_FACE_TYPES.includes(s.faceType)) s.faceType="single";
    if(s.dist!=null&&(typeof s.dist!=="number"||!Number.isFinite(s.dist))) s.dist=18;
    sanitizeSessionArrows(s);
  });
  out.trash.forEach(t=>{ if(t.type==="session") sanitizeSessionArrows(t.data); });
  if(out.active && typeof out.active==="object"){
    sanitizeSessionArrows(out.active);
    sanitizeArrowList(out.active.cur);
  }
  return out;
}
function validateImportData(d){
  if(!d||typeof d!=="object"||Array.isArray(d)) return {ok:false,reason:"不正なデータ形式です"};
  if(!Array.isArray(d.sessions)) return {ok:false,reason:"sessions 配列が見つかりません"};
  if(!Array.isArray(d.setups)) return {ok:false,reason:"setups 配列が見つかりません"};
  const warnings=[];
  for(const [k,limit] of Object.entries(IMPORT_LIMITS)){
    if(Array.isArray(d[k])&&d[k].length>limit) warnings.push(`${k} が ${d[k].length} 件（上限 ${limit}）`);
  }
  return {ok:true,warnings};
}
function storageUsage(){
  try{
    const raw=storageGetItem(KEY), snap=storageGetItem(SNAP_KEY);
    const bytes=(raw?raw.length*2:0)+(snap?snap.length*2:0);
    return {bytes,mb:+(bytes/1048576).toFixed(2)};
  }catch(e){ return {bytes:0,mb:0}; }
}
function load(){
  /* sessions キー欠落でも setups 等を持つ正当なデータは normalizeDb が補完して保持する */
  try{ const d=JSON.parse(storageGetItem(KEY)); if(d && typeof d==="object" && !Array.isArray(d)) return normalizeDb(d); }catch(e){}
  return blankDb();
}
function dataCounts(d=db){
  return {sessions:(d.sessions||[]).length,setups:(d.setups||[]).length,marks:(d.sightMarks||[]).length};
}
function storageBridge(){
  const w=typeof window!=="undefined"?window:{};
  return w.ArcheryNativeStorage||w.ArcheryStorage||null;
}
function storageGetItem(key){
  const bridge=storageBridge();
  try{
    if(bridge && typeof bridge.getItem==="function"){
      const v=bridge.getItem(key);
      if(typeof v==="string" || v==null) return v;
    }
  }catch(e){}
  try{ return typeof localStorage!=="undefined" ? localStorage.getItem(key) : null; }catch(e){ return null; }
}
function storageSetItem(key,value){
  const bridge=storageBridge();
  try{
    if(bridge && typeof bridge.setItem==="function"){
      const ok=bridge.setItem(key,value);
      if(ok!==false) return true;
    }
  }catch(e){}
  if(typeof localStorage==="undefined") return false;
  try{ localStorage.setItem(key,value); return true; }catch(e){ return false; }
}
function storageDriverProfile(){
  const bridge=storageBridge();
  const native=!!(bridge && typeof bridge.getItem==="function" && typeof bridge.setItem==="function");
  return {id:native?"native-sync-bridge":"localStorage",label:native?"ネイティブ保存ブリッジ":"ブラウザ保存",version:STORAGE_ADAPTER_VER,native};
}
function runtimeKind(){
  const w=typeof window!=="undefined"?window:{};
  const nav=typeof navigator!=="undefined"?navigator:{};
  const isNative=!!(w.Capacitor && typeof w.Capacitor.getPlatform==="function");
  const standalone=!!(nav.standalone || (typeof w.matchMedia==="function" && w.matchMedia("(display-mode: standalone)").matches));
  if(isNative) return {kind:"Native", label:"ネイティブ容器", tone:"ok"};
  if(standalone) return {kind:"PWA", label:"ホーム画面", tone:"mid"};
  return {kind:"Web", label:"ブラウザ", tone:"mid"};
}
function capPlugin(name){
  const w=typeof window!=="undefined"?window:{};
  return w.Capacitor && w.Capacitor.Plugins ? w.Capacitor.Plugins[name] : null;
}
function nativeFeatureProfile(){
  const rt=runtimeKind();
  const nav=typeof navigator!=="undefined"?navigator:{};
  return {
    runtime:rt,
    haptics:!!capPlugin("Haptics") || typeof nav.vibrate==="function",
    share:!!capPlugin("Share") || typeof nav.share==="function",
    filesystem:!!capPlugin("Filesystem"),
    statusBar:!!capPlugin("StatusBar"),
    splash:!!capPlugin("SplashScreen")
  };
}
function nativePulse(kind){
  const h=capPlugin("Haptics");
  try{
    if(h && typeof h.impact==="function"){
      const style=kind==="heavy"?"HEAVY":kind==="light"?"LIGHT":"MEDIUM";
      h.impact({style}).catch(()=>{});
      return true;
    }
    if(h && typeof h.selectionChanged==="function"){
      h.selectionChanged().catch(()=>{});
      return true;
    }
  }catch(e){}
  try{
    if(navigator.vibrate){
      const pat=kind==="success"?[12,24,18]:kind==="heavy"?28:12;
      navigator.vibrate(pat);
      return true;
    }
  }catch(e){}
  return false;
}
function updateAppChrome(){
  const rt=runtimeKind();
  const st=$("#appStatus");
  if(st){
    const dot=rt.kind==="Native"?"native":"";
    st.innerHTML=`<span class="statusDot ${dot}"></span><span>${esc(rt.label)}</span>`;
  }
  const sb=capPlugin("StatusBar");
  try{
    if(sb && typeof sb.setBackgroundColor==="function") sb.setBackgroundColor({color:"#17643d"}).catch(()=>{});
    if(sb && typeof sb.setStyle==="function") sb.setStyle({style:"DARK"}).catch(()=>{});
  }catch(e){}
}
function nativeReadinessProfile(){
  const counts=dataCounts();
  const runtime=runtimeKind();
  const storage=storageDriverProfile();
  const native=nativeFeatureProfile();
  const storageScore=clamp((counts.sessions?0.22:0.12)+(counts.setups?0.22:0.08)+(db.settings.lastBackupAt?0.18:0)+(readSnapshots().length?0.18:0)+0.20,0,1);
  const engineScore=.84;
  const nativeScore=clamp(
    (native.haptics ? .25 : .08) +
    (native.share ? .25 : .08) +
    (native.filesystem ? .20 : .04) +
    (native.statusBar ? .12 : .04) +
    (native.splash ? .10 : .04) +
    (runtime.kind==="Native" ? .08 : 0),
    0,1
  );
  const shellScore=clamp(.54 + nativeScore*.36,0,1);
  const next=[];
  if(!db.settings.lastBackupAt) next.push("バックアップ保存");
  if(!counts.setups) next.push("用具登録");
  if(counts.sessions<3) next.push("練習記録");
  if(!next.length) next.push("同条件の記録を増やす");
  return {runtime,storage,native,nativeScore,storageScore,engineScore,shellScore,next,counts};
}
function nativeReadinessHtml(){
  const p=nativeReadinessProfile();
  const nf=p.native;
  return `<details class="adv appInfoDetails">
    <summary>アプリ情報・保存状態</summary>
    <div class="advice" style="background:var(--card);border-color:var(--line)">
    <div class="note"><b>アプリ基盤: ${p.runtime.label}</b> / ${ENGINE_VER} / ${esc(p.storage.label)}</div>
    <div class="nativeStack">
      <div class="nativePill"><div class="k">保存</div><b>${pct(p.storageScore)}</b><span>バックアップと復元を維持</span></div>
      <div class="nativePill"><div class="k">演算</div><b>${pct(p.engineScore)}</b><span>物理コア分離へ移行中</span></div>
      <div class="nativePill"><div class="k">触感/共有</div><b>${pct(p.nativeScore)}</b><span>${nf.haptics?"触感 ":""}${nf.share?"共有 ":""}${nf.filesystem?"ファイル ":""}${nf.statusBar?"表示 ":""}</span></div>
      <div class="nativePill"><div class="k">配布</div><b>${pct(p.shellScore)}</b><span>${NATIVE_CHANNEL}</span></div>
    </div>
    <div class="note">次に整える材料: ${p.next.map(esc).join("・")}</div>
    </div>
  </details>`;
}
function hashText(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0).toString(36);
}
function readSnapshots(){
  try{ const a=JSON.parse(storageGetItem(SNAP_KEY)); return Array.isArray(a)?a:[]; }catch(e){ return []; }
}
function snapshotLabel(s){
  const c=s.counts||dataCounts(s.data||{});
  return `${new Date(s.ts||Date.now()).toLocaleString()}（練習${c.sessions||0} / 用具${c.setups||0} / サイト${c.marks||0}）`;
}
let snapshotJob=null, snapshotPending=null;
function runIdleTask(fn, timeout){
  const w=typeof window!=="undefined"?window:{};
  if(typeof w.requestIdleCallback==="function") return {kind:"idle",id:w.requestIdleCallback(fn,{timeout:timeout||1500})};
  return {kind:"timeout",id:setTimeout(fn,0)};
}
function cancelIdleTask(job){
  const w=typeof window!=="undefined"?window:{};
  if(!job) return;
  if(job.kind==="idle" && typeof w.cancelIdleCallback==="function") w.cancelIdleCallback(job.id);
  else clearTimeout(job.id);
}
let _lastSnapTs=0;
function writeSafetySnapshot(reason="auto", force=false, rawOverride=null){
  try{
    const now=Date.now();
    if(!force && _lastSnapTs && now-_lastSnapTs<30*60*1000) return;
    const raw=rawOverride||JSON.stringify(db), h=hashText(raw);
    const current=readSnapshots();
    let snaps=current.filter(s=>s&&s.hash!==h);
    const latest=current[0];
    if(!force && latest && latest.hash===h){ _lastSnapTs=latest.ts||now; return; }
    if(!force && latest && now-(latest.ts||0)<30*60*1000){ _lastSnapTs=latest.ts||now; return; }
    snaps.unshift({ts:now,reason,hash:h,counts:dataCounts(db),data:JSON.parse(raw)});
    snaps=snaps.slice(0,6);
    for(;;){
      if(storageSetItem(SNAP_KEY,JSON.stringify(snaps))) break;
      if(snaps.length<=1) throw new Error("snapshot storage full");
      snaps.pop();
    }
    _lastSnapTs=now;
  }catch(e){ console.warn("snapshot failed",e); }
}
function flushSafetySnapshot(){
  if(!snapshotPending) return;
  const p=snapshotPending;
  snapshotPending=null;
  if(snapshotJob){ cancelIdleTask(snapshotJob); snapshotJob=null; }
  writeSafetySnapshot(p.reason,p.force,p.raw);
}
function scheduleSafetySnapshot(reason, raw, force){
  if(force){
    snapshotPending=null;
    if(snapshotJob){ cancelIdleTask(snapshotJob); snapshotJob=null; }
    writeSafetySnapshot(reason,true,raw);
    return;
  }
  snapshotPending={reason,raw,force:false};
  if(snapshotJob) return;
  snapshotJob=runIdleTask(()=>{
    snapshotJob=null;
    flushSafetySnapshot();
  },1800);
}
/* メモリ上のみのDB世代カウンタ。db変異（save/scheduleSave）ごとに増やし、セッション統計キャッシュの無効化に使う（保存はしない） */
let DB_REV=0;
/* 高頻度の記録操作（的タップ・ナッジ・理由タグ・矢番号入力）は scheduleSave() でデバウンス書き込みにする。
 * db 全体の JSON.stringify + 書き込みは記録が増えると1回数十msになるため（docs 実測: 300セッションで約50ms/iPhone相当）。
 * データ損失の窓: アイドル600ms（SAVE_DEBOUNCE_MS）、連続入力中でも最大3秒（SAVE_MAX_WAIT_MS）で途中書き込みする。
 * 通常の離脱は pagehide / visibilitychange(hidden) / beforeunload と更新リロード（freshReload）前の
 * flushPendingSave() で同期書き込みされる（scripts/90-init.js）。拾えないのは前面クラッシュ級の異常終了のみ。
 * インポート・復元・削除・セッション終了などの重要操作は従来どおり save() で即時同期書き込み。 */
const SAVE_DEBOUNCE_MS=600;
const SAVE_MAX_WAIT_MS=3000;
let pendingSaveTimer=null, pendingSaveOpts=null, pendingSaveSince=0;
function writeDbNow(o){
  db.schema=SCHEMA_VER; db.updatedAt=new Date().toISOString();
  try{
    const raw=JSON.stringify(db);
    if(!storageSetItem(KEY, raw)) throw new Error("storage write failed");
    scheduleSafetySnapshot(o.reason||"auto", raw, !!o.forceSnapshot);
    return true;
  }catch(e){
    console.error(e);
    try{ toast("保存容量が足りません。設定からバックアップ保存してください",6000); }catch(_){}
    return false;
  }
}
function hasPendingSave(){ return pendingSaveTimer!=null; }
function flushPendingSave(){
  if(pendingSaveTimer==null) return;
  clearTimeout(pendingSaveTimer);
  pendingSaveTimer=null;
  pendingSaveSince=0;
  const o=pendingSaveOpts||{};
  pendingSaveOpts=null;
  writeDbNow(o);
}
function scheduleSave(opts){
  const o=typeof opts==="string"?{reason:opts}:opts||{};
  if(o.forceSnapshot){ save(o); return; } /* スナップショット強制は重要操作なので即時に倒す */
  DB_REV++; /* キャッシュ無効化は「変異した時点」で。書き込み遅延とは独立 */
  pendingSaveOpts=o;
  const now=Date.now();
  if(pendingSaveTimer==null) pendingSaveSince=now;
  else if(now-pendingSaveSince>=SAVE_MAX_WAIT_MS){ flushPendingSave(); return; } /* max-wait: 連続入力中でも先送りを打ち切って書く */
  if(pendingSaveTimer!=null) clearTimeout(pendingSaveTimer);
  pendingSaveTimer=setTimeout(()=>{
    pendingSaveTimer=null;
    pendingSaveSince=0;
    const p=pendingSaveOpts||o;
    pendingSaveOpts=null;
    writeDbNow(p);
  },SAVE_DEBOUNCE_MS);
}
function save(opts){
  DB_REV++;
  const o=typeof opts==="string"?{reason:opts}:opts||{};
  /* 即時書き込みは db 全体の最新状態を書くので、保留中のデバウンス書き込みはここで吸収される */
  if(pendingSaveTimer!=null){ clearTimeout(pendingSaveTimer); pendingSaveTimer=null; pendingSaveOpts=null; }
  return writeDbNow(o);
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function toast(msg,ms){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove("show"),ms||1700); }
function today(){ return new Date().toISOString().slice(0,10); }
/* ---------- モーダル共通（dialog 化とフォーカス管理） ---------- */
const MODAL_FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
function openModal(ovl,opts){
  const o=opts||{};
  const sheet=ovl.querySelector(".sheet")||ovl;
  ovl.setAttribute("role","dialog");
  ovl.setAttribute("aria-modal","true");
  const h3=sheet.querySelector("h3");
  if(h3){if(!h3.id) h3.id="dlg-title-"+(Date.now()%1e5); ovl.setAttribute("aria-labelledby",h3.id);}
  ovl._modalPrevFocus=document.activeElement;
  ovl._modalKeydown=e=>{
    if(!document.body.contains(ovl)) return;
    /* 複数モーダルの重ね掛け（例: 確認ダイアログ）では最前面のみが Escape/Tab を処理する。
       document への capture リスナーは登録順に発火するため、自分より後に開いたモーダルが
       存在する間は何もしない */
    if(document.querySelectorAll("body > .ovl").length>1){
      const overlays=[...document.querySelectorAll("body > .ovl")];
      if(overlays[overlays.length-1]!==ovl) return;
    }
    if(e.key==="Escape"){
      e.preventDefault(); e.stopPropagation();
      const btn=o.escapeTarget?ovl.querySelector(o.escapeTarget):null;
      if(btn) btn.click(); else closeModal(ovl);
      return;
    }
    if(e.key!=="Tab") return;
    /* 最低限のフォーカストラップ: Tab で背面に抜けない */
    const items=[...ovl.querySelectorAll(MODAL_FOCUSABLE)].filter(el=>el.getClientRects().length);
    if(!items.length){ e.preventDefault(); sheet.focus({preventScroll:true}); return; }
    const cur=document.activeElement, inside=ovl.contains(cur);
    if(e.shiftKey){
      if(!inside||cur===items[0]||cur===sheet){ e.preventDefault(); items[items.length-1].focus(); }
    }else if(!inside||cur===items[items.length-1]){ e.preventDefault(); items[0].focus(); }
  };
  document.addEventListener("keydown",ovl._modalKeydown,true);
  document.body.appendChild(ovl);
  document.body.classList.add("modalOpen");
  if(!sheet.hasAttribute("tabindex")) sheet.setAttribute("tabindex","-1");
  sheet.focus({preventScroll:true});
}
function closeModal(ovl){
  if(ovl._modalKeydown){ document.removeEventListener("keydown",ovl._modalKeydown,true); ovl._modalKeydown=null; }
  ovl.remove();
  if(!document.querySelector("body > .ovl")) document.body.classList.remove("modalOpen");
  const prev=ovl._modalPrevFocus; ovl._modalPrevFocus=null;
  if(prev&&typeof prev.focus==="function"&&document.contains(prev)){ try{ prev.focus({preventScroll:true}); }catch(_){} }
}
/* window.confirm() の代替。openModal ベースの小型確認ダイアログを開き、確認/キャンセルを Promise<boolean> で返す。
   Escape=キャンセル。フォーカス復帰は openModal/closeModal の既存機構に委ねる。 */
function appConfirm(message,opts){
  const o=opts||{};
  return new Promise(resolve=>{
    const ovl=document.createElement("div"); ovl.className="ovl";
    ovl.innerHTML=`<div class="sheet confirmSheet">
      ${o.title?`<h3>${esc(o.title)}</h3>`:""}
      <div class="confirmMsg">${esc(message)}</div>
      <div class="btnrow">
        <button type="button" class="btn ghost" id="acCancel">${esc(o.cancelLabel||"キャンセル")}</button>
        <button type="button" class="btn ${o.danger?"danger":""}" id="acOk">${esc(o.okLabel||"確認")}</button>
      </div>
    </div>`;
    let settled=false;
    const finish=v=>{ if(settled) return; settled=true; closeModal(ovl); resolve(v); };
    openModal(ovl,{escapeTarget:"#acCancel"});
    ovl.querySelector("#acCancel").onclick=()=>finish(false);
    ovl.querySelector("#acOk").onclick=()=>finish(true);
  });
}
/* ---------- インライン SVG アイコン（計器の刻印、デザイン言語v2 5節） ----------
   24px グリッド・stroke 1.5（矢印系のみ1.6/1.8）・butt cap・currentColor・パス3本以内。
   表示サイズは width/height 属性（16px）で維持。テンプレート内では icon("del") のように呼ぶ。 */
const ICONS={
  del:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  trash:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><path d="M5 7h14M9.5 7V4.6h5V7"/><path d="M6.6 7l.9 12.6a1.1 1.1 0 0 0 1.1 1h6.8a1.1 1.1 0 0 0 1.1-1L17.4 7"/></svg>',
  gear:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><circle cx="12" cy="12" r="3.1"/><path d="M12 2.7v2.6M12 18.7v2.6M21.3 12h-2.6M5.3 12H2.7M17.7 6.3l-1.85 1.85M8.15 15.85 6.3 17.7M17.7 17.7l-1.85-1.85M8.15 8.15 6.3 6.3"/></svg>',
  camera:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><path d="M3 8.6h3.1L7.9 6h8.2l1.2 2.6H21v9.8H3z"/><circle cx="12" cy="13.4" r="3.1"/></svg>',
  warn:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter"><path d="M12 3 21 19.8H3z"/><path d="M12 9.6v4.4"/><circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none"/></svg>',
  tool:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter"><path d="M15.8 4a3.6 3.6 0 0 0-4.7 4.7L3.6 16.2v3.2h3.2l7.5-7.5a3.6 3.6 0 0 0 4.7-4.7l-2.5 2.5-2.4-2.4z"/></svg>',
  ruler:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter"><rect x="3" y="7.2" width="18" height="8.4"/><path d="M7.2 7.2v3M11.4 7.2v4.2M15.6 7.2v3"/></svg>',
  bulb:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><path d="M12 3.2a5.4 5.4 0 0 0-3.1 9.8c.6.45.95 1.1.95 1.85v.55h4.3v-.55c0-.75.35-1.4.95-1.85A5.4 5.4 0 0 0 12 3.2z"/><path d="M9.8 19.4h4.4"/></svg>',
  book:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 4.6h6.2a2.4 2.4 0 0 1 2.4 2.4v12.4H5.8A2.8 2.8 0 0 1 3 16.6z"/><path d="M21 4.6h-6.2a2.4 2.4 0 0 0-2.4 2.4v12.4h5.8a2.8 2.8 0 0 0 2.8-2.8z"/></svg>',
  ledger:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter"><rect x="4.5" y="3" width="15" height="18"/><path d="M8 7.6h8M8 11.6h8M8 15.6h5"/></svg>',
  pencil:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter"><path d="M15.2 3.8 20.2 8.8 8.2 20.8H3.2v-5z"/><path d="M12.4 6.6l5 5"/></svg>',
  down:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"><path d="M12 3.4v12.4M6.4 11 12 16.8 17.6 11"/><path d="M4.6 20.6h14.8"/></svg>',
  up:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"><path d="M12 20.6V8.2M6.4 13 12 7.2 17.6 13"/><path d="M4.6 3.4h14.8"/></svg>',
  left:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3.4 12h12.4M8 6.4 2.2 12 8 17.6"/><path d="M20.6 4.6v14.8"/></svg>',
  right:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"><path d="M20.6 12H8.2M16 6.4 21.8 12 16 17.6"/><path d="M3.4 4.6v14.8"/></svg>',
  target:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="0.5" fill="currentColor" stroke="none"/></svg>',
  updown:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter"><path d="M8 7.2 12 3.4l4 3.8M8 16.8l4 3.8 4-3.8"/><path d="M12 3.4v17.2"/></svg>',
  help:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><circle cx="12" cy="12" r="8.4"/><path d="M9.4 9.4a2.7 2.7 0 1 1 4 2.3c-.85.5-1.35 1.05-1.35 2v.5"/><circle cx="12" cy="16.9" r="0.5" fill="currentColor" stroke="none"/></svg>',
  chevron:'<svg class="icoInline" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="butt" stroke-linejoin="miter"><path d="M9 4.8 15.6 12 9 19.2"/></svg>'
};
function icon(name){ return ICONS[name]||""; }
function fmtD(iso){ if(!iso||typeof iso!=="string"||!/^\d{4}-\d{2}-\d{2}/.test(iso))return""; const [y,m,d]=iso.split("-"); return `${+y}/${+m}/${+d}`; }
const ENDCOLORS=["#e5484d","#1e6fd9","#0f9d58","#f59e0b","#8b5cf6","#ec4899","#0ea5b7","#7c5e10","#475569","#b91c1c","#1d4ed8","#047857"];
const FIELD_FACE_SIZES=[80,60,40,20];
function parseFaceChoice(value){
  const v=String(value||"");
  if(v==="T40") return {faceD:40,faceType:"triple"};
  if(v[0]==="F") return {faceD:+v.slice(1)||40,faceType:"field"};
  return {faceD:+v||122,faceType:"single"};
}
function faceLabel(s){
  if(s.faceType==="triple") return "40cm三つ目";
  const d=+s.faceD||0;
  if(s.faceType==="field") return `${d}cmフィールド`;
  return `${d}cm的`;
}
function perfectScoreValue(sess){ return sess&&sess.faceType==="field" ? 6 : 10; }
function perfectScoreLabel(sess){ return `${perfectScoreValue(sess)}点`; }
function perfectScoreCount(arrows,sess){ const top=perfectScoreValue(sess); return (arrows||[]).filter(a=>a.s===top).length; }
function secondaryScoreLabel(sess){ return sess&&sess.faceType==="field" ? "5点以上" : "X"; }
function secondaryScoreCount(arrows,sess){ return sess&&sess.faceType==="field" ? (arrows||[]).filter(a=>a.s>=5).length : (arrows||[]).filter(a=>a.X).length; }
function cloneData(v){ return JSON.parse(JSON.stringify(v)); }
function trashItem(type,label,data){
  db.trash=db.trash||[];
  const item={id:uid(),type,label:label||"削除データ",data:cloneData(data),date:today(),ts:Date.now()};
  db.trash.unshift(item);
  db.trash=db.trash.slice(0,TRASH_LIMIT);
  return item;
}
function restoreTrash(id){
  const i=(db.trash||[]).findIndex(x=>x.id===id);
  if(i<0) return false;
  const item=db.trash[i], data=cloneData(item.data);
  if(item.type==="session"){
    if(!db.sessions.some(s=>s.id===data.id)) db.sessions.push(data);
  }else if(item.type==="sightMark"){
    if(!db.sightMarks.some(m=>m.id===data.id)) db.sightMarks.push(data);
  }else if(item.type==="setupBundle"){
    const setup=data.setup;
    if(setup && !db.setups.some(s=>s.id===setup.id)) db.setups.push(setup);
    (data.sightMarks||[]).forEach(m=>{ if(!db.sightMarks.some(x=>x.id===m.id)) db.sightMarks.push(m); });
  }else if(item.type==="formAnalysis"){
    if(!db.formAnalyses.some(f=>f.id===data.id)) db.formAnalyses.push(data);
  }
  db.trash.splice(i,1);
  save({reason:"restore-trash",forceSnapshot:true});
  return true;
}
function trashTypeLabel(t){ return t==="session"?"練習":t==="sightMark"?"サイト値":t==="setupBundle"?"用具":t==="formAnalysis"?"射形記録":"削除データ"; }
function downloadText(filename,text,type){
  const blob=new Blob([text],{type:type||"text/plain"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
async function shareOrDownloadText(filename,text,type,title){
  const mime=type||"text/plain";
  try{
    const file=new File([text],filename,{type:mime});
    if(navigator.canShare && navigator.canShare({files:[file]}) && navigator.share){
      await navigator.share({title:title||filename,files:[file]});
      nativePulse("success");
      return true;
    }
  }catch(e){}
  try{
    const fs=capPlugin("Filesystem"), sh=capPlugin("Share");
    if(fs && sh && typeof fs.writeFile==="function" && typeof sh.share==="function"){
      const res=await fs.writeFile({path:filename,data:text,directory:"CACHE",encoding:"utf8",recursive:true});
      await sh.share({title:title||filename,text:title||filename,url:res.uri,dialogTitle:title||"共有"});
      nativePulse("success");
      return true;
    }
  }catch(e){}
  try{
    if(navigator.share && text.length<90000){
      await navigator.share({title:title||filename,text});
      nativePulse("success");
      return true;
    }
  }catch(e){}
  downloadText(filename,text,mime);
  nativePulse("light");
  return false;
}
function csvCell(v){ const s=String(v==null?"":v).replace(/"/g,'""'); const t=s.trimStart(); return `"${"=+-@".includes(t[0])?"'"+s:s}"`; }
const ROUND_TYPES=[
  {id:"free",label:"自由練習",arrows:null},
  {id:"70m72",label:"70m 72射",arrows:72,dist:70},
  {id:"50m72",label:"50m 72射",arrows:72,dist:50},
  {id:"30m36",label:"30m 36射",arrows:36,dist:30},
  {id:"18m60",label:"18m 60射",arrows:60,dist:18},
  {id:"field72",label:"フィールド 24標的/72射",arrows:72}
];
/* 多距離ラウンド定義（IMP-09）: 各 stage は従来どおりの単一距離セッション1件として保存し、
   session.roundGroup={gid,roundId,stage,stageCount} で連結する。
   W.A. 1440 ラウンド: 長距離2種（122cm的）は6本エンド、50/30m（80cm的）は3本エンド、各距離36射 */
const MULTI_ROUND_PRESETS=[
  {id:"wa1440_men",label:"WA1440 男子",stages:[
    {dist:90,faceD:122,faceType:"single",arrows:36,perEnd:6},
    {dist:70,faceD:122,faceType:"single",arrows:36,perEnd:6},
    {dist:50,faceD:80,faceType:"single",arrows:36,perEnd:3},
    {dist:30,faceD:80,faceType:"single",arrows:36,perEnd:3}
  ]},
  {id:"wa1440_women",label:"WA1440 女子",stages:[
    {dist:70,faceD:122,faceType:"single",arrows:36,perEnd:6},
    {dist:60,faceD:122,faceType:"single",arrows:36,perEnd:6},
    {dist:50,faceD:80,faceType:"single",arrows:36,perEnd:3},
    {dist:30,faceD:80,faceType:"single",arrows:36,perEnd:3}
  ]}
];
/* プリセット＋カスタム定義の一覧。customRounds 省略時は db.customRounds を使う（id 重複はカスタム優先） */
function multiRoundDefs(customRounds){
  const custom=Array.isArray(customRounds)?customRounds:((typeof db!=="undefined"&&db&&Array.isArray(db.customRounds))?db.customRounds:[]);
  const byId=new Map();
  MULTI_ROUND_PRESETS.forEach(r=>{ if(r&&r.id) byId.set(r.id,r); });
  custom.forEach(r=>{ if(r&&r.id) byId.set(r.id,r); });
  return [...byId.values()];
}
function findRoundDef(id,customRounds){ return multiRoundDefs(customRounds).find(r=>r.id===id)||null; }
function roundLabel(id){
  const base=ROUND_TYPES.find(r=>r.id===(id||"free"));
  if(base) return base.label;
  const def=findRoundDef(id);
  return def?def.label:ROUND_TYPES[0].label;
}
/* session.roundGroup から現在ステージの定義（dist/faceD/faceType/arrows/perEnd）を引く。無ければ null */
function sessionStageDef(sess){
  const rg=sess&&sess.roundGroup;
  if(!rg) return null;
  const def=findRoundDef(rg.roundId);
  const stage=def&&Array.isArray(def.stages)?def.stages[Number(rg.stage)||0]:null;
  return stage||null;
}
/* 記録セッション中の画面消灯を防止。API非対応ブラウザでは acquire() が即returnし何もしない */
const wakeLock=(function(){
  let sentinel=null,wanted=false;
  async function acquire(){
    wanted=true;
    if(sentinel||!("wakeLock" in navigator)) return;
    try{
      sentinel=await navigator.wakeLock.request("screen");
      sentinel.addEventListener("release",()=>{ sentinel=null; });
    }catch(e){ console.warn("[wakelock]",e); }
  }
  function release(){
    wanted=false;
    if(!sentinel) return;
    sentinel.release().catch(()=>{});
    sentinel=null;
  }
  function reacquire(){
    if(wanted&&!sentinel&&!document.hidden) acquire();
  }
  return {acquire,release,reacquire};
})();
