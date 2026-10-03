/* global db, scoreAt, lineCutRadius */
const { test, expect } = require("@playwright/test");

test.use({ hasTouch: true, isMobile: true });

async function settle(page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const animations = globalThis.document.getAnimations();
        return animations.every(
          (a) => !Number.isFinite(a.effect.getTiming().iterations) || a.playState !== "running",
        );
      }),
    )
    .toBe(true);
}

async function state(page) {
  return page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
}

async function tap(page, locator) {
  await settle(page);
  const point = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.x + r.width / 2,
      y = r.y + r.height / 2;
    return { x, y, hit: globalThis.document.elementFromPoint(x, y)?.closest("button") === el };
  });
  expect(point.hit).toBe(true);
  await page.touchscreen.tap(point.x, point.y);
}

async function record(page) {
  await settle(page);
  const count = (await state(page)).active.cur.length;
  const point = await page.locator("#tgsvg").evaluate((el) => {
    const r = el.getBoundingClientRect();
    const header = globalThis.document.querySelector("header.app").getBoundingClientRect();
    const dock = globalThis.document.querySelector("#activeActionDock").getBoundingClientRect();
    return {
      x: r.x + r.width / 2,
      y: (Math.max(r.top, header.bottom + 8) + Math.min(r.bottom, dock.top - 8)) / 2,
    };
  });
  await page.touchscreen.tap(point.x, point.y);
  await expect.poll(async () => (await state(page)).active.cur.length).toBe(count + 1);
}

async function pad(page) {
  return page.locator("#nudge .npad button").evaluateAll((buttons) => {
    const header = globalThis.document.querySelector("header.app").getBoundingClientRect();
    const dock = globalThis.document.querySelector("#activeActionDock").getBoundingClientRect();
    return buttons.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        direction: el.dataset.n,
        top: r.top,
        bottom: r.bottom,
        above: Math.max(0, header.bottom),
        below: dock.top,
        hit:
          globalThis.document
            .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
            ?.closest("button") === el,
      };
    });
  });
}

async function expectPad(page) {
  await settle(page);
  const buttons = await pad(page);
  expect(buttons).toHaveLength(5);
  for (const b of buttons) {
    expect(b.top, b.direction).toBeGreaterThanOrEqual(b.above + 7);
    expect(b.bottom, b.direction).toBeLessThanOrEqual(b.below - 7);
    expect(b.hit, b.direction).toBe(true);
  }
}

async function revealSecondary(page, locator) {
  const delta = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect(),
      h = globalThis.document.querySelector("header.app").getBoundingClientRect(),
      d = globalThis.document.querySelector("#activeActionDock").getBoundingClientRect();
    return r.top + r.height / 2 - (Math.max(0, h.bottom) + d.top) / 2;
  });
  await page.evaluate((top) => globalThis.scrollBy({ top, behavior: "instant" }), delta);
  await settle(page);
}

async function expectTarget(page) {
  const r = await page.locator("#tgsvg").evaluate((el) => {
    const r = el.getBoundingClientRect(),
      h = globalThis.document.querySelector("header.app").getBoundingClientRect(),
      d = globalThis.document.querySelector("#activeActionDock").getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, above: Math.max(0, h.bottom), below: d.top };
  });
  expect(r.top).toBeGreaterThanOrEqual(r.above + 7);
  expect(r.bottom).toBeLessThanOrEqual(r.below - 7);
}

for (const width of [320, 375]) {
  for (const colorScheme of ["light", "dark"]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      test(`correction buttons need no extra scroll (${width}, ${colorScheme}, ${reducedMotion})`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
        await page.emulateMedia({ colorScheme, reducedMotion });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("/");
        await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
        await page.locator('#tabs [data-v="record"]').click();
        await page.getByRole("button", { name: "70m", exact: true }).click();
        await page.getByRole("combobox", { name: "的", exact: true }).selectOption("122");
        await page.getByRole("combobox", { name: "1エンドの本数", exact: true }).selectOption("6");
        await page.getByTestId("record-start").click();
        const sessions = (await state(page)).sessions;
        await record(page);
        await record(page);
        await tap(page, page.locator('#curChips [data-i="0"]'));
        await settle(page);
        await page.screenshot({
          path: testInfo.outputPath("correction-entry.png"),
          animations: "disabled",
        });
        await expectPad(page);
        const before = (await state(page)).active.cur[0];
        const top = await page.evaluate(() => globalThis.scrollY);
        const right = page.locator('#nudge [data-n="r"]');
        for (let i = 0; i < 3; i++) await tap(page, right);
        await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(top);
        await expect
          .poll(async () => (await state(page)).active.cur[0].x)
          .toBeCloseTo(before.x + (3 * 122) / 200);
        const agreement = await page.evaluate(() => {
          const s = db.active,
            a = s.cur[0];
          return {
            arrow: a,
            hit: scoreAt(a.x, a.y, s.faceD, s.faceType, lineCutRadius(s.faceD, s.faceType)),
          };
        });
        expect(agreement.arrow.s).toBe(agreement.hit.s);
        expect(agreement.arrow.X).toBe(agreement.hit.X);
        const reason = page.getByRole("button", { name: "風", exact: true });
        await revealSecondary(page, reason);
        const reasonTop = await page.evaluate(() => globalThis.scrollY);
        await tap(page, reason);
        await expect.poll(async () => (await state(page)).active.cur[0].reason).toBe("風");
        expect(await page.evaluate(() => globalThis.scrollY)).toBe(reasonTop);
        const number = page.getByRole("textbox", { name: "矢番号", exact: true });
        await revealSecondary(page, number);
        const numberTop = await page.evaluate(() => globalThis.scrollY);
        await number.fill("7");
        await number.press("Tab");
        await expect.poll(async () => (await state(page)).active.cur[0].no).toBe("7");
        expect(await page.evaluate(() => globalThis.scrollY)).toBe(numberTop);
        await revealSecondary(page, page.locator("#nudgeDone"));
        const corrected = (await state(page)).active.cur;
        await tap(page, page.locator("#nudgeDone"));
        await settle(page);
        await expectTarget(page);
        expect((await state(page)).active.cur).toEqual(corrected);
        // A second arrow can enter correction too; confirm while correction is open.
        await tap(page, page.locator('#curChips [data-i="1"]'));
        await expectPad(page);
        await tap(page, page.getByTestId("active-end"));
        await expect.poll(async () => (await state(page)).active.ends.length).toBe(1);
        expect((await state(page)).active.ends[0]).toEqual(corrected);
        await settle(page);
        await expectTarget(page);
        await record(page);
        await expect.poll(async () => (await state(page)).active.cur.length).toBe(1);
        const stored = await state(page);
        await page.reload();
        expect((await state(page)).active).toEqual(stored.active);
        expect((await state(page)).sessions).toEqual(sessions);
        expect(errors).toEqual([]);
      });
    }
  }
}
