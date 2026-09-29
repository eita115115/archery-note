# Mobile secondary controls — 2026-09-30

Following the user's UX priority, expanded the visible hit boxes for settings,
equipment shortcut, record details and live HUD details. Shared advanced disclosure
summaries also have at least the existing 44px touch target token. Header text keeps
space for the larger settings control. Labels, icons and interaction handlers remain.

The initial 375px audit found settings 36×36, equipment 46×34, record disclosure
78×26 and live details 35×20. These now meet 44px width/height. Hint close has an
existing pseudo-element extending its hit area, so its narrower visible box was
not treated as a defect. This audit is not a full accessibility conformance claim.

Evidence:

- `docs/screenshots/touch-quality/`: 375px before/after, record light and live dark.
- `artifacts/touch-audit/`: initial/updated measurements and additional captures.
- check:ui passed at 360/390/1280px; lint passed.
- Focused interaction suite: `10 passed (4.1s)`, including edge clicks on details
  and settings, 360/375px light/dark, no horizontal overflow.

No scoring, storage or data changes. Local change, not deployed with v86.
