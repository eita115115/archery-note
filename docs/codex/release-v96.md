# v96 release candidate evidence — AN-045

Public baseline:97945e17dd1529a527be5f0750372378818b2a57/v95.
Local candidate:a877c4337cfcae4e4b9da52058a44c1ca8c58a6f, branch
codex/score-trend-performance. No push or deployment. The corrected normal and
active-session update routes now pass all four engine/width cases each. AN-045's
candidate acceptance is complete; v96 publication requires separate user approval.
AN-046 identified an asynchronous readiness-wait defect in the helpers. See
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
arrow. Their initial async cache wait did not assert readiness; that gap is now
covered by the corrected normal-route run below. Keep the initial logs separately.

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

## Final corrected update acceptance

`verify-transition-normal-corrected.cjs` replaces the async wait with explicit
expect.poll of the evaluated boolean. Four fresh Chromium/WebKit320light/375dark
contexts click the real update banner. In each, the gate and a separate state
assertion establish cache96 only, active registration state activated, and controller
equality with the active worker before proceeding. All remaining original assertions
are retained: five histories, exact score-trend HTML, named filter focus/visible
bounds, round subtotal19, and then an active arrow retained across stopped-origin
offline reload. Direct transport returns ECONNREFUSED and navigation comes from
the actual worker; page errors remain zero.

```text
PASS: all four corrected actual-worker banner/cache-readiness/update/offline cases
PASS: four immutable v95→v96 active-update/offline regressions
```

The second result is the tracked AN-046 regression: practice already active on95,
update guard keeps the banner hidden and freshReload suppressed, registered-worker
update plus manual browser reload preserves the existing arrow, and two arrows are
retained offline. Eight route/configuration cases are accepted across these two
paths; the earlier corrected exploratory active run separately repeated those four
active cases. This is not an actual-iPhone or arbitrary-timing stress guarantee.

Raw final normal output/JSON/screenshots are separately named
`transition-normal-corrected.txt/json`, `corrected-normal-update-*.png`, and
`corrected-normal-analysis-*.png`; the original normal and failed probes remain.
Final source comparison establishes that candidate application/test/dependency
bytes are unchanged. Only the historical QA tool and records were added afterward,
so the candidate's successful full116-test/check:all/lint result remains applicable.

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

Initial independent release review confirmed aligned/scoped runtime markers and identified
the initial banner guard mismatch. Additional read-only diagnostic review confirmed
normal four-case observations, corrected baseline labels and the then-unresolved
material risk. That investigation is superseded by the corrected acceptance below;
it did not approve all update paths or publication.

AN-046 completed: a minimal always-false async predicate returned false after one
call in installed Playwright1.61.1, and a controller-version message answered95
after the original gate. Explicit expect.poll of the evaluated boolean resolves
the unchanged immutable active route in four cases, independently repeated by the
durable regression. No application fix was needed or inferred from a hypothesis.
The equivalent normal-route cache gate is now corrected and all four cases pass.
The candidate records are complete. Ask for v96 publication approval after final
record/source verification; do not treat a previousv95 approval as a new push grant.
Worker activation changes/new dependencies still have their own approval
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
AN-046 added a diagnostic regression and superseded the readiness conclusion;
its corrected active-route evidence is in the diagnosis document. AN-045 has now
rechecked the normal route as well; the historical incomplete record is retained.

## Publication plan and limits

Remote main was read-only verified as97945e17, the expected publicv95 baseline.
On explicit v96 approval, verify main again, push the reviewed branch without force,
and check CI and GitHub Pages for the exact publication source. Verify public96
and all21 asset bytes against that source, then run the prepared375px publication
helper for analysis focus/visibility, history, settings touch swipe and offline
synthetic practice retention. That helper's earlier local rehearsal is not live96
evidence. Report failures and do not mark publication complete early.

The package tree is identical to published95 after removing root version metadata;
no new packages, telemetry, paid service or personal records are involved. Existing
ZIP development dependency warnings remain open. Physical iPhone/VoiceOver,
5000-record actual persistence and INP are unverified. The measured benefit is
reduced work in the eight-record card; whole-app speedup is not uniformly proved.

## Final record/source audit and review

```text
PASS: existing task acceptance preserved; candidate runtime/test/dependency unchanged; corrected normal4 readiness and active4 data/offline scopes verified; full116 evidence retained; AN-045 complete and AN-047 awaits approval
PASS:21 native assets byte-identical/readiness96; dependency tree unchanged; shared hidden lock unchanged
PASS: 101 candidate source/test/dependency files match owned sandbox; shared hidden lock unchanged
All matched files use Prettier code style!
```

The101-file comparison includes the unchanged100 candidate source/test/dependency
files and the historical QA helper added aftera877. It is not a claim that the QA
helper belonged to the immutable runtime candidate. Current runtime/tests/dependency
files remain unchanged froma877. The full116-test/check:all/lint result is retained
for those same bytes; only corrected update verification and record formatting are
new results. Staged diff checks pass, owned normal helper is no longer live.

Final independent read-only review confirmed the normal gate and state assertions,
four JSON rows/completion log, prior active-route evidence, preserved task acceptance
and candidate/public distinction. No P1/P2 findings. Existing AN-046's interrupted
document review is historical; this AN-045 record review completed successfully.
Initial missing Pages/native-helper read paths were corrected from actual inventory
to ci.yml/verify-native.cjs; those reads were not application check failures.

AN-045 is done with evidence. AN-047 is needs-user/passesfalse for explicit v96
publication approval. No push, deployment, fee or actual private practice was used.
