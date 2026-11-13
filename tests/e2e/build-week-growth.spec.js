const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

/* v5 段 7: 「練習のまとめ」（信頼度つきの枠）と「次回試すこと」は廃止。デモデータは 分析 > スコア を開く */
test("demo data opens the score analysis with its target stated and remains removable", async ({
  page,
}) => {
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  await expect(page.locator("#analysisSubTabs [data-an='score']")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByTestId("analysis-score")).toBeVisible();
  await expect(page.getByTestId("analysis-target")).toContainText("対象: ");
  await expect(page.getByTestId("growth-dashboard")).toHaveCount(0);
  await expect(page.getByTestId("next-practice")).toHaveCount(0);
  await expect(page.locator("#main")).not.toContainText("次回試すこと");
  await expect(page.locator("#anPeriod option[value='7d']")).toHaveCount(1);
  const demoCount = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("archeryNote.v1")).sessions.filter((s) =>
        s.id.startsWith("build-week-demo:"),
      ).length,
  );
  expect(demoCount).toBe(3);

  // v5: デモデータは分析の画面で開く。設定の入口は記録タブの見出し行だけにある
  await page.locator('#tabs [data-v="record"]').click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByTestId("settings-demo-remove").click();
  await page.getByRole("button", { name: "消す", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("archeryNote.v1")).sessions.filter((s) =>
            s.id.startsWith("build-week-demo:"),
          ).length,
      ),
    )
    .toBe(0);
});

test("demo analysis works at narrow mobile width and in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  await expect(page.getByTestId("analysis-score")).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  expect(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  ).toBe(true);
});
