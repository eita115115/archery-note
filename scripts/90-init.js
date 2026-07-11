"use strict";
/* Archery Note: startup and update check */
/* ============ init ============ */
if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
applyTheme();
$("#btnSettings").onclick=openSettings;
/* 更新通知: version.json と比較（公開時は APP_VER と version.json の v を同時に上げる） */
let updateAvailable=false;
let activeWorkflowCount=0;
function beginActiveWorkflow(){
  activeWorkflowCount++;
  syncUpdateBarVisibility();
}
function endActiveWorkflow(){
  activeWorkflowCount=Math.max(0,activeWorkflowCount-1);
  syncUpdateBarVisibility();
}
function isUpdateReloadBlocked(){
  return !!(db&&db.active) || activeWorkflowCount>0;
}
function syncUpdateBarVisibility(){
  const bar=$("#updBar");
  if(!bar) return;
  const show=!!updateAvailable && !isUpdateReloadBlocked();
  bar.hidden=!show;
  bar.style.display=show?"block":"none";
}
function checkUpdate(){
  if(location.protocol==="file:"){ updateAvailable=false; syncUpdateBarVisibility(); return; }
  fetch("version.json?ts="+Date.now(),{cache:"no-store"})
    .then(r=>r.json())
    .then(j=>{ updateAvailable=!!(j && j.v>APP_VER); syncUpdateBarVisibility(); })
    .catch(()=>{});
}
function freshReload(){
  if(isUpdateReloadBlocked()){ syncUpdateBarVisibility(); return; }
  /* 未flushのデバウンス保存をリロードで失わないよう、スナップショットより先に本体を書き切る */
  if(typeof flushPendingSave==="function") flushPendingSave();
  if(typeof flushSafetySnapshot==="function") flushSafetySnapshot();
  const bar=$("#updBar");
  if(bar) bar.textContent="更新中...";
  const url=new URL(location.href);
  url.searchParams.set("appv", String(Date.now()));
  const reload=()=>location.replace(url.toString());
  if(navigator.serviceWorker && navigator.serviceWorker.getRegistrations){
    navigator.serviceWorker.getRegistrations()
      .then(regs=>Promise.all(regs.map(r=>r.update().catch(()=>{}))))
      .finally(reload);
  }else{
    reload();
  }
}
$("#updBar").onclick=freshReload;
/* 高頻度記録操作のデバウンス保存（scheduleSave）は離脱時に必ず同期 flush する。
 * iOS Safari では pagehide が最も信頼できる。順序は本体（flushPendingSave）→ スナップショット。 */
document.addEventListener("visibilitychange",()=>{ if(document.hidden){ flushPendingSave(); flushSafetySnapshot(); } else{ checkUpdate(); wakeLock.reacquire(); } });
window.addEventListener("pagehide",()=>{ flushPendingSave(); flushSafetySnapshot(); });
window.addEventListener("beforeunload",()=>{ flushPendingSave(); flushSafetySnapshot(); });
checkUpdate();
if(db.active) wakeLock.acquire();
/* addToHome ヒント判定用の起動カウンタ。起動パスに同期書き込みを増やさないため scheduleSave
   （flush は pagehide/visibilitychange 等の既存機構で保証済み） */
db.settings.launchCount=(db.settings.launchCount||0)+1; scheduleSave("launch-count");
render();
