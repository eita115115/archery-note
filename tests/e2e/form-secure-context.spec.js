"use strict";

const { expect, test } = require("@playwright/test");

const HTTPS_TITLE = "ライブ撮影を開始できません";
const HTTPS_MESSAGE =
  "ライブ撮影には信頼済みのHTTPS接続が必要です。この接続では、保存済み動画の解析を利用できます。";

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
  await installCaptureProbe(page);

  expect(await page.evaluate(() => globalThis.isSecureContext)).toBe(false);
  await page.locator("#formStart").click();

  const dialog = page.getByRole("dialog", { name: HTTPS_TITLE });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(HTTPS_MESSAGE, { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "閉じる", exact: true })).toBeVisible();
  const replay = dialog.getByRole("button", {
    name: "保存動画を選ぶ",
    exact: true,
  });
  await expect(replay).toBeVisible();
  await expect(page.locator(".formCapture")).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__captureProbe)).toEqual({
    poseLoads: 0,
    gumCalls: 0,
  });

  const chooserPromise = page.waitForEvent("filechooser");
  await replay.click();
  const chooser = await chooserPromise;
  expect(await chooser.element().getAttribute("accept")).toBe("video/*");
  expect(chooser.isMultiple()).toBe(false);
  expect(await page.evaluate(() => globalThis.__captureProbe)).toEqual({
    poseLoads: 0,
    gumCalls: 0,
  });

  await chooser.setFiles({
    name: "saved-form.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("e2e replay placeholder"),
  });
  await expect(page.locator("#frVideo")).toBeVisible();
  await expect(page.locator("#fcVideo")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => globalThis.__captureProbe))
    .toEqual({ poseLoads: 1, gumCalls: 0 });

  await page.locator("#frClose").click();
  await expect(page.locator(".formCapture")).toHaveCount(0);
});

test("trusted loopback HTTP remains eligible for live capture", async ({ page }) => {
  await seedDb(page);

  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await installCaptureProbe(page);

  expect(await page.evaluate(() => globalThis.isSecureContext)).toBe(true);
  await page.locator("#formStart").click();

  await expect(page.locator(".formCapture")).toBeVisible();
  await expect(page.getByRole("dialog", { name: HTTPS_TITLE })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => globalThis.__captureProbe))
    .toEqual({ poseLoads: 1, gumCalls: 1 });

  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(page.locator(".formCapture")).toHaveCount(0);
});
