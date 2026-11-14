"use strict";
/* Ground truth for a simulated session seen through a given camera.

   Event times come from the motion script itself (simulator.js): anchorMs = end of the draw,
   releaseMs = the instant the string hand starts its release motion, holdMs = releaseMs - anchorMs.
   Per-shot features are measured on the noise-free motion, sampled every 10 ms (independent of the
   camera frame rate):
   - "3D": true joint positions, torso = |mid-shoulder - mid-hip| in metres;
   - "2D": noise-free projection in square pixels, torso = projected torso length.
   Feature definitions (shared with every detector adapter; README.md, "Feature contract"):
     anchorDist        draw wrist to nose / torso, median over the hold
     anchorBack, anchorDown   wrist - nose along the arrow (away from the target) and downward
     bowElbow, drawElbow      interior elbow angle (deg, 180 = straight), median over the hold
     bowShoulderElev   (bow-shoulder height - draw-shoulder height) / torso, median over the hold
     headMove          nose displacement from anchor to release / torso
     drawDrift, bowDrift      wrist displacement over the last 500 ms before release / torso
     followDist        draw-wrist displacement from release to release + 300 ms / torso
     followDir         its direction (deg): 0 = straight back along the arrow, positive = downward */

const { V, angle2d, median } = require("./lib");
const { sideIndices } = require("./simulator");
const { projectPose } = require("./camera");

const STEP_MS = 10;
const FOLLOW_MS = 300;
const DRIFT_MS = 500;

function sampler(sess, cam) {
  const side = sideIndices(sess.handedness);
  return (tMs) => {
    const pose = sess.poseAt(tMs);
    const { proj } = projectPose(cam, pose.pts);
    const p2 = proj.map((p) => ({ x: p.u, y: p.v }));
    const P = pose.pts;
    const mid3 = (a, b) => V.lerp(P[a], P[b], 0.5);
    const mid2 = (a, b) => ({ x: (p2[a].x + p2[b].x) / 2, y: (p2[a].y + p2[b].y) / 2 });
    const torso3 = V.dist(mid3(11, 12), mid3(23, 24));
    const ms2 = mid2(11, 12),
      mh2 = mid2(23, 24);
    const torso2 = Math.hypot(ms2.x - mh2.x, ms2.y - mh2.y);
    const g2 = cam.project(pose.aux.grip),
      a2 = cam.project(pose.aux.anchor);
    let ax = g2.u - a2.u,
      ay = g2.v - a2.v;
    const al = Math.hypot(ax, ay) || 1;
    ax /= al;
    ay /= al;
    return { P, p2, torso3, torso2, side, aux: pose.aux, arrow2: { x: ax, y: ay } };
  };
}

function features(s) {
  const { P, p2, side, torso3, torso2 } = s;
  const b = side.bow,
    d = side.draw;
  const W3 = P[d.wrist],
    N3 = P[0];
  const back3 = V.mul(s.aux.arrowDir, -1);
  const rel3 = V.sub(W3, N3);
  const W2 = p2[d.wrist],
    N2 = p2[0];
  const back2 = { x: -s.arrow2.x, y: -s.arrow2.y };
  const rel2 = { x: W2.x - N2.x, y: W2.y - N2.y };
  return {
    t3: {
      anchorDist: V.len(rel3) / torso3,
      anchorBack: V.dot(rel3, back3) / torso3,
      anchorDown: -rel3[2] / torso3,
      bowElbow: V.angleDeg(P[b.shoulder], P[b.elbow], P[b.wrist]),
      drawElbow: V.angleDeg(P[d.shoulder], P[d.elbow], P[d.wrist]),
      bowShoulderElev: (P[b.shoulder][2] - P[d.shoulder][2]) / torso3,
    },
    t2: {
      anchorDist: Math.hypot(rel2.x, rel2.y) / torso2,
      anchorBack: (rel2.x * back2.x + rel2.y * back2.y) / torso2,
      anchorDown: rel2.y / torso2,
      bowElbow: angle2d(p2[b.shoulder], p2[b.elbow], p2[b.wrist]),
      drawElbow: angle2d(p2[d.shoulder], p2[d.elbow], p2[d.wrist]),
      bowShoulderElev: (p2[d.shoulder].y - p2[b.shoulder].y) / torso2,
    },
  };
}

/* signed direction (deg) of a displacement relative to the "back" axis, positive = downward */
function dir2(dx, dy, back) {
  const along = dx * back.x + dy * back.y;
  // perpendicular to back pointing down the image (y grows downward)
  let px = -back.y,
    py = back.x;
  if (py < 0) {
    px = -px;
    py = -py;
  }
  return (Math.atan2(dx * px + dy * py, along) * 180) / Math.PI;
}
function dir3(d, back) {
  const down = [0, 0, -1];
  let perp = V.sub(down, V.mul(back, V.dot(down, back)));
  perp = V.norm(perp);
  return (Math.atan2(V.dot(d, perp), V.dot(d, back)) * 180) / Math.PI;
}

function computeTruth(sess, cam) {
  const sample = sampler(sess, cam);
  const cycles = sess.cycles.map((c) => {
    const endMs = c.kind === "shot" ? c.releaseMs : c.letdownStartMs;
    const samples = [];
    for (let t = c.anchorMs; t <= endMs + 1e-6; t += STEP_MS) samples.push(features(sample(t)));
    const med = (space, key) => median(samples.map((f) => f[space][key]));
    const keys = Object.keys(samples[0].t3);
    const t3 = {},
      t2 = {};
    for (const k of keys) {
      t3[k] = med("t3", k);
      t2[k] = med("t2", k);
    }
    const sA = sample(c.anchorMs),
      sE = sample(endMs),
      sD = sample(Math.max(c.anchorMs, endMs - DRIFT_MS));
    const dIdx = sE.side.draw.wrist,
      bIdx = sE.side.bow.wrist;
    const avg3 = (sE.torso3 + sA.torso3) / 2,
      avg2 = (sE.torso2 + sA.torso2) / 2;
    t3.headMove = V.dist(sE.P[0], sA.P[0]) / avg3;
    t2.headMove = Math.hypot(sE.p2[0].x - sA.p2[0].x, sE.p2[0].y - sA.p2[0].y) / avg2;
    t3.drawDrift = V.dist(sE.P[dIdx], sD.P[dIdx]) / sE.torso3;
    t2.drawDrift =
      Math.hypot(sE.p2[dIdx].x - sD.p2[dIdx].x, sE.p2[dIdx].y - sD.p2[dIdx].y) / sE.torso2;
    t3.bowDrift = V.dist(sE.P[bIdx], sD.P[bIdx]) / sE.torso3;
    t2.bowDrift =
      Math.hypot(sE.p2[bIdx].x - sD.p2[bIdx].x, sE.p2[bIdx].y - sD.p2[bIdx].y) / sE.torso2;
    const out = {
      index: c.index,
      kind: c.kind,
      end: c.end,
      arrow: c.arrow,
      setupMs: c.setupMs,
      drawStartMs: c.drawStartMs,
      anchorMs: c.anchorMs,
      drawMs: c.drawMs,
      holdMs: c.holdMs,
      releaseMs: c.kind === "shot" ? c.releaseMs : null,
      letdownStartMs: c.letdownStartMs == null ? null : c.letdownStartMs,
      letdownEndMs: c.letdownEndMs == null ? null : c.letdownEndMs,
      t3,
      t2,
    };
    if (c.kind === "shot") {
      const sF = sample(c.releaseMs + FOLLOW_MS);
      const d3 = V.sub(sF.P[dIdx], sE.P[dIdx]);
      const dx = sF.p2[dIdx].x - sE.p2[dIdx].x,
        dy = sF.p2[dIdx].y - sE.p2[dIdx].y;
      t3.followDist = V.len(d3) / sE.torso3;
      t2.followDist = Math.hypot(dx, dy) / sE.torso2;
      t3.followDir = dir3(d3, V.mul(sE.aux.arrowDir, -1));
      t2.followDir = dir2(dx, dy, { x: -sE.arrow2.x, y: -sE.arrow2.y });
      // peak draw-wrist speed after release (true motion, 2 ms steps)
      let prev = sE,
        peak3 = 0,
        peak2 = 0,
        peakAt = 0;
      for (let t = c.releaseMs + 2; t <= c.releaseMs + 200; t += 2) {
        const s = sample(t);
        const v3 = V.dist(s.P[dIdx], prev.P[dIdx]) / 0.002;
        const v2 =
          Math.hypot(s.p2[dIdx].x - prev.p2[dIdx].x, s.p2[dIdx].y - prev.p2[dIdx].y) /
          s.torso2 /
          0.002;
        if (v3 > peak3) {
          peak3 = v3;
          peakAt = t - c.releaseMs;
        }
        peak2 = Math.max(peak2, v2);
        prev = s;
      }
      out.release = {
        peakSpeedMs: +peak3.toFixed(3),
        peakSpeedTorsoPerS: +peak2.toFixed(2),
        peakAtMs: peakAt,
      };
    }
    return out;
  });
  return {
    handedness: sess.handedness,
    durationMs: sess.durationMs,
    cycles,
    shots: cycles.filter((c) => c.kind === "shot"),
    letdowns: cycles.filter((c) => c.kind === "letdown"),
    intervals: sess.intervals,
  };
}

module.exports = {
  computeTruth,
  FEATURE_KEYS: [
    "anchorDist",
    "anchorBack",
    "anchorDown",
    "bowElbow",
    "drawElbow",
    "bowShoulderElev",
    "headMove",
    "drawDrift",
    "bowDrift",
    "followDist",
    "followDir",
  ],
};
