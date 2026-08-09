"use strict";

const fs = require("node:fs");
const { inspectFormDiagnosticArtifact } = require("./form-diagnostic-artifact");

const filePath = process.argv[2];
if (!filePath) {
  console.error("使い方: node tools/inspect-form-diagnostic-json.js <diagnostic-json-path>");
  process.exitCode = 2;
} else {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(`診断JSONを読み込めません: ${filePath}`);
    console.error(error.message);
    process.exitCode = 2;
  }

  if (text !== undefined) {
    const result = inspectFormDiagnosticArtifact(text);
    if (!result.ok) {
      console.error(`診断JSONを検証できません [${result.code}]: ${result.message}`);
      process.exitCode = 2;
    } else {
      console.log("Form diagnostic artifact OK");
      console.log(`format: ${result.summary.format}`);
      console.log(`schemaVersion: ${result.summary.schemaVersion}`);
      console.log(`appVersion: ${result.summary.appVersion}`);
      console.log(`matrix: ${result.summary.matrix}`);
      console.log(`bytes: ${result.byteLength}`);
      console.log(`sha256: ${result.sha256}`);
      result.summary.runs.forEach((run) => {
        console.log(`${run.runOrdinal}. ${run.condition}: ${run.retainedShotCount}/6 retained`);
      });
    }
  }
}
