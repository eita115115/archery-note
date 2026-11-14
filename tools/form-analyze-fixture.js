"use strict";
/* 射型の記録 v2 の解析器（scripts/44-form-analyze.js）を検査するための、小さな合成の射手。
   射線に平行な面の中の 2 次元の骨格（9 点）を、画素の座標で作る。乱数は種で決まる（Math.random を使わない）。
   独立したベンチマーク（tools/form-bench/）とは別物で、検査を数秒で終えるためのもの。現実の代わりではない。

   makeCapture({ seed, events, fps, torsoPx, sigma, ... }) -> { poses, truth, durationMs }
     poses = [{ tMs, pts: { 役割: [Xpx, Ypx] } | null, vis: { 役割: 0..1 } }]   画面の左上が原点、y は下向き
     truth = [{ kind, releaseMs, anchorMs, drawEndMs }]   anchorMs は algorithm.md 4.8 の定義（速さ 0.2 胴/秒）
   toFrames(poses, { w, h, handedness, mirror, scale, shiftMs, origin }) -> 解析器の入力（33 点の正規化座標） */

const ROLES = ["nose", "bSh", "dSh", "bEl", "dEl", "bWr", "dWr", "bHip", "dHip"];
const INDEX = {
  right: { nose: 0, bSh: 11, dSh: 12, bEl: 13, dEl: 14, bWr: 15, dWr: 16, bHip: 23, dHip: 24 },
  left: { nose: 0, bSh: 12, dSh: 11, bEl: 14, dEl: 13, bWr: 16, dWr: 15, bHip: 24, dHip: 23 },
};

function makeRng(seed) {
  let a = (seed >>> 0) + 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    let u, v, q;
    do {
      u = next() * 2 - 1;
      v = next() * 2 - 1;
      q = u * u + v * v;
    } while (q >= 1 || q === 0);
    return u * Math.sqrt((-2 * Math.log(q)) / q);
  };
  return { u: next, g: gauss, range: (lo, hi) => lo + (hi - lo) * next() };
}

const minJerk = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (10 - 15 * x + 6 * x * x));
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/* 体の単位（胴の長さ = 1、原点 = 両肩の中点、x = 弓の向き、y = 上） */
const BODY = { bSh: [0.35, 0], dSh: [-0.35, 0], bHip: [0.25, -1], dHip: [-0.25, -1], nose: [0.25, 0.3] };
const HANDS = {
  rest: { bWr: [0.5, -1.0], dWr: [-0.3, -0.95] },
  setup: { bWr: [1.35, 0.0], dWr: [0.85, -0.05] },
  anchor: { bWr: [1.4, 0.03], dWr: [-0.1, 0.05] },
  spread: { bWr: [1.45, 0.0], dWr: [-1.5, 0.0] },
};
function bowElbow(sh, wr) {
  const mx = (sh[0] + wr[0]) / 2, my = (sh[1] + wr[1]) / 2, dx = wr[0] - sh[0], dy = wr[1] - sh[1], l = Math.hypot(dx, dy) || 1;
  return [mx + (dy / l) * 0.04, my - (dx / l) * 0.04];
}
function drawElbow(sh, wr) {
  /* 上腕 0.62・前腕 0.5 の二関節。肘は肩と手首を結ぶ線の「後ろ・上」側 */
  const U = 0.62, F = 0.5, dx = wr[0] - sh[0], dy = wr[1] - sh[1], d = Math.min(U + F - 0.01, Math.max(0.15, Math.hypot(dx, dy)));
  const a = Math.acos(Math.max(-1, Math.min(1, (U * U + d * d - F * F) / (2 * U * d)))), base = Math.atan2(dy, dx);
  return [sh[0] + U * Math.cos(base + a), sh[1] + U * Math.sin(base + a)];
}

/* events = [{ kind: "shot" | "letdown" | "raise" | "spread", drawMs, holdMs, back, followMs, lowerMs, anchorDy, anchorDx, idleMs }] */
function makeCapture(o) {
  const opt = Object.assign({ seed: 1, fps: 30, torsoPx: 200, sigma: 0.012, arCoef: 0.9, jitterMs: 3, cx: 300, cy: 260, dropRate: 0 }, o || {});
  const r = makeRng(opt.seed), segs = [], truth = [];
  let t = 1200 + r.range(0, 400);
  for (const ev of opt.events || []) {
    const A = { bWr: HANDS.anchor.bWr.slice(), dWr: [HANDS.anchor.dWr[0] + (ev.anchorDx || 0), HANDS.anchor.dWr[1] + (ev.anchorDy || 0)] };
    const drawMs = ev.drawMs || 1500, holdMs = ev.holdMs === undefined ? 3000 : ev.holdMs, back = ev.back === undefined ? 0.3 : ev.back;
    const followMs = ev.followMs || 900, lowerMs = ev.lowerMs || 1200, ldMs = ev.letdownMs || 1200;
    const t0 = t, tUp = t0 + 900, tDraw = tUp + 400, tAnch = tDraw + drawMs, tRel = tAnch + holdMs;
    const Fw = { dWr: [A.dWr[0] - back, A.dWr[1] + 0.02], bWr: [A.bWr[0] + 0.03, A.bWr[1] - 0.06] };
    let tEnd;
    if (ev.kind === "raise" || ev.kind === "spread") {
      /* 弓手だけ上げる / 両腕を広げる: 射ではない */
      const P1 = ev.kind === "raise" ? { bWr: HANDS.setup.bWr, dWr: HANDS.rest.dWr } : HANDS.spread;
      tEnd = tUp + holdMs + lowerMs;
      segs.push((tt) => {
        if (tt < t0) return null;
        if (tt < tUp) return { bWr: lerp(HANDS.rest.bWr, P1.bWr, minJerk((tt - t0) / 900)), dWr: lerp(HANDS.rest.dWr, P1.dWr, minJerk((tt - t0) / 900)) };
        if (tt < tUp + holdMs) return P1;
        if (tt < tEnd) { const k = minJerk((tt - tUp - holdMs) / lowerMs); return { bWr: lerp(P1.bWr, HANDS.rest.bWr, k), dWr: lerp(P1.dWr, HANDS.rest.dWr, k) }; }
        return undefined;
      });
    } else {
      tEnd = ev.kind === "shot" ? tRel + followMs + lowerMs : tRel + ldMs + 1000;
      segs.push((tt) => {
        if (tt < t0) return null;
        if (tt < tUp) { const k = minJerk((tt - t0) / 900); return { bWr: lerp(HANDS.rest.bWr, HANDS.setup.bWr, k), dWr: lerp(HANDS.rest.dWr, HANDS.setup.dWr, k) }; }
        if (tt < tDraw) return HANDS.setup;
        if (tt < tAnch) { const k = minJerk((tt - tDraw) / drawMs); return { bWr: lerp(HANDS.setup.bWr, A.bWr, k), dWr: lerp(HANDS.setup.dWr, A.dWr, k) }; }
        if (tt < tRel) return { bWr: A.bWr, dWr: [A.dWr[0] - (0.01 * (tt - tAnch)) / holdMs, A.dWr[1]] };
        if (ev.kind === "shot") {
          const A1 = [A.dWr[0] - 0.01, A.dWr[1]];
          if (tt < tRel + followMs) return { dWr: lerp(A1, Fw.dWr, minJerk((tt - tRel) / 70)), bWr: lerp(A.bWr, Fw.bWr, minJerk((tt - tRel) / 300)) };
          if (tt < tEnd) { const k = minJerk((tt - tRel - followMs) / lowerMs); return { dWr: lerp(Fw.dWr, HANDS.rest.dWr, k), bWr: lerp(Fw.bWr, HANDS.rest.bWr, k) }; }
          return undefined;
        }
        if (tt < tRel + ldMs) { const k = minJerk((tt - tRel) / ldMs); return { dWr: lerp(A.dWr, HANDS.setup.dWr, k), bWr: lerp(A.bWr, HANDS.setup.bWr, k) }; }
        if (tt < tEnd) { const k = minJerk((tt - tRel - ldMs) / 1000); return { dWr: lerp(HANDS.setup.dWr, HANDS.rest.dWr, k), bWr: lerp(HANDS.setup.bWr, HANDS.rest.bWr, k) }; }
        return undefined;
      });
      /* アンカーの正解（4.8）: 引き終わりに、引き手の速さが 0.2 胴/秒を下回った時刻（最小躍度の式から） */
      const dist = Math.hypot(HANDS.setup.dWr[0] - A.dWr[0], HANDS.setup.dWr[1] - A.dWr[1]);
      let k = 1;
      while (k > 0.5 && (30 * k * k * (1 - k) * (1 - k) * dist) / (drawMs / 1000) < 0.2) k -= 0.001;
      truth.push({ kind: ev.kind, releaseMs: tRel, anchorMs: tDraw + drawMs * k, drawEndMs: tAnch, back, anchorDy: ev.anchorDy || 0 });
    }
    t = tEnd + (ev.idleMs === undefined ? r.range(2500, 4500) : ev.idleMs);
  }
  const durationMs = t + 800, poses = [], ar = {};
  for (const n of ROLES) ar[n] = [0, 0];
  const ag = Math.sqrt(1 - opt.arCoef * opt.arCoef) * opt.sigma * 0.8;
  let seg = 0;
  for (let k = 0; ; k++) {
    const tt = (k * 1000) / opt.fps + (opt.jitterMs ? (r.u() - 0.5) * 2 * opt.jitterMs : 0);
    if (tt >= durationMs) break;
    if (opt.dropRate && r.u() < opt.dropRate) continue;
    let hands;
    for (;;) {
      const v = seg < segs.length ? segs[seg](tt) : null;
      if (v === undefined) { seg++; continue; }
      hands = v || HANDS.rest;
      break;
    }
    const P = Object.assign({}, BODY, { bWr: hands.bWr, dWr: hands.dWr });
    P.bEl = bowElbow(P.bSh, P.bWr);
    P.dEl = drawElbow(P.dSh, P.dWr);
    const pts = {}, vis = {};
    for (const n of ROLES) {
      ar[n][0] = opt.arCoef * ar[n][0] + ag * r.g();
      ar[n][1] = opt.arCoef * ar[n][1] + ag * r.g();
      const x = P[n][0] + (opt.sigma ? ar[n][0] + r.g() * opt.sigma * 0.6 : 0), y = P[n][1] + (opt.sigma ? ar[n][1] + r.g() * opt.sigma * 0.6 : 0);
      pts[n] = [opt.cx + x * opt.torsoPx, opt.cy - y * opt.torsoPx];
      vis[n] = 0.92;
    }
    poses.push({ tMs: tt, pts, vis });
  }
  return { poses, truth, durationMs };
}

/* 画素の姿 → 解析器の入力。mirror = 左右を反転（handedness と一緒に使う）。scale・origin = origin を中心に拡大縮小。 */
function toFrames(poses, o) {
  const opt = Object.assign({ w: 1280, h: 720, handedness: "right", mirror: false, scale: 1, origin: [0, 0], shiftMs: 0, canvasW: 600 }, o || {});
  const idx = INDEX[opt.handedness === "left" ? "left" : "right"];
  return poses.map((p) => {
    if (!p.pts) return { tMs: p.tMs + opt.shiftMs, landmarks: null };
    const lms = [];
    for (let i = 0; i < 33; i++) lms.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.05 });
    for (const n of ROLES) {
      let X = opt.origin[0] + (p.pts[n][0] - opt.origin[0]) * opt.scale;
      const Y = opt.origin[1] + (p.pts[n][1] - opt.origin[1]) * opt.scale;
      if (opt.mirror) X = opt.canvasW - X;
      lms[idx[n]] = { x: X / opt.w, y: Y / opt.h, z: 0, visibility: p.vis[n] };
    }
    return { tMs: p.tMs + opt.shiftMs, landmarks: lms };
  });
}

module.exports = { ROLES, INDEX, makeRng, makeCapture, toFrames, minJerk };
