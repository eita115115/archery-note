# Field-instrument motion layer design

## Status

Approved concept. This document fixes the scope before implementation.

## Goal

Give Archery Note a more confident, polished feel without turning a range tool
into a game. Motion should make cause and effect easier to read:

- a recorded arrow visibly lands where the score was calculated;
- form analysis communicates ready, analyzing, saved, and failed states;
- view changes preserve orientation instead of appearing as abrupt redraws.

The design must remain useful outdoors, one-handed, and at narrow iPhone widths.
It must not alter scoring, release detection, storage, transport, or persisted
data.

## Product gates

1. **Connect existing features:** the motion follows existing score, target,
   form-analysis, and today's-result events; it introduces no isolated feature.
2. **Make growth visible:** score impact and saved-analysis states expose the
   latest practice change without badges, streak fireworks, or gamification.
3. **Stay local:** all motion is CSS/DOM state already rendered by the local
   PWA. No network, model, analytics, or external asset is introduced.
4. **Daily use:** the first frame stays fast and quiet; motion is short,
   interruptible, and never blocks score entry or saving.

## Chosen direction

Use a restrained “field instrument” motion language: ink, paper, hairline gold,
small translations, and short easing curves. Existing tokens and animations in
`style.css` are extended rather than replaced. No gradients, confetti, audio,
large glows, layout shifts, or continuously moving decorative elements.

### 1. Impact and score motion

The existing `.shotNew`, `.sc.fresh`, and quadrant classes remain the source of
truth for a newly recorded arrow. Add a thin impact ring and a short radial
line treatment in the target SVG/score presentation, using the same arrow
coordinates and radius that are already displayed. The effect runs once for
the newly recorded arrow and then removes itself with the existing freshness
timer. A re-render, edit, nudge, or history view must not replay it unless the
existing “fresh” state is set again.

The numeric score receives one compact tick/pop synchronized with the impact.
The score text must remain readable during the entire animation and must not
change the target's dimensions or pointer hit area.

### 2. Form-analysis state motion

The form capture overlay receives explicit state classes/data attributes only:

- `ready`: a static hairline reticle/guide;
- `analyzing`: one restrained scan line with a finite duration, not an infinite
  busy spinner;
- `saved`: a single ring completion followed by the existing status/toast;
- `failed` or `canceled`: stop motion immediately and retain the existing error
  or retry copy.

The state is visual only. Existing frozen-save, retry, receipt-failure, and
diagnostic-off branches remain authoritative. A second save attempt must not
start a second animation until the previous state is cleared.

### 3. View and result motion

Keep the existing `main.viewEnter` and staggered list motion, but make the
shared motion timing explicit through variables so tab changes, today's-result
reveal, and compact list additions use one rhythm. The order is:

1. view shell;
2. primary conclusion or current-end status;
3. supporting rows/details.

No content is hidden only for animation. If motion is disabled or interrupted,
all content remains immediately visible.

## Architecture and data flow

### Files in scope

- `style.css`: keyframes, motion tokens, target/score/form state selectors,
  and reduced-motion overrides.
- `scripts/50-record-view.js`: preserve the existing fresh-arrow lifecycle
  and add only the visual impact state hook at the render boundary.
- `scripts/47-form-view.js`: add visual state attributes at existing capture,
  save-success, retry, failure, and teardown boundaries; do not change save
  candidates or coordinator data.
- `scripts/50-record-view.js`: add the today's-result reveal hook at its
  existing mount boundary; no analysis calculation changes.
- `tools/check-ui.js` and focused E2E/UI fixtures: source contracts and
  mobile-width behavior checks.
- `docs/codex/codex-progress.md`: one small-task ledger entry.

### State flow

Existing product events remain the input:

`record arrow -> freshArrow -> target render -> impact classes`

`form workflow event -> visual state attribute -> CSS animation -> existing
status/toast`

`showView/render -> viewEnter -> existing staggered children`

No event writes to `db`, no new schema fields, and no new global timer is
introduced. Any timer needed for a visual class must be owned by the existing
freshness/overlay lifecycle and cleared on teardown.

## Accessibility and resilience

- Add `@media (prefers-reduced-motion: reduce)` coverage for every new keyframe,
  forcing zero duration/transform while keeping opacity and content visible.
- Never rely on color or motion alone; existing text, score, `aria-live`, and
  disabled states remain unchanged.
- Do not animate focus indicators, pressed state, or destructive confirmations
  in a way that delays keyboard or touch operation.
- Respect iOS Safari's safe-area layout and avoid `position: fixed` overlays
  that change the capture hit target.
- Motion must tolerate a quick re-render, tab switch, replay cancellation, and
  save retry without stale classes surviving on a new overlay.

## Validation

Before implementation is considered complete:

1. Add/update focused static contracts for the new selectors/state hooks.
2. Run `npm run check:ui` and `npm run check:app`.
3. Run `npm run check:form` because capture visual states touch the form view,
   even though the detector and persistence logic are unchanged.
4. Run `npm run lint`, `npm run format:check`, and `git diff --check`.
5. Run focused Chromium checks at 360x780, 390x844, and 1280x800 for:
   - arrow placement and edit/nudge;
   - form ready → analyzing → saved;
   - form retry/failure/cancel;
   - tab switch and today's-result reveal.
6. Verify reduced-motion mode exposes the same content with no blocking
   animation and that no score, receipt, coordinator, database, or transport
   payload changes occur.

## Out of scope

- detector thresholds, release evidence, scoring radius, or line-cutter logic;
- storage/schema/migration, backup, download, native transport, or Service
  Worker changes;
- new dependencies, fonts, images, sound, haptics, analytics, or network calls;
- broad component rewrites or tab/navigation changes;
- physical iPhone acceptance, which remains a separate release gate.
