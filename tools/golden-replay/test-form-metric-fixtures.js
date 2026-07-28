"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  CASE_DEFINITIONS,
  FIXTURE_COLUMNS,
  MAX_FIXTURE_BYTES,
  MAX_FIXTURE_FRAMES,
  RUNTIME_PROFILE,
  FixtureReplayError,
  FixtureValidationError,
  assertReplayParity,
  classifyFixtureError,
  loadFixtureFile,
  parseFixtureText,
  replayFixture,
  validateFixture,
  verifyReplayAgainstExpectations,
} = require("./form-metric-fixtures");

const fixtureDir = path.join(__dirname, "metric-fixtures");
const cliPath = path.join(__dirname, "replay-form-fixtures.js");
const expectationsPath = path.join(__dirname, "expectations.json");

function metricRow(tMs, anchorNorm = 0.22) {
  return [tMs, anchorNorm, 150, 0.25, 0.8, 0.56 + tMs / 100000, 0.32, 0.9];
}

function nullRow(tMs) {
  return [tMs, null, null, null, null, null, null, null];
}

function sampleFixture(overrides = {}) {
  return {
    schemaVersion: 1,
    caseId: "scene-cut-arrow-retrieval",
    videoSha256: CASE_DEFINITIONS["scene-cut-arrow-retrieval"].videoSha256,
    coreSha256: "a".repeat(64),
    appBaseCommit: "b".repeat(40),
    poseModelSha256: "c".repeat(64),
    visionBundleSha256: "d".repeat(64),
    visionWasmJsSha256: "e".repeat(64),
    visionWasmSha256: "f".repeat(64),
    playwrightVersion: "1.61.1",
    chromiumVersion: "140.0.7339.16",
    runtimeProfile: { ...RUNTIME_PROFILE },
    eosMs: 100,
    columns: [...FIXTURE_COLUMNS],
    frames: [metricRow(10), nullRow(20), metricRow(30)],
    ...overrides,
  };
}

function expectFixtureError(fn, pattern) {
  assert.throws(fn, (error) => {
    assert(error instanceof FixtureValidationError, String(error));
    assert.match(error.message, pattern);
    return true;
  });
}

function expectReplayError(fn, pattern) {
  assert.throws(fn, (error) => {
    assert(error instanceof FixtureReplayError, String(error));
    assert.match(error.message, pattern);
    return true;
  });
}

function scriptedCore() {
  const stats = {
    detectorFactories: 0,
    velocityFactories: 0,
    maxHistory: 0,
  };
  return {
    stats,
    makeFormPhaseDetector() {
      stats.detectorFactories += 1;
      return { pendingRelease: null };
    },
    makeFormVelocitySource() {
      stats.velocityFactories += 1;
      return {
        step(history, raw, now) {
          assert(
            history.length === 0 || history[history.length - 1].ts < now,
            "velocity must run before the current frame is pushed",
          );
          return raw ? now / 100 : 0;
        },
      };
    },
    stepFormPhase(detector, raw, history, sensitivity, now) {
      assert.strictEqual(sensitivity, 1);
      assert.strictEqual(history[history.length - 1].ts, now);
      assert.strictEqual(history[history.length - 1].m, raw);
      assert.strictEqual(history[history.length - 1].vel, raw ? now / 100 : 0);
      assert(history.length <= 200);
      stats.maxHistory = Math.max(stats.maxHistory, history.length);
      if (now === 10) {
        detector.pendingRelease = { ts: now };
        return {
          phase: "RELEASE",
          released: true,
          debug: { fireEvidence: "close" },
        };
      }
      if (now === 20) {
        detector.pendingRelease = { ts: now };
        return {
          phase: "RELEASE",
          released: true,
          debug: { fireEvidence: "adaptive" },
        };
      }
      if (now === 30) {
        detector.pendingRelease = null;
        return {
          phase: "ANCHORING",
          released: false,
          canceled: true,
          debug: { cancelReason: "anchor-return" },
        };
      }
      return { phase: raw ? "FOLLOW" : "IDLE", released: false, debug: {} };
    },
  };
}

function runTest(name, fn) {
  fn();
  process.stdout.write(`ok - ${name}\n`);
}

runTest("validates and freezes the exact bounded fixture schema", () => {
  const fixture = parseFixtureText(`${JSON.stringify(sampleFixture())}\n`);
  assert(Object.isFrozen(fixture));
  assert(Object.isFrozen(fixture.runtimeProfile));
  assert(Object.isFrozen(fixture.frames));
  assert.deepStrictEqual(fixture.columns, FIXTURE_COLUMNS);
});

runTest("rejects unknown keys, paths, URLs, and full landmark payloads", () => {
  for (const [key, value] of [
    ["videoPath", "C:\\private\\practice.mp4"],
    ["sourceUrl", "https://example.invalid/video.mp4"],
    ["landmarks", Array.from({ length: 33 }, () => ({ x: 0, y: 0 }))],
    ["outputTrace", []],
  ]) {
    const fixture = sampleFixture();
    fixture[key] = value;
    expectFixtureError(() => validateFixture(fixture), /unknown key|privacy/i);
  }
});

runTest("rejects duplicate and unknown raw keys before JSON parsing", () => {
  const text = JSON.stringify(sampleFixture());
  const unknownPrivateKey = text.replace(
    '"frames":[',
    '"privateSourceUrl":"https://private.invalid/practice.mp4","frames":[',
  );
  expectFixtureError(
    () => parseFixtureText(unknownPrivateKey),
    /unknown raw property key "privateSourceUrl"/i,
  );

  const duplicateCaseId = text.replace(
    '"caseId":"scene-cut-arrow-retrieval"',
    '"caseId":"scene-cut-arrow-retrieval","caseId":"https://private.invalid/practice.mp4"',
  );
  expectFixtureError(
    () => parseFixtureText(duplicateCaseId),
    /duplicate raw property key "caseId"/i,
  );

  const duplicateFrames = text.replace(
    '"frames":[',
    '"frames":[{"landmarks":[{"x":0.1,"y":0.2}]}],"frames":[',
  );
  expectFixtureError(
    () => parseFixtureText(duplicateFrames),
    /duplicate raw property key "frames"/i,
  );
});

runTest("rejects malformed or mismatched hashes and runtime profiles", () => {
  expectFixtureError(
    () => validateFixture(sampleFixture({ videoSha256: "A".repeat(64) })),
    /videoSha256/,
  );
  expectFixtureError(() => validateFixture(sampleFixture({ coreSha256: "short" })), /coreSha256/);
  expectFixtureError(
    () => validateFixture(sampleFixture({ appBaseCommit: "d".repeat(64) })),
    /appBaseCommit/,
  );
  expectFixtureError(
    () =>
      validateFixture(
        sampleFixture({
          runtimeProfile: { ...RUNTIME_PROFILE, delegate: "GPU" },
        }),
      ),
    /runtimeProfile/,
  );
});

runTest("rejects nonfinite metrics, non-increasing time, and malformed null rows", () => {
  const nonfinite = sampleFixture({ frames: [metricRow(10)] });
  nonfinite.frames[0][1] = Infinity;
  expectFixtureError(() => validateFixture(nonfinite), /finite/);

  expectFixtureError(
    () => validateFixture(sampleFixture({ frames: [metricRow(10), metricRow(10)] })),
    /strictly increasing/,
  );
  expectFixtureError(
    () =>
      validateFixture(
        sampleFixture({
          frames: [[10, null, null, null, null, 0.5, null, null]],
        }),
      ),
    /null frame/,
  );
  expectFixtureError(
    () => validateFixture(sampleFixture({ eosMs: 20, frames: [metricRow(30)] })),
    /eosMs/,
  );
});

runTest("enforces bounded source bytes and frame count", () => {
  assert.strictEqual(MAX_FIXTURE_BYTES, 262_144);
  expectFixtureError(() => parseFixtureText(" ".repeat(MAX_FIXTURE_BYTES + 1)), /size/);
  expectFixtureError(
    () =>
      validateFixture(
        sampleFixture({
          eosMs: MAX_FIXTURE_FRAMES + 1,
          frames: Array.from({ length: MAX_FIXTURE_FRAMES + 1 }, (_, index) => nullRow(index + 1)),
        }),
      ),
    /frame count/,
  );
});

runTest(
  "replay is deterministic, non-mutating, fresh, ordered, and cancels the latest fire",
  () => {
    const fixture = validateFixture(
      sampleFixture({
        eosMs: 2_050,
        frames: Array.from({ length: 205 }, (_, index) => {
          const tMs = (index + 1) * 10;
          return index < 4 ? metricRow(tMs) : nullRow(tMs);
        }),
      }),
    );
    const before = JSON.stringify(fixture);
    const core = scriptedCore();
    const first = replayFixture(fixture, { core });
    const second = replayFixture(fixture, { core });

    assert.deepStrictEqual(first, second);
    assert.strictEqual(JSON.stringify(fixture), before);
    assert.strictEqual(core.stats.detectorFactories, 2);
    assert.strictEqual(core.stats.velocityFactories, 2);
    assert.strictEqual(core.stats.maxHistory, 200);
    assert.deepStrictEqual(first.events.slice(0, 3), [
      { type: "release", tMs: 10, label: "close" },
      { type: "release", tMs: 20, label: "adaptive" },
      { type: "cancel", tMs: 30, label: "anchor-return" },
    ]);
    assert.deepStrictEqual(first.retainedReleases, [{ tMs: 10, label: "close" }]);
    assert.strictEqual(first.retainedCount, 1);
    assert.strictEqual(first.finalPhase, "IDLE");
    assert.strictEqual(first.pendingAtEnd, false);
  },
);

runTest("browser and Node parity failures are replay errors", () => {
  const core = scriptedCore();
  const replay = replayFixture(
    validateFixture(
      sampleFixture({
        eosMs: 40,
        frames: [metricRow(10), metricRow(20), metricRow(30), metricRow(40)],
      }),
    ),
    { core },
  );
  assert.doesNotThrow(() => assertReplayParity(replay, JSON.parse(JSON.stringify(replay))));
  const changed = JSON.parse(JSON.stringify(replay));
  changed.pendingAtEnd = !changed.pendingAtEnd;
  expectReplayError(() => assertReplayParity(replay, changed), /parity/);
});

runTest("runtime, parity, and configuration errors have distinct CLI classifications", () => {
  const fixture = validateFixture(sampleFixture());
  const coreFailure = {
    makeFormPhaseDetector() {
      throw new Error("detector exploded");
    },
    makeFormVelocitySource() {
      return { step: () => 0 };
    },
    stepFormPhase() {
      return { phase: "IDLE" };
    },
  };
  let runtimeError;
  try {
    replayFixture(fixture, { core: coreFailure });
    assert.fail("expected production core runtime failure");
  } catch (error) {
    runtimeError = error;
  }
  assert(runtimeError instanceof FixtureReplayError, String(runtimeError));
  assert.deepStrictEqual(classifyFixtureError(runtimeError), {
    exitCode: 1,
    label: "RUNTIME ERROR",
  });

  const velocityFailure = {
    makeFormPhaseDetector: () => ({ pendingRelease: null }),
    makeFormVelocitySource: () => ({
      step() {
        throw new Error("velocity exploded");
      },
    }),
    stepFormPhase: () => ({ phase: "IDLE" }),
  };
  expectReplayError(
    () => replayFixture(fixture, { core: velocityFailure }),
    /production velocity failed/,
  );

  const resultFailure = {
    makeFormPhaseDetector: () => ({ pendingRelease: null }),
    makeFormVelocitySource: () => ({ step: () => 0 }),
    stepFormPhase: () => null,
  };
  expectReplayError(
    () => replayFixture(fixture, { core: resultFailure }),
    /production stepFormPhase result/,
  );

  const parityError = new FixtureReplayError("browser/Node mismatch", "parity");
  assert.deepStrictEqual(classifyFixtureError(parityError), {
    exitCode: 1,
    label: "PARITY ERROR",
  });
  assert.deepStrictEqual(classifyFixtureError(new FixtureValidationError("bad schema")), {
    exitCode: 2,
    label: "CONFIG ERROR",
  });
  let dependencyError;
  try {
    replayFixture(fixture, { core: {} });
    assert.fail("expected missing production dependency");
  } catch (error) {
    dependencyError = error;
  }
  assert(dependencyError instanceof FixtureValidationError, String(dependencyError));
  assert.strictEqual(classifyFixtureError(dependencyError).exitCode, 2);
});

runTest("review truth is matched by source SHA rather than fixture filename", () => {
  const expectations = JSON.parse(fs.readFileSync(expectationsPath, "utf8"));
  const fixture = validateFixture(sampleFixture());
  assert.deepStrictEqual(
    verifyReplayAgainstExpectations(
      fixture,
      {
        retainedReleases: [],
        retainedCount: 0,
        finalPhase: "IDLE",
        pendingAtEnd: false,
        events: [],
      },
      expectations,
    ),
    [],
  );
  const errors = verifyReplayAgainstExpectations(
    fixture,
    {
      retainedReleases: [{ tMs: 8158, label: "adaptive" }],
      retainedCount: 1,
      finalPhase: "FOLLOW",
      pendingAtEnd: false,
      events: [{ type: "release", tMs: 8158, label: "adaptive" }],
    },
    expectations,
  );
  assert(
    errors.some((error) => /expected 0, got 1/.test(error)),
    errors,
  );
});

runTest("both tracked public fixtures load and replay deterministically without mutation", () => {
  const names = Object.values(CASE_DEFINITIONS)
    .map(({ fixtureName }) => fixtureName)
    .sort();
  assert.deepStrictEqual(names, ["oblique-single-release.json", "scene-cut-arrow-retrieval.json"]);
  for (const name of names) {
    const fixture = loadFixtureFile(path.join(fixtureDir, name));
    const before = JSON.stringify(fixture);
    const first = replayFixture(fixture);
    const second = replayFixture(fixture);
    assert.deepStrictEqual(second, first);
    assert.strictEqual(JSON.stringify(fixture), before);
  }
});

runTest("reviewed oblique release is the only retained shot in its truth window", () => {
  const expectations = JSON.parse(fs.readFileSync(expectationsPath, "utf8"));
  const fixture = loadFixtureFile(path.join(fixtureDir, "oblique-single-release.json"));
  const replay = replayFixture(fixture);
  assert.deepStrictEqual(verifyReplayAgainstExpectations(fixture, replay, expectations), []);
  assert.deepStrictEqual(
    replay.retainedReleases.map((release) => release.label),
    ["close"],
  );
});

runTest("reviewed scene-cut retrieval retains no shot and emits no adaptive release", () => {
  const expectations = JSON.parse(fs.readFileSync(expectationsPath, "utf8"));
  const fixture = loadFixtureFile(path.join(fixtureDir, "scene-cut-arrow-retrieval.json"));
  const replay = replayFixture(fixture);
  assert.deepStrictEqual(verifyReplayAgainstExpectations(fixture, replay, expectations), []);
  assert.deepStrictEqual(
    replay.events.filter((event) => event.type === "release" && event.label === "adaptive"),
    [],
  );
});

runTest("acceptance CLI maps synthetic truth and schema/config to exits 0 and 2", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "archery-note-metric-fixture-"));
  try {
    const zeroPath = path.join(tempDir, "zero.json");
    fs.writeFileSync(
      zeroPath,
      `${JSON.stringify(sampleFixture({ frames: [nullRow(10)] }), null, 2)}\n`,
    );
    const pass = childProcess.spawnSync(process.execPath, [cliPath, zeroPath], {
      encoding: "utf8",
    });
    assert.strictEqual(pass.status, 0, pass.stderr || pass.stdout);

    const invalidPath = path.join(tempDir, "invalid.json");
    fs.writeFileSync(invalidPath, '{"schemaVersion":1,"videoPath":"private.mp4"}\n');
    const invalid = childProcess.spawnSync(process.execPath, [cliPath, invalidPath], {
      encoding: "utf8",
    });
    assert.strictEqual(invalid.status, 2, invalid.stderr || invalid.stdout);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

runTest("check:form includes infrastructure replay tests but excludes semantic acceptance", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"),
  );
  assert.match(packageJson.scripts["check:form"], /test-form-metric-fixtures\.js/);
  assert.doesNotMatch(packageJson.scripts["check:form"], /replay-form-fixtures\.js/);
  assert.doesNotMatch(packageJson.scripts["check:all"], /replay-form-fixtures\.js/);
});

process.stdout.write("Form metric fixture checks OK\n");
