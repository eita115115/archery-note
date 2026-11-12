/* global db */
"use strict";

const { expect, test } = require("@playwright/test");
const { finishFromMenu, pauseRecording, resumeRecording } = require("./record-helpers");

/* v5 の記録画面（没入画面）: タブなし・中断と再開・メニュー・1ボタンの拡大・的の外で離すと取消。
   docs/design/v5/design.md 4.2 */

function seedDb(active, settings) {
  return {
    schema: 3,
    setups: [{ id: "e2e-setup", name: "E2E recurve setup", bow: "Recurve", history: [] }],
    sightMarks: [],
    sessions: [],
    trash: [],
    formAnalyses: [],
    customRounds: [],
    settings: Object.assign(
      {
        eyeSight: 850,
        theme: "light",
        lastBackupAt: null,
        onboardingSeen: true,
        activeGuideSeen: true,
        launchCount: 9,
      },
      settings,
    ),
    active:
      active === null
        ? null
        : Object.assign(
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

async function open(page, active, settings) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (data) => {
      if (!globalThis.localStorage.getItem("archeryNote.v1"))
        globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(data));
    },
    seedDb(active, settings),
  );
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  return errors;
}

/* 矢の追加・移動は間引いて保存する（scheduleSave）。保存を書き切ってから、保存された内容を読む */
const stored = (page) =>
  page.evaluate(() => {
    globalThis.flushPendingSave();
    return JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
  });
const nine = { x: 8, y: 0, s: 9, X: false };

test.use({ viewport: { width: 375, height: 812 } });

test("recording hides the tabs; pause leaves the session resumable from the record tab", async ({
  page,
}) => {
  const errors = await open(page, { ends: [Array.from({ length: 6 }, () => nine)], cur: [nine] });
  // 没入画面: 画面名の行とタブが無く、上から 上部 → 状態行 → 的 → スコア表 → 入力中エンド → 操作列
  await expect(page.locator("html")).toHaveClass(/\brecording\b/);
  await expect(page.locator("#tabs")).toBeHidden();
  await expect(page.locator("#viewTop")).toBeHidden();
  await expect(page.locator("#btnSettings")).toBeHidden();
  const order = await page.evaluate(() =>
    [
      "#bPause",
      "#recEndN",
      "#recRuler",
      "#tgsvg",
      "#recCard",
      "#curChips",
      "#activeActionDock",
    ].map((s) => Math.round(globalThis.document.querySelector(s).getBoundingClientRect().top)),
  );
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await expect(page.locator(".recTop .condT")).toHaveText("70m・122cm的");
  await expect(page.getByTestId("active-hud")).toContainText("第2エンド");
  await expect(page.getByTestId("active-hud")).toContainText("7〜12射目・自由練習");
  await expect(page.locator("#hudTotal")).toHaveText("63");
  // 的は幅いっぱい
  expect((await page.locator("#tgsvg").boundingBox()).width).toBe(375);

  const before = await stored(page);
  await pauseRecording(page);
  await expect(page.locator("html")).not.toHaveClass(/\brecording\b/);
  await expect(page.locator("#tabs")).toBeVisible();
  await expect(page.locator("#viewTitle")).toHaveText("記録");
  const band = page.getByTestId("record-paused");
  await expect(band).toContainText("記録中の練習");
  await expect(band).toContainText("70m・122cm的");
  await expect(band).toContainText("1エンド確定・7射・63点");
  // 記録中の練習があるあいだは、新しい記録を始める入口を出さない（上書きで消さない）
  await expect(page.getByTestId("record-start")).toHaveCount(0);
  await expect(page.locator("#quickStart")).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
  // 別のタブを見て戻っても帯は残る
  await page.locator('#tabs [data-v="history"]').click();
  await expect(page.locator("#viewTitle")).toHaveText("ノート");
  await page.locator('#tabs [data-v="record"]').click();
  await resumeRecording(page);
  await expect(page.locator("#tabs")).toBeHidden();
  await expect(page.locator("#curChips .slot[data-i]")).toHaveCount(1);
  expect(await stored(page)).toEqual(before);
  // 中断したまま再読み込みしても記録は残り、記録画面に戻る
  await pauseRecording(page);
  await page.reload();
  await expect(page.getByTestId("active-target")).toBeVisible();
  await expect(page.locator("#tabs")).toBeHidden();
  expect((await stored(page)).active).toEqual(before.active);
  expect(errors).toEqual([]);
});

test("a full end blocks further taps with a status-row notice instead of a toast", async ({
  page,
}) => {
  const errors = await open(page, { cur: Array.from({ length: 5 }, () => nine) });
  const box = await page.locator("#tgsvg").boundingBox();
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  const end = page.getByTestId("active-end");
  await expect(end).toContainText("あと1射");
  await expect(end).toBeEnabled();
  await page.mouse.click(cx, cy);
  await expect(page.locator("#curChips .slot[data-i]")).toHaveCount(6);
  await expect(page.getByTestId("active-announce")).toHaveText("6射目 X点");
  await expect(end).toHaveText("エンド確定");
  const msg = page.locator("#recMsg");
  await expect(msg).toHaveAttribute("aria-live", "polite");
  await expect(msg).not.toHaveClass(/is-warn/);
  const layout = await page.locator("#tgsvg").boundingBox();
  // 7本目のタップは記録せず、状態行で知らせる（トーストは出さない・的は動かない）
  await page.mouse.click(cx, cy);
  await expect(msg).toHaveText("エンドを確定してください");
  await expect(msg).toHaveClass(/is-warn/);
  await expect(page.locator("#toast")).not.toHaveClass(/show/);
  expect((await stored(page)).active.cur).toHaveLength(6);
  expect(await page.locator("#tgsvg").boundingBox()).toEqual(layout);
  // 確定してもトーストは出ない。状態行が次のエンドへ進む
  await end.click();
  await expect(page.locator("#toast")).not.toHaveClass(/show/);
  await expect(msg).toHaveText("7〜12射目・自由練習");
  await expect(msg).not.toHaveClass(/is-warn/);
  await expect(page.getByTestId("active-hud")).toContainText("第2エンド");
  // 矢が無いときは 取消 と エンド確定 を押せない
  await expect(page.getByTestId("active-undo")).toBeDisabled();
  await expect(page.getByTestId("active-end")).toBeDisabled();
  await page.mouse.click(cx, cy);
  await expect(page.getByTestId("active-undo")).toBeEnabled();
  await page.getByTestId("active-undo").click();
  await expect.poll(async () => (await stored(page)).active.cur.length).toBe(0);
  expect(errors).toEqual([]);
});

test("one zoom button replaces the zoom chips and scoring stays in face coordinates", async ({
  page,
}) => {
  const errors = await open(page, {});
  await expect(page.locator("#zoomChips")).toHaveCount(0);
  const zoom = page.getByTestId("active-zoom");
  await expect(zoom).toHaveText("中心を拡大");
  await expect(zoom).toHaveAttribute("aria-pressed", "false");
  const zb = await zoom.boundingBox();
  expect(zb.height).toBeGreaterThanOrEqual(44);
  const view = () => page.locator("#tgsvg").evaluate((el) => el.viewBox.baseVal.width);
  const full = await view();
  expect(full).toBeCloseTo(122 * 1.035, 5);
  await zoom.click();
  await expect(zoom).toHaveText("全体に戻す");
  await expect(zoom).toHaveAttribute("aria-pressed", "true");
  expect(await view()).toBeCloseTo(122 * 0.47, 5);
  // 拡大中のタップも的の座標で記録する（画面の 1/4 幅 ≒ 14cm → 8点）
  const box = await page.locator("#tgsvg").boundingBox();
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect.poll(async () => (await stored(page)).active.cur.length).toBe(1);
  const a = (await stored(page)).active.cur[0];
  expect(a.x).toBeCloseTo((122 * 0.47) / 4, 0);
  expect(a.s).toBe(8);
  // 番号の吹き出しは拡大しても画面上で同じ大きさ（直径 22px）
  const bubble = () =>
    page.locator("#tgmarks .arrowLabel circle").evaluate((el) => el.getBoundingClientRect().width);
  expect(await bubble()).toBeGreaterThan(21);
  expect(await bubble()).toBeLessThan(26);
  await zoom.click();
  await expect(zoom).toHaveText("中心を拡大");
  expect(await view()).toBeCloseTo(full, 5);
  expect(await bubble()).toBeGreaterThan(21);
  expect(await bubble()).toBeLessThan(26);
  expect(errors).toEqual([]);
});

test("the three-spot face has no zoom button and fits the screen", async ({ page }) => {
  const errors = await open(page, { dist: 18, faceD: 40, faceType: "triple", perEnd: 3 });
  await expect(page.getByTestId("active-target")).toBeVisible();
  await expect(page.getByTestId("active-zoom")).toHaveCount(0);
  const box = await page.locator("#tgsvg").boundingBox();
  expect(box.height / box.width).toBeCloseTo(2.5, 1);
  const dock = await page.getByTestId("active-action-dock").boundingBox();
  expect(box.y + box.height).toBeLessThan(dock.y);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await stored(page)).active.cur.length).toBe(1);
  expect((await stored(page)).active.cur[0]).toMatchObject({ s: 10, X: true, spot: 1 });
  expect(errors).toEqual([]);
});

test("releasing the finger outside the target cancels the arrow", async ({ page }) => {
  const errors = await open(page, {});
  const box = await page.locator("#tgsvg").boundingBox();
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 20, cy + 20, { steps: 3 });
  await expect(page.locator("#lens")).toBeVisible();
  await expect(page.locator("#lensTag")).toContainText("点");
  // 的の枠の外（下のスコア表の上）まで指を動かすと「取消」。離しても記録しない
  await page.mouse.move(cx, box.y + box.height + 30, { steps: 4 });
  await expect(page.locator("#lensTag")).toHaveText("取消離すと記録しません");
  await page.mouse.up();
  await expect(page.locator("#lens")).toBeHidden();
  await page.waitForTimeout(100);
  expect((await stored(page)).active.cur).toEqual([]);
  await expect(page.locator("#tgmarks circle")).toHaveCount(0);
  // 外へ出ても、的の中へ戻して離せば記録する
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, box.y + box.height + 30, { steps: 4 });
  await expect(page.locator("#lensTag")).toContainText("取消");
  await page.mouse.move(cx + 10, cy, { steps: 4 });
  await expect(page.locator("#lensTag")).not.toContainText("取消");
  await page.mouse.up();
  await expect.poll(async () => (await stored(page)).active.cur.length).toBe(1);
  expect(errors).toEqual([]);
});

test("the menu holds finish, settings and the weather / note sheet", async ({ page }) => {
  const errors = await open(page, { cur: [nine, nine], wx: "晴れ" });
  await page.getByTestId("active-menu").click();
  const menu = page.getByTestId("active-menu-sheet");
  await expect(menu).toBeVisible();
  await expect(menu).toContainText("2026/11/12・70m・122cm的・E2E recurve setup");
  await expect(menu).toContainText("合計（2射）");
  await expect(menu).toContainText("9.00");
  await expect(menu.getByTestId("active-finish")).toContainText("ここで記録を終了する");
  await expect(menu.getByTestId("active-finish")).toContainText("2射まで保存して結果を表示します");
  // 入力方法の切り替え（段 3）。いまの方法が選ばれている
  await expect(menu.getByTestId("input-mode-target")).toHaveAttribute("aria-pressed", "true");
  await expect(menu.getByTestId("input-mode-score")).toHaveAttribute("aria-pressed", "false");
  for (const row of await menu.locator(".lrow").all())
    expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(44);

  // 天気・風・メモ: 記録開始時と同じ項目を途中で書き足せる
  await menu.getByRole("button", { name: /天気・風・メモを書く/ }).click();
  const meta = page.getByTestId("active-meta-sheet");
  await expect(meta.locator("#amWx")).toHaveValue("晴れ");
  await meta.locator("#amWx").selectOption("風 強");
  await meta.locator("#amWindDir").selectOption("左から");
  await meta.locator("#amWindSpeed").fill("3.5");
  await meta.locator("#amNote").fill("後半は左からの風");
  await meta.getByRole("button", { name: "保存" }).click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  const s = (await stored(page)).active;
  expect([s.wx, s.windDir, s.windSpeed, s.note]).toEqual([
    "風 強",
    "左から",
    "3.5",
    "後半は左からの風",
  ]);
  expect(s.cur).toEqual([nine, nine]);

  // 設定: 記録中は画面名の行が無いので、メニューから同じ設定を開く
  await page.getByTestId("active-menu").click();
  await expect(page.getByTestId("active-menu-sheet")).toContainText(
    "風 強・左から・3.5m/s・後半は左からの風",
  );
  await page.getByRole("button", { name: /^設定/ }).click();
  await expect(page.getByTestId("active-menu-sheet")).toHaveCount(0);
  await expect(page.locator("#setClose")).toBeVisible();
  await page.locator("#setClose").click();
  await expect(page.getByTestId("active-target")).toBeVisible();

  // 終了はメニューから
  await finishFromMenu(page);
  await expect(page.locator("#sumClose")).toBeVisible();
  const saved = await stored(page);
  expect(saved.active).toBeNull();
  expect(saved.sessions).toHaveLength(1);
  expect(saved.sessions[0].ends).toEqual([[nine, nine]]);
  expect(saved.sessions[0].note).toBe("後半は左からの風");
  await page.locator("#sumClose").click();
  await expect(page.locator("#tabs")).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/\brecording\b/);
  expect(errors).toEqual([]);
});

test("the first-run guide sits in the empty scorecard area and can be dismissed", async ({
  page,
}) => {
  const errors = await open(page, {}, { activeGuideSeen: false });
  const guide = page.getByTestId("active-guide");
  await expect(guide).toContainText("初回の操作ガイド");
  await expect(guide).toContainText("的の外で指を離すと取消");
  await guide.getByRole("button", { name: "次から表示しない" }).click();
  await expect(guide).toHaveCount(0);
  await expect(page.getByTestId("active-scorecard")).toContainText(
    "的をタップするとその位置を1射として記録します",
  );
  expect((await stored(page)).settings.activeGuideSeen).toBe(true);
  expect(errors).toEqual([]);
});

test("editing a past record uses the same screen and saves from the primary button", async ({
  page,
}) => {
  const errors = await open(page, null);
  await page.evaluate(() => {
    const end = Array.from({ length: 6 }, () => ({ x: 8, y: 0, s: 9, X: false }));
    const sess = {
      id: "past",
      date: "2026-11-01",
      setupId: "e2e-setup",
      dist: 30,
      faceD: 80,
      faceType: "single",
      perEnd: 6,
      arrowR: 0.285,
      round: "30m36",
      ends: Array.from({ length: 6 }, () => end.map((a) => ({ ...a }))),
    };
    db.sessions.push(sess);
    db.active = Object.assign(JSON.parse(JSON.stringify(sess)), { cur: [], _edit: true });
    globalThis.save();
    globalThis.render();
  });
  await expect(page.locator(".recTop .condT")).toHaveText("過去記録の編集・30m");
  // 36射のラウンドは小計なしで合計だけ
  const card = page.getByTestId("scorecard");
  await expect(card.locator(".scSub")).toHaveCount(1);
  await expect(card.locator(".scSub.total")).toHaveText(/合計 36射\s*10\+X\s*0\s*X\s*0\s*324/);
  // 行を開いて1本削除し、主ボタンで上書き保存する
  await page.getByRole("button", { name: /第2エンドを直す/ }).click();
  await page.locator('#curChips [data-i="5"]').click();
  await page.getByRole("button", { name: "選択中の矢を削除", exact: true }).click();
  await page.getByTestId("active-edit-done").click();
  await expect(page.getByTestId("active-hud")).toContainText("第7エンド");
  const save = page.getByTestId("active-end");
  await expect(save).toBeDisabled();
  await page.getByTestId("active-menu").click();
  await expect(page.getByTestId("active-finish")).toContainText("編集を終了して保存する");
  await page.getByTestId("active-finish").click();
  await expect(page.locator("#sumClose")).toBeVisible();
  const saved = await stored(page);
  expect(saved.active).toBeNull();
  expect(saved.sessions).toHaveLength(1);
  expect(saved.sessions[0].ends.map((e) => e.length)).toEqual([6, 5, 6, 6, 6, 6]);
  expect(saved.sessions[0]._edit).toBeUndefined();
  expect(errors).toEqual([]);
});
