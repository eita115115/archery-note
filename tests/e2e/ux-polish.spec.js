/* global db */
"use strict";

const { expect, test } = require("@playwright/test");
const { homeResultDb } = require("./fixtures/home-result-db");

test.use({ hasTouch: true, isMobile: true, serviceWorkers: "block" });

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function seedOnce(page, data) {
  await page.addInitScript((d) => {
    if (globalThis.sessionStorage.getItem("__uxSeeded")) return;
    globalThis.sessionStorage.setItem("__uxSeeded", "1");
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(d));
  }, data);
}

test("first-run band at 320x640 fits without horizontal overflow and hint close meets 44x44", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await seedOnce(page, {
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
      theme: "dark",
      lastBackupAt: null,
      activeGuideSeen: true,
      onboardingSeen: false,
    },
    active: null,
  });

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  const fit = await page.evaluate(() => {
    const W = globalThis.document.documentElement.clientWidth;
    const demo = globalThis.document.querySelector("#obDemo").getBoundingClientRect();
    const start = globalThis.document.querySelector("#obStart").getBoundingClientRect();
    return {
      W,
      scrollW: globalThis.document.documentElement.scrollWidth,
      demo: {
        left: demo.left,
        right: demo.right,
        w: Math.round(demo.width),
        h: Math.round(demo.height),
      },
      start: {
        left: start.left,
        right: start.right,
        w: Math.round(start.width),
        h: Math.round(start.height),
      },
    };
  });
  expect(fit.scrollW).toBeLessThanOrEqual(fit.W);
  expect(fit.demo.left).toBeGreaterThanOrEqual(0);
  expect(fit.demo.right).toBeLessThanOrEqual(fit.W);
  expect(fit.demo.h).toBeGreaterThanOrEqual(48);
  expect(fit.start.left).toBeGreaterThanOrEqual(0);
  expect(fit.start.right).toBeLessThanOrEqual(fit.W);
  expect(fit.start.h).toBeGreaterThanOrEqual(48);

  // デモデータ投入後に記録タブへ戻ると機能発見ヒントが出る。閉じるボタンの実寸が 44x44 以上で隣の操作と重ならない
  await page.locator("#obDemo").click();
  await page.locator('#tabs [data-v="record"]').click();
  const hintClose = page.locator("#hintClose");
  await expect(hintClose).toBeVisible();
  const boxes = await page.evaluate(() => {
    const act = globalThis.document.querySelector("#hintAction").getBoundingClientRect();
    const cls = globalThis.document.querySelector("#hintClose").getBoundingClientRect();
    return {
      actRight: act.right,
      clsLeft: cls.left,
      clsRight: cls.right,
      w: Math.round(cls.width),
      h: Math.round(cls.height),
      vw: globalThis.innerWidth,
    };
  });
  expect(boxes.w).toBeGreaterThanOrEqual(44);
  expect(boxes.h).toBeGreaterThanOrEqual(44);
  expect(boxes.clsRight).toBeLessThanOrEqual(boxes.vw + 1);
  expect(boxes.actRight).toBeLessThanOrEqual(boxes.clsLeft + 1);
  expect(errors).toEqual([]);
});

test("conditions subscreen sticky back bar stays pinned at top on scroll", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 375, height: 640 });
  await seedOnce(page, homeResultDb());
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  await page.getByTestId("record-conditions").click();
  await page.locator("details.recordDetails > summary").click();
  await page.evaluate(() => globalThis.scrollTo(0, 900));
  const scrollY = await page.evaluate(() => globalThis.scrollY);
  expect(scrollY).toBeGreaterThan(150);

  const topBox = await page.locator("html.subscreen .subTop").boundingBox();
  expect(Math.round(topBox.y)).toBe(0);
  await page.getByTestId("conditions-back").click();
  await expect(page.getByTestId("home-start-band")).toBeVisible();
  expect(errors).toEqual([]);
});

test("active scorecard keeps scroll position during in-end actions and scrolls on end confirm", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 375, height: 740 });
  const arrow = (s, x, y) => ({ x, y, s, X: s === 10 });
  const eightEnds = Array.from({ length: 8 }, () => [
    arrow(10, 0.1, 0.1),
    arrow(9, 1.5, 0.2),
    arrow(9, -1.4, 0.3),
    arrow(8, 2.8, -0.4),
    arrow(8, -2.7, 0.5),
    arrow(7, 4.1, 0.2),
  ]);
  const data = homeResultDb();
  data.active = {
    id: "active-scroll-test",
    date: "2026-11-12",
    setupId: "s1",
    dist: 70,
    faceD: 122,
    faceType: "single",
    perEnd: 6,
    arrowR: 0.285,
    round: "70m72",
    purpose: "practice",
    inputMode: "target",
    sightV: "5.20",
    sightH: "0",
    wx: "",
    note: "",
    windDir: "",
    windSpeed: "",
    ends: eightEnds,
    cur: [],
  };
  await seedOnce(page, data);
  await page.goto("/");
  await expect(page.getByTestId("active-scorecard")).toBeVisible();

  const scroller = page.getByTestId("active-scorecard");
  // 初回表示では最下部（最新エンド）まで送られている
  const initialScroll = await scroller.evaluate((el) => ({
    top: el.scrollTop,
    max: el.scrollHeight - el.clientHeight,
  }));
  expect(initialScroll.max).toBeGreaterThan(40);
  expect(initialScroll.top).toBeGreaterThanOrEqual(initialScroll.max - 2);

  // ユーザーが先頭（第1エンド）へスクロールして見返す
  await scroller.evaluate((el) => {
    el.scrollTop = 0;
  });
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);

  // 矢を6射打ち、さらに選択・微調整・7射目ブロック案内を出してもスコア表のスクロール位置が奪われない
  const tg = await page.locator("#tgsvg").boundingBox();
  for (let i = 0; i < 6; i++) {
    await page.mouse.click(tg.x + tg.width * 0.5 + i * 2, tg.y + tg.height * 0.5);
  }
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);

  await page.locator('#curChips .slot[data-i="0"]').click();
  await page.locator('#nudge [data-n="r"]').click();
  await page.locator("#nudgeDone").click();
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);

  // 7射目のタップ（状態行の案内更新）でもスクロールしない
  await page.mouse.click(tg.x + tg.width * 0.5, tg.y + tg.height * 0.5);
  await expect(page.locator("#recMsg")).toHaveText("エンドを確定してください");
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);

  // エンド確定したときだけ、新しく確定した第9エンドが見える最下部へ送られる
  await page.getByTestId("active-end").click();
  const afterConfirm = await scroller.evaluate((el) => ({
    top: el.scrollTop,
    max: el.scrollHeight - el.clientHeight,
  }));
  expect(afterConfirm.top).toBeGreaterThanOrEqual(afterConfirm.max - 2);
  expect(errors).toEqual([]);
});

test("notes search filters in real time without losing focus, supports NFKC/multi-word, and preserves pagination", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const data = homeResultDb();
  data.notes = [
    {
      id: "n-shoulder",
      date: "2026-11-08",
      ts: 1794100000000,
      text: "素引き30回。肩の高さを鏡で確認。",
      tags: ["射型"],
    },
    {
      id: "n-plunger",
      date: "2026-10-21",
      ts: 1792500000000,
      text: "プランジャーを半回転締めました。",
      tags: ["弓具"],
    },
  ];
  await seedOnce(page, data);
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await page.locator('#tabs [data-v="history"]').click();

  const search = page.getByTestId("notes-search");
  const clear = page.getByTestId("notes-search-clear");
  await expect(clear).toBeHidden();

  // 文字入力中もフォーカスが外れず、メモと練習の両方を対象に絞り込める
  await search.focus();
  await page.keyboard.type("素引き 肩");
  await expect(search).toBeFocused();
  await expect(clear).toBeVisible();
  await expect(page.locator("#histList .noteEntry")).toHaveCount(1);
  await expect(page.locator('#histList .memoRow[data-id="n-shoulder"]')).toBeVisible();

  // 絞り込み結果の行もそのままタップして詳細が開ける（イベント再バインドの確認）
  await page.locator('#histList .memoRow[data-id="n-shoulder"]').click();
  await expect(page.getByTestId("memo-detail")).toBeVisible();
  await page.locator("#nClose").click();

  // 全角英数字（NFKC）＋天候の複数語検索
  await search.fill("７０ｍ 雨");
  await expect(page.locator("#histList .noteEntry")).toHaveCount(1);
  await expect(page.locator('#histList .historyRow[data-id="p5"]')).toBeVisible();

  // 一致なし → 「すべての記録を表示」ボタンで1タップ解除
  await search.fill("存在しないキーワード");
  await expect(page.getByTestId("notes-no-match")).toBeVisible();
  await page.getByTestId("notes-reset-filter").click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(page.locator("#histList .noteEntry")).toHaveCount(data.sessions.length + 2);

  // 「さらに表示」で広げた件数がフィルタ切替で勝手に 50 に戻らない
  await page.evaluate(() => {
    for (let i = 0; i < 60; i++) {
      db.notes.push({
        id: "extra-" + i,
        date: "2026-09-15",
        ts: 1790000000000 + i,
        text: "追加メモ " + i,
      });
    }
    globalThis.save();
    globalThis.render();
  });
  await expect(page.locator("#histList .noteEntry")).toHaveCount(50);
  await page.locator("#histMore").click();
  await expect(page.locator("#histList .noteEntry")).toHaveCount(data.sessions.length + 2 + 60);
  await page.locator('#noteSeg button[data-kind="memo"]').click();
  await expect(page.locator("#histList .memoRow")).toHaveCount(62);
  expect(errors).toEqual([]);
});

test("note detail quick-jump button scrolls to operations and fits 320px header cleanly", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedOnce(page, homeResultDb());
  await page.goto("/");
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator('.historyRow[data-id="p6"]').click();

  const detail = page.getByTestId("note-detail");
  await expect(detail).toBeVisible();

  const headerFit = await page.evaluate(() => {
    const back = globalThis.document.querySelector("#hClose").getBoundingClientRect();
    const jump = globalThis.document.querySelector("#hJumpOps").getBoundingClientRect();
    return {
      backRight: back.right,
      jumpLeft: jump.left,
      jumpRight: jump.right,
      jumpW: Math.round(jump.width),
      jumpH: Math.round(jump.height),
    };
  });
  expect(headerFit.jumpW).toBeGreaterThanOrEqual(44);
  expect(headerFit.jumpH).toBeGreaterThanOrEqual(44);
  expect(headerFit.backRight).toBeLessThanOrEqual(headerFit.jumpLeft);
  expect(headerFit.jumpRight).toBeLessThanOrEqual(320);

  await page.getByTestId("note-jump-ops").click();
  const opsTop = await detail
    .getByTestId("note-ops")
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(opsTop).toBeGreaterThanOrEqual(40);
  expect(opsTop).toBeLessThan(260);
  expect(errors).toEqual([]);
});

test("unsaved form guard, cancel-first danger confirm, sight click Tab focus, and label bindings work", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await seedOnce(page, homeResultDb());
  await page.goto("/");
  await page.locator('#tabs [data-v="gear"]').click();

  // 1. セッティング編集: 未変更なら確認なしで即閉じ、変更ありなら確認ダイアログが出て初期フォーカスは「入力を続ける」
  await page.getByTestId("gear-edit").click();
  await expect(page.getByTestId("gear-form")).toBeVisible();
  await page.getByTestId("gear-form-back").click();
  await expect(page.getByTestId("gear-form")).toHaveCount(0);

  await page.getByTestId("gear-edit").click();
  await page.locator("#gfName").fill("架空のリカーブ（編集中）");
  await page.getByTestId("gear-form-back").click();
  const confirmSheet = page.locator(".confirmSheet");
  await expect(confirmSheet).toBeVisible();
  await expect(confirmSheet).toContainText("保存せずに閉じますか？");
  await expect(page.locator("#acCancel")).toHaveText("入力を続ける");
  await expect(page.locator("#acCancel")).toBeFocused();
  await page.locator("#acCancel").click();
  await expect(page.getByTestId("gear-form")).toBeVisible();
  await expect(page.locator("#gfName")).toHaveValue("架空のリカーブ（編集中）");

  await page.keyboard.press("Escape");
  await expect(confirmSheet).toBeVisible();
  await page.locator("#acOk").click();
  await expect(page.getByTestId("gear-form")).toHaveCount(0);

  // 2. 弓具 > サイト: クリック換算の欄で Tab 移動しても折りたたみは閉じず、隣の欄へフォーカスが移る
  await page.getByTestId("gear-subtab-sight").click();
  const clickFold = page.getByTestId("sight-click-fold");
  await clickFold.locator("summary").click();
  await expect(clickFold).toHaveAttribute("open", "");
  const calV = page.locator("#sgCalV");
  const calH = page.locator("#sgCalH");
  await calV.focus();
  await calV.fill("3.5");
  await page.keyboard.press("Tab");
  await expect(clickFold).toHaveAttribute("open", "");
  await expect(calH).toBeFocused();
  expect(
    await page.evaluate(
      () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).setups[0].calibV70,
    ),
  ).toBe(3.5);

  // 3. サイト記録・サイト合わせフォームのすべての label.f が有効な入力要素を指している
  await page.getByTestId("sight-add").click();
  const markUnbound = await page.evaluate(
    () =>
      [...globalThis.document.querySelectorAll(".ovl label.f")].filter(
        (l) => !l.htmlFor || !globalThis.document.getElementById(l.htmlFor),
      ).length,
  );
  expect(markUnbound).toBe(0);
  await page.locator("#mkCancel").click();

  await page.getByTestId("sight-calibrate").click();
  const calUnbound = await page.evaluate(
    () =>
      [...globalThis.document.querySelectorAll(".ovl label.f")].filter(
        (l) => !l.htmlFor || !globalThis.document.getElementById(l.htmlFor),
      ).length,
  );
  expect(calUnbound).toBe(0);
  await page.locator("#calCancel").click();
  expect(errors).toEqual([]);
});
