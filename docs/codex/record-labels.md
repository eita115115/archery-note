# Named starting conditions — AN-051

Previous goal turn made progress: AN-050 notification placement/contrast and
tab-return regression completed and locally committed dfa4636. Public97 remains
dd3cda12. This task connects the two primary record-form labels to their selectors.
Existing broad approval covers this bounded UX correction; no permission question.

## Design and plan

The visible labels are “的” and “1エンドの本数”; their selects are fFace/fArrows.
Both labels currently lack for, so accessibility names and select.labels are empty.
Chosen: add native for associations to existing IDs. An extra aria-label would
duplicate text, while wrapping the select in a label changes markup unnecessarily.
Keep text, layout, options, selection handlers and start-condition logic unchanged.

Vision gates considered: this improves the existing daily scoring-to-analysis
workflow rather than adding a standalone feature, preserves local processing,
and avoids distraction. No new growth metric is introduced. No fees, telemetry,
external inference, private data or dependencies. Existing visual design stays.

1. Regression through role/label names, including visible choices and persisted
   starting conditions, native keyboard focus order and old synthetic records.
   Mobile320/375 in both engines plus desktop keyboard. Capture375 before/after.
2. Establish missing-name failures, then add the two for attributes.
3. Run the focused/related record cases and UI/app/lint/format checks, inspect
   screenshots. Independent read-only review, evidence/task/progress/history.

This is semantic markup only, without scoring/storage/version/worker changes.
Actual iPhone/VoiceOver experience remains unverified. AN-053 performs the approved
release acceptance for this and the already implemented notification improvement.

## Implementation and acceptance — 2026-10-02

Runtime diff: only for="fFace" / for="fArrows" on the existing labels. Text,
options, CSS, handlers, scoring/storage/version/worker/dependency source unchanged.
The two names resolve through both role and label locators in Chromium/WebKit.

```text
Archery Note checks OK (v97)
UI smoke checks OK (chrome.exe)
All matched files use Prettier code style!
14 passed (13.4s)
375 image bytes match: True
```

Six new cases:320field40/perEnd4,375triple40/perEnd3,900single80/perEnd12 in both
engines. Verify names, native Tab/Shift+Tab/Enter focus/start, visible choice text
and stored conditions, exact three prior synthetic sessions and active on reload,
no page errors. Eight related cases verify repeat/current-condition starts in
light/dark. New cases use reduced motion because no animation changes are involved.
Selection uses semantic selectOption; this does not establish native OS picker,
physical mobile keyboard or VoiceOver experience.

Both375 screenshots were viewed and are byte-identical:
[before](../screenshots/record-labels-before-375.png),
[after](../screenshots/record-labels-after-375.png). Their initial values/layout
are unchanged; final chosen values are separately established by test assertions.
Native focus navigation is verified in the headless browser, not on an iPhone.

Initial red6 all fail named combobox count (expected1, received0), then14green.
Raw red/green/app/UI/lint/format and screenshot outputs under artifacts/record-labels.
A guessed analysis-labels.spec.js search target was absent; actual relevant files
were located with rg --files. No app failure was inferred from the missing path.
Independent read-only review found no concrete P1/P2 and inspected final14 output;
no reviewer edits or reruns. No fees or private data were used.
Final audit confirms only the two native associations changed runtime,104
source/test/dependency files match the owned sandbox, shared hidden lock unchanged,
existing task acceptance retained and preview8756 closed. Remote main still equals
dd3cda12 at this checkpoint. Final documentation format check passes.

AN-051done locally. Public97 remains unchanged. AN-053 is now ready for approved
next-version full acceptance, actual update/offline routes and publication/live
checks covering both AN-050 notification and AN-051 input-label improvements.
Broad goal remains active; actual iPhone/VoiceOver/keyboard/INP/large storage and
separate scoring/practice/ZIP/dependency work remain unproven or open.
