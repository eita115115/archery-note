# v90 release

Candidate: 21a8d73; scroll fix: 907536f. Published v90 after explicit user approval on 2026-10-01.

Tabs retain their own reading position, so history/analysis comparison does not
lose the place. First visits start at the top. Positions live in memory only.
Returning nonzero views lays out direct cards to avoid intrinsic-size placeholders.
No storage schema, scoring, dependency or worker activation-policy change.

Validation:

- check:all passed, including storage round-trip and version alignment.
- lint and format:check passed. Initial docs line-ending warnings fixed.
- Full Chromium: 102 passed (1.0m), PORT=4175, source verified during development.
- WebKit normal/reduced-motion scroll: 2 passed (3.9s), prior implementation check.
- Independent review: no actionable findings; isolated PORT=4198: 2 passed (3.5s).
- Actual v89→90 worker update: old cache removed, three fictional sessions retained,
  offline v90 reload passed. Initial harness used a mangled source hash and timed
  out before demo startup; corrected to f043b307 and reran successfully.
- Native web bundle built; four version markers agree at 90.

Evidence: artifacts/release-v90/ and docs/screenshots/tab-scroll/.
Physical iPhone acceptance remains outstanding. Restored views have a small local
layout cost, detailed in tab-scroll-investigation.md. Published source: 012e6ac1.
Publication completed. Physical iPhone feedback remains outstanding.

## Publication evidence

- Pages36790778468 and Linux CI36790779831 succeeded. E2E: `102 passed (1.0m)`.
- Public APP_VER/version.json90 and seven asset contents match the local sources.
- Public tab navigation: first analysis0px, history returns1400px, analysis returns600px; synthetic sessions unchanged.
- Public settings touch swipe, 44px controls, three-column HUD, practice start, offline reload and data retention passed; no page errors.
- Logs: artifacts/release-v90/deployed-check.txt and deployed-scroll.txt.
