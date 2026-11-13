"use strict";
/* 座標のない矢（点数だけの入力・「M 位置なし」）の回帰検査。docs/design/v5/design.md 4.3・5章。
   1. 座標のある矢だけの記録は、統計・サイト判断・CSV・集計の結果が段 3 の前と1バイトも変わらない
      （固定の見本データの出力を SHA-256 にして、段 3 の変更前のコードで作った値と比べる）。
   2. 座標のない矢は合計・本数・平均・10/X の数に入り、統計・着弾中心・サイト判断・CSV の group 列・
      実寸の再採点には入らない（座標を作らない、NaN を出さない）。
   node tools/check-coordless.js --print で 1 の値を表示する。 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, "scripts", file), "utf8");
function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + 1);
  if (a < 0 || b <= a) throw new Error(`Missing section ${start} .. ${end}`);
  return source.slice(a, b);
}
const view = read("50-record-view.js");
const hist = read("60-history-sight-view.js");

function makeLocalStorageShim() {
  const values = new Map();
  return {
    getItem: (k) => (values.has(k) ? values.get(k) : null),
    setItem: (k, v) => void values.set(k, String(v)),
    removeItem: (k) => void values.delete(k),
  };
}

/* 段 3 の変更前（commit 8de7271）のコードで、下の見本データから作った値 */
const GOLDEN_SHA256 = "e62c17de074e134c582e9070e3a7557e6916e5c3eaf09b5461d08b60c88722c0";

function loadApp(fixtureDb) {
  return new Function(
    "fixtureDb",
    "localStorage",
    `${read("10-storage-native.js")}
${read("20-scoring.js")}
${read("40-analysis-physics.js")}
${read("45-analysis-core.js")}
${read("48-gamification.js")}
${read("49-todays-result.js")}
${read("70-gear-settings.js")}
${section(view, "function sessionArrows(", "const BADGE_ICONS")}
${section(view, "function scoreSortedArrows(", "/* ============ 記録中（没入画面）")}
${section(view, "function distanceLabel(", "function historyAnalysisDetailsHtml(")}
${section(view, "function sightValueText(", "function sightSummaryHtml(")}
${section(view, "function groupingMetricNumber(", "/* end: grouping rows")}
${section(hist, "function sessionGroupPoint(", "function historyDistanceLabel(")}
${section(hist, "function legacyRescoreHtml(", "function openHistDetail(")}
db = normalizeDb(fixtureDb);
return {db, normalizeDb, scoreAt, sessionMetrics, sessionQuality, adviceFor, personalModel, sessionRescore,
  sessionGroupPoint, groupSummaryHtml, shapeNote, conditionInsights, judgementFor, nextActionPlan, sessionsCsv,
  buildAnalysisRows, growthDashboard, personalBests, todayConclusion, conditionSplit, reasonBreakdown,
  aggregateByPeriod, isWindy, computeTodaysResult, regressionAdvice, computePersonalPhysicsCalibration,
  sightInterp, gamGroupRms, gamAllArrows, arrowMetaSummaryHtml, scorecardHtml, curRowHtml, groupingSessionRow,
  legacyRescoreHtml, trashItem, sessionScoringRadius,
  arrowHasPos: typeof arrowHasPos==="function"?arrowHasPos:null};`,
  )(JSON.parse(JSON.stringify(fixtureDb)), makeLocalStorageShim());
}

/* ---------- 決定的な見本データ ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  const u = Math.max(rng(), 1e-12),
    v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const bare = loadApp({ sessions: [], setups: [] });
function makeSession(id, date, o) {
  const rng = mulberry32(o.seed);
  const ends = [];
  const reasons = ["リリース", "押し手", "風"];
  for (let e = 0; e < o.ends; e++) {
    const end = [];
    for (let i = 0; i < o.per; i++) {
      const x = +(o.cx + gauss(rng) * o.sd).toFixed(2) || 0;
      const y = +(o.cy + gauss(rng) * o.sd * (o.tall || 1)).toFixed(2) || 0;
      const a = Object.assign({ x, y }, bare.scoreAt(x, y, o.faceD, o.faceType, o.scoreR));
      if (o.faceType === "triple") a.spot = i % 3;
      if ((e * o.per + i) % 7 === 3) a.reason = reasons[(e + i) % 3];
      if ((e * o.per + i) % 5 === 1) a.no = String(((e + i) % 6) + 1);
      end.push(a);
    }
    ends.push(end);
  }
  const s = {
    id,
    date,
    setupId: o.setupId === undefined ? "setup-a" : o.setupId,
    dist: o.dist,
    faceD: o.faceD,
    faceType: o.faceType,
    perEnd: o.per,
    sightV: o.sightV || "",
    sightH: o.sightH || "",
    wx: o.wx || "",
    note: o.note || "",
    windDir: o.windDir || "",
    windSpeed: o.windSpeed || "",
    round: o.round || "free",
    purpose: "practice",
    ends,
  };
  if (!o.legacy) s.arrowR = 0.285;
  return s;
}
function makeFixture() {
  const out = 70,
    f = { dist: out, faceD: 122, faceType: "single", per: 6, ends: 6, scoreR: 0.285 };
  const sessions = [
    makeSession("s01", "2026-09-01", { ...f, seed: 11, cx: 2.1, cy: -3.4, sd: 9, legacy: true, scoreR: 122 / 85 + 122 / 1200 }),
    makeSession("s02", "2026-09-05", { ...f, seed: 12, cx: 1.4, cy: -2.2, sd: 8.5, legacy: true, scoreR: 122 / 85 + 122 / 1200, sightV: "5.2", sightH: "1" }),
    makeSession("s03", "2026-09-12", { ...f, seed: 13, cx: 3.2, cy: -4.1, sd: 8, sightV: "5.2", sightH: "1" }),
    makeSession("s04", "2026-09-19", { ...f, seed: 14, cx: 2.6, cy: -3.8, sd: 7.6, sightV: "5.2", sightH: "1", ends: 12, round: "70m72" }),
    makeSession("s05", "2026-09-26", { ...f, seed: 15, cx: 2.9, cy: -3.1, sd: 7.4, sightV: "5.2", sightH: "1", windDir: "左から", windSpeed: "3.5", wx: "風 強" }),
    makeSession("s06", "2026-10-03", { ...f, seed: 16, cx: -0.4, cy: 0.8, sd: 7, sightV: "5.4", sightH: "1.5", tall: 1.8 }),
    makeSession("s07", "2026-10-10", { ...f, seed: 17, cx: 0.2, cy: 0.3, sd: 6.6, sightV: "5.4", sightH: "1.5", ends: 12, round: "70m72" }),
    makeSession("s08", "2026-10-17", { dist: 18, faceD: 40, faceType: "triple", per: 3, ends: 10, scoreR: 0.285, seed: 18, cx: 0.3, cy: -0.4, sd: 2.2, sightV: "1.1", round: "18m60" }),
    makeSession("s09", "2026-10-24", { dist: 18, faceD: 40, faceType: "single", per: 3, ends: 10, scoreR: 0.285, seed: 19, cx: -0.5, cy: 0.2, sd: 2.4, sightV: "1.1" }),
    makeSession("s10", "2026-10-31", { dist: 30, faceD: 80, faceType: "field", per: 3, ends: 8, scoreR: 0.285, seed: 20, cx: 1.1, cy: 1.9, sd: 6, setupId: null }),
    makeSession("s11", "2026-11-03", { ...f, seed: 21, cx: 0.9, cy: -0.6, sd: 6.4, sightV: "5.4", sightH: "1.5", ends: 1, per: 2 }),
    makeSession("s12", "2026-11-07", { dist: 50, faceD: 80, faceType: "single", per: 6, ends: 6, scoreR: 0.285, seed: 22, cx: -1.8, cy: 2.4, sd: 5.2, sightV: "3.6", sightH: "0.5" }),
    makeSession("s13", "2026-11-10", { ...f, seed: 23, cx: 0.5, cy: -0.9, sd: 6.2, sightV: "5.4", sightH: "1.5" }),
  ];
  return {
    schema: 5,
    setups: [
      {
        id: "setup-a",
        name: "Fixture recurve",
        bow: "Recurve",
        arrowDia: "5.7",
        arrowSpeed: "195",
        arrowWeight: "320",
        history: [],
      },
    ],
    sightMarks: [
      { id: "m1", setupId: "setup-a", dist: 30, v: "2.1", h: "0", date: "2026-08-20", ts: 1 },
      { id: "m2", setupId: "setup-a", dist: 50, v: "3.6", h: "0.5", date: "2026-08-21", ts: 2 },
      { id: "m3", setupId: "setup-a", dist: 70, v: "5.2", h: "1", date: "2026-08-22", ts: 3 },
      { id: "m4", setupId: "setup-a", dist: 18, v: "1.1", h: "0", date: "2026-08-23", ts: 4 },
    ],
    sessions,
    trash: [],
    formAnalyses: [],
    customRounds: [],
    settings: { eyeSight: 850, theme: "light", onboardingSeen: true },
    active: null,
  };
}

/* 有限でない数は文字にして残す（JSON では null になって区別できないため） */
const jsonSafe = (k, v) => (typeof v === "number" && !Number.isFinite(v) ? `#${String(v)}` : v);
function stView(st) {
  if (!st) return null;
  const pick = (o) =>
    o && {
      n: o.n, mx: o.mx, my: o.my, sx: o.sx, sy: o.sy, cov: o.cov, rr: o.rr, corr: o.corr, major: o.major,
      minor: o.minor, angleDeg: o.angleDeg, df: o.df, seX: o.seX, seY: o.seY, ciX: o.ciX, ciY: o.ciY,
      total: o.total, method: o.method, confidence: o.confidence, nw: o.nw,
      used: (o.used || []).length, excluded: o.excluded || [],
    };
  return Object.assign(pick(st), { rrCi: st.rrCi, version: st.version, excl: pick(st.excl), robust: pick(st.robust) });
}
/* 1回ぶんの記録について、位置から計算する値をすべて集める */
function geometryView(app, s) {
  const setup = app.db.setups.find((x) => x.id === s.setupId);
  const m = app.sessionMetrics(s);
  const adv = app.adviceFor(s, setup);
  const q = app.sessionQuality(s, setup, m.st);
  return {
    st: stView(m.st),
    pts: m.pts,
    quality: { score: q.score, label: q.label, tone: q.tone, reasons: q.reasons },
    advice: adv && {
      lines: adv.lines,
      notes: adv.notes,
      confidence: adv.confidence,
      decision: adv.decision,
      personal: adv.personal,
      mm: [adv.traj.mmPerCmV, adv.traj.mmPerCmH, adv.traj.windDriftCm],
    },
    personal: app.personalModel(s, setup, m.st),
    judgement: app.judgementFor(adv, s),
    plan: app.nextActionPlan(s, adv, setup),
    groupHtml: app.groupSummaryHtml(m.st, { withConfidenceNote: true }),
    shape: app.shapeNote(m.st),
    conditions: app.conditionInsights(s, m.st, setup),
    gamRms: app.gamGroupRms(app.gamAllArrows(s)),
  };
}
function fullView(app) {
  const db = app.db;
  const rows = app.buildAnalysisRows(db.sessions, db.setups, app.sessionMetrics);
  const strip = (v) => JSON.parse(JSON.stringify(v, jsonSafe));
  return {
    csv: app.sessionsCsv(),
    sessions: db.sessions.map((s) => {
      const m = app.sessionMetrics(s);
      return {
        id: s.id,
        total: m.total,
        avg: m.avg,
        arrows: m.all.length,
        geometry: geometryView(app, s),
        point: app.sessionGroupPoint(s),
        rescore: app.sessionRescore(s, 0.285),
        rescoreHtml: app.legacyRescoreHtml(s, db.setups.find((x) => x.id === s.setupId), m.total),
        meta: app.arrowMetaSummaryHtml(s),
        row: app.groupingSessionRow({ s }) && { ...app.groupingSessionRow({ s }), session: undefined },
      };
    }),
    growth: strip(app.growthDashboard(rows, "2026-11-12")),
    bests: strip(app.personalBests(rows)),
    conclusion: strip(app.todayConclusion(rows)),
    split: strip(app.conditionSplit(rows, app.isWindy)),
    reasons: app.reasonBreakdown(rows),
    weekly: strip(app.aggregateByPeriod(rows, "week")),
    todays: strip(
      app.computeTodaysResult(db.sessions, db.sessions[db.sessions.length - 1].id, app.sessionMetrics, {}),
    ),
    regression: [18, 30, 50, 70].map((d) => app.regressionAdvice("setup-a", d)),
    calibration: strip(app.computePersonalPhysicsCalibration("setup-a")),
    interp: strip(app.sightInterp("setup-a")),
  };
}
const digest = (v) => crypto.createHash("sha256").update(JSON.stringify(v, jsonSafe)).digest("hex");

const baseDb = makeFixture();
const baseApp = loadApp(baseDb);
const baseView = fullView(baseApp);
const baseDigest = digest(baseView);
if (process.argv.includes("--print")) {
  console.log(baseDigest);
  process.exit(0);
}

let failures = 0,
  checks = 0;
function check(ok, label, detail) {
  checks++;
  if (!ok) {
    failures++;
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}
const same = (a, b) => JSON.stringify(a, jsonSafe) === JSON.stringify(b, jsonSafe);
const noBadText = (text) => !/NaN|undefined|Infinity|\bnull\b/.test(String(text));

/* ---- 1. 座標のある矢だけの記録は段 3 の前と同じ ---- */
check(baseDigest === GOLDEN_SHA256, "positioned-only fixture is byte-identical to the pre-stage-3 output", baseDigest);
check(noBadText(baseView.csv), "fixture CSV has no NaN/undefined");

/* 座標のない矢の作り方: キーを持たない形（アプリが保存する形）と、null の形（JSON で NaN が null になった場合など） */
const key = (s, X) => ({ s, X: !!X, src: "key" });
const keyNull = (s, X) => ({ x: null, y: null, s, X: !!X, src: "key" });
const clone = (v) => JSON.parse(JSON.stringify(v));
const csvRows = (csv) => csv.replace(/^\ufeff/, "").split("\n");
const csvCells = (line) => line.slice(1, -1).split('","');
/* group_x_cm から excluded まで（10〜18）と、研究用の列（23〜）が位置から計算する列 */
const geometryCells = (line) => {
  const c = csvCells(line);
  return [...c.slice(10, 16), c[18], ...c.slice(23)];
};

/* ---- 2. 点数だけの記録を足しても、座標のある記録の結果は変わらない ---- */
{
  const db = clone(baseDb);
  const scoreOnly = (id, date, dist, faceD, faceType, per, vals) => ({
    id, date, setupId: "setup-a", dist, faceD, faceType, perEnd: per, arrowR: 0.285, inputMode: "score",
    sightV: "5.4", sightH: "1.5", wx: "", note: "", windDir: "", windSpeed: "", round: "free", purpose: "practice",
    ends: vals.map((end) => end.map((v) => (v === "X" ? key(10, true) : key(v)))),
  });
  db.sessions.splice(3, 0, scoreOnly("k01", "2026-09-15", 70, 122, "single", 6, [["X", 10, 9, 9, 8, 0], [9, 9, 8, 7, 7, 6]]));
  db.sessions.push(scoreOnly("k02", "2026-11-11", 70, 122, "single", 6, [[10, 9, 9, 8, 8, 7], ["X", "X", 9, 9, 8, 0]]));
  db.sessions.push(scoreOnly("k03", "2026-11-11", 18, 40, "triple", 3, [[10, 9, 9], ["X", 9, 0]]));
  const app = loadApp(db);
  const v = fullView(app);
  const baseById = new Map(baseView.sessions.map((s) => [s.id, s]));
  v.sessions.forEach((s) => {
    if (!baseById.has(s.id)) return;
    check(same(s, baseById.get(s.id)), `positioned session ${s.id} is unchanged when score-only sessions exist`);
  });
  const baseLines = csvRows(baseView.csv),
    lines = csvRows(v.csv);
  const keep = lines.filter((_, i) => i === 0 || !/^k0/.test(app.db.sessions[i - 1].id));
  check(same(keep, baseLines), "CSV rows of positioned sessions are byte-identical when score-only sessions exist");
  check(same(v.regression, baseView.regression), "sight regression ignores score-only sessions");
  check(same(v.calibration, baseView.calibration), "personal physics calibration ignores score-only sessions");
  check(same(v.interp, baseView.interp), "sight interpolation ignores score-only sessions");
  check(noBadText(v.csv), "CSV with score-only sessions has no NaN/undefined");
  /* 点数だけの記録そのもの */
  const k = v.sessions.find((s) => s.id === "k01");
  check(k.total === 92 && k.arrows === 12 && Math.abs(k.avg - 92 / 12) < 1e-12, "score-only session counts total, arrows and average", JSON.stringify([k.total, k.arrows, k.avg]));
  check(k.geometry.st === null && k.geometry.pts.length === 0, "score-only session has no grouping statistics");
  check(k.geometry.advice === null && k.geometry.judgement === null, "score-only session gives no sight advice");
  check(k.geometry.groupHtml === "" && k.geometry.shape === "", "score-only session renders no grouping numbers");
  check(k.point === null && k.row === null && k.geometry.gamRms === null, "score-only session has no grouping point / row / RMS");
  check(k.rescore.scored === 0 && k.rescore.skipped === 12 && k.rescore.total === 92 && k.rescore.changed === 0, "rescore keeps stored scores of a score-only session", JSON.stringify(k.rescore));
  check(k.geometry.quality.label === "低" && noBadText(JSON.stringify(k.geometry.quality)), "score-only session quality is the low/no-data value without NaN");
  const kLine = csvCells(lines[app.db.sessions.findIndex((s) => s.id === "k01") + 1]);
  check(kLine[5] === "12" && kLine[6] === "92" && kLine[7] === (92 / 12).toFixed(3) && kLine[8] === "1" && kLine[9] === "2", "CSV score columns of a score-only session", kLine.slice(5, 10).join("|"));
  check(geometryCells(lines[app.db.sessions.findIndex((s) => s.id === "k01") + 1]).every((c) => c === ""), "CSV geometry columns of a score-only session are empty");
  const tr = app.computeTodaysResult(app.db.sessions, "k02", app.sessionMetrics, {});
  check(!/NaN|undefined/.test(JSON.stringify(tr, jsonSafe)), "today's result of a score-only session has no NaN", JSON.stringify(tr, jsonSafe).slice(0, 300));
  check(tr.stabilityTrend && tr.stabilityTrend.available === false, "today's result stability is unavailable for a score-only session");
  check(/M/.test(app.scorecardHtml(app.db.sessions.find((s) => s.id === "k01"), { final: true })), "scorecard renders a score-only session");
}

/* ---- 3. 座標のある矢とない矢が混ざった記録 ---- */
{
  const db = clone(baseDb);
  const s = db.sessions.find((x) => x.id === "s07");
  const positionedTotal = s.ends.flat().reduce((n, a) => n + a.s, 0);
  /* エンドの途中に「M 位置なし」、末尾にキー入力、null 座標の形も混ぜる */
  s.ends[0].splice(2, 0, key(0));
  s.ends[1].push(keyNull(9));
  s.ends[4].unshift(Object.assign(key(10, true), { reason: "風", no: "3" }));
  s.ends.push([key(8), keyNull(0), key(7)]);
  const added = 0 + 9 + 10 + 8 + 0 + 7;
  const app = loadApp(db);
  const v = fullView(app);
  const mixed = v.sessions.find((x) => x.id === "s07"),
    base = baseView.sessions.find((x) => x.id === "s07");
  check(mixed.total === positionedTotal + added && mixed.arrows === base.arrows + 6, "mixed session counts every arrow in the total", `${mixed.total} ${mixed.arrows}`);
  check(same(mixed.geometry.st, base.geometry.st), "mixed session statistics equal the positioned-only statistics");
  check(same(mixed.geometry.pts, base.geometry.pts), "mixed session uses only positioned points");
  check(same(mixed.geometry.advice, base.geometry.advice), "mixed session sight advice equals the positioned-only advice");
  check(same(mixed.geometry.quality, base.geometry.quality), "mixed session decision quality equals the positioned-only value");
  check(same(mixed.geometry.groupHtml, base.geometry.groupHtml) && same(mixed.geometry.shape, base.geometry.shape), "mixed session grouping text equals the positioned-only text");
  check(mixed.geometry.gamRms === base.geometry.gamRms, "mixed session gamification RMS equals the positioned-only value");
  check(mixed.point && same({ ...mixed.point, total: 0, avg: 0 }, { ...base.point, total: 0, avg: 0 }), "mixed session grouping point equals the positioned-only point");
  check(mixed.rescore.scored === base.rescore.scored && mixed.rescore.skipped === 6 && mixed.rescore.total === base.rescore.total + added && mixed.rescore.changed === base.rescore.changed, "rescore of a mixed session keeps stored scores of coordinate-less arrows", JSON.stringify(mixed.rescore));
  const i = app.db.sessions.findIndex((x) => x.id === "s07") + 1;
  const line = csvRows(v.csv)[i],
    baseLine = csvRows(baseView.csv)[i];
  check(same(geometryCells(line), geometryCells(baseLine)), "CSV geometry columns of a mixed session equal the positioned-only columns");
  const c = csvCells(line);
  check(c[5] === String(base.arrows + 6) && c[6] === String(positionedTotal + added), "CSV arrows/total of a mixed session include coordinate-less arrows", c.slice(5, 8).join("|"));
  check(noBadText(v.csv), "CSV of a mixed session has no NaN/undefined");
  /* ほかの記録（同条件の個人モデルを含む）に影響しない */
  v.sessions.forEach((x) => {
    if (x.id === "s07") return;
    const b = baseView.sessions.find((y) => y.id === x.id);
    check(same(x.geometry.st, b.geometry.st) && same(x.geometry.advice && x.geometry.advice.decision, b.geometry.advice && b.geometry.advice.decision), `session ${x.id} statistics and sight decision are unchanged by a mixed session`);
  });
  /* 理由の集計: 本数には入るが、ずれの平均は位置のある矢だけ */
  const wind = v.reasons.items.find((r) => r.reason === "風"),
    baseWind = baseView.reasons.items.find((r) => r.reason === "風");
  check(wind.count === baseWind.count + 1, "reason breakdown counts a tagged coordinate-less arrow");
  check(Math.abs(wind.mx - baseWind.mx) < 1e-12 && Math.abs(wind.my - baseWind.my) < 1e-12, "reason breakdown offset uses positioned arrows only", `${wind.mx} ${baseWind.mx}`);
  check(noBadText(mixed.meta), "arrow-number summary has no NaN", mixed.meta);
  /* スコア表と枠 */
  const sess = app.db.sessions.find((x) => x.id === "s07");
  const card = app.scorecardHtml(sess, { final: true });
  check(noBadText(card) && card.includes(`>${positionedTotal + added}<`), "scorecard total of a mixed session includes coordinate-less arrows");
  const slots = app.curRowHtml(sess.ends[0], 6, 1, -1, { faceType: "single" });
  check((slots.match(/class="nopos"/g) || []).length === 1, "current-end slots mark the coordinate-less arrow");
}

/* ---- 4. 位置のある矢が足りない記録（2本だけ）と、三つ目的・フィールド的 ---- */
{
  const db = clone(baseDb);
  const s = db.sessions.find((x) => x.id === "s13");
  const flat = s.ends.flat();
  s.ends = [[flat[0], flat[1], key(9), key(9), key(8), key(0)], [key(10, true), key(9), keyNull(8), key(7), key(7), key(6)]];
  const t = db.sessions.find((x) => x.id === "s08");
  t.ends.forEach((end) => end.push(Object.assign(key(0), { spot: 1 })));
  const f = db.sessions.find((x) => x.id === "s10");
  f.ends[0].push(key(6), key(0));
  const app = loadApp(db);
  const v = fullView(app);
  const few = v.sessions.find((x) => x.id === "s13");
  check(few.geometry.st && few.geometry.st.n === 2 && few.geometry.pts.length === 2, "two positioned arrows give n=2 statistics");
  check(few.geometry.advice === null && few.point === null && few.row === null, "two positioned arrows give no sight advice or grouping row");
  check(noBadText(few.geometry.groupHtml) && noBadText(JSON.stringify(few.geometry.quality)), "two positioned arrows render without NaN", few.geometry.groupHtml);
  const tri = v.sessions.find((x) => x.id === "s08"),
    triBase = baseView.sessions.find((x) => x.id === "s08");
  check(same(tri.geometry.st, triBase.geometry.st) && tri.total === triBase.total && tri.arrows === triBase.arrows + 10, "triple face: coordinate-less M counts as an arrow and leaves statistics unchanged");
  const fld = v.sessions.find((x) => x.id === "s10"),
    fldBase = baseView.sessions.find((x) => x.id === "s10");
  check(same(fld.geometry.st, fldBase.geometry.st) && fld.total === fldBase.total + 6, "field face: key scores count and leave statistics unchanged");
  check(noBadText(v.csv), "CSV has no NaN/undefined with few positioned arrows");
}

/* ---- 5. 手で直した点数（manual）と再採点 ---- */
{
  const db = clone(baseDb);
  const s = db.sessions.find((x) => x.id === "s01"); /* 旧判定の記録 */
  const a = s.ends[0][0];
  const stored = a.s;
  const before = baseView.sessions.find((x) => x.id === "s01");
  a.auto = { s: a.s, X: !!a.X };
  a.s = stored === 10 ? 9 : stored + 1;
  a.X = false;
  a.manual = true;
  const app = loadApp(db);
  const v = fullView(app);
  const after = v.sessions.find((x) => x.id === "s01");
  check(after.total === before.total + (a.s - stored), "manual override changes the stored total");
  check(same(after.geometry.st, before.geometry.st), "manual override keeps the arrow position in the statistics");
  check(after.rescore.skipped === 1 && after.rescore.scored === before.rescore.scored - 1, "rescore keeps a manually overridden score", JSON.stringify(after.rescore));
  const real = app.scoreAt(a.x, a.y, s.faceD, s.faceType, 0.285).s;
  check(after.rescore.total === before.rescore.total - real + a.s, "rescore total uses the manual score for the overridden arrow", `${after.rescore.total} ${before.rescore.total} ${real} ${a.s}`);
  const card = app.scorecardHtml(app.db.sessions.find((x) => x.id === "s01"), { final: true });
  check(/class="man"[^>]*aria-label="手で修正"/.test(card), "scorecard marks a manually overridden arrow");
}

/* ---- 6. 保存・読み込み・ゴミ箱で、座標のない矢が消えたり座標を作られたりしない ---- */
{
  const db = clone(baseDb);
  db.sessions.push({
    id: "k09", date: "2026-11-12", setupId: "setup-a", dist: 70, faceD: 122, faceType: "single", perEnd: 6, arrowR: 0.285,
    inputMode: "score", round: "free",
    ends: [[key(10, true), keyNull(9), { s: "8", src: "key" }, { x: 1.5, y: -2, s: 9, X: false, manual: true, auto: { s: 8, X: false } }]],
  });
  db.active = { id: "act", date: "2026-11-12", dist: 70, faceD: 122, faceType: "single", perEnd: 6, arrowR: 0.285, inputMode: "score", ends: [[key(9)]], cur: [key(0), keyNull(7)] };
  db.settings.lastInputMode = "score";
  let app = loadApp(db);
  for (let round = 0; round < 3; round++) app = loadApp(JSON.parse(JSON.stringify(app.db)));
  const s = app.db.sessions.find((x) => x.id === "k09");
  const [a0, a1, a2, a3] = s.ends[0];
  check(s.ends[0].length === 4 && s.inputMode === "score", "score-only session survives normalize + JSON round-trips");
  check(!("x" in a0) && !("y" in a0) && a0.s === 10 && a0.X === true && a0.src === "key", "key arrow keeps its shape (no x/y keys are added)", JSON.stringify(a0));
  check(a1.x === null && a1.y === null && a1.s === 9, "null coordinates stay null (never repaired to 0)", JSON.stringify(a1));
  check(a2.s === 8 && !("x" in a2), "string score of a key arrow becomes a number without adding coordinates", JSON.stringify(a2));
  check(a3.manual === true && a3.auto && a3.auto.s === 8 && a3.x === 1.5 && a3.s === 9, "manual override and its automatic score survive", JSON.stringify(a3));
  check(app.db.active.cur.length === 2 && !("x" in app.db.active.cur[0]) && app.db.active.cur[1].x === null && app.db.active.inputMode === "score", "active score-mode session survives");
  check(app.db.settings.lastInputMode === "score", "settings.lastInputMode survives");
  check(loadApp({ sessions: [], setups: [], settings: { lastInputMode: "<b>" } }).db.settings.lastInputMode === "target", "invalid lastInputMode falls back to target");
  check(loadApp({ sessions: [], setups: [] }).db.settings.lastInputMode === "target", "lastInputMode defaults to target");
  /* ゴミ箱へ移して戻しても同じ */
  app.trashItem("session", "k09", s);
  const back = loadApp(JSON.parse(JSON.stringify(app.db))).db.trash.find((t) => t.data && t.data.id === "k09");
  check(back && same(back.data.ends, s.ends), "trash keeps coordinate-less arrows unchanged");
  if (app.arrowHasPos) {
    const has = app.arrowHasPos;
    check(has({ x: 0, y: 0 }) && has({ x: "1.2", y: "-3" }) && has({ x: -0, y: 5 }), "arrowHasPos accepts numbers and numeric strings");
    check(![{}, { x: null, y: null }, { x: 1 }, { x: 1, y: null }, { x: NaN, y: 0 }, { x: "", y: "" }, { x: " ", y: 1 }, { x: "abc", y: 1 }, null, undefined].some(has), "arrowHasPos rejects missing, null, NaN, blank and non-numeric coordinates");
  } else check(false, "arrowHasPos is defined");
}

if (failures) {
  console.error(`check-coordless: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`check-coordless: ${checks} checks passed`);
