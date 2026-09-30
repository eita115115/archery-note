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
