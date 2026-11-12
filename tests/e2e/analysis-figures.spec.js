/* global db, sessionMetrics */
"use strict";
const { test, expect } = require("@playwright/test");
const {
  diff1,
  gotoSubTab,
  homeResultDb,
  md,
  mean,
  openAnalysis,
  richAnalysisDb,
  sd,
  signed,
  stored,
  sum,
  totalOf,
} = require("./analysis-helpers");

/* v5 段 7: 分析の数値。期待値は見本データの保存値から、この検査の中で数える。
   着弾の統計は、画面の外で同じ記録に sessionMetrics（20-scoring.js の robustStats）を当てた値と突き合わせる。 */
test.use({ hasTouch: true, isMobile: true, serviceWorkers: "block" });

const outdoor = (data) =>
  data.sessions.filter((s) => s.dist === 70).sort((a, b) => a.date.localeCompare(b.date));
const fig = (scope, key) => scope.locator(`[data-fig="${key}"]`);
const statsOf = (page, id) =>
  page.evaluate((sid) => {
    const st = sessionMetrics(db.sessions.find((s) => s.id === sid)).st;
    if (!st) return null;
    return {
      n: st.n,
      total: st.total,
      rr: st.rr,
      ci: st.rrCi,
      mx: st.mx,
      my: st.my,
      sx: st.sx,
      sy: st.sy,
      ciX: st.ciX,
      ciY: st.ciY,
      b: st.excl.rr,
      c: st.robust ? st.robust.rr : null,
      flagged: st.excluded.length,
    };
  }, id);
const dirText = (mx, my) => {
  const p = [];
  if (Math.abs(mx) >= 0.05) p.push(`${mx > 0 ? "右" : "左"} ${Math.abs(mx).toFixed(1)}cm`);
  if (Math.abs(my) >= 0.05) p.push(`${my > 0 ? "上" : "下"} ${Math.abs(my).toFixed(1)}cm`);
  return p.join("・");
};

test("score: mean, latest and best match the stored totals and the target line states n, arrows and period", async ({
  page,
}) => {
  const data = homeResultDb();
  const errors = await openAnalysis(page, data);
  const list = outdoor(data);
  const totals = list.map(totalOf);
  const best = Math.max(...totals);
  const score = page.getByTestId("analysis-score");
  await expect(page.locator("#anCond")).toHaveValue("70|122|single|72");
  await expect(page.locator("#anCond option:checked")).toHaveText("70m・122cm的・72射");
  await expect(fig(score, "mean").locator(".n")).toHaveText(mean(totals).toFixed(1));
  await expect(fig(score, "mean").locator(".d")).toHaveText("7回");
  await expect(fig(score, "latest").locator(".n")).toHaveText(String(totals[6]));
  await expect(fig(score, "latest").locator(".d")).toHaveText("11/10");
  await expect(fig(score, "best").locator(".n")).toHaveText(String(best));
  await expect(fig(score, "best").locator(".d")).toHaveText(md(list[totals.lastIndexOf(best)].date));
  await expect(page.getByTestId("analysis-target")).toHaveText(
    "対象: 70m・122cm的・72射、7回・504射、10/3〜11/10。うち1回は点数だけの記録です。",
  );
  /* 推移の図: 軸の文字は 13px 以上、7回ぶんの点 */
  const chart = page.locator("svg.lineChart");
  await expect(chart).toHaveAttribute("aria-label", new RegExp(`11/10 ${totals[6]}点`));
  await expect(chart.locator("circle")).toHaveCount(7);
  const sizes = await chart
    .locator("text")
    .evaluateAll((els) => els.map((el) => parseFloat(globalThis.getComputedStyle(el).fontSize)));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(13);
  expect(await chart.evaluate((el) => el.getBoundingClientRect().width / el.viewBox.baseVal.width)).toBeCloseTo(1, 2);
  await expect(page.getByTestId("analysis-sd")).toHaveText(
    `回ごとの標準偏差は ${sd(totals).toFixed(1)} 点です。`,
  );
  /* 前半と後半 */
  const firsts = list.map((s) => sum(s.ends.slice(0, 6).flat())),
    seconds = list.map((s) => sum(s.ends.slice(6, 12).flat()));
  const halves = page.getByTestId("analysis-halves");
  await expect(fig(halves, "first").locator(".n")).toHaveText(mean(firsts).toFixed(1));
  await expect(fig(halves, "second").locator(".n")).toHaveText(mean(seconds).toFixed(1));
  await expect(fig(halves, "diff").locator(".n")).toHaveText(
    signed(diff1(mean(seconds), mean(firsts)), 1),
  );
  await expect(halves).toContainText("7回の平均です");
  await expect(halves).toContainText(
    `差の回ごとの標準偏差は ${sd(seconds.map((v, i) => v - firsts[i])).toFixed(1)} 点です。`,
  );
  /* エンド別の平均 */
  const endAvg = Array.from({ length: 12 }, (_, i) => mean(list.map((s) => sum(s.ends[i]))));
  const cells = page.getByTestId("analysis-end-strip").locator("[data-end] b");
  await expect(cells).toHaveText(endAvg.map((v) => v.toFixed(1)));
  await expect(page.getByTestId("analysis-end-avg")).toContainText("各エンドの合計を 7回で平均した値です");
  /* 得点の内訳 */
  const all = list.flatMap((s) => s.ends.flat());
  const dist = page.getByTestId("analysis-score-dist");
  await expect(dist).toContainText("全504射");
  const xCount = all.filter((a) => a.X).length;
  await expect(dist.locator(".histScoreRow").first()).toContainText(`${xCount}射`);
  /* 条件ごとの記録と月ごとのまとめは、すべての条件が対象 */
  const conds = page.getByTestId("analysis-cond-row");
  await expect(conds).toHaveCount(2);
  await expect(conds.nth(0)).toContainText("70m・122cm的・72射");
  await expect(conds.nth(0)).toContainText(`平均 ${mean(totals).toFixed(1)}`);
  await expect(conds.nth(0)).toContainText(`最高 ${best}`);
  await expect(conds.nth(0)).toHaveAttribute("aria-current", "true");
  const indoor = data.sessions.filter((s) => s.dist === 18).map(totalOf);
  await expect(conds.nth(1)).toContainText("18m・40cm的・60射");
  await expect(conds.nth(1)).toContainText(`平均 ${mean(indoor).toFixed(1)}`);
  const months = page.getByTestId("analysis-monthly").locator("tr");
  await expect(months).toHaveCount(3);
  const nov = data.sessions.filter((s) => s.date.startsWith("2026-11"));
  const novArrows = nov.flatMap((s) => s.ends.flat());
  await expect(months.nth(1).locator("td")).toHaveText([
    "2026/11",
    `${nov.length}回`,
    `${novArrows.length}射`,
    (sum(novArrows) / novArrows.length).toFixed(2),
  ]);
  /* 保存された点数は読むだけ */
  expect((await stored(page)).sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("score: one factual trend sentence at five or more sessions, none below five", async ({
  page,
}) => {
  const data = homeResultDb();
  await openAnalysis(page, data);
  const totals = outdoor(data).map(totalOf);
  const recent = mean(totals.slice(-3)),
    earlier = mean(totals.slice(0, 4));
  const trend = page.getByTestId("analysis-trend");
  await expect(trend).toHaveCount(1);
  await expect(trend).toHaveText(
    `直近3回の平均は ${recent.toFixed(1)} 点、それより前の4回の平均は ${earlier.toFixed(1)} 点で、差は ${signed(diff1(recent, earlier), 1)} 点です。`,
  );
  await expect(page.getByTestId("analysis-trend-pending")).toHaveCount(0);
  /* 期間で 5回に絞っても文は出る（10/14 以降）。対象の行に期間が入る */
  await page.locator("#anPeriod").selectOption("30d");
  const five = totals.slice(2);
  await expect(page.getByTestId("analysis-target")).toHaveText(
    "対象: 70m・122cm的・72射、5回・360射、10/14〜11/10、期間は直近30日。うち1回は点数だけの記録です。",
  );
  await expect(page.getByTestId("analysis-trend")).toHaveText(
    `直近3回の平均は ${mean(five.slice(-3)).toFixed(1)} 点、それより前の2回の平均は ${mean(five.slice(0, 2)).toFixed(1)} 点で、差は ${signed(diff1(mean(five.slice(-3)), mean(five.slice(0, 2))), 1)} 点です。`,
  );
  /* 18m は 2回: 傾向の文は出さず、回数を書く */
  await page.locator("#anPeriod").selectOption("all");
  await page.locator("#anCond").selectOption("18|40|single|60");
  await expect(page.getByTestId("analysis-trend")).toHaveCount(0);
  await expect(page.getByTestId("analysis-trend-pending")).toHaveText(
    "同じ条件の記録が 5回以上あるときに、直近3回とそれより前の平均の差を表示します（いまは 2回）。",
  );
  await expect(page.getByTestId("analysis-target")).toHaveText(
    "対象: 18m・40cm的・60射、2回・120射、11/1〜11/7。",
  );
  /* 弓具で絞ると 1回。図も標準偏差も出さない */
  await page.locator("#anSetup").selectOption("s2");
  await expect(page.getByTestId("analysis-target")).toHaveText(
    "対象: 18m・40cm的・60射、1回・60射、11/7、弓具は 架空のインドア用。",
  );
  await expect(page.locator("svg.lineChart")).toHaveCount(0);
  await expect(page.getByTestId("analysis-sd")).toHaveCount(0);
  await expect(page.getByTestId("analysis-trend")).toHaveCount(0);
  /* 合う記録が無い組み合わせは、その旨と 0回 を書く */
  await page.locator("#anCond").selectOption("70|122|single|72");
  await expect(page.getByTestId("analysis-score-none")).toContainText("この条件の記録はありません");
  await expect(page.getByTestId("analysis-score-none")).toContainText("0回");
  await expect(page.getByTestId("analysis-score")).toHaveCount(0);
});

test("score: four sessions under the same condition show no trend sentence", async ({ page }) => {
  const data = homeResultDb();
  data.sessions = data.sessions.filter((s) => !["p0", "p1", "p2"].includes(s.id));
  await openAnalysis(page, data);
  await expect(page.getByTestId("analysis-target")).toContainText("4回・288射");
  await expect(page.getByTestId("analysis-trend")).toHaveCount(0);
  await expect(page.getByTestId("analysis-trend-pending")).toContainText("いまは 4回");
  const text = await page.getByTestId("analysis-trend-section").innerText();
  expect(text).not.toMatch(/上が|下が|伸び|傾向/);
});

test("score: tapping a condition row shows that condition", async ({ page }) => {
  const data = homeResultDb();
  await openAnalysis(page, data);
  await page.getByTestId("analysis-cond-row").nth(1).click();
  await expect(page.locator("#anCond")).toHaveValue("18|40|single|60");
  await expect(page.locator("#anCond")).toBeFocused();
  await expect(page.getByTestId("analysis-target")).toContainText("18m・40cm的・60射、2回・120射");
  /* インドアの短距離は 10 と 9 を数える。前半と後半は 30射ずつ */
  await expect(page.getByTestId("analysis-halves")).toContainText("30射ずつ");
});

test("impact: RMS with its 95% interval, centre offset and spreads match the all-arrow statistics", async ({
  page,
}) => {
  const data = homeResultDb();
  const errors = await openAnalysis(page, data);
  await gotoSubTab(page, "impact");
  /* 既定は位置のある最新の記録 */
  await expect(page.locator("#anImpact")).toHaveValue("p6");
  const st = await statsOf(page, "p6");
  expect(st.n).toBe(72);
  const view = page.getByTestId("analysis-impact");
  await expect(fig(view, "rms").locator(".l")).toHaveText("グループRMS（全射）");
  await expect(fig(view, "rms").locator(".n")).toHaveText(`${st.rr.toFixed(1)}cm`);
  await expect(fig(view, "rms").locator(".d")).toHaveText(
    `95%区間 ${st.ci.lo.toFixed(1)}〜${st.ci.hi.toFixed(1)}cm`,
  );
  await expect(fig(view, "offset").locator(".l")).toHaveText("着弾中心のずれ");
  await expect(fig(view, "offset").locator(".n")).toHaveText(
    `${Math.hypot(st.mx, st.my).toFixed(1)}cm`,
  );
  await expect(fig(view, "offset").locator(".d")).toHaveText(dirText(st.mx, st.my));
  await expect(fig(view, "sx").locator(".n")).toHaveText(`${st.sx.toFixed(1)}cm`);
  await expect(fig(view, "sy").locator(".n")).toHaveText(`${st.sy.toFixed(1)}cm`);
  await expect(page.getByTestId("analysis-impact-target")).toContainText(
    "対象: 11/10（火）・70m・122cm的、位置のある 72射。",
  );
  await expect(page.getByTestId("analysis-impact-target")).toContainText(
    `左右 ±${st.ciX.toFixed(1)}cm・上下 ±${st.ciY.toFixed(1)}cm`,
  );
  /* 図: 72射すべて。矢の円は判定と同じ半径（外径 5.7mm → 白い縁の外側が 0.285cm）。十字と半径 RMS の円 */
  const plot = page.getByTestId("analysis-plot");
  await expect(plot.locator("circle.arrowFoot")).toHaveCount(72);
  const foot = await plot.locator("circle.arrowFoot").first().evaluate((el) => ({
    r: +el.getAttribute("r"),
    sw: +el.getAttribute("stroke-width"),
  }));
  expect(foot.r + foot.sw / 2).toBeCloseTo(0.285, 6);
  const ring = plot.locator("#anmarks circle[stroke-dasharray]:not(.arrowLocator)");
  await expect(ring).toHaveCount(1);
  expect(+(await ring.getAttribute("r"))).toBeCloseTo(st.rr, 9);
  expect(+(await ring.getAttribute("cx"))).toBeCloseTo(st.mx, 9);
  await expect(plot.locator("ellipse")).toHaveCount(0);
  /* エンドごとの RMS は 12 エンドぶん */
  await expect(page.getByTestId("analysis-end-rms-strip").locator("[data-end]")).toHaveCount(12);
  expect((await stored(page)).sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("impact: the reference metrics B and C appear only inside the collapsed details", async ({
  page,
}) => {
  const data = homeResultDb();
  /* 大きく外れた矢を1本入れて、外れ値候補が出る記録にする（保存された点数はそのまま） */
  const p6 = data.sessions.find((s) => s.id === "p6");
  Object.assign(p6.ends[0][0], { x: 55, y: -50 });
  await openAnalysis(page, data);
  await gotoSubTab(page, "impact");
  const st = await statsOf(page, "p6");
  expect(st.flagged).toBeGreaterThan(0);
  expect(st.b).toBeLessThan(st.rr);
  const ref = page.getByTestId("analysis-ref-metrics");
  await expect(ref.locator("summary")).toContainText("比較用の指標");
  expect(await ref.evaluate((el) => el.open)).toBe(false);
  await expect(ref.locator('[data-ref="b"]')).toBeHidden();
  await expect(ref.locator('[data-ref="c"]')).toBeHidden();
  /* 閉じた状態の画面に、B と C の数値は出ていない。正式な値は全射（A） */
  const closed = await page.locator("#main").innerText();
  expect(closed).not.toContain("ロバストRMS");
  expect(closed).not.toContain("外れ値候補を除いたRMS");
  await expect(fig(page.getByTestId("analysis-impact"), "rms").locator(".n")).toHaveText(
    `${st.rr.toFixed(1)}cm`,
  );
  await ref.locator("summary").click();
  await expect(ref.locator('[data-ref="b"] .lv')).toContainText(`${st.b.toFixed(1)} cm`);
  await expect(ref.locator('[data-ref="b"] .lv')).toContainText(`72射のうち ${st.flagged}射を除く`);
  await expect(ref.locator('[data-ref="c"] .lv')).toContainText(`${st.c.toFixed(1)} cm`);
  await expect(ref.locator('[data-ref="flagged"] .lv')).toHaveText(`${st.flagged}射`);
  await expect(ref).toContainText("正式な値は上の全射の RMS です");
  /* 開いても正式な値は変わらない */
  await expect(fig(page.getByTestId("analysis-impact"), "rms").locator(".n")).toHaveText(
    `${st.rr.toFixed(1)}cm`,
  );
});

for (const key of ["Enter", "Space"]) {
  test(`impact: the reference metrics open with ${key} and keep focus`, async ({ page }) => {
    await openAnalysis(page, homeResultDb());
    await gotoSubTab(page, "impact");
    const ref = page.getByTestId("analysis-ref-metrics"),
      summary = ref.locator("summary");
    await summary.focus();
    await summary.press(key);
    await expect.poll(() => ref.evaluate((el) => el.open)).toBe(true);
    await expect(summary).toBeFocused();
    await summary.press(key);
    await expect.poll(() => ref.evaluate((el) => el.open)).toBe(false);
    await expect(summary).toBeFocused();
  });
}

test("impact: a score-only record shows 着弾データなし with the positioned count, and no plot or statistics", async ({
  page,
}) => {
  const data = homeResultDb();
  const errors = await openAnalysis(page, data);
  await gotoSubTab(page, "impact");
  await page.locator("#anImpact").selectOption("p5");
  await expect(page.locator("#anImpact option:checked")).toContainText("点数だけ");
  const none = page.getByTestId("analysis-no-impact");
  await expect(none).toContainText("着弾データなし");
  await expect(none).toContainText("72射のうち、位置のある矢は 0射");
  await expect(page.getByTestId("analysis-plot")).toHaveCount(0);
  await expect(page.getByTestId("analysis-impact")).toHaveCount(0);
  await expect(page.getByTestId("analysis-ref-metrics")).toHaveCount(0);
  await expect(page.locator("#main svg.main")).toHaveCount(0);
  const p5 = data.sessions.find((s) => s.id === "p5");
  await expect(page.locator("#main")).toContainText(`${totalOf(p5)} 点`);
  /* 推移の表は、位置のある矢が3射以上ある 6回だけ（点数だけの 11/4 は入らない） */
  const rows = page.getByTestId("analysis-grouping-trend").locator(".cmpRow:not(.is-head)");
  await expect(rows).toHaveCount(6);
  await expect(page.getByTestId("analysis-grouping-trend")).toContainText(
    "位置のある矢が3射以上ある 6回",
  );
  await expect(page.getByTestId("analysis-grouping-trend")).not.toContainText("11/4");
  expect((await stored(page)).sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("impact: the default is the latest record with positions, and mixed records state both counts", async ({
  page,
}) => {
  const data = homeResultDb();
  const p6 = data.sessions.find((s) => s.id === "p6");
  p6.ends = p6.ends.map((e) => e.map((a) => ({ s: a.s, X: a.X, src: "key" })));
  const i1 = data.sessions.find((s) => s.id === "i1");
  i1.ends[0] = i1.ends[0].map((a) => ({ s: a.s, X: a.X, src: "key" }));
  await openAnalysis(page, data);
  await gotoSubTab(page, "impact");
  await expect(page.locator("#anImpact")).toHaveValue("i1");
  await expect(page.getByTestId("analysis-impact-target")).toContainText(
    "位置のある 57射（位置なし 3射は図と数値に入れていません）",
  );
  await expect(page.getByTestId("analysis-plot").locator("circle.arrowFoot")).toHaveCount(57);
  const st = await statsOf(page, "i1");
  expect(st.n).toBe(57);
  /* 位置のある矢が 2射未満のエンドは「—」 */
  await expect(
    page.getByTestId("analysis-end-rms-strip").locator('[data-end="0"] b'),
  ).toHaveText("—");
  /* 外径 9.3mm の弓具は、その半径で描く */
  const foot = await page
    .getByTestId("analysis-plot")
    .locator("circle.arrowFoot")
    .first()
    .evaluate((el) => +el.getAttribute("r") + +el.getAttribute("stroke-width") / 2);
  expect(foot).toBeCloseTo(0.285, 6); // 見本の記録は arrowR 0.285 を保存している
});

test("impact: fewer than three positioned arrows shows the plot but no RMS", async ({ page }) => {
  const data = homeResultDb();
  const p6 = data.sessions.find((s) => s.id === "p6");
  p6.ends = p6.ends.map((e, ei) =>
    e.map((a, ai) => (ei === 0 && ai < 2 ? a : { s: a.s, X: a.X, src: "key" })),
  );
  await openAnalysis(page, data);
  await gotoSubTab(page, "impact");
  await page.locator("#anImpact").selectOption("p6");
  await expect(page.getByTestId("analysis-plot").locator("circle.arrowFoot")).toHaveCount(2);
  await expect(page.getByTestId("analysis-impact-pending")).toContainText(
    "グループRMSは計算していません",
  );
  await expect(page.getByTestId("analysis-impact-pending")).toContainText(
    "位置のある 2射（位置なし 70射は図と数値に入れていません）",
  );
  await expect(page.getByTestId("analysis-impact")).toHaveCount(0);
  await expect(page.locator("#main")).not.toContainText("NaN");
});

test("compare: the default pair has the same conditions and the table shows the stored differences", async ({
  page,
}) => {
  const data = richAnalysisDb();
  const errors = await openAnalysis(page, data);
  await gotoSubTab(page, "compare");
  /* B は最新、A は同じ条件で位置のある直前の記録（11/4 は点数だけなので 10/28） */
  await expect(page.locator("#cmpB")).toHaveValue("p6");
  await expect(page.locator("#cmpA")).toHaveValue("p4");
  const a = data.sessions.find((s) => s.id === "p4"),
    b = data.sessions.find((s) => s.id === "p6");
  const table = page.getByTestId("compare-table");
  const row = (key) => table.locator(`[data-row="${key}"]`);
  const cols = (key) => row(key).locator("[data-col]");
  const half = (s, i) => sum(s.ends.slice(i * 6, i * 6 + 6).flat());
  const tens = (s) => s.ends.flat().filter((x) => x.s === 10).length,
    xs = (s) => s.ends.flat().filter((x) => x.X).length;
  await expect(table.locator(".is-head > div")).toHaveText(["", "A 10/28", "B 11/10", "B − A"]);
  await expect(cols("total")).toHaveText([
    String(totalOf(a)),
    String(totalOf(b)),
    signed(totalOf(b) - totalOf(a)),
  ]);
  await expect(cols("first")).toHaveText([
    String(half(a, 0)),
    String(half(b, 0)),
    signed(half(b, 0) - half(a, 0)),
  ]);
  await expect(cols("second")).toHaveText([
    String(half(a, 1)),
    String(half(b, 1)),
    signed(half(b, 1) - half(a, 1)),
  ]);
  await expect(row("count0").locator("div").first()).toHaveText("10+X");
  await expect(cols("count0")).toHaveText([String(tens(a)), String(tens(b)), signed(tens(b) - tens(a))]);
  await expect(row("count1").locator("div").first()).toHaveText("X");
  await expect(cols("count1")).toHaveText([String(xs(a)), String(xs(b)), signed(xs(b) - xs(a))]);
  const sa = await statsOf(page, "p4"),
    sb = await statsOf(page, "p6");
  await expect(cols("rms")).toHaveText([
    sa.rr.toFixed(1),
    sb.rr.toFixed(1),
    signed(diff1(sb.rr, sa.rr), 1),
  ]);
  const oa = Math.hypot(sa.mx, sa.my),
    ob = Math.hypot(sb.mx, sb.my);
  await expect(cols("offset")).toHaveText([oa.toFixed(1), ob.toFixed(1), signed(diff1(ob, oa), 1)]);
  await expect(page.getByTestId("compare-target")).toContainText("70m・122cm的・72射");
  await expect(page.getByTestId("compare-target")).toContainText("弓具は同じ（架空のリカーブ）");
  /* 差の文は数値と、回ごとの標準偏差との大小だけ。原因は書かない */
  const totals = data.sessions.filter((s) => s.dist === 70).map(totalOf);
  const d = totalOf(b) - totalOf(a);
  const s7 =
    Math.sqrt(
      totals.reduce((t, v) => t + (v - totals.reduce((x, y) => x + y, 0) / 7) ** 2, 0) / 6,
    );
  await expect(page.getByTestId("compare-total-diff")).toHaveText(
    `合計の差（B − A）は ${signed(d)} 点です。同じ距離・的・射数の 7回の、回ごとの標準偏差は ${s7.toFixed(1)} 点で、差は${Math.abs(d) <= s7 ? "その範囲内" : "それより大きい値"}です。`,
  );
  await expect(page.getByTestId("compare-caution")).toContainText("差は原因を示すものではありません");
  await expect(page.getByTestId("compare-caution")).toContainText("原因とは断定できません");
  /* 的の図は2枚。それぞれ 72射 */
  await expect(page.getByTestId("compare-plot-a").locator("circle.arrowFoot")).toHaveCount(72);
  await expect(page.getByTestId("compare-plot-b").locator("circle.arrowFoot")).toHaveCount(72);
  /* この間の弓具の変更（11/2）・サイトの記録（10/28）と、両方のメモ */
  const changes = page.getByTestId("compare-changes");
  await expect(changes).toContainText("10/28〜11/10");
  await expect(changes).toContainText("弓具の変更: 架空のリカーブ（プランジャー 中 → やや硬め）");
  await expect(changes).toContainText("サイトの記録: 70m 上下 5.20・左右 0");
  await expect(page.getByTestId("compare-memo-a")).toContainText("架空のメモ。後半に押し手が流れました。");
  await expect(page.getByTestId("compare-memo-b")).toContainText("3エンド目で引き手の肘が下がりました。");
  expect((await stored(page)).sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("compare: different distance, face or arrow count shows a notice and never lines up totals", async ({
  page,
}) => {
  const data = richAnalysisDb();
  const errors = await openAnalysis(page, data);
  await gotoSubTab(page, "compare");
  await page.locator("#cmpA").focus();
  await page.locator("#cmpA").selectOption("i0");
  await expect(page.locator("#cmpA")).toBeFocused();
  const notice = page.getByTestId("compare-notice");
  await expect(notice).toContainText("条件が違うため、合計と差は並べていません");
  await expect(notice).toContainText("A: 18m・40cm的・60射");
  await expect(notice).toContainText("B: 70m・122cm的・72射");
  await expect(page.getByTestId("compare-table")).toHaveCount(0);
  await expect(page.getByTestId("compare-total-diff")).toHaveCount(0);
  await expect(page.getByTestId("compare-plots")).toHaveCount(0);
  const text = await page.locator("#main").innerText();
  expect(text).not.toContain("B − A");
  expect(text).not.toContain("合計の差");
  expect(text).not.toMatch(/[+−]\d/);
  /* それぞれの数値は別々の枠に出す */
  const i0 = data.sessions.find((s) => s.id === "i0"),
    p6 = data.sessions.find((s) => s.id === "p6");
  await expect(page.getByTestId("compare-side-a")).toContainText(`${totalOf(i0)} 点`);
  await expect(page.getByTestId("compare-side-a")).toContainText("10点 / 9点");
  await expect(page.getByTestId("compare-side-b")).toContainText(`${totalOf(p6)} 点`);
  await expect(page.getByTestId("compare-side-b")).toContainText("10+X / X");
  await expect(page.getByTestId("compare-memo-b")).toBeVisible();
  expect(errors).toEqual([]);
});

test("compare: a different round or the same record on both sides is not compared", async ({
  page,
}) => {
  const data = richAnalysisDb();
  data.sessions.find((s) => s.id === "p4").round = "free";
  await openAnalysis(page, data);
  await gotoSubTab(page, "compare");
  /* 既定の A は、ラウンドまで同じ直前の記録（10/21） */
  await expect(page.locator("#cmpA")).toHaveValue("p3");
  await page.locator("#cmpA").selectOption("p4");
  await expect(page.getByTestId("compare-notice")).toContainText("自由練習");
  await expect(page.getByTestId("compare-table")).toHaveCount(0);
  await page.locator("#cmpA").selectOption("p6");
  await expect(page.getByTestId("compare-same")).toContainText("A と B が同じ記録です");
  await expect(page.getByTestId("compare-table")).toHaveCount(0);
});

test("compare: a score-only record keeps the score rows and shows 着弾データなし for the plot", async ({
  page,
}) => {
  const data = richAnalysisDb();
  await openAnalysis(page, data);
  await gotoSubTab(page, "compare");
  await page.locator("#cmpA").selectOption("p5");
  const table = page.getByTestId("compare-table");
  const p5 = data.sessions.find((s) => s.id === "p5"),
    p6 = data.sessions.find((s) => s.id === "p6");
  await expect(table.locator('[data-row="total"] [data-col]')).toHaveText([
    String(totalOf(p5)),
    String(totalOf(p6)),
    signed(totalOf(p6) - totalOf(p5)),
  ]);
  await expect(table.locator('[data-row="rms"] [data-col="a"]')).toHaveText("—");
  await expect(table.locator('[data-row="rms"] [data-col="diff"]')).toHaveText("—");
  await expect(table.locator('[data-row="offset"] [data-col="diff"]')).toHaveText("—");
  await expect(page.getByTestId("compare-plot-a")).toHaveText("着弾データなし");
  await expect(page.getByTestId("compare-plot-a").locator("svg")).toHaveCount(0);
  await expect(page.getByTestId("compare-plot-b").locator("circle.arrowFoot")).toHaveCount(72);
  await expect(page.getByTestId("compare-centers")).toHaveCount(0);
});

test("result and note send the record to the matching analysis tab", async ({ page }) => {
  const data = homeResultDb();
  await openAnalysis(page, data);
  /* ノートの詳細 → 分析で見る: 位置のある記録は 着弾 をその記録で開く */
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator('#histList [data-id="p3"]').click();
  await page.locator("#hAnalysis").click();
  await expect(page.getByTestId("analysis-view")).toHaveAttribute("data-tab", "impact");
  await expect(page.locator("#anImpact")).toHaveValue("p3");
  /* 点数だけの記録は スコア をその条件で開く */
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator('#histList [data-id="i0"]').click();
  await page.locator("#hAnalysis").click();
  await expect(page.locator("#anImpact")).toHaveValue("i0");
  await page.locator('#tabs [data-v="history"]').click();
  await page.locator('#histList [data-id="p5"]').click();
  await page.locator("#hAnalysis").click();
  await expect(page.getByTestId("analysis-view")).toHaveAttribute("data-tab", "score");
  await expect(page.locator("#anCond")).toHaveValue("70|122|single|72");
});
