# Codex Integration Progress (history ledger)

> **2026-09-02: this file is now the long-form HISTORY LEDGER, not the current state.**
> Current state lives in [`progress.md`](../../progress.md) at the repo root — read that
> first. The "Current Status" section below was last accurate on 2026-07-03 and is kept
> for provenance. Append new history here; write the current state in `progress.md`.

This file records what the Archery Note integration work has done, step by step.
Keep entries honest. Append after every Codex step.

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
- Review: independent Task 2 review APPROVED; live/replay parity, exact-ID ownership, frame priority, active-only abandon, fatal freeze, and diagnostics OFF/ON cap behavior all passed. Reviewer reran focused app/form/globals/lint/syntax/diff checks.
- Next: Task 3 copies and persists the exact seven fire fields additively.

## 2026-08-03 — Form diagnostic handoff Task 3

- Changed: live and replay now copy the exact seven fire fields from the current release result and persist copied receipt diagnostics only when `formDebug === true`.
- RED: the conditional fire copier export and exact diagnostic feature projection assertions failed before production edits.
- GREEN: form checks plus normalize-twice, save/load, JSON import, safety restore, and trash restore preservation passed for both synthetic fixtures.
- Compatibility: false, absent, truthy-string, numeric, and object diagnostic settings persist neither existing `features[].diag` nor new receipt fields; the legacy fixture remains valid.
- Risk: missing or invalid fire snapshots make a run exporter-ineligible instead of inventing evidence.
- Review: independent Task 3 review APPROVED; exact seven-key validation, exact-true gating, diagnostics-off shape, deep-copy isolation, schema-5 normalize/import/save-load/safety/trash preservation, and synthetic fixtures all passed. Browser/iPhone exercise remains a later validation gate.
- Next: Task 4 adds pure matrix coordination and record eligibility.

## 2026-08-09 — Form diagnostic handoff Task 4

- Changed: added DOM-free matrix diagnostics, a three-slot (`side`, `oblique`,
  `normal_range`) coordinator, Web-Crypto-only UUID allocation, fail-closed
  record eligibility validation, immutable slot planning, and copy-only
  coordinator invalidation.
- RED: `node tools/check-form-diagnostics.js` first failed with `diagnostic
matrix coordinator API is exported`; the valid first-slot case then failed
  with `eligible live record advances the matrix: expected true, got false`.
- GREEN: `node tools/check-form-diagnostics.js`, `npm run check:form`,
  `npm run check:storage`, `npm run check:app`, and `npm run lint -- --quiet`
  passed.
- Test correction: the supplied numeric-only UUID fixture could not exercise
  uppercase rejection, so the harness uses a separate canonical UUID containing
  a letter for that case. The planner immutability assertion now verifies the
  source coordinator after mutating the returned result rather than expecting a
  mutated result array to retain its pre-mutation length.
- Review remediation: planner output now deep-copies JSON-shaped own data before
  adding the matrix marker. A focused RED proved that the former descriptor-only
  copy shared the feature array; mutating returned nested features, diagnostics,
  receipt arrays, and fire snapshots now leaves the source record unchanged.
  Accessor, callable, proxy-failing, and non-plain nested values fail closed as
  `record-invalid` instead of leaking a shared mutable reference.
- Coverage: the diagnostics harness now locks the frozen slot constant and the
  exact `side` → `oblique` → `normal_range` progression through a completed
  three-record coordinator.
- Remediation GREEN: `node tools/check-form-diagnostics.js`, `npm run
check:form`, `npm run check:storage`, `npm run check:app`, `npm run
check:globals`, `npm run lint -- --quiet`, syntax, and Prettier checks passed.
- Risk: this task is pure validation/projection only; save, delete, export,
  transport, settings, and physical-device workflow integration remain in later
  tasks.
- Review: initial Task 4 review found an Important shallow-copy defect; fix `d2592580` added cycle-safe deep record isolation plus exact frozen-slot/progression checks. Re-review APPROVED with one non-blocking test-hardening Minor (direct marker/individual-receipt mutation coverage).
- Next: Task 5 projects only the validated matrix diagnostics for review.

## 2026-08-09 — Form diagnostic handoff Task 5

- Changed: added a pure, fail-closed 3×6 diagnostic export projection. It resolves
  only the coordinator's exact three record IDs, fixes the output order to
  `side` → `oblique` → `normal_range`, emits fresh allowlisted literals, and
  excludes runtime IDs, notes, landmarks, and all other source fields.
- RED: `node tools/check-form-diagnostics.js` failed at the first new exporter
  call because `buildFormDiagnosticExport` was absent.
- GREEN: synthetic shuffled fixtures, missing/duplicate/slot-substitution
  refusals, accessor poison protection, fire-range validation, source
  immutability, exact UTF-8 65,536/65,537-byte boundaries, and unavailable
  encoder handling pass.
- Validation: `node tools/check-form-diagnostics.js`, `npm run check:form`,
  `npm run check:storage`, `npm run check:app`, and `npm run lint -- --quiet`
  passed.
- Risk: projection deliberately refuses any source object carrying an own
  accessor rather than reading it. Export transport, persistence, settings UI,
  and sharing remain later tasks.
- Review: initial Task 5 review found an Important export-boundary leak of internal `invalid-app-version`; fix `280fa55a` normalizes unsupported coordinator errors to `coordinator-invalid`. Re-review APPROVED; existing `adaptive|close|nb2` fire evidence remains the authoritative persisted contract.
- Next: Task 6 integrates export settings and save/delete workflow boundaries.

## 2026-08-09 — Form diagnostic handoff Task 6

- Changed: form-record deletion now re-resolves its selected record after confirmation, plans detached record/trash/coordinator candidates, and makes one exact synchronous save transaction. A false or thrown primary save restores the original array references, coordinator own-property state/value, and the pre-transaction `updatedAt`; it never renders a deletion on failure.
- RED: `node tools/check-form-diagnostics.js` first failed at `transaction helper is exported`, then at `deletion candidate planner is exported`. The bounded deletion-source contract also failed before the handler was changed because it neither re-resolved nor guarded persistence. The first browser fixture run exposed startup persistence contaminating the injected primary-write probe (`attempts: 2` and a startup-updated timestamp), so the synthetic fixture now waits for startup quiescence and captures its baseline immediately before the user action.
- GREEN: false and thrown writes roll back, true writes commit exactly once, invalid candidates do not write, duplicate/missing selected records fail closed, trash remains capped, and only a selected matrix record receives the detached invalidated coordinator. The browser test observes one failed primary attempt with the selected row/coordinator/timestamp unchanged, followed by a successful retry that deletes once and invalidates the coordinator.
- Validation: `node tools/check-form-diagnostics.js`, `node tools/check-form-core.js`, `npm run check:form`, `npm run check:storage`, `npm run check:app`, `npm run lint -- --quiet`, `npx prettier --check tools/check-form-diagnostics.js tools/check-form-core.js tests/e2e/form-diagnostics.spec.js docs/codex/codex-progress.md`, and the Playwright rollback test passed. The browser command uses a manually prestarted matching-port server because Playwright's CI-managed `webServer` teardown hangs in this shared process environment; the test itself completed `1 passed (3.2s)` and the exact server PID was stopped afterward.
- Scope boundary: rollback cannot undo `DB_REV`, an already absorbed debounce, schema writes, or arbitrary injected-save side effects; backup/share paths and generic trash behavior remain untouched.
- Review: independent Task 6 review APPROVED; own-field allowlist, exactly-one synchronous save, false/throw rollback, selected-only invalidation, detached trash cap, generic-path preservation, and synthetic E2E behavior all passed. The CI-managed webServer teardown hang is documented as an environment constraint; the matching-port prestarted-server test passed 1/1.
- Next: Task 7 makes live/replay diagnostic saves frozen, retryable, and matrix-aware.

## 2026-08-09 — Form diagnostic handoff Task 7

- Changed: live and replay diagnostic saves now freeze the capture exactly once,
  resolve the active receipt as `workflow-save`, copy one diagnostic record, and
  create one detached candidate before the first write. A failed write keeps that
  candidate by identity; retry invokes only the attempt path and never allocates,
  snapshots, or plans again. Closing a failed candidate requires an explicit
  discard confirmation.
- RED: `node tools/check-form-diagnostics.js` failed with `frozen diagnostic
save creator is exported`. The new form-core source contract then failed with
  `replay pose continuation cannot restart after freeze or close` before the
  missing async guard was added.
- GREEN: live six-shot planning occurs once, while zero-shot, replay, and
  five-shot records do not plan or mutate a coordinator. False and thrown writes
  restore the exact records/coordinator/`updatedAt`, retry reuses candidate
  identity and bytes, and debug/coordinator changes block persistence before a
  write.
- Browser evidence: all four workers passed—deletion rollback plus live retry,
  discard cancel/confirm, and replay retry. The shared Playwright parent process
  did not terminate within the 60-second command cap after reporting the four
  successful workers, matching the pre-existing shared-environment teardown
  issue; each focused worker also reported `ok` independently.
- Risk: diagnostics-off records remain on the legacy direct push/save path with
  no retry UI. This task does not add native transport, settings, export, schema,
  version, or Service Worker changes.
- Review: APPROVED after remediation. The follow-up preserved the replay
  diagnostics-off receipt resolution, kept fatal receipt failures outside the
  retry/discard flow, exposed matrix-success/ineligible notices, and stabilized
  the browser write probe after startup. Minor remaining coverage: explicit
  source assertions for every legacy branch and a browser six-shot matrix case;
  no production change is needed for either.
- Next: Task 8 owns the diagnostics-specific native/Web transport boundary.

## 2026-08-09 — Form diagnostic handoff Task 8

- Changed: added a diagnostics-only `shareFormDiagnosticsJson` transport seam
  after the unchanged generic share helper. It validates string input, builds
  one JSON `File`, chooses Web Share → Capacitor native share → direct download
  exactly once, and never falls back after a transport is selected.
- Native transport writes only the fixed cache path and UTF-8 MIME/payload,
  removes stale and final files with not-found tolerance, classifies only the
  exact cancellation signals, and reports `{status, cleanupFailed}` with no
  extra keys. Direct download owns its anchor/object URL cleanup independently.
  Supplied environments are used as complete adapters without filling missing
  fields from browser globals or plugins.
- RED: the task brief's conditional loader is designed to fail at
  `shareFormDiagnosticsJson is a function` before the production marker exists;
  this run proceeded with the implementation marker in place before executing
  the harness. No parser or unawaited-rejection failure was observed.
- GREEN: transport fixtures cover Web priority and cancellation, native
  cancellation/write/URI/cleanup failures, stale-file tolerance, exact
  filename/MIME/path/encoding/payload, direct-download cleanup failures,
  partial-native fallback, supplied-environment isolation, non-string refusal,
  and forbidden side effects. `node tools/check-form-diagnostics.js` passes.
- Validation: `npm run check:form`, `npm run check:storage`, `npm run check:app`,
  `npm run check:globals`, `npm run lint -- --quiet`,
  `npx prettier --check tools/check-form-diagnostics.js docs/codex/codex-progress.md`,
  and `git diff --check` pass.
- Risk: this is a pure transport boundary; no existing generic share/download,
  storage, schema, settings, Service Worker, or version behavior is changed.
- Review: independent Task 8 review APPROVED with no Critical/Important findings.
  Focused transport matrix, cumulative `check:all`, lint, format, and diff checks
  all passed. Minor TDD evidence note: the missing-function RED was reconstructed
  against the pre-marker `HEAD` source after implementation rather than observed
  in a clean first run.
- Next: Task 9 adds exact-boolean diagnostics settings and mobile E2E coverage.

## 2026-08-09 — Form diagnostic handoff Task 9

- Changed: added one secondary settings section for the 18-shot diagnostic matrix,
  hidden and action-disabled unless `db.settings.formDebug === true`; the existing
  toggle now persists only exact booleans and updates the section immediately.
  Start/export actions consume Task-4 validators and slots, lock the workflow before
  confirmation, re-check debug/workflow/coordinator tokens after confirmation, and
  commit a fresh coordinator through the transactional candidate seam without
  touching practice records or backup timestamps. Export uses only the Task-8
  diagnostics transport and fixed result/copy tables.
- RED: `npm run check:ui` first failed at the bounded missing copy contract before
  the settings marker existed. The first browser run exposed that hidden sections
  make Playwright role descendants inaccessible; the E2E assertions now locate the
  disabled buttons directly while retaining the production `hidden`/`aria-hidden`
  boundary. A Task-7 regression from the shared global coordinator-token symbol was
  caught in browser evidence and fixed by preserving both the `(database, token)`
  save seam and the `(token)` settings check.
- GREEN: exact absent/false/string-`"true"` `formDebug` values stay hidden and
  disabled; toggles are immediate without reopening settings; double-clicks create
  one confirmation; allocation/save failures preserve coordinator and `updatedAt`;
  post-confirm debug/workflow/token changes fail closed; fixed refusal codes and
  privacy allowlist prevent transport; Web Share/native/download MIME, filename,
  cleanup, and backup/database invariance pass; 360x780, 390x844, and 1280x800
  viewport probes report no overflow, clipping, or overlap.
- Validation: `npm run check:ui`, `npm run check:form`, `npm run check:storage`,
  `npm run check:app`, `npm run check:globals`, `npm run lint -- --quiet`, three
  `node --check` targets, and `git diff --check` pass. Prettier reports the same
  pre-existing whole-file style drift in the touched legacy scripts/tests and the
  progress ledger; no bulk reformat was applied. Prestarted-server Playwright run
  (PORT 4182, Chromium) passed 29/29 Task-9 tests; the four Task-7 regression
  workers also passed 4/4. The CI-managed Playwright parent teardown remains a
  shared-environment hang, so worker results are recorded from the bounded
  prestarted server.
- Risk: settings are intentionally secondary and exact-debug gated; no storage
  migration, Service Worker, dependency, version, or primary capture UI changes
  were made. Legacy formDebug-off save paths remain unchanged.
- Review: independent Task 9 review APPROVED on latest implementation/style
  HEAD (`d827a2db` + `8d591eca`). Three-shard Playwright evidence passed 29/29;
  cumulative `check:all`, lint, format, and diff checks passed. The reviewer
  confirmed exact-boolean gating, secondary-only UI placement, lock/token
  rechecks, fixed result-copy tables, transport/privacy invariance, and the
  dual-signature coordinator-token compatibility with Task 7.
- Next: Task 10 performs cumulative verification and prepares the sanitized
  GitHub handoff.

## 2026-08-09 — Form diagnostic handoff Task 10

- Checkpoint: the implementation under review is `feat/adaptive-release-detection`
  at commit `d3e09e2f17ca5d0eae794aad65f70ad26986c11b`, tree
  `8d591ecabea6f077e62fccec4fc5dacc0801049d`. The sensitive ancestor check
  `git merge-base --is-ancestor 4a0ff1ec HEAD` exited `0`; this branch is local
  verification only and must not be pushed. The initial status contained only
  the three pre-existing metadata documents (`docs/codex/integration-plan.md`,
  `docs/features/form-tracking-feasibility.md`, and
  `docs/features/tracking-analysis-plan.md`); none is staged by Task 10.
- Added: `docs/form-diagnostic-field-acceptance.md`, an English physical
  iPhone checklist retaining the required Japanese UI labels and explicit
  trusted-HTTPS, privacy, and non-deployment boundaries. No physical device,
  trusted HTTPS preview, version bump, deployment, PR, or push occurred.
- Focused contracts: `node tools/check-form-core.js` and
  `node tools/check-form-diagnostics.js` both exited `0`, ending with
  `Form core checks OK` and `Form diagnostic checks OK`. These suites cover
  schema/storage compatibility, matrix eligibility, privacy projection,
  UTF-8 65,536/65,537-byte boundaries, transport no-fallback behavior, and
  exact-boolean settings/source contracts.
- Cumulative gates: `npm run check:storage`, `npm run check:app`,
  `npm run check:ui`, and `npm run check:all` all exited `0`. The app and
  aligned markers report v84 (`APP_VER=84`, package `0.84.0`, `version.json`
  `v=84`, and Service Worker cache `archery-note-v84`). `npm run lint` exited
  `0`. The first format check reported only the existing mixed line-ending
  state of the progress ledger; after normalizing that ledger with Prettier,
  `npm run format:check` and the focused field/progress check both exited `0`.
- Browser and deterministic evidence: a manually prestarted matching-port
  Chromium run completed `76 passed (1.1m)`, including all Task 7 save retry/
  discard/replay cases and all 29 Task 9 settings/transport cases. The
  CI-managed Playwright parent teardown still hangs in this shared process
  environment after workers finish, so the bounded prestarted-server result is
  recorded. `python -B tools/golden-replay/test_golden_expectations.py` ran 28
  tests and ended `OK`; `npm run golden:form-fixtures` retained one oblique
  `close` release and zero scene-cut releases without semantic mismatch.
- Native mirror: `npm run build:native-web` exited `0`, generated the ignored
  `dist/native` mirror at v84, `git check-ignore -q
dist/native/native-readiness.json` exited `0`, and the scoped `dist` status
  was empty. Chromium's transient root `debug.log` (one ffmpeg warning) was
  removed before the handoff commit; it is not a product artifact.
- Independent reviews: Reviewer A found and corrected the stale Task 6 next-
  task sentence so it now points to Task 7 frozen/retryable saves; after that
  correction the review is APPROVED with no Critical/Important findings.
  Reviewer B independently reran the cumulative evidence and approved with no
  Critical/Important findings. Both reviewers confirmed the physical iPhone /
  trusted-HTTPS matrix remains unexecuted and that the sensitive branch stays
  non-push.
- Remaining gap and next action: run the three-condition 6/6 physical matrix
  only on a trusted HTTPS preview pinned to the exact implementation commit and
  tree, retain the privacy-safe artifact hash, and construct a fresh sanitized
  release branch only after those physical criteria pass. Do not push this
  sensitive source branch or treat this field handoff as physical acceptance.

## 2026-08-09 — Task 11 exact form-tracking boolean boundary

- Changed: `formTrackingEnabled()` and the settings tracking chips now accept
  only the literal boolean `true`. Missing, `false`, `0`, `1`, `"true"`, and
  `"false"` all render the tracking card hidden and the settings chips as OFF;
  clicking either chip still persists an actual boolean and keeps `aria-pressed`,
  class state, and the toast aligned. Existing `formDebug===true` gates,
  diagnostic transport, and persisted diagnostic record fields are untouched.
- RED: `npm run check:ui` failed at the new exact-gate source assertion. A
  prestarted Chromium run of the seven new cases failed exactly for `1`,
  `"true"`, and `"false"` because the truthy runtime rendered the card; the
  missing/false/0 and literal-true cases passed before the fix.
- GREEN: `node tools/check-form-core.js`, `node tools/check-form-diagnostics.js`,
  `npm run check:all`, `npm run lint`, `npm run format:check`, four
  `node --check` targets, and `git diff --check` passed. The focused form
  diagnostics suite passed 40/40 (Task 7/9 plus the seven new cases) on a
  manually prestarted matching-port server; the existing app-smoke settings
  regression passed 1/1. The CI-managed Playwright teardown constraint remains
  unchanged and is avoided only by the documented prestarted-server run.
- Risk: this is a fail-closed flag/UI boundary only. It does not normalize or
  delete legacy setting values, change storage schema, migrate data, alter the
  Service Worker, add dependencies, or change native transport behavior.
- Next: independent review of this small diff, then fold it into the sanitized
  GitHub handoff only after the physical trusted-HTTPS 3-condition/18-shot
  acceptance remains addressed.

## 2026-08-09 — Form diagnostic E2E startup-quiescence follow-up

- Changed: the allocation-failure/save-false E2E fixture now waits 750 ms after
  reload and removes the startup `updatedAt` before installing the failing save
  seam. This isolates the assertion from the normal launch-count debounce and
  does not change production code or persisted-data behavior.
- Evidence: the focused regression passed 1/1, and the complete prestarted
  Chromium suite passed 83/83. The prior full-suite-only failure (`updatedAt`
  being recreated by startup save) did not recur.
- Scope: only `tests/e2e/form-diagnostics.spec.js` and this ledger are intended
  for the follow-up commit; the three pre-existing metadata documents remain
  unstaged. The generated root `debug.log` contained one Chromium ffmpeg
  warning and was removed.
- Next: independently review this fixture-only change, regenerate the sanitized
  release candidate from the verified tree, and stop at the GitHub `gh`
  installation/authentication boundary plus the still-unexecuted physical
  trusted-HTTPS 3-condition/18-shot acceptance.

## 2026-08-09 — Sanitized handoff candidate checkpoint (initial)

- Initial implementation checkpoint: `feat/adaptive-release-detection` at
  `9a733f240b9d7ec254d813e6ba8f51c89edeec45`, tree
  `3a876a14d51ba2c76cc0849e6a6e19f08fe43349`. The fixture-only follow-up and
  exact-boolean tracking gate are included; the complete prestarted Chromium
  suite is 83/83 and all cumulative gates remain green.
- Initial sanitized local handoff: `codex/form-diagnostic-handoff-release` was
  based directly on `origin/main`
  (`3b4f3b22b562899ffef28bb6d64d7821eced4dde`) and carried the same tree at
  that checkpoint. The sensitive ancestor check
  `git merge-base --is-ancestor 4a0ff1ec
codex/form-diagnostic-handoff-release` exits `1`; the sensitive working
  branch remains local-only.
- Scope hygiene: the three pre-existing metadata documents are still the only
  worktree entries and remain unstaged. No raw diagnostic artifact, video,
  screenshot, generated `debug.log`, or user-specific path is part of the
  candidate tree.
- Publish boundary: `gh --version` is unavailable in this environment, so no
  push or PR was attempted. Install/authenticate GitHub CLI before publishing.
  Physical iPhone Safari acceptance also remains open; execute the trusted
  HTTPS three-condition/18-shot checklist before calling field acceptance
  complete.
- The candidate ref is regenerated after each committed handoff-ledger update;
  its final SHA and tree are reported from the authoritative verification
  command rather than embedded self-referentially in this ledger.

## 2026-08-09 — Public HTTPS parity check

- Read-only check of `https://eita115115.github.io/archery-note/` reports
  `version.json` v84, but the served `scripts/47-form-view.js` is not the
  verified handoff tree: its SHA-256 is
  `3233EA697098105D1041AD0B4D232D8DCCD9FCD223E05AA76AC4F5FE3124EA1E` and it
  contains neither the exact tracking-gate marker nor the frozen-save marker.
- Decision: the public site is not an acceptable physical-test target for this
  handoff. Do not record iPhone results against it; first publish or otherwise
  provide a trusted HTTPS preview pinned to the candidate commit/tree, then
  run the three-condition/18-shot checklist.

## 2026-08-09 — Development dependency security remediation

- GitHub CLI is now installed and authenticated as `eita115115` (v2.97.0).
  The sanitized candidate branch was pushed only after confirming it is based
  on `origin/main` and excludes the sensitive ancestor and the three unrelated
  worktree documents.
- GitHub Dependabot and `npm audit` identified three vulnerable development
  transitive packages: `tar`, `ip-address`, and `brace-expansion`. Production
  dependencies had zero findings. `npm audit fix --package-lock-only
--ignore-scripts` updated only those lockfile entries to `7.5.22`, `10.4.0`,
  and `5.0.9`; no dependency was added and no runtime code changed.
- After `npm ci --ignore-scripts`, full dependency audit, `npm run check:all`,
  lint, format, and the complete prestarted Chromium suite all passed. The
  browser suite completed 83/83; the generated transient `debug.log` was
  removed. The dependency-remediation commit must be reflected in the pushed
  candidate before opening the draft PR.

## 2026-09-28 — Quality improvement inventory checkpoint

- Started from local main `66eb29bf` (v85) in managed worktree `app-quality`,
  branch `codex/app-quality`. Original v84 checkout, its three modified
  documents, `debug.log` and stale index lock were preserved.
- Reconciled historical phases in `docs/codex/app-quality-baseline.md`.
  Updated `progress.md` and added inventory/follow-up tasks in `tasks.json`.
- Original v84 `npm run check:all` passed. Fresh v85 checkout passed app,
  globals and analysis, then failed form: `Error: replay pose continuation
cannot restart after freeze or close`. Source assertion matches literal LF
  while fresh Windows source has CRLF. Fix remains to be validated.
- Captured original initial screen at 375px and inspected local resource sizes.
  Form scripts transfer about 197KB combined; this is a candidate, not a speed
  improvement claim. See baseline report for artifact paths and limitations.
- Initial format check identified only the new baseline report; formatted the
  touched documents before rerunning the required check.
- Risk: documentation only. No runtime, storage, dependency, publication,
  payment or personal-data change. Next task: reproduce and fix newline-sensitive
  validation, then measure performance and refine mobile visual hierarchy.

## 2026-09-28 — Windows source-contract newline fix (AN-006)

- Changed `tools/check-form-core.js` to normalize CRLF to LF when reading the
  form view source. The actual assertion and runtime code remain unchanged.
- Reproduced before changing: `rawMatches:false`, `normalizedMatches:true`,
  1173 CRLF sequences. `npm run check:form` failed with
  `Error: replay pose continuation cannot restart after freeze or close`.
- After: `npm run check:form` and `npm run check:all` exit 0; final output includes
  `Form metric fixture checks OK`, `Form diagnostic checks OK`,
  `Storage round-trip checks OK`, and `Version alignment checks OK`.
- `npm run lint` exit 0. A temporary child-process read interceptor tested the
  entire core checker against LF and CRLF sources, then inverted the replay's
  stop guard in memory. Output: `LF: valid source passed`,
  `LF: inverted stop guard rejected`, `CRLF: valid source passed`,
  `CRLF: inverted stop guard rejected`.
- The first mutation experiment hit the live guard and was rejected by another
  existing assertion. Scoped the experiment to replay, then obtained the exact
  intended rejection in both newline modes. No on-disk app source was mutated.
- Logs and the reproducible local experiment are under
  `artifacts/improvement-baseline/` (`form-before.txt`, `form-after.txt`,
  `check-all-after.txt`, `lint.txt`, `check-newlines.cjs`, `newline-matrix.txt`).
- Risk: tooling only; no scoring, storage, UI, personal-data or release change.
  Updated `progress.md` and `tasks.json`. Next: AN-007 performance measurement
  and a concrete runtime improvement, followed by narrow mobile visual polish.

## 2026-09-28 — Long-history statistics performance (AN-007)

- Reproduced 800-entry cache thrashing with 1,000 synthetic 36-arrow sessions.
  Warm history/analysis switches performed 1,000/2,000 robust calculations.
- Changed `scripts/40-analysis-physics.js` to a session-keyed WeakMap holding
  the latest signature/result. Kept all signature/DB_REV invalidation and math.
- Added regression cases in `tools/check-analysis-core.js` (1,001 sessions,
  score edit, colliding replacement object). The long-history test failed before
  the fix and passed afterward. Existing nudge invalidation tests also passed.
- Added `tools/measure-view-performance.js` and the durable evidence report
  `docs/codex/session-cache-performance.md`. Updated progress and tasks.
- CPU4×/375px Chromium warm median: history 434.2→48.6ms, analysis 998.3→207.7ms.
  Repeat: 46.6/206.9ms. Robust recomputations after warmup: zero. These are local
  synchronous render/layout measurements, not physical-device latency claims.
- Validation: check:all exit 0, lint exit 0, E2E `83 passed (1.1m)`.
  Independent read-only review found no actionable defects.
- Risk/tradeoff: metrics for every reachable session remain cached, with only
  the latest result per session; removed objects can be collected. No scoring,
  storage format, visible layout, payment or personal-data change. Not released.
- Next: AN-008 mobile visual/interaction refinement, using before/after evidence.

## 2026-09-29 — History mobile hierarchy (AN-008)

- Audited record/history/analysis at 375px; refined history first. Summary is
  now three unfilled columns, with a quieter trend sentence. Existing totals,
  average and best-score context remain. Filters use a native disclosure,
  active condition count and restored keyboard focus after changes/reset.
- Runtime changes: `scripts/50-record-view.js`, `scripts/60-history-sight-view.js`,
  `style.css`, regenerated `style.min.css`. Added `tests/e2e/history-layout.spec.js`.
- Durable design/evidence: `docs/codex/history-mobile-polish.md`, three before/after
  light/dark screenshots in `docs/screenshots/history-quality/`. Additional
  360px/1280px captures in `artifacts/mobile-polish/`.
- Validation: build:web-assets succeeded; check:ui `UI smoke checks OK`;
  check:app `Archery Note checks OK (v85)`; lint exit 0; full E2E
  `85 passed (1.0m)`. Two added tests verify actual filtering from three records
  to one, clearing, focus, keyboard access, overflow and opening record details.
- Independent review: no blocking findings. Updated progress and tasks.
- Risk: opening filters adds a step from unfiltered history, while keeping the record
  list immediately visible. No scoring/storage changes. No paid or personal
  information use; screenshots contain only fictional demo data. Not released.
- Next: AN-009 record-start visual hierarchy and repeated condition text.

## 2026-09-29 — Record-start clarity (AN-009)

- Fixed misleading repeat-start label: editing current distance/face no longer
  changes the previous-session label. Removed duplicate conditions and the
  history button's inaccurate analysis caption. Actual start handlers unchanged.
- Repeat is now an unfilled secondary button; primary start stays inverted.
  Removed decorative step numbering and quieted the heading, including dark mode.
- Changed `scripts/50-record-view.js`, `style.css`, generated `style.min.css`.
  Added `tests/e2e/record-start.spec.js` (four light/dark repeat/current cases).
- The new tests failed before the fix, then passed: label stays 18m/40cm after
  selecting 70m/80cm; each action starts its stated conditions.
- Validation: check:all and lint exit 0; E2E `89 passed (1.0m)`.
  Independent review: no actionable findings. Visuals inspected at 360/375/1280px
  in light/dark. Evidence and screenshots: `docs/codex/record-start-polish.md`,
  `docs/screenshots/record-quality/`, `artifacts/record-polish/`.
- No data format, scoring, paid service or personal-data use. Not released.
  Updated progress/tasks. Next: AN-010 release candidate and update/offline gates.

## 2026-09-29 — v86 candidate (AN-010)

- Prepared v86 markers with version:bump; package lock agrees. Built minified CSS
  and isolated web bundle. Remote main still 66eb29bf at preparation time.
- Added tests/e2e/pwa-release.spec.js: real cached offline practice/reload retains
  demo data; simulated newer-version banner reload also preserves demo history.
- check:all, lint, format passed; focused PWA tests 2 passed (4.8s); full E2E 91 passed (1.0m).
- Evidence and limitations: docs/codex/release-v86.md, artifacts/release-v86/.
- No worker activation policy or storage schema changes. No personal data/cost.
- Not published. Actual deployed worker transition and physical iPhone remain
  unverified. Next: publication approval, remote recheck and deployed verification.

## 2026-09-29 — Real local worker transition (AN-011)

- Served immutable v85 (66eb29bf) and v86 (0c32d5a) Git trees on the same local
  origin in sequence, with real Chromium Service Workers enabled.
- PASS: banner, APP_VER 86, v86 cache creation/v85 cache removal, exact retention
  of three fictional sessions, offline reload into v86 with sessions unchanged.
- Evidence: docs/codex/release-v86.md and artifacts/release-v86/real-transition.txt,
  verify-transition.cjs, real-update-banner.png. No app source changes.
- Updated progress/tasks. Publication approval remains pending; no push performed.
  Deployed-site and physical iPhone verification remain outstanding.

## 2026-09-29 — Cold history profile (AN-012, in progress)

- Fresh Chromium contexts, 375px, 4x CPU throttling, synthetic records only.
  Uninstrumented 1000-session first history: 743.6ms / 1000 robustStats calls.
  Instrumented: 801.8ms total, 549ms inside robustStats, 1000 calls.
- Stack: renderHistory -> buildAnalysisRows -> sessionMetrics -> robustStats.
  History list only displays 50 records, but summary preparation computes all
  session spatial statistics. Warm cache optimization cannot eliminate this cost.
- Evidence: artifacts/release-v86/views-current.json and profile-cold.json;
  instrumented harness profile-cold.cjs. Profiling overhead affects timings.
- Next: inspect every history summary consumer before separating score-only
  aggregation from spatial metrics; preserve displayed trends and all records.
- No app changes in this checkpoint, no new release validation claim. Updated
  progress/tasks. Publication remains pending approval; no push or personal data.

## 2026-09-29 — Reuse unchanged medians (AN-012 completed)

- History conclusion requires all-session grouping; preserved this meaning.
  Changed scripts/20-scoring.js to reuse identical median inputs when no points
  are excluded. Added median-count regression in tools/check-analysis-core.js.
- Regression failed before / passes after. 2,000 deterministic datasets match old
  outputs exactly. Independent review: no actionable issues.
- check:all and lint passed; E2E 91 passed (1.0m). Details and timing limitations:
  docs/codex/cold-history-performance.md. No storage, score assignment or UI change.
- Updated progress/tasks. v86 remains unpublished; release bundle predates this
  final optimization and must be rebuilt before publication. Approval still pending.

## 2026-09-29 — Final candidate alignment

- Repeated actual v85-to-v86 local worker transition against 4d53abd8, including
  median reuse. PASS: cache turnover, fictional session retention, offline reload.
- Verified all 21 bundled assets byte-for-byte against source. format:check passed.
- Updated release-v86.md, progress.md and AN-010 evidence in tasks.json.
- Candidate is ready for publication approval. No push/deployment performed.
  Next requires that approval; deployed-site and real iPhone acceptance are not
  implied by local Chromium success. No further feature expansion in this candidate.

## 2026-09-29 — Publication approval blocker

- Reconfirmed clean candidate at 7f316081 and explicit AGENTS.md push/deploy
  approval rule. No user approval has arrived across repeated continuations.
- Local release work and verification are complete; publication and deployed
  validation cannot proceed without approval. Added AN-013 as needs-user.
- Goal is not achieved: adoption, real practice and physical iPhone evidence are
  still absent. No further speculative features added to this release candidate.

## 2026-09-29 — Approved v86 publication (AN-013)

- User explicitly approved. Remote main unchanged at 66eb29bf; fast-forwarded to
  15aa7fb5. Pages build/deployment run 36524673727 succeeded.
- Live version 86, six changed runtime assets match source. Fresh deployed-site
  Chromium demo test passed history/start/offline reload/data retention; no page errors.
- Updated progress/tasks/release notes. Physical iPhone and real practice remain.
- GitHub push reported existing dependency alerts (10 high, 2 moderate); no
  dependency changes or paid services introduced by this release.

## 2026-09-29 — Dependency alert intake (AN-014)

- Retrieved 14 open Dependabot alerts read-only; preserved one normalized item per
  alert in artifacts/dependency-triage/intake.json, without deduplication/verdicts.
- Lockfile routes: xmldom via Capacitor CLI/plist; extract-zip and ip-address via
  Lighthouse browser tooling. All source items mark development scope.
- docs/codex/dependency-alert-intake.md records evidence and proof gaps. No claim
  of confirmed exploitability or absence of risk. No dependency changes or tests.
- Updated progress/tasks. Next: policy resolution and static caller/input tracing.

## 2026-09-29 — Dependency static first pass (AN-014)

- Completed one initial static result per imported alert, all needs_review with
  explicit input-boundary/reachability gaps; no claim of confirmed exploitability.
- Individual results retained via Codex Security artifact tool at
  artifacts/triage/dependabot-v86.json in the target-bound managed collection.
  Digest: ec7ec016a041c3c4bf74b1fbcde1e4e00e5028a02f50c0adde95f9911d528cd6.
- Recorded callers, counterevidence and unique review queue ranks. No tests,
  dependency modifications, alert dismissal, publication or external reporting.
- Updated progress/tasks. Next maintenance should assess compatible dependency
  updates separately; real-world safety remains unproven by this first pass.

## 2026-09-30 — Mobile secondary touch controls (AN-015)

- User prioritized UX. Expanded settings, equipment, record/live disclosures and
  advanced summary targets; preserved existing hint-close pseudo-element hit area.
- Changed style.css and generated style.min.css; added touch-controls.spec.js.
- check:ui and lint passed; focused E2E 10 passed (4.1s), 360/375px light/dark
  edge clicks and no horizontal overflow. Inspected 375px screenshots.
- Evidence: docs/codex/mobile-touch-controls.md, docs/screenshots/touch-quality/.
- No data/scoring changes. Local only; v86 remains the published version.
  Updated progress/tasks. Next: active practice information density and flow.

## 2026-09-30 — Active HUD mobile layout (AN-016)

- Generic responsive grid rules overrode the explicit three-value HUD layout.
  Increased selector specificity only; all three metrics stay in one row.
- Updated style.css/min.css and touch-controls.spec.js; new assertion failed in
  four theme/width cases before fix. Focused E2E 12 passed (13.1s), UI/lint passed.
- Inspected 375px before/after light/dark images; target moves upward about 71px.
  Evidence: docs/codex/live-hud-layout.md and screenshots/live-hud-quality/.
- No storage/scoring changes, no publication. Updated progress/tasks. Next:
  consolidate the two UX fixes into a tested release candidate.

## 2026-09-30 — v87 candidate (AN-017)

- Bumped markers using version:bump and rebuilt assets. Candidate ca09791.
- check:all/lint/format passed, full E2E 95 passed (1.0m). Actual local v86→87
  worker transition retains all demo sessions and supports offline v87 reload.
- Independent review: no actionable regressions; physical iPhone still untested.
- Evidence: docs/codex/release-v87.md, artifacts/release-v87/. Updated progress/tasks.
- Current published version remains v86. Next: v87 publication approval and live
  verification. No money/personal data use, no dependency modifications.

## 2026-09-30 — v87 fixed-dock coverage follow-up

- Added actual screen-coordinate target clicks 12px above fixed dock at
  360/375×640, verifies target hit receiver, exactly one stored arrow and undo.
- Touch suite 6 passed (6.7s); lint passed. No runtime code changes needed.
- Updated release notes, progress and AN-017 evidence. This closes the specific
  review coverage note; physical iPhone remains unverified. v87 approval pending.

## 2026-09-30 — v87 publication approval blocker

- Reconfirmed clean candidate 6ba0bff5, remote main still 1fe998b6 (v86).
- Same publication approval blocker remains across three consecutive goal turns.
  Local implementation and targeted follow-up verification are complete.
- Added AN-018 needs-user and updated progress. No push/deployment performed.
  Goal remains unachieved: publication and real-user/physical-device evidence remain.

## 2026-09-30 — Approved v87 publication (AN-018)

- User approved. Rechecked remote main 1fe998b6 and fast-forwarded to 40524d63.
- Public version 87 and six runtime files match source. Fresh Chromium validates
  settings 44px, HUD one-row, demo start/history, offline data retention, no page errors.
- Updated progress/tasks/release notes. No personal data or additional paid service.
- Physical iPhone and actual practice acceptance remain outstanding.

## 2026-09-30 — v88 corrective publication verified

- v87 CI exposed platform-font-dependent shortcut width (40px). Added explicit
  min-width, rebuilt and version-bumped to v88 for already-updated clients.
- b7783989 published. Pages 36674413781 and Linux CI 36674414490 succeeded;
  E2E 97 passed (1.1m). Local all/lint/format and v87→88 worker transition passed.
- Public dimensions, same-row HUD, asset equality, demo start/history/offline data
  retention verified. Live probe now waits for finite entrance animations.
- Updated progress and AN-018 evidence. Physical iPhone acceptance remains open.

## 2026-09-30 — User-requested swipe dismissal (AN-019)

- Added sticky 44px handle to ordinary sheets, preserving formCapture. Pointer
  capture/downward threshold, cancel/reset, topmost guard and drag-click suppression.
  Calls existing Escape target for save/cancel semantics; no data migration.
- Source: scripts/10-storage-native.js, style.css/min.css. Tests and screenshots:
  tests/e2e/modal-swipe.spec.js and docs/screenshots/modal-swipe/.
- New tests failed before. Final Chromium 100 passed (1.0m); check:all/lint/format
  passed. WebKit swipe 2 passed/1 CDP-only skip. Chromium actual touch/cancel passed.
- Earlier WebKit baseline: 18 passed, 2 pre-existing mouse-open focus restoration
  failures; kept evidence. Does not establish physical iPhone acceptance.
- Candidate v89 cb7e091. Local real v88→89 worker transition/data/offline passed.
  Independent review found no actionable issues. User data/money not used.
- Updated progress/tasks. Next: v89 publication approval and deployed checks.

## 2026-09-30 — v89 approved publication

- User explicitly approved; pushed ca31b8e3 to main.
- Pages36707080253 and CI36707081098 succeeded; `100 passed (55.6s)`.
- Public v89 / seven asset matches / native CDP touch dismissal / synthetic sessions and active-practice retention / offline reload / zero page errors passed. Evidence: artifacts/release-v89/deployed-check.txt.
- Updated progress.md, tasks.json AN-019 and docs/codex/modal-swipe.md. No app changes in this record update.
- Risk/next: physical iPhone gesture feel and actual-practice acceptance remain unverified; no money or personal data used.

## 2026-09-30 — WebKit keyboard focus verification (AN-020)

- Observed click-time focus: Chromium BUTTON#btnSettings, WebKit BODY; keyboard activation focuses and restores the opener in both. Existing failures came from a pointer-focus assumption.
- Changed only tests/e2e/app-smoke.spec.js to focus and press Enter before keyboard restoration checks. Pointer cancel/confirm checks remain.
- WebKit UX: `22 passed (16.7s)`, one CDP-only skip. Chromium smoke: `8 passed (11.9s)`. Lint passed. Initial Prettier check failed on line endings, then formatting and recheck passed.
- Updated progress.md and tasks.json. No runtime, storage or deployed version changes; local commit only.
- Next: inspect 375px record/history/analysis navigation and scroll restoration. Physical iPhone validation still outstanding.

## 2026-09-30 — Tab scroll investigation (AN-021)

- Both engines reproduce history1400 → first analysis1400 → history0 at 375px with synthetic records.
- Immediate restore, delayed restore, and temporary direct-card visibility experiments all failed. Runtime changes reverted; no claimed fix or release.
- Recorded exact scope and failures in docs/codex/tab-scroll-investigation.md; progress/tasks updated. Evidence and failing regression retained in artifacts/tab-scroll/.
- Next: isolate document height clamp before choosing another implementation. No storage or personal-data changes.

## 2026-09-30 — Tab scroll restoration fixed locally (AN-021)

- Isolated content-visibility placeholders (272px vs actual3678px). Keep restored view direct cards laid out until rerender; per-view offsets in ui memory and synchronous restoration.
- Changed scripts/50-record-view.js; tests/e2e/tab-scroll.spec.js covers normal/reduced motion and unchanged sessions.
- Chromium2 passed (3.3s), WebKit2 passed (3.9s). UI/app/lint/format passed; initial test readiness and lint failures corrected and documented.
- Before/after screenshots and synthetic 1000-session measurement retained; warm return adds roughly 2ms locally. No mobile performance claim.
- Updated progress/tasks and investigation. No storage/scoring/dependency changes. Next: release-wide checks, bump and update transition before publication approval.

## 2026-09-30 — v90 release candidate (AN-022)

- Bumped markers/lock to90, built native bundle, committed21a8d73.
- check:all/lint/format passed; Chromium102 passed (1.0m).
- Real v89→90 update/offline/history retention passed after correcting a harness source-hash substitution error.
- Independent review found no actionable issues; isolated-port targeted test2 passed (3.5s).
- Updated release-v90.md, progress/tasks. No new app behavior beyond AN-021.
- Next: publication approval then main push, Pages/CI/live checks. Physical iPhone remains unverified.

## 2026-09-30 — v90 release notes prepared

- Added user-facing Unreleased notes to CHANGELOG.md: per-tab position, memory-only lifetime, validation and physical-device limitation.
- Updated progress/tasks; runtime candidate unchanged and publication approval still pending.
- Validation: targeted Prettier check passed after formatting. Next: approved publication and live checks.

## 2026-09-30 — Diagnostic fixture version decision (AN-004)

- Confirmed84 is internally consistent synthetic current version and83 tests stale coordinator rejection. E2E reads actual version.json through TASK9_APP_VER.
- Documented fixed-version intent in tools/check-form-diagnostics.js; no logic changes. Updated tasks/progress.
- node tools/check-form-diagnostics.js and targeted eslint passed.
- v90 runtime remains unchanged and publication awaits approval.

## 2026-10-01 — Roadmap reconciliation (AN-002)

- Classified existing backlog in docs/roadmap.md with source evidence; kept July decisions as historical context.
- Distinguished implemented CSV round column from unimplemented grouped-history collapse, current multi-path form detector from outdated D-4, and published v89 from local v90.
- Updated progress/tasks. Docs only, format:check passed. No new feature decision, release or real-data use.
- Next: v90 publication approval and physical practice acceptance; deferred items retain their existing prerequisites.

## 2026-10-01 — v90 approved publication

- User approved. Pushed012e6ac1 to main; Pages36790778468 and CI36790779831 succeeded. Linux102 passed (1.0m).
- Live v90 and seven assets match. History1400/analysis600 restored; touch dismiss/start/offline/synthetic data retention passed without page errors.
- Updated release-v90, CHANGELOG, progress and AN-022 evidence. App source unchanged.
- Next: physical iPhone UX and real-practice acceptance remain unverified. No personal data or money used.

## 2026-10-01 — Field acceptance version prerequisite

- Found obsolete v84 requirement in physical checklist; replaced with actual verified served version plus commit/tree identity. Linked v90 publication evidence; no acceptance thresholds weakened.
- Asked user for v90 gesture/navigation feel without personal data. Awaiting response; physical shooting remains unverified.
- Updated field checklist, progress and AN-001 evidence only. Documentation format check passed; runtime unchanged.

## 2026-10-01 — User feedback: end action and zoom (AN-023)

- Reproduced main animation transform trapping fixed dock below viewport; removed main translation. Added root pan-x/pan-y gesture policy.
- Updated CSS/minCSS, focused regression, 375px screenshots and v91 version markers.
- Full104 passed (1.0m); check:all/lint/format, two-engine focused checks, native Chromium pinch and v90→91 update retention passed. Independent review found no actionable issues.
- Candidatef5650aa unpushed. Updated progress/tasks/release-v91. Next publication approval; physical Safari gesture confirmation outstanding.

## 2026-10-01 — v91 approved publication

- User approved; pusheddbcb99f0. Pages36793723110 succeeded. Public v91/seven assets match; live two-engine4 passed (5.7s), pinch scale1, settings swipe/offline retention/pageerror0 passed.
- Initial Linux CI36793723675:103 pass/1 fail due test scrolling before initial lazy layout. Added card-height readiness in test-only9071e564; local Chromium6/WebKit2 passed. Replacement CI36794033791:104 passed (1.1m); Pages36794033346 success.
- Initial live test URL root mistake corrected; no app regression inferred from the harness failure.
- Updated CHANGELOG, release-v91, progress/tasks. Runtime unchanged after initial publish.
- Next: physical iPhone feel and AN-001 real-practice acceptance. No money or personal data used.

## 2026-10-01 — Consecutive ends on short screens (AN-024)

- Discovered open initial guide between target/chips caused reveal helper to scroll the target out after one arrow on Chromium320×568.
- Moved guide below chips/nudge. Changed only markup order; guide default and persisted preference preserved. Added two-size six-arrow/two-end screen-coordinate regression.
- Chromium2 passed (17.2s), WebKit2 passed (16.9s), UI/app/lint passed. 375px before/after screenshots inspected.
- Updated progress/tasks/end-sequence.md. Publicv91 unchanged. Next release checks/update before publication request; user v91 feedback still pending.

## 2026-10-01 — v92 release candidate (AN-025)

- Version bump/native bundle3394f67 prepared. Full106 passed (1.1m), check:all/lint/format success.
- v91→92 real worker/cache transition retained synthetic sessions and offline reload passed.
- Independent review found no actionable issues; isolated4 passed (17.5s).
- Updated release-v92, progress/tasks. Public app stillv91. Next publication approval and deployed checks. User physical-device feedback pending.

## 2026-10-01 — v92 approved publication

- User approved; pushed ae97bf617da289998ab395946476cb5f671cde92 to main. Pages36796667134 and CI36796668313 succeeded. Linux `106 passed (1.1m)`; check:all/lint/format passed.
- Live version92/seven assets match. Settings touch swipe, synthetic history/start/offline retention and zero page errors confirmed.
- Live Chromium/WebKit at320x568 and375x812: `4 passed (20.5s)`, six arrows/two ends with the initial guide open and no scrolling. Evidence in artifacts/release-v92/.
- Updated release-v92, CHANGELOG, progress and AN-025 evidence. App source unchanged after candidate publication. No money or personal data used.
- Next: physical iPhone feel and AN-001 real-practice acceptance remain unverified.

## 2026-10-01 — Finish and history audit (AN-026)

- Previous goal turn made progress by publishing and verifying v92; no running job required waiting.
- Fresh local Chromium/WebKit320x568/375x812, two ends plus a partial end: all four saved [3,3,1], active cleared, result dismissed, history/reload retained seven arrows, prior synthetic sessions unchanged, zero page errors.
- Initial screenshots were mid-animation; corrected harness to wait for completion and repeated the four cases. Inspected settled375px result; no dock overlap. No runtime defect found in this scope.
- Added finish-flow-audit.md, progress/tasks evidence. Documentation only, local commit; no new publication, money or personal-data use.
- Asked user whether v92 resolves the end action. Next concrete improvement depends on remaining real-device friction; AN-001 still requires actual shooting.

## 2026-10-01 — Score distribution aggregation (AN-027)

- Previous goal turn made progress through finish-flow evidence. Safe independent next action: investigate remaining large-history analysis latency while awaiting device feedback.
- Profiled1,000 synthetic sessions. scoreDistCard repeated searches for absent score buckets; new one-pass count/first-face aggregation in585ea8d reduces score reads360002→72000.
- Before regression intentionally failed on the reading budget; after check:all/lint/format passed. Exact HTML/input equality across1,000 seeded datasets, two-engine smoke `16 passed (16.4s)`.
- Alternating20-pair Chromium CPU4x card median25.8→8.0ms; whole-view samples207.7→191.7ms are noisy, not a device speed claim. First server absence and generated harness syntax error corrected before evidence collection.
- Independent review found no actionable issues. Fixed comparison helper's baseline tocd02425 after commit so future reproduction does not silently compare HEAD with itself.
- Updated progress/tasks/score-distribution-performance.md. Publicv92 unchanged; no money, personal data, storage/scoring changes. Next release-wide verification and version/update checks before publication approval.

## 2026-10-01 — v93 release candidate (AN-028)

- Previous goal turn made progress through585ea8d performance implementation and260c2d5 evidence. Prepared version93/native bundle42ff185; no additional application behavior.
- check:all/lint/format passed; full Chromium `106 passed (1.0m)`. All21 copied bundle assets byte-match source.
- Real worker v92→93 update banner/cache switch retained three demo sessions and offline93 reload. Harness pins both old/new revisions.
- Independent candidate review found no actionable issues and independently passed check:version/check:pwa. Initial staging named nonexistentwww and failed; corrected to actual five marker files before commit.
- Updated release-v93, CHANGELOG, progress/tasks. Publicv92 unchanged. No money/personal data used. Next publication approval then remote recheck, main push, CI/Pages/live verification; physical feedback pending.

## 2026-10-01 — v93 publication verifier rehearsal

- Previous goal turn progressed by preparing/verifying candidate42ff185. Publication approval first requested there remains unanswered; remote main1c1c2af0/public92 confirmed unchanged here.
- Prepared live verifier with fixed candidate asset comparison and added score-distribution interaction. Loopback serves immutable candidate under the actual Pages subdirectory/archery-note/.
- `node artifacts/release-v93/rehearse.cjs` exit0: seven candidate assets match, demo history/analysis/start, settings native touch swipe, offline/data retention and zero page errors. Output explicitly says local rehearsal; no live93 claim.
- Updated release-v93, progress/tasks. Added AN-029 needs-user for publication. Runtime unchanged; no money/personal data use. Independent preparation is complete; next action requires publication approval.

## 2026-10-01 — Publication blocker audit

- Previous goal turn progressed through publication-verifier rehearsal. Current worktree clean at7ec294cf; remote main remains1c1c2af0/public version92. Latest three Actions runs are completed/success, so no release process requires a live wait.
- Publication approval is absent in three consecutive goal turns: candidate preparation/request, rehearsal, and this state audit. AN-029 stays needs-user/passesfalse. The only other open task is user-owned actual-shooting acceptanceAN-001; no result has been supplied.
- Candidate verification and independent release preparation are complete. Further live publication requires the AGENTS.md explicit approval gate; field/user-preference evidence cannot be manufactured from synthetic browser tests.
- Recorded the stop condition in progress.md and keep the full aspiration uncompleted. Mark goal blocked pending approval or actionable real-device feedback; resume from the verified candidate when the user replies. No push, runtime change, money or personal-data use.

## 2026-10-01 — v93 approved publication (AN-029)

- User approved and resumed the goal. Worktree clean/runtime identical to42ff185; remote unchanged1c1c2af0. Pushed5c6ecea9; Pages36821315831 and CI36821316579 succeeded, `106 passed (59.0s)`.
- Live93/seven immutable candidate assets match. Chromium analysis/history/start, native touch dismissal, offline retention and zero page errors passed. Live WebKit320/375 score distribution all/filter/reset and session retention passed online.
- Optional WebKit offline reload failed with internal error, exact rerun reproduced. Same error against immutablev92 at both widths with controller/cache present. Root cause unproven; recorded failures and AN-030 for minimal reproduction. No app fix guessed, no WebKit/iPhone offline claim.
- Updated release-v93/performance doc/CHANGELOG/progress/tasks. Publication approval blocker cleared. Runtime unchanged after publish; no money/personal data used.
- Next: AN-030 offline diagnosis and actual-device feedback/AN-001. Goal remains active and broader product aspiration is not claimed complete.

## 2026-10-01 — WebKit offline emulation isolated (AN-030)

- Previous goal turn progressed through approvedv93 publication and identified a repeatable WebKit probe failure. Read current worker and release evidence before diagnosing.
- Minimal12-case matrix on installed Playwright1.61.1: Chromium worker positives pass in both modes; WebKit literal/network-fallback workers fail only setOffline emulation and pass after real server stop. All four no-worker controls fail as expected. Diagnostic exits0 with raw failures preserved.
- Immutable actualv93 server stopped, API ECONNREFUSED confirmed: Chromium/WebKit320/375px all four reloads from SW retain three demo sessions and active arrow, target visible, pageerror0.
- Local result matches Playwright official repository issue42775; no dependency update or application/SW rewrite needed. Exact internal implementation cause and physical iPhone behavior are not claimed verified.
- Updated diagnosis/release93/CHANGELOG/progress/tasks. Documentation format passed; runtime/publication unchanged and no personal data/money used. Next actual-device UX/AN-001 acceptance; use stopped-origin checks for future WebKit offline coverage.

## 2026-10-01 — History round collapse (AN-031)

- Previous turn resolved WebKit emulation diagnosis. Audited remaining roadmap and selected IMP-09 history collapse as one safe UX improvement under the broad user delegation, while physical-device feedback remains pending.
- Added display-only grouping by existing gid before pagination, native details with total/arrows/stage count/distances, stage-order detail rows and memory-only expansion retention. Filtered totals explicitly say visible subtotal. No storage/scoring/SW/dependency changes.
- Changed scripts/60-history-sight-view.js, CSS/minCSS, new history-round-collapse E2E and existing multi-stage smoke's expansion step. Saved and inspected375px before/after/dark and expanded images.
- Initial two tests failed as intended before implementation. First broader test run28 pass/4 fail: old test clicked collapsed rows and new fixture replacement was not reflected. Corrected fixture initialization and user expansion step, then32 passed (31.5s). Final focused8 passed (11.2s) also verifies desktop width; UI/app/globals/lint/format success. Initial document lint error corrected, raw failure logs retained.
- Independent static review found no actionable issues. Updated progress/tasks/roadmap and history-round-collapse.md. Local only; public93 unchanged, no personal data/money use.
- Next: version/update/full-release validation for this change before requesting publication approval. Physical iPhone feedback/AN-001 remain open; goal aspiration is not claimed complete.

## 2026-10-01 — v94 release candidate (AN-032)

- Previous turn made progress through1e95918 history-collapse implementation and related tests. Confirmed clean worktree and remote main8d4bafb/public93 before preparing one release task.
- Bumped five markers with version:bump, built local bundle, committed candidate5abc0ba. check:all/lint/format success; full Chromium110 passed (1.3m),21 copied assets byte-identical.
- Immutable93→94 real-worker update under/archery-note/ passes Chromium/WebKit320/375px: banner/cache switch/old cache cleanup,5 synthetic records and setup/sight/custom-round data unchanged, new round subtotal19. Origin shutdown proves offline reload preserves records and an active arrow, target/history visible, zero page errors.
- Independent review found no actionable issues and independently passed version/PWA checks. Prepared and rehearsed the live verifier against fixedcandidate: seven assets match, round disclosure/analysis/start,44px controls/HUD, real touch sheet dismissal and offline data retention pass.
- Updated release-v94, history evidence, CHANGELOG, roadmap, progress/tasks. No validation failures in this preparation; implementation's earlier test failures remain recorded. No push, new dependencies, money or personal-data use.
- Next: request explicit approval forv94 publication, then recheck remote and push, wait CI/Pages and live-verify. Public93 unchanged. Physical iPhone feel/AN-001 remain unverified; goal remains active.

## 2026-10-01 — v94 approved publication (AN-033)

- Previous turn progressed through verifiedcandidate5abc0ba and c2df3c0 evidence. Started a fresh approval-state audit, confirmed remote8d4bafb/public93 and completed previous jobs. User then explicitly approvedv94 during the turn, resolving the publication gate; no blocked status was set.
- Confirmed clean runtime identical to candidate; recorded approval in e4ec1abe and pushed to main. Pages36825162385 and CI36825163421 succeeded; Linux110 passed (1.2m), check:all/lint/format success.
- Live94/seven candidate assets match. Chromium disclosure/analysis/start/HUD/44px, actual touch sheet dismissal, offline retention/pageerror0 succeeded. Public Chromium/WebKit320/375px four cases verify total34, stage order/detail, filter subtotal17, expansion retention/collapse, no overflow and seven synthetic records plus active-arrow reload retention.
- Inspected public screenshot and preserved exact logs. Initial deploy-pages.yml read failed because no such tracked workflow exists; inspected actual ci.yml inventory and source-specific Pages run. Documentation patch whitespace mismatch rejected without writes, inspected and corrected. No application/verification failure or post-candidate runtime change.
- Updated release94/history evidence/CHANGELOG/roadmap/progress/tasks. No personal data, money, new dependency, scoring or storage changes. Original worktree changes preserved.
- Next: actual-device UX feedback and AN-001 real-shooting acceptance remain open. Publication approval blocker is resolved; the goal remains active and the full community aspiration is not claimed complete.

## 2026-10-01 — Dependency alert exposure check (AN-034)

- Previous turn completed approvedv94 publication and its evidence. Selected one safe read-only follow-up to the16 dependency warnings; targetd734ea210acc6f2f30761da6e1a5c36954630e25.
- Current GitHub API returns16 open rows (10 high/6 medium), all transitive development dependencies. Installed/lock versions agree; production-only npm audit returns0. All alerts retained; no dismissal, external report, exploit or native execution.
- Inspected14 owned PWA scripts, worker/assets,21-file native-web copy and JSON backup path. No normal PWA record/import/history execution route to the four packages found; this is a bounded inference, not a full audit or tooling safety proof.
- Traced Capacitor/plist parser, plist's separate xmlbuilder serializer, SOCKS address conversion, Puppeteer ZIP installer and ESLint glob inputs. One scoped disposition per alert; compatible xmldom0.9.12/ip-address10.7.1/brace-expansion5.0.12 candidates cover14 listed advisories. Serializer opt-in caveat retained; extract-zip2.0.1's two alerts have no reported patch.
- Verification: exposure helper PASS, npm audit --omit=dev exit0, Security regression: all38 checks passed. Independent evidence/caller review found no actionable issue. Existing security check does not test these upstream tool bugs. Final documentation format result is recorded in dependency-alert-exposure.md.
- Changed dependency-alert-exposure.md, intake follow-up, progress/tasks and this ledger. Runtime/publicv94 unchanged; no dependency update, money or personal-data use. Local documentation commit only, no new publication.
- Next: prepare only compatible existing lockfile updates and verify isolated installation. This worktree's node_modules is a junction to the original checkout; never mutate that shared directory with install/update/ci. Check no new package names/unrelated updates first; additions/publication retain approval gates. Physical-device feedback/AN-001 remain open and goal remains active.

## 2026-10-01 — Compatible dependency update prepared (AN-035)

- Previous turn made progress through exposure review/41155afe. Executed one scoped update in an isolated sandbox: npm update --package-lock-only/--ignore-scripts, then npm ci --ignore-scripts. Original shared node_modules versions and hidden-lock hash unchanged.
- Exactly3 lock entries' version/resolved/integrity change: xmldom0.9.10→0.9.12, brace-expansion5.0.9→5.0.12, ip-address10.4.0→10.7.2. No added/removed279 entries or direct/parent/override changes. Resolver-selected10.7.2's upstream note inspected; registry metadata/installed parity and consumer ranges verified.
- Ordinary actual-consumer comparison passes2 plist datasets,6 SOCKS address conversions,3850 fixed-glob/file comparisons and6 brace cases. Saved16 advisory ranges:14 no longer match, ZIP alerts13/27 still match. No exploit/native execution or universal sanitizer claim.
- Isolated check:all/lint passed, full Chromium110 passed (1.1m), native-web21 assets byte-identical. Independent review found no actionable issue, including lifecycle/isolation scope. Final format evidence is recorded in dependency-update.md.
- Full npm audit remains exit1/high4 affected packages: two extract-zip advisories plus parent chain. It proposes a major Lighthouse13.5.0 parent upgrade; that separate change is unverified/not applied, and no forced fix or dismissal was performed. Existing app security regression38 checks does not test upstream defects.
- Changed package-lock.json, dependency-update.md/exposure follow-up, CHANGELOG, progress/tasks and this ledger. Local only, application/runtime/publicv94 unchanged. No new dependency, fee or personal-data use; original checkout preserved.
- Next: AN-036 needs-user for a new main push under AGENTS.md approval rule; after approval recheck remote, CI/Pages, unchanged public assets and fresh alert state. Remaining ZIP/tool-parent review and physical iPhone/AN-001 evidence remain open; goal remains active.

## 2026-10-01 — Lighthouse parent upgrade feasibility (AN-037)

- Previous goal turn made progress through verified3-package candidate4f81bb0c. AN-036 main-push approval remains unanswered, but a separate safe action exists: inspect npm's proposed major parent remedy for the remaining ZIP alerts. This is progress, not a blocker-only turn.
- Read npm registry manifests/official13.5.0 tagged CLI and reporting source. Resolved only a temporary manifest/lock with --package-lock-only/--ignore-scripts: graph279→261,43 added paths/61 removed/21 changed(root+20 package entries),28 new package names. Puppeteer25.12.0/browser3.2.3 graph has no extract-zip; hypothetical fullaudit0/exit0.
- No packages installed or executed in that resolution directory. Root package*.json match actualcandidate4f81bb0c; original shared hidden lock hash unchanged. ZIP itself still has no reported patched release; graph removal is a separate strategy, not upstream archive-safety proof or remote alert closure.
- Recorded Node>=22.19 requirement and source-level CLI/report compatibility. Future actual helper validation must explicitly disable error reporting, use synthetic local data and check minimum Node/Chrome/cleanup/output/app checks. No saved user preference or practice record read.
- Added lighthouse-upgrade-review.md, candidate-doc follow-up, progress/tasks and this ledger. Documentation-only local work, publicv94/runtime unchanged, no telemetry/fee/personal-information use. Final format/diff/review evidence is recorded in the review document.
- Next: existing3-package main push still requires AN-036 approval. Major upgrade/new28 names is separately AN-038 needs-user under the dependency-addition rule; no install/application without that specific approval. Physical iPhone/AN-001 evidence remains open and goal remains active.

## 2026-10-01 — Analysis filter interaction audit (AN-039)

- Previous turn progressed through major-parent feasibility evidence0e3ea942. Approval for AN-036/038 is still absent, but independent authorized UX work remains. Rechecked roadmap/design language/current code and audited existing daily comparison controls rather than treating publication approval as a whole-goal impasse.
- Four fresh Chromium/WebKit320×568light/375×812dark contexts with synthetic demo data: analysis setup/distance labels have no association, named combobox counts0, and focused selection re-render moves focus to BODY. History labels/distance focus and analysis period focus provide positive controls.
- Selected distance70 and period7d apply; session/setup/sight/active data identical, pageoverflow/pageerrors0. Inspected375px overview and320px filters; screenshots document layout, role/DOM/JSON evidence proves the issue. No physical iPhone/VoiceOver claim.
- Initial rg wildcard paths failed on Windows; corrected to directory/-g queries. Browser probe completed and specifically confirms defective behavior; it is not a regression pass accepting it. Runtime unchanged.
- Added analysis-filter-audit.md, two screenshots, progress/tasks and ledger. Final format/diff/review evidence recorded in the audit document. Local only, no dependencies/publication/fee/personal records used.
- Requested independent review ended with an account usage-limit error and no review result. No purchase or independent-pass claim; primary self-checked saved results against current source. Format check passed, preview stopped. Subsequent correction still needs patch review before merge when available.
- Next: AN-040 focused labels and conditional focus restoration using existing history pattern, with meaningful regression/data invariance/UI/lint verification in a separate suitable worktree. Keep pending AN-036 dependency publication independently reviewable; AN-038 additions need separate approval. Goal remains active; actual-device/AN-001 evidence still open.

## 2026-10-01 — Analysis filter correction (AN-040)

- Implemented268b7967 on codex/analysis-filter-focus, reusing existing isolated checkout. Protected codex/app-quality remains1d9c9ad1 for dependency-only publication. No new worktree; narrowed isolation choice preserves both candidates.
- Existing labels now associate with selectors; synchronous render restores focus only if the changed selector previously held it. No layout, calculation, storage, scoring, dependency or worker changes.
- Regression red4failed; Chromium/WebKit related20 passed (15.0s), record/end/settings/touch32 passed (42.9s). App/UI/lint/storage passed in owned dependency sandbox; source/test bytes agree. Initial runner/cwd/lint setup failures are retained and explained in analysis-filter-focus.md.
- Independent static review found no actionable issue. Saved/inspected375px before/after synthetic screenshots; original shared installed/hidden lock unchanged. Actual iPhone remains unverified.
- Changed scripts/50-record-view.js, focused regression, analysis-filter-focus.md, screenshot, CHANGELOG/progress/tasks/ledger. Local fix only, publicv94 unchanged, no money or private records.
- Next: AN-041 version/full release verification before asking to publish the UI fix. A new human approval arrived for AN-036 existing three dependencies; complete that separate publication without including this UI fix or AN-038 additions. Goal remains active.

## 2026-10-01 — Approved dependency publication started (AN-036)

- New human approval authorizes the previously asked existing-three-package main push. Rechecked remote d734ea210acc6f2f30761da6e1a5c36954630e25, which is an ancestor of protected codex/app-quality1d9c9ad1. Runtime diff is empty; no version bump for a development-only change.
- Analysis fix268b7967 and evidence15e2292 are preserved on codex/analysis-filter-focus and excluded from publication. AN-040 completion is recorded there; this branch still carries its older open task. No Lighthouse major/new28 packages approved or installed.
- Resynchronized tracked sandbox source to dependency-only branch and removed only the known extra fix test. No root install. Consumer recheck passes3 compatible entries,14 nonmatching saved advisories,2 plist/6 SOCKS/3920 glob/6 brace cases; changed glob count reflects additional tracked docs.
- Next within this publication: required checks, immutable candidate commit/push, source-specific CI/Pages, unchanged public assets and fresh alert state. No fees or personal data used.

## 2026-10-01 — Dependency publication verified (AN-036)

- Approved candidate de1e3a95 pushed to main. Pages36856785707 and CI36856786262 both succeeded for that source: Linux clean npm ci/check:all/lint/format and110 passed (1.2m). Local110 passed (1.3m) recorded separately.
- All21 livev94 assets byte-identical; browser history round/distribution/start/44px/settings touch swipe/offline synthetic history retention/pageerror0 passed. Live history screenshot inspected. Shared hidden lock hash unchanged. No new application version or UI behavior deployed.
- Fresh open/fixed GitHub API confirms14 former open IDs fixed, only development extract-zip high13/27 remain open. No dismissal, forced fix, new dependency, telemetry, payment or private records. Existing high4-package npm audit is not misreported as zero.
- Publication doc/progress/tasks/CHANGELOG updated. Initial asset helper read a nonexistent manifest; corrected to actual21-file native inventory, setup error retained separately. Workflow inventory read error also documented; no application failure inferred.
- Next: reconcile publication records onto preserved codex/analysis-filter-focus (268b7967 implementation,15e2292 evidence), then AN-041 full/version/update verification before requesting UI publication. Major28-package approval remains separate. Actual-device/AN-001 open; goal active.

## 2026-10-01 — Analysis filter v95 candidate validated (AN-041)

- Previous turn completed approved dependency publication (progress). Record-only e1ec1fe6 CI36857259186/Pages36857258334 also succeeded. Merged published records into analysis-filter-focus; resolved only CHANGELOG/progress/ledger conflicts preserving both tails, AN-036/040 evidence and existing task acceptance.
- Version bump d4c3cec4 aligns APP_VER/json/cache/package/lock95, dependency tree unchanged and worker activation untouched. Initial114 tests/transition green were insufficient for control visibility: screenshot prompted old/new bounds probe. Added meaningful regression,3failed/1passed; measurements varied with content-visibility replacement and fixed-nav overlap.
- Final7039fcea stabilizes only cards through the analysis filters and reveals a previously focused selector/period chip above navigation/below visible header synchronously. No delayed callback or outside-focus stealing. Focused16 passed (10.6s), strengthened two-frame final16 passed (15.9s).
- Final owned-sandbox check:all/lint/format success,116 passed (1.4m),21 copied assets byte-identical/readiness95, source/test/version/dependency bytes agree and original shared hidden lock unchanged. Initiald4c3 evidence retained separately, not reused for final success claims.
- Four immutable Chromium/WebKit320light/375dark actual-worker94→95 transitions verify banner/cache switch/history5 unchanged/named focused controls visible, then stop server and confirm connection refusal/SW reload/active1 and history retention. Active1 evidence is after-update offline, not before-update active preservation.
- Local publication-verifier rehearsal also passes7assets/labels/visible focus/history/distribution/start/44px/settings touch/offline data/pageerror0. Normal-motion4cases pass setup/distance/period bounds after their own animations finish. First normal probe waited on offscreen animations; live PID identified, stopped, helper narrowed, no app change.
- Static review7039fcea found no actionable issue; no rerun/physical-device guarantee. Added release-v95.md, final375control image, focus-doc follow-up, CHANGELOG/progress/tasks/ledger. Actual iPhone/VoiceOver/AN-001 remain open, no fee/private records/new packages.
- Next AN-042 needs-user for newv95 main push under AGENTS.md. AN-043 read-only synthetic large-history response measurement can progress while approval is absent. AN-038 major/new28-package approval remains separate; goal stays active.

## 2026-10-01 — Analysis performance audit recorded (AN-043)

- Completed read-only immutablev94/e1ec1fe6 versusv95/7039fcea measurement:14 contexts,420 samples, identical input hashes, expected filtered counts, candidate focused controls within visible bounds, unchanged memory/persisted demo and overflow/pageerrors0.
- Candidate all-distance median at5000 sessions: Chromium172.8ms/WebKit295ms; Chromium1000 CPU4×204.7ms. No claim of speedup, real iPhone/INP or5000-session storage round trip. Synthetic data is in-memory, reduced-motion, near-centre single-face geometry.
- Corrected initial seed shortcut (analysis view already selected) and reran entire matrix. Console caption ordering error corrected only in reproduction helper; named JSON fields are authoritative. Initial artifacts preserved. Independent read-only review recomputed all medians and found no actionable issue.
- Added analysis-filter-performance.md and AN-044: restrict scoreTrendCard aggregation to the first eight nonempty records, preserving HTML/coercion/immutability. Effect and largest bottleneck remain unproven; implementation is a separate task.
- New human approval now authorizes AN-042/v95 publication previously requested. Remote main remains e1ec1fe6, candidate runtime unchanged. AN-038 additions remain unapproved. No installs, private records or costs.

## 2026-10-01 — Approved v95 publication started (AN-042)

- Human approval received for the specifically requestedv95 release. Remote main=e1ec1fe6747e03bac11b41baeba55c1668ad51d5 is an ancestor of the candidate; tested runtime7039fcea is unchanged. Existing dependency tree only; no AN-038 additions.
- Before push, owned-sandbox check:all/lint exit0; root documentation format:check reports All matched files use Prettier code style! Source/test/dependency99 files match owned sandbox, shared hidden lock hash unchanged, original task acceptance retained and completed rows have evidence.
- Full116-test release acceptance and actual-worker94→95 update evidence remain the same immutable runtime recorded in release-v95.md. No redundant full rerun after documentation-only audit records. Next: push reviewed candidate, source-specific CI/Pages, all21 public assets and live synthetic interaction/offline checks.

## 2026-10-01 — Approved v95 publication verified (AN-042)

- New human approval authorizes the specifically requestedv95 release. Pushed0618b37b, runtime unchanged7039fcea. Source-specific CI36863682859 and Pages36863680921 succeeded; Linux/Node22 clean npm ci/check:all/lint/format,116 passed (1.1m).
- All21 live95 assets match approved source bytes. Fresh375px Chromium verifies named focused equipment/distance and7d period within visible bounds, history round19/distribution/start44px/settings actual touch swipe, actual-worker offline reload with five synthetic histories and active retained, pageerror0. Live analysis screenshot inspected.
- Existing two development ZIP warnings reported by GitHub on push, not treated as fixed. No new package, fee, telemetry or personal record. Original shared hidden lock unchanged;99 source/test/dependency files match owned sandbox and task acceptance retained.
- Updated release-v95/progress/tasks/CHANGELOG/ledger; AN-042done with evidence. Performance audit completed earlier and recorded alongside publication without runtime changes. Initial nonexistent pages.yml/verify-assets.cjs read paths were corrected to actual inventory; no app/test failure.
- Next AN-044 on a separate branch: first eight nonempty score-trend records, exact HTML/coercion/nonmutation and bounded arrow reads before representative measurement. Actual iPhone/VoiceOver/AN-001 and AN-038 additions remain open, goal active.

## 2026-10-01 — Bounded score trend aggregation (AN-044)

- Previous goal turn completed approvedv95 publication (progress); final record-only CI36864216210/Pages36864214685 also succeeded. Clean checkout inspected, created codex/score-trend-performance branch in existing isolated worktree, preservingv95 candidate branch. User authorized local performance improvements; no new publication/dependency approval inferred.
- Planned bounded scan reusing existing historySessionRows rather than altering shared helper or adding a cache. Runtimebd36e8cb stops after eight nonempty records, formatter/scoring/order/storage unchanged. Meaningful red36000!==288/exit1; green288reads and unreadable tail untouched.1000 seeded and malformed/sparse/coercion/overflow cases preserve exact HTML and frozen inputs.
- Owned-sandbox app/analysis/UI/globals/lint pass; both-engine focus/history-layout/tab20 passed (8.8s). Source/hidden-lock/task-acceptance verification and format results are recorded in the performance document. No root install, private practice or fee.
- Immutable14-context/420-filter-sample comparison plus seven20-call card batches:5000 card median Chromium4.475→0.030ms/WebKit4.350→0.050ms; all-distance whole analysis172.9→168.5ms/291→289ms, with worse1000WebKit and CPU4dist70 cases. No universal whole-app/INP/physical-iPhone claim. Sparse/all-empty timing and real5000-storage behavior unverified.
- Exact paired card HTML/digest/serialized size, independent filtered counts, focused visible controls, unchanged memory/persisted demo, overflow/pageerror0; before/after375 PNG bytes identical and images inspected. Independent code review ran dedicated regression; evidence review independently recalculated JSON/hash/counts and found no issue, no timing rerun.
- Changed one runtime function, focused tool regression/check:app hookup, performance doc/two images/CHANGELOG/progress/tasks/ledger. Initial guessed test file paths were corrected from actual inventory; no test setup failure. Timed work finished before related E2E to avoid competing loads; helper servers/browsers close in finally.
- AN-044done; next AN-045 full release/version/update acceptance before requesting a new main push. Publicv95 remains unchanged, AN-038/actual-device/AN-001 evidence open, broad goal active.

## 2026-10-01 — v96 preparation and additional offline-route investigation (AN-045)

- Previous turn completed local AN-044 optimization and evidence (progress). Checked clean checkout/current markers/source/acceptance, version:bump95→96 in isolated marker commita877c433. No dependency/SW strategy/scoring/storage change, no push/install/fee/private record.
- Owned sandbox synchronized; check:all/lint/format success,116 passed (1.1m),21 nativeasset bytes/readiness96 and dependency/shared hidden lock unchanged. Normal Chromium/WebKit320light/375dark4 actual-worker95→96 clickable-banner updates, saved5/HTML/control focus bounds/round19, then post-update active1+stopped-origin/offline all pass; immutable preview publication-helper rehearsal passes.
- Additional pre-update active scenario initially waited on intentionally hidden banner; independent review identified P2 helper error, confirmed30s timeout. Revised separate scenario proves freshReload guard then explicit registered-worker update/browser reload preserving active1/HTML. Later active2/server-stop/offline root reload times out15s on Chromium320 before remaining cases. Do not claim all paths or release-ready.
- Bounded diagnostics: loaded96/controller-active activated/equal, both95/96 caches/index present, both cached storage scripts96. Provenance server servedSW95then96 and both worker globals observed. Baseline-only95 same-URL/active2/offline control succeeds. Activation wait and separately served baseline fetch-write-disabled experiment do not resolve; app defect/data loss/root cause unproven.
- Corrected inherited baseline labels/count/screenshot path and retained initial invalid metadata; corrected final control is one95→95 case. Initial failed-navigation diagnostic awaited page.evaluate indefinitely; exact live owned PID13968 identified/stopped, no direct child observed. Later bounded diagnostic syntax/Request.url API errors corrected and logs retained; no app code fix inferred. All latest handles completed.
- Added release-v96/progress/tasks/ledger, AN-045 remainsin-progress/passesfalse; AN-046open for minimal reproducer, lifecycle/fetch/cache/engine comparison and evidence-based cause before returning to candidate acceptance. Actual iPhone/AN-001/AN-038 remain open, goalactive. New publication permission is not asked while additional material risk is unresolved.

## AN-046 — Correct asynchronous worker-readiness verification

- Previous goal work made progress: aligned localv96/full acceptance and discovered a failed extra route. Continued the same diagnosis after automatic goal messages; no new publication or dependency approval inferred. Checked current worktree/status, retained all old probes and publicv95.
- Ranked worker-fetch/URL/unload/verifier hypotheses. Tiny-page real-worker six routes completed navigation, but two Chromium updates returned95 and failed version assertions. Reduced real HTML/idle/active runs completed; their old async readiness gate was still invalid, so not acceptance evidence. Traced original navigation fetch pending and controller-generation MessageChannel response95 immediately after the purported wait, then96 later.
- Installed Playwright1.61.1 uses synchronous predicate truthiness; waitForFunction(async predicate) adopts the Promise result, completing withfalse without repoll. Deterministic seam reproduces false1call; expect.poll evaluates the boolean untiltrue across3corrected calls (cumulative4). Old activation-wait conclusion is superseded, not treated as an application defect.
- Corrected original immutable97945→a877 active route passes Chrome/WK320/375 four cases. Added tools/diagnostics/verify-v96-worker-update.cjs, independently completes the same four fresh contexts plus seam: active guard/heldURL/active1/data5/HTML, focus bounds/round19, secondarrow, server-stop/ECONNREFUSED/realSW offline/data/error0. No app/SW/version/dependency install or private records/fee.
- Kept exploratory instrumentation under clearly marked ignored artifacts. First reduced helper CSP inline-registration failure corrected to external script; erroneous full-storage updatedAt/launchCount comparison and single-occurrence replacement corrected to practice data scope/flush. Exact owned unbounded-ready helper PID20572 stopped; subsequent helpers bound readiness and clean finally. Failed helper logs are retained, not app failures.
- Read-only review message verified source/seam/controller and corrected4/regression4, no P1/P2; final agent turn hit usage limit, final document review unfinished. Primary record audit/format/syntax/PWA checks verify final state. No broader full-suite rerun because candidate source remains unchanged.
- Changed diagnostic tool, diagnosis/release docs, progress/tasks/history. AN-046done with evidence; AN-045in-progress until normal clickable-banner cache gate is corrected and four cases rechecked. Real-device/update-timing stress, AN-001/AN-038 remain open, goalactive.

## AN-045 — Complete corrected v96 candidate acceptance

- Previous goal turn made progress with committed AN-046 diagnosis/regressionf8e40d08; current clean checkout and authoritative progress/tasks/acceptance/release recipe/brief/history inspected. Same isolated branch/worktree, original checkout/dependencies preserved. User goal continuation is not new publication approval.
- Copied normal helper to a distinct corrected artifact, replaced async waitForFunction with explicit evaluated-boolean expect.poll and a separate exact cache96-only/active-activated/controller equality assertion. Kept original banner/data/HTML/focus bounds/round19/active1/origin-stop-refusal/fromSW/offline/error assertions and bounded initial readiness. All four Chromium/WebKit320light/375dark cases pass; old logs/images remain, corrected JSON records readiness fields. Current375dark analysis image inspected with visible focused controls.
- Read raw fullcheck/lint/116E2E/rehearsal evidence and verified the same candidate runtime/test/dependency bytes. No source edit, version bump, install or full-suite repetition. Current101source/sandbox and native21/readiness96/tree/shared hidden lock checks pass. Rechecked remote main97945e17 read-only; no push/deploy/private practice/fee.
- Updated release-v96/CHANGELOG/progress/tasks; AN-045done with nonempty evidence, existing acceptance unchanged and AN-047needs-user for v96 publication. Final audit independently checks normal4 readiness, active4 data/offline scopes, evidence presence and immutable source. Final independent read-only review completed, no P1/P2 findings; it distinguishes prior interrupted AN-046 document review from this completed record review.
- Initial guessed Pages/native-helper read paths were missing; corrected from rg inventory to actual ci.yml/verify-native.cjs. No app/test failure inferred. Final formatting/version/PWA and diff checks retained below/at release record; owned normal helper completed and cleaned up.
- Next: request v96 publication approval under AGENTS.md L3, then source-specific CI/Pages/all21 live assets/375px major flows and offline data retention. Actual iPhone/VoiceOver/large persistence/INP and ZIP warnings remain open; no major dependency scope added. Goalactive.

## AN-048 — Six-arrow phone flow survey

- Previous goal turn finalized immutablev96 candidate85a52fc; publication question remained pending during the survey. New human approval, including “すべて承認します”, arrived after survey completion and authorizes AN-047 publication. Release branch remains frozen; audit branch is separate.
- Four immutable candidate Chrome/WK320/375 normal-motion headless touch cases record70m122cm/6 arrows, undo/nudge/two ends/finish/reload. Three original synthetic sessions unchanged; saved ends6,6 and reload retained, errors0. Programmatic manual-scroll recoveries are explicit; not four scroll-free flows or physical iPhone testing.
- All four have unnamed face/count comboboxes and visible toast/end-label overlap with pointer-events:none. WK375 after correction and first-end confirmation has next end0 arrows and target y-309/height292.3125/visible0. Immutablepublic95 WK375 control reproduces exact geometry; no candidate optimization regression inferred. Cause unproven, queued AN-049 ahead of separate AN-050/051.
- Retained offscreen nudge failure, fixed-nav reveal assumption failure and true next-target assertion failure. Final helper records observation then recovery, all contexts/server close in finally. Four current-run images inspected; three published evidence PNGs exact copies. Independent read-only review verified first-end wording, scoped data retention and headless-touch limits.
- Changed audit doc/three PNGs/tasks/progress/ledger only, app/version/dependencies unchanged. Audit verifies prior task rows and acceptance intact, completed evidence nonempty, frozen release85, source unchanged,4+1 scopes and image bytes. No full116 repetition for this read-only task. Initial guessed deploy-pages.yml path absent; actual workflow inventory is ci.yml, Pages is managed workflow.
- Next: finish records, publish already-approved85 with source-specific CI/Pages/assets/live checks. Then AN-049 correction return fix on the separate branch. Broad goal remains active; no private records or fees.

## AN-047 — Approved v96 publication verified

- Human approval including “すべて承認します” authorizes publication; remote main97945 ancestor confirmed. Published only frozen85a52fc, preserving audit branch54dad74. No force, app modification, new package, fee or personal practice.
- Local owned check:all/lint and root documentation format pass; same101 source/sandbox and shared hidden lock. One source helper was called from wrong sandbox cwd and failed MODULE_NOT_FOUND, corrected root invocation passes. Prior116 candidate evidence valid for same bytes.
- Exact-source CI36943369425/Pages36943368347 succeed: Linux/Node22 clean npm ci/check:all/lint/format, 116 passed (1.3m). All21 live96 assets byte-identical. Fresh375 Chromium named analysis controls/period focused and visible, history19/distribution/start44px/settings CDP touch swipe, real-worker offline five synthetic histories+active retained/error0. Current live image inspected.
- Bounded boolean worker-registration poll in publication helper; no unbounded async readiness assumption. Early CI log retrieval was unavailable until completion, final logs retained. Existing two development ZIP alerts remain; broad approval allows AN-038 to proceed later, not falsely marked tested.
- Updated release doc/CHANGELOG/progress/tasks/history. AN-047done with evidence; AN-038open/false (approved, unimplemented). Next AN-049 target-return diagnosis/regression/fix, separate toast/label tasks after. Real iPhone/VoiceOver/INP/large storage/AN-001 still open; goalactive.

## AN-049 — Return to target after correction

- Previous goal turn completedv96 publication/audit records (progress). Clean current worktree inspected, created codex/correction-return from40d435f0; public85 frozen. Broad human approval persists, no repeat permission question. App/UI/debug/TDD/design/plan/review skills used; no fee/private records.
- Trace immutablev96 WK375: manual correction scroll14→422→727, deselect clamps623 with targettop-313, confirm619/-309. No application return scroll; chips helper only solves bottom overlap. Browser internals not asserted. Chosen minimal current-target reveal at correction-close and successful confirm; focus, metadata, ordinary/tab refresh/scoring/storage unaffected.
- Red6failed/2passed (1.2m), initialgreen8passed (1.3m). New helper/scoped triggers, same runtime throughout later expanded tests. First expanded8failed/20relatedpassed: final persisted snapshot raced last placement. Corrected4failed/4passed: second snapshot also raced another new placement. Central recordArrow count polling covers every placement; final 8 passed (1.7m). All old logs retained.
- Final8 Chrome/WK320/375 normal/reduce validates deselect/chip/delete/selected confirm, ongoing nudge/reason immediate position, active-tab120 restoration, corrected arrows/old3sessions/reload/errors0. Related20 remain valid for unchanged runtime. App/UI/globals/lint/format pass, current375 before/after copied/viewed.
- Wrong-cwd sandbox copy failed; live handle13918 interrupted, correct source copied and port absent before actualgreen. Failed Prettier-context patch made no edit. Independent static review no runtime findings; later P2 missing second-placement poll addressed centrally. Final evidence review pending when this draft was written.
- Changed one runtime view, focused regression, improvement doc/two images, CHANGELOG/progress/tasks/history. AN-049done with evidence only after final8, AN-052open approved next release acceptance/publication. No markers/worker/dependency changes or push this task. Real-phone/keyboard/VoiceOver/large storage/INP/AN-001 and separatetoast/label tasks remain open; goalactive.
- Final independent read-only review completed: no additional issue, P2 central gate resolved and all8/related20 scopes confirmed. Record audit/source102/shared hidden lock, task acceptance and unchanged scorer/storage/version/dependencies pass. Final375 output refreshed/copied/viewed, loopback8753 absent and owned handles terminal. Final formatting/staged diff checks pass; local commit follows without publication.

## AN-052 — v97 preflight and bounded animation-wait diagnosis

- Previous goal turn completed AN-049local fix/regression/review (progress). Current clean source/status/acceptance/brief/history/recipes inspected, approved publication scope retained. Version-only58c411e aligns97 all5markers; only cache number changes, no strategy/scoring/storage/dependency installation.
- Owned tracked sandbox sync, fullcheck/lint/format success,120passed(1.2m), native21/readiness97/tree/shared hidden lock/source102 match. Four actual-worker96→97 active routes under reduce motion pass guard/preactive1/history5/trend/cache/offlineactive2/fromSW/focus/errors0. Mobile375 publication helper rehearsal passes actual6-arrow correction/deselect/end1/newarrow full-target bounds plus settings swipe/offline synthetic data. Not live evidence.
- Prior helper “normal” described banner route, source used reduced motion. New4-case banner route explicitly mobile/hasTouch and normal motion, includes correction driver. Unbounded all-document finite-animation gate remained pending. Owned PID11956 confirmed/interrupted via live12543, terminalexit1 and no direct child. Single bounded Chromium320 diagnostic passes, cause not yet proven; fullmatrix bounded trace handle72597 live. No app fix inferred or candidate change.
- Missing guessed rehearsal path corrected from rg; native assertion97 had inherited caption96, corrected/rerun. Old interrupted output preserved, helpers bound/clean finally. release-v97/progress/tasks recorded; AN-052in-progress/false, public96 unchanged and normal route unresolved. Goalactive, no repeat permission/fee/private data.

- Wait diagnosis completed: bounded global waits failedWK320, visible-only wait failedWK375; all logs retained. Concurrent pending probe failed strict cache15s with no state capture, serial probe passed cache then captured Promise-pending/current-finished mismatch. No browser-internal cause asserted. New verifier polls all current finite states after layout reads with2s failure/twoframes; all4 normal-motion/mobile/banner/correction/cache/offline cases pass (transition-observed.json). Independent review noP1/P2, geometry-promoted layout/performance limits recorded. Runtime58 unchanged, remote85 rechecked. Publication helper uses same bounded observed wait, rehearsal to rerun; AN-052false until live acceptance.

- AN-052 publication completed: approved ordinary push85→dd3cda12; runtime58 unchanged. Exact-sourceCI36947646285/Pages36947645601 success, 120 passed (1.5m), allchecks/lint/format. All21 live97bytes identical; fresh375 six-arrow correction/deselect/end1/nextarrow/fullbounds, named analysis/history19/settingsCDPswipe/offline5+active/error0 pass. Live image inspected, toast overlap remainsAN-050. Shared source102/lock preserved. Formatting-only ledger warning retained/corrected, finalformat green. No new dependency/fee/private data. AN-052done/evidence, records localcommit next, nextAN-050/051; physical-phone/performance/ZIP/AN-038 limits remain, goalactive.

## AN-050 — Readable recording feedback without action overlap

- Previous goal turn publishedv97/AN-052 (progress). Current clean56ad7d1/source/status/acceptance/brief/ledger/recipes inspected; codex/record-toast branch. Existing all-approval covers scoped UX, no repeat gate/fee/private records.
- Red12 dock overlap. Actual measured dock-top+16px toast variable, CSS active/nonmodal scope; visibility-gated resize and dock recreation remeasurement. Existing lifetime/role/content/layout preserved. Generatedmin updated. Screenshot uncovered obsolete dark background override with inverse ink text, contrastred2 at1.107:1; paired theme tokens restored.
- Initialplacement12(2.2m), intermediatecolor12(2.6m)/related24(2.2m) pass but final review P2 exposed notification without re-emission on history→record. New regression red2, shown-toast active DOM recalculation fixes it. Final12 passed (2.5m) and 10 passed (1.9m), all UI/app/globals/lint/format/storage success. Final375before/after and320capacity image viewed; no scoring/storage/version/worker/dependency change.
- App validation initially evaluated resize registration in utility slice withoutwindow; startup handler moved90init. Test lint browser globals qualifiedglobalThis. Errors retained and corrected, no acceptance hidden. Independent static review P2 resolved/noadditionalP1/P2, final actual output proves completion after review.
- AN-050done/evidence locally, public97 unchanged. Records/screenshots/task acceptance preserved; new AN-053 release task depends050/051, next051 label connection then approved full-release checks/publication. Real-device/VoiceOver/keyboard/INP/large storage/AN001/ZIP/AN038 remain open, goalactive.

## AN-051 — Native labels for record starting conditions

- Previous goal turn completed AN-050 locally dfa4636 (progress). Current clean source/status/acceptance/brief/history/recipes inspected, codex/record-labels branch. Existing all-approval retains scoped implementation/release authorization; no fee/private data.
- Existing visible labels lacked association; chosen native for=fFace/fArrows only, no duplicateARIA or layout/handler changes. Red6 exact named-role count0; final14 passed (13.4s), new6 in both engines320/375/900 with field/triple/single and4/3/12 arrows, names/Tab/ShiftTab/Enter/visible-choice/stored-condition/prior3sessions/active reload/error0. Related8 repeat/current-start light/dark pass.
- App/UI/lint/format succeed,375before/after exactbytes and image inspection unchanged. Read-only independent review noP1/P2, final14 output inspected. Absent guessed testfile located correctly by rg --files, no app failure inferred.
- Source diff is2for attributes, no CSS/scoring/storage/schema/version/worker/dependency changes. Docs/images/CHANGELOG/progress/tasks/history updated, AN-051done with evidence, AN-053approvedready for both050/051 fullrelease checks then publication. Public97 unchanged, localcommit next; physical-device/VoiceOver/nativepicker/INP/storage/practice/ZIP/AN038 limits remain, goalactive.

## AN-053 — v98 feedback/labels release acceptance

- Previous goal turn completed AN-051local35cc6b38 (progress). Clean source/status/acceptance/brief/ledger/recipes inspected; codex/record-feedback-release. Broad human approval continues, no repeat permission/fee/private records.
- Marker-only181ad544 aligns98 all5files; AN-050/051 runtime unchanged. Owned sandbox source104/tree/shared lock and native21/readiness98 pass. Fullcheck/lint/format success,129 passed (1.7m). Initial native caption97 despite correct98 assertion corrected/rerun; no application failure.
- Four actualSW active routes plus four clickable normal-motion/mobile banner routes v97→98 pass Chrome/WK320/375, strict readiness/cache98, history5/trend/active, stopped-origin offline/fromSW/error0. Banner routes include6-arrow correction/deselect/end1/nextarrow and genuine notification bounds16px/contrast15.128.375 publication rehearsal/settingsCDPswipe/offline succeeds, image inspected; output retained as rehearsal.
- Bounded current-state animation gate preserved; geometry-promoted layout is not performance evidence. Physical iPhone/VoiceOver/nativepicker/keyboard/INP/large storage/AN001 and ZIP/AN038 remain open. AN-053in-progress/false pending independent review, approved push/sourceCI/Pages/all21bytes/fresh375live. Goalactive.

- AN-053completed: immutable diff/evidence read-only review noP1/P2; remote dd3 ancestor, approved ordinary push to0db834550a49352e21f420af7037d4c832e4b4e6 (runtime181). Exact-sourceCI36995025215/Pages36995023628success,129 passed (2.7m). All21 deployed98bytes match; fresh375 namedselectors/6arrowcorrection/deselect/end1/next/fulltarget/genuinefeedback16px+contrast15.128/settingsCDPswipe/offlinehistory5+active/error0 success, liveimage inspected. Rehearsal preserved separately; fullacceptance/docsformat/source/native/shared lock preserved. AN-053done/evidence only now, records localcommit next. Next approvedAN-038 isolation; device/VoiceOver/INP/storage/AN001/ZIP remain open, goalactive.

## AN-038 — Applied Lighthouse13 isolated validation

- Previous goal turn completed AN-053/v98 release (progress). Clean77e404a8/source/status/acceptance/brief/ledger/recipes inspected; branchcodex/lighthouse-upgrade-validation. Human all-approval covers prior reviewed28 newnames/major scope, no repeat permission/fee/private records.
- Exact reviewed13.5.0 graph rebased root0.98 only, sourcegraph equals reviewbaseline. Fresh owned sandbox install259 ignore-scripts;43add/61remove/21change inclroot/28newnames, extract-zip absent/audit0. Sharedjunction/hiddenlock unchanged, no root/original/prior-sandbox install. Helper explicitly reportingfalse and printsLHRversion; docs minNode22.19.
- OfficialSHA checked isolatedNode22.19 executable, allinstalled engine ranges match. Actualminimum runtime fullcheck/lint/format/native and129 passed (1.8m). Existinghelper baseline success13.5.0, mobile/simulated/localblank, perf81/LCP5.1648s/observed132.121ms, runtimeError/warnings absent, browser report requestsloopback. No performance improvement/realINP claimed.
- Rawgit comparison failed because WindowsCRLF vsGitLF; index62CRLF/normalizedequal/noappdiff. Missing follow-up summary resulted. Verifier text-toGit normalized only, exactbinaries/nativebytes preserved, correctedpass. Failedlogs retained; no app or benchmark change.21v98 content/native/readiness98 pass, reportimage inspected.
- Read-only immutable review noP1/P2, finishedlogs inspected. Source2218a1b local; AN-038done with evidence/publicationstate explicit after acceptance. Publicmain0db83455/v98 unchanged; alerts13/27 remainpublic. New AN-054approvedpublish/LinuxCI/bytes/alerts then AN-055repeated cold-load diagnosis. Device/VoiceOver/keyboard/large storage/AN001 open; goalactive.

## AN-054 — Approved Lighthouse tooling publication

- Previous goal turn completed AN-038 isolation/local2218+records29979 (progress). Cleanstatus/currentbrief/ledger/acceptance/recipes inspected. Branchcodex/lighthouse-upgrade-publication; approval persists, no fee/private records.
- Prior allchecks/lint/full129/minNode22.19/baseline/audit0/review evidence reused after71 actualsource/test/dependency/config sandbox-byte comparison,21 candidate-vs-public Gitappbytes exact, shared hidden lock and ancestry verified. No root install/worker/version/runtime change. Freshdocsformat pass.
- Remote0db confirmed then approvedordinarypush to29979e261e93ffdfcdce224293283764e5641b7b. Initialactionslist empty immediately afterpush; not a failure. SourceCI/Pages/actualLinuxNode/live21bytes/alerts processing acceptance pending. AN-054in-progress/false, broadgoalactive.

- AN-054complete: sourceCI36997200642/Pages36997199129 success at29979, actualUbuntuLinuxNode22.23.3/cleaninstall0/fullchecks/lint/format/129 passed (2.8m). All21live98assets and3changedtoolfiles byte-equal. Fresh GitHubopen0 and ZIP13/27fixed_at10:45:08Z/null dismissal; no dismiss mutation. Current appbytes/scoring/storage/cache unchanged, no version bump/fee/private records/root install. Fullrecords/tasks done with evidence, existingacceptance preserved. LinuxCI did notrunLHbenchmark, Windowsminimum proof separate. NextAN-055same-tool repeatedcoldload/criticalpath; real-device/INP/storage/AN001 remain open, goalactive.

## AN-055 — Repeated cold-start diagnosis

- Previous goal turn completed AN-054 publication (progress). Clean691f1cd7/current source/status/acceptance/brief/ledger/recipes inspected; codex/cold-start-diagnosis. Existing all-approval persists, no repeat permission/fee/private data. Archery Note/diagnose/debug/review/verification skills used. One diagnostic task; app implementation stays for AN-056.
- Owned Lighthouse13.5/officialisolatedNode22.19/Chrome149, fresh blank mobile onboarding, reportingfalse, loopback HTTP1/no-store. Originalhelper3 same-source/settings repeats score81/modeledLCP5167.908–5178.131ms/median5173.879, unthrottledobserved116–118/median117ms. Ranked transport/payload/CPU hypotheses before probes. No simultaneous benchmark/test load.
- Controlledraw/gzip/compact3each allCLI0: gzipJStransfer199339→148452; scriptbodygzip195931→145044, saving50887bytes/25.97%; prototype strips comments/whitespace with token/linebreak/name preservation and14ASTequal, globals/scriptcount/order retained. Source21/textGitCRLFnormalized/binaryexact/sharedhiddenlock unchanged. Public3sample headersalreadygzip; raw→gzip cannot be called a new public improvement.
- Modelgzip→compact median2585.338→2136.669ms (448.669ms prediction); unthrottled107→108ms no demonstratedgain. ActualDevToolsblocked6 median3046.423→2954.351 (92.072ms); read-onlyreview raised fixedorder/hash limits, noP1/P2. Followupinterleaved6 terminal0, exact21variant hashes: pairs109.508/102.269/98.489ms; medians3048.942→2950.453. Gzipalwaysfirst/n3/host effects remain, no realphone/public/INP guarantee. TBTmixed, no CPU responsiveness claim.
- 14defer scripts lead to90init render/onboardingparagraph; network-tree insight excluding them is not complete dependency proof. AggregateCPUcategory totals not firstLCPisolated; no CPUdominance inference. All24reports/LHversion/settings/host/scriptrequests/errorswarnings/prototype AST/size/hash verified; rawlogs/reportcopies/helpers kept ignored inartifacts/cold-start. Diagnostics doc includes exact terminaloutputs and officialthrottling reference.
- Tracked changes diagnosticdoc/progress/tasks/ledger only, no source/cache/dependency install/version/push. NextAN-056 maintainable deterministiccompactdistributionJS with editableoriginals/name/order preservation, generated-integrity and actualdistribution app/update/offline/mobile syntheticregression before adoption; no prototype shipment assumed. PhysicaliPhone/VoiceOver/INP/large storage/AN001 remain open, broadgoalactive. Finalformat/review/recordaudit and taskdone evidence follow after inspection.

- Final independent read-only review: no concreteP1/P2, interleaved/hash followup supports nextcandidate; fixedpairorder/n3/public/AST limits correctly retained. Diagnostic verifier success for24reports/21hashes/14ASTs/sharedlock; docs format output `All matched files use Prettier code style!`. AN-055done with nonempty evidence; AN-056open, all55existing IDs/acceptance preserved. Final record audit/format/diff and localcommit follow, no push this diagnostic run.

- Finalrecordaudit success: only4 diagnostic records changed,21app input hashes/sharedlock unchanged, all55old taskcontracts/content retained except055status/evidence. Tasks-only formatter had condensed old dependency arrays; restored original formatting outside055/056 beforecommit. Loopback8772/8773 have no listener, all4matrix handles terminal0. No application regression rerun for docs-only change; final formatting/diff checks pass, local diagnostic commit follows.

## AN-056 — Actual compact distribution implementation

- Previous goal turn AN-055 diagnosis was progress. Clean322743c4/source/status/acceptance/brief/ledger/recipes inspected; codex/compact-distribution-js. Human allapproval continues, no repeat permission/fee/private data. App/brainstorming/plan/TDD/review/verification applied. Guessed absent readpaths corrected via inventory; no app failure inferred.
- Ownednewcompact-js sandbox only268install8s, Terser5.51.2devpin/9newlockpaths/nooldentrychangeexceptroot/audit0. Sharedjunction/hiddenlock preserved; isolatedNode22.19, noOS/PATH install. compressfalse/manglefalse/classic/ecma2020/licensecomments; same14paths/globals/order, editableoriginals/no scoring/schema/worker/version change. Distributionserver explicitmode/forcedCI no reusedsource server, CItestsactualoutput.
- RedcopyJSfails; initialstructuralgreens exposeprintershorthand/templateescaping/sole-returnarrows. Inspectedprinter, ecma2020 retains shorthand, explicitcanonical normalization ignoresliteralspelling/untaggedraw only andsole-returnarrow syntax, keeps taggedraw/name structure; VMfixtures exerciseASI/sharedlexical/regex/template/returns. Final14/regen/source/name/order, gzip195931→138825 (57106bytes/29.15%). Earlierlintquoteescape corrected, failedcontextpatch no edit; logs retained. sourcecommitd63904dd93dc1e671c42f2cffe05f644d7973331.
- Wholecheck/lint/format andactualdist129(1.8m) success. Four normalmobileChrome/WK320/375 realworker test-only98→99 markerfixture confirmsbanner/cache/history5/trend/subtotal19/6矢correction/end/next/focus/stoppedoriginofflineactive1/errors0. Interrupted7881latermissing, complete4output/resultrows/noNodeprocess inspected, no restart/no falseexitclaim.
- First review unavailable dueusagelimit/no purchase; retryread-onlysuccess noP1P2 inprinter/integration, but identified olddistposeasset omission forpublicpipeline. Missingassetred retained. Added4existingassetsunchangedcopy/bytechecks/HTTP200/MIME/SHA/blankstartupnoPoseRequests. Finalwholecheck/lint/format andactualdist130 passed (1.8m), terminal34298exit0. Followupreview noadditionalP1P2, camera/GPU/inference notproven. sourcefix912ac284.21corebytes identical to priorupdate/perf,25assets nowpresent (metadata separate).
- Exactinputhash6actualTerserDevToolsinterleaved coldCLI0 (149Chrome/LH13.5/Node22.19), no concurrenttests. OriginalLCP3049.344/3066.327/3072.658 vs2920.949/2921.299/2922.710ms min/median/max; groupdiff145.028/pairs128.045/151.709/143.617. BothCLS0/TBTvariable; n3/originalfirst/HTTP1/hostlimits, no realphone/public/INP/fixedmagnitude guarantee ornewmodelprediction. Verifier6reports/4updates/21capturebytes/25assets/lock/source-sandboxmatch;375analysisPNGbyteidentical/viewed.
- ReadonlyPagesAPI legacy/mainroot: AN-057 mustpublishgeneratedartifactwithcheckedworkflow/config andall25liveasset verification, notsimplypushbuildcode. No versionbump/push/externalsettingwrite inthissmalltask. AN-056done/evidence,56existingtaskacceptance preserved/new057open; records/CHANGELOG/progress/tasks/history plusignoredartifacts updated. Finalformat/audit/localcommit follows. Device/INP/camera/largehistory/AN001 open, goalactive.

## AN-057 — Compact distribution Pages publication

- Previous goal turn AN-056 implemented/validated compact distribution (progress). One release task; current source6ea08744/source status/brief/acceptance/recipes inspected. Standing human all-approval covers scoped publication/configuration; no fee/private data.
- Version:bump aligned99 in five files, SW cache number only. Existing CI now uploads checked dist/native25appassets+readiness and deploys with needs:validate/main-only/OIDC/environment/serialization. Review noP1P2. Full local check/lint/format/currentactual130 passed (1.7m), actualworker98→99 Chrome/WK320/375 four touch/normalmotion cases pass correction/end/next/5synthetic sessions/active1/stopped-origin offline/errors0. Candidate25 hashes/sharedhiddenlock unchanged.
- Remote29979 ancestry verified, Pageslegacy→workflow HTTPS/domain unchanged, approvedordinarypush6ea main. ExactsourceCI37131360394 running; heldpublic98freshprofile ready for actual99 update. Publicacceptance pending; taskin-progress/false, progress current, no repeated approval. Next inspect Linuxuploadedartifact/all25livebytes/heldupdate/fresh375 settingsswipe/offline; realiPhone/INP not claimed.

- Publication succeeded at6ea/CI37131360394 validate+deploy, actualUbuntuNode22.23.3/cleaninstall0/checks/lint/format/130 passed (2.7m). DownloadedactualLinuxartifact11276573236,26regularfiles safepath; all25livebytes exact. Linuxgzip195178→138825(28.87%) separatefromWindows29.15%. Freshpublic375 settingsCDPtouchswipe/pinchscale unchanged/group19/filterfocus/6correction/end/next/5synthetic histories/active1/networkofflinefromSW/errors0 passed/screenshotsinspected.
- Requiredheldpublic98→99 failed afterbanner/appv atAPP99 timeout30s. Originalcontextfinallyclosed beforestatecapture, not recovered; preservefailure, no data-loss evidence but postupdatechecksnotreached. Read-onlyfollowupreview says overallacceptancehold, not infer cache cause fromuncapturedoriginalprofile. Separate sameURL maxage600 repro showedAPP98/activatedworker99/controller/cache99code98; changingonlyHTTPcacheDisabled reached99. Diagnostic successnotnormalacceptance; no-storelocal4cases lackedwarmHTTPcache. HelperdiagnosticSyntaxError corrected beforeconfirmedprobe, no appchange.
- AN057 staysin-progress/false, newboundedAN058 normalcache regression/assetfreshness correction/nextalignedversion release acceptance. No additionalruntime/dependency/workeractivation edit or push after6ea; finalrecords/format/sourcecontracts/sharedlock audit/localcommit only. Originalpublicfailure remainsfailed; realdevice/INP unverified, broadgoalactive/no repeatpermission.
