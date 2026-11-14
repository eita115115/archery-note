/* AN-098: 測り方の版（画面の形の補正の有無）が違う射型の記録は互いに比べない。
   合成の記録だけを使う（映像・ランドマークは無い）。 */
const { test, expect } = require("@playwright/test");
test.use({ hasTouch: true });

function geometryDb() {
  const day = (n) => `2026-10-${String(n).padStart(2, "0")}`;
  const record = (id, n, bowArm, cap) => ({
    id,
    date: day(n),
    ts: new Date(day(n) + "T12:00:00").getTime(),
    sessionId: null,
    setupId: null,
    shots: 3,
    modelVer: "synthetic-only",
    features: [0, 1, 2].map((k) => ({
      angles: { bowArm, drawArm: k === 2 && cap ? null : 40 + k },
      phase: { anchorMs: 1500 },
      anchorNorm: 0.2 + k * 0.01,
      release: { bowMove: 0.01, drawMove: 0.01, stable: true },
    })),
    ...(cap ? { cap } : {}),
  });
  const portrait = {
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
  };
  const landscape = { ...portrait, fw: 1280, fh: 720, mw: 1280, mh: 720, o: "l" };
  return {
    schema: 5,
    settings: {
      onboardingSeen: true,
      launchCount: 10,
      activeGuideSeen: true,
      formTrackingEnabled: true,
      theme: "light",
      gamification: { enabled: false },
    },
    setups: [],
    sessions: [],
    sightMarks: [],
    active: null,
    customRounds: [],
    trash: [],
    formAnalyses: [
      record("old-1", 1, 150),
      record("old-2", 2, 151),
      record("old-3", 3, 152),
      record("old-4", 4, 153),
      record("new-1", 10, 174, landscape),
      record("new-2", 11, 176, portrait),
      record("new-3", 12, 178, portrait),
    ],
  };
}

async function open(page) {
  const d = geometryDb();
  await page.addInitScript((seed) => {
    if (!globalThis.localStorage.getItem("archeryNote.v1"))
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(seed));
  }, d);
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').tap();
  await page.locator('#analysisSubTabs [data-an="form"]').tap();
  return d;
}
const stored = (page) =>
  page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).formAnalyses);

test("trend and baseline only use records measured the same way", async ({ page }) => {
  const d = await open(page);
  const card = page.getByTestId("analysis-form-card");
  // 推移は、いちばん新しい記録と同じ測り方の3件だけ（旧記録4件の 150°台は入らない）
  await expect(card.locator("svg title")).toHaveText("弓手肘角度の推移: 3回、174〜178°");
  await expect(card).toContainText(
    "画面の向きによる差を補正する前の記録と後の記録は測り方が違うため、互いに比べていません。",
  );
  // 新しい記録の「いつもより」は旧記録を母集団にしない（同じ測り方は2件で、3件に満たない）
  await expect(card.locator('[data-form-id="new-3"] .formRecordComparison')).toHaveCount(0);
  // 読むだけで、旧記録は書き換えない
  expect(await stored(page)).toEqual(d.formAnalyses);
});

test("detail compares with the previous record of the same geometry only", async ({ page }) => {
  await open(page);
  const card = page.getByTestId("analysis-form-card");
  // 補正後の最初の記録: 直前は旧記録なので前回比を出さない
  await card.locator('[data-form-id="new-1"]').tap();
  const sheet = page.locator(".ovl .sheet");
  await expect(sheet).toContainText("弓手肘は中央値 174°です。");
  await expect(sheet).not.toContainText("（前回比");
  await expect(sheet.getByTestId("form-capture-note")).toHaveText(
    "撮影条件: 横向き（1280×720）・ライブ撮影・右利き。肘の角度は画面の向きによらない測り方です。",
  );
  await sheet.locator("#fdClose").tap();
  // 縦向きの記録は、横向きの補正後の記録と比べる（同じ測り方）
  await card.locator('[data-form-id="new-2"]').tap();
  await expect(sheet).toContainText("弓手肘は中央値 176°（前回比 +2°）です。");
  await expect(sheet.getByTestId("form-capture-note")).toContainText("縦向き（720×1280）");
  // 角度を出せなかった射は「—」
  await expect(sheet.locator("table tr").nth(3).locator("td").nth(2)).toHaveText("—");
  await expect(sheet).toContainText("角度を出せなかった射です");
  await sheet.locator("#fdClose").tap();
  // 旧記録は旧記録どうしで比べ、測り方が違うことを示す
  await card.locator('[data-form-id="old-4"]').tap();
  await expect(sheet).toContainText("弓手肘は中央値 153°（前回比 +1°）です。");
  await expect(sheet.getByTestId("form-capture-note")).toHaveText(
    "この記録は画面の向きによる差を補正する前の測り方です。補正後の記録とは比べていません。",
  );
});
