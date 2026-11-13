/* global db */
"use strict";

const { expect, test } = require("@playwright/test");
const { pauseRecording, resumeRecording } = require("./record-helpers");

/* 記録画面を離れたときの後片付けと、記録ごとの状態:
   - 拡大鏡の固定レイヤー（body 直下の .lensLayer）は、記録画面を出していないときに残さない
   - PointerEvent の無いブラウザで window に付けるマウスの受け口は、描き直しで増えず、記録画面を離れると外れる
   - 中心の拡大は記録ごと（別の記録に入ると拡大していない状態から）
   - @container の無いブラウザでも、短い画面で修正バーを開くと欠けたスコア表を隠す */

const nine = { x: 8, y: 0, s: 9, X: false };

function seedDb(active) {
  return {
    schema: 3,
    setups: [{ id: "e2e-setup", name: "E2E recurve setup", bow: "Recurve", history: [] }],
    sightMarks: [],
    sessions: [],
    trash: [],
    formAnalyses: [],
    customRounds: [],
    settings: {
      eyeSight: 850,
      theme: "light",
      lastBackupAt: null,
      onboardingSeen: true,
      activeGuideSeen: true,
      launchCount: 9,
    },
    active: Object.assign(
      {
        id: "e2e-active",
        date: "2026-11-12",
        setupId: "e2e-setup",
        dist: 70,
        faceD: 122,
        faceType: "single",
        perEnd: 6,
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
      active,
    ),
  };
}

async function open(page, active) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((data) => {
    if (!globalThis.localStorage.getItem("archeryNote.v1"))
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(data));
  }, seedDb(active));
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  return errors;
}

test("the lens layer is removed when the recording screen is left and comes back on resume", async ({
  page,
}) => {
  const errors = await open(page, { cur: [nine] });
  const layers = page.locator("body > .lensLayer");
  await expect(layers).toHaveCount(1);
  await pauseRecording(page);
  await expect(layers).toHaveCount(0);
  await page.locator('#tabs [data-v="history"]').click();
  await expect(layers).toHaveCount(0);
  await page.locator('#tabs [data-v="record"]').click();
  await resumeRecording(page);
  await expect(layers).toHaveCount(1);
  await expect(page.locator("body > .lensLayer #lens")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("without PointerEvent, window mouse listeners do not pile up and are removed off the recording screen", async ({
  page,
}) => {
  await page.addInitScript(() => {
    /* PointerEvent の無いブラウザを再現し、window の mousemove / mouseup の付け外しを数える */
    Object.defineProperty(globalThis, "PointerEvent", { value: undefined, configurable: true });
    const live = { mousemove: new Set(), mouseup: new Set() };
    globalThis.__liveMouse = () => live.mousemove.size + live.mouseup.size;
    const add = globalThis.addEventListener.bind(globalThis);
    const remove = globalThis.removeEventListener.bind(globalThis);
    globalThis.addEventListener = (type, fn, opts) => {
      if (live[type]) live[type].add(fn);
      return add(type, fn, opts);
    };
    globalThis.removeEventListener = (type, fn, opts) => {
      if (live[type]) live[type].delete(fn);
      return remove(type, fn, opts);
    };
  });
  const errors = await open(page, { cur: [nine] });
  expect(await page.evaluate(() => globalThis.__liveMouse())).toBe(2);
  // 描き直しを繰り返しても、受け口は mousemove と mouseup の1組だけ
  for (let i = 0; i < 5; i++) await page.evaluate(() => globalThis.render());
  expect(await page.evaluate(() => globalThis.__liveMouse())).toBe(2);
  // 記録画面を離れると外れる
  await pauseRecording(page);
  expect(await page.evaluate(() => globalThis.__liveMouse())).toBe(0);
  // マウスで的を押すと、これまでどおり矢が入る
  await page.locator('#tabs [data-v="record"]').click();
  await resumeRecording(page);
  const box = await page.locator("#tgsvg").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect
    .poll(() =>
      page.evaluate(() => {
        globalThis.flushPendingSave();
        return JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active.cur.length;
      }),
    )
    .toBe(2);
  expect(errors).toEqual([]);
});

test("center zoom belongs to one recording; another recording starts unzoomed", async ({
  page,
}) => {
  const errors = await open(page, {});
  const zoom = page.getByTestId("active-zoom");
  await zoom.click();
  await expect(zoom).toHaveAttribute("aria-pressed", "true");
  // 中断して再開しても、同じ記録なら拡大のまま
  await pauseRecording(page);
  await resumeRecording(page);
  await expect(page.getByTestId("active-zoom")).toHaveAttribute("aria-pressed", "true");
  // 別の記録に入ると拡大していない状態から
  await page.evaluate(() => {
    db.active = { ...db.active, id: "e2e-next", ends: [], cur: [] };
    globalThis.save();
    globalThis.render();
  });
  await expect(page.getByTestId("active-zoom")).toHaveAttribute("aria-pressed", "false");
  const half = await page.locator("#tgsvg").evaluate((el) => el.viewBox.baseVal.width);
  expect(half).toBeCloseTo(122 * 1.035, 5);
  expect(errors).toEqual([]);
});

test("without container queries, a cramped scorecard is hidden while the edit bar is open on a short screen", async ({
  page,
}) => {
  await page.addInitScript(() => {
    /* @container の無いブラウザを再現する */
    const supports = globalThis.CSS.supports.bind(globalThis.CSS);
    globalThis.CSS.supports = (a, b) =>
      String(b === undefined ? a : `${a}: ${b}`).includes("container") ? false : supports(a, b);
  });
  await page.setViewportSize({ width: 375, height: 667 });
  const end = Array.from({ length: 6 }, () => nine);
  const errors = await open(page, { ends: [end, end, end, end], cur: [nine, nine] });
  const card = page.locator("#recCard");
  await expect(card).not.toHaveClass(/\bis-cramped\b/);
  await expect(card.locator(".scard")).toBeVisible();
  // 修正バーを開くと表の高さが見出しの行に足りなくなり、表を隠す
  await page.locator('#curChips [data-i="0"]').click();
  await expect(page.locator("#nudge")).toBeVisible();
  expect(await card.evaluate((el) => el.clientHeight)).toBeLessThanOrEqual(27);
  await expect(card).toHaveClass(/\bis-cramped\b/);
  await expect(card.locator(".scard")).toBeHidden();
  // 修正を終えると表が戻る
  await page.locator("#nudgeDone").click();
  await expect(card).not.toHaveClass(/\bis-cramped\b/);
  await expect(card.locator(".scard")).toBeVisible();
  expect(errors).toEqual([]);
});
