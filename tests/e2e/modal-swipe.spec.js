const { test, expect } = require("@playwright/test");
async function drag(page, handle, dy, dx = 0) {
  await handle.scrollIntoViewIfNeeded();
  const b = await handle.boundingBox();
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}
test("a sheet swipes closed, short and sideways drags preserve it", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  // v5 段 8: 設定は全画面になり、下へ引く取っ手が無い。ノートの一番下の「ゴミ箱」のシートで確かめる
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator("#notesTrash").focus();
  await page.keyboard.press("Enter");
  const handle = page.locator(".modalSwipeHandle");
  await expect(handle).toBeVisible();
  await drag(page, handle, 25);
  await expect(page.locator(".ovl")).toBeVisible();
  await drag(page, handle, 90, 140);
  await expect(page.locator(".ovl")).toBeVisible();
  await page.locator(".sheet").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const handleBox = await handle.boundingBox();
  const sheetBox = await page.locator(".sheet").boundingBox();
  expect(handleBox.y).toBeGreaterThanOrEqual(sheetBox.y);
  expect(handleBox.y + handleBox.height).toBeLessThanOrEqual(sheetBox.y + 60);
  await drag(page, handle, 110);
  await expect(page.locator(".ovl")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveClass(/modalOpen/);
  await expect(page.locator("#notesTrash")).toBeFocused();
});
test("swiping nested confirmation cancels and leaves the underlying sheet open", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  // v5 段 8: 設定は全画面になり、下へ引く取っ手が無い。ノートの一番下の「ゴミ箱」のシートで確かめる
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator("#notesTrash").click();
  await page.evaluate(() => {
    globalThis.swipeResult = "pending";
    globalThis.eval('appConfirm("架空データの確認")').then((result) => {
      globalThis.swipeResult = result;
    });
  });
  await expect(page.locator(".ovl")).toHaveCount(2);
  await drag(page, page.locator(".confirmSheet .modalSwipeHandle"), 110);
  await expect(page.locator(".ovl")).toHaveCount(1);
  expect(await page.evaluate(() => globalThis.swipeResult)).toBe(false);
  await expect(page.locator("body")).toHaveClass(/modalOpen/);
  await page.locator(".modalSwipeHandle").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".ovl")).toHaveCount(0);
});
test("touch pull closes a sheet; cancelled pull leaves it open", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP touch events require Chromium");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  // v5 段 8: 設定は全画面になり、下へ引く取っ手が無い。ノートの一番下の「ゴミ箱」のシートで確かめる
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator("#notesTrash").click();
  const handle = page.locator(".modalSwipeHandle");
  await handle.scrollIntoViewIfNeeded();
  const b = await handle.boundingBox();
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y + 30 }],
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(page.locator(".ovl")).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (const dy of [20, 50, 90, 110])
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + dy }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator(".ovl")).toHaveCount(0);
});
test("full-screen settings has no swipe handle and closes with the back button", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  await page.locator('#tabs [data-v="record"]').click();
  await page.locator("#btnSettings").click();
  await expect(page.getByTestId("settings-screen")).toBeVisible();
  await expect(page.locator(".modalSwipeHandle")).toHaveCount(0);
  await page.getByTestId("settings-back").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
});
