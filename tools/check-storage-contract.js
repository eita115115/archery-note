"use strict";

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
  assertEqual(db.schema, 3, `[${name}] schema`);
  assertArray(db.setups, `[${name}] setups`);
  assertArray(db.sightMarks, `[${name}] sightMarks`);
  assertArray(db.sessions, `[${name}] sessions`);
  assertArray(db.trash, `[${name}] trash`);
  assertObject(db.settings, `[${name}] settings`);
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

function main() {
  const fixtures = loadFixtures();
  const storageApi = loadStorageApi();

  checkBlank(storageApi, fixtures);
  checkRepresentative(storageApi, fixtures);
  checkActiveSession(storageApi, fixtures);
  checkTrashNormalize(storageApi, fixtures);
  checkTrashRestore(storageApi, fixtures);
  checkPartialLegacy(storageApi, fixtures);
  checkDanglingSetup(storageApi, fixtures);

  console.log("Storage contract checks OK");
}

try {
  main();
} catch (error) {
  console.error("Storage contract check failed:");
  console.error(error.message);
  process.exitCode = 1;
}
