# Codex Continue Prompt

Use this when you want Codex to continue the integration work without bouncing
between ChatGPT and Codex.

## Paste Into Codex

```text
Use $archery-note.

Continue the Archery Note integration loop.

Read these files first:
- AGENTS.md
- docs/integration-plan.md
- docs/codex-progress.md

Then do exactly one small task:
- If docs/codex-progress.md says phase reconciliation is not done, perform only
  the repository inventory and update docs/codex-progress.md.
- Otherwise, pick the next not-started or in-progress task from
  docs/codex-progress.md that is safe to do now.

Rules:
- Start with git status --short.
- Preserve existing local user data.
- Do not delete legacy storage data.
- Keep OCR, pose, AI, and third-party model assets default-off unless their
  provenance and redistribution terms are documented.
- Keep the primary iPhone workflow simple.
- Make the smallest useful change.
- Run the narrowest relevant validation.
- Update docs/codex-progress.md with changed files, validation, and the next
  task.
- Stop and ask me before risky storage migration, Service Worker activation
  changes, dependency additions, or broad UI rewrites.

Final response format:
- What changed
- Validation run
- Risk notes
- Next task
```

## Paste Into Codex When Fable Is Unavailable

Use this stricter variant when continuing without a stronger agent (Claude
Fable or similar) — on Codex alone or on a low-cost model. It assumes no memory
of prior sessions and leans harder on the written recipes.

```text
Use $archery-note. Assume no memory of prior sessions.

Read these files first, in this order:
- AGENTS.md
- docs/codex-progress.md (current status and next task)
- references/recipes.md in the $archery-note skill
- docs/integration-plan.md (only the Codex Working Summary and the section
  relevant to the next task)

Then do exactly one small task: the "Next task" from docs/codex-progress.md,
following the matching recipe (scoring / UI / release / storage) literally.

Hard invariants:
- The visible arrow circle and line-cutter scoring must agree: if the circle
  touches the higher ring at all, the higher score applies.
- Never delete or rewrite legacy user data; migrations are additive and
  idempotent.
- Keep the primary iPhone practice workflow simple; advanced controls go to
  settings or secondary screens.

Rules:
- Start with git status --short. Inspect current code; do not trust remembered
  line numbers, versions, or storage keys.
- Make the smallest useful change and run the recipe's validation commands.
- Update docs/codex-progress.md with changed files, validation results
  (including failures), risk notes, and the next task.
- Stop and ask before: storage migration, Service Worker activation changes,
  dependency additions, broad UI rewrites, or anything a recipe's stop
  condition names.
- If the next step or an invariant is unclear, stop and ask instead of
  guessing.

Final response format:
- What changed
- Validation run (pass/fail per command)
- Risk notes
- Next task
```

## Optional CLI Form

From the repository root:

```powershell
codex exec --sandbox workspace-write -o artifacts/codex-last-report.md "Use $archery-note. Continue the Archery Note integration loop. Read AGENTS.md, docs/integration-plan.md, and docs/codex-progress.md first. Do exactly one small task from docs/codex-progress.md, starting with phase reconciliation if it is not done. Preserve existing local data, keep risky OCR/pose/AI features default-off, run the narrowest relevant validation, and update docs/codex-progress.md with changed files, validation, risk notes, and the next task. Stop and ask before risky storage migration, Service Worker activation changes, dependency additions, or broad UI rewrites."
```

Review the first few runs manually before scheduling or fully automating this.
