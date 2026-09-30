# v90 release candidate

Candidate: 21a8d73; scroll fix: 907536f. Published version remains v89.

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
layout cost, detailed in tab-scroll-investigation.md. Nothing published yet.
Next: explicit publication approval, then push and verify Pages/CI/live behavior.
