# History mobile refinement — 2026-09-29

The 375px audit found that summary cards and always-expanded filters pushed
practice records below the first half of the screen. The record and analysis
screens were also captured; this change deliberately addresses history only.

## Design and behavior

Follow Field Instrument v2: the record list is the primary content. Summary
numbers sit in three unfilled columns separated by hairlines. The existing
trend sentence remains secondary; all calculations and best-score context remain.
The average caption is shortened to “1本あたり”.

The native “絞り込み” disclosure starts closed. Selected filters keep it open after
rerender, and the summary shows the active condition count. Labels now identify
the equipment, distance and round selects. Focus is restored after changes;
clearing all filters returns focus to the disclosure. Existing filtering and
pagination logic are retained.

Alternatives considered: shrinking type further would hurt outdoor reading;
removing aggregate information would lose useful context. Compact presentation
plus optional filter controls preserves both. Product gates: scoring and trend
information remain connected; growth stays visible; processing remains local;
the daily history task takes less scrolling.

## Evidence

These images use built-in fictional demo data, 375 × 812 Chromium, with finite
animations completed before capture. They contain no user records.

- [Before](../screenshots/history-quality/before-375.png)
- [After, light](../screenshots/history-quality/after-375-light.png)
- [After, dark](../screenshots/history-quality/after-375-dark.png)

Three recent demo entries are now readable in the first viewport. Additional
360px and 1280px light/dark captures are in `artifacts/mobile-polish/`.

## Validation

- New light/dark interaction tests failed before implementation because the
  filter disclosure did not exist; both pass afterward.
- Tests verify keyboard opening, selecting a distance narrows three records to
  one, active-condition count, focus restoration, clear/reset, no horizontal
  overflow, and opening a record detail.
- `npm run build:web-assets`: `Web assets ready: style.min.css (64390 bytes)`.
- `npm run check:ui`: `UI smoke checks OK (chrome.exe)`.
- `npm run check:app`: `Archery Note checks OK (v85)`.
- `npm run lint`: exit 0 after using `globalThis` in the browser test callback.
- `PORT=4175 npm run test:e2e`: `85 passed (1.0m)`.
- Independent read-only review: no blocking findings.

Changed runtime files: `scripts/50-record-view.js`,
`scripts/60-history-sight-view.js`, `style.css`, and regenerated `style.min.css`.
Regression test: `tests/e2e/history-layout.spec.js`.
No score calculation, data format, save behavior, dependency or release change.

Next visual target: the record-start screen currently repeats the previous
distance and presents two visually strong start actions. Refine that hierarchy
without changing how practice starts.
