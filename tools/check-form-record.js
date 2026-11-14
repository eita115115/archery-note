"use strict";
/* 射型の記録 v2 の記録の形・バッファ・置き方の確認・比較（scripts/44-form-record.js）の検査。
   npm run check:form-analyze の後半（check:all に入っている）。設計: docs/design/form-v2/design.md 5 章・10 章。
   合成の射手は tools/form-analyze-fixture.js。実射の映像は使わない。 */
const assert = require("node:assert/strict");
const FA = require("./form-analyze-loader.js");
const FV = require("./form-record-loader.js");
const FX = require("./form-analyze-fixture.js");

const results = [];
function test(name, fn) {
  fn();
  results.push(name);
}
const CTX = {
  id: "mabc1234xyz",
  date: "2026-11-14",
  ts: 1794614400000,
  sessionId: "mabc1234xyz",
  setupId: "mabc1234xyz",
  appVer: 128,
  modelVer: "pose_landmarker_lite v1 (tasks-vision 0.10.14)",
  facing: "environment",
  hand: "right",
  src: "live",
};
/* 6 射 + 引き戻し 1 回 + 離れがはっきりしない保持 1 回。4 射目は保持が長く、アンカーが低い */
const EVENTS = [
  { kind: "shot", holdMs: 3400 },
  { kind: "shot", holdMs: 3100 },
  { kind: "shot", holdMs: 3600 },
  { kind: "letdown", holdMs: 4800 },
  { kind: "shot", holdMs: 5400, anchorDy: -0.09 },
  { kind: "shot", holdMs: 3200 },
  { kind: "shot", holdMs: 3000, back: 0.03 },
  { kind: "shot", holdMs: 3300 },
];
function capture(w, h, events, seed) {
  const cap = FX.makeCapture({ seed: seed || 7, events: events || EVENTS, fps: 30, torsoPx: 200, cx: 300, cy: 420 });
  const frames = FX.toFrames(cap.poses, { w, h });
  const buf = FV.makeBuffer();
  for (const f of frames) buf.push(f.tMs, f.landmarks, w, h);
  return { cap, frames, buf };
}
const analyse = (buf) => FA.analyzePacked(buf.pack("right"), { handedness: "right", fps: 30 });
const allInts = (v) =>
  Array.isArray(v) ? v.every(allInts) : v === null || Number.isInteger(v) || typeof v === "string";

test("buffer: packed stream gives the same analysis as packFrames, in portrait and landscape", () => {
  for (const [w, h] of [
    [720, 1280],
    [1280, 720],
  ]) {
    const { frames, buf } = capture(w, h);
    const direct = FA.analyze(frames, { frame: { w, h }, handedness: "right", fps: 30 });
    const viaBuf = analyse(buf);
    assert.equal(buf.n, frames.length);
    assert.equal(viaBuf.shots.length, direct.shots.length);
    assert.equal(viaBuf.candidates.length, direct.candidates.length);
    viaBuf.shots.forEach((s, i) => {
      assert.equal(s.kind, direct.shots[i].kind);
      assert.ok(Math.abs(s.releaseMs - direct.shots[i].releaseMs) < 1, "release within 1 ms");
      assert.ok(Math.abs(s.holdMs - direct.shots[i].holdMs) < 1, "hold within 1 ms");
    });
    assert.deepEqual(buf.frame, { w, h, mixed: false });
    assert.equal(buf.coverage, 1);
  }
});

test("buffer: rejects non-increasing times, stops at the frame limit, and windows by time", () => {
  const buf = FV.makeBuffer({ maxFrames: 5 });
  assert.equal(buf.push(10, null, 0, 0), true);
  assert.equal(buf.push(10, null, 0, 0), false);
  assert.equal(buf.push(NaN, null, 0, 0), false);
  for (let i = 1; i <= 4; i++) assert.equal(buf.push(10 + i * 33, null, 720, 1280), true);
  assert.equal(buf.full, true);
  assert.equal(buf.push(999, null, 720, 1280), false);
  assert.equal(buf.n, 5);
  assert.equal(buf.pack("right", 76).n, 3);
  assert.equal(buf.pack("right").n, 5);
  assert.equal(buf.pack("right").coverage, 0);
  /* 30 分・60fps の上限でも 13MB 未満（algorithm.md 10.1） */
  const perFrame = FV.makeBuffer().bytes() || 8 + 27 * 4 + 1;
  assert.ok((FV.LIMITS.MAX_FRAMES * (8 + 27 * 4 + 1)) / 1e6 < 13, `limit stays under 13 MB (${perFrame})`);
  /* 左利きは役割を入れ替えて渡す */
  const { frames } = capture(720, 1280);
  const b2 = FV.makeBuffer();
  b2.push(0, frames[0].landmarks, 720, 1280);
  const r = b2.pack("right"),
    l = b2.pack("left");
  assert.equal(r.pts.bWr.x[0], l.pts.dWr.x[0]);
  assert.equal(r.pts.dSh.y[0], l.pts.bSh.y[0]);
});

test("record: shape, integers only, size budget, JSON round trip", () => {
  for (const [w, h] of [
    [720, 1280],
    [1280, 720],
  ]) {
    const { buf } = capture(w, h);
    const res = analyse(buf);
    assert.equal(res.shots.filter((s) => s.kind === "shot").length, 6);
    assert.equal(res.candidates.length, 1);
    const rec = FV.buildRecord(res, { ...CTX, frame: { w, h } });
    assert.equal(rec.shots, 6);
    assert.deepEqual(rec.features, []);
    assert.deepEqual(rec.cap, {
      g: 3,
      fw: w,
      fh: h,
      mw: w,
      mh: h,
      o: w < h ? "p" : "l",
      crop: 0,
      facing: "environment",
      hand: "right",
      src: "live",
    });
    const v = rec.v2;
    assert.deepEqual(Object.keys(v), [
      "av",
      "fv",
      "dur",
      "cov",
      "tpx",
      "view",
      "ld",
      "ev",
      "cd",
      "f",
      "nz",
      "nd",
      "ps",
      "pr",
      "ed",
      "w",
    ]);
    assert.equal(v.av, FA.VERSION);
    assert.equal(v.fv, FV.FV);
    assert.equal(v.ld, 1);
    assert.equal(v.ev.length, 7);
    assert.equal(v.cd.length, 1);
    assert.equal(v.f.length, 6);
    assert.equal(v.ps.length, 6);
    assert.equal(v.pr.length, 6);
    assert.deepEqual(v.ed, [0, 0]);
    for (const row of v.f) assert.equal(row.length, FV.COLS.length);
    for (const row of v.ps.concat(v.pr)) assert.equal(row.length, 18);
    assert.equal(v.nz.length, FV.COLS.length);
    for (const k of ["ev", "cd", "f", "nz", "nd", "ps", "pr"]) assert.ok(allInts(v[k]), `${k} holds integers`);
    const json = JSON.stringify(rec);
    assert.ok(json.length <= 2000, `six shots, a let-down and a candidate fit in 2 KB, got ${json.length}`);
    assert.deepEqual(JSON.parse(json), rec);
    assert.ok(!/landmarks|visibility|"t":\[/.test(json), "no landmark stream is stored");
    assert.ok(FV.isV2(rec));
    /* 画面の値は保存した形だけから作る: 保存の前後で同じ */
    const a = FV.read(rec),
      b = FV.read(JSON.parse(json));
    assert.equal(a.count, 6);
    assert.equal(a.letdowns, 1);
    assert.equal(a.openCands, 1);
    assert.deepEqual(
      a.events.map((e) => [e.kind, e.n, e.tS]),
      b.events.map((e) => [e.kind, e.n, e.tS]),
    );
    assert.deepEqual(FV.compare(a, FA).flags, FV.compare(b, FA).flags);
  }
  /* 12 射で約 3.2KB、上限の 36 射で 9KB ほど */
  const twelve = [];
  for (let i = 0; i < 12; i++) twelve.push({ kind: "shot", holdMs: 2600 + 150 * (i % 5) });
  const big = capture(720, 1280, twelve, 3);
  const rec12 = FV.buildRecord(analyse(big.buf), { ...CTX, frame: { w: 720, h: 1280 } });
  assert.equal(rec12.shots, 12);
  assert.ok(JSON.stringify(rec12).length <= 3400, `twelve shots fit in 3.4 KB, got ${JSON.stringify(rec12).length}`);
});

test("record: portrait and landscape of the same pixels store the same values", () => {
  const p = FV.buildRecord(analyse(capture(720, 1280).buf), { ...CTX, frame: { w: 720, h: 1280 } });
  const l = FV.buildRecord(analyse(capture(1280, 720).buf), { ...CTX, frame: { w: 1280, h: 720 } });
  assert.deepEqual(p.v2.f, l.v2.f);
  assert.deepEqual(p.v2.ev, l.v2.ev);
  assert.deepEqual(p.v2.nz, l.v2.nz);
  assert.deepEqual(p.v2.ps, l.v2.ps);
});

test("fix the count: removing a shot, adding a candidate and counting a let-down", () => {
  const base = FV.buildRecord(analyse(capture(720, 1280).buf), { ...CTX, frame: { w: 720, h: 1280 } });
  const frozen = JSON.stringify(base);
  const removedRec = FV.setCounted(base, "ev", 1, false);
  assert.equal(JSON.stringify(base), frozen, "the edit returns a copy");
  const removed = FV.read(removedRec);
  assert.equal(removed.count, 5);
  assert.equal(removed.compared.length, 5);
  assert.equal(removedRec.shots, 5);
  assert.deepEqual(removedRec.v2.ed, [0, 1]);
  assert.equal(removedRec.v2.f.length, 6, "the removed shot keeps its values so the edit can be undone");
  assert.deepEqual(
    removed.events.filter((e) => e.counted).map((e) => e.n),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(FV.setCounted(removedRec, "ev", 1, true), base, "undoing the edit restores the record");
  const addedRec = FV.setCounted(base, "cd", 0, true);
  const added = FV.read(addedRec);
  assert.equal(added.count, 7);
  assert.equal(addedRec.shots, 7);
  assert.equal(added.compared.length, 6, "an added candidate has no values and is not compared");
  assert.equal(added.openCands, 0);
  assert.deepEqual(addedRec.v2.ed, [1, 0]);
  assert.equal(addedRec.v2.cd[0][6], 1);
  const cand = added.events.find((e) => e.kind === "cand");
  assert.equal(cand.n, 6, "the candidate takes its place in time order");
  assert.equal(cand.reason, "noRelease");
  const ldRec = FV.setCounted(base, "ev", 3, true);
  const ld = FV.read(ldRec);
  assert.equal(ldRec.v2.ev[3][0], 1, "row 3 is the let-down");
  assert.equal(ld.count, 7);
  assert.equal(ld.letdowns, 0);
  assert.equal(ldRec.v2.ld, 0);
  assert.deepEqual(ldRec.v2.ed, [1, 0]);
});

test("compare: the shot that differed is named with numbers; noise alone marks nothing", () => {
  const m = FV.read(FV.buildRecord(analyse(capture(720, 1280).buf), { ...CTX, frame: { w: 720, h: 1280 } }));
  const cmp = FV.compare(m, FA);
  assert.equal(cmp.n, 6);
  assert.ok(cmp.flags.some((f) => f.n === 4 && f.key === "holdMs"));
  assert.ok(cmp.flags.some((f) => f.n === 4 && f.key === "ancY"));
  assert.ok(cmp.flags.every((f) => f.n === 4), "only the fourth shot is marked");
  const s = FV.summary(m, cmp, null);
  assert.equal(s.n, 4);
  assert.match(s.text, /^4 射目は、保持が 5\.\d 秒でした。ほかの 5 射は 3\.\d〜3\.\d 秒です。$/);
  assert.ok(cmp.feat.holdMs.limit >= 300, "the time floor is 0.3 s");
  assert.equal(cmp.feat.holdMs.indistinct, false);
  assert.equal(cmp.feat.headY.indistinct, true);
  /* 同じ射だけの回 */
  const same = [];
  for (let i = 0; i < 6; i++) same.push({ kind: "shot", holdMs: 3000 });
  let flagged = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const mm = FV.read(FV.buildRecord(analyse(capture(720, 1280, same, seed).buf), { ...CTX, frame: { w: 720, h: 1280 } }));
    const c = FV.compare(mm, FA);
    if (c.flags.length) flagged++;
    else assert.equal(FV.summary(mm, c, null).text, "6 射のあいだに、測定のゆれより大きい違いは見つかりませんでした。");
  }
  assert.ok(flagged <= 2, `noise-only captures are rarely marked (${flagged}/20)`);
  /* 4 射に満たない回は比べない */
  const three = FV.read(FV.buildRecord(analyse(capture(720, 1280, same.slice(0, 3), 2).buf), { ...CTX, frame: { w: 720, h: 1280 } }));
  const c3 = FV.compare(three, FA);
  assert.deepEqual(c3.flags, []);
  assert.match(FV.summary(three, c3, null).text, /4 射以上要ります。この回は 3 射でした。/);
});

test("height: cm appears only with the setting, torso percent always", () => {
  assert.equal(FV.cmText("ancY", 3, null), "");
  assert.equal(FV.cmText("ancY", 3, undefined), "");
  assert.equal(FV.cmText("ancY", 3, 90), "", "an implausible height is ignored");
  assert.equal(FV.cmText("ancY", 3, 170), "約 1.5cm");
  assert.equal(FV.cmText("bowDy", 30, 170), "約 15cm");
  assert.equal(FV.cmText("holdMs", 3, 170), "", "times have no cm");
  assert.equal(FV.cmText("ext", 3, 170), "", "the draw-length guide is relative to the capture median");
  assert.equal(FV.TORSO_PER_HEIGHT, 0.288);
  const m = FV.read(FV.buildRecord(analyse(capture(720, 1280).buf), { ...CTX, frame: { w: 720, h: 1280 } }));
  const cmp = FV.compare(m, FA);
  const anc = cmp.flags.find((f) => f.key === "ancY");
  assert.ok(!/cm/.test(FV.flagSentence(anc, cmp, null)));
  assert.match(FV.flagSentence(anc, cmp, 170), /胴の \d+\.\d%（約 \d+cm）/);
});

test("views: oblique and back-side captures hide what one camera cannot measure", () => {
  const rec = FV.buildRecord(analyse(capture(720, 1280).buf), { ...CTX, frame: { w: 720, h: 1280 } });
  const steep = JSON.parse(JSON.stringify(rec));
  steep.v2.view.cls = "x";
  assert.deepEqual(FV.keysFor(steep), ["holdMs", "drawMs", "followMs", "bowDy", "ancY", "headY"]);
  const back = JSON.parse(JSON.stringify(rec));
  back.v2.view.side = "b";
  assert.ok(!FV.keysFor(back).includes("ancY"));
  assert.ok(FV.keysFor(back).includes("holdMs"));
});

test("comparable: like with like only; old records are never compared", () => {
  const a = FV.buildRecord(analyse(capture(720, 1280).buf), { ...CTX, frame: { w: 720, h: 1280 } });
  a.v2.view.cls = "s";
  const b = JSON.parse(JSON.stringify(a));
  const legacy = { id: "old", features: [{ angles: { bowArm: 170 } }], shots: 1 };
  const stageA = { ...legacy, cap: { g: 2, fw: 720, fh: 1280 } };
  assert.equal(FV.isV2(legacy), false);
  assert.equal(FV.isV2(stageA), false);
  assert.equal(FV.comparable(a, legacy, "holdMs").ok, false);
  assert.equal(FV.comparable(a, stageA, "holdMs").ok, false);
  for (const k of ["holdMs", "ancY", "ext"]) assert.equal(FV.comparable(a, b, k).ok, true, k);
  b.cap.fw = 1280; // 縦向きと横向きは分けない
  b.cap.fh = 720;
  assert.equal(FV.comparable(a, b, "ext").ok, true);
  b.v2.view.cls = "o";
  assert.equal(FV.comparable(a, b, "holdMs").ok, true);
  assert.equal(FV.comparable(a, b, "ancY").ok, true);
  assert.equal(FV.comparable(a, b, "ext").ok, false);
  b.v2.view.cls = "s";
  b.v2.view.rho = Math.round(a.v2.view.rho * 1.08);
  assert.equal(FV.comparable(a, b, "ext").ok, false);
  b.v2.view.rho = a.v2.view.rho;
  b.v2.view.side = "b";
  assert.equal(FV.comparable(a, b, "holdMs").ok, true);
  assert.equal(FV.comparable(a, b, "ancY").ok, false);
  b.v2.view.side = "c";
  b.cap.hand = "left";
  assert.equal(FV.comparable(a, b, "holdMs").ok, false);
  b.cap.hand = "right";
  b.v2.av = 2;
  assert.equal(FV.comparable(a, b, "holdMs").ok, false);
  b.v2.av = a.v2.av;
  b.v2.tpx = 90;
  assert.equal(FV.comparable(a, b, "holdMs").ok, false);
  /* 推移は v2 の記録だけ */
  const t = FV.trend([legacy, stageA, a, { ...JSON.parse(JSON.stringify(a)), id: "x2", ts: a.ts + 1 }], "holdMs");
  assert.equal(t.points.length, 2);
  assert.equal(t.excluded, 0);
});

/* 撮影中の数え方を、コマを 1 つずつ流して確かめる。→ 途中の数の最大、最後の数、解析の回数 */
function streamLive(frames, w, h, hand, fps, analyzer) {
  const buf = FV.makeBuffer(),
    live = FV.makeLiveCounter(analyzer || FA);
  const t0 = frames.find((f) => Number.isFinite(f.tMs)).tMs;
  let last = 0,
    runs = 0,
    monotone = true;
  for (const f of frames) {
    buf.push(f.tMs - t0, f.landmarks, w, h);
    if (!live.due(f.tMs - t0)) continue;
    const r = live.update(buf, hand, fps);
    runs++;
    if (r.shots < last) monotone = false;
    last = r.shots;
  }
  return { buf, live, last, runs, monotone };
}
test("live count: the simple capture reaches the full count, never passes it, and never goes down", () => {
  const { frames, buf: full } = capture(720, 1280);
  const truth = analyse(full).shots.filter((s) => s.kind === "shot").length;
  /* 最後の射のあと 6 秒、腕を下ろしたまま立っている（数が確かめられるまでの時間） */
  const end = frames[frames.length - 1];
  const tail = [];
  for (let k = 1; k <= 180; k++)
    tail.push({ tMs: end.tMs + k * (1000 / 30), landmarks: end.landmarks });
  const buf = FV.makeBuffer(),
    live = FV.makeLiveCounter(FA);
  let last = 0,
    runs = 0;
  for (const f of frames.concat(tail)) {
    buf.push(f.tMs, f.landmarks, 720, 1280);
    if (!live.due(f.tMs)) continue;
    const r = live.update(buf, "right", 30);
    runs++;
    assert.ok(r.shots >= last, "the count never goes down");
    assert.ok(r.shots <= truth, "the count never passes the final count");
    last = r.shots;
  }
  assert.equal(last, truth);
  assert.equal(live.letdowns, 1);
  const sec = (end.tMs + 6000) / 1000;
  assert.ok(
    runs >= sec - 2 && runs <= sec + 2,
    `one run every second (${runs} runs in ${sec.toFixed(0)} s)`,
  );
});

test("live count: a release seen in one window only is not counted; a let-down seen later as a shot is upgraded", () => {
  /* 解析器の代わり: 呼ばれるたびに、決めた答えを順に返す（数え方だけを確かめる） */
  const script = (answers) => {
    let i = 0;
    return {
      analyzePacked: () => ({
        shots: answers[Math.min(i++, answers.length - 1)],
        candidates: [],
        quality: {},
      }),
    };
  };
  const shot = (t, hold) => ({
    kind: "shot",
    releaseMs: t,
    holdMs: hold === undefined ? 2500 : hold,
  });
  const ld = (t) => ({ kind: "letdown", releaseMs: t, holdMs: 3000 });
  const drive = (answers) => {
    const buf = FV.makeBuffer(),
      live = FV.makeLiveCounter(script(answers)),
      counts = [];
    for (let k = 0; k < answers.length; k++) {
      buf.push(10000 + k * 1000, null, 720, 1280);
      assert.ok(live.due(10000 + k * 1000));
      counts.push(live.update(buf, "right", 30).shots);
    }
    return { live, counts };
  };
  const N = FV.LIMITS.LIVE_CONFIRM_RUNS;
  assert.ok(N >= 3, "a release must be seen in several consecutive windows");
  /* 続けて N 回、同じ時刻に見つかって初めて数える */
  const steady = drive(Array.from({ length: N + 1 }, () => [shot(9000)]));
  assert.deepEqual(steady.counts.slice(0, N - 1), Array(N - 1).fill(0));
  assert.equal(steady.counts[N - 1], 1);
  assert.equal(steady.counts[N], 1, "counted once");
  /* 1 回だけ現れて消える射、時刻が定まらない射は数えない */
  assert.deepEqual(
    drive([[shot(9000)], [], [shot(9000)], [], [shot(9000)], []]).counts,
    [0, 0, 0, 0, 0, 0],
  );
  assert.equal(drive(Array.from({ length: 8 }, (_, k) => [shot(9000 - k * 400)])).live.shots, 0);
  /* 保持が短すぎる射は数えない */
  assert.equal(
    drive(Array.from({ length: N + 2 }, () => [shot(9000, FV.LIMITS.LIVE_MIN_HOLD_MS - 100)])).live
      .shots,
    0,
  );
  /* 離れからずっと遅れて初めて確かめられたものは数えない */
  const late = Array.from({ length: 14 }, (_, k) => (k < 10 ? [] : [shot(9000)]));
  assert.equal(drive(late).live.shots, 0);
  /* 引き戻しと数えたものが、あとで続けて射と見えたら、射に替える（数は増える。引き戻しは減る） */
  const up = drive([
    ...Array.from({ length: N }, () => [ld(9000)]),
    ...Array.from({ length: N }, () => [shot(9050)]),
  ]);
  assert.equal(up.counts[N - 1], 0);
  assert.equal(up.live.letdowns, 0);
  assert.equal(up.live.shots, 1);
  assert.equal(up.counts[2 * N - 2], 0, "not before the shot has been seen N times");
  assert.equal(up.counts[2 * N - 1], 1);
  /* 射と数えたものは、あとで引き戻しに見えても減らさない */
  const down = drive([
    ...Array.from({ length: N }, () => [shot(9000)]),
    ...Array.from({ length: N + 1 }, () => [ld(9000)]),
  ]);
  assert.equal(down.live.shots, 1);
  assert.equal(down.live.letdowns, 0);
});

/* ベンチマーク（tools/form-bench）の全部の場面 × 種 1〜3 を、撮影中と同じようにコマを 1 つずつ流す。
   撮影中の数は、全体を解析した数を一度も超えない（少なく出るのはよい）。数十秒かかる */
let liveBench = null;
test("live count: on every benchmark scenario the streamed count never exceeds the final analysis", () => {
  const B = require("./form-bench/run-bench.js");
  const SC = require("./form-bench/scenarios.js");
  const seeds = (process.env.FORM_LIVE_SEEDS || "1,2,3").split(",").map(Number);
  const stat = { sessions: 0, over: 0, under: 0, equal: 0, liveShots: 0, finalShots: 0, worst: [] };
  let row;
  const adapter = {
    name: "live-count-check",
    provides: [],
    analyze(frames, meta) {
      const s = streamLive(frames, meta.frame.w, meta.frame.h, meta.handedness, meta.fps);
      const full = FA.analyzePacked(s.buf.pack(meta.handedness), {
        handedness: meta.handedness,
        fps: meta.fps,
      });
      row = {
        live: s.last,
        final: full.shots.filter((x) => x.kind === "shot").length,
        monotone: s.monotone,
      };
      return { shots: [], quality: {} };
    },
  };
  for (const scn of SC.SCENARIOS) {
    for (const seed of seeds) {
      row = null;
      B.runSession(SC.resolveScenario(scn), seed, adapter);
      assert.ok(row, `${scn.id} seed ${seed} ran`);
      stat.sessions++;
      stat.liveShots += row.live;
      stat.finalShots += row.final;
      assert.ok(row.monotone, `${scn.id} seed ${seed}: the count never goes down`);
      if (row.live > row.final) {
        stat.over++;
        stat.worst.push(`${scn.id} seed ${seed}: live ${row.live} > final ${row.final}`);
      } else if (row.live < row.final) stat.under++;
      else stat.equal++;
    }
  }
  liveBench = stat;
  assert.ok(stat.sessions >= 100 || seeds.length < 3, `all scenarios ran (${stat.sessions})`);
  assert.equal(
    stat.over,
    0,
    `the live count exceeded the final count in ${stat.over} sessions: ${stat.worst.join("; ")}`,
  );
});

test("placement: the five rows are measured from the current landmarks", () => {
  const { cap } = capture(720, 1280);
  const frames = FX.toFrames(cap.poses, { w: 720, h: 1280 });
  const rest = frames[5].landmarks;
  const mem = {};
  const a = FV.placement(rest, { w: 720, h: 1280 }, "right", 28, mem);
  assert.deepEqual(
    a.rows.map((r) => r.k),
    ["写り", "大きさ", "余白", "向き", "速さ"],
  );
  assert.equal(a.rows[0].state, "ok");
  assert.equal(a.rows[1].text, "胴の長さ 200px");
  assert.equal(a.rows[2].state, "warn", "at rest the reach is predicted: 300 px − 1.6 torso leaves the frame");
  assert.equal(a.rows[3].state, "wait");
  assert.equal(a.rows[4].text, "毎秒 28 コマ");
  assert.equal(a.raised, false);
  /* 弓を上げた形（保持）で確かめる */
  const res = analyse(capture(720, 1280).buf);
  const holdT = res.shots[0].releaseMs - 500;
  const held = frames.find((f) => f.tMs >= holdT).landmarks;
  const b = FV.placement(held, { w: 720, h: 1280 }, "right", 28, mem);
  assert.equal(b.raised, true);
  assert.match(b.rows[2].text, /弓を上げた形で確かめました/);
  assert.equal(b.rows[2].state, "ok");
  assert.match(b.rows[3].text, /胸側/);
  assert.equal(b.rows[3].state, "info");
  /* 覚えは、腕を下ろしたあとも残る */
  const c = FV.placement(rest, { w: 720, h: 1280 }, "right", 28, mem);
  assert.match(c.rows[2].text, /弓を上げた形で確かめました/);
  /* 左右を反転した映像（右利きで弓が画面の左）は背中側 */
  const mirrored = FX.toFrames(cap.poses, { w: 720, h: 1280, mirror: true, canvasW: 600 });
  const d = FV.placement(mirrored.find((f) => f.tMs >= holdT).landmarks, { w: 720, h: 1280 }, "right", 28, {});
  assert.match(d.rows[3].text, /背中側/);
  /* 小さい・遅い・写っていない */
  const far = FX.toFrames(FX.makeCapture({ seed: 2, events: [], torsoPx: 96, cx: 300, cy: 420 }).poses, { w: 720, h: 1280 })[3].landmarks;
  const e = FV.placement(far, { w: 720, h: 1280 }, "right", 12, {});
  assert.equal(e.rows[1].state, "warn");
  assert.match(e.rows[1].text, /小さく写っています（胴 9\dpx）/);
  assert.match(e.rows[4].text, /解析が遅れています（毎秒 12 コマ）/);
  const none = FV.placement(null, { w: 720, h: 1280 }, "right", 0, {});
  assert.equal(none.rows[0].state, "warn");
  assert.match(none.rows[0].text, /体が写っていません/);
  assert.equal(none.rows[4].state, "wait");
  for (const r of a.rows.concat(b.rows, e.rows, none.rows)) assert.ok(!/NaN|undefined|null/.test(r.text), r.text);
});

test("capture state: a warning only when something needs doing", () => {
  const { cap } = capture(720, 1280);
  const lms = FX.toFrames(cap.poses, { w: 720, h: 1280 })[5].landmarks;
  assert.deepEqual(FV.captureState(lms, 28, 0), { warn: false, text: "体は枠の中です。毎秒 28 コマ。" });
  assert.equal(FV.captureState(lms, 12, 0).warn, true);
  assert.equal(FV.captureState(null, 28, 500).warn, false);
  assert.equal(FV.captureState(null, 28, 2500).warn, true);
  const cut = lms.map((p) => ({ ...p }));
  cut[14].x = 1.02;
  assert.match(FV.captureState(cut, 28, 0).text, /腕が枠の端にかかっています/);
});

test("statistics helpers", () => {
  /* 6 射・ν = 30 なら spread < 1.59·noise は区別できない（algorithm.md 5.4） */
  assert.equal(FV.exceedsF95(1.55 * 1.55, 5, 30), false);
  assert.equal(FV.exceedsF95(1.63 * 1.63, 5, 30), true);
  const iv = FV.sdInterval(6);
  assert.ok(Math.abs(iv.lo - 0.62) < 0.01 && Math.abs(iv.hi - 2.45) < 0.08, `${iv.lo} ${iv.hi}`);
  assert.equal(FV.fmt("holdMs", 3.44), "3.4 秒");
  assert.equal(FV.fmt("bowDy", -0.2), "0%");
  assert.equal(FV.fmt("ancY", -1.26, { sign: true }), "−1.3%");
  assert.equal(FV.fmt("ancY", 1.26, { sign: true }), "+1.3%");
  assert.equal(FV.fmt("lean", null), "—");
});

/* ---------- AN-101: 36 射を超えた撮影、推移、検証用の書き出し、コマの取り出し ---------- */
const MANY = Array.from({ length: 40 }, (_, i) =>
  i === 20 ? { kind: "letdown", holdMs: 2500 } : { kind: "shot", holdMs: 1600 + (i % 5) * 150 },
);
test("split: a capture over 36 shots becomes linked records of at most 36, keeping every shot", () => {
  const { buf } = capture(720, 1280, MANY, 11);
  const result = analyse(buf);
  const real = result.shots.filter((s) => s.kind === "shot").length;
  assert.ok(real > 36, `needs more than 36 shots, got ${real}`);
  const recs = FV.buildRecords(result, { ...CTX, ids: ["second"], frame: { w: 720, h: 1280 } });
  assert.equal(recs.length, Math.ceil(real / 36));
  assert.equal(recs.reduce((n, r) => n + r.shots, 0), real, "no shot is dropped");
  assert.equal(recs.reduce((n, r) => n + r.v2.ev.length, 0), result.shots.length);
  assert.equal(recs.reduce((n, r) => n + r.v2.cd.length, 0), result.candidates.length);
  assert.equal(recs.reduce((n, r) => n + r.v2.ld, 0), result.shots.length - real);
  let offset = 0;
  recs.forEach((r, k) => {
    assert.ok(r.shots <= 36 && r.shots > 0);
    assert.ok(FV.isV2(r));
    assert.equal(r.v2.cid, CTX.id);
    assert.deepEqual(r.v2.part, [k + 1, recs.length, offset]);
    assert.equal(r.v2.f.length, r.shots);
    assert.equal(r.v2.over, undefined);
    assert.ok(allInts(r.v2.span) && r.v2.span[1] > r.v2.span[0]);
    for (const e of r.v2.ev) assert.ok(e[1] > r.v2.span[0] - 1 && e[1] <= r.v2.span[1] + 1, "events fall in the span");
    const m = FV.read(r);
    assert.equal(m.count, r.shots);
    assert.equal(m.compared[0].n, offset + 1, "numbering continues across the parts");
    offset += r.shots;
  });
  assert.equal(recs[0].id, CTX.id);
  assert.equal(recs[1].id, "second");
  assert.ok(recs[1].ts > recs[0].ts);
  assert.ok(Math.abs(recs[0].shots - recs[1].shots) <= 1, "split evenly");
  /* 36 射以下は 1 件で、分けた印を持たない（これまでの形のまま） */
  const one = FV.buildRecords(analyse(capture(720, 1280).buf), { ...CTX, frame: { w: 720, h: 1280 } });
  assert.equal(one.length, 1);
  assert.equal(one[0].v2.cid, undefined);
  assert.equal(one[0].v2.part, undefined);
  assert.equal(one[0].v2.dg, undefined);
  /* 推移では、分けた記録は 1 回 */
  const t = FV.trend(recs, "holdMs");
  assert.equal(t.points.length, 1);
  assert.equal(t.points[0].n, real);
});

test("split: after the count is fixed in one part, the later parts are renumbered; no number is used twice", () => {
  /* 40 回のうち 6 回めが引き戻し（1 つめの記録に入る） */
  const events = Array.from({ length: 40 }, (_, i) =>
    i === 5 ? { kind: "letdown", holdMs: 2500 } : { kind: "shot", holdMs: 1600 + (i % 5) * 150 },
  );
  const result = analyse(capture(720, 1280, events, 9).buf);
  const recs = FV.buildRecords(result, { ...CTX, ids: ["second"], frame: { w: 720, h: 1280 } });
  assert.equal(recs.length, 2);
  const numbers = (list) =>
    list.flatMap((r) =>
      FV.read(r)
        .events.filter((e) => e.counted)
        .map((e) => e.n),
    );
  const total = (list) => list.reduce((n, r) => n + r.shots, 0);
  const consecutive = (list) =>
    assert.deepEqual(
      numbers(list),
      Array.from({ length: total(list) }, (_, i) => i + 1),
    );
  consecutive(recs);
  const frozen = JSON.stringify(recs);
  /* 1 つめの記録の引き戻しを射に数える → 2 つめの記録は 1 つうしろへずれる */
  const ldI = recs[0].v2.ev.findIndex((e) => e[0] === 1);
  assert.ok(ldI >= 0, "the first part has a let-down");
  const added = FV.renumber([FV.setCounted(recs[0], "ev", ldI, true), recs[1]]);
  assert.equal(JSON.stringify(recs), frozen, "the edit returns copies");
  assert.equal(added[0].shots, recs[0].shots + 1);
  assert.deepEqual(added[1].v2.part, [2, 2, recs[0].shots + 1]);
  assert.equal(FV.read(added[1]).offset, recs[0].shots + 1);
  consecutive(added);
  /* 1 つめの記録の射を 1 つ外す → 2 つめの記録は 1 つ前へ */
  const removed = FV.renumber([FV.setCounted(recs[0], "ev", 0, false), recs[1]]);
  assert.deepEqual(removed[1].v2.part, [2, 2, recs[0].shots - 1]);
  consecutive(removed);
  /* 元に戻すと、元の番号 */
  assert.deepEqual(FV.renumber([FV.setCounted(added[0], "ev", ldI, false), added[1]]), recs);
  /* 値を測れた射は 1 件 36 までのまま。候補や引き戻しを足すと射数は 36 を超えうるが、分け直さず、番号だけが続く */
  const full = JSON.parse(JSON.stringify(recs[0]));
  while (full.v2.ev.filter((e) => e[0] === 0).length < 36) {
    full.v2.ev.push([0, full.v2.ev[full.v2.ev.length - 1][1] + 900, 300, 100, 8, 0]);
    full.v2.f.push(full.v2.f[0].slice());
  }
  full.v2.ev.sort((x, y) => x[1] - y[1]);
  const over = FV.renumber([
    FV.setCounted(
      FV.setCounted(full, "ev", 0, true),
      "ev",
      full.v2.ev.findIndex((e) => e[0] === 1),
      true,
    ),
    recs[1],
  ]);
  assert.equal(over[0].shots, 37, "36 measured shots and one counted let-down");
  assert.equal(over[0].v2.f.length, 36);
  assert.equal(FV.read(over[1]).compared[0].n, 38);
  consecutive(over);
  /* 分けていない記録は、そのまま */
  const one = FV.buildRecords(analyse(capture(720, 1280).buf), {
    ...CTX,
    frame: { w: 720, h: 1280 },
  });
  assert.deepEqual(FV.renumber(one), one);
  assert.deepEqual(FV.renumber([]), []);
});

test("read: values that reach the screen are finite integers or null, whatever an imported backup holds", () => {
  const base = FV.buildRecords(analyse(capture(720, 1280, MANY, 11).buf), {
    ...CTX,
    ids: ["second"],
    frame: { w: 720, h: 1280 },
  })[1];
  const good = FV.read(base);
  assert.deepEqual(good.part, { k: 2, of: 2 });
  assert.equal(good.tpx, base.v2.tpx);
  assert.equal(good.cov, base.v2.cov);
  assert.equal(good.dur, base.v2.dur);
  const evil = "<img src=x onerror=alert(1)>";
  const bad = JSON.parse(JSON.stringify(base));
  bad.v2.part = [evil, 2, evil];
  bad.v2.tpx = evil;
  bad.v2.cov = evil;
  bad.v2.dur = evil;
  bad.v2.span = [evil, evil];
  const m = FV.read(bad);
  assert.equal(m.part, null, "a part that is not three integers is not shown");
  assert.equal(m.offset, 0);
  assert.equal(m.tpx, null);
  assert.equal(m.cov, null);
  assert.equal(m.dur, 0);
  assert.equal(m.fromS, 0);
  assert.equal(m.toS, null);
  assert.ok(m.events.every((e) => e.n === null || Number.isInteger(e.n)));
  assert.ok(
    !JSON.stringify([m.part, m.offset, m.tpx, m.cov, m.dur, m.fromS, m.toS, m.count]).includes("<"),
  );
  for (const part of [
    [2.4, 2, 20],
    ["2", "2", "20"],
    [0, 2, 0],
    [3, 2, 0],
    [1, 2, -5],
    [1, 2],
    null,
    {},
  ]) {
    const r = JSON.parse(JSON.stringify(base));
    r.v2.part = part;
    const p = FV.read(r).part;
    assert.ok(
      p === null || (Number.isInteger(p.k) && Number.isInteger(p.of)),
      JSON.stringify(part),
    );
  }
});

test("trend: comparable captures only, reasons counted, missing values skipped", () => {
  const base = FV.buildRecord(analyse(capture(720, 1280).buf), { ...CTX, frame: { w: 720, h: 1280 } });
  base.v2.view.cls = "s";
  const mk = (i, f) => {
    const r = JSON.parse(JSON.stringify(base));
    r.id = `r${i}`;
    r.ts = base.ts + i * 86400000;
    if (f) f(r);
    return r;
  };
  const recs = [
    mk(0),
    mk(1, (r) => { r.v2.view.cls = "o"; }),
    mk(2, (r) => { r.v2.view.side = "b"; }),
    mk(3, (r) => { r.cap.hand = "left"; }),
    mk(4, (r) => { r.setupId = "other-setup"; }),
    mk(5),
  ];
  const hold = FV.trend(recs, "holdMs");
  assert.equal(hold.points.length, 5);
  assert.equal(hold.excluded, 1);
  assert.deepEqual(hold.why, { "利き手が違う": 1 });
  assert.deepEqual(hold.skipped, ["r3"]);
  assert.equal(hold.points[3].gear, true, "a different setup is marked");
  assert.ok(hold.unc > 0 && hold.range === 0);
  const anc = FV.trend(recs, "ancY");
  assert.equal(anc.points.length, 4);
  assert.deepEqual(anc.why, { "胸側と背中側の違い": 1, "利き手が違う": 1 });
  const ext = FV.trend(recs, "ext");
  assert.equal(ext.points.length, 3);
  assert.deepEqual(ext.why, { "真横でない": 1, "胸側と背中側の違い": 1, "利き手が違う": 1 });
  /* 測れなかった値（null）は数えない。全部が欠けた回は入れない */
  const gap = mk(6, (r) => { r.v2.f[0][0] = null; });
  const none = mk(7, (r) => { for (const row of r.v2.f) row[0] = null; });
  const t = FV.trend([mk(0), gap, none, mk(8)], "holdMs");
  assert.equal(t.points.length, 3);
  assert.equal(t.points[1].n, t.points[0].n - 1);
  assert.deepEqual(t.why, { "値を測れた射が無い": 1 });
  /* いちばん新しい記録の置き方で測れない項目は、推移を出さない */
  const back = FV.trend([mk(0), mk(9, (r) => { r.v2.view.side = "b"; })], "ancY");
  assert.equal(back.refUnmeasured, true);
  assert.equal(back.points.length, 0);
});

test("diagnostics: numbers only, no identifiers, analyser detail and landmarks only when asked", () => {
  const { buf } = capture(720, 1280);
  const result = FA.analyzePacked(buf.pack("right"), { handedness: "right", fps: 30, debug: true });
  const plain = analyse(buf);
  assert.deepEqual(result.shots.map((s) => s.releaseMs), plain.shots.map((s) => s.releaseMs), "debug does not change the count");
  const place = { rows: [{ state: "ok" }, { state: "ok" }, { state: "ok" }, { state: "info" }, { state: "ok" }], tpx: 200, left: 12.4, right: 30.2, rho: 1.18 };
  const rec = FV.buildRecord(result, { ...CTX, note: "private note", frame: { w: 720, h: 1280 }, diag: true, placement: place });
  const dg = rec.v2.dg;
  assert.equal(dg.v, 1);
  assert.equal(dg.s.length, rec.v2.ev.length);
  assert.ok(dg.r.length >= rec.v2.ev.length, "one row per drawn run");
  assert.equal(dg.r[0].length, FV.RUN_COLS.length);
  assert.deepEqual(dg.pl, { st: ["ok", "ok", "ok", "info", "ok"], tpx: 200, l: 12, r: 30, rho: 1180 });
  assert.ok(JSON.stringify(rec).length < 6000, `record with diagnostics ${JSON.stringify(rec).length} bytes`);
  const out = FV.diagnostics([rec], { appVer: 128 });
  assert.equal(out.kind, "archery-note-form-v2-diagnostics");
  assert.equal(out.version, 1);
  assert.deepEqual(out.app, { appVer: 128, geometry: 3, featureVersion: 1 });
  const c = out.captures[0];
  assert.equal(c.capture, 1);
  assert.deepEqual(c.part, [1, 1, 0]);
  assert.deepEqual(c.frame, { w: 720, h: 1280, o: "p" });
  assert.deepEqual(c.counts, { shots: 6, letdowns: 1, candidates: 1, added: 0, removed: 0 });
  assert.equal(c.events.length, 7);
  assert.equal(typeof c.candidates[0][4], "string");
  assert.equal(c.features.length, 6);
  assert.equal(c.noise.length, 13);
  assert.ok(c.view.cls && c.view.side && c.fps > 0 && c.analyzer === FA.VERSION);
  assert.deepEqual(c.analyzerDetail, dg);
  assert.equal(c.landmarks, undefined);
  const text = JSON.stringify(out);
  for (const bad of [CTX.id, CTX.date, String(CTX.ts), "private note", '"id"', '"date"', '"ts"', '"sessionId"', '"setupId"', '"note"', '"ps"', '"pr"', "blob:"])
    assert.ok(!text.includes(bad), `diagnostics must not contain ${bad}`);
  /* 記録に付いていなければ、解析器の中の値は null */
  const bare = FV.buildRecord(plain, { ...CTX, frame: { w: 720, h: 1280 } });
  assert.equal(FV.diagnostics([bare], { appVer: 128 }).captures[0].analyzerDetail, null);
  /* 体の点の列は、渡したときだけ */
  const dump = FV.landmarkDump(buf);
  assert.equal(dump.n, buf.n);
  assert.equal(dump.p[0].length, 27);
  assert.ok(allInts(dump.p) && allInts(dump.t));
  const withLm = FV.diagnostics([rec], { appVer: 128, landmarks: { [rec.id]: dump } });
  assert.equal(withLm.captures[0].landmarks.n, buf.n);
  assert.ok(!JSON.stringify(withLm).includes(`"${CTX.id}"`));
});

test("buffer: the frame nearest a time, for drawing the skeleton over the video", () => {
  const { buf, frames } = capture(720, 1280);
  const f = buf.at(frames[100].tMs + 3);
  assert.equal(f.i, 100);
  assert.equal(f.pose, true);
  assert.equal(f.pts.length, 9);
  assert.ok(Math.abs(f.pts[1][0] - frames[100].landmarks[11].x * 720) < 0.01);
  assert.equal(buf.at(-1e9).i, 0);
  assert.equal(buf.at(1e12).i, buf.n - 1);
  assert.equal(buf.frameAt(buf.n), null);
  assert.equal(FV.makeBuffer().at(0), null);
});

if (liveBench) {
  console.log(
    `  live count on the benchmark streams: ${liveBench.sessions} sessions, live > final in ${liveBench.over}, live = final in ${liveBench.equal}, live < final in ${liveBench.under} (live ${liveBench.liveShots} shots, final ${liveBench.finalShots})`,
  );
}
console.log(`Form record v2 checks OK (${results.length} tests)`);
