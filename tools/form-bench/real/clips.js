"use strict";
/* Real landmark streams from licensed stock footage (fixtures written by extract-real.js).

   loadRealClips(dir) -> [{id, fixture, frames, meta}] where frames is the detector input
   [{tMs, landmarks: 33 entries | null}] and meta = {frame: {w, h}, handedness, fps}.
   Only the 13 stored points (nose, ears, shoulders, elbows, wrists, hips, knees) carry values;
   the other 20 indices are null. A detector that needs them cannot be scored on real clips.

   scoreRealClip(fixture, result) compares the adapter's shots (kind other than "letdown") with
   the reviewed expectation from tools/golden-replay/expectations.json: the shot count, and whether
   each detected release falls inside an accepted release window (one release per window). The
   visual shot count (sources.md plus a frame check for this benchmark) is reported next to it;
   it is null when no release could be seen (pixabay-40769: a montage of full-draw scenes). */

const fs = require("fs");
const path = require("path");

const SCHEMA = "form-bench-real-v1";
const LM_COUNT = 33;

function validate(fx, file) {
  const fail = (m) => {
    throw new Error(`${file}: ${m}`);
  };
  if (!fx || fx.schema !== SCHEMA) fail(`schema must be ${SCHEMA}`);
  if (!/^[0-9a-f]{64}$/.test(fx.videoSha256 || "")) fail("videoSha256 missing");
  if (!fx.video || !(fx.video.width > 0) || !(fx.video.height > 0)) fail("video size missing");
  if (
    !Array.isArray(fx.points) ||
    !fx.points.every((i) => Number.isInteger(i) && i >= 0 && i < LM_COUNT)
  )
    fail("points must be landmark indices");
  if (!Array.isArray(fx.frames) || !fx.frames.length) fail("frames missing");
  const width = 1 + fx.points.length * 4;
  let last = -Infinity;
  for (const row of fx.frames) {
    if (!Array.isArray(row) || (row.length !== 1 && row.length !== width)) fail("bad frame row");
    if (!(row[0] > last)) fail("frame times must increase");
    last = row[0];
  }
  const ex = fx.truth && fx.truth.reviewedExpectation;
  if (
    !ex ||
    !Number.isInteger(ex.expectedDetectedShots) ||
    !Array.isArray(ex.acceptedReleaseWindowsMs)
  )
    fail("reviewed expectation missing");
}

function expandFrames(fx) {
  return fx.frames.map((row) => {
    if (row.length === 1) return { tMs: row[0], landmarks: null };
    const lms = new Array(LM_COUNT).fill(null);
    fx.points.forEach((idx, k) => {
      const o = 1 + k * 4;
      lms[idx] = { x: row[o], y: row[o + 1], z: row[o + 2], visibility: row[o + 3] };
    });
    return { tMs: row[0], landmarks: lms };
  });
}

function loadRealClips(dir) {
  const d = dir || __dirname;
  return fs
    .readdirSync(d)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const file = path.join(d, f);
      const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
      validate(fixture, f);
      return {
        id: fixture.clipId,
        fixture,
        frames: expandFrames(fixture),
        meta: {
          frame: { w: fixture.video.width, h: fixture.video.height },
          handedness: fixture.truth.handedness || "right",
          fps: fixture.video.fps,
        },
      };
    });
}

function scoreRealClip(fixture, result) {
  const ex = fixture.truth.reviewedExpectation;
  const releases = (result && result.shots ? result.shots : [])
    .filter((s) => s && s.kind !== "letdown" && Number.isFinite(s.releaseMs))
    .map((s) => s.releaseMs)
    .sort((a, b) => a - b);
  const windows = ex.acceptedReleaseWindowsMs.map(([lo, hi]) => ({ lo, hi, used: false }));
  const inWindow = releases.map((t) => {
    const w = windows.find((x) => !x.used && t >= x.lo && t <= x.hi);
    if (w) w.used = true;
    return !!w;
  });
  const countOk = releases.length === ex.expectedDetectedShots;
  return {
    detected: releases.length,
    releasesMs: releases.map((t) => Math.round(t)),
    inWindow,
    expectedDetectedShots: ex.expectedDetectedShots,
    acceptedReleaseWindowsMs: ex.acceptedReleaseWindowsMs,
    passReviewed: countOk && inWindow.every(Boolean),
    visualShots: fixture.truth.visualShots,
    countMatchesVisual:
      fixture.truth.visualShots == null ? null : releases.length === fixture.truth.visualShots,
  };
}

module.exports = { SCHEMA, loadRealClips, expandFrames, scoreRealClip };
