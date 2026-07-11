"use strict";
/* ゲーミフィケーション純関数（scripts/48-gamification.js）のテスト。
   最終設計書 gamification-final-design.md の「テストスイート（必須追加ケース）」を網羅する:
   - 当日未練習で欠席判定しない / 同日再呼出しの冪等 / 非練習曜日の練習が加算される
   - practiceDays=null で configured:false / 過去日付セッション追加が反映される / 未来日付無視
   - 移行ユーザーの best 遡及 / フリーズ導出の決定性
   - pb_breaker 本数不一致で不発 / tight_group 的サイズ相対 / streak_7 が ctx.streak 経由
   - 12バッジそれぞれの正例・負例 / calcGoalProgress 範囲内外・空セッション除外
   曜日の基準: 2026-07-06 は月曜日。 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "scripts", "48-gamification.js"), "utf8");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function assertEqual(actual, expected, label) {
  assert(
    Object.is(actual, expected),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function assertDeepEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  assert(a === b, `${label}: expected ${b}, got ${a}`);
}

const gam = new Function(
  `${script}
return {computeStreak, checkBadges, backfillBadges, calcGoalProgress, goalRingOffset,
        BADGE_DEFS, gamFmtDate, gamAllArrows, gamTotalShots, gamPerfect, gamRingW, gamGroupRms, gamIsoWeek};`,
)();

/* ---------- フィクスチャ ---------- */

/* n本の矢（score s）。withXY=false で座標なし（tight_group 判定に入らない） */
function end(n, s, withXY) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = { s };
    if (withXY !== false) { a.x = 0.1 * i; a.y = 0; }
    out.push(a);
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
    round: o.round || "free",
    wx: o.wx || "",
    ends: o.ends || [end(6, 9)],
  };
}

/* ---------- computeStreak ---------- */

// 当日未練習で欠席判定しない: 金曜(練習曜日)の朝、まだ練習していなくてもリセットしない
{
  const ss = [sess("a", "2026-07-06"), sess("b", "2026-07-08")]; // 月・水
  const st = gam.computeStreak(ss, [1, 3, 5], "2026-07-10"); // 金曜
  assertEqual(st.configured, true, "streak configured");
  assertEqual(st.current, 2, "today (practice day, not yet practiced) must not reset current");
  assertEqual(st.best, 2, "best after two practice days");
  assertEqual(st.freezeTokens, 0, "no freeze earned yet");
  assertEqual(st.freezeUsedDates.length, 0, "no freeze consumed for today");
  assertEqual(st.lastPracticeDate, "2026-07-08", "lastPracticeDate");

  // 日付が過ぎれば（翌日 todayStr=土曜）、金曜の欠席が確定してリセットされる
  const next = gam.computeStreak(ss, [1, 3, 5], "2026-07-11");
  assertEqual(next.current, 0, "missed Friday resets current once the day has passed");
  assertEqual(next.best, 2, "best survives the reset");
}

// 同日再呼出しの冪等性: 同一入力 → 同一出力（導出値なので状態を持たない）
{
  const ss = [sess("a", "2026-07-06"), sess("b", "2026-07-08")];
  const one = gam.computeStreak(ss, [1, 3, 5], "2026-07-10");
  const two = gam.computeStreak(ss, [1, 3, 5], "2026-07-10");
  assertDeepEqual(two, one, "same-day re-invocation is idempotent");
}

// 非練習曜日の練習が加算される: 日曜（練習曜日外）の自主練も +1
{
  const ss = [sess("a", "2026-07-05"), sess("b", "2026-07-06")]; // 日・月
  const st = gam.computeStreak(ss, [1], "2026-07-07"); // 練習曜日は月のみ
  assertEqual(st.current, 2, "off-schedule Sunday practice still counts");
  assertEqual(st.best, 2, "best includes off-schedule day");
}

// practiceDays=null / 空配列 → configured:false（判定停止。lastPracticeDate は返す）
{
  const ss = [sess("a", "2026-07-06")];
  const st = gam.computeStreak(ss, null, "2026-07-10");
  assertEqual(st.configured, false, "null practiceDays gives configured:false");
  assertEqual(st.current, 0, "unconfigured streak stays 0");
  assertEqual(st.best, 0, "unconfigured best stays 0");
  assertEqual(st.lastPracticeDate, "2026-07-06", "lastPracticeDate still derived");
  assertEqual(gam.computeStreak(ss, [], "2026-07-10").configured, false, "empty array = unconfigured");
}

// 過去日付セッション追加が反映される（差分更新ではなく毎回全履歴走査）
{
  const base = [sess("a", "2026-07-06"), sess("b", "2026-07-08")];
  assertEqual(gam.computeStreak(base, [1, 3], "2026-07-09").current, 2, "before past-date insert");
  const withPast = [...base, sess("p", "2026-07-01")]; // 過去の水曜を後から追加
  assertEqual(gam.computeStreak(withPast, [1, 3], "2026-07-09").current, 3, "past-date session extends the streak");
}

// 未来日付（todayStr 超過）は無視。空セッション（矢0本）も練習日にならない
{
  const ss = [sess("a", "2026-07-06"), sess("f", "2026-07-20")];
  const st = gam.computeStreak(ss, [1], "2026-07-10");
  assertEqual(st.current, 1, "future-dated session is ignored");
  assertEqual(st.lastPracticeDate, "2026-07-06", "future date is not lastPracticeDate");
  const empty = [sess("e", "2026-07-06", { ends: [[]] })];
  const st2 = gam.computeStreak(empty, [1], "2026-07-10");
  assertEqual(st2.lastPracticeDate, null, "zero-arrow session is not a practice day");
  assertEqual(st2.current, 0, "zero-arrow session does not count");
  assertDeepEqual(gam.computeStreak([], [1], "2026-07-10"),
    { configured: true, current: 0, best: 0, freezeTokens: 0, freezeUsedDates: [], lastPracticeDate: null },
    "no history returns all zeros");
}

// 移行ユーザー: 長い既存履歴から best が遡及計算される（2026-06-01 は月曜）
// 6/1〜6/14 の毎日練習 → best=14・トークン2個獲得（7と14の時点）。
// その後 7/9 まで全平日欠席 → 6/15,6/16 でトークン消費、6/17 でリセット
{
  const ss = [];
  for (let d = 1; d <= 14; d++) ss.push(sess(`m${d}`, `2026-06-${String(d).padStart(2, "0")}`));
  const st = gam.computeStreak(ss, [1, 2, 3, 4, 5], "2026-07-10");
  assertEqual(st.best, 14, "migrated user's best is computed retroactively");
  assertEqual(st.current, 0, "long absence resets current");
  assertEqual(st.freezeTokens, 0, "both tokens consumed during the absence");
  assertDeepEqual(st.freezeUsedDates, ["2026-06-15", "2026-06-16"], "freeze consumption dates recorded");
  assertEqual(st.lastPracticeDate, "2026-06-14", "migrated lastPracticeDate");

  // フリーズ導出の決定性: 同一入力 → 同一出力
  const again = gam.computeStreak(ss, [1, 2, 3, 4, 5], "2026-07-10");
  assertDeepEqual(again, st, "freeze derivation is deterministic");
}

// フリーズ獲得上限3 と 消費で current が維持されること
// 6/1〜6/28 毎日練習（28日: 7,14,21 で獲得、28は上限で獲得なし）→ 6/29 欠席で1個消費
{
  const ss = [];
  for (let d = 1; d <= 28; d++) ss.push(sess(`f${d}`, `2026-06-${String(d).padStart(2, "0")}`));
  const st = gam.computeStreak(ss, [0, 1, 2, 3, 4, 5, 6], "2026-06-30");
  assertEqual(st.best, 28, "28-day streak best");
  assertEqual(st.current, 28, "freeze consumption preserves current");
  assertEqual(st.freezeTokens, 2, "tokens cap at 3, one consumed on 6/29");
  assertDeepEqual(st.freezeUsedDates, ["2026-06-29"], "consumed date recorded");
}

// 日ループの5年クランプ（strict-review 2026-07-11 minor⑤・年タイポ耐性）:
// date は type="date" の自由入力で年4桁を誤入力できる（例: "0202-07-11"）。最古練習日を
// そのまま走査起点にすると無関係な大昔まで1日ずつ走査してしまうため、直近5年にクランプする。
// クランプは走査「範囲」だけを変えるので、クランプ内に収まる直近の current/best/freeze の
// 結果は、タイポ入り・タイポなしのどちらでも同じでなければならない。
{
  const typo = sess("typo", "0202-07-11");
  const ss = [sess("a", "2026-07-06"), sess("b", "2026-07-08")]; // 月・水
  const withTypo = gam.computeStreak([typo, ...ss], [1, 3, 5], "2026-07-10");
  const withoutTypo = gam.computeStreak(ss, [1, 3, 5], "2026-07-10");
  assertEqual(withTypo.current, withoutTypo.current, "clamp: wildly old date does not change current");
  assertEqual(withTypo.best, withoutTypo.best, "clamp: wildly old date does not change best");
  assertEqual(withTypo.freezeTokens, withoutTypo.freezeTokens, "clamp: wildly old date does not change freezeTokens");
  assertDeepEqual(
    withTypo.freezeUsedDates,
    withoutTypo.freezeUsedDates,
    "clamp: wildly old date does not change freezeUsedDates",
  );
  // lastPracticeDate は日ループとは無関係な別集合（sd）から出るため、クランプの影響を受けない
  // （このバッジは「最も新しい練習日」であって最古ではない点に注意）
  assertEqual(withTypo.lastPracticeDate, "2026-07-08", "typo date does not become lastPracticeDate");
}

/* ---------- BADGE_DEFS 全体 ---------- */

{
  const ids = gam.BADGE_DEFS.map((b) => b.id);
  assertDeepEqual(ids,
    ["first_arrow", "century", "millennium", "gold_end", "perfect_end", "tight_group",
     "pb_breaker", "week_warrior", "month_master", "streak_7", "distance_explorer", "all_weather"],
    "BADGE_DEFS has exactly the 12 final badges (gold_rush removed)");
}

/* checkBadges の薄いラッパ: 特定バッジの発火有無を返す */
const CTX = { streak: null, nowIso: "2026-07-10T09:00:00.000Z" };
function fired(ss, cur, id, ctx) {
  return gam.checkBadges(ss, [], cur, ctx || CTX).some((b) => b.id === id);
}

// first_arrow: 正=矢1本以上 / 負=空セッション
{
  const cur = sess("c", "2026-07-10", { ends: [end(1, 9)] });
  assertEqual(fired([cur], cur, "first_arrow"), true, "first_arrow positive");
  const nil = sess("n", "2026-07-10", { ends: [[]] });
  assertEqual(fired([nil], nil, "first_arrow"), false, "first_arrow negative (no arrows)");
}

// century: 正=累計100本 / 負=99本
{
  const a = sess("a", "2026-07-01", { ends: [end(60, 8)] });
  const cur = sess("c", "2026-07-10", { ends: [end(40, 8)] });
  assertEqual(fired([a, cur], cur, "century"), true, "century positive (60+40)");
  const cur99 = sess("c", "2026-07-10", { ends: [end(39, 8)] });
  assertEqual(fired([a, cur99], cur99, "century"), false, "century negative (99)");
}

// millennium: 正=累計1000本 / 負=999本
{
  const hist = [];
  for (let i = 0; i < 9; i++) hist.push(sess(`h${i}`, "2026-06-01", { ends: [end(100, 8)] }));
  const cur = sess("c", "2026-07-10", { ends: [end(100, 8)] });
  assertEqual(fired([...hist, cur], cur, "millennium"), true, "millennium positive (1000)");
  const cur99 = sess("c", "2026-07-10", { ends: [end(99, 8)] });
  assertEqual(fired([...hist, cur99], cur99, "millennium"), false, "millennium negative (999)");
}

// gold_end: 1エンド（3本以上）全矢満点。standard=10 / field=6。2本エンドや1本混じりは不発
{
  const pos = sess("c", "2026-07-10", { ends: [end(3, 10)] });
  assertEqual(fired([pos], pos, "gold_end"), true, "gold_end positive (3x10 standard)");
  const two = sess("c", "2026-07-10", { ends: [end(2, 10)] });
  assertEqual(fired([two], two, "gold_end"), false, "gold_end negative (only 2 arrows in end)");
  const mixed = sess("c", "2026-07-10", { ends: [[...end(2, 10), ...end(1, 9)]] });
  assertEqual(fired([mixed], mixed, "gold_end"), false, "gold_end negative (one 9 in end)");
  const field = sess("c", "2026-07-10", { faceType: "field", faceD: 40, ends: [end(3, 6)] });
  assertEqual(fired([field], field, "gold_end"), true, "gold_end positive (field 3x6)");
  const fieldMiss = sess("c", "2026-07-10", { faceType: "field", faceD: 40, ends: [[...end(2, 6), ...end(1, 5)]] });
  assertEqual(fired([fieldMiss], fieldMiss, "gold_end"), false, "gold_end negative (field with a 5)");
}

// perfect_end: 1エンド（3本以上）全矢9点以上（field:5点以上）
{
  const pos = sess("c", "2026-07-10", { ends: [[{ s: 9 }, { s: 10 }, { s: 9 }]] });
  assertEqual(fired([pos], pos, "perfect_end"), true, "perfect_end positive (9,10,9)");
  const neg = sess("c", "2026-07-10", { ends: [[{ s: 9 }, { s: 8 }, { s: 10 }]] });
  assertEqual(fired([neg], neg, "perfect_end"), false, "perfect_end negative (an 8)");
  const field = sess("c", "2026-07-10", { faceType: "field", faceD: 40, ends: [[{ s: 5 }, { s: 6 }, { s: 5 }]] });
  assertEqual(fired([field], field, "perfect_end"), true, "perfect_end positive (field 5+)");
}

// tight_group: 的サイズ相対閾値。同じ散布（RMS=5cm）が
// 40cm的（リング幅2cm→閾値3cm）では不発、122cm的（6.1cm→9.15cm）では発火する
{
  const spread = [];
  for (let i = 0; i < 5; i++) spread.push({ s: 9, x: 5, y: 0 }, { s: 9, x: -5, y: 0 });
  const on40 = sess("c", "2026-07-10", { faceD: 40, ends: [spread] });
  assertEqual(fired([on40], on40, "tight_group"), false, "tight_group negative on 40cm face (rms 5 > 3.0)");
  const on122 = sess("c", "2026-07-10", { faceD: 122, ends: [spread] });
  assertEqual(fired([on122], on122, "tight_group"), true, "tight_group positive on 122cm face (rms 5 <= 9.15)");
  // 座標入力10本未満は前提条件を満たさない
  const nine = sess("c", "2026-07-10", { faceD: 122, ends: [end(9, 9)] });
  assertEqual(fired([nine], nine, "tight_group"), false, "tight_group negative (<10 coordinate arrows)");
  // 座標のない矢は10本カウントに入らない
  const noXY = sess("c", "2026-07-10", { faceD: 122, ends: [end(10, 9, false)] });
  assertEqual(fired([noXY], noXY, "tight_group"), false, "tight_group negative (arrows without coordinates)");
  // gamRingW: field は faceD/12
  assertEqual(gam.gamRingW({ faceType: "field", faceD: 40 }), 40 / 12, "gamRingW field 40");
  assertEqual(gam.gamRingW({ faceType: "single", faceD: 122 }), 6.1, "gamRingW standard 122");
}

// pb_breaker: 本数一致条件つき自己ベスト更新
{
  const peer = sess("p", "2026-07-01", { ends: [end(12, 8)] });   // 96点/12本
  const cur = sess("c", "2026-07-10", { ends: [end(12, 9)] });    // 108点/12本
  assertEqual(fired([peer, cur], cur, "pb_breaker"), true, "pb_breaker positive (same 12 arrows, higher total)");

  // 本数不一致で不発: 6本×9点(54点)の過去ベストを12本(108点)が「超えた」ことにしない
  const shortPeer = sess("p", "2026-07-01", { ends: [end(6, 9)] });
  assertEqual(fired([shortPeer, cur], cur, "pb_breaker"), false, "pb_breaker negative (arrow-count mismatch)");

  // 12本未満は不発
  const cur6 = sess("c", "2026-07-10", { ends: [end(6, 10)] });
  const peer6 = sess("p", "2026-07-01", { ends: [end(6, 8)] });
  assertEqual(fired([peer6, cur6], cur6, "pb_breaker"), false, "pb_breaker negative (<12 arrows)");

  // 条件（dist）が違う過去は peer にならない
  const farPeer = sess("p", "2026-07-01", { dist: 30, ends: [end(12, 8)] });
  assertEqual(fired([farPeer, cur], cur, "pb_breaker"), false, "pb_breaker negative (different distance)");

  // faceType 不一致も peer にならない
  const fieldPeer = sess("p", "2026-07-01", { faceType: "field", faceD: 40, ends: [end(12, 5)] });
  assertEqual(fired([fieldPeer, cur], cur, "pb_breaker"), false, "pb_breaker negative (different faceType)");

  // 過去に届かない場合は不発
  const highPeer = sess("p", "2026-07-01", { ends: [end(12, 10)] });
  assertEqual(fired([highPeer, cur], cur, "pb_breaker"), false, "pb_breaker negative (did not exceed)");
}

// week_warrior: 同一ISO週に3セッション以上（2026-07-06〜07-12 は同一週）
{
  const a = sess("a", "2026-07-06");
  const b = sess("b", "2026-07-08");
  const cur = sess("c", "2026-07-10");
  assertEqual(fired([a, b, cur], cur, "week_warrior"), true, "week_warrior positive (3 in ISO week)");
  assertEqual(fired([a, cur], cur, "week_warrior"), false, "week_warrior negative (2 in ISO week)");
  const lastWeek = sess("w", "2026-07-05"); // 日曜=前ISO週
  assertEqual(fired([a, lastWeek, cur], cur, "week_warrior"), false, "week_warrior negative (previous ISO week excluded)");
}

// month_master: 同一暦月に10セッション以上
{
  const hist = [];
  for (let d = 1; d <= 9; d++) hist.push(sess(`d${d}`, `2026-07-${String(d).padStart(2, "0")}`));
  const cur = sess("c", "2026-07-10");
  assertEqual(fired([...hist, cur], cur, "month_master"), true, "month_master positive (10 in July)");
  assertEqual(fired([...hist.slice(1), cur], cur, "month_master"), false, "month_master negative (9 in July)");
}

// streak_7: カレンダー連続日ではなく ctx.streak.best で判定
{
  const cur = sess("c", "2026-07-10");
  assertEqual(fired([cur], cur, "streak_7", { streak: { best: 7 }, nowIso: CTX.nowIso }), true,
    "streak_7 positive via ctx.streak.best>=7");
  assertEqual(fired([cur], cur, "streak_7", { streak: { best: 6 }, nowIso: CTX.nowIso }), false,
    "streak_7 negative (best 6)");
  assertEqual(fired([cur], cur, "streak_7", { streak: null, nowIso: CTX.nowIso }), false,
    "streak_7 negative (no streak in ctx)");
  // カレンダー7日連続の履歴があっても ctx.streak が無ければ発火しない（gamLongestRun 廃止の確認）
  const week = [];
  for (let d = 1; d <= 7; d++) week.push(sess(`w${d}`, `2026-07-${String(d).padStart(2, "0")}`));
  assertEqual(fired(week, week[6], "streak_7", { streak: null, nowIso: CTX.nowIso }), false,
    "streak_7 does not use calendar-run fallback");
}

// distance_explorer: 3種以上の距離
{
  const a = sess("a", "2026-07-01", { dist: 18 });
  const b = sess("b", "2026-07-02", { dist: 30 });
  const cur = sess("c", "2026-07-10", { dist: 70 });
  assertEqual(fired([a, b, cur], cur, "distance_explorer"), true, "distance_explorer positive (3 distances)");
  assertEqual(fired([a, cur], cur, "distance_explorer"), false, "distance_explorer negative (2 distances)");
}

// all_weather: 3種以上の天候（wx）
{
  const a = sess("a", "2026-07-01", { wx: "晴れ" });
  const b = sess("b", "2026-07-02", { wx: "雨" });
  const cur = sess("c", "2026-07-10", { wx: "風 強" });
  assertEqual(fired([a, b, cur], cur, "all_weather"), true, "all_weather positive (3 weathers)");
  assertEqual(fired([a, cur], cur, "all_weather"), false, "all_weather negative (2 weathers)");
}

/* ---------- checkBadges の契約 ---------- */

{
  const cur = sess("c", "2026-07-10", { ends: [end(3, 10)] });
  const res = gam.checkBadges([cur], [], cur, CTX);
  const first = res.find((b) => b.id === "first_arrow");
  assert(first, "checkBadges returns newly unlocked badges");
  assertDeepEqual(Object.keys(first).sort(), ["id", "sessionId", "unlockedAt"],
    "checkBadges returns minimal shape only (no name/icon/reason)");
  assertEqual(first.unlockedAt, CTX.nowIso, "unlockedAt comes from ctx.nowIso (no new Date())");
  assertEqual(first.sessionId, "c", "sessionId is the current session");

  // unlockedIds は配列でも Set でも受け付け、既取得は返さない
  assertEqual(gam.checkBadges([cur], ["first_arrow"], cur, CTX).some((b) => b.id === "first_arrow"), false,
    "array unlockedIds filters already-unlocked");
  assertEqual(gam.checkBadges([cur], new Set(["first_arrow"]), cur, CTX).some((b) => b.id === "first_arrow"), false,
    "Set unlockedIds filters already-unlocked");
  const all = gam.BADGE_DEFS.map((b) => b.id);
  assertDeepEqual(gam.checkBadges([cur], all, cur, CTX), [], "all unlocked returns empty array");
}

/* ---------- backfillBadges ---------- */

{
  // 2026-05-01(金)〜05-03(日) は同一ISO週。s2 で累計100本に到達する
  const s1 = sess("s1", "2026-05-01", { ends: [end(6, 7, false)] });
  const s2 = sess("s2", "2026-05-02", { ends: [end(94, 7, false)] });
  const s3 = sess("s3", "2026-05-03", { ends: [end(6, 7, false)] });
  const NOW = "2026-07-10T00:00:00.000Z";
  const got = gam.backfillBadges([s3, s1, s2], NOW); // 入力順シャッフル → 日付昇順で判定される
  const byId = {};
  got.forEach((b) => { byId[b.id] = b; });

  assert(byId.first_arrow, "backfill grants first_arrow");
  assertEqual(byId.first_arrow.sessionId, "s1", "first_arrow attributed to the earliest session");
  assert(byId.century, "backfill grants century");
  assertEqual(byId.century.sessionId, "s2", "century attributed to the session reaching 100 cumulative");
  assert(byId.week_warrior, "backfill grants week_warrior");
  assertEqual(byId.week_warrior.sessionId, "s3", "week_warrior attributed to the 3rd session of the week");
  got.forEach((b) => {
    assertEqual(b.retro, true, `backfill ${b.id} carries retro:true`);
    assertEqual(b.unlockedAt, NOW, `backfill ${b.id} unlockedAt is nowIso`);
  });
  assertEqual(got.some((b) => b.id === "streak_7"), false,
    "backfill does not grant streak_7 (practiceDays unset at migration time)");
  assertEqual(got.some((b) => b.id === "millennium"), false, "backfill negative (only 106 arrows)");
  assertDeepEqual(gam.backfillBadges([], NOW), [], "empty history backfills nothing");
}

/* ---------- calcGoalProgress ---------- */

{
  // today=2026-07-10(金)。ISO週は 07-06(月)〜07-12(日)
  const ss = [
    sess("t1", "2026-07-10", { ends: [end(24, 9)] }),  // 今日 24本
    sess("t2", "2026-07-10", { ends: [end(12, 9)] }),  // 今日 12本（日次は合算）
    sess("w1", "2026-07-06", { ends: [end(30, 9)] }),  // 今週
    sess("w0", "2026-07-08", { ends: [[]] }),           // 今週だが空 → 週次から除外
    sess("lw", "2026-07-05", { ends: [end(30, 9)] }),  // 先週日曜 → 週次外・月内
    sess("pm", "2026-06-30", { ends: [end(50, 9)] }),  // 先月 → 月次外
  ];
  const p = gam.calcGoalProgress(ss, { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 }, "2026-07-10");
  assertEqual(p.daily.current, 36, "daily sums today's arrows across sessions");
  assertEqual(p.daily.target, 36, "daily target passthrough");
  assertEqual(p.weekly.current, 3, "weekly counts non-empty sessions in ISO week (empty excluded)");
  assertEqual(p.weekly.target, 3, "weekly target passthrough");
  assertEqual(p.monthly.current, 96, "monthly sums July arrows only (24+12+30+30)");
  assertEqual(p.monthly.target, 300, "monthly target passthrough");

  // 目標未指定は既定値（36/3/300）
  const d = gam.calcGoalProgress([], {}, "2026-07-10");
  assertDeepEqual(d, {
    daily: { current: 0, target: 36 },
    weekly: { current: 0, target: 3 },
    monthly: { current: 0, target: 300 },
  }, "defaults apply when goals are empty");
}

/* ---------- goalRingOffset ---------- */

{
  assertEqual(gam.goalRingOffset(0, 36, 100), 100, "ring empty at 0 progress");
  assertEqual(gam.goalRingOffset(18, 36, 100), 50, "ring half at 50% progress");
  assertEqual(gam.goalRingOffset(36, 36, 100), 0, "ring full at target");
  assertEqual(gam.goalRingOffset(72, 36, 100), 0, "overachievement clamps to full");
  assertEqual(gam.goalRingOffset(10, 0, 100), 100, "target 0 shows empty ring");
}

console.log("Gamification pure-function checks OK (streak / 12 badges / backfill / goals)");
