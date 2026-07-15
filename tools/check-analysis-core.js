"use strict";
/* 数理コアの特性テスト（characterization test）。
   現在の実装の出力を「正」として固定し、リファクタ時の出力不変を保証する。
   対象: scoreAt / 線かみ半径 / robustStats / 回帰3種 / windModel / セッション統計キャッシュ */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scoringScript = fs.readFileSync(path.join(root, "scripts", "20-scoring.js"), "utf8");
const analysisScript = fs.readFileSync(
  path.join(root, "scripts", "40-analysis-physics.js"),
  "utf8",
);

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function assertEqual(actual, expected, label) {
  assert(
    Object.is(actual, expected),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function assertClose(actual, expected, eps, label) {
  assert(
    Number.isFinite(actual) && Math.abs(actual - expected) <= eps,
    `${label}: expected ${expected} (±${eps}), got ${actual}`,
  );
}

function section(source, start, end) {
  const a = source.indexOf(start);
  assert(a >= 0, `Missing start marker: ${start}`);
  const b = source.indexOf(end, a);
  assert(b > a, `Missing end marker: ${end}`);
  return source.slice(a, b);
}

const scoring = new Function(
  `${scoringScript}
return {ringW, arrowMarkRadius, lineCutRadius, scoreAt, isLineCutting, hitFromGlobal, robustStats, groupStats, median, clamp};`,
)();

const analysis = new Function(
  `let DB_REV = 0; /* 10-storage-native.js の世代カウンタ相当。bumpDbRev が save() の DB_REV++ を模す */
${scoringScript}
${section(analysisScript, "function num(", "function estimatedTotalArrowWeight")}
${section(analysisScript, "function sessionWindSpeed", "function windDriftText")}
${section(analysisScript, "const SESSION_METRIC_CACHE", "function sessionQuality")}
${section(analysisScript, "function regress(", "function solve3(")}
return {sessionWindSpeed, windModel, sessionMetricSignature, sessionMetrics, regress, robustLine, robustWeightedLine, bumpDbRev(){ DB_REV++; }};`,
)();

/* ---------- scoreAt / 線かみ ---------- */

// 122cm単的: リング幅 6.1cm、矢円半径 122/85、的線半幅 122/1200
assertClose(scoring.ringW(122, "single"), 6.1, 1e-9, "ringW 122 single");
assertClose(
  scoring.lineCutRadius(122, "single"),
  122 / 85 + 122 / 1200,
  1e-9,
  "lineCutRadius 122 single",
);

// 中心は X
{
  const hit = scoring.scoreAt(0, 0, 122, "single");
  assertEqual(hit.s, 10, "center score");
  assertEqual(hit.X, true, "center is X");
}
// X 境界（touch=0 で幾何のみを確認）: w/2 ちょうどは X、僅かに外は 10 で X なし
assertEqual(scoring.scoreAt(3.05, 0, 122, "single", 0).X, true, "X boundary inclusive");
{
  const hit = scoring.scoreAt(3.06, 0, 122, "single", 0);
  assertEqual(hit.s, 10, "just outside X keeps 10");
  assertEqual(hit.X, false, "just outside X is not X");
}
// 線かみ: 10リング(6.1cm)の外 7.6cm でも矢円+線幅ぶんで 10 になる
assertEqual(scoring.scoreAt(7.6, 0, 122, "single").s, 10, "line cutter promotes to 10");
assertEqual(scoring.scoreAt(7.6, 0, 122, "single", 0).s, 9, "same point without touch is 9");
assertEqual(scoring.isLineCutting(7.6, 0, 122, "single"), true, "isLineCutting at 7.6cm");
assertEqual(scoring.isLineCutting(9, 0, 122, "single"), false, "no line cutting mid-ring");

// 三つ目的: 6点未満は 0 に切り捨て
assertEqual(scoring.scoreAt(11, 0, 40, "triple", 0).s, 0, "triple cuts below 6 to 0");
assertEqual(scoring.scoreAt(9.9, 0, 40, "triple", 0).s, 6, "triple keeps 6");
// 三つ目的のスポット吸着: (0.5, 20) は上スポット(y=22)に属し 9 点
{
  const hit = scoring.hitFromGlobal(0.5, 20, 40, "triple", 0);
  assertEqual(hit.spot, 0, "triple snaps to top spot");
  assertEqual(hit.s, 9, "triple relative score");
}

// フィールド的(40cm): リング幅 40/12、中心 6 点、6リング外は 0
assertEqual(scoring.scoreAt(0, 0, 40, "field", 0).s, 6, "field center is 6");
assertEqual(scoring.scoreAt(5, 0, 40, "field", 0).s, 5, "field 5 zone");
assertEqual(scoring.scoreAt(21, 0, 40, "field", 0).s, 0, "field miss");
assertEqual(scoring.scoreAt(0, 0, 40, "field", 0).X, false, "field has no X");

/* ---------- robustStats ---------- */

// 5本未満は simple 法 + 低信頼度
{
  const st = scoring.robustStats([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ]);
  assertEqual(st.method, "simple", "small sample uses simple method");
  assertClose(st.confidence, 0.55, 1e-9, "3-arrow confidence");
  assertEqual(st.total, 3, "small sample total");
}
{
  const st = scoring.robustStats([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]);
  assertClose(st.confidence, 0.35, 1e-9, "2-arrow confidence");
}

// 明白な外れ値 1 本はクラスタ中心を保ったまま除外される
{
  const cluster = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
  ];
  const st = scoring.robustStats([...cluster, { x: 40, y: 40 }]);
  assertEqual(st.method, "ellipse-biweight", "large sample uses ellipse-biweight");
  assertEqual(st.excluded.length, 1, "one outlier excluded");
  assertEqual(st.excluded[0].x, 40, "the excluded arrow is the outlier");
  assert(
    Math.abs(st.mx) < 0.5 && Math.abs(st.my) < 0.5,
    `center stays near origin, got (${st.mx}, ${st.my})`,
  );
  assert(st.confidence > 0.3 && st.confidence <= 1, `confidence in range, got ${st.confidence}`);
}

/* ---------- 回帰 ---------- */

{
  const r = analysis.regress([
    [0, 1],
    [1, 3],
    [2, 5],
  ]);
  assertClose(r.b, 2, 1e-9, "regress slope");
  assertClose(r.a, 1, 1e-9, "regress intercept");
  assertClose(r.zero, -0.5, 1e-9, "regress zero");
  assertClose(r.r2, 1, 1e-9, "regress r2");
}
{
  const r = analysis.robustLine([
    [0, 1],
    [1, 3],
    [2, 5],
  ]);
  assertClose(r.b, 2, 1e-9, "robustLine slope");
  assertClose(r.zero, -0.5, 1e-9, "robustLine zero");
}
{
  const r = analysis.robustWeightedLine([
    [0, 1, 1],
    [1, 3, 1],
    [2, 5, 1],
    [3, 7, 1],
  ]);
  assertEqual(r.kind, "weighted-robust", "robustWeightedLine kind");
  assertClose(r.zero, -0.5, 1e-6, "robustWeightedLine zero");
  assert(r.quality > 0.8, `clean-line quality should be high, got ${r.quality}`);
}
assertEqual(analysis.regress([[1, 2]]), null, "regress needs 2 points");

/* ---------- windModel ---------- */

{
  const w = analysis.windModel({ windSpeed: "4", windDir: "向かい" });
  assertEqual(w.down, -4, "headwind down");
  assertEqual(w.side, 0, "headwind side");
  assertEqual(w.label, "向かい風", "headwind label");
}
assertEqual(analysis.windModel({ windSpeed: "4", windDir: "追い" }).down, 4, "tailwind down");
assertEqual(
  analysis.windModel({ windSpeed: "4", windDir: "左から" }).side,
  4,
  "left crosswind side",
);
assertEqual(
  analysis.windModel({ windSpeed: "4", windDir: "右から" }).side,
  -4,
  "right crosswind side",
);
{
  const w = analysis.windModel({ windSpeed: "4", windDir: "巻き" });
  assertClose(w.side, 2.2, 1e-9, "swirl side");
  assertClose(w.down, -0.8, 1e-9, "swirl down");
  assertClose(w.variability, 0.55, 1e-9, "swirl variability");
}
{
  const w = analysis.windModel({});
  assertEqual(w.speed, 0, "no wind speed");
  assertEqual(w.known, false, "no wind known");
  assertEqual(w.label, "無風扱い", "no wind label");
}
assertEqual(analysis.sessionWindSpeed({ wx: "風 強" }), 5, "strong wind text maps to 5m/s");
assertEqual(analysis.sessionWindSpeed({ windSpeed: "99" }), 18, "wind speed clamps to 18");

/* ---------- セッション統計キャッシュ ---------- */

function sampleSession() {
  return {
    id: "s1",
    date: "2026-01-01",
    dist: 70,
    faceD: 122,
    faceType: "single",
    ends: [
      [
        { x: 0, y: 0, s: 10, X: true },
        { x: 1, y: 2, s: 9 },
      ],
      [
        { x: -1, y: 0, s: 10 },
        { x: 2, y: -1, s: 9 },
      ],
    ],
  };
}

{
  const a = analysis.sessionMetricSignature(sampleSession());
  const b = analysis.sessionMetricSignature(sampleSession());
  assertEqual(a, b, "same session gives same signature");

  const scored = sampleSession();
  scored.ends[1][1].s = 8;
  assert(analysis.sessionMetricSignature(scored) !== a, "score change changes signature");

  const extra = sampleSession();
  extra.ends[1].push({ x: 0, y: 0, s: 10 });
  assert(analysis.sessionMetricSignature(extra) !== a, "added arrow changes signature");

  // 途中の矢の位置だけ動かしても（点数不変でも）キャッシュキーが変わること
  const nudged = sampleSession();
  nudged.ends[0][1].x += 0.4;
  assert(
    analysis.sessionMetricSignature(nudged) !== a,
    "mid-session position nudge changes signature",
  );
}

{
  const s = sampleSession();
  const m1 = analysis.sessionMetrics(s);
  assertEqual(m1.total, 38, "session total");
  assertClose(m1.avg, 9.5, 1e-9, "session average");
  assertEqual(m1.all.length, 4, "session arrow count");
  const m2 = analysis.sessionMetrics(s);
  assert(m1 === m2, "identical session hits the metrics cache");
}

// DB世代カウンタ: 署名が衝突するナッジ編集でも save 相当の DB_REV++ で再計算されること
{
  const s = sampleSession();
  const sigBefore = analysis.sessionMetricSignature(s);
  const m1 = analysis.sessionMetrics(s);
  // 最終矢以外の2本を逆方向に同距離ナッジ → 本数/合計点/x合計/y合計/最終矢が全て不変で旧署名は衝突する
  s.ends[0][0].x += 0.4;
  s.ends[0][1].x -= 0.4;
  assertEqual(
    analysis.sessionMetricSignature(s),
    sigBefore,
    "opposite equal nudges collide with the pre-save signature (documented limit)",
  );
  assert(
    analysis.sessionMetrics(s) === m1,
    "before save the collision still returns cached metrics",
  );
  analysis.bumpDbRev(); // save() 相当
  assert(analysis.sessionMetricSignature(s) !== sigBefore, "DB_REV bump changes the signature");
  const m2 = analysis.sessionMetrics(s);
  assert(m2 !== m1, "post-save metrics are recomputed, not the stale cache entry");
  const fresh = scoring.robustStats(s.ends.flat());
  assertClose(m2.st.sx, fresh.sx, 1e-12, "recomputed stats reflect the nudged positions");
  assert(
    m2.st.sx !== m1.st.sx,
    "nudge actually changes the spread, proving the old cache was stale",
  );
}

// 入力防御: 非有限座標（NaN/Infinity/null/undefined）が混ざっても sessionMetrics は
// NaN を統計へ伝播させず、有限座標の矢だけを robustStats に渡すこと
{
  const s = sampleSession();
  s.id = "s-nonfinite";
  s.ends[0].push({ x: NaN, y: 2, s: 7 });
  s.ends[1].push({ x: Infinity, y: null, s: 6 }, { x: undefined, y: 0, s: 5 });
  const m = analysis.sessionMetrics(s);
  assertEqual(m.all.length, 7, "all keeps every arrow (score base unchanged)");
  assertEqual(m.total, 56, "total stays score-based over all arrows");
  const st = m.st;
  assert(st, "stats exist despite non-finite coordinates");
  assertEqual(st.total, 4, "only finite-coordinate arrows enter the stats");
  ["mx", "my", "rr", "sx", "sy"].forEach((k) => {
    assert(Number.isFinite(st[k]), `st.${k} must be finite, got ${st[k]}`);
  });
  const expected = scoring.robustStats(
    sampleSession()
      .ends.flat()
      .map((a) => ({ x: a.x, y: a.y })),
  );
  assertClose(st.rr, expected.rr, 1e-12, "stats match finite-only robustStats (rr)");
  assertClose(st.mx, expected.mx, 1e-12, "stats match finite-only robustStats (mx)");
  assertClose(st.sy, expected.sy, 1e-12, "stats match finite-only robustStats (sy)");
}

/* ---------- groupingSessionRow と旧直接計算の等価性 ---------- */

// 履歴グルーピング行の統計は、旧実装（robustStats 直呼び: Number 化＋有限フィルタ）と
// 一致しなければならない。旧計算はここで独立に再現し、実装の内部経路には依存しない。
{
  const recordScript = fs.readFileSync(path.join(root, "scripts", "50-record-view.js"), "utf8");
  const record = new Function(
    "sessionMetrics",
    "robustStats",
    "distanceBucketInfo",
    "sightDateInfo",
    `${section(recordScript, "function groupingMetricNumber", "function groupingSummaryHtml")}
return {groupingSessionRow};`,
  )(
    analysis.sessionMetrics,
    scoring.robustStats,
    (dist) => ({ key: String(dist), label: String(dist), sort: Number(dist) || 0 }),
    () => ({ sort: "", label: "—" }),
  );

  // 旧 groupingSessionRow の統計計算をテスト内で独立再現
  function legacyGroupingStats(row) {
    const arrows = (row && Array.isArray(row.arrows) ? row.arrows : [])
      .map((a) => ({ x: Number(a && a.x), y: Number(a && a.y) }))
      .filter((a) => Number.isFinite(a.x) && Number.isFinite(a.y));
    if (arrows.length < 3) return null;
    const st = scoring.robustStats(arrows);
    if (!st || st.n < 3 || !Number.isFinite(Number(st.rr))) return null;
    return { rr: Number(st.rr), sx: Number(st.sx), sy: Number(st.sy), n: st.n };
  }

  function rowOf(id, ends) {
    const s = { id, date: "2026-06-01", dist: 70, faceD: 122, faceType: "single", ends };
    return { s, arrows: ends.flat() };
  }

  const fixtures = [
    // 文字列座標（インポート由来を想定）
    rowOf("eq-strings", [
      [
        { x: "1.2", y: "0.4", s: "9" },
        { x: "-0.6", y: "1.1", s: "9" },
        { x: "0.1", y: "-0.8", s: 10 },
      ],
      [
        { x: "2.0", y: "0.0", s: 8 },
        { x: "-1.4", y: "-0.9", s: 9 },
        { x: "0.5", y: "0.7", s: 10 },
      ],
    ]),
    // 非有限座標の混入
    rowOf("eq-nonfinite", [
      [
        { x: 0, y: 0, s: 10 },
        { x: NaN, y: 1, s: 9 },
        { x: 1, y: 0.5, s: 9 },
      ],
      [
        { x: Infinity, y: null, s: 8 },
        { x: -1, y: -0.5, s: 9 },
        { x: 0.5, y: 1.2, s: 9 },
        { x: -0.5, y: 0.8, s: 10 },
      ],
    ]),
    // M（0点）混在: 座標付きミスと大外れ値
    rowOf("eq-miss", [
      [
        { x: 0.2, y: 0.1, s: 10, X: true },
        { x: 58, y: -44, s: 0 },
        { x: -0.8, y: 0.6, s: 9 },
      ],
      [
        { x: 1.1, y: -0.3, s: 9 },
        { x: -0.4, y: -1.0, s: 9 },
        { x: 0.7, y: 0.9, s: 10 },
      ],
    ]),
    // 有限座標が3本未満 → 両者とも null
    rowOf("eq-too-few", [
      [
        { x: NaN, y: 0, s: 0 },
        { x: 1, y: 1, s: 9 },
        { x: 0, y: 1, s: 9 },
      ],
    ]),
    // 境界: 非有限混入で有限座標がちょうど3本 → 両者とも行が出る側
    rowOf("eq-exactly-three", [
      [
        { x: NaN, y: 2, s: 0 },
        { x: "abc", y: 1, s: 8 },
        { x: 0.3, y: -0.2, s: 10 },
      ],
      [
        { x: -0.9, y: 0.4, s: 9 },
        { x: 1.4, y: 1.1, s: 8 },
      ],
    ]),
  ];

  fixtures.forEach((row) => {
    const legacy = legacyGroupingStats(row);
    const current = record.groupingSessionRow(row);
    if (legacy == null) {
      assertEqual(current, null, `[grouping-eq ${row.s.id}] both null`);
      return;
    }
    assert(current, `[grouping-eq ${row.s.id}] current result exists`);
    assertEqual(current.n, legacy.n, `[grouping-eq ${row.s.id}] n`);
    assertClose(current.rr, legacy.rr, 1e-12, `[grouping-eq ${row.s.id}] rr`);
    assertClose(current.sx, legacy.sx, 1e-12, `[grouping-eq ${row.s.id}] sx`);
    assertClose(current.sy, legacy.sy, 1e-12, `[grouping-eq ${row.s.id}] sy`);
  });
}

// 実装側の署名が世代カウンタを参照していること（ハーネス外でも DB_REV が効く静的保証）
assert(
  section(analysisScript, "function sessionMetricSignature", "function sessionMetrics").includes(
    "DB_REV",
  ),
  "sessionMetricSignature must include DB_REV in the cache key",
);

/* ---------- 分析コア (45-analysis-core.js) ---------- */

const coreScript = fs.readFileSync(path.join(root, "scripts", "45-analysis-core.js"), "utf8");
const core = new Function(
  `${coreScript}
return {buildAnalysisRows, filterAnalysisRows, isoWeekKey, aggregateByPeriod, movingAverage, personalBests, conditionSplit, reasonBreakdown, aggregateRoundGroups, roundGroupBests, todayConclusion, growthDashboard, nextPracticeSuggestions};`,
)();

// テスト用の metricsFn: sessionMetrics 互換の形を robustStats から作る
const metricsFn = (s) => {
  const all = s.ends.flat();
  const total = all.reduce((a, x) => a + (x.s || 0), 0);
  return { all, total, avg: all.length ? total / all.length : 0, st: scoring.robustStats(all) };
};

function coreSession(id, date, dist, opts) {
  const o = opts || {};
  return Object.assign(
    {
      id,
      date,
      dist,
      setupId: o.setupId === undefined ? "setup-a" : o.setupId,
      faceD: 122,
      faceType: "single",
      round: o.round || "free",
      windSpeed: o.windSpeed || "",
      ends: o.ends || [
        [
          { x: 1, y: 0, s: 9 },
          { x: 0, y: 1, s: 10 },
          { x: -1, y: 0, s: 9 },
        ],
        [
          { x: 0, y: -1, s: 10 },
          { x: 1, y: 1, s: 9 },
          { x: -1, y: -1, s: 9 },
        ],
      ],
    },
    o.extra || {},
  );
}

const coreSessions = [
  coreSession("c1", "2026-05-01", 70),
  coreSession("c2", "2026-06-20", 70, { windSpeed: "5" }),
  coreSession("c3", "2026-06-28", 30, { setupId: "", round: "30m36" }),
];
const coreSetups = [{ id: "setup-a", name: "Main recurve" }];

// buildAnalysisRows: 正常系 + 欠損系
{
  const rows = core.buildAnalysisRows(coreSessions, coreSetups, metricsFn);
  assertEqual(rows.length, 3, "buildAnalysisRows row count");
  assertEqual(rows[0].setupName, "Main recurve", "row resolves setup name");
  assertEqual(rows[0].n, 6, "row arrow count");
  assertEqual(rows[0].total, 56, "row total");
  assertEqual(rows[2].dist, 30, "row numeric distance");
  assertEqual(rows[2].round, "30m36", "row round");
  assertEqual(
    core.buildAnalysisRows([], [], metricsFn).length,
    0,
    "empty sessions give empty rows",
  );
  assertEqual(
    core.buildAnalysisRows([{ id: "broken" }, null], [], metricsFn).length,
    0,
    "sessions without ends are dropped",
  );
  const noDist = core.buildAnalysisRows(
    [coreSession("nd", "2026-01-01", undefined)],
    [],
    metricsFn,
  );
  assertEqual(noDist[0].dist, null, "missing distance becomes null");
}

// filterAnalysisRows: setup / dist / period
{
  const rows = core.buildAnalysisRows(coreSessions, coreSetups, metricsFn);
  assertEqual(core.filterAnalysisRows(rows, {}).length, 3, "no filter keeps all");
  assertEqual(core.filterAnalysisRows(rows, { setupId: "setup-a" }).length, 2, "setup filter");
  assertEqual(core.filterAnalysisRows(rows, { setupId: "__none" }).length, 1, "no-setup filter");
  assertEqual(core.filterAnalysisRows(rows, { dist: "70" }).length, 2, "distance filter");
  assertEqual(core.filterAnalysisRows(rows, { round: "30m36" }).length, 1, "round filter");
  assertEqual(
    core.filterAnalysisRows(rows, { period: "1m", today: "2026-07-03" }).length,
    2,
    "1-month period filter",
  );
  assertEqual(
    core.filterAnalysisRows(rows, { period: "1m" }).length,
    3,
    "period without today keeps all",
  );
}

// isoWeekKey / aggregateByPeriod
{
  assertEqual(core.isoWeekKey("2026-01-01"), "2026-W01", "ISO week of 2026-01-01");
  assertEqual(core.isoWeekKey("2024-12-30"), "2025-W01", "ISO week year rollover");
  assertEqual(core.isoWeekKey("bad-date"), "", "invalid date gives empty key");
  const rows = core.buildAnalysisRows(coreSessions, coreSetups, metricsFn);
  const months = core.aggregateByPeriod(rows, "month");
  assertEqual(months.length, 2, "monthly bucket count");
  assertEqual(months[0].key, "2026-05", "monthly buckets sorted ascending");
  assertEqual(months[1].sessions, 2, "June session count");
  assertClose(months[1].avg, 56 / 6, 1e-9, "June average per arrow");
  assert(months[1].best && months[1].best.total === 56, "June best total");
  assertEqual(core.aggregateByPeriod([], "month").length, 0, "empty rows aggregate to nothing");
}

// movingAverage
{
  const ma = core.movingAverage([1, 2, 3, 4, 5], 3);
  assertClose(ma[0], 1, 1e-9, "MA head");
  assertClose(ma[1], 1.5, 1e-9, "MA partial window");
  assertClose(ma[4], 4, 1e-9, "MA full window");
  assertEqual(core.movingAverage([], 5).length, 0, "MA of empty input");
  assertEqual(core.movingAverage([1, NaN, 3], 2)[1], null, "MA masks non-finite input");
}

// personalBests
{
  const rows = core.buildAnalysisRows(coreSessions, coreSetups, metricsFn);
  const pbs = core.personalBests(rows);
  assertEqual(pbs.length, 2, "PB group count (round×distance)");
  assertEqual(pbs[0].dist, 70, "PB groups sorted by distance desc");
  assertEqual(pbs[0].sessions, 2, "PB 70m session count");
  assertEqual(pbs[0].bestTotal.total, 56, "PB best total");
  assertEqual(core.personalBests([]).length, 0, "PB of empty rows");
}

// aggregateRoundGroups / roundGroupBests（IMP-09 多距離ラウンド）
{
  const assertStrict = require("node:assert/strict");
  const rg = (gid, stage, stageCount) => ({ gid, roundId: "wa1440_men", stage, stageCount });
  const highEnds = [
    [
      { x: 0, y: 0, s: 10, X: true },
      { x: 1, y: 0, s: 10 },
      { x: 0, y: 1, s: 10 },
    ],
  ];
  const groupSessions = [
    // グループ1（complete: 2/2 ステージ）。ステージ順と行順を逆にして stage 昇順ソートを確認
    coreSession("g1-s2", "2026-06-10", 30, {
      round: "wa1440_men",
      extra: { roundGroup: rg("grp-1", 1, 2) },
    }),
    coreSession("g1-s1", "2026-06-09", 70, {
      round: "wa1440_men",
      extra: { roundGroup: rg("grp-1", 0, 2) },
    }),
    // グループ2（不完全: 1/2 ステージ）
    coreSession("g2-s1", "2026-06-20", 70, {
      round: "wa1440_men",
      ends: highEnds,
      extra: { roundGroup: rg("grp-2", 0, 2) },
    }),
    // roundGroup なしの既存行（集計に混ざらないこと）
    coreSession("plain", "2026-06-05", 70),
  ];
  const rows = core.buildAnalysisRows(groupSessions, coreSetups, metricsFn);
  assertEqual(rows[3].roundGroup, null, "plain row has null roundGroup");
  assertEqual(rows[0].roundGroup.gid, "grp-1", "grouped row keeps roundGroup");

  const groups = core.aggregateRoundGroups(rows);
  assertEqual(groups.length, 2, "group count (plain rows excluded)");
  const g1 = groups.find((g) => g.gid === "grp-1");
  assert(g1, "group grp-1 exists");
  assertEqual(g1.roundId, "wa1440_men", "group roundId");
  assertEqual(g1.date, "2026-06-09", "group date is the earliest stage date");
  assertEqual(g1.stages.length, 2, "group stage count");
  assertEqual(g1.stages[0].dist, 70, "stages sorted by roundGroup.stage");
  assertEqual(g1.stages[1].dist, 30, "second stage distance");
  assertEqual(g1.stages[0].total, 56, "stage total");
  assertEqual(g1.stages[0].n, 6, "stage arrow count");
  assertEqual(g1.total, 112, "group total sums stages");
  assertEqual(g1.arrows, 12, "group arrows sum stages");
  assertEqual(g1.complete, true, "2/2 stages is complete");
  const g2 = groups.find((g) => g.gid === "grp-2");
  assertEqual(g2.complete, false, "1/2 stages is incomplete");
  assertEqual(g2.total, 30, "incomplete group still sums its stages");
  assertEqual(core.aggregateRoundGroups([]).length, 0, "empty rows aggregate to no groups");

  // 同 stage の重複行（例: 破損データや二重取り込み）では stageCount と行数が一致しても complete にしない
  const dupSessions = [
    coreSession("dup-a", "2026-06-25", 70, {
      round: "wa1440_men",
      extra: { roundGroup: rg("grp-dup", 0, 2) },
    }),
    coreSession("dup-b", "2026-06-26", 70, {
      round: "wa1440_men",
      extra: { roundGroup: rg("grp-dup", 0, 2) },
    }),
  ];
  const dupGroups = core.aggregateRoundGroups(
    core.buildAnalysisRows(dupSessions, coreSetups, metricsFn),
  );
  assertEqual(dupGroups.length, 1, "duplicate-stage rows stay one group");
  assertEqual(dupGroups[0].complete, false, "duplicate stages do not count as complete");

  // roundGroupBests: complete のみ対象。高得点でも不完全な grp-2 は無視される
  const bests = core.roundGroupBests(groups);
  assertEqual(bests.length, 1, "bests count (incomplete groups ignored)");
  assertEqual(bests[0].roundId, "wa1440_men", "best roundId");
  assertEqual(bests[0].total, 112, "best total comes from the complete group");
  assertEqual(bests[0].date, "2026-06-09", "best date");
  assertEqual(core.roundGroupBests([]).length, 0, "no groups means no bests");

  // 既存 personalBests の結果が不変であること: roundGroup の有無だけが違う行集合で出力が一致する
  const noGroupSessions = groupSessions.map((s) => {
    const c = JSON.parse(JSON.stringify(s));
    delete c.roundGroup;
    return c;
  });
  const pbWith = core.personalBests(core.buildAnalysisRows(groupSessions, coreSetups, metricsFn));
  const pbWithout = core.personalBests(
    core.buildAnalysisRows(noGroupSessions, coreSetups, metricsFn),
  );
  assertStrict.deepStrictEqual(pbWith, pbWithout, "personalBests ignores roundGroup");
}

// conditionSplit
{
  const rows = core.buildAnalysisRows(coreSessions, coreSetups, metricsFn);
  const cs = core.conditionSplit(rows, (s) => Number(s.windSpeed) >= 3.5);
  assertEqual(cs.windy.sessions, 1, "windy session count");
  assertEqual(cs.calm.sessions, 2, "calm session count");
  assertClose(cs.windy.avg, 56 / 6, 1e-9, "windy average");
  const empty = core.conditionSplit([], () => true);
  assertEqual(empty.windy.avg, null, "empty split has null averages");
}

// reasonBreakdown
{
  const tagged = coreSession("rt", "2026-06-01", 70, {
    ends: [
      [
        { x: 2, y: 0, s: 8, reason: "リリース" },
        { x: 2.4, y: 0.2, s: 8, reason: "リリース" },
        { x: 0, y: -3, s: 8, reason: "風" },
        { x: 0.1, y: 0, s: 10 },
      ],
    ],
  });
  const rows = core.buildAnalysisRows([tagged], [], metricsFn);
  const rb = core.reasonBreakdown(rows);
  assertEqual(rb.tagged, 3, "tagged arrow count");
  assertEqual(rb.items[0].reason, "リリース", "most frequent tag first");
  assertEqual(rb.items[0].count, 2, "tag count");
  assertClose(rb.items[0].mx, 2.2, 1e-9, "tag mean x offset");
  assertClose(rb.items[0].avg, 8, 1e-9, "tag mean score");
  assertEqual(core.reasonBreakdown([]).tagged, 0, "no rows means no tags");
}

// todayConclusion: 「今日の結論」1文選択（データ不足 / 良い / 悪いの3態）
{
  // ヘルパー: sessionMetrics 互換の行を直接組み立てる（buildAnalysisRows を介さず、
  // st.mx/my/rr を狙った値に固定してしきい値の境界を検証する）
  function conclusionRow(id, date, avg, st) {
    return { id, date, n: 6, avg, total: avg * 6, st };
  }
  function stOf(rr, mx, my) {
    return {
      rr,
      mx,
      my,
      sx: 1,
      sy: 1,
      n: 6,
      total: 6,
      method: "simple",
      confidence: 0.6,
      excluded: [],
    };
  }

  // データ不足: セッション1回だけ
  {
    const rows = [conclusionRow("d1", "2026-06-01", 9, stOf(3, 0, 0))];
    const c = core.todayConclusion(rows);
    assertEqual(c.kind, "few", "single session gives 'few' conclusion");
    assert(c.text.length > 0, "few conclusion has text");
    assertEqual(core.todayConclusion([]).kind, "few", "empty rows also give 'few' conclusion");
  }

  // 良いケース: グルーピングが締まってきていて（RMS改善）、かつ中心はほぼ合っている
  // → 平均点も横ばいなら「グルーピング安定」の一言（中心オフセット無し版）になる
  {
    const rows = [
      conclusionRow("g1", "2026-05-01", 8.5, stOf(4.0, 0.1, 0.1)),
      conclusionRow("g2", "2026-05-15", 8.5, stOf(3.8, 0.1, 0.1)),
      conclusionRow("g3", "2026-06-01", 8.5, stOf(3.4, 0.1, 0.1)), // avgRr(3.73) - latestRr(3.4) >= 0.3
    ];
    const c = core.todayConclusion(rows);
    assertEqual(
      c.kind,
      "grouping-tight",
      "tight grouping with centered shots gives grouping-tight",
    );
    assert(c.text.includes("安定"), "grouping-tight text mentions stability");
  }

  // 良いケース+中心ズレ: グルーピングは締まっているが中心が上に寄っている
  // → 「上下を直せば伸びる」系の一言（グルーピング良好+中心オフセット優先）
  {
    const rows = [
      conclusionRow("o1", "2026-05-01", 8.5, stOf(4.0, 0.1, 0.1)),
      conclusionRow("o2", "2026-05-15", 8.5, stOf(3.8, 0.1, 0.1)),
      conclusionRow("o3", "2026-06-01", 8.5, stOf(3.4, 0.1, 1.5)), // my=1.5cm >= OFFSET_THRESHOLD
    ];
    const c = core.todayConclusion(rows);
    assertEqual(
      c.kind,
      "grouping-tight-offcenter",
      "tight grouping + off-center gives combined conclusion",
    );
    assert(c.text.includes("上下"), "off-center text names the axis (up/down)");
    assert(c.text.includes("上"), "off-center text names the direction");
  }

  // 悪いケース: 平均点が下降トレンド（移動平均が下がり続けている）
  {
    const rows = [
      conclusionRow("t1", "2026-05-01", 9.5, stOf(5, 0, 0)),
      conclusionRow("t2", "2026-05-08", 9.3, stOf(5, 0, 0)),
      conclusionRow("t3", "2026-05-15", 8.8, stOf(5, 0, 0)),
      conclusionRow("t4", "2026-05-22", 8.2, stOf(5, 0, 0)),
      conclusionRow("t5", "2026-05-29", 7.5, stOf(5, 0, 0)),
      conclusionRow("t6", "2026-06-05", 6.8, stOf(5, 0, 0)),
    ];
    const c = core.todayConclusion(rows);
    assertEqual(c.kind, "trend-down", "declining moving average gives trend-down");
    assert(c.text.length > 0, "trend-down conclusion has text");
  }

  // 悪いケース側の対称: 平均点が上昇トレンド
  {
    const rows = [
      conclusionRow("u1", "2026-05-01", 6.8, stOf(5, 0, 0)),
      conclusionRow("u2", "2026-05-08", 7.5, stOf(5, 0, 0)),
      conclusionRow("u3", "2026-05-15", 8.2, stOf(5, 0, 0)),
      conclusionRow("u4", "2026-05-22", 8.8, stOf(5, 0, 0)),
      conclusionRow("u5", "2026-05-29", 9.3, stOf(5, 0, 0)),
      conclusionRow("u6", "2026-06-05", 9.5, stOf(5, 0, 0)),
    ];
    const c = core.todayConclusion(rows);
    assertEqual(c.kind, "trend-up", "rising moving average gives trend-up");
  }

  // rows に st の無い行（未スコア）が混ざっても落ちないこと
  {
    const rows = [
      { id: "x1", date: "2026-05-01", n: 0, avg: null, total: 0, st: null },
      conclusionRow("x2", "2026-05-01", 8.5, stOf(4, 0, 0)),
      conclusionRow("x3", "2026-06-01", 8.5, stOf(4, 0, 0)),
    ];
    const c = core.todayConclusion(rows);
    assert(c && typeof c.text === "string", "unscored rows are filtered out without throwing");
  }
}

// Build Week growth coach: fixed-day windows, explainable dashboard and suggestions
{
  const rows = [
    {
      id: "g1",
      date: "2026-06-01",
      n: 6,
      total: 48,
      avg: 8,
      st: { rr: 5, sx: 2, sy: 4, confidence: 0.7 },
    },
    {
      id: "g2",
      date: "2026-06-25",
      n: 12,
      total: 102,
      avg: 8.5,
      st: { rr: 4, sx: 2, sy: 3, confidence: 0.8 },
    },
    {
      id: "g3",
      date: "2026-07-02",
      n: 18,
      total: 162,
      avg: 9,
      st: { rr: 3, sx: 1.5, sy: 3.5, confidence: 0.9 },
    },
  ];
  assertEqual(
    core.filterAnalysisRows(rows, { period: "7d", today: "2026-07-03" }).length,
    1,
    "7-day filter",
  );
  assertEqual(
    core.filterAnalysisRows(rows, { period: "30d", today: "2026-07-03" }).length,
    2,
    "30-day filter",
  );
  assertEqual(
    core.filterAnalysisRows(rows, { period: "90d", today: "2026-07-03" }).length,
    3,
    "90-day filter",
  );
  const dash = core.growthDashboard(rows, "2026-07-03");
  assertEqual(dash.lastPracticeDate, "2026-07-02", "dashboard last practice");
  assertEqual(dash.weekSessions, 1, "dashboard week sessions");
  assertEqual(dash.weekArrows, 18, "dashboard week arrows");
  assertClose(dash.scoreDelta, 0.5, 1e-9, "dashboard score delta");
  assertClose(dash.groupingDelta, -1, 1e-9, "dashboard grouping delta; negative is tighter");
  assert(
    dash.confidence.value > 0 && dash.confidence.value <= 1,
    "dashboard confidence is bounded",
  );
  const suggestions = core.nextPracticeSuggestions(rows, "2026-07-03");
  assert(suggestions.length >= 1 && suggestions.length <= 3, "one to three suggestions");
  assert(
    suggestions.every((s) => s.title && s.reason),
    "every suggestion explains its reason",
  );
  assert(
    suggestions.some((s) => s.id === "vertical-spread"),
    "vertical spread produces a reproducible suggestion",
  );
  assertEqual(
    core.nextPracticeSuggestions([], "2026-07-03")[0].id,
    "collect-baseline",
    "empty data requests a baseline",
  );
}

console.log("Analysis core characterization checks OK");
