# Changelog

## Unreleased

## v0.11.0-active-workflow-guard - 2026-07-02

### Summary

Closes the busy-guard gap left open by `v0.10.0-safer-update-flow`. The update banner and update reload path are now suppressed while a backup, export, import, restore, or trash-restore workflow is in progress, in addition to the existing active-session guard.

### Added

- Runtime-only active-workflow busy guard: `activeWorkflowCount`, `beginActiveWorkflow()`, `endActiveWorkflow()` in `scripts/90-init.js`
- Static checks in `tools/check-pwa-update-flow.js` for the new guard functions and for each guarded call site

### Changed

- `isUpdateReloadBlocked()` now returns true while `db.active` exists or `activeWorkflowCount>0`
- Backup/JSON export, CSV export, import, snapshot restore, and trash restore now call `beginActiveWorkflow()` / `endActiveWorkflow()` around their work
- `docs/pwa-safer-update-notification-flow.md` updated to describe the implemented guard and mark the busy-guard gap closed
- Bump app/package version markers to `63` / `0.63.0`

### Validation

- `node tools/check-version-alignment.js`
- `node tools/check-pwa-update-flow.js`
- `node tools/check-pwa-assets.js`
- `node tools/check-storage-contract.js`
- `node tools/check-storage-roundtrip.js`
- `npm run check:app`
- `npm run check:ui`
- `npm run check:pwa`
- `npm run check:version`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities
- Manual browser check: backup export click hides the update banner while the share/download is in flight and restores it once settled, with no console errors

### Not Changed

- No storage schema change, no new persisted fields (the busy flag is an in-memory counter only)
- No backup/import/export/CSV format change
- No Service Worker strategy change (`skipWaiting()`, `clients.claim()`, fetch strategy, `ASSETS`, cache marker format all untouched beyond the version-number bump)
- No waiting-worker or `controllerchange` UI
- No storage migration implementation
- No runtime app UI changes outside the update-banner suppression behavior
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

The busy guard is intentionally runtime-only (an in-memory counter, not persisted). A future storage migration implementation may reuse `beginActiveWorkflow()` / `endActiveWorkflow()` around its own work.

## v0.10.0-safer-update-flow - 2026-07-01

### Summary

Safer update flow release for Archery Note. This release documents the target update notification behavior, adds static checks for the current PWA update flow, and suppresses update prompts/reloads while an active session is present.

### Added

- Safer update notification flow documentation
- PWA update flow static checks
- Static checks for `version.json` no-store fetching, `APP_VER` comparison,
  `db.active` guarding, `registration.update()`, and `location.replace()` with
  `appv`
- Static checks that `controllerchange` / waiting-worker flow has not been
  introduced yet
- Static checks that `skipWaiting()` / `clients.claim()` remain present for the
  current release line

### Changed

- Centralize update reload blocking with `isUpdateReloadBlocked()`
- Keep update bar visibility gated by active workflow state
- Re-check update reload safety in the update click path before
  `registration.update()` or reload
- Prevent unsafe update clicks from reaching `registration.update()` or
  `location.replace()`
- Call `flushSafetySnapshot()` before the update reload path
- Bump app/package version markers to `62` / `0.62.0`

### Validation

- `node tools/check-version-alignment.js`
- `node tools/check-pwa-update-flow.js`
- `node tools/check-pwa-assets.js`
- `node tools/check-storage-contract.js`
- `node tools/check-storage-roundtrip.js`
- `npm run check:version`
- `npm run check:pwa`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No Service Worker implementation changes
- No `skipWaiting()` behavior change
- No `clients.claim()` behavior change
- No fetch strategy change
- No `ASSETS` change
- No cache cleanup logic change
- No waiting-worker update flow
- No `controllerchange` update UI
- No storage migration implementation
- No storage schema change
- No new persisted fields
- No localStorage or IndexedDB key changes
- No backup/import/export format change
- No runtime app UI changes
- No Analysis or History UI changes
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release keeps the existing PWA update mechanism but makes the reload path safer. The update prompt remains suppressed during active sessions, and update clicks now re-check safety before proceeding. Backup/export/import/restore-specific busy guards are not implemented in this release because there is no dedicated busy state yet.

## v0.9.0-pwa-update-safety - 2026-07-01

### Summary

PWA update safety release for Archery Note. This release documents PWA update safety requirements, strengthens Service Worker version and asset checks, and narrows cache cleanup behavior before changing the update notification flow.

### Added

- PWA update safety checklist documentation
- Service Worker version marker checks for package version, `APP_VER`, `version.json.v`, and `archery-note-vXX` cache marker alignment
- PWA asset list check for the hand-written Service Worker `ASSETS` list
- `npm run check:pwa`
- `check:pwa` integration into `check:all`
- Static guard for Archery Note cache prefix cleanup behavior

### Changed

- Narrow Service Worker activate-time cache cleanup to Archery Note-managed caches only
- Preserve unrelated caches during Service Worker activation
- Bump app/package version markers to `61` / `0.61.0`

### Validation

- `node tools/check-version-alignment.js`
- `node tools/check-pwa-assets.js`
- `node tools/check-storage-contract.js`
- `node tools/check-storage-roundtrip.js`
- `npm run check:version`
- `npm run check:pwa`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No PWA update notification flow change
- No `skipWaiting()` behavior change
- No `clients.claim()` behavior change
- No fetch strategy change
- No `ASSETS` change
- No storage migration implementation
- No storage schema change
- No new persisted fields
- No localStorage or IndexedDB key changes
- No backup/import/export format change
- No runtime app UI changes
- No Analysis or History UI changes
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release prepares the project for safer future PWA update changes. It does not change the update notification flow yet. The main runtime behavior change is limited to narrowing Service Worker cache cleanup so only Archery Note-managed caches are deleted during activation.

## v0.8.0-storage-migration-safety - 2026-07-01

### Summary

Storage migration safety release for Archery Note. This release strengthens
storage fixtures, round-trip checks, and migration readiness documentation
before implementing any storage migration.

### Added

- Storage fixture for sessions with dangling `setupId` references
- Storage fixture for `sightMarks` compatibility, including dangling setup
  references, missing distance, missing sight values, and session-side `sightV`
  / `sightH`
- Storage migration safety checklist documentation
- Normalize idempotency check across storage fixtures

### Changed

- Strengthen storage contract validation around dangling setup references
- Strengthen storage round-trip validation for sight marks and session sight
  values
- Bump app/package version markers to `60` / `0.60.0`

### Validation

- `node tools/check-version-alignment.js`
- `node tools/check-storage-contract.js`
- `node tools/check-storage-roundtrip.js`
- `npm run check:version`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No storage migration implementation
- No storage schema change
- No new persisted fields
- No localStorage or IndexedDB key changes
- No backup/import/export format change
- No runtime app code changes
- No Analysis or History UI changes
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release prepares the project for future storage migration work. It does
not implement migration behavior yet. The goal is to make future migration
changes safer by preserving existing data shapes, dangling references, sight
mark data, legacy fields, active sessions, and trash/restore behavior.

## v0.7.0-read-only-performance-summaries - 2026-06-30

### Summary

Read-only performance summaries release for Archery Note. This release adds
setup performance and sight history summaries to the Analysis view using
existing saved data only.

### Added

- Read-only `セットアップ別成績` card in the Analysis view
- Setup-based performance summary with record count, arrow count, average score,
  best total, and latest record date
- Read-only `サイト履歴` card in the Analysis view
- Recent sight history display with date, distance, vertical sight, horizontal
  sight, setup name, and source
- Safe handling for missing setup, deleted setup references, missing distance,
  and missing sight values

### Changed

- Continue separating History and Analysis responsibilities
- Keep History focused on lightweight record summary and practice history
- Keep Analysis focused on trend and performance summary reading
- Bump app/package version markers to `59` / `0.59.0`

### Validation

- `node tools/check-version-alignment.js`
- `npm run check:version`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No storage schema change
- No migration
- No new persisted fields
- No backup/import/export format change
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No docs other than this changelog entry
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

These summaries are read-only and use existing saved sessions, setup data, and
sight mark data only. They do not save derived analysis data or change
import/export compatibility.

## v0.6.0-read-only-score-trend - 2026-06-29

### Summary

Read-only score trend release for Archery Note. This release separates History
and Analysis responsibilities further and adds a small score trend card to the
Analysis view using existing saved session data only.

### Added

- Read-only `スコア推移` card in the Analysis view
- Recent saved-session trend display with date, average score, total score,
  distance, and arrow count
- Missing-distance handling as `距離未設定`

### Changed

- Move detailed distance, sight, and grouping summaries from History to Analysis
- Keep History focused on lightweight record summary and practice history
- Keep Analysis focused on trend and summary reading
- Bump app/package version markers to `58` / `0.58.0`

### Validation

- `node tools/check-version-alignment.js`
- `npm run check:version`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No storage schema change
- No migration
- No new persisted fields
- No backup/import/export format change
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No docs other than this changelog entry
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

The score trend is read-only and uses existing saved sessions only. It does not
save derived analysis data or change import/export compatibility.

## v0.5.0-analysis-view-baseline - 2026-06-29

### Summary

Analysis view baseline for Archery Note. This release introduces the first
dedicated Analysis view for read-only analysis navigation while preserving the
existing saved data format.

### Added

- Dedicated Analysis tab and view shell
- Analysis entry point in the bottom navigation
- App version marker bump to `57` / `0.57.0`

### Changed

- Move existing lower History analysis cards into the Analysis view:
  - Grouping trend
  - Distance average score trend
  - Score distribution
  - Monthly summary
- Keep History focused on practice summaries and the practice history list
- Update UI smoke checks for the five-tab bottom navigation

### Validation

- `npm run check:app`
- `npm run check:ui`
- `npm run check:storage`
- `npm run check:version`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No score trend addition
- No new analysis calculation
- No storage schema change
- No migration
- No new persisted fields
- No backup/import/export format change
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release is the first baseline for separating analysis from the History
screen. Future work should continue to add analysis features in small read-only
steps before any persisted data changes.

## v0.4.1-history-analysis-ui - 2026-06-29

### Summary

History analysis UI organization release. This release makes the read-only
analysis summaries added in `v0.4.0-read-only-analysis-baseline` easier to scan,
especially on mobile, without changing the saved data format.

### Changed

- Keep the main record/session summary visible in the initial History view
- Move distance, sight, and grouping summary details into a more
  compact/collapsible presentation
- Preserve existing read-only analysis values while reducing the amount of
  detail shown before the main practice history
- Align missing distance display around `距離未設定`
- Bump app version markers to `56` / `0.56.0`

### Validation

- `npm run check:app`
- `npm run check:ui`
- `npm run check:storage`
- `npm run check:version`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No new analysis feature
- No score trend addition
- No Analysis tab or subview
- No storage schema change
- No migration
- No new persisted fields
- No backup/import/export format change
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release is a small UI organization release after the read-only analysis
baseline. Future analysis work should decide whether to continue inside History
or move toward a dedicated Analysis tab/subview.

## v0.4.0-read-only-analysis-baseline - 2026-06-29

### Summary

Read-only analysis baseline for Archery Note. This release adds visible analysis
summaries based on existing session, distance, sight, and grouping data without
changing the saved data format.

### Added

- Read-only record/session summary
- Read-only distance summary
- Read-only sight summary
- Read-only grouping summary based on existing safe RMS values
- Viewport zoom policy documentation
- App version marker bump to `55` / `0.55.0`

### Analysis Details

- Session summary includes session count, arrow count, average score, latest
  record, and best total where safely available
- Distance summary includes distance, session count, arrow count, average score,
  best total, and latest record date
- Sight summary includes sight mark counts, practice sight value counts, latest
  sight values by distance, update date, vertical/horizontal sight values, and
  setup context where safely available
- Grouping summary includes target session count, average RMS, best RMS, latest
  RMS, and distance-level average RMS where safely available
- Missing or invalid distance values are grouped as `距離未設定`
- Missing or invalid values are safely displayed as `—`
- NaN and Infinity are guarded against

### Validation

- `npm run check:app`
- `npm run check:ui`
- `npm run check:storage`
- `npm run check:version`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No storage schema change
- No migration
- No new persisted fields
- No backup/import/export format change
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release is the first visible read-only analysis baseline after the Phase 3
safety baseline. Future analysis work should continue to be split into small PRs
and should avoid persisted data changes unless covered by explicit migration
tests.

## v0.3.0-phase3-safety-baseline - 2026-06-28

### Summary

Phase 3 safety baseline for Archery Note. This release adds documentation and
automated checks that protect storage compatibility, backup/restore behavior,
CSV export behavior, and release/version marker alignment before future Service
Worker, storage migration, or archery-master integration work.

### Added

- Service Worker update strategy documentation
- Read-only analysis integration plan
- Storage contract fixtures for the current `archeryNote.v1` / `schema: 3`
- Storage contract checker
- Storage backup/restore/CSV round-trip checker
- Version marker alignment checker
- `check:storage`
- `check:version`
- `check:all` now runs app, UI, storage, and version checks

### Validation

- `npm run check:version`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No storage schema change
- No Service Worker runtime change
- No app UI behavior change
- No version bump
- No package-lock change
- No archery-master merge
- No OCR / pose / AI / model files

### Notes For Future Integration

Future Service Worker, storage migration, analysis, or archery-master integration
work should build on these checks and remain split into small PRs.

## v0.2.0-quality-baseline - 2026-06-28

### Added

- README screenshots and asset provenance checks
- Local lint and format scripts:
  - `npm run lint`
  - `npm run format:check`
- Minimal Playwright smoke test with `npm run test:e2e`
- CI quality gates for:
  - `npm run check:app`
  - `npm run check:ui`
  - `npm run lint`
  - `npm run format:check`
  - `npm run test:e2e`
- Local Lighthouse baseline script with `npm run lighthouse:baseline`

### Baseline

- Current Lighthouse baseline:
  - Performance: 0.97
  - Accessibility: 0.93
  - Best Practices: 1.00
  - SEO: 1.00
  - PWA: n/a
- `npm audit --omit=dev`: 0 vulnerabilities
- Dev dependency audit warnings are known and limited to devDependencies.

### Not Changed

- No Service Worker update strategy change
- No storage migration
- No existing saved-data format change
- No archery-master integration
- No OCR, pose, AI, or model file changes

### Added

- Apache-2.0 license
- Community health files
- Minimal CI workflow
- Codex for OSS maintenance plan
- Third-party notices

### Changed

- README reorganized for public OSS users and contributors
- Viewport updated to allow browser zoom

### Fixed

- Accessibility checks reject zoom-disabling viewport settings
