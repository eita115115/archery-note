# Approved dependency publication — 2026-10-01

The human approved the previously asked main push for the three existing
development dependency updates. AN-036 covers that scope only: xmldom0.9.12,
brace-expansion5.0.12 and ip-address10.7.2. No added/removed packages, major
Lighthouse update, new dependency, fee or personal information use is authorized
by this approval. [Candidate verification](dependency-update.md) remains the
detailed package/consumer evidence.

## Candidate boundary

Remote main was d734ea210acc6f2f30761da6e1a5c36954630e25, an ancestor of
codex/app-quality1d9c9ad1. The publication branch has no application script, CSS,
index, worker, manifest, version or package.json diff. Applicationv94 stays aligned
without a new update banner. Documentation about the audit and hypothetical major
upgrade does not apply those proposals.

Analysis label/focus correction268b7967 and its record15e2292 are preserved on
codex/analysis-filter-focus and excluded. Its release preparation is separate.
AN-040's completed task record lives on that branch; the older open row here does
not imply the fix is absent there or included in this publication.

Re-copied tracked publication source into the owned dependency sandbox and removed
only its known extra analysis-filter regression file. Root node_modules remains
a junction to the original checkout, with old versions unchanged. No install ran
against that shared directory. Runtime comparison against remote main is empty.

## Reverification

```text
PASS: exactly 3 compatible updates; 0 additions/removals; package.json unchanged; integrity/installed parity verified
PASS: 14 of 16 saved advisory ranges no longer match; unresolved extract-zip alerts 13/27 retained
PASS: 2 plist cases, 6 SOCKS conversions, 3920 glob comparisons and 6 brace cases agree
PASS: shared node_modules versions unchanged
npm run check:all — exit0
Version alignment checks OK
npm run test:e2e — exit0
110 passed (1.3m)
npm run lint — exit0
npm run format:check — exit0
All matched files use Prettier code style!
```

The glob comparison count reflects additional tracked documents since preparation.
Fresh GitHub intake before push still has16 open alerts. No alert was dismissed;
the remaining extract-zip advisories13/27 require the separately reviewed parent
upgrade, not a forced fix. Full candidate audit's high4 packages/exit1 remains
recorded in dependency-update.md; existing security tests do not prove upstream
exploit fixes.

Evidence: artifacts/dependency-publication/verification.txt, check-all.txt,
lint.txt, format-baseline.txt, e2e.txt and alerts-before.json. Existing candidate
independent review found no actionable issue; no dependency code changed since.
Initial workflow read repeated a nonexistent deploy-pages.yml path; actual
inventory contains ci.yml and Pages uses GitHub's built-in workflow.

Publication source, CI/Pages, live asset parity and fresh alert state will be
recorded below after verification. No real user browser profile or practice
record is used. Physical iPhone UX and AN-001 shooting acceptance remain open.
