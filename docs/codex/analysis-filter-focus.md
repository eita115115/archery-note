# Analysis filter labels and focus — 2026-10-01

Local implementation:268b79679525bf8f9baf87a67e27db2711d7a7d9, baseline1d9c9ad1.
Branch codex/analysis-filter-focus reuses the existing isolated checkout; the
independently publishable codex/app-quality branch remains at1d9c9ad1. No new
checkout was created. Public applicationv94 is unchanged.

## Correction

scripts/50-record-view.js associates the existing 用具/距離 labels with anSetup/
anDist. Each change handler captures whether its selector was focused before
render, then restores only that focused selector with preventScroll. External
changes do not steal focus. Options, layout, aggregation and filtering semantics
remain unchanged. This repairs the existing daily equipment/distance comparison
flow; no standalone feature or external processing is introduced.

tests/e2e/analysis-filter-focus.spec.js verifies names, setup/distance selection,
clear-to-all, actual filtered session/arrow counts, Tab order, period selection,
focus retention and non-stealing, unchanged synthetic records and no overflow/
page errors at320×568/light and375×812/dark. The active fixture is null; this test
does not claim to verify an in-progress arrow or physical iPhone/VoiceOver.

## Verification

The regression failed before implementation for absent named controls and lost
distance focus, then passed in Chromium and WebKit. Candidate checks ran in the
owned artifacts/dependency-update/sandbox with the same three updated packages;
source/test bytes match the committed fix. No install mutated the root junction.

```text
Before correction: 4 failed (expected label/focus assertions)
New regression + related history/analysis/scroll: 20 passed (15.0s)
Record/end/settings/touch flows: 32 passed (42.9s)
npm run check:app — exit0
Archery Note checks OK (v94)
npm run check:ui — exit0
UI smoke checks OK (chrome.exe)
npm run lint — exit0
npm run check:storage — exit0
Storage contract checks OK
Storage round-trip checks OK
Save debounce checks OK
```

Static independent review of1d9c9ad1→268b7967 found no actionable issue in labels,
conditional synchronous focus restoration, scope or regression coverage. The
reviewer did not rerun tests. This succeeded after the earlier audit's unavailable
review; the historical failure remains recorded in analysis-filter-audit.md.

Evidence: artifacts/analysis-filter-fix/{red-behavior,green-fixed,flows,check-app,
check-ui,lint-fixed,storage}.txt. Initial runner attempts failed from mixed root/
sandbox Playwright modules and a temporary config's server cwd; corrected to a
single module instance and explicit sandbox cwd. Initial lint flagged bare browser
globals in the new test; globalThis fixes passed lint. These setup failures remain
in red.txt, green.txt and lint.txt, separate from the meaningful red regression.
Windows wildcard/nonexistent-file read attempts were corrected using inventory.

The [375px before](../screenshots/analysis-ux-audit-375-dark.png) and
[375px after](../screenshots/analysis-filter-focus-375-dark-after.png) preserve the
visible layout. Browser role/focus assertions, not images, prove the correction.
Only disposable synthetic demo data was used.

Shared installed versions/hidden-lock hash are unchanged. Version, dependency,
styles, scoring, storage, worker and index files match baseline1d9c9ad1. No money
or personal information was used. Full release checks/version update/publication
for this UI fix are a separate next task; do not publish it with approval scoped
to the existing three dependency updates.
