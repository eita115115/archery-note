# v96 preparation evidence — AN-045, not release-ready

Public baseline:97945e17dd1529a527be5f0750372378818b2a57/v95.
Local candidate:a877c4337cfcae4e4b9da52058a44c1ca8c58a6f, branch
codex/score-trend-performance. No push or deployment. AN-045 remains in progress
pending corrected normal-route cache polling and the final candidate record audit.
AN-046 has since identified an asynchronous readiness-wait defect in the helpers;
the corrected active-session route passes all four engine/width cases. See
[the diagnosis and historical regression](offline-worker-update-diagnosis.md).

## Scope and passing evidence

The only new runtime behavior is AN-044's bounded scoreTrendCard aggregation,
already tested atbd36e8cb. Version:bump aligns APP_VER/json/cache/package/lock96
in a separate five-file commit. Worker strategy, scoring and storage are unchanged.
Dependency tree matches published v95 except root version metadata; shared installed
hidden lock is unchanged. No installation, money or actual private practice data.

Owned existing dependency sandbox is synchronized with tracked source/tests/docs.
Full check:all/lint/format and all Chromium E2E tests passed for the candidate:

```text
Score trend: 1000 seeded histories and empty/sparse/coercion/overflow HTML unchanged; inputs immutable
Score trend: 1000x36 fixture, 288 score reads, tail after eighth record untouched
Archery Note checks OK (v96)
Security regression: all 38 checks passed
UI smoke checks OK (chrome.exe)
PWA asset checks OK
PWA update flow checks OK
Storage contract checks OK
Storage round-trip checks OK
Save debounce checks OK
Version alignment checks OK
npm run lint — exit0
All matched files use Prettier code style!
116 passed (1.1m)
PASS:21 native assets byte-identical/readiness96; dependency tree unchanged; shared hidden lock unchanged
```

Four immutable same-origin worker transitions, Chromium/WebKit320×568light and
375×812dark, use no active session when clicking the update banner. They verify
v95→96 loaded app, five synthetic saved histories
unchanged, exact scoreTrendCard HTML, named focused setup/distance visible bounds,
round subtotal19, then one newly entered active arrow. Origin server is stopped,
ECONNREFUSED asserted, and actual-worker offline reload retains records and that
arrow. Their async cache wait did not assert readiness: old-cache absence must be
rechecked with explicit asynchronous polling before candidate acceptance. These
initial four results also do not establish the additional active-session route.

```text
PASS: all four actual-worker update/offline cases
PASS: local candidate rehearsal touch swipe dismisses settings and retains sessions
PASS: local candidate rehearsal v96, seven candidate assets match, round collapse/expansion and score distribution, synthetic history/start, offline reload, data retention, no page errors
PASS:immutable v96 publication-helper local rehearsal
```

Rehearsal serves this immutable candidate at an owned local server and additionally
checks7d period focus/bounds. It is not a livev96 result. The unchanged375px score
trend images and AN-044 comparison remain in score-trend-performance.md; no new
timing or physical-device speedup is claimed from version metadata.

## Additional route: prior failures retained, readiness defect now identified

The following is the original investigation record, not the latest acceptance
status. AN-046's corrected verifier and durable regression each pass all four
Chromium/WebKit320/375 cases. Application/worker source was unchanged. The failure
was reached after a helper wait that did not actually poll its async condition;
the old “activation/controller wait” below had the same defect.

The first verifier incorrectly waited for a clickable banner while db.active held
one arrow. scripts/90-init.js hides the banner and blocks freshReload during active
practice. Independent review identified this P2 verification issue; timeout was
confirmed and preserved. The app was not changed to bypass its guard.

Corrected additional route, separate from the four normal cases: create one arrow
on v95; assert updateAvailable plus hidden banner; call freshReload and verify no
navigation or data change; explicitly update the real registered worker; browser
reload into v96 with the pre-update arrow and exact card HTML retained. Add another
arrow, stop the origin, and attempt another browser reload at the same URL.

The original last reload timed out in Chromium320 before completion. No success row
was written in that run; WebKit/375 cases were not reached and must not be counted
as passes for that failed probe. The attempted worker activation/controller wait
did not resolve it because its async predicate was not polled. Before offline,
those diagnostics showed v96 loaded, document complete,
active/controller activated and equal, two arrows persisted, index cache present,
and both v95/v96 caches. Both cache storage scripts contain APP_VER96. Server logs
confirm sw.js95 then96; worker inspection sees both global CACHE versions. This
does not establish why the final navigation stays pending or prove data loss.

```text
locator.waitFor: Timeout 30000ms exceeded.
waiting for locator('#updBar') to be visible
page.reload: Timeout 15000ms exceeded.
waiting for navigation until "load"
```

A separately labeled baseline-only v95 Chromium320 control with two arrows,
same-URL browser reloads and stopped-origin offline reload succeeds. Its original
inherited metadata/caption incorrectly named the update route/four cases and reused
a candidate image path. Those artifacts are preserved but are not authoritative.
Corrected final control JSON reports one case,95→95, baseline-only route; screenshot
has a distinct baseline filename. No update guard was tested in that control.

```text
PASS baseline-only95 chromium 320px: same-URL repeated reload, two active arrows, stopped-origin offline
PASS:one baseline95-only same-URL control case
```

A diagnostic experiment disables fetch-cache writes only in the served baseline
worker, leaving the checkout/candidate untouched. Timeout persists, and v95 cache
still exists alongside96. This does not confirm old fetch writes as the cause.
The experiment is not an immutable-baseline acceptance pass.

The first failed-navigation diagnostic then waited indefinitely for page.evaluate.
Its exact live helper PID13968 was identified and stopped; no remaining direct
child was observed. Subsequent diagnostics use a bounded one-second evaluation
and close contexts/browsers/servers in finally. Diagnostic helper syntax and native
Request.url-versus-Playwright-url() errors were corrected, with failed logs retained.
These are helper defects, not application failures.

## Review, next action and evidence inventory

Independent release review confirmed aligned/scoped runtime markers and identified
the initial banner guard mismatch. Additional read-only diagnostic review confirmed
normal four-case validity, corrected baseline labels and unresolved material risk.
It does not approve all update paths or publication.

AN-046 completed: a minimal always-false async predicate returned false after one
call in installed Playwright1.61.1, and a controller-version message answered95
after the original gate. Explicit expect.poll of the evaluated boolean resolves
the unchanged immutable active route in four cases, independently repeated by the
durable regression. No application fix was needed or inferred from a hypothesis.
Next AN-045: correct and rerun the equivalent normal-route cache wait, then complete
candidate records. Publication approval is not yet requested. Worker activation
changes/new dependencies still have their own approval
boundary. Actual iPhone/VoiceOver/large real storage and AN-001 remain unverified.

Raw artifacts in artifacts/release-v96: check-all.txt, lint.txt, format.txt,
e2e.txt, native-build.txt/native-assets.txt, transition-normal.txt/json,
verify-transition-normal.cjs, rehearsal.txt/rehearse.cjs/verify-deployed.cjs,
transition-initial.txt/verify-transition-initial.cjs,
transition-active-offline-timeout.txt, transition-active-diagnostic2.txt,
transition-active-activated.txt, worker-provenance.txt,
baseline-root-reload-final.txt/json and verify-baseline-root-reload-final.cjs,
experimental-no-old-writes.txt/verify-experimental-no-old-writes.cjs,
diagnostic-helper-syntax-error.txt and diagnostic-native-request-error.txt.

## Original AN-045 record checks (historical)

```text
All matched files use Prettier code style!
PASS: 100 candidate source/test/dependency files match owned sandbox; shared hidden lock unchanged
PASS:existing task acceptance/evidence preserved; candidatea877 runtime unchanged; normal4 and baseline-only1 scopes verified; AN-045/046 not falsely passed
```

At that checkpoint only records had changed and AN-045/046 were incomplete.
AN-046 now adds a diagnostic regression and supersedes the readiness conclusion;
its corrected active-route evidence is in the diagnosis document. AN-045 remains
incomplete until the equivalent normal-route wait is corrected and rechecked.
