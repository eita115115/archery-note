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
    await page.locator("#tabs").getByRole("button", { name: "履歴", exact: true }).click();
    const filters = page.getByTestId("history-filters");
    await expect(filters).not.toHaveAttribute("open", "");
    await expect(page.locator("#histList .listItem")).toHaveCount(3);
    const first = await page.locator("#histList .listItem").first().boundingBox();
    expect(first.y + first.height).toBeLessThan(600);
    await page.getByTestId("history-filter-toggle").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("距離", { exact: true })).toBeVisible();
    await page.getByLabel("距離", { exact: true }).selectOption("70");
    await expect(filters).toHaveAttribute("open", "");
    await expect(page.getByTestId("history-filter-toggle")).toContainText("1条件");
    await expect(page.getByLabel("距離", { exact: true })).toBeFocused();
    await expect(page.locator("#histList .listItem")).toHaveCount(1);
    await page.getByRole("button", { name: "絞り込み解除" }).click();
    await expect(page.getByTestId("history-filter-toggle")).toContainText("すべて");
    await expect(page.getByTestId("history-filter-toggle")).toBeFocused();
    await expect(page.locator("#histList .listItem")).toHaveCount(3);
    const overflow = await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
    );
    expect(overflow).toBe(false);
    await page.locator("#histList .listItem").first().click();
    await expect(page.locator("#hClose")).toBeVisible();
  });
}
