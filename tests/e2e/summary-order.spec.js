/* global db, render, save, scoreAt, lineCutRadius */
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

async function prepare(page, mode) {
  await page.goto("/");
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  await page.locator('#tabs [data-v="record"]').click();
  await page.getByRole("button", { name: "18m", exact: true }).click();
  await page.getByRole("combobox", { name: "的", exact: true }).selectOption("40");
  await page.getByRole("combobox", { name: "1エンドの本数", exact: true }).selectOption("6");
  await page.getByTestId("record-start").click();
  // Owned synthetic coordinates use the app's radius/scoring contract.
  await page.evaluate((mode) => {
    const s = db.active;
    s.id = "owned-summary-order";
    s.ends = [
      [
        [1, 0],
        [-2, 1],
        [3, -1],
        [4, 2],
        [-5, -2],
        [6, 3],
      ].map(([x, y]) => ({
        x,
        y,
        ...scoreAt(x, y, s.faceD, s.faceType, lineCutRadius(s.faceD, s.faceType)),
      })),
    ];
    s.cur = [];
    db.settings.activeGuideSeen = true;
    if (mode === "first") db.sessions = [];
    if (mode === "gam-round") {
      db.settings.gamification.enabled = true;
      s.roundGroup = { gid: "owned-summary-round", roundId: "wa1440_men", stage: 3, stageCount: 4 };
    }
    if (mode === "edit") {
      const existing = JSON.parse(JSON.stringify(s));
      delete existing.cur;
      db.sessions.push(existing);
      s._edit = true;
    }
    save({ reason: "owned-summary-order-fixture" });
    render();
  }, mode);
  return page.evaluate(() => ({ sessions: db.sessions, active: db.active }));
}

async function positions(page) {
  return page.locator(".ovl .sheet").evaluate((sheet) => {
    const nodes = Array.from(sheet.children),
      stats = sheet.querySelector(".statbar"),
      decision = sheet.querySelector(".decisionCard"),
      comparison = sheet.querySelector(".summaryTodaysResult");
    const r = stats.getBoundingClientRect();
    return {
      stats: nodes.indexOf(stats),
      decision: nodes.indexOf(decision),
      comparison: nodes.indexOf(comparison),
      statsTop: r.top,
      statsBottom: r.bottom,
      sheetTop: sheet.getBoundingClientRect().top,
      viewport: globalThis.innerHeight,
    };
  });
}

for (const width of [320, 375]) {
  for (const theme of ["light", "dark"]) {
    test(`finished summary shows results first (${width}, ${theme})`, async ({
      page,
    }, testInfo) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const before = await prepare(page, "compare");
      const expected = before.active.ends.flat().reduce((n, a) => n + a.s, 0);
      await page.getByTestId("active-finish").click();
      await settle(page);
      await page.screenshot({
        path: testInfo.outputPath(`summary-order-${width}-${theme}.png`),
        animations: "disabled",
      });
      const stats = page.locator(".ovl .statbar");
      await expect(stats).toContainText(`合計 (6本)`);
      await expect(stats.locator(".stat b").first()).toHaveText(String(expected));
      await expect(page.getByTestId("todays-result-weekly")).toBeVisible();
      const p = await positions(page);
      expect(p.stats).toBeLessThan(p.decision);
      expect(p.comparison).toBeLessThan(p.decision);
      expect(p.statsTop).toBeGreaterThanOrEqual(p.sheetTop);
      expect(p.statsBottom).toBeLessThanOrEqual(p.viewport - 8);
      await expect(page.locator(".ovl .decisionCard")).toHaveCount(1);
      await expect(page.locator("#sumPlot svg")).toHaveCount(1);
      await page.locator("#sumClose").click();
      await expect(page.locator(".ovl")).toHaveCount(0);
      const stored = await page.evaluate(() =>
        JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")),
      );
      expect(stored.active).toBeNull();
      expect(stored.sessions.filter((s) => s.id !== before.active.id)).toEqual(before.sessions);
      expect(stored.sessions.find((s) => s.id === before.active.id).ends).toEqual(
        before.active.ends,
      );
      await page.reload();
      expect(await page.evaluate(() => db.sessions)).toEqual(stored.sessions);
      expect(errors).toEqual([]);
    });
  }
}

for (const mode of ["first", "gam-round", "edit"]) {
  test(`summary keeps its existing optional content (${mode})`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const before = await prepare(page, mode);
    await page.getByTestId("active-finish").click();
    await settle(page);
    const p = await positions(page);
    expect(p.stats).toBeLessThan(p.decision);
    await expect(page.locator(".ovl .decisionCard")).toHaveCount(1);
    if (mode === "first")
      await expect(page.getByTestId("todays-result-empty")).toContainText("初回記録");
    if (mode === "gam-round") {
      await expect(page.getByTestId("summary-gamification")).toHaveCount(1);
      await expect(page.locator(".ovl .recordNeutralAdvice")).toContainText("1/4ステージ");
    }
    if (mode === "edit") {
      await expect(page.locator(".summaryTodaysResult")).toHaveCount(0);
      await expect(page.getByTestId("summary-gamification")).toHaveCount(0);
      expect(await page.evaluate(() => db.sessions)).toEqual(before.sessions);
    }
    await page.locator("#sumClose").click();
    await expect(page.locator(".ovl")).toHaveCount(0);
  });
}
