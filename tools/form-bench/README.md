# Form-tracking benchmark (`tools/form-bench/`)

射型の記録（`scripts/46-form-core.js` / `47-form-view.js`）の検出器を、正解の分かっている
合成の射手で測るための物差しです。実際の映像は一切使いません。MediaPipe Pose がアプリへ渡すのと
同じ形（33 点の正規化ランドマーク、時刻 ms）を作り、どの検出器も同じ規則で採点します。
これは現実ではありません。数値は「この仮定の下での」比較にだけ使ってください。

A synthetic measuring stick for archery form tracking. A kinematic 3D archer with known ground
truth is filmed by a pinhole camera, corrupted with a MediaPipe-like error model, and fed to any
detector through the same interface MediaPipe Pose gives the app. Node only, no dependencies,
deterministic for fixed seeds. Not part of `npm run check:all`.

## Run

```sh
npm run bench:form                                   # current detector, full matrix, 5 seeds
npm run bench:form -- --scenario side-landscape,portrait --seeds 3
npm run bench:form -- --group core --out /tmp/bench.json
npm run bench:form -- --adapter path/to/my-detector.js
node tools/form-bench/test-bench.js                  # sanity tests of the benchmark itself
```

The runner prints a table and writes JSON (default `<os tmpdir>/archery-note-form-bench/<adapter>.json`;
nothing is written into the repo unless `--out` points there). The full matrix takes about 25 s.

## Files

| File                           | Role                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `simulator.js`                 | 3D stick figure (33 landmark indices) and the session motion script          |
| `camera.js`                    | pinhole camera: placement, frame size/orientation, projection, normalization |
| `noise.js`                     | frame clock and the MediaPipe-like detector-noise model                      |
| `truth.js`                     | ground truth: event times and per-shot features (3D and 2D image)            |
| `scenarios.js`                 | the scenario matrix                                                          |
| `metrics.js`                   | matching and scoring (detector-agnostic)                                     |
| `run-bench.js`                 | CLI runner (`npm run bench:form`)                                            |
| `adapters/current-pipeline.js` | the app's current pipeline, streamed exactly like `47-form-view.js`          |
| `adapters/truth-oracle.js`     | returns the truth; used only to self-check the scorer                        |
| `test-bench.js`                | sanity tests                                                                 |
| `lib.js`                       | seeded RNG, vectors, easing, quantiles                                       |

## What is modelled

**Body.** Segment lengths as fractions of stature (Winter 2009, Fig. 4.1, after Drillis & Contini
1966): torso (mid-shoulder to mid-hip) 0.288 H, upper arm 0.186 H, forearm 0.146 H, thigh/shank
0.247/0.248 H, with ±2% individual variation; stature 1.58–1.88 m. Shoulder and hip points sit at
the joint centres (0.20 H and 0.13 H apart; assumption, narrower than bi-acromial width). Arms and
legs use two-bone IK, so segment lengths are exact in every frame. All 33 BlazePose indices are
filled (face points, hands from the wrist and hand direction, heels and toes).

**Motion script per session.** Ends of 3 or 6 arrows. Each shot: reload (hand to the quiver,
nock, head down) → set/raise (bow arm from hanging to the aim line, string hand on the string at
brace height + pre-draw, head turns to the target) → draw (minimum-jerk, Flash & Hogan 1985) →
anchor (string fingers under the chin, wrist one palm-length behind) → hold/aim (slow expansion
2–6 mm, bow-hand aiming sway and ~9 Hz tremor, head drift) → release → follow-through → lower.
Optional let-downs (draw, hold 1–4 s, return to the string position over 0.8–2.5 s, lower to the
nock position, retry the same arrow), idle pauses, face-touch fidgets, and walking out of frame to
retrieve arrows (turn, walk 9 m at 1.3 m/s, 20–40 s away, walk back). Per-shot variability:
draw 1–3 s, hold 1.5–6 s, anchor offsets (sd 4 mm), draw-elbow height, bow-elbow angle
(167–177° per archer, sd 1.5° per shot), bow-shoulder rise, head drift, release time constant and
distance. Left-handed archers are the exact mirror image (same seed = same motion).

**Release.** The string hand follows a critically damped step `1-(1+t/τ)e^{-t/τ}` back along the
arrow line (jaw/neck), 0.07–0.12 H back plus 0.01–0.06 H down, τ = 20–40 ms per archer (sd 4 ms
per shot); the bow hand drops/moves forward 2–7 cm / 1–5 cm over ~0.5 s. Resulting true peak
draw-wrist speed: 1.5 / 2.0 / 3.5 m/s (p10/median/p90).

**Camera.** Pinhole, square pixels; yaw (0 = perpendicular on the chest side, positive = behind the
shooting line), pitch, roll, subject size (torso as a fraction of frame height → distance), frame
size and orientation, 69° field of view across the long side (26 mm-equivalent phone camera;
assumption). Output is MediaPipe's normalization: `x = u / width`, `y = v / height`, `z` relative
to the hip-midpoint depth on the scale of x, `visibility` in [0, 1].

**Detector-noise model (nominal preset).** Magnitudes are in torso lengths of the subject as it
appears in the image:

- jitter: fast AR(1) (τ 40 ms) + slow bias (τ 800 ms, ×1.2); sd face 0.014, shoulder 0.018,
  hip 0.024, elbow 0.028, wrist 0.032, hand 0.05; ×(160 px / torso px)^0.8 when the torso is
  smaller than 160 px; z jitter ×3;
- MediaPipe landmark filter: one-euro (Casiez et al. 2012) with min_cutoff 0.05, beta 80,
  d_cutoff 1, values scaled by the subject size; reset after a lost frame;
- visibility: per-class base (shoulder 0.95, nose 0.93, wrist 0.86, elbow 0.84, hand 0.72), sd 0.12,
  60 ms low-pass; −0.18 for the bow hand while the bow is raised; −0.1 and jitter ×1.5 for the draw
  hand within 0.75 torso of the nose; −0.35 and jitter ×1.8 behind the torso or the head;
  0.03–0.25 and jitter ×2.5 off-screen;
- events: draw-hand drop-outs at the face (0.12/s, 80–320 ms; visibility 0.05–0.35; position frozen,
  slid 30–60% toward the nose, or slid toward the elbow); release blur (30% of shots: the wrist sticks
  at its pre-release position for 30–90 ms, then snaps); whole-body and arm-only left/right swaps
  (0.006/s each, 1–6 frames); elbow flips across the shoulder–wrist line when an arm segment is
  shorter than 0.35 torso in the image (0.6/s at the limit, 1–4 frames);
- no pose: isolated frames (0.4%), bursts (0.01/s, 100–600 ms), release-time tracking loss (12% of
  shots, 60–300 ms), subject out of frame (torso midpoints outside the image), optional ghost poses
  while nobody is in frame;
- frame clock: nominal fps with Gaussian jitter (default 2 ms), 1% dropped frames, stalls of
  100–350 ms (0.5 per minute).

**Calibration against real MediaPipe output.** Only MediaPipe statistics of the two golden metric
fixtures were used (never the detector's thresholds): `conf` median 0.75–0.80, draw-wrist visibility
median 0.74–0.80, frame-to-frame draw-wrist motion during the hold median 0.019–0.051 / p90
0.077–0.164 torso (`docs/design/form-tracking-accuracy.md` §2.5). The nominal preset gives conf 0.79,
visibility median 0.75 (p10 0.65), hold wrist step 0.025 / 0.061 torso in the same units.

## What is not modelled

This is not reality. Missing or guessed: the bow, string, arrow, tab and clothing as occluders
(occlusion is a visibility/jitter rule, not geometry); lighting, motion blur and background; real
MediaPipe failure modes (only a hand-made list of them, with guessed rates); MediaPipe's real
temporal filter in tasks-vision 0.10.14 (the one-euro parameters are the legacy pose-graph values as
recalled, not verified); body shapes outside the anthropometric ranges; other people in frame;
camera shake; compound bows and other styles; the arrow-presence check (pixels are not rendered);
the centre-crop mode. Release kinematics are the largest assumption (see below). Arrow-retrieval
time is compressed to 20–40 s.

## Ground truth and feature contract

Per cycle: `kind` (`shot` / `letdown`), `drawStartMs`, `anchorMs` (end of the draw),
`releaseMs` (the instant the string hand starts its release motion), `holdMs = releaseMs −
anchorMs`, `drawMs`, and for let-downs `letdownStartMs` / `letdownEndMs`. Features are measured on
the noise-free motion every 10 ms, in true 3D (`t3`, metres / true torso) and in the noise-free image
(`t2`, square pixels / projected torso). A detector reports the same keys in `features`:

| key               | definition                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| `anchorDist`      | draw wrist to nose / torso, median over the hold                            |
| `anchorBack`      | wrist − nose along the arrow, away from the target / torso                  |
| `anchorDown`      | wrist − nose downward / torso                                               |
| `bowElbow`        | bow-arm interior elbow angle (deg, 180 = straight), median over the hold    |
| `drawElbow`       | draw-arm interior elbow angle (deg), median over the hold                   |
| `bowShoulderElev` | (bow-shoulder height − draw-shoulder height) / torso                        |
| `headMove`        | nose displacement from anchor to release / torso                            |
| `drawDrift`       | draw-wrist displacement over the last 500 ms before release / torso         |
| `bowDrift`        | bow-wrist displacement over the last 500 ms before release / torso          |
| `followDist`      | draw-wrist displacement from release to release + 300 ms / torso            |
| `followDir`       | its direction (deg): 0 = straight back along the arrow, positive = downward |

## Adding a detector

A detector is a CommonJS module:

```js
module.exports = {
  name: "my-detector",
  provides: ["anchorDist", "bowElbow", "drawElbow"], // feature keys it reports
  /* frames: [{tMs, landmarks: 33 x {x, y, z, visibility} | null}] in time order;
     meta: {frame: {w, h}, handedness: "right" | "left", fps} */
  analyze(frames, meta) {
    return {
      shots: [{ releaseMs, anchorStartMs, holdMs, kind: "shot", features: { anchorDist } }],
      quality: {}, // free-form, copied into the JSON
    };
  },
  /* optional: features measured at the TRUE times; windows = [{anchorStartMs, releaseMs}] */
  measure(frames, meta, windows) {
    return windows.map(() => ({ features: {} }));
  },
};
```

Run it with `npm run bench:form -- --adapter path/to/module.js`. A streaming detector can loop over
`frames` inside `analyze` (that is what `adapters/current-pipeline.js` does). Shots with
`kind: "letdown"` are ignored by the scorer; report only shots you would count. `measure` separates
"does it find the shot" from "does it measure the shot": the runner prints a second table with
feature errors at the true anchor/release times.

## Metrics

- A detected release matches a true release within ±150 ms, one-to-one, closest first.
  Precision, recall, F1; release-time error (signed median `bias`, median |e|, p90 |e|, and a 10 ms
  histogram in the JSON); hold-time and anchor-start errors on matched shots.
- Unmatched detections are false positives, classified as `letdown` (anchor − 300 ms to let-down end
  - 1 s: "let-downs counted as shots"), `mistimed` (within 1 s of a true release), or the archer's
    activity at that moment (`idle`, `reload`, `raise`, `draw`, `hold`, `follow`, `lower`, `walk`,
    `fidget`, ...).
- Feature error on matched shots: |detected − truth| against the 2D image truth (`e2D`) and the 3D
  truth (`e3D`); `n/a` = matched shots whose value is null; `n/p` = not provided by the adapter.
- `OVERALL (core)` pools the `core` scenarios; `reference` (noise-free) and `sensitivity` scenarios
  are reported separately.

## Scenario matrix

| id                   | group       | what changes                                                              |
| -------------------- | ----------- | ------------------------------------------------------------------------- |
| `ideal-side`         | reference   | noise-free landmarks, 60 fps, true side view                              |
| `side-landscape`     | core        | 1280×720, 30 fps, torso 22% of frame height, nominal noise                |
| `portrait`           | core        | 720×1280, torso 17%                                                       |
| `small-subject`      | core        | 1920×1080, torso 13% (like the golden fixtures)                           |
| `oblique-20` / `-40` | core        | camera 20° / 40° behind the perpendicular                                 |
| `fps15`              | core        | 15 fps, 5 ms jitter, 3% drops, stalls                                     |
| `occluded-draw-hand` | core        | draw hand at the face: −0.35 visibility, jitter ×3, 0.8 drop-outs/s       |
| `letdowns`           | core        | 40% chance of a let-down before each shot                                 |
| `walk-off`           | core        | 2 ends × 3 arrows, walking out of frame, ghost poses                      |
| `left-handed`        | core        | mirror-image archer                                                       |
| `roll-5`             | core        | camera rolled 5°                                                          |
| `hd60`               | core        | 1920×1080 at 60 fps                                                       |
| `mixed-session`      | core        | portrait, torso 15%, yaw 15°, let-downs, fidgets, walk-off, ghosts        |
| `weak-release`       | sensitivity | follow-through 35% of the assumed distance, τ 50 ms                       |
| `snappy-release`     | sensitivity | τ 12 ms (outside the assumed physiological range)                         |
| `big-release`        | sensitivity | 2.5× distance, τ 20 ms (peak ~20 torso/s, like the check suite's 2D shot) |

## Parameters and sources

| parameter                                                                                             | value                                       | source                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| segment lengths                                                                                       | fractions of H above                        | Winter DA, _Biomechanics and Motor Control of Human Movement_, 4th ed. (2009), Fig. 4.1 (Drillis & Contini 1966)                                                                                                                                               |
| shot phases                                                                                           | set-up, draw, aim, release, follow-through  | phase models in Callaway et al. (indoor recurve, Bournemouth University eprint 24308) and Frontiers in Sports and Active Living 2025, doi:10.3389/fspor.2025.1650300 (elite 70 m archers; aiming duration varies between archers)                              |
| draw 1–3 s, hold 1.5–6 s                                                                              | uniform                                     | task brief; consistent with the varying aiming times reported above (no single number cited)                                                                                                                                                                   |
| draw / let-down / raise profiles                                                                      | minimum-jerk                                | Flash T & Hogan N, _J Neurosci_ 5:1688 (1985)                                                                                                                                                                                                                  |
| anchor: string under the chin, wrist one palm-length behind (0.075 H), nose tip 7.5 cm above the chin | geometry                                    | assumption (anthropometric estimate)                                                                                                                                                                                                                           |
| bow elbow 167–177°                                                                                    | per archer                                  | assumption (near-straight bow arm with a slight bend)                                                                                                                                                                                                          |
| draw elbow                                                                                            | from IK (3D ~28–33° at anchor)              | follows from the segment lengths and the anchor; not a free parameter                                                                                                                                                                                          |
| release τ 20–40 ms, 0.07–0.12 H back                                                                  | per archer                                  | assumption: ~180 N holding force acting on ~2.4 kg of hand + arm gives ~75 m/s² initial acceleration. The only field number available (APP_VER 83: top speed 8.5 in uncorrected portrait units ≈ 4.8 torso/s in square pixels) lies inside the resulting range |
| bow reaction 1–5 cm forward, 2–7 cm drop                                                              | τ 60–120 ms                                 | assumption                                                                                                                                                                                                                                                     |
| expansion 2–6 mm over the hold                                                                        | linear                                      | assumption (clicker travel)                                                                                                                                                                                                                                    |
| walking 1.3 m/s                                                                                       |                                             | ordinary walking speed (assumption)                                                                                                                                                                                                                            |
| landmark set and normalization                                                                        | 33 points, x/width, y/height, z, visibility | Bazarevsky et al., _BlazePose_, arXiv:2006.10204 (2020); MediaPipe Pose documentation                                                                                                                                                                          |
| landmark smoothing                                                                                    | one-euro 0.05 / 80 / 1.0                    | Casiez et al., CHI 2012; parameter values = legacy MediaPipe pose graph as recalled (assumption, unverified)                                                                                                                                                   |
| jitter and visibility levels                                                                          | see above                                   | calibrated to MediaPipe statistics of the golden fixtures (above); event rates are assumptions                                                                                                                                                                 |
| release-time tracking loss 150–350 ms                                                                 | 12% of shots, 60–300 ms                     | field observation in the app history (v81, 60 fps); rate is an assumption                                                                                                                                                                                      |
| field of view 69°                                                                                     | long side                                   | 26 mm-equivalent phone main camera (assumption)                                                                                                                                                                                                                |

## Baseline snapshot (current detector, commit 5938233, 5 seeds)

Under the assumptions above the current pipeline finds 1 of 390 core shots (precision 0.03, 28
false positives, no let-down counted). With the true times given (`measure`), `anchorNorm` reads
0.107 torso below the image truth (it measures in the 16:9 reference space where horizontal
distances shrink), the bow elbow is within 4.4° (2D) / 3.5° (3D), the draw elbow is withheld for 25%
of shots and off by 12.7° (2D) / 15.7° (3D) when given, and the drift values (0.06 torso) are noise
over a true drift of ~0.005. The `big-release` sensitivity scenario recovers 20% recall, so the
result depends mainly on the release-kinematics assumption. Rerun the command above for current
numbers; do not treat this section as an acceptance threshold.
