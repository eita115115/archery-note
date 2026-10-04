/* global db, scoreAt, lineCutRadius */
const { test, expect } = require("@playwright/test");

test.use({ hasTouch: true, isMobile: true });

async function settle(page) {
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

for (const width of [320, 375]) {
  test(`named correction controls act on the selected arrow (${width})`, async ({
    page,
  }, testInfo) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
    const history = await page.evaluate(() => db.sessions);
    await page.locator('#tabs [data-v="record"]').click();
    await page.getByRole("button", { name: "70m", exact: true }).click();
    await page.getByRole("combobox", { name: "的", exact: true }).selectOption("122");
    await page.getByRole("combobox", { name: "1エンドの本数", exact: true }).selectOption("6");
    await page.getByTestId("record-start").click();
    for (let i = 0; i < 2; i++) {
      await settle(page);
      const p = await page.locator("#tgsvg").evaluate((e) => {
        const r = e.getBoundingClientRect(),
          h = globalThis.document.querySelector("header.app").getBoundingClientRect(),
          d = globalThis.document.querySelector("#activeActionDock").getBoundingClientRect();
        return {
          x: r.x + r.width / 2,
          y: (Math.max(r.top, h.bottom + 8) + Math.min(r.bottom, d.top - 8)) / 2,
        };
      });
      await page.touchscreen.tap(p.x + i * 10, p.y);
      await expect.poll(() => page.evaluate(() => db.active.cur.length)).toBe(i + 1);
    }
    const chip = await page.locator('#curChips [data-i="0"]').boundingBox();
    await page.touchscreen.tap(chip.x + chip.width / 2, chip.y + chip.height / 2);
    await settle(page);
    await testInfo.attach("correction-accessibility", {
      body: await page.locator("#nudge .npad").ariaSnapshot(),
      contentType: "text/plain",
    });
    await page.screenshot({
      path: testInfo.outputPath(`correction-names-${width}.png`),
      animations: "disabled",
    });
    const pad = page.getByRole("group", { name: "選択中の矢の微調整", exact: true });
    await expect(pad).toHaveCount(1);
    await expect(pad.getByRole("button")).toHaveCount(5);
    const before = await page.evaluate(() => db.active.cur);
    const scroll = await page.evaluate(() => globalThis.scrollY);
    const step = 122 / 200;
    let x = before[0].x,
      y = before[0].y;
    for (const [direction, dx, dy, key] of [
      ["上", 0, step, "Enter"],
      ["左", -step, 0, "Space"],
      ["右", step, 0, "Enter"],
      ["下", 0, -step, "Space"],
    ]) {
      const button = pad.getByRole("button", {
        name: `選択中の矢を${direction}に微調整`,
        exact: true,
      });
      await expect(button).toHaveCount(1);
      await button.focus();
      await expect(button).toBeFocused();
      await page.keyboard.press(key);
      x += dx;
      y += dy;
      const active = await page.evaluate(() => db.active.cur);
      expect(active[0].x).toBeCloseTo(x, 8);
      expect(active[0].y).toBeCloseTo(y, 8);
      expect(active[1]).toEqual(before[1]);
      expect(await page.evaluate(() => globalThis.scrollY)).toBe(scroll);
      const scoreMatches = await page.evaluate(() => {
        const s = db.active,
          a = s.cur[0],
          expected = scoreAt(a.x, a.y, s.faceD, s.faceType, lineCutRadius(s.faceD, s.faceType));
        return a.s === expected.s && a.X === expected.X;
      });
      expect(scoreMatches).toBe(true);
    }
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.stringify(
              JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active.cur,
            ) === JSON.stringify(db.active.cur),
        ),
      )
      .toBe(true);
    const deletion = pad.getByRole("button", { name: "選択中の矢を削除", exact: true });
    await deletion.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => db.active.cur)).toEqual([before[1]]);
    await expect(page.locator("#nudge")).not.toHaveClass(/\bon\b/);
    await expect(page.getByTestId("active-target")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active.cur,
        ),
      )
      .toEqual([before[1]]);
    await page.reload();
    expect(await page.evaluate(() => db.active.cur)).toEqual([before[1]]);
    expect(await page.evaluate(() => db.sessions)).toEqual(history);
    expect(errors).toEqual([]);
  });
}
