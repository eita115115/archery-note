"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const math = new Function(
  fs.readFileSync(path.resolve(__dirname, "../../scripts/20-scoring.js"), "utf8") +
    "\nreturn {scoreAt,lineCutRadius};",
)();

test.use({ hasTouch: true });

function arrows(n, radius) {
  return Array.from({ length: n }, (_, i) => {
    const x = Math.cos((i / n) * Math.PI * 2) * radius,
      y = Math.sin((i / n) * Math.PI * 2) * radius;
    return { x, y, ...math.scoreAt(x, y, 40, "single", math.lineCutRadius(40, "single")) };
  });
}
function fixture(theme, long) {
  const base = { dist: 18, faceD: 40, faceType: "single", round: "free", perEnd: 3 };
  const sessions = [1, 2, 3].map((i) => ({
    ...base,
    id: `owned-history-prior-${i}`,
    date: `2026-09-0${i}`,
    ends: [arrows(6, 2.7)],
  }));
  sessions.push({
    ...base,
    id: "owned-history-previous",
    date: "2026-09-04",
    ends: [arrows(long ? 6 : 1, 0)],
  });
  sessions.push({
    ...base,
    id: "owned-history-latest",
    date: "2026-09-05",
    ends: [arrows(long ? 6 : 1, long ? 1.8 : 0)],
    note: long ? "向かい風の日に同じ条件で確認。".repeat(4) : "",
  });
  return {
    schema: 5,
    sessions,
    settings: { onboardingSeen: true, activeGuideSeen: true, theme, launchCount: 9 },
    active: null,
  };
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
async function hit(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect(),
      points = [
        [r.x + r.width / 2, r.y + r.height / 2],
        [r.left + 10, r.top + 10],
        [r.right - 10, r.top + 10],
        [r.left + 10, r.bottom - 10],
        [r.right - 10, r.bottom - 10],
      ];
    return {
      rect: r.toJSON(),
      clear: points.every(([x, y]) => el.contains(globalThis.document.elementFromPoint(x, y))),
    };
  });
}
async function tap(page, selector) {
  await settle(page);
  const p = await hit(page, selector);
  expect(p.clear, selector).toBe(true);
  await page.touchscreen.tap(p.rect.x + p.rect.width / 2, p.rect.y + p.rect.height / 2);
}
async function touchScroll(
  page,
  context,
  distance,
  startSelector = '.histDetailSheet [data-testid="history-detail-stats"]',
) {
  const stats = await page.locator(startSelector).boundingBox(),
    top = await page.locator(".histDetailSheet .subTop").boundingBox();
  const x = stats.x + stats.width / 2,
    start = stats.y + stats.height / 2,
    end = Math.max(top.y + top.height + 16, start - distance);
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: start }],
    });
    for (let y = start - 10; y >= end; y -= 10) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    // Release after a brief hold so the next direct tap does not merely stop a fling.
    await new Promise((resolve) => setTimeout(resolve, 200));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  await settle(page);
}
async function stored(page) {
  return page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
}

const cases = [];
for (const width of [320, 375, 1024])
  for (const theme of ["light", "dark"])
    for (const motion of ["reduce", "no-preference"])
      cases.push({ width, theme, motion, long: false });
for (const width of [320, 375]) cases.push({ width, theme: "light", motion: "reduce", long: true });

/* v5 段 6: ノートの詳細は全画面。操作は一番下の「この記録の操作」にまとめ、下端に固定の帯は置かない。
   「戻る」だけを上端に留める。読む行は帯に隠れず、操作は 48px 以上で、読むだけでは何も書き換わらない。 */
for (const c of cases) {
  test(`note detail keeps reading space and reachable actions (${c.width}, ${c.theme}, ${c.motion}, ${c.long ? "long" : "short"})`, async ({
    page,
    context,
  }, testInfo) => {
    const data = fixture(c.theme, c.long),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const height = c.width === 320 ? 568 : 812;
    await page.setViewportSize({ width: c.width, height });
    await page.emulateMedia({ colorScheme: c.theme, reducedMotion: c.motion });
    await page.addInitScript((database) => {
      if (!globalThis.localStorage.getItem("archeryNote.v1"))
        globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
    }, data);
    await page.goto("/");
    await tap(page, '#tabs [data-v="history"]');
    const record = '.historyRow[data-id="owned-history-latest"]';
    await page.locator(record).scrollIntoViewIfNeeded();
    await tap(page, record);
    await settle(page);
    const old = await stored(page);
    // 全画面: 画面の高さいっぱいで、下に引いて閉じる取っ手は無い
    const sheet = await page.locator(".histDetailSheet").boundingBox();
    expect(sheet.y).toBe(0);
    expect(sheet.height).toBe(height);
    await expect(page.locator(".histDetailSheet .modalSwipeHandle")).toHaveCount(0);
    // 下端に固定の操作の帯は無い（操作は流れの最後）
    expect(
      await page
        .locator(".histDetailActions")
        .evaluate((el) => globalThis.getComputedStyle(el).position),
    ).toBe("static");
    const back = await hit(page, "#hClose");
    expect(back.rect.height).toBeGreaterThanOrEqual(48);
    expect(back.rect.width).toBeGreaterThanOrEqual(48);
    expect(back.clear).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("initial.png") });

    // 指で送る。読む行は「戻る」の帯に隠れない
    const row = c.long
      ? '[data-testid="todays-result-stability"]'
      : '[data-testid="todays-result-stability-pending"]';
    await touchScroll(page, context, c.long ? 210 : 110);
    await expect
      .poll(() => page.locator(".histDetailSheet").evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await page.locator(row).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect.poll(async () => (await hit(page, row)).clear).toBe(true);
    const bar = await page.locator(".histDetailSheet .subTop").boundingBox();
    expect(Math.round(bar.y)).toBe(0);
    expect((await hit(page, row)).rect.top).toBeGreaterThanOrEqual(bar.y + bar.height);
    expect((await hit(page, "#hClose")).clear).toBe(true);
    fs.writeFileSync(
      testInfo.outputPath("reading-geometry.json"),
      JSON.stringify(
        {
          reading: await hit(page, row),
          scrollTop: await page.locator(".histDetailSheet").evaluate((el) => el.scrollTop),
        },
        null,
        2,
      ),
    );
    await page.screenshot({ path: testInfo.outputPath("reading.png") });
    if (c.long) {
      const lastResult = ".histDetailSheet .summaryTodaysResult .todaysResultRow:last-child";
      await page.locator(lastResult).evaluate((el) => el.scrollIntoView({ block: "center" }));
      await expect.poll(async () => (await hit(page, lastResult)).clear).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("last-result.png") });
    }
    // この記録の操作: 一番下まで送ると、どれも 48px 以上で、ほかの部品に隠れない
    await page
      .locator(".histDetailSheet")
      .evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
    await settle(page);
    for (const selector of ["#hEdit", "#hCard", "#hAnalysis", "#hDel"]) {
      const b = await hit(page, selector);
      expect(b.rect.height, selector).toBeGreaterThanOrEqual(48);
      expect(b.rect.width, selector).toBeGreaterThanOrEqual(48);
      expect(b.clear, selector).toBe(true);
      expect(b.rect.bottom, selector).toBeLessThanOrEqual(height);
      expect(
        await page.locator(selector).evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath("actions.png") });
    expect((await stored(page)).sessions).toEqual(old.sessions);
    await tap(page, "#hDel");
    await expect(page.locator(".ovl")).toHaveCount(2);
    await tap(page, "#acCancel");
    await expect(page.locator(".ovl")).toHaveCount(1);
    expect((await stored(page)).sessions).toEqual(old.sessions);
    await tap(page, "#hClose");
    await expect(page.locator(".ovl")).toHaveCount(0);
    expect((await stored(page)).sessions).toEqual(old.sessions);
    await tap(page, record);
    await page
      .locator(".histDetailSheet")
      .evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
    await tap(page, "#hEdit");
    await expect(page.locator("#tgsvg")).toBeAttached();
    const editing = await stored(page);
    expect(editing.active._edit).toBe(true);
    expect(editing.active.ends).toEqual(data.sessions[4].ends);
    expect(editing.sessions).toEqual(old.sessions);
    await page.reload();
    expect((await stored(page)).active).toEqual(editing.active);
    expect((await stored(page)).sessions).toEqual(old.sessions);
    expect(errors).toEqual([]);
  });
}
