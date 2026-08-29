# OSS Motion Pattern Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt lightweight, OSS-informed motion patterns in Archery Note's existing score, form-analysis, and view-transition flows without adding a runtime dependency or changing practice data behavior.

**Architecture:** Keep motion local to the existing vanilla DOM/CSS surfaces. Use shared CSS timing tokens, explicit ephemeral form states, and the current SVG/DOM lifecycles; use Web Animations/CSS only for opacity, transform, and bounded SVG feedback. Every enhanced path has a deterministic immediate fallback and a reduced-motion rule.

**Tech Stack:** Existing HTML/CSS/vanilla JavaScript, SVG, Web Animations-compatible CSS, Playwright, Node contract scripts, ESLint, Prettier.

## Global Constraints

- No new npm dependency, CDN script, remote asset, or native plugin.
- No storage schema/key, backup/import/export, Service Worker, detector, scoring, or transport change.
- Motion state is ephemeral DOM state only; it is never persisted.
- Only `opacity`, `transform`, color, border, and shadow transitions may be animated; do not animate layout properties.
- All generated SVG/DOM overlays are `aria-hidden="true"` and `pointer-events:none` unless they are actual controls.
- The visible arrow circle, score calculation, coordinates, and `markCircle` arguments must remain unchanged.
- `showView()` must retain `render → remove class → force reflow → add class` order.
- `prefers-reduced-motion: reduce` must disable decorative animation while keeping content, HUD text, status announcements, and controls available.
- Preserve the three unrelated root worktree entries (`docs/codex/integration-plan.md`, `docs/features/form-tracking-feasibility.md`, `docs/features/tracking-analysis-plan.md`) and `debug.log`; never stage them.

## File Map

- `style.css`: shared motion tokens, bounded keyframes, and reduced-motion overrides.
- `scripts/50-record-view.js`: target SVG impact overlay and existing view-entry lifecycle only.
- `scripts/47-form-view.js`: explicit capture/replay motion states and completion teardown timing only.
- `tools/check-ui.js`: static contracts for timing, cleanup, reduced motion, and forbidden layout animation.
- `tools/check-form-core.js`: source contracts for form-state ordering and single teardown/save behavior.
- `tests/e2e/app-smoke.spec.js`: target-impact lifecycle and tab visibility/overflow browser checks.
- `tests/e2e/form-diagnostics.spec.js`: form-state, save/cancel, double-save, and reduced-motion browser checks.
- `docs/codex/codex-progress.md`: one short entry after each task with changed files, evidence, risk, and next task.

---

### Task 1: Adopt bounded SVG impact feedback

**Files:**

- Modify: `scripts/50-record-view.js` in `refreshActive()` and its existing `freshTimer` cleanup.
- Modify: `style.css` near `.shotNew`, `.sc.fresh`, and reduced-motion rules.
- Modify: `tools/check-ui.js` static UI contracts.
- Test: `tests/e2e/app-smoke.spec.js` target placement test.
- Modify: `docs/codex/codex-progress.md` with the Task 1 evidence.

**Interfaces:**

- Consumes: existing `gp(a)`, `markCircle(gp(a), s.faceD, ...)`, `ui.freshArrow`, and the existing 640 ms `freshTimer`.
- Produces: one temporary `.impactOverlay` inside the fresh SVG marker, removed by the same timer; no new exported API.

- [ ] **Step 1: Write the failing static and browser contracts.**

Add assertions to `tools/check-ui.js` and `tests/e2e/app-smoke.spec.js` that require a bounded impact ring/ray and verify the fresh overlay exists immediately after placement and is gone after the existing timer window:

```js
await expect(page.locator("#tgmarks .shotNew .impactOverlay")).toHaveCount(1);
await page.waitForTimeout(750);
await expect(page.locator("#tgmarks .impactOverlay")).toHaveCount(0);
```

- [ ] **Step 2: Run the contracts and record the intended RED.**

Run:

```powershell
node tools/check-ui.js
npx playwright test tests/e2e/app-smoke.spec.js --project=chromium --grep "new arrow exposes" --workers=1
```

Expected: the static contract or selector assertion fails because the impact overlay is not present yet.

- [ ] **Step 3: Implement the minimal overlay using existing coordinates and timer.**

Keep the existing marker call unchanged and append a display-only group from the same `pos`:

```js
const pos = gp(a);
const marker = markCircle(pos, s.faceD, color, scoreLabel(a), fresh ? "shotNew" : "");
const impact = `<g class="impactOverlay" aria-hidden="true"><circle class="impactRing" .../><path class="impactRay" .../></g>`;
html += fresh ? marker.replace(/<\/g>$/, `${impact}</g>`) : marker;
```

In the existing 640 ms callback, remove `#tgmarks .impactOverlay` elements alongside `.shotNew`/`.sc.fresh`. Add only opacity/transform/stroke keyframes and a reduced-motion override; do not alter hit-testing or score geometry.

- [ ] **Step 4: Run the focused GREEN checks and inspect mobile bounds.**

Run:

```powershell
node tools/check-ui.js
npx playwright test tests/e2e/app-smoke.spec.js --project=chromium --grep "new arrow exposes" --workers=1
npm run check:app
npm run format:check
npm run lint
git diff --check
```

Expected: all commands exit 0; the 390 px target remains within the viewport and the overlay count reaches zero after 750 ms.

- [ ] **Step 5: Commit the bounded impact slice.**

```powershell
git add scripts/50-record-view.js style.css tools/check-ui.js tests/e2e/app-smoke.spec.js docs/codex/codex-progress.md
git diff --cached --check
git commit -m "feat(ui): add bounded arrow impact motion"
```

### Task 2: Make form analysis states visible and single-shot

**Files:**

- Modify: `scripts/47-form-view.js` in `openFormCapture()`, `startFormReplay()`, save/close handlers, and teardown helpers.
- Modify: `style.css` near `.formCapture`, `.formCamWrap`, and form state selectors.
- Modify: `tools/check-form-core.js` source contracts for state ordering and teardown guards.
- Modify: `tools/check-ui.js` form-state and reduced-motion contracts.
- Test: `tests/e2e/form-diagnostics.spec.js` state, save/cancel, retry, double-save, and reduced-motion cases.
- Modify: `docs/codex/codex-progress.md` with the Task 2 evidence.

**Interfaces:**

- Consumes: existing `freezeCaptureForSave()`, `freezeReplayForSave()`, `finishCapture()`, `finishReplay()`, diagnostic candidate/retry paths, and receipt failure handling.
- Produces: `data-motion-state` values `ready`, `analyzing`, `saved`, `canceled`, and `failed`; an idempotent visual completion boundary that does not create a second save.

- [ ] **Step 1: Write failing state and duplicate-save tests.**

Add browser assertions for the initial/analyzing state, a visible saved/canceled frame before teardown, and rapid repeated save clicks producing one record and one primary write. The ordinary save fixture must exercise `shots.length > 0`; diagnostic zero-shot tests are not sufficient:

```js
await expect(page.locator('.formCapture[data-motion-state="ready"]')).toHaveCount(1);
await expect(page.locator('.formCapture[data-motion-state="saved"]')).toHaveCount(1);
await page.locator("#fcSave").dblclick({ force: true });
expect(await page.evaluate(() => db.formAnalyses.length)).toBe(1);
```

- [ ] **Step 2: Run form contracts and capture RED.**

Run:

```powershell
node tools/check-form-core.js
npx playwright test tests/e2e/form-diagnostics.spec.js --project=chromium --grep "motion|double|save|discard" --workers=1
```

Expected: state selectors are absent or a rapid ordinary save records two attempts before the implementation guard exists.

- [ ] **Step 3: Implement explicit states with immediate freeze and delayed visual teardown.**

Use one local state setter per overlay and keep all state transient:

```js
function setFormMotionState(state) {
  ovl.querySelector(".formCapture")?.setAttribute("data-motion-state", state);
}
```

On completion, set `formMotionFinishing = true`, call the existing freeze helper immediately, disable/guard save and close handlers, render `saved` or `canceled`, then call the existing teardown after one 280 ms paint window (or one frame for reduced motion). Failed saves remain `failed` and restore the existing retry button without mutating the candidate. Reuse the same structure for live and replay.

- [ ] **Step 4: Run GREEN form and regression checks.**

Run:

```powershell
node tools/check-form-core.js
node tools/check-ui.js
npx playwright test tests/e2e/form-diagnostics.spec.js --project=chromium --grep "motion|double|save|discard" --workers=1
npm run check:form
npm run check:app
npm run format:check
npm run lint
node --check scripts/47-form-view.js
git diff --check
```

Expected: all focused state/retry/double-save cases pass; existing diagnostic, receipt, and close behavior remains unchanged.

- [ ] **Step 5: Commit the form state slice.**

```powershell
git add scripts/47-form-view.js style.css tools/check-form-core.js tools/check-ui.js tests/e2e/form-diagnostics.spec.js docs/codex/codex-progress.md
git diff --cached --check
git commit -m "feat(ui): animate form analysis states"
```

### Task 3: Align view rhythm and reduced-motion behavior

**Files:**

- Modify: `style.css` shared motion variables, `main.viewEnter`, result reveal selectors, toast transition, and reduced-motion rules.
- Inspect only: `scripts/50-record-view.js` `showView()`; change only if a contract reveals a regression, preserving exact order.
- Modify: `tools/check-ui.js` shared-token and forbidden-layout-motion contracts.
- Test: `tests/e2e/app-smoke.spec.js` tab visibility/no-overflow case.
- Test: `tests/e2e/form-diagnostics.spec.js` reduced-motion HUD/immediate-content case.
- Modify: `docs/codex/codex-progress.md` with the Task 3 evidence.

**Interfaces:**

- Consumes: existing `showView(v)` render lifecycle and the form `data-motion-state` contract from Task 2.
- Produces: shared `--motion-fast:.18s`, `--motion-med:.28s`, `--motion-fluid:.42s` tokens and a reduced-motion contract.

- [ ] **Step 1: Write failing shared-token and browser contracts.**

Require the exact token values, `main.viewEnter` usage, and no horizontal overflow after a tab change. For reduced motion, inspect the form camera pseudo-element after setting `data-motion-state="analyzing"`:

```js
const animationName = await page.locator(".formCapture").evaluate((el) => {
  el.setAttribute("data-motion-state", "analyzing");
  return globalThis.getComputedStyle(el.querySelector(".formCamWrap"), "::before").animationName;
});
expect(animationName).toBe("none");
```

- [ ] **Step 2: Run RED checks.**

Run:

```powershell
node tools/check-ui.js
npx playwright test tests/e2e/app-smoke.spec.js --project=chromium --grep "tab changes keep" --workers=1
npx playwright test tests/e2e/form-diagnostics.spec.js --project=chromium --grep "reduced motion keeps" --workers=1
```

Expected: the exact shared-token contract fails before the values/selectors are aligned; existing behavior must remain reachable.

- [ ] **Step 3: Implement only shared timing substitutions and reduced-motion coverage.**

Set the tokens and replace literal durations in existing view/result selectors without changing layout:

```css
:root {
  --motion-fast: 0.18s;
  --motion-med: 0.28s;
  --motion-fluid: 0.42s;
}
main.viewEnter {
  animation: viewEnter var(--motion-med) var(--ease-app) both;
}
.todayConclusionCard {
  animation: appRise var(--motion-fluid) var(--ease-app) both;
}
```

Keep the existing `showView()` sequence exactly as:

```js
render();
m.classList.remove("viewEnter");
void m.offsetWidth;
m.classList.add("viewEnter");
```

Extend the existing reduced-motion rule only to ensure form pseudo-elements and view reveals are immediate; do not hide HUD or content.

- [ ] **Step 4: Run the complete validation ladder.**

Run:

```powershell
node tools/check-ui.js
npx playwright test tests/e2e/app-smoke.spec.js --project=chromium --grep "tab changes keep" --workers=1
npx playwright test tests/e2e/form-diagnostics.spec.js --project=chromium --grep "reduced motion keeps" --workers=1
npm run check:app
npm run check:form
npm run check:all
npm run lint
npm run format:check
git diff --check
```

Expected: all commands exit 0; screenshots at 360×780, 390×844, and 1280×800 show no clipping or horizontal overflow.

- [ ] **Step 5: Commit the complete motion rhythm slice.**

```powershell
git add style.css tools/check-ui.js tests/e2e/app-smoke.spec.js tests/e2e/form-diagnostics.spec.js docs/codex/codex-progress.md
git diff --cached --check
git commit -m "feat(ui): add field instrument motion"
```

## Final review checklist

- [ ] Re-read the approved design and verify every requirement maps to a task.
- [ ] Search this plan for unfinished wording and vague implementation instructions.
- [ ] Confirm task interfaces use the same function/state names across tasks.
- [ ] Run `npm run check:all`, `npm run lint`, `npm run format:check`, and `git diff --check` on the final head.
- [ ] Request an independent review after each task and one final review over the motion-only range.
- [ ] Keep physical iPhone HTTPS acceptance separate; do not claim browser tests replace it.
