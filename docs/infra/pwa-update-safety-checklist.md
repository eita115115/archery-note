# PWA Update Safety Checklist

## Purpose

This checklist defines the safety gates to satisfy before changing Archery
Note's Service Worker update flow, cache cleanup behavior, or PWA reload
behavior.

The goal is to preserve active practice records, keep JSON backup/import/restore
workflows safe, and avoid coupling PWA update behavior to storage migration
work.

This document is not a Service Worker implementation. It is the review checklist
for future PWA update safety PRs.

## Current PWA And Service Worker Flow

Current Service Worker registration lives in `scripts/90-init.js`.

Registration only runs when the page is served from:

- HTTPS
- `localhost`
- `127.0.0.1`

The app-level update check also lives in `scripts/90-init.js`.

Current update detection:

- fetches `version.json?ts=...`
- uses `cache: "no-store"`
- compares `version.json.v` with `APP_VER`
- sets `updateAvailable` when `version.json.v > APP_VER`
- shows the update banner only when no active recording session exists
- hides the update banner while `db.active` exists

When the update banner is clicked, the current flow:

- changes the banner text to an updating state
- asks existing Service Worker registrations to `update()`
- reloads with an `appv` query parameter
- uses `location.replace()` for the reload

## Current Cache And Fetch Behavior

Current Service Worker behavior lives in `sw.js`.

Current cache marker:

- `archery-note-v60`

Current precache entries are hand-written through `ASSETS` and include:

- `./index.html`
- `./style.css`
- all app scripts listed in `APP_SCRIPTS`
- `./manifest.json`
- `./icon.svg`
- `./apple-touch-icon.png`

Current install behavior:

- opens the active `CACHE`
- precaches `ASSETS`
- calls `self.skipWaiting()`

Current activate behavior:

- lists all cache names
- deletes every cache whose name is not the active `CACHE`
- calls `self.clients.claim()`

Current fetch behavior:

- handles `GET` requests only
- ignores non-HTTP and non-HTTPS URLs
- uses network-first fetch behavior
- writes successful network responses into the active cache
- falls back to `./index.html` for navigation requests
- falls back to cached responses for non-navigation requests with
  `ignoreSearch: true`

## Active Session Safety

Future PWA update work must preserve these rules:

- Do not show the update banner while `db.active` exists.
- Do not automatically reload while `db.active` exists.
- Do not introduce a lower-level Service Worker path that reloads or replaces
  the app shell during an active recording session.
- Do not finalize, move, or rewrite an active session during PWA update work.
- Flush pending safety snapshots before any user-triggered reload path.
- Keep active-session protection separate from storage migration work.

The current UI-level update banner suppression is not the same as complete
Service Worker lifecycle isolation. Future work must review `skipWaiting()` and
`clients.claim()` behavior before changing activation timing.

## Backup, Import, And Restore Safety

Future PWA update work must preserve these rules:

- Do not prompt for reload during backup export, import, restore, or trash
  restore flows.
- Do not automatically reload during backup export, import, restore, or trash
  restore flows.
- Do not change JSON backup format in the same PR as Service Worker update
  behavior.
- Do not change import or restore behavior in the same PR as Service Worker
  update behavior.
- Do not change storage migration behavior in the same PR as Service Worker
  update behavior.
- Keep `archeryNote.v1` and `archeryNote.snapshots.v1` behavior under the
  storage contract checks.

Any future reload prompt should be visibly user-triggered and should avoid
interrupting data replacement workflows.

## Version Marker Alignment

The following markers must stay aligned for public app releases:

- `APP_VER` in `scripts/10-storage-native.js`
- `version.json.v`
- `sw.js` cache marker
- `package.json.version`
- `package-lock.json.version`
- `package-lock.json.packages[""].version`

The current check is:

- `tools/check-version-alignment.js`
- `npm run check:version`
- `npm run check:all`

Future PWA work should not weaken this check. If new update metadata is added,
it must be covered by a check before release.

## Cache Cleanup Safety

Future cache cleanup changes must preserve these rules:

- Delete only Archery Note managed caches.
- Keep cleanup version-aware and narrow.
- Do not delete unrelated origin caches by default.
- Do not expand cleanup scope in the same PR as storage migration.
- Do not expand cleanup scope in the same PR as backup/import/export changes.
- Prove offline reload still works after cleanup.

The current cleanup deletes every cache whose name is not the active `CACHE`.
Before changing runtime behavior, document the intended cache ownership rule and
add a small check or test for it.

## Fetch And Cache Scope Safety

Future fetch/cache changes must preserve these rules:

- Keep non-GET requests outside Service Worker cache handling.
- Keep non-HTTP and non-HTTPS URLs outside Service Worker cache handling.
- Avoid caching arbitrary unrelated GET responses.
- Keep navigation fallback to the app shell explicit.
- Keep app-shell assets distinct from future runtime or large asset caches.
- Do not add OCR, pose, AI, or model files to cache scope until provenance,
  size, and redistribution rules are documented.

The current fetch handler is broad for HTTP/HTTPS GET requests. Narrowing the
runtime cache scope should happen in a dedicated PR after checklist and checker
coverage exist.

## Implementation Requirements

Before changing `sw.js`, update flow, or reload behavior, the PR must state:

- whether active sessions can see an update prompt
- whether any path can reload automatically
- what cache names are owned by Archery Note
- what request types can be cached
- how offline reload was checked
- how version marker alignment was checked
- whether backup/import/restore behavior was touched
- whether storage migration behavior was touched

## Prohibited During PWA Update Work

Do not combine PWA update implementation with these changes:

- automatic reload during an active session
- automatic reload during import or restore
- storage migration implementation
- storage schema changes
- new persisted fields
- `localStorage` or IndexedDB key changes
- backup/import/export format changes
- dependency additions
- CI workflow changes
- broader Service Worker cache cleanup
- large `ASSETS` changes plus update-flow changes
- direct `archery-master` merge
- OCR, pose, AI, or model file additions

## Follow-Up PR Candidates

Recommended order for future PWA update safety work:

1. `test(pwa): add service worker version marker checks`
2. `test(pwa): add service worker asset list check`
3. `refactor(sw): narrow cache cleanup behavior`
4. `chore(pwa): prepare manifest-driven cache list`
5. `feat(pwa): add safer update notification flow`

These are candidates, not implemented behavior. Implementation PRs should stay
small and should not combine Service Worker lifecycle changes with storage
migration or backup/import/export changes.

## Release Check

Run these checks before releasing any PWA update safety change:

```powershell
node tools/check-version-alignment.js
node tools/check-storage-contract.js
node tools/check-storage-roundtrip.js
npm run check:version
npm run check:storage
npm run check:all
npm run format:check
npm run lint
npm run test:e2e
npm audit --omit=dev
```

Expected results:

- `Version alignment checks OK`
- `Storage contract checks OK`
- `Storage round-trip checks OK`
- E2E smoke test passes
- `npm audit --omit=dev` reports 0 vulnerabilities

## Not Yet

Do not start these until checklist and checker coverage are in place:

- staged Service Worker activation changes
- `skipWaiting()` or `clients.claim()` behavior changes
- cache cleanup behavior changes
- manifest-driven cache generation
- waiting Service Worker update UI changes
- storage migration implementation
- backup/import/export format changes
- `archery-master` direct merge
- OCR, pose, AI, or model asset caching
