const { test, expect } = require("@playwright/test");

async function settle(page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const animations = globalThis.document
          .getAnimations()
          .filter((a) => Number.isFinite(a.effect.getTiming().iterations));
        for (const a of animations) a.effect.target?.getBoundingClientRect();
        return animations.every((a) => a.playState === "finished" || a.playState === "idle");
      }),
    )
    .toBe(true);
}

for (const sample of [
  { width: 320, height: 568, face: "F40", faceType: "field", faceD: 40, perEnd: 4 },
  { width: 375, height: 812, face: "T40", faceType: "triple", faceD: 40, perEnd: 3 },
  { width: 900, height: 900, face: "80", faceType: "single", faceD: 80, perEnd: 12 },
]) {
  test.describe(`named record controls ${sample.width}`, () => {
    test.use({ serviceWorkers: "block", isMobile: sample.width < 600, hasTouch: true });
    test("starts with the visible named conditions and preserves records", async ({
      page,
    }, testInfo) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width: sample.width, height: sample.height });
      await page.emulateMedia({
        colorScheme: sample.width === 375 ? "dark" : "light",
        reducedMotion: "reduce",
      });
      await page.goto("/");
      await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
      await page.locator('#tabs [data-v="record"]').click();
      await page.getByRole("button", { name: "70m", exact: true }).click();
      await settle(page);
      await page.screenshot({ path: testInfo.outputPath(`record-labels-${sample.width}.png`) });
      const face = page.getByRole("combobox", { name: "的", exact: true });
      const arrows = page.getByRole("combobox", { name: "1エンドの本数", exact: true });
      await expect(face).toHaveCount(1);
      await expect(arrows).toHaveCount(1);
      await expect(page.getByLabel("的", { exact: true })).toHaveAttribute("id", "fFace");
      await expect(page.getByLabel("1エンドの本数", { exact: true })).toHaveAttribute(
        "id",
        "fArrows",
      );
      const before = await page.evaluate(
        () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).sessions,
      );

      await page.getByRole("button", { name: "カスタム", exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(face).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(arrows).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(face).toBeFocused();

      await face.selectOption(sample.face);
      await arrows.selectOption(String(sample.perEnd));
      await expect(face).toHaveValue(sample.face);
      await expect(arrows).toHaveValue(String(sample.perEnd));
      const chosenFace = await face.locator("option:checked").textContent();
      const chosenArrows = await arrows.locator("option:checked").textContent();
      expect(chosenFace).toContain(String(sample.faceD));
      expect(chosenArrows).toBe(`${sample.perEnd}本`);
      await arrows.focus();
      await page.keyboard.press("Tab");
      await expect(page.getByTestId("record-start")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("active-target")).toBeVisible();
      const state = () =>
        page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
      const active = (await state()).active;
      expect(active).toMatchObject({
        dist: 70,
        faceD: sample.faceD,
        faceType: sample.faceType,
        perEnd: sample.perEnd,
      });
      expect((await state()).sessions).toEqual(before);
      await page.reload();
      await expect(page.getByTestId("active-target")).toBeVisible();
      expect((await state()).active).toEqual(active);
      expect((await state()).sessions).toEqual(before);
      expect(errors).toEqual([]);
    });
  });
}
