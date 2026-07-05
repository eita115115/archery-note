# Codex Integration Progress

This file is the state ledger for the Archery Note integration work. Keep it
short, current, and honest. Update it after every Codex step.

Primary brief: [integration-plan.md](integration-plan.md)

## Current Status

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

## Last Run Report

- Changed files:
  - `docs/codex/codex-progress.md` (this reconciliation)
  - Five guidance docs committed to `main` on 2026-07-03
- Validation:
  - `git status --short` (in-flight analysis/physics work identified and
    preserved; nothing outside guidance docs staged)
  - `npx prettier --check` on the five guidance docs
  - `git diff --check`
- Next task:
  - Reconcile the Phase Ledger rows and Next Task Detail with the current
    repository state. Docs-only run; no app behavior changes.
