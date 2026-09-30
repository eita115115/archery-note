# Tab reading-position investigation

375px / 812px, fresh synthetic demo expanded to 60 sessions. Open history,
scroll to 1400px, switch to analysis, then return to history.

Both Chromium and WebKit reproduced:

- History position: 1400px.
- First analysis visit: 1400px (its beginning is hidden).
- Return to history: 0px (reading position is lost).

Existing showView replaces main contents without managing scroll position.
Desired behavior: first visit starts at zero; returning restores each tab's
position, stored only in memory. This supports comparing history with analysis
and daily progress without additional controls or external processing.

Experiments did not establish a valid fix:

1. Immediate scroll restoration: analysis starts correctly, history restores to 0.
2. Two animation frames: can overwrite a user's subsequent scroll.
3. Temporarily visible direct cards: history restoration still fails.

Observed document height immediately after returning to 50 rendered history
rows is only 812px, despite the longer content after layout. content-visibility
is present, but its exact role has not been proven as the sole cause.
Do not introduce another timing workaround without isolating the layout cause.

Runtime experiments were reverted. Failing regression and probes retained at
artifacts/tab-scroll/; baseline output in before.txt. No release/version change.
Next: inspect computed heights/containment before and after render and isolate
which operation clamps the history position; then implement and validate.

## Verified local fix

The immediate post-render history cards were each 272px high (240px intrinsic
placeholder plus padding/border); after paint the record card was about 3678px.
Restoring content-visibility immediately reintroduced those placeholders.

showView now saves each tab's nonnegative scroll offset in ui memory. First visits
start at zero. Returning below the top lays out direct cards with visible content
until their next render, then restores synchronously. No deferred scrolling can
overwrite subsequent input. No storage keys or scoring behavior change.

Validation: Chromium 2 passed (3.3s), WebKit 2 passed (3.9s), normal and reduced
motion. Earlier combined Chromium smoke/swipe/scroll run: 13 passed (12.2s).
Initial WebKit normal-motion test attempted scrolling before first layout; it
now waits for the history card height before the initial scroll. check:ui,
check:app, lint and test formatting passed. Initial lint errors in test browser
globals were corrected to globalThis. Data equality checked after navigation.

Before/after 375px captures in docs/screenshots/tab-scroll/. Source comparison
blocks Service Workers so baseline routing cannot be bypassed by cached assets.
Synthetic 1000-session probe: synchronous warm return samples about 7–10ms
before, 9–12ms after, first sample 17.5ms both. This is a small local measurement,
not a mobile performance guarantee. The added layout cost trades lazy layout on
restored views for correct reading position; first visits retain lazy rendering.

Local implementation only; v89 remains deployed. Full release validation and
version bump remain before a publication request.
