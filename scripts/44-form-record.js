"use strict";
/* 射型の記録 v2 — 記録の形、撮影中のバッファ、置き方の確認、射どうしの比較（どれも純関数）。
   設計: docs/design/form-v2/design.md（5 章 = 記録、2.3 = 置き方、4 章 = 構成、11 章 = 実装の覚え書き）。
   解析そのものは 44-form-analyze.js（FormAnalyze）。ここは、その結果を保存する形にし、保存した形から画面の値を作る。
   DOM・db・時計・乱数を使わない。グローバルは FormV2 の 1 つだけ。Node からは tools/form-record-loader.js で読む。

   記録（db.formAnalyses の 1 件。追加のフィールドだけ。SCHEMA_VER は変えない）:
     { id, date, ts, sessionId, setupId, shots, modelVer, appVer, fps, features: [], note?,
       cap: { g: 3, fw, fh, mw, mh, o, crop: 0, facing, hand, src },
       v2: { av, fv, dur, cov, tpx, view: { side, cls, rho, om }, ld, ev, cd, f, nz, nd, ps, pr, ed, w } }
     ev = [[kind, 離れ, 保持, 引き, 確かさ, 印], …]   kind 0 = 射、1 = 引き戻し。時刻と長さは 0.01 秒、確かさは 0〜10。
          印はビット: 2 = 引き戻しを利用者が射に数えた、4 = 利用者が射から外した、8 = その回の型から遠い
     cd = [[時刻, 始め, 終わり, 幅, 理由, 射らしい, 足した], …]   離れがはっきり写らなかった候補。足した = 1 なら射に数える
     f  = [[13 個の整数], …]   ev の kind 0 の行と同じ順。列は COLS。時間 0.01 秒、位置 0.001 胴、角度 0.1°。欠けは null
     nz・nd = 列ごとの測定のゆれ（f と同じ単位）と自由度。ps・pr = 射ごとの姿（9 点 × 2、0.01 胴）
     ed = [足した数, 外した数]。w = 解析器の warnings */
const FormV2 = (() => {
  const FV = 1; // 項目の列の版（COLS を変えたら上げる）
  const GEOM = 3; // 測り方の版（正方形の画素・体の単位）。1 = 補正なし、2 = 段 A
  const TORSO_PER_HEIGHT = 0.288; // 胴の長さ / 身長（algorithm.md 5.6。Drillis & Contini 1966）
  const LIMITS = Object.freeze({
    MAX_MS: 30 * 60 * 1000, // 撮影の上限
    WARN_MS: 29 * 60 * 1000, // 上限の 1 分前に知らせる
    MAX_FRAMES: 30 * 60 * 60, // 60fps で 30 分ぶん（約 12.6MB）
    MAX_SHOTS: 36, // 1 記録の射の上限（約 9KB）
    VIDEO_MS: 10 * 60 * 1000, // 動画を残す上限
    LIVE_WINDOW_MS: 20000, // 撮影中の射数の目安: 直近のこの長さを
    LIVE_EVERY_MS: 2000, // この間隔で解析する
    LIVE_SETTLE_MS: 600, // 離れからこの時間たってから数える
    LIVE_SAME_MS: 1200, // これ以内の離れは同じ射とみなす
  });
  const COLS = Object.freeze(["holdMs", "drawMs", "followMs", "bowDy", "relBack", "ancY", "ext", "elbAng", "shTilt", "headX", "headY", "lean", "creep"]);
  /* kind: t = 時間、h = 高さ、p = 面内。unit: s = 秒（保存は 0.01 秒）、b = 胴（0.001）、d = 度（0.1）。
     flip = 画面では符号を反対にして出す（下がり・鼻より下を正の数で書くため）。dp = 画面の小数の桁 */
  const META = Object.freeze({
    holdMs: { name: "保持の時間", kind: "t", unit: "s", dp: 1 },
    drawMs: { name: "引きの時間", kind: "t", unit: "s", dp: 1 },
    followMs: { name: "弓手を上げていた時間", kind: "t", unit: "s", dp: 1 },
    bowDy: { name: "弓手の下がり", kind: "h", unit: "b", dp: 0, flip: true },
    relBack: { name: "離れの後ろへの動き", kind: "p", unit: "b", dp: 0 },
    ancY: { name: "アンカーの高さ（鼻より下）", kind: "h", unit: "b", dp: 1, flip: true },
    ext: { name: "引き尺の目安", kind: "p", unit: "b", dp: 1, rel: true },
    elbAng: { name: "引き手の肘の高さ", kind: "p", unit: "d", dp: 1 },
    shTilt: { name: "弓手の肩の上がり", kind: "p", unit: "d", dp: 1 },
    headX: { name: "頭の位置（前後）", kind: "p", unit: "b", dp: 1 },
    headY: { name: "頭の位置（高さ）", kind: "h", unit: "b", dp: 1 },
    lean: { name: "上体の傾き", kind: "p", unit: "d", dp: 1 },
    creep: { name: "保持の終わりの引き尺の変化", kind: "p", unit: "b", dp: 1 },
  });
  const SCALE = { s: 0.1, b: 1000, d: 10 }; // 解析器の値（ms・胴・度）× SCALE = 保存する整数
  const REASONS = ["", "weakRelease", "noRelease", "unobserved", "bodyMoved", "short", "tooSoon"];
  const fin = Number.isFinite;
  const SLOTS = [0, 11, 12, 13, 14, 15, 16, 23, 24]; // 鼻、肩 左右、肘 左右、手首 左右、腰 左右
  const ROLE_SLOT = {
    right: { nose: 0, bSh: 1, dSh: 2, bEl: 3, dEl: 4, bWr: 5, dWr: 6, bHip: 7, dHip: 8 },
    left: { nose: 0, bSh: 2, dSh: 1, bEl: 4, dEl: 3, bWr: 6, dWr: 5, bHip: 8, dHip: 7 },
  };
  const ROLES = ["nose", "bSh", "dSh", "bEl", "dEl", "bWr", "dWr", "bHip", "dHip"];

  const median = (a) => {
    const v = a.filter(fin).sort((x, y) => x - y), m = v.length >> 1;
    return !v.length ? NaN : v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  const quantile = (a, q) => {
    const v = a.filter(fin).sort((x, y) => x - y);
    if (!v.length) return NaN;
    const p = (v.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
    return v[lo] + (v[hi] - v[lo]) * (p - lo);
  };
  const sd = (a) => {
    const v = a.filter(fin);
    if (v.length < 2) return NaN;
    const m = v.reduce((s, x) => s + x, 0) / v.length;
    return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (v.length - 1));
  };
  const toInt = (v, k) => (fin(v) ? Math.round(v * k) + 0 : null);

  /* ---------- 撮影中のバッファ（design.md 4 章、algorithm.md 10.1） ----------
     1 コマ = 9 点 ×（x, y, visibility）の Float32 と、時刻の Float64。4,096 コマずつ足していく。
     x, y は正方形の画素（正規化座標 × 画面の大きさ）。点を使う条件は FormAnalyze.packFrames と同じ。
     pack() は FormAnalyze.analyzePacked がそのまま読める形を返す。保存はしない */
  function makeBuffer(opts) {
    const CH = 4096, PER = 27, vMin = (opts && opts.vMin) || 0.3, maxFrames = (opts && opts.maxFrames) || LIMITS.MAX_FRAMES;
    const ts = [], ds = [], ps = [];
    let n = 0, nPose = 0, last = -Infinity, first = NaN, fw = 0, fh = 0, mixed = false;
    function push(tMs, lms, w, h) {
      if (!fin(tMs) || !(tMs > last) || n >= maxFrames) return false;
      const c = n >> 12, i = n & 4095;
      if (c === ts.length) { ts.push(new Float64Array(CH)); ds.push(new Float32Array(CH * PER).fill(NaN)); ps.push(new Uint8Array(CH)); }
      ts[c][i] = tMs;
      if (Array.isArray(lms) && w > 0 && h > 0) {
        const d = ds[c], o = i * PER;
        ps[c][i] = 1;
        nPose++;
        for (let s = 0; s < 9; s++) {
          const p = lms[SLOTS[s]];
          if (!p || !fin(p.x) || !fin(p.y)) continue;
          const vis = p.visibility === undefined || p.visibility === null ? 1 : p.visibility;
          d[o + s * 3 + 2] = vis;
          if (vis >= vMin && p.x > -0.2 && p.x < 1.2 && p.y > -0.2 && p.y < 1.2) { d[o + s * 3] = p.x * w; d[o + s * 3 + 1] = p.y * h; }
        }
        if (!fw) { fw = w; fh = h; } else if (fw !== w || fh !== h) mixed = true;
      }
      if (!fin(first)) first = tMs;
      last = tMs;
      n++;
      return true;
    }
    const timeAt = (i) => ts[i >> 12][i & 4095];
    /* fromMs 以降のコマを、解析器の入力の形にする（省けば全体） */
    function pack(handedness, fromMs) {
      let a = 0;
      if (fin(fromMs) && n) {
        let lo = 0, hi = n; // 最初に timeAt(i) >= fromMs になる i
        while (lo < hi) { const m = (lo + hi) >> 1; if (timeAt(m) < fromMs) lo = m + 1; else hi = m; }
        a = lo;
      }
      const m = n - a, t = new Float64Array(m), pose = new Uint8Array(m), pts = {}, map = ROLE_SLOT[handedness === "left" ? "left" : "right"];
      for (const r of ROLES) pts[r] = { x: new Float64Array(m), y: new Float64Array(m), v: new Float64Array(m) };
      let cnt = 0;
      for (let k = 0; k < m; k++) {
        const g = a + k, c = g >> 12, i = g & 4095, d = ds[c], o = i * PER;
        t[k] = ts[c][i];
        pose[k] = ps[c][i];
        cnt += pose[k];
        for (const r of ROLES) { const q = o + map[r] * 3, p = pts[r]; p.x[k] = d[q]; p.y[k] = d[q + 1]; p.v[k] = d[q + 2]; }
      }
      return { n: m, t, pose, pts, coverage: m ? cnt / m : 0 };
    }
    return {
      push, pack,
      get n() { return n; },
      get full() { return n >= maxFrames; },
      get firstMs() { return first; },
      get lastMs() { return last; },
      get durationMs() { return n ? last - first : 0; },
      get coverage() { return n ? nPose / n : 0; },
      get frame() { return { w: fw, h: fh, mixed }; },
      bytes: () => ts.length * CH * (8 + PER * 4 + 1),
    };
  }

  /* 撮影中の射数の目安（design.md 2.4）。同じ解析器を直近 LIVE_WINDOW_MS にかけ、まだ数えていない離れを足す。
     2 つめの状態機械は持たない。数は目安で、終わってから全体を解析した数が記録になる */
  function makeLiveCounter(analyzer) {
    const seen = [];
    let lastRun = -Infinity;
    return {
      due: (nowMs) => nowMs - lastRun >= LIMITS.LIVE_EVERY_MS,
      update(buffer, handedness, fps) {
        const now = buffer.lastMs;
        lastRun = now;
        const r = analyzer.analyzePacked(buffer.pack(handedness, now - LIMITS.LIVE_WINDOW_MS), { handedness, fps });
        let added = 0;
        for (const s of r.shots) {
          if (now - s.releaseMs < LIMITS.LIVE_SETTLE_MS) continue;
          if (seen.some((e) => Math.abs(e.t - s.releaseMs) < LIMITS.LIVE_SAME_MS)) continue;
          seen.push({ t: s.releaseMs, kind: s.kind });
          if (s.kind === "shot") added++;
        }
        return { shots: seen.filter((e) => e.kind === "shot").length, letdowns: seen.filter((e) => e.kind === "letdown").length, added };
      },
      get shots() { return seen.filter((e) => e.kind === "shot").length; },
      get letdowns() { return seen.filter((e) => e.kind === "letdown").length; },
    };
  }

  /* ---------- 置き方の確認（design.md 2.3）: いまの 1 コマから 5 行を作る ----------
     state: ok = 通過、warn = 注意、info = 案内（通る・通らないを付けない）、wait = まだ分からない。
     mem は呼ぶ側が持ち回る覚え（弓を上げた形で確かめた余白と向き）。書き換える */
  function placement(lms, frame, handedness, fps, mem) {
    const m = mem || {}, w = frame && frame.w > 0 ? frame.w : 0, h = frame && frame.h > 0 ? frame.h : 0;
    const map = handedness === "left" ? { bSh: 12, dSh: 11, bEl: 14, dEl: 13, bWr: 16, dWr: 15, bHip: 24, dHip: 23 } : { bSh: 11, dSh: 12, bEl: 13, dEl: 14, bWr: 15, dWr: 16, bHip: 23, dHip: 24 };
    const pt = (k) => {
      const p = Array.isArray(lms) ? lms[map[k]] : null;
      if (!p || !fin(p.x) || !fin(p.y) || !w) return null;
      return { x: p.x * w, y: p.y * h, v: p.visibility === undefined || p.visibility === null ? 1 : p.visibility };
    };
    const keys = ["bSh", "dSh", "bEl", "dEl", "bWr", "dWr", "bHip", "dHip"], P = {};
    let seen = 0;
    for (const k of keys) { P[k] = pt(k); if (P[k] && P[k].v >= 0.5) seen++; }
    const rows = [];
    const body = P.bSh && P.dSh && P.bHip && P.dHip;
    rows.push(seen === 8
      ? { k: "写り", state: "ok", text: "肩・肘・手首・腰の 8 点が取れています" }
      : { k: "写り", state: "warn", text: body ? `8 点のうち ${seen} 点が取れています。上半身と両腕が入る向きにしてください` : "体が写っていません。上半身と両腕が入る向きにしてください" });
    let T = NaN, mx = NaN;
    if (body) {
      mx = (P.bSh.x + P.dSh.x) / 2;
      T = Math.hypot(mx - (P.bHip.x + P.dHip.x) / 2, (P.bSh.y + P.dSh.y) / 2 - (P.bHip.y + P.dHip.y) / 2);
    }
    const tpx = fin(T) ? Math.round(T) : null;
    rows.push(!fin(T)
      ? { k: "大きさ", state: "wait", text: "体が写ると測れます" }
      : T >= 140
        ? { k: "大きさ", state: "ok", text: `胴の長さ ${tpx}px` }
        : { k: "大きさ", state: "warn", text: `小さく写っています（胴 ${tpx}px）。1 歩ぶん近づけてください` });
    /* 弓を上げた形: 弓手の手首が肩の高さの近くにあり、肩から胴の 0.6 以上、横へ出ている */
    const raised = !!(fin(T) && P.bWr && P.bWr.v >= 0.5 && (P.bSh.y - P.bWr.y) / T >= -0.45 && Math.abs(P.bWr.x - P.bSh.x) / T >= 0.6);
    if (raised) {
      const xs = keys.slice(0, 6).map((k) => P[k]).filter(Boolean).map((p) => p.x);
      const l = (Math.min(...xs) / w) * 100, r = ((w - Math.max(...xs)) / w) * 100;
      m.left = fin(m.left) ? Math.min(m.left, l) : l;
      m.right = fin(m.right) ? Math.min(m.right, r) : r;
      m.dir = P.bWr.x >= mx ? 1 : -1;
      const rho = Math.hypot(P.bWr.x - P.bSh.x, P.bWr.y - P.bSh.y) / T;
      m.rho = fin(m.rho) ? Math.max(m.rho, rho) : rho;
    }
    const pc = (v) => `${Math.max(0, Math.round(v))}%`;
    if (fin(m.left)) {
      const ok = m.left >= 6 && m.right >= 6;
      rows.push({ k: "余白", state: ok ? "ok" : "warn", text: ok ? `左 ${pc(m.left)}・右 ${pc(m.right)}（弓を上げた形で確かめました）` : `腕が枠の外に出ます（左 ${pc(m.left)}・右 ${pc(m.right)}）。少し離すか、向きを変えてください` });
    } else if (fin(T)) {
      const l = ((mx - 1.6 * T) / w) * 100, r = ((w - mx - 1.6 * T) / w) * 100, ok = l >= 6 && r >= 6;
      rows.push({ k: "余白", state: ok ? "wait" : "warn", text: ok ? `左 ${pc(l)}・右 ${pc(r)} の見込み。弓を上げる形をすると確かめられます` : `腕が枠の外に出る見込みです（左 ${pc(l)}・右 ${pc(r)}）。少し離すか、向きを変えてください` });
    } else rows.push({ k: "余白", state: "wait", text: "体が写ると測れます" });
    if (fin(m.rho) && m.dir) {
      const chest = (handedness === "left" ? -1 : 1) * m.dir > 0, ratio = m.rho / 1.15;
      const ang = ratio >= 0.94 ? "真横に近い" : ratio >= 0.77 ? "やや斜め" : "斜め";
      rows.push({ k: "向き", state: "info", text: !chest
        ? `${ang}・背中側です。引き手が頭に隠れるので、胸側を勧めます`
        : ratio >= 0.94 ? `${ang}・胸側。すべての項目を測れます` : ratio >= 0.77 ? `${ang}・胸側。面内の項目は、この回の中だけで比べます` : `${ang}・胸側。時間と高さの項目を測ります` });
    } else rows.push({ k: "向き", state: "wait", text: "弓を上げる形をすると分かります" });
    rows.push(!(fps > 0)
      ? { k: "速さ", state: "wait", text: "測っています" }
      : fps >= 24
        ? { k: "速さ", state: "ok", text: `毎秒 ${Math.round(fps)} コマ` }
        : fps >= 15
          ? { k: "速さ", state: "warn", text: `毎秒 ${Math.round(fps)} コマ。離れの時刻が少し粗くなります` }
          : { k: "速さ", state: "warn", text: `解析が遅れています（毎秒 ${Math.round(fps)} コマ）。時刻が粗くなります` });
    return { rows, raised, tpx, seen };
  }

  /* 撮影中の状態の 1 行（design.md 2.4）。注意のときだけ warn */
  function captureState(lms, fps, noPoseMs) {
    if (!Array.isArray(lms)) {
      return noPoseMs >= 2000 ? { warn: true, text: "体が写っていません。枠の中に入ると、続きを測ります。" } : { warn: false, text: "体を探しています。" };
    }
    const cut = [13, 14, 15, 16].some((i) => { const p = lms[i]; return p && fin(p.x) && (p.x < 0.01 || p.x > 0.99 || p.y < 0.01 || p.y > 0.99); });
    if (cut) return { warn: true, text: "腕が枠の端にかかっています。台を少し離すと、次の射から測れます。" };
    if (fps > 0 && fps < 15) return { warn: true, text: `解析が毎秒 ${Math.round(fps)} コマです。射は数えられますが、時刻は粗くなります。` };
    return { warn: false, text: `体は枠の中です。${fps > 0 ? `毎秒 ${Math.round(fps)} コマ。` : ""}` };
  }

  /* ---------- 記録の組み立て（design.md 5.1） ----------
     result = FormAnalyze.analyzePacked の戻り値。ctx = { id, date, ts, sessionId, setupId, appVer, modelVer, frame: { w, h }, facing, hand, src, note }。
 */
  function captureNoise(result) {
    const q = result.quality || {}, nz = q.noise || {}, df = q.noiseDf || {}, real = result.shots.filter((s) => s.kind === "shot");
    const unc = median(real.map((s) => s.releaseUncMs)), u = fin(unc) ? unc : 0, rho = q.view && fin(q.view.rho) ? q.view.rho : NaN;
    const noise = {}, nd = {};
    for (const k of COLS) { noise[k] = fin(nz[k]) ? nz[k] : null; nd[k] = fin(df[k]) ? df[k] : 0; }
    /* 時間: 離れの時刻の不確かさと、アンカーの定義のあいまいさ ±100ms（algorithm.md 5.3）。自由度は見積もりでないので 60 と置く */
    if (real.length) {
      noise.holdMs = Math.hypot(100, u); nd.holdMs = 60;
      noise.drawMs = Math.hypot(100, 100); nd.drawMs = 60;
      noise.followMs = Math.hypot(50, u); nd.followMs = 60;
    }
    /* 離れのあとの項目は「離れのあとの窓 − 保持の窓」の差なので、保持の窓のゆれの √2 倍と置く（仮の見積もり。design.md 11 章）:
       引き手は引き尺のゆれ、弓手の手首の高さは 弓手の腕の仰角のゆれ × 腕の長さ */
    if (fin(nz.ext)) { noise.relBack = Math.SQRT2 * nz.ext; nd.relBack = df.ext || 0; noise.creep = Math.SQRT2 * nz.ext; nd.creep = df.ext || 0; }
    if (fin(nz.bowElev) && fin(rho)) { noise.bowDy = Math.SQRT2 * ((nz.bowElev * Math.PI) / 180) * rho; nd.bowDy = df.bowElev || 0; }
    return { noise, nd };
  }
  function buildRecord(result, ctx) {
    const q = result.quality || {}, c = ctx || {};
    const ev = [], f = [], ps = [], pr = [];
    let ld = 0, dropped = 0;
    for (const s of result.shots) {
      const shot = s.kind === "shot";
      if (shot && f.length >= LIMITS.MAX_SHOTS) { dropped++; continue; }
      if (!shot) ld++;
      ev.push([shot ? 0 : 1, toInt(s.releaseMs, 0.1), toInt(s.holdMs, 0.1), toInt(s.drawMs, 0.1), shot ? Math.round((fin(s.confidence) ? s.confidence : 0.5) * 10) : 8, shot && s.typicality >= 1 ? 8 : 0]);
      if (shot) {
        f.push(COLS.map((k) => toInt(s.features ? s.features[k] : null, SCALE[META[k].unit])));
        ps.push(Array.isArray(s.poseHold) ? s.poseHold.slice() : null);
        pr.push(Array.isArray(s.poseRel) ? s.poseRel.slice() : null);
      }
    }
    const cd = (result.candidates || []).map((x) => [toInt(x.tMs, 0.1), toInt(x.fromMs, 0.1), toInt(x.toMs, 0.1), toInt(x.uncMs, 0.1), Math.max(0, REASONS.indexOf(x.reason)), x.likely ? 1 : 0, 0]);
    const { noise, nd } = captureNoise(result);
    const fw = c.frame && c.frame.w > 0 ? Math.round(c.frame.w) : null, fh = c.frame && c.frame.h > 0 ? Math.round(c.frame.h) : null;
    const view = q.view || {};
    const rec = {
      id: c.id, date: c.date, ts: c.ts, sessionId: c.sessionId || null, setupId: c.setupId || null,
      shots: f.length,
      modelVer: c.modelVer || "", appVer: c.appVer, fps: fin(q.fps) ? +q.fps.toFixed(1) : null,
      features: [], // v2 を知らない版のアプリが読んでも落ちないように置く（0 射の記録として一覧に出る）
      cap: { g: GEOM, fw, fh, mw: fw, mh: fh, o: fw && fh ? (fw > fh ? "l" : fw < fh ? "p" : "s") : null, crop: 0, facing: c.facing || null, hand: c.hand === "left" ? "left" : "right", src: c.src === "replay" ? "replay" : "live" },
      v2: {
        av: fin(q.version) ? q.version : 1, fv: FV,
        dur: fin(q.durationMs) ? Math.round(q.durationMs / 1000) : 0,
        cov: fin(q.coverage) ? Math.round(q.coverage * 100) : 0,
        tpx: fin(q.scalePx) ? Math.round(q.scalePx) : null,
        view: { side: view.side || null, cls: view.cls || null, rho: toInt(view.rho, 1000), om: toInt(view.omega, 1000) },
        ld, ev, cd, f,
        nz: COLS.map((k) => toInt(noise[k], SCALE[META[k].unit])),
        nd: COLS.map((k) => Math.min(999, Math.round(nd[k] || 0))),
        ps, pr,
        ed: [0, 0],
        w: Array.isArray(q.warnings) ? q.warnings.slice() : [],
      },
    };
    if (c.note) rec.note = c.note;
    if (dropped) rec.v2.over = dropped; // 上限を超えて入れなかった射の数
    return rec;
  }
  /* 射数を直す（design.md 2.8）。src = "ev" | "cd"、i = その配列の中の番号、on = 射に数えるかどうか。
     もとの記録は書き換えず、直した写しを返す。数（shots・ld）と、足した・外した数（ed）も合わせ直す。
     値（f・ps・pr）は消さない。外した射は比較から外れるだけで、あとで戻せる */
  function setCounted(rec, src, i, on) {
    const out = JSON.parse(JSON.stringify(rec)), v = out.v2;
    if (src === "cd") { if (v.cd[i]) v.cd[i][6] = on ? 1 : 0; } else if (v.ev[i]) {
      const r = v.ev[i];
      r[5] = r[0] === 0 ? (on ? r[5] & ~4 : r[5] | 4) : on ? r[5] | 2 : r[5] & ~2;
    }
    let shots = 0, added = 0, removed = 0, ld = 0;
    for (const r of v.ev) {
      if (r[0] === 0) { if (r[5] & 4) removed++; else shots++; } else if (r[5] & 2) added++; else ld++;
    }
    for (const r of v.cd || []) if (r[6]) added++;
    out.shots = shots + added;
    v.ld = ld;
    v.ed = [added, removed];
    return out;
  }

  /* ---------- 記録の読み分け（design.md 5.2） ---------- */
  const isV2 = (r) => !!(r && r.v2 && typeof r.v2 === "object" && Array.isArray(r.v2.ev) && r.cap && r.cap.g === GEOM);
  const natural = (int, k) => (fin(int) ? int / SCALE[META[k].unit] : null);

  /* 保存した記録 → 画面用の形。画面はこれだけから描く（保存の前後で表示が変わらない）。
     events = 時刻順の全部の区間。n = 射の番号（数えているものだけ）。vals = 解析器の単位（ms・胴・度）の値 */
  function read(rec) {
    const v = rec.v2, events = [];
    let fi = 0;
    (v.ev || []).forEach((r, i) => {
      const shot = r[0] === 0, flags = r[5] || 0;
      const e = { src: "ev", i, kind: shot ? "shot" : "letdown", tS: r[1] / 100, holdS: fin(r[2]) ? r[2] / 100 : null, drawS: fin(r[3]) ? r[3] / 100 : null, conf: r[4], flags, counted: shot ? !(flags & 4) : !!(flags & 2), fi: -1 };
      if (shot) {
        e.fi = fi;
        const row = (v.f || [])[fi] || [];
        e.vals = {};
        COLS.forEach((k, c) => { e.vals[k] = natural(row[c], k); });
        e.ps = (v.ps || [])[fi] || null;
        e.pr = (v.pr || [])[fi] || null;
        fi++;
      }
      events.push(e);
    });
    (v.cd || []).forEach((r, i) => {
      events.push({ src: "cd", i, kind: "cand", tS: r[0] / 100, fromS: fin(r[1]) ? r[1] / 100 : null, toS: fin(r[2]) ? r[2] / 100 : null, uncS: fin(r[3]) ? r[3] / 100 : null, reason: REASONS[r[4]] || "", likely: !!r[5], counted: !!r[6], flags: 0, fi: -1 });
    });
    events.sort((a, b) => a.tS - b.tS);
    let n = 0;
    for (const e of events) e.n = e.counted ? ++n : null;
    const noise = {}, df = {};
    COLS.forEach((k, c) => { noise[k] = natural((v.nz || [])[c], k); df[k] = (v.nd || [])[c] || 0; });
    const compared = events.filter((e) => e.kind === "shot" && e.counted);
    return {
      rec, v, events, count: n, compared, noise, df,
      letdowns: events.filter((e) => e.kind === "letdown" && !e.counted).length,
      openCands: events.filter((e) => e.kind === "cand" && !e.counted).length,
      added: events.filter((e) => e.counted && e.kind !== "shot").length,
      removed: events.filter((e) => e.kind === "shot" && !e.counted).length,
    };
  }

  /* この記録で見せてよい項目（algorithm.md 8 章）: 斜めすぎは面内を出さない、背中側はアンカーを出さない */
  function keysFor(rec, keys) {
    const view = (rec.v2 && rec.v2.view) || {};
    return (keys || COLS).filter((k) => {
      const m = META[k];
      if (!m) return false;
      if (m.kind === "p" && view.cls !== "s" && view.cls !== "o") return false;
      if (k === "ancY" && view.side === "b") return false;
      return true;
    });
  }

  /* F 分布の上側 5% を超えたかどうか（Paulson の正規近似）。超えなければ「ばらつきは測定のゆれと区別できない」 */
  function exceedsF95(ratio, d1, d2) {
    if (!(ratio > 0) || !(d1 > 0) || !(d2 > 0)) return false;
    const a = 2 / (9 * d1), b = 2 / (9 * d2), c = Math.cbrt(ratio);
    return ((1 - b) * c - (1 - a)) / Math.sqrt(a + c * c * b) > 1.6449;
  }
  /* 標準偏差の 95% 区間の倍率（χ²、Wilson–Hilferty。grouping-stats-v3.md と同じ式） */
  function sdInterval(n) {
    const nu = n - 1;
    if (!(nu >= 1)) return null;
    const chi = (z) => nu * Math.pow(1 - 2 / (9 * nu) + z * Math.sqrt(2 / (9 * nu)), 3);
    const hi = chi(-1.96);
    return { lo: Math.sqrt(nu / chi(1.96)), hi: hi > 0 ? Math.sqrt(nu / hi) : Infinity };
  }

  /* 射どうしの比較（algorithm.md 5.4）。FormAnalyze.compareShots に、保存した値とゆれを渡す。
     戻り値の値は解析器の単位。flags[].n = 射の番号、others = ほかの射の値 */
  function compare(model, analyzer, keys) {
    const ks = keysFor(model.rec, keys), rows = model.compared, n = rows.length;
    const out = { n, keys: ks, feat: {}, flags: [] };
    for (const k of ks) {
      const vals = rows.map((e) => e.vals[k]), ok = vals.filter(fin);
      out.feat[k] = { median: median(ok), spread: sd(ok), noise: model.noise[k], limit: null, vals, missing: vals.length - ok.length, indistinct: null };
    }
    if (n < 4 || !analyzer) return out;
    const pseudo = { shots: rows.map((e) => ({ kind: "shot", features: e.vals })), quality: { noise: model.noise, noiseDf: model.df } };
    const cmp = analyzer.compareShots(pseudo, { keys: ks });
    for (const k of ks) {
      const c = cmp.features[k], ft = out.feat[k];
      if (!c) continue;
      ft.limit = c.limit;
      ft.indistinct = !exceedsF95((c.spread * c.spread) / (c.noise * c.noise), n - 1, Math.min(model.df[k], 60));
    }
    for (const fl of cmp.flags) {
      const e = rows[fl.shot];
      out.flags.push({ n: e.n, row: fl.shot, key: fl.key, delta: fl.delta, value: e.vals[fl.key], others: rows.filter((_, j) => j !== fl.shot).map((x) => x.vals[fl.key]) });
    }
    out.flags.sort((a, b) => a.n - b.n || ks.indexOf(a.key) - ks.indexOf(b.key));
    return out;
  }

  /* ---------- 画面の文字 ---------- */
  const minus = (s) => String(s).replace("-", "−");
  /* 解析器の単位の値 → 画面の数（秒・胴の %・度）。ext は「この回の中央値を 100%」 */
  function shown(key, v, ref) {
    const m = META[key];
    if (!fin(v)) return null;
    if (m.unit === "s") return v / 1000;
    if (m.unit === "d") return v;
    if (m.rel) return ref > 0 ? (v / ref) * 100 : v * 100;
    return v * 100 * (m.flip ? -1 : 1);
  }
  /* 幅や差（符号を返さない量）を画面の単位にする */
  function shownSize(key, v, ref) {
    const m = META[key];
    if (!fin(v)) return null;
    if (m.unit === "s") return v / 1000;
    if (m.unit === "d") return v;
    return m.rel && ref > 0 ? (v / ref) * 100 : v * 100;
  }
  const unitText = (key) => (META[key].unit === "s" ? " 秒" : META[key].unit === "d" ? "°" : "%");
  function fmt(key, x, opts) {
    if (!fin(x)) return "—";
    const m = META[key], o = opts || {}, dp = o.dp === undefined ? m.dp : o.dp;
    let r = Math.abs(x) < 0.5 * Math.pow(10, -dp) ? 0 : x; // −0.0 を出さない
    r = r.toFixed(dp);
    return minus((o.sign && +r > 0 ? "+" : "") + r) + (o.bare ? "" : unitText(key));
  }
  /* 胴の % → cm の目安。身長（cm）が設定されているときだけ（algorithm.md 5.6）。無ければ空の文字 */
  function cmText(key, pct, heightCm) {
    const m = META[key];
    if (m.unit !== "b" || m.rel || !fin(pct) || !(heightCm >= 100 && heightCm <= 230)) return "";
    const cm = (Math.abs(pct) / 100) * TORSO_PER_HEIGHT * heightCm;
    return `約 ${cm < 10 ? +cm.toFixed(1) : Math.round(cm)}cm`;
  }
  const body = (key) => (META[key].unit === "b" && !META[key].rel ? "胴の " : "");
  /* 1 件の違いを 1 文にする（事実 → ほかの射の幅）。ref = ext の基準（この回の中央値） */
  function flagSentence(flag, cmp, heightCm) {
    const k = flag.key, ref = cmp.feat[k] ? cmp.feat[k].median : NaN, x = shown(k, flag.value, ref);
    const o = flag.others.map((v) => shown(k, v, ref)).filter(fin), lo = Math.min(...o), hi = Math.max(...o);
    const sp = (t) => (/[%°]$/.test(t) ? `${t} ` : t); // 「26% でした」「5.4 秒でした」
    const cm = cmText(k, x, heightCm), val = sp(`${body(k)}${fmt(k, x)}${cm ? `（${cm}）` : ""}`);
    const rest = `ほかの ${o.length} 射は ${body(k)}${fmt(k, lo, { bare: true })}〜${sp(fmt(k, hi))}です。`;
    const head = `${flag.n} 射目は、`;
    if (k === "holdMs") return `${head}保持が ${val}でした。${rest}`;
    if (k === "drawMs") return `${head}引きが ${val}でした。${rest}`;
    if (k === "followMs") return `${head}離れのあと ${val}で弓手が下がりました。${rest}`;
    if (k === "bowDy") return `${head}離れの 0.3 秒あとの弓手の下がりが ${val}でした。${rest}`;
    if (k === "relBack") return `${head}離れで引き手が後ろへ動いた量が ${val}でした。${rest}`;
    return `${head}${META[k].name}が ${val}でした。${rest}`;
  }
  /* 結果の 1 文（design.md 2.6）。text と、違った射の番号（無ければ null） */
  function summary(model, cmp, heightCm) {
    if (!model.count) return { text: "射として数えた区間はありません。", n: null };
    if (cmp.n < 4) return { text: `比べるには、値を測れた射が 4 射以上要ります。この回は ${cmp.n} 射でした。`, n: null };
    if (!cmp.flags.length) return { text: `${cmp.n} 射のあいだに、測定のゆれより大きい違いは見つかりませんでした。`, n: null };
    return { text: flagSentence(cmp.flags[0], cmp, heightCm), n: cmp.flags[0].n };
  }

  /* ---------- 比べてよい回（design.md 5.4） ---------- */
  function comparable(a, b, key) {
    const m = META[key];
    if (!m || !isV2(a) || !isV2(b)) return { ok: false, why: "測り方が違う" };
    const va = a.v2, vb = b.v2;
    if (va.av !== vb.av || a.cap.hand !== b.cap.hand) return { ok: false, why: va.av !== vb.av ? "解析の版が違う" : "利き手が違う" };
    for (const v of [va, vb]) if (!(v.tpx >= 100) || !(v.cov >= 80)) return { ok: false, why: "写りが足りない" };
    if (m.kind === "t") return { ok: true, why: "" };
    if (!va.view || !vb.view || va.view.side !== vb.view.side) return { ok: false, why: "胸側と背中側" };
    if (m.kind === "h") return va.view.cls && vb.view.cls && va.view.cls !== "x" && vb.view.cls !== "x" ? { ok: true, why: "" } : { ok: false, why: "斜めすぎ" };
    if (va.view.cls !== "s" || vb.view.cls !== "s") return { ok: false, why: "真横でない" };
    return va.view.rho > 0 && Math.abs(vb.view.rho / va.view.rho - 1) <= 0.06 ? { ok: true, why: "" } : { ok: false, why: "置き方が違う" };
  }
  /* 推移: いちばん新しい記録と比べてよい回だけ。1 回 = 中央値と四分位 */
  function trend(records, key) {
    const v2 = records.filter(isV2).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    if (!v2.length) return { points: [], excluded: 0 };
    const ref = v2[v2.length - 1], points = [];
    let excluded = 0;
    for (const r of v2) {
      const vals = read(r).compared.map((e) => e.vals[key]).filter(fin);
      if (!comparable(ref, r, key).ok || !keysFor(r, [key]).length || !vals.length) { excluded++; continue; }
      points.push({ id: r.id, date: r.date, ts: r.ts, n: vals.length, med: median(vals), q1: quantile(vals, 0.25), q3: quantile(vals, 0.75) });
    }
    return { points, excluded };
  }

  return {
    FV, GEOM, TORSO_PER_HEIGHT, LIMITS, COLS, META, REASONS,
    makeBuffer, makeLiveCounter, placement, captureState, captureNoise, buildRecord, setCounted, isV2, read, keysFor, compare, exceedsF95, sdInterval,
    shown, shownSize, unitText, fmt, cmText, flagSentence, summary, comparable, trend, median, quantile, sd,
  };
})();
