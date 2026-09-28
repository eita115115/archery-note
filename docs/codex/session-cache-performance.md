# Session statistics cache — 2026-09-28

Long histories exceeded the 800-entry statistics cache. Iterating those records
evicted entries before the next consumer could reuse them. Analysis could
recompute statistics twice for every session during each tab switch.

## Change

`scripts/40-analysis-physics.js` now stores the latest signature and result in a
WeakMap keyed by the session object. The existing signature, including DB_REV,
still determines whether to recompute. Score edits and saved coordinate edits
invalidate results. A replacement session cannot borrow another object's arrow
references even if their aggregate signatures collide.

This retains metrics for all live sessions, rather than capping them at 800.
Each session retains only its latest result; deleted/replaced objects can be
collected when no other references remain. No persisted schema, scoring formula,
visible arrow geometry, UI layout or network behavior changed.

## Measurement

Baseline application: `37398f8`. Candidate differs in cache storage only.
Chromium, 375 × 812 viewport, CPU throttled 4×, Service Worker blocked, fresh
contexts, synthetic 100 and 1,000-session datasets with 36 arrows per session.
Four history → analysis → record cycles; the table uses the median of cycles
2–4. Values measure synchronous rendering plus forced layout, not network time,
subsequent painting or physical-device input latency. Samples are small; the
deterministic recalculation count is stronger evidence than precise timings.

| 1,000-session operation |   Before |    After | Repeat after | Statistics calls before → after |
| ----------------------- | -------: | -------: | -----------: | ------------------------------: |
| History switch          | 434.2 ms |  48.6 ms |      46.6 ms |                       1,000 → 0 |
| Analysis switch         | 998.3 ms | 207.7 ms |     206.9 ms |                       2,000 → 0 |

The first visit still computes every session once. This change does not claim
to improve cold start or all large-history operations. DB_REV changes still
invalidate metrics across sessions, preserving existing correctness behavior.

Reproduce with the existing Playwright installation, in two terminals:

```powershell
$env:PORT='4175'; node tools/e2e-server.js
```

```powershell
node tools/measure-view-performance.js artifacts/performance/views.json
```

The harness opens disposable browser contexts with fictional data; it never
reads the user's browser profile. `BENCH_URL` can point to a different local
preview port. Close other heavy workloads when comparing measurements.

Raw observations remain in `artifacts/improvement-baseline/` as
`performance-before.json`, `performance-after.json`, `performance-repeat.json`.

## Verification

- New 1,001-session regression failed before the fix:
  `Error: long history retains unchanged metrics for session 0`.
- `npm run check:analysis`: `Analysis core characterization checks OK`.
  Includes large-history reuse, edited score, replacement identity, and the
  existing saved coordinate-edit invalidation case.
- `npm run check:all`: exit 0, including scoring, analysis, UI and storage.
  Output includes `Archery Note checks OK (v85)`, `Storage round-trip checks OK`
  and `Version alignment checks OK`.
- `PORT=4175 npm run test:e2e`: `83 passed (1.1m)`.
- `npm run lint`: exit 0 after removing an unused benchmark-only global.
- Independent read-only review: no actionable findings; live-session retention
  tradeoff and the pre-existing pre-save aggregate-signature limitation noted.

No deployment or version bump was performed. Run the release gates and bump
all version markers together when preparing the accumulated release candidate.
