"use strict";

const { expect, test } = require("@playwright/test");

/* 「今日の結果」統合パネル（scripts/49-todays-result.js の純関数 +
   scripts/50-record-view.js の openSummary 統合 + scripts/60-history-sight-view.js の
   履歴詳細シート再構成 T6）の実挙動検証。
   todays-result-integration-design.md（§11 Fable裁定・§12 ユーザー確定）と
   strict-review 2026-07-12 の必須アサーション4点+major①回帰ガードを担う:
   (a) セッション終了サマリーに .summaryTodaysResult が出る
   (b) 真の初回で「初回記録: 基準ができました」
   (c) 2セッション目で前回比の行が出る
   (d) 履歴詳細シートで「この日」として再構成される
   本パネルは gamification.enabled 非依存（既定OFFのまま全テストが通ることが仕様） */

function blankDb(overrides) {
  return Object.assign(
    {
      schema: 5,
      setups: [],
      sightMarks: [],
      sessions: [],
      trash: [],
      formAnalyses: [],
      customRounds: [],
      settings: {
        eyeSight: 850,
        theme: "auto",
        lastBackupAt: null,
        activeGuideSeen: true,
        onboardingSeen: true, // 他テストとの独立性: 明示しないと normalizeDb が false 補完しオンボが誤って出る
        launchCount: 0,
        featureHints: {
          gearSetup: false,
          analysis: false,
          sightAdjust: false,
          formTracking: false,
          addToHome: false,
          practiceDays: false,
        },
        gamification: {
          enabled: false, // 既定OFF。本パネルはこのフラグに依存しない（表示されることが仕様）
          practiceDays: null,
          goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
          backfilledAt: "2026-06-01T00:00:00Z",
        },
      },
      gamification: { badges: [] },
      active: null,
    },
    overrides,
  );
}

/* 6本の矢（全て同一 score s）。座標は plotSession が NaN を出さないための固定散布で、
   同条件の座標つき履歴が3件未満に留まる限り stabilityTrend は発火しない
   （本 spec は weeklyDiff / personalBest / 空欄縮退コピーの決定論的検証に集中する） */
function end6(s) {
  const offsets = [
    [0.2, 0.1],
    [-1.1, 0.8],
    [1.8, -0.9],
    [-2.4, -1.5],
    [3.2, 1.1],
    [-3.5, 2.2],
  ];
  return offsets.map(([x, y]) => ({ x, y, s }));
}

/* 過去日付の確定済みセッション（既定 70m/122cm/single、6本）。total = 6*s */
function pastSession(id, date, s, o) {
  o = o || {};
  return {
    id,
    setupId: null,
    date,
    dist: o.dist === undefined ? 70 : o.dist,
    faceD: o.faceD === undefined ? 122 : o.faceD,
    faceType: "single",
    perEnd: 6,
    round: "free",
    sightV: "",
    sightH: "",
    wx: "",
    note: "",
    ends: [end6(s)],
  };
}

/* 記録中の active セッション（seed 起動時に復元される）。条件と矢を完全制御するため
   record-start からの UI 操作ではなく seed で持ち込み、active-finish だけを踏む */
function activeSession(id, dateStr, s, o) {
  o = o || {};
  return {
    id,
    date: dateStr,
    setupId: null,
    dist: o.dist === undefined ? 70 : o.dist,
    faceD: o.faceD === undefined ? 122 : o.faceD,
    faceType: "single",
    perEnd: 6,
    shaft: 0.65,
    sightV: "",
    sightH: "",
    wx: "",
    note: "",
    windDir: "",
    windSpeed: "",
    round: "free",
    purpose: "practice",
    ends: [end6(s)],
    cur: [],
  };
}

/* テスト実行日のローカル日（10-storage-native.js today() と同じ規律。テストと同一マシンで
   実行されるため Node のローカル日 = ブラウザのローカル日） */
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

async function seedDb(page, database) {
  await page.addInitScript((db) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(db));
  }, database);
}

function mainTab(page, name) {
  return page.locator("#tabs").getByRole("button", { name });
}

test("first-ever session shows the baseline-established copy, with gamification off by default", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(
    page,
    blankDb({
      sessions: [], // 真の初回
      active: activeSession("e2e-first", localToday(), 9),
    }),
  );
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await page.getByTestId("active-finish").click();
  const empty = page.getByTestId("todays-result-empty");
  await expect(empty).toBeVisible();
  await expect(empty).toHaveText("初回記録: 基準ができました。次回から比較が始まります。");
  // gamification.enabled=false（既定）でも本パネルは出る。逆に summaryGamification は出ない
  await expect(page.locator('[data-testid="summary-gamification"]')).toHaveCount(0);
  expect(unexpectedErrors).toEqual([]);
});

test("second same-condition session shows the previous-comparison row in the summary", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(
    page,
    blankDb({
      sessions: [pastSession("prev-1", "2026-06-01", 8)], // 48点/6本
      active: activeSession("e2e-second", localToday(), 9), // 54点/6本
    }),
  );
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await page.getByTestId("active-finish").click();
  const panel = page.getByTestId("todays-result");
  await expect(panel).toBeVisible();
  const weeklyRow = page.getByTestId("todays-result-weekly");
  await expect(weeklyRow).toContainText("前回（2026/6/1）より +6点");
  await expect(weeklyRow).toContainText("今日 54点 ・ 2026/6/1 48点");
  // 初回縮退コピーは出ない
  await expect(page.getByTestId("todays-result-empty")).toHaveCount(0);
  expect(unexpectedErrors).toEqual([]);
});

test("first session at a new condition says condition-first, not first-ever (strict-review major regression)", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(
    page,
    blankDb({
      sessions: [pastSession("hist-30m", "2026-06-01", 8, { dist: 30, faceD: 80 })], // 30m の記録歴あり
      active: activeSession("e2e-cond-first", localToday(), 9), // 初めての 70m
    }),
  );
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await page.getByTestId("active-finish").click();
  const empty = page.getByTestId("todays-result-empty");
  await expect(empty).toBeVisible();
  await expect(empty).toHaveText("この条件では初記録。次回から比較が始まります。");
  expect(unexpectedErrors).toEqual([]);
});

test("history detail sheet reconstructs the panel with この日 wording and no future leakage", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(
    page,
    blankDb({
      sessions: [
        pastSession("h-old", "2026-06-01", 8), // 48点
        pastSession("h-new", "2026-06-03", 9), // 54点
        pastSession("h-later", "2026-06-05", 10), // h-new より未来: h-new の再構成に混入してはならない
      ],
    }),
  );
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await mainTab(page, "履歴").click();
  await expect(page.locator("#main")).toContainText("練習履歴");

  // 中間セッション（6/3）: 「この日」で再構成され、前回=6/1（未来の 6/5 は混入しない）
  await page.locator('.historyRow[data-id="h-new"]').click();
  const panel = page.getByTestId("todays-result");
  await expect(panel).toBeVisible();
  const weeklyRow = page.getByTestId("todays-result-weekly");
  await expect(weeklyRow).toContainText("前回（2026/6/1）より +6点");
  await expect(weeklyRow).toContainText("この日 54点 ・ 2026/6/1 48点");
  await expect(panel).not.toContainText("今日");
  await expect(panel).not.toContainText("2026/6/5");
  await page.locator("#hClose").click();
  await expect(page.locator(".ovl")).toHaveCount(0);

  // 最古セッション（6/1）: その日時点では真の初回 → 回顧時制の初回コピー
  await page.locator('.historyRow[data-id="h-old"]').click();
  const empty = page.getByTestId("todays-result-empty");
  await expect(empty).toBeVisible();
  await expect(empty).toHaveText("初回記録: この日が基準になりました。");
  await page.locator("#hClose").click();
  expect(unexpectedErrors).toEqual([]);
});
