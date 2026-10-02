# Lighthouse13 isolated validation — AN-038 — 2026-10-02

Baseline77e404a8e6bda1944c5ec0083e0d7d6ba6dd237b, local tool candidate
2218a1b58e5fd2f25cc999f5e9f99d37fa30af6b. Public main remains
0db834550a49352e21f420af7037d4c832e4b4e6/v98. No publication in this task.
Human “すべて承認します” explicitly covers the previously pending AN-038
major/new-dependency scope. No new permission question, fee or personal data.

## Applied scope and isolation

Pinned Lighthouse12.6.1→13.5.0 and applied the exact lock previously reviewed
in lighthouse-upgrade-review.md, adjusting only root app metadata0.94→0.98.
The current pre-upgrade graph equals that review's baseline after removing root
version metadata. Graph279→261 entries:43 added paths,61 removed,21 changed
including root,28 genuinely new package names. extract-zip is absent.
No forced audit fix, overrides or alert dismissal.

Fresh artifacts/lighthouse-upgrade/sandbox copied tracked source only, then:

```text
npm ci --ignore-scripts --no-audit --no-fund
added 259 packages in 12s
PASS: exact reviewed lock;43 added/61 removed/21 changed paths;28 new names;extract-zip absent;259 installed versions and Node22.19 engines match;CLI error reporting explicitly false;shared hidden lock unchanged
npm audit --json — exit0
{ info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 }
```

Registry/advisory matching is not a general security guarantee. Public GitHub's
two existing ZIP alerts have not been closed by this local validation.
Root node_modules remains the original checkout's junction and old installed
Lighthouse12.6.1. No install/update/ci in root, original checkout or previous
sandbox. Shared hidden lock hash remains
16F9BA6219DA31278CED98C0C742013B4A5AAEA63059E4702E86756702A23309.

## Reporting and minimum runtime

tools/lighthouse-baseline.js now explicitly passes --no-enable-error-reporting,
so the installed CLI does not consult a saved reporting preference or initialize
its guarded reporting client. Installed getFlags returns false for that option;
installed CLI/Sentry guard inspected before benchmark execution. Presence of
Sentry/OpenTelemetry dependencies does not enable app telemetry.
The helper also prints lhr.lighthouseVersion beside scores. CONTRIBUTING documents
the runtime floor and warns against comparing scores across tool versions.
Primary source: [CLI flags](https://github.com/GoogleChrome/lighthouse/blob/v13.5.0/cli/cli-flags.js),
[CLI guard](https://github.com/GoogleChrome/lighthouse/blob/v13.5.0/cli/bin.js).

[Lighthouse13.5 manifest](https://github.com/GoogleChrome/lighthouse/blob/v13.5.0/package.json)
requires Node>=22.19. Downloaded only the official Windows x64 Node22.19.0
executable into ignored owned artifacts; SHA256 checked against official
[SHASUMS256](https://nodejs.org/download/release/v22.19.0/SHASUMS256.txt):
995A3FB3CEFAD590CD3F4B321532A4B9582FB9C6575320ED2E3E894CAAC3E362.
No system runtime installation or user PATH change. The owned wrapper uses this
executable for npm and prepends its directory only in child environment PATH.
Every installed package's declared Node engine admits22.19.0. This is Windows
execution evidence; updated Linux CI has not run yet. Prior public-v98 CI used
22.23.3 but had the older Lighthouse tree.

## Validation and baseline

Owned sandbox under minimum Node22.19.0:

```text
npm run check:all — exit0
Archery Note checks OK (v98)
Security regression: all 38 checks passed
PWA asset checks OK
PWA update flow checks OK
Storage contract checks OK
Storage round-trip checks OK
Save debounce checks OK
Version alignment checks OK
npm run lint — exit0
npm run format:check — exit0
All matched files use Prettier code style!
npm run test:e2e — exit0
129 passed (1.8m)
Native web assets ready: dist\native (v98)
Lighthouse baseline complete
Lighthouse version: 13.5.0
URL: http://127.0.0.1:8772/
Performance: 0.81
Accessibility: 1.00
Best Practices: 1.00
SEO: 1.00
PWA: n/a
```

Existing baseline helper succeeds, report runtimeError absent/runWarnings empty.
Fresh browser, local blank onboarding, mobile/simulated throttling. Browser
network-request entries all target loopback; this list does not measure arbitrary
Node/browser background traffic. No private browser profile or practice record
was used. No concurrent app checks/E2E during the benchmark.

| Metric          | Single-run result |
| --------------- | ----------------- |
| FCP             | 1067.933ms        |
| LCP (simulated) | 5164.799ms        |
| Speed Index     | 1067.933ms        |
| TBT             | 0ms               |
| CLS             | 0                 |

LCP element is the onboarding paragraph. Its observed breakdown132.121ms differs
from the simulated5.2s metric; the latter is not a measured real-phone delay.
Report suggests script minification/unused scripts and render-blocking resources,
but no causal performance fix is proven. No same-tool repeated baseline, actual
INP, large saved history, warm cache, real phone or native shell measurement here.
Screenshot extracted from the generated report was inspected. Performance81 is
a new measurement reference, not a claim that the app got faster.

All21 current app assets match unchangedv98 Git content (CRLF normalized for
text, binaries exact); native copies are byte-identical to the actual checkout,
readiness98. Scoring/storage/schema/style/worker/version markers unchanged.
First inspection helper incorrectly compared raw Windows CRLF text to Git LF;
index.html had62 CRLF lines and normalized equality true, no runtime diff.
That failed helper output is retained in baseline-verification.txt. A subsequent
summary read failed because generation had stopped. Corrected verifier only
normalizes text-to-Git comparison, keeps binary/native-byte assertions exact,
and passes in baseline-verification-corrected.txt. Benchmark/source not rerun or
changed; these are verifier failures, not application failures.

Independent read-only review of77→221 found no concrete P1/P2 and inspected
finished full129/audit0/baseline logs. All owned handles ended exit0; ports8771/8772
are absent. Final records preserve every existing task's acceptance.
Raw artifacts/lighthouse-upgrade contain install/check-all/lint/format/e2e/audit,
graph/verification, node22 checksum, baseline/report/summary, native and helper
evidence. Tracked changes are two manifests, baseline helper, CONTRIBUTING and
documentation/task records only.

## Next

AN-054 publishes the approved tooling candidate and verifies exact-source Linux
CI/Pages, unchanged publicv98 assets and GitHub alert state. No app version bump
needed for this development-only change. AN-055 then repeats the same-version
cold-start measurement and diagnoses the critical loading path before modifying
app code. Real iPhone/VoiceOver/keyboard/5000storage/AN-001 remain open; goal active.

## Publication follow-up — 2026-10-02

AN-054 now publishes this exact candidate and confirms LinuxCI/full129, unchanged
publicv98 assets and GitHub ZIP13/27 fixed/open0. See
[publication evidence](lighthouse-upgrade-publication.md). Earlier local-only
statements above describe the pre-publication checkpoint. Linux Lighthouse
benchmark and actual-device performance remain unverified.
