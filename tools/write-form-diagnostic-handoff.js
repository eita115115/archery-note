"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { findDiagnosticFilesFromDownloads } = require("./inspect-form-diagnostic-json");
const {
  createFormDiagnosticHandoff,
  inspectFormDiagnosticArtifact,
} = require("./form-diagnostic-artifact");

function optionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

function parseArgs(argv) {
  const options = {
    artifactPath: null,
    fromDownloads: false,
    previewCurrent: false,
    previewCommit: null,
    previewTree: null,
    outputPath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--from-downloads") {
      options.fromDownloads = true;
    } else if (argument === "--preview-current") {
      options.previewCurrent = true;
    } else if (argument === "--preview-commit") {
      options.previewCommit = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--preview-tree") {
      options.previewTree = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--output") {
      options.outputPath = optionValue(argv, index, argument);
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`unknown option: ${argument}`);
    } else if (options.artifactPath) {
      throw new Error("診断JSONのパスは1つだけ指定してください");
    } else {
      options.artifactPath = argument;
    }
  }
  if (options.fromDownloads && options.artifactPath) {
    throw new Error("診断JSONの明示パスと --from-downloads は同時に指定できません");
  }
  if (!options.fromDownloads && !options.artifactPath) {
    throw new Error("診断JSONのパス、または --from-downloads を指定してください");
  }
  if (options.previewCurrent && (options.previewCommit || options.previewTree)) {
    throw new Error("--preview-current と明示的なpreview SHAは同時に指定できません");
  }
  if (
    !options.outputPath ||
    (!options.previewCurrent && (!options.previewCommit || !options.previewTree))
  ) {
    throw new Error(
      "--preview-current または --preview-commit/--preview-tree と --output は必須です",
    );
  }
  return options;
}

function resolvePreview(options) {
  if (!options.previewCurrent) {
    return { commit: options.previewCommit, tree: options.previewTree };
  }
  const repositoryRoot = path.resolve(options.repositoryRoot || path.join(__dirname, ".."));
  try {
    const status = execFileSync(
      "git",
      ["-C", repositoryRoot, "status", "--porcelain=v1", "--untracked-files=all"],
      { encoding: "utf8" },
    ).trim();
    if (status) {
      throw new Error("preview worktree is not clean; commit or remove local changes first");
    }
    const commit = execFileSync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    const tree = execFileSync("git", ["-C", repositoryRoot, "rev-parse", "HEAD^{tree}"], {
      encoding: "utf8",
    }).trim();
    return { commit, tree };
  } catch (error) {
    throw new Error(`現在のpreview provenanceを取得できません: ${error.message}`, {
      cause: error,
    });
  }
}

function resolveArtifactPath(options) {
  if (!options.fromDownloads) return options.artifactPath;
  const candidates = findDiagnosticFilesFromDownloads();
  if (candidates.length === 0) {
    throw new Error("Downloads に診断JSONが1件もありません");
  }
  if (candidates.length > 1) {
    throw new Error(
      [
        "Downloads に診断JSONの候補が複数あります。候補名:",
        ...candidates.map((candidate) => `- ${path.basename(candidate)}`),
        "候補から1つを選び、明示パスを指定して再実行してください。",
      ].join("\n"),
    );
  }
  return candidates[0];
}

function readArtifact(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`診断JSONを読み込めません: ${error.message}`, { cause: error });
  }
  const inspection = inspectFormDiagnosticArtifact(text);
  if (!inspection.ok) {
    throw new Error(`診断JSONを検証できません [${inspection.code}]: ${inspection.message}`);
  }
  return inspection;
}

function writeHandoff(options) {
  const inspection = readArtifact(resolveArtifactPath(options));
  const preview = resolvePreview(options);
  const handoff = createFormDiagnosticHandoff(
    inspection,
    preview.commit,
    preview.tree,
  );
  const outputPath = path.resolve(options.outputPath);
  const text = `${JSON.stringify(handoff, null, 2)}\n`;
  try {
    fs.writeFileSync(outputPath, text, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    throw new Error(`handoffレポートを書き込めません: ${error.message}`, { cause: error });
  }
  return { outputPath, handoff };
}

function runCli(argv = process.argv.slice(2)) {
  try {
    const result = writeHandoff(parseArgs(argv));
    console.log(`Form diagnostic handoff written: ${result.outputPath}`);
    console.log(`preview commit: ${result.handoff.preview.commit}`);
    console.log(`preview tree: ${result.handoff.preview.tree}`);
    console.log(`artifact sha256: ${result.handoff.artifact.sha256}`);
    return 0;
  } catch (error) {
    console.error(`診断handoffを作成できません: ${error.message}`);
    return 2;
  }
}

if (require.main === module) process.exitCode = runCli();

module.exports = { parseArgs, resolvePreview, runCli, writeHandoff };
