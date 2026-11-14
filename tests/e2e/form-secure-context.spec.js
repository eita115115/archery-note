"use strict";

const { expect, test } = require("@playwright/test");

/* AN-100: 撮影は v2 の画面で開く。https でない開き方では、姿勢推定もカメラも呼ばずに理由を書き、
   保存した動画の解析へ進める（以前は確認ダイアログ → 以前の撮影画面だった） */
const INSECURE_FACT = "この開き方ではカメラを使えません。";
const INSECURE_BASIS =
  "カメラは https で開いたときだけ使えます。保存した動画の解析は、この開き方でも使えます。";

function formDb() {
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
      theme: "auto",
      lastBackupAt: null,
      activeGuideSeen: true,
      onboardingSeen: true,
      launchCount: 0,
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
    },
    gamification: { badges: [] },
    active: null,
  };
}

async function seedDb(page) {
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, formDb());
}

async function installCaptureProbe(page) {
  await page.evaluate(() => {
    globalThis.__captureProbe = { poseLoads: 0, gumCalls: 0 };
    globalThis.loadFormPose = () => {
      globalThis.__captureProbe.poseLoads++;
      return Promise.resolve({});
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia() {
          globalThis.__captureProbe.gumCalls++;
          return new Promise(() => {});
        },
      },
    });
  });
}

test("insecure HTTP blocks live capture before pose/media and offers saved-video replay", async ({
  page,
  baseURL,
}) => {
  await page.route("http://archery-note.test/**", (route) => {
    const source = new URL(route.request().url());
    const local = new URL(source.pathname + source.search, `${baseURL}/`);
    return route.continue({ url: local.href });
  });
  await seedDb(page);

  await page.goto("http://archery-note.test/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator('#analysisSubTabs [data-an="form"]').click(); // v5 段 7: 射型の記録は 分析 > 射型
  await installCaptureProbe(page);

  expect(await page.evaluate(() => globalThis.isSecureContext)).toBe(false);
  await page.locator("#formStart").click();

  const error = page.getByTestId("form-v2-error");
  await expect(error).toHaveAttribute("data-kind", "insecure");
  await expect(error.getByText(INSECURE_FACT, { exact: true })).toBeVisible();
  await expect(error.getByText(INSECURE_BASIS, { exact: true })).toBeVisible();
  await expect(error.getByRole("button", { name: "閉じる", exact: true })).toBeVisible();
  await expect(error.getByRole("button", { name: "もう一度試す", exact: true })).toHaveCount(0);
  const replay = error.getByRole("button", { name: "保存した動画を解析する", exact: true });
  await expect(replay).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__captureProbe)).toEqual({
    poseLoads: 0,
    gumCalls: 0,
  });

  const chooserPromise = page.waitForEvent("filechooser");
  await replay.click();
  const chooser = await chooserPromise;
  expect(await chooser.element().getAttribute("accept")).toBe("video/*");
  expect(chooser.isMultiple()).toBe(false);
  await expect(page.getByTestId("form-v2-screen")).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__captureProbe)).toEqual({
    poseLoads: 0,
    gumCalls: 0,
  });

  /* 読めないファイルは、理由を書いて選び直せる。カメラは呼ばない */
  await chooser.setFiles({
    name: "saved-form.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("e2e replay placeholder"),
  });
  await expect(page.getByTestId("form-v2-screen")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => globalThis.__captureProbe))
    .toEqual({ poseLoads: 1, gumCalls: 0 });
  const fileError = page.getByTestId("form-v2-error");
  await expect(fileError).toHaveAttribute("data-kind", "file");
  await expect(fileError).toContainText("動画を読み込めませんでした。");

  await fileError.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(page.getByTestId("form-v2-screen")).toHaveCount(0);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")).formAnalyses),
  ).toEqual([]);
});

test("trusted loopback HTTP remains eligible for live capture", async ({ page }) => {
  await seedDb(page);

  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator('#analysisSubTabs [data-an="form"]').click(); // v5 段 7: 射型の記録は 分析 > 射型
  await installCaptureProbe(page);

  expect(await page.evaluate(() => globalThis.isSecureContext)).toBe(true);
  await page.locator("#formStart").click();

  const screen = page.getByTestId("form-v2-screen");
  await expect(screen).toHaveAttribute("data-stage", "place");
  await expect(page.getByTestId("form-v2-error")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => globalThis.__captureProbe))
    .toEqual({ poseLoads: 1, gumCalls: 1 });

  await page.getByTestId("form-v2-back").click();
  await expect(screen).toHaveCount(0);
});
