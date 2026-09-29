const { test, expect } = require("@playwright/test");
for (const width of [360, 375])
  for (const theme of ["light", "dark"]) {
    test(`secondary touch controls remain usable (${width}, ${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/");
      await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
      await page.locator('#tabs [data-v="record"]').click();
      for (const selector of ["#btnSettings", "#jumpGear", ".recordDetails summary"]) {
        const rect = await page.locator(selector).boundingBox();
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
      }
      await page.locator(".recordDetails summary").click({ position: { x: 3, y: 3 } });
      await expect(page.locator(".recordDetails")).toHaveAttribute("open", "");
      await page.locator("#quickStart").click();
      const cells = await page
        .locator(".liveGrid3 .liveCell")
        .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
      expect(Math.max(...cells) - Math.min(...cells)).toBeLessThan(1);
      const more = page.locator(".liveHudMore summary");
      const rect = await more.boundingBox();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
      await more.click({ position: { x: 3, y: 3 } });
      await expect(page.locator(".liveHudMore")).toHaveAttribute("open", "");
      expect(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        ),
      ).toBe(false);
      await page.locator("#btnSettings").click({ position: { x: 3, y: 3 } });
      await expect(page.locator(".ovl")).toBeVisible();
    });
  }
