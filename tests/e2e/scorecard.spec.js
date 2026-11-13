/* global db, scoreAt, sessionScoringRadius */
"use strict";

const { expect, test } = require("@playwright/test");

/* v5 のスコア表（確定済みエンドの表示）。docs/design/v5/design.md 4.3。
   表示は高い点から（X → 10 → … → 1 → M）、保存は打った順のまま。計・累計・10・X（インドア短距離は 10・9）は
   保存された点数から数える。行をタップすると、そのエンドが下の枠に打った順で開く。 */

const A = (s, X, x = 0, y = 0) => ({ x, y, s, X: !!X });
const end = (vals) => vals.map((v) => (v === "X" ? A(10, true) : v === "M" ? A(0) : A(v)));

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
    ),
  };
}

async function open(page, active, size = { width: 375, height: 812 }) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize(size);
  const database = seedDb(active);
  await page.addInitScript((data) => {
    if (!globalThis.localStorage.getItem("archeryNote.v1"))
      globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(data));
  }, database);
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await expect(page.getByTestId("active-scorecard")).toBeVisible();
  return { errors, database };
}

/* 矢の追加・移動は間引いて保存する（scheduleSave）。保存を書き切ってから、保存された記録を読む */
const stored = (page) =>
  page.evaluate(() => {
    globalThis.flushPendingSave();
    return JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active;
  });

/* 行のセルの文字（回・矢・計・累計・数える2列） */
async function rowTexts(page, index) {
  return page
    .locator(`[data-testid="scorecard"] .scRow[data-end="${index}"] > :not(.gapCol)`)
    .evaluateAll((cells) => cells.map((c) => c.textContent.trim()));
}

test("confirmed ends are shown high to low while storage keeps the shot order", async ({
  page,
}) => {
  const shot = end([7, "X", "M", 10, 9, 10]);
  const { errors, database } = await open(page, { ends: [shot, end([9, 9, 8, "X", "X", 6])] });

  // 表示: X → 10 → 10 → 9 → 7 → M、計 46、累計 46、10（X 含む）3、X 1
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
  expect(await rowTexts(page, 1)).toEqual([
    "2",
    "X",
    "X",
    "9",
    "9",
    "8",
    "6",
    "52",
    "98",
    "2",
    "2",
  ]);
  // 見出しの「10」は X を含む数だと分かる名前を持つ
  const card = page.getByTestId("scorecard");
  await expect(card.getByRole("columnheader", { name: "10点数（X含む）" })).toHaveText("10");
  await expect(card.getByRole("columnheader", { name: "X数" })).toHaveText("X");
  await expect(card).toHaveClass(/\bp6\b/);
  await expect(card).not.toContainText(/公式|公認/);
  // 保存は打った順のまま（表示のために並べ替えない）
  expect((await stored(page)).ends).toEqual(database.active.ends);

  // 入力中のエンドは打った順。確定すると表では高い点から並ぶが、保存は打った順
  const target = page.locator("#tgsvg");
  const box = await target.boundingBox();
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2,
    ring = box.width / 2 / 1.035 / 10;
  for (const rings of [3.5, 0, 6.5, 1.5]) await page.mouse.click(cx + rings * ring, cy);
  await expect(page.locator("#curChips .slot[data-i]")).toHaveCount(4);
  expect(
    await page
      .locator("#curChips .slot[data-i]")
      .evaluateAll((slots) => slots.map((s) => s.getAttribute("aria-label"))),
  ).toEqual(["1射目 7", "2射目 X", "3射目 4", "4射目 9"]);
  const cur = (await stored(page)).cur;
  expect(cur.map((a) => a.s)).toEqual([7, 10, 4, 9]);
  await page.getByTestId("active-end").click();
  expect(await rowTexts(page, 2)).toEqual(["3", "X", "9", "7", "4", "", "", "30", "128", "1", "1"]);
  const after = await stored(page);
  expect(after.ends[2]).toEqual(cur);
  expect(after.ends.slice(0, 2)).toEqual(database.active.ends);
  expect(after.cur).toEqual([]);
  // 状態行は次のエンドへ進み、合計は累計と同じ
  await expect(page.getByTestId("active-hud")).toContainText("第4エンド");
  await expect(page.locator("#hudTotal")).toHaveText("128");
  expect(errors).toEqual([]);
});

test("a 72-arrow round gets a subtotal after 36 arrows and a total when complete", async ({
  page,
}) => {
  const six = Array.from({ length: 6 }, (_, i) => end([i === 0 ? "M" : 9, 10, "X", 9, 8, 7]));
  const { errors } = await open(page, { ends: six, cur: end([8, 9]) });
  const card = page.getByTestId("scorecard");
  // 7エンド目に入ったところ: 6エンドの直後に「前半 36射」の小計。合計行はまだ出ない
  await expect(page.getByTestId("active-hud")).toContainText("第7エンド");
  await expect(page.getByTestId("active-hud")).toContainText("37〜42射目・全72射");
  const sub = card.locator(".scSub");
  await expect(sub).toHaveCount(1);
  await expect(sub).toHaveText(/前半 36射\s*10\+X\s*12\s*X\s*6\s*309/);
  expect(
    await card.evaluate((el) =>
      [...el.children].map((c) =>
        c.classList.contains("scSub") ? "sub" : c.dataset.end || "head",
      ),
    ),
  ).toEqual(["head", "0", "1", "2", "3", "4", "5", "sub"]);
  // 記録中の表は新しいエンド（と小計）が見える位置まで送られている
  const scroller = page.getByTestId("active-scorecard");
  expect(
    await scroller.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1),
  ).toBe(true);

  // 12エンドを終えると後半の小計と合計行が出て、主ボタンが「記録を終了して結果を見る」になる
  await page.evaluate(() => {
    const s = db.active;
    s.cur = [];
    while (s.ends.length < 12) s.ends.push(JSON.parse(JSON.stringify(s.ends[1])));
    globalThis.save();
    globalThis.render();
  });
  await expect(card.locator(".scSub")).toHaveCount(3);
  await expect(card.locator(".scSub").nth(1)).toHaveText(/後半 36射\s*10\+X\s*12\s*X\s*6\s*318/);
  await expect(card.locator(".scSub.total")).toHaveText(/合計 72射\s*10\+X\s*24\s*X\s*12\s*627/);
  await expect(page.getByTestId("active-hud")).toContainText("全エンド確定");
  await expect(page.getByTestId("active-end")).toHaveCount(0);
  // 入力するエンドが無いので、空の枠の行は出さない
  await expect(page.getByTestId("active-arrow-chips")).toBeHidden();
  // 規定の射数を終えたあとは的のタップを受け付けず、状態行で知らせる
  const box = await page.locator("#tgsvg").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("#recMsg")).toHaveText("全エンドを記録済みです");
  expect((await stored(page)).cur).toEqual([]);
  const finish = page.getByTestId("active-finish-primary");
  await expect(finish).toHaveText("記録を終了して結果を見る");
  await finish.click();
  await expect(page.locator("#sumClose")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")));
  expect(saved.active).toBeNull();
  expect(saved.sessions).toHaveLength(1);
  expect(saved.sessions[0].ends).toHaveLength(12);
  expect(saved.sessions[0].ends[0].map((a) => a.s)).toEqual([0, 10, 10, 9, 8, 7]);
  expect(errors).toEqual([]);
});

test("indoor short-distance faces count 10s and 9s in 3-arrow rows", async ({ page }) => {
  const ends = Array.from({ length: 11 }, (_, i) => end(i === 0 ? [9, "X", 10] : [10, 9, 9]));
  const { errors } = await open(page, {
    dist: 18,
    faceD: 40,
    perEnd: 3,
    round: "18m60",
    ends,
    cur: end([10]),
  });
  const card = page.getByTestId("scorecard");
  await expect(card).toHaveClass(/\bp3\b/);
  // 右端の2列は 10 と 9（X の列は作らない）
  expect(
    await card.locator(".scHead > *").evaluateAll((cells) => cells.map((c) => c.textContent)),
  ).toEqual(["回", "1", "2", "3", "計", "累計", "10", "9"]);
  await expect(card.getByRole("columnheader", { name: "9点数" })).toHaveText("9");
  await expect(card.getByRole("columnheader", { name: "X数" })).toHaveCount(0);
  expect(await rowTexts(page, 0)).toEqual(["1", "X", "10", "9", "29", "29", "2", "1"]);
  expect(await rowTexts(page, 1)).toEqual(["2", "10", "9", "9", "28", "57", "1", "2"]);
  // 60射のラウンドは 30射（10エンド）で小計
  const sub = card.locator(".scSub");
  await expect(sub).toHaveCount(1);
  await expect(sub).toHaveText(/前半 30射\s*10点\s*11\s*9点\s*19\s*281/);
  expect(
    await sub.evaluate(
      (el) => el.previousElementSibling.dataset.end + "/" + el.nextElementSibling.dataset.end,
    ),
  ).toBe("9/10");
  await expect(page.getByTestId("active-hud")).toContainText("第12エンド");
  await expect(page.getByTestId("active-hud")).toContainText("34〜36射目・全60射");
  await expect(page.locator("#curChips .curRow")).toHaveClass(/\bp3\b/);
  expect(errors).toEqual([]);
});

test("free practice subtotals every 36 arrows and never blocks further ends", async ({ page }) => {
  const ends = Array.from({ length: 6 }, () => end([9, 9, 9, 9, 9, 9]));
  const { errors } = await open(page, { round: "free", ends });
  const card = page.getByTestId("scorecard");
  await expect(card.locator(".scSub")).toHaveText(/小計 1〜36射\s*10\+X\s*0\s*X\s*0\s*324/);
  await expect(card.locator(".scSub.total")).toHaveCount(0);
  await expect(page.getByTestId("active-hud")).toContainText("37〜42射目・自由練習");
  await expect(page.getByTestId("active-end")).toBeVisible();
  await expect(page.getByTestId("active-finish-primary")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("tapping a confirmed row opens that end for correction in shot order", async ({ page }) => {
  // 1エンド目: 打った順に 9（中心から 8cm）・X・7。入力中の2エンド目には 1本ある
  const first = [A(9, false, 8, 0), A(10, true, 0.5, 0.5), A(7, false, 0, -20)];
  const { errors } = await open(page, {
    ends: [first, end([10, 9, 9, 8, 8, 7])],
    cur: [A(8, false, 15, 0)],
  });
  expect(await rowTexts(page, 0)).toEqual(["1", "X", "9", "7", "", "", "", "26", "26", "1", "1"]);
  const row = page.getByRole("button", { name: "第1エンドを直す（計26点）" });
  await expect(row).toHaveAttribute("aria-pressed", "false");
  // 行のどこをタップしても開く（セルは当たり判定にしない。行全体がボタン）
  const cell = await page.locator('.scRow[data-end="0"] .endTot').boundingBox();
  expect((await page.locator('.scRow[data-end="0"]').boundingBox()).height).toBeGreaterThanOrEqual(
    44,
  );
  await page.mouse.click(cell.x + cell.width / 2, cell.y + cell.height / 2);
  await expect(row).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#curCap")).toContainText("第1エンドを修正中");
  // 下の枠は打った順（9・X・7）。表の行は高い点からのまま
  const slots = page.locator("#curChips .slot[data-i]");
  expect(await slots.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual([
    "1射目 9",
    "2射目 X",
    "3射目 7",
  ]);
  await expect(page.getByTestId("active-edit-done")).toBeVisible();
  await expect(page.getByTestId("active-end")).toHaveCount(0);
  // 的の番号も開いたエンドのもの（3本）
  await expect(page.locator("#tgmarks .arrowLabel")).toHaveCount(3);

  // 枠を選ぶ → 修正バー。1mm 右へ動かすと、描かれる矢円と同じ半径で採点し直す
  await slots.nth(0).click();
  await expect(page.locator("#nudge")).toHaveClass(/\bon\b/);
  await expect(page.locator("#nudgeTitle")).toHaveText("第1エンド 1射目を修正（9点）");
  await expect(page.locator("#nudgeDesc")).toContainText("的をタップで置き直し");
  await page.getByRole("button", { name: "選択中の矢を右に微調整", exact: true }).click();
  let s = await stored(page);
  expect(s.ends[0][0].x).toBeCloseTo(8.1, 8);
  expect(s.ends[0][0].y).toBe(0);
  const agrees = () =>
    page.evaluate(() => {
      const s = db.active,
        r = sessionScoringRadius(
          s,
          db.setups.find((x) => x.id === s.setupId),
        );
      return s.ends[0].every((a) => {
        const hit = scoreAt(a.x, a.y, s.faceD, s.faceType, r);
        return hit.s === a.s && hit.X === a.X;
      });
    });
  expect(await agrees()).toBe(true);

  // 的をタップして置き直す: 選んだ矢の位置と点数だけが変わり、本数・ほかの矢・入力中のエンドは変わらない
  const box = await page.locator("#tgsvg").boundingBox();
  const ring = box.width / 2 / 1.035 / 10;
  await page.mouse.click(box.x + box.width / 2 + 2.5 * ring, box.y + box.height / 2);
  await expect.poll(async () => (await stored(page)).ends[0][0].s).toBe(8);
  s = await stored(page);
  expect(s.ends[0]).toHaveLength(3);
  expect(s.ends[0][0].x).toBeGreaterThan(12);
  expect(s.ends[0].slice(1)).toEqual(first.slice(1));
  expect(s.ends[1]).toHaveLength(6);
  expect(s.cur).toEqual([A(8, false, 15, 0)]);
  expect(await agrees()).toBe(true);
  await expect(page.getByTestId("active-announce")).toHaveText("1射目 8点");
  // 置き直したあとも選択は残る（続けて 1mm 動かせる）
  await expect(page.locator("#nudge")).toHaveClass(/\bon\b/);
  await expect(page.locator("#nudgeTitle")).toHaveText("第1エンド 1射目を修正（8点）");

  // 削除: 確定済みエンドから1本減る
  await slots.nth(2).click();
  await page.getByRole("button", { name: "選択中の矢を削除", exact: true }).click();
  await expect.poll(async () => (await stored(page)).ends[0].length).toBe(2);
  await expect(page.locator("#nudge")).not.toHaveClass(/\bon\b/);
  // 足りない枠は、矢を選ばずに的をタップすると追加できる
  await expect(page.locator("#curCap")).toContainText("的をタップで追加");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await stored(page)).ends[0].length).toBe(3);
  s = await stored(page);
  expect(s.ends[0][2]).toMatchObject({ s: 10, X: true });
  expect(s.cur).toHaveLength(1);

  // 修正を終えると入力中のエンドに戻る。表は直した内容を高い点から表示
  await page.getByTestId("active-edit-done").click();
  await expect(page.locator("#curCap")).toBeHidden();
  await expect(row).toHaveCount(0);
  expect(await rowTexts(page, 0)).toEqual(["1", "X", "X", "8", "", "", "", "28", "28", "2", "2"]);
  expect(
    await page
      .locator("#curChips .slot[data-i]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))),
  ).toEqual(["1射目 8"]);
  await expect(page.getByTestId("active-end")).toBeVisible();
  await expect(page.locator("#tgmarks .arrowLabel")).toHaveCount(1);
  const final = await stored(page);
  await page.reload();
  await expect(page.getByTestId("active-scorecard")).toBeVisible();
  expect(await stored(page)).toEqual(final);
  expect(errors).toEqual([]);
});

test("a session saved mid-edit by an older version resumes and re-inserts the end", async ({
  page,
}) => {
  // 旧版の「エンドを開いて直す」: 開いたエンドを cur に移し、戻す位置を editIndex に持つ
  const { errors } = await open(page, {
    round: "free",
    ends: [end([9, 9, 9, 9, 9, 9]), end([7, 7, 7, 7, 7, 7])],
    cur: end([10, 10, 10, 10, 10, 8]),
    editIndex: 1,
  });
  await expect(page.getByTestId("active-hud")).toContainText("第2エンドを修正中");
  // 抜けているエンドのぶん、表の番号は 1・3
  expect((await rowTexts(page, 0))[0]).toBe("1");
  expect((await rowTexts(page, 1))[0]).toBe("3");
  await page.getByTestId("active-end").click();
  const s = await stored(page);
  expect(s.ends.map((e) => e[0].s)).toEqual([9, 10, 7]);
  expect(s.editIndex).toBeNull();
  expect(s.cur).toEqual([]);
  expect((await rowTexts(page, 1)).slice(0, 2)).toEqual(["2", "10"]);
  expect(errors).toEqual([]);
});

for (const size of [
  { width: 320, height: 568 },
  { width: 320, height: 640 },
  { width: 375, height: 812 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`scorecard fits ${size.width}x${size.height} without horizontal scroll (${theme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      const ends = [end([10, 10, 10, 10, 10, 10]), end(["X", "X", 10, 10, 9, "M"])];
      const { errors } = await open(page, { ends, cur: end([10, 10, 10, 10]) }, size);
      await page.evaluate(() => {
        db.settings.theme = "auto";
        globalThis.applyTheme();
        globalThis.render();
      });
      const m = await page.evaluate(() => {
        const vw = globalThis.innerWidth,
          vh = globalThis.innerHeight;
        const screen = globalThis.document.querySelector("#recScreen");
        const cells = [
          ...globalThis.document.querySelectorAll(
            '[data-testid="scorecard"] .scRow > *, #curChips .curRow > *',
          ),
        ];
        const texts = [...screen.querySelectorAll("*")].filter(
          (e) =>
            !e.closest("svg") &&
            e.getClientRects().length &&
            [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
        );
        return {
          pageWide: globalThis.document.documentElement.scrollWidth > vw,
          pageTall: globalThis.document.documentElement.scrollHeight > vh,
          screen: screen.getBoundingClientRect().toJSON(),
          cardWide: [...globalThis.document.querySelectorAll(".scard, .curRow")].some(
            (e) => e.scrollWidth > e.clientWidth + 1,
          ),
          outside: cells.filter((c) => {
            const r = c.getBoundingClientRect();
            return r.left < -0.5 || r.right > vw + 0.5;
          }).length,
          clipped: cells.filter((c) => c.scrollWidth > c.clientWidth + 1).length,
          minFont: Math.min(
            ...texts.map((e) => parseFloat(globalThis.getComputedStyle(e).fontSize)),
          ),
          target: globalThis.document.querySelector("#tgsvg").getBoundingClientRect().toJSON(),
          dock: globalThis.document
            .querySelector("#activeActionDock")
            .getBoundingClientRect()
            .toJSON(),
          tabs: globalThis.getComputedStyle(globalThis.document.querySelector("#tabs")).display,
          top: globalThis.getComputedStyle(globalThis.document.querySelector("#viewTop")).display,
        };
      });
      expect(m.pageWide).toBe(false);
      expect(m.pageTall).toBe(false);
      expect(m.cardWide).toBe(false);
      expect(m.outside).toBe(0);
      expect(m.clipped).toBe(0);
      expect(m.minFont).toBeGreaterThanOrEqual(13);
      // 没入画面: タブと画面名の行は隠れ、的は正方形で、操作列は画面の下端に収まる
      expect(m.tabs).toBe("none");
      expect(m.top).toBe("none");
      expect(Math.abs(m.target.width - m.target.height)).toBeLessThan(1);
      expect(m.target.width).toBeLessThanOrEqual(size.width);
      expect(m.target.width).toBeGreaterThanOrEqual(Math.min(size.width, size.height - 318) - 1);
      expect(m.dock.bottom).toBeLessThanOrEqual(size.height + 0.5);
      expect(m.dock.top).toBeGreaterThan(m.target.bottom);
      // 行はタップ対象（44px 以上）
      const rowBox = await page.locator('.scRow[data-end="1"]').boundingBox();
      expect(rowBox.height).toBeGreaterThanOrEqual(44);
      expect(errors).toEqual([]);
    });
  }
}
