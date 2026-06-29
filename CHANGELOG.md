# Changelog

## Unreleased

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
