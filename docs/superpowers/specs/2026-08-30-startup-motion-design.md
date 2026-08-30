# Startup motion design

## Status

Approved concept. The user selected the combined logo splash and immediate
screen entrance direction.

## Goal

Make a normal Archery Note launch feel intentional without delaying practice:
show the existing mark briefly, then reveal the ready-to-use record screen.
Startup motion is presentation-only and must not touch practice data, scoring,
camera, or network behavior.

## Product gates

1. **Connect existing features:** the splash hands off directly to the existing
   initial record view; it introduces no separate onboarding flow.
2. **Make growth visible:** the launch is quiet orientation, while score and
   analysis deltas remain the existing sources of progress feedback.
3. **Stay local:** use the existing `icon.svg`, inline DOM/CSS state, and the
   current local initialization path. No remote asset or runtime dependency.
4. **Daily use:** cap the sequence at roughly 500–600 ms and keep the record
   controls available as soon as the handoff completes.

## Chosen direction

Use the existing icon as a fixed, full-viewport splash followed by a subtle
header/main entrance. The splash enters with `opacity + scale(.94 → 1)`, exits
with `opacity + scale(1 → 1.02)` over about 180 ms, and the ready screen enters
with `opacity + translateY(4px → 0)` over about 280 ms. The palette comes from
the active theme variables; no gradient, sound, haptic, confetti, or looping
animation is added.

Alternatives considered were a content-only fade (fastest but less branded) and
a long animated splash (more branded but inappropriate for a range tool). The
combined direction was chosen because it preserves quick access while giving a
clear launch boundary.

## Lifecycle and architecture

- Add a `bootSplash` element to the initial HTML using the existing icon and
  accessible status text. It is visible before deferred scripts run.
- Keep the existing `bootFallback` as the slow/error path. The splash must not
  cover it after the fallback delay.
- After the existing initial `render()` completes in `90-init.js`, add a
  transient ready class, allow one paint, then fade/remove the splash. The
  existing `main.viewEnter` sequence remains the only view-render transition.
- Remove the splash node after its exit boundary so later tab changes do not
  replay startup motion. Re-entry after a browser restore must not create a
  second splash.
- Keep all startup state ephemeral. No `db` fields, timers in persistence,
  scoring calls, detector calls, camera calls, or transport calls are added.

## Accessibility and resilience

- `prefers-reduced-motion: reduce` disables scale/translate and transition
  timing, makes the splash and initial content immediately visible, and keeps
  the HUD, controls, and explanatory text visible.
- The splash is decorative except for a short `aria-live` status; the existing
  page heading and controls remain the accessible source of truth.
- Underlying page content cannot receive pointer input while the splash is
  present; the splash itself has no actionable controls. It must not change
  the target or form hit areas after removal.
- If initialization is delayed or fails, the existing fallback text and reload
  action win over decorative motion. No blank or permanently blocked state is
  acceptable.

## Validation

1. Add static contracts for the splash markup, timing tokens, removal hook,
   reduced-motion rules, and production `style.min.css` synchronization.
2. Add Chromium checks for normal startup handoff/removal, reduced-motion
   immediate content, delayed fallback reachability, and 360×780/390×844/
   1280×800 no-overflow.
3. Run `npm run check:all`, `npm run lint`, `npm run format:check`, and
   `git diff --check`, recording any pre-existing formatting warning separately.
4. Confirm no changed storage, scoring, detector, transport, Service Worker,
   or native behavior in the final diff.

## Out of scope

- New images, fonts, sounds, haptics, dependencies, or network calls.
- Changes to scoring, release detection, form analysis, storage schema,
  backups, transport, Service Worker, or native shells.
- A persistent splash, onboarding tutorial, or broad navigation rewrite.
- Physical iPhone HTTPS acceptance, which remains a separate release gate.
