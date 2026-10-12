const { test, expect } = require("@playwright/test");
const { analysisFormDb } = require("./fixtures/analysis-form-db");
test.use({ hasTouch: true });
async function seed(page, onlyForm = false) {
  const d = analysisFormDb();
  if (onlyForm) d.sessions = [];
  await page.addInitScript((d) => {
    if (!globalThis.localStorage.getItem("archeryNote.v1"))
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(d));
  }, d);
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').tap();
}
async function snapshot(page) {
  return page.evaluate(() => {
    const d = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
    return [d.sessions, d.setups, d.sightMarks, d.active, d.customRounds, d.formAnalyses];
  });
}
async function ids(page) {
  return page.evaluate(() => analysisFormRecords(ui.analysisFilter).map((r) => r.id));
}
test("form analysis follows capture period and linked equipment/distance", async ({ page }) => {
  await seed(page);
  const before = await snapshot(page);
  await page.locator('[data-period="7d"]').tap();
  await page.locator("#anSetup").selectOption("a");
  await page.locator("#anDist").selectOption("30");
  const card = page
    .locator(".card")
    .filter({ has: page.getByRole("heading", { name: /射形トラッキング/ }) });
  expect(
    await card
      .locator("[data-form-id]")
      .evaluateAll((els) => els.map((e) => e.dataset.formId).sort()),
  ).toEqual(["form-0", "form-12", "form-13", "form-2", "form-3"]);
  expect(await ids(page)).toEqual(["form-0", "form-2", "form-3", "form-12", "form-13"]);
  await expect(card.locator("svg title")).toContainText("5回");
  await expect(card).toContainText("練習に紐付いた 5 記録");
  await page.locator("#anDist").selectOption("");
  expect(await ids(page)).toContain("form-9");
  await page.locator("#anSetup").selectOption("b");
  expect(await ids(page)).toEqual(["form-1", "form-10"]);
  await expect(card.locator("svg")).toHaveCount(0);
  await page.locator("#anSetup").selectOption("__none");
  expect(await ids(page)).toEqual(["form-14"]);
  await page.locator("#anSetup").selectOption("a");
  await page.locator("#anDist").selectOption("18");
  await expect(card).toContainText("この条件に合う射形記録はありません");
  await expect(card.locator("[data-form-id]")).toHaveCount(0);
  await page.locator("#anSetup").selectOption("");
  await page.locator("#anDist").selectOption("");
  for (const [period, included, excluded] of [
    ["7d", "form-3", "form-4"],
    ["30d", "form-5", "form-6"],
    ["90d", "form-7", "form-8"],
  ]) {
    await page.locator(`[data-period="${period}"]`).tap();
    const selected = await ids(page);
    expect(selected).toContain(included);
    expect(selected).not.toContain(excluded);
    expect(selected).not.toContain("form-11");
    expect(selected).toContain("form-12");
  }
  await page.locator('[data-period="all"]').tap();
  expect(await ids(page)).toHaveLength(15);
  expect(await snapshot(page)).toEqual(before);
  await page.reload();
  expect(await snapshot(page)).toEqual(before);
});
test("form-only records still expose the shared period controls", async ({ page }) => {
  await seed(page, true);
  await expect(page.locator("#anPeriods")).toBeVisible();
  await page.locator('[data-period="7d"]').tap();
  expect(await ids(page)).not.toContain("form-4");
  await page.locator("#anSetup").selectOption("a");
  expect(await ids(page)).toEqual(["form-0", "form-2", "form-3", "form-9", "form-12", "form-13"]);
});
for (const width of [320, 375, 900]) {
  test(`form records expose readable values and safe detail actions (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    const before = await snapshot(page);
    const card = page.getByTestId("analysis-form-card");
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator("[data-form-id]")).toHaveCount(5);
    const help = card.locator("details");
    expect(await help.evaluate((e) => e.open)).toBe(false);
    await help.locator("summary").tap();
    await expect(help).toContainText("撮影日");
    await help.locator("summary").tap();
    const first = card.locator("[data-form-id]").first();
    await expect(first).toContainText("弓手肘");
    await expect(first).toContainText("引き手肘");
    await first.tap();
    await expect(page.locator("#fdClose")).toBeVisible();
    await page.locator("#fdClose").tap();
    await card.locator("[data-del-form]").first().tap();
    await page.getByRole("button", { name: "キャンセル", exact: true }).tap();
    const layout = await card.evaluate((el) => ({
      overflow: el.scrollWidth > el.clientWidth,
      textOverflow: [
        ...el.querySelectorAll(".formRecordItem, .formRecordAngles, .formRecordComparison"),
      ].some((e) => e.scrollWidth > e.clientWidth),
      short: [...el.querySelectorAll("button")].some((e) => e.getBoundingClientRect().height < 44),
    }));
    expect(layout).toEqual({ overflow: false, textOverflow: false, short: false });
    expect(await snapshot(page)).toEqual(before);
    await page.reload();
    expect(await snapshot(page)).toEqual(before);
  });
}
