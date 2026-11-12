"use strict";
/* グルーピング統計 grouping-v3 の検証（docs/design/grouping-stats-v3.md §8）。
   2 変量正規のモンテカルロで、A（全射）・B（外れ値候補を除く）・C（再重み付け MCD）の偏り・区間の被覆・
   誤除外率・検出力・崩壊点・入力順不変・決定性・アフィン不変・縮退・速度・サイト判定の第 1 種の過誤を確かめる。
   乱数は xoshiro128**（splitmix32 でシード）と Marsaglia の極座標法。シードは項目ごとに固定。 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const scoringSrc = fs.readFileSync(path.join(root, "scripts", "20-scoring.js"), "utf8");
const analysisSrc = fs.readFileSync(path.join(root, "scripts", "40-analysis-physics.js"), "utf8");
function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  if (a < 0 || b <= a) throw new Error(`Missing section ${start} .. ${end}`);
  return source.slice(a, b);
}
const api = new Function(
  `${scoringSrc}
${section(analysisSrc, "function sightDecision(", "function adviceModel(")}
return {robustStats, legacyRobustStats, sightStats, xoshiro128ss, sightDecision, MCD_TABLE_N};`,
)();

let failures = 0;
function check(ok, label, detail) {
  if (!ok) {
    failures++;
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}
function rngNormal(seed) {
  const rng = api.xoshiro128ss(seed);
  let spare = null;
  return function () {
    if (spare != null) {
      const v = spare;
      spare = null;
      return v;
    }
    for (;;) {
      const u = 2 * rng() - 1;
      const v = 2 * rng() - 1;
      const s = u * u + v * v;
      if (s > 0 && s < 1) {
        const f = Math.sqrt((-2 * Math.log(s)) / s);
        spare = v * f;
        return u * f;
      }
    }
  };
}
/* 形: 標準偏差 (s1, s2) を角度 deg だけ回転、cm 単位 */
const SHAPES = [
  { name: "円 5cm", s1: 5, s2: 5, deg: 0 },
  { name: "楕円 10x5cm", s1: 10, s2: 5, deg: 0 },
  { name: "楕円 20x5cm・30°", s1: 20, s2: 5, deg: 30 },
];
function draw(gauss, shape, n) {
  const c = Math.cos((shape.deg * Math.PI) / 180);
  const s = Math.sin((shape.deg * Math.PI) / 180);
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = gauss() * shape.s1;
    const b = gauss() * shape.s2;
    pts[i] = { x: a * c - b * s, y: a * s + b * c };
  }
  return pts;
}
const trSigma = (shape) => shape.s1 * shape.s1 + shape.s2 * shape.s2;
const pct = (v) => `${(v * 100).toFixed(2)}%`;

/* ---------- A・B・C の偏り、区間の被覆、誤除外率 ---------- */
const onGrid = new Set(api.MCD_TABLE_N);
for (const shape of SHAPES) {
  for (const n of [6, 12, 36, 72, 33, 100]) {
    const trials = n <= 36 ? 20000 : 6000;
    const gauss = rngNormal(1000 * n + shape.s1 * 7 + shape.deg);
    let sumA = 0;
    let sumB = 0;
    let sumC = 0;
    let cC = 0;
    let cover = 0;
    let ciN = 0;
    let anyFlag = 0;
    const a2 = [];
    const c2 = [];
    const truth = Math.sqrt(trSigma(shape));
    for (let t = 0; t < trials; t++) {
      const st = api.robustStats(draw(gauss, shape, n));
      sumA += st.rr * st.rr;
      sumB += st.excl.rr * st.excl.rr;
      if (st.excluded.length) anyFlag++;
      if (st.robust) {
        sumC += st.robust.rr * st.robust.rr;
        cC++;
        a2.push(st.rr * st.rr);
        c2.push(st.robust.rr * st.robust.rr);
      }
      if (st.rrCi) {
        ciN++;
        if (st.rrCi.lo <= truth && truth <= st.rrCi.hi) cover++;
      }
    }
    const tr = trSigma(shape);
    const biasA = sumA / trials / tr;
    const biasB = sumB / trials / tr;
    const biasC = sumC / cC / tr;
    const coverage = cover / ciN;
    const flagRate = anyFlag / trials;
    const variance = (v) => {
      const m = v.reduce((x, y) => x + y, 0) / v.length;
      return v.reduce((x, y) => x + (y - m) * (y - m), 0) / (v.length - 1);
    };
    const varRatio = variance(c2) / variance(a2);
    const cTol = onGrid.has(n) && shape.s1 === shape.s2 ? 0.03 : 0.05;
    const tag = `${shape.name} n=${n}`;
    check(Math.abs(biasA - 1) <= 0.015, `A bias ${tag}`, biasA.toFixed(4));
    check(Math.abs(biasC - 1) <= cTol, `C bias ${tag}`, biasC.toFixed(4));
    check(biasB >= 0.98, `B bias ${tag}`, biasB.toFixed(4));
    check(flagRate <= 0.02, `B false flag ${tag}`, pct(flagRate));
    check(varRatio <= 2.5, `C/A variance ${tag}`, varRatio.toFixed(2));
    check(
      n === 6 ? coverage >= 0.9 && coverage <= 0.975 : coverage >= 0.93 && coverage <= 0.97,
      `A CI coverage ${tag}`,
      pct(coverage),
    );
    console.log(
      `${tag}: A ${biasA.toFixed(4)} B ${biasB.toFixed(4)} C ${biasC.toFixed(4)} 区間被覆 ${pct(coverage)} 誤除外 ${pct(flagRate)} Var(C²)/Var(A²) ${varRatio.toFixed(2)}`,
    );
  }
}

/* ---------- 検出力と巻き添え（σ=5cm の円、外れ矢は 8σ = 40cm） ---------- */
function powerRun(n, flyers, seed) {
  const gauss = rngNormal(seed);
  const trials = 2000;
  let caught = 0;
  let swamped = 0;
  for (let t = 0; t < trials; t++) {
    const pts = draw(gauss, SHAPES[0], n - flyers);
    const bad = [];
    for (let j = 0; j < flyers; j++) {
      const p = { x: 40 + gauss() * 0.5, y: gauss() * 0.5 };
      bad.push(p);
      pts.push(p);
    }
    const st = api.robustStats(pts);
    const flagged = new Set(st.excluded);
    if (bad.every((p) => flagged.has(p))) caught++;
    if (st.excluded.some((p) => !bad.includes(p))) swamped++;
  }
  return { power: caught / trials, swamp: swamped / trials };
}
for (const [n, flyers, min] of [
  [12, 1, 0.85],
  [24, 1, 0.97],
  [12, 3, 0.6],
  [24, 3, 0.95],
]) {
  const r = powerRun(n, flyers, 77 + n * 10 + flyers);
  check(r.power >= min, `power n=${n} flyers=${flyers}`, pct(r.power));
  check(r.swamp <= 0.05, `swamping n=${n} flyers=${flyers}`, pct(r.swamp));
  console.log(`検出力 n=${n} 外れ矢${flyers}本(8σ): ${pct(r.power)} / 巻き添え ${pct(r.swamp)}`);
}

/* ---------- 崩壊点: n=36 のうち 8 本が (40,40)±0.5 ---------- */
{
  const gauss = rngNormal(4242);
  const trials = 500;
  let allFlagged = 0;
  let cRatioMax = 0;
  let aRatioMin = Infinity;
  for (let t = 0; t < trials; t++) {
    const clean = draw(gauss, SHAPES[0], 28);
    const cleanRr = api.robustStats(clean).rr;
    const bad = Array.from({ length: 8 }, () => ({ x: 40 + gauss() * 0.5, y: 40 + gauss() * 0.5 }));
    const st = api.robustStats([...clean, ...bad]);
    const flagged = new Set(st.excluded);
    if (bad.every((p) => flagged.has(p))) allFlagged++;
    if (st.robust) cRatioMax = Math.max(cRatioMax, Math.abs(st.robust.rr / cleanRr - 1));
    aRatioMin = Math.min(aRatioMin, st.rr / cleanRr);
  }
  check(allFlagged / trials >= 0.95, "breakdown: all 8 flagged", pct(allFlagged / trials));
  check(aRatioMin > 2, "breakdown: A grows", aRatioMin.toFixed(2));
  console.log(
    `崩壊点 n=36・8本が(40,40): 8本すべて除外 ${pct(allFlagged / trials)}、C と正常時の差の最大 ${pct(cRatioMax)}、A/正常 の最小 ${aRatioMin.toFixed(2)}`,
  );
  check(cRatioMax <= 0.5, "breakdown: C stays near the clean value (worst case)", pct(cRatioMax));
}
{
  /* C の正常時との差（平均）が 25% 以内 */
  const gauss = rngNormal(4343);
  let sum = 0;
  const trials = 500;
  for (let t = 0; t < trials; t++) {
    const clean = draw(gauss, SHAPES[0], 28);
    const bad = Array.from({ length: 8 }, () => ({ x: 40 + gauss() * 0.5, y: 40 + gauss() * 0.5 }));
    const st = api.robustStats([...clean, ...bad]);
    sum += st.robust ? st.robust.rr / Math.sqrt(trSigma(SHAPES[0])) : Infinity;
  }
  const ratio = sum / trials;
  check(Math.abs(ratio - 1) <= 0.25, "breakdown: C within 25% of the true RMS", ratio.toFixed(3));
}

/* ---------- 入力順不変・決定性・アフィン不変 ---------- */
{
  const gauss = rngNormal(9001);
  const rng = api.xoshiro128ss(9002);
  let mismatches = 0;
  for (let t = 0; t < 200; t++) {
    const n = 6 + (t % 40);
    const pts = draw(gauss, SHAPES[t % 3], n);
    if (t % 4 === 0) pts.push({ x: 60, y: -50 }, { x: 61, y: -50.5 });
    const base = api.robustStats(pts);
    const key = (st) =>
      st.excluded
        .map((p) => `${p.x},${p.y}`)
        .sort()
        .join("|");
    for (let k = 0; k < 5; k++) {
      const perm = pts.slice();
      for (let i = perm.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      const st = api.robustStats(perm);
      const same =
        key(st) === key(base) &&
        Math.abs(st.rr - base.rr) < 1e-9 &&
        Math.abs(st.excl.rr - base.excl.rr) < 1e-9 &&
        (st.robust == null) === (base.robust == null) &&
        (!st.robust || Math.abs(st.robust.rr - base.robust.rr) < 1e-9);
      if (!same) mismatches++;
    }
    const again = api.robustStats(pts);
    check(
      JSON.stringify({ e: again.excl.rr, r: again.robust && again.robust.rr, k: key(again) }) ===
        JSON.stringify({ e: base.excl.rr, r: base.robust && base.robust.rr, k: key(base) }),
      "determinism",
    );
    /* アフィン: x を 3 倍して 25° 回転しても、同じ矢が外れ値候補になる */
    const c = Math.cos(0.436);
    const s = Math.sin(0.436);
    const mapped = pts.map((p) => ({ x: 3 * p.x * c - p.y * s, y: 3 * p.x * s + p.y * c, src: p }));
    const stA = api.robustStats(mapped);
    const srcKey = stA.excluded
      .map((p) => `${p.src.x},${p.src.y}`)
      .sort()
      .join("|");
    check(srcKey === key(base), "affine invariance", `${srcKey} vs ${key(base)}`);
  }
  check(mismatches === 0, "order invariance", `${mismatches} mismatches`);
  console.log(`入力順不変: 200組×5通りの並べ替えで不一致 ${mismatches}`);
}

/* ---------- 縮退 ---------- */
{
  const same6 = Array.from({ length: 6 }, () => ({ x: 1, y: 2 }));
  const line12 = Array.from({ length: 12 }, (_, i) => ({ x: i, y: 2 * i + 1 }));
  const almost = [...Array.from({ length: 5 }, () => ({ x: 0, y: 0 })), { x: 3, y: 4 }];
  const three = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  for (const [name, pts] of [
    ["6 identical", same6],
    ["12 collinear", line12],
    ["5 identical + 1", almost],
    ["3 points", three],
  ]) {
    let st;
    try {
      st = api.robustStats(pts);
    } catch (e) {
      check(false, `degenerate ${name} throws`, e.message);
      continue;
    }
    check(
      st.robust === null && st.excluded.length === 0,
      `degenerate ${name}: no robust, no flags`,
    );
    check(Number.isFinite(st.rr) && Number.isFinite(st.mx), `degenerate ${name}: A finite`);
  }
}

/* ---------- 速度 ---------- */
{
  const gauss = rngNormal(31337);
  const time = (n, count) => {
    const sets = Array.from({ length: count }, () => draw(gauss, SHAPES[1], n));
    sets.slice(0, 20).forEach((p) => api.robustStats(p));
    const t0 = process.hrtime.bigint();
    sets.forEach((p) => api.robustStats(p));
    return Number(process.hrtime.bigint() - t0) / 1e6 / count;
  };
  const t72 = time(72, 300);
  const t144 = time(144, 200);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 3000; i++) api.robustStats(draw(gauss, SHAPES[0], 36));
  const t3000 = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(
    `速度: n=72 ${t72.toFixed(3)}ms, n=144 ${t144.toFixed(3)}ms, n=36×3000回 ${t3000.toFixed(0)}ms`,
  );
  /* CI の機械差を見込んで設計値（0.25ms / 0.6ms / 600ms）の 4 倍を上限にする */
  check(t72 <= 1.0 && t144 <= 2.4 && t3000 <= 2400, "runtime budget");
}

/* ---------- サイト判定の第 1 種の過誤（中心が合った群れ、122cm 的） ---------- */
{
  const sess = { faceD: 122, faceType: "single" };
  for (const n of [6, 12, 36]) {
    const gauss = rngNormal(555 + n);
    let moved = 0;
    const trials = 6000;
    for (let t = 0; t < trials; t++) {
      const d = api.sightDecision(
        sess,
        api.robustStats(draw(gauss, { s1: 4, s2: 4, deg: 0 }, n)),
        null,
        null,
      );
      if (d.h.move || d.v.move) moved++;
    }
    check(moved / trials <= 0.065, `sight type I n=${n}`, pct(moved / trials));
    console.log(`サイト判定の誤った「動かす」 n=${n}: ${pct(moved / trials)}`);
  }
}

/* ---------- 旧方式（997db97 の出力をそのまま再現する） ---------- */
{
  const ring = Array.from({ length: 6 }, (_, j) => ({
    x: Math.cos((j / 6) * Math.PI * 2) * 3.9,
    y: Math.sin((j / 6) * Math.PI * 2) * 3.9,
  }));
  const P = (rows) => rows.map(([x, y]) => ({ x, y }));
  const orderCase = P([
    [0, 0],
    [0.5, 0.2],
    [-0.4, 0.3],
    [0.2, -0.5],
    [-0.3, -0.2],
    [0.4, 0.4],
    [-0.5, -0.4],
    [0.1, 0.5],
    [12, 0],
    [0, -13],
    [-11, 9],
  ]);
  const golden = [
    [
      "ring 3.9 (RMS collapses to 0)",
      ring,
      { mx: null, my: null, rr: 0, excluded: 0, method: "ellipse-biweight" },
    ],
    [
      "cluster + flyer",
      P([
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [40, 40],
      ]),
      { mx: 0, my: 0, rr: 1.1533619175, excluded: 1, method: "ellipse-biweight" },
    ],
    [
      "4 arrows",
      P([
        [0, 0],
        [1, 0.5],
        [-0.5, 1],
        [0.3, -0.8],
      ]),
      { mx: 0.2, my: 0.175, rr: 0.8584142357, excluded: 0, method: "simple" },
    ],
    [
      "order case",
      orderCase,
      {
        mx: -0.0684326849,
        my: 0.0959806322,
        rr: 1.2234204454,
        excluded: 2,
        method: "ellipse-biweight",
      },
    ],
    [
      "order case reversed (different result: order dependence preserved)",
      orderCase.slice().reverse(),
      {
        mx: 0.0762936943,
        my: 0.0377270232,
        rr: 1.0670075559,
        excluded: 2,
        method: "ellipse-biweight",
      },
    ],
  ];
  for (const [name, pts, want] of golden) {
    const st = api.legacyRobustStats(pts);
    const close = (a, b) => b == null || Math.abs(a - b) < 1e-9;
    check(
      close(st.mx, want.mx) &&
        close(st.my, want.my) &&
        Math.abs(st.rr - want.rr) < 1e-9 &&
        st.excluded.length === want.excluded &&
        st.method === want.method,
      `legacy golden: ${name}`,
      JSON.stringify({ mx: st.mx, my: st.my, rr: st.rr, ex: st.excluded.length, m: st.method }),
    );
  }
}

if (failures) {
  console.error(`Grouping statistics checks FAILED (${failures})`);
  process.exitCode = 1;
} else {
  console.log("Grouping statistics checks OK (grouping-v3)");
}
