# AN-046 — worker-update verification diagnosis

The readiness gate in the verification helper was incorrect. With the installed
Playwright 1.61.1, `waitForFunction(async () => condition)` treats the returned
Promise as truthy, fulfills with it, and adopts its value. If that value is false,
the call completes with false; it does not retry the condition. The helper did not
assert the returned value, so it reloaded during worker replacement.

Replacing that gate with `expect.poll(() => page.evaluate(async () => condition)).toBe(true)`
resolves the original immutable active-update route in both engines and widths.
This establishes a verification defect and corrected acceptance evidence. It does
not establish a universal guarantee about browser updates or identify every internal
reason Chromium's prematurely triggered network fetch remained pending.

No application, worker, scoring, storage, version or dependency source was changed.
Public v95 is unchanged. AN-046 is complete; AN-045 must recheck its normal update
route with the corrected cache gate before being called release-ready.

## Reproduction and causal evidence

The retained original probe loads immutable v95 `97945e17dd1529a527be5f0750372378818b2a57`,
starts a synthetic practice, updates the registered worker from immutable candidate
v96 `a877c4337cfcae4e4b9da52058a44c1ca8c58a6f`, manually reloads, adds another arrow,
stops the origin, asserts ECONNREFUSED, and reloads again. Chromium320 timed out in
15 seconds. Its original cache/activation wait was asynchronous and therefore did
not establish readiness. The earlier “activation wait did not help” conclusion is
superseded: that diagnostic repeated the same incorrect wait.

The ranked hypotheses were worker fetch/cache waiting, URL-dependent reload,
application save/unload interference, and browser/verifier timing. A tiny page with
the real worker completed navigation in all six engine/route cases. Two Chromium
updated cases returned version95 instead of96, so those are failures, not acceptance
passes. The reduced real-HTML/idle/active app cases all completed, but their old
readiness gate was also invalid and cannot establish worker-generation correctness.

Navigation-stage instrumentation in the full app showed fetch dispatch without a
completed network promise in the failing run. A separate lifecycle diagnostic used
a MessageChannel to ask the controller for its actual CACHE constant. Immediately
after the purported readiness wait it answered `archery-note-v95`; only later did
v96 activate and answer `archery-note-v96`. The instrumented run then succeeded.
Instrumentation affected timing and is diagnostic evidence, not immutable acceptance.

Installed `playwright-core/lib/coreBundle.js` implements the decisive sequence as
`const success = predicate(); if (success) { fulfill(success); return; }`. The tracked
regression reproduces this API seam on each browser: an always-false async predicate
returns false after one call, whereas an explicit result assertion polls until true
across three calls. No arbitrary sleep substitutes for worker readiness.

## Corrected original route and durable regression

The corrected gate awaits cache96 presence, cache95 absence, activated registration
and controller equality with the registration's active worker. Both the corrected
exploratory verifier and the durable regression complete four independent fresh
contexts: Chromium/WebKit,320×568light/375×812dark, reduced motion. They serve the
original immutable commit bytes without worker instrumentation. This is eight
successful route executions in two runs, not eight distinct device configurations.

Every case verifies the active update guard, saved histories5, pre-update active
arrow1, exact scoreTrendCard HTML, named filter focus and visible bounds, round
subtotal19, and active arrows2 after the manual browser reload. The stopped origin
refuses direct requests; offline reload responds from the actual worker and retains
all scoped practice data, with zero page errors. No personal browser or records are
used. Real iPhone/VoiceOver and arbitrary update-timing stress remain unverified.

Run the historical regression from a checkout containing both immutable commits
with existing Playwright/browser dependencies. It does not install anything:

```text
node tools/diagnostics/verify-v96-worker-update.cjs
PASS: async waitForFunction returns false after one call; expect.poll waits for true across three calls
PASS chromium 320px: active guard blocks in-app reload; registered-worker update + browser reload v95 → v96/cache switch; 5 synthetic records and pre-update active arrow unchanged; trend HTML identical; round subtotal19; stopped-origin offline reload keeps two active arrows/records and corrected named filter focus; no page errors
PASS chromium 375px: active guard blocks in-app reload; registered-worker update + browser reload v95 → v96/cache switch; 5 synthetic records and pre-update active arrow unchanged; trend HTML identical; round subtotal19; stopped-origin offline reload keeps two active arrows/records and corrected named filter focus; no page errors
PASS webkit 320px: active guard blocks in-app reload; registered-worker update + browser reload v95 → v96/cache switch; 5 synthetic records and pre-update active arrow unchanged; trend HTML identical; round subtotal19; stopped-origin offline reload keeps two active arrows/records and corrected named filter focus; no page errors
PASS webkit 375px: active guard blocks in-app reload; registered-worker update + browser reload v95 → v96/cache switch; 5 synthetic records and pre-update active arrow unchanged; trend HTML identical; round subtotal19; stopped-origin offline reload keeps two active arrows/records and corrected named filter focus; no page errors
PASS: four immutable v95→v96 active-update/offline regressions
```

The seam PASS appears once per context. Raw output and four-row JSON are under
`artifacts/offline-update-diagnosis/regression.txt` and
`artifacts/offline-update-diagnosis/regression/active-active.json`.
`corrected-active.txt/json` hold the first corrected four cases. Original failures
under `artifacts/release-v96` are retained, as are minimal.txt/json,
app-trace.txt and app-lifecycle.txt in the diagnosis artifact directory.

The first reduced-HTML helper injected inline registration despite the app CSP;
worker-ready timed out. It was corrected to an external diagnostic script. The next
data comparison incorrectly included updatedAt/launchCount, then replaced only one
occurrence of the assertion. Final comparisons use sessions/active/setups/sightMarks/
customRounds and explicit pending-save flush. These helper failures are preserved
and do not demonstrate application defects. The first unbounded ready helper was
stopped after verifying its exact owned command; subsequent helpers bound readiness
and close their browser/context/server in finally.

## Review and return gate

Read-only reviewer inspection confirmed the installed implementation, controller95
observation, corrected four-case JSON and durable four-case/seam output, finding no
P1/P2 gap. Its final turn hit a usage limit; final document review was not completed.
Primary verification remains responsible for the final record audit.

The unchanged application PWA checks and formatting passed:

```text
PWA asset checks OK
PWA update flow checks OK
All matched files use Prettier code style!
```

Formatting includes the diagnostic CJS in a separate explicit check, since the
normal format script does not include that extension. Node's syntax check also
passes. The previous full116-test candidate result is retained, not rerun or claimed
as new evidence for this helper-only change.

Final record/source checks also passed:

```text
PASS: task acceptance preserved; AN-046 evidenced and AN-045 still pending; candidate runtime unchanged; corrected4 plus regression4 scopes and wait seam verified
PASS: 101 candidate source/test/dependency files match owned sandbox; shared hidden lock unchanged
```

That101-file comparison covers the current worktree's original100 source/test/tool/
dependency files plus the new diagnostic helper; it does not claim that the helper
belongs to immutable candidatea877. The only tool/source difference from that
candidate is the new historical diagnostic. Staged diff whitespace checks pass,
and no owned diagnostic Node helper remains live.

AN-045 must correct the equivalent async cache wait in the normal clickable-banner
helper and rerun those four cases. Existing normal-route offline/data results remain
observations, but their old wait alone did not prove cache absence. Retain both logs,
then finish candidate records and publication review. Do not alter activation policy
or request publication on the strength of this diagnosis alone.
