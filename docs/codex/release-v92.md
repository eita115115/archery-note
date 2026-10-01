# v92 release candidate

Candidate3394f67; implementationac1b1c8. Public app remainsv91.
Initial guide now follows score chips and nudge controls so revealing recorded
arrows does not scroll the target out on short screens. Guide remains open by
default and its next-time dismissal preference is preserved.

Validation:

- check:all/lint/format passed; native web bundlev92 built.
- Full Chromium:106 passed (1.1m).
- Consecutive two-end/six-arrow sequences: Chromium2 passed (17.2s), WebKit2 passed
  (16.9s), at320x568 and375x812 with ordinary animation and initial guide open.
- Independent review: no actionable findings; isolated4 passed (17.5s).
- Actual v91→92 worker transition retained three synthetic sessions, removed old
  cache and supported offlinev92 reload.
- Before/after375px screenshots:docs/screenshots/end-sequence/.

No scoring, storage schema, dependency or personal-data changes. Physical iPhone
experience remains unverified. Userv91 feedback request still unanswered.
Evidence:artifacts/release-v92/ and docs/codex/end-sequence.md.
Next: publication approval, then push and deployed CI/interaction verification.
