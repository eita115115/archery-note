const { test, expect } = require("@playwright/test");
/* 待機画面の帯は前回の条件を示し、「記録を始める」はその条件で始める。
   記録の条件で変えた内容は「この条件で記録を始める」だけが使う（帯の表示は変わらない）。 */
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
      await expect(page.getByTestId("home-start-band").locator(".l")).toHaveText("前回と同じ条件");
      await expect(page.locator("#quickStartMeta")).toHaveText("18m・40cm的");
      await page.getByTestId("record-conditions").click();
      // 記録の条件は前回の条件から始まる
      await expect(page.locator('#fDistChips [data-d="18"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.locator("#fFace")).toHaveValue("40");
      await expect(page.locator("#fArrows")).toHaveValue("3");
      await page.locator('#fDistChips [data-d="70"]').click();
      await page.locator("#fFace").selectOption("80");
      if (action === "repeat") {
        // 戻ると帯は前回の条件のまま。変えかけた条件は使われない
        await page.getByTestId("conditions-back").click();
        await expect(page.locator("#quickStartMeta")).toHaveText("18m・40cm的");
        await expect(page.locator("#quickStart")).not.toContainText("70m");
        await page.locator("#quickStart").click();
      } else {
        await page.locator("#fStart").click();
      }
      const active = await page.evaluate(
        () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active,
      );
      expect(active.dist).toBe(action === "repeat" ? 18 : 70);
      expect(active.faceD).toBe(action === "repeat" ? 40 : 80);
      expect(active.perEnd).toBe(3);
      await expect(page.getByTestId("active-target")).toBeVisible();
      await expect(page.locator(".recTop .condT")).toContainText(
        action === "repeat" ? "18m" : "70m",
      );
    });
  }
