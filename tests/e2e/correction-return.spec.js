const { test, expect } = require("@playwright/test");

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

async function tap(page, locator) {
  await settle(page);
  const box = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      uncovered:
        globalThis.document
          .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
          ?.closest("button") === el,
      nav: globalThis.document.querySelector("#tabs").getBoundingClientRect().top,
    };
  });
  expect(box.uncovered).toBe(true);
  expect(box.y).toBeGreaterThan(0);
  expect(box.y).toBeLessThan(box.nav);
  await page.touchscreen.tap(box.x, box.y);
}

async function revealCorrection(page, locator) {
  // Simulate the user's scroll to secondary controls; never recover the target.
  const delta = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const h = globalThis.document.querySelector("header.app").getBoundingClientRect();
    const d = globalThis.document.querySelector("#activeActionDock").getBoundingClientRect();
    return r.y + r.height / 2 - (Math.max(0, h.bottom) + 12 + d.top - 12) / 2;
  });
  await page.evaluate((d) => globalThis.scrollBy({ top: d, behavior: "instant" }), delta);
  await settle(page);
}

async function targetBounds(page) {
  await settle(page);
  return page.locator("#tgsvg").evaluate((el) => {
    const r = el.getBoundingClientRect();
    const h = globalThis.document.querySelector("header.app").getBoundingClientRect();
    const d = globalThis.document.querySelector("#activeActionDock").getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      top: Math.max(0, h.bottom),
      bottom: d.top,
    };
  });
}

async function recordArrow(page, index) {
  const count = await page.evaluate(
    () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active.cur.length,
  );
  const r = await targetBounds(page);
  const top = Math.max(r.y, r.top + 8),
    bottom = Math.min(r.y + r.height, r.bottom - 8);
  expect(bottom - top).toBeGreaterThan(32);
  await page.touchscreen.tap(r.x + r.width / 2 + ((index % 3) - 1) * 14, (top + bottom) / 2);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active.cur.length,
      ),
    )
    .toBe(count + 1);
}

async function expectTargetVisible(page) {
  const r = await targetBounds(page);
  expect(r.y).toBeGreaterThanOrEqual(r.top + 7);
  expect(r.y + r.height).toBeLessThanOrEqual(r.bottom - 7);
}

for (const size of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
]) {
  for (const motion of ["no-preference", "reduce"]) {
    test(`correction returns to target and next end (${size.width}, ${motion})`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(size);
      await page.emulateMedia({
        reducedMotion: motion,
        colorScheme: size.width === 375 ? "dark" : "light",
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/");
      await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
      await page.locator('#tabs [data-v="record"]').click();
      await page.getByRole("button", { name: "70m", exact: true }).click();
      await page.locator("#fFace").selectOption("122");
      await page.locator("#fArrows").selectOption("6");
      const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")));
      const before = (await state()).sessions;
      await page.getByTestId("record-start").click();
      for (let n = 0; n < 6; n++) {
        await recordArrow(page, n);
        await expect.poll(async () => (await state()).active.cur.length).toBe(n + 1);
      }
      await tap(page, page.locator('#curChips [data-i="0"]'));
      const right = page.locator('#nudge [data-n="r"]');
      await revealCorrection(page, right);
      const original = (await state()).active.cur[0];
      await tap(page, right);
      await expect.poll(async () => (await state()).active.cur[0].x).toBeGreaterThan(original.x);
      await revealCorrection(page, page.locator("#nudgeDone"));
      const corrected = (await state()).active.cur;
      await tap(page, page.locator("#nudgeDone"));
      await page.screenshot({
        path: testInfo.outputPath("correction-return.png"),
        animations: "disabled",
      });
      await expectTargetVisible(page);
      expect((await state()).active.cur).toEqual(corrected);
      await tap(page, page.getByTestId("active-end"));
      await expect.poll(async () => (await state()).active.ends.length).toBe(1);
      expect((await state()).active.ends[0]).toEqual(corrected);
      await expectTargetVisible(page);
      await recordArrow(page, 0);
      await expect.poll(async () => (await state()).active.cur.length).toBe(1);
      // Ongoing correction and metadata updates must not jump back to the target.
      const chip = page.locator('#curChips [data-i="0"]');
      await tap(page, chip);
      await revealCorrection(page, right);
      let scroll = await page.evaluate(() => globalThis.scrollY);
      await tap(page, right);
      expect(
        Math.abs((await page.evaluate(() => globalThis.scrollY)) - scroll),
      ).toBeLessThanOrEqual(1);
      const tag = page.locator("#shotReasonTags .reasonTag").first();
      await revealCorrection(page, tag);
      scroll = await page.evaluate(() => globalThis.scrollY);
      await tap(page, tag);
      expect(
        Math.abs((await page.evaluate(() => globalThis.scrollY)) - scroll),
      ).toBeLessThanOrEqual(1);
      // User scrolls the chip near the top; toggle off without target recovery.
      const move = await chip.evaluate((el) => el.getBoundingClientRect().top - 20);
      await page.evaluate((d) => globalThis.scrollBy({ top: d, behavior: "instant" }), move);
      await tap(page, chip);
      await expect(page.locator("#nudge")).toBeHidden();
      await expectTargetVisible(page);
      // Delete also closes correction and returns to recording.
      await tap(page, chip);
      const remove = page.locator('#nudge [data-n="del"]');
      await revealCorrection(page, remove);
      await tap(page, remove);
      await expect.poll(async () => (await state()).active.cur.length).toBe(0);
      await expectTargetVisible(page);
      // Confirm directly with correction open, without using deselect first.
      await recordArrow(page, 0);
      await tap(page, chip);
      await revealCorrection(page, right);
      const second = (await state()).active.cur;
      await tap(page, page.getByTestId("active-end"));
      await expect.poll(async () => (await state()).active.ends.length).toBe(2);
      expect((await state()).active.ends[1]).toEqual(second);
      await expectTargetVisible(page);
      await recordArrow(page, 0);
      await expect.poll(async () => (await state()).active.cur.length).toBe(1);
      const active = (await state()).active;
      expect((await state()).sessions).toEqual(before);
      // Returning through a tab restores the reading position, not this helper's target position.
      await page.evaluate(() => globalThis.scrollTo({ top: 120, behavior: "instant" }));
      await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(120);
      await page.locator('#tabs [data-v="history"]').click();
      await page.locator('#tabs [data-v="record"]').click();
      await settle(page);
      await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(120);
      expect((await state()).active).toEqual(active);
      await page.reload();
      expect((await state()).active).toEqual(active);
      expect((await state()).sessions).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}
