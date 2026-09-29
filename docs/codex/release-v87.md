# v87 candidate — 2026-09-30

Local candidate `ca09791`, not published. Current remote main remains `1fe998b6`
(v86), checked before preparing the candidate.

Changes: secondary mobile controls have at least 44px touch boxes; active practice
End / Total / Remaining metrics stay in one row on narrow screens. At 375px this
moves the target upward about 71px. Screenshots and detailed tests:
`mobile-touch-controls.md`, `live-hud-layout.md`.

Validation:

```text
Version alignment checks OK
95 passed (1.0m)
PASS: real v86 → v87 worker transition, old cache removal, 3 demo sessions retained, offline v87 reload
```

check:all, lint, format:check passed. Web/CSS builds passed. All four version
markers and lockfile agree. Logs: `artifacts/release-v87/`.
Independent review found no actionable regressions. Its coverage note: the new
edge-click tests do not directly test target placement near fixed bottom controls;
existing application smoke tests cover target placement and session progression.
Physical iPhone validation remains outstanding.

No scoring/storage/worker activation changes, dependency additions, money or
personal data use. The prior approval applied to v86; v87 publication awaits approval.

## Fixed action dock follow-up

Closed the review coverage gap with actual screen-coordinate clicks, avoiding
Playwright locator auto-scroll: 360/375×640 viewports, target point 12px above the
fixed action dock, hit-test confirms the target receives the click. Exactly one
arrow is stored, then the visible dock undo removes it. `6 passed (6.7s)` across
the touch suite, lint passed. No app change needed. Logs: dock-e2e.txt and
dock-lint.txt under artifacts/release-v87/. Publication approval remains pending.
