"use strict";

const { expect, test } = require("@playwright/test");

/* 初回（scripts/50-record-view.js の shouldShowOnboarding・homeFirstRunBandHtml・onboardDerived）。
   v5: 専用の画面は無く、記録タブの帯が「最初の条件を選ぶ」になって記録の条件へ進む。
   初回は距離を選ぶと的サイズ・1エンドの本数が決まり（18m は 3射）、db.active は通常の開始と
   同じ形で作る。既存ユーザー（記録 or セッティングが1件でもある / onboardingSeen 済み）には出さない。 */

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
        onboardingSeen: false,
      },
      active: null,
    },
    overrides,
  );
}

/* 既存ユーザー扱いにするための最小セッション（normalizeDb の必須条件: id を持つオブジェクト） */
function sampleSession(id, date) {
  return {
    id,
    setupId: null,
    date: date || "2026-06-01",
    dist: 70,
    faceD: 122,
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
        { x: -1.1, y: 0.8, s: 9 },
      ],
    ],
  };
}

function sampleSetup(id) {
  return {
    id,
    name: "E2E recurve setup",
    bow: "Recurve",
    limbs: "Sample limbs",
    poundage: 38,
    history: [],
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

/* addInitScript は同一ページの再ナビゲーション（reload 含む）のたびに再実行されるため、
   sessionStorage の一回限りフラグでガードする。そうしないと「全データ消去→リロード」テストで
   reload 時に再度シードされ、消去した状態が観測できない */
async function seedDb(page, database) {
  await page.addInitScript((db) => {
    if (globalThis.sessionStorage.getItem("__e2eSeeded")) return;
    globalThis.sessionStorage.setItem("__e2eSeeded", "1");
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(db));
  }, database);
}

async function readDb(page) {
  const raw = await page.evaluate(() => globalThis.localStorage.getItem("archeryNote.v1"));
  return JSON.parse(raw);
}

test("empty db (0 sessions / 0 setups / onboardingSeen:false) shows the first-run band", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(page, blankDb());

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  const welcome = page.getByTestId("onboard-welcome");
  await expect(welcome).toBeVisible();
  await expect(welcome.locator(".l")).toHaveText("最初の条件を選ぶ");
  await expect(welcome.locator("#obStart")).toHaveText("条件を選ぶ");
  await expect(welcome.locator("#obDemo")).toHaveText("架空のデモデータで試す");
  await expect(welcome).toContainText("この端末の中だけに保存されます");
  // 初回は「前回と同じ条件」の開始ボタンを出さない（条件を選んでから始める）
  await expect(page.getByTestId("record-start")).toHaveCount(0);
  await expect(page.locator("#quickStart")).toHaveCount(0);
  // 記録が無いので、前回の練習は空の状態を言葉で示す（見本の数値は出さない）
  await expect(page.getByTestId("home-empty")).toContainText("練習の記録はまだありません");
  await expect(page.getByTestId("home-last")).toHaveCount(0);
  await expect(page.getByTestId("home-trend")).toHaveCount(0);
  // 画面名の行とタブは出たまま（v5: 専用のオンボーディング画面は無い）
  await expect(page.locator("#viewTitle")).toHaveText("記録");
  await expect(page.locator("#tabs")).toBeVisible();
  expect(await page.locator("#main").innerText()).not.toMatch(/NaN|undefined|null/);
  expect(unexpectedErrors).toEqual([]);
});

test("the first-run band stays until a record is started; back returns to it unchanged", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(page, blankDb());

  await page.goto("/");
  await page.locator("#obStart").click();
  await expect(page.locator("#condTitle")).toHaveText("記録の条件");
  await expect(page.locator("#tabs")).toBeHidden();
  await page.getByTestId("conditions-back").click();

  await expect(page.getByTestId("onboard-welcome")).toBeVisible();
  await expect(page.locator("#tabs")).toBeVisible();
  const db = await readDb(page);
  expect(db.settings.onboardingSeen).toBe(false);
  expect(db.active).toBeNull();
  expect(db.sessions).toEqual([]);
  expect(unexpectedErrors).toEqual([]);
});

test("'条件を選ぶ' opens the conditions screen with the 4 standard distances", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(page, blankDb());

  await page.goto("/");
  await page.locator("#obStart").click();

  const chips = page.locator("#fDistChips [data-d]");
  await expect(chips).toHaveCount(5);
  await expect(chips.nth(0)).toHaveAttribute("data-d", "70");
  await expect(chips.nth(1)).toHaveAttribute("data-d", "50");
  await expect(chips.nth(2)).toHaveAttribute("data-d", "30");
  await expect(chips.nth(3)).toHaveAttribute("data-d", "18");
  await expect(chips.nth(4)).toHaveAttribute("data-d", "custom");
  // 既定は 70m・122cm・6射の自由練習
  await expect(chips.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#fFace")).toHaveValue("122");
  await expect(page.locator("#fArrows")).toHaveValue("6");
  await expect(page.locator("#fRound")).toHaveValue("free");
  await expect(page.getByTestId("record-start")).toHaveText("この条件で記録を始める");
  expect(unexpectedErrors).toEqual([]);
});

const DIST_CASES = [
  { dist: 70, faceD: 122, perEnd: 6 },
  { dist: 50, faceD: 80, perEnd: 6 },
  { dist: 30, faceD: 80, perEnd: 6 },
  { dist: 18, faceD: 40, perEnd: 3 },
];

for (const c of DIST_CASES) {
  test(`first run: selecting ${c.dist}m sets the face and arrows per end and starts a matching db.active`, async ({
    page,
  }) => {
    const unexpectedErrors = collectUnexpectedErrors(page);
    await seedDb(page, blankDb());

    await page.goto("/");
    await page.locator("#obStart").click();

    const chip = page.locator(`#fDistChips [data-d="${c.dist}"]`);
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#fFace")).toHaveValue(String(c.faceD));
    await expect(page.locator("#fArrows")).toHaveValue(String(c.perEnd));
    await page.getByTestId("record-start").click();

    // 記録の条件が消え、記録中の画面（active）に直接入る
    await expect(page.locator("#condTitle")).toHaveCount(0);
    await expect(page.getByTestId("active-target")).toBeVisible();
    // v5: 条件は記録画面の上部（中断とメニューの間）
    await expect(page.locator(".recTop .condT")).toContainText(`${c.dist}m`);
    await expect(page.getByTestId("active-hud")).toContainText("第1エンド");

    const db = await readDb(page);
    expect(db.settings.onboardingSeen).toBe(true);
    expect(db.active).toBeTruthy();
    expect(db.active.dist).toBe(c.dist);
    expect(db.active.faceD).toBe(c.faceD);
    expect(db.active.perEnd).toBe(c.perEnd);
    expect(db.active.faceType).toBe("single");
    expect(db.active.round).toBe("free");
    expect(db.active.inputMode).toBe("target");
    expect(db.active.ends).toEqual([]);
    expect(db.active.cur).toEqual([]);
    expect(unexpectedErrors).toEqual([]);
  });
}

const EXISTING_USER_CASES = [
  {
    label: "an existing session",
    overrides: { sessions: [sampleSession("existing-session")] },
  },
  {
    label: "an existing setup (no sessions yet)",
    overrides: { setups: [sampleSetup("existing-setup")] },
  },
  {
    label: "onboardingSeen already true",
    overrides: { settings: { onboardingSeen: true } },
  },
];

for (const c of EXISTING_USER_CASES) {
  test(`onboarding does not show for an existing user with ${c.label}`, async ({ page }) => {
    const unexpectedErrors = collectUnexpectedErrors(page);
    const db = blankDb();
    if (c.overrides.sessions) db.sessions = c.overrides.sessions;
    if (c.overrides.setups) db.setups = c.overrides.setups;
    if (c.overrides.settings) Object.assign(db.settings, c.overrides.settings);
    await seedDb(page, db);

    await page.goto("/");
    await expect(page.locator("#bootFallback")).toBeHidden();

    await expect(page.getByTestId("onboard-welcome")).toHaveCount(0);
    await expect(page.getByTestId("record-start")).toBeVisible();
    await expect(page.locator("#quickStart")).toHaveText("記録を始める");
    expect(unexpectedErrors).toEqual([]);
  });
}

test("clearing all data and reloading shows onboarding again", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(
    page,
    blankDb({
      sessions: [sampleSession("existing-session")],
      settings: {
        eyeSight: 850,
        theme: "auto",
        lastBackupAt: null,
        activeGuideSeen: true,
        onboardingSeen: true,
      },
    }),
  );

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await expect(page.getByTestId("onboard-welcome")).toHaveCount(0);
  await expect(page.getByTestId("record-start")).toBeVisible();

  // 手動のフルリセットを模擬。localStorage.clear() だけだと、page.reload() 時の
  // pagehide → flushPendingSave が、保留中の scheduleSave（例: launchCount++）を
  // 使ってメモリ上の db を localStorage に書き戻し、リセットが無効化されうる。
  // reload 前に localStorage.setItem を no-op にして、pagehide の書き戻しを封じる。
  // reload 後は JS コンテキストが刷新され setItem は正常に戻るが、addInitScript の
  // __e2eSeeded ガード（sessionStorage 保持）で seed 再走行はされない。
  await page.evaluate(() => {
    globalThis.localStorage.setItem = () => {};
    globalThis.localStorage.clear();
  });
  await page.reload();

  await expect(page.locator("#bootFallback")).toBeHidden();
  await expect(page.getByTestId("onboard-welcome")).toBeVisible();
  expect(unexpectedErrors).toEqual([]);
});
