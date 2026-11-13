const { test, expect } = require("@playwright/test");
for (const theme of ["light", "dark"]) {
  test(`history prioritizes records and retains accessible filters (${theme})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
    await page.evaluate(() => {
      const data = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
      data.sessions[0].dist = 70;
      data.sessions[0].faceD = 122;
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(data));
    });
    await page.reload();
    await page.locator("#tabs").getByRole("button", { name: "ノート", exact: true }).click();
    // v5 段 6: 距離は一覧の上の切り替え、弓具とラウンドはたたんだ欄。冒頭の文と数値枠は無い
    await expect(page.getByTestId("history-hero")).toHaveCount(0);
    const filters = page.getByTestId("history-filters");
    await expect(filters).not.toHaveAttribute("open", "");
    await expect(page.locator("#histList .historyRow")).toHaveCount(3);
    const first = await page.locator("#histList .historyRow").first().boundingBox();
    expect(first.y + first.height).toBeLessThan(600);
    await expect(page.getByLabel("距離", { exact: true })).toBeVisible();
    await page.getByLabel("距離", { exact: true }).selectOption("70");
    await expect(page.getByLabel("距離", { exact: true })).toBeFocused();
    await expect(page.locator("#histList .historyRow")).toHaveCount(1);
    await page.getByTestId("history-filter-toggle").focus();
    await page.keyboard.press("Enter");
    await expect(filters).toHaveAttribute("open", "");
    await expect(page.locator("#histSetup")).toBeVisible();
    await page.locator("#histSetup").selectOption("__none");
    await expect(page.getByTestId("history-filter-toggle")).toContainText("1条件");
    await expect(page.locator("#histSetup")).toBeFocused();
    await page.getByRole("button", { name: "絞り込みを解除" }).click();
    await expect(page.getByTestId("history-filter-toggle")).toContainText("すべて");
    await expect(page.getByTestId("history-filter-toggle")).toBeFocused();
    await expect(page.getByLabel("距離", { exact: true })).toHaveValue("");
    await expect(page.locator("#histList .historyRow")).toHaveCount(3);
    const overflow = await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
    );
    expect(overflow).toBe(false);
    await page.locator("#histList .historyRow").first().click();
    await expect(page.locator("#hClose")).toBeVisible();
  });
}

test("notes name each record with its date and show an empty practice without NaN", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("archeryNote.v1"));
    data.sessions[0].id = "owned-empty-history";
    data.sessions[0].date = "2026-10-12";
    data.sessions[0].ends = [];
    localStorage.setItem("archeryNote.v1", JSON.stringify(data));
  });
  await page.reload();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions,
  );
  await page.locator('#tabs [data-v="history"]').click();
  const row = page.locator('.historyRow[data-id="owned-empty-history"]');
  await expect(row).toHaveAccessibleName(/2026\/10\/12/);
  await expect(row).toContainText("0射");
  await expect(row.locator(".sc1")).toHaveText("0点");
  await expect(row).not.toContainText("NaN");
  await row.click();
  await expect(page.locator("#hClose")).toBeVisible();
  // 詳細の 1射平均は、射数が 0 のとき「—」
  await expect(page.getByTestId("history-detail-stats")).toContainText("0射・1射平均 —");
  await expect(page.locator(".histDetailSheet")).not.toContainText("NaN");
  await page.locator("#hClose").click();
  await page.reload();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions),
  ).toEqual(before);
});
