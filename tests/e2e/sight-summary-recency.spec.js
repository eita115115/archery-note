const { test, expect } = require("@playwright/test");
const { sightRecencyDb } = require("./fixtures/sight-recency-db");
test.use({ hasTouch: true });
async function seed(page, data = sightRecencyDb()) {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00+09:00"));
  await page.addInitScript((data) => {
    if (!globalThis.localStorage.getItem("archeryNote.v1"))
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(data));
  }, data);
  await page.goto("/");
}
async function snapshot(page) {
  return page.evaluate(() => {
    const d = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
    return [d.sessions, d.setups, d.sightMarks, d.active, d.customRounds, d.formAnalyses];
  });
}
/* v5 段 7: 「サイト値のまとめ」は 分析 から 弓具 > サイト へ移した。対象は、その画面で選んでいる弓具の全距離 */
async function summary(page, setup = "a", dist = "30") {
  await page.locator('#tabs [data-v="gear"]').tap();
  await page.getByTestId("gear-subtab-sight").tap();
  await page.locator("#sgSetup").selectOption(setup);
  const control = page
    .getByTestId("sight-records-overview")
    .locator("summary")
    .filter({ hasText: "サイト値のまとめ" });
  await control.scrollIntoViewIfNeeded();
  await control.tap();
  const details = control.locator("..");
  await expect(details).toHaveAttribute("open", "");
  const row = details
    .locator(".listItem")
    .filter({ has: page.getByText(`${dist}m`, { exact: true }) });
  await row.locator(".big").scrollIntoViewIfNeeded();
  await expect(row.locator(".big")).toBeVisible();
  return row.locator(".big");
}
for (const width of [320, 375, 900]) {
  test(`same-day summary uses newer recorded time (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await seed(page);
    const before = await snapshot(page);
    await expect(await summary(page)).toHaveText(["90 / 左右0.4"]);
    await page.locator('#sgDistChips [data-d="30"]').tap();
    await expect(page.locator("[data-sight-id]").first()).toHaveAttribute("data-sight-id", "newer");
    await expect(page.locator("[data-sight-id]").first().locator("dd")).toHaveText(["90", "0.4"]);
    await page.locator('#tabs [data-v="record"]').tap();
    await page.getByTestId("record-conditions").tap();
    await page.locator("details.recordDetails summary").tap();
    await page.locator("#fSetup").selectOption("a");
    await page.locator('#fDistChips [data-d="30"]').tap();
    await expect(page.locator("#fSightV")).toHaveValue("90");
    expect(await snapshot(page)).toEqual(before);
    await page.reload();
    expect(await snapshot(page)).toEqual(before);
  });
}
test("summary preserves date priority, ambiguous fallback, sessions and raw values", async ({
  page,
}) => {
  await seed(page);
  const data = sightRecencyDb(),
    newer = data.sightMarks[0],
    older = data.sightMarks[1];
  const cases = [
    { rows: [older, newer], v: "90" },
    { rows: [newer, older], v: "90" },
    { rows: [{ ...newer, date: "2026-10-12" }, older], v: "80" },
    { rows: [newer, { ...older, ts: newer.ts }], v: "80" },
    { rows: [newer, { ...older, ts: null }], v: "80" },
    { rows: [newer, { ...older, ts: "bad" }], v: "80" },
    {
      rows: [
        { ...newer, date: "", ts: null },
        { ...older, date: "", ts: null },
      ],
      v: "80",
    },
    { rows: [{ ...newer, v: "" }, older], v: "—" },
    { rows: [{ ...newer, v: 0 }, older], v: "0" },
    { rows: [{ ...newer, v: "0" }, older], v: "0" },
  ];
  const results = await page.evaluate(
    (cases) =>
      cases.map((c) => {
        const original = JSON.stringify(c.rows),
          holder = globalThis.document.createElement("div");
        holder.innerHTML = globalThis.sightSummaryHtml([], { setupId: "a", dist: "30" }, c.rows);
        return {
          text: holder.querySelector(".big").textContent,
          unchanged: JSON.stringify(c.rows) === original,
        };
      }),
    cases,
  );
  expect(results).toEqual(cases.map((c) => ({ text: c.v + " / 左右0.4", unchanged: true })));
  const mixed = await page.evaluate(
    (rows) => {
      const session = { date: rows[0].date, setupId: "a", dist: 30, sightV: "777", sightH: "8" };
      const holder = globalThis.document.createElement("div");
      holder.innerHTML = globalThis.sightSummaryHtml(
        [{ s: session }],
        { setupId: "a", dist: "30" },
        rows,
      );
      return holder.querySelector(".big").textContent;
    },
    [newer, older],
  );
  expect(mixed).toBe("90 / 左右0.4");
});
test("summary keeps the selected setup and lists each distance", async ({ page }) => {
  await seed(page);
  const before = await snapshot(page);
  await expect(await summary(page, "b", "30")).toHaveText(["900 / 左右0.4"]);
  await expect(await summary(page, "a", "18")).toHaveText(["40 / 左右0.4"]);
  await expect(await summary(page)).toHaveText(["90 / 左右0.4"]);
  /* 分析タブには、サイトの記録への入口だけを置く */
  await page.locator('#tabs [data-v="analysis"]').tap();
  await expect(page.locator("#main summary").filter({ hasText: "サイト値のまとめ" })).toHaveCount(
    0,
  );
  expect(await snapshot(page)).toEqual(before);
});
test("restoring an older same-day mark keeps newer analysis value", async ({ page }) => {
  await seed(page);
  const before = await snapshot(page);
  await page.locator('#tabs [data-v="gear"]').tap();
  await page.getByTestId("gear-subtab-sight").tap();
  await page.locator('#sgDistChips [data-d="30"]').tap();
  await page.locator('[data-del="older"]').tap();
  await page.locator("#acOk").tap();
  // v5: 設定（ゴミ箱からの復元）の入口は記録タブの見出し行だけにある
  await page.locator('#tabs [data-v="record"]').tap();
  await page.getByRole("button", { name: "設定", exact: true }).tap();
  await page.locator("[data-restore-trash]").scrollIntoViewIfNeeded();
  await page.locator("[data-restore-trash]").tap();
  await page.locator("#setClose").tap();
  const restored = await snapshot(page);
  expect([...restored[2]].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
    [...before[2]].sort((a, b) => a.id.localeCompare(b.id)),
  );
  for (const i of [0, 1, 3, 4, 5]) expect(restored[i]).toEqual(before[i]);
  await expect(await summary(page)).toHaveText(["90 / 左右0.4"]);
  await page.reload();
  expect(await snapshot(page)).toEqual(restored);
});
