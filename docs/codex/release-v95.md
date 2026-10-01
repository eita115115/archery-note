# App v95 candidate — 2026-10-01

Public baseline:e1ec1fe6747e03bac11b41baeba55c1668ad51d5/v94. Local final runtime
candidate:7039fcea9e84806b2c6aa852b9a90aa1e438e295, branch codex/analysis-filter-focus.
This prepares AN-041; it is not publication approval or a claim thatv95 is live.

## Resulting behavior

Analysis 用具/距離 selectors are reachable by their existing visible labels.
After a focused filter changes or returns to all, its replacement retains focus
and stays between the visible header and fixed bottom navigation. Existing period
chips use the same bounded reveal. Programmatic changes from another focused
control do not steal focus. No options, score calculation, practice format, tab
structure or general layout redesign changes.

The function lays out only the cards through the filter card before measurement,
then scrolls only enough to reveal the focused control with12px clearance. It uses
the existing showView layout pattern, synchronously, with no delayed scroll/focus
callback. Cards below the filters retain their normal content-visibility behavior.

Version markers were bumped together with npm run version:bump: APP_VER95,
version.json95, archery-note-v95, package/lock0.95.0. The worker diff changes only
its cache version; activation/install strategy is untouched. Compared with the
published baseline, the package tree is identical after removing root version
metadata. No dependency addition or Lighthouse major update is included.

## Validation caught and repaired a missing case

The first candidate d4c3cec4 passed114 tests and the real update checks, but those
tests proved focus identity without measuring whether its control was visible.
The screenshot showed a focused selector behind navigation. A bounded old/new
probe confirmed incomplete reveal and variable positions after replacement cards
lost their content-visibility measurements. The fixed240px intrinsic placeholders
and native focus scrolling do not account for the final layout and navigation.

The follow-up boundary regression failed3 of4 engine/size cases before correction
(the fourth passed); it is not claimed to fail every time in every browser.
An isolated layout/reveal experiment informed the small7039fcea correction. New
tests wait two animation frames and check both bounds for setup/distance changes,
clear-to-all and period selection, with unchanged synthetic data. Earlier successful
d4c3 evidence is retained separately and is not used to certify the final runtime.

## Final evidence

Checks use the owned artifacts/dependency-update/sandbox, synchronized to the
candidate's source/tests and the already published three dependency versions.
Root node_modules is the original-checkout junction and was not installed into
or mutated. No actual user record or browser profile was opened.

```text
npm run check:all — exit0
Archery Note checks OK (v95)
Security regression: all 38 checks passed
UI smoke checks OK (chrome.exe)
PWA asset checks OK
PWA update flow checks OK
Storage contract checks OK
Storage round-trip checks OK
Save debounce checks OK
Version alignment checks OK
npm run lint — exit0
npm run format:check — exit0
All matched files use Prettier code style!
npm run test:e2e — exit0
116 passed (1.4m)
Focused filter/tab checks, Chromium and WebKit: 16 passed (15.9s)
PASS: all 21 copied bundle assets match source bytes, readiness version95
```

The immutable transition server serves baseline94, then final candidate95 at the
same origin. Four Chromium/WebKit320×568/light and375×812/dark contexts verify the
update banner, click-to-update, cache switch and old94-cache removal, unchanged
five synthetic sessions, named filter focus/visible bounds and history total19.
Then each inputs one arrow, stops its server, verifies ECONNREFUSED, reloads from
the actual Service Worker, and checks that arrow, records and filter controls.
Active1 retention is an offline-after-update result, not an active-before-update
test or physical Safari evidence.

```text
PASS: all four actual-worker update/offline cases
PASS: local candidate rehearsal touch swipe dismisses settings and retains sessions
PASS: local candidate rehearsal v95, seven candidate assets match, round collapse/expansion and score distribution, synthetic history/start, offline reload, data retention, no page errors
```

The local rehearsal also asserts named setup/distance focus and visible bounds.
The [375px original layout](../screenshots/analysis-ux-audit-375-dark.png) and
[375px label/focus correction](../screenshots/analysis-filter-focus-375-dark-after.png)
remain available; browser assertions prove names and bounds rather than images.
[Final375px filter controls](../screenshots/analysis-filter-v95-375-controls.png)
show all three control groups above navigation. Update-banner and final focus
images were inspected before recording acceptance.

A separate four-case Chromium/WebKit probe with normal motion waits only for
the selected control and ancestor animations to finish, then checks setup,
distance and period bounds. All four cases pass with no navigation overlap. The
first probe waited for offscreen animations too and remained pending; its live
process was identified and stopped before correcting the helper. This was a
verification-script wait condition, not an application failure or code change.
Corrected evidence: normal-motion-final.cjs/txt and normal-motion.json.

Static independent review of7039fcea found no actionable issue in prefix-only
layout, conditional focus, immediate minimal scrolling or regression coverage.
It did not rerun tests or certify physical devices. Earlier branch reconciliation
review confirmed existing task acceptance, AN-036 evidence and both ledger tails
were preserved. Initial merge conflicts were limited to CHANGELOG/progress/ledger
and resolved from both authoritative branches; task acceptance was not rewritten.

Final raw evidence: artifacts/release-v95/check-all-final.txt, e2e-final.txt,
lint-final.txt, format-final.txt, visibility-final.txt, native-build-final.txt,
native-assets-final.txt, transition-final.txt/json, verify-transition-final.cjs,
rehearsal-final.txt and verify-deployed-final.cjs. The original visibility failure,
old/new measurements and experiment remain in visibility-red-final.txt and
filter-visibility*.txt/json. No application/dependency install failures occurred.

## Publication boundary

Local candidate only. AGENTS.md requires explicit approval before git push/Pages
deployment. The previous approval covered existing three dependencies, which
are already published; it does not authorize this UI release or AN-038 additions.
After approval, recheck remote, publish this immutable runtime with its records,
inspect source-specific CI/Pages, and run verify-deployed-final.cjs on the live URL.

Actual iPhone/VoiceOver and AN-001 shooting acceptance remain unverified. No paid
API, telemetry, cloud inference, new package or personal information was used.
The two extract-zip development alerts remain open; this release does not resolve
them. The broad community goal stays active.

## Publication authorization and performance follow-up

A new human approval authorizes AN-042 publication of this candidate. Remote main
was rechecked at e1ec1fe6; final runtime remains7039fcea. Approval does not include
AN-038 dependency additions. Public verification is pending until recorded below.

The completed [synthetic performance audit](analysis-filter-performance.md) records
large-history latency and its limits. It changes no runtime and does not claim
a speedup from the focus fix. A separate AN-044 optimization is queued.
