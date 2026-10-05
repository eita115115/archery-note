"use strict";
const { test, expect } = require("@playwright/test");
const fixtures = require("../../docs/codex/evidence/analysis-evidence-v110/fixtures.json");
test.use({ hasTouch: true, isMobile: true });
async function settled(page) {
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
  await page.evaluate(
    () =>
      new Promise((r) =>
        globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(r)),
      ),
  );
}
async function stored(page) {
  return page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
}
async function tap(page, selector) {
  await settled(page);
  const point = await page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      clear: [
        [r.x + r.width / 2, r.y + r.height / 2],
        [r.left + 4, r.top + 4],
        [r.right - 4, r.top + 4],
        [r.left + 4, r.bottom - 4],
        [r.right - 4, r.bottom - 4],
      ].every(([x, y]) => el.contains(globalThis.document.elementFromPoint(x, y))),
    };
  });
  expect(point.clear).toBe(true);
  await page.touchscreen.tap(point.x, point.y);
}
for (const width of [320, 375])
  for (const theme of ["light", "dark"])
    for (const count of [0, 1, 2, 3, 6]) {
      test(`analysis grouping evidence (${width}, ${theme}, ${count})`, async ({
        page,
      }, testInfo) => {
        const current = fixtures.cases.find((s) => s.ends[0].length === count),
          data = {
            schema: 5,
            settings: { onboardingSeen: true, activeGuideSeen: true, theme, launchCount: 10 },
            sessions: [...fixtures.old, current],
            active: null,
          },
          errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
        await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
        await page.addInitScript((d) => {
          if (!globalThis.localStorage.getItem("archeryNote.v1"))
            globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(d));
        }, data);
        await page.goto("/");
        await tap(page, '#tabs [data-v="analysis"]');
        const observed = await page.evaluate((id) => {
          const d = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")),
            rows = globalThis.buildAnalysisRows(d.sessions, d.setups, globalThis.sessionMetrics),
            s = d.sessions.find((s) => s.id === id),
            m = globalThis.sessionMetrics(s);
          return {
            stats: m.st,
            dashboard: globalThis.growthDashboard(rows, s.date),
            conclusion: globalThis.todayConclusion(rows),
            suggestions: globalThis.nextPracticeSuggestions(rows, s.date),
            period: globalThis.aggregateByPeriod(rows, "month"),
            condition: globalThis.conditionSplit(rows, globalThis.isWindy),
            qualification: globalThis.trHasGroupingEvidence(m.st),
            pointScores: s.ends.flat().map((a) => ({
              saved: a.s,
              X: a.X,
              calculated: globalThis.scoreAt(
                a.x,
                a.y,
                s.faceD,
                s.faceType,
                globalThis.lineCutRadius(s.faceD, s.faceType),
              ),
            })),
          };
        }, current.id);
        for (const p of observed.pointScores) {
          expect(p.saved).toBe(p.calculated.s);
          expect(p.X).toBe(p.calculated.X);
        }
        expect(observed.qualification).toBe(count >= 3);
        expect(observed.dashboard.recentAverage).toBe(9);
        expect(observed.period[0].arrows).toBe(18 + count);
        expect(observed.condition.calm.arrows).toBe(18 + count);
        if (count === 1 || count === 2) {
          expect(observed.dashboard.groupingDelta).toBeNull();
          expect(observed.dashboard.groupingSamples).toBe(3);
          expect(observed.conclusion.kind).toBe("grouping-pending");
          expect(observed.suggestions.some((s) => s.id === "collect-coordinates")).toBe(true);
          await expect(page.getByTestId("growth-dashboard")).toContainText("比較待ち");
          await expect(page.getByTestId("today-conclusion")).toContainText("比較は保留");
          const bounds = await page
            .getByTestId("today-conclusion")
            .locator("p")
            .evaluate((el) => ({
              paragraph: el.getBoundingClientRect().toJSON(),
              nav: globalThis.document.querySelector("#tabs").getBoundingClientRect().toJSON(),
            }));
          expect(bounds.paragraph.bottom).toBeLessThanOrEqual(bounds.nav.top - 4);
          expect(bounds.paragraph.left).toBeGreaterThanOrEqual(0);
          expect(bounds.paragraph.right).toBeLessThanOrEqual(width);
        }
        if (count >= 1)
          expect(observed.suggestions.some((s) => s.id.endsWith("spread"))).toBe(false);
        await settled(page);
        await page.screenshot({ path: testInfo.outputPath("dashboard.png") });
        const kpi = page.locator(".insightStrip").first();
        await kpi.scrollIntoViewIfNeeded();
        await settled(page);
        await expect(kpi).toBeVisible();
        const tile = kpi.locator(".insightTile").nth(1);
        if (count === 1 || count === 2) {
          await expect(tile.locator("b")).toHaveText("比較待ち");
          await expect(tile).toContainText("座標3本以上");
          await expect(tile).not.toContainText("最小 0.0cm");
        } else if (count >= 3) await expect(tile.locator("b")).toHaveText("0.0cm");
        expect(await kpi.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath("kpi.png") });
        await tap(page, '#tabs [data-v="history"]');
        await page.locator(`.historyRow[data-id="${current.id}"]`).click();
        await settled(page);
        const history = await page.locator(".ovl").last().innerText();
        if (count === 1 || count === 2) {
          expect(history).toContain("グルーピングの比較は保留");
          expect(history).not.toContain("グルーピングは良好");
        }
        if (count >= 1) {
          expect(history).not.toContain("左右の再現性");
          expect(history).not.toContain("上下の再現性");
          expect(history).not.toContain("横長のグルーピング");
          expect(history).not.toContain("縦長のグルーピング");
        }
        await page.screenshot({ path: testInfo.outputPath("history.png") });
        await tap(page, "#hClose");
        const before = await stored(page);
        expect(before.sessions).toEqual(data.sessions);
        await page.reload();
        expect((await stored(page)).sessions).toEqual(before.sessions);
        expect(errors).toEqual([]);
        await testInfo.attach("observed", {
          body: JSON.stringify({
            width,
            theme,
            count,
            observed,
            history,
            oldRecordsExact: true,
            reloadExact: true,
            errors,
          }),
          contentType: "application/json",
        });
      });
    }

test("native one-arrow finish stays pending across analysis and history", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((old) => {
    if (!globalThis.localStorage.getItem("archeryNote.v1"))
      globalThis.localStorage.setItem(
        "archeryNote.v1",
        JSON.stringify({
          schema: 5,
          settings: { onboardingSeen: true, activeGuideSeen: true, launchCount: 10 },
          sessions: old,
          active: null,
        }),
      );
  }, fixtures.old);
  await page.goto("/");
  await page.locator("#quickStart").scrollIntoViewIfNeeded();
  await tap(page, "#quickStart");
  await settled(page);
  const point = await page.locator("#tgsvg").evaluate((el) => {
    const p = el.createSVGPoint();
    p.x = 3.2;
    p.y = 0;
    const t = p.matrixTransform(el.getScreenCTM());
    return { x: t.x, y: t.y, clear: el.contains(globalThis.document.elementFromPoint(t.x, t.y)) };
  });
  expect(point.clear).toBe(true);
  await page.touchscreen.tap(point.x, point.y);
  await expect.poll(async () => (await stored(page)).active.cur.length).toBe(1);
  const active = (await stored(page)).active;
  expect(active.cur[0].s).toBe(9);
  await tap(page, "#bFinish");
  await expect(page.getByTestId("todays-result-stability-pending")).toContainText("1本の座標");
  await settled(page);
  await page.screenshot({ path: testInfo.outputPath("native-summary.png") });
  await page.locator("#sumClose").scrollIntoViewIfNeeded();
  await tap(page, "#sumClose");
  await tap(page, '#tabs [data-v="analysis"]');
  await expect(page.getByTestId("growth-dashboard")).toContainText("比較待ち");
  await expect(page.getByTestId("today-conclusion")).toContainText("比較は保留");
  await settled(page);
  await page.screenshot({ path: testInfo.outputPath("native-analysis.png") });
  const after = await stored(page);
  expect(after.sessions.slice(0, 3)).toEqual(fixtures.old);
  const current = after.sessions.at(-1);
  expect(current.ends).toEqual([active.cur]);
  await tap(page, '#tabs [data-v="history"]');
  await page.locator(`.historyRow[data-id="${current.id}"]`).click();
  const text = await page.locator(".ovl").last().innerText();
  expect(text).toContain("グルーピングの比較は保留");
  expect(text).not.toContain("グルーピングは良好");
  await tap(page, "#hClose");
  await page.reload();
  expect((await stored(page)).sessions).toEqual(after.sessions);
  expect(errors).toEqual([]);
  await testInfo.attach("native-saved", {
    body: JSON.stringify({ point, active, after, history: text, errors }),
    contentType: "application/json",
  });
});
