# Archery Note UI Refresh AI Collaboration Plan

Last updated: 2026-07-02
Target repository: `eita115115/archery-note`
Target phase: post-`v1.0.0` UI refresh / app-like polish

---

## 0. Purpose

This document is the shared plan and instruction sheet for Codex and Claude when working on the Archery Note UI refresh.

The goal is to make Archery Note feel less like a plain web page and more like a polished PWA / mobile app, while preserving the safety and OSS readiness already achieved for Codex for Open Source.

This document must be treated as a coordination contract between agents.

---

## 1. Current project status

Archery Note has completed the original Codex-oriented OSS preparation phases and is considered to have reached a safe public `v1.0.0` baseline.

The project is also being prepared with Codex for Open Source application/review in mind. UI work must therefore stay easy to review, non-destructive, and clearly documented.

Recent UI refresh foundation work:

- `refactor(ui): add design tokens`
- `refactor(ui): extract inline styles in history-sight-view`
- `refactor(ui): extract inline styles in record-view`

The current phase is **UI foundation cleanup**, not feature expansion.

---

---

## 2. Mandatory model-specific review before implementation

Before starting any UI implementation PR, each AI model that participates in the work must perform its own current-state review first.

This means Codex and Claude should not immediately edit files just because a previous agent proposed the next PR. Each model should first inspect the current `main` branch, review the relevant UI screens/files, and produce an implementation checkpoint.

### Required review output

Before implementation, the active model must report:

```text
1. Current main commit
2. Working tree status
3. Target screen or file to change
4. Current UI problems found by this model
5. Improvement opportunities found by this model
6. Risks and no-touch areas
7. Static styles that can safely be extracted or adjusted
8. Dynamic styles that must remain inline
9. Proposed PR title
10. Proposed files changed
11. Validation plan
12. Confirmation that no code has been changed yet
```

### Cross-model review expectation

When both Codex and Claude are used, they should be treated as separate reviewers:

```text
Claude:
- strong at broad UI review, visual consistency, PR planning, and risk explanation
- should identify layout, spacing, mobile usability, and design-system issues

Codex:
- strong at code-level implementation, small diffs, grep-based checks, and mechanical refactors
- should verify exact selectors, inline styles, DOM references, and validation commands
```

The models do not need to agree perfectly. If they disagree, prefer the safer plan:

```text
smaller diff
fewer files changed
no storage/PWA/version changes
no behavioral changes
more validation before merge
```

### Stop condition

If the active model finds unexpected commits, untracked files, changed storage/PWA/version files, failing tests, unclear event-handler dependencies, or a UI change that would require logic changes, it must stop and report before editing.

### Implementation gate

Implementation may begin only after the model has completed the review and produced a concrete, small PR plan. For high-risk areas such as record input, backup/import/export, active session, or PWA update flow, user approval should be requested before editing.

## 3. Non-negotiable rules

Unless the user explicitly says otherwise, do not change the following:

```text
storage schema
saved data format
localStorage keys
IndexedDB keys
backup/import/export format
record save logic
active session logic
score input logic
history data logic
analysis calculation logic
Service Worker strategy
PWA update flow
version marker
package/package-lock
dependencies
CI workflow
archery-master direct merge
OCR / pose / AI / model files
```

UI work must not be mixed with storage, migration, PWA, dependency, or release work.

---

## 4. Local files that must not be included in PRs

The following local files may exist as untracked handoff/guidance files.

Do not add them to a PR unless the user explicitly says to do so.

```text
AGENTS.md
CLAUDE.md
docs/codex-continue-prompt.md
docs/codex-progress.md
docs/integration-plan.md
```

There may also be a local preserve branch:

```text
preserve/docs-guidance-local-20260702
```

Do not push it, merge it, or base unrelated PRs on it unless the user explicitly approves.

---

## 5. UI refresh goals

The long-term UI goal is:

```text
less plain web page
more polished PWA
more mobile-app-like
more archery-specific
safer to tap during scoring
cleaner dashboard-like history and analysis
```

Desired improvements:

- unified spacing, radius, shadow, and typography
- more consistent cards, chips, buttons, panels, and sheets
- clearer score input flow
- fewer accidental taps on mobile
- cleaner History and Analysis dashboards
- less crowded Settings / Gear screens
- better visual hierarchy
- no loss of accessibility, especially no forced zoom restriction

---

## 6. Current UI foundation progress

Already done:

```text
1. Design tokens added to style.css
2. Static inline styles extracted from scripts/60-history-sight-view.js
3. Static inline styles extracted from scripts/50-record-view.js
```

Important notes:

- Dynamic inline styles may remain if they depend on score, color, width, chart height, target position, or user data.
- Do not force dynamic styles into CSS classes if that would change logic.
- Prefer CSS class extraction only for static visual styles.

---

## 7. Recommended next PRs

### PR A: gear/settings inline style extraction

Recommended next title:

```text
refactor(ui): extract inline styles in gear-settings
```

Scope:

```text
style.css
scripts/70-gear-settings.js
```

Rules:

- Only extract static inline styles.
- Do not change backup/import/export behavior.
- Do not change active workflow/busy guards.
- Do not change data format.
- Do not change settings logic.
- Leave dynamic styles in place.

### PR B: analysis inline style extraction

Recommended title:

```text
refactor(ui): extract inline styles in analysis-physics
```

Scope:

```text
style.css
scripts/40-analysis-physics.js
```

Rules:

- Only extract static visual styles.
- Do not change formulas, calculations, or summary logic.
- Do not change analysis output semantics.
- Leave chart dimensions, data-driven values, or calculated styles if needed.

### PR C: shared component styling

Recommended title:

```text
refactor(ui): unify card and button styles
```

Scope:

```text
style.css
```

Rules:

- Use existing and newly-added design tokens.
- Keep visual changes conservative.
- Do not alter HTML/JS behavior.
- Verify mobile and desktop.

### PR D: mobile settings polish

Recommended title:

```text
style(ui): improve mobile settings panel layout
```

Scope:

```text
style.css
scripts/70-gear-settings.js
```

Rules:

- Fix wrapping/spacing/tap target issues.
- Keep backup/import/export actions unchanged.
- Do not change storage or data export/import behavior.

### PR E: v1.1.0 release

Recommended title sequence:

```text
chore(release): bump app version for ui foundation
docs: update changelog for ui foundation
release: v1.1.0-ui-foundation
```

Only do this after the UI foundation cleanup PRs are merged and validated.

---

## 8. Suggested release roadmap

```text
v1.0.0
Safe public OSS baseline.

v1.1.0-ui-foundation
Design tokens, inline style cleanup, base component consistency.

v1.2.0-record-ui-refresh
Record screen polish, safer score input, clearer current-session flow.

v1.3.0-history-analysis-ui-refresh
History and Analysis dashboard polish, better cards and summaries.

v1.4.0-mobile-polish
Mobile tap targets, bottom navigation, settings layout, PWA feel.
```

---

## 9. Standard workflow for every PR

Start from main:

```bash
git switch main
git pull --ff-only
git status --short
git log --oneline -10
```

Expected:

```text
tracked diffなし
未追跡は指定5ファイルのみ
```

Create a focused branch:

```bash
git switch -c wip/<short-safe-branch-name>
```

Before committing:

```bash
git status --short
git diff --name-only
git diff --check
npm run format:check
npm run lint
npm run test:e2e
npm run check:app
npm run check:ui
npm run check:pwa
npm run check:storage
npm run check:version
npm run check:all
npm audit --omit=dev
```

Expected:

```text
all checks pass
npm audit --omit=dev: found 0 vulnerabilities
only intended files changed
no untracked handoff files staged
```

---

## 10. Standard PR body

Use this structure:

```md
## Summary

Describe the UI-only change.

## Why

Explain what part of the UI refresh plan this supports.

## Changes

- Bullet list of visual/refactor changes

## Not changed

- No storage schema changes
- No save logic changes
- No backup/import/export format changes
- No Service Worker changes
- No PWA update flow changes
- No version marker changes
- No dependency changes
- No CI changes
- No archery-master direct merge
- No OCR / pose / AI / model files
- No tag or GitHub Release

## Validation

- [x] `git diff --check`
- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run test:e2e`
- [x] `npm run check:app`
- [x] `npm run check:ui`
- [x] `npm run check:pwa`
- [x] `npm run check:storage`
- [x] `npm run check:version`
- [x] `npm run check:all`
- [x] `npm audit --omit=dev`
```

---

## 11. Browser verification checklist

For UI PRs, manually check:

```text
mobile width around 375px
desktop width
record tab
history tab
analysis tab
sight adjustment tab
gear/settings tab
settings sheet/modal
active session display if relevant
console errors
```

For record-view work, additionally check:

```text
distance selection
round selection
score input
target click
nudge controls
end confirmation
active session continuation
```

For gear/settings work, additionally check:

```text
backup button
export button
import UI
restore UI
settings panel mobile wrapping
dangerous action buttons
```

Do not actually perform destructive restore/import operations unless using disposable test data and the user has approved the test plan.

---

## 12. Agent-specific guidance

### Claude

Claude may drive `/loop` style UI cleanup, but must keep each PR small.

Claude should stop and report if:

```text
a change touches storage logic
a change touches backup/import/export behavior
a change touches Service Worker or PWA update flow
a change requires dependency changes
a change requires modifying tests/tools/CI
dynamic style extraction would require logic changes
unexpected commits or tracked files appear
```

### Codex

Codex may be used for narrow, mechanical PRs and validation-heavy tasks.

Good Codex tasks:

```text
static inline style extraction
CSS class naming cleanup
validation command execution
small docs/checklist updates
release checklist verification
```

Codex should not independently decide to:

```text
merge archery-master
add AI/OCR/pose/model assets
change storage schema
change Service Worker strategy
change release/version markers
commit local handoff files
```

---

## 13. When to stop and ask the user

Stop immediately and ask the user if any of these happen:

```text
unexpected commits appear on the branch
untracked handoff files become staged
GitHub Actions fail for non-flaky reasons
a UI change requires storage or logic changes
a test requires destructive import/restore
a dependency would need to be added
a PWA/SW/version file would need to change
```

---

## 14. Next recommended instruction

Use this next if continuing the UI foundation work:

```text
/loop

Continue the Archery Note UI refresh foundation.

Next PR:
refactor(ui): extract inline styles in gear-settings

Scope:
style.css
scripts/70-gear-settings.js

Only extract static inline styles into CSS classes.
Do not change backup/import/export behavior, storage schema, settings logic, active workflow guard, Service Worker, PWA update flow, version markers, package files, docs, tests, tools, or CI.

Leave dynamic styles in place if they depend on user data or runtime values.

Before PR:
run git status, inspect inline styles, identify which are static vs dynamic.

After PR:
run git diff --check, format/lint/e2e/check:app/check:ui/check:pwa/check:storage/check:version/check:all, and npm audit --omit=dev.

Report files changed, number of inline styles extracted, remaining inline styles and reasons, browser verification, and confirmation that the 5 local handoff files were not included.
```

---

## 15. Completion definition for v1.1.0-ui-foundation

The UI foundation phase can be considered complete when:

```text
major static inline styles are extracted from core UI files
style.css has design tokens and shared component classes
card/button/chip/panel styling is more consistent
settings mobile layout is less cramped
all validation commands pass
no storage/PWA/version/dependency changes are mixed in
CHANGELOG and version bump are done in separate release PRs
```
