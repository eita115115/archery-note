"use strict";
/* global db */

const fs = require("fs");
const { expect, test } = require("@playwright/test");

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

const TASK9_APP_VER = 84;
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

function assertTask9Artifact(payload) {
  expect(Object.keys(payload)).toEqual(["format", "schemaVersion", "appVersion", "matrix", "runs"]);
  expect(payload.format).toBe("archery-note-form-diagnostics");
  expect(payload.schemaVersion).toBe(1);
  expect(payload.appVersion).toBe(TASK9_APP_VER);
  expect(payload.matrix).toBe("field-3x6");
  expect(payload.runs).toHaveLength(3);
  payload.runs.forEach((run, index) => {
    expect(Object.keys(run)).toEqual(["runOrdinal", "condition", "retainedShotCount", "receipts"]);
    expect(run.runOrdinal).toBe(index + 1);
    expect(run.condition).toBe(TASK9_SLOTS[index]);
    expect(run.retainedShotCount).toBe(6);
    expect(run.receipts).toHaveLength(6);
  });
  const serialized = JSON.stringify(payload);
  for (const forbidden of [
    TASK9_SENTINEL,
    "synthetic-task9-record-",
    "form-receipt-",
    "synthetic-private-session",
    "synthetic-private-setup",
    "2099-01-01",
    "framesBefore",
    "rejectedFramesNear",
    "settings",
    "trash",
    "path",
    "url",
    "unknownFutureKey",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

test("selected deletion rolls back when the primary write fails", async ({ page }) => {
  const coordinator = {
    version: 1,
    batchId: "11111111-1111-4111-8111-111111111111",
    appVer: 84,
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
    "射形記録を保存できなかったため、削除していません",
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
        appVer: 84,
        nextSlot: 0,
        recordIds: [],
        invalidated: false,
      },
    },
  });
  await seedDiagnosticDb(page, database);
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await stallFormPose(page);
  await installPrimaryWriteGate(page);
  await page.locator("#formStart").click();
  await expect(page.locator('.formCapture[data-motion-state="ready"]')).toHaveCount(1);
  const liveBaseline = await resetWriteProbeAfterStartup(page);
  await page.locator("#fcClose").click();
  await expect(page.locator(".formCapture")).toBeVisible();
  await expect(page.locator('.formCapture[data-motion-state="failed"]')).toHaveCount(1);
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
  await expect(page.locator('.formCapture[data-motion-state="saved"]')).toHaveCount(1);
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

test("form capture discard leaves a canceled frame before teardown", async ({ page }) => {
  await seedDiagnosticDb(page, makeSyntheticDiagnosticDb({ settings: { formDebug: false } }));
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await stallFormPose(page);
  await page.locator("#formStart").click();
  await expect(page.locator('.formCapture[data-motion-state="ready"]')).toHaveCount(1);
  await page.locator("#fcClose").click();
  await expect(page.locator('.formCapture[data-motion-state="canceled"]')).toHaveCount(1);
  await expect(page.locator(".formCapture")).toHaveCount(0);
});

test("reduced motion completes a form discard on the next frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedDiagnosticDb(page, makeSyntheticDiagnosticDb({ settings: { formDebug: false } }));
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await stallFormPose(page);
  await page.locator("#formStart").click();
  await page.locator("#fcClose").click();
  await expect(page.locator(".formCapture")).toHaveCount(0);
});

test("rapid diagnostic save clicks commit one record and one primary write", async ({ page }) => {
  await seedDiagnosticDb(page, makeSyntheticDiagnosticDb({ settings: { formDebug: true } }));
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await stallFormPose(page);
  await installPrimaryWriteGate(page);
  await page.locator("#formStart").click();
  await resetWriteProbeAfterStartup(page);
  await page.evaluate(() => {
    globalThis.__formWriteProbe.fail = false;
  });
  await page.locator("#fcClose").dblclick({ force: true });
  await expect(page.locator('.formCapture[data-motion-state="saved"]')).toHaveCount(1);
  await expect(page.locator(".formCapture")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      attempts: globalThis.__formWriteProbe.attempts.length,
    })),
  ).toEqual({ records: 1, attempts: 1 });
});

test("failed diagnostic discard cancel retains the candidate and confirm closes without saving", async ({
  page,
}) => {
  await seedDiagnosticDb(page, makeSyntheticDiagnosticDb({ settings: { formDebug: true } }));
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await stallFormPose(page);
  await installPrimaryWriteGate(page);
  await page.locator("#formStart").click();
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
    appVer: 84,
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
  await stallFormPose(page);
  await installPrimaryWriteGate(page);
  await page.evaluate(() => {
    globalThis.__replayCoordinatorReference = db.settings.formDiagnosticMatrixBatch;
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("#formReplay").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "synthetic-form-replay.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("synthetic replay fixture"),
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
    await expect(section.locator("#fdMatrixStart")).toBeDisabled();
    await expect(section.locator("#fdMatrixExport")).toBeDisabled();
  });
}

test("diagnostic controls follow exact formDebug without reopening settings", async ({ page }) => {
  await seedTask9Page(page, makeTask9DiagnosticDb(false));
  const section = page.getByTestId("form-diagnostic-section");
  await expect(section).toBeHidden();
  await page.locator('#fdChips [data-fd="1"]').click();
  await expect(section).toBeVisible();
  await expect(section.getByRole("button", { name: "18射の診断を開始" })).toBeEnabled();
  await page.locator('#fdChips [data-fd="0"]').click();
  await expect(section).toBeHidden();
  expect(await page.evaluate(() => db.settings.formDiagnosticMatrixBatch.batchId)).toBe(
    TASK9_BATCH_ID,
  );
});

test("action-time exact gate rejects a value changed after render", async ({ page }) => {
  await seedTask9Page(page, makeTask9DiagnosticDb(true));
  await page.evaluate(() => {
    db.settings.formDebug = "true";
    globalThis.document.querySelector("#fdMatrixStart").click();
  });
  await expect(page.getByTestId("form-diagnostic-section")).toBeHidden();
  expect(await page.evaluate(() => db.settings.formDiagnosticMatrixBatch.batchId)).toBe(
    TASK9_BATCH_ID,
  );
});

test("another workflow blocks both actions before confirmation", async ({ page }) => {
  await seedTask9Page(page, makeTask9DiagnosticDb(true));
  await page.evaluate(() => globalThis.beginActiveWorkflow());
  try {
    await page.locator("#fdMatrixStart").click();
    await page.locator("#fdMatrixExport").click();
    await expect(page.locator(".confirmSheet")).toHaveCount(0);
    await expect(page.locator("#toast")).toContainText(
      "ほかの操作中は18射の診断を開始・書き出しできません。",
    );
  } finally {
    await page.evaluate(() => globalThis.endActiveWorkflow());
  }
});

test("first start commits one fresh coordinator", async ({ page }) => {
  const database = makeTask9DiagnosticDb(true);
  delete database.settings.formDiagnosticMatrixBatch;
  await seedTask9Page(page, database);
  await page.locator("#fdMatrixStart").click();
  const batch = await page.evaluate(() => db.settings.formDiagnosticMatrixBatch);
  expect(batch).toEqual({
    version: 1,
    batchId: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    ),
    appVer: TASK9_APP_VER,
    nextSlot: 0,
    recordIds: [],
    invalidated: false,
  });
  await expect(page.getByTestId("form-diagnostic-status")).toHaveText(
    "次は「真横」を6射記録してください。",
  );
});

test("restart double click opens one confirmation; cancel preserves and confirm replaces", async ({
  page,
}) => {
  const database = makeTask9DiagnosticDb(true);
  database.settings.formDiagnosticMatrixBatch.nextSlot = 1;
  database.settings.formDiagnosticMatrixBatch.recordIds =
    database.settings.formDiagnosticMatrixBatch.recordIds.slice(0, 1);
  database.formAnalyses = database.formAnalyses.slice(0, 1);
  await seedTask9Page(page, database);
  await page.evaluate(() => {
    const button = globalThis.document.querySelector("#fdMatrixStart");
    button.click();
    button.click();
  });
  await expect(page.locator(".confirmSheet")).toHaveCount(1);
  await task9Confirm(page, "キャンセル");
  expect(await page.evaluate(() => db.settings.formDiagnosticMatrixBatch.batchId)).toBe(
    TASK9_BATCH_ID,
  );
  await page.locator("#fdMatrixStart").click();
  await task9Confirm(page, "開始し直す");
  expect(await page.evaluate(() => db.settings.formDiagnosticMatrixBatch.batchId)).not.toBe(
    TASK9_BATCH_ID,
  );
});

test("restart post-confirm token change fails closed", async ({ page }) => {
  const database = makeTask9DiagnosticDb(true);
  database.settings.formDiagnosticMatrixBatch.nextSlot = 1;
  database.settings.formDiagnosticMatrixBatch.recordIds =
    database.settings.formDiagnosticMatrixBatch.recordIds.slice(0, 1);
  database.formAnalyses = database.formAnalyses.slice(0, 1);
  await seedTask9Page(page, database);
  await page.locator("#fdMatrixStart").click();
  await page.evaluate(() => {
    db.settings.formDiagnosticMatrixBatch = {
      version: 1,
      batchId: "22222222-2222-4222-8222-222222222222",
      appVer: 84,
      nextSlot: 0,
      recordIds: [],
      invalidated: false,
    };
  });
  await task9Confirm(page, "開始し直す");
  await expect(page.locator("#toast")).toContainText(
    "診断バッチが変更されたため、操作を中止しました。",
  );
  expect(await page.evaluate(() => db.settings.formDiagnosticMatrixBatch.batchId)).toBe(
    "22222222-2222-4222-8222-222222222222",
  );
});

test("allocation failure and save false both preserve prior coordinator and updatedAt", async ({
  page,
}) => {
  const database = makeTask9DiagnosticDb(true);
  delete database.settings.formDiagnosticMatrixBatch;
  delete database.updatedAt;
  await seedTask9Page(page, database);
  await page.evaluate(() => {
    delete db.updatedAt;
  });
  await page.evaluate(() => {
    globalThis.allocateFormDiagnosticBatchId = () => ({
      ok: false,
      code: "crypto-unavailable",
      batchId: null,
    });
  });
  await page.locator("#fdMatrixStart").click();
  expect(
    await page.evaluate(() => ({
      hasBatch: Object.hasOwn(db.settings, "formDiagnosticMatrixBatch"),
      hasUpdatedAt: Object.hasOwn(db, "updatedAt"),
    })),
  ).toEqual({ hasBatch: false, hasUpdatedAt: false });
  await page.reload();
  await page.locator("#btnSettings").click();
  await page.waitForTimeout(750);
  await page.evaluate(() => {
    delete db.updatedAt;
    globalThis.save = () => false;
  });
  await page.locator("#fdMatrixStart").click();
  expect(
    await page.evaluate(() => ({
      hasBatch: Object.hasOwn(db.settings, "formDiagnosticMatrixBatch"),
      hasUpdatedAt: Object.hasOwn(db, "updatedAt"),
    })),
  ).toEqual({ hasBatch: false, hasUpdatedAt: false });
  await expect(page.locator("#toast")).toContainText("診断バッチを保存できませんでした。");
});

test("side state uses fixed copy", async ({ page }) => {
  const side = makeTask9DiagnosticDb(true);
  side.settings.formDiagnosticMatrixBatch.nextSlot = 0;
  side.settings.formDiagnosticMatrixBatch.recordIds = [];
  side.formAnalyses = [];
  await seedTask9Page(page, side);
  await expect(page.getByTestId("form-diagnostic-status")).toHaveText(
    "次は「真横」を6射記録してください。",
  );
});

test("complete state uses fixed copy", async ({ page }) => {
  await seedTask9Page(page, makeTask9DiagnosticDb(true));
  await expect(page.getByTestId("form-diagnostic-status")).toHaveText("18射の診断がそろいました。");
});

test("export post-confirm exact-debug and workflow rechecks prevent transport", async ({
  page,
}) => {
  await seedTask9Page(page, makeTask9DiagnosticDb(true));
  await page.locator("#fdMatrixExport").click();
  await page.evaluate(() => {
    db.settings.formDebug = false;
  });
  await task9Confirm(page, "書き出す");
  expect(await page.evaluate(() => globalThis.__task9Transport.shareCalls.length)).toBe(0);
  await page.reload();
  await page.locator("#btnSettings").click();
  await page.locator("#fdMatrixExport").click();
  await page.evaluate(() => globalThis.beginActiveWorkflow());
  try {
    await task9Confirm(page, "書き出す");
    expect(await page.evaluate(() => globalThis.__task9Transport.shareCalls.length)).toBe(0);
  } finally {
    await page.evaluate(() => globalThis.endActiveWorkflow());
  }
});

for (const [label, mutate, expectedCopy] of [
  [
    "incomplete",
    (database) => {
      database.settings.formDiagnosticMatrixBatch.nextSlot = 2;
      database.settings.formDiagnosticMatrixBatch.recordIds =
        database.settings.formDiagnosticMatrixBatch.recordIds.slice(0, 2);
      database.formAnalyses = database.formAnalyses.slice(0, 2);
    },
    "18射の診断が完了していません。",
  ],
  [
    "stale",
    (database) => {
      database.settings.formDiagnosticMatrixBatch.appVer = TASK9_APP_VER - 1;
    },
    "現在の診断バッチは使用できません。",
  ],
  [
    "malformed",
    (database) => {
      database.settings.formDiagnosticMatrixBatch.extra = true;
    },
    "現在の診断バッチは使用できません。",
  ],
  [
    "replay",
    (database) => {
      database.formAnalyses[0].captureMode = "replay";
    },
    "診断データを安全に書き出せません。",
  ],
  [
    "duplicate selected ID",
    (database) => {
      database.formAnalyses.push(structuredClone(database.formAnalyses[0]));
    },
    "現在の診断バッチは使用できません。",
  ],
  [
    "overflow",
    (database) => {
      database.formAnalyses[0].formPhaseDiag.receiptOverflow = 1;
    },
    "診断データを安全に書き出せません。",
  ],
]) {
  test(`${label} refuses export without transport`, async ({ page }) => {
    const database = makeTask9DiagnosticDb(true);
    mutate(database);
    await seedTask9Page(page, database);
    await page.locator("#fdMatrixExport").click();
    await task9Confirm(page, "書き出す");
    await expect(page.locator("#toast")).toContainText(expectedCopy);
    expect(
      await page.evaluate(() => ({
        shares: globalThis.__task9Transport.shareCalls.length,
        urls: globalThis.__task9Transport.objectUrls.length,
        native: globalThis.__task9Transport.nativeCalls.length,
      })),
    ).toEqual({ shares: 0, urls: 0, native: 0 });
  });
}

test("output-too-large uses the fixed repeat copy", async ({ page }) => {
  await seedTask9Page(page, makeTask9DiagnosticDb(true));
  await page.evaluate(() => {
    globalThis.buildFormDiagnosticExport = () => ({
      ok: false,
      code: "output-too-large",
      payload: null,
      json: null,
      byteLength: null,
    });
  });
  await page.locator("#fdMatrixExport").click();
  await task9Confirm(page, "書き出す");
  await expect(page.locator("#toast")).toContainText("診断データを安全に書き出せません。");
});

test("export double click opens one confirmation and cancel preserves all state", async ({
  page,
}) => {
  await seedTask9Page(page, makeTask9DiagnosticDb(true));
  const before = await task9PersistenceSnapshot(page);
  await page.evaluate(() => {
    const button = globalThis.document.querySelector("#fdMatrixExport");
    button.click();
    button.click();
  });
  await expect(page.locator(".confirmSheet")).toHaveCount(1);
  await task9Confirm(page, "キャンセル");
  expect(await task9PersistenceSnapshot(page)).toEqual(before);
  expect(await page.evaluate(() => globalThis.__task9Transport.shareCalls.length)).toBe(0);
});

for (const mode of ["web-success", "web-abort", "web-error"]) {
  test(`${mode} uses one File transport and preserves DB/backups`, async ({ page }) => {
    await seedTask9Page(page, makeTask9DiagnosticDb(true), mode);
    const before = await task9PersistenceSnapshot(page);
    await page.locator("#fdMatrixExport").click();
    await task9Confirm(page, "書き出す");
    await expect
      .poll(() => page.evaluate(() => globalThis.__task9Transport.shareCalls.length))
      .toBe(1);
    const transport = await page.evaluate(() => globalThis.__task9Transport);
    expect(transport.shareCalls[0].name).toBe("archery-note-form-diagnostics.json");
    expect(transport.shareCalls[0].type).toBe("application/json;charset=utf-8");
    expect(transport.objectUrls).toHaveLength(0);
    expect(transport.nativeCalls).toHaveLength(0);
    expect(await task9PersistenceSnapshot(page)).toEqual(before);
    if (mode === "web-success")
      await expect(page.locator("#toast")).toContainText("診断JSONを共有しました。");
    if (mode === "web-abort") await expect(page.locator("#toast")).not.toHaveClass(/show/);
    if (mode === "web-error")
      await expect(page.locator("#toast")).toContainText("診断JSONを書き出せませんでした。");
  });
}

test("native final cleanup warning has no download fallback and preserves state", async ({
  page,
}) => {
  await seedTask9Page(page, makeTask9DiagnosticDb(true), "native-cleanup-error");
  const before = await task9PersistenceSnapshot(page);
  await page.locator("#fdMatrixExport").click();
  await task9Confirm(page, "書き出す");
  await expect(page.locator("#toast")).toContainText(
    "診断JSONの一時ファイルを削除できませんでした。",
  );
  const transport = await page.evaluate(() => globalThis.__task9Transport);
  expect(transport.nativeCalls.map((call) => call.op)).toEqual([
    "delete",
    "write",
    "share",
    "delete",
  ]);
  expect(transport.objectUrls).toHaveLength(0);
  expect(await task9PersistenceSnapshot(page)).toEqual(before);
});

test("no-share environment downloads exact MIME/allowlist and revokes URL", async ({ page }) => {
  await seedTask9Page(page, makeTask9DiagnosticDb(true), "download");
  const before = await task9PersistenceSnapshot(page);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#fdMatrixExport").click();
  await task9Confirm(page, "書き出す");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("archery-note-form-diagnostics.json");
  const filePath = await download.path();
  const text = fs.readFileSync(filePath, "utf8");
  expect(text.endsWith("\n")).toBe(true);
  assertTask9Artifact(JSON.parse(text));
  const transport = await page.evaluate(() => globalThis.__task9Transport);
  expect(transport.blobTypes).toEqual(["application/json;charset=utf-8"]);
  expect(transport.objectUrls).toHaveLength(1);
  expect(transport.revokedUrls).toEqual(transport.objectUrls);
  expect(await task9PersistenceSnapshot(page)).toEqual(before);
});

for (const viewport of [
  { width: 360, height: 780 },
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
      const start = globalThis.document.querySelector("#fdMatrixStart").getBoundingClientRect();
      const exportButton = globalThis.document
        .querySelector("#fdMatrixExport")
        .getBoundingClientRect();
      const sheetRect = sheet.getBoundingClientRect();
      const overlap = !(
        start.right <= exportButton.left ||
        exportButton.right <= start.left ||
        start.bottom <= exportButton.top ||
        exportButton.bottom <= start.top
      );
      return {
        documentOverflow:
          globalThis.document.documentElement.scrollWidth >
          globalThis.document.documentElement.clientWidth,
        sheetOverflow: sheet.scrollWidth > sheet.clientWidth,
        sectionOverflow: section.scrollWidth > section.clientWidth,
        clipped: [start, exportButton].some(
          (rect) =>
            rect.width < 44 ||
            rect.height < 44 ||
            rect.left < sheetRect.left ||
            rect.right > sheetRect.right,
        ),
        overlap,
      };
    });
    expect(layout).toEqual({
      documentOverflow: false,
      sheetOverflow: false,
      sectionOverflow: false,
      clipped: false,
      overlap: false,
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

    const card = page.locator(".card").filter({ hasText: "射形トラッキング" });
    if (enabled) await expect(card).toHaveCount(1);
    else await expect(card).toHaveCount(0);

    await page.locator("#btnSettings").click();
    const pressed = page.locator('#ftChips .chip[aria-pressed="true"]');
    await expect(pressed).toHaveCount(1);
    await expect(pressed).toHaveAttribute("data-ft", enabled ? "1" : "0");

    await page.locator('#ftChips .chip[data-ft="1"]').click();
    await expect(pressed).toHaveAttribute("data-ft", "1");
    expect(await page.evaluate(() => db.settings.formTrackingEnabled)).toBe(true);
    await page.locator('#ftChips .chip[data-ft="0"]').click();
    await expect(pressed).toHaveAttribute("data-ft", "0");
    expect(await page.evaluate(() => db.settings.formTrackingEnabled)).toBe(false);
  });
}
