"use strict";
/* Oracle adapter for the benchmark's own sanity tests: it ignores the frames and returns the ground
   truth (2D image features). Scoring it must give precision = recall = 1 and zero errors; anything
   else is a bug in the scorer, not a property of a detector. Never use it to rank detectors. */

module.exports = {
  name: "truth-oracle",
  description: "Returns the ground truth itself (scorer self-check only)",
  needsTruth: true,
  provides: [
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
  analyze(frames, meta) {
    const truth = meta && meta.truth;
    if (!truth) throw new Error("truth-oracle needs meta.truth");
    return {
      shots: truth.shots.map((s) => ({
        releaseMs: s.releaseMs,
        anchorStartMs: s.anchorMs,
        holdMs: s.holdMs,
        kind: "shot",
        features: { ...s.t2 },
      })),
      quality: { frames: frames.length },
    };
  },
};
