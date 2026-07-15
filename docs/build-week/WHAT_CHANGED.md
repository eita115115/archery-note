# What Changed

## Before

Git history through `591f41e6` already contained tap scoring, line-cutter handling, history, grouping and physics analysis, sight/equipment records, form tracking, onboarding, local backups, JSON/CSV export, CSP, PWA caching, Node checks, Playwright, and CI.

## Build Week branch

- Added an explainable growth summary derived from existing sessions.
- Added 7/30/90-day analysis filters alongside all-time view.
- Added one-to-three deterministic next-practice suggestions with visible evidence.
- Added clearly fictional demo sessions with a reserved ID prefix and demo-only deletion.
- Added core regression and browser tests for these flows.
- Added submission documents under `docs/build-week/`.

Security, storage, scoring and Service Worker formats were deliberately not rewritten in this slice.

## Commit and files

- Runtime and tests: `b95bfaa1` (`feat: add explainable growth coach dashboard`)
- Primary files: `scripts/45-analysis-core.js`, `scripts/50-record-view.js`, `scripts/70-gear-settings.js`, `style.css`, `tools/check-analysis-core.js`, `tests/e2e/build-week-growth.spec.js`
- Test-contract maintenance: `tools/check-app.js`, `tools/check-ui.js`, `tools/check-pwa-update-flow.js` were made whitespace-tolerant after production files were formatted.
