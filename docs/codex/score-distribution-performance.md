# Score distribution performance

2026-10-01, baselinecd02425 and implementation585ea8d.
Published asv93 after user approval; see [release record](release-v93.md).

## Cause and change

Warm analysis rendering no longer recalculates grouping statistics, but still
walks many arrows. Profiling 1,000 synthetic sessions x36 arrows highlighted
scoreDistCard: flatten all sessions, allocate an object per arrow, then search
all arrows again for every displayed score bucket. Empty X/10/8/7 rows repeatedly
search the full history even though they have no representative arrow.

scripts/60-history-sight-view.js now counts arrows, identifies field-only input
and retains the first face type for each score in one pass. It keeps per-session
flattening, the existing 12-arrow minimum, bucket order, percentages, bar widths,
first-arrow color and all visible HTML. No scoring/storage/layout changes.

The four product gates were considered: this improves the existing score→analysis
connection, keeps growth displays identical, uses entirely local processing, and
reduces friction when revisiting analysis. No separate feature was added.

## Measurement

Fresh Chromium375x812, CPU throttled4x, Service Worker blocked. Synthetic data
only; no user browser profile. The existing measure-view-performance.js harness
includes synchronous rendering and forced layout, not network or subsequent paint.

| Scope                                       |  Before |   After |
| ------------------------------------------- | ------: | ------: |
| Score reads, 36,000 arrows                  | 360,002 |  72,000 |
| Card rendering median, 20 alternating pairs |  25.8ms |   8.0ms |
| Entire warm analysis median, cycles2–4      | 207.7ms | 191.7ms |

The card comparison invokes baseline/candidate alternately in the same page and
compares exact returned HTML on every call. Whole-view timings are separate small
samples and noisy; no precise total-app speedup or physical-iPhone claim is made.
First history rendering still computes all session statistics. Other analysis
cards and signature scans remain potential bottlenecks.

## Validation

The deterministic large-history check fails before the implementation:

```text
Error: Score distribution repeatedly scans arrows: 360002 reads
```

After the change, check:all exits0, including:

```text
Score distribution: 36000 arrows, 72000 score reads
Archery Note checks OK (v92)
Analysis core characterization checks OK
Storage round-trip checks OK
Version alignment checks OK
```

- lint and format:check exit0.
- Chromium/WebKit375px app-smoke: `16 passed (16.4s)`.
- 1,000 deterministic datasets: exact old/new HTML equality and unchanged input,
  including field/single/triple, mixed score types, X, misses, empty/short histories.
- Existing field distribution check retained; added an empty single-target session
  before field records to verify it does not change field-only buckets.
- Independent read-only review found no actionable issues. Reviewer independently
  reran check:app and the1,000 comparisons pinned tocd02425/585ea8d.

Evidence: artifacts/analysis-profile/ contains current.json, breakdown.json,
after.json, paired.json, red.txt, green.txt, equivalence.txt, check-all.txt,
lint.txt, format.txt and smoke.txt. Reproduction helpers paired.cjs and
equivalence.cjs pin their old source tocd02425, so they remain valid after commits.

Initial measurement failed because the previous preview server handle was gone;
confirmed the missing handle and started a new server. The first generated paired
harness had a syntax error, corrected before collecting the20 pairs. Neither
failure is treated as evidence of an application regression.

Release-wide checks, update verification and publication completed asv93.
Real-device feedback and AN-001 actual-shooting acceptance remain open.
