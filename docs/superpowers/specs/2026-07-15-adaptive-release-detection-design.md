# Adaptive Release Detection Design

## Product decision

Archery Note will optimize form-tracking release detection for recall: a six-arrow end should not lose real shots. A small number of false positives is acceptable because the capture list already supports one-tap removal. The detector will stop relying on one fixed camera-geometry threshold and instead learn a short-lived anchor reference from each capture session.

This passes the product gates:

1. It connects pose capture to the existing form record and analysis flow rather than adding a standalone tool.
2. Reliable per-shot samples make form change over time visible.
3. Calibration and detection stay fully on-device; video and landmark streams are not persisted.
4. Automatic counting with one-tap correction is practical for daily range use and adds no primary-screen control.

## Evidence and root cause

The 2026-07-15 diagnostic backup contained three APP_VER 83 field records at about 60 fps. All three ended with zero shots, zero `canceledEvents`, and zero final `RELEASE` fires:

- Record A had 73 frames above the fixed velocity threshold, but no frame below `CLOSE_IN=0.35`; observed `anchorNorm` started at 0.473.
- Record B had 42 frames below `CLOSE_IN` and up to 16 close frames in the release window, but maximum velocity was 8.518, below `RELEASE_TH=9`.
- Record C had 68 frames above the fixed velocity threshold, but no frame below `CLOSE_IN`; observed `anchorNorm` started at 0.455.

The user reported that Record B was probably filmed closer to a true side view. The current two-dimensional nose-to-wrist distance changes with camera yaw, so fixed close and speed gates do not reliably co-occur. The failure is structural AND-gate starvation, not post-fire cancellation or shot summarization.

## Goals

- Count all real shots across normal side and slightly oblique phone placement.
- Preserve the existing one-second refractory period so one release cannot count twice.
- Keep let-down false positives low enough to correct with the existing one-tap removal flow.
- Explain every adaptive decision in diagnostic data without storing video or full landmark streams.
- Keep the detector pure and deterministic enough for Node regression tests and golden replay.

## Non-goals

- No cloud inference, analytics SDK, account, or new dependency.
- No persisted biometric calibration profile and no storage-schema change.
- No hard dependency on arrow-presence computer vision in this iteration.
- No redesign of form-analysis cards, navigation, Service Worker behavior, or release markers in the behavior-change slice.
- No claim of production readiness until the field acceptance matrix passes.

## Considered approaches

### 1. Loosen fixed thresholds

Rejected. Lowering only `CLOSE_IN` does not rescue Record B, and lowering only `RELEASE_TH` does not rescue Records A and C. Lowering both would admit more draw and let-down spikes without creating a stable anchor reference.

### 2. Session-local anchor evidence and relative departure

Selected. Detect a short stable hold relative to the current camera geometry, retain that evidence briefly, and recognize release as a rapid departure from that learned hold. This separates “the archer reached anchor” from “the hand departed” instead of requiring both facts inside the same 250 ms absolute-threshold window.

### 3. Pose candidate plus mandatory arrow-presence confirmation

Deferred. Arrow presence remains useful as shadow evidence, but bow occlusion, lighting, thin-arrow contrast, and ROI alignment can create a second recall bottleneck. It must not block shot counting until field data proves that it improves recall as well as precision.

## Architecture

### Pure adaptive model

Add pure helpers to `scripts/46-form-core.js` and keep their state inside `makeFormPhaseDetector()`:

```js
adaptiveAnchorThreshold(anchorSamples) -> number
adaptiveReleaseThreshold(holdVelocitySamples) -> number
updateAdaptiveAnchorEvidence(adaptiveState, raw, history, now) -> evidence | null
adaptiveReleaseCandidate(evidence, raw, history, now) -> decision
```

The detector state gains:

```js
adaptive: {
  anchorSamples: [],
  holdVelocitySamples: [],
  holdSince: 0,
  evidence: null,
  anchorEnter: 0.35,
  releaseSpeed: 6
}
```

This state exists only for the active capture or replay. It resets when capture starts, handedness changes, the camera is swapped, crop mode changes, or the workflow closes.

### Adaptive anchor threshold

- Maintain at most the latest 1.5 seconds of usable `anchorNorm` samples while `drawArm > 125` and `anchorNorm < 1.3`.
- Compute the session-local floor as the 10th percentile of at least six samples.
- Set `anchorEnter = clamp(floor + 0.12, 0.35, 0.65)`.
- Before six samples exist, retain the current `0.35` threshold; do not fabricate calibration.
- A hold candidate requires at least three usable samples spanning 150 ms inside `anchorEnter`, with an `anchorNorm` range no greater than `0.12`.
- When the hold candidate qualifies, store `evidence = { ts, normAtHold, anchorEnter, strength }`, where `normAtHold` is the median of the qualifying samples and `strength` is their count capped at 12.
- Evidence remains valid for 1.5 seconds through brief pose loss or phase-label changes. It expires on timeout, confirmed release, explicit reset, or a return to a new setup without a hold.

This allows an oblique capture with a stable hold near 0.47 to calibrate around 0.59 while preserving the stricter 0.35 floor for a true side view.

### Adaptive release threshold and candidate

- Collect velocity samples only from the qualifying hold window.
- With at least six hold samples, set `releaseSpeed = clamp(p90(holdVelocitySamples) + 1.0, 6, 9)`; otherwise use `6`.
- A release candidate requires all of the following:
  - valid anchor evidence no older than 1.5 seconds;
  - current `anchorNorm - evidence.normAtHold >= 0.18`;
  - movement is away from the face;
  - current short-window `maxV >= releaseSpeed`;
  - the one-second refractory period has elapsed.
- A qualifying candidate is counted immediately and tagged `fireEvidence: "adaptive"`.
- Existing close-window and NB/NB2 paths remain available as fallback during the first implementation. They must feed the same pending-release and diagnostic contract.

The fixed lower speed bound of 6 is intentionally recall-first. The stable-hold and relative-departure requirements replace the safety that the old fixed value of 9 attempted to provide by itself.

### Post-fire behavior

- Preserve immediate UI insertion, haptic feedback, one-tap removal, and the one-second refractory period.
- Adaptive fire already contains positive departure evidence, so it does not use `no-depart` cancellation.
- Automatically cancel only when the hand clearly returns inside the learned `anchorEnter` for at least 150 ms and at least four usable frames.
- Pose loss or insufficient follow-through observations do not cancel an adaptive shot.
- Arrow presence remains a saved `shot-match` / `letdown-mismatch` / `unclear` annotation and never removes a shot in this iteration.

## Data flow and privacy

```text
MediaPipe landmarks in memory
  -> existing normalized form metrics
  -> session-local adaptive anchor model
  -> relative release candidate
  -> existing shot summary and capture list
  -> derived feature record only when the user saves
```

No video, image pixels, or full landmark sequence is added to persisted data. With diagnostic saving enabled, additive event fields may include:

- `anchorFloor`
- `anchorEnter`
- `releaseSpeed`
- `evidenceAgeMs`
- `evidenceStrength`
- `departDelta`
- `fireEvidence`
- `cancelReason`

These values are small derived numbers inside the existing forward-compatible diagnostic object. Normal capture with diagnostics off keeps the current storage size and shape.

## UI behavior

- Add no new primary control.
- Continue showing the existing phase label, shot list, FPS warning, and remove button.
- The adaptive model runs automatically after capture begins.
- Camera swap, handedness change, and crop change silently reset calibration so stale geometry cannot count a shot.
- If calibration has not formed after several seconds of drawing, the existing HUD may show one compact hint: “カメラをできるだけ真横に置いてください”. Do not add a settings panel or expose numeric thresholds.

## Error handling

- At less than 15 fps, keep the existing accuracy warning. All dwell, evidence, and cancellation requirements use elapsed milliseconds plus a small minimum sample count, not frame count alone.
- A null pose frame preserves valid evidence until its 1.5-second expiry but cannot create a release by itself.
- Non-monotonic timestamps remain ignored by the existing replay guard.
- If adaptive calibration cannot form, legacy close/NB/NB2 behavior remains available and diagnostics record why adaptive evidence was absent.

## Test design

All production behavior changes follow red-green-refactor. Tests are added to `tools/check-form-core.js` before detector changes.

### Required failing regressions

1. Oblique-anchor profile A: stable hold near 0.47 plus max velocity 18.4 must count exactly one release; the current detector counts zero.
2. Side-view profile B: close evidence near 0.18 plus maximum velocity 8.5 must count exactly one release; the current detector counts zero.
3. Oblique-anchor profile C: stable hold near 0.46 plus max velocity 12.8 must count exactly one release; the current detector counts zero.
4. Six-shot end: six hold/depart cycles with normal inter-shot setup must count exactly six releases.

### Safety regressions

- Slow let-down after a qualified hold stays below the speed floor and counts zero.
- A quick draw without a 150 ms stable hold counts zero.
- One release cannot count twice during the refractory period.
- Camera/crop/handedness reset invalidates old evidence.
- Clear return to the learned anchor for 150 ms and four samples cancels one false candidate.
- Pose loss after an adaptive fire does not cancel the real shot.
- All existing form-core, golden-replay, app, globals, lint, and E2E checks remain green.

The private backup is not committed. Regression fixtures use anonymous synthetic sequences derived from its aggregate ranges. A later privacy-safe compressed trace format may be added only if the first adaptive field run still cannot explain failures.

## Delivery slices

1. Test-only red cases and adaptive pure helpers.
2. Integrate adaptive evidence and release candidates into the detector.
3. Reset behavior, diagnostics, capture/replay parity, and focused UI hint.
4. Full verification and a local beta build.
5. Human field acceptance, followed by a separate release/version task only after the matrix passes.

## Field acceptance

The beta is accepted only after the same user records three complete ends:

- one true side view;
- one slightly oblique view;
- one normal range setup chosen without optimizing for the detector.

Required outcome:

- 18 of 18 real shots counted;
- no more than one removable false positive per end;
- no true shot removed automatically after being shown;
- diagnostic output identifies the adaptive thresholds and fire path for every counted shot;
- phone workflow remains usable without touching a calibration control.

Failure to meet the matrix returns the work to diagnosis using the saved adaptive event values. It does not authorize another blind threshold change.

## Expected files in implementation

- `scripts/46-form-core.js`
- `scripts/47-form-view.js`
- `tools/check-form-core.js`
- `docs/codex/codex-progress.md`

Release markers, `CHANGELOG.md`, and Service Worker assets are handled in a separate release slice after field acceptance.
