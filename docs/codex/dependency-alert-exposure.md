# Dependency alert exposure check — 2026-10-01

Target:d734ea210acc6f2f30761da6e1a5c36954630e25, publicv94. This is a bounded
dependency/call-path review, not a repository-wide security audit or proof that
all tooling is safe. No alerts were dismissed, dependencies changed, native builds
run, exploits executed, personal records read or external reports sent.

## Result

GitHub's open-alert API currently returns16 alerts:10 high and6 medium. All16
point to transitive development dependencies in package-lock.json. Installed
versions match the lockfile. The four affected packages are:

| Package         | Locked | Alerts | Route                                                | Minimum patch covering the listed alerts |
| --------------- | ------ | ------ | ---------------------------------------------------- | ---------------------------------------- |
| @xmldom/xmldom  | 0.9.10 | 10     | Capacitor CLI8.4.0 → plist3.1.1                      | 0.9.12                                   |
| ip-address      | 10.4.0 | 3      | Lighthouse12.6.1 → Puppeteer/browser tooling → SOCKS | 10.7.1                                   |
| brace-expansion | 5.0.9  | 1      | ESLint10.6.0 → minimatch10.2.5                       | 5.0.12                                   |
| extract-zip     | 2.0.1  | 2      | Lighthouse → Puppeteer/browser tooling               | None reported                            |

The14 PWA script tags load the application's own files. Their source and sw.js
contain no references to these package names; the worker's asset list likewise
uses owned scripts. tools/build-native-web.js copies21 named web assets rather
than bundling Node dependencies. No node_modules files are tracked. The JSON
practice-backup path uses JSON parsing, not these ZIP/XML packages. On this
evidence, **no direct execution path from the PWA's normal record/import/history
flows to these affected packages was found**. This is an inference from the
inspected build/source paths, not a claim that every deployed/native asset is safe.

Production-only npm audit currently reports0 advisories. This complements the
source check; it does not clear the16 development-tool alerts or audit native
plugins, bundled pose assets or browser code.

## Entry points and boundaries

- **C — CLI plist parser.** @capacitor/cli/dist/cordova.js:logiOSPlist reads local
  Info.plist and calls plist.parse; plist/lib/parse.js calls xmldom DOMParser.
  Parser issues are therefore relevant to future native-tool use on malformed
  project/plugin XML. Current CI and the lightweight web-copy build do not invoke
  this CLI path. Native execution is outside this PWA-first task and was not run.
- **S — Serialization scenario absent in inspected plist consumer.** plist's
  parsing uses xmldom; its build module uses xmlbuilder. No xmldom XMLSerializer
  consumer was found in plist/lib or Capacitor CLI/dist. The advisory's affected
  DOM mutation/serialization scenario was not observed in that route. This is
  not a declaration that the upstream library is fixed or unreachable everywhere.
- **I — Address-classification guard absent in inspected SOCKS consumer.** socks
  uses Address4.toArray and Address6.fromByteArray/canonicalForm for transport
  representation. The affected subnet/link-local/special-range guard methods
  were not found at these caller sites. Do not treat the library as a safe SSRF
  guard; update the compatible dependency rather than adding such use.
- **B — Archive installer path.** @puppeteer/browsers/fileUtil.js dynamically calls
  extract-zip for ZIP archives; install.js invokes unpackArchive after download.
  A custom browser-download base URL is supported. Malicious archives reaching
  this path matter. The repository's Lighthouse baseline launches installed Chrome
  with chrome-launcher and connects Puppeteer to it; no browser-install call is
  present in that baseline. CI installs Playwright browsers via Playwright, not
  this installer. This does not prove arbitrary browser downloads or package
  lifecycle scripts safe.
- **G — Lint glob input.** minimatch calls brace-expansion. ESLint runs in CI, so
  this dependency is used in the development workflow. Current package scripts
  and eslint.config.mjs supply fixed glob patterns, with no PWA/user-record input
  passed to them. An adversarial changed config/pattern is a tooling risk; a
  compatible patch exists. No denial-of-service payload was executed.

SECURITY.md supports latestmain and lists PWA/storage/backup/CSV/SW/bundled assets.
It does not define a separate tooling risk acceptance policy. This review therefore
retains every alert and its boundary instead of dismissing development scope.

## One disposition per open alert

Source links identify the upstream advisory; alert numbers identify this repo's
items. C/S/I/B/G refer to the inspected boundaries above. Dispositions are scoped
observations, not remote alert dismissals or validated exploit verdicts.

| Alert | Advisory                                                            | Condition                                       | Scoped disposition                                       | Next action                                  |
| ----- | ------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| 34    | [j6r3-76f7-8jcv](https://github.com/advisories/GHSA-j6r3-76f7-8jcv) | Mixed address families in subnet guard          | I; affected guard not observed                           | Patch ip-address≥10.7.1                      |
| 32    | [q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | Expensive brace rewrite                         | G; lint consumer, fixed patterns                         | Patch brace-expansion≥5.0.12                 |
| 29    | [rpw4-54j3-4h4q](https://github.com/advisories/GHSA-rpw4-54j3-4h4q) | Link-local address classification               | I; affected guard not observed                           | Patch ip-address≥10.7.1                      |
| 28    | [2vr4-cq9g-pvrc](https://github.com/advisories/GHSA-2vr4-cq9g-pvrc) | NAT64 local-use classification                  | I; affected guard not observed                           | Patch ip-address≥10.7.1                      |
| 27    | [7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3) | Archive write through planted symlink           | B; browser installer, no baseline install call           | Keep open; reassess upstream/installer route |
| 25    | [4w3w-2rp5-g8jm](https://github.com/advisories/GHSA-4w3w-2rp5-g8jm) | Attribute setter/serialization validation       | S; serialization scenario not observed                   | Patch xmldom≥0.9.12                          |
| 24    | [c7q8-3ch8-vqpv](https://github.com/advisories/GHSA-c7q8-3ch8-vqpv) | Processing-instruction serialization validation | S; serialization scenario not observed                   | Patch xmldom≥0.9.12                          |
| 21    | [6h8r-xr42-gp59](https://github.com/advisories/GHSA-6h8r-xr42-gp59) | Malformed end-tag accepted                      | C; native plist parsing path exists                      | Patch xmldom≥0.9.12                          |
| 20    | [w2rr-34g9-rvrj](https://github.com/advisories/GHSA-w2rr-34g9-rvrj) | Element creation/serialization validation       | S; serialization scenario not observed                   | Patch xmldom≥0.9.12                          |
| 19    | [27p8-2357-5qqv](https://github.com/advisories/GHSA-27p8-2357-5qqv) | DocType name serialization validation           | S; serialization scenario not observed                   | Patch xmldom≥0.9.12                          |
| 18    | [3px3-54cx-rmw9](https://github.com/advisories/GHSA-3px3-54cx-rmw9) | Creation-time name validation                   | S; affected mutation/serialization scenario not observed | Patch xmldom≥0.9.12                          |
| 17    | [8344-3jmq-59r6](https://github.com/advisories/GHSA-8344-3jmq-59r6) | Parser attribute deduplication cost             | C; native plist parsing path exists                      | Patch xmldom≥0.9.12                          |
| 16    | [93r5-fhx6-vmg9](https://github.com/advisories/GHSA-93r5-fhx6-vmg9) | Parser recovery cost                            | C; native plist parsing path exists                      | Patch xmldom≥0.9.12                          |
| 15    | [vr34-hp96-76pp](https://github.com/advisories/GHSA-vr34-hp96-76pp) | DocType ID serialization validation             | S; serialization scenario not observed                   | Patch xmldom≥0.9.12                          |
| 14    | [6gmq-8vp8-gcm6](https://github.com/advisories/GHSA-6gmq-8vp8-gcm6) | EntityReference serialization validation        | S; serialization scenario not observed                   | Patch xmldom≥0.9.12                          |
| 13    | [jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) | Archive symlink escapes extraction directory    | B; browser installer, no baseline install call           | Keep open; reassess upstream/installer route |

The xmldom advisory's strict serialization fix requires the consumer's
requireWellFormed opt-in; updating its version alone is not a universal sanitizer.
The inspected plist consumer does not use that serializer. Registry metadata
confirms the three stated patched releases exist and remain within the current
consumer ranges. No upgrade has yet been made.

## Validation and evidence

```text
PASS: 16 open alerts, all development-only lock entries; installed versions match lock; 14 PWA scripts have no affected package references; no tracked node_modules; production audit reports0
Security regression: all 38 checks passed
npm audit --omit=dev exit: 0
All matched files use Prettier code style!
```

- artifacts/dependency-alerts/open-alerts.json retains16 separate source rows,
  without user/assignee/account metadata. Exposure.json records target revision,
  counts and versions. npm-tree.txt, lock-tree.txt and brace-tree.txt trace callers.
- audit-production.json is the fresh audit result; it is not a full audit of dev
  dependencies. verify-exposure.cjs verifies counts, scope, installed/locked parity
  and the bounded PWA reference check. Security.txt retains the existing app
  security regression output; that check does not cover these upstream tool bugs.
- Three patch-metadata JSON files retain read-only npm registry responses.
- format.txt retains the final npm run format:check result. git diff --check
  passed, and every passing task has nonempty evidence. An independent read-only
  review found no actionable discrepancy in the16 rows, callers or limitations.
- GitHub advisories and local caller source were inspected. No archive/network
  exploit, native CLI, dependency update or publication was performed.

## Next small task

Prepare and verify compatible updates of the three existing transitive packages
in the lockfile, retaining extract-zip's two alerts. First confirm no new package
names or unrelated versions are introduced; additions still require approval.
Use an isolated installation for verification: **this worktree's node_modules is
a junction to the original checkout**, so npm install/update/ci here must not
modify that shared directory. Lockfile-only resolution plus an isolated sandbox
installation can preserve the user's original worktree.

Check literal lint globs, benign plist parsing and SOCKS address conversion against
old/new versions, then required app/security/lint/format checks. Do not replace a
no-patch ZIP package with an unreviewed dependency just to make alert counts green.
This local preparation is separate from any new publication approval.
