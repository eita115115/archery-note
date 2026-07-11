"use strict";

const { expect, test } = require("@playwright/test");

/* 初回起動オンボーディング（CHANGELOG v1.7.0 / scripts/50-record-view.js の
   shouldShowOnboarding・renderOnboarding・onboardDerived）の実挙動検証。
   専用画面は2枚（ウェルカム／クイック設定）。距離選択で的サイズ・1エンド本数を自動決定し、
   db.active を通常の fStart 開始と同形で生成する。既存ユーザー（記録 or セッティングが
   1件でもある / onboardingSeen 済み）には出さない。 */

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

test("empty db (0 sessions / 0 setups / onboardingSeen:false) shows the welcome screen", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(page, blankDb());

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  const welcome = page.getByTestId("onboard-welcome");
  await expect(welcome).toBeVisible();
  await expect(welcome.locator("h2")).toHaveText("Archery Note");
  await expect(welcome.locator("#obStart")).toHaveText("はじめる");
  await expect(welcome.locator("#obSkip")).toBeVisible();
  // オンボーディング表示中は通常の記録フォームが出ない
  await expect(page.getByTestId("record-start")).toHaveCount(0);
  expect(unexpectedErrors).toEqual([]);
});

test("skip goes straight to the normal record screen and saves onboardingSeen immediately", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(page, blankDb());

  await page.goto("/");
  await expect(page.getByTestId("onboard-welcome")).toBeVisible();

  await page.locator("#obSkip").click();

  await expect(page.getByTestId("onboard-welcome")).toHaveCount(0);
  await expect(page.getByTestId("record-start")).toBeVisible();

  // finishOnboarding() は save() で即時同期書き込みするため、リロードなしで localStorage に反映される
  const db = await readDb(page);
  expect(db.settings.onboardingSeen).toBe(true);
  expect(db.active).toBeNull();
  expect(unexpectedErrors).toEqual([]);
});

test("'はじめる' shows the quick-setup screen with 4 unselected distance chips", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(page, blankDb());

  await page.goto("/");
  await page.locator("#obStart").click();

  const setup = page.getByTestId("onboard-setup");
  await expect(setup).toBeVisible();
  const chips = setup.locator("#obDistChips .onboardChip");
  await expect(chips).toHaveCount(4);
  await expect(chips.nth(0)).toHaveAttribute("data-d", "70");
  await expect(chips.nth(1)).toHaveAttribute("data-d", "50");
  await expect(chips.nth(2)).toHaveAttribute("data-d", "30");
  await expect(chips.nth(3)).toHaveAttribute("data-d", "18");
  // 事前選択なし
  await expect(setup.locator(".onboardChip.on")).toHaveCount(0);
  for (let i = 0; i < 4; i++) {
    await expect(chips.nth(i)).toHaveAttribute("aria-pressed", "false");
  }
  await expect(setup.locator("#obAutoHint")).toHaveText("距離を選んでください");
  await expect(setup.locator("#obGo")).toBeDisabled();
  expect(unexpectedErrors).toEqual([]);
});

const DIST_CASES = [
  { dist: 70, faceD: 122, perEnd: 6 },
  { dist: 50, faceD: 80, perEnd: 6 },
  { dist: 30, faceD: 80, perEnd: 6 },
  { dist: 18, faceD: 40, perEnd: 3 },
];

for (const c of DIST_CASES) {
  test(`selecting ${c.dist}m shows the auto-derived face/end hint and starts a matching db.active`, async ({
    page,
  }) => {
    const unexpectedErrors = collectUnexpectedErrors(page);
    await seedDb(page, blankDb());

    await page.goto("/");
    await page.locator("#obStart").click();

    const chip = page.locator(`#obDistChips .onboardChip[data-d="${c.dist}"]`);
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#obAutoHint")).toHaveText(
      `${c.dist}m → ${c.faceD}cm的・${c.perEnd}本/エンド（あとで変更できます）`,
    );
    const go = page.locator("#obGo");
    await expect(go).toBeEnabled();
    await go.click();

    // オンボーディング画面が消え、通常の記録中画面（active）に直接入る
    await expect(page.getByTestId("onboard-setup")).toHaveCount(0);
    await expect(page.getByTestId("active-target")).toBeVisible();
    await expect(page.getByTestId("active-hud")).toContainText(`${c.dist}m`);

    const db = await readDb(page);
    expect(db.settings.onboardingSeen).toBe(true);
    expect(db.active).toBeTruthy();
    expect(db.active.dist).toBe(c.dist);
    expect(db.active.faceD).toBe(c.faceD);
    expect(db.active.perEnd).toBe(c.perEnd);
    expect(db.active.faceType).toBe("single");
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
    await expect(page.getByTestId("onboard-setup")).toHaveCount(0);
    await expect(page.getByTestId("record-start")).toBeVisible();
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

  await page.evaluate(() => globalThis.localStorage.clear());
  await page.reload();

  await expect(page.locator("#bootFallback")).toBeHidden();
  await expect(page.getByTestId("onboard-welcome")).toBeVisible();
  expect(unexpectedErrors).toEqual([]);
});
