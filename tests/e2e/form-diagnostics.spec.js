"use strict";
/* global db */

const fs = require("fs");
const path = require("path");
const { expect, test } = require("@playwright/test");
const {
  formV2Records,
  DIAG_FORBIDDEN_KEYS,
  diagnosticKeyPaths,
} = require("./fixtures/form-v2-stream.js");

function makeSyntheticDiagnosticDb(overrides = {}) {
  const { settings: settingsOverrides = {}, ...databaseOverrides } = overrides;
  return {
    schema: 5,
    setups: [],
    sightMarks: [],
    sessions: [],
    trash: [],
    formAnalyses: [],
    customRounds: [],
    settings: {
      eyeSight: 850,
      theme: "auto",
      fieldMode: false,
      lastBackupAt: null,
      activeGuideSeen: true,
      onboardingSeen: true,
      launchCount: 1,
      formTrackingEnabled: true,
      formDebug: true,
      featureHints: {
        gearSetup: false,
        analysis: false,
        sightAdjust: false,
        formTracking: false,
        addToHome: false,
        practiceDays: false,
      },
      gamification: {
        enabled: false,
        practiceDays: null,
        goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
        backfilledAt: null,
      },
      ...settingsOverrides,
    },
    gamification: { badges: [] },
    active: null,
    fixtureNotice: "synthetic-only-no-real-user-or-device-data",
    ...databaseOverrides,
  };
}

async function seedDiagnosticDb(page, database) {
  await page.addInitScript((value) => {
    localStorage.setItem("archeryNote.v1", JSON.stringify(value));
  }, database);
}

async function installPrimaryWriteGate(page) {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    globalThis.__formWriteProbe = { fail: true, attempts: [] };
    Storage.prototype.setItem = function (key, value) {
      if (key === "archeryNote.v1") {
        globalThis.__formWriteProbe.attempts.push(JSON.parse(value));
        if (globalThis.__formWriteProbe.fail) {
          throw new DOMException("synthetic quota failure", "QuotaExceededError");
        }
      }
      return original.call(this, key, value);
    };
  });
}

async function stallFormPose(page) {
  await page.evaluate(() => {
    globalThis.loadFormPose = () => new Promise(() => {});
  });
}

async function resetWriteProbeAfterStartup(page) {
  await page.waitForTimeout(750);
  return page.evaluate(() => {
    globalThis.__formWriteProbe.attempts = [];
    return db.updatedAt;
  });
}

/* アプリの現行バージョンを唯一の情報源から読む。
   ここを固定値にすると npm run version:bump のたびにフィクスチャが陳腐化し、
   coordinatorAppVer !== appVer (scripts/46-form-core.js) の無効化パスへ落ちる。 */
const TASK9_APP_VER = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "version.json"), "utf8"),
).v;
const TASK9_KEY = "archeryNote.v1";
const TASK9_SNAPSHOT_KEY = "archeryNote.snapshots.v1";
const TASK9_BATCH_ID = "11111111-1111-4111-8111-111111111111";
const TASK9_SLOTS = ["side", "oblique", "normal_range"];
const TASK9_SENTINEL = "TASK9_SYNTHETIC_EXCLUDED_SECRET";

function task9Receipt(index) {
  return {
    id: `form-receipt-${index}`,
    fireTs: 1000 + index,
    shotCreated: true,
    userDisposition: "present",
    detectorDisposition: "confirmed",
    cancelReason: null,
    unresolvedReason: null,
    fire: {
      anchorFloor: null,
      anchorEnter: 0.5,
      releaseSpeed: 7,
      evidenceAgeMs: null,
      evidenceStrength: null,
      departDelta: null,
      fireEvidence: "close",
    },
    excludedSecret: TASK9_SENTINEL,
  };
}

function task9Record(runIndex) {
  const id = `synthetic-task9-record-${runIndex + 1}`;
  return {
    id,
    fixtureNotice: "synthetic-only-no-real-user-or-device-data",
    date: "2099-01-01",
    ts: 4070908800000 + runIndex,
    sessionId: `synthetic-private-session-${runIndex}`,
    setupId: `synthetic-private-setup-${runIndex}`,
    shots: 6,
    modelVer: "synthetic-model",
    appVer: TASK9_APP_VER,
    fps: 30,
    features: Array.from({ length: 6 }, (_, index) => ({
      receiptId: `form-receipt-${index + 1}`,
      note: TASK9_SENTINEL,
      rawLandmarks: [TASK9_SENTINEL],
    })),
    note: TASK9_SENTINEL,
    formDiagnosticVersion: 1,
    captureMode: "live",
    formPhaseDiag: {
      releaseReceipts: Array.from({ length: 6 }, (_, index) => task9Receipt(index + 1)),
      receiptOverflow: 0,
      receiptInvariantCounts: {
        supersededActive: 0,
        missingActive: 0,
        identityMismatch: 0,
        invalidTransition: 0,
        sequenceExhausted: 0,
      },
      receiptDesynchronized: false,
      framesBefore: [TASK9_SENTINEL],
      rejectedFramesNear: [TASK9_SENTINEL],
    },
    formDiagnosticMatrix: {
      version: 1,
      batchId: TASK9_BATCH_ID,
      slot: TASK9_SLOTS[runIndex],
    },
    media: TASK9_SENTINEL,
    path: TASK9_SENTINEL,
    url: TASK9_SENTINEL,
    unknownFutureKey: TASK9_SENTINEL,
  };
}

function makeTask9DiagnosticDb(formDebug = true) {
  const database = makeSyntheticDiagnosticDb();
  const records = TASK9_SLOTS.map((slot, index) => task9Record(index));
  database.schema = 5;
  database.setups = [{ id: "synthetic-private-setup", name: TASK9_SENTINEL }];
  database.sightMarks = [];
  database.sessions = [
    { id: "synthetic-private-session", date: "2099-01-01", note: TASK9_SENTINEL },
  ];
  database.trash = [
    { id: "synthetic-private-trash", type: "formAnalysis", data: { note: TASK9_SENTINEL } },
  ];
  database.formAnalyses = records;
  database.customRounds = [];
  database.settings = Object.assign({}, database.settings, {
    formDebug,
    lastBackupAt: "2099-01-01T00:00:00.000Z",
    onboardingSeen: true,
    activeGuideSeen: true,
    formDiagnosticMatrixBatch: {
      version: 1,
      batchId: TASK9_BATCH_ID,
      appVer: TASK9_APP_VER,
      nextSlot: 3,
      recordIds: records.map((record) => record.id),
      invalidated: false,
    },
  });
  database.active = null;
  return database;
}

async function seedTask9Page(page, database, mode = "web-success") {
  await page.addInitScript(
    ({ database: seed, mode: transportMode }) => {
      localStorage.setItem("archeryNote.v1", JSON.stringify(seed));
      globalThis.__task9Transport = {
        mode: transportMode,
        shareCalls: [],
        nativeCalls: [],
        objectUrls: [],
        revokedUrls: [],
        blobTypes: [],
      };
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value(data) {
          return (
            transportMode.startsWith("web-") && Array.isArray(data.files) && data.files.length === 1
          );
        },
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        async value(data) {
          const file = data.files[0];
          globalThis.__task9Transport.shareCalls.push({
            name: file.name,
            type: file.type,
            text: await file.text(),
          });
          if (transportMode === "web-abort")
            throw new DOMException("fixture canceled", "AbortError");
          if (transportMode === "web-error") throw new Error("fixture web failure");
        },
      });
      const realCreateObjectURL = URL.createObjectURL.bind(URL);
      const realRevokeObjectURL = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        globalThis.__task9Transport.blobTypes.push(blob.type);
        const value = realCreateObjectURL(blob);
        globalThis.__task9Transport.objectUrls.push(value);
        return value;
      };
      URL.revokeObjectURL = (value) => {
        globalThis.__task9Transport.revokedUrls.push(value);
        return realRevokeObjectURL(value);
      };
      if (transportMode === "native-cleanup-error") {
        let deletes = 0;
        globalThis.Capacitor = {
          getPlatform() {
            return "ios";
          },
          Plugins: {
            Filesystem: {
              async deleteFile(options) {
                deletes += 1;
                globalThis.__task9Transport.nativeCalls.push({ op: "delete", options });
                if (deletes === 2) throw new Error("fixture final cleanup failure");
              },
              async writeFile(options) {
                globalThis.__task9Transport.nativeCalls.push({ op: "write", options });
                return { uri: "capacitor://cache/task9-diagnostics" };
              },
            },
            Share: {
              async share(options) {
                globalThis.__task9Transport.nativeCalls.push({ op: "share", options });
              },
            },
          },
        };
      }
    },
    { database, mode },
  );
  await page.goto("/");
  await page.locator("#btnSettings").click();
  await page.waitForTimeout(750);
  // 起動直後の保存（launch-count）の控えは、ブラウザの手が空いたとき（最長 1.8 秒後）に書かれる。
  // 全画面の設定では描画が止まっていて手空きの通知が遅れることがあるので、ここで書き切ってから「前」の状態を取る
  await page.evaluate(() => {
    globalThis.flushPendingSave();
    globalThis.flushSafetySnapshot();
  });
}

/* 以前の撮影画面（実時間の検出器）は、どの画面からも開けない（AN-101）。比べるための基準としてコードと検査だけを残してあるので、
   関数を直接呼んで、保存の失敗とやり直しの決まりを確かめ続ける */
async function openEarlierCapture(page) {
  await page.evaluate(() => globalThis.openFormCapture());
}

async function task9PersistenceSnapshot(page) {
  return page.evaluate(
    ({ key, snapshotKey }) => ({
      memory: JSON.stringify(db),
      primary: localStorage.getItem(key),
      snapshots: localStorage.getItem(snapshotKey),
      lastBackupAt: db.settings.lastBackupAt,
      records: JSON.stringify(db.formAnalyses),
    }),
    { key: TASK9_KEY, snapshotKey: TASK9_SNAPSHOT_KEY },
  );
}

async function task9Confirm(page, label) {
  await page
    .locator("body > .ovl")
    .last()
    .getByRole("button", { name: label, exact: true })
    .click();
}

/* v2 の検証用の書き出しの形（FormV2.diagnostics）。数値だけで、記録の id・日付・メモ・紐づけ・保存した姿が入っていないこと */
function assertV2Diagnostics(payload, captures) {
  expect(Object.keys(payload)).toEqual(["kind", "version", "app", "units", "captures"]);
  expect(payload.kind).toBe("archery-note-form-v2-diagnostics");
  expect(payload.version).toBe(1);
  expect(payload.app).toEqual({ appVer: TASK9_APP_VER, geometry: 3, featureVersion: 1 });
  expect(payload.captures).toHaveLength(captures);
  payload.captures.forEach((c, index) => {
    expect(Object.keys(c)).toEqual([
      "capture",
      "part",
      "src",
      "hand",
      "facing",
      "frame",
      "fps",
      "model",
      "appVer",
      "analyzer",
      "featureVersion",
      "durS",
      "spanS",
      "coveragePct",
      "torsoPx",
      "view",
      "warnings",
      "counts",
      "events",
      "candidates",
      "features",
      "noise",
      "noiseDf",
      "analyzerDetail",
    ]);
    expect(c.capture).toBe(index + 1);
    expect(c.counts).toEqual({ shots: 6, letdowns: 1, candidates: 1, added: 0, removed: 0 });
    expect(c.events).toHaveLength(7);
    expect(c.frame).toEqual({ w: 720, h: 1280, o: "p" });
    expect(c.fps).toBeGreaterThan(20);
    expect(c.view.cls).toBe("s");
    expect(c.analyzerDetail.s).toHaveLength(7);
    expect(c.analyzerDetail.r.length).toBeGreaterThanOrEqual(7);
  });
  const keys = diagnosticKeyPaths(payload).map((k) => k.split(".").pop());
  for (const forbidden of DIAG_FORBIDDEN_KEYS) expect(keys).not.toContain(forbidden);
  const serialized = JSON.stringify(payload);
  for (const forbidden of [
    TASK9_SENTINEL,
    "v2-diag-",
    "synthetic-private-session",
    "synthetic-private-setup",
    "2099-01-01",
    "2026-11-",
    'landmarks":{',
    "blob:",
    "settings",
    "trash",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}
/* 診断の付いた v2 の記録 3 件（実地の確認の 3 回ぶん）を、以前の方式の記録に足した db */
function makeV2DiagnosticDb() {
  const database = makeTask9DiagnosticDb(true);
  const v2 = [0, 1, 2].flatMap((i) =>
    formV2Records({
      id: `v2-diag-${i}`,
      date: `2026-11-0${i + 1}`,
      ts: 1793491200000 + i * 86400000,
      seed: 7,
      diag: true,
      sessionId: "synthetic-private-session",
      setupId: "synthetic-private-setup",
      edit: (r) => {
        r.note = TASK9_SENTINEL;
      },
    }),
  );
  database.formAnalyses = database.formAnalyses.concat(v2);
  return database;
}

test("selected deletion rolls back when the primary write fails", async ({ page }) => {
  const coordinator = {
    version: 1,
    batchId: "11111111-1111-4111-8111-111111111111",
    appVer: TASK9_APP_VER,
    nextSlot: 1,
    recordIds: ["selected-record"],
    invalidated: false,
  };
  const database = makeSyntheticDiagnosticDb({
    updatedAt: "before-delete",
    formAnalyses: [
      {
        id: "selected-record",
        date: "2026-01-01",
        ts: 1,
        shots: 6,
        features: [],
        note: "synthetic deletion fixture",
      },
    ],
    settings: { formDiagnosticMatrixBatch: coordinator },
  });
  await seedDiagnosticDb(page, database);
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator('#analysisSubTabs [data-an="form"]').click(); // v5 段 7: 射型の記録は 分析 > 射型
  await page.waitForTimeout(750);
  await installPrimaryWriteGate(page);
  const rollbackBaseline = await page.evaluate(() => {
    globalThis.__selectedCoordinatorReference = db.settings.formDiagnosticMatrixBatch;
    globalThis.__formWriteProbe.attempts = [];
    return db.updatedAt;
  });

  await page.locator('[data-del-form="selected-record"]').click();
  await page.locator(".confirmSheet #acOk").click();

  await expect(page.locator('[data-form-id="selected-record"]')).toHaveCount(1);
  await expect(page.locator("#toast")).toContainText(
    "射型記録を保存できなかったため、削除していません",
  );
  expect(
    await page.evaluate(() => ({
      ids: db.formAnalyses.map((record) => record.id),
      trash: db.trash.length,
      invalidated: db.settings.formDiagnosticMatrixBatch.invalidated,
      sameCoordinator:
        db.settings.formDiagnosticMatrixBatch === globalThis.__selectedCoordinatorReference,
      updatedAt: db.updatedAt,
      attempts: globalThis.__formWriteProbe.attempts.length,
    })),
  ).toEqual({
    ids: ["selected-record"],
    trash: 0,
    invalidated: false,
    sameCoordinator: true,
    updatedAt: rollbackBaseline,
    attempts: 1,
  });

  await page.evaluate(() => {
    globalThis.__formWriteProbe.fail = false;
  });
  await page.locator('[data-del-form="selected-record"]').click();
  await page.locator(".confirmSheet #acOk").click();
  await expect(page.locator('[data-form-id="selected-record"]')).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      trash: db.trash.length,
      trashType: db.trash[0].type,
      trashRecordId: db.trash[0].data.id,
      invalidated: db.settings.formDiagnosticMatrixBatch.invalidated,
      attempts: globalThis.__formWriteProbe.attempts.length,
    })),
  ).toEqual({
    records: 0,
    trash: 1,
    trashType: "formAnalysis",
    trashRecordId: "selected-record",
    invalidated: true,
    attempts: 2,
  });
});

test("zero-shot exact-debug live save freezes, rolls back, and retries once", async ({ page }) => {
  const database = makeSyntheticDiagnosticDb({
    updatedAt: "before-live-save",
    settings: {
      formDebug: true,
      formDiagnosticMatrixBatch: {
        version: 1,
        batchId: "11111111-1111-4111-8111-111111111111",
        appVer: TASK9_APP_VER,
        nextSlot: 0,
        recordIds: [],
        invalidated: false,
      },
    },
  });
  await seedDiagnosticDb(page, database);
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator('#analysisSubTabs [data-an="form"]').click(); // v5 段 7: 射型の記録は 分析 > 射型
  await stallFormPose(page);
  await installPrimaryWriteGate(page);
  await openEarlierCapture(page);
  const liveBaseline = await resetWriteProbeAfterStartup(page);
  await page.locator("#fcClose").click();
  await expect(page.locator(".formCapture")).toBeVisible();
  await expect(page.locator("#fcSave")).toBeEnabled();
  await expect(page.locator("#fcSave")).toHaveText("保存を再試行");
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      updatedAt: db.updatedAt,
      attempts: globalThis.__formWriteProbe.attempts.length,
      blocked: globalThis.isUpdateReloadBlocked(),
    })),
  ).toEqual({ records: 0, updatedAt: liveBaseline, attempts: 1, blocked: true });
  await page.evaluate(() => {
    globalThis.__formWriteProbe.fail = false;
  });
  await page.locator("#fcSave").click();
  await expect(page.locator(".formCapture")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      shots: db.formAnalyses[0].shots,
      mode: db.formAnalyses[0].captureMode,
      marker: Object.hasOwn(db.formAnalyses[0], "formDiagnosticMatrix"),
      attempts: globalThis.__formWriteProbe.attempts.length,
      blocked: globalThis.isUpdateReloadBlocked(),
    })),
  ).toEqual({ records: 1, shots: 0, mode: "live", marker: false, attempts: 2, blocked: false });
});

test("failed diagnostic discard cancel retains the candidate and confirm closes without saving", async ({
  page,
}) => {
  await seedDiagnosticDb(page, makeSyntheticDiagnosticDb({ settings: { formDebug: true } }));
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator('#analysisSubTabs [data-an="form"]').click(); // v5 段 7: 射型の記録は 分析 > 射型
  await stallFormPose(page);
  await installPrimaryWriteGate(page);
  await openEarlierCapture(page);
  await resetWriteProbeAfterStartup(page);
  await page.locator("#fcClose").click();
  await page.locator("#fcClose").click();
  await expect(page.locator(".confirmSheet")).toContainText(
    "保存できていない診断を破棄して閉じますか？",
  );
  await page.locator(".confirmSheet #acCancel").click();
  await expect(page.locator(".formCapture")).toBeVisible();
  expect(await page.evaluate(() => globalThis.__formWriteProbe.attempts.length)).toBe(1);
  await page.locator("#fcClose").click();
  await page.locator(".confirmSheet #acOk").click();
  await expect(page.locator(".formCapture")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      attempts: globalThis.__formWriteProbe.attempts.length,
      blocked: globalThis.isUpdateReloadBlocked(),
    })),
  ).toEqual({ records: 0, attempts: 1, blocked: false });
});

test("zero-shot exact-debug replay save retries without matrix advancement", async ({ page }) => {
  const coordinator = {
    version: 1,
    batchId: "11111111-1111-4111-8111-111111111111",
    appVer: TASK9_APP_VER,
    nextSlot: 0,
    recordIds: [],
    invalidated: false,
  };
  await seedDiagnosticDb(
    page,
    makeSyntheticDiagnosticDb({
      updatedAt: "before-replay-save",
      settings: { formDebug: true, formDiagnosticMatrixBatch: coordinator },
    }),
  );
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator('#analysisSubTabs [data-an="form"]').click(); // v5 段 7: 射型の記録は 分析 > 射型
  await stallFormPose(page);
  await installPrimaryWriteGate(page);
  await page.evaluate(() => {
    globalThis.__replayCoordinatorReference = db.settings.formDiagnosticMatrixBatch;
  });
  /* 以前の動画解析の画面も、画面からは開けない。関数を直接呼ぶ（中身は再生できない合成のファイル） */
  await page.evaluate(() => {
    const file = new globalThis.File(["synthetic replay fixture"], "synthetic-form-replay.mp4", {
      type: "video/mp4",
    });
    globalThis.startFormReplay(URL.createObjectURL(file));
  });
  await expect(page.locator("#frVideo")).toBeVisible();
  const replayBaseline = await resetWriteProbeAfterStartup(page);
  await page.locator("#frClose").click();
  await expect(page.locator(".formCapture")).toBeVisible();
  await expect(page.locator("#frSave")).toBeEnabled();
  await expect(page.locator("#frSave")).toHaveText("保存を再試行");
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      sameCoordinator:
        db.settings.formDiagnosticMatrixBatch === globalThis.__replayCoordinatorReference,
      updatedAt: db.updatedAt,
      attempts: globalThis.__formWriteProbe.attempts.length,
      blocked: globalThis.isUpdateReloadBlocked(),
    })),
  ).toEqual({
    records: 0,
    sameCoordinator: true,
    updatedAt: replayBaseline,
    attempts: 1,
    blocked: true,
  });
  await page.evaluate(() => {
    globalThis.__formWriteProbe.fail = false;
  });
  await page.locator("#frSave").click();
  await expect(page.locator(".formCapture")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      shots: db.formAnalyses[0].shots,
      mode: db.formAnalyses[0].captureMode,
      marker: Object.hasOwn(db.formAnalyses[0], "formDiagnosticMatrix"),
      sameCoordinator:
        db.settings.formDiagnosticMatrixBatch === globalThis.__replayCoordinatorReference,
      attempts: globalThis.__formWriteProbe.attempts.length,
      blocked: globalThis.isUpdateReloadBlocked(),
    })),
  ).toEqual({
    records: 1,
    shots: 0,
    mode: "replay",
    marker: false,
    sameCoordinator: true,
    attempts: 2,
    blocked: false,
  });
});

/* ---- 設定の検証用の書き出し（v2 の記録から。AN-101） ----
   以前の「18射の診断」（開始・やり直し・3 条件 × 6 射の書き出し）の画面の検査 22 本は、画面ごと無くしたので外した。
   その純関数の検査は tools/check-form-diagnostics.js に残っている。 */
for (const [label, value, own] of [
  ["absent", undefined, false],
  ["false", false, true],
  ['string "true"', "true", true],
]) {
  test(`${label} formDebug keeps diagnostics hidden and disabled`, async ({ page }) => {
    const database = makeTask9DiagnosticDb(true);
    if (own) database.settings.formDebug = value;
    else delete database.settings.formDebug;
    await seedTask9Page(page, database);
    const section = page.getByTestId("form-diagnostic-section");
    await expect(section).toBeHidden();
    await expect(section.locator("#fdV2Export")).toBeDisabled();
    await expect(section.locator("#fdLmChips button").first()).toBeDisabled();
    await expect(page.locator("#fdMatrixStart, #fdMatrixExport")).toHaveCount(0);
  });
}

test("diagnostic controls follow exact formDebug without reopening settings", async ({ page }) => {
  await seedTask9Page(page, makeTask9DiagnosticDb(false));
  const section = page.getByTestId("form-diagnostic-section");
  await expect(section).toBeHidden();
  await page.locator('#fdChips [data-fd="1"]').click();
  await expect(section).toBeVisible();
  await expect(section.locator("#fdV2Export")).toBeEnabled();
  await expect(section).not.toContainText("18射");
  await expect(page.getByTestId("settings-group-record")).not.toContainText("以前の撮影画面");
  await expect(section.locator('#fdLmChips [data-fl="0"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('#fdChips [data-fd="0"]').click();
  await expect(section).toBeHidden();
});

test("settings export: v2 records with diagnostics go out through one File share, numbers only", async ({
  page,
}) => {
  await seedTask9Page(page, makeV2DiagnosticDb(), "web-success");
  const section = page.getByTestId("form-diagnostic-section");
  await expect(page.getByTestId("form-diagnostic-status")).toHaveText("診断の付いた記録: 3件");
  const before = await task9PersistenceSnapshot(page);
  await section.locator("#fdV2Export").click();
  await expect(page.locator(".confirmSheet")).toContainText("入るのは数値だけです");
  await expect(page.locator(".confirmSheet")).not.toContainText("体の 9 点");
  await task9Confirm(page, "書き出す");
  await expect
    .poll(() => page.evaluate(() => globalThis.__task9Transport.shareCalls.length))
    .toBe(1);
  const transport = await page.evaluate(() => globalThis.__task9Transport);
  expect(transport.shareCalls[0].name).toBe("archery-note-form-diagnostics.json");
  expect(transport.shareCalls[0].type).toBe("application/json;charset=utf-8");
  assertV2Diagnostics(JSON.parse(transport.shareCalls[0].text), 3);
  expect(transport.objectUrls).toHaveLength(0);
  await expect(page.locator("#toast")).toContainText("診断を共有しました");
  expect(await task9PersistenceSnapshot(page)).toEqual(before);
});

test("settings export: cancel sends nothing; without share it downloads and revokes the URL", async ({
  page,
}) => {
  await seedTask9Page(page, makeV2DiagnosticDb(), "download");
  const before = await task9PersistenceSnapshot(page);
  await page.locator("#fdV2Export").click();
  await task9Confirm(page, "キャンセル");
  expect(await page.evaluate(() => globalThis.__task9Transport.objectUrls.length)).toBe(0);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#fdV2Export").click();
  await task9Confirm(page, "書き出す");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("archery-note-form-diagnostics.json");
  assertV2Diagnostics(JSON.parse(fs.readFileSync(await download.path(), "utf8")), 3);
  const transport = await page.evaluate(() => globalThis.__task9Transport);
  expect(transport.blobTypes).toEqual(["application/json;charset=utf-8"]);
  expect(transport.objectUrls).toHaveLength(1);
  expect(transport.revokedUrls).toEqual(transport.objectUrls);
  expect(await task9PersistenceSnapshot(page)).toEqual(before);
});

test("settings export: the setting turned off behind the confirmation stops the export", async ({
  page,
}) => {
  await seedTask9Page(page, makeV2DiagnosticDb(), "web-success");
  await page.locator("#fdV2Export").click();
  await page.evaluate(() => {
    db.settings.formDebug = "true";
  });
  await task9Confirm(page, "書き出す");
  await expect(page.locator("#toast")).toContainText("「検証用の診断データ」を入にしてください");
  expect(await page.evaluate(() => globalThis.__task9Transport.shareCalls.length)).toBe(0);
});

for (const viewport of [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test(`diagnostic settings fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedTask9Page(page, makeTask9DiagnosticDb(true));
    await page.getByTestId("form-diagnostic-section").scrollIntoViewIfNeeded();
    const layout = await page.evaluate(() => {
      const sheet = globalThis.document.querySelector(".sheet");
      const section = globalThis.document.querySelector("[data-form-diagnostic-section]");
      const sheetRect = sheet.getBoundingClientRect();
      const rects = [...section.querySelectorAll("button")].map((b) => b.getBoundingClientRect());
      return {
        buttons: rects.length,
        documentOverflow:
          globalThis.document.documentElement.scrollWidth >
          globalThis.document.documentElement.clientWidth,
        sheetOverflow: sheet.scrollWidth > sheet.clientWidth,
        sectionOverflow: section.scrollWidth > section.clientWidth,
        clipped: rects.some(
          (rect) =>
            rect.width < 44 ||
            rect.height < 44 ||
            rect.left < sheetRect.left ||
            rect.right > sheetRect.right,
        ),
      };
    });
    expect(layout).toEqual({
      buttons: 3,
      documentOverflow: false,
      sheetOverflow: false,
      sectionOverflow: false,
      clipped: false,
    });
  });
}

for (const [label, value, enabled] of [
  ["missing", undefined, false],
  ["false", false, false],
  ["zero", 0, false],
  ["one", 1, false],
  ['string "true"', "true", false],
  ['string "false"', "false", false],
  ["literal true", true, true],
]) {
  test(`form tracking ${label} is ${enabled ? "enabled" : "disabled"} everywhere`, async ({
    page,
  }) => {
    const database = makeSyntheticDiagnosticDb();
    if (label === "missing") delete database.settings.formTrackingEnabled;
    else database.settings.formTrackingEnabled = value;

    await seedDiagnosticDb(page, database);
    await page.goto("/");
    await page.locator('#tabs [data-v="analysis"]').click();
    await page.locator('#analysisSubTabs [data-an="form"]').click(); // v5 段 7: 射型の記録は 分析 > 射型

    const card = page.getByTestId("analysis-form-card");
    if (enabled) await expect(card).toHaveCount(1);
    else await expect(card).toHaveCount(0);

    // v5: 設定の入口は記録タブの見出し行だけにある
    await page.locator('#tabs [data-v="record"]').click();
    await page.locator("#btnSettings").click();
    const pressed = page.locator('#ftChips button[aria-pressed="true"]');
    await expect(pressed).toHaveCount(1);
    await expect(pressed).toHaveAttribute("data-ft", enabled ? "1" : "0");

    await page.locator('#ftChips button[data-ft="1"]').click();
    await expect(pressed).toHaveAttribute("data-ft", "1");
    expect(await page.evaluate(() => db.settings.formTrackingEnabled)).toBe(true);
    await page.locator('#ftChips button[data-ft="0"]').click();
    await expect(pressed).toHaveAttribute("data-ft", "0");
    expect(await page.evaluate(() => db.settings.formTrackingEnabled)).toBe(false);
  });
}
