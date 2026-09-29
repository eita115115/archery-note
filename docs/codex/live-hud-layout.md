# Active practice HUD — 2026-09-30

The mobile generic grid rules were overriding the three-column score HUD. At
375px the remaining-arrow count wrapped to another row; narrower layouts could
stack all three values. This moved the target down without adding information.

Changed the selector from `.liveGrid3` to `.liveGrid.liveGrid3`, so the three
explicit HUD columns win against the generic responsive grid rules. No markup,
scoring, storage or event-handler changes. The recent 44px details control remains.

Evidence:

- Before/after 375px light/dark screenshots in `docs/screenshots/live-hud-quality/`.
  The dark screenshot's target top moves from about 381px to 310px.
- New same-row assertion failed in all four 360/375px light/dark cases before fix.
- Touch controls + app smoke: `12 passed (13.1s)`, including scoring, session finish,
  history, multi-distance progression and settings interactions.
- check:ui and lint passed. Evidence logs under `artifacts/touch-audit/hud-*`.

Local-only improvement; published v86 is unchanged. Physical iPhone still untested.

Validation correction: the first lint run found two undeclared browser globals in
the test callback (document/innerWidth). Changed them to globalThis references;
final lint passed and the four touch/HUD cases passed again. Failure output is
retained in hud-lint.txt; final output in hud-lint-final.txt.
