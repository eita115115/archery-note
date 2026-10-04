"use strict";

const { test, expect } = require("@playwright/test");

test.use({ hasTouch: true, isMobile: true });

function arrows(n, spread) {
  return Array.from({ length: n }, (_, i) => ({
    x: Math.cos((i / n) * Math.PI * 2) * spread,
    y: Math.sin((i / n) * Math.PI * 2) * spread,
    s: 9,
  }));
}
function fixture(n, theme) {
  const base = { dist: 18, faceD: 40, faceType: "single", perEnd: 3, round: "free" };
  return {
    schema: 5,
    settings: { onboardingSeen: true, activeGuideSeen: true, theme },
    sessions: [0, 1, 2].map((i) => ({
      ...base,
      id: `owned-group-prior-${i}`,
      date: `2026-06-0${i + 1}`,
      ends: [arrows(6, 2)],
    })),
    active: {
      ...base,
      id: "owned-group-current",
      date: "2026-06-04",
      shaft: 0.65,
      ends: [],
      cur: arrows(n, 0.5),
    },
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
async function nativeTap(page, selector) {
  await settle(page);
  const point = await page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2;
    return { x, y, hit: el.contains(globalThis.document.elementFromPoint(x, y)) };
  });
  expect(point.hit).toBe(true);
  await page.touchscreen.tap(point.x, point.y);
}
async function stored(page) {
  return page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
}

for (const width of [320, 375]) {
  for (const theme of ["light", "dark"]) {
    for (const count of [1, 2, 3]) {
      test(`grouping result requires three coordinates (${width}, ${theme}, ${count})`, async ({
        page,
      }, testInfo) => {
        const errors = [],
          data = fixture(count, theme);
        page.on("pageerror", (e) => errors.push(e.message));
        await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
        await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
        await page.addInitScript((database) => {
          if (!globalThis.localStorage.getItem("archeryNote.v1"))
            globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
        }, data);
        await page.goto("/");
        await expect(page.locator("#bootFallback")).toBeHidden();
        const before = await stored(page);
        await nativeTap(page, "#bFinish");
        await expect(page.locator("#sumPlot")).toBeAttached();
        await settle(page);
        await page.screenshot({ path: testInfo.outputPath("summary.png") });
        const stability = page.getByTestId("todays-result-stability");
        await expect(page.locator(".ovl .statbar")).toContainText(`合計 (${count}本)`);
        if (count < 3) {
          await expect(stability).toHaveCount(0);
          const pending = page.getByTestId("todays-result-stability-pending");
          await expect(pending).toContainText("グルーピングの比較は保留");
          await expect(pending).toContainText(`${count}本の座標`);
          await expect(pending.locator("svg.todaysResultSpark")).toHaveCount(0);
          await expect(page.getByTestId("todays-result-streak-stability")).toHaveCount(0);
        } else {
          await expect(stability).toContainText("RMSが");
          await expect(stability.locator(".todaysResultSpark")).toHaveCount(1);
          await expect(page.getByTestId("todays-result-stability-pending")).toHaveCount(0);
        }
        const comparison =
          count < 3 ? page.getByTestId("todays-result-stability-pending") : stability;
        const summaryText = await comparison.innerText();
        const after = await stored(page);
        expect(after.active).toBeNull();
        expect(after.sessions.filter((s) => s.id !== data.active.id)).toEqual(before.sessions);
        const finished = after.sessions.find((s) => s.id === data.active.id);
        expect(finished.ends).toEqual([data.active.cur]);
        expect(finished.ends.flat().reduce((n, a) => n + a.s, 0)).toBe(count * 9);
        await page.locator("#sumClose").scrollIntoViewIfNeeded();
        await nativeTap(page, "#sumClose");
        await page.locator('#tabs [data-v="history"]').click();
        await page.locator(`.historyRow[data-id="${data.active.id}"]`).click();
        await expect(comparison).toHaveText(summaryText);
        await settle(page);
        await page.screenshot({ path: testInfo.outputPath("history.png") });
        expect(
          await page.locator(".ovl .sheet").evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
        await page.locator("#hClose").click();
        await page.reload();
        expect((await stored(page)).sessions).toEqual(after.sessions);
        expect(errors).toEqual([]);
        await testInfo.attach("grouping-evidence", {
          body: JSON.stringify({ width, theme, count, before, after, summaryText, errors }),
          contentType: "application/json",
        });
      });
    }
  }
}

for (const count of [1, 2]) {
  test(`first few-arrow result explains pending grouping (${count})`, async ({ page }) => {
    const data = fixture(count, "light");
    data.sessions = [];
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((database) => {
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
    }, data);
    await page.goto("/");
    await nativeTap(page, "#bFinish");
    await expect(page.getByTestId("todays-result-stability-pending")).toContainText(
      `${count}本の座標`,
    );
    await expect(page.getByTestId("todays-result-stability")).toHaveCount(0);
    await expect(page.getByTestId("todays-result-streak-stability")).toHaveCount(0);
    expect((await stored(page)).sessions[0].ends).toEqual([data.active.cur]);
  });
}
