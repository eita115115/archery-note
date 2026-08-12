# Field-instrument Motion Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restrained, cause-and-effect motion to arrow impacts, form-analysis states, and view/result transitions without changing scoring, release detection, storage, transport, or the primary iPhone workflow.

**Architecture:** Reuse the existing `freshArrow`, `main.viewEnter`, form overlay lifecycle, and status/toast events. CSS owns visual timing; JavaScript only toggles bounded classes/data attributes at existing render and lifecycle boundaries. All new state is ephemeral DOM state and is cleared with the existing freshness timer or overlay teardown.

**Tech Stack:** Existing vanilla JavaScript, SVG target markup, `style.css`, Playwright E2E, Node static contracts, Prettier, ESLint.

## Global Constraints

- Keep the field-instrument language: warm paper, ink, hairline gold, flat surfaces, and restrained motion.
- Preserve the visible arrow circle and line-cutter behavior; do not modify scoring radius or detector thresholds.
- Preserve all local records and existing schema, coordinator, receipt, retry, and transport behavior.
- Use `@media (prefers-reduced-motion: reduce)` so content is immediately visible and no animation blocks input.
- Do not add dependencies, fonts, images, sound, haptics, analytics, network calls, Service Worker changes, or version changes.
- Keep the primary iPhone capture and score-entry controls in the same positions and dimensions.
- Leave the three pre-existing metadata docs and root `debug.log` untouched and unstaged.

---

### Task 1: Arrow impact and score motion

**Files:**

- Modify: `style.css` (motion tokens/keyframes near the existing `scorePop`, `markPop`, and `.shotNew` rules)
- Modify: `scripts/50-record-view.js:1457-1507,1735-1750` (existing `refreshActive()` and arrow-add lifecycle only)
- Modify: `tools/check-ui.js` (static contracts for impact selectors and reduced-motion coverage)
- Test: `tests/e2e/app-smoke.spec.js` (record a tap and verify one fresh impact state)
- Modify: `docs/codex/codex-progress.md` (one task ledger entry)

**Interfaces:**

- Consumes: existing `ui.freshArrow`, `impactQuadrantClass(a)`, `markCircle(...)`, `scoreLabel(a)`, and `freshTimer`.
- Produces: `shotImpact`/`shotImpactRing` CSS hooks that are present only while the existing fresh arrow is active; no new persisted fields.

- [ ] **Step 1: Write the failing static and browser assertions.**

Add to `tools/check-ui.js` after the existing `freshArrow` contract:

```js
assert(
  css.includes(".shotNew .impactRing") &&
    css.includes("@keyframes impactRing") &&
    css.includes("@media (prefers-reduced-motion: reduce)") &&
    css.includes(".shotNew .impactRay"),
  "arrow impact motion and reduced-motion guard missing",
);
```

Add to `tests/e2e/app-smoke.spec.js`:

```js
test("new arrow exposes one bounded impact state", async ({ page }) => {
  await seedRecordPage(page);
  await page.getByTestId("record-start").click();
  await page.locator("#tgsvg").click({ position: { x: 150, y: 150 } });
  await expect(page.locator("#tgmarks .shotNew")).toHaveCount(1);
  await expect(page.locator("#tgmarks .shotNew .impactRing")).toHaveCount(1);
  await page.waitForTimeout(750);
  await expect(page.locator("#tgmarks .shotNew")).toHaveCount(0);
});
```

Run: `node tools/check-ui.js` and `npx playwright test tests/e2e/app-smoke.spec.js --project=chromium --grep "bounded impact" --workers=1`.

Expected: the static check fails with `arrow impact motion and reduced-motion guard missing`; the browser test fails because `.impactRing` is not rendered.

- [ ] **Step 2: Add the smallest render hook.**

In `scripts/50-record-view.js`, keep the existing `markCircle(...)` call and append an SVG-only child to the same fresh marker output. The render expression must keep the same coordinates and radius:

```js
const fresh = i === ui.freshArrow;
const pos = gp(a);
const marker = markCircle(
  gp(a),
  s.faceD,
  i === ui.selArrow ? "#111" : "var(--green-l)",
  scoreLabel(a),
  fresh ? "shotNew" : "",
);
html += fresh
  ? `${marker}<g class="impactOverlay" aria-hidden="true"><circle class="impactRing" cx="${pos.x}" cy="${-pos.y}" r="${Math.max(0.7, s.faceD / 34)}"/><path class="impactRay" d="M ${pos.x - s.faceD / 22} ${-pos.y} H ${pos.x + s.faceD / 22}"/></g>`
  : marker;
```

If `markCircle` already emits a wrapper that makes the exact coordinates unavailable, put the `impactOverlay` group inside that wrapper and use the same `gp(a)` values. Do not add a second hit target or change `markCircle`'s score/radius arguments.

- [ ] **Step 3: Add bounded CSS motion.**

Add these rules beside the existing `.shotNew` rules in `style.css`:

```css
@keyframes impactRing {
  0% {
    opacity: 0.72;
    transform: scale(0.55);
  }
  68% {
    opacity: 0.32;
    transform: scale(1.08);
  }
  100% {
    opacity: 0;
    transform: scale(1.28);
  }
}
@keyframes impactRay {
  0% {
    opacity: 0.72;
    transform: scaleX(0.35);
  }
  100% {
    opacity: 0;
    transform: scaleX(1);
  }
}
.shotNew .impactOverlay {
  pointer-events: none;
  transform-box: fill-box;
  transform-origin: center;
}
.shotNew .impactRing {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.2;
  transform-box: fill-box;
  transform-origin: center;
  animation: impactRing 0.42s var(--ease-app) both;
}
.shotNew .impactRay {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1;
  stroke-linecap: butt;
  transform-box: fill-box;
  transform-origin: center;
  animation: impactRay 0.28s var(--ease-app) 0.04s both;
}
```

Do not use a large fill, glow, or `position: fixed`. The existing `freshTimer` remains the cleanup boundary.

- [ ] **Step 4: Make the contracts pass and verify mobile behavior.**

Run:

```text
node tools/check-ui.js
npx playwright test tests/e2e/app-smoke.spec.js --project=chromium --grep "bounded impact" --workers=1
npm run check:app
npm run format:check
npm run lint
git diff --check
```

Expected: all commands pass; the impact is one-shot, does not alter score text or target dimensions, and disappears after the existing freshness window.

- [ ] **Step 5: Commit Task 1.**

```text
git add style.css scripts/50-record-view.js tools/check-ui.js tests/e2e/app-smoke.spec.js docs/codex/codex-progress.md
git commit -m "feat(ui): animate arrow impacts"
```

---

### Task 2: Form-analysis state motion

**Files:**

- Modify: `style.css` (form overlay state selectors/keyframes near `.formPhaseTag` and `.formHud`)
- Modify: `scripts/47-form-view.js:372-440,790-820,930-1015,1080-1155` (overlay setup, save success/failure, retry, and teardown boundaries)
- Modify: `tools/check-ui.js` (state selector/static contracts)
- Modify: `tests/e2e/form-diagnostics.spec.js` (ready, analyzing, saved, failed/retry, canceled states)
- Modify: `docs/codex/codex-progress.md` (one task ledger entry)

**Interfaces:**

- Consumes: existing `ovl`, `hud`, `phaseEl`, `running`, `frozenDiagnosticSave`, `finishCapture()`, `finishLiveDiagnosticAttempt()`, replay save flow, and existing status/toast copy.
- Produces: `data-motion-state="ready|analyzing|saved|failed|canceled"` on `.formCapture`; the attribute is visual-only and is removed with the overlay.

- [ ] **Step 1: Write the failing state contracts and E2E assertions.**

Add to `tools/check-ui.js`:

```js
assert(
  css.includes('.formCapture[data-motion-state="analyzing"]') &&
    css.includes("@keyframes formScan") &&
    css.includes('.formCapture[data-motion-state="saved"]') &&
    css.includes('.formCapture[data-motion-state="failed"]'),
  "form motion states are incomplete",
);
```

Add a helper in `tests/e2e/form-diagnostics.spec.js`:

```js
async function formMotionState(page) {
  return page.locator(".formCapture").getAttribute("data-motion-state");
}
```

Add assertions to the existing zero-shot live/replay save tests immediately after the overlay appears:

```js
await expect.poll(() => formMotionState(page)).toBe("ready");
await expect(page.locator('.formCapture[data-motion-state="analyzing"]')).toHaveCount(0);
```

Add a focused failure assertion after the existing failing save seam opens the retry UI:

```js
await expect(page.locator('.formCapture[data-motion-state="failed"]')).toHaveCount(1);
```

Run: `npm run check:ui` and the focused form tests. Expected: static contracts fail because no form state selectors exist; browser state attributes are absent.

- [ ] **Step 2: Add a local state helper without touching persisted data.**

In both live and replay overlay functions, define one local helper after `phaseEl`/`hud`:

```js
function setFormMotionState(state) {
  if (!ovl.isConnected) return;
  ovl.querySelector(".formCapture")?.setAttribute("data-motion-state", state);
}
setFormMotionState("ready");
```

Call it only at existing visual lifecycle boundaries:

```js
setFormMotionState("analyzing"); // immediately before loadFormPose/startCamera or replay processing
setFormMotionState("saved"); // immediately before finishCapture() after a successful save
setFormMotionState("failed"); // immediately before enabling the existing 保存を再試行 button
setFormMotionState("canceled"); // immediately before discard/teardown confirmation resolves
```

Do not add a database field, change `createFrozenFormDiagnosticSave`, alter retry eligibility, or move `finishCapture()`.

- [ ] **Step 3: Add finite CSS states and reduced-motion behavior.**

Add beside the existing form overlay rules:

```css
@keyframes formScan {
  0% {
    opacity: 0;
    transform: translateX(-18%);
  }
  18% {
    opacity: 0.58;
  }
  82% {
    opacity: 0.58;
  }
  100% {
    opacity: 0;
    transform: translateX(118%);
  }
}
@keyframes formSavedRing {
  from {
    opacity: 0.15;
    transform: scale(0.78) rotate(-18deg);
  }
  to {
    opacity: 0.8;
    transform: scale(1) rotate(0);
  }
}
.formCapture {
  --form-motion-line: rgba(232, 245, 237, 0.52);
}
.formCapture[data-motion-state="ready"] .formCamWrap::after,
.formCapture[data-motion-state="analyzing"] .formCamWrap::after {
  content: "";
  position: absolute;
  inset: 18% 8%;
  border: 1px solid var(--form-motion-line);
  pointer-events: none;
  opacity: 0.28;
}
.formCapture[data-motion-state="analyzing"] .formCamWrap::before {
  content: "";
  position: absolute;
  top: 18%;
  bottom: 18%;
  left: 8%;
  width: 1px;
  background: var(--accent);
  pointer-events: none;
  animation: formScan 0.9s var(--ease-fluid) both;
}
.formCapture[data-motion-state="saved"] .formCamWrap::after {
  content: "✓";
  position: absolute;
  inset: 50% auto auto 50%;
  color: var(--accent);
  font-size: 28px;
  line-height: 1;
  transform: translate(-50%, -50%);
  animation: formSavedRing 0.28s var(--ease-app) both;
  pointer-events: none;
}
.formCapture[data-motion-state="failed"] .formCamWrap::after,
.formCapture[data-motion-state="canceled"] .formCamWrap::after {
  content: "";
  position: absolute;
  inset: 18% 8%;
  border: 1px solid rgba(255, 255, 255, 0.24);
  pointer-events: none;
}
```

Extend the existing reduced-motion block with `animation-duration:0s` behavior already provided by `animation:none`; ensure pseudo-elements remain non-blocking and content/status remain visible.

- [ ] **Step 4: Verify state isolation and retries.**

Run:

```text
node tools/check-ui.js
npx playwright test tests/e2e/form-diagnostics.spec.js --project=chromium --grep "zero-shot|retry|discard|save" --workers=1
npm run check:form
npm run check:app
npm run lint
npm run format:check
git diff --check
```

Expected: live/replay success reaches `saved` once; false/throw/allocation failure reaches `failed` and keeps the current retry button; cancel/discard clears the overlay; diagnostics-off and receipt-failure semantics remain unchanged.

- [ ] **Step 5: Commit Task 2.**

```text
git add style.css scripts/47-form-view.js tools/check-ui.js tests/e2e/form-diagnostics.spec.js docs/codex/codex-progress.md
git commit -m "feat(ui): animate form analysis states"
```

---

### Task 3: View/result rhythm and final responsive verification

**Files:**

- Modify: `style.css` (shared motion variables and existing `viewEnter`/list/result selectors)
- Modify: `scripts/50-record-view.js:18-29` (preserve the existing view-enter hook; no new lifecycle function)
- Modify: `tools/check-ui.js` (shared timing/reduced-motion contracts)
- Modify: `tests/e2e/app-smoke.spec.js` (tab/result motion and no-overlap probes)
- Modify: `tests/e2e/form-diagnostics.spec.js` (reduced-motion form state probe)
- Modify: `docs/codex/codex-progress.md` (final task ledger entry)

**Interfaces:**

- Consumes: existing `showView()`, `main.viewEnter`, `summary`/`today` render classes, and browser `prefers-reduced-motion` emulation.
- Produces: shared `--motion-*` timing variables and a deterministic view/result reveal order; no new navigation state.

- [ ] **Step 1: Write the failing shared-motion contracts.**

Add to `tools/check-ui.js`:

```js
assert(
  css.includes("--motion-fast") &&
    css.includes("--motion-fluid") &&
    css.includes("main.viewEnter") &&
    css.includes("@media (prefers-reduced-motion: reduce)"),
  "shared view motion contract missing",
);
```

Add to `tests/e2e/app-smoke.spec.js`:

```js
test("tab changes keep the main content visible and bounded", async ({ page }) => {
  await seedRecordPage(page);
  await page.getByRole("button", { name: "分析" }).click();
  await expect(page.locator("main.viewEnter")).toHaveCount(1);
  await expect(page.locator("main")).toBeVisible();
  const overflow = await page
    .locator("body")
    .evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
```

Add to `tests/e2e/form-diagnostics.spec.js`:

```js
test("reduced motion keeps form content immediate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedDiagnosticDb(page, makeSyntheticDiagnosticDb({ settings: { formDebug: true } }));
  await page.locator("#formStart").click();
  await expect(page.locator(".formCapture")).toBeVisible();
  await expect(page.locator("#fcHud")).toBeVisible();
  const animation = await page.locator(".formCapture").evaluate((el) => {
    el.setAttribute("data-motion-state", "analyzing");
    return getComputedStyle(el.querySelector(".formCamWrap"), "::before").animationName;
  });
  expect(animation).toBe("none");
});
```

Run the two focused tests. Expected: the new contract/test fails until shared selectors and the reduced-motion probe are aligned.

- [ ] **Step 2: Normalize shared timing without changing layout.**

At the existing motion variable block in `style.css`, define or preserve:

```css
:root {
  --motion-fast: 0.18s;
  --motion-med: 0.28s;
  --motion-fluid: 0.42s;
  --ease-app: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-fluid: cubic-bezier(0.22, 1, 0.36, 1);
}
```

Update only the durations/easings of existing `main.viewEnter`, child stagger, `toast.show`, and today's-result reveal selectors to use these variables. Do not change `display`, `position`, width, height, grid, or flex declarations.

- [ ] **Step 3: Keep the existing lifecycle hook deterministic.**

In `showView(v)`, preserve this exact sequence:

```js
render();
m.classList.remove("viewEnter");
void m.offsetWidth;
m.classList.add("viewEnter");
```

If a result mount needs a class, add it at the existing render boundary and remove it on the next render; do not create a global interval or delayed content fetch. The first frame must still contain the current conclusion/status text.

- [ ] **Step 4: Run the complete UI validation ladder.**

Run:

```text
node tools/check-ui.js
npm run check:app
npm run check:form
npm run lint
npm run format:check
npm run check:all
npx playwright test tests/e2e/app-smoke.spec.js tests/e2e/form-diagnostics.spec.js --project=chromium --workers=1
git diff --check
```

Run the browser suite at 360x780, 390x844, and 1280x800. Verify target placement, score chips, capture toolbar, save/retry controls, tabs, and today's-result content have no clipping, overlap, or horizontal overflow. Repeat the focused run with `prefers-reduced-motion: reduce`.

- [ ] **Step 5: Update the ledger and commit Task 3.**

Record changed files, exact validation results, the fact that scoring/detection/storage/transport were untouched, and the next release gate (physical HTTPS acceptance remains separate) in `docs/codex/codex-progress.md`.

```text
git add style.css scripts/50-record-view.js tools/check-ui.js tests/e2e/app-smoke.spec.js tests/e2e/form-diagnostics.spec.js docs/codex/codex-progress.md
git commit -m "feat(ui): add field instrument motion"
```

---

## Plan self-review

- **Spec coverage:** impact ring/score tick is Task 1; form ready/analyzing/saved/failed/canceled states are Task 2; view/result rhythm and reduced-motion behavior are Task 3; responsive validation and unchanged product data are enforced in every task and the final ladder.
- **No implementation placeholders:** every task names exact files, existing boundaries, test commands, expected RED/GREEN outcomes, and commit subjects.
- **Type/state consistency:** the only new DOM contract is `data-motion-state` on `.formCapture`; the only new impact contracts are `.impactOverlay`, `.impactRing`, and `.impactRay`; no persisted or cross-task JavaScript API is introduced.
- **Scope check:** no storage, scoring, detector, transport, Service Worker, dependency, or version files are in the implementation scope.
