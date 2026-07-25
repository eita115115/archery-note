# Codex Integration Progress

This file is the state ledger for the Archery Note integration work. Keep it
short, current, and honest. Update it after every Codex step.

Primary brief: [integration-plan.md](integration-plan.md)

## Current Status

- 2026-07-15 Build Week branch `feat/build-week-growth-coach`: growth dashboard, 7/30/90-day filters, explainable next-practice suggestions, isolated fictional demo data and regression tests implemented in `b95bfaa1`. Full checks and 41 E2E tests pass. Submission docs are under `docs/build-week/`; human video/publication work remains.

- Status: UI inline-style extraction series landed on `main` (PRs #63–#67:
  design tokens, history/sight, record, gear-settings). A token-drift fix and
  a `check:ui` regression guard for utility/history CSS values are on `main`
  as `18f3d532`. The Phase Ledger below still needs full reconciliation.
- Last updated: 2026-07-03
- Current main baseline:
  `18f3d532` (`test(ui): guard utility/history CSS token values against drift`)
- Latest release: `v1.0.0`
- Package/app version: `0.64.0` / `APP_VER 64` (`APP_VER` lives in
  `scripts/10-storage-native.js`; bump all markers via `npm run version:bump`)
- Current storage contract: `archeryNote.v1`, `schema: 3` (verified 2026-07-02)
- Working-branch note: short-lived `wip/ui-*-inline-styles` branches are the
  active pattern; verify `git branch --show-current` and in-flight changes
  with `git status --short` at the start of every run instead of trusting
  this ledger. Branches created before `18f3d532` do not contain the
  `check:ui` token guard until merged/rebased onto current `main`.
- Guidance docs (`AGENTS.md`, `CLAUDE.md`, this ledger,
  `docs/codex/integration-plan.md`, `docs/codex/codex-continue-prompt.md`) are committed
  on `main` as of 2026-07-03.
- Next task: reconcile the Phase Ledger rows and Next Task Detail against the
  current repository (releases through `v1.0.0`, UI extraction series).
  Docs-only run; do not change app behavior.

## Run Rules

- Do one small task per Codex run or checkpoint.
- Start every run with `git status --short`.
- Read `AGENTS.md`, this file, and `docs/codex/integration-plan.md` before editing.
- Prefer web/PWA work first. Do Android/Capacitor work only when the task needs
  it.
- Preserve existing local user data. Storage migrations must be idempotent and
  must not delete legacy data on failure.
- Keep OCR, pose, AI, and third-party model assets default-off until provenance
  and redistribution terms are documented.
- Do not direct-merge `archery-master`; treat it as a technical reference only.
- After each task, update this file with changed files, validation, risk notes,
  and the next task.

## Phase Ledger

Use these states: `not-started`, `in-progress`, `blocked`, `needs-review`,
`done`.

| Phase                                                | State        | Notes                                                                                  |
| ---------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| 0. Plan import and runbook setup                     | needs-review | Planning files exist locally and remain untracked until reviewed.                      |
| 1. Repository inventory and phase reconciliation     | done         | Current repo compared with the integration brief on 2026-06-29.                        |
| 2. OSS health docs and community files               | done         | Public OSS health baseline released in `v0.1.0-oss-readiness`.                         |
| 3. Brand cleanup                                     | done         | Public app branding is Archery Note; remaining old-name hits are planning references.  |
| 4. CI and quality gates                              | done         | CI runs app, UI, lint, format, and E2E; `check:all` runs app/UI/storage/version.       |
| 5. Accessibility and shell polish                    | done         | Viewport zoom lock is guarded by checks; current shell uses five bottom tabs.          |
| 6. Service Worker and update strategy                | in-progress  | Strategy doc exists; runtime still uses immediate `skipWaiting()` / `clients.claim()`. |
| 7. Storage migration and rollback                    | in-progress  | Safety fixtures/checkers exist; schema migration implementation has not started.       |
| 8. Analysis and stats integration                    | in-progress  | Analysis details moved from History to Analysis locally; review before version bump.   |
| 9. Third-party asset and experimental feature review | in-progress  | Current release has no OCR/pose/AI/model files; future assets require review first.    |
| 10. Final acceptance and report                      | in-progress  | Releases exist through `v0.5.0`; final integration acceptance is not complete.         |

## Next Task Detail

Task: reconcile this ledger with the current repository state.

Goal:

- The Phase Ledger, status lines, and next task must describe the repository
  as it is (releases through `v1.0.0`, `APP_VER 64`), not as it was on
  2026-06-29.
- Docs-only run: no app behavior, storage, scoring, Service Worker, or
  version-marker changes.

Steps:

1. `git status --short`, `git log --oneline -20`,
   `git tag --sort=-creatordate`.
2. Read `CHANGELOG.md` and compare it against the Phase Ledger rows.
3. Rewrite stale rows, the Current Status block, and this Next Task Detail
   with the real next implementation task.

Expected validation:

```powershell
git status --short
git diff --check
npx prettier --check docs/codex/codex-progress.md
npm run format:check
```

## Completed Steps

### 2026-06-29 - Setup durable integration loop

- Added `docs/codex/integration-plan.md` from the source PDF.
- Added this progress ledger.
- Added `docs/codex/codex-continue-prompt.md` for copy/paste or `codex exec` use.
- Added AGENTS guidance so future Codex runs know how to continue.

Validation:

- `npx prettier docs/codex/integration-plan.md docs/codex/codex-progress.md docs/codex/codex-continue-prompt.md AGENTS.md --check`
  passed after formatting.
- `npm run format:check` passed.
- `git status --short` reviewed; setup files remained untracked.

### 2026-06-29 - Reconcile progress ledger with v0.5.0 baseline

- Read `docs/codex/integration-plan.md`, current repository scripts/workflows, PWA
  markers, storage checks, and analysis view structure.
- Updated this ledger to reflect releases through
  `v0.5.0-analysis-view-baseline`.
- Set the next small task to move remaining detailed analysis summaries from
  History to Analysis.

Validation:

- `git status --short`: reviewed.
- `git diff --check`: pass.
- `npx prettier --check docs/codex/codex-progress.md`: pass.
- `npm run format:check`: pass.

Risk notes:

- No app code changed in this reconciliation step.
- No storage schema, backup/import/export format, Service Worker strategy,
  dependency, tag, Release, or Pages change.
- `AGENTS.md` and `CLAUDE.md` remain untracked and must not be staged unless
  explicitly requested.

### 2026-06-29 - Move analysis details from History to Analysis

- Moved `距離別サマリー`, `サイトサマリー`, and
  `グルーピングサマリー` out of History and into Analysis.
- Kept History focused on the hero, lightweight summary tiles, filters,
  practice history list, and short Analysis-tab hint.
- Reused existing read-only calculations; no score trend or new statistics were
  added.
- Kept storage keys, schema, backup/import/export formats, Service Worker
  strategy, package metadata, and version markers unchanged.

Validation:

- `git status --short`: reviewed.
- `git diff --check`: pass.
- `npm run check:app`: pass.
- `npm run check:ui`: pass.
- `npm run check:storage`: pass.
- `npm run check:version`: pass.
- `npm run check:all`: pass.
- `npm run format:check`: pass.
- `npm run lint`: pass.
- `npm run test:e2e`: pass.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Local DOM smoke check confirmed History has no analysis detail summaries and
  Analysis has the three moved summaries.

Risk notes:

- This is a user-visible UI organization change. If it is published, version
  markers should be bumped to `58` / `0.58.0` in a separate task.
- No storage schema, backup/import/export format, Service Worker strategy,
  dependency, tag, Release, or Pages change.

### 2026-07-02 - Harden loop for low-cost model / Codex-only continuation

- Added `references/recipes.md` to the `$archery-note` skill: literal
  scoring/UI/release/storage recipes with invariants, validation ladder, and
  stop conditions.
- Made the skill `SKILL.md` a short router and added a fallback-mode section.
- Updated skill `references/release.md` and `AGENTS.md` command lists to the
  current `package.json` scripts (`check:pwa`, `check:storage`,
  `check:version`, `check:all`, etc.).
- Added a low-cost-model bullet to the integration-plan working summary and a
  "Fable unavailable" start prompt to `docs/codex/codex-continue-prompt.md`.
- No app code, storage, Service Worker, version marker, or release change.

Validation:

- `git status --short`: reviewed; only guidance docs changed.
- `git diff --check`: pass.
- `npx prettier --check` on changed docs and skill files: pass.
- `npm run format:check`: pass.

Risk notes:

- Docs/guidance only; no runtime behavior changed.
- Guidance files remain untracked and must not be staged unless requested.

### 2026-07-02 - Fix stale version-marker guidance and commit durable guidance

- Corrected `APP_VER` location guidance: it moved from `index.html` to
  `scripts/10-storage-native.js`. Fixed `AGENTS.md` and the release guidance
  in both skill copies; documented `npm run version:bump` as the single way to
  bump all markers together.
- Synced the Claude-side skill copy with the Codex one: added
  `references/recipes.md`, the recipes routing entry, and the fallback-mode
  section.
- Reconciled the Current Status block of this ledger with the real repository
  (branch, `v1.0.0`, `APP_VER 64`, `style.css` dirty state) and set the next
  task to a full ledger reconciliation.
- Committed the durable guidance files (`AGENTS.md`,
  `docs/codex/integration-plan.md`, `docs/codex/codex-progress.md`,
  `docs/codex/codex-continue-prompt.md`). `CLAUDE.md` and the unrelated `style.css`
  change stay uncommitted on purpose.
- No app code, storage, scoring, Service Worker, or version-marker change.

Validation:

- `git status --short`: reviewed; unrelated `style.css` change preserved.
- `git diff --check`: pass.
- Skill frontmatter and reference-existence check (both copies): pass.
- `npx prettier --check` on changed skill and doc files: pass.
- `npm run format:check`: pass.

Risk notes:

- Guidance/docs only; no runtime behavior changed.
- The Phase Ledger rows are still stale. The next run must reconcile them
  before implementing any new behavior.

### 2026-07-03 - Token-drift fix, check:ui guard, and guidance commit to main

- PR #64's inline-style extraction had silently changed visual values by
  mapping px to mismatched design tokens (`.mt10` → 12px, history font sizes
  12→14px etc.). Fixed to value-preserving tokens; PR #65 (record) and #67
  (gear-settings) were audited and had no drift.
- Added static regression assertions for the utility/history CSS values to
  `tools/check-ui.js` (`18f3d532` on `main`); red/green verified.
- Committed the five guidance docs to `main` without switching the active
  working branch (in-flight analysis/physics extraction work preserved).

Validation: `npm run check:ui` pass, `npm run check:all` pass (2026-07-02,
at `18f3d532`); prettier checks on guidance docs pass (2026-07-03).

Risk notes: wip branches created before `18f3d532` lack the token guard
until rebased/merged; the Phase Ledger rows above are still stale.

### 2026-07-15 - Adaptive release detection design and Fable 5 review

- Analyzed a private diagnostic backup locally without committing it. Three
  APP_VER 83 field records showed zero cancellations and two complementary
  non-fire modes: velocity without fixed close evidence, and close evidence
  without the fixed velocity threshold.
- Wrote the recall-first, session-local calibration design in
  `docs/superpowers/specs/2026-07-15-adaptive-release-detection-design.md`.
- Fable 5 reviewed the draft as `DONE_WITH_CONCERNS`. The revision now refreshes
  evidence through long holds, limits adaptive cancellation to the existing
  400 ms window with the fire-time boundary, caps adaptive release speed at 8,
  connects adaptive holds to phase/summary/NB2 state, defines geometry reset
  behavior, and replaces vague direction/expiry rules with numeric conditions.
- Independent verification verdict: **Accepted**. Commits `934431ec` and
  `86aa8bb0` exist, contain only the design file, all required Fable corrections
  are present, `git diff --check main..HEAD` passes, and the design file passes
  Prettier.
- No runtime code, storage schema, Service Worker, dependency, version marker,
  release, or private practice record changed.

### 2026-07-15 - Approved adaptive release implementation plan

- The user explicitly approved the Fable-reviewed adaptive-release design.
- Converted the approved specification into the six-task TDD plan at
  `docs/superpowers/plans/2026-07-15-adaptive-release-detection.md`.
- The plan fixes the RED fixtures and delivery boundaries for adaptive math,
  long-lived anchor evidence, A/B/C field profiles, a complete six-shot end,
  adaptive cancellation, capture/replay geometry parity, repository gates,
  and the final 18-shot phone acceptance matrix.
- Each implementation task has exact files, assertions, expected RED/GREEN
  results, validation commands, and a narrow commit boundary.
- No runtime code, private practice record, storage schema, dependency, Service
  Worker, version marker, deployment, or release asset changed.

## Last Run Report

- Changed files:
  - `docs/superpowers/plans/2026-07-15-adaptive-release-detection.md`
  - `docs/codex/codex-progress.md`
- Validation:
  - `git status --short --branch`
  - writing-plans unfinished-marker scan
  - specification-to-plan coverage spot-check
  - `git diff --check`
  - `npx prettier --check docs/superpowers/plans/2026-07-15-adaptive-release-detection.md docs/codex/codex-progress.md`
- Next task:
  - Choose Subagent-Driven execution (recommended) or Inline Execution, then
    execute Task 1 with its failing tests before changing detector behavior.

### 2026-07-25 - Adaptive release detector primitives (Task 1)

- Added behavior-neutral, detector-local adaptive threshold primitives in
  `scripts/46-form-core.js`: finite-only, linear-interpolated p10 anchor and
  p90 velocity calibration with cold starts and bounded outputs.
- Added the complete fresh `adaptive` state object to each form phase detector.
  This task intentionally does not call the new helpers from `stepFormPhase` or
  alter `summarizeFormShot`; later tasks add evidence and release-candidate use.
- Added regression coverage for the six approved threshold fixtures, finite
  filtering/counting, lower/upper clamps, an unclamped p90 result, non-mutating
  unsorted inputs, and detector-local adaptive arrays.

Validation:

- RED: `npm run check:form` exited 1 with the intended loader failure:
  `ReferenceError: adaptiveAnchorThreshold is not defined`.
- GREEN: `npm run check:form` exited 0 and ended with `Form core checks OK`.
- `npm run lint -- --quiet`: pass.
- `npx prettier --check scripts/46-form-core.js tools/check-form-core.js
docs/codex/codex-progress.md`: pass after formatting the two edited JavaScript
  files.

Risk notes:

- The exact thresholds are field-derived but have not received external phone
  acceptance; they remain inert and gated by the later session-evidence and
  phone-acceptance tasks.
- No storage, persisted state, Service Worker, version marker, release, or
  primary-phone-flow behavior changed.

Next task:

- Task 2: form and refresh session-local anchor evidence.

### 2026-07-25 - Task 1 review remediation: finite calibration gate

- Added explicit regression coverage for both adaptive threshold cold starts
  with exactly five finite samples plus `NaN`/`Infinity`. This proves non-finite
  entries cannot satisfy the six-usable-sample calibration gate.
- This is review-added coverage of existing correct behavior, not a new RED or
  production behavior change.

Validation:

- `npm run check:form`: pass (`Form core checks OK`).
- `npm run lint -- --quiet`: pass.
- `npx prettier --check tools/check-form-core.js docs/codex/codex-progress.md`:
  pass.

Risk notes:

- Test-only remediation; adaptive production logic and later phone-acceptance
  gate remain unchanged.

### 2026-07-25 - Session-local adaptive anchor evidence (Task 2)

- Added the exact four-argument `updateAdaptiveAnchorEvidence` helper and wired
  it before the null-frame return. It learns only from usable non-pending
  frames, derives a contiguous stable history suffix without duplicating the
  current frame, refreshes complete evidence snapshots through long holds, and
  ages or invalidates evidence without fabricating samples.
- Generalized `ANCHORING` / `FULL_DRAW` classification to qualified adaptive
  holds and backfilled `anchorStartTs` to the continuous hold's first sample.
  NB2 now uses valid snapshotted `evidence.anchorEnter` for its pre-gap check,
  while the legacy `CLOSE_IN` boundary remains the fallback.
- Centralized all nine `stepFormPhase` result paths so top-level `anchorEnter`
  and the five adaptive debug fields are always present. Unknown floor, age,
  and strength values remain `null`; cold `anchorEnter=0.35` and
  `releaseSpeed=6` remain numeric.
- Added regression coverage for five/six-sample calibration, exact 150 ms
  oblique holds, three-second refresh, inclusive 1500 ms evidence/sample
  retention, 1501 ms expiry, far 1.2/299/300 ms boundaries, null and
  confidence-unusable gaps, 125/1.3 eligibility boundaries, inclusive/exclusive
  0.12 range, finite velocity backfill, capped strength, pending far exemption,
  quick draws, learned-boundary NB2, and all nine decorated return paths.

Validation:

- RED: `npm run check:form` exited 1 with the intended behavioral failure:
  `five usable frames retain cold anchor threshold: expected 0.35, got
undefined`.
- GREEN: `npm run check:form` exited 0 and ended with
  `Form core checks OK`.
- `npm run check:globals`: pass
  (`check-globals OK (14 files, 990 unresolved refs all accounted for)`).
- `npm run lint -- --quiet`: the first run found two
  `no-useless-assignment` errors in new fixtures; after removing those
  assignments, the final run passed with no output.
- `npx prettier --check scripts/46-form-core.js tools/check-form-core.js
docs/codex/codex-progress.md`: an intermediate run identified the test-file
  formatting change after lint cleanup; after formatting, the final run passed
  with `All matched files use Prettier code style!`.
- Boundary evidence: five samples returned `anchorEnter=0.35`; the sixth
  calibrated and backfilled the hold; exact 150 ms and range 0.12 qualified;
  draw-arm 125, anchor 1.3, range above 0.12, and interrupted sub-150 ms holds
  did not qualify; evidence was retained at age 1500 and cleared at 1501; far
  evidence survived 299 ms and cleared at 300 ms, while equality 1.2 reset the
  timer and pending confirmation accumulated no far duration.

Risk notes:

- This task forms and exposes adaptive evidence but intentionally does not add
  the Task 3 relative-departure fire path. Existing legacy/NB/NB2 firing remains
  active.
- The learned thresholds still require the planned synthetic field-profile and
  phone acceptance gates. No storage, UI/view, Service Worker, dependency,
  version marker, release, or persisted user-data behavior changed.

Next task:

- Task 3: count relative adaptive departures and the six-shot field profiles.

### 2026-07-26 - Task 2 review remediation: pending-history learning barrier

- Added nullable detector-local `holdBreakTs` state. Every null, confidence
  unusable, ineligible, or pending-suppressed adaptive input records an explicit
  learning barrier without mutating browser history.
- Stable-suffix backfill now stops at or before the latest barrier and treats a
  duplicate or non-increasing timestamp as another hard barrier. Only strictly
  increasing distinct observations can satisfy the three-sample gate.
- Added RED regressions for both anchor-return cancellation and ordinary
  confirmation timeout. In both paths, pending frames use high synthetic
  velocities and the post-pending frames must form a new three-observation hold
  spanning 150 ms before evidence refreshes.
- Added dynamic adaptive result-shape assertions for all nine return kinds:
  null, normal, RELEASE lock, FOLLOW, fire, anchor-return cancel, NB2 drift
  cancel, NB2 unobserved cancel, and no-depart cancel. This coverage was added
  to already-correct behavior and was not misrepresented as a failing RED.
- Restored a separate dynamic regression for the legacy sticky `DRAWING` path:
  an adaptive-ineligible brief excursion keeps the original `anchorStartTs`.

Validation:

- RED: `npm run check:form` exited 1 with the blocking reviewer reproduction:
  `first post-cancel frame cannot backfill pending history into evidence:
expected null, got
{"ts":375,"normAtHold":0.22,"anchorEnter":0.35,"releaseSpeed":8,"strength":12}`.
- Focused GREEN: `npm run check:form` exited 0 and ended with
  `Form core checks OK`.
- `npm run check:globals`: pass
  (`check-globals OK (14 files, 990 unresolved refs all accounted for)`).
- `npm run lint -- --quiet`: an intermediate run found one unused
  coverage-fixture binding; after removing it, the final run passed with no
  output.
- `npx prettier --check scripts/46-form-core.js tools/check-form-core.js
docs/codex/codex-progress.md`: pass
  (`All matched files use Prettier code style!`).
- `git diff --check`: pass.
- `npm run check:all`: pass, including app, globals, analysis, form,
  gamification, today's-result, security (38 checks), UI smoke, PWA, storage,
  and version alignment.
- Boundary evidence: neither pending path added anchor samples; the learning
  barrier equaled the final pending timestamp; the first two fresh observations
  left evidence null; the third distinct observation at exactly 150 ms formed
  strength-three evidence; pending velocity 8 never raised `releaseSpeed`
  above the cold floor 6.

Risk notes:

- The review's `now=0` sentinel concern remains intentionally unresolved for
  legacy phase timestamps and `farSince`. This narrow remediation uses nullable
  `holdBreakTs` and does not broaden Task 2 into legacy `anchorStartTs`
  semantics or alter the Task 1 adaptive state contract beyond the new barrier.
- Task 3 adaptive departure firing and the phone acceptance matrix remain
  pending. No storage, UI/view, dependency, Service Worker, version, release,
  deployment, or persisted user-data behavior changed.

Next task:

- Task 3: count relative adaptive departures and the six-shot field profiles.

### 2026-07-26 - Relative adaptive release receipts (Task 3 + review remediation)

- Added the pure four-argument `adaptiveReleaseCandidate` helper with
  structurally validated evidence, inclusive 1500 ms age / 250 ms velocity
  windows, finite nonnegative confidence-gated velocities, and a chronological
  previous-three direction suffix that excludes the current timestamp.
- Converged adaptive, close, NB, and NB2 matches into one fire block. Adaptive
  evidence has diagnostic precedence without disabling fallbacks; initial
  detector state can fire before 1000 ms, while a real prior fire retains the
  strict refractory comparison and existing FOLLOW lock.
- Added fire-time pending snapshots for evidence type, anchor threshold, and
  adaptive release speed. Committed fires clear only the short-lived evidence
  after the returned diagnostics are built; calibration arrays and learning
  barriers remain intact.
- Added anonymous field profiles and focused boundary coverage. Profile receipts
  are A/B/C = `1/1/1`, each labeled `adaptive`; the synthetic six-shot end is
  `6`, with six adaptive labels. Profile B retains `releaseSpeed=6` despite the
  hold outlier and fires with `maxV=8.5`.
- Recorded the approved recall tradeoff explicitly: the 100 ms linear let-down
  produces one removable adaptive receipt at both listed frame intervals.
  Every listed 150-2000 ms linear let-down remains at zero.
- Review remediation keeps valid evidence through transient far input but
  prevents a current `anchorNorm > 1.2` frame from matching. Exact `1.2`
  remains inclusive, and the restored 1100 ms hold / 220 ms null-gap / far
  arrival fixture remains at zero receipts.
- Replaced the shared comparison epsilon with independent departure, direction,
  and speed epsilons derived only from each comparison's operands. Non-finite
  subtraction diagnostics become unknown and cannot match.
- Added a standalone insufficient-departure regression (`0.17` with direction
  and speed satisfied), plus huge-value cross-gate and overflow probes.

Validation:

- Task 3 RED: `npm run check:form` exited 1 with the exact intended aggregate:
  `Error: adaptive field receipts A/B/C=0/0/0, six-shot=0`.
- Task 3 GREEN: `npm run check:form` exited 0 and ended with
  `Form core checks OK`.
- Review remediation RED, before production changes:
  `current frame above the far boundary cannot be an adaptive candidate:
expected false, got true`.
- Review remediation GREEN: `npm run check:form` exited 0 and ended with
  `Form core checks OK`.
- `npm run check:globals`: pass
  (`check-globals OK (14 files, 1019 unresolved refs all accounted for)`).
- `npm run lint -- --quiet`: pass with no lint findings.
- `npx prettier --check scripts/46-form-core.js tools/check-form-core.js
docs/codex/codex-progress.md`: pass
  (`All matched files use Prettier code style!`).
- `git diff --check 02a747d9`: pass.
- `npm run check:all`: pass, including app, globals, analysis, form,
  gamification, today's-result, security (38 checks), UI smoke, PWA, storage,
  and version alignment.

Risk notes:

- The relative detector is intentionally recall-first. A 100 ms linear let-down
  can now appear as a user-removable receipt; slower listed let-downs and the
  restored long-hold far-arrival safety case remain suppressed.
- Task 3 deliberately retains the existing `departCheck` confirmation and gross
  receipt semantics. Adaptive-specific cancellation timing is not changed here.
- No raw landmarks, video, private diagnostic path, storage/schema, UI,
  dependency, Service Worker, version marker, release, or deployment changed.

Next task:

- Task 4: apply the approved adaptive cancellation semantics while preserving
  the Task 3 relative receipt and pending snapshot contracts.

### 2026-07-26 - Adaptive-only post-fire cancellation (Task 4)

- Split pending confirmation by exact `fireEvidence === "adaptive"`.
  Adaptive pending now snapshots its finite fire-time `anchorEnter` and
  `releaseSpeed`, disables departure confirmation, and owns `returnSince` /
  `returnCount`; missing or other evidence labels continue through the legacy
  depart, NB2, and global cancellation state.
- Added separate adaptive return constants of 150 ms and four usable frames
  without changing legacy `CANCEL_DIP_MS=100` or `CANCEL_DIP_FRAMES=3`.
  Adaptive cancellation requires both conditions and remains inclusive through
  fire +400 ms.
- Adaptive return compares `anchorNorm <= pendingRelease.anchorEnter`. The
  stored `.59` fire boundary remains authoritative after the live learned
  threshold is recomputed to `.35`; a non-finite stored boundary fails safe
  without automatic cancellation.
- Null and confidence-unusable frames preserve the existing early return and
  neither add nor reset return evidence. A usable outside frame resets both
  pending-local fields. All-null input through +400 ms defers cleanup until the
  first usable +401 ms frame and keeps the shown shot.
- Reused the existing `anchor-return` cancellation receipt, sticky
  `anchorStartTs`, debug-before-cooldown calculation, and 250 ms cooldown
  mutation. The nine decorated `stepFormPhase` result paths remain intact.
- Reconciled intended legacy fixtures with adaptive-ineligible
  `drawArm=125` pre-fire holds and explicit `close` / `nb2` evidence. Their
  100 ms/three-frame anchor-return, NB2 drift/unobserved, no-depart, all-null,
  cooldown, and sticky-anchor expectations remain unchanged.

Validation:

- RED: test-only `npm run check:form` exited 1 with
  `adaptive pending skips departure confirmation: expected false, got true`.
- Focused GREEN: `npm run check:form` exited 0 and ended with
  `Form core checks OK`.
- Exact adaptive boundary evidence: a real adaptive fire occurs at `t=860`
  with stored `anchorEnter=.59`; usable return frames at +50/+100/+150/+200
  cancel exactly once on the fourth frame (first-to-fourth span 150 ms), while
  three frames spanning 150 ms and four frames spanning 149 ms both survive.
- Confirmation-window evidence: all-null frames through +400 ms keep pending
  return state at zero and the first usable +401 ms frame clears pending
  without `no-depart`; a four-frame return beginning at +401 ms also survives.
- Stored-boundary/reset evidence: return `.47` cancels against stored `.59`
  after live `.35` recalibration; equality `.59` is inside; usable `.62`
  resets both fields; null changes neither; a non-finite stored boundary does
  not cancel.
- Legacy evidence: explicit `close` fixtures continue to cancel after the
  original 100 ms/three-frame conjunction, and explicit `nb2` fixtures retain
  drift and unobserved cancellation. Adaptive `.62` frames below legacy
  `DEPART_MIN=.65` run through timeout with net one and no `no-depart`.
- `npm run check:globals`: pass
  (`check-globals OK (14 files, 1023 unresolved refs all accounted for)`).
- `npm run lint -- --quiet`: pass with no lint findings.
- `npx prettier --check scripts/46-form-core.js tools/check-form-core.js
docs/codex/codex-progress.md`: pass
  (`All matched files use Prettier code style!`).
- `git diff --check 3ae6700f5e71e30b8951e59ef8c3005a88421a76`: pass.
- `npm run check:all`: pass, including app, globals, analysis, form,
  gamification, today's-result, security, UI smoke, PWA, storage, and version
  alignment.

Risk notes:

- This is synthetic core validation only. Task 5 active-geometry integration
  and the later Task 6 phone/field acceptance remain pending; neither is
  claimed complete. Monotonic timestamps remain an existing runtime
  precondition.
- The adaptive detector remains recall-first as recorded in Task 3. This task
  changes only post-fire confirmation and does not alter view/UI, immediate
  insertion, storage/schema, dependencies, Service Worker, version markers,
  release, deployment, or persisted user data.

Next task:

- Task 5: wire active geometry through `summarizeFormShot`, live capture and
  replay, geometry reset, and diagnostics.

### 2026-07-26 - Task 4 review remediation: exact window and legacy classification

- Closed the reviewer's Important coverage gap without changing approved
  production. A real adaptive fire now has a focused return sequence at
  +250/+300/+350/+400 ms; the first three observations survive and the fourth
  cancels exactly at fire +400 ms with one `anchor-return`, net zero, and
  cleared pending state.
- Added hand-built timeout fixtures with `fireEvidence` omitted and with
  `fireEvidence="other"`. Both retain compatibility through the legacy
  `no-depart` path at +401 ms, proving only exact `"adaptive"` selects adaptive
  confirmation.
- This is coverage of already-correct behavior, so no artificial RED was
  claimed and `scripts/46-form-core.js` was not changed.

Validation:

- Post-assertion `npm run check:form`: pass (`Form core checks OK`).
- Read-only in-memory `< CONFIRM_MS` mutant: exited 1 at
  `adaptive return can cancel at exact fire+400: expected true, got undefined`.
- Read-only in-memory missing/other-as-adaptive mutant: exited 1 at
  `missing fireEvidence remains legacy-compatible: expected true, got undefined`.
  Neither mutant changed a worktree file.
- `npm run check:globals`: pass
  (`check-globals OK (14 files, 1023 unresolved refs all accounted for)`).
- `npm run lint -- --quiet`: pass with no lint findings.
- `npx prettier --check tools/check-form-core.js
docs/codex/codex-progress.md`: pass
  (`All matched files use Prettier code style!`).
- `git diff --check 3ae6700f5e71e30b8951e59ef8c3005a88421a76`: pass.
- `npm run check:all`: pass, including app, globals, analysis, form,
  gamification, today's-result, security, UI smoke, PWA, storage, and version
  alignment.

Risk notes:

- Review remediation is synthetic test coverage only. Task 5 active-geometry
  integration and the later Task 6 phone/field acceptance remain pending.
  Production behavior, timestamp preconditions, storage/schema, UI/view,
  dependencies, Service Worker, versions, release, deployment, and persisted
  user data remain unchanged.

Next task:

- Task 5: wire active geometry through `summarizeFormShot`, live capture and
  replay, geometry reset, and diagnostics.
