# Codex Integration Progress

This file is the state ledger for the Archery Note integration work. Keep it
short, current, and honest. Update it after every Codex step.

Primary brief: [integration-plan.md](integration-plan.md)

## Current Status

- 2026-08-10 sanitized handoff candidate `codex/form-diagnostic-handoff-release`
  is the CI-verified v84 handoff branch. It is based on `origin/main`, excludes the
  sensitive adaptive-release ancestor, and is the only branch eligible for
  GitHub handoff. The sensitive root worktree still has three unrelated
  metadata documents modified; they remain unstaged and outside this candidate.
- Runtime markers are aligned at `APP_VER=84`, package `0.84.0`, Service Worker
  cache `archery-note-v84`, and storage `schema: 5`.
- Form diagnostic handoff Tasks 1–11, dependency-lock remediation, trusted
  HTTPS preview tooling, and the Windows replay-contract validation fix are
  implemented. Candidate PR #134 is draft/clean with green CI; no merge or
  deployment has been performed.
- Physical trusted-HTTPS iPhone acceptance is explicitly deferred. The current
  `archery-note-form-diagnostics.json` is a valid bounded schema-1 `field-3x6`
  artifact, but it has no preview commit/tree provenance and therefore cannot
  be attributed to this candidate. The earlier normal backup remains separate.
- The HTTPS helper now fails before certificate generation when the requested
  port is occupied, which avoids the stale-8743 “page cannot open” ambiguity.
- Next task: keep the physical checklist pending until a current-candidate
  artifact is collected, while preserving the candidate's green validation state.

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

| Phase                                                | State        | Notes                                                                                           |
| ---------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| 0. Plan import and runbook setup                     | needs-review | Planning files exist locally and remain untracked until reviewed.                               |
| 1. Repository inventory and phase reconciliation     | done         | Current repo compared with the integration brief on 2026-06-29.                                 |
| 2. OSS health docs and community files               | done         | Public OSS health baseline released in `v0.1.0-oss-readiness`.                                  |
| 3. Brand cleanup                                     | done         | Public app branding is Archery Note; remaining old-name hits are planning references.           |
| 4. CI and quality gates                              | done         | CI runs app, UI, lint, format, and E2E; `check:all` runs app/UI/storage/version.                |
| 5. Accessibility and shell polish                    | done         | Viewport zoom lock is guarded by checks; current shell uses five bottom tabs.                   |
| 6. Service Worker and update strategy                | in-progress  | Update safety gates and cache contracts pass; runtime intentionally keeps immediate activation. |
| 7. Storage migration and rollback                    | done         | Schema 5 normalization, import/save-load round trips, and rollback safety checks pass.          |
| 8. Analysis and stats integration                    | done         | Analysis/statistics views and characterization checks are in the verified candidate.            |
| 9. Third-party asset and experimental feature review | in-progress  | Current release has no OCR/pose/AI/model files; future assets require review first.             |
| 10. Final acceptance and report                      | in-progress  | Code/CI handoff is green; physical trusted-HTTPS acceptance is deferred by the user.            |

## Next Task Detail

Task: continue non-physical product-quality work after the field-acceptance pause.

Goal:

- Keep the handoff candidate based on `origin/main`, CI-green, and free of the
  three unrelated root-worktree metadata documents.
- Prefer one isolated regression or quality improvement that does not require
  physical HTTPS access, storage migration, Service Worker activation changes,
  dependency additions, or a broad UI rewrite.
- Physical acceptance remains a later explicit checkpoint, not a prerequisite
  for this code-side task.

Steps:

1. Start with `git status --short` and inspect the candidate tree.
2. Select one narrow product-quality invariant from the existing app surface.
3. Add the smallest regression or implementation change, then update this
   ledger with the exact validation and deferred physical acceptance.

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

## 2026-08-09 — Trusted HTTPS field-preview handoff

- Changed: added `tools/serve-iphone-https.ps1` for a short-lived, manually
  trusted HTTPS preview; extended `tools/e2e-server.js` with an opt-in PFX
  transport; added PWA contract checks and documented the iPhone acceptance
  procedure in `docs/form-diagnostic-field-acceptance.md`.
- TDD evidence: the new PWA contract first failed with the expected missing
  helper (`ENOENT`), then passed after the helper and HTTPS server branch were
  added. The helper supports an explicit `-HostAddress` so local smoke tests
  can bind to `127.0.0.1`; physical use should pass the selected LAN IPv4.
- Validation: `npm run check:all`, `npm run lint -- --quiet`,
  `npm run format:check`, Node/PowerShell syntax checks, localhost HTTPS smoke
  with certificate cleanup, Chromium E2E 83/83, and WebKit secure-context 2/2
  plus form-diagnostics 40/40 all passed. No certificate, private key, raw
  media, or debug log remains in the worktree.
- Handoff: commit `12f06cf5` is pushed to
  `codex/form-diagnostic-handoff-release`; draft PR #134 is `CLEAN` and its
  latest GitHub `validate` run passed. No main merge or public deployment was
  performed.
- Next: run the trusted HTTPS physical iPhone checklist (three conditions,
  six real shots each) and record only aggregate results and safe metadata.

## 2026-08-09 — Windows replay-contract validation fix

- RED: the candidate worktree's `npm run check:all` failed on Windows at the
  replay pose-continuation contract because the source file used CRLF while the
  static assertion matched only LF. The same contract passed on the Linux CI
  runner, so this was a local validation portability defect, not a runtime
  detector failure.
- Changed: `tools/check-form-core.js` now normalizes CRLF to LF only for that
  bounded source assertion. No production form logic, threshold, storage, UI,
  Service Worker, dependency, or user data changed.
- GREEN: `node tools/check-form-core.js` and `npm run check:all` pass in the
  Windows candidate worktree; lint and `git diff --check` pass. GitHub Actions
  run `31318614719` also passed all checks, including format and E2E smoke.
- Handoff: committed as `2a2794b2` and pushed to the sanitized draft PR branch.
  The three pre-existing metadata documents on the sensitive root worktree
  remain unstaged. Physical iPhone acceptance is still pending; the prior
  attached file was a normal backup rather than a completed diagnostic export.
- Next: use the candidate HTTPS URL directly in Safari, enable diagnostic
  saving, start the 18-shot batch, and collect candidate-generated partial
  backup evidence if the matrix does not complete.

## 2026-08-09 — Scoring/display radius parity regression

- Changed: `tools/check-app.js` now extracts `markCircle()` and asserts that
  the rendered SVG arrow-circle radius is exactly the same value returned by
  `arrowMarkRadius()`. This keeps the visible mark and the line-cutter scoring
  geometry tied to one radius source without changing runtime scoring.
- RED/GREEN scope: this is a regression-only hardening task; no production
  scoring, storage, Service Worker, dependency, or user-data behavior changed.
- Validation: `node tools/check-app.js`, `npm run check:all`,
  `npm run lint -- --quiet`, and `git diff --check` pass. The focused Prettier
  check reports the pre-existing legacy formatting drift in `tools/check-app.js`;
  no broad reformat was applied.
- Risk: test-only coverage. Physical HTTPS acceptance remains deferred and is
  not represented as complete by this change.
- Next: choose another isolated non-physical quality task, or resume the
  trusted-HTTPS field checklist only after explicit user direction.

## 2026-08-09 — Diagnostic record copy-isolation coverage

- Changed: `tools/check-form-diagnostics.js` now mutates an individual receipt's
  `userDisposition` and a generated `formDiagnosticMatrix` marker, and proves
  that the source record and a second planned record remain unchanged. This
  closes the previously noted non-blocking coverage gap without changing the
  planner or persistence implementation.
- Validation: `node tools/check-form-diagnostics.js`, `npm run check:form`,
  `npm run check:all`, `npm run lint -- --quiet`, `npm run format:check`,
  `node --check tools/check-form-diagnostics.js`, and `git diff --check` pass.
- Risk: test-only coverage; no runtime, storage, Service Worker, dependency,
  or user-data behavior changed. Physical trusted-HTTPS acceptance remains
  deferred.
- Next: review and publish this coverage-only candidate update, then leave the
  field checklist pending until explicit user direction.

## 2026-08-09 — Diagnostic matrix intermediate-state E2E coverage

- Changed: `tests/e2e/form-diagnostics.spec.js` now covers the one-record and
  two-record matrix states, asserting that each completed record contains six
  shots and that the next copy is exactly 「やや斜め」 and 「通常設置」.
  Existing 「真横」 and complete 18-shot cases remain unchanged.
- Validation: the focused prestarted Chromium run passed 2/2. The full
  `npm run check:all`, lint, `npm run format:check`, Node syntax check, and
  `git diff --check` also pass.
- Risk: E2E fixture/test-only coverage; no production behavior, storage data,
  Service Worker, dependency, or physical acceptance status changed.
- Next: review and publish this E2E coverage update; keep trusted-HTTPS field
  acceptance pending until the user explicitly resumes it.

## 2026-08-10 — Legacy form-save branch ordering contract

- Changed: `tools/check-form-core.js` now bounds both live and replay
  diagnostics-off save handlers and asserts the order
  `formDebug` gate → active receipt resolution → record push → `save()`.
  This protects the legacy path while frozen diagnostics saves remain separate.
- Validation: `node tools/check-form-core.js`, `npm run check:all`, lint,
  `npm run format:check`, Node syntax check, and `git diff --check` pass.
- Risk: static test-only coverage; no production, storage, Service Worker,
  dependency, or physical acceptance behavior changed.
- Next: publish the coverage-only candidate update after CI; keep the physical
  trusted-HTTPS checklist pending until explicit user direction.

## 2026-08-10 — Fail-closed malformed settings compatibility

- Changed: `tools/check-storage-contract.js` now proves that imported
  `formDebug: "true"` and `formTrackingEnabled: 1` values remain metadata rather
  than being coerced into enabled booleans. Runtime exact-boolean gates can
  therefore fail closed while the original user data remains preserved.
- Validation: `npm run check:storage`, `npm run check:all`, lint,
  `npm run format:check`, Node syntax check, and `git diff --check` pass.
- Risk: regression coverage only; `normalizeDb()` and all stored values are
  unchanged. No migration, deletion, Service Worker, dependency, or physical
  acceptance behavior changed.
- Next: publish this storage-safety coverage update after CI; keep the field
  acceptance checklist pending until explicit user direction.

## 2026-08-10 — Sanitized candidate strict review

- Scope: reviewed the candidate branch against `origin/main`, including every
  form save/delete write path, receipt ownership and cancellation paths,
  matrix eligibility/export, exact-boolean settings, native/Web transport,
  storage normalization/round trips, dependency-lock changes, and Service
  Worker boundaries.
- Findings: no blocker, major, or actionable minor defect was found. The
  visible mark radius and scoring radius share one source; transactional
  failures restore array/coordinator/timestamp state; diagnostics-off paths
  retain legacy behavior; and no Service Worker activation change or
  production dependency addition is present.
- Validation evidence: latest candidate CI is green; local `npm run check:all`,
  lint, format, storage checks, focused form checks, and diff checks pass.
- Not covered: physical iPhone camera accuracy and the trusted-HTTPS
  three-condition/18-shot field matrix remain intentionally unexecuted.
- Next: keep the draft handoff candidate ready, and resume field acceptance
  only after explicit user direction.

## 2026-08-10 — Windows trusted-preview instructions clarified

- Changed: `docs/form-diagnostic-field-acceptance.md` now gives copyable
  PowerShell commands that discover one local IPv4 address, passes it through
  `-HostAddress $lanIp`, warns not to type angle-bracket placeholders, and
  explicitly tells the operator to open the printed URL in iPhone Safari rather
  than PowerShell.
- Validation: `npm run format:check`, `npm run check:pwa`, and
  `git diff --check` pass. No helper, runtime, storage, or deployment code
  changed.
- Risk: documentation-only; physical acceptance remains unexecuted and no
  certificate or diagnostic artifact is committed.
- Next: publish this handoff clarification after CI, keeping the field matrix
  pending until explicit user direction.

## 2026-08-10 — Latest candidate full Chromium E2E

- Validation: the latest candidate worktree ran the complete Chromium suite
  against a prestarted server on an isolated port with one worker; all 85/85
  tests passed, including form save/retry/discard flows, 18-shot diagnostic
  settings/export cases, exact tracking-flag cases, secure-context behavior,
  onboarding, scoring, gamification, contrast, and wake-lock regressions.
- Risk: this is browser automation evidence only. Trusted-HTTPS iPhone camera
  accuracy and the three-condition/18-shot field matrix remain intentionally
  deferred; no physical acceptance claim is made from this run.
- Next: keep the draft handoff PR ready for review and wait for explicit
  direction before resuming field acceptance or merging/deploying.

## 2026-08-10 — Accessible form-history deletion control

- Changed: `scripts/47-form-view.js` now gives each icon-only射形記録削除 button
  the explicit accessible name `射形記録を削除`. Added a focused E2E contract in
  `tests/e2e/form-diagnostics.spec.js` so the three visible matrix records can
  be identified by role without relying on the icon markup.
- TDD evidence: the new test was RED with zero matching named buttons, then
  GREEN after the one-attribute runtime change; the focused test passed 1/1.
- Validation: the full form-diagnostics Chromium suite passed 43/43; `npm run
check:all`, `npm run lint -- --quiet`, `npm run format:check`, both targeted
  `node --check` commands, and `git diff --check` passed.
- Risk: additive accessibility metadata and test coverage only; no scoring,
  detector, storage, Service Worker, dependency, or physical acceptance
  behavior changed. Trusted-HTTPS iPhone acceptance remains deferred.
- Next: review this isolated UI-quality change and keep the candidate PR
  draft; do not merge, deploy, or resume field testing without direction.

## 2026-08-10 — Bound CI E2E execution time

- Changed: `.github/workflows/ci.yml` now caps the validation job at 10 minutes
  and the Playwright E2E step at 5 minutes. The latest candidate run had
  already completed all static checks but remained indefinitely `in_progress`
  during E2E, so the CI gate now fails boundedly instead of hanging without a
  result.
- Validation: `npm run check:all`, `npm run lint -- --quiet`,
  `npm run format:check`, targeted Prettier for the workflow, and
  `git diff --check` passed.
- Risk: CI configuration only; no runtime, storage, detector, Service Worker,
  dependency, or physical acceptance behavior changed. A timeout reports a
  bounded CI failure and does not claim E2E success.
- Next: push this CI guard, inspect the fresh PR run, and keep physical
  trusted-HTTPS acceptance deferred.

## 2026-08-10 — Accessible sight-ledger deletion control

- Changed: `scripts/60-history-sight-view.js` now gives the icon-only site-ledger
  deletion button the explicit accessible name `サイト値を削除`. The existing
  app-smoke E2E now asserts the named button is present for the seeded ledger.
- TDD evidence: the assertion was RED with zero matching named buttons, then
  GREEN after the one-attribute runtime change; the full app-smoke suite passed
  8/8.
- Validation: `npm run check:all`, `npm run lint -- --quiet`,
  `npm run format:check`, targeted Node syntax checks, `git diff --check`, and
  the full Chromium app-smoke suite passed.
- Risk: additive accessibility metadata and regression coverage only; no
  scoring, detector, storage, Service Worker, dependency, or physical
  acceptance behavior changed. Trusted-HTTPS field acceptance remains
  deferred.
- Next: commit this isolated UI-quality change, verify the candidate CI, and
  continue non-physical quality work until field acceptance is explicitly
  resumed.

## 2026-08-10 — Explicit live/replay shot-count status

- Changed: `scripts/47-form-view.js` now exposes `検出 n射` in both live capture
  and saved-video replay as an atomic polite status region. The count is updated
  through the same add/remove refresh paths that control the save button, so the
  displayed count cannot drift from the candidate shot list.
- TDD evidence: live and replay zero-shot tests were RED because the status
  elements did not exist, then GREEN after the shared refresh-path update; the
  focused pair passed 2/2.
- Validation: the full form-diagnostics Chromium suite passed 43/43 after the
  status addition. `npm run check:all`, `npm run lint -- --quiet`,
  `npm run format:check`, targeted Node syntax checks, and `git diff --check`
  also passed.
- Risk: additive status text and accessibility metadata only; no detector,
  retention, storage, Service Worker, dependency, or physical acceptance
  behavior changed. Trusted-HTTPS field acceptance remains deferred.
- Next: review the small capture-status change, then commit/push it and let the
  bounded candidate CI run the full suite.

## 2026-08-10 — Clarify diagnostic download filename

- Changed: `scripts/70-gear-settings.js` now includes the exact
  `archery-note-form-diagnostics.json` filename in the successful download
  toast. The existing transport still owns the download/share behavior.
- TDD evidence: the no-share download E2E was RED because the toast omitted the
  filename, then GREEN after the copy-only change; the focused test passed 1/1.
- Validation: the full form-diagnostics Chromium suite passed 43/43;
  `npm run check:all`, lint, format, targeted syntax checks, and
  `git diff --check` pass after formatting the changed E2E assertion.
- Risk: user-facing copy and regression coverage only; no transport, storage,
  detector, Service Worker, dependency, or physical acceptance behavior
  changed. Trusted-HTTPS field acceptance remains deferred.
- Next: commit/push this small UX fix, inspect candidate CI, and continue
  nonphysical quality work.

## 2026-08-10 — Bound static CI checks

- Changed: `.github/workflows/ci.yml` now gives the `Run all checks` step its
  own five-minute timeout in addition to the job and E2E timeouts. The latest
  candidate run remained in-progress inside that step despite the existing
  job-level guard, so this makes the static-check boundary explicit.
- Validation: local `npm run check:all`, lint, format, targeted syntax checks,
  and `git diff --check` pass; no runtime or data-path code changed.
- Risk: CI configuration only. A genuinely hung static check now reports a
  bounded failure instead of leaving the PR indefinitely pending. Trusted-HTTPS
  field acceptance remains deferred.
- Validation: after push, GitHub Actions run `31323051378` completed
  successfully; Run all checks, Lint, Format check, Playwright installation,
  and E2E smoke all passed. PR #134 is OPEN, draft, and CLEAN at the new HEAD.
- Next: keep the handoff candidate ready for review and continue one isolated
  nonphysical product-quality task; do not merge, deploy, or resume field
  acceptance without direction.

## 2026-08-10 — Add actionable zero-shot capture guidance

- Changed: `scripts/47-form-view.js` now centralizes completion copy for replay
  and zero-shot diagnostic saves. A 0射 result explicitly asks the user to
  check that the full body, bow arm, and drawing arm are visible from the
  camera position before retrying. Positive counts keep the existing concise
  completion text.
- TDD evidence: the new source contract first failed with
  `zero-shot completion gives actionable camera-position guidance`; after the
  helper and live retry toast were added, the focused zero-shot live E2E passed
  1/1.
- Validation: full form-diagnostics Chromium E2E passed 43/43; `node
tools/check-form-core.js`, `npm run check:all`, lint, format, targeted syntax,
  and `git diff --check` all pass.
- Risk: user-facing guidance and regression coverage only; detector thresholds,
  shot retention, storage, export schema, Service Worker, dependencies, and
  physical acceptance behavior are unchanged. Trusted-HTTPS field acceptance
  remains deferred.
- Validation: after push, GitHub Actions run `31323727790` completed
  successfully; all static checks, Playwright installation, and E2E smoke
  passed. PR #134 remains OPEN, draft, and CLEAN at the new HEAD.
- Next: keep the candidate ready for review and continue one isolated
  nonphysical product-quality task; do not merge, deploy, or resume field
  acceptance without direction.

## 2026-08-10 — Clarify Windows diagnostic artifact handoff

- Changed: `docs/form-diagnostic-field-acceptance.md` now gives copyable
  PowerShell commands to locate `archery-note-form-diagnostics.json` in
  Downloads, verify it is a file, copy it to `C:\tmp`, and list alternate
  diagnostic filenames without treating a path as a command.
- Validation: targeted Prettier and `git diff --check` pass. This is
  documentation-only; no app, detector, storage, export, dependency, or
  physical acceptance behavior changed.
- Risk: the procedure intentionally stops with a clear error when the bounded
  diagnostic export is absent; it does not inspect or commit user data.
- Validation: after push, GitHub Actions runs `31324090219` and
  `31324221344` completed
  successfully; all static checks, Playwright installation, and E2E smoke
  passed. PR #134 remains OPEN, draft, and CLEAN at the latest HEAD.
- Next: keep the candidate ready for review and continue one isolated
  nonphysical product-quality task; the trusted-HTTPS field matrix remains
  pending.

## 2026-08-10 — Add offline diagnostic artifact checker

- Changed: added `tools/form-diagnostic-artifact.js` and
  `tools/inspect-form-diagnostic-json.js`; `check:form` now runs the
  synthetic contract test. The checker distinguishes the bounded
  `archery-note-form-diagnostics` export from a normal schema-5 backup,
  validates the exact 3×6/receipt/fire allowlists and limits, and prints only
  aggregate counts plus SHA-256.
- TDD evidence: the new contract first failed with
  `Cannot find module './form-diagnostic-artifact'`; after implementation,
  `node tools/check-form-diagnostic-artifact.js` and `npm run check:form`
  pass. CLI no-argument usage exits 2 as expected.
- Validation: `npm run check:all`, lint, format, targeted Prettier,
  targeted Node syntax checks, and `git diff --check` pass.
- Risk: dependency-free offline validation only; no detector thresholds,
  storage schema, transport, Service Worker, user data, or physical
  acceptance behavior changed. Trusted-HTTPS field acceptance remains
  deferred.
- Validation: after push, GitHub Actions run `31324924271` completed
  successfully; Run all checks, lint, format, Playwright installation, and
  E2E smoke all passed. PR #134 remains OPEN, draft, and CLEAN at commit
  `70ab059a`.
- Next: keep the candidate ready for review and keep the physical 3×6 matrix
  pending; do not merge, deploy, or resume trusted-HTTPS field acceptance
  without direction.

## 2026-08-10 — Clarify oversized backup refusal

- Changed: the offline artifact checker now explains that an oversized file is
  not a normal schema-5 backup artifact for this workflow, instead of showing
  only the byte-limit error. This directly covers the supplied 593,874-byte
  `archery-note-2026-08-09.json` without printing its contents.
- TDD evidence: the new message assertion first failed with the old
  `診断JSONが65536 bytesを超えています` text, then passed after the
  bounded copy-only message change.
- Validation: `node tools/check-form-diagnostic-artifact.js`, the supplied-file
  CLI refusal check, targeted Node syntax, and `git diff --check` pass.
- Risk: dependency-free CLI messaging only; no detector threshold, storage,
  transport, Service Worker, user data, or physical acceptance behavior
  changed. Trusted-HTTPS field acceptance remains deferred.
- Next: commit/push this small diagnostic handoff clarification, verify CI,
  and keep the physical 3×6 matrix pending.

## 2026-08-10 — Enforce diagnostic receipt reason allowlists

- Changed: the offline artifact checker now accepts only the production
  `cancelReason` and `unresolvedReason` enums; arbitrary strings are refused.
  This mirrors the source exporter and keeps tampered receipt explanations
  from passing offline validation.
- TDD evidence: a `private-sentinel` receipt reason first passed the checker,
  then the new allowlist assertion passed after the minimal validator change.
- Validation: `node tools/check-form-diagnostic-artifact.js`, `npm run
check:form`, lint, targeted Prettier, and `git diff --check` pass.
- Risk: bounded validator/test-only hardening; no detector threshold, storage,
  transport, Service Worker, user data, or physical acceptance behavior
  changed. Trusted-HTTPS field acceptance remains deferred.
- Next: commit/push this validator hardening, verify CI, and keep the physical
  3×6 matrix pending.

## 2026-08-10 — Accept bounded false-positive receipts

- Changed: the offline artifact checker now accepts 1–32 receipts per run
  while still requiring exactly six retained shots. This matches the exporter
  and field contract: a manually removed false positive may accompany the six
  retained shots; more than 32 receipts is refused.
- TDD evidence: a synthetic run with six retained receipts plus one
  `manual-removed` receipt first failed at the old exact-six check, then passed
  after the bounded count change. A 33-receipt run remains rejected.
- Validation: `node tools/check-form-diagnostic-artifact.js` passes; the full
  `npm run check:all`, lint, targeted Prettier, and `git diff --check` remain
  required before commit.
- Risk: offline artifact-validator alignment only; no detector threshold,
  storage, transport, Service Worker, user data, or physical acceptance
  behavior changed. Trusted-HTTPS field acceptance remains deferred.
- Next: finish the full local validation, commit/push this checker alignment,
  verify CI, and keep the physical 3×6 matrix pending.

## 2026-08-10 — Enforce diagnostic receipt state consistency

- Changed: the offline artifact checker now requires reason fields to match
  `detectorOutcome`: confirmed receipts have no reason, auto-canceled receipts
  have an allowed cancellation reason only, and unresolved receipts have an
  allowed unresolved reason only.
- TDD evidence: a synthetic `confirmed + anchor-return` receipt first passed,
  then the new consistency assertion passed after the minimal state check.
- Validation: `node tools/check-form-diagnostic-artifact.js`, `npm run
check:form`, lint, targeted Prettier, and `git diff --check` pass.
- Risk: bounded artifact-validator hardening only; no detector threshold,
  storage, transport, Service Worker, user data, or physical acceptance
  behavior changed. Trusted-HTTPS field acceptance remains deferred.
- Next: finish the full local validation, commit/push this state hardening,
  verify CI, and keep the physical 3×6 matrix pending.

## 2026-08-10 — Explain partial diagnostic shot counts

- Changed: `scripts/47-form-view.js` now accepts a diagnostic target count for
  replay completion. In diagnostic mode, a partial result such as 3/6 shows
  the missing count and camera/body/bow-arm/drawing-arm guidance; ordinary
  form tracking keeps its existing generic copy. Added a source contract and
  E2E regression.
- TDD evidence: the new partial-diagnostic E2E first reported a failure; after
  the target-aware completion copy and replay call, the focused test passed
  1/1. The complete form-diagnostics Chromium suite passed 44/44.
- Validation: `npm run check:all`, `npm run lint -- --quiet`,
  `npm run format:check`, targeted Node syntax checks, targeted Prettier, and
  `git diff --check` pass.
- Risk: user-facing guidance/observability only; no detector thresholds,
  shot retention, storage, transport, Service Worker, dependency, or physical
  acceptance behavior changed. Trusted-HTTPS field acceptance remains
  deferred.
- Next: commit/push this observability slice, verify candidate CI, then gather
  diagnostic evidence before any threshold change.

## 2026-08-10 — Align live diagnostic completion feedback

- Changed: diagnostic live-save feedback now uses the same target-aware
  completion copy as replay. A partial result such as 3/6 shows the missing
  shot count, camera/body/bow-arm/drawing-arm guidance, and the existing
  matrix retry notice; a valid 6/6 result keeps the matrix-added notice.
  Diagnostics-off save behavior and all persistence paths remain unchanged.
- TDD evidence: the focused live-save notification test first failed because
  the partial result dropped the matrix notice, then passed after the minimal
  shared helper change. The complete form-diagnostics Chromium suite passed
  45/45.
- Validation: `npm run check:all`, lint, `npm run format:check`, targeted
  Node syntax checks, targeted Prettier, and `git diff --check` pass.
- Risk: user-facing diagnostic feedback only; no detector thresholds, shot
  retention, storage, transport, Service Worker, dependency, or physical
  acceptance behavior changed. Trusted-HTTPS field acceptance remains
  deferred.
- Next: commit/push this feedback slice, verify candidate CI, then collect
  diagnostic evidence before any threshold change.

## 2026-08-10 — Distinguish zero-shot diagnostic causes

- Evidence audit: the supplied `schema:5` backup was inspected locally as an
  aggregate only (593,874 bytes, 16 form records). It contained four non-zero
  form records (1, 2, 1, and 3 shots) and twelve zero-shot records. Six
  zero-shot records had no `releaseFires` but many `rejectedFramesNear`
  samples, mostly in `DRAWING`/`SETUP`; other zero-shot records had release
  candidates but no retained shot. No matrix marker or release-receipt archive
  was present, so the file cannot prove the physical 3×6 result and was not
  copied into the repository.
- Changed: diagnostics-only zero-shot completion feedback now distinguishes
  "release not observed" from "release candidate not confirmed" using the
  already persisted `formPhaseDiag` summary. Generic/no-summary, non-zero-shot,
  diagnostics-off, storage, and detector behavior remain unchanged.
- TDD evidence: the focused public-copy E2E first returned the old generic
  message, then passed 1/1 after the minimal branch-specific copy and live/
  replay wiring. The complete form-diagnostics Chromium suite passed 46/46.
- Validation: `node tools/check-form-core.js`, `npm run check:all`, lint,
  `npm run format:check`, targeted Node syntax checks, and `git diff --check`
  pass.
- Risk: privacy-safe diagnostic feedback only; no detector thresholds, shot
  retention, storage schema, transport, Service Worker, dependency, or
  physical acceptance behavior changed. Trusted-HTTPS field acceptance and a
  validated 3×6 artifact remain pending.
- Next: commit/push this evidence-driven feedback, verify candidate CI, then
  request the next physical artifact or controlled field run before changing
  count thresholds.

## 2026-08-10 — Make diagnostic artifact handoff discoverable

- Changed: `tools/inspect-form-diagnostic-json.js --from-downloads` now scans
  only the current user's Downloads folder for
  `archery-note-form-diagnostics*.json`. It refuses zero or multiple matches
  with Japanese next-step guidance and keeps explicit-path validation intact.
  The field checklist now documents this safer invocation.
- TDD evidence: the temporary Downloads contract first failed because the
  discovery export was absent, then passed for zero, one, and multiple
  candidates. A missing explicit path and a no-candidate Downloads run both
  return exit 2 without printing artifact contents.
- Validation: `node tools/check-form-diagnostic-artifact.js`, `npm run
check:form`, `npm run check:all`, lint, `npm run format:check`, targeted Node
  syntax checks, and `git diff --check` pass.
- Risk: diagnostics handoff tooling and documentation only; no app runtime,
  detector thresholds, storage, transport, Service Worker, dependency, or
  physical acceptance behavior changed. Trusted-HTTPS field acceptance and a
  validated 3×6 artifact remain pending.
- Next: commit/push this handoff tooling, verify candidate CI, then obtain a
  valid diagnostics artifact or controlled field run.

## 2026-08-10 — Add privacy-safe normal-backup diagnostic fallback

- Changed: added `tools/inspect-form-backup-diagnostics.js` and its pure
  `summarizeFormBackupDiagnostics` boundary. It accepts only schema-5 normal
  backups and reports aggregate shot counts, zero-shot release-candidate and
  rejected-frame counts, canceled-event totals, and fixed phase buckets. It
  never prints record IDs, dates, notes, features, receipts, or raw frames.
- TDD evidence: the checker first failed because the new summary module was
  absent, then passed synthetic schema-5, malformed-schema, malformed-record,
  and unknown-phase cases. The supplied backup was inspected only through this
  aggregate boundary; no user JSON was copied into the repository.
- Validation: `node tools/check-form-backup-diagnostics.js`, `npm run
check:form`, `npm run check:all`, lint, `npm run format:check`, targeted Node
  syntax checks, and `git diff --check` pass.
- Risk: offline evidence tooling and documentation only. It does not claim a
  3×6 pass, alter detector thresholds, change persistence or transport, or
  replace the validated diagnostics artifact. Trusted-HTTPS field acceptance
  remains pending.
- Next: commit/push this fallback, verify candidate CI, then obtain a current
  candidate diagnostics artifact or controlled field run.

## 2026-08-10 — Clarify shared diagnostic file handoff

- Changed: the successful `shared` result now tells iPhone/Web Share users to
  choose 「ファイルに保存」 when they need a persistent JSON file. The share
  transport, filename, privacy payload, cleanup, and no-fallback behavior are
  unchanged.
- TDD evidence: the web-share E2E first failed because the toast stopped at
  「診断JSONを共有しました。」; after the copy-only change it passed 1/1.
- Validation: full form diagnostics, `npm run check:all`, lint,
  `npm run format:check`, targeted syntax checks, and `git diff --check` pass.
- Risk: user-facing handoff guidance only; no detector thresholds, shot
  retention, storage, transport state machine, or physical acceptance behavior
  changed. Trusted-HTTPS field acceptance remains pending.
- Next: commit/push this guidance, verify candidate CI, then obtain a current
  candidate diagnostics artifact or controlled field run.

## 2026-08-10 — Add trusted-HTTPS connectivity diagnostics

- Changed: `tools/serve-iphone-https.ps1` now warns when Windows reports a
  `Public` network profile, validates the requested port range, and prints a
  copyable `Test-NetConnection` command. The field checklist now distinguishes
  a blocked TCP port from an untrusted certificate; it never changes Firewall,
  Wi-Fi, certificate trust, or application data automatically.
- TDD evidence: `npm run check:pwa` first failed because the helper lacked the
  new connectivity markers; the source and contract were then aligned.
- Validation: `npm run check:pwa`, `npm run check:all`, lint,
  `npm run format:check`, targeted PowerShell/source checks, and
  `git diff --check` pass.
- Risk: preview diagnostics and operator guidance only; no app runtime,
  detector thresholds, storage, Service Worker, dependency, or export
  transport behavior changed. Physical 3×6 acceptance remains pending.
- Next: commit/push this connectivity aid, verify CI, then rerun the current
  candidate on trusted private Wi-Fi and collect the validated artifact.

## 2026-08-10 — Add non-CIM IPv4 fallback for HTTPS preview

- RED evidence: a non-admin local probe reproduced `Get-NetIPAddress` access
  denial before the HTTPS server could bind, which appeared as a connection
  failure. The new static contract failed until the fallback was present.
- Changed: the helper now falls back to
  `[System.Net.NetworkInformation.NetworkInterface]` when the PowerShell CIM
  query is unavailable, deduplicates IPv4 addresses, and warns which path was
  used. It does not alter Firewall, certificate trust, or app data.
- Validation: `npm run check:pwa`, `npm run check:all`, lint,
  `npm run format:check`, and PowerShell parse checks pass. The restricted local
  probe reached address discovery through the fallback, then stopped at the
  host's unavailable `New-SelfSignedCertificate` provider; the user's earlier
  manual run remains the certificate-generation evidence.
- Risk: preview helper resilience only; no detector thresholds, storage,
  Service Worker, dependency, or transport behavior changed. Physical 3×6
  acceptance remains pending.
- Next: commit/push this fallback, verify CI, then rerun the candidate on the
  user's trusted private Wi-Fi and collect the validated artifact.

## 2026-08-10 — Explain HTTPS certificate-provider failures

- RED evidence: `npm run check:pwa` first failed because the HTTPS helper had
  no contract for certificate creation failures.
- Changed: `tools/serve-iphone-https.ps1` now catches
  `New-SelfSignedCertificate` failures and reports that the Windows PKI
  provider must be available before troubleshooting iPhone network access.
  The temporary certificate is still short-lived and cleanup is unchanged.
- Validation: `npm run check:pwa`, PowerShell parse, and `git diff --check`
  pass. No app runtime, detector threshold, storage, Service Worker,
  dependency, or transport behavior changed.
- Risk: acceptance-helper diagnostics only. Physical 3×6 acceptance remains
  pending because a current candidate diagnostics artifact has not been
  collected.
- Next: commit/push this helper diagnostic, verify CI, then continue one small
  non-physical quality task while the trusted-HTTPS field run remains deferred.

## 2026-08-10 — Permit explicit loopback HTTPS diagnostics

- RED evidence: `npm run check:pwa` failed because the helper rejected an
  explicit `-HostAddress 127.0.0.1` whenever no non-loopback address was
  discoverable, even though loopback validation does not need a LAN address.
- Changed: the LAN-address requirement now applies to the default/all-interface
  and LAN-bound paths only; explicit loopback remains available for local
  certificate/server diagnostics. LAN binding validation and trusted-network
  warnings are unchanged.
- Validation: `npm run check:pwa`, PowerShell parse, and `git diff --check`
  pass. No app runtime, detector threshold, storage, Service Worker,
  dependency, or transport behavior changed.
- Risk: acceptance-helper boundary only. Physical 3×6 acceptance remains
  pending and still requires the current candidate plus a validated artifact.
- Next: commit/push this loopback boundary fix, verify CI, then keep physical
  acceptance deferred until the user can complete the trusted-HTTPS run.

## 2026-08-10 — Clarify optional form-tracking recording

- RED evidence: `npm run check:ui` failed because the live capture footnote
  said video is never saved while the optional recording control offers camera
  roll saving.
- Changed: the live capture copy now explains that pose analysis normally
  stores only summaries, and that enabling recording allows the stopped clip
  to be saved to the camera roll. The recording behavior itself is unchanged.
- Validation: `npm run check:ui`, `npm run check:app`, and the generated
  360/390/1280 smoke screenshots pass. No detector, shot-count, storage,
  Service Worker, dependency, or transport behavior changed.
- Risk: user-facing privacy/capability wording only. Physical 3×6 acceptance
  remains pending and still requires a current candidate artifact.
- Next: commit/push this copy correction, verify CI, then continue with a
  narrowly scoped count/acceptance quality task.

## 2026-08-10 — Centralize receipt-owned shot removal

- RED evidence: `node tools/check-form-core.js` failed because the shared
  receipt-owned shot removal helper was not exported; live/replay each still
  held their own array-filter implementation.
- Changed: added pure `formRemoveShotByReceiptId`, which returns a detached
  array, removes only the exact receipt ID, and preserves all shots for an
  unknown or missing ID. Both live and replay cancellation paths now use it.
- Validation: core/form contracts passed, syntax checks passed, and Chromium
  form-diagnostics E2E reported all 46/46 workers/tests `ok`; the Playwright
  parent hit the known web-server teardown timeout after the test run.
- Risk: shot-array ownership only; no detector thresholds, receipt state
  transitions, storage schema, Service Worker, dependency, or transport change.
  Physical 3×6 acceptance remains pending.
- Next: finish the cumulative check ladder, commit/push this count-ownership
  guard, verify CI, then continue toward the current-candidate field run.

## 2026-08-10 — Guard shot counts on receipt ownership success

- RED evidence: the new source contract failed because both `onShot` paths
  pushed into `shots` before checking `markShotCreated`, and manual removal
  ignored a failed `manualRemove` result.
- Changed: live/replay now add a shot only after receipt ownership succeeds;
  failed ownership leaves the visible and persisted count unchanged. Manual
  removal follows the same fail-closed rule.
- Validation: `node tools/check-form-core.js`, `npm run check:form`,
  `npm run check:all`, lint, format, syntax checks, and `git diff --check`
  pass. Existing Chromium form-diagnostics evidence remains 46/46 test bodies
  successful, with only the known parent teardown timeout.
- Risk: count/receipt ordering only; no detector threshold, receipt schema,
  storage, Service Worker, dependency, or transport behavior changed.
  Physical 3×6 acceptance remains pending.
- Next: commit/push this ownership guard, verify CI, then continue toward a
  current-candidate trusted-HTTPS field run.

## 2026-08-10 — Reject contradictory diagnostic receipt outcomes

- RED evidence: `node tools/check-form-diagnostic-artifact.js` accepted a
  synthetic receipt marked `outcome: "retained"` while its detector result was
  `auto-canceled`.
- Changed: the bounded artifact validator now requires retained/auto-canceled/
  unresolved outcomes to agree with their corresponding detector outcome;
  manual-removed and summary-failed remain valid across a finalized detector
  state because they describe user/summary disposition separately.
- Validation: artifact checks, `npm run check:form`, `npm run check:all`, lint,
  format, and `git diff --check` pass. No detector thresholds, storage schema,
  Service Worker, dependency, or transport behavior changed.
- Risk: acceptance-artifact consistency only. Physical 3×6 acceptance remains
  pending because no current-candidate trusted-HTTPS artifact has been
  collected.
- Next: commit/push this validator hardening and verify CI; keep field
  acceptance deferred until the user can produce the current candidate's
  diagnostic artifact.

## 2026-08-10 — Freeze on receipt ownership failure

- RED evidence: `node tools/check-form-core.js` failed because both live and
  replay `onShot` paths returned without a shot but allowed the workflow to
  continue after `markShotCreated` reported an ownership error.
- Changed: a receipt ownership error now freezes the active capture/replay
  workflow immediately, while preserving the fail-closed count guard. The
  existing save/close recovery path remains available for the user.
- Validation: `node tools/check-form-core.js`, `npm run check:form`,
  `npm run check:all`, lint, format, syntax, and `git diff --check` pass.
  No detector thresholds, receipt schema, storage, Service Worker,
  dependency, or transport behavior changed.
- Risk: receipt-error recovery only; physical 3×6 acceptance remains pending
  because no current-candidate trusted-HTTPS artifact has been collected.
- Next: commit/push this workflow-safety guard and verify CI; continue using
  the current candidate for the deferred trusted-HTTPS field run.

## 2026-08-10 — Freeze unresolved cancel/confirm transitions

- RED evidence: the new source contract failed because live/replay ignored
  error results from `receiptTracker.cancel()` and `receiptTracker.confirm()`
  after the ownership guard had been added.
- Changed: unexpected cancellation or pending-confirmation failures now freeze
  the workflow before diagnostics or count updates continue. Normal user
  cancellation and close paths remain unchanged.
- Validation: `npm run check:form`, `npm run check:all`, lint, format,
  syntax, and `git diff --check` pass. No detector thresholds, receipt schema,
  storage, Service Worker, dependency, or transport behavior changed.
- Risk: receipt transition recovery only; physical 3×6 acceptance remains
  pending because no current-candidate trusted-HTTPS artifact has been
  collected.
- Next: commit/push this transition guard and verify CI; keep the field run
  deferred until the current candidate can be exercised on trusted HTTPS.

## 2026-08-10 — Keep diagnostic recovery save enabled after receipt failure

- RED evidence: the new source contract found that a first-shot receipt
  failure left `#fcSave`/`#frSave` disabled even though the error message told
  the user that the result could be saved.
- Changed: in exact-debug mode, live and replay receipt-failure freezes now
  enable a clearly labeled diagnostic save action, including the zero-shot
  recovery path. Ordinary non-debug behavior remains unchanged.
- Validation: `node tools/check-form-core.js`, `npm run check:form`,
  `npm run check:all`, lint, format, syntax, and `git diff --check` pass.
  No detector thresholds, receipt schema, storage, Service Worker,
  dependency, or transport behavior changed.
- Risk: receipt-error recovery UX only; physical 3×6 acceptance remains
  pending because no current-candidate trusted-HTTPS artifact has been
  collected.
- Handoff: candidate `codex/form-diagnostic-handoff-release` is at
  `4177aa1544020bf86aaf09bc7ab178872c5aa6f1`; its worktree and origin are
  clean and synchronized. Draft PR #134 is `CLEAN`, and the latest GitHub
  validate run succeeded.
- Next: resume the field run only with this current candidate over trusted
  HTTPS, then inspect the bounded artifact with
  `node tools/inspect-form-diagnostic-json.js --from-downloads`. The earlier
  3/6–0/6–3/6 notes and the ordinary schema-5 backup are not acceptance
  evidence; do not mark the product acceptance complete until a current
  diagnostic artifact exists.

## 2026-08-10 — Align live/replay diagnostic completion notices

- RED evidence: the new Chromium contract could not find a shared matrix
  notice helper, so replay diagnostic saves had no target-aware partial-count or
  matrix-condition message even though live saves did.
- Changed: `scripts/47-form-view.js` now derives the matrix notice once for
  both live and replay saves and renders the frozen candidate's shot count.
  This keeps retry feedback stable after the save candidate is frozen and
  leaves zero-shot guidance unchanged.
- Validation: the focused worker passed; the prestarted full form-diagnostics
  suite passed 47/47. `node tools/check-form-core.js`, `npm run check:all`,
  lint, format, syntax checks, and `git diff --check` all pass.
- Risk: user-facing diagnostic completion feedback only; no detector
  thresholds, receipt ownership, storage schema, Service Worker, dependency,
  or transport behavior changed. Physical 3×6 acceptance remains pending.
- Next: commit/push this isolated notification parity fix, verify CI, and keep
  the current-candidate trusted-HTTPS field run as the remaining acceptance
  evidence task.

## 2026-08-10 — Show the diagnostic shot target during capture

- RED evidence: the exact-debug live and replay E2E cases still showed
  `検出 0射` at capture start, so a field operator could not tell that the
  current diagnostic run is targeting six retained shots.
- Changed: `scripts/47-form-view.js` now shows `検出 X/6射` in exact-debug mode
  for both live and replay workflows. Normal tracking remains `検出 X射`, and
  malformed truthy settings do not activate the diagnostic target.
- Validation: the focused RED→GREEN cases passed; the full form-diagnostics
  suite passed 48/48. `node tools/check-form-core.js`, `npm run check:all`,
  lint, format, syntax checks, and `git diff --check` all pass.
- Risk: diagnostics-only count guidance; no detector thresholds, receipt
  ownership, storage schema, Service Worker, dependency, or transport behavior
  changed. Physical 3×6 acceptance remains pending.
- Next: commit/push this count-visibility slice, verify CI, then resume the
  current-candidate trusted-HTTPS field run when available.

## 2026-08-10 — Clarify share success versus saved diagnostic artifact

- Changed: `docs/form-diagnostic-field-acceptance.md` now distinguishes the
  iPhone share-sheet success toast from an artifact actually saved to Files or
  transferred to the development PC. It explicitly requires choosing
  `ファイルに保存` and then running the bounded offline checker.
- Validation: targeted Prettier and `git diff --check` pass. No application,
  storage, detector, transport, Service Worker, or dependency code changed.
- Risk: acceptance-operator guidance only; physical 3×6 acceptance remains
  pending because no current-candidate artifact has been collected.
- Next: commit/push this documentation-only clarification and keep the field
  run deferred until the current candidate can be exercised on trusted HTTPS.

## 2026-08-10 — Add optional certificate opening aid

- RED evidence: `npm run check:pwa` rejected the new HTTPS helper contract
  before the helper exposed a way to open its temporary `.cer` file.
- Changed: `tools/serve-iphone-https.ps1` accepts optional `-OpenCertificate`
  and opens the temporary certificate on the Windows PC when requested;
  `docs/form-diagnostic-field-acceptance.md` explains that transfer and iPhone
  trust still require explicit user action. Default helper behavior is unchanged.
- Validation: `npm run check:pwa` and `git diff --check` pass. No app runtime,
  storage, detector, Service Worker, dependency, or production network behavior
  changed.
- Risk: acceptance-helper convenience only; physical 3×6 acceptance remains
  pending because no current-candidate artifact has been collected.
- Next: commit/push this helper aid, verify CI, then resume the trusted-HTTPS
  field run when available.

## 2026-08-10 — Lock the six-shot summary and receipt pipeline

- Changed: `tools/check-form-core.js` now drives six production-shaped release
  sequences through `stepFormPhase`, `summarizeFormShot`, and receipt ownership.
  The contract requires six non-null summaries, ordered `form-receipt-1` through
  `form-receipt-6`, and six present receipt records. This catches silent count
  loss between detector release and the visible shot list without changing any
  detector threshold or storage behavior.
- Validation: `node tools/check-form-core.js`, `npm run check:form`,
  `npm run lint -- --quiet`, and `git diff --check` pass.
- Risk: test-only coverage; no production runtime or persisted data changed.
  Physical 3×6 acceptance remains pending until a current trusted-HTTPS
  diagnostic artifact is collected.
- Next: run the current-candidate field acceptance when trusted HTTPS is
  available, or continue with another isolated regression contract.

## 2026-08-10 — Require confirmed receipt state in the six-shot contract

- Changed: the six-shot regression now asserts that every retained receipt
  confirms cleanly and ends as `userDisposition: "present"` plus
  `detectorDisposition: "confirmed"`, not merely that six IDs were allocated.
- Validation: `node tools/check-form-core.js`, `npm run check:form`,
  `npm run lint -- --quiet`, and `git diff --check` pass. The focused
  Prettier check reports the same pre-existing whole-file formatting drift in
  `tools/check-form-core.js`; the new diff itself has no whitespace errors.
- Risk: test-only coverage; no production runtime, storage, or detector
  behavior changed. Physical 3×6 acceptance still requires a current bounded
  diagnostic artifact.
- Next: commit/push this contract-only review fix, verify CI, then keep the
  physical checklist pending until the user can collect the artifact.

## 2026-08-10 — Cover camera-angle variants in release detection

- Changed: `tools/check-form-core.js` adds rotation/translation variants for
  side, oblique, and normal-range camera geometry. Each production-shaped
  sequence must retain exactly one genuine release. This is a detector
  regression contract only; it does not tune thresholds or infer a field result
  from the older 3/6–0/6–3/6 report.
- Validation: `node tools/check-form-core.js`, `npm run check:all`,
  `npm run lint -- --quiet`, `npm run format:check`,
  `npm run golden:form-fixtures`, and `git diff --check` pass.
- Risk: synthetic geometry coverage cannot replace trusted-HTTPS iPhone
  evidence. The current candidate still requires a bounded diagnostic JSON
  before physical acceptance can be marked complete.
- Next: commit/push this isolated angle-coverage contract, verify CI, and keep
  the physical checklist pending until the user can collect current evidence.

## 2026-08-10 — Clarify the saved filename after web sharing

- RED evidence: the focused Chromium export case failed because the success
  toast only said that sharing succeeded; it did not identify the filename to
  choose in the share sheet.
- Changed: the shared-result copy now names
  `archery-note-form-diagnostics.json` while retaining the explicit
  `ファイルに保存` instruction. No transport fallback or persistence behavior
  changed.
- Validation: the focused Chromium export case passed 1/1 and the full
  form-diagnostics suite passed 48/48. `node tools/check-form-core.js`,
  `npm run check:all`, lint, format, syntax checks, and `git diff --check` all
  passed. GitHub Actions run `31336848626` also completed successfully.
- Risk: export guidance copy only; physical 3×6 acceptance remains pending
  because no current-candidate diagnostic artifact has been collected.
- Handoff: commit `65a8f822` is pushed to the draft PR candidate and its CI is
  green. Continue non-physical quality work while the user keeps the
  trusted-HTTPS field run deferred.

## 2026-08-10 — Print the trusted preview commit and tree

- RED evidence: `npm run check:pwa` failed because the HTTPS acceptance helper
  did not expose the exact Git commit/tree that it was serving, even though
  the field checklist required those identities.
- Changed: `tools/serve-iphone-https.ps1` now resolves and prints
  `Preview Git commit:` and `Preview Git tree:` before the iPhone URL, with a
  warning if Git identity resolution is unavailable. The field checklist now
  tells the operator to record both values.
- Validation: `npm run check:pwa`, `npm run check:all`, lint, format, syntax,
  diff-check, and PowerShell parsing pass. Direct helper execution reached the
  existing temporary-certificate step but this Windows environment's PKI
  provider returned `ERROR_FILE_NOT_FOUND`; the server output itself could not
  be exercised here. No app runtime, storage, detector, Service Worker,
  dependency, or user-data behavior changed.
- Risk: trusted-preview provenance only; physical 3×6 acceptance remains
  pending because no current-candidate diagnostic artifact has been collected.
- Handoff: commit `ec96f037` is pushed to the draft PR candidate and GitHub
  Actions run `31337422713` completed successfully. The current candidate tree
  resolves to `47441f16c4594eb6632d9d7e75c0d4dc2ac3299a` when checked with
  Git's safe-directory allowance. The helper implementation is in
  `47ba1b11` (tree `23d1a19a249b276659de53d9d771aa74de90c69f`). Keep the field
  run deferred until the user can exercise the current candidate and save the
  diagnostic artifact.

## 2026-08-10 — Audit the current acceptance path

- Scope reviewed: the trusted-HTTPS helper and its PWA contracts, the exact
  diagnostic export gate, the Web/native/download transport boundary, the
  bounded artifact checker, and the live/replay completion feedback.
- Findings: no blocker or major data-loss/spec-breakage finding. Existing
  user-data preservation, diagnostics-off behavior, receipt ownership, and
  artifact privacy boundaries remain intact. The review did not change runtime
  code or persisted data.
- Validation: `npm run check:all`, `npm run lint -- --quiet`,
  `npm run format:check`, and `git diff --check` all pass on candidate
  `adce530be5f8994059044f230dfc7a4de9285a2c`. GitHub Actions validate run
  `31337695777` also passed, including the E2E smoke test.
- Not covered: Windows PKI certificate creation could not be exercised in this
  sandbox (`ERROR_FILE_NOT_FOUND` from the provider), and no current-candidate
  iPhone 3×6 diagnostic artifact exists. Those are evidence gaps, not grounds
  to infer a detector result from the older 3/6–0/6–3/6 report.
- Next: when the user resumes the field run, serve this exact candidate, record
  the printed commit/tree, save `archery-note-form-diagnostics.json`, and run
  `node tools/inspect-form-diagnostic-json.js --from-downloads` before making
  the physical acceptance decision.

## 2026-08-10 — Guard patched dependency floors in CI

- RED evidence: the new dependency-floor check initially failed with
  `Cannot find module './dependency-floor'`, proving the contract was not
  satisfied before the helper existed.
- Changed: added a local, offline lockfile check for the three currently
  reported Dependabot packages (`ip-address >=10.3.1`, `tar >=7.5.18`, and
  `brace-expansion >=5.0.7`) and included it in `check:all`. The current lock
  resolves to 10.4.0, 7.5.22, and 5.0.9 respectively; no dependency was
  added or upgraded by this task.
- Validation: the focused check, malformed/nested-floor cases, syntax, lint,
  `npm run check:all`, `npm run format:check`, and `git diff --check` pass.
  The guard is static and does not claim that GitHub Dependabot alerts have
  been administratively closed.
- Risk: this is development/release tooling only; runtime behavior, storage,
  Service Worker, detector thresholds, and the physical acceptance result are
  unchanged. The current-candidate iPhone artifact is still missing.
- Next: commit/push this isolated guard, verify its CI run, then resume the
  trusted-HTTPS 3×6 field checklist only when the user is ready.

## 2026-08-10 — Complete the Windows E2E regression run

- Evidence: the full Chromium suite completed `91 passed (2.1m)` with one
  worker against a manually prestarted matching-port server on port 4196;
  the wrapper exited 0 and the server PID was stopped afterward.
- Diagnosis: the same suite with Playwright-managed `webServer` reached 91/91
  successful workers but hung at `Terminating the WebServer`. A one-test
  reproduction and a direct `taskkill /T /F` probe show the hang is in this
  sandbox's Windows process-tree termination, not in an app test or the HTTP
  server. GitHub Actions run `31338416159` remains green.
- Validation: no source or persisted-data changes; this is additional
  verification evidence only. The prestarted-server path is the authoritative
  local Windows E2E command for this environment.
- Next: keep the physical trusted-HTTPS 3×6 checklist pending until the user
  can collect the current-candidate diagnostic artifact.

## 2026-08-10 — Add an explicit diagnostic-file save path

- RED evidence: a focused Chromium acceptance test could not find the new
  `#fdMatrixDownload` control and timed out before any download event. The
  existing share path was not changed or weakened.
- Changed: settings now expose `端末に直接保存`, which uses the bounded
  diagnostic download transport directly and asks for `保存`. The existing
  Web/native share action remains separate, so choosing a share destination is
  no longer required when the operator needs a local JSON artifact.
- Validation: focused RED→GREEN, full form-diagnostics Chromium `49 passed
(1.3m)`, `npm run check:ui`, `npm run check:form`, lint, format, syntax, and
  `git diff --check` pass. The direct-save test confirms the exact filename,
  privacy-bounded payload, no share call, and a real browser download event.
- Risk: additive settings control and transport helper only; no detector,
  receipt, schema, backup, Service Worker, or existing share behavior changed.
  Physical trusted-HTTPS 3×6 acceptance remains pending until a current JSON
  artifact is collected.
- Handoff: `npm run check:all`, lint, format, syntax, native-web build, and
  form-diagnostics `49/49` passed. Commit `fe5282d8` is pushed to the draft
  PR; GitHub Actions run `31339965041` is `SUCCESS`, and PR #134 is
  `OPEN`/Draft/CLEAN.
- Next: keep the field artifact as the only physical acceptance gap. When the
  user resumes, use `端末に直接保存`, verify the downloaded filename, and run
  `node tools/inspect-form-diagnostic-json.js --from-downloads`.

## 2026-08-10 — Lock the direct-save mobile layout contract

- Changed: the existing 360/390/1280px diagnostic-settings layout check now
  includes the new `端末に直接保存` button in its clipping/overflow guard.
- Validation: the focused three-viewport Chromium checks passed `3/3`; lint,
  format, and `git diff --check` also pass. No production code or persisted
  data changed.
- Risk: test-only coverage; the physical trusted-HTTPS artifact remains the
  only acceptance gap.
- Next: wait for the current-candidate 3×6 JSON, then run the bounded checker
  and record its aggregate result without exposing raw receipt data.

## 2026-08-10 — Lock the explicit download transport seam

- Changed: the Node transport contract now exports and directly exercises
  `downloadFormDiagnosticsJson(...)`, proving that the settings button skips
  Web Share/native negotiation and performs the bounded blob cleanup sequence.
- Validation: `node tools/check-form-diagnostics.js`, `npm run check:form`,
  lint, format, and `git diff --check` pass. No production runtime or
  persisted data changed in this coverage-only task.
- Risk: test-only coverage; physical trusted-HTTPS 3×6 acceptance remains
  pending a current diagnostic artifact.
- Next: continue waiting for the field artifact, then verify the checker output
  against the printed candidate commit/tree.

## 2026-08-10 — Verify the current diagnostic artifact (provisional)

- Evidence: the external `archery-note-form-diagnostics.json` passes
  `node tools/inspect-form-diagnostic-json.js` with schema 1, app version 84,
  matrix `field-3x6`, 9,869 bytes, and SHA-256
  `7452e0bdf3ad87e4735447e024e791da5ef123f2c85642f685ccc9b871c82114`.
- Privacy-safe aggregate: side `6/6` retained from 8 receipts with 2
  auto-canceled and 0 unresolved; oblique `6/6` from 6 with 0 auto-canceled;
  normal_range `6/6` from 6 with 0 auto-canceled. All retained receipts are
  confirmed. Raw JSON remains outside the repository.
- Provisional boundary: the artifact schema has no preview provenance. Final
  acceptance still requires the operator to confirm the helper printed commit
  `85e10538d7374b17a47c7366d19514acbd6f7677` and tree
  `069c5d5aed5e611a7b78bc6a7d5bcbaecd508132`, and that the two side
  auto-canceled receipts did not remove a real shown shot.
- Next: obtain that provenance/visual confirmation, then mark the field result
  accepted or record the concrete discrepancy without changing thresholds from
  aggregate data alone.

## 2026-08-10 — Recover releases after a brief loose-anchor hold

- RED: a synthetic field-shaped sequence with a calibrated draw, five 20ms
  loose-anchor frames (`anchorNorm=0.45`), and an 80ms clear departure produced
  zero releases on the candidate baseline. The same baseline close-anchor or
  direct high-speed path did not exercise this missing route.
- Root cause: the loose camera geometry produced no `closeFrames`, while the
  adaptive path required a continuous 150ms/three-frame hold before creating
  release evidence. A short real anchor therefore had neither a legacy nor an
  adaptive candidate.
- Changed: add a narrow brief-hold evidence path requiring four stable frames
  spanning at least 80ms and a minimum departure speed of 8. The standard
  150ms adaptive gate, close evidence, receipt ownership, cancellation, and
  storage contracts remain unchanged. Brief evidence expires with the existing
  evidence window and is cleared on far invalidation or committed fire.
- Validation: baseline replay of the RED sequence returned `0`; the new test
  returns `1`. `node tools/check-form-core.js`, `npm run check:form`,
  `npm run check:all`, lint, format, syntax checks, and `git diff --check` pass.
- Risk: this is a recall-oriented candidate for short holds in loose camera
  geometry; it still needs a trusted-HTTPS A/B field run including a deliberate
  100ms let-down control before final acceptance. No release threshold was
  lowered globally, and no data/schema/transport changes were made.
- Next: repeat three conditions on the current candidate with a brief anchor,
  a normal hold, and a 100ms let-down control; export the diagnostic artifact
  and inspect release evidence/cancellation counts before changing any further
  thresholds.

## 2026-08-10 — Require sustained departure after the loose-anchor false positive

- Field observation: in the supplied video, frames sampled every 100ms from
  8.8–10.4s keep the draw hand, bow hand, and bow nearly stationary while the
  UI still shows `RELEASE → FOLLOW → DRAWING` and advances the shot count. No
  physical hand departure is visible in those frames.
- RED evidence: the new short-hold replay (five 20ms loose-anchor frames,
  one high-speed `.65` spike, a null pose, then return) failed with
  `expected 0, got 1 (evidence=["adaptive"])`. A 10-frame/200ms loose-anchor
  hold failed the same way after the brief-only guard, proving that the normal
  adaptive route also accepted the transient as a release.
- Root cause: adaptive evidence treated a single boundary-crossing frame as a
  complete departure; the legacy fallback could then expose that gross match
  before the next valid pose. A broad pending gate also suppressed the existing
  far-arrival NB2/tier-1 contract, so the guard must remain limited to the loose
  near-anchor geometry used by the video route.
- Changed: brief and standard adaptive evidence now require two consecutive
  valid departure frames. A pending candidate keeps the first crossing debug
  (including `departDelta=.275`) and sticky anchor timing, suppresses only the
  loose near-anchor legacy fallback, and clears on invalid/far input or commit.
  The candidate scan walks the current departure run to recover a fresh origin;
  existing far-arrival NB2/D’ behavior remains unchanged.
- GREEN evidence: short and long loose-anchor jitter fixtures now return zero
  releases; genuine adaptive/production fixtures include two departure frames,
  explicitly retain the first-crossing `departDelta`, and still produce one
  confirmed six-shot summary. Existing close, NB2, D’, cancellation, and sticky
  anchor checks pass.
- Validation: `node tools/check-form-core.js`, diagnostic/app/globals/storage
  checks, `npm run check:all`, lint, format, syntax, and `git diff --check` all
  pass. No storage schema, receipt ownership, transport, threshold constants,
  or user data were changed.
- Risk: confirmed adaptive releases are delayed by one valid frame by design;
  first-crossing diagnostics remain stable. Trusted-HTTPS field A/B evidence is
  still required to confirm that the video-shaped false-positive path is closed
  without reducing recall.
- Next: review this isolated three-file change, commit/push it, then inspect the
  resulting CI run before the user performs the trusted 3×6 artifact run.

## 2026-08-10 — Record post-push form diagnostics E2E evidence

- Evidence: the prestarted Chromium command
  `tests/e2e/form-diagnostics.spec.js --project=chromium --workers=1`
  completed `49 passed (1.3m)`. The only local harness caveat is the known
  Playwright-managed server teardown delay after the workers finish; no test
  failure occurred.
- Handoff: CI run `31352507219` completed successfully for commit
  `a4177b3d943ae070d2921418e5da54f6f3cc24bd`. The candidate branch
  `codex/form-diagnostic-handoff-release` and its remote ref both resolve to
  that SHA; the worktree is clean.
- Scope: docs-only evidence update. No runtime, detector, storage, receipt,
  transport, threshold, or user-data behavior changed. The trusted-HTTPS field
  A/B artifact remains the only physical acceptance gap.

## 2026-08-10 — Re-audit the downloaded diagnostic artifact

- Evidence: the external Downloads artifact revalidates as schema 1, app
  version 84, matrix `field-3x6`, 9,869 UTF-8 bytes, SHA-256
  `7452e0bdf3ad87e4735447e024e791da5ef123f2c85642f685ccc9b871c82114`.
  Privacy-safe aggregate: side `6/6` from 8 receipts with 2 automatic
  cancellations and 0 unresolved; oblique `6/6` from 6; normal_range `6/6`
  from 6. All retained receipts are confirmed.
- Boundary: schema 1 has no preview provenance, so this valid artifact cannot
  be attributed to the current candidate. The older video report (真横 3/6,
  やや斜め 0/6, 通常設置 3/6) remains a separate, unaccepted result rather
  than being overwritten by this aggregate.
- Required repeat: run the trusted HTTPS 3×6 sequence against preview commit
  `7f8de41e401eb95bcc57166d7d238ca4a68374e9`, tree
  `28c3daa21da1dac3391b7f8848f2ce111b6cb0ba`, then save and re-check the JSON.
  Raw JSON stays outside the repository.
- Scope/risk: docs-only audit record; no app, detector, receipt, storage,
  transport, threshold, or user-data behavior changed. Physical acceptance
  remains pending provenance-bound field evidence.

## 2026-08-10 — Record the full Chromium E2E regression

- Evidence: against current HEAD `1a02d962b041befd572df87551e8fc467734cf83`,
  the prestarted-server command `npm run test:e2e -- --project=chromium
--workers=1` completed `92 passed (2.0m)`. The known Playwright-managed
  server teardown delay remains a harness issue after all workers pass; no
  test failure or app regression was observed.
- Validation: the run covers the full Chromium suite, including the form
  diagnostics flows. The generated local `debug.log` was removed and remains
  untracked; no user JSON or private artifact entered the repository.
- Handoff: this is verification-only documentation. Runtime, detector,
  storage, receipt, transport, threshold, and user-data behavior are unchanged.
  The trusted HTTPS 3×6 artifact with current preview provenance remains the
  only physical acceptance gap.

## 2026-08-10 — Fail fast when the HTTPS preview port is occupied

- RED evidence: `npm run check:pwa` initially failed because the HTTPS helper
  did not expose a required occupied-port marker in its contract.
- Changed: `tools/serve-iphone-https.ps1` now probes the requested listener
  before certificate generation, using `Get-NetTCPConnection` with a
  `TcpClient` fallback and a bound-address reachability check. An occupied
  port fails explicitly, including listener PIDs when available. The PWA
  contract checker now freezes the `Port $Port is already in use` and
  `TcpClient` markers.
- GREEN evidence: `npm run check:pwa`, `npm run check:all`, lint, format,
  syntax, and `git diff --check` pass. A live process occupying port 8743 was
  reproduced and the helper stopped before certificate generation with
  `Port 8743 is already in use`.
- Scope/risk: helper/checker and acceptance documentation only; no app,
  detector, storage, receipt, transport, threshold, or user-data behavior
  changed. The trusted HTTPS 3×6 artifact with current preview provenance is
  still required for physical acceptance.

## 2026-08-10 — Require stable close evidence for direct-drawing releases

- RED evidence: the new synthetic video-shaped sequence (three drawing frames,
  two 20ms close frames, then a high-speed departure) reproduced the reported
  false positive: `node tools/check-form-core.js` failed with `expected 0,
got 1`. The same sequence represented the user report that a forced release
  from drawing caused every shot to react.
- Changed: the legacy close/velocity route now measures the first departure
  from the sticky anchor start and, for the high-drawArm drawing posture,
  requires at least `FORM_PH.ADAPTIVE_BRIEF_HOLD_MIN_MS` (80ms) of close
  evidence. NB/NB2 gap bridges and low-drawArm reviewed traces retain their
  existing contracts. Adaptive release still requires its sustained departure
  confirmation and is not thresholded by this legacy guard.
- GREEN evidence: short 40ms direct-drawing sequence is rejected; an 80ms
  close hold remains detectable; low-FPS, NB2, reviewed oblique replay, core,
  diagnostics, app, storage, UI, PWA, security, dependency, version, lint,
  format, syntax, and diff checks pass.
- Scope/risk: `scripts/46-form-core.js` and its focused core regression fixture
  only; no storage/schema, receipt, transport, service-worker, or user-data
  changes. The guard may delay an ultra-short high-drawArm release, so the
  trusted HTTPS 3×6 field artifact must still be repeated on the current
  candidate before physical acceptance.
- Next: review and push this isolated detector fix, then collect a
  provenance-bound trusted HTTPS 3×6 artifact from the resulting candidate.

## 2026-08-10 — Synchronize field acceptance to the current candidate

- Audit: the acceptance checklist still named older preview commit/tree IDs,
  which could cause a physical run to be attributed to the wrong implementation.
- Changed: the checklist now treats the helper's run-time `Preview Git commit`
  and `Preview Git tree` lines as authoritative instead of hard-coding a
  mutable docs-only handoff commit. No runtime or artifact schema changed.
- Validation: targeted Prettier and `git diff --check` are required before
  committing this documentation-only handoff correction.
- Next: serve exactly this candidate over trusted HTTPS and collect the
  provenance-bound 3×6 JSON; keep the existing unproven artifact provisional.

## 2026-08-10 — Require stable low-drawArm close evidence

- RED evidence: a synthetic direct-drawing sequence with drawArm `110`, three
  setup frames, only two 20ms close frames, and a high-speed departure returned
  one legacy `close` release instead of zero. This reproduces the video-shaped
  false-positive boundary without using the source video or user data.
- Changed: the legacy close/velocity guard now measures the contiguous close
  run immediately before departure. Observed drawArm values at or above `100`
  require the existing 80ms brief-hold minimum; a bounded fallback is retained
  only for five or more close frames. NB2 gap bridges and far-arrival tier-1
  behavior remain explicit exceptions (`NB2_MAX_ARRIVE` and `nullBridged2`).
- GREEN evidence: low-arm direct 40ms and oblique-offset 40ms cases stay at
  `0`; stable 80ms/150ms holds remain `1`; a 15fps stable-close case remains
  `1`; one 15fps close frame, a null gap, and an interrupted non-null jitter
  remain `0`. Existing D' 150ms, NB2 200/300ms, 400ms out-of-scope, far-arrival
  cap/Infinity substitution, and reviewed oblique/scene-cut golden cases all
  retain their expected outcomes.
- Validation: `npm run check:form`, `npm run check:all`, `npm run lint`,
  `npm run format:check`, Node syntax check, and `git diff --check` pass.
- Scope/risk: only `scripts/46-form-core.js` and `tools/check-form-core.js`
  changed for detector/test behavior; no storage, schema, receipt, transport,
  threshold, service-worker, or user-data contract changed. A monotonic
  high-speed departure after an already qualified hold remains a valid release;
  the new jitter regression specifically includes a return to close before
  departure. Physical trusted-HTTPS 3×6 acceptance remains outstanding.
- Next: review the isolated detector diff and push the three-file handoff with
  this ledger entry, then collect provenance-bound field evidence on that
  resulting candidate.
