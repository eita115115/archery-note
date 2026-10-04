/* global db, save, render, scoreAt, lineCutRadius */
const { test, expect } = require("@playwright/test");
const { pullSheetHandle } = require("./native-touch");
test.use({ hasTouch: true, isMobile: true });
for (const width of [320, 375]) {
  test(`a controlled sheet pull allows the first next touch to finish (${width})`, async ({
    page,
    context,
    browserName,
  }, testInfo) => {
    test.skip(browserName !== "chromium", "CDP native touch generation requires Chromium");
    await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
    await page.locator('#tabs [data-v="record"]').click();
    await page.getByRole("button", { name: "18m", exact: true }).click();
    await page.getByRole("combobox", { name: "的", exact: true }).selectOption("40");
    await page.getByRole("combobox", { name: "1エンドの本数", exact: true }).selectOption("6");
    await page.getByTestId("record-start").click();
    // Synthetic coordinates use the same scoring radius as displayed marks.
    await page.evaluate(() => {
      const s = db.active,
        arrow = (x, y) => ({
          x,
          y,
          ...scoreAt(x, y, s.faceD, s.faceType, lineCutRadius(s.faceD, s.faceType)),
        });
      s.ends = [
        [
          [1, 0],
          [-2, 1],
          [3, -1],
          [4, 2],
          [-5, -2],
          [6, 3],
        ].map(([x, y]) => arrow(x, y)),
      ];
      s.cur = [arrow(0, 1)];
      db.settings.activeGuideSeen = true;
      save({ reason: "owned-followup-fixture" });
      render();
    });
    const before = await page.evaluate(() => ({ sessions: db.sessions, active: db.active }));
    await page.locator("#btnSettings").click();
    await expect(page.locator(".ovl")).toHaveCount(1);
    await pullSheetHandle(page, context);
    await expect(page.locator(".ovl")).toHaveCount(0);
    // Exactly one touchscreen tap. No keyboard, mouse click, or retry follows the pull.
    const button = page.getByTestId("active-finish"),
      box = await button.boundingBox();
    expect(box).not.toBeNull();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.screenshot({
      path: testInfo.outputPath(`swipe-followup-${width}.png`),
      animations: "disabled",
    });
    await expect(page.locator(".ovl .statbar")).toContainText("合計 (7本)");
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active),
      )
      .toBeNull();
    const after = await page.evaluate(() =>
      JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")),
    );
    expect(after.sessions.filter((s) => s.id !== before.active.id)).toEqual(before.sessions);
    expect(after.sessions.find((s) => s.id === before.active.id).ends.flat()).toEqual([
      ...before.active.ends.flat(),
      ...before.active.cur,
    ]);
    const handleBox = await page.locator(".modalSwipeHandle").boundingBox();
    await page.touchscreen.tap(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2,
    );
    await expect(page.locator(".ovl")).toHaveCount(0);
    await page.reload();
    expect(await page.evaluate(() => db.sessions)).toEqual(after.sessions);
    expect(errors).toEqual([]);
  });
}
