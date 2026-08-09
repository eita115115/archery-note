#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const {
  CASE_DEFINITIONS,
  FixtureValidationError,
  classifyFixtureError,
  loadFixtureFile,
  parseFixtureText,
  replayFixture,
  validateExpectations,
  verifyReplayAgainstExpectations,
} = require("./form-metric-fixtures");

function parseArguments(argv) {
  const options = { json: false, replayStdin: false, fixturePaths: [] };
  for (const argument of argv) {
    if (argument === "--json") options.json = true;
    else if (argument === "--replay-stdin") options.replayStdin = true;
    else if (argument.startsWith("-")) {
      throw new FixtureValidationError(`unknown option: ${argument}`);
    } else {
      options.fixturePaths.push(argument);
    }
  }
  if (options.replayStdin && options.fixturePaths.length) {
    throw new FixtureValidationError("--replay-stdin does not accept fixture paths");
  }
  return options;
}

function defaultFixturePaths() {
  const fixtureDir = path.join(__dirname, "metric-fixtures");
  return Object.values(CASE_DEFINITIONS)
    .map((definition) => path.join(fixtureDir, definition.fixtureName))
    .sort((left, right) => left.localeCompare(right, "en"));
}

function formatTimes(releases) {
  return `[${releases
    .map((release) => `${release.tMs.toFixed(3)}ms/${release.label || "unknown"}`)
    .join(", ")}]`;
}

function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
    if (options.replayStdin) {
      const fixture = parseFixtureText(fs.readFileSync(0, "utf8"));
      const replay = replayFixture(fixture);
      process.stdout.write(`${JSON.stringify(replay)}\n`);
      return 0;
    }

    const expectationsPath = path.join(__dirname, "expectations.json");
    const expectations = validateExpectations(
      JSON.parse(fs.readFileSync(expectationsPath, "utf8")),
    );
    const fixturePaths = options.fixturePaths.length
      ? options.fixturePaths.map((fixturePath) => path.resolve(fixturePath))
      : defaultFixturePaths();
    const summaries = [];
    let mismatch = false;

    for (const fixturePath of fixturePaths) {
      const fixture = loadFixtureFile(fixturePath);
      const replay = replayFixture(fixture);
      const errors = verifyReplayAgainstExpectations(fixture, replay, expectations);
      mismatch ||= errors.length > 0;
      summaries.push({ fixture, replay, errors });
    }

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          summaries.map(({ fixture, replay, errors }) => ({
            caseId: fixture.caseId,
            replay,
            errors,
          })),
          null,
          2,
        )}\n`,
      );
    } else {
      for (const { fixture, replay, errors } of summaries) {
        process.stdout.write(
          `${fixture.caseId}: retained=${replay.retainedCount} releases=${formatTimes(
            replay.retainedReleases,
          )} finalPhase=${replay.finalPhase} pendingAtEnd=${replay.pendingAtEnd}\n`,
        );
        for (const error of errors) process.stderr.write(`SEMANTIC MISMATCH: ${error}\n`);
      }
    }
    return mismatch ? 1 : 0;
  } catch (error) {
    const classification = classifyFixtureError(error);
    process.stderr.write(`${classification.label}: ${error.message}\n`);
    return classification.exitCode;
  }
}

process.exitCode = main();
