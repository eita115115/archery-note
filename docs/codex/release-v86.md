# v86 release candidate — 2026-09-29

Status: local candidate, not published. Remote main was confirmed as
`66eb29bfa3624fe67c3e26373654194cc7654ec1` before preparing this candidate.

## User-visible changes

- Reuse session statistics when revisiting large histories. Synthetic 1,000-session
  Chromium measurements with 4x CPU throttling: history 434→49ms, analysis 998→208ms.
  These are warm view measurements, not physical iPhone launch measurements.
- Quieter history summary and collapsible filters, with active conditions visible.
- Clear primary practice-start action; repeat-start conditions stay accurate when
  the current form is edited.

## Release evidence

`npm run version:bump` updated app, version.json, Service Worker cache, package and
lockfile to v86 / 0.86.0. `build:web-assets` generated 64,217-byte CSS;
`build:native-web` successfully assembled local web assets (no native deployment).

- check:all: passed, including storage round-trip and version alignment.
- lint: passed; format:check: passed.
- Focused PWA browser tests: `2 passed (4.8s)`.
- Full E2E: `91 passed (1.0m)`; see `artifacts/release-v86/e2e.txt`.

The offline test uses the real Service Worker in a fresh browser context, then
turns off networking, starts a practice and reloads. Existing demo sessions and
active practice remain identical. The update-banner test supplies a simulated
higher version with Service Workers blocked and checks the actual banner/reload
path preserves sessions. It does not prove a deployed v85→v86 worker transition.

A separate local HTTP server then served the actual Git trees at `66eb29bf`
(v85) and `0c32d5a` (v86) on the same origin, with real Service Workers enabled.
The banner appeared after switching trees. Clicking it loaded APP_VER 86,
created archery-note-v86 and removed archery-note-v85. All three fictional
sessions remained identical, including after an offline reload into v86.
Command: `node artifacts/release-v86/verify-transition.cjs`. Output:

```text
PASS: real v85 → v86 worker transition, old cache removal, 3 demo sessions retained, offline v86 reload
```

Evidence: `artifacts/release-v86/real-transition.txt` and
`artifacts/release-v86/real-update-banner.png`. This is Chromium on localhost;
it does not substitute for deployed-site or physical iPhone verification.

No storage schema, scoring algorithm, worker activation policy, dependencies,
paid service or personal data were changed or used. All test records are fictional.

## Publication gate

AGENTS.md requires user approval before push/deployment. No push has occurred.
After approval, check remote main again, integrate and publish, then verify the
served version and a clean browser's update/offline behavior. Physical iPhone
and real practice acceptance remain outstanding.
