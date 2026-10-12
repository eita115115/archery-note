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
  await page.locator('#tabs [data-v="analysis"]').click();
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

for (const [width, colorScheme] of [
  [320, "light"],
  [375, "dark"],
]) {
  test(`analysis sight records follow comparison conditions and restore without writes (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await seed(page);
    const before = await practice(page);
    const all = await records(page).textContent();
    await expect(records(page)).toContainText("666.6");
    await page.locator("#anSetup").selectOption("sight-a");
    await page.locator("#anDist").selectOption("30");
    await page.locator('[data-period="7d"]').click();
    for (const v of ["111.1", "555.5", "7.7"]) await expect(records(page)).toContainText(v);
    for (const v of ["222.2", "333.3", "444.4", "666.6"])
      await expect(records(page)).not.toContainText(v);
    await expect(summary(page)).toContainText("台帳2件 / 練習入力1回");
    await expect(summary(page)).toContainText("111.1");
    await page.locator("#anSetup").selectOption("sight-b");
    await expect(records(page)).toHaveCount(0);
    await expect(summary(page)).toHaveCount(0);
    await page.locator("#anSetup").selectOption("__none");
    await page.locator('[data-period="all"]').click();
    await expect(records(page)).toContainText("444.4");
    await expect(records(page)).not.toContainText("111.1");
    await page.locator("#anSetup").selectOption("");
    await page.locator("#anDist").selectOption("");
    await expect(records(page)).toHaveText(all);
    expect(await practice(page)).toEqual(before);
    await page.reload();
    expect(await practice(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
}

for (const days of [7, 30, 90]) {
  test(`analysis sight period includes its first day and timestamp fallback (${days}d)`, async ({
    page,
  }) => {
    await seed(page, days);
    const before = await practice(page);
    await page.locator(`[data-period="${days}d"]`).click();
    for (const v of ["777.7", "999.9"]) await expect(records(page)).toContainText(v);
    for (const v of ["888.8", "666.6"]) await expect(records(page)).not.toContainText(v);
    await expect(summary(page)).toContainText("台帳2件 / 練習入力1回");
    await page.locator('[data-period="all"]').click();
    for (const v of ["888.8", "666.6"]) await expect(records(page)).toContainText(v);
    expect(await practice(page)).toEqual(before);
  });
}

test("analysis sight selection preserves source marks and excludes unknown rounds", async ({
  page,
}) => {
  await seed(page);
  const result = await page.evaluate(() => {
    const marks = globalThis.eval("db.sightMarks");
    const before = JSON.stringify(marks);
    const all = globalThis.analysisSightMarks({ period: "all" });
    return {
      same: all.every((m, i) => m === marks[i]),
      unchanged: before === JSON.stringify(marks),
      round: globalThis.analysisSightMarks({ round: "free", period: "all" }).length,
    };
  });
  expect(result).toEqual({ same: true, unchanged: true, round: 0 });
});
