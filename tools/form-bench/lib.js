"use strict";
/* Shared helpers for the form-tracking benchmark: seeded random numbers, small 3D vector
   math, easing curves and order statistics. Node only, no dependencies. */

/* ---------- seeded random numbers ---------- */

/* FNV-1a 32-bit hash of a string. Used to derive independent random streams from one seed. */
function hash32(text) {
  let h = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/* mulberry32 generator. makeRng(seed, label) gives a stream that depends only on (seed, label),
   so adding draws in one part of the simulator never changes the numbers another part sees. */
function makeRng(seed, label) {
  let a = hash32(`${seed}|${label || ""}`) || 0x9e3779b9;
  let spare = null;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    uniform: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    normal(mu, sd) {
      let z;
      if (spare != null) {
        z = spare;
        spare = null;
      } else {
        let u = 0;
        while (u <= 1e-12) u = next();
        const v = next();
        const r = Math.sqrt(-2 * Math.log(u));
        z = r * Math.cos(2 * Math.PI * v);
        spare = r * Math.sin(2 * Math.PI * v);
      }
      return (mu || 0) + (sd == null ? 1 : sd) * z;
    },
    /* normal clipped to [lo, hi] by resampling (falls back to clamping) */
    normalIn(mu, sd, lo, hi) {
      for (let i = 0; i < 16; i++) {
        const x = rng.normal(mu, sd);
        if (x >= lo && x <= hi) return x;
      }
      return Math.max(lo, Math.min(hi, mu));
    },
    /* exponential waiting time with the given rate (events per unit time) */
    expo: (rate) => (rate > 0 ? -Math.log(1 - next()) / rate : Infinity),
    fork: (sub) => makeRng(seed, `${label || ""}/${sub}`),
  };
  return rng;
}

/* ---------- 3D vectors (plain arrays [x, y, z]) ---------- */

const V = {
  v: (x, y, z) => [x, y, z],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  /* a + b*s */
  addm: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm(a) {
    const l = Math.hypot(a[0], a[1], a[2]);
    return l < 1e-12 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k],
  /* sum of scaled vectors: comb([v1, s1], [v2, s2], ...) */
  comb(...terms) {
    const out = [0, 0, 0];
    for (const [v, s] of terms) {
      out[0] += v[0] * s;
      out[1] += v[1] * s;
      out[2] += v[2] * s;
    }
    return out;
  },
  /* interior angle at b (degrees) between b->a and b->c */
  angleDeg(a, b, c) {
    const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const w = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
    const lu = Math.hypot(u[0], u[1], u[2]);
    const lw = Math.hypot(w[0], w[1], w[2]);
    if (lu < 1e-12 || lw < 1e-12) return null;
    const c0 = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (lu * lw);
    return (Math.acos(Math.max(-1, Math.min(1, c0))) * 180) / Math.PI;
  },
};

/* interior angle at b in 2D (degrees); points are {x, y} */
function angle2d(a, b, c) {
  const ux = a.x - b.x,
    uy = a.y - b.y,
    wx = c.x - b.x,
    wy = c.y - b.y;
  const lu = Math.hypot(ux, uy),
    lw = Math.hypot(wx, wy);
  if (lu < 1e-9 || lw < 1e-9) return null;
  const c0 = (ux * wx + uy * wy) / (lu * lw);
  return (Math.acos(Math.max(-1, Math.min(1, c0))) * 180) / Math.PI;
}

/* ---------- easing (u in [0,1] -> [0,1]) ---------- */

const clamp01 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);
const EASE = {
  linear: (u) => clamp01(u),
  /* minimum-jerk point-to-point profile (Flash & Hogan 1985): 10u^3 - 15u^4 + 6u^5 */
  minjerk(u) {
    const x = clamp01(u);
    return x * x * x * (10 + x * (-15 + 6 * x));
  },
  smooth(u) {
    const x = clamp01(u);
    return x * x * (3 - 2 * x);
  },
  /* critically damped step response 1-(1+k u)e^{-k u}, normalised so that ease(1) = 1.
     Velocity is zero at u = 0 and peaks at u = 1/k. Used for the release and the bow reaction. */
  damped(u, k) {
    const x = clamp01(u);
    const kk = k > 0 ? k : 8;
    const f = (s) => 1 - (1 + kk * s) * Math.exp(-kk * s);
    return f(x) / f(1);
  },
};

/* ---------- order statistics ---------- */

function finite(values) {
  return (values || []).filter((v) => typeof v === "number" && Number.isFinite(v));
}
function quantile(values, q) {
  const a = finite(values).sort((x, y) => x - y);
  if (!a.length) return null;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos),
    hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}
const median = (values) => quantile(values, 0.5);
function mean(values) {
  const a = finite(values);
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
}

const DEG = Math.PI / 180;

module.exports = {
  hash32,
  makeRng,
  V,
  angle2d,
  EASE,
  clamp01,
  finite,
  quantile,
  median,
  mean,
  DEG,
};
