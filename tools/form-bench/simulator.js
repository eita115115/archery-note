"use strict";
/* Kinematic archer simulator for the form-tracking benchmark.

   A 3D stick figure with the 33 MediaPipe Pose landmark indices performs a practice session:
   shot cycles (stance -> reload -> set/raise -> draw -> anchor -> hold/aim with slow expansion ->
   release -> follow-through -> lower), optional let-downs, pauses, face-touch fidgets and walking
   out of frame to retrieve arrows. Everything is deterministic for a given (config, seed).

   World frame (metres, right-handed archer before mirroring): X points toward the target,
   Y runs along the shooting line, Z is up. The archer stands astride the shooting line with
   the chest facing -Y. A left-handed archer is the exact mirror image (x -> -x, left/right
   landmark labels swapped), so with the same seed both handednesses perform the same motion.

   Time is in milliseconds at the module boundary and in seconds inside the pose function.
   Parameter ranges and where they come from: README.md ("Parameters and sources"). */

const { makeRng, V, EASE, clamp01, DEG } = require("./lib");

/* MediaPipe Pose landmark indices (BlazePose 33-point topology). */
const LM = Object.freeze({
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
});
const LM_COUNT = 33;
const LR_PAIRS = Object.freeze([
  [1, 4],
  [2, 5],
  [3, 6],
  [7, 8],
  [9, 10],
  [11, 12],
  [13, 14],
  [15, 16],
  [17, 18],
  [19, 20],
  [21, 22],
  [23, 24],
  [25, 26],
  [27, 28],
  [29, 30],
  [31, 32],
]);
const SWAP_INDEX = (() => {
  const s = Array.from({ length: LM_COUNT }, (_, i) => i);
  for (const [a, b] of LR_PAIRS) {
    s[a] = b;
    s[b] = a;
  }
  return Object.freeze(s);
})();

/* Bow-side / draw-side landmark indices for a handedness (right-handed = bow in the left hand). */
function sideIndices(handedness) {
  const right = handedness !== "left";
  const L = { shoulder: 11, elbow: 13, wrist: 15, pinky: 17, index: 19, thumb: 21, hip: 23 };
  const R = { shoulder: 12, elbow: 14, wrist: 16, pinky: 18, index: 20, thumb: 22, hip: 24 };
  return right ? { bow: L, draw: R } : { bow: R, draw: L };
}

/* ---------- keyframed channels ---------- */

/* Scalar channel: value(t) interpolates between consecutive keys with the later key's easing.
   Keys must be appended in time order. */
class Track {
  constructor(v0) {
    this.keys = [{ t: 0, v: v0, ease: null }];
  }
  last() {
    return this.keys[this.keys.length - 1];
  }
  /* move from the held value at t0 to v at t1 */
  to(t0, t1, v, ease) {
    const last = this.last();
    if (t0 < last.t - 1e-9) throw new Error(`track key out of order (${t0} < ${last.t})`);
    if (t0 > last.t) this.keys.push({ t: t0, v: last.v, ease: null });
    if (t1 <= t0) {
      this.keys.push({ t: t0 + 1e-6, v, ease: { type: "linear" } });
    } else {
      this.keys.push({ t: t1, v, ease: ease || { type: "minjerk" } });
    }
  }
  at(t) {
    const k = this.keys;
    if (t >= k[k.length - 1].t) return k[k.length - 1].v;
    if (t <= k[0].t) return k[0].v;
    let lo = 0,
      hi = k.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (k[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = k[lo],
      b = k[hi];
    const u = (t - a.t) / (b.t - a.t);
    return a.v + (b.v - a.v) * easeValue(b.ease, u);
  }
}

function easeValue(ease, u) {
  if (!ease) return clamp01(u);
  if (ease.type === "damped") return EASE.damped(u, ease.k);
  if (ease.type === "linear") return EASE.linear(u);
  if (ease.type === "smooth") return EASE.smooth(u);
  return EASE.minjerk(u);
}

/* Draw-hand channel: keys carry a named target ("REST", "ANCHOR", ...). The hand position is the
   eased blend of the two targets, each evaluated with the body state at the current time, so
   targets that move with the body (string, anchor) stay attached to it. */
class HandTrack {
  constructor(target) {
    this.keys = [{ t: 0, target, ease: null }];
  }
  last() {
    return this.keys[this.keys.length - 1];
  }
  to(t0, t1, target, ease) {
    const last = this.last();
    if (t0 < last.t - 1e-9) throw new Error("hand key out of order");
    if (t0 > last.t) this.keys.push({ t: t0, target: last.target, ease: null });
    this.keys.push({ t: Math.max(t1, t0 + 1e-6), target, ease: ease || { type: "minjerk" } });
  }
  at(t) {
    const k = this.keys;
    if (t >= k[k.length - 1].t) {
      const z = k[k.length - 1].target;
      return { from: z, to: z, w: 1 };
    }
    let lo = 0,
      hi = k.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (k[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = k[lo],
      b = k[hi];
    return { from: a.target, to: b.target, w: easeValue(b.ease, (t - a.t) / (b.t - a.t)) };
  }
}

/* ---------- body ---------- */

/* Segment lengths as fractions of stature H: Winter (2009) Fig. 4.1 after Drillis & Contini (1966).
   Joint-centre widths (shoulder, hip) are assumptions: MediaPipe places the shoulder and hip
   points near the joint centres, narrower than the bi-acromial / bi-trochanteric widths. */
function makeBody(rng, opts) {
  const o = opts || {};
  const H = Number.isFinite(o.heightM) ? o.heightM : rng.uniform(1.58, 1.88);
  const g = () => 1 + rng.normalIn(0, 0.02, -0.05, 0.05);
  return {
    H,
    hipZ: 0.53 * H,
    torso: 0.288 * H * g(),
    shoulderHalf: 0.1 * H * g(),
    hipHalf: 0.066 * H * g(),
    upperArm: 0.186 * H * g(),
    forearm: 0.146 * H * g(),
    thigh: 0.247 * H,
    shank: 0.248 * H,
    ankleZ: 0.039 * H,
    neck: 0.03 * H,
    head: 0.085 * H,
    stanceHalf: 0.125 * H * g(),
    handBack: 0.075 * H, // string (finger hook) -> wrist along the arrow: palm + proximal phalanx (assumption)
    brace: 0.125 * H, // brace height ~ 22 cm for a 68-70" recurve (assumption)
  };
}

/* Two-bone IK: elbow position for shoulder S, wrist target W and a pole direction. If the wrist is
   out of reach it is pulled back onto the reachable sphere (the returned W is the real wrist). */
function ik2(S, W, a, b, pole) {
  let d = V.sub(W, S);
  let L = V.len(d);
  if (L < 1e-9) {
    d = [0, 0, -1];
    L = 1e-9;
  }
  const dir = V.mul(d, 1 / L);
  const maxL = (a + b) * 0.9995;
  const minL = Math.abs(a - b) * 1.0005 + 1e-6;
  let Wc = W;
  if (L > maxL) {
    L = maxL;
    Wc = V.addm(S, dir, L);
  } else if (L < minL) {
    L = minL;
    Wc = V.addm(S, dir, L);
  }
  const x = (a * a - b * b + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  let p = V.sub(pole, V.mul(dir, V.dot(pole, dir)));
  if (V.len(p) < 1e-6) p = V.cross(dir, Math.abs(dir[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]);
  p = V.norm(p);
  return { E: V.comb([S, 1], [dir, x], [p, h]), W: Wc };
}

function slerp(a, b, t) {
  const d = Math.max(-1, Math.min(1, V.dot(a, b)));
  const om = Math.acos(d);
  if (om < 1e-6) return V.lerp(a, b, t);
  const s = Math.sin(om);
  return V.comb([a, Math.sin((1 - t) * om) / s], [b, Math.sin(t * om) / s]);
}

/* ---------- session timeline ---------- */

const STRIDE_M = 1.4; // one gait cycle (two steps)
const WALK_SPEED = 1.3; // m/s, ordinary walking speed (assumption)
const WALK_DIST = 9; // m walked out of the shooting position: outside any camera framing used here

/* Per-shot channels: changed only while the bow is down, so a new value never jumps a pose. */
const SHOT_CHANNELS = [
  "bowElbowDeg",
  "elbowTilt",
  "aimElev",
  "anchorDf",
  "anchorDu",
  "anchorDr",
  "preDraw",
  "expansionM",
  "bowShUpM",
  "relBack",
  "relDown",
  "relOut",
  "reactFwd",
  "reactDrop",
  "headDx",
  "headDy",
  "headDz",
];

function sampleArcher(rng, H, cfg) {
  return {
    open: rng.uniform(0.04, 0.22), // chest opening toward the target (rad)
    lean: rng.uniform(0.0, 0.05), // forward trunk lean (rad)
    psi: rng.uniform(0.03, 0.09), // bow arm toe-in in the top view (rad)
    bowPoleDown: rng.uniform(0.3, 0.9), // how much the bow elbow bend points down vs outward
    headTurnMax: rng.uniform(0.92, 1.0),
    bowElbowMean: rng.uniform(167, 177),
    elbowTiltMean: rng.uniform(-0.05, 0.3), // draw elbow height (pole elevation, rad)
    aimElevMean: rng.uniform(0.0, 0.07),
    bowShUpMean: rng.uniform(0.0, 0.02),
    anchorSd: Number.isFinite(cfg.anchorSdM) ? cfg.anchorSdM : 0.004,
    relBackMean: rng.uniform(0.07, 0.12) * H,
    /* release time constant: peak draw-hand speed is reached after tau (s). With ~180 N of
       holding force acting on ~2.4 kg of hand+arm the initial acceleration is ~75 m/s^2, which
       for a 12-20 cm follow-through gives tau ~ 20-40 ms (assumption, see README). */
    tauMean: Number.isFinite(cfg.releaseTauS) ? cfg.releaseTauS : rng.uniform(0.02, 0.04),
    relScale: Number.isFinite(cfg.releaseScale) ? cfg.releaseScale : 1,
  };
}

function sampleShot(rng, archer, H, cfg) {
  const [d0, d1] = cfg.drawMs || [1000, 3000];
  const [h0, h1] = cfg.holdMs || [1500, 6000];
  const sd = archer.anchorSd;
  return {
    raiseMs: rng.uniform(900, 1600),
    settleMs: rng.uniform(200, 700),
    drawMs: rng.uniform(d0, d1),
    holdMs: rng.uniform(h0, h1),
    followMs: rng.uniform(...(cfg.followMs || [700, 1500])),
    lowerMs: rng.uniform(...(cfg.lowerMs || [1000, 1800])),
    releaseTau: Math.max(0.012, archer.tauMean + rng.normal(0, 0.004)), // s
    reactTau: rng.uniform(0.06, 0.12), // s
    ch: {
      bowElbowDeg: rng.normalIn(archer.bowElbowMean, 1.5, 160, 179.5),
      elbowTilt: archer.elbowTiltMean + rng.normal(0, 0.06),
      aimElev: archer.aimElevMean + rng.normal(0, 0.006),
      anchorDf: rng.normal(0, sd),
      anchorDu: rng.normal(0, sd),
      anchorDr: rng.normal(0, sd * 0.6),
      preDraw: rng.uniform(0.03, 0.09) * H,
      expansionM: rng.uniform(0.002, 0.006),
      bowShUpM: Math.max(0, archer.bowShUpMean + rng.normal(0, 0.004)),
      relBack: archer.relScale * Math.max(0.04 * H, archer.relBackMean + rng.normal(0, 0.012 * H)),
      relDown: rng.uniform(0.01, 0.06) * H,
      relOut: rng.uniform(-0.004, 0.012) * H,
      reactFwd: rng.uniform(0.01, 0.05),
      reactDrop: rng.uniform(0.02, 0.07),
      headDx: rng.normal(0, 0.004),
      headDy: rng.normal(0, 0.004),
      headDz: rng.normal(0, 0.003),
    },
  };
}

function buildTimeline(cfg, seed) {
  const rng = makeRng(seed, "motion");
  const body = makeBody(rng.fork("body"), { heightM: cfg.heightM });
  const H = body.H;
  const archer = sampleArcher(rng.fork("archer"), H, cfg);
  const shotRng = rng.fork("shots");
  const evRng = rng.fork("events");
  const reRng = cfg.reanchorProb > 0 ? rng.fork("reanchor") : null;
  const scriptRng = rng.fork("script");
  const first = sampleShot(shotRng, archer, H, cfg);
  const init = {
    rootX: 0,
    rootY: 0,
    yaw: 0,
    gait: 0,
    walkDist: 0,
    open: archer.open,
    lean: archer.lean,
    raise: 0,
    bowReact: 0,
    headTurn: 0.75,
    headDown: 0.18,
    shoulderUp: 0,
    drawRetract: 0,
    expand: 0,
    headDrift: 0,
    reanchor: 0, // 0..1 blend toward a re-anchoring offset during the hold
    reFwd: 0,
    reDown: 0,
    ...first.ch,
  };
  const ch = {};
  for (const k of Object.keys(init)) ch[k] = new Track(init[k]);
  const hand = new HandTrack("REST");
  let T = 0; // cursor, seconds
  const cycles = [];
  const intervals = [];
  const mark = (kind, t0, t1, extra) =>
    intervals.push({ kind, startMs: t0 * 1000, endMs: t1 * 1000, ...(extra || {}) });
  const move = (dur, values, handTarget, opts) => {
    const o = opts || {};
    const t0 = T,
      t1 = T + dur;
    for (const [k, v] of Object.entries(values || {})) ch[k].to(t0, t1, v, o.ease);
    if (handTarget) hand.to(t0, t1, handTarget, o.handEase || o.ease);
    T = t1;
    return [t0, t1];
  };
  const wait = (dur, kind, extra) => {
    if (kind) mark(kind, T, T + dur, extra);
    T += dur;
  };
  const setShotChannels = (shot) => {
    for (const k of SHOT_CHANNELS) ch[k].to(T, T + 0.6, shot.ch[k], { type: "smooth" });
  };

  const idle = (minMs, maxMs) => {
    const dur = evRng.uniform(minMs, maxMs) / 1000;
    if (cfg.fidgetProb > 0 && dur > 3 && evRng.chance(cfg.fidgetProb)) {
      const lead = evRng.uniform(0.3, dur - 2.8);
      wait(lead, "idle");
      const t0 = T;
      move(0.7, { headTurn: 0.6, headDown: 0.3 }, "FACE");
      wait(evRng.uniform(0.4, 1.0));
      move(0.7, { headTurn: 0.75, headDown: 0.18 }, "REST");
      mark("fidget", t0, T);
      const rest = Math.max(0, dur - (T - t0) - lead);
      if (rest > 0) wait(rest, "idle");
    } else {
      wait(dur, "idle");
    }
  };

  const reload = (shot) => {
    const t0 = T;
    setShotChannels(shot);
    move(evRng.uniform(0.7, 1.0), { headTurn: 0.35, headDown: 0.5 }, "QUIVER");
    wait(evRng.uniform(0.2, 0.4));
    move(evRng.uniform(0.8, 1.1), { raise: 0.22 }, "NOCK");
    wait(evRng.uniform(0.6, 1.4));
    mark("reload", t0, T);
  };

  /* One draw cycle. kind "shot" ends with a release, "letdown" with a slow return. */
  const drawCycle = (kind, shot, meta) => {
    const cyc = { kind, ...meta, index: cycles.length };
    const tSet = T;
    move(shot.raiseMs / 1000, { raise: 1, headTurn: archer.headTurnMax, headDown: 0.08 }, "STRING");
    wait(shot.settleMs / 1000);
    mark("raise", tSet, T);
    const tDraw = T;
    move(shot.drawMs / 1000, { shoulderUp: 1, drawRetract: 1 }, "ANCHOR");
    mark("draw", tDraw, T);
    const tAnchor = T;
    const holdS = (kind === "letdown" ? evRng.uniform(1000, 4000) : shot.holdMs) / 1000;
    move(holdS, { expand: 1 }, null, { ease: { type: "linear" } });
    ch.headDrift.to(tAnchor, tAnchor + holdS, 1, { type: "smooth" });
    mark("hold", tAnchor, T);
    /* re-anchoring: the hand creeps off the anchor (forward/down) and is pulled back, then the
       hold continues. Separate random stream, used only when enabled. */
    if (reRng && kind === "shot" && holdS > 1.4 && reRng.chance(cfg.reanchorProb)) {
      const out = reRng.uniform(0.2, 0.35),
        stay = reRng.uniform(0.15, 0.4),
        back = reRng.uniform(0.3, 0.5);
      const t0 = tAnchor + reRng.uniform(0.3, holdS - (out + stay + back) - 0.3);
      const fwd = reRng.uniform(0.015, 0.04),
        down = reRng.uniform(-0.01, 0.025);
      ch.reFwd.to(t0 - 0.01, t0, fwd, { type: "linear" });
      ch.reDown.to(t0 - 0.01, t0, down, { type: "linear" });
      ch.reanchor.to(t0, t0 + out, 1);
      ch.reanchor.to(t0 + out + stay, t0 + out + stay + back, 0);
      mark("reanchor", t0, t0 + out + stay + back);
      cyc.reanchor = {
        startMs: t0 * 1000,
        endMs: (t0 + out + stay + back) * 1000,
        fwdM: fwd,
        downM: down,
      };
    }
    const tEnd = T;
    Object.assign(cyc, {
      setupMs: tSet * 1000,
      drawStartMs: tDraw * 1000,
      anchorMs: tAnchor * 1000,
      drawMs: (tAnchor - tDraw) * 1000,
      holdMs: (tEnd - tAnchor) * 1000,
    });
    if (kind === "shot") {
      const relDur = 0.3;
      cyc.releaseMs = tEnd * 1000;
      cyc.release = {
        tauMs: shot.releaseTau * 1000,
        backM: shot.ch.relBack,
        downM: shot.ch.relDown,
        outM: shot.ch.relOut,
        peakSpeedMs: null, // filled in by the truth module from the motion itself
      };
      hand.to(T, T + relDur, "FOLLOW", { type: "damped", k: relDur / shot.releaseTau });
      // bow reaction lasts 0.5 s, or less when the archer lowers the arms right away
      const reactDur = Math.min(0.5, Math.max(relDur, shot.followMs / 1000));
      ch.bowReact.to(T, T + reactDur, 1, { type: "damped", k: reactDur / shot.reactTau });
      T += Math.max(relDur, shot.followMs / 1000);
      mark("follow", tEnd, T);
      const tLow = T;
      move(
        shot.lowerMs / 1000,
        {
          raise: 0,
          bowReact: 0,
          shoulderUp: 0,
          drawRetract: 0,
          expand: 0,
          headDrift: 0,
          headTurn: 0.75,
          headDown: 0.18,
        },
        "REST",
      );
      mark("lower", tLow, T);
    } else {
      const ldS = evRng.uniform(800, 2500) / 1000;
      cyc.letdownStartMs = tEnd * 1000;
      const lowering = cfg.letdownStyle === "lower" ? { raise: 0.45, headTurn: 0.85 } : {};
      move(
        ldS,
        { shoulderUp: 0.3, drawRetract: 0, expand: 0, headDrift: 0, ...lowering },
        "STRING",
      );
      cyc.letdownEndMs = T * 1000;
      mark("letdown", tEnd, T);
      wait(evRng.uniform(0.3, 1.0), "letdown-rest");
      const tLow = T;
      move(evRng.uniform(1.0, 1.5), { raise: 0.22, shoulderUp: 0, headTurn: 0.6 }, "NOCK");
      mark("lower", tLow, T);
    }
    cycles.push(cyc);
    return cyc;
  };

  const walkOff = (endIndex) => {
    const t0 = T;
    move(0.9, { yaw: Math.PI / 2, open: 0, headTurn: 0, headDown: 0.1, lean: 0.02 });
    const tw = T;
    const dur = WALK_DIST / WALK_SPEED;
    ch.gait.to(tw, tw + 0.5, 1, { type: "smooth" });
    ch.rootX.to(tw, tw + dur, WALK_DIST, { type: "linear" });
    ch.walkDist.to(tw, tw + dur, ch.walkDist.last().v + WALK_DIST, { type: "linear" });
    T = tw + dur;
    const [o0, o1] = cfg.outOfFrameMs || [20000, 40000];
    const away = evRng.uniform(o0, o1) / 1000;
    ch.gait.to(T, T + 0.4, 0, { type: "smooth" });
    T += away;
    move(0.6, { yaw: -Math.PI / 2 });
    const tb = T;
    ch.gait.to(tb, tb + 0.5, 1, { type: "smooth" });
    ch.rootX.to(tb, tb + dur, 0, { type: "linear" });
    ch.walkDist.to(tb, tb + dur, ch.walkDist.last().v + WALK_DIST, { type: "linear" });
    T = tb + dur;
    ch.gait.to(T, T + 0.5, 0, { type: "smooth" });
    T += 0.5;
    move(1.0, { yaw: 0, open: archer.open, headTurn: 0.75, headDown: 0.18, lean: archer.lean });
    mark("walk", t0, T, { end: endIndex });
  };

  /* ---- scenes without shots (the right answer is zero shots) ---- */
  const walkTo = (x) => {
    const cur = ch.rootX.last().v;
    const dist = Math.abs(x - cur);
    if (dist < 1e-6) return;
    const t0 = T;
    move(0.8, { yaw: x > cur ? Math.PI / 2 : -Math.PI / 2, open: 0, headTurn: 0, headDown: 0.1 });
    const tw = T,
      dur = dist / WALK_SPEED;
    ch.gait.to(tw, tw + 0.5, 1, { type: "smooth" });
    ch.rootX.to(tw, tw + dur, x, { type: "linear" });
    ch.walkDist.to(tw, tw + dur, ch.walkDist.last().v + dist, { type: "linear" });
    T = tw + dur;
    ch.gait.to(T, T + 0.5, 0, { type: "smooth" });
    T += 0.5;
    mark("walk", t0, T);
  };
  const faceStance = () =>
    move(1.0, { yaw: 0, open: archer.open, headTurn: 0.75, headDown: 0.18, lean: archer.lean });
  const scripts = {
    /* walking back and forth across the frame with the bow in hand */
    walking() {
      for (let k = 0; k < 3; k++) {
        idle(1500, 4000);
        walkTo(scriptRng.uniform(1.0, 1.6));
        idle(1000, 3000);
        walkTo(-scriptRng.uniform(1.0, 1.6));
      }
      walkTo(0);
      faceStance();
    },
    /* arrow retrieval twice: walk out of frame and back */
    retrieval() {
      for (let k = 0; k < 2; k++) {
        idle(2000, 5000);
        walkOff(k);
      }
    },
    /* raising the bow with the bow arm only; the draw hand stays down */
    "raise-one-hand"() {
      for (let k = 0; k < 5; k++) {
        idle(1500, 4000);
        const t0 = T;
        move(scriptRng.uniform(0.8, 1.4), {
          raise: 1,
          headTurn: archer.headTurnMax,
          headDown: 0.08,
        });
        wait(scriptRng.uniform(1.0, 4.0));
        move(scriptRng.uniform(0.8, 1.3), { raise: 0, headTurn: 0.75, headDown: 0.18 });
        mark("raise-one-hand", t0, T);
      }
    },
    /* warm-up stretches: arms spread, draw arm overhead, draw hand across to the bow shoulder */
    stretch() {
      const kinds = ["SPREAD", "OVERHEAD", "ACROSS", "SPREAD", "ACROSS", "OVERHEAD"];
      for (const target of kinds) {
        idle(1500, 3500);
        const t0 = T;
        const arms = target === "SPREAD" ? { raise: 1, headTurn: 0.5 } : { raise: 0 };
        move(scriptRng.uniform(0.7, 1.2), arms, target);
        wait(scriptRng.uniform(1.5, 3.5));
        move(scriptRng.uniform(0.7, 1.2), { raise: 0, headTurn: 0.75 }, "REST");
        mark("stretch", t0, T);
      }
    },
    /* blank draws that are all let down (no release) */
    "blank-letdown"() {
      let s = first;
      reload(s);
      for (let k = 0; k < 5; k++) {
        drawCycle("letdown", s, { end: 0, arrow: 0 });
        idle(2000, 5000);
        s = sampleShot(shotRng, archer, H, cfg);
        setShotChannels(s);
        wait(0.6);
      }
    },
  };

  wait(evRng.uniform(1.5, 3.0), "idle");
  if (cfg.script && cfg.script !== "practice") {
    if (!scripts[cfg.script]) throw new Error(`unknown script ${cfg.script}`);
    scripts[cfg.script]();
    idle(2000, 3500);
    return { body, archer, ch, hand, cycles, intervals, durationMs: T * 1000 };
  }
  const ends = cfg.ends || 1;
  const perEnd = cfg.arrowsPerEnd || 6;
  let arrow = 0;
  let shot = first;
  for (let e = 0; e < ends; e++) {
    for (let a = 0; a < perEnd; a++) {
      reload(shot);
      let letdowns = 0;
      while (cfg.letdownProb > 0 && letdowns < 2 && evRng.chance(cfg.letdownProb)) {
        drawCycle("letdown", shot, { end: e, arrow });
        letdowns++;
        idle(1000, 3000);
      }
      drawCycle("shot", shot, { end: e, arrow });
      arrow++;
      shot = sampleShot(shotRng, archer, H, cfg);
      if (a < perEnd - 1)
        idle(cfg.idleMs ? cfg.idleMs[0] : 1500, cfg.idleMs ? cfg.idleMs[1] : 5000);
    }
    if (e < ends - 1) {
      idle(1000, 2500);
      if (cfg.walkOff) walkOff(e);
      else idle(6000, 12000);
      idle(1500, 3500);
    }
  }
  idle(2000, 3500);
  return { body, archer, ch, hand, cycles, intervals, durationMs: T * 1000 };
}

/* ---------- pose ---------- */

function makeSway(rng) {
  const f = () => rng.uniform(0, 2 * Math.PI);
  const p = Array.from({ length: 16 }, f);
  return (t, H) => {
    const s = (fr, ph) => Math.sin(2 * Math.PI * fr * t + ph);
    return {
      bx: 0.003 * H * s(0.18, p[0]) + 0.002 * H * s(0.07, p[1]),
      by: 0.003 * H * s(0.15, p[2]) + 0.002 * H * s(0.05, p[3]),
      breath: 0.002 * H * s(0.25, p[4]),
      /* bow-hand aiming sway: slow drift + ~1.7 Hz wobble + physiological tremor (~9 Hz) */
      ax: 0.003 * s(0.6, p[5]) + 0.0012 * s(1.7, p[6]) + 0.0006 * s(9.1, p[7]),
      ay: 0.002 * s(0.5, p[8]) + 0.001 * s(1.9, p[9]),
      az: 0.003 * s(0.7, p[10]) + 0.0012 * s(1.5, p[11]) + 0.0006 * s(8.7, p[12]),
      hx: 0.0015 * s(0.31, p[13]),
      hy: 0.0012 * s(0.23, p[14]),
      hz: 0.001 * s(0.27, p[15]),
    };
  };
}

function handTarget(name, x) {
  const { b, c, H } = x;
  const finger = (S, hdir) =>
    V.comb([S, 1], [hdir, -b.handBack], [x.rH, 0.015 * H], [x.uH, -0.005 * H]);
  switch (name) {
    case "QUIVER":
      return {
        W: V.comb([x.P, 1], [x.l, -(b.hipHalf + 0.05 * H)], [x.n, -0.03 * H], [x.up, 0.08 * H]),
        hdir: [0, 0, -1],
      };
    case "NOCK": {
      const S = V.addm(x.grip, V.norm(V.sub(x.M, x.grip)), 0.13 * H);
      const hdir = V.norm(V.sub(x.grip, S));
      return { W: V.addm(S, hdir, -b.handBack), hdir };
    }
    case "STRING": {
      const S = V.addm(x.grip, V.norm(V.sub(x.A, x.grip)), b.brace + c.preDraw);
      return { W: finger(S, x.arrowDir), hdir: x.arrowDir };
    }
    case "ANCHOR": {
      let S = V.addm(x.A, x.arrowDir, -c.expand * c.expansionM);
      if (c.reanchor)
        S = V.comb([S, 1], [x.arrowDir, c.reanchor * c.reFwd], [x.up, -c.reanchor * c.reDown]);
      return { W: finger(S, x.arrowDir), hdir: x.arrowDir };
    }
    case "FOLLOW": {
      const S = V.comb(
        [x.A, 1],
        [x.arrowDir, -(c.expand * c.expansionM + c.relBack)],
        [x.up, -c.relDown],
        [x.rH, c.relOut],
      );
      const hdir = V.norm(V.comb([x.arrowDir, 1], [x.up, -0.25])); // fingers relax after the loose
      return { W: finger(S, hdir), hdir };
    }
    case "FACE": {
      const W = V.comb([x.nose, 1], [x.rH, 0.05 * H], [x.uH, -0.05 * H], [x.f, -0.04 * H]);
      return { W, hdir: V.norm(V.sub(x.nose, W)) };
    }
    case "SPREAD": {
      // draw arm stretched straight back, away from the target
      const dir = V.mul(x.aimH, -1);
      return { W: V.addm(x.sD, dir, (b.upperArm + b.forearm) * 0.97), hdir: dir };
    }
    case "OVERHEAD": {
      const W = V.comb([x.sD, 1], [x.up, (b.upperArm + b.forearm) * 0.95], [x.n, -0.02 * H]);
      return { W, hdir: [0, 0, 1] };
    }
    case "ACROSS": {
      // draw hand on the bow-side shoulder, forearm across the chest (cross-body stretch)
      const W = V.comb([x.sB, 1], [x.n, 0.08 * H], [x.up, 0.03 * H]);
      return { W, hdir: V.norm(V.sub(x.sB, x.sD)) };
    }
    default: {
      // REST: hanging at the side
      const W = V.comb(
        [x.sD, 1],
        [x.up, -(b.upperArm + b.forearm) * 0.95],
        [x.n, 0.03 * H],
        [x.lS, -0.02 * H],
      );
      return { W, hdir: [0, 0, -1] };
    }
  }
}

function handPoints(W, hdir, sideHint, H) {
  let side = V.cross(hdir, [0, 0, 1]);
  if (V.len(side) < 1e-6) side = sideHint;
  side = V.norm(side);
  return {
    index: V.comb([W, 1], [hdir, 0.085 * H], [side, 0.012 * H]),
    pinky: V.comb([W, 1], [hdir, 0.075 * H], [side, -0.02 * H]),
    thumb: V.comb([W, 1], [hdir, 0.04 * H], [side, 0.028 * H]),
  };
}

/* Right-handed pose at time t (seconds). Returns 33 points plus auxiliary geometry. */
function poseRight(sess, t) {
  const { body: b, archer: ar } = sess;
  const H = b.H;
  const c = {};
  for (const k of Object.keys(sess.ch)) c[k] = sess.ch[k].at(t);
  const sw = sess.sway(t, H);
  const up = [0, 0, 1];
  const n = [Math.sin(c.yaw), -Math.cos(c.yaw), 0];
  const l = [Math.cos(c.yaw), Math.sin(c.yaw), 0];
  const gp = (c.walkDist / STRIDE_M) * 2 * Math.PI;
  const root = [c.rootX + sw.bx, c.rootY + sw.by, 0];
  const P = V.add(root, [0, 0, b.hipZ - c.gait * 0.008 * H * Math.abs(Math.sin(gp))]);
  const yawS = c.yaw + c.open;
  const nS = [Math.sin(yawS), -Math.cos(yawS), 0];
  const lS = [Math.cos(yawS), Math.sin(yawS), 0];
  const upT = V.norm(V.comb([up, Math.cos(c.lean)], [n, Math.sin(c.lean)]));
  const M = V.addm(P, upT, b.torso + sw.breath);
  const sB = V.comb([M, 1], [lS, b.shoulderHalf], [up, c.shoulderUp * c.bowShUpM]);
  const sD = V.comb(
    [M, 1],
    [lS, -b.shoulderHalf],
    [lS, -0.012 * H * c.drawRetract],
    [nS, 0.01 * H * c.drawRetract],
  );
  const hipL = V.addm(P, l, b.hipHalf);
  const hipR = V.addm(P, l, -b.hipHalf);

  // head
  const Nb = V.addm(M, upT, b.neck);
  const hy = yawS + c.headTurn * (Math.PI / 2 - c.open);
  const fH = [Math.sin(hy), -Math.cos(hy), 0];
  const th = c.headDown;
  const f = V.comb([fH, Math.cos(th)], [up, -Math.sin(th)]);
  const uH = V.comb([up, Math.cos(th)], [fH, Math.sin(th)]);
  const rH = V.cross(f, uH);
  const hd = c.headDrift;
  const hc = V.comb(
    [Nb, 1],
    [uH, b.head],
    [f, 0.012 * H],
    [[c.headDx * hd + sw.hx, c.headDy * hd + sw.hy, c.headDz * hd + sw.hz], 1],
  );
  const at = (df, du, dr) => V.comb([hc, 1], [f, df * H], [uH, du * H], [rH, dr * H]);
  const nose = at(0.058, -0.025, 0); // nose tip ~7.5 cm above the chin for H = 1.6 m
  const chin = at(0.045, -0.072, 0);

  // bow arm
  const aimH = V.norm(V.comb([l, 1], [n, Math.tan(ar.psi)]));
  const aimDir = V.comb([aimH, Math.cos(c.aimElev)], [up, Math.sin(c.aimElev)]);
  const hangDir = V.norm(V.comb([up, -1], [n, 0.12], [l, 0.06]));
  const armDir = V.norm(slerp(hangDir, aimDir, c.raise));
  const ua = b.upperArm,
    fa = b.forearm;
  const dFull = Math.sqrt(ua * ua + fa * fa - 2 * ua * fa * Math.cos(c.bowElbowDeg * DEG));
  const reach = (1 - c.raise) * (ua + fa) * 0.985 + c.raise * dFull;
  let wB = V.addm(sB, armDir, reach);
  wB = V.add(wB, V.mul([sw.ax, sw.ay, sw.az], c.raise));
  wB = V.addm(wB, n, 0.07 * H * Math.sin(gp) * c.gait);
  let grip = V.addm(wB, armDir, 0.035 * H);
  if (c.bowReact > 0) {
    grip = V.comb([grip, 1], [aimDir, c.reactFwd * c.bowReact], [up, -c.reactDrop * c.bowReact]);
    wB = V.addm(grip, armDir, -0.035 * H);
  }
  const poleAim = V.norm(V.comb([up, -ar.bowPoleDown], [nS, -1]));
  const poleB = V.norm(V.lerp(V.mul(n, -1), poleAim, c.raise));
  const ikB = ik2(sB, wB, ua, fa, poleB);
  wB = ikB.W;
  const hB = V.norm(V.lerp(armDir, V.comb([armDir, 0.6], [up, -0.8]), c.raise));

  // draw hand
  const A = V.comb(
    [chin, 1],
    [uH, -0.005 * H + c.anchorDu],
    [rH, 0.006 * H + c.anchorDr],
    [f, c.anchorDf],
  );
  const arrowDir = V.norm(V.sub(grip, A));
  const ctx = { b, c, H, P, M, n, l, nS, lS, up, f, uH, rH, nose, A, grip, arrowDir, sD, sB, aimH };
  const hk = sess.hand.at(t);
  const T0 = handTarget(hk.from, ctx);
  const T1 = hk.to === hk.from ? T0 : handTarget(hk.to, ctx);
  let wD = V.lerp(T0.W, T1.W, hk.w);
  const hD = V.norm(V.lerp(T0.hdir, T1.hdir, hk.w));
  wD = V.addm(wD, n, -0.07 * H * Math.sin(gp) * c.gait);
  const arrowH = V.norm([arrowDir[0], arrowDir[1], 0]);
  const poleDraw = V.norm(V.comb([nS, -1], [arrowH, -0.35], [up, Math.tan(c.elbowTilt)]));
  const poleRest = V.norm(V.comb([n, -1], [up, -0.2]));
  const wgt = clamp01((wD[2] - (sD[2] - 0.2 * H)) / (0.18 * H));
  const ikD = ik2(sD, wD, ua, fa, V.norm(V.lerp(poleRest, poleDraw, wgt)));
  wD = ikD.W;

  // legs
  const lat = b.stanceHalf + (b.hipHalf - b.stanceHalf) * c.gait;
  const foot = (sign, ph) =>
    V.comb(
      [root, 1],
      [l, sign * lat],
      [n, 0.3 * Math.sin(ph) * c.gait],
      [up, b.ankleZ + 0.05 * Math.max(0, Math.cos(ph)) * c.gait],
    );
  const ankL = foot(1, gp),
    ankR = foot(-1, gp + Math.PI);
  const kL = ik2(hipL, ankL, b.thigh, b.shank, n),
    kR = ik2(hipR, ankR, b.thigh, b.shank, n);
  const heel = (a) => V.comb([a, 1], [n, -0.035 * H], [up, -0.03 * H]);
  const toe = (a) => V.comb([a, 1], [n, 0.1 * H], [up, -0.035 * H]);

  const pB = handPoints(wB, hB, n, H);
  const pD = handPoints(wD, hD, n, H);
  const pts = new Array(LM_COUNT);
  pts[0] = nose;
  pts[1] = at(0.046, 0.012, -0.016); // left eye inner (head left = -rH)
  pts[2] = at(0.043, 0.013, -0.026);
  pts[3] = at(0.036, 0.012, -0.036);
  pts[4] = at(0.046, 0.012, 0.016);
  pts[5] = at(0.043, 0.013, 0.026);
  pts[6] = at(0.036, 0.012, 0.036);
  pts[7] = at(-0.005, 0.0, -0.044);
  pts[8] = at(-0.005, 0.0, 0.044);
  pts[9] = at(0.05, -0.04, -0.016);
  pts[10] = at(0.05, -0.04, 0.016);
  pts[11] = sB;
  pts[12] = sD;
  pts[13] = ikB.E;
  pts[14] = ikD.E;
  pts[15] = wB;
  pts[16] = wD;
  pts[17] = pB.pinky;
  pts[18] = pD.pinky;
  pts[19] = pB.index;
  pts[20] = pD.index;
  pts[21] = pB.thumb;
  pts[22] = pD.thumb;
  pts[23] = hipL;
  pts[24] = hipR;
  pts[25] = kL.E;
  pts[26] = kR.E;
  pts[27] = kL.W;
  pts[28] = kR.W;
  pts[29] = heel(kL.W);
  pts[30] = heel(kR.W);
  pts[31] = toe(kL.W);
  pts[32] = toe(kR.W);
  return {
    pts,
    aux: {
      raise: c.raise,
      gait: c.gait,
      arrowDir,
      grip,
      anchor: A,
      chin,
      headCenter: hc,
      headRadius: 0.065 * H,
      midShoulder: M,
      midHip: P,
    },
  };
}

const mirrorPoint = (p) => [-p[0], p[1], p[2]];

/* Build a session. cfg: see scenarios.js (handedness, ends, arrowsPerEnd, letdownProb, walkOff,
   fidgetProb, drawMs, holdMs, idleMs, followMs, lowerMs, outOfFrameMs, anchorSdM, heightM,
   releaseTauS, releaseScale, reanchorProb, letdownStyle "lower", script "practice" | "walking" |
   "retrieval" | "raise-one-hand" | "stretch" | "blank-letdown"). */
function simulateSession(cfg, seed) {
  const c = cfg || {};
  const tl = buildTimeline(c, seed);
  const handedness = c.handedness === "left" ? "left" : "right";
  const sess = {
    seed,
    cfg: c,
    handedness,
    body: tl.body,
    archer: tl.archer,
    ch: tl.ch,
    hand: tl.hand,
    sway: makeSway(makeRng(seed, "sway")),
    cycles: tl.cycles,
    intervals: tl.intervals,
    durationMs: tl.durationMs,
  };
  /* pose at tMs: {pts: 33 x [x,y,z] world metres, aux}. Left-handed = mirror image. */
  sess.poseAt = (tMs) => {
    const r = poseRight(sess, tMs / 1000);
    if (handedness === "right") return r;
    const pts = new Array(LM_COUNT);
    for (let i = 0; i < LM_COUNT; i++) pts[i] = mirrorPoint(r.pts[SWAP_INDEX[i]]);
    const a = r.aux;
    return {
      pts,
      aux: {
        ...a,
        arrowDir: mirrorPoint(a.arrowDir),
        grip: mirrorPoint(a.grip),
        anchor: mirrorPoint(a.anchor),
        chin: mirrorPoint(a.chin),
        headCenter: mirrorPoint(a.headCenter),
        midShoulder: mirrorPoint(a.midShoulder),
        midHip: mirrorPoint(a.midHip),
      },
    };
  };
  /* label of what the archer is doing at tMs (used to classify false positives) */
  sess.activityAt = (tMs) => {
    let label = "idle";
    for (const iv of sess.intervals) {
      if (iv.startMs <= tMs && tMs < iv.endMs) label = iv.kind;
      if (iv.startMs > tMs) break;
    }
    return label;
  };
  return sess;
}

module.exports = { LM, LM_COUNT, LR_PAIRS, SWAP_INDEX, sideIndices, simulateSession, ik2 };
