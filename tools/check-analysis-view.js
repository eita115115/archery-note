"use strict";
/* 分析タブ（UI v5 段 7: スコア / 着弾 / 比較 / 射型）の文言と表示用の集計の検査。
   - 画面の HTML を見本データから実際に組み立て、使わない語（励まし・評価語・判定ラベル・感嘆符）と
     壊れた値（NaN・undefined・null）が無いことを確かめる
   - 対象（条件・回数・射数・期間）が文に入っていること
   - 傾向の文は同じ条件が 5回以上のときだけ。数値と差だけ
   - グループRMS は全射（A）。外れ値候補を除いた値（B）とロバスト推定（C）は「比較用の指標」の中だけ
   - 条件の違う2回は、合計も差も並べない
   統計そのものの検査は tools/check-grouping-stats.js と tools/check-analysis-core.js。 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const { homeResultDb } = require("../tests/e2e/fixtures/home-result-db.js");
const view = read("scripts/50-record-view.js");
const hist = read("scripts/60-history-sight-view.js");
const cutFrom = (src, from, to) => {
  const a = src.indexOf(from),
    b = src.indexOf(to, a + from.length);
  assert(a >= 0 && b > a, `source marker missing: ${from} … ${to}`);
  return src.slice(a, b);
};
const cut = (from, to) => cutFrom(view, from, to);
const TODAY = "2026-11-12";
const source = `
let DB_REV = 0;
const window = { innerWidth: 375 };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = () => "";
const today = () => "${TODAY}";
const fmtD = (iso) => { if (!iso || typeof iso !== "string" || !/^\\d{4}-\\d{2}-\\d{2}/.test(iso)) return ""; const [y, m, d] = iso.split("-"); return \`\${+y}/\${+m}/\${+d}\`; };
const faceLabel = (s) => (s.faceType === "triple" ? "40cm三つ目" : s.faceType === "field" ? \`\${+s.faceD || 0}cmフィールド\` : \`\${+s.faceD || 0}cm的\`);
const perfectScoreValue = (s) => (s && s.faceType === "field" ? 6 : 10);
const ROUND_TYPES = [{ id: "free", label: "自由練習" }, { id: "70m72", label: "70m 72射", arrows: 72 }, { id: "18m60", label: "18m 60射", arrows: 60 }];
const roundLabel = (id) => (ROUND_TYPES.find((r) => r.id === (id || "free")) || ROUND_TYPES[0]).label;
const sessionStageDef = () => null;
const sumScores = (arr) => arr.reduce((n, a) => n + (+a.s || 0), 0);
const formTrackingEnabled = () => false;
const formTrackingCard = () => "";
${read("scripts/20-scoring.js")}
${read("scripts/40-analysis-physics.js")}
${read("scripts/45-analysis-core.js")}
${read("scripts/49-todays-result.js")}
${cut("const WEEKDAY_JA", "function roundQuota(")}
${cut("/* 前半 / 後半の合計。", "/* 数値の組: 前半 / 後半")}
${cut("/* 合計点の推移（折れ線）。", "const HOME_TREND_MAX")}
${cut("/* ============ 分析（v5 段 7）", "/* 選択を変えて描き直した後")}
${cut("/* 撮影日で期間を", "/* ============ スコア表")}
${cut("function isIndoorShortFace(", "/* 矢の列の並べ方")}
${cut("/* 差の表記", "/* 文中の日付")}
${cut("function distanceLabel(", "function historyAnalysisDetailsHtml(")}
${cut("function sightValueText(", "function sightSummaryHtml(")}
${cutFrom(hist, "function noteDateOk(", "function noteSortTs(")}
${cutFrom(hist, "function noteDayChanges(", "function noteDayCellHtml(")}
${cutFrom(hist, "function historyDistanceLabel(", "function scoreDistCard(")}
${cutFrom(hist, "function scoreDistCard(", "/* 多距離ラウンド（IMP-09）")}
return {
  setDb: (d) => { db = d; DB_REV++; },
  ui,
  robustStats, sessionMetrics, buildAnalysisRows, trSameCondition,
  analysisScoreModel, analysisImpactModel, analysisEndRms, anComparable, anDiff1, anCondKey, anCondLabel,
  analysisSessionList, analysisScoreHtml, analysisImpactHtml, analysisCompareHtml, analysisFormHtml,
  ANALYSIS_TREND_MIN, ANALYSIS_TREND_RECENT, ANALYSIS_PERIODS,
};`;
const app = new Function(
  "db",
  "ui",
  source,
)(null, {
  analysisFilter: { setupId: "", dist: "", round: "", period: "all", cond: "" },
  analysisTab: "score",
  analysisImpactId: null,
  analysisCmp: { a: null, b: null },
});

/* 使わない語（docs/design/ui-redesign-plan.md 5章。tests/e2e/analysis-helpers.js と同じ並び） */
const BANNED = [
  "この調子",
  "信頼度",
  "しましょう",
  "頑張",
  "がんば",
  "おつかれ",
  "お疲れ",
  "ナイス",
  "おめでとう",
  "すばらしい",
  "素晴らし",
  "絶好調",
  "好調",
  "上向き",
  "下がり気味",
  "次回試す",
  "比較待ち",
  "!",
  "！",
];
const textOf = (html) =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<option[^>]*>/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
let checks = 0;
const clean = (html, label) => {
  const text = textOf(html);
  for (const w of BANNED) assert(!text.includes(w), `${label}: banned phrase "${w}" in: ${text}`);
  assert(!/NaN|undefined|Infinity|\bnull\b/.test(html), `${label}: broken value`);
  assert(!/[A-Z]{4,}/.test(text), `${label}: decorative English heading`);
  checks++;
  return text;
};
const resetUi = () => {
  Object.assign(app.ui.analysisFilter, { setupId: "", dist: "", round: "", period: "all", cond: "" });
  app.ui.analysisImpactId = null;
  app.ui.analysisCmp = { a: null, b: null };
};
const load = (mutate) => {
  const d = homeResultDb();
  d.formAnalyses = [];
  if (mutate) mutate(d);
  app.setDb(d);
  resetUi();
  return d;
};
const rowsOf = (d) => app.buildAnalysisRows(d.sessions, d.setups, app.sessionMetrics);
const total = (s) => s.ends.flat().reduce((n, a) => n + a.s, 0);
const mean = (v) => v.reduce((t, x) => t + x, 0) / v.length;
const byDate = (list) => [...list].sort((a, b) => a.date.localeCompare(b.date));

/* ---------- 集計（表示用の純関数） ---------- */
{
  const d = load();
  const outdoor = byDate(d.sessions.filter((s) => s.dist === 70));
  const totals = outdoor.map(total);
  const m = app.analysisScoreModel(outdoor);
  assert.equal(m.n, 7);
  assert.equal(m.arrows, 504);
  assert.equal(m.mean, mean(totals));
  assert.equal(m.latest.total, totals[6]);
  assert.equal(m.latest.date, "2026-11-10");
  assert.equal(m.best.total, Math.max(...totals));
  assert.equal(m.firstDate, "2026-10-03");
  assert.equal(m.scoreOnly, 1);
  /* 傾向: 直近3回とそれより前。差は表示した小数1桁どうしの差 */
  assert.equal(m.trend.recentN, app.ANALYSIS_TREND_RECENT);
  assert.equal(m.trend.earlierN, 4);
  assert.equal(m.trend.recentMean, mean(totals.slice(-3)));
  assert.equal(m.trend.earlierMean, mean(totals.slice(0, 4)));
  assert.equal(
    m.trend.diff,
    +(+mean(totals.slice(-3)).toFixed(1) - +mean(totals.slice(0, 4)).toFixed(1)).toFixed(1),
  );
  assert.equal(m.halves.n, 7);
  assert.equal(m.halves.blockArrows, 36);
  assert.equal(m.ends.avg.length, 12);
  assert.equal(m.ends.n, 7);
  /* 4回以下は傾向を持たない。5回から持つ */
  for (let n = 1; n <= 7; n++)
    assert.equal(
      !!app.analysisScoreModel(outdoor.slice(0, n)).trend,
      n >= app.ANALYSIS_TREND_MIN,
      `trend at n=${n}`,
    );
  assert.equal(app.ANALYSIS_TREND_MIN, 5);
  assert.equal(app.analysisScoreModel([]), null);
  assert.equal(app.analysisScoreModel(outdoor.slice(0, 1)).sd, null);
  assert.equal(app.anDiff1(622.14, 620.04), 2.1);
  assert.equal(app.anDiff1(1.25, 1.25), 0);
  /* 保存された点数は読むだけ */
  assert.deepEqual(d.sessions, homeResultDb().sessions);
  checks += 20;
}
{
  /* 比べてよい組: 距離・的・射数・ラウンドがすべて同じ */
  const d = load();
  const by = (id) => d.sessions.find((s) => s.id === id);
  const p4 = by("p4"),
    p6 = by("p6");
  assert.equal(app.anComparable(p4, p6), true);
  assert.equal(app.anComparable(p4, by("p5")), true); // 点数だけの記録も、条件が同じなら合計は比べられる
  assert.equal(app.anComparable(p6, by("i0")), false);
  assert.equal(app.anComparable({ ...p4, dist: 50 }, p6), false);
  assert.equal(app.anComparable({ ...p4, faceD: 80 }, p6), false);
  assert.equal(app.anComparable({ ...p4, faceType: "field" }, p6), false);
  assert.equal(app.anComparable({ ...p4, round: "free" }, p6), false);
  assert.equal(app.anComparable({ ...p4, ends: p4.ends.slice(0, 11) }, p6), false);
  assert.equal(app.anComparable(null, p6), false);
  checks += 9;
}
{
  /* 着弾の数値は全射（A）。B と C は別の項目に持つ */
  const d = load((x) => Object.assign(x.sessions.find((s) => s.id === "p6").ends[0][0], { x: 55, y: -50 }));
  const p6 = d.sessions.find((s) => s.id === "p6");
  const pts = p6.ends.flat().map((a) => ({ x: a.x, y: a.y }));
  const st = app.robustStats(pts);
  const im = app.analysisImpactModel(p6);
  assert.equal(im.ok, true);
  assert.equal(im.positioned, 72);
  assert.equal(im.rms, st.rr);
  assert.deepEqual(im.ci, st.rrCi);
  assert.equal(im.offset, Math.hypot(st.mx, st.my));
  assert.equal(im.sx, st.sx);
  assert.equal(im.sy, st.sy);
  assert(st.excluded.length > 0, "the fixture has an outlier candidate");
  assert.equal(im.flagged, st.excluded.length);
  assert.equal(im.rmsB, st.excl.rr);
  assert.equal(im.rmsC, st.robust.rr);
  assert(im.rmsB < im.rms, "B is smaller than A, which is why it is not the official value");
  const p5 = d.sessions.find((s) => s.id === "p5");
  const none = app.analysisImpactModel(p5);
  assert.equal(none.ok, false);
  assert.equal(none.positioned, 0);
  assert.equal(none.arrows, 72);
  assert.equal(none.rms, undefined);
  const endRms = app.analysisEndRms(p6);
  assert.equal(endRms.length, 12);
  assert(endRms.every((v) => Number.isFinite(v)));
  assert(app.analysisEndRms(p5).every((v) => v === null));
  checks += 18;
}

/* ---------- スコア ---------- */
{
  const d = load();
  const html = app.analysisScoreHtml(rowsOf(d), app.ui.analysisFilter);
  const text = clean(html, "score");
  assert(
    text.includes("対象: 70m・122cm的・72射、7回・504射、10/3〜11/10。うち1回は点数だけの記録です。"),
    "score target line",
  );
  assert(/直近3回の平均は [\d.]+ 点、それより前の4回の平均は [\d.]+ 点で、差は [+−±][\d.]* 点です。/.test(text), "trend sentence states numbers only");
  assert(!html.includes("analysis-trend-pending"));
  assert(html.includes('id="anCond"') && html.includes('id="anSetup"') && html.includes('id="anPeriod"'));
  /* 軸の文字は 13px（.ax）か font-size="13"。それより小さい指定を置かない */
  for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g))
    assert(+m[1] >= 13, `chart text ${m[1]}px`);
  /* 4回: 傾向の文は出さず、回数を書く */
  const d4 = load((x) => (x.sessions = x.sessions.filter((s) => !["p0", "p1", "p2"].includes(s.id))));
  const html4 = app.analysisScoreHtml(rowsOf(d4), app.ui.analysisFilter);
  const text4 = clean(html4, "score with four sessions");
  assert(!html4.includes('data-testid="analysis-trend"'), "no trend sentence below five sessions");
  assert(text4.includes("5回以上あるときに") && text4.includes("いまは 4回"));
  assert(text4.includes("4回・288射"));
  /* 期間と弓具で絞る */
  const dp = load();
  Object.assign(app.ui.analysisFilter, { period: "30d", setupId: "s1" });
  const textP = clean(app.analysisScoreHtml(rowsOf(dp), app.ui.analysisFilter), "score filtered");
  assert(textP.includes("5回・360射、10/14〜11/10、弓具は 架空のリカーブ、期間は直近30日。"), textP.slice(0, 200));
  /* 合う記録が無い */
  Object.assign(app.ui.analysisFilter, { period: "all", setupId: "s2", cond: "70|122|single|72" });
  const textN = clean(app.analysisScoreHtml(rowsOf(dp), app.ui.analysisFilter), "score none");
  assert(textN.includes("この条件の記録はありません") && textN.includes("0回"));
  /* 1回だけ */
  const d1 = load((x) => (x.sessions = [x.sessions[0]]));
  const text1 = clean(app.analysisScoreHtml(rowsOf(d1), app.ui.analysisFilter), "score single");
  assert(text1.includes("1回・72射、10/3。"));
  assert(!text1.includes("標準偏差は"), "no spread with one session");
  /* 記録なし */
  const d0 = load((x) => (x.sessions = []));
  clean(app.analysisScoreHtml(rowsOf(d0), app.ui.analysisFilter), "score empty");
  checks += 12;
}

/* ---------- 着弾 ---------- */
{
  load((x) => Object.assign(x.sessions.find((s) => s.id === "p6").ends[0][0], { x: 55, y: -50 }));
  const r = app.analysisImpactHtml();
  assert.equal(r.sess.id, "p6", "default is the latest record with positions");
  const text = clean(r.html, "impact");
  assert(text.includes("グループRMS（全射）") && text.includes("着弾中心のずれ"));
  assert(text.includes("左右のばらつき") && text.includes("上下のばらつき"));
  assert(text.includes("対象: 11/10（火）・70m・122cm的、位置のある 72射。"));
  assert(text.includes("95%区間"));
  /* B と C は「比較用の指標」の中だけ。既定では閉じている */
  const a = r.html.indexOf('<details class="anRef"'),
    b = r.html.indexOf("</details>", a);
  assert(a >= 0 && b > a, "reference metrics details");
  assert(!/<details class="anRef"[^>]*\sopen/.test(r.html), "collapsed by default");
  const outside = r.html.slice(0, a) + r.html.slice(b);
  for (const w of ["ロバストRMS", "外れ値候補を除いたRMS", 'data-ref="'])
    assert(!outside.includes(w), `"${w}" outside the reference metrics`);
  const inside = r.html.slice(a, b);
  assert(inside.includes('data-ref="b"') && inside.includes('data-ref="c"'));
  assert(inside.includes("正式な値は上の全射の RMS です"));
  /* 点数だけの記録 */
  app.ui.analysisImpactId = "p5";
  const n = app.analysisImpactHtml();
  assert.equal(n.sess, null, "no plot for a score-only record");
  const textN = clean(n.html, "impact without positions");
  assert(textN.includes("着弾データなし"));
  assert(textN.includes("72射のうち、位置のある矢は 0射"));
  assert(!n.html.includes('data-fig="rms"') && !n.html.includes("anRef"));
  /* 位置のある矢が 2射 */
  load((x) => {
    const p6 = x.sessions.find((s) => s.id === "p6");
    p6.ends = p6.ends.map((e, ei) => e.map((s, ai) => (ei === 0 && ai < 2 ? s : { s: s.s, X: s.X })));
  });
  app.ui.analysisImpactId = "p6";
  const two = app.analysisImpactHtml();
  const text2 = clean(two.html, "impact pending");
  assert(text2.includes("グループRMSは計算していません"));
  assert(text2.includes("位置のある 2射（位置なし 70射は図と数値に入れていません）"));
  assert(!two.html.includes('data-fig="rms"'));
  /* すべて点数だけ */
  load((x) => x.sessions.forEach((s) => (s.ends = s.ends.map((e) => e.map((q) => ({ s: q.s, X: q.X }))))));
  const all = app.analysisImpactHtml();
  assert(clean(all.html, "impact all score-only").includes("着弾データなし"));
  assert(!all.html.includes("analysis-grouping-trend"));
  checks += 16;
}

/* ---------- 比較 ---------- */
{
  const d = load();
  const r = app.analysisCompareHtml();
  assert.deepEqual(r.plots.map((p) => p[1].id), ["p4", "p6"], "default pair: same conditions, both with positions");
  const text = clean(r.html, "compare");
  const p4 = d.sessions.find((s) => s.id === "p4"),
    p6 = d.sessions.find((s) => s.id === "p6");
  const diff = total(p6) - total(p4);
  assert(r.html.includes('data-testid="compare-table"'));
  assert(text.includes(`合計の差（B − A）は ${diff === 0 ? "±0" : (diff > 0 ? "+" : "−") + Math.abs(diff)} 点です。`));
  assert(text.includes("差は原因を示すものではありません") && text.includes("原因とは断定できません"));
  assert(text.includes("対象: 70m・122cm的・72射"));
  /* 条件が違う2回 */
  app.ui.analysisCmp = { a: "i0", b: "p6" };
  const x = app.analysisCompareHtml();
  const textX = clean(x.html, "compare with different conditions");
  assert.deepEqual(x.plots, []);
  assert(textX.includes("条件が違うため、合計と差は並べていません"));
  assert(!x.html.includes("compare-table") && !x.html.includes("compare-total-diff"));
  assert(!textX.includes("B − A") && !textX.includes("合計の差"));
  assert(!/[+−]\d/.test(textX), "no signed difference between different conditions");
  assert(textX.includes(`${total(d.sessions.find((s) => s.id === "i0"))} 点`), "each side keeps its own total");
  /* 同じ記録 */
  app.ui.analysisCmp = { a: "p6", b: "p6" };
  assert(clean(app.analysisCompareHtml().html, "compare same").includes("A と B が同じ記録です"));
  /* 点数だけの記録との比較: 合計は並べ、RMS は「—」 */
  app.ui.analysisCmp = { a: "p5", b: "p6" };
  const s = app.analysisCompareHtml();
  clean(s.html, "compare with a score-only record");
  assert(/data-row="rms"><div>グループRMS cm<\/div><div data-col="a">—<\/div>/.test(s.html));
  /* 1回だけ・0回 */
  load((q) => (q.sessions = [q.sessions[0]]));
  assert(clean(app.analysisCompareHtml().html, "compare one").includes("比べるには記録が2回必要です"));
  load((q) => (q.sessions = []));
  clean(app.analysisCompareHtml().html, "compare empty");
  checks += 14;
}

/* ---------- 射型（射型の記録が切のとき）と外れた理由の印 ---------- */
{
  const d = load((x) => {
    const reasons = ["リリース", "リリース", "押し手", "風", "リリース", "押し手"];
    x.sessions[6].ends[2].forEach((a, i) => (a.reason = reasons[i]));
  });
  const text = clean(app.analysisFormHtml(rowsOf(d), app.ui.analysisFilter), "form");
  assert(text.includes("外れた理由の印"));
  assert(text.includes("対象: 9回・624射のうち、理由の印がある 6射。"));
  assert(text.includes("印の数は原因を示すものではありません"));
  const d0 = load();
  const text0 = clean(app.analysisFormHtml(rowsOf(d0), app.ui.analysisFilter), "form no marks");
  assert(text0.includes("理由の印がある 0射"));
  const dE = load((x) => (x.sessions = []));
  clean(app.analysisFormHtml(rowsOf(dE), app.ui.analysisFilter), "form empty");
  checks += 4;
}

/* ---------- 廃止した文と部品が、画面のソースに残っていない ---------- */
{
  const analysisSource = cut("/* ============ 分析（v5 段 7）", "/* 撮影日で期間を");
  for (const w of [
    "growthDashboardHtml",
    "nextPracticeCardHtml",
    "todayConclusionCardHtml",
    "analysisKpiHtml",
    "次回試すこと",
    "比較待ち",
    "today-conclusion",
    "growth-dashboard",
  ])
    assert(!view.includes(w), `removed analysis part "${w}" is still in 50-record-view.js`);
  const literals = analysisSource.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const w of BANNED.filter((x) => x !== "!"))
    assert(!literals.includes(w), `banned phrase "${w}" in the analysis view source`);
  checks += 2;
}
console.log(`Analysis view copy and view-model checks OK (${checks} checks)`);
