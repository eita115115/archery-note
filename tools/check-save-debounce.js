"use strict";

/*
 * check-save-debounce.js — 高頻度記録操作のデバウンス保存契約を検査する。
 *
 * 契約（IMP-20260704-08）:
 * - scheduleSave(): 連続 N 回の変異で本体（KEY）書き込みは 1 回にまとまる
 * - DB_REV は書き込み時ではなく「変異した時点」で増える（キャッシュ無効化の整合）
 * - flushPendingSave(): 保留中のデバウンス保存を即時同期書き込みする（pagehide 等の契機）
 * - save(): 従来どおり即時同期書き込み。保留中のデバウンス保存はここで吸収される
 * - scheduleSave({forceSnapshot:true}) は重要操作扱いで即時書き込みに倒れる
 * - scripts/90-init.js は pagehide / visibilitychange(hidden) / beforeunload と
 *   freshReload で flushPendingSave() を flushSafetySnapshot() より先に呼ぶ
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const storageScript = fs.readFileSync(path.join(root, "scripts", "10-storage-native.js"), "utf8");
const recordScript = fs.readFileSync(path.join(root, "scripts", "50-record-view.js"), "utf8");
const initScript = fs.readFileSync(path.join(root, "scripts", "90-init.js"), "utf8");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function assertEqual(actual, expected, label) {
  assert(
    Object.is(actual, expected),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

/* 手動で進められる決定的なフェイクタイマー */
function makeFakeTimers() {
  let nextId = 1;
  const tasks = new Map();
  return {
    setTimeout(fn, ms) {
      const id = nextId;
      nextId += 1;
      tasks.set(id, { fn, ms });
      return id;
    },
    clearTimeout(id) {
      tasks.delete(id);
    },
    runAll() {
      let guard = 0;
      while (tasks.size) {
        assert((guard += 1) < 1000, "fake timer runAll should terminate");
        const [id, task] = tasks.entries().next().value;
        tasks.delete(id);
        task.fn();
      }
    },
    pendingCount() {
      return tasks.size;
    },
  };
}

function loadApi() {
  const timers = makeFakeTimers();
  const writes = [];
  const store = new Map();
  const localStorageShim = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
      writes.push({ key, value: String(value) });
    },
    removeItem(key) {
      store.delete(key);
    },
  };
  const api = new Function(
    "localStorage",
    "setTimeout",
    "clearTimeout",
    `${storageScript}
return {save, scheduleSave, flushPendingSave, hasPendingSave, KEY, SNAP_KEY,
  getDb: () => db, getRev: () => DB_REV};`,
  )(localStorageShim, timers.setTimeout, timers.clearTimeout);
  const keyWrites = () => writes.filter((w) => w.key === api.KEY);
  return { timers, writes, keyWrites, api };
}

function checkDebounceCoalescing() {
  const { timers, keyWrites, api } = loadApi();
  const rev0 = api.getRev();
  for (let i = 0; i < 5; i += 1) {
    api.getDb().settings.eyeSight = 800 + i;
    api.scheduleSave("nudge");
  }
  assertEqual(api.getRev(), rev0 + 5, "[debounce] DB_REV bumps at mutation time (5 mutations)");
  assertEqual(keyWrites().length, 0, "[debounce] no main write before the debounce window fires");
  assert(api.hasPendingSave(), "[debounce] hasPendingSave should report a pending write");
  timers.runAll();
  assertEqual(keyWrites().length, 1, "[debounce] 5 mutations coalesce into exactly 1 main write");
  assert(!api.hasPendingSave(), "[debounce] pending flag clears after the write");
  const written = JSON.parse(keyWrites()[0].value);
  assertEqual(written.settings.eyeSight, 804, "[debounce] the write contains the latest db state");
}

function checkFlushPendingSave() {
  const { timers, keyWrites, api } = loadApi();
  api.getDb().settings.eyeSight = 777;
  api.scheduleSave("arrow-add");
  assertEqual(keyWrites().length, 0, "[flush] still pending before flushPendingSave");
  api.flushPendingSave();
  assertEqual(keyWrites().length, 1, "[flush] flushPendingSave writes synchronously");
  assertEqual(
    JSON.parse(keyWrites()[0].value).settings.eyeSight,
    777,
    "[flush] flushed write contains the mutated state",
  );
  assert(!api.hasPendingSave(), "[flush] pending flag clears after flush");
  timers.runAll();
  assertEqual(keyWrites().length, 1, "[flush] the canceled timer must not write a second time");
  api.flushPendingSave();
  assertEqual(keyWrites().length, 1, "[flush] flushPendingSave without pending write is a no-op");
}

function checkImmediateSaveStaysImmediate() {
  const { timers, keyWrites, api } = loadApi();
  api.save({ reason: "import", forceSnapshot: true });
  assertEqual(keyWrites().length, 1, "[immediate] save() writes without any timer advance");
  api.scheduleSave("shot-meta");
  api.save({ reason: "end-session" });
  assertEqual(keyWrites().length, 2, "[immediate] save() absorbs a pending debounced write");
  assert(!api.hasPendingSave(), "[immediate] pending flag clears after a sync save");
  timers.runAll();
  assertEqual(keyWrites().length, 2, "[immediate] absorbed debounce must not write again");
  api.scheduleSave({ reason: "restore", forceSnapshot: true });
  assertEqual(
    keyWrites().length,
    3,
    "[immediate] scheduleSave with forceSnapshot degrades to an immediate save",
  );
}

function checkSnapshotStillScheduled() {
  const { timers, writes, api } = loadApi();
  api.getDb().sessions.push({ id: "s1", ends: [[{ x: 0, y: 0, s: 10, X: true }]] });
  api.scheduleSave("arrow-add");
  timers.runAll();
  assert(
    writes.some((w) => w.key === api.SNAP_KEY),
    "[snapshot] debounced write still feeds the safety snapshot pipeline",
  );
}

function checkCallSiteClassification() {
  /* 高頻度の記録操作はデバウンス、重要操作は即時 save のままであること（静的検査） */
  assert(
    /scheduleSave\(\s*["']arrow-add["']\s*\)/.test(recordScript),
    "[call-site] arrow add (target tap) should use scheduleSave",
  );
  assert(
    /scheduleSave\(\s*["']nudge["']\s*\)/.test(recordScript),
    "[call-site] nudge move should use scheduleSave",
  );
  assert(
    /scheduleSave\(\s*["']shot-meta["']\s*\)/.test(recordScript),
    "[call-site] shot-meta (arrow number / reason tag) should use scheduleSave",
  );
  const immediatePatterns = [
    [/save\(\{reason:"import",forceSnapshot:true\}\)/, "import"],
    [/save\(\{reason:"restore",forceSnapshot:true\}\)/, "snapshot restore"],
    [/save\(\{reason:"restore-trash",forceSnapshot:true\}\)/, "trash restore"],
    [/save\(\{reason:"delete-session",forceSnapshot:true\}\)/, "session delete"],
  ];
  const gearScript = fs.readFileSync(path.join(root, "scripts", "70-gear-settings.js"), "utf8");
  const historyScript = fs.readFileSync(
    path.join(root, "scripts", "60-history-sight-view.js"),
    "utf8",
  );
  const combined = `${storageScript}\n${gearScript}\n${historyScript}`;
  immediatePatterns.forEach(([pattern, label]) => {
    assert(pattern.test(combined), `[call-site] ${label} must stay an immediate sync save`);
  });
}

function checkLifecycleFlushContract() {
  /* 90-init.js: 離脱契機と更新リロードで flushPendingSave が snapshot flush より先に呼ばれること。
     [^\n]* で addEventListener と同一行に限定する（境界を越えて隣のハンドラにマッチすると検査が空文化する）。
     ハンドラを複数行に書き換えた場合はこの検査も合わせて更新すること。 */
  [
    [/window\.addEventListener\(\s*["']pagehide["'][^\n]*flushPendingSave\(\)[^\n]*flushSafetySnapshot\(\)/, "pagehide"],
    [/document\.addEventListener\(\s*["']visibilitychange["'][^\n]*flushPendingSave\(\)[^\n]*flushSafetySnapshot\(\)/, "visibilitychange(hidden)"],
    [/window\.addEventListener\(\s*["']beforeunload["'][^\n]*flushPendingSave\(\)[^\n]*flushSafetySnapshot\(\)/, "beforeunload"],
  ].forEach(([pattern, label]) => {
    assert(
      pattern.test(initScript),
      `[lifecycle] ${label} must flush the pending debounced save before the snapshot flush`,
    );
  });
  const freshReloadStart = initScript.indexOf("function freshReload");
  assert(freshReloadStart >= 0, "[lifecycle] freshReload should exist in scripts/90-init.js");
  const freshReloadBody = initScript.slice(
    freshReloadStart,
    initScript.indexOf('$("#updBar").onclick=freshReload;'),
  );
  const flushAt = freshReloadBody.indexOf("flushPendingSave");
  const snapshotAt = freshReloadBody.indexOf("flushSafetySnapshot");
  assert(flushAt >= 0, "[lifecycle] freshReload must flush the pending debounced save");
  assert(
    snapshotAt > flushAt,
    "[lifecycle] freshReload must flush the main db before the safety snapshot",
  );
}

function main() {
  checkDebounceCoalescing();
  checkFlushPendingSave();
  checkImmediateSaveStaysImmediate();
  checkSnapshotStillScheduled();
  checkCallSiteClassification();
  checkLifecycleFlushContract();
  console.log("Save debounce checks OK");
}

try {
  main();
} catch (error) {
  console.error("Save debounce check failed:");
  console.error(error.message);
  process.exitCode = 1;
}
