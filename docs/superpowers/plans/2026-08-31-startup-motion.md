# Startup Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a short logo splash and screen entrance to Archery Note startup without delaying practice, hiding fallback errors, or changing app data behavior.

**Architecture:** The initial HTML owns a temporary `bootSplash` element using the existing `icon.svg`. The existing `90-init.js` render boundary releases the splash once, adds transient header/main entrance classes, and removes the splash after its exit animation; CSS owns the visual timing and a delayed failsafe that yields to `bootFallback`. The production stylesheet is regenerated from `style.css` so GitHub Pages and local previews use the same rules.

**Tech Stack:** Existing HTML, vanilla JavaScript, CSS keyframes/media queries, Playwright Chromium tests, `tools/check-ui.js`, and the repository's `build:web-assets` generator.

## Global Constraints

- Use the existing `icon.svg`, inline DOM/CSS state, and the current local initialization path. No remote asset or runtime dependency.
- Cap the sequence at roughly 500–600 ms and keep the record controls available as soon as the handoff completes.
- After the existing initial `render()` completes in `90-init.js`, add a transient ready class, allow one paint, then fade/remove the splash. The existing `main.viewEnter` sequence remains the only view-render transition.
- Keep all startup state ephemeral. No `db` fields, timers in persistence, scoring calls, detector calls, camera calls, or transport calls are added.
- `prefers-reduced-motion: reduce` disables scale/translate and transition timing, makes the splash and initial content immediately visible, and keeps the HUD, controls, and explanatory text visible.
- The splash overlay owns pointer input while present so hidden controls cannot be activated; the splash itself has no actionable controls. Its exit state sets `pointer-events:none`, and removal restores the page without changing hit areas.
- Follow `docs/design/ui-design-language.md`: use the existing 8px card radius and 8px spacing token, declare the motion purpose in a CSS comment, and express every new duration and easing through motion tokens.
- If initialization is delayed or fails, the existing fallback text and reload action win over decorative motion. No blank or permanently blocked state is acceptable.
- No changes to scoring, release detection, form analysis, storage schema, backups, transport, Service Worker, native shells, or physical iPhone acceptance behavior.

---

### Task 1: Add boot splash markup and one-shot release lifecycle

**Files:**

- Modify: `index.html` near the existing `<main id="main">` and `#bootFallback` markup.
- Modify: `scripts/90-init.js` after the existing initial `render()` call.
- Modify: `tools/check-ui.js` static startup contracts.
- Test: `tests/e2e/app-smoke.spec.js` startup lifecycle case.
- Modify: `docs/codex/codex-progress.md` with Task 1 evidence.

**Interfaces:**

- Consumes: existing `render()`, `$()` helper, `#main`, `#bootFallback`, and deferred script order.
- Produces: one transient `#bootSplash` node and a one-shot `releaseBootSplash()` function local to `90-init.js`; no exported API and no persisted state.

- [ ] **Step 1: Write the failing static and browser contracts.**

Add these assertions to `tools/check-ui.js` inside `staticUiChecks()`:

```js
assert(
  html.includes('id="bootSplash"') &&
    html.includes('class="bootSplashMark"') &&
    html.includes('src="icon.svg"'),
  "startup splash must use the existing icon asset",
);
assert(
  appJs.includes("function releaseBootSplash()") &&
    appJs.includes("releaseBootSplash();") &&
    appJs.includes("bootSplash") &&
    appJs.includes("bootReady"),
  "startup splash release hook missing",
);
```

Add a browser case to `tests/e2e/app-smoke.spec.js` that verifies the normal
handoff has no leftover splash and the ready classes are one-shot:

```js
test("startup splash hands off once to the ready record screen", async ({ page }) => {
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, sampleDb);
  await page.goto("/");
  await expect(page.getByTestId("record-start")).toBeVisible();
  await expect(page.locator("#bootSplash")).toHaveCount(0);
  await expect(page.locator("header.app")).not.toHaveClass(/bootReady/);
  await expect(page.locator("#main")).not.toHaveClass(/bootReady/);
  await mainTab(page, "履歴").click();
  await expect(page.locator("#bootSplash")).toHaveCount(0);
});
```

- [ ] **Step 2: Run contracts to capture RED.**

Run:

```powershell
node tools/check-ui.js
npx playwright test tests/e2e/app-smoke.spec.js --project=chromium --grep "startup splash hands off" --workers=1
```

Expected: the static contract fails because `bootSplash` and
`releaseBootSplash()` do not exist, and the focused browser case cannot find
the startup lifecycle.

- [ ] **Step 3: Add the minimal startup markup.**

Insert this immediately before `<main id="main">` in `index.html`; keep the
existing fallback section unchanged:

```html
<div class="bootSplash" id="bootSplash" aria-live="polite">
  <div class="bootSplashMark" aria-hidden="true">
    <img src="icon.svg" alt="" />
  </div>
  <p class="bootSplashLabel">Archery Note</p>
</div>
```

The splash is a decorative handoff; the existing page heading remains the
accessible source of truth once the app is ready.

- [ ] **Step 4: Add the one-shot release hook after initial render.**

In `scripts/90-init.js`, add this helper before the final `render()` call and
invoke it immediately after that call:

```js
let bootSplashReleased = false;
function releaseBootSplash() {
  if (bootSplashReleased) return;
  bootSplashReleased = true;
  const splash = $("#bootSplash");
  const main = $("#main");
  const header = document.querySelector("header.app");
  if (main) main.classList.add("bootReady");
  if (header) header.classList.add("bootReady");
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let splashRemoved = false;
  const removeSplash = () => {
    if (splashRemoved) return;
    splashRemoved = true;
    if (splash?.isConnected) splash.remove();
    if (reduced) {
      main?.classList.remove("bootReady");
      header?.classList.remove("bootReady");
      return;
    }
    window.setTimeout(() => {
      main?.classList.remove("bootReady");
      header?.classList.remove("bootReady");
    }, 320);
  };
  if (!splash) {
    removeSplash();
    return;
  }
  if (reduced) {
    requestAnimationFrame(removeSplash);
    return;
  }
  requestAnimationFrame(() => {
    splash.classList.add("is-exiting");
    const onExitEnd = (event) => {
      if (event.target !== splash || event.animationName !== "bootSplashExit") return;
      splash.removeEventListener("animationend", onExitEnd);
      removeSplash();
    };
    splash.addEventListener("animationend", onExitEnd);
    window.setTimeout(removeSplash, 240);
  });
}

render();
releaseBootSplash();
```

The function is idempotent, adds no storage state, and leaves the existing
`showView()` transition sequence untouched.

- [ ] **Step 5: Run the lifecycle contracts and commit.**

Run:

```powershell
node tools/check-ui.js
npx playwright test tests/e2e/app-smoke.spec.js --project=chromium --grep "startup splash hands off" --workers=1
node --check scripts/90-init.js
git diff --check
```

Commit the lifecycle slice:

```powershell
git add index.html scripts/90-init.js tools/check-ui.js tests/e2e/app-smoke.spec.js docs/codex/codex-progress.md
git diff --cached --check
git commit -m "feat(ui): add startup splash lifecycle"
```

### Task 2: Style splash handoff, reduced motion, and production CSS

**Files:**

- Modify: `style.css` near `.bootFallback`, shared motion variables, and the existing reduced-motion block.
- Modify: `tools/check-ui.js` CSS timing, fallback, reduced-motion, and generated-style contracts.
- Test: `tests/e2e/app-smoke.spec.js` normal/reduced startup and narrow-width no-overflow cases.
- Test: `tests/e2e/form-diagnostics.spec.js` only if the shared reduced-motion startup helper needs a form HUD visibility regression; do not change form behavior.
- Modify: `docs/codex/codex-progress.md` with Task 2 evidence.
- Generated: `style.min.css` via `npm run build:web-assets`.

**Interfaces:**

- Consumes: Task 1 `#bootSplash`, `.bootReady`, `.is-exiting`, existing `--motion-fast/.med/.fluid`, `bootFallback`, and the existing reduced-motion media query.
- Produces: CSS-only startup visuals and synchronized `style.min.css`; no JavaScript behavior beyond Task 1 release/removal.

- [ ] **Step 1: Write the failing CSS and browser contracts.**

Extend `tools/check-ui.js` with exact source and generated-style assertions:

```js
assert(
  css.includes(".bootSplash") &&
    css.includes("@keyframes bootSplashEnter") &&
    css.includes("@keyframes bootSplashExit") &&
    css.includes("@keyframes bootContentEnter") &&
    css.includes("bootSplashFailsafe") &&
    css.includes("--motion-boot-failsafe-delay") &&
    css.includes("motion:状態 — 起動完了をロゴから記録画面へ一度だけ引き継ぐ") &&
    css.includes("prefers-reduced-motion"),
  "startup splash motion and fallback guard missing",
);
assert(
  deployedCss.includes(".bootSplash") &&
    deployedCss.includes("@keyframes bootSplashExit") &&
    deployedCss.includes("bootContentEnter"),
  "deployed stylesheet is missing startup motion",
);
```

Add a delayed-init case that returns from navigation at response commit, holds
`scripts/90-init.js` beyond both existing fallback delays, and verifies that
the reload fallback is reachable before initialization resumes:

```js
test("slow initialization yields to the reload fallback", async ({ page }) => {
  await page.route("**/scripts/90-init.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator("#bootFallback")).toBeVisible({ timeout: 3500 });
  await expect(page.locator(".bootReload")).toBeVisible();
  await expect(page.locator("#bootSplash")).toHaveCSS("pointer-events", "none");
});
```

Add a reduced-motion browser case:

```js
test("reduced motion makes startup content immediate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("record-start")).toBeVisible();
  await expect(page.locator("#bootSplash")).toHaveCount(0);
  await expect(page.locator("header.app")).toHaveCSS("animation-name", "none");
  await expect(page.locator("#main")).toHaveCSS("animation-name", "none");
  expect(
    await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 2: Run RED checks.**

Run:

```powershell
node tools/check-ui.js
npx playwright test tests/e2e/app-smoke.spec.js --project=chromium --grep "slow initialization|reduced motion makes startup" --workers=1
```

Expected: the CSS contract fails because the startup selectors/keyframes do
not exist; the delayed-init case also proves the unstyled splash still blocks
the existing fallback.

- [ ] **Step 3: Add bounded startup CSS.**

Extend the existing root motion-token group with the startup failsafe tokens:

```css
--motion-instant: 0.01s;
--motion-boot-failsafe-delay: 2.6s;
```

Add the following near `.bootFallback` in `style.css`:

```css
/* motion:状態 — 起動完了をロゴから記録画面へ一度だけ引き継ぐ */
.bootSplash {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  gap: var(--space-3);
  align-content: center;
  background: var(--bg);
  color: var(--ink);
  pointer-events: auto;
  opacity: 1;
  visibility: visible;
  animation: bootSplashFailsafe var(--motion-instant) steps(1, end)
    var(--motion-boot-failsafe-delay) forwards;
}
.bootSplashMark {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--card);
  animation: bootSplashEnter var(--motion-med) var(--ease-fluid) both;
}
.bootSplashMark img {
  width: 40px;
  height: 40px;
  display: block;
}
.bootSplashLabel {
  margin: 0;
  color: var(--sub);
  font-size: 12px;
  letter-spacing: 0.1em;
}
.bootSplash.is-exiting {
  animation: bootSplashExit var(--motion-fast) var(--ease-app) both;
  pointer-events: none;
}
@keyframes bootSplashEnter {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes bootSplashExit {
  from {
    opacity: 1;
    transform: scale(1);
    visibility: visible;
  }
  to {
    opacity: 0;
    transform: scale(1.02);
    visibility: hidden;
  }
}
@keyframes bootSplashFailsafe {
  to {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
}
@keyframes bootContentEnter {
  from {
    opacity: 0.88;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
header.app.bootReady,
main.bootReady {
  animation: bootContentEnter var(--motion-med) var(--ease-app) both;
}
```

Keep the existing `.bootFallback` delay and add these selectors to the
existing reduced-motion block so the fallback and content stay reachable:

```css
.bootSplash,
.bootSplash.is-exiting,
.bootSplashMark,
header.app.bootReady,
main.bootReady {
  animation: none !important;
  transform: none !important;
  transition: none !important;
}
.bootSplash {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}
```

The JS one-frame removal path means Reduced Motion never holds the screen for
the decorative 180 ms exit.

- [ ] **Step 4: Regenerate and verify production CSS.**

Run:

```powershell
npm run build:web-assets
node tools/check-ui.js
npx playwright test tests/e2e/app-smoke.spec.js --project=chromium --grep "startup splash|slow initialization|reduced motion makes startup" --workers=1
npm run check:all
npm run lint
npx prettier style.css tools/check-ui.js tests/e2e/app-smoke.spec.js --check
git diff --check
```

Expected: source and `style.min.css` contracts pass, startup focused tests
pass, all project checks pass, and only the known pre-existing design-doc
format warning remains if `npm run format:check` is run.

- [ ] **Step 5: Commit the visual slice and update evidence.**

Append Task 2 evidence to `docs/codex/codex-progress.md`, then commit:

```powershell
git add style.css style.min.css tools/check-ui.js tests/e2e/app-smoke.spec.js docs/codex/codex-progress.md
git diff --cached --check
git commit -m "feat(ui): animate startup handoff"
```

## Final verification checklist

- [ ] `#bootSplash` appears only for the initial launch and is removed after the handoff.
- [ ] `releaseBootSplash()` is idempotent and does not add persisted state.
- [ ] Slow initialization exposes the existing reload fallback with no blocking splash.
- [ ] Normal startup uses the existing icon, bounded scale/opacity motion, and a short header/main entrance.
- [ ] Reduced Motion shows the same content immediately without hiding HUD, controls, or explanatory copy.
- [ ] `style.min.css` contains the same startup selectors/keyframes used by `index.html`.
- [ ] `showView()` render → remove → reflow → add order is unchanged.
- [ ] No scoring, release detection, form analysis, storage, transport, Service Worker, dependency, or native changes are present.
- [ ] Run `npm run check:all`, `npm run lint`, focused Playwright, `git diff --check`, and full `npm run format:check`; report any pre-existing warning separately.
