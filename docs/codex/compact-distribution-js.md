# AN-056 — Compact distribution JavaScript

## Design and plan

Human authorization: standing approval for bounded UX/performance implementation and development dependencies; no money or personal practice data. Previous goal turn AN-055 made progress by collecting 24 reports and selecting this candidate. App v98 and public main remain unchanged until a separate release acceptance task.

Use pinned Terser 5.51.2 as a development-only build tool, with `compress:false`, `mangle:false`, classic script mode and retained license comments. The [official API](https://terser.org/docs/api-reference/) defines disabling compression and name mangling separately. Compact only the 14 scripts copied to `dist/native`, preserving paths/order and editable source. Avoid bundling/frameworks, source JS edits, schema changes and worker strategy changes. Alternatives considered: a custom tokenizer needs ongoing parser edge-case maintenance; lazy loading needs a larger redesign of shared globals. A maintained printer with no logic optimizations is the bounded next step supported by AN-055.

1. Add a distribution integrity check, including byte reduction, deterministic regeneration, parsed structure/name preservation and cross-script/ASI/template/regex fixture behavior. Establish a failing check against the current copied distribution.
2. Install only into a new owned sandbox, pin the tool and inspect the lock delta. Never install into the shared junction/original checkout. Add compaction to native-web distribution copying and integrity to `check:all`.
3. Add explicit distribution mode to the local E2E server, preserve source preview default and run full existing tests on the actual generated files. CI should exercise the distribution too.
4. Run checks/lint/format/full E2E, narrow mobile/update/offline synthetic-data checks and same-condition gzip startup comparison on actual output. Review changes and retain failures as well as final output. Record AN-056 done only after its acceptance is supported; publication belongs to the next small task.

Maintenance of existing connected scoring/analysis/growth workflows keeps local processing and daily phone use as constraints. This introduces no standalone feature. Generation must fail loudly on errors, and parsed structure verification cannot replace browser behavior/update tests. Source version markers stay v98 during this task; an update test may use explicitly test-only versioned fixtures. No promise of a specific real-iPhone/INP improvement follows from local measurements.

## Validation

Local source commits: `d63904dd93dc1e671c42f2cffe05f644d7973331` (printer/build/test integration), `912ac284` (existing lazy form assets preserved). Final validation completed 2026-10-03 JST. No push or public version change in this task.

- Owned fresh `artifacts/compact-js/sandbox`: isolated Node 22.19.0, installed 268 packages in 8 seconds, scripts/audit/funding disabled for install. Lock has nine added paths, no removed or changed existing package entries except the root's added development tool. Explicit audit result is 0 vulnerabilities, not a general security claim. Root/shared junction hidden-lock SHA256 remains `16F9BA6219DA31278CED98C0C742013B4A5AAEA63059E4702E86756702A23309`; no root/original install, system runtime or PATH changes.
- Red `check-distribution` fails on unchanged copied JS. Initial green attempts exposed harmless printer syntax differences: default output expands object shorthand, templates escape newlines, and sole-return arrow blocks become expression arrows even with compression disabled. Use output ecma 2020 to retain shorthand; compare canonical structure ignoring literal spelling and untagged template raw spelling while retaining tagged raw values, and canonicalize only those sole-return arrows. VM fixtures separately exercise shared lexical globals, ASI, regex, tagged/untagged strings and arrow returns. This is not a complete semantic-equivalence proof.
- Final full `check:all` covers original source contracts and generated structure/VM/integrity. Browser suite uses the actual generated distribution via explicit fixed `E2E_DISTRIBUTION=1`, with reuse disabled. Initial 129 passed (1.8m). Independent review found the old build omitted four existing `assets/pose/` files; missing-asset red retained. Copy them unchanged, verify exact bytes plus HTTP 200/MIME/SHA, and verify blank startup never requests them. Final suite: **130 passed (1.8m)**. Assets remain lazy; no feature flag/precache/content changes. Provenance remains [the existing asset document](../features/form-tracking-assets.md). Asset availability is not camera/GPU/inference validation.
- Four normal-motion/mobile Chrome/WebKit 320/375 routes use the actual compact distribution with **three test-only marker changes** from 98 to 99 (`APP_VER`, worker cache name, version JSON). Real worker update banner click/cache switch, five synthetic records, grouped subtotal 19, six-arrow correction/end completion/next arrow, named filter focus, and stopped-origin offline reload with an active arrow all pass, page errors 0. This is local fixture acceptance, not proof of a published version 99. Lost tool handle after interruption was inspected through complete output/four result rows and absence of the old Node process; it was not restarted.
- All 21 core asset hashes used for update/performance remain identical after the four-file packaging fix. All 25 final distribution assets are present, with original non-JS bytes and lazy assets preserved. Source/sandbox build/test/config bytes match. The inspected 375px analysis screenshot is byte-identical to its v98 reference (SHA256 `81f073e3279b2680b0eecc6896e64e3c877e97281e84b2f27485b31857bed1f3`). No UI redesign occurred.
- Final lint and format checks pass. Earlier lint's unnecessary quote escape, guessed nonexistent read paths, and a failed context patch are retained in history; they did not alter app behavior. Two independent read-only reviews found no concrete P1/P2 regression in printing/integration or the packaging follow-up. Reviews explicitly did not prove physical-phone speed, model inference or public delivery.

## Actual generated payload and startup

Six sequential interleaved cold runs: original-gzip1 / generated-gzip1 / original2 / generated2 / original3 / generated3. Source reference `d63904dd93dc1e671c42f2cffe05f644d7973331`; all 21 input hashes per row, Lighthouse 13.5.0, isolated Node 22.19.0, Windows HeadlessChrome 149.0.0.0, 412×823 mobile emulation, localhost HTTP/1.1/no-store, request/CPU throttling using default DevTools settings from AN-055. No simultaneous tests/benchmark load; all six CLI processes finished exit 0, no Lighthouse runtime errors/warnings. This measures the actual Terser output, not the earlier tokenizer prototype.

| Measurement                                   | Original gzip                  | Generated gzip                 |
| --------------------------------------------- | ------------------------------ | ------------------------------ |
| JS uncompressed bodies (bytes)                | 632646                         | 455679                         |
| JS gzip level 9 bodies (bytes)                | 195931                         | 138825                         |
| Browser JS transfer including headers (bytes) | 199339                         | 142233                         |
| Observed DevTools LCP min / median / max (ms) | 3049.344 / 3066.327 / 3072.658 | 2920.949 / 2921.299 / 2922.710 |
| TBT min / median / max (ms)                   | 6.152 / 11.049 / 18.080        | 8.520 / 10.142 / 16.455        |
| CLS                                           | 0                              | 0                              |
| Performance score                             | 93 / 93 / 93                   | 94 / 94 / 94                   |

Deterministic body saving is **57,106 bytes (29.15%)**. Group LCP medians differ by 145.028 ms (4.73%); paired differences are 128.045 / 151.709 / 143.617 ms. Three pairs with original always first cannot establish statistical confidence, exclude order/host effects, or guarantee a real iPhone/public/INP saving. DevTools request throttling is an approximation, not actual phone networking; see [official Lighthouse documentation](https://github.com/GoogleChrome/lighthouse/blob/v13.5.0/docs/throttling.md). TBT variation does not establish a responsiveness improvement. No simulated-model saving is claimed for this candidate.

Evidence helpers/raw outputs live in ignored `artifacts/compact-js`: red/green logs, install/audit/lint/format, `check-all-pose.txt`, `e2e-final.txt`, `update.txt`/`transition-observed.json`, fixture/source hashes, named screenshots, `performance.txt`/six named Lighthouse reports, `verify.cjs`/`verified.txt`/`verified-summary.json`. Core bytes were captured before the asset-copy follow-up and reverified afterward, so existing browser/performance evidence remains valid for that unchanged core. The follow-up's final 130 tests specifically cover the completed package.

```text
Distribution checks passed:14 structures/names/order/source/regeneration; gzip JS 195931→138825 bytes; cross-script fixtures
130 passed (1.8m)
PASS: all four mobile normal-motion actual-worker update/correction/offline cases;14 actual compact script fixtures served; test-only98→99
PASS:6 exact-input local DevTools reports;4 actual-worker mobile update/offline fixtures;21 measured/update distribution bytes unchanged
PASS:25 distribution asset copies/hashes;9 added lock paths only;shared hidden lock/source-sandbox parity;375 image bytes unchanged
All matched files use Prettier code style!
```

## Next release boundary

Read-only GitHub Pages configuration confirms `build_type=legacy`, `main`, `/`. It currently serves editable source, so merely pushing this build change would not deliver smaller scripts. Next AN-057 must configure a checked generated-artifact Pages publication, retain these four lazy assets, bump/verify real version markers, run exact-source Linux CI and verify all **25** public app assets against the actual built artifact plus fresh mobile/update/offline behavior. That deployment change is not performed here. Real iPhone/VoiceOver/camera/GPU, large histories, INP and AN-001 shooting remain unverified; broad product goal stays active.
