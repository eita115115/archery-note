const { test, expect } = require("@playwright/test");

async function settled(page) {
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

async function state(page) {
  return page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
}

async function tap(page, locator) {
  await settled(page);
  const box = await locator.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const x = r.x + r.width / 2,
      y = r.y + r.height / 2;
    return { x, y, hit: globalThis.document.elementFromPoint(x, y)?.closest("button") === e };
  });
  expect(box.hit).toBe(true);
  await page.touchscreen.tap(box.x, box.y);
}

async function arrow(page, index) {
  const count = (await state(page)).active.cur.length;
  await settled(page);
  const box = await page.getByTestId("active-target").boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2 + index * 2, box.y + box.height / 2);
  await expect.poll(async () => (await state(page)).active.cur.length).toBe(count + 1);
}

async function readableToast(page, active) {
  const toast = page.getByRole("status");
  await expect(toast).toHaveClass(/show/);
  await expect(toast).toHaveAttribute("aria-live", "polite");
  await expect(toast).toHaveAttribute("aria-atomic", "true");
  await settled(page);
  const box = await toast.evaluate((e) => {
    const t = e.getBoundingClientRect();
    const dock = globalThis.document.querySelector("#activeActionDock")?.getBoundingClientRect();
    return {
      left: t.left,
      right: t.right,
      top: t.top,
      bottom: t.bottom,
      width: globalThis.innerWidth,
      height: globalThis.innerHeight,
      dockTop: dock?.top,
      opacity: Number(globalThis.getComputedStyle(e).opacity),
      foreground: globalThis.getComputedStyle(e).color,
      background: globalThis.getComputedStyle(e).backgroundColor,
      bottomInset: globalThis.innerHeight - t.bottom,
    };
  });
  expect(box.opacity).toBeGreaterThan(0.9);
  const luminance = (color) => {
    const channels = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((n) => {
        const c = n / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const fg = luminance(box.foreground),
    bg = luminance(box.background);
  expect((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)).toBeGreaterThanOrEqual(4.5);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.width);
  expect(box.top).toBeGreaterThanOrEqual(0);
  if (active) expect(box.bottom).toBeLessThanOrEqual(box.dockTop - 15);
  else expect(box.bottomInset).toBeCloseTo(92, 0);
}

for (const size of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 900, height: 900 },
]) {
  test.describe(`notification clearance ${size.width}`, () => {
    test.use({ isMobile: size.width < 600, hasTouch: true, serviceWorkers: "block" });
    for (const motion of ["no-preference", "reduce"]) {
      test(`record feedback leaves actions readable (${motion})`, async ({ page }, testInfo) => {
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.setViewportSize(size);
        await page.emulateMedia({
          reducedMotion: motion,
          colorScheme: size.width === 375 ? "dark" : "light",
        });
        await page.goto("/");
        await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
        await page.locator('#tabs [data-v="record"]').click();
        await page.getByRole("button", { name: "70m", exact: true }).click();
        await page.locator("#fFace").selectOption("122");
        await page.locator("#fArrows").selectOption("6");
        const before = (await state(page)).sessions;
        await page.getByTestId("record-start").click();
        await arrow(page, 0);
        await expect(page.getByRole("status")).toContainText("点を記録");
        // Hold the real feedback through the slower screenshot/overlay checks.
        const message = await page.getByRole("status").textContent();
        await page.evaluate((text) => globalThis.toast(text, 10000), message);
        await settled(page);
        await page.screenshot({ path: testInfo.outputPath("record-toast.png") });
        await readableToast(page, true);
        for (let n = 1; n < 6; n++) await arrow(page, n);
        const six = (await state(page)).active.cur;
        // A seventh tap emits the genuine multi-line end-capacity instruction.
        const target = await page.getByTestId("active-target").boundingBox();
        await page.touchscreen.tap(target.x + target.width / 2, target.y + target.height / 2);
        await expect(page.getByRole("status")).toContainText("エンド確定");
        await readableToast(page, true);
        await page.screenshot({ path: testInfo.outputPath("record-toast-capacity.png") });
        expect((await state(page)).active.cur).toEqual(six);
        await tap(page, page.getByTestId("active-end"));
        await expect(page.getByRole("status")).toHaveText("エンド1 確定");
        await readableToast(page, true);
        expect((await state(page)).active.ends[0]).toEqual(six);
        await arrow(page, 0);
        await tap(page, page.getByTestId("active-undo"));
        await expect.poll(async () => (await state(page)).active.cur.length).toBe(0);

        await page.locator("#btnSettings").click();
        await page.evaluate(() => globalThis.toast("設定の通知を確認", 10000));
        await readableToast(page, false);
        await page.getByRole("button", { name: "閉じる（下にスワイプ）", exact: true }).click();
        await readableToast(page, true);
        await page.locator('#tabs [data-v="history"]').click();
        await page.evaluate(() => globalThis.toast("履歴の通知を確認", 10000));
        await readableToast(page, false);
        await page.locator('#tabs [data-v="record"]').click();
        await expect(page.getByRole("status")).toHaveText("履歴の通知を確認");
        await readableToast(page, true);
        await page.setViewportSize({ width: size.width === 320 ? 375 : 320, height: 700 });
        await readableToast(page, true);
        await tap(page, page.getByTestId("active-finish"));
        await expect(page.locator("#sumClose")).toBeVisible();
        await page.evaluate(() => globalThis.toast("結果の通知を確認", 10000));
        await readableToast(page, false);
        const saved = await state(page);
        expect(saved.sessions.slice(0, before.length)).toEqual(before);
        expect(saved.sessions.at(-1).ends[0]).toEqual(six);
        expect(saved.active).toBeNull();
        await page.evaluate(() => globalThis.toast("短い通知"));
        await expect(page.getByRole("status")).toHaveClass(/show/);
        await expect(page.getByRole("status")).not.toHaveClass(/show/, { timeout: 3000 });
        expect(errors).toEqual([]);
      });
    }
  });
}
