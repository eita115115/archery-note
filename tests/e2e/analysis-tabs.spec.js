"use strict";
const { test, expect } = require("@playwright/test");
const {
  BANNED,
  gotoSubTab,
  homeResultDb,
  openAnalysis,
  richAnalysisDb,
  stored,
  subTab,
} = require("./analysis-helpers");

/* v5 段 7: 分析タブの4つの下線タブ（スコア / 着弾 / 比較 / 射型）。 */
test.use({ hasTouch: true, isMobile: true, serviceWorkers: "block" });

const TABS = [
  ["score", "スコア"],
  ["impact", "着弾"],
  ["compare", "比較"],
  ["form", "射型"],
];

test("sub-tabs switch the view, carry aria-current, and are remembered while the app stays open", async ({
  page,
}) => {
  const data = richAnalysisDb();
  const errors = await openAnalysis(page, data);
  const nav = page.locator("#analysisSubTabs");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button")).toHaveText(TABS.map((t) => t[1]));
  await expect(subTab(page, "score")).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#viewTitle")).toHaveText("分析");
  for (const [id] of TABS) {
    await gotoSubTab(page, id);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(subTab(page, id)).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => globalThis.scrollY)).toBe(0);
  }
  /* ほかのタブへ移って戻っても、選んでいた下線タブのまま */
  await gotoSubTab(page, "compare");
  await page.locator('#tabs [data-v="history"]').click();
  await expect(nav).toBeHidden();
  await page.locator('#tabs [data-v="analysis"]').click();
  await expect(subTab(page, "compare")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("compare-table")).toBeVisible();
  /* 記録・弓具では出さない */
  await page.locator('#tabs [data-v="gear"]').click();
  await expect(nav).toBeHidden();
  await expect(page.locator("#gearSubTabs")).toBeVisible();
  /* 読み込み直すと スコア に戻る（保存しない） */
  await page.reload();
  await page.locator('#tabs [data-v="analysis"]').click();
  await expect(subTab(page, "score")).toHaveAttribute("aria-current", "page");
  expect((await stored(page)).sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("sub-tabs work from the keyboard and keep focus on the pressed tab", async ({ page }) => {
  await openAnalysis(page, richAnalysisDb());
  await subTab(page, "impact").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("analysis-view")).toHaveAttribute("data-tab", "impact");
  await expect(subTab(page, "impact")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(subTab(page, "compare")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("analysis-view")).toHaveAttribute("data-tab", "compare");
  await expect(subTab(page, "compare")).toBeFocused();
});

test("the form tab lists form records, opens one, and counts the reason marks with their target", async ({
  page,
}) => {
  const data = richAnalysisDb();
  const errors = await openAnalysis(page, data);
  await gotoSubTab(page, "form");
  const card = page.getByTestId("analysis-form-card");
  await expect(card.getByRole("heading", { name: "射型の記録" })).toBeVisible();
  await expect(card.locator("[data-form-id]")).toHaveCount(3);
  await expect(card.locator("#formStart")).toBeVisible();
  await expect(card.locator("#formReplay")).toBeVisible();
  await card.locator('[data-form-id="f1"]').click();
  await expect(page.locator("#fdClose")).toBeVisible();
  await page.locator("#fdClose").click();
  /* 外れた理由の印: 12射（リリース 6・押し手 4・風 2） */
  const reasons = page.getByTestId("analysis-reasons");
  await expect(reasons.getByRole("heading", { name: "外れた理由の印" })).toBeVisible();
  const rows = reasons.getByTestId("analysis-reason-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("リリース");
  await expect(rows.nth(0).locator(".lv")).toHaveText("6射");
  await expect(rows.nth(1)).toContainText("押し手");
  await expect(rows.nth(1).locator(".lv")).toHaveText("4射");
  await expect(rows.nth(2).locator(".lv")).toHaveText("2射");
  const arrows = data.sessions.reduce((n, s) => n + s.ends.flat().length, 0);
  await expect(reasons).toContainText(
    `対象: ${data.sessions.length}回・${arrows}射のうち、理由の印がある 12射。`,
  );
  await expect(reasons).toContainText("印の数は原因を示すものではありません");
  /* 距離で絞ると、対象の回数と印の数も変わる */
  await page.locator("#anDist").selectOption("18");
  await expect(page.getByTestId("analysis-reasons")).toContainText(
    "対象: 2回・120射のうち、理由の印がある 0射。",
  );
  await expect(page.getByTestId("analysis-reason-row")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the form tab explains the switch when form tracking is off and still counts reason marks", async ({
  page,
}) => {
  const data = richAnalysisDb();
  data.settings.formTrackingEnabled = false;
  await openAnalysis(page, data);
  await gotoSubTab(page, "form");
  await expect(page.getByTestId("analysis-form-card")).toHaveCount(0);
  /* 切のときは、その場で入にできる（AN-100。設定へ行く道が無かった） */
  const off = page.getByTestId("analysis-form-off");
  await expect(off).toContainText("映像");
  await expect(off).toContainText("保存しません");
  await expect(off).toContainText("設定 > 記録 の「射型の記録（試験中）」と同じ切り替えです");
  await expect(page.getByTestId("analysis-reason-row")).toHaveCount(3);
  await page.getByTestId("form-v2-enable").click();
  await expect(page.getByTestId("analysis-form-off")).toHaveCount(0);
  await expect(page.getByTestId("analysis-form-card").locator("#formStart")).toBeVisible();
  expect((await stored(page)).settings.formTrackingEnabled).toBe(true);
  await expect(page.getByTestId("analysis-reason-row")).toHaveCount(3);
});

test("no encouragement, verdict labels, exclamation marks or broken values on any of the four tabs", async ({
  page,
}) => {
  const errors = await openAnalysis(page, richAnalysisDb());
  const scan = async (label) => {
    const text = await page.locator("#main").innerText();
    for (const w of BANNED) expect(text, `${label}: "${w}"`).not.toContain(w);
    expect(text, label).not.toMatch(/NaN|undefined|null|Infinity/);
    expect(text, label).not.toMatch(/[A-Z]{4,}/); // 英字だけの飾り見出しを置かない
  };
  for (const [id] of TABS) {
    await gotoSubTab(page, id);
    await scan(id);
  }
  /* 状態を変えた画面も同じ規則 */
  await gotoSubTab(page, "impact");
  await page.locator('[data-testid="analysis-ref-metrics"] summary').click();
  await scan("impact reference metrics");
  await page.locator("#anImpact").selectOption("p5");
  await scan("impact without positions");
  await gotoSubTab(page, "compare");
  await page.locator("#cmpA").selectOption("i0");
  await scan("compare with different conditions");
  await gotoSubTab(page, "score");
  await page.locator("#anPeriod").selectOption("7d");
  await scan("score with a short period");
  await page.locator("#anCond").selectOption({ label: "18m・40cm的・60射" });
  await scan("score with no record in the period");
  expect(errors).toEqual([]);
});

test("empty analysis shows one plain empty state per tab and a route to the record tab", async ({
  page,
}) => {
  const data = homeResultDb({ empty: true });
  const errors = await openAnalysis(page, data, { width: 320, height: 568 });
  for (const [id] of TABS) {
    await gotoSubTab(page, id);
    const empty = page.getByTestId("analysis-empty");
    await expect(empty).toContainText("記録がまだありません");
    await expect(page.locator("#main select")).toHaveCount(0);
    await expect(page.locator("#main svg")).toHaveCount(0);
    const text = await page.locator("#main").innerText();
    for (const w of BANNED) expect(text, `${id}: "${w}"`).not.toContain(w);
  }
  await page.getByRole("button", { name: "記録タブへ", exact: true }).click();
  await expect(page.locator("#viewTitle")).toHaveText("記録");
  expect((await stored(page)).sessions).toEqual([]);
  expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"]) {
  test(`all four tabs fit 320×640 with readable text and 44px controls (${theme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const errors = await openAnalysis(page, richAnalysisDb({ theme }), { width: 320, height: 640 });
    const measure = () =>
      page.evaluate(() => {
        const doc = globalThis.document;
        const root = doc.querySelector("#main");
        const small = [],
          short = [],
          wide = [];
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          return (
            r.width > 0 && r.height > 0 && globalThis.getComputedStyle(el).visibility !== "hidden"
          );
        };
        root.querySelectorAll("*").forEach((el) => {
          if (!visible(el) || el.closest("svg.main") || el.tagName === "OPTION") return;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (own) {
            let size = parseFloat(globalThis.getComputedStyle(el).fontSize);
            const svg = el.closest("svg");
            if (svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width)
              size *= svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
            if (size < 12.99)
              small.push(
                `${el.tagName}.${el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className}:${size.toFixed(1)}:${el.textContent.trim().slice(0, 12)}`,
              );
          }
          const r = el.getBoundingClientRect();
          if (r.right > globalThis.innerWidth + 0.5 || r.left < -0.5)
            wide.push(`${el.tagName}.${el.className}`);
        });
        [
          ...root.querySelectorAll("button, select, summary, a[href]"),
          ...doc.querySelectorAll("#analysisSubTabs button"),
        ].forEach((el) => {
          if (!visible(el)) return;
          const r = el.getBoundingClientRect();
          if (r.height < 43.5)
            short.push(`${el.tagName}#${el.id}.${el.className}:${r.height.toFixed(1)}`);
        });
        return {
          small,
          short,
          wide,
          overflow: doc.documentElement.scrollWidth - globalThis.innerWidth,
        };
      });
    const check = async (label) =>
      expect(await measure(), label).toEqual({ small: [], short: [], wide: [], overflow: 0 });
    for (const [id] of TABS) {
      await gotoSubTab(page, id);
      await check(id);
    }
    await gotoSubTab(page, "impact");
    await page.locator('[data-testid="analysis-ref-metrics"] summary').click();
    await check("impact reference metrics");
    await page.locator("#anImpact").selectOption("p5");
    await check("impact without positions");
    await gotoSubTab(page, "compare");
    await page.locator("#cmpA").selectOption("i0");
    await check("compare with different conditions");
    /* 条件の欄と下線タブは、下の固定タブに隠れない */
    await gotoSubTab(page, "score");
    const box = await page.locator("#anCond").boundingBox();
    const tabsTop = await page.locator("#tabs").evaluate((el) => el.getBoundingClientRect().top);
    expect(box.y + box.height).toBeLessThan(tabsTop);
    expect(errors).toEqual([]);
  });
}
