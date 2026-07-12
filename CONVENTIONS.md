# Archery Note -- Implementation Conventions Guide

> Reference for AI coding agents implementing features.
> Project: Vanilla JS PWA, no framework, no bundler, no transpiler.

---

## 1. File Structure & Load Order

All scripts are loaded via `<script>` tags in `index.html` (lines 47-58).
They execute in numbered order and share one global scope:

| # | File | Role | Key Globals Defined |
|---|------|------|---------------------|
| 00 | `00-compat.js` | Polyfills (`Array.flat`, `Object.values`, etc.) | -- |
| 10 | `10-storage-native.js` | Data layer, persistence, modals, utilities | `db`, `KEY`, `SCHEMA_VER`, `APP_VER`, `$`, `esc`, `toast`, `uid`, `save`, `scheduleSave`, `openModal`, `closeModal`, `appConfirm`, `icon`, `clamp`, `ROUND_TYPES`, `MULTI_ROUND_PRESETS`, `ICONS`, `ENDCOLORS` |
| 20 | `20-scoring.js` | Scoring math (pure functions) | `scoreAt`, `hitFromGlobal`, `zoneStyle`, `scoreLabel`, `clamp`, `median`, `momentStats`, `ringW`, `lineCutRadius`, `isLineCutting` |
| 30 | `30-target-svg.js` | Target SVG drawing | `targetMarkup`, `markCircle` |
| 40 | `40-analysis-physics.js` | Physics engine, calibration, analysis helpers | `num`, `pct`, `levelFromScore`, `LEVELS`, `sessionMetrics`, `latestMark`, `personalPhysicsCalibration`, `calibrationProfile`, `modelReadinessProfile`, `exportSessionsCsv`, `backupReminderHtml`, `trashSettingsHtml` |
| 45 | `45-analysis-core.js` | Analysis pure functions (no DOM/db access) | `buildAnalysisRows`, `filterAnalysisRows`, `isoWeekKey`, `aggregateByPeriod` |
| 46 | `46-form-core.js` | Form analysis core (pose detection) | form analysis functions |
| 47 | `47-form-view.js` | Form analysis view | form view rendering |
| 50 | `50-record-view.js` | Record view, active session, history, analysis, sight views | `view`, `ui`, `render`, `showView`, `renderRecord`, `renderActive`, `refreshActive`, `renderHistory`, `renderAnalysis`, `renderSight`, `renderGear` is in 70 |
| 60 | `60-history-sight-view.js` | History detail sheets, sight table | `driftText`, sight/history rendering helpers |
| 70 | `70-gear-settings.js` | Gear management, settings panel | `renderGear`, `openSettings`, `applyTheme`, `GEAR_FIELDS`, `GEAR_SECTIONS`, `CATALOG_SHAFTS`, `openGearForm`, `openGearDetail`, `openSetupWizard` |
| 90 | `90-init.js` | Startup: SW registration, event wiring, first `render()` | `updateAvailable`, `freshReload`, `beginActiveWorkflow`, `endActiveWorkflow` |

### Dependency Rules

- Every file assumes all earlier-numbered files have already executed.
- `db` (line 13 of `10-storage-native.js`) is the single global mutable state object.
- `$` is a querySelector shorthand: `const $ = s => document.querySelector(s);`
- Helper functions like `esc()`, `toast()`, `uid()`, `icon()`, `clamp()`, `num()`, `pct()` are available globally from the data layer.
- **Never import modules** -- this is a plain `<script>` concatenation architecture.

---

## 2. Naming Conventions

### JavaScript

- **Functions**: `camelCase`. Examples: `renderRecord`, `openModal`, `sessionMetrics`, `heroMetricHtml`.
- **Constants**: `UPPER_SNAKE_CASE`. Examples: `SCHEMA_VER`, `APP_VER`, `TRASH_LIMIT`, `ROUND_TYPES`, `GEAR_FIELDS`, `ENDCOLORS`, `SAVE_DEBOUNCE_MS`.
- **Local variables**: `camelCase`. Single-letter allowed in tight scopes (`s` for session, `a` for arrow, `m` for main element, `r` for row, `d` for data, `f` for filter).
- **Private/internal**: prefix with `_` for file-internal state. Example: `_lastSnapTs`.
- **Boolean flags**: no prefix convention -- use descriptive names. Examples: `updateAvailable`, `settled`.

### DOM IDs

- Short, camelCase or flat-lowercase. Examples: `#main`, `#tabs`, `#toast`, `#tgsvg`, `#tgmarks`, `#tgcur`, `#nudge`, `#curChips`, `#endsTbl`, `#statbar`.
- Settings/form fields use prefixes: `fDist`, `fFace`, `fSetup`, `fStart` (record form), `gf_bow`, `gf_limbs` (gear form), `wName`, `wBow` (wizard), `cr*` (custom round).

### data-testid Attributes

- Used for Playwright e2e locators. Format: `kebab-case`. Examples: `record-start`, `active-target`, `active-end`, `active-finish`, `active-undo`, `gear-ledger-item`, `settings-export`.
- Add `data-testid` to major interactive elements and landmark containers.

### CSS Classes

- Flat `camelCase` or `lowerCamelCase`. No BEM methodology.
- Component-scoped by name prefix. Examples: `recordNudgeHint`, `recordDistCustomWrap`, `activeActionDock`, `gearLedgerItem`, `gearActiveDot`, `settingsGroup`, `confirmSheet`, `heroMetric`, `setupLens`, `lensCard`.
- State classes: `on`, `sel`, `show`, `fine`, `cut`, `miss`, `fresh`, `is-hidden`.
- Utility: `tnum` (tabular-nums), `right`, `empty`, `adv` (advanced/details).

### Animation Keyframe Names

- `camelCase`, descriptive of the motion. Examples: `appRise`, `scorePop`, `markPop`, `impactFlash`, `overlayFade`, `sheetUp`, `confirmIn`, `viewEnter`, `itemReveal`, `nudgeReveal`, `barFill`, `chipPop`, `tabPop`, `recPulse`, `hudTick`.

---

## 3. Core Code Patterns

### 3.1 State Management: The `db` Global

All persistent state lives in a single global object `db`, initialized at load:

```js
let db = load();  // 10-storage-native.js:13
```

The `db` structure (from `blankDb()`):

```js
{
  schema: SCHEMA_VER,
  setups: [],        // equipment configurations
  sightMarks: [],    // sight mark records
  sessions: [],      // completed practice sessions
  trash: [],         // soft-deleted items
  formAnalyses: [],  // form (shooting form) analysis records
  customRounds: [],  // user-defined multi-distance rounds
  settings: {
    eyeSight: 850,
    theme: "auto",
    lastBackupAt: null,
    activeGuideSeen: false
  },
  active: null       // in-progress session (or null)
}
```

**Rules:**
- Mutate `db` directly (no immutability pattern).
- After mutation, call `save()` (immediate sync write) or `scheduleSave()` (debounced).
- Use `save()` for important operations (import, delete, session end, snapshot).
- Use `scheduleSave("reason")` for high-frequency operations (arrow nudge, shot metadata, target tap).
- `DB_REV++` happens automatically inside both `save()` and `scheduleSave()`.

### 3.2 Persistence: save() vs scheduleSave()

```js
// Immediate synchronous write -- for important operations
save();
save({reason: "delete-setup", forceSnapshot: true});

// Debounced write (600ms idle, 3s max wait) -- for rapid input
scheduleSave("nudge");
scheduleSave("shot-meta");
```

The `forceSnapshot: true` option also creates a safety snapshot.

Lifecycle flush: `flushPendingSave()` is called on `pagehide`, `visibilitychange(hidden)`, and `beforeunload` (in `90-init.js`).

### 3.3 View Rendering: render() / renderXxx()

The app has 5 tabs, selected by the global `view` string:

```js
let view = "record";  // "record" | "history" | "analysis" | "sight" | "gear"
```

The main `render()` function (50-record-view.js:29) dispatches to per-view renderers:

```js
function render() {
  // update chrome, tabs
  const m = $("#main");
  if (view === "record") renderRecord(m);
  else if (view === "history") renderHistory(m);
  else if (view === "analysis") renderAnalysis(m);
  else if (view === "sight") renderSight(m);
  else renderGear(m);
}
```

Each `renderXxx(m)` function:
1. Receives the `#main` element as `m`.
2. Sets `m.innerHTML` to the full view HTML (complete replacement).
3. Binds event handlers to newly created elements via `$('#id').onclick = ...`.
4. Never returns anything.

**Tab switching:**
```js
function showView(v) {
  view = v;
  ui.selArrow = -1;
  nativePulse("light");
  render();
  // add transition class
}
```

### 3.4 Active Session: renderActive() + refreshActive()

When `db.active` is non-null, `renderRecord()` calls `renderActive()` instead of showing the launch form.

- `renderActive(m)` rebuilds the full recording UI.
- `refreshActive()` is a lightweight update that only redraws the target markers, score chips, stats, end table, and HUD -- without rebuilding the whole DOM.
- Always call `refreshActive()` after modifying `db.active.cur` (current end arrows) or `db.active.ends`.

### 3.5 Transient UI State: The `ui` Object

```js
let ui = {
  selArrow: -1,           // selected arrow index in current end (-1 = none)
  sightSel: { setupId: null, dist: 70 },
  histOpen: null,          // currently open history detail
  histFilter: { setupId: "", dist: "", round: "" },
  analysisFilter: { setupId: "", dist: "", round: "", period: "all" },
  zoom: 1,                // target zoom level
  recordMode: "practice",  // "practice" | "calibration"
  freshArrow: -1,          // index of just-placed arrow (for animation)
  freshTimer: 0,           // timeout handle for fresh arrow animation
};
```

`ui` is NOT persisted. It resets implicitly when the page reloads. It is mutated directly.

### 3.6 Modals & Sheets

All modals follow this pattern:

```js
const ovl = document.createElement("div");
ovl.className = "ovl";
ovl.innerHTML = `<div class="sheet">
  <h3>Title</h3>
  <!-- content -->
  <div class="btnrow">
    <button class="btn ghost" id="myClose">Cancel</button>
    <button class="btn" id="mySave">Save</button>
  </div>
</div>`;
openModal(ovl, { escapeTarget: "#myClose" });
ovl.querySelector("#myClose").onclick = () => closeModal(ovl);
ovl.querySelector("#mySave").onclick = () => { /* save logic */ closeModal(ovl); render(); };
```

**Key points:**
- `openModal(ovl, opts)` appends to `document.body`, sets `role="dialog"`, `aria-modal="true"`, adds focus trap, handles Escape key.
- `closeModal(ovl)` removes from DOM, restores previous focus.
- `opts.escapeTarget` is a CSS selector for the button Escape should "click".
- Modals can stack (confirmation on top of settings). The topmost modal handles keyboard events.
- After closing a modal that changes data, call `render()` to refresh the view.

### 3.7 Confirmation Dialogs: appConfirm()

```js
if (await appConfirm("Delete this?", { danger: true, okLabel: "Delete" })) {
  // user confirmed
}
```

Returns `Promise<boolean>`. Options: `{ title, okLabel, cancelLabel, danger }`.
Uses the same `openModal`/`closeModal` infrastructure.

### 3.8 Event Binding

Events are always bound imperatively after innerHTML assignment:

```js
m.innerHTML = `...`;
// Then bind:
$("#btnId").onclick = () => { ... };
// For lists:
document.querySelectorAll(".listItem").forEach(li => li.onclick = () => { ... });
```

**Never** use inline `onclick="..."` attributes in HTML strings.

### 3.9 Chip/Toggle Pattern

Selection chips (distance, theme, zoom) follow this pattern:

```js
// HTML template:
`<div class="chips" id="myChips">
  ${options.map(([v, lb]) =>
    `<button type="button" class="chip ${v === current ? "on" : ""}"
     aria-pressed="${v === current}" data-v="${v}">${lb}</button>`
  ).join("")}
</div>`

// Binding:
document.querySelectorAll("#myChips .chip").forEach(c => c.onclick = () => {
  document.querySelectorAll("#myChips .chip").forEach(x => {
    const on = x === c;
    x.classList.toggle("on", on);
    x.setAttribute("aria-pressed", String(on));
  });
  // handle selection: c.dataset.v
});
```

Always use `aria-pressed` on chips. Always toggle the `on` class.

---

## 4. DOM Manipulation Patterns

### 4.1 innerHTML (Primary Pattern)

The codebase uses `innerHTML` almost exclusively for rendering. Template literals with `esc()` for escaping:

```js
m.innerHTML = `<div class="card">
  <h2>${esc(title)} <span class="mini">${count}件</span></h2>
  <div id="myList">${items.map(item =>
    `<button type="button" class="listItem" data-id="${esc(item.id)}">
      <div class="t">${esc(item.name)}</div>
      <div class="d">${esc(item.detail)}</div>
    </button>`
  ).join("")}</div>
</div>`;
```

### 4.2 createElement (Modals Only)

Only modals use `document.createElement`:
```js
const ovl = document.createElement("div");
ovl.className = "ovl";
ovl.innerHTML = `<div class="sheet">...</div>`;
```

### 4.3 SVG Generation

SVGs are generated as HTML strings (not via createElementNS):
```js
`<svg class="main" id="${idPrefix}svg" viewBox="${-M} ${-M} ${2*M} ${2*M}" xmlns="http://www.w3.org/2000/svg">
  <g id="${idPrefix}main">
    <g>${rings}</g>
    <g id="${idPrefix}marks"></g>
    <g id="${idPrefix}cur"></g>
  </g>
</svg>`
```

Arrow marks are updated via `innerHTML` on the marks group:
```js
$("#tgmarks").innerHTML = markCircles.join("");
```

### 4.4 List Building Pattern

Lists of interactive items use `<button>` elements with `class="listItem"`:

```js
items.map(item => `<button type="button" class="listItem" data-id="${esc(item.id)}">
  <div><div class="t">${esc(item.name)}</div><div class="d">${esc(item.desc)}</div></div>
  <div class="gearChevron">${icon("chevron")}</div>
</button>`).join("")
```

Empty states:
```js
items.length ? items.map(...).join("") : `<div class="empty">No items yet.</div>`
```

### 4.5 HTML Helper Functions

Many views define `xxxHtml()` functions that return HTML strings:

```js
function heroMetricHtml(k, b, span) {
  return `<div class="heroMetric"><div class="k">${esc(k)}</div><b>${esc(b)}</b><span>${esc(span || "")}</span></div>`;
}

function gearPrecisionHtml(s) {
  const p = gearPrecisionProfile(s);
  return `<div class="advice gearAdviceCard">...</div>`;
}
```

Convention: functions that return HTML end with `Html` in their name.

---

## 5. Settings & Preferences

### 5.1 Reading Settings

```js
const theme = db.settings.theme || "auto";    // always provide fallback
const eye = db.settings.eyeSight || 850;
const formEnabled = db.settings.formTrackingEnabled;  // boolean
```

### 5.2 Writing Settings

```js
db.settings.theme = "dark";
save();
applyTheme();
```

### 5.3 Theme Application

```js
function applyTheme() {
  const t = db.settings.theme || "auto";
  document.documentElement.className = t;  // sets "auto", "light", or "dark" on <html>
}
```

CSS uses `html.dark` and `html.auto` (with `@media (prefers-color-scheme: dark)`) selectors to apply dark theme variables.

### 5.4 The save/scheduleSave Decision

| Operation | Use | Example |
|-----------|-----|---------|
| User changes a setting | `save()` | Theme change, eye-sight distance |
| Import/export/delete | `save({reason, forceSnapshot:true})` | Data import, setup deletion |
| High-frequency input | `scheduleSave("reason")` | Arrow nudge, shot metadata keystroke |
| Session end/finish | `save()` | Finishing a practice session |

---

## 6. Error Handling & User Feedback

### 6.1 Toast Notifications

```js
toast("Message");              // default 1700ms
toast("Longer message", 6000); // custom duration
```

The toast appears fixed at the bottom of the screen with a fade-in animation.

### 6.2 Console Errors

Storage write failures log to `console.error` and show a toast:
```js
console.error(e);
toast("Storage full message", 6000);
```

### 6.3 appConfirm for Destructive Actions

Always use `appConfirm()` before destructive operations (delete, overwrite, restore):

```js
if (await appConfirm("Delete this record?", {
  danger: true,
  okLabel: "Delete"
})) {
  // proceed with deletion
}
```

### 6.4 Input Validation

Validate in the save handler, show toast on failure, return early:

```js
const name = ovl.querySelector("#myInput").value.trim();
if (!name) { toast("Please enter a name"); return; }
```

### 6.5 No throw/try-catch Pattern for UI

UI code does not use try-catch for flow control. Try-catch is used only for storage operations and native bridge calls. Errors in UI logic are left to propagate (caught by the e2e error collector).

---

## 7. Testing Conventions

### 7.1 E2E Tests (Playwright)

Location: `tests/e2e/*.spec.js`

Pattern:
```js
"use strict";
const { expect, test } = require("@playwright/test");

const sampleDb = { /* seed data matching the db schema */ };

test("description", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);

  // Seed localStorage before navigation
  await page.addInitScript((database) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(database));
  }, sampleDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();

  // Interact and assert...
  await expect(unexpectedErrors).toEqual([]);  // always check at end
});
```

**Key conventions:**
- Seed via `addInitScript` + `localStorage.setItem("archeryNote.v1", ...)`.
- Always collect and assert no unexpected console errors.
- Use `data-testid` for stable locators: `page.getByTestId("record-start")`.
- Use `page.locator("#tabs").getByRole("button", { name })` for tab buttons.
- Viewport is mobile-sized (390x844) per `playwright.config.js`.
- Tests run against a local static server (`tools/e2e-server.js`).

### 7.2 Static Check Scripts

Location: `tools/check-*.js`
Run via: `npm run check:all` (or individual `check:xxx`)

These are Node.js scripts using `assert/strict`. They:
- Parse source files as text or AST (espree + eslint-scope for `check-globals.js`)
- Load functions via `new Function(...)` to test in isolation
- Load JSON fixture files from `tests/fixtures/`
- Verify contracts (normalizeDb roundtrips, save/scheduleSave debounce behavior, etc.)
- Exit with non-zero code on failure

**Pattern for check scripts:**
```js
"use strict";
const assertStrict = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
// Load source, extract functions, test...
```

### 7.3 ESLint

Config: `eslint.config.mjs`. `no-undef` and `no-unused-vars` are OFF for `scripts/**` (because globals span files). Run: `npm run lint`.

---

## 8. CSS Conventions

### 8.1 Design System: "Field Instrument v2"

The visual language is "precision instrument" themed (archery scoring card aesthetic).

- **Light theme**: ink on parchment (`:root` defaults). `--bg:#faf9f6`, `--ink:#1b1b18`.
- **Dark theme**: `html.dark` and `html.auto` at `(prefers-color-scheme: dark)`. `--bg:#101110`, `--ink:#e7eae5`.

### 8.2 CSS Custom Properties (Design Tokens)

All colors, spacing, typography, and motion values are defined as CSS custom properties on `:root`:

**Colors:**
- `--bg`, `--card`, `--ink`, `--sub`, `--line`, `--line2`, `--soft`, `--inpBg` (surface hierarchy)
- `--accent`, `--accent-strong` (gold thread -- lines/dots only, never background fills)
- `--green`, `--red`, `--blue`, `--gold` (semantic/target zone colors)
- `--danger`, `--status-ok`, `--status-warn`, `--status-hold` (status indicators)
- `--invert-bg`, `--invert-fg` (inverted CTA surfaces)

**Spacing:** `--space-1` (4px) through `--space-10` (32px)

**Typography:**
- Sizes: `--font-size-xs` (11px) through `--font-size-xl` (20px)
- Weights: `--fw-body` (400), `--fw-label` (500), `--fw-emphasis` (600), `--fw-figure` (700)

**Motion:**
- Durations: `--motion-fast` (.16s), `--motion-med` (.34s), `--motion-fluid` (.42s)
- Easings: `--ease-app` (cubic-bezier(.2,.8,.2,1)), `--ease-fluid` (cubic-bezier(.22,1,.36,1))

**Layout:**
- `--radius-card` (8px), `--radius-panel` (8px), `--radius-control` (6px)
- `--tap-target-min` (44px), `--tap-target-comfortable` (48px)
- `--content-max-width` (760px)

### 8.3 Cards

Cards use border-top line, no shadow (scorecard paper aesthetic):
```css
.card {
  background: var(--card);
  border-top: 2px solid var(--line);
  border-radius: 0;
  padding: 15px;
  box-shadow: none;
}
```

### 8.4 Responsive Design

- No media query breakpoints for width. The app targets mobile (max-width: 560px on `main`).
- `env(safe-area-inset-*)` is used for notch/bottom bar safety.
- `content-visibility: auto` for off-screen cards.

### 8.5 Animation Pattern

Animations use CSS `@keyframes` with the design token easings. Each animation has a comment explaining its purpose using a taxonomy:

- `motion:因果` -- Causal: result of a user action (sheet slides up, overlay fades in)
- `motion:状態` -- State: value changed (HUD tick, score pop)
- `motion:注意` -- Attention: warning before irreversible action (confirm dialog emphasis)

Example usage:
```css
.sheet { animation: sheetUp .32s var(--ease-fluid); }
.sc.fresh { animation: scorePop .32s var(--ease-app); }
```

To trigger re-animation (classList remove + void offsetWidth + classList add):
```js
el.classList.remove("tick");
void el.offsetWidth;
el.classList.add("tick");
```

---

## 9. Anti-patterns to Avoid

### MUST NOT

1. **Do NOT use any JS framework or library** (React, Vue, Lit, jQuery, etc.). This is vanilla JS by design.
2. **Do NOT add npm dependencies for client code.** `dependencies` in `package.json` are Capacitor native plugins only. `devDependencies` are build/test tools only.
3. **Do NOT use ES modules** (`import`/`export`) in `scripts/*.js`. All files use `"use strict"` at top and share the global scope via `<script>` tag concatenation.
4. **Do NOT use TypeScript.** All client code is plain `.js`.
5. **Do NOT use a bundler** (webpack, vite, esbuild). Files are served directly.
6. **Do NOT use `document.getElementById`** -- use `$('#id')` instead.
7. **Do NOT use inline event handlers** (`onclick="..."` in HTML attributes). Bind via JS after innerHTML assignment.
8. **Do NOT create new global variables carelessly.** Every top-level `let`/`const`/`function` in `scripts/*.js` becomes a global. The `check-globals.js` tool validates cross-file references.
9. **Do NOT use `window.confirm()` or `window.alert()`.** Use `appConfirm()` and `toast()` respectively.
10. **Do NOT mutate `db` without calling `save()` or `scheduleSave()`** afterward.
11. **Do NOT skip `esc()` for user-supplied text in HTML templates.** Only pre-built HTML (icon SVGs, etc.) can bypass escaping.
12. **Do NOT add shadow/elevation to cards.** The design language uses border-top lines, not shadows (shadows are reserved for floating/raised elements like toasts, modals).

### SHOULD NOT

1. **Avoid `createElement` for view rendering.** Use `innerHTML` with template literals. `createElement` is only for modal overlay containers.
2. **Avoid deep nesting of CSS selectors.** Keep selectors flat (1-2 levels).
3. **Avoid hardcoded colors.** Use CSS custom properties (`var(--ink)`, `var(--accent)`, etc.).
4. **Avoid hardcoded spacing values.** Use `--space-N` tokens or the existing value patterns.
5. **Avoid adding new animation keyframes without the motion taxonomy comment** (`motion:因果`, `motion:状態`, `motion:注意`).
6. **Avoid using `localStorage` directly.** Use `storageGetItem`/`storageSetItem` which abstract the native bridge.

### SHOULD

1. **Always start new script files with `"use strict";`**.
2. **Always add `data-testid` to key interactive elements and containers** for e2e testability.
3. **Always use `aria-pressed` on toggle/chip buttons** and keep it in sync with visual state.
4. **Always use `esc()` when interpolating user text into HTML.**
5. **Always handle empty states** (`<div class="empty">...</div>`).
6. **Always use `nativePulse("light"|"heavy"|"success")` on significant user interactions** (tab switch, arrow placement, delete).
7. **Name new files with the `NN-description.js` convention** where NN indicates load order position.
8. **Wrap destructive actions in `appConfirm()`** with `danger: true`.
9. **When adding a new view section, use the `heroMetricHtml()` pattern** for KPI displays.
10. **When adding new icons, add to the `ICONS` object** in `10-storage-native.js` following the 24px/stroke-1.5/butt-cap convention.

---

## 10. Quick Reference: Common Utilities

```js
// DOM
const el = $("#selector");          // querySelector shorthand
const safe = esc(userText);         // HTML-escape
toast("Message");                   // notification
toast("Message", 5000);             // with custom duration

// Data
const id = uid();                   // generate unique ID (timestamp+random)
const dateStr = today();            // "YYYY-MM-DD"
save();                             // immediate persist
scheduleSave("reason");             // debounced persist
const copy = cloneData(obj);        // deep clone via JSON

// Icons
icon("del")                         // inline SVG string
icon("trash")                       // see ICONS object for full list

// Scoring
const hit = hitFromGlobal(x, y, faceD, faceType);  // {s, X, x, y}
const label = scoreLabel(arrow);                     // "10", "X", "M"
const style = zoneStyle(score, isX, faceType);       // {bg, fg}

// Helpers
const n = num("42.5");             // parseFloat or null
const s = pct(0.85);              // "85%"
const v = clamp(x, 0, 100);      // min/max bound
const fmt = fmtD("2026-07-08");  // "2026/7/8"

// Modals
openModal(ovl, { escapeTarget: "#closeBtn" });
closeModal(ovl);
const yes = await appConfirm("Sure?", { danger: true, okLabel: "Yes" });

// Native
nativePulse("light");             // haptic feedback
beginActiveWorkflow();            // block update bar
endActiveWorkflow();              // unblock update bar
```

---

## 11. Checklist for New Features

1. Decide file placement based on load order dependencies.
2. Write rendering function(s) returning HTML strings (`xxxHtml()`).
3. Wire into the appropriate `renderXxx()` function or create a new modal.
4. Bind events imperatively after innerHTML assignment.
5. Persist changes via `save()` or `scheduleSave()`.
6. Handle empty states and validation with `toast()`.
7. Add `data-testid` attributes to key elements.
8. Use CSS custom properties for all colors, spacing, and motion.
9. Add dark theme support if introducing new colors.
10. Test: run `npm run lint`, `npm run check:all`, `npm run test:e2e`.
