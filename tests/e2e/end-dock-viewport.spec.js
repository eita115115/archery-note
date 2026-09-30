const { test, expect } = require("@playwright/test");
test("end action stays in viewport after tab animation and scoring", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 640 });
  await page.goto("/");
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator('#tabs [data-v="record"]').click();
  await page.locator("#quickStart").click();
  await page.evaluate(() =>
    Promise.all(globalThis.document.getAnimations().map((a) => a.finished.catch(() => {}))),
  );
  const end = page.getByTestId("active-end");
  const box = await end.boundingBox();
  expect(box.y).toBeGreaterThan(0);
  expect(box.y + box.height).toBeLessThan(640 - 64);
  const target = await page.locator("#tgWrap").boundingBox();
  await page.mouse.click(
    target.x + target.width / 2,
    Math.min(target.y + target.height / 2, box.y - 30),
  );
  const current = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")).active);
  await expect.poll(async () => (await current()).cur.length).toBe(1);
  const afterArrow = await end.boundingBox();
  expect(afterArrow.y + afterArrow.height).toBeLessThan(576);
  // Use screen coordinates: locator.click could conceal the regression by auto-scrolling.
  await page.mouse.click(afterArrow.x + afterArrow.width / 2, afterArrow.y + afterArrow.height / 2);
  await expect.poll(async () => (await current()).ends.length).toBe(1);
  expect((await current()).cur.length).toBe(0);
  await page.evaluate(() => globalThis.scrollTo(0, 200));
  const moved = await end.boundingBox();
  expect(Math.abs(moved.y - box.y)).toBeLessThan(2);
});

test("page gestures retain scrolling without pinch zoom", async ({ page }) => {
  await page.goto("/");
  for (const selector of ["html", "body"]) {
    const action = await page
      .locator(selector)
      .evaluate((el) => globalThis.getComputedStyle(el).touchAction);
    expect(action).toBe("pan-x pan-y");
  }
});
