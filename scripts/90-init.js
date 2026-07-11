"use strict";
/* Archery Note: startup and update check */
/* ============ init ============ */
if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
applyTheme();
applyFieldMode();
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
/* S1/S3（ストレージ守りタスク・OPFS移行裁定 §4）: 起動時に一度だけ非同期で先読みする。
   どちらも対応環境のみで動き、失敗しても既存の保存・起動経路には一切影響しない（fire-and-forget）。
   設定パネルを開く頃には解決済みなことが多いが、間に合わなくても storagePersistNoteHtml /
   storageMeterHtml 側が未確定・未取得の状態を安全に表示するだけ */
requestStoragePersistence();
prefetchStorageEstimate();
if(db.active) wakeLock.acquire();
/* addToHome ヒント判定用の起動カウンタ。起動パスに同期書き込みを増やさないため scheduleSave
   （flush は pagehide/visibilitychange 等の既存機構で保証済み）。
   判定は launchCount>=2 のみなので上限で打ち止め: 閲覧だけの起動で db を変化させず、
   安全スナップショットのリング（6枠）を無駄に回転させない */
if((db.settings.launchCount||0)<9){ db.settings.launchCount=(db.settings.launchCount||0)+1; scheduleSave("launch-count"); }
/* ゲーミフィケーション移行バックフィル: 起動時に一度だけ、既存履歴から一括でバッジを付与する。
   backfilledAt が既にあれば二度と走らない。演出なし（justUnlocked を付けず、分析タブの一覧に
   静かに現れるだけ）。gamification-final-design.md §5 移行バックフィル 準拠 */
if(db.settings.gamification && db.settings.gamification.enabled && !db.settings.gamification.backfilledAt){
  /* 起動経路のクラッシュループ防止（strict-review major①）: バックフィル対象データが
     壊れていて例外を投げても render() には必ず到達させる。根本原因（非文字列 date）は
     normalizeDb 側で潰しているが、ここは移行処理全般に対する最後の防波堤 */
  try{
    const nowIso=new Date().toISOString();
    const have=new Set((db.gamification.badges||[]).map(b=>b.id));
    const got=backfillBadges(db.sessions, nowIso).filter(b=>!have.has(b.id));
    if(got.length) db.gamification.badges.push(...got);
    db.settings.gamification.backfilledAt=nowIso;
    save({reason:"gamification-backfill"});
  }catch(e){
    console.warn("[gamification] backfill failed, skipping this launch",e);
  }
}
render();
