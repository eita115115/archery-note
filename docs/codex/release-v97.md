# v97 correction-return release — AN-052

Public baseline85a52fc5b6f2300fbf46436e0c10b5a1bcf5e8c3/v96.
Candidate58c411e727aa7415333fa0308d2697b5f1533cbe, implementation107f91a2.
Human “すべて承認します” covers this bounded improvement and publication; no
new permission question is needed. Publication evidence is recorded below;
candidate application bytes are now live. Broad goal remains active.

## Scope and completed preflight

Only AN-049 target return after correction closes and successful end confirmation,
plus five aligned version markers97. Version commit has only APP_VER/json/cache/
package/lock metadata; worker activation/storage/scoring unchanged. Existing
dependency tree and shared hidden lock unchanged, no install/fee/private records.
Original checkout/junction preserved, owned dependency sandbox only.

```text
Archery Note version set to 97
Version alignment checks OK
Archery Note checks OK (v97)
Security regression: all 38 checks passed
UI smoke checks OK (chrome.exe)
PWA asset checks OK
PWA update flow checks OK
Storage contract checks OK
Storage round-trip checks OK
Save debounce checks OK
All matched files use Prettier code style!
120 passed (1.2m)
PASS:21 native assets byte-identical/readiness97; dependency tree unchanged; shared hidden lock unchanged
PASS: 102 candidate source/test/dependency files match owned sandbox; shared hidden lock unchanged
```

check:all/lint/format exit0 and full Chromium120 release E2E pass. Original
two-engine/mobile normal/reduced-motion8-case regression and375before/after images
remain the same runtime described in correction-return.md. No unrelated UI fixes.

Four actual-worker active-practice96→97 routes pass (Chromium/WebKit320light/
375dark, reduced motion, custom viewport without mobile emulation): in-app update
guard, pre-update active1/history5/trend HTML preserved, explicit boolean worker
readiness/cache switch, active2 then stopped-origin ECONNREFUSED/offline fromSW,
practice data retained/focused named controls visible/pageerrors0. Raw active.json
is active/active-active.json. This does not establish arbitrary real-user timing.

The publication helper rehearsal passes on immutable candidate bytes with fresh
mobile375 Chromium: named filters/period focus and bounds, history19/distribution,
start44px, actual screen-coordinate6-arrow correction/deselect/end1/new arrow,
whole-target bounds, settings CDP touch swipe, offline synthetic saved5/active
retention/errors0. Rehearsal is not a claim that97 is live. live-correction.json
from that rehearsal was replaced by true live output after publication; the
rehearsal copy is retained separately.

## Normal-motion banner route under verification

The previous banner-route helper used reduced motion despite its “normal” route
name. This run explicitly uses normal motion and mobile/hasTouch. It additionally
records6 arrows, correction, deselect/end1/next arrow after a clickable update,
before stopped-origin offline preservation. Animation waits were audited below.

An unbounded all-document finite-animation wait did not finish in the first
four-case run. Exact owned Node PID11956 was confirmed live, interrupted through
handle12543, terminalexit1 verified and no direct child remained. Interrupted
transition.txt is not acceptance evidence. No app/worker failure or data loss was
inferred. A bounded single Chromium320 diagnostic completed; it did not reproduce
the wait or prove all contexts. Four-case bounded diagnosis passed both Chromium
sizes but failed WebKit320 at analysis. A visible-target-only variant passed
WebKit320 but failed WebKit375 at history, including on-screen finished targets.
Neither failed matrix is acceptance evidence.

A concurrently run pending-Promise probe failed the strict15s cache readiness
gate without sufficient state capture. Its cause is unproven. A serial WebKit320
probe retained that gate with failure-state capture and passed it, then reproduced
the animation wait. The exact captured animation Promises still had pending flags
after2s although their current playState was finished when geometry was read.
This supports replacing the verifier's captured-Promise wait; it does not prove
browser-internal scheduling details or an application regression.

Current runtime candidate stays unchanged. The revised helper polls current
finite-animation states after current target geometry reads, requires every state
to be finished/idle within2s, then waits two frames. It keeps all-document coverage,
strict worker readiness, full-target bounds, screen-coordinate actions and data
comparisons. It never treats a timeout as success. Four-context rerun completed successfully (transition-observed.json): Chromium and
WebKit320/375, mobile touch and normal motion, strict cache switch, corrected six
arrows/end1/next arrow, five histories and stopped-origin offline retention, no
page errors. Independent read-only review found no concrete P1/P2 issue. Geometry
reads promote layout in this verifier; rendering performance and arbitrary delayed
movement remain outside this evidence. No application source was changed.

Minor helper-read issues retained: guessed release-v95/rehearse.cjs was absent;
actual release-v96 helper located by rg. Native assertion correctly checked97
but its inherited caption initially printed96; caption corrected and output rerun.
Neither is an application failure.

Raw artifacts under artifacts/release-v97: check-all.txt/lint.txt/format.txt/e2e.txt,
native-build.txt/native.txt, active.txt/active/active-active.json,
rehearsal.txt/live-correction.json, verify-deployed.cjs/rehearse.cjs,
transition.txt, wait-diagnosis.txt/wait-diagnosis-output.txt,
transition-bounded-progress.txt/transition-bounded.txt, transition-visible.txt,
transition-pending.txt/transition-serial.txt and transition-observed.txt/JSON with
their immediate progress logs and helper source files.

## Publication checkpoint and limits

The four clickable update/cache-ready/mobile normal-motion/correction/offline
cases and final read-only review are complete. At the pre-publication checkpoint,
remote main equaled85a52fc5. Approved push, exact-source CI/Pages, public97/all21bytes
and live375correction/major operations/settings swipe/offline synthetic retention
then passed as recorded below; AN-052 is done.
Actual iPhone/keyboard/VoiceOver/5000storage/INP/AN-001 remain unverified. ZIP
development alerts and approved-but-unimplemented AN-038major remain separate.

## Approved publication verified — 2026-10-02

Published dd3cda12b304e0991c611789674183c4ef9fa6e2 (runtime candidate58c411e).
Remote85 ancestor checked, ordinary push without force. Exact-source
[CI36947646285](https://github.com/eita115115/archery-note/actions/runs/36947646285)
and [Pages36947645601](https://github.com/eita115115/archery-note/actions/runs/36947645601)
completed successfully. CI runs Node22/Linux with clean dependencies; no local
root dependency installation. Existing two high ZIP development alerts remain.

```text
120 passed (1.5m)
PASS: all21 deployed v97 assets byte-identical to approved publication 58c411e727aa7415333fa0308d2697b5f1533cbe
PASS: deployed touch swipe dismisses settings and retains sessions
PASS: deployed v97, seven candidate assets match, round collapse/expansion and score distribution, synthetic history/start, offline reload, data retention, no page errors
```

Fresh mobile375 Chromium live correction used70m/122cm/six arrows: corrected
end1 retains all six, next current arrow1. After deselect and after end, target
y18/height292.3125 fits between top0 and dock653; no recovery scroll in driver.
Settings touch swipe and worker offline reload preserve five synthetic sessions
and active practice. Current deployed-active.png visually inspected; existing
toast/action text overlap remains AN-050, separate from target-return scope.
live-correction.json and deployed images now come from the public site; earlier
rehearsal result retained separately as rehearsal-correction.json.

Publication helper uses the same bounded current-animation-state gate, and its
local rehearsal passes before public use. Initial final documentation formatting
failed for ledger; formatting the wrong release doc did not resolve it, correct
ledger formatting then full format:check succeeds. These were documentation-only
failures, retained in format-final/format-final-corrected/format-ready.txt.

The publication-record helper initially assumed CRLF in CHANGELOG and stopped
with “changelog seam changed” after updating progress/tasks; it had not appended
the final release/history records. Normalizing newlines in that helper and rerunning
completed the records. No runtime or public asset changed; final record audit
checks the release/task/publication evidence together.

Raw ci-log.txt, ci/pages-status.json, live-assets.json/txt and live.txt retain
the release evidence. AN-052done/pass with evidence only after all these checks.
Publication documentation follow-up is a local commit; deployed main remainsdd3cda12.
Next AN-050 notification overlap, then AN-051 selector names. Goal staysactive.
