"use strict";

const PHASES = Object.freeze([
  "SETUP",
  "IDLE",
  "ANCHORING",
  "FULL_DRAW",
  "RELEASE",
  "FOLLOW",
  "DRAWING",
]);
const PHASE_SET = new Set(PHASES);

function failure(code, message) {
  return { ok: false, code, message, summary: null };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addCount(target, key, amount) {
  target[key] = (target[key] || 0) + amount;
}

function validatePhaseHistogram(histogram) {
  if (histogram === undefined) return null;
  if (!isRecord(histogram)) return failure("phase", "phaseHistogram が不正です");
  for (const [phase, count] of Object.entries(histogram)) {
    if (!PHASE_SET.has(phase) || !Number.isSafeInteger(count) || count < 0) {
      return failure("phase", "phaseHistogram に許可されていないphaseまたは件数があります");
    }
  }
  return null;
}

function arrayLengthOrZero(value, fieldName) {
  if (value === undefined) return 0;
  return Array.isArray(value) ? value.length : failure("record", `${fieldName} が不正です`);
}

function summarizeFormBackupDiagnostics(database) {
  if (!isRecord(database))
    return failure("root", "バックアップのルートはオブジェクトである必要があります");
  if (database.schema !== 5) return failure("schema", "schema-5 のバックアップを指定してください");
  if (!Array.isArray(database.formAnalyses)) {
    return failure("form-analyses", "formAnalyses が配列ではありません");
  }

  const shotHistogram = Object.create(null);
  const phaseBuckets = Object.create(null);
  let diagnosticRecords = 0;
  let nonZeroShotRecords = 0;
  let zeroShotRecords = 0;
  let recordsWithReleaseCandidates = 0;
  let zeroShotWithReleaseCandidates = 0;
  let recordsWithRejectedFrames = 0;
  let zeroShotWithRejectedFrames = 0;
  let releaseCandidateCount = 0;
  let rejectedFrameCount = 0;
  let canceledEventCount = 0;

  for (const record of database.formAnalyses) {
    if (!isRecord(record) || !Number.isSafeInteger(record.shots) || record.shots < 0) {
      return failure("record", "formAnalyses のshotsが不正です");
    }
    const shotKey = String(record.shots);
    addCount(shotHistogram, shotKey, 1);
    const zeroShot = record.shots === 0;
    if (zeroShot) zeroShotRecords += 1;
    else nonZeroShotRecords += 1;

    const diag = record.formPhaseDiag;
    if (diag === undefined) continue;
    if (!isRecord(diag)) return failure("record", "formPhaseDiag が不正です");
    diagnosticRecords += 1;

    const releaseFires = arrayLengthOrZero(diag.releaseFires, "releaseFires");
    if (typeof releaseFires !== "number") return releaseFires;
    const rejectedFramesNear = arrayLengthOrZero(diag.rejectedFramesNear, "rejectedFramesNear");
    if (typeof rejectedFramesNear !== "number") return rejectedFramesNear;
    const canceledEvents = arrayLengthOrZero(diag.canceledEvents, "canceledEvents");
    if (typeof canceledEvents !== "number") return canceledEvents;
    const phaseError = validatePhaseHistogram(diag.phaseHistogram);
    if (phaseError) return phaseError;

    releaseCandidateCount += releaseFires;
    rejectedFrameCount += rejectedFramesNear;
    canceledEventCount += canceledEvents;
    if (releaseFires > 0) {
      recordsWithReleaseCandidates += 1;
      if (zeroShot) zeroShotWithReleaseCandidates += 1;
    }
    if (rejectedFramesNear > 0) {
      recordsWithRejectedFrames += 1;
      if (zeroShot) zeroShotWithRejectedFrames += 1;
    }
    if (zeroShot && diag.phaseHistogram) {
      for (const [phase, count] of Object.entries(diag.phaseHistogram)) {
        addCount(phaseBuckets, phase, count);
      }
    }
  }

  return {
    ok: true,
    code: null,
    message: null,
    summary: {
      schema: database.schema,
      formRecords: database.formAnalyses.length,
      nonZeroShotRecords,
      zeroShotRecords,
      diagnosticRecords,
      shotHistogram: Object.fromEntries(
        Object.entries(shotHistogram).sort(([a], [b]) => Number(a) - Number(b)),
      ),
      recordsWithReleaseCandidates,
      zeroShotWithReleaseCandidates,
      recordsWithRejectedFrames,
      zeroShotWithRejectedFrames,
      releaseCandidateCount,
      rejectedFrameCount,
      canceledEventCount,
      zeroShotPhaseBuckets: Object.fromEntries(
        PHASES.filter((phase) => phaseBuckets[phase] !== undefined).map((phase) => [
          phase,
          phaseBuckets[phase],
        ]),
      ),
    },
  };
}

module.exports = { PHASES, summarizeFormBackupDiagnostics };
