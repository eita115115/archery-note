# v92 release

Candidate3394f67; implementationac1b1c8. Published on 2026-10-01 after user
approval, from ae97bf617da289998ab395946476cb5f671cde92.
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
Publication verification:

- [Pages36796667134](https://github.com/eita115115/archery-note/actions/runs/36796667134)
  succeeded for ae97bf61.
- [CI36796668313](https://github.com/eita115115/archery-note/actions/runs/36796668313)
  succeeded: `106 passed (1.1m)`. check:all, lint and format passed.
- Live version92 and seven assets match the candidate. Touch dismissal of settings,
  synthetic session retention, offline reload and zero page errors confirmed.
- Live Chromium/WebKit, 320x568 and375x812: `4 passed (20.5s)` for six-arrow/two-end
  recording with the initial guide open, using screen coordinates without scrolling.
- Output: artifacts/release-v92/deployed-check.txt and deployed-sequence.txt.

Next: physical iPhone feel and real-practice acceptance (AN-001). These remain
unverified; browser tests do not substitute for actual shooting.
