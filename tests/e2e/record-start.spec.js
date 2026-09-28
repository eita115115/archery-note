const { test, expect } = require("@playwright/test");
for (const theme of ["light", "dark"])
  for (const action of ["repeat", "current"]) {
    test(`record start labels match the started conditions (${theme}, ${action})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/");
      await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
      await page.locator('#tabs [data-v="record"]').click();
      await expect(page.locator("#quickStartMeta")).toHaveText("18m / 40cm");
      await page.locator('#fDistChips [data-d="70"]').click();
      await page.locator("#fFace").selectOption("80");
      await expect(page.locator("#quickStartMeta")).toHaveText("18m / 40cm");
      await expect(page.locator("#quickStart")).not.toContainText("70m");
      await page.locator(action === "repeat" ? "#quickStart" : "#fStart").click();
      const active = await page.evaluate(
        () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active,
      );
      expect(active.dist).toBe(action === "repeat" ? 18 : 70);
      expect(active.faceD).toBe(action === "repeat" ? 40 : 80);
      await expect(page.getByTestId("active-target")).toBeVisible();
    });
  }
