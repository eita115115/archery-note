"use strict";
/* 射型の記録 v2 の解析器（scripts/44-form-analyze.js）の検査。npm run check:form-analyze（check:all に入っている）。
   仕様: docs/design/form-v2/algorithm.md。基準の番号は 7.4。
   合成の射手は tools/form-analyze-fixture.js（射線に平行な面の 2 次元の骨格、種で決まる乱数）。数秒で終わる。
   独立したベンチマーク（npm run bench:form -- --adapter tools/form-bench/adapters/v2-analyzer.js）は、時間がかかるので
   ここには入れない。 */
const assert = require("node:assert/strict");
const FA = require("./form-analyze-loader.js");
const FX = require("./form-analyze-fixture.js");

const OPT = { frame: { w: 1280, h: 720 }, handedness: "right", fps: 30 };
const shotsOf = (res) => res.shots.filter((s) => s.kind === "shot");
const letdownsOf = (res) => res.shots.filter((s) => s.kind === "letdown");
const quantile = (a, p) => {
  const v = a.slice().sort((x, y) => x - y);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
};
const median = (a) => quantile(a, 0.5);
const results = [];
function test(name, fn) {
  const t0 = process.hrtime.bigint();
  fn();
  results.push(`${name} (${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0)} ms)`);
}
const sixShots = (extra) => {
  const ev = [];
  for (let i = 0; i < 6; i++) ev.push(Object.assign({ kind: "shot", holdMs: 2400 + 320 * i, drawMs: 1250 + 110 * ((i * 3) % 5) }, extra && extra(i)));
  return ev;
};
/* 真の離れに、いちばん近い検出を 1 対 1 で当てる（±tol ms） */
function match(truth, detected, tol) {
  const used = new Set(), pairs = [];
  for (const t of truth) {
    let best = -1, bd = tol;
    detected.forEach((d, i) => {
      const e = Math.abs(d.releaseMs - t.releaseMs);
      if (!used.has(i) && e <= bd) { bd = e; best = i; }
    });
    if (best >= 0) { used.add(best); pairs.push({ t, d: detected[best] }); }
  }
  return pairs;
}

/* ---- 1. 契約と壊れた入力 ---- */
test("contract: broken or empty input returns no shots and never throws", () => {
  const bad = [undefined, null, [], "x", [null, undefined, 3, {}], [{ tMs: NaN, landmarks: [] }], [{ tMs: 0, landmarks: null }]];
  for (const frames of bad) {
    const r = FA.analyze(frames, OPT);
    assert.deepEqual(r.shots, []);
    assert.deepEqual(r.candidates, []);
    assert.ok(r.quality.warnings.includes("tooShort"));
  }
  assert.doesNotThrow(() => FA.analyze([], undefined));
  assert.doesNotThrow(() => FA.analyzePacked(null, OPT));
  /* 姿勢が 1 コマも取れなかった回 */
  const none = [];
  for (let i = 0; i < 200; i++) none.push({ tMs: i * 33.3, landmarks: null });
  const r0 = FA.analyze(none, OPT);
  assert.deepEqual(r0.shots, []);
  assert.ok(r0.quality.warnings.includes("noBody"));
  /* 値が壊れたコマ（NaN、範囲外、点が足りない）が混じっても落ちない */
  const cap = FX.makeCapture({ seed: 2, events: sixShots() }), frames = FX.toFrames(cap.poses);
  frames[50] = { tMs: frames[50].tMs, landmarks: [{ x: NaN, y: 1 }] };
  frames[51] = { tMs: frames[51].tMs, landmarks: frames[51].landmarks.map(() => ({ x: 9, y: -9, z: 0, visibility: 1 })) };
  frames[52] = { tMs: frames[52].tMs, landmarks: [] };
  frames.push({ tMs: frames[10].tMs, landmarks: frames[10].landmarks }); // 時刻が戻るコマ
  const r1 = FA.analyze(frames, OPT);
  assert.equal(shotsOf(r1).length, 6);
});

test("contract: output shape, units and the six default features", () => {
  const cap = FX.makeCapture({ seed: 4, sigma: 0, jitterMs: 0, events: sixShots() });
  const res = FA.analyze(FX.toFrames(cap.poses), OPT), shots = shotsOf(res);
  assert.equal(shots.length, 6);
  assert.equal(res.quality.version, FA.VERSION);
  for (const s of shots) {
    for (const k of ["releaseMs", "anchorStartMs", "holdMs", "drawStartMs", "drawMs", "drawEndMs", "releaseUncMs", "confidence"]) assert.ok(Number.isFinite(s[k]), `${k} must be finite`);
    assert.ok(s.anchorStartMs < s.releaseMs && s.drawStartMs < s.anchorStartMs);
    assert.ok(s.confidence >= 0.5 && s.confidence <= 1);
    for (const k of FA.DEFAULT_KEYS) assert.ok(Number.isFinite(s.features[k]), `default feature ${k} must be measured`);
    /* 重ね図用の姿: 9 点 × (x, y)、0.01 胴の整数 */
    for (const pose of [s.poseHold, s.poseRel]) {
      assert.equal(pose.length, 18);
      assert.ok(pose.every((v) => Number.isInteger(v)));
    }
    assert.ok(JSON.stringify([s.poseHold, s.poseRel]).length < 220, "the two poses stay compact");
  }
  /* 雑音なしの値（合成の射手の寸法から分かる）: 引き尺 1.51、アンカーの高さ −0.25、離れのあとの後ろへの動き 0.29 */
  const f = shots[2].features;
  assert.ok(Math.abs(f.ext - 1.51) < 0.02, `ext ${f.ext}`);
  assert.ok(Math.abs(f.ancY - -0.25) < 0.02, `ancY ${f.ancY}`);
  assert.ok(Math.abs(f.ancX - -0.36) < 0.02, `ancX ${f.ancX}`);
  assert.ok(Math.abs(f.relBack - 0.29) < 0.03, `relBack ${f.relBack}`);
  assert.ok(Math.abs(f.bowDy - -0.06) < 0.03, `bowDy ${f.bowDy}`);
  assert.ok(Math.abs(f.headX - 0.25) < 0.01 && Math.abs(f.headY - 0.3) < 0.01);
  /* 保持の姿: 鼻・両肩・引き手の手首 */
  const p = shots[2].poseHold;
  assert.deepEqual(p.slice(0, 6), [25, 30, 35, 0, -35, 0]);
  assert.ok(Math.abs(p[12] - -11) <= 1 && Math.abs(p[13] - 5) <= 1);
  assert.equal(res.quality.view.side, "c");
  assert.equal(res.quality.dir, 1);
});

/* ---- 2. 基本の場面（7.4: ゆれ ≤ 胴の 1.2%） ---- */
function basicGroup(fps, relP95) {
  const relErr = [], anchorErr = [], holdErr = [];
  let exact = 0, tp = 0, nTrue = 0, nDet = 0, ldOk = 0, ldAsShot = 0, nLd = 0;
  const N = 10;
  for (let seed = 1; seed <= N; seed++) {
    const ev = sixShots();
    ev.splice(1 + (seed % 5), 0, { kind: "letdown", holdMs: 1500 + 200 * (seed % 4) });
    const cap = FX.makeCapture({ seed: 100 * fps + seed, fps, events: ev });
    const res = FA.analyze(FX.toFrames(cap.poses), Object.assign({}, OPT, { fps }));
    const truth = cap.truth.filter((t) => t.kind === "shot"), det = shotsOf(res), pairs = match(truth, det, 150);
    nTrue += truth.length;
    nDet += det.length;
    tp += pairs.length;
    if (det.length === truth.length) exact++;
    for (const { t, d } of pairs) {
      relErr.push(d.releaseMs - t.releaseMs);
      anchorErr.push(d.anchorStartMs - t.anchorMs);
      holdErr.push(d.holdMs - (t.releaseMs - t.anchorMs));
    }
    for (const t of cap.truth.filter((x) => x.kind === "letdown")) {
      nLd++;
      if (letdownsOf(res).some((d) => d.releaseMs > t.anchorMs - 300 && d.releaseMs < t.releaseMs + 2500)) ldOk++;
      if (det.some((d) => d.releaseMs > t.anchorMs - 300 && d.releaseMs < t.releaseMs + 2500)) ldAsShot++;
    }
  }
  const abs = (a) => a.map(Math.abs);
  const out = {
    fps, recall: tp / nTrue, precision: tp / nDet, exact: exact / N, ldOk: ldOk / nLd, ldAsShot,
    relBias: median(relErr), relP95: quantile(abs(relErr), 0.95), anchorP95: quantile(abs(anchorErr), 0.95), holdP95: quantile(abs(holdErr), 0.95),
  };
  assert.ok(out.recall >= 0.99 && out.precision >= 0.99, `recall/precision ${JSON.stringify(out)}`);
  assert.ok(out.exact >= 0.97, `exact count ${JSON.stringify(out)}`);
  assert.equal(out.ldAsShot, 0);
  assert.ok(out.ldOk >= 0.95, `let-downs returned ${JSON.stringify(out)}`);
  assert.ok(Math.abs(out.relBias) <= 15, `release bias ${JSON.stringify(out)}`);
  assert.ok(out.relP95 <= relP95, `release p95 ${JSON.stringify(out)}`);
  assert.ok(out.anchorP95 <= 200, `anchor p95 ${JSON.stringify(out)}`);
  assert.ok(out.holdP95 <= 220, `hold p95 ${JSON.stringify(out)}`);
  return out;
}
const basic = {};
test("basic group at 30 fps: count, let-downs, release/anchor/hold timing (7.4)", () => { basic[30] = basicGroup(30, 40); });
test("basic group at 60 fps (7.4)", () => { basic[60] = basicGroup(60, 25); });
test("basic group at 15 fps (7.4)", () => { basic[15] = basicGroup(15, 70); });

/* ---- 3. 不変性（7.4）: 同じ画素の姿なら、画面の形・左右・時刻の原点・大きさを変えても同じ結果 ---- */
function sameResult(a, b, shiftMs, label) {
  const close = (x, y, what) => {
    if (x === null || y === null) return assert.equal(x, y, `${label}: ${what}`);
    assert.ok(Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y)), `${label}: ${what} ${x} vs ${y}`);
  };
  assert.equal(a.shots.length, b.shots.length, `${label}: number of events`);
  assert.equal(a.candidates.length, b.candidates.length, `${label}: number of candidates`);
  a.shots.forEach((s, i) => {
    const t = b.shots[i];
    assert.equal(s.kind, t.kind);
    for (const k of ["releaseMs", "anchorStartMs", "drawStartMs", "drawEndMs"]) close(s[k] + shiftMs, t[k], k);
    for (const k of ["holdMs", "drawMs", "releaseUncMs", "confidence"]) close(s[k], t[k], k);
    for (const k of Object.keys(s.features)) close(s.features[k], t.features[k], `feature ${k}`);
    assert.deepEqual(s.poseHold, t.poseHold, `${label}: poseHold`);
    assert.deepEqual(s.poseRel, t.poseRel, `${label}: poseRel`);
  });
  for (const k of Object.keys(a.quality.noise)) close(a.quality.noise[k], b.quality.noise[k], `noise ${k}`);
}
test("invariance: landscape/portrait, mirror with handedness, time shift, scale", () => {
  const ev = sixShots();
  ev.splice(2, 0, { kind: "letdown", holdMs: 1800 });
  const cap = FX.makeCapture({ seed: 21, events: ev }); // 姿は 600×600 画素の中に収まる
  const base = FA.analyze(FX.toFrames(cap.poses, { w: 1280, h: 720 }), OPT);
  assert.equal(shotsOf(base).length, 6);
  assert.equal(letdownsOf(base).length, 1);
  const portrait = FA.analyze(FX.toFrames(cap.poses, { w: 720, h: 1280 }), { frame: { w: 720, h: 1280 }, handedness: "right", fps: 30 });
  sameResult(base, portrait, 0, "portrait");
  const mirrored = FA.analyze(FX.toFrames(cap.poses, { mirror: true, handedness: "left" }), Object.assign({}, OPT, { handedness: "left" }));
  sameResult(base, mirrored, 0, "mirror + left-handed");
  assert.equal(mirrored.quality.dir, -1);
  assert.equal(mirrored.quality.view.side, base.quality.view.side);
  const shifted = FA.analyze(FX.toFrames(cap.poses, { shiftMs: 1234567.25 }), OPT);
  sameResult(base, shifted, 1234567.25, "time shift");
  const scaled = FA.analyze(FX.toFrames(cap.poses, { scale: 2, w: 2560, h: 1440 }), { frame: { w: 2560, h: 1440 }, handedness: "right", fps: 30 });
  sameResult(base, scaled, 0, "scale x2");
  const small = FA.analyze(FX.toFrames(cap.poses, { scale: 0.5, origin: [300, 300] }), OPT);
  sameResult(base, small, 0, "scale x0.5");
});

/* ---- 4. 純関数: 同じ入力に同じ出力、入力を書き換えない ---- */
test("determinism and no mutation of the input", () => {
  const cap = FX.makeCapture({ seed: 33, events: sixShots() }), frames = FX.toFrames(cap.poses);
  const before = JSON.stringify(frames);
  const a = JSON.stringify(FA.analyze(frames, OPT)), b = JSON.stringify(FA.analyze(frames, OPT));
  assert.equal(a, b);
  assert.equal(JSON.stringify(frames), before);
  /* 取り込んだあとの形（撮影中のバッファから直接呼ぶ入口）でも同じ */
  const pk = FA.packFrames(frames, OPT), snap = JSON.stringify(Array.from(pk.pts.dWr.x));
  assert.equal(JSON.stringify(FA.analyzePacked(pk, OPT)), a);
  assert.equal(JSON.stringify(Array.from(pk.pts.dWr.x)), snap);
  assert.ok(Object.isFrozen(FA.P));
});

/* ---- 5. 数えるもの・数えないもの ---- */
test("unclear releases are returned as candidates, not counted", () => {
  /* 引き手がほとんど動かない離れ（後ろへ 0.02 胴 = 1cm）: 腕は下ろすが、離れの位置は分からない */
  const ev = sixShots((i) => (i === 2 || i === 4 ? { back: 0.02 } : null));
  const cap = FX.makeCapture({ seed: 41, events: ev }), res = FA.analyze(FX.toFrames(cap.poses), OPT);
  const weakTruth = cap.truth.filter((t) => t.back < 0.05), det = shotsOf(res);
  assert.equal(det.length, 4, "only the four clear shots are counted");
  for (const t of weakTruth) {
    assert.ok(!det.some((d) => Math.abs(d.releaseMs - t.releaseMs) < 3000), "a weak release must not be counted");
    const c = res.candidates.find((x) => x.fromMs < t.releaseMs && t.releaseMs < x.toMs + 3000);
    assert.ok(c, "a weak release is offered as a candidate");
    assert.ok(["weakRelease", "noRelease"].includes(c.reason));
    assert.ok(Number.isFinite(c.tMs) && Number.isFinite(c.uncMs) && c.uncMs >= 150);
    assert.equal(c.likely, true, "four clear shots give a template; the candidate looks like a shot");
  }
  assert.equal(res.quality.letdowns, 0);
});

test("no shots: raising the bow, spreading the arms, let-downs only", () => {
  const scenes = [
    [{ kind: "raise", holdMs: 2500 }, { kind: "raise", holdMs: 1500 }, { kind: "raise", holdMs: 3500 }],
    [{ kind: "spread", holdMs: 2500 }, { kind: "spread", holdMs: 3000 }, { kind: "raise", holdMs: 2000 }],
    [{ kind: "letdown", holdMs: 2000 }, { kind: "letdown", holdMs: 3000 }, { kind: "letdown", holdMs: 1500, letdownMs: 700 }],
    [],
  ];
  scenes.forEach((events, k) => {
    for (let seed = 1; seed <= 4; seed++) {
      const cap = FX.makeCapture({ seed: 50 + 10 * k + seed, events }), res = FA.analyze(FX.toFrames(cap.poses), OPT);
      assert.equal(shotsOf(res).length, 0, `scene ${k} seed ${seed}: no shot may be counted`);
      if (k === 2) assert.equal(letdownsOf(res).length, 3, `scene ${k} seed ${seed}: three let-downs`);
    }
  });
});

/* ---- 6. 4.7 の扱い: 補完・左右の入れ替わり・人の切り替わり・追跡の途切れ ---- */
test("hidden draw wrist is imputed from the elbow; left/right swaps are repaired", () => {
  const cap = FX.makeCapture({ seed: 61, events: sixShots() }), t = cap.truth[2];
  /* 3 射目の保持の途中 0.9 秒、引き手の手首が見えない */
  for (const p of cap.poses) if (p.tMs > t.anchorMs + 500 && p.tMs < t.anchorMs + 1400) p.vis.dWr = 0.1;
  /* 5 射目の保持の途中 4 コマ、腕の左右が入れ替わる */
  const t5 = cap.truth[4];
  let swapped = 0;
  for (const p of cap.poses) {
    if (p.tMs > t5.anchorMs + 800 && swapped < 4) {
      for (const [a, b] of [["bSh", "dSh"], ["bEl", "dEl"], ["bWr", "dWr"]]) { const tmp = p.pts[a]; p.pts[a] = p.pts[b]; p.pts[b] = tmp; }
      swapped++;
    }
  }
  const res = FA.analyze(FX.toFrames(cap.poses), OPT);
  assert.equal(shotsOf(res).length, 6);
  assert.ok(res.quality.repaired.imputedDraw >= 20, "wrist imputed while hidden");
  assert.equal(res.quality.repaired.swapped, 4);
  assert.equal(match(cap.truth, shotsOf(res), 60).length, 6, "release times stay within 60 ms");
});

test("tracking lost at the release: counted, time inside the gap, uncertainty reported", () => {
  const cap = FX.makeCapture({ seed: 71, events: sixShots() }), t = cap.truth[3];
  for (const p of cap.poses) if (p.tMs > t.releaseMs - 10 && p.tMs < t.releaseMs + 240) p.pts = null;
  const res = FA.analyze(FX.toFrames(cap.poses), OPT), det = shotsOf(res);
  assert.equal(det.length, 6);
  const d = det[3];
  assert.ok(Math.abs(d.releaseMs - t.releaseMs) <= 150, `release ${d.releaseMs - t.releaseMs} ms from the truth`);
  assert.ok(d.releaseUncMs >= 100, "the gap widens the reported uncertainty");
  assert.ok(Math.abs(d.releaseMs - t.releaseMs) <= d.releaseUncMs + 40, "the error is covered by the reported uncertainty");
});

test("identity jump: a hold interrupted by another body is cut, not counted", () => {
  const cap = FX.makeCapture({ seed: 81, events: sixShots() }), t = cap.truth[1];
  /* 2 射目の保持の途中から、姿が 3 胴ぶん横へ跳ぶ（別の人を拾った） */
  for (const p of cap.poses) if (p.tMs > t.anchorMs + 900 && p.tMs < t.releaseMs + 4000) for (const n of FX.ROLES) p.pts[n] = [p.pts[n][0] + 600, p.pts[n][1]];
  const res = FA.analyze(FX.toFrames(cap.poses, { w: 1600, h: 900 }), { frame: { w: 1600, h: 900 }, handedness: "right", fps: 30 });
  assert.ok(res.quality.repaired.cuts >= 1);
  assert.ok(!shotsOf(res).some((d) => d.anchorStartMs < t.anchorMs + 900 && d.releaseMs > t.anchorMs + 900), "no shot spans the jump");
  assert.equal(match(cap.truth.filter((x) => x !== t), shotsOf(res), 150).length, 5);
});

/* ---- 6b. 壊れかけた入力でも落ちない（保持の窓が欠けた射、時刻の飛び、想定していない形） ---- */
test("template: a shot whose hold window is hidden keeps the other shots' typicality aligned and does not throw", () => {
  const ev = [];
  for (let i = 0; i < 6; i++) ev.push({ kind: "shot", holdMs: 2400 + 300 * i, drawMs: 1250 });
  const cap = FX.makeCapture({ seed: 5, events: ev }),
    frames = FX.toFrames(cap.poses);
  const base = shotsOf(FA.analyze(frames, OPT));
  assert.equal(base.length, 6);
  for (const which of [0, 2, 5]) {
    for (const vis of [0, 0.2]) {
      /* その射の離れの前 650 ms のあいだ、弓手の肘と手首（13・15）が見えない */
      const rel = cap.truth[which].releaseMs;
      const hidden = frames.map((f) =>
        f.tMs >= rel - 650 && f.tMs <= rel && f.landmarks
          ? {
              tMs: f.tMs,
              landmarks: f.landmarks.map((p, i) =>
                i === 13 || i === 15 ? { ...p, visibility: vis } : p,
              ),
            }
          : f,
      );
      let res;
      assert.doesNotThrow(
        () => {
          res = FA.analyze(hidden, OPT);
        },
        `shot ${which + 1}, visibility ${vis}`,
      );
      const det = shotsOf(res);
      assert.equal(det.length, 6);
      assert.ok(!res.quality.warnings.includes("internalError"));
      assert.equal(res.quality.template.shots, 5, "the hidden shot is left out of the template");
      det.forEach((d, i) => {
        if (i === which)
          assert.equal(d.typicality, null, "no typicality for the shot that could not be compared");
        else
          assert.ok(
            Number.isFinite(d.typicality) && d.typicality < 1,
            `shot ${i + 1} keeps its own typicality (${d.typicality})`,
          );
      });
    }
  }
});

test("contract: an unexpected internal error gives an empty result with a warning, not an exception", () => {
  /* 点の列が欠けた（役割が無い）入力。packFrames からは来ない形 */
  const pk = {
    n: 20,
    t: Float64Array.from({ length: 20 }, (_, i) => i * 33),
    pose: new Uint8Array(20),
    pts: {},
    coverage: 1,
  };
  let res;
  assert.doesNotThrow(() => {
    res = FA.analyzePacked(pk, OPT);
  });
  assert.deepEqual(res.shots, []);
  assert.deepEqual(res.candidates, []);
  assert.deepEqual(res.quality.warnings, ["internalError"]);
  assert.equal(res.quality.frames, 20);
});

test("timestamp jump: the series is cut at the gap, not stretched across it; times are reported on the original clock", () => {
  const cap = FX.makeCapture({ seed: 2, events: sixShots() }),
    frames = FX.toFrames(cap.poses);
  const at = cap.truth[2].releaseMs + 3000,
    GAP = 3600000; // 3 射目のあとで、時刻が 1 時間飛ぶ
  const jumped = frames.map((f) =>
    f.tMs >= at ? { tMs: f.tMs + GAP, landmarks: f.landmarks } : f,
  );
  const sig = FA.prepare(FA.packFrames(jumped, OPT), OPT);
  assert.ok(
    sig.n <= frames.length + FA.P.GAP_CUT_MS / sig.dt + 2,
    `resampled length follows the frame count (${sig.n} samples for ${frames.length} frames)`,
  );
  const res = FA.analyze(jumped, OPT),
    det = shotsOf(res);
  assert.ok(res.quality.warnings.includes("timeGap"));
  assert.equal(det.length, 6);
  const truth = cap.truth.map((t) => ({
    releaseMs: t.releaseMs >= at ? t.releaseMs + GAP : t.releaseMs,
  }));
  assert.equal(
    match(truth, det, 80).length,
    6,
    "releases after the jump are reported at their original times",
  );
  assert.ok(
    Math.abs(res.quality.durationMs - (jumped[jumped.length - 1].tMs - jumped[0].tMs)) < 200,
  );
  /* 壊れた時刻（約 116 日ぶんの飛び）でも、大きな配列を作らずに終わる */
  const broken = frames.map((f) =>
    f.tMs >= at ? { tMs: f.tMs + 1e10, landmarks: f.landmarks } : f,
  );
  assert.equal(shotsOf(FA.analyze(broken, OPT)).length, 6);
  /* 飛びが無ければ何も変わらない */
  assert.ok(!FA.analyze(frames, OPT).quality.warnings.includes("timeGap"));
  assert.ok(FA.P.MAX_SAMPLES >= 30 * 60 * 60, "a 30-minute capture at 60 fps is never truncated");
});

/* ---- 7. 測定のゆれと比較（5.3・5.4） ---- */
test("comparison: a real difference is flagged, noise alone is not", () => {
  let flaggedTrue = 0, flaggedNoise = 0;
  const N = 12;
  for (let seed = 1; seed <= N; seed++) {
    const same = FA.analyze(FX.toFrames(FX.makeCapture({ seed: 900 + seed, events: sixShots() }).poses), OPT);
    if (FA.compareShots(same).flags.length) flaggedNoise++;
    /* 4 射目だけ、アンカーを胴の 8% 下げる */
    const diff = FA.analyze(FX.toFrames(FX.makeCapture({ seed: 900 + seed, events: sixShots((i) => (i === 3 ? { anchorDy: -0.08 } : null)) }).poses), OPT);
    const cmp = FA.compareShots(diff);
    if (cmp.flags.some((f) => f.shot === 3 && f.key === "ancY" && f.delta < 0)) flaggedTrue++;
    assert.ok(!cmp.flags.some((f) => f.shot !== 3), "only the shot that differs may be flagged");
    assert.ok(cmp.features.ancY.noise > 0 && cmp.features.ancY.spread > cmp.features.ancY.noise);
  }
  assert.ok(flaggedNoise <= 1, `noise-only captures flagged: ${flaggedNoise}/${N}`);
  assert.ok(flaggedTrue >= Math.ceil(0.9 * N), `8% torso difference flagged in ${flaggedTrue}/${N}`);
});

/* ---- 8. 速さ（7.4: 10 分・30fps を 1.5 秒以内） ---- */
let speed = null;
test("speed: 10 minutes at 30 fps within 1.5 s", () => {
  const ev = [];
  for (let i = 0; i < 54; i++) ev.push({ kind: "shot", holdMs: 2500 + 300 * (i % 6), drawMs: 1200 + 150 * (i % 4) });
  const cap = FX.makeCapture({ seed: 7, events: ev }), frames = FX.toFrames(cap.poses);
  assert.ok(frames.length >= 18000, `capture must be at least 10 min at 30 fps (${frames.length} frames)`);
  let best = Infinity, res = null;
  for (let k = 0; k < 3; k++) {
    const t0 = process.hrtime.bigint();
    res = FA.analyze(frames, OPT);
    best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6);
  }
  speed = { frames: frames.length, ms: Math.round(best), shots: shotsOf(res).length };
  assert.equal(speed.shots, 54);
  assert.ok(best <= 1500, `analysis took ${best.toFixed(0)} ms`);
});

for (const line of results) console.log(`  ok  ${line}`);
const fmt = (b) => `recall ${b.recall.toFixed(3)}, precision ${b.precision.toFixed(3)}, exact count ${(100 * b.exact).toFixed(0)}%, release bias ${b.relBias.toFixed(0)} ms / p95 ${b.relP95.toFixed(0)} ms, anchor p95 ${b.anchorP95.toFixed(0)} ms, hold p95 ${b.holdP95.toFixed(0)} ms`;
for (const fps of [30, 60, 15]) console.log(`  basic ${fps} fps: ${fmt(basic[fps])}`);
console.log(`  speed: ${speed.frames} frames (${(speed.frames / 30 / 60).toFixed(1)} min at 30 fps) in ${speed.ms} ms`);
console.log(`Form analyser v2 checks OK (${results.length} tests)`);
