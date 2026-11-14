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
     ed = [足した数, 外した数]。w = 解析器の warnings
     36 射を超えた撮影は、36 射以下の記録に等分する（どの射も捨てない）。分けた記録だけが持つもの:
       cid = その撮影の id（最初の記録の id）、part = [何番目, 全部でいくつ, それより前の記録の射数]、span = [始め, 終わり]（0.01 秒）
     dg = 検証用の診断（設定「検証用の診断データ」が入のときだけ付ける。解析器の中の値。diagBlock を参照） */
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
    LIVE_EVERY_MS: 1000, // この間隔で解析する
    LIVE_SETTLE_MS: 600, // 離れからこの時間たってから見る
    LIVE_SAME_MS: 1200, // これ以内の離れは同じ射とみなす
    LIVE_CONFIRM_RUNS: 4, // 続けてこの回数（= 3 秒のあいだ）、同じ時刻に同じ種類で見つかったら数える
    LIVE_STABLE_MS: 150, // 「同じ時刻」の幅
    LIVE_MIN_HOLD_MS: 600, // 保持がこれより短い射は、撮影中は数えない（全体の解析では数えられないことが多い）
    LIVE_MAX_AGE_MS: 8000, // 離れからこれより遅れて初めて確かめられたものは数えない（窓の端で形が変わった見え方のことが多い）
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
    /* i 番めのコマ。pts = 9 点 × [x, y, visibility]（正方形の画素。使えない点の x, y は NaN） */
    function frameAt(i) {
      if (!(i >= 0 && i < n)) return null;
      const c = i >> 12, k = i & 4095, d = ds[c], o = k * PER, pts = [];
      for (let s = 0; s < 9; s++) pts.push([d[o + s * 3], d[o + s * 3 + 1], d[o + s * 3 + 2]]);
      return { i, t: ts[c][k], pose: ps[c][k] === 1, pts };
    }
    /* tMs にいちばん近いコマ（動画で確かめる画面が、骨格を描くのに使う） */
    function at(tMs) {
      if (!n || !fin(tMs)) return null;
      let lo = 0, hi = n - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (timeAt(m) < tMs) lo = m + 1; else hi = m; }
      if (lo > 0 && tMs - timeAt(lo - 1) <= timeAt(lo) - tMs) lo--;
      return frameAt(lo);
    }
    return {
      push, pack, frameAt, at,
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

  /* 撮影中の射数の目安（design.md 2.4）。同じ解析器を直近 LIVE_WINDOW_MS にかける。2 つめの状態機械は持たない。
     数は目安で、終わってから全体を解析した数が記録になる。全体の解析より多く数えない側へ寄せてある（少なく出ることはある）:
     - 直近の窓だけを見た解析は、引いている途中や窓の端で、全体の解析には無い射を一時的に出す。そこで、続けて LIVE_CONFIRM_RUNS 回、
       同じ時刻（±LIVE_STABLE_MS）に同じ種類で見つかったものだけを数える。1 回だけ現れて消えるものは数えない（音も鳴らない）。
     - 保持が LIVE_MIN_HOLD_MS より短い射と、離れから LIVE_MAX_AGE_MS より遅れて初めて確かめられたものは数えない。
     - いちど数えたものは減らさない。引き戻しとして数えたものが、あとで射として確かめられたら、射に替える。
     ベンチマークの全部の場面 × 種 1〜3 で、撮影中の数が全体の解析の数を超えないことを検査している（tools/check-form-record.js） */
  function makeLiveCounter(analyzer) {
    const seen = [], recent = []; // seen = 数えたもの、recent = 直前の LIVE_CONFIRM_RUNS − 1 回の解析で見つかったもの
    let lastRun = -Infinity;
    const count = (kind) => seen.filter((e) => e.kind === kind).length;
    return {
      due: (nowMs) => nowMs - lastRun >= LIMITS.LIVE_EVERY_MS,
      update(buffer, handedness, fps) {
        const now = buffer.lastMs;
        lastRun = now;
        const r = analyzer.analyzePacked(buffer.pack(handedness, now - LIMITS.LIVE_WINDOW_MS), { handedness, fps });
        const cur = (r.shots || []).filter((s) => fin(s.releaseMs) && now - s.releaseMs >= LIMITS.LIVE_SETTLE_MS).map((s) => ({ t: s.releaseMs, kind: s.kind === "shot" ? "shot" : "letdown", hold: s.holdMs }));
        let added = 0;
        for (const s of cur) {
          let stable = recent.length >= LIMITS.LIVE_CONFIRM_RUNS - 1;
          for (let j = 0; j < recent.length && stable; j++) stable = recent[j].some((q) => q.kind === s.kind && Math.abs(q.t - s.t) <= LIMITS.LIVE_STABLE_MS);
          const shot = s.kind === "shot" && s.hold >= LIMITS.LIVE_MIN_HOLD_MS;
          const known = seen.find((e) => Math.abs(e.t - s.t) < LIMITS.LIVE_SAME_MS);
          if (known) {
            if (stable && shot && known.kind === "letdown") { known.kind = "shot"; known.t = s.t; added++; } // 引き戻しと見えたものが、射だった
            continue;
          }
          if (!stable || now - s.t > LIMITS.LIVE_MAX_AGE_MS || (s.kind === "shot" && !shot)) continue;
          seen.push({ t: s.t, kind: s.kind });
          if (shot) added++;
        }
        recent.push(cur);
        if (recent.length > LIMITS.LIVE_CONFIRM_RUNS - 1) recent.shift();
        return { shots: count("shot"), letdowns: count("letdown"), added };
      },
      get shots() { return count("shot"); },
      get letdowns() { return count("letdown"); },
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
  /* 検証用の診断（design.md 6.3・8 章）。解析器の中の値を、整数に丸めて持つ。映像・画素・点の列は入れない。
     s = 射ごと（ev と同じ順）: [離れの時刻の不確かさ, 射か引き戻しかの点, 離れを決めた線（0 = 引き尺、1 = 肘）, 引きを当てはめられたか, 型からの遠さ, 引き始め, アンカー, 引き終わり]
     r = 引いていた区間ごと（解析器の debug）: RUN_COLS の順。q = 回ごと。pl = 置き方の確認（始めたときの 5 行）
     時刻は 0.01 秒、点と z は 0.01、型からの遠さは 0.01 */
  const RUN_COLS = Object.freeze(["s", "e", "is", "kind", "type", "tc", "to", "t", "unc", "c", "zL", "zJ", "zLW", "zLE", "zJW", "zJE", "stepW", "stepE", "reason"]);
  const RUN_TIME = { s: 1, e: 1, is: 1, tc: 1, to: 1, t: 1, unc: 1, c: 1 };
  function diagBlock(result, placement) {
    const q = result.quality || {};
    const row = (x) => [toInt(x.releaseUncMs, 0.1), toInt(x.kindScore, 100), x.source === "elbow" ? 1 : 0, x.anchorFit ? 1 : 0, toInt(x.typicality, 100), toInt(x.drawStartMs, 0.1), toInt(x.anchorStartMs, 0.1), toInt(x.drawEndMs, 0.1)];
    const run = (d) => RUN_COLS.map((k) => {
      const v = d[k];
      if (k === "kind") return v === "shot" ? 0 : v === "letdown" ? 1 : 2;
      if (k === "type" || k === "reason") return typeof v === "string" ? v : null;
      return toInt(v, RUN_TIME[k] ? 0.1 : 100);
    });
    const rp = {};
    for (const k of Object.keys(q.repaired || {})) if (fin(q.repaired[k])) rp[k] = Math.round(q.repaired[k]);
    const out = {
      v: 1,
      q: { fr: fin(q.frames) ? q.frames : 0, st: toInt(q.still, 1000), dl: toInt(q.drawLevel, 1000), tp: q.template ? q.template.shots : null, dir: q.dir === -1 ? -1 : 1, rp },
      s: result.shots.map(row),
      r: (q.debug || []).map(run),
    };
    if (placement && Array.isArray(placement.rows)) {
      out.pl = { st: placement.rows.map((r) => r.state), tpx: fin(placement.tpx) ? placement.tpx : null, l: toInt(placement.left, 1), r: toInt(placement.right, 1), rho: toInt(placement.rho, 1000) };
    }
    return out;
  }
  /* 1 件の記録を組み立てる。sel = この記録に入れる射・引き戻し（result.shots の番号）と候補（result.candidates の番号）。省けば全部 */
  function assemble(result, ctx, sel) {
    const q = result.quality || {}, c = ctx || {};
    const ev = [], f = [], ps = [], pr = [], pick = sel ? new Set(sel.shots) : null, pickC = sel ? new Set(sel.cands) : null;
    let ld = 0;
    result.shots.forEach((s, si) => {
      if (pick && !pick.has(si)) return;
      const shot = s.kind === "shot";
      if (!shot) ld++;
      ev.push([shot ? 0 : 1, toInt(s.releaseMs, 0.1), toInt(s.holdMs, 0.1), toInt(s.drawMs, 0.1), shot ? Math.round((fin(s.confidence) ? s.confidence : 0.5) * 10) : 8, shot && s.typicality >= 1 ? 8 : 0]);
      if (shot) {
        f.push(COLS.map((k) => toInt(s.features ? s.features[k] : null, SCALE[META[k].unit])));
        ps.push(Array.isArray(s.poseHold) ? s.poseHold.slice() : null);
        pr.push(Array.isArray(s.poseRel) ? s.poseRel.slice() : null);
      }
    });
    const cd = (result.candidates || []).filter((_, i) => !pickC || pickC.has(i)).map((x) => [toInt(x.tMs, 0.1), toInt(x.fromMs, 0.1), toInt(x.toMs, 0.1), toInt(x.uncMs, 0.1), Math.max(0, REASONS.indexOf(x.reason)), x.likely ? 1 : 0, 0]);
    const { noise, nd } = captureNoise(result);
    const fw = c.frame && c.frame.w > 0 ? Math.round(c.frame.w) : null, fh = c.frame && c.frame.h > 0 ? Math.round(c.frame.h) : null;
    const view = q.view || {};
    const rec = {
      id: sel ? sel.id : c.id, date: c.date, ts: sel ? sel.ts : c.ts, sessionId: c.sessionId || null, setupId: c.setupId || null,
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
    if (sel) { rec.v2.cid = c.id; rec.v2.part = [sel.k + 1, sel.parts, sel.offset]; rec.v2.span = [toInt(sel.fromMs, 0.1), toInt(sel.toMs, 0.1)]; }
    if (c.diag) {
      const dg = diagBlock(result, c.placement);
      if (sel) { dg.s = dg.s.filter((_, i) => pick.has(i)); if (sel.k) { dg.r = []; delete dg.pl; } }
      rec.v2.dg = dg;
    }
    return rec;
  }
  /* 撮影 1 回 → 記録の配列（design.md 5.1）。36 射以下なら 1 件。超えたら、36 射以下になるいちばん少ない数に等分する。
     どの射も捨てない。引き戻しと候補は、時刻で、その時刻までの射が入る記録へ入れる。
     分けた記録は cid（最初の記録の id）と part で互いにつながる。ctx.ids = 2 件め以降の id（無ければ id から作る） */
  function buildRecords(result, ctx) {
    const c = ctx || {}, idx = [];
    result.shots.forEach((s, i) => { if (s.kind === "shot") idx.push(i); });
    const parts = Math.max(1, Math.ceil(idx.length / LIMITS.MAX_SHOTS));
    if (parts === 1) return [assemble(result, c, null)];
    const per = Math.ceil(idx.length / parts), q = result.quality || {}, end = fin(q.durationMs) ? q.durationMs : 0;
    const cut = []; // cut[k] = k 番めの記録の最後の射の離れ（次の記録との境）
    for (let k = 1; k < parts; k++) cut.push(result.shots[idx[k * per - 1]].releaseMs);
    const partOf = (t) => { let k = 0; while (k < cut.length && t > cut[k]) k++; return k; };
    const out = [];
    for (let k = 0; k < parts; k++) {
      const shots = [], cands = [];
      result.shots.forEach((s, i) => { if (partOf(s.releaseMs) === k) shots.push(i); });
      (result.candidates || []).forEach((x, i) => { if (partOf(x.tMs) === k) cands.push(i); });
      const fromMs = k ? cut[k - 1] : 0, toMs = k < cut.length ? cut[k] : Math.max(end, fromMs);
      out.push(assemble(result, c, { k, parts, offset: k * per, shots, cands, fromMs, toMs, id: k ? (c.ids && c.ids[k - 1]) || `${c.id}-${k + 1}` : c.id, ts: (c.ts || 0) + (k ? Math.max(k, Math.round(fromMs)) : 0) }));
    }
    return out;
  }
  /* 1 件だけを返す入口（36 射以下の撮影）。36 射を超える撮影は buildRecords を使う */
  function buildRecord(result, ctx) {
    return buildRecords(result, ctx)[0];
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
  /* 分けた記録（同じ撮影の全部。part[0] の順）の通し番号を合わせ直す。射数を直すと、その記録の射数が変わるので、
     うしろの記録の「それより前の射数」（part[2]）を、前の記録の射数（shots）の合計に置き直す。番号が重ならない。
     もとの記録は書き換えず、写しを返す。分けていない記録（part が無い）はそのまま返す。
     1 件に入る「値を測れた射」は 36 までのまま（分け直さない）。候補や引き戻しを射に数えると、その記録の射数は 36 を超えることがある
     （足した射は値を持たないので、記録の大きさはほとんど変わらない）。うしろの記録の番号は、その数から続く */
  function renumber(records) {
    const list = Array.isArray(records) ? records : [];
    let off = 0;
    return list.map((r) => {
      if (!r || !r.v2 || !Array.isArray(r.v2.part)) return r;
      const out = JSON.parse(JSON.stringify(r));
      out.v2.part[2] = off;
      off += fin(out.shots) && out.shots > 0 ? Math.round(out.shots) : 0;
      return out;
    });
  }

  /* ---------- 記録の読み分け（design.md 5.2） ---------- */
  const isV2 = (r) => !!(r && r.v2 && typeof r.v2 === "object" && Array.isArray(r.v2.ev) && r.cap && r.cap.g === GEOM);
  const natural = (int, k) => (fin(int) ? int / SCALE[META[k].unit] : null);
  /* 読み込んだバックアップの値は信用しない: 画面に出す数は、有限の整数でなければ null にする（文字列などをそのまま HTML に入れない） */
  const safeInt = (x) => (typeof x === "number" && fin(x) ? Math.round(x) + 0 : null);
  const partOf = (v) => {
    const p = v && Array.isArray(v.part) ? v.part.slice(0, 3).map(safeInt) : null;
    return p && p.length === 3 && p[0] >= 1 && p[1] >= p[0] && p[2] >= 0 ? p : null;
  };

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
    /* 射の番号は、その撮影の通し番号（分けた記録では、前の記録の射数から続ける）。count はこの記録の中の数 */
    const pt = partOf(v), off = pt ? pt[2] : 0;
    let n = 0;
    for (const e of events) e.n = e.counted ? off + ++n : null;
    const noise = {}, df = {};
    COLS.forEach((k, c) => { noise[k] = natural((v.nz || [])[c], k); df[k] = (v.nd || [])[c] || 0; });
    const compared = events.filter((e) => e.kind === "shot" && e.counted);
    return {
      rec, v, events, count: n, offset: off, compared, noise, df,
      part: pt ? { k: pt[0], of: pt[1] } : null,
      tpx: safeInt(v.tpx), cov: safeInt(v.cov), dur: safeInt(v.dur) || 0,
      fromS: Array.isArray(v.span) && fin(v.span[0]) ? v.span[0] / 100 : 0,
      toS: Array.isArray(v.span) && fin(v.span[1]) ? v.span[1] / 100 : null,
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
    if (!va.view || !vb.view || va.view.side !== vb.view.side) return { ok: false, why: "胸側と背中側の違い" };
    if (m.kind === "h") return va.view.cls && vb.view.cls && va.view.cls !== "x" && vb.view.cls !== "x" ? { ok: true, why: "" } : { ok: false, why: "斜めすぎ" };
    if (va.view.cls !== "s" || vb.view.cls !== "s") return { ok: false, why: "真横でない" };
    return va.view.rho > 0 && Math.abs(vb.view.rho / va.view.rho - 1) <= 0.06 ? { ok: true, why: "" } : { ok: false, why: "腕の写る長さが 6% より違う" };
  }
  /* 推移（design.md 2.9・5.4）。いちばん新しい記録と比べてよい回だけを並べる。1 回 = 1 回の撮影（分けた記録は 1 つにまとめる）。
     points[] = { id, ids, date, ts, n, med, q1, q3, unc, gear }。値は解析器の単位。「—」（測れなかった値）は数えない。
       unc = その回の中央値の 95% の不確かさ（1.96 × 1.2533 × σ / √n。σ は 4 射以上なら 四分位の幅 / 1.349（1 射だけ離れた値に
             引っぱられないように）、2〜3 射なら標準偏差。2 射に満たなければ null）
       gear = 前の点と、紐づけた弓具が違う
     excluded = 入れなかった回の数、why = その理由ごとの数、skipped = 入れなかった記録の id、
     ref = 比べる相手（いちばん新しい記録）、refUnmeasured = その記録の置き方ではこの項目を測れない、
     unc = 点の unc の中央値、range = 中央値のいちばん大きい回と小さい回の差 */
  function trend(records, key) {
    const out = { key, points: [], excluded: 0, why: {}, skipped: [], ref: null, refUnmeasured: false, unc: null, range: null };
    const v2 = records.filter(isV2).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    if (!v2.length || !META[key]) return out;
    const ref = (out.ref = v2[v2.length - 1]);
    if (!keysFor(ref, [key]).length) { out.refUnmeasured = true; return out; }
    const groups = new Map();
    for (const r of v2) { const g = r.v2.cid || r.id; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); }
    const drop = (g, why) => { out.excluded++; out.why[why] = (out.why[why] || 0) + 1; for (const r of g) out.skipped.push(r.id); };
    let prevSetup = null;
    for (const g of groups.values()) {
      const head = g[0], c = comparable(ref, head, key);
      if (!c.ok) { drop(g, c.why); continue; }
      if (!keysFor(head, [key]).length) { drop(g, "この置き方では測れない"); continue; }
      const vals = [];
      for (const r of g) for (const e of read(r).compared) if (fin(e.vals[key])) vals.push(e.vals[key]);
      if (!vals.length) { drop(g, "値を測れた射が無い"); continue; }
      const q1 = quantile(vals, 0.25), q3 = quantile(vals, 0.75), s = vals.length >= 4 ? (q3 - q1) / 1.349 : sd(vals), setup = head.setupId || null;
      out.points.push({
        id: head.id, ids: g.map((r) => r.id), date: head.date, ts: head.ts, n: vals.length,
        med: median(vals), q1, q3,
        unc: fin(s) ? (1.96 * 1.2533 * s) / Math.sqrt(vals.length) : null,
        gear: !!(setup && prevSetup && setup !== prevSetup),
      });
      if (setup) prevSetup = setup;
    }
    const uncs = out.points.map((p) => p.unc).filter(fin), meds = out.points.map((p) => p.med);
    if (uncs.length) out.unc = median(uncs);
    if (meds.length) out.range = Math.max(...meds) - Math.min(...meds);
    return out;
  }

  /* ---------- 検証用の書き出し（design.md 6.3） ----------
     実地の確認で解析器を見直すための JSON。数値だけ。入れないもの: 映像、画素、記録の id、日付と時刻、メモ、練習や弓具との紐づけ、
     身長、保存した姿（ps・pr）。体の点の列（landmarks）は、利用者が 2 つめの設定を入にして、撮った直後の画面から書き出すときだけ入る。
     records = v2 の記録（古い順に並べ直す）。opts = { appVer, landmarks: { id: 記録の id → makeBuffer の中身を書き出したもの } } */
  const DIAG_KIND = "archery-note-form-v2-diagnostics";
  function diagnostics(records, opts) {
    const o = opts || {}, list = (records || []).filter(isV2).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const order = new Map();
    const captures = list.map((r) => {
      const v = r.v2, m = read(r), g = v.cid || r.id;
      if (!order.has(g)) order.set(g, order.size + 1);
      const c = {
        capture: order.get(g), part: Array.isArray(v.part) ? v.part.slice(0, 3) : [1, 1, 0],
        src: r.cap.src, hand: r.cap.hand, facing: r.cap.facing || null,
        frame: { w: r.cap.fw, h: r.cap.fh, o: r.cap.o }, fps: fin(r.fps) ? r.fps : null,
        model: r.modelVer || "", appVer: fin(r.appVer) ? r.appVer : null, analyzer: v.av, featureVersion: v.fv,
        durS: v.dur, spanS: Array.isArray(v.span) ? v.span.map((x) => x / 100) : null, coveragePct: v.cov, torsoPx: v.tpx,
        view: { side: v.view.side, cls: v.view.cls, rho: v.view.rho, om: v.view.om },
        warnings: (v.w || []).slice(),
        counts: { shots: m.count, letdowns: m.letdowns, candidates: (v.cd || []).length, added: m.added, removed: m.removed },
        events: (v.ev || []).map((x) => x.slice()),
        candidates: (v.cd || []).map((x) => { const y = x.slice(); y[4] = REASONS[x[4]] || ""; return y; }),
        features: (v.f || []).map((x) => x.slice()),
        noise: (v.nz || []).slice(), noiseDf: (v.nd || []).slice(),
        analyzerDetail: v.dg ? JSON.parse(JSON.stringify(v.dg)) : null,
      };
      if (o.landmarks && o.landmarks[r.id]) c.landmarks = o.landmarks[r.id];
      return c;
    });
    return {
      kind: DIAG_KIND, version: 1,
      app: { appVer: fin(o.appVer) ? o.appVer : null, geometry: GEOM, featureVersion: FV },
      units: {
        events: "[kind 0=射 1=引き戻し, 離れ 0.01s, 保持 0.01s, 引き 0.01s, 確かさ 0-10, 印 2=引き戻しを射に 4=射から外した 8=型から遠い]",
        candidates: "[時刻 0.01s, 始め, 終わり, 幅, 理由, 射らしい 0/1, 足した 0/1]",
        features: COLS.join(",") + "（時間 0.01s・位置 0.001 胴・角度 0.1°）",
        noise: "features と同じ列・同じ単位",
        "analyzerDetail.s": "[離れの不確かさ 0.01s, 射か引き戻しかの点 0.01, 離れの線 0=引き尺 1=肘, 引きの当てはめ 0/1, 型からの遠さ 0.01, 引き始め 0.01s, アンカー 0.01s, 引き終わり 0.01s]（events と同じ順）",
        "analyzerDetail.r": RUN_COLS.join(",") + "（時刻 0.01s・ほかは 0.01）",
        "analyzerDetail.pl": "置き方の確認（写り・大きさ・余白・向き・速さ の状態、胴 px、左右の余白 %、腕の長さ 0.001 胴）",
        landmarks: "t = 時刻 ms、p = 1 コマ 27 個（9 点 ×（x 0.1px, y 0.1px, visibility 0.01））。点の順: 鼻・左肩・右肩・左肘・右肘・左手首・右手首・左腰・右腰。姿勢が取れなかったコマは null",
      },
      captures,
    };
  }
  /* バッファを、書き出せる形にする（体の点の列。2 つめの設定が入のときだけ使う）。fromMs〜toMs だけを切り出せる */
  function landmarkDump(buffer, fromMs, toMs) {
    const t = [], p = [], fr = buffer.frame;
    for (let i = 0; i < buffer.n; i++) {
      const f = buffer.frameAt(i);
      if (fin(fromMs) && f.t < fromMs) continue;
      if (fin(toMs) && f.t > toMs) break;
      t.push(Math.round(f.t));
      if (!f.pose) { p.push(null); continue; }
      const row = [];
      for (const q of f.pts) row.push(toInt(q[0], 10), toInt(q[1], 10), toInt(q[2], 100));
      p.push(row);
    }
    return { w: fr.w, h: fr.h, n: t.length, t, p };
  }

  return {
    FV, GEOM, TORSO_PER_HEIGHT, LIMITS, COLS, META, REASONS,
    makeBuffer, makeLiveCounter, placement, captureState, captureNoise, buildRecord, buildRecords, renumber, diagBlock, RUN_COLS, DIAG_KIND, diagnostics, landmarkDump, setCounted, isV2, read, keysFor, compare, exceedsF95, sdInterval,
    shown, shownSize, unitText, fmt, cmText, flagSentence, summary, comparable, trend, median, quantile, sd,
  };
})();
