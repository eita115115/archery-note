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
document.addEventListener("visibilitychange",()=>{ if(document.hidden) flushSafetySnapshot(); else checkUpdate(); });
window.addEventListener("pagehide",()=>flushSafetySnapshot());
checkUpdate();
render();
