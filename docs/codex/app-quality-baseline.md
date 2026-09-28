# App quality baseline — 2026-09-28

## Objective and boundaries

Make daily practice faster, easier to read, and more useful for seeing growth.
The user delegated performance and appearance improvements, including Computer
Use. Do not spend money or use personal information without explicit consent.
Use synthetic records for verification. Keep processing local.

## Repository reconciliation

The original checkout is `fa47bed4` on `feat/adaptive-release-detection` (v84).
Local `main` is `66eb29bf` (v85), six commits ahead of that checkout. Improvements
start from `main` in the managed `app-quality` worktree on `codex/app-quality`.
The original checkout's three modified documents and `debug.log` were preserved.
Its zero-byte Git index lock dated September 4 was not removed.

| Integration area        | Current evidence                                              | State                                            |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Inventory               | HEAD/main comparison and this report                          | Complete                                         |
| OSS and branding        | Existing notices and Archery Note shell                       | Implemented; retain existing checks              |
| CI                      | check:all, lint, format and Playwright in CI workflow         | Implemented; clean-checkout failure below        |
| Accessibility and shell | Five tabs, zoom enabled, narrow-width UI checker              | Implemented; visual audit continues              |
| PWA                     | v85 markers; immediate skipWaiting and clients.claim remain   | Staged activation still pending; separate scope  |
| Storage                 | Schema 5, default settings merge fixed, round-trip checker    | Implemented; preserve existing records           |
| Analysis                | Analysis tab, growth and today's-result functions/checks      | Implemented; responsiveness not yet measured     |
| Pose assets             | Local assets and THIRD_PARTY notices exist                    | Implemented beta; physical acceptance still open |
| Final acceptance        | Main ledger reports v85 release; no fresh remote verification | Not complete for this improvement effort         |

The old Phase Ledger in `codex-progress.md` is historical. In particular its
claims that schema migration has not started and that pose assets do not exist
must not be used as current implementation facts. The design source is
`docs/design/ui-design-language.md`, not the old `docs/ui-design-language.md` path.

## Baseline evidence

- Original v84 checkout: `npm run check:all` passed. Output is in its
  `artifacts/improvement-baseline/check-all.txt`.
- Fresh v85 worktree: app, globals and analysis passed; `check:form` failed with
  `Error: replay pose continuation cannot restart after freeze or close`.
- `git ls-files --eol` reports `i/lf w/crlf` for `scripts/47-form-view.js` in the
  fresh worktree. The failing source assertion at `tools/check-form-core.js`
  matches a literal LF. Confirm the newline hypothesis before fixing it.
- A 375 × 812 initial-screen screenshot was captured in the original checkout
  at `artifacts/improvement-baseline/record-375.png`. This is a before image,
  not proof of any improvement.
- Local cold resource observation, with Service Worker blocked: form core
  124501 bytes and form view 72608 bytes transferred during initial launch.
  This identifies a candidate for lazy loading, not a measured speed gain.
- Computer Use opened the local app. A follow-up onboarding click did not
  visibly advance the screen; no console error was returned. Reproduce in
  an isolated automated test before classifying it as an app defect.

## Improvement order

1. Make the clean Windows checkout's validation reliable. Demonstrate the
   failure and fix across LF/CRLF without weakening the guarded behavior.
2. Measure initial load and tab changes using synthetic histories; choose the
   largest repeatable delay. Consider deferring pose code only after mapping
   dependencies, offline assets, failure recovery, and analysis entry points.
3. Audit the 375px start, target, history and growth screens in light/dark modes.
   Refine hierarchy, spacing and touch feedback within Field Instrument v2.
4. Validate score entry, undo, end save, reload and backup round trips before
   any release candidate. Record before/after images and actual measurements.

Alternatives considered: a broad visual rewrite would make regression review
harder; adding features would add complexity before existing use is smoother.
Choose measured performance plus focused visual refinements. Product gates:
retain connections between scoring, equipment and analysis; make existing growth
insights easier to reach; process everything locally; favor quiet daily utility.

No application behavior changed in this inventory checkpoint. No release,
dependency addition, personal-data access or paid service was performed.
