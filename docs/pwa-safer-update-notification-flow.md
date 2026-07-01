# Safer PWA Update Notification Flow

## Purpose

This document defines the target behavior for safer PWA update notification and
reload handling before changing the implementation.

The goal is to keep app updates user-triggered, avoid interrupting active
practice or data replacement workflows, and keep PWA update work separate from
storage migration work.

This is a docs-only step. It does not change the current update notification
flow, Service Worker lifecycle, storage behavior, or runtime UI.

## Current Update Notification Flow

The current app-level update flow lives in `scripts/90-init.js`.

Current behavior:

- registers `sw.js` only on HTTPS, `localhost`, or `127.0.0.1`
- fetches `version.json?ts=...` with `cache: "no-store"`
- compares `version.json.v` with `APP_VER`
- sets `updateAvailable` when `version.json.v > APP_VER`
- shows the update banner when `updateAvailable && !db.active`
- hides the update banner while `db.active` exists
- changes the update banner text to an updating state when clicked
- calls `registration.update()` for existing Service Worker registrations
- reloads with an `appv=Date.now()` query parameter
- uses `location.replace()` for the reload

Current page lifecycle safety:

- `visibilitychange` flushes pending safety snapshots when the document becomes
  hidden
- `visibilitychange` runs the update check when the document becomes visible
- `pagehide` flushes pending safety snapshots

Current Service Worker lifecycle:

- `sw.js` calls `self.skipWaiting()` during install
- `sw.js` calls `self.clients.claim()` during activate
- `controllerchange`, waiting-worker UI, and `SKIP_WAITING` message handling are
  not currently used

## Current Safety Devices

Current safety guardrails:

- update checks use `cache: "no-store"` for `version.json`
- the update banner is hidden while `db.active` exists
- pending safety snapshots are flushed on page hide paths
- version markers are checked by `tools/check-version-alignment.js`
- PWA asset and cache cleanup checks are covered by
  `tools/check-pwa-assets.js`
- storage contract and round-trip checks cover active sessions, snapshots,
  restore, import, CSV export, dangling setup references, and sight mark
  compatibility
- Service Worker cache cleanup is limited to Archery Note managed cache names
  with the `archery-note-v` prefix

## Current Gaps

The current behavior is usable, but these gaps should be closed before deeper
PWA update changes:

- update banner visibility depends on the `db.active` state when
  `syncUpdateBarVisibility()` runs
- the update click path does not yet perform a final safety re-check before
  reload
- backup, export, import, and restore workflows do not yet have a dedicated
  busy guard for update notification suppression
- update notification flow changes and storage migration changes would be hard
  to debug if shipped in the same PR
- `skipWaiting()` and `clients.claim()` are immediate-control behavior and
  should remain unchanged during the v0.10 safer notification work

## Target Behavior

Future implementation should move toward this behavior:

- do not show the update banner while an active workflow is running
- do not automatically reload while an active workflow is running
- do not reload from the update banner click path while an active workflow is
  running
- perform a final safety-state check immediately before any update-triggered
  reload
- flush pending safety snapshots before any user-triggered update reload
- suppress update notification and reload during backup, export, import, and
  restore workflows
- keep update notification flow changes separate from storage migration changes
- do not change `skipWaiting()` or `clients.claim()` in the v0.10 safer update
  notification work
- defer waiting-worker and `controllerchange` UI decisions until a separate
  checkpoint

These are target requirements, not implemented behavior.

## Active Workflow Definition

Future implementation should treat these as active workflows:

- active session: `db.active` exists
- backup or JSON export in progress
- CSV export in progress
- import in progress
- restore from safety snapshot in progress
- trash restore in progress
- future storage migration in progress

The current runtime does not have a dedicated busy flag for all of these
workflows. A future implementation may add a small active-workflow guard, but it
must not change storage schema or persisted data format.

## Update Banner Display Rules

Future update banner visibility should satisfy all of these conditions:

- an update is available
- no active session exists
- no active backup, export, import, restore, trash restore, or migration
  workflow is running
- the page is in a state where a user-triggered reload would not interrupt data
  replacement or active scoring

The `db.active` guard must remain. If a broader active-workflow guard is added,
it should include `db.active` rather than replacing it.

## Update Banner Click Rules

Before an update banner click is allowed to reload the page, the app should:

- re-check that no active workflow is running
- re-check that the update banner is still valid for the current app state
- flush any pending safety snapshot
- avoid changing backup, import, export, or storage migration behavior
- reload only from an explicit user action

If the safety re-check fails, the app should hide or defer the update prompt and
avoid reload.

## Active Session Policy

PWA update work must preserve active session data:

- never auto-reload during an active session
- never prompt for update reload during an active session
- never finalize, delete, migrate, or rewrite `db.active` as part of update
  notification work
- keep active-session safety independent from Service Worker lifecycle changes
- keep active-session safety independent from storage migration work

## Backup, Export, Import, And Restore Policy

PWA update work must preserve data replacement workflows:

- do not auto-reload during backup, export, import, restore, or trash restore
- do not prompt for update reload during backup, export, import, restore, or
  trash restore
- do not change JSON backup format in the same PR as update notification flow
- do not change CSV export format in the same PR as update notification flow
- do not change import or restore behavior in the same PR as update
  notification flow
- do not change storage migration behavior in the same PR as update
  notification flow

Any future busy guard should be runtime-only unless a separate storage design
explicitly approves persisted state.

## `skipWaiting()` And `clients.claim()`

The v0.10 safer update notification work should not change:

- install-time `self.skipWaiting()`
- activate-time `self.clients.claim()`
- fetch strategy
- `ASSETS`
- cache marker format

Those lifecycle choices remain risks because they are immediate-control
behavior. Revisit them only after update notification behavior has a static
check and a small runtime guard.

## Static Check Candidates

The next test PR should consider static checks for these constraints:

- `version.json` is fetched with `cache: "no-store"`
- update banner display remains gated by `db.active` or a broader active
  workflow guard
- update click path performs a safety re-check before reload
- `location.replace()` and `location.reload()` usage remains easy to audit
- `controllerchange` and waiting-worker flow are not introduced accidentally
- `skipWaiting()` and `clients.claim()` are not changed during v0.10 work

These are candidates for `test(pwa): add update flow static checks`. This
document does not implement those checks.

## Follow-Up PR Candidates

Recommended next steps:

1. `test(pwa): add update flow static checks`
2. `refactor(pwa): suppress update prompt during active workflows`
3. checkpoint: decide whether to add waiting-worker flow
4. checkpoint: decide whether to revisit `skipWaiting()` / `clients.claim()`

Implementation PRs should stay small and should not mix update notification
flow with storage migration or backup/import/export format changes.

## Prohibited During Safer Update Flow Work

Do not combine safer update notification work with:

- automatic reload during an active session
- automatic reload during backup, export, import, or restore
- storage migration implementation
- storage schema changes
- new persisted fields
- `localStorage` or IndexedDB key changes
- backup/import/export format changes
- `skipWaiting()` changes
- `clients.claim()` changes
- fetch strategy changes
- `ASSETS` changes
- cache marker changes
- version bump in the same PR as implementation changes
- dependency additions
- CI workflow changes
- direct `archery-master` merge
- OCR, pose, AI, or model file additions

## Release Check

Run these checks before releasing safer update notification changes:

```powershell
node tools/check-pwa-assets.js
node tools/check-version-alignment.js
node tools/check-storage-contract.js
node tools/check-storage-roundtrip.js
npm run check:pwa
npm run check:version
npm run check:storage
npm run check:all
npm run format:check
npm run lint
npm run test:e2e
npm audit --omit=dev
```

Expected results:

- `PWA asset checks OK`
- `Version alignment checks OK`
- `Storage contract checks OK`
- `Storage round-trip checks OK`
- E2E smoke test passes
- `npm audit --omit=dev` reports 0 vulnerabilities

## Not Yet

Do not start these in this docs-only PR:

- update notification flow implementation changes
- waiting-worker UI
- `controllerchange` UI
- removing or delaying `skipWaiting()`
- removing or delaying `clients.claim()`
- storage migration implementation
- backup/import/export format changes
- runtime UI redesign
- version bump
- tag or GitHub Release
