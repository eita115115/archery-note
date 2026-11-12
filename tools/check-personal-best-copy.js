"use strict";
/* 今日の結果の文言の検査（UI v5 段 5）。
   - 自己ベストの計算（computePersonalBestDistance）は v111 の基準値と一致したまま
   - 行の文言は「事実 → 対象と条件」。励まし・評価語・感嘆符を含まない
   - 同じ条件の平均との比較（computeConditionComparison）は 3 回以上で出し、
     足りないとき・途中終了のときは比べていないことと理由を書く */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const baseline = JSON.parse(read("docs/codex/evidence/personal-best-v112/baseline-functions.json"));
const core = new Function(
  read("scripts/49-todays-result.js") +
    "\nreturn {computePersonalBestDistance, computeConditionComparison};",
)();
const view = read("scripts/50-record-view.js");
const cut = (from, to) => {
  const a = view.indexOf(from),
    b = view.indexOf(to, a);
  assert(a >= 0 && b > a, `source marker missing: ${from} … ${to}`);
  return view.slice(a, b);
};
const dateHelpers = cut("const WEEKDAY_JA", "function sampleSd(");
const rowsSource = cut(
  "/* 1行の骨格: 事実（.fact）",
  "/* 着弾の数値（グループ RMS と着弾中心のずれ）",
);
const ui = new Function(
  "fmtD",
  "faceLabel",
  "esc",
  "BADGE_DEFS",
  dateHelpers +
    rowsSource +
    "return {todaysResultPersonalBestRowHtml, todaysResultComparisonRowHtml, todaysResultWeeklyRowHtml, todaysResultStabilityRowHtml, todaysResultHtml, summaryGamificationHtml, signedText};",
)(
  (iso) => iso.replace(/-0?/g, "/"),
  (s) => `${s.faceD}cm的`,
  (v) => String(v),
  [{ id: "b1", name: "見本", reason: "検査用の理由" }],
);
/* 使わない語（docs/design/ui-redesign-plan.md 5章: 励まし・評価語・判定ラベル・感嘆符） */
const BANNED = [
  "この調子",
  "がんば",
  "頑張",
  "おつかれ",
  "お疲れ",
  "すばらしい",
  "素晴らし",
  "ナイス",
  "おめでとう",
  "やりました",
  "絶好調",
  "好調",
  "しましょう",
  "始めましょう",
  "伸びが",
  "伸びました",
  "途切れました",
  "ペースは近い",
  "信頼度 高",
  "信頼度 中",
  "信頼度 低",
  "更新</b>",
  "あと",
  "!",
  "！",
];
const noBanned = (html, label) => {
  const text = html.replace(/<[^>]*>/g, "");
  for (const w of BANNED)
    assert(!(w === "更新</b>" ? html : text).includes(w), `${label}: banned phrase "${w}" in ${text}`);
  assert(!/NaN|undefined|null/.test(text), `${label}: broken value in ${text}`);
};
let checks = 0;
for (const fixture of baseline.rows) {
  const before = JSON.stringify(fixture.sessions);
  const result = core.computePersonalBestDistance(fixture.sessions, fixture.current.id);
  assert.deepEqual(result, fixture.pb, "PB computation unchanged");
  const word = fixture.dayLabel === "今日" ? "今回" : "この回";
  const html = ui.todaysResultPersonalBestRowHtml(result, fixture.current, word);
  noBanned(html, `pb ${fixture.n} ${fixture.relation}`);
  assert(html.includes('data-testid="todays-result-personal-best"'));
  assert(html.includes('class="fact"') && html.includes('class="basis"'), "fact and basis");
  assert(html.includes(`${result.bestTotal} 点`), "the best total is stated");
  assert(html.includes("10/2"), "the date of the best is stated");
  if (result.method === "exact-count") {
    assert(html.includes("この距離・的・射数"), "exact count: condition named");
    assert(html.includes("対象: 18m・40cm的・"), "exact count: basis names the condition");
    if (fixture.relation === "above") assert(html.includes("<b>最高です</b>（これまで"));
    if (fixture.relation === "tie") assert(html.includes("と同じです"));
    if (fixture.relation === "below") assert(html.includes(`${word}との差は −12 点です`));
  } else {
    assert(html.includes(`${result.todayArrows}射に換算すると`), "projection: says converted");
    assert(html.includes("換算値（推定）"), "projection: says estimate");
    assert(html.includes("実際の合計の最高ではありません"), "projection is not a record total");
    assert(!html.includes("最高です</b>"), "projection never claims a new best");
    if (fixture.relation === "above") assert(html.includes("1 点高い値です"));
    if (fixture.relation === "tie") assert(html.includes(`${word}と同じです`));
    if (fixture.relation === "below") assert(html.includes(`${word}との差は −2 点です`));
  }
  assert.equal(JSON.stringify(fixture.sessions), before, "non-mutating calculation/render");
  checks++;
}
/* 同じ条件の平均との比較 */
const sess = (id, date, scores, extra) =>
  Object.assign(
    { id, date, dist: 70, faceD: 122, faceType: "single", ends: [scores.map((s) => ({ s }))] },
    extra || {},
  );
const cur = sess("cur", "2026-11-10", [10, 9, 9, 8, 8, 7]); // 51
const peers = [
  sess("a", "2026-10-03", [9, 9, 8, 8, 7, 7]), // 48
  sess("b", "2026-10-10", [10, 10, 9, 9, 8, 8]), // 54
  sess("c", "2026-11-04", [9, 9, 9, 8, 8, 7]), // 50
];
const other = sess("o", "2026-10-20", [10, 10, 10, 10, 10, 10], { dist: 50 });
const shortPeer = sess("s", "2026-10-21", [10, 10, 10]);
{
  const all = [...peers, other, shortPeer, cur];
  const before = JSON.stringify(all);
  const c = core.computeConditionComparison(all, "cur", null);
  assert.equal(c.available, true);
  assert.equal(c.sampleCount, 3, "other distance and other arrow count are not peers");
  assert(Math.abs(c.mean - 152 / 3) < 1e-9);
  const m = 152 / 3;
  const sd = Math.sqrt(((48 - m) ** 2 + (54 - m) ** 2 + (50 - m) ** 2) / 2);
  assert(Math.abs(c.sd - sd) < 1e-9, "sample SD (n-1)");
  assert(Math.abs(c.diff - (51 - m)) < 1e-9);
  assert.equal(c.withinSd, true);
  assert.equal(c.firstDate, "2026-10-03");
  assert.equal(c.lastDate, "2026-11-04");
  const html = ui.todaysResultComparisonRowHtml(c, cur, "今回");
  noBanned(html, "comparison");
  assert(html.includes("同じ条件の過去3回の平均 50.7 点との差は <b>+0.3 点</b>です。"));
  assert(html.includes("対象: 10/3〜11/4、70m・122cm的・6射。"));
  assert(html.includes("過去の回ごとの標準偏差は 3.1 点で、今回の差はその範囲内です。"));
  const far = core.computeConditionComparison(
    [...peers, sess("cur", "2026-11-10", [10, 10, 10, 10, 10, 10])],
    "cur",
    null,
  );
  assert.equal(far.withinSd, false);
  assert(ui.todaysResultComparisonRowHtml(far, cur, "今回").includes("それより大きい値です"));
  assert.equal(JSON.stringify(all), before, "comparison does not mutate");
  checks += 2;
}
{
  const c = core.computeConditionComparison([...peers.slice(0, 2), cur], "cur", null);
  assert.deepEqual(
    { a: c.available, r: c.reason, n: c.sampleCount, min: c.minSessions },
    { a: false, r: "insufficient-history", n: 2, min: 3 },
  );
  const html = ui.todaysResultComparisonRowHtml(c, cur, "今回");
  noBanned(html, "insufficient");
  assert(html.includes("同じ条件の過去の記録が2回のため、平均との比較は表示していません。"));
  assert(html.includes("3回以上あるときに"));
  const none = core.computeConditionComparison([cur], "cur", null);
  assert(
    ui
      .todaysResultComparisonRowHtml(none, cur, "今回")
      .includes("同じ条件の過去の記録がないため"),
  );
  const partial = core.computeConditionComparison([...peers, cur], "cur", 72);
  assert.deepEqual(
    { a: partial.available, r: partial.reason, q: partial.quota, n: partial.todayArrows },
    { a: false, r: "partial", q: 72, n: 6 },
  );
  const ph = ui.todaysResultComparisonRowHtml(partial, cur, "今回");
  noBanned(ph, "partial");
  assert(ph.includes("6射で終了した記録です。射数が違うため、過去の 72射の合計とは比べていません。"));
  checks += 3;
}
/* ほかの行と、行をまとめる側 */
{
  const wd = { available: true, compareDate: "2026-11-04", compareValue: 50, deltaPoints: 1 };
  const st = { available: true, latestValue: 9.12, baselineValue: 9.44, sampleCount: 7 };
  const pb = core.computePersonalBestDistance([...peers, cur], "cur");
  const cmp = core.computeConditionComparison([...peers, cur], "cur", null);
  const result = {
    available: true,
    firstEver: false,
    weeklyDiff: wd,
    stabilityTrend: st,
    personalBestDistance: pb,
    growthStreaks: {
      available: true,
      metrics: [{ key: "score", available: true, streakDays: 3 }],
    },
  };
  const html = ui.todaysResultHtml(result, cur, { comparison: cmp });
  noBanned(html, "panel");
  assert(html.includes("同じ条件の前回（11/4）は 50 点で、今回との差は <b>+1 点</b>です。"));
  assert(html.includes("今回のグループ RMS は 9.1cm です。同じ距離・的の直近5回の平均は 9.4cm で、差は −0.3cm です。"));
  assert(html.includes("この距離・的・射数の最高は 54 点、10/10 で、今回との差は −3 点です。"));
  assert(!html.includes("todays-result-streak"), "growth streak rows are not rendered");
  const order = ["todays-result-comparison", "todays-result-weekly", "todays-result-personal-best", "todays-result-stability"].map((k) => html.indexOf(k));
  assert(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), "row order");
  const retro = ui.todaysResultHtml(result, cur, { comparison: cmp, dayLabel: "この日" });
  noBanned(retro, "retro");
  assert(retro.includes("この回との差は") && !retro.includes("今回"));
  const empty = { available: true, firstEver: true, weeklyDiff: {}, stabilityTrend: {}, personalBestDistance: {} };
  const first = ui.todaysResultHtml(empty, cur, { comparison: core.computeConditionComparison([cur], "cur", null) });
  noBanned(first, "first");
  assert(first.includes('data-testid="todays-result-empty"'));
  assert(first.includes("最初の記録です。比べる過去の記録はありません。"));
  const firstCond = ui.todaysResultHtml(Object.assign({}, empty, { firstEver: false }), cur, {
    comparison: core.computeConditionComparison([other, cur], "cur", null),
  });
  noBanned(firstCond, "first of condition");
  assert(firstCond.includes("この条件（70m・122cm的・6射）では最初の記録です。"));
  const pending = ui.todaysResultHtml(
    Object.assign({}, empty, { stabilityTrend: { reason: "insufficient-arrows", coordinateCount: 2 } }),
    cur,
    {},
  );
  noBanned(pending, "pending");
  assert(pending.includes("位置のある矢が2射のため、グループ RMS は比べていません。"));
  assert.equal(ui.signedText(0, 1), "±0");
  assert.equal(ui.signedText(-0.04, 1), "±0");
  assert.equal(ui.signedText(-5.66, 1), "−5.7");
  const gam = ui.summaryGamificationHtml({
    streakBefore: { current: 2, lastPracticeDate: "2026-11-07" },
    streakAfter: { configured: true, current: 3, freezeUsedDates: ["2026-11-08"] },
    newBadges: [{ id: "b1" }],
  });
  noBanned(gam, "gamification");
  assert(gam.includes('連続記録は <b data-testid="summary-streak-num">3</b> 日です（この記録の前は 2 日）。フリーズを1個使いました。'));
  assert(gam.includes("この記録で条件を満たしたバッジ: 「見本」（検査用の理由）"));
  const unset = ui.summaryGamificationHtml({ streakBefore: {}, streakAfter: { configured: false }, newBadges: [] });
  noBanned(unset, "gamification unset");
  assert(unset.includes("練習曜日が未設定のため、連続記録は数えていません。"));
  checks += 8;
}
/* 画面の文言そのもの（記録タブの待機画面・記録の条件・今日の結果）にも使わない語が無いこと */
{
  const screens = cut("/* ---------- 記録タブの待機画面", "function sessionArrows(") +
    cut("/* ---------- 今日の結果（全画面", "/* ---------- 履歴 ---------- */");
  const strings = screens.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\$\{[^}]*\}/g, "");
  for (const w of BANNED.filter((x) => !["!", "あと", "更新</b>"].includes(x)))
    assert(!strings.includes(w), `screen copy contains banned phrase "${w}"`);
  assert(!/[A-Za-z]{4,}\s+[A-Z][a-z]+<\/h[1-3]>/.test(strings), "no English decorative headings");
  checks++;
}
console.log(
  `Result copy checks OK (${checks} cases; PB computation preserved; fact → basis rows; ${BANNED.length} banned phrases absent)`,
);
