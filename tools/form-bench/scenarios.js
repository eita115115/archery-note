"use strict";
/* Scenario matrix for the form-tracking benchmark.

   Each scenario overrides parts of BASE:
     sim     motion script (simulator.js): handedness, ends, arrowsPerEnd, letdownProb, walkOff,
             fidgetProb, drawMs, holdMs, idleMs, outOfFrameMs, anchorSdM, releaseTauS, releaseScale
     camera  placement and frame (camera.js): width, height, torsoFrac, yawDeg, pitchDeg, rollDeg
     noise   detector-noise model (noise.js): preset "nominal" | "none" plus overrides
     timing  frame clock (noise.js frameTimes): fps, jitterMs, dropProb, stallPerMin
   group: "reference" (noise-free floor), "core" (the matrix the overall numbers pool), or
   "sensitivity" (deliberately outside the assumed ranges, to show how much a result depends on an
   assumption). */

const BASE = Object.freeze({
  sim: {
    handedness: "right",
    ends: 1,
    arrowsPerEnd: 6,
    letdownProb: 0,
    walkOff: false,
    fidgetProb: 0,
  },
  camera: { width: 1280, height: 720, torsoFrac: 0.22, yawDeg: 0, pitchDeg: 3, rollDeg: 0 },
  noise: { preset: "nominal" },
  timing: { fps: 30, jitterMs: 2, dropProb: 0.01, stallPerMin: 0.5 },
});

const SCENARIOS = [
  {
    id: "ideal-side",
    group: "reference",
    desc: "Noise-free floor: true side view, 1280x720, 60 fps, perfect landmarks, no events",
    noise: { preset: "none" },
    timing: { fps: 60, jitterMs: 0, dropProb: 0, stallPerMin: 0 },
  },
  {
    id: "side-landscape",
    group: "core",
    desc: "Clean side view, 1280x720 landscape, 30 fps, nominal MediaPipe-like noise",
  },
  {
    id: "portrait",
    group: "core",
    desc: "Phone upright: 720x1280 portrait, torso 17% of frame height",
    camera: { width: 720, height: 1280, torsoFrac: 0.17 },
  },
  {
    id: "small-subject",
    group: "core",
    desc: "Far camera: 1920x1080, torso 13% of frame height (like the golden fixtures)",
    camera: { width: 1920, height: 1080, torsoFrac: 0.13 },
  },
  {
    id: "oblique-20",
    group: "core",
    desc: "Camera 20 deg behind the perpendicular (behind the shooting line)",
    camera: { yawDeg: 20 },
  },
  {
    id: "oblique-40",
    group: "core",
    desc: "Camera 40 deg behind the perpendicular",
    camera: { yawDeg: 40 },
  },
  {
    id: "fps15",
    group: "core",
    desc: "Slow phone: 15 fps with 5 ms jitter, 3% dropped frames, stalls",
    timing: { fps: 15, jitterMs: 5, dropProb: 0.03, stallPerMin: 2 },
  },
  {
    id: "occluded-draw-hand",
    group: "core",
    desc: "Heavy draw-hand occlusion at the face: low visibility, 3x jitter, frequent drop-outs, release blur",
    noise: {
      drawHand: { visDrop: 0.35, jitterMul: 3, dropRate: 0.8, dropMs: [100, 450] },
      releaseBlur: { prob: 0.6 },
      noPose: { releaseProb: 0.3 },
    },
  },
  {
    id: "letdowns",
    group: "core",
    desc: "6 shots with let-downs mixed in (40% chance before each shot)",
    sim: { letdownProb: 0.4 },
  },
  {
    id: "walk-off",
    group: "core",
    desc: "2 ends of 3 arrows, walking out of frame to retrieve arrows, ghost poses while away",
    sim: { ends: 2, arrowsPerEnd: 3, walkOff: true },
    noise: { ghost: { rate: 0.05 } },
  },
  {
    id: "left-handed",
    group: "core",
    desc: "Left-handed archer (mirror image), otherwise the clean side view",
    sim: { handedness: "left" },
  },
  {
    id: "roll-5",
    group: "core",
    desc: "Phone tilted 5 deg about the lens axis",
    camera: { rollDeg: 5 },
  },
  {
    id: "hd60",
    group: "core",
    desc: "1920x1080 at 60 fps, torso 20% of frame height",
    camera: { width: 1920, height: 1080, torsoFrac: 0.2 },
    timing: { fps: 60, jitterMs: 1.5 },
  },
  {
    id: "mixed-session",
    group: "core",
    desc: "Portrait, small-ish subject, yaw 15, let-downs, fidgets, walk-off, ghosts",
    sim: { ends: 2, arrowsPerEnd: 3, letdownProb: 0.25, walkOff: true, fidgetProb: 0.5 },
    camera: { width: 720, height: 1280, torsoFrac: 0.15, yawDeg: 15 },
    noise: { ghost: { rate: 0.05 } },
  },
  {
    id: "weak-release",
    group: "sensitivity",
    desc: "Short, slow follow-through (35% of the assumed distance, tau 50 ms): a 'dead' release",
    sim: { releaseScale: 0.35, releaseTauS: 0.05 },
  },
  {
    id: "snappy-release",
    group: "sensitivity",
    desc: "Release twice as fast as the assumed range (tau 12 ms): checks dependence on release speed",
    sim: { releaseTauS: 0.012 },
  },
  {
    id: "big-release",
    group: "sensitivity",
    desc: "Follow-through 2.5x longer and ~4x faster than assumed (peak ~20 torso/s), like the check suite's 2D synthetic shot",
    sim: { releaseScale: 2.5, releaseTauS: 0.02 },
  },
];

function merge(base, over) {
  if (over == null) return base;
  if (typeof base !== "object" || base == null || Array.isArray(base)) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
  return out;
}

/* full config of a scenario (BASE + overrides) */
function resolveScenario(s) {
  return {
    id: s.id,
    group: s.group,
    desc: s.desc,
    sim: merge(BASE.sim, s.sim),
    camera: merge(BASE.camera, s.camera),
    noise: s.noise && s.noise.preset === "none" ? { preset: "none" } : merge(BASE.noise, s.noise),
    timing: merge(BASE.timing, s.timing),
  };
}

const DEFAULT_SEEDS = [1, 2, 3, 4, 5];

module.exports = { BASE, SCENARIOS, resolveScenario, DEFAULT_SEEDS };
