"use strict";
/* Archery Note: startup and update check */
/* ============ init ============ */
if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
applyTheme();
$("#btnSettings").onclick=openSettings;
/* 更新通知: version.json と比較（公開時は APP_VER と version.json の v を同時に上げる） */
function checkUpdate(){
  if(location.protocol==="file:") return;
  fetch("version.json?ts="+Date.now(),{cache:"no-store"})
    .then(r=>r.json())
    .then(j=>{ if(j && j.v>APP_VER) $("#updBar").style.display="block"; })
    .catch(()=>{});
}
$("#updBar").onclick=()=>location.reload();
document.addEventListener("visibilitychange",()=>{ if(document.hidden) writeSafetySnapshot("hidden"); else checkUpdate(); });
window.addEventListener("pagehide",()=>writeSafetySnapshot("pagehide"));
checkUpdate();
render();
