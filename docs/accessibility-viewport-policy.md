# Viewport Zoom Policy

## Summary

Archery Note treats viewport zoom behavior as a score-entry safety concern, not
only as a browser setting. The app is used during practice and scoring, where
accidental zooming can shift the visible layout, change tap behavior, and cause
input mistakes.

For that reason, viewport changes that relax zoom behavior must not be made as a
standalone accessibility fix until there is a tested alternative that preserves
score-entry accuracy.

## Background

Archery Note is a scoring and practice-recording tool. During score entry, the
user is often tapping repeated controls while looking between the target, notes,
and the phone screen.

User feedback indicated that accidental zoom during score entry can lead to
mistakes. For this app, input accuracy is a core usability requirement because a
wrong score, sight value, or end note can affect later practice review.

Browser zoom support is important, but the score-entry surface has a real
accuracy risk that should be handled deliberately.

## Current Decision

Do not remove restrictive viewport behavior such as `maximum-scale=1` or
`user-scalable=no` as a standalone change yet.

Treat score-entry zoom stability as an intentional product decision. This is not
the final accessibility solution, and it should not be described as one.

Revisit the decision only with a tested alternative that preserves score-entry
accuracy across mobile Safari, Android Chrome, and desktop browsers.

## Accessibility Considerations

Zoom restrictions can reduce accessibility for users who rely on browser zoom.
The project should address readability and access needs through safer UI
improvements rather than ignoring them.

Preferred improvements include:

- larger readable text where needed
- larger tap targets
- clearer score-entry controls
- better spacing
- high-contrast readable states
- fewer accidental-touch paths
- manual testing at larger browser or font settings where possible

Future accessibility work should preserve the user's ability to enter accurate
scores under range conditions.

## Future Options

Potential future directions:

- allow zoom on read-only screens while preserving score-entry stability
- add a dedicated large-text or comfort mode
- improve the score-entry layout at 200% browser zoom before changing viewport
  policy
- explore input-area interaction patterns that avoid accidental zoom
- test viewport changes on mobile Safari, Android Chrome, and desktop browsers
- document screen-specific behavior if read-only and score-entry surfaces need
  different policies

Any future viewport change should include manual score-entry testing, not only a
static accessibility checklist.

## Non-Goals

This document does not change runtime behavior.

Non-goals for this docs-only step:

- no viewport change
- no app UI change
- no storage change
- no Service Worker change
- no version bump
- no release
- no tag
- no GitHub Pages update
