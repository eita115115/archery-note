const { test, expect } = require("@playwright/test");

test.use({ hasTouch: true });
const groups = [
  "analysis-condition-details",
  "analysis-breakdown-details",
  "analysis-personal-details",
];

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
  test(`analysis details keep comparisons available without a long default list (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page);
    await page.goto("/");
    const before = await practice(page);
    await page.locator('#tabs [data-v="analysis"]').tap();
    for (const id of groups) {
      const group = page.getByTestId(id);
      await expect(group).toHaveCount(1);
      expect(await group.evaluate((el) => el.open)).toBe(false);
      const summary = group.locator(":scope > summary");
      expect(
        await summary.evaluate((el) => el.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(64);
      await summary.tap();
      await expect.poll(() => group.evaluate((el) => el.open)).toBe(true);
    }
    const breakdown = page.getByTestId("analysis-breakdown-details");
    await expect(breakdown.getByRole("heading", { name: /月ごとのまとめ/ })).toBeVisible();
    await expect(breakdown.getByRole("heading", { name: /距離ごとの調子/ })).toBeVisible();
    await expect(breakdown.getByRole("heading", { name: /得点の内訳/ })).toBeVisible();
    await expect(breakdown.locator(".tbl th").last()).toHaveText("平均点");
    expect(await breakdown.locator(".tbl td b").allTextContents()).toEqual(["8.50", "8.50"]);
    await expect(breakdown.locator(".histTrendSub").first()).toHaveText("点/本 · 最新");
    expect(
      await breakdown
        .locator(".histTrendSub")
        .evaluateAll((els) =>
          els.every(
            (el) => el.getBoundingClientRect().height <= 18 && el.scrollWidth <= el.clientWidth,
          ),
        ),
    ).toBe(true);
    await expect(
      page
        .getByTestId("analysis-condition-details")
        .getByRole("heading", { name: /風の有無で比べる/ }),
    ).toBeVisible();
    await expect(
      page.getByTestId("analysis-personal-details").getByRole("heading", { name: /自己ベスト/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    ).toBe(true);
    await breakdown.locator(":scope > summary").tap();
    await expect.poll(() => breakdown.evaluate((el) => el.open)).toBe(false);
    await expect(breakdown.getByRole("heading", { name: /月ごとのまとめ/ })).toBeHidden();
    await page.locator('[data-period="7d"]').tap();
    for (const id of groups) {
      const group = page.getByTestId(id);
      expect(await group.evaluate((el) => el.open)).toBe(false);
    }
    await page.locator("#anSetup").selectOption("detail-a");
    await page.locator("#anDist").selectOption("18");
    for (const id of groups) await expect(page.getByTestId(id)).toHaveCount(0);
    await page.locator("#anSetup").selectOption("");
    await page.locator("#anDist").selectOption("");
    await page.locator('[data-period="all"]').tap();
    for (const id of groups) await expect(page.getByTestId(id)).toHaveCount(1);
    expect(await practice(page)).toEqual(before);
    await page.reload();
    expect(await practice(page)).toEqual(before);
  });
}

for (const key of ["Enter", "Space"]) {
  test(`analysis detail summaries retain native ${key} and focus`, async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await page.locator('#tabs [data-v="analysis"]').click();
    const group = page.getByTestId("analysis-breakdown-details"),
      summary = group.locator(":scope > summary");
    await summary.focus();
    await summary.press(key);
    await expect.poll(() => group.evaluate((el) => el.open)).toBe(true);
    await expect(summary).toBeFocused();
    await summary.press(key);
    await expect.poll(() => group.evaluate((el) => el.open)).toBe(false);
    await expect(summary).toBeFocused();
  });
}

test("empty analysis does not offer empty detail groups", async ({ page }) => {
  await seed(page, true);
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  for (const id of groups) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "記録タブへ", exact: true })).toBeVisible();
});
