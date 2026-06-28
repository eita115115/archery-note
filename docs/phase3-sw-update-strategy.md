# Phase 3 Service Worker Update Strategy

## Purpose

This document fixes the Service Worker and PWA update strategy before any
`sw.js` implementation work begins.

The goal is to protect existing PWA users while Phase 3 integration work is
planned. Future Service Worker changes must preserve offline startup, avoid
breaking active practice records, and keep update behavior understandable for
users at the shooting range.

This is a docs-only strategy note. It intentionally avoids immediate large
Service Worker replacement.

## Current Behavior

The current Service Worker cache name is:

- `archery-note-v54`

The current precache list is fixed in `sw.js` and includes:

- `index.html`
- `style.css`
- `scripts/00-compat.js`
- `scripts/10-storage-native.js`
- `scripts/20-scoring.js`
- `scripts/30-target-svg.js`
- `scripts/40-analysis-physics.js`
- `scripts/50-record-view.js`
- `scripts/60-history-sight-view.js`
- `scripts/70-gear-settings.js`
- `scripts/90-init.js`
- `manifest.json`
- `icon.svg`
- `apple-touch-icon.png`

The current install handler opens the active cache, adds the fixed asset list,
and then calls `self.skipWaiting()`.

The current activate handler deletes caches whose names do not match the active
cache name, then calls `self.clients.claim()`.

The current fetch handler:

- handles `GET` requests only
- ignores non-HTTP and non-HTTPS URLs
- uses a network-first strategy
- writes successful network responses into the active cache
- falls back to cached responses
- falls back to `index.html` for navigation requests
- uses `ignoreSearch: true` for non-navigation cache fallback

Service Worker registration currently runs only on:

- HTTPS
- `localhost`
- `127.0.0.1`

The app-level update check compares `version.json` with `APP_VER`.

The current update check:

- fetches `version.json?ts=...`
- uses `cache: "no-store"`
- sets `updateAvailable` when `version.json.v > APP_VER`
- shows the update banner only when no recording session is active
- hides the update banner while `db.active` exists
- triggers a user-visible reload flow from `#updBar`

The following version markers must stay aligned whenever a public app version is
released:

- `APP_VER` in `scripts/10-storage-native.js`
- `version.json`
- `sw.js` cache name
- `package.json`
- `package-lock.json`

## Risks

Future Service Worker work can break the app even without changing storage code.
Known risks include:

- cache name mismatch
- `APP_VER`, `version.json`, `sw.js` cache name, and package version mismatch
- stale app shell after deployment
- old JavaScript running with new HTML
- new JavaScript running with old cached app shell data
- offline reload failure
- update banner appearing during active recording
- destructive `skipWaiting()` or `clients.claim()` behavior
- Pages deployment failure due to an incomplete or incorrect asset list
- Service Worker update triggering storage migration at the wrong time
- active session loss caused by reload timing rather than storage logic
- AI, OCR, pose, or model assets being cached before provenance and size rules
  are defined

## Non-Goals

This document does not implement any Service Worker behavior.

Non-goals for this docs-only step:

- no `sw.js` changes
- no version bump
- no cache strategy change
- no package changes
- no CI changes
- no generated asset manifest
- no `archery-master` merge
- no OCR, pose, AI, or model asset cache
- no release
- no tag
- no GitHub Pages update

## Future Target Strategy

Future Service Worker changes should move toward staged and observable updates.
The target strategy is:

- keep an explicit update banner
- avoid automatic destructive activation while a recording session is active
- prefer user-triggered activation for app-shell updates
- preserve offline startup before and after update
- clean old caches only after successful activation
- keep cache cleanup narrow and version-aware
- verify version marker alignment before release
- consider a generated asset manifest only after asset-list tests exist
- consider separate app-shell and runtime caches later
- keep AI, OCR, and pose asset caching out of scope until third-party asset
  provenance and redistribution rules are resolved

The current app already suppresses the update banner while `db.active` exists.
Future implementation work should preserve that user-facing behavior and avoid
introducing a lower-level Service Worker activation path that reloads or replaces
the app shell at the wrong time.

## Proposed PR Sequence

Recommended future PR order:

1. docs-only: preserve Service Worker update strategy
2. test-only: add version marker alignment check
3. test-only: add Service Worker asset list check
4. docs/test: define waiting update behavior
5. implementation: update banner behavior if needed
6. implementation: staged Service Worker activation if needed
7. implementation: generated asset manifest only after tests exist

This order keeps risky implementation work behind visible documentation and
test-only guardrails.

## Acceptance Criteria

Before any future Service Worker implementation PR is merged, the following must
be true:

- offline reload still works
- update banner does not appear during active recording
- version markers are aligned
- stale caches are cleaned safely
- old saved data is not touched by Service Worker update alone
- no storage migration is triggered by Service Worker update alone
- GitHub Pages build remains stable
- existing E2E smoke test passes
- storage contract checker passes
- storage round-trip checker passes
- app check passes
- UI check passes

Service Worker work must not become a hidden storage migration. If a release
needs both Service Worker and storage changes, storage compatibility tests and a
rollback plan should be merged first.
