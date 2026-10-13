/* global db */
const { test, expect } = require("@playwright/test");
const { sightProvenanceDb } = require("./fixtures/sight-provenance-db");
test.use({ hasTouch: true, reducedMotion: "reduce" });
async function seed(page, data = sightProvenanceDb()) {
  await page.clock.setFixedTime(new Date("2026-10-14T12:00:00+09:00"));
  await page.addInitScript((data) => {
    if (!globalThis.localStorage.getItem("archeryNote.v1"))
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(data));
  }, data);
  await page.goto("/");
  await page.locator('#tabs [data-v="sight"]').tap();
  await page.locator('#sgDistChips [data-d="30"]').tap();
}
async function snapshot(page) {
  return page.evaluate(() => {
    const d = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
    return [d.sessions, d.setups, d.sightMarks, d.active, d.customRounds, d.formAnalyses];
  });
}
async function prediction(page) {
  const control = page.locator("summary").filter({ hasText: "サイト値分析・予測" });
  await control.scrollIntoViewIfNeeded();
  await control.tap();
  await expect(control.locator("..")).toHaveAttribute("open", "");
  return page.locator('[data-testid="sight-prediction"]');
}
for (const width of [320, 375, 900]) {
  test(`prediction shows values and adopted record dates (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await seed(page);
    const before = await snapshot(page),
      panel = await prediction(page);
    await expect(panel.locator("[data-predict-dist] dd")).toHaveText([
      "146.7目盛り",
      "213.3目盛り",
    ]);
    const details = panel.locator("details.sightSources"),
      summary = details.locator("summary");
    await expect(details).not.toHaveAttribute("open");
    const arrow = () =>
      summary.evaluate(
        (el) =>
          new globalThis.DOMMatrixReadOnly(globalThis.getComputedStyle(el, "::before").transform).b,
      );
    await expect.poll(arrow).toBeLessThan(0);
    await summary.tap();
    await expect.poll(arrow).toBeGreaterThan(0);
    await expect(panel.locator('[data-source-id="measured30"]')).toContainText("2026/10/13");
    await expect(panel.locator('[data-source-id="measured30"]')).toContainText("80");
    await expect(panel.locator('[data-source-id="measured30"]')).toContainText(
      "新しい記録に数値なし",
    );
    await expect(panel.locator('[data-source-id="measured18"]')).toContainText("2026/10/12");
    await summary.focus();
    await page.keyboard.press("Space");
    await expect(details).not.toHaveAttribute("open");
    await expect.poll(arrow).toBeLessThan(0);
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("open");
    await expect.poll(arrow).toBeGreaterThan(0);
    await expect(summary).toBeFocused();
    const help = panel.locator("details.sightPredictionHelp"),
      helpSummary = help.locator("summary"),
      helpArrow = () =>
        helpSummary.evaluate(
          (el) =>
            new globalThis.DOMMatrixReadOnly(globalThis.getComputedStyle(el, "::before").transform)
              .b,
        );
    await expect.poll(helpArrow).toBeLessThan(0);
    await helpSummary.tap();
    await expect(help).toHaveAttribute("open");
    await expect.poll(helpArrow).toBeGreaterThan(0);
    const geometry = await panel.evaluate((el) => ({
      overflow:
        el.scrollWidth > el.clientWidth ||
        globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
      short: [...el.querySelectorAll("summary")].some((e) => e.getBoundingClientRect().height < 44),
    }));
    expect(geometry).toEqual({ overflow: false, short: false });
    expect(await snapshot(page)).toEqual(before);
    await page.reload();
    expect(await snapshot(page)).toEqual(before);
  });
}
test("source metadata preserves point order, identity, zero and raw distance keys", async ({
  page,
}) => {
  await seed(page);
  const before = await snapshot(page);
  const result = await page.evaluate(() => {
    const old = db.sightMarks;
    try {
      const marks = [
        { id: "18", setupId: "a", dist: 18, v: 0, date: "2026-10-12", ts: 1 },
        { id: "030", setupId: "a", dist: "030", v: "70 extra", date: "2026-10-13", ts: 2 },
        { id: "30", setupId: "a", dist: 30, v: "80", date: "2026-10-13", ts: 3 },
        { id: "blank", setupId: "a", dist: 30, v: "", date: "2026-10-14", ts: 4 },
      ];
      const original = JSON.stringify(marks);
      db.sightMarks = marks;
      const p = globalThis.sightInterp("a");
      const el = globalThis.document.createElement("div");
      el.innerHTML = globalThis.sightPredictionHtml(p, marks);
      return {
        countLabel: el.querySelector(".sightSources summary").textContent,
        pts: p.pts,
        ids: p.sources?.map((m) => m.id),
        identity: p.sources?.every((m) => marks.includes(m)),
        unchanged: JSON.stringify(marks) === original,
      };
    } finally {
      db.sightMarks = old;
    }
  });
  expect(result).toEqual({
    countLabel: "採用した実測 3件",
    pts: [
      [18, 0],
      [30, 80],
      [30, 70],
    ],
    ids: ["18", "30", "030"],
    identity: true,
    unchanged: true,
  });
  expect(await snapshot(page)).toEqual(before);
});
test("ambiguous ledger dates do not claim latest and display remains escaped", async ({ page }) => {
  await seed(page);
  const results = await page.evaluate(() => {
    const a = {
        id: '<img src=x onerror="alert(1)">',
        date: "2026-10-14",
        ts: 100,
        v: "80",
        h: "0",
        note: "<img src=x>",
      },
      cases = [
        [a, { ...a, id: "b", v: "90" }],
        [
          { ...a, ts: undefined },
          { ...a, id: "b", ts: undefined },
        ],
        [{ ...a, date: "" }],
        [
          { ...a, ts: 200 },
          { ...a, id: "b", ts: 100 },
        ],
      ];
    return cases.map((marks) => {
      const el = globalThis.document.createElement("div");
      el.innerHTML = globalThis.sightLedgerHtml(marks);
      return {
        badge: el.querySelector(".sightMarkLatest")?.textContent,
        images: el.querySelectorAll("img").length,
      };
    });
  });
  const uncertain = await page.evaluate(() => {
    const old = db.sightMarks;
    try {
      db.sightMarks = [
        { id: "blank", setupId: "a", dist: 30, date: "2026-10-14", ts: 100, v: "" },
        { id: "value", setupId: "a", dist: 30, date: "2026-10-14", ts: 100, v: "80" },
        { id: "near", setupId: "a", dist: 18, date: "2026-10-13", ts: 50, v: "40" },
      ];
      const el = globalThis.document.createElement("div");
      el.innerHTML = globalThis.sightPredictionHtml(globalThis.sightInterp("a"), db.sightMarks);
      const tied = el.querySelector('[data-source-id="value"]').textContent;
      db.sightMarks[0].date = "";
      db.sightMarks[0].ts = 200;
      db.sightMarks[1].date = "";
      el.innerHTML = globalThis.sightPredictionHtml(globalThis.sightInterp("a"), db.sightMarks);
      return [tied, el.querySelector('[data-source-id="value"]').textContent];
    } finally {
      db.sightMarks = old;
    }
  });
  expect(uncertain[0]).toContain("同じ日時の候補が複数あります");
  expect(uncertain[1]).toContain("日付不明の記録を含みます");
  for (const text of uncertain) {
    expect(text).toContain("数値のある記録から採用");
    expect(text).not.toContain("新しい記録");
  }
  expect(results).toEqual([
    { badge: "同日時の記録あり", images: 0 },
    { badge: "同日・時刻不明", images: 0 },
    { badge: "順序未確定", images: 0 },
    { badge: "最新", images: 0 },
  ]);
});
test("prediction keeps setup scope, disappears below two distances and handles all measured", async ({
  page,
}) => {
  await seed(page);
  const before = await snapshot(page);
  await page.locator("#sgSetup").selectOption("b");
  await expect(page.locator('[data-testid="sight-prediction"]')).toHaveCount(0);
  await page.locator("#sgSetup").selectOption("a");
  await page.locator("#sgAdd").tap();
  await page.locator("#mkCancel").tap();
  await page.locator("#sgCalMode").tap();
  await page.locator("#calCancel").tap();
  expect(await snapshot(page)).toEqual(before);
  await page.evaluate(() => {
    db.sightMarks = [18, 30, 50, 70].map((dist, i) => ({
      id: "all" + i,
      setupId: "a",
      dist,
      v: String(dist === 70 ? 100 : 0),
      h: "0",
      date: "2026-10-14",
      ts: i + 1,
    }));
    globalThis.render();
  });
  const panel = await prediction(page);
  await expect(panel.locator("[data-predict-dist]")).toHaveCount(0);
  await expect(panel).toContainText("カーブ近似");
  await expect(panel).toContainText("定番距離");
  await panel.locator("details.sightSources summary").tap();
  await expect(panel.locator("[data-source-id]")).toHaveCount(4);
});
