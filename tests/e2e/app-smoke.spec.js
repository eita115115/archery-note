"use strict";

const { expect, test } = require("@playwright/test");

const sampleDate = "2026-06-27";
const sampleDb = {
  schema: 3,
  setups: [
    {
      id: "e2e-setup",
      name: "E2E recurve setup",
      bow: "Recurve",
      limbs: "Sample limbs",
      poundage: 38,
      history: [],
    },
  ],
  sightMarks: [
    {
      id: "e2e-mark",
      setupId: "e2e-setup",
      dist: 70,
      date: sampleDate,
      v: "5.4",
      h: "0",
      note: "E2E smoke",
      ts: Date.parse(`${sampleDate}T00:00:00.000Z`),
    },
  ],
  sessions: [
    {
      id: "e2e-session",
      setupId: "e2e-setup",
      date: sampleDate,
      dist: 70,
      faceD: 122,
      faceType: "single",
      perEnd: 6,
      round: "free",
      sightV: "5.4",
      sightH: "0",
      wx: "室内",
      note: "E2E smoke record",
      ends: [
        [
          { x: 0.2, y: 0.1, s: 10, X: true },
          { x: -1.1, y: 0.8, s: 10 },
          { x: 1.8, y: -0.9, s: 9 },
          { x: -2.4, y: -1.5, s: 9 },
          { x: 3.2, y: 1.1, s: 9 },
          { x: -3.5, y: 2.2, s: 8 },
        ],
      ],
    },
  ],
  trash: [],
  settings: {
    eyeSight: 850,
    theme: "auto",
    lastBackupAt: null,
    activeGuideSeen: true,
  },
  active: null,
};

function mainTab(page, name) {
  return page.locator("#tabs").getByRole("button", { name });
}

function collectUnexpectedErrors(page) {
  const unexpectedErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") unexpectedErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    unexpectedErrors.push(error.message);
  });
  return unexpectedErrors;
}

test("loads core tabs and seeded history without console errors", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, sampleDb);

  await page.goto("/");

  await expect(page).toHaveTitle(/Archery Note/);
  await expect(page.getByRole("heading", { name: "Archery Note" })).toBeVisible();
  await expect(page.locator("#bootFallback")).toBeHidden();
  await expect(page.locator("#main")).toContainText("今日の記録を始める");

  await expect(mainTab(page, "記録")).toBeVisible();
  await expect(mainTab(page, "履歴")).toBeVisible();
  await expect(mainTab(page, "サイト調整")).toBeVisible();
  await expect(mainTab(page, "用具")).toBeVisible();

  await mainTab(page, "履歴").click();
  await expect(page.locator("#main")).toContainText("練習履歴");
  await expect(page.locator("#main")).toContainText("2026/6/27 ・ 70m");
  await expect(page.locator("#main")).toContainText("E2E recurve setup");

  await mainTab(page, "サイト調整").click();
  await expect(page.locator("#main")).toContainText("サイト台帳");
  await expect(page.locator("#main")).toContainText("E2E recurve setup");

  await mainTab(page, "用具").click();
  await expect(page.locator("#main")).toContainText("用具セッティング");
  await expect(page.locator("#main")).toContainText("E2E recurve setup");

  await mainTab(page, "記録").click();
  await expect(page.locator("#main")).toContainText("今日の記録を始める");
  await expect(unexpectedErrors).toEqual([]);
});
