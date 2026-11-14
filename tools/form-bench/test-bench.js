#!/usr/bin/env node
"use strict";
/* Sanity tests for the form-tracking benchmark itself (not part of check:all).
   node tools/form-bench/test-bench.js
   - the simulator and the noise model are deterministic per seed
   - projections match the pinhole math and MediaPipe normalization
   - ground-truth events and features line up with the generated motion
   - a perfect session is scored perfectly by the truth oracle, and the scorer's matching rules hold
   - the current-pipeline adapter reproduces the app loop on the check suite's synthetic shots */

const crypto = require("crypto");
const { V, angle2d, median } = require("./lib");
const { simulateSession, sideIndices, LM } = require("./simulator");
const { makeCamera, projectPose } = require("./camera");
const { renderSession } = require("./noise");
const { computeTruth } = require("./truth");
const { matchReleases, scoreSession, aggregate } = require("./metrics");
const { resolveScenario, SCENARIOS } = require("./scenarios");
const { runSession } = require("./run-bench");
const oracle = require("./adapters/truth-oracle");
const current = require("./adapters/current-pipeline");

let passed = 0;
const failures = [];
function check(ok, label) {
  if (ok) passed++;
  else failures.push(label);
}
function close(a, b, eps, label) {
  check(
    Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps,
    `${label}: ${a} vs ${b} (±${eps})`,
  );
}
const sha = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
const scenario = (id) => resolveScenario(SCENARIOS.find((s) => s.id === id));

/* ---------- determinism ---------- */
{
  const cfg = scenario("mixed-session");
  const a = simulateSession(cfg.sim, 7),
    b = simulateSession(cfg.sim, 7),
    c = simulateSession(cfg.sim, 8);
  const ra = renderSession(a, cfg.camera, cfg.noise, cfg.timing, 7);
  const rb = renderSession(b, cfg.camera, cfg.noise, cfg.timing, 7);
  const rc = renderSession(c, cfg.camera, cfg.noise, cfg.timing, 8);
  check(sha(ra.frames) === sha(rb.frames), "same seed gives identical frames");
  check(sha(a.cycles) === sha(b.cycles), "same seed gives identical event list");
  check(sha(ra.frames) !== sha(rc.frames), "different seed gives different frames");
  check(
    sha(computeTruth(a, ra.camera)) === sha(computeTruth(b, rb.camera)),
    "same seed gives identical ground truth",
  );
  let mono = true;
  for (let i = 1; i < ra.frames.length; i++)
    if (!(ra.frames[i].tMs > ra.frames[i - 1].tMs)) mono = false;
  check(mono, "timestamps strictly increase");
  let wellFormed = true;
  for (const f of ra.frames) {
    if (!f.landmarks) continue;
    if (f.landmarks.length !== 33) wellFormed = false;
    for (const p of f.landmarks)
      if (
        ![p.x, p.y, p.z, p.visibility].every(Number.isFinite) ||
        p.visibility < 0 ||
        p.visibility > 1
      )
        wellFormed = false;
  }
  check(wellFormed, "every landmark has finite x, y, z and visibility in [0, 1]");
}

/* ---------- projection ---------- */
{
  const body = simulateSession({}, 1).body;
  const cam = makeCamera({ width: 1280, height: 720, torsoFrac: 0.2, pitchDeg: 0 }, body, "right");
  const p0 = cam.project(cam.aim);
  close(p0.u, 640, 1e-9, "aim point projects to the image centre (u)");
  close(p0.v, 360, 1e-9, "aim point projects to the image centre (v)");
  const d = 0.25;
  const p1 = cam.project(V.addm(cam.aim, cam.right, d));
  close(p1.u, 640 + (cam.f * d) / cam.distance, 1e-9, "lateral offset follows u = cx + f*X/Z");
  const p2 = cam.project(V.addm(cam.aim, [0, 0, 1], d));
  close(
    p2.v,
    360 - (cam.f * d) / cam.distance,
    1e-9,
    "vertical offset follows v = cy - f*Y/Z (y down)",
  );
  const n = cam.normalize(p1, cam.distance);
  close(n.x, p1.u / 1280, 1e-12, "normalized x = u / width");
  close(n.y, p1.v / 720, 1e-12, "normalized y = v / height");
  close(
    cam.f,
    640 / Math.tan((69 * Math.PI) / 360),
    1e-9,
    "focal length from the long-side field of view",
  );
  const camR = makeCamera(
    { width: 1280, height: 720, torsoFrac: 0.2, pitchDeg: 0, rollDeg: 90 },
    body,
    "right",
  );
  const pr = camR.project(V.addm(camR.aim, [0, 0, 1], d));
  close(
    Math.hypot(pr.u - 640, pr.v - 360),
    (camR.f * d) / camR.distance,
    1e-9,
    "roll keeps the radius",
  );
  close(pr.v, 360, 1e-6, "roll 90 deg turns a vertical offset horizontal");
  // subject size: projected torso at the stance matches torsoFrac (perspective within 3%)
  for (const [w, h, frac] of [
    [1280, 720, 0.22],
    [720, 1280, 0.17],
    [1920, 1080, 0.13],
  ]) {
    const sess = simulateSession({}, 2);
    const c = makeCamera({ width: w, height: h, torsoFrac: frac, pitchDeg: 3 }, sess.body, "right");
    const { proj } = projectPose(c, sess.poseAt(500).pts);
    const ms = { u: (proj[11].u + proj[12].u) / 2, v: (proj[11].v + proj[12].v) / 2 };
    const mh = { u: (proj[23].u + proj[24].u) / 2, v: (proj[23].v + proj[24].v) / 2 };
    close(
      Math.hypot(ms.u - mh.u, ms.v - mh.v) / h,
      frac,
      frac * 0.03,
      `torso fills ${frac} of ${w}x${h}`,
    );
  }
  // right-handed side view: the target (bow hand) is on the image right; left-handed: image left
  for (const hand of ["right", "left"]) {
    const sess = simulateSession({ handedness: hand }, 3);
    const c = makeCamera({}, sess.body, hand);
    const cyc = sess.cycles[0];
    const { proj } = projectPose(c, sess.poseAt(cyc.anchorMs + 300).pts);
    const s = sideIndices(hand);
    const bowRight = proj[s.bow.wrist].u > proj[s.draw.wrist].u;
    check(
      hand === "right" ? bowRight : !bowRight,
      `${hand}-handed bow hand on the expected image side`,
    );
  }
}

/* ---------- ground truth lines up with the motion ---------- */
{
  for (const seed of [1, 2, 3]) {
    const sess = simulateSession({ ends: 1, arrowsPerEnd: 4, letdownProb: 0.5 }, seed);
    const s = sideIndices(sess.handedness);
    const wrist = (t) => sess.poseAt(t).pts[s.draw.wrist];
    const speed = (t) => V.dist(wrist(t + 1), wrist(t - 1)) / 0.002; // m/s
    const nd = (t) => V.dist(wrist(t), sess.poseAt(t).pts[LM.NOSE]);
    for (const c of sess.cycles) {
      const end = c.kind === "shot" ? c.releaseMs : c.letdownStartMs;
      close(c.holdMs, end - c.anchorMs, 1e-6, `seed ${seed} cycle ${c.index}: hold = end - anchor`);
      close(
        c.drawMs,
        c.anchorMs - c.drawStartMs,
        1e-6,
        `seed ${seed} cycle ${c.index}: draw duration`,
      );
      let holdMax = 0;
      for (let t = c.anchorMs + 50; t < end - 5; t += 10) holdMax = Math.max(holdMax, speed(t));
      check(
        holdMax < 0.1,
        `seed ${seed} cycle ${c.index}: draw hand nearly still during the hold (${holdMax.toFixed(3)} m/s)`,
      );
      const holdD = [];
      for (let t = c.anchorMs; t <= end; t += 20) holdD.push(nd(t));
      const hm = median(holdD);
      close(nd(c.anchorMs), hm, 0.02, `seed ${seed} cycle ${c.index}: anchor reached at anchorMs`);
      /* note: the wrist-nose distance alone barely changes between set-up and anchor (the set-up
         hand is in front of the face about as far as the anchored wrist is behind it) */
      const wa = wrist(c.anchorMs);
      check(
        V.dist(wrist(c.drawStartMs), wa) > 0.2,
        `seed ${seed} cycle ${c.index}: draw starts away from the anchor`,
      );
      if (c.kind === "shot") {
        let peak = 0;
        for (let t = c.releaseMs + 2; t < c.releaseMs + 150; t += 2)
          peak = Math.max(peak, speed(t));
        check(
          peak > 1,
          `seed ${seed} shot ${c.index}: fast draw-hand motion right after release (${peak.toFixed(2)} m/s)`,
        );
        check(
          speed(c.releaseMs - 5) < 0.1,
          `seed ${seed} shot ${c.index}: hand still just before release`,
        );
      } else {
        let ldMax = 0;
        for (let t = c.letdownStartMs; t < c.letdownEndMs; t += 10)
          ldMax = Math.max(ldMax, speed(t));
        check(
          ldMax < 0.8,
          `seed ${seed} let-down ${c.index}: slow return (${ldMax.toFixed(2)} m/s)`,
        );
        check(
          V.dist(wrist(c.letdownEndMs), wa) > 0.2,
          `seed ${seed} let-down ${c.index}: hand left the anchor`,
        );
      }
    }
  }
  // noise-free landmarks reproduce the 2D truth (normalization and truth use the same geometry)
  const cfg = scenario("ideal-side");
  const sess = simulateSession(cfg.sim, 5);
  const rend = renderSession(sess, cfg.camera, cfg.noise, cfg.timing, 5);
  const truth = computeTruth(sess, rend.camera);
  const s = sideIndices(sess.handedness);
  const { w, h } = rend.frame;
  for (const shot of truth.shots) {
    const win = rend.frames.filter((f) => f.tMs >= shot.anchorMs && f.tMs <= shot.releaseMs);
    const px = (p) => ({ x: p.x * w, y: p.y * h });
    const feats = win.map((f) => {
      const L = f.landmarks.map(px);
      const ms = { x: (L[11].x + L[12].x) / 2, y: (L[11].y + L[12].y) / 2 };
      const mh = { x: (L[23].x + L[24].x) / 2, y: (L[23].y + L[24].y) / 2 };
      const torso = Math.hypot(ms.x - mh.x, ms.y - mh.y);
      const dw = L[s.draw.wrist];
      return {
        anchor: Math.hypot(dw.x - L[0].x, dw.y - L[0].y) / torso,
        bow: angle2d(L[s.bow.shoulder], L[s.bow.elbow], L[s.bow.wrist]),
        draw: angle2d(L[s.draw.shoulder], L[s.draw.elbow], L[s.draw.wrist]),
      };
    });
    close(
      median(feats.map((f) => f.anchor)),
      shot.t2.anchorDist,
      0.005,
      `shot ${shot.index}: landmarks give the 2D anchor truth`,
    );
    close(
      median(feats.map((f) => f.bow)),
      shot.t2.bowElbow,
      0.5,
      `shot ${shot.index}: landmarks give the 2D bow-elbow truth`,
    );
    close(
      median(feats.map((f) => f.draw)),
      shot.t2.drawElbow,
      1.0,
      `shot ${shot.index}: landmarks give the 2D draw-elbow truth`,
    );
    check(
      shot.t3.drawElbow < 90 && shot.t3.bowElbow > 150,
      `shot ${shot.index}: plausible 3D elbow angles`,
    );
  }
  // left-handed = mirror image of the same motion: identical 3D truth
  const r = simulateSession({ handedness: "right" }, 9),
    l = simulateSession({ handedness: "left" }, 9);
  const tr = computeTruth(r, makeCamera({}, r.body, "right")),
    tl = computeTruth(l, makeCamera({}, l.body, "left"));
  for (const k of ["anchorDist", "bowElbow", "drawElbow", "bowShoulderElev", "followDist"])
    close(tl.shots[2].t3[k], tr.shots[2].t3[k], 1e-9, `left-handed mirror keeps 3D ${k}`);
  for (const k of ["anchorDist", "bowElbow", "drawElbow"])
    close(tl.shots[2].t2[k], tr.shots[2].t2[k], 1e-6, `left-handed mirror keeps 2D ${k}`);
}

/* ---------- scorer ---------- */
{
  const m = matchReleases([1000, 5000], [1150, 4849, 5100]);
  check(
    m.length === 2 && m[0].j === 0 && m[1].j === 2,
    "±150 ms window is inclusive and matching is closest-first",
  );
  check(matchReleases([1000], [1151]).length === 0, "151 ms is outside the window");
  check(matchReleases([1000, 1100], [1050]).length === 1, "one detection matches one true release");
  const truth = {
    shots: [
      {
        releaseMs: 10000,
        anchorMs: 8000,
        holdMs: 2000,
        t2: { anchorDist: 0.3 },
        t3: { anchorDist: 0.31 },
      },
      {
        releaseMs: 30000,
        anchorMs: 27000,
        holdMs: 3000,
        t2: { anchorDist: 0.4 },
        t3: { anchorDist: 0.41 },
      },
    ],
    letdowns: [{ anchorMs: 18000, letdownEndMs: 21000 }],
  };
  const res = {
    shots: [
      { releaseMs: 10100, holdMs: 2100, kind: "shot", features: { anchorDist: 0.35 } },
      { releaseMs: 19500, holdMs: 1500, kind: "shot", features: {} },
      { releaseMs: 10700, kind: "shot", features: {} },
      { releaseMs: 50000, kind: "shot", features: {} },
    ],
  };
  const sc = scoreSession(truth, res, ["anchorDist"], () => "idle");
  check(sc.tp.length === 1 && sc.missed.length === 1, "one hit, one miss");
  check(
    sc.fp.map((f) => f.cls).join(",") === "mistimed,letdown,idle",
    `false positives are classified (${sc.fp.map((f) => f.cls)})`,
  );
  const ag = aggregate([sc], ["anchorDist"]);
  close(ag.precision, 0.25, 1e-9, "precision");
  close(ag.recall, 0.5, 1e-9, "recall");
  close(ag.features.anchorDist.vs2d.medAbs, 0.05, 1e-9, "feature error against the 2D truth");
  close(ag.holdErrMs.medAbs, 100, 1e-9, "hold error");
  check(ag.letdownFp === 1 && ag.letdownsCounted === 1, "let-down counted as a shot");
}

/* ---------- truth oracle on a perfect session ---------- */
{
  const cfg = scenario("ideal-side");
  const r = runSession(cfg, 3, oracle);
  const ag = aggregate([r.scored], oracle.provides);
  check(ag.precision === 1 && ag.recall === 1 && ag.fp === 0, "oracle: precision = recall = 1");
  check(ag.releaseErrMs.medAbs === 0 && ag.releaseErrMs.p90Abs === 0, "oracle: zero release error");
  check(ag.holdErrMs.medAbs === 0, "oracle: zero hold error");
  for (const [k, f] of Object.entries(ag.features))
    check(f.unavailable === 0 && f.vs2d && f.vs2d.p90Abs === 0, `oracle: zero ${k} error`);
}

/* ---------- current-pipeline adapter reproduces the app loop ---------- */
{
  /* the 3-shot pixel sequence of tools/check-form-core.js (AN-098 block); that suite asserts
     releases at 3333, 8033 and 12733 ms for it */
  const P = (x, y) => ({ x, y });
  const mixP = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
  const BODY = {
    nose: P(296, 190),
    bS: P(280, 250),
    dS: P(320, 252),
    lH: P(285, 490),
    rH: P(315, 490),
    bE: P(160, 250),
    bW: P(40, 248),
  };
  const REST = { w: P(200, 560), e: P(330, 400) },
    ANCHOR = { w: P(366, 205), e: P(470, 235) },
    FOLLOW = { w: P(520, 330), e: P(560, 300) };
  const dt = 1000 / 30;
  const frames = [];
  let t = 0,
    i = 0;
  const N = (p) => ({ x: (p.x + 280) / 1280, y: p.y / 720, z: 0, visibility: 0.95 });
  const push = (pose) => {
    t += dt;
    const dW = P(pose.w.x + Math.sin(i * 1.7) * 1.2, pose.w.y + Math.cos(i * 2.3) * 1.2);
    i++;
    const l = new Array(33).fill(null).map(() => N(P(300, 600)));
    [
      [0, BODY.nose],
      [11, BODY.bS],
      [12, BODY.dS],
      [13, BODY.bE],
      [14, pose.e],
      [15, BODY.bW],
      [16, dW],
      [23, BODY.lH],
      [24, BODY.rH],
    ].forEach(([k, p]) => (l[k] = N(p)));
    frames.push({ tMs: t, landmarks: l });
  };
  const mix = (a, b, k) => ({ w: mixP(a.w, b.w, k), e: mixP(a.e, b.e, k) });
  for (let s = 0; s < 3; s++) {
    for (let k = 0; k < 30; k++) push(REST);
    for (let k = 1; k <= 24; k++) push(mix(REST, ANCHOR, k / 24));
    for (let k = 0; k < 45; k++) push(ANCHOR);
    for (let ms = dt; ; ms += dt) {
      const x = Math.min(1, ms / 66);
      push(mix(ANCHOR, FOLLOW, 1 - (1 - x) ** 2));
      if (x >= 1) break;
    }
    for (let k = 0; k < 20; k++) push(FOLLOW);
    for (let k = 1; k <= 20; k++) push(mix(FOLLOW, REST, k / 20));
  }
  const out = current.analyze(frames, { frame: { w: 1280, h: 720 }, handedness: "right" });
  check(
    JSON.stringify(out.shots.map((s) => Math.round(s.releaseMs))) === "[3333,8033,12733]",
    `current adapter finds the check suite's releases (${out.shots.map((s) => Math.round(s.releaseMs))})`,
  );
  const probe = current.measure(frames, { frame: { w: 1280, h: 720 }, handedness: "right" }, [
    { anchorStartMs: 2200, releaseMs: 3333 },
  ]);
  check(
    probe.length === 1 && Number.isFinite(probe[0].features.anchorDist),
    "measurement probe returns features",
  );
}

console.log(`form-bench sanity: ${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exitCode = failures.length ? 1 : 0;
