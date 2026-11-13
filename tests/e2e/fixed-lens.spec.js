/* global db */
"use strict";

const { test, expect } = require("@playwright/test");

/* ルーペ（拡大鏡）はヘッダー直下に画面固定し、指の位置で動かさない（docs/design/ui-redesign-plan.md）。
   短いタップでは出さずに即記録し、長押しで精密モードにする */
const database = {
  schema: 5,
  setups: [],
  sightMarks: [],
  sessions: [],
  trash: [],
  formAnalyses: [],
  customRounds: [],
  settings: {
    eyeSight: 850,
    theme: "dark",
    onboardingSeen: true,
    activeGuideSeen: true,
    launchCount: 3,
  },
  active: null,
};

async function startRecording(page, settings = {}) {
  await page.addInitScript(
    (db) => globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(db)),
    { ...database, settings: { ...database.settings, ...settings } },
  );
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await page.getByTestId("record-start").click();
  await expect(page.locator("#tgsvg")).toBeVisible();
  return page.locator("#tgsvg").boundingBox();
}

async function longPressBox(page, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(page.locator("#lens")).toHaveClass(/fine/);
  const box = await page.locator("#lens").boundingBox();
  await page.mouse.up();
  return box;
}

for (const width of [320, 375]) {
  test(`lens stays fixed above the target regardless of the finger side (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 760 });
    const target = await startRecording(page);
    const cx = target.x + target.width / 2;
    const cy = target.y + target.height / 2;

    // 短いタップ: ルーペは出ずに1本記録される
    await page.mouse.click(cx, cy);
    await expect.poll(() => page.evaluate(() => db.active.cur.length)).toBe(1);
    await expect(page.locator("#lens")).toBeHidden();

    // 長押し: 的の右側でも左側でも、ルーペは同じ位置に出る
    const right = await longPressBox(page, cx + target.width * 0.3, cy);
    const left = await longPressBox(page, cx - target.width * 0.3, cy);
    expect(right).toEqual(left);
    await expect.poll(() => page.evaluate(() => db.active.cur.length)).toBe(3);
    await expect(page.locator("#lens")).toBeHidden();

    // 既定は右上。v5 でヘッダー帯が無くなったので画面の上端に収まり、的とは重ならない
    expect(right.x + right.width).toBeGreaterThan(width - 20);
    expect(right.y).toBeGreaterThanOrEqual(0);
    await expect(page.locator("header.app")).toHaveCount(0);
    // v5: 的は幅いっぱい。拡大鏡は的の枠の右上の角に少し掛かることがあるが、的面（円）には重ならない
    const svg = await page.locator("#tgsvg").boundingBox();
    const faceR = svg.width / 2 / 1.035;
    const corner = Math.hypot(
      right.x - (svg.x + svg.width / 2),
      right.y + right.height - (svg.y + svg.height / 2),
    );
    expect(corner).toBeGreaterThan(faceR);
    expect(right.y + right.height).toBeLessThanOrEqual(svg.y + 24);
  });
}

test("lens side setting moves the fixed lens to the left", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  const target = await startRecording(page, { lensSide: "left" });
  const box = await longPressBox(page, target.x + target.width * 0.2, target.y + target.height / 2);
  expect(box.x).toBeLessThan(20);
});
