"use strict";

const { test, expect } = require("@playwright/test");

/* 旧判定（矢円=的の直径÷85）で記録された回は、保存された点数を変えずに
   実寸判定（矢の実際の太さ）での点数を履歴詳細に並べて表示する */
const legacySession = {
  id: "owned-legacy-rescore",
  date: "2026-09-01",
  setupId: "owned-setup",
  dist: 70,
  faceD: 122,
  faceType: "single",
  round: "free",
  perEnd: 6,
  shaft: 1.537,
  ends: [
    [
      { x: 7.6, y: 0, s: 10, X: false },
      { x: 0, y: 0, s: 10, X: true },
      { x: -1, y: 1, s: 10, X: true },
    ],
  ],
};
const newSession = {
  ...legacySession,
  id: "owned-new-rule",
  date: "2026-09-02",
  arrowR: 0.25,
  ends: [
    [
      { x: 7.6, y: 0, s: 9, X: false },
      { x: 0, y: 0, s: 10, X: true },
      { x: -1, y: 1, s: 10, X: true },
    ],
  ],
};
const database = {
  schema: 5,
  setups: [{ id: "owned-setup", name: "Owned setup", arrowDia: "5.0" }],
  sightMarks: [],
  sessions: [legacySession, newSession],
  settings: { onboardingSeen: true, activeGuideSeen: true, theme: "light", launchCount: 9 },
  active: null,
};

test("legacy session shows the real-size rescore without changing stored scores", async ({
  page,
}) => {
  await page.addInitScript((db) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(db));
  }, database);
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await page.locator("#tabs").getByRole("button", { name: "履歴" }).click();
  await page.locator('[data-id="owned-legacy-rescore"]').first().click();
  const note = page.getByTestId("history-rescore");
  await expect(note).toBeVisible();
  await expect(note).toContainText("矢径 5.0mm");
  await expect(note).toContainText("29点");
  await expect(note).toContainText("記録時 30点");
  await expect(page.getByTestId("history-detail-stats")).toContainText("30");
  const stored = await page.evaluate(
    () =>
      JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).sessions.find(
        (s) => s.id === "owned-legacy-rescore",
      ).ends[0][0].s,
  );
  expect(stored).toBe(10);
  await page.locator("#hClose").click();
  await page.locator('[data-id="owned-new-rule"]').first().click();
  await expect(page.getByTestId("history-detail-stats")).toContainText("29");
  await expect(page.getByTestId("history-rescore")).toHaveCount(0);
});
