# v91 release: end action and page zoom

User reported needing to swipe after scoring to complete the end, and unwanted
page zoom. Reproduced dock bottom at1053px in a640px viewport after tab navigation.
The main viewEnter animation retained transform, making main the containing block
for its fixed dock. Removed only main's translation; opacity transition remains.

html/body now use touch-action:pan-x pan-y to permit scrolling while excluding
page pinch/double-tap zoom. Target touch-action:none and its explicit zoom controls
remain. Input controls already use16px text. No viewport meta lock was added.
The question distinguishing pinch/double-tap/input-focus remains unanswered; pinch
was the working assumption. Physical iPhone validation remains necessary.

Evidence:

- Regression failed before; fixed dock and actual one-arrow/end completion passed
  using screen coordinates (no locator auto-scroll masking).
- Chromium2 passed (5.0s), WebKit2 passed (4.7s). Initial WebKit helper cwd issue
  corrected; initial test click missed the target and was corrected to its center.
- Chromium native two-touch outward gesture retained viewport scale1.
- check:all/lint/format passed. Full E2E:104 passed (1.0m).
- Actual v90→91 worker update, three synthetic sessions retained, offline reload passed.
- Independent review: no actionable regressions. Screenshots:docs/screenshots/end-dock/.
- Logs and probes:artifacts/release-v91/. Implementation:f5650aa. Published after user approval from dbcb99f0.

Publication completed after explicit user approval. No scoring,
storage schema, dependency or personal-data changes.

## Publication — 2026-10-01

Pages36793723110 succeeded. Public version91 and seven served assets matched.
Live Chromium/WebKit interactions:4 passed (5.7s), including screen-coordinate
scoring/end completion and fixed dock after scrolling. Chromium outward two-touch
gesture retained scale1. Settings swipe and offline data retention passed with
zero page errors. Logs:deployed-check.txt / deployed-interactions.txt.

Initial live-test harness incorrectly navigated to the host root; fixed to app
URL and reran successfully. Initial Linux CI36793723675 had103 passes/1 failure
because tab-scroll attempted initial scrolling before lazy history layout.
Test-only9071e564 now waits for actual card height. Targeted Chromium6 passes
and WebKit2 passes. Runtime assets unchanged; replacement CI36794033791 succeeded:104 passed (1.1m). Pages36794033346 succeeded.
