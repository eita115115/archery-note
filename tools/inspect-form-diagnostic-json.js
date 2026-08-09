"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { inspectFormDiagnosticArtifact } = require("./form-diagnostic-artifact");

const DIAGNOSTIC_FILE_PATTERN = /^archery-note-form-diagnostics.*\.json$/;

function downloadsDirectory(homeDirectory = os.homedir()) {
  return path.join(homeDirectory, "Downloads");
}

function findDiagnosticFilesFromDownloads(downloadsDir = downloadsDirectory()) {
  return fs
    .readdirSync(downloadsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && DIAGNOSTIC_FILE_PATTERN.test(entry.name))
    .map((entry) => path.join(downloadsDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function inspectFile(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(`診断JSONを読み込めません: ${filePath}`);
    console.error(error.message);
    return 2;
  }

  const result = inspectFormDiagnosticArtifact(text);
  if (!result.ok) {
    console.error(`診断JSONを検証できません [${result.code}]: ${result.message}`);
    return 2;
  }

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
  return 0;
}

function inspectFromDownloads() {
  const downloadsDir = downloadsDirectory();
  let candidates;
  try {
    candidates = findDiagnosticFilesFromDownloads(downloadsDir);
  } catch (error) {
    console.error(`Downloadsフォルダを読み込めません: ${downloadsDir}`);
    console.error(error.message);
    return 2;
  }

  if (candidates.length === 0) {
    console.error(
      `Downloads に archery-note-form-diagnostics*.json が見つかりません。保存先を確認してください: ${downloadsDir}`,
    );
    return 2;
  }
  if (candidates.length > 1) {
    console.error("Downloads に診断JSONの候補が複数あります。候補名:");
    candidates.forEach((candidate) => console.error(`- ${path.basename(candidate)}`));
    console.error("候補から1つを選び、明示パスを指定して再実行してください。");
    return 2;
  }
  return inspectFile(candidates[0]);
}

function runCli(argv = process.argv.slice(2)) {
  if (argv.includes("--from-downloads") || argv.includes("--auto")) {
    return inspectFromDownloads();
  }
  const filePath = argv[0];
  if (!filePath) {
    console.error(
      "使い方: node tools/inspect-form-diagnostic-json.js <diagnostic-json-path> または --from-downloads",
    );
    return 2;
  }
  return inspectFile(filePath);
}

if (require.main === module) {
  process.exitCode = runCli();
}

module.exports = { findDiagnosticFilesFromDownloads, runCli };
