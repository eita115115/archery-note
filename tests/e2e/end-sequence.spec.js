const { test, expect } = require("@playwright/test");
for (const size of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
]) {
  test(`two complete ends remain reachable (${size.width}x${size.height})`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
    await page.locator('#tabs [data-v="history"]').click();
    await page.locator('#tabs [data-v="record"]').click();
    await page.locator("#quickStart").click();
    await page.evaluate(() =>
      Promise.all(globalThis.document.getAnimations().map((a) => a.finished.catch(() => {}))),
    );
    const state = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")).active);
    for (let end = 0; end < 2; end++) {
      for (let arrow = 0; arrow < 3; arrow++) {
        const target = await page.locator("#tgWrap").boundingBox();
        const dock = await page.getByTestId("active-action-dock").boundingBox();
        const top = Math.max(target.y, 0),
          bottom = Math.min(target.y + target.height, dock.y);
        expect(bottom - top).toBeGreaterThan(16);
        await page.mouse.click(target.x + target.width / 2, (top + bottom) / 2);
        await expect.poll(async () => (await state()).cur.length).toBe(arrow + 1);
      }
      const action = await page.getByTestId("active-end").boundingBox();
      expect(action.y).toBeGreaterThan(0);
      expect(action.y + action.height).toBeLessThan(size.height - 64);
      await page.mouse.click(action.x + action.width / 2, action.y + action.height / 2);
      await expect.poll(async () => (await state()).ends.length).toBe(end + 1);
      expect((await state()).ends[end]).toHaveLength(3);
    }
    expect((await state()).cur).toHaveLength(0);
  });
}
