"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const storageScript = fs.readFileSync(path.join(root, "scripts", "10-storage-native.js"), "utf8");
const scoringScript = fs.readFileSync(path.join(root, "scripts", "20-scoring.js"), "utf8");
const analysisScript = fs.readFileSync(
  path.join(root, "scripts", "40-analysis-physics.js"),
  "utf8",
);
const fixturesDir = path.join(root, "tests", "fixtures", "storage");
const fixtureFiles = {
  blank: "archery-note-v1-blank.json",
  representative: "archery-note-v1-representative.json",
  activeSession: "archery-note-v1-active-session.json",
  trash: "archery-note-v1-trash.json",
  partialLegacy: "archery-note-v1-partial-legacy.json",
  danglingSetup: "archery-note-v1-dangling-setup.json",
  sightMarksCompatibility: "archery-note-v1-sight-marks-compatibility.json",
  missingSessions: "archery-note-v1-missing-sessions.json",
  formAnalyses: "archery-note-v1-form-analyses.json",
};
const expectedCsvHeader = [
  "date",
  "setup",
  "distance_m",
  "round",
  "face",
  "arrows",
  "total",
  "avg",
  "x_or_5plus",
  "ten_or_6",
  "group_x_cm",
  "group_y_cm",
  "group_rms_cm",
  "sigma_x_cm",
  "sigma_y_cm",
  "confidence",
  "decision_quality",
  "personal_model",
  "excluded",
  "sight_v",
  "sight_h",
  "condition",
  "note",
];

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function section(source, start, end) {
  const a = source.indexOf(start);
  assert(a >= 0, `Missing start marker: ${start}`);
  if (!end) return source.slice(a);
  const b = source.indexOf(end);
  assert(b > a, `Missing end marker: ${end}`);
  return source.slice(a, b);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeLocalStorageShim() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function loadFixture(name, file) {
  const fixturePath = path.join(fixturesDir, file);
  try {
    return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  } catch (error) {
    throw new Error(`[${name}] JSON parse failed: ${error.message}`, { cause: error });
  }
}

function loadFixtures() {
  return Object.fromEntries(
    Object.entries(fixtureFiles).map(([name, file]) => [name, loadFixture(name, file)]),
  );
}

function loadStorageApi() {
  return new Function(
    "localStorage",
    `${storageScript}\nreturn {KEY, SNAP_KEY, normalizeDb, blankDb, dataCounts};`,
  )(makeLocalStorageShim());
}

function loadDbFromRaw(raw) {
  const shim = makeLocalStorageShim();
  shim.setItem("archeryNote.v1", raw);
  return new Function("localStorage", `${storageScript}\nreturn db;`)(shim);
}

function createImportSnapshot(db) {
  const localStorage = makeLocalStorageShim();
  return new Function(
    "initialDb",
    "localStorage",
    `${storageScript}
db = initialDb;
writeSafetySnapshot("import-before", true);
return {
  snapshotKey: SNAP_KEY,
  rawSnapshots: localStorage.getItem(SNAP_KEY),
  snapshots: readSnapshots()
};`,
  )(clone(db), localStorage);
}

function createSessionsCsv(db) {
  return new Function(
    "fixtureDb",
    "localStorage",
    `${storageScript}
${scoringScript}
db = fixtureDb;
const pct = value => \`\${Math.round((value || 0) * 100)}%\`;
const num = value => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const gearPrecisionProfile = () => ({score: 1, missing: [], level: "fixture"});
${section(analysisScript, "function windText", "function personalModelHtml")}
${section(analysisScript, "function sessionsCsv", "function exportSessionsCsv")}
return sessionsCsv();`,
  )(clone(db), makeLocalStorageShim());
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  const text = line.charCodeAt(0) === 0xfeff ? line.slice(1) : line;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function parseCsv(csv) {
  return csv
    .trim()
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line));
}

function assertEqual(actual, expected, label) {
  assert(
    Object.is(actual, expected),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} should be an array`);
}

function assertObject(value, label) {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    `${label} should be an object`,
  );
}

function assertHasOwn(object, key, label) {
  assert(Object.hasOwn(object, key), `${label} should keep ${key}`);
}

function checkBaseShape(name, db) {
  assertEqual(db.schema, 5, `[${name}] schema`);
  assertArray(db.setups, `[${name}] setups`);
  assertArray(db.sightMarks, `[${name}] sightMarks`);
  assertArray(db.sessions, `[${name}] sessions`);
  assertArray(db.trash, `[${name}] trash`);
  assertObject(db.settings, `[${name}] settings`);
  assertHasOwn(db, "active", `[${name}] database`);
}

function checkJsonRoundTrip(name, fixture, storageApi) {
  const backup = JSON.stringify(fixture, null, 1);
  assert(backup.length > 0, `[${name}] backup JSON should not be empty`);
  const restored = JSON.parse(backup);
  const normalized = storageApi.normalizeDb(restored);
  checkBaseShape(name, normalized);
  return normalized;
}

function checkRepresentativeRoundTrip(db) {
  assert(
    db.sessions.some((session) => session.id === "fixture-session-70m-1"),
    "[representative] session should survive JSON round trip",
  );
  assert(
    db.setups.some((setup) => setup.id === "fixture-setup-recurve-1"),
    "[representative] setup should survive JSON round trip",
  );
  assert(
    db.sightMarks.some((mark) => mark.id === "fixture-mark-70m"),
    "[representative] sight mark should survive JSON round trip",
  );
  const session = db.sessions.find((item) => item.id === "fixture-session-70m-1");
  assertEqual(session.sightV, "5.4", "[representative] sightV");
  assertEqual(session.sightH, "0.2", "[representative] sightH");
  assertEqual(session.wx, "calm, overcast", "[representative] weather");
  assertEqual(session.note, "Representative 70m practice session", "[representative] note");
}

function checkActiveRoundTrip(db) {
  assertObject(db.active, "[active-session] active");
  assertArray(db.active.ends, "[active-session] active.ends");
  assertArray(db.active.cur, "[active-session] active.cur");
  assertEqual(db.active.cur.length, 2, "[active-session] active.cur length");
  assertEqual(db.active.purpose, "practice", "[active-session] active purpose");
  assertEqual(
    db.sessions.length,
    0,
    "[active-session] active should not become a completed session",
  );
}

function checkTrashRoundTrip(db) {
  const types = db.trash.map((entry) => entry.type);
  ["session", "sightMark", "setupBundle"].forEach((type) => {
    assert(types.includes(type), `[trash] ${type} entry should survive JSON round trip`);
  });
}

function checkPartialLegacyRoundTrip(db) {
  assertObject(db.legacyTopLevelField, "[partial-legacy] legacyTopLevelField");
  assertEqual(
    db.settings.legacySetting,
    "preserve settings metadata",
    "[partial-legacy] legacy setting",
  );
  assertEqual(
    db.sessions[0].legacySessionField.source,
    "older export",
    "[partial-legacy] current compatibility behavior keeps legacy session field",
  );
  assertEqual(
    db.setups[0].legacySetupField,
    "preserve setup metadata",
    "[partial-legacy] current compatibility behavior keeps legacy setup field",
  );
}

function checkDanglingSetupRoundTrip(db) {
  const valid = db.sessions.find((session) => session.id === "fixture-session-valid-setup");
  assertObject(valid, "[dangling-setup] valid setup session");
  assertEqual(valid.setupId, "fixture-valid-setup", "[dangling-setup] valid setupId");
  assert(
    db.setups.some((setup) => setup.id === valid.setupId),
    "[dangling-setup] valid setup should survive JSON round trip",
  );

  const dangling = db.sessions.find((session) => session.id === "fixture-session-missing-setup");
  assertObject(dangling, "[dangling-setup] dangling setup session");
  assertEqual(dangling.setupId, "missing-setup-001", "[dangling-setup] dangling setupId");
  assert(
    !db.setups.some((setup) => setup.id === dangling.setupId),
    "[dangling-setup] dangling setup should remain missing after JSON round trip",
  );

  const noSetup = db.sessions.find((session) => session.id === "fixture-session-no-setup");
  assertObject(noSetup, "[dangling-setup] no setup session");
  assertEqual(noSetup.setupId, null, "[dangling-setup] no setup setupId");
}

function checkSightMarksCompatibilityRoundTrip(db) {
  const valid = db.sightMarks.find((mark) => mark.id === "fixture-sight-mark-valid");
  assertObject(valid, "[sight-marks-compatibility] valid sight mark");
  assertEqual(valid.setupId, "fixture-sight-setup", "[sight-marks-compatibility] valid setupId");
  assertEqual(valid.v, "5.7", "[sight-marks-compatibility] valid vertical sight");
  assertEqual(valid.h, "0.2", "[sight-marks-compatibility] valid horizontal sight");
  assertEqual(
    valid.legacyMarkField.source,
    "older sight notebook",
    "[sight-marks-compatibility] legacy mark field",
  );

  const dangling = db.sightMarks.find((mark) => mark.id === "fixture-sight-mark-dangling-setup");
  assertObject(dangling, "[sight-marks-compatibility] dangling sight mark");
  assertEqual(
    dangling.setupId,
    "missing-sight-setup-001",
    "[sight-marks-compatibility] dangling setupId",
  );
  assert(
    !db.setups.some((setup) => setup.id === dangling.setupId),
    "[sight-marks-compatibility] dangling setup should remain missing",
  );
  assertEqual(dangling.h, "", "[sight-marks-compatibility] missing horizontal sight");

  const noSetup = db.sightMarks.find((mark) => mark.id === "fixture-sight-mark-no-setup");
  assertObject(noSetup, "[sight-marks-compatibility] no setup sight mark");
  assertEqual(noSetup.setupId, null, "[sight-marks-compatibility] no setup setupId");
  assertEqual(noSetup.v, "", "[sight-marks-compatibility] missing vertical sight");

  const missingDistance = db.sightMarks.find(
    (mark) => mark.id === "fixture-sight-mark-missing-distance",
  );
  assertObject(missingDistance, "[sight-marks-compatibility] missing distance sight mark");
  assertEqual(
    missingDistance.dist,
    null,
    "[sight-marks-compatibility] missing distance should remain null",
  );

  const validSession = db.sessions.find((session) => session.id === "fixture-session-sight-valid");
  assertObject(validSession, "[sight-marks-compatibility] valid sight session");
  assertEqual(validSession.sightV, "5.7", "[sight-marks-compatibility] session sightV");
  assertEqual(validSession.sightH, "0.2", "[sight-marks-compatibility] session sightH");
  assertEqual(
    validSession.legacySessionField.source,
    "older sight export",
    "[sight-marks-compatibility] legacy session field",
  );

  const danglingSession = db.sessions.find(
    (session) => session.id === "fixture-session-sight-dangling-setup",
  );
  assertObject(danglingSession, "[sight-marks-compatibility] dangling sight session");
  assertEqual(
    danglingSession.setupId,
    "missing-sight-setup-001",
    "[sight-marks-compatibility] dangling session setupId",
  );
  assert(
    !Object.hasOwn(danglingSession, "sightH"),
    "[sight-marks-compatibility] missing session sightH should stay absent",
  );
}

function checkMissingSessionsLoad(fixture) {
  // sessions キーを欠く正当なバックアップでも load() が setups を破棄しないこと
  const db = loadDbFromRaw(JSON.stringify(fixture));
  checkBaseShape("missing-sessions load", db);
  assert(
    db.setups.some((setup) => setup.id === "fixture-missing-sessions-setup"),
    "[missing-sessions load] setups should survive load()",
  );
  assert(
    db.sightMarks.some((mark) => mark.id === "fixture-missing-sessions-mark"),
    "[missing-sessions load] sight marks should survive load()",
  );
  assertEqual(db.sessions.length, 0, "[missing-sessions load] sessions normalize to empty");
  assertEqual(db.settings.eyeSight, 850, "[missing-sessions load] settings survive load()");

  // 壊れた入力・非オブジェクトは従来どおり blankDb になること
  ["null", "[1,2]", '"text"', "42", "{broken json"].forEach((raw) => {
    const blank = loadDbFromRaw(raw);
    checkBaseShape(`invalid load (${raw})`, blank);
    assertEqual(blank.setups.length, 0, `[invalid load (${raw})] setups`);
    assertEqual(blank.sessions.length, 0, `[invalid load (${raw})] sessions`);
  });
}

function checkSnapshot(storageApi, representative) {
  const normalized = storageApi.normalizeDb(clone(representative));
  const result = createImportSnapshot(normalized);
  assertEqual(result.snapshotKey, storageApi.SNAP_KEY, "[snapshot] key");
  assert(result.rawSnapshots, "[snapshot] raw snapshots should be stored");
  assertArray(result.snapshots, "[snapshot] snapshots");
  assert(result.snapshots.length >= 1, "[snapshot] should create at least one snapshot");
  const latest = result.snapshots[0];
  assertEqual(latest.reason, "import-before", "[snapshot] reason");
  assertObject(latest.data, "[snapshot] payload data");
  assertEqual(latest.data.schema, 5, "[snapshot] payload schema");
  assertEqual(latest.counts.sessions, 2, "[snapshot] representative session count");
  assertEqual(latest.counts.setups, 1, "[snapshot] representative setup count");
  assertEqual(latest.counts.marks, 2, "[snapshot] representative sight mark count");
  assert(latest.hash, "[snapshot] hash should be recorded");
}

function checkCsvHeader(name, rows) {
  assert(rows.length >= 1, `[${name}] CSV should include a header row`);
  assertEqual(rows[0].join("|"), expectedCsvHeader.join("|"), `[${name}] CSV header`);
  ["spot", "no", "reason"].forEach((field) => {
    assert(
      !rows[0].includes(field),
      `[${name}] CSV header should not expose arrow ${field} field directly`,
    );
  });
}

function checkCsvRows(name, db, expectedRows) {
  const csv = createSessionsCsv(db);
  const rows = parseCsv(csv);
  checkCsvHeader(name, rows);
  assertEqual(rows.length, expectedRows, `[${name}] CSV row count`);
  return rows;
}

function checkRepresentativeCsv(db) {
  const rows = checkCsvRows("representative", db, 3);
  const first = rows[1];
  assertEqual(first[0], "2026-06-21", "[representative CSV] date");
  assertEqual(first[1], "Competition recurve", "[representative CSV] setup");
  assertEqual(first[2], "70", "[representative CSV] distance");
  assertEqual(first[3], "70m 72射", "[representative CSV] round");
  assertEqual(first[4], "122cm的", "[representative CSV] face");
  assertEqual(first[5], "12", "[representative CSV] arrows");
  assertEqual(first[6], "109", "[representative CSV] score total");
  assertEqual(first[19], "5.4", "[representative CSV] sight_v");
  assertEqual(first[20], "0.2", "[representative CSV] sight_h");
  assertEqual(first[21], "calm, overcast / left / 1.5m/s", "[representative CSV] condition");
  assertEqual(first[22], "Representative 70m practice session", "[representative CSV] note");

  const second = rows[2];
  assertEqual(second[0], "2026-06-22", "[representative CSV] second date");
  assertEqual(second[2], "18", "[representative CSV] second distance");
  assertEqual(second[3], "18m 60射", "[representative CSV] second round");
  assertEqual(second[4], "40cm三つ目", "[representative CSV] second face");
  assertEqual(second[6], "29", "[representative CSV] second score total");
}

function checkCsvForAllFixtures(normalized) {
  checkCsvRows("blank", normalized.blank, 1);
  checkRepresentativeCsv(normalized.representative);
  checkCsvRows("active-session", normalized.activeSession, 1);
  checkCsvRows("trash", normalized.trash, 1);
  const legacyRows = checkCsvRows("partial-legacy", normalized.partialLegacy, 2);
  assertEqual(legacyRows[1][0], "2025-12-20", "[partial-legacy CSV] date");
  assertEqual(legacyRows[1][1], "Legacy recurve setup", "[partial-legacy CSV] setup");
  assertEqual(legacyRows[1][6], "19", "[partial-legacy CSV] score total");

  const danglingRows = checkCsvRows("dangling-setup", normalized.danglingSetup, 4);
  assertEqual(danglingRows[1][1], "Known setup", "[dangling-setup CSV] valid setup name");
  assertEqual(danglingRows[2][1], "", "[dangling-setup CSV] dangling setup name");
  assertEqual(danglingRows[2][2], "50", "[dangling-setup CSV] dangling distance");
  assertEqual(danglingRows[3][1], "", "[dangling-setup CSV] no setup name");

  const sightRows = checkCsvRows(
    "sight-marks-compatibility",
    normalized.sightMarksCompatibility,
    4,
  );
  assertEqual(sightRows[1][1], "Sight compatibility setup", "[sight CSV] valid setup name");
  assertEqual(sightRows[1][19], "5.7", "[sight CSV] valid sight_v");
  assertEqual(sightRows[1][20], "0.2", "[sight CSV] valid sight_h");
  assertEqual(sightRows[2][1], "", "[sight CSV] dangling setup name");
  assertEqual(sightRows[2][2], "50", "[sight CSV] dangling distance");
  assertEqual(sightRows[2][19], "4.9", "[sight CSV] dangling sight_v");
  assertEqual(sightRows[2][20], "", "[sight CSV] missing sight_h");
  assertEqual(sightRows[3][1], "", "[sight CSV] no setup name");
  assertEqual(sightRows[3][2], "", "[sight CSV] missing distance");
  assertEqual(sightRows[3][20], "0.0", "[sight CSV] no setup sight_h");
}

function main() {
  const fixtures = loadFixtures();
  const storageApi = loadStorageApi();
  const normalized = Object.fromEntries(
    Object.entries(fixtures).map(([name, fixture]) => [
      name,
      checkJsonRoundTrip(name, fixture, storageApi),
    ]),
  );

  checkRepresentativeRoundTrip(normalized.representative);
  checkActiveRoundTrip(normalized.activeSession);
  checkTrashRoundTrip(normalized.trash);
  checkPartialLegacyRoundTrip(normalized.partialLegacy);
  checkDanglingSetupRoundTrip(normalized.danglingSetup);
  checkSightMarksCompatibilityRoundTrip(normalized.sightMarksCompatibility);
  checkMissingSessionsLoad(fixtures.missingSessions);
  checkSnapshot(storageApi, fixtures.representative);
  checkCsvForAllFixtures(normalized);
  checkCsvRows("missing-sessions", normalized.missingSessions, 1);

  // schema 4 前方互換: JSON 往復で formAnalyses が保持され、CSV には影響しない
  const fa = normalized.formAnalyses;
  assertArray(fa.formAnalyses, "[form-analyses] formAnalyses after round trip");
  assertEqual(fa.formAnalyses.length, 1, "[form-analyses] record survives round trip");
  assertEqual(
    fa.formAnalyses[0].features[1].release.drawHandSpeed,
    2.1,
    "[form-analyses] nested feature survives round trip",
  );
  checkCsvRows("form-analyses", fa, 2);

  console.log("Storage round-trip checks OK");
}

try {
  main();
} catch (error) {
  console.error("Storage round-trip check failed:");
  console.error(error.message);
  process.exitCode = 1;
}
