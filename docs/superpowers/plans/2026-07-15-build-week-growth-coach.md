# Build Week Growth Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn existing local practice records into an explainable, mobile-first growth dashboard and submission-ready Build Week project.

**Architecture:** Add read-only derived analysis to the existing pure-function core, then compose it in the existing Analysis surface. Keep storage additive and isolate demo records by ID prefix. Strengthen existing test and documentation contracts without a framework migration.

**Tech Stack:** Vanilla JavaScript, HTML/CSS, localStorage adapter, Service Worker, Node contract checks, Playwright.

## Global Constraints

- Preserve schema 4 backups and all legacy user records.
- Keep processing local and add no tracking or external runtime communication.
- Keep the score-entry screen and five-tab structure unchanged.
- Use existing robust grouping statistics as the single grouping source.
- Advice must name its evidence and avoid medical or physical diagnosis.

---

### Task 1: Explainable growth core

**Files:** `scripts/45-analysis-core.js`, `tools/check-analysis-core.js`

- [ ] Add failing tests for 7/30/90-day filtering, dashboard deltas, confidence and deterministic suggestions.
- [ ] Run `npm run check:analysis` and confirm the new API is missing.
- [ ] Implement pure functions with explicit minimum sample thresholds.
- [ ] Run `npm run check:analysis` and `npm run check:all`.
- [ ] Commit the independently testable core.

### Task 2: Mobile growth dashboard and demo lifecycle

**Files:** `scripts/50-record-view.js`, `scripts/10-storage-native.js`, `style.css`, `tests/e2e/build-week-growth.spec.js`

- [ ] Add failing E2E coverage for dashboard content, period switching, demo install and demo-only removal.
- [ ] Render the growth summary and suggestions in Analysis; extend period controls.
- [ ] Add explicit demo IDs and removal that cannot match user IDs.
- [ ] Verify narrow mobile, dark mode, keyboard focus and empty state.
- [ ] Commit the UI slice.

### Task 3: Data, security and offline regression gates

**Files:** `tools/check-security.js`, `tools/check-storage-contract.js`, `tests/e2e/build-week-data.spec.js`, `sw.js`

- [ ] Add failing hostile import and CSV formula tests before any fix.
- [ ] Harden only confirmed gaps, preserving old exports.
- [ ] Add offline dashboard/import/export and Service Worker update tests.
- [ ] Run security, storage, PWA and full checks.
- [ ] Commit the hardening slice.

### Task 4: Submission package

**Files:** `README.md`, `docs/build-week/*.md`, `docs/codex/codex-progress.md`

- [ ] Derive before/after claims from Git history and actual diff.
- [ ] Write English/Japanese descriptions, demo scripts, shot/screenshot lists, judging mapping, checklist and development log.
- [ ] Mark unverified URLs, criteria, IDs and human publication work as pending.
- [ ] Run formatting checks and commit documentation.

### Task 5: Release verification

**Files:** version markers only through `npm run version:bump`

- [ ] Run clean install, lint, format, all checks, E2E, native web build and Lighthouse baseline.
- [ ] Perform visible mobile and offline smoke checks; record evidence.
- [ ] Bump aligned version markers only after runtime validation.
- [ ] Review final diff, commits and rollback points.
