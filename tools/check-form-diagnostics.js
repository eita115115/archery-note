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
    buildFormDiagnosticExport:
      typeof buildFormDiagnosticExport === "function" ? buildFormDiagnosticExport : null,
    formDiagnosticUtf8ByteLength:
      typeof formDiagnosticUtf8ByteLength === "function" ? formDiagnosticUtf8ByteLength : null,
    isFormDiagnosticJsonSizeAllowed:
      typeof isFormDiagnosticJsonSizeAllowed === "function"
        ? isFormDiagnosticJsonSizeAllowed
        : null,
  };`,
  )();
}

const api = loadFormDiagnosticApi();
const BATCH_ID = "11111111-1111-4111-8111-111111111111";
const LETTER_BATCH_ID = "a1111111-1111-4111-8111-111111111111";

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
deepEqual(
  api.FORM_DIAGNOSTIC_SLOTS,
  ["side", "oblique", "normal_range"],
  "diagnostic slot constant has the fixed sequence",
);
assert(Object.isFrozen(api.FORM_DIAGNOSTIC_SLOTS), "diagnostic slot constant is frozen");

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
  api.createFormDiagnosticMatrixCoordinator(84, LETTER_BATCH_ID.toUpperCase()),
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
  api.allocateFormDiagnosticBatchId(
    { randomUUID: () => LETTER_BATCH_ID.toUpperCase() },
    null,
    [],
    [],
  ),
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
const plannedSecond = api.planFormDiagnosticMatrixRecord(
  validRecord("second-slot"),
  planned.coordinator,
  84,
);
assertEqual(plannedSecond.ok, true, "eligible second record advances the matrix");
assertEqual(plannedSecond.record.formDiagnosticMatrix.slot, "oblique", "second fixed slot");
const plannedThird = api.planFormDiagnosticMatrixRecord(
  validRecord("third-slot"),
  plannedSecond.coordinator,
  84,
);
assertEqual(plannedThird.ok, true, "eligible third record advances the matrix");
assertEqual(plannedThird.record.formDiagnosticMatrix.slot, "normal_range", "third fixed slot");
assertEqual(plannedThird.coordinator.nextSlot, 3, "three plans complete the matrix");
assertEqual(
  Object.hasOwn(sourceRecord, "formDiagnosticMatrix"),
  false,
  "source record is unchanged",
);

const isolationSourceRecord = validRecord("copy-isolation");
isolationSourceRecord.features[0].nested = { label: "source" };
const isolationPlanned = api.planFormDiagnosticMatrixRecord(
  isolationSourceRecord,
  validCoordinator(0),
  84,
);
assertEqual(isolationPlanned.ok, true, "copy-isolation record plans");
assert(
  isolationPlanned.record.features !== isolationSourceRecord.features,
  "planned record owns the feature array",
);
assert(
  isolationPlanned.record.formPhaseDiag !== isolationSourceRecord.formPhaseDiag,
  "planned record owns form diagnostics",
);
assert(
  isolationPlanned.record.formPhaseDiag.releaseReceipts !==
    isolationSourceRecord.formPhaseDiag.releaseReceipts,
  "planned record owns release receipts",
);
assert(
  isolationPlanned.record.formPhaseDiag.releaseReceipts[0].fire !==
    isolationSourceRecord.formPhaseDiag.releaseReceipts[0].fire,
  "planned record owns receipt fire snapshots",
);
isolationPlanned.record.features[0].nested.label = "returned";
isolationPlanned.record.formPhaseDiag.releaseReceipts[0].fire.releaseSpeed = 99;
isolationPlanned.record.formPhaseDiag.receiptOverflow = 7;
assertEqual(
  isolationSourceRecord.features[0].nested.label,
  "source",
  "returned nested feature mutation leaves source unchanged",
);
assertEqual(
  isolationSourceRecord.formPhaseDiag.releaseReceipts[0].fire.releaseSpeed,
  7,
  "returned nested fire mutation leaves source unchanged",
);
assertEqual(
  isolationSourceRecord.formPhaseDiag.receiptOverflow,
  0,
  "returned diagnostic mutation leaves source unchanged",
);

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
const sourcePlanningCoordinator = validCoordinator(0);
const plannedFirst = api.planFormDiagnosticMatrixRecord(
  validRecord(),
  sourcePlanningCoordinator,
  84,
);
assertEqual(plannedFirst.ok, true, "valid first slot still plans");
const returnedIds = plannedFirst.coordinator.recordIds;
returnedIds.push("mutated");
assertEqual(
  sourcePlanningCoordinator.recordIds.length,
  0,
  "planner result keeps source recordIds isolated",
);

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
const invalidExportAppVersion = api.buildFormDiagnosticExport(
  shuffledValidRecords,
  completedCoordinator,
  0,
);
deepEqual(
  invalidExportAppVersion,
  { ok: false, code: "coordinator-invalid", payload: null, json: null, byteLength: null },
  "invalid export app version is normalized at the coordinator boundary",
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
      ["receiptOrdinal", "outcome", "detectorOutcome", "cancelReason", "unresolvedReason", "fire"],
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
  api.buildFormDiagnosticExport(shuffledValidRecords, completedCoordinator, 84, exact65537Encoder),
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

const sourceBeforeProjection = cloneFixture(shuffledValidRecords);
api.buildFormDiagnosticExport(shuffledValidRecords, completedCoordinator, 84);
deepEqual(
  shuffledValidRecords,
  sourceBeforeProjection,
  "projection leaves source diagnostics unchanged",
);

console.log("Form diagnostic checks OK");
