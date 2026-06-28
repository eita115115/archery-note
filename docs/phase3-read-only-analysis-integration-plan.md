# Phase 3 Read-Only Analysis Integration Plan

## Purpose

This document defines how analysis, statistics, and decision-support ideas from
`archery-master` can be evaluated for future `archery-note` integration without
changing the current storage contract.

The goal is to keep Phase 3 safe for existing users. Before any storage
migration exists, integration must stay read-only and use only values that can be
derived from existing session, setup, sight mark, trash, settings, and active
record data.

This plan intentionally preserves:

- `archeryNote.v1`
- `schema: 3`
- the current `sessions`, `setups`, `sightMarks`, `trash`, `settings`, and
  `active` shapes
- the current JSON backup / restore behavior
- the current CSV export behavior

`archery-master` is a technical reference, not a direct merge source.

## Current Analysis Surface In Archery Note

Current `archery-note` already includes several analysis and decision-support
surfaces that read from the existing database shape.

Current scoring and grouping helpers include:

- `scoreAt()`
- `hitFromGlobal()`
- `groupStats()`
- `robustStats()`
- line-cutter-aware score calculation
- field face and triple face handling

Current sight, physics, and decision helpers include:

- `sightTrend()`
- `trajectoryModel()`
- `physicsProfile()`
- `windModel()`
- `regressionAdvice()`
- `adviceFor()`
- `judgementFor()`
- `nextActionPlan()`
- `conditionHtml()`

Current data-quality and personal-model helpers include:

- `sessionQuality()`
- `personalModel()`
- `personalPhysicsCalibration()`
- `calibrationProfile()`
- `modelReadinessProfile()`
- `gearPrecisionProfile()`

Current history and sight views already calculate read-only summaries from
existing records:

- history filters by setup, distance, and round
- history overview metrics
- grouping trend cards
- distance trend cards
- score distribution cards
- monthly summaries
- sight mark prediction
- weighted sight regression
- latest mark lookup
- session detail analysis

Current export behavior already exposes derived analysis values without writing
new persistent fields:

- `sessionsCsv()`
- decision quality in CSV
- personal model state in CSV
- grouping center and spread in CSV
- sight values in CSV
- condition and note text in CSV

Current record and gear surfaces also provide read-only analysis context:

- record readiness summary
- setup system summary
- active-session score and end summaries
- setup comparison
- gear precision profile
- spine guidance
- backup reminder

These surfaces are the safest base for Phase 3 because they already operate on
the current `archeryNote.v1` data model.

## Safe Read-Only Candidates

The following candidates can be evaluated without changing storage, as long as
they only compute values at render time or inside local checks.

Safer candidates from current `archery-note` and `archery-master` include:

- session summary cards
- distance-based score summary
- grouping trend summary
- sight value trend summary
- condition and wind summary
- decision quality summary
- personal model summary
- round label and round helper extraction
- badge and label helpers that do not persist progress
- stats overview cards
- score histogram
- moving average score trend
- distance bar data
- period comparison when the filter is in memory only
- latest scored session detection excluding non-scored sessions
- read-only analysis landing card
- read-only "next action" display based on existing `adviceFor()` and
  `judgementFor()`

If any `archery-master` helper is considered later, it should first be copied as
an isolated pure calculation or rewritten against the current `archery-note`
shape. It must not bring storage writes, persistent filters, new session fields,
or UI router assumptions with it.

## Unsafe Or Delayed Candidates

The following candidates should be delayed until storage contract tests,
round-trip checks, migration design, and rollback strategy are public and
passing.

Storage-expanding candidates:

- storage schema changes
- new `bowType` persistence
- new `environment` persistence
- `defaultBowType`
- `defaultEnvironment`
- `settings.statsFilter`
- `purpose: "volume"`
- pair scoring
- team scoring
- field course data
- `fieldCourse`
- `fieldCourseId`
- `formAnalyses`
- form precision run history
- AI-derived fields
- OCR-derived fields
- vision-derived fields

Feature areas to delay:

- OCR
- photo vision
- video or live camera
- MediaPipe pose
- model files such as `pose_landmarker_lite.task`
- external CDN dependencies
- offline AI asset preparation
- native dependency additions
- large UI redesign
- direct stats tab transplant
- direct analysis tab transplant
- direct `archery-master` router transplant
- direct Service Worker replacement

Even if a candidate looks read-only in the UI, it must be delayed if it depends
on new persistent fields or changes the interpretation of existing sessions.

## Data Contract Constraints

Future read-only analysis work must follow these constraints:

- do not change `archeryNote.v1`
- do not change `schema: 3`
- do not change the shape of `sessions`
- do not change the shape of `setups`
- do not change the shape of `sightMarks`
- do not change the shape of `trash`
- do not change the shape of `settings`
- do not change the shape of `active`
- do not require unknown fields to exist
- do not treat unknown fields as stable app contract
- do not persist derived analysis values to the database
- keep derived values in view state, local variables, or direct render output
- do not add new persistent fields without a migration
- do not reinterpret old sessions through new scoring semantics without tests
- do not change JSON backup / restore behavior
- do not change CSV export behavior unless a CSV contract test is updated first

Unknown fields may exist in user data or future fixtures, but Phase 3 read-only
analysis must not depend on them. They are compatibility inputs, not product
contract outputs.

## Proposed PR Sequence

Recommended future PR order:

1. docs-only: preserve read-only analysis integration plan
2. test-only: add analysis fixture expectations using existing storage fixtures
3. test-only: add read-only stats calculation checks
4. implementation: add small session summary card
5. implementation: add distance / grouping summary without storage changes
6. implementation: add sight trend read-only view
7. design/test: plan `bowType` / `environment` migration
8. migration: only after storage contract and round-trip checks are public and
   passing

This order keeps visible behavior behind storage compatibility checks. It also
keeps `archery-master` as a reference source rather than a direct merge path.

## Acceptance Criteria

Any future read-only analysis PR must satisfy:

- no storage writes for derived analysis values
- no schema change
- no new persistent fields
- storage contract checker passes
- storage round-trip checker passes
- E2E smoke test passes
- CSV export behavior remains unchanged
- JSON backup / restore behavior remains unchanged
- existing sessions render unchanged
- existing sight marks render unchanged
- existing setup data renders unchanged
- no OCR assets are included
- no pose assets are included
- no AI assets or model files are included
- no external CDN dependency is added
- no `archery-master` direct merge occurs

Before implementation reaches public `main`, the public freeze policy should be
reviewed and the work should be split into small PRs.

## Non-Goals

This document does not implement analysis integration.

Non-goals for this docs-only step:

- no implementation
- no UI changes
- no storage changes
- no migration
- no package changes
- no CI changes
- no Service Worker changes
- no `archery-master` merge
- no OCR, pose, AI, or model files
- no GitHub push
- no public PR
- no release
- no tag
- no GitHub Pages update
