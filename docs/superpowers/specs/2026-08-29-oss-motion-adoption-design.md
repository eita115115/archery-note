# OSS Motion Pattern Adoption Design

Date: 2026-08-29
Status: approved for implementation
Product: Archery Note (iPhone-first field instrument)

## Intent

Improve the app's existing interaction feedback by adopting proven open-source
motion patterns without adding a runtime animation dependency. Motion must make
state changes legible during practice, not turn the score-entry surface into a
showcase.

The product guardrails are explicit: the work should connect existing score,
form, analysis, and sight-adjustment flows; make saved state and deltas easier
to notice; remain fully local; and stay useful for daily practice. No motion
change may alter scoring, detector decisions, persistence, transport, or user
data.

## Research and decisions

The following projects and standards were reviewed on 2026-08-29:

| Source                                                                                                                                                           | Useful pattern                                                                             | Decision                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [AutoAnimate](https://github.com/formkit/auto-animate) (MIT)                                                                                                     | DOM enter/leave/reorder transitions with a small integration surface                       | Adopt the lifecycle idea only. Do not add its MutationObserver runtime because form/save flows require exact teardown timing.               |
| [Motion](https://github.com/motiondivision/motion) (MIT)                                                                                                         | Hardware-friendly `opacity`/`transform`, springs, stagger, and explicit animation controls | Adopt the property/easing discipline and explicit state boundaries. Do not add the package to this vanilla app.                             |
| [Anime.js](https://github.com/juliangarnier/anime) (MIT)                                                                                                         | SVG-aware keyframes, timelines, and easing                                                 | Adopt the restrained SVG impact-ring idea where useful. Keep the existing DOM/CSS clock.                                                    |
| [Lottie Web](https://github.com/airbnb/lottie-web) (MIT)                                                                                                         | JSON-authored After Effects playback                                                       | Reject for this scope: asset payloads and renderer lifecycle are too heavy for short field feedback.                                        |
| [Animate.css](https://github.com/animate-css/animate.css)                                                                                                        | Broad CSS animation catalog and reduced-motion guidance                                    | Reject the package: the current repository license is Hippocratic License, not the clear MIT/Apache-style license required here.            |
| [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) and [W3C specification](https://www.w3.org/TR/css-view-transitions/) | Browser-native visual state transitions with progressive enhancement                       | Reserve for a later, capability-gated experiment; existing SPA focus/live-region behavior remains safer with the current explicit sequence. |
| [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)                                    | Standard user preference for reducing non-essential motion                                 | Adopt as a required global guard and test contract.                                                                                         |

No source code or animation asset is copied from these projects. The
implementation uses the patterns as design references and keeps the app's
existing CSS/DOM conventions.

## Chosen architecture

### Shared motion tokens

Add or consolidate a small token set in `style.css`:

- `--motion-fast`: control feedback, approximately 180 ms
- `--motion-med`: view/state transition, approximately 280 ms
- `--motion-fluid`: result/reveal transition, approximately 420 ms

Existing selectors consume these variables instead of scattering literal
durations. Only `opacity`, `transform`, color, border, and shadow transitions
are eligible. No layout-affecting animation (`width`, `height`, `top`, `left`,
or reflow-dependent measurement) is introduced.

### Interaction surfaces

1. **Score entry / target:** a new arrow gets a short impact ring and directional
   ray inside the existing fresh-marker lifecycle. The visible arrow circle,
   score calculation, coordinates, and timer ownership remain unchanged. The
   temporary overlay must be removed when the existing fresh timer expires.
2. **Form analysis:** capture/replay overlays expose explicit `ready`,
   `analyzing`, `saved`, `canceled`, and `failed` states. Completion feedback is
   rendered before teardown, freezes input immediately, and cannot save twice.
   Diagnostic retry/discard and receipt failure paths retain their current
   transaction ordering.
3. **Analysis/history/sight:** tab changes and result cards use a short
   opacity/translate reveal. Existing `showView()` order stays
   `render → remove class → force reflow → add class`, preserving focus and
   deterministic DOM state.
4. **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables
   decorative animation and transitions while preserving content visibility,
   HUD text, status announcements, and action availability.

### Dependency and data boundaries

- No new npm dependency, CDN script, remote asset, or native plugin.
- No storage schema/key, backup/import/export, Service Worker, detector,
  scoring, or transport change.
- Motion state is ephemeral DOM state only; it is never persisted.
- All generated SVG/DOM overlays are `aria-hidden="true"` and
  `pointer-events:none` unless they are actual controls.

## Error and lifecycle behavior

- A failed save leaves the existing retry UI and data untouched; motion must not
  mask an error or make a retry impossible.
- A close/cancel action tears down camera/video work exactly once. The visual
  cancellation state may remain for one paint window, but no additional save or
  detector work can start during that window.
- A missing View Transition API or unsupported animation property is a normal
  fallback to the existing immediate DOM update.
- Repeated arrow placement refreshes the existing timer and removes only the
  corresponding temporary impact overlay; stale overlays must not remain in the
  target SVG.

## Validation and acceptance

The implementation is accepted when all of the following are true:

- `npm run check:ui` passes at 360×780, 390×844, and 1280×800.
- `npm run check:app`, `npm run check:form`, `npm run lint`, and
  `npm run format:check` pass.
- Focused browser checks cover impact cleanup, tab visibility/no horizontal
  overflow, analysis states, double-save prevention, and reduced motion.
- `git diff --check` passes.
- A source review confirms no layout, storage, scoring, detector, transport,
  Service Worker, dependency, or user-data changes.
- Physical iPhone HTTPS acceptance remains a separate release gate; browser
  tests do not claim to replace it.
