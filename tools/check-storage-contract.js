"use strict";

const assertStrict = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const storageScript = fs.readFileSync(path.join(root, "scripts", "10-storage-native.js"), "utf8");
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

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function section(start, end) {
  const a = storageScript.indexOf(start);
  const b = storageScript.indexOf(end);
  assert(a >= 0, `Missing start marker: ${start}`);
  assert(b > a, `Missing end marker: ${end}`);
  return storageScript.slice(a, b);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
    `${section("const KEY=", "function uid")}\nreturn {normalizeDb, blankDb, dataCounts};`,
  )();
}

function loadTrashApi(db, save) {
  return new Function(
    "db",
    "save",
    "uid",
    "today",
    "TRASH_LIMIT",
    `${section("function cloneData", "function trashTypeLabel")}\nreturn {trashItem, restoreTrash};`,
  )(
    db,
    save,
    () => "fixture-generated-id",
    () => "2026-06-28",
    50,
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

function assertEqual(actual, expected, label) {
  assert(
    Object.is(actual, expected),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function assertHasOwn(object, key, label) {
  assert(Object.hasOwn(object, key), `${label} should keep ${key}`);
}

function checkBaseShape(name, db) {
  assertEqual(db.schema, 4, `[${name}] schema`);
  assertArray(db.setups, `[${name}] setups`);
  assertArray(db.sightMarks, `[${name}] sightMarks`);
  assertArray(db.sessions, `[${name}] sessions`);
  assertArray(db.trash, `[${name}] trash`);
  assertObject(db.settings, `[${name}] settings`);
}

function checkNormalizeIdempotency(storageApi, fixtures) {
  Object.entries(fixtures).forEach(([name, fixture]) => {
    const once = storageApi.normalizeDb(clone(fixture));
    const twice = storageApi.normalizeDb(clone(once));
    try {
      assertStrict.deepStrictEqual(twice, once);
    } catch (error) {
      throw new Error(`[${name}] normalizeDb should be idempotent: ${error.message}`, {
        cause: error,
      });
    }
  });
}

function checkBlank(storageApi, fixtures) {
  const db = storageApi.normalizeDb(clone(fixtures.blank));
  checkBaseShape("blank", db);
  assertEqual(db.active, null, "[blank] active");
}

function checkRepresentative(storageApi, fixtures) {
  const source = fixtures.representative;
  const db = storageApi.normalizeDb(clone(source));
  checkBaseShape("representative", db);
  const counts = storageApi.dataCounts(db);
  assertEqual(counts.sessions, source.sessions.length, "[representative] session count");
  assertEqual(counts.setups, source.setups.length, "[representative] setup count");
  assertEqual(counts.marks, source.sightMarks.length, "[representative] sight mark count");

  const setup = db.setups.find((item) => item.id === "fixture-setup-recurve-1");
  assertObject(setup, "[representative] setup fixture-setup-recurve-1");
  assertEqual(setup.note, "Representative setup notes", "[representative] equipment notes");
  assertEqual(setup.arrow, "Sample carbon shaft", "[representative] equipment arrow");

  const mark = db.sightMarks.find((item) => item.id === "fixture-mark-70m");
  assertObject(mark, "[representative] sight mark fixture-mark-70m");
  assertEqual(mark.v, "5.4", "[representative] sight value v");
  assertEqual(mark.h, "0.2", "[representative] sight value h");
  assertEqual(mark.note, "Calm baseline sight mark", "[representative] sight note");

  const session = db.sessions.find((item) => item.id === "fixture-session-70m-1");
  assertObject(session, "[representative] session fixture-session-70m-1");
  [
    "id",
    "date",
    "setupId",
    "dist",
    "faceD",
    "faceType",
    "perEnd",
    "shaft",
    "sightV",
    "sightH",
    "wx",
    "note",
    "windDir",
    "windSpeed",
    "round",
    "purpose",
    "ends",
  ].forEach((field) => assertHasOwn(session, field, `[representative] session`));
  assertEqual(session.wx, "calm, overcast", "[representative] weather field wx");
  assertEqual(session.windDir, "left", "[representative] weather field windDir");
  assertEqual(session.windSpeed, "1.5", "[representative] weather field windSpeed");
  assertEqual(session.note, "Representative 70m practice session", "[representative] session note");

  const arrow = session.ends[0][0];
  assertEqual(arrow.x, 0.2, "[representative] arrow x");
  assertEqual(arrow.y, 0.1, "[representative] arrow y");
  assertEqual(arrow.s, 10, "[representative] arrow score");
  assertEqual(arrow.X, true, "[representative] arrow X");
  assertEqual(arrow.no, "1", "[representative] arrow no");
  const reasonArrow = session.ends[0].find((item) => item.reason === "wind");
  assertObject(reasonArrow, "[representative] reason arrow");
  assertEqual(reasonArrow.reason, "wind", "[representative] arrow reason");

  const triple = db.sessions.find((item) => item.id === "fixture-session-18m-triple-1");
  assertObject(triple, "[representative] triple session");
  const spotArrow = triple.ends[0].find((item) => item.spot === 2);
  assertObject(spotArrow, "[representative] spot arrow");
  assertEqual(spotArrow.spot, 2, "[representative] arrow spot");
}

function checkActiveSession(storageApi, fixtures) {
  const db = storageApi.normalizeDb(clone(fixtures.activeSession));
  checkBaseShape("active-session", db);
  assertObject(db.active, "[active-session] active");
  assertArray(db.active.ends, "[active-session] active.ends");
  assertArray(db.active.cur, "[active-session] active.cur");
  assertEqual(db.active.purpose, "practice", "[active-session] purpose");
  assertEqual(
    db.active.cur.length,
    fixtures.activeSession.active.cur.length,
    "[active-session] cur length",
  );
  assertEqual(db.active.cur[1].reason, "aim", "[active-session] unfinished arrow reason");
  assertEqual(db.sessions.length, 0, "[active-session] active should not move into sessions");
}

function checkTrashNormalize(storageApi, fixtures) {
  const db = storageApi.normalizeDb(clone(fixtures.trash));
  checkBaseShape("trash", db);
  const types = db.trash.map((entry) => entry.type);
  ["session", "sightMark", "setupBundle"].forEach((type) => {
    assert(types.includes(type), `[trash] should keep ${type} entry`);
  });
  db.trash.forEach((entry) => {
    ["id", "type", "label", "data", "date", "ts"].forEach((field) => {
      assertHasOwn(entry, field, `[trash] ${entry.type} entry`);
    });
    assertObject(entry.data, `[trash] ${entry.type} data`);
  });
}

function checkTrashRestore(storageApi, fixtures) {
  const db = storageApi.normalizeDb(clone(fixtures.trash));
  let saveCalls = 0;
  const trashApi = loadTrashApi(db, () => {
    saveCalls += 1;
  });

  const ids = db.trash.map((entry) => entry.id);
  ids.forEach((id) => {
    assert(trashApi.restoreTrash(id), `[trash restore] ${id} should restore`);
    assert(
      !db.trash.some((entry) => entry.id === id),
      `[trash restore] ${id} should be removed from trash`,
    );
  });

  assert(
    db.sessions.some((session) => session.id === "fixture-deleted-session"),
    "[trash restore] session should return to sessions",
  );
  assert(
    db.sightMarks.some((mark) => mark.id === "fixture-deleted-mark-50m"),
    "[trash restore] sightMark should return to sightMarks",
  );
  assert(
    db.setups.some((setup) => setup.id === "fixture-deleted-setup"),
    "[trash restore] setupBundle should restore setup",
  );
  assert(
    db.sightMarks.some((mark) => mark.id === "fixture-deleted-bundle-mark-30m"),
    "[trash restore] setupBundle should restore bundled sight mark",
  );
  assertEqual(db.trash.length, 0, "[trash restore] trash length");
  assertEqual(saveCalls, ids.length, "[trash restore] save call count");
}

function checkPartialLegacy(storageApi, fixtures) {
  const db = storageApi.normalizeDb(clone(fixtures.partialLegacy));
  checkBaseShape("partial-legacy", db);
  assertEqual(db.active, null, "[partial-legacy] missing active should normalize to null");
  assertEqual(
    db.sightMarks.length,
    0,
    "[partial-legacy] missing sightMarks should normalize to empty array",
  );
  assertEqual(db.trash.length, 0, "[partial-legacy] missing trash should normalize to empty array");
  assertEqual(db.settings.eyeSight, 820, "[partial-legacy] existing setting eyeSight");
  assert(
    !Object.hasOwn(db.settings, "theme"),
    "[partial-legacy] current compatibility behavior leaves missing setting theme absent",
  );
  assert(
    !Object.hasOwn(db.settings, "lastBackupAt"),
    "[partial-legacy] current compatibility behavior leaves missing setting lastBackupAt absent",
  );
  assert(
    !Object.hasOwn(db.settings, "activeGuideSeen"),
    "[partial-legacy] current compatibility behavior leaves missing setting activeGuideSeen absent",
  );
  assertEqual(
    db.sessions[0].id,
    "fixture-legacy-session",
    "[partial-legacy] representative session",
  );

  assertObject(db.legacyTopLevelField, "[partial-legacy] legacyTopLevelField");
  assertEqual(
    db.settings.legacySetting,
    "preserve settings metadata",
    "[partial-legacy] legacy setting",
  );
  assertEqual(
    db.sessions[0].legacySessionField.source,
    "older export",
    "[partial-legacy] current compatibility behavior keeps nested session fields",
  );
  assertEqual(
    db.setups[0].legacySetupField,
    "preserve setup metadata",
    "[partial-legacy] current compatibility behavior keeps nested setup fields",
  );
}

function checkDanglingSetup(storageApi, fixtures) {
  const db = storageApi.normalizeDb(clone(fixtures.danglingSetup));
  checkBaseShape("dangling-setup", db);
  assertEqual(db.setups.length, 1, "[dangling-setup] setup count");
  assertEqual(db.sessions.length, 3, "[dangling-setup] session count");

  const valid = db.sessions.find((session) => session.id === "fixture-session-valid-setup");
  assertObject(valid, "[dangling-setup] valid setup session");
  assertEqual(valid.setupId, "fixture-valid-setup", "[dangling-setup] valid setupId");
  assert(
    db.setups.some((setup) => setup.id === valid.setupId),
    "[dangling-setup] valid setup should exist",
  );

  const dangling = db.sessions.find((session) => session.id === "fixture-session-missing-setup");
  assertObject(dangling, "[dangling-setup] missing setup session");
  assertEqual(dangling.setupId, "missing-setup-001", "[dangling-setup] dangling setupId");
  assert(
    !db.setups.some((setup) => setup.id === dangling.setupId),
    "[dangling-setup] dangling setupId should not exist in setups",
  );
  assertEqual(dangling.dist, 50, "[dangling-setup] dangling distance");
  assertEqual(dangling.ends[0][1].reason, "wind", "[dangling-setup] dangling arrow reason");

  const noSetup = db.sessions.find((session) => session.id === "fixture-session-no-setup");
  assertObject(noSetup, "[dangling-setup] no setup session");
  assertEqual(noSetup.setupId, null, "[dangling-setup] no setup setupId");
  assertEqual(noSetup.dist, 30, "[dangling-setup] no setup distance");
}

function checkSightMarksCompatibility(storageApi, fixtures) {
  const db = storageApi.normalizeDb(clone(fixtures.sightMarksCompatibility));
  checkBaseShape("sight-marks-compatibility", db);
  assertEqual(db.setups.length, 1, "[sight-marks-compatibility] setup count");
  assertEqual(db.sightMarks.length, 4, "[sight-marks-compatibility] sight mark count");
  assertEqual(db.sessions.length, 3, "[sight-marks-compatibility] session count");

  const valid = db.sightMarks.find((mark) => mark.id === "fixture-sight-mark-valid");
  assertObject(valid, "[sight-marks-compatibility] valid sight mark");
  assertEqual(valid.setupId, "fixture-sight-setup", "[sight-marks-compatibility] valid setupId");
  assert(
    db.setups.some((setup) => setup.id === valid.setupId),
    "[sight-marks-compatibility] valid setup should exist",
  );
  assertEqual(valid.dist, 70, "[sight-marks-compatibility] valid distance");
  assertEqual(valid.v, "5.7", "[sight-marks-compatibility] valid vertical sight");
  assertEqual(valid.h, "0.2", "[sight-marks-compatibility] valid horizontal sight");
  assertEqual(
    valid.legacyMarkField.source,
    "older sight notebook",
    "[sight-marks-compatibility] legacy sight mark field",
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
    "[sight-marks-compatibility] dangling setupId should not exist in setups",
  );
  assertEqual(dangling.dist, 50, "[sight-marks-compatibility] dangling distance");
  assertEqual(dangling.v, "4.8", "[sight-marks-compatibility] dangling vertical sight");
  assertEqual(dangling.h, "", "[sight-marks-compatibility] missing horizontal sight");

  const noSetup = db.sightMarks.find((mark) => mark.id === "fixture-sight-mark-no-setup");
  assertObject(noSetup, "[sight-marks-compatibility] no setup sight mark");
  assertEqual(noSetup.setupId, null, "[sight-marks-compatibility] no setup setupId");
  assertEqual(noSetup.dist, 30, "[sight-marks-compatibility] no setup distance");
  assertEqual(noSetup.v, "", "[sight-marks-compatibility] missing vertical sight");
  assertEqual(noSetup.h, "-0.1", "[sight-marks-compatibility] no setup horizontal sight");

  const missingDistance = db.sightMarks.find(
    (mark) => mark.id === "fixture-sight-mark-missing-distance",
  );
  assertObject(missingDistance, "[sight-marks-compatibility] missing distance sight mark");
  assertEqual(
    missingDistance.dist,
    null,
    "[sight-marks-compatibility] missing distance should stay null",
  );

  const session = db.sessions.find((item) => item.id === "fixture-session-sight-valid");
  assertObject(session, "[sight-marks-compatibility] valid sight session");
  assertEqual(session.sightV, "5.7", "[sight-marks-compatibility] session sightV");
  assertEqual(session.sightH, "0.2", "[sight-marks-compatibility] session sightH");
  assertEqual(
    session.legacySessionField.source,
    "older sight export",
    "[sight-marks-compatibility] legacy session field",
  );

  const danglingSession = db.sessions.find(
    (item) => item.id === "fixture-session-sight-dangling-setup",
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

  const noSetupSession = db.sessions.find((item) => item.id === "fixture-session-sight-no-setup");
  assertObject(noSetupSession, "[sight-marks-compatibility] no setup sight session");
  assertEqual(noSetupSession.setupId, null, "[sight-marks-compatibility] no setup session setupId");
  assertEqual(noSetupSession.dist, null, "[sight-marks-compatibility] no setup session distance");
  assertObject(db.legacyTopLevelField, "[sight-marks-compatibility] legacy top-level field");
}

function checkFormAnalysesCompatibility(storageApi, fixtures) {
  // schema 4 前方互換: 現行(schema 3)実装は formAnalyses を未知フィールドとして
  // 破棄せず保持しなければならない（docs/storage-schema4-design.md）
  const db = storageApi.normalizeDb(clone(fixtures.formAnalyses));
  checkBaseShape("form-analyses", db);
  assertArray(db.formAnalyses, "[form-analyses] formAnalyses");
  assertEqual(db.formAnalyses.length, 1, "[form-analyses] record count");
  const rec = db.formAnalyses[0];
  assertEqual(rec.id, "fixture-form-analysis-1", "[form-analyses] record id");
  assertEqual(rec.sessionId, "fixture-form-session", "[form-analyses] session link");
  assertArray(rec.features, "[form-analyses] features");
  assertEqual(rec.features.length, 2, "[form-analyses] feature count");
  assertEqual(rec.features[0].angles.bowElbow, 171, "[form-analyses] nested angle survives");
  assertEqual(rec.features[0].phase.anchorMs, 1800, "[form-analyses] nested phase survives");
  assert(
    db.sessions.some((session) => session.id === "fixture-form-session"),
    "[form-analyses] linked session survives",
  );
}

function checkFormAnalysisTrashRestore(storageApi, fixtures) {
  const db = storageApi.normalizeDb(clone(fixtures.formAnalyses));
  const rec = db.formAnalyses[0];
  const trashApi = loadTrashApi(db, () => {});
  const item = trashApi.trashItem("formAnalysis", "射形記録", rec);
  db.formAnalyses = db.formAnalyses.filter((f) => f.id !== rec.id);
  assert(trashApi.restoreTrash(item.id), "[form-analyses trash] restore should succeed");
  assert(
    db.formAnalyses.some((f) => f.id === rec.id),
    "[form-analyses trash] record should return to formAnalyses",
  );
  assert(
    !trashApi.restoreTrash(item.id),
    "[form-analyses trash] second restore of same id should fail",
  );
}

function checkArrowCoordinateSanitize(storageApi) {
  // インポート経路（normalizeDb）で数値文字列座標が数値化されること。
  // 変換できない値は矢を削除せず値をそのまま残す（既存データ保全）。
  const db = storageApi.normalizeDb({
    sessions: [
      {
        id: "sanitize-session",
        ends: [
          [
            { x: "1.2", y: "-0.5", s: "9" },
            { x: "abc", y: null, s: 10 },
            { x: 0.4, y: 0.2, s: 10, X: true },
          ],
        ],
      },
    ],
    active: {
      ends: [[{ x: "2.5", y: "0", s: "8" }]],
      cur: [{ x: "-1.5", y: "3.25", s: "7" }],
    },
  });
  const end = db.sessions[0].ends[0];
  assertEqual(end.length, 3, "[arrow-sanitize] no arrow is dropped");
  assertEqual(end[0].x, 1.2, "[arrow-sanitize] string x becomes number");
  assertEqual(end[0].y, -0.5, "[arrow-sanitize] string y becomes number");
  assertEqual(end[0].s, 9, "[arrow-sanitize] string s becomes number");
  assertEqual(end[1].x, "abc", "[arrow-sanitize] unconvertible x is kept as-is");
  assertEqual(end[1].y, null, "[arrow-sanitize] null y is kept as-is");
  assertEqual(end[1].s, 10, "[arrow-sanitize] numeric s stays untouched");
  assertEqual(end[2].x, 0.4, "[arrow-sanitize] numeric x stays untouched");
  assertEqual(end[2].X, true, "[arrow-sanitize] other arrow fields survive");
  assertEqual(db.active.ends[0][0].x, 2.5, "[arrow-sanitize] active end arrow x becomes number");
  assertEqual(db.active.cur[0].x, -1.5, "[arrow-sanitize] active cur arrow x becomes number");
  assertEqual(db.active.cur[0].s, 7, "[arrow-sanitize] active cur arrow s becomes number");
}

function checkDbRevContract() {
  assert(/^let DB_REV\s*=\s*0/m.test(storageScript), "[db-rev] storage script should declare let DB_REV");
  const saveBody = section("function save(", "function uid");
  assert(
    saveBody.includes("DB_REV++"),
    "[db-rev] save() should bump DB_REV so session metric caches invalidate",
  );
}

function main() {
  const fixtures = loadFixtures();
  const storageApi = loadStorageApi();

  checkDbRevContract();
  checkArrowCoordinateSanitize(storageApi);

  checkNormalizeIdempotency(storageApi, fixtures);
  checkBlank(storageApi, fixtures);
  checkRepresentative(storageApi, fixtures);
  checkActiveSession(storageApi, fixtures);
  checkTrashNormalize(storageApi, fixtures);
  checkTrashRestore(storageApi, fixtures);
  checkPartialLegacy(storageApi, fixtures);
  checkDanglingSetup(storageApi, fixtures);
  checkSightMarksCompatibility(storageApi, fixtures);
  checkFormAnalysesCompatibility(storageApi, fixtures);
  checkFormAnalysisTrashRestore(storageApi, fixtures);

  console.log("Storage contract checks OK");
}

try {
  main();
} catch (error) {
  console.error("Storage contract check failed:");
  console.error(error.message);
  process.exitCode = 1;
}
