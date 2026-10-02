# AN-055 — Cold-start diagnosis

Measured 2026-10-02 (JST). This is a local diagnosis, not a deployed speed improvement. Select generated compact JavaScript as the next bounded implementation candidate: the prototype saves 50,887 gzip body bytes (25.97%) while preserving the parsed structure of all 14 scripts. Interleaved request-throttled observations favor it by 98.489–109.508 ms in three local pairs; this does not establish a real iPhone improvement or a guaranteed saving.

## Provenance and method

- Input source: `691f1cd7f44349359b02674d43656463ee96ec12`, branch `codex/cold-start-diagnosis`, isolated checkout `C:/Users/eita2/.codex/worktrees/app-quality/archery-note`. Working tree app content matches public main `29979e261e93ffdfcdce224293283764e5641b7b` (Git text comparison normalizes CRLF only; PNG comparison is exact). Public app remains v98; no app implementation, dependency installation or push in this task.
- Lighthouse 13.5.0 from the owned `artifacts/lighthouse-upgrade/sandbox`, official isolated Node 22.19.0, Windows host `HeadlessChrome/149.0.0.0`. Reporting explicitly disabled. Shared root `node_modules` is a junction to the original checkout; its hidden-lock SHA256 remains `16F9BA6219DA31278CED98C0C742013B4A5AAEA63059E4702E86756702A23309`.
- Fresh headless profiles, empty onboarding, loopback HTTP/1.1, no-store responses. No real practice data or user browser profile. No fees, telemetry or external inference. No simultaneous benchmark/test load during each matrix. Sequential CLI processes all finished with exit 0.
- Mobile emulation: 412 × 823, device scale 1.75. Default model RTT 150 ms, throughput 1638.4 Kbps; DevTools request latency 562.5 ms, download 1474.56 Kbps, upload 675 Kbps, CPU slowdown 4. Full `configSettings` and actual host UA agree within each matrix. CPU slowdown is relative to this host, not physical iPhone calibration.
- `simulate` collects unthrottled observations and predicts constrained metrics. `devtools` applies request/CPU throttling during collection; it is an approximation, not packet-level phone networking. Their LCP columns must not be conflated. See the [official Lighthouse 13.5 throttling documentation](https://github.com/GoogleChrome/lighthouse/blob/v13.5.0/docs/throttling.md).
- Baseline has 16 input hashes (HTML, CSS, 14 JS). Early blocked probe rows record source ref and response sizes but lack per-row input hashes. The final interleaved matrix records all 21 exact original/compact input hashes. Current hashes, regenerated prototype sizes/ASTs and unchanged Git content were verified after measurement. This strengthens provenance without retroactively adding measurements to older rows.

## Reproduction and controlled probes

The existing baseline helper serves uncompressed local source. Three repeats reproduce score 81 with modeled LCP 5.174 s; observed unthrottled LCP is only 116–118 ms. Therefore “5 seconds on the user's phone” is not established.

Before probing, hypotheses were ranked: (1) local uncompressed transport inflates modeled cost relative to the public encoding; (2) the deferred script payload delays dynamic initial rendering; (3) startup CPU work dominates. Raw → gzip changes only transport encoding for text assets. Gzip → compact-gzip changes only JS comments/whitespace, preserving token text, line-break boundaries, parsed AST including raw literals/parentheses, global names, script count and order. HTML/CSS remain identical in that comparison. Diagnostic generation uses already-installed Acorn 8.17.0; no dependency was added.

Each row below contains three cold runs. LCP is minimum / median / maximum, in milliseconds. Scores are the three results, not a release promise.

| Matrix / variant                                       | LCP metric                     | Observed LCP       | Scores       | JS browser transfer bytes |
| ------------------------------------------------------ | ------------------------------ | ------------------ | ------------ | ------------------------- |
| Existing helper, simulated / raw                       | 5167.908 / 5173.879 / 5178.131 | 116 / 117 / 118    | 81 / 81 / 81 | 635691                    |
| Controlled server, simulated / raw                     | 4967.649 / 5128.845 / 5136.224 | 110 / 110 / 141    | 81 / 81 / 82 | 635401                    |
| Controlled server, simulated / gzip                    | 2581.676 / 2585.338 / 2589.137 | 106 / 107 / 108    | 97 / 97 / 97 | 199339                    |
| Controlled server, simulated / compact-gzip            | 2134.785 / 2136.669 / 2138.447 | 105 / 108 / 112    | 99 / 99 / 99 | 148452                    |
| Controlled server, DevTools blocked / gzip             | 3040.104 / 3046.423 / 3058.324 | 3040 / 3046 / 3058 | 93 / 93 / 93 | 199339                    |
| Controlled server, DevTools blocked / compact-gzip     | 2947.225 / 2954.351 / 2960.015 | 2947 / 2954 / 2960 | 94 / 94 / 94 | 148452                    |
| Controlled server, DevTools interleaved / gzip         | 3037.291 / 3048.942 / 3065.996 | 3037 / 3049 / 3066 | 93 / 93 / 93 | 199339                    |
| Controlled server, DevTools interleaved / compact-gzip | 2935.022 / 2950.453 / 2956.488 | 2935 / 2950 / 2956 | 94 / 94 / 94 | 148452                    |

Controlled simulated runs used raw1–3, gzip1–3, compact1–3. The first DevTools matrix used gzip1–3 then compact1–3; its median difference is 92.072 ms. To reduce long block-order confounding, the last matrix alternated gzip1/compact1/gzip2/compact2/gzip3/compact3. Pair differences are 109.508, 102.269 and 98.489 ms; group medians differ by 98.489 ms (3.23%). Gzip still always precedes compact within each pair, and n=3 cannot establish statistical confidence or exclude host/scheduling effects. No more precision should be promised than this evidence supports.

The simulated median saving is 448.669 ms, much larger than DevTools observations. It is a model prediction, not an observed deployed saving. Unthrottled local LCP medians (107 vs 108 ms) do not demonstrate a speed gain. CLS is 0 throughout; simulated TBT is 0. DevTools TBT varies across groups (blocked medians 9.438 vs 12.993 ms; interleaved 9.981 vs 8.823 ms); CPU responsiveness improvement is not established.

## Loading path and payload evidence

`index.html` has 14 classic deferred scripts in numbered order. `scripts/90-init.js` ends with `render()`, which fills the initial empty `main` with onboarding. The reported LCP element is `body > main#main > section.onboard > p`. All 14 scripts must load/execute in order before that render, so their payload is relevant even though the Lighthouse network-tree insight lists stylesheet/manifest and excludes these deferred scripts. That insight alone is not a complete dependency graph. The verifier confirms all 14 script requests finished with status 200 and no browser cache in each report.

Local gzip browser-transfer contributors include record view 38,000 bytes, form core 35,549, gear/settings 25,388, analysis/physics 20,682 and form view 19,947. They are all loaded for empty onboarding. This supports testing smaller delivered scripts before a more invasive lazy-loading change to shared globals. It does not establish a per-script critical-path time saving.

| All 14 script bodies | Original | Compact prototype | Saving          |
| -------------------- | -------- | ----------------- | --------------- |
| Uncompressed bytes   | 632646   | 490112            | 142534 (22.53%) |
| gzip level 9 bytes   | 195931   | 145044            | 50887 (25.97%)  |

Browser transfer includes headers; body totals do not. Public read-only requests already return gzip for `index.html`, `scripts/46-form-core.js` and `style.min.css` (200; compressed lengths 2058, 35093, 13997; max-age 600). Raw → gzip is consequently a local measurement discrepancy, not a new public optimization. Only those three public assets were sampled. Local gzip level, CRLF bytes, headers, protocol and request scheduling are not exact public transport parity.

One baseline's aggregate main-thread categories are style/layout 243.296 ms, other 125.232, script parse/compile 45.196 and script evaluation 33.200. These totals span the audited trace, not necessarily only the first-LCP interval. Together with TBT 0 and observed LCP 117 ms they do not justify a CPU-first rewrite. No CPU operation has been isolated as the dominant startup cause.

## Validation and evidence retained

Helpers and raw reports are intentionally ignored under `artifacts/cold-start`; tracked durable findings live in this document. They contain only blank onboarding and localhost requests.

- `repeat.cjs`, `repeat.txt`, `baseline.json`, `runs/baseline-{1,2,3}.{json,html,txt}`: three original-helper repeats.
- `probes.cjs`, `probes.txt`, `probes.json`, `probes-devtools.txt`, `probes-devtools.json`, `probes-devtools-alternating.txt`, `probes-devtools-alternating.json`: 9 + 6 + 6 controlled runs and terminal outputs. Earlier report copies are retained under unique names; the helper later gained interleaving/hash logging.
- `compact-sizes.json`, `input-hashes.json`, `public-encoding.txt`: byte/AST provenance and three public encoding samples.
- `verify.cjs`, `verify.txt`, `verified-summary.json`: report and input cross-checks. All 24 reports have Lighthouse 13.5.0, no Lighthouse `runtimeError` or run warnings, consistent conditions within each matrix, and loopback requests. This is not a separate application console-error assertion.

```text
PASS: three sequential same-source/tool/mobile/simulated cold baselines
PASS:9 controlled cold reports;compression-only then token-layout-only gzip probe
PASS:6 controlled devtools cold reports;compression/token-layout probe
PASS:6 controlled devtools alternating cold reports;compression/token-layout probe
PASS:24 cold reports; per-matrix tool/settings/host,14 script requests, no Lighthouse runtime errors/warnings
PASS:21 original input hashes/Git content,21 compact hashes,14 ASTs/sizes, shared hidden lock preserved
```

Tracked changes are diagnostic documentation/records only; matching acceptance check is `npm run format:check`. No new application regression run is needed for these unchanged app bytes. Parsed AST equality is useful prototype evidence but does not replace UI/scoring/storage/update/offline tests before production adoption. Final formatting and independent review are recorded in the ledger/task evidence.

## Selected next task and limits

AN-056: implement deterministic generated compact **distribution** JS while keeping editable originals and the same 14 output paths, global names and execution order. Select a maintainable build-tool approach; do not ship the temporary tokenizer merely because these 14 AST comparisons pass. Add generation/integrity validation, and test the actual generated distribution for startup and existing scoring/storage/UI contracts. Run the required full checks/E2E, mobile flow, real worker update/offline with synthetic records before adoption/publication. Repeat gzip comparisons against that actual candidate; do not assume the prototype's magnitude applies to it.

This is maintenance of existing connected growth/analysis workflows rather than a new standalone feature; local processing and daily phone use remain the product constraints. A cold startup payload change does not prove better real INP, warm-cache/PWA return speed, large-history behavior, physical iPhone/VoiceOver behavior or an improvement over an older app release. AN-001 real shooting and those device/performance questions remain open. Broad product goal stays active.
