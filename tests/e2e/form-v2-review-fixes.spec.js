"use strict";
/* global openSettings, formV2StartReplay, FormAnalyze */
/* 射型の記録 v2（AN-101）の見直しで見つかった点の回帰検査。どれも、直す前は落ちる。
   カメラ・姿勢推定・コマの時刻は合成の列で代える（tests/e2e/fixtures/form-v2-stream.js。実射の映像は使わない）。 */
const { expect, test } = require("@playwright/test");
const fs = require("fs");
const { formV2Stream, installFormV2Stub, formV2Records } = require("./fixtures/form-v2-stream.js");

const KEY = "archeryNote.v1";
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
async function openFormTab(page, database) {
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
const confirmSheet = (page) => page.locator(".confirmSheet");

async function toPlacement(page) {
  await page.locator("#formStart").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "place");
  await expect(page.getByTestId("form-v2-begin")).toBeEnabled();
}
/* 置き方の確認を通って、列を最後まで流し、解析の終わりまで進める */
async function captureToAnalysis(page) {
  await toPlacement(page);
  await page.getByTestId("form-v2-begin").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "capture");
  await page.waitForFunction(() => globalThis.__fv2.done);
  await page.getByTestId("form-v2-finish").click();
}
/* 実際に再生できる短い動画をページの中で作り、保存した動画として渡す（中身は色が変わるだけ。点の列は合成の列を使う） */
async function startReplay(page, ms, lastModified) {
  await page.evaluate(
    async ({ ms, lastModified }) => {
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
      await new Promise((resolve) => setTimeout(resolve, ms));
      rec.stop();
      await stopped;
      clearInterval(timer);
      formV2StartReplay(
        new globalThis.File(chunks, "saved-form.webm", { type: "video/webm", lastModified }),
      );
    },
    { ms, lastModified },
  );
}
const hideApp = (page) =>
  page.evaluate(() => {
    Object.defineProperty(globalThis.document, "hidden", { configurable: true, value: true });
    globalThis.document.dispatchEvent(new globalThis.Event("visibilitychange"));
  });
/* 腕を下ろして立っているだけの列（射は 1 つも無い）。sec 秒ぶん */
function restFrames(stream, sec) {
  const rest = stream.frames[stream.restIndex][1];
  return Array.from({ length: sec * 30 }, (_, i) => [
    Math.round(i * (1000 / 30) * 100) / 100,
    rest,
  ]);
}

/* ---- 1. 解析が例外を投げても「計算中」のまま止まらない ---- */
for (const mode of ["throws", "returns the internal-error warning"]) {
  test(`analysis that ${mode}: an error screen keeps the capture and can retry`, async ({
    page,
  }) => {
    const errors = await openFormTab(page, formDb());
    await installFormV2Stub(page, formV2Stream());
    /* 全体の解析（rhoRef を渡す呼び出し）の 1 回めだけを失敗させる。撮影中の数え方（直近の窓）はそのまま */
    await page.evaluate((mode) => {
      const real = FormAnalyze.analyzePacked;
      let fired = false;
      FormAnalyze.analyzePacked = (pk, opts) => {
        if (opts && "rhoRef" in opts && !fired) {
          fired = true;
          if (mode === "throws") throw new TypeError("synthetic analyser failure");
          return {
            shots: [],
            candidates: [],
            quality: { version: 1, frames: pk.n, coverage: 1, warnings: ["internalError"] },
          };
        }
        return real(pk, opts);
      };
    }, mode);
    await captureToAnalysis(page);
    const err = page.getByTestId("form-v2-error");
    await expect(err).toHaveAttribute("data-kind", "analyze");
    await expect(err).toContainText("解析できませんでした。");
    await expect(err).toContainText("読み取った点の列は、この画面を閉じるまで残っています");
    await expect(err).not.toContainText("synthetic");
    await expect(page.locator(".fv2Steps")).toHaveCount(0); // 「計算中」の画面のままではない
    /* 捨てる前に確かめる。やめれば、点の列は残っている */
    await page.locator("#fv2ErrClose").click();
    await expect(confirmSheet(page)).toContainText("解析せずに捨てますか？");
    await page.locator("#acCancel").click();
    await page.locator("#fv2Analyze").click();
    await expect(page.getByTestId("form-v2-show")).toBeVisible();
    await page.getByTestId("form-v2-show").click();
    await expect(page.getByTestId("form-v2-shots")).toHaveText("6射");
    expect(errors).toEqual([]);
  });
}

/* ---- 2. 読み込んだバックアップの値を、そのまま HTML に入れない ---- */
test("an imported record with markup in v2.part, tpx and cov is shown as text or left out, never as HTML", async ({
  page,
}) => {
  const evil = '<img src=x onerror="globalThis.__xss=1">';
  const [rec] = formV2Records({ id: "evil", date: "2026-11-10", ts: 1794268800000 });
  rec.v2.cid = rec.id;
  rec.v2.part = [evil, 2, 0];
  rec.v2.tpx = evil;
  rec.v2.cov = evil;
  rec.v2.dur = evil;
  rec.shots = evil;
  const errors = await openFormTab(page, formDb({ formAnalyses: [rec] }));
  await expect(page.getByTestId("form-v2-latest")).toBeVisible();
  await page.locator('[data-form-v2-id="evil"]').click();
  await expect(page.getByTestId("form-v2-conditions")).toContainText("姿勢が取れたコマ —%");
  await expect(page.getByTestId("form-v2-conditions")).not.toContainText("胴の長さ");
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  expect(await page.evaluate(() => globalThis.__xss)).toBeUndefined();
  expect(await page.locator("body").innerHTML()).not.toContain("<img src=x");
  expect(errors).toEqual([]);
});

/* ---- 5. 分けた記録で射数を直すと、うしろの記録の番号も合わせ直す ---- */
test("split records: fixing the count in the first part renumbers the second; no number appears twice", async ({
  page,
}) => {
  test.setTimeout(90000);
  /* 40 回のうち 6 回めが引き戻し（1 つめの記録に入る）。39 射 → 20 + 19 */
  const events = Array.from({ length: 40 }, (_, i) =>
    i === 5 ? { kind: "letdown", holdMs: 2500 } : { kind: "shot", holdMs: 1600 + (i % 5) * 150 },
  );
  const expected = formV2Records({ events, seed: 9 });
  expect(expected.map((r) => r.shots)).toEqual([20, 19]);
  await openFormTab(page, formDb());
  await installFormV2Stub(page, formV2Stream({ events, seed: 9 }));
  await captureToAnalysis(page);
  await page.getByTestId("form-v2-show").click();
  const segs = page.getByTestId("form-v2-parts").locator('[data-seg="part"] button');
  await expect(segs.first()).toHaveText("1〜20");
  await expect(segs.nth(1)).toHaveText("21〜39");
  /* 1 つめの記録の引き戻しを、射に数える */
  await page.getByTestId("form-v2-fix-open").click();
  await page.locator('.fv2FixRow[data-kind="letdown"] .fv2Tog').click();
  await expect(page.getByTestId("form-v2-fix-count")).toContainText("21 射");
  await page.getByTestId("form-v2-fix-ok").click();
  await expect(page.getByTestId("form-v2-shots")).toHaveText("21射");
  await expect(segs.first()).toHaveText("1〜21");
  await expect(segs.nth(1)).toHaveText("22〜40");
  await expect(page.getByTestId("form-v2-parts")).toContainText("この撮影は 40 射でした");
  /* 2 つめの記録の最初の射は 22 射目 */
  await segs.nth(1).click();
  await page.getByTestId("form-v2-fix-open").click();
  await expect(page.locator(".fv2FixRow b").first()).toHaveText("22 射目");
  await page.locator("#fv2FixCancel").click();
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-saved")).toBeVisible();
  const saved = (await stored(page)).formAnalyses;
  expect(saved.map((r) => r.shots)).toEqual([21, 19]);
  expect(saved.map((r) => r.v2.part)).toEqual([
    [1, 2, 0],
    [2, 2, 21],
  ]);
  /* 一覧から開き直しても、同じ番号 */
  await page.getByTestId("form-v2-save").click();
  await expect(page.locator("[data-form-v2-id]").first()).toContainText("22 射目から");
});

/* ---- 6. 射型の記録が 1,000 件を超えても、再読み込みで新しい記録が消えない ---- */
test("past 1,000 form records: saving asks first, and the newest record survives a reload", async ({
  page,
}) => {
  test.setTimeout(90000);
  const old = Array.from({ length: 1000 }, (_, i) => ({
    id: `old-${i}`,
    date: "2026-09-01",
    ts: 1788220800000 + i * 1000,
    sessionId: null,
    setupId: null,
    shots: 1,
    modelVer: "pose_landmarker_lite v1 (tasks-vision 0.10.14)",
    appVer: 120,
    fps: 29,
    features: [{ phase: { anchorMs: 2000 }, angles: { bowArm: 172, drawArm: 150 } }],
    note: "",
  }));
  const errors = await openFormTab(page, formDb({ formAnalyses: old }));
  await installFormV2Stub(page, formV2Stream());
  await captureToAnalysis(page);
  await page.getByTestId("form-v2-show").click();
  await page.getByTestId("form-v2-save").click();
  await expect(confirmSheet(page)).toContainText("射型の記録が 1,000 件あります");
  await expect(confirmSheet(page)).toContainText("自動では消しません");
  /* やめると、何も保存されず、結果は画面に残る */
  await page.locator("#acCancel").click();
  await expect(page.getByTestId("form-v2-saved")).toHaveCount(0);
  await expect(page.getByTestId("form-v2-shots")).toHaveText("6射");
  expect((await stored(page)).formAnalyses).toHaveLength(1000);
  await page.getByTestId("form-v2-save").click();
  await page.locator("#acOk").click();
  await expect(page.getByTestId("form-v2-saved")).toBeVisible();
  const saved = (await stored(page)).formAnalyses;
  expect(saved).toHaveLength(1001);
  const id = saved[1000].id;
  expect(saved[1000].shots).toBe(6);
  /* 再読み込みのあとも、いちばん新しい記録がある。古い記録も 1 件も減らない */
  await page.reload();
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator('#analysisSubTabs [data-an="form"]').click();
  await expect(page.locator(`[data-form-v2-id="${id}"]`)).toBeVisible();
  /* 何かを保存し直しても（設定の変更）、件数は変わらない */
  await page.evaluate(() => openSettings());
  await page.locator('[data-testid="settings-form-debug-chips"] button[data-fd="1"]').click();
  const after = (await stored(page)).formAnalyses;
  expect(after).toHaveLength(1001);
  expect(after[1000].id).toBe(id);
  expect(after[0].id).toBe("old-0");
  expect(errors).toEqual([]);
});

/* ---- 7. 「検証用の診断データ」を切にすると、「体の点の列も含める」も切に戻る ---- */
test("turning the verification setting off also clears the landmark option, so it is not re-armed silently", async ({
  page,
}) => {
  await openFormTab(page, formDb({ settings: { formDebug: true, formDebugLandmarks: true } }));
  await page.evaluate(() => openSettings());
  const debug = page.getByTestId("settings-form-debug-chips");
  const lm = page.getByTestId("settings-form-debug-landmarks-chips");
  await expect(lm.locator('button[data-fl="1"]')).toHaveAttribute("aria-pressed", "true");
  await debug.locator('button[data-fd="0"]').click();
  expect((await stored(page)).settings.formDebug).toBe(false);
  expect((await stored(page)).settings.formDebugLandmarks).toBe(false);
  await debug.locator('button[data-fd="1"]').click();
  expect((await stored(page)).settings.formDebug).toBe(true);
  expect((await stored(page)).settings.formDebugLandmarks).toBe(false);
  await expect(lm.locator('button[data-fl="1"]')).toHaveAttribute("aria-pressed", "false");
  await expect(lm.locator('button[data-fl="0"]')).toHaveAttribute("aria-pressed", "true");
});

/* ---- 8. 映像を始め直すと、コマの時刻は最初へ戻る。前の映像の時刻でコマを捨てない ---- */
test("a new camera stream is read from its first frame: after switching the camera on the placement screen", async ({
  page,
}) => {
  const errors = await openFormTab(page, formDb());
  const stream = formV2Stream();
  await installFormV2Stub(page, stream, { restartClock: true, placeFrame: stream.holdIndex });
  await toPlacement(page);
  await page.waitForTimeout(2500); // 最初の映像の時刻を進めておく
  await page.locator('[data-seg="facing"] [data-val="user"]').click();
  await expect(page.getByTestId("form-v2-begin")).toBeEnabled();
  const before = await page.evaluate(() => globalThis.__fv2.detects);
  /* 直す前: 新しい映像の時刻が前の映像の時刻を追い越すまで（ここでは約 2.5 秒）、1 コマも読まれない */
  await expect
    .poll(() => page.evaluate(() => globalThis.__fv2.detects), { timeout: 1200 })
    .toBeGreaterThan(before + 10);
  await expect(page.locator('[data-testid="form-v2-checks"] [data-row="写り"]')).toHaveAttribute(
    "data-state",
    "ok",
    { timeout: 1200 },
  );
  expect(errors).toEqual([]);
});

test("a new camera stream is read from its first frame: a second capture after a zero-shot result", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = await openFormTab(page, formDb());
  const stream = formV2Stream();
  const six = stream.frames;
  /* 1 回め: 200 秒、立っているだけ（0 射）。2 回めの列（約 100 秒）より長い */
  stream.frames = restFrames(stream, 200);
  await installFormV2Stub(page, stream, { restartClock: true });
  await captureToAnalysis(page);
  await expect(page.getByTestId("form-v2-zero")).toContainText("射として数えた区間は 0 回でした。");
  await page.locator("#fv2Again").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "place");
  await expect(page.getByTestId("form-v2-begin")).toBeEnabled();
  /* 置き方を確かめ直す画面でも、すぐに測り始める */
  await expect(page.locator('[data-testid="form-v2-checks"] [data-row="写り"]')).toHaveAttribute(
    "data-state",
    "ok",
    { timeout: 1500 },
  );
  /* 2 回め: 6 射 */
  await page.evaluate((frames) => {
    const st = globalThis.__fv2;
    st.stream.frames = frames;
    st.i = -1;
    st.done = false;
  }, six);
  await page.getByTestId("form-v2-begin").click();
  await page.waitForFunction(() => globalThis.__fv2.done);
  await page.getByTestId("form-v2-finish").click();
  await expect(page.getByTestId("form-v2-show")).toBeVisible();
  await expect(page.getByTestId("form-v2-steps")).toContainText("6 射、引き戻し 1 回");
  await page.getByTestId("form-v2-show").click();
  await expect(page.getByTestId("form-v2-shots")).toHaveText("6射");
  expect(errors).toEqual([]);
});

/* ---- 9. 保存したあとは、射数も撮影日も変えられない（画面と保存した記録が食い違わない） ---- */
test("after saving, the count can no longer be edited and the stored record matches the screen", async ({
  page,
}) => {
  await openFormTab(page, formDb());
  await installFormV2Stub(page, formV2Stream());
  await captureToAnalysis(page);
  await page.getByTestId("form-v2-show").click();
  await expect(page.getByTestId("form-v2-fix-open")).toBeVisible();
  await expect(page.getByTestId("form-v2-cand-note")).toContainText("「射数を直す」で足せます");
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-saved")).toBeVisible();
  await expect(page.getByTestId("form-v2-fix-open")).toHaveCount(0);
  await expect(page.getByTestId("form-v2-cand-note")).not.toContainText("射数を直す");
  await expect(page.getByTestId("form-v2-shots")).toHaveText("6射");
  expect((await stored(page)).formAnalyses.map((r) => r.shots)).toEqual([6]);
});

/* ---- 9・12. 保存した動画: 撮影日を変えると時刻もその日へ移る。保存したあとは撮影日を変えられない ---- */
test("a re-dated video is stored at that date with its time of day, sorts by it, and the date is fixed after saving", async ({
  page,
}) => {
  const older = formV2Records({
    id: "a",
    date: "2026-11-10",
    ts: new Date(2026, 10, 10, 18).getTime(),
    seed: 3,
  });
  const newer = formV2Records({
    id: "b",
    date: "2026-11-12",
    ts: new Date(2026, 10, 12, 18).getTime(),
    seed: 5,
  });
  await openFormTab(page, formDb({ formAnalyses: [...older, ...newer] }));
  await installFormV2Stub(page, formV2Stream({ seed: 9 }));
  /* ファイルの日付は、端末へ写した日（11/14 9:07）。撮ったのは 11/5 */
  await startReplay(page, 900, new Date(2026, 10, 14, 9, 7, 30).getTime());
  await page.getByTestId("form-v2-show").click();
  await expect(screen(page).locator(".fv2Head .viewDate")).toContainText("9:07〜");
  await page.getByTestId("form-v2-date").fill("2026-11-05");
  await expect(screen(page).locator("h3")).toHaveText("11/5（木）の記録");
  await expect(screen(page).locator(".fv2Head .viewDate")).toContainText("9:07〜");
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-saved")).toBeVisible();
  const rec = (await stored(page)).formAnalyses[2];
  expect(rec.date).toBe("2026-11-05");
  expect(rec.ts).toBe(new Date(2026, 10, 5, 9, 7, 30).getTime());
  expect(rec.sessionId).toBeNull();
  await expect(page.getByTestId("form-v2-date")).toHaveCount(0);
  /* 一覧と「直近の記録」は撮影日の順（11/12 がいちばん新しい） */
  await page.getByTestId("form-v2-save").click();
  await expect(page.getByTestId("form-v2-latest").locator(".fv2ChartH")).toContainText("11/12");
  const titles = await page.locator("[data-form-v2-id] b").allInnerTexts();
  expect(titles.map((t) => t.split("（")[0])).toEqual(["11/12", "11/10", "11/5"]);
});

/* ---- 10. 保存した動画の解析で部品の読み込みに失敗したら、同じ動画でやり直す ---- */
test("replay: retrying after a model-load failure reads the same video again and never opens the camera", async ({
  page,
}) => {
  const errors = await openFormTab(page, formDb());
  await installFormV2Stub(page, formV2Stream(), { modelFail: true });
  await startReplay(page, 900, new Date(2026, 9, 20, 15, 4).getTime());
  await expect(page.getByTestId("form-v2-error")).toHaveAttribute("data-kind", "model");
  await page.evaluate(() => {
    globalThis.__fv2.modelFail = false;
  });
  await page.locator("#fv2Retry").click();
  await expect(page.getByTestId("form-v2-show")).toBeVisible();
  expect(await page.evaluate(() => globalThis.__fv2.gumCalls)).toBe(0);
  await page.getByTestId("form-v2-show").click();
  await expect(page.getByTestId("form-v2-shots")).toHaveText("6射");
  await expect(screen(page).locator("h3")).toHaveText("10/20（火）の記録");
  await expect(page.getByTestId("form-v2-conditions")).toContainText("保存した動画");
  expect(errors).toEqual([]);
});

/* ---- 11. 保存していない結果・解析していない読み取りを、確かめずに捨てない ---- */
test("unsaved work is never discarded without asking: the analysis-done screen and the interrupted screen", async ({
  page,
}) => {
  await openFormTab(page, formDb());
  await installFormV2Stub(page, formV2Stream());
  await captureToAnalysis(page);
  await expect(page.getByTestId("form-v2-show")).toBeVisible();
  /* 解析が終わった画面: Escape でも「やめる」でも、まず確かめる */
  await page.keyboard.press("Escape");
  await expect(confirmSheet(page)).toContainText("6 射の結果を保存せずに閉じますか？");
  await page.locator("#acCancel").click();
  await expect(page.getByTestId("form-v2-show")).toBeVisible();
  await page.getByTestId("form-v2-back").click();
  await expect(confirmSheet(page)).toContainText("6 射の結果を保存せずに閉じますか？");
  await page.locator("#acOk").click();
  await expect(screen(page)).toHaveCount(0);
  expect((await stored(page)).formAnalyses).toEqual([]);
  /* 撮影の途中でアプリが裏へ回った（中断）: 「捨てる」も Escape も、まず確かめる */
  await page.evaluate(() => {
    const st = globalThis.__fv2;
    st.i = -1;
    st.done = false;
    st.pauseAt = 900;
  });
  await toPlacement(page);
  await page.getByTestId("form-v2-begin").click();
  await page.waitForFunction(() => globalThis.__fv2.i >= 900);
  await hideApp(page);
  const err = page.getByTestId("form-v2-error");
  await expect(err).toHaveAttribute("data-kind", "interrupted");
  await page.locator("#fv2ErrClose").click();
  await expect(confirmSheet(page)).toContainText(
    "ここまでに読み取った 30 秒ぶんを、解析せずに捨てますか？",
  );
  await page.locator("#acCancel").click();
  await page.keyboard.press("Escape");
  await expect(confirmSheet(page)).toContainText("解析せずに捨てますか？");
  await page.locator("#acCancel").click();
  await expect(err).toBeVisible();
  await page.locator("#fv2Analyze").click();
  await expect(page.getByTestId("form-v2-steps")).toBeVisible();
});

test("nothing to lose, nothing asked: an error before any frame closes at once", async ({
  page,
}) => {
  await openFormTab(page, formDb());
  await installFormV2Stub(page, formV2Stream(), { gumError: "NotAllowedError" });
  await page.locator("#formStart").click();
  await expect(page.getByTestId("form-v2-error")).toHaveAttribute("data-kind", "permission");
  await page.locator("#fv2ErrClose").click();
  await expect(screen(page)).toHaveCount(0);
  await expect(confirmSheet(page)).toHaveCount(0);
});

/* ---- 13. 保存した動画の読み取り: 画面を消さない。止まったら、読み取れたぶんを解析できる ---- */
test("replay reading holds the wake lock and recovers from a pause or from the app going to the background", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = await openFormTab(page, formDb());
  await installFormV2Stub(page, formV2Stream(), { pauseAt: 1500 });
  await page.evaluate(() => {
    const st = globalThis.__fv2;
    st.wakeRequests = 0;
    st.wakeReleases = 0;
    Object.defineProperty(globalThis.navigator, "wakeLock", {
      configurable: true,
      value: {
        async request() {
          st.wakeRequests++;
          return {
            released: false,
            addEventListener() {},
            async release() {
              st.wakeReleases++;
            },
          };
        },
      },
    });
  });
  /* 途中で止まる（列の 1,500 コマめ = 50 秒）。動画そのものは 4 秒あり、まだ再生している */
  await startReplay(page, 4000, new Date(2026, 9, 20, 15, 4).getTime());
  await page.waitForFunction(() => globalThis.__fv2.i >= 1500);
  await expect(screen(page)).toHaveAttribute("data-stage", "reading");
  expect(await page.evaluate(() => globalThis.__fv2.wakeRequests)).toBe(1);
  /* (a) 再生が止まった */
  await page.evaluate(() => globalThis.document.querySelector(".fv2Video").pause());
  const err = page.getByTestId("form-v2-error");
  await expect(err).toHaveAttribute("data-kind", "readStopped");
  await expect(err).toContainText("動画の読み取りが止まりました。");
  await expect(err).toContainText("ここまでの 50 秒は残っています。");
  /* 最初から読み直す → (b) こんどはアプリが裏へ回る */
  await page.evaluate(() => {
    const st = globalThis.__fv2;
    st.i = -1;
    st.done = false;
    st.pauseAt = 2000;
  });
  await page.locator("#fv2Retry").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "reading");
  await page.waitForFunction(() => globalThis.__fv2.i >= 2000);
  await hideApp(page);
  await expect(err).toHaveAttribute("data-kind", "readStopped");
  await expect(err).toContainText("ここまでの 1 分 7 秒は残っています。");
  expect(await page.evaluate(() => globalThis.__fv2.gumCalls)).toBe(0);
  /* ここまでを解析する → 読み取れたぶんの結果 */
  await page.locator("#fv2Analyze").click();
  await expect(page.getByTestId("form-v2-show")).toBeVisible();
  await page.getByTestId("form-v2-show").click();
  const shots = Number((await page.getByTestId("form-v2-shots").innerText()).replace(/\D/g, ""));
  expect(shots).toBeGreaterThanOrEqual(3);
  expect(shots).toBeLessThan(6);
  /* 閉じると手放す */
  await page.getByTestId("form-v2-discard").click();
  await page.locator("#acOk").click();
  await expect(screen(page)).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__fv2.wakeReleases)).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

/* ---- 14. 録画を取り直しても、前の録画の止まる合図が、次の録画のかたまりを消さない ---- */
test("re-recording: a late stop from the first recorder cannot wipe or mix into the second recording", async ({
  page,
}) => {
  await openFormTab(page, formDb());
  await installFormV2Stub(page, formV2Stream(), { pauseAt: 600 });
  /* 録画の代役: 始めるとすぐ先頭のかたまり（H）、止めると 300 ms 遅れて最後のかたまり（T）と stop が届く */
  await page.evaluate(() => {
    let n = 0;
    globalThis.MediaRecorder = class {
      constructor() {
        this.id = ++n;
        this.state = "inactive";
      }
      static isTypeSupported() {
        return true;
      }
      start() {
        this.state = "recording";
        setTimeout(() => this.ondataavailable({ data: new globalThis.Blob([`H${this.id};`]) }), 0);
      }
      stop() {
        this.state = "inactive";
        setTimeout(() => {
          this.ondataavailable({ data: new globalThis.Blob([`T${this.id};`]) });
          this.onstop();
        }, 300);
      }
    };
  });
  await toPlacement(page);
  await page.getByTestId("form-v2-begin").click();
  const rec = page.getByTestId("form-v2-rec");
  await rec.click(); // 1 つめを始める
  await page.waitForTimeout(60);
  await rec.click(); // 1 つめを止める（止まる合図は 300 ms あと）
  await rec.click(); // すぐ 2 つめを始める
  await expect(rec).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500); // 1 つめの止まる合図が、2 つめの録画のあいだに届く
  await expect(rec).toHaveText("録画を止める");
  await rec.click(); // 2 つめを止める
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    globalThis.__fv2.pauseAt = null;
  });
  await page.waitForFunction(() => globalThis.__fv2.done);
  await page.getByTestId("form-v2-finish").click();
  await page.getByTestId("form-v2-show").click();
  const download = page.waitForEvent("download");
  await page.getByTestId("form-v2-video-save").click();
  const file = await (await download).path();
  expect(fs.readFileSync(file, "utf8")).toBe("H2;T2;");
});

/* ---- 15. 以前の記録の詳細: 見出しに解析の部品の名前を出さない。単位は「秒」 ---- */
test("older-record detail: the model name is small print, not the heading, and seconds are written 秒", async ({
  page,
}) => {
  const legacy = {
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
  };
  await openFormTab(page, formDb({ formAnalyses: [legacy] }));
  await page.locator('[data-form-id="old-1"]').click();
  const sheet = page.getByTestId("form-legacy-detail");
  await expect(sheet.locator("h3")).toHaveText(/^射型記録 .*2射$/);
  await expect(sheet.locator("h3")).not.toContainText("pose_landmarker");
  await expect(sheet.getByTestId("form-legacy-model")).toHaveText(
    "解析の版: pose_landmarker_lite v1 (tasks-vision 0.10.14)",
  );
  const cells = await sheet.locator("table td.right").allInnerTexts();
  expect(cells).toEqual(["1.8秒", "2.1秒"]);
  expect(await sheet.locator("table").innerText()).not.toMatch(/\ds/);
  expect((await stored(page)).formAnalyses).toEqual([legacy]);
});
