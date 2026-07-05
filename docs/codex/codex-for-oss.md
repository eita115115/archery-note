# Codex For OSS Usage Plan

Archery Note is an offline-first open-source PWA for archery practice records, sight adjustment, equipment notes, and training history.

## Why This Repository Matters

Archery practice data is often managed on paper, generic notes, or spreadsheets. Archery Note provides a sport-specific workflow for recording scores, impact positions, sight marks, equipment notes, and practice history in one offline-first app.

The project focuses on mobile use at the range, local data preservation, and simple backup/restore. It is a niche project, but it is practical for archers who want a focused tool rather than a generic tracker.

## Maintenance Work

This repository requires ongoing maintenance in the following areas:

- PWA stability
- offline update behavior
- local data safety
- JSON backup and restore compatibility
- accessibility improvements
- regression checks
- release notes
- documentation updates

## Current Quality Baseline

The repository is ready for OSS review from a quality-baseline perspective. The CI workflow now covers app checks, UI checks, lint, format check, and a minimal Playwright E2E smoke test.

A local Lighthouse baseline is available with `npm run lighthouse:baseline`. It is intentionally not enforced in CI yet, and no score threshold is part of the current quality gate.

Phase 2 quality baseline work is intentionally separated from Service Worker changes, storage migration, and analysis integration. Those areas need focused design and review before implementation.

## Planned Use Of Codex / API Credits

Codex and API credits would be used for OSS maintenance tasks, including:

- issue triage
- duplicate issue detection
- PR summaries
- regression test ideas
- release note drafts
- accessibility review
- storage migration review
- Japanese and English documentation improvements

The focus is maintenance quality and review support, not simply generating more features.

## Future Work

- Service Worker update strategy
- Storage migration and rollback planning
- Analysis and stats integration
- Third-party asset review for OCR, pose, and AI features before enabling those features
