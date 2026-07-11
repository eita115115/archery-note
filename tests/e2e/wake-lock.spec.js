"use strict";

const { expect, test } = require("@playwright/test");

/* Screen Wake Lock（scripts/10-storage-native.js の wakeLock IIFE）の実挙動検証。
   記録セッション中に画面が自動消灯しないよう navigator.wakeLock.request("screen") を握り、
   セッション終了/タブ非表示化で解放・再取得する。headless Chromium の実 Wake Lock API は
   ページの可視性・権限ポリシーに依存し不安定なため、全テストで決定論的な fake に差し替える。 */

const emptySetupDb = {
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
    /* 将来のオンボーディング機能が既存ユーザー扱いでスキップするための先回りシード（現状は未使用キー） */
    onboardingSeen: true,
  },
  active: null,
};

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

function collectWarnings(page) {
  const warnings = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  return warnings;
}

async function seedDb(page, database) {
  await page.addInitScript((db) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(db));
  }, database);
}

/* navigator.wakeLock を fake に差し替える。
   supported:false は Wake Lock API 非対応ブラウザを模す（Navigator.prototype から属性ごと削除
   することで `"wakeLock" in navigator` を確実に false にする。値を undefined にするだけでは
   `in` 判定は true のままなので不十分）。
   rejects:true は request() が NotAllowedError で reject するケースを模す。 */
async function installWakeLockStub(page, { supported = true, rejects = false } = {}) {
  await page.addInitScript(
    ({ supported, rejects }) => {
      globalThis.__wakeLockRequests = [];
      globalThis.__wakeLockReleaseCalls = 0;
      if (!supported) {
        try {
          delete Navigator.prototype.wakeLock;
        } catch {
          /* 削除不可な実装なら次段のアサーションで検知される */
        }
        return;
      }
      class FakeWakeLockSentinel extends EventTarget {
        release() {
          globalThis.__wakeLockReleaseCalls++;
          this.dispatchEvent(new Event("release"));
          return Promise.resolve();
        }
      }
      const fakeWakeLock = {
        request(type) {
          globalThis.__wakeLockRequests.push(type);
          if (rejects) {
            return Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
          }
          const sentinel = new FakeWakeLockSentinel();
          globalThis.__lastSentinel = sentinel;
          return Promise.resolve(sentinel);
        },
      };
      Object.defineProperty(navigator, "wakeLock", { value: fakeWakeLock, configurable: true });
    },
    { supported, rejects },
  );
}

test("starting a record session acquires the screen wake lock exactly once", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await installWakeLockStub(page);
  await seedDb(page, emptySetupDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  expect(await page.evaluate(() => "wakeLock" in navigator)).toBe(true);

  await page.getByTestId("record-start").click();
  await expect(page.getByTestId("active-target")).toBeVisible();

  await expect.poll(() => page.evaluate(() => globalThis.__wakeLockRequests.length)).toBe(1);
  expect(await page.evaluate(() => globalThis.__wakeLockRequests[0])).toBe("screen");
  expect(unexpectedErrors).toEqual([]);
});

test("finishing a record session releases the screen wake lock", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await installWakeLockStub(page);
  await seedDb(page, emptySetupDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await page.getByTestId("record-start").click();

  const target = page.getByTestId("active-target").locator("#tgsvg");
  await target.click(); // 中央タップ=X。1本記録すれば単一距離の終了は確認ダイアログを挟まない
  await expect(page.locator('[data-testid="active-arrow-chips"] .sc')).toHaveCount(1);

  await page.getByTestId("active-finish").click();
  await expect(page.locator(".ovl .sheet")).toBeVisible(); // 終了サマリシート

  await expect.poll(() => page.evaluate(() => globalThis.__wakeLockReleaseCalls)).toBe(1);
  expect(unexpectedErrors).toEqual([]);
});

test("wake lock is reacquired when the tab returns from background", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await installWakeLockStub(page);
  await seedDb(page, emptySetupDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await page.getByTestId("record-start").click();
  await expect.poll(() => page.evaluate(() => globalThis.__wakeLockRequests.length)).toBe(1);

  // タブが背面へ。実ブラウザはこの間に OS 都合でロックを自動解放しうる（sentinel が 'release' を発火）
  await page.evaluate(() => {
    Object.defineProperty(globalThis.document, "hidden", { value: true, configurable: true });
    Object.defineProperty(globalThis.document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    globalThis.document.dispatchEvent(new Event("visibilitychange"));
    globalThis.__lastSentinel.dispatchEvent(new Event("release"));
  });

  // タブが前面へ復帰: reacquire() が wanted&&!sentinel&&!hidden を検知し再取得するはず
  await page.evaluate(() => {
    Object.defineProperty(globalThis.document, "hidden", { value: false, configurable: true });
    Object.defineProperty(globalThis.document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    globalThis.document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect.poll(() => page.evaluate(() => globalThis.__wakeLockRequests.length)).toBe(2);
  expect(unexpectedErrors).toEqual([]);
});

test("unsupported browsers skip wake lock silently and the session keeps working", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await installWakeLockStub(page, { supported: false });
  await seedDb(page, emptySetupDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  expect(await page.evaluate(() => "wakeLock" in navigator)).toBe(false);

  await page.getByTestId("record-start").click();
  const target = page.getByTestId("active-target").locator("#tgsvg");
  await target.click();
  await expect(page.locator('[data-testid="active-arrow-chips"] .sc')).toHaveCount(1);
  expect(unexpectedErrors).toEqual([]);
});

test("a rejected wake lock request warns via console but keeps the session usable", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  const warnings = collectWarnings(page);
  await installWakeLockStub(page, { rejects: true });
  await seedDb(page, emptySetupDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await page.getByTestId("record-start").click();

  await expect.poll(() => page.evaluate(() => globalThis.__wakeLockRequests.length)).toBe(1);
  await expect.poll(() => warnings.some((w) => w.includes("[wakelock]"))).toBe(true);

  const target = page.getByTestId("active-target").locator("#tgsvg");
  await target.click();
  await expect(page.locator('[data-testid="active-arrow-chips"] .sc')).toHaveCount(1);
  // console.warn は collectUnexpectedErrors の対象外（type()==="error" のみ拾う）なので、
  // ここで unexpectedErrors が空であること自体が「UIエラーなし」の直接的な検証になる
  expect(unexpectedErrors).toEqual([]);
});
