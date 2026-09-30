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

## Publication result

Explicit user approval received. Pushed `40524d63` to main. Live version 87 and
six runtime assets match local source. Fresh deployed-site Chromium verifies
44px settings control, same-row HUD metrics, demo history/practice start, offline
reload, retained session/active data and zero page errors. Evidence:
`artifacts/release-v87/deployed-check.txt` and `deployed-active.png`.
Earlier approval-pending statements above are historical candidate checkpoints.

## CI portability correction

CI 36596832332 failed four touch-width cases (40px instead of 44px), while 93
other tests passed. The equipment shortcut had a minimum height but no minimum
width, so its width depended on installed font metrics. Added explicit minimum
width to .tinyAction. Bumped to v88 so clients that already received v87 can update.
This is a corrective follow-up within the approved UX publication.

## Final corrective publication: v88

v88 `b7783989` is live. Pages run 36674413781 succeeded. Linux CI run
[36674414490](https://github.com/eita115115/archery-note/actions/runs/36674414490)
succeeded with `97 passed (1.1m)`, including the four width checks that failed on v87.
Local check:all/lint/format passed; refreshed web bundle built successfully.
Actual local v87→88 worker transition preserves demo data and offline startup.
Fresh live-site verification confirms six assets match, settings/shortcut minimum
sizes, same-row metrics, demo history/start, offline reload and zero page errors.

The first live dimension probe measured 43.648px during the 0.992-scale entrance
animation; after awaiting finite animations it measured 46×44px and passed.
This probe timing issue is separate from the original Linux 40px width defect.
Failure and final evidence: artifacts/release-v87/ci-failed.txt and
artifacts/release-v88/{deployed-debug.txt,deployed-check.txt,transition.txt,ci.txt}.
