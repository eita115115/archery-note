/* 下書き解析器を、作者自身の合成データで試す（独立したベンチマークの代わりではない）。
   node docs/design/form-v2/sketch/sim-sketch.js
   2D の射手（射線に平行な面、単位 m）を作り、向き・画面の形・雑音・欠測を変えて analyze() に渡す。 */
"use strict";
const { analyze, compareShots } = require("./analyze-sketch.js");

function rng(seed) { // xoshiro128**
  let s = [seed >>> 0, 0x9e3779b9, 0x243f6a88, 0xb7e15162];
  const rotl = (x, k) => (x << k) | (x >>> (32 - k));
  const next = () => {
    const r = (rotl((s[1] * 5) >>> 0, 7) * 9) >>> 0, t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11);
    return r / 4294967296;
  };
  for (let i = 0; i < 20; i++) next();
  const g = () => { let u, v, q; do { u = next() * 2 - 1; v = next() * 2 - 1; q = u * u + v * v; } while (q >= 1 || q === 0); return u * Math.sqrt((-2 * Math.log(q)) / q); };
  return { u: next, g };
}
const mj = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (10 - 15 * x + 6 * x * x)); // 最小躍度
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/* 体（右利き、x = 的の向き、y = 上、m）。胴の長さ 0.5 m */
const BODY = { bHip: [0.15, 1.0], dHip: [-0.15, 1.0], bSh: [0.19, 1.5], dSh: [-0.19, 1.5], nose: [0.07, 1.68] };
const POSE = {
  rest: { bWr: [0.33, 1.02], dWr: [0.13, 1.04] },
  setup: { bWr: [0.77, 1.5], dWr: [0.55, 1.5] },
  anchor: { bWr: [0.79, 1.52], dWr: [0.06, 1.56] },
};
const elbow = (sh, wr, bend, up) => { // 肩と手首から肘を作る（bend = 張り出し m）
  const mx = (sh[0] + wr[0]) / 2, my = (sh[1] + wr[1]) / 2, dx = wr[0] - sh[0], dy = wr[1] - sh[1], l = Math.hypot(dx, dy) || 1;
  return [mx - (dy / l) * bend * up, my + (dx / l) * bend * up];
};

/* 台本: events = [{kind:'shot'|'letdown', hold, drawT, back, bowDrop, follow, anchorDy}] */
function script(events, r) {
  const segs = [];
  let t = 1500 + r.u() * 500;
  const truth = [];
  for (const ev of events) {
    const A = { bWr: POSE.anchor.bWr.slice(), dWr: [POSE.anchor.dWr[0] + (ev.anchorDx || 0), POSE.anchor.dWr[1] + (ev.anchorDy || 0)] };
    const t0 = t, tUp = t0 + 900, tDraw0 = tUp + 500, tAnch = tDraw0 + ev.drawT, tRel = tAnch + ev.hold;
    const back = ev.back === undefined ? 0.09 : ev.back;
    const F = { dWr: [A.dWr[0] - back, A.dWr[1] + 0.01], bWr: [A.bWr[0] + 0.02, A.bWr[1] - (ev.bowDrop || 0.01)] };
    const follow = ev.follow || 900;
    segs.push((tt) => {
      if (tt < t0) return null;
      if (tt < tUp) { const k = mj((tt - t0) / 900); return { bWr: lerp(POSE.rest.bWr, POSE.setup.bWr, k), dWr: lerp(POSE.rest.dWr, POSE.setup.dWr, k) }; }
      if (tt < tDraw0) return POSE.setup;
      if (tt < tAnch) { const k = mj((tt - tDraw0) / ev.drawT); return { bWr: lerp(POSE.setup.bWr, A.bWr, k), dWr: lerp(POSE.setup.dWr, A.dWr, k) }; }
      if (tt < tRel) { const k = (tt - tAnch) / ev.hold; return { bWr: A.bWr, dWr: [A.dWr[0] - 0.004 * k + (ev.creep || 0) * Math.max(0, k - 0.6) / 0.4, A.dWr[1]] }; }
      if (ev.kind === "shot") {
        if (tt < tRel + follow) { const k = mj((tt - tRel) / 70), kb = mj((tt - tRel) / 250); return { dWr: lerp(A.dWr, F.dWr, k), bWr: lerp(A.bWr, F.bWr, kb) }; }
        if (tt < tRel + follow + 1100) { const k = mj((tt - tRel - follow) / 1100); return { dWr: lerp(F.dWr, POSE.rest.dWr, k), bWr: lerp(F.bWr, POSE.rest.bWr, k) }; }
        return undefined;
      }
      const ld = ev.ldT || 1200;
      if (tt < tRel + ld) { const k = mj((tt - tRel) / ld); return { dWr: lerp(A.dWr, POSE.setup.dWr, k), bWr: lerp(A.bWr, POSE.setup.bWr, k) }; }
      if (tt < tRel + ld + 1000) { const k = mj((tt - tRel - ld) / 1000); return { dWr: lerp(POSE.setup.dWr, POSE.rest.dWr, k), bWr: lerp(POSE.setup.bWr, POSE.rest.bWr, k) }; }
      return undefined;
    });
    // アンカーの定義: 引き終わりに、引き手の速さが胴の 20%/秒（0.1 m/s）を下回った時刻（最小躍度の式から）
    let kA = 1; const dist = Math.hypot(POSE.setup.dWr[0] - A.dWr[0], POSE.setup.dWr[1] - A.dWr[1]);
    while (kA > 0.5 && (30 * kA * kA * (1 - kA) * (1 - kA) * dist) / (ev.drawT / 1000) < 0.1) kA -= 0.001;
    const tAnchDef = tDraw0 + ev.drawT * kA;
    truth.push({ kind: ev.kind, releaseMs: tRel, anchorMs: tAnchDef, hold: tRel - tAnchDef });
    t = tRel + (ev.kind === "shot" ? follow + 1100 : (ev.ldT || 1200) + 1000) + 2500 + r.u() * 2500;
  }
  return { segs, truth, endMs: t + 1000 };
}

function simulate(o) {
  const r = rng(o.seed || 1), sc = script(o.events, r);
  const fps = o.fps || 30, w = o.w || 1280, h = o.h || 720, yaw = ((o.yaw || 0) * Math.PI) / 180;
  const pxPerM = o.pxPerM || (h > w ? 440 : 340), sigma = (o.sigma === undefined ? 0.006 : o.sigma), left = o.handedness === "left", mirror = o.back ? -1 : 1;
  const names = ["nose", "bSh", "dSh", "bEl", "dEl", "bWr", "dWr", "bHip", "dHip"];
  const idx = left ? { nose: 0, bSh: 12, dSh: 11, bEl: 14, dEl: 13, bWr: 16, dWr: 15, bHip: 24, dHip: 23 } : { nose: 0, bSh: 11, dSh: 12, bEl: 13, dEl: 14, bWr: 15, dWr: 16, bHip: 23, dHip: 24 };
  const ar = {}; names.forEach((n) => (ar[n] = [0, 0]));
  const frames = [];
  let seg = 0, tremPh = r.u() * 6;
  for (let k = 0, t = 0; t < sc.endMs; k++) {
    t = (k * 1000) / fps + (r.u() - 0.5) * 6;
    if (o.dropRate && r.u() < o.dropRate) continue;
    let hands;
    for (;;) { const v = seg < sc.segs.length ? sc.segs[seg](t) : null; if (v === undefined) { seg++; continue; } hands = v || POSE.rest; break; }
    if (o.walkOff && t > o.walkOff[0] && t < o.walkOff[1]) { frames.push({ tMs: t, landmarks: null }); continue; }
    const sway = 0.004 * Math.sin(t / 900 + tremPh);
    const P = { ...BODY, bWr: hands.bWr, dWr: hands.dWr };
    P.bEl = elbow(P.bSh, P.bWr, 0.02, 1);
    P.dEl = (() => { // 引き手の肘: 上腕 0.3・前腕 0.27 の二関節。肘は肩の後ろ上
      const s = P.dSh, wv = P.dWr, d = Math.min(0.56, Math.hypot(wv[0] - s[0], wv[1] - s[1])), a = Math.acos(Math.min(1, Math.max(-1, (0.3 * 0.3 + d * d - 0.27 * 0.27) / (2 * 0.3 * d))));
      const base = Math.atan2(wv[1] - s[1], wv[0] - s[0]);
      return [s[0] + 0.3 * Math.cos(base + a), s[1] + 0.3 * Math.sin(base + a)];
    })();
    const lms = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }));
    const cur = sc.truth.find((tr) => t >= tr.anchorMs && t < tr.releaseMs), holdFrac = cur ? (t - cur.anchorMs) / (cur.releaseMs - cur.anchorMs) : -1;
    const inRel = sc.truth.some((tr) => tr.kind === "shot" && t >= tr.releaseMs && t < tr.releaseMs + (o.blurMs || 0));
    for (const n of names) {
      const ac = o.arCoef || 0.9, ag = Math.sqrt(1 - ac * ac) * sigma * 0.8; // ゆっくりしたずれ（AR(1)）
      ar[n][0] = ac * ar[n][0] + ag * r.g();
      ar[n][1] = ac * ar[n][1] + ag * r.g();
      let x = P[n][0] + sway + ar[n][0] + r.g() * sigma * 0.6, y = P[n][1] + ar[n][1] + r.g() * sigma * 0.6;
      if (o.spike && r.u() < o.spike) { x += r.g() * 0.08; y += r.g() * 0.08; }
      const xi = (left ? -1 : 1) * mirror * x * Math.cos(yaw) * pxPerM + w / 2, yi = h * 0.5 - (y - 1.3) * pxPerM;
      let vis = 0.92;
      if (n === "dWr" && inRel) vis = 0.1;
      if (o.occlude && o.occlude(n, t, holdFrac)) vis = 0.1;
      lms[idx[n]] = { x: xi / w, y: yi / h, z: 0, visibility: vis };
    }
    frames.push({ tMs: t, landmarks: lms });
  }
  return { frames, truth: sc.truth, opts: { frame: { w, h }, handedness: left ? "left" : "right", fps } };
}

function score(sim, res) {
  const used = new Set(), out = { tp: 0, fn: 0, fp: 0, ldOk: 0, ldAsShot: 0, relErr: [], holdErr: [] };
  for (const tr of sim.truth) {
    let best = -1, bd = 500;
    bd = tr.kind === "letdown" ? 1200 : 500;
    res.shots.forEach((s, i) => { const d = Math.abs(s.releaseMs - tr.releaseMs); if (!used.has(i) && d < bd) { bd = d; best = i; } });
    if (best < 0) { if (tr.kind === "shot") out.fn++; continue; }
    used.add(best);
    const s = res.shots[best];
    if (tr.kind === "shot") { if (s.kind === "shot") { out.tp++; out.relErr.push(s.releaseMs - tr.releaseMs); out.holdErr.push(s.holdMs - tr.hold); } else out.fn++; }
    else if (s.kind === "letdown") out.ldOk++; else out.ldAsShot++;
  }
  res.shots.forEach((s, i) => { if (!used.has(i) && s.kind === "shot") out.fp++; });
  return out;
}
const six = (r, extra) => {
  const ev = [];
  for (let i = 0; i < 6; i++) ev.push({ kind: "shot", hold: 2600 + r.u() * 1400, drawT: 1300 + r.u() * 500, back: 0.07 + r.u() * 0.05, anchorDy: r.g() * 0.004, follow: 800 + r.u() * 500 });
  if (extra) ev.splice(3, 0, { kind: "letdown", hold: 3500 + r.u() * 2000, drawT: 1500, ldT: 900 + r.u() * 900 });
  return ev;
};
const SCEN = {
  "横長・真横・30fps": {},
  "縦長・真横・30fps": { w: 720, h: 1280 },
  "縦長・左利き": { w: 720, h: 1280, handedness: "left" },
  "背中側（左右反転）": { back: true },
  "斜め 30°": { yaw: 30 },
  "斜め 50°": { yaw: 50 },
  "15fps": { fps: 15 },
  "60fps": { fps: 60 },
  "ランドマークのゆれ 2倍": { sigma: 0.012 },
  "射の合間に 8 秒いなくなる": { walkOff: [36000, 44000] },
  "弓手の手首が保持の後半で見えない": { occlude: (n, t, hold) => n === "bWr" && hold > 0.5 },
  "離れで手首が 100ms 消える": { blurMs: 100 },
  "コマ落ち 15%・外れ点 1%": { dropRate: 0.15, spike: 0.01 },
  "離れが弱い（後ろへ 1cm）": { weak: true },
  "速い引き戻し（0.6 秒）": { fastLd: true },
};
if (require.main === module) {
  const N = Number(process.argv[2]) || 40;
  console.log("場面 | 射 検出/真 | 余分 | 引き戻し 正/射に誤り/真 | 離れの誤差 中央値・95%絶対 (ms) | 保持の誤差 中央値・95%絶対 (ms)");
  for (const [name, o] of Object.entries(SCEN)) {
    const tot = { tp: 0, fn: 0, fp: 0, ldOk: 0, ldAsShot: 0, relErr: [], holdErr: [], ld: 0 };
    for (let s = 1; s <= N; s++) {
      const r = rng(1000 + s), ev = six(r, true);
      if (o.weak) ev.forEach((e) => { if (e.kind === "shot") e.back = 0.01; });
      if (o.fastLd) ev.forEach((e) => { if (e.kind === "letdown") e.ldT = 600; });
      const sim = simulate({ ...o, seed: s, events: ev }), res = analyze(sim.frames, sim.opts), sc = score(sim, res);
      for (const k of ["tp", "fn", "fp", "ldOk", "ldAsShot"]) tot[k] += sc[k];
      tot.relErr.push(...sc.relErr); tot.holdErr.push(...sc.holdErr); tot.ld++;
    }
    const q = (a, p) => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : NaN; };
    const abs = (a) => a.map(Math.abs);
    console.log(`${name} | ${tot.tp}/${tot.tp + tot.fn} | ${tot.fp} | ${tot.ldOk}/${tot.ldAsShot}/${tot.ld} | ${q(tot.relErr, 0.5).toFixed(0)}・${q(abs(tot.relErr), 0.95).toFixed(0)} | ${q(tot.holdErr, 0.5).toFixed(0)}・${q(abs(tot.holdErr), 0.95).toFixed(0)}`);
  }
  // 違いの検出: 雑音だけのときに何か1つでも印が付く回の割合と、4射目のアンカーを下げたとき見つける割合
  const M = Number(process.argv[3]) || 200;
  for (const [label, extra] of [["ずれの相関 0.9（約0.3秒）", {}], ["ずれの相関 0.97（約1秒）", { arCoef: 0.97 }], ["ずれの相関 0.99（約3秒）", { arCoef: 0.99 }]]) {
    const hit = { 2: 0, 3: 0, 4: 0, 6: 0 };
    let fa = 0;
    for (let s = 1; s <= M; s++) {
      const r = rng(5000 + s), ev = six(r, false).map((e) => ({ ...e, anchorDy: 0 }));
      const a = simulate({ seed: s, events: ev, w: 720, h: 1280, ...extra });
      if (compareShots(analyze(a.frames, a.opts)).flags.length) fa++;
      for (const cm of [2, 3, 4, 6]) {
        ev[3].anchorDy = -cm / 100;
        const b = simulate({ seed: s, events: ev, w: 720, h: 1280, ...extra });
        if (compareShots(analyze(b.frames, b.opts)).flags.some((f) => f.shot === 3 && f.key === "ancY")) hit[cm]++;
      }
      ev[3].anchorDy = 0;
    }
    console.log(`違いの印（${label}）: 雑音だけで印が付いた回 ${fa}/${M}、4射目のアンカーを下げて見つけた回 2cm ${hit[2]} / 3cm ${hit[3]} / 4cm ${hit[4]} / 6cm ${hit[6]}（各 ${M} 回）`);
  }
}
module.exports = { simulate, score, rng, six, SCEN };
