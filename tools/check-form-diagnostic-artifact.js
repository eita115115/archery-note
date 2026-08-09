"use strict";

const assert = require("node:assert/strict");
const { inspectFormDiagnosticArtifact } = require("./form-diagnostic-artifact");

const CONDITIONS = ["side", "oblique", "normal_range"];

function receipt(receiptOrdinal, outcome = "retained") {
  return {
    receiptOrdinal,
    outcome,
    detectorOutcome: "confirmed",
    cancelReason: null,
    unresolvedReason: null,
    fire: {
      anchorFloor: 0.42,
      anchorEnter: 0.47,
      releaseSpeed: 6.8,
      evidenceAgeMs: 33,
      evidenceStrength: 5,
      departDelta: 0.72,
      fireEvidence: "adaptive",
    },
  };
}

function validPayload() {
  return {
    format: "archery-note-form-diagnostics",
    schemaVersion: 1,
    appVersion: 84,
    matrix: "field-3x6",
    runs: CONDITIONS.map((condition, index) => ({
      runOrdinal: index + 1,
      condition,
      retainedShotCount: 6,
      receipts: Array.from({ length: 6 }, (_, receiptIndex) => receipt(receiptIndex + 1)),
    })),
  };
}

const valid = inspectFormDiagnosticArtifact(`${JSON.stringify(validPayload(), null, 2)}\n`);
assert.equal(valid.ok, true, "valid artifact is accepted");
assert.equal(valid.summary.runs[0].retainedShotCount, 6, "summary exposes retained count");
assert.equal(valid.summary.runs[2].condition, "normal_range", "summary preserves condition order");
assert.equal(valid.sha256.length, 64, "accepted artifact has SHA-256");

const removableFalsePositive = validPayload();
removableFalsePositive.runs[0].receipts.push(receipt(7, "manual-removed"));
const removableFalsePositiveResult = inspectFormDiagnosticArtifact(
  JSON.stringify(removableFalsePositive),
);
assert.equal(
  removableFalsePositiveResult.ok,
  true,
  "artifact accepts a manually removed false positive alongside six retained shots",
);
assert.equal(
  removableFalsePositiveResult.summary.runs[0].retainedShotCount,
  6,
  "manual removal does not change retained-shot count",
);

const tooManyReceipts = validPayload();
for (let ordinal = 7; ordinal <= 33; ordinal += 1) {
  tooManyReceipts.runs[0].receipts.push(receipt(ordinal, "manual-removed"));
}
const tooManyReceiptsResult = inspectFormDiagnosticArtifact(JSON.stringify(tooManyReceipts));
assert.equal(tooManyReceiptsResult.ok, false, "artifact refuses more than 32 receipts per run");
assert.equal(tooManyReceiptsResult.code, "run-count", "receipt overflow reports count failure");

const reorderedPayload = validPayload();
const reorderedText = JSON.stringify({
  runs: reorderedPayload.runs,
  matrix: reorderedPayload.matrix,
  appVersion: reorderedPayload.appVersion,
  format: reorderedPayload.format,
  schemaVersion: reorderedPayload.schemaVersion,
});
assert.equal(inspectFormDiagnosticArtifact(reorderedText).ok, true, "JSON key order is irrelevant");

const normalBackup = inspectFormDiagnosticArtifact(
  JSON.stringify({ schema: 5, sessions: [], formAnalyses: [] }),
);
assert.equal(normalBackup.ok, false, "normal backup is refused");
assert.equal(normalBackup.code, "format", "normal backup reports format refusal");

const unknownKey = validPayload();
unknownKey.privacySentinel = "must-not-pass";
const unknownKeyResult = inspectFormDiagnosticArtifact(JSON.stringify(unknownKey));
assert.equal(unknownKeyResult.ok, false, "unknown top-level keys are refused");
assert.equal(unknownKeyResult.code, "top-level-keys", "unknown key reports allowlist failure");

const missingFire = validPayload();
delete missingFire.runs[0].receipts[0].fire.releaseSpeed;
const missingFireResult = inspectFormDiagnosticArtifact(JSON.stringify(missingFire));
assert.equal(missingFireResult.ok, false, "missing fire field is refused");
assert.equal(
  missingFireResult.code,
  "fire-keys",
  "missing fire field reports fire allowlist failure",
);

const unknownReason = validPayload();
unknownReason.runs[0].receipts[0].cancelReason = "private-sentinel";
const unknownReasonResult = inspectFormDiagnosticArtifact(JSON.stringify(unknownReason));
assert.equal(unknownReasonResult.ok, false, "unknown receipt reasons are refused");
assert.equal(unknownReasonResult.code, "receipt", "unknown receipt reasons report receipt failure");

const contradictoryReason = validPayload();
contradictoryReason.runs[0].receipts[0].cancelReason = "anchor-return";
const contradictoryReasonResult = inspectFormDiagnosticArtifact(
  JSON.stringify(contradictoryReason),
);
assert.equal(contradictoryReasonResult.ok, false, "contradictory receipt reasons are refused");
assert.equal(
  contradictoryReasonResult.code,
  "receipt",
  "contradictory receipt reasons report receipt failure",
);

const wrongCount = validPayload();
wrongCount.runs[1].receipts.pop();
const wrongCountResult = inspectFormDiagnosticArtifact(JSON.stringify(wrongCount));
assert.equal(wrongCountResult.ok, false, "short run is refused");
assert.equal(wrongCountResult.code, "run-count", "short run reports count failure");

const oversized = inspectFormDiagnosticArtifact("x".repeat(65537));
assert.equal(oversized.ok, false, "oversized artifact is refused");
assert.equal(oversized.code, "size", "oversized artifact reports size failure");
assert.match(
  oversized.message,
  /通常のschema-5バックアップは対象外/,
  "size refusal explains that normal backups are not diagnostic artifacts",
);

console.log("Form diagnostic artifact checks OK");
