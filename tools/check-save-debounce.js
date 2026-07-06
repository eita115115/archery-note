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
  /* max-wait 検証用に Date.now() を手動で進められる決定的クロック */
  let fakeNowMs = 1700000000000;
  const clock = { advance: (ms) => (fakeNowMs += ms) };
  class FakeDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(fakeNowMs);
      else super(...args);
    }
    static now() {
      return fakeNowMs;
    }
  }
  const api = new Function(
    "localStorage",
    "setTimeout",
    "clearTimeout",
    "Date",
    `${storageScript}
return {save, scheduleSave, flushPendingSave, hasPendingSave, KEY, SNAP_KEY,
  getDb: () => db, getRev: () => DB_REV};`,
  )(localStorageShim, timers.setTimeout, timers.clearTimeout, FakeDate);
  const keyWrites = () => writes.filter((w) => w.key === api.KEY);
  return { timers, writes, keyWrites, api, clock };
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

function checkMaxWait() {
  /* 連続入力（600ms未満間隔）でも SAVE_MAX_WAIT_MS で先送りが打ち切られ途中書き込みされること */
  assert(
    /const SAVE_DEBOUNCE_MS=600;/.test(storageScript),
    "[max-wait] SAVE_DEBOUNCE_MS should stay 600",
  );
  assert(
    /const SAVE_MAX_WAIT_MS=3000;/.test(storageScript),
    "[max-wait] SAVE_MAX_WAIT_MS should stay 3000",
  );
  const { timers, keyWrites, api, clock } = loadApi();
  for (let i = 0; i < 10; i += 1) {
    api.getDb().settings.eyeSight = 900 + i;
    api.scheduleSave("nudge");
    clock.advance(500); // デバウンス窓(600ms)より短い間隔の連打
  }
  assert(
    keyWrites().length >= 1,
    "[max-wait] continuous input must not defer the write indefinitely",
  );
  timers.runAll();
  const last = JSON.parse(keyWrites()[keyWrites().length - 1].value);
  assertEqual(last.settings.eyeSight, 909, "[max-wait] final state is persisted after the burst");
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
    [/save\(\{\s*reason:\s*"import",\s*forceSnapshot:\s*true\s*\}\)/, "import"],
    [/save\(\{\s*reason:\s*"restore",\s*forceSnapshot:\s*true\s*\}\)/, "snapshot restore"],
    [/save\(\{\s*reason:\s*"restore-trash",\s*forceSnapshot:\s*true\s*\}\)/, "trash restore"],
    [/save\(\{\s*reason:\s*"delete-session",\s*forceSnapshot:\s*true\s*\}\)/, "session delete"],
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
    [
      /window\.addEventListener\(\s*["']pagehide["'][^\n]*flushPendingSave\(\)[^\n]*flushSafetySnapshot\(\)/,
      "pagehide",
    ],
    [
      /document\.addEventListener\(\s*["']visibilitychange["'][^\n]*document\.hidden\)\s*\{[^}]*flushPendingSave\(\);[^}]*flushSafetySnapshot\(\)/,
      "visibilitychange(hidden): flush must live inside the hidden branch",
    ],
    [
      /window\.addEventListener\(\s*["']beforeunload["'][^\n]*flushPendingSave\(\)[^\n]*flushSafetySnapshot\(\)/,
      "beforeunload",
    ],
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
  checkMaxWait();
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
