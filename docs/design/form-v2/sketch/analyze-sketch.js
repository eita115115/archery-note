/* 射型の記録 v2 — 解析器の下書き（設計の検証用。アプリには読み込まない）
   仕様: docs/design/form-v2/algorithm.md。契約:
   analyze(frames, {frame:{w,h}, handedness, fps}) -> {shots, quality}
   frames = [{tMs, landmarks:[33 {x,y,z,visibility}] | null}]
   DOM・db・乱数を使わない純関数。Node でそのまま動く。 */
"use strict";

const P = Object.freeze({
  V_MIN: 0.3, // 点を使う visibility の下限
  GAP_FILL_MS: 200, // これ以下の欠測は線形補間する
  SCALE_WIN_MS: 2000, // 胴の長さの移動中央値の幅
  HAMPEL_HALF: 2, // 外れ点除去の半幅（サンプル）
  HAMPEL_K: 3,
  SMOOTH_MED_MS: 100, // 特徴用の平滑（中央値 → 平均）
  SMOOTH_AVG_MS: 160,
  G1_LO: -0.45, // 弓手の手首の高さ − 弓手の肩の高さ（胴比、上が正）
  G1_HI: 0.7,
  G2_LO: -0.65, // 引き手の手首の高さ − 鼻の高さ（胴比、上が正）
  G2_HI: 0.3,
  D_MIN: 0.55, // 引き尺（手首間の距離）の絶対下限（胴比）
  D_FRAC: 0.8, // 引いている区間のしきい値 = D_FRAC × 保持の水準
  LEVEL_BIN: 0.05, // 保持の水準を探すヒストグラムの幅（胴比）
  LEVEL_MASS: 0.25, // いちばん大きいかたまりの何割あれば「十分な時間」とするか
  LEVEL_REL: 0.55, // いちばん高いかたまりの何倍以上を保持の候補とするか
  RUN_BRIDGE_MS: 250,
  RUN_MIN_MS: 300,
  STILL_MIN: 0.2, // 静止とみなす速さの下限と上限（胴/秒）
  STILL_MAX: 0.8,
  STILL_K: 3,
  SETTLE_MS: 150,
  REF_FROM_MS: 400, // 保持の基準 = 直前 [REF_FROM, REF_TO] の中央値
  REF_TO_MS: 60,
  Q_POST_MS: 200, // 「直後」の窓
  EXIT_MIN: 0.03, // 保持位置から離れたとみなす距離の下限（胴比）
  EXIT_K: 6, // q の中央値 ± EXIT_K × ゆれの幅（16%・84% 点から）
  RUN_TAIL_MS: 300, // 引いている区間の後ろへ延ばして探す時間
  LOOK_MS: 2500, // 区間の終わりのあと、終わり方を見る最長の時間
  HOLD0_MS: 1000, // 保持の始めの水準とゆれを取る長さ
  MACRO_K: 5, // 終わり方のしきい値 = max(固定の下限, 保持の始めのゆれ × MACRO_K)
  SUSTAIN_MS: 300, // 終わり方の条件が続くべき時間
  LOCATE_K: 3.5, // 射だと分かっているとき、離れの位置として採る下限（ゆれの幅の倍数）
  CLOSE_GUARD_MS: 150, // 近づき始める直前のこの時間は、離れを探さない
  LOCATED_UNC_MS: 60, // LOCATE_K〜EXIT_K の離れの時刻の不確かさ
  CLOSE_FRAC: 0.12, // 手首間の距離がこの割合だけ縮めば「近づいた」
  ARM_DROP: 0.15, // 弓手の手首がこれだけ下がれば「下ろし始めた」（胴比。平滑した高さで見る）
  WEAK_UNC_MS: 150, // 弱い離れの時刻の不確かさの下限
  LATE_UNC_MS: 500, // 腕を下ろす動きで気づいた射の時刻の不確かさ
  FOLLOW_DEFAULT_MS: 800, // その場合に離れまでさかのぼる時間（はっきりした射の中央値が無いとき）
  FIT_BEFORE_MS: 250, // 動き始めの当てはめに使う範囲
  FIT_AFTER_MS: 450,
  FIT_TAUS: [35, 70, 105, 140], // 立ち上がりの長さの候補（ms）
  ANCHOR_FAR: 0.08, // 保持位置からこれ以上離れていたら、まだ引いている途中（胴比）
  REFRACTORY_MS: 1500,
  ANCHOR_K: 5, // far = max(ANCHOR_FAR, 2 × ANCHOR_K × 保持中のゆれ)
  ANCHOR_BRIDGE_MS: 250,
  FEAT_FROM_MS: 600, // 特徴の窓 = 離れの [FEAT_FROM, FEAT_TO] 前
  FEAT_TO_MS: 60,
  FEAT_SETTLE_MS: 200, // アンカーに入ってからこの時間は、ゆれの見積もりに使わない
  FEAT_WINS_MAX: 8, // 1射で使う窓の数の上限
  NOISE_LAGS: 3, // 窓どうしの差を取る間隔の上限
  IDENTITY_JUMP: 1.0, // 腰の中点がこれ以上（胴比）跳んだら別人・切り替わり（下書きでは未使用）
});

const IDX = { nose: 0, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24 };
const NAMES = ["nose", "bSh", "dSh", "bEl", "dEl", "bWr", "dWr", "bHip", "dHip"];

const median = (a) => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const mad = (a, c) => {
  const m = c === undefined ? median(a) : c;
  return 1.4826 * median(a.map((x) => Math.abs(x - m)));
};
const pct = (a, q) => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!v.length) return NaN;
  const p = (v.length - 1) * q, i = Math.floor(p);
  return v[i] + (v[Math.min(i + 1, v.length - 1)] - v[i]) * (p - i);
};
const sd = (a) => {
  const v = a.filter(Number.isFinite);
  if (v.length < 2) return NaN;
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (v.length - 1));
};

/* 1. 取り込み: 時刻順・重複除去、使う 9 点だけを正方形の画素で持つ */
function packFrames(frames, opts) {
  const w = opts.frame.w, h = opts.frame.h, right = opts.handedness !== "left";
  const map = right
    ? { nose: IDX.nose, bSh: IDX.lSh, dSh: IDX.rSh, bEl: IDX.lEl, dEl: IDX.rEl, bWr: IDX.lWr, dWr: IDX.rWr, bHip: IDX.lHip, dHip: IDX.rHip }
    : { nose: IDX.nose, bSh: IDX.rSh, dSh: IDX.lSh, bEl: IDX.rEl, dEl: IDX.lEl, bWr: IDX.rWr, dWr: IDX.lWr, bHip: IDX.rHip, dHip: IDX.lHip };
  const src = frames.filter((f) => f && Number.isFinite(f.tMs)).slice().sort((a, b) => a.tMs - b.tMs);
  const t = [], pts = {};
  NAMES.forEach((n) => (pts[n] = { x: [], y: [] }));
  let last = -Infinity, nPose = 0;
  for (const f of src) {
    if (f.tMs <= last) continue;
    last = f.tMs;
    t.push(f.tMs);
    if (f.landmarks) nPose++;
    for (const n of NAMES) {
      const p = f.landmarks && f.landmarks[map[n]];
      const vis = p && (p.visibility === undefined ? 1 : p.visibility);
      const ok = p && Number.isFinite(p.x) && Number.isFinite(p.y) && vis >= P.V_MIN && p.x > -0.2 && p.x < 1.2 && p.y > -0.2 && p.y < 1.2;
      pts[n].x.push(ok ? p.x * w : NaN);
      pts[n].y.push(ok ? p.y * h : NaN);
    }
  }
  return { t, pts, coverage: t.length ? nPose / t.length : 0 };
}

/* 2. 等間隔への再標本化。GAP_FILL_MS 以下の欠測だけ線形補間 */
function resample(pk, fpsHint) {
  const { t } = pk;
  const dts = [];
  for (let i = 1; i < t.length; i++) dts.push(t[i] - t[i - 1]);
  let dt = median(dts);
  if (!Number.isFinite(dt)) dt = 1000 / (fpsHint || 30);
  dt = Math.min(100, Math.max(1000 / 60, dt));
  const n = t.length ? Math.floor((t[t.length - 1] - t[0]) / dt) + 1 : 0;
  const out = { dt, t0: t[0] || 0, n, pts: {} };
  for (const name of NAMES) {
    for (const ax of ["x", "y"]) {
      const s = pk.pts[name][ax], r = new Float64Array(n).fill(NaN);
      let j = 0, a = -1; // a = 直前の有効な標本
      const valid = [];
      for (let i = 0; i < s.length; i++) if (Number.isFinite(s[i])) valid.push(i);
      for (let g = 0; g < n; g++) {
        const tg = out.t0 + g * dt;
        while (j < valid.length && t[valid[j]] <= tg) a = valid[j++];
        const b = j < valid.length ? valid[j] : -1;
        if (a >= 0 && t[a] === tg) r[g] = s[a];
        else if (a >= 0 && b >= 0 && t[b] - t[a] <= Math.max(P.GAP_FILL_MS, dt * 1.5)) r[g] = s[a] + ((s[b] - s[a]) * (tg - t[a])) / (t[b] - t[a]);
      }
      (out.pts[name] = out.pts[name] || {})[ax] = r;
    }
  }
  return out;
}

function hampel(a, half, k) {
  const out = Float64Array.from(a);
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i])) continue;
    const w = [];
    for (let j = Math.max(0, i - half); j <= Math.min(a.length - 1, i + half); j++) if (Number.isFinite(a[j])) w.push(a[j]);
    if (w.length < 3) continue;
    const m = median(w), s = mad(w, m);
    if (Math.abs(a[i] - m) > k * Math.max(s, 1e-9) && s > 0) out[i] = m;
  }
  return out;
}
function rollMedian(a, half) {
  const out = new Float64Array(a.length).fill(NaN);
  for (let i = 0; i < a.length; i++) {
    const w = [];
    for (let j = Math.max(0, i - half); j <= Math.min(a.length - 1, i + half); j++) if (Number.isFinite(a[j])) w.push(a[j]);
    if (w.length) out[i] = median(w);
  }
  return out;
}
function rollMean(a, half) {
  const out = new Float64Array(a.length).fill(NaN);
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i])) continue;
    let s = 0, c = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(a.length - 1, i + half); j++) if (Number.isFinite(a[j])) (s += a[j]), c++;
    out[i] = s / c;
  }
  return out;
}
const smooth = (a, dt) => rollMean(rollMedian(a, Math.max(1, Math.round(P.SMOOTH_MED_MS / dt / 2))), Math.max(1, Math.round(P.SMOOTH_AVG_MS / dt / 2)));

/* 3. 体の単位の信号を作る */
function buildSignals(rs) {
  const n = rs.n, dt = rs.dt, pt = {};
  for (const name of NAMES) pt[name] = { x: hampel(rs.pts[name].x, P.HAMPEL_HALF, P.HAMPEL_K), y: hampel(rs.pts[name].y, P.HAMPEL_HALF, P.HAMPEL_K) };
  const mid = (a, b, ax) => Float64Array.from(pt[a][ax], (v, i) => (v + pt[b][ax][i]) / 2);
  const ms = { x: mid("bSh", "dSh", "x"), y: mid("bSh", "dSh", "y") }, mh = { x: mid("bHip", "dHip", "x"), y: mid("bHip", "dHip", "y") };
  const Traw = Float64Array.from(ms.x, (v, i) => Math.hypot(v - mh.x[i], ms.y[i] - mh.y[i]));
  const T0 = median(Array.from(Traw));
  const T = rollMedian(Traw, Math.round(P.SCALE_WIN_MS / dt / 2)).map((v) => (Number.isFinite(v) ? v : T0));
  // 弓の向き（画面の右か左か）: 弓手の手首が引き手の肩のどちら側に多くあるか
  const sgnArr = [];
  for (let i = 0; i < n; i++) sgnArr.push(pt.bWr.x[i] - pt.dSh.x[i]);
  const dir = median(sgnArr.filter((v) => Math.abs(v) > 0.6 * T0)) >= 0 ? 1 : -1;
  // 正準座標: 原点 = 両肩の中点、x は弓の向きが正、y は上が正、単位 = 胴の長さ
  const C = {};
  for (const name of NAMES) {
    C[name] = {
      x: Float64Array.from(pt[name].x, (v, i) => (dir * (v - ms.x[i])) / T[i]),
      y: Float64Array.from(pt[name].y, (v, i) => -(v - ms.y[i]) / T[i]),
    };
  }
  C.hipMid = { x: Float64Array.from(mh.x, (v, i) => (dir * (v - ms.x[i])) / T[i]), y: Float64Array.from(mh.y, (v, i) => -(v - ms.y[i]) / T[i]) };
  const d = Float64Array.from(C.dWr.x, (v, i) => Math.hypot(v - C.bWr.x[i], C.dWr.y[i] - C.bWr.y[i]));
  const sig = { n, dt, t0: rs.t0, T, T0, dir, C, d, ds: smooth(d, dt) };
  sig.e = Float64Array.from(C.bWr.y, (v, i) => v - C.bSh.y[i]);
  sig.ay = Float64Array.from(C.dWr.y, (v, i) => v - C.nose.y[i]);
  sig.es = smooth(sig.e, dt);
  sig.ays = smooth(sig.ay, dt);
  sig.ps = { x: smooth(C.dWr.x, dt), y: smooth(C.dWr.y, dt) };
  const spd = (c) => {
    const o = new Float64Array(n).fill(NaN);
    for (let i = 1; i < n - 1; i++) o[i] = (Math.hypot(c.x[i + 1] - c.x[i - 1], c.y[i + 1] - c.y[i - 1]) / (2 * dt)) * 1000;
    return o;
  };
  sig.vs = spd(sig.ps);
  return sig;
}

/* 4. 引いている区間 */
/* 保持の水準: 構えの門を満たし、手が止まっているコマの引き尺 ds の分布から決める。
   止まっている所は セットアップ・保持・離れのあとの残身 の 3 か所にかたまる。
   十分な時間のあるかたまりのうち、いちばん高い水準の LEVEL_REL 倍以上で、いちばん低いものを保持とする
   （残身は保持より引き尺が長く、セットアップはずっと短い）。 */
function holdLevel(sig, pose, still) {
  const vals = [];
  for (let i = 0; i < sig.n; i++) if (pose(i) && sig.vs[i] < still && Number.isFinite(sig.ds[i]) && sig.ds[i] >= P.D_MIN * 0.5) vals.push(sig.ds[i]);
  if (vals.length * sig.dt < 250) return NaN;
  const bin = P.LEVEL_BIN, cnt = new Map();
  for (const v of vals) { const b = Math.floor(v / bin); cnt.set(b, (cnt.get(b) || 0) + 1); }
  const mass = (b) => (cnt.get(b - 1) || 0) + (cnt.get(b) || 0) + (cnt.get(b + 1) || 0);
  const peaks = [...cnt.keys()].filter((b) => mass(b) >= mass(b - 1) && mass(b) >= mass(b + 1)).map((b) => ({ b, m: mass(b) }));
  const maxM = Math.max(...peaks.map((q) => q.m));
  const sig_ = peaks.filter((q) => q.m >= P.LEVEL_MASS * maxM && q.m * sig.dt >= 250 && (q.b + 0.5) * bin >= P.D_MIN);
  if (!sig_.length) return NaN;
  const top = Math.max(...sig_.map((q) => q.b));
  const hold = Math.min(...sig_.filter((q) => q.b + 0.5 >= P.LEVEL_REL * (top + 0.5)).map((q) => q.b));
  return median(vals.filter((v) => Math.abs(v - (hold + 0.5) * bin) <= 1.5 * bin));
}

function drawnRuns(sig, dLevel, still) {
  const { n, dt } = sig;
  const pose = (i) => sig.es[i] >= P.G1_LO && sig.es[i] <= P.G1_HI && sig.ays[i] >= P.G2_LO && sig.ays[i] <= P.G2_HI;
  let level = dLevel;
  if (!Number.isFinite(level)) level = holdLevel(sig, pose, still);
  if (!(level >= P.D_MIN)) return { runs: [], level };
  const th = Math.max(P.D_MIN, P.D_FRAC * level), runs = [];
  let s = -1, lastOn = -1;
  const bridge = Math.round(P.RUN_BRIDGE_MS / dt);
  for (let i = 0; i <= n; i++) {
    const on = i < n && pose(i) && sig.ds[i] >= th;
    if (on) {
      if (s < 0) s = i;
      lastOn = i;
    } else if (s >= 0 && (i === n || i - lastOn > bridge)) {
      if ((lastOn - s) * dt >= P.RUN_MIN_MS) runs.push([s, lastOn]);
      s = -1;
    }
  }
  return { runs, level };
}

const winIdx = (i, fromMs, toMs, dt, n) => [Math.max(0, Math.round(i + fromMs / dt)), Math.min(n - 1, Math.round(i + toMs / dt))];
function medPt(c, a, b) {
  const xs = [], ys = [];
  for (let i = a; i <= b; i++) if (Number.isFinite(c.x[i]) && Number.isFinite(c.y[i])) (xs.push(c.x[i]), ys.push(c.y[i]));
  return xs.length >= 2 ? { x: median(xs), y: median(ys), n: xs.length, xs, ys } : null;
}
const medS = (a, lo, hi) => median(Array.from(a.slice(lo, hi + 1)));

/* 5. 保持の終わりを探し、離れ・引き戻しを決める
   q(i) = |直後 Q_POST_MS の中央値 − 直前 [REF_FROM, REF_TO] の中央値|。しきい値は、その保持の中での q 自身の分布から決める。 */
function qStat(sig, c, from, to, axis) {
  const { dt, n } = sig, q = new Float64Array(n).fill(NaN), k = Math.max(1, Math.round(P.Q_POST_MS / dt));
  for (let i = from; i <= to; i++) {
    const [a, b] = winIdx(i, -P.REF_FROM_MS, -P.REF_TO_MS, dt, n);
    const ref = medPt(c, Math.max(a, from - Math.round(P.REF_FROM_MS / dt)), b), post = medPt(c, i, Math.min(n - 1, i + k));
    if (!ref || !post || ref.n < 3) continue;
    // axis があれば、その向き（引きの軸。後ろが正）への射影。無ければ動いた距離
    q[i] = axis ? (post.x - ref.x) * axis.x + (post.y - ref.y) * axis.y : Math.hypot(post.x - ref.x, post.y - ref.y);
  }
  const null_ = Array.from(q.slice(from, to + 1)).filter(Number.isFinite);
  // ゆれの幅は分布の「事象の少ない側」から取る。距離なら下側、射影なら上下の狭いほう
  const m = median(null_), lo = m - pct(null_, 0.16), hi = pct(null_, 0.84) - m, s = Math.max(axis ? Math.min(lo, hi) : lo, 0.002);
  return { q, th: Math.max(P.EXIT_MIN, m + P.EXIT_K * s), thNeg: Math.min(-P.EXIT_MIN, m - P.EXIT_K * s), med: m, lowSpread: s };
}
function holdRef(sig, x, lo) {
  const { dt, n, C } = sig;
  let [h0, h1] = winIdx(x, -P.REF_FROM_MS, -P.REF_TO_MS, dt, n);
  h0 = Math.min(Math.max(h0, lo || 0), h1 - 2);
  const hd = medPt(C.dWr, h0, h1), hb = medPt(C.bWr, h0, h1);
  if (!hd || !hb) return null;
  // 基準の窓の前半と後半で位置が違えば、まだ動いている（保持の基準にならない）
  const mid = (h0 + h1) >> 1, a = medPt(C.dWr, h0, mid), b = medPt(C.dWr, mid + 1, h1);
  const trend = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  const devs = hd.xs.map((v, k) => Math.hypot(v - hd.x, hd.ys[k] - hd.y)), dm = median(devs);
  return { hd, hb, h0, h1, trend, dHold: medS(sig.d, h0, h1), devMed: dm, devMad: Math.max(0.003, mad(devs, dm)) };
}
/* 動き始めを1コマより細かく: 保持位置からの距離 dev(t) に「一定 → 直線で増える → 一定」の形を当てはめる。
   当てはめる量は動き始め tr と立ち上がりの長さ tau。残差の二乗和が最小の組を取る。 */
function onsetFit(sig, c, R, x) {
  const { dt, n } = sig, ref = c === sig.C.dWr ? R.hd : R.hb;
  const i0 = Math.max(0, x - Math.round(P.FIT_BEFORE_MS / dt)), i1 = Math.min(n - 1, x + Math.round(P.FIT_AFTER_MS / dt));
  const ts = [], ds = [];
  for (let j = i0; j <= i1; j++) if (Number.isFinite(c.x[j])) (ts.push(j * dt), ds.push(Math.hypot(c.x[j] - ref.x, c.y[j] - ref.y)));
  const after = ds.filter((_, k) => ts[k] >= x * dt + P.Q_POST_MS + 100), base = median(ds.filter((_, k) => ts[k] <= (x - 2) * dt));
  const top = after.length ? median(after) : Math.max(...ds);
  if (ds.length < 5 || !(top > base)) return { t: x, unc: dt };
  let best = { sse: Infinity, tr: x * dt }, second = Infinity;
  const step = dt / 8;
  for (const tau of P.FIT_TAUS) {
    for (let tr = (x - Math.round(150 / dt)) * dt; tr <= x * dt + P.Q_POST_MS; tr += step) {
      let sse = 0;
      for (let k = 0; k < ts.length; k++) {
        const u = (ts[k] - tr) / tau, m = base + (top - base) * (u <= 0 ? 0 : u >= 1 ? 1 : u);
        sse += (ds[k] - m) * (ds[k] - m);
      }
      if (sse < best.sse) best = { sse, tr, tau };
    }
  }
  // 欠測が動き始めにかかっていたら、欠測の幅の半分を不確かさにする
  let gap = 0;
  for (let k = 1; k < ts.length; k++) if (ts[k - 1] <= best.tr + dt && ts[k] >= best.tr && ts[k] - ts[k - 1] > 1.5 * dt) gap = ts[k] - ts[k - 1];
  return { t: best.tr / dt, unc: Math.max(dt / 4, gap / 2), tau: best.tau };
}
function terminalEvent(sig, is, runEnd, nextStart) {
  const { dt, n, C } = sig, from = is + Math.round(P.REF_FROM_MS / dt); // 止まってから基準の窓ひとつぶん待つ
  const lim = Math.min(n - 2, nextStart - 1, runEnd + Math.round(P.LOOK_MS / dt));
  if (from >= lim) return null;
  // (a) 保持の始めの水準: 止まってから HOLD0_MS の引き尺と弓手の高さ
  const h1 = Math.min(runEnd, is + Math.round(P.HOLD0_MS / dt)), D0 = medS(sig.ds, is, h1), e0 = medS(sig.es, is, h1);
  if (!Number.isFinite(D0) || !Number.isFinite(e0)) return null;
  const sp = (a) => mad(Array.from(a.slice(is, h1 + 1)).filter(Number.isFinite));
  const closeTh = Math.max(P.CLOSE_FRAC * D0, P.MACRO_K * sp(sig.ds)), dropTh = Math.max(P.ARM_DROP, P.MACRO_K * sp(sig.es));
  // (b) 終わり方（大きな動きで決める）: 手首どうしが近づく / 弓手が下がる / 見えなくなる / そのまま区間が終わる
  let tc = lim, type = "end", gap = 0;
  const bridge = Math.round(P.RUN_BRIDGE_MS / dt);
  for (let j = from; j <= lim; j++) {
    const ds = sig.ds[j], es = sig.es[j];
    if (!Number.isFinite(ds) || !Number.isFinite(es)) { if (++gap > bridge) { type = "gap"; tc = j - gap; break; } continue; }
    gap = 0;
    // しきい値は、固定の下限と「保持の始めのゆれ × MACRO_K」の大きいほう。SUSTAIN_MS の中央値でも超えていること
    const sus = Math.min(n - 1, j + Math.round(P.SUSTAIN_MS / dt));
    const dropped = es <= e0 - dropTh && medS(sig.es, j, sus) <= e0 - dropTh;
    if (ds <= D0 - closeTh && medS(sig.ds, j, sus) <= D0 - closeTh) { type = dropped ? "lower" : "close"; tc = j; break; }
    if (dropped) { type = "lower"; tc = j; break; }
  }
  // (c) その前で、引き手がいちばんはっきり後ろへ動いた所を探す
  const md = medPt(C.dWr, is, h1), mb = medPt(C.bWr, is, h1);
  if (!md || !mb) return null;
  const al = Math.hypot(md.x - mb.x, md.y - mb.y) || 1, axis = { x: (md.x - mb.x) / al, y: (md.y - mb.y) / al };
  const to = Math.min(n - 2, tc + Math.round(P.Q_POST_MS / dt));
  const qd = qStat(sig, C.dWr, from, to, axis), qb = qStat(sig, C.bWr, from, to);
  const argmax = (q, hi) => { let bi = -1, bv = -Infinity; for (let i = from; i <= hi; i++) if (q[i] > bv) { bv = q[i]; bi = i; } return { i: bi, v: bv }; };
  // 立ち上がりの途中（最大の少し手前で、しきい値を初めて越えた所）へ戻してから当てはめる
  const firstOver = (q, pk, th) => { let i = pk; while (i - 1 >= from && q[i - 1] > th && pk - i < Math.round(400 / dt)) i--; return i; };
  const pkD = argmax(qd.q, to), snrD = pkD.i < 0 ? -Infinity : (pkD.v - qd.med) / qd.lowSpread;
  const out = (kind, i, c, extra) => {
    const R = holdRef(sig, i, is);
    if (!R) return null;
    const o = c ? onsetFit(sig, c, R, i) : { t: i, unc: P.LATE_UNC_MS / 2 };
    return Object.assign({ kind, i, R, t: o.t, unc: o.unc, score: snrD, type }, extra);
  };
  const strong = pkD.i >= 0 && pkD.v >= Math.max(P.EXIT_MIN, qd.med + P.EXIT_K * qd.lowSpread);
  const located = pkD.i >= 0 && pkD.v >= Math.max(P.EXIT_MIN, qd.med + P.LOCATE_K * qd.lowSpread);
  if (strong && type !== "close") return out("shot", firstOver(qd.q, pkD.i, qd.med + P.LOCATE_K * qd.lowSpread), C.dWr, { source: "draw", weak: false });
  if (type === "close") {
    // 弓手を上げたまま手首どうしが近づいた。その前にはっきりした離れがあれば射、無ければ引き戻し
    const pre = argmax(qd.q, Math.max(from, tc - Math.round(P.CLOSE_GUARD_MS / dt)));
    if (pre.i >= 0 && pre.v >= Math.max(P.EXIT_MIN, qd.med + P.EXIT_K * qd.lowSpread)) return out("shot", firstOver(qd.q, pre.i, qd.med + P.LOCATE_K * qd.lowSpread), C.dWr, { source: "draw", weak: false });
    let i = tc; // 手が前へ動き始めた所までさかのぼる
    while (i - 1 >= from && sig.ds[i - 1] < D0 - closeTh / 4) i--;
    return out("letdown", i, null, { source: "draw", weak: false, unc: P.WEAK_UNC_MS });
  }
  if (type === "lower" || type === "end") {
    // 手を前へ戻さずに腕を下ろした（または残身のまま区間が終わった）: 射。時刻は分かる範囲で
    if (located) return out("shot", firstOver(qd.q, pkD.i, qd.med + P.LOCATE_K * qd.lowSpread * 0.7), C.dWr, { source: "draw", weak: false, unc: P.LOCATED_UNC_MS });
    if (type === "end") return { kind: null, i: tc, reason: "noExit" };
    const pkB = argmax(qb.q, Math.max(from, tc - Math.round(150 / dt)));
    if (pkB.i >= 0 && pkB.v >= Math.max(P.EXIT_MIN, qb.med + P.EXIT_K * qb.lowSpread)) return out("shot", firstOver(qb.q, pkB.i, qb.med + P.LOCATE_K * qb.lowSpread), C.bWr, { source: "bow", weak: true, unc: P.WEAK_UNC_MS });
    return out("shot", tc, null, { source: "none", weak: true, lowering: true, unc: P.LATE_UNC_MS });
  }
  return { kind: null, i: tc, reason: strong ? "unobservedAfter" : "noExit" };
}

/* 6. アンカーに入った時刻と引き始め */
function anchorStart(sig, relI, hold, noise, still) {
  const { dt } = sig, far = Math.max(P.ANCHOR_FAR, 2 * P.ANCHOR_K * noise), need = Math.max(2, Math.round(P.SETTLE_MS / dt));
  const dv = (j) => Math.hypot(sig.ps.x[j] - hold.x, sig.ps.y[j] - hold.y);
  // 1) 離れからさかのぼり、保持位置から far より遠かった最後の時刻を探す（短い外れは無視）
  let i = Math.round(relI - P.REF_TO_MS / dt), lastFar = 0, run = 0;
  const bridge = Math.round(P.ANCHOR_BRIDGE_MS / dt);
  for (; i >= 0; i--) {
    if (dv(i) > far || !Number.isFinite(dv(i))) { if (++run > bridge) { lastFar = i + run; break; } } else run = 0;
  }
  // 2) そこから先で、手の速さが still を下回り続けた最初の時刻
  let cnt = 0;
  for (let j = lastFar; j < relI; j++) {
    cnt = sig.vs[j] < still ? cnt + 1 : 0;
    if (cnt >= need) return j - need + 1;
  }
  return lastFar; // 止まらないまま離した
}
function drawStart(sig, aI, dHold) {
  const lo = Math.max(0, Math.round(aI - 4000 / sig.dt));
  let rest = Infinity;
  for (let i = lo; i <= aI; i++) if (sig.ds[i] < rest) rest = sig.ds[i];
  const th = rest + 0.15 * (dHold - rest);
  for (let i = Math.round(aI); i >= lo; i--) if (sig.ds[i] <= th) return i;
  return lo;
}

/* 7. 射ごとの特徴（保持の窓の中央値と、ブロック中央値から出す標準誤差） */
function shotFeatures(sig, relI, aI, hd) {
  const { dt, n, C } = sig;
  let [w0, w1] = winIdx(relI, -P.FEAT_FROM_MS, -P.FEAT_TO_MS, dt, n);
  w0 = Math.max(w0, Math.min(Math.ceil(aI), w1 - Math.round(200 / dt)));
  const series = {
    ext: (i) => sig.d[i],
    ancY: (i) => C.dWr.y[i] - C.nose.y[i],
    ancX: (i) => C.dWr.x[i] - C.nose.x[i],
    bowElev: (i) => (Math.atan2(C.bWr.y[i] - C.bSh.y[i], C.bWr.x[i] - C.bSh.x[i]) * 180) / Math.PI,
    shTilt: (i) => (Math.atan2(C.bSh.y[i] - C.dSh.y[i], C.bSh.x[i] - C.dSh.x[i]) * 180) / Math.PI,
    elbAng: (i) => {
      const ax = C.dWr.x[i] - C.bWr.x[i], ay = C.dWr.y[i] - C.bWr.y[i], bx = C.dEl.x[i] - C.dWr.x[i], by = C.dEl.y[i] - C.dWr.y[i];
      return (-Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180) / Math.PI; // 肘が矢の線より上なら正
    },
    headX: (i) => C.nose.x[i],
    headY: (i) => C.nose.y[i],
    lean: (i) => (Math.atan2(-C.hipMid.x[i], -C.hipMid.y[i]) * 180) / Math.PI,
    armLen: (i) => Math.hypot(C.bWr.x[i] - C.bSh.x[i], C.bWr.y[i] - C.bSh.y[i]),
    shWidth: (i) => Math.hypot(C.bSh.x[i] - C.dSh.x[i], C.bSh.y[i] - C.dSh.y[i]),
  };
  const f = {}, wins = {};
  const W = w1 - w0 + 1, aLim = Math.ceil(aI + P.FEAT_SETTLE_MS / dt);
  for (const k of Object.keys(series)) {
    // 同じ幅の窓を、離れから保持の始めへ向かって並べる。先頭（離れの直前）がその射の値
    wins[k] = [];
    for (let hi = w1; hi - W + 1 >= Math.min(w0, aLim) && wins[k].length < P.FEAT_WINS_MAX; hi -= W) {
      const ok = [];
      for (let i = hi - W + 1; i <= hi; i++) { const v = series[k](i); if (Number.isFinite(v)) ok.push(v); }
      if (ok.length < Math.max(3, W * 0.5)) break;
      wins[k].push(median(ok));
    }
    f[k] = wins[k].length ? wins[k][0] : null;
  }
  // 保持の終わりの動き（引き尺の変化）
  const [c0, c1] = winIdx(relI, -210, -60, dt, n), [c2, c3] = winIdx(relI, -700, -550, dt, n);
  f.creep = aI <= c2 ? medS(sig.d, c0, c1) - medS(sig.d, c2, c3) : null;
  // 離れのあと
  const hb = medPt(C.bWr, w0, w1), ux = hd.x - (hb ? hb.x : 0), uy = hd.y - (hb ? hb.y : 0), ul = Math.hypot(ux, uy) || 1;
  const [r0, r1] = winIdx(relI, 150, 350, dt, n), pd = medPt(C.dWr, r0, r1);
  f.relBack = pd ? ((pd.x - hd.x) * ux + (pd.y - hd.y) * uy) / ul : null;
  f.relDy = pd ? pd.y - hd.y : null;
  const [b0, b1] = winIdx(relI, 250, 450, dt, n), pb = medPt(C.bWr, b0, b1);
  f.bowDy = pb && hb ? pb.y - hb.y : null;
  // 弓手を上げていた時間
  let fol = null;
  if (hb) for (let i = Math.round(relI); i < n; i++) if (Number.isFinite(C.bWr.y[i]) && C.bWr.y[i] < hb.y - 0.25) { fol = (i - relI) * dt; break; }
  f.followMs = fol;
  return { f, wins };
}

function analyze(frames, opts) {
  const o = Object.assign({ frame: { w: 1280, h: 720 }, handedness: "right", fps: 30 }, opts || {});
  const pk = packFrames(frames || [], o);
  const quality = { frames: pk.t.length, coverage: pk.coverage, warnings: [], candidates: [] };
  if (pk.t.length < 10) return (quality.warnings.push("tooShort"), { shots: [], quality });
  const rs = resample(pk, o.fps), sig = buildSignals(rs), { dt, n, C } = sig;
  Object.assign(quality, { fps: 1000 / dt, durationMs: n * dt, scalePx: sig.T0, dir: sig.dir });
  if (!Number.isFinite(sig.T0)) return (quality.warnings.push("noBody"), { shots: [], quality });
  const calm = Array.from(sig.vs).filter(Number.isFinite);
  const still = Math.min(P.STILL_MAX, Math.max(P.STILL_MIN, P.STILL_K * pct(calm, 0.2)));
  const tOf = (i) => sig.t0 + i * dt;
  let level = NaN, shots = [], followMed = NaN;
  for (let pass = 0; pass < 2; pass++) {
    const dr = drawnRuns(sig, level, still);
    quality.drawLevel = dr.level;
    shots = [];
    quality.candidates = [];
    let lastEvt = -Infinity;
    for (const [s, e] of dr.runs) {
      // 手が止まった最初の位置
      let is = -1, cnt = 0;
      const need = Math.max(2, Math.round(P.SETTLE_MS / dt));
      for (let i = s; i <= e; i++) {
        cnt = sig.vs[i] < still ? cnt + 1 : 0;
        if (cnt >= need) { is = i - need + 1; break; }
      }
      if (is < 0) is = s;
      const ri = dr.runs.indexOf(dr.runs.find((r) => r[0] === s));
      const nextStart = ri + 1 < dr.runs.length ? dr.runs[ri + 1][0] : n;
      const ev = terminalEvent(sig, is, e, nextStart);
      if (!ev) { quality.candidates.push({ tMs: tOf(e), reason: "noExit" }); continue; }
      if (!ev.kind) { quality.candidates.push({ tMs: tOf(ev.i), reason: ev.reason }); continue; }
      if (ev.lowering) ev.t -= (Number.isFinite(followMed) ? followMed : P.FOLLOW_DEFAULT_MS) / dt;
      const relT = tOf(ev.t);
      if (relT - lastEvt < P.REFRACTORY_MS) continue;
      lastEvt = relT;
      const aI = anchorStart(sig, ev.t, ev.R.hd, ev.R.devMad, still);
      const dI = drawStart(sig, aI, ev.R.dHold);
      const ft = shotFeatures(sig, ev.t, aI, ev.R.hd);
      const conf = ev.kind === "letdown" ? 0.8 : ev.weak ? 0.4 : ev.unc >= P.LOCATED_UNC_MS ? 0.6 : Math.min(1, 0.7 + 0.03 * (ev.score - P.EXIT_K));
      shots.push({
        releaseMs: relT, anchorStartMs: tOf(aI), holdMs: relT - tOf(aI), kind: ev.kind,
        drawStartMs: tOf(dI), drawMs: tOf(aI) - tOf(dI), releaseUncMs: ev.unc, confidence: conf, source: ev.source, weak: ev.weak, late: !!ev.lowering,
        features: ft.f, wins: ft.wins, kindScore: ev.score,
      });
    }
    followMed = median(shots.filter((x) => x.kind === "shot" && !x.weak).map((x) => x.features.followMs));
    // 2 周目は、腕を下ろす動きで気づいた射の時刻を、この回の「弓手を上げていた時間」でさかのぼらせるためだけに回す
    if (pass === 1 || !shots.some((x) => x.late) || !Number.isFinite(followMed)) break;
    level = dr.level;
  }
  const real = shots.filter((x) => x.kind === "shot");
  const ns = captureNoise(real);
  quality.noise = ns.noise;
  quality.noiseDf = ns.df;
  quality.view = { rho: median(real.map((x) => x.features.armLen)), omega: median(real.map((x) => x.features.shWidth)) };
  quality.still = still;
  return { shots, quality };
}

/* 8. 測定のゆれ: 保持の中で隣り合う窓の中央値の差から（間隔 1〜NOISE_LAGS のうち最大。Allan 分散の形）。
   保持中の本当の動きも含むので、ゆれを大きめに見積もる側に倒れる。 */
function captureNoise(real) {
  const noise = {}, df = {};
  if (!real.length) return { noise, df };
  for (const k of Object.keys(real[0].wins)) {
    let best = NaN, bestN = 0;
    for (let lag = 1; lag <= P.NOISE_LAGS; lag++) {
      let ss = 0, c = 0;
      for (const s of real) for (let j = 0; j + lag < s.wins[k].length; j++) { const d = s.wins[k][j + lag] - s.wins[k][j]; ss += d * d; c++; }
      if (c >= 4) { const v = Math.sqrt(ss / c / 2); if (!(v <= best)) { best = v; bestN = c; } }
    }
    noise[k] = Number.isFinite(best) ? best : null;
    df[k] = bestN;
  }
  return { noise, df };
}

/* 9. 射どうしの比較: 測定のゆれより大きい違いだけを返す */
function tCrit(p, nu) { // 両側 p の t 分布の分位点（Cornish–Fisher 展開）
  const z = zq(1 - p / 2), g1 = (z ** 3 + z) / 4, g2 = (5 * z ** 5 + 16 * z ** 3 + 3 * z) / 96, g3 = (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / 384;
  return z + g1 / nu + g2 / nu ** 2 + g3 / nu ** 3;
}
function zq(p) { // Acklam の近似
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = p < 0.5 ? p : 1 - p;
  let x;
  if (q < 0.02425) { const r = Math.sqrt(-2 * Math.log(q)); x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1); }
  else { const r = (q - 0.5) * (q - 0.5), s = q - 0.5; x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * s) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  return p < 0.5 ? x : -x;
}
const FLOORS = { ext: 0.03, ancY: 0.03, ancX: 0.03, bowElev: 2, shTilt: 2, elbAng: 4, headX: 0.03, headY: 0.03, lean: 1.5 };
function compareShots(result, opts) {
  const keys = (opts && opts.keys) || Object.keys(FLOORS), alpha = (opts && opts.alpha) || 0.05;
  const real = result.shots.filter((s) => s.kind === "shot"), n = real.length, out = { n, features: {}, flags: [] };
  if (n < 4) return out;
  const pEach = 1 - Math.pow(1 - alpha, 1 / (n * keys.length)); // Šidák: 回全体での誤りを alpha に抑える
  for (const k of keys) {
    const vals = real.map((s) => s.features[k]), sigma = result.quality.noise[k], nu = result.quality.noiseDf[k];
    if (vals.some((v) => !Number.isFinite(v)) || !Number.isFinite(sigma) || !(nu >= 6)) continue;
    const crit = tCrit(pEach, Math.min(nu, 60)), spread = sd(vals), u = sigma * Math.sqrt(1 + Math.PI / 2 / (n - 1));
    out.features[k] = { median: median(vals), spread, noise: sigma, trueSpread: Math.sqrt(Math.max(0, spread * spread - sigma * sigma)), crit, limit: Math.max(crit * u, FLOORS[k]) };
    real.forEach((s, i) => {
      const delta = vals[i] - median(vals.filter((_, j) => j !== i));
      if (Math.abs(delta) > crit * u && Math.abs(delta) > FLOORS[k]) out.flags.push({ shot: i, key: k, delta, u, ratio: Math.abs(delta) / u });
    });
  }
  return out;
}

module.exports = { _qStat: qStat, analyze, compareShots, captureNoise, packFrames, resample, buildSignals, drawnRuns, P };
