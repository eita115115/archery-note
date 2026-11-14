"use strict";
/* Detector adapter for the app's current form-tracking pipeline (scripts/46-form-core.js).

   Frames are replayed in time order through the same calls, in the same order, as the live
   capture loop and the saved-video replay in scripts/47-form-view.js:

     raw = landmarks ? computeFormMetrics(landmarks, handedness, {w, h}) : null
     vel = velocitySource.step(history, raw, now)
     history.push({ts: now, m: raw, vel}); keep the newest 200
     result = stepFormPhase(detector, raw, history, 1.0, now)
     canceled -> receiptTracker.cancel(reason), and the shot it names is removed
     released -> receiptTracker.begin(...); shot = summarizeFormShot(history, result.anchorStartTs,
                 now, result.anchorEnter); markShotCreated
     pending release resolved without cancel -> receiptTracker.confirm()
   At the end of the stream an open receipt is abandoned ("replay-eos").

   The core file is loaded the way tools/check-form-core.js loads it (source text evaluated in a
   function scope). Nothing in scripts/ is modified. The live loop uses performance.now(), so the
   detector clock is offset by clockOffsetMs (default 10 s) and shifted back in the output. */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const CORE = path.join(ROOT, "scripts", "46-form-core.js");
let cachedCore = null;

function loadCore() {
  if (cachedCore) return cachedCore;
  const source = fs.readFileSync(CORE, "utf8");
  cachedCore = new Function(
    `${source}
return {computeFormMetrics, makeFormPhaseDetector, makeFormVelocitySource,
  makeFormReleaseReceiptTracker, stepFormPhase, summarizeFormShot, FORM_PH};`,
  )();
  return cachedCore;
}

const HISTORY_MAX = 200; // 47-form-view.js: if(history.length>200) history.shift()

const fin = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
/* summarizeFormShot output -> benchmark feature contract (README.md, "Feature contract") */
function shotFeatures(s) {
  return {
    anchorDist: fin(s.anchorNorm),
    bowElbow: fin(s.angles && s.angles.bowArm),
    drawElbow: fin(s.angles && s.angles.drawArm),
    bowShoulderElev: fin(s.angles && s.angles.shoulderDrop),
    drawDrift: fin(s.pre && s.pre.drawMove),
    bowDrift: fin(s.pre && s.pre.bowMove),
  };
}

/* windows (optional): [{anchorStartMs, releaseMs}] = TRUE event times. When given, the loop also
   records summarizeFormShot at each true release with the true anchor start (measurement probe). */
function run(frames, meta, windows) {
  const core = loadCore();
  const m = meta || {};
  const handedness = m.handedness === "left" ? "left" : "right";
  const frame = m.frame && Number.isFinite(m.frame.w) ? { w: m.frame.w, h: m.frame.h } : undefined;
  const offset = Number.isFinite(m.clockOffsetMs) ? m.clockOffsetMs : 10000;
  const detector = core.makeFormPhaseDetector();
  const velSrc = core.makeFormVelocitySource();
  const tracker = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
  let history = [];
  let shots = [];
  const fires = [];
  const cancels = [];
  let posed = 0;
  let frozen = false;
  const phaseCounts = {};
  const probes = (windows || []).map((w) => ({ w, done: false, shot: null }));
  for (const fr of frames) {
    const now = fr.tMs + offset;
    const raw = fr.landmarks ? core.computeFormMetrics(fr.landmarks, handedness, frame) : null;
    if (raw) posed++;
    const vel = velSrc.step(history, raw, now);
    history.push({ ts: now, m: raw, vel });
    if (history.length > HISTORY_MAX) history.shift();
    const hadPending = detector.pendingRelease != null;
    const result = core.stepFormPhase(detector, raw, history, 1.0, now);
    phaseCounts[result.phase] = (phaseCounts[result.phase] || 0) + 1;
    for (const p of probes) {
      if (p.done || fr.tMs < p.w.releaseMs) continue;
      p.done = true;
      p.shot = core.summarizeFormShot(
        history,
        p.w.anchorStartMs + offset,
        now,
        detector.adaptive.anchorEnter,
      );
    }
    if (result.canceled) {
      const reason = result.debug && result.debug.cancelReason;
      const action = tracker.cancel(reason);
      cancels.push({ tMs: now - offset, reason: reason || null, receipt: action.deletionTarget });
      if (action.deletionTarget) shots = shots.filter((s) => s.id !== action.deletionTarget);
    } else if (result.released) {
      const action = tracker.begin({ fireTs: now, fire: null });
      fires.push({
        tMs: now - offset,
        evidence: result.debug ? result.debug.fireEvidence || null : null,
        vel: result.debug ? result.debug.fireVel || null : null,
        anchorNorm: result.debug ? result.debug.anchorNorm : null,
      });
      if (action.fatal) {
        frozen = true; // the view freezes capture on a receipt failure
        break;
      }
      const shot = core.summarizeFormShot(history, result.anchorStartTs, now, result.anchorEnter);
      if (shot) {
        shot.id = action.id;
        shot.releaseTs = now;
        shot.anchorStartTs = result.anchorStartTs || null;
        shot.fireEvidence = result.debug ? result.debug.fireEvidence || null : null;
        shots.push(shot);
        tracker.markShotCreated(action.id);
      }
    } else if (hadPending && detector.pendingRelease == null) {
      tracker.confirm();
    }
  }
  if (!frozen && tracker.current()) tracker.abandon("replay-eos");
  return {
    shots: shots.map((s) => ({
      releaseMs: s.releaseTs - offset,
      anchorStartMs: s.anchorStartTs ? s.anchorStartTs - offset : null,
      holdMs: fin(s.holdMs),
      kind: "shot",
      features: shotFeatures(s),
      extra: {
        degraded: !!s.degraded,
        fireEvidence: s.fireEvidence,
        confidence: fin(s.confidence),
      },
    })),
    measured: probes.map((p) => ({ features: p.shot ? shotFeatures(p.shot) : {} })),
    quality: {
      frames: frames.length,
      posedFrames: posed,
      fires: fires.length,
      cancels: cancels.length,
      frozen,
      phaseCounts,
    },
    trace: { fires, cancels },
  };
}

module.exports = {
  name: "current",
  description:
    "Current app pipeline: computeFormMetrics + stepFormPhase + summarizeFormShot, streamed frame by frame as in 47-form-view.js",
  /* features this detector reports; others count as "not provided", not as unavailable */
  provides: ["anchorDist", "bowElbow", "drawElbow", "bowShoulderElev", "drawDrift", "bowDrift"],
  analyze(frames, meta) {
    const out = run(frames, meta, null);
    delete out.measured;
    return out;
  },
  /* optional probe: features measured at the true anchor/release times */
  measure(frames, meta, windows) {
    return run(frames, meta, windows).measured;
  },
  loadCore,
};
