"use strict";

const { expect, test } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/* ゲーミフィケーション（CHANGELOG v1.7.0 / scripts/48-gamification.js の純関数 +
   scripts/60-history-sight-view.js の履歴Hero + scripts/50-record-view.js のバッジ一覧・
   サマリー拡張 + scripts/70-gear-settings.js の設定トグル）の実挙動検証。
   すべて settings.gamification.enabled でゲートされ、無効時はUI・計算とも完全にスキップされる。 */

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
          enabled: false,
          practiceDays: null,
          goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
          backfilledAt: null,
        },
      },
      gamification: { badges: [] },
      active: null,
    },
    overrides,
  );
}

/* 得点に9点未満(8点)を1本混ぜて gold_end/perfect_end を、6本に抑えて tight_group/pb_breaker を、
   単一セッションに留めて week_warrior/month_master/distance_explorer/all_weather を誤発火させない
   「first_arrow だけが解除される」安全な1セッション */
function safeSession(id, date, dist) {
  const faceD = dist >= 60 ? 122 : dist <= 18 ? 40 : 80;
  return {
    id,
    setupId: null,
    date: date || "2026-06-01",
    dist: dist || 70,
    faceD,
    faceType: "single",
    perEnd: 6,
    round: "free",
    sightV: "",
    sightH: "",
    wx: "",
    note: "",
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
  };
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

async function readDb(page) {
  const raw = await page.evaluate(() => globalThis.localStorage.getItem("archeryNote.v1"));
  return JSON.parse(raw);
}

function mainTab(page, name) {
  return page.locator("#tabs").getByRole("button", { name });
}

test("gamification.enabled:false hides the history streak hero and the analysis badge list", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(
    page,
    blankDb({
      sessions: [safeSession("s1", "2026-06-01", 70)],
      settings: {
        eyeSight: 850,
        theme: "auto",
        lastBackupAt: null,
        activeGuideSeen: true,
        onboardingSeen: true,
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
          enabled: false,
          practiceDays: null,
          goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
          backfilledAt: "2026-06-01T00:00:00Z",
        },
      },
    }),
  );

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await mainTab(page, "履歴").click();
  await expect(page.locator("#main")).toContainText("練習履歴");
  await expect(page.getByTestId("gamification-hero")).toHaveCount(0);

  await mainTab(page, "分析").click();
  await expect(page.getByTestId("badge-section")).toHaveCount(0);
  expect(unexpectedErrors).toEqual([]);
});

test("enabling gamification from settings makes the history streak hero appear", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(page, blankDb()); // enabled:false 既定シード

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await page.locator("#btnSettings").click();
  const gamToggle = page.getByTestId("gamify-toggle");
  await expect(gamToggle).not.toBeChecked();
  await expect(page.getByTestId("gamify-day-chips")).toHaveCount(0);

  await gamToggle.click();
  await expect(gamToggle).toBeChecked();
  await expect(page.getByTestId("gamify-day-chips")).toBeVisible();

  await page.locator("#setClose").click();
  await expect(page.locator(".ovl")).toHaveCount(0);

  await mainTab(page, "履歴").click();
  const hero = page.getByTestId("gamification-hero");
  await expect(hero).toBeVisible();
  await expect(page.getByTestId("streak-current")).toHaveText("—");
  await expect(page.getByTestId("hero-streak-setup")).toBeVisible();

  const db = await readDb(page);
  expect(db.settings.gamification.enabled).toBe(true);
  expect(unexpectedErrors).toEqual([]);
});

test("unset practiceDays shows — with a CTA; tapping the hero CTA sets weekdays and switches to streak/goal rings", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(
    page,
    blankDb({
      settings: {
        eyeSight: 850,
        theme: "auto",
        lastBackupAt: null,
        activeGuideSeen: true,
        onboardingSeen: true,
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
          enabled: true,
          practiceDays: null,
          goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
          backfilledAt: "2026-06-01T00:00:00Z",
        },
      },
    }),
  );

  await page.goto("/");
  await mainTab(page, "履歴").click();

  const hero = page.getByTestId("gamification-hero");
  await expect(hero).toBeVisible();
  await expect(page.getByTestId("streak-current")).toHaveText("—");
  await expect(page.getByTestId("hero-streak-setup")).toBeVisible();
  // 目標リング（今日/今週/今月）は practiceDays 未設定でも常に表示される
  await expect(page.locator(".streakGoals .goalRing")).toHaveCount(3);

  await page.getByTestId("hero-streak-setup").click();
  const sheetChips = page.getByTestId("practice-days-sheet-chips");
  await expect(sheetChips).toBeVisible();
  // 日曜(0)を追加でタップして曜日設定できることを確認
  await sheetChips.locator('.gamifyDayChip[data-d="0"]').click();
  await expect(sheetChips.locator('.gamifyDayChip[data-d="0"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#pdSave").click();
  await expect(page.locator(".ovl")).toHaveCount(0);

  await expect(page.getByTestId("streak-current")).toHaveText("0");
  await expect(page.getByTestId("hero-streak-setup")).toHaveCount(0);
  await expect(page.locator(".streakGoals .goalRing")).toHaveCount(3);

  const db = await readDb(page);
  expect(db.settings.gamification.practiceDays).toEqual([0, 1, 3, 5, 6]);
  expect(unexpectedErrors).toEqual([]);
});

test("finishing a session shows a before→after streak row in the summary sheet", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(
    page,
    blankDb({
      settings: {
        eyeSight: 850,
        theme: "auto",
        lastBackupAt: null,
        activeGuideSeen: true,
        onboardingSeen: true,
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
          enabled: true,
          // 全曜日を練習日にして「今日」の曜日に依存しない決定論的なストリーク成長を作る
          practiceDays: [0, 1, 2, 3, 4, 5, 6],
          goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
          backfilledAt: "2026-06-01T00:00:00Z",
        },
      },
    }),
  );

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await page.getByTestId("record-start").click();

  const target = page.getByTestId("active-target").locator("#tgsvg");
  await target.click(); // 中央タップ=X。単一距離1本の終了は確認ダイアログを挟まない
  await page.getByTestId("active-finish").click();

  const summaryGam = page.getByTestId("summary-gamification");
  await expect(summaryGam).toBeVisible();
  await expect(page.getByTestId("summary-streak-num")).toHaveText("1");
  await expect(summaryGam.locator(".summaryStreakBefore")).toHaveText("0");
  await expect(summaryGam.locator(".summaryStreakMsg").first()).toHaveText("連続記録が伸びました");
  // 初回セッションなので「初矢」バッジも同時に解除される
  await expect(page.getByTestId("summary-badges")).toContainText("初矢");
  expect(unexpectedErrors).toEqual([]);
});

test("all 12 badges render in the analysis tab (locked by default); first_arrow unlocks via startup backfill", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(
    page,
    blankDb({
      sessions: [safeSession("backfill-session", "2026-06-01", 70)],
      settings: {
        eyeSight: 850,
        theme: "auto",
        lastBackupAt: null,
        activeGuideSeen: true,
        onboardingSeen: true,
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
          enabled: true,
          practiceDays: null,
          goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
          backfilledAt: null, // 未バックフィル: 90-init.js の起動時一括付与を発火させる
        },
      },
    }),
  );

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await mainTab(page, "分析").click();
  const section = page.getByTestId("badge-section");
  await expect(section).toBeVisible();
  await expect(section).toContainText("1/12");
  await expect(page.getByTestId("badge-card")).toHaveCount(12);

  const firstArrow = page.locator('[data-testid="badge-card"][data-badge="first_arrow"]');
  await expect(firstArrow).not.toHaveClass(/locked/);
  const century = page.locator('[data-testid="badge-card"][data-badge="century"]');
  await expect(century).toHaveClass(/locked/);
  const streak7 = page.locator('[data-testid="badge-card"][data-badge="streak_7"]');
  await expect(streak7).toHaveClass(/locked/);

  const db = await readDb(page);
  expect(db.settings.gamification.backfilledAt).toBeTruthy();
  expect((db.gamification.badges || []).map((b) => b.id)).toEqual(["first_arrow"]);
  expect(unexpectedErrors).toEqual([]);
});

test("importing history with gamification enabled backfills quietly and does not re-fire an already-owned badge on the next session (regression: import badge misfire)", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(
    page,
    blankDb({
      settings: {
        eyeSight: 850,
        theme: "auto",
        lastBackupAt: null,
        activeGuideSeen: true,
        onboardingSeen: true,
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
          enabled: true,
          practiceDays: null,
          goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
          backfilledAt: "2026-06-01T00:00:00Z", // 起動時バックフィルは既に済ませておく（インポート側の挙動だけを見る）
        },
      },
    }),
  );

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  // インポート元データ: badges=[] backfilledAt=null（バックフィル未実施の端末からの持ち込みを模す）
  const importPayload = {
    schema: 5,
    setups: [],
    sightMarks: [],
    sessions: [safeSession("imported-session", "2026-06-15", 70)],
    trash: [],
    formAnalyses: [],
    customRounds: [],
    settings: {
      eyeSight: 850,
      theme: "auto",
      lastBackupAt: null,
      activeGuideSeen: true,
      onboardingSeen: true,
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
        enabled: true,
        practiceDays: null,
        goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
        backfilledAt: null,
      },
    },
    gamification: { badges: [] },
    active: null,
  };
  const tmpFile = path.join(
    os.tmpdir(),
    `archery-note-e2e-import-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
  fs.writeFileSync(tmpFile, JSON.stringify(importPayload));

  try {
    await page.locator("#btnSettings").click();
    await page.locator("#dFile").setInputFiles(tmpFile);

    const confirmSheet = page.locator(".ovl .confirmSheet");
    await expect(confirmSheet).toBeVisible();
    await confirmSheet.locator("#acOk").click();
    await expect(page.locator(".ovl")).toHaveCount(0);

    // インポート直後: サマリーや新規解除の演出は一切出ない（インポートは openSummary を呼ばない経路）
    await expect(page.locator('[data-testid="summary-gamification"]')).toHaveCount(0);

    // 分析タブ: インポート時の同期バックフィルで「初矢」が静かに解除済みになっている
    await mainTab(page, "分析").click();
    const firstArrow = page.locator('[data-testid="badge-card"][data-badge="first_arrow"]');
    await expect(firstArrow).not.toHaveClass(/locked/);

    // 続けて新しいセッションを1本だけ記録して終了 -- 8e22fedd 回帰確認:
    // 既に持っている「初矢」バッジがここで再度「新しく解除」として誤発火しないこと
    await mainTab(page, "記録").click();
    await page.getByTestId("record-start").click();
    const target = page.getByTestId("active-target").locator("#tgsvg");
    await target.click();
    await page.getByTestId("active-finish").click();

    await expect(page.locator(".ovl .sheet")).toBeVisible();
    await expect(page.locator('[data-testid="summary-badges"]')).toHaveCount(0);

    const db = await readDb(page);
    expect((db.gamification.badges || []).map((b) => b.id)).toEqual(["first_arrow"]);
    expect(unexpectedErrors).toEqual([]);
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
});
