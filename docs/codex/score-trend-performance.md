# Score trend bounded aggregation — AN-044

Baseline:97945e17dd1529a527be5f0750372378818b2a57 (published v95 runtime7039fcea).
Branch:codex/score-trend-performance, existing isolated checkout.

## Design and authorization

The user authorized local performance/UX improvement with no money or personal
information use. AN-043 measured large-history latency and identified this bounded
opportunity. Existing roadmap gates are preserved: score history continues to
show growth, existing analysis remains connected, processing stays local, and
daily comparison gets less unnecessary work. No new feature or visual decision
needs clarification; publication remains separately subject to approval.

Three approaches were considered: a bounded scan in scoreTrendCard using existing
historySessionRows; an optional limit in the shared history helper; and a cached
trend result. Choose the first. It avoids changing other consumers and introducing
cache invalidation, while retaining the existing score coercion and flattening.

Collect rows until eight nonempty records have been found, in the existing input
order. Reuse historySessionRows for one encountered session at a time. Empty,
malformed or sparse records do not consume a visible slot. Stop before accessing
later records after slot eight. Keep the entire HTML formatter unchanged. No sort,
mutation, scoring, storage, worker, dependency or version change.

## Plan and completion criteria

1. Add a public scoreTrendCard regression wired into check:app. Characterize exact
   HTML for malformed/sparse/coercible scores and seeded mixed histories, plus
   immutability. Instrument arrow score getters in a1000×36 fixture to demand288
   reads rather than36000. Confirm this last check fails before the patch.
2. Apply the bounded scan only in scoreTrendCard; rerun the regression and required
   app/analysis/UI/globals/lint checks in the owned dependency sandbox.
3. Compare immutable revisions in both browser engines using fixed synthetic
   fixtures. Check output equivalence, filter counts, visible focus, unchanged
   memory/demo storage and page errors. Include375px images and state timing limits.
4. Request independent code review, resolve findings, record output in this document,
   progress/tasks/ledger, and commit locally. Full release preparation and publication
   are a later task, not covered by existing v95 push approval.

Self-review: no undefined requirement, placeholder or unresolved design choice.
Success requires reduced arrow reads with identical visible output and relevant
checks; a whole-app or physical iPhone speedup is not assumed.

## Implemented evidence

Runtime/test commit:bd36e8cb60db4367dc58aab59d94832841593bc9. Only
scoreTrendCard changes in the app; historySessionRows and HTML remain unchanged.
The new check is wired into check:app and future CI. Before the patch the intended
read bound failed36000 !==288 (exit1), after the1000-fixture equality checks had
passed. After correction the same check passes, including an unreadable tail.

```text
Score trend: 1000 seeded histories and empty/sparse/coercion/overflow HTML unchanged; inputs immutable
Score trend: 1000x36 fixture, 288 score reads, tail after eighth record untouched
Archery Note checks OK (v95)
Analysis core characterization checks OK
Robust median reuse checks OK
UI smoke checks OK (chrome.exe)
check-globals OK (14 files, 1223 unresolved refs all accounted for)
npm run lint — exit0
20 passed (8.8s)
```

App/analysis/UI/globals/lint and both-engine focused/history-layout/tab checks use
the existing owned dependency sandbox. No installation into the shared junction.
The read count is a99.2% reduction of this card score-property reads on1000×36,
not a99.2% reduction of whole-app work. Histories with fewer than eight nonempty
records still require scanning all entries; that sparse-case performance is not
measured here. Dates/escaping in the pure fixture check are deterministic shared
test helpers; actual browser output is separately compared exactly.

## Paired browser measurement

Same owned immutable Git server and corrected seed method as AN-043, comparing
97945e17 (v95) andbd36e8cb. Fresh375×812 dark Chromium/WebKit, reduced motion,
workers blocked. Each scenario has100/1000/5000 synthetic sessions with36 arrows;
Chromium1000 adds4× CPU. All geometries are122cm single faces near the centre.
No actual practice record is read. References alternate order by scenario.

Card timing: one reference HTML call, three warm calls, seven batches of20 calls;
each timed call includes comparison with the reference HTML. Table values are
median batch milliseconds divided by20. Small decimal values are batch averages,
not exact single-call timing below timer resolution.

| Engine   | Sessions | CPU | v95 card ms | Candidate card ms | v95 all-distance filter ms | Candidate all-distance filter ms |
| -------- | -------- | --- | ----------- | ----------------- | -------------------------- | -------------------------------- |
| Chromium | 100      | 1   | 0.155       | 0.035             | 9.6                        | 10.2                             |
| Chromium | 1000     | 1   | 0.910       | 0.025             | 44.6                       | 41.1                             |
| Chromium | 5000     | 1   | 4.475       | 0.030             | 172.9                      | 168.5                            |
| Chromium | 1000     | 4   | 4.220       | 0.150             | 206.8                      | 192.1                            |
| WebKit   | 100      | 1   | 0.150       | 0.050             | 21                         | 21                               |
| WebKit   | 1000     | 1   | 0.900       | 0.050             | 68                         | 69                               |
| WebKit   | 5000     | 1   | 4.350       | 0.050             | 291                        | 289                              |

Filter columns measure synchronous handler plus forced layout, five saved samples
per action after one warm cycle; six actions give14 contexts and420 samples.
The two-frame interval is used for focus/bounds assertions, not an INP claim.
For example CPU4 distance70 is135.8→144.8ms, while1000 WebKit all is68→69ms.
Card work improves, but these noisy whole-screen comparisons do not establish a
universal speedup. Other full-history work remains.

```text
PASS: identical synthetic inputs across revisions; expected filtered counts; candidate focus/visible bounds; exact trend HTML; memory and persisted demo unchanged; overflow/page errors0
PASS:14 contexts,420 filter samples, exact trend HTML, input hashes, focused visible controls and saved invariance agree
PASS:375px before/after PNG bytes identical
```

Both revisions preserve focus and visible bounds, independent expected filtered
counts, paired input hashes/serialized sizes and exact card HTML. Memory fixtures
and persisted small demo stay unchanged, with no overflow/page errors. The5000
JSON is6778175 bytes and deliberately remains in memory: not real large-storage
evidence. Cold timings are single fixture-render samples, profiles are single
inclusive/non-additive observations. Actual iPhone/VoiceOver, INP, normal-motion
performance, mixed geometry and5000-record storage remain unverified.

[Before375px](../screenshots/score-trend-before-375-dark.png) and
[after375px](../screenshots/score-trend-after-375-dark.png) were inspected. PNG bytes
are identical: unchanged rendering, not a visual redesign.

Independent read-only code review found no actionable issue and ran the dedicated
fixture check/diff check. A second evidence review recomputed all14 contexts/420
samples/seven paired summaries, HTML/digests, invariance and image hashes with no
issue; it did not rerun timing or certify devices.

Raw evidence: artifacts/score-trend-performance/red.txt, green.txt, check-app.txt,
check-analysis.txt, check-ui.txt, check-globals.txt, lint.txt, e2e.txt, measure.cjs,
results.json, summary.json/txt and output.txt. Owned server/browser contexts closed
in finally; related E2E server is runner-owned.

Local only; public app staysv95, no worker/version/dependency changes, money,
telemetry or personal-information use. Next AN-045 prepares full release/update
validation before any new publication approval request.

## Final local record validation

```text
All matched files use Prettier code style!
PASS: 100 candidate source/test/dependency files match owned sandbox; shared hidden lock unchanged
PASS: task acceptance retained; completed evidence present; scoring/storage/worker/version/dependencies unchanged; tested runtimebd36e8c unchanged
```

Existing task acceptance is preserved and every completed row has evidence.
Only documentation/images changed after the measured runtime commit. No new
release or full-suite success is claimed; AN-045 retains that explicit gate.
