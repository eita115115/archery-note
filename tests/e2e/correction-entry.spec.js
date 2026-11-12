/* global db, scoreAt, lineCutRadius */
const fs = require("node:fs");
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
    const header = { bottom: 0 }; // v5: 上に固定の帯は無い（画面の上端が基準）
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
  return page.locator("#nudge [data-n]").evaluateAll((buttons) => {
    const header = { bottom: 0 }; // v5: 上に固定の帯は無い（画面の上端が基準）
    // v5: 修正バーは操作列の代わりに画面の下端へ出る。下の基準は画面の下端
    const dock = { top: globalThis.innerHeight };
    const noticeTop = dock.top;
    return buttons.map((el) => {
      const r = el.getBoundingClientRect();
      const points = [
        [r.x + r.width / 2, r.y + r.height / 2],
        [r.left + 8, r.top + 8],
        [r.right - 8, r.top + 8],
        [r.left + 8, r.bottom - 8],
        [r.right - 8, r.bottom - 8],
      ];
      return {
        direction: el.dataset.n,
        top: r.top,
        bottom: r.bottom,
        above: Math.max(0, header.bottom),
        below: Math.min(dock.top, noticeTop),
        hit: points.every(
          ([x, y]) => globalThis.document.elementFromPoint(x, y)?.closest("button") === el,
        ),
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
  // 修正バーが出ても画面は縦に流れない（没入画面は1画面に収まる）
  expect(await page.evaluate(() => globalThis.scrollY)).toBe(0);
  expect(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollHeight <= globalThis.innerHeight,
    ),
  ).toBe(true);
}

async function expectTarget(page) {
  const r = await page.locator("#tgsvg").evaluate((el) => {
    const r = el.getBoundingClientRect(),
      h = { bottom: 0 },
      d = globalThis.document.querySelector("#activeActionDock").getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, above: Math.max(0, h.bottom), below: d.top };
  });
  expect(r.top).toBeGreaterThanOrEqual(r.above + 7);
  expect(r.bottom).toBeLessThanOrEqual(r.below - 7);
}

for (const config of [
  { dist: 18, faceD: 40, perEnd: 3 },
  { dist: 70, faceD: 122, perEnd: 6 },
]) {
  for (const width of [320, 375]) {
    for (const colorScheme of ["light", "dark"]) {
      for (const reducedMotion of ["no-preference", "reduce"]) {
        test(`correction buttons need no extra scroll (${width}, ${colorScheme}, ${reducedMotion}, ${config.dist}m/${config.faceD}cm/${config.perEnd})`, async ({
          page,
        }, testInfo) => {
          await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
          await page.emulateMedia({ colorScheme, reducedMotion });
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto("/");
          await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
          await page.locator('#tabs [data-v="record"]').click();
          await page.getByRole("button", { name: `${config.dist}m`, exact: true }).click();
          await page
            .getByRole("combobox", { name: "的", exact: true })
            .selectOption(String(config.faceD));
          await page
            .getByRole("combobox", { name: "1エンドの本数", exact: true })
            .selectOption(String(config.perEnd));
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
          const samples = [];
          for (let i = 0; i < 3; i++) {
            await tap(page, right);
            await expectPad(page);
            samples.push({
              scrollY: await page.evaluate(() => globalThis.scrollY),
              buttons: await pad(page),
            });
          }
          await page.screenshot({ path: testInfo.outputPath("correction-after-three.png") });
          fs.writeFileSync(
            testInfo.outputPath("correction-followup.json"),
            JSON.stringify(samples, null, 2),
          );
          await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(top);
          await expect
            .poll(async () => (await state(page)).active.cur[0].x)
            .toBeCloseTo(before.x + 0.3); // v5: 矢印は的の大きさによらず 1mm ずつ
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
          // v5: 外れ理由と矢番号は修正バーの「理由・矢番号」から開くシートに置く
          await tap(page, page.getByRole("button", { name: "理由・矢番号", exact: true }));
          const reason = page.getByRole("button", { name: "風", exact: true });
          await tap(page, reason);
          await expect(reason).toHaveAttribute("aria-pressed", "true");
          await expect.poll(async () => (await state(page)).active.cur[0].reason).toBe("風");
          const number = page.getByRole("textbox", { name: "矢番号", exact: true });
          await number.fill("7");
          await number.press("Tab");
          await expect.poll(async () => (await state(page)).active.cur[0].no).toBe("7");
          await tap(page, page.locator("#shotMetaClose"));
          await expect(page.getByTestId("shot-meta-sheet")).toHaveCount(0);
          await expect(page.locator('#curChips [data-i="0"]')).toContainText("#7");
          await expect(page.locator("#nudge")).toHaveClass(/\bon\b/);
          expect(await page.evaluate(() => globalThis.scrollY)).toBe(0);
          const corrected = (await state(page)).active.cur;
          await tap(page, page.locator("#nudgeDone"));
          await settle(page);
          await expectTarget(page);
          expect((await state(page)).active.cur).toEqual(corrected);
          // A second arrow can enter correction too. v5: 修正バーを「完了」で閉じてからエンドを確定する
          fs.writeFileSync(
            testInfo.outputPath("before-second-selection.json"),
            JSON.stringify(
              await page.evaluate(() => ({
                scrollY: globalThis.scrollY,
                elements: [
                  "#tgsvg",
                  "#curChips",
                  '#curChips [data-i="1"]',
                  "#activeActionDock",
                  "#toast",
                ].map((selector) => {
                  const el = globalThis.document.querySelector(selector),
                    r = el.getBoundingClientRect();
                  const x = r.x + r.width / 2,
                    y = r.y + r.height / 2;
                  const hit = globalThis.document.elementFromPoint(x, y);
                  return { selector, rect: r.toJSON(), hit: hit?.outerHTML.slice(0, 300) };
                }),
              })),
              null,
              2,
            ),
          );
          await page.screenshot({ path: testInfo.outputPath("before-second-selection.png") });
          await tap(page, page.locator('#curChips [data-i="1"]'));
          await expectPad(page);
          await expect(page.getByTestId("active-action-dock")).toBeHidden();
          await tap(page, page.locator("#nudgeDone"));
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
}
