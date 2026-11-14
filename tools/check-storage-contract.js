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
  formAnalysesV2: "archery-note-v1-form-analyses-v2.json",
  formDiagnostics: "archery-note-v1-form-diagnostics.json",
  formDiagnosticsMalformedCoordinator:
    "archery-note-v1-form-diagnostics-malformed-coordinator.json",
  customRounds: "archery-note-v1-custom-rounds.json",
  notes: "archery-note-v1-notes.json",
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

function loadRoundApi(db) {
  return new Function(
    "db",
    `${storageScript.slice(storageScript.indexOf("const ROUND_TYPES"))}
return {ROUND_TYPES, MULTI_ROUND_PRESETS, multiRoundDefs, findRoundDef, roundLabel};`,
  )(db);
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
  assertEqual(db.schema, 5, `[${name}] schema`);
  assertArray(db.setups, `[${name}] setups`);
  assertArray(db.sightMarks, `[${name}] sightMarks`);
  assertArray(db.sessions, `[${name}] sessions`);
  assertArray(db.trash, `[${name}] trash`);
  assertArray(db.notes, `[${name}] notes`);
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
  // 欠落している settings キーは blankDb() の既定値で補完される。
  // 既定値が補完されないと、新機能が settings に追加した既定値が既存ユーザーに届かない
  // （旧 normalizeDb は Object.assign(base,src) で base.settings ごと置換されるバグがあった）。
  // テーマ未保存の既存データは従来どおり端末に合わせる（新規インストールの既定ダークを既存ユーザーに押しつけない）
  assertEqual(
    db.settings.theme,
    "auto",
    "[partial-legacy] missing setting theme keeps the legacy auto theme",
  );
  assertEqual(
    storageApi.normalizeDb(null).settings.theme,
    "dark",
    "[new-install] fresh database defaults to the dark theme",
  );
  assertEqual(
    db.settings.lastBackupAt,
    null,
    "[partial-legacy] missing setting lastBackupAt is backfilled with default",
  );
  assertEqual(
    db.settings.activeGuideSeen,
    false,
    "[partial-legacy] missing setting activeGuideSeen is backfilled with default",
  );
  // オンボーディング3フィールドの補完（フィールド単位・型検証つき）
  assertEqual(
    db.settings.onboardingSeen,
    false,
    "[partial-legacy] missing setting onboardingSeen is backfilled with default",
  );
  assertEqual(
    db.settings.launchCount,
    0,
    "[partial-legacy] missing setting launchCount is backfilled with default",
  );
  assert(
    db.settings.featureHints &&
      typeof db.settings.featureHints === "object" &&
      db.settings.featureHints.gearSetup === false &&
      db.settings.featureHints.analysis === false &&
      db.settings.featureHints.sightAdjust === false &&
      db.settings.featureHints.formTracking === false &&
      db.settings.featureHints.addToHome === false,
    "[partial-legacy] missing featureHints is backfilled with all-false defaults",
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
  // 破棄せず保持しなければならない（docs/infra/storage-schema4-design.md）
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
  // AN-098: 旧記録は読み込みで何も足されない（撮影条件 cap を持たないまま）
  assert(!Object.hasOwn(rec, "cap"), "[form-analyses] legacy record gains no capture conditions");
  assertEqual(
    JSON.stringify(rec),
    JSON.stringify(fixtures.formAnalyses.formAnalyses[0]),
    "[form-analyses] legacy record is unchanged by normalize",
  );
  // AN-098: 新しい記録の撮影条件（追加フィールドだけ。SCHEMA_VER・キーは変えない）は
  // 読み込み・二度目の読み込み・JSON 往復でそのまま残る
  const withCap = clone(fixtures.formAnalyses);
  const cap = {
    g: 2,
    fw: 720,
    fh: 1280,
    mw: 504,
    mh: 1280,
    o: "p",
    crop: 1,
    facing: "environment",
    hand: "right",
    src: "live",
  };
  withCap.formAnalyses.push({
    ...clone(withCap.formAnalyses[0]),
    id: "fixture-form-analysis-cap",
    cap,
    features: [
      {
        phase: { anchorMs: 1700 },
        angles: { bowArm: 176.4, drawArm: null },
        anchorNorm: 0.21,
        release: { bowMove: 0.01, drawMove: 0.02, stable: true, noise: 0.004 },
        confidence: 0.9,
        score: 80,
        arrowCheck: { judgment: "unclear", preScore: null, confirmScore: 0.1 },
      },
    ],
  });
  const schemaBefore = withCap.schema;
  const once = storageApi.normalizeDb(clone(withCap));
  const twice = storageApi.normalizeDb(JSON.parse(JSON.stringify(once)));
  [once, twice].forEach((loaded, i) => {
    const kept = loaded.formAnalyses.find((f) => f.id === "fixture-form-analysis-cap");
    assert(kept, `[form-analyses cap] record survives load ${i + 1}`);
    assertEqual(
      JSON.stringify(kept),
      JSON.stringify(withCap.formAnalyses[1]),
      `[form-analyses cap] record is unchanged by load ${i + 1}`,
    );
    assert(
      JSON.stringify(kept).length < 2048,
      `[form-analyses cap] one-shot record stays under 2 KB, got ${JSON.stringify(kept).length}`,
    );
  });
  assertEqual(once.schema, storageApi.normalizeDb(clone(fixtures.formAnalyses)).schema, "[form-analyses cap] schema unchanged");
  assert(schemaBefore != null, "[form-analyses cap] fixture declares a schema");
}

/* AN-100: 射型の記録 v2（cap.g = 3 と v2 の数値）。追加のフィールドだけで、SCHEMA_VER とキーは変えない。
   fixture は合成の射手から作った本物の形の 1 件（6 射 + 引き戻し 1 回 + 足した候補 1 回）と、以前の記録 2 件 */
function checkFormAnalysesV2(storageApi, fixtures) {
  const FormV2 = require("./form-record-loader.js");
  const FormAnalyze = require("./form-analyze-loader.js");
  const source = fixtures.formAnalysesV2;
  const [legacy, stageA, v2] = source.formAnalyses;
  const once = storageApi.normalizeDb(clone(source));
  const twice = storageApi.normalizeDb(JSON.parse(JSON.stringify(once)));
  checkBaseShape("form-analyses-v2", once);
  [once, twice].forEach((loaded, i) => {
    assertEqual(loaded.formAnalyses.length, 3, `[form-analyses-v2] record count after load ${i + 1}`);
    loaded.formAnalyses.forEach((rec, k) => {
      assertEqual(
        JSON.stringify(rec),
        JSON.stringify(source.formAnalyses[k]),
        `[form-analyses-v2] record ${k} is unchanged by load ${i + 1}`,
      );
    });
  });
  assertEqual(
    once.schema,
    storageApi.normalizeDb(clone(fixtures.formAnalyses)).schema,
    "[form-analyses-v2] schema unchanged",
  );
  // 読み分け: v2 は cap.g = 3 と v2.ev を持つ記録だけ。以前の記録（cap なし・cap.g = 2）は v2 ではない
  assert(!FormV2.isV2(legacy), "[form-analyses-v2] a record without cap is not v2");
  assert(!FormV2.isV2(stageA), "[form-analyses-v2] a stage-A record (cap.g 2) is not v2");
  assert(FormV2.isV2(v2), "[form-analyses-v2] the v2 record is recognised");
  assertEqual(v2.cap.g, 3, "[form-analyses-v2] geometry version");
  assertArray(v2.features, "[form-analyses-v2] features placeholder for older app versions");
  assertEqual(v2.features.length, 0, "[form-analyses-v2] features placeholder is empty");
  for (const key of ["av", "fv", "dur", "cov", "tpx", "view", "ld", "ev", "cd", "f", "nz", "nd", "ps", "pr", "ed", "w"]) {
    assert(Object.hasOwn(v2.v2, key), `[form-analyses-v2] v2.${key} exists`);
  }
  assertEqual(v2.v2.f.length, 6, "[form-analyses-v2] one value row per analysed shot");
  assertEqual(v2.v2.ps[0].length, 18, "[form-analyses-v2] hold pose has 9 points");
  assertEqual(v2.v2.pr[0].length, 18, "[form-analyses-v2] release pose has 9 points");
  assertEqual(v2.shots, 7, "[form-analyses-v2] count includes the candidate the archer added");
  assertEqual(JSON.stringify(v2.v2.ed), "[1,0]", "[form-analyses-v2] edits are recorded");
  const bytes = JSON.stringify(v2).length;
  assert(bytes <= 2000, `[form-analyses-v2] six shots stay within 2 KB, got ${bytes}`);
  assert(
    !/landmarks|visibility/.test(JSON.stringify(v2)),
    "[form-analyses-v2] no landmark stream is stored",
  );
  // 画面は保存した形だけから描く: 読み込みの前後で同じ数と同じ文になる
  const before = FormV2.read(v2);
  const after = FormV2.read(twice.formAnalyses[2]);
  assertEqual(after.count, 7, "[form-analyses-v2] count read back");
  assertEqual(after.letdowns, 1, "[form-analyses-v2] let-downs read back");
  assertEqual(
    FormV2.summary(after, FormV2.compare(after, FormAnalyze), null).text,
    FormV2.summary(before, FormV2.compare(before, FormAnalyze), null).text,
    "[form-analyses-v2] summary sentence is the same after a reload",
  );
  // 以前の記録とは比べない
  assert(!FormV2.comparable(v2, legacy, "holdMs").ok, "[form-analyses-v2] never compared with a legacy record");
  assert(!FormV2.comparable(v2, stageA, "holdMs").ok, "[form-analyses-v2] never compared with a stage-A record");
  assertEqual(FormV2.trend(once.formAnalyses, "holdMs").points.length, 1, "[form-analyses-v2] trend holds v2 records only");
  // 設定の既定: 身長は未設定（null）、数えた合図の音は切。SCHEMA_VER は変えずにキー単位で補う
  assertEqual(once.settings.formHeightCm, null, "[form-analyses-v2] height defaults to unset");
  assertEqual(once.settings.formCountSound, false, "[form-analyses-v2] count sound defaults to off");
  const blank = storageApi.normalizeDb(clone(fixtures.blank));
  assertEqual(blank.settings.formHeightCm, null, "[form-analyses-v2] blank db height is unset");
  assertEqual(blank.settings.formCountSound, false, "[form-analyses-v2] blank db count sound is off");
  for (const [given, expected] of [
    [172, 172],
    [172.4, 172],
    ["172", null],
    [30, null],
    [400, null],
    [NaN, null],
    [undefined, null],
  ]) {
    const withHeight = clone(source);
    withHeight.settings.formHeightCm = given;
    withHeight.settings.formCountSound = given === 172 ? true : "yes";
    const loaded = storageApi.normalizeDb(withHeight);
    assertEqual(loaded.settings.formHeightCm, expected, `[form-analyses-v2] height ${String(given)}`);
    assertEqual(loaded.settings.formCountSound, given === 172, `[form-analyses-v2] count sound for ${String(given)}`);
    assertEqual(
      JSON.stringify(loaded.formAnalyses),
      JSON.stringify(source.formAnalyses),
      `[form-analyses-v2] records untouched when height is ${String(given)}`,
    );
  }
  // ゴミ箱から戻しても同じ形
  const db = storageApi.normalizeDb(clone(source));
  const trashApi = loadTrashApi(db, () => {});
  const item = { id: "trash-form-v2", type: "formAnalysis", data: clone(v2), date: "2026-11-14", ts: 1 };
  db.trash.unshift(item);
  db.formAnalyses = db.formAnalyses.filter((f) => f.id !== v2.id);
  assert(trashApi.restoreTrash(item.id), "[form-analyses-v2 trash] restore should succeed");
  assertEqual(
    JSON.stringify(db.formAnalyses.find((f) => f.id === v2.id)),
    JSON.stringify(v2),
    "[form-analyses-v2 trash] restored record is unchanged",
  );
}

function checkFormAnalysisTrashRestore(storageApi, fixtures) {
  const db = storageApi.normalizeDb(clone(fixtures.formAnalyses));
  const rec = db.formAnalyses[0];
  const trashApi = loadTrashApi(db, () => {});
  const item = trashApi.trashItem("formAnalysis", "射型記録", rec);
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

function checkFormDiagnosticsCompatibility(storageApi, fixtures) {
  ["formDiagnostics", "formDiagnosticsMalformedCoordinator"].forEach((name) => {
    const source = fixtures[name];
    const once = storageApi.normalizeDb(clone(source));
    const twice = storageApi.normalizeDb(clone(once));
    assertStrict.deepStrictEqual(
      twice.formAnalyses,
      source.formAnalyses,
      `[${name}] records survive normalization twice`,
    );
    assertStrict.deepStrictEqual(
      twice.settings.formDiagnosticMatrixBatch,
      source.settings.formDiagnosticMatrixBatch,
      `[${name}] coordinator survives normalization twice`,
    );
  });

  const source = fixtures.formDiagnostics;
  const db = storageApi.normalizeDb(clone(source));
  const record = db.formAnalyses[0];
  const trashApi = loadTrashApi(db, () => {});
  const item = trashApi.trashItem("formAnalysis", "synthetic diagnostic", record);
  db.formAnalyses = [];
  assert(trashApi.restoreTrash(item.id), "[formDiagnostics] trash restore succeeds");
  assertStrict.deepStrictEqual(
    db.formAnalyses[0],
    source.formAnalyses[0],
    "[formDiagnostics] trash restore preserves nested diagnostics",
  );
}

function checkCustomRoundsCompatibility(storageApi, fixtures) {
  // schema 5: customRounds は配列補完のみで migration 不要。roundGroup 付きセッションも
  // 従来どおりの単一距離セッションとして無変更で保持されること（IMP-09 多距離ラウンド）。
  const source = fixtures.customRounds;
  const db = storageApi.normalizeDb(clone(source));
  checkBaseShape("custom-rounds", db);
  assertArray(db.customRounds, "[custom-rounds] customRounds");
  try {
    assertStrict.deepStrictEqual(db.customRounds, source.customRounds);
  } catch (error) {
    throw new Error(
      `[custom-rounds] customRounds must survive normalizeDb unchanged: ${error.message}`,
      {
        cause: error,
      },
    );
  }
  try {
    assertStrict.deepStrictEqual(db.sessions, source.sessions);
  } catch (error) {
    throw new Error(
      `[custom-rounds] sessions (incl. roundGroup) must stay unchanged: ${error.message}`,
      {
        cause: error,
      },
    );
  }
  const stage = db.sessions.find((session) => session.id === "fixture-round-stage-1");
  assertObject(stage, "[custom-rounds] stage session");
  assertObject(stage.roundGroup, "[custom-rounds] stage roundGroup");
  assertEqual(stage.roundGroup.gid, "fixture-round-group-1", "[custom-rounds] roundGroup gid");
  assertEqual(stage.roundGroup.roundId, "custom-6030", "[custom-rounds] roundGroup roundId");
  assertEqual(stage.roundGroup.stage, 0, "[custom-rounds] roundGroup stage");
  assertEqual(stage.roundGroup.stageCount, 2, "[custom-rounds] roundGroup stageCount");
  const plain = db.sessions.find((session) => session.id === "fixture-round-plain-session");
  assertObject(plain, "[custom-rounds] plain session survives");
  assert(
    !Object.hasOwn(plain, "roundGroup"),
    "[custom-rounds] plain session must not grow a roundGroup property",
  );

  // customRounds を持たない既存データは空配列に補完される（migration なし）
  const legacy = storageApi.normalizeDb(clone(fixtures.representative));
  assertArray(legacy.customRounds, "[custom-rounds] legacy db customRounds");
  assertEqual(legacy.customRounds.length, 0, "[custom-rounds] legacy db customRounds count");
}

function checkMultiRoundDefs(fixtures) {
  // プリセットのみ（customRounds 空）
  const presetApi = loadRoundApi({ customRounds: [] });
  const presets = presetApi.multiRoundDefs();
  assertEqual(presets.length, 2, "[round-defs] preset count");
  const men = presetApi.findRoundDef("wa1440_men");
  assertObject(men, "[round-defs] WA1440 men preset");
  assertEqual(men.label, "WA1440 男子", "[round-defs] WA1440 men label");
  assertStrict.deepStrictEqual(
    men.stages.map((st) => [st.dist, st.faceD, st.arrows, st.perEnd]),
    [
      [90, 122, 36, 6],
      [70, 122, 36, 6],
      [50, 80, 36, 3],
      [30, 80, 36, 3],
    ],
    "[round-defs] WA1440 men stages (50/30m は3本エンド)",
  );
  const women = presetApi.findRoundDef("wa1440_women");
  assertObject(women, "[round-defs] WA1440 women preset");
  assertStrict.deepStrictEqual(
    women.stages.map((st) => [st.dist, st.faceD, st.arrows, st.perEnd]),
    [
      [70, 122, 36, 6],
      [60, 122, 36, 6],
      [50, 80, 36, 3],
      [30, 80, 36, 3],
    ],
    "[round-defs] WA1440 women stages",
  );
  men.stages.forEach((st, i) => {
    assertEqual(st.faceType, "single", `[round-defs] men stage ${i} faceType`);
  });
  assertEqual(presetApi.findRoundDef("no-such-round"), null, "[round-defs] unknown id gives null");

  // カスタム定義: 追加と id 重複時のカスタム優先
  const customApi = loadRoundApi({ customRounds: clone(fixtures.customRounds.customRounds) });
  const defs = customApi.multiRoundDefs();
  assertEqual(defs.length, 3, "[round-defs] presets + custom count (duplicate id merges)");
  assertEqual(
    customApi.findRoundDef("wa1440_men").label,
    "WA1440 男子（カスタム上書き）",
    "[round-defs] custom definition wins on id collision",
  );
  assertEqual(
    customApi.findRoundDef("custom-6030").stages.length,
    2,
    "[round-defs] custom round stage count",
  );

  // roundLabel: 既存6種の返値は不変、多距離ラウンド id はその label、未知 id は先頭フォールバック
  const legacyLabels = [
    ["free", "自由練習"],
    ["70m72", "70m 72射"],
    ["50m72", "50m 72射"],
    ["30m36", "30m 36射"],
    ["18m60", "18m 60射"],
    ["field72", "フィールド 24標的/72射"],
  ];
  legacyLabels.forEach(([id, label]) => {
    assertEqual(customApi.roundLabel(id), label, `[round-defs] legacy roundLabel(${id})`);
  });
  assertEqual(customApi.roundLabel(""), "自由練習", "[round-defs] empty id falls back to free");
  assertEqual(
    customApi.roundLabel("wa1440_women"),
    "WA1440 女子",
    "[round-defs] multi-round label",
  );
  assertEqual(
    customApi.roundLabel("custom-6030"),
    "カスタム 60/30m",
    "[round-defs] custom round label",
  );
  assertEqual(
    customApi.roundLabel("unknown-round"),
    "自由練習",
    "[round-defs] unknown id falls back to the first round type",
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
  assertEqual(end[1].x, 0, "[arrow-sanitize] unconvertible x is forced to 0");
  assertEqual(end[1].y, null, "[arrow-sanitize] null y is kept as-is");
  assertEqual(end[1].s, 10, "[arrow-sanitize] numeric s stays untouched");
  assertEqual(end[2].x, 0.4, "[arrow-sanitize] numeric x stays untouched");
  assertEqual(end[2].X, true, "[arrow-sanitize] other arrow fields survive");
  assertEqual(db.active.ends[0][0].x, 2.5, "[arrow-sanitize] active end arrow x becomes number");
  assertEqual(db.active.cur[0].x, -1.5, "[arrow-sanitize] active cur arrow x becomes number");
  assertEqual(db.active.cur[0].s, 7, "[arrow-sanitize] active cur arrow s becomes number");

  // ゴミ箱内セッションも同じサニタイズを通ること（restoreTrash は normalizeDb を通らないため）。
  const trashDb = storageApi.normalizeDb({
    trash: [
      { id: "t1", type: "session", data: { id: "s1", ends: [[{ x: "3.5", y: "1", s: "6" }]] } },
      { id: "t2", type: "setup", data: { id: "g1" } },
    ],
  });
  assertEqual(
    trashDb.trash[0].data.ends[0][0].x,
    3.5,
    "[arrow-sanitize] trashed session arrow x becomes number",
  );
  assertEqual(
    trashDb.trash[0].data.ends[0][0].s,
    6,
    "[arrow-sanitize] trashed session arrow s becomes number",
  );
  assertEqual(
    trashDb.trash.length,
    2,
    "[arrow-sanitize] non-session trash entries pass through untouched",
  );

  // 座標のない矢（点数だけの入力・「M 位置なし」）と、手で直した点数（段 3 の追加項目）。
  // 矢を消さない・座標を作らない・追加項目を落とさない。旧データ（項目なし）はそのまま。
  const keyDb = storageApi.normalizeDb({
    sessions: [
      {
        id: "key-session",
        inputMode: "score",
        ends: [
          [
            { s: 10, X: true, src: "key" },
            { s: "0", X: false, src: "key" },
            { x: null, y: null, s: 9, src: "key" },
            { x: 1.5, y: -2, s: 10, X: false, src: "pos", manual: true, auto: { s: "9", X: false } },
            { x: 0.4, y: 0.2, s: 10, X: true },
          ],
        ],
      },
      { id: "legacy-session", ends: [[{ x: 0.4, y: 0.2, s: 10, X: true }]] },
    ],
    active: { inputMode: "score", ends: [], cur: [{ s: 7, X: false, src: "key" }] },
    trash: [{ id: "t-key", type: "session", data: { id: "s-key", ends: [[{ s: 8, src: "key" }]] } }],
  });
  const keyEnd = keyDb.sessions[0].ends[0];
  assertEqual(keyEnd.length, 5, "[coordless] no arrow is dropped");
  assert(
    !Object.hasOwn(keyEnd[0], "x") && !Object.hasOwn(keyEnd[0], "y"),
    "[coordless] a key arrow must not get x / y properties",
  );
  assertEqual(keyEnd[0].src, "key", "[coordless] src survives");
  assertEqual(keyEnd[1].s, 0, "[coordless] string score of a key arrow becomes a number");
  assert(!Object.hasOwn(keyEnd[1], "x"), "[coordless] coordinate-less M must not get coordinates");
  assertEqual(keyEnd[2].x, null, "[coordless] null x is kept as-is (never repaired to 0)");
  assertEqual(keyEnd[2].y, null, "[coordless] null y is kept as-is (never repaired to 0)");
  assertEqual(keyEnd[3].manual, true, "[coordless] manual flag survives");
  assertEqual(keyEnd[3].auto.s, 9, "[coordless] automatic score before the override becomes a number");
  assertEqual(keyEnd[3].x, 1.5, "[coordless] overridden arrow keeps its position");
  assertEqual(keyDb.sessions[0].inputMode, "score", "[coordless] session inputMode survives");
  assertEqual(
    JSON.stringify(keyDb.sessions[1]),
    JSON.stringify({ id: "legacy-session", ends: [[{ x: 0.4, y: 0.2, s: 10, X: true }]], date: "", faceD: 122, faceType: "single" }),
    "[coordless] legacy session gains no stage-3 fields",
  );
  assert(
    !Object.hasOwn(keyDb.active.cur[0], "x") && keyDb.active.inputMode === "score",
    "[coordless] active score-mode session survives",
  );
  assert(
    !Object.hasOwn(keyDb.trash[0].data.ends[0][0], "x"),
    "[coordless] trashed key arrow must not get coordinates",
  );
  assertEqual(keyDb.settings.lastInputMode, "target", "[coordless] lastInputMode defaults to target");
  assertEqual(
    storageApi.normalizeDb({ settings: { lastInputMode: "score" } }).settings.lastInputMode,
    "score",
    "[coordless] lastInputMode score survives",
  );
  assertEqual(
    storageApi.normalizeDb({ settings: { lastInputMode: 3 } }).settings.lastInputMode,
    "target",
    "[coordless] invalid lastInputMode falls back to target",
  );
  // JSON の往復（バックアップの書き出しと読み込み）でも同じ形のまま。
  const again = storageApi.normalizeDb(JSON.parse(JSON.stringify(keyDb)));
  assertEqual(
    JSON.stringify(again.sessions),
    JSON.stringify(keyDb.sessions),
    "[coordless] sessions are unchanged by a JSON round-trip",
  );

  // キーを持たない矢に own property を生やさないこと（変化時のみ代入）。
  const bare = storageApi.normalizeDb({ sessions: [{ id: "b", ends: [[{ x: 1, y: 2 }]] }] });
  assert(
    !Object.hasOwn(bare.sessions[0].ends[0][0], "s"),
    "[arrow-sanitize] missing s must not become an own undefined property",
  );
}

function checkSessionDateCoercion(storageApi) {
  // strict-review (2026-07-11) major①根本原因: 手編集・破損バックアップの非文字列 date が
  // normalizeDb を素通りすると、次回起動のゲーミフィケーション・バックフィル（backfillBadges の
  // month_master 判定など）が cur.date.slice(...) で TypeError を投げ、起動が恒久的に
  // 「読み込み失敗」画面になる（scripts/90-init.js の render() に到達しない）。
  const db = storageApi.normalizeDb({
    sessions: [
      { id: "numeric-date", date: 20260702, ends: [] },
      { id: "null-date", date: null, ends: [] },
      { id: "string-date", date: "2026-07-02", ends: [] },
    ],
  });
  assertEqual(
    typeof db.sessions[0].date,
    "string",
    "[date-coercion] numeric date becomes a string",
  );
  assertEqual(db.sessions[0].date, "20260702", "[date-coercion] numeric date is stringified as-is");
  assertEqual(typeof db.sessions[1].date, "string", "[date-coercion] null date becomes a string");
  assertEqual(
    db.sessions[1].date,
    "",
    "[date-coercion] null date becomes empty string (not the literal 'null')",
  );
  assertEqual(
    db.sessions[2].date,
    "2026-07-02",
    "[date-coercion] already-string date passes through unchanged",
  );
}

function checkBadgeUnlockedAtCoercion(storageApi) {
  // strict-review (2026-07-11) minor③: 破損バッジ（unlockedAt 欠落/非文字列）が normalizeDb を
  // 素通りすると、分析タブの実績グリッド（u.unlockedAt.slice(...)）が TypeError で
  // renderAnalysis 全体を落とす。
  const db = storageApi.normalizeDb({
    gamification: {
      badges: [
        { id: "century" }, // unlockedAt 欠落
        { id: "millennium", unlockedAt: 42 }, // 非文字列
        { id: "first_arrow", unlockedAt: "2026-07-01T00:00:00.000Z" }, // 正常
      ],
    },
  });
  db.gamification.badges.forEach((b) => {
    assertEqual(
      typeof b.unlockedAt,
      "string",
      `[badge-coercion] ${b.id} unlockedAt must be a string`,
    );
  });
  assertEqual(
    db.gamification.badges[0].unlockedAt,
    "",
    "[badge-coercion] missing unlockedAt becomes empty string",
  );
  assertEqual(
    db.gamification.badges[1].unlockedAt,
    "42",
    "[badge-coercion] non-string unlockedAt is stringified",
  );
  assertEqual(
    db.gamification.badges[2].unlockedAt,
    "2026-07-01T00:00:00.000Z",
    "[badge-coercion] already-string unlockedAt passes through unchanged",
  );
}

function checkGamificationEnabledDefault(storageApi) {
  // v1.7.0 は gamification.enabled 既定 true で出荷され、CHANGELOG「既定 OFF」告知と矛盾。
  // v1.7.1 で修正したが、L44 の浅いマージが正常に効いた場合のみで、
  // src.settings.gamification=null / 非オブジェクトのときは古い分岐に落ちて再発する余地があった。
  // 両分岐で enabled 既定が false に一致することと、既存の enabled:true が尊重されることを固定する。

  // ケース1: settings 全体が欠落（純粋な pre-v1.7.0 データ）→ blankDb 経由で既定 false
  const empty = storageApi.normalizeDb({});
  assertEqual(
    empty.settings.gamification.enabled,
    false,
    "[gam-default] missing settings defaults gamification.enabled=false",
  );

  // ケース2: settings は存在するが gamification キーは欠落 → 浅いマージで blankDb の既定 false
  const noGam = storageApi.normalizeDb({ settings: { theme: "dark" } });
  assertEqual(
    noGam.settings.gamification.enabled,
    false,
    "[gam-default] missing settings.gamification defaults enabled=false",
  );

  // ケース3: settings.gamification=null（破損バックアップ・インポート想定）→ 補完で false
  const nullGam = storageApi.normalizeDb({ settings: { gamification: null } });
  assertEqual(
    nullGam.settings.gamification.enabled,
    false,
    "[gam-default] null settings.gamification defaults enabled=false (broken import guard)",
  );

  // ケース4: settings.gamification が非オブジェクト（さらに破損）→ 補完で false
  const strGam = storageApi.normalizeDb({ settings: { gamification: "corrupt" } });
  assertEqual(
    strGam.settings.gamification.enabled,
    false,
    "[gam-default] non-object settings.gamification defaults enabled=false (broken import guard)",
  );

  // ケース5: v1.7.0 で明示的に enabled:true にしたユーザーの選択は保持
  const chosenOn = storageApi.normalizeDb({
    settings: {
      gamification: {
        enabled: true,
        practiceDays: [1, 3, 5],
        goals: { dailyArrows: 36, weeklySessions: 3, monthlyArrows: 300 },
        backfilledAt: null,
      },
    },
  });
  assertEqual(
    chosenOn.settings.gamification.enabled,
    true,
    "[gam-default] explicit user choice enabled:true is preserved (respects v1.7.0 opt-in)",
  );
  assertStrict.deepEqual(
    chosenOn.settings.gamification.practiceDays,
    [1, 3, 5],
    "[gam-default] preserving enabled:true also preserves practiceDays",
  );

  // ケース6: enabled が非boolean（欠落含む）→ 既定 false
  const wrongType = storageApi.normalizeDb({
    settings: { gamification: { practiceDays: null } },
  });
  assertEqual(
    wrongType.settings.gamification.enabled,
    false,
    "[gam-default] missing enabled key defaults to false",
  );
  const stringEnabled = storageApi.normalizeDb({
    settings: { gamification: { enabled: "yes" } },
  });
  assertEqual(
    stringEnabled.settings.gamification.enabled,
    false,
    "[gam-default] non-boolean enabled defaults to false",
  );
}

/* v5 段 6: メモだけのノート（db.notes）と練習のタグ（sess.tags）。追加のみで、書いた本文は消さない */
function checkNotesCompatibility(storageApi, fixtures) {
  const source = fixtures.notes;
  const db = storageApi.normalizeDb(clone(source));
  checkBaseShape("notes", db);
  assertStrict.deepStrictEqual(db.notes, source.notes, "[notes] notes survive normalizeDb unchanged");
  assertStrict.deepStrictEqual(
    db.sessions[0].tags,
    source.sessions[0].tags,
    "[notes] session tags survive normalizeDb unchanged",
  );
  assertEqual(db.sessions[0].note, source.sessions[0].note, "[notes] session memo text");
  assertStrict.deepStrictEqual(db.trash[0].data, source.trash[0].data, "[notes] trashed note data");

  // notes を持たない既存データ・壊れた値は空配列に補完される（migration なし）
  for (const legacy of [fixtures.representative, { notes: null }, { notes: "x" }, { notes: {} }]) {
    const out = storageApi.normalizeDb(clone(legacy));
    assertArray(out.notes, "[notes] legacy db notes");
    assertEqual(out.notes.length, 0, "[notes] legacy db notes count");
  }
  assertStrict.deepStrictEqual(storageApi.blankDb().notes, [], "[notes] blankDb has notes");
  // tags を持たない練習に、空の tags を勝手に足さない
  const plain = storageApi.normalizeDb(clone(fixtures.representative));
  assert(
    plain.sessions.every((s) => !Object.hasOwn(s, "tags")),
    "[notes] sessions without tags must not gain a tags key",
  );

  // 壊れた項目: 本文のあるものは残す（文字列は包む・id を補う・型を寄せる）。本文を持てないものだけ落とす
  const messy = storageApi.normalizeDb({
    sessions: [{ id: "s-tags", ends: [], tags: "風" }, { id: "s-tags2", ends: [], tags: [1, "", "風", "風", null] }],
    notes: [
      "文字列だけのメモ",
      null,
      42,
      [],
      "   ",
      { text: "id のないメモ", date: 20261108 },
      { id: "dup", text: "同じ id の1つ目", ts: "1794100000000", tags: "射型" },
      { id: "dup", text: "同じ id の2つ目", ts: "abc", tags: [null, "風", 3] },
      { id: "no-text", date: "2026-11-08" },
      { id: "num-text", text: 12345, date: null },
    ],
  });
  assertStrict.deepStrictEqual(
    messy.notes.map((n) => n.text),
    ["文字列だけのメモ", "id のないメモ", "同じ id の1つ目", "同じ id の2つ目", "", "12345"],
    "[notes] every entry that carries text is kept, in order",
  );
  assertEqual(new Set(messy.notes.map((n) => n.id)).size, messy.notes.length, "[notes] ids are unique");
  assert(
    messy.notes.every(
      (n) =>
        typeof n.id === "string" &&
        n.id &&
        typeof n.text === "string" &&
        typeof n.date === "string" &&
        Number.isFinite(n.ts),
    ),
    "[notes] id / text / date are strings and ts is a number",
  );
  assertEqual(messy.notes[1].date, "20261108", "[notes] non-string date becomes a string");
  assertEqual(messy.notes[2].id, "dup", "[notes] first duplicate keeps its id");
  assertEqual(messy.notes[2].ts, 1794100000000, "[notes] numeric string ts becomes a number");
  assertStrict.deepStrictEqual(messy.notes[2].tags, ["射型"], "[notes] string tags become a list");
  assertEqual(messy.notes[3].ts, 0, "[notes] unreadable ts becomes 0");
  assertStrict.deepStrictEqual(messy.notes[3].tags, ["風", "3"], "[notes] tags keep strings only");
  assertStrict.deepStrictEqual(messy.sessions[0].tags, ["風"], "[notes] session string tags");
  assertStrict.deepStrictEqual(messy.sessions[1].tags, ["1", "風"], "[notes] session tag list");
  assertStrict.deepStrictEqual(
    storageApi.normalizeDb(clone(messy)).notes,
    messy.notes,
    "[notes] sanitizing is idempotent",
  );
}

function checkNoteTrashRestore(storageApi, fixtures) {
  const db = storageApi.normalizeDb(clone(fixtures.notes));
  const before = clone(db.notes);
  let saves = 0;
  const trashApi = loadTrashApi(db, () => {
    saves++;
  });
  // ゴミ箱にあったメモを戻す
  assert(trashApi.restoreTrash("trash-memo"), "[notes trash] fixture note should restore");
  assertStrict.deepStrictEqual(
    db.notes.find((n) => n.id === "memo-0"),
    fixtures.notes.trash[0].data,
    "[notes trash] restored note keeps text, date, ts and tags",
  );
  // メモをゴミ箱へ移して戻す。本文は1文字も変わらない
  const target = db.notes.find((n) => n.id === "memo-1");
  const item = trashApi.trashItem("note", "メモ", target);
  db.notes = db.notes.filter((n) => n.id !== "memo-1");
  assertEqual(item.type, "note", "[notes trash] trash entry type");
  assert(!db.notes.some((n) => n.id === "memo-1"), "[notes trash] note leaves the list");
  assert(trashApi.restoreTrash(item.id), "[notes trash] restore should succeed");
  assertStrict.deepStrictEqual(
    db.notes.find((n) => n.id === "memo-1"),
    before.find((n) => n.id === "memo-1"),
    "[notes trash] note returns unchanged",
  );
  assert(!trashApi.restoreTrash(item.id), "[notes trash] second restore of same id should fail");
  assertEqual(saves, 2, "[notes trash] each restore saves once");
  // 練習（メモとタグつき）も同じ
  const sess = db.sessions[0];
  const sessItem = trashApi.trashItem("session", "練習", sess);
  db.sessions = [];
  assert(trashApi.restoreTrash(sessItem.id), "[notes trash] session restore should succeed");
  assertStrict.deepStrictEqual(db.sessions[0], sess, "[notes trash] session memo and tags return");
  // notes が無い古い db でも戻せる
  const legacy = { trash: [clone(fixtures.notes.trash[0])], sessions: [], sightMarks: [], setups: [], formAnalyses: [] };
  const legacyApi = loadTrashApi(legacy, () => {});
  assert(legacyApi.restoreTrash("trash-memo"), "[notes trash] restore into a db without notes");
  assertEqual(legacy.notes.length, 1, "[notes trash] notes array is created");
}

function checkDbRevContract() {
  assert(
    /^let DB_REV\s*=\s*0/m.test(storageScript),
    "[db-rev] storage script should declare let DB_REV",
  );
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
  checkSessionDateCoercion(storageApi);
  checkBadgeUnlockedAtCoercion(storageApi);
  checkGamificationEnabledDefault(storageApi);

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
  checkFormAnalysesV2(storageApi, fixtures);
  checkFormDiagnosticsCompatibility(storageApi, fixtures);
  checkCustomRoundsCompatibility(storageApi, fixtures);
  checkMultiRoundDefs(fixtures);
  checkNotesCompatibility(storageApi, fixtures);
  checkNoteTrashRestore(storageApi, fixtures);

  console.log("Storage contract checks OK");
}

try {
  main();
} catch (error) {
  console.error("Storage contract check failed:");
  console.error(error.message);
  process.exitCode = 1;
}
