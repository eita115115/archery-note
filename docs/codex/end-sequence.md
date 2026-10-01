# Short-screen consecutive recording

Follow-up to v91: test two three-arrow ends without scrolling at320x568 and375x812.
With the initial guide open, Chromium reproduced only2.47px of target remaining
visible after the first arrow. refreshActive revealed score chips below the long
guide, pushing the target above the viewport.

Moved initial guide below the arrow chips and nudge controls. Instructions still
open by default and the dismiss preference is unchanged. Scoring/persistence and
scroll helpers are unchanged. This keeps recording next to the target, supporting
the history/analysis data flow and daily progress with fully local processing.

Validation: Chromium2 passed (17.2s); WebKit2 passed (16.9s), actual screen-coordinate
six-arrow/two-end completion at both sizes. check:ui/check:app/lint passed.
375px before/after screenshots:docs/screenshots/end-sequence/.
The test formerly failed on Chromium320; WebKit was not a reliable reproduction
of the original geometry timing. An initial source replacement failed to remove
the original guide due line-ending mismatch; corrected placement is unique.

Local only. Public version remains91. Full release checks and update validation
remain before publication approval. Physical iPhone experience remains unverified.
