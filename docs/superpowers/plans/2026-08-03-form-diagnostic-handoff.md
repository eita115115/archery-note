# Form Diagnostic Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make live and replay form-count receipts exact-ID safe, persist complete fire-time evidence only when diagnostics are explicitly enabled, and provide a bounded local-only 3 x 6 field-diagnostics export without exposing practice data.

**Architecture:** Keep detector decisions in the existing DOM-free form core and add a view-owned receipt tracker beside those pure utilities. Live capture and replay each instantiate one tracker for the lifetime of the workflow, allocate a deterministic receipt ID before shot summarization, and resolve cancellation only through that ID. Additive diagnostic record fields remain under schema 5. Pure matrix validation and allowlist projection live in the form core; transactional workflow integration remains in the form view; the existing storage/native layer gets a separate no-fallback diagnostics transport; the settings surface owns the default-off matrix coordinator.

**Tech Stack:** Vanilla JavaScript, MediaPipe Pose Landmarker, schema-5 localStorage, Capacitor Filesystem/Share, Node assertion harnesses, Playwright at mobile widths, Python golden-replay validation.

## Global Constraints

- Follow red-green-refactor. Add the named failing assertion before each production edit and record the observed RED and GREEN in docs/codex/codex-progress.md.
- Do not change stepFormPhase detector thresholds, phase rules, refractory timing, confirmation timing, or count heuristics in this plan.
- Do not add a runtime script. Keep runtime changes in scripts/46-form-core.js, scripts/47-form-view.js, scripts/10-storage-native.js, and scripts/70-gear-settings.js so index.html and sw.js remain unchanged.
- Do not add a dependency or modify package-lock.json, SCHEMA_VER, KEY, SNAP_KEY, APP_VER, version.json, sw.js, CHANGELOG.md, release tags, deployment, or Android/Capacitor project files.
- Fix the coordinator key as db.settings.formDiagnosticMatrixBatch. Do not add formDebug or this coordinator to blankDb(); diagnostic-off saved JSON must not grow.
- Treat diagnostics as enabled only when db.settings.formDebug === true. Truthy strings and other non-booleans remain off, hidden, inert, unpersisted, and ineligible.
- Keep identity behavior active whether diagnostics are on or off. Persist receipt archives, fire snapshots, record markers, invariant counters, and feature receipt IDs only when diagnostics are exactly true.
- Preserve diagnostics-off record shape and non-identity behavior. Existing `shot.id` remains present but now receives the preallocated `form-receipt-N` identity required for exact cancellation; no receipt archive, fire snapshot, marker, invariant counter, or feature receipt ID is persisted while diagnostics are off. The workflow-local tracker still resolves an active receipt as `workflow-save` before an ordinary save, and that resolution is not persisted while diagnostics are off.
- Fix the tracker action shape as { id, deletionTarget, fatal, code }, where code is null or one of supersededActive, missingActive, identityMismatch, invalidTransition, sequenceExhausted.
- Fix tracker.snapshot() as { releaseReceipts, receiptOverflow, receiptInvariantCounts, desynchronized }; every returned record and nested fire object is copied.
- The 32-entry cap is diagnostic retention only. Receipt 33 and later still get active-slot IDs and exact cancellation. After a terminal receipt overflows out of the archive, a clicked shot is still removed by the view's exact clicked ID; tracker.manualRemove() audits only a retained/active receipt and must never block the exact-ID UI deletion. Overflow already makes export ineligible.
- Never use shots[shots.length - 1], pop(), array position, timestamp matching, uid(), or another fallback to infer detector ownership.
- Cancellation wins over implicit confirmation. A released frame begins a new pending receipt and cannot be confirmed in that same frame.
- Geometry reset, workflow save/close, and replay EOS resolve only an active receipt as unresolved and do not delete its visible shot. EOS keep/delete policy remains out of scope.
- Construct export objects from literal allowlisted fields. Never spread a database, record, receipt, feature, settings object, or unknown future key into the artifact.
- Do not introduce persistence of video, audio, images, pixels, raw/full landmarks, paths, URLs, or device metadata. Existing bounded local diagnostic frame traces may remain backward compatible, but the diagnostics-only export must exclude them plus dates, practice IDs, notes, equipment, scores, settings, active state, and trash.
- Preserve the existing full-backup serializer, backup handler, lastBackupAt, safety snapshots, import path, and generic shareOrDownloadText behavior.
- All committed JSON fixtures and E2E seeds must be synthetic and must state that they contain no real user, practice, device, path, or media data.
- The current branch contains sensitive history through `4a0ff1ec` and must never be pushed. The user separately authorized one planning-checkpoint WIP snapshot after this plan is reviewed: reconstruct one commit on current `origin/main`, use the exact sanitized current tree, prove that `4a0ff1ec` is not an ancestor, and push only `codex/form-diagnostic-handoff-plan-wip`. That branch is planning evidence only and must not be treated as implemented, accepted, released, deployed, or promoted to the later release candidate.
- After every task, update docs/codex/codex-progress.md with changed files, RED/GREEN evidence, risks, and the next task.
- Before every commit, run git status --short, stage only that task's named files, run git diff --check --cached, and use the exact commit command listed by the task.
- scripts/10-storage-native.js, scripts/46-form-core.js, and scripts/47-form-view.js have pre-existing whole-file Prettier drift. Do not bulk-format them. Use ESLint, git diff --check, and focused changed-hunk inspection; run Prettier only on files named as managed in each task.

---

### Task 1: Add the pure release-receipt tracker

**Files:**

- Modify: scripts/46-form-core.js:945 (insert immediately before makeFormPhaseDetector)
- Modify: tools/check-form-core.js:41-55 (Node loader return surface)
- Modify: tools/check-form-core.js:250-261 (insert before the phase-detector test section)
- Modify: docs/codex/codex-progress.md:2012-end

**Interfaces:**

- Consumes: `makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: number })`; `begin({ fireTs: number, fire: object | null })`; exact receipt IDs; the four fixed cancellation reasons; and the five fixed unresolved reasons.
- Produces: `begin`, `markShotCreated`, `manualRemove`, `confirm`, `cancel`, and `abandon` actions with exactly `{ id, deletionTarget, fatal, code }`; `current(): Receipt | null`; and `snapshot(): { releaseReceipts, receiptOverflow, receiptInvariantCounts, desynchronized }`.
- Produces fixed `code` values `null | "supersededActive" | "missingActive" | "identityMismatch" | "invalidTransition" | "sequenceExhausted"`. Every counter saturates at `255`; only a new tracker clears `desynchronized`.

```js
const tracker = makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
const begun = tracker.begin({ fireTs: 1000, fire: null });
tracker.markShotCreated(begun.id);
tracker.manualRemove(begun.id);
const canceled = tracker.cancel("anchor-return");
const state = tracker.snapshot();
```

- [ ] **Step 1: Add a conditional test export and JSON assertion helper**

  Add `assertJsonEqual` beside `assertEqual`, then replace the existing `const core = new Function(...)` loader with this complete block. The conditional export keeps the unchanged production source loadable for the first RED:

  ```js
  function assertJsonEqual(actual, expected, label) {
    assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
  }

  const core = new Function(
    `${coreScript}
  return {FORM_LM, FORM_REF, FORM_PH, FORM_PHASES, formGaussScore, formAngleDeg, formDist, formLineDist,
    formMedian, adaptiveAnchorThreshold, adaptiveReleaseThreshold,
    adaptiveReleaseCandidate:
      typeof adaptiveReleaseCandidate === "function" ? adaptiveReleaseCandidate : null,
    updateAdaptiveAnchorEvidence:
      typeof updateAdaptiveAnchorEvidence === "function" ? updateAdaptiveAnchorEvidence : null,
    makeFormReleaseReceiptTracker:
      typeof makeFormReleaseReceiptTracker === "function"
        ? makeFormReleaseReceiptTracker
        : null,
    computeFormMetrics, makeFormEma, makeFormPhaseDetector, legacyReleaseContinuity,
    stepFormPhase, computeFormVelocity,
    FORM_VEL_FILTER, makeFormVelocitySource,
    formPreReleaseWindow, formAnchorVariation, summarizeFormShot,
    formRecordStats, formRecordInsights, formTrendSeries, formScoreLink,
    ARROW_PRESENCE, arrowPresence, ARROW_CHECK, judgeArrowCheck};`,
  )();
  ```

- [ ] **Step 2: Prove the pre-test loader edit is neutral**

  Run: `node tools/check-form-core.js`

  Expected: exit `0`, ending in `Form core checks OK`.

- [ ] **Step 3: Add the factory, exact-key, and workflow-local sequence RED**

  ```js
  assert(
    typeof core.makeFormReleaseReceiptTracker === "function",
    "release receipt tracker factory is exported",
  );
  const first = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
  const second = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
  const firstAction = first.begin({ fireTs: 10, fire: null });
  assertJsonEqual(
    Object.keys(firstAction),
    ["id", "deletionTarget", "fatal", "code"],
    "action has exact keys",
  );
  assertEqual(firstAction.id, "form-receipt-1", "first tracker ID");
  assertEqual(second.begin({ fireTs: 20, fire: null }).id, "form-receipt-1", "workflow-local ID");
  ```

- [ ] **Step 4: Run the initial RED**

  Run: `node tools/check-form-core.js`

  Expected: exit `1` with `release receipt tracker factory is exported`.

- [ ] **Step 5: Add the smallest deterministic factory**

  Insert immediately before `makeFormPhaseDetector` in `scripts/46-form-core.js`:

  ```js
  const FORM_RELEASE_RECEIPT_SEQUENCE_MAX = 999999;

  function makeFormReleaseReceiptTracker() {
    let receiptSequence = 0;
    return {
      begin() {
        const id = `form-receipt-${++receiptSequence}`;
        return { id, deletionTarget: null, fatal: false, code: null };
      },
    };
  }
  ```

- [ ] **Step 6: Verify the factory GREEN before expanding behavior**

  Run: `node tools/check-form-core.js`

  Expected: exit `0`, ending in `Form core checks OK`.

- [ ] **Step 7: Add normal lifecycle and exact failure-sequence tests**

  Insert this complete block immediately before `/* ---------- フェーズ検出` in `tools/check-form-core.js`:

  ```js
  /* ---------- release-receipt tracker ---------- */

  {
    const tracker = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    const begun = tracker.begin({ fireTs: 10, fire: null });
    assertJsonEqual(
      tracker.markShotCreated(begun.id),
      { id: begun.id, deletionTarget: null, fatal: false, code: null },
      "mark-created action",
    );
    assertJsonEqual(
      tracker.confirm(),
      { id: begun.id, deletionTarget: null, fatal: false, code: null },
      "confirm action",
    );
    assertEqual(
      tracker.snapshot().releaseReceipts[0].detectorDisposition,
      "confirmed",
      "confirmed receipt is archived",
    );
    assertJsonEqual(
      tracker.manualRemove(begun.id),
      { id: begun.id, deletionTarget: null, fatal: false, code: null },
      "confirmed archived receipt can be manually removed",
    );
    assertEqual(
      tracker.snapshot().releaseReceipts[0].userDisposition,
      "manual-removed",
      "post-confirm archive removal is retained",
    );
  }

  {
    const tracker = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    const failedSummary = tracker.begin({ fireTs: 20, fire: null });
    const canceled = tracker.cancel("no-depart");
    assertEqual(
      canceled.deletionTarget,
      failedSummary.id,
      "summary-failed cancellation returns only its own exact ID",
    );
    const receipt = tracker.snapshot().releaseReceipts[0];
    assertEqual(receipt.shotCreated, false, "failed summary keeps a tombstone");
    assertEqual(receipt.userDisposition, "not-created", "failed summary is not-created");
    assertEqual(receipt.detectorDisposition, "auto-canceled", "failed summary still resolves");
  }

  {
    const tracker = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    const a = tracker.begin({ fireTs: 100, fire: null });
    tracker.markShotCreated(a.id);
    tracker.confirm();
    const b = tracker.begin({ fireTs: 200, fire: null });
    tracker.markShotCreated(b.id);
    tracker.manualRemove(b.id);
    const canceled = tracker.cancel("anchor-return");
    assertJsonEqual(
      canceled,
      { id: b.id, deletionTarget: b.id, fatal: false, code: null },
      "cancel action targets only B",
    );
    const receipts = tracker.snapshot().releaseReceipts;
    assertEqual(receipts[0].userDisposition, "present", "A remains present");
    assertEqual(receipts[0].detectorDisposition, "confirmed", "A remains confirmed");
    assertEqual(receipts[1].userDisposition, "manual-removed", "B keeps manual outcome");
    assertEqual(receipts[1].detectorDisposition, "auto-canceled", "B keeps detector outcome");
  }
  ```

- [ ] **Step 8: Observe the lifecycle RED**

  Run: `node tools/check-form-core.js`

  Expected: exit `1` at the first missing lifecycle method or at `cancel action targets only B`.

- [ ] **Step 9: Implement the full two-axis tracker state machine**

  Replace the minimal `makeFormReleaseReceiptTracker` from Step 5 with this complete pre-ceiling implementation. It deliberately leaves sequence-ceiling fail-closed behavior for the next RED/GREEN cycle:

  ```js
  const FORM_RELEASE_RECEIPT_SEQUENCE_MAX = 999999;
  const FORM_RELEASE_CANCEL_REASONS = new Set([
    "anchor-return",
    "nb2-drift",
    "nb2-unobserved",
    "no-depart",
  ]);
  const FORM_RELEASE_UNRESOLVED_REASONS = new Set([
    "geometry-reset",
    "workflow-save",
    "workflow-close",
    "replay-eos",
    "superseded-fire",
  ]);

  function makeFormReleaseReceiptTracker(options) {
    const requestedCap = options && options.maxDiagnosticReceipts;
    const maxDiagnosticReceipts =
      Number.isSafeInteger(requestedCap) && requestedCap >= 0 ? requestedCap : 32;
    let receiptSequence = 0;
    let activeReceipt = null;
    let receiptOverflow = 0;
    let desynchronized = false;
    const releaseReceipts = [];
    const receiptInvariantCounts = {
      supersededActive: 0,
      missingActive: 0,
      identityMismatch: 0,
      invalidTransition: 0,
      sequenceExhausted: 0,
    };

    const makeAction = (id, deletionTarget, fatal, code) => ({
      id,
      deletionTarget,
      fatal,
      code,
    });
    const copyFire = (fire) => (fire == null ? null : { ...fire });
    const copyReceipt = (receipt) => ({ ...receipt, fire: copyFire(receipt.fire) });
    const increment = (code) => {
      receiptInvariantCounts[code] = Math.min(255, receiptInvariantCounts[code] + 1);
    };
    const failure = (code) => {
      increment(code);
      return makeAction(null, null, false, code);
    };
    const archive = (receipt) => {
      if (releaseReceipts.length < maxDiagnosticReceipts) {
        releaseReceipts.push(copyReceipt(receipt));
      } else {
        receiptOverflow = Math.min(Number.MAX_SAFE_INTEGER, receiptOverflow + 1);
      }
    };
    const finalizeActive = (detectorDisposition, cancelReason, unresolvedReason) => {
      const receipt = activeReceipt;
      receipt.detectorDisposition = detectorDisposition;
      receipt.cancelReason = cancelReason;
      receipt.unresolvedReason = unresolvedReason;
      activeReceipt = null;
      archive(receipt);
      return receipt;
    };

    function begin(input) {
      if (
        !input ||
        !Number.isFinite(input.fireTs) ||
        !(input.fire == null || (typeof input.fire === "object" && !Array.isArray(input.fire)))
      ) {
        return failure("invalidTransition");
      }
      let code = null;
      if (activeReceipt) {
        finalizeActive("unresolved", null, "superseded-fire");
        increment("supersededActive");
        code = "supersededActive";
      }
      receiptSequence += 1;
      const id = `form-receipt-${receiptSequence}`;
      activeReceipt = {
        id,
        fireTs: input.fireTs,
        shotCreated: false,
        userDisposition: "not-created",
        detectorDisposition: "pending",
        cancelReason: null,
        unresolvedReason: null,
        fire: copyFire(input.fire),
      };
      return makeAction(id, null, false, code);
    }

    function markShotCreated(id) {
      if (!activeReceipt || activeReceipt.id !== id) return failure("identityMismatch");
      if (activeReceipt.shotCreated || activeReceipt.detectorDisposition !== "pending") {
        return failure("invalidTransition");
      }
      activeReceipt.shotCreated = true;
      activeReceipt.userDisposition = "present";
      return makeAction(id, null, false, null);
    }

    function manualRemove(id) {
      const receipt =
        (activeReceipt && activeReceipt.id === id ? activeReceipt : null) ||
        releaseReceipts.find((candidate) => candidate.id === id);
      if (!receipt) return failure("identityMismatch");
      if (!receipt.shotCreated || receipt.userDisposition !== "present") {
        return failure("invalidTransition");
      }
      receipt.userDisposition = "manual-removed";
      return makeAction(id, null, false, null);
    }

    function confirm() {
      if (!activeReceipt) return failure("missingActive");
      const receipt = finalizeActive("confirmed", null, null);
      return makeAction(receipt.id, null, false, null);
    }

    function cancel(reason) {
      if (!activeReceipt) return failure("missingActive");
      if (!FORM_RELEASE_CANCEL_REASONS.has(reason)) return failure("invalidTransition");
      const receipt = finalizeActive("auto-canceled", reason, null);
      return makeAction(receipt.id, receipt.id, false, null);
    }

    function abandon(reason) {
      if (!activeReceipt) return failure("missingActive");
      if (!FORM_RELEASE_UNRESOLVED_REASONS.has(reason)) {
        return failure("invalidTransition");
      }
      const receipt = finalizeActive("unresolved", null, reason);
      return makeAction(receipt.id, null, false, null);
    }

    function current() {
      return activeReceipt ? copyReceipt(activeReceipt) : null;
    }

    function snapshot() {
      return {
        releaseReceipts: releaseReceipts.map(copyReceipt),
        receiptOverflow,
        receiptInvariantCounts: { ...receiptInvariantCounts },
        desynchronized,
      };
    }

    return { begin, markShotCreated, manualRemove, confirm, cancel, abandon, current, snapshot };
  }
  ```

- [ ] **Step 10: Add supersession, copy isolation, and defensive-path tests**

  Append this complete test block after Step 7’s tests:

  ```js
  {
    const fire = { fireEvidence: "adaptive", sentinel: 1 };
    const tracker = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    const first = tracker.begin({ fireTs: 1, fire });
    fire.sentinel = 999;
    tracker.markShotCreated(first.id);
    const currentCopy = tracker.current();
    currentCopy.fire.sentinel = 888;
    assertEqual(tracker.current().fire.sentinel, 1, "current returns a detached fire copy");

    const second = tracker.begin({ fireTs: 2, fire: null });
    assertEqual(second.code, "supersededActive", "second begin reports supersession");
    assertEqual(
      tracker.snapshot().releaseReceipts[0].unresolvedReason,
      "superseded-fire",
      "superseded receipt is unresolved",
    );
    tracker.markShotCreated(second.id);
    assertEqual(
      tracker.cancel("anchor-return").deletionTarget,
      second.id,
      "new receipt alone owns later cancellation",
    );

    const snapshotCopy = tracker.snapshot();
    snapshotCopy.releaseReceipts[0].fire.sentinel = 777;
    snapshotCopy.receiptInvariantCounts.supersededActive = 0;
    const fresh = tracker.snapshot();
    assertEqual(fresh.releaseReceipts[0].fire.sentinel, 1, "snapshot fire is detached");
    assertEqual(fresh.receiptInvariantCounts.supersededActive, 1, "snapshot counters are detached");
  }

  {
    const tracker = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    assertEqual(tracker.confirm().code, "missingActive", "orphan confirm is classified");
    const begun = tracker.begin({ fireTs: 1, fire: null });
    assertEqual(
      tracker.markShotCreated("form-receipt-999").code,
      "identityMismatch",
      "wrong ID is classified",
    );
    assertEqual(
      tracker.cancel("not-a-reason").code,
      "invalidTransition",
      "bad cancel reason is classified",
    );
    tracker.markShotCreated(begun.id);
    tracker.confirm();
    assertEqual(tracker.confirm().code, "missingActive", "double terminal call is classified");
    for (let i = 0; i < 300; i += 1) tracker.confirm();
    const counts = tracker.snapshot().receiptInvariantCounts;
    assertEqual(counts.missingActive, 255, "missingActive saturates at 255");
    assertEqual(counts.identityMismatch, 1, "identityMismatch increments alone");
    assertEqual(counts.invalidTransition, 1, "invalidTransition increments alone");
  }
  ```

- [ ] **Step 11: Add receipt 33 and 34 overflow tests**

  ```js
  const tracker = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
  for (let i = 1; i <= 32; i += 1) {
    const receipt = tracker.begin({ fireTs: i, fire: null });
    tracker.markShotCreated(receipt.id);
    tracker.confirm();
  }
  const r33 = tracker.begin({ fireTs: 33, fire: null });
  tracker.markShotCreated(r33.id);
  assertEqual(tracker.cancel("anchor-return").deletionTarget, r33.id, "receipt 33 cancels exactly");
  const r34 = tracker.begin({ fireTs: 34, fire: null });
  tracker.markShotCreated(r34.id);
  tracker.confirm();
  const snapshot = tracker.snapshot();
  assertEqual(snapshot.releaseReceipts.length, 32, "archive remains bounded");
  assertEqual(snapshot.receiptOverflow, 2, "each overflowed terminal receipt counts once");
  assertJsonEqual(
    Object.keys(snapshot),
    ["releaseReceipts", "receiptOverflow", "receiptInvariantCounts", "desynchronized"],
    "snapshot has exact keys",
  );
  assertJsonEqual(
    Object.keys(snapshot.receiptInvariantCounts),
    [
      "supersededActive",
      "missingActive",
      "identityMismatch",
      "invalidTransition",
      "sequenceExhausted",
    ],
    "snapshot counters have exact keys",
  );
  assertJsonEqual(
    Object.keys(snapshot.releaseReceipts[0]),
    [
      "id",
      "fireTs",
      "shotCreated",
      "userDisposition",
      "detectorDisposition",
      "cancelReason",
      "unresolvedReason",
      "fire",
    ],
    "snapshot receipt has exact keys",
  );
  ```

- [ ] **Step 12: Add source-injected sequence failure tests**

  Add this exact one-replacement source injector beside the core loader:

  ```js
  function replaceSourceExactlyOnce(source, marker, replacement, label) {
    assertEqual(source.split(marker).length - 1, 1, `${label} marker count`);
    return source.replace(marker, replacement);
  }

  function loadReceiptTrackerCore(options = {}) {
    let source = coreScript;
    if (options.sequenceMax != null) {
      source = replaceSourceExactlyOnce(
        source,
        "const FORM_RELEASE_RECEIPT_SEQUENCE_MAX = 999999;",
        `const FORM_RELEASE_RECEIPT_SEQUENCE_MAX = ${options.sequenceMax};`,
        "receipt sequence ceiling",
      );
    }
    if (options.inconsistentSequence === true) {
      source = replaceSourceExactlyOnce(
        source,
        "let receiptSequence = 0;",
        "let receiptSequence = 0.5;",
        "receipt sequence initial value",
      );
    }
    return new Function(
      `${source}
  return {
    makeFormReleaseReceiptTracker:
      typeof makeFormReleaseReceiptTracker === "function"
        ? makeFormReleaseReceiptTracker
        : null
  };`,
    )();
  }
  ```

  Append these concrete RED tests:

  ```js
  {
    const injected = loadReceiptTrackerCore({ sequenceMax: 2 });
    const tracker = injected.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    tracker.begin({ fireTs: 1, fire: null });
    tracker.confirm();
    tracker.begin({ fireTs: 2, fire: null });
    tracker.confirm();
    assertJsonEqual(
      tracker.begin({ fireTs: 3, fire: null }),
      { id: null, deletionTarget: null, fatal: true, code: "sequenceExhausted" },
      "ceiling without active receipt",
    );
    assertEqual(tracker.current(), null, "ceiling without active clears current");
    assertEqual(tracker.snapshot().desynchronized, true, "ceiling latches desynchronization");
  }

  {
    const injected = loadReceiptTrackerCore({ sequenceMax: 2 });
    const tracker = injected.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    const first = tracker.begin({ fireTs: 1, fire: null });
    tracker.markShotCreated(first.id);
    tracker.confirm();
    const second = tracker.begin({ fireTs: 2, fire: null });
    tracker.markShotCreated(second.id);
    assertJsonEqual(
      tracker.begin({ fireTs: 3, fire: null }),
      { id: null, deletionTarget: null, fatal: true, code: "sequenceExhausted" },
      "ceiling with active receipt",
    );
    const state = tracker.snapshot();
    assertEqual(
      state.releaseReceipts[1].unresolvedReason,
      "superseded-fire",
      "active receipt is finalized before latching",
    );
    assertEqual(
      state.receiptInvariantCounts.supersededActive,
      0,
      "fatal allocation is not supersession",
    );
    assertEqual(state.receiptInvariantCounts.sequenceExhausted, 1, "ceiling increments once");
    assertJsonEqual(
      tracker.cancel("anchor-return"),
      { id: null, deletionTarget: null, fatal: true, code: null },
      "latched cancel is deletion-free",
    );
  }

  {
    const injected = loadReceiptTrackerCore({ inconsistentSequence: true });
    const tracker = injected.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    assertJsonEqual(
      tracker.begin({ fireTs: 1, fire: null }),
      { id: null, deletionTarget: null, fatal: true, code: "invalidTransition" },
      "inconsistent sequence fails closed",
    );
    const healthy = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    assertEqual(
      healthy.begin({ fireTs: 1, fire: null }).id,
      "form-receipt-1",
      "new tracker is healthy",
    );
  }
  ```

  Run: `node tools/check-form-core.js`

  Expected: exit `1` at `ceiling without active receipt` because the pre-ceiling implementation allocates `form-receipt-3`.

- [ ] **Step 13: Implement fail-closed allocation before supersession**

  Inside `makeFormReleaseReceiptTracker`, insert these helpers immediately after `finalizeActive`:

  ```js
  const latchedAction = () => makeAction(null, null, true, null);
  const sequenceFailureCode = () => {
    if (
      !Number.isSafeInteger(receiptSequence) ||
      receiptSequence < 0 ||
      receiptSequence > FORM_RELEASE_RECEIPT_SEQUENCE_MAX
    ) {
      return "invalidTransition";
    }
    return receiptSequence === FORM_RELEASE_RECEIPT_SEQUENCE_MAX ? "sequenceExhausted" : null;
  };
  const latchDesynchronized = (code) => {
    if (activeReceipt) finalizeActive("unresolved", null, "superseded-fire");
    increment(code);
    desynchronized = true;
    activeReceipt = null;
    return makeAction(null, null, true, code);
  };
  ```

  Replace the complete `begin` function with:

  ```js
  function begin(input) {
    if (desynchronized) return latchedAction();
    if (
      !input ||
      !Number.isFinite(input.fireTs) ||
      !(input.fire == null || (typeof input.fire === "object" && !Array.isArray(input.fire)))
    ) {
      return failure("invalidTransition");
    }
    const allocationFailure = sequenceFailureCode();
    if (allocationFailure) return latchDesynchronized(allocationFailure);

    let code = null;
    if (activeReceipt) {
      finalizeActive("unresolved", null, "superseded-fire");
      increment("supersededActive");
      code = "supersededActive";
    }
    receiptSequence += 1;
    const id = `form-receipt-${receiptSequence}`;
    activeReceipt = {
      id,
      fireTs: input.fireTs,
      shotCreated: false,
      userDisposition: "not-created",
      detectorDisposition: "pending",
      cancelReason: null,
      unresolvedReason: null,
      fire: copyFire(input.fire),
    };
    return makeAction(id, null, false, code);
  }
  ```

  Add this first line to `confirm`, `cancel`, and `abandon`:

  ```js
  if (desynchronized) return latchedAction();
  ```

- [ ] **Step 14: Run focused GREEN validation**

  Run:

  ```powershell
  node tools/check-form-core.js
  npm run check:form
  npm run lint -- --quiet
  ```

  Expected: every command exits `0`; the focused suite ends in `Form core checks OK`.

- [ ] **Step 15: Format managed files and update the progress ledger**

  Append this exact entry to `docs/codex/codex-progress.md`:

  ```markdown
  ## 2026-08-03 — Form diagnostic handoff Task 1

  - Changed: added the pure release-receipt tracker with deterministic workflow-local IDs, independent user/detector outcomes, bounded diagnostic retention, and fixed saturated invariant counters.
  - RED: `node tools/check-form-core.js` first failed at `release receipt tracker factory is exported`; the injected ceiling test then failed by allocating `form-receipt-3`.
  - GREEN: `node tools/check-form-core.js`, `npm run check:form`, and `npm run lint -- --quiet` passed.
  - Risk: overflow intentionally makes a diagnostic run ineligible but does not block receipt 33+ identity, manual clicked-ID deletion, or exact cancellation.
  - Next: Task 2 wires exact receipt ownership into live capture and replay.
  ```

  Then run:

  ```powershell
  npx prettier --check tools/check-form-core.js docs/codex/codex-progress.md
  git diff --check
  ```

  Expected: both commands exit `0`. Inspect only the changed core hunk for local compact style; do not reformat the whole core file.

- [ ] **Step 16: Commit Task 1 only**

  Run:

  ```powershell
  git status --short
  git add scripts/46-form-core.js tools/check-form-core.js docs/codex/codex-progress.md
  git diff --check --cached
  git commit -m "feat(form): add release receipt tracker"
  ```

  Expected: the cached whitespace check is silent and the commit succeeds with the exact subject above.

---

### Task 2: Wire exact-ID lifecycle into live capture and replay

**Files:**

- Modify: scripts/47-form-view.js:267-544 (live workflow state, onShot, manual removal, reset, frame resolution)
- Modify: scripts/47-form-view.js:322-391 (live stop/fatal freeze helpers)
- Modify: scripts/47-form-view.js:708-904 (replay state, frame resolution, EOS, reset, stop)
- Modify: tools/check-form-core.js:3580-3910 (capture/replay bounded source contracts)
- Modify: docs/codex/codex-progress.md:end

**Interfaces:**

- Consumes: tracker actions, one pre-step hadPendingRelease boolean, one stepFormPhase result, clicked shot IDs, fixed lifecycle reasons.
- Produces: exact shot.id values, exact cancellation targets, harmless missing-shot cancellation, workflow-local fatal freeze, and live/replay lifecycle parity.

```js
const hadPendingRelease = detector.pendingRelease != null;
const result = stepFormPhase(detector, raw, history, 1.0, now);
if (result.canceled) {
  applyReceiptCancellation(tracker.cancel(result.debug && result.debug.cancelReason));
} else if (result.released) {
  const action = tracker.begin({ fireTs: now, fire: null });
  if (action.fatal) freezeForReceiptFailure();
  else onShot(action.id, now, result.anchorStartTs, result.anchorEnter, result.debug);
} else if (hadPendingRelease && detector.pendingRelease == null) {
  tracker.confirm();
}
```

- [ ] **Step 1: Add only the array-tail ownership RED for both workflows**

  Immediately after the existing bounded `capture` and `replay` source extraction in `tools/check-form-core.js`, add this test without changing any existing positive-order assertion:

  ```js
  [capture, replay].forEach((source, index) => {
    const label = index === 0 ? "capture" : "replay";
    assert(
      !/shots\s*\[\s*shots\.length\s*-\s*1\s*\]/.test(source),
      `${label} cancellation never owns array tail`,
    );
    assert(!/\.pop\s*\(/.test(source), `${label} cancellation never pops a shot`);
  });
  ```

- [ ] **Step 2: Run the positional RED before editing order contracts or production**

  Run: `node tools/check-form-core.js`

  Expected: exit `1` with `capture cancellation never owns array tail`.

- [ ] **Step 3: Replace brittle positive tests with ordered source anchors**

  After recording Step 2’s RED, replace the existing `summary`/`onRelease` exact-string loop in `tools/check-form-core.js` with this complete ordered contract:

  ```js
  [
    {
      label: "capture",
      source: capture,
      onShotSignature: "functiononShot(receiptId,now,anchorStartTs,activeAnchorEnter,debug){",
      onShotCall: "constshotId=onShot(action.id,now,anchorStartTs,result.anchorEnter,debug);",
    },
    {
      label: "replay",
      source: replay,
      onShotSignature: "functiononShot(receiptId,now,anchorStartTs,activeAnchorEnter,debug){",
      onShotCall:
        "constshotId=onShot(action.id,now,result.anchorStartTs,result.anchorEnter,debug);",
    },
  ].forEach(({ label, source, onShotSignature, onShotCall }) => {
    const compact = compactSource(source);
    const velocityAt = compact.indexOf("constvel=velSrc.step(history,raw,now);");
    const pushAt = compact.indexOf("history.push({ts:now,m:raw,vel});", velocityAt);
    const capAt = compact.indexOf("if(history.length>200)history.shift();", pushAt);
    const pendingAt = compact.indexOf(
      "consthadPendingRelease=detector.pendingRelease!=null;",
      capAt,
    );
    const stepAt = compact.indexOf(
      "constresult=stepFormPhase(detector,raw,history,1.0,now);",
      pendingAt,
    );
    const cancelAt = compact.indexOf("if(result.canceled){", stepAt);
    const releaseAt = compact.indexOf("elseif(result.released){", cancelAt);
    const confirmAt = compact.indexOf(
      "elseif(hadPendingRelease&&detector.pendingRelease==null){",
      releaseAt,
    );
    const signatureAt = compact.indexOf(onShotSignature);
    const callAt = compact.indexOf(onShotCall, releaseAt);
    assert(
      velocityAt >= 0 &&
        pushAt > velocityAt &&
        capAt > pushAt &&
        pendingAt > capAt &&
        stepAt > pendingAt &&
        cancelAt > stepAt &&
        releaseAt > cancelAt &&
        confirmAt > releaseAt &&
        signatureAt >= 0 &&
        callAt > releaseAt,
      `${label} keeps velocity -> push -> cap -> pending snapshot -> one step -> cancel/release/confirm -> synchronous onShot`,
    );
    assertEqual(
      (compact.slice(pendingAt, confirmAt).match(/stepFormPhase\(/g) || []).length,
      1,
      `${label} resolves exactly one detector step`,
    );
  });
  ```

- [ ] **Step 4: Instantiate one tracker for each workflow lifetime**

  Add one tracker beside each live/replay detector:

  ```js
  const receiptTracker = makeFormReleaseReceiptTracker({
    maxDiagnosticReceipts: 32,
  });
  ```

  Do not assign a new tracker from camera, handedness, crop, geometry, or replay-reset handlers.

- [ ] **Step 5: Preallocate receipt identity before summarization**

  Replace the complete live `onShot` function with:

  ```js
  function onShot(receiptId, now, anchorStartTs, activeAnchorEnter, debug) {
    const shot = summarizeFormShot(history, anchorStartTs, now, activeAnchorEnter);
    if (!shot) return null;
    shot.id = receiptId;
    shot.arrowCheck = null;
    shot.diag = db.settings.formDebug === true && debug ? debug : null;
    shots.push(shot);
    receiptTracker.markShotCreated(receiptId);
    const div = document.createElement("div");
    div.className = "listItem recordReadOnlyItem";
    div.dataset.shotId = shot.id;
    div.innerHTML = `<div><div class="t">第${shots.length}射</div>
      <div class="d" data-shot-desc>保持 ${(shot.holdMs / 1000).toFixed(1)}秒${shot.pre && (shot.pre.bowDrift || shot.pre.drawDrift) ? ` / ${icon("warn")} リリース前ドリフト` : ""}</div></div>
      <div class="big">${shot.angles.bowArm != null ? shot.angles.bowArm.toFixed(0) + "°" : "—"}<small> / 引き手${shot.angles.drawArm != null ? shot.angles.drawArm.toFixed(0) + "°" : "—"}</small></div>
      <button class="btn sm ghost" data-rm-shot="${esc(shot.id)}" aria-label="この射を取り消す">${icon("del")}</button>`;
    div.querySelector("[data-rm-shot]").onclick = () => {
      receiptTracker.manualRemove(shot.id);
      shots = shots.filter((candidate) => candidate.id !== shot.id);
      if (pendingCheck && pendingCheck.shotId === shot.id) pendingCheck = null;
      div.remove();
      renumberShots();
      refreshShotsHint();
      nativePulse("light");
    };
    ovl.querySelector("#fcShots").prepend(div);
    refreshShotsHint();
    nativePulse("light");
    return shot.id;
  }
  ```

  Replace the complete replay `onShot` function with:

  ```js
  function onShot(receiptId, now, anchorStartTs, activeAnchorEnter, debug) {
    const shot = summarizeFormShot(history, anchorStartTs, now, activeAnchorEnter);
    if (!shot) return null;
    shot.id = receiptId;
    shot.arrowCheck = null;
    shot.diag = db.settings.formDebug === true && debug ? debug : null;
    shots.push(shot);
    receiptTracker.markShotCreated(receiptId);
    const div = document.createElement("div");
    div.className = "listItem recordReadOnlyItem";
    div.dataset.shotId = shot.id;
    div.innerHTML = `<div><div class="t">第${shots.length}射</div>
      <div class="d">保持 ${(shot.holdMs / 1000).toFixed(1)}秒${shot.pre && (shot.pre.bowDrift || shot.pre.drawDrift) ? ` / ${icon("warn")} リリース前ドリフト` : ""}</div></div>
      <div class="big">${shot.angles.bowArm != null ? shot.angles.bowArm.toFixed(0) + "°" : "—"}<small> / 引き手${shot.angles.drawArm != null ? shot.angles.drawArm.toFixed(0) + "°" : "—"}</small></div>`;
    ovl.querySelector("#frShots").prepend(div);
    refreshSave();
    nativePulse("light");
    return shot.id;
  }
  ```

- [ ] **Step 6: Keep live manual deletion clicked-ID-owned**

  The complete live handler is already included in Step 5. Keep these three statements in this exact order so an overflowed archived receipt cannot block the UI-owned deletion:

  ```js
  receiptTracker.manualRemove(shot.id);
  shots = shots.filter((candidate) => candidate.id !== shot.id);
  if (pendingCheck && pendingCheck.shotId === shot.id) pendingCheck = null;
  ```

- [ ] **Step 7: Add exact manual-removal and pending-arrow source assertions**

  Add this exact source test after extracting `capture`:

  ```js
  const liveRemove = boundedSourceSection(
    capture,
    'div.querySelector("[data-rm-shot]").onclick=()=>{',
    'ovl.querySelector("#fcShots").prepend(div);',
    "live shot removal handler",
  );
  const liveRemoveCompact = compactSource(liveRemove);
  assert(
    liveRemoveCompact.includes("receiptTracker.manualRemove(shot.id);") &&
      liveRemoveCompact.includes("shots=shots.filter(candidate=>candidate.id!==shot.id);") &&
      liveRemoveCompact.includes(
        "if(pendingCheck&&pendingCheck.shotId===shot.id)pendingCheck=null;",
      ),
    "live manual removal audits and deletes only the clicked shot ID",
  );
  assert(
    !liveRemoveCompact.includes("receiptTracker=") &&
      !liveRemoveCompact.includes("detector.pendingRelease=") &&
      !liveRemoveCompact.includes("shots["),
    "live manual removal never clears or retargets detector ownership",
  );
  ```

- [ ] **Step 8: Replace cancellation with exact action application**

  Add this complete helper inside live capture after `renumberShots`:

  ```js
  function applyReceiptCancellation(action) {
    const target = action && action.deletionTarget;
    if (!target) return;
    shots = shots.filter((shot) => shot.id !== target);
    const div = ovl.querySelector(`#fcShots [data-shot-id="${target}"]`);
    if (div) div.remove();
    if (pendingCheck && pendingCheck.shotId === target) pendingCheck = null;
    renumberShots();
    refreshShotsHint();
  }
  ```

  Add this complete replay-local helper after replay `renumberShots`:

  ```js
  function applyReceiptCancellation(action) {
    const target = action && action.deletionTarget;
    if (!target) return;
    shots = shots.filter((shot) => shot.id !== target);
    const div = ovl.querySelector(`#frShots [data-shot-id="${target}"]`);
    if (div) div.remove();
    renumberShots();
    refreshSave();
  }
  ```

- [ ] **Step 9: Enforce cancellation-before-release-before-confirm frame order**

  In the live loop, replace the existing `stepFormPhase` call, destructuring, cancellation block, and later `if(released)` block with these two complete blocks. Keep the existing debug-frame collection and arrow-presence sampling between them:

  ```js
  const hadPendingRelease = detector.pendingRelease != null;
  const result = stepFormPhase(detector, raw, history, 1.0, now);
  const { phase, released, canceled, debug, anchorStartTs } = result;
  let releaseAction = null;
  let releasedShotId = null;
  let releasedPreScores = null;
  if (result.canceled) {
    const action = receiptTracker.cancel(debug && debug.cancelReason);
    if (db.settings.formDebug === true) {
      formDiagPush(
        formPhaseDiag.canceledEvents,
        {
          ts: now,
          reason: (debug && debug.cancelReason) || null,
          anchorNorm: debug ? debug.anchorNorm : null,
          tsAgo: now - lastReleaseNow,
          shotId: action.id,
        },
        200,
      );
    }
    applyReceiptCancellation(action);
  } else if (result.released) {
    releaseAction = receiptTracker.begin({ fireTs: now, fire: null });
    if (releaseAction.fatal) {
      freezeForReceiptFailure();
    } else {
      lastReleaseNow = now;
      releasedPreScores = presenceRing.map((point) => point.score);
      const action = releaseAction;
      const shotId = onShot(action.id, now, anchorStartTs, result.anchorEnter, debug);
      releasedShotId = shotId;
    }
  } else if (hadPendingRelease && detector.pendingRelease == null) {
    receiptTracker.confirm();
  }
  ```

  ```js
  if (releaseAction && !releaseAction.fatal) {
    if (db.settings.formDebug === true) {
      formDiagPush(
        formPhaseDiag.releaseFires,
        {
          ts: now,
          shotId: releaseAction.id,
          framesBefore: recentFrames.slice(0, -1).slice(-20),
        },
        32,
      );
    }
    if (releasedShotId) {
      pendingCheck = {
        shotId: releasedShotId,
        preScores: releasedPreScores,
        confirmScores: [],
        startTs: now,
      };
    }
  }
  ```

  In the replay loop, use this complete resolution block and delete its old cancellation/release blocks:

  ```js
  const hadPendingRelease = detector.pendingRelease != null;
  const result = stepFormPhase(detector, raw, history, 1.0, now);
  const { phase, released, canceled, debug } = result;
  if (result.canceled) {
    const action = receiptTracker.cancel(debug && debug.cancelReason);
    if (db.settings.formDebug === true) {
      formDiagPush(
        formPhaseDiag.canceledEvents,
        {
          ts: now,
          reason: (debug && debug.cancelReason) || null,
          anchorNorm: debug ? debug.anchorNorm : null,
          tsAgo: now - lastReleaseNow,
          shotId: action.id,
        },
        200,
      );
    }
    applyReceiptCancellation(action);
  } else if (result.released) {
    const action = receiptTracker.begin({ fireTs: now, fire: null });
    if (action.fatal) {
      freezeForReceiptFailure();
    } else {
      lastReleaseNow = now;
      const shotId = onShot(action.id, now, result.anchorStartTs, result.anchorEnter, debug);
      if (db.settings.formDebug === true) {
        formDiagPush(
          formPhaseDiag.releaseFires,
          {
            ts: now,
            shotId: action.id,
            framesBefore: recentFrames.slice(0, -1).slice(-20),
          },
          32,
        );
      }
    }
  } else if (hadPendingRelease && detector.pendingRelease == null) {
    receiptTracker.confirm();
  }
  ```

- [ ] **Step 10: Add branch-priority tests**

  Add this deterministic test-only resolver before the bounded view tests, then exercise both priority cases:

  ```js
  function resolveReceiptFrameForTest(
    tracker,
    hadPendingRelease,
    pendingAfterStep,
    result,
    onShot,
  ) {
    if (result.canceled) {
      return { branch: "cancel", action: tracker.cancel(result.debug.cancelReason) };
    }
    if (result.released) {
      const action = tracker.begin({ fireTs: result.fireTs, fire: null });
      if (!action.fatal) onShot(action.id);
      return { branch: "release", action };
    }
    if (hadPendingRelease && pendingAfterStep == null) {
      return { branch: "confirm", action: tracker.confirm() };
    }
    return { branch: "none", action: null };
  }

  {
    const tracker = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    const begun = tracker.begin({ fireTs: 1, fire: null });
    tracker.markShotCreated(begun.id);
    let onShotCalls = 0;
    const resolved = resolveReceiptFrameForTest(
      tracker,
      true,
      null,
      {
        canceled: true,
        released: false,
        debug: { cancelReason: "anchor-return" },
      },
      () => {
        onShotCalls += 1;
      },
    );
    assertEqual(resolved.branch, "cancel", "cancellation wins over implicit confirmation");
    assertEqual(resolved.action.deletionTarget, begun.id, "cancel keeps exact ownership");
    assertEqual(onShotCalls, 0, "cancel never summarizes a shot");
  }

  {
    const tracker = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    const order = [];
    const originalBegin = tracker.begin;
    tracker.begin = (input) => {
      order.push("begin");
      return originalBegin(input);
    };
    const resolved = resolveReceiptFrameForTest(
      tracker,
      true,
      null,
      { canceled: false, released: true, fireTs: 10, debug: {} },
      (id) => {
        order.push(`onShot:${id}`);
      },
    );
    assertEqual(resolved.branch, "release", "release starts a new receipt");
    assertJsonEqual(order, ["begin", "onShot:form-receipt-1"], "begin precedes onShot");
    assertEqual(
      tracker.current().detectorDisposition,
      "pending",
      "release is not confirmed same-frame",
    );
  }
  ```

- [ ] **Step 11: Resolve reset, close, and EOS with active-only abandon calls**

  Add this helper independently inside each workflow:

  ```js
  function abandonActiveReceipt(reason) {
    if (receiptTracker.current()) receiptTracker.abandon(reason);
  }
  ```

  Make live `resetCaptureGeometry` and both `stop` functions begin as follows:

  ```js
  function resetCaptureGeometry() {
    abandonActiveReceipt("geometry-reset");
    if (pendingCheck) finalizeArrowCheck();
    detector = makeFormPhaseDetector();
    ema = makeFormEma(0.38);
    history = [];
    velSrc.reset();
    presenceRing = [];
    pendingCheck = null;
    recentFrames = [];
    lastAnchoringSampleAt = 0;
  }
  ```

  ```js
  function stop() {
    abandonActiveReceipt("workflow-close");
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (pendingCheck) finalizeArrowCheck();
    stopRec();
    const pendingStream = inFlightStream,
      activeStream = stream;
    inFlightStream = null;
    stream = null;
    video.srcObject = null;
    try {
      if (pendingStream) pendingStream.getTracks().forEach((t) => t.stop());
      if (activeStream && activeStream !== pendingStream)
        activeStream.getTracks().forEach((t) => t.stop());
    } catch (e) {}
    if (db.active) wakeLock.acquire();
    else wakeLock.release();
    endActiveWorkflow();
    closeModal(ovl);
  }
  ```

  ```js
  function stop() {
    abandonActiveReceipt("workflow-close");
    running = false;
    if (raf) cancelAnimationFrame(raf);
    try {
      video.pause();
    } catch (e) {}
    URL.revokeObjectURL(videoUrl);
    endActiveWorkflow();
    closeModal(ovl);
  }
  ```

  Replace replay’s EOS block and handedness reset with:

  ```js
  if (video.ended && running) {
    abandonActiveReceipt("replay-eos");
    phaseEl.textContent = "完了";
    hud.innerHTML = `解析完了 ・ ${shots.length}射を検出しました`;
    running = false;
    return;
  }
  ```

  ```js
  abandonActiveReceipt("geometry-reset");
  detector = makeFormPhaseDetector();
  ema = makeFormEma(0.38);
  history = [];
  velSrc.reset();
  ```

- [ ] **Step 12: Implement the fatal workflow-local freeze**

  Add `let receiptFailure=false;` beside each workflow’s `running` state. Add this complete live helper after `stopRec`:

  ```js
  function freezeForReceiptFailure() {
    if (receiptFailure) return;
    receiptFailure = true;
    running = false;
    cameraSwapReady = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    stopRec();
    const pendingStream = inFlightStream,
      activeStream = stream;
    inFlightStream = null;
    stream = null;
    video.srcObject = null;
    try {
      if (pendingStream) pendingStream.getTracks().forEach((track) => track.stop());
      if (activeStream && activeStream !== pendingStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    } catch (e) {}
    ["#fcSwap", "#fcHand", "#fcCrop", "#fcRec"].forEach((selector) => {
      const control = ovl.querySelector(selector);
      if (control) control.disabled = true;
    });
    hud.textContent =
      "射の識別状態を継続できません。結果を保存するか、この画面を閉じて解析をやり直してください。";
  }
  ```

  Add this complete replay helper after replay `stop`:

  ```js
  function freezeForReceiptFailure() {
    if (receiptFailure) return;
    receiptFailure = true;
    running = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    try {
      video.pause();
    } catch (e) {}
    const hand = ovl.querySelector("#frHand");
    if (hand) hand.disabled = true;
    hud.textContent =
      "射の識別状態を継続できません。結果を保存するか、この画面を閉じて解析をやり直してください。";
  }
  ```

  Add this branch first in both close handlers so a fatal zero-shot workflow cannot close silently:

  ```js
  if (receiptFailure) {
    if (
      await appConfirm(
        "射形解析を再開するには、この画面を閉じてやり直してください。保存していない結果を破棄して閉じますか？",
        { danger: true, okLabel: "閉じる" },
      )
    )
      stop();
    return;
  }
  ```

- [ ] **Step 13: Add lifecycle parity and ownership source tests**

  Append this complete source and synthetic beyond-cap contract:

  ```js
  [capture, replay].forEach((source, index) => {
    const label = index === 0 ? "capture" : "replay";
    const compact = compactSource(source);
    assertEqual(
      (compact.match(/makeFormReleaseReceiptTracker\(\{maxDiagnosticReceipts:32\}\)/g) || [])
        .length,
      1,
      `${label} creates exactly one workflow tracker`,
    );
    assert(
      compact.includes('abandonActiveReceipt("geometry-reset");'),
      `${label} geometry reset resolves only active ownership`,
    );
    assert(
      compact.includes('abandonActiveReceipt("workflow-close");'),
      `${label} close resolves only active ownership`,
    );
    assert(
      compact.includes("shotId:action.id") || compact.includes("shotId:releaseAction.id"),
      `${label} diagnostic IDs come from receipt actions`,
    );
    assert(!/shots\s*\[\s*shots\.length\s*-\s*1\s*\]/.test(source), `${label} has no tail owner`);
    assert(!/\.pop\s*\(/.test(source), `${label} has no pop owner`);
    assert(
      !/uid\s*\(\s*\)/.test(
        boundedSourceSection(source, "function onShot(", "function loop(", `${label} onShot`),
      ),
      `${label} onShot allocates no fallback ID`,
    );
  });
  assert(
    compactSource(replay).includes('abandonActiveReceipt("replay-eos");'),
    "replay EOS is explicit",
  );

  function exerciseViewReceiptCap(label, debugEnabled) {
    const tracker = core.makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });
    let shots = [];
    const releaseFires = [];
    for (let number = 1; number <= 33; number += 1) {
      const action = tracker.begin({ fireTs: number, fire: null });
      shots.push({ id: action.id });
      tracker.markShotCreated(action.id);
      if (debugEnabled) {
        releaseFires.push({ shotId: action.id });
        if (releaseFires.length > 32) releaseFires.shift();
      }
      tracker.confirm();
    }
    if (label === "capture") {
      tracker.manualRemove("form-receipt-33");
      shots = shots.filter((shot) => shot.id !== "form-receipt-33");
    }
    const action34 = tracker.begin({ fireTs: 34, fire: null });
    shots.push({ id: action34.id });
    tracker.markShotCreated(action34.id);
    const canceled34 = tracker.cancel("anchor-return");
    shots = shots.filter((shot) => shot.id !== canceled34.deletionTarget);
    assertEqual(canceled34.deletionTarget, "form-receipt-34", `${label} receipt 34 exact cancel`);
    assert(
      shots.some((shot) => shot.id === "form-receipt-32"),
      `${label} receipt 32 survives`,
    );
    assertEqual(releaseFires.length, debugEnabled ? 32 : 0, `${label} exact debug trace gate`);
  }
  ["capture", "replay"].forEach((label) => {
    exerciseViewReceiptCap(label, false);
    exerciseViewReceiptCap(label, true);
  });
  ```

- [ ] **Step 14: Run focused and integration GREEN checks**

  Run:

  ```powershell
  node tools/check-form-core.js
  npm run check:form
  npm run check:app
  npm run check:globals
  npm run lint -- --quiet
  ```

  Expected: every command exits `0`; the focused suite ends in `Form core checks OK`.

- [ ] **Step 15: Format managed files and record the A/B regression result**

  Append this exact progress entry:

  ```markdown
  ## 2026-08-03 — Form diagnostic handoff Task 2

  - Changed: live capture and replay now preallocate workflow-local receipt IDs and remove only a receipt action’s exact deletion target.
  - RED: `node tools/check-form-core.js` reproduced `capture cancellation never owns array tail` before any source-order edit.
  - GREEN: retained A survives B fire -> manual remove B -> cancel B; receipt 33/34 remains exact with diagnostics OFF and ON.
  - Risk: replay EOS remains unresolved by design; this task adds no keep/delete policy.
  - Next: Task 3 copies and persists the exact seven fire fields additively.
  ```

  Run:

  ```powershell
  npx prettier --check tools/check-form-core.js docs/codex/codex-progress.md
  git diff --check
  ```

  Expected: both checks exit `0`. Inspect only changed compact view hunks.

- [ ] **Step 16: Commit Task 2 only**

  Run:

  ```powershell
  git status --short
  git add scripts/47-form-view.js tools/check-form-core.js docs/codex/codex-progress.md
  git diff --check --cached
  git commit -m "fix(form): target canceled shots by receipt"
  ```

  Expected: the cached whitespace check is silent and the exact commit subject succeeds.

---

### Task 3: Capture and persist complete fire snapshots additively

**Files:**

- Modify: scripts/46-form-core.js:1610 (add snapshot copier near formDiagSummary)
- Modify: scripts/47-form-view.js:27-46 (feature projection)
- Modify: scripts/47-form-view.js:270-627 (live fire/save diagnostics)
- Modify: scripts/47-form-view.js:711-897 (replay fire/save diagnostics)
- Modify: tools/check-form-core.js:41-55 and diagnostic/source-contract sections
- Add: tests/fixtures/storage/archery-note-v1-form-diagnostics.json
- Add: tests/fixtures/storage/archery-note-v1-form-diagnostics-malformed-coordinator.json
- Modify: tools/check-storage-contract.js:8-21, 116-127, 456-491
- Modify: tools/check-storage-roundtrip.js:8-24, 98-124, 369-408, 506-515
- Modify: docs/codex/codex-progress.md:end

**Interfaces:**

- Consumes: the current released frame's debug object, tracker snapshot, capture mode, current diagnostic exact-boolean state.
- Produces: copyFormReleaseFireSnapshot(debug) -> exact seven-key object or null; additive diagnostic record fields; diagnostics-only feature receipt IDs; deep-preserved schema-5 records.

```js
{
  anchorFloor,
  anchorEnter,
  releaseSpeed,
  evidenceAgeMs,
  evidenceStrength,
  departDelta,
  fireEvidence,
}
```

- [ ] **Step 1: Add the conditional loader export and fire-snapshot RED**

  Add this property immediately after the conditional tracker export in the existing core loader:

  ```js
  copyFormReleaseFireSnapshot:
    typeof copyFormReleaseFireSnapshot === "function"
      ? copyFormReleaseFireSnapshot
      : null,
  ```

  Then add this complete RED before the phase-detector fixtures:

  ```js
  assert(
    typeof core.copyFormReleaseFireSnapshot === "function",
    "fire snapshot copier is exported",
  );
  const validFireDebug = {
    anchorFloor: 0.47,
    anchorEnter: 0.59,
    releaseSpeed: 8,
    evidenceAgeMs: 0,
    evidenceStrength: 12,
    departDelta: 0.28,
    fireEvidence: "adaptive",
  };
  const fire = core.copyFormReleaseFireSnapshot(validFireDebug);
  assertJsonEqual(
    Object.keys(fire),
    [
      "anchorFloor",
      "anchorEnter",
      "releaseSpeed",
      "evidenceAgeMs",
      "evidenceStrength",
      "departDelta",
      "fireEvidence",
    ],
    "fire snapshot has the exact seven keys",
  );
  ```

- [ ] **Step 2: Run the fire-snapshot RED**

  Run: `node tools/check-form-core.js`

  Expected: exit `1` with `copyFormReleaseFireSnapshot is not a function` or the exact-key assertion.

- [ ] **Step 3: Implement the exact seven-key copier**

  Insert this complete function immediately before `formDiagSummary` in `scripts/46-form-core.js`:

  ```js
  function copyFormReleaseFireSnapshot(debug) {
    if (!debug || typeof debug !== "object" || Array.isArray(debug)) return null;
    const numericKeys = [
      "anchorFloor",
      "anchorEnter",
      "releaseSpeed",
      "evidenceAgeMs",
      "evidenceStrength",
      "departDelta",
    ];
    for (const key of numericKeys) {
      if (!Object.hasOwn(debug, key)) return null;
      if (!(debug[key] === null || Number.isFinite(debug[key]))) return null;
    }
    if (
      !Object.hasOwn(debug, "fireEvidence") ||
      !["adaptive", "close", "nb2"].includes(debug.fireEvidence)
    ) {
      return null;
    }
    return {
      anchorFloor: debug.anchorFloor,
      anchorEnter: debug.anchorEnter,
      releaseSpeed: debug.releaseSpeed,
      evidenceAgeMs: debug.evidenceAgeMs,
      evidenceStrength: debug.evidenceStrength,
      departDelta: debug.departDelta,
      fireEvidence: debug.fireEvidence,
    };
  }
  ```

- [ ] **Step 4: Add semantic and copy-isolation tests**

  Add this complete validation block beside the exact-key test:

  ```js
  {
    const numericKeys = [
      "anchorFloor",
      "anchorEnter",
      "releaseSpeed",
      "evidenceAgeMs",
      "evidenceStrength",
      "departDelta",
    ];
    Object.keys(validFireDebug).forEach((key) => {
      const missing = { ...validFireDebug };
      delete missing[key];
      assertEqual(core.copyFormReleaseFireSnapshot(missing), null, `missing ${key} is invalid`);
    });
    numericKeys.forEach((key) => {
      [undefined, NaN, Infinity, -Infinity].forEach((value) => {
        assertEqual(
          core.copyFormReleaseFireSnapshot({ ...validFireDebug, [key]: value }),
          null,
          `${key} rejects ${String(value)}`,
        );
      });
      assert(
        core.copyFormReleaseFireSnapshot({ ...validFireDebug, [key]: null }),
        `${key} accepts explicit null`,
      );
    });
    ["nb", "unknown", null, undefined].forEach((fireEvidence) => {
      assertEqual(
        core.copyFormReleaseFireSnapshot({ ...validFireDebug, fireEvidence }),
        null,
        `fireEvidence rejects ${String(fireEvidence)}`,
      );
    });
    const mutable = { ...validFireDebug };
    const copied = core.copyFormReleaseFireSnapshot(mutable);
    mutable.anchorEnter = 999;
    assertEqual(copied.anchorEnter, 0.59, "snapshot is detached from debug input");
  }
  ```

  In the existing genuine adaptive-fire block, add:

  ```js
  const adaptiveSnapshot = core.copyFormReleaseFireSnapshot(adaptiveFire.debug);
  assertEqual(adaptiveSnapshot.fireEvidence, "adaptive", "adaptive snapshot keeps its route");
  ```

  In the existing `runDw` block, immediately after `closeFire` and `nb2Fire` are available, add:

  ```js
  const nbVelocityFire = runDw(shotDw({ gapMs: 100 })).lastFire;
  assert(nbVelocityFire, "NB-velocity fixture produces a fire");
  assertEqual(nbVelocityFire.debug.fireVel, "nb", "fixture uses NB velocity");
  assertEqual(
    core.copyFormReleaseFireSnapshot(nbVelocityFire.debug).fireEvidence,
    "close",
    "NB velocity keeps the real close evidence label",
  );
  assertEqual(
    core.copyFormReleaseFireSnapshot(closeFire.debug).fireEvidence,
    "close",
    "ordinary close snapshot keeps close evidence",
  );
  assertEqual(
    core.copyFormReleaseFireSnapshot(nb2Fire.debug).fireEvidence,
    "nb2",
    "NB2 snapshot keeps nb2 evidence",
  );
  ```

- [ ] **Step 5: Wire current-frame snapshots into live and replay**

  In both frame loops, insert this expression immediately after `result` is returned and before the cancel/release/confirm branch:

  ```js
  const releaseFire =
    result.released && db.settings.formDebug === true
      ? copyFormReleaseFireSnapshot(result.debug)
      : null;
  ```

  In both release branches, replace the Task 2 `begin` call with:

  ```js
  const action = receiptTracker.begin({ fireTs: now, fire: releaseFire });
  ```

  For live capture, keep the existing `releaseAction` variable by using:

  ```js
  releaseAction = receiptTracker.begin({ fireTs: now, fire: releaseFire });
  ```

  Keep these exact capped writes from Task 2; do not increment tracker overflow here:

  ```js
  formDiagPush(
    formPhaseDiag.releaseFires,
    {
      ts: now,
      shotId: action.id,
      framesBefore: recentFrames.slice(0, -1).slice(-20),
    },
    32,
  );
  ```

  ```js
  formDiagPush(
    formPhaseDiag.releaseFires,
    {
      ts: now,
      shotId: releaseAction.id,
      framesBefore: recentFrames.slice(0, -1).slice(-20),
    },
    32,
  );
  ```

- [ ] **Step 6: Persist the additive exact-debug record shape**

  Replace `formFeatureFromShot` with this complete exact-boolean projection. Both the existing `diag` and new `receiptId` are inside the same exact gate:

  ```js
  function formFeatureFromShot(shot, includeDiagnostics) {
    const f = {
      phase: { anchorMs: shot.holdMs },
      angles: shot.angles,
      anchorNorm: shot.anchorNorm,
      release: shot.pre
        ? {
            bowMove: +shot.pre.bowMove.toFixed(3),
            drawMove: +shot.pre.drawMove.toFixed(3),
            stable: !shot.pre.bowDrift && !shot.pre.drawDrift,
          }
        : null,
      confidence: shot.confidence == null ? null : +shot.confidence.toFixed(2),
      score: shot.score == null ? null : Math.round(shot.score),
      arrowCheck: shot.arrowCheck
        ? {
            judgment: shot.arrowCheck.judgment,
            preScore:
              shot.arrowCheck.preScore == null ? null : +shot.arrowCheck.preScore.toFixed(2),
            confirmScore:
              shot.arrowCheck.confirmScore == null
                ? null
                : +shot.arrowCheck.confirmScore.toFixed(2),
          }
        : null,
    };
    if (includeDiagnostics === true) {
      if (shot.diag) {
        f.diag = {
          maxV: +shot.diag.maxV.toFixed(2),
          rise: +shot.diag.rise.toFixed(3),
          nullFrames: shot.diag.nullFrames,
          conf: shot.diag.conf == null ? null : +shot.diag.conf.toFixed(2),
        };
      }
      f.receiptId = shot.id;
    }
    return f;
  }
  ```

  Add this copied record helper after `formDiagPush`:

  ```js
  function copyFormPhaseDiagnosticsForRecord(formPhaseDiag, phaseCounts, receiptSnapshot) {
    return {
      rejectedFramesNear: formPhaseDiag.rejectedFramesNear.map((item) => ({ ...item })),
      canceledEvents: formPhaseDiag.canceledEvents.map((item) => ({ ...item })),
      releaseFires: formPhaseDiag.releaseFires.map((item) => ({
        ...item,
        framesBefore: (item.framesBefore || []).map((frame) => ({ ...frame })),
      })),
      phaseHistogram: { ...phaseCounts },
      releaseReceipts: receiptSnapshot.releaseReceipts.map((receipt) => ({
        ...receipt,
        fire: receipt.fire ? { ...receipt.fire } : null,
      })),
      receiptOverflow: receiptSnapshot.receiptOverflow,
      receiptInvariantCounts: { ...receiptSnapshot.receiptInvariantCounts },
      receiptDesynchronized: receiptSnapshot.desynchronized,
    };
  }
  ```

  Add this helper independently inside both workflows:

  ```js
  function prepareReceiptSave() {
    if (receiptTracker.current()) receiptTracker.abandon("workflow-save");
    return receiptTracker.snapshot();
  }
  ```

  At the beginning of all four save paths—live zero-shot, live ordinary, replay zero-shot, and replay ordinary—insert these lines before `const rec={`:

  ```js
  const receiptSnapshot = prepareReceiptSave();
  const includeDiagnostics = db.settings.formDebug === true;
  ```

  Use this exact feature expression in both ordinary records:

  ```js
  features: shots.map((shot) => formFeatureFromShot(shot, includeDiagnostics));
  ```

  Replace live diagnostic record mutation in both live save paths with:

  ```js
  if (includeDiagnostics) {
    rec.formDiagnosticVersion = 1;
    rec.captureMode = "live";
    rec.diag = formDiagSummary(shots, samplePerfMs);
    rec.formPhaseDiag = copyFormPhaseDiagnosticsForRecord(
      formPhaseDiag,
      phaseCounts,
      receiptSnapshot,
    );
  }
  ```

  In the live zero-shot function, pass `[]` to the existing summary call:

  ```js
  rec.diag = formDiagSummary([], samplePerfMs);
  ```

  Replace replay diagnostic record mutation in both replay save paths with:

  ```js
  if (includeDiagnostics) {
    rec.formDiagnosticVersion = 1;
    rec.captureMode = "replay";
    rec.formPhaseDiag = copyFormPhaseDiagnosticsForRecord(
      formPhaseDiag,
      phaseCounts,
      receiptSnapshot,
    );
  }
  ```

- [ ] **Step 7: Prove diagnostics-OFF compatibility**

  Add this concrete feature projection loader and characterization to `tools/check-form-core.js`:

  ```js
  const featureProjectionSource = boundedSourceSection(
    viewScript,
    "function formFeatureFromShot(",
    "function formDiagPush(",
    "formFeatureFromShot source",
  );
  const featureApi = new Function(
    `${featureProjectionSource}
  return {formFeatureFromShot};`,
  )();
  const featureShot = {
    id: "form-receipt-1",
    holdMs: 900,
    angles: { bowArm: 171, drawArm: 150 },
    anchorNorm: 0.47,
    pre: null,
    confidence: 0.92,
    score: 82,
    arrowCheck: null,
    diag: { maxV: 8, rise: 0.2, nullFrames: 0, conf: 0.92 },
  };
  [false, undefined, "true", 1, {}].forEach((setting) => {
    const feature = featureApi.formFeatureFromShot(featureShot, setting === true);
    assert(
      !Object.hasOwn(feature, "diag"),
      `diagnostics ${String(setting)} excludes existing diag`,
    );
    assert(
      !Object.hasOwn(feature, "receiptId"),
      `diagnostics ${String(setting)} excludes receiptId`,
    );
  });
  const enabledFeature = featureApi.formFeatureFromShot(featureShot, true);
  assert(Object.hasOwn(enabledFeature, "diag"), "exact true retains existing diag");
  assertEqual(enabledFeature.receiptId, featureShot.id, "exact true retains receipt ID");
  ```

  Add these source assertions for both bounded workflows:

  ```js
  [capture, replay].forEach((source, index) => {
    const label = index === 0 ? "live" : "replay";
    const compact = compactSource(source);
    assert(
      compact.includes("constreceiptSnapshot=prepareReceiptSave();") &&
        compact.includes("constincludeDiagnostics=db.settings.formDebug===true;"),
      `${label} always resolves workflow-save before exact diagnostic gating`,
    );
    assert(
      compact.includes("shots.map((shot)=>formFeatureFromShot(shot,includeDiagnostics))"),
      `${label} uses an explicit map lambda instead of the map index`,
    );
    assert(
      compact.includes("if(includeDiagnostics){rec.formDiagnosticVersion=1;") &&
        !compact.includes("if(db.settings.formDebug){"),
      `${label} persists diagnostic markers only for exact true`,
    );
  });
  assertEqual(
    (compactSource(capture).match(/prepareReceiptSave\(\);/g) || []).length,
    2,
    "live ordinary and zero-shot saves both transition workflow-save",
  );
  assertEqual(
    (compactSource(replay).match(/prepareReceiptSave\(\);/g) || []).length,
    2,
    "replay ordinary and zero-shot saves both transition workflow-save",
  );
  ```

  Run: `node tools/check-form-core.js`

  Expected: exit `1` at `feature diagnostics require an explicit exact boolean` before the Step 6 production edits; after Step 6, exit `0` with `Form core checks OK`.

- [ ] **Step 8: Add fully synthetic storage fixtures and preservation tests**

  Create `tests/fixtures/storage/archery-note-v1-form-diagnostics.json` with this complete synthetic payload:

  ```json
  {
    "schema": 5,
    "setups": [],
    "sightMarks": [],
    "sessions": [],
    "trash": [],
    "active": null,
    "customRounds": [],
    "settings": {
      "eyeSight": 850,
      "formDebug": true,
      "formDiagnosticMatrixBatch": {
        "version": 1,
        "batchId": "11111111-1111-4111-8111-111111111111",
        "appVer": 84,
        "nextSlot": 1,
        "recordIds": ["fixture-form-diagnostic-live"],
        "invalidated": false
      }
    },
    "formAnalyses": [
      {
        "id": "fixture-form-diagnostic-live",
        "date": "2026-08-03",
        "ts": 1785682800000,
        "sessionId": null,
        "setupId": null,
        "shots": 1,
        "modelVer": "synthetic-pose-fixture",
        "appVer": 84,
        "fps": 30,
        "features": [
          {
            "phase": { "anchorMs": 900 },
            "angles": { "bowArm": 171, "drawArm": 150 },
            "anchorNorm": 0.47,
            "release": null,
            "confidence": 0.92,
            "score": 82,
            "arrowCheck": null,
            "receiptId": "form-receipt-1"
          }
        ],
        "note": "SYNTHETIC FIXTURE ONLY - NO REAL USER OR DEVICE DATA",
        "formDiagnosticVersion": 1,
        "captureMode": "live",
        "formPhaseDiag": {
          "rejectedFramesNear": [],
          "canceledEvents": [{ "ts": 3000, "reason": "anchor-return", "shotId": "form-receipt-3" }],
          "releaseFires": [
            { "ts": 1000, "shotId": "form-receipt-1", "framesBefore": [] },
            { "ts": 2000, "shotId": "form-receipt-2", "framesBefore": [] },
            { "ts": 3000, "shotId": "form-receipt-3", "framesBefore": [] },
            { "ts": 4000, "shotId": "form-receipt-4", "framesBefore": [] },
            { "ts": 5000, "shotId": "form-receipt-5", "framesBefore": [] }
          ],
          "phaseHistogram": {
            "SETUP": 1,
            "IDLE": 1,
            "ANCHORING": 1,
            "FULL_DRAW": 1,
            "RELEASE": 5,
            "FOLLOW": 1
          },
          "releaseReceipts": [
            {
              "id": "form-receipt-1",
              "fireTs": 1000,
              "shotCreated": true,
              "userDisposition": "present",
              "detectorDisposition": "confirmed",
              "cancelReason": null,
              "unresolvedReason": null,
              "fire": {
                "anchorFloor": 0.47,
                "anchorEnter": 0.59,
                "releaseSpeed": 8,
                "evidenceAgeMs": 0,
                "evidenceStrength": 12,
                "departDelta": 0.28,
                "fireEvidence": "adaptive"
              }
            },
            {
              "id": "form-receipt-2",
              "fireTs": 2000,
              "shotCreated": true,
              "userDisposition": "manual-removed",
              "detectorDisposition": "confirmed",
              "cancelReason": null,
              "unresolvedReason": null,
              "fire": {
                "anchorFloor": null,
                "anchorEnter": 0.35,
                "releaseSpeed": 6,
                "evidenceAgeMs": null,
                "evidenceStrength": null,
                "departDelta": null,
                "fireEvidence": "close"
              }
            },
            {
              "id": "form-receipt-3",
              "fireTs": 3000,
              "shotCreated": true,
              "userDisposition": "present",
              "detectorDisposition": "auto-canceled",
              "cancelReason": "anchor-return",
              "unresolvedReason": null,
              "fire": {
                "anchorFloor": null,
                "anchorEnter": 0.35,
                "releaseSpeed": 6,
                "evidenceAgeMs": null,
                "evidenceStrength": null,
                "departDelta": null,
                "fireEvidence": "close"
              }
            },
            {
              "id": "form-receipt-4",
              "fireTs": 4000,
              "shotCreated": false,
              "userDisposition": "not-created",
              "detectorDisposition": "confirmed",
              "cancelReason": null,
              "unresolvedReason": null,
              "fire": {
                "anchorFloor": null,
                "anchorEnter": 0.35,
                "releaseSpeed": 6,
                "evidenceAgeMs": null,
                "evidenceStrength": null,
                "departDelta": null,
                "fireEvidence": "nb2"
              }
            },
            {
              "id": "form-receipt-5",
              "fireTs": 5000,
              "shotCreated": true,
              "userDisposition": "present",
              "detectorDisposition": "unresolved",
              "cancelReason": null,
              "unresolvedReason": "workflow-save",
              "fire": {
                "anchorFloor": 0.47,
                "anchorEnter": 0.59,
                "releaseSpeed": 8,
                "evidenceAgeMs": 10,
                "evidenceStrength": 9,
                "departDelta": 0.2,
                "fireEvidence": "adaptive"
              }
            }
          ],
          "receiptOverflow": 0,
          "receiptInvariantCounts": {
            "supersededActive": 0,
            "missingActive": 0,
            "identityMismatch": 0,
            "invalidTransition": 0,
            "sequenceExhausted": 0
          },
          "receiptDesynchronized": false
        },
        "formDiagnosticMatrix": {
          "version": 1,
          "batchId": "11111111-1111-4111-8111-111111111111",
          "slot": "side"
        }
      }
    ]
  }
  ```

  Create `tests/fixtures/storage/archery-note-v1-form-diagnostics-malformed-coordinator.json`:

  ```json
  {
    "schema": 5,
    "setups": [],
    "sightMarks": [],
    "sessions": [],
    "trash": [],
    "active": null,
    "customRounds": [],
    "settings": {
      "eyeSight": 850,
      "formDebug": true,
      "formDiagnosticMatrixBatch": {
        "version": "future",
        "batchId": ["malformed"],
        "appVer": -1,
        "nextSlot": 99,
        "recordIds": "not-an-array",
        "invalidated": "false",
        "futureKey": {
          "note": "SYNTHETIC FIXTURE ONLY - NO REAL USER OR DEVICE DATA"
        }
      }
    },
    "formAnalyses": [
      {
        "id": "fixture-form-diagnostic-malformed",
        "shots": 0,
        "features": [],
        "note": "SYNTHETIC FIXTURE ONLY - NO REAL USER OR DEVICE DATA"
      }
    ]
  }
  ```

  Add both names to `fixtureFiles` in both storage tools:

  ```js
  formDiagnostics: "archery-note-v1-form-diagnostics.json",
  formDiagnosticsMalformedCoordinator:
    "archery-note-v1-form-diagnostics-malformed-coordinator.json",
  ```

  Add this complete contract check to `tools/check-storage-contract.js` and call it from `main()` after `checkFormAnalysisTrashRestore`:

  ```js
  function checkFormDiagnosticsCompatibility(storageApi, fixtures) {
    ["formDiagnostics", "formDiagnosticsMalformedCoordinator"].forEach((name) => {
      const source = fixtures[name];
      const once = storageApi.normalizeDb(clone(source));
      const twice = storageApi.normalizeDb(clone(once));
      assertStrict.deepStrictEqual(
        twice.formAnalyses,
        source.formAnalyses,
        `[${name}] records survive normalization twice`,
      );
      assertStrict.deepStrictEqual(
        twice.settings.formDiagnosticMatrixBatch,
        source.settings.formDiagnosticMatrixBatch,
        `[${name}] coordinator survives normalization twice`,
      );
    });

    const source = fixtures.formDiagnostics;
    const db = storageApi.normalizeDb(clone(source));
    const record = db.formAnalyses[0];
    const trashApi = loadTrashApi(db, () => {});
    const item = trashApi.trashItem("formAnalysis", "synthetic diagnostic", record);
    db.formAnalyses = [];
    assert(trashApi.restoreTrash(item.id), "[formDiagnostics] trash restore succeeds");
    assertStrict.deepStrictEqual(
      db.formAnalyses[0],
      source.formAnalyses[0],
      "[formDiagnostics] trash restore preserves nested diagnostics",
    );
  }

  checkFormDiagnosticsCompatibility(storageApi, fixtures);
  ```

  Add this save/load helper and round-trip check to `tools/check-storage-roundtrip.js`, then call it from `main()` after `checkSnapshot`:

  ```js
  function saveAndReloadFixture(fixture) {
    const shim = makeLocalStorageShim();
    const raw = new Function(
      "localStorage",
      "fixture",
      `${storageScript}
  db = normalizeDb(fixture);
  save({reason:"synthetic-form-diagnostics"});
  return localStorage.getItem(KEY);`,
    )(shim, clone(fixture));
    return loadDbFromRaw(raw);
  }

  function checkFormDiagnosticsRoundTrip(storageApi, fixtures, normalized) {
    ["formDiagnostics", "formDiagnosticsMalformedCoordinator"].forEach((name) => {
      const source = fixtures[name];
      assertStrict.deepStrictEqual(
        normalized[name].formAnalyses,
        source.formAnalyses,
        `[${name}] JSON import preserves records`,
      );
      const loaded = saveAndReloadFixture(source);
      assertStrict.deepStrictEqual(
        loaded.formAnalyses,
        source.formAnalyses,
        `[${name}] save/load preserves records`,
      );
      assertStrict.deepStrictEqual(
        loaded.settings.formDiagnosticMatrixBatch,
        source.settings.formDiagnosticMatrixBatch,
        `[${name}] save/load preserves coordinator`,
      );
      const snapshot = createImportSnapshot(storageApi.normalizeDb(clone(source)));
      const restored = storageApi.normalizeDb(clone(snapshot.snapshots[0].data));
      assertStrict.deepStrictEqual(
        restored.formAnalyses,
        source.formAnalyses,
        `[${name}] safety restore preserves records`,
      );
      assertStrict.deepStrictEqual(
        restored.settings.formDiagnosticMatrixBatch,
        source.settings.formDiagnosticMatrixBatch,
        `[${name}] safety restore preserves coordinator`,
      );
    });
  }

  checkFormDiagnosticsRoundTrip(storageApi, fixtures, normalized);
  ```

  Keep `archery-note-v1-form-analyses.json` and its existing assertions unchanged as the legacy missing-new-fields case.

- [ ] **Step 9: Run focused and compatibility GREEN checks**

  Run:

  ```powershell
  node tools/check-form-core.js
  node tools/check-storage-contract.js
  node tools/check-storage-roundtrip.js
  npm run check:form
  npm run check:storage
  npm run check:app
  npm run lint -- --quiet
  ```

  Expected: every command exits `0`; focused output ends in `Form core checks OK` and both storage suites report OK.

- [ ] **Step 10: Format, document, and commit Task 3**

  Append this exact ledger entry:

  ```markdown
  ## 2026-08-03 — Form diagnostic handoff Task 3

  - Changed: live and replay now copy the exact seven fire fields from the current release result and persist copied receipt diagnostics only when `formDebug === true`.
  - RED: the conditional fire copier export and exact diagnostic feature projection assertions failed before production edits.
  - GREEN: form checks plus normalize-twice, save/load, JSON import, safety restore, and trash restore preservation passed for both synthetic fixtures.
  - Compatibility: false, absent, truthy-string, numeric, and object diagnostic settings persist neither existing `features[].diag` nor new receipt fields; the legacy fixture remains valid.
  - Risk: missing or invalid fire snapshots make a run exporter-ineligible instead of inventing evidence.
  - Next: Task 4 adds pure matrix coordination and record eligibility.
  ```

  Then run:

  ```powershell
  npx prettier --check tools/check-form-core.js tools/check-storage-contract.js tools/check-storage-roundtrip.js tests/fixtures/storage/archery-note-v1-form-diagnostics.json tests/fixtures/storage/archery-note-v1-form-diagnostics-malformed-coordinator.json docs/codex/codex-progress.md
  git diff --check
  git add scripts/46-form-core.js scripts/47-form-view.js tools/check-form-core.js tools/check-storage-contract.js tools/check-storage-roundtrip.js tests/fixtures/storage/archery-note-v1-form-diagnostics.json tests/fixtures/storage/archery-note-v1-form-diagnostics-malformed-coordinator.json docs/codex/codex-progress.md
  git diff --check --cached
  git commit -m "feat(form): persist complete release fire snapshots"
  ```

  Expected: all checks exit `0`; the commit has the exact subject above.

---

### Task 4: Add pure matrix coordination and record eligibility

**Files:**

- Modify: scripts/46-form-core.js:after copyFormReleaseFireSnapshot
- Add: tools/check-form-diagnostics.js
- Modify: package.json:scripts.check:form
- Modify: docs/codex/codex-progress.md:end

**Interfaces:**

- Consumes: current `APP_VER`, exact canonical lowercase UUID candidates from Web Crypto, an optional coordinator, `formAnalyses`, and form-analysis trash.
- Produces the one global slot constant `FORM_DIAGNOSTIC_SLOTS = Object.freeze(["side", "oblique", "normal_range"])`; Task 9 consumes it and must not redeclare it.
- Produces these exact result contracts:

  ```text
  createFormDiagnosticMatrixCoordinator(appVer, batchId)
    -> { ok, code, coordinator }
  validateFormDiagnosticMatrixCoordinator(coordinator, appVer, requireComplete = false)
    -> { ok, code, coordinator }
  allocateFormDiagnosticBatchId(cryptoSource, coordinator, formAnalyses, trash)
    -> { ok, code, batchId }
  validateFormDiagnosticRecord(record, appVer)
    -> { ok, code, retainedReceiptIds }
  planFormDiagnosticMatrixRecord(record, coordinator, appVer)
    -> { ok, code, record, coordinator }
  invalidateFormDiagnosticMatrixForRecord(coordinator, recordId, appVer)
    -> { ok, code, coordinator, changed }
  ```

- Every success uses `code: null`. Every failure nulls newly produced payload fields and uses exactly one of `invalid-app-version`, `invalid-batch-id`, `crypto-unavailable`, `batch-id-collision`, `coordinator-missing`, `coordinator-invalid`, `coordinator-stale`, `coordinator-incomplete`, `coordinator-complete`, `record-invalid`, or `record-ineligible`.

- [ ] **Step 1: Create the DOM-free diagnostics harness and script entry**

  Add `tools/check-form-diagnostics.js` with `assert`, `assertEqual`, `deepEqual`, a `new Function` core loader, and synthetic receipt/record/coordinator builders. Append `node tools/check-form-diagnostics.js` to `package.json`'s existing `check:form` chain. Do not add a dependency or touch the lockfile.

  Create the harness with this exact initial content:

  ```js
  "use strict";

  const fs = require("fs");
  const path = require("path");
  const { isDeepStrictEqual } = require("util");

  const root = path.resolve(__dirname, "..");
  const coreScript = fs.readFileSync(path.join(root, "scripts", "46-form-core.js"), "utf8");

  function assert(ok, message) {
    if (!ok) throw new Error(message);
  }

  function assertEqual(actual, expected, label) {
    assert(
      Object.is(actual, expected),
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }

  function deepEqual(actual, expected, label) {
    assert(isDeepStrictEqual(actual, expected), label);
  }

  function cloneFixture(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadFormDiagnosticApi() {
    return new Function(
      `${coreScript}
  return {
    FORM_DIAGNOSTIC_SLOTS:
      typeof FORM_DIAGNOSTIC_SLOTS !== "undefined" ? FORM_DIAGNOSTIC_SLOTS : null,
    FORM_DIAGNOSTIC_RESULT_CODES:
      typeof FORM_DIAGNOSTIC_RESULT_CODES !== "undefined"
        ? FORM_DIAGNOSTIC_RESULT_CODES
        : null,
    createFormDiagnosticMatrixCoordinator:
      typeof createFormDiagnosticMatrixCoordinator === "function"
        ? createFormDiagnosticMatrixCoordinator
        : null,
    validateFormDiagnosticMatrixCoordinator:
      typeof validateFormDiagnosticMatrixCoordinator === "function"
        ? validateFormDiagnosticMatrixCoordinator
        : null,
    allocateFormDiagnosticBatchId:
      typeof allocateFormDiagnosticBatchId === "function"
        ? allocateFormDiagnosticBatchId
        : null,
    validateFormDiagnosticRecord:
      typeof validateFormDiagnosticRecord === "function"
        ? validateFormDiagnosticRecord
        : null,
    planFormDiagnosticMatrixRecord:
      typeof planFormDiagnosticMatrixRecord === "function"
        ? planFormDiagnosticMatrixRecord
        : null,
    invalidateFormDiagnosticMatrixForRecord:
      typeof invalidateFormDiagnosticMatrixForRecord === "function"
        ? invalidateFormDiagnosticMatrixForRecord
        : null,
  };`,
    )();
  }

  const api = loadFormDiagnosticApi();
  const BATCH_ID = "11111111-1111-4111-8111-111111111111";

  function validFire(overrides = {}) {
    return Object.assign(
      {
        anchorFloor: null,
        anchorEnter: 0.5,
        releaseSpeed: 7,
        evidenceAgeMs: null,
        evidenceStrength: null,
        departDelta: 0.25,
        fireEvidence: "close",
      },
      overrides,
    );
  }

  function validReceipt(number, overrides = {}) {
    return Object.assign(
      {
        id: `form-receipt-${number}`,
        fireTs: number * 1000,
        shotCreated: true,
        userDisposition: "present",
        detectorDisposition: "confirmed",
        cancelReason: null,
        unresolvedReason: null,
        fire: validFire(),
      },
      overrides,
    );
  }

  function validRecord(id = "diagnostic-record-1", captureMode = "live") {
    return {
      id,
      shots: 6,
      appVer: 84,
      formDiagnosticVersion: 1,
      captureMode,
      features: Array.from({ length: 6 }, (_, index) => ({
        receiptId: `form-receipt-${index + 1}`,
      })),
      formPhaseDiag: {
        releaseReceipts: Array.from({ length: 6 }, (_, index) => validReceipt(index + 1)),
        receiptOverflow: 0,
        receiptInvariantCounts: {
          supersededActive: 0,
          missingActive: 0,
          identityMismatch: 0,
          invalidTransition: 0,
          sequenceExhausted: 0,
        },
        receiptDesynchronized: false,
      },
    };
  }

  function validCoordinator(nextSlot = 0, recordIds = [], appVer = 84) {
    return {
      version: 1,
      batchId: BATCH_ID,
      appVer,
      nextSlot,
      recordIds: recordIds.slice(),
      invalidated: false,
    };
  }

  assert(
    typeof api.createFormDiagnosticMatrixCoordinator === "function",
    "diagnostic matrix coordinator API is exported",
  );
  assert(
    typeof api.validateFormDiagnosticMatrixCoordinator === "function",
    "diagnostic matrix coordinator validator is exported",
  );
  assert(
    typeof api.allocateFormDiagnosticBatchId === "function",
    "diagnostic batch allocator API is exported",
  );
  assert(
    typeof api.validateFormDiagnosticRecord === "function",
    "diagnostic record validator API is exported",
  );
  assert(
    typeof api.planFormDiagnosticMatrixRecord === "function",
    "diagnostic matrix record planner is exported",
  );
  assert(
    typeof api.invalidateFormDiagnosticMatrixForRecord === "function",
    "diagnostic matrix invalidator API is exported",
  );

  console.log("Form diagnostic checks OK");
  ```

  Change `package.json`'s script to:

  ```json
  "check:form": "node tools/check-form-core.js && node tools/golden-replay/test-form-metric-fixtures.js && node tools/check-form-diagnostics.js"
  ```

- [ ] **Step 2: Add the initial API RED**

  Use the six API assertions already present at the end of the Step 1 harness.
  Do not append duplicate assertions. The first assertion is intentionally:

  ```js
  assert(
    typeof api.createFormDiagnosticMatrixCoordinator === "function",
    "diagnostic matrix coordinator API is exported",
  );
  ```

- [ ] **Step 3: Run the API RED**

  Run: `node tools/check-form-diagnostics.js`

  Expected: exit `1` with `diagnostic matrix coordinator API is exported`.

- [ ] **Step 4: Implement creation, explicit coordinator validation, and UUID allocation**

  `createFormDiagnosticMatrixCoordinator` returns `{ ok: true, code: null, coordinator: { version: 1, batchId, appVer, nextSlot: 0, recordIds: [], invalidated: false } }` or a null coordinator with a fixed code. `validateFormDiagnosticMatrixCoordinator` checks own keys, exact booleans, safe integers, canonical lowercase UUID, fixed record-ID count/order constraints, version freshness, and `requireComplete`. Uppercase UUIDs are rejected, never normalized. Allocation prefers `randomUUID`, falls back to RFC-4122-v4 `getRandomValues`, scans the active batch, record markers, and form-analysis trash, and makes at most three attempts; never use `Math.random` or `uid`.

  Insert this complete block immediately after `copyFormReleaseFireSnapshot`.
  The record/planner/invalidation bodies at the end are deliberate API stubs:
  they make the API scaffold GREEN before Step 6 adds the first slot RED.

  ```js
  const FORM_DIAGNOSTIC_SLOTS = Object.freeze(["side", "oblique", "normal_range"]);
  const FORM_DIAGNOSTIC_RESULT_CODES = Object.freeze({
    INVALID_APP_VERSION: "invalid-app-version",
    INVALID_BATCH_ID: "invalid-batch-id",
    CRYPTO_UNAVAILABLE: "crypto-unavailable",
    BATCH_ID_COLLISION: "batch-id-collision",
    COORDINATOR_MISSING: "coordinator-missing",
    COORDINATOR_INVALID: "coordinator-invalid",
    COORDINATOR_STALE: "coordinator-stale",
    COORDINATOR_INCOMPLETE: "coordinator-incomplete",
    COORDINATOR_COMPLETE: "coordinator-complete",
    RECORD_INVALID: "record-invalid",
    RECORD_INELIGIBLE: "record-ineligible",
  });
  const FORM_DIAGNOSTIC_COORDINATOR_KEYS = Object.freeze([
    "version",
    "batchId",
    "appVer",
    "nextSlot",
    "recordIds",
    "invalidated",
  ]);
  const FORM_DIAGNOSTIC_UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const FORM_DIAGNOSTIC_MISSING = Symbol("form-diagnostic-missing");

  function formDiagnosticReadOwnData(source, key) {
    if (source == null || (typeof source !== "object" && typeof source !== "function")) {
      return FORM_DIAGNOSTIC_MISSING;
    }
    try {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      return descriptor && Object.hasOwn(descriptor, "value")
        ? descriptor.value
        : FORM_DIAGNOSTIC_MISSING;
    } catch (_) {
      return FORM_DIAGNOSTIC_MISSING;
    }
  }

  function formDiagnosticHasExactOwnDataKeys(source, keys) {
    if (!source || typeof source !== "object") return false;
    let actual;
    try {
      actual = Object.keys(source);
    } catch (_) {
      return false;
    }
    return (
      actual.length === keys.length &&
      keys.every(
        (key) =>
          actual.includes(key) &&
          formDiagnosticReadOwnData(source, key) !== FORM_DIAGNOSTIC_MISSING,
      )
    );
  }

  function formDiagnosticReadOwnArray(source) {
    if (!Array.isArray(source)) return null;
    const copied = [];
    for (let index = 0; index < source.length; index++) {
      const value = formDiagnosticReadOwnData(source, String(index));
      if (value === FORM_DIAGNOSTIC_MISSING) return null;
      copied.push(value);
    }
    return copied;
  }

  function formDiagnosticRecordIdIsValid(value) {
    return typeof value === "string" && value.length >= 1 && value.length <= 128;
  }

  function formDiagnosticCoordinatorFailure(code) {
    return { ok: false, code, coordinator: null };
  }

  function validateFormDiagnosticMatrixCoordinator(coordinator, appVer, requireComplete = false) {
    if (!Number.isSafeInteger(appVer) || appVer <= 0) {
      return formDiagnosticCoordinatorFailure(FORM_DIAGNOSTIC_RESULT_CODES.INVALID_APP_VERSION);
    }
    if (coordinator == null) {
      return formDiagnosticCoordinatorFailure(FORM_DIAGNOSTIC_RESULT_CODES.COORDINATOR_MISSING);
    }
    if (
      typeof requireComplete !== "boolean" ||
      !formDiagnosticHasExactOwnDataKeys(coordinator, FORM_DIAGNOSTIC_COORDINATOR_KEYS)
    ) {
      return formDiagnosticCoordinatorFailure(FORM_DIAGNOSTIC_RESULT_CODES.COORDINATOR_INVALID);
    }

    const version = formDiagnosticReadOwnData(coordinator, "version");
    const batchId = formDiagnosticReadOwnData(coordinator, "batchId");
    const coordinatorAppVer = formDiagnosticReadOwnData(coordinator, "appVer");
    const nextSlot = formDiagnosticReadOwnData(coordinator, "nextSlot");
    const sourceRecordIds = formDiagnosticReadOwnData(coordinator, "recordIds");
    const invalidated = formDiagnosticReadOwnData(coordinator, "invalidated");
    const recordIds = formDiagnosticReadOwnArray(sourceRecordIds);

    if (
      version !== 1 ||
      typeof batchId !== "string" ||
      !FORM_DIAGNOSTIC_UUID_V4.test(batchId) ||
      !Number.isSafeInteger(coordinatorAppVer) ||
      coordinatorAppVer <= 0 ||
      !Number.isSafeInteger(nextSlot) ||
      nextSlot < 0 ||
      nextSlot > FORM_DIAGNOSTIC_SLOTS.length ||
      !recordIds ||
      recordIds.length !== nextSlot ||
      new Set(recordIds).size !== recordIds.length ||
      !recordIds.every(formDiagnosticRecordIdIsValid) ||
      invalidated !== false
    ) {
      return formDiagnosticCoordinatorFailure(FORM_DIAGNOSTIC_RESULT_CODES.COORDINATOR_INVALID);
    }
    if (coordinatorAppVer !== appVer) {
      return formDiagnosticCoordinatorFailure(FORM_DIAGNOSTIC_RESULT_CODES.COORDINATOR_STALE);
    }
    if (requireComplete && nextSlot !== FORM_DIAGNOSTIC_SLOTS.length) {
      return formDiagnosticCoordinatorFailure(FORM_DIAGNOSTIC_RESULT_CODES.COORDINATOR_INCOMPLETE);
    }

    return {
      ok: true,
      code: null,
      coordinator: {
        version: 1,
        batchId,
        appVer: coordinatorAppVer,
        nextSlot,
        recordIds: recordIds.slice(),
        invalidated: false,
      },
    };
  }

  function createFormDiagnosticMatrixCoordinator(appVer, batchId) {
    if (!Number.isSafeInteger(appVer) || appVer <= 0) {
      return formDiagnosticCoordinatorFailure(FORM_DIAGNOSTIC_RESULT_CODES.INVALID_APP_VERSION);
    }
    if (typeof batchId !== "string" || !FORM_DIAGNOSTIC_UUID_V4.test(batchId)) {
      return formDiagnosticCoordinatorFailure(FORM_DIAGNOSTIC_RESULT_CODES.INVALID_BATCH_ID);
    }
    return {
      ok: true,
      code: null,
      coordinator: {
        version: 1,
        batchId,
        appVer,
        nextSlot: 0,
        recordIds: [],
        invalidated: false,
      },
    };
  }

  function formDiagnosticReadCollisionBatchId(record) {
    const marker = formDiagnosticReadOwnData(record, "formDiagnosticMatrix");
    const batchId = formDiagnosticReadOwnData(marker, "batchId");
    return typeof batchId === "string" && FORM_DIAGNOSTIC_UUID_V4.test(batchId) ? batchId : null;
  }

  function formDiagnosticCollectBatchIds(coordinator, formAnalyses, trash) {
    const records = formDiagnosticReadOwnArray(formAnalyses);
    const trashItems = formDiagnosticReadOwnArray(trash);
    if (!records || !trashItems) return null;

    const used = new Set();
    const activeBatchId = formDiagnosticReadOwnData(coordinator, "batchId");
    if (typeof activeBatchId === "string" && FORM_DIAGNOSTIC_UUID_V4.test(activeBatchId)) {
      used.add(activeBatchId);
    }
    records.forEach((record) => {
      const batchId = formDiagnosticReadCollisionBatchId(record);
      if (batchId) used.add(batchId);
    });
    trashItems.forEach((item) => {
      if (formDiagnosticReadOwnData(item, "type") !== "formAnalysis") return;
      const batchId = formDiagnosticReadCollisionBatchId(formDiagnosticReadOwnData(item, "data"));
      if (batchId) used.add(batchId);
    });
    return used;
  }

  function formDiagnosticFormatUuidV4(bytes) {
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
    return (
      hex.slice(0, 4).join("") +
      "-" +
      hex.slice(4, 6).join("") +
      "-" +
      hex.slice(6, 8).join("") +
      "-" +
      hex.slice(8, 10).join("") +
      "-" +
      hex.slice(10, 16).join("")
    );
  }

  function formDiagnosticReadCryptoMethod(source, key) {
    if (!source) return null;
    try {
      const method = source[key];
      return typeof method === "function" ? method.bind(source) : null;
    } catch (_) {
      return null;
    }
  }

  function allocateFormDiagnosticBatchId(cryptoSource, coordinator, formAnalyses, trash) {
    const randomUUID = formDiagnosticReadCryptoMethod(cryptoSource, "randomUUID");
    const getRandomValues = formDiagnosticReadCryptoMethod(cryptoSource, "getRandomValues");
    if (!randomUUID && !getRandomValues) {
      return {
        ok: false,
        code: FORM_DIAGNOSTIC_RESULT_CODES.CRYPTO_UNAVAILABLE,
        batchId: null,
      };
    }

    const used = formDiagnosticCollectBatchIds(coordinator, formAnalyses, trash);
    if (!used) {
      return {
        ok: false,
        code: FORM_DIAGNOSTIC_RESULT_CODES.BATCH_ID_COLLISION,
        batchId: null,
      };
    }

    let malformedCandidate = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      let candidate = null;
      if (randomUUID) {
        try {
          candidate = randomUUID();
        } catch (_) {
          if (getRandomValues) {
            try {
              const bytes = new Uint8Array(16);
              getRandomValues(bytes);
              candidate = formDiagnosticFormatUuidV4(bytes);
            } catch (_) {
              candidate = null;
            }
          }
        }
      } else {
        try {
          const bytes = new Uint8Array(16);
          getRandomValues(bytes);
          candidate = formDiagnosticFormatUuidV4(bytes);
        } catch (_) {
          candidate = null;
        }
      }

      if (typeof candidate !== "string" || !FORM_DIAGNOSTIC_UUID_V4.test(candidate)) {
        malformedCandidate = true;
        continue;
      }
      if (!used.has(candidate)) {
        return { ok: true, code: null, batchId: candidate };
      }
    }

    return {
      ok: false,
      code: malformedCandidate
        ? FORM_DIAGNOSTIC_RESULT_CODES.INVALID_BATCH_ID
        : FORM_DIAGNOSTIC_RESULT_CODES.BATCH_ID_COLLISION,
      batchId: null,
    };
  }

  function validateFormDiagnosticRecord() {
    return {
      ok: false,
      code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE,
      retainedReceiptIds: null,
    };
  }

  function planFormDiagnosticMatrixRecord() {
    return {
      ok: false,
      code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE,
      record: null,
      coordinator: null,
    };
  }

  function invalidateFormDiagnosticMatrixForRecord(coordinator) {
    return { ok: true, code: null, coordinator, changed: false };
  }
  ```

- [ ] **Step 5: Add UUID and coordinator validator tests**

  Cover randomUUID, deterministic byte fallback, collision then success, three collisions, uppercase and malformed candidates, missing crypto, extra/missing coordinator keys, stale app version, incomplete/complete modes, duplicate IDs, ID length `128/129`, and source immutability.

  Insert this complete test block immediately before the harness's final
  `console.log`:

  ```js
  function assertCoordinatorFailure(result, code, label) {
    deepEqual(result, { ok: false, code, coordinator: null }, label);
  }

  const createdCoordinator = api.createFormDiagnosticMatrixCoordinator(84, BATCH_ID);
  assertEqual(createdCoordinator.ok, true, "canonical coordinator creation succeeds");
  assertEqual(createdCoordinator.code, null, "coordinator success code is null");
  deepEqual(
    createdCoordinator.coordinator,
    validCoordinator(),
    "coordinator creation uses the exact initial shape",
  );
  assertCoordinatorFailure(
    api.createFormDiagnosticMatrixCoordinator(0, BATCH_ID),
    "invalid-app-version",
    "nonpositive app version is rejected",
  );
  assertCoordinatorFailure(
    api.createFormDiagnosticMatrixCoordinator(84, BATCH_ID.toUpperCase()),
    "invalid-batch-id",
    "uppercase UUID is rejected without normalization",
  );

  const neutralComplete = validCoordinator(3, ["record-a", "record-b", "record-c"]);
  assertEqual(
    api.validateFormDiagnosticMatrixCoordinator(neutralComplete, 84).ok,
    true,
    "neutral coordinator validation accepts a complete batch",
  );
  assertEqual(
    api.validateFormDiagnosticMatrixCoordinator(neutralComplete, 84, true).ok,
    true,
    "complete-required validation accepts slot three",
  );
  assertCoordinatorFailure(
    api.validateFormDiagnosticMatrixCoordinator(validCoordinator(), 84, true),
    "coordinator-incomplete",
    "complete-required validation rejects an incomplete batch",
  );
  assertCoordinatorFailure(
    api.validateFormDiagnosticMatrixCoordinator(null, 84),
    "coordinator-missing",
    "missing coordinator has a fixed result",
  );
  assertCoordinatorFailure(
    api.validateFormDiagnosticMatrixCoordinator(validCoordinator(0, [], 83), 84),
    "coordinator-stale",
    "old app coordinator is stale",
  );

  const extraCoordinatorKey = validCoordinator();
  extraCoordinatorKey.extra = true;
  assertCoordinatorFailure(
    api.validateFormDiagnosticMatrixCoordinator(extraCoordinatorKey, 84),
    "coordinator-invalid",
    "extra coordinator key is invalid",
  );

  const duplicateCoordinatorIds = validCoordinator(2, ["same-record", "same-record"]);
  assertCoordinatorFailure(
    api.validateFormDiagnosticMatrixCoordinator(duplicateCoordinatorIds, 84),
    "coordinator-invalid",
    "duplicate coordinator IDs are invalid",
  );
  assertEqual(
    api.validateFormDiagnosticMatrixCoordinator(validCoordinator(1, ["r".repeat(128)]), 84).ok,
    true,
    "128-character coordinator record ID is accepted",
  );
  assertCoordinatorFailure(
    api.validateFormDiagnosticMatrixCoordinator(validCoordinator(1, ["r".repeat(129)]), 84),
    "coordinator-invalid",
    "129-character coordinator record ID is rejected",
  );

  let coordinatorGetterReads = 0;
  const poisonedCoordinator = validCoordinator();
  Object.defineProperty(poisonedCoordinator, "batchId", {
    enumerable: true,
    configurable: true,
    get() {
      coordinatorGetterReads++;
      throw new Error("coordinator getter must not run");
    },
  });
  assertCoordinatorFailure(
    api.validateFormDiagnosticMatrixCoordinator(poisonedCoordinator, 84),
    "coordinator-invalid",
    "coordinator accessor is rejected",
  );
  assertEqual(coordinatorGetterReads, 0, "coordinator getter is never invoked");

  deepEqual(
    api.allocateFormDiagnosticBatchId(null, null, [], []),
    { ok: false, code: "crypto-unavailable", batchId: null },
    "missing Web Crypto fails closed",
  );
  deepEqual(
    api.allocateFormDiagnosticBatchId({ randomUUID: () => BATCH_ID.toUpperCase() }, null, [], []),
    { ok: false, code: "invalid-batch-id", batchId: null },
    "uppercase generated UUID is rejected rather than normalized",
  );

  const fallbackAllocation = api.allocateFormDiagnosticBatchId(
    {
      getRandomValues(bytes) {
        bytes.set([
          0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x06, 0x77, 0x08, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
          0xff,
        ]);
        return bytes;
      },
    },
    null,
    [],
    [],
  );
  deepEqual(
    fallbackAllocation,
    {
      ok: true,
      code: null,
      batchId: "00112233-4455-4677-8899-aabbccddeeff",
    },
    "getRandomValues fallback applies RFC-4122 v4 and variant bits",
  );

  const collisionId = "22222222-2222-4222-8222-222222222222";
  const uniqueId = "33333333-3333-4333-8333-333333333333";
  const collisionRecord = validRecord("collision-record");
  collisionRecord.formDiagnosticMatrix = {
    version: 1,
    batchId: collisionId,
    slot: "side",
  };
  let collisionCalls = 0;
  deepEqual(
    api.allocateFormDiagnosticBatchId(
      {
        randomUUID() {
          collisionCalls++;
          return collisionCalls === 1 ? collisionId : uniqueId;
        },
      },
      null,
      [collisionRecord],
      [],
    ),
    { ok: true, code: null, batchId: uniqueId },
    "one collision retries and returns the second unique UUID",
  );
  assertEqual(collisionCalls, 2, "collision allocator makes two calls");

  const savedCollisionId = "44444444-4444-4444-8444-444444444444";
  const trashCollisionId = "55555555-5555-4555-8555-555555555555";
  const savedCollision = validRecord("saved-collision");
  savedCollision.formDiagnosticMatrix = {
    version: 1,
    batchId: savedCollisionId,
    slot: "oblique",
  };
  const trashCollision = {
    id: "trash-entry",
    type: "formAnalysis",
    data: {
      formDiagnosticMatrix: {
        version: 1,
        batchId: trashCollisionId,
        slot: "normal_range",
      },
    },
  };
  const collisionCandidates = [BATCH_ID, savedCollisionId, trashCollisionId];
  let exhaustedCalls = 0;
  const sourceCoordinator = validCoordinator();
  const sourceRecords = [savedCollision];
  const sourceTrash = [trashCollision];
  const sourceCoordinatorBefore = cloneFixture(sourceCoordinator);
  const sourceRecordsBefore = cloneFixture(sourceRecords);
  const sourceTrashBefore = cloneFixture(sourceTrash);
  deepEqual(
    api.allocateFormDiagnosticBatchId(
      {
        randomUUID() {
          return collisionCandidates[exhaustedCalls++];
        },
      },
      sourceCoordinator,
      sourceRecords,
      sourceTrash,
    ),
    { ok: false, code: "batch-id-collision", batchId: null },
    "three valid collisions fail after exactly three attempts",
  );
  assertEqual(exhaustedCalls, 3, "allocator attempts at most three UUIDs");
  deepEqual(sourceCoordinator, sourceCoordinatorBefore, "allocator keeps coordinator immutable");
  deepEqual(sourceRecords, sourceRecordsBefore, "allocator keeps records immutable");
  deepEqual(sourceTrash, sourceTrashBefore, "allocator keeps trash immutable");
  assert(
    !String(api.allocateFormDiagnosticBatchId).includes("Math.random"),
    "allocator has no Math.random fallback",
  );
  assert(
    !String(api.allocateFormDiagnosticBatchId).includes("uid("),
    "allocator has no uid fallback",
  );
  ```

  Run the API/coordinator checkpoint before adding the slot test:

  ```powershell
  node tools/check-form-diagnostics.js
  ```

  Expected: exit `0` with `Form diagnostic checks OK`. This is the required
  API-scaffold GREEN before the Step 6 slot RED.

- [ ] **Step 6: Add the valid first-slot planner RED**

```js
const created = api.createFormDiagnosticMatrixCoordinator(
  84,
  "11111111-1111-4111-8111-111111111111",
);
const sourceRecord = validRecord("live");
assertEqual(created.ok, true, "coordinator creation succeeds");
const planned = api.planFormDiagnosticMatrixRecord(sourceRecord, created.coordinator, 84);
assertEqual(planned.ok, true, "eligible live record advances the matrix");
assertEqual(planned.record.formDiagnosticMatrix.slot, "side", "first fixed slot");
assertEqual(planned.coordinator.nextSlot, 1, "coordinator advances one slot");
assertEqual(planned.coordinator.recordIds[0], planned.record.id, "exact record ID selected");
assertEqual(
  Object.hasOwn(sourceRecord, "formDiagnosticMatrix"),
  false,
  "source record is unchanged",
);
```

- [ ] **Step 7: Run the planner RED**

  Run: `node tools/check-form-diagnostics.js`

  Expected: exit `1` with `eligible live record advances the matrix: expected true, got false`.

- [ ] **Step 8: Implement exact record validation and fixed-slot planning**

  Require own-property schema/mode/app version, exactly six shots/features/retained receipts, `1..32` receipts with the contiguous ID set `form-receipt-1..N`, complete seven-key fires, exact two-axis dispositions/reasons, exact `shotCreated`, feature correlation, zero overflow/five counters, and `receiptDesynchronized === false`. Accept a reordered receipt array when its ID set is complete; projection later sorts it. A planner input record normally has no `formDiagnosticMatrix`; the planner adds a copied `{ version: 1, batchId, slot }` only after validation. Replay, stale, OFF/missing diagnostic markers, malformed, overflowed, unresolved-retained, non-six, and complete-coordinator inputs fail without mutating either source.

  Add the following helpers before the record API stubs, then replace
  `validateFormDiagnosticRecord` and `planFormDiagnosticMatrixRecord` with the
  implementations at the end of this block:

  ```js
  const FORM_DIAGNOSTIC_FIRE_KEYS = Object.freeze([
    "anchorFloor",
    "anchorEnter",
    "releaseSpeed",
    "evidenceAgeMs",
    "evidenceStrength",
    "departDelta",
    "fireEvidence",
  ]);
  const FORM_DIAGNOSTIC_COUNTER_KEYS = Object.freeze([
    "supersededActive",
    "missingActive",
    "identityMismatch",
    "invalidTransition",
    "sequenceExhausted",
  ]);
  const FORM_DIAGNOSTIC_CANCEL_REASONS = new Set([
    "anchor-return",
    "nb2-drift",
    "nb2-unobserved",
    "no-depart",
  ]);
  const FORM_DIAGNOSTIC_UNRESOLVED_REASONS = new Set([
    "geometry-reset",
    "workflow-save",
    "workflow-close",
    "replay-eos",
    "superseded-fire",
  ]);
  const FORM_DIAGNOSTIC_RECEIPT_ID = /^form-receipt-([1-9][0-9]{0,5})$/;

  function formDiagnosticRecordResultFailure(code) {
    return { ok: false, code, retainedReceiptIds: null };
  }

  function formDiagnosticInspectReceipt(receipt) {
    const id = formDiagnosticReadOwnData(receipt, "id");
    const idMatch = typeof id === "string" ? FORM_DIAGNOSTIC_RECEIPT_ID.exec(id) : null;
    const shotCreated = formDiagnosticReadOwnData(receipt, "shotCreated");
    const userDisposition = formDiagnosticReadOwnData(receipt, "userDisposition");
    const detectorDisposition = formDiagnosticReadOwnData(receipt, "detectorDisposition");
    const cancelReason = formDiagnosticReadOwnData(receipt, "cancelReason");
    const unresolvedReason = formDiagnosticReadOwnData(receipt, "unresolvedReason");
    const sourceFire = formDiagnosticReadOwnData(receipt, "fire");

    if (
      !idMatch ||
      typeof shotCreated !== "boolean" ||
      !formDiagnosticHasExactOwnDataKeys(sourceFire, FORM_DIAGNOSTIC_FIRE_KEYS)
    ) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }

    const fire = copyFormReleaseFireSnapshot(sourceFire);
    if (!fire) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }

    let detectorOutcome;
    if (detectorDisposition === "pending") {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }
    if (detectorDisposition === "confirmed" && cancelReason === null && unresolvedReason === null) {
      detectorOutcome = "confirmed";
    } else if (
      detectorDisposition === "auto-canceled" &&
      FORM_DIAGNOSTIC_CANCEL_REASONS.has(cancelReason) &&
      unresolvedReason === null
    ) {
      detectorOutcome = "auto-canceled";
    } else if (
      detectorDisposition === "unresolved" &&
      cancelReason === null &&
      FORM_DIAGNOSTIC_UNRESOLVED_REASONS.has(unresolvedReason)
    ) {
      detectorOutcome = "unresolved";
    } else {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }

    let outcome;
    if (userDisposition === "not-created" && shotCreated === false) {
      outcome = "summary-failed";
    } else if (userDisposition === "manual-removed" && shotCreated === true) {
      outcome = "manual-removed";
    } else if (userDisposition === "present" && shotCreated === true) {
      if (detectorOutcome === "confirmed") outcome = "retained";
      else if (detectorOutcome === "auto-canceled") outcome = "auto-canceled";
      else {
        return {
          ok: false,
          code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE,
        };
      }
    } else {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }

    return {
      ok: true,
      code: null,
      receipt: {
        id,
        numericId: Number(idMatch[1]),
        outcome,
        detectorOutcome,
        cancelReason,
        unresolvedReason,
        fire,
      },
    };
  }

  function formDiagnosticInspectRecord(record, appVer) {
    if (!Number.isSafeInteger(appVer) || appVer <= 0) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.INVALID_APP_VERSION };
    }
    if (!record || typeof record !== "object") {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }

    const diagnosticVersion = formDiagnosticReadOwnData(record, "formDiagnosticVersion");
    const captureMode = formDiagnosticReadOwnData(record, "captureMode");
    const recordAppVer = formDiagnosticReadOwnData(record, "appVer");
    if (diagnosticVersion === FORM_DIAGNOSTIC_MISSING || captureMode === FORM_DIAGNOSTIC_MISSING) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }
    if (diagnosticVersion !== 1 || captureMode !== "live") {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }
    if (!Number.isSafeInteger(recordAppVer) || recordAppVer <= 0) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }
    if (recordAppVer !== appVer) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }

    const recordId = formDiagnosticReadOwnData(record, "id");
    const shots = formDiagnosticReadOwnData(record, "shots");
    const sourceFeatures = formDiagnosticReadOwnData(record, "features");
    const formPhaseDiag = formDiagnosticReadOwnData(record, "formPhaseDiag");
    if (!formDiagnosticRecordIdIsValid(recordId)) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }
    if (!Number.isSafeInteger(shots) || shots < 0) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }
    if (shots !== 6) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }

    const features = formDiagnosticReadOwnArray(sourceFeatures);
    if (!features) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }
    if (features.length !== 6) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }
    if (
      formPhaseDiag === FORM_DIAGNOSTIC_MISSING ||
      !formPhaseDiag ||
      typeof formPhaseDiag !== "object"
    ) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }

    const overflow = formDiagnosticReadOwnData(formPhaseDiag, "receiptOverflow");
    const counters = formDiagnosticReadOwnData(formPhaseDiag, "receiptInvariantCounts");
    const desynchronized = formDiagnosticReadOwnData(formPhaseDiag, "receiptDesynchronized");
    const sourceReceipts = formDiagnosticReadOwnData(formPhaseDiag, "releaseReceipts");

    if (!Number.isSafeInteger(overflow) || overflow < 0) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }
    if (overflow !== 0) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }
    if (!formDiagnosticHasExactOwnDataKeys(counters, FORM_DIAGNOSTIC_COUNTER_KEYS)) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }
    let hasInvariantFailure = false;
    for (const key of FORM_DIAGNOSTIC_COUNTER_KEYS) {
      const value = formDiagnosticReadOwnData(counters, key);
      if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
        return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
      }
      if (value !== 0) hasInvariantFailure = true;
    }
    if (hasInvariantFailure) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }
    if (typeof desynchronized !== "boolean") {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }
    if (desynchronized) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }

    const receiptValues = formDiagnosticReadOwnArray(sourceReceipts);
    if (!receiptValues) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }
    if (receiptValues.length < 1 || receiptValues.length > 32) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }

    const receipts = [];
    for (const sourceReceipt of receiptValues) {
      const inspectedReceipt = formDiagnosticInspectReceipt(sourceReceipt);
      if (!inspectedReceipt.ok) return inspectedReceipt;
      receipts.push(inspectedReceipt.receipt);
    }
    receipts.sort((left, right) => left.numericId - right.numericId);
    if (
      new Set(receipts.map((receipt) => receipt.id)).size !== receipts.length ||
      !receipts.every((receipt, index) => receipt.numericId === index + 1)
    ) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }

    const retainedReceiptIds = receipts
      .filter((receipt) => receipt.outcome === "retained")
      .map((receipt) => receipt.id);
    if (retainedReceiptIds.length !== 6) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE };
    }

    const featureReceiptIds = [];
    for (const feature of features) {
      const receiptId = formDiagnosticReadOwnData(feature, "receiptId");
      if (typeof receiptId !== "string") {
        return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
      }
      featureReceiptIds.push(receiptId);
    }
    if (
      new Set(featureReceiptIds).size !== featureReceiptIds.length ||
      featureReceiptIds.some((receiptId) => !retainedReceiptIds.includes(receiptId)) ||
      retainedReceiptIds.some((receiptId) => !featureReceiptIds.includes(receiptId))
    ) {
      return { ok: false, code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID };
    }

    return {
      ok: true,
      code: null,
      recordId,
      receipts,
      retainedReceiptIds: retainedReceiptIds.slice(),
    };
  }

  function validateFormDiagnosticRecord(record, appVer) {
    const inspected = formDiagnosticInspectRecord(record, appVer);
    return inspected.ok
      ? {
          ok: true,
          code: null,
          retainedReceiptIds: inspected.retainedReceiptIds.slice(),
        }
      : formDiagnosticRecordResultFailure(inspected.code);
  }

  function formDiagnosticPlanningFailure(code) {
    return { ok: false, code, record: null, coordinator: null };
  }

  function formDiagnosticCopyRecordWithMarker(record, marker) {
    try {
      const copied = Object.create(
        Object.getPrototypeOf(record),
        Object.getOwnPropertyDescriptors(record),
      );
      Object.defineProperty(copied, "formDiagnosticMatrix", {
        value: marker,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      return copied;
    } catch (_) {
      return null;
    }
  }

  function planFormDiagnosticMatrixRecord(record, coordinator, appVer) {
    const checkedCoordinator = validateFormDiagnosticMatrixCoordinator(coordinator, appVer);
    if (!checkedCoordinator.ok) {
      return formDiagnosticPlanningFailure(checkedCoordinator.code);
    }
    if (checkedCoordinator.coordinator.nextSlot === FORM_DIAGNOSTIC_SLOTS.length) {
      return formDiagnosticPlanningFailure(FORM_DIAGNOSTIC_RESULT_CODES.COORDINATOR_COMPLETE);
    }

    const inspectedRecord = formDiagnosticInspectRecord(record, appVer);
    if (!inspectedRecord.ok) {
      return formDiagnosticPlanningFailure(inspectedRecord.code);
    }
    if (
      Object.hasOwn(record, "formDiagnosticMatrix") ||
      checkedCoordinator.coordinator.recordIds.includes(inspectedRecord.recordId)
    ) {
      return formDiagnosticPlanningFailure(FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INELIGIBLE);
    }

    const marker = {
      version: 1,
      batchId: checkedCoordinator.coordinator.batchId,
      slot: FORM_DIAGNOSTIC_SLOTS[checkedCoordinator.coordinator.nextSlot],
    };
    const plannedRecord = formDiagnosticCopyRecordWithMarker(record, marker);
    if (!plannedRecord) {
      return formDiagnosticPlanningFailure(FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID);
    }

    return {
      ok: true,
      code: null,
      record: plannedRecord,
      coordinator: {
        version: 1,
        batchId: checkedCoordinator.coordinator.batchId,
        appVer: checkedCoordinator.coordinator.appVer,
        nextSlot: checkedCoordinator.coordinator.nextSlot + 1,
        recordIds: checkedCoordinator.coordinator.recordIds.concat(inspectedRecord.recordId),
        invalidated: false,
      },
    };
  }
  ```

- [ ] **Step 9: Implement and test copy-only invalidation results**

  `invalidateFormDiagnosticMatrixForRecord` first uses the explicit coordinator validator, then returns `{ ok: true, code: null, coordinator, changed: true }` only for one exact selected ID, with copied `recordIds` and `invalidated: true`. A valid unrelated, absent, or validator-rejected imported coordinator returns the original value with `{ ok: true, code: null, changed: false }`; it is not repaired and remains export-invalid. Invalid record-ID input fails with `record-invalid`. Task 6 must consume this result rather than assuming a bare coordinator.

  Replace the invalidation stub with:

  ```js
  function invalidateFormDiagnosticMatrixForRecord(coordinator, recordId, appVer) {
    if (!formDiagnosticRecordIdIsValid(recordId)) {
      return {
        ok: false,
        code: FORM_DIAGNOSTIC_RESULT_CODES.RECORD_INVALID,
        coordinator: null,
        changed: false,
      };
    }

    const checked = validateFormDiagnosticMatrixCoordinator(coordinator, appVer);
    if (!checked.ok) {
      return { ok: true, code: null, coordinator, changed: false };
    }
    if (!checked.coordinator.recordIds.includes(recordId)) {
      return { ok: true, code: null, coordinator, changed: false };
    }

    return {
      ok: true,
      code: null,
      coordinator: {
        version: 1,
        batchId: checked.coordinator.batchId,
        appVer: checked.coordinator.appVer,
        nextSlot: checked.coordinator.nextSlot,
        recordIds: checked.coordinator.recordIds.slice(),
        invalidated: true,
      },
      changed: true,
    };
  }
  ```

  Insert these tests before the final harness log:

  ```js
  const selectedCoordinator = validCoordinator(3, ["selected-a", "selected-b", "selected-c"]);
  const selectedInvalidation = api.invalidateFormDiagnosticMatrixForRecord(
    selectedCoordinator,
    "selected-b",
    84,
  );
  assertEqual(selectedInvalidation.ok, true, "selected invalidation succeeds");
  assertEqual(selectedInvalidation.code, null, "selected invalidation code is null");
  assertEqual(selectedInvalidation.changed, true, "selected invalidation changes state");
  assertEqual(
    selectedInvalidation.coordinator.invalidated,
    true,
    "selected invalidation latches invalidated",
  );
  assert(
    selectedInvalidation.coordinator !== selectedCoordinator,
    "selected invalidation returns a new coordinator",
  );
  assert(
    selectedInvalidation.coordinator.recordIds !== selectedCoordinator.recordIds,
    "selected invalidation copies recordIds",
  );
  assertEqual(
    selectedCoordinator.invalidated,
    false,
    "selected invalidation leaves source unchanged",
  );

  const unrelatedInvalidation = api.invalidateFormDiagnosticMatrixForRecord(
    selectedCoordinator,
    "not-selected",
    84,
  );
  deepEqual(
    unrelatedInvalidation,
    {
      ok: true,
      code: null,
      coordinator: selectedCoordinator,
      changed: false,
    },
    "unrelated ID is an unchanged success",
  );
  assert(
    unrelatedInvalidation.coordinator === selectedCoordinator,
    "unrelated no-op preserves the original reference",
  );

  deepEqual(
    api.invalidateFormDiagnosticMatrixForRecord(null, "selected-b", 84),
    { ok: true, code: null, coordinator: null, changed: false },
    "missing coordinator does not block ordinary deletion",
  );

  const malformedImportedCoordinator = validCoordinator();
  malformedImportedCoordinator.extra = "imported";
  const malformedInvalidation = api.invalidateFormDiagnosticMatrixForRecord(
    malformedImportedCoordinator,
    "selected-b",
    84,
  );
  assertEqual(malformedInvalidation.ok, true, "malformed import is a no-op success");
  assertEqual(malformedInvalidation.changed, false, "malformed import is not repaired");
  assert(
    malformedInvalidation.coordinator === malformedImportedCoordinator,
    "malformed no-op preserves the imported value",
  );

  deepEqual(
    api.invalidateFormDiagnosticMatrixForRecord(selectedCoordinator, "", 84),
    {
      ok: false,
      code: "record-invalid",
      coordinator: null,
      changed: false,
    },
    "invalid deletion record ID has the fixed null failure shape",
  );
  ```

- [ ] **Step 10: Complete ineligible, reorder, and immutability coverage**

  Add the remaining table-driven checks with this concrete harness code. Each
  case must assert the exact fixed result shape, and every returned nested value
  is mutated after the call to prove the source is isolated.

  ```js
  const recordFailureCases = [
    ["replay", { captureMode: "replay" }, "record-ineligible"],
    [
      "truthy desync",
      { formPhaseDiag: { ...validRecord().formPhaseDiag, receiptDesynchronized: "false" } },
      "record-invalid",
    ],
    [
      "positive overflow",
      { formPhaseDiag: { ...validRecord().formPhaseDiag, receiptOverflow: 1 } },
      "record-ineligible",
    ],
    [
      "unresolved visible",
      {
        formPhaseDiag: {
          ...validRecord().formPhaseDiag,
          releaseReceipts: [
            validReceipt(1, {
              detectorDisposition: "unresolved",
              unresolvedReason: "workflow-save",
            }),
          ],
        },
      },
      "record-ineligible",
    ],
  ];
  for (const [label, overrides, expectedCode] of recordFailureCases) {
    const source = { ...validRecord(), ...overrides };
    const result = api.validateFormDiagnosticRecord(source, 84);
    assertEqual(result.ok, false, `${label} rejects`);
    assertEqual(result.code, expectedCode, `${label} code`);
    assertEqual(result.retainedReceiptIds, null, `${label} null payload`);
  }
  const reordered = validRecord();
  reordered.formPhaseDiag.releaseReceipts.reverse();
  assertEqual(
    api.validateFormDiagnosticRecord(reordered, 84).ok,
    true,
    "receipt array reorder is accepted",
  );
  const planned = api.planFormDiagnosticMatrixRecord(validRecord(), validCoordinator(0), 84);
  assertEqual(planned.ok, true, "valid first slot still plans");
  const returnedIds = planned.coordinator.recordIds;
  returnedIds.push("mutated");
  assertEqual(planned.coordinator.recordIds.length, 1, "planner result owns recordIds");
  ```

- [ ] **Step 11: Run focused and repository GREEN checks**

  Run:

  ```powershell
  node tools/check-form-diagnostics.js
  npm run check:form
  npm run check:storage
  npm run check:app
  npm run lint -- --quiet
  ```

  Expected: every command exits `0`; diagnostics ends in `Form diagnostic checks OK`.

- [ ] **Step 12: Format, document, and commit Task 4**

  Update the progress ledger, then run:

  ```powershell
  npx prettier --check package.json tools/check-form-diagnostics.js docs/codex/codex-progress.md
  git diff --check
  git add scripts/46-form-core.js tools/check-form-diagnostics.js package.json docs/codex/codex-progress.md
  git diff --check --cached
  git commit -m "feat(form): validate diagnostic matrices"
  ```

  Expected: all checks exit `0`; the commit uses the exact subject above.

---

### Task 5: Build the fail-closed bounded privacy projection

**Files:**

- Modify: scripts/46-form-core.js:diagnostic matrix helpers from Task 4
- Modify: tools/check-form-diagnostics.js:matrix/export sections
- Modify: docs/codex/codex-progress.md:end

**Interfaces:**

- Consumes: `formAnalyses`, one complete coordinator, current `appVer`, and an optional injected `TextEncoder` constructor used only by tests.
- Produces: `buildFormDiagnosticExport(formAnalyses, coordinator, appVer, TextEncoderCtor = globalThis.TextEncoder) -> { ok, code, payload, json, byteLength }`, `formDiagnosticUtf8ByteLength(text, TextEncoderCtor)`, and `isFormDiagnosticJsonSizeAllowed(text, TextEncoderCtor)`.
- Every failure is exactly `{ ok: false, code, payload: null, json: null, byteLength: null }`, with exactly `coordinator-missing`, `coordinator-invalid`, `coordinator-stale`, `coordinator-incomplete`, `source-missing`, `source-ambiguous`, `source-invalid`, `output-too-large`, or `encoding-unavailable`. Success uses `code: null`; Task-4 record failures are collapsed to `source-invalid` at this export boundary.

```json
{
  "format": "archery-note-form-diagnostics",
  "schemaVersion": 1,
  "appVersion": 84,
  "matrix": "field-3x6",
  "runs": []
}
```

- [ ] **Step 1: Add a fully synthetic shuffled 3×6 fixture and projection RED**

  Build three copied Task-4 records with fixed slots and shuffled `formAnalyses` order. Mark the fixture `synthetic-only-no-real-user-or-device-data`; do not copy practice data. Add:

  First extend the existing `new Function` return object in
  `tools/check-form-diagnostics.js`; the conditional entries keep the
  unchanged source loadable and make the first RED deterministic:

  ```js
  buildFormDiagnosticExport:
    typeof buildFormDiagnosticExport === "function" ? buildFormDiagnosticExport : null,
  formDiagnosticUtf8ByteLength:
    typeof formDiagnosticUtf8ByteLength === "function" ? formDiagnosticUtf8ByteLength : null,
  isFormDiagnosticJsonSizeAllowed:
    typeof isFormDiagnosticJsonSizeAllowed === "function"
      ? isFormDiagnosticJsonSizeAllowed
      : null,
  ```

```js
function markedRecord(id, slot) {
  const record = validRecord(id, "live");
  record.formDiagnosticMatrix = { version: 1, batchId: BATCH_ID, slot };
  return record;
}

const sideRecord = markedRecord("diagnostic-side", "side");
const obliqueRecord = markedRecord("diagnostic-oblique", "oblique");
const normalRecord = markedRecord("diagnostic-normal", "normal_range");
const completedCoordinator = validCoordinator(3, [
  sideRecord.id,
  obliqueRecord.id,
  normalRecord.id,
]);
const shuffledValidRecords = [normalRecord, sideRecord, obliqueRecord];
const syntheticFixtureLabel = "synthetic-only-no-real-user-or-device-data";
assertEqual(
  shuffledValidRecords.every((record) => record.id.startsWith("diagnostic-")),
  true,
  syntheticFixtureLabel,
);

const result = api.buildFormDiagnosticExport(shuffledValidRecords, completedCoordinator, 84);
assertEqual(result.ok, true, "valid 3x6 diagnostics export is accepted");
assertEqual(result.payload.runs.length, 3, "export has exactly three runs");
assertEqual(result.json.endsWith("\n"), true, "pretty JSON ends with one newline");
```

- [ ] **Step 2: Run the exporter RED**

  Run: `node tools/check-form-diagnostics.js`

  Expected: exit `1` because `buildFormDiagnosticExport` is missing or rejects the valid fixture.

- [ ] **Step 3: Add source-selection, projection, and poison RED tables**

  Add these assertions before any exporter implementation. They define the complete source-selection boundary and make array-position fallback impossible to hide behind a green happy path.

  ```js
  function expectExportFailure(inputRecords, inputCoordinator, code, label) {
    const actual = api.buildFormDiagnosticExport(inputRecords, inputCoordinator, 84);
    deepEqual(actual, { ok: false, code, payload: null, json: null, byteLength: null }, label);
  }

  expectExportFailure([], completedCoordinator, "source-missing", "empty source refuses");
  expectExportFailure(
    [sideRecord, obliqueRecord, normalRecord, { ...sideRecord }],
    completedCoordinator,
    "source-ambiguous",
    "duplicate selected ID refuses",
  );
  expectExportFailure(
    [sideRecord, obliqueRecord],
    completedCoordinator,
    "source-missing",
    "missing selected ID refuses",
  );
  expectExportFailure(
    shuffledValidRecords,
    { ...completedCoordinator, recordIds: [normalRecord.id, sideRecord.id, obliqueRecord.id] },
    "source-invalid",
    "marker-slot substitution refuses",
  );
  expectExportFailure(
    shuffledValidRecords,
    { ...completedCoordinator, nextSlot: 2, recordIds: completedCoordinator.recordIds.slice(0, 2) },
    "coordinator-incomplete",
    "incomplete coordinator refuses",
  );
  expectExportFailure(
    shuffledValidRecords,
    { ...completedCoordinator, appVer: 83 },
    "coordinator-stale",
    "stale coordinator refuses",
  );

  const poison = markedRecord("diagnostic-poison", "side");
  Object.defineProperty(poison, "secretPath", {
    enumerable: true,
    get() {
      throw new Error("excluded source getter was read");
    },
  });
  poison.notes = "SENTINEL_NOT_ALLOWED";
  poison.features[0].landmarks = "SENTINEL_NOT_ALLOWED";
  const poisonCoordinator = validCoordinator(3, [poison.id, obliqueRecord.id, normalRecord.id]);
  expectExportFailure(
    [poison, obliqueRecord, normalRecord],
    poisonCoordinator,
    "source-invalid",
    "poison source refuses without reading excluded getter",
  );

  const malformedFire = markedRecord("diagnostic-fire", "side");
  malformedFire.formPhaseDiag.releaseReceipts[0].fire = {
    anchorFloor: null,
    anchorEnter: 9,
    releaseSpeed: 7,
    evidenceAgeMs: null,
    evidenceStrength: null,
    departDelta: 0,
    fireEvidence: "unknown",
  };
  expectExportFailure(
    [malformedFire, obliqueRecord, normalRecord],
    validCoordinator(3, [malformedFire.id, obliqueRecord.id, normalRecord.id]),
    "source-invalid",
    "out-of-range fire refuses",
  );

  const accepted = api.buildFormDiagnosticExport(shuffledValidRecords, completedCoordinator, 84);
  assertEqual(accepted.payload.format, "archery-note-form-diagnostics", "format");
  assertEqual(accepted.payload.schemaVersion, 1, "schema version");
  assertEqual(accepted.payload.appVersion, 84, "app version");
  assertEqual(accepted.payload.matrix, "field-3x6", "matrix name");
  deepEqual(
    accepted.payload.runs.map((run) => [run.runOrdinal, run.condition, run.retainedShotCount]),
    [
      [1, "side", 6],
      [2, "oblique", 6],
      [3, "normal_range", 6],
    ],
    "fixed run order",
  );
  accepted.payload.runs.forEach((run) => {
    assertEqual(run.receipts.length, 6, `${run.condition} receipt count`);
    run.receipts.forEach((receipt, index) => {
      assertEqual(receipt.receiptOrdinal, index + 1, `${run.condition} ordinal`);
      deepEqual(
        Object.keys(receipt),
        [
          "receiptOrdinal",
          "outcome",
          "detectorOutcome",
          "cancelReason",
          "unresolvedReason",
          "fire",
        ],
        "receipt allowlist",
      );
      deepEqual(
        Object.keys(receipt.fire),
        [
          "anchorFloor",
          "anchorEnter",
          "releaseSpeed",
          "evidenceAgeMs",
          "evidenceStrength",
          "departDelta",
          "fireEvidence",
        ],
        "fire allowlist",
      );
    });
  });
  assertEqual(accepted.json.includes("diagnostic-side"), false, "runtime IDs excluded");
  assertEqual(accepted.json.includes("SENTINEL_NOT_ALLOWED"), false, "sentinels excluded");
  assertEqual(api.formDiagnosticUtf8ByteLength("射"), 3, "UTF-8 helper counts bytes");
  assertEqual(api.isFormDiagnosticJsonSizeAllowed("x".repeat(65536)), true, "65536 bytes accepted");
  assertEqual(api.isFormDiagnosticJsonSizeAllowed("x".repeat(65537)), false, "65537 bytes refused");
  const exact65536Encoder = class {
    encode() {
      return { byteLength: 65536 };
    }
  };
  const exact65537Encoder = class {
    encode() {
      return { byteLength: 65537 };
    }
  };
  assertEqual(
    api.buildFormDiagnosticExport(shuffledValidRecords, completedCoordinator, 84, exact65536Encoder)
      .ok,
    true,
    "builder accepts exact 65536 bytes",
  );
  deepEqual(
    api.buildFormDiagnosticExport(
      shuffledValidRecords,
      completedCoordinator,
      84,
      exact65537Encoder,
    ),
    { ok: false, code: "output-too-large", payload: null, json: null, byteLength: null },
    "builder refuses exact 65537 bytes",
  );
  class ThrowingEncoder {
    encode() {
      throw new Error("encoder unavailable");
    }
  }
  deepEqual(
    api.buildFormDiagnosticExport(shuffledValidRecords, completedCoordinator, 84, ThrowingEncoder),
    { ok: false, code: "encoding-unavailable", payload: null, json: null, byteLength: null },
    "builder fails closed when encoding is unavailable",
  );
  ```

- [ ] **Step 4: Run the source-selection RED**

  Run: `node tools/check-form-diagnostics.js`

  Expected: exit `1` at the first `buildFormDiagnosticExport` call. The
  assertions in Step 3 are intentionally present before implementation and
  must not be moved below the production code.

- [ ] **Step 5: Implement exact coordinator selection and literal projection**

  Insert this complete block immediately after the Task-4 matrix helpers in
  `scripts/46-form-core.js`. It resolves each coordinator ID exactly once,
  validates the marker and record through Task-4 contracts, derives the
  two-axis terminal outcome, sorts receipts by numeric ID suffix, and constructs
  fresh literals. No spread operation receives a database, record, receipt,
  feature, settings, trash, or unknown object.

  ```js
  const FORM_DIAGNOSTIC_EXPORT_MAX_BYTES = 65536;
  const FORM_DIAGNOSTIC_FIRE_KEYS = Object.freeze([
    "anchorFloor",
    "anchorEnter",
    "releaseSpeed",
    "evidenceAgeMs",
    "evidenceStrength",
    "departDelta",
    "fireEvidence",
  ]);
  const FORM_DIAGNOSTIC_CANCEL_REASONS = Object.freeze([
    "anchor-return",
    "nb2-drift",
    "nb2-unobserved",
    "no-depart",
  ]);
  const FORM_DIAGNOSTIC_UNRESOLVED_REASONS = Object.freeze([
    "geometry-reset",
    "workflow-save",
    "workflow-close",
    "replay-eos",
    "superseded-fire",
  ]);

  function formDiagnosticExportFailure(code) {
    return { ok: false, code, payload: null, json: null, byteLength: null };
  }

  function formDiagnosticExportSources(formAnalyses, coordinator, appVer) {
    const coordinatorResult = validateFormDiagnosticMatrixCoordinator(coordinator, appVer, true);
    if (!coordinatorResult.ok) {
      return formDiagnosticExportFailure(
        coordinatorResult.code === "coordinator-complete"
          ? "coordinator-invalid"
          : coordinatorResult.code,
      );
    }
    if (!Array.isArray(formAnalyses)) return formDiagnosticExportFailure("source-invalid");
    const selected = [];
    for (const recordId of coordinator.recordIds) {
      const matches = formAnalyses.filter((record) => record && record.id === recordId);
      if (matches.length === 0) return formDiagnosticExportFailure("source-missing");
      if (matches.length !== 1) return formDiagnosticExportFailure("source-ambiguous");
      selected.push(matches[0]);
    }
    return { ok: true, code: null, selected, coordinator };
  }

  function formDiagnosticNumericSuffix(id) {
    const match = /^form-receipt-([1-9][0-9]{0,5})$/.exec(id);
    return match ? Number(match[1]) : null;
  }

  function formDiagnosticNumberInRange(value, minimum, maximum, nullable = false) {
    if (nullable && value === null) return true;
    return Number.isFinite(value) && value >= minimum && value <= maximum;
  }

  function formDiagnosticRound(value) {
    return value === null ? null : Number(value.toFixed(3));
  }

  function formDiagnosticDeriveOutcome(receipt) {
    if (receipt.userDisposition === "not-created")
      return receipt.shotCreated === false ? "summary-failed" : null;
    if (receipt.userDisposition === "manual-removed")
      return receipt.shotCreated === true ? "manual-removed" : null;
    if (receipt.userDisposition !== "present" || receipt.shotCreated !== true) return null;
    if (receipt.detectorDisposition === "confirmed") return "retained";
    if (receipt.detectorDisposition === "auto-canceled") return "auto-canceled";
    if (receipt.detectorDisposition === "unresolved") return "unresolved";
    return null;
  }

  function formDiagnosticProjectFire(fire) {
    if (!fire || typeof fire !== "object") return null;
    if (Object.keys(fire).some((key) => !FORM_DIAGNOSTIC_FIRE_KEYS.includes(key))) return null;
    if (!formDiagnosticNumberInRange(fire.anchorFloor, 0, 1.3, true)) return null;
    if (!formDiagnosticNumberInRange(fire.anchorEnter, 0.35, 0.65)) return null;
    if (!formDiagnosticNumberInRange(fire.releaseSpeed, 6, 8)) return null;
    if (!formDiagnosticNumberInRange(fire.evidenceAgeMs, 0, 1500, true)) return null;
    if (
      fire.evidenceStrength !== null &&
      (!Number.isSafeInteger(fire.evidenceStrength) ||
        fire.evidenceStrength < 3 ||
        fire.evidenceStrength > 12)
    )
      return null;
    if (!formDiagnosticNumberInRange(fire.departDelta, -1.3, 1.3, true)) return null;
    if (!["close", "calibrated", "fast"].includes(fire.fireEvidence)) return null;
    return {
      anchorFloor: formDiagnosticRound(fire.anchorFloor),
      anchorEnter: formDiagnosticRound(fire.anchorEnter),
      releaseSpeed: formDiagnosticRound(fire.releaseSpeed),
      evidenceAgeMs: fire.evidenceAgeMs === null ? null : formDiagnosticRound(fire.evidenceAgeMs),
      evidenceStrength: fire.evidenceStrength,
      departDelta: formDiagnosticRound(fire.departDelta),
      fireEvidence: fire.fireEvidence,
    };
  }

  function formDiagnosticProjectReceipt(receipt, ordinal) {
    const numericId = formDiagnosticNumericSuffix(receipt && receipt.id);
    if (numericId === null) return null;
    if (!["confirmed", "auto-canceled", "unresolved"].includes(receipt.detectorDisposition))
      return null;
    const outcome = formDiagnosticDeriveOutcome(receipt);
    if (
      !outcome ||
      !["retained", "manual-removed", "auto-canceled", "summary-failed", "unresolved"].includes(
        outcome,
      )
    )
      return null;
    if (
      receipt.detectorDisposition === "confirmed" &&
      (receipt.cancelReason !== null || receipt.unresolvedReason !== null)
    )
      return null;
    if (
      receipt.detectorDisposition === "auto-canceled" &&
      (!FORM_DIAGNOSTIC_CANCEL_REASONS.includes(receipt.cancelReason) ||
        receipt.unresolvedReason !== null)
    )
      return null;
    if (
      receipt.detectorDisposition === "unresolved" &&
      (receipt.cancelReason !== null ||
        !FORM_DIAGNOSTIC_UNRESOLVED_REASONS.includes(receipt.unresolvedReason))
    )
      return null;
    const fire = formDiagnosticProjectFire(receipt.fire);
    if (!fire) return null;
    return {
      receiptOrdinal: ordinal,
      outcome,
      detectorOutcome: receipt.detectorDisposition,
      cancelReason: receipt.cancelReason,
      unresolvedReason: receipt.unresolvedReason,
      fire,
    };
  }

  function formDiagnosticProjectRun(record, coordinator, runOrdinal, appVer) {
    if (!record || record.captureMode !== "live" || record.appVer !== appVer) return null;
    const marker = record.formDiagnosticMatrix;
    if (
      !marker ||
      Object.keys(marker).length !== 3 ||
      marker.version !== 1 ||
      marker.batchId !== coordinator.batchId ||
      marker.slot !== FORM_DIAGNOSTIC_SLOTS[runOrdinal - 1]
    )
      return null;
    if (!validateFormDiagnosticRecord(record, appVer).ok) return null;
    const receipts = record.formPhaseDiag.releaseReceipts
      .slice()
      .sort((a, b) => formDiagnosticNumericSuffix(a.id) - formDiagnosticNumericSuffix(b.id));
    if (receipts.length < 1 || receipts.length > 32) return null;
    const projected = receipts.map((receipt, index) =>
      formDiagnosticProjectReceipt(receipt, index + 1),
    );
    if (
      projected.some((receipt) => receipt === null) ||
      projected.filter((receipt) => receipt.outcome === "retained").length !== 6
    )
      return null;
    const retainedIds = new Set(
      receipts
        .filter((receipt) => formDiagnosticDeriveOutcome(receipt) === "retained")
        .map((receipt) => receipt.id),
    );
    if (
      record.shots !== 6 ||
      record.features.length !== 6 ||
      new Set(record.features.map((feature) => feature.receiptId)).size !== 6 ||
      record.features.some((feature) => !retainedIds.has(feature.receiptId))
    )
      return null;
    return { runOrdinal, condition: marker.slot, retainedShotCount: 6, receipts: projected };
  }

  function formDiagnosticUtf8ByteLength(text, TextEncoderCtor = globalThis.TextEncoder) {
    try {
      if (typeof TextEncoderCtor !== "function") return null;
      const encoded = new TextEncoderCtor().encode(text);
      return encoded && Number.isSafeInteger(encoded.byteLength) ? encoded.byteLength : null;
    } catch {
      return null;
    }
  }

  function isFormDiagnosticJsonSizeAllowed(text, TextEncoderCtor = globalThis.TextEncoder) {
    const byteLength = formDiagnosticUtf8ByteLength(text, TextEncoderCtor);
    return byteLength !== null && byteLength <= FORM_DIAGNOSTIC_EXPORT_MAX_BYTES;
  }

  function buildFormDiagnosticExport(
    formAnalyses,
    coordinator,
    appVer,
    TextEncoderCtor = globalThis.TextEncoder,
  ) {
    const source = formDiagnosticExportSources(formAnalyses, coordinator, appVer);
    if (!source.ok) return source;
    const runs = source.selected.map((record, index) =>
      formDiagnosticProjectRun(record, source.coordinator, index + 1, appVer),
    );
    if (runs.length !== 3 || runs.some((run) => run === null))
      return formDiagnosticExportFailure("source-invalid");
    const payload = {
      format: "archery-note-form-diagnostics",
      schemaVersion: 1,
      appVersion: appVer,
      matrix: "field-3x6",
      runs,
    };
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    const byteLength = formDiagnosticUtf8ByteLength(json, TextEncoderCtor);
    if (byteLength === null) return formDiagnosticExportFailure("encoding-unavailable");
    if (byteLength > FORM_DIAGNOSTIC_EXPORT_MAX_BYTES)
      return formDiagnosticExportFailure("output-too-large");
    return { ok: true, code: null, payload, json, byteLength };
  }
  ```

- [ ] **Step 6: Run the exact-output, poison, refusal, and UTF-8 boundary RED**

  Run: `node tools/check-form-diagnostics.js`

  Expected: exit `1` at the first missing exporter/byte-helper assertion. The
  complete output, allowlist, poison, and 65,536/65,537-byte tests from Step 3
  remain above the production implementation and are not copied below it.

- [ ] **Step 7: Run the focused and repository GREEN ladder**

  Run:

  ```powershell
  node tools/check-form-diagnostics.js
  npm run check:form
  npm run check:storage
  npm run check:app
  npm run lint -- --quiet
  ```

  Expected: every command exits `0`; diagnostics ends in `Form diagnostic checks OK`.

- [ ] **Step 8: Format, document, and commit Task 5**

  Update the progress ledger, then run:

  ```powershell
  npx prettier --check tools/check-form-diagnostics.js docs/codex/codex-progress.md
  git diff --check
  git add scripts/46-form-core.js tools/check-form-diagnostics.js docs/codex/codex-progress.md
  git diff --check --cached
  git commit -m "feat(form): project bounded diagnostic exports"
  ```

  Expected: all checks exit `0`; the commit uses the exact subject above.

---

### Task 6: Add transactional candidates and selected-record invalidation

**Files:**

- Modify: `scripts/47-form-view.js:after formDiagPush and bindFormTrackingCard deletion handler at 163-174`
- Modify: `tools/check-form-diagnostics.js:transaction/delete sections`
- Modify: `tools/check-form-core.js:form-record deletion source contract`
- Add: `tests/e2e/form-diagnostics.spec.js` (synthetic seed helpers and transactional deletion cases; Tasks 7 and 9 modify this file)
- Modify: `docs/codex/codex-progress.md:end`

**Interfaces:**

- Consumes: the current database object, a detached candidate containing only own-specified `formAnalyses`/`trash`/`formDiagnosticMatrixBatch` fields, an exact `saveOptions` object, and synchronous `saveFn`.
- Produces: `commitFormDiagnosticDbCandidate(database, candidate, saveOptions, saveFn) -> { ok, error }`; scoped exact rollback on false/throw; and `planFormAnalysisDeletionCandidate(database, recordId, trashEntry, appVer, trashLimit, invalidateFn) -> { ok, code, record, candidate }`.
- A valid transaction calls `saveFn(saveOptions)` exactly once and accepts only `=== true`. Invalid candidates, missing/ambiguous deletions, and rollback call it zero additional times.
- Rollback restores exactly the touched array references, coordinator own-property state/value, and `updatedAt` own-property state/value. It intentionally cannot restore `DB_REV`, a pending debounce absorbed by `save()`, `db.schema`, or arbitrary side effects performed by an injected `saveFn`.

```js
{
  formAnalyses: detachedRecords,
  trash: detachedTrash,
  formDiagnosticMatrixBatch: detachedCoordinator,
}
```

- [ ] **Step 1: Add the bounded transaction loader and false/throw rollback RED**

  Add stable comments immediately after `formDiagPush`:

```js
/* FORM_DIAGNOSTIC_TRANSACTION_START */
/* FORM_DIAGNOSTIC_TRANSACTION_END */
```

In `tools/check-form-diagnostics.js`, add this loader and test before adding either production helper:

```js
function loadFormViewTransactions(viewSource) {
  const startMarker = "/* FORM_DIAGNOSTIC_TRANSACTION_START */";
  const endMarker = "/* FORM_DIAGNOSTIC_TRANSACTION_END */";
  const start = viewSource.indexOf(startMarker);
  const end = viewSource.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0, "form transaction start marker exists");
  assert(end > start, "form transaction end marker follows start marker");
  assertEqual(viewSource.lastIndexOf(startMarker), start, "transaction start marker is unique");
  assertEqual(viewSource.lastIndexOf(endMarker), end, "transaction end marker is unique");
  return new Function(
    `${viewSource.slice(start + startMarker.length, end)}
return {
  commitFormDiagnosticDbCandidate:
    typeof commitFormDiagnosticDbCandidate === "function"
      ? commitFormDiagnosticDbCandidate
      : null,
  planFormAnalysisDeletionCandidate:
    typeof planFormAnalysisDeletionCandidate === "function"
      ? planFormAnalysisDeletionCandidate
      : null,
};`,
  )();
}

const viewTransactions = loadFormViewTransactions(viewScript);
assert(
  typeof viewTransactions.commitFormDiagnosticDbCandidate === "function",
  "transaction helper is exported",
);

for (const failure of ["false", "throw"]) {
  const database = {
    settings: { formDiagnosticMatrixBatch: { version: 1, nextSlot: 0 } },
    formAnalyses: [{ id: "original-record" }],
    trash: [{ id: "original-trash" }],
  };
  const originalRecords = database.formAnalyses;
  const originalTrash = database.trash;
  const originalBatch = database.settings.formDiagnosticMatrixBatch;
  const saveOptions = { reason: "form-diagnostic-fixture", forceSnapshot: true };
  let calls = 0;
  let receivedOptions = null;
  const result = viewTransactions.commitFormDiagnosticDbCandidate(
    database,
    {
      formAnalyses: [{ id: "candidate-record" }],
      trash: [{ id: "candidate-trash" }],
      formDiagnosticMatrixBatch: { version: 1, nextSlot: 1 },
    },
    saveOptions,
    (options) => {
      calls++;
      receivedOptions = options;
      database.updatedAt = "changed-by-save";
      if (failure === "throw") throw new Error("fixture write failure");
      return false;
    },
  );
  assertEqual(result.ok, false, `${failure} save fails`);
  assertEqual(result.error instanceof Error, failure === "throw", `${failure} error shape`);
  assertEqual(calls, 1, `${failure} calls save once`);
  assert(receivedOptions === saveOptions, `${failure} forwards the same options object`);
  assert(database.formAnalyses === originalRecords, `${failure} restores records`);
  assert(database.trash === originalTrash, `${failure} restores trash`);
  assert(
    database.settings.formDiagnosticMatrixBatch === originalBatch,
    `${failure} restores coordinator`,
  );
  assertEqual(Object.hasOwn(database, "updatedAt"), false, `${failure} restores updatedAt ownness`);
}
```

- [ ] **Step 2: Run the transaction RED**

  Run:

  ```powershell
  node tools/check-form-diagnostics.js
  ```

  Expected: exit `1` with `transaction helper is exported`. A DOM error or syntax error is not the expected RED.

- [ ] **Step 3: Implement the complete own-field transactional commit**

  Insert this code between the transaction markers:

```js
function commitFormDiagnosticDbCandidate(database, candidate, saveOptions, saveFn) {
  const invalid = (message) => ({ ok: false, error: new TypeError(message) });
  if (
    !database ||
    typeof database !== "object" ||
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate) ||
    !saveOptions ||
    typeof saveOptions !== "object" ||
    typeof saveFn !== "function"
  ) {
    return invalid("invalid form diagnostic transaction arguments");
  }
  const allowed = new Set(["formAnalyses", "trash", "formDiagnosticMatrixBatch"]);
  const keys = Reflect.ownKeys(candidate);
  if (
    !keys.length ||
    keys.some((key) => typeof key !== "string" || !allowed.has(key)) ||
    (Object.hasOwn(candidate, "formAnalyses") && !Array.isArray(candidate.formAnalyses)) ||
    (Object.hasOwn(candidate, "trash") && !Array.isArray(candidate.trash)) ||
    (Object.hasOwn(candidate, "formDiagnosticMatrixBatch") &&
      (!database.settings || typeof database.settings !== "object"))
  ) {
    return invalid("invalid form diagnostic transaction candidate");
  }

  const touched = [];
  const assign = (target, key, value) => {
    touched.push({
      target,
      key,
      hadOwn: Object.hasOwn(target, key),
      value: target[key],
    });
    target[key] = value;
  };
  const hadUpdatedAt = Object.hasOwn(database, "updatedAt");
  const updatedAt = database.updatedAt;

  if (Object.hasOwn(candidate, "formAnalyses")) {
    assign(database, "formAnalyses", candidate.formAnalyses);
  }
  if (Object.hasOwn(candidate, "trash")) {
    assign(database, "trash", candidate.trash);
  }
  if (Object.hasOwn(candidate, "formDiagnosticMatrixBatch")) {
    assign(database.settings, "formDiagnosticMatrixBatch", candidate.formDiagnosticMatrixBatch);
  }

  let saved = false;
  let error = null;
  try {
    saved = saveFn(saveOptions) === true;
  } catch (caught) {
    error = caught;
  }
  if (saved) return { ok: true, error: null };

  for (let index = touched.length - 1; index >= 0; index--) {
    const prior = touched[index];
    if (prior.hadOwn) prior.target[prior.key] = prior.value;
    else delete prior.target[prior.key];
  }
  if (hadUpdatedAt) database.updatedAt = updatedAt;
  else delete database.updatedAt;
  return { ok: false, error };
}
```

Add complete success/invalid/optional-field coverage:

```js
{
  const database = { settings: {}, formAnalyses: [], trash: [], updatedAt: "before" };
  const candidate = { formAnalyses: [{ id: "saved" }] };
  const options = { reason: "success" };
  let calls = 0;
  const result = viewTransactions.commitFormDiagnosticDbCandidate(
    database,
    candidate,
    options,
    (received) => {
      calls++;
      assert(received === options, "success keeps options identity");
      database.updatedAt = "after";
      return true;
    },
  );
  assertEqual(result.ok, true, "true commits");
  assertEqual(result.error, null, "success has null error");
  assertEqual(calls, 1, "success saves once");
  assert(
    database.formAnalyses === candidate.formAnalyses,
    "success installs exact candidate array",
  );
  assertEqual(database.updatedAt, "after", "success keeps save timestamp");
}

for (const candidate of [{}, { unknown: [] }, { formAnalyses: {} }, { trash: {} }]) {
  let calls = 0;
  const result = viewTransactions.commitFormDiagnosticDbCandidate(
    { settings: {}, formAnalyses: [], trash: [] },
    candidate,
    { reason: "invalid" },
    () => {
      calls++;
      return true;
    },
  );
  assertEqual(result.ok, false, "invalid candidate fails");
  assert(result.error instanceof TypeError, "invalid candidate returns TypeError");
  assertEqual(calls, 0, "invalid candidate never saves");
}

{
  const database = { settings: {}, formAnalyses: [], trash: [] };
  const candidate = { formDiagnosticMatrixBatch: { version: 1 } };
  const result = viewTransactions.commitFormDiagnosticDbCandidate(
    database,
    candidate,
    { reason: "absent-properties" },
    () => {
      database.updatedAt = "temporary";
      return false;
    },
  );
  assertEqual(result.ok, false, "false rolls back absent properties");
  assertEqual(
    Object.hasOwn(database.settings, "formDiagnosticMatrixBatch"),
    false,
    "coordinator ownness restored",
  );
  assertEqual(Object.hasOwn(database, "updatedAt"), false, "updatedAt ownness restored");
}
```

- [ ] **Step 4: Add the pure deletion-planner RED**

  Extend the loader assertion and add this test before implementing the planner:

```js
assert(
  typeof viewTransactions.planFormAnalysisDeletionCandidate === "function",
  "deletion candidate planner is exported",
);

const duplicateDatabase = {
  settings: { formDiagnosticMatrixBatch: { recordIds: ["selected"] } },
  formAnalyses: [
    { id: "selected", shots: 6 },
    { id: "selected", shots: 6 },
  ],
  trash: [],
};
let invalidationCalls = 0;
const duplicatePlan = viewTransactions.planFormAnalysisDeletionCandidate(
  duplicateDatabase,
  "selected",
  { id: "trash-1", type: "formAnalysis", data: { id: "selected" } },
  84,
  50,
  () => {
    invalidationCalls++;
    return { ok: true, code: null, coordinator: null, changed: false };
  },
);
assertEqual(duplicatePlan.ok, false, "duplicate deletion fails closed");
assertEqual(duplicatePlan.code, "ambiguous-record", "duplicate deletion code");
assertEqual(duplicatePlan.record, null, "duplicate returns no record");
assertEqual(duplicatePlan.candidate, null, "duplicate returns no candidate");
assertEqual(invalidationCalls, 0, "duplicate does not invalidate");
assertEqual(duplicateDatabase.formAnalyses.length, 2, "duplicate records remain");
assertEqual(duplicateDatabase.trash.length, 0, "duplicate creates no trash");
```

Run:

```powershell
node tools/check-form-diagnostics.js
```

Expected: exit `1` with `deletion candidate planner is exported`.

- [ ] **Step 5: Implement the complete detached deletion planner**

  Add this function inside the transaction markers:

```js
function planFormAnalysisDeletionCandidate(
  database,
  recordId,
  trashEntry,
  appVer,
  trashLimit,
  invalidateFn,
) {
  const fail = (code) => ({ ok: false, code, record: null, candidate: null });
  if (
    !database ||
    !Array.isArray(database.formAnalyses) ||
    !Array.isArray(database.trash) ||
    !database.settings ||
    typeof database.settings !== "object" ||
    typeof recordId !== "string" ||
    !recordId ||
    !trashEntry ||
    typeof trashEntry !== "object" ||
    trashEntry.type !== "formAnalysis" ||
    !trashEntry.data ||
    trashEntry.data.id !== recordId ||
    !Number.isSafeInteger(appVer) ||
    appVer <= 0 ||
    !Number.isSafeInteger(trashLimit) ||
    trashLimit <= 0 ||
    typeof invalidateFn !== "function"
  ) {
    return fail("invalid-input");
  }
  const matches = database.formAnalyses.filter((record) => record && record.id === recordId);
  if (matches.length === 0) return fail("missing-record");
  if (matches.length !== 1) return fail("ambiguous-record");

  const record = matches[0];
  const candidate = {
    formAnalyses: database.formAnalyses.filter((item) => item !== record),
    trash: [trashEntry, ...database.trash].slice(0, trashLimit),
  };
  const invalidated = invalidateFn(database.settings.formDiagnosticMatrixBatch, recordId, appVer);
  if (!invalidated || invalidated.ok !== true) {
    return fail("invalidation-failed");
  }
  if (invalidated.changed) {
    candidate.formDiagnosticMatrixBatch = invalidated.coordinator;
  }
  return { ok: true, code: null, record, candidate };
}
```

Add selected, unrelated, missing, duplicate-order, cap, invalidation-failure, and immutability tests:

```js
for (const records of [
  [{ id: "selected" }, { id: "selected" }, { id: "other" }],
  [{ id: "other" }, { id: "selected" }, { id: "selected" }],
]) {
  const database = { settings: {}, formAnalyses: records, trash: [] };
  const plan = viewTransactions.planFormAnalysisDeletionCandidate(
    database,
    "selected",
    { id: "trash", type: "formAnalysis", data: { id: "selected" } },
    84,
    50,
    () => {
      throw new Error("ambiguous deletion must not invalidate");
    },
  );
  assertEqual(plan.code, "ambiguous-record", "both duplicate orders fail");
}

{
  const coordinator = { version: 1, recordIds: ["selected"], invalidated: false };
  const records = [{ id: "selected" }, { id: "other" }];
  const trash = Array.from({ length: 50 }, (_, index) => ({ id: `old-${index}` }));
  const database = {
    settings: { formDiagnosticMatrixBatch: coordinator },
    formAnalyses: records,
    trash,
  };
  const copiedCoordinator = { ...coordinator, recordIds: ["selected"], invalidated: true };
  let invalidationCalls = 0;
  const plan = viewTransactions.planFormAnalysisDeletionCandidate(
    database,
    "selected",
    { id: "new-trash", type: "formAnalysis", data: { id: "selected" } },
    84,
    50,
    (received, id, appVer) => {
      invalidationCalls++;
      assert(received === coordinator, "planner passes current coordinator");
      assertEqual(id, "selected", "planner passes selected ID");
      assertEqual(appVer, 84, "planner passes current app version");
      return { ok: true, code: null, coordinator: copiedCoordinator, changed: true };
    },
  );
  assertEqual(plan.ok, true, "selected deletion plans");
  assertEqual(invalidationCalls, 1, "selected deletion invalidates once");
  assertEqual(plan.candidate.formAnalyses.length, 1, "selected record removed once");
  assertEqual(plan.candidate.trash.length, 50, "trash remains capped");
  assertEqual(plan.candidate.trash[0].id, "new-trash", "new trash entry is first");
  assert(plan.candidate.formAnalyses !== records, "records array is detached");
  assert(plan.candidate.trash !== trash, "trash array is detached");
  assert(
    plan.candidate.formDiagnosticMatrixBatch === copiedCoordinator,
    "copied invalidation is selected",
  );
  assertEqual(coordinator.invalidated, false, "source coordinator is unchanged");
}

{
  const database = {
    settings: { formDiagnosticMatrixBatch: { recordIds: [] } },
    formAnalyses: [{ id: "other" }],
    trash: [],
  };
  const plan = viewTransactions.planFormAnalysisDeletionCandidate(
    database,
    "other",
    { id: "trash", type: "formAnalysis", data: { id: "other" } },
    84,
    50,
    (coordinator) => ({ ok: true, code: null, coordinator, changed: false }),
  );
  assertEqual(plan.ok, true, "unrelated deletion plans");
  assertEqual(
    Object.hasOwn(plan.candidate, "formDiagnosticMatrixBatch"),
    false,
    "unrelated deletion omits coordinator candidate",
  );
}

{
  const database = { settings: {}, formAnalyses: [{ id: "selected" }], trash: [] };
  const failed = viewTransactions.planFormAnalysisDeletionCandidate(
    database,
    "selected",
    { id: "trash", type: "formAnalysis", data: { id: "selected" } },
    84,
    50,
    () => ({ ok: false, code: "record-invalid", coordinator: null, changed: false }),
  );
  assertEqual(failed.code, "invalidation-failed", "invalidation failure aborts deletion");
  assertEqual(failed.candidate, null, "invalidation failure returns no candidate");
  assertEqual(database.formAnalyses.length, 1, "invalidation failure preserves records");
  assertEqual(database.trash.length, 0, "invalidation failure preserves trash");
}

{
  const database = { settings: {}, formAnalyses: [{ id: "other" }], trash: [] };
  const missing = viewTransactions.planFormAnalysisDeletionCandidate(
    database,
    "missing",
    { id: "trash", type: "formAnalysis", data: { id: "missing" } },
    84,
    50,
    () => {
      throw new Error("missing deletion must not invalidate");
    },
  );
  assertEqual(missing.code, "missing-record", "missing deletion fails closed");
  assertEqual(missing.candidate, null, "missing deletion returns no candidate");
}
```

- [ ] **Step 6: Replace deletion with post-confirm re-resolution plus one commit**

  Replace the `data-del-form` handler with this complete code. Do not call the mutating `trashItem()` helper in this path:

```js
document.querySelectorAll("[data-del-form]").forEach(
  (b) =>
    (b.onclick = async (e) => {
      e.stopPropagation();
      const recordId = b.dataset.delForm;
      let matches = (db.formAnalyses || []).filter((record) => record && record.id === recordId);
      if (matches.length !== 1) {
        toast("削除対象を一意に特定できないため、削除していません", 6000);
        return;
      }
      if (
        !(await appConfirm("この射形記録を削除しますか？", {
          danger: true,
          okLabel: "削除",
        }))
      )
        return;

      matches = (db.formAnalyses || []).filter((record) => record && record.id === recordId);
      if (matches.length !== 1) {
        toast("削除対象を一意に特定できないため、削除していません", 6000);
        return;
      }
      const record = matches[0];
      const trashEntry = {
        id: uid(),
        type: "formAnalysis",
        label: `${fmtD(record.date)} 射形${record.shots || 0}射`,
        data: cloneData(record),
        date: today(),
        ts: Date.now(),
      };
      const planned = planFormAnalysisDeletionCandidate(
        db,
        recordId,
        trashEntry,
        APP_VER,
        TRASH_LIMIT,
        invalidateFormDiagnosticMatrixForRecord,
      );
      if (!planned.ok) {
        toast("削除対象を一意に特定できないため、削除していません", 6000);
        return;
      }
      const committed = commitFormDiagnosticDbCandidate(
        db,
        planned.candidate,
        { reason: "delete-form-analysis", forceSnapshot: true },
        save,
      );
      if (!committed.ok) {
        toast("射形記録を保存できなかったため、削除していません", 6000);
        return;
      }
      render();
      toast("削除しました。設定から復元できます");
    }),
);
```

In `tools/check-form-core.js`, add this complete bounded source contract:

```js
const deletionHandler = boundedSourceSection(
  viewScript,
  'document.querySelectorAll("[data-del-form]").forEach',
  "function formInsightBlockHtml",
  "form deletion handler",
);
const deletionCompact = compactSource(deletionHandler);
const firstResolve = deletionCompact.indexOf("matches=(db.formAnalyses||[]).filter(");
const confirmAt = deletionCompact.indexOf("awaitappConfirm(", firstResolve);
const secondResolve = deletionCompact.indexOf(
  "matches=(db.formAnalyses||[]).filter(",
  firstResolve + 1,
);
const planAt = deletionCompact.indexOf("planFormAnalysisDeletionCandidate(", secondResolve);
const commitAt = deletionCompact.indexOf("commitFormDiagnosticDbCandidate(", planAt);
const successGuard = deletionCompact.indexOf("if(!committed.ok)", commitAt);
const renderAt = deletionCompact.indexOf("render();", successGuard);
assert(
  firstResolve >= 0 &&
    confirmAt > firstResolve &&
    secondResolve > confirmAt &&
    planAt > secondResolve &&
    commitAt > planAt &&
    successGuard > commitAt &&
    renderAt > successGuard,
  "form deletion re-resolves, plans, commits, and renders only after success",
);
assert(
  !deletionHandler.includes("trashItem("),
  "transactional form deletion does not pre-mutate trash",
);
assert(
  deletionHandler.includes('reason:"delete-form-analysis",forceSnapshot:true'),
  "form deletion preserves exact save options",
);
```

- [ ] **Step 7: Create the shared Playwright file and write the real-storage deletion RED**

  Create `tests/e2e/form-diagnostics.spec.js` with these complete helpers. The primary-write gate is installed only after startup so seeding and normalization are not broken:

```js
"use strict";

const { expect, test } = require("@playwright/test");

function makeSyntheticDiagnosticDb(overrides = {}) {
  const { settings: settingsOverrides = {}, ...databaseOverrides } = overrides;
  return {
    schema: 5,
    setups: [],
    sightMarks: [],
    sessions: [],
    trash: [],
    formAnalyses: [],
    customRounds: [],
    settings: {
      eyeSight: 850,
      theme: "auto",
      fieldMode: false,
      lastBackupAt: null,
      activeGuideSeen: true,
      onboardingSeen: true,
      launchCount: 1,
      formTrackingEnabled: true,
      formDebug: true,
      featureHints: {
        gearSetup: false,
        analysis: false,
        sightAdjust: false,
        formTracking: false,
        addToHome: false,
        practiceDays: false,
      },
      gamification: {
        enabled: false,
        practiceDays: null,
        goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
        backfilledAt: null,
      },
      ...settingsOverrides,
    },
    gamification: { badges: [] },
    active: null,
    fixtureNotice: "synthetic-only-no-real-user-or-device-data",
    ...databaseOverrides,
  };
}

async function seedDiagnosticDb(page, database) {
  await page.addInitScript((value) => {
    localStorage.setItem("archeryNote.v1", JSON.stringify(value));
  }, database);
}

async function installPrimaryWriteGate(page) {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    globalThis.__formWriteProbe = { fail: true, attempts: [] };
    Storage.prototype.setItem = function (key, value) {
      if (key === "archeryNote.v1") {
        globalThis.__formWriteProbe.attempts.push(JSON.parse(value));
        if (globalThis.__formWriteProbe.fail) {
          throw new DOMException("synthetic quota failure", "QuotaExceededError");
        }
      }
      return original.call(this, key, value);
    };
  });
}
```

Add the initial browser test before changing the handler:

```js
test("selected deletion rolls back when the primary write fails", async ({ page }) => {
  const coordinator = {
    version: 1,
    batchId: "11111111-1111-4111-8111-111111111111",
    appVer: 84,
    nextSlot: 1,
    recordIds: ["selected-record"],
    invalidated: false,
  };
  const database = makeSyntheticDiagnosticDb({
    updatedAt: "before-delete",
    formAnalyses: [
      {
        id: "selected-record",
        date: "2026-01-01",
        ts: 1,
        shots: 6,
        features: [],
        note: "synthetic deletion fixture",
      },
    ],
    settings: { formDiagnosticMatrixBatch: coordinator },
  });
  await seedDiagnosticDb(page, database);
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await installPrimaryWriteGate(page);
  await page.evaluate(() => {
    globalThis.__selectedCoordinatorReference = db.settings.formDiagnosticMatrixBatch;
  });

  await page.locator('[data-del-form="selected-record"]').click();
  await page.locator(".confirmSheet #acOk").click();

  await expect(page.locator('[data-form-id="selected-record"]')).toHaveCount(1);
  await expect(page.locator("#toast")).toContainText(
    "射形記録を保存できなかったため、削除していません",
  );
  expect(
    await page.evaluate(() => ({
      ids: db.formAnalyses.map((record) => record.id),
      trash: db.trash.length,
      invalidated: db.settings.formDiagnosticMatrixBatch.invalidated,
      sameCoordinator:
        db.settings.formDiagnosticMatrixBatch === globalThis.__selectedCoordinatorReference,
      updatedAt: db.updatedAt,
      attempts: globalThis.__formWriteProbe.attempts.length,
    })),
  ).toEqual({
    ids: ["selected-record"],
    trash: 0,
    invalidated: false,
    sameCoordinator: true,
    updatedAt: "before-delete",
    attempts: 1,
  });
});
```

Run:

```powershell
npx playwright test tests/e2e/form-diagnostics.spec.js --project=chromium --grep "selected deletion rolls back"
```

Expected RED: the selected row disappears because the existing handler ignores `save() === false`.

- [ ] **Step 8: Complete deletion browser coverage and run Task 6 GREEN**

  Extend the same test after its rollback assertions to disable the injected failure and retry the user action:

```js
await page.evaluate(() => {
  globalThis.__formWriteProbe.fail = false;
});
await page.locator('[data-del-form="selected-record"]').click();
await page.locator(".confirmSheet #acOk").click();
await expect(page.locator('[data-form-id="selected-record"]')).toHaveCount(0);
expect(
  await page.evaluate(() => ({
    records: db.formAnalyses.length,
    trash: db.trash.length,
    trashType: db.trash[0].type,
    trashRecordId: db.trash[0].data.id,
    invalidated: db.settings.formDiagnosticMatrixBatch.invalidated,
    attempts: globalThis.__formWriteProbe.attempts.length,
  })),
).toEqual({
  records: 0,
  trash: 1,
  trashType: "formAnalysis",
  trashRecordId: "selected-record",
  invalidated: true,
  attempts: 2,
});
```

Run:

```powershell
node tools/check-form-diagnostics.js
node tools/check-form-core.js
npx playwright test tests/e2e/form-diagnostics.spec.js --project=chromium
npm run check:form
npm run check:storage
npm run check:app
npm run lint -- --quiet
```

Expected: every command exits `0`; diagnostics ends in `Form diagnostic checks OK`, core ends in `Form core checks OK`, and Playwright reports zero failures.

- [ ] **Step 9: Format, document, and commit Task 6**

  Update the progress ledger with both observed REDs, the scoped rollback boundary, exact calls, and GREEN output. Then run:

  ```powershell
  npx prettier --check tools/check-form-diagnostics.js tools/check-form-core.js tests/e2e/form-diagnostics.spec.js docs/codex/codex-progress.md
  git status --short
  git diff --check
  git add scripts/47-form-view.js tools/check-form-diagnostics.js tools/check-form-core.js tests/e2e/form-diagnostics.spec.js docs/codex/codex-progress.md
  git diff --check --cached
  git commit -m "fix(form): make diagnostic deletion transactional"
  ```

  Expected: all checks exit `0`; the commit has the exact subject above.

---

### Task 7: Make live/replay saves frozen, retryable, and matrix-aware

**Files:**

- Modify: `scripts/47-form-view.js:FORM_DIAGNOSTIC_TRANSACTION_START..END` (DOM-free frozen create/attempt seam)
- Modify: `scripts/47-form-view.js:322-391 and 566-627` (live freeze/close/save)
- Modify: `scripts/47-form-view.js:718-735 and 847-897` (replay freeze/EOS/close/save)
- Modify: `tools/check-form-core.js:live/replay save source contracts`
- Modify: `tools/check-form-diagnostics.js:save-plan/retry sections`
- Modify: `tests/e2e/form-diagnostics.spec.js` (append frozen-save/retry/discard cases created in Task 6)
- Modify: `docs/codex/codex-progress.md:end`

**Interfaces:**

- Consumes: one copied diagnostic record, the current database/coordinator, `APP_VER`, `planFormDiagnosticMatrixRecord`, `commitFormDiagnosticDbCandidate`, an exact save-options object, and synchronous `saveFn`.
- Produces: `createFrozenFormDiagnosticSave(database, record, options) -> { ok, code, frozen }` and `attemptFrozenFormDiagnosticSave(database, frozen, saveFn) -> { ok, code, error }`.
- The frozen object has this exact shape and survives a failed attempt by identity:

```js
{
  candidate,
  record,
  matrixAdvanced,
  matrixCode,
  coordinatorToken,
  saveOptions,
  attempts: 0,
  committed: false,
}
```

- Exact-debug initial creation freezes once, abandons an active receipt once, snapshots once, constructs one record, calls the planner zero or one time, and creates one candidate. Every retry reuses that candidate and calls only the attempt helper.
- Replay and zero-shot live records call the planner zero times and never receive a matrix marker/coordinator candidate. A six-shot live record calls it exactly once.
- Every initial attempt and retry re-checks `db.settings.formDebug === true`. The attempt helper also runs its coordinator check every time; only a matrix-advanced frozen object has a non-null token and therefore imposes coordinator identity/value equality.
- Diagnostic-off saves still resolve an active receipt as `workflow-save`, then retain the legacy record payload, direct push/save control path, and no retry UX.

- [ ] **Step 1: Add the DOM-free create/attempt API RED**

  Extend the Task-6 bounded loader return object and add these tests before production code:

```js
createFrozenFormDiagnosticSave:
  typeof createFrozenFormDiagnosticSave === "function"
    ? createFrozenFormDiagnosticSave
    : null,
attemptFrozenFormDiagnosticSave:
  typeof attemptFrozenFormDiagnosticSave === "function"
    ? attemptFrozenFormDiagnosticSave
    : null,
```

```js
assert(
  typeof viewTransactions.createFrozenFormDiagnosticSave === "function",
  "frozen diagnostic save creator is exported",
);
assert(
  typeof viewTransactions.attemptFrozenFormDiagnosticSave === "function",
  "frozen diagnostic save attempt is exported",
);
```

Run:

```powershell
node tools/check-form-diagnostics.js
```

Expected RED: exit `1` with `frozen diagnostic save creator is exported`.

- [ ] **Step 2: Implement the complete coordinator token plus create/attempt seam**

  Add this code inside the Task-6 transaction markers:

```js
function captureFormDiagnosticCoordinatorToken(coordinator) {
  if (!coordinator || typeof coordinator !== "object" || !Array.isArray(coordinator.recordIds))
    return null;
  return {
    reference: coordinator,
    version: coordinator.version,
    batchId: coordinator.batchId,
    appVer: coordinator.appVer,
    nextSlot: coordinator.nextSlot,
    invalidated: coordinator.invalidated,
    recordIds: coordinator.recordIds.slice(),
  };
}

function formDiagnosticCoordinatorTokenMatches(database, token) {
  if (token === null) return true;
  const current = database && database.settings && database.settings.formDiagnosticMatrixBatch;
  return (
    current === token.reference &&
    current.version === token.version &&
    current.batchId === token.batchId &&
    current.appVer === token.appVer &&
    current.nextSlot === token.nextSlot &&
    current.invalidated === token.invalidated &&
    Array.isArray(current.recordIds) &&
    current.recordIds.length === token.recordIds.length &&
    current.recordIds.every((id, index) => id === token.recordIds[index])
  );
}

function createFrozenFormDiagnosticSave(database, record, options) {
  const fail = (code) => ({ ok: false, code, frozen: null });
  if (
    !database ||
    !Array.isArray(database.formAnalyses) ||
    !database.settings ||
    database.settings.formDebug !== true ||
    !record ||
    typeof record !== "object" ||
    record.formDiagnosticVersion !== 1 ||
    !["live", "replay"].includes(record.captureMode) ||
    !Number.isSafeInteger(record.shots) ||
    record.shots < 0 ||
    Object.hasOwn(record, "formDiagnosticMatrix") ||
    !options ||
    !Number.isSafeInteger(options.appVer) ||
    options.appVer <= 0 ||
    !options.saveOptions ||
    typeof options.saveOptions !== "object" ||
    typeof options.planMatrixRecord !== "function"
  ) {
    return fail(
      database && database.settings && database.settings.formDebug !== true
        ? "diagnostics-disabled"
        : "invalid-record",
    );
  }

  const currentCoordinator = database.settings.formDiagnosticMatrixBatch;
  const prePlanCoordinatorToken = captureFormDiagnosticCoordinatorToken(currentCoordinator);
  let savedRecord = record;
  let advancedCoordinator = null;
  let matrixAdvanced = false;
  let matrixCode =
    record.captureMode === "replay"
      ? "replay-excluded"
      : record.shots === 0
        ? "zero-shot-excluded"
        : "record-ineligible";

  if (record.captureMode === "live" && record.shots === 6) {
    const planned = options.planMatrixRecord(record, currentCoordinator, options.appVer);
    if (planned && planned.ok === true) {
      savedRecord = planned.record;
      advancedCoordinator = planned.coordinator;
      matrixAdvanced = true;
      matrixCode = null;
    } else {
      matrixCode = (planned && planned.code) || "record-ineligible";
    }
  }

  const candidate = {
    formAnalyses: database.formAnalyses.concat(savedRecord),
  };
  let coordinatorToken = null;
  if (matrixAdvanced) {
    coordinatorToken = prePlanCoordinatorToken;
    if (!coordinatorToken) return fail("coordinator-changed");
    candidate.formDiagnosticMatrixBatch = advancedCoordinator;
  }
  return {
    ok: true,
    code: null,
    frozen: {
      candidate,
      record: savedRecord,
      matrixAdvanced,
      matrixCode,
      coordinatorToken,
      saveOptions: options.saveOptions,
      attempts: 0,
      committed: false,
    },
  };
}

function attemptFrozenFormDiagnosticSave(database, frozen, saveFn) {
  const fail = (code, error) => ({ ok: false, code, error: error || null });
  if (!frozen || typeof frozen !== "object" || !frozen.candidate || typeof saveFn !== "function")
    return fail("invalid-frozen", null);
  if (frozen.committed) return fail("already-committed", null);
  if (!database || !database.settings || database.settings.formDebug !== true) {
    return fail("diagnostics-disabled", null);
  }
  if (!formDiagnosticCoordinatorTokenMatches(database, frozen.coordinatorToken)) {
    return fail("coordinator-changed", null);
  }
  const committed = commitFormDiagnosticDbCandidate(
    database,
    frozen.candidate,
    frozen.saveOptions,
    saveFn,
  );
  frozen.attempts++;
  if (!committed.ok) return fail("save-failed", committed.error);
  frozen.committed = true;
  return { ok: true, code: null, error: null };
}
```

- [ ] **Step 3: Add complete call-count, exclusion, gate, and identity tests**

  Add these executable tests to `tools/check-form-diagnostics.js`:

```js
function makeFrozenDatabase() {
  return {
    settings: {
      formDebug: true,
      formDiagnosticMatrixBatch: {
        version: 1,
        batchId: "11111111-1111-4111-8111-111111111111",
        appVer: 84,
        nextSlot: 0,
        recordIds: [],
        invalidated: false,
      },
    },
    formAnalyses: [],
  };
}

for (const fixture of [
  { mode: "live", shots: 0, plannerCalls: 0 },
  { mode: "replay", shots: 6, plannerCalls: 0 },
  { mode: "live", shots: 5, plannerCalls: 0 },
  { mode: "live", shots: 6, plannerCalls: 1 },
]) {
  const database = makeFrozenDatabase();
  const record = validRecord(fixture.mode);
  record.shots = fixture.shots;
  if (fixture.shots === 0) {
    record.features = [];
    record.formPhaseDiag.releaseReceipts = [];
  }
  let calls = 0;
  const created = viewTransactions.createFrozenFormDiagnosticSave(database, record, {
    appVer: 84,
    saveOptions: { reason: "form-analysis" },
    planMatrixRecord(source, coordinator) {
      calls++;
      return {
        ok: true,
        code: null,
        record: {
          ...source,
          formDiagnosticMatrix: { version: 1, batchId: coordinator.batchId, slot: "side" },
        },
        coordinator: { ...coordinator, nextSlot: 1, recordIds: [source.id] },
      };
    },
  });
  assertEqual(created.ok, true, `${fixture.mode}/${fixture.shots} creates frozen save`);
  assertEqual(calls, fixture.plannerCalls, `${fixture.mode}/${fixture.shots} planner calls`);
  assertEqual(
    Object.hasOwn(created.frozen.candidate, "formDiagnosticMatrixBatch"),
    fixture.mode === "live" && fixture.shots === 6,
    `${fixture.mode}/${fixture.shots} coordinator candidate boundary`,
  );
}

{
  const database = makeFrozenDatabase();
  let plannerCalls = 0;
  const created = viewTransactions.createFrozenFormDiagnosticSave(database, validRecord("live"), {
    appVer: 84,
    saveOptions: { reason: "form-analysis" },
    planMatrixRecord(record, coordinator) {
      plannerCalls++;
      return {
        ok: true,
        code: null,
        record: {
          ...record,
          formDiagnosticMatrix: { version: 1, batchId: coordinator.batchId, slot: "side" },
        },
        coordinator: { ...coordinator, nextSlot: 1, recordIds: [record.id] },
      };
    },
  });
  const frozen = created.frozen;
  const candidate = frozen.candidate;
  const candidateJson = JSON.stringify(candidate);
  const originalCoordinator = database.settings.formDiagnosticMatrixBatch;
  let saveCalls = 0;
  const first = viewTransactions.attemptFrozenFormDiagnosticSave(database, frozen, () => {
    saveCalls++;
    database.updatedAt = "first-attempt";
    return false;
  });
  assertEqual(first.ok, false, "first frozen attempt fails");
  assertEqual(first.code, "save-failed", "false result code");
  assertEqual(frozen.attempts, 1, "first attempt counted once");
  assert(
    database.settings.formDiagnosticMatrixBatch === originalCoordinator,
    "false restores coordinator identity",
  );

  const second = viewTransactions.attemptFrozenFormDiagnosticSave(database, frozen, () => {
    saveCalls++;
    database.updatedAt = "second-attempt";
    return true;
  });
  assertEqual(second.ok, true, "same frozen retry succeeds");
  assertEqual(frozen.attempts, 2, "retry counted once");
  assertEqual(saveCalls, 2, "one save call per attempt");
  assertEqual(plannerCalls, 1, "retry never replans");
  assert(frozen.candidate === candidate, "retry keeps candidate identity");
  assertEqual(JSON.stringify(candidate), candidateJson, "retry keeps candidate bytes");
  const third = viewTransactions.attemptFrozenFormDiagnosticSave(database, frozen, () => {
    throw new Error("committed candidate must not save again");
  });
  assertEqual(third.code, "already-committed", "committed candidate is one-shot");
}

{
  const database = makeFrozenDatabase();
  const record = validRecord("replay");
  const created = viewTransactions.createFrozenFormDiagnosticSave(database, record, {
    appVer: 84,
    saveOptions: { reason: "form-analysis" },
    planMatrixRecord() {
      throw new Error("replay must not plan");
    },
  });
  const records = database.formAnalyses;
  const thrown = new Error("fixture write throw");
  const attempted = viewTransactions.attemptFrozenFormDiagnosticSave(
    database,
    created.frozen,
    () => {
      database.updatedAt = "temporary";
      throw thrown;
    },
  );
  assertEqual(attempted.ok, false, "thrown save fails");
  assertEqual(attempted.code, "save-failed", "thrown save uses fixed code");
  assert(attempted.error === thrown, "thrown save returns the caught error");
  assertEqual(created.frozen.attempts, 1, "thrown persistence is one attempt");
  assert(database.formAnalyses === records, "thrown save restores records reference");
  assertEqual(
    Object.hasOwn(database, "updatedAt"),
    false,
    "thrown save restores updatedAt ownness",
  );
}

{
  const database = makeFrozenDatabase();
  const record = validRecord("live");
  let plannerCalls = 0;
  const created = viewTransactions.createFrozenFormDiagnosticSave(database, record, {
    appVer: 84,
    saveOptions: { reason: "form-analysis" },
    planMatrixRecord() {
      plannerCalls++;
      return { ok: false, code: "record-ineligible", record: null, coordinator: null };
    },
  });
  assertEqual(created.ok, true, "ineligible six-shot save still freezes");
  assertEqual(plannerCalls, 1, "ineligible six-shot save plans once");
  assertEqual(created.frozen.matrixAdvanced, false, "ineligible save does not advance");
  assertEqual(created.frozen.matrixCode, "record-ineligible", "ineligible code is retained");
  assertEqual(
    Object.hasOwn(created.frozen.record, "formDiagnosticMatrix"),
    false,
    "ineligible record stays unmarked",
  );
  assertEqual(
    Object.hasOwn(created.frozen.candidate, "formDiagnosticMatrixBatch"),
    false,
    "ineligible candidate omits coordinator",
  );
}

for (const mutation of ["debug-off", "replace", "mutate-record-ids"]) {
  const database = makeFrozenDatabase();
  const created = viewTransactions.createFrozenFormDiagnosticSave(database, validRecord("live"), {
    appVer: 84,
    saveOptions: { reason: "form-analysis" },
    planMatrixRecord(record, coordinator) {
      return {
        ok: true,
        code: null,
        record: {
          ...record,
          formDiagnosticMatrix: { version: 1, batchId: coordinator.batchId, slot: "side" },
        },
        coordinator: { ...coordinator, nextSlot: 1, recordIds: [record.id] },
      };
    },
  });
  if (mutation === "debug-off") database.settings.formDebug = false;
  if (mutation === "replace")
    database.settings.formDiagnosticMatrixBatch = {
      ...database.settings.formDiagnosticMatrixBatch,
      recordIds: [],
    };
  if (mutation === "mutate-record-ids")
    database.settings.formDiagnosticMatrixBatch.recordIds.push("replacement");
  let saves = 0;
  const attempted = viewTransactions.attemptFrozenFormDiagnosticSave(
    database,
    created.frozen,
    () => {
      saves++;
      return true;
    },
  );
  assertEqual(attempted.ok, false, `${mutation} blocks attempt`);
  assertEqual(saves, 0, `${mutation} performs zero saves`);
  assertEqual(created.frozen.attempts, 0, `${mutation} performs zero persistence attempts`);
}
```

Run:

```powershell
node tools/check-form-diagnostics.js
```

Expected GREEN: exit `0` with `Form diagnostic checks OK`.

- [ ] **Step 4: Add ordered integration/source REDs before changing either workflow**

  In `tools/check-form-core.js`, replace the obsolete exact monolithic-`stop()` assertion and add these executable guards:

```js
for (const [label, source, freezeName, finishName] of [
  ["live", capture, "freezeCaptureForSave", "finishCapture"],
  ["replay", replay, "freezeReplayForSave", "finishReplay"],
]) {
  assert(source.includes(`function ${freezeName}(`), `${label} has a separate freeze helper`);
  assert(source.includes(`function ${finishName}(`), `${label} has a separate final teardown`);
  assert(source.includes("保存を再試行"), `${label} save failure exposes retry`);
  assert(
    source.includes("保存できていない診断を破棄して閉じますか？"),
    `${label} failed save requires discard confirmation`,
  );
  const compact = compactSource(source);
  const freezeAt = compact.indexOf(`${freezeName}();`);
  const activeAt = compact.indexOf(
    'if(tracker.current())tracker.abandon("workflow-save");',
    freezeAt,
  );
  const snapshotAt = compact.indexOf("tracker.snapshot();", activeAt);
  const createAt = compact.indexOf("createFrozenFormDiagnosticSave(", snapshotAt);
  const attemptAt = compact.indexOf("attemptFrozenFormDiagnosticSave(", createAt);
  assert(
    freezeAt >= 0 &&
      activeAt > freezeAt &&
      snapshotAt > activeAt &&
      createAt > snapshotAt &&
      attemptAt > createAt,
    `${label} keeps freeze -> abandon -> snapshot -> create -> attempt order`,
  );
}

assert(
  replay.includes("loadFormPose().then(async lm=>{\n    if(!running) return;"),
  "replay pose continuation cannot restart after freeze or close",
);
```

Add these source checks for retry isolation, live mutation freeze, and the diagnostic-off legacy branches:

```js
for (const [label, source, saveSelector, closeSelector] of [
  [
    "live",
    capture,
    'ovl.querySelector("#fcSave").onclick',
    'ovl.querySelector("#fcClose").onclick',
  ],
  [
    "replay",
    replay,
    'ovl.querySelector("#frSave").onclick',
    'ovl.querySelector("#frClose").onclick',
  ],
]) {
  const saveHandler = boundedSourceSection(
    source,
    saveSelector,
    closeSelector,
    `${label} save handler`,
  );
  const retryBranch = boundedSourceSection(
    saveHandler,
    "if(frozenDiagnosticSave){",
    "if(db.settings.formDebug===true){",
    `${label} retry branch`,
  );
  assert(
    retryBranch.includes("attempt") || retryBranch.includes("finish"),
    `${label} retry delegates to the existing frozen attempt`,
  );
  for (const forbidden of [
    "tracker.snapshot()",
    "tracker.abandon(",
    "uid()",
    "planFormDiagnosticMatrixRecord(",
    "buildLiveFormRecord(",
    "buildReplayFormRecord(",
  ]) {
    assert(!retryBranch.includes(forbidden), `${label} retry excludes ${forbidden}`);
  }
  const compact = compactSource(saveHandler);
  const legacyStart = compact.indexOf(
    "if(!shots.length)return;",
    compact.indexOf("if(db.settings.formDebug===true)"),
  );
  const legacy = compact.slice(legacyStart);
  assert(legacyStart >= 0, `${label} diagnostic-off legacy branch exists`);
  assert(
    legacy.includes('if(tracker.current())tracker.abandon("workflow-save");'),
    `${label} legacy save resolves the active receipt`,
  );
  assert(
    legacy.includes("db.formAnalyses.push(record);"),
    `${label} legacy save keeps direct push`,
  );
  assertEqual(
    (legacy.match(/save\(\{reason:"form-analysis"\}\);/g) || []).length,
    1,
    `${label} legacy branch saves once`,
  );
  assert(
    !legacy.includes("createFrozenFormDiagnosticSave("),
    `${label} legacy branch does not create frozen state`,
  );
}

const liveFreeze = boundedSourceSection(
  capture,
  "function freezeCaptureForSave(){",
  "function finishCapture(){",
  "live save freeze",
);
assert(
  liveFreeze.includes('ovl.querySelectorAll("[data-rm-shot]")'),
  "live freeze disables per-shot deletion",
);
```

Run:

```powershell
node tools/check-form-core.js
```

Expected RED: exit `1` with `live has a separate freeze helper`.

- [ ] **Step 5: Split live and replay freeze from final teardown with complete idempotence guards**

  Replace live `stop()` with this code and route final close/success through `finishCapture()`:

```js
let captureFrozen = false;
let captureTornDown = false;
let hadRecorderAtFreeze = false;

function freezeCaptureForSave() {
  if (captureFrozen) return false;
  captureFrozen = true;
  running = false;
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  if (pendingCheck) finalizeArrowCheck();
  hadRecorderAtFreeze = !!recorder;
  stopRec();
  const pendingStream = inFlightStream;
  const activeStream = stream;
  inFlightStream = null;
  stream = null;
  video.srcObject = null;
  try {
    if (pendingStream) pendingStream.getTracks().forEach((track) => track.stop());
    if (activeStream && activeStream !== pendingStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }
  } catch (error) {}
  cameraSwapReady = false;
  ["#fcSwap", "#fcHand", "#fcCrop", "#fcRec"].forEach((selector) => {
    const control = ovl.querySelector(selector);
    if (control) control.disabled = true;
  });
  ovl.querySelectorAll("[data-rm-shot]").forEach((button) => {
    button.disabled = true;
  });
  const saveButton = ovl.querySelector("#fcSave");
  if (saveButton) saveButton.disabled = true;
  return true;
}

function finishCapture() {
  if (captureTornDown) return false;
  captureTornDown = true;
  freezeCaptureForSave();
  if (db.active) wakeLock.acquire();
  else wakeLock.release();
  endActiveWorkflow();
  closeModal(ovl);
  return true;
}

async function offerRecordedVideoAfterSave() {
  if (!hadRecorderAtFreeze) return;
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (!recBlob) return;
  if (
    await appConfirm("トラッキング動画をカメラロールに保存しますか？", {
      okLabel: "保存する",
    })
  ) {
    await shareRec();
  } else recBlob = null;
}
```

Replace replay `stop()` with:

```js
let replayFrozen = false;
let replayTornDown = false;

function freezeReplayForSave() {
  if (replayFrozen) return false;
  replayFrozen = true;
  running = false;
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  try {
    video.pause();
  } catch (error) {}
  const hand = ovl.querySelector("#frHand");
  const saveButton = ovl.querySelector("#frSave");
  if (hand) hand.disabled = true;
  if (saveButton) saveButton.disabled = true;
  return true;
}

function finishReplay() {
  if (replayTornDown) return false;
  replayTornDown = true;
  freezeReplayForSave();
  URL.revokeObjectURL(videoUrl);
  endActiveWorkflow();
  closeModal(ovl);
  return true;
}
```

Add the missing replay async guard exactly as follows:

```js
loadFormPose().then(async lm=>{
  if(!running) return;
  landmarker=lm;
```

- [ ] **Step 6: Add complete copied record builders and exact-debug prepare/attempt functions**

  In live capture, replace the two mutating record constructors with these closure helpers:

```js
function buildLiveFormRecord(includeDiagnostics, trackerSnapshot, zeroShot) {
  const todays = db.sessions.filter((session) => session.date === today());
  const linked = todays.length ? todays[todays.length - 1] : null;
  const record = {
    id: uid(),
    date: today(),
    ts: Date.now(),
    sessionId: linked ? linked.id : null,
    setupId: linked ? linked.setupId || null : null,
    shots: zeroShot ? 0 : shots.length,
    modelVer: "pose_landmarker_lite v1 (tasks-vision 0.10.14)",
    appVer: APP_VER,
    fps: +fps.toFixed(1),
    features: zeroShot ? [] : shots.map((shot) => formFeatureFromShot(shot, includeDiagnostics)),
    note: zeroShot ? "(診断用: 0射で保存)" : "",
  };
  if (!includeDiagnostics) return { record, linked };
  record.formDiagnosticVersion = 1;
  record.captureMode = "live";
  record.diag = formDiagSummary(zeroShot ? [] : shots, samplePerfMs);
  record.formPhaseDiag = {
    rejectedFramesNear: cloneData(formPhaseDiag.rejectedFramesNear),
    canceledEvents: cloneData(formPhaseDiag.canceledEvents),
    releaseFires: cloneData(formPhaseDiag.releaseFires),
    phaseHistogram: { ...phaseCounts },
    releaseReceipts: cloneData(trackerSnapshot.releaseReceipts),
    receiptOverflow: trackerSnapshot.receiptOverflow,
    receiptInvariantCounts: { ...trackerSnapshot.receiptInvariantCounts },
    receiptDesynchronized: trackerSnapshot.desynchronized,
  };
  return { record, linked };
}

let frozenDiagnosticSave = null;
let frozenDiagnosticLinked = null;

function prepareLiveDiagnosticSave(zeroShot) {
  if (frozenDiagnosticSave) {
    return { ok: true, code: null, frozen: frozenDiagnosticSave, linked: frozenDiagnosticLinked };
  }
  freezeCaptureForSave();
  if (tracker.current()) tracker.abandon("workflow-save");
  const trackerSnapshot = tracker.snapshot();
  const built = buildLiveFormRecord(true, trackerSnapshot, zeroShot);
  const created = createFrozenFormDiagnosticSave(db, built.record, {
    appVer: APP_VER,
    saveOptions: { reason: zeroShot ? "form-analysis-diag-only" : "form-analysis" },
    planMatrixRecord: planFormDiagnosticMatrixRecord,
  });
  if (created.ok) {
    frozenDiagnosticSave = created.frozen;
    frozenDiagnosticLinked = built.linked;
  }
  return { ...created, linked: built.linked };
}

function attemptLiveDiagnosticSave(zeroShot) {
  const prepared = prepareLiveDiagnosticSave(zeroShot);
  if (!prepared.ok) return { result: prepared, linked: prepared.linked };
  return {
    result: attemptFrozenFormDiagnosticSave(db, frozenDiagnosticSave, save),
    linked: prepared.linked,
  };
}
```

Add the replay counterparts; they must not call the planner because `captureMode` is `replay`:

```js
function buildReplayFormRecord(includeDiagnostics, trackerSnapshot, zeroShot) {
  const todays = db.sessions.filter((session) => session.date === today());
  const linked = todays.length ? todays[todays.length - 1] : null;
  const record = {
    id: uid(),
    date: today(),
    ts: Date.now(),
    sessionId: linked ? linked.id : null,
    setupId: linked ? linked.setupId || null : null,
    shots: zeroShot ? 0 : shots.length,
    modelVer: "pose_landmarker_lite v1 (tasks-vision 0.10.14)",
    appVer: APP_VER,
    fps: +fps.toFixed(1),
    features: zeroShot ? [] : shots.map((shot) => formFeatureFromShot(shot, includeDiagnostics)),
    note: zeroShot ? "(診断用: 0射で保存/保存済み動画)" : "(保存済み動画から解析)",
  };
  if (!includeDiagnostics) return { record, linked };
  record.formDiagnosticVersion = 1;
  record.captureMode = "replay";
  record.formPhaseDiag = {
    rejectedFramesNear: cloneData(formPhaseDiag.rejectedFramesNear),
    canceledEvents: cloneData(formPhaseDiag.canceledEvents),
    releaseFires: cloneData(formPhaseDiag.releaseFires),
    phaseHistogram: { ...phaseCounts },
    releaseReceipts: cloneData(trackerSnapshot.releaseReceipts),
    receiptOverflow: trackerSnapshot.receiptOverflow,
    receiptInvariantCounts: { ...trackerSnapshot.receiptInvariantCounts },
    receiptDesynchronized: trackerSnapshot.desynchronized,
  };
  return { record, linked };
}

let frozenDiagnosticSave = null;
let frozenDiagnosticLinked = null;

function prepareReplayDiagnosticSave(zeroShot) {
  if (frozenDiagnosticSave) {
    return { ok: true, code: null, frozen: frozenDiagnosticSave, linked: frozenDiagnosticLinked };
  }
  freezeReplayForSave();
  if (tracker.current()) tracker.abandon("workflow-save");
  const trackerSnapshot = tracker.snapshot();
  const built = buildReplayFormRecord(true, trackerSnapshot, zeroShot);
  const created = createFrozenFormDiagnosticSave(db, built.record, {
    appVer: APP_VER,
    saveOptions: { reason: zeroShot ? "form-analysis-diag-only" : "form-analysis" },
    planMatrixRecord: planFormDiagnosticMatrixRecord,
  });
  if (created.ok) {
    frozenDiagnosticSave = created.frozen;
    frozenDiagnosticLinked = built.linked;
  }
  return { ...created, linked: built.linked };
}

function attemptReplayDiagnosticSave(zeroShot) {
  const prepared = prepareReplayDiagnosticSave(zeroShot);
  if (!prepared.ok) return { result: prepared, linked: prepared.linked };
  return {
    result: attemptFrozenFormDiagnosticSave(db, frozenDiagnosticSave, save),
    linked: prepared.linked,
  };
}
```

- [ ] **Step 7: Replace live/replay save and close handlers with exact retry/discard control**

  Use this complete live save-result helper and handlers:

```js
async function finishLiveDiagnosticAttempt(zeroShot) {
  const { result, linked } = attemptLiveDiagnosticSave(zeroShot);
  const saveButton = ovl.querySelector("#fcSave");
  if (!result.ok) {
    hud.textContent =
      result.code === "diagnostics-disabled" || result.code === "coordinator-changed"
        ? "診断設定または18射バッチが変わったため、保存を再試行できません。"
        : "診断を保存できませんでした。保存を再試行するか、閉じて破棄してください。";
    saveButton.disabled = false;
    saveButton.textContent = "保存を再試行";
    return false;
  }
  const matrixNotice =
    !zeroShot && frozenDiagnosticSave.record.captureMode === "live"
      ? frozenDiagnosticSave.matrixAdvanced
        ? "診断バッチに追加しました"
        : [
              "coordinator-missing",
              "coordinator-invalid",
              "coordinator-stale",
              "coordinator-complete",
            ].includes(frozenDiagnosticSave.matrixCode)
          ? "18射の診断を開始し直してください"
          : "診断条件を満たさなかったため、同じ条件をもう一度記録してください"
      : null;
  toast(
    matrixNotice ||
      (zeroShot
        ? "診断用に0射で保存しました"
        : linked
          ? `射形記録を保存し、今日の練習に紐付けました（${shots.length}射）`
          : `射形記録を保存しました（${shots.length}射）`),
  );
  nativePulse("success");
  finishCapture();
  render();
  await offerRecordedVideoAfterSave();
  return true;
}

ovl.querySelector("#fcSave").onclick = async () => {
  if (frozenDiagnosticSave) {
    await finishLiveDiagnosticAttempt(frozenDiagnosticSave.record.shots === 0);
    return;
  }
  if (db.settings.formDebug === true) {
    await finishLiveDiagnosticAttempt(shots.length === 0);
    return;
  }
  if (!shots.length) return;
  if (tracker.current()) tracker.abandon("workflow-save");
  const { record, linked } = buildLiveFormRecord(false, null, false);
  db.formAnalyses = db.formAnalyses || [];
  db.formAnalyses.push(record);
  save({ reason: "form-analysis" });
  toast(
    linked
      ? `射形記録を保存し、今日の練習に紐付けました（${shots.length}射）`
      : `射形記録を保存しました（${shots.length}射）`,
  );
  nativePulse("success");
  finishCapture();
  render();
  await offerRecordedVideoAfterSave();
};

ovl.querySelector("#fcClose").onclick = async () => {
  if (frozenDiagnosticSave && !frozenDiagnosticSave.committed) {
    const discard = await appConfirm("保存できていない診断を破棄して閉じますか？", {
      danger: true,
      okLabel: "破棄して閉じる",
    });
    if (!discard) return;
    frozenDiagnosticSave = null;
    finishCapture();
    return;
  }
  if (!shots.length && db.settings.formDebug === true) {
    await finishLiveDiagnosticAttempt(true);
    return;
  }
  if (!shots.length) {
    if (tracker.current()) tracker.abandon("workflow-close");
    finishCapture();
    return;
  }
  if (
    await appConfirm(`${shots.length}射の解析結果を保存せずに閉じますか？`, {
      danger: true,
      okLabel: "閉じる",
    })
  ) {
    if (tracker.current()) tracker.abandon("workflow-close");
    finishCapture();
  }
};
```

Use this complete replay result helper and equivalent handlers:

```js
function finishReplayDiagnosticAttempt(zeroShot) {
  const { result, linked } = attemptReplayDiagnosticSave(zeroShot);
  const saveButton = ovl.querySelector("#frSave");
  if (!result.ok) {
    hud.textContent =
      result.code === "diagnostics-disabled" || result.code === "coordinator-changed"
        ? "診断設定または18射バッチが変わったため、保存を再試行できません。"
        : "診断を保存できませんでした。保存を再試行するか、閉じて破棄してください。";
    saveButton.disabled = false;
    saveButton.textContent = "保存を再試行";
    return false;
  }
  toast(
    zeroShot
      ? "診断用に0射で保存しました"
      : linked
        ? `射形記録を保存し、今日の練習に紐付けました（${shots.length}射）`
        : `射形記録を保存しました（${shots.length}射）`,
  );
  nativePulse("success");
  finishReplay();
  render();
  return true;
}

ovl.querySelector("#frSave").onclick = () => {
  if (frozenDiagnosticSave) {
    finishReplayDiagnosticAttempt(frozenDiagnosticSave.record.shots === 0);
    return;
  }
  if (db.settings.formDebug === true) {
    finishReplayDiagnosticAttempt(shots.length === 0);
    return;
  }
  if (!shots.length) return;
  if (tracker.current()) tracker.abandon("workflow-save");
  const { record, linked } = buildReplayFormRecord(false, null, false);
  db.formAnalyses = db.formAnalyses || [];
  db.formAnalyses.push(record);
  save({ reason: "form-analysis" });
  toast(
    linked
      ? `射形記録を保存し、今日の練習に紐付けました（${shots.length}射）`
      : `射形記録を保存しました（${shots.length}射）`,
  );
  nativePulse("success");
  finishReplay();
  render();
};

ovl.querySelector("#frClose").onclick = async () => {
  if (frozenDiagnosticSave && !frozenDiagnosticSave.committed) {
    const discard = await appConfirm("保存できていない診断を破棄して閉じますか？", {
      danger: true,
      okLabel: "破棄して閉じる",
    });
    if (!discard) return;
    frozenDiagnosticSave = null;
    finishReplay();
    return;
  }
  if (!shots.length && db.settings.formDebug === true) {
    finishReplayDiagnosticAttempt(true);
    return;
  }
  if (!shots.length) {
    if (tracker.current()) tracker.abandon("workflow-close");
    finishReplay();
    return;
  }
  if (
    await appConfirm(`${shots.length}射の解析結果を保存せずに閉じますか？`, {
      danger: true,
      okLabel: "閉じる",
    })
  ) {
    if (tracker.current()) tracker.abandon("workflow-close");
    finishReplay();
  }
};
```

Preserve the Task-2 replay-EOS transition before setting `running=false`:

```js
if (video.ended && running) {
  if (tracker.current()) tracker.abandon("replay-eos");
  phaseEl.textContent = "完了";
  hud.innerHTML = `解析完了 ・ ${shots.length}射を検出しました`;
  running = false;
  return;
}
```

- [ ] **Step 8: Add real-storage live/replay retry and discard Playwright RED/GREEN cases**

  Append these helpers and live test to the Task-6 E2E file. It exercises the real `save() -> writeDbNow()` path rather than replacing `saveFn`:

```js
async function stallFormPose(page) {
  await page.evaluate(() => {
    globalThis.loadFormPose = () => new Promise(() => {});
  });
}

test("zero-shot exact-debug live save freezes, rolls back, and retries once", async ({ page }) => {
  const database = makeSyntheticDiagnosticDb({
    updatedAt: "before-live-save",
    settings: {
      formDebug: true,
      formDiagnosticMatrixBatch: {
        version: 1,
        batchId: "11111111-1111-4111-8111-111111111111",
        appVer: 84,
        nextSlot: 0,
        recordIds: [],
        invalidated: false,
      },
    },
  });
  await seedDiagnosticDb(page, database);
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await stallFormPose(page);
  await installPrimaryWriteGate(page);

  await page.locator("#formStart").click();
  await page.locator("#fcClose").click();

  await expect(page.locator(".formCapture")).toBeVisible();
  await expect(page.locator("#fcSave")).toBeEnabled();
  await expect(page.locator("#fcSave")).toHaveText("保存を再試行");
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      updatedAt: db.updatedAt,
      attempts: globalThis.__formWriteProbe.attempts.length,
      blocked: isUpdateReloadBlocked(),
    })),
  ).toEqual({
    records: 0,
    updatedAt: "before-live-save",
    attempts: 1,
    blocked: true,
  });

  await page.evaluate(() => {
    globalThis.__formWriteProbe.fail = false;
  });
  await page.locator("#fcSave").click();
  await expect(page.locator(".formCapture")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      shots: db.formAnalyses[0].shots,
      mode: db.formAnalyses[0].captureMode,
      marker: Object.hasOwn(db.formAnalyses[0], "formDiagnosticMatrix"),
      attempts: globalThis.__formWriteProbe.attempts.length,
      blocked: isUpdateReloadBlocked(),
    })),
  ).toEqual({
    records: 1,
    shots: 0,
    mode: "live",
    marker: false,
    attempts: 2,
    blocked: false,
  });
});
```

Add discard cancellation/confirmation:

```js
test("failed diagnostic discard cancel retains the candidate and confirm closes without saving", async ({
  page,
}) => {
  await seedDiagnosticDb(page, makeSyntheticDiagnosticDb({ settings: { formDebug: true } }));
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await stallFormPose(page);
  await installPrimaryWriteGate(page);
  await page.locator("#formStart").click();
  await page.locator("#fcClose").click();
  await page.locator("#fcClose").click();
  await expect(page.locator(".confirmSheet")).toContainText(
    "保存できていない診断を破棄して閉じますか？",
  );
  await page.locator(".confirmSheet #acCancel").click();
  await expect(page.locator(".formCapture")).toBeVisible();
  expect(await page.evaluate(() => globalThis.__formWriteProbe.attempts.length)).toBe(1);
  await page.locator("#fcClose").click();
  await page.locator(".confirmSheet #acOk").click();
  await expect(page.locator(".formCapture")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      attempts: globalThis.__formWriteProbe.attempts.length,
      blocked: isUpdateReloadBlocked(),
    })),
  ).toEqual({ records: 0, attempts: 1, blocked: false });
});
```

Add the complete replay counterpart:

```js
test("zero-shot exact-debug replay save retries without matrix advancement", async ({ page }) => {
  const coordinator = {
    version: 1,
    batchId: "11111111-1111-4111-8111-111111111111",
    appVer: 84,
    nextSlot: 0,
    recordIds: [],
    invalidated: false,
  };
  await seedDiagnosticDb(
    page,
    makeSyntheticDiagnosticDb({
      updatedAt: "before-replay-save",
      settings: { formDebug: true, formDiagnosticMatrixBatch: coordinator },
    }),
  );
  await page.goto("/");
  await page.locator('#tabs [data-v="analysis"]').click();
  await stallFormPose(page);
  await installPrimaryWriteGate(page);
  await page.evaluate(() => {
    globalThis.__replayCoordinatorReference = db.settings.formDiagnosticMatrixBatch;
  });

  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("#formReplay").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "synthetic-form-replay.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("synthetic replay fixture"),
  });
  await expect(page.locator("#frVideo")).toBeVisible();
  await page.locator("#frClose").click();

  await expect(page.locator(".formCapture")).toBeVisible();
  await expect(page.locator("#frSave")).toBeEnabled();
  await expect(page.locator("#frSave")).toHaveText("保存を再試行");
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      sameCoordinator:
        db.settings.formDiagnosticMatrixBatch === globalThis.__replayCoordinatorReference,
      updatedAt: db.updatedAt,
      attempts: globalThis.__formWriteProbe.attempts.length,
      blocked: isUpdateReloadBlocked(),
    })),
  ).toEqual({
    records: 0,
    sameCoordinator: true,
    updatedAt: "before-replay-save",
    attempts: 1,
    blocked: true,
  });

  await page.evaluate(() => {
    globalThis.__formWriteProbe.fail = false;
  });
  await page.locator("#frSave").click();
  await expect(page.locator(".formCapture")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      records: db.formAnalyses.length,
      shots: db.formAnalyses[0].shots,
      mode: db.formAnalyses[0].captureMode,
      marker: Object.hasOwn(db.formAnalyses[0], "formDiagnosticMatrix"),
      sameCoordinator:
        db.settings.formDiagnosticMatrixBatch === globalThis.__replayCoordinatorReference,
      attempts: globalThis.__formWriteProbe.attempts.length,
      blocked: isUpdateReloadBlocked(),
    })),
  ).toEqual({
    records: 1,
    shots: 0,
    mode: "replay",
    marker: false,
    sameCoordinator: true,
    attempts: 2,
    blocked: false,
  });
});
```

Before implementing Steps 5-7, run:

```powershell
npx playwright test tests/e2e/form-diagnostics.spec.js --project=chromium --grep "zero-shot exact-debug|failed diagnostic discard"
```

Expected RED: the current zero-shot diagnostic close closes the modal after the failed write instead of showing `保存を再試行`.

- [ ] **Step 9: Run complete Task 7 GREEN verification**

  Run:

  ```powershell
  node tools/check-form-core.js
  node tools/check-form-diagnostics.js
  npx playwright test tests/e2e/form-diagnostics.spec.js --project=chromium
  npm run check:form
  npm run check:storage
  npm run check:app
  npm run check:globals
  npm run lint -- --quiet
  ```

  Expected: every command exits `0`. The focused tests must prove success, false, throw, retry success/failure, exact-debug OFF before initial attempt and retry, discard cancel/confirm, zero-shot/replay planner count zero, replay EOS, matrix coordinator replacement/mutation, ineligible six-shot save, legacy diagnostic-off payload, idempotent freeze, one copied record, and post-freeze mutation isolation.

- [ ] **Step 10: Format, document, and commit Task 7**

  Update the progress ledger with both Task-7 REDs, call counts, candidate identity evidence, browser rollback evidence, and GREEN output. Then run:

  ```powershell
  npx prettier --check tools/check-form-core.js tools/check-form-diagnostics.js tests/e2e/form-diagnostics.spec.js docs/codex/codex-progress.md
  git status --short
  git diff --check
  git add scripts/47-form-view.js tools/check-form-core.js tools/check-form-diagnostics.js tests/e2e/form-diagnostics.spec.js docs/codex/codex-progress.md
  git diff --check --cached
  git commit -m "fix(form): make diagnostic saves transactional"
  ```

  Expected: all checks exit `0`; the commit uses the exact subject above.

---

### Task 8: Add a diagnostics-specific single-transport share wrapper

**Files:**

- Modify: `scripts/10-storage-native.js:633-666` (insert after, never inside, `shareOrDownloadText`)
- Modify: `tools/check-form-diagnostics.js` (conditional loader, awaited transport matrix, source guards)
- Modify: `docs/codex/codex-progress.md:end`

**Interfaces:**

- Consumes: one already validated JSON string. This wrapper does not parse or rebuild the artifact.
- Produces `shareFormDiagnosticsJson(json, environment?) -> Promise<{ status, cleanupFailed }>` where `status` is exactly `shared`, `downloaded`, `canceled`, or `failed`, and the result has no third key.
- Passing `undefined` alone selects `defaultFormDiagnosticTransportEnvironment()`. A supplied environment is the complete adapter; production must not fill any missing supplied field from browser globals or Capacitor plugins.
- The exact injected/default environment is:

  ```js
  {
    navigator, // null or { canShare?, share? }
    FileCtor, // File constructor or null
    BlobCtor, // Blob constructor or null
    document, // null or createElement/body append surface
    urlApi, // null or createObjectURL/revokeObjectURL surface
    filesystem, // null or Capacitor Filesystem plugin
    nativeShare, // null or Capacitor Share plugin
  }
  ```

- Fixed transport constants are:

  ```js
  const FORM_DIAGNOSTIC_FILENAME = "archery-note-form-diagnostics.json";
  const FORM_DIAGNOSTIC_MIME = "application/json;charset=utf-8";
  const FORM_DIAGNOSTIC_NATIVE_PATH = "archery-note-form-diagnostics.json";
  const FORM_DIAGNOSTIC_NATIVE_DIRECTORY = "CACHE";
  const FORM_DIAGNOSTIC_NATIVE_ENCODING = "utf8";
  const FORM_DIAGNOSTIC_NATIVE_NOT_FOUND = "OS-PLUG-FILE-0008";
  ```

- [ ] **Step 1: Add the conditional transport loader and exact fixture adapter**

  Add this block to `tools/check-form-diagnostics.js` beside its existing bounded loaders. The unchanged production source must load with a `null` API so the first RED is about the missing function, not a parser failure.

  ```js
  function loadFormDiagnosticTransportApi() {
    const storageSource = fs.readFileSync(
      path.join(root, "scripts", "10-storage-native.js"),
      "utf8",
    );
    const startMarker = "/* FORM_DIAGNOSTIC_TRANSPORT_START */";
    const endMarker = "/* FORM_DIAGNOSTIC_TRANSPORT_END */";
    const start = storageSource.indexOf(startMarker);
    const end = storageSource.indexOf(endMarker);
    if (start < 0 || end <= start) {
      return {
        api: { shareFormDiagnosticsJson: null },
        source: "",
      };
    }
    const source = storageSource.slice(start, end + endMarker.length);
    const api = new Function(
      "capPlugin",
      `${source}
  return {
    FORM_DIAGNOSTIC_FILENAME,
    FORM_DIAGNOSTIC_MIME,
    FORM_DIAGNOSTIC_NATIVE_PATH,
    FORM_DIAGNOSTIC_NATIVE_DIRECTORY,
    FORM_DIAGNOSTIC_NATIVE_ENCODING,
    defaultFormDiagnosticTransportEnvironment,
    shareFormDiagnosticsJson
  };`,
    )(() => null);
    return { api, source };
  }

  function makeTransportFixture() {
    const calls = [];
    class FixtureFile {
      constructor(parts, name, options) {
        this.parts = parts.slice();
        this.name = name;
        this.type = options.type;
        calls.push({ op: "file", value: this });
      }
    }
    class FixtureBlob {
      constructor(parts, options) {
        this.parts = parts.slice();
        this.type = options.type;
        calls.push({ op: "blob", value: this });
      }
    }
    const anchor = {
      href: "",
      download: "",
      click() {
        calls.push({ op: "anchor-click", value: this });
      },
      remove() {
        calls.push({ op: "anchor-remove", value: this });
      },
    };
    const environment = {
      navigator: {
        canShare(data) {
          calls.push({ op: "can-share", data });
          return false;
        },
        async share(data) {
          calls.push({ op: "web-share", data });
        },
      },
      FileCtor: FixtureFile,
      BlobCtor: FixtureBlob,
      document: {
        body: {
          appendChild(value) {
            calls.push({ op: "anchor-append", value });
          },
        },
        createElement(tag) {
          calls.push({ op: "anchor-create", tag });
          return anchor;
        },
      },
      urlApi: {
        createObjectURL(value) {
          calls.push({ op: "url-create", value });
          return "blob:form-diagnostic-fixture";
        },
        revokeObjectURL(value) {
          calls.push({ op: "url-revoke", value });
        },
      },
      filesystem: null,
      nativeShare: null,
    };
    return { calls, environment, anchor };
  }

  function callOps(calls) {
    return calls.map((call) => call.op);
  }

  function exactResult(result, status, cleanupFailed, label) {
    assertEqual(
      JSON.stringify(Object.keys(result)),
      JSON.stringify(["status", "cleanupFailed"]),
      label + " exact result keys",
    );
    assertEqual(result.status, status, label + " status");
    assertEqual(result.cleanupFailed, cleanupFailed, label + " cleanup flag");
  }

  function nativeNotFound() {
    const error = new Error("fixture not found");
    error.code = "OS-PLUG-FILE-0008";
    return error;
  }
  ```

- [ ] **Step 2: Add the complete no-fallback transport matrix before production code**

  Add the following awaited test function. It covers selection, cancellation classification, native cleanup ownership, direct cleanup independence, exact MIME/path/payloads, supplied-environment isolation, and forbidden side effects.

  ```js
  async function checkFormDiagnosticTransport() {
    const { api, source } = loadFormDiagnosticTransportApi();
    assert(
      typeof api.shareFormDiagnosticsJson === "function",
      "shareFormDiagnosticsJson is a function",
    );
    const json = '{"format":"archery-note-form-diagnostics"}\n';

    {
      const fixture = makeTransportFixture();
      fixture.environment.navigator.canShare = (data) => {
        fixture.calls.push({ op: "can-share", data });
        return true;
      };
      fixture.environment.filesystem = {
        async deleteFile() {
          fixture.calls.push({ op: "native-delete" });
        },
        async writeFile() {
          fixture.calls.push({ op: "native-write" });
          return { uri: "cache://unused" };
        },
      };
      fixture.environment.nativeShare = {
        async share() {
          fixture.calls.push({ op: "native-share" });
        },
      };
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, "shared", false, "web priority");
      assertEqual(
        JSON.stringify(callOps(fixture.calls)),
        JSON.stringify(["file", "can-share", "web-share"]),
        "web priority locks one transport",
      );
      const file = fixture.calls[0].value;
      assertEqual(file.name, api.FORM_DIAGNOSTIC_FILENAME, "web filename");
      assertEqual(file.type, api.FORM_DIAGNOSTIC_MIME, "web MIME");
      assertEqual(file.parts[0], json, "web content");
      assert(
        fixture.calls[1].data.files[0] === file && fixture.calls[2].data.files[0] === file,
        "canShare and share reuse the same File",
      );
    }

    for (const [label, error, status] of [
      ["web AbortError", Object.assign(new Error("abort"), { name: "AbortError" }), "canceled"],
      ["web Share canceled message", new Error("Share canceled"), "failed"],
      ["web generic rejection", new Error("fixture web failure"), "failed"],
    ]) {
      const fixture = makeTransportFixture();
      fixture.environment.navigator.canShare = () => true;
      fixture.environment.navigator.share = async (data) => {
        fixture.calls.push({ op: "web-share", data });
        throw error;
      };
      fixture.environment.filesystem = {
        async deleteFile() {
          fixture.calls.push({ op: "native-delete" });
        },
        async writeFile() {
          fixture.calls.push({ op: "native-write" });
          return { uri: "cache://unused" };
        },
      };
      fixture.environment.nativeShare = {
        async share() {
          fixture.calls.push({ op: "native-share" });
        },
      };
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, status, false, label);
      assertEqual(
        JSON.stringify(callOps(fixture.calls)),
        JSON.stringify(["file", "web-share"]),
        label + " has no native/download fallback",
      );
    }

    for (const probe of [false, "true", new Error("probe failure")]) {
      const fixture = makeTransportFixture();
      fixture.environment.navigator.canShare = (data) => {
        fixture.calls.push({ op: "can-share", data });
        if (probe instanceof Error) throw probe;
        return probe;
      };
      fixture.environment.filesystem = {
        async deleteFile(options) {
          fixture.calls.push({ op: "native-delete", options });
        },
        async writeFile(options) {
          fixture.calls.push({ op: "native-write", options });
          return { uri: "cache://selected-native" };
        },
      };
      fixture.environment.nativeShare = {
        async share(options) {
          fixture.calls.push({ op: "native-share", options });
        },
      };
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, "shared", false, "web probe refusal");
      assert(
        callOps(fixture.calls).includes("native-share"),
        "native selected after web probe refusal",
      );
      assert(!callOps(fixture.calls).includes("url-create"), "native selection skips download");
    }

    {
      const fixture = makeTransportFixture();
      fixture.environment.FileCtor = class ThrowingFile {
        constructor() {
          fixture.calls.push({ op: "file-throw" });
          throw new Error("file construction failed");
        }
      };
      fixture.environment.filesystem = {
        async deleteFile() {
          fixture.calls.push({ op: "native-delete" });
        },
        async writeFile() {
          fixture.calls.push({ op: "native-write" });
          return { uri: "cache://selected-native" };
        },
      };
      fixture.environment.nativeShare = {
        async share() {
          fixture.calls.push({ op: "native-share" });
        },
      };
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, "shared", false, "File construction refusal");
      assert(
        callOps(fixture.calls).includes("native-share"),
        "File construction failure occurs before selection",
      );
    }

    for (const [label, shareError, status] of [
      ["native AbortError", Object.assign(new Error("abort"), { name: "AbortError" }), "canceled"],
      ["native exact message", new Error("Share canceled"), "canceled"],
      ["native message case mismatch", new Error("share canceled"), "failed"],
      ["native message suffix", new Error("Share canceled by fixture"), "failed"],
      ["native generic error", new Error("native failed"), "failed"],
    ]) {
      const fixture = makeTransportFixture();
      fixture.environment.navigator.canShare = () => false;
      let deletes = 0;
      fixture.environment.filesystem = {
        async deleteFile(options) {
          deletes += 1;
          fixture.calls.push({ op: "native-delete", options });
          if (deletes === 1) throw nativeNotFound();
        },
        async writeFile(options) {
          fixture.calls.push({ op: "native-write", options });
          return { uri: "cache://diagnostic-result" };
        },
      };
      fixture.environment.nativeShare = {
        async share(options) {
          fixture.calls.push({ op: "native-share", options });
          throw shareError;
        },
      };
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, status, false, label);
      assertEqual(deletes, 2, label + " performs stale and final deletion");
      assert(!callOps(fixture.calls).includes("url-create"), label + " never downloads");
      const write = fixture.calls.find((call) => call.op === "native-write").options;
      assertEqual(
        JSON.stringify(write),
        JSON.stringify({
          path: "archery-note-form-diagnostics.json",
          data: json,
          directory: "CACHE",
          encoding: "utf8",
        }),
        label + " exact write options",
      );
      const share = fixture.calls.find((call) => call.op === "native-share").options;
      assertEqual(
        JSON.stringify(share),
        JSON.stringify({ url: "cache://diagnostic-result" }),
        label + " shares only the returned URI",
      );
    }

    for (const writeFailure of [
      new Error("write failed"),
      Object.assign(new Error("write abort"), { name: "AbortError" }),
      new Error("Share canceled"),
    ]) {
      const fixture = makeTransportFixture();
      fixture.environment.navigator.canShare = () => false;
      let deletes = 0;
      fixture.environment.filesystem = {
        async deleteFile() {
          deletes += 1;
          fixture.calls.push({ op: "native-delete" });
        },
        async writeFile() {
          fixture.calls.push({ op: "native-write" });
          throw writeFailure;
        },
      };
      fixture.environment.nativeShare = {
        async share() {
          fixture.calls.push({ op: "native-share" });
        },
      };
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, "failed", false, "native write failure");
      assertEqual(deletes, 2, "write failure still final-cleans");
      assert(!callOps(fixture.calls).includes("native-share"), "write failure never shares");
      assert(!callOps(fixture.calls).includes("url-create"), "write failure never downloads");
    }

    for (const uri of [undefined, null, "", "   "]) {
      const fixture = makeTransportFixture();
      fixture.environment.navigator.canShare = () => false;
      let deletes = 0;
      fixture.environment.filesystem = {
        async deleteFile() {
          deletes += 1;
          fixture.calls.push({ op: "native-delete" });
        },
        async writeFile() {
          fixture.calls.push({ op: "native-write" });
          return { uri };
        },
      };
      fixture.environment.nativeShare = {
        async share() {
          fixture.calls.push({ op: "native-share" });
        },
      };
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, "failed", false, "invalid native URI");
      assertEqual(deletes, 2, "invalid URI still final-cleans");
      assert(!callOps(fixture.calls).includes("native-share"), "invalid URI never shares");
    }

    {
      const fixture = makeTransportFixture();
      fixture.environment.navigator.canShare = () => false;
      fixture.environment.filesystem = {
        async deleteFile() {
          fixture.calls.push({ op: "native-delete" });
          throw new Error("stale delete failed");
        },
        async writeFile() {
          fixture.calls.push({ op: "native-write" });
          return { uri: "cache://unused" };
        },
      };
      fixture.environment.nativeShare = {
        async share() {
          fixture.calls.push({ op: "native-share" });
        },
      };
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, "failed", true, "stale delete failure");
      assertEqual(
        JSON.stringify(callOps(fixture.calls)),
        JSON.stringify(["file", "native-delete"]),
        "stale delete failure prevents write/share/download",
      );
    }

    for (const primary of ["success", "cancel", "share-error", "write-error"]) {
      const fixture = makeTransportFixture();
      fixture.environment.navigator.canShare = () => false;
      let deletes = 0;
      fixture.environment.filesystem = {
        async deleteFile() {
          deletes += 1;
          fixture.calls.push({ op: "native-delete" });
          if (deletes === 2) throw new Error("final cleanup failed");
        },
        async writeFile() {
          fixture.calls.push({ op: "native-write" });
          if (primary === "write-error") throw new Error("write failed");
          return { uri: "cache://diagnostic-result" };
        },
      };
      fixture.environment.nativeShare = {
        async share() {
          fixture.calls.push({ op: "native-share" });
          if (primary === "cancel") {
            throw Object.assign(new Error("abort"), { name: "AbortError" });
          }
          if (primary === "share-error") throw new Error("share failed");
        },
      };
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      const expected =
        primary === "success" ? "shared" : primary === "cancel" ? "canceled" : "failed";
      exactResult(result, expected, true, primary + " with final cleanup failure");
      assert(!callOps(fixture.calls).includes("url-create"), "cleanup failure has no fallback");
    }

    for (const missing of ["deleteFile", "writeFile", "share"]) {
      const fixture = makeTransportFixture();
      fixture.environment.navigator.canShare = () => false;
      fixture.environment.filesystem = {
        async deleteFile() {
          fixture.calls.push({ op: "native-delete" });
        },
        async writeFile() {
          fixture.calls.push({ op: "native-write" });
          return { uri: "cache://unused" };
        },
      };
      fixture.environment.nativeShare = {
        async share() {
          fixture.calls.push({ op: "native-share" });
        },
      };
      if (missing === "share") fixture.environment.nativeShare.share = null;
      else fixture.environment.filesystem[missing] = null;
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, "downloaded", false, "missing native " + missing);
      assert(!callOps(fixture.calls).includes("native-delete"), "partial native is never entered");
    }

    {
      const fixture = makeTransportFixture();
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, "downloaded", false, "direct download");
      assertEqual(fixture.anchor.download, api.FORM_DIAGNOSTIC_FILENAME, "download filename");
      assertEqual(fixture.anchor.href, "blob:form-diagnostic-fixture", "download URL");
      const blob = fixture.calls.find((call) => call.op === "blob").value;
      assertEqual(blob.type, api.FORM_DIAGNOSTIC_MIME, "download MIME");
      assertEqual(blob.parts[0], json, "download content");
      assertEqual(
        JSON.stringify(callOps(fixture.calls)),
        JSON.stringify([
          "file",
          "can-share",
          "blob",
          "url-create",
          "anchor-create",
          "anchor-append",
          "anchor-click",
          "anchor-remove",
          "url-revoke",
        ]),
        "direct download cleanup order",
      );
    }

    for (const failingOp of [
      "blob",
      "url-create",
      "anchor-create",
      "anchor-append",
      "anchor-click",
      "anchor-remove",
      "url-revoke",
    ]) {
      const fixture = makeTransportFixture();
      if (failingOp === "blob") {
        fixture.environment.BlobCtor = class ThrowingBlob {
          constructor() {
            throw new Error("blob failed");
          }
        };
      }
      if (failingOp === "url-create") {
        fixture.environment.urlApi.createObjectURL = () => {
          throw new Error("URL failed");
        };
      }
      if (failingOp === "anchor-create") {
        fixture.environment.document.createElement = () => {
          throw new Error("anchor failed");
        };
      }
      if (failingOp === "anchor-append") {
        fixture.environment.document.body.appendChild = () => {
          throw new Error("append failed");
        };
      }
      if (failingOp === "anchor-click") {
        fixture.anchor.click = () => {
          throw new Error("click failed");
        };
      }
      if (failingOp === "anchor-remove") {
        fixture.anchor.remove = () => {
          fixture.calls.push({ op: "anchor-remove-error" });
          throw new Error("remove failed");
        };
      }
      if (failingOp === "url-revoke") {
        fixture.environment.urlApi.revokeObjectURL = (value) => {
          fixture.calls.push({ op: "url-revoke-error", value });
          throw new Error("revoke failed");
        };
      }
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, "failed", false, "direct " + failingOp + " failure");
      if (failingOp === "anchor-remove") {
        assert(callOps(fixture.calls).includes("url-revoke"), "remove failure still revokes");
      }
      if (failingOp === "url-revoke") {
        assert(callOps(fixture.calls).includes("anchor-remove"), "revoke failure follows removal");
      }
    }

    {
      const fixture = makeTransportFixture();
      fixture.environment.BlobCtor = null;
      fixture.environment.document = null;
      fixture.environment.urlApi = null;
      const result = await api.shareFormDiagnosticsJson(json, fixture.environment);
      exactResult(result, "failed", false, "missing direct primitives");
    }

    {
      const fixture = makeTransportFixture();
      const result = await api.shareFormDiagnosticsJson(null, fixture.environment);
      exactResult(result, "failed", false, "non-string input");
      assertEqual(fixture.calls.length, 0, "non-string input performs no transport work");
    }

    for (const forbidden of [
      "shareOrDownloadText",
      "toast(",
      "nativePulse",
      "lastBackupAt",
      "writeSafetySnapshot",
      "scheduleSafetySnapshot",
      "JSON.stringify(db",
      "save(",
    ]) {
      assert(!source.includes(forbidden), "transport source excludes " + forbidden);
    }
  }
  ```

  Convert the existing diagnostics entrypoint to await every transport assertion:

  ```js
  async function main() {
    runExistingFormDiagnosticChecks();
    await checkFormDiagnosticTransport();
    console.log("Form diagnostic checks OK");
  }

  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  ```

- [ ] **Step 3: Run the missing-function RED**

  Run:

  ```powershell
  node tools/check-form-diagnostics.js
  ```

  Expected: exit `1` with `shareFormDiagnosticsJson is a function`. Do not accept a syntax error, missing fixture, or unawaited rejection as RED evidence.

- [ ] **Step 4: Implement the exact default adapter and locked transport state machine**

  Insert this complete block after the unchanged generic `shareOrDownloadText()` and before `csvCell()`. Selection returns one discriminated choice, and the `switch` never re-enters selection after web/native/download is chosen.

  ```js
  /* FORM_DIAGNOSTIC_TRANSPORT_START */
  const FORM_DIAGNOSTIC_FILENAME = "archery-note-form-diagnostics.json";
  const FORM_DIAGNOSTIC_MIME = "application/json;charset=utf-8";
  const FORM_DIAGNOSTIC_NATIVE_PATH = "archery-note-form-diagnostics.json";
  const FORM_DIAGNOSTIC_NATIVE_DIRECTORY = "CACHE";
  const FORM_DIAGNOSTIC_NATIVE_ENCODING = "utf8";
  const FORM_DIAGNOSTIC_NATIVE_NOT_FOUND = "OS-PLUG-FILE-0008";

  function defaultFormDiagnosticTransportEnvironment() {
    return {
      navigator: typeof navigator !== "undefined" ? navigator : null,
      FileCtor: typeof File === "function" ? File : null,
      BlobCtor: typeof Blob === "function" ? Blob : null,
      document: typeof document !== "undefined" ? document : null,
      urlApi: typeof URL !== "undefined" ? URL : null,
      filesystem: capPlugin("Filesystem"),
      nativeShare: capPlugin("Share"),
    };
  }

  function formDiagnosticNativeNotFound(error) {
    return !!error && error.code === FORM_DIAGNOSTIC_NATIVE_NOT_FOUND;
  }

  function formDiagnosticWebCanceled(error) {
    return !!error && error.name === "AbortError";
  }

  function formDiagnosticNativeCanceled(error) {
    return formDiagnosticWebCanceled(error) || (!!error && error.message === "Share canceled");
  }

  function selectFormDiagnosticTransport(json, environment) {
    const nav = environment && environment.navigator;
    if (
      environment &&
      typeof environment.FileCtor === "function" &&
      nav &&
      typeof nav.canShare === "function" &&
      typeof nav.share === "function"
    ) {
      try {
        const file = new environment.FileCtor([json], FORM_DIAGNOSTIC_FILENAME, {
          type: FORM_DIAGNOSTIC_MIME,
        });
        if (nav.canShare({ files: [file] }) === true) {
          return { kind: "web", environment, file };
        }
      } catch (error) {}
    }

    const fs = environment && environment.filesystem;
    const sh = environment && environment.nativeShare;
    if (
      fs &&
      sh &&
      typeof fs.deleteFile === "function" &&
      typeof fs.writeFile === "function" &&
      typeof sh.share === "function"
    ) {
      return { kind: "native", environment };
    }
    return { kind: "download", environment };
  }

  async function runFormDiagnosticWebShare(choice) {
    try {
      await choice.environment.navigator.share({ files: [choice.file] });
      return { status: "shared", cleanupFailed: false };
    } catch (error) {
      return {
        status: formDiagnosticWebCanceled(error) ? "canceled" : "failed",
        cleanupFailed: false,
      };
    }
  }

  async function runFormDiagnosticNativeShare(choice, json) {
    const fs = choice.environment.filesystem;
    const sh = choice.environment.nativeShare;
    const deleteOptions = {
      path: FORM_DIAGNOSTIC_NATIVE_PATH,
      directory: FORM_DIAGNOSTIC_NATIVE_DIRECTORY,
    };
    try {
      await fs.deleteFile(deleteOptions);
    } catch (error) {
      if (!formDiagnosticNativeNotFound(error)) {
        return { status: "failed", cleanupFailed: true };
      }
    }

    let status = "failed";
    let cleanupFailed = false;
    try {
      const written = await fs.writeFile({
        path: FORM_DIAGNOSTIC_NATIVE_PATH,
        data: json,
        directory: FORM_DIAGNOSTIC_NATIVE_DIRECTORY,
        encoding: FORM_DIAGNOSTIC_NATIVE_ENCODING,
      });
      const uri = written && written.uri;
      if (typeof uri === "string" && uri.trim() !== "") {
        try {
          await sh.share({ url: uri });
          status = "shared";
        } catch (error) {
          status = formDiagnosticNativeCanceled(error) ? "canceled" : "failed";
        }
      }
    } catch (error) {
      status = "failed";
    } finally {
      try {
        await fs.deleteFile(deleteOptions);
      } catch (error) {
        if (!formDiagnosticNativeNotFound(error)) cleanupFailed = true;
      }
    }
    return { status, cleanupFailed };
  }

  async function runFormDiagnosticDownload(choice, json) {
    const environment = choice.environment;
    const doc = environment && environment.document;
    const urlApi = environment && environment.urlApi;
    if (
      !environment ||
      typeof environment.BlobCtor !== "function" ||
      !doc ||
      !doc.body ||
      typeof doc.createElement !== "function" ||
      typeof doc.body.appendChild !== "function" ||
      !urlApi ||
      typeof urlApi.createObjectURL !== "function" ||
      typeof urlApi.revokeObjectURL !== "function"
    ) {
      return { status: "failed", cleanupFailed: false };
    }

    let anchor = null;
    let objectUrl = null;
    let failed = false;
    try {
      const blob = new environment.BlobCtor([json], { type: FORM_DIAGNOSTIC_MIME });
      objectUrl = urlApi.createObjectURL(blob);
      anchor = doc.createElement("a");
      anchor.href = objectUrl;
      anchor.download = FORM_DIAGNOSTIC_FILENAME;
      doc.body.appendChild(anchor);
      anchor.click();
    } catch (error) {
      failed = true;
    } finally {
      if (anchor) {
        try {
          anchor.remove();
        } catch (error) {
          failed = true;
        }
      }
      if (objectUrl !== null) {
        try {
          urlApi.revokeObjectURL(objectUrl);
        } catch (error) {
          failed = true;
        }
      }
    }
    return {
      status: failed ? "failed" : "downloaded",
      cleanupFailed: false,
    };
  }

  async function shareFormDiagnosticsJson(json, environment) {
    if (typeof json !== "string") {
      return { status: "failed", cleanupFailed: false };
    }
    const completeEnvironment =
      environment === undefined ? defaultFormDiagnosticTransportEnvironment() : environment;
    const choice = selectFormDiagnosticTransport(json, completeEnvironment);
    switch (choice.kind) {
      case "web":
        return runFormDiagnosticWebShare(choice);
      case "native":
        return runFormDiagnosticNativeShare(choice, json);
      default:
        return runFormDiagnosticDownload(choice, json);
    }
  }
  /* FORM_DIAGNOSTIC_TRANSPORT_END */
  ```

- [ ] **Step 5: Run focused GREEN and the storage/native cumulative gates**

  Run exactly:

  ```powershell
  node tools/check-form-diagnostics.js
  npm run check:form
  npm run check:storage
  npm run check:app
  npm run check:globals
  npm run lint -- --quiet
  npx prettier --check tools/check-form-diagnostics.js docs/codex/codex-progress.md
  git diff --check
  ```

  Expected: every command exits `0`; diagnostics ends with `Form diagnostic checks OK`. Inspect only the inserted storage hunk and confirm the generic wrapper is byte-for-byte unchanged.

- [ ] **Step 6: Record the exact RED/GREEN and commit Task 8 only**

  Append the observed missing-function RED, focused/cumulative GREEN commands, web/native cancellation matrix, stale/final cleanup results, no-fallback result, and Task 9 as next to `docs/codex/codex-progress.md`. Then run:

  ```powershell
  git status --short
  git add scripts/10-storage-native.js tools/check-form-diagnostics.js docs/codex/codex-progress.md
  git diff --check --cached
  git commit -m "feat(form): add bounded diagnostic sharing"
  ```

  Expected: the cached whitespace check is silent and the commit succeeds with the exact subject above.

---

### Task 9: Add the exact-boolean settings workflow and mobile E2E

**Files:**

- Modify: `scripts/70-gear-settings.js:1178-1452` (settings helpers, complete section markup, exact toggle, start/export binding)
- Modify: `tools/check-ui.js:79-377` (bounded static contracts)
- Modify: `tests/e2e/form-diagnostics.spec.js` (extend the synthetic Task-6/7 suite with settings and transport cases)
- Modify: `docs/codex/codex-progress.md:end`

**Interfaces:**

- Consumes Task 4's global `FORM_DIAGNOSTIC_SLOTS`; never redeclare, shadow, mutate, or locally duplicate its slot array.
- Consumes `validateFormDiagnosticMatrixCoordinator`, `validateFormDiagnosticRecord`, `allocateFormDiagnosticBatchId`, `createFormDiagnosticMatrixCoordinator`, `buildFormDiagnosticExport`, `commitFormDiagnosticDbCandidate`, `shareFormDiagnosticsJson`, and the existing active-workflow functions.
- Produces one secondary settings section, hidden and with every action disabled unless `db.settings.formDebug === true`; no primary capture control is added.
- The only Task-4/5 result-code normalization table is:

  ```js
  const FORM_DIAGNOSTIC_RESULT_COPY = Object.freeze({
    "invalid-app-version": "restart-required",
    "invalid-batch-id": "allocation-failed",
    "crypto-unavailable": "allocation-failed",
    "batch-id-collision": "allocation-failed",
    "coordinator-missing": "incomplete",
    "coordinator-invalid": "restart-required",
    "coordinator-stale": "restart-required",
    "coordinator-incomplete": "incomplete",
    "coordinator-complete": "complete",
    "record-invalid": "repeat-clean",
    "record-ineligible": "repeat-clean",
    "source-missing": "restart-required",
    "source-ambiguous": "restart-required",
    "source-invalid": "repeat-clean",
    "output-too-large": "repeat-clean",
    "encoding-unavailable": "failed",
  });
  ```

- The fixed UI-result-to-copy table is:

  ```js
  const FORM_DIAGNOSTIC_UI_COPY = Object.freeze({
    incomplete: "18射の診断が完了していません。開始後、表示された条件を各6射ずつ記録してください。",
    "next-side": "次は「真横」を6射記録してください。",
    "next-oblique": "次は「やや斜め」を6射記録してください。",
    "next-normal_range": "次は「通常設置」を6射記録してください。",
    complete: "18射の診断がそろいました。",
    "restart-required": "現在の診断バッチは使用できません。新しく開始してください。",
    "repeat-clean":
      "診断データを安全に書き出せません。18射の診断を新しく開始し、3条件を各6射ずつ記録し直してください。",
    "workflow-active": "ほかの操作中は18射の診断を開始・書き出しできません。",
    "debug-disabled": "検証用の診断データ保存をONにしてください。",
    "batch-changed": "診断バッチが変更されたため、操作を中止しました。",
    "allocation-failed": "診断バッチを作成できませんでした。もう一度お試しください。",
    "save-failed": "診断バッチを保存できませんでした。もう一度お試しください。",
    started: "18射の診断を開始しました。",
    shared: "診断JSONを共有しました。",
    downloaded: "診断JSONを書き出しました。",
    canceled: null,
    failed: "診断JSONを書き出せませんでした。もう一度お試しください。",
    "cleanup-failed":
      "診断JSONの一時ファイルを削除できませんでした。端末のキャッシュに診断値が残っている可能性があります。",
  });
  ```

- [ ] **Step 1: Add complete bounded static RED contracts**

  Add this block inside `staticUiChecks()` in `tools/check-ui.js`. It checks the full markup/copy, exact-boolean gate, Task-4 slot reuse, lock-before-await ordering, post-confirm rechecks, and the export handler's backup/database non-mutation boundary.

  ```js
  const gearSettingsSource = fs.readFileSync(
    path.join(root, "scripts", "70-gear-settings.js"),
    "utf8",
  );
  const formViewSource = fs.readFileSync(path.join(root, "scripts", "47-form-view.js"), "utf8");

  function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert(start >= 0, `missing source marker: ${startMarker}`);
    assert(end > start, `missing source end marker: ${endMarker}`);
    return source.slice(start, end);
  }

  const requiredFormDiagnosticCopy = [
    "18射の診断JSON",
    "18射の診断を開始",
    "開始後、真横→やや斜め→通常設置の順に各6射を記録します。条件を満たさない記録は診断バッチに追加されません。",
    "次は「真横」を6射記録してください。",
    "次は「やや斜め」を6射記録してください。",
    "次は「通常設置」を6射記録してください。",
    "18射の診断がそろいました。",
    "診断JSONを書き出す",
    "現在の18射診断バッチの診断値だけを書き出します。練習記録、日付、メモ、端末内ID、映像、画像、ランドマークは含みません。診断値の共有先は自分で確認してください。",
    "18射の診断が完了していません。開始後、表示された条件を各6射ずつ記録してください。",
  ];
  for (const copy of requiredFormDiagnosticCopy) {
    assert(gearSettingsSource.includes(copy), `form diagnostic copy missing: ${copy}`);
  }

  const settingsHelpers = sourceBetween(
    gearSettingsSource,
    "/* FORM_DIAGNOSTIC_SETTINGS_START */",
    "/* FORM_DIAGNOSTIC_SETTINGS_END */",
  );
  const startHandler = sourceBetween(
    settingsHelpers,
    "async function startFormDiagnosticMatrixFromSettings",
    "async function exportFormDiagnosticMatrixFromSettings",
  );
  const exportHandler = sourceBetween(
    settingsHelpers,
    "async function exportFormDiagnosticMatrixFromSettings",
    "function bindFormDiagnosticSettingsActions",
  );

  assert(
    settingsHelpers.includes('data-testid="form-diagnostic-section"') &&
      settingsHelpers.includes("data-form-diagnostic-section") &&
      settingsHelpers.includes("hidden") &&
      settingsHelpers.includes("disabled"),
    "diagnostic section has hidden and disabled defaults",
  );
  assert(
    settingsHelpers.includes("db.settings.formDebug===true") &&
      settingsHelpers.includes("db.settings.formDebug!==true"),
    "diagnostic settings use exact boolean gates",
  );
  assert(
    settingsHelpers.includes("FORM_DIAGNOSTIC_SLOTS[") &&
      !/const\s+FORM_DIAGNOSTIC_SLOTS\b/.test(gearSettingsSource),
    "settings consume the Task-4 global slot list without redeclaration",
  );
  for (const code of [
    "coordinator-missing",
    "coordinator-incomplete",
    "coordinator-invalid",
    "coordinator-stale",
    "source-missing",
    "source-ambiguous",
    "source-invalid",
    "output-too-large",
    "encoding-unavailable",
  ]) {
    assert(settingsHelpers.includes(`"${code}"`), `result map missing ${code}`);
  }

  assert(
    startHandler.indexOf("beginActiveWorkflow()") < startHandler.indexOf("await appConfirm"),
    "restart acquires workflow lock before awaiting confirmation",
  );
  assert(
    exportHandler.indexOf("beginActiveWorkflow()") < exportHandler.indexOf("await appConfirm"),
    "export acquires workflow lock before awaiting confirmation",
  );
  for (const source of [startHandler, exportHandler]) {
    assert(
      source.includes("db.settings.formDebug!==true"),
      "post-confirm exact debug recheck exists",
    );
    assert(
      source.includes("activeWorkflowCount!==1") && source.includes("db.active"),
      "post-confirm workflow ownership recheck exists",
    );
    assert(
      source.includes("formDiagnosticCoordinatorTokenMatches(token)"),
      "post-confirm coordinator token recheck exists",
    );
  }
  for (const forbidden of [
    "shareOrDownloadText",
    "lastBackupAt",
    "writeSafetySnapshot",
    "scheduleSafetySnapshot",
    "JSON.stringify(db",
    "save(",
  ]) {
    assert(!exportHandler.includes(forbidden), `diagnostic export excludes ${forbidden}`);
  }
  assert(
    !formViewSource.includes("form-diagnostic-section") &&
      !html.includes("form-diagnostic-section"),
    "diagnostic matrix controls stay out of the primary capture surface",
  );
  ```

- [ ] **Step 2: Replace the Task-9 synthetic helpers with the complete 3×6 seed and transport spies**

  In `tests/e2e/form-diagnostics.spec.js`, keep the Task-6/7 transaction/save tests and add `const fs = require("fs");` beside the existing imports. Add this complete Task-9 helper block after the existing synthetic helpers:

  ```js
  const TASK9_APP_VER = 84;
  const TASK9_KEY = "archeryNote.v1";
  const TASK9_SNAPSHOT_KEY = "archeryNote.snapshots.v1";
  const TASK9_BATCH_ID = "11111111-1111-4111-8111-111111111111";
  const TASK9_SLOTS = ["side", "oblique", "normal_range"];
  const TASK9_SENTINEL = "TASK9_SYNTHETIC_EXCLUDED_SECRET";

  function task9Receipt(index) {
    return {
      id: `form-receipt-${index}`,
      fireTs: 1000 + index,
      shotCreated: true,
      userDisposition: "present",
      detectorDisposition: "confirmed",
      cancelReason: null,
      unresolvedReason: null,
      fire: {
        anchorFloor: null,
        anchorEnter: 0.5,
        releaseSpeed: 7,
        evidenceAgeMs: null,
        evidenceStrength: null,
        departDelta: null,
        fireEvidence: "close",
      },
      excludedSecret: TASK9_SENTINEL,
    };
  }

  function task9Record(runIndex) {
    const id = `synthetic-task9-record-${runIndex + 1}`;
    return {
      id,
      fixtureNotice: "synthetic-only-no-real-user-or-device-data",
      date: "2099-01-01",
      ts: 4070908800000 + runIndex,
      sessionId: `synthetic-private-session-${runIndex}`,
      setupId: `synthetic-private-setup-${runIndex}`,
      shots: 6,
      modelVer: "synthetic-model",
      appVer: TASK9_APP_VER,
      fps: 30,
      features: Array.from({ length: 6 }, (_, index) => ({
        receiptId: `form-receipt-${index + 1}`,
        note: TASK9_SENTINEL,
        rawLandmarks: [TASK9_SENTINEL],
      })),
      note: TASK9_SENTINEL,
      formDiagnosticVersion: 1,
      captureMode: "live",
      formPhaseDiag: {
        releaseReceipts: Array.from({ length: 6 }, (_, index) => task9Receipt(index + 1)),
        receiptOverflow: 0,
        receiptInvariantCounts: {
          supersededActive: 0,
          missingActive: 0,
          identityMismatch: 0,
          invalidTransition: 0,
          sequenceExhausted: 0,
        },
        receiptDesynchronized: false,
        framesBefore: [TASK9_SENTINEL],
        rejectedFramesNear: [TASK9_SENTINEL],
      },
      formDiagnosticMatrix: {
        version: 1,
        batchId: TASK9_BATCH_ID,
        slot: TASK9_SLOTS[runIndex],
      },
      media: TASK9_SENTINEL,
      path: TASK9_SENTINEL,
      url: TASK9_SENTINEL,
      unknownFutureKey: TASK9_SENTINEL,
    };
  }

  function makeTask9DiagnosticDb(formDebug = true) {
    const database = makeSyntheticDiagnosticDb();
    const records = TASK9_SLOTS.map((slot, index) => task9Record(index));
    database.schema = 5;
    database.setups = [{ id: "synthetic-private-setup", name: TASK9_SENTINEL }];
    database.sightMarks = [];
    database.sessions = [
      {
        id: "synthetic-private-session",
        date: "2099-01-01",
        note: TASK9_SENTINEL,
      },
    ];
    database.trash = [
      {
        id: "synthetic-private-trash",
        type: "formAnalysis",
        data: { note: TASK9_SENTINEL },
      },
    ];
    database.formAnalyses = records;
    database.customRounds = [];
    database.settings = Object.assign({}, database.settings, {
      formDebug,
      lastBackupAt: "2099-01-01T00:00:00.000Z",
      onboardingSeen: true,
      activeGuideSeen: true,
      formDiagnosticMatrixBatch: {
        version: 1,
        batchId: TASK9_BATCH_ID,
        appVer: TASK9_APP_VER,
        nextSlot: 3,
        recordIds: records.map((record) => record.id),
        invalidated: false,
      },
    });
    database.active = null;
    return database;
  }

  async function seedTask9Page(page, database, mode = "web-success") {
    await page.addInitScript(
      ({ database: seed, mode: transportMode }) => {
        localStorage.setItem("archeryNote.v1", JSON.stringify(seed));
        globalThis.__task9Transport = {
          mode: transportMode,
          shareCalls: [],
          nativeCalls: [],
          objectUrls: [],
          revokedUrls: [],
          blobTypes: [],
        };

        Object.defineProperty(navigator, "canShare", {
          configurable: true,
          value(data) {
            return (
              globalThis.__task9Transport.mode.startsWith("web-") &&
              Array.isArray(data.files) &&
              data.files.length === 1
            );
          },
        });
        Object.defineProperty(navigator, "share", {
          configurable: true,
          async value(data) {
            const file = data.files[0];
            globalThis.__task9Transport.shareCalls.push({
              name: file.name,
              type: file.type,
              text: await file.text(),
            });
            if (globalThis.__task9Transport.mode === "web-abort") {
              throw new DOMException("fixture canceled", "AbortError");
            }
            if (globalThis.__task9Transport.mode === "web-error") {
              throw new Error("fixture web failure");
            }
          },
        });

        const realCreateObjectURL = URL.createObjectURL.bind(URL);
        const realRevokeObjectURL = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = (blob) => {
          globalThis.__task9Transport.blobTypes.push(blob.type);
          const value = realCreateObjectURL(blob);
          globalThis.__task9Transport.objectUrls.push(value);
          return value;
        };
        URL.revokeObjectURL = (value) => {
          globalThis.__task9Transport.revokedUrls.push(value);
          return realRevokeObjectURL(value);
        };

        if (transportMode === "native-cleanup-error") {
          let deletes = 0;
          globalThis.Capacitor = {
            getPlatform() {
              return "ios";
            },
            Plugins: {
              Filesystem: {
                async deleteFile(options) {
                  deletes += 1;
                  globalThis.__task9Transport.nativeCalls.push({
                    op: "delete",
                    options,
                  });
                  if (deletes === 2) throw new Error("fixture final cleanup failure");
                },
                async writeFile(options) {
                  globalThis.__task9Transport.nativeCalls.push({
                    op: "write",
                    options,
                  });
                  return { uri: "capacitor://cache/task9-diagnostics" };
                },
              },
              Share: {
                async share(options) {
                  globalThis.__task9Transport.nativeCalls.push({
                    op: "share",
                    options,
                  });
                },
              },
            },
          };
        }
      },
      { database, mode },
    );
    await page.goto("/");
    await page.locator("#btnSettings").click();
  }

  async function task9PersistenceSnapshot(page) {
    return page.evaluate(
      ({ key, snapshotKey }) => ({
        memory: JSON.stringify(db),
        primary: localStorage.getItem(key),
        snapshots: localStorage.getItem(snapshotKey),
        lastBackupAt: db.settings.lastBackupAt,
        records: JSON.stringify(db.formAnalyses),
      }),
      { key: TASK9_KEY, snapshotKey: TASK9_SNAPSHOT_KEY },
    );
  }

  async function task9Confirm(page, label) {
    await page
      .locator("body > .ovl")
      .last()
      .getByRole("button", { name: label, exact: true })
      .click();
  }

  function assertTask9Artifact(payload) {
    expect(Object.keys(payload)).toEqual([
      "format",
      "schemaVersion",
      "appVersion",
      "matrix",
      "runs",
    ]);
    expect(payload.format).toBe("archery-note-form-diagnostics");
    expect(payload.schemaVersion).toBe(1);
    expect(payload.appVersion).toBe(TASK9_APP_VER);
    expect(payload.matrix).toBe("field-3x6");
    expect(payload.runs).toHaveLength(3);
    payload.runs.forEach((run, index) => {
      expect(Object.keys(run)).toEqual([
        "runOrdinal",
        "condition",
        "retainedShotCount",
        "receipts",
      ]);
      expect(run.runOrdinal).toBe(index + 1);
      expect(run.condition).toBe(TASK9_SLOTS[index]);
      expect(run.retainedShotCount).toBe(6);
      expect(run.receipts).toHaveLength(6);
    });
    const serialized = JSON.stringify(payload);
    for (const forbidden of [
      TASK9_SENTINEL,
      "synthetic-task9-record-",
      "form-receipt-",
      "synthetic-private-session",
      "synthetic-private-setup",
      "2099-01-01",
      "framesBefore",
      "rejectedFramesNear",
      "settings",
      "trash",
      "path",
      "url",
      "unknownFutureKey",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  }
  ```

- [ ] **Step 3: Add the complete settings, concurrency, refusal, transport, privacy, and viewport E2E before production code**

  Append this exact test block to the same E2E file:

  ```js
  for (const [label, value, own] of [
    ["absent", undefined, false],
    ["false", false, true],
    ['string "true"', "true", true],
  ]) {
    test(`${label} formDebug keeps diagnostics hidden and disabled`, async ({ page }) => {
      const database = makeTask9DiagnosticDb(true);
      if (own) database.settings.formDebug = value;
      else delete database.settings.formDebug;
      await seedTask9Page(page, database);
      const section = page.getByTestId("form-diagnostic-section");
      await expect(section).toBeHidden();
      await expect(section.getByRole("button", { name: "18射の診断を開始" })).toBeDisabled();
      await expect(section.getByRole("button", { name: "診断JSONを書き出す" })).toBeDisabled();
    });
  }

  test("diagnostic controls follow exact formDebug without reopening settings", async ({
    page,
  }) => {
    await seedTask9Page(page, makeTask9DiagnosticDb(false));
    const section = page.getByTestId("form-diagnostic-section");
    await expect(section).toBeHidden();
    await page.locator('#fdChips [data-fd="1"]').click();
    await expect(section).toBeVisible();
    await expect(section.getByRole("button", { name: "18射の診断を開始" })).toBeEnabled();
    await page.locator('#fdChips [data-fd="0"]').click();
    await expect(section).toBeHidden();
    expect(await page.evaluate(() => db.settings.formDiagnosticMatrixBatch.batchId)).toBe(
      TASK9_BATCH_ID,
    );
  });

  test("action-time exact gate rejects a value changed after render", async ({ page }) => {
    await seedTask9Page(page, makeTask9DiagnosticDb(true));
    await page.evaluate(() => {
      db.settings.formDebug = "true";
      document.querySelector("#fdMatrixStart").click();
    });
    await expect(page.getByTestId("form-diagnostic-section")).toBeHidden();
    expect(await page.evaluate(() => db.settings.formDiagnosticMatrixBatch.batchId)).toBe(
      TASK9_BATCH_ID,
    );
  });

  test("another workflow blocks both actions before confirmation", async ({ page }) => {
    await seedTask9Page(page, makeTask9DiagnosticDb(true));
    await page.evaluate(() => beginActiveWorkflow());
    try {
      await page.locator("#fdMatrixStart").click();
      await page.locator("#fdMatrixExport").click();
      await expect(page.locator(".confirmSheet")).toHaveCount(0);
      await expect(page.locator("#toast")).toContainText(
        "ほかの操作中は18射の診断を開始・書き出しできません。",
      );
    } finally {
      await page.evaluate(() => endActiveWorkflow());
    }
  });

  test("first start commits one fresh coordinator", async ({ page }) => {
    const database = makeTask9DiagnosticDb(true);
    delete database.settings.formDiagnosticMatrixBatch;
    await seedTask9Page(page, database);
    await page.locator("#fdMatrixStart").click();
    const batch = await page.evaluate(() => db.settings.formDiagnosticMatrixBatch);
    expect(batch).toEqual({
      version: 1,
      batchId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      appVer: TASK9_APP_VER,
      nextSlot: 0,
      recordIds: [],
      invalidated: false,
    });
    await expect(page.getByTestId("form-diagnostic-status")).toHaveText(
      "次は「真横」を6射記録してください。",
    );
  });

  test("restart double click opens one confirmation; cancel preserves and confirm replaces", async ({
    page,
  }) => {
    const database = makeTask9DiagnosticDb(true);
    database.settings.formDiagnosticMatrixBatch.nextSlot = 1;
    database.settings.formDiagnosticMatrixBatch.recordIds =
      database.settings.formDiagnosticMatrixBatch.recordIds.slice(0, 1);
    database.formAnalyses = database.formAnalyses.slice(0, 1);
    await seedTask9Page(page, database);

    await page.evaluate(() => {
      const button = document.querySelector("#fdMatrixStart");
      button.click();
      button.click();
    });
    await expect(page.locator(".confirmSheet")).toHaveCount(1);
    await task9Confirm(page, "キャンセル");
    expect(await page.evaluate(() => db.settings.formDiagnosticMatrixBatch.batchId)).toBe(
      TASK9_BATCH_ID,
    );

    await page.locator("#fdMatrixStart").click();
    await task9Confirm(page, "開始し直す");
    expect(await page.evaluate(() => db.settings.formDiagnosticMatrixBatch.batchId)).not.toBe(
      TASK9_BATCH_ID,
    );
  });

  test("restart post-confirm token change fails closed", async ({ page }) => {
    const database = makeTask9DiagnosticDb(true);
    database.settings.formDiagnosticMatrixBatch.nextSlot = 1;
    database.settings.formDiagnosticMatrixBatch.recordIds =
      database.settings.formDiagnosticMatrixBatch.recordIds.slice(0, 1);
    database.formAnalyses = database.formAnalyses.slice(0, 1);
    await seedTask9Page(page, database);
    await page.locator("#fdMatrixStart").click();
    await page.evaluate(() => {
      db.settings.formDiagnosticMatrixBatch = {
        version: 1,
        batchId: "22222222-2222-4222-8222-222222222222",
        appVer: 84,
        nextSlot: 0,
        recordIds: [],
        invalidated: false,
      };
    });
    await task9Confirm(page, "開始し直す");
    await expect(page.locator("#toast")).toContainText(
      "診断バッチが変更されたため、操作を中止しました。",
    );
    expect(await page.evaluate(() => db.settings.formDiagnosticMatrixBatch.batchId)).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });

  test("allocation failure and save false both preserve prior coordinator and updatedAt", async ({
    page,
  }) => {
    const database = makeTask9DiagnosticDb(true);
    delete database.settings.formDiagnosticMatrixBatch;
    delete database.updatedAt;
    await seedTask9Page(page, database);

    await page.evaluate(() => {
      allocateFormDiagnosticBatchId = () => ({
        ok: false,
        code: "crypto-unavailable",
        batchId: null,
      });
    });
    await page.locator("#fdMatrixStart").click();
    expect(
      await page.evaluate(() => ({
        hasBatch: Object.hasOwn(db.settings, "formDiagnosticMatrixBatch"),
        hasUpdatedAt: Object.hasOwn(db, "updatedAt"),
      })),
    ).toEqual({ hasBatch: false, hasUpdatedAt: false });

    await page.reload();
    await page.locator("#btnSettings").click();
    await page.evaluate(() => {
      save = () => false;
    });
    await page.locator("#fdMatrixStart").click();
    expect(
      await page.evaluate(() => ({
        hasBatch: Object.hasOwn(db.settings, "formDiagnosticMatrixBatch"),
        hasUpdatedAt: Object.hasOwn(db, "updatedAt"),
      })),
    ).toEqual({ hasBatch: false, hasUpdatedAt: false });
    await expect(page.locator("#toast")).toContainText("診断バッチを保存できませんでした。");
  });

  test("side state uses fixed copy", async ({ page }) => {
    const side = makeTask9DiagnosticDb(true);
    side.settings.formDiagnosticMatrixBatch.nextSlot = 0;
    side.settings.formDiagnosticMatrixBatch.recordIds = [];
    side.formAnalyses = [];
    await seedTask9Page(page, side);
    await expect(page.getByTestId("form-diagnostic-status")).toHaveText(
      "次は「真横」を6射記録してください。",
    );
  });

  test("complete state uses fixed copy", async ({ page }) => {
    await seedTask9Page(page, makeTask9DiagnosticDb(true));
    await expect(page.getByTestId("form-diagnostic-status")).toHaveText(
      "18射の診断がそろいました。",
    );
  });

  test("export post-confirm exact-debug and workflow rechecks prevent transport", async ({
    page,
  }) => {
    await seedTask9Page(page, makeTask9DiagnosticDb(true));
    await page.locator("#fdMatrixExport").click();
    await page.evaluate(() => {
      db.settings.formDebug = false;
    });
    await task9Confirm(page, "書き出す");
    expect(await page.evaluate(() => globalThis.__task9Transport.shareCalls.length)).toBe(0);

    await page.reload();
    await page.locator("#btnSettings").click();
    await page.locator("#fdMatrixExport").click();
    await page.evaluate(() => beginActiveWorkflow());
    try {
      await task9Confirm(page, "書き出す");
      expect(await page.evaluate(() => globalThis.__task9Transport.shareCalls.length)).toBe(0);
    } finally {
      await page.evaluate(() => endActiveWorkflow());
    }
  });

  for (const [label, mutate, expectedCopy] of [
    [
      "incomplete",
      (database) => {
        database.settings.formDiagnosticMatrixBatch.nextSlot = 2;
        database.settings.formDiagnosticMatrixBatch.recordIds =
          database.settings.formDiagnosticMatrixBatch.recordIds.slice(0, 2);
        database.formAnalyses = database.formAnalyses.slice(0, 2);
      },
      "18射の診断が完了していません。",
    ],
    [
      "stale",
      (database) => {
        database.settings.formDiagnosticMatrixBatch.appVer = TASK9_APP_VER - 1;
      },
      "現在の診断バッチは使用できません。",
    ],
    [
      "malformed",
      (database) => {
        database.settings.formDiagnosticMatrixBatch.extra = true;
      },
      "現在の診断バッチは使用できません。",
    ],
    [
      "replay",
      (database) => {
        database.formAnalyses[0].captureMode = "replay";
      },
      "診断データを安全に書き出せません。",
    ],
    [
      "duplicate selected ID",
      (database) => {
        database.formAnalyses.push(structuredClone(database.formAnalyses[0]));
      },
      "現在の診断バッチは使用できません。",
    ],
    [
      "overflow",
      (database) => {
        database.formAnalyses[0].formPhaseDiag.receiptOverflow = 1;
      },
      "診断データを安全に書き出せません。",
    ],
  ]) {
    test(`${label} refuses export without transport`, async ({ page }) => {
      const database = makeTask9DiagnosticDb(true);
      mutate(database);
      await seedTask9Page(page, database);
      await page.locator("#fdMatrixExport").click();
      await task9Confirm(page, "書き出す");
      await expect(page.locator("#toast")).toContainText(expectedCopy);
      expect(
        await page.evaluate(() => ({
          shares: globalThis.__task9Transport.shareCalls.length,
          urls: globalThis.__task9Transport.objectUrls.length,
          native: globalThis.__task9Transport.nativeCalls.length,
        })),
      ).toEqual({ shares: 0, urls: 0, native: 0 });
    });
  }

  test("output-too-large uses the fixed repeat copy", async ({ page }) => {
    await seedTask9Page(page, makeTask9DiagnosticDb(true));
    await page.evaluate(() => {
      buildFormDiagnosticExport = () => ({
        ok: false,
        code: "output-too-large",
        payload: null,
        json: null,
        byteLength: null,
      });
    });
    await page.locator("#fdMatrixExport").click();
    await task9Confirm(page, "書き出す");
    await expect(page.locator("#toast")).toContainText("診断データを安全に書き出せません。");
  });

  test("export double click opens one confirmation and cancel preserves all state", async ({
    page,
  }) => {
    await seedTask9Page(page, makeTask9DiagnosticDb(true));
    const before = await task9PersistenceSnapshot(page);
    await page.evaluate(() => {
      const button = document.querySelector("#fdMatrixExport");
      button.click();
      button.click();
    });
    await expect(page.locator(".confirmSheet")).toHaveCount(1);
    await task9Confirm(page, "キャンセル");
    expect(await task9PersistenceSnapshot(page)).toEqual(before);
    expect(await page.evaluate(() => globalThis.__task9Transport.shareCalls.length)).toBe(0);
  });

  for (const mode of ["web-success", "web-abort", "web-error"]) {
    test(`${mode} uses one File transport and preserves DB/backups`, async ({ page }) => {
      await seedTask9Page(page, makeTask9DiagnosticDb(true), mode);
      const before = await task9PersistenceSnapshot(page);
      await page.locator("#fdMatrixExport").click();
      await task9Confirm(page, "書き出す");
      await expect
        .poll(() => page.evaluate(() => globalThis.__task9Transport.shareCalls.length))
        .toBe(1);
      const transport = await page.evaluate(() => globalThis.__task9Transport);
      expect(transport.shareCalls[0].name).toBe("archery-note-form-diagnostics.json");
      expect(transport.shareCalls[0].type).toBe("application/json;charset=utf-8");
      expect(transport.objectUrls).toHaveLength(0);
      expect(transport.nativeCalls).toHaveLength(0);
      expect(await task9PersistenceSnapshot(page)).toEqual(before);
      if (mode === "web-success") {
        await expect(page.locator("#toast")).toContainText("診断JSONを共有しました。");
      }
      if (mode === "web-abort") {
        await expect(page.locator("#toast")).not.toHaveClass(/show/);
      }
      if (mode === "web-error") {
        await expect(page.locator("#toast")).toContainText("診断JSONを書き出せませんでした。");
      }
    });
  }

  test("native final cleanup warning has no download fallback and preserves state", async ({
    page,
  }) => {
    await seedTask9Page(page, makeTask9DiagnosticDb(true), "native-cleanup-error");
    const before = await task9PersistenceSnapshot(page);
    await page.locator("#fdMatrixExport").click();
    await task9Confirm(page, "書き出す");
    await expect(page.locator("#toast")).toContainText(
      "診断JSONの一時ファイルを削除できませんでした。",
    );
    const transport = await page.evaluate(() => globalThis.__task9Transport);
    expect(transport.nativeCalls.map((call) => call.op)).toEqual([
      "delete",
      "write",
      "share",
      "delete",
    ]);
    expect(transport.objectUrls).toHaveLength(0);
    expect(await task9PersistenceSnapshot(page)).toEqual(before);
  });

  test("no-share environment downloads exact MIME/allowlist and revokes URL", async ({ page }) => {
    await seedTask9Page(page, makeTask9DiagnosticDb(true), "download");
    const before = await task9PersistenceSnapshot(page);
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#fdMatrixExport").click();
    await task9Confirm(page, "書き出す");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("archery-note-form-diagnostics.json");
    const filePath = await download.path();
    const text = fs.readFileSync(filePath, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    assertTask9Artifact(JSON.parse(text));
    const transport = await page.evaluate(() => globalThis.__task9Transport);
    expect(transport.blobTypes).toEqual(["application/json;charset=utf-8"]);
    expect(transport.objectUrls).toHaveLength(1);
    expect(transport.revokedUrls).toEqual(transport.objectUrls);
    expect(await task9PersistenceSnapshot(page)).toEqual(before);
  });

  for (const viewport of [
    { width: 360, height: 780 },
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    test(`diagnostic settings fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seedTask9Page(page, makeTask9DiagnosticDb(true));
      await page.getByTestId("form-diagnostic-section").scrollIntoViewIfNeeded();
      const layout = await page.evaluate(() => {
        const sheet = document.querySelector(".sheet");
        const section = document.querySelector("[data-form-diagnostic-section]");
        const start = document.querySelector("#fdMatrixStart").getBoundingClientRect();
        const exportButton = document.querySelector("#fdMatrixExport").getBoundingClientRect();
        const sheetRect = sheet.getBoundingClientRect();
        const overlap = !(
          start.right <= exportButton.left ||
          exportButton.right <= start.left ||
          start.bottom <= exportButton.top ||
          exportButton.bottom <= start.top
        );
        return {
          documentOverflow:
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
          sheetOverflow: sheet.scrollWidth > sheet.clientWidth,
          sectionOverflow: section.scrollWidth > section.clientWidth,
          clipped: [start, exportButton].some(
            (rect) =>
              rect.width < 44 ||
              rect.height < 44 ||
              rect.left < sheetRect.left ||
              rect.right > sheetRect.right,
          ),
          overlap,
        };
      });
      expect(layout).toEqual({
        documentOverflow: false,
        sheetOverflow: false,
        sectionOverflow: false,
        clipped: false,
        overlap: false,
      });
    });
  }
  ```

- [ ] **Step 4: Run both honest UI REDs**

  Run exactly:

  ```powershell
  npm run check:ui
  npx playwright test tests/e2e/form-diagnostics.spec.js --project=chromium
  ```

  Expected: `check:ui` exits `1` at `missing source marker: /* FORM_DIAGNOSTIC_SETTINGS_START */`, and Playwright exits nonzero because `form-diagnostic-section` is absent. Do not accept fixture syntax, missing imports, or a Task-6/7 regression as the Task-9 RED.

- [ ] **Step 5: Add the complete settings helpers, markup, status derivation, and token checks**

  Insert this block after `gamifySettingsHtml()` and before `openSettings()`. It consumes Task 4's global slots and validators rather than adding another slot list or coordinator validator.

  ```js
  /* FORM_DIAGNOSTIC_SETTINGS_START */
  const FORM_DIAGNOSTIC_PRIVACY_CONFIRM =
    "現在の18射診断バッチの診断値だけを書き出します。練習記録、日付、メモ、端末内ID、映像、画像、ランドマークは含みません。診断値の共有先は自分で確認してください。";
  const FORM_DIAGNOSTIC_RESTART_CONFIRM =
    "現在の未完了の診断バッチを新しく開始し直しますか？保存済みの射形記録は削除されません。";
  const FORM_DIAGNOSTIC_RESULT_COPY = Object.freeze({
    "invalid-app-version": "restart-required",
    "invalid-batch-id": "allocation-failed",
    "crypto-unavailable": "allocation-failed",
    "batch-id-collision": "allocation-failed",
    "coordinator-missing": "incomplete",
    "coordinator-invalid": "restart-required",
    "coordinator-stale": "restart-required",
    "coordinator-incomplete": "incomplete",
    "coordinator-complete": "complete",
    "record-invalid": "repeat-clean",
    "record-ineligible": "repeat-clean",
    "source-missing": "restart-required",
    "source-ambiguous": "restart-required",
    "source-invalid": "repeat-clean",
    "output-too-large": "repeat-clean",
    "encoding-unavailable": "failed",
  });
  const FORM_DIAGNOSTIC_UI_COPY = Object.freeze({
    incomplete: "18射の診断が完了していません。開始後、表示された条件を各6射ずつ記録してください。",
    "next-side": "次は「真横」を6射記録してください。",
    "next-oblique": "次は「やや斜め」を6射記録してください。",
    "next-normal_range": "次は「通常設置」を6射記録してください。",
    complete: "18射の診断がそろいました。",
    "restart-required": "現在の診断バッチは使用できません。新しく開始してください。",
    "repeat-clean":
      "診断データを安全に書き出せません。18射の診断を新しく開始し、3条件を各6射ずつ記録し直してください。",
    "workflow-active": "ほかの操作中は18射の診断を開始・書き出しできません。",
    "debug-disabled": "検証用の診断データ保存をONにしてください。",
    "batch-changed": "診断バッチが変更されたため、操作を中止しました。",
    "allocation-failed": "診断バッチを作成できませんでした。もう一度お試しください。",
    "save-failed": "診断バッチを保存できませんでした。もう一度お試しください。",
    started: "18射の診断を開始しました。",
    shared: "診断JSONを共有しました。",
    downloaded: "診断JSONを書き出しました。",
    canceled: null,
    failed: "診断JSONを書き出せませんでした。もう一度お試しください。",
    "cleanup-failed":
      "診断JSONの一時ファイルを削除できませんでした。端末のキャッシュに診断値が残っている可能性があります。",
  });

  function formDiagnosticUiResultForCode(code) {
    return FORM_DIAGNOSTIC_RESULT_COPY[code] || "failed";
  }

  function formDiagnosticUiCopy(result) {
    return Object.hasOwn(FORM_DIAGNOSTIC_UI_COPY, result)
      ? FORM_DIAGNOSTIC_UI_COPY[result]
      : FORM_DIAGNOSTIC_UI_COPY.failed;
  }

  function showFormDiagnosticResult(result) {
    const copy = formDiagnosticUiCopy(result);
    if (copy) toast(copy, result === "cleanup-failed" ? 6000 : 2600);
  }

  function formDiagnosticCoordinatorToken() {
    const own = Object.hasOwn(db.settings, "formDiagnosticMatrixBatch");
    const value = own ? db.settings.formDiagnosticMatrixBatch : undefined;
    return {
      own,
      value,
      version: value && value.version,
      batchId: value && value.batchId,
      appVer: value && value.appVer,
      nextSlot: value && value.nextSlot,
      invalidated: value && value.invalidated,
      recordIds: value && Array.isArray(value.recordIds) ? value.recordIds.slice() : null,
    };
  }

  function formDiagnosticCoordinatorTokenMatches(token) {
    const own = Object.hasOwn(db.settings, "formDiagnosticMatrixBatch");
    if (own !== token.own) return false;
    if (!own) return true;
    const value = db.settings.formDiagnosticMatrixBatch;
    return (
      value === token.value &&
      value.version === token.version &&
      value.batchId === token.batchId &&
      value.appVer === token.appVer &&
      value.nextSlot === token.nextSlot &&
      value.invalidated === token.invalidated &&
      Array.isArray(value.recordIds) &&
      Array.isArray(token.recordIds) &&
      value.recordIds.length === token.recordIds.length &&
      value.recordIds.every((id, index) => id === token.recordIds[index])
    );
  }

  function formDiagnosticSettingsStatusResult() {
    const coordinator = Object.hasOwn(db.settings, "formDiagnosticMatrixBatch")
      ? db.settings.formDiagnosticMatrixBatch
      : null;
    const checked = validateFormDiagnosticMatrixCoordinator(coordinator, APP_VER, false);
    if (!checked.ok) return formDiagnosticUiResultForCode(checked.code);
    const batch = checked.coordinator;

    for (let index = 0; index < batch.recordIds.length; index++) {
      const recordId = batch.recordIds[index];
      const matches = (db.formAnalyses || []).filter((record) => record && record.id === recordId);
      if (matches.length === 0) return formDiagnosticUiResultForCode("source-missing");
      if (matches.length !== 1) return formDiagnosticUiResultForCode("source-ambiguous");
      const record = matches[0];
      const validRecord = validateFormDiagnosticRecord(record, APP_VER);
      if (!validRecord.ok) return formDiagnosticUiResultForCode(validRecord.code);
      const marker = record.formDiagnosticMatrix;
      if (
        !marker ||
        marker.version !== 1 ||
        marker.batchId !== batch.batchId ||
        marker.slot !== FORM_DIAGNOSTIC_SLOTS[index]
      )
        return formDiagnosticUiResultForCode("source-invalid");
    }

    if (batch.nextSlot === 3) {
      const built = buildFormDiagnosticExport(db.formAnalyses || [], batch, APP_VER);
      return built.ok ? "complete" : formDiagnosticUiResultForCode(built.code);
    }
    return `next-${FORM_DIAGNOSTIC_SLOTS[batch.nextSlot]}`;
  }

  function formDiagnosticSettingsHtml() {
    const enabled = db.settings.formDebug === true;
    const status = formDiagnosticUiCopy(formDiagnosticSettingsStatusResult());
    return `<section class="settingsGroup" data-form-diagnostic-section data-testid="form-diagnostic-section" aria-hidden="${enabled ? "false" : "true"}" ${enabled ? "" : "hidden"}>
      <div class="settingsGroupTitle">18射の診断JSON</div>
      <div class="hint">開始後、真横→やや斜め→通常設置の順に各6射を記録します。条件を満たさない記録は診断バッチに追加されません。</div>
      <div class="settingsActionHint" data-form-diagnostic-status data-testid="form-diagnostic-status" role="status" aria-live="polite">${esc(status)}</div>
      <div class="btnrow">
        <button type="button" class="btn sec" id="fdMatrixStart" data-testid="form-diagnostic-start" ${enabled ? "" : "disabled"}>18射の診断を開始</button>
        <button type="button" class="btn sec" id="fdMatrixExport" data-testid="form-diagnostic-export" ${enabled ? "" : "disabled"}>診断JSONを書き出す</button>
      </div>
      <div class="hint">${esc(FORM_DIAGNOSTIC_PRIVACY_CONFIRM)}</div>
    </section>`;
  }

  function syncFormDiagnosticSettingsUi(settingsOverlay) {
    const section = settingsOverlay.querySelector("[data-form-diagnostic-section]");
    if (!section) return;
    const enabled = db.settings.formDebug === true;
    const busy = section.dataset.busy === "true";
    section.hidden = !enabled;
    section.setAttribute("aria-hidden", String(!enabled));
    section.querySelectorAll("button").forEach((button) => {
      button.disabled = !enabled || busy;
    });
    const status = section.querySelector("[data-form-diagnostic-status]");
    if (status) status.textContent = formDiagnosticUiCopy(formDiagnosticSettingsStatusResult());
  }
  ```

- [ ] **Step 6: Add the complete locked start/export handlers and close the settings marker**

  Continue the same block with these handlers. Both acquire the workflow lock before any confirmation await. A second click therefore observes an active workflow and cannot create a second confirmation. Every post-confirm check occurs before allocation, save, export construction, or transport invocation.

  ```js
  async function startFormDiagnosticMatrixFromSettings(settingsOverlay) {
    syncFormDiagnosticSettingsUi(settingsOverlay);
    if (db.settings.formDebug !== true) {
      showFormDiagnosticResult("debug-disabled");
      return;
    }
    if (isUpdateReloadBlocked()) {
      showFormDiagnosticResult("workflow-active");
      return;
    }

    const section = settingsOverlay.querySelector("[data-form-diagnostic-section]");
    const token = formDiagnosticCoordinatorToken();
    beginActiveWorkflow();
    section.dataset.busy = "true";
    syncFormDiagnosticSettingsUi(settingsOverlay);
    try {
      const current = token.own ? token.value : null;
      const checked = validateFormDiagnosticMatrixCoordinator(current, APP_VER, false);
      if (checked.ok && checked.coordinator.nextSlot < 3) {
        const confirmed = await appConfirm(FORM_DIAGNOSTIC_RESTART_CONFIRM, {
          danger: true,
          okLabel: "開始し直す",
        });
        if (!confirmed) return;
      }

      if (db.settings.formDebug !== true) {
        showFormDiagnosticResult("debug-disabled");
        return;
      }
      if (db.active || activeWorkflowCount !== 1) {
        showFormDiagnosticResult("workflow-active");
        return;
      }
      if (!formDiagnosticCoordinatorTokenMatches(token)) {
        showFormDiagnosticResult("batch-changed");
        return;
      }

      const allocated = allocateFormDiagnosticBatchId(
        globalThis.crypto,
        token.own ? token.value : null,
        db.formAnalyses || [],
        db.trash || [],
      );
      if (!allocated.ok) {
        showFormDiagnosticResult(formDiagnosticUiResultForCode(allocated.code));
        return;
      }
      const created = createFormDiagnosticMatrixCoordinator(APP_VER, allocated.batchId);
      if (!created.ok) {
        showFormDiagnosticResult(formDiagnosticUiResultForCode(created.code));
        return;
      }
      const committed = commitFormDiagnosticDbCandidate(
        db,
        { formDiagnosticMatrixBatch: created.coordinator },
        { reason: "form-diagnostic-matrix-start" },
        save,
      );
      if (!committed.ok) {
        showFormDiagnosticResult("save-failed");
        return;
      }
      syncFormDiagnosticSettingsUi(settingsOverlay);
      showFormDiagnosticResult("started");
    } finally {
      section.dataset.busy = "false";
      endActiveWorkflow();
      syncFormDiagnosticSettingsUi(settingsOverlay);
    }
  }

  async function exportFormDiagnosticMatrixFromSettings(settingsOverlay) {
    syncFormDiagnosticSettingsUi(settingsOverlay);
    if (db.settings.formDebug !== true) {
      showFormDiagnosticResult("debug-disabled");
      return;
    }
    if (isUpdateReloadBlocked()) {
      showFormDiagnosticResult("workflow-active");
      return;
    }

    const section = settingsOverlay.querySelector("[data-form-diagnostic-section]");
    const token = formDiagnosticCoordinatorToken();
    beginActiveWorkflow();
    section.dataset.busy = "true";
    syncFormDiagnosticSettingsUi(settingsOverlay);
    try {
      const confirmed = await appConfirm(FORM_DIAGNOSTIC_PRIVACY_CONFIRM, {
        okLabel: "書き出す",
      });
      if (!confirmed) return;

      if (db.settings.formDebug !== true) {
        showFormDiagnosticResult("debug-disabled");
        return;
      }
      if (db.active || activeWorkflowCount !== 1) {
        showFormDiagnosticResult("workflow-active");
        return;
      }
      if (!formDiagnosticCoordinatorTokenMatches(token)) {
        showFormDiagnosticResult("batch-changed");
        return;
      }

      const built = buildFormDiagnosticExport(
        db.formAnalyses || [],
        db.settings.formDiagnosticMatrixBatch,
        APP_VER,
      );
      if (!built.ok) {
        showFormDiagnosticResult(formDiagnosticUiResultForCode(built.code));
        return;
      }
      const result = await shareFormDiagnosticsJson(built.json);
      if (result.cleanupFailed) {
        showFormDiagnosticResult("cleanup-failed");
        return;
      }
      showFormDiagnosticResult(result.status);
    } finally {
      section.dataset.busy = "false";
      endActiveWorkflow();
      syncFormDiagnosticSettingsUi(settingsOverlay);
    }
  }

  function bindFormDiagnosticSettingsActions(settingsOverlay) {
    const start = settingsOverlay.querySelector("#fdMatrixStart");
    const exportButton = settingsOverlay.querySelector("#fdMatrixExport");
    if (start) {
      start.onclick = () => startFormDiagnosticMatrixFromSettings(settingsOverlay);
    }
    if (exportButton) {
      exportButton.onclick = () => exportFormDiagnosticMatrixFromSettings(settingsOverlay);
    }
  }
  /* FORM_DIAGNOSTIC_SETTINGS_END */
  ```

- [ ] **Step 7: Mount the section and make the existing toggle exact and immediate**

  In `openSettings()`, replace only the existing `fdChips` markup with:

  ```js
  <div class="chips" id="fdChips">
    <button type="button" class="chip ${db.settings.formDebug===true?"":"on"}" aria-pressed="${db.settings.formDebug!==true}" data-fd="0">OFF</button>
    <button type="button" class="chip ${db.settings.formDebug===true?"on":""}" aria-pressed="${db.settings.formDebug===true}" data-fd="1">ON</button>
  </div>
  ```

  Mount the new group after the display group closes and before gamification:

  ```js
      </div>

      ${formDiagnosticSettingsHtml()}

      ${gamifySettingsHtml()}
  ```

  Immediately after the existing `openModal(ovl, { escapeTarget: "#setClose" });` call, add:

  ```js
  syncFormDiagnosticSettingsUi(ovl);
  bindFormDiagnosticSettingsActions(ovl);
  ```

  Replace the existing `fdChips` click binding with this complete handler. It changes only `formDebug`; it never deletes or rewrites `formDiagnosticMatrixBatch`.

  ```js
  ovl.querySelectorAll("#fdChips .chip").forEach(
    (c) =>
      (c.onclick = () => {
        db.settings.formDebug = c.dataset.fd === "1";
        save();
        ovl.querySelectorAll("#fdChips .chip").forEach((x) => {
          const on = x === c;
          x.classList.toggle("on", on);
          x.setAttribute("aria-pressed", String(on));
        });
        syncFormDiagnosticSettingsUi(ovl);
        toast(
          db.settings.formDebug === true
            ? "検証用の診断データ保存を有効にしました"
            : "検証用の診断データ保存を無効にしました",
        );
      }),
  );
  ```

- [ ] **Step 8: Run focused and cumulative GREEN checks**

  Run exactly:

  ```powershell
  npm run check:ui
  npx playwright test tests/e2e/form-diagnostics.spec.js --project=chromium
  node tools/check-form-diagnostics.js
  npm run check:form
  npm run check:storage
  npm run check:app
  npm run check:globals
  npm run lint -- --quiet
  npx prettier --check scripts/70-gear-settings.js tools/check-ui.js tests/e2e/form-diagnostics.spec.js docs/codex/codex-progress.md
  git diff --check
  ```

  Expected: every command exits `0`; all Task-9 E2E cases pass with zero skips. The MIME spies must report `application/json;charset=utf-8`, every transport-result snapshot must remain exactly equal, and all three viewport objects must equal the no-overflow/no-clipping/no-overlap object in the test.

- [ ] **Step 9: Record evidence and commit Task 9 only**

  Append the observed static/browser REDs, exact-boolean GREEN, double-click confirmation counts, post-confirm rechecks, fixed-code refusal table, MIME/artifact assertions, database/backup invariance, three viewport results, risks, and Task 10 as next to `docs/codex/codex-progress.md`. Then run:

  ```powershell
  git status --short
  git add scripts/70-gear-settings.js tools/check-ui.js tests/e2e/form-diagnostics.spec.js docs/codex/codex-progress.md
  git diff --check --cached
  git commit -m "feat(form): add gated 18-shot diagnostics"
  ```

  Expected: the cached whitespace check is silent and the commit succeeds with the exact subject above.

---

### Task 10: Run cumulative verification and prepare the physical field handoff

**Files:**

- Add: docs/form-diagnostic-field-acceptance.md
- Modify: docs/codex/codex-progress.md:end
- Verify only: every runtime/test file changed by Tasks 1-9

**Interfaces:**

- Consumes: the final implementation tree, deterministic fixtures, mobile E2E, one privacy-safe generated artifact.
- Produces: green repository evidence, independent review results, a physical iPhone checklist, and an explicit non-push boundary.

- [ ] **Step 1: Verify a clean non-push implementation checkpoint**

  Run:

  ```powershell
  git status --short
  git branch --show-current
  git merge-base --is-ancestor 4a0ff1ec HEAD
  ```

  Expected: status is empty. Record the branch and ancestry exit code. If ancestry exits `0`, this is the known sensitive-history source and must never be pushed; Task 10 remains local verification only.

- [ ] **Step 2: Write the physical iPhone acceptance checklist**

  Create `docs/form-diagnostic-field-acceptance.md` with this exact substance:

  ````markdown
  # Form Diagnostic Field Acceptance

  Repository tests and JSON export do not establish physical acceptance.

  ## Trusted HTTPS prerequisite

  - Record the exact implementation commit and tree IDs served by the preview.
  - Confirm the app reports Archery Note v84; the version alone is not proof of tree identity.
  - Use an `https://` Safari origin on the physical iPhone. Do not use the local HTTP helpers for live camera capture.
  - If a trusted preview pinned to the implementation tree is unavailable, stop; this checklist does not authorize deployment.

  ## Physical sequence

  ## Data preparation

  - Use a dedicated test browser profile or installation.
  - Export a normal practice backup before testing if existing data is present.
  - Do not clear all Safari site data; that can remove local practice records.
  - Enable form diagnostics explicitly and start a new `18射の診断` batch.

  Use ordinary archer placement; do not optimize placement after observing the detector.

  1. Record and save six real shots from 真横.
  2. Record and save six real shots from やや斜め.
  3. Record and save six real shots from 通常設置.

  ## Pass criteria

  - 6/6 real shots are retained in each condition.
  - Each condition has at most one false positive, removable without deleting another shot.
  - No shown true shot is automatically removed.
  - Every retained receipt has anchorFloor, anchorEnter, releaseSpeed, evidenceAgeMs, evidenceStrength, departDelta, and fireEvidence.
  - 診断JSONを書き出す succeeds only after the app's buildFormDiagnosticExport(...) gate returns ok: true. No separate artifact validator is claimed.

  ## Privacy

  Keep archery-note-form-diagnostics.json outside the repository. Do not commit JSON, video, screenshots with private paths, device details, or raw diagnostics. If the artifact is transferred to the development PC, place it temporarily at `C:\tmp\archery-note-form-diagnostics.json` and record the output of:

  ```powershell
  Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\tmp\archery-note-form-diagnostics.json'
  ```
  ````

  Record only commit/tree IDs, iOS/Safari versions without local identifiers, aggregate condition results, pass/fail, and artifact SHA-256.

  ```

  ```

- [ ] **Step 3: Run both focused Node suites**

  Run `node tools/check-form-core.js` and `node tools/check-form-diagnostics.js`.

  Expected: exit `0`, ending in `Form core checks OK` and `Form diagnostic checks OK`.

- [ ] **Step 4: Run storage, app, UI, and cumulative gates**

  Run:

  ```powershell
  npm run check:storage
  npm run check:app
  npm run check:ui
  npm run check:all
  ```

  Expected: every command exits `0`; app/version output remains aligned at `v84` because this plan does not bump versions.

- [ ] **Step 5: Run lint, formatting, browser, and deterministic fixtures**

  Run:

  ```powershell
  npm run lint
  npm run format:check
  npm run test:e2e
  python -B tools/golden-replay/test_golden_expectations.py
  npm run golden:form-fixtures
  ```

  Expected: zero failures and zero skipped E2E tests; record the actual test count. Python ends in `OK`; form fixtures retain one oblique `close` release and zero scene-cut releases without `SEMANTIC MISMATCH`.

- [ ] **Step 6: Build the ignored native-web mirror**

  Run:

  ```powershell
  npm run build:native-web
  git check-ignore -q dist/native/native-readiness.json
  git status --short --untracked-files=all -- dist
  ```

  Expected: build succeeds, the ignore check exits `0`, and scoped status is empty.

- [ ] **Step 7: Request two independent read-only reviews**

  Use the `requesting-code-review` workflow. Reviewer A reruns retained A → fire B → manually remove B → cancel B, summary failure, receipt 33/34, sequence failures, branch priority, save false/throw/retry/discard, and scans cancellation scopes for array-tail/timestamp ownership. Reviewer B reruns matrix poison/duplicate/reorder/counter/overflow and `65,536/65,537` boundaries, literal allowlist/sentinel privacy, no-fallback transports, diagnostics-OFF storage compatibility, exact-boolean UI, and mobile E2E. Require no Critical or Important finding.

- [ ] **Step 8: Route review findings back to their owning RED**

  Tracker/identity/fire/matrix/projection/transaction/save/transport/UI findings return to Tasks 1–9 respectively. Add a focused failing assertion, implement the smallest correction, run that task's full GREEN block, create a new fix commit, then restart Task 10 at Step 3. Never waive an Important finding only because another suite is green.

- [ ] **Step 9: Record verification and the remaining physical gap**

  Append exact outputs, actual E2E count, reviewer verdicts, implementation commit/tree IDs, the trusted-HTTPS/physical-iPhone gap, and the next action to `docs/codex/codex-progress.md`. State explicitly that no physical matrix, version bump, deployment, PR, or push occurred in Task 10.

- [ ] **Step 10: Format and inspect the Task-10 documentation diff**

  Run:

  ```powershell
  npx prettier --check docs/form-diagnostic-field-acceptance.md docs/codex/codex-progress.md
  git diff --check
  git status --short
  ```

  Expected: formatting and whitespace checks pass; status contains only the field checklist and progress ledger for this task.

- [ ] **Step 11: Commit the field handoff only**

  Run:

  ```powershell
  git add docs/form-diagnostic-field-acceptance.md docs/codex/codex-progress.md
  git diff --check --cached
  git commit -m "docs(form): prepare field acceptance"
  git status --short
  ```

  Expected: commit succeeds with the exact subject and final status is empty. Stop without pushing.

## Post-plan product and GitHub gates

The implementation plan ends at a tested field handoff; it does not claim physical acceptance or authorize an implementation push. The separately authorized `codex/form-diagnostic-handoff-plan-wip` checkpoint is reconstructed as one commit on current `origin/main` whose tree equals the sanitized current WIP tree at this planning boundary. It may include the pre-existing unaccepted feature work already present in that tree, so it must remain explicitly WIP: it is not an implementation acceptance result, release candidate, physical result, PR, release, version bump, Pages update, or deployment, and it must never be promoted as one. The sensitive source branch itself is never pushed.

1. Run the physical iPhone matrix on a trusted HTTPS preview pinned to exact implementation commit/tree IDs. Require `6/6` in all three conditions, at most one removable false positive per condition, no shown true shot auto-removed, complete seven-field retained receipts, and a successful app-gated export.
2. If a condition fails, diagnose bounded receipt outcomes/fire values and add a deterministic RED fixture before detector changes. Never tune from aggregate counts alone.
3. Keep replay EOS keep/delete policy separate; this plan records `replay-eos` unresolved and preserves the visible shot.
4. After every physical criterion passes, construct a fresh `codex/form-diagnostic-handoff-rc` from then-current `main`; do not merge, rebase, rename, or promote the planning WIP or the sensitive source branch.
5. Require the RC tree ID to equal the accepted implementation tree, `git merge-base --is-ancestor 4a0ff1ec codex/form-diagnostic-handoff-rc` to exit `1`, a zero-hit sensitive-content scan, the complete Task-10 ladder, and a clean worktree.
6. Stop before pushing the final RC, opening/merging a PR, tagging, releasing, changing Pages/Service Worker behavior, writing release notes, or running `npm run version:bump`; each remains a new explicit release authorization.
