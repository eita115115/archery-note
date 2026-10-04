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
async function touchScroll(page, context, distance, startSelector = ".histDetailSheet .statbar") {
  const stats = await page.locator(startSelector).boundingBox(),
    handle = await page.locator(".modalSwipeHandle").boundingBox();
  const x = stats.x + stats.width / 2,
    start = stats.y + stats.height / 2,
    end = Math.max(handle.y + handle.height + 16, start - distance);
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

for (const c of cases) {
  test(`history actions preserve reading space (${c.width}, ${c.theme}, ${c.motion}, ${c.long ? "long" : "short"})`, async ({
    page,
    context,
  }, testInfo) => {
    const data = fixture(c.theme, c.long),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: c.width, height: c.width === 320 ? 568 : 812 });
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
    const row = c.long
      ? '[data-testid="todays-result-stability"]'
      : '[data-testid="todays-result-stability-pending"]';
    const initial = await hit(page, row);
    const action = await page.locator(".histDetailActions").boundingBox();
    fs.writeFileSync(
      testInfo.outputPath("initial-geometry.json"),
      JSON.stringify({ initial, action }, null, 2),
    );
    await page.screenshot({ path: testInfo.outputPath("initial.png") });
    expect(action.height).toBeLessThan(160);
    if (!c.long) {
      expect(initial.rect.bottom).toBeLessThanOrEqual(action.y);
      expect(initial.clear).toBe(true);
    }
    for (const selector of ["#hEdit", "#hCard", "#hClose", "#hDel"]) {
      const b = await hit(page, selector);
      expect(b.rect.height).toBeGreaterThanOrEqual(48);
      expect(b.rect.width).toBeGreaterThanOrEqual(48);
      expect(b.clear).toBe(true);
      expect(
        await page.locator(selector).evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
    }
    const old = await stored(page);
    await touchScroll(page, context, c.long ? 210 : 110);
    await expect
      .poll(() => page.locator(".histDetailSheet").evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await expect.poll(async () => (await hit(page, row)).clear).toBe(true);
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
      await touchScroll(page, context, 130, row);
      const lastResult = ".histDetailSheet .summaryTodaysResult .todaysResultRow:last-child";
      await expect.poll(async () => (await hit(page, lastResult)).clear).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("last-result.png") });
    }
    expect((await stored(page)).sessions).toEqual(old.sessions);
    await tap(page, "#hDel");
    await expect(page.locator(".ovl")).toHaveCount(2);
    await tap(page, "#acCancel");
    await expect(page.locator(".ovl")).toHaveCount(1);
    expect((await stored(page)).sessions).toEqual(old.sessions);
    await tap(page, "#hClose");
    await expect(page.locator(".ovl")).toHaveCount(0);
    await tap(page, record);
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
