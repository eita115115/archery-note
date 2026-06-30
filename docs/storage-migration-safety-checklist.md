# Storage Migration Safety Checklist

## Purpose

This checklist defines the safety gates to satisfy before implementing any
storage migration in Archery Note.

The goal is to preserve existing `archeryNote.v1` / `schema: 3` data, keep JSON
backup and restore compatible, and avoid coupling migration work to Service
Worker, dependency, or UI changes.

This document is not a migration implementation. It is the review checklist for
future migration PRs.

## Current Safety Devices

Current storage fixtures:

- `tests/fixtures/storage/archery-note-v1-blank.json`
- `tests/fixtures/storage/archery-note-v1-representative.json`
- `tests/fixtures/storage/archery-note-v1-active-session.json`
- `tests/fixtures/storage/archery-note-v1-trash.json`
- `tests/fixtures/storage/archery-note-v1-partial-legacy.json`
- `tests/fixtures/storage/archery-note-v1-dangling-setup.json`
- `tests/fixtures/storage/archery-note-v1-sight-marks-compatibility.json`

Current storage checks:

- `tools/check-storage-contract.js`
- `tools/check-storage-roundtrip.js`
- `npm run check:storage`
- `npm run check:all`

The current checks cover representative data, active sessions, trash restore
targets, partial legacy-like data, dangling setup references, sight marks,
session-side `sightV` / `sightH`, JSON round-trip behavior, CSV export shape, and
restore/import safety snapshots.

## Required Before Migration Implementation

Before any migration code is added, the migration plan must prove these
properties:

- Migration is idempotent.
- Running migration twice on the same data does not corrupt or duplicate data.
- Migration failure does not delete legacy or current data.
- JSON backup, import, export, and restore compatibility are preserved.
- Unknown and legacy fields are not dropped accidentally.
- Dangling `setupId` references are preserved.
- `sightMarks` and session-side `sightV` / `sightH` are preserved.
- `active` sessions are not finalized or moved into `sessions` automatically.
- `trash` entries and restore targets keep their data shape.
- Existing storage keys remain readable.

## Prohibited During Migration Work

Do not combine migration implementation with these changes:

- destructive changes to the existing `localStorage` or IndexedDB keys
- automatic deletion after migration failure
- incompatible JSON backup changes
- destructive import or restore format changes
- bulk deletion of unknown fields
- automatic finalization of an active session
- new persisted derived analysis data
- Service Worker update strategy changes
- dependency additions or package tree changes
- broad UI rewrites
- direct `archery-master` merge
- OCR, pose, AI, or model file additions

## Fixture And Test Checklist

Each migration PR must either reuse the existing fixtures or add a narrow fixture
for any new compatibility case.

Required fixture coverage:

- blank database
- representative database with setups, sight marks, sessions, trash, settings,
  and active state
- active in-progress session
- trash entries for session, sight mark, and setup bundle restore
- partial legacy-like data with unknown fields
- dangling `setupId` in sessions
- dangling `setupId` in sight marks
- setup-missing and setup-unset records
- missing distance records
- missing vertical or horizontal sight values
- session-side `sightV` / `sightH`

Required check coverage:

- `normalizeDb()` preserves the current top-level shape.
- JSON stringify and parse round trips do not lose required data.
- Backup/import safety snapshots are still created before replacement.
- CSV export remains readable and keeps the current header shape.
- Unknown and legacy fields remain compatible with current behavior.
- Migration-specific tests verify idempotency before runtime migration is
  enabled.

## Rollback And Failure Safety

Migration failure handling must be conservative:

- Keep the original data available.
- Write rollback or safety snapshot data before replacing the current database.
- Do not delete legacy data in the same PR that first introduces migration.
- Prefer read-time compatibility over one-way destructive conversion.
- Report failure without hiding or rewriting user records.
- Provide a path to export or restore the last known-good data.

## Backup, Import, And Export Compatibility

Migration work must preserve:

- existing JSON backup readability
- existing JSON restore behavior
- existing import behavior for current `archeryNote.v1` data
- current CSV header and row semantics unless a separate export compatibility PR
  changes them deliberately
- `archeryNote.snapshots.v1` safety snapshot behavior

Any intentional backup or export format change must be a separate PR with its
own fixtures, round-trip tests, and release notes.

## Release Check

Run these checks before releasing any migration-related change:

```powershell
node tools/check-storage-contract.js
node tools/check-storage-roundtrip.js
npm run check:storage
npm run check:version
npm run check:all
npm run format:check
npm run lint
npm run test:e2e
npm audit --omit=dev
```

Expected results:

- `Storage contract checks OK`
- `Storage round-trip checks OK`
- `Version alignment checks OK`
- E2E smoke test passes
- `npm audit --omit=dev` reports 0 vulnerabilities

## Not Yet

Do not start these until migration safety tests and review criteria are ready:

- storage schema expansion
- `localStorage` or IndexedDB key changes
- migration implementation
- destructive cleanup of legacy data
- derived analysis persistence
- Service Worker strategy changes tied to migration
- `archery-master` direct merge
- OCR, pose, AI, or model-file storage integration
