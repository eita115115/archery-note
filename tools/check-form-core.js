"use strict";
/* 射形コア (scripts/46-form-core.js) の単体テスト。
   合成ランドマーク・合成時系列のみで検証する（カメラ・MediaPipe 不要）。
   フェーズ検出のケース（低速リリース検出 / レットダウン非誤検出 / 連続2射）は
   F1 実射検証で確定した仕様なので、しきい値変更時も必ず維持すること。 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const coreScript = fs.readFileSync(path.join(root, "scripts", "46-form-core.js"), "utf8");
const viewScript = fs.readFileSync(path.join(root, "scripts", "47-form-view.js"), "utf8");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}
function assertEqual(actual, expected, label) {
  assert(
    Object.is(actual, expected),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}
function assertClose(actual, expected, eps, label) {
  assert(
    Number.isFinite(actual) && Math.abs(actual - expected) <= eps,
    `${label}: expected ${expected} (±${eps}), got ${actual}`,
  );
}
function boundedSourceSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  assert(start >= 0, `${label}: start marker exists`);
  assertEqual(source.lastIndexOf(startMarker), start, `${label}: start marker is unique`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert(end > start, `${label}: ordered end marker exists`);
  return source.slice(start, end);
}
function compactSource(source) {
  return source.replace(/\s+/g, "");
}

const core = new Function(
  `${coreScript}
return {FORM_LM, FORM_REF, FORM_PH, FORM_PHASES, formGaussScore, formAngleDeg, formDist, formLineDist,
  formMedian, adaptiveAnchorThreshold, adaptiveReleaseThreshold,
  adaptiveReleaseCandidate:
    typeof adaptiveReleaseCandidate === "function" ? adaptiveReleaseCandidate : null,
  updateAdaptiveAnchorEvidence:
    typeof updateAdaptiveAnchorEvidence === "function" ? updateAdaptiveAnchorEvidence : null,
  computeFormMetrics, makeFormEma, makeFormPhaseDetector, stepFormPhase, computeFormVelocity,
  FORM_VEL_FILTER, makeFormVelocitySource,
  formPreReleaseWindow, formAnchorVariation, summarizeFormShot,
  formRecordStats, formRecordInsights, formTrendSeries, formScoreLink,
  ARROW_PRESENCE, arrowPresence, ARROW_CHECK, judgeArrowCheck};`,
)();

/* ---------- 幾何ヘルパー ---------- */

assertClose(
  core.formAngleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }),
  180,
  1e-9,
  "straight line angle",
);
assertClose(
  core.formAngleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }),
  90,
  1e-9,
  "right angle",
);
assertEqual(
  core.formAngleDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }),
  180,
  "degenerate angle defaults to 180",
);
assertClose(
  core.formLineDist({ x: 0.5, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }),
  1,
  1e-9,
  "point-segment distance",
);
assertClose(
  core.formLineDist({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }),
  1,
  1e-9,
  "distance clamps to segment end",
);
assertEqual(core.formMedian([]), null, "median of empty");
assertClose(core.formMedian([3, 1, 2]), 2, 1e-9, "odd median");
assertClose(core.formMedian([1, 2, 3, 4]), 2.5, 1e-9, "even median");
assertEqual(
  core.adaptiveAnchorThreshold([0.47, 0.48, 0.49, 0.5, 0.51]),
  0.35,
  "five anchor samples keep cold start",
);
assertEqual(
  core.adaptiveAnchorThreshold([0.47, NaN, 0.48, Infinity, 0.49, 0.5, 0.51]),
  0.35,
  "non-finite anchor samples do not satisfy the six-sample calibration gate",
);
assertClose(
  core.adaptiveAnchorThreshold([0.47, 0.48, 0.49, 0.5, 0.51, 0.52]),
  0.595,
  1e-9,
  "six samples start p10 calibration",
);
assertEqual(
  core.adaptiveAnchorThreshold([0.7, 0.71, 0.72, 0.73, 0.74, 0.75]),
  0.65,
  "anchor threshold is capped",
);
assertEqual(
  core.adaptiveAnchorThreshold([0, 0.01, 0.02, 0.03, 0.04, 0.05]),
  0.35,
  "anchor threshold respects the calibrated lower clamp",
);
assertEqual(
  core.adaptiveAnchorThreshold([0.47, NaN, 0.48, Infinity, 0.49, 0.5, 0.51, 0.52]),
  0.595,
  "anchor calibration filters non-finite samples and counts only finite values",
);
assertEqual(
  core.adaptiveReleaseThreshold([0.1, 0.2, 0.3, 0.4, 0.5]),
  6,
  "five velocity samples keep cold start",
);
assertEqual(
  core.adaptiveReleaseThreshold([0.1, NaN, 0.2, Infinity, 0.3, 0.4, 0.5]),
  6,
  "non-finite velocity samples do not satisfy the six-sample calibration gate",
);
assertEqual(
  core.adaptiveReleaseThreshold([7, 7, 7, 7, 7, 7]),
  8,
  "release speed is capped below legacy nine",
);
assertEqual(
  core.adaptiveReleaseThreshold([0.1, 0.2, 0.2, 0.3, 0.3, 7]),
  6,
  "single velocity outlier does not raise the floor",
);
assertClose(
  core.adaptiveReleaseThreshold([1, 2, 3, 4, 5, 6]),
  6.5,
  1e-9,
  "release speed uses an unclamped p90 result",
);
assertEqual(
  core.adaptiveReleaseThreshold([1, 2, 3, 4, 5, NaN, Infinity, 6]),
  6.5,
  "release calibration filters non-finite samples and counts only finite values",
);
{
  const anchorSamples = [0.52, 0.47, 0.5, 0.48, 0.51, 0.49];
  const velocitySamples = [6, 1, 5, 2, 4, 3];
  core.adaptiveAnchorThreshold(anchorSamples);
  core.adaptiveReleaseThreshold(velocitySamples);
  assertEqual(
    JSON.stringify(anchorSamples),
    JSON.stringify([0.52, 0.47, 0.5, 0.48, 0.51, 0.49]),
    "anchor calibration does not mutate unsorted input",
  );
  assertEqual(
    JSON.stringify(velocitySamples),
    JSON.stringify([6, 1, 5, 2, 4, 3]),
    "release calibration does not mutate unsorted input",
  );
}
{
  const first = core.makeFormPhaseDetector();
  const second = core.makeFormPhaseDetector();
  assert(first.adaptive && second.adaptive, "detectors include adaptive state");
  assert(first.adaptive !== second.adaptive, "detectors have distinct adaptive objects");
  assert(
    first.adaptive.anchorSamples !== second.adaptive.anchorSamples,
    "anchor arrays are detector-local",
  );
  assert(
    first.adaptive.holdSamples !== second.adaptive.holdSamples,
    "hold arrays are detector-local",
  );
  assert(
    first.adaptive.holdVelocitySamples !== second.adaptive.holdVelocitySamples,
    "velocity arrays are detector-local",
  );
  assertEqual(first.adaptive.holdBreakTs, null, "adaptive learning barrier starts inactive");
  const initial = core.stepFormPhase(first, null, [], 1, 100);
  assertEqual(initial.debug.refractoryRemaining, 0, "no-prior-fire refractory starts at zero");
}
assertEqual(
  core.formGaussScore(core.FORM_REF.bowArmAngle.ideal, core.FORM_REF.bowArmAngle),
  100,
  "gauss peak at ideal",
);
assert(
  core.formGaussScore(120, core.FORM_REF.bowArmAngle) < 5,
  "gauss far from ideal is near zero",
);

/* ---------- computeFormMetrics（合成フルドロー姿勢・右利き） ---------- */

function fullDrawLandmarks() {
  const P = (x, y, v) => ({ x, y, visibility: v == null ? 0.95 : v });
  const l = [];
  l[0] = P(0.52, 0.3); // 鼻
  l[11] = P(0.45, 0.4);
  l[12] = P(0.55, 0.42); // 肩 L/R
  l[13] = P(0.32, 0.41);
  l[14] = P(0.62, 0.4); // 肘 L/R
  l[15] = P(0.2, 0.4);
  l[16] = P(0.56, 0.32); // 手首 L(弓手伸展)/R(顎アンカー: 鼻から約0.2胴体長)
  l[23] = P(0.47, 0.62);
  l[24] = P(0.53, 0.62); // 腰 L/R
  return l;
}

{
  const m = core.computeFormMetrics(fullDrawLandmarks(), "right");
  assert(m, "metrics computed");
  assertClose(m.bowArm, 170.8, 0.5, "bow arm angle near extension");
  assert(
    m.anchorNorm < core.FORM_PH.CLOSE_IN,
    `full draw is inside anchor zone, got ${m.anchorNorm}`,
  );
  assert(m.bodyScale > 0.15 && m.bodyScale < 0.35, `plausible torso scale, got ${m.bodyScale}`);
  assert(m.sc.bow > 90, `bow arm score high, got ${m.sc.bow}`);
  assert(m.score > 0 && m.score <= 100, "composite score in range");
  assert(m.conf > 0.9, "confidence from visibilities");
  assertEqual(m.occluded.length, 0, "no occlusion in synthetic pose");
}
{
  // 左利き: 腕の割り当てが入れ替わる（同じ姿勢なら弓手角度が変わる）
  const r = core.computeFormMetrics(fullDrawLandmarks(), "right");
  const lft = core.computeFormMetrics(fullDrawLandmarks(), "left");
  assert(Math.abs(r.bowArm - lft.bowArm) > 10, "handedness swaps arm roles");
}
{
  // 欠損・低可視性
  assertEqual(core.computeFormMetrics(null, "right"), null, "null landmarks");
  assertEqual(core.computeFormMetrics([], "right"), null, "empty landmarks");
  const l = fullDrawLandmarks();
  l[13].visibility = 0.3; // 弓側肘（右利き時は LEFT_ELBOW）
  const m = core.computeFormMetrics(l, "right");
  assert(m.occluded.includes("弓側肘"), "low-visibility joint reported");
  const missing = fullDrawLandmarks();
  delete missing[23];
  assertEqual(core.computeFormMetrics(missing, "right"), null, "missing hip returns null");
}

/* ---------- EMA ---------- */

{
  const ema = core.makeFormEma(0.5);
  const m1 = { bowArm: 100, drawArm: 100, score: 100, conf: 1 };
  const m2 = { bowArm: 200, drawArm: 200, score: 0, conf: 0 };
  assertEqual(ema(m1).bowArm, 100, "EMA first value passes through");
  assertClose(ema(m2).bowArm, 150, 1e-9, "EMA smooths");
  assertEqual(ema(null), null, "EMA of null");
}

/* ---------- フェーズ検出（F1 実射検証で確定した3ケース） ---------- */

const mkRaw = (anchorNorm, drawArm) => ({
  anchorNorm,
  drawArm,
  bodyScale: 0.25,
  dW: { x: 0, y: 0 },
});

function runSequence(seq, coreObj) {
  const c = coreObj || core;
  const st = c.makeFormPhaseDetector();
  const hist = [];
  let t = 0,
    phases = [],
    releases = 0,
    fireEvidence = [];
  for (const [m, vel, dt] of seq) {
    t += dt;
    hist.push({ ts: t, m, vel });
    if (hist.length > 150) hist.shift();
    const r = c.stepFormPhase(st, m, hist, 1.0, t);
    phases.push(r.phase);
    if (r.released) {
      releases++;
      fireEvidence.push(r.debug.fireEvidence);
    }
  }
  return { phases: [...new Set(phases)], releases, fireEvidence, hist, lastTs: t };
}

function adaptiveStepper(dt, coreObj) {
  const c = coreObj || core;
  const st = c.makeFormPhaseDetector();
  const hist = [];
  let t = 0;
  return {
    st,
    hist,
    push(m, vel, elapsed) {
      t += elapsed == null ? dt : elapsed;
      hist.push({ ts: t, m, vel });
      if (hist.length > 150) hist.shift();
      return { r: c.stepFormPhase(st, m, hist, 1.0, t), t };
    },
  };
}

function assertAdaptiveResultShape(result, label) {
  assert(Number.isFinite(result.anchorEnter), `${label}: top-level anchorEnter is numeric`);
  assert(result.debug && typeof result.debug === "object", `${label}: debug exists`);
  ["anchorFloor", "anchorEnter", "releaseSpeed", "evidenceAgeMs", "evidenceStrength"].forEach(
    (key) => assert(key in result.debug, `${label}: debug has ${key}`),
  );
  assert(Number.isFinite(result.debug.anchorEnter), `${label}: debug anchorEnter is numeric`);
  assert(Number.isFinite(result.debug.releaseSpeed), `${label}: debug releaseSpeed is numeric`);
}

/* ---------- Task 3: relative adaptive release candidates ---------- */

function adaptiveFieldProfile({ anchor, releaseNorm, releaseVel }) {
  const seq = [];
  for (let i = 0; i < 12; i++) seq.push([mkRaw(1.35 - i * 0.07, 110 + i * 3), 0.5, 20]);
  for (let i = 0; i < 30; i++)
    seq.push([mkRaw(anchor + (i % 3) * 0.005, 150), i === 9 ? 7 : 0.2, 20]);
  seq.push([mkRaw(releaseNorm, 140), releaseVel, 20]);
  for (let i = 0; i < 60; i++) seq.push([mkRaw(1.0, 90), 0.1, 20]);
  return seq;
}

function adaptiveConfirmationFixture() {
  const st = core.makeFormPhaseDetector();
  const history = [];
  const stats = {
    grossReleases: 0,
    cancellations: 0,
    netReleases: 0,
    cancelReasons: [],
    cancelTimestamps: [],
  };
  let now = 0;
  let fire = null;
  const push = (raw, vel, elapsed) => {
    now += elapsed;
    history.push({ ts: now, m: raw, vel });
    if (history.length > 150) history.shift();
    const result = core.stepFormPhase(st, raw, history, 1, now);
    if (result.released) {
      stats.grossReleases++;
      stats.netReleases++;
      fire = { result, now, pending: { ...st.pendingRelease } };
    }
    if (result.canceled) {
      stats.cancellations++;
      stats.netReleases--;
      stats.cancelReasons.push(result.debug && result.debug.cancelReason);
      stats.cancelTimestamps.push(now);
    }
    return { result, now };
  };
  adaptiveFieldProfile({ anchor: 0.47, releaseNorm: 0.75, releaseVel: 18.4 })
    .slice(0, 43)
    .forEach(([raw, vel, elapsed]) => push(raw, vel, elapsed));
  assert(fire, "adaptive confirmation fixture starts from a real fire");
  assertEqual(fire.now, 860, "adaptive confirmation fixture fires at t=860");
  assertEqual(
    fire.result.debug.fireEvidence,
    "adaptive",
    "confirmation fixture uses adaptive fire",
  );
  assertClose(fire.pending.anchorEnter, 0.59, 1e-12, "fixture stores fire-time anchorEnter=.59");
  assertEqual(stats.grossReleases, 1, "fixture tracks the shown release as +1");
  return {
    st,
    history,
    stats,
    fire,
    push,
    get now() {
      return now;
    },
  };
}

{
  const adaptiveFire = adaptiveConfirmationFixture().fire.result;
  assertEqual(
    adaptiveFire.debug.fireEvidence,
    "adaptive",
    "genuine adaptive fire identifies its evidence route",
  );
  [
    "anchorFloor",
    "anchorEnter",
    "releaseSpeed",
    "evidenceAgeMs",
    "evidenceStrength",
    "departDelta",
  ].forEach((key) =>
    assert(Number.isFinite(adaptiveFire.debug[key]), `genuine adaptive fire has finite ${key}`),
  );
}

{
  const profileA = runSequence(
    adaptiveFieldProfile({ anchor: 0.47, releaseNorm: 0.75, releaseVel: 18.4 }),
  );
  const profileB = runSequence(
    adaptiveFieldProfile({ anchor: 0.18, releaseNorm: 0.5, releaseVel: 8.5 }),
  );
  const profileC = runSequence(
    adaptiveFieldProfile({ anchor: 0.46, releaseNorm: 0.74, releaseVel: 12.8 }),
  );
  const sixShot = runSequence(
    Array.from({ length: 6 }, () =>
      adaptiveFieldProfile({ anchor: 0.47, releaseNorm: 0.75, releaseVel: 18.4 }),
    ).flat(),
  );
  assert(
    profileA.releases === 1 &&
      profileB.releases === 1 &&
      profileC.releases === 1 &&
      sixShot.releases === 6,
    `adaptive field receipts A/B/C=${profileA.releases}/${profileB.releases}/${profileC.releases}, six-shot=${sixShot.releases}`,
  );
  assertEqual(profileA.fireEvidence[0], "adaptive", "profile A uses adaptive evidence");
  assertEqual(profileB.fireEvidence[0], "adaptive", "profile B uses adaptive evidence");
  assertEqual(profileC.fireEvidence[0], "adaptive", "profile C uses adaptive evidence");
  assertEqual(
    JSON.stringify(sixShot.fireEvidence),
    JSON.stringify(Array(6).fill("adaptive")),
    "six-shot end reports six adaptive evidence labels",
  );
}

assert(core.adaptiveReleaseCandidate, "adaptive release candidate helper is exported to tests");
assertEqual(
  core.adaptiveReleaseCandidate.length,
  4,
  "adaptive release candidate has exact arity four",
);

function adaptiveCandidateFixture({
  evidence = {
    ts: 0,
    normAtHold: 0.47,
    anchorEnter: 0.59,
    releaseSpeed: 6,
    strength: 12,
  },
  currentNorm = 0.66,
  priorNorms = [0.61, 0.62, 0.63],
  now = 1000,
  currentVel = 6,
} = {}) {
  const raw = mkRaw(currentNorm, 140);
  const history = priorNorms.map((norm, index) => ({
    ts: now - (priorNorms.length - index) * 50,
    m: mkRaw(norm, 140),
    vel: 0.2,
  }));
  history.push({ ts: now, m: raw, vel: currentVel });
  return { evidence, raw, history, now };
}

{
  const below = adaptiveCandidateFixture({ currentNorm: 0.65, priorNorms: [0.61, 0.62, 0.63] });
  const exact = adaptiveCandidateFixture({
    currentNorm: 0.66,
    priorNorms: [0.61, 0.62, 0.63],
  });
  assertEqual(
    core.adaptiveReleaseCandidate(below.evidence, below.raw, below.history, below.now).matched,
    false,
    "direction delta +0.03 does not match",
  );
  const exactDecision = core.adaptiveReleaseCandidate(
    exact.evidence,
    exact.raw,
    exact.history,
    exact.now,
  );
  assertEqual(exactDecision.matched, true, "direction delta exactly +0.04 matches");
  assertEqual(exactDecision.movingAway, true, "direction equality is moving away");
  assertClose(exactDecision.departDelta, 0.19, 1e-12, "relative departure is reported");
  assertEqual(exactDecision.maxV, 6, "speed equality is included");
  assertEqual(exactDecision.releaseSpeed, 6, "snapshotted release speed is reported");
  assertEqual(
    JSON.stringify(Object.keys(exactDecision)),
    JSON.stringify(["matched", "departDelta", "movingAway", "maxV", "releaseSpeed"]),
    "candidate has the fixed decision shape",
  );
}
{
  const exactDeparture = adaptiveCandidateFixture({
    currentNorm: 0.65,
    priorNorms: [0.59, 0.61, 0.63],
  });
  assertEqual(
    core.adaptiveReleaseCandidate(
      exactDeparture.evidence,
      exactDeparture.raw,
      exactDeparture.history,
      exactDeparture.now,
    ).matched,
    true,
    "departure delta exactly +0.18 is included",
  );
  const belowDeparture = adaptiveCandidateFixture({
    currentNorm: 0.64,
    priorNorms: [0.58, 0.6, 0.62],
  });
  const belowDepartureDecision = core.adaptiveReleaseCandidate(
    belowDeparture.evidence,
    belowDeparture.raw,
    belowDeparture.history,
    belowDeparture.now,
  );
  assertEqual(belowDepartureDecision.movingAway, true, "departure-negative control has direction");
  assertEqual(belowDepartureDecision.maxV, 6, "departure-negative control has enough speed");
  assertClose(
    belowDepartureDecision.departDelta,
    0.17,
    1e-12,
    "departure-negative control isolates delta 0.17",
  );
  assertEqual(belowDepartureDecision.matched, false, "departure delta 0.17 alone is insufficient");
}
{
  const far = adaptiveCandidateFixture({
    evidence: { ts: 0, normAtHold: 1.03, releaseSpeed: 6 },
    currentNorm: 1.21,
    priorNorms: [1.15, 1.17, 1.19],
  });
  assertEqual(
    core.adaptiveReleaseCandidate(far.evidence, far.raw, far.history, far.now).matched,
    false,
    "current frame above the far boundary cannot be an adaptive candidate",
  );
  const boundary = adaptiveCandidateFixture({
    evidence: { ts: 0, normAtHold: 1.02, releaseSpeed: 6 },
    currentNorm: 1.2,
    priorNorms: [1.14, 1.16, 1.18],
  });
  assertEqual(
    core.adaptiveReleaseCandidate(boundary.evidence, boundary.raw, boundary.history, boundary.now)
      .matched,
    true,
    "current frame exactly at the far boundary remains eligible",
  );
}
{
  const hugeVelocity = adaptiveCandidateFixture({
    currentNorm: 0.57,
    priorNorms: [0.51, 0.53, 0.55],
    currentVel: 1e16,
  });
  const hugeVelocityDecision = core.adaptiveReleaseCandidate(
    hugeVelocity.evidence,
    hugeVelocity.raw,
    hugeVelocity.history,
    hugeVelocity.now,
  );
  assertEqual(hugeVelocityDecision.movingAway, true, "huge-velocity probe has enough direction");
  assertClose(
    hugeVelocityDecision.departDelta,
    0.1,
    1e-12,
    "huge-velocity probe isolates insufficient departure",
  );
  assertEqual(
    hugeVelocityDecision.matched,
    false,
    "unrelated huge maxV cannot loosen the departure comparison",
  );

  const hugeDeparture = adaptiveCandidateFixture({
    evidence: { ts: 0, normAtHold: -1e15, releaseSpeed: 6 },
    currentNorm: 1.2,
    priorNorms: [1.08, 1.1, 1.12],
    currentVel: 5.9,
  });
  const hugeDepartureDecision = core.adaptiveReleaseCandidate(
    hugeDeparture.evidence,
    hugeDeparture.raw,
    hugeDeparture.history,
    hugeDeparture.now,
  );
  assert(
    Number.isFinite(hugeDepartureDecision.departDelta) && hugeDepartureDecision.departDelta > 1e14,
    "huge-departure probe has a finite passing departure",
  );
  assertEqual(hugeDepartureDecision.movingAway, true, "huge-departure probe has enough direction");
  assertEqual(hugeDepartureDecision.maxV, 5.9, "huge-departure probe isolates speed 5.9");
  assertEqual(hugeDepartureDecision.releaseSpeed, 6, "huge-departure probe requires speed six");
  assertEqual(
    hugeDepartureDecision.matched,
    false,
    "unrelated huge departure cannot loosen the speed comparison",
  );

  const overflow = adaptiveCandidateFixture({
    evidence: { ts: 0, normAtHold: -Number.MAX_VALUE, releaseSpeed: 6 },
    currentNorm: Number.MAX_VALUE,
    priorNorms: [0.61, 0.62, 0.63],
  });
  const overflowDecision = core.adaptiveReleaseCandidate(
    overflow.evidence,
    overflow.raw,
    overflow.history,
    overflow.now,
  );
  assertEqual(overflowDecision.departDelta, null, "overflowed departure diagnostic is unknown");
  assertEqual(overflowDecision.matched, false, "overflowed finite-input subtraction is rejected");
}
{
  const atWindow = adaptiveCandidateFixture({ now: 1500 });
  atWindow.history[0].ts = 1250;
  atWindow.history[0].vel = 6;
  atWindow.history[atWindow.history.length - 1].vel = 0;
  assertEqual(
    core.adaptiveReleaseCandidate(atWindow.evidence, atWindow.raw, atWindow.history, atWindow.now)
      .matched,
    true,
    "evidence age and velocity-window start are inclusive at 1500ms and 250ms",
  );
  const expired = adaptiveCandidateFixture({ now: 1501 });
  assertEqual(
    core.adaptiveReleaseCandidate(expired.evidence, expired.raw, expired.history, expired.now)
      .matched,
    false,
    "evidence expires at 1501ms",
  );
  const future = adaptiveCandidateFixture({
    evidence: { ts: 1001, normAtHold: 0.47, releaseSpeed: 6 },
  });
  assertEqual(
    core.adaptiveReleaseCandidate(future.evidence, future.raw, future.history, future.now).matched,
    false,
    "future evidence is rejected",
  );
}
{
  [
    null,
    {},
    { ts: NaN, normAtHold: 0.47, releaseSpeed: 6 },
    { ts: 0, normAtHold: Infinity, releaseSpeed: 6 },
    { ts: 0, normAtHold: 0.47, releaseSpeed: 0 },
    { ts: 0, normAtHold: 0.47, releaseSpeed: Infinity },
  ].forEach((evidence, index) => {
    const fixture = adaptiveCandidateFixture({ evidence });
    const decision = core.adaptiveReleaseCandidate(
      fixture.evidence,
      fixture.raw,
      fixture.history,
      fixture.now,
    );
    assertEqual(decision.matched, false, `malformed evidence ${index} is rejected`);
    assertEqual(
      typeof decision.movingAway,
      "boolean",
      `malformed evidence ${index} has boolean direction`,
    );
  });
  const missingCurrent = adaptiveCandidateFixture();
  assertEqual(
    core.adaptiveReleaseCandidate(
      missingCurrent.evidence,
      null,
      missingCurrent.history,
      missingCurrent.now,
    ).matched,
    false,
    "null current frame cannot match",
  );
}
{
  const fewer = adaptiveCandidateFixture({ priorNorms: [0.61, 0.63] });
  assertEqual(
    core.adaptiveReleaseCandidate(fewer.evidence, fewer.raw, fewer.history, fewer.now).movingAway,
    false,
    "fewer than three prior observations cannot establish direction",
  );

  const currentExcluded = adaptiveCandidateFixture({ priorNorms: [0.61, 0.63] });
  currentExcluded.history.splice(
    2,
    0,
    { ts: currentExcluded.now, m: mkRaw(0.2, 140), vel: 20 },
    { ts: currentExcluded.now, m: mkRaw(0.2, 140), vel: 20 },
  );
  assertEqual(
    core.adaptiveReleaseCandidate(
      currentExcluded.evidence,
      currentExcluded.raw,
      currentExcluded.history,
      currentExcluded.now,
    ).movingAway,
    false,
    "all current-timestamp entries are excluded from direction history",
  );

  const chronologyCases = [
    [
      { ts: 700, m: mkRaw(0.61, 140), vel: 6 },
      { ts: 800, m: mkRaw(0.62, 140), vel: 0.2 },
      { ts: 800, m: mkRaw(0.63, 140), vel: 0.2 },
    ],
    [
      { ts: 850, m: mkRaw(0.61, 140), vel: 6 },
      { ts: 800, m: mkRaw(0.62, 140), vel: 0.2 },
      { ts: 900, m: mkRaw(0.63, 140), vel: 0.2 },
    ],
    [
      { ts: 700, m: mkRaw(0.61, 140), vel: 6 },
      { ts: 800, m: mkRaw(0.62, 140), vel: 0.2 },
      { ts: 900, m: mkRaw(0.63, 140), vel: 0.2 },
      { ts: 1100, m: mkRaw(0.64, 140), vel: 0.2 },
    ],
  ];
  chronologyCases.forEach((history, index) => {
    const fixture = adaptiveCandidateFixture();
    history.push({ ts: fixture.now, m: fixture.raw, vel: 6 });
    assertEqual(
      core.adaptiveReleaseCandidate(fixture.evidence, fixture.raw, history, fixture.now).movingAway,
      false,
      `chronology barrier ${index} prevents direction evidence`,
    );
  });
}
{
  const fixture = adaptiveCandidateFixture();
  fixture.history[0].vel = NaN;
  fixture.history[1].vel = Infinity;
  fixture.history[2].vel = -1;
  fixture.history[3].vel = 6;
  const before = JSON.stringify({
    evidence: fixture.evidence,
    raw: fixture.raw,
    history: fixture.history.map((entry) => ({
      ts: entry.ts,
      m: entry.m,
      vel: Number.isFinite(entry.vel) ? entry.vel : String(entry.vel),
    })),
  });
  const decision = core.adaptiveReleaseCandidate(
    fixture.evidence,
    fixture.raw,
    fixture.history,
    fixture.now,
  );
  assertEqual(decision.maxV, 6, "maxV ignores non-finite and negative velocities");
  const after = JSON.stringify({
    evidence: fixture.evidence,
    raw: fixture.raw,
    history: fixture.history.map((entry) => ({
      ts: entry.ts,
      m: entry.m,
      vel: Number.isFinite(entry.vel) ? entry.vel : String(entry.vel),
    })),
  });
  assertEqual(after, before, "candidate does not mutate its inputs");

  fixture.history[fixture.history.length - 1].vel = -1;
  assertEqual(
    core.adaptiveReleaseCandidate(fixture.evidence, fixture.raw, fixture.history, fixture.now).maxV,
    null,
    "maxV is unknown when no finite nonnegative velocity exists",
  );
}
{
  const gatedCandidate = new Function(
    `${coreScript
      .replace("CONF_GATE: 0,", "CONF_GATE: 0.5,")
      .replace("DW_VIS_GATE: 0,", "DW_VIS_GATE: 0.5,")}
return adaptiveReleaseCandidate;`,
  )();
  const fixture = adaptiveCandidateFixture();
  const lowConfidenceCurrent = {
    ...fixture.raw,
    conf: 0.4,
  };
  assertEqual(
    gatedCandidate(fixture.evidence, lowConfidenceCurrent, fixture.history, fixture.now).matched,
    false,
    "confidence-unusable current frame cannot match",
  );
  const gatedHistory = [
    { ts: 700, m: { ...mkRaw(0.61, 140), conf: 0.9 }, vel: 0.2 },
    { ts: 750, m: { ...mkRaw(0.1, 140), conf: 0.4 }, vel: 20 },
    { ts: 800, m: { ...mkRaw(0.62, 140), conf: 0.9 }, vel: 0.2 },
    { ts: 850, m: null, vel: 20 },
    { ts: 900, m: { ...mkRaw(0.63, 140), conf: 0.9 }, vel: 0.2 },
    {
      ts: 1000,
      m: { ...fixture.raw, conf: 0.9, dW: { x: 0, y: 0, visibility: 0.9 } },
      vel: 6,
    },
  ];
  assertEqual(
    gatedCandidate(fixture.evidence, gatedHistory[5].m, gatedHistory, fixture.now).matched,
    true,
    "direction skips null and confidence-unusable entries",
  );
  gatedHistory[5].m.dW.visibility = 0.5;
  assertEqual(
    gatedCandidate(fixture.evidence, gatedHistory[5].m, gatedHistory, fixture.now).maxV,
    0.2,
    "maxV applies the strict dW visibility gate",
  );
}
{
  const traceAdaptive = (seq) => {
    const st = core.makeFormPhaseDetector();
    const history = [];
    let now = 0;
    const fires = [];
    for (const [raw, vel, elapsed] of seq) {
      now += elapsed;
      history.push({ ts: now, m: raw, vel });
      if (history.length > 150) history.shift();
      const result = core.stepFormPhase(st, raw, history, 1, now);
      if (result.released) fires.push({ result, now, pending: { ...st.pendingRelease } });
    }
    return { st, history, now, fires };
  };

  const a = traceAdaptive(
    adaptiveFieldProfile({ anchor: 0.47, releaseNorm: 0.75, releaseVel: 18.4 }),
  );
  assertEqual(a.fires.length, 1, "initial detector state can fire profile A at t=860");
  assertEqual(a.fires[0].now, 860, "first adaptive fire keeps the unoffset field timing");
  assertEqual(a.fires[0].result.debug.fireEvidence, "adaptive", "adaptive fire wins diagnostics");
  assertEqual(
    a.fires[0].result.debug.fireVel,
    null,
    "adaptive-only fire has no legacy velocity route",
  );
  assertClose(a.fires[0].result.debug.departDelta, 0.275, 1e-12, "fire reports relative departure");
  assert(
    Number.isFinite(a.fires[0].result.debug.evidenceAgeMs),
    "fire result retains evidence age after committed-state clear",
  );
  assert(
    Number.isFinite(a.fires[0].result.debug.evidenceStrength),
    "fire result retains evidence strength after committed-state clear",
  );

  const bSeq = adaptiveFieldProfile({ anchor: 0.18, releaseNorm: 0.5, releaseVel: 8.5 });
  const b = traceAdaptive(bSeq);
  assertEqual(b.fires.length, 1, "profile B fires below the legacy speed threshold");
  assertEqual(b.fires[0].result.debug.releaseSpeed, 6, "hold outlier leaves release speed at six");
  assertEqual(b.fires[0].result.debug.maxV, 8.5, "profile B fire observes maxV 8.5");

  const slow = runSequence(
    adaptiveFieldProfile({ anchor: 0.47, releaseNorm: 0.75, releaseVel: 5.9 }),
  );
  assertEqual(slow.releases, 0, "slow let-down below adaptive speed six does not fire");

  const repeated = adaptiveFieldProfile({
    anchor: 0.47,
    releaseNorm: 0.75,
    releaseVel: 18.4,
  });
  repeated.splice(
    43,
    0,
    [mkRaw(0.8, 140), 18.4, 20],
    [mkRaw(0.85, 140), 18.4, 20],
    [mkRaw(0.9, 140), 18.4, 20],
  );
  assertEqual(
    runSequence(repeated).releases,
    1,
    "repeated matching departure frames inside one second count once",
  );

  const precedence = traceAdaptive(
    adaptiveFieldProfile({ anchor: 0.18, releaseNorm: 0.5, releaseVel: 10 }),
  );
  const precedenceFire = precedence.fires[0].result;
  const precedencePending = precedence.fires[0].pending;
  assertEqual(
    precedenceFire.debug.fireEvidence,
    "adaptive",
    "adaptive match precedes legacy match",
  );
  assertEqual(precedenceFire.debug.fireVel, null, "adaptive precedence does not invent fireVel");
  assertEqual(precedencePending.fireEvidence, "adaptive", "pending snapshots fire evidence");
  assertEqual(
    precedencePending.anchorEnter,
    precedenceFire.anchorEnter,
    "pending snapshots fire-time anchor threshold",
  );
  assertEqual(precedencePending.releaseSpeed, 6, "pending snapshots adaptive release speed");
  assertEqual(precedencePending.nb2Ref, null, "adaptive-selected fire never gets NB2 ref");
  assertEqual(
    precedencePending.departCheck,
    false,
    "adaptive pending skips departure confirmation",
  );
  assertEqual(precedencePending.returnSince, 0, "adaptive pending starts with no return timer");
  assertEqual(precedencePending.returnCount, 0, "adaptive pending starts with no return frames");
  assertEqual(precedence.st.adaptive.evidence, null, "committed fire clears adaptive evidence");

  const legacy = traceAdaptive([
    ...Array.from({ length: 10 }, () => [mkRaw(1.2, 100), 0.1, 20]),
    [mkRaw(0.22, 150), 0.2, 20],
    [mkRaw(0.22, 150), 0.2, 20],
    [mkRaw(0.6, 140), 10, 20],
  ]);
  assertEqual(
    legacy.fires[0].pending.fireEvidence,
    "close",
    "legacy pending snapshots close evidence",
  );
  assertEqual(
    legacy.fires[0].pending.releaseSpeed,
    null,
    "legacy pending release speed stays null",
  );

  const blocked = adaptiveStepper(20);
  for (let i = 0; i < 55; i++) blocked.push(mkRaw(1.0, 90), 0.1);
  for (let i = 0; i < 30; i++) blocked.push(mkRaw(0.47 + (i % 3) * 0.005, 150), 0.2);
  const evidenceBefore = blocked.st.adaptive.evidence;
  blocked.st.lastReleaseTs = 641;
  const blockedDeparture = blocked.push(mkRaw(0.75, 140), 18.4);
  assertEqual(blockedDeparture.r.released, false, "FOLLOW lock blocks a matching candidate");
  assertEqual(
    blocked.st.adaptive.evidence,
    evidenceBefore,
    "blocked matching candidate does not clear adaptive evidence",
  );
}

/* ---------- Task 4: adaptive-only post-fire cancellation ---------- */

{
  const fixture = adaptiveConfirmationFixture();
  for (let elapsed = 50; elapsed <= 400; elapsed += 50) {
    const current = fixture.push(null, 0, 50);
    assertEqual(current.result.canceled, undefined, `null at +${elapsed}ms does not cancel`);
    assertEqual(
      fixture.st.pendingRelease.returnSince,
      0,
      "null does not start adaptive return time",
    );
    assertEqual(
      fixture.st.pendingRelease.returnCount,
      0,
      "null does not add an adaptive return frame",
    );
  }
  const afterWindow = fixture.push(mkRaw(1.0, 90), 0.1, 1);
  assertEqual(afterWindow.now, 1261, "first usable frame arrives at fire+401ms");
  assertEqual(fixture.st.pendingRelease, null, "first usable frame after +400 clears pending");
  assertEqual(fixture.stats.netReleases, 1, "all-null confirmation keeps the shown shot");
  assertEqual(fixture.stats.cancellations, 0, "all-null confirmation records no cancellation");
  assertEqual(
    fixture.stats.cancelReasons.includes("no-depart"),
    false,
    "all-null adaptive confirmation never produces no-depart",
  );
}
{
  const fixture = adaptiveConfirmationFixture();
  let fourth = null;
  for (let i = 0; i < 4; i++) {
    const current = fixture.push(mkRaw(0.47, 150), 0.1, 50);
    if (i < 3)
      assertEqual(current.result.canceled, undefined, `adaptive return frame ${i + 1} survives`);
    else fourth = current;
  }
  assertEqual(fourth.result.canceled, true, "fourth return frame at a 150ms span cancels");
  assertEqual(
    fourth.result.debug.cancelReason,
    "anchor-return",
    "adaptive return reason is auditable",
  );
  assertEqual(fixture.stats.grossReleases, 1, "valid return retains one gross receipt");
  assertEqual(fixture.stats.cancellations, 1, "valid return cancels exactly once");
  assertEqual(fixture.stats.netReleases, 0, "valid return removes the shown shot");
  assertEqual(
    JSON.stringify(fixture.stats.cancelTimestamps),
    JSON.stringify([1060]),
    "valid return cancellation occurs at t=1060",
  );
  assertEqual(
    fourth.result.anchorStartTs,
    fourth.now,
    "adaptive cancel restarts sticky anchor time",
  );
  assertEqual(fixture.st.anchorStartTs, fourth.now, "adaptive cancel stores sticky anchor time");
  assertEqual(fixture.st.anchorSince, fourth.now, "adaptive cancel restarts anchorSince");
  assertEqual(fixture.st.lastReleaseTs, fourth.now - 750, "adaptive cancel applies 250ms cooldown");
  assertEqual(
    fourth.result.debug.refractoryRemaining,
    800,
    "adaptive cancel debug captures refractory before cooldown rewrite",
  );
}
{
  const fixture = adaptiveConfirmationFixture();
  let atBoundary = null;
  [250, 50, 50, 50].forEach((elapsed, index) => {
    const current = fixture.push(mkRaw(0.47, 150), 0.1, elapsed);
    if (index < 3)
      assertEqual(
        current.result.canceled,
        undefined,
        `adaptive fire+400 return frame ${index + 1} survives`,
      );
    else atBoundary = current;
  });
  assertEqual(atBoundary.now, fixture.fire.now + 400, "adaptive return completes at fire+400");
  assertEqual(atBoundary.result.canceled, true, "adaptive return can cancel at exact fire+400");
  assertEqual(
    atBoundary.result.debug.cancelReason,
    "anchor-return",
    "fire+400 cancellation reason is anchor-return",
  );
  assertEqual(fixture.stats.cancellations, 1, "fire+400 return cancels exactly once");
  assertEqual(fixture.stats.netReleases, 0, "fire+400 return removes the shown shot");
  assertEqual(fixture.st.pendingRelease, null, "fire+400 cancellation clears pending");
  assertEqual(
    JSON.stringify(fixture.stats.cancelTimestamps),
    JSON.stringify([fixture.fire.now + 400]),
    "fire+400 cancellation timestamp is exact",
  );
}
{
  const fixture = adaptiveConfirmationFixture();
  fixture.st.adaptive.anchorSamples = Array.from({ length: 6 }, (_, i) => ({
    ts: fixture.now - i,
    norm: 0.2,
  }));
  fixture.st.adaptive.anchorEnter = core.adaptiveAnchorThreshold(
    fixture.st.adaptive.anchorSamples.map((sample) => sample.norm),
  );
  assertEqual(
    fixture.st.adaptive.anchorEnter,
    0.35,
    "live threshold can recompute to .35 after fire",
  );
  for (let i = 0; i < 4; i++) fixture.push(mkRaw(0.47, 150), 0.1, 50);
  assertEqual(
    fixture.stats.cancelReasons[0],
    "anchor-return",
    "return uses stored .59 boundary instead of live .35",
  );
  assertEqual(fixture.stats.netReleases, 0, "stored fire-time boundary cancels the return");
}
{
  const fixture = adaptiveConfirmationFixture();
  const first = fixture.push(mkRaw(0.47, 150), 0.1, 401);
  assertEqual(
    first.result.canceled,
    undefined,
    "return beginning at +401ms is outside confirmation",
  );
  for (let i = 0; i < 3; i++) fixture.push(mkRaw(0.47, 150), 0.1, 50);
  assertEqual(fixture.stats.netReleases, 1, "late four-frame return keeps the shown shot");
  assertEqual(fixture.stats.cancellations, 0, "late return never cancels");
}
{
  const threeFrames = adaptiveConfirmationFixture();
  [50, 75, 75].forEach((elapsed) => threeFrames.push(mkRaw(0.47, 150), 0.1, elapsed));
  assertEqual(threeFrames.st.pendingRelease.returnCount, 3, "three return frames are counted");
  assertEqual(threeFrames.stats.netReleases, 1, "three frames spanning 150ms do not cancel");

  const shortSpan = adaptiveConfirmationFixture();
  [50, 49, 50, 50].forEach((elapsed) => shortSpan.push(mkRaw(0.47, 150), 0.1, elapsed));
  assertEqual(
    shortSpan.st.pendingRelease.returnCount,
    4,
    "four short-span return frames are counted",
  );
  assertEqual(shortSpan.stats.netReleases, 1, "four frames spanning 149ms do not cancel");
}
{
  const fixture = adaptiveConfirmationFixture();
  fixture.push(mkRaw(0.47, 150), 0.1, 50);
  const beforeNull = { ...fixture.st.pendingRelease };
  fixture.push(null, 0, 50);
  assertEqual(
    fixture.st.pendingRelease.returnSince,
    beforeNull.returnSince,
    "null keeps the adaptive return timestamp",
  );
  assertEqual(
    fixture.st.pendingRelease.returnCount,
    beforeNull.returnCount,
    "null keeps the adaptive return count",
  );
  fixture.push(mkRaw(0.47, 150), 0.1, 50);
  fixture.push(mkRaw(0.62, 150), 0.1, 50);
  assertEqual(fixture.st.pendingRelease.returnSince, 0, "usable outside frame resets return time");
  assertEqual(fixture.st.pendingRelease.returnCount, 0, "usable outside frame resets return count");
  assertEqual(fixture.stats.cancellations, 0, "reset sequence does not cancel");
}
{
  const fixture = adaptiveConfirmationFixture();
  fixture.st.pendingRelease.departCheck = true;
  fixture.st.pendingRelease.departSeen = 99;
  fixture.st.pendingRelease.departFrames = 0;
  fixture.st.pendingRelease.nb2Ref = { x: 1, y: 1 };
  for (let i = 0; i < 21; i++) fixture.push(mkRaw(0.62, 140), 0.1, 20);
  assertEqual(fixture.st.pendingRelease, null, "adaptive no-depart guard clears after timeout");
  assertEqual(fixture.stats.netReleases, 1, "adaptive .62 observations keep the shown shot");
  assertEqual(fixture.stats.cancellations, 0, "adaptive guard skips every legacy cancellation");
  assertEqual(
    fixture.stats.cancelReasons.includes("no-depart"),
    false,
    "adaptive guard never reports no-depart",
  );
}
{
  const equality = adaptiveConfirmationFixture();
  for (let i = 0; i < 4; i++) equality.push(mkRaw(0.59, 150), 0.1, 50);
  assertEqual(equality.stats.netReleases, 0, "stored anchorEnter equality counts as inside");

  const nonFinite = adaptiveConfirmationFixture();
  nonFinite.st.pendingRelease.anchorEnter = NaN;
  for (let i = 0; i < 4; i++) nonFinite.push(mkRaw(0.2, 150), 0.1, 50);
  assertEqual(
    nonFinite.stats.netReleases,
    1,
    "non-finite stored boundary fails safe without cancel",
  );
  assertEqual(nonFinite.stats.cancellations, 0, "non-finite boundary cannot auto-cancel");
}
{
  [
    { label: "missing", fireEvidence: undefined },
    { label: "other", fireEvidence: "other" },
  ].forEach(({ label, fireEvidence }) => {
    const st = core.makeFormPhaseDetector();
    st.lastReleaseTs = 1000;
    st.pendingRelease = {
      ts: 1000,
      ...(fireEvidence === undefined ? {} : { fireEvidence }),
      nb2Ref: null,
      departCheck: true,
      departFrames: 0,
      departSeen: 5,
    };
    const hoverRaw = mkRaw(0.5, 140);
    const result = core.stepFormPhase(st, hoverRaw, [{ ts: 1401, m: hoverRaw, vel: 0.2 }], 1, 1401);
    assertEqual(result.canceled, true, `${label} fireEvidence remains legacy-compatible`);
    assertEqual(
      result.debug.cancelReason,
      "no-depart",
      `${label} fireEvidence uses legacy no-depart`,
    );
  });
}

/* ---------- Task 2: session-local adaptive anchor evidence ---------- */

{
  const s = adaptiveStepper(30);
  let fifth;
  for (let i = 0; i < 5; i++) fifth = s.push(mkRaw(0.47 + i * 0.002, 150), 0.2);
  assertAdaptiveResultShape(fifth.r, "five-sample normal path");
  assertEqual(fifth.r.anchorEnter, 0.35, "five usable frames retain cold anchor threshold");
  assertEqual(fifth.r.debug.anchorFloor, null, "five usable frames have no learned floor");
  const sixth = s.push(mkRaw(0.48, 150), 0.25);
  assert(
    sixth.r.anchorEnter > 0.47,
    `sixth usable frame starts calibration, got ${sixth.r.anchorEnter}`,
  );
  assertAdaptiveResultShape(sixth.r, "six-sample calibrated path");
  assert(Number.isFinite(sixth.r.debug.anchorFloor), "sixth usable frame exposes learned floor");
}
{
  const s = adaptiveStepper(30);
  const norms = [0.47, 0.48, 0.475, 0.485, 0.472, 0.478];
  let last;
  norms.forEach((norm, i) => {
    last = s.push(mkRaw(norm, 150), 0.2 + i * 0.05);
  });
  assertEqual(last.r.phase, "ANCHORING", "exact-150ms oblique hold enters ANCHORING");
  assertEqual(last.r.anchorStartTs, 30, "adaptive anchor starts at first qualifying hold sample");
  assert(last.r.anchorEnter > 0.47, "oblique hold learns an entry threshold above its floor");
  assert(last.r.debug.evidenceAgeMs === 0, "fresh oblique evidence has zero age");
  assert(last.r.debug.evidenceStrength >= 3, "oblique hold exposes non-zero evidence strength");
  assert(s.st.adaptive.evidence !== null, "oblique hold stores adaptive evidence");
}
{
  const s = adaptiveStepper(50);
  let last;
  for (let i = 0; i < 61; i++) last = s.push(mkRaw(0.47 + (i % 3) * 0.002, 150), 0.3);
  assertEqual(last.r.phase, "FULL_DRAW", "three-second qualified hold reaches FULL_DRAW");
  assertEqual(last.r.debug.evidenceAgeMs, 0, "long hold refreshes evidence on its latest frame");
  assertEqual(last.r.debug.evidenceStrength, 12, "long hold caps evidence strength at twelve");
  assertEqual(s.st.adaptive.holdSince, 50, "sample-window sliding preserves original hold start");
}
{
  const s = adaptiveStepper(30);
  for (let i = 0; i < 6; i++) s.push(mkRaw(0.47 + (i % 2) * 0.004, 150), 0.2);
  const evidenceTs = s.st.adaptive.evidence.ts;
  const atLimit = s.push(null, 0, 1500);
  assertAdaptiveResultShape(atLimit.r, "null evidence-ageing path");
  assert(s.st.adaptive.evidence !== null, "evidence is retained at exactly 1500ms");
  assertEqual(
    s.st.adaptive.anchorSamples.length,
    1,
    "sample exactly at the 1500ms cutoff is retained",
  );
  assertEqual(atLimit.r.debug.evidenceAgeMs, 1500, "debug reports inclusive evidence age boundary");
  assertEqual(atLimit.r.phase, "ANCHORING", "null evidence ageing preserves current phase");
  const expired = s.push(null, 0, 1);
  assertEqual(s.st.adaptive.evidence, null, "evidence clears at age 1501ms");
  assertEqual(s.st.adaptive.anchorSamples.length, 0, "sample older than 1500ms is pruned");
  assertEqual(expired.r.debug.evidenceAgeMs, null, "expired evidence age becomes unknown");
  assertEqual(
    expired.r.phase,
    "ANCHORING",
    "expired null evidence does not redesign phase semantics",
  );
  assert(evidenceTs > 0, "expiry fixture starts at a positive evidence timestamp");
}
{
  const s = adaptiveStepper(30);
  for (let i = 0; i < 6; i++) s.push(mkRaw(0.47, 150), 0.2);
  s.push(mkRaw(1.21, 90), 0.1, 1);
  s.push(mkRaw(1.21, 90), 0.1, 299);
  assert(s.st.adaptive.evidence !== null, "299ms continuously far preserves evidence");
  s.push(mkRaw(1.21, 90), 0.1, 1);
  assertEqual(s.st.adaptive.evidence, null, "300ms continuously far clears evidence");
}
{
  const s = adaptiveStepper(30);
  for (let i = 0; i < 6; i++) s.push(mkRaw(0.47, 150), 0.2);
  s.push(mkRaw(1.21, 90), 0.1, 1);
  s.push(mkRaw(1.2, 90), 0.1, 299);
  assertEqual(s.st.adaptive.farSince, 0, "anchorNorm equality 1.2 resets the far timer");
  assert(s.st.adaptive.evidence !== null, "anchorNorm equality 1.2 preserves evidence");
}
{
  const s = adaptiveStepper(30);
  for (let i = 0; i < 8; i++) s.push(mkRaw(0.47 + (i % 2) * 0.004, 150), 0.2, i === 0 ? 1001 : 30);
  assert(s.st.adaptive.evidence.anchorEnter > 0.47, "sanity: NB2 fixture has learned evidence");
  s.push(null, 0, 200);
  const arrival = s.push(mkRaw(0.8, 140), 3, 1);
  assertEqual(arrival.r.released, true, "NB2 accepts pre-gap anchor under snapshotted anchorEnter");
  assertEqual(arrival.r.debug.fireEvidence, "nb2", "learned-boundary NB2 remains auditable");
  assertAdaptiveResultShape(arrival.r, "NB2 fire path");
}
{
  const s = adaptiveStepper(40);
  for (let i = 0; i < 5; i++) s.push(mkRaw(0.47, 150), 0.2);
  s.push(null, 0, 40);
  s.push(mkRaw(0.47, 150), 0.2, 40);
  const last = s.push(mkRaw(0.47, 150), 0.2, 40);
  assertEqual(s.st.adaptive.evidence, null, "null frame prevents calibration history bridging");
  assertEqual(last.r.phase, "SETUP", "post-gap short suffix does not enter adaptive ANCHORING");
}
{
  const gatedScript = coreScript.replace("CONF_GATE: 0,", "CONF_GATE: 0.5,");
  assert(
    gatedScript !== coreScript,
    "confidence-gated fixture enables the existing usability gate",
  );
  const gatedCore = new Function(
    `${gatedScript}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  const s = adaptiveStepper(40, gatedCore);
  const confident = () => ({ ...mkRaw(0.47, 150), conf: 0.9 });
  for (let i = 0; i < 5; i++) s.push(confident(), 0.2);
  s.push({ ...mkRaw(0.47, 150), conf: 0.4 }, 0.2);
  s.push(confident(), 0.2);
  const afterGap = s.push(confident(), 0.2);
  assertEqual(s.st.adaptive.evidence, null, "confidence-unusable frame prevents hold bridging");
  assert(
    afterGap.r.phase !== "ANCHORING" && afterGap.r.phase !== "FULL_DRAW",
    "confidence-unusable gap cannot fabricate an adaptive anchor phase",
  );
}
{
  const state = core.makeFormPhaseDetector().adaptive;
  const ineligible = (anchorNorm, drawArm, start) =>
    Array.from({ length: 6 }, (_, i) => ({
      ts: start + i * 30,
      m: mkRaw(anchorNorm, drawArm),
      vel: 0.2,
    }));
  let history = ineligible(0.47, 125, 10);
  core.updateAdaptiveAnchorEvidence(state, history.at(-1).m, history, history.at(-1).ts);
  assertEqual(state.anchorSamples.length, 0, "drawArm equality 125 is excluded");
  history = ineligible(1.3, 150, 300);
  core.updateAdaptiveAnchorEvidence(state, history.at(-1).m, history, history.at(-1).ts);
  assertEqual(state.anchorSamples.length, 0, "anchorNorm equality 1.3 is excluded");
}
{
  const exact = adaptiveStepper(30);
  [0.47, 0.49, 0.51, 0.53, 0.55, 0.59].forEach((norm) => exact.push(mkRaw(norm, 150), 0.2));
  assert(exact.st.adaptive.evidence !== null, "stable range equality 0.12 is included");
  const over = adaptiveStepper(30);
  [0.47, 0.49, 0.51, 0.53, 0.55, 0.5901].forEach((norm) => over.push(mkRaw(norm, 150), 0.2));
  assertEqual(over.st.adaptive.evidence, null, "stable range above 0.12 is excluded");
}
{
  const s = adaptiveStepper(30);
  const velocities = [1, NaN, 3, 4, 5, 6];
  velocities.forEach((velocity, i) => s.push(mkRaw(0.47 + (i % 2) * 0.01, 150), velocity));
  const first = { ...s.st.adaptive.evidence };
  assertEqual(s.st.adaptive.holdVelocitySamples.length, 5, "backfill keeps only finite velocities");
  const originalHoldSince = s.st.adaptive.holdSince;
  const next = s.push(mkRaw(0.49, 150), 8);
  const refreshed = s.st.adaptive.evidence;
  assertEqual(refreshed.ts, next.t, "continuing qualified frame refreshes evidence timestamp");
  assertEqual(refreshed.anchorEnter, s.st.adaptive.anchorEnter, "evidence snapshots anchorEnter");
  assertEqual(
    refreshed.releaseSpeed,
    s.st.adaptive.releaseSpeed,
    "evidence snapshots releaseSpeed",
  );
  assert(
    refreshed.releaseSpeed > first.releaseSpeed,
    "finite hold velocities refresh releaseSpeed",
  );
  assert(refreshed.normAtHold !== first.normAtHold, "evidence refreshes median hold norm");
  assertEqual(refreshed.strength, 7, "evidence refreshes capped strength");
  assertEqual(s.st.adaptive.holdSince, originalHoldSince, "continuing hold keeps original start");
}
{
  const s = adaptiveStepper(30);
  for (let i = 0; i < 6; i++) s.push(mkRaw(0.47, 150), 0.2);
  s.st.pendingRelease = {
    ts: s.st.adaptive.evidence.ts,
    fireEvidence: "close",
    departCheck: false,
    departFrames: 0,
    departSeen: 0,
  };
  s.push(mkRaw(1.21, 90), 0.1, 1);
  s.push(mkRaw(1.21, 90), 0.1, 299);
  assert(s.st.adaptive.evidence !== null, "pending confirmation is exempt from far invalidation");
  assertEqual(s.st.adaptive.farSince, 0, "pending confirmation cannot accumulate far duration");
  assertEqual(s.st.adaptive.holdSamples.length, 0, "pending confirmation cannot extend a hold");
}
{
  /* Review remediation: pendingRelease raw frames are already in browser history.
     A cancel must create a hard learning barrier so those frames cannot be
     retroactively backfilled on the first post-cancel frame. */
  const s = adaptiveStepper(30);
  for (let i = 0; i < 6; i++) s.push(mkRaw(0.22, 150), 0.2);
  s.st.adaptive.evidence = null;
  s.st.adaptive.holdSamples = [];
  s.st.adaptive.holdVelocitySamples = [];
  s.st.adaptive.holdSince = 0;
  s.st.adaptive.releaseSpeed = 6;
  s.st.pendingRelease = {
    ts: 180,
    fireEvidence: "close",
    nb2Ref: null,
    departCheck: false,
    departFrames: 0,
    departSeen: 0,
  };
  let cancel = null;
  for (let i = 0; i < 6; i++) {
    const current = s.push(mkRaw(0.22, 150), 8, 20);
    if (current.r.canceled) cancel = current;
  }
  assert(cancel, "review fixture reaches anchor-return cancel");
  assertAdaptiveResultShape(cancel.r, "anchor-return cancel path");
  assertEqual(
    s.st.adaptive.anchorSamples.length,
    6,
    "pending cancel frames cannot teach anchor samples",
  );
  assertEqual(
    s.st.adaptive.holdBreakTs,
    cancel.t,
    "cancel frame records the latest learning barrier",
  );
  const first = s.push(mkRaw(0.22, 150), 0.2, 75);
  assertEqual(
    s.st.adaptive.evidence,
    null,
    "first post-cancel frame cannot backfill pending history into evidence",
  );
  const second = s.push(mkRaw(0.22, 150), 0.2, 75);
  assertEqual(
    s.st.adaptive.evidence,
    null,
    "two post-cancel observations remain below the hold gate",
  );
  const third = s.push(mkRaw(0.22, 150), 0.2, 75);
  assert(s.st.adaptive.evidence !== null, "three post-cancel observations spanning 150ms qualify");
  assert(
    s.st.adaptive.holdSamples.every((sample) => sample.ts > cancel.t),
    "post-cancel hold samples exclude every pending timestamp",
  );
  assertEqual(s.st.adaptive.holdSince, first.t, "post-cancel hold starts after the barrier");
  assertEqual(s.st.adaptive.releaseSpeed, 6, "pending high velocities cannot raise releaseSpeed");
  assertEqual(
    s.st.adaptive.evidence.strength,
    3,
    "post-cancel evidence counts only fresh observations",
  );
  assertEqual(
    s.st.adaptive.anchorSamples.length,
    9,
    "only three post-cancel anchor samples are added",
  );
  assertAdaptiveResultShape(first.r, "first post-anchor-return-cancel path");
  assertAdaptiveResultShape(second.r, "second post-anchor-return-cancel path");
  assertAdaptiveResultShape(third.r, "qualified post-anchor-return-cancel path");
}
{
  /* The ordinary CONFIRM_MS timeout path must impose the same history barrier,
     even though no cancellation return resets phase state. */
  const s = adaptiveStepper(30);
  for (let i = 0; i < 6; i++) s.push(mkRaw(0.47, 150), 0.2);
  s.st.adaptive.evidence = null;
  s.st.adaptive.holdSamples = [];
  s.st.adaptive.holdVelocitySamples = [];
  s.st.adaptive.holdSince = 0;
  s.st.adaptive.releaseSpeed = 6;
  s.st.pendingRelease = {
    ts: 180,
    fireEvidence: "close",
    nb2Ref: null,
    departCheck: false,
    departFrames: 0,
    departSeen: 0,
  };
  for (let i = 0; i < 4; i++) s.push(mkRaw(0.47, 150), 8, 100);
  const timeout = s.push(mkRaw(0.47, 150), 8, 1);
  assertEqual(s.st.pendingRelease, null, "review fixture reaches ordinary confirm timeout");
  assertEqual(
    s.st.adaptive.anchorSamples.length,
    6,
    "pending timeout frames cannot teach anchor samples",
  );
  assertEqual(
    s.st.adaptive.holdBreakTs,
    timeout.t,
    "timeout frame records the latest learning barrier",
  );
  const first = s.push(mkRaw(0.47, 150), 0.2, 75);
  assertEqual(
    s.st.adaptive.evidence,
    null,
    "first post-timeout frame cannot backfill pending history into evidence",
  );
  s.push(mkRaw(0.47, 150), 0.2, 75);
  s.push(mkRaw(0.47, 150), 0.2, 75);
  assert(s.st.adaptive.evidence !== null, "new post-timeout hold qualifies only after 150ms");
  assert(
    s.st.adaptive.holdSamples.every((sample) => sample.ts > timeout.t),
    "post-timeout hold samples exclude every pending timestamp",
  );
  assertEqual(s.st.adaptive.holdSince, first.t, "post-timeout hold starts after the barrier");
  assertEqual(
    s.st.adaptive.releaseSpeed,
    6,
    "timed-out pending velocities cannot raise releaseSpeed",
  );
  assertEqual(
    s.st.adaptive.evidence.strength,
    3,
    "post-timeout evidence counts only fresh observations",
  );
  assertEqual(
    s.st.adaptive.anchorSamples.length,
    9,
    "only three post-timeout anchor samples are added",
  );
}
{
  /* Duplicate timestamps are not distinct observations. Treat the invalid
     ordering as a suffix barrier rather than letting it inflate the frame gate. */
  const state = core.makeFormPhaseDetector().adaptive;
  state.anchorSamples = Array.from({ length: 6 }, (_, i) => ({
    ts: 10 + i,
    norm: 0.47,
  }));
  const duplicateHistory = [
    { ts: 100, m: mkRaw(0.47, 150), vel: 0.2 },
    { ts: 100, m: mkRaw(0.47, 150), vel: 0.2 },
    { ts: 250, m: mkRaw(0.47, 150), vel: 0.2 },
  ];
  const result = core.updateAdaptiveAnchorEvidence(
    state,
    duplicateHistory.at(-1).m,
    duplicateHistory,
    250,
  );
  assertEqual(result.holdQualified, false, "duplicate timestamp cannot satisfy three observations");
  assertEqual(state.evidence, null, "duplicate timestamp cannot fabricate adaptive evidence");
  assertEqual(state.holdSamples.length, 2, "duplicate timestamp is a stable-suffix barrier");
}
{
  const quick = adaptiveStepper(50);
  for (let i = 0; i < 6; i++) quick.push(mkRaw(0.47 + (i % 2) * 0.005, 150), 0.2);
  assert(quick.st.adaptive.evidence !== null, "sanity: six stable frames can form evidence");
  const short = adaptiveStepper(50);
  for (let i = 0; i < 5; i++) short.push(mkRaw(0.47, 150), 0.2);
  short.push(null, 0);
  const last = short.push(mkRaw(0.47, 150), 0.2);
  assertEqual(
    short.st.adaptive.evidence,
    null,
    "quick draw without a continuous 150ms hold has no evidence",
  );
  assert(last.r.phase !== "ANCHORING", "quick draw does not enter adaptive ANCHORING");
}
{
  const source = coreScript.slice(
    coreScript.indexOf("function stepFormPhase"),
    coreScript.indexOf("function formPreReleaseWindow"),
  );
  assertEqual(
    (source.match(/formPhaseResult\(/g) || []).length,
    9,
    "all nine stepFormPhase return paths use the adaptive result decorator",
  );
}
{
  /* Coverage remediation for early cancellation returns. These paths already
     behaved correctly; reach them dynamically so result-shape coverage does
     not rely only on source-string counting. */
  const nb2Drift = core.makeFormPhaseDetector();
  nb2Drift.lastReleaseTs = 1000;
  nb2Drift.pendingRelease = {
    ts: 1000,
    fireEvidence: "nb2",
    nb2Ref: { x: 0, y: 0 },
    departCheck: false,
    departFrames: 0,
    departSeen: 0,
  };
  const driftRaw = { ...mkRaw(1.0, 90), dW: { x: 0.2, y: 0 } };
  const driftHistory = [{ ts: 1020, m: driftRaw, vel: 0.2 }];
  core.stepFormPhase(nb2Drift, driftRaw, driftHistory, 1.0, 1020);
  driftHistory.push({ ts: 1120, m: driftRaw, vel: 0.2 });
  const driftCancel = core.stepFormPhase(nb2Drift, driftRaw, driftHistory, 1.0, 1120);
  assertEqual(driftCancel.debug.cancelReason, "nb2-drift", "NB2 drift fixture reaches cancel");
  assertAdaptiveResultShape(driftCancel, "NB2 drift cancel path");

  const nb2Unobserved = core.makeFormPhaseDetector();
  nb2Unobserved.lastReleaseTs = 1000;
  nb2Unobserved.pendingRelease = {
    ts: 1000,
    fireEvidence: "nb2",
    nb2Ref: { x: 0, y: 0 },
    departCheck: true,
    departFrames: 0,
    departSeen: 0,
  };
  const unobservedRaw = mkRaw(1.0, 90);
  const unobservedCancel = core.stepFormPhase(
    nb2Unobserved,
    unobservedRaw,
    [{ ts: 1401, m: unobservedRaw, vel: 0.2 }],
    1.0,
    1401,
  );
  assertEqual(
    unobservedCancel.debug.cancelReason,
    "nb2-unobserved",
    "NB2 unobserved fixture reaches cancel",
  );
  assertAdaptiveResultShape(unobservedCancel, "NB2 unobserved cancel path");

  const noDepart = core.makeFormPhaseDetector();
  noDepart.lastReleaseTs = 1000;
  noDepart.pendingRelease = {
    ts: 1000,
    fireEvidence: "close",
    nb2Ref: null,
    departCheck: true,
    departFrames: 0,
    departSeen: 5,
  };
  const hoverRaw = mkRaw(0.5, 140);
  const noDepartCancel = core.stepFormPhase(
    noDepart,
    hoverRaw,
    [{ ts: 1401, m: hoverRaw, vel: 0.2 }],
    1.0,
    1401,
  );
  assertEqual(noDepartCancel.debug.cancelReason, "no-depart", "no-depart fixture reaches cancel");
  assertAdaptiveResultShape(noDepartCancel, "no-depart cancel path");
}

/* 15fps(dt=66ms)で離脱が totalMs で完了する現実的なリリース区間を作る。
   ease-out（離脱直後が最速、その後減速）カーブを dt 間隔でサンプリングし、
   vel は実コードと同じ定義（区間のアンカー変化量/dt）で正しく算出する
   （速度をアンカー変化と無関係な固定値にすると検出ロジックの検証にならない）。 */
function releaseFrames(totalMs, dt, fromAnchor) {
  const frames = [];
  let prevA = fromAnchor;
  for (let t = dt; t <= totalMs + dt; t += dt) {
    const x = Math.min(1, t / totalMs);
    const eased = 1 - Math.pow(1 - x, 2);
    const a = fromAnchor + (1 - fromAnchor) * eased;
    const vel = Math.abs(a - prevA) / (dt / 1000);
    frames.push([mkRaw(a, 130), vel, dt]);
    prevA = a;
    if (x >= 1) break;
  }
  return frames;
}

function shotSequence(dt) {
  const d = dt || 66;
  const seq = [];
  for (let i = 0; i < 10; i++) seq.push([mkRaw(1.5, 90), 0.05, d]);
  for (let i = 0; i < 8; i++) seq.push([mkRaw(1.2 - i * 0.12, 110 + i * 5), 0.5, d]);
  for (let i = 0; i < 10; i++) seq.push([mkRaw(0.22, 150), 0.05, d]);
  seq.push(...releaseFrames(90, d, 0.22)); // 90msで離脱完了する現実的なリリース
  for (let i = 0; i < 5; i++) seq.push([mkRaw(1.4, 90), 0.2, d]);
  return seq;
}

{
  const r = runSequence(shotSequence());
  ["SETUP", "DRAWING", "ANCHORING", "FULL_DRAW", "RELEASE", "FOLLOW"].forEach((p) =>
    assert(r.phases.includes(p), `phase ${p} reached`),
  );
  assertEqual(r.releases, 1, "low-fps (15fps) realistic release detected once");
}
{
  // レットダウン誤検出境界の回帰テスト（2026-07-05 修理）。
  // 2026-07-26 承認済み recall tradeoff: 100ms の線形レットダウンは、見逃しを減らす
  // relative adaptive path により「削除可能な候補」1件となりうる。150〜2000ms は従来どおり
  // 0件を固定する（境界表は 46-form-core.js の RELEASE_TH コメント参照）。50ms は 1 フレームで
  // 完了する極限ケースで、20fps 相当では速度スパイクがリリースと数値上区別できず
  // 対象外（停止条件の対象は「50ms〜2s」のうち計測可能な範囲）。
  [2000, 1500, 1200, 1100, 1000, 900, 800, 700, 600, 500, 400, 300, 250, 200, 150, 100].forEach(
    (totalMs) => {
      [20, 50].forEach((dt) => {
        const seq = [];
        for (let i = 0; i < 60; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
        const frames = Math.max(1, Math.round(totalMs / dt));
        const step = 0.78 / frames;
        for (let i = 1; i <= frames; i++)
          seq.push([mkRaw(0.22 + i * step, 140), step / (dt / 1000), dt]);
        for (let i = 0; i < 30; i++) seq.push([mkRaw(1.0, 90), 0.02, dt]);
        assertEqual(
          runSequence(seq).releases,
          totalMs === 100 ? 1 : 0,
          `let-down ${totalMs}ms (dt=${dt}) approved adaptive boundary`,
        );
      });
    },
  );
}
{
  // 現実的なリリース速度プロファイル（離脱 50-100ms で完了）は確実に検出する
  [50, 60, 80, 100].forEach((totalMs) => {
    [20, 50].forEach((dt) => {
      const seq = [];
      for (let i = 0; i < 60; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
      seq.push(...releaseFrames(totalMs, dt, 0.22));
      for (let i = 0; i < 20; i++) seq.push([mkRaw(1.0, 90), 0.02, dt]);
      assertEqual(
        runSequence(seq).releases,
        1,
        `realistic release ${totalMs}ms (dt=${dt}) is detected`,
      );
    });
  });
}
{
  // レットダウン → 本物のリリース の複合シナリオ: 1 射のみ検出（レットダウンが余分な射にならない）
  [2000, 1000, 500, 150].forEach((letdownMs) => {
    const dt = 20;
    const seq = [];
    for (let i = 0; i < 60; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
    const ldFrames = Math.max(1, Math.round(letdownMs / dt));
    const step = 0.78 / ldFrames;
    for (let i = 1; i <= ldFrames; i++)
      seq.push([mkRaw(0.22 + i * step, 140), step / (dt / 1000), dt]);
    for (let i = 0; i < 20; i++) seq.push([mkRaw(1.0, 90), 0.02, dt]);
    for (let i = 1; i <= 12; i++) seq.push([mkRaw(1.0 - 0.78 * (i / 12), 110 + i), 0.5, dt]); // 再度ドロー
    for (let i = 0; i < 20; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
    seq.push(...releaseFrames(80, dt, 0.22));
    for (let i = 0; i < 20; i++) seq.push([mkRaw(1.0, 90), 0.02, dt]);
    assertEqual(
      runSequence(seq).releases,
      1,
      `let-down(${letdownMs}ms) then real release counts as one shot`,
    );
  });
}
{
  // null フレームブリッジ: リリース中に MediaPipe がトラッキングを見失っても検出できる
  const dt = 20;
  const seq = [];
  for (let i = 0; i < 60; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
  // リリース開始: 2フレーム分の速度スパイク
  seq.push([mkRaw(0.35, 140), 6, dt]);
  seq.push([mkRaw(0.5, 130), 8, dt]);
  // MediaPipe ドロップアウト: null フレームが3つ
  seq.push([null, 0, dt]);
  seq.push([null, 0, dt]);
  seq.push([null, 0, dt]);
  // 復帰: アンカーから離れた位置
  seq.push([mkRaw(1.0, 90), 0.2, dt]);
  for (let i = 0; i < 20; i++) seq.push([mkRaw(1.0, 90), 0.02, dt]);
  assertEqual(runSequence(seq).releases, 1, "null-frame bridged release detected");
}
{
  /* D'（Stage 1）: nullBridged の時間ベースギャップ上限 NB_MAX_GAP_MS=150 の両側境界。
     ギャップ span = 窓内の最初のnullフレーム→最後のnullフレームの経過時間（実装と同定義）。
     140ms は検出 / 200ms は非検出。復帰フレームの vel=8 は NB_MAXV(2) 超・RELEASE_TH(9) 未満
     に置き、velOk でなく nullBridged 経路が判定を決めることを保証する。 */
  function gapBridgedSequence(nullCount) {
    const seq = [];
    // アンカー保持（10ms間隔）。110フレーム=1100msの実シナリオを保ち、
    // 窓内に十分な closeFrames と長時間保持の adaptive evidence を残す。
    for (let i = 0; i < 110; i++) seq.push([mkRaw(0.22, 150), 0.02, 10]);
    for (let i = 0; i < nullCount; i++) seq.push([null, 0, 20]); // 姿勢ロス: span=(nullCount-1)*20ms
    seq.push([mkRaw(1.0, 90), 8, 10]); // 復帰: アンカー圏外・大きめの見かけ速度
    for (let i = 0; i < 10; i++) seq.push([mkRaw(1.0, 90), 0.2, 20]);
    return seq;
  }
  assertEqual(runSequence(gapBridgedSequence(8)).releases, 1, "140ms null gap is bridged (fires)");
  /* 2026-07-15 アンカー証拠一般化（NB2）による意図的な仕様上書き:
     旧設計はレットダウン判別手段を持たなかったため 150ms 超のギャップを一律非検出に
     していた（このシーケンスはリリース形状: sticky アンカー生存・クロスギャップ速度8・
     着地 1.0）。NB2 は着地位置ゲート＋速度下限で判別して発火させる。
     緩慢な引き戻し（遮蔽込み）の安全性は下の「アンカー証拠の一般化」節で担保。 */
  assertEqual(
    runSequence(gapBridgedSequence(11)).releases,
    1,
    "200ms null gap now bridged by NB2 (release-shaped)",
  );
  // NB_MAX_GAP_MS（tier-1 上限）が今も効いていることの証明は、NB2 の適用範囲外
  // （着地 anchorNorm 1.3 > NB2_MAX_ARRIVE）のシーケンスで行う: 150 のままなら非発火、
  // ∞ へ差し替えると tier-1 が解禁されて発火する
  function gapFarArrivalSequence(nullCount) {
    const seq = [];
    for (let i = 0; i < 110; i++) seq.push([mkRaw(0.22, 150), 0.02, 10]);
    for (let i = 0; i < nullCount; i++) seq.push([null, 0, 20]);
    seq.push([mkRaw(1.3, 90), 8, 10]); // 着地がレットダウン完了域（NB2 適用外）
    for (let i = 0; i < 10; i++) seq.push([mkRaw(1.3, 90), 0.2, 20]);
    return seq;
  }
  assertEqual(
    runSequence(gapFarArrivalSequence(11)).releases,
    0,
    "200ms gap with far arrival (1.3) stays capped by NB_MAX_GAP_MS and outside NB2",
  );
  assert(
    coreScript.includes("NB_MAX_GAP_MS: 150,"),
    "NB_MAX_GAP_MS constant present for ∞-substitution test",
  );
  const coreInfGap = new Function(
    `${coreScript.replace("NB_MAX_GAP_MS: 150,", "NB_MAX_GAP_MS: Infinity,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  assertEqual(
    runSequence(gapFarArrivalSequence(11), coreInfGap).releases,
    1,
    "disabling NB_MAX_GAP_MS (Infinity) restores pre-D' tier-1 behavior on the same sequence",
  );
}
/* [既知の制約・文書化のみ、strict-review 2026-07-11 finding]: 上の140/200ms境界テストが
   計測するギャップ span は「窓内に現れた最初のnullフレームts→最後のnullフレームts」であり、
   ギャップが250ms窓(RISE_WINDOW_MS)の左端に接している場合（＝本当のロス区間が窓外へ続いて
   いる可能性がある場合）、実際の姿勢ロス時間を過小評価しうる。合成再現で確認済みの経路:
   アンカー保持 → 実スパン220msの姿勢ロス（null 12フレーム, dt=20ms）→ 復帰close 2フレーム
   → vel=3 の緩慢な引き戻し、という系列が released=1（発火）になる。理由は releaseTs 直前の
   250ms窓にギャップの先頭部分が入らず、在窓の計測値が 140ms ≤ NB_MAX_GAP_MS(150) に収まる
   ため。加えてスパン定義そのものが「先頭null ts→末尾null ts」なので、真のロス時間（有効
   フレーム→有効フレーム間隔）を約2フレーム間隔ぶん恒常的に過小評価する（低fpsほど誤差が
   拡大: dt=66msでは null 3枚=132msの計測でも実ロスは約264ms）。
   strict-reviewの総合判断はこれを「push可・T8前の必須修正ではない」と結論しており（次工程
   条件は診断解釈時にこの経路を前提として読むことのみ）、本コミットではロジック変更をしない。
   修正方向（案）: (a) ギャップを「直前の有効フレームts→直後の有効フレームts」で計測する、
   (b) ギャップが窓左端に接している場合は上限超過側に倒す。実施する場合は設計書
   form-phase-final-design.md §6-D' への差し戻しフィードバックとセットで、境界テスト
   （140/200ms）の再導出込みの別タスクとする。
   → 2026-07-15 追記: NB2 のギャップ計測は (a) 方式（now - 直前有効フレームts）を採用した。 */
{
  /* アンカー証拠の一般化（2026-07-15、実射 6射中4射消失の修正）
     実座標 dW を動かし computeFormVelocity に速度を実計算させる（view ループ契約:
     vel を push 前に計算、現在フレームを push してから stepFormPhase）。
     60fps・bodyScale 0.25。検証対象:
       NB2   — 150-350ms のトラッキング欠落を sticky アンカー＋着地位置ゲートで橋渡し
       loose — 誤配置アンカー（closeFrames=0）でも緩ゾーン保持＋強スパイクで発火
       安全  — レットダウン（隠れ遮蔽込み・誤配置込み）は引き続き一切発火しない */
  const DT60 = 1000 / 60;
  const FACE = { x: 0.52, y: 0.3 };
  const A_DW = { x: 0.56, y: 0.32 }; // アンカー手首（anchorNorm≈0.18）
  const S_DW = { x: 0.75, y: 0.55 }; // 構え位置
  const R_DW = { x: 0.78, y: 0.36 }; // リリース後（後方伸展・落下小）
  const anchorNormOf = (dw) => Math.hypot(dw.x - FACE.x, dw.y - FACE.y) / 0.25;
  const mkDw = (dw, drawArm, anchorNormOverride) => ({
    anchorNorm: anchorNormOverride != null ? anchorNormOverride : anchorNormOf(dw),
    drawArm,
    bodyScale: 0.25,
    conf: 0.7,
    dW: { x: dw.x, y: dw.y },
  });
  const lerp2 = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  function runDw(frames) {
    const st = core.makeFormPhaseDetector();
    const hist = [];
    let t = 0,
      releases = 0,
      lastFire = null,
      lastCancel = null;
    for (const raw of frames) {
      t += DT60;
      const vel = core.computeFormVelocity(hist, raw, t);
      hist.push({ ts: t, m: raw, vel });
      if (hist.length > 200) hist.shift();
      const r = core.stepFormPhase(st, raw, hist, 1.0, t);
      if (r.released) {
        releases++;
        lastFire = r;
      }
      if (r.canceled) {
        releases--;
        lastCancel = r;
      }
    }
    return { releases, lastFire, lastCancel };
  }
  const seg = (frames, fn) =>
    Array.from({ length: frames }, (_, i) => fn(i / Math.max(1, frames - 1), i));
  function shotDw(o) {
    const seq = [];
    seq.push(...seg(30, () => mkDw(S_DW, 90)));
    seq.push(...seg(24, (t) => mkDw(lerp2(S_DW, A_DW, t), 100 + 30 * t)));
    seq.push(
      ...seg(Math.round((o.anchorMs || 1200) / DT60), (t, i) =>
        mkDw(
          { x: A_DW.x + Math.sin(i) * 0.002, y: A_DW.y + Math.cos(i) * 0.002 },
          115,
          o.anchorNorm,
        ),
      ),
    );
    const rel = seg(6, (t) => mkDw(lerp2(A_DW, R_DW, 1 - Math.pow(1 - t, 2)), 120));
    if (o.gapMs) {
      seq.push(rel[0]);
      for (let i = 0; i < Math.round(o.gapMs / DT60); i++) seq.push(null);
      seq.push(mkDw(R_DW, 120));
    } else seq.push(...rel);
    seq.push(...seg(36, () => mkDw(R_DW, 110)));
    return seq;
  }
  // NB2: 200ms / 300ms のリリース瞬間欠落は回復、400ms（NB2_MAX_GAP_MS 超）は対象外
  assertEqual(runDw(shotDw({ gapMs: 200 })).releases, 1, "NB2: 200ms release-moment gap recovers");
  assertEqual(runDw(shotDw({ gapMs: 300 })).releases, 1, "NB2: 300ms release-moment gap recovers");
  assertEqual(
    runDw(shotDw({ gapMs: 400 })).releases,
    0,
    "NB2: 400ms gap stays out of scope (documented limit)",
  );
  const nb2Fire = runDw(shotDw({ gapMs: 300 })).lastFire;
  assertEqual(
    nb2Fire.debug.fireEvidence,
    "nb2",
    "NB2 fire carries fireEvidence=nb2 for field audit",
  );
  /* 誤配置アンカー（anchorNorm が一度も CLOSE_IN を切らない保持）は発火対象外（意図的）。
     2026-07-15 に loose 経路として検討したが、実射診断の全16発火は close 証拠を持ち、
     このメカニズムは実データ未観測。一方ゴールデン 48725 の幻覚ランドマークシーンで
     過検出3件を出したため撤去した。ここでは「発火しない」ことを仕様として固定する
     （将来 field でこのメカニズムが観測されたら、そのデータで再設計する） */
  assertEqual(
    runDw(shotDw({ anchorNorm: 0.42 })).releases,
    0,
    "misregistered anchor 0.42 (never close) stays out of scope",
  );
  assertEqual(
    runDw(shotDw({ anchorNorm: 0.55 })).releases,
    0,
    "misregistered anchor 0.55 (never close) stays out of scope",
  );
  // 従来経路の発火ラベル
  const closeFire = runDw(shotDw({})).lastFire;
  assertEqual(closeFire.debug.fireEvidence, "close", "normal fire carries fireEvidence=close");
  // 安全1: レットダウンがギャップ内に完全に隠れる（sticky 生存の敵対ケース）→ 着地ゲートで非発火
  function hiddenLetdownDw(gapMs, emergeAt) {
    const seq = [];
    seq.push(...seg(30, () => mkDw(S_DW, 90)));
    seq.push(...seg(24, (t) => mkDw(lerp2(S_DW, A_DW, t), 100 + 30 * t)));
    seq.push(...seg(72, () => mkDw(A_DW, 115)));
    for (let i = 0; i < Math.round(gapMs / DT60); i++) seq.push(null);
    const e = lerp2(A_DW, S_DW, emergeAt);
    seq.push(mkDw(e, 95));
    seq.push(...seg(18, (t) => mkDw(lerp2(e, S_DW, t), 92)));
    seq.push(...seg(60, () => mkDw(S_DW, 90)));
    return seq;
  }
  for (const g of [200, 300, 350]) {
    assertEqual(
      runDw(hiddenLetdownDw(g, 1.0)).releases,
      0,
      `safety: letdown fully hidden in ${g}ms gap does not fire`,
    );
    assertEqual(
      runDw(hiddenLetdownDw(g, 0.4)).releases,
      0,
      `safety: letdown partially hidden in ${g}ms gap does not fire`,
    );
  }
  // 安全2: 誤配置アンカー(0.45)からの緩慢な引き戻し → STRONG_TH 未達で非発火
  function misregLetdownDw(downMs) {
    const seq = [];
    seq.push(...seg(30, () => mkDw(S_DW, 90)));
    seq.push(...seg(24, (t) => mkDw(lerp2(S_DW, A_DW, t), 100 + 30 * t)));
    seq.push(
      ...seg(72, (t, i) =>
        mkDw({ x: A_DW.x + Math.sin(i) * 0.002, y: A_DW.y + Math.cos(i) * 0.002 }, 115, 0.45),
      ),
    );
    seq.push(...seg(Math.round(downMs / DT60) + 1, (t) => mkDw(lerp2(A_DW, S_DW, t), 100)));
    seq.push(...seg(60, () => mkDw(S_DW, 90)));
    return seq;
  }
  for (const d of [400, 800, 1500]) {
    assertEqual(
      runDw(misregLetdownDw(d)).releases,
      0,
      `safety: misregistered-anchor letdown ${d}ms does not fire`,
    );
  }
  // 安全3: NB2 の落下ゲート — 着地位置は範囲内でも垂直落下が大きい再捕捉は非発火
  function dropArrivalDw(gapMs) {
    const seq = [];
    seq.push(...seg(30, () => mkDw(S_DW, 90)));
    seq.push(...seg(24, (t) => mkDw(lerp2(S_DW, A_DW, t), 100 + 30 * t)));
    seq.push(...seg(72, () => mkDw(A_DW, 115)));
    for (let i = 0; i < Math.round(gapMs / DT60); i++) seq.push(null);
    // 着地 anchorNorm ≈ 0.9（NB2 範囲内）だが下方向へ 0.55 胴体長落下した位置
    const drop = { x: A_DW.x + 0.09, y: A_DW.y + 0.55 * 0.25 + 0.04 };
    seq.push(mkDw(drop, 95, 0.9));
    seq.push(...seg(60, () => mkDw(drop, 90, 0.9)));
    return seq;
  }
  assertEqual(
    runDw(dropArrivalDw(250)).releases,
    0,
    "safety: NB2 drop gate rejects arrival that fell >0.5 body-lengths",
  );
  /* 安全4: NB2 着地後静止確認（drift-cancel）— 前方水平のレットダウンがギャップ内に隠れ、
     着地位置・落下・速度の全ゲートをすり抜けても、着地後に手が弦と共に動き続けるため
     CONFIRM_MS 窓内の drift-cancel で取消される（net 0）。
     幾何: アンカー(0.56,0.32) → 250msギャップ → 前方(0.72,0.36)で再捕捉
     （anchorNorm≈0.84∈[0.65,1.15]、落下0.16<0.5、クロスギャップ速度≈2.6>2.2 → NB2発火）
     → その後も前方下方へ動き続ける → drift>0.55 が2連続 → 取消 */
  function forwardLetdownHiddenDw(gapMs) {
    const seq = [];
    seq.push(...seg(30, () => mkDw(S_DW, 90)));
    seq.push(...seg(24, (t) => mkDw(lerp2(S_DW, A_DW, t), 100 + 30 * t)));
    seq.push(...seg(72, () => mkDw(A_DW, 115)));
    for (let i = 0; i < Math.round(gapMs / DT60); i++) seq.push(null);
    const emerge = { x: 0.72, y: 0.36 };
    seq.push(mkDw(emerge, 95));
    // 弦と共に動き続ける（前方下方へ 0.25norm=1胴体長を300msで）
    seq.push(...seg(18, (t) => mkDw(lerp2(emerge, { x: 0.55, y: 0.55 }, t), 92)));
    seq.push(...seg(60, () => mkDw({ x: 0.55, y: 0.55 }, 90)));
    return seq;
  }
  const fwdHidden = runDw(forwardLetdownHiddenDw(250));
  assertEqual(
    fwdHidden.releases,
    0,
    "safety: forward letdown hidden in gap fires NB2 then drift-cancels (net 0)",
  );
  assertEqual(
    fwdHidden.lastCancel.debug.cancelReason,
    "nb2-drift",
    "field-shape fixture reaches NB2 drift cancel",
  );
  assertAdaptiveResultShape(fwdHidden.lastCancel, "field-shape NB2 drift cancel path");
  // 対照: 真のリリース（NB2経由）はフォロースルーで静止するため drift-cancel されない
  assertEqual(
    runDw(shotDw({ gapMs: 250 })).releases,
    1,
    "NB2 fire with static follow-through survives drift-cancel window",
  );
}
{
  /* B'（Stage 1・中立スキャフォールド）: conf ゲート。出荷値 CONF_GATE=0 は完全無効＝現行同値。
     0.45 へ差し替えたコアでは conf<0.45 のフレームが窓から除外される（ロジック検証のみ、発動はしない）。 */
  assertEqual(core.FORM_PH.CONF_GATE, 0, "CONF_GATE ships disabled (0)");
  assertEqual(core.FORM_PH.DW_VIS_GATE, 0, "DW_VIS_GATE ships disabled (0)");
  const mkRawC = (anchorNorm, drawArm, conf) => ({
    anchorNorm,
    drawArm,
    conf,
    bodyScale: 0.25,
    dW: { x: 0, y: 0 },
  });
  const confMixedSeq = [];
  for (let i = 0; i < 60; i++) confMixedSeq.push([mkRawC(0.22, 150, 0.4), 0.02, 20]); // 低conf(0.4)のアンカー保持
  confMixedSeq.push([mkRawC(0.6, 140, 0.5), 10, 20]); // 高conf(0.5)の速度スパイク
  for (let i = 0; i < 10; i++) confMixedSeq.push([mkRawC(1.0, 90, 0.5), 0.2, 20]);
  assertEqual(
    runSequence(confMixedSeq).releases,
    1,
    "conf-mixed release fires with CONF_GATE=0 (current behavior)",
  );
  assert(coreScript.includes("CONF_GATE: 0,"), "CONF_GATE constant present for substitution test");
  const coreConfGate = new Function(
    `${coreScript.replace("CONF_GATE: 0,", "CONF_GATE: 0.45,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  assertEqual(
    runSequence(confMixedSeq, coreConfGate).releases,
    0,
    "CONF_GATE=0.45 excludes conf-0.4 frames from the window (closeFrames starve, no fire)",
  );
  // 除外の観測: ゲート済みフレームは窓内で null 側に数えられる（debug.nullFrames）
  const trace = (coreObj) => {
    const st = coreObj.makeFormPhaseDetector();
    const hist = [];
    let t = 0,
      spikeDebug = null;
    for (const [m, vel, dt] of confMixedSeq) {
      t += dt;
      hist.push({ ts: t, m, vel });
      const r = coreObj.stepFormPhase(st, m, hist, 1.0, t);
      if (m && m.anchorNorm === 0.6 && r.debug) spikeDebug = r.debug;
    }
    return spikeDebug;
  };
  const gated = trace(coreConfGate),
    ungated = trace(core);
  assert(
    gated && gated.nullFrames > 0,
    "gated low-conf frames counted as window gaps under CONF_GATE=0.45",
  );
  assert(
    ungated && ungated.nullFrames === 0,
    "no window gaps with CONF_GATE=0 on the same sequence",
  );
}
{
  /* B': dW 可視性ゲート。出荷値 DW_VIS_GATE=0 は完全無効＝現行同値。
     0.5 へ差し替えたコアでは低可視性 dW フレームの vel が maxV 評価から除外される。 */
  const mkRawV = (anchorNorm, drawArm, dwVis) => ({
    anchorNorm,
    drawArm,
    bodyScale: 0.25,
    dW: { x: 0, y: 0, visibility: dwVis },
  });
  const visMixedSeq = [];
  for (let i = 0; i < 60; i++) visMixedSeq.push([mkRawV(0.22, 150, 0.9), 0.02, 20]);
  visMixedSeq.push([mkRawV(0.6, 140, 0.4), 10, 20]); // 速度スパイクだが dW 可視性が低い（遮蔽由来の偽値を模擬）
  for (let i = 0; i < 10; i++) visMixedSeq.push([mkRawV(1.0, 90, 0.9), 0.2, 20]);
  assertEqual(
    runSequence(visMixedSeq).releases,
    1,
    "low-dW-visibility spike fires with DW_VIS_GATE=0 (current behavior)",
  );
  assert(
    coreScript.includes("DW_VIS_GATE: 0,"),
    "DW_VIS_GATE constant present for substitution test",
  );
  const coreDwGate = new Function(
    `${coreScript.replace("DW_VIS_GATE: 0,", "DW_VIS_GATE: 0.5,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  assertEqual(
    runSequence(visMixedSeq, coreDwGate).releases,
    0,
    "DW_VIS_GATE=0.5 removes the low-visibility spike from velocity evaluation (no fire)",
  );
}
{
  /* B'×D'相互作用（設計 form-phase-final-design.md §9-8、strict-review 2026-07-11
     「T8前の必須解消事項」）: 低confフレーム混在（conf除外がhasNullGapを増やすが実nullでは
     ない）系列で、CONF_GATE(0/0.45) × NB_MAX_GAP_MS(150/∞) の4通りの検出結果を固定する。
     シナリオは strict-review の合成再現条件と同一: 高confアンカー保持 → conf=0.3 の遮蔽
     180ms（実nullではない）→ NB_MAXV(2)超・RELEASE_TH(9)未満の vel=3 の緩慢な引き戻し。
       - CONF_GATE=0（出荷値）: ゲート無効なので遮蔽フレームも通常フレームとして扱われ、
         実nullが存在しない → hasNullGap 自体が立たず、NB_MAX_GAP_MS の値に関わらず非発火
         （0/150, 0/∞ の2通り）。
       - CONF_GATE=0.45 & NB_MAX_GAP_MS=150（両ゲートがT8で有効化される想定の組み合わせ）:
         conf除外フレームが hasNullGap を立てる一方、maxGapMs も同じ「win 基準」で 180ms を
         計測するため NB_MAX_GAP_MS(150) を超過し nullBridged は不成立＝非発火。ここが本コミット
         で修正した maxGapMs のゲート非対称の直接の回帰対象（46-form-core.js のループが旧来の
         `!h.m` 基準のままなら、conf除外フレームはここでカウントされず maxGapMs=0 のままとなり、
         誤って発火していたはずの組み合わせ）。
       - CONF_GATE=0.45 & NB_MAX_GAP_MS=∞: D' の時間上限そのものを無効化した組み合わせ。
         conf除外による仮想ギャップが無制限に橋渡しされるため発火する（D'を切った結果であり
         今回のfindingの対象外＝想定どおりの挙動）。 */
  const mkRawG = (anchorNorm, drawArm, conf) => ({
    anchorNorm,
    drawArm,
    conf,
    bodyScale: 0.25,
    dW: { x: 0, y: 0 },
  });
  function confGapInteractionSequence() {
    const seq = [];
    // 高confアンカー保持（10ms間隔110フレーム=1100ms）: REFRACTORY_MS(1000ms)を追い越しつつ
    // 250ms窓に十分な closeFrames を残す（gapBridgedSequence と同構成）
    for (let i = 0; i < 110; i++) seq.push([mkRawG(0.22, 150, 0.9), 0.02, 10]);
    // 遮蔽180ms: 実nullではなく conf=0.3 の低信頼フレーム（10フレーム×20ms、span=180ms）
    for (let i = 0; i < 10; i++) seq.push([mkRawG(0.22, 150, 0.3), 0.02, 20]);
    /* 復帰: NB_MAXV(2)超・RELEASE_TH(9)未満の vel=3（velOkでなくnullBridged経路を狙う）。
       2026-07-15 NB2 導入に伴い着地を 1.0 → 1.3 へ変更（NB2_MAX_ARRIVE=1.15 の適用外に
       置き、本テストが tier-1 の D' 時間上限だけを計測し続けるようにする。旧来の 1.0 着地は
       運動学的にリリース形状＝スナップして静止のため、NB2 が設計どおり発火してしまう）。
       tier-1 の評価量（hasNullGap/rise/maxV/maxGapMs）は着地位置に依存しないため、
       4組合せの意図は完全に保存される。瞬間ジャンプ構成は意図的（漸進引き戻しにすると
       ギャップが窓左端からスライドして出て、既知の文書化済み制約=maxGapMs過小評価を踏む） */
    seq.push([mkRawG(1.3, 90, 0.9), 3, 10]);
    for (let i = 0; i < 10; i++) seq.push([mkRawG(1.3, 90, 0.9), 0.2, 20]);
    return seq;
  }
  assert(
    coreScript.includes("CONF_GATE: 0,"),
    "CONF_GATE constant present for interaction substitution",
  );
  assert(
    coreScript.includes("NB_MAX_GAP_MS: 150,"),
    "NB_MAX_GAP_MS constant present for interaction substitution",
  );
  const coreGateOffGapInf = new Function(
    `${coreScript.replace("NB_MAX_GAP_MS: 150,", "NB_MAX_GAP_MS: Infinity,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  const coreGateOnGapOn = new Function(
    `${coreScript.replace("CONF_GATE: 0,", "CONF_GATE: 0.45,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  const coreGateOnGapInf = new Function(
    `${coreScript.replace("CONF_GATE: 0,", "CONF_GATE: 0.45,").replace("NB_MAX_GAP_MS: 150,", "NB_MAX_GAP_MS: Infinity,")}
return {makeFormPhaseDetector, stepFormPhase};`,
  )();
  const interactionSeq = confGapInteractionSequence();
  assertEqual(
    runSequence(interactionSeq, core).releases,
    0,
    "CONF_GATE=0 x NB_MAX_GAP_MS=150 (shipped): no real null frame, no fire",
  );
  assertEqual(
    runSequence(interactionSeq, coreGateOffGapInf).releases,
    0,
    "CONF_GATE=0 x NB_MAX_GAP_MS=Infinity: gate disabled, still no fire regardless of the gap cap",
  );
  assertEqual(
    runSequence(interactionSeq, coreGateOnGapOn).releases,
    0,
    "CONF_GATE=0.45 x NB_MAX_GAP_MS=150: conf-excluded 180ms gap exceeds the cap, correctly suppressed (maxGapMs fix under test)",
  );
  assertEqual(
    runSequence(interactionSeq, coreGateOnGapInf).releases,
    1,
    "CONF_GATE=0.45 x NB_MAX_GAP_MS=Infinity: D' time cap disabled, virtual gap bridges unconditionally (fires)",
  );
}
{
  // 連続2射: 不応期を挟んで両方検出
  const seq = [...shotSequence()];
  for (let i = 0; i < 10; i++) seq.push([mkRaw(1.5, 90), 0.05, 66]);
  for (let i = 0; i < 10; i++) seq.push([mkRaw(0.22, 150), 0.05, 66]);
  seq.push(...releaseFrames(80, 66, 0.22));
  for (let i = 0; i < 5; i++) seq.push([mkRaw(1.4, 90), 0.2, 66]);
  assertEqual(runSequence(seq).releases, 2, "two shots both detected");
}
{
  // 確定猶予: released 直後にアンカー圏へ即座に戻るスパイクは取消される
  const dt = 20;
  const st = core.makeFormPhaseDetector();
  const hist = [];
  let t = 0,
    releases = 0,
    canceled = 0;
  const push = (m, vel) => {
    t += dt;
    hist.push({ ts: t, m, vel });
    const r = core.stepFormPhase(st, m, hist, 1.0, t);
    if (r.released) releases++;
    if (r.canceled) canceled++;
    return r;
  };
  for (let i = 0; i < 60; i++) push(mkRaw(0.22, 125), 0.02);
  const fire = push(mkRaw(0.6, 140), 10); // 瞬間的な検出ノイズでTH超え
  assertEqual(fire.debug.fireEvidence, "close", "legacy cancel fixture fires from close evidence");
  for (let i = 0; i < 10; i++) push(mkRaw(0.23, 150), 0.05); // CONFIRM_MS以内にアンカー圏へ復帰
  assertEqual(releases, 1, "noise spike still registers as released");
  assertEqual(canceled, 1, "but is canceled once anchor returns within confirm window");
}
{
  // 人物未検出は IDLE
  const st = core.makeFormPhaseDetector();
  assertEqual(core.stepFormPhase(st, null, [], 1.0, 100).phase, "IDLE", "null metrics is IDLE");
}
{
  /* Plan-0（release-detection-triage-2026-07-13 §3.3/§5）: stepFormPhase の
     非発火・取消 return パスでも debug が返ることを検証する。判定ロジック（phase/
     released/canceled/anchorStartTs の値）は既存ケースが担保するのでここでは触らない。 */
  const assertDebugShape = (debug, label) => {
    assert(
      typeof debug === "object" && debug !== null,
      `${label}: debug returned on non-fire path`,
    );
    assert(
      "maxV" in debug && "anchorNorm" in debug && "closeFrames" in debug && "hasNullGap" in debug,
      `${label}: debug has maxV/anchorNorm/closeFrames/hasNullGap`,
    );
    ["rise", "nullFrames", "conf", "refractoryRemaining"].forEach((k) =>
      assert(k in debug, `${label}: debug has key ${k}`),
    );
  };

  // !usable（人物未検出）: win/closeFrames 未計算のため null で埋まるが debug 自体は必ず返る
  const rU = core.stepFormPhase(core.makeFormPhaseDetector(), null, [], 1.0, 100);
  assertDebugShape(rU.debug, "!usable path");
  assertAdaptiveResultShape(rU, "null path");
  assertEqual(
    rU.debug.anchorNorm,
    null,
    "!usable path: anchorNorm unknown, filled with null (not fabricated)",
  );

  // release-fire → canceled（確定猶予内にアンカー圏へ復帰）
  const dtC = 20;
  const stC = core.makeFormPhaseDetector();
  const histC = [];
  let tC = 0;
  const pushC = (m, vel) => {
    tC += dtC;
    histC.push({ ts: tC, m, vel });
    return core.stepFormPhase(stC, m, histC, 1.0, tC);
  };
  for (let i = 0; i < 60; i++) pushC(mkRaw(0.22, 125), 0.02);
  const rRelC = pushC(mkRaw(0.6, 140), 10); // 瞬間的な検出ノイズでTH超え(released)
  assertEqual(rRelC.released, true, "sanity: release fires before cancel scenario");
  assertEqual(rRelC.debug.fireEvidence, "close", "debug cancel fixture uses legacy close evidence");
  assertDebugShape(rRelC.debug, "release-fire path");
  assertAdaptiveResultShape(rRelC, "fire path");
  /* アンカー復帰取消（Plan-B 2連続フレーム → 2026-07-15 時間ベース CANCEL_DIP_MS=100 へ更新。
     実フィールド conf 0.5-0.7 のランドマーク幻出ランが 2 フレーム（33ms）を超え、実射への
     誤取消が観測されたため。dt=20ms では初回ディップから 100ms 経過後のフレームで取消。 */
  let rCancel = null;
  for (let i = 0; i < 6; i++) {
    const r = pushC(mkRaw(0.23, 150), 0.05);
    if (i < 5)
      assertEqual(
        r.canceled,
        undefined,
        `dip frame ${i + 1} (${(i + 1) * dtC}ms span) does not cancel yet`,
      );
    else rCancel = r;
  }
  assertEqual(rCancel.canceled, true, "sanity: cancel path reached at >=100ms dip span");
  assertDebugShape(rCancel.debug, "canceled path");
  assertAdaptiveResultShape(rCancel, "anchor-return cancel path");
  assertClose(
    rCancel.debug.anchorNorm,
    0.23,
    1e-9,
    "canceled path: anchorNorm captured (not lost) before state reset",
  );

  // sticky RELEASE lock（<250ms）と FOLLOW（250-1100ms）: 発火が確定し取消されないシナリオ
  const dtS = 20;
  const stS = core.makeFormPhaseDetector();
  const histS = [];
  let tS = 0;
  const pushS = (m, vel) => {
    tS += dtS;
    histS.push({ ts: tS, m, vel });
    return core.stepFormPhase(stS, m, histS, 1.0, tS);
  };
  for (let i = 0; i < 60; i++) pushS(mkRaw(0.22, 125), 0.02);
  const rRelS = pushS(mkRaw(0.6, 140), 10); // TH超えでreleased
  assertEqual(rRelS.released, true, "sanity: release fires before sticky/follow scenario");
  assertEqual(
    rRelS.debug.fireEvidence,
    "close",
    "sticky/follow fixture uses legacy close evidence",
  );
  const rSticky = pushS(mkRaw(1.0, 90), 0.2); // アンカー圏外へ離脱、250ms未満のsticky lock
  assertEqual(rSticky.phase, "RELEASE", "sanity: sticky RELEASE lock active");
  assertDebugShape(rSticky.debug, "sticky RELEASE-lock path");
  assertAdaptiveResultShape(rSticky, "RELEASE lock path");
  for (let i = 0; i < 12; i++) pushS(mkRaw(1.0, 90), 0.2); // 250ms超過させる
  const rFollow = pushS(mkRaw(1.0, 90), 0.2);
  assertEqual(rFollow.phase, "FOLLOW", "sanity: FOLLOW window active");
  assertDebugShape(rFollow.debug, "FOLLOW path");
  assertAdaptiveResultShape(rFollow, "FOLLOW path");

  // 通常の非発火パス（アンカー保持中、release条件未達）
  const stN = core.makeFormPhaseDetector();
  const histN = [];
  let tN = 0,
    rNormal;
  for (let i = 0; i < 5; i++) {
    tN += 20;
    histN.push({ ts: tN, m: mkRaw(0.22, 150), vel: 0.02 });
    rNormal = core.stepFormPhase(stN, mkRaw(0.22, 150), histN, 1.0, tN);
  }
  assertDebugShape(rNormal.debug, "normal non-fire path");
  assertAdaptiveResultShape(rNormal, "normal path");
  assert(
    rNormal.debug.closeFrames >= 0,
    "normal non-fire path: closeFrames is a real count, not null",
  );
}
{
  /* アンカー復帰取消の境界（Plan-B 2連続フレーム → 2026-07-15 時間ベース CANCEL_DIP_MS=100）:
     短い dip ラン（<100ms）は取消されない（実フィールドのランドマーク幻出ラン救済）。
     100ms 以上の連続 dip = 真のアンカー駐留のみ取消。
     復帰値は 1.0（実測のフォロースルー位置 1.3-1.7 に整合。0.6 は出発確認 DEPART_MIN=0.65
     未満のため恒久ホバーだと猶予終了時に no-depart 取消される — 意図的な仕様） */
  // (a) 80ms の dip ラン → 取消されない → 1.0 へ復帰して出発
  const stA = core.makeFormPhaseDetector();
  const histA = [];
  let tA = 0;
  const pushA = (m, vel) => {
    tA += 20;
    histA.push({ ts: tA, m, vel });
    return core.stepFormPhase(stA, m, histA, 1.0, tA);
  };
  for (let i = 0; i < 60; i++) pushA(mkRaw(0.22, 125), 0.02); // アンカー保持
  const rFireA = pushA(mkRaw(0.6, 140), 10); // release fire
  assertEqual(rFireA.released, true, "cancel boundary (a): release fires");
  assertEqual(rFireA.debug.fireEvidence, "close", "cancel boundary (a) uses legacy close evidence");
  for (let i = 0; i < 5; i++) {
    const r = pushA(mkRaw(0.3, 150), 0.05); // dip ラン 80ms（5フレーム、span=80ms<100）
    assertEqual(
      r.canceled,
      undefined,
      `cancel boundary (a): ${(i + 1) * 20}ms dip span does not cancel`,
    );
  }
  for (let i = 0; i < 10; i++) {
    const r = pushA(mkRaw(1.0, 150), 0.05); // 復帰・出発（DEPART_MIN 以上）
    assertEqual(r.canceled, undefined, "cancel boundary (a): recovery+depart, no cancel");
  }

  // (b) 100ms 以上の連続 dip → 取消される
  const stB = core.makeFormPhaseDetector();
  const histB = [];
  let tB = 0;
  const pushB = (m, vel) => {
    tB += 20;
    histB.push({ ts: tB, m, vel });
    return core.stepFormPhase(stB, m, histB, 1.0, tB);
  };
  for (let i = 0; i < 60; i++) pushB(mkRaw(0.22, 125), 0.02);
  const rFireB = pushB(mkRaw(0.6, 140), 10);
  assertEqual(rFireB.released, true, "cancel boundary (b): release fires");
  assertEqual(rFireB.debug.fireEvidence, "close", "cancel boundary (b) uses legacy close evidence");
  let canceledB = false;
  for (let i = 0; i < 6 && !canceledB; i++) {
    canceledB = pushB(mkRaw(0.28, 150), 0.05).canceled === true;
  }
  assertEqual(canceledB, true, "cancel boundary (b): >=100ms consecutive dip triggers cancel");
}
{
  /* 出発確認（2026-07-15）: 発火後、確定猶予内に手が出発しない（anchorNorm < DEPART_MIN の
     まま）発火はスプリアスとして猶予終了時に取消される。全null（姿勢ロス）の猶予は無罪推定 */
  // (a) 発火後 0.5 でホバーし続ける → 猶予終了時に no-depart 取消
  const stA = core.makeFormPhaseDetector();
  const histA = [];
  let tA = 0;
  const pushA = (m, vel) => {
    tA += 20;
    histA.push({ ts: tA, m, vel });
    return core.stepFormPhase(stA, m, histA, 1.0, tA);
  };
  for (let i = 0; i < 60; i++) pushA(mkRaw(0.22, 125), 0.02);
  const fireA = pushA(mkRaw(0.6, 140), 10);
  assertEqual(fireA.released, true, "depart (a): fires");
  assertEqual(fireA.debug.fireEvidence, "close", "depart (a) uses legacy close evidence");
  let sawCancelA = false,
    cancelReasonA = null;
  for (let i = 0; i < 25; i++) {
    const r = pushA(mkRaw(0.5, 140), 0.05); // 出発せずホバー（0.5 < DEPART_MIN=0.65）
    if (r.canceled) {
      sawCancelA = true;
      cancelReasonA = r.debug && r.debug.cancelReason;
      break;
    }
  }
  assertEqual(sawCancelA, true, "depart (a): hovering fire is canceled at confirm expiry");
  assertEqual(cancelReasonA, "no-depart", "depart (a): cancelReason=no-depart");
  // (b) 発火後 1.0 へ出発 → 取消されない
  const stB = core.makeFormPhaseDetector();
  const histB = [];
  let tB = 0;
  const pushB = (m, vel) => {
    tB += 20;
    histB.push({ ts: tB, m, vel });
    return core.stepFormPhase(stB, m, histB, 1.0, tB);
  };
  for (let i = 0; i < 60; i++) pushB(mkRaw(0.22, 125), 0.02);
  const fireB = pushB(mkRaw(0.6, 140), 10);
  assertEqual(fireB.released, true, "depart (b): fires");
  assertEqual(fireB.debug.fireEvidence, "close", "depart (b) uses legacy close evidence");
  for (let i = 0; i < 25; i++) {
    assertEqual(
      pushB(mkRaw(1.0, 140), 0.05).canceled,
      undefined,
      "depart (b): departed fire is never canceled",
    );
  }
  // (c) 発火後すべて姿勢ロス（null）→ 無罪推定でショット維持
  const stC = core.makeFormPhaseDetector();
  const histC = [];
  let tC = 0;
  const pushC = (m, vel) => {
    tC += 20;
    histC.push({ ts: tC, m, vel });
    return core.stepFormPhase(stC, m, histC, 1.0, tC);
  };
  for (let i = 0; i < 60; i++) pushC(mkRaw(0.22, 125), 0.02);
  const fireC = pushC(mkRaw(0.6, 140), 10);
  assertEqual(fireC.released, true, "depart (c): fires");
  assertEqual(fireC.debug.fireEvidence, "close", "depart (c) uses legacy close evidence");
  for (let i = 0; i < 25; i++) {
    assertEqual(
      pushC(null, 0).canceled,
      undefined,
      "depart (c): all-null confirm window never cancels",
    );
  }
  // 猶予明けの最初の有効フレーム（手が下=SETUP位置でも departSeen=false なので無罪）
  assertEqual(
    pushC(mkRaw(1.4, 90), 0.2).canceled,
    undefined,
    "depart (c): first frame after blind window does not cancel",
  );
}
{
  // DRAWING 方向チェック（Stage 0 E'）: anchorNorm 増加方向（レットダウン等）は DRAWING に遷移しない。
  // trend +0.1/フレーム、vel 0.5〜7.8 の範囲のレットダウン系列で DRAWING が一度も出ないこと
  [20, 66].forEach((dt) => {
    const seq = [];
    for (let i = 0; i < 30; i++) seq.push([mkRaw(0.22, 150), 0.02, dt]);
    for (let i = 1; i <= 9; i++) seq.push([mkRaw(0.22 + i * 0.1, 140), 0.1 / (dt / 1000), dt]); // 0.32→1.12
    for (let i = 0; i < 20; i++) seq.push([mkRaw(1.5, 90), 0.02, dt]);
    const r = runSequence(seq);
    assert(
      !r.phases.includes("DRAWING"),
      `let-down (dt=${dt}) never classified as DRAWING, got ${r.phases}`,
    );
    assertEqual(r.releases, 0, `let-down (dt=${dt}) direction-check sequence does not fire`);
  });
}
{
  // ゆっくりしたドロー（vel 0.3-0.5、trend 負）は引き続き DRAWING に到達する
  const dt = 66;
  const seq = [];
  for (let i = 0; i < 10; i++) seq.push([mkRaw(1.5, 90), 0.05, dt]);
  for (let i = 0; i < 25; i++) seq.push([mkRaw(1.15 - i * 0.03, 110), 0.45, dt]);
  const r = runSequence(seq);
  assert(
    r.phases.includes("DRAWING"),
    `slow draw with negative trend reaches DRAWING, got ${r.phases}`,
  );
}

/* ---------- computeFormVelocity（Stage 0 A1: 47の旧インライン実装と同値であること） ---------- */

{
  const mkM = (x, y) => ({ dW: { x, y }, bodyScale: 0.25 });
  // 通常系: 旧インライン実装 formDist(raw.dW, lv.m.dW)/dt/raw.bodyScale と同値
  const hist = [
    { ts: 100, m: mkM(0.5, 0.3), vel: 0 },
    { ts: 150, m: null, vel: 0 },
    { ts: 200, m: mkM(0.6, 0.3), vel: 1 },
  ];
  const raw = mkM(0.7, 0.3);
  const expected = core.formDist(raw.dW, hist[2].m.dW) / 0.05 / raw.bodyScale;
  assertClose(
    core.computeFormVelocity(hist, raw, 250),
    expected,
    1e-9,
    "velocity matches legacy inline computation",
  );
  assertClose(
    core.computeFormVelocity(hist, raw, 250),
    8,
    1e-9,
    "velocity value (0.1 / 0.05s / 0.25 torso)",
  );
  // 末尾が null フレームでも直近の有効フレームまで遡って基準にする
  const histNullTail = [
    { ts: 100, m: mkM(0.5, 0.3), vel: 0 },
    { ts: 200, m: null, vel: 0 },
  ];
  const expected2 = core.formDist(raw.dW, histNullTail[0].m.dW) / 0.15 / raw.bodyScale;
  assertClose(
    core.computeFormVelocity(histNullTail, raw, 250),
    expected2,
    1e-9,
    "trailing null frames are skipped",
  );
}
{
  const mkM = (x, y) => ({ dW: { x, y }, bodyScale: 0.25 });
  const raw = mkM(0.7, 0.3);
  // dt 境界: 0 以下と 0.5秒以上は 0（旧実装の dt>0 && dt<0.5 と同一）
  assertEqual(
    core.computeFormVelocity([{ ts: 250, m: mkM(0.5, 0.3), vel: 0 }], raw, 250),
    0,
    "dt=0 returns 0",
  );
  assertEqual(
    core.computeFormVelocity([{ ts: 300, m: mkM(0.5, 0.3), vel: 0 }], raw, 250),
    0,
    "negative dt returns 0",
  );
  assertEqual(
    core.computeFormVelocity([{ ts: 0, m: mkM(0.5, 0.3), vel: 0 }], raw, 500),
    0,
    "dt=0.5s boundary returns 0",
  );
  assert(
    core.computeFormVelocity([{ ts: 1, m: mkM(0.5, 0.3), vel: 0 }], raw, 500) > 0,
    "dt just under 0.5s is computed",
  );
  // 有効フレーム無し・raw 無しは 0
  assertEqual(
    core.computeFormVelocity(
      [
        { ts: 100, m: null, vel: 0 },
        { ts: 200, m: null, vel: 0 },
      ],
      raw,
      250,
    ),
    0,
    "all-null history returns 0",
  );
  assertEqual(core.computeFormVelocity([], raw, 250), 0, "empty history returns 0");
  assertEqual(
    core.computeFormVelocity([{ ts: 100, m: mkM(0.5, 0.3), vel: 0 }], null, 250),
    0,
    "null raw returns 0",
  );
}

/* ---------- makeFormVelocitySource（Stage 1 A2: 中立スキャフォールド） ---------- */

{
  // 出荷値は無効（pass-through）。発動は FORM_VEL_FILTER.ENABLED の1行変更のみ
  assertEqual(core.FORM_VEL_FILTER.ENABLED, false, "1-Euro velocity filter ships disabled");
}
{
  // ENABLED:false は computeFormVelocity と完全同値（null フレーム・空 history 含む）
  const mkM = (x, y) => ({ dW: { x, y }, bodyScale: 0.25 });
  const src = core.makeFormVelocitySource();
  const hist = [];
  let t = 0;
  [0.5, 0.51, 0.53, null, 0.56, 0.6, 0.6, 0.61].forEach((x) => {
    t += 33;
    const raw = x == null ? null : mkM(x, 0.3);
    assertEqual(
      src.step(hist, raw, t),
      core.computeFormVelocity(hist, raw, t),
      `disabled source matches computeFormVelocity at t=${t}`,
    );
    hist.push({ ts: t, m: raw, vel: 0 });
  });
  assertEqual(
    core.makeFormVelocitySource().step([], mkM(0.5, 0.3), 100),
    0,
    "disabled source on empty history returns 0",
  );
}
{
  // ENABLED:true（オプトインのロジック検証のみ・出荷値では動かない）
  const mkM = (x, y) => ({ dW: { x, y }, bodyScale: 0.25 });
  // (1) 等速運動: 収束後の速度が真値（0.01/0.02s/0.25 = 2.0 胴体長/秒）に近い
  const f1 = core.makeFormVelocitySource({ ENABLED: true });
  let t = 0,
    vel = 0;
  for (let i = 0; i < 60; i++) {
    t += 20;
    vel = f1.step([], mkM(0.3 + i * 0.01, 0.3), t);
  }
  assertClose(vel, 2.0, 0.2, "enabled filter converges to true velocity on constant motion");
  // (2) ジッター抑制: 交互±0.02ジッターの生速度は 8.0（RELEASE_TH級の偽スパイク）だが、フィルタ後は大幅減
  const f2 = core.makeFormVelocitySource({ ENABLED: true });
  t = 0;
  let maxFiltered = 0;
  for (let i = 0; i < 60; i++) {
    t += 20;
    const v = f2.step([], mkM(0.5 + (i % 2 ? 0.02 : -0.02), 0.3), t);
    if (i > 10) maxFiltered = Math.max(maxFiltered, v);
  }
  assert(maxFiltered < 2, `jitter velocity suppressed well below raw 8.0, got ${maxFiltered}`);
  // (3) RESET_GAP_MS 超のギャップで内部状態を作り直す（直後のフレームは vel 0）
  const f3 = core.makeFormVelocitySource({ ENABLED: true });
  f3.step([], mkM(0.5, 0.3), 100);
  f3.step([], mkM(0.52, 0.3), 120);
  assertEqual(
    f3.step([], mkM(0.9, 0.3), 800),
    0,
    "gap over RESET_GAP_MS reseeds the filter (vel 0)",
  );
  // (4) reset() で明示リセット（利き手切替等、history 破棄と同時に呼ぶ想定）
  const f4 = core.makeFormVelocitySource({ ENABLED: true });
  f4.step([], mkM(0.5, 0.3), 100);
  f4.reset();
  assertEqual(f4.step([], mkM(0.9, 0.3), 200), 0, "explicit reset reseeds (vel 0)");
}

/* ---------- anchorStartTs のコア内包化（Stage 0 C: sticky 仕様） ---------- */

function makeStepper(dt) {
  const st = core.makeFormPhaseDetector();
  const hist = [];
  let t = 0;
  return {
    push(m, vel) {
      t += dt;
      hist.push({ ts: t, m, vel });
      if (hist.length > 150) hist.shift();
      return { r: core.stepFormPhase(st, m, hist, 1.0, t), t };
    },
  };
}

{
  /* Legacy sticky contract, separate from adaptive learned-zone coverage:
     drawArm=125 is deliberately ineligible for an adaptive hold, so the small
     outward trend exercises the original DRAWING path. */
  const s = makeStepper(66);
  let firstAnchorTs = 0;
  for (let i = 0; i < 10; i++) {
    const { r } = s.push(mkRaw(0.33, 150), 0.05);
    if (!firstAnchorTs && (r.phase === "ANCHORING" || r.phase === "FULL_DRAW"))
      firstAnchorTs = r.anchorStartTs;
  }
  assert(firstAnchorTs > 0, "legacy DRAWING sticky fixture reaches anchor first");
  for (let i = 0; i < 3; i++) {
    const { r } = s.push(mkRaw(0.37, 125), 0.5);
    assertEqual(r.phase, "DRAWING", "adaptive-ineligible brief excursion uses legacy DRAWING");
    assertEqual(
      r.anchorStartTs,
      firstAnchorTs,
      "legacy DRAWING excursion preserves sticky anchorStartTs",
    );
  }
}
{
  // sticky: learned anchorEnter 内の約200msの一時離脱・ジッターでも adaptive hold が継続し、
  // anchorStartTs（= hold の起点）が通しで保持される
  const s = makeStepper(66);
  let firstAnchorTs = 0;
  for (let i = 0; i < 10; i++) {
    const { r, t } = s.push(mkRaw(0.33, 150), 0.05);
    if (!firstAnchorTs && (r.phase === "ANCHORING" || r.phase === "FULL_DRAW")) {
      firstAnchorTs = t;
      assertEqual(r.anchorStartTs, t, "anchorStartTs set on first anchoring frame");
    }
  }
  assert(firstAnchorTs > 0, "anchoring reached in sticky scenario");
  for (let i = 0; i < 3; i++) {
    const { r } = s.push(mkRaw(0.37, 150), 0.5); // absolute close 外だが learned anchorEnter 内
    assertEqual(r.phase, "FULL_DRAW", "brief learned-zone excursion remains adaptive FULL_DRAW");
    assertEqual(
      r.anchorStartTs,
      firstAnchorTs,
      "anchorStartTs sticky through learned-zone excursion",
    );
  }
  for (let i = 0; i < 5; i++) {
    const { r } = s.push(mkRaw(0.33, 150), 0.05);
    assertEqual(r.anchorStartTs, firstAnchorTs, "anchorStartTs unchanged after re-anchoring");
  }
  const rel = s.push(mkRaw(0.6, 140), 10); // 速度スパイクでリリース
  assertEqual(rel.r.released, true, "release fires after sticky excursion");
  assertEqual(
    rel.r.anchorStartTs,
    firstAnchorTs,
    "released frame returns pre-clear anchorStartTs (hold spans excursion)",
  );
  const after = s.push(mkRaw(1.0, 90), 0.2);
  assertEqual(after.r.anchorStartTs, 0, "anchorStartTs cleared after release");
}
{
  // リセット: ANCHORING → SETUP（完全離脱・低速）で anchorStartTs=0、再アンカーで新しい値
  const s = makeStepper(66);
  let firstAnchorTs = 0;
  for (let i = 0; i < 10; i++) {
    const { r, t } = s.push(mkRaw(0.3, 150), 0.05);
    if (!firstAnchorTs && (r.phase === "ANCHORING" || r.phase === "FULL_DRAW")) firstAnchorTs = t;
  }
  assert(firstAnchorTs > 0, "anchoring reached in reset scenario");
  let last = null;
  for (let i = 0; i < 6; i++) last = s.push(mkRaw(1.5, 90), 0.05);
  assertEqual(last.r.phase, "SETUP", "slow full withdrawal is SETUP");
  assertEqual(last.r.anchorStartTs, 0, "anchorStartTs reset on SETUP");
  let secondAnchorTs = 0;
  for (let i = 0; i < 5; i++) {
    const { r, t } = s.push(mkRaw(0.3, 150), 0.05);
    if (!secondAnchorTs && (r.phase === "ANCHORING" || r.phase === "FULL_DRAW")) secondAnchorTs = t;
  }
  assert(secondAnchorTs > firstAnchorTs, "re-anchor starts a new anchorStartTs");
}
{
  // canceled: 取消フレームで anchorStartTs=now（アンカー継続として仕切り直し）
  const s = makeStepper(20);
  for (let i = 0; i < 60; i++) s.push(mkRaw(0.22, 125), 0.02);
  const rel = s.push(mkRaw(0.6, 140), 10); // 瞬間ノイズで released
  assertEqual(rel.r.released, true, "noise spike releases before cancel");
  assertEqual(
    rel.r.debug.fireEvidence,
    "close",
    "sticky cancel fixture uses legacy close evidence",
  );
  assert(rel.r.anchorStartTs > 0, "released frame carries pre-clear anchorStartTs");
  // アンカー復帰取消は連続ディップのスパン >= CANCEL_DIP_MS(100ms) 要件（2026-07-15 時間ベース化）
  let cancel = null;
  for (let i = 0; i < 6 && !cancel; i++) {
    const r = s.push(mkRaw(0.23, 150), 0.05); // CONFIRM_MS 以内にアンカー圏へ復帰・駐留 → 取消
    if (r.r.canceled) cancel = r;
  }
  assert(cancel, "return to anchor (>=100ms dip span) cancels");
  assertEqual(cancel.r.anchorStartTs, cancel.t, "canceled frame restarts anchorStartTs at now");
}

/* ---------- リリース前ドリフト・アンカー再現性・1射要約 ---------- */

function anchorHistory(releaseTs, drift) {
  const hist = [];
  for (let ts = releaseTs - 900; ts <= releaseTs; ts += 60) {
    const k = drift ? (ts - (releaseTs - 900)) / 900 : 0;
    hist.push({
      ts,
      m: {
        anchorNorm: 0.22 + k * 0.02,
        bowArm: 171,
        drawArm: 150,
        shoulderDrop: 0.07,
        headOffset: 0.09,
        forceLine: 0.07,
        score: 80,
        conf: 0.9,
        bodyScale: 0.25,
        bW: { x: 0.2 + k * 0.06, y: 0.4 },
        dW: { x: 0.6, y: 0.31 },
      },
      vel: 0.05,
    });
  }
  return hist;
}

{
  const pre = core.formPreReleaseWindow(anchorHistory(10000, true), 10000);
  assert(pre && pre.frames >= 2, "pre-release window has frames");
  assert(pre.bowDrift, "bow-hand drift flagged");
  const stable = core.formPreReleaseWindow(anchorHistory(10000, false), 10000);
  assert(stable && !stable.bowDrift && !stable.drawDrift, "stable window not flagged");
  assertEqual(core.formPreReleaseWindow([], 10000), null, "empty history");
}
{
  const av = core.formAnchorVariation([
    { anchorNorm: 0.2 },
    { anchorNorm: 0.21 },
    { anchorNorm: 0.22 },
  ]);
  assertEqual(av.label, "安定", "tight anchors are stable");
  const loose = core.formAnchorVariation([{ anchorNorm: 0.15 }, { anchorNorm: 0.4 }]);
  assertEqual(loose.label, "ばらつき大", "loose anchors flagged");
  assertEqual(core.formAnchorVariation([]).std, null, "no shots no std");
}
{
  const hist = anchorHistory(10000, false);
  const shot = core.summarizeFormShot(hist, 9100, 10000);
  assert(shot, "shot summary computed");
  assertEqual(shot.holdMs, 900, "hold time");
  assertClose(shot.angles.bowArm, 171, 1e-9, "median bow arm");
  assert(shot.confidence > 0.8, "summary confidence");
  assertEqual(core.summarizeFormShot([], 0, 10000), null, "no history no summary");
}
{
  const hist = [];
  for (let ts = 9200; ts <= 9800; ts += 100) {
    hist.push({
      ts,
      m: {
        anchorNorm: 0.55,
        bowArm: 171,
        drawArm: 150,
        shoulderDrop: 0.07,
        headOffset: 0.09,
        forceLine: 0.07,
        score: 80,
        conf: 0.9,
        bodyScale: 0.25,
        bW: { x: 0.2, y: 0.4 },
        dW: { x: 0.6, y: 0.31 },
      },
      vel: 0.05,
    });
  }
  const adaptive = core.summarizeFormShot(hist, 9100, 10000, 0.6);
  assert(adaptive, "active anchor threshold produces a shot summary");
  assertEqual(adaptive.degraded, false, "active anchor threshold keeps the primary summary window");
  assertEqual(adaptive.frames, 7, "active anchor threshold uses all valid 0.55 hold frames");
  const legacy = core.summarizeFormShot(hist, 9100, 10000);
  assert(legacy, "three-argument summary remains available");
  assertEqual(legacy.degraded, true, "three-argument summary preserves the legacy 0.45 window");
  assertEqual(legacy.frames, 5, "three-argument summary preserves loose fallback selection");
}

/* ---------- Task 5: capture/replay active-geometry integration contracts ---------- */

{
  const capture = boundedSourceSection(
    viewScript,
    "function openFormCapture(){",
    "function openFormReplay(){",
    "openFormCapture section",
  );
  const replay = boundedSourceSection(
    viewScript,
    "function startFormReplay(videoUrl){",
    '    hud.textContent="射形解析を開始できませんでした: "+(e&&e.message||e);',
    "startFormReplay section",
  );
  const reset = boundedSourceSection(
    capture,
    "function resetCaptureGeometry(){",
    "function loop(){",
    "resetCaptureGeometry section",
  );
  const startCamera = boundedSourceSection(
    capture,
    "async function startCamera(){",
    "function refreshShotsHint(){",
    "startCamera section",
  );
  const startCameraCompact = compactSource(startCamera);
  assert(
    startCameraCompact.includes("letnextStream=null;") &&
      startCameraCompact.includes("nextStream=awaitnavigator.mediaDevices.getUserMedia(") &&
      startCameraCompact.includes("video.srcObject=nextStream;") &&
      startCameraCompact.includes("awaitvideo.play();") &&
      startCameraCompact.includes("stream=nextStream;") &&
      startCameraCompact.includes("if(nextStream)nextStream.getTracks().forEach(t=>t.stop());") &&
      startCameraCompact.includes("if(video.srcObject===nextStream)video.srcObject=null;") &&
      startCameraCompact.includes("throwe;"),
    "camera startup cleans a newly acquired stream when startup or play fails",
  );
  assertEqual(
    compactSource(reset),
    compactSource(`function resetCaptureGeometry() {
      if (pendingCheck) finalizeArrowCheck();
      detector = makeFormPhaseDetector();
      ema = makeFormEma(0.38);
      history = [];
      velSrc.reset();
      presenceRing = [];
      pendingCheck = null;
      recentFrames = [];
      lastAnchoringSampleAt = 0;
    }`),
    "capture geometry reset keeps the approved ordered body",
  );
  assert(!/\bshots\s*=\s*\[\]/.test(reset), "capture geometry reset preserves counted shots");

  const swap = boundedSourceSection(
    capture,
    'ovl.querySelector("#fcSwap").onclick=async()=>{',
    'ovl.querySelector("#fcHand").onclick=e=>{',
    "#fcSwap handler",
  );
  const hand = boundedSourceSection(
    capture,
    'ovl.querySelector("#fcHand").onclick=e=>{',
    'ovl.querySelector("#fcCrop").onclick=e=>{',
    "#fcHand handler",
  );
  const crop = boundedSourceSection(
    capture,
    'ovl.querySelector("#fcCrop").onclick=e=>{',
    'ovl.querySelector("#fcRec").onclick=e=>{',
    "#fcCrop handler",
  );
  [swap, hand, crop].forEach((handler, index) =>
    assert(
      handler.includes("resetCaptureGeometry();"),
      ["camera swap", "live handedness", "crop toggle"][index] + " resets capture geometry",
    ),
  );
  const swapCompact = compactSource(swap);
  const swapGuard = swapCompact.indexOf("if(cameraSwapInProgress)return;");
  const swapLock = swapCompact.indexOf("cameraSwapInProgress=true;");
  const swapFacing = swapCompact.indexOf("facing=");
  const swapReset = swapCompact.indexOf("resetCaptureGeometry();");
  const swapAwait = swapCompact.indexOf("await");
  assert(
    swapGuard >= 0 &&
      swapLock > swapGuard &&
      swapFacing > swapLock &&
      swapReset > swapFacing &&
      swapAwait > swapReset,
    "camera swap resets synchronously after facing changes and before its first await",
  );
  assert(
    capture.includes("cameraSwapInProgress") &&
      /if\s*\(\s*landmarker\s*&&\s*!cameraSwapInProgress/.test(capture) &&
      swapCompact.includes("finally{") &&
      swapCompact.indexOf("cameraSwapInProgress=false;") > swapCompact.indexOf("finally{"),
    "capture loop skips replacement frames and unlocks camera swap after failure",
  );
  const previousFacing = swapCompact.indexOf("constpreviousFacing=facing;");
  const oldStream = swapCompact.indexOf("constoldStream=stream;");
  const invalidateStream = swapCompact.indexOf("stream=null;");
  const detachVideo = swapCompact.indexOf("video.srcObject=null;");
  const stopOldStream = swapCompact.indexOf(
    "if(oldStream)oldStream.getTracks().forEach(t=>t.stop());",
  );
  const restoreFacing = swapCompact.indexOf("facing=previousFacing;");
  const catchBlock = swapCompact.indexOf("catch(e){");
  assert(
    previousFacing >= 0 &&
      previousFacing < swapFacing &&
      oldStream > swapReset &&
      invalidateStream > oldStream &&
      detachVideo > invalidateStream &&
      stopOldStream > detachVideo &&
      stopOldStream < swapAwait &&
      catchBlock > swapAwait &&
      restoreFacing > catchBlock,
    "failed camera swap restores facing after invalidating and stopping the old stream",
  );
  assert(
    compactSource(capture).includes(
      'if(landmarker&&!cameraSwapInProgress&&stream&&stream.getVideoTracks().some(t=>t.readyState==="live")&&video.srcObject===stream&&video.readyState>=2)',
    ),
    "capture loop requires the attached stream to have a live video track",
  );

  assert(
    /function\s+onShot\s*\(\s*now\s*,\s*anchorStartTs\s*,\s*activeAnchorEnter\s*,\s*debug\s*\)/.test(
      capture,
    ) &&
      /summarizeFormShot\s*\(\s*history\s*,\s*anchorStartTs\s*,\s*now\s*,\s*activeAnchorEnter\s*\)/.test(
        capture,
      ) &&
      /onShot\s*\(\s*now\s*,\s*anchorStartTs\s*,\s*r\.anchorEnter\s*,\s*debug\s*\)/.test(capture),
    "capture passes the top-level active anchor threshold into shot summaries",
  );
  assert(
    /function\s+onShot\s*\(\s*now\s*,\s*anchorStartTs\s*,\s*activeAnchorEnter\s*\)/.test(replay) &&
      /summarizeFormShot\s*\(\s*history\s*,\s*anchorStartTs\s*,\s*now\s*,\s*activeAnchorEnter\s*\)/.test(
        replay,
      ) &&
      /onShot\s*\(\s*now\s*,\s*r\.anchorStartTs\s*,\s*r\.anchorEnter\s*\)/.test(replay),
    "replay passes the top-level active anchor threshold into shot summaries",
  );
  assert(
    !capture.includes("debug.anchorEnter") && !replay.includes("debug.anchorEnter"),
    "view integrations never substitute debug anchor geometry",
  );
  assert(
    !replay.includes("resetCaptureGeometry"),
    "replay does not call the capture-only geometry helper",
  );
  const replayHand = boundedSourceSection(
    replay,
    'ovl.querySelector("#frHand").onclick=e=>{',
    "loadFormPose().then(async lm=>{",
    "replay handedness handler",
  );
  const replayHandCompact = compactSource(replayHand);
  [
    "detector=makeFormPhaseDetector();",
    "ema=makeFormEma(0.38);",
    "history=[];",
    "velSrc.reset();",
  ].forEach((resetExpression) =>
    assert(
      replayHandCompact.includes(compactSource(resetExpression)),
      `replay handedness locally resets ${resetExpression}`,
    ),
  );
}

/* ---------- T-Anchor（Stage 1 §12.3）: pre-release 窓の anchorStartTs クランプ ---------- */

/* 短ホールド射の合成履歴（60ms間隔）。anchorStartTs より前は DRAWING 相当
   （手首が大きく移動・アンカー圏外）、以降は完全に静止したホールド。 */
function shortHoldHistory(releaseTs, anchorStartTs) {
  const hist = [];
  for (let ts = releaseTs - 900; ts <= releaseTs; ts += 60) {
    const drawing = ts < anchorStartTs;
    const k = drawing ? (anchorStartTs - ts) / 1000 : 0; // 遡るほどアンカーから遠い位置
    hist.push({
      ts,
      m: {
        anchorNorm: drawing ? 0.8 : 0.22,
        bowArm: 171,
        drawArm: 150,
        shoulderDrop: 0.07,
        headOffset: 0.09,
        forceLine: 0.07,
        score: 80,
        conf: 0.9,
        bodyScale: 0.25,
        bW: { x: 0.2 + k * 0.5, y: 0.4 },
        dW: { x: 0.6 + k * 0.5, y: 0.31 },
      },
      vel: drawing ? 3 : 0.05,
    });
  }
  return hist;
}

{
  // ホールド300ms（<FULLDRAW_MS=350ms）の射: クランプ無しでは固定500ms窓の前半が
  // DRAWING 区間へ食い込み、静止ホールドなのにドリフト扱いになる（実射で確認した症状）
  const hist = shortHoldHistory(10000, 9700);
  const unclamped = core.formPreReleaseWindow(hist, 10000);
  assert(
    unclamped && unclamped.bowDrift && unclamped.drawDrift,
    "short-hold shot without clamp is contaminated by DRAWING frames (documents the symptom)",
  );
  // クランプあり: 窓が anchorStartTs 以降に限定され、静止ホールドが正しく stable 判定になる
  const clamped = core.formPreReleaseWindow(hist, 10000, null, 9700);
  assert(clamped, "clamped window still has enough frames");
  assertEqual(clamped.frames, 4, "clamped window contains only frames at/after anchorStartTs");
  assert(
    !clamped.bowDrift && !clamped.drawDrift && !clamped.headDrift,
    `clamped short-hold window is stable, got bowMove=${clamped.bowMove} drawMove=${clamped.drawMove}`,
  );
  assert(unclamped.frames > clamped.frames, "clamp strictly narrows the window");
}
{
  // アンカー未保持（anchorStartTs が 0/null/未指定）は現行と同値
  const hist = shortHoldHistory(10000, 9700);
  const legacy = core.formPreReleaseWindow(hist, 10000);
  assertEqual(
    JSON.stringify(core.formPreReleaseWindow(hist, 10000, null, 0)),
    JSON.stringify(legacy),
    "anchorStartTs=0 behaves exactly like current code",
  );
  assertEqual(
    JSON.stringify(core.formPreReleaseWindow(hist, 10000, null, null)),
    JSON.stringify(legacy),
    "anchorStartTs=null behaves exactly like current code",
  );
  // ホールドが窓より長い（anchorStartTs が releaseTs-500ms より前）ならクランプは no-op
  assertEqual(
    JSON.stringify(core.formPreReleaseWindow(hist, 10000, null, 9000)),
    JSON.stringify(legacy),
    "anchorStartTs earlier than the 500ms window is a no-op",
  );
  // ホールドが極端に短く窓内に2フレーム残らない場合は汚染値でなく null
  assertEqual(
    core.formPreReleaseWindow(hist, 10000, null, 9860),
    null,
    "ultra-short hold yields null instead of DRAWING-contaminated values",
  );
}
{
  // summarizeFormShot 経由（エンドツーエンド）: ホールド300msの射でも pre が stable になる
  const hist = shortHoldHistory(10000, 9700);
  const shot = core.summarizeFormShot(hist, 9700, 10000);
  assert(shot && shot.pre, "short-hold shot summary has a pre-release window");
  assertEqual(shot.holdMs, 300, "short hold time");
  assert(
    !shot.pre.bowDrift && !shot.pre.drawDrift,
    "short-hold pre window is stable via summarizeFormShot",
  );
  // アンカー未保持の射は現行と同値（クランプ不発）
  const noAnchor = core.summarizeFormShot(hist, null, 10000);
  assertEqual(
    JSON.stringify(noAnchor && noAnchor.pre),
    JSON.stringify(core.formPreReleaseWindow(hist, 10000)),
    "summary without anchorStartTs keeps the legacy unclamped window",
  );
}

/* ---------- 記録統計・コーチングコメント・トレンド・得点との関係 ---------- */

function makeFormRecord(id, date, opts) {
  const o = opts || {};
  const stable = o.stable == null ? true : o.stable;
  const feature = (i) => ({
    phase: { anchorMs: o.holdMs == null ? 1800 : o.holdMs },
    angles: {
      bowArm: o.bowArm == null ? 171 : o.bowArm,
      drawArm: o.drawArm == null ? 150 : o.drawArm,
    },
    anchorNorm: 0.2 + i * (o.anchorSpread || 0.002),
    release: { bowMove: 0.02, drawMove: 0.02, stable },
    confidence: 0.9,
    score: 80,
  });
  return {
    id,
    date,
    ts: o.ts || 0,
    sessionId: o.sessionId || null,
    setupId: null,
    shots: o.shots || 3,
    modelVer: "test",
    appVer: 66,
    fps: 20,
    features: Array.from({ length: o.shots || 3 }, (_, i) => feature(i)),
    note: "",
  };
}

{
  const st = core.formRecordStats(
    makeFormRecord("r1", "2026-07-01", { holdMs: 2000, bowArm: 168 }),
  );
  assertEqual(st.shots, 3, "record stats shot count");
  assertClose(st.bowArm, 168, 1e-9, "record stats bow arm median");
  assertClose(st.holdMs, 2000, 1e-9, "record stats hold median");
  assertEqual(st.driftRate, 0, "all-stable record has zero drift rate");
  assertEqual(core.formRecordStats({ features: [] }), null, "empty record stats");
  assertEqual(core.formRecordStats(null), null, "null record stats");
}
{
  // ドリフトが多い記録: 原因候補と「次の練習」にドリフト対策が入る
  const drifty = makeFormRecord("r2", "2026-07-02", { stable: false });
  const ins = core.formRecordInsights(drifty);
  assert(
    ins.facts.some((t) => t.includes("ドリフト")),
    "drift observed in facts",
  );
  assert(ins.causes.length >= 1, "drifty record has causes");
  assert(
    ins.next.some((t) => t.includes("弓手固定")),
    "drift countermeasure in next",
  );
}
{
  // 安定した記録: 既定の「次の練習」だけが出る
  const ins = core.formRecordInsights(makeFormRecord("r3", "2026-07-02", {}));
  assert(
    ins.next.length === 1 && ins.next[0].includes("同じ撮影角度"),
    "stable record gets default next",
  );
}
{
  // 前回比: 保持時間の変化が原因候補に載る
  const prev = makeFormRecord("p", "2026-07-01", { holdMs: 1500 });
  const cur = makeFormRecord("c", "2026-07-02", { holdMs: 2600 });
  const ins = core.formRecordInsights(cur, prev);
  assert(
    ins.causes.some((t) => t.includes("前回より") && t.includes("長く")),
    "hold delta vs previous reported",
  );
}
{
  // 2026-07-05: エリート基準（172°等）との比較表示は撤去。自分基準（前回比）のみ言及する
  const prev = makeFormRecord("p2", "2026-07-01", { bowArm: 168 });
  const cur = makeFormRecord("c2", "2026-07-02", { bowArm: 180 });
  const ins = core.formRecordInsights(cur, prev);
  const allText = [...ins.facts, ...ins.causes, ...ins.checks, ...ins.next].join(" ");
  assert(!allText.includes("エリート基準"), "no elite-reference wording in insights");
  assert(
    !allText.includes(String(core.FORM_REF.bowArmAngle.ideal)),
    "no elite ideal-angle number leaks into insights",
  );
  assert(
    ins.facts.some((t) => t.includes("前回比") && t.includes("+12")),
    "bow-arm self-baseline delta reported",
  );
}
{
  // 3射未満（中央値が出るまで）は formRecordStats 自体は計算できるが、
  // 呼び出し側（47-form-view.js）は生値表示に切り替える前提。ここではコア側が
  // 単純に中央値を返すだけであることを確認する（表示切替はビュー側の責務）。
  const single = makeFormRecord("s1", "2026-07-03", { shots: 1, bowArm: 175 });
  const st = core.formRecordStats(single);
  assertEqual(st.shots, 1, "single-shot record still yields stats");
}
{
  const series = core.formTrendSeries([
    makeFormRecord("b", "2026-07-02", { ts: 2 }),
    makeFormRecord("a", "2026-07-01", { ts: 1 }),
  ]);
  assertEqual(series.length, 2, "trend series length");
  assertEqual(series[0].id, "a", "trend series sorted by date");
  assert(
    Number.isFinite(series[0].bowArm) && Number.isFinite(series[0].holdS),
    "trend point fields",
  );
  assertEqual(core.formTrendSeries([]).length, 0, "empty trend series");
}
{
  const sessions = [
    { id: "s1", ends: [[{ s: 10 }, { s: 9 }]] },
    { id: "s2", ends: [[{ s: 7 }, { s: 6 }]] },
  ];
  const metricsFn = (s) => {
    const all = s.ends.flat();
    const total = all.reduce((a, x) => a + x.s, 0);
    return { all, total, avg: all.length ? total / all.length : 0, st: null };
  };
  const records = [
    makeFormRecord("f1", "2026-07-01", { sessionId: "s1", stable: true }),
    makeFormRecord("f2", "2026-07-02", { sessionId: "s2", stable: false }),
    makeFormRecord("f3", "2026-07-03", {}), // 未紐付け
  ];
  const link = core.formScoreLink(records, sessions, metricsFn);
  assertEqual(link.n, 2, "only linked records pair up");
  assert(link.split, "split computed with both stable and drifty");
  assertClose(link.split.stableAvg, 9.5, 1e-9, "stable-day average");
  assertClose(link.split.driftAvg, 6.5, 1e-9, "drift-day average");
  const none = core.formScoreLink([makeFormRecord("f4", "2026-07-04", {})], sessions, metricsFn);
  assertEqual(none.n, 0, "unlinked records give no pairs");
  assertEqual(none.split, null, "no split without pairs");
}

/* ---------- 矢プレゼンス検出（合成フレーム） ---------- */

/* mulberry32: 低ビットの周期性が弱い簡易 PRNG。ANSI C 由来の単純 LCG は低ビットに
   短周期があり、背景ノイズが偶然「線っぽい」周期パターンを作ってしまい検出器の
   分離性テストとして不適切だったため、こちらに置き換えた。 */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 合成 RGBA バッファを作る。bg=背景輝度(0-255), noiseAmp=一様乱数ノイズ振幅。
   seed 付き PRNG でテストの再現性を保つ。 */
function makeFrame(w, h, bg, noiseAmp, seed) {
  const data = new Uint8ClampedArray(w * h * 4);
  const rnd = makeRng(seed == null ? 1 : seed);
  for (let i = 0; i < w * h; i++) {
    const n = noiseAmp ? (rnd() * 2 - 1) * noiseAmp : 0;
    const v = Math.max(0, Math.min(255, bg + n));
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

/* frame に p1-p2 を結ぶ細線（幅 lineW px, 輝度 lineVal）を描く。occludeFrac が
   与えられれば線分中央付近をその比率だけ背景輝度で塗り戻す（レスト付近の部分遮蔽を模擬）。 */
function drawLine(frame, p1, p2, lineVal, lineW, occludeFrac) {
  const { data, width: w, height: h } = frame;
  const x1 = p1.x * w,
    y1 = p1.y * h,
    x2 = p2.x * w,
    y2 = p2.y * h;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.ceil(len * 2);
  const halfW = lineW / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (occludeFrac && Math.abs(t - 0.5) < occludeFrac / 2) continue; // 中央部を遮蔽
    const cx = x1 + (x2 - x1) * t,
      cy = y1 + (y2 - y1) * t;
    for (let ox = -halfW; ox <= halfW; ox++) {
      for (let oy = -halfW; oy <= halfW; oy++) {
        const xi = Math.round(cx + ox),
          yi = Math.round(cy + oy);
        if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue;
        const i2 = (yi * w + xi) * 4;
        data[i2] = lineVal;
        data[i2 + 1] = lineVal;
        data[i2 + 2] = lineVal;
      }
    }
  }
  return frame;
}

/* p1-p2 を中点まわりに deg 度だけ回転させた新しい点対を返す（傾き検証用） */
function rotatePts(p1, p2, deg) {
  const mx = (p1.x + p2.x) / 2,
    my = (p1.y + p2.y) / 2;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad),
    sin = Math.sin(rad);
  const rot = (p) => {
    const dx = p.x - mx,
      dy = p.y - my;
    return { x: mx + dx * cos - dy * sin, y: my + dx * sin + dy * cos };
  };
  return [rot(p1), rot(p2)];
}

const AP_P1 = { x: 0.2, y: 0.5 },
  AP_P2 = { x: 0.8, y: 0.5 };
const AP_W = 200,
  AP_H = 200;

{
  // (a) 黒地に細線あり → 高スコア
  const f = drawLine(makeFrame(AP_W, AP_H, 20, 0, 1), AP_P1, AP_P2, 230, 2);
  const score = core.arrowPresence(f, AP_P1, AP_P2);
  assert(score > 0.8, `synthetic line on dark bg scores high, got ${score}`);
}
{
  // (b) 線なし → 低スコア
  const f = makeFrame(AP_W, AP_H, 20, 0, 1);
  const score = core.arrowPresence(f, AP_P1, AP_P2);
  assertEqual(score, 0, `no line present scores zero, got ${score}`);
}

const scoreTable = [];
function recordCase(label, score) {
  scoreTable.push({ label, score: +score.toFixed(3) });
}

{
  // (c) ノイズ・背景テクスチャ・部分遮蔽・傾き±15° の合成条件下での分離性
  const withLine = [];
  const withoutLine = [];

  // ノイズ背景（線あり/なし）
  {
    const f = drawLine(makeFrame(AP_W, AP_H, 40, 12, 7), AP_P1, AP_P2, 220, 2);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("noisy bg + line", s);
    withLine.push(s);
  }
  {
    const f = makeFrame(AP_W, AP_H, 40, 12, 7);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("noisy bg, no line", s);
    withoutLine.push(s);
  }
  // 背景テクスチャ（強めノイズ、線あり/なし）
  {
    const f = drawLine(makeFrame(AP_W, AP_H, 60, 25, 42), AP_P1, AP_P2, 210, 2);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("textured bg + line", s);
    withLine.push(s);
  }
  {
    const f = makeFrame(AP_W, AP_H, 60, 25, 42);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("textured bg, no line", s);
    withoutLine.push(s);
  }
  // 部分遮蔽（レスト付近、線の中央20%を欠損させても検出できるか）
  {
    const f = drawLine(makeFrame(AP_W, AP_H, 30, 8, 3), AP_P1, AP_P2, 220, 2, 0.2);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("partially occluded line (rest area)", s);
    withLine.push(s);
  }
  // 傾き ±15°（線あり/なし）
  [15, -15].forEach((deg) => {
    const [q1, q2] = rotatePts(AP_P1, AP_P2, deg);
    const f = drawLine(makeFrame(AP_W, AP_H, 35, 10, 11 + deg), q1, q2, 215, 2);
    const s = core.arrowPresence(f, q1, q2);
    recordCase(`tilted ${deg}deg + line`, s);
    withLine.push(s);
    const fNo = makeFrame(AP_W, AP_H, 35, 10, 11 + deg);
    const sNo = core.arrowPresence(fNo, q1, q2);
    recordCase(`tilted ${deg}deg, no line`, sNo);
    withoutLine.push(sNo);
  });
  // (d) 明暗2条件（明るい背景+暗い線／暗い背景+明るい線）
  {
    const f = drawLine(makeFrame(AP_W, AP_H, 220, 6, 5), AP_P1, AP_P2, 30, 2);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("bright bg, dark line", s);
    withLine.push(s);
  }
  {
    const f = drawLine(makeFrame(AP_W, AP_H, 15, 6, 6), AP_P1, AP_P2, 200, 2);
    const s = core.arrowPresence(f, AP_P1, AP_P2);
    recordCase("dark bg, bright line", s);
    withLine.push(s);
  }

  const minWith = Math.min(...withLine);
  const maxWithout = Math.max(...withoutLine);

  console.log("\n矢プレゼンス検出: 合成フレーム分離性テーブル");
  console.log("label".padEnd(36), "score");
  scoreTable.forEach((r) => console.log(r.label.padEnd(36), r.score));
  console.log(
    `  min(あり)=${minWith.toFixed(3)}  max(なし)=${maxWithout.toFixed(3)}  分離しきい値候補=${core.ARROW_PRESENCE.PRESENT_TH}`,
  );

  assert(
    minWith > maxWithout,
    `presence/absence score distributions must not overlap: min(with)=${minWith} <= max(without)=${maxWithout}`,
  );
  assert(
    minWith > core.ARROW_PRESENCE.PRESENT_TH,
    `weakest "present" case must clear PRESENT_TH, got ${minWith}`,
  );
  assert(
    maxWithout < core.ARROW_PRESENCE.PRESENT_TH,
    `strongest "absent" case must stay below PRESENT_TH, got ${maxWithout}`,
  );
}
{
  // 境界: null 入力
  assertEqual(core.arrowPresence(null, AP_P1, AP_P2), 0, "null imageData scores zero");
  assertEqual(
    core.arrowPresence(makeFrame(10, 10, 0, 0, 1), null, AP_P2),
    0,
    "null p1 scores zero",
  );
  assertEqual(
    core.arrowPresence(makeFrame(10, 10, 0, 0, 1), AP_P1, AP_P1),
    0,
    "degenerate zero-length segment scores zero",
  );
}

/* ---------- 矢プレゼンス シャドー判定 (judgeArrowCheck) ---------- */

{
  // 矢が消えた（発射と一致）: 猶予窓のスコアが低い
  const r = core.judgeArrowCheck([0.9, 0.85, 0.95], [0.1, 0.0, 0.05]);
  assertEqual(r.judgment, "shot-match", "arrow gone in confirm window matches shot");
}
{
  // 矢がまだある（レットダウンの疑い）: 猶予窓のスコアが高いまま
  const r = core.judgeArrowCheck([0.9, 0.85, 0.95], [0.8, 0.75, 0.9]);
  assertEqual(
    r.judgment,
    "letdown-mismatch",
    "arrow still present in confirm window flags mismatch",
  );
}
{
  // グレーゾーン: しきい値の間
  const r = core.judgeArrowCheck([0.9, 0.85], [0.45, 0.48]);
  assertEqual(r.judgment, "unclear", "mid-range confirm score is unclear");
}
{
  // 猶予窓のスコアが無い（フレーム取得失敗等）
  const r = core.judgeArrowCheck([0.9], []);
  assertEqual(r.judgment, "unclear", "no confirm-window samples is unclear");
  assertEqual(r.confirmScore, null, "confirmScore null when no samples");
}
{
  // preScores が空でも confirm 側だけで判定できる
  const r = core.judgeArrowCheck([], [0.05, 0.1]);
  assertEqual(r.judgment, "shot-match", "judgment works without pre-release samples");
  assertEqual(r.preScore, null, "preScore null when no samples");
}

console.log("Form core checks OK");
