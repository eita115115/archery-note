# v91 candidate: end action and page zoom

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
- Logs and probes:artifacts/release-v91/. Candidate:f5650aa. Not published.

Next: publication approval, then deployed CI and interaction checks. No scoring,
storage schema, dependency or personal-data changes.
