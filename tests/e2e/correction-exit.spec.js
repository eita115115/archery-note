/* global toast, db, scoreAt, lineCutRadius */
const fs = require("node:fs");
const { test, expect } = require("@playwright/test");

test.use({ hasTouch: true, isMobile: true });
async function state(page) {
  return page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
}
async function settle(page) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  await expect
    .poll(() =>
      page.evaluate(() =>
        globalThis.document
          .getAnimations()
          .every(
            (a) => !Number.isFinite(a.effect.getTiming().iterations) || a.playState !== "running",
          ),
      ),
    )
    .toBe(true);
}
async function geometry(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect(),
      h = globalThis.document.querySelector("header.app").getBoundingClientRect(),
      d = globalThis.document.querySelector("#activeActionDock").getBoundingClientRect(),
      notice = globalThis.document.querySelector("#toast");
    const points = [
      [r.x + r.width / 2, r.y + r.height / 2],
      [r.left + 8, r.top + 8],
      [r.right - 8, r.top + 8],
      [r.left + 8, r.bottom - 8],
      [r.right - 8, r.bottom - 8],
    ];
    return {
      rect: r.toJSON(),
      clear: points.every(([x, y]) => el.contains(globalThis.document.elementFromPoint(x, y))),
      above: Math.max(0, h.bottom),
      below: Math.min(
        d.top,
        notice.classList.contains("show") ? notice.getBoundingClientRect().top : d.top,
      ),
      scrollY: globalThis.scrollY,
    };
  });
}
async function tap(page, selector) {
  await settle(page);
  const p = await geometry(page, selector);
  expect(p.clear, selector).toBe(true);
  await page.touchscreen.tap(p.rect.x + p.rect.width / 2, p.rect.y + p.rect.height / 2);
}
async function record(page) {
  await settle(page);
  const n = (await state(page)).active.cur.length;
  const p = await page.locator("#tgsvg").evaluate((el) => {
    const r = el.getBoundingClientRect(),
      h = globalThis.document.querySelector("header.app").getBoundingClientRect(),
      d = globalThis.document.querySelector("#activeActionDock").getBoundingClientRect();
    return {
      x: r.x + r.width / 2,
      y: (Math.max(r.top, h.bottom + 8) + Math.min(r.bottom, d.top - 8)) / 2,
    };
  });
  await page.touchscreen.tap(p.x, p.y);
  await expect.poll(async () => (await state(page)).active.cur.length).toBe(n + 1);
}
async function expectControls(page) {
  await settle(page);
  for (const selector of [
    '#nudge [data-n="u"]',
    '#nudge [data-n="l"]',
    '#nudge [data-n="del"]',
    '#nudge [data-n="r"]',
    '#nudge [data-n="d"]',
    "#nudgeDone",
  ]) {
    const p = await geometry(page, selector);
    expect(p.clear, selector).toBe(true);
    expect(p.rect.top, selector).toBeGreaterThanOrEqual(p.above + 7);
    expect(p.rect.bottom, selector).toBeLessThanOrEqual(p.below - 7);
    expect(p.rect.width).toBeGreaterThanOrEqual(44);
    expect(p.rect.height).toBeGreaterThanOrEqual(selector === "#nudgeDone" ? 48 : 44);
    expect(
      await page.locator(selector).evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
  }
}
const cases = [];
for (const width of [320, 375])
  for (const theme of ["light", "dark"])
    for (const motion of ["reduce", "no-preference"])
      for (const faceD of [40, 122]) cases.push({ width, theme, motion, faceD, notice: false });
for (const width of [320, 375])
  cases.push({ width, theme: "light", motion: "no-preference", faceD: 40, notice: true });
cases.push({ width: 1024, theme: "light", motion: "reduce", faceD: 122, notice: false });
for (const c of cases) {
  test(`direct correction exit (${c.width}, ${c.theme}, ${c.motion}, ${c.faceD}, notice ${c.notice})`, async ({
    page,
  }, testInfo) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: c.width, height: c.width === 320 ? 568 : 812 });
    await page.emulateMedia({ colorScheme: c.theme, reducedMotion: c.motion });
    await page.goto("/");
    await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
    await page.locator('#tabs [data-v="record"]').click();
    await page.getByRole("button", { name: c.faceD === 40 ? "18m" : "70m", exact: true }).click();
    await page.getByRole("combobox", { name: "的", exact: true }).selectOption(String(c.faceD));
    await page
      .getByRole("combobox", { name: "1エンドの本数", exact: true })
      .selectOption(c.faceD === 40 ? "3" : "6");
    await page.getByTestId("record-start").click();
    const old = (await state(page)).sessions;
    await record(page);
    await record(page);
    if (c.notice) await page.evaluate(() => toast("現在のエンドを編集中です", 10000)); // Owned notice fixture; no save or scroll override.
    await tap(page, '#curChips [data-i="0"]');
    await settle(page);
    const initial = await geometry(page, "#nudgeDone");
    fs.writeFileSync(testInfo.outputPath("initial.json"), JSON.stringify(initial, null, 2));
    await page.screenshot({ path: testInfo.outputPath("initial.png") });
    await expectControls(page);
    const before = (await state(page)).active.cur;
    const top = await page.evaluate(() => globalThis.scrollY);
    for (let i = 0; i < 3; i++) {
      await tap(page, '#nudge [data-n="r"]');
      await expectControls(page);
      expect(await page.evaluate(() => globalThis.scrollY)).toBe(top);
    }
    await expect
      .poll(async () => (await state(page)).active.cur[0].x)
      .toBeCloseTo(before[0].x + (3 * c.faceD) / 200);
    const corrected = (await state(page)).active.cur;
    expect(corrected[1]).toEqual(before[1]);
    const agreement = await page.evaluate(() => {
      const s = db.active,
        a = s.cur[0];
      return {
        arrow: a,
        score: scoreAt(a.x, a.y, s.faceD, s.faceType, lineCutRadius(s.faceD, s.faceType)),
      };
    });
    expect(agreement.arrow.s).toBe(agreement.score.s);
    expect(agreement.arrow.X).toBe(agreement.score.X);
    await page.screenshot({ path: testInfo.outputPath("after-three.png") });
    await tap(page, "#nudgeDone");
    await settle(page);
    await expect(page.locator("#nudge")).not.toHaveClass(/on/);
    expect((await state(page)).active.cur).toEqual(corrected);
    const target = await geometry(page, "#tgsvg");
    expect(target.rect.top).toBeGreaterThanOrEqual(target.above + 7);
    expect(target.rect.bottom).toBeLessThanOrEqual(target.below - 7);
    await record(page);
    await expect.poll(async () => (await state(page)).active.cur.length).toBe(3);
    const complete = (await state(page)).active.cur;
    expect(complete.slice(0, 2)).toEqual(corrected);
    await tap(page, "#bEnd");
    await expect.poll(async () => (await state(page)).active.ends.length).toBe(1);
    expect((await state(page)).active.ends[0]).toEqual(complete);
    expect((await state(page)).sessions).toEqual(old);
    const saved = (await state(page)).active;
    await page.reload();
    expect((await state(page)).active).toEqual(saved);
    expect((await state(page)).sessions).toEqual(old);
    expect(errors).toEqual([]);
  });
}
