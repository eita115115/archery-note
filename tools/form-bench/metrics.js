"use strict";
/* Scoring for the form-tracking benchmark. Detector-agnostic: it only sees the adapter output
   ({shots: [{releaseMs, anchorStartMs, holdMs, kind, features}]}) and the ground truth.

   Matching: a detected release matches a true release when |detected - true| <= 150 ms; pairs are
   assigned one-to-one, closest first. Unmatched detections are false positives and are classified:
     "letdown"   inside a let-down (anchor - 300 ms .. end of the let-down + 1 s)
     "mistimed"  within 1 s of a true release (late/early or a double count)
     otherwise   what the archer was doing (idle, reload, raise, draw, hold, walk, fidget, ...).
   Feature errors are computed on matched shots only, against the 2D image truth (square pixels)
   and the true 3D value. A feature the detector reports as null/non-finite on a matched shot counts
   as unavailable; a feature the adapter does not provide at all is reported as "not provided". */

const { quantile, median, mean } = require("./lib");

const MATCH_MS = 150;
const MISTIMED_MS = 1000;
const ANGLE_KEYS = new Set(["bowElbow", "drawElbow", "followDir"]);

function matchReleases(trueTimes, detTimes, tolMs) {
  const tol = tolMs == null ? MATCH_MS : tolMs;
  const pairs = [];
  trueTimes.forEach((t, i) =>
    detTimes.forEach((d, j) => {
      const dt = d - t;
      if (Math.abs(dt) <= tol) pairs.push({ i, j, dt });
    }),
  );
  pairs.sort((a, b) => Math.abs(a.dt) - Math.abs(b.dt) || a.i - b.i || a.j - b.j);
  const usedT = new Set(),
    usedD = new Set(),
    matches = [];
  for (const p of pairs) {
    if (usedT.has(p.i) || usedD.has(p.j)) continue;
    usedT.add(p.i);
    usedD.add(p.j);
    matches.push(p);
  }
  return matches.sort((a, b) => a.i - b.i);
}

const fin = (v) => typeof v === "number" && Number.isFinite(v);

/* Score one session. activityAt(tMs) labels the archer's activity (from the simulator). */
/* true let-downs for which the detector returned a kind "letdown" entry (its releaseMs, i.e. the
   time it puts on the event, inside anchor - 300 ms .. let-down end + 1 s) */
function countReportedLetdowns(truth, result) {
  const ld = (result && result.shots ? result.shots : []).filter(
    (s) => s && s.kind === "letdown" && fin(s.releaseMs),
  );
  return truth.letdowns.filter((c) =>
    ld.some((s) => s.releaseMs >= c.anchorMs - 300 && s.releaseMs <= c.letdownEndMs + 1000),
  ).length;
}

function scoreSession(truth, result, provides, activityAt) {
  const shots = (result && result.shots ? result.shots : [])
    .filter((s) => s && fin(s.releaseMs) && s.kind !== "letdown")
    .slice()
    .sort((a, b) => a.releaseMs - b.releaseMs);
  const trueShots = truth.shots;
  const matches = matchReleases(
    trueShots.map((s) => s.releaseMs),
    shots.map((s) => s.releaseMs),
  );
  const matchedDet = new Set(matches.map((m) => m.j));
  const matchedTrue = new Set(matches.map((m) => m.i));
  const prov = new Set(provides || []);
  const tp = matches.map((m) => {
    const t = trueShots[m.i],
      d = shots[m.j];
    const feats = {};
    for (const k of Object.keys(t.t2)) {
      if (!prov.has(k)) continue;
      const v = d.features ? d.features[k] : null;
      feats[k] = { det: fin(v) ? v : null, t2: t.t2[k], t3: fin(t.t3[k]) ? t.t3[k] : null };
    }
    return {
      trueReleaseMs: t.releaseMs,
      detReleaseMs: d.releaseMs,
      dtMs: m.dt,
      trueHoldMs: t.holdMs,
      trueHoldStillMs: fin(t.holdStillMs) ? t.holdStillMs : null,
      trueAnchorStillMs: fin(t.anchorStillMs) ? t.anchorStillMs : null,
      detHoldMs: fin(d.holdMs) ? d.holdMs : null,
      trueAnchorMs: t.anchorMs,
      detAnchorMs: fin(d.anchorStartMs) ? d.anchorStartMs : null,
      feats,
    };
  });
  const letdowns = truth.letdowns;
  const ldHit = new Set();
  const fp = [];
  shots.forEach((d, j) => {
    if (matchedDet.has(j)) return;
    const t = d.releaseMs;
    const ld = letdowns.findIndex((c) => t >= c.anchorMs - 300 && t <= c.letdownEndMs + 1000);
    let cls;
    if (ld >= 0) {
      cls = "letdown";
      ldHit.add(ld);
    } else if (trueShots.some((s) => Math.abs(t - s.releaseMs) <= MISTIMED_MS)) cls = "mistimed";
    else cls = activityAt ? activityAt(t) : "other";
    const near = trueShots.length
      ? trueShots.reduce((best, s) =>
          Math.abs(s.releaseMs - t) < Math.abs(best.releaseMs - t) ? s : best,
        )
      : null;
    fp.push({ tMs: t, cls, nearestTrueMs: near ? near.releaseMs : null });
  });
  const missed = trueShots
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => !matchedTrue.has(i))
    .map(({ s }) => {
      const near = shots.length
        ? shots.reduce((best, d) =>
            Math.abs(d.releaseMs - s.releaseMs) < Math.abs(best.releaseMs - s.releaseMs) ? d : best,
          )
        : null;
      return {
        trueReleaseMs: s.releaseMs,
        holdMs: s.holdMs,
        peakSpeedTorsoPerS: s.release ? s.release.peakSpeedTorsoPerS : null,
        nearestDetOffsetMs: near ? Math.round(near.releaseMs - s.releaseMs) : null,
      };
    });
  return {
    nTrue: trueShots.length,
    nLetdowns: letdowns.length,
    nDet: shots.length,
    letdownsReported: countReportedLetdowns(truth, result),
    tp,
    fp,
    missed,
    letdownsCounted: ldHit.size,
  };
}

function errStats(values) {
  const a = values.filter(fin);
  if (!a.length) return null;
  const abs = a.map(Math.abs);
  return {
    n: a.length,
    bias: +median(a).toFixed(3),
    medAbs: +median(abs).toFixed(3),
    p90Abs: +quantile(abs, 0.9).toFixed(3),
    mean: +mean(a).toFixed(3),
  };
}

/* Per-feature error summary from rows of {key: {det, t2, t3}}. */
function featureSummary(featRows, provides) {
  const features = {};
  for (const k of provides || []) {
    const rows = featRows.map((f) => f && f[k]).filter(Boolean);
    if (!rows.length) {
      features[k] = { n: 0, unavailable: null };
      continue;
    }
    const have = rows.filter((r) => r.det != null);
    features[k] = {
      n: rows.length,
      unavailable: +((rows.length - have.length) / rows.length).toFixed(3),
      vs2d: errStats(have.map((r) => r.det - r.t2)),
      vs3d: errStats(have.filter((r) => r.t3 != null).map((r) => r.det - r.t3)),
      unit: ANGLE_KEYS.has(k) ? "deg" : "torso",
    };
  }
  return features;
}

/* Rows for the optional measurement probe: features measured at the TRUE anchor/release times
   (detection taken out of the picture). measured[i] belongs to truth.shots[i]. */
function measurementRows(truth, measured, provides) {
  const prov = new Set(provides || []);
  return truth.shots.map((t, i) => {
    const m = measured && measured[i] ? measured[i].features || {} : {};
    const feats = {};
    for (const k of Object.keys(t.t2)) {
      if (!prov.has(k)) continue;
      const v = m[k];
      feats[k] = { det: fin(v) ? v : null, t2: t.t2[k], t3: fin(t.t3[k]) ? t.t3[k] : null };
    }
    return feats;
  });
}

/* Pool scored sessions (micro-average). */
function aggregate(scored, provides) {
  const nTrue = scored.reduce((s, x) => s + x.nTrue, 0);
  const nDet = scored.reduce((s, x) => s + x.nDet, 0);
  const nLd = scored.reduce((s, x) => s + x.nLetdowns, 0);
  const tp = scored.flatMap((x) => x.tp);
  const fp = scored.flatMap((x) => x.fp);
  const precision = nDet ? tp.length / nDet : null;
  const recall = nTrue ? tp.length / nTrue : null;
  const f1 =
    precision && recall
      ? (2 * precision * recall) / (precision + recall)
      : precision === 0 || recall === 0
        ? 0
        : null;
  const fpBy = {};
  for (const f of fp) fpBy[f.cls] = (fpBy[f.cls] || 0) + 1;
  const ldCounted = scored.reduce((s, x) => s + x.letdownsCounted, 0);
  const holdPairs = tp.filter((p) => p.detHoldMs != null);
  const holdStillPairs = holdPairs.filter((p) => p.trueHoldStillMs != null);
  const withTrue = scored.filter((x) => x.nTrue > 0);
  const noShot = scored.filter((x) => x.nTrue === 0);
  const anchorPairs = tp.filter((p) => p.detAnchorMs != null);
  const features = featureSummary(
    tp.map((p) => p.feats),
    provides,
  );
  const dt = tp.map((p) => p.dtMs);
  const hist = {};
  for (const v of dt) {
    const bin = Math.max(-150, Math.min(140, Math.floor(v / 10) * 10));
    hist[bin] = (hist[bin] || 0) + 1;
  }
  return {
    sessions: scored.length,
    trueShots: nTrue,
    letdowns: nLd,
    detections: nDet,
    tp: tp.length,
    fp: fp.length,
    missed: nTrue - tp.length,
    precision: precision == null ? null : +precision.toFixed(3),
    recall: recall == null ? null : +recall.toFixed(3),
    f1: f1 == null ? null : +f1.toFixed(3),
    letdownFp: fpBy.letdown || 0,
    letdownsCounted: ldCounted,
    letdownCountRate: nLd ? +(ldCounted / nLd).toFixed(3) : null,
    fpByClass: fpBy,
    releaseErrMs: errStats(dt),
    releaseErrHistogram10ms: hist,
    /* hold error against both anchor definitions: end of the draw motion (holdErrMs) and the
       draw wrist falling below 0.2 torso/s (holdErrStillMs, truth.js) */
    holdErrMs: errStats(holdPairs.map((p) => p.detHoldMs - p.trueHoldMs)),
    holdErrStillMs: errStats(holdStillPairs.map((p) => p.detHoldMs - p.trueHoldStillMs)),
    holdUnavailable: tp.length ? +((tp.length - holdPairs.length) / tp.length).toFixed(3) : null,
    anchorStartErrMs: errStats(anchorPairs.map((p) => p.detAnchorMs - p.trueAnchorMs)),
    anchorStartErrStillMs: errStats(
      anchorPairs
        .filter((p) => p.trueAnchorStillMs != null)
        .map((p) => p.detAnchorMs - p.trueAnchorStillMs),
    ),
    /* shot count per session (detected vs true), independent of timing */
    exactCountRate: scored.length
      ? +(scored.filter((x) => x.nDet === x.nTrue).length / scored.length).toFixed(3)
      : null,
    withinOneRate: scored.length
      ? +(scored.filter((x) => Math.abs(x.nDet - x.nTrue) <= 1).length / scored.length).toFixed(3)
      : null,
    sessionsWithShots: withTrue.length,
    /* scenes without true shots: fraction of sessions where the detector reported none */
    zeroShotSessions: noShot.length,
    zeroShotCorrectRate: noShot.length
      ? +(noShot.filter((x) => x.nDet === 0).length / noShot.length).toFixed(3)
      : null,
    letdownsReported: scored.reduce((sum, x) => sum + (x.letdownsReported || 0), 0),
    features,
  };
}

module.exports = {
  MATCH_MS,
  matchReleases,
  scoreSession,
  aggregate,
  errStats,
  featureSummary,
  measurementRows,
};
