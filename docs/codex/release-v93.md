# v93 release

Prepared on2026-10-01. Candidate42ff185dadf2cd821af90cb42b5ee8aca30f3897;
performance implementation585ea8d. Published on2026-10-01 after explicit user
approval, from5c6ecea9e51cb932a0dbbfe17f4e0ba07811fc97.

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

The planned publication checks were executed after user approval; results below.

## Publication verifier rehearsal

Prepared artifacts/release-v93/verify-deployed.cjs with immutable42ff185 asset
comparison and an added analysis-score-distribution check. Rehearse.cjs serves
that candidate under/archery-note/ on loopback, matching the Pages subdirectory.
The verifier labels local results explicitly, rather than claiming deployment.

```text
PASS: local candidate rehearsal touch swipe dismisses settings and retains sessions
PASS: local candidate rehearsal v93, seven candidate assets match, analysis score distribution, demo history/start, offline reload, data retention, no page errors
```

Command: `node artifacts/release-v93/rehearse.cjs`, exit0. Evidence: rehearsal.txt
and screenshots in the same artifact directory. For live verification after
approved publication, run verify-deployed.cjs without VERIFY_URL.

At rehearsal, remote main1c1c2af0/public92 were unchanged and approval was pending.

## Approved publication

- User approved. Pushed5c6ecea9 from remote1c1c2af0; no additional application change.
- [Pages36821315831](https://github.com/eita115115/archery-note/actions/runs/36821315831)
  succeeded for that source.
- [CI36821316579](https://github.com/eita115115/archery-note/actions/runs/36821316579)
  succeeded, including check:all/lint/format and `106 passed (59.0s)`.
- Live version93 and seven candidate assets match immutable42ff185. Chromium
  score distribution, demo history/start, native touch settings dismissal, offline
  reload, synthetic data retention and zero page errors passed.
- Live WebKit320/375px: all/filtered/reset score-distribution totals and unchanged
  sessions passed online, without page errors.

```text
PASS: deployed touch swipe dismisses settings and retains sessions
PASS: deployed v93, seven candidate assets match, analysis score distribution, demo history/start, offline reload, data retention, no page errors
```

Live outputs: artifacts/release-v93/deployed-check.txt and deployed-webkit.txt.

### WebKit offline limitation

The optional WebKit probe exits1 for offline reload at both widths:
`page.reload: WebKit encountered an internal error`. The first exact rerun also
failed. The same probe against immutablev92 (1c1c2af0) under loopback/archery-note/
reproduced the error at320/375px. Controller and all shell cache entries existed
before going offline. This comparison does not identify whether the cause is
the browser port, automation or an existing application issue.

Evidence: deployed-webkit-first.txt, deployed-webkit.txt, webkit-baseline.txt and
rehearse-webkit.cjs. Do not claim WebKit offline success or actual iPhone coverage.
Tracked asAN-030 for minimal reproduction; no speculative Service Worker changes.

Next: investigateAN-030 and obtain real-device UX/actual-shooting acceptanceAN-001.
