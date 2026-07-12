"use strict";
/* 「今日の結果」統合パネル純関数（scripts/49-todays-result.js）のテスト。
   設計書 .company/research/topics/todays-result-integration-design.md §6「テストスイート」の
   17必須ケース + firstEver（真の初回/条件初回の区別、strict-review 2026-07-12 major①）を
   網羅する。tools/check-gamification.js / tools/check-analysis-core.js と同じ作法
   （new Function + fs.readFileSync でスクリプト本文をそのまま評価、外部フレームワーク不使用）。
   モックではなく実際の robustStats（20-scoring.js）を使う（§3.2「表示値との一致」の担保）。

   曜日の基準: 2026-07-06 は月曜日（48-gamification.js のテストと同じ暦）。 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scoringScript = fs.readFileSync(path.join(root, "scripts", "20-scoring.js"), "utf8");
const analysisScript = fs.readFileSync(path.join(root, "scripts", "45-analysis-core.js"), "utf8");
const trScript = fs.readFileSync(path.join(root, "scripts", "49-todays-result.js"), "utf8");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}
function assertEqual(actual, expected, label) {
  assert(
    Object.is(actual, expected),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

const tr = new Function(
  `${scoringScript}
${analysisScript}
${trScript}
/* テスト用 metricsFn: 本番の sessionMetrics と同じ契約（{all,total,avg,st}）を、
   実際の robustStats を使って再現する（check-analysis-core.js の section() 抽出パターンではなく
   全文評価だが、robustStats 本体は同一実装を使うため表示値との乖離は生じない） */
function metricsFn(s){
  const all=(s.ends||[]).flat();
  const total=all.reduce((a,x)=>a+(x.s||0),0);
  const pts=all.map(a=>({x:Number(a.x),y:Number(a.y)})).filter(a=>Number.isFinite(a.x)&&Number.isFinite(a.y));
  return {all,total,avg:all.length?total/all.length:0,st:robustStats(pts)};
}
return {computeTodaysResult, computeWeeklyDiff, computeStabilityTrend,
  computePersonalBestDistance, computeGrowthStreaks, metricsFn};`,
)();

/* ---------- フィクスチャ ---------- */

/* n本の矢（score s）。座標なし（stabilityTrend の no-coords 判定に使う） */
function plainEnd(n, s) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ s });
  return out;
}
/* n本の矢を半径 spread(cm) の円周上に均等配置（座標ありの安定したグルーピングを作る） */
function coordEnd(n, s, spread) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    out.push({ s, x: Math.cos(angle) * spread, y: Math.sin(angle) * spread });
  }
  return out;
}
function sess(id, date, o) {
  o = o || {};
  return {
    id,
    date,
    dist: o.dist === undefined ? 70 : o.dist,
    faceD: o.faceD === undefined ? 122 : o.faceD,
    faceType: o.faceType || "single",
    ends: o.ends || [plainEnd(6, 9)],
  };
}

/* ---------- 1. 空db ---------- */
{
  const r = tr.computeTodaysResult([], "x", tr.metricsFn);
  assertEqual(r.available, false, "empty db: top-level available");
  assertEqual(r.reason, "no-current-session", "empty db: reason");
  assertEqual(r.weeklyDiff.available, false, "empty db: weeklyDiff unavailable");
  assertEqual(r.stabilityTrend.available, false, "empty db: stabilityTrend unavailable");
  assertEqual(r.personalBestDistance.available, false, "empty db: personalBestDistance unavailable");
  assertEqual(r.growthStreaks.available, false, "empty db: growthStreaks unavailable");
}

/* ---------- 2. 1セッションのみ（真の初回） ---------- */
{
  const only = sess("s1", "2026-07-10");
  const r = tr.computeTodaysResult([only], "s1", tr.metricsFn);
  assertEqual(r.available, true, "single session: top-level available (current session found)");
  assertEqual(r.weeklyDiff.available, false, "single session: weeklyDiff unavailable (no history)");
  assertEqual(r.stabilityTrend.available, false, "single session: stabilityTrend unavailable (no coords)");
  assertEqual(r.stabilityTrend.reason, "no-coords", "single session: stabilityTrend reason");
  assertEqual(
    r.personalBestDistance.available,
    false,
    "single session: personalBestDistance unavailable (no history)",
  );
  /* growthStreaks はトップレベル available:true（練習日が1日でもあれば）だが、
     MIN_BASELINE(3)+1=4日未満のため各指標は available:false・streakDays:0 に留まる。
     UI側（todaysResultHtml）はこれを「0行」として扱い空db文言にフォールバックする。
     §2 冒頭の要約文「4サブ結果すべてが available:false」は growthStreaks のこの内部構造まで
     厳密に指してはいないが、UI上の見え方（0行フォールバック）は完全に一致する */
  assertEqual(r.growthStreaks.available, true, "single session: growthStreaks top-level stays true (has data)");
  r.growthStreaks.metrics.forEach((m) => {
    assertEqual(m.available, false, `single session: growthStreaks.${m.key} unavailable (insufficient days)`);
    assertEqual(m.streakDays, 0, `single session: growthStreaks.${m.key} streakDays is 0`);
  });
  assertEqual(r.firstEver, true, "single session: firstEver=true (no other valid session)");
}

/* ---------- 3. 2セッション・同条件 ---------- */
{
  const a = sess("a", "2026-07-05", { ends: [plainEnd(6, 8)] });
  const cur = sess("c", "2026-07-10", { ends: [plainEnd(6, 9)] });
  const r = tr.computeTodaysResult([a, cur], "c", tr.metricsFn);
  assertEqual(r.weeklyDiff.available, true, "2 sessions: weeklyDiff available from the 1st peer");
  assertEqual(r.weeklyDiff.kind, "previous", "2 sessions: weeklyDiff kind=previous");
  /* personalBestDistance は「同条件2回目から」available になる（§2 個別箇条書きの記述どおり。
     computePersonalBestDistance は peers が1件でもあれば available:true を返す実装のため、
     weeklyDiff だけが available になるわけではない。§6テスト表の要約とはニュアンスが異なるが、
     アルゴリズム本体（§3.3）と §2 の個別箇条書きに忠実な検証はこちら） */
  assertEqual(r.personalBestDistance.available, true, "2 sessions: personalBestDistance also available (2nd same-condition session)");
  assertEqual(r.stabilityTrend.available, false, "2 sessions: stabilityTrend still unavailable (<3 history)");
  r.growthStreaks.metrics.forEach((m) => {
    assertEqual(m.available, false, `2 sessions: growthStreaks.${m.key} still unavailable (<4 valid days)`);
  });
  assertEqual(r.firstEver, false, "2 sessions: firstEver=false (history exists)");
}

/* ---------- 3b. 条件初回の区別（strict-review major①） ----------
   30mで練習歴のあるユーザーが初めて70mを記録した日: weeklyDiff/personalBest/stability は
   同条件ピア0件で不成立（=UIは0行縮退）だが、firstEver は false でなければならない
   （「初回記録」ではなく「この条件では初記録」と表示するための区別） */
{
  const hist30 = sess("h30", "2026-07-01", { dist: 30, faceD: 80, ends: [plainEnd(6, 8)] });
  const cur70 = sess("c70", "2026-07-10", { dist: 70, faceD: 122, ends: [plainEnd(6, 9)] });
  const r = tr.computeTodaysResult([hist30, cur70], "c70", tr.metricsFn);
  assertEqual(r.firstEver, false, "condition-first: firstEver=false (other-condition history exists)");
  assertEqual(r.weeklyDiff.available, false, "condition-first: weeklyDiff unavailable (no same-condition peer)");
  assertEqual(
    r.personalBestDistance.available,
    false,
    "condition-first: personalBestDistance unavailable (no same-condition peer)",
  );
  /* 空セッション（矢0本）しか他に無い場合は真の初回扱い（「有効セッション」の定義） */
  const emptyOther = sess("e", "2026-07-01", { ends: [[]] });
  const r2 = tr.computeTodaysResult([emptyOther, cur70], "c70", tr.metricsFn);
  assertEqual(r2.firstEver, true, "zero-arrow-only history still counts as firstEver");
}

/* ---------- 4. 10セッション・同条件・単調改善 ---------- */
{
  const days = [];
  for (let i = 0; i < 10; i++) {
    const date = `2026-07-${String(i + 1).padStart(2, "0")}`;
    const scoreVal = 6 + i * 0.4;
    const spread = 3.0 - i * 0.25; // 単調に締まる
    days.push(sess(`d${i}`, date, { ends: [coordEnd(6, Math.round(scoreVal), spread)] }));
  }
  const cur = days[9];
  const r = tr.computeTodaysResult(days, cur.id, tr.metricsFn);
  assertEqual(r.stabilityTrend.available, true, "monotonic improvement: stabilityTrend available");
  assertEqual(r.stabilityTrend.direction, "tight", "monotonic improvement: stabilityTrend direction=tight");
  assert(r.stabilityTrend.deltaCm >= 0.3, "monotonic improvement: deltaCm exceeds the 0.3cm threshold");
  assert(
    r.growthStreaks.metrics.every((m) => m.available && m.streakDays >= 1),
    "monotonic improvement: both growthStreaks metrics have streakDays>=1",
  );
}

/* ---------- 5. 10セッション・横ばい ---------- */
{
  const days = [];
  for (let i = 0; i < 10; i++) {
    const date = `2026-07-${String(i + 1).padStart(2, "0")}`;
    days.push(sess(`f${i}`, date, { ends: [coordEnd(6, 9, 2.0)] }));
  }
  const cur = days[9];
  const r = tr.computeStabilityTrend(days, cur.id, tr.metricsFn, {});
  assertEqual(r.available, true, "flat series: stabilityTrend available");
  assertEqual(r.direction, "flat", "flat series: stabilityTrend direction=flat (delta<0.3cm)");
}

/* ---------- 6. 境界日付: today-7とtoday-14の両方に同条件セッション ---------- */
{
  const d7 = sess("w7", "2026-07-03", { dist: 50, ends: [plainEnd(6, 8)] });
  const d14 = sess("w14", "2026-06-26", { dist: 50, ends: [plainEnd(6, 7)] });
  const cur = sess("c", "2026-07-10", { dist: 50, ends: [plainEnd(6, 9)] });
  const r = tr.computeWeeklyDiff([d7, d14, cur], "c", "2026-07-10");
  /* d7/d14 自体も trSameCondition(matchArrows:true) を満たすため peers に含まれ、
     もっとも新しい d7 が prev として採用される（kind="previous"）。weeklyAvg は参照値として
     常に併記されるため、2件平均であることはこのフィールドで検証する（§3.1 weeklyAvg 契約） */
  assertEqual(r.weeklyAvg.n, 2, "both d7&d14 present: weeklyAvg averages 2 sessions");
  assertEqual(r.weeklyAvg.value, (48 + 42) / 2, "both d7&d14 present: weeklyAvg value is the simple average of totals");
  assertEqual(r.weeklyAvg.dates.join(","), "2026-06-26,2026-07-03", "both d7&d14 present: weeklyAvg dates sorted");
}

/* ---------- 7. 境界日付: today-7のみ存在・today-8は対象外 ---------- */
{
  const d7 = sess("w7", "2026-07-03", { dist: 50, ends: [plainEnd(6, 8)] });
  const d8 = sess("w8", "2026-07-02", { dist: 50, ends: [plainEnd(6, 99)] }); // 対象外の日付（混入させて非影響を確認）
  const cur = sess("c", "2026-07-10", { dist: 50, ends: [plainEnd(6, 9)] });
  const r = tr.computeWeeklyDiff([d7, d8, cur], "c", "2026-07-10");
  assertEqual(r.weeklyAvg.n, 1, "only d7 present: weeklyAvg uses a single session");
  assertEqual(r.weeklyAvg.value, 48, "only d7 present: weeklyAvg value is that single session's total");
  assertEqual(r.weeklyAvg.dates.join(","), "2026-07-03", "only d7 present: today-8 is excluded (no weekday-drift matching)");
}

/* ---------- 8. 複数条件混在（dist違い・faceD違い） ---------- */
{
  const cur = sess("c", "2026-07-10", { dist: 70, faceD: 122, ends: [plainEnd(6, 9)] });
  const sameCond = sess("s", "2026-07-05", { dist: 70, faceD: 122, ends: [plainEnd(6, 8)] });
  const diffDist = sess("dd", "2026-07-06", { dist: 50, faceD: 122, ends: [plainEnd(6, 10)] });
  const diffFace = sess("df", "2026-07-07", { dist: 70, faceD: 80, ends: [plainEnd(6, 10)] });
  const all = [cur, sameCond, diffDist, diffFace];
  const wd = tr.computeWeeklyDiff(all, "c", "2026-07-10");
  assertEqual(wd.compareDate, "2026-07-05", "mixed conditions: only same-condition session used as prev");
  const pb = tr.computePersonalBestDistance(all, "c");
  assertEqual(pb.bestDate, "2026-07-05", "mixed conditions: only same-condition session used for personal best");
}

/* ---------- 9. 本数不一致のみでPBピア → avg-projected ---------- */
{
  const cur = sess("c", "2026-07-10", { ends: [plainEnd(6, 9)] }); // 54点/6本
  const avgPeer = sess("a", "2026-07-01", { ends: [plainEnd(12, 8)] }); // 96点/12本 → 平均8
  const r = tr.computePersonalBestDistance([cur, avgPeer], "c");
  assertEqual(r.method, "avg-projected", "arrow-count mismatch only: method=avg-projected");
  assertEqual(r.bestTotal, 48, "avg-projected: bestTotal = avg(8) * curN(6)");
}

/* ---------- 10. 本数一致ピアあり → exact-count を優先 ---------- */
{
  const cur = sess("c", "2026-07-10", { ends: [plainEnd(6, 9)] });
  const exactPeer = sess("e", "2026-07-05", { ends: [plainEnd(6, 8)] }); // 48点/6本
  const avgPeer = sess("a", "2026-07-01", { ends: [plainEnd(12, 8)] }); // 96点/12本
  const r = tr.computePersonalBestDistance([cur, exactPeer, avgPeer], "c");
  assertEqual(r.method, "exact-count", "exact-count peer present: method=exact-count is preferred");
  assertEqual(r.bestDate, "2026-07-05", "exact-count peer present: bestDate comes from the exact-count peer");
}

/* ---------- 11. 自己ベスト到達（remaining<=0） ---------- */
{
  const cur = sess("c", "2026-07-10", { ends: [plainEnd(6, 10)] }); // 60点
  const peer = sess("p", "2026-07-05", { ends: [plainEnd(6, 9)] }); // 54点
  const r = tr.computePersonalBestDistance([cur, peer], "c");
  assertEqual(r.achieved, true, "exceeded past best: achieved=true");
  assertEqual(r.pace, "reached", "exceeded past best: pace=reached");
  assert(r.remaining <= 0, "exceeded past best: remaining<=0");
}

/* ---------- 12. growthStreaks 途切れ（before>0, after=0） ---------- */
{
  const days = [];
  for (let i = 0; i < 8; i++) {
    const date = `2026-07-${String(i + 1).padStart(2, "0")}`;
    days.push(sess(`g${i}`, date, { ends: [plainEnd(6, 6 + i)] })); // 平均が単調増加
  }
  const today = sess("g8", "2026-07-09", { ends: [plainEnd(6, 3)] }); // 急落
  const before = tr.computeGrowthStreaks(days, days[7].date, tr.metricsFn);
  const after = tr.computeGrowthStreaks([...days, today], today.date, tr.metricsFn);
  const beforeScore = before.metrics.find((m) => m.key === "score");
  const afterScore = after.metrics.find((m) => m.key === "score");
  assert(beforeScore.streakDays > 0, "growth streak break: streak was positive before the drop");
  assertEqual(afterScore.streakDays, 0, "growth streak break: streak resets to 0 after the drop");
}

/* ---------- 13. 座標なしセッション（st.rr が null） ---------- */
{
  const peer1 = sess("p1", "2026-07-01", { ends: [coordEnd(6, 9, 2)] });
  const peer2 = sess("p2", "2026-07-03", { ends: [coordEnd(6, 9, 2)] });
  const peer3 = sess("p3", "2026-07-05", { ends: [coordEnd(6, 9, 2)] });
  const cur = sess("c", "2026-07-10", { ends: [plainEnd(6, 9)] }); // 座標なし
  const r = tr.computeStabilityTrend([peer1, peer2, peer3, cur], "c", tr.metricsFn, {});
  assertEqual(r.available, false, "no-coord current session: stabilityTrend unavailable");
  assertEqual(r.reason, "no-coords", "no-coord current session: reason=no-coords");
}

/* ---------- 14. 未来日付セッション混入 ---------- */
{
  const days = [];
  for (let i = 0; i < 5; i++) {
    const date = `2026-07-${String(i + 1).padStart(2, "0")}`;
    days.push(sess(`u${i}`, date, { ends: [plainEnd(6, 7 + i)] }));
  }
  const future = sess("future", "2026-08-01", { ends: [plainEnd(6, 1)] });
  const without = tr.computeGrowthStreaks(days, "2026-07-05", tr.metricsFn);
  const withFuture = tr.computeGrowthStreaks([...days, future], "2026-07-05", tr.metricsFn);
  assertEqual(
    JSON.stringify(withFuture),
    JSON.stringify(without),
    "future-dated session does not affect growthStreaks computed as of an earlier todayStr",
  );
}

/* ---------- 15. 空セッション（矢0本）混入 ---------- */
{
  const empty = sess("e", "2026-07-04", { ends: [[]] });
  const real = sess("r", "2026-07-03", { ends: [plainEnd(6, 8)] });
  const cur = sess("c", "2026-07-10", { ends: [plainEnd(6, 9)] });
  const wd = tr.computeWeeklyDiff([empty, real, cur], "c", "2026-07-10");
  assertEqual(wd.compareDate, "2026-07-03", "empty session excluded: weeklyDiff prev skips the 0-arrow session");
  const pb = tr.computePersonalBestDistance([empty, real, cur], "c");
  assertEqual(pb.bestDate, "2026-07-03", "empty session excluded: personalBestDistance skips the 0-arrow session");
}

/* ---------- 16. currentSessionId が sessions に存在しない ---------- */
{
  const a = sess("a", "2026-07-05");
  const r = tr.computeTodaysResult([a], "zzz", tr.metricsFn);
  assertEqual(r.available, false, "unknown currentSessionId: top-level available=false (defensive)");
  assertEqual(r.weeklyDiff.available, false, "unknown currentSessionId: weeklyDiff unavailable");
  assertEqual(r.stabilityTrend.available, false, "unknown currentSessionId: stabilityTrend unavailable");
  assertEqual(r.personalBestDistance.available, false, "unknown currentSessionId: personalBestDistance unavailable");
  assertEqual(r.growthStreaks.available, false, "unknown currentSessionId: growthStreaks unavailable");
}

/* ---------- 17. secondary（formAnalyses連携） ---------- */
{
  const peer1 = sess("p1", "2026-07-01", { ends: [coordEnd(6, 9, 2)] });
  const peer2 = sess("p2", "2026-07-03", { ends: [coordEnd(6, 9, 2)] });
  const peer3 = sess("p3", "2026-07-05", { ends: [coordEnd(6, 9, 2)] });
  const cur = sess("c", "2026-07-10", { ends: [coordEnd(6, 9, 1.5)] });
  const sessions = [peer1, peer2, peer3, cur];

  const rNoOpt = tr.computeStabilityTrend(sessions, "c", tr.metricsFn, {});
  assertEqual(rNoOpt.secondary, undefined, "no formAnalyses opt: secondary stays undefined");

  /* 紐付けレコードはあるが直近の比較対象（priorStds）が3件未満 → trAnchorSecondary は null を返す
     （secondary キー自体は opts.formAnalyses が渡された時点で設定されるため undefined ではなく null。
     「secondaryがundefinedのまま」という設計書の文言は opts.formAnalyses 未使用時の挙動と一致する） */
  const formAnalyses = [
    { id: "fa1", sessionId: "c", date: "2026-07-10", features: [{ anchorNorm: 0.1 }, { anchorNorm: 0.12 }] },
  ];
  const rWithOpt = tr.computeStabilityTrend(sessions, "c", tr.metricsFn, { formAnalyses });
  assertEqual(rWithOpt.secondary, null, "linked record with <3 prior comparables: trAnchorSecondary returns null");
}

console.log("Todays-result pure-function checks OK (weeklyDiff / stabilityTrend / personalBest / growthStreaks)");
