const { test, expect } = require("@playwright/test");

for (const size of [
  { width: 320, height: 568, theme: "light" },
  { width: 375, height: 812, theme: "dark" },
  { width: 900, height: 900, theme: "light" },
]) {
  test.describe(`result storage notice ${size.width}`, () => {
    test.use({ hasTouch: true, isMobile: size.width < 600, serviceWorkers: "block" });
    test("keeps capacity guidance in the result and opens backup settings", async ({
      page,
    }, info) => {
      const errors = [],
        downloads = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("download", (d) => downloads.push(d.suggestedFilename()));
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: size.theme, reducedMotion: "reduce" });
      await page.goto("/");
      await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
      await page.locator('#tabs [data-v="record"]').click();
      const state = () =>
        page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
      const before = (await state()).sessions;
      for (const ratio of [0.799, 0.8]) {
        // Stub only the capacity measurement; exercise real recording, save and summary.
        await page.evaluate((r) => {
          globalThis.storageUsageRatio = () => ({
            ratio: r,
            mb: r * 5,
            capMb: 5,
            percent: Math.round(r * 100),
          });
        }, ratio);
        await page.locator("#quickStart").click();
        await page.evaluate(
          () =>
            new Promise((r) =>
              globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(r)),
            ),
        );
        const target = await page.locator("#tgsvg").boundingBox();
        await page.touchscreen.tap(target.x + target.width / 2, target.y + target.height / 2);
        await page.waitForFunction(() => !globalThis.hasPendingSave());
        const arrows = (await state()).active.cur;
        expect(arrows).toHaveLength(1);
        await page.getByTestId("active-finish").click();
        await page.locator("#sumClose").waitFor();
        const notice = page.getByTestId("summary-storage-notice");
        if (ratio < 0.8) await expect(notice).toHaveCount(0);
        else {
          await expect(notice).toBeVisible();
          await expect(notice).toContainText("容量が残り少なくなっています");
          await expect(page.locator("#toast")).not.toContainText("容量");
          const geometry = await notice.evaluate((el) => {
            const r = el.getBoundingClientRect(),
              stat = el.parentElement.querySelector(".statbar").getBoundingClientRect();
            const next = el.parentElement
              .querySelector(".summaryTodaysResult")
              .getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              statBottom: stat.bottom,
              nextTop: next.top,
              width: globalThis.innerWidth,
            };
          });
          expect(geometry.left).toBeGreaterThanOrEqual(0);
          expect(geometry.right).toBeLessThanOrEqual(geometry.width);
          expect(geometry.top).toBeGreaterThanOrEqual(geometry.statBottom);
          expect(geometry.bottom).toBeLessThanOrEqual(geometry.nextTop);
          await page.screenshot({ path: info.outputPath("capacity-result.png") });
          // The persistent message survives the old five-second toast lifetime.
          await page.waitForTimeout(5100);
          await expect(notice).toBeVisible();
          const backup = page.getByRole("button", { name: "バックアップ設定を開く", exact: true });
          await backup.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByTestId("settings-export")).toBeInViewport();
          await expect(page.locator(".ovl")).toHaveCount(2);
          await page.locator("#setClose").click();
          await expect(page.locator(".ovl")).toHaveCount(1);
          await expect(backup).toBeFocused();
          await expect(notice).toBeVisible();
          expect(downloads).toEqual([]);
        }
        const saved = await state();
        expect(saved.sessions.slice(0, before.length)).toEqual(before);
        expect(saved.sessions.at(-1).ends[0]).toEqual(arrows);
        expect(saved.active).toBeNull();
        await page.locator("#sumClose").click();
      }
      const saved = (await state()).sessions;
      expect(saved).toHaveLength(before.length + 2);
      await page.reload();
      expect((await state()).sessions).toEqual(saved);
      expect(errors).toEqual([]);
    });
  });
}
