/* global db, save, render */
"use strict";
const { test, expect } = require("@playwright/test");
const { homeResultDb } = require("./fixtures/home-result-db");
const { finishFromMenu } = require("./record-helpers");

/* v5 段 5: 今日の結果（全画面）。期待値は見本データの保存値から、この検査の中で数える。 */
test.use({ hasTouch: true, isMobile: true, serviceWorkers: "block" });

const sum = (arr) => arr.reduce((n, a) => n + a.s, 0);
const totalOf = (s) => sum(s.ends.flat());
const signed = (v, d) => {
  const r = +v.toFixed(d);
  return r === 0 ? "±0" : (r > 0 ? "+" : "−") + Math.abs(r).toFixed(d);
};

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
/* 見本の記録を「今日の記録中」にして、記録画面のメニューから終了する（終了の経路は本物を通す） */
async function finishCopyOf(page, session, patch) {
  await page.evaluate(
    ([s, p]) => {
      db.active = Object.assign(JSON.parse(JSON.stringify(s)), { id: "live", date: "2026-11-12", cur: [] }, p || {});
      save();
      render();
    },
    [session, patch || null],
  );
  await finishFromMenu(page);
  await expect(page.getByTestId("result-screen")).toBeVisible();
}

test("result screen: total, halves, counts, comparison with n / period / SD, best, scorecard, plot and memo", async ({
  page,
}) => {
  const data = homeResultDb();
  const errors = await open(page, data);
  const src = data.sessions.find((s) => s.id === "p3");
  await finishCopyOf(page, src);
  const screen = page.getByTestId("result-screen");
  const all = src.ends.flat(),
    total = totalOf(src);

  await expect(screen.locator("h3")).toHaveText("今日の結果");
  await expect(page.getByTestId("result-condition")).toHaveText("11/12（木）・70m・122cm的・架空のリカーブ");
  const head = page.getByTestId("result-total");
  await expect(head.locator(".vsecH .aside")).toHaveText(`72射・1射平均 ${(total / 72).toFixed(2)}`);
  await expect(head.getByTestId("session-total")).toHaveText(`${total}/ 720`);
  await expect(head.locator('[data-fig="halves"] .n')).toHaveText(
    `${sum(src.ends.slice(0, 6).flat())}/ ${sum(src.ends.slice(6).flat())}`,
  );
  await expect(head.locator('[data-fig="count0"]')).toHaveText(`10+X${all.filter((a) => a.s === 10).length}`);
  await expect(head.locator('[data-fig="count1"]')).toHaveText(`X${all.filter((a) => a.X).length}`);

  // 同じ条件（70m・122cm的・72射）の過去 7 回との比較。n・期間・標準偏差を文に書く
  const peers = data.sessions.filter((s) => s.dist === 70).map(totalOf);
  const mean = peers.reduce((a, b) => a + b, 0) / peers.length;
  const sd = Math.sqrt(peers.reduce((a, v) => a + (v - mean) ** 2, 0) / (peers.length - 1));
  const cmp = page.getByTestId("todays-result-comparison");
  await expect(cmp.locator(".fact")).toHaveText(
    `同じ条件の過去7回の平均 ${mean.toFixed(1)} 点との差は ${signed(total - mean, 1)} 点です。`,
  );
  await expect(cmp.locator(".basis")).toHaveText(
    `対象: 10/3〜11/10、70m・122cm的・72射。過去の回ごとの標準偏差は ${sd.toFixed(1)} 点で、今回の差は${Math.abs(total - mean) <= sd ? "その範囲内" : "それより大きい値"}です。`,
  );
  const prev = data.sessions.find((s) => s.id === "p6");
  await expect(page.getByTestId("todays-result-weekly").locator(".fact")).toHaveText(
    `同じ条件の前回（11/10）は ${totalOf(prev)} 点で、今回との差は ${signed(total - totalOf(prev), 0)} 点です。`,
  );
  // これまでの最高（p1）との差。事実と対象だけ
  const best = Math.max(...peers);
  const bestSession = data.sessions.find((s) => s.dist === 70 && totalOf(s) === best);
  const [, bm, bd] = bestSession.date.split("-").map(Number);
  const pb = page.getByTestId("todays-result-personal-best");
  await expect(pb.locator(".fact")).toHaveText(
    total < best
      ? `この距離・的・射数の最高は ${best} 点、${bm}/${bd} で、今回との差は −${best - total} 点です。`
      : `この距離・的・射数のこれまでの最高（${best} 点、${bm}/${bd}）と同じです。`,
  );
  await expect(pb.locator(".basis")).toHaveText("対象: 70m・122cm的・72射の、この日までの記録。");
  await expect(page.getByTestId("todays-result-stability")).toContainText("グループ RMS は");
  await expect(screen.locator('[data-testid^="todays-result-streak"]')).toHaveCount(0);
  const text = await screen.innerText();
  expect(text).not.toMatch(/NaN|undefined|null/);
  expect(text).not.toMatch(/おつかれ|この調子|！|!|伸びが|更新/);

  // スコア表: 記録中と同じ部品。読むだけ（行のボタンは無い）。合計行は保存値の合計
  const card = screen.getByTestId("scorecard");
  await expect(card.locator('.scRow[data-end]')).toHaveCount(12);
  await expect(card.locator(".scRowBtn")).toHaveCount(0);
  await expect(card.locator('[data-sub="total"] .tot')).toHaveText(String(total));
  await expect(card.locator('[data-sub="block"]')).toHaveCount(2);
  // 着弾: 位置のある 72 射
  await expect(screen.locator("#sumPlot svg")).toHaveCount(1);
  await expect(screen.getByTestId("result-impact-figs")).toContainText("グループRMS（全射）");
  await expect(screen.getByTestId("result-impact-figs")).toContainText("95%区間");
  await expect(screen.getByTestId("no-impact")).toHaveCount(0);

  // メモは、その記録の note（既存の項目）に残る
  const note = page.getByTestId("result-note");
  await expect(note).toHaveValue("");
  await note.fill("架空のメモ: 後半は風が弱まりました。");
  await page.locator("#sumClose").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  const after = await stored(page);
  expect(after.active).toBeNull();
  expect(after.sessions.slice(0, data.sessions.length)).toEqual(data.sessions);
  const saved = after.sessions.at(-1);
  expect(saved.note).toBe("架空のメモ: 後半は風が弱まりました。");
  expect(saved.ends).toEqual(src.ends);
  // 閉じると記録タブ。前回の練習がこの記録になる
  await expect(page.getByTestId("home-last").locator(".vsecH .aside")).toHaveText("11/12（木）・70m・72射");
  await expect(page.getByTestId("home-last").getByTestId("session-total")).toHaveText(`${total}/ 720`);
  await expect(page.getByTestId("home-recent-row").first().locator(".txt")).toHaveText(
    "架空のメモ: 後半は風が弱まりました。",
  );
  await page.reload();
  expect((await stored(page)).sessions).toEqual(after.sessions);
  expect(errors).toEqual([]);
});

test("a new best is stated as a plain fact with the previous best and its date", async ({ page }) => {
  const data = homeResultDb();
  const errors = await open(page, data);
  const peers = data.sessions.filter((s) => s.dist === 70);
  const best = Math.max(...peers.map(totalOf));
  const bestSession = peers.find((s) => totalOf(s) === best);
  const [, bm, bd] = bestSession.date.split("-").map(Number);
  // 架空: すべて 10 点の 72 射（位置は中心）
  const perfect = Object.assign({}, peers[0], {
    ends: Array.from({ length: 12 }, () =>
      Array.from({ length: 6 }, () => ({ x: 0, y: 0, s: 10, X: true })),
    ),
  });
  await finishCopyOf(page, perfect);
  await expect(page.getByTestId("todays-result-personal-best").locator(".fact")).toHaveText(
    `この距離・的・射数で最高です（これまで ${best} 点、${bm}/${bd}）。`,
  );
  await expect(page.getByTestId("todays-result-comparison").locator(".basis")).toContainText(
    "今回の差はそれより大きい値です。",
  );
  await expect(page.getByTestId("result-total").getByTestId("session-total")).toHaveText("720/ 720");
  await page.getByTestId("result-analysis").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  await expect(page.locator("#viewTitle")).toHaveText("分析");
  expect((await stored(page)).sessions).toHaveLength(data.sessions.length + 1);
  expect(errors).toEqual([]);
});

test("score-only session: 着弾データなし, no impact figures, no broken values", async ({ page }) => {
  const data = homeResultDb();
  const errors = await open(page, data);
  const src = data.sessions.find((s) => s.id === "p5");
  await finishCopyOf(page, src);
  const screen = page.getByTestId("result-screen");
  await expect(screen.getByTestId("session-total")).toHaveText(`${totalOf(src)}/ 720`);
  await expect(screen.locator(".vsecH", { hasText: "着弾" }).locator(".aside")).toHaveText("位置の記録なし");
  await expect(screen.getByTestId("no-impact")).toContainText("着弾データなし");
  await expect(screen.locator("#sumPlot svg")).toHaveCount(0);
  await expect(screen.getByTestId("result-impact-figs")).toHaveCount(0);
  await expect(screen.getByTestId("todays-result-stability")).toHaveCount(0);
  await expect(screen.getByTestId("todays-result-comparison")).toContainText("同じ条件の過去7回の平均");
  await expect(screen.getByTestId("scorecard").locator('[data-sub="total"] .tot')).toHaveText(
    String(totalOf(src)),
  );
  await screen.locator(".summaryDetails summary").click();
  expect(await screen.innerText()).not.toMatch(/NaN|undefined|null/);
  await page.locator("#sumClose").click();
  const saved = (await stored(page)).sessions.at(-1);
  expect(saved.ends).toEqual(src.ends);
  expect(saved.ends.flat().every((a) => !("x" in a) && !("y" in a))).toBe(true);
  expect(errors).toEqual([]);
});

test("no comparison is shown, with the reason, for fewer than 3 past sessions and for a partial round", async ({
  page,
}) => {
  const data = homeResultDb();
  // 70m は 2 回だけ残す
  data.sessions = data.sessions.filter((s) => s.dist !== 70 || ["p0", "p1"].includes(s.id));
  const errors = await open(page, data);
  const src = data.sessions.find((s) => s.id === "p1");
  await finishCopyOf(page, src);
  const cmp = page.getByTestId("todays-result-comparison");
  await expect(cmp.locator(".fact")).toHaveText(
    "同じ条件の過去の記録が2回のため、平均との比較は表示していません。",
  );
  await expect(cmp.locator(".basis")).toHaveText(
    "条件: 70m・122cm的・72射。3回以上あるときに、平均と回ごとの標準偏差を表示します。",
  );
  await page.locator("#sumClose").click();

  // 72 射のラウンドを 36 射で終了: 射数が違うので比べない。前半 / 後半も出さない
  await finishCopyOf(page, src, { id: "live2", ends: src.ends.slice(0, 6) });
  await expect(page.getByTestId("todays-result-comparison").locator(".fact")).toHaveText(
    "36射で終了した記録です。射数が違うため、過去の 72射の合計とは比べていません。",
  );
  const head = page.getByTestId("result-total");
  await expect(head.locator('[data-fig="halves"]')).toHaveCount(0);
  await expect(head.locator('[data-fig="ends"]')).toHaveText("エンド6");
  await expect(head.getByTestId("session-total")).toHaveText(`${sum(src.ends.slice(0, 6).flat())}/ 720`);
  expect(await page.getByTestId("result-screen").innerText()).not.toMatch(/NaN|undefined|null/);
  expect(errors).toEqual([]);
});

test("indoor 18m / 40cm counts 10 and 9, consistent with the scorecard", async ({ page }) => {
  const data = homeResultDb();
  const errors = await open(page, data);
  const src = data.sessions.find((s) => s.id === "i0");
  await finishCopyOf(page, src);
  const all = src.ends.flat();
  const head = page.getByTestId("result-total");
  await expect(head.getByTestId("session-total")).toHaveText(`${totalOf(src)}/ 600`);
  await expect(head.locator('[data-fig="halves"] .n')).toHaveText(
    `${sum(src.ends.slice(0, 10).flat())}/ ${sum(src.ends.slice(10).flat())}`,
  );
  await expect(head.locator('[data-fig="count0"]')).toHaveText(`10点${all.filter((a) => a.s === 10).length}`);
  await expect(head.locator('[data-fig="count1"]')).toHaveText(`9点${all.filter((a) => a.s === 9).length}`);
  const totalRow = page.getByTestId("result-screen").locator('[data-testid="scorecard"] [data-sub="total"]');
  await expect(totalRow).toContainText(`10点${all.filter((a) => a.s === 10).length}`);
  await expect(totalRow).toContainText(`9点${all.filter((a) => a.s === 9).length}`);
  // 同じ条件は 2 回（i0・i1）なので比較は出ない
  await expect(page.getByTestId("todays-result-comparison")).toContainText("2回のため");
  expect(errors).toEqual([]);
});

test("streak line appears only when practice goals are on, as a plain fact", async ({ page }) => {
  const data = homeResultDb({ gamification: true });
  const errors = await open(page, data);
  const src = data.sessions.find((s) => s.id === "p3");
  await finishCopyOf(page, src);
  const gam = page.getByTestId("summary-gamification");
  await expect(gam.locator(".fact")).toHaveText(/^連続記録は \d+ 日です（この記録の前は \d+ 日）。/);
  await expect(gam.locator(".summaryStreakIcon, .summaryBadgeIcon, svg")).toHaveCount(0);
  await page.locator("#sumClose").click();
  await page.evaluate(() => {
    db.settings.gamification.enabled = false;
    save();
  });
  await finishCopyOf(page, src, { id: "live2" });
  await expect(page.getByTestId("summary-gamification")).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"]) {
  test(`result screen fits 320×640 (${theme})`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    const data = homeResultDb({ theme });
    const errors = await open(page, data, { width: 320, height: 640 });
    await finishCopyOf(page, data.sessions.find((s) => s.id === "p3"));
    const screen = page.getByTestId("result-screen");
    // 全画面: 画面名の行とタブは結果の下に隠れる
    const box = await screen.boundingBox();
    expect(box).toEqual({ x: 0, y: 0, width: 320, height: 640 });
    await expect(page.locator("#sumClose")).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId("result-analysis")).toBeInViewport({ ratio: 1 });
    await expect(screen.getByTestId("session-total")).toBeInViewport({ ratio: 1 });
    await screen.locator(".summaryDetails summary").click();
    const audit = await screen.evaluate((root) => {
      const visible = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
      const small = [...root.querySelectorAll("*")]
        .filter(
          (e) =>
            visible(e) &&
            !e.closest("svg") &&
            !e.closest(".summaryDetails") &&
            [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
            parseFloat(getComputedStyle(e).fontSize) < 13,
        )
        .map((e) => e.className + ":" + e.textContent.trim().slice(0, 10));
      const shortTargets = [...root.querySelectorAll("button, textarea, summary")]
        .filter((e) => visible(e) && e.getBoundingClientRect().height < 44)
        .map((e) => (e.id || e.className) + ":" + Math.round(e.getBoundingClientRect().height));
      const wide = [...root.querySelectorAll("*")]
        .filter((e) => visible(e) && !e.closest("svg") && e.getBoundingClientRect().right > globalThis.innerWidth + 0.5)
        .map((e) => e.className || e.tagName);
      return { small, shortTargets, wide, hscroll: root.scrollWidth > root.clientWidth };
    });
    expect(audit).toEqual({ small: [], shortTargets: [], wide: [], hscroll: false });
    await page.screenshot({ path: info.outputPath(`result-320-${theme}.png`) });
    // 下端の操作は最後の内容（画像保存）を隠さない
    await screen.evaluate((el) => (el.scrollTop = el.scrollHeight));
    const card = await page.locator("#sumCard").boundingBox(),
      bar = await screen.locator(".actbar").boundingBox();
    expect(card.y + card.height).toBeLessThanOrEqual(bar.y);
    expect(errors).toEqual([]);
  });
}
