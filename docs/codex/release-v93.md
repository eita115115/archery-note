# v93 release candidate

Prepared on2026-10-01. Candidate42ff185dadf2cd821af90cb42b5ee8aca30f3897;
performance implementation585ea8d. Published app remainsv92 from1c1c2af0.
No push or deployment has been performed forv93; publication approval is pending.

## Change

Aggregate score distribution counts and first face type in one pass instead of
repeatedly scanning all arrows for empty score buckets. Displayed counts,
percentages, colors and HTML are unchanged. See
[performance evidence](score-distribution-performance.md) for the scoped
25.8→8.0ms card measurement and1,000-dataset equivalence check.

No scoring formula, storage schema/key, Service Worker activation policy,
dependency or personal-data changes. No money used. Physical iPhone performance
and actual-shooting acceptance remain unverified.

## Release validation

All commands exited0:

- version:bump: `Archery Note version set to 93`.
- build:native-web: `Native web assets ready: dist\native (v93)`.
- check:all, including `Archery Note checks OK (v93)`,
  `Storage round-trip checks OK`, `Version alignment checks OK`.
- lint and format:check passed.
- Full Chromium E2E: `106 passed (1.0m)`.
- Native bundle: `PASS: native bundle v93, all 21 copied assets byte-identical to source`.

Earlier implementation verification: Chromium/WebKit smoke
`16 passed (16.4s)`, exact HTML/input equality across1,000 deterministic datasets,
and independent review without actionable findings. Candidate review independently
reran check:version/check:pwa and confirmed the version commit changes values only.

Initial staging mistakenly named a nonexistentwww directory and failed before
staging anything. Corrected to the five actual marker files and committed42ff185;
native output remains ignored underdist/native. This was a local tooling mistake,
not an application or validation failure.

## Update and data retention

The local HTTP harness serves immutable baseline1c1c2af0 then candidate42ff185,
with a real Service Worker and a fresh browser context. It seeds only three demo
sessions, activates the baseline, displays the update banner, clicks it, observes
APP_VER93/new cache/old-cache removal, compares sessions, then reloads offline.

```text
PASS: real v92 → v93 worker transition, old cache removal, 3 demo sessions retained, offline v93 reload
```

Evidence: artifacts/release-v93/check-all.txt, lint.txt, format.txt, e2e.txt,
native-assets.txt, transition.txt, verify-transition.cjs and real-update-banner.png.

Next after explicit publication approval: recheck remote main, push candidate,
wait for CI/Pages, confirm live version/assets and scoring-analysis/history/offline
behavior using synthetic data. Do not treat local verification as live deployment.
