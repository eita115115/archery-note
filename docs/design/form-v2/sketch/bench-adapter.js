/* 下書きの解析器を tools/form-bench（独立した合成ベンチマーク）にかけるための薄い橋渡し。
   node tools/form-bench/run-bench.js --adapter docs/design/form-v2/sketch/bench-adapter.js
   ベンチマークの特徴のキーへ、定義が同じものだけを写す。 */
"use strict";
const { analyze } = require("./analyze-sketch.js");
const fin = (x) => (Number.isFinite(x) ? x : null);
module.exports = {
  name: "form-v2-sketch",
  description: "docs/design/form-v2/sketch/analyze-sketch.js (offline whole-capture analyser, draft)",
  provides: ["anchorDown", "anchorBack", "bowShoulderElev", "followDist"],
  analyze(frames, meta) {
    const res = analyze(frames, { frame: meta.frame, handedness: meta.handedness, fps: meta.fps });
    const shots = res.shots
      .filter((s) => s.kind === "shot")
      .map((s) => {
        const f = s.features;
        return {
          releaseMs: s.releaseMs, anchorStartMs: s.anchorStartMs, holdMs: s.holdMs, kind: "shot", weak: !!s.weak,
          features: {
            anchorDown: fin(f.ancY) === null ? null : -f.ancY,
            anchorBack: fin(f.ancX) === null ? null : -f.ancX,
            bowShoulderElev: fin(f.shTilt) === null || fin(f.shWidth) === null ? null : f.shWidth * Math.sin((f.shTilt * Math.PI) / 180),
            followDist: fin(f.relBack) === null || fin(f.relDy) === null ? null : Math.hypot(f.relBack, f.relDy),
          },
        };
      });
    const q = res.quality;
    return { shots, quality: { letdowns: res.shots.filter((s) => s.kind === "letdown").length, weak: shots.filter((s) => s.weak).length, candidates: q.candidates.length, warnings: q.warnings, drawLevel: q.drawLevel } };
  },
};
