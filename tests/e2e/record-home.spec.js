/* global db */
"use strict";
const { test, expect } = require("@playwright/test");
const { homeResultDb } = require("./fixtures/home-result-db");
const { pauseRecording, resumeRecording } = require("./record-helpers");

/* v5 段 4: 記録タブの待機画面（ホームを兼ねる）と記録の条件。
   期待値は見本データの保存値から、この検査の中で数える（アプリの集計関数は使わない）。 */
test.use({ hasTouch: true, isMobile: true, serviceWorkers: "block" });

const sum = (arr) => arr.reduce((n, a) => n + a.s, 0);
const totalOf = (s) => sum(s.ends.flat());

async function open(page, database, size) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.setViewportSize(size || { width: 375, height: 812 });
  await page.clock.setFixedTime(new Date("2026-11-12T10:00:00"));
  await page.addInitScript((d) => {
    if (globalThis.sessionStorage.getItem("__seeded")) return;
    globalThis.sessionStorage.setItem("__seeded", "1");
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(d));
  }, database);
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  return errors;
}
const stored = (page) =>
  page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));

test("home with history: band, previous practice figures, strip, trend and recent rows match stored data", async ({
  page,
}) => {
  const data = homeResultDb();
  const errors = await open(page, data);
  const last = data.sessions.find((s) => s.id === "p6"); // 日付が最も新しい（保存の並びでは最後ではない）
  await expect(page.locator("#viewDate")).toHaveText("11月12日（木）");

  const band = page.getByTestId("home-start-band");
  await expect(band.locator(".l")).toHaveText("前回と同じ条件");
  await expect(page.locator("#quickStartMeta")).toHaveText("70m・122cm的・72射");
  await expect(band.locator(".m")).toHaveText("6射×12エンド・架空のリカーブ・サイト 5.20");
  await expect(page.getByTestId("start-input-target")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("record-conditions")).toHaveText("条件を変える");
  await expect(page.getByTestId("record-start")).toHaveText("記録を始める");
  await expect(page.getByTestId("record-start")).toBeInViewport({ ratio: 1 });

  const prev = page.getByTestId("home-last");
  await expect(prev.locator(".vsecH .aside")).toHaveText("11/10（火）・70m・72射");
  await expect(prev.getByTestId("session-total")).toHaveText(`${totalOf(last)}/ 720`);
  const front = sum(last.ends.slice(0, 6).flat()),
    back = sum(last.ends.slice(6).flat());
  await expect(prev.locator('[data-fig="halves"] .n')).toHaveText(`${front}/ ${back}`);
  await expect(prev.locator('[data-fig="count0"]')).toHaveText(
    `10+X${last.ends.flat().filter((a) => a.s === 10).length}`,
  );
  await expect(prev.locator('[data-fig="count1"]')).toHaveText(
    `X${last.ends.flat().filter((a) => a.X).length}`,
  );
  // エンドごとの棒: 値は保存値の合計、色は最も高いエンドだけ
  const ends = last.ends.map(sum),
    hi = Math.max(...ends);
  const cells = prev.locator('[data-testid="end-strip"] [data-end]');
  await expect(cells).toHaveCount(12);
  for (let i = 0; i < 12; i++) {
    await expect(cells.nth(i).locator("b")).toHaveText(String(ends[i]));
    await expect(cells.nth(i)).toHaveClass(ends[i] === hi ? /hi/ : /^$/);
  }
  await expect(prev).toContainText(
    "エンドごとの合計（6射、60点満点）。最も高いエンドに色を付けています。",
  );

  // 同じ条件の推移: 70m・122cm的・72射の 7 回（18m の 2 回は入らない）
  const same = data.sessions.filter((s) => s.dist === 70).map(totalOf);
  const mean = same.reduce((a, b) => a + b, 0) / same.length;
  const sd = Math.sqrt(same.reduce((a, v) => a + (v - mean) ** 2, 0) / (same.length - 1));
  const trend = page.getByTestId("home-trend");
  await expect(trend.locator("h2")).toHaveText("70m・72射の推移");
  await expect(trend.locator(".vsecH .aside")).toHaveText("7回");
  await expect(trend.locator("svg.lineChart circle")).toHaveCount(7);
  await expect(trend.locator(".fact")).toHaveText(
    `7回の平均は ${mean.toFixed(1)} 点、回ごとの標準偏差は ${sd.toFixed(1)} 点です。`,
  );
  await expect(trend.locator(".basis")).toHaveText(
    "対象: 10/3〜11/10、70m・122cm的・72射。破線は平均です。回数が少ないため、上向き・下向きの判定はしていません。",
  );

  // 最近の練習: 日付の新しい順に 3 件。点数だけの記録も合計が出る
  const rows = page.getByTestId("home-recent-row");
  await expect(rows).toHaveCount(3);
  const expectRows = ["p6", "i1", "p5"].map((id) => data.sessions.find((s) => s.id === id));
  for (let i = 0; i < 3; i++) {
    await expect(rows.nth(i)).toHaveAttribute("data-id", expectRows[i].id);
    await expect(rows.nth(i).locator(".sc1")).toHaveText(`${totalOf(expectRows[i])}点`);
  }
  await expect(rows.nth(0).locator(".day")).toHaveText("11/10火曜");
  await expect(rows.nth(1).locator(".meta")).toHaveText("40cm的・架空のインドア用・室内");
  await expect(rows.nth(2).locator(".meta")).toHaveText("122cm的・架空のリカーブ・雨・点数だけ");
  await expect(rows.nth(2).locator(".txt")).toHaveText("雨のため点数だけ記録。");
  expect(await page.locator("#main").innerText()).not.toMatch(/NaN|undefined|null/);

  // 行を押すと、その記録の詳細（ノートの詳細）が開く
  await rows.nth(2).click();
  const sheet = page.locator(".histDetailSheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("history-detail-stats")).toContainText(
    String(totalOf(expectRows[2])),
  );
  await expect(sheet.getByTestId("no-impact")).toContainText("着弾データなし");
  await sheet.locator("#hClose").click();
  await page.getByTestId("home-last-open").click();
  await expect(sheet.getByTestId("history-detail-stats")).toContainText(String(totalOf(last)));
  await sheet.locator("#hClose").click();
  await page.locator("#homeNotes").click();
  await expect(page.locator("#viewTitle")).toHaveText("ノート");
  expect((await stored(page)).sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("記録を始める uses the latest practice by date, the ledger sight value and the chosen input method", async ({
  page,
}) => {
  const data = homeResultDb();
  const errors = await open(page, data);
  await page.getByTestId("start-input-score").click();
  await page.getByTestId("record-start").click();
  await expect(page.getByTestId("score-keys")).toBeVisible();
  await expect(page.locator(".recTop .condT")).toContainText("70m");
  const s = await stored(page);
  expect(s.active).toMatchObject({
    dist: 70,
    faceD: 122,
    faceType: "single",
    perEnd: 6,
    round: "70m72",
    setupId: "s1",
    sightV: "5.20",
    sightH: "0",
    inputMode: "score",
    date: "2026-11-12",
    ends: [],
    cur: [],
  });
  expect(s.settings.lastInputMode).toBe("score");
  expect(s.sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("home without history says what to do and starts with the default conditions", async ({
  page,
}) => {
  const errors = await open(page, homeResultDb({ empty: true }));
  const band = page.getByTestId("home-start-band");
  await expect(band.locator(".l")).toHaveText("記録の条件");
  await expect(page.locator("#quickStartMeta")).toHaveText("70m・122cm的");
  await expect(band.locator(".m")).toHaveText("自由練習・1エンド 6射・弓具 未指定");
  await expect(page.getByTestId("home-empty")).toContainText("練習の記録はまだありません");
  await expect(page.getByTestId("home-empty")).toContainText("1回記録して終了すると");
  for (const id of ["home-last", "home-trend", "home-recent", "home-goal-line", "end-strip"])
    await expect(page.getByTestId(id)).toHaveCount(0);
  expect(await page.locator("#main").innerText()).not.toMatch(/NaN|undefined|null|点です/);
  await page.getByTestId("record-start").click();
  await expect(page.getByTestId("active-target")).toBeVisible();
  expect((await stored(page)).active).toMatchObject({
    dist: 70,
    faceD: 122,
    perEnd: 6,
    round: "free",
    setupId: null,
    inputMode: "target",
  });
  expect(errors).toEqual([]);
});

test("a paused recording replaces the start band; nothing on the tab can start another record", async ({
  page,
}) => {
  const data = homeResultDb();
  const errors = await open(page, data);
  await page.getByTestId("record-start").click();
  const box = await page.locator("#tgsvg").boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await stored(page)).active.cur.length).toBe(1);
  await page.waitForFunction(() => !globalThis.hasPendingSave());
  const active = (await stored(page)).active;
  await pauseRecording(page);

  const band = page.getByTestId("record-paused");
  await expect(band.locator(".l")).toHaveText("記録の途中です");
  await expect(band.locator(".c")).toHaveText("70m・122cm的・72射");
  await expect(band.locator(".m")).toHaveText(
    `11/12（木）・0エンド確定・1射・${active.cur[0].s}点。1射ごとに保存しています。`,
  );
  await expect(band).toContainText("記録の途中は、新しい記録を始められません。");
  for (const sel of [
    "#quickStart",
    "#fStart",
    "#obStart",
    '[data-testid="record-start"]',
    '[data-testid="record-conditions"]',
    '[data-testid="start-input-mode"]',
    '[data-testid="home-start-band"]',
  ])
    await expect(page.locator(sel)).toHaveCount(0);
  // 前回の練習などは読めるまま
  await expect(page.getByTestId("home-last")).toBeVisible();
  // 開始の関数を直接呼んでも、記録の途中は上書きしない
  await page.evaluate(() =>
    globalThis.beginRecording({
      dist: 18,
      faceD: 40,
      faceType: "single",
      perEnd: 3,
      round: "free",
    }),
  );
  expect((await stored(page)).active).toEqual(active);
  // ほかのタブへ行って戻っても帯は同じ
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator('#tabs [data-v="record"]').click();
  await expect(band).toBeVisible();
  await resumeRecording(page);
  await expect(page.getByTestId("active-target")).toBeVisible();
  const after = await stored(page);
  expect(after.active).toEqual(active);
  expect(after.sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("conditions screen round trip: 18m / 40cm / 3 arrows / score input shows on the recording status row", async ({
  page,
}) => {
  const data = homeResultDb();
  const errors = await open(page, data);
  await page.getByTestId("record-conditions").click();
  await expect(page.locator("#condTitle")).toHaveText("記録の条件");
  await expect(page.locator("#viewTop")).toBeHidden();
  await expect(page.locator("#tabs")).toBeHidden();
  // 前回の条件から始まる
  await expect(page.locator("#fRound")).toHaveValue("70m72");
  await expect(page.locator('#fDistChips [data-d="70"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#fFace")).toHaveValue("122");
  await expect(page.locator("#fArrows")).toHaveValue("6");
  await expect(page.locator("#fSetup")).toHaveValue("s1");
  await expect(page.locator("#fSightV")).toHaveValue("5.20");
  await expect(page.locator("#fRoundInfo")).toHaveText("72射（6射×12エンド）");

  // 戻ると待機画面。何も始まっていない
  await page.getByTestId("conditions-back").click();
  await expect(page.getByTestId("home-start-band")).toBeVisible();
  await expect(page.locator("#tabs")).toBeVisible();
  expect((await stored(page)).active).toBeNull();

  await page.getByTestId("record-conditions").click();
  await page.locator("#fRound").selectOption("free");
  await expect(page.locator("#fRoundInfo")).toHaveText("射数は決めません");
  await page.locator('#fDistChips [data-d="18"]').click();
  await expect(page.locator("#fFace")).toHaveValue("40");
  await page.locator("#fArrows").selectOption("3");
  await page.getByTestId("start-input-score").click();
  await expect(page.locator("#fInputModeNote")).toContainText("着弾位置は残らない");
  await page.locator(".recordDetails summary").click();
  await page.locator("#fWx").selectOption("室内");
  await page.locator("#fNote").fill("架空のメモ");
  const start = page.getByTestId("record-start");
  await expect(start).toHaveText("この条件で記録を始める");
  await expect(start).toBeInViewport({ ratio: 1 });
  await start.click();

  await expect(page.locator(".recTop .condT")).toContainText("18m");
  await expect(page.locator(".recTop .condT")).toContainText("40cm");
  await expect(page.getByTestId("score-keys")).toBeVisible();
  await expect(page.getByTestId("active-arrow-chips").locator(".slot")).toHaveCount(3);
  const s = await stored(page);
  expect(s.active).toMatchObject({
    dist: 18,
    faceD: 40,
    faceType: "single",
    perEnd: 3,
    round: "free",
    inputMode: "score",
    wx: "室内",
    note: "架空のメモ",
    setupId: "s1",
  });
  expect(s.active.roundGroup).toBeUndefined();
  expect(s.settings.lastInputMode).toBe("score");
  expect(s.sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("conditions screen: a fixed-distance round sets distance, face and arrows; multi-round shows its stages", async ({
  page,
}) => {
  const errors = await open(page, homeResultDb());
  await page.getByTestId("record-conditions").click();
  await page.locator("#fRound").selectOption("18m60");
  await expect(page.locator('#fDistChips [data-d="18"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#fFace")).toHaveValue("40");
  await expect(page.locator("#fArrows")).toHaveValue("3");
  await expect(page.locator("#fRoundInfo")).toHaveText("60射（3射×20エンド）");
  await page.locator("#fRound").selectOption("30m36");
  await expect(page.locator("#fFace")).toHaveValue("80");
  await expect(page.locator("#fArrows")).toHaveValue("6");
  await page.locator("#fRound").selectOption("wa1440_men");
  await expect(page.locator("#fRoundStages")).toContainText("WA1440 男子");
  await expect(page.locator("#fRoundInfo")).toHaveText("4距離・合計 144射");
  await page.locator('#fDistChips [data-d="custom"]').click();
  await expect(page.locator("#fDistCustom")).toBeVisible();
  await page.locator("#fRound").selectOption("free");
  await page.locator("#fDistCustom").fill("60");
  await page.getByTestId("record-start").click();
  const active = (await stored(page)).active;
  expect(active.dist).toBe(60);
  expect(active.faceD).toBe(122);
  expect(active.round).toBe("free");
  expect(errors).toEqual([]);
});

test("goal line appears only when the practice goals setting is on, as one plain line", async ({
  page,
}) => {
  const data = homeResultDb({ gamification: true });
  const errors = await open(page, data);
  // 今週（11/9〜11/15）は 11/10 の 1 回。今月は 11 月の 4 回の射数
  const month = data.sessions
    .filter((s) => s.date.startsWith("2026-11"))
    .reduce((n, s) => n + s.ends.flat().length, 0);
  const line = page.getByTestId("home-goal-line");
  await expect(line).toHaveText(
    new RegExp(`^今週 1回 / 目標 3回・今月 ${month}射 / 目標 300射・連続 \\d+日$`),
  );
  await expect(page.locator("#main .streakHero, #main .badgeCard, #main .goalRing")).toHaveCount(0);
  await page.evaluate(() => {
    db.settings.gamification.enabled = false;
    globalThis.render();
  });
  await expect(line).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"]) {
  test(`home and conditions fit 320×640 (${theme})`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const errors = await open(page, homeResultDb({ theme }), { width: 320, height: 640 });
    const audit = () =>
      page.evaluate(() => {
        const visible = (e) =>
          e.getClientRects().length && globalThis.getComputedStyle(e).visibility !== "hidden";
        const small = [...globalThis.document.querySelectorAll("#main *, #viewTop *")]
          .filter(
            (e) =>
              visible(e) &&
              !e.closest("svg") &&
              [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
              parseFloat(globalThis.getComputedStyle(e).fontSize) < 13,
          )
          .map((e) => e.className + ":" + e.textContent.trim().slice(0, 10));
        const svgSmall = [
          ...globalThis.document.querySelectorAll("#main svg.lineChart text"),
        ].filter((t) => t.getBoundingClientRect().height < 13).length;
        const shortTargets = [
          ...globalThis.document.querySelectorAll(
            "#main button, #main select, #main input, #main summary, #viewTop button",
          ),
        ]
          .filter((e) => visible(e) && e.getBoundingClientRect().height < 44)
          .map((e) => (e.id || e.className) + ":" + Math.round(e.getBoundingClientRect().height));
        const wide = [...globalThis.document.querySelectorAll("#main *")]
          .filter(
            (e) => visible(e) && e.getBoundingClientRect().right > globalThis.innerWidth + 0.5,
          )
          .map((e) => e.className || e.tagName);
        return {
          small,
          svgSmall,
          shortTargets,
          wide,
          hscroll: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        };
      });
    await expect(page.getByTestId("record-start")).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId("record-conditions")).toBeInViewport({ ratio: 1 });
    expect(await audit()).toEqual({
      small: [],
      svgSmall: 0,
      shortTargets: [],
      wide: [],
      hscroll: false,
    });
    await page.screenshot({ path: info.outputPath(`home-320-${theme}.png`) });
    await page.getByTestId("record-conditions").click();
    await page.locator(".recordDetails summary").click();
    expect(await audit()).toEqual({
      small: [],
      svgSmall: 0,
      shortTargets: [],
      wide: [],
      hscroll: false,
    });
    // 開始ボタンは下端に固定され、最後の入力欄を隠さない
    const start = page.getByTestId("record-start");
    await expect(start).toBeInViewport({ ratio: 1 });
    await page.locator("#fNote").scrollIntoViewIfNeeded();
    const note = await page.locator("#fNote").boundingBox(),
      bar = await page.locator(".actbar").boundingBox();
    await page.evaluate(() => globalThis.scrollTo(0, globalThis.document.body.scrollHeight));
    const noteEnd = await page.locator("#fNote").boundingBox();
    expect(noteEnd.y + noteEnd.height).toBeLessThanOrEqual(bar.y);
    expect(note).not.toBeNull();
    await page.screenshot({ path: info.outputPath(`conditions-320-${theme}.png`) });
    expect(errors).toEqual([]);
  });
}
