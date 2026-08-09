"use strict";
/* global db */

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
