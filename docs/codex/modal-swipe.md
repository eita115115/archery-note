# Swipe-to-close sheets — v89 candidate

Requested UX: close settings and similar sheets by swiping. Implemented a sticky,
44px-high handle at the top of ordinary sheets. It can be pulled downward or
activated as an accessible close button. Camera/replay full-screen formCapture
surfaces are excluded.

The handle alone owns pointer gestures, so normal scrolling, inputs and charts
keep their existing interactions. A downward displacement of at least 80px,
with vertical movement greater than 1.25× horizontal, dismisses. Short, sideways
or cancelled drags reset without closing. A drag suppresses its follow-up click.
Only the topmost modal handles dismissal.

Dismissal calls the existing escapeTarget button, preserving each sheet's existing
save/cancel/confirmation behavior. Nested confirmations cancel rather than confirm.
Keyboard-opened dialogs retain existing focus restoration. The initial sheet
animation is stopped on drag to avoid replaying it when an incomplete pull resets.

Validation and evidence:

- New two-case tests failed before implementation; passed after.
- Chromium touch suite: 3 passed, including native CDP touch move/end/cancel.
- WebKit: 2 passed, 1 intentionally skipped (CDP-only touch test).
- Long settings scrolling keeps the handle visible; closing still works.
- Before/after 375px screenshots: `docs/screenshots/modal-swipe/`.
- Independent review found no actionable correctness/data-loss issues.
- Logs: `artifacts/modal-swipe/` and earlier `artifacts/webkit-ux/swipe-*`.

Separate baseline limitation: before this change WebKit passed 18 of 20 broader
UX tests, failing two existing mouse-opened focus restoration expectations.
These baseline failures are retained in artifacts/webkit-ux/results.txt. This
change does not claim to fix them. Physical iPhone touch behavior remains untested.

No storage schema, scoring, dependency or personal data changes. v89 is local;
current published version remains v88 until publication is approved.
