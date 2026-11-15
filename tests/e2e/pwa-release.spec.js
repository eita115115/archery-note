const { test, expect } = require("@playwright/test");

test("cached app starts a practice offline and retains it across reload", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const sessions = await page.evaluate(
    () => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions,
  );
  await context.setOffline(true);
  await page.reload();
  await page.locator('#tabs [data-v="record"]').click();
  await page.locator("#quickStart").click();
  await expect(page.getByTestId("active-target")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")));
  expect(saved.sessions).toEqual(sessions);
  expect(saved.active).toBeTruthy();
  await page.reload();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")));
  expect(restored.sessions).toEqual(sessions);
  expect(restored.active).toEqual(saved.active);
});

test("newer version banner reload preserves demo records", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  try {
    await page.route("**/version.json?*", async (route) => {
      /* 更新の帯を押すとページが読み直され、読み直しの途中の version.json の応答は捨てられる。
         そのときは偽の版を返す必要が無いので、その要求はそのまま通す（帯の表示と記録の保持は下で確かめる） */
      let version;
      try {
        const response = await route.fetch();
        version = await response.json();
      } catch {
        await route.continue().catch(() => {});
        return;
      }
      await route.fulfill({ json: { ...version, v: version.v + 1 } }).catch(() => {});
    });
    await page.goto(baseURL);
    await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
    const sessions = await page.evaluate(
      () => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions,
    );
    await expect(page.locator("#updBar")).toBeVisible();
    await page.locator("#updBar").click();
    await page.waitForURL(/appv=/);
    await expect(page.locator("#tabs")).toBeVisible();
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions),
    ).toEqual(sessions);
  } finally {
    await context.close();
  }
});
