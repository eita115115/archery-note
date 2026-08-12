"use strict";

const assert = require("node:assert/strict");
const { summarizeFormBackupDiagnostics } = require("./form-backup-diagnostics");

function record(shots, formPhaseDiag = undefined) {
  return formPhaseDiag === undefined ? { shots } : { shots, formPhaseDiag };
}

const fixture = {
  schema: 5,
  formAnalyses: [
    record(0, {
      releaseFires: [],
      rejectedFramesNear: [{ phase: "DRAWING" }, { phase: "SETUP" }],
      phaseHistogram: { DRAWING: 4, SETUP: 2 },
    }),
    record(2, {
      releaseFires: [{}, {}],
      rejectedFramesNear: [],
      phaseHistogram: { RELEASE: 3, FOLLOW: 1 },
    }),
    record(0, {
      releaseFires: [{}, {}],
      rejectedFramesNear: [{ phase: "FULL_DRAW" }],
      phaseHistogram: { FULL_DRAW: 5 },
    }),
    record(1),
  ],
};

const summary = summarizeFormBackupDiagnostics(fixture);
assert.equal(summary.ok, true, "schema-5 fixture is accepted");
assert.deepEqual(summary.summary.shotHistogram, { 0: 2, 1: 1, 2: 1 });
assert.equal(summary.summary.formRecords, 4);
assert.equal(summary.summary.nonZeroShotRecords, 2);
assert.equal(summary.summary.zeroShotRecords, 2);
assert.equal(summary.summary.diagnosticRecords, 3);
assert.equal(summary.summary.recordsWithReleaseCandidates, 2);
assert.equal(summary.summary.zeroShotWithReleaseCandidates, 1);
assert.equal(summary.summary.zeroShotWithRejectedFrames, 2);
assert.deepEqual(summary.summary.zeroShotPhaseBuckets, { DRAWING: 4, SETUP: 2, FULL_DRAW: 5 });
assert.equal(summary.summary.canceledEventCount, 0);

const malformedRoot = summarizeFormBackupDiagnostics({ schema: 4, formAnalyses: [] });
assert.equal(malformedRoot.ok, false);
assert.equal(malformedRoot.code, "schema");

const malformedRecords = summarizeFormBackupDiagnostics({ schema: 5, formAnalyses: [{}] });
assert.equal(malformedRecords.ok, false);
assert.equal(malformedRecords.code, "record");

const unknownPhase = summarizeFormBackupDiagnostics({
  schema: 5,
  formAnalyses: [
    record(0, {
      releaseFires: [],
      rejectedFramesNear: [],
      phaseHistogram: { PRIVATE_PHASE: 3 },
    }),
  ],
});
assert.equal(unknownPhase.ok, false);
assert.equal(unknownPhase.code, "phase");

console.log("Form backup diagnostic checks OK");
