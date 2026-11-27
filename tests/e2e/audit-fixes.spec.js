/* global db, scorecardSvg */
"use strict";
const { test, expect } = require("@playwright/test");

/* 2026-11 の見直しで見つけた不具合の検査（直す前のスクリプトでは落ちる）。 */
test.use({ serviceWorkers: "block" });

function baseDb(extra) {
  return Object.assign(
    {
      schema: 5,
      setups: [],
      sightMarks: [],
      sessions: [],
      trash: [],
      formAnalyses: [],
      customRounds: [],
      notes: [],
      settings: {
        eyeSight: 850,
        theme: "light",
        onboardingSeen: true,
        activeGuideSeen: true,
        launchCount: 9,
        lastBackupAt: new Date().toISOString(),
        featureHints: {
          gearSetup: true,
          analysis: true,
          sightAdjust: true,
          formTracking: true,
          addToHome: true,
          practiceDays: true,
        },
      },
      active: null,
    },
    extra || {},
  );
}
async function open(page, data) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((d) => {
    if (!globalThis.localStorage.getItem("archeryNote.v1"))
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(d));
  }, data);
  await page.goto("/");
  return errors;
}

test("triple face: a 1mm nudge into the next spot moves the arrow to that spot and scores what the circle touches", async ({
  page,
}) => {
  const errors = await open(
    page,
    baseDb({
      active: {
        id: "triple-nudge",
        date: "2026-11-26",
        setupId: null,
        dist: 18,
        faceD: 40,
        faceType: "triple",
        perEnd: 3,
        arrowR: 0.285,
        round: "free",
        purpose: "practice",
        sightV: "",
        sightH: "",
        wx: "",
        note: "",
        windDir: "",
        windSpeed: "",
        ends: [],
        cur: [],
      },
    }),
  );
  await page.waitForSelector("#tgsvg");
  /* 的の座標（cm、上が正）を画面の位置へ */
  const client = (x, y) =>
    page.evaluate(
      ([px, py]) => {
        const svg = globalThis.document.querySelector("#tgsvg");
        const p = new globalThis.DOMPoint(px, -py).matrixTransform(svg.getScreenCTM());
        return { x: p.x, y: p.y };
      },
      [x, y],
    );
  const tap = async (x, y) => {
    const c = await client(x, y);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.up();
  };
  const cur = () =>
    page.evaluate(() => db.active.cur.map((a) => ({ x: a.x, y: a.y, spot: a.spot, s: a.s })));
  /* 真ん中のスポット（0,0）と上のスポット（0,22）のすき間。真ん中に近いので真ん中のスポットの M */
  await tap(0, 10.9);
  expect(await cur()).toEqual([{ x: 0, y: 10.9, spot: 1, s: 0 }]);
  await page.locator("#curChips .slot").first().click();
  for (let i = 0; i < 9; i++) await page.locator('#nudge [data-n="u"]').click();
  /* 的の上では (0, 11.8)。矢円（半径 0.285cm）は上のスポットの 6点の輪（中心から 10cm）に 0.085cm 重なる */
  expect(await cur()).toEqual([{ x: 0, y: -10.2, spot: 0, s: 6 }]);
  await expect(page.locator("#curChips .slot").first()).toContainText("6");
  /* 描いた矢円の位置は動かす前と同じ並びの上にある（スポットを移しても図の上では 1mm ずつ動くだけ） */
  const drawn = await page.evaluate(() => {
    const c = globalThis.document.querySelector("#tgmarks circle");
    return { cx: +c.getAttribute("cx"), cy: +c.getAttribute("cy") };
  });
  expect(drawn.cx).toBeCloseTo(0, 6);
  expect(drawn.cy).toBeCloseTo(-11.8, 6);
  /* 同じ場所へ置いた矢と同じ記録になる */
  await page.locator("#nudgeDone").click();
  await tap(0, 11.8);
  const both = await cur();
  expect(both[1]).toEqual(both[0]);
  /* 下へ戻すと、もとのスポットの M に戻る */
  await page.locator("#curChips .slot").first().click();
  for (let i = 0; i < 9; i++) await page.locator('#nudge [data-n="d"]').click();
  expect((await cur())[0]).toEqual({ x: 0, y: 10.9, spot: 1, s: 0 });
  expect(errors).toEqual([]);
});

test("scorecard image escapes a custom round name once", async ({ page }) => {
  const round = {
    id: "custom-amp",
    label: "50m & 30m <練習>",
    stages: [{ dist: 50, faceD: 80, arrows: 36 }],
  };
  const errors = await open(
    page,
    baseDb({
      customRounds: [round],
      sessions: [
        {
          id: "sc1",
          date: "2026-11-20",
          setupId: null,
          dist: 50,
          faceD: 80,
          faceType: "single",
          perEnd: 3,
          arrowR: 0.285,
          round: "custom-amp",
          ends: [
            [
              { x: 0, y: 0, s: 10, X: true },
              { x: 5, y: 0, s: 9 },
              { s: 8, src: "key" },
            ],
          ],
        },
      ],
    }),
  );
  await page.waitForSelector("#tabs");
  const svg = await page.evaluate(() => scorecardSvg(db.sessions[0]));
  expect(svg).toContain("2026/11/20 50m 50m &amp; 30m &lt;練習&gt;</text>");
  expect(svg).not.toContain("&amp;amp;");
  expect(svg).not.toContain("&amp;lt;");
  /* 画像として読める（XML として正しい） */
  const parsed = await page.evaluate((text) => {
    const doc = new globalThis.DOMParser().parseFromString(text, "image/svg+xml");
    return {
      error: !!doc.querySelector("parsererror"),
      title: doc.querySelectorAll("text")[1].textContent,
    };
  }, svg);
  expect(parsed).toEqual({ error: false, title: "2026/11/20 50m 50m & 30m <練習>" });
  expect(errors).toEqual([]);
});
