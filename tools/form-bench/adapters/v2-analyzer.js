"use strict";
/* Bench adapter for the form-tracking v2 analyser (scripts/44-form-analyze.js; spec:
   docs/design/form-v2/algorithm.md). The analyser runs unchanged on the whole capture; this file
   only maps its output onto the benchmark's contract.

   npm run bench:form -- --adapter tools/form-bench/adapters/v2-analyzer.js

   - shots: only the shots the analyser counts (kind "shot": the release was located clearly) and the
     let-downs it reports (kind "letdown"; the scorer does not count them as shots). Draws whose
     release could not be located are NOT reported as shots; they are listed in quality.candidates
     (the capture result offers them under "fix the shot count").
   - anchorStartMs / holdMs: the analyser's own anchor ("the hand has stopped", algorithm.md 4.8).
     Compare it with the benchmark's anchorStillMs / holdStillMs columns ("still"); against the
     end-of-draw truth ("end") it is early by construction. The fitted end of the draw is copied to
     extra.drawEndMs for reference.
   - features: only keys whose definition matches the benchmark's (README, "Feature contract").
     Anchor and shoulder values come from the per-shot features; elbow angles and the follow-through
     come from the per-shot poses the analyser stores for overlays (poseHold / poseRel, 0.01 torso). */
const FA = require("../../form-analyze-loader.js");

const fin = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const ROLE = Object.fromEntries(FA.ROLES.map((r, i) => [r, i]));
const pt = (pose, role) => {
  if (!pose) return null;
  const x = pose[2 * ROLE[role]];
  const y = pose[2 * ROLE[role] + 1];
  return x === null || y === null ? null : { x: x / 100, y: y / 100 };
};
function interior(a, b, c) {
  if (!a || !b || !c) return null;
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const l = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (!(l > 0)) return null;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / l))) * 180) / Math.PI;
}

/* benchmark feature keys from one analysed shot (features f, poses at the hold and after release) */
function mapFeatures(f, poseHold, poseRel) {
  const out = {
    anchorDist: null,
    anchorBack: null,
    anchorDown: null,
    bowElbow: null,
    drawElbow: null,
    bowShoulderElev: null,
    followDist: null,
    followDir: null,
  };
  const ancX = fin(f.ancX);
  const ancY = fin(f.ancY);
  const bWr = pt(poseHold, "bWr");
  const dWr = pt(poseHold, "dWr");
  /* "back" = along the arrow, away from the target: bow wrist -> draw wrist in the hold pose */
  let back = null;
  if (bWr && dWr) {
    const l = Math.hypot(dWr.x - bWr.x, dWr.y - bWr.y);
    if (l > 0) back = { x: (dWr.x - bWr.x) / l, y: (dWr.y - bWr.y) / l };
  }
  if (ancX !== null && ancY !== null) {
    out.anchorDist = Math.hypot(ancX, ancY);
    out.anchorDown = -ancY; // canonical y is up; the benchmark's is image-down
    if (back) out.anchorBack = ancX * back.x + ancY * back.y;
  }
  if (fin(f.shWidth) !== null && fin(f.shTilt) !== null)
    out.bowShoulderElev = f.shWidth * Math.sin((f.shTilt * Math.PI) / 180);
  out.bowElbow = interior(pt(poseHold, "bSh"), pt(poseHold, "bEl"), bWr);
  out.drawElbow = interior(pt(poseHold, "dSh"), pt(poseHold, "dEl"), dWr);
  const dRel = pt(poseRel, "dWr");
  if (dWr && dRel && back) {
    const dx = dRel.x - dWr.x;
    const dy = dRel.y - dWr.y;
    out.followDist = Math.hypot(dx, dy);
    /* perpendicular to "back", pointing down (canonical y is up) */
    let px = -back.y;
    let py = back.x;
    if (py > 0) {
      px = -px;
      py = -py;
    }
    out.followDir = (Math.atan2(dx * px + dy * py, dx * back.x + dy * back.y) * 180) / Math.PI;
  }
  return out;
}

const optsOf = (meta) => ({ frame: meta.frame, handedness: meta.handedness, fps: meta.fps });

module.exports = {
  name: "form-v2",
  description:
    "scripts/44-form-analyze.js (offline whole-capture analyser; counts only clearly located releases)",
  provides: [
    "anchorDist",
    "anchorBack",
    "anchorDown",
    "bowElbow",
    "drawElbow",
    "bowShoulderElev",
    "followDist",
    "followDir",
  ],
  analyze(frames, meta) {
    const res = FA.analyze(frames, optsOf(meta));
    const shots = res.shots.map((s) => {
      const isShot = s.kind === "shot";
      return {
        releaseMs: s.releaseMs,
        anchorStartMs: s.anchorStartMs,
        holdMs: s.holdMs,
        kind: s.kind,
        features: isShot ? mapFeatures(s.features, s.poseHold, s.poseRel) : {},
        extra: {
          drawEndMs: Math.round(s.drawEndMs),
          releaseUncMs: Math.round(s.releaseUncMs),
          confidence: Math.round(s.confidence * 100) / 100,
          source: s.source,
        },
      };
    });
    const q = res.quality;
    return {
      shots,
      quality: {
        counted: shots.filter((s) => s.kind === "shot").length,
        letdowns: shots.filter((s) => s.kind === "letdown").length,
        candidates: res.candidates.map((c) => ({
          tMs: Math.round(c.tMs),
          uncMs: Math.round(c.uncMs),
          reason: c.reason,
          likely: !!c.likely,
        })),
        warnings: q.warnings,
        drawLevel: q.drawLevel,
        still: q.still,
        fps: q.fps,
        coverage: q.coverage,
        scalePx: q.scalePx,
        view: q.view,
        repaired: q.repaired,
      },
    };
  },
  /* features measured at the TRUE anchor/release times (detection taken out of the picture) */
  measure(frames, meta, windows) {
    const o = optsOf(meta);
    const sig = FA.prepare(FA.packFrames(frames, o), o);
    const idx = (tMs) => (tMs - sig.t0) / sig.dt;
    return windows.map((w) => {
      const relI = idx(w.releaseMs);
      const ft = FA.shotFeatures(sig, relI, idx(w.anchorStartMs));
      const [p0, p1] = FA.poseWindow(sig, relI);
      return {
        features: mapFeatures(ft.f, FA.poseAt(sig, ft.w0, ft.w1), FA.poseAt(sig, p0, p1)),
      };
    });
  },
};
