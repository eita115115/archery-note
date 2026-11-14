"use strict";
/* Camera timing and MediaPipe-like detector noise for the form-tracking benchmark.

   renderSession(session, cameraCfg, noiseCfg, timingCfg, seed) turns a simulated session into the
   exact stream a detector in the app sees: frames [{tMs, landmarks: 33 x {x, y, z, visibility} |
   null}] with x = px / width and y = px / height (MediaPipe normalization).

   Error model (all magnitudes in torso lengths of the subject as it appears in the image, so they
   scale with subject size; values and their sources: README.md):
   - per-landmark jitter: fast AR(1) + slow AR(1) bias, larger for distal joints, inflated for small
     subjects, occluded or off-screen points;
   - MediaPipe's temporal landmark filter (one-euro) and visibility low-pass;
   - visibility: per-landmark base, lowered for the bow hand (riser/limbs), the draw hand near the
     face (string, tab, jaw), self-occlusion by the torso and head, and off-screen points;
   - short draw-hand drop-outs (low visibility, wrong position: frozen / slid to the face / slid
     down the forearm), release blur (wrist sticks, then snaps), whole-body and arm-only left/right
     swaps, elbow flips across the shoulder-wrist line when the arm is foreshortened;
   - no-pose frames (isolated, bursts, release-time tracking loss, subject out of frame) and
     optional ghost poses while nobody is in frame;
   - frame timing: nominal fps with jitter, dropped frames and occasional stalls. */

const { makeRng, clamp01, DEG } = require("./lib");
const { LM_COUNT, SWAP_INDEX, sideIndices } = require("./simulator");
const { makeCamera, projectPose } = require("./camera");

/* landmark classes for jitter / visibility */
const CLASS = (() => {
  const c = new Array(LM_COUNT).fill("leg");
  [0, 1, 2, 3, 4, 5, 6, 9, 10].forEach((i) => (c[i] = "face"));
  [7, 8].forEach((i) => (c[i] = "ear"));
  [11, 12].forEach((i) => (c[i] = "shoulder"));
  [13, 14].forEach((i) => (c[i] = "elbow"));
  [15, 16].forEach((i) => (c[i] = "wrist"));
  [17, 18, 19, 20, 21, 22].forEach((i) => (c[i] = "hand"));
  [23, 24].forEach((i) => (c[i] = "hip"));
  return Object.freeze(c);
})();

const ARM_SWAP = [
  [11, 12],
  [13, 14],
  [15, 16],
  [17, 18],
  [19, 20],
  [21, 22],
];

const NOISE_PRESETS = Object.freeze({
  /* perfect detector: true projection, visibility 0.99, no events, no smoothing */
  none: {
    jitter: null,
    smoothing: null,
    visibility: { base: null, sd: 0 },
    events: false,
  },
  nominal: {
    /* white-ish jitter sd per class (torso lengths) and slow bias sd */
    jitter: {
      face: 0.014,
      ear: 0.02,
      shoulder: 0.018,
      elbow: 0.028,
      wrist: 0.032,
      hand: 0.05,
      hip: 0.024,
      leg: 0.028,
    },
    biasScale: 1.2,
    fastTauMs: 40,
    slowTauMs: 800,
    /* noise grows when the subject is small: factor (refTorsoPx / torsoPx)^sizeExp, at least 1 */
    refTorsoPx: 160,
    sizeExp: 0.8,
    zNoise: 3, // z jitter relative to x/y jitter
    /* MediaPipe pose landmark filter (one-euro; legacy pose graph defaults, assumption) */
    smoothing: { minCutoff: 0.05, beta: 80, dCutoff: 1.0 },
    visibility: {
      base: {
        face: 0.93,
        ear: 0.85,
        shoulder: 0.95,
        elbow: 0.84,
        wrist: 0.86,
        hand: 0.72,
        hip: 0.9,
        leg: 0.88,
      },
      sd: 0.12,
      tauMs: 60,
      smallSubjectDrop: 0.08, // visibility lost per unit of (sizeFactor - 1)
    },
    events: true,
    selfOcclusion: { visDrop: 0.35, jitterMul: 1.8 },
    offscreen: { vis: [0.03, 0.25], jitterMul: 2.5 },
    /* when the bow is raised (riser, limbs, sling); dropRate > 0 adds bow-hand drop-outs
       (frozen, slid toward the bow elbow, or slid down along the riser) */
    bowHand: {
      visDrop: 0.18,
      jitterMul: 1.6,
      dropRate: 0,
      dropMs: [100, 500],
      dropVis: [0.05, 0.35],
    },
    drawHand: {
      nearFace: 0.75, // wrist-nose distance (torso) below which the hand counts as at the face
      visDrop: 0.1,
      jitterMul: 1.5,
      dropRate: 0.12, // drop-outs per second while at the face
      dropMs: [80, 320],
      dropVis: [0.05, 0.35],
    },
    releaseBlur: { prob: 0.3, stickMs: [30, 90] },
    swap: { bodyRate: 0.006, armRate: 0.006, frames: [1, 6] }, // events per second
    elbowFlip: { rate: 0.6, shortSeg: 0.35, frames: [1, 4] },
    noPose: {
      frameProb: 0.004,
      burstRate: 0.01,
      burstMs: [100, 600],
      releaseProb: 0.12,
      releaseMs: [60, 300],
    },
    ghost: { rate: 0, ms: [200, 2000] },
  },
});

/* deep merge of plain objects (arrays and scalars replace) */
function merge(base, over) {
  if (over == null) return base;
  if (typeof base !== "object" || base == null || Array.isArray(base)) return over;
  if (typeof over !== "object" || Array.isArray(over)) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
  return out;
}

function resolveNoise(noiseCfg) {
  const n = noiseCfg || {};
  const preset = NOISE_PRESETS[n.preset || "nominal"];
  if (!preset) throw new Error(`unknown noise preset ${n.preset}`);
  const rest = { ...n };
  delete rest.preset;
  return merge(preset, rest);
}

/* ---------- frame timing ---------- */

function frameTimes(durationMs, timing, rng) {
  const t = timing || {};
  const fps = t.fps || 30;
  const dt = 1000 / fps;
  const jitter = t.jitterMs == null ? 2 : t.jitterMs;
  const drop = t.dropProb == null ? 0.01 : t.dropProb;
  const stallRate = t.stallPerMin == null ? 0.5 : t.stallPerMin;
  const [s0, s1] = t.stallMs || [100, 350];
  const out = [];
  let k = 0;
  let last = -Infinity;
  let nextStall = (rng.expo(stallRate / 60000) || Infinity) + 0;
  let stallShift = 0;
  for (;;) {
    let ts = (t.startMs || 0) + k * dt + stallShift;
    if (ts >= nextStall) {
      stallShift += rng.uniform(s0, s1);
      nextStall = ts + rng.expo(stallRate / 60000);
      ts = (t.startMs || 0) + k * dt + stallShift;
    }
    if (ts > durationMs) break;
    k++;
    if (rng.chance(drop)) continue;
    let tj = ts + (jitter ? rng.normalIn(0, jitter, -dt * 0.45, dt * 0.45) : 0);
    if (tj <= last + 1) tj = last + 1;
    last = tj;
    out.push(+tj.toFixed(3));
  }
  return out;
}

/* ---------- one-euro filter (Casiez et al. 2012) ---------- */

function oneEuroAlpha(cutoff, dtS) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dtS);
}

/* ---------- renderer ---------- */

function pointInQuad(px, py, q) {
  // q: 4 points in order; convex test by consistent cross-product sign
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i],
      b = q[(i + 1) % 4];
    const cr = (b.u - a.u) * (py - a.v) - (b.v - a.v) * (px - a.u);
    if (cr !== 0) {
      const s = cr > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

/* Poisson event list on [0, durationMs) with the given rate (per second) */
function poissonEvents(rng, durationMs, ratePerS, durRange) {
  const out = [];
  if (!(ratePerS > 0)) return out;
  let t = rng.expo(ratePerS / 1000);
  while (t < durationMs) {
    const d = rng.uniform(durRange[0], durRange[1]);
    out.push({ start: t, end: t + d });
    t += d + rng.expo(ratePerS / 1000);
  }
  return out;
}
const inEvents = (list, t) => list.some((e) => t >= e.start && t < e.end);

function renderSession(sess, cameraCfg, noiseCfg, timingCfg, seed) {
  const nz = resolveNoise(noiseCfg);
  const rng = makeRng(seed, "noise");
  const tRng = makeRng(seed, "timing");
  const cam = makeCamera(cameraCfg, sess.body, sess.handedness);
  const W = cam.width,
    Hp = cam.height;
  const side = sideIndices(sess.handedness);
  const times = frameTimes(sess.durationMs, timingCfg, tRng);
  const ev = nz.events;
  const evRng = rng.fork("events");
  const noPose = ev ? nz.noPose : null;
  const bursts = noPose
    ? poissonEvents(evRng, sess.durationMs, noPose.burstRate, noPose.burstMs)
    : [];
  const swapsBody = ev ? poissonEvents(evRng, sess.durationMs, nz.swap.bodyRate, [0, 0]) : [];
  const swapsArm = ev ? poissonEvents(evRng, sess.durationMs, nz.swap.armRate, [0, 0]) : [];
  const swapFrames = (list) =>
    list.map((e) => ({ at: e.start, frames: evRng.int(nz.swap.frames[0], nz.swap.frames[1]) }));
  const bodySwapStarts = swapFrames(swapsBody);
  const armSwapStarts = swapFrames(swapsArm);
  const releaseLoss = [];
  const releaseStick = [];
  for (const c of sess.cycles) {
    if (c.kind !== "shot" || !ev) continue;
    if (evRng.chance(noPose.releaseProb)) {
      const s = c.releaseMs + evRng.uniform(-20, 60);
      releaseLoss.push({
        start: s,
        end: s + evRng.uniform(noPose.releaseMs[0], noPose.releaseMs[1]),
      });
    }
    if (nz.releaseBlur && evRng.chance(nz.releaseBlur.prob)) {
      releaseStick.push({
        start: c.releaseMs,
        end: c.releaseMs + evRng.uniform(nz.releaseBlur.stickMs[0], nz.releaseBlur.stickMs[1]),
      });
    }
  }
  const ghosts =
    ev && nz.ghost && nz.ghost.rate > 0
      ? poissonEvents(evRng, sess.durationMs, nz.ghost.rate, nz.ghost.ms)
      : [];
  const ghostTemplate = ghosts.length ? projectPose(cam, sess.poseAt(0).pts).proj : null;
  const ghostPlace = ghosts.map(() => ({
    dx: evRng.uniform(-0.35, 0.35) * W,
    dy: evRng.uniform(-0.1, 0.2) * Hp,
    s: evRng.uniform(0.25, 0.6),
  }));

  // per-landmark noise state
  const fast = Array.from({ length: LM_COUNT }, () => [0, 0, 0]);
  const slow = Array.from({ length: LM_COUNT }, () => [rng.normal(), rng.normal(), rng.normal()]);
  const visState = new Array(LM_COUNT).fill(null);
  let euro = null; // one-euro state per landmark
  let lastT = null;
  let swapLeft = 0,
    armSwapLeft = 0;
  let bodySwapIdx = 0,
    armSwapIdx = 0;
  const flipLeft = { bow: 0, draw: 0 };
  let drop = null; // active draw-hand drop-out
  let stick = null; // release blur: position the wrist sticks at
  /* optional extras, each on its own random stream so the nominal model is unchanged */
  const bowRng = ev && nz.bowHand.dropRate > 0 ? makeRng(seed, "noise-bow") : null;
  let bowDrop = null;
  /* small camera shake: AR(1) pointing jitter (deg, tauMs) + roll, applied to the image */
  const shake = cameraCfg && cameraCfg.shake ? cameraCfg.shake : null;
  const shRng = shake ? makeRng(seed, "shake") : null;
  const shState = [0, 0, 0];
  const stats = {
    frames: times.length,
    noPose: 0,
    outOfFrame: 0,
    ghostFrames: 0,
    bodySwapFrames: 0,
    armSwapFrames: 0,
    elbowFlipFrames: 0,
    drawDropFrames: 0,
    bowDropFrames: 0,
    releaseStickFrames: 0,
  };
  const frames = [];

  for (const t of times) {
    const dtS = lastT == null ? 1 / 30 : Math.max(1e-3, (t - lastT) / 1000);
    lastT = t;
    const pose = sess.poseAt(t);
    const { proj, hipDepth } = projectPose(cam, pose.pts);
    if (shRng) {
      const a = Math.exp(-(dtS * 1000) / (shake.tauMs || 300));
      for (let k = 0; k < 3; k++)
        shState[k] = a * shState[k] + Math.sqrt(1 - a * a) * shRng.normal();
      const du = cam.f * Math.tan((shake.deg || 0) * DEG * shState[0]);
      const dv = cam.f * Math.tan((shake.deg || 0) * DEG * shState[1]);
      const rr = (shake.rollDeg || 0) * DEG * shState[2];
      const c0 = Math.cos(rr),
        s0 = Math.sin(rr);
      for (const p of proj) {
        const x = p.u - W / 2,
          y = p.v - Hp / 2;
        p.u = W / 2 + x * c0 - y * s0 + du;
        p.v = Hp / 2 + x * s0 + y * c0 + dv;
      }
    }
    const mid = (a, b) => ({
      u: (proj[a].u + proj[b].u) / 2,
      v: (proj[a].v + proj[b].v) / 2,
      depth: Math.min(proj[a].depth, proj[b].depth),
    });
    const mS = mid(11, 12),
      mH = mid(23, 24);
    const torsoPx = Math.max(4, Math.hypot(mS.u - mH.u, mS.v - mH.v));
    const inside = (p, m) =>
      p.u >= -m && p.u <= W + m && p.v >= -m && p.v <= Hp + m && p.depth > 0.2;
    const torsoVisible = [11, 12, 23, 24].filter((i) => inside(proj[i], 0)).length;
    const present = torsoVisible >= 2 && (inside(mS, 0) || inside(mH, 0));
    if (!present) stats.outOfFrame++;

    // ghost pose while nobody is in frame
    if (!present && ghosts.length) {
      const gi = ghosts.findIndex((g) => t >= g.start && t < g.end);
      if (gi >= 0) {
        const g = ghostPlace[gi];
        const cx = W / 2,
          cy = Hp / 2;
        const lms = ghostTemplate.map((p) => {
          const u = cx + (p.u - cx) * g.s + g.dx + rng.normal(0, 4);
          const v = cy + (p.v - cy) * g.s + g.dy + rng.normal(0, 4);
          return {
            x: u / W,
            y: v / Hp,
            z: rng.normal(0, 0.05),
            visibility: clamp01(rng.uniform(0.2, 0.6)),
          };
        });
        frames.push({ tMs: t, landmarks: lms });
        stats.ghostFrames++;
        euro = null;
        continue;
      }
    }
    let lost = !present;
    if (!lost && noPose) {
      if (rng.chance(noPose.frameProb) || inEvents(bursts, t) || inEvents(releaseLoss, t))
        lost = true;
    }
    if (lost) {
      frames.push({ tMs: t, landmarks: null });
      stats.noPose++;
      euro = null; // MediaPipe restarts tracking: the landmark filter resets
      drop = null;
      bowDrop = null;
      continue;
    }

    // per-landmark multipliers and visibility reductions
    const sizeFactor = nz.jitter ? Math.max(1, Math.pow(nz.refTorsoPx / torsoPx, nz.sizeExp)) : 1;
    const jMul = new Array(LM_COUNT).fill(1);
    const vDrop = new Array(LM_COUNT).fill(0);
    if (ev) {
      // self-occlusion by the torso quad and the head disc
      const quad = [proj[11], proj[12], proj[24], proj[23]];
      const torsoDepth = (proj[11].depth + proj[12].depth + proj[23].depth + proj[24].depth) / 4;
      const hc = cam.project(pose.aux.headCenter);
      const headR = (cam.f * pose.aux.headRadius) / Math.max(0.2, hc.depth);
      for (let i = 0; i < LM_COUNT; i++) {
        const p = proj[i];
        const behindTorso =
          i !== 11 &&
          i !== 12 &&
          i !== 23 &&
          i !== 24 &&
          p.depth > torsoDepth + 0.06 &&
          pointInQuad(p.u, p.v, quad);
        const behindHead =
          i > 10 && p.depth > hc.depth + 0.04 && Math.hypot(p.u - hc.u, p.v - hc.v) < headR;
        if (behindTorso || behindHead) {
          jMul[i] *= nz.selfOcclusion.jitterMul;
          vDrop[i] += nz.selfOcclusion.visDrop;
        }
        if (!inside(p, 0)) {
          jMul[i] *= nz.offscreen.jitterMul;
          vDrop[i] = Math.max(vDrop[i], 1); // replaced below by the off-screen visibility range
        }
      }
      // bow hand behind the riser while the bow is raised
      if (pose.aux.raise > 0.5) {
        for (const i of [side.bow.wrist, side.bow.index, side.bow.pinky, side.bow.thumb]) {
          jMul[i] *= nz.bowHand.jitterMul;
          vDrop[i] += nz.bowHand.visDrop;
        }
      }
    }
    const dW = proj[side.draw.wrist],
      nose = proj[0];
    const nearFace =
      ev && Math.hypot(dW.u - nose.u, dW.v - nose.v) / torsoPx < nz.drawHand.nearFace;
    const drawHandIdx = [side.draw.wrist, side.draw.index, side.draw.pinky, side.draw.thumb];
    if (nearFace) {
      for (const i of drawHandIdx) {
        jMul[i] *= nz.drawHand.jitterMul;
        vDrop[i] += nz.drawHand.visDrop;
      }
      if (!drop && rng.chance(nz.drawHand.dropRate * dtS)) {
        const mode = rng.pick(["freeze", "face", "forearm"]);
        drop = {
          end: t + rng.uniform(nz.drawHand.dropMs[0], nz.drawHand.dropMs[1]),
          mode,
          k: rng.uniform(0.3, 0.6),
          vis: rng.uniform(nz.drawHand.dropVis[0], nz.drawHand.dropVis[1]),
          freeze: null,
        };
      }
    }
    if (drop && t >= drop.end) drop = null;
    const bowHandIdx = [side.bow.wrist, side.bow.index, side.bow.pinky, side.bow.thumb];
    if (bowRng) {
      if (bowDrop && t >= bowDrop.end) bowDrop = null;
      if (!bowDrop && pose.aux.raise > 0.5 && bowRng.chance(nz.bowHand.dropRate * dtS)) {
        bowDrop = {
          end: t + bowRng.uniform(nz.bowHand.dropMs[0], nz.bowHand.dropMs[1]),
          mode: bowRng.pick(["freeze", "elbow", "riser"]),
          k: bowRng.uniform(0.3, 0.6),
          vis: bowRng.uniform(nz.bowHand.dropVis[0], nz.bowHand.dropVis[1]),
          freeze: {},
        };
      }
    }

    // noisy image positions (square pixels)
    const out = new Array(LM_COUNT);
    const aF = Math.exp(-(dtS * 1000) / (nz.fastTauMs || 40));
    const aS = Math.exp(-(dtS * 1000) / (nz.slowTauMs || 800));
    for (let i = 0; i < LM_COUNT; i++) {
      const p = proj[i];
      let u = p.u,
        v = p.v,
        zz = cam.normalize(p, hipDepth).z;
      if (nz.jitter) {
        const sd = nz.jitter[CLASS[i]] * torsoPx * sizeFactor * jMul[i];
        const st = fast[i];
        for (let k = 0; k < 3; k++) st[k] = aF * st[k] + Math.sqrt(1 - aF * aF) * rng.normal();
        const sl = slow[i];
        for (let k = 0; k < 3; k++) sl[k] = aS * sl[k] + Math.sqrt(1 - aS * aS) * rng.normal();
        u += sd * (st[0] + nz.biasScale * sl[0]);
        v += sd * (st[1] + nz.biasScale * sl[1]);
        zz += ((sd * nz.zNoise) / W) * (st[2] + sl[2]);
      }
      out[i] = { u, v, z: zz };
    }

    // draw-hand drop-out: low visibility and a wrong position
    if (drop) {
      stats.drawDropFrames++;
      const elbow = out[side.draw.elbow];
      for (const i of drawHandIdx) {
        const p = out[i];
        if (drop.mode === "freeze") {
          if (!drop.freeze) drop.freeze = {};
          if (!drop.freeze[i]) drop.freeze[i] = { u: p.u, v: p.v };
          p.u = drop.freeze[i].u;
          p.v = drop.freeze[i].v;
        } else {
          const tgt = drop.mode === "face" ? out[0] : elbow;
          p.u += (tgt.u - p.u) * drop.k;
          p.v += (tgt.v - p.v) * drop.k;
        }
      }
    }
    if (bowDrop) {
      stats.bowDropFrames++;
      const elbow = out[side.bow.elbow];
      for (const i of bowHandIdx) {
        const p = out[i];
        if (bowDrop.mode === "freeze") {
          if (!bowDrop.freeze[i]) bowDrop.freeze[i] = { u: p.u, v: p.v };
          p.u = bowDrop.freeze[i].u;
          p.v = bowDrop.freeze[i].v;
        } else if (bowDrop.mode === "elbow") {
          p.u += (elbow.u - p.u) * bowDrop.k;
          p.v += (elbow.v - p.v) * bowDrop.k;
        } else {
          p.v += bowDrop.k * 0.35 * torsoPx; // slid down along the riser
        }
      }
    }
    // release blur: the wrist sticks at its pre-release image position, then snaps back
    const stickEv = releaseStick.find((e) => t >= e.start && t < e.end);
    if (stickEv) {
      if (!stick || stick.ev !== stickEv) {
        const pre = projectPose(cam, sess.poseAt(stickEv.start).pts).proj;
        stick = { ev: stickEv, pts: drawHandIdx.map((i) => ({ i, u: pre[i].u, v: pre[i].v })) };
      }
      for (const s of stick.pts) {
        out[s.i].u = s.u + (out[s.i].u - proj[s.i].u);
        out[s.i].v = s.v + (out[s.i].v - proj[s.i].v);
      }
      stats.releaseStickFrames++;
    }
    // elbow flips when the arm is foreshortened
    if (ev && nz.elbowFlip) {
      for (const sideName of ["bow", "draw"]) {
        const s = side[sideName];
        const S = out[s.shoulder],
          E = out[s.elbow],
          Wr = out[s.wrist];
        if (flipLeft[sideName] <= 0) {
          const seg =
            Math.min(Math.hypot(E.u - S.u, E.v - S.v), Math.hypot(Wr.u - E.u, Wr.v - E.v)) /
            torsoPx;
          const pr =
            nz.elbowFlip.rate *
            dtS *
            clamp01((nz.elbowFlip.shortSeg - seg) / nz.elbowFlip.shortSeg);
          if (rng.chance(pr))
            flipLeft[sideName] = rng.int(nz.elbowFlip.frames[0], nz.elbowFlip.frames[1]);
        }
        if (flipLeft[sideName] > 0) {
          flipLeft[sideName]--;
          stats.elbowFlipFrames++;
          const dx = Wr.u - S.u,
            dy = Wr.v - S.v;
          const L2 = dx * dx + dy * dy;
          if (L2 > 1e-6) {
            const k = ((E.u - S.u) * dx + (E.v - S.v) * dy) / L2;
            const fx = S.u + k * dx,
              fy = S.v + k * dy;
            E.u = 2 * fx - E.u;
            E.v = 2 * fy - E.v;
          }
        }
      }
    }

    // one-euro smoothing in units of the subject scale (MediaPipe normalizes by object scale)
    if (nz.smoothing) {
      const scale = torsoPx * 3.5;
      const sm = nz.smoothing;
      if (!euro) euro = out.map((p) => ({ x: p.u, y: p.v, dx: 0, dy: 0 }));
      else {
        const aD = oneEuroAlpha(sm.dCutoff, dtS);
        for (let i = 0; i < LM_COUNT; i++) {
          const e = euro[i],
            p = out[i];
          const rdx = (p.u - e.x) / scale / dtS,
            rdy = (p.v - e.y) / scale / dtS;
          e.dx += aD * (rdx - e.dx);
          e.dy += aD * (rdy - e.dy);
          const ax = oneEuroAlpha(sm.minCutoff + sm.beta * Math.abs(e.dx), dtS);
          const ay = oneEuroAlpha(sm.minCutoff + sm.beta * Math.abs(e.dy), dtS);
          e.x += ax * (p.u - e.x);
          e.y += ay * (p.v - e.y);
          p.u = e.x;
          p.v = e.y;
        }
      }
    }

    // swaps (after smoothing: the label swap happens at the output)
    if (ev) {
      while (bodySwapIdx < bodySwapStarts.length && bodySwapStarts[bodySwapIdx].at <= t) {
        swapLeft = Math.max(swapLeft, bodySwapStarts[bodySwapIdx].frames);
        bodySwapIdx++;
      }
      while (armSwapIdx < armSwapStarts.length && armSwapStarts[armSwapIdx].at <= t) {
        armSwapLeft = Math.max(armSwapLeft, armSwapStarts[armSwapIdx].frames);
        armSwapIdx++;
      }
    }

    // visibility
    const visCfg = nz.visibility;
    const lms = new Array(LM_COUNT);
    for (let i = 0; i < LM_COUNT; i++) {
      let vis;
      if (!visCfg.base) vis = 0.99;
      else {
        let target = visCfg.base[CLASS[i]] - (sizeFactor - 1) * (visCfg.smallSubjectDrop || 0);
        if (vDrop[i] >= 1) target = rng.uniform(nz.offscreen.vis[0], nz.offscreen.vis[1]);
        else target -= vDrop[i];
        if (drop && drawHandIdx.includes(i)) target = drop.vis;
        if (bowDrop && bowHandIdx.includes(i)) target = bowDrop.vis;
        target = clamp01(target + rng.normal(0, visCfg.sd));
        const a = 1 - Math.exp(-(dtS * 1000) / (visCfg.tauMs || 90));
        vis = visState[i] == null ? target : visState[i] + a * (target - visState[i]);
        visState[i] = vis;
      }
      const p = out[i];
      lms[i] = { x: p.u / W, y: p.v / Hp, z: p.z, visibility: +vis.toFixed(4) };
    }
    let final = lms;
    if (swapLeft > 0) {
      final = SWAP_INDEX.map((j) => lms[j]);
      swapLeft--;
      stats.bodySwapFrames++;
    } else if (armSwapLeft > 0) {
      final = lms.slice();
      for (const [a, b] of ARM_SWAP) {
        final[a] = lms[b];
        final[b] = lms[a];
      }
      armSwapLeft--;
      stats.armSwapFrames++;
    }
    frames.push({ tMs: t, landmarks: final });
  }
  return {
    frames,
    frame: { w: W, h: Hp },
    camera: cam,
    fps: (timingCfg && timingCfg.fps) || 30,
    stats,
    events: { releaseLoss, releaseStick, bursts },
  };
}

module.exports = { NOISE_PRESETS, resolveNoise, renderSession, frameTimes, CLASS };
