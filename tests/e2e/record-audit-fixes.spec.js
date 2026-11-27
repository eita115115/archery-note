/* global db, ui, save, openHistDetail */
"use strict";
const { test, expect } = require("@playwright/test");
const { homeResultDb } = require("./fixtures/home-result-db");

/* 2026-11 の見直しで見つけた、記録・分析・設定の不具合の検査（直す前のスクリプトでは落ちる）。 */
test.use({ hasTouch: true, isMobile: true, serviceWorkers: "block" });

async function open(page, data, opts) {
  const o = opts || {};
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date("2026-11-12T10:00:00"));
  if (o.init) await page.addInitScript(o.init);
  await page.addInitScript((d) => {
    if (!globalThis.localStorage.getItem("archeryNote.v1"))
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(d));
  }, data);
  await page.goto("/");
  /* 記録中は没入画面でタブを隠すので、表示ではなく読み込みを待つ */
  await page.waitForSelector("#tabs", { state: "attached" });
  return errors;
}
const stored = (page) =>
  page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
async function tapCm(page, x, y) {
  const p = await page.evaluate(
    ([px, py]) => {
      const svg = globalThis.document.querySelector("#tgsvg");
      const q = new globalThis.DOMPoint(px, -py).matrixTransform(svg.getScreenCTM());
      return { x: q.x, y: q.y };
    },
    [x, y],
  );
  await page.touchscreen.tap(p.x, p.y);
}
const pos = (x, y, s) => ({ x, y, s, X: false, src: "pos" });
function withActive(extra) {
  const d = homeResultDb();
  d.active = Object.assign(
    {
      id: "audit-active",
      date: "2026-11-12",
      setupId: "s1",
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
    extra,
  );
  return d;
}

test("record conditions: a sight value filled for one distance is not kept for a distance without a mark, and a fixed round follows the distance", async ({
  page,
}) => {
  const errors = await open(page, homeResultDb());
  await page.getByTestId("record-conditions").click();
  /* 前回は 70m 72射。70m のサイトの記録（上下 5.20・左右 0）が入る */
  await expect(page.locator("#fRound")).toHaveValue("70m72");
  await expect(page.locator("#fSightV")).toHaveValue("5.20");
  await expect(page.locator("#fSightH")).toHaveValue("0");
  /* 30m には記録が無い: 自動で入れた値を消し、ラウンドは自由練習に戻す */
  await page.locator('#fDistChips [data-d="30"]').click();
  await expect(page.locator("#fSightV")).toHaveValue("");
  await expect(page.locator("#fSightH")).toHaveValue("");
  await expect(page.locator("#fRound")).toHaveValue("free");
  await expect(page.locator("#fRoundInfo")).toHaveText("射数は決めません");
  /* 70m に戻すと、また 70m の値が入る */
  await page.locator('#fDistChips [data-d="70"]').click();
  await expect(page.locator("#fSightV")).toHaveValue("5.20");
  /* 手で打ち直した値は、距離を変えても消さない */
  await page.locator("#fSightV").fill("4.8");
  await page.locator('#fDistChips [data-d="30"]').click();
  await expect(page.locator("#fSightV")).toHaveValue("4.8");
  await page.getByTestId("record-start").click();
  await page.waitForSelector("#tgsvg");
  const active = (await stored(page)).active;
  expect({
    dist: active.dist,
    round: active.round,
    sightV: active.sightV,
    sightH: active.sightH,
  }).toEqual({
    dist: 30,
    round: "free",
    sightV: "4.8",
    sightH: "0",
  });
  expect(errors).toEqual([]);
});

test("a fixed-arrow round stops at its arrow count when arrows per end do not divide it", async ({
  page,
}) => {
  const errors = await open(page, homeResultDb());
  await page.getByTestId("record-conditions").click();
  await page.locator("#fRound").selectOption("30m36");
  await page.locator("#fArrows").selectOption("5");
  await expect(page.locator("#fRoundInfo")).toHaveText("36射（5射×7エンドと 1射）");
  await page.locator("#fRound").selectOption("free");
  await page.goto("/");
  /* 30m 36射・1エンド 5射で、7エンド（35射）まで確定した記録 */
  await page.evaluate(() => {
    db.active = Object.assign({}, db.sessions[0], {
      id: "quota-36",
      date: "2026-11-12",
      dist: 30,
      faceD: 80,
      round: "30m36",
      perEnd: 5,
      ends: Array.from({ length: 7 }, () =>
        Array.from({ length: 5 }, () => ({ x: 1, y: 1, s: 10, X: true, src: "pos" })),
      ),
      cur: [],
    });
    save();
  });
  await page.reload();
  await page.waitForSelector("#tgsvg");
  await expect(page.locator("#recMsg")).toHaveText("36射目・全36射");
  await tapCm(page, 0.5, 0.5);
  await expect.poll(async () => (await stored(page)).active.cur.length).toBe(1);
  await expect(page.getByTestId("active-end")).not.toContainText("あと");
  /* 36射目のあとは入らない */
  await tapCm(page, 0.5, 0.5);
  await expect(page.locator("#recMsg")).toHaveText("エンドを確定してください");
  await page.getByTestId("active-miss").isDisabled();
  expect(await page.evaluate(() => db.active.cur.length)).toBe(1);
  await page.getByTestId("active-end").click();
  await expect(page.locator("#recEndN")).toHaveText("全エンド確定");
  const a = (await stored(page)).active;
  expect(a.ends.flat().length).toBe(36);
  expect(errors).toEqual([]);
});

test("correcting a just-finished record starts with no selected arrow, no open end and the whole face", async ({
  page,
}) => {
  const end = (y) => [-15, -9, -3, 3, 9, 15].map((x) => pos(x, y, 8));
  const errors = await open(page, withActive({ ends: [end(5), end(-5)] }));
  await page.waitForSelector("#tgsvg");
  /* 中心を拡大し、第1エンドを開いて 2射目を選んでから、終える */
  await page.getByTestId("active-zoom").click();
  await page.locator('[data-erow="0"]').click();
  await page.locator('#curChips .slot[data-i="1"]').click();
  await expect.poll(() => page.evaluate(() => ui.selArrow)).toBe(1);
  await page.getByTestId("active-menu").click();
  await page.getByTestId("active-finish").click();
  await page.waitForSelector('[data-testid="result-screen"]');
  await page.locator("#sumClose").click();
  /* 記録タブから、いま終えた記録を直す */
  await page.getByTestId("home-last-open").click();
  await page.waitForSelector('[data-testid="note-detail"]');
  await page.locator("#hEdit").click();
  await page.waitForSelector("#tgsvg");
  expect(await page.evaluate(() => ({ sel: ui.selArrow, end: ui.editEnd, zoom: ui.zoom }))).toEqual(
    {
      sel: -1,
      end: -1,
      zoom: 1,
    },
  );
  await expect(page.locator("#bZoom")).toHaveText("中心を拡大");
  /* 最初のタップは新しい矢になる（選ばれたままの矢を動かさない） */
  const before = await page.evaluate(() => JSON.stringify(db.active.ends[0][1]));
  await tapCm(page, 3, 3);
  await expect.poll(() => page.evaluate(() => db.active.cur.length)).toBe(1);
  expect(await page.evaluate(() => JSON.stringify(db.active.ends[0][1]))).toBe(before);
  expect(errors).toEqual([]);
});

test("result screen shows no grouping radius for fewer than 3 positioned arrows", async ({
  page,
}) => {
  const errors = await open(
    page,
    withActive({ cur: [pos(3, 4, 9), pos(-2, 1, 10), { s: 8, X: false, src: "key" }] }),
  );
  await page.waitForSelector("#tgsvg");
  await page.getByTestId("active-menu").click();
  await page.getByTestId("active-finish").click();
  const screen = page.getByTestId("result-screen");
  await expect(screen).toBeVisible();
  await expect(screen.getByTestId("result-impact-figs")).toHaveCount(0);
  await expect(screen).toContainText("グルーピングはまだ出ません");
  await expect(screen).not.toContainText(/半径）\s*[\d.]+\s*cm/);
  expect(errors).toEqual([]);
});

test("analysis: grouping and compare follow the newest record until one is picked, and 分析で見る opens an old record", async ({
  page,
}) => {
  const d = homeResultDb();
  /* 新しい順の 200 件より古い記録を作る（同じ記録を日付だけ変えて足す） */
  const base = d.sessions[0];
  for (let i = 0; i < 200; i++) {
    const day = new Date(2026, 9, 1 + (i % 30));
    d.sessions.push(
      Object.assign(JSON.parse(JSON.stringify(base)), {
        id: "fill" + i,
        date: `2026-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
      }),
    );
  }
  d.sessions.push(
    Object.assign(JSON.parse(JSON.stringify(base)), { id: "oldest", date: "2025-04-21" }),
  );
  const errors = await open(page, d);
  const pickText = (sel) =>
    page.locator(sel).evaluate((el) => el.selectedOptions[0].textContent.split(" ")[0]);
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator('#analysisSubTabs [data-an="impact"]').click();
  expect(await pickText("#anImpact")).toBe("11/10（火）");
  await page.locator('#analysisSubTabs [data-an="compare"]').click();
  expect(await pickText("#cmpB")).toBe("11/10（火）");
  /* あとで練習を記録すると、選んでいないかぎり新しい記録を出す */
  await page.evaluate(() => {
    const s = JSON.parse(JSON.stringify(db.sessions.find((x) => x.id === "p6")));
    db.sessions.push(Object.assign(s, { id: "today-new", date: "2026-11-12" }));
    save();
  });
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator('#tabs [data-v="analysis"]').click();
  expect(await pickText("#cmpB")).toBe("11/12（木）");
  await page.locator('#analysisSubTabs [data-an="impact"]').click();
  expect(await pickText("#anImpact")).toBe("11/12（木）");
  /* 選ぶ欄で選んだ記録は、そのまま */
  await page.locator("#anImpact").selectOption("p3");
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator('#tabs [data-v="analysis"]').click();
  expect(await page.locator("#anImpact").inputValue()).toBe("p3");
  /* 新しい順の 200 件に入らない古い記録でも、「分析で見る」でその記録を出す */
  await page.locator('#tabs [data-v="history"]').click();
  await page.evaluate(() => openHistDetail("oldest"));
  await page.waitForSelector('[data-testid="note-detail"]');
  await page.locator("#hAnalysis").click();
  await page.waitForSelector('[data-testid="analysis-view"]');
  expect(await page.locator("#anImpact").inputValue()).toBe("oldest");
  expect(await pickText("#anImpact")).toBe("2025/4/21");
  expect(errors).toEqual([]);
});

test("analysis: a deleted setup no longer filters the records while the select says すべて", async ({
  page,
}) => {
  const errors = await open(page, homeResultDb());
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator("#anSetup").selectOption("s2");
  await expect(page.getByTestId("analysis-cond-row")).toHaveCount(1);
  await page.locator('#tabs [data-v="gear"]').click();
  await page.evaluate(() => {
    ui.gearSel = "s2";
    globalThis.render();
  });
  await page.getByTestId("gear-delete").click();
  await page.locator("#acOk").click();
  await page.locator('#tabs [data-v="analysis"]').click();
  await expect(page.locator("#anSetup")).toHaveValue("");
  expect(await page.evaluate(() => ui.analysisFilter.setupId)).toBe("");
  await expect(page.getByTestId("analysis-cond-row")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("figures that only show a record can be scrolled across; the recording target still takes taps", async ({
  page,
}) => {
  const errors = await open(page, homeResultDb());
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator('#analysisSubTabs [data-an="impact"]').click();
  const plot = page.locator(".tgWrap svg.main").first();
  await expect(plot).toBeVisible();
  expect(await plot.evaluate((el) => globalThis.getComputedStyle(el).touchAction)).toBe(
    "manipulation",
  );
  expect(
    await page
      .locator(".tgWrap")
      .first()
      .evaluate((el) => globalThis.getComputedStyle(el).touchAction),
  ).toBe("manipulation");
  /* 図の上から指で上へ動かすと、画面が動く */
  const box = await plot.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2,
    y0 = Math.min(box.y + box.height - 20, 800);
  const before = await page.evaluate(() => globalThis.scrollY);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y0 - i * 20 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBeGreaterThan(before + 100);
  expect(errors).toEqual([]);
});

test("settings: the update button explains why it cannot update during a recording", async ({
  page,
}) => {
  await page.route("**/version.json*", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ v: 9999 }) }),
  );
  const errors = await open(page, withActive({ cur: [pos(1, 1, 10)] }));
  await page.waitForSelector("#tgsvg");
  await page.getByTestId("active-pause").click();
  await page.locator("#btnSettings").click();
  const url = page.url();
  await page.getByTestId("settings-update").click();
  await expect(page.locator("#toast")).toHaveText(
    "記録の途中は更新できません。記録を終えてから、もう一度押してください",
  );
  expect(page.url()).toBe(url);
  expect((await stored(page)).active.cur.length).toBe(1);
  expect(errors).toEqual([]);
});

test("settings: dismissing the share sheet neither downloads the backup nor records it as written", async ({
  page,
}) => {
  const errors = await open(page, homeResultDb(), {
    init: () => {
      globalThis.__shares = [];
      globalThis.navigator.canShare = (d) => !!(d && d.files);
      globalThis.navigator.share = (d) => {
        globalThis.__shares.push(d.files ? "files" : "text");
        return Promise.reject(new globalThis.DOMException("Share canceled", "AbortError"));
      };
    },
  });
  const downloads = [];
  page.on("download", (dl) => downloads.push(dl.suggestedFilename()));
  await page.locator("#btnSettings").click();
  await expect(page.getByTestId("settings-export")).toContainText("まだ書き出していません");
  await page.getByTestId("settings-export").click();
  await expect(page.locator("#toast")).toHaveText("書き出しをやめました");
  expect(await page.evaluate(() => globalThis.__shares)).toEqual(["files"]);
  expect(downloads).toEqual([]);
  expect((await stored(page)).settings.lastBackupAt ?? null).toBeNull();
  await expect(page.getByTestId("settings-export")).toContainText("まだ書き出していません");
  expect(errors).toEqual([]);
});
