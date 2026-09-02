# Form Diagnostic Handoff Design

## Decision and approval

Archery Note will use a view-owned release-receipt tracker for live capture and
saved-video replay. Each detector fire receives an opaque runtime ID before
shot summarization. If a visible shot is created, that same ID becomes the
shot's existing `shot.id`. Automatic cancellation may remove only that exact
ID; it must never infer ownership from the current array tail.

The user selected this approach as option A on 2026-08-03 and then explicitly
approved all three handoff slices:

1. stable provisional-shot identity and outcome mapping;
2. complete live/replay fire snapshots; and
3. a default-off, bounded diagnostics-only JSON export.

This approval does not include a storage migration, Service Worker activation
or cache change, dependency addition, release/version bump, public push, pull
request, deployment, or history rewrite. Those existing approval boundaries
remain in force.

## Product gates

The handoff is supporting infrastructure for the already approved form-analysis
product, not a new primary feature:

1. It connects automatic form counting, saved form analyses, and the physical
   field-acceptance workflow.
2. It makes diagnostic acceptance records trustworthy by proving which
   detector receipt produced each retained shot, while leaving ordinary
   diagnostic-off history payloads unchanged.
3. Processing and export remain fully local. No cloud, telemetry, external
   inference, or automatic upload is added.
4. Exact-ID cancellation improves the daily capture flow without adding a
   control. The specialist export stays hidden unless the existing diagnostic
   setting is enabled.

The normal phone flow therefore remains unchanged. Diagnostic controls are
kept in the secondary settings surface and remain default-off.

## Current failure and evidence gap

Both form workflows already assign `shot.id` and render the ID in
`data-shot-id`. Live manual removal correctly filters by that ID. Automatic
cancellation in both live capture and replay instead selects
`shots[shots.length - 1]`.

The failure sequence is deterministic:

1. retained shot A is present;
2. the detector fires provisional shot B;
3. the user manually removes B while the detector still owns B's 400 ms
   confirmation window; and
4. B is later canceled, but the view deletes the new array tail A.

The same unsafe fallback can delete an unrelated shot when a detector fire
cannot be summarized and therefore creates no visible shot.

The diagnostic path also cannot yet prove the 18-shot acceptance matrix:

- live capture receives the complete fire-time debug object only transiently;
- persisted `features[].diag` keeps only `maxV`, `rise`, `nullFrames`, and
  `conf`;
- replay does not attach per-shot fire diagnostics;
- `releaseFires[].framesBefore` excludes the current fire frame;
- manual removal has no outcome event; and
- the only current JSON export serializes the full practice database.

## Goals

- A delayed cancellation can never remove a shot created by another detector
  receipt.
- Manual removal and detector resolution remain independently attributable to
  the same receipt.
- Live capture and replay use one deterministic receipt lifecycle.
- Every fire in a diagnostic-enabled, zero-overflow export-eligible run records
  the seven acceptance fields at the exact fire frame; overflow refuses the
  run rather than claiming completeness.
- A user can export the three six-shot field runs without exporting practice
  records, dates, device-local IDs, media, or raw pose data.
- Old saved records and backups continue loading without migration.
- Diagnostic-off behavior and persisted size remain unchanged except for the
  correctness fix needed to target cancellation.

## Non-goals

- No detector threshold, phase, refractory, confirmation, or count heuristic
  changes.
- No end-of-stream keep/remove policy. This design records an unresolved
  outcome but does not silently keep or delete it differently.
- No physical iPhone acceptance claim. The handoff enables that later test.
- No video, image, audio, pixel, or full-landmark persistence.
- No condition selector or new primary capture control.
- No storage key, schema version, backup/import protocol or required-field
  contract, Service Worker, dependency, app version, release, deployment, or
  public Git operation.
- No publication of restricted local diagnostic sources or derived schedules.

## Considered approaches

### A. View-owned receipt identity

Selected. A pure tracker allocates opaque IDs, but its state is instantiated by
each view workflow and is not attached to the detector. It correlates fire,
visible-shot creation, manual removal, detector confirmation, and detector
cancellation.

This keeps UI ownership in the view, gives live/replay parity, and leaves
`stepFormPhase()` independent of DOM and database concerns.

### B. Put shot identity inside `pendingRelease`

Rejected. The detector would need an ID allocated by the UI or a callback into
the view. That couples otherwise pure detection state to presentation and
storage identity and broadens every core fixture.

### C. Infer ownership from array position or timestamp

Rejected. Array position is the current defect. Timestamp matching remains
ambiguous after manual removal, failed summarization, geometry reset, or
duplicate scheduling observations. Neither is a stable identity contract.

## Architecture

### Pure receipt tracker, view-owned state

Implement the small DOM-free helper in `scripts/46-form-core.js` alongside the
existing pure form utilities so the Node harness can test it directly. Export
it through the existing form-core test surface. Tracker instances are created
inside live capture and replay. The helper does not read `db`, DOM, MediaPipe,
or detector internals, and `stepFormPhase()` remains unchanged.

Required interface:

```js
const tracker = makeFormReleaseReceiptTracker({ maxDiagnosticReceipts: 32 });

tracker.begin({ fireTs, fire });
tracker.markShotCreated(id);
tracker.manualRemove(id);
tracker.confirm();
tracker.cancel(cancelReason);
tracker.abandon(unresolvedReason);
tracker.current();
tracker.snapshot();
```

The helper owns only lifecycle data. Its single operational active-receipt slot
is outside the diagnostic archive and is never dropped because the archive is
full. Mutation methods return a small action containing either the exact
possible deletion target or `null`; they never touch the shot array
themselves. `snapshot()` returns copied archived receipt records, the overflow
count, fixed invariant counters, the `desynchronized` boolean, and no live
object references.

The fixed `receiptInvariantCounts` object contains only
`supersededActive`, `missingActive`, `identityMismatch`, `invalidTransition`, and
`sequenceExhausted`. Each value is a safe integer that saturates at `255`.
Tracker methods increment exactly one matching counter for a defensive-path
failure and return its fixed code; they never create free-form event strings.
`supersededActive` accompanies the defined `superseded-fire` transition,
`missingActive` covers a terminal action with no active receipt,
`identityMismatch` covers an ID-bearing action that does not match its target,
`invalidTransition` covers an illegal lifecycle mutation, and
`sequenceExhausted` covers an unavailable next deterministic ID. The counters
are copied by `snapshot()`; views persist them only when diagnostics are
enabled. They are excluded from the diagnostics-only export and must all be
zero for a field-matrix record to be eligible.

`desynchronized` starts `false` and is a one-way fail-closed latch for an ID
allocation failure. While latched, `current()` is `null`; `begin()`,
`confirm()`, `cancel()`, and `abandon()` return no deletion target and cannot
create or retarget a receipt. Only constructing a new capture/replay workflow
and tracker clears the latch.

### Identity allocation

- Each new capture or replay workflow starts a view-local integer receipt
  sequence at zero inside its tracker. `tracker.begin()` allocates and returns
  the next ID deterministically as `form-receipt-${++receiptSequence}` before
  the view calls `summarizeFormShot()` for every `released: true` result.
- Pass that ID into `onShot()` rather than allocating inside `onShot()`.
- If summarization succeeds, assign the same ID to `shot.id` and call
  `markShotCreated(id)`.
- If summarization fails, retain a receipt tombstone with `shotCreated=false`.
- The detector never sees this ID.
- Because the detector owns at most one pending release, the tracker has at
  most one active pending receipt. Completed diagnostic receipts may remain in
  the tracker's bounded diagnostic collection.
- Geometry changes reset detector geometry but do not reset the receipt
  sequence, tracker, completed receipts, or visible shots. This preserves ID
  uniqueness across camera, handedness, and crop changes in one workflow.
- Receipt IDs need to be unique only inside one capture or replay workflow.
  Different saved records may both start at `form-receipt-1`; validation checks
  uniqueness within each source record and export replaces IDs with local
  ordinals. The sequence is limited to `1..999999`; the tracker rejects an
  exhausted or internally inconsistent next value without creating a shot. If
  a receipt was active, it is first finalized unresolved with
  `superseded-fire`; the tracker then clears the active slot, increments
  `sequenceExhausted` or `invalidTransition`, and permanently latches
  `desynchronized=true` for that workflow. The returned action has `id=null`,
  `deletionTarget=null`, and `fatal=true`.
- The active receipt continues to work after the 32-record diagnostic archive
  is full. Every later fire still receives a unique ID and exact-ID
  cancellation; completion increments overflow instead of archiving the full
  receipt, making export ineligible without changing counting behavior.
- If `begin()` is called while another receipt remains pending, finalize the
  original receipt as unresolved with `superseded-fire`, increment the bounded
  `supersededActive` counter, and start the new receipt without deleting the
  original shot. If allocation cannot succeed, use the desynchronization
  transition above instead of leaving the original receipt active.

### Two-axis outcome model

Do not compress manual and detector decisions into one mutable flag. Each
receipt keeps two independent dispositions:

```js
{
  id,
  fireTs,
  shotCreated,
  userDisposition: "present" | "manual-removed" | "not-created",
  detectorDisposition: "pending" | "confirmed" | "auto-canceled" | "unresolved",
  cancelReason: null | "anchor-return" | "nb2-drift" | "nb2-unobserved" | "no-depart",
  unresolvedReason: null | "geometry-reset" | "workflow-save" | "workflow-close" | "replay-eos" | "superseded-fire",
  fire: null | fireSnapshot
}
```

Rules:

- Manual removal deletes only the clicked shot ID and changes
  `userDisposition` to `manual-removed`.
- Manual removal does not clear or retarget the detector's active receipt.
- A later detector cancellation changes `detectorDisposition` on that same
  receipt and returns only its ID as the possible deletion target.
- If the target shot is already absent, cancellation is a harmless no-op.
- Missing, malformed, or mismatched active identity returns no deletion
  target. There is no array-tail fallback.
- When detector pending state clears without `canceled`, mark the active
  receipt `confirmed`.
- Geometry reset, workflow save/close, or replay end marks a still pending
  receipt `unresolved` and removes no visible shot. Save handlers perform this
  transition before serializing the diagnostic record.
- An unexpected second fire while a receipt is pending first marks the old
  receipt unresolved with `superseded-fire`, then starts a distinct receipt
  for the new detector fire. It increments `supersededActive` in memory,
  persists that counter only when debugging is enabled, and removes neither
  shot. A later cancellation can therefore target only the new receipt; the old
  shot cannot be mistaken for it.
- The live arrow-presence `pendingCheck` remains a separate concern. Manual or
  automatic removal may clear an arrow check only when its `shotId` matches;
  it must not clear receipt ownership.
- The same bounded in-memory lifecycle runs when diagnostics are off so the
  identity behavior cannot diverge by setting. Only diagnostics-enabled saves
  persist receipt archives or snapshots.

Each live/replay frame uses this integration order:

1. remember whether the core detector had a pending release before
   `stepFormPhase()`;
2. run `stepFormPhase()` once;
3. if it returns `canceled`, resolve the active receipt as auto-canceled and
   apply only the returned exact-ID deletion action;
4. if it returns `released`, allocate the ID, begin the receipt, snapshot the
   fire result when diagnostics are enabled, and then attempt shot
   summarization with that ID; otherwise
5. if the detector previously had a pending release and now has none, confirm
   the active receipt.

Cancellation takes precedence over confirmation. A release begins a new core
pending window and cannot be confirmed in its own frame.

If step 4 receives the tracker's `fatal=true` allocation result, the view does
not call `onShot()`. It freezes new-frame/recording input without closing the
modal, keeps all existing visible shots, disables further tracking, and shows a
restart-required error while leaving save-existing-results and confirmed close
available. The newer detector pending state has no receipt owner; because the
tracker is latched, any accidentally delivered later cancel/confirm action
returns no deletion target. Geometry or handedness reset cannot clear this
state inside the workflow.

The user-facing terminal outcome is derived without losing the detector axis:

```text
not-created                         -> summary-failed
manual-removed                     -> manual-removed
present + auto-canceled            -> auto-canceled
present + confirmed                -> retained
otherwise                          -> unresolved
```

For `manual-removed` followed by detector cancellation, the exported terminal
outcome remains `manual-removed`, while `detectorOutcome="auto-canceled"` and
`cancelReason` preserve the later detector result.

## Fire snapshot contract

At `released: true`, copy exactly these seven keys from the current result's
fire-time debug object before detector evidence can change:

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

Requirements:

- All seven keys are present for every diagnostics-enabled receipt in both live
  capture and replay. Diagnostics-off in-memory receipts keep `fire=null` and
  are never export eligible or persisted.
- Numeric values are finite numbers or explicit `null`; never `undefined`,
  `NaN`, or infinity.
- `fireEvidence` is one of the detector's real fire labels:
  `adaptive`, `close`, or `nb2`.
- Route-inapplicable evidence stays `null`; it is not invented.
- The snapshot uses the current fire result, not a later frame and not an
  inferred value from `framesBefore`.
- The snapshot is collected only when the existing diagnostic setting is
  exactly `true`. Identity correctness itself is always active.
- Existing internal frame traces may remain for local diagnosis, but they are
  excluded from the diagnostics-only export.

Persisted diagnostic records gain the exact additive marker
`formDiagnosticVersion: 1` and fixed `captureMode: "live" | "replay"`. Old
records with no marker or mode remain valid and are simply ineligible for the
new exporter.

When diagnostics are enabled, `formPhaseDiag.releaseReceipts` contains the
tracker's copied receipt records and `formPhaseDiag.receiptOverflow` contains
its nonnegative overflow count;
`formPhaseDiag.receiptInvariantCounts` contains the fixed saturated counters.
`formPhaseDiag.receiptDesynchronized` contains the exact tracker boolean.
Immediately before normal or diagnostic-only record construction, the save
handler first abandons any active pending receipt as `workflow-save`, then
snapshots the tracker whether or not an active receipt existed. Existing
`releaseFires`, `canceledEvents`, and frame-trace fields remain backward
compatible. Each existing `releaseFires` entry continues to use the same
runtime ID and is capped at 32 entries in the new contract.

The tracker is the sole owner of `receiptOverflow`. It increments the counter
exactly once for each terminal receipt that cannot enter the full archive;
`releaseFires` truncation must not increment it again. Any overflow makes the
run exporter-ineligible, so a truncated diagnostic run cannot be mistaken for
complete acceptance evidence.

Every existing `releaseFires[].shotId` uses the preallocated receipt ID even
when shot summarization fails. Every `canceledEvents[].shotId` uses the active
receipt ID even when the visible shot was already manually removed. Neither
field may be populated from a shot-array position. When diagnostics are
enabled, each persisted retained feature also gains additive
`features[].receiptId` for source-only correlation; diagnostics-off feature
objects remain unchanged, and the diagnostics exporter never copies this ID.

## Persistence compatibility

The current schema-5 normalizer preserves valid `formAnalyses` records and
their unknown nested fields rather than reconstructing them. The new marker,
receipt outcomes, and fire snapshots are therefore additive fields under the
existing diagnostic record.

- Do not change `SCHEMA_VER`, `archeryNote.v1`, or snapshot keys.
- Do not rename or remove any existing field.
- Missing new fields in old records mean `unknown` or exporter-ineligible,
  never implicitly `retained`.
- Keep diagnostics default-off. When off, do not persist receipts, fire
  snapshots, or outcome arrays.
- Cap diagnostic receipts and existing `releaseFires` at 32 per saved run. If
  a 33rd terminal receipt cannot enter the archive, increment
  `receiptOverflow` once so export can refuse; do not silently present a
  truncated run as complete.
- The cap applies only to diagnostic retention. It never blocks a detector
  fire, visible-shot insertion, manual removal, confirmation, or exact-ID
  cancellation, including receipt 33 and later.
- Preserve existing caps on rejected and cancellation trace collections.

Storage regression tests must prove deep preservation through normalization
twice, save/load, JSON backup/import, safety snapshot restore, and trash
restore, including the optional matrix coordinator and record markers, while a
legacy fixture with all new fields absent still loads. Imported malformed
coordinator state is preserved by the generic normalizer but must fail closed
at the diagnostic feature boundary; normalization must not delete unrelated
user data to repair it.

## Diagnostics-only export

### Matrix batch coordinator and source selection

Array position is not evidence of capture order: trash restore and import can
reorder records, and replay must never masquerade as a physical field run. A
small diagnostics-only coordinator in settings therefore owns the current
matrix batch:

```js
{
  version: 1,
  batchId,
  appVer: APP_VER,
  nextSlot: 0 | 1 | 2 | 3,
  recordIds: [],
  invalidated: false,
}
```

- The fixed slot sequence is `side`, `oblique`, then `normal_range`; there is
  no free-form condition label and no condition selector in primary capture.
- `18射の診断を開始` creates a new internal batch ID with Web Crypto
  (`randomUUID()` or a `getRandomValues()` fallback), checks it against the
  active coordinator, saved form analyses, and form-analysis trash, and retries
  at most three times before failing closed. The ID is stored locally but never
  exported.
- Starting again while a batch is incomplete requires confirmation. It replaces
  only the coordinator; it never deletes or rewrites a saved form analysis.
  Start/restart becomes visible as successful only when its immediate
  coordinator save returns `true`; otherwise the prior coordinator and
  `db.updatedAt` are restored.
- A saved live diagnostic record advances the next slot only when it already
  has exactly six retained shots, zero overflow, complete valid receipt
  outcomes, zero receipt-invariant counters,
  `receiptDesynchronized === false`, complete fire snapshots,
  `captureMode: "live"`, and
  `record.appVer === coordinator.appVer === APP_VER`. A stale-version
  coordinator never advances; the record is saved without a matrix marker and
  the operator is told to start a new batch. An accepted record gains the
  additive fixed marker
  `formDiagnosticMatrix: { version: 1, batchId, slot }`.
- Record insertion, matrix marker attachment, coordinator `recordIds` append,
  and `nextSlot` advance occur in one database mutation followed by one save.
  An ineligible live run is still saved normally but receives no matrix marker
  and does not consume a slot; the UI tells the operator to repeat that slot.
- Build the candidate form-analysis array and coordinator as detached values.
  Before the synchronous save attempt, freeze new-frame ingestion: cancel the
  animation loop, stop live recording and camera tracks or pause replay, but
  keep the modal and active-workflow lock. Retain the prior array, coordinator,
  and `db.updatedAt`. If `save()` returns `false` or throws, restore those prior
  in-memory values exactly, report failure, show no success/next-slot state,
  and keep the modal in a frozen retry-or-close state.
  The record, marker, and slot become committed only after `save() === true`;
  only then may capture/replay teardown and modal close proceed. There is no
  automatic retry. An explicit retry reuses the exact frozen candidate and
  coordinator without stepping the detector, resummarizing shots, abandoning
  the tracker again, or allocating another ID. Close requires confirmation with
  `保存できていない診断を破棄して閉じますか？`; only confirmation discards the
  candidate and closes without entering the diagnostic-only close-save path.
- Replay and zero-shot diagnostic records never receive a matrix marker or
  advance the coordinator.
- Deleting any selected record permanently sets the current coordinator's
  `invalidated` flag. Trash restoration does not clear it; a new matrix must be
  started. Unrelated restored or imported records cannot substitute for a
  selected record. Selected-record deletion, trash insertion, invalidation, and
  `updatedAt` are one detached transaction; save failure restores all four so
  the UI cannot report a deletion that did not persist. If the selected ID does
  not resolve to exactly one current record, deletion itself fails closed and
  mutates neither records nor trash.

The exporter reads only the coordinator's three exact `recordIds`, requires
each ID to resolve to exactly one current `db.formAnalyses` record, verifies
their unique fixed slots and matching batch ID, and ignores saved-array order.
Zero matches or multiple database records with the same selected ID are
ambiguous and fail closed.
It requires a complete, non-invalidated coordinator, `captureMode: "live"`,
`record.appVer === coordinator.appVer === APP_VER`, exactly six retained shots
per record, 1-32 receipts, zero overflow, unique valid runtime IDs, a complete
fire snapshot for every receipt, no unresolved retained shot, and internally
consistent outcome totals. A missing, deleted, replayed, old-version,
ID-substituted, malformed, or otherwise invalid source causes a refusal; the
exporter never skips it or falls back to another record. Reordering the saved
array alone has no effect because selection is by exact coordinator IDs.

### Exact output shape

The exporter constructs fresh literal objects and never spreads a database or
diagnostic record. The fragment below shows every allowed key but abbreviates
the fixed three-run arrays to one run and one receipt; it is not an
exporter-valid 3 x 6 fixture. The example `appVersion` is illustrative;
production copies the common validated source-record `appVer` only after
proving that all three records and the coordinator equal the current numeric
`APP_VER`:

```json
{
  "format": "archery-note-form-diagnostics",
  "schemaVersion": 1,
  "appVersion": 84,
  "matrix": "field-3x6",
  "runs": [
    {
      "runOrdinal": 1,
      "condition": "side",
      "retainedShotCount": 6,
      "receipts": [
        {
          "receiptOrdinal": 1,
          "outcome": "retained",
          "detectorOutcome": "confirmed",
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
        }
      ]
    }
  ]
}
```

Allowed terminal outcomes are `retained`, `manual-removed`, `auto-canceled`,
`summary-failed`, and `unresolved`. Allowed detector outcomes are `confirmed`,
`auto-canceled`, and `unresolved`; a still-`pending` receipt is
exporter-invalid. Cancellation and unresolved reasons use only the fixed enums
in this design.

Runtime IDs are used only to validate and correlate the source record. They
are replaced by sequential export-local ordinals and never copied into the
output.

### Exact source validation

Validation is fail-closed and uses own-property checks rather than truthiness:

- `formDiagnosticVersion`, matrix `version`, coordinator `version`, and output
  `schemaVersion` equal integer `1`; `record.appVer`, coordinator `appVer`, and
  current `APP_VER` are the same positive safe integer.
- `invalidated` is boolean `false`, `nextSlot` is integer `3`, and
  `nextSlot === recordIds.length`; `batchId` is one canonical lowercase UUID
  string; and all three record markers match it. Matrix slots are exactly the
  three fixed enum members once each. Coordinator `recordIds` contains exactly
  three unique non-empty strings of at most 128 characters, in fixed slot
  order, that resolve to those records.
- `record.shots`, `features.length`, and the number of receipts whose derived
  terminal outcome is `retained` are equal to integer `6`.
- `receiptOverflow` is safe integer `0`; receipt count is a safe integer in
  `1..32`; every runtime ID is a unique string within its record matching
  `^form-receipt-[1-9][0-9]{0,5}$`. The IDs must be the contiguous set
  `form-receipt-1..N`; projection sorts by that numeric suffix and assigns the
  same number as `receiptOrdinal`, independent of imported array order.
- `receiptInvariantCounts` has exactly the five fixed keys and every value is
  safe integer `0`; a missing, positive, negative, non-integer, saturated, or
  extra counter makes the record ineligible.
- `receiptDesynchronized` is exactly boolean `false`; missing, truthy,
  non-boolean, or `true` state is ineligible.
- `detectorDisposition="confirmed"` requires both reasons `null`;
  `auto-canceled` requires one allowed non-null `cancelReason` and
  `unresolvedReason=null`; `unresolved` requires `cancelReason=null` and one
  allowed non-null `unresolvedReason`.
- `userDisposition="not-created"` derives `summary-failed`;
  `manual-removed` derives `manual-removed`; `present + confirmed` derives
  `retained`; `present + auto-canceled` derives `auto-canceled`; and
  `present + unresolved` derives `unresolved`. No other combination is valid.
  Because the retained-count equation excludes unresolved receipts, a visible
  unresolved shot makes the record exporter-ineligible.
- `shotCreated` is boolean and is `false` exactly for `not-created`; it is
  `true` for `present` and `manual-removed`.
- Every `features[].receiptId` used for internal correlation is a unique runtime ID
  belonging to exactly one `present + confirmed` receipt. No canceled,
  manually removed, failed-summary, unresolved, missing, or duplicate receipt
  may contribute a feature.
- All count, ordinal, and version fields are safe integers before projection.
  Output `format` is exactly `archery-note-form-diagnostics`, `matrix` is
  exactly `field-3x6`, run ordinals/conditions are exactly
  `1/side`, `2/oblique`, and `3/normal_range`, and retained count is always
  integer `6`. Unknown enum members and extra source fields do not pass through;
  the exporter emits only the fixed output keys shown in the fragment.

The seven fire values use detector-semantic conservative bounds before
rounding: `anchorFloor` is `null` or `0..1.3`; `anchorEnter` is `0.35..0.65`;
`releaseSpeed` is `6..8`; `evidenceAgeMs` is `null` or `0..1500`;
`evidenceStrength` is `null` or an integer `3..12`; `departDelta` is `null` or
`-1.3..1.3`; and `fireEvidence` is exactly `adaptive`, `close`, or `nb2`.
Every numeric value must first be finite. A huge but finite imported number is
invalid rather than rounded into the artifact.

### Bounds and privacy exclusions

- Exactly three runs.
- At most 32 receipts per run.
- Serialize exactly as `JSON.stringify(payload, null, 2) + "\n"` and name the
  file `archery-note-form-diagnostics.json` with MIME type
  `application/json;charset=utf-8`.
- Measure the final serialized string with `TextEncoder().encode(json).byteLength`.
  At most 65,536 bytes is accepted; 65,537 bytes is refused. Never truncate.
- Round finite derived numbers to at most three decimals after validation.
- Reject non-finite or structurally invalid values before `JSON.stringify` can
  coerce them.
- Use a diagnostics-specific share/download wrapper. It may reuse low-level
  transport capabilities, but it must not call or change the full-backup
  serializer, backup handler, `lastBackupAt`, or automatic safety-snapshot
  behavior.
- Choose one supported transport before opening UI. After a web or native share
  UI is invoked, user cancellation returns `canceled` with no toast unless
  cleanup itself fails, and with no second share sheet, text-share fallback, or
  download. Any other invoked-share failure reports an error and also does not
  silently switch transport. Direct download is used only when no share
  capability was selected. Once a transport is selected, any preparation,
  write, invocation, or cleanup failure terminates that attempt without
  switching transport.
- If native sharing requires a Capacitor `CACHE` file, the diagnostics wrapper
  owns the fixed temporary path, removes any stale file at that exact path
  before writing, and attempts deletion in `finally` after success,
  cancellation, and error. A not-found deletion is harmless; any other stale
  cleanup failure aborts before writing, while a final cleanup failure shows a
  sensitive-temporary-file warning. Neither triggers another transport.
  Browser download revokes its object URL after the initiated download.
  User-selected download destinations are not deleted.

The artifact must exclude:

- database, session, setup, shot, or device-local IDs;
- dates, wall-clock timestamps, filenames, paths, URLs, or device metadata;
- names, notes, scores, equipment, settings, active state, trash, or other
  practice records;
- video, audio, images, pixels, raw landmarks, or full landmark sets;
- frame traces, `rejectedFramesNear`, `framesBefore`, and arbitrary strings;
- unknown or future object keys.

Derived pose metrics remain sensitive even without media. The UI must say what
is excluded and remind the user to choose the sharing destination. The fixed
matrix label is `field-3x6`, not a device claim; iPhone model, physical setup,
and operator-observed truth belong to the later field-test report and are not
inferred or exported here. Likewise, each `condition` is the coordinator's
operator instruction slot, not a pose-classifier assertion.

## UI behavior

Add no primary capture control. Mount one secondary settings section and keep it
both hidden and disabled unless `db.settings.formDebug === true`:

- Label: `18射の診断JSON`
- Start button: `18射の診断を開始`
- Hint:
  `開始後、真横→やや斜め→通常設置の順に各6射を記録します。条件を満たさない記録は診断バッチに追加されません。`
- Next-slot status examples: `次は「真横」を6射記録してください。` and
  `18射の診断がそろいました。`
- Button: `診断JSONを書き出す`
- Confirmation:
  `現在の18射診断バッチの診断値だけを書き出します。練習記録、日付、メモ、端末内ID、映像、画像、ランドマークは含みません。診断値の共有先は自分で確認してください。`
- Incomplete-state message:
  `18射の診断が完了していません。開始後、表示された条件を各6射ずつ記録してください。`

The form-debug toggle immediately calls a small UI synchronizer so OFF-to-ON
shows and enables the section without reopening settings, while ON-to-OFF hides
and disables it immediately. Both start and export handlers re-check
`db.settings.formDebug === true` at action time; a truthy non-boolean value is
still hidden and inert. Toggling diagnostics off preserves an incomplete batch
but cannot advance or export it until diagnostics are explicitly on again.

Starting/restarting a batch and exporting are explicit user actions and are both
blocked while another app workflow is active. A capture save advances the
coordinator only after re-checking that diagnostics are exactly `true` and that
the same batch is still current. Export remains guarded by the existing
active-workflow mechanism and reports share/download failure without changing
saved data.

## Error handling

- Orphan or malformed cancellation: increment the matching fixed invariant
  counter, persist it only in diagnostics, and remove no shot.
- Receipt-ID allocation failure: finalize any old active receipt as unresolved,
  clear deletion ownership, latch desynchronization, create no new shot, and
  freeze tracking until the user saves or closes and restarts the workflow.
- Summary failure: keep a `not-created` receipt; later detector resolution
  cannot affect another shot.
- Manual removal followed by cancellation: preserve both outcomes on the same
  receipt and remove nothing else.
- Reset, close, save, or EOS while pending: mark unresolved and keep the
  visible shot. Save performs this transition before constructing the record;
  this does not introduce an EOS keep/delete decision.
- Missing or legacy diagnostic fields: refuse diagnostics-only export and
  preserve the record unchanged.
- Receipt overflow or output above 64 KiB: refuse export and explain that the
  three field runs must be repeated cleanly.
- Missing, invalidated, replay, ID-substituted, or old-version matrix
  sources: refuse export and require a new matrix rather than guessing.
- Storage-write failure: roll back the candidate record and coordinator,
  retain the frozen unsaved analysis for explicit retry or close, and never
  report slot completion.
- Share cancellation by the user is terminal but not an error. It performs no
  transport fallback. Other share/download errors show a toast and leave
  database state unchanged.

## Test design

All behavior changes use red-green-refactor. Implementation is split so each
checkpoint has its own initial failing regression.

### Checkpoint 1: stable identity and outcomes

- Retained A survives `fire B -> manually remove B -> cancel B`.
- Both the manual and detector dispositions remain mapped to B.
- Normal cancellation removes B by exact ID.
- A failed shot summary cannot remove A on later cancellation.
- Missing, malformed, mismatched, and orphan identities remove nothing.
- Detector confirmation marks only the active receipt confirmed.
- A result with `canceled=true` and post-step
  `detector.pendingRelease===null` is canceled, never inferred as confirmed.
- An unexpected second fire marks the first receipt `superseded-fire`, creates
  a new identity, and lets a later cancellation target only the new shot.
- Receipt IDs remain unique through more than 32 fires and every geometry
  reset; fire/cancel 33 works with diagnostics both off and on.
- The tracker allocates monotonically increasing record-local IDs, rejects an
  exhausted or inconsistent sequence before shot creation, and never retries a
  probabilistic ID.
- Sequence exhaustion with an old active receipt finalizes that receipt
  unresolved, clears active ownership, latches desynchronization, creates no
  new shot, and makes later cancel/confirm/reset actions deletion-free. The
  same fatal latch occurs with no old active receipt; only a new workflow clears
  it.
- Live/replay integration never calls `onShot()` for a fatal allocation result,
  freezes further input without closing, preserves existing shots, and permits
  only save-existing-results or confirmed close/restart.
- Each defensive failure increments only its defined invariant counter; counters
  saturate at 255, snapshots return copies, only diagnostic saves persist them,
  and nonzero counters never permit matrix eligibility.
- Live and replay save while pending mark unresolved and snapshot that state
  before record construction.
- A zero-shot diagnostic save after summary failure snapshots the unresolved
  tombstone before record construction.
- Live camera, handedness, and crop resets plus replay handedness reset and
  replay EOS mark only the active receipt unresolved without deleting its
  shot or resetting receipt identity.
- Workflow close marks the active receipt unresolved before teardown, even
  when no record is saved.
- Live and replay integrations use the same tracker.
- Source/integration contracts reject any cancellation path containing
  `shots[shots.length - 1]`, `.pop()`, or another positional fallback.

### Checkpoint 2: complete fire snapshots

- Live and replay produce the same exact seven-key snapshot.
- The current fire frame supplies the snapshot.
- Adaptive, ordinary close, NB-velocity, and NB2 fixtures preserve their real
  `fireEvidence` value and nullable evidence fields. The NB-velocity route
  continues to report `fireEvidence="close"`; the design does not invent an
  `nb` fire-evidence label.
- Missing keys, unknown evidence labels, `undefined`, `NaN`, and infinity are
  exporter-invalid rather than silently coerced.
- Diagnostic-off capture persists no new receipt or snapshot payload.
- Diagnostic-enabled records persist the fixed live/replay `captureMode`, while
  only live records can join a field matrix.
- Diagnostic saves persist the exact desynchronization boolean; any true or
  malformed value and any nonzero invariant counter refuse matrix eligibility.
- Schema-5 and legacy storage round trips preserve existing data and optional
  new nested fields.

### Checkpoint 3: bounded exporter and gated UI

- A valid ordered 3 x 6 matrix exports the exact allowlisted schema.
- Runtime IDs are stable for source correlation and absent from output.
- Poison objects containing sentinel secrets in every excluded field cannot
  leak through the projection.
- The current coordinator selects exact record IDs independently of array
  order; unrelated trash-restored/imported records cannot substitute, deleting
  a selected record invalidates the batch, and restore does not revalidate it.
- A selected ID resolving to zero or two database records refuses export in
  both duplicate-record array orders.
- Replay records, missing capture mode, incomplete/invalidated batches, old app
  versions, a non-six retained count, feature/receipt count mismatch, overflow,
  invalid disposition combinations, unresolved retained receipts, malformed
  or duplicate IDs, unknown enums, huge finite evidence, and missing or
  out-of-range fire values all refuse export.
- Receipt-array reordering still projects contiguous IDs in numeric order;
  missing or gapped sequence members refuse export.
- Pretty serialization includes the final newline; exactly 65,536 UTF-8 bytes
  is accepted and 65,537 is refused.
- Extra object keys never appear in output.
- OFF-to-ON and ON-to-OFF update section visibility and disabled state
  immediately; action-time gating rejects `false`, a truthy non-boolean, and a
  setting changed to OFF after render.
- Confirmation, user cancellation, sharing, active-workflow protection, and
  mobile-width behavior are covered. An injected web/native `AbortError`
  invokes no fallback or download; a no-share environment uses one direct
  download.
- Native temporary-file cleanup runs after success, cancellation, and error;
  cleanup failure warns without fallback, stale-file cleanup is scoped to the
  exact diagnostics path, stale cleanup or write failure prevents share and
  fallback, and browser object URLs are revoked.
- Batch start/restart is blocked during another active workflow, and a capture
  cannot advance a stale, replaced, or diagnostics-disabled coordinator.
- Start/restart save failure restores the prior coordinator; selected-record
  deletion failure restores the record, trash, invalidation state, and
  `updatedAt` with no success UI. Ambiguous duplicate selected IDs cannot enter
  the deletion transaction.
- Injected storage failure rolls back the record, marker, coordinator, and
  `updatedAt`, produces no success state, leaves no live frame/recording input,
  keeps the active-workflow lock and frozen modal, and permits one explicit
  retry or close; retry reuses the byte-equivalent frozen candidate without a
  second tracker transition, and successful retry commits and closes once.
  Canceling the discard confirmation retains the candidate; confirming it
  closes without a second save path.
- The full-backup handler, `lastBackupAt`, import path, and safety snapshots are
  unchanged.

### Required validation ladder

Run the narrowest checks during each red-green loop, then before accepting each
checkpoint run the applicable cumulative set:

```text
npm run check:form
npm run check:storage        # when additive persistence is introduced
npm run check:app
npm run check:ui             # when the export UI is introduced
npm run check:all
npm run lint
npm run format:check
npm run test:e2e
python -B tools/golden-replay/test_golden_expectations.py
npm run golden:form-fixtures
git diff --check
```

Independent review must verify the diff and rerun the failure sequence. An
executor's green test result is not the only completion evidence.

## Delivery order

1. Commit this approved design and obtain user review of the written spec.
2. Write and commit a detailed TDD implementation plan.
3. Implement stable identity/outcome mapping only.
4. Implement complete live/replay fire snapshots only.
5. Implement the bounded diagnostics-only exporter and gated settings UI only.
6. Design end-of-stream resolution separately after exact identity is proven.
7. Run the physical iPhone 3-condition/18-shot matrix.
8. Diagnose any failed acceptance case without blind threshold changes.
9. Run full release-candidate verification and prepare a sanitized branch from
   `main` because the current branch history must not be pushed.
10. Handle version markers, release notes, and any public GitHub action only in
    the separately authorized release slice.

## Acceptance of this handoff

The handoff itself is complete only when:

- no view cancellation can target a different receipt's shot;
- every live/replay fire in a diagnostic-enabled, zero-overflow export-eligible
  run has a complete exact-frame seven-key snapshot;
- every retained, manually removed, auto-canceled, summary-failed, and
  unresolved receipt in such a complete run has an auditable outcome; a run
  with receipt overflow makes no per-receipt completeness claim and cannot
  enter a field matrix;
- the bounded export passes structural, size, and poison-object privacy tests;
- old data and diagnostic-off behavior remain compatible;
- repository validation is green; and
- the resulting artifact is sufficient to evaluate, but does not itself claim,
  the physical 18-shot field acceptance matrix.
