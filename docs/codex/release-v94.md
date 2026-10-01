# v94 release candidate

Prepared on2026-10-01. Candidate5abc0ba008eb0f42d12d455cc177caafe8a7f0e2;
history implementation1e95918f4273dfb06db7ae49e96cc48121a19016.
Public version remains93 and remote main remains8d4bafb187feff1f27023cd3f1c3323633ddf74b.
Publication approval has not been given for this candidate.

## Change

Group the visible stages of a multi-distance round into a native disclosure in
history. The collapsed row shows score, arrows, stage count and distances; expanded
rows retain their dates and open the existing detail sheet. Filtered totals are
labelled as the visible subtotal. Pagination keeps a round together, and expansion
is remembered in memory across redraws and tabs.

See [implementation evidence](history-round-collapse.md) and375px before/after
screenshots in docs/screenshots/history-round-*.png. Existing records, scoring,
storage schema/keys, CSV, Service Worker activation policy and dependencies are
unchanged. No money or personal data was used. Physical iPhone feel and actual
shooting acceptance remain unverified.

## Release validation

Commands exited0:

```text
Archery Note version set to 94
Native web assets ready: dist\native (v94)
Archery Note checks OK (v94)
Storage round-trip checks OK
Save debounce checks OK
Version alignment checks OK
110 passed (1.3m)
PASS: all 21 copied bundle assets match source bytes, readiness version94
All matched files use Prettier code style!
```

- check:all includes scoring/physics, analysis, form fixtures, gamification, today,
  security, UI, PWA, storage and version checks.
- lint passed. Full E2E uses Chromium; implementation's focused suite also passed
  on WebKit:32 tests then8 final width/theme checks.
- Independent candidate review found no actionable issues, independently passed
  check:version/check:pwa and confirmed the five marker files only change values.

## Real update and offline retention

The loopback harness serves immutable baseline8d4bafb at/archery-note/, then the
immutable candidate5abc0ba on the same origin. Fresh disposable contexts seed
three demo records plus two synthetic round stages. The test uses a real worker,
update banner and button; checks APP_VER94, new cache and old-cache removal; then
deep-compares records, active practice, setups, sight marks and custom rounds.

After updating, it checks round subtotal19 and both stage buttons, starts practice
and places one arrow, stops the origin server and confirms ECONNREFUSED. Reload
must come from the worker, preserve the arrow and records, and show the target and
round subtotal offline with zero page errors. This uses actual origin shutdown
because [WebKit offline emulation](webkit-offline-diagnosis.md) has a known local
failure path.

```text
PASS chromium 320px: real v93 → v94 update/banner/cache switch; 5 synthetic records unchanged; round subtotal19; stopped-origin offline reload keeps active arrow and records; no page errors
PASS chromium 375px: real v93 → v94 update/banner/cache switch; 5 synthetic records unchanged; round subtotal19; stopped-origin offline reload keeps active arrow and records; no page errors
PASS webkit 320px: real v93 → v94 update/banner/cache switch; 5 synthetic records unchanged; round subtotal19; stopped-origin offline reload keeps active arrow and records; no page errors
PASS webkit 375px: real v93 → v94 update/banner/cache switch; 5 synthetic records unchanged; round subtotal19; stopped-origin offline reload keeps active arrow and records; no page errors
PASS: all four actual-worker update/offline cases
```

Command: `node artifacts/release-v94/verify-transition.cjs`. It defaults to the
fixed candidate commit; CANDIDATE_REV may explicitly override it. Source identity
is saved in transition.json. These results do not prove physical Safari behavior.

## Publication verifier rehearsal

Rehearse.cjs serves the fixed candidate under the actual Pages subdirectory. Its
verifier compares seven assets with the candidate, checks round collapse/expansion,
analysis distribution, start flow,44px controls, HUD, real Chromium touch swipe,
offline reload and record preservation. Fresh demo data stays in the temporary
browser context. Local output is explicitly labelled as a rehearsal:

```text
PASS: local candidate rehearsal touch swipe dismisses settings and retains sessions
PASS: local candidate rehearsal v94, seven candidate assets match, round collapse/expansion and score distribution, synthetic history/start, offline reload, data retention, no page errors
```

Command: `node artifacts/release-v94/rehearse.cjs`, exit0.
After approved publication, run verify-deployed.cjs without VERIFY_URL for the live
site, observe CI/Pages completion and confirm the public version and assets.

Evidence: artifacts/release-v94/check-all.txt, lint.txt, format.txt, e2e.txt,
native-assets.txt, transition.txt/json, rehearsal.txt and associated scripts/images.
No validation failures occurred in this preparation. Implementation-stage test
failures remain documented in history-round-collapse.md.

## Pending publication

Local commits and tests are complete. AGENTS.md requires user approval for
git push/GitHub Pages deployment. The priorv93 approval does not authorize this
new candidate. After approval, recheck the remote, intentionally push the candidate
and supporting records, wait for CI/Pages, then perform live checks. Until then the
public app staysv93.
