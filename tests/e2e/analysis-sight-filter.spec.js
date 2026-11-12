const { test, expect } = require("@playwright/test");

async function seed(page, boundaryDays = null) {
  await page.addInitScript((days) => {
    if (localStorage.getItem("archeryNote.v1")) return;
    const date = (ago) => {
      const d = new Date();
      d.setDate(d.getDate() - ago);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const stamp = (ago) => new Date(`${date(ago)}T12:00:00`).getTime();
    const mark = (id, v, ago, setupId = "sight-a", dist = 30) => ({
      id,
      v,
      h: "1.2",
      setupId,
      dist,
      date: ago == null ? "" : date(ago),
    });
    const marks =
      days == null
        ? [
            mark("match", "111.1", 0),
            mark("other", "222.2", 0, "sight-b", 18),
            mark("old", "333.3", 10),
            mark("none", "444.4", 0, null),
            { ...mark("stamp", "555.5", null), ts: stamp(2) },
            mark("undated", "666.6", null),
          ]
        : [
            mark("inside", "777.7", days - 1),
            mark("outside", "888.8", days),
            { ...mark("stamp", "999.9", null), ts: stamp(days - 1) },
            mark("undated", "666.6", null),
          ];
    localStorage.setItem(
      "archeryNote.v1",
      JSON.stringify({
        schema: 5,
        settings: { onboardingSeen: true, launchCount: 10 },
        setups: [
          { id: "sight-a", name: "用具A" },
          { id: "sight-b", name: "用具B" },
        ],
        sessions: [
          {
            id: "owned-sight-session",
            date: date(0),
            setupId: "sight-a",
            dist: 30,
            faceD: 40,
            faceType: "single",
            round: "free",
            perEnd: 3,
            sightV: "7.7",
            sightH: "0.7",
            ends: [
              [
                { x: 0, y: 0, s: 10, X: true },
                { x: 0.2, y: 0, s: 10, X: true },
                { x: 0, y: 0.2, s: 10, X: true },
              ],
            ],
          },
        ],
        sightMarks: marks,
        active: null,
        customRounds: [],
      }),
    );
  }, boundaryDays);
  await page.goto("/");
  await page.locator('#tabs [data-v="gear"]').click();
  await page.getByTestId("gear-subtab-sight").click();
}

function records(page) {
  return page
    .locator(".card")
    .filter({ has: page.getByRole("heading", { name: /^サイト値の記録/ }) });
}
function summary(page) {
  return page
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: "サイト値のまとめ" }) });
}
async function practice(page) {
  return page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("archeryNote.v1"));
    return {
      sessions: d.sessions,
      setups: d.setups,
      sightMarks: d.sightMarks,
      active: d.active,
      customRounds: d.customRounds,
    };
  });
}

/* v5 段 7: 「サイト値の記録」「サイト値のまとめ」は 分析 から 弓具 > サイト へ移した（中身は従来のまま）。
   分析の絞り込み（弓具・距離・期間）の代わりに、サイトの画面で選んでいる弓具の全距離・全期間を対象にする。 */
for (const [width, colorScheme] of [
  [320, "light"],
  [375, "dark"],
]) {
  test(`sight records overview follows the selected setup without writes (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await seed(page);
    const before = await practice(page);
    await expect(page.locator("#sgSetup")).toHaveValue("sight-a");
    const overview = page.getByTestId("sight-records-overview");
    await expect(overview).toHaveCount(1);
    const all = await records(page).textContent();
    /* 選んでいる弓具の台帳（日付なし・時刻だけの記録を含む）と、練習に入れたサイト値 */
    for (const v of ["111.1", "333.3", "555.5", "666.6", "7.7"])
      await expect(records(page)).toContainText(v);
    for (const v of ["222.2", "444.4"]) await expect(records(page)).not.toContainText(v);
    await expect(summary(page)).toContainText("台帳4件 / 練習入力1回");
    await page.locator("#sgSetup").selectOption("sight-b");
    await expect(records(page)).toContainText("222.2");
    for (const v of ["111.1", "444.4", "7.7"]) await expect(records(page)).not.toContainText(v);
    await expect(summary(page)).toContainText("台帳1件 / 練習入力0回");
    await page.locator("#sgSetup").selectOption("sight-a");
    await expect(records(page)).toHaveText(all);
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    ).toBe(true);
    /* 分析タブにはカードを置かず、着弾 の下に入口の行だけを置く */
    await page.locator('#tabs [data-v="analysis"]').click();
    await expect(page.locator("#main")).not.toContainText("サイト値の記録");
    await page.locator('#analysisSubTabs [data-an="impact"]').click();
    await page.getByTestId("analysis-to-sight").click();
    await expect(page.getByTestId("gear-subtab-sight")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("sight-records-overview")).toHaveCount(1);
    expect(await practice(page)).toEqual(before);
    await page.reload();
    expect(await practice(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
}
