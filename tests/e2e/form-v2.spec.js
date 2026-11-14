"use strict";
/* global db, openSettings, formV2StartReplay, render */
/* 射型の記録 v2（AN-100）: 入にする → 置き方 → 撮る → 解析 → 結果 → 射数を直す → 保存 → 一覧。
   カメラ・姿勢推定・コマの時刻は合成の列で代える（tests/e2e/fixtures/form-v2-stream.js。実射の映像は使わない）。 */
const { expect, test } = require("@playwright/test");
const fs = require("fs");
const {
  formV2Stream,
  installFormV2Stub,
  auditFormV2Screen,
  formV2Records,
  DIAG_FORBIDDEN_KEYS,
  diagnosticKeyPaths,
} = require("./fixtures/form-v2-stream.js");

const KEY = "archeryNote.v1";
const LEGACY = [
  {
    id: "old-1",
    date: "2026-09-19",
    ts: 1789776000000,
    sessionId: null,
    setupId: null,
    shots: 2,
    modelVer: "pose_landmarker_lite v1 (tasks-vision 0.10.14)",
    appVer: 120,
    fps: 28.5,
    features: [
      { phase: { anchorMs: 1800 }, angles: { bowArm: 171, drawArm: 150 }, anchorNorm: 0.21 },
      { phase: { anchorMs: 2100 }, angles: { bowArm: 173, drawArm: 148 }, anchorNorm: 0.22 },
    ],
    note: "",
  },
  {
    id: "old-2",
    date: "2026-10-02",
    ts: 1790899200000,
    sessionId: null,
    setupId: null,
    shots: 1,
    modelVer: "pose_landmarker_lite v1 (tasks-vision 0.10.14)",
    appVer: 127,
    fps: 29.1,
    features: [
      { phase: { anchorMs: 2000 }, angles: { bowArm: 175, drawArm: 151 }, anchorNorm: 0.2 },
    ],
    note: "",
    cap: {
      g: 2,
      fw: 720,
      fh: 1280,
      mw: 720,
      mh: 1280,
      o: "p",
      crop: 0,
      facing: "environment",
      hand: "right",
      src: "live",
    },
  },
];
function formDb(overrides = {}) {
  const { settings = {}, ...rest } = overrides;
  return {
    schema: 5,
    setups: [],
    sightMarks: [],
    sessions: [],
    trash: [],
    formAnalyses: [],
    customRounds: [],
    settings: {
      eyeSight: 850,
      theme: "dark",
      lastBackupAt: null,
      activeGuideSeen: true,
      onboardingSeen: true,
      launchCount: 1,
      formTrackingEnabled: true,
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
      ...settings,
    },
    gamification: { badges: [] },
    active: null,
    ...rest,
  };
}
async function openFormTab(page, database, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ([key, value]) => {
      if (!globalThis.localStorage.getItem(key))
        globalThis.localStorage.setItem(key, JSON.stringify(value));
    },
    [KEY, database],
  );
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator('#analysisSubTabs [data-an="form"]').click();
  return errors;
}
const stored = (page) =>
  page.evaluate((key) => JSON.parse(globalThis.localStorage.getItem(key)), KEY);
const screen = (page) => page.getByTestId("form-v2-screen");
const rowState = (page, name) =>
  page.locator(`[data-testid="form-v2-checks"] [data-row="${name}"]`).getAttribute("data-state");

/* 置き方の確認を通って、列を最後まで流し、解析の終わりまで進める */
async function captureToAnalysis(page, stream) {
  await page.locator("#formStart").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "place");
  await expect(page.getByTestId("form-v2-begin")).toBeEnabled();
  await page.evaluate((i) => {
    globalThis.__fv2.placeFrame = i;
  }, stream.holdIndex);
  await expect.poll(() => rowState(page, "向き")).toBe("info");
  await page.getByTestId("form-v2-begin").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "capture");
  await page.waitForFunction(() => globalThis.__fv2.done);
  await page.getByTestId("form-v2-finish").click();
  await expect(page.getByTestId("form-v2-show")).toBeVisible();
}

for (const [label, w, h] of [
  ["portrait", 720, 1280],
  ["landscape", 1280, 720],
]) {
  test(`${label}: enable, place, capture six shots with a let-down, fix the count, save, list`, async ({
    page,
  }) => {
    const before = formDb({ settings: { formTrackingEnabled: false }, formAnalyses: LEGACY });
    const errors = await openFormTab(page, before);
    /* 切のとき: その場で入にする */
    await expect(page.getByTestId("analysis-form-off")).toContainText("保存しません");
    await page.getByTestId("form-v2-enable").click();
    const card = page.getByTestId("analysis-form-card");
    await expect(card.locator("#formStart")).toBeVisible();
    await expect(card.locator("#formStart")).toBeFocused();

    const stream = formV2Stream({ w, h });
    await installFormV2Stub(page, stream);
    await page.locator("#formStart").click();
    await expect(screen(page)).toHaveAttribute("data-stage", "place");
    /* 置き方: 5 行とも、いまの映像から測った値 */
    const checks = page.getByTestId("form-v2-checks");
    await expect(checks.locator("[data-row]")).toHaveCount(5);
    await expect(checks.locator('[data-row="写り"]')).toContainText("8 点が取れています");
    await expect(checks.locator('[data-row="大きさ"]')).toContainText("胴の長さ 200px");
    await expect(checks.locator('[data-row="向き"]')).toContainText(
      "弓を上げる形をすると分かります",
    );
    await expect(checks.locator('[data-row="速さ"]')).toContainText(/毎秒 \d+ コマ/);
    await expect(page.locator("#fv2Tag")).toHaveText(`${w < h ? "縦向き" : "横向き"} ${w}×${h}`);
    /* 弓を上げた形をすると、余白と向きが確定する */
    await page.evaluate((i) => {
      globalThis.__fv2.placeFrame = i;
    }, stream.holdIndex);
    await expect(checks.locator('[data-row="余白"]')).toContainText("弓を上げた形で確かめました");
    await expect(checks.locator('[data-row="向き"]')).toContainText("胸側");
    /* 数えた合図の音は既定で切、動画も切 */
    await expect(page.locator('[data-seg="sound"] [data-val="off"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator('[data-seg="video"] [data-val="off"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    /* 撮る: 大きな射数だけ。骨格・角度・段階名は出さない */
    await page.getByTestId("form-v2-begin").click();
    await expect(screen(page)).toHaveAttribute("data-stage", "capture");
    await page.waitForFunction(() => globalThis.__fv2.done);
    await expect(page.locator("#fv2Num")).toHaveText("6");
    await expect(page.locator("#fv2Ld")).toHaveText("引き戻し 1 回");
    await expect(screen(page).locator("canvas")).toHaveCount(0);
    await expect(screen(page)).not.toContainText(/FULL_DRAW|ANCHORING|°/);
    await expect(page.getByTestId("form-v2-state")).toContainText("体は枠の中です");
    expect(
      await page.locator("#fv2Num").evaluate((e) => e.getBoundingClientRect().height),
    ).toBeGreaterThan(120);

    /* 解析: していることを順に書く */
    await page.getByTestId("form-v2-finish").click();
    const steps = page.getByTestId("form-v2-steps");
    await expect(page.getByTestId("form-v2-show")).toBeVisible();
    await expect(steps).toContainText(/1 分 \d+ 秒、[\d,]+ コマ（毎秒 30 コマ）/);
    await expect(steps).toContainText("6 射、引き戻し 1 回。離れがはっきり写らなかった保持 1 回");
    await expect(steps.locator(".pill")).toHaveText(["済", "済", "済", "済"]);
    await page.getByTestId("form-v2-show").click();

    /* 結果: 数、1 文、時間の帯、数値と根拠 */
    await expect(screen(page)).toHaveAttribute("data-stage", "result");
    await expect(page.getByTestId("form-v2-shots")).toHaveText("6射");
    await expect(page.getByTestId("form-v2-letdowns")).toHaveText("1回");
    await expect(page.getByTestId("form-v2-sentence")).toHaveText(
      /^4 射目は、保持が 5\.\d 秒でした。ほかの 5 射は 3\.\d〜3\.\d 秒です。$/,
    );
    const diff = page.getByTestId("form-v2-diff");
    await expect(diff).toContainText(/ほかの 5 射の中央値との差は \+\d\.\d 秒/);
    await expect(diff).toContainText(/この回の測定のゆれ（±0\.1 秒）から出せる下限は 0\.\d 秒/);
    await expect(diff).toContainText("良し悪しの判定ではありません");
    await expect(diff).not.toContainText("cm"); // 身長の設定が無いので cm は出さない
    await expect(page.getByTestId("form-v2-cand-note")).toContainText(
      "離れがはっきり写らなかった保持が 1 回あります",
    );
    await expect(page.getByTestId("form-v2-summary").locator("svg")).toHaveCount(1);
    await expect(page.getByTestId("form-v2-charts").locator(".fv2Chart")).toHaveCount(6);
    await expect(page.getByTestId("form-v2-charts").locator('[data-key="holdMs"]')).toContainText(
      /ばらつき ±\d\.\d 秒（6 射。射数が少ないので 0\.6〜2\.\d 倍の幅で不確かです）。測定のゆれは ±0\.1 秒。/,
    );
    await expect(page.getByTestId("form-v2-overlay").locator("svg path")).toHaveCount(6);
    await expect(page.getByTestId("form-v2-conditions")).toContainText(
      `${w < h ? "縦向き" : "横向き"}、胴の長さ 200px`,
    );
    await page.getByTestId("form-v2-conditions").locator("summary").click();
    await expect(page.getByTestId("form-v2-conditions")).toContainText("クリッカーが鳴った瞬間");
    /* まだ保存していない */
    expect((await stored(page)).formAnalyses).toEqual(LEGACY);

    /* 射数を直す: 候補を足す */
    await page.getByTestId("form-v2-fix-open").click();
    const fix = page.getByTestId("form-v2-fix");
    await expect(fix.locator(".fv2FixRow")).toHaveCount(8);
    await expect(fix.locator('.fv2FixRow[data-kind="cand"]')).toContainText("射かもしれません");
    await expect(fix.locator('.fv2FixRow[data-kind="cand"]')).toContainText(
      "腕は下ろしましたが、離れの動きが見つかりませんでした",
    );
    await expect(page.getByTestId("form-v2-fix-count")).toHaveText("6 射として記録します。");
    await fix.locator('.fv2Tog[data-src="cd"]').click();
    await expect(page.getByTestId("form-v2-fix-count")).toHaveText("7 射として記録します。");
    await page.getByTestId("form-v2-fix-ok").click();
    await expect(page.getByTestId("form-v2-shots")).toHaveText("7射");
    await expect(page.getByTestId("form-v2-summary")).toContainText("直した数: 足した 1・外した 0");
    await expect(page.getByTestId("form-v2-cand-note")).toHaveCount(0);

    /* 射の詳細: 保存する姿から、この射とほかの射の中央を重ねる */
    await page.getByTestId("form-v2-to-shot").click();
    await expect(screen(page)).toHaveAttribute("data-stage", "shot");
    await expect(screen(page).locator("h3")).toHaveText("4 射目");
    await expect(page.getByTestId("form-v2-shot-overlay").locator("svg path")).toHaveCount(2);
    await expect(page.getByTestId("form-v2-shot-table").locator(".fv2Tr.dif")).not.toHaveCount(0);
    await expect(
      page.getByTestId("form-v2-shot-table").locator('.fv2Tr[data-key="holdMs"]'),
    ).toHaveClass(/dif/);
    await page.getByTestId("form-v2-next").click();
    await expect(screen(page).locator("h3")).toHaveText("5 射目");
    await page.getByTestId("form-v2-back").click();
    await expect(screen(page)).toHaveAttribute("data-stage", "result");

    /* 保存: 押したときだけ。保存したあとも同じ画面に留まる */
    await page.getByTestId("form-v2-save").click();
    await expect(page.getByTestId("form-v2-saved")).toHaveText(
      /^保存しました。数値だけを残しました（1\.\dKB）。$/,
    );
    const after = await stored(page);
    expect(after.formAnalyses.slice(0, 2)).toEqual(LEGACY); // 以前の記録は書き換えない
    expect(after.formAnalyses).toHaveLength(3);
    const rec = after.formAnalyses[2];
    expect(rec.shots).toBe(7);
    expect(rec.features).toEqual([]);
    expect(rec.cap).toEqual({
      g: 3,
      fw: w,
      fh: h,
      mw: w,
      mh: h,
      o: w < h ? "p" : "l",
      crop: 0,
      facing: "environment",
      hand: "right",
      src: "live",
    });
    expect(Object.keys(rec.v2)).toEqual([
      "av",
      "fv",
      "dur",
      "cov",
      "tpx",
      "view",
      "ld",
      "ev",
      "cd",
      "f",
      "nz",
      "nd",
      "ps",
      "pr",
      "ed",
      "w",
    ]);
    expect(rec.v2.ev).toHaveLength(7);
    expect(rec.v2.ev.filter((r) => r[0] === 0)).toHaveLength(6);
    expect(rec.v2.ld).toBe(1);
    expect(rec.v2.cd).toHaveLength(1);
    expect(rec.v2.cd[0][6]).toBe(1);
    expect(rec.v2.ed).toEqual([1, 0]);
    expect(rec.v2.f).toHaveLength(6);
    expect(rec.v2.ps).toHaveLength(6);
    expect(rec.v2.ps[0]).toHaveLength(18);
    expect(rec.v2.pr[0]).toHaveLength(18);
    expect(rec.sessionId).toBeNull();
    const json = JSON.stringify(rec);
    expect(json.length).toBeLessThanOrEqual(2000);
    expect(json).not.toMatch(/landmarks|visibility|blob:|data:/);
    expect(after.schema).toBe(before.schema);

    /* 一覧: 新しい記録と、その下に分けた以前の記録 */
    await page.getByTestId("form-v2-save").click();
    await expect(screen(page)).toHaveCount(0);
    await expect(card.locator("[data-form-v2-id]")).toHaveCount(1);
    await expect(card.locator("[data-form-v2-id]")).toContainText(/7 射\s+保持 3\.\d 秒/);
    await expect(page.getByTestId("form-v2-latest")).toContainText("4 射目は、保持が");
    const legacy = card.getByTestId("analysis-form-legacy");
    await expect(legacy.getByRole("heading", { name: "以前の記録" })).toBeVisible();
    await expect(legacy.locator("[data-form-id]")).toHaveCount(2);
    await expect(legacy).toContainText(
      "測り方が違うので、新しい記録とは比べず、推移にも入れていません",
    );
    await expect(legacy.locator("[data-form-v2-id]")).toHaveCount(0);
    /* 保存した記録を開く: 保存した値だけから同じ結果を描く。射数は直せない */
    await card.locator("[data-form-v2-id]").click();
    await expect(page.getByTestId("form-v2-shots")).toHaveText("7射");
    await expect(page.getByTestId("form-v2-sentence")).toHaveText(
      /^4 射目は、保持が 5\.\d 秒でした。/,
    );
    await expect(page.getByTestId("form-v2-fix-open")).toHaveCount(0);
    await expect(page.getByTestId("form-v2-overlay").locator("svg path")).toHaveCount(6);
    await page.getByTestId("form-v2-save").click();
    /* 以前の記録は、これまでの詳細で開く */
    await legacy.locator('[data-form-id="old-2"]').click();
    await expect(page.locator("#fdClose")).toBeVisible();
    await page.locator("#fdClose").click();
    expect((await stored(page)).formAnalyses.slice(0, 2)).toEqual(LEGACY);
    expect(errors).toEqual([]);
  });
}

test("fix the count can remove a counted shot; the removed shot leaves the comparison", async ({
  page,
}) => {
  await openFormTab(page, formDb());
  const stream = formV2Stream();
  await installFormV2Stub(page, stream);
  await captureToAnalysis(page, stream);
  await page.getByTestId("form-v2-show").click();
  await page.getByTestId("form-v2-fix-open").click();
  const fix = page.getByTestId("form-v2-fix");
  /* 4 射目（保持が長い射）を外す */
  await fix.locator(".fv2FixRow", { hasText: "4 射目" }).locator(".fv2Tog").click();
  await expect(page.getByTestId("form-v2-fix-count")).toHaveText("5 射として記録します。");
  await page.getByTestId("form-v2-fix-ok").click();
  await expect(page.getByTestId("form-v2-shots")).toHaveText("5射");
  await expect(page.getByTestId("form-v2-sentence")).toHaveText(
    "5 射のあいだに、測定のゆれより大きい違いは見つかりませんでした。",
  );
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-saved")).toBeVisible();
  const rec = (await stored(page)).formAnalyses[0];
  expect(rec.shots).toBe(5);
  expect(rec.v2.ed).toEqual([0, 1]);
  expect(rec.v2.f).toHaveLength(6); // 値は残す（比べる対象から外れるだけ）
  /* 保存せずに閉じる道: 保存済みなのでそのまま閉じる */
  await page.getByTestId("form-v2-back").click();
  await expect(screen(page)).toHaveCount(0);
});

test("closing an unsaved result asks first and stores nothing", async ({ page }) => {
  await openFormTab(page, formDb());
  const stream = formV2Stream();
  await installFormV2Stub(page, stream);
  await captureToAnalysis(page, stream);
  await page.getByTestId("form-v2-show").click();
  await page.getByTestId("form-v2-discard").click();
  await expect(page.locator(".confirmSheet")).toContainText("6 射の結果を保存せずに閉じますか？");
  await page.locator("#acCancel").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "result");
  await page.getByTestId("form-v2-discard").click();
  await page.locator("#acOk").click();
  await expect(screen(page)).toHaveCount(0);
  expect((await stored(page)).formAnalyses).toEqual([]);
});

test("the record-video button is visible, at least 44px, and the video only leaves by export", async ({
  page,
}) => {
  await openFormTab(page, formDb());
  const stream = formV2Stream();
  await installFormV2Stub(page, stream, { pauseAt: 600 });
  await page.locator("#formStart").click();
  await expect(page.getByTestId("form-v2-begin")).toBeEnabled();
  await page.getByTestId("form-v2-begin").click();
  const rec = page.getByTestId("form-v2-rec");
  await expect(rec).toBeVisible();
  await expect(rec).toHaveText("動画を残す");
  const box = await rec.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(rec).toHaveAttribute("aria-pressed", "false");
  await rec.click();
  await expect(rec).toHaveAttribute("aria-pressed", "true");
  await expect(rec).toHaveText("録画を止める");
  await page.waitForTimeout(1300); // 実際に映像のかたまりが 1 つたまるまで
  await page.evaluate(() => {
    globalThis.__fv2.pauseAt = null;
  });
  await page.waitForFunction(() => globalThis.__fv2.done);
  await expect(page.getByTestId("form-v2-state")).toContainText(/動画は残り \d+ 分 \d+ 秒/);
  await page.getByTestId("form-v2-finish").click();
  await page.getByTestId("form-v2-show").click();
  const save = page.getByTestId("form-v2-video-save");
  await expect(save).toHaveText(/^動画を端末に保存（\d+(\.\d)?MB）$/);
  await expect(page.getByTestId("form-v2-conditions")).toContainText(
    "この動画はアプリの中には保存されません",
  );
  const download = page.waitForEvent("download");
  await save.click();
  expect((await download).suggestedFilename()).toMatch(
    /^archery-form-\d{4}-\d{2}-\d{2}\.(webm|mp4)$/,
  );
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-saved")).toBeVisible();
  const raw = await page.evaluate((key) => globalThis.localStorage.getItem(key), KEY);
  expect(raw).not.toMatch(/blob:|video\/|webm/);
  expect(raw.length).toBeLessThan(6000);
});

test("the optional height adds cm next to torso percent; without it no cm appears", async ({
  page,
}) => {
  await openFormTab(page, formDb({ settings: { formHeightCm: 170 } }));
  const stream = formV2Stream();
  await installFormV2Stub(page, stream);
  await captureToAnalysis(page, stream);
  await page.getByTestId("form-v2-show").click();
  await expect(page.getByTestId("form-v2-diff")).toContainText(/胴の \d+\.\d%（約 \d+cm）/);
  await expect(page.getByTestId("form-v2-charts")).toContainText(
    "cm は身長 170cm から出した目安で、±5% ほどの幅があります。",
  );
  await page.getByTestId("form-v2-to-shot").click();
  await expect(page.getByTestId("form-v2-shot-table")).toContainText(
    "身長 170cm なら 1% は約 0.5cm",
  );
});

test("the height setting is empty by default and accepts 100-230 cm only", async ({ page }) => {
  await openFormTab(page, formDb());
  expect(await page.evaluate(() => db.settings.formHeightCm)).toBeNull();
  expect(await page.evaluate(() => db.settings.formCountSound)).toBe(false);
  await page.evaluate(() => openSettings());
  const input = page.getByTestId("settings-form-height");
  await input.scrollIntoViewIfNeeded();
  await expect(input).toHaveValue("");
  await input.fill("172");
  await input.blur();
  expect((await stored(page)).settings.formHeightCm).toBe(172);
  await input.fill("30");
  await input.blur();
  await expect(input).toHaveValue("");
  expect((await stored(page)).settings.formHeightCm).toBeNull();
});

for (const [kind, opts, fact] of [
  ["permission", { gumError: "NotAllowedError" }, "カメラを使う許可がありません。"],
  ["nocamera", { gumError: "NotFoundError" }, "カメラが見つかりませんでした。"],
  ["busy", { gumError: "NotReadableError" }, "カメラを始められませんでした。"],
  ["model", { modelFail: true }, "解析の部品（約 15.5MB）を読み込めませんでした。"],
]) {
  test(`error: ${kind} is explained without a raw exception and can be retried`, async ({
    page,
  }) => {
    await openFormTab(page, formDb());
    await installFormV2Stub(page, formV2Stream(), opts);
    await page.locator("#formStart").click();
    const err = page.getByTestId("form-v2-error");
    await expect(err).toHaveAttribute("data-kind", kind);
    await expect(err.locator(".fact")).toHaveText(fact);
    await expect(err).not.toContainText(/synthetic|Error|undefined/);
    expect(await auditFormV2Screen(page)).toEqual([]);
    const calls = () => page.evaluate(() => globalThis.__fv2.poseLoads + globalThis.__fv2.gumCalls);
    const n = await calls();
    await page.locator("#fv2Retry").click();
    await expect(err).toHaveAttribute("data-kind", kind);
    expect(await calls()).toBeGreaterThan(n);
    await page.locator("#fv2ErrClose").click();
    await expect(screen(page)).toHaveCount(0);
    expect((await stored(page)).formAnalyses).toEqual([]);
  });
}

test("error: a device without WebAssembly SIMD is told so before anything is loaded", async ({
  page,
}) => {
  await openFormTab(page, formDb());
  await installFormV2Stub(page, formV2Stream());
  expect(await page.evaluate(() => globalThis.formV2Unsupported())).toBeNull(); // この Chromium は対応している
  await page.evaluate(() => {
    globalThis.formV2Unsupported = () => "simd";
  });
  await page.locator("#formStart").click();
  const err = page.getByTestId("form-v2-error");
  await expect(err).toHaveAttribute("data-kind", "unsupported");
  await expect(err).toContainText("この端末では動きません。");
  await expect(err).toContainText("iOS 16.4 以降");
  await expect(page.locator("#fv2Retry")).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__fv2)).toMatchObject({ poseLoads: 0, gumCalls: 0 });
});

test("zero shots: the reason and the next step are shown instead of a result", async ({ page }) => {
  await openFormTab(page, formDb());
  const stream = formV2Stream({
    events: [
      { kind: "raise", holdMs: 2500 },
      { kind: "raise", holdMs: 2500 },
    ],
  });
  await installFormV2Stub(page, stream);
  await page.locator("#formStart").click();
  await expect(page.getByTestId("form-v2-begin")).toBeEnabled();
  await page.getByTestId("form-v2-begin").click();
  await page.waitForFunction(() => globalThis.__fv2.done);
  await expect(page.locator("#fv2Num")).toHaveText("0");
  await page.getByTestId("form-v2-finish").click();
  const zero = page.getByTestId("form-v2-zero");
  await expect(zero).toContainText("射として数えた区間は 0 回でした。");
  await expect(zero).toContainText("引き切った区間が見つかりませんでした");
  await expect(page.getByTestId("form-v2-show")).toHaveCount(0);
  expect(await auditFormV2Screen(page)).toEqual([]);
  await page.locator("#fv2Again").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "place");
  await expect(page.getByTestId("form-v2-begin")).toBeEnabled();
  await page.getByTestId("form-v2-back").click();
  expect((await stored(page)).formAnalyses).toEqual([]);
});

test("cancelling a capture asks first and leaves nothing behind", async ({ page }) => {
  await openFormTab(page, formDb());
  const stream = formV2Stream();
  await installFormV2Stub(page, stream, { pauseAt: 300 });
  await page.locator("#formStart").click();
  await expect(page.getByTestId("form-v2-begin")).toBeEnabled();
  await page.getByTestId("form-v2-begin").click();
  await page.getByTestId("form-v2-cancel").click();
  await expect(page.locator(".confirmSheet")).toContainText("何も残りません");
  await page.locator("#acOk").click();
  await expect(screen(page)).toHaveCount(0);
  expect((await stored(page)).formAnalyses).toEqual([]);
  expect(await page.evaluate(() => globalThis.document.querySelectorAll("video").length)).toBe(0);
});

test("a saved video goes through the same analyser, is dated from the file, and is not linked to today", async ({
  page,
}) => {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const session = {
    id: "today-session",
    date: todayIso,
    setupId: null,
    dist: 30,
    round: "free",
    faceD: 80,
    faceType: "single",
    perEnd: 3,
    ends: [[{ x: 0, y: 0, s: 10 }]],
  };
  await openFormTab(page, formDb({ sessions: [session] }));
  const stream = formV2Stream();
  await installFormV2Stub(page, stream);
  /* 実際に再生できる短い動画をページの中で作り、2026-10-20 の日付のファイルとして渡す
     （中身は色が変わるだけ。点の列は合成の列を使う。ファイル選択の欄そのものは form-secure-context.spec.js で確かめる） */
  await page.evaluate(async () => {
    const cv = globalThis.document.createElement("canvas");
    cv.width = 180;
    cv.height = 320;
    const cx = cv.getContext("2d");
    let n = 0;
    const timer = setInterval(() => {
      cx.fillStyle = `hsl(${(n += 20) % 360} 40% 40%)`;
      cx.fillRect(0, 0, 180, 320);
    }, 40);
    const rec = new globalThis.MediaRecorder(cv.captureStream(25), { mimeType: "video/webm" });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise((resolve) => (rec.onstop = resolve));
    rec.start();
    await new Promise((resolve) => setTimeout(resolve, 900));
    rec.stop();
    await stopped;
    clearInterval(timer);
    const file = new globalThis.File(chunks, "saved-form.webm", {
      type: "video/webm",
      lastModified: new Date(2026, 9, 20, 15, 4).getTime(),
    });
    formV2StartReplay(file);
  });
  await expect(page.getByTestId("form-v2-show")).toBeVisible();
  await page.getByTestId("form-v2-show").click();
  await expect(page.getByTestId("form-v2-shots")).toHaveText("6射");
  await expect(page.getByTestId("form-v2-letdowns")).toHaveText("1回");
  await expect(screen(page).locator("h3")).toHaveText("10/20（火）の記録");
  await expect(page.getByTestId("form-v2-date")).toHaveValue("2026-10-20");
  await expect(page.getByTestId("form-v2-link")).toHaveValue("");
  await expect(page.getByTestId("form-v2-conditions")).toContainText("保存した動画");
  expect(await page.evaluate(() => globalThis.__fv2.gumCalls)).toBe(0);
  /* 選んだ動画でも、同じように骨格を重ねて確かめられる（もとのファイルを再生する。端末への保存は出さない） */
  await page.getByTestId("form-v2-review").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "review");
  await expect(page.getByTestId("form-v2-review-video")).toHaveAttribute("src", /^blob:/);
  const reviewChips = page.getByTestId("form-v2-review-shots").locator("button");
  await expect(reviewChips).toHaveCount(8);
  await reviewChips.nth(1).click();
  await expect(page.getByTestId("form-v2-review-cam")).toHaveAttribute("data-skel", "1");
  await expect(page.getByTestId("form-v2-review-cam")).toHaveAttribute("data-ghost", "1");
  await expect(page.getByTestId("form-v2-review-tag")).toContainText("2 射目");
  await expect(page.getByTestId("form-v2-review-save")).toHaveCount(0);
  await expect(page.getByTestId("form-v2-review-limits")).toContainText(
    "もとのファイルをそのまま再生しています",
  );
  await page.getByTestId("form-v2-back").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "result");
  /* 撮影日は利用者が変えられる */
  await page.getByTestId("form-v2-date").fill("2026-10-18");
  await expect(screen(page).locator("h3")).toHaveText("10/18（日）の記録");
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-saved")).toBeVisible();
  const rec = (await stored(page)).formAnalyses[0];
  expect(rec.date).toBe("2026-10-18");
  expect(rec.sessionId).toBeNull();
  expect(rec.cap.src).toBe("replay");
  expect(rec.cap.g).toBe(3);
  expect(rec.cap.facing).toBeNull();
  expect(rec.shots).toBe(6);
  expect(rec.v2.ld).toBe(1);
});

test("a live capture links to today's practice by default and the link can be changed", async ({
  page,
}) => {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const session = {
    id: "today-session",
    date: todayIso,
    setupId: null,
    dist: 30,
    round: "free",
    faceD: 80,
    faceType: "single",
    perEnd: 3,
    ends: [[{ x: 0, y: 0, s: 10 }]],
  };
  await openFormTab(page, formDb({ sessions: [session] }));
  const stream = formV2Stream();
  await installFormV2Stub(page, stream);
  await captureToAnalysis(page, stream);
  await page.getByTestId("form-v2-show").click();
  await expect(page.getByTestId("form-v2-link")).toHaveValue("today-session");
  await page.getByTestId("form-v2-link").selectOption("");
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-saved")).toBeVisible();
  expect((await stored(page)).formAnalyses[0].sessionId).toBeNull();
  /* 保存したあとでも紐づけは変えられる */
  await page.getByTestId("form-v2-link").selectOption("today-session");
  expect((await stored(page)).formAnalyses[0].sessionId).toBe("today-session");
});

/* ---------- AN-101: 以前の撮影画面への道が無いこと、検証用の診断、36 射を超えた撮影、推移、以前の記録、動画で確かめる ---------- */
const JUDGEMENT =
  /安定|ばらつき大|ややばらつき|いつも通り|いつもより|原因候補|次の練習|確認点|鮮明さ|良い|悪い|改善|上達/;
/* 40 射 + 引き戻し 1 回（36 射を超える撮影） */
const MANY_SHOTS = Array.from({ length: 41 }, (_, i) =>
  i === 20 ? { kind: "letdown", holdMs: 2500 } : { kind: "shot", holdMs: 1600 + (i % 5) * 150 },
);
/* 以前の方式の記録 4 件（同じ測り方）。古い 3 件があるので、いちばん新しい記録には「以前の 3件の中央値との差」が出る。
   ドリフトの射が半分以上（以前の画面では「原因候補」「次の練習」が出ていた形） */
const OLD_MANY = [0, 1, 2, 3].map((i) => ({
  id: `older-${i}`,
  date: `2026-09-1${i}`,
  ts: 1788998400000 + i * 86400000,
  sessionId: null,
  setupId: null,
  shots: 2,
  modelVer: "pose_landmarker_lite v1 (tasks-vision 0.10.14)",
  appVer: 120,
  fps: 28.5,
  features: [
    {
      phase: { anchorMs: 1800 },
      angles: { bowArm: 170 + i, drawArm: 150 },
      anchorNorm: 0.21,
      release: { stable: false },
      confidence: 0.82,
    },
    {
      phase: { anchorMs: 2100 },
      angles: { bowArm: 172 + i, drawArm: 148 },
      anchorNorm: 0.22,
      release: { stable: false },
      confidence: 0.8,
    },
  ],
  note: "",
}));
/* blob: の URL を作った数と手放した数を数える */
async function watchObjectUrls(page) {
  await page.evaluate(() => {
    const st = (globalThis.__urls = { made: [], revoked: [] });
    const make = URL.createObjectURL.bind(URL),
      drop = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (o) => {
      const u = make(o);
      st.made.push(u);
      return u;
    };
    URL.revokeObjectURL = (u) => {
      st.revoked.push(u);
      return drop(u);
    };
  });
}
const liveUrls = (page) =>
  page.evaluate(() => globalThis.__urls.made.filter((u) => !globalThis.__urls.revoked.includes(u)));

for (const debug of [true, false]) {
  test(`no screen reaches the earlier capture (verification setting ${debug ? "on" : "off"})`, async ({
    page,
  }) => {
    await openFormTab(page, formDb({ settings: { formDebug: debug }, formAnalyses: LEGACY }));
    const stream = formV2Stream();
    await installFormV2Stub(page, stream);
    await page.evaluate(() => {
      for (const name of ["openFormCapture", "openFormReplay", "startFormReplay"]) {
        const real = globalThis[name];
        globalThis.__oldCalls = [];
        globalThis[name] = (...a) => {
          globalThis.__oldCalls.push(name);
          return real(...a);
        };
      }
      render();
    });
    if (debug) {
      await expect(page.getByTestId("form-v2-debug-note")).toContainText("数え方はふだんと同じ");
      await expect(page.getByTestId("form-v2-debug-note")).not.toContainText("以前の撮影画面");
    } else await expect(page.getByTestId("form-v2-debug-note")).toHaveCount(0);
    await page.locator("#formStart").click();
    await expect(screen(page)).toHaveAttribute("data-stage", "place");
    await expect(page.locator(".formCapture")).toHaveCount(0);
    await page.getByTestId("form-v2-back").click();
    const chooser = page.waitForEvent("filechooser");
    await page.locator("#formReplay").click();
    await chooser;
    await expect(page.locator(".formCapture")).toHaveCount(0);
    /* 以前の記録の詳細にも、撮影へ進む操作は無い */
    await page.locator('[data-form-id="old-1"]').click();
    await expect(
      page.getByTestId("form-legacy-detail").locator("button", { hasText: /撮影|解析|記録する/ }),
    ).toHaveCount(0);
    await page.locator("#fdClose").click();
    expect(await page.evaluate(() => globalThis.__oldCalls)).toEqual([]);
  });
}

test("diagnostics on v2: the result exports numbers only; landmarks only with the second setting; nothing extra is stored", async ({
  page,
}) => {
  await openFormTab(page, formDb({ settings: { formDebug: true } }));
  const stream = formV2Stream();
  await installFormV2Stub(page, stream);
  await captureToAnalysis(page, stream);
  await page.getByTestId("form-v2-show").click();
  await expect(page.getByTestId("form-v2-diag-note")).toContainText(
    "解析器の中の値（数値だけ）が付いています",
  );
  const exportOnce = async (expectLandmarks) => {
    await page.getByTestId("form-v2-diag-export").click();
    const sheet = page.locator(".confirmSheet");
    await expect(sheet).toContainText("入るのは数値だけです");
    if (expectLandmarks) await expect(sheet).toContainText("体の 9 点");
    else await expect(sheet).not.toContainText("体の 9 点");
    const download = page.waitForEvent("download");
    await page.locator("#acOk").click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("archery-note-form-diagnostics.json");
    return JSON.parse(fs.readFileSync(await file.path(), "utf8"));
  };
  const out = await exportOnce(false);
  expect(Object.keys(out)).toEqual(["kind", "version", "app", "units", "captures"]);
  expect(out.kind).toBe("archery-note-form-v2-diagnostics");
  expect(out.app.geometry).toBe(3);
  expect(out.captures).toHaveLength(1);
  const c = out.captures[0];
  expect(c.counts).toEqual({ shots: 6, letdowns: 1, candidates: 1, added: 0, removed: 0 });
  expect(c.events).toHaveLength(7);
  expect(c.events.every((e) => e.length === 6 && e.every(Number.isInteger))).toBe(true);
  expect(c.candidates[0][4]).toMatch(/^[a-zA-Z]+$/); // 数えなかった理由
  expect(c.features).toHaveLength(6);
  expect(c.noise).toHaveLength(13);
  expect(c.frame).toEqual({ w: 720, h: 1280, o: "p" });
  expect(c.fps).toBeGreaterThan(20);
  expect(c.analyzer).toBe(1);
  expect(c.view.side).toBe("c");
  expect(["s", "o", "x"]).toContain(c.view.cls);
  expect(c.analyzerDetail.s).toHaveLength(7);
  expect(c.analyzerDetail.r.length).toBeGreaterThanOrEqual(7);
  expect(c.analyzerDetail.pl.st).toHaveLength(5); // 置き方の確認の 5 行
  expect(Math.abs(c.analyzerDetail.pl.tpx - 200)).toBeLessThan(15);
  expect(c.landmarks).toBeUndefined();
  const keys = diagnosticKeyPaths(out).map((k) => k.split(".").pop());
  for (const bad of DIAG_FORBIDDEN_KEYS) expect(keys).not.toContain(bad);
  expect(JSON.stringify(out)).not.toMatch(/blob:|data:|\d{4}-\d{2}-\d{2}/);
  /* 2 つめの設定を入にしたときだけ、体の点の列が入る */
  await page.evaluate(() => {
    db.settings.formDebugLandmarks = true;
  });
  const withLm = await exportOnce(true);
  const lm = withLm.captures[0].landmarks;
  expect(lm.n).toBe(stream.frames.length);
  expect(lm.w).toBe(720);
  expect(lm.p[stream.holdIndex]).toHaveLength(27);
  expect(lm.t).toHaveLength(lm.n);
  /* 保存する記録には、解析器の中の値は付くが、点の列は入らない */
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-saved")).toBeVisible();
  const raw = await page.evaluate((key) => globalThis.localStorage.getItem(key), KEY);
  const rec = JSON.parse(raw).formAnalyses[0];
  expect(rec.v2.dg.v).toBe(1);
  expect(rec.v2.dg.s).toHaveLength(7);
  expect(raw).not.toMatch(/landmarks|"lm"/);
  expect(JSON.stringify(rec).length).toBeLessThan(6000);
});

test("without the verification setting there is no export and no analyser detail in the record", async ({
  page,
}) => {
  await openFormTab(page, formDb());
  const stream = formV2Stream();
  await installFormV2Stub(page, stream);
  await captureToAnalysis(page, stream);
  await page.getByTestId("form-v2-show").click();
  await expect(page.getByTestId("form-v2-diag-export")).toHaveCount(0);
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-saved")).toBeVisible();
  expect((await stored(page)).formAnalyses[0].v2.dg).toBeUndefined();
});

test("more than 36 shots: the capture is split into linked records, every shot kept", async ({
  page,
}) => {
  test.setTimeout(90000);
  const expected = formV2Records({ events: MANY_SHOTS, seed: 11 });
  const total = expected.reduce((n, r) => n + r.shots, 0);
  expect(total).toBeGreaterThan(36);
  expect(expected).toHaveLength(2);
  await openFormTab(page, formDb());
  const stream = formV2Stream({ events: MANY_SHOTS, seed: 11 });
  await installFormV2Stub(page, stream);
  await captureToAnalysis(page, stream);
  await expect(page.getByTestId("form-v2-steps")).toContainText(`${total} 射、引き戻し 1 回`);
  await expect(page.getByTestId("form-v2-steps")).toContainText("2 つの記録に分けます");
  await page.getByTestId("form-v2-show").click();
  const parts = page.getByTestId("form-v2-parts");
  await expect(parts).toContainText(`この撮影は ${total} 射でした`);
  await expect(parts).toContainText("どの射も入っています");
  await expect(parts.locator('[data-seg="part"] button')).toHaveCount(2);
  const first = expected[0].shots;
  await expect(parts.locator('[data-seg="part"] button').first()).toHaveText(`1〜${first}`);
  await expect(parts.locator('[data-seg="part"] button').nth(1)).toHaveText(
    `${first + 1}〜${total}`,
  );
  await expect(page.getByTestId("form-v2-shots")).toHaveText(`${first}射`);
  expect(await auditFormV2Screen(page)).toEqual([]);
  /* 2 つめ: 射の番号は撮影の通し番号 */
  await parts.locator('[data-seg="part"] button').nth(1).click();
  await expect(page.getByTestId("form-v2-shots")).toHaveText(`${total - first}射`);
  await page.getByTestId("form-v2-to-shot").click();
  const head = Number((await screen(page).locator("h3").innerText()).replace(/\D/g, ""));
  expect(head).toBeGreaterThan(first);
  expect(head).toBeLessThanOrEqual(total);
  await page.getByTestId("form-v2-back").click();
  /* 保存は 1 回で全部 */
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-saved")).toContainText("2 つの記録");
  const saved = (await stored(page)).formAnalyses;
  expect(saved).toHaveLength(2);
  expect(saved.reduce((n, r) => n + r.shots, 0)).toBe(total);
  expect(saved.every((r) => r.shots <= 36)).toBe(true);
  expect(saved.reduce((n, r) => n + r.v2.ev.length, 0)).toBe(total + 1);
  expect(saved[0].v2.cid).toBe(saved[0].id);
  expect(saved[1].v2.cid).toBe(saved[0].id);
  expect(saved[0].v2.part).toEqual([1, 2, 0]);
  expect(saved[1].v2.part).toEqual([2, 2, first]);
  expect(saved[1].id).not.toBe(saved[0].id);
  expect(saved.some((r) => "over" in r.v2)).toBe(false);
  /* 一覧には 2 件。どちらから開いても、もう一方へ行ける。推移では 1 回 */
  await page.getByTestId("form-v2-save").click();
  const rows = page.locator("[data-form-v2-id]");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("2 つに分けた記録の 2 つめ");
  await expect(page.getByTestId("form-v2-trend")).toHaveAttribute("data-points", "1");
  await rows.first().click();
  await expect(page.getByTestId("form-v2-parts").locator(".aside")).toHaveText("2 / 2");
  await page.getByTestId("form-v2-parts").locator('[data-seg="part"] button').first().click();
  await expect(page.getByTestId("form-v2-shots")).toHaveText(`${first}射`);
});

/* 推移の検査用: 真横・胸側の 4 回、やや斜めの 1 回、左利きの 1 回（いちばん新しいのは真横・胸側） */
function trendRecords() {
  const day = (i) => `2026-10-${String(10 + i).padStart(2, "0")}`;
  const mk = (i, edit, extra) =>
    formV2Records({
      id: `tr-${i}`,
      date: day(i),
      ts: 1791590400000 + i * 86400000,
      seed: 7 + i,
      edit,
      ...(extra || {}),
    });
  return [
    ...mk(0, null, { setupId: "setup-a" }),
    ...mk(1, (r) => {
      r.v2.view.cls = "o";
    }),
    ...mk(2, null, { setupId: "setup-b" }),
    ...mk(3, (r) => {
      r.cap.hand = "left";
    }),
    ...mk(4),
    ...mk(5),
  ];
}

test("trends: a feature picker, comparable captures only, n and period stated, no judgement words", async ({
  page,
}) => {
  const records = trendRecords();
  await openFormTab(page, formDb({ formAnalyses: [...LEGACY, ...records] }));
  const trend = page.getByTestId("form-v2-trend");
  /* 項目は、既定の 6 項目（保持の時間を含む） */
  await expect(page.getByTestId("form-v2-trend-key").locator("option")).toHaveText([
    "保持の時間",
    "弓手を上げていた時間",
    "弓手の下がり",
    "離れの後ろへの動き",
    "アンカーの高さ（鼻より下）",
    "引き尺の目安",
  ]);
  /* 保持の時間: 置き方が違っても比べる。左利きの 1 回だけ入れない。以前の記録は数えもしない */
  await expect(trend).toHaveAttribute("data-key", "holdMs");
  await expect(trend).toHaveAttribute("data-points", "5");
  await expect(trend).toHaveAttribute("data-excluded", "1");
  await expect(trend.locator("svg circle")).toHaveCount(5);
  await expect(page.getByTestId("form-v2-trend-fact")).toHaveText(
    /^直近 5 回の中央値は \d\.\d〜\d\.\d 秒でした。$/,
  );
  const basis = page.getByTestId("form-v2-trend-basis");
  await expect(basis).toContainText("右利きの記録");
  await expect(basis).toContainText("5 回（10/10〜10/15）、計 30 射、各 6 射");
  await expect(basis).toContainText("入れていない回: 利き手が違う（1 回）。");
  await expect(basis).toContainText("測れなかった値（—）は数えていません");
  await expect(page.getByTestId("form-v2-trend-doubt")).toContainText(/±\d\.\d 秒 ほどの不確かさ/);
  await expect(trend).toContainText("弓具が前の回と違う");
  expect(await trend.innerText()).not.toMatch(JUDGEMENT);
  /* 一覧: 入れていない記録に、そう書く */
  await expect(page.locator('[data-form-v2-id="tr-3"]')).toContainText(
    "選んだ項目の推移には入れていません",
  );
  await expect(page.locator('[data-form-v2-id="tr-1"]')).not.toContainText("入れていません");
  /* 引き尺の目安（面内の項目）: 真横の回だけ */
  await page.getByTestId("form-v2-trend-key").selectOption("ext");
  await expect(trend).toHaveAttribute("data-key", "ext");
  await expect(trend).toHaveAttribute("data-points", "4");
  await expect(trend).toHaveAttribute("data-excluded", "2");
  await expect(basis).toContainText("真横でない（1 回）");
  await expect(basis).toContainText("利き手が違う（1 回）");
  await expect(basis).toContainText("最初の回の中央値を 100% としています");
  await expect(page.getByTestId("form-v2-trend-doubt")).toContainText(
    "その大きさは見積もれていません",
  );
  await expect(page.locator('[data-form-v2-id="tr-1"]')).toContainText(
    "選んだ項目の推移には入れていません",
  );
  expect(await trend.innerText()).not.toMatch(JUDGEMENT);
  expect(await auditFormV2Screen(page)).toEqual([]);
  /* 読むだけで、記録は変わらない */
  expect((await stored(page)).formAnalyses).toEqual([...LEGACY, ...records]);
});

test("trends: fewer than three comparable captures gives the count, not a chart; values that are — are skipped", async ({
  page,
}) => {
  const records = trendRecords().slice(4); // 真横・胸側の 2 回
  for (const row of records[0].v2.f) row[0] = null; // 1 回めの保持の時間は、どの射も測れていない
  await openFormTab(page, formDb({ formAnalyses: records }));
  const trend = page.getByTestId("form-v2-trend");
  await expect(trend).toHaveAttribute("data-points", "1");
  await expect(trend.locator("svg")).toHaveCount(0);
  await expect(page.getByTestId("form-v2-trend-note")).toContainText(
    "「保持の時間」を比べてよい記録は、まだ 1 回です。3 回になると推移を出します。",
  );
  await expect(page.getByTestId("form-v2-trend-note")).toContainText("値を測れた射が無い（1 回）");
  await page.getByTestId("form-v2-trend-key").selectOption("followMs");
  await expect(trend).toHaveAttribute("data-points", "2");
});

test("older records: numbers with their basis, no judgement words or advice, stored data untouched", async ({
  page,
}) => {
  const before = formDb({ formAnalyses: OLD_MANY });
  await openFormTab(page, before);
  const legacy = page.getByTestId("analysis-form-legacy");
  await expect(legacy.locator("[data-form-id]")).toHaveCount(4);
  await expect(legacy.locator('[data-form-id="older-3"] .formRecordComparison')).toHaveText(
    "以前の 3件の中央値 172° との差 +2°",
  );
  await expect(legacy.locator('[data-form-id="older-3"]')).toContainText(
    "アンカーのばらつき σ 0.005（2射）",
  );
  await expect(page.getByTestId("analysis-form-legacy-note")).toContainText(
    "評価の語と助言は、決めた幅に根拠が無いので出していません",
  );
  expect(await legacy.innerText()).not.toMatch(JUDGEMENT);
  await legacy.locator('[data-form-id="older-3"]').click();
  const sheet = page.getByTestId("form-legacy-detail");
  await expect(sheet).toContainText("この記録の値");
  await expect(sheet).toContainText("弓手肘は中央値 174°（前回比 +1°）です。");
  await expect(sheet).toContainText("2射のアンカー位置のばらつきは σ=0.005 です");
  await expect(sheet).toContainText("2射中 2射で、リリース前 0.5 秒に弓手か引き手の動き");
  await expect(sheet.locator("table tr")).toHaveCount(3);
  const text = await sheet.innerText();
  expect(text).not.toMatch(JUDGEMENT);
  expect(text).not.toMatch(/\d+%|可能性があります|してください|しましょう/);
  await page.locator("#fdClose").click();
  expect((await stored(page)).formAnalyses).toEqual(OLD_MANY);
});

test("the shot detail says what is counted, and a value with its cm stays in one piece", async ({
  page,
}) => {
  await openFormTab(page, formDb({ settings: { formHeightCm: 170 } }), {
    width: 375,
    height: 812,
  });
  const stream = formV2Stream();
  await installFormV2Stub(page, stream);
  await captureToAnalysis(page, stream);
  await page.getByTestId("form-v2-show").click();
  /* 候補を足すと 7 射になるが、値を測れた射は 6 射 */
  await page.getByTestId("form-v2-fix-open").click();
  await page.locator('.fv2Tog[data-src="cd"]').click();
  await page.getByTestId("form-v2-fix-ok").click();
  await expect(page.getByTestId("form-v2-shots")).toHaveText("7射");
  const pieces = await page.evaluate(() =>
    [...globalThis.document.querySelectorAll(".fv2Nw")].map((e) => ({
      text: e.textContent,
      lines: e.getClientRects().length,
    })),
  );
  expect(pieces.length).toBeGreaterThan(3);
  expect(pieces.some((x) => /^（約 \d+(\.\d)?cm）$/.test(x.text))).toBe(true);
  expect(pieces.filter((x) => x.lines !== 1)).toEqual([]);
  await page.getByTestId("form-v2-to-shot").click();
  await expect(screen(page).locator(".viewDate")).toContainText("値を測れた 6 射中");
  await expect(screen(page).locator(".viewDate")).not.toContainText("7 射中");
  await expect(page.getByTestId("form-v2-shot-count-note")).toHaveText(
    "この記録の射数は 7 射です。足した 1 射は値を測れていないので、ここで比べているのは 6 射です。",
  );
});

test("video review: seek to a shot, skeleton and the other shots' median pose drawn, save offered, URLs released on leave", async ({
  page,
}) => {
  await openFormTab(page, formDb());
  const stream = formV2Stream();
  await installFormV2Stub(page, stream, { pauseAt: 300 });
  await watchObjectUrls(page);
  await page.locator("#formStart").click();
  await expect(page.getByTestId("form-v2-begin")).toBeEnabled();
  await page.locator('[data-seg="video"] [data-val="on"]').click(); // 動画も残す
  await page.getByTestId("form-v2-begin").click();
  await expect(page.getByTestId("form-v2-rec")).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(1300); // 映像のかたまりが 1 つたまるまで
  await page.evaluate(() => {
    globalThis.__fv2.pauseAt = null;
  });
  await page.waitForFunction(() => globalThis.__fv2.done);
  await page.getByTestId("form-v2-finish").click();
  await page.getByTestId("form-v2-show").click();
  await page.getByTestId("form-v2-review").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "review");
  const cam = page.getByTestId("form-v2-review-cam");
  await expect(page.getByTestId("form-v2-review-video")).toHaveAttribute("src", /^blob:/);
  expect(await liveUrls(page)).toHaveLength(1);
  /* 射の番号: 6 射 + 引き戻し + 数えていない保持 */
  const chips = page.getByTestId("form-v2-review-shots").locator("button");
  await expect(chips).toHaveText(["1", "2", "3", "戻", "4", "5", "？", "6"]);
  await expect(chips.nth(4)).toBeEnabled();
  /* 4 射目へ: 離れの 0.5 秒前。骨格と、ほかの 5 射の中央の姿 */
  const release = stream.truth.filter((t) => t.kind === "shot")[3].releaseMs;
  await chips.nth(4).click();
  await expect(chips.nth(4)).toHaveAttribute("aria-pressed", "true");
  const pos = Number(await cam.getAttribute("data-pos"));
  expect(Math.abs(pos - (release - 500))).toBeLessThan(250);
  await expect(cam).toHaveAttribute("data-skel", "1");
  await expect(cam).toHaveAttribute("data-ghost", "1");
  await expect(page.getByTestId("form-v2-review-tag")).toContainText("4 射目");
  await expect(page.getByTestId("form-v2-review-tag")).toContainText("離れの前");
  const painted = () =>
    page.getByTestId("form-v2-review-canvas").evaluate((cv) => {
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
  const both = await painted();
  expect(both).toBeGreaterThan(500);
  expect(
    await page.getByTestId("form-v2-review-canvas").evaluate((cv) => [cv.width, cv.height]),
  ).toEqual([720, 1280]);
  /* 動画そのものも、その時刻へ送っている（合成の動画は短いので、終わりで止まる） */
  expect(
    await page.getByTestId("form-v2-review-video").evaluate((v) => v.currentTime),
  ).toBeGreaterThan(0);
  /* 白い線だけを消す → 骨格だけ。骨格も消す → 何も描かない */
  await page.locator('[data-seg="ghost"] [data-val="off"]').click();
  await expect(cam).toHaveAttribute("data-ghost", "0");
  const skeletonOnly = await painted();
  expect(skeletonOnly).toBeLessThan(both);
  expect(skeletonOnly).toBeGreaterThan(200);
  await page.locator('[data-seg="skel"] [data-val="off"]').click();
  await expect(cam).toHaveAttribute("data-skel", "0");
  expect(await painted()).toBe(0);
  await page.locator('[data-seg="skel"] [data-val="on"]').click();
  /* 1 コマ送り、離れのあと、速さ */
  await page.getByTestId("form-v2-review-next").click();
  const stepped = Number(await cam.getAttribute("data-pos"));
  expect(stepped - pos).toBeGreaterThan(20);
  expect(stepped - pos).toBeLessThan(50);
  await page.getByTestId("form-v2-review-pos").fill(String(Math.round((release + 300) / 10) * 10));
  await expect(page.getByTestId("form-v2-review-tag")).toContainText("離れのあと");
  await page.locator('[data-seg="rate"] [data-val="0.25"]').click();
  expect(await page.getByTestId("form-v2-review-video").evaluate((v) => v.playbackRate)).toBe(0.25);
  /* 上限と、残らないことが書いてある。保存はここからもできる */
  await expect(page.getByTestId("form-v2-review-limits")).toContainText(
    "最長 10 分・約 1.5Mbps（約 110MB まで）",
  );
  await expect(page.getByTestId("form-v2-review-limits")).toContainText(
    "アプリの中には保存されません",
  );
  expect(await auditFormV2Screen(page)).toEqual([]);
  const download = page.waitForEvent("download");
  await page.getByTestId("form-v2-review-save").click();
  expect((await download).suggestedFilename()).toMatch(/^archery-form-.*\.(webm|mp4)$/);
  /* 結果へ戻ると、確かめるために作った URL を手放す */
  await page.getByTestId("form-v2-back").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "result");
  await expect.poll(() => liveUrls(page)).toEqual([]);
  /* もう一度開ける。開いたまま閉じても、何も残らない */
  await page.getByTestId("form-v2-review").click();
  expect(await liveUrls(page)).toHaveLength(1);
  await page.getByTestId("form-v2-back").click();
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-saved")).toBeVisible();
  await page.getByTestId("form-v2-review").click();
  await page.evaluate(() => globalThis.document.querySelector("#fv2Back").click());
  await page.getByTestId("form-v2-save").click(); // 射型へ戻る
  await expect(screen(page)).toHaveCount(0);
  expect(await liveUrls(page)).toEqual([]);
  expect(await page.evaluate(() => globalThis.document.querySelectorAll("video").length)).toBe(0);
  const raw = await page.evaluate((key) => globalThis.localStorage.getItem(key), KEY);
  expect(raw).not.toMatch(/blob:|video\/|webm/);
  /* 保存した記録を一覧から開いたときは、動画も点の列も無いので、確かめる画面は出ない */
  await page.locator("[data-form-v2-id]").click();
  await expect(page.getByTestId("form-v2-review")).toHaveCount(0);
});

for (const theme of ["light", "dark"]) {
  test(`trends, split records, older records and the diagnostics setting fit 320×640 (${theme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const many = formV2Records({
      id: "many",
      date: "2026-10-20",
      ts: 1792454400000,
      seed: 11,
      events: MANY_SHOTS,
    });
    const errors = await openFormTab(
      page,
      formDb({
        settings: { theme, formHeightCm: 170, formDebug: true },
        formAnalyses: [
          ...OLD_MANY,
          ...trendRecords(),
          ...formV2Records({ id: "extra", date: "2026-10-18", ts: 1792281600000, seed: 3 }),
          ...many,
        ],
      }),
      { width: 320, height: 640 },
    );
    const check = async (name) => expect(await auditFormV2Screen(page), name).toEqual([]);
    await check("home with a trend");
    for (const key of ["followMs", "bowDy", "relBack", "ancY", "ext"]) {
      await page.getByTestId("form-v2-trend-key").selectOption(key);
      await expect(page.getByTestId("form-v2-trend")).toHaveAttribute("data-key", key);
      await check(`trend ${key}`);
    }
    await page.getByTestId("form-v2-list-all").click();
    await expect(page.locator("[data-form-v2-id]")).toHaveCount(9);
    await check("all records listed");
    await page.locator('[data-form-id="older-3"]').click();
    await check("older record detail");
    await page.locator("#fdClose").click();
    await page.locator('[data-form-v2-id="many"]').click();
    await expect(page.getByTestId("form-v2-parts")).toBeVisible();
    await check("split record");
    await page.getByTestId("form-v2-diag-export").click();
    await check("diagnostics confirmation");
    await page.locator("#acCancel").click();
    await page.getByTestId("form-v2-save").click();
    await page.locator('#tabs [data-v="record"]').click();
    await page.locator("#btnSettings").click();
    await page.getByTestId("form-diagnostic-section").scrollIntoViewIfNeeded();
    await check("settings with the diagnostics section");
    expect(errors).toEqual([]);
  });
}

for (const theme of ["light", "dark"]) {
  test(`every v2 screen fits 320×640 with readable text and 44px controls (${theme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = await openFormTab(
      page,
      formDb({
        settings: { theme, formTrackingEnabled: false, formHeightCm: 170 },
        formAnalyses: LEGACY,
      }),
      { width: 320, height: 640 },
    );
    const check = async (name) => expect(await auditFormV2Screen(page), name).toEqual([]);
    await check("off");
    await page.getByTestId("form-v2-enable").click();
    await check("home (no v2 record)");
    const stream = formV2Stream();
    await installFormV2Stub(page, stream, { pauseAt: 1500 });
    await page.locator("#formStart").click();
    await expect(page.getByTestId("form-v2-begin")).toBeEnabled();
    await page.locator('[data-seg="video"] [data-val="on"]').click(); // 動画も残す（あとで「動画で確かめる」を見る）
    await check("place (at rest)");
    await page.evaluate((i) => {
      globalThis.__fv2.placeFrame = i;
    }, stream.holdIndex);
    await expect.poll(() => rowState(page, "向き")).toBe("info");
    await check("place (bow raised)");
    await page.getByTestId("form-v2-begin").click();
    await page.waitForFunction(() => globalThis.__fv2.i >= 1500);
    await expect(page.locator("#fv2Num")).toHaveText("3");
    await check("capture");
    /* 主ボタンは、送らなくても見える */
    const finish = await page.getByTestId("form-v2-finish").boundingBox();
    expect(finish.y + finish.height).toBeLessThanOrEqual(640);
    await page.evaluate(() => {
      globalThis.__fv2.pauseAt = null;
    });
    await page.waitForFunction(() => globalThis.__fv2.done);
    await page.getByTestId("form-v2-finish").click();
    await expect(page.getByTestId("form-v2-show")).toBeVisible();
    await check("analysing");
    await page.getByTestId("form-v2-show").click();
    await check("result");
    await page.getByTestId("form-v2-conditions").locator("summary").click();
    await check("result (what one camera cannot see)");
    await page.getByTestId("form-v2-review").click();
    await page.getByTestId("form-v2-review-shots").locator("button").nth(4).click();
    await expect(page.getByTestId("form-v2-review-cam")).toHaveAttribute("data-skel", "1");
    await check("video review");
    await page.getByTestId("form-v2-back").click();
    await page.getByTestId("form-v2-fix-open").click();
    await expect(page.getByTestId("form-v2-fix")).toBeVisible();
    await check("fix the count");
    await page.locator("#fv2FixCancel").click();
    await page.getByTestId("form-v2-to-shot").click();
    await check("shot detail");
    await page.locator('[data-seg="overlay"] [data-val="rel"]').click();
    await check("shot detail (after release)");
    await page.getByTestId("form-v2-back").click();
    await page.getByTestId("form-v2-save").click();
    await expect(page.getByTestId("form-v2-saved")).toBeVisible();
    await check("saved");
    await page.getByTestId("form-v2-save").click();
    await expect(page.locator("[data-form-v2-id]")).toHaveCount(1);
    await check("home (with a v2 record and older records)");
    expect(errors).toEqual([]);
  });
}
