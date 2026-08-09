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

### 2026-07-26 - Task 5: active capture/replay geometry integration

- Generalized `summarizeFormShot` with an optional active anchor-entry
  threshold. Four-argument adaptive calls now keep valid holds below the
  active threshold in the primary window, while legacy three-argument calls
  retain the existing `0.45` boundary and fallback order.
- Threaded the detector result's top-level `r.anchorEnter` through live capture
  and saved-video replay shot summaries. Debug-off behavior and the persisted
  form-analysis shape remain unchanged.
- Added the capture-only geometry reset for camera, handedness, and crop
  changes. It finalizes a pending arrow annotation, then clears only detector,
  EMA, history, velocity, presence, pending-annotation, and recent live
  geometry state; counted shots, rendered rows, session diagnostics, timing,
  performance samples, and recording state are preserved.
- Guarded camera swaps so no frame is processed while the stream is being
  replaced. The guard is released after either success or failure so the
  control remains retryable. Replay keeps its independent local handedness
  reset and never calls the capture helper.
- Added bounded source-section contracts for capture and
  `startFormReplay(videoUrl)`, including all reset callers, approved reset
  order, camera-swap ordering/guarding, top-level handedness parity, and the
  replay-local reset. Added adaptive summary-window and genuine adaptive-fire
  diagnostic-shape regressions.

Validation:

- RED: test-only `npm run check:form` exited 1 with
  `active anchor threshold keeps the primary summary window: expected false, got true`.
- Focused GREEN: `npm run check:form` exited 0 and ended with
  `Form core checks OK`.
- `npm run check:app`: pass (`Archery Note checks OK (v84)`).
- `npm run check:globals`: pass
  (`check-globals OK (14 files, 1025 unresolved refs all accounted for)`).
- `npm run lint -- --quiet`: pass with no lint findings.
- The first implementation commit ran `npx prettier --write` on all four Task
  5 files. Scope remediation then restored `scripts/47-form-view.js` to its
  compact baseline style and reapplied only the Task 5 semantic changes.
- Final cumulative formatting state: `npx prettier --check
scripts/46-form-core.js tools/check-form-core.js
docs/codex/codex-progress.md` passes; the explicit
  `npx prettier --check scripts/47-form-view.js` emits its existing baseline
  warning and the view is intentionally not whole-file reformatted.
- `git diff --check --cached`: pass after staging only the four Task 5 files.

Risk notes:

- Validation is synthetic/static and does not replace Task 6 mobile/field
  acceptance. The camera replacement guard preserves the existing stream and
  recorder flow but has not been exercised against physical iPhone cameras in
  this task.
- This slice does not alter detector fire semantics, shot cancellation,
  diagnostic opt-in, privacy copy, storage/schema, dependencies, Service
  Worker behavior, version markers, release/deployment, or persisted user
  data.

Next task:

- Task 6: perform mobile-sized and field acceptance of adaptive live capture
  and replay behavior.

### 2026-07-26 - Task 5 re-review: stop in-flight camera streams

- Added capture-owned in-flight camera state so close can detach and stop a
  candidate while `video.play()` is pending. Acquisition and play
  continuations now revalidate `running` and candidate ownership before
  promotion; initial and swap callers stop before success-only work on abort.
- `stop()` clears and detaches both pending and promoted streams, without
  stopping the same stream twice. Prior failure cleanup, facing retry,
  live-track gating, swap locking, recorder behavior, and Task 5 geometry
  contracts remain intact.
- RED: test-only `npm run check:form` exited 1 with
  `capture exposes an in-flight camera stream so close can stop it`.
- GREEN: `npm run check:form`, `npm run check:app`,
  `npm run check:globals`, and `npm run lint -- --quiet` pass. Managed-file
  Prettier passes; the compact view retains its documented baseline warning.

Next task:

- Task 6: perform mobile-sized and field acceptance of adaptive live capture
  and replay behavior.

### 2026-07-26 - Task 5 re-review: gate early camera swaps

- The swap button now starts disabled and a separate readiness guard blocks
  programmatic calls until initial camera startup succeeds. Successful startup
  marks readiness and enables swap before wake-lock/loop; later swap failures
  preserve readiness for retry.
- Initial model continuation and `startCamera()` both return on closed capture
  before acquisition or success-only work. In-flight cleanup, facing retry,
  live-track gating, swap locking, recorder behavior, and Task 5 geometry
  contracts remain intact.
- RED: `npm run check:form` exited 1 with
  `camera swap stays disabled and unready until initial startup succeeds`.
- GREEN: form, app, globals, and lint pass. Managed-file Prettier passes; the
  compact view retains its documented baseline warning.

Next task:

- Task 6: perform mobile-sized and field acceptance of adaptive live capture
  and replay behavior.

### 2026-07-26 - Task 6 local-beta gate checkpoint (incomplete)

- Runtime-equivalent adaptive detector checkpoint: `1973b4c75ff61dc0632e0b7f9158a286ecf861fc`.
  Pre-Task6 documentation baseline: `608c43c02bb8902ab87e5fbcd1b69a14cf0a1375`
  on `feat/adaptive-release-detection`. The initial Task6 progress-entry commit
  is `55d9745e59b09f70c0bac132a89a1cce6bbfc305`; it adds ledger documentation
  only. The intervening privacy redaction changes only
  `docs/superpowers/plans/2026-07-15-adaptive-release-detection.md`.
- At the runtime-equivalent checkpoint, `npm run check:form` exited 0 with
  `Form core checks OK`. Its unconditional synthetic receipts were A/B/C =
  `1/1/1`, each labeled `adaptive` with finite genuine-fire adaptive
  diagnostics, and the synthetic six-shot end was `6` (six adaptive labels).
  The deliberate recall tradeoff remains: a 100 ms linear let-down can produce
  one removable adaptive receipt at both listed frame intervals; every listed
  150--2000 ms linear let-down remains at zero.
- Recorded repository gate results at `1973b4c7`: `npm run check:app` exited 0
  (`Archery Note checks OK (v84)`); `npm run check:globals` exited 0 (14 files,
  1025 accounted references); `npm run lint` exited 0 with no findings;
  `npm run format:check` exited 0; and `npm run check:all` exited 0, covering
  app, globals, analysis, form, gamification, today's result, security (38
  checks), UI smoke, PWA, storage, and version gates.
- `npm run test:e2e` exited 0: 41 passed, 0 failed, 0 skipped in 34.3 seconds
  with five workers. Its configured scope is headless Chromium at 390 x 844
  with retries 0 (no WebKit/iPhone emulation); it covers the general mobile
  shell and form-tracking settings chip only, not `getUserMedia`, capture,
  replay, or the required 18-shot matrix. Fresh 390 px and 360 px smoke images
  were inspected without onboarding clipping or overlap.
- `npm run golden:replay` returned exit 0 after all five public-stock videos,
  but this is not acceptance: the runner treats `ok` and `ok-no-shots` as
  success without enforcing baseline-count equivalence. Exact results were
  `pixabay-43254-archery-woman: status=ok shots=2 wall=124.7s errors=8c/0p`,
  `pixabay-40769-archer: status=ok shots=1 wall=47.0s errors=4c/0p`,
  `mixkit-34710-female-archer: status=ok-no-shots shots=0 wall=45.0s errors=4c/0p`,
  `mixkit-48725-closeup-firing: status=ok shots=1 wall=28.4s errors=4c/0p`, and
  `pixabay-150869-arrows-target: status=ok-no-shots shots=0 wall=96.3s errors=4c/0p`;
  `COMMAND_EXIT=0`. Expected /
  committed baseline / current counts are respectively: 43254 `1/1/2`, 40769
  `0/0/1`, 34710 `0/0/0`, 48725 `0/2/1`, and 150869 `0/0/0`. Thus three
  expected-count mismatches remain; 43254 has one documented real release but
  counted two, and the committed 48725 baseline conflicts with `sources.md`.
- Cumulative branch verification at the runtime-equivalent checkpoint found
  `git diff --check main..HEAD` clean. At the pre-Task6 baseline
  `608c43c0`, `git diff --stat main..HEAD` was exactly 7 files changed,
  3512 insertions(+), 142 deletions(-); the following Task6 documentation
  commit adds only this ledger entry. The 19-commit Tasks 1--5 release-candidate
  history is cumulative from local `main` / merge-base
  `3b4f3b22b562899ffef28bb6d64d7821eced4dde`, not Task-6-only. No package or
  lockfile, dependency, APP_VER storage file, `version.json`, `sw.js`, manifest,
  release/CHANGELOG, deployment, Android/Capacitor, binary, video, raw landmark
  stream, private backup content, or secret is in scope. The identifying
  private-backup pathname is absent from the current tree but remains in
  reachable pre-redaction commit `4a0ff1ec`. This branch must not be pushed;
  final publication requires a new sanitized branch/tree from `main` or a
  separately approved history rewrite.

Field handoff gaps:

- `tools/serve-iphone.ps1` is LAN HTTP, so an iPhone using the PC LAN address
  cannot use live `getUserMedia()` as a secure context.
- The existing full backup download serializes the full database; it is not a
  privacy-minimized diagnostics-only export.
- Persisted diagnostics cannot associate every kept shot with a complete
  adaptive-fire snapshot: core fire-time debug has the values, but persisted
  features omit the full snapshot, `releaseFires.framesBefore` excludes the
  current fire frame, kept/manual-deleted identities are not mapped, and replay
  does not populate `shot.diag`.

Required human 18-shot matrix (not run):

- true side view: 6/6 real shots;
- slightly oblique view: 6/6 real shots;
- normal range placement chosen without detector optimization: 6/6 real shots;
- no more than one removable false positive per end;
- no shown true shot is automatically removed; and
- every counted shot has complete adaptive-fire diagnostics: `anchorFloor`,
  `anchorEnter`, `releaseSpeed`, `evidenceAgeMs`, `evidenceStrength`,
  `departDelta`, and `fireEvidence`.

Risk notes:

- Task 6 is incomplete. Automated repository and configured Chromium gates do
  not establish phone acceptance, field acceptance, or production readiness.
- The current branch must not be pushed. Do not make version, Service Worker,
  dependency, storage, release, or deployment changes in this checkpoint.

Next task:

- Diagnose the golden corpus, reconcile authoritative expected counts, and add
  an enforcing count-regression gate so `npm run golden:replay` fails on an
  unreviewed mismatch before changing field thresholds or preparing the
  diagnostics export.

### 2026-07-26 - Task 6 golden semantic regression gate

- Added `tools/golden-replay/expectations.json` as the reviewed machine-readable
  source of truth for the five public-stock videos. It pins the runtime profile,
  source-video SHA-256, expected status and shot count, and the sole positive
  case's retained-release window. The reviewed `43254` event must be the only
  retained shot and occur within `4300--4600 ms`; count-only agreement no longer
  passes.
- Added a pure Python expectation validator and a 20-case standard-library test
  suite. The validator fails closed on malformed manifests, profile or hash
  mismatches, runtime failures, count mismatches, missing diagnostics, invalid
  or duplicate fire identities, orphan cancellations, negative timestamps,
  retained-count disagreement, and events outside their reviewed windows.
- The runner now verifies by default. Runtime or semantic failure returns exit
  `1`; configuration, profile, manifest, missing-video, or hash preflight failure
  returns `2`. Explicit `--record-only` prints `verification=SKIPPED`, still
  validates the runtime profile, and still returns `1` for runtime failure.
- Added deterministic runner-side glob expansion so the documented
  `tools/golden-replay/videos/*.mp4` form works in PowerShell as well as shells
  that expand globs. An unmatched pattern is preserved for the existing clear
  missing-video error.
- Reclassified committed baselines as observational diagnostics rather than
  truth. The source and harness documentation now distinguish reviewed
  expectations from scheduler-sensitive snapshots and document the fast
  no-video test and PowerShell-safe commands.

Validation:

- TDD RED: the initial test run exited `1` because
  `golden_expectations` did not exist. Review remediation also captured a RED
  for the missing `expand_video_arguments` contract.
- `python -B tools/golden-replay/test_golden_expectations.py`: pass,
  `20 tests`, `OK`.
- Targeted Prettier check for the harness README, source ledger, and expectation
  manifest: pass.
- Python syntax compilation with its cache redirected outside the repository:
  pass. No `tools/golden-replay/__pycache__` or `.pyc` remains.
- Runner `--help`: pass. Literal `*.mp4` plus a deliberately wrong handedness
  reached profile validation and returned `2`, proving Windows-side expansion.
  `--record-only --playback-rate NaN` returned `2`.
- All five local source-video SHA-256 values match the reviewed manifest.
- Applying the validator to committed observational baselines correctly fails
  exactly two cases: `43254` retains the wrong `6748.548 ms` event outside the
  reviewed window, and `48725` reports two shots instead of zero.
- Applying it to the latest completed five-video run correctly fails exactly
  three cases: `43254` reports two shots, `40769` reports one instead of zero,
  and `48725` reports one instead of zero. The previously silent mismatch is
  therefore now an enforcing RED.
- `git diff --check`: pass. Independent Reviewer and fresh Verifier both
  returned `ACCEPT`; the six harness files were the only implementation scope.

Risk notes:

- This task fixes the acceptance gate, not detector quality. A full video replay
  was not repeated after the harness-only change; the latest complete results
  remain the current detector evidence and are expected to exit `1`.
- The replay still samples `video.currentTime` through
  `requestAnimationFrame` while synchronous MediaPipe inference runs. Call
  counts and frame spacing vary with load, so committed baselines cannot serve
  as deterministic detector fixtures.
- The three failures have different observed causes: `43254` retains a legacy
  mid-draw false positive in addition to the real event, `40769` retains an
  adaptive arrow-retrieval event at about `8.16 s`, and `48725` retains a
  close-up legacy event near end-of-stream. Thresholds must not be changed from
  count totals alone.
- Storage/schema, dependencies, Service Worker behavior, app versions, deployed
  UI, and user data remain unchanged. The current branch still contains the
  previously documented identifying pathname in reachable history and must not
  be pushed.

Next task:

- Capture privacy-safe derived form metrics from the public `43254`, `40769`,
  and `48725` videos and add a deterministic Node replay fixture seam. Use those
  fixed inputs to reproduce the true `43254` release and the three false-event
  classes before changing legacy continuity, adaptive temporal coincidence, or
  end-of-stream pending semantics.

### 2026-07-29 - Task 6 deterministic form-metric replay fixtures

- Added a bounded, deterministic Node replay seam for the exact production
  detector order: velocity calculation, current-frame history push, 200-frame
  cap, then `stepFormPhase`. Each fixture gets fresh detector, velocity,
  history, and retained-release state; cancellation is applied before release.
  No synthetic EOF frame or shot summarization is added.
- Added two reviewed, tracked sample schedules derived from license-compatible
  public Pixabay videos: `oblique-single-release` (`43254`) and
  `scene-cut-arrow-retrieval` (`40769`). The JSON contains scalar detector
  inputs only, including one draw-wrist normalized x/y/visibility time series;
  it contains no video, pixels, full 33-point landmark set, URL, path, device,
  user identifier, or private-practice data.
- The loader caps source size at 256 KiB and frames at 5,000, requires exact
  keys/profile/columns and finite monotonic data, and rejects duplicate or
  unknown raw JSON keys before parsing. Runtime/parity failures return `1`;
  schema/config/dependency failures return `2`.
- Extended the real-video harness with an explicitly gated
  `--record-only --capture-derived-fixtures` path. It allowlists the two source
  video hashes, records core/model/runtime hashes plus Playwright/Chromium
  versions, and writes a content-addressed immutable candidate only after
  browser-to-Node event parity and actual visible-shot-count parity pass.
- Corrected the current Mixkit 34710/48725 license record to Restricted License
  / Personal Use only. They are excluded from tracked/public metric fixtures,
  capture allowlists, and default downloads. Local personal diagnostics require
  the explicit `fetch-videos.py --include-restricted-personal` opt-in.
- Added 13 stable Node infrastructure checks and eight Python tests for capture
  gating, allowlists, immutable writes, the Python-to-Node bridge, parity,
  error taxonomy, and default fetch selection. The stable Node suite now runs
  through `check:form`; semantic acceptance remains separate while known
  detector defects are RED.

Validation:

- TDD RED: the first Node run exited `1` because the fixture module did not
  exist; the first Python run exited `1` because capture helpers did not exist.
  The default-fetch boundary test also exited `1` before public and restricted
  source maps were separated.
- `npm run test:form-fixtures`: pass, 13 checks.
- `python -B tools/golden-replay/test_golden_expectations.py`: pass, 28 tests.
- `npm run check:form`: pass.
- `npm run check:all`: pass, including app, globals, analysis, form,
  gamification, today's result, security, UI, PWA, storage, and version gates.
  An earlier run hit a transient `EPERM` on the UI smoke-only browser profile;
  `check:ui` and a clean full rerun both passed.
- `npm run lint`, `npm run format:check`, Node syntax checks, Python AST parsing,
  and `git diff --check`: pass.
- `npm run golden:form-fixtures`: expected acceptance RED, exit `1`, with
  exactly two known failures. `oblique-single-release` misses the reviewed
  `4300--4600 ms` true window and retains a late `6742.088 ms / close` event;
  `scene-cut-arrow-retrieval` retains an unwanted
  `9157.544 ms / adaptive` event instead of zero shots.
- Independent strict review and a separate verifier both returned PASS with no
  blocker, major, or minor findings. No network download or real-video
  recapture was required for the final review.

Risk notes:

- This task makes detector failures reproducible; it does not fix their
  semantics. Product and iPhone field acceptance remain incomplete.
- The captured MediaPipe sample schedule is scheduler-sensitive. Runtime asset
  hashes and versions are recorded, but exact MediaPipe recapture is not
  claimed; deterministic replay begins at the tracked scalar frames.
- Mixkit `48725` can no longer supply a public EOS-pending fixture without
  evidence of a compatible historical grant. EOS lifecycle behavior still
  needs a license-compatible public sample or a separate synthetic lifecycle
  contract.
- The fixture JSON uses capture-generated numeric-array formatting and is not
  part of the repository's Prettier glob; schema, privacy, replay, and JSON
  parsing gates pass.
- Storage/schema, dependencies, Service Worker behavior, version markers,
  release/deployment, and persisted user data remain unchanged.
- The current branch still has the previously documented identifying pathname
  in reachable history and must not be pushed. Final publication requires a
  sanitized branch/tree from `main` or a separately approved history rewrite.

Next task:

- Use `oblique-single-release` as a fixed diagnostic to identify and correct the
  legacy continuity/evidence defect that misses the `4300--4600 ms` true release
  and retains `6742.088 ms`. Keep `scene-cut-arrow-retrieval` and all synthetic
  form checks as non-regression gates; defer a separate adaptive scene-cut
  change unless the evidence proves the same root cause.

### 2026-07-29 - Task 6 legacy release continuity

- Reproduced the oblique failure deterministically and traced two consequences
  of the same legacy evidence defect. The old path combined a stale
  `maxV=32.161` with later close/position evidence at `4061.929 ms`, then let
  that provisional candidate occupy confirmation/refractory through the real
  release. A separate low-quality pose jump at `6742.088 ms` reused the same
  non-coherent window aggregation and was retained through a long null run.
- Added `legacyReleaseContinuity` to require the current history tail, timestamp,
  velocity, minimum departure, and draw-arm continuity to describe the same
  frame. The calibrated fallback additionally requires motion away from the
  immediately preceding usable frame and the session-local release speed. The
  fixed high-speed path keeps its legacy speed threshold. NB/NB2/null-bridge,
  pending cancellation, refractory, confidence, and dW-visibility policies are
  unchanged.
- Added synthetic regression coverage for stale velocity, a discontinuous pose
  jump, calibrated sub-threshold departure, the 15 fps accuracy boundary, exact
  floating-point boundaries, non-finite draw-arm input, stale history identity,
  and a preceding null frame.
- Promoted `oblique-single-release` into the stable form check. It must match the
  reviewed count/window and retain the `close` legacy label. Production replay
  now retains exactly `4457.414 ms / close`; the `6742.088 ms` event is absent.
- Kept the separate scene-cut defect isolated. Its retained result remains
  exactly `9157.544 ms / adaptive`; the first already-canceled legacy candidate
  moves from `1241.174` to `1220.075 ms`, with the same
  `1641.490 ms / no-depart` cancellation and no downstream state change.

Validation:

- TDD RED before production changes:
  - `npm run test:form-fixtures` failed because the retained
    `6742.088 ms / close` event was outside `[4300, 4600]`.
  - `node tools/check-form-core.js` failed because stale velocity plus later
    anchor evidence produced one release instead of zero.
- `npm run check:form`: pass.
- `npm run check:all`: pass, including app, globals, analysis, form,
  gamification, today's result, security, UI, PWA, storage, and version gates.
- `npm run test:e2e`: pass, 41 tests.
- `npm run lint`: pass.
- `npm run format:check`: pass.
- Targeted Prettier check for the three changed JS files: pass.
- `python -B tools/golden-replay/test_golden_expectations.py`: pass, 28 tests.
- `git diff --check`: pass.
- `npm run golden:form-fixtures`: expected exit `1` with exactly the remaining
  scene-cut semantic mismatch. The oblique case passes at
  `4457.414 ms / close`.
- Initial strict review found a missing legacy-label assertion and targeted
  formatting drift; both were fixed. Adversarial review rejected an initial
  fixed-four-frame implementation for FPS dependence and an arm-continuity
  bypass. The implementation was redesigned, and the final adversarial review
  and a separate fresh verifier both returned ready-to-commit with no blocker
  or major finding.

Risk notes:

- The deterministic public fixture proves this sample schedule, not the
  required iPhone 18-shot field matrix. The `45°` continuity bound and
  calibrated path still need multiple real camera angles, handedness settings,
  and range placements.
- At 10 fps, one low-speed departure frame followed by a calibrated-speed frame
  can still lose the two-close-frame evidence to the existing 250 ms window.
  The UI already treats less than 15 fps as below the accuracy boundary; normal
  10 fps ease-out profiles remained detected in the adversarial probe.
- `scene-cut-arrow-retrieval` remains an enforcing RED and is the next detector
  task. Do not hide it by weakening expectations.
- Storage/schema, dependencies, Service Worker behavior, version markers,
  release/deployment files, persisted user data, and fixture JSON are
  unchanged.
- The current branch still contains the previously documented identifying
  pathname in reachable history and must not be pushed. Final publication
  requires a sanitized branch/tree from `main` or an explicitly approved
  history rewrite.

Next task:

- Use `scene-cut-arrow-retrieval` to diagnose and correct the independent
  adaptive temporal-coincidence false positive at `9157.544 ms`. Add a RED
  no-shot semantic regression first, preserve the now-green oblique fixture and
  all adaptive/legacy/NB/NB2 synthetic checks, and do not loosen the reviewed
  zero-shot expectation.

### 2026-07-29 - Task 6 adaptive departure temporal coherence

- Reproduced the remaining scene-cut false positive deterministically at
  `9157.544 ms / adaptive`. The scene cut itself was not the cause: new hold
  evidence formed after the cut at `7894.855 ms`, the wrist then remained
  beyond the relative departure boundary for about `1129.586 ms`, and the old
  candidate combined that stale departed pose with a later inward
  `maxV=6.530` sample and a separate direction jitter.
- Added a fresh departure-origin contract to `adaptiveReleaseCandidate`.
  Normal candidates must contain the most recent below-departure span inside
  the existing 250 ms rise window, and qualifying velocity is limited to that
  span's origin or later. A speed spike before a newer origin can no longer be
  combined with a slow later departure.
- Preserved null-only occlusion recall. When the current frame is the first
  usable observation after pose loss, the latest prior usable frame may bridge
  the rise window only when it is at or after active evidence and still below
  the departure boundary. The existing 1.5-second evidence expiry remains the
  outer limit.
- Made adaptive candidates fail closed unless the complete history has finite,
  strictly increasing, non-future timestamps and the unique tail frame matches
  the current raw-metric object. This prevents duplicate, out-of-order, future,
  or non-finite prefix entries from preserving an origin or contributing
  velocity.
- Added synthetic regression coverage for stale already-departed poses, exact
  250 ms and departure boundaries, speed before/at/after origin, duplicate
  current timestamps, evidence-time boundaries, 500 ms null-only recovery, and
  malformed timestamp prefixes. Existing direction, speed, floating-point,
  malformed-input, FPS, let-down, NB/NB2, cancellation, and refractory
  contracts remain green.
- Promoted `scene-cut-arrow-retrieval` into the stable semantic form check. It
  must match the reviewed zero-shot expectation and emit no gross adaptive
  release, so a later cancellation cannot hide a false candidate. The
  `oblique-single-release` result remains exactly one retained
  `4457.414 ms / close` event.
- Synchronized the adaptive design specification with the fresh-origin,
  origin-bound velocity, null-only recovery, and timestamp fail-closed
  contracts. Fixture JSON and reviewed expectations were not changed.

Validation:

- Initial TDD RED:
  - `node tools/check-form-core.js` failed with
    `adaptive candidate requires a fresh departure origin: expected false, got true`.
  - `npm run test:form-fixtures` failed because scene-cut expected zero retained
    shots but replay retained `9157.544 ms / adaptive`.
- Review-remediation RED:
  - speed-before-origin initially matched because `maxV` was collected
    independently of the new origin;
  - a short-window-only implementation lost the existing 260/500 ms null-only
    release recovery;
  - malformed future/duplicate/non-monotonic/non-finite history prefixes
    initially left a previously found origin eligible.
- `npm run check:all`: pass, including app, globals, analysis, form,
  gamification, today's result, security, UI, PWA, storage, and version gates.
- `npm run test:e2e`: pass, 41 tests.
- `npm run lint`: pass.
- `npm run format:check`: pass.
- `python -B tools/golden-replay/test_golden_expectations.py`: pass, 28 tests.
- `npm run golden:form-fixtures`: pass:
  - oblique: retained `4457.414 ms / close`;
  - scene-cut: retained `0`, adaptive gross events `0`.
- `git diff --check`: pass.
- Independent trace research and mutation probing confirmed the root cause and
  preserved 15/30/60 fps adaptive detection, A/B/C profiles, six-shot counting,
  the approved 100 ms fast-let-down tradeoff, 200/230/260/500 ms null-only
  recovery, and exact fixture event contracts. Final strict and adversarial
  reviews returned ready-to-commit with zero blocker, major, or minor findings.

Risk notes:

- These deterministic public fixtures and synthetic boundaries do not replace
  the required iPhone 18-shot field matrix. Real MediaPipe behavior still needs
  side-view, oblique, and normal-range validation, including handedness and
  camera-placement variation.
- Motion and speed occurring within one continuous below-departure span remain
  eligible by design. Crossing the boundary and forming a newer origin excludes
  the older speed. The remaining within-span tradeoff requires field evidence,
  not another blind threshold change.
- A malformed old timestamp now disables the adaptive candidate until that
  entry leaves the 200-frame history. Known production and replay callers
  generate monotonic timestamps; this is an intentional fail-closed fallback.
- Storage/schema, dependencies, Service Worker behavior, version markers,
  release/deployment files, persisted user data, and fixture JSON remain
  unchanged.
- The current branch still contains the previously documented identifying
  pathname in reachable history and must not be pushed. Final publication
  requires a sanitized branch/tree from `main` or an explicitly approved
  history rewrite.

Next task:

- Audit the existing form-diagnostic save/export path against the 18-shot field
  acceptance matrix and implement only the smallest missing privacy-safe
  handoff needed for an iPhone field run. Keep video and full landmarks
  ephemeral, avoid storage-schema changes without approval, and make every
  retained shot's threshold/evidence path reviewable before any release task.

### 2026-07-29 - Task 6 diagnostic handoff audit checkpoint

- Completed four independent read-only audits of the detector-to-storage path,
  iPhone field workflow, 18-shot acceptance contract, and privacy boundary.
  This checkpoint changes documentation only; implementation remains behind
  design approval.
- Confirmed that the core already returns all seven required adaptive-fire
  values: `anchorFloor`, `anchorEnter`, `releaseSpeed`, `evidenceAgeMs`,
  `evidenceStrength`, `departDelta`, and `fireEvidence`. Live capture keeps the
  complete object only transiently. Persisted `features[].diag` retains just
  `maxV`, `rise`, `nullFrames`, and `conf`; replay does not attach per-shot
  debug data; and `releaseFires.framesBefore` excludes the fire frame.
- Confirmed an acceptance-critical identity defect. Automatic cancellation
  removes the current `shots` array tail rather than the shot created by that
  pending detector receipt. If the newest receipt is manually removed during
  the confirmation window, a later cancellation can remove the preceding true
  shot. Manual removal also leaves no diagnostic outcome event.
- Confirmed that additive nested diagnostic fields are preserved by the current
  schema-5 normalization path, so the missing evidence can be added without a
  storage migration, key change, dependency, or Service Worker change.
- Confirmed that the only transferable diagnostic-bearing artifact is the full
  JSON database backup. It also contains unrelated sessions, equipment,
  settings, notes, active state, and trash, so it is unsuitable for
  privacy-minimized field evidence.
- Confirmed that `tools/serve-iphone.ps1` is not a live-camera field path. It
  serves a LAN IP over HTTP, which is not a secure context for
  `getUserMedia()`, and its MIME table omits the `.mjs` and `.wasm` types needed
  by the local pose model. A trusted HTTPS preview with correct MIME types, or
  a separately approved sanitized HTTPS deployment, is required for the human
  iPhone matrix.
- Reconciled the remaining acceptance gap: synthetic and licensed scalar
  fixtures are strong regression evidence, but they do not prove three real
  six-shot ends, at most one removable false positive per end, no automatic
  removal of a shown true shot, or complete evidence for every retained shot.
- Confirmed documentation drift in `tools/golden-replay/README.md`: it still
  describes the two tracked scalar fixtures as failing even though the current
  enforcing checks and progress evidence show them passing. It must be updated
  before GitHub preparation can be considered complete.

Validation:

- Four independent read-only audit reports completed at
  `c31ca937a8392feffe60aca20e8fdb21f6a47c12`.
- Repository and worktree were clean before this documentation update.
- No runtime, storage, UI, dependency, Service Worker, version, release, or
  deployment files changed in this checkpoint.

Risk notes:

- A field run on the current build cannot satisfy the evidence contract and can
  trigger the manual-remove/auto-cancel race. Do not treat it as acceptance.
- Diagnostics-only export must construct a fresh bounded allowlist object. It
  must exclude database records, persisted/user IDs, dates, paths, URLs, video,
  pixels, raw landmarks, free-form strings, and unbounded traces. Only
  export-local receipt ordinals may correlate a fire with its outcome.
- The current branch still contains the previously documented identifying
  pathname in reachable history and must not be pushed. Final publication
  requires a sanitized branch/tree from `main` or an explicitly approved
  history rewrite.

Next task:

- Obtain design approval for the smallest three-part handoff: exact pending
  shot identity and outcome tracking; complete live/replay fire snapshots; and
  a bounded diagnostics-only exporter in the default-off debug surface. After
  approval, write the design and implementation plan, then implement one small
  TDD task per run starting with the cancellation identity defect.

### 2026-07-29 - Task 6 golden replay documentation reconciliation

- Reconciled `tools/golden-replay/README.md` with the current deterministic
  fixture behavior. The two tracked scalar schedules are now documented as
  passing: `oblique-single-release` retains exactly
  `4457.414 ms / close`, while `scene-cut-arrow-retrieval` retains zero shots
  and emits zero gross adaptive releases.
- Moved the old `6742.088 ms / close` and
  `9157.544 ms / adaptive` results into explicit historical-regression context
  instead of presenting them as current output. The README now states that a
  passing scalar replay is not proof of current full-video or iPhone behavior.
- Corrected the fast Node test count from 13 to 15 and clarified the validation
  boundary: the standalone acceptance CLI is not a direct `check:all`
  dependency, but the Node fixture suite included by `check:form` enforces both
  tracked semantic contracts. The corresponding test label now names the
  standalone CLI boundary instead of claiming that all semantic acceptance is
  excluded.
- Clarified that real-video baselines are observational snapshots rather than
  truth, broadened the documented configuration/preflight exit-2 cases, and
  limited the local-server no-write claim to source videos, app source, and
  fixtures. The runner's documented gitignored `out/` artifacts remain
  unchanged.

Validation:

- `python -B tools/golden-replay/test_golden_expectations.py`: pass, 28 tests.
- `npm run test:form-fixtures`: pass, 15 tests, including the assertion that
  the scene-cut fixture emits zero adaptive release events.
- `npm run golden:form-fixtures`: pass, exit `0`:
  - oblique: retained `4457.414 ms / close`;
  - scene-cut: retained `0`.
- `npm run check:form`: pass, including the detector core and all 15 fixture
  checks.
- After the final evidence-attribution wording change, the first targeted and
  repository-wide Prettier checks reported only
  `docs/codex/codex-progress.md`; formatting that file resolved the drift.
- Targeted Prettier check for all three changed files: pass.
- `npm run format:check`: pass.
- `npm run lint`: pass.
- `git diff --check`: pass.
- Two independent read-only audits agreed on the current output, command
  taxonomy, test counts, provenance boundary, and exact README corrections.

Risk notes:

- The full-video runner and physical iPhone matrix were not run in this
  documentation task. Scheduler-sensitive video replay and real camera
  acceptance remain unproven.
- No runtime behavior, fixture, expectation, source-license record, storage,
  dependency, Service Worker, version, release, deployment, or user data
  changed. The only JavaScript change is a test-description string.
- The current branch still contains the previously documented identifying
  pathname in reachable history and must not be pushed. Final publication
  requires a sanitized branch/tree from `main` or an explicitly approved
  history rewrite.

Next task:

- Obtain design approval for the smallest three-part diagnostic handoff, then
  write the design and implementation plan. Start implementation with a TDD
  regression proving manual removal followed by detector cancellation cannot
  remove the preceding retained shot.

### 2026-07-29 - Local preview model-asset MIME and LAN safety

- Extended the existing cross-platform PWA asset gate to enforce the local
  preview-server contracts needed by form tracking. Both PowerShell helpers
  must serve `.mjs` as `text/javascript; charset=utf-8` and `.wasm` as
  `application/wasm`.
- Added separator-bound, case-insensitive repository-root containment to both
  helpers. A sibling path that merely shares the `archery-note` prefix can no
  longer pass the static-file boundary check.
- Made the LAN helper describe its real scope at startup: HTTP supports app
  preview and saved-video replay only, while iPhone live-camera capture
  requires a trusted HTTPS origin. It also warns that the repository root is
  exposed on all interfaces and must be used only on trusted private Wi-Fi.
- Corrected the stale feasibility-plan instruction that said the LAN HTTP
  helper could be reused for iPhone camera validation. The successful
  prototype used trusted LAN HTTPS; the current helper is not that field path.

Validation:

- Baseline `npm run check:pwa`: pass before adding the new contract.
- MIME TDD RED: `npm run check:pwa` exited `1` because `tools/serve.ps1` had no
  `.mjs` mapping.
- MIME and warning GREEN: `npm run check:pwa` passed after the two helper
  updates.
- Review-remediation RED: the strengthened gate exited `1` because
  `tools/serve.ps1` still used the prefix-only root check.
- Final focused GREEN: `npm run check:pwa` passed with MIME, warning, URL-label,
  and separator-bound containment contracts enforced.
- Windows runtime GET checks passed for both `tools/serve.ps1` on port 8741
  and `tools/serve-iphone.ps1` on port 8742. Both returned the exact expected
  Content-Type headers for the tracked MediaPipe `.mjs` and `.wasm` assets.
  The temporary server processes were stopped by exact PID, and both ports
  were confirmed free afterward.
- A read-only PowerShell boundary probe accepted an actual repository child
  and rejected a synthetic same-prefix sibling path.
- `npm run check:all`: pass, including app, globals, analysis, form, fixture,
  gamification, today's result, security, UI, PWA, storage, and version gates.
- `npm run lint`: pass.
- The first targeted and repository-wide Prettier checks after the final
  ledger addition reported only this progress file; it was reformatted before
  the final validation rerun.
- Final targeted Prettier check and `npm run format:check`: pass.
- `git diff --check`: pass. Both PowerShell helpers remain ASCII-only.
- Independent strict review found one major recovery gap: an invalid MIME
  response already stored in persistent `archery-note-pose-v1` could survive
  the server fix. A test-first remediation now requires the localhost helper
  to name that one-cache recovery and warn against clearing all site data.
  Automatic cache repair remains behind the Service Worker approval gate.
- Recovery TDD RED: `npm run check:pwa` exited `1` because
  `tools/serve.ps1` did not explain how to remove only the stale pose cache.
- Recovery GREEN: `npm run check:pwa` passed after adding the bounded recovery
  and data-loss warnings.
- Post-remediation strict re-review and a separate verifier both returned
  ACCEPT with zero blocker, major, or minor findings. They confirmed the
  Service Worker is unchanged and the remaining one-time manual recovery is
  accurately approval-gated.

Risk notes:

- This task does not create or claim a trusted HTTPS iPhone live-camera path.
  The physical 18-shot acceptance matrix remains unrun.
- Existing localhost users with an old invalid pose response must remove only
  `archery-note-pose-v1` once. The app does not yet self-heal that cache because
  changing Service Worker cache behavior requires explicit user approval.
- The LAN helper intentionally serves the repository root for local
  development. Path escape is blocked, but trusted-network use is still
  required because development files under that root are reachable.
- No detector behavior, daily phone UI, storage/schema, persisted data,
  dependency, Service Worker behavior, version marker, release, deployment,
  or model asset changed.
- The current branch still contains the previously documented identifying
  pathname in reachable history and must not be pushed. Final publication
  requires a sanitized branch/tree from `main` or an explicitly approved
  history rewrite.

Next task:

- Obtain design approval for the smallest three-part diagnostic handoff, then
  write the design and implementation plan. Start implementation with a TDD
  regression proving manual removal followed by detector cancellation cannot
  remove the preceding retained shot.

### 2026-07-29 - Live form-capture secure-context preflight

- Reproduced the current LAN-HTTP failure in a real Chromium origin with
  `isSecureContext === false`: tapping live analysis opened the full capture
  sheet, requested the pose module, and then showed generic camera/iOS advice.
  The browser had no `navigator.mediaDevices`, so the advice did not identify
  the actual HTTPS prerequisite.
- Added a fail-closed guard at the first line of `openFormCapture()`, before
  capture DOM creation, active-workflow state, the approximately 15 MB pose
  load, or `getUserMedia()`. It uses the existing accessible `appConfirm`
  dialog to explain the trusted-HTTPS requirement and offers only `閉じる` or
  `保存動画を選ぶ`.
- Kept saved-video replay independent of the secure-context guard. Choosing
  the fallback opens the existing `video/*` file picker without touching the
  pose loader or camera until a file is actually selected.
- Kept trusted loopback HTTP eligible for live capture by checking
  `window.isSecureContext`, not the URL protocol. The native HTTPS scheme and
  future trusted HTTPS previews therefore remain on the normal live path.
- Added a black-box Playwright regression for both insecure LAN-style HTTP and
  trusted loopback HTTP, plus a fast source-order contract in `check:form`.
  No detector threshold, count semantics, storage/schema, persisted data,
  dependency, Service Worker, version marker, or release behavior changed.

Validation:

- E2E TDD RED: the new insecure-origin test timed out looking for the HTTPS
  dialog because the unguarded implementation opened `.formCapture`.
- Source-contract TDD RED: `npm run check:form` failed because no guard existed
  before capture DOM creation.
- Copy-fit TDD RED: after mobile visual review shortened the CTA, both the E2E
  selector and source contract failed against the old longer label before the
  product copy was updated.
- Focused GREEN: the targeted Playwright run passed 2/2. The insecure case
  proves zero pose loads, zero camera calls, no capture sheet, an accessible
  explanatory dialog, and a working `video/*` fallback. After a synthetic file
  selection, the replay sheet and pose seam start while the camera seam stays
  untouched. The loopback case proves live startup remains eligible and
  reaches both pose and camera seams.
- `npm run check:form`: pass, including both tracked deterministic form
  fixtures.
- A 390 x 844 Chromium screenshot after the dialog animation confirmed that
  the title, message, and both actions fit without clipping; shortening the
  CTA keeps it on one line.
- `npm run test:e2e`: pass, 43/43.
- `npm run lint`: pass.
- `npm run format:check`: pass.
- `git diff --check`: pass.
- The first parallel `npm run check:all` attempt reached `check:ui` and failed
  with `EPERM` while cleaning its temporary Chrome profile. A standalone
  `npm run check:ui` then passed, and a fresh sequential `npm run check:all`
  passed every app, globals, analysis, form, gamification, today's-result,
  security, UI, PWA, storage, and version gate.
- Independent strict review returned zero blocker, major, or minor findings.
  Its additional Playwright WebKit 2311 probe confirmed that transient user
  activation remains active through the confirmation promise and opens the
  single-select `video/*` picker.
- An independent verifier initially found that the tracked E2E stopped at the
  file chooser. After adding synthetic file selection and direct replay
  assertions, its re-review returned zero findings and approved the
  checkpoint.

Risk notes:

- Chromium proves the web-platform boundary and file-picker handoff, but the
  dialog-to-picker user-activation path still needs confirmation in physical
  iPhone Safari. This is not a substitute for the trusted-HTTPS 18-shot field
  matrix.
- The change gives an actionable refusal on insecure HTTP; it does not create
  or claim a trusted HTTPS field endpoint.
- The current branch still contains the previously documented identifying
  pathname in reachable history and must not be pushed. Final publication
  requires a sanitized branch/tree from `main` or an explicitly approved
  history rewrite.

Next task:

- Obtain design approval for the smallest three-part diagnostic handoff, then
  write the design and implementation plan. Start implementation with a TDD
  regression proving manual removal followed by detector cancellation cannot
  remove the preceding retained shot.

### 2026-07-29 - Valid-to-valid pose-gap boundaries

- Corrected the tier-1 null-bridge duration from the first unusable sample to
  the last unusable sample to the actual interval between the last usable pose
  and the next usable pose. The previous calculation omitted both endpoint
  frame intervals and could also clip the start of a gap at the 250 ms rise
  window, making slow departures look like releases, especially at low frame
  rates.
- Kept the shipped limits unchanged: tier-1 remains inclusive through 150 ms,
  tier-2 remains greater than 150 ms and inclusive through 350 ms, and 151 ms
  gaps remain outside tier-1.
- Made a gap count whenever its interval intersects the rise window, including
  when all unusable samples have just moved outside the window but the recovery
  pose remains inside. Multiple gaps retain the longest intersecting interval.
  A missing preceding usable pose is treated as an unbounded gap and therefore
  fails closed.
- Added a one-nanosecond timestamp tolerance to only the tier-1/tier-2 gap
  boundaries. This absorbs accumulated fractional-frame rounding at 60 fps:
  mathematically exact 150 ms and 350 ms remain inclusive, while two
  nanoseconds above either boundary is classified on the correct outer side.
- Required the legacy release paths to receive the production history
  contract: finite, strictly increasing timestamps, no future frame, and the
  identical current raw metrics object at the `now`-timestamped tail.
  Future, duplicate, non-monotonic, stale-tail, or cloned-tail histories now
  suppress release detection instead of contributing corrupted gap or velocity
  evidence.
- Re-derived the older D-prime fixtures in valid-to-valid units: seven 20 ms
  null samples plus the 10 ms recovery interval are 150 ms; eleven such samples
  plus recovery are 230 ms and remain recoverable through NB2.
- Added direct regression coverage for integer and 60 fps 150 ms, 151 ms,
  rise-window-left-edge multiple gaps, unknown gap starts, 60 fps NB2 lower
  and 350 ms upper boundaries, two-nanosecond exclusions, and every chronology
  contract clause.

Validation:

- Initial TDD RED: a 151 ms valid-to-valid gap produced one release instead of
  zero. The exact 150 ms companion already produced one release.
- Independent review RED: after the first correction, a 151 ms gap whose only
  null sample had left the rise window was forgotten in favor of a later
  100 ms gap and still produced one `close/nb` release.
- Chronology RED: a future null history entry produced one release instead of
  failing closed.
- Fractional-frame RED:
  - mathematically exact 150 ms at 60 fps evaluated as
    `150.00000000000068 ms` and was rejected;
  - mathematically exact 350 ms at 60 fps evaluated just above 350 ms and was
    rejected.
- Counterfactual mutation checks proved that every new seam is observable.
  Reverting full-history interval scanning, the closure overlap condition,
  chronology gating, current-tail timestamp, raw identity, the 1 ns tolerance,
  or either NB2 tolerance bound makes its dedicated regression fail.
- `npm run check:form`: pass, including the detector suite and all 15 metric
  fixture infrastructure checks.
- `npm run golden:form-fixtures`: pass:
  - oblique retained one `4457.414 ms / close` release;
  - scene-cut retrieval retained zero releases.
- `python -B tools/golden-replay/test_golden_expectations.py`: pass, 28 tests.
- `npm run check:all`: pass, including app, globals, analysis, form,
  gamification, today's result, security, UI, PWA, storage, and version gates.
- `npm run lint`: pass.
- `npm run format:check`: pass.
- `git diff --check`: pass.
- The first parallel `check:all` attempt encountered `EPERM` because UI smoke
  and the full E2E run concurrently opened the same temporary Chromium profile.
  No artifact was deleted; a fresh sequential `check:all` passed.
- Final fresh `npm run test:e2e`: pass, 43/43, after the detector refinements
  and ledger formatting.
- The full scheduler-sensitive real-video runner completed all five local
  sources on the final detector:
  - the reviewed positive retained one release at `4315.630 ms` and passed its
    `4300-4600 ms` truth window;
  - three zero-shot sources retained zero releases and passed;
  - the close-up negative retained one false release at `6204.595 ms` after
    four earlier candidates were canceled, so the overall runner exited `1`.
    This remains a real product-accuracy gap and was not reclassified as truth.
- Independent boundary probe, independent verifier, and strict reviewer all
  returned ACCEPT on the final diff. Strict review reported zero blocker,
  major, or minor findings for this checkpoint.

Risk notes:

- The real-video runner is scheduler-sensitive. This run proves that the
  reviewed positive can still be detected after the gap correction and exposes
  one remaining negative false positive; it is not a substitute for the
  physical iPhone 18-shot acceptance matrix.
- A separate read-only Chromium probe reproduced a live-view identity defect
  three times out of three: if the user manually removes a pending candidate,
  its later automatic cancellation removes the preceding retained real shot.
  Fixing it requires the still-unapproved stable shot-identity handoff.
- Current diagnostics cannot prove every retained shot's fire-time evidence,
  and the only shareable JSON path exports the full practice database. The
  privacy-minimized diagnostic handoff remains approval-gated.
- A production-velocity adaptive positive characterization and the physical
  iPhone matrix remain missing. Existing scalar golden positive evidence uses
  the `close` path.
- No UI, persisted data, storage schema, dependency, Service Worker, version
  marker, release, deployment, or user data changed in this checkpoint.
- The current branch still contains the previously documented identifying
  pathname in reachable history and must not be pushed. Final publication
  requires a sanitized branch/tree from `main` or an explicitly approved
  history rewrite.

Next task:

- Add the production-velocity adaptive positive characterization as the next
  safe detector checkpoint. In parallel, obtain explicit approval for the
  three-part diagnostic handoff: stable shot identity and outcome mapping,
  complete live/replay fire snapshots, and a default-off bounded
  diagnostics-only export.

### 2026-07-29 - Production-velocity adaptive positive characterization

- Added a detector characterization that accepts only normalized form metrics
  and derives every velocity through the shipped
  `makeFormVelocitySource().step(history, raw, now)` path. It does not inject
  precomputed velocity into the detector.
- Reproduced the capture/replay processing order in one end-to-end scenario:
  compute velocity, push the identical current raw object, cap history at 200,
  run `stepFormPhase`, and summarize the release immediately from that same
  history using the returned `anchorStartTs` and top-level `anchorEnter`.
- Used a 60 fps sequence with 12 setup/draw frames, 180 oblique hold frames
  cycling through anchor norms `0.47/0.475/0.48`, and 25 follow-through frames.
  Nine one-frame wrist displacements and their returns produce exactly 18 of
  180 hold velocities at approximately 7 torso-lengths per second. The release
  wrist displacement produces approximately 8.5 torso-lengths per second.
- Proved the full positive outcome: the detector visits DRAWING, ANCHORING,
  FULL_DRAW, RELEASE, and FOLLOW; emits exactly one adaptive release; emits no
  cancellation; learns `anchorFloor=0.47`, `anchorEnter=0.59`, and the capped
  noise-adapted `releaseSpeed=8`; and keeps no legacy velocity label.
- Proved that the fire-time history is bounded and ends with the current
  timestamp and identical raw object. The resulting summary is non-null,
  non-degraded, uses 173 primary hold frames, reports a 3000 ms hold and
  `anchorNorm=0.475`, and preserves the supplied angle and confidence medians.
- Extended the capture/replay source contract through the complete production
  handoff. Both loops must keep velocity, current push, cap, detection,
  `released`, and a direct synchronous `onShot` call in that order, and each
  `onShot` must begin by directly summarizing the same history.
- Confirmed the adaptive candidate remains pending at the inclusive 400 ms
  boundary, clears on the next 60 fps frame without cancellation, and leaves
  history capped at 200.
- This checkpoint changes tests only. Detector thresholds, runtime behavior,
  UI, storage/schema, persisted data, Service Worker, dependencies, version
  markers, model assets, and user data are unchanged.

Validation:

- Baseline disposable probe observed one adaptive release, zero cancellations,
  18/180 computed hold outliers near 7, computed release velocity
  `8.500000000000075`, `anchorEnter=0.59`, `releaseSpeed` approximately 8,
  `holdMs=2999.999999999993`, and a non-degraded 173-frame summary.
- Counterfactual probes proved the new seams are observable:
  - zeroing the shipped velocity source produces zero releases;
  - running detection before the current history push produces zero releases;
  - omitting the adaptive summary boundary changes the summary to
    `degraded=true` with 29 fallback frames;
  - forcing long-hold calibration to retain the default speed 6 fails the new
    exact learned-speed assertion;
  - delaying the capture `onShot` call fails the synchronous production-order
    contract.
- `npm run check:all`: pass, including app, globals, analysis, form,
  gamification, today's result, security, UI, PWA, storage, and version gates.
- `npm run golden:form-fixtures`: pass:
  - oblique retained one `4457.414 ms / close` release;
  - scene-cut retrieval retained zero releases.
- `python -B tools/golden-replay/test_golden_expectations.py`: pass, 28 tests.
- `npm run test:e2e`: pass, 43/43.
- `npm run lint`: pass.
- `npm run format:check`: pass.
- `git diff --check`: pass.
- The initial independent specification and strict reviews both returned the
  diff for stronger evidence: one required exact learned-speed coverage and
  direct history-tail assertions; the other demonstrated that a delayed live
  summary mutation still passed. After remediation, both reviewers returned
  ACCEPT with zero blocker, major, or minor findings. A third independent
  verifier also returned ACCEPT after reproducing all numeric outcomes and the
  zero-velocity and missing-summary-boundary mutations.

Risk notes:

- This begins at normalized form metrics. It does not exercise MediaPipe
  landmark extraction, real video scheduling, camera permissions, or physical
  iPhone motion, and it does not replace the 3-condition/18-shot field matrix.
- The full five-video runner was not repeated because no product detector code
  changed. Its last final-detector run remains four of five truth cases: the
  reviewed positive passed, while the close-up negative retained one false
  release at `6204.595 ms`.
- The live manual-delete then delayed-cancel identity defect remains
  reproducible and unfixed. Stable shot identity, complete fire snapshots, and
  a privacy-minimized diagnostics-only export remain one approval-gated design
  handoff and were not changed here.
- The current branch still contains the previously documented identifying
  pathname in reachable history and must not be pushed. Final publication
  requires a sanitized branch/tree from `main` or an explicitly approved
  history rewrite.

Next task:

- Diagnose the remaining full-video close-up false release at `6204.595 ms`
  frame by frame, read-only first. Compare its hold evidence, departure origin,
  velocity timing, and confirmation lifecycle with the reviewed positive and
  this production-velocity positive before proposing any detector change.

### 2026-07-29 - Close-up false-fire causal diagnosis

- Kept the product detector, view, tests, storage, and release surface
  unchanged while tracing the remaining reviewed close-up false fire from its
  hold evidence through the end of the video.
- Earlier `close/vel` candidates in the target observation were self-repaired
  by the existing confirmation lifecycle. The final candidate was the only
  retained result.
- Reconstructed the final decision from transient unrounded diagnostics before
  the local output was overwritten. A short fixed-close hold was followed by
  an outward landmark jump, then a fast inward rebound. The rebound still met
  the legacy rise, current-speed, and draw-arm predicates. Its immediate
  direction was inward, so the direction predicate failed, but the legacy fast
  route does not require positive departure direction and emitted `close/vel`.
  No reusable restricted-video scalar schedule is copied into this tracked
  ledger.
- Confirmed a second necessary condition for retaining this false candidate.
  After the fire, the trace did not sustain the required departure evidence
  and then moved back below its boundary. Video end arrived well inside the
  400 ms confirmation window, before the pending candidate could be resolved.
- Confirmed that saved-video replay handles end-of-stream by stopping the loop
  and reporting completion. It neither resolves `detector.pendingRelease` nor
  removes the provisional item from `shots`, so the unresolved candidate
  remains enabled for saving as a detected shot.
- Compared the retained reviewed positive at `4315.630 ms`. It used the same
  `close/vel` route, had the same qualifying close-frame count, no null gap,
  and similar velocity and rise. Its discriminating observations were a
  positive immediate direction and sustained post-fire departure; its pending
  state cleared before video end.
- The production-velocity synthetic positive remains a separate adaptive
  route. It clears its pending state on the first frame after the inclusive
  400 ms boundary, so neither the target direction predicate nor a correctly
  modeled end-of-stream review state should alter that positive.
- Falsified the simple alternatives:
  - changing only the required close-frame count cannot distinguish this pair
    because both decisions had the same qualifying count;
  - changing the learned anchor boundary does not explain the target fire,
    because it had no adaptive evidence and used the fixed `close` route;
  - a simple global `CONF_GATE=.72` gate was unsafe for the current fixtures:
    an independent probe removed the target false fire but caused the
    scene-cut negative to retain a shot;
  - resetting detector and adaptive state before the final scene did not
    remove the false fire, so leaked prior cancellation state is not causal.

Validation:

- Several fresh serialized real-video observations completed successfully but
  produced different retained counts and event schedules. This confirms that
  the Python/MediaPipe runner is an observation tool, not a deterministic
  regression fixture. Multiple runs again ended with a candidate still inside
  its 400 ms confirmation window.
- `node tools/golden-replay/replay-form-fixtures.js`: pass:
  - the oblique scalar fixture retained one `4457.414 ms / close` release with
    `pendingAtEnd=false`;
  - the scene-cut fixture retained zero releases.
- Applied the existing `+.04` direction predicate to the legacy fast route
  only in memory, without editing a file. `node tools/check-form-core.js`
  remained fully green, including the production adaptive characterization.
  Both scalar fixtures preserved their exact release/cancel event sequences.
  The predicate rejects the target inward decision and accepts the reviewed
  positive outward decision.
- An independent counterfactual verifier advanced the captured pending state
  beyond 400 ms with continued low-anchor observations and reproduced the
  expected `no-depart` cancellation. It also showed why an unconditional
  end-of-stream cancellation is unsafe: truncating a real final shot before
  enough follow-through evidence creates the same unresolved state.
- Four read-only agents independently audited the target lifecycle,
  positive/negative separation, fixture and runner limitations, and ranked
  counterfactuals. They agreed that directionless fast matching and the
  unresolved end-of-stream state explain this run. They also agreed that
  direction alone is not a complete close-up-video fix because a different
  MediaPipe sampling schedule can observe the same false scene with a positive
  direction.

Risk notes:

- This is a diagnosis-only checkpoint. No detector behavior, user-facing UI,
  persisted data, storage/schema, dependency, Service Worker, version marker,
  model asset, or user data changed.
- The restricted local close-up video and any scalar schedule derived from it
  remain untracked and must not be published as fixtures or documentation.
  The original target JSON was overwritten by a concurrent local replay after
  its decision and post-fire lifecycle were captured transiently, so this
  observation is not a durable release artifact.
- A legacy-fast-only direction requirement is promising for the target event
  and passed the targeted deterministic checks above, but its recall impact
  still needs a synthetic RED regression and the physical iPhone matrix. A
  separate sampling of the negative scene produced a positive direction, so it
  cannot close the whole acceptance gap by itself.
- End-of-stream must not silently leave an unresolved candidate saveable as a
  detected shot, but discarding every pending candidate would silently lose a
  genuine shot near the end of capture. A safe UI resolution also depends on
  targeting the exact provisional shot rather than the current fragile
  last-array-item behavior.
- The exact pending-shot identity and outcome mapping, complete live/replay
  fire snapshots, and default-off bounded diagnostics-only export remain the
  same three-part approval-gated handoff. None was implemented here.
- The current branch still contains the previously documented identifying
  pathname in reachable history and must not be pushed. Final publication
  requires a sanitized branch/tree from `main` or an explicitly approved
  history rewrite.

Next task:

- Add an anonymous synthetic regression for an inward legacy-fast rebound and
  its outward true-positive companion, without copying restricted-video
  scalars. Confirm that the new regression is RED, implement only the minimum
  direction-coherence correction, then require the complete deterministic
  suite to return GREEN. Keep end-of-stream shot mutation unchanged until
  stable pending-shot identity and outcome mapping are explicitly approved.

### 2026-07-29 - Legacy-fast direction coherence

- Added an anonymous, physically coherent synthetic pair that keeps anchor
  evidence, total rise, current speed, arm continuity, and frame timing
  equivalent while reversing only the final movement direction.
- The outward companion remains one detected legacy release. The inward
  rebound is now zero releases.
- Added direct helper boundaries proving that the existing `+0.04` direction
  threshold is inclusive for `fastMatched` and that a value immediately below
  it is excluded.
- Confirmed the intended RED before editing production code:
  `legacy detection rejects an inward rebound` expected zero releases and
  observed one.
- Moved no threshold and added no new detector state. The production change
  reuses the existing direction predicate in the fixed-speed `fastMatched`
  branch.
- A final strict review then reproduced a recall regression: production
  velocity skips a transient null pose and measures from the latest non-null
  wrist, while the first direction change inspected only the immediately
  previous array element. A short outward shot after one missing pose therefore
  had fast velocity but unknown direction and fell to zero releases.
- Added a second anonymous production-path pair that derives velocity through
  `computeFormVelocity`. It fixes three outcomes together: a bounded null gap
  preserves one outward fast shot, the same computed speed with an inward
  direction remains zero, and a gap beyond the tier-1 cap remains zero.
- Confirmed this companion RED before remediation, then aligned only the fast
  direction origin with the velocity origin: it may scan across actual null
  frames to the latest non-null pose within the existing 150 ms tier-1 cap.
  It does not skip a non-null low-confidence or low-visibility pose. The
  calibrated path still requires the immediately adjacent usable frame.
- The adaptive, NB, and NB2 implementations are unchanged. Updated both legacy
  continuity comments to document the bounded fast origin and adjacent
  calibrated origin.
- End-of-stream handling, pending-shot mutation, UI, persisted data,
  storage/schema, Service Worker, dependencies, version markers, model assets,
  and user data were not changed.

Validation:

- `node tools/check-form-core.js`: expected RED for the inward rebound before
  the first production edit; expected RED for the bounded-gap outward companion
  after strict review; pass after the bounded origin correction.
- `npm run check:form`: pass, including the bounded fixture contract and both
  public scalar fixtures.
- `npm run check:all`: pass, including app, globals, analysis, form,
  gamification, today's result, security, UI, PWA, storage, and version gates.
  An earlier parallel run collided with the simultaneous E2E Chromium profile
  and failed UI cleanup with `EPERM`; the required serialized rerun passed.
- `npm run lint`: pass.
- `npm run test:e2e`: pass, 43/43.
- `python -B tools/golden-replay/test_golden_expectations.py`: pass, 28/28.
- `npm run format:check`: the first run identified wrapping in this appended
  ledger section; after formatting this document only, pass.
- An additional whole-file `npx prettier` check on the changed core and test
  files reported pre-existing formatting differences in unchanged sections.
  The changed hunks match Prettier output, so no unrelated bulk rewrite was
  performed.
- `git diff --check`: pass.
- Direct public fixture replay remained event-equivalent:
  - the oblique positive retained its single reviewed `close` release and
    ended with no pending candidate;
  - scene-cut retrieval retained zero releases and ended with no pending
    candidate.
- A full serialized five-video CPU/0.25x observation produced the expected zero
  retained releases for all four negative cases, including the close-up target.
  Its public positive retained one release but outside the reviewed timing
  window, so that run was correctly recorded as four of five rather than a
  pass.
- Re-running the public positive alone retained one release inside its reviewed
  window and passed. Landmark-frame counts differed materially between the two
  runs, confirming that the real-video harness remains a scheduler-sensitive
  observation rather than a deterministic gate.
- Two additional serialized close-up observations each retained one false
  release. Across the three new observations, only one passed. One failed run
  retained its last provisional fire, while the other retained an earlier fire
  and later canceled the final one. Direction coherence therefore removes the
  diagnosed inward sample but does not solve the negative scene across
  MediaPipe sampling schedules.
- Three independent read-only reviews returned qualified ACCEPT for this
  checkpoint. They confirmed the synthetic pair, exact boundary, public
  fixtures, and legacy route isolation. They also agreed that this correction
  is an in-scope bug fix, not a complete close-up or field-acceptance solution.
- The first final verifier returned ACCEPT, but the first final strict review
  returned the transient-null recall regression above. That RETURN was treated
  as blocking and remediated before commit.
- After remediation, the same strict reviewer and an independent verifier both
  returned ACCEPT with zero blocker, major, or minor findings. Their fresh
  probes covered low-confidence and low-visibility origins, the inclusive
  150 ms gap boundary, the over-limit boundary, and in-memory reversions of
  both the direction predicate and bounded origin.
- After remediation, a second five-video observation passed three of five:
  all three Mixkit/target negatives, including the close-up target, retained
  zero; the public positive missed its reviewed shot and the public 40769
  negative retained one. Their fire-time diagnostics showed no null gap, so
  neither failure used the new bounded-gap fast route.
- Re-running those two public videos retained one positive approximately one
  frame before its strict review window and again retained one 40769 false
  shot. A fresh privacy-bounded 40769 metric capture then retained zero, and
  deterministic replay under current versus an in-memory direction-only core
  produced identical release/cancel events. This isolates runner sampling from
  the bounded-gap semantic change.
- Two additional close-up repeats retained two and one false shots. The
  retained candidates used ordinary no-gap velocity or the existing NB route,
  never the new bounded-gap fast route. Real-video instability and the broader
  false-fire gap therefore remain, but the recall remediation did not create
  the observed retained candidates.

Risk notes:

- The fixed-speed branch can now bridge actual null poses only when its latest
  non-null direction origin is within the existing 150 ms tier-1 cap. The
  calibrated route still fails closed across any missing adjacent pose, and
  gaps over the cap remain owned by NB2. The physical matrix must still include
  15 fps and transient pose-loss shots before release.
- In valid detector state, the learned legacy speed is bounded below the fixed
  fast threshold. On contiguous observations, fast is normally a diagnostic
  subset of calibrated; across a bounded null gap, fast remains the stricter
  high-speed recall path while calibrated requires adjacency.
- The real-video repeats prove that immediate direction alone cannot close the
  target false-fire gap. No additional confidence, visibility, or movement
  threshold should be activated from this evidence alone.
- The restricted close-up source and its derived frame schedule remain local
  and untracked. This ledger records only aggregate outcomes and lifecycle
  shape.
- The physical iPhone 3-condition/18-shot matrix remains incomplete, so the app
  is not yet ready for a product-complete or publish-ready claim.
- Stable pending-shot identity/outcome mapping, complete live/replay fire
  snapshots, and a default-off bounded diagnostics-only export remain the
  explicitly approval-gated diagnostic handoff. End-of-stream shot mutation
  remains unsafe until the exact provisional shot can be targeted and a real
  final shot can be distinguished from an unresolved false candidate.
- The current branch still contains the previously documented identifying
  pathname in reachable history and must not be pushed. Final publication
  requires a sanitized branch/tree from `main` or an explicitly approved
  history rewrite.

Next task:

- Obtain explicit approval for the three-part diagnostic handoff. After
  approval, implement stable provisional-shot identity and outcome mapping as
  the first isolated TDD checkpoint. Keep complete snapshots, bounded export,
  and end-of-stream resolution as later one-task checkpoints so storage and
  privacy behavior remain reviewable.

### 2026-08-03 - Approved form diagnostic handoff design

- The user selected the view-owned receipt approach (option A) and explicitly
  approved all three previously gated handoff slices: stable provisional-shot
  identity/outcome mapping, complete live/replay fire snapshots, and a
  default-off bounded diagnostics-only JSON export.
- Added the written design at
  `docs/superpowers/specs/2026-08-03-form-diagnostic-handoff-design.md`.
- The design allocates an opaque receipt ID before shot summarization, uses the
  same ID as `shot.id` when a visible shot exists, keeps manual and detector
  outcomes on separate axes, and forbids every array-tail cancellation
  fallback.
- The design keeps `stepFormPhase()` independent of UI identity, preserves
  unresolved EOS shots without adding an EOS keep/delete policy, and defines
  exact fail-closed behavior for missing or mismatched identities. One active
  operational receipt remains outside the 32-entry diagnostic archive, so
  exact-ID cancellation still works after overflow. The unreachable-in-normal-
  use receipt-sequence ceiling also fails closed: it clears deletion ownership,
  latches desynchronization, creates no shot, and freezes that workflow instead
  of risking a stale cancellation target.
- The complete fire snapshot contains exactly the seven acceptance fields.
  A diagnostics-only matrix coordinator selects three exact current-version
  live records by ID and fixed condition slot; replay, array reordering,
  duplicate IDs, restored substitutions, stale versions, overflow, invalid
  outcomes, and incomplete evidence fail closed.
- The export projects fresh allowlisted objects, remaps runtime IDs to local
  ordinals, caps each run at 32 receipts and the pretty-printed UTF-8 artifact
  at 65,536 bytes, and excludes practice records, dates, IDs, arbitrary
  strings, media, raw landmarks, frame traces, settings, and device claims.
  Share cancellation has no transport fallback, and native diagnostic cache
  files have explicit stale-file and final cleanup contracts.
- Current schema-5 nested-field preservation makes the diagnostic additions
  additive. The design does not authorize or require a storage migration,
  storage-key change, dependency, Service Worker change, version bump,
  release, deployment, public push, PR, or history rewrite.
- Matrix record/coordinator commits are specified as one synchronous save with
  exact in-memory rollback and a frozen retry-or-close state on storage failure;
  no failed write may advance the operator to the next condition.
- No runtime, test, storage, UI, Service Worker, dependency, version, release,
  deployment, or user-data behavior changed in this design checkpoint.

Validation:

- Self-review found and removed stale alternatives, undefined invariant
  diagnostics, array-order source selection, ambiguous share fallback, save
  rollback gaps, and the sequence-exhaustion stale-owner edge. Placeholder and
  contradiction scans are clean.
- Final design SHA-256
  `3A549661C2E4129D4D836A0FD2D5081BF51971F7950FF2961FE2C72197688814`
  received independent `ACCEPT` results for exact-ID lifecycle, privacy/source
  selection, schema-5/storage rollback compatibility, and holistic consistency.
- `npx prettier --check docs/superpowers/specs/2026-08-03-form-diagnostic-handoff-design.md docs/codex/codex-progress.md` - PASS.
- `npm run format:check` - PASS.
- `git diff --check` - PASS.
- Runtime/app tests were not run because this checkpoint changes design and
  progress documentation only; no production or test code changed.

Risk notes:

- The written design still requires the user's review before an implementation
  plan or production code is written.
- End-of-stream resolution and the physical iPhone 3-condition/18-shot matrix
  remain separate later checkpoints.
- The current branch still contains the previously documented identifying
  pathname in reachable history and must not be pushed. Final publication
  requires a sanitized branch/tree from `main` or an explicitly approved
  history rewrite.

Next task:

- Obtain user review of the committed written design. After approval, invoke
  the writing-plans workflow and create the detailed TDD implementation plan;
  do not implement runtime behavior in that planning checkpoint.

### 2026-08-09 - Executable form diagnostic implementation plan and safe WIP checkpoint

- Continued from the approved design and expanded
  `docs/superpowers/plans/2026-08-03-form-diagnostic-handoff.md` into an
  executable ten-task TDD plan. The plan now has concrete file paths,
  interfaces, conditional loaders, synthetic fixtures, exact RED/GREEN
  commands, implementation code for the receipt tracker, live/replay identity
  wiring, seven-field snapshots, matrix validation, bounded allowlist export,
  transactional save/delete, frozen retry/discard, no-fallback transport, and
  exact-boolean settings UI/E2E.
- Corrected the plan's diagnostics-OFF wording to preserve record shape while
  explicitly allowing the required preallocated `form-receipt-N` shot ID.
  Clarified that the user-authorized planning WIP is a full sanitized current
  tree snapshot on `origin/main`, not a release candidate or physical result.
- Removed workstation-specific paths from `AGENTS.md` and three planning
  documents in commit `32a0dc29` so the current tree has no workstation
  absolute paths, user-name, or session-path hits before a GitHub snapshot is
  considered.

Plan evidence:

- Plan SHA-256:
  `C28D837FAB6E0FB6B32685C5FA96DD06C092CD43678CECE4ED2A278BFD5BC7E2`
- Plan structure scan: 10 tasks, 10 interface blocks, 110 checkbox steps,
  zero malformed step headings, zero empty function stubs, and zero
  placeholder terms.
- `npx prettier --check docs/superpowers/plans/2026-08-03-form-diagnostic-handoff.md` - PASS.
- `git diff --check` - PASS.
- Runtime/app tests were not run; this checkpoint changes documentation and
  path-redaction docs only. No production behavior, schema, dependency,
  Service Worker, version marker, release, or deployment changed.

Risk notes:

- The plan is not implementation evidence. The physical iPhone 3-condition /
  18-shot matrix, trusted HTTPS preview, and all Task-1-to-Task-10 runtime
  validation remain outstanding.
- The source branch `feat/adaptive-release-detection` contains sensitive
  ancestor `4a0ff1ec` and must never be pushed. A fresh `git fetch origin main`
  was unavailable because the execution environment reached its usage limit;
  the safe checkpoint must therefore use the already recorded local
  `origin/main` ref and a non-force new branch. If the remote branch name is
  already occupied, stop rather than overwrite it.
- The next GitHub action is only the user-authorized WIP snapshot
  `codex/form-diagnostic-handoff-plan-wip`; no PR, Pages update, release,
  version bump, or final RC push is authorized by this checkpoint.

Next task:

- Commit this plan and ledger, prove the candidate tree equals the committed
  current WIP tree, prove `4a0ff1ec` is not an ancestor, and push only the
  sanitized WIP branch. Then resume implementation with the recommended
  subagent-driven workflow, one task and review gate at a time.

## 2026-08-03 — Form diagnostic handoff Task 1

- Changed: added the pure release-receipt tracker with deterministic workflow-local IDs, independent user/detector outcomes, bounded diagnostic retention, and fixed saturated invariant counters.
- RED: `node tools/check-form-core.js` first failed at `release receipt tracker factory is exported`; the injected ceiling test then failed by allocating `form-receipt-3`.
- GREEN: `node tools/check-form-core.js`, `npm run check:form`, and `npm run lint -- --quiet` passed.
- Risk: overflow intentionally makes a diagnostic run ineligible but does not block receipt 33+ identity, manual clicked-ID deletion, or exact cancellation.
- Review: independent Task 1 review APPROVED; exact action/snapshot shapes, copy isolation, bounded overflow, counter saturation, sequence fail-closed behavior, and scope all passed. Reviewer also reran the focused checks and `git diff --check`.
- Next: Task 2 wires exact receipt ownership into live capture and replay.

## 2026-08-03 — Form diagnostic handoff Task 2

- Changed: live capture and replay now preallocate workflow-local receipt IDs and remove only a receipt action’s exact deletion target.
- RED: `node tools/check-form-core.js` reproduced `capture cancellation never owns array tail` before any source-order edit.
- GREEN: retained A survives B fire -> manual remove B -> cancel B; receipt 33/34 remains exact with diagnostics OFF and ON.
- Risk: replay EOS remains unresolved by design; this task adds no keep/delete policy.
- Next: Task 3 copies and persists the exact seven fire fields additively.
