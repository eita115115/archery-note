"use strict";

const { expect, test } = require("@playwright/test");

/* iOS Safari のダブルタップズーム対策の実挙動検証。
   touch-action の設定だけでは不十分（実際に2連続タップして視覚的ズームが起きないこと・
   スコアが正しく2本記録されることの両方を確認する）。 */

const emptySetupDb = {
  schema: 3,
  setups: [
    {
      id: "e2e-setup",
      name: "E2E recurve setup",
      bow: "Recurve",
      limbs: "Sample limbs",
      poundage: 38,
      history: [],
    },
  ],
  sightMarks: [],
  sessions: [],
  trash: [],
  formAnalyses: [],
  customRounds: [],
  settings: {
    eyeSight: 850,
    theme: "auto",
    lastBackupAt: null,
    activeGuideSeen: true,
  },
  active: null,
};

test.use({ hasTouch: true, isMobile: true });

/* Chromium ヘッドレスは iOS Safari 固有のダブルタップズーム・ジェスチャーを再現しないため、
   visualViewport.scale だけでは回帰を検知できない。実際にブラウザがズーム抑止に使う
   computed touch-action（none/manipulation いずれか）が対象要素に効いていることを直接検証し、
   併せて2連続タップが正しく2本の矢として記録されることも確認する（実操作としての退行防止）。 */
function assertNoZoomTouchAction(touchAction) {
  expect(["none", "manipulation"]).toContain(touchAction);
}

async function readTouchAction(locator) {
  return locator.evaluate((el) => globalThis.getComputedStyle(el).touchAction);
}

async function readViewportScale(page) {
  return page.evaluate(() => globalThis.visualViewport?.scale ?? 1);
}

test("double-tapping the target records two arrows without triggering viewport zoom", async ({
  page,
}) => {
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, emptySetupDb);

  await page.goto("/");
  await page.getByTestId("record-start").click();

  const target = page.getByTestId("active-target");
  await expect(target).toBeVisible();

  assertNoZoomTouchAction(await readTouchAction(target));
  assertNoZoomTouchAction(await readTouchAction(page.locator("#tgsvg")));

  const box = await target.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // 2連続タップ（300ms以内）を的の中心に発火させる
  await page.touchscreen.tap(cx, cy);
  await page.waitForTimeout(120);
  await page.touchscreen.tap(cx, cy);
  await page.waitForTimeout(200);

  expect(await readViewportScale(page)).toBe(1);

  const chipCount = await page.locator('[data-testid="active-arrow-chips"] .sc').count();
  expect(chipCount).toBe(2);
});

test("double-tapping dock buttons does not trigger viewport zoom", async ({ page }) => {
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, emptySetupDb);

  await page.goto("/");
  await page.getByTestId("record-start").click();

  const dock = page.getByTestId("active-action-dock");
  await expect(dock).toBeVisible();
  assertNoZoomTouchAction(await readTouchAction(dock));

  const undoBtn = page.getByTestId("active-undo");
  assertNoZoomTouchAction(await readTouchAction(undoBtn));
  const box = await undoBtn.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.touchscreen.tap(cx, cy);
  await page.waitForTimeout(120);
  await page.touchscreen.tap(cx, cy);
  await page.waitForTimeout(200);

  expect(await readViewportScale(page)).toBe(1);

  const endBtn = page.getByTestId("active-end");
  const endBox = await endBtn.boundingBox();
  const ex = endBox.x + endBox.width / 2;
  const ey = endBox.y + endBox.height / 2;
  await page.touchscreen.tap(ex, ey);
  await page.waitForTimeout(120);
  await page.touchscreen.tap(ex, ey);
  await page.waitForTimeout(200);

  expect(await readViewportScale(page)).toBe(1);
});
