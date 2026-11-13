/* global db */
"use strict";
const fs = require("node:fs");
const { test, expect } = require("@playwright/test");
const { homeResultDb } = require("./fixtures/home-result-db");

/* v5 段 6: ノート（履歴＋メモ）。練習1回＝1項目、メモだけの日（db.notes）も同じ並びに入る。
   期待値は見本データの保存値から、この検査の中で数える（アプリの集計関数は使わない）。 */
test.use({ hasTouch: true, isMobile: true, serviceWorkers: "block" });

const sum = (arr) => arr.reduce((n, a) => n + a.s, 0);
const totalOf = (s) => sum(s.ends.flat());
const HOSTILE = '<img src=x onerror="globalThis.__xss=1">';

function notesDb(opts) {
  const database = homeResultDb(opts);
  database.notes = [
    {
      id: "n1",
      date: "2026-11-08",
      ts: 1794100000000,
      text: "架空のメモ。素引き30回。引き手の肘が下がる感覚があったので、鏡で肩の高さを確認しました。",
      tags: ["射型"],
    },
    {
      id: "n2",
      date: "2026-10-21",
      ts: 1792500000000,
      text: "架空のメモ。プランジャーを半回転だけ締めました。",
    },
    // 同じ日（11/10）のメモ2件: 後から書いたほうが上
    { id: "n3", date: "2026-11-10", ts: 1794300000000, text: "架空のメモ。朝のメモ。" },
    { id: "n4", date: "2026-11-10", ts: 1794300500000, text: "架空のメモ。夜のメモ。" },
  ];
  database.setups[0].history = [
    { date: "2026-11-10", changes: [{ label: "サイト", from: "5.05", to: "5.20" }] },
  ];
  return database;
}
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
  await page.locator('#tabs [data-v="history"]').click();
  await expect(page.locator("#viewTitle")).toHaveText("ノート");
  return errors;
}
const stored = (page) =>
  page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
/* 利用者のデータ（練習・メモ・弓具・サイト台帳・ゴミ箱）が保存値と同じ。起動回数などの設定は比べない */
async function expectUserData(page, database) {
  const now = await stored(page);
  for (const key of ["sessions", "notes", "setups", "sightMarks", "trash"])
    expect(now[key], key).toEqual(database[key]);
}
const entryIds = (page) =>
  page.locator("#histList .noteEntry").evaluateAll((els) => els.map((e) => e.dataset.id));

test("notes list: months with practice counts, entries sorted by date then time, no hero or rings", async ({
  page,
}) => {
  const database = notesDb();
  const errors = await open(page, database);

  // 画面名の行に「メモを書く」。設定の入口は記録タブだけ
  await expect(page.getByTestId("notes-new-memo")).toBeVisible();
  await expect(page.locator("#btnSettings")).toBeHidden();
  // 冒頭の励ましの文・数値枠・目標のリングは無い
  await expect(page.getByTestId("history-hero")).toHaveCount(0);
  await expect(page.locator(".pageHero, .heroMetric, .goalRing, .streakHero")).toHaveCount(0);
  await expect(page.locator("#main")).not.toContainText("この調子");
  await expect(page.locator("#main")).not.toContainText("しましょう");
  await expect(page.getByTestId("notes-goal-line")).toHaveCount(0);

  // 日付の新しい順。同じ日はメモの時刻の新しい順、時刻の分からない練習は保存の新しい順
  expect(await entryIds(page)).toEqual([
    "n4",
    "n3",
    "p6",
    "n1",
    "i1",
    "p5",
    "i0",
    "p4",
    "n2",
    "p3",
    "p2",
    "p1",
    "p0",
  ]);
  // 月の見出しと、その月の練習回数（メモは数えない）
  const months = page.getByTestId("notes-month");
  await expect(months).toHaveCount(2);
  await expect(months.nth(0)).toHaveText(/2026年11月\s*練習 4回/);
  await expect(months.nth(1)).toHaveText(/2026年10月\s*練習 5回/);

  // 練習の項目: 日・曜日 / 距離・射数 / 合計 / 的・弓具・天気 / メモ / その日の弓具変更
  const p6 = database.sessions.find((s) => s.id === "p6");
  const row = page.locator('.historyRow[data-id="p6"]');
  await expect(row.locator(".day")).toContainText("10");
  await expect(row.locator(".day")).toContainText("火曜");
  await expect(row).toHaveAccessibleName(/2026\/11\/10/);
  await expect(row.locator(".hd b")).toHaveText("70m・72射");
  await expect(row.locator(".sc1")).toHaveText(`${totalOf(p6)}点`);
  await expect(row.locator(".meta")).toHaveText("122cm的・架空のリカーブ・晴れ");
  await expect(row.locator(".txt")).toHaveText(p6.note);
  // その日の変更は、その日の最初の項目（夜のメモ）にだけ付く
  await expect(page.locator('.memoRow[data-id="n4"] .chg')).toHaveText(
    "弓具の変更: 架空のリカーブ（サイト 5.05 → 5.20）",
  );
  await expect(row.locator(".chg")).toHaveCount(0);
  // サイト台帳の記録（10/28）
  await expect(page.locator('.historyRow[data-id="p4"] .chg')).toHaveText(
    "サイトの記録: 70m 上下 5.20・左右 0",
  );
  // 点数だけの記録
  await expect(page.locator('.historyRow[data-id="p5"] .meta')).toHaveText(
    "122cm的・架空のリカーブ・雨・点数だけ",
  );
  await expect(page.locator('.historyRow[data-id="i1"] .meta')).not.toContainText("点数だけ");
  // メモだけの項目: 「メモ」、タグ、本文（2行まで）
  const memo = page.locator('.memoRow[data-id="n1"]');
  await expect(memo.locator(".hd b")).toHaveText("メモ");
  await expect(memo.locator(".meta")).toHaveText("射型");
  await expect(memo.locator(".txt")).toHaveText(database.notes[0].text);
  const clamp = await memo.locator(".txt").evaluate((el) => {
    const cs = globalThis.getComputedStyle(el);
    return { h: el.getBoundingClientRect().height, lh: parseFloat(cs.lineHeight) };
  });
  expect(clamp.h).toBeLessThanOrEqual(clamp.lh * 2 + 1);

  // ゴミ箱は一番下
  const trash = page.getByTestId("notes-trash");
  await expect(trash).toContainText("ゴミ箱（0件）");
  const last = await page.locator("#histList .noteEntry").last().boundingBox();
  expect((await trash.boundingBox()).y).toBeGreaterThan(last.y + last.height - 1);

  await expect(page.locator("#main")).not.toContainText(/NaN|undefined|null/);
  await expectUserData(page, database);
  expect(errors).toEqual([]);
});

test("notes filters: all / practice / with memo / distance, and gear and round stay reachable", async ({
  page,
}) => {
  const database = notesDb();
  const errors = await open(page, database);
  const seg = (kind) => page.locator(`#noteSeg button[data-kind="${kind}"]`);
  const sessionIds = database.sessions.map((s) => s.id);

  await expect(seg("all")).toHaveAttribute("aria-pressed", "true");
  // 距離の選択肢は記録にある距離だけ
  await expect(page.locator("#histDist option")).toHaveText(["距離", "70m", "18m"]);

  await seg("rec").click();
  await expect(seg("rec")).toHaveAttribute("aria-pressed", "true");
  await expect(seg("rec")).toBeFocused();
  await expect(page.locator("#histList .memoRow")).toHaveCount(0);
  await expect(page.locator("#histList .historyRow")).toHaveCount(9);

  await seg("memo").click();
  // メモだけの項目すべてと、メモのある練習（p6・p5）
  expect((await entryIds(page)).sort()).toEqual(["n1", "n2", "n3", "n4", "p5", "p6"]);
  await expect(page.getByTestId("notes-month").nth(0)).toHaveText(/練習 2回/);
  await expect(page.getByTestId("notes-month").nth(1)).toHaveText(/練習 0回/);

  await page.getByLabel("距離", { exact: true }).selectOption("18");
  await expect(page.getByLabel("距離", { exact: true })).toBeFocused();
  await expect(page.locator(".segPick")).toHaveClass(/on/);
  await expect(seg("all")).toHaveAttribute("aria-pressed", "false");
  await expect(seg("memo")).toHaveAttribute("aria-pressed", "false");
  expect(await entryIds(page)).toEqual(["i1", "i0"]);
  await expect(page.getByTestId("notes-month")).toHaveText(/2026年11月\s*練習 2回/);

  // 弓具・ラウンドの絞り込みは、たたんだ欄から届く
  const filters = page.getByTestId("history-filters");
  await expect(filters).not.toHaveAttribute("open", "");
  await page.getByTestId("history-filter-toggle").focus();
  await page.keyboard.press("Enter");
  await page.locator("#histSetup").selectOption("s2");
  await expect(filters).toHaveAttribute("open", "");
  await expect(page.getByTestId("history-filter-toggle")).toContainText("1条件");
  await expect(page.locator("#histSetup")).toBeFocused();
  expect(await entryIds(page)).toEqual(["i1"]);
  await page.locator("#histRound").selectOption("70m72");
  await expect(page.getByTestId("notes-no-match")).toContainText("該当する記録はありません");
  await page.getByRole("button", { name: "絞り込みを解除" }).click();
  await expect(page.getByTestId("history-filter-toggle")).toContainText("すべて");
  await expect(page.getByTestId("history-filter-toggle")).toBeFocused();
  await expect(seg("all")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#histList .noteEntry")).toHaveCount(sessionIds.length + 4);

  // 「すべて」に戻すと距離の選択も外れる
  await page.getByLabel("距離", { exact: true }).selectOption("70");
  await expect(page.locator("#histList .historyRow")).toHaveCount(7);
  await seg("all").click();
  await expect(page.getByLabel("距離", { exact: true })).toHaveValue("");
  await expect(page.locator("#histList .noteEntry")).toHaveCount(sessionIds.length + 4);

  await expectUserData(page, database);
  expect(errors).toEqual([]);
});

test("note detail: figures, comparison, scorecard, plot, conditions and operations match stored data", async ({
  page,
}) => {
  const database = notesDb();
  const errors = await open(page, database);
  const p6 = database.sessions.find((s) => s.id === "p6");
  const all = p6.ends.flat();
  const total = totalOf(p6);
  const first = sum(p6.ends.slice(0, 6).flat()),
    second = sum(p6.ends.slice(6).flat());

  await page.locator('.historyRow[data-id="p6"]').click();
  const detail = page.getByTestId("note-detail");
  await expect(detail).toBeVisible();
  // 全画面: 下に引いて閉じる取っ手は無く、タブと画面名の行は隠れる
  await expect(detail.locator(".modalSwipeHandle")).toHaveCount(0);
  const box = await detail.boundingBox();
  expect(box.y).toBe(0);
  expect(box.height).toBe(812);
  await expect(page.locator("#hClose")).toHaveText("ノート");

  // 見出し: 日付・距離と合計、条件
  await expect(detail.locator(".noteHead h3")).toContainText("11/10（火）");
  await expect(detail.locator(".noteHead h3")).toContainText("70m");
  await expect(detail.locator(".noteHead .viewDate")).toHaveText("2026年");
  await expect(detail.getByTestId("note-total")).toHaveText(String(total));
  await expect(detail.getByTestId("note-condition")).toHaveText(
    "122cm的・架空のリカーブ・70m 72射・晴れ",
  );
  // メモ（その記録の note）とタグ
  await expect(detail.getByTestId("note-memo")).toHaveValue(p6.note);
  await expect(detail.locator(".ntag")).toHaveText(["射型", "風", "サイト", "弓具"]);
  await expect(detail.locator('.ntag[aria-pressed="true"]')).toHaveCount(0);

  // 数値: 前半 / 後半、10+X、X
  const stats = detail.getByTestId("history-detail-stats");
  await expect(stats.locator(".aside")).toHaveText(
    `72射・1射平均 ${(total / 72).toFixed(2)}・満点 720`,
  );
  await expect(stats.locator('[data-fig="halves"] .n')).toHaveText(`${first}/ ${second}`);
  await expect(stats.locator('[data-fig="count0"]')).toHaveText(
    `10+X${all.filter((a) => a.s === 10).length}`,
  );
  await expect(stats.locator('[data-fig="count1"]')).toHaveText(
    `X${all.filter((a) => a.X).length}`,
  );
  // 同じ条件との比較は「この回」で書く（この日より後の記録は入らない）
  const past = database.sessions
    .filter((s) => s.dist === 70 && s.id !== "p6")
    .map((s) => totalOf(s));
  const mean = past.reduce((a, b) => a + b, 0) / past.length;
  const cmp = detail.getByTestId("todays-result");
  await expect(cmp).toContainText(`同じ条件の過去${past.length}回の平均 ${mean.toFixed(1)} 点`);
  await expect(cmp).toContainText("この回");
  await expect(cmp).not.toContainText("今回");

  // スコア表（読むだけ・高い点から）。行を押して直す操作は無い
  const card = detail.getByTestId("scorecard");
  await expect(card.locator(".scRow[data-end]")).toHaveCount(12);
  await expect(card.locator(".scRowBtn")).toHaveCount(0);
  const sorted = [...p6.ends[0]].sort((a, b) => b.s - a.s || (b.X ? 1 : 0) - (a.X ? 1 : 0));
  await expect(card.locator('.scRow[data-end="0"] .cell')).toHaveText(
    sorted.map((a) => (a.s === 0 ? "M" : a.X ? "X" : String(a.s))),
  );
  await expect(card.locator('.scRow[data-end="11"] .runTot')).toHaveText(String(total));
  await expect(card.locator('.scSub[data-sub="total"] .tot')).toHaveText(String(total));

  // 着弾: 位置のある矢の数だけ円がある
  await expect(detail.locator("#hPlot svg.main")).toHaveCount(1);
  await expect(detail.locator("#plmarks circle.arrowFoot")).toHaveCount(72);
  // 図の矢の円（白い縁の外側）は、採点に使った半径（矢の外径 5.7mm の半分）と同じ
  const foot = await detail
    .locator("#plmarks circle.arrowFoot")
    .first()
    .evaluate((c) => +c.getAttribute("r") + +c.getAttribute("stroke-width") / 2);
  expect(foot).toBeCloseTo(0.285, 6);
  await expect(detail.getByTestId("no-impact")).toHaveCount(0);
  await expect(detail.getByTestId("result-impact-figs")).toContainText("グループRMS");

  // 条件
  const cond = detail.getByTestId("note-conditions");
  await expect(cond.locator(".lrow").nth(0)).toHaveText(
    /ラウンド\s*70m・122cm的\s*70m 72射・6射 × 12エンド/,
  );
  await expect(cond.locator(".lrow").nth(1)).toHaveText(
    /弓具\s*架空のリカーブ\s*矢の外径 5\.7mm で判定/,
  );
  await expect(cond.locator(".lrow").nth(2)).toHaveText(/サイト\s*上下 5\.2・左右 0/);
  await expect(cond.locator(".lrow").nth(3)).toHaveText(/天気・風\s*晴れ/);
  await expect(cond.locator(".lrow").nth(4)).toHaveText(/入力\s*的面に打つ/);

  // この記録の操作: 押せる大きさ（44px 以上）
  const ops = detail.getByTestId("note-ops");
  await expect(ops.locator("h2")).toHaveText("この記録の操作");
  for (const id of ["#hEdit", "#hCard", "#hAnalysis", "#hDel", "#hClose"]) {
    const b = await detail.locator(id).boundingBox();
    expect(b.height, id).toBeGreaterThanOrEqual(44);
    expect(b.width, id).toBeGreaterThanOrEqual(44);
  }
  await expect(detail.locator("#hDel")).toHaveText("ゴミ箱へ移す");
  await expect(detail.getByTestId("history-rescore")).toHaveCount(0);

  await expect(detail).not.toContainText(/NaN|undefined|null/);
  expect(
    await detail.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    "no horizontal scroll",
  ).toBe(true);
  // 読んで閉じるだけでは何も書き換えない
  await page.locator("#hClose").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  await expectUserData(page, database);
  expect(errors).toEqual([]);
});

test("note detail for a score-only practice says there is no impact data and for 18m counts 10 and 9", async ({
  page,
}) => {
  const database = notesDb();
  const errors = await open(page, database);
  const p5 = database.sessions.find((s) => s.id === "p5");

  await page.locator('.historyRow[data-id="p5"]').click();
  const detail = page.getByTestId("note-detail");
  await expect(detail.getByTestId("note-total")).toHaveText(String(totalOf(p5)));
  await expect(detail.getByTestId("scorecard").locator(".scRow[data-end]")).toHaveCount(12);
  await expect(detail.locator("#hPlot svg")).toHaveCount(0);
  await expect(detail.getByTestId("no-impact")).toContainText("着弾データなし");
  await expect(detail.getByTestId("no-impact")).toContainText("72射すべて位置のない記録です");
  await expect(detail.getByTestId("result-impact-figs")).toHaveCount(0);
  await expect(detail.getByTestId("note-conditions").locator(".lrow").nth(4)).toHaveText(
    /入力\s*点数だけ/,
  );
  await detail.locator("details.histDetailNumbers summary").click();
  await expect(detail.getByTestId("history-detail-numbers")).toContainText("着弾データなし");
  await expect(detail).not.toContainText(/NaN|undefined|null/);
  await page.locator("#hClose").click();

  // 18m（インドア）: 数える点は 10 と 9。判定の円は、その記録に保存された半径（見本は 0.285cm）
  const i1 = database.sessions.find((s) => s.id === "i1");
  const all = i1.ends.flat();
  await page.locator('.historyRow[data-id="i1"]').click();
  const stats = page.getByTestId("history-detail-stats");
  await expect(stats.locator('[data-fig="count0"]')).toHaveText(
    `10点${all.filter((a) => a.s === 10).length}`,
  );
  await expect(stats.locator('[data-fig="count1"]')).toHaveText(
    `9点${all.filter((a) => a.s === 9).length}`,
  );
  await expect(page.getByTestId("note-conditions").locator(".lrow").nth(1)).toHaveText(
    /架空のインドア用\s*矢の外径 5\.7mm で判定/,
  );
  await page.locator("#hClose").click();
  await expectUserData(page, database);
  expect(errors).toEqual([]);
});

test("editing a practice memo and tags in the detail is saved to that session and survives a reload", async ({
  page,
}) => {
  const database = notesDb();
  const errors = await open(page, database);
  await page.locator('.historyRow[data-id="p4"]').click();
  const memo = page.getByTestId("note-memo");
  await expect(memo).toHaveValue("");
  await memo.fill("架空のメモ。追い風。サイトはそのまま。");
  await page.locator('.ntag[data-tag="風"]').click();
  await page.locator('.ntag[data-tag="サイト"]').click();
  await page.locator('.ntag[data-tag="サイト"]').click();
  await expect(page.locator('.ntag[data-tag="風"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.ntag[data-tag="サイト"]')).toHaveAttribute("aria-pressed", "false");
  // 欄を離れた時点で書き込まれている（閉じる前に画面が消えても残る）
  await memo.blur();
  let saved = (await stored(page)).sessions.find((s) => s.id === "p4");
  expect(saved.note).toBe("架空のメモ。追い風。サイトはそのまま。");
  expect(saved.tags).toEqual(["風"]);

  // Esc でも戻るボタンと同じ道を通る。一覧の抜粋が新しくなる
  await memo.fill("架空のメモ。書き直しました。");
  await page.keyboard.press("Escape");
  await expect(page.locator(".ovl")).toHaveCount(0);
  await expect(page.locator('.historyRow[data-id="p4"] .txt')).toHaveText(
    "架空のメモ。書き直しました。",
  );
  await page.reload();
  saved = (await stored(page)).sessions.find((s) => s.id === "p4");
  expect(saved.note).toBe("架空のメモ。書き直しました。");
  expect(saved.tags).toEqual(["風"]);
  // メモとタグ以外は1文字も変わらない
  const before = database.sessions.find((s) => s.id === "p4");
  expect({ ...saved, note: "", tags: undefined }).toEqual({ ...before, tags: undefined });
  expect((await stored(page)).sessions.filter((s) => s.id !== "p4")).toEqual(
    database.sessions.filter((s) => s.id !== "p4"),
  );
  expect(errors).toEqual([]);
});

test("while a practice is being edited in the record tab, its note detail cannot change the memo, tags or trash it", async ({
  page,
}) => {
  // 編集を終えると記録タブの写しで置き換わるため、途中でノートから書いたメモ・タグやゴミ箱への移動は消える。
  // 編集の途中はノートの詳細から書き換えられないようにする
  const database = notesDb();
  database.sessions.find((s) => s.id === "p4").note = "架空のメモ。編集前のメモ。";
  const errors = await open(page, database);
  await page.locator('.historyRow[data-id="p4"]').click();
  await page.locator("#hEdit").click();
  await expect(page.getByTestId("active-pause")).toBeVisible();
  await page.getByTestId("active-pause").click();
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator('.historyRow[data-id="p4"]').click();

  await expect(page.getByTestId("note-editing-lock")).toBeVisible();
  await expect(page.getByTestId("note-memo")).toHaveAttribute("readonly", "");
  for (const b of await page.locator(".noteTagRow .ntag").all()) await expect(b).toBeDisabled();
  await expect(page.locator("#hEdit")).toHaveCount(0);
  await expect(page.locator("#hDel")).toHaveCount(0);
  await expect(page.locator("#hCard")).toBeVisible();
  await page.getByTestId("note-memo").press("End");
  await page.keyboard.type("書き足し");
  await page.locator("#hClose").click();
  let saved = (await stored(page)).sessions.find((s) => s.id === "p4");
  expect(saved.note).toBe("架空のメモ。編集前のメモ。");

  // 記録タブで再開して編集を終えると、ノートの詳細はまた書き換えられる
  await page.locator('#tabs [data-v="record"]').click();
  await page.getByTestId("record-resume").click();
  await page.getByTestId("active-menu").click();
  await page.getByTestId("active-finish").click();
  await expect(page.locator("#sumClose")).toBeVisible();
  await page.locator("#sumClose").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  saved = (await stored(page)).sessions.find((s) => s.id === "p4");
  expect(saved.note).toBe("架空のメモ。編集前のメモ。");
  expect((await stored(page)).trash || []).toEqual([]);
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator('.historyRow[data-id="p4"]').click();
  await expect(page.getByTestId("note-editing-lock")).toHaveCount(0);
  await expect(page.getByTestId("note-memo")).not.toHaveAttribute("readonly", "");
  await expect(page.locator("#hEdit")).toBeVisible();
  await expect(page.locator("#hDel")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("memo notes: write for today, change the date, edit, move to the trash and restore", async ({
  page,
}) => {
  const database = notesDb();
  const errors = await open(page, database);

  // 書かずに戻ると何も残らない
  await page.getByTestId("notes-new-memo").click();
  const screen = page.getByTestId("memo-detail");
  await expect(screen.locator("h3")).toHaveText("メモを書く");
  await expect(screen.locator(".modalSwipeHandle")).toHaveCount(0);
  await expect(page.getByTestId("memo-date")).toHaveValue("2026-11-12");
  await expect(page.getByTestId("memo-text")).toBeFocused();
  await expect(screen.locator("#nDel")).toHaveCount(0);
  await page.locator("#nClose").click();
  expect((await stored(page)).notes).toEqual(database.notes);

  // 今日のメモを書く。入力の途中で画面が消えても残るよう、欄を離れた時点で保存されている
  await page.getByTestId("notes-new-memo").click();
  const body = "架空のメモ。雨で練習は休み。\n素引きを20分。";
  await page.getByTestId("memo-text").fill(body);
  await page.locator('.ntag[data-tag="射型"]').click();
  await page.getByTestId("memo-text").blur();
  let notes = (await stored(page)).notes;
  expect(notes).toHaveLength(5);
  const created = notes[4];
  expect(created.text).toBe(body);
  expect(created.date).toBe("2026-11-12");
  expect(created.tags).toEqual(["射型"]);
  expect(typeof created.id).toBe("string");
  expect(created.ts).toBe(new Date("2026-11-12T10:00:00").getTime());
  await page.keyboard.press("Escape");
  await expect(page.locator(".ovl")).toHaveCount(0);
  // 一覧の先頭（11/12）に入る
  expect((await entryIds(page))[0]).toBe(created.id);
  const row = page.locator(`.memoRow[data-id="${created.id}"]`);
  await expect(row.locator(".day")).toContainText("12");
  await expect(row.locator(".day")).toContainText("木曜");
  await expect(row.locator(".txt")).toContainText("雨で練習は休み。");

  // 開いて日付と本文を直す
  await row.click();
  await expect(screen.locator("h3")).toHaveText("メモ");
  await expect(page.getByTestId("memo-text")).toHaveValue(body);
  await page.getByTestId("memo-date").fill("2026-11-05");
  await page.getByTestId("memo-text").fill(body + "\n追記。");
  await page.locator("#nClose").click();
  notes = (await stored(page)).notes;
  expect(notes[4]).toEqual({ ...created, date: "2026-11-05", text: body + "\n追記。" });
  // 11/5 の位置（11/7 の練習と 11/4 の練習の間）へ移る
  const ids = await entryIds(page);
  expect(ids.indexOf(created.id)).toBe(ids.indexOf("i1") + 1);
  expect(ids.indexOf(created.id)).toBe(ids.indexOf("p5") - 1);

  // ゴミ箱へ移す（確認あり。取り消すと何も変わらない）
  await page.locator(`.memoRow[data-id="${created.id}"]`).click();
  await page.locator("#nDel").click();
  await expect(page.locator(".confirmSheet")).toContainText("このメモをゴミ箱へ移しますか？");
  await page.locator("#acCancel").click();
  expect((await stored(page)).notes).toHaveLength(5);
  await page.locator("#nDel").click();
  await page.locator("#acOk").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  let after = await stored(page);
  expect(after.notes).toEqual(database.notes);
  expect(after.trash).toHaveLength(1);
  expect(after.trash[0].type).toBe("note");
  expect(after.trash[0].data).toEqual(notes[4]);
  await expect(page.locator(`.memoRow[data-id="${created.id}"]`)).toHaveCount(0);

  // ノートの一番下のゴミ箱から元に戻す
  await expect(page.getByTestId("notes-trash")).toContainText("ゴミ箱（1件）");
  await page.getByTestId("notes-trash").click();
  const sheet = page.getByTestId("trash-sheet");
  await expect(sheet.getByTestId("trash-row")).toHaveCount(1);
  await expect(sheet.getByTestId("trash-row")).toContainText(
    "メモ 2026/11/5 架空のメモ。雨で練習は休み。",
  );
  const restore = sheet.getByRole("button", { name: /を元に戻す$/ });
  expect((await restore.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await restore.click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  after = await stored(page);
  expect(after.trash).toEqual([]);
  expect(after.notes).toEqual(notes);
  await expect(page.locator(`.memoRow[data-id="${created.id}"] .txt`)).toContainText("追記。");
  await expect(page.getByTestId("notes-trash")).toContainText("ゴミ箱（0件）");
  // 練習の記録には触れていない
  expect(after.sessions).toEqual(database.sessions);
  expect(errors).toEqual([]);
});

test("a memo that is typed and then cleared leaves nothing, and an existing memo keeps its entry when emptied", async ({
  page,
}) => {
  const database = notesDb();
  const errors = await open(page, database);
  await page.getByTestId("notes-new-memo").click();
  await page.getByTestId("memo-text").fill("架空のメモ。書きかけ。");
  await page.getByTestId("memo-text").blur();
  expect((await stored(page)).notes).toHaveLength(5);
  await page.getByTestId("memo-text").fill("   ");
  await page.locator("#nClose").click();
  expect((await stored(page)).notes).toEqual(database.notes);

  // 既にあるメモの本文を消しても、項目は消さない（消すのはゴミ箱へ移す操作だけ）
  await page.locator('.memoRow[data-id="n2"]').click();
  await page.getByTestId("memo-text").fill("");
  await page.locator("#nClose").click();
  const notes = (await stored(page)).notes;
  expect(notes.map((n) => n.id)).toEqual(["n1", "n2", "n3", "n4"]);
  expect(notes[1].text).toBe("");
  await expect(page.locator('.memoRow[data-id="n2"] .txt')).toHaveText("本文はありません");
  expect(errors).toEqual([]);
});

test("deleting a practice from the detail moves it to the trash, and restoring brings back every arrow", async ({
  page,
}) => {
  const database = notesDb();
  const errors = await open(page, database);
  const p3 = database.sessions.find((s) => s.id === "p3");

  await page.locator('.historyRow[data-id="p3"]').click();
  await page.locator("#hDel").scrollIntoViewIfNeeded();
  await page.locator("#hDel").click();
  await expect(page.locator(".confirmSheet")).toContainText("この練習の記録をゴミ箱へ移しますか？");
  await page.locator("#acCancel").click();
  await expect(page.getByTestId("note-detail")).toBeVisible();
  await expectUserData(page, database);

  await page.locator("#hDel").click();
  await page.locator("#acOk").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  let after = await stored(page);
  expect(after.sessions.map((s) => s.id)).not.toContain("p3");
  expect(after.sessions).toHaveLength(database.sessions.length - 1);
  expect(after.trash).toHaveLength(1);
  expect(after.trash[0].data).toEqual(p3);
  await expect(page.locator('.historyRow[data-id="p3"]')).toHaveCount(0);
  await expect(page.getByTestId("notes-month").nth(1)).toHaveText(/練習 4回/);

  await page.getByTestId("notes-trash").click();
  await expect(page.getByTestId("trash-row")).toContainText("2026/10/21 70m");
  await expect(page.getByTestId("trash-row")).toContainText("練習");
  await page.getByTestId("trash-row").getByRole("button").click();
  after = await stored(page);
  expect(after.trash).toEqual([]);
  expect(after.sessions.find((s) => s.id === "p3")).toEqual(p3);
  expect(after.sessions.filter((s) => s.id !== "p3")).toEqual(
    database.sessions.filter((s) => s.id !== "p3"),
  );
  expect(after.notes).toEqual(database.notes);
  await expect(page.locator('.historyRow[data-id="p3"] .sc1')).toHaveText(`${totalOf(p3)}点`);
  await expect(page.getByTestId("notes-month").nth(1)).toHaveText(/練習 5回/);
  expect(errors).toEqual([]);
});

test("backup export then import brings back notes, tags and the trashed memo unchanged", async ({
  page,
}, testInfo) => {
  const database = notesDb();
  database.sessions.find((s) => s.id === "p6").tags = ["射型", "風"];
  database.trash = [
    {
      id: "t-memo",
      type: "note",
      label: "メモ 2026/9/18 架空の古いメモ",
      date: "2026-11-02",
      ts: 2,
      data: { id: "gone", date: "2026-09-18", ts: 5, text: "架空の古いメモ", tags: ["弓具"] },
    },
  ];
  const errors = await open(page, database);

  // 設定の「バックアップ保存」で書き出す
  await page.locator('#tabs [data-v="record"]').click();
  await page.locator("#btnSettings").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("settings-export").click();
  const download = await downloadPromise;
  const file = testInfo.outputPath("backup.json");
  await download.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(exported.notes).toEqual(database.notes);
  expect(exported.trash).toEqual(database.trash);
  expect(exported.sessions).toEqual(database.sessions);
  await page.locator("#setClose").click();

  // 端末のデータを空にしてから読み込む
  await page.evaluate(() => {
    db.notes = [];
    db.sessions = [];
    db.setups = [];
    db.sightMarks = [];
    db.trash = [];
    globalThis.save();
    globalThis.render();
  });
  expect((await stored(page)).notes).toEqual([]);
  await page.locator("#btnSettings").click();
  await page.locator("#dFile").setInputFiles(file);
  await expect(page.locator(".confirmSheet")).toContainText("練習9回 / セッティング2件 / メモ4件");
  await page.locator(".confirmSheet #acOk").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  const after = await stored(page);
  expect(after.notes).toEqual(database.notes);
  expect(after.sessions).toEqual(database.sessions);
  expect(after.trash).toEqual(database.trash);

  // 読み込んだ直後のノート: メモも練習も並び、ゴミ箱のメモも戻せる
  await page.locator('#tabs [data-v="history"]').click();
  await expect(page.locator("#histList .memoRow")).toHaveCount(4);
  await expect(page.locator("#histList .historyRow")).toHaveCount(9);
  await page.locator('.historyRow[data-id="p6"]').click();
  await expect(page.locator('.ntag[aria-pressed="true"]')).toHaveText(["射型", "風"]);
  await page.locator("#hClose").click();
  await page.getByTestId("notes-trash").click();
  await page.getByTestId("trash-row").getByRole("button").click();
  expect((await stored(page)).notes.find((n) => n.id === "gone")).toEqual(database.trash[0].data);
  await expect(page.locator('.memoRow[data-id="gone"] .txt')).toHaveText("架空の古いメモ");
  expect(errors).toEqual([]);
});

test("user text in memos, tags, session notes and the trash is shown as text, never as markup", async ({
  page,
}) => {
  const database = notesDb();
  database.notes.push({ id: "evil", date: "2026-11-11", ts: 9, text: HOSTILE, tags: [HOSTILE] });
  const p6 = database.sessions.find((s) => s.id === "p6");
  p6.note = HOSTILE;
  p6.tags = [HOSTILE];
  p6.wx = HOSTILE;
  database.setups[0].name = HOSTILE;
  database.setups[0].history[0].changes[0].to = HOSTILE;
  database.trash = [
    {
      id: "t-evil",
      type: "note",
      label: HOSTILE,
      date: "2026-11-02",
      ts: 2,
      data: { id: "g", text: HOSTILE },
    },
  ];
  const errors = await open(page, database);
  const noMarkup = async () => {
    expect(await page.locator("img[src=x]").count()).toBe(0);
    expect(await page.evaluate(() => globalThis.__xss)).toBeUndefined();
  };
  await expect(page.locator('.memoRow[data-id="evil"] .txt')).toHaveText(HOSTILE);
  await expect(page.locator('.memoRow[data-id="evil"] .meta')).toHaveText(HOSTILE);
  await expect(page.locator('.historyRow[data-id="p6"] .txt')).toHaveText(HOSTILE);
  await noMarkup();
  await page.locator('.historyRow[data-id="p6"]').click();
  await expect(page.getByTestId("note-memo")).toHaveValue(HOSTILE);
  await expect(page.getByTestId("note-condition")).toContainText(HOSTILE);
  await expect(page.locator(".ntag").last()).toHaveText(HOSTILE);
  await noMarkup();
  await page.locator("#hClose").click();
  await page.locator('.memoRow[data-id="evil"]').click();
  await expect(page.getByTestId("memo-text")).toHaveValue(HOSTILE);
  await noMarkup();
  await page.locator("#nClose").click();
  await page.getByTestId("notes-trash").click();
  await expect(page.getByTestId("trash-row").locator("b")).toHaveText(HOSTILE);
  await noMarkup();
  expect(errors).toEqual([]);
});

test("a distance in an imported recording or past-session edit is shown as text, never as markup", async ({
  page,
}) => {
  const database = notesDb();
  const p4 = database.sessions.find((s) => s.id === "p4");
  database.active = { ...JSON.parse(JSON.stringify(p4)), dist: HOSTILE, cur: [], _edit: true };
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date("2026-11-12T10:00:00"));
  await page.addInitScript((d) => {
    if (globalThis.sessionStorage.getItem("__seeded")) return;
    globalThis.sessionStorage.setItem("__seeded", "1");
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(d));
  }, database);
  await page.goto("/");
  // 記録の途中があると記録画面から始まる
  await expect(page.locator(".condT")).toContainText(HOSTILE);
  await expect(page.locator(".condT img")).toHaveCount(0);
  await page.getByTestId("active-menu").click();
  await expect(page.locator(".ovl img")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByTestId("active-pause").click();
  await expect(page.getByTestId("record-paused")).toContainText(HOSTILE);
  await expect(page.locator('[data-testid="record-paused"] img')).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__xss)).toBeUndefined();
  expect(errors).toEqual([]);
});

test("notes with broken dates and an empty practice show no NaN and keep the stored data", async ({
  page,
}) => {
  const database = notesDb();
  database.notes.push({ id: "nodate", date: "", ts: 0, text: "架空のメモ。日付のないメモ。" });
  database.sessions.push({
    id: "empty",
    date: "2026-11-11",
    dist: 30,
    faceD: 80,
    faceType: "single",
    round: "free",
    perEnd: 6,
    ends: [],
  });
  const errors = await open(page, database);
  await expect(page.getByTestId("notes-month").last()).toHaveText(/日付なし\s*練習 0回/);
  const nodate = page.locator('.memoRow[data-id="nodate"]');
  await expect(nodate.locator(".day")).toContainText("日付なし");
  const empty = page.locator('.historyRow[data-id="empty"]');
  await expect(empty.locator(".hd b")).toHaveText("30m・0射");
  await expect(empty.locator(".sc1")).toHaveText("0点");
  await expect(empty.locator(".meta")).not.toContainText("点数だけ");
  await expect(page.locator("#main")).not.toContainText(/NaN|undefined|null/);
  await empty.click();
  const detail = page.getByTestId("note-detail");
  await expect(detail.getByTestId("history-detail-stats").locator(".aside")).toHaveText(
    "0射・1射平均 —",
  );
  await expect(detail).not.toContainText(/NaN|undefined|null/);
  await page.locator("#hClose").click();
  await nodate.click();
  await expect(page.getByTestId("memo-date")).toHaveValue("");
  await expect(page.locator("#nDateLabel")).toHaveText("日付なし");
  await page.locator("#nClose").click();
  await expectUserData(page, database);
  expect(errors).toEqual([]);
});

test("with goals on, the notes tab shows one plain line and no rings; an empty notebook says what to do", async ({
  page,
}) => {
  const database = notesDb({ gamification: true });
  const errors = await open(page, database);
  const line = page.getByTestId("notes-goal-line");
  await expect(line).toHaveCount(1);
  await expect(line).toContainText("今週 1回 / 目標 3回");
  await expect(line).toContainText("今月 264射 / 目標 300射");
  await expect(line).toContainText(/連続 \d+日/);
  await expect(page.locator(".goalRing, .streakHero, .badgeCard")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("an empty notebook says what appears here and offers the record tab", async ({ page }) => {
  const database = homeResultDb({ empty: true });
  const errors = await open(page, database);
  const empty = page.getByTestId("history-empty");
  await expect(empty).toContainText("ノートはまだ空です");
  await expect(page.getByLabel("距離", { exact: true })).toBeDisabled();
  await expect(page.getByTestId("notes-trash")).toContainText("ゴミ箱（0件）");
  await page.getByTestId("notes-trash").click();
  await expect(page.getByTestId("trash-sheet")).toContainText("ゴミ箱は空です");
  await page.locator("#trashClose").click();
  await empty.getByRole("button", { name: "記録タブへ" }).click();
  await expect(page.locator("#viewTitle")).toHaveText("記録");
  expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"]) {
  test(`notes list, detail and memo fit 320x640 with readable text and tap targets (${theme})`, async ({
    page,
  }) => {
    const database = notesDb({ theme });
    await page.emulateMedia({ colorScheme: theme });
    const errors = await open(page, database, { width: 320, height: 640 });
    /* 見えている文字は 13px 以上、押せるものは 44px 以上、横スクロールなし、文字と背景の比は 4.5 以上 */
    const audit = (rootSel) =>
      page.evaluate((sel) => {
        const root = globalThis.document.querySelector(sel);
        const hidden = (e) =>
          !e.getClientRects().length ||
          e.closest(".srOnly") ||
          e.closest("svg") ||
          e.closest("details:not([open]) > :not(summary)");
        const lum = (c) => {
          const [r, g, b] = c.map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
        const bgOf = (e) => {
          for (let n = e; n; n = n.parentElement) {
            const c = rgb(globalThis.getComputedStyle(n).backgroundColor);
            if (c.length >= 3 && (c.length < 4 || c[3] >= 0.99)) return c.slice(0, 3);
          }
          return rgb(globalThis.getComputedStyle(globalThis.document.body).backgroundColor).slice(
            0,
            3,
          );
        };
        const small = [],
          low = [];
        for (const e of root.querySelectorAll("*")) {
          if (hidden(e) || e.closest(".scard") || e.closest(".tgWrap")) continue;
          const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!own) continue;
          const cs = globalThis.getComputedStyle(e);
          if (parseFloat(cs.fontSize) < 13) small.push(`${e.className}:${cs.fontSize}`);
          const fg = rgb(cs.color).slice(0, 3),
            bg = bgOf(e);
          const a = lum(fg),
            b = lum(bg);
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          if (ratio < 4.5 && !e.disabled && !e.closest(":disabled"))
            low.push(`${e.className}:${e.textContent.trim().slice(0, 10)}:${ratio.toFixed(2)}`);
        }
        const taps = [...root.querySelectorAll("button,select,summary,textarea,input")]
          .filter((e) => !hidden(e))
          .map((e) => {
            const r = e.getBoundingClientRect();
            return { k: e.id || e.className, w: Math.round(r.width), h: Math.round(r.height) };
          })
          .filter((x) => x.w < 44 || x.h < 44);
        const scroller = root.matches(".sheet") ? root : globalThis.document.documentElement;
        return {
          small,
          low,
          taps,
          hscroll: scroller.scrollWidth > scroller.clientWidth + 1,
          bad: /NaN|undefined|null/.test(root.innerText),
        };
      }, rootSel);
    const clean = { small: [], low: [], taps: [], hscroll: false, bad: false };

    expect(await audit("#main")).toEqual(clean);
    expect(await audit("#viewTop")).toEqual(clean);
    // 「メモを書く」と画面名が重ならない
    const title = await page.locator("#viewTitle").boundingBox(),
      memoBtn = await page.getByTestId("notes-new-memo").boundingBox();
    expect(title.x + title.width).toBeLessThanOrEqual(memoBtn.x);
    expect(memoBtn.x + memoBtn.width).toBeLessThanOrEqual(320);
    // 4つの切り替えが1行に収まる
    const segBox = await page.locator("#noteSeg").boundingBox();
    expect(segBox.height).toBeLessThanOrEqual(48);

    await page.locator('.historyRow[data-id="p6"]').click();
    expect(await audit(".noteScreen")).toEqual(clean);
    await page.locator("details.histDetailNumbers summary").click();
    expect((await audit(".noteScreen")).hscroll).toBe(false);
    // スコア表は画面の幅ちょうど
    const card = await page.getByTestId("scorecard").boundingBox();
    expect(Math.round(card.x)).toBe(0);
    expect(Math.round(card.width)).toBe(320);
    await page.locator("#hClose").click();

    await page.locator('.memoRow[data-id="n1"]').click();
    expect(await audit(".noteScreen")).toEqual(clean);
    await page.locator("#nClose").click();
    await page.getByTestId("notes-new-memo").click();
    expect(await audit(".noteScreen")).toEqual(clean);
    await page.locator("#nClose").click();
    await page.evaluate(() => {
      globalThis.trashItem("note", "メモ 2026/9/18 架空の古いメモ", {
        id: "g",
        text: "架空の古いメモ",
      });
      globalThis.save();
      globalThis.render();
    });
    await page.getByTestId("notes-trash").click();
    expect(await audit(".trashSheet")).toEqual(clean);
    expect(errors).toEqual([]);
  });
}
