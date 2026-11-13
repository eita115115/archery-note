const { test, expect } = require("@playwright/test");

test.use({ hasTouch: true });
/* v5 段 7: 旧「条件と理由」「練習の内訳」「自己ベストと用具」の開閉グループは廃止。
   内訳は 分析 > スコア に見出しつきで並べ、外れた理由の印は 分析 > 射型 に置く。 */
async function seed(page, empty = false) {
  await page.addInitScript((empty) => {
    if (globalThis.localStorage.getItem("archeryNote.v1")) return;
    const date = (ago) => {
      const d = new Date();
      d.setDate(d.getDate() - ago);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    globalThis.localStorage.setItem(
      "archeryNote.v1",
      JSON.stringify({
        schema: 5,
        settings: { onboardingSeen: true, launchCount: 10 },
        setups: [
          { id: "detail-a", name: "屋外リカーブ" },
          { id: "detail-b", name: "室内リカーブ" },
        ],
        sessions: empty
          ? []
          : [9, 8, 7, 10].map((score, i) => ({
              id: `owned-detail-${i}`,
              date: date([0, 1, 32, 33][i]),
              setupId: i % 2 ? "detail-b" : "detail-a",
              dist: i % 2 ? 18 : 30,
              faceD: 40,
              faceType: "single",
              round: "free",
              perEnd: 3,
              windSpeed: i % 2 ? "4" : "0",
              ends: [
                [-0.2, 0, 0.2].map((offset) => ({
                  x: (10 - score) * 2 + 1 + offset,
                  y: 0,
                  s: score,
                  reason: i % 2 ? "リリース" : "押し手",
                })),
              ],
            })),
        sightMarks: [],
        active: null,
        customRounds: [],
        formAnalyses: [],
      }),
    );
  }, empty);
}

async function practice(page) {
  return page.evaluate(() => {
    const d = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
    return {
      sessions: d.sessions,
      setups: d.setups,
      sightMarks: d.sightMarks,
      active: d.active,
      customRounds: d.customRounds,
      formAnalyses: d.formAnalyses,
    };
  });
}

for (const width of [320, 375, 900]) {
  test(`score analysis lists its breakdowns with targets and no collapsed groups (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    await page.goto("/");
    const before = await practice(page);
    await page.locator('#tabs [data-v="analysis"]').tap();
    await expect(page.locator("#main details")).toHaveCount(0);
    /* 最新の記録の条件（30m・40cm的・3射）が選ばれる。同じ条件は 2回 */
    await expect(page.locator("#anCond option:checked")).toHaveText("30m・40cm的・3射");
    await expect(page.getByTestId("analysis-target")).toContainText("30m・40cm的・3射、2回・6射");
    await expect(page.locator('[data-testid="analysis-score"] [data-fig="mean"] .n')).toHaveText(
      "24.0",
    );
    await expect(page.locator('[data-testid="analysis-score"] [data-fig="best"] .n')).toHaveText(
      "27",
    );
    /* 2回では傾向の文を出さない */
    await expect(page.getByTestId("analysis-trend")).toHaveCount(0);
    await expect(page.getByTestId("analysis-trend-pending")).toContainText("いまは 2回");
    /* 条件ごとの記録（全条件）と月ごとのまとめ */
    await expect(page.getByTestId("analysis-cond-row")).toHaveCount(2);
    const monthly = page.getByTestId("analysis-monthly");
    await expect(monthly.getByRole("heading", { name: "月ごとのまとめ" })).toBeVisible();
    await expect(monthly.locator(".tbl th").last()).toHaveText("1射平均");
    expect(await monthly.locator(".tbl td b").allTextContents()).toEqual(["8.50", "8.50"]);
    /* 旧カードは出さない */
    for (const name of ["距離ごとの調子", "自己ベスト", "用具ごとの成績", "直近の得点"])
      await expect(page.locator("#main")).not.toContainText(name);
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    ).toBe(true);
    /* 期間を 7日にすると、30m は 1回になる。選んだ条件は欄に残る */
    await page.locator("#anPeriod").selectOption("7d");
    await expect(page.getByTestId("analysis-target")).toContainText("1回・3射");
    await expect(page.getByTestId("analysis-target")).toContainText("期間は直近7日");
    await page.locator("#anSetup").selectOption("detail-b");
    await expect(page.getByTestId("analysis-score-none")).toContainText("0回");
    await expect(page.locator("#anCond option:checked")).toHaveText("30m・40cm的・3射");
    await page.locator("#anSetup").selectOption("");
    await page.locator("#anPeriod").selectOption("all");
    await expect(page.getByTestId("analysis-target")).toContainText("2回・6射");
    /* 外れた理由の印は 射型 に、対象つきで出る */
    await page.locator('#analysisSubTabs [data-an="form"]').tap();
    const reasons = page.getByTestId("analysis-reasons");
    await expect(reasons).toContainText("対象: 4回・12射のうち、理由の印がある 12射。");
    await expect(reasons.getByTestId("analysis-reason-row")).toHaveCount(2);
    expect(await practice(page)).toEqual(before);
    await page.reload();
    expect(await practice(page)).toEqual(before);
  });
}

test("wind split appears only with two or more sessions on each side, as plain differences with n", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  /* 30m の 2回は風なし、18m の 2回は風あり。同じ条件の中に両方が 2回ずつ無いので出さない */
  await page.locator('#tabs [data-v="analysis"]').click();
  await expect(page.getByTestId("analysis-wind-split")).toHaveCount(0);
  /* 18m の 2回を 30m にそろえ、風ありを 2回にする */
  await page.evaluate(() => {
    const d = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
    d.sessions.forEach((s) => (s.dist = 30));
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(d));
  });
  await page.reload();
  await page.locator('#tabs [data-v="analysis"]').click();
  const wind = page.getByTestId("analysis-wind-split");
  await expect(wind.locator('[data-wind="calm"] .lv')).toContainText("平均 24.0 点");
  await expect(wind.locator('[data-wind="calm"] .lv')).toContainText("2回・6射");
  await expect(wind.locator('[data-wind="windy"] .lv')).toContainText("平均 27.0 点");
  await expect(wind.locator('[data-wind="diff"] .lv')).toHaveText("+3.0 点");
  await expect(wind).toContainText("差が風によるものとは限りません");
});

test("empty analysis offers no selectors and one route to the record tab", async ({ page }) => {
  await seed(page, true);
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await expect(page.locator("#main select")).toHaveCount(0);
  await expect(page.locator("#main details")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "記録タブへ", exact: true })).toBeVisible();
});
