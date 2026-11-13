/* global sessionsCsv */
"use strict";

const { expect, test } = require("@playwright/test");

/* 段 3: 点数だけの入力（得点キー）、「M 位置なし」、「点数だけ直す」、入力方法の切り替え。
   docs/design/v5/design.md 4.2・4.3。座標のない矢は x / y を持たず、合計・本数・10/X の数には入り、
   的の図・統計・サイトの目安には入らない。 */

const P = (x, y, s, X) => ({ x, y, s, X: !!X });
const K = (s, X) => ({ s, X: !!X, src: "key" });
const kend = (vals) => vals.map((v) => (v === "X" ? K(10, true) : v === "M" ? K(0) : K(v)));

function seedDb(active, extra) {
  return Object.assign(
    {
      schema: 5,
      setups: [{ id: "e2e-setup", name: "E2E recurve setup", bow: "Recurve", history: [] }],
      sightMarks: [],
      sessions: [],
      trash: [],
      formAnalyses: [],
      customRounds: [],
      settings: {
        eyeSight: 850,
        theme: "light",
        lastBackupAt: new Date().toISOString(),
        onboardingSeen: true,
        activeGuideSeen: true,
        launchCount: 9,
        featureHints: {
          gearSetup: true,
          analysis: true,
          sightAdjust: true,
          formTracking: true,
          addToHome: true,
          practiceDays: true,
        },
      },
      active: active
        ? Object.assign(
            {
              id: "e2e-active",
              date: "2026-11-12",
              setupId: "e2e-setup",
              dist: 70,
              faceD: 122,
              faceType: "single",
              perEnd: 6,
              arrowR: 0.285,
              round: "70m72",
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
          )
        : null,
    },
    extra || {},
  );
}

async function open(page, active, opts) {
  const o = opts || {};
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize(o.size || { width: 375, height: 812 });
  const database = seedDb(active, o.extra);
  if (o.theme) database.settings.theme = o.theme;
  await page.addInitScript((data) => {
    if (!globalThis.localStorage.getItem("archeryNote.v1"))
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(data));
  }, database);
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  if (active) await expect(page.getByTestId("active-scorecard")).toBeVisible();
  return { errors, database };
}

/* 矢の追加は間引いて保存する（scheduleSave）。保存を書き切ってから読む */
const storedDb = (page) =>
  page.evaluate(() => {
    globalThis.flushPendingSave();
    return JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
  });
const stored = async (page) => (await storedDb(page)).active;

const key = (page, id) => page.getByTestId(`score-key-${id}`);
async function press(page, ids) {
  for (const id of ids) await key(page, id).click();
}
async function rowTexts(page, index) {
  return page
    .locator(`[data-testid="scorecard"] .scRow[data-end="${index}"] > :not(.gapCol)`)
    .evaluateAll((cells) => cells.map((c) => c.textContent.trim()));
}
const slotLabels = (page) =>
  page
    .locator("#curChips .slot[data-i]")
    .evaluateAll((slots) => slots.map((s) => s.getAttribute("aria-label")));
/* 画面に NaN / undefined が出ていない */
async function expectCleanText(page) {
  const text = await page.evaluate(() => globalThis.document.body.innerText);
  expect(text).not.toMatch(/NaN|undefined/);
}
const hasCoords = (a) => Object.hasOwn(a, "x") || Object.hasOwn(a, "y");

test("a 72-arrow round is entered with the keypad only", async ({ page }) => {
  const { errors } = await open(page, { inputMode: "score" });
  // 的はなく、スコア表・入力中エンド・得点キー・操作列が並ぶ
  await expect(page.getByTestId("active-target")).toHaveCount(0);
  await expect(page.locator("#tgsvg")).toHaveCount(0);
  await expect(page.locator("#recScreen")).toHaveAttribute("data-input-mode", "score");
  expect(await page.getByTestId("score-keys").locator(".key").allTextContents()).toEqual([
    "X",
    "10",
    "9",
    "8",
    "7",
    "6",
    "5",
    "4",
    "3",
    "2",
    "1",
    "M",
  ]);
  await expect(page.getByTestId("active-miss")).toHaveCount(0);
  await expect(page.getByTestId("active-undo")).toBeDisabled();
  await expect(page.getByTestId("active-end")).toBeDisabled();

  // 1エンド目: 7 X M 10 9（打った順）。読み上げは「3射目 ミス」など
  await press(page, ["7", "X"]);
  await expect(page.getByTestId("active-announce")).toHaveText("2射目 X点");
  await press(page, ["M"]);
  await expect(page.getByTestId("active-announce")).toHaveText("3射目 ミス");
  await press(page, ["10", "9"]);
  await expect(page.getByTestId("active-announce")).toHaveText("5射目 9点");
  expect(await slotLabels(page)).toEqual(["1射目 7", "2射目 X", "3射目 M", "4射目 10", "5射目 9"]);
  await expect(page.locator("#curChips .nopos")).toHaveCount(0);
  await expect(page.getByTestId("active-end")).toHaveClass(/ghost/);
  await expect(page.getByTestId("active-end")).toContainText("あと1射");
  await expect(key(page, "9")).toBeEnabled();

  // 6射目でキーが無効になり、エンド確定が主ボタンになる。自動では確定しない
  await press(page, ["10"]);
  for (const k of await page.getByTestId("score-keys").locator(".key").all())
    await expect(k).toBeDisabled();
  await expect(page.getByTestId("active-end")).not.toHaveClass(/ghost/);
  await expect(page.getByTestId("active-end")).toHaveText("エンド確定");
  let s = await stored(page);
  expect(s.ends).toEqual([]);
  expect(s.cur).toEqual(kend([7, "X", "M", 10, 9, 10]));
  expect(s.cur.some(hasCoords)).toBe(false);

  // 取消で1射戻すとキーが戻る
  await page.getByTestId("active-undo").click();
  await expect(key(page, "10")).toBeEnabled();
  await press(page, ["10"]);

  // 確定: 表は高い点から、保存は打った順
  await page.getByTestId("active-end").click();
  expect(await rowTexts(page, 0)).toEqual([
    "1",
    "X",
    "10",
    "10",
    "9",
    "7",
    "M",
    "46",
    "46",
    "3",
    "1",
  ]);
  s = await stored(page);
  expect(s.ends).toEqual([kend([7, "X", "M", 10, 9, 10])]);
  await expect(page.getByTestId("active-hud")).toContainText("第2エンド");
  await expect(page.locator("#hudTotal")).toHaveText("46");
  await expect(key(page, "X")).toBeEnabled();

  // 2〜6エンド目 → 36射の小計（10+X と X の数）
  for (let e = 1; e < 6; e++) {
    await press(page, ["9", "10", "X", "9", "8", "7"]);
    await page.getByTestId("active-end").click();
  }
  const card = page.getByTestId("scorecard");
  await expect(card.locator(".scSub")).toHaveCount(1);
  await expect(card.locator(".scSub")).toHaveText(/前半 36射\s*10\+X\s*13\s*X\s*6\s*311/);

  // 7〜12エンド目 → 後半の小計と合計。全エンドを確定するとキーが無効になり、主ボタンが終了になる
  for (let e = 6; e < 12; e++) {
    await press(page, ["10", "10", "9", "9", "8", "M"]);
    await page.getByTestId("active-end").click();
  }
  await expect(card.locator(".scSub")).toHaveCount(3);
  await expect(card.locator(".scSub").nth(1)).toHaveText(/後半 36射\s*10\+X\s*12\s*X\s*0\s*276/);
  await expect(card.locator(".scSub.total")).toHaveText(/合計 72射\s*10\+X\s*25\s*X\s*6\s*587/);
  await expect(page.getByTestId("active-hud")).toContainText("全エンド確定");
  await expect(page.locator("#hudTotal")).toHaveText("587");
  await expect(page.getByTestId("active-arrow-chips")).toBeHidden();
  for (const k of await page.getByTestId("score-keys").locator(".key").all())
    await expect(k).toBeDisabled();
  s = await stored(page);
  expect(s.ends).toHaveLength(12);
  expect(s.ends.flat().some(hasCoords)).toBe(false);
  expect(s.ends[11].map((a) => a.s)).toEqual([10, 10, 9, 9, 8, 0]);
  await expectCleanText(page);

  // 終了: 合計は点数から。的の図は出さず「着弾データなし」
  await page.getByTestId("active-finish-primary").click();
  const sheet = page.locator(".ovl .sheet");
  const head = sheet.getByTestId("result-total");
  await expect(head.getByTestId("session-total")).toHaveText("587/ 720");
  await expect(head.locator(".vsecH .aside")).toHaveText("72射・1射平均 8.15");
  await expect(sheet.getByTestId("no-impact")).toContainText("着弾データなし");
  await expect(sheet.locator("svg.main")).toHaveCount(0);
  await expectCleanText(page);
  const saved = (await storedDb(page)).sessions[0];
  expect(saved.inputMode).toBe("score");
  expect(saved.ends.flat()).toHaveLength(72);
  expect(saved.ends.flat().some(hasCoords)).toBe(false);
  expect(errors).toEqual([]);
});

test("indoor short distance counts 10s and 9s, and other faces only offer their own scores", async ({
  page,
}) => {
  const { errors } = await open(page, {
    inputMode: "score",
    dist: 18,
    faceD: 40,
    perEnd: 3,
    round: "18m60",
    ends: [kend([10, "X", 9])],
  });
  const card = page.getByTestId("scorecard");
  await expect(card.getByRole("columnheader", { name: "10点数（X含む）" })).toHaveText("10");
  await expect(card.getByRole("columnheader", { name: "9点数" })).toHaveText("9");
  await expect(card).toHaveClass(/\bp3\b/);
  await press(page, ["9", "10", "9"]);
  await expect(key(page, "9")).toBeDisabled();
  await page.getByTestId("active-end").click();
  expect(await rowTexts(page, 1)).toEqual(["2", "10", "9", "9", "28", "57", "1", "2"]);

  // フィールド的は 6〜1 と M、三つ目的は X・10〜6 と M（scoreAt が返す値だけ）
  for (const [faceType, faceD, keys] of [
    ["field", 80, ["6", "5", "4", "3", "2", "1", "M"]],
    ["triple", 40, ["X", "10", "9", "8", "7", "6", "M"]],
  ]) {
    await page.evaluate(
      ([ft, fd]) => {
        const d = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
        Object.assign(d.active, { faceType: ft, faceD: fd, ends: [], cur: [], round: "free" });
        globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(d));
      },
      [faceType, faceD],
    );
    await page.reload();
    await expect(page.getByTestId("score-keys")).toBeVisible();
    expect(await page.getByTestId("score-keys").locator(".key").allTextContents()).toEqual(keys);
    await press(page, [keys[0], "M"]);
    const s = await stored(page);
    expect(s.cur.map((a) => [a.s, a.X])).toEqual([
      [faceType === "field" ? 6 : 10, faceType !== "field"],
      [0, false],
    ]);
  }
  expect(errors).toEqual([]);
});

test("a value is replaced by row tap, slot, key", async ({ page }) => {
  const { errors } = await open(page, {
    inputMode: "score",
    ends: [kend([7, "X", "M", 10, 9, 10]), kend([9, 9, 8, "X", "X", 6])],
    cur: kend([9, 8]),
  });
  // 行をタップすると、そのエンドが下の枠に打った順で開く（入力中のエンドは残る）
  await page.locator('[data-erow="0"]').click();
  expect(await slotLabels(page)).toEqual([
    "1射目 7",
    "2射目 X",
    "3射目 M",
    "4射目 10",
    "5射目 9",
    "6射目 10",
  ]);
  await expect(page.locator("#curCap")).toContainText("第1エンドを修正中");
  // 本数がそろっているので、枠を選ぶまでキーは押せない
  await expect(key(page, "8")).toBeDisabled();
  await page.locator('#curChips [data-i="2"]').click();
  await expect(page.locator("#curCap")).toContainText("第1エンド 3射目を選択中");
  await expect(key(page, "8")).toBeEnabled();
  await expect(page.locator("#nudge")).toBeHidden();
  await key(page, "8").click();
  await expect(page.getByTestId("active-announce")).toHaveText("3射目 8点");
  // 置き換えたあとは選択が外れ、行の計・累計が変わる。保存は打った順のまま
  await expect(page.locator("#curChips .slot.is-sel")).toHaveCount(0);
  expect(await rowTexts(page, 0)).toEqual([
    "1",
    "X",
    "10",
    "10",
    "9",
    "8",
    "7",
    "54",
    "54",
    "3",
    "1",
  ]);
  let s = await stored(page);
  expect(s.ends[0]).toEqual(kend([7, "X", 8, 10, 9, 10]));
  expect(s.ends[1]).toEqual(kend([9, 9, 8, "X", "X", 6]));
  expect(s.cur).toEqual(kend([9, 8]));

  // 開いたエンドの矢を削除すると、足りないぶんをキーで足せる
  await page.locator('#curChips [data-i="5"]').click();
  await page.getByTestId("active-slot-delete").click();
  await expect(page.locator("#curChips .slot[data-i]")).toHaveCount(5);
  await key(page, "X").click();
  s = await stored(page);
  expect(s.ends[0]).toEqual(kend([7, "X", 8, 10, 9, "X"]));
  await page.getByTestId("active-edit-done").click();

  // 入力中のエンドも同じ（枠 → キー）。選択解除で戻れる
  expect(await slotLabels(page)).toEqual(["1射目 9", "2射目 8"]);
  await page.locator('#curChips [data-i="0"]').click();
  await page.getByTestId("active-deselect").click();
  await expect(page.locator("#curChips .slot.is-sel")).toHaveCount(0);
  await page.locator('#curChips [data-i="0"]').click();
  await key(page, "M").click();
  await key(page, "7").click();
  s = await stored(page);
  expect(s.cur).toEqual(kend(["M", 8, 7]));
  await expect(page.locator("#hudTotal")).toHaveText(String(54 + 52 + 15));
  expect(errors).toEqual([]);
});

test("the input method is chosen at start and remembered", async ({ page }) => {
  const { errors } = await open(page, null);
  const target = page.getByTestId("start-input-target");
  const score = page.getByTestId("start-input-score");
  await expect(target).toHaveAttribute("aria-pressed", "true");
  for (const b of [target, score])
    expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await score.click();
  await expect(score).toHaveAttribute("aria-pressed", "true");
  await expect(target).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("record-start").click();
  await expect(page.getByTestId("score-keys")).toBeVisible();
  let d = await storedDb(page);
  expect(d.active.inputMode).toBe("score");
  expect(d.settings.lastInputMode).toBe("score");
  // 1射入れて終了。次に開いた記録の条件では「点数だけ」が選ばれている
  await key(page, "9").click();
  await page.getByTestId("active-menu").click();
  await page.getByTestId("active-finish").click();
  await page.locator("#sumClose").click();
  await expect(page.getByTestId("start-input-score")).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByTestId("start-input-score")).toHaveAttribute("aria-pressed", "true");
  // 的面に打つ を選んで始めると的が出る
  await page.getByTestId("start-input-target").click();
  await page.getByTestId("record-start").click();
  await expect(page.getByTestId("active-target")).toBeVisible();
  d = await storedDb(page);
  expect(d.active.inputMode).toBe("target");
  expect(d.settings.lastInputMode).toBe("target");
  expect(errors).toEqual([]);
});

test("M 位置なし records a miss without coordinates in target mode", async ({ page }) => {
  const placed = [P(1.2, 2.1, 10, true), P(-4.2, 6.8, 9)];
  const { errors } = await open(page, { cur: placed });
  const miss = page.getByTestId("active-miss");
  await expect(miss).toBeEnabled();
  expect((await miss.boundingBox()).height).toBeGreaterThanOrEqual(44);
  const marks = () => page.locator("#tgmarks .arrowFoot").count();
  const labels = () => page.locator("#tgmarks .arrowLabel").count();
  expect(await marks()).toBe(2);
  expect(await labels()).toBe(2);
  await miss.click();
  await expect(page.getByTestId("active-announce")).toHaveText("3射目 ミス");
  // 的には描かない。枠には M と「位置なし」
  expect(await marks()).toBe(2);
  expect(await labels()).toBe(2);
  expect(await slotLabels(page)).toEqual(["1射目 X", "2射目 9", "3射目 M 位置なし"]);
  await expect(page.locator('#curChips [data-i="2"] .nopos')).toBeVisible();
  let s = await stored(page);
  expect(s.cur[2]).toEqual({ s: 0, X: false, src: "key" });
  expect(hasCoords(s.cur[2])).toBe(false);
  expect(s.cur.slice(0, 2)).toEqual(placed);

  // 枠がそろうと押せない
  await miss.click();
  await miss.click();
  await miss.click();
  await expect(miss).toBeDisabled();
  expect((await stored(page)).cur).toHaveLength(6);
  await page.getByTestId("active-undo").click();
  await page.getByTestId("active-undo").click();
  await page.getByTestId("active-undo").click();

  // 位置のない矢は矢印で動かせない。再読み込みしても残り、確定するとスコア表で M として数える
  await page.locator('#curChips [data-i="2"]').click();
  await expect(page.locator("#nudgeDesc")).toContainText("位置なし");
  await expect(page.locator('#nudge [data-n="l"]')).toBeDisabled();
  await page.locator("#nudgeDone").click();
  await page.reload();
  await expect(page.getByTestId("active-scorecard")).toBeVisible();
  expect(await slotLabels(page)).toEqual(["1射目 X", "2射目 9", "3射目 M 位置なし"]);
  expect(await marks()).toBe(2);
  await page.getByTestId("active-end").click();
  expect(await rowTexts(page, 0)).toEqual(["1", "X", "9", "M", "", "", "", "19", "19", "1", "1"]);
  s = await stored(page);
  expect(s.ends[0][2]).toEqual({ s: 0, X: false, src: "key" });
  // 確定済みのエンドを開いたときも、的には位置のある矢だけ
  await page.locator('[data-erow="0"]').click();
  expect(await labels()).toBe(2);
  // 矢が足りないエンドには M 位置なし を足せる
  await page.getByTestId("active-miss").click();
  expect((await stored(page)).ends[0]).toHaveLength(4);
  await expectCleanText(page);
  expect(errors).toEqual([]);
});

test("点数だけ直す overrides the score, keeps the automatic score and marks it", async ({
  page,
}) => {
  // (7.8, 0) は 122cm 的で 9点（半径 12.2cm の内側）
  const { errors } = await open(page, { cur: [P(7.8, 0, 9), P(1, 1, 10, true)] });
  await page.locator('#curChips [data-i="0"]').click();
  const open1 = page.getByTestId("active-score-override");
  await expect(open1).toBeVisible();
  // 修正バーの操作はすべて 44px 以上
  for (const b of await page.locator("#nudge button").all()) {
    const box = await b.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  await open1.click();
  const sheet = page.getByTestId("score-override-sheet");
  await expect(sheet).toContainText("位置からの採点は 9点");
  for (const k of await sheet.locator(".key").all())
    expect((await k.boundingBox()).height).toBeGreaterThanOrEqual(52);
  await page.getByTestId("override-key-10").click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId("active-announce")).toHaveText("1射目 10点 手で修正");
  // 枠に * の印、見出しに「手で修正」。位置と自動採点は残る
  expect(await slotLabels(page)).toEqual(["1射目 10 手で修正", "2射目 X"]);
  await expect(page.locator('#curChips [data-i="0"] .man')).toHaveText("*");
  await expect(page.locator("#nudgeTitle")).toHaveText("1射目を修正（10点・手で修正）");
  let s = await stored(page);
  expect(s.cur[0]).toEqual({
    x: 7.8,
    y: 0,
    s: 10,
    X: false,
    manual: true,
    auto: { s: 9, X: false },
  });
  expect(s.cur[1]).toEqual(P(1, 1, 10, true));
  await expect(page.locator("#hudTotal")).toHaveText("20");

  // もう一度直しても、最初の自動採点を保つ
  await open1.click();
  await expect(page.getByTestId("score-override-sheet")).toContainText("位置からの採点は 9点");
  await page.getByTestId("override-key-8").click();
  s = await stored(page);
  expect(s.cur[0]).toEqual({
    x: 7.8,
    y: 0,
    s: 8,
    X: false,
    manual: true,
    auto: { s: 9, X: false },
  });

  // 確定するとスコア表のセルに印（読み上げ用の名前つき）。再読み込みしても残る
  await page.locator("#nudgeDone").click();
  await page.getByTestId("active-end").click();
  const cell = page.locator('[data-testid="scorecard"] .scRow[data-end="0"] .cell.is-manual');
  await expect(cell).toHaveCount(1);
  await expect(cell.getByRole("img", { name: "手で修正" })).toHaveText("*");
  await page.reload();
  await expect(page.locator('[data-testid="scorecard"] .cell.is-manual')).toHaveCount(1);
  s = await stored(page);
  expect(s.ends[0][0]).toEqual({
    x: 7.8,
    y: 0,
    s: 8,
    X: false,
    manual: true,
    auto: { s: 9, X: false },
  });

  // 自動採点に戻すと印が消える
  await page.locator('[data-erow="0"]').click();
  await page.locator('#curChips [data-i="0"]').click();
  await page.getByTestId("active-score-override").click();
  await page.getByTestId("score-override-auto").click();
  s = await stored(page);
  expect(s.ends[0][0]).toEqual(P(7.8, 0, 9));
  await expect(page.locator('[data-testid="scorecard"] .cell.is-manual')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("moving or re-placing a manually overridden arrow re-scores it from the position", async ({
  page,
}) => {
  const manual = (x, y) => ({ x, y, s: 10, X: false, manual: true, auto: { s: 9, X: false } });
  const { errors } = await open(page, { cur: [manual(7.8, 0), manual(-7.8, 0)] });
  // 1mm 動かす: 手修正を外し、動かした位置で採点する
  await page.locator('#curChips [data-i="0"]').click();
  await page.locator('#nudge [data-n="r"]').click();
  await expect(page.locator("#recMsg")).toHaveText("手修正を外して採点しました");
  let s = await stored(page);
  expect(s.cur[0]).toEqual({ x: 7.9, y: 0, s: 9, X: false });
  expect(s.cur[1]).toEqual(manual(-7.8, 0));
  await expect(page.locator('#curChips [data-i="0"] .man')).toHaveCount(0);
  await expect(page.locator('#curChips [data-i="1"] .man')).toHaveCount(1);
  // 的の図でも、手で直した矢だけに * の印（矢円の大きさと位置は変えない）
  await expect(page.locator("#tgmarks .manualMark")).toHaveCount(1);

  // 的をタップで置き直す: 同じく手修正を外す
  await page.locator('#curChips [data-i="1"]').click();
  const box = await page.locator("#tgsvg").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  s = await stored(page);
  expect(s.cur[1].s).toBe(10);
  expect(s.cur[1].X).toBe(true);
  expect(s.cur[1].manual).toBeUndefined();
  expect(s.cur[1].auto).toBeUndefined();
  expect(Math.hypot(s.cur[1].x, s.cur[1].y)).toBeLessThan(1);
  await expect(page.locator("#curChips .man")).toHaveCount(0);
  await expect(page.locator("#tgmarks .manualMark")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("manually corrected arrows carry a * on the result, note and analysis targets", async ({
  page,
}) => {
  const manual = (x, y) => ({ x, y, s: 10, X: false, manual: true, auto: { s: 9, X: false } });
  const { errors } = await open(page, { cur: [manual(7.8, 0), P(1, 1, 10, true), P(-2, 0, 10)] });
  await expect(page.locator("#tgmarks .manualMark")).toHaveCount(1);
  // 確定して終了 → 結果の図
  await page.getByTestId("active-end").click();
  await page.getByTestId("active-menu").click();
  await page.getByTestId("active-finish").click();
  await expect(page.locator("#sumPlot .manualMark")).toHaveCount(1);
  await expect(page.locator("#sumPlot").getByTestId("plot-manual-note")).toHaveText(
    "* の付いた矢（1射）は、点数を手で直した矢です。円の位置から決まる点とは違う点で記録しています。",
  );
  // 印は矢円の右上で、矢円（判定の円）の数と位置は変わらない
  const foot = await page.locator("#sumPlot .arrowFoot").count();
  expect(foot).toBe(3);
  await page.locator("#sumClose").click();
  const id = (await storedDb(page)).sessions.at(-1).id;
  await page.evaluate((i) => globalThis.openHistDetail(i), id);
  await expect(page.locator("#hPlot .manualMark")).toHaveCount(1);
  await expect(page.locator("#hPlot").getByTestId("plot-manual-note")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the input method can be switched mid-session without losing arrows", async ({ page }) => {
  const placed = [P(1.2, 2.1, 10, true), P(-4.2, 6.8, 9)];
  const { errors } = await open(page, {
    ends: [[P(3, 3, 10), P(-9, 9, 8), P(0, 20, 7)]],
    cur: placed,
  });
  await page.getByTestId("active-menu").click();
  const menu = page.getByTestId("active-menu-sheet");
  for (const id of ["input-mode-target", "input-mode-score"])
    expect((await menu.getByTestId(id).boundingBox()).height).toBeGreaterThanOrEqual(44);
  await menu.getByTestId("input-mode-score").click();
  // 点数だけへ: 的が消えてキーが出る。矢はそのまま
  await expect(page.getByTestId("score-keys")).toBeVisible();
  await expect(page.getByTestId("active-target")).toHaveCount(0);
  await expect(page.locator("body > .lensLayer")).toHaveCount(0);
  expect(await slotLabels(page)).toEqual(["1射目 X", "2射目 9"]);
  await press(page, ["8", "M"]);
  let d = await storedDb(page);
  expect(d.active.inputMode).toBe("score");
  expect(d.settings.lastInputMode).toBe("score");
  expect(d.active.cur).toEqual([...placed, K(8), K(0)]);
  expect(d.active.ends).toEqual([[P(3, 3, 10), P(-9, 9, 8), P(0, 20, 7)]]);

  // 点数だけの画面で位置のある矢の点数を変えると、手で直した扱いになる（位置は残る）
  await page.locator('#curChips [data-i="1"]').click();
  await key(page, "10").click();
  d = await storedDb(page);
  expect(d.active.cur[1]).toEqual({
    x: -4.2,
    y: 6.8,
    s: 10,
    X: false,
    manual: true,
    auto: { s: 9, X: false },
  });
  await expect(page.locator('#curChips [data-i="1"] .man')).toHaveCount(1);

  // 再読み込みしても点数だけの画面
  await page.reload();
  await expect(page.getByTestId("score-keys")).toBeVisible();

  // 的面へ戻す: 位置のない矢は枠とスコア表だけに出て、的には出ない
  await page.getByTestId("active-menu").click();
  await expect(page.getByTestId("input-mode-score")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("input-mode-target").click();
  await expect(page.getByTestId("active-target")).toBeVisible();
  await expect(page.getByTestId("score-keys")).toHaveCount(0);
  expect(await page.locator("#tgmarks .arrowLabel").count()).toBe(2);
  expect(await page.locator("#tgmarks .arrowFoot").count()).toBe(5);
  expect(await slotLabels(page)).toEqual([
    "1射目 X",
    "2射目 10 手で修正",
    "3射目 8 位置なし",
    "4射目 M 位置なし",
  ]);
  // 位置のない矢を選んで的をタップすると、位置のある矢になる
  await page.locator('#curChips [data-i="2"]').click();
  const box = await page.locator("#tgsvg").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  d = await storedDb(page);
  expect(d.active.inputMode).toBe("target");
  expect(d.active.cur[2].src).toBe("pos");
  expect(d.active.cur[2].s).toBe(10);
  expect(Number.isFinite(d.active.cur[2].x) && Number.isFinite(d.active.cur[2].y)).toBe(true);
  expect(d.active.cur[3]).toEqual(K(0));
  expect(await page.locator("#tgmarks .arrowLabel").count()).toBe(3);
  await expectCleanText(page);
  expect(errors).toEqual([]);
});

/* 位置のある 70m の記録（中心から少し右上にまとまった 12 射） */
function positionedSession(id, date) {
  const pts = [
    [2.1, 3.3],
    [-1.4, 5.2],
    [4.6, 1.1],
    [0.4, -2.6],
    [6.2, 4.4],
    [-3.3, 2.2],
    [1.8, 7.9],
    [3.9, -0.8],
    [-0.6, 3.1],
    [5.1, 6.0],
    [2.7, 0.2],
    [0.9, 4.7],
  ];
  const score = (x, y) => {
    const r = Math.hypot(x, y) - 0.285;
    return r <= 3.05 ? [10, true] : [11 - Math.ceil(r / 6.1), false];
  };
  const arrows = pts.map(([x, y]) => P(x, y, ...score(x, y)));
  return {
    id,
    date,
    setupId: "e2e-setup",
    dist: 70,
    faceD: 122,
    faceType: "single",
    perEnd: 6,
    arrowR: 0.285,
    round: "free",
    purpose: "practice",
    sightV: "5.2",
    sightH: "1",
    wx: "",
    note: "",
    windDir: "",
    windSpeed: "",
    ends: [arrows.slice(0, 6), arrows.slice(6)],
  };
}
const scoreOnlySession = (id, date, extra) =>
  Object.assign(positionedSession(id, date), {
    inputMode: "score",
    ends: [kend(["X", 10, 9, 9, 8, "M"]), kend([10, 9, 9, 8, 8, 7])],
    ...extra,
  });

test("a score-only session shows totals, and geometry says 着弾データなし without NaN", async ({
  page,
}) => {
  const { errors } = await open(page, null, {
    extra: {
      sessions: [scoreOnlySession("k1", "2026-11-10"), scoreOnlySession("k2", "2026-11-11")],
    },
  });
  await expectCleanText(page);
  // ノート（履歴）: 一覧は合計と平均、詳細は「着弾データなし」
  await page.locator('#tabs [data-v="history"]').click();
  await expect(page.locator("#histList .historyRow").first()).toContainText("97");
  await expectCleanText(page);
  await page.locator("#histList .historyRow").first().click();
  const detail = page.locator(".histDetailSheet");
  await expect(detail.getByTestId("note-total")).toHaveText("97");
  await expect(detail.getByTestId("history-detail-stats")).toContainText("12射・1射平均 8.08");
  await expect(detail.getByTestId("no-impact")).toContainText("着弾データなし");
  await expect(detail.locator("svg.main")).toHaveCount(0);
  // v5 段 6: エンドの表は記録中と同じスコア表（高い点から）
  await expect(
    detail.getByTestId("history-end-table").locator('.scRow[data-end="0"] .cell'),
  ).toHaveText(["X", "10", "9", "9", "8", "M"]);
  await detail.locator("details.histDetailNumbers summary").click();
  await expect(detail.getByTestId("history-detail-numbers")).toContainText("着弾データなし");
  await expect(detail).not.toContainText("判断信頼度");
  await expect(detail).not.toContainText("次のアクション");
  await expectCleanText(page);
  await detail.locator("#hClose").click();

  // 分析 > スコア: 得点は集計する（点数だけの記録であることを対象の行に書く）
  await page.locator('#tabs [data-v="analysis"]').click();
  await expect(page.getByTestId("analysis-target")).toContainText("2回・24射");
  await expect(page.getByTestId("analysis-target")).toContainText("うち2回は点数だけの記録です");
  await expect(page.locator("main")).toContainText("8.08");
  await expectCleanText(page);
  expect(await page.locator("main").innerHTML()).not.toMatch(/NaN|undefined/);
  // 分析 > 着弾・比較: 「着弾データなし」。的の図と統計は作らない
  await page.locator('#analysisSubTabs [data-an="impact"]').click();
  const noImpact = page.getByTestId("analysis-no-impact");
  await expect(noImpact).toContainText("着弾データなし");
  await expect(noImpact).toContainText("12射のうち、位置のある矢は 0射");
  await expect(page.locator("main svg.main")).toHaveCount(0);
  await expect(page.getByTestId("analysis-grouping-trend")).toHaveCount(0);
  await expectCleanText(page);
  expect(await page.locator("main").innerHTML()).not.toMatch(/NaN|undefined/);
  await page.locator('#analysisSubTabs [data-an="compare"]').click();
  await expect(page.getByTestId("compare-plot-a")).toHaveText("着弾データなし");
  await expect(page.getByTestId("compare-plot-b")).toHaveText("着弾データなし");
  await expect(page.locator('[data-row="rms"] [data-col="diff"]')).toHaveText("—");
  await expect(page.locator("main svg.main")).toHaveCount(0);
  await expectCleanText(page);
  expect(await page.locator("main").innerHTML()).not.toMatch(/NaN|undefined/);
  await page.locator('#analysisSubTabs [data-an="score"]').click();

  // 弓具 → サイト: 着弾傾向は出さない
  await page.locator('#tabs [data-v="gear"]').click();
  await expectCleanText(page);
  await page.locator('#gearSubTabs [data-sub="sight"]').click();
  await expect(page.locator("main")).toContainText("サイト台帳");
  await expect(page.locator("main")).not.toContainText("の着弾傾向");
  await expect(page.locator("main")).toContainText(
    "着弾データなし。この距離の練習は点数だけの記録のため",
  );
  await expectCleanText(page);
  expect(await page.locator("main").innerHTML()).not.toMatch(/NaN|undefined/);
  expect(errors).toEqual([]);
});

test("positioned sessions keep their analysis when score-only sessions are added", async ({
  page,
}) => {
  const positioned = [positionedSession("p1", "2026-11-01"), positionedSession("p2", "2026-11-03")];
  const { errors } = await open(page, null, { extra: { sessions: positioned } });
  const csvOf = () => page.evaluate(() => sessionsCsv());
  const before = await csvOf();
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator("#histList .historyRow").first().click();
  const groupBefore = await page.getByTestId("history-detail-numbers").innerHTML();
  await expect(page.locator(".histDetailSheet svg.main")).toHaveCount(1);
  await expect(page.locator(".histDetailSheet").getByTestId("no-impact")).toHaveCount(0);

  // 点数だけの記録を足す: 位置のある記録の行は1文字も変わらない
  const addSessions = async (list) => {
    await page.evaluate((add) => {
      const d = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
      d.sessions.push(...add);
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(d));
    }, list);
    await page.reload();
    await expect(page.locator("#bootFallback")).toBeHidden();
  };
  await addSessions([scoreOnlySession("k1", "2026-11-05")]);
  expect((await csvOf()).split("\n").slice(0, 3)).toEqual(before.split("\n"));
  // 位置のある矢・ない矢が混ざった記録を足す（同じ条件の位置のある記録なので、個人モデルの列は変わりうる）
  const base = positionedSession("m1", "2026-11-07");
  await addSessions([
    Object.assign(positionedSession("m1", "2026-11-07"), {
      ends: [
        [...base.ends[0], K(0)],
        [K(9), ...base.ends[1], { x: null, y: null, s: 8, X: false, src: "key" }],
      ],
    }),
  ]);
  const lines = (await csvOf()).split("\n");
  const cells = (line) => line.slice(1, -1).split('","');
  const header = cells(lines[0].replace(/^\ufeff/, ""));
  const col = (line, name) => cells(line)[header.indexOf(name)];
  const [p1, , only, mixed] = lines.slice(1);
  // 点数だけの記録: 本数・合計・平均は入り、位置から計算する列は空
  expect([col(only, "arrows"), col(only, "total"), col(only, "avg")]).toEqual([
    "12",
    "97",
    "8.083",
  ]);
  for (const name of [
    "group_x_cm",
    "group_y_cm",
    "group_rms_cm",
    "sigma_x_cm",
    "group_n",
    "excl_rms_cm",
    "robust_rms_cm",
    "legacy_rms_cm",
  ])
    expect(col(only, name)).toBe("");
  // 混ざった記録: 本数と合計は全矢、位置から計算する列は位置のある 12 射だけ（位置のある記録と同じ値）
  expect(col(mixed, "arrows")).toBe("15");
  expect(Number(col(mixed, "total"))).toBe(Number(col(p1, "total")) + 17);
  expect(col(mixed, "group_n")).toBe("12");
  for (const name of [
    "group_x_cm",
    "group_y_cm",
    "group_rms_cm",
    "sigma_x_cm",
    "sigma_y_cm",
    "rms_ci95_lo_cm",
    "excl_rms_cm",
    "robust_rms_cm",
    "legacy_rms_cm",
  ])
    expect(col(mixed, name)).toBe(col(p1, name));
  expect(lines.join("\n")).not.toMatch(/NaN|undefined|null/);

  // 位置のある記録の詳細は前と同じ数値
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator("#histList .historyRow").nth(3).click();
  await expect(page.locator(".histDetailSheet h3")).toContainText("2026/11/1");
  expect(await page.getByTestId("history-detail-numbers").innerHTML()).toBe(groupBefore);
  await page.locator(".histDetailSheet #hClose").click();
  // 混ざった記録の詳細: 的の図は位置のある矢だけで、その旨を書く
  await page.locator("#histList .historyRow").first().click();
  const detail = page.locator(".histDetailSheet");
  await expect(detail.getByTestId("plot-position-note")).toContainText("位置のある 12射を表示");
  await expect(detail.getByTestId("plot-position-note")).toContainText("位置なし 3射");
  expect(await detail.locator("#plmarks .arrowFoot").count()).toBe(12);
  await expectCleanText(page);
  await detail.locator("#hClose").click();
  // 分析: 位置のある回があるので「着弾データなし」は出さない
  await page.locator('#tabs [data-v="analysis"]').click();
  await expectCleanText(page);
  await page.locator('#analysisSubTabs [data-an="impact"]').click();
  await expect(page.getByTestId("analysis-no-impact")).toHaveCount(0);
  await expect(page.getByTestId("analysis-plot").locator("svg.main")).toHaveCount(1);
  for (const d of await page.locator("main details").all())
    await d.evaluate((el) => (el.open = true));
  await expectCleanText(page);
  expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"]) {
  test(`the keypad screen fits 320x640 (${theme})`, async ({ page }) => {
    const { errors } = await open(
      page,
      {
        inputMode: "score",
        ends: [kend(["X", 10, 9, 9, 9, 7]), kend([7, "X", 10, 7, 6, 8]), kend([9, 8, 8, 8, 9, 8])],
        cur: kend(["X", 10, 10]),
      },
      { size: { width: 320, height: 640 }, theme },
    );
    const inView = async (locator) => {
      const b = await locator.boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(320.5);
      expect(b.y + b.height).toBeLessThanOrEqual(640.5);
      return b;
    };
    const checkLayout = async () => {
      expect(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth &&
            globalThis.document.documentElement.scrollHeight <= globalThis.innerHeight,
        ),
      ).toBe(true);
      for (const k of await page.getByTestId("score-keys").locator(".key").all()) {
        const b = await inView(k);
        expect(b.height).toBeGreaterThanOrEqual(52);
        expect(b.width).toBeGreaterThanOrEqual(44);
      }
      for (const b of await page.locator("#activeActionDock button").all())
        expect((await inView(b)).height).toBeGreaterThanOrEqual(44);
      for (const s of await page.locator("#curChips .slot[data-i]").all())
        expect((await inView(s)).height).toBeGreaterThanOrEqual(44);
      // スコア表は見出しと1行以上が見える高さを保つ
      expect((await page.getByTestId("active-scorecard").boundingBox()).height).toBeGreaterThan(80);
      // 文字は 13px 以上
      const small = await page.evaluate(() =>
        [...globalThis.document.querySelectorAll("#recScreen *")]
          .filter(
            (el) => el.children.length === 0 && el.textContent.trim() && el.getClientRects().length,
          )
          .map((el) => parseFloat(globalThis.getComputedStyle(el).fontSize))
          .filter((px) => px < 13),
      );
      expect(small).toEqual([]);
    };
    await checkLayout();
    // 枠を選んだ状態（見出しと 削除 / 選択解除 が出る）でも収まる
    await page.locator('[data-erow="1"]').click();
    await page.locator('#curChips [data-i="2"]').click();
    await expect(page.getByTestId("active-slot-delete")).toBeVisible();
    await checkLayout();
    expect((await page.locator("#capMeta").boundingBox()).height).toBeGreaterThanOrEqual(44);
    // キーの文字と地のコントラスト 4.5 以上
    const ratio = await page.evaluate(() => {
      const lum = (c) => {
        const [r, g, b] = c
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const el = globalThis.document.querySelector('[data-testid="score-key-9"]');
      const cs = globalThis.getComputedStyle(el);
      const a = lum(cs.color),
        b = lum(cs.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(errors).toEqual([]);
  });
}
