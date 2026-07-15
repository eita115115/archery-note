const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("demo data opens an explainable growth dashboard and remains removable", async ({ page }) => {
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  await expect(page.getByTestId("growth-dashboard")).toBeVisible();
  await expect(page.getByTestId("next-practice")).toContainText("次回試すこと");
  await expect(page.locator("[data-period='7d']")).toBeVisible();
  const demoCount = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("archeryNote.v1")).sessions.filter((s) =>
        s.id.startsWith("build-week-demo:"),
      ).length,
  );
  expect(demoCount).toBe(3);

  await page.getByRole("button", { name: "設定" }).click();
  await page.getByTestId("settings-demo-remove").click();
  await page.getByRole("button", { name: "削除する" }).click();
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

test("growth dashboard works at narrow mobile width and in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  await expect(page.getByTestId("growth-dashboard")).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
