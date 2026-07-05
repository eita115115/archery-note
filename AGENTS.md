# Archery Note Agent Guide

This repository is the real Archery Note app. The Claude/Codex session folder
under `C:\Users\eita2\.claude\sessions` is only conversation/work history and is
not the application source. Do not move session files into this repo.

## Project Shape

- Repo root: `C:\Users\eita2\Projects\archery-note`
- Main app surface: web/PWA first, in `index.html`
- Native shell: Capacitor/Android exists, but use it only when requested
- Preview helper: `.claude/launch.json` serves the repo on port `8741`
- Deployed app: GitHub Pages

## Operating Rules

- Check `git status --short` before editing.
- Inspect current files before relying on remembered line numbers or old
  version numbers.
- Keep changes scoped to the requested behavior. Avoid unrelated refactors.
- Preserve user practice data. Data-loss warnings belong near backup, import,
  export, and browser-storage reset actions.
- Keep the primary phone flow simple. Move advanced controls into settings,
  collapsible areas, or secondary screens.
- Prefer small pure functions, explicit units, and focused regression checks for
  scoring, physics, and sight-adjustment logic.

## Scoring And Physics

- The visible arrow circle and the score result must agree.
- For line-cutter behavior, if the displayed arrow circle touches the higher
  scoring ring at all, the higher score should apply.
- Before changing scoring, inspect the current implementations of
  `arrowMarkRadius`, `lineCutRadius`, `scoreAt`, `hitFromGlobal`, and
  `markCircle`.
- Re-score paths for drag, nudge, and initial placement must use the same radius
  source as the displayed arrow circle.

## Commands

Inspect `package.json` scripts before running; this list can drift.

- `npm run check:app` / `npm run check:ui`
- `npm run check:pwa` / `npm run check:storage` / `npm run check:version`
- `npm run check:all` (app + ui + pwa + storage + version)
- `npm run format:check` / `npm run lint` / `npm run test:e2e`
- `npm run build:native-web`

Run the smallest useful validation for the change. The `$archery-note` skill
(`references/recipes.md`) has a validation ladder per change type. For UI or
interaction work, use the local preview and verify mobile-sized behavior when
practical.

## Release And Versioning

- Version markers live in four places: `const APP_VER` in the app scripts
  (currently `scripts/10-storage-native.js`; confirm with
  `git grep "const APP_VER="`), `v` in `version.json`, the `archery-note-vNN`
  cache name in `sw.js`, and the `package.json` version.
- When a deployed change should trigger the in-app update banner, bump all
  markers together with `npm run version:bump`, then verify with
  `npm run check:version`.
- The usual publish loop is: edit, validate, commit, push, then poll
  `version.json` or the deployed site until the new version is live.

## Low-Cost Model / Fallback Mode

This loop must stay runnable when a stronger agent (e.g. Claude Fable) is
unavailable and work continues on Codex or a low-cost model. In that case:

- Follow the matching recipe in the `$archery-note` skill
  (`references/recipes.md`) literally: scoring, UI, release, or storage.
- Do exactly one small task per run, then update `docs/codex/codex-progress.md`.
- Never break these invariants: the visible arrow circle and line-cutter
  scoring agree; legacy user data is never deleted; the primary iPhone
  workflow stays simple.
- Run the recipe's validation commands; report failures honestly.
- If the next step or an invariant is unclear, stop and ask the user.

## Local Helper LLM

Codex stays the primary agent. If a local Ollama helper is useful, prefer
`qwen2.5-coder:3b` and ask only for narrow checks such as unit mismatches,
boundary cases, or test ideas. Do not let the helper make final design,
scoring, storage, or release decisions.

## Useful Codex Skills

- Use `$archery-note` for app-specific implementation, scoring, release, and
  Japanese-copy work.
- Use `$frontend-design` for UI polish and responsive mobile layouts.
- Use `$diagnose`, `$tdd`, `$prototype`, `$zoom-out`, or
  `$improve-codebase-architecture` when the task calls for that workflow.

## Long-Running Integration Loop

- The durable integration brief lives in `docs/codex/integration-plan.md`.
- Progress and next-task state live in `docs/codex/codex-progress.md`.
- A ready-to-paste continuation prompt lives in
  `docs/codex/codex-continue-prompt.md`.
- For integration work, read all three files before editing.
- Do exactly one small task per run, then update `docs/codex/codex-progress.md` with
  changed files, validation, risk notes, and the next task.
- If phase reconciliation is not done, do repository inventory and update the
  ledger before implementing new behavior.
- Stop for user confirmation before risky storage migration, Service Worker
  activation changes, dependency additions, or broad UI rewrites.
