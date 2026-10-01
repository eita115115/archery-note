"use strict";

const { test, expect } = require("@playwright/test");

async function seed(page, boundary = false, repeatDistance = false) {
  await page.goto("/");
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  await page.evaluate(
    ({ atBoundary, repeatedDistance }) => {
      const data = JSON.parse(localStorage.getItem("archeryNote.v1"));
      const base = data.sessions[0];
      const make = (id, date, dist, score, stage) => ({
        ...base,
        id,
        date,
        dist,
        round: stage === undefined ? "free" : "wa1440_men",
        roundGroup:
          stage === undefined
            ? undefined
            : { gid: "demo-round", roundId: "wa1440_men", stage, stageCount: 4 },
        ends: [[{ ...base.ends[0][0], s: score, X: false }]],
      });
      data.sessions = [
        make("stage-3", "2026-09-29", 30, 7, 3),
        make("stage-0", "2026-09-28", 90, 10, 0),
        make("stage-2", "2026-09-29", repeatedDistance ? 70 : 50, 8, 2),
        make("stage-1", "2026-09-28", 70, 9, 1),
        make("old-single", "2026-09-27", 70, 6),
      ];
      if (atBoundary) {
        data.sessions.push(
          ...Array.from({ length: 49 }, (_, i) =>
            make(`new-single-${String(i).padStart(2, "0")}`, "2026-09-30", 18, 5),
          ),
        );
        data.sessions.push(make("older-single", "2026-09-26", 18, 4));
      }
      localStorage.setItem("archeryNote.v1", JSON.stringify(data));
    },
    { atBoundary: boundary, repeatedDistance: repeatDistance },
  );
  await page.reload();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions,
  );
  await page.locator('#tabs [data-v="history"]').click();
  return before;
}

for (const theme of ["light", "dark"]) {
  test(`a round opens in stage order, retains expansion and filters without changing records (${theme})`, async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme: theme });
    const before = await seed(page);
    await expect(page.locator(".historyRecords")).toBeVisible();
    if (process.env.HISTORY_ROUND_CAPTURE && browserName === "chromium") {
      await page.locator(".historyRecords").screenshot({
        path: `docs/screenshots/history-round-${process.env.HISTORY_ROUND_CAPTURE}${theme === "dark" ? "-dark" : ""}-375.png`,
        animations: "disabled",
      });
    }
    const group = page.getByTestId("history-round");
    const summary = group.locator("summary");
    await expect(summary).toContainText("34");
    await expect(summary).toContainText("4/4ステージ");
    await expect(summary).toContainText("4本");
    await expect(group).not.toHaveAttribute("open", "");
    await expect(page.locator('[data-id="old-single"]')).toBeVisible();
    expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(group).toHaveAttribute("open", "");
    if (process.env.HISTORY_ROUND_CAPTURE && browserName === "chromium") {
      await page.locator(".historyRecords").screenshot({
        path: `artifacts/history-round/expanded-${theme}-375.png`,
        animations: "disabled",
      });
    }
    expect(
      await group.getByTestId("history-row").evaluateAll((els) => els.map((el) => el.dataset.id)),
    ).toEqual(["stage-0", "stage-1", "stage-2", "stage-3"]);
    await page.locator('#tabs [data-v="analysis"]').click();
    await page.locator('#tabs [data-v="history"]').click();
    await expect(group).toHaveAttribute("open", "");
    await group.locator('[data-id="stage-1"]').click();
    await expect(page.getByTestId("history-stage-table")).toContainText("34");
    await page.keyboard.press("Escape");
    await page.getByTestId("history-filter-toggle").click();
    await page.locator("#histDist").selectOption("70");
    await expect(group).toHaveCount(0);
    await expect(page.getByTestId("history-row")).toHaveCount(2);
    await page.locator("#histClear").click();
    await expect(group).toHaveAttribute("open", "");
    await summary.click();
    await expect(group).not.toHaveAttribute("open", "");
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions),
    ).toEqual(before);
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(
      await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(1280);
    expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44);
  });
}

test("additional history keeps all stages together at a page boundary on a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const before = await seed(page, true);
  const group = page.getByTestId("history-round");
  await expect(group.locator("summary")).toContainText("4/4ステージ");
  await group.locator("summary").click();
  await expect(group.getByTestId("history-row")).toHaveCount(4);
  await page.locator("#histMore").click();
  await expect(group).toHaveAttribute("open", "");
  await expect(group.getByTestId("history-row")).toHaveCount(4);
  await expect(page.locator('[data-id="older-single"]')).toBeVisible();
  await expect(page.locator("#histMore")).toHaveCount(0);
  expect(
    await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions),
  ).toEqual(before);
});

test("a filtered group labels its visible subtotal and excludes unmatched stages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const before = await seed(page, false, true);
  await page.getByTestId("history-filter-toggle").click();
  await page.locator("#histDist").selectOption("70");
  const group = page.getByTestId("history-round");
  await expect(group.locator("summary")).toContainText("2/4ステージ");
  await expect(group.locator(".historyRoundTotal")).toHaveText("17表示分合計");
  await group.locator("summary").click();
  expect(
    await group.getByTestId("history-row").evaluateAll((els) => els.map((el) => el.dataset.id)),
  ).toEqual(["stage-1", "stage-2"]);
  await expect(page.locator('[data-id="stage-0"]')).toHaveCount(0);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions),
  ).toEqual(before);
});
