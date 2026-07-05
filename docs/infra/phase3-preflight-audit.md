# Phase 3 Preflight Audit

## Purpose

This document fixes the Phase 3 integration baseline before any Service Worker,
storage, or `archery-master` integration work begins.

The goal is to protect the submitted and released `archery-note` repository after
the Codex for OSS application. Phase 3 work must preserve the stable public app,
avoid breaking existing local practice data, and make storage and update risks
explicit before implementation starts.

This is not an implementation plan for a single large merge. It is a risk record
for staged integration work.

## Current Storage Contract

The current primary storage key is:

- `archeryNote.v1`

The current safety snapshot key is:

- `archeryNote.snapshots.v1`

No IndexedDB usage was found in the current `archery-note` app code. Storage is
handled through a small synchronous adapter:

- `window.ArcheryNativeStorage`
- `window.ArcheryStorage`
- fallback to `localStorage`

The current normalized database shape is:

- `schema: 3`
- `setups`
- `sightMarks`
- `sessions`
- `trash`
- `settings`
- `active`

Current `settings` fields include:

- `eyeSight`
- `theme`
- `lastBackupAt`
- `activeGuideSeen`

Current session fields include:

- `id`
- `date`
- `setupId`
- `dist`
- `faceD`
- `faceType`
- `perEnd`
- `shaft`
- `sightV`
- `sightH`
- `wx`
- `note`
- `windDir`
- `windSpeed`
- `round`
- `purpose`
- `ends`

Current arrow fields include:

- `x`
- `y`
- `s`
- `X`
- optional `spot`
- optional `no`
- optional `reason`

The `active` session is the in-progress record. Completed sessions are saved
under `sessions`.

## Backup / Restore / Export Behavior

JSON backup and restore operate as whole-database replacement. Before restore or
import, the app writes a safety snapshot to `archeryNote.snapshots.v1`.

`normalizeDb()` repairs the minimum expected shape by restoring missing top-level
arrays, settings defaults, the trash array, and the current schema marker. It
must remain tolerant of old and partially shaped data.

CSV export is derived from `sessions`. The current CSV includes date, equipment,
distance, round, score, grouping, decision quality, personal model, sight values,
conditions, and notes.

Restore compatibility must be preserved before any schema expansion. Any future
storage migration should first prove that JSON backups from the current release
can still be restored safely.

## Current Service Worker / PWA Update Behavior

`sw.js` currently uses a cache name similar to:

- `archery-note-v54`

The precached asset set includes:

- `index.html`
- `style.css`
- `scripts/*.js`
- `manifest.json`
- `icon.svg`
- `apple-touch-icon.png`

The fetch strategy is:

- GET requests only
- network-first
- cache fallback
- navigation fallback to `index.html`

Service Worker registration only runs on:

- HTTPS
- `localhost`
- `127.0.0.1`

The update banner checks `version.json?ts=...` with `cache: "no-store"`. An
update notice is shown when `version.json.v > APP_VER`.

The update banner is suppressed while a recording session is active.

The following release markers must stay aligned:

- `APP_VER`
- `version.json`
- `sw.js` cache name
- `package.json`
- `package-lock.json`

## Destructive-Change Risks

The following changes can break existing user data or create confusing update
states:

- changing `archeryNote.v1` without migration
- changing `archeryNote.snapshots.v1`
- changing the shape of `sessions`
- changing the shape of `setups`
- changing the shape of `sightMarks`
- changing the shape of `trash`
- changing the shape of `settings`
- changing the shape of `active`
- changing `ends`, `cur`, or arrow object shape without compatibility
- making `normalizeDb()` drop unknown or legacy data
- breaking JSON import compatibility
- changing `scoreAt()` semantics in a way that reinterprets old sessions
- mismatching `APP_VER`, `version.json`, `sw.js` cache name, and package versions
- changing Service Worker fetch/cache strategy without staged rollout
- mounting `archery-master` directly onto the same `archeryNote.v1` key

## archery-master Integration Findings

`archery-master` is a technical source, not a direct merge target.

It appears to use the same `archeryNote.v1` key and `schema: 3`. However, it
effectively extends the data model, so the key and schema number look compatible
while the stored meanings differ.

Observed additions include:

- `settings.statsFilter`
- `defaultBowType`
- `defaultEnvironment`
- `purpose: "volume"`
- `pairMode`
- `fieldCourse`
- `formAnalyses`
- OCR / vision-derived data

This is high risk. A direct merge can silently write expanded data into the same
storage key and make rollback or restore behavior unclear.

Direct merge is forbidden until storage contract tests and a migration strategy
exist.

## Candidate Integration Order

Safer candidates:

- scoring options related to `bowType` / `environment`
- read-only statistics aggregation
- decision engine
- badge / round helpers
- stats view read-only parts
- field course design notes

Deferred candidates:

- OCR
- photo vision
- video / live camera
- MediaPipe pose
- `pose_landmarker_lite.task`
- external CDN dependency
- form coaching
- model files
- beta boot
- large Service Worker replacement
- major UI redesign
- KeepAwake or native dependency additions

## Recommended Phase 3 PR Sequence

1. docs-only: preserve this preflight audit
2. test-only: add storage fixtures for current `archeryNote.v1`
3. test-only: add normalize/restore contract tests
4. test-only: add JSON backup/restore/CSV export round-trip tests
5. docs/test-only: specify SW update strategy and version alignment checks
6. design/test: plan `bowType` / `environment` with migration
7. read-only: integrate statistics/analysis logic without changing storage
8. migration: schema expansion with forced backup, rollback, and old-data fixtures
9. feature slices: volume, field course, pair scoring, etc. in separate PRs

## Non-Goals For This Document

- no code changes
- no storage schema changes
- no Service Worker changes
- no `archery-master` merge
- no OCR / pose / AI / model files
- no CI changes
- no package changes
- no UI redesign
