const { test, expect } = require("@playwright/test");
const { sightLedgerDb } = require("./fixtures/sight-ledger-db");
test.use({ hasTouch: true });
async function seed(page, data = sightLedgerDb()) {
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
async function ids(page) {
  return page.locator("[data-sight-id]").evaluateAll((els) => els.map((e) => e.dataset.sightId));
}
for (const width of [320, 375, 900]) {
  test(`sight values stay readable beside a long memo (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await seed(page);
    const before = await snapshot(page);
    expect(await ids(page)).toEqual(["sight-new", "sight-old", "sight-empty"]);
    const row = page.locator('[data-sight-id="sight-new"]');
    await expect(row).toContainText("最新");
    await expect(row.locator("dt")).toHaveText(["上下", "左右"]);
    await expect(row.locator("dd")).toHaveText(["86.25", "0.4"]);
    await expect(page.locator('[data-sight-id="sight-empty"] dd')).toHaveText(["0", "—"]);
    await expect(page.locator('[data-sight-id="sight-empty"] details')).toHaveCount(0);
    await expect(row.locator("details")).not.toHaveAttribute("open");
    expect(await row.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(220);
    await row.locator("summary").tap();
    await expect(row.locator("details p")).toHaveText(sightLedgerDb().sightMarks[0].note);
    await expect(row.locator("details p")).toBeVisible();
    const geometry = await row.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        head = el.querySelector(".sightMarkHead").getBoundingClientRect(),
        values = el.querySelector("dl").getBoundingClientRect(),
        note = el.querySelector("details").getBoundingClientRect();
      return {
        overflow:
          el.scrollWidth > el.clientWidth ||
          globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        overlap: head.bottom > values.top || values.bottom > note.top,
        outside: r.left < 0 || r.right > globalThis.innerWidth,
        short: [...el.querySelectorAll("button,summary")].some(
          (e) => e.getBoundingClientRect().height < 44,
        ),
      };
    });
    expect(geometry).toEqual({ overflow: false, overlap: false, outside: false, short: false });
    await row.locator("summary").tap();
    expect(await snapshot(page)).toEqual(before);
    await page.reload();
    expect(await snapshot(page)).toEqual(before);
  });
}
test("ledger filters and add/calibration entry keep their existing data", async ({ page }) => {
  await seed(page);
  const before = await snapshot(page);
  await page.locator('#sgDistChips [data-d="18"]').tap();
  expect(await ids(page)).toEqual(["other-distance"]);
  await page.locator("#sgSetup").selectOption("b");
  await page.locator('#sgDistChips [data-d="30"]').tap();
  expect(await ids(page)).toEqual(["other-setup"]);
  await page.locator('#sgDistChips [data-d="70"]').tap();
  await expect(page.getByText("この距離の記録はまだありません", { exact: true })).toBeVisible();
  await page.locator("#sgSetup").selectOption("a");
  await page.locator('#sgDistChips [data-d="30"]').tap();
  await page.locator("#sgAdd").tap();
  await page.locator("#mkCancel").tap();
  await page.locator("#sgCalMode").tap();
  await page.locator("#calCancel").tap();
  expect(await snapshot(page)).toEqual(before);
});
test("memo keyboard disclosure preserves escaped text and numeric zero", async ({ page }) => {
  const data = sightLedgerDb();
  data.sightMarks[1].note = '<img src=x onerror="alert(1)">\n' + "合成メモ".repeat(100);
  data.sightMarks[2].v = 0;
  data.sightMarks[2].h = 0;
  await seed(page, data);
  await expect(page.locator('[data-sight-id="sight-empty"] dd')).toHaveText(["0", "0"]);
  const row = page.locator('[data-sight-id="sight-old"]'),
    summary = row.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(row.locator("details")).toHaveAttribute("open", "");
  await expect(row.locator("p")).toHaveText(data.sightMarks[1].note);
  await expect(row.locator("img")).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(row.locator("details")).not.toHaveAttribute("open");
  await expect(summary).toBeFocused();
});
test("sight deletion cancels safely and confirmed deletion can be restored", async ({ page }) => {
  await seed(page);
  const before = await snapshot(page);
  const del = page.locator('[data-del="sight-new"]');
  await expect(del).toHaveAccessibleName("2026/10/13のサイト値を削除");
  await del.tap();
  await page.locator("#acCancel").tap();
  expect(await snapshot(page)).toEqual(before);
  await del.tap();
  await page.locator("#acOk").tap();
  await expect(page.locator('[data-sight-id="sight-new"]')).toHaveCount(0);
  const deleted = await snapshot(page);
  expect(deleted[2]).toEqual(before[2].filter((r) => r.id !== "sight-new"));
  for (const i of [0, 1, 3, 4, 5]) expect(deleted[i]).toEqual(before[i]);
  await page.getByRole("button", { name: "設定", exact: true }).tap();
  const restore = page.locator("[data-restore-trash]");
  await restore.scrollIntoViewIfNeeded();
  await restore.tap();
  await page.locator("#setClose").tap();
  const restored = await snapshot(page);
  expect([...restored[2]].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
    [...before[2]].sort((a, b) => a.id.localeCompare(b.id)),
  );
  for (const i of [0, 1, 3, 4, 5]) expect(restored[i]).toEqual(before[i]);
  await page.reload();
  expect(await snapshot(page)).toEqual(restored);
});
