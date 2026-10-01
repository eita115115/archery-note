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
