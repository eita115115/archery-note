const { test, expect } = require("@playwright/test");
const fs = require("node:fs");

test.use({ hasTouch: true, isMobile: true, serviceWorkers: "block" });

async function settle(page) {
  await page.evaluate(() =>
    Promise.all(
      globalThis.document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect.getTiming().iterations))
        .map((a) => a.finished.catch(() => {})),
    ),
  );
}

for (const size of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
]) {
  for (const motion of ["no-preference", "reduce"]) {
    for (const entry of ["current", "repeat", "onboarding"]) {
      test(`first target is usable without recovery scroll (${size.width}, ${motion}, ${entry})`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize(size);
        await page.emulateMedia({ reducedMotion: motion, colorScheme: "light" });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto("/");
        if (entry === "onboarding") {
          await page.locator("#obStart").click();
          await page.locator('#obDistChips [data-d="18"]').click();
        } else {
          await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
          await page.locator('#tabs [data-v="record"]').click();
        }
        const state = () =>
          page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
        const before = (await state())?.sessions || [];
        const start = page.locator(
          entry === "onboarding" ? "#obGo" : entry === "repeat" ? "#quickStart" : "#fStart",
        );
        // Only reveal the pre-start button. Do not scroll the resulting target into view.
        await start.scrollIntoViewIfNeeded();
        await settle(page);
        await page.evaluate(() => {
          globalThis.__startTrace = [];
          for (const capture of [true, false]) {
            globalThis.document.addEventListener(
              "click",
              (e) => {
                if (!["fStart", "quickStart", "obGo"].includes(e.target.closest("button")?.id))
                  return;
                const r = globalThis.document.querySelector("#tgsvg")?.getBoundingClientRect();
                globalThis.__startTrace.push({
                  capture,
                  trusted: e.isTrusted,
                  scrollY: globalThis.scrollY,
                  target: r?.toJSON(),
                });
              },
              capture,
            );
          }
        });
        const button = await start.boundingBox();
        expect(button).not.toBeNull();
        await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2);
        await expect(page.locator("#tgsvg")).toBeAttached();
        await settle(page);
        const geometry = await page.locator("#tgsvg").evaluate((el) => {
          const r = el.getBoundingClientRect();
          const header = globalThis.document.querySelector("header.app").getBoundingClientRect();
          const dock = globalThis.document
            .querySelector("#activeActionDock")
            .getBoundingClientRect();
          return {
            rect: r.toJSON(),
            top: Math.max(0, header.bottom),
            bottom: dock.top,
            scrollY: globalThis.scrollY,
            centerUncovered: el.contains(
              globalThis.document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            ),
            trace: globalThis.__startTrace,
          };
        });
        await page.screenshot({ path: testInfo.outputPath("first-target.png") });
        fs.writeFileSync(testInfo.outputPath("geometry.json"), JSON.stringify(geometry, null, 2));
        await testInfo.attach("start-geometry", {
          body: JSON.stringify(geometry, null, 2),
          contentType: "application/json",
        });
        expect(geometry.rect.y).toBeGreaterThanOrEqual(geometry.top + 7);
        expect(geometry.rect.bottom).toBeLessThanOrEqual(geometry.bottom - 7);
        expect(geometry.centerUncovered).toBe(true);
        await page.touchscreen.tap(
          geometry.rect.x + geometry.rect.width / 2,
          geometry.rect.y + geometry.rect.height / 2,
        );
        await expect.poll(async () => (await state()).active.cur.length).toBe(1);
        expect((await state()).sessions).toEqual(before);
        const active = (await state()).active;
        await page.reload();
        await expect(page.locator("#tgsvg")).toBeAttached();
        expect((await state()).active).toEqual(active);
        expect((await state()).sessions).toEqual(before);
        expect(errors).toEqual([]);
      });
    }
  }
}
