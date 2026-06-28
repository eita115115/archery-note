# Changelog

## Unreleased

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
