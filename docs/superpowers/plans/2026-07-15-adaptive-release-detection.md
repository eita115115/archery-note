# Adaptive Release Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed close-plus-speed release bottleneck with a session-local, recall-first detector that counts all six real shots across side and slightly oblique phone placement while preserving one-tap correction and existing local-only storage.

**Architecture:** Keep all calibration and release decisions in the DOM-free form core. `stepFormPhase` owns a short-lived adaptive substate, but delegates percentile thresholds, hold evidence, and relative departure to focused deterministic helpers. Capture and replay consume the same detector result, while only live capture gets a geometry-reset helper for camera, handedness, and crop changes. Legacy close, NB, and NB2 paths remain fallbacks and converge into the same fire/pending-release contract.

**Tech Stack:** Vanilla JavaScript, MediaPipe Pose Landmarker, Node assertion scripts, Playwright, Python golden replay, local browser storage.

## Global Constraints

- Follow red-green-refactor: add the named failing assertion before each production change and preserve the observed failure output in the task log.
- Never copy, commit, or read at test runtime `C:\Users\eita2\OneDrive\Documents\archery-note-2026-07-15 2.json`; use only anonymous synthetic values listed in the approved design.
- Add no dependency, network request, cloud inference, stored video, raw landmark persistence, schema migration, settings panel, or primary-screen control.
- Preserve immediate shot insertion, haptic feedback, one-tap removal, one-second refractory behavior, and arrow-presence as annotation only.
- Do not change `APP_VER`, package version, `version.json`, `sw.js`, `CHANGELOG.md`, release tags, or deployment assets before the human 18-shot acceptance gate.
- Keep legacy close/NB/NB2 detection active as a fallback and make every path enter one shared fire block so one frame cannot create two shots.
- Treat elapsed milliseconds as authoritative; minimum sample counts only guard sparse observations.
- Append the exact completed task, commands, and result to `docs/codex/codex-progress.md` after every task.
- Before each commit, run `git status --short`, stage only the files named by that task, and run `git diff --check --cached`.

---

### Task 1: Add deterministic adaptive threshold primitives

**Files:**

- Modify: `scripts/46-form-core.js:38-124` (`FORM_PH` adaptive constants)
- Modify: `scripts/46-form-core.js:167-180` (numeric helpers after `formMedian`)
- Modify: `scripts/46-form-core.js:499-512` (`makeFormPhaseDetector` state)
- Test: `tools/check-form-core.js:20-30` (test loader exports)
- Test: `tools/check-form-core.js:120-153` (adaptive primitive assertions before phase sequences)
- Modify: `docs/codex/codex-progress.md:246-end`

**Interfaces to add:**

```js
adaptiveAnchorThreshold(anchorSamples) -> number
adaptiveReleaseThreshold(holdVelocitySamples) -> number
```

Both functions accept arrays of finite numbers, ignore non-finite entries, and use a linear-interpolated percentile where `position = (n - 1) * q`. Fewer than six usable values returns the cold-start default (`0.35` for anchor, `6` for speed). The detector state gains an `adaptive` object and no persisted state:

```js
adaptive: {
  anchorSamples: [],
  holdSamples: [],
  holdVelocitySamples: [],
  holdSince: 0,
  farSince: 0,
  evidence: null,
  anchorFloor: null,
  anchorEnter: 0.35,
  releaseSpeed: 6,
}
```

- [ ] Extend the `new Function(... return {...})` loader in `tools/check-form-core.js` to expose `adaptiveAnchorThreshold` and `adaptiveReleaseThreshold`.
- [ ] Add exact threshold tests:

```js
assertEqual(
  core.adaptiveAnchorThreshold([0.47, 0.48, 0.49, 0.5, 0.51]),
  0.35,
  "five anchor samples keep cold start",
);
assertClose(
  core.adaptiveAnchorThreshold([0.47, 0.48, 0.49, 0.5, 0.51, 0.52]),
  0.595,
  1e-9,
  "six samples start p10 calibration",
);
assertEqual(
  core.adaptiveAnchorThreshold([0.7, 0.71, 0.72, 0.73, 0.74, 0.75]),
  0.65,
  "anchor threshold is capped",
);
assertEqual(
  core.adaptiveReleaseThreshold([0.1, 0.2, 0.3, 0.4, 0.5]),
  6,
  "five velocity samples keep cold start",
);
assertEqual(
  core.adaptiveReleaseThreshold([7, 7, 7, 7, 7, 7]),
  8,
  "release speed is capped below legacy nine",
);
assertEqual(
  core.adaptiveReleaseThreshold([0.1, 0.2, 0.2, 0.3, 0.3, 7]),
  6,
  "single velocity outlier does not raise the floor",
);
```

- [ ] Run `npm run check:form`. Expected RED: `adaptiveAnchorThreshold is not defined` from the loader or the first new assertion fails because the helper is absent.
- [ ] Add named adaptive constants to `FORM_PH`: 1500 ms sample/evidence windows, six calibration samples, 0.12 anchor padding, 0.35/0.65 anchor clamps, 150 ms and three-frame hold qualification, 0.12 hold range, 12 strength cap, p90+1 speed rule with 6/8 clamps, 0.18 departure, 0.04 direction delta, 1.2 far boundary, and 300 ms far invalidation.
- [ ] Implement one private linear-percentile helper and the two exported adaptive threshold functions without changing `stepFormPhase` behavior.
- [ ] Initialize the exact `adaptive` state in `makeFormPhaseDetector()`; verify two detector instances do not share arrays.
- [ ] Run `npm run check:form`. Expected GREEN: `Form core checks OK` and every pre-existing assertion still passes.
- [ ] Run `npm run lint -- --quiet` and `npx prettier --check scripts/46-form-core.js tools/check-form-core.js docs/codex/codex-progress.md`.
- [ ] Update the progress ledger with Task 1's RED and GREEN evidence.
- [ ] Commit only the four named files: `feat(form): add adaptive detector primitives`.

---

### Task 2: Form and refresh session-local anchor evidence

**Files:**

- Modify: `scripts/46-form-core.js:180-260` (adaptive evidence helper near numeric helpers)
- Modify: `scripts/46-form-core.js:526-929` (`stepFormPhase` evidence, phase, result contract)
- Test: `tools/check-form-core.js:140-330` (sequence helpers and phase regressions)
- Test: `tools/check-form-core.js:1140-1240` (`anchorStartTs` integration)
- Modify: `docs/codex/codex-progress.md:246-end`

**Interface to add:**

```js
updateAdaptiveAnchorEvidence(adaptiveState, raw, history, now) -> {
  anchorEnter,
  releaseSpeed,
  holdQualified,
  holdStartTs,
  evidence
}
```

The helper deterministically updates only the provided detector-local adaptive state. `anchorSamples` and `holdSamples` contain `{ ts, norm }`; velocity samples contain `{ ts, value }`. `evidence` snapshots `{ ts, normAtHold, anchorEnter, releaseSpeed, strength }` so fire-time decisions remain explainable.

- [ ] Expose `updateAdaptiveAnchorEvidence` in the Node loader and add a reusable `adaptiveStepper(dt)` that pushes the current frame into history before calling `stepFormPhase`, matching the browser contract.
- [ ] Add a RED test proving five usable draw frames leave `anchorEnter === 0.35`, while the sixth starts calibration.
- [ ] Add a RED oblique-hold test with three or more samples spanning exactly 150 ms near `anchorNorm=0.47`, `drawArm=150`, and range below 0.12. Require `ANCHORING`, non-zero `anchorStartTs` equal to the first qualifying hold sample, `anchorEnter > 0.47`, and non-null evidence.
- [ ] Add a RED long-hold test: a 3-second qualified hold must reach `FULL_DRAW`; `debug.evidenceAgeMs` must remain zero on the latest qualifying frame rather than expiring at 1.5 seconds.
- [ ] Add RED expiry tests: null/brief unusable frames preserve evidence through 1500 ms from the last qualifying hold; the first call after the limit clears it.
- [ ] Add RED far-position tests: `anchorNorm > 1.2` for 299 ms preserves evidence, while 300 ms without `pendingRelease` invalidates it.
- [ ] Add a RED quick-draw test where fewer than three stable samples or less than 150 ms never forms adaptive evidence and never enters adaptive `ANCHORING`.
- [ ] Run `npm run check:form`. Expected RED: the 0.47 oblique hold remains `SETUP`/`DRAWING`, has no evidence, or lacks the new debug/result fields.
- [ ] Implement the 1.5-second usable sample window (`drawArm > 125 && anchorNorm < 1.3`), p10 threshold update, stable hold range, long-hold timestamp refresh, timeout, and far invalidation. Call the update before the null-frame early return so evidence can age without fabricated samples.
- [ ] Generalize phase classification to `absolute close || qualified adaptive hold`; set `anchorSince` and sticky `anchorStartTs` to the qualifying hold's first sample; keep `FULLDRAW_MS=350` unchanged.
- [ ] Return `anchorEnter` on every `stepFormPhase` path, including null, pending cancellation, RELEASE lock, FOLLOW, fire, and normal non-fire. Add `anchorFloor`, `anchorEnter`, `releaseSpeed`, `evidenceAgeMs`, and `evidenceStrength` to the debug object, using `null` when unknowable rather than fabricated values.
- [ ] Generalize NB2's pre-gap anchor check to the valid evidence's active `anchorEnter`; retain `CLOSE_IN` before evidence exists.
- [ ] Run `npm run check:form`. Expected GREEN: all new evidence/phase boundaries and the existing sticky/NB/NB2 cases pass.
- [ ] Run `npm run check:globals`, `npm run lint -- --quiet`, and Prettier on the three changed source/test/docs files.
- [ ] Update the progress ledger with the evidence and phase-boundary results.
- [ ] Commit only the named files: `feat(form): learn session anchor evidence`.

---

### Task 3: Count relative adaptive departures and the six-shot field profiles

**Files:**

- Modify: `scripts/46-form-core.js:200-300` (relative departure helper)
- Modify: `scripts/46-form-core.js:750-900` (candidate convergence and shared fire block)
- Test: `tools/check-form-core.js:140-330` (anonymous field fixtures and let-down boundaries)
- Test: `tools/check-form-core.js:720-760` (multi-shot/refractory coverage)
- Modify: `docs/codex/codex-progress.md:246-end`

**Interface to add:**

```js
adaptiveReleaseCandidate(evidence, raw, history, now) -> {
  matched,
  departDelta,
  movingAway,
  maxV,
  releaseSpeed
}
```

`history` already contains the current frame. Direction uses the median `anchorNorm` of the previous three usable entries with `ts < now`; the boundary is inclusive (`current - previousMedian >= 0.04`). Candidate matching also requires evidence age `<=1500`, `departDelta >=0.18`, short-window `maxV >= evidence.releaseSpeed`, and leaves the one-second refractory check to the shared fire block.

- [ ] Extend `runSequence` to collect each fire's `debug.fireEvidence` without changing its existing `releases` semantics.
- [ ] Add anonymous generators for the three field-derived profiles. Do not include record IDs, dates, video, landmarks, or the private backup path in fixtures:

```js
function adaptiveFieldProfile({ anchor, releaseNorm, releaseVel }) {
  const seq = [];
  for (let i = 0; i < 12; i++) seq.push([mkRaw(1.35 - i * 0.07, 110 + i * 3), 0.5, 20]);
  for (let i = 0; i < 30; i++)
    seq.push([mkRaw(anchor + (i % 3) * 0.005, 150), i === 9 ? 7 : 0.2, 20]);
  seq.push([mkRaw(releaseNorm, 140), releaseVel, 20]);
  for (let i = 0; i < 60; i++) seq.push([mkRaw(1.0, 90), 0.1, 20]);
  return seq;
}
```

- [ ] Add three RED assertions: profile A (`anchor=0.47`, `releaseNorm=0.75`, `releaseVel=18.4`), profile B (`0.18`, `0.50`, `8.5`), and profile C (`0.46`, `0.74`, `12.8`) each count exactly one and report `fireEvidence === "adaptive"`.
- [ ] Add a RED six-shot end by concatenating six qualified hold/depart cycles with at least 1100 ms of setup/follow-through between fires. Require exactly six release receipts and six adaptive evidence labels.
- [ ] Add RED direction-boundary helper assertions with evidence `normAtHold=0.47`: a current frame only `+0.03` beyond the prior-three median must not match; exactly `+0.04` must match when the total departure is at least 0.18.
- [ ] Add RED safety assertions: a slow let-down below speed 6 counts zero; a noisy hold with one velocity outlier near 7 still permits the 8.5 release; repeated departure frames inside one second count only once.
- [ ] Re-derive the approved fast-let-down boundary explicitly: the existing synthetic 100 ms linear let-down may create one removable adaptive candidate; keep every listed 150-2000 ms case at zero. Change only the 100 ms expectation and comment it as the user-approved recall tradeoff, not a silent regression deletion.
- [ ] Run `npm run check:form`. Expected RED: profiles A and C fail for missing close evidence, profile B fails below the legacy speed 9 threshold, and the six-shot assertion reports fewer than six.
- [ ] Implement `adaptiveReleaseCandidate` and compute it from valid adaptive evidence. Require positive relative departure and the previous-three direction check; never allow a null current frame to match.
- [ ] Refactor legacy close, NB, NB2, and adaptive matches into a single `fireEvidence` selection and one refractory/fire block. Give adaptive precedence for diagnostics when it matches, but do not disable fallbacks.
- [ ] Snapshot `fireEvidence`, `anchorEnter`, and the fire-time threshold into `pendingRelease`; clear adaptive evidence only after a confirmed fire has entered the shared block.
- [ ] Set `debug.departDelta` and `debug.fireEvidence` on the relevant decision/fire frames. Preserve `debug.fireVel` for legacy field-audit compatibility.
- [ ] Run `npm run check:form`. Expected GREEN: A/B/C are one each, the synthetic end is six, the agreed safety cases hold, and legacy/NB/NB2 regressions remain green.
- [ ] Run `npm run check:globals`, `npm run lint -- --quiet`, and Prettier on changed files.
- [ ] Update the progress ledger with the exact A/B/C and six-shot counts.
- [ ] Commit only the named files: `feat(form): detect adaptive release departures`.

---

### Task 4: Apply adaptive-only post-fire cancellation semantics

**Files:**

- Modify: `scripts/46-form-core.js:526-700` (pending-release confirmation/cancellation)
- Modify: `scripts/46-form-core.js:820-900` (pending snapshot at fire)
- Test: `tools/check-form-core.js:729-1000` (cancel, no-depart, and pose-loss boundaries)
- Test: `tools/check-form-core.js:1200-1240` (`anchorStartTs` after cancellation)
- Modify: `docs/codex/codex-progress.md:246-end`

**Adaptive pending contract:**

```js
pendingRelease: {
  ts,
  fireEvidence: "adaptive",
  anchorEnter,
  departCheck: false,
  returnSince: 0,
  returnCount: 0,
  nb2Ref: null,
}
```

Legacy pending objects retain their current depart and NB2 checks. Adaptive return cancellation is limited to `CONFIRM_MS=400` and requires both 150 ms elapsed from the first consecutive inside-threshold frame and at least four usable inside frames. The stored fire-time `anchorEnter`, not a later calibration value, is authoritative.

- [ ] Add a helper in tests that first creates a real adaptive fire and then feeds confirmation frames while tracking net releases (`released` increments, `canceled` decrements).
- [ ] Add a RED test where all frames after an adaptive fire are null through the confirmation window; net shots must remain one and no `no-depart` cancellation may appear.
- [ ] Add a RED test where the hand returns inside the stored adaptive `anchorEnter` for four usable frames spanning exactly 150 ms within 400 ms; require one `anchor-return` cancellation and net zero.
- [ ] Add a RED fire-time-boundary test: mutate or relearn the detector's current `anchorEnter` after fire, then prove return cancellation still compares against `pendingRelease.anchorEnter`.
- [ ] Add a RED timeout test: the same four-frame 150 ms return beginning after 400 ms must not cancel the shown shot.
- [ ] Add a RED transient test: three inside frames or 149 ms inside the threshold must not cancel.
- [ ] Keep and rerun the existing legacy tests for 100 ms/three-frame cancellation, NB2 drift, NB2 unobserved, no-depart, and sticky `anchorStartTs`; their expectations must not be globally changed to adaptive values.
- [ ] Run `npm run check:form`. Expected RED: adaptive fire is still governed by the legacy 100 ms/three-frame and `no-depart` behavior or uses the live `CLOSE_IN` boundary.
- [ ] Branch pending-release handling by `fireEvidence`. Skip `departCheck`, `no-depart`, and NB2 drift cancellation for adaptive fire because positive departure was required before fire.
- [ ] Implement adaptive consecutive return accumulation against the stored fire-time boundary; reset both return timer and count on any usable outside frame. Null frames add neither evidence nor cancellation count.
- [ ] Preserve immediate UI insertion and `lastReleaseTs`; on cancellation keep the existing UI-facing `canceled: true` contract and cooldown behavior.
- [ ] Run `npm run check:form`. Expected GREEN: adaptive confirmation boundaries and all legacy pending tests pass together.
- [ ] Run `npm run check:globals`, `npm run lint -- --quiet`, and Prettier on changed files.
- [ ] Update the progress ledger with the 150/400 ms boundary evidence.
- [ ] Commit only the named files: `fix(form): protect confirmed adaptive shots`.

---

### Task 5: Wire active geometry through summaries, capture, replay, reset, and diagnostics

**Files:**

- Modify: `scripts/46-form-core.js:993-1042` (`summarizeFormShot` signature/window)
- Modify: `scripts/47-form-view.js:245-492` (capture state, detector result, shot summary, diagnostics)
- Modify: `scripts/47-form-view.js:573-595` (live geometry controls)
- Modify: `scripts/47-form-view.js:630-760` (replay parity)
- Modify: `scripts/47-form-view.js:830-835` (replay handedness detector reset remains local)
- Test: `tools/check-form-core.js:1-30` (load view source for static integration contracts)
- Test: `tools/check-form-core.js:1241-1390` (adaptive summary window)
- Test: `tools/check-form-core.js:1390-1445` (capture/replay source contracts)
- Modify: `docs/codex/codex-progress.md:246-end`

**Signature change:**

```js
summarizeFormShot(history, anchorStartTs, releaseTs, activeAnchorEnter);
```

The primary summary window uses `anchorNorm < Math.max(0.45, finite activeAnchorEnter or 0.35)`. Existing three-argument calls therefore retain the current 0.45 behavior.

**Live capture reset helper:**

```js
function resetCaptureGeometry() {
  if (pendingCheck) finalizeArrowCheck();
  detector = makeFormPhaseDetector();
  ema = makeFormEma(0.38);
  history = [];
  velSrc.reset();
  presenceRing = [];
  pendingCheck = null;
  recentFrames = [];
  lastAnchoringSampleAt = 0;
}
```

It must not edit `shots`, remove rendered shot rows, or clear the session diagnostic arrays. Camera swap, live handedness, and crop toggle call it. Replay does not call this capture-only helper; its existing handedness change still recreates its replay detector/EMA/history/velocity state.

- [ ] Add a RED summary test whose valid hold frames use `anchorNorm=0.55` and `activeAnchorEnter=0.60`. The four-argument call must use those frames without degraded fallback, while the three-argument call preserves the existing window behavior.
- [ ] Read `scripts/47-form-view.js` in `tools/check-form-core.js` and add bounded static assertions over the `openFormCapture` section: `resetCaptureGeometry` exists; `#fcSwap`, `#fcHand`, and `#fcCrop` handlers call it; the helper resets detector/EMA/history/velocity/presence/pending annotation but does not assign `shots=[]`.
- [ ] Add static parity assertions that capture and replay pass `r.anchorEnter` into `summarizeFormShot`, and that no `resetCaptureGeometry()` call appears inside the `openFormReplay` section.
- [ ] Add a RED diagnostic-shape assertion on an adaptive fire containing finite `anchorFloor`, `anchorEnter`, `releaseSpeed`, `evidenceAgeMs`, `evidenceStrength`, `departDelta`, and `fireEvidence="adaptive"`.
- [ ] Run `npm run check:form`. Expected RED: the four-argument summary still excludes 0.55 frames and the view lacks the shared reset and `anchorEnter` wiring.
- [ ] Generalize `summarizeFormShot` with the optional fourth argument; keep fallback order, `holdMs`, privacy, and storage shape otherwise unchanged.
- [ ] Pass `anchorEnter` from every detector result into both capture and replay `onShot`, then into the summarizer. Preserve diagnostic-off behavior; existing `{ts, phase, ...debug}` snapshots automatically gain only small derived fields when `formDebug===true`.
- [ ] Add the capture-only reset helper exactly once. Call it after toggling the chosen camera/crop/handedness geometry and before processing another frame. Finalize a pending arrow annotation before clearing it so an already counted shot is never removed by geometry reset.
- [ ] Keep the replay handedness reset independent, because replay has no camera/crop geometry control and no live presence ring.
- [ ] Do not add a settings panel or numeric threshold display. Keep the existing compact placement hint; no new HUD copy is required for this behavior slice.
- [ ] Run `npm run check:form`, `npm run check:app`, and `npm run check:globals`. Expected GREEN: summary/reset/parity contracts pass and the concatenated browser scripts parse with no undefined reference.
- [ ] Run `npm run lint -- --quiet` and Prettier on all four changed files.
- [ ] Update the progress ledger with summary parity and geometry-reset evidence.
- [ ] Commit only the named files: `feat(form): wire adaptive capture geometry`.

---

### Task 6: Run repository gates and hand off the local beta for field acceptance

**Files:**

- Modify: `docs/codex/codex-progress.md:246-end`
- Verify only: `scripts/46-form-core.js`, `scripts/47-form-view.js`, `tools/check-form-core.js`

- [ ] From a clean task checkpoint, run `npm run check:form`. Expected: `Form core checks OK` with A/B/C = 1/1/1 and the synthetic six-shot end = 6.
- [ ] Run `npm run check:app` and `npm run check:globals`. Expected: both exit 0; concatenated browser scripts parse and all cross-file identifiers resolve.
- [ ] Run `npm run lint`. Expected: exit 0 with no ESLint errors.
- [ ] Run `npm run format:check`. Expected: every tracked format target passes.
- [ ] Run `npm run golden:replay`. Expected: the checked-in golden corpus completes without a release-count regression; record the exact summary emitted by the script.
- [ ] Run `npm run check:all`. Expected: all app, analysis, form, security, UI, PWA, storage, and version gates exit 0 without changing version markers.
- [ ] Run `npm run test:e2e`. Expected: the Playwright suite exits 0.
- [ ] Run `git diff --check main..HEAD` and inspect `git diff --stat main..HEAD`. Confirm the private backup, version markers, Service Worker, dependencies, and release files are absent from the diff.
- [ ] Update `docs/codex/codex-progress.md` with the exact commands/results, current commit, known synthetic 100 ms let-down tradeoff, and this human matrix:
  - true side view: 6/6 real shots;
  - slightly oblique view: 6/6 real shots;
  - normal range placement chosen without detector optimization: 6/6 real shots;
  - no more than one removable false positive per end;
  - no shown true shot is automatically removed;
  - every diagnostic fire identifies adaptive thresholds and fire evidence.
- [ ] Commit the verified progress update only: `docs: prepare adaptive detector field acceptance`.
- [ ] Stop before version bump, deployment, or production-ready claims. Ask the user to perform the three-end phone test and provide the new privacy-safe diagnostic export if any row fails.
- [ ] If the field matrix passes, open a separate release/version task. If it fails, resume diagnosis from `anchorFloor`, `anchorEnter`, `releaseSpeed`, `evidenceAgeMs`, `evidenceStrength`, `departDelta`, `fireEvidence`, and `cancelReason`; do not make another blind threshold change.

## Final Self-Review Checklist

- [ ] Every approved design rule maps to at least one task and one assertion or explicit integration check.
- [ ] Run the writing-plans unfinished-marker scan and confirm zero matches.
- [ ] Confirm all named functions, result fields, pending fields, and `summarizeFormShot` argument order are consistent across Tasks 1-5.
- [ ] Confirm no task authorizes schema, dependency, cloud, video persistence, version, Service Worker, release, or deployment changes.
- [ ] Confirm the plan ends at a local beta plus human field gate and does not claim the 18-shot outcome before phone evidence exists.
