"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const FIXTURE_SCHEMA_VERSION = 1;
const MAX_FIXTURE_BYTES = 262_144;
const MAX_FIXTURE_FRAMES = 5_000;
const FIXTURE_COLUMNS = Object.freeze([
  "tMs",
  "anchorNorm",
  "drawArm",
  "bodyScale",
  "conf",
  "dWx",
  "dWy",
  "dWVisibility",
]);
const RUNTIME_PROFILE = Object.freeze({
  handedness: "right",
  delegate: "CPU",
  playbackRate: 0.25,
});
const CASE_DEFINITIONS = deepFreeze({
  "oblique-single-release": {
    fixtureName: "oblique-single-release.json",
    videoSha256: "d2beecfa6cf924354212dd23e79a7540a2ee8c7fbf1c60cade342f6116843bfc",
  },
  "scene-cut-arrow-retrieval": {
    fixtureName: "scene-cut-arrow-retrieval.json",
    videoSha256: "1d80f5688fff8a1e90ad2cada188ce51f3a491978fe6bd1ed678f776135c243e",
  },
});

const TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion",
  "caseId",
  "videoSha256",
  "coreSha256",
  "appBaseCommit",
  "poseModelSha256",
  "visionBundleSha256",
  "visionWasmJsSha256",
  "visionWasmSha256",
  "playwrightVersion",
  "chromiumVersion",
  "runtimeProfile",
  "eosMs",
  "columns",
  "frames",
]);
const PROFILE_KEYS = Object.freeze(["handedness", "delegate", "playbackRate"]);
const SHA256_RE = /^[0-9a-f]{64}$/;
const GIT_COMMIT_RE = /^[0-9a-f]{40}$/;
const RUNTIME_VERSION_RE = /^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/;

let cachedCore = null;

class FixtureValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "FixtureValidationError";
  }
}

class FixtureReplayError extends Error {
  constructor(message, kind = "runtime") {
    super(message);
    this.name = "FixtureReplayError";
    this.kind = kind;
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function fail(message) {
  throw new FixtureValidationError(message);
}

function requireCondition(condition, message) {
  if (!condition) fail(message);
}

function replayFail(message, kind = "runtime", cause = null) {
  const error = new FixtureReplayError(message, kind);
  if (cause) error.cause = cause;
  throw error;
}

function replayRequire(condition, message, kind = "runtime") {
  if (!condition) replayFail(message, kind);
}

function isPlainObject(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function requireExactKeys(value, expected, label) {
  requireCondition(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value);
  for (const key of actual) {
    requireCondition(expected.includes(key), `${label} has unknown key ${JSON.stringify(key)}`);
  }
  for (const key of expected) {
    requireCondition(Object.hasOwn(value, key), `${label} is missing key ${JSON.stringify(key)}`);
  }
}

function validateRuntimeProfile(profile, label = "runtimeProfile") {
  requireExactKeys(profile, PROFILE_KEYS, label);
  for (const key of PROFILE_KEYS) {
    requireCondition(
      Object.is(profile[key], RUNTIME_PROFILE[key]),
      `${label}.${key} must equal ${JSON.stringify(RUNTIME_PROFILE[key])}`,
    );
  }
}

function validateRawPropertyKeys(text) {
  const keys = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '"') continue;
    const start = index;
    let closed = false;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === "\\") {
        index += 2;
        continue;
      }
      if (character === '"') {
        closed = true;
        break;
      }
      index += 1;
    }
    requireCondition(closed, "fixture JSON is malformed: unterminated string");

    const rawString = text.slice(start, index + 1);
    let decoded;
    try {
      decoded = JSON.parse(rawString);
    } catch (error) {
      fail(`fixture JSON is malformed: ${error.message}`);
    }
    let following = index + 1;
    while (following < text.length && /\s/.test(text[following])) following += 1;
    if (text[following] === ":") keys.push(decoded);
  }

  const allowed = [...TOP_LEVEL_KEYS, ...PROFILE_KEYS];
  const counts = new Map();
  for (const key of keys) counts.set(key, (counts.get(key) || 0) + 1);
  for (const key of allowed) {
    requireCondition(
      (counts.get(key) || 0) <= 1,
      `duplicate raw property key ${JSON.stringify(key)} is not allowed`,
    );
  }
  for (const key of counts.keys()) {
    requireCondition(
      allowed.includes(key),
      `fixture source has unknown raw property key ${JSON.stringify(key)}`,
    );
  }
  for (const key of allowed) {
    requireCondition(
      counts.get(key) === 1,
      `fixture source is missing raw property key ${JSON.stringify(key)}`,
    );
  }
}

function validateFixture(fixture) {
  requireExactKeys(fixture, TOP_LEVEL_KEYS, "fixture");
  requireCondition(
    fixture.schemaVersion === FIXTURE_SCHEMA_VERSION,
    `schemaVersion must be ${FIXTURE_SCHEMA_VERSION}`,
  );

  const definition = CASE_DEFINITIONS[fixture.caseId];
  requireCondition(definition != null, `caseId is not an allowed semantic case: ${fixture.caseId}`);
  requireCondition(
    typeof fixture.videoSha256 === "string" && SHA256_RE.test(fixture.videoSha256),
    "videoSha256 must be a lowercase SHA-256",
  );
  requireCondition(
    fixture.videoSha256 === definition.videoSha256,
    `videoSha256 does not match allowed case ${fixture.caseId}`,
  );
  requireCondition(
    typeof fixture.coreSha256 === "string" && SHA256_RE.test(fixture.coreSha256),
    "coreSha256 must be a lowercase LF-normalized SHA-256",
  );
  requireCondition(
    typeof fixture.appBaseCommit === "string" && GIT_COMMIT_RE.test(fixture.appBaseCommit),
    "appBaseCommit must be a lowercase 40-character Git commit",
  );
  for (const key of [
    "poseModelSha256",
    "visionBundleSha256",
    "visionWasmJsSha256",
    "visionWasmSha256",
  ]) {
    requireCondition(
      typeof fixture[key] === "string" && SHA256_RE.test(fixture[key]),
      `${key} must be a lowercase SHA-256`,
    );
  }
  for (const key of ["playwrightVersion", "chromiumVersion"]) {
    requireCondition(
      typeof fixture[key] === "string" && RUNTIME_VERSION_RE.test(fixture[key]),
      `${key} must be a dotted runtime version`,
    );
  }
  validateRuntimeProfile(fixture.runtimeProfile);

  requireCondition(
    isFiniteNumber(fixture.eosMs) && fixture.eosMs > 0,
    "eosMs must be a finite positive number",
  );
  requireCondition(Array.isArray(fixture.columns), "columns must be an array");
  requireCondition(
    fixture.columns.length === FIXTURE_COLUMNS.length &&
      fixture.columns.every((column, index) => column === FIXTURE_COLUMNS[index]),
    `columns must exactly equal ${JSON.stringify(FIXTURE_COLUMNS)}`,
  );
  requireCondition(Array.isArray(fixture.frames), "frames must be an array");
  requireCondition(fixture.frames.length > 0, "frames must not be empty");
  requireCondition(
    fixture.frames.length <= MAX_FIXTURE_FRAMES,
    `fixture frame count exceeds ${MAX_FIXTURE_FRAMES}`,
  );

  let previousTime = -Infinity;
  for (let index = 0; index < fixture.frames.length; index += 1) {
    const row = fixture.frames[index];
    const label = `frames[${index}]`;
    requireCondition(
      Array.isArray(row) && row.length === FIXTURE_COLUMNS.length,
      `${label} must contain exactly ${FIXTURE_COLUMNS.length} columns`,
    );
    const tMs = row[0];
    requireCondition(
      isFiniteNumber(tMs) && tMs >= 0,
      `${label}.tMs must be a finite non-negative number`,
    );
    requireCondition(tMs > previousTime, `${label}.tMs must be strictly increasing`);
    requireCondition(tMs <= fixture.eosMs, `${label}.tMs must not exceed eosMs`);
    previousTime = tMs;

    const metrics = row.slice(1);
    const isNullFrame = metrics.every((value) => value === null);
    if (!isNullFrame) {
      requireCondition(
        metrics.every(isFiniteNumber),
        `${label} metrics must all be finite numbers; a null frame must contain only null metrics`,
      );
      requireCondition(row[1] >= 0, `${label}.anchorNorm must be non-negative`);
      requireCondition(row[2] >= 0 && row[2] <= 180, `${label}.drawArm must be in [0, 180]`);
      requireCondition(row[3] > 0, `${label}.bodyScale must be positive`);
      requireCondition(row[4] >= 0 && row[4] <= 1, `${label}.conf must be in [0, 1]`);
      requireCondition(row[7] >= 0 && row[7] <= 1, `${label}.dWVisibility must be in [0, 1]`);
    }
  }

  return deepFreeze(fixture);
}

function parseFixtureText(text) {
  requireCondition(typeof text === "string", "fixture source must be UTF-8 text");
  const bytes = Buffer.byteLength(text, "utf8");
  requireCondition(
    bytes <= MAX_FIXTURE_BYTES,
    `fixture source size exceeds ${MAX_FIXTURE_BYTES} bytes`,
  );
  validateRawPropertyKeys(text);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    fail(`fixture JSON is malformed: ${error.message}`);
  }
  return validateFixture(parsed);
}

function loadFixtureFile(filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (error) {
    fail(`fixture cannot be read: ${error.message}`);
  }
  requireCondition(stat.isFile(), `fixture is not a file: ${filePath}`);
  requireCondition(
    stat.size <= MAX_FIXTURE_BYTES,
    `fixture source size exceeds ${MAX_FIXTURE_BYTES} bytes`,
  );
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(`fixture cannot be read: ${error.message}`);
  }
  return parseFixtureText(text);
}

function lfNormalizedSha256(source) {
  const text = Buffer.isBuffer(source) ? source.toString("utf8") : String(source);
  return crypto.createHash("sha256").update(text.replace(/\r\n?/g, "\n"), "utf8").digest("hex");
}

function loadFormCore() {
  if (cachedCore) return cachedCore;
  try {
    const root = path.resolve(__dirname, "..", "..");
    const corePath = path.join(root, "scripts", "46-form-core.js");
    const source = fs.readFileSync(corePath, "utf8");
    cachedCore = new Function(
      `${source}
return {makeFormPhaseDetector, makeFormVelocitySource, stepFormPhase};`,
    )();
  } catch (error) {
    fail(`form core dependency cannot be loaded: ${error.message}`);
  }
  return cachedCore;
}

function rowToMetrics(row) {
  if (row[1] === null) return null;
  return {
    anchorNorm: row[1],
    drawArm: row[2],
    bodyScale: row[3],
    conf: row[4],
    dW: {
      x: row[5],
      y: row[6],
      visibility: row[7],
    },
  };
}

function replayFixture(fixture, options = {}) {
  validateFixture(fixture);
  const core = options.core || loadFormCore();
  for (const name of ["makeFormPhaseDetector", "makeFormVelocitySource", "stepFormPhase"]) {
    requireCondition(typeof core[name] === "function", `core.${name} must be a function`);
  }

  let detector;
  let velocitySource;
  try {
    detector = core.makeFormPhaseDetector();
    velocitySource = core.makeFormVelocitySource();
  } catch (error) {
    replayFail(`production core initialization failed: ${error.message}`, "runtime", error);
  }
  replayRequire(
    isPlainObject(detector),
    "production core detector initialization must return an object",
  );
  replayRequire(
    isPlainObject(velocitySource) && typeof velocitySource.step === "function",
    "production velocity source initialization must return a step function",
  );
  const history = [];
  const activeReleases = [];
  const events = [];
  let finalPhase = null;

  for (const row of fixture.frames) {
    const tMs = row[0];
    const metrics = rowToMetrics(row);
    let velocity;
    try {
      velocity = velocitySource.step(history, metrics, tMs);
    } catch (error) {
      replayFail(`production velocity failed at ${tMs}ms: ${error.message}`, "runtime", error);
    }
    replayRequire(isFiniteNumber(velocity), `velocity result at ${tMs}ms must be finite`);
    history.push({ ts: tMs, m: metrics, vel: velocity });
    if (history.length > 200) history.shift();

    let result;
    try {
      result = core.stepFormPhase(detector, metrics, history, 1.0, tMs);
    } catch (error) {
      replayFail(`production stepFormPhase failed at ${tMs}ms: ${error.message}`, "runtime", error);
    }
    replayRequire(
      isPlainObject(result),
      `production stepFormPhase result at ${tMs}ms must be an object`,
    );
    replayRequire(
      typeof result.phase === "string",
      `production phase result at ${tMs}ms must be a string`,
    );
    finalPhase = result.phase;

    if (result.canceled) {
      activeReleases.pop();
      events.push({
        type: "cancel",
        tMs,
        label:
          result.debug && typeof result.debug.cancelReason === "string"
            ? result.debug.cancelReason
            : null,
      });
    }
    if (result.released) {
      const release = {
        tMs,
        label:
          result.debug && typeof result.debug.fireEvidence === "string"
            ? result.debug.fireEvidence
            : null,
      };
      activeReleases.push(release);
      events.push({ type: "release", ...release });
    }
  }

  return {
    caseId: fixture.caseId,
    events,
    retainedReleases: activeReleases.map((release) => ({ ...release })),
    retainedCount: activeReleases.length,
    finalPhase,
    pendingAtEnd: Boolean(detector.pendingRelease),
  };
}

function replayParityShape(replay) {
  replayRequire(isPlainObject(replay), "replay parity value must be an object", "parity");
  return {
    events: replay.events,
    retainedReleases: replay.retainedReleases,
    retainedCount: replay.retainedCount,
    finalPhase: replay.finalPhase,
    pendingAtEnd: replay.pendingAtEnd,
  };
}

function assertReplayParity(browserReplay, nodeReplay) {
  const browserJson = JSON.stringify(replayParityShape(browserReplay));
  const nodeJson = JSON.stringify(replayParityShape(nodeReplay));
  replayRequire(
    browserJson === nodeJson,
    `browser/Node replay parity mismatch: browser=${browserJson} node=${nodeJson}`,
    "parity",
  );
}

function classifyFixtureError(error) {
  if (error instanceof FixtureReplayError) {
    return {
      exitCode: 1,
      label: error.kind === "parity" ? "PARITY ERROR" : "RUNTIME ERROR",
    };
  }
  return { exitCode: 2, label: "CONFIG ERROR" };
}

function validateExpectations(expectations) {
  requireCondition(isPlainObject(expectations), "expectations must be an object");
  requireCondition(expectations.schemaVersion === 1, "expectations.schemaVersion must be 1");
  validateRuntimeProfile(expectations.profile, "expectations.profile");
  requireCondition(
    Array.isArray(expectations.cases) && expectations.cases.length > 0,
    "expectations.cases must be a non-empty array",
  );
  const seenHashes = new Set();
  for (let index = 0; index < expectations.cases.length; index += 1) {
    const item = expectations.cases[index];
    const label = `expectations.cases[${index}]`;
    requireCondition(isPlainObject(item), `${label} must be an object`);
    requireCondition(
      typeof item.sha256 === "string" && SHA256_RE.test(item.sha256),
      `${label}.sha256 must be a lowercase SHA-256`,
    );
    requireCondition(!seenHashes.has(item.sha256), `${label}.sha256 must be unique`);
    seenHashes.add(item.sha256);
    requireCondition(
      item.expectedStatus === "ok" || item.expectedStatus === "ok-no-shots",
      `${label}.expectedStatus is invalid`,
    );
    requireCondition(
      Number.isInteger(item.expectedDetectedShots) && item.expectedDetectedShots >= 0,
      `${label}.expectedDetectedShots must be a non-negative integer`,
    );
    requireCondition(
      Array.isArray(item.retainedReleaseWindowsMs) &&
        item.retainedReleaseWindowsMs.length === item.expectedDetectedShots,
      `${label}.retainedReleaseWindowsMs must contain one window per expected shot`,
    );
    for (const window of item.retainedReleaseWindowsMs) {
      requireCondition(
        Array.isArray(window) &&
          window.length === 2 &&
          isFiniteNumber(window[0]) &&
          isFiniteNumber(window[1]) &&
          window[0] >= 0 &&
          window[0] <= window[1],
        `${label}.retainedReleaseWindowsMs contains an invalid window`,
      );
    }
  }
  return expectations;
}

function verifyReplayAgainstExpectations(fixture, replay, expectations) {
  validateFixture(fixture);
  validateExpectations(expectations);
  const expected = expectations.cases.find((item) => item.sha256 === fixture.videoSha256);
  requireCondition(
    expected != null,
    `no reviewed expectation matches source video SHA ${fixture.videoSha256}`,
  );

  const errors = [];
  if (replay.retainedCount !== expected.expectedDetectedShots) {
    errors.push(
      `${fixture.caseId}: retained releases mismatch: expected ${expected.expectedDetectedShots}, got ${replay.retainedCount}`,
    );
    return errors;
  }

  const releases = [...replay.retainedReleases].sort((a, b) => a.tMs - b.tMs);
  const windows = [...expected.retainedReleaseWindowsMs].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (let index = 0; index < windows.length; index += 1) {
    const release = releases[index];
    const [start, end] = windows[index];
    if (!release || release.tMs < start || release.tMs > end) {
      errors.push(
        `${fixture.caseId}: retained release ${index} at ${release ? release.tMs : "missing"}ms is outside reviewed window [${start}, ${end}]ms`,
      );
    }
  }
  return errors;
}

module.exports = {
  CASE_DEFINITIONS,
  FIXTURE_COLUMNS,
  FIXTURE_SCHEMA_VERSION,
  MAX_FIXTURE_BYTES,
  MAX_FIXTURE_FRAMES,
  RUNTIME_PROFILE,
  FixtureReplayError,
  FixtureValidationError,
  assertReplayParity,
  classifyFixtureError,
  lfNormalizedSha256,
  loadFixtureFile,
  loadFormCore,
  parseFixtureText,
  replayFixture,
  validateExpectations,
  validateFixture,
  verifyReplayAgainstExpectations,
};
