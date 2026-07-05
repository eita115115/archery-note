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
  await expect(page.getByTestId("record-start")).toBeVisible();

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
  await expect(page.locator("#main")).toContainText("機材台帳");
  await expect(page.locator("#main")).toContainText("E2E recurve setup");

  await mainTab(page, "記録").click();
  await expect(page.getByTestId("record-start")).toBeVisible();
  await expect(unexpectedErrors).toEqual([]);
});

test("moves exactly one aria-current marker when switching tabs", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, sampleDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  const currentTab = page.locator('#tabs button[aria-current="page"]');
  await expect(currentTab).toHaveCount(1);
  await expect(currentTab).toHaveAttribute("data-v", "record");

  await mainTab(page, "履歴").click();
  await expect(currentTab).toHaveCount(1);
  await expect(currentTab).toHaveAttribute("data-v", "history");

  await mainTab(page, "記録").click();
  await expect(currentTab).toHaveCount(1);
  await expect(currentTab).toHaveAttribute("data-v", "record");
  await expect(unexpectedErrors).toEqual([]);
});

test("exposes distance chips as buttons with synced aria-pressed", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, sampleDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  const chips = page.locator("#fDistChips .chip");
  await expect(chips.first()).toBeVisible();
  const chipCount = await chips.count();
  for (let i = 0; i < chipCount; i++) {
    await expect(chips.nth(i)).toHaveJSProperty("tagName", "BUTTON");
  }

  const pressed = page.locator('#fDistChips .chip[aria-pressed="true"]');
  await expect(pressed).toHaveCount(1);
  await expect(pressed).toHaveAttribute("data-d", "70");

  await page.locator('#fDistChips .chip[data-d="30"]').click();
  await expect(page.locator('#fDistChips .chip[data-d="30"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(pressed).toHaveCount(1);
  await expect(unexpectedErrors).toEqual([]);
});

test("exposes history rows and sight distance chips as buttons", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, sampleDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await mainTab(page, "履歴").click();
  const row = page.locator("#histList .listItem").first();
  await expect(row).toBeVisible();
  await expect(row).toHaveJSProperty("tagName", "BUTTON");
  await row.click();
  await expect(page.locator(".ovl .sheet")).toBeVisible();
  await page.locator("#hClose").click();
  await expect(page.locator(".ovl")).toHaveCount(0);

  await mainTab(page, "サイト調整").click();
  const chips = page.locator("#sgDistChips .chip");
  await expect(chips.first()).toBeVisible();
  const chipCount = await chips.count();
  for (let i = 0; i < chipCount; i++) {
    await expect(chips.nth(i)).toHaveJSProperty("tagName", "BUTTON");
  }

  const pressed = page.locator('#sgDistChips .chip[aria-pressed="true"]');
  await expect(pressed).toHaveCount(1);
  await expect(pressed).toHaveAttribute("data-d", "70");

  await page.locator('#sgDistChips .chip[data-d="30"]').click();
  await expect(page.locator('#sgDistChips .chip[data-d="30"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(pressed).toHaveCount(1);
  await expect(unexpectedErrors).toEqual([]);
});

test("opens settings as a dialog, closes on Escape, and restores focus", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, sampleDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await page.locator("#btnSettings").click();
  const ovl = page.locator(".ovl");
  await expect(ovl).toBeVisible();
  await expect(ovl).toHaveAttribute("role", "dialog");
  await expect(ovl).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("body")).toHaveClass(/modalOpen/);
  await expect(page.locator(".ovl .sheet")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(ovl).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveClass(/modalOpen/);
  await expect(page.locator("#btnSettings")).toBeFocused();
  await expect(unexpectedErrors).toEqual([]);
});

test("appConfirm dialog: cancel keeps data, Escape cancels, and confirm deletes with focus restore", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, sampleDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await mainTab(page, "履歴").click();
  const row = page.locator("#histList .listItem").first();
  await row.click();
  const detailSheet = page.locator(".ovl .sheet");
  await expect(detailSheet).toBeVisible();
  const delBtn = page.locator("#hDel");

  // キャンセルボタン: データは消えない
  await delBtn.click();
  const confirmSheet = page.locator(".ovl .confirmSheet");
  await expect(confirmSheet).toBeVisible();
  await expect(confirmSheet).toContainText("この練習記録を削除しますか？");
  await page.locator(".ovl .confirmSheet #acCancel").click();
  await expect(confirmSheet).toHaveCount(0);
  await expect(detailSheet).toBeVisible();
  await expect(detailSheet).toContainText("2026/6/27");

  // Escape でもキャンセル扱い。フォーカスは削除ボタンへ復帰する
  await delBtn.click();
  await expect(confirmSheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirmSheet).toHaveCount(0);
  await expect(delBtn).toBeFocused();

  // 確認: 削除が実行され、履歴から消える
  await delBtn.click();
  await expect(confirmSheet).toBeVisible();
  await page.locator(".ovl .confirmSheet #acOk").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  await expect(page.locator("#histList")).not.toContainText("2026/6/27 ・ 70m");
  await expect(unexpectedErrors).toEqual([]);
});

test("records a multi-distance round with stage advance and history badges", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, sampleDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await page.locator(".recordDetails summary").click();
  await page.locator("#fRound").selectOption("wa1440_men");
  await expect(page.locator("#fRoundStages")).toContainText("WA1440 男子");
  await page.getByTestId("record-start").click();

  // ステージ1: 90m から開始
  const hud = page.getByTestId("active-hud");
  await expect(hud).toContainText("90m");
  await expect(hud).toContainText("ステージ 1/4");
  const target = page.getByTestId("active-target").locator("#tgsvg");
  for (let i = 0; i < 3; i++) await target.click();
  await page.getByTestId("active-end").click();
  // 36射未満の確定は appConfirm ダイアログ。確認ボタンをクリックして進める
  await page.locator("#bNextStage").click();
  await expect(page.locator(".ovl .confirmSheet")).toBeVisible();
  await page.locator(".ovl .confirmSheet #acOk").click();
  await expect(page.locator(".ovl .confirmSheet")).toHaveCount(0);

  // ステージ2: 70m へ遷移（2ステージで打ち切り）
  await expect(hud).toContainText("70m");
  await expect(hud).toContainText("ステージ 2/4");
  await target.click();
  await page.getByTestId("active-finish").click();
  // ラウンド途中終了も appConfirm ダイアログ経由
  await expect(page.locator(".ovl .confirmSheet")).toBeVisible();
  await page.locator(".ovl .confirmSheet #acOk").click();
  await expect(page.locator(".ovl .sheet.confirmSheet")).toHaveCount(0);
  await expect(page.locator(".ovl .sheet")).toContainText("WA1440 男子 合計");
  await page.locator("#sumClose").click();

  // 履歴: 各ステージにグループバッジ、詳細にステージ一覧とラウンド合計
  await mainTab(page, "履歴").click();
  await expect(page.locator("#histList")).toContainText("WA1440 男子 1/4");
  await expect(page.locator("#histList")).toContainText("WA1440 男子 2/4");
  await page.locator("#histList .listItem", { hasText: "90m" }).first().click();
  const sheet = page.locator(".ovl .sheet");
  await expect(sheet).toContainText("ラウンド合計");
  await expect(sheet).toContainText("（表示中）");
  await page.locator("[data-stage-jump]").click();
  await expect(page.locator(".ovl .sheet")).toContainText("70m");
  await page.locator("#hClose").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  await expect(unexpectedErrors).toEqual([]);
});

test("syncs aria-pressed on settings theme and form tracking chips", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, sampleDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await page.locator("#btnSettings").click();
  await expect(page.locator("#thChips .chip").first()).toBeVisible();

  const pressedTheme = page.locator('#thChips .chip[aria-pressed="true"]');
  await expect(pressedTheme).toHaveCount(1);
  await expect(pressedTheme).toHaveAttribute("data-th", "auto");
  await page.locator('#thChips .chip[data-th="dark"]').click();
  await expect(pressedTheme).toHaveCount(1);
  await expect(pressedTheme).toHaveAttribute("data-th", "dark");

  const pressedFt = page.locator('#ftChips .chip[aria-pressed="true"]');
  await expect(pressedFt).toHaveCount(1);
  await expect(pressedFt).toHaveAttribute("data-ft", "0");
  await page.locator('#ftChips .chip[data-ft="1"]').click();
  await expect(pressedFt).toHaveCount(1);
  await expect(pressedFt).toHaveAttribute("data-ft", "1");
  await expect(unexpectedErrors).toEqual([]);
});
