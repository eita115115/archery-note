"use strict";

const fs = require("node:fs");
const { summarizeFormBackupDiagnostics } = require("./form-backup-diagnostics");

function inspectFile(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(`バックアップを読み込めません: ${filePath}`);
    console.error(error.message);
    return 2;
  }

  let database;
  try {
    database = JSON.parse(text);
  } catch (error) {
    console.error(`バックアップJSONを解析できません: ${error.message}`);
    return 2;
  }

  const result = summarizeFormBackupDiagnostics(database);
  if (!result.ok) {
    console.error(`バックアップを集計できません [${result.code}]: ${result.message}`);
    return 2;
  }
  const summary = result.summary;
  console.log("Form backup diagnostic summary OK");
  console.log(`schema: ${summary.schema}`);
  console.log(`formRecords: ${summary.formRecords}`);
  console.log(`nonZeroShotRecords: ${summary.nonZeroShotRecords}`);
  console.log(`zeroShotRecords: ${summary.zeroShotRecords}`);
  console.log(`diagnosticRecords: ${summary.diagnosticRecords}`);
  console.log(`shotHistogram: ${JSON.stringify(summary.shotHistogram)}`);
  console.log(`recordsWithReleaseCandidates: ${summary.recordsWithReleaseCandidates}`);
  console.log(`zeroShotWithReleaseCandidates: ${summary.zeroShotWithReleaseCandidates}`);
  console.log(`recordsWithRejectedFrames: ${summary.recordsWithRejectedFrames}`);
  console.log(`zeroShotWithRejectedFrames: ${summary.zeroShotWithRejectedFrames}`);
  console.log(`releaseCandidateCount: ${summary.releaseCandidateCount}`);
  console.log(`rejectedFrameCount: ${summary.rejectedFrameCount}`);
  console.log(`canceledEventCount: ${summary.canceledEventCount}`);
  console.log(`zeroShotPhaseBuckets: ${JSON.stringify(summary.zeroShotPhaseBuckets)}`);
  return 0;
}

function runCli(argv = process.argv.slice(2)) {
  const filePath = argv[0];
  if (!filePath || argv.length !== 1) {
    console.error("使い方: node tools/inspect-form-backup-diagnostics.js <schema-5-backup-path>");
    return 2;
  }
  return inspectFile(filePath);
}

if (require.main === module) process.exitCode = runCli();

module.exports = { inspectFile, runCli };
