# Analysis filter interaction audit — 2026-10-01

Target0e3ea942, applicationv94. Four fresh synthetic contexts, Chromium/WebKit at
320×568/light and375×812/dark. This is a bounded browser interaction audit, not
real-iPhone/VoiceOver acceptance or a full accessibility review. Application code,
scoring, storage, worker and pending dependency candidate were not changed.

## Confirmed issue

The analysis filter card visually displays 用具 and 距離, but its label elements
have no for attribute and do not contain the selectors. #anSetup/#anDist have no
associated labels or aria-label/aria-labelledby. Both named combobox queries return0.
After either focused selector changes, renderAnalysis replaces its DOM and focus
moves to BODY. The selected value applies, but keyboard users lose their position.

| Check                     | History control   | Analysis control  | Four-case result |
| ------------------------- | ----------------- | ----------------- | ---------------- |
| Named 用具/距離 combobox  | Found1 each       | Found0 each       | Consistent       |
| Distance selection focus  | histDist retained | BODY              | Consistent       |
| Setup selection focus     | Not audited here  | BODY              | Consistent       |
| Period keyboard selection | Not applicable    | 7d focus retained | Consistent       |
| Selected distance value   | Applied           | Applied70         | Consistent       |

This contrast has a direct source explanation: history labels use for and its
change handlers restore focus; analysis labels lack for and its select handlers
only render. Analysis period chips already restore focus after rendering.

```text
CONFIRMED: 4 Chromium/WebKit320/375 cases: analysis selectors have no accessible labels and lose focus to BODY after selection
PASS: history labels/focus and analysis period focus retained; selected values apply; practice data unchanged; overflow/page errors0
```

All records, equipment, sight marks and active-session values were identical
before/after the audit. Only disposable built-in demo data was used. A70m fixture
variation was made before the comparison snapshot; no user record or preference
was read. No horizontal page overflow or page errors occurred in these four cases.
That does not establish every card/viewport or physical touch behavior is correct.

## Next correction

Use the existing history interaction pattern for this narrow defect: associate
the two visible labels with their existing selector IDs; when a focused selector
changes, restore focus to the replacement selector with preventScroll. Keep the
visible layout, options, calculations, filtering semantics and data format intact.

This improves access to existing score/grouping/equipment comparison and growth
views. It introduces no independent feature, external processing or new data;
the four product gates are considered as continuity of the existing daily analysis
flow. No new visual direction or broader dashboard rewrite is proposed.

Before implementation, add focused regression checks that demonstrate the current
failure for named labels and focus after both filters. Verify the correction in
the four engine/size cases, including clear-to-all, period focus, actual filtering
and unchanged demo records. Run check:ui/lint plus affected app checks and document
375px before/after evidence per evals/acceptance.md. Use a separate suitable worktree
so the pending AN-036 dependency-only publication remains independently reviewable.

## Evidence

- artifacts/analysis-ux-audit/audit.cjs, output.txt and results.json retain all four
  browser results, IDs/label bindings, focus/value checks and data invariance.
- [375px analysis overview](../screenshots/analysis-ux-audit-375-dark.png) and
  [320px filter layout](../screenshots/analysis-ux-audit-320-filters.png) were inspected.
  These illustrate current layout; JSON/browser role checks prove the name/focus
  defect. Screenshots alone cannot prove a readable accessible name.
- A first rg call used Windows wildcard paths and failed; repeated with directories
  and -g '*.js'. The browser audit completed without failures; it confirms a defect
  rather than certifying the current behavior as accepted.

The requested independent reviewer stopped with an account usage-limit error
before providing a review. No credits were purchased and no independent-review
success is claimed. The primary agent checked the saved four-case results against
the current label markup and render handlers; this is self-review only.

```text
npm run format:check — exit0
All matched files use Prettier code style!
git diff --check — exit0
```

Publicv94 and actual dependency candidate are unchanged. AN-036 publication
approval remains pending; this independent finding does not authorize publication
or major additions. Independent patch review should be retried when available
before merging the subsequent correction.
