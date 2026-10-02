# Lighthouse major upgrade feasibility — 2026-10-01

Target:4f81bb0cf99e350d0faaa3e8064cb61e51e0f268. This is a hypothetical
lock-resolution/source review, not an applied or tested tool upgrade. The three
compatible updates in [dependency-update.md](dependency-update.md) remain the
actual local candidate. No package install, benchmark, native execution, exploit,
telemetry activation or publication was performed here.

## Finding

npm audit's proposed Lighthouse13.5.0 parent upgrade resolves a graph without
extract-zip. Its Puppeteer25.12.0 uses @puppeteer/browsers3.2.3; the latter no longer
declares extract-zip and instead declares modern-tar plus optional yauzl/proxy-agent
peers. The hypothetical tree's full npm audit reports0. This supports further
upgrade preparation; it does not prove arbitrary archive extraction safe or close
the repository's existing alerts.

Both existing extract-zip advisories still report no patched version:
[symlink escape](https://github.com/advisories/GHSA-jmr9-qjv8-65gv) and
[write through symlink](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3).
Removing that package through a maintained parent is a different strategy from
patching extract-zip itself. No forced audit fix or alert dismissal was used.

## Actual scope of the hypothetical resolution

| Lock entries         | Before | After | Added | Removed | Changed |
| -------------------- | ------ | ----- | ----- | ------- | ------- |
| Count including root | 279    | 261   | 43    | 61      | 21      |

The21 changed entries include the root manifest metadata and20 package entries.
The43 added paths include nested copies of existing names: there are28 genuinely
new package names. Among them are modern-tar, ajv-formats, web-features and new
Sentry/OpenTelemetry dependencies. Their presence does not mean app telemetry has
been enabled; no new package code has been installed or executed in this review.
All added/removed/changed paths and versions are retained in resolution.json.

This is a major tooling change, unlike the earlier three-entry patch. Lighthouse
requires Node>=22.19, compared with the old tool's requirement in lighthouse12.json.
Local Node24.18.0 satisfies this; CI is configured for Node22, but its actual next
runner version must be checked. No Node22 execution was performed here.

The [13.5.0 release notes](https://github.com/GoogleChrome/lighthouse/releases/tag/v13.5.0)
include new audits, plugin validation and dependency updates. Future baseline scores
must identify the tool version; changed audit definitions make a score delta alone
insufficient evidence of application performance improvement.

## Existing helper compatibility and privacy

tools/lighthouse-baseline.js uses lighthouse/cli/index.js, quiet output, JSON/HTML,
output-path and chrome-flags. The inspected13.5.0 tagged CLI retains these options
and the same report filename convention. This is source-level compatibility only;
Chrome launch, report generation and cleanup have not been exercised with13.5.0.

Tagged cli/bin.js can consult a saved error-reporting preference when no explicit
flag is passed; core/lib/sentry.js initializes reporting only when that flag is true.
The explicit --no-enable-error-reporting option is supported by cli-flags.js.
Future benchmarking should set that flag explicitly and use synthetic local data,
preserving the user's instruction about personal information. No preference file
or user record was read, and no error report was sent in this task.

Primary source inspected:
[CLI flags](https://github.com/GoogleChrome/lighthouse/blob/v13.5.0/cli/cli-flags.js),
[CLI entry](https://github.com/GoogleChrome/lighthouse/blob/v13.5.0/cli/bin.js),
[reporting guard](https://github.com/GoogleChrome/lighthouse/blob/v13.5.0/core/lib/sentry.js).

## Evidence and approval boundary

In a new artifacts/lighthouse-review/resolve directory, copied only package.json
and the current candidate lock; changed the temporary manifest's Lighthouse pin
to13.5.0. Resolved metadata with:

```text
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm audit --json — exit0
{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}
PASS: hypothetical13.5.0 tree removes extract-zip; audit0; 43 added entries/28 new package names; no installation
PASS: root candidate lock and shared hidden lock unchanged
```

No node_modules exists in that hypothetical directory. Root package.json and lock
remain unchanged from4f81bb0; the original shared hidden-lock hash remains unchanged.
Registry manifests and official tagged source were downloaded for reading only.
artifacts/lighthouse-review contains the resolution, manifests, source, audit and
verification output. Independent read-only review found no actionable issue and
confirmed actual package.json/lock were unchanged. Documentation checks passed:

```text
npm run format:check — exit0
All matched files use Prettier code style!
git diff --check — exit0
```

AGENTS.md says dependency additions require prior approval. This proposal adds28
new names, so do not apply or install it without specific approval. The pending
AN-036 request covers publishing the earlier three existing-package updates; it
does not cover this major upgrade or new dependencies.

After specific addition approval: apply only the reviewed manifest/lock, install
in an isolated checkout, explicitly disable error reporting, run the current
baseline helper against synthetic local data, check Node22 minimum compatibility,
audit, app/security/lint/format/E2E and output assets, then obtain publication
approval if needed. No fee or personal information was used in this review.

## Later approval and execution — 2026-10-02

Human “すべて承認します” subsequently covers AN-038's major/addition scope.
The exact reviewed graph is now applied and verified locally in a fresh isolated
environment, with reporting disabled and minimum Node22.19 execution. See
[actual validation](lighthouse-upgrade-validation.md) for results and limits.
Public GitHub alert closure is still pending publication; the original section
above describes this earlier hypothetical review checkpoint.
