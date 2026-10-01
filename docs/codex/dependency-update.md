# Compatible development dependency update — 2026-10-01

Baseline:41155afe. Local preparation only; publicv94 and GitHub alert state have
not changed. This follows [the bounded exposure check](dependency-alert-exposure.md).

## Change

Only three existing transitive development packages change in package-lock.json:

| Package         | Before | After  | Consumer range          |
| --------------- | ------ | ------ | ----------------------- |
| @xmldom/xmldom  | 0.9.10 | 0.9.12 | plist3.1.1: ^0.9.10     |
| brace-expansion | 5.0.9  | 5.0.12 | minimatch10.2.5: ^5.0.5 |
| ip-address      | 10.4.0 | 10.7.2 | socks2.8.9: ^10.1.1     |

The diff changes only version/resolved/integrity for those entries. All279 lock
entries remain: no additions/removals, new direct dependencies, overrides, parent
updates or package.json changes. Existing balanced-match4.0.4 still satisfies
brace-expansion's unchanged ^4.0.2 requirement. Metadata, tarball URL/integrity and
installed versions agree. Consumer ranges accept all three versions.

The resolver selected ip-address10.7.2, above the10.7.1 minimum. Its upstream
[release note](https://github.com/beaugunderson/ip-address/releases/tag/v10.7.2)
describes broader ARPA suffix acceptance. The inspected SOCKS caller uses ordinary
address conversion; it does not call fromArpa or the vulnerable classification
guards. This patch remains within its declared range.

## Isolation and reproduction

The worktree's node_modules is a junction to the original checkout. No npm install,
update or ci was run against that directory. Shared affected-package versions and
the shared hidden lockfile hash remain unchanged. Root installed versions therefore
still reflect the old lock; use the isolated environment to verify this candidate.

Created artifacts/dependency-update/sandbox with copies of package.json and the
baseline lock, without node_modules. Ran there:

```text
npm update @xmldom/xmldom ip-address brace-expansion --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --ignore-scripts --no-audit --no-fund
added 277 packages in 5s
```

Resolution first showed exactly the three intended changes and no new packages.
Copied tracked repository files into the sandbox while retaining its candidate
lock and isolated node_modules. Copied only the verified lock back to the worktree.
The official [npm update documentation](https://docs.npmjs.com/cli/v11/commands/npm-update/)
describes resolution within dependency constraints; [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/)
provides a lock-based install. No dependency lifecycle scripts or native CLI were
executed. Independent source review found no required installation lifecycle step
in the three changed packages; this is not verification of every native workflow.

## Verification

artifacts/dependency-update/verify-update.cjs checks entry equality, registry
integrity/installed parity, parent ranges and each of the16 saved advisories. It
also compares old/shared and new/isolated actual consumers using ordinary synthetic
inputs: two plist value sets (Unicode, escaped text, booleans, nested arrays/date),
six SOCKS IPv4/IPv6 conversions,3850 fixed-glob/file comparisons and six benign
brace expansions. No hostile ZIP/XML/DoS payload or user practice data was used.

```text
PASS: exactly 3 compatible updates; 0 additions/removals; package.json unchanged; integrity/installed parity verified
PASS: 14 of 16 saved advisory ranges no longer match; unresolved extract-zip alerts 13/27 retained
PASS: 2 plist cases, 6 SOCKS conversions, 3850 glob comparisons and 6 brace cases agree
PASS: shared node_modules versions unchanged
PASS: shared hidden lock hash unchanged
```

In the isolated candidate environment:

```text
npm run check:all — exit0
Security regression: all 38 checks passed
Version alignment checks OK
npm run lint — exit0
npm run test:e2e — exit0
110 passed (1.1m)
npm run build:native-web — exit0
PASS: 21 isolated native-web assets byte-identical to unchanged app source
```

Full audit intentionally remains non-green, and was not suppressed:

```text
npm audit --json — exit1
{"info":0,"low":0,"moderate":0,"high":4,"critical":0,"total":4}
extract-zip: GHSA-jmr9-qjv8-65gv, GHSA-7pqw-9j4j-h8q3
@puppeteer/browsers, puppeteer-core, lighthouse: affected parent packages
```

The four npm package findings correspond to two underlying ZIP advisories plus
their parent chain; this count is different from individual GitHub alerts. No
patched extract-zip version is reported in the existing advisory evidence. Fresh
npm audit proposes changing the parent Lighthouse to13.5.0 and explicitly marks
that solution as a major-version change. That parent upgrade has not been prepared
or verified in this scoped patch. Both ZIP alerts remain unresolved; do not use
audit fix --force or dismiss them to achieve a green count.

The14 saved advisory ranges no longer match the candidate lock. This is a local
version-range result, not14 validated exploit fixes or a claim that remote alerts
are closed. xmldom serializer requireWellFormed opt-in and parser-error handling
caveats remain as documented in the exposure check; no universal sanitizer claim.
The app security regression does not test these upstream defects.

Independent read-only review found no actionable issue in lock scope, isolation,
installed consistency, verification or the bounded claims. Final formatting and
diff checks passed:

```text
npm run format:check — exit0
All matched files use Prettier code style!
git diff --check — exit0
```

Evidence: artifacts/dependency-update/{resolve,install,verification,check-all,lint,
e2e,native-build,native-assets}.txt, verification.json, audit.json, registry metadata
and shared-before/after.json. The sandbox retains the installed candidate/source.

## Publication boundary and next task

Local edits/commit are authorized. AGENTS.md requires approval for git push/Pages
deploy, so this task does not push. Application scripts/styles/index/worker and
the21 copied assets remain byte-identical; version94 is retained because there is
no new application behavior or in-app update to announce.

Next: after explicit approval, recheck remote state, push this dependency-only
change, inspect CI/Pages and fetch fresh alert state. Preserve the two no-patch ZIP
alerts and the original checkout. Physical iPhone UX/AN-001 evidence remains open;
no money or personal information was used.
