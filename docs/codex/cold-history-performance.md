# Cold history: reuse unchanged statistical inputs

On 2026-09-29 the history summary was confirmed to compare grouping statistics
across all sessions in `todayConclusion`. Skipping old sessions would change its
meaning, so all records remain included.

`robustStats` now reuses the original x/y medians, radial distances, radial median
and MAD when no points were excluded. The exclusion path is unchanged. This removes
four redundant median sorts in that case. No scoring, data schema or UI changes.

Evidence under `artifacts/release-v86/`:

- `median-before.txt`: new median-count test failed before implementation.
- `median-after.txt`: characterization and median reuse checks passed.
- `compare-medians.cjs`: 2,000 deterministic samples, sizes 0–144 and mixed outliers,
  matched previous robustStats output exactly (deep strict equality).
- `views-current.json` / `views-median-reuse.json`: first history view, synthetic
  1,000 sessions × 36 arrows, Chromium 375px and CPU4x: 743.6→665.5ms in these runs.
  Single-run timings are noisy; no physical iPhone or broad speed claim is made.
- Independent review found no actionable issues, including the reset-to-all branch.

The initial display still computes every session's statistics. This is a modest
reduction in redundant work, not elimination of the cold-start bottleneck.
