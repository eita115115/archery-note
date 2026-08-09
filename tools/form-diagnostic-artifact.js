"use strict";

const crypto = require("node:crypto");

const MAX_BYTES = 65536;
const CONDITIONS = Object.freeze(["side", "oblique", "normal_range"]);
const TOP_LEVEL_KEYS = Object.freeze(["format", "schemaVersion", "appVersion", "matrix", "runs"]);
const RUN_KEYS = Object.freeze(["runOrdinal", "condition", "retainedShotCount", "receipts"]);
const RECEIPT_KEYS = Object.freeze([
  "receiptOrdinal",
  "outcome",
  "detectorOutcome",
  "cancelReason",
  "unresolvedReason",
  "fire",
]);
const FIRE_KEYS = Object.freeze([
  "anchorFloor",
  "anchorEnter",
  "releaseSpeed",
  "evidenceAgeMs",
  "evidenceStrength",
  "departDelta",
  "fireEvidence",
]);
const OUTCOMES = new Set([
  "retained",
  "manual-removed",
  "auto-canceled",
  "summary-failed",
  "unresolved",
]);
const DETECTOR_OUTCOMES = new Set(["confirmed", "auto-canceled", "unresolved"]);
const FIRE_EVIDENCE = new Set(["adaptive", "close", "nb2"]);
const CANCEL_REASONS = new Set(["anchor-return", "nb2-drift", "nb2-unobserved", "no-depart"]);
const UNRESOLVED_REASONS = new Set([
  "geometry-reset",
  "workflow-save",
  "workflow-close",
  "replay-eos",
  "superseded-fire",
]);

function failure(code, message, byteLength = null) {
  return { ok: false, code, message, summary: null, sha256: null, byteLength };
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every((key) => actual.includes(key));
}

function finiteInRange(value, minimum, maximum, nullable = false) {
  return (
    (nullable && value === null) ||
    (typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum)
  );
}

function nullableEnum(value, allowed) {
  return value === null || allowed.has(value);
}

function inspectFormDiagnosticArtifact(text) {
  if (typeof text !== "string")
    return failure("input", "診断JSONはUTF-8テキストで指定してください");
  const byteLength = Buffer.byteLength(text, "utf8");
  if (byteLength > MAX_BYTES)
    return failure(
      "size",
      `診断JSONが${MAX_BYTES} bytesを超えています。通常のschema-5バックアップは対象外です`,
      byteLength,
    );

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    return failure("json", `JSONを解析できません: ${error.message}`, byteLength);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return failure("root", "JSONのルートはオブジェクトである必要があります", byteLength);
  }
  if (payload.format !== "archery-note-form-diagnostics") {
    return failure("format", "通常バックアップではなく診断JSONを指定してください", byteLength);
  }
  if (!exactKeys(payload, TOP_LEVEL_KEYS)) {
    return failure(
      "top-level-keys",
      "診断JSONのトップレベルキーが許可リストと一致しません",
      byteLength,
    );
  }
  if (payload.schemaVersion !== 1) {
    return failure("schema", "schemaVersion は 1 である必要があります", byteLength);
  }
  if (!Number.isSafeInteger(payload.appVersion) || payload.appVersion <= 0) {
    return failure("app-version", "appVersion が不正です", byteLength);
  }
  if (payload.matrix !== "field-3x6") {
    return failure("matrix", "matrix は field-3x6 である必要があります", byteLength);
  }
  if (!Array.isArray(payload.runs) || payload.runs.length !== CONDITIONS.length) {
    return failure("runs", "診断JSONには3つの条件runが必要です", byteLength);
  }

  const runs = [];
  for (let index = 0; index < CONDITIONS.length; index += 1) {
    const run = payload.runs[index];
    if (!exactKeys(run, RUN_KEYS))
      return failure("run-keys", `run ${index + 1} のキーが不正です`, byteLength);
    if (run.runOrdinal !== index + 1 || run.condition !== CONDITIONS[index]) {
      return failure("run-order", `run ${index + 1} の順序またはconditionが不正です`, byteLength);
    }
    if (run.retainedShotCount !== 6 || !Array.isArray(run.receipts) || run.receipts.length !== 6) {
      return failure("run-count", `${run.condition} は6射を保持している必要があります`, byteLength);
    }

    let retained = 0;
    for (let receiptIndex = 0; receiptIndex < run.receipts.length; receiptIndex += 1) {
      const receipt = run.receipts[receiptIndex];
      if (!exactKeys(receipt, RECEIPT_KEYS)) {
        return failure(
          "receipt-keys",
          `${run.condition} 第${receiptIndex + 1}射のキーが不正です`,
          byteLength,
        );
      }
      if (receipt.receiptOrdinal !== receiptIndex + 1 || !OUTCOMES.has(receipt.outcome)) {
        return failure(
          "receipt",
          `${run.condition} 第${receiptIndex + 1}射の結果が不正です`,
          byteLength,
        );
      }
      if (
        !DETECTOR_OUTCOMES.has(receipt.detectorOutcome) ||
        !nullableEnum(receipt.cancelReason, CANCEL_REASONS) ||
        !nullableEnum(receipt.unresolvedReason, UNRESOLVED_REASONS)
      ) {
        return failure(
          "receipt",
          `${run.condition} 第${receiptIndex + 1}射の状態が不正です`,
          byteLength,
        );
      }
      const fire = receipt.fire;
      if (!exactKeys(fire, FIRE_KEYS)) {
        return failure(
          "fire-keys",
          `${run.condition} 第${receiptIndex + 1}射のfireキーが不正です`,
          byteLength,
        );
      }
      if (
        !finiteInRange(fire.anchorFloor, 0, 1.3, true) ||
        !finiteInRange(fire.anchorEnter, 0.35, 0.65) ||
        !finiteInRange(fire.releaseSpeed, 6, 8) ||
        !finiteInRange(fire.evidenceAgeMs, 0, 1500, true) ||
        !(
          fire.evidenceStrength === null ||
          (Number.isSafeInteger(fire.evidenceStrength) &&
            fire.evidenceStrength >= 3 &&
            fire.evidenceStrength <= 12)
        ) ||
        !finiteInRange(fire.departDelta, -1.3, 1.3, true) ||
        !FIRE_EVIDENCE.has(fire.fireEvidence)
      ) {
        return failure(
          "fire",
          `${run.condition} 第${receiptIndex + 1}射のfire値が不正です`,
          byteLength,
        );
      }
      if (receipt.outcome === "retained") retained += 1;
    }
    if (retained !== 6)
      return failure("run-count", `${run.condition} のretained件数が6ではありません`, byteLength);
    runs.push({
      runOrdinal: run.runOrdinal,
      condition: run.condition,
      retainedShotCount: retained,
    });
  }

  const sha256 = crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
  return {
    ok: true,
    code: null,
    message: null,
    sha256,
    byteLength,
    summary: {
      format: payload.format,
      schemaVersion: payload.schemaVersion,
      appVersion: payload.appVersion,
      matrix: payload.matrix,
      runs,
    },
  };
}

module.exports = { inspectFormDiagnosticArtifact, MAX_BYTES };
