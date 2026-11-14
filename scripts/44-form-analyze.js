"use strict";
/* 射型の記録 v2 — 撮影のあとに、1回ぶんのランドマークの列をまとめて解析する純関数。
   仕様: docs/design/form-v2/algorithm.md（章番号はこの文書のもの）。設計: docs/design/form-v2/design.md。

   契約:
     FormAnalyze.analyze(frames, { frame: { w, h }, handedness, fps }) -> { shots, candidates, quality }
     frames = [{ tMs, landmarks: [33 x { x, y, z, visibility }] | null }]
   - shots には、離れの位置がはっきり決まった射（kind "shot"）と引き戻し（kind "letdown"）だけが入る。
   - 引いて保持したが、離れがはっきり写らなかったものは candidates に分けて返す（射数には入れない）。
   - DOM・db・時計・乱数を使わない。入力を書き換えない。同じ入力には同じ出力。例外を投げない。
   - まだ撮影の画面からは呼ばれない（段 1〜2）。いまの検出器は 46-form-core.js のまま。
   グローバルは FormAnalyze の 1 つだけ。Node からは tools/form-analyze-loader.js で読む。 */
const FormAnalyze = (() => {
  const VERSION = 1; // 数え方や定義を変えたら上げる（記録の v2.av）

  const P = Object.freeze({
    V_MIN: 0.3, // 点を使う visibility の下限
    GAP_FILL_MS: 200, // これ以下の欠測は線形補間する
    SCALE_WIN_MS: 2000, // 胴の長さの移動中央値の幅
    HAMPEL_HALF: 2, // 外れ点除去の半幅（標本）
    HAMPEL_K: 3, // 中央値から MAD の何倍離れたら外れ点か
    SMOOTH_MED_MS: 100, // 特徴用の平滑（中央値 → 平均）
    SMOOTH_AVG_MS: 160,
    VIS_BLOCK_MS: 1000, // visibility の基準を取る区切り
    VIS_DIP_MIN: 0.15, // その点のふだんの visibility からこれ以上落ちたら使わない
    VIS_DIP_K: 3, // …または ふだんのゆれ × VIS_DIP_K
    SWAP_JUMP: 0.5, // 手首が 1 コマでこれ以上（胴比）跳んだら、左右の入れ替わりを疑う
    SWAP_REF_MS: 700, // 入れ替わりの判定に使う前後の時間
    SWAP_MAX_FRAMES: 8, // 入れ替わりが続くとみなす最長のコマ数
    IDENTITY_JUMP: 1.0, // 腰の中点が IDENTITY_MS 以内にこれ以上（胴比）動いたら、別人・切り替わり
    IDENTITY_MS: 200,
    G1_LO: -0.45, // 弓手の手首の高さ − 弓手の肩の高さ（胴比、上が正）
    G1_HI: 0.7,
    G2_LO: -0.65, // 引き手の手首の高さ − 鼻の高さ（胴比、上が正）
    G2_HI: 0.3,
    G3_LO: -1.1, // 引き手の手首の x − 鼻の x（胴比、弓の向きが正）。腕を後ろへ伸ばした姿（ストレッチ）を除く
    G3_HI: 0.25, // 同じ量の上限。顔まで引いてきたか
    D_MIN: 0.55, // 引き尺（手首間の距離）の絶対下限（胴比）
    D_FRAC: 0.8, // 引いている区間のしきい値 = D_FRAC × 保持の水準
    LEVEL_BIN: 0.05, // 保持の水準を探すヒストグラムの幅（胴比）
    LEVEL_MASS: 0.25, // いちばん大きいかたまりの何割あれば「十分な時間」とするか
    LEVEL_REL: 0.55, // いちばん高いかたまりの何倍以上を保持の候補とするか
    RUN_BRIDGE_MS: 700, // 引いている区間・終わり方の判定で、これ以下の途切れ（欠測、ゆれ）はつなぐ
    RUN_MIN_MS: 300, // これより短い区間は捨てる
    RUN_JOIN_MS: 1500, // 弓手を上げたまま、これ以下の間をおいて続く区間はつなぐ
    STILL_MIN: 0.2, // 静止とみなす速さの下限と上限（胴/秒）
    STILL_MAX: 0.8,
    STILL_K: 3, // 静止の速さ = STILL_K × 速さの 20% 点
    SETTLE_MS: 150, // この時間、静止が続いたら「手が止まった」
    SETTLE_FRAC: 0.93, // 「手が止まった」とみなすのは、引き尺が保持の水準のこの割合に届いてから
    PRE_TO_MS: 60, // 離れ・変わり目の直前のこの時間は、保持の値に入れない（動き始めを混ぜない）
    PRE_MIN_MS: 150, // 手が止まってから、離れを探し始めるまでの最短
    POST_FROM_MS: 80, // 変わり目の直後のこの時間は、離れたあとの値に入れない
    EXIT_MIN: 0.05, // 離れとみなす段差の下限（胴比。胴 50cm なら 2.5cm）
    EXIT_K: 6, // 離れの段差が、その保持のゆれの幅の何倍あれば「はっきりした離れ」か
    SHORTH_FRAC: 0.35, // ゆれのかたまりを取り出す区間の割合
    STEP_NOISE_MIN: 0.004, // 段差のゆれの幅の下限（胴比）
    LOCATE_K: 5, // 腕を下ろして終わった保持（射の証拠がある）で、離れの段差として採る下限（ゆれの幅の倍数）
    EXIT_J: 4, // 変わり目での急な動きの下限（ゆれの幅の倍数）
    LOCATE_J: 2.5, // 同じく、腕を下ろして終わった保持での下限
    CP_HEAD_FRAC: 0.4, // 変化点の最初の見積もりで、保持の位置を取る範囲（始めからこの割合）
    CP_TAIL_MS: 400, // 同じく、終わりぎわの位置を取る長さ
    CP_SEG_MS: 1500, // 2 回目以降、変わり目の前後で位置を取る長さ
    JUMP_NEAR_MS: 50, // 急な動きを測る窓 = 前後の [JUMP_NEAR, JUMP_FAR]
    JUMP_FAR_MS: 220,
    JUMP_LAG_MS: 60, // 動き始めから、急な動きの中ほどまで
    ELBOW_DROP: 0.25, // 弓手の肘がこれだけ下がれば「下ろし始めた」（手首の ARM_DROP に当たる量）
    ARM_ONSET: 0.27, // 腕を下ろし始めた所 = 直前の高さから、「下ろした」とみなす量のこの割合だけ下がった所
    BODY_JUMP: 0.2, // 変わり目の前後で、鼻・腰がこれ以上（胴比）動いていたら、離れではない
    BODY_PRE_MS: 400, // その前後の窓の長さ
    SCALE_JUMP: 0.15, // 同じく、体の大きさ（胴の長さ）の変化の割合
    LOWER_GUARD_MS: 150, // 変わり目が、腕を下ろし始めた所のこれより手前に無ければ、離れとは認めない
    LOWER_TAIL_MS: 200, // 離れを探す範囲を、腕を下ろし始めた所からこれだけ先まで延ばす
    LETDOWN_FWD: 0.25, // 腕を下ろした時点で、引き手が保持位置よりこれだけ前にあれば引き戻し
    ONSET_BACK_MS: 1200, // 終わり方の時刻から、下ろし始めをさかのぼって探す最長の時間
    LOOK_MS: 2500, // 区間の終わりのあと、終わり方を見る最長の時間
    HOLD0_MS: 1000, // 保持の始めの水準とゆれを取る長さ
    MACRO_K: 5, // 終わり方のしきい値 = max(固定の下限, 保持の始めのゆれ × MACRO_K)
    SUSTAIN_MS: 300, // 終わり方の条件が続くべき時間
    CLOSE_GUARD_MS: 150, // 近づき始める直前のこの時間は、離れを探さない
    CLOSE_FRAC: 0.3, // 手首間の距離がこの割合だけ縮めば「近づいた」
    ARM_DROP: 0.45, // 弓手の手首がこれだけ下がれば「下ろし始めた」（胴比）
    WEAK_UNC_MS: 150, // 離れがはっきりしない候補・引き戻しの時刻の不確かさ
    LATE_UNC_MS: 500, // 離れの見当が付かない候補の時刻の不確かさ
    FIT_BEFORE_MS: 350, // 動き始めの当てはめに使う範囲（変わり目の前後）
    FIT_AFTER_MS: 300,
    FIT_DEFAULT_MS: 50, // 当てはめられないときの、変わり目から動き始めまでの見込み
    FIT_EARLY_MS: 100, // 動き始めを探す範囲 = [変わり目の 1 コマ前 − FIT_EARLY, 変わり目]
    FIT_TAUS: Object.freeze([15, 25, 35, 50, 70]), // 離れの動きの時定数の候補（ms）
    FIT_TAU_TYP: 30, // ふつうの値（決め手が無いときに寄せる先）
    FIT_TAU_FLAT: 1, // 残差が最小の (1 + FIT_TAU_FLAT) 倍までの長さは、決め手が無いとみなす
    FIT_FLAT: 0.05, // 動きの中ほどは、残差が最小の (1 + FIT_FLAT) 倍までを同じ良さとみなし、その幅の中ほどを取る
    ELBOW_UNC_MS: 40, // 肘で決めた離れの時刻の不確かさの下限
    GAP_MIN_MS: 100, // これより短い欠測は、動き始めの時刻に影響させない
    GAP_ONSET_MS: 40, // 動き始めが欠測の中にあるとき、欠測の始まりからこれだけあとを時刻にする（欠測の半分まで）
    ANCHOR_LEVEL: 0.85, // アンカーの境目 = 引き尺が「引く前 → 保持」のこの割合に届いた所
    ANCHOR_CAP: 1, // 1 コマの寄与の上限（保持の水準と境目の水準の差の倍数）
    ANCHOR_STOP_MS: 500, // 累積和が最大からこれだけ（上限 × ms）下がったら、さかのぼるのをやめる
    ANCHOR_BACK_MS: 12000, // さかのぼる最長の時間
    DRAW_FIT_BACK_MS: 4000, // 引きの形を当てはめる範囲（境目の前後）
    DRAW_FIT_FWD_MS: 900,
    DRAW_BASE_MS: 400, // 引く前の水準を取る長さ
    DRAW_FIT_RMS: 0.12, // 当てはめの残差（引きの振れ幅に対する比）がこれを超えたら使わない
    SETTLE_WAIT_MS: 400, // 境目のあと、手が止まるのを待つ最長の時間
    REFRACTORY_MS: 1500, // 事象どうしの最短の間隔
    FEAT_FROM_MS: 600, // 特徴の窓 = 離れの [FEAT_FROM, FEAT_TO] 前
    FEAT_TO_MS: 60,
    FEAT_SETTLE_MS: 200, // アンカーに入ってからこの時間は、ゆれの見積もりに使わない
    FEAT_WINS_MAX: 8, // 1 射で使う窓の数の上限
    NOISE_LAGS: 3, // 窓どうしの差を取る間隔の上限
    TPL_BEFORE_MS: 2000, // 型の範囲 = 離れの [−TPL_BEFORE, +TPL_AFTER]
    TPL_AFTER_MS: 600,
    TPL_MIN_SHOTS: 3, // 型を作るのに要る、はっきりした射の数
    TPL_BOUND: 1.5, // 「射らしい」とみなす距離 = はっきりした射の距離の最大 × TPL_BOUND
    TPL_COVER: 0.5, // 型の長さのうち、見えていなければならない割合
    POSE_REL_FROM_MS: 150, // 離れのあとの姿を取る窓
    POSE_REL_TO_MS: 350,
    STEEP_DEG: 25, // 弓手の腕の仰角（射の中央値）がこれ以上なら warnings に "steep"（G1 の上限に近い）
    RHO_REF: 1.15, // 真横での「弓手の腕 / 胴」の目安（体節比。6 章）
  });

  const IDX = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24 };
  const ROLES = ["nose", "bSh", "dSh", "bEl", "dEl", "bWr", "dWr", "bHip", "dHip"];
  const ARM_PAIRS = [["bSh", "dSh"], ["bEl", "dEl"], ["bWr", "dWr"]];
  const fin = Number.isFinite;
  const SHORTH_WIDTH = 0.908; // 正規分布で、35% を含むいちばん短い区間の幅 / 標準偏差（2 × 0.454）

  /* ---- 小さな統計 ---- */
  let _buf = new Float64Array(256);
  const scratch = n => (_buf.length >= n ? _buf : (_buf = new Float64Array(Math.max(n, _buf.length * 2))));
  const sortedMedian = (b, c) => {
    if (!c) return NaN;
    const v = b.subarray(0, c).sort();
    const m = c >> 1;
    return c % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  /* a[lo..hi] の有効な値の中央値 */
  function medRange(a, lo, hi) {
    if (hi < lo) return NaN;
    const b = scratch(hi - lo + 1);
    let c = 0;
    for (let i = lo; i <= hi; i++) if (fin(a[i])) b[c++] = a[i];
    return sortedMedian(b, c);
  }
  function median(arr) {
    const b = scratch(arr.length);
    let c = 0;
    for (let i = 0; i < arr.length; i++) if (fin(arr[i])) b[c++] = arr[i];
    return sortedMedian(b, c);
  }
  function mad(arr, center) {
    const m = center === undefined ? median(arr) : center;
    if (!fin(m)) return NaN;
    const d = [];
    for (let i = 0; i < arr.length; i++) if (fin(arr[i])) d.push(Math.abs(arr[i] - m));
    return 1.4826 * median(d);
  }
  function pct(arr, q) {
    const v = [];
    for (let i = 0; i < arr.length; i++) if (fin(arr[i])) v.push(arr[i]);
    if (!v.length) return NaN;
    v.sort((x, y) => x - y);
    const p = (v.length - 1) * q, i = Math.floor(p);
    return v[i] + (v[Math.min(i + 1, v.length - 1)] - v[i]) * (p - i);
  }
  function sd(arr) {
    const v = arr.filter(fin);
    if (v.length < 2) return NaN;
    const m = v.reduce((s, x) => s + x, 0) / v.length;
    return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (v.length - 1));
  }
  const nanArray = n => new Float64Array(n).fill(NaN);
  /* 離れの動きの形: 止まっていた手に、時刻 0 から力がかかる（臨界減衰の 2 次の応答）。0 → 1。s = 経過時間 / 時定数 */
  const releaseShape = s => (s <= 0 ? 0 : 1 - (1 + s) * Math.exp(-s));
  /* 止まった所から止まった所へのなめらかな動き（最小躍度。Flash & Hogan 1985）: 0 → 1 */
  const minJerk = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));
  /* 値のかたまりの中心と幅: 全体の SHORTH_FRAC を含むいちばん短い区間（shorth）。
     離れの段差のように片側へ大きく外れた値が半分近く混じっても、保持のゆれのかたまりを取り出せる。
     幅は、正規分布なら標準偏差になるように直す。 */
  function shorth(vals) {
    const v = vals.filter(fin).sort((x, y) => x - y), n = v.length, k = Math.max(2, Math.ceil(n * P.SHORTH_FRAC));
    if (n < 3) return { center: NaN, scale: NaN };
    let bi = 0, bw = Infinity;
    for (let i = 0; i + k - 1 < n; i++) { const w = v[i + k - 1] - v[i]; if (w < bw) { bw = w; bi = i; } }
    const m = bi + ((k - 1) >> 1);
    return { center: k % 2 ? v[m] : (v[m] + v[m + 1]) / 2, scale: bw / SHORTH_WIDTH };
  }

  /* ---- 3.1 取り込み ---- */
  function roleMap(handedness) {
    return handedness === "left"
      ? { nose: IDX.nose, bSh: IDX.rSh, dSh: IDX.lSh, bEl: IDX.rEl, dEl: IDX.lEl, bWr: IDX.rWr, dWr: IDX.lWr, bHip: IDX.rHip, dHip: IDX.lHip }
      : { nose: IDX.nose, bSh: IDX.lSh, dSh: IDX.rSh, bEl: IDX.lEl, dEl: IDX.rEl, bWr: IDX.lWr, dWr: IDX.rWr, bHip: IDX.lHip, dHip: IDX.rHip };
  }
  /* frames → 時刻順・重複なしの 9 点（正方形の画素）。pts[役割] = { x, y, v }。使えない点は x = y = NaN */
  function packFrames(frames, opts) {
    const o = opts || {}, fr = o.frame || {}, w = fr.w > 0 ? fr.w : 1280, h = fr.h > 0 ? fr.h : 720, map = roleMap(o.handedness);
    const src = [];
    if (Array.isArray(frames)) for (const f of frames) if (f && fin(f.tMs)) src.push(f);
    src.sort((a, b) => a.tMs - b.tMs);
    const keep = [];
    let last = -Infinity;
    for (const f of src) if (f.tMs > last) { keep.push(f); last = f.tMs; }
    const n = keep.length, t = new Float64Array(n), pose = new Uint8Array(n), pts = {};
    for (const r of ROLES) pts[r] = { x: nanArray(n), y: nanArray(n), v: nanArray(n) };
    let nPose = 0;
    for (let i = 0; i < n; i++) {
      const f = keep[i], lm = Array.isArray(f.landmarks) ? f.landmarks : null;
      t[i] = f.tMs;
      if (!lm) continue;
      pose[i] = 1;
      nPose++;
      for (const r of ROLES) {
        const p = lm[map[r]];
        if (!p || !fin(p.x) || !fin(p.y)) continue;
        const vis = p.visibility === undefined || p.visibility === null ? 1 : p.visibility;
        pts[r].v[i] = vis;
        if (vis >= P.V_MIN && p.x > -0.2 && p.x < 1.2 && p.y > -0.2 && p.y < 1.2) {
          pts[r].x[i] = p.x * w;
          pts[r].y[i] = p.y * h;
        }
      }
    }
    return { n, t, pose, pts, coverage: n ? nPose / n : 0 };
  }

  /* 左右の入れ替わり（1〜数コマだけ、腕の左右のラベルが入れ替わる）を元に戻す。
     前後 SWAP_REF_MS の中央値の姿と比べ、入れ替えたほうがずっと近いコマだけを入れ替える。入力は書き換えない。 */
  function repairSwaps(pk) {
    const { n, t, pts } = pk;
    const tor = [];
    for (let i = 0; i < n; i++) {
      const a = pts.bSh, b = pts.dSh, c = pts.bHip, d = pts.dHip;
      const v = Math.hypot((a.x[i] + b.x[i] - c.x[i] - d.x[i]) / 2, (a.y[i] + b.y[i] - c.y[i] - d.y[i]) / 2);
      if (fin(v)) tor.push(v);
    }
    const T0 = median(tor);
    if (!fin(T0) || T0 <= 0) return { pk, swapped: 0 };
    const jump = P.SWAP_JUMP * T0, flagged = [];
    const lastOk = { bWr: -1, dWr: -1 };
    for (let i = 0; i < n; i++) {
      let hit = false;
      for (const r of ["bWr", "dWr"]) {
        const p = pts[r];
        if (!fin(p.x[i])) continue;
        const j = lastOk[r];
        if (j >= 0 && t[i] - t[j] <= P.GAP_FILL_MS && Math.hypot(p.x[i] - p.x[j], p.y[i] - p.y[j]) > jump) hit = true;
        lastOk[r] = i;
      }
      if (hit) flagged.push(i);
    }
    if (!flagged.length) return { pk, swapped: 0 };
    const todo = new Uint8Array(n);
    let checkedTo = -1, swapped = 0;
    for (const j of flagged) {
      if (j <= checkedTo) continue;
      let lo = j, hi = j;
      while (lo > 0 && t[j] - t[lo - 1] <= P.SWAP_REF_MS) lo--;
      while (hi < n - 1 && t[hi + 1] - t[j] <= P.SWAP_REF_MS) hi++;
      const ref = {};
      for (const pair of ARM_PAIRS) for (const r of pair) ref[r] = { x: medRange(pts[r].x, lo, hi), y: medRange(pts[r].y, lo, hi) };
      const end = Math.min(n - 1, j + P.SWAP_MAX_FRAMES - 1);
      for (let k = j; k <= end; k++) {
        let asIs = 0, sw = 0, cnt = 0;
        for (const [a, b] of ARM_PAIRS) {
          const pa = pts[a], pb = pts[b];
          if (!fin(pa.x[k]) || !fin(pb.x[k]) || !fin(ref[a].x) || !fin(ref[b].x)) continue;
          asIs += Math.hypot(pa.x[k] - ref[a].x, pa.y[k] - ref[a].y) + Math.hypot(pb.x[k] - ref[b].x, pb.y[k] - ref[b].y);
          sw += Math.hypot(pb.x[k] - ref[a].x, pb.y[k] - ref[a].y) + Math.hypot(pa.x[k] - ref[b].x, pa.y[k] - ref[b].y);
          cnt++;
        }
        if (cnt >= 2 && sw < 0.5 * asIs && asIs - sw > jump) { todo[k] = 1; swapped++; }
      }
      checkedTo = end;
    }
    if (!swapped) return { pk, swapped: 0 };
    const out = { n, t, pose: pk.pose, coverage: pk.coverage, pts: Object.assign({}, pts) };
    for (const [a, b] of ARM_PAIRS) {
      const A = { x: Float64Array.from(pts[a].x), y: Float64Array.from(pts[a].y), v: Float64Array.from(pts[a].v) };
      const B = { x: Float64Array.from(pts[b].x), y: Float64Array.from(pts[b].y), v: Float64Array.from(pts[b].v) };
      for (let k = 0; k < n; k++) {
        if (!todo[k]) continue;
        for (const ax of ["x", "y", "v"]) { const tmp = A[ax][k]; A[ax][k] = B[ax][k]; B[ax][k] = tmp; }
      }
      out.pts[a] = A;
      out.pts[b] = B;
    }
    return { pk: out, swapped };
  }

  /* ---- 3.2 等間隔にする ---- */
  function resample(pk, fpsHint) {
    const { t } = pk, m = t.length, dts = [];
    for (let i = 1; i < m; i++) dts.push(t[i] - t[i - 1]);
    let dt = median(dts);
    if (!fin(dt)) dt = 1000 / (fpsHint > 0 ? fpsHint : 30);
    dt = Math.min(100, Math.max(1000 / 60, dt));
    const t0 = m ? t[0] : 0, n = m ? Math.floor((t[m - 1] - t0) / dt + 1e-9) + 1 : 0;
    const out = { dt, t0, n, pts: {}, span: {} };
    const maxGap = Math.max(P.GAP_FILL_MS, dt * 1.5);
    for (const r of ROLES) {
      const s = pk.pts[r], X = nanArray(n), Y = nanArray(n), V = nanArray(n), span = new Float64Array(n);
      let j = 0, a = -1;
      const valid = [];
      for (let i = 0; i < m; i++) if (fin(s.x[i]) && fin(s.y[i])) valid.push(i);
      for (let g = 0; g < n; g++) {
        const tg = t0 + g * dt;
        while (j < valid.length && t[valid[j]] <= tg) a = valid[j++];
        const b = j < valid.length ? valid[j] : -1;
        if (a >= 0 && t[a] === tg) { X[g] = s.x[a]; Y[g] = s.y[a]; V[g] = s.v[a]; } else if (a >= 0 && b >= 0 && t[b] - t[a] <= maxGap) {
          const k = (tg - t[a]) / (t[b] - t[a]);
          X[g] = s.x[a] + (s.x[b] - s.x[a]) * k;
          Y[g] = s.y[a] + (s.y[b] - s.y[a]) * k;
          V[g] = s.v[a] + (s.v[b] - s.v[a]) * k;
          span[g] = t[b] - t[a];
        }
      }
      out.pts[r] = { x: X, y: Y, v: V };
      out.span[r] = span;
    }
    return out;
  }

  function hampel(a, half, k) {
    const out = Float64Array.from(a), n = a.length, w = new Float64Array(2 * half + 1), dv = new Float64Array(2 * half + 1);
    for (let i = 0; i < n; i++) {
      if (!fin(a[i])) continue;
      let c = 0;
      for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) if (fin(a[j])) w[c++] = a[j];
      if (c < 3) continue;
      const mm = sortedMedian(w, c);
      for (let j = 0; j < c; j++) dv[j] = Math.abs(w[j] - mm);
      const s = 1.4826 * sortedMedian(dv, c);
      if (s > 0 && Math.abs(a[i] - mm) > k * s) out[i] = mm;
    }
    return out;
  }
  function rollMedian(a, half) {
    const n = a.length, out = nanArray(n);
    for (let i = 0; i < n; i++) out[i] = medRange(a, Math.max(0, i - half), Math.min(n - 1, i + half));
    return out;
  }
  function rollMean(a, half) {
    const n = a.length, out = nanArray(n);
    for (let i = 0; i < n; i++) {
      if (!fin(a[i])) continue;
      let s = 0, c = 0;
      for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) if (fin(a[j])) { s += a[j]; c++; }
      out[i] = s / c;
    }
    return out;
  }
  const smooth = (a, dt) => rollMean(rollMedian(a, Math.max(1, Math.round(P.SMOOTH_MED_MS / dt / 2))), Math.max(1, Math.round(P.SMOOTH_AVG_MS / dt / 2)));

  /* その点のふだんの visibility より大きく落ちたコマ（隠れ・取り違えの印）。前後 1 標本へ広げる */
  function visDips(v, dt) {
    const n = v.length, mask = new Uint8Array(n), blk = Math.max(3, Math.round(P.VIS_BLOCK_MS / dt)), nb = Math.ceil(n / blk), base = nanArray(nb);
    for (let b = 0; b < nb; b++) base[b] = medRange(v, Math.max(0, (b - 1) * blk), Math.min(n - 1, (b + 2) * blk - 1));
    const dev = [];
    for (let i = 0; i < n; i++) if (fin(v[i]) && fin(base[(i / blk) | 0])) dev.push(Math.abs(v[i] - base[(i / blk) | 0]));
    const th = Math.max(P.VIS_DIP_MIN, P.VIS_DIP_K * 1.4826 * median(dev));
    if (!fin(th)) return mask;
    for (let i = 0; i < n; i++) {
      const b = base[(i / blk) | 0];
      if (fin(v[i]) && fin(b) && v[i] < b - th) { mask[i] = 1; if (i > 0) mask[i - 1] = 1; if (i + 1 < n) mask[i + 1] = 2; }
    }
    for (let i = 0; i < n; i++) if (mask[i] === 2 && !(fin(v[i]) && v[i] < base[(i / blk) | 0] - th)) mask[i] = 1;
    return mask;
  }

  /* ---- 3.3 体の単位の信号 ---- */
  function buildSignals(rs) {
    const { n, dt } = rs, pt = {};
    let masked = 0;
    for (const r of ROLES) {
      let x = rs.pts[r].x, y = rs.pts[r].y;
      if (r === "bWr" || r === "dWr") {
        const mk = visDips(rs.pts[r].v, dt);
        x = Float64Array.from(x);
        y = Float64Array.from(y);
        for (let i = 0; i < n; i++) if (mk[i] && fin(x[i])) { x[i] = NaN; y[i] = NaN; if (r === "dWr") masked++; }
      }
      pt[r] = { x: hampel(x, P.HAMPEL_HALF, P.HAMPEL_K), y: hampel(y, P.HAMPEL_HALF, P.HAMPEL_K) };
    }
    const mid = (a, b, ax) => Float64Array.from(pt[a][ax], (v, i) => (v + pt[b][ax][i]) / 2);
    const ms = { x: mid("bSh", "dSh", "x"), y: mid("bSh", "dSh", "y") }, mh = { x: mid("bHip", "dHip", "x"), y: mid("bHip", "dHip", "y") };
    const Traw = Float64Array.from(ms.x, (v, i) => Math.hypot(v - mh.x[i], ms.y[i] - mh.y[i]));
    const T0 = median(Traw);
    const T = rollMedian(Traw, Math.round(P.SCALE_WIN_MS / dt / 2));
    for (let i = 0; i < n; i++) if (!fin(T[i]) || T[i] <= 0) T[i] = T0;
    /* 人の入れ替わり: 腰の中点が短い時間に大きく跳んだ所で区間を切る */
    const cut = new Uint8Array(n), kId = Math.max(1, Math.round(P.IDENTITY_MS / dt));
    let cuts = 0;
    if (fin(T0)) {
      let prev = -1;
      for (let i = 0; i < n; i++) {
        if (!fin(mh.x[i])) continue;
        if (prev >= 0 && i - prev <= kId && Math.hypot(mh.x[i] - mh.x[prev], mh.y[i] - mh.y[prev]) >= P.IDENTITY_JUMP * T0) { cut[i] = 1; cuts++; }
        prev = i;
      }
    }
    const sgn = [];
    for (let i = 0; i < n; i++) { const v = pt.bWr.x[i] - pt.dSh.x[i]; if (Math.abs(v) > 0.6 * T0) sgn.push(v); }
    const dir = !sgn.length || median(sgn) >= 0 ? 1 : -1;
    const C = {};
    for (const r of ROLES) {
      C[r] = {
        x: Float64Array.from(pt[r].x, (v, i) => (dir * (v - ms.x[i])) / T[i]),
        y: Float64Array.from(pt[r].y, (v, i) => -(v - ms.y[i]) / T[i]),
      };
    }
    C.hipMid = { x: Float64Array.from(mh.x, (v, i) => (dir * (v - ms.x[i])) / T[i]), y: Float64Array.from(mh.y, (v, i) => -(v - ms.y[i]) / T[i]) };
    const dist = (a, b) => Float64Array.from(a.x, (v, i) => Math.hypot(v - b.x[i], a.y[i] - b.y[i]));
    const d = dist(C.dWr, C.bWr);
    /* 4.7 補完: 手首が見えず肘が見えているコマは、手首 = 肘 + 「引いているときの 肘→手首」の中央値。
       鼻が見えないコマは、両肩の中点からの高さの中央値。検出にだけ使い、特徴には使わない。 */
    const gate = i => {
      const e = C.bWr.y[i] - C.bSh.y[i], a = C.dWr.y[i] - C.nose.y[i];
      return e >= P.G1_LO && e <= P.G1_HI && a >= P.G2_LO && a <= P.G2_HI;
    };
    const dg = [];
    for (let i = 0; i < n; i++) if (fin(d[i]) && gate(i)) dg.push(d[i]);
    const dHi = Math.max(P.D_MIN, 0.8 * pct(dg, 0.9));
    const fore = { d: { x: [], y: [] }, b: { x: [], y: [] } };
    for (let i = 0; i < n; i++) {
      if (!(d[i] >= dHi) || !gate(i)) continue;
      if (fin(C.dEl.x[i])) { fore.d.x.push(C.dWr.x[i] - C.dEl.x[i]); fore.d.y.push(C.dWr.y[i] - C.dEl.y[i]); }
      if (fin(C.bEl.x[i])) { fore.b.x.push(C.bWr.x[i] - C.bEl.x[i]); fore.b.y.push(C.bWr.y[i] - C.bEl.y[i]); }
    }
    const impute = (wr, el, f) => {
      const fx = median(f.x), fy = median(f.y), out = { x: Float64Array.from(wr.x), y: Float64Array.from(wr.y) };
      let c = 0;
      if (fin(fx) && fin(fy) && f.x.length >= 5) for (let i = 0; i < n; i++) if (!fin(out.x[i]) && fin(el.x[i])) { out.x[i] = el.x[i] + fx; out.y[i] = el.y[i] + fy; c++; }
      return { p: out, count: c };
    };
    const iD = impute(C.dWr, C.dEl, fore.d), iB = impute(C.bWr, C.bEl, fore.b);
    const noseOff = median(C.nose.y), noseY = Float64Array.from(C.nose.y, v => (fin(v) ? v : noseOff));
    const sig = { n, dt, t0: rs.t0, T, T0, dir, C, d, cut, span: rs.span, stats: { masked, imputedDraw: iD.count, imputedBow: iB.count, cuts } };
    sig.I = { dWr: iD.p, bWr: iB.p };
    sig.ds = smooth(dist(iD.p, iB.p), dt);
    sig.es = smooth(Float64Array.from(iB.p.y, (v, i) => v - C.bSh.y[i]), dt);
    sig.ees = smooth(Float64Array.from(C.bEl.y, (v, i) => v - C.bSh.y[i]), dt);
    sig.ays = smooth(Float64Array.from(iD.p.y, (v, i) => v - noseY[i]), dt);
    sig.ps = { x: smooth(iD.p.x, dt), y: smooth(iD.p.y, dt) };
    const noseXs = rollMedian(C.nose.x, Math.round(P.SCALE_WIN_MS / dt / 4));
    sig.axs = Float64Array.from(sig.ps.x, (v, i) => v - noseXs[i]);
    const vs = nanArray(n);
    for (let i = 1; i < n - 1; i++) vs[i] = (Math.hypot(sig.ps.x[i + 1] - sig.ps.x[i - 1], sig.ps.y[i + 1] - sig.ps.y[i - 1]) / (2 * dt)) * 1000;
    sig.vs = vs;
    return sig;
  }

  /* ---- 4.3 保持の水準と、引いている区間 ---- */
  const poseGate = (sig, i) => sig.es[i] >= P.G1_LO && sig.es[i] <= P.G1_HI && sig.ays[i] >= P.G2_LO && sig.ays[i] <= P.G2_HI && sig.axs[i] <= P.G3_HI && sig.axs[i] >= P.G3_LO;
  function holdLevel(sig, still) {
    const vals = [];
    for (let i = 0; i < sig.n; i++) if (poseGate(sig, i) && sig.vs[i] < still && fin(sig.ds[i]) && sig.ds[i] >= P.D_MIN * 0.5) vals.push(sig.ds[i]);
    if (vals.length * sig.dt < 250) return NaN;
    const bin = P.LEVEL_BIN, cnt = new Map();
    for (const v of vals) { const b = Math.floor(v / bin); cnt.set(b, (cnt.get(b) || 0) + 1); }
    const mass = b => (cnt.get(b - 1) || 0) + (cnt.get(b) || 0) + (cnt.get(b + 1) || 0);
    const peaks = [...cnt.keys()].filter(b => mass(b) >= mass(b - 1) && mass(b) >= mass(b + 1)).map(b => ({ b, m: mass(b) }));
    const maxM = Math.max(...peaks.map(q => q.m));
    const big = peaks.filter(q => q.m >= P.LEVEL_MASS * maxM && q.m * sig.dt >= 250 && (q.b + 0.5) * bin >= P.D_MIN);
    if (!big.length) return NaN;
    const top = Math.max(...big.map(q => q.b));
    const hold = Math.min(...big.filter(q => q.b + 0.5 >= P.LEVEL_REL * (top + 0.5)).map(q => q.b));
    return median(vals.filter(v => Math.abs(v - (hold + 0.5) * bin) <= 1.5 * bin));
  }
  function drawnRuns(sig, dLevel, still) {
    const { n, dt } = sig;
    let level = dLevel;
    if (!fin(level)) level = holdLevel(sig, still);
    if (!(level >= P.D_MIN)) return { runs: [], level };
    const th = Math.max(P.D_MIN, P.D_FRAC * level), runs = [], bridge = Math.round(P.RUN_BRIDGE_MS / dt);
    let s = -1, lastOn = -1;
    for (let i = 0; i <= n; i++) {
      const stop = i === n || sig.cut[i];
      const on = !stop && poseGate(sig, i) && sig.ds[i] >= th;
      if (on) {
        if (s < 0) s = i;
        lastOn = i;
      } else if (s >= 0 && (stop || i - lastOn > bridge)) {
        if ((lastOn - s) * dt >= P.RUN_MIN_MS) runs.push([s, lastOn]);
        s = -1;
      }
    }
    /* 弓手を上げたまま、短い間をおいて続く区間は 1 つの保持として扱う（引き手のゆれ・隠れで区間が切れただけ） */
    const join = Math.round(P.RUN_JOIN_MS / dt), merged = [];
    for (const r of runs) {
      const last = merged[merged.length - 1];
      let up = !!last && r[0] - last[1] <= join;
      if (up) {
        let cutHere = false;
        for (let i = last[1]; i <= r[0]; i++) if (sig.cut[i]) cutHere = true;
        const e = medRange(sig.es, last[1], r[0]);
        up = !cutHere && fin(e) && e >= P.G1_LO && e <= P.G1_HI;
      }
      if (up) last[1] = r[1];
      else merged.push([r[0], r[1]]);
    }
    return { runs: merged, level };
  }

  const winIdx = (i, fromMs, toMs, dt, n) => [Math.max(0, Math.round(i + fromMs / dt)), Math.min(n - 1, Math.round(i + toMs / dt))];
  function medPt(c, a, b) {
    if (b < a) return null;
    let k = 0;
    for (let i = a; i <= b; i++) if (fin(c.x[i]) && fin(c.y[i])) k++;
    if (k < 2) return null;
    return { x: medRange(c.x, a, b), y: medRange(c.y, a, b), n: k };
  }

  /* ---- 4.6 離れの位置 ---- */
  /* 保持 [is, to] の中の「変わり目」を 1 つ探す（累積和による変化点の推定）。
     離れのあと、腕を下ろし始めるまで、引き手は保持位置へ戻らない。保持の途中のゆれ・一時的な取り違えは戻る。
     そこで、保持の位置 A と、終わりぎわの位置 B を中央値で決め、各コマが A と B のどちらに近いかを足し上げて、
     「これより前は A、あとは B」がいちばんよく当てはまる位置 c を取る。使う点は chans（引き手の手首・肘）。
     1 コマの寄与は |x − B| − |x − A|（A–B の距離を超えない）を、その点のゆれの幅で割ったもの。見えないコマは 0。 */
  function changePoint(sig, chans, is, from, to, tail0) {
    const { dt } = sig, k60 = Math.round(P.PRE_TO_MS / dt), k100 = Math.round(P.POST_FROM_MS / dt);
    let a0 = is, a1 = is + Math.max(2, Math.round(P.CP_HEAD_FRAC * (to - is))), b0 = Math.max(a1 + 1, tail0), b1 = to, c = -1, lv = null;
    for (let it = 0; it < 3; it++) {
      lv = chans.map(ch => {
        /* 終わりぎわにその点が写っていなければ、写っている所まで窓を前へ広げる */
        let bb = b0, B = medPt(ch, bb, b1);
        while (!B && bb > a1 + 1) { bb = Math.max(a1 + 1, bb - (b1 - b0 + 1)); B = medPt(ch, bb, b1); }
        const A = medPt(ch, a0, a1);
        if (!A || !B) return null;
        const dv = [];
        for (let i = a0; i <= a1; i++) if (fin(ch.x[i]) && fin(ch.y[i])) dv.push(Math.hypot(ch.x[i] - A.x, ch.y[i] - A.y));
        return { A, B, sigma: Math.max(P.STEP_NOISE_MIN, median(dv) / 1.177) };
      });
      if (lv.every(v => !v)) return { c: -1, lv };
      let S = 0, best = -Infinity, bi = -1;
      for (let i = is; i <= to; i++) {
        if (i >= from && S > best) { best = S; bi = i; }
        for (let k = 0; k < chans.length; k++) {
          const v = lv[k], ch = chans[k];
          if (!v || !fin(ch.x[i]) || !fin(ch.y[i])) continue;
          S += (Math.hypot(ch.x[i] - v.B.x, ch.y[i] - v.B.y) - Math.hypot(ch.x[i] - v.A.x, ch.y[i] - v.A.y)) / v.sigma;
        }
      }
      if (bi === c) break;
      c = bi;
      a0 = Math.max(is, c - Math.round(P.CP_SEG_MS / dt));
      a1 = Math.max(a0 + 1, c - k60);
      b0 = Math.min(to - 1, c + k100);
      b1 = Math.min(to, c + Math.round(P.CP_SEG_MS / dt));
    }
    return { c, lv };
  }
  /* 位置 i の前後の短い窓の差（[JUMP_FAR, JUMP_NEAR] ms 前 と 後）。ゆっくりしたずれは前後で打ち消し合うので、
     急な動き（離れ）だけが残る。axis があればその向きへの射影、無ければ距離。 */
  function jumpAt(sig, ch, i, axis) {
    const { dt, n } = sig, k0 = Math.round(P.JUMP_NEAR_MS / dt), k1 = Math.max(k0 + 2, Math.round(P.JUMP_FAR_MS / dt));
    const pre = medPt(ch, Math.max(0, i - k1), i - k0), post = medPt(ch, i + k0 + 1, Math.min(n - 1, i + k1 + 1));
    if (!pre || !post) return NaN;
    return axis ? (post.x - pre.x) * axis.x + (post.y - pre.y) * axis.y : Math.hypot(post.x - pre.x, post.y - pre.y);
  }

  /* 動き始めを 1 コマより細かく（4.6）: 点 ch の、保持の位置 A から終わりぎわの位置 B へ向かう変位に
     「0 → 力がかかって動き出す（releaseShape）→ 1」を当てはめる。動き始め tr と時定数 tau を、残差の二乗和が最小になるように選ぶ。 */
  function onsetFit(sig, ch, span, lv, c) {
    const { dt, n } = sig, ux = lv.B.x - lv.A.x, uy = lv.B.y - lv.A.y, L2 = ux * ux + uy * uy;
    const fail = { t: c - P.FIT_DEFAULT_MS / dt, unc: Math.max(dt, P.WEAK_UNC_MS / 2), ok: false };
    if (!(L2 > 0)) return fail;
    const i0 = Math.max(0, c - Math.round(P.FIT_BEFORE_MS / dt)), i1 = Math.min(n - 1, c + Math.round(P.FIT_AFTER_MS / dt));
    const ts = [], us = [];
    for (let j = i0; j <= i1; j++) {
      if (!fin(ch.x[j]) || !fin(ch.y[j])) continue;
      ts.push(j * dt);
      us.push(((ch.x[j] - lv.A.x) * ux + (ch.y[j] - lv.A.y) * uy) / L2);
    }
    if (us.length < 5) return fail;
    /* 動き始め tr は、変わり目 c（A と B の中ほどを越えたあとの最初のコマ）の少し前にある。[c の 1 コマ前 − FIT_EARLY, c] を細かく探す。
       時定数 tau はコマの間隔が粗いと決まらないので、残差がほとんど同じ候補の中では、ふつうの値 FIT_TAU_TYP に近いものを取る */
    const step = dt / 8, lo = (c - 1) * dt - P.FIT_EARLY_MS, hi = c * dt;
    const sseOf = (tr, tau) => {
      let sse = 0;
      for (let k = 0; k < ts.length; k++) {
        const mdl = releaseShape((ts[k] - tr) / tau);
        sse += (us[k] - mdl) * (us[k] - mdl);
      }
      return sse;
    };
    const perTau = P.FIT_TAUS.map(tau => {
      let bs = Infinity, bt = c * dt;
      for (let tr = lo; tr <= hi; tr += step) { const e = sseOf(tr, tau); if (e < bs) { bs = e; bt = tr; } }
      /* 残差がほとんど同じになる tr が幅を持つときは、その中ほど（端へ寄せない） */
      let t0 = bt, t1 = bt;
      for (let tr = lo; tr <= hi; tr += step) if (sseOf(tr, tau) <= bs * (1 + P.FIT_FLAT) + 1e-12) { if (tr < t0) t0 = tr; if (tr > t1) t1 = tr; }
      return { tau, sse: bs, tr: (t0 + t1) / 2 };
    });
    const minSse = Math.min(...perTau.map(x => x.sse));
    let pick = null;
    for (const x of perTau) if (x.sse <= minSse * (1 + P.FIT_TAU_FLAT) + 1e-12 && (!pick || Math.abs(x.tau - P.FIT_TAU_TYP) < Math.abs(pick.tau - P.FIT_TAU_TYP))) pick = x;
    const best = { tr: pick.tr, tau: pick.tau };
    /* 動き始めの近くで、この点が写っていない（補間した、または欠測のまま）区間 */
    const g = Math.min(n - 1, Math.max(0, Math.round(best.tr / dt))), holeAt = j => j >= 0 && j < n && (!fin(ch.x[j]) || span[j] > 1.5 * dt);
    let h = -1;
    for (const j of [g, g + 1, g - 1, g + 2]) if (h < 0 && holeAt(j)) h = j;
    if (h >= 0) {
      let a = h, b = h;
      while (holeAt(a - 1)) a--;
      while (holeAt(b + 1)) b++;
      const g0 = (a - 1) * dt, g1 = (b + 1) * dt;
      if (g1 - g0 >= Math.max(P.GAP_MIN_MS, 3.5 * dt)) return { t: best.tr / dt, unc: (g1 - g0) / 2, ok: true, hole: [g0, g1] };
    }
    return { t: best.tr / dt, unc: dt / 4, ok: true };
  }
  /* 離れの時刻: 引き手の手首で決める。動き始めに手首が写っていなければ肘で決める（不確かさは大きめ）。
     どちらも写っていない（追跡が切れた）なら、動き始めはその欠測の中にある。追跡は離れの速い動きで切れることが多いので、
     時刻は欠測の始まり寄りに置き、欠測の幅の半分を不確かさにする。 */
  function releaseTime(sig, W, E, c) {
    const { dt } = sig, fits = [];
    if (W) fits.push(onsetFit(sig, sig.C.dWr, sig.span.dWr, W, c));
    if (E) fits.push(onsetFit(sig, sig.C.dEl, sig.span.dEl, E, c));
    const clean = fits.find(f => f.ok && !f.hole);
    if (clean) return { t: clean.t, unc: clean === fits[0] && W ? clean.unc : Math.max(clean.unc, P.ELBOW_UNC_MS) };
    const holes = fits.filter(f => f.ok && f.hole);
    if (!holes.length) return { t: c - P.FIT_DEFAULT_MS / dt, unc: P.WEAK_UNC_MS / 2 };
    const g0 = Math.max(...holes.map(f => f.hole[0])), g1 = Math.min(...holes.map(f => f.hole[1])), width = Math.max(dt, g1 - g0);
    return { t: (g0 + Math.min(width / 2, P.GAP_ONSET_MS)) / dt, unc: Math.max(dt / 4, width / 2), gap: width };
  }

  /* ---- 4.5・4.6 保持の終わり方と、離れ ---- */
  function runEvent(sig, is, runEnd, nextStart) {
    const { dt, n, C } = sig, minPre = Math.round((P.PRE_MIN_MS + P.PRE_TO_MS) / dt), from = is + minPre;
    const lim = Math.min(n - 2, nextStart - 1, runEnd + Math.round(P.LOOK_MS / dt));
    if (from >= lim) return null;
    const h1 = Math.min(runEnd, is + Math.round(P.HOLD0_MS / dt)), D0 = medRange(sig.ds, is, h1), e0 = medRange(sig.es, is, h1), ee0 = medRange(sig.ees, is, h1);
    if (!fin(D0) || !fin(e0)) return null;
    const sp = a => { const v = []; for (let i = is; i <= h1; i++) if (fin(a[i])) v.push(a[i]); return mad(v); };
    const closeTh = Math.max(P.CLOSE_FRAC * D0, P.MACRO_K * sp(sig.ds)), dropTh = Math.max(P.ARM_DROP, P.MACRO_K * sp(sig.es));
    /* 弓手がどれだけ下がったか（1 = 「下ろした」とみなす量）。手首と肘の両方が見えていれば平均する。
       弓手の手首は弓に隠れてゆれやすいので、肘も使う（肘は手首の半分ほど下がる） */
    const sus = Math.round(P.SUSTAIN_MS / dt), dn = nanArray(n);
    for (let j = is; j <= Math.min(n - 1, lim + sus); j++) {
      const a = fin(sig.es[j]) ? (e0 - sig.es[j]) / dropTh : NaN, b = fin(ee0) && fin(sig.ees[j]) ? (ee0 - sig.ees[j]) / P.ELBOW_DROP : NaN;
      dn[j] = fin(a) && fin(b) ? (a + b) / 2 : fin(a) ? a : b;
    }
    /* 終わり方（大きな動きで決める） */
    let tc = lim, type = "end", gap = 0;
    const bridge = Math.round(P.RUN_BRIDGE_MS / dt);
    for (let j = is + Math.round(P.SETTLE_MS / dt); j <= lim; j++) {
      const ds = sig.ds[j];
      if (!fin(ds) || !fin(dn[j]) || sig.cut[j]) { if (sig.cut[j] || ++gap > bridge) { type = "gap"; tc = j - gap; break; } continue; }
      gap = 0;
      const s2 = Math.min(n - 1, j + sus);
      const dropped = dn[j] >= 1 && medRange(dn, j, s2) >= 1;
      if (ds <= D0 - closeTh && medRange(sig.ds, j, s2) <= D0 - closeTh) { type = dropped ? "lower" : "close"; tc = j; break; }
      if (dropped) { type = "lower"; tc = j; break; }
    }
    /* 引きの軸（後ろが正）: 保持の始めの 弓手の手首 → 引き手の手首 */
    const md = medPt(sig.I.dWr, is, h1), mb = medPt(sig.I.bWr, is, h1);
    if (!md || !mb) return null;
    const al = Math.hypot(md.x - mb.x, md.y - mb.y) || 1, axis = { x: (md.x - mb.x) / al, y: (md.y - mb.y) / al };
    /* 腕を下ろし始めた所 / 手首どうしが近づき始めた所 to。離れはこれより前にある */
    let to = Math.min(n - 2, tc);
    const back = Math.round(P.ONSET_BACK_MS / dt);
    if (type === "lower") {
      const rf = medRange(dn, Math.max(is, tc - Math.round(1300 / dt)), Math.max(is, tc - Math.round(500 / dt))), ref = fin(rf) ? rf : 0;
      while (to - 1 >= from && tc - to < back && !(dn[to - 1] <= ref + P.ARM_ONSET)) to--;
    }
    if (type === "close") {
      while (to - 1 >= from && tc - to < back && !(sig.ds[to - 1] >= D0 - closeTh / 3)) to--;
      to -= Math.round(P.CLOSE_GUARD_MS / dt);
    }
    /* 離れを探す範囲の終わり end: 腕を下ろして終わったなら、下ろし始めの少しあとまで（離れてすぐ腕を下ろす人のため） */
    const end = type === "lower" ? Math.min(tc, to + Math.round(P.LOWER_TAIL_MS / dt)) : to;
    const base = { type, tc, axis, D0, is, to };
    if (end - from < 3) return Object.assign(base, { kind: null, reason: "short", t: tc });
    const chans = [C.dWr, C.dEl], cp = changePoint(sig, chans, is, from, end, Math.max(from, Math.min(to, end) - Math.round(P.CP_TAIL_MS / dt)));
    let ev = null;
    if (cp.c >= 0) {
      const W = cp.lv[0], E = cp.lv[1];
      /* 段差の大きさ（保持 → 終わりぎわ）と、変わり目での急な動き */
      const stepW = W ? (W.B.x - W.A.x) * axis.x + (W.B.y - W.A.y) * axis.y : NaN, stepE = E ? Math.hypot(E.B.x - E.A.x, E.B.y - E.A.y) : NaN;
      const useW = fin(stepW) && stepW >= P.EXIT_MIN;
      const o = releaseTime(sig, useW ? W : null, E && stepE >= P.EXIT_MIN ? E : null, cp.c);
      const ti = Math.round(o.t + P.JUMP_LAG_MS / dt);
      const jW = jumpAt(sig, C.dWr, ti, axis), jE = jumpAt(sig, C.dEl, ti, null);
      /* 急な動きのゆれの幅: 同じ量を、変わり目より前の保持の中で測る */
      const nullOf = (ch, ax) => {
        const v = [], lo = is + Math.round(P.JUMP_FAR_MS / dt), hi = cp.c - Math.round((P.JUMP_FAR_MS + 60) / dt);
        for (let i = lo; i <= hi; i++) { const j = jumpAt(sig, ch, i, ax); if (fin(j)) v.push(j); }
        if (v.length < 8) return null;
        const sh = shorth(v);
        return { med: sh.center, s: Math.max(sh.scale, P.STEP_NOISE_MIN) };
      };
      const nW = nullOf(C.dWr, axis), nE = nullOf(C.dEl, null);
      ev = {
        c: cp.c, t: o.t, unc: o.unc, stepW, stepE,
        zLW: W && fin(stepW) ? stepW / W.sigma : NaN, zLE: E && fin(stepE) ? stepE / E.sigma : NaN,
        jW, jE, zJW: nW && fin(jW) ? (jW - nW.med) / nW.s : NaN, zJE: nE && fin(jE) ? (jE - nE.med) / nE.s : NaN,
        sW: W ? W.sigma : NaN, sE: E ? E.sigma : NaN,
      };
      const pos = v => (fin(v) && v > 0 ? v : 0);
      ev.zL = Math.hypot(pos(ev.zLW), pos(ev.zLE));
      ev.zJ = Math.hypot(pos(ev.zJW), pos(ev.zJE));
      /* 引き手の手首が見えているなら、後ろへ動いていること（前へ戻る動き = 引き戻し は離れにしない）。
         段差が残っているか、変わり目で後ろへ急に動いたか（そのあとゆれで戻って見えることがある）のどちらか */
      ev.back = fin(stepW) ? stepW >= P.EXIT_MIN || (jW >= P.EXIT_MIN && ev.zJW >= P.LOCATE_J && stepW > -P.EXIT_MIN) : stepE >= P.EXIT_MIN;
      /* 変わり目が、腕を下ろし始めた所と重なる: 下ろす動きそのものを拾った。離れの位置は分からない */
      if (type === "lower" && cp.c > to - Math.round(P.LOWER_GUARD_MS / dt)) ev.back = false;
      /* 離れでは頭と胴は動かない。同じ時刻に鼻・腰（両肩の中点から見た位置）や体の大きさが大きく変わったなら、
         人の入れ替わり・場面の切り替わり・姿勢推定の取り違えであって、離れではない */
      const pa = Math.max(is, cp.c - Math.round(P.BODY_PRE_MS / dt)), pb = cp.c - Math.round(P.PRE_TO_MS / dt), qa = cp.c + Math.round(P.POST_FROM_MS / dt), qb = Math.min(n - 1, cp.c + Math.round(P.BODY_PRE_MS / dt));
      for (const ch of [C.nose, C.hipMid]) {
        const p0 = medPt(ch, pa, pb), p1 = medPt(ch, qa, qb);
        if (p0 && p1 && Math.hypot(p1.x - p0.x, p1.y - p0.y) >= P.BODY_JUMP) ev.bodyMoved = true;
      }
      const T0 = medRange(sig.T, pa, pb), T1 = medRange(sig.T, qa, qb);
      if (fin(T0) && fin(T1) && Math.abs(T1 / T0 - 1) >= P.SCALE_JUMP) ev.bodyMoved = true;
    }
    Object.assign(base, ev || {});
    if (ev && ev.bodyMoved) return Object.assign(base, { kind: null, reason: "bodyMoved" });
    const clear = ev && ev.back && (type === "lower" ? ev.zL >= P.LOCATE_K && (ev.zJ >= P.LOCATE_J || ev.zL >= P.EXIT_K) : ev.zL >= P.EXIT_K && ev.zJ >= P.EXIT_J);
    if (clear) return Object.assign(base, { kind: "shot", score: ev.zL });
    if (type === "close") {
      let i = tc;
      while (i - 1 >= from && sig.ds[i - 1] < D0 - closeTh / 4) i--;
      return Object.assign(base, { kind: "letdown", t: i, unc: P.WEAK_UNC_MS, score: ev ? ev.zL : 0 });
    }
    if (type === "lower") {
      /* 弓を下ろしながら、引き手を前へ戻した: 引き戻し。射のあとに腕を下ろすときは、引き手は前へ出ない */
      const now = medPt(sig.I.dWr, Math.max(is, tc - 2), Math.min(n - 1, tc + Math.round(200 / dt)));
      if (now && (now.x - md.x) * axis.x + (now.y - md.y) * axis.y <= -P.LETDOWN_FWD) {
        let i = tc;
        while (i - 1 >= from && sig.ds[i - 1] < D0 - closeTh / 4) i--;
        return Object.assign(base, { kind: "letdown", t: i, unc: P.WEAK_UNC_MS, score: ev ? ev.zL : 0 });
      }
    }
    const weak = ev && ev.back && ev.zL >= P.LOCATE_K / 2;
    return Object.assign(base, { kind: null, reason: type === "gap" ? "unobserved" : weak ? "weakRelease" : "noRelease", t: weak ? ev.t : to });
  }

  /* ---- 4.8 アンカーに入った時刻と引き始め ---- */
  function anchorStart(sig, w, relI, is, still) {
    const { dt } = sig, need = Math.max(2, Math.round(P.SETTLE_MS / dt));
    const hi = Math.max(0, Math.round(relI - P.PRE_TO_MS / dt)), lo = Math.max(0, hi - Math.round(P.ANCHOR_BACK_MS / dt));
    /* 引き尺の水準: 保持（手が止まった所 is から離れまで）の中央値と、その前 4 秒の最小値 */
    const dHold = medRange(w, Math.min(is, hi - 2), hi);
    let rest = Infinity;
    for (let i = Math.max(0, is - Math.round(4000 / dt)); i <= is; i++) if (w[i] < rest) rest = w[i];
    if (!fin(dHold) || !fin(rest) || !(dHold - rest > 0.1)) return { a: is, dHold, rest };
    const level = rest + P.ANCHOR_LEVEL * (dHold - rest), cap = P.ANCHOR_CAP * (dHold - level);
    /* 1) 離れからさかのぼり、「ここから先は、引き尺が保持の水準の近くにある」がいちばんよく当てはまる境目を取る（累積和）。
          保持の途中のゆれ・一時的な取り違えでは境目は動かない。 */
    let S = 0, best = 0, a = hi, gapRun = 0;
    for (let i = hi; i >= lo; i--) {
      const v = w[i];
      if (!fin(v)) { if (++gapRun * dt > P.RUN_BRIDGE_MS) break; continue; }
      gapRun = 0;
      S += Math.max(-cap, Math.min(cap, v - level));
      if (S >= best) { best = S; a = i; }
      if (S < best - (P.ANCHOR_STOP_MS / dt) * cap) break;
    }
    /* 2) そこから先で、引き手の速さが still を下回り続けた最初の時刻（SETTLE_WAIT まで）。無ければ境目 */
    let cnt = 0;
    const lim = Math.min(relI, a + Math.round(P.SETTLE_WAIT_MS / dt));
    for (let j = a; j < lim; j++) {
      cnt = sig.vs[j] < still ? cnt + 1 : 0;
      if (cnt >= need) return { a: j - need + 1, dHold, rest };
    }
    return { a, dHold, rest };
  }
  /* 引きの軌道に滑らかな形を当てはめる（4.8）: 引き尺 ds が「引く前の水準 → 最小躍度の立ち上がり → 保持の水準」をたどるとして、
     引き始め t0 と引き終わり t1 を、残差の二乗和が最小になるように選ぶ。速さを差分で測るより、ランドマークのゆれに強い。
     当てはまりが悪い（残差が大きい）ときは null を返し、呼び出し側は境目と速さで決めた時刻を使う。 */
  function fitDraw(sig, w, aI, relI, dHold) {
    const { dt } = sig;
    const i0 = Math.max(0, Math.round(aI - (P.DRAW_FIT_BACK_MS + P.DRAW_BASE_MS) / dt)), i1 = Math.min(Math.round(relI - P.PRE_TO_MS / dt), Math.round(aI + P.DRAW_FIT_FWD_MS / dt));
    if (i1 - i0 < 10) return null;
    /* 引く前の水準 = 引き始めの直前 DRAW_BASE_MS の中央値（引き始めの候補ごとに違う） */
    const kb = Math.max(2, Math.round(P.DRAW_BASE_MS / dt)), baseAt = i => medRange(w, Math.max(i0, i - kb), i);
    let best = { cost: Infinity };
    const scan = (e0, e1, eStep, d0, d1, dStep) => {
      for (let te = e0; te <= e1; te += eStep) {
        for (let dur = d0; dur <= d1; dur += dStep) {
          const s0 = Math.round((te - dur) / dt);
          if (s0 - kb < i0) continue;
          const base = baseAt(s0), A = dHold - base;
          if (!(A > 0.2)) continue;
          let sse = 0, c = 0;
          for (let i = s0 - kb; i <= i1; i++) {
            if (!fin(w[i])) continue;
            const r = (w[i] - base) / A - minJerk((i * dt - (te - dur)) / dur);
            sse += r * r;
            c++;
          }
          if (c >= 10 && sse / c < best.cost) best = { cost: sse / c, te, dur, A };
        }
      }
    };
    const c = aI * dt, eMax = Math.min(c + P.DRAW_FIT_FWD_MS, (relI - 1) * dt);
    scan(c - 300, eMax, 100, 400, P.DRAW_FIT_BACK_MS, 200);
    if (!fin(best.cost)) return null;
    scan(best.te - 100, Math.min(eMax, best.te + 100), 25, Math.max(300, best.dur - 200), best.dur + 200, 50);
    const rms = Math.sqrt(best.cost);
    if (!(rms <= P.DRAW_FIT_RMS)) return null;
    /* 当てはめた形の上で、速さが STILL_MIN を下回る時刻（引き終わりの少し前） */
    let u = 1;
    const vOf = x => (30 * x * x * (1 - x) * (1 - x) * best.A * 1000) / best.dur;
    while (u > 0.5 && vOf(u) < P.STILL_MIN) u -= 0.005;
    return { endI: best.te / dt, startI: (best.te - best.dur) / dt, stillI: (best.te - best.dur + u * best.dur) / dt, rms };
  }
  function drawStart(sig, aI, dHold) {
    const lo = Math.max(0, Math.round(aI - 4000 / sig.dt));
    let rest = Infinity;
    for (let i = lo; i <= aI; i++) if (sig.ds[i] < rest) rest = sig.ds[i];
    const th = rest + 0.15 * (dHold - rest);
    for (let i = Math.round(aI); i >= lo; i--) if (sig.ds[i] <= th) return i;
    return lo;
  }

  /* ---- 5 射ごとの値 ---- */
  const DEG = 180 / Math.PI;
  function featureSeries(sig) {
    const C = sig.C;
    return {
      ext: i => sig.d[i],
      ancY: i => C.dWr.y[i] - C.nose.y[i],
      ancX: i => C.dWr.x[i] - C.nose.x[i],
      bowElev: i => Math.atan2(C.bWr.y[i] - C.bSh.y[i], C.bWr.x[i] - C.bSh.x[i]) * DEG,
      shTilt: i => Math.atan2(C.bSh.y[i] - C.dSh.y[i], C.bSh.x[i] - C.dSh.x[i]) * DEG,
      elbAng: i => {
        const ax = C.dWr.x[i] - C.bWr.x[i], ay = C.dWr.y[i] - C.bWr.y[i], bx = C.dEl.x[i] - C.dWr.x[i], by = C.dEl.y[i] - C.dWr.y[i];
        return -Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * DEG;
      },
      headX: i => C.nose.x[i],
      headY: i => C.nose.y[i],
      lean: i => Math.atan2(-C.hipMid.x[i], -C.hipMid.y[i]) * DEG,
      armLen: i => Math.hypot(C.bWr.x[i] - C.bSh.x[i], C.bWr.y[i] - C.bSh.y[i]),
      shWidth: i => Math.hypot(C.bSh.x[i] - C.dSh.x[i], C.bSh.y[i] - C.dSh.y[i]),
    };
  }
  const FEATURE_KEYS = ["ext", "ancY", "ancX", "bowElev", "shTilt", "elbAng", "headX", "headY", "lean", "armLen", "shWidth"];
  const DEFAULT_KEYS = ["holdMs", "followMs", "bowDy", "relBack", "ancY", "ext"]; // 画面の既定の 6 項目（design.md 3.2）
  function featureWindow(sig, relI, aI) {
    let [w0, w1] = winIdx(relI, -P.FEAT_FROM_MS, -P.FEAT_TO_MS, sig.dt, sig.n);
    w0 = Math.max(w0, Math.min(Math.ceil(aI), w1 - Math.round(200 / sig.dt)));
    return [Math.max(0, w0), w1];
  }
  function shotFeatures(sig, relI, aI) {
    const { dt, n, C } = sig, series = featureSeries(sig), [w0, w1] = featureWindow(sig, relI, aI);
    const f = {}, wins = {}, W = w1 - w0 + 1, aLim = Math.ceil(aI + P.FEAT_SETTLE_MS / dt), b = scratch(Math.max(W, 1));
    for (const k of FEATURE_KEYS) {
      wins[k] = [];
      for (let hi = w1; hi - W + 1 >= Math.min(w0, aLim) && hi - W + 1 >= 0 && wins[k].length < P.FEAT_WINS_MAX; hi -= W) {
        let c = 0;
        for (let i = hi - W + 1; i <= hi; i++) { const v = series[k](i); if (fin(v)) b[c++] = v; }
        if (c < Math.max(3, W * 0.5)) break;
        wins[k].push(sortedMedian(b, c));
      }
      f[k] = wins[k].length ? wins[k][0] : null;
    }
    const [c0, c1] = winIdx(relI, -210, -60, dt, n), [c2, c3] = winIdx(relI, -700, -550, dt, n);
    const cr = aI <= c2 ? medRange(sig.d, c0, c1) - medRange(sig.d, c2, c3) : NaN;
    f.creep = fin(cr) ? cr : null;
    const hd = medPt(C.dWr, w0, w1), hb = medPt(C.bWr, w0, w1);
    f.relBack = null;
    f.relDy = null;
    f.bowDy = null;
    f.followMs = null;
    if (hd && hb) {
      const ux = hd.x - hb.x, uy = hd.y - hb.y, ul = Math.hypot(ux, uy) || 1;
      const [r0, r1] = winIdx(relI, 150, 350, dt, n), pd = medPt(C.dWr, r0, r1);
      if (pd) { f.relBack = ((pd.x - hd.x) * ux + (pd.y - hd.y) * uy) / ul; f.relDy = pd.y - hd.y; }
    }
    if (hb) {
      const [b0, b1] = winIdx(relI, 250, 450, dt, n), pb = medPt(C.bWr, b0, b1);
      if (pb) f.bowDy = pb.y - hb.y;
      /* 弓手を上げていた時間: 平滑した弓手の手首が、保持の高さより 0.25 下がるまで */
      const eh = medRange(sig.es, w0, w1);
      if (fin(eh)) for (let i = Math.round(relI); i < n; i++) if (fin(sig.es[i]) && sig.es[i] < eh - 0.25) { f.followMs = (i - relI) * dt; break; }
    }
    return { f, wins, w0, w1 };
  }
  /* 重ね図用の姿: 9 点 ×（x, y）、正準座標（原点 = 両肩の中点、弓の向きが x 正、上が y 正）、0.01 胴の整数。見えない点は null */
  function poseAt(sig, a, b) {
    const out = [];
    for (const r of ROLES) {
      const p = medPt(sig.C[r], a, b);
      out.push(p ? Math.round(p.x * 100) + 0 : null, p ? Math.round(p.y * 100) + 0 : null); // + 0: −0 を 0 にする
    }
    return out;
  }

  const poseWindow = (sig, relI) => winIdx(relI, P.POSE_REL_FROM_MS, P.POSE_REL_TO_MS, sig.dt, sig.n);

  /* ---- 4.9 自己相似: その回の「型」と比べる ---- */
  /* 型 = はっきりした射の、離れの [−TPL_BEFORE, +TPL_AFTER] の 引き尺 / 保持の引き尺・弓手の高さ・引き手の高さ（保持からの差）の、
     時刻ごとの中央値。射から型までの距離は、項目ごとに「ほかの射で作った型からの距離」の中央値で割って平均する。
     候補（離れがはっきりしなかった保持）は、型をずらしながら当て、いちばん近い位置での距離が
     「はっきりした射の距離の最大 × TPL_BOUND」以下なら likely（射らしい）の印を付ける。離れの見当が無い候補は、時刻を型の位置にする。
     射数には入れない（離れがはっきり写っていないことは変わらない）。逆に、型から遠い射には atypical の印だけを付ける。 */
  function templateMatch(sig, real, candidates) {
    const { dt, n } = sig, K = Math.round(P.TPL_BEFORE_MS / dt), M = Math.round(P.TPL_AFTER_MS / dt), L = K + M + 1;
    if (real.length < P.TPL_MIN_SHOTS) return null;
    const comps = [sig.ds, sig.es, sig.ays];
    const snippet = relI => {
      const i = Math.round(relI), [w0, w1] = winIdx(i, -P.FEAT_FROM_MS, -P.FEAT_TO_MS, dt, n);
      const ref = comps.map(a => medRange(a, w0, w1));
      if (!fin(ref[0]) || !(ref[0] > 0)) return null;
      return comps.map((a, c) => {
        const v = nanArray(L);
        for (let j = 0; j < L; j++) { const x = a[i - K + j]; if (fin(x)) v[j] = c === 0 ? x / ref[0] : x - ref[c]; }
        return v;
      });
    };
    const snips = real.map(s => snippet(s._i)).filter(Boolean);
    if (snips.length < P.TPL_MIN_SHOTS) return null;
    const build = skip => comps.map((_, c) => {
      const t = nanArray(L), col = [];
      for (let j = 0; j < L; j++) {
        col.length = 0;
        for (let k = 0; k < snips.length; k++) if (k !== skip && fin(snips[k][c][j])) col.push(snips[k][c][j]);
        t[j] = col.length ? median(col) : NaN;
      }
      return t;
    });
    const raw = (snip, tpl) => comps.map((_, c) => {
      let sum = 0, cnt = 0;
      for (let j = 0; j < L; j++) if (fin(snip[c][j]) && fin(tpl[c][j])) { sum += Math.abs(snip[c][j] - tpl[c][j]); cnt++; }
      return { d: cnt ? sum / cnt : NaN, cover: cnt / L };
    });
    const loo = snips.map((sn, k) => raw(sn, build(k)));
    const scale = comps.map((_, c) => Math.max(1e-3, median(loo.map(r => r[c].d))));
    const total = r => {
      let sum = 0, cnt = 0, cover = 1;
      r.forEach((x, c) => { if (fin(x.d)) { sum += x.d / scale[c]; cnt++; cover = Math.min(cover, x.cover); } });
      return { d: cnt === comps.length ? sum / cnt : NaN, cover: cnt === comps.length ? cover : 0 };
    };
    const looD = loo.map(total).map(x => x.d).filter(fin);
    if (looD.length < P.TPL_MIN_SHOTS) return null;
    const bound = P.TPL_BOUND * Math.max(...looD), full = build(-1);
    real.forEach((s, k) => { const d = total(loo[k]).d; s.typicality = fin(d) ? d / bound : null; });
    for (const cnd of candidates) {
      if (cnd._to === undefined) continue;
      let best = Infinity, bi = -1;
      for (let i = cnd._from; i <= cnd._to; i++) {
        const sn = snippet(i);
        if (!sn) continue;
        const r = total(raw(sn, full));
        if (r.cover >= P.TPL_COVER && r.d < best) { best = r.d; bi = i; }
      }
      if (bi >= 0) {
        cnd.templateDist = best / bound;
        if (best <= bound) {
          cnd.likely = true;
          if (cnd.reason !== "weakRelease") { cnd.tMs = sig.t0 + bi * dt; cnd.uncMs = P.LATE_UNC_MS; }
        }
      }
    }
    return { bound, shots: snips.length };
  }

  /* ---- 5.3 測定のゆれ ---- */
  function captureNoise(real) {
    const noise = {}, df = {};
    if (!real.length) return { noise, df };
    for (const k of FEATURE_KEYS) {
      let best = NaN, bestN = 0;
      for (let lag = 1; lag <= P.NOISE_LAGS; lag++) {
        let ss = 0, c = 0;
        for (const s of real) {
          const w = s.wins && s.wins[k];
          if (!w) continue;
          for (let j = 0; j + lag < w.length; j++) { const dd = w[j + lag] - w[j]; ss += dd * dd; c++; }
        }
        if (c >= 4) { const v = Math.sqrt(ss / c / 2); if (!(v <= best)) { best = v; bestN = c; } }
      }
      noise[k] = fin(best) ? best : null;
      df[k] = bestN;
    }
    return { noise, df };
  }

  /* ---- 5.4 射どうしの比較 ---- */
  function zq(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const q = p < 0.5 ? p : 1 - p;
    let x;
    if (q < 0.02425) {
      const r = Math.sqrt(-2 * Math.log(q));
      x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
    } else {
      const r = (q - 0.5) * (q - 0.5), s = q - 0.5;
      x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * s) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    return p < 0.5 ? x : -x;
  }
  function tCrit(p, nu) {
    const z = zq(1 - p / 2), g1 = (z ** 3 + z) / 4, g2 = (5 * z ** 5 + 16 * z ** 3 + 3 * z) / 96, g3 = (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / 384;
    return z + g1 / nu + g2 / nu ** 2 + g3 / nu ** 3;
  }
  const FLOORS = Object.freeze({ ext: 0.03, ancY: 0.03, ancX: 0.03, bowElev: 2, shTilt: 2, elbAng: 4, headX: 0.03, headY: 0.03, lean: 1.5 });
  function compareShots(result, opts) {
    const keys = (opts && opts.keys) || Object.keys(FLOORS), alpha = (opts && opts.alpha) || 0.05;
    const real = result.shots.filter(s => s.kind === "shot"), n = real.length, out = { n, features: {}, flags: [] };
    if (n < 4) return out;
    const pEach = 1 - Math.pow(1 - alpha, 1 / (n * keys.length));
    for (const k of keys) {
      const vals = real.map(s => s.features[k]), sigma = result.quality.noise[k], nu = result.quality.noiseDf[k];
      if (vals.some(v => !fin(v)) || !fin(sigma) || !(nu >= 6)) continue;
      const crit = tCrit(pEach, Math.min(nu, 60)), spread = sd(vals), u = sigma * Math.sqrt(1 + Math.PI / 2 / (n - 1));
      out.features[k] = { median: median(vals), spread, noise: sigma, trueSpread: Math.sqrt(Math.max(0, spread * spread - sigma * sigma)), crit, limit: Math.max(crit * u, FLOORS[k]) };
      real.forEach((s, i) => {
        const delta = vals[i] - median(vals.filter((_, j) => j !== i));
        if (Math.abs(delta) > crit * u && Math.abs(delta) > FLOORS[k]) out.flags.push({ shot: i, key: k, delta, u, ratio: Math.abs(delta) / u });
      });
    }
    return out;
  }

  /* ---- 全体 ---- */
  function prepare(pk, opts) {
    const fixed = repairSwaps(pk), rs = resample(fixed.pk, opts.fps), sig = buildSignals(rs);
    sig.stats.swapped = fixed.swapped;
    return sig;
  }
  function analyzePacked(pk, opts) {
    const o = Object.assign({ handedness: "right", fps: 30 }, opts || {});
    const quality = { version: VERSION, frames: pk ? pk.n : 0, coverage: pk ? pk.coverage : 0, warnings: [] };
    const empty = w => { quality.warnings.push(w); return { shots: [], candidates: [], quality }; };
    if (!pk || !(pk.n >= 10)) return empty("tooShort");
    const sig = prepare(pk, o), { dt, n } = sig;
    Object.assign(quality, { fps: 1000 / dt, durationMs: n * dt, scalePx: sig.T0, dir: sig.dir, repaired: sig.stats });
    if (!fin(sig.T0) || !(sig.T0 > 0)) return empty("noBody");
    const calm = [];
    for (let i = 0; i < n; i++) if (fin(sig.vs[i])) calm.push(sig.vs[i]);
    const still = Math.min(P.STILL_MAX, Math.max(P.STILL_MIN, P.STILL_K * pct(calm, 0.2)));
    quality.still = still;
    const tOf = i => sig.t0 + i * dt;
    const dr = drawnRuns(sig, NaN, still);
    quality.drawLevel = fin(dr.level) ? dr.level : null;
    const shots = [], candidates = [], need = Math.max(2, Math.round(P.SETTLE_MS / dt));
    let lastEvt = -Infinity;
    dr.runs.forEach(([s, e], ri) => {
      let is = -1, cnt = 0;
      for (let i = s; i <= e; i++) {
        cnt = sig.vs[i] < still && sig.ds[i] >= P.SETTLE_FRAC * dr.level ? cnt + 1 : 0;
        if (cnt >= need) { is = i - need + 1; break; }
      }
      if (is < 0) is = s;
      const nextStart = ri + 1 < dr.runs.length ? dr.runs[ri + 1][0] : n;
      const ev = runEvent(sig, is, e, nextStart);
      if (o.debug) (quality.debug = quality.debug || []).push(ev ? { s: tOf(s), e: tOf(e), is: tOf(is), kind: ev.kind, type: ev.type, tc: tOf(ev.tc), to: tOf(ev.to), t: tOf(ev.t), unc: ev.unc, c: tOf(ev.c), zL: ev.zL, zJ: ev.zJ, zLW: ev.zLW, zLE: ev.zLE, zJW: ev.zJW, zJE: ev.zJE, stepW: ev.stepW, stepE: ev.stepE, reason: ev.reason } : { s: tOf(s), e: tOf(e), is: tOf(is), ev: null });
      const cand = (i, reason, unc) => candidates.push({ tMs: tOf(i), uncMs: unc, reason, likely: false, fromMs: tOf(s), toMs: tOf(e), _from: is, _to: ev && ev.type === "lower" ? Math.min(n - 1, ev.tc) : undefined });
      if (!ev) return cand(e, "short", P.LATE_UNC_MS);
      if (!ev.kind) return cand(fin(ev.t) ? ev.t : ev.tc, ev.reason, ev.reason === "weakRelease" ? P.WEAK_UNC_MS : P.LATE_UNC_MS);
      const relT = tOf(ev.t);
      if (relT - lastEvt < P.REFRACTORY_MS) return cand(ev.t, "tooSoon", P.WEAK_UNC_MS);
      lastEvt = relT;
      /* 引きの進み具合: 引き手の手首（平滑）の、引きの軸に沿った位置（後ろが正） */
      const w = nanArray(n);
      let wLo = Math.max(0, is - Math.round((P.ANCHOR_BACK_MS + 5000) / dt));
      for (let i = is; i >= wLo; i--) if (sig.cut[i]) { wLo = i + 1; break; } // 人が入れ替わった所より前は見ない
      for (let i = wLo; i <= Math.min(n - 1, Math.ceil(ev.t)); i++) w[i] = sig.ps.x[i] * ev.axis.x + sig.ps.y[i] * ev.axis.y;
      const an = anchorStart(sig, w, ev.t, is, still), fd = fitDraw(sig, w, an.a, ev.t, an.dHold);
      const aI = fd ? Math.min(fd.stillI, ev.t - 1) : an.a, dI = fd ? fd.startI : drawStart(sig, aI, ev.D0), endI = fd ? Math.min(fd.endI, ev.t) : aI;
      const ft = shotFeatures(sig, ev.t, aI);
      const [p0, p1] = poseWindow(sig, ev.t);
      const isShot = ev.kind === "shot";
      shots.push({
        releaseMs: relT, anchorStartMs: tOf(aI), holdMs: relT - tOf(aI), kind: ev.kind,
        drawStartMs: tOf(dI), drawMs: tOf(aI) - tOf(dI), drawEndMs: tOf(endI), anchorFit: !!fd, releaseUncMs: ev.unc,
        confidence: isShot ? Math.max(0.5, Math.min(1, 0.5 + 0.05 * (ev.score - P.LOCATE_K))) : 0.8, _i: ev.t,
        source: isShot ? (ev.stepW >= P.EXIT_MIN ? "draw" : "elbow") : "draw", kindScore: ev.score,
        features: Object.assign({ holdMs: relT - tOf(aI), drawMs: tOf(aI) - tOf(dI) }, ft.f), wins: ft.wins,
        poseHold: poseAt(sig, ft.w0, ft.w1), poseRel: isShot ? poseAt(sig, p0, p1) : null,
      });
    });
    const real = shots.filter(x => x.kind === "shot"), ns = captureNoise(real);
    const tpl = templateMatch(sig, real, candidates);
    quality.template = tpl ? { shots: tpl.shots } : null;
    for (const x of shots) delete x._i;
    for (const x of candidates) { delete x._from; delete x._to; }
    quality.noise = ns.noise;
    quality.noiseDf = ns.df;
    quality.letdowns = shots.length - real.length;
    const rho = median(real.map(x => x.features.armLen)), omega = median(real.map(x => x.features.shWidth));
    const rhoRef = o.rhoRef > 0 ? o.rhoRef : P.RHO_REF, ratio = rho / rhoRef;
    quality.view = {
      rho: fin(rho) ? rho : null, omega: fin(omega) ? omega : null,
      side: (o.handedness === "left" ? -1 : 1) * sig.dir > 0 ? "c" : "b",
      cls: !fin(ratio) ? null : ratio >= 0.94 ? "s" : ratio >= 0.77 ? "o" : "x",
    };
    const elev = median(real.map(x => x.features.bowElev));
    if (!dr.runs.length) quality.warnings.push("noFullDraw");
    if (fin(elev) && elev >= P.STEEP_DEG) quality.warnings.push("steep");
    if (sig.T0 < 100) quality.warnings.push("small");
    if (1000 / dt < 15) quality.warnings.push("lowFps");
    if (pk.coverage < 0.8) quality.warnings.push("gappy");
    return { shots, candidates, quality };
  }
  function analyze(frames, opts) {
    const o = Object.assign({ frame: { w: 1280, h: 720 }, handedness: "right", fps: 30 }, opts || {});
    return analyzePacked(packFrames(frames, o), o);
  }

  return {
    VERSION, P, ROLES, FEATURE_KEYS, DEFAULT_KEYS, FLOORS,
    packFrames, repairSwaps, resample, buildSignals, prepare, holdLevel, drawnRuns, changePoint, jumpAt, onsetFit, runEvent,
    anchorStart, drawStart, shotFeatures, featureWindow, poseAt, poseWindow, fitDraw, templateMatch, captureNoise, compareShots, analyzePacked, analyze,
  };
})();
