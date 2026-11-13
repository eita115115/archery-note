"use strict";
/* 記録タブの待機画面と今日の結果の見本データ（すべて架空）。
   70m・122cm的・72射（ラウンド 70m72）を 7 回（うち 11/4 は点数だけ）、18m・40cm的・60射を 2 回。
   位置と点数は決まった乱数で作る。点数は保存値として扱い、検査側は保存値から期待値を数える。 */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function gauss(r) {
  let u = 0;
  while (!u) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
function score(x, y, faceD) {
  const w = faceD / 20,
    d = Math.max(0, Math.hypot(x, y) - 0.285);
  if (d <= w / 2) return { s: 10, X: true };
  const s = 11 - Math.ceil(d / w - 1e-9);
  return { s: Math.max(0, Math.min(10, s)), X: false };
}
function session(id, date, dist, faceD, sigma, ends, per, seed, extra) {
  const r = rng(seed);
  const e = [];
  for (let i = 0; i < ends; i++) {
    const end = [];
    for (let j = 0; j < per; j++) {
      const x = +(0.4 + gauss(r) * sigma).toFixed(2),
        y = +(0.6 + gauss(r) * sigma).toFixed(2);
      end.push({ x, y, ...score(x, y, faceD) });
    }
    e.push(end);
  }
  return Object.assign(
    {
      id,
      date,
      setupId: "s1",
      dist,
      faceD,
      faceType: "single",
      round: dist === 70 ? "70m72" : "18m60",
      perEnd: per,
      arrowR: 0.285,
      sightV: "5.2",
      sightH: "0",
      wx: "晴れ",
      note: "",
      windDir: "",
      windSpeed: "",
      purpose: "practice",
      ends: e,
    },
    extra || {},
  );
}
function homeResultDb(opts) {
  const o = opts || {};
  const sigmas = [9.6, 8.6, 10.2, 9.0, 9.6, 9.1, 9.0];
  const sessions = [
    "2026-10-03",
    "2026-10-10",
    "2026-10-14",
    "2026-10-21",
    "2026-10-28",
    "2026-11-04",
    "2026-11-10",
  ].map((d, i) =>
    session(
      "p" + i,
      d,
      70,
      122,
      sigmas[i],
      12,
      6,
      100 + i,
      i === 6 ? { note: "架空のメモ。3エンド目で引き手の肘が下がりました。" } : {},
    ),
  );
  const p5 = sessions[5];
  p5.inputMode = "score";
  p5.wx = "雨";
  p5.note = "雨のため点数だけ記録。";
  p5.ends = p5.ends.map((e) => e.map((a) => ({ s: a.s, X: a.X, src: "key" })));
  sessions.push(session("i0", "2026-11-01", 18, 40, 1.9, 20, 3, 900, { wx: "室内" }));
  sessions.push(
    session("i1", "2026-11-07", 18, 40, 1.8, 20, 3, 901, { wx: "室内", setupId: "s2" }),
  );
  /* 保存の並びは日付順にしない（待機画面は日付で並べ直す） */
  const db = {
    schema: 5,
    setups: [
      { id: "s1", name: "架空のリカーブ", arrowDia: "5.7" },
      { id: "s2", name: "架空のインドア用", arrowDia: "9.3" },
    ],
    sightMarks: [
      { id: "m1", setupId: "s1", dist: 70, v: "5.20", h: "0", date: "2026-10-28", ts: 1 },
    ],
    sessions,
    trash: [],
    formAnalyses: [],
    customRounds: [],
    settings: {
      eyeSight: 850,
      theme: o.theme || "light",
      onboardingSeen: true,
      activeGuideSeen: true,
      lastInputMode: "target",
      featureHints: {
        gearSetup: true,
        practiceDays: true,
        analysis: true,
        sightAdjust: true,
        formTracking: true,
        addToHome: true,
      },
    },
    active: null,
  };
  if (o.empty) {
    db.sessions = [];
    db.setups = [];
    db.sightMarks = [];
  }
  if (o.gamification)
    db.settings.gamification = {
      enabled: true,
      practiceDays: [2, 4, 6],
      goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
      backfilledAt: null,
    };
  return db;
}
module.exports = { homeResultDb };
