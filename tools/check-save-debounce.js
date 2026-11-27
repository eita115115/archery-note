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

/* 控え（安全スナップショット）が 1 世代も入りきらないとき、保存のたびに控えを試さない。
   試すたびに記録の全部を読んで書いて失敗するので、保存 1 回が倍の重さになる（1,000 回の記録で実測）。
   30 分たてばもう一度試す。復元・読み込み・削除の前の控え（forceSnapshot）は毎回試す */
const loadQuota = (quotaChars) => {
    const timers = makeFakeTimers();
    const store = new Map();
    const snapAttempts = [];
    let fakeNowMs = 1700000000000;
    class FakeDate extends Date {
      constructor(...args) {
        if (args.length === 0) super(fakeNowMs);
        else super(...args);
      }
      static now() {
        return fakeNowMs;
      }
    }
    let snapKey = null;
    const shim = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem(key, value) {
        const text = String(value);
        if (key === snapKey) snapAttempts.push(text.length);
        let used = text.length;
        store.forEach((v, k) => {
          if (k !== key) used += v.length;
        });
        if (used > quotaChars) throw new Error("QuotaExceededError");
        store.set(key, text);
      },
      removeItem: (key) => store.delete(key),
    };
    const api = new Function(
      "localStorage",
      "setTimeout",
      "clearTimeout",
      "Date",
      "console",
      `${storageScript}
return {save, flushSafetySnapshot, writeSafetySnapshot, readSnapshots, normalizeDb, KEY, SNAP_KEY,
  getDb: () => db, setDb: (d) => { db = d; }};`,
    )(shim, timers.setTimeout, timers.clearTimeout, FakeDate, { warn() {}, error() {}, log() {} });
    snapKey = api.SNAP_KEY;
    /* 本体だけで 6,000 字を超える記録を入れる */
    api.getDb().sessions = Array.from({ length: 40 }, (_, i) => ({
      id: "s" + i,
      date: "2026-01-01",
      ends: [Array.from({ length: 6 }, (_, j) => ({ x: j, y: i, s: 9 }))],
    }));
    const saveAndIdle = (opts) => {
      api.getDb().settings.eyeSight = (api.getDb().settings.eyeSight || 0) + 1;
      const ok = api.save(opts || "edit");
      timers.runAll();
      return ok;
    };
    return { api, store, timers, snapAttempts, saveAndIdle, advance: (ms) => (fakeNowMs += ms) };
};
function checkSnapshotBackoffWhenFull() {
  /* 入りきらない: 本体 約 6,300 字、空き 10,000 字。控えは 1 世代も入らない */
  const full = loadQuota(10000);
  assert(full.saveAndIdle() === true, "[snapshot-backoff] the main write still succeeds when a snapshot cannot fit");
  assert(full.store.get(full.api.KEY).length > 5000, "[snapshot-backoff] fixture is larger than half the quota");
  assertEqual(full.snapAttempts.length, 1, "[snapshot-backoff] the first save tries the snapshot once");
  assert(!full.store.has(full.api.SNAP_KEY), "[snapshot-backoff] the snapshot did not fit");
  for (let i = 0; i < 5; i += 1) full.saveAndIdle();
  assertEqual(full.snapAttempts.length, 1, "[snapshot-backoff] later saves do not retry a snapshot that cannot fit");
  assert(
    JSON.parse(full.store.get(full.api.KEY)).settings.eyeSight === full.api.getDb().settings.eyeSight,
    "[snapshot-backoff] every save still writes the latest data",
  );
  full.saveAndIdle({ reason: "import", forceSnapshot: true });
  assertEqual(full.snapAttempts.length, 2, "[snapshot-backoff] a forced snapshot is always attempted");
  full.saveAndIdle();
  assertEqual(full.snapAttempts.length, 2, "[snapshot-backoff] a failed forced snapshot keeps the pause");
  full.advance(31 * 60 * 1000);
  full.saveAndIdle();
  assertEqual(full.snapAttempts.length, 3, "[snapshot-backoff] the snapshot is retried after 30 minutes");

  /* 入る: これまでどおり 1 度書いて、30 分は書かない。30 分たてば次の世代を書く */
  const roomy = loadQuota(1000000);
  roomy.saveAndIdle();
  assertEqual(roomy.snapAttempts.length, 1, "[snapshot-backoff] a snapshot that fits is written");
  assertEqual(JSON.parse(roomy.store.get(roomy.api.SNAP_KEY)).length, 1, "[snapshot-backoff] one generation is stored");
  roomy.saveAndIdle();
  assertEqual(roomy.snapAttempts.length, 1, "[snapshot-backoff] no second snapshot inside 30 minutes");
  roomy.advance(31 * 60 * 1000);
  roomy.saveAndIdle();
  assertEqual(JSON.parse(roomy.store.get(roomy.api.SNAP_KEY)).length, 2, "[snapshot-backoff] the next generation is stored after 30 minutes");
}

/* 控えが保存の空きを使い切っても、本体は保存できる（古い控えから外して空きを作る）。
   直す前は、控え 3 世代 + 本体で空きが尽きると、それ以後の保存がすべて失敗した（打った矢が残らない） */
function checkMainWriteFreesSnapshots() {
  const sessions = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: "q" + i,
      date: "2026-01-01",
      ends: [Array.from({ length: 6 }, (_, j) => ({ x: j, y: i, s: 9 }))],
    }));
  const grown = loadQuota(30000);
  /* 30 分おきに 3 回: 控えが 3 世代たまる（本体は約 6,300 字、控えは約 19,000 字） */
  grown.api.getDb().sessions = sessions(40);
  for (let i = 0; i < 3; i += 1) {
    assert(grown.saveAndIdle() === true, "[quota] early saves succeed");
    grown.advance(31 * 60 * 1000);
  }
  assertEqual(grown.api.readSnapshots().length, 3, "[quota] three generations are stored");
  /* 記録が増えて、本体 + 控え 3 世代では入らなくなる */
  grown.api.getDb().sessions = sessions(80);
  assert(grown.saveAndIdle() === true, "[quota] the main write succeeds after freeing old snapshots");
  const stored = JSON.parse(grown.store.get(grown.api.KEY));
  assertEqual(stored.sessions.length, 80, "[quota] the latest data is what is stored");
  const left = grown.api.readSnapshots();
  assert(left.length < 3 && left.length >= 1, "[quota] only as many old generations as needed are dropped");
  assert(
    left.every((g, i) => i === 0 || left[i - 1].ts > g.ts),
    "[quota] the generations that remain are the newest ones, newest first",
  );
  /* 控えを全部外しても入らないときだけ、保存できなかったと返す。控えは空になる */
  const tiny = loadQuota(8000);
  tiny.api.getDb().sessions = sessions(20);
  assert(tiny.saveAndIdle() === true, "[quota] small data fits");
  tiny.advance(31 * 60 * 1000);
  tiny.api.getDb().sessions = sessions(200);
  assert(tiny.saveAndIdle() === false, "[quota] data larger than the whole quota still fails");
  assertEqual(
    JSON.parse(tiny.store.get(tiny.api.KEY)).sessions.length,
    20,
    "[quota] the last good main copy is left in place",
  );
  /* 控えを外しても書けなかったときは、外した控えを元に戻す（空き不足ではない失敗で、安全のための控えを消さない） */
  const stuck = loadQuota(30000);
  stuck.api.getDb().sessions = sessions(20);
  for (let i = 0; i < 2; i += 1) {
    stuck.saveAndIdle();
    stuck.advance(31 * 60 * 1000);
  }
  const snapBefore = stuck.store.get(stuck.api.SNAP_KEY);
  assert(JSON.parse(snapBefore).length === 2, "[quota] two generations before the failure");
  stuck.api.getDb().sessions = sessions(200);
  assert(stuck.saveAndIdle() === false, "[quota] a write larger than the whole quota fails");
  assertEqual(stuck.store.get(stuck.api.SNAP_KEY), snapBefore, "[quota] the snapshots are put back when freeing did not help");
}

/* 読み込み・復元の直前の控え（-before）は、置き換えたあとの控えを作っても残る。
   直す前は、控えが 3 世代以上あると、時刻がいちばん近い組として直前の控えのほうが外れていた */
function checkBeforeSnapshotSurvives() {
  const t = loadQuota(100000000);
  const api = t.api;
  const mark = (n) => (api.getDb().settings.eyeSight = n);
  /* 4 日ぶんの定期の控え（4 世代でいっぱい） */
  for (let day = 1; day <= 4; day += 1) {
    mark(day);
    t.saveAndIdle();
    t.advance(24 * 60 * 60 * 1000);
  }
  assertEqual(api.readSnapshots().length, 4, "[before] the ring is full");
  /* きょうの練習（定期の控えの 30 分の間隔の中）→ 読み込み */
  mark(777);
  api.save("finish");
  t.timers.runAll();
  api.writeSafetySnapshot("import-before", true);
  api.setDb(api.normalizeDb({ sessions: [], settings: { eyeSight: 1 } }));
  api.save({ reason: "import", forceSnapshot: true });
  const reasons = () => api.readSnapshots().map((g) => g.reason);
  const before = () => api.readSnapshots().find((g) => g.reason === "import-before");
  assertEqual(api.readSnapshots().length, 4, "[before] still four generations");
  assertEqual(reasons()[0], "import", "[before] the newest generation is the imported state");
  assert(before() && before().data.settings.eyeSight === 777, "[before] the state before the import is kept");
  /* 次の定期の控え（31 分あと）でも残る。外れるのは、置き換えた直後の控えのほう */
  t.advance(31 * 60 * 1000);
  mark(2);
  t.saveAndIdle();
  assert(before() && before().data.settings.eyeSight === 777, "[before] it survives the next periodic snapshot");
  assert(!reasons().includes("import"), "[before] the just-after copy is the one that goes");
  assertEqual(api.readSnapshots().length, 4, "[before] the ring stays at four generations");
  /* そのあとは普通の控えと同じに間引かれる（ずっと残り続けはしない） */
  for (let i = 0; i < 12; i += 1) {
    t.advance(7 * 24 * 60 * 60 * 1000);
    mark(100 + i);
    t.saveAndIdle();
  }
  assertEqual(api.readSnapshots().length, 4, "[before] later snapshots keep four generations");
  assert(reasons()[0] === "edit" || reasons()[0] === "auto", "[before] the newest generation is the latest save");
}

/* 控えを残せたかを返す。読み込み・復元の直前の控えは、本体を書くために外さない（外すと置き換える前のデータがどこにも残らない） */
function checkSnapshotResultAndFreshBefore() {
  const sessions = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: "q" + i,
      date: "2026-01-01",
      ends: [Array.from({ length: 6 }, (_, j) => ({ x: j, y: i, s: 9 }))],
    }));
  /* 入る: true */
  const roomy = loadQuota(1000000);
  roomy.api.getDb().sessions = sessions(10);
  roomy.saveAndIdle();
  assert(roomy.api.writeSafetySnapshot("manual", true) === true, "[snap-result] a snapshot that fits returns true");
  /* 入らない: false（本体だけで空きの半分を超える） */
  const full = loadQuota(10000);
  full.api.getDb().sessions = sessions(40);
  full.saveAndIdle();
  assert(full.api.writeSafetySnapshot("manual", true) === false, "[snap-result] a snapshot that cannot fit returns false");
  /* 読み込みの直前の控えを作り、置き換えた内容が大きくて入らない: 直前の控えは残し、保存できなかったと返す */
  const imp = loadQuota(16000);
  imp.api.getDb().sessions = sessions(20);
  imp.saveAndIdle();
  assert(imp.api.writeSafetySnapshot("import-before", true) === true, "[snap-result] the before-copy fits");
  imp.api.setDb(imp.api.normalizeDb({ sessions: sessions(60), settings: {} }));
  assert(imp.api.save({ reason: "import", forceSnapshot: true }) === false, "[snap-result] the larger import does not fit");
  const kept = imp.api.readSnapshots();
  assert(kept.some((g) => g.reason === "import-before" && g.data.sessions.length === 20), "[snap-result] the before-copy is kept");
  assertEqual(JSON.parse(imp.store.get(imp.api.KEY)).sessions.length, 20, "[snap-result] the stored data is still the old data");
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
  checkSnapshotBackoffWhenFull();
  checkMainWriteFreesSnapshots();
  checkBeforeSnapshotSurvives();
  checkSnapshotResultAndFreshBefore();
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
