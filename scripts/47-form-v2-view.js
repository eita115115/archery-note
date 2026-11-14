"use strict";
/* Archery Note: 射型の記録 v2 の画面（docs/design/form-v2/design.md 2 章、試作 prototype.html）。
   入にする → 置き方を確かめる → 撮る → 解析する → 結果（射数を直す・射の詳細）→ 保存。
   撮影中はランドマークをメモリのバッファ（FormV2.makeBuffer）にためるだけで、終わってから FormAnalyze.analyzePacked に渡す。
   実時間の状態機械（46-form-core.js の stepFormPhase など）は使わない。保存するのは FormV2.buildRecord の数値だけ。
   映像・画素・ランドマークの列は保存も送信もしない。動画は、利用者が「端末に保存」を押したときだけ端末へ書き出す。
   推移（項目を選ぶ）と一覧は 分析 > 射型 のカード、動画で確かめる画面は結果から開く（段 7・8）。
   検証用の診断（設定「検証用の診断データ」）も、この画面の記録から書き出す。以前の撮影画面（47-form-view.js の openFormCapture）は開かない。
   検査から差し替えられる入口: loadFormPose（47-form-view.js）、formV2FrameSource、formV2Unsupported。 */

const FORM_V2_MODEL = "pose_landmarker_lite v1 (tasks-vision 0.10.14)";
const FORM_V2_UNSEEN = [
  "背中の筋肉の使い方、肩甲骨の動き",
  "引き手の肘が矢の線の真後ろにあるか（真横から分かるのは高さだけ）",
  "弓手の左右のぶれ、弓の傾き",
  "指の掛け方、弦の離れ方、押し手の握り",
  "クリッカーが鳴った瞬間",
  "2〜3cm より細かい位置の違い、数 mm の伸び合い",
  "保持が 0.4 秒に満たない射（数えられません）",
  "射ごとに変わる、点のゆっくりしたずれ（袖や胸当ての影響）",
];
const FORM_V2_REASON_TEXT = {
  weakRelease: "離れの動きはありましたが、はっきりしませんでした",
  noRelease: "腕は下ろしましたが、離れの動きが見つかりませんでした",
  unobserved: "保持の途中で体が見えなくなりました",
  bodyMoved: "同じ時刻に頭や胴が大きく動きました",
  short: "止まってから終わりまでが短すぎました",
  tooSoon: "前の射から 1.5 秒以内でした",
};
const FORM_V2_GO = '<svg class="chev go" viewBox="0 0 10 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 1l6 7-6 7"/></svg>';

/* ---------- 小さな道具 ---------- */
function formV2Mmss(sec) {
  const s = Math.max(0, Math.floor(sec));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function formV2Dur(sec) {
  const s = Math.max(0, Math.round(sec)), m = Math.floor(s / 60);
  return m ? `${m} 分 ${s % 60} 秒` : `${s} 秒`;
}
function formV2Height() {
  const h = db.settings && db.settings.formHeightCm;
  return typeof h === "number" && h >= 100 && h <= 230 ? h : null;
}
/* 図の幅（px）。SVG を 1:1 で描いて、文字が 13px より小さくならないようにする */
function formV2W() {
  const w = Math.min(document.documentElement.clientWidth || 375, 480);
  return w - 2 * (w <= 340 ? 12 : 16);
}
function formV2ViewText(view) {
  const v = view || {};
  const ang = v.cls === "s" ? "真横に近い" : v.cls === "o" ? "やや斜め" : v.cls === "x" ? "斜め" : "置き方は分かりません";
  return v.side === "c" ? `${ang}・胸側` : v.side === "b" ? `${ang}・背中側` : ang;
}
function formV2ViewNote(view) {
  const v = view || {};
  if (!v.cls) return "射が見つからなかったので、置き方は測れていません";
  const plane = v.cls === "s" ? "時間・高さ・面内の項目を測れます" : v.cls === "o" ? "面内の項目は、この回の中だけで比べます" : "面内の項目は出していません";
  return v.side === "b" ? `${plane}。アンカーの高さは出していません（引き手が頭に隠れます）` : plane;
}
/* この端末で解析の部品が動くか。動かない理由（文字列）か null。検査から差し替えられる */
function formV2Unsupported() {
  try {
    if (typeof WebAssembly !== "object" || typeof WebAssembly.validate !== "function") return "wasm";
    /* SIMD（v128 を返す関数）を検証できるか。tasks-vision の部品は SIMD を使う */
    const simd = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
    return WebAssembly.validate(simd) ? null : "simd";
  } catch (e) {
    return "wasm";
  }
}
/* 映像の 1 コマごとに onFrame(時刻 ms) を呼ぶ。時刻は requestVideoFrameCallback の mediaTime（使えない端末は performance.now()）。
   保存した動画（replay）は映像の時刻を使い、最後まで行ったら onEnd を呼ぶ。検査はこの関数を差し替えて合成の時刻を流す */
function formV2FrameSource(video, replay) {
  const rvfc = typeof video.requestVideoFrameCallback === "function";
  let on = false, id = 0, cb = null, end = null, first = true, decided = false, useMedia = false, prev = NaN;
  function step(now, meta) {
    if (!on) return;
    schedule();
    const mt = meta && Number.isFinite(meta.mediaTime) ? meta.mediaTime * 1000 : NaN;
    if (replay) { cb(Number.isFinite(mt) ? mt : video.currentTime * 1000); return; }
    if (first) { first = false; prev = mt; return; } // 1 コマめは、時刻の取り方を決めるのに使う
    if (!decided) { decided = true; useMedia = Number.isFinite(mt) && Number.isFinite(prev) && mt > prev; }
    if (useMedia) { if (Number.isFinite(mt)) cb(mt); } else cb(performance.now());
  }
  function schedule() { id = rvfc ? video.requestVideoFrameCallback(step) : requestAnimationFrame((t) => step(t, null)); }
  function ended() { if (on && end) end(); }
  return {
    start(onFrame, onEnd) { cb = onFrame; end = onEnd || null; on = true; if (replay) video.addEventListener("ended", ended); schedule(); },
    stop() {
      on = false;
      video.removeEventListener("ended", ended);
      if (rvfc && typeof video.cancelVideoFrameCallback === "function") video.cancelVideoFrameCallback(id); else cancelAnimationFrame(id);
    },
  };
}
function formV2Beep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = formV2Beep.ctx || (formV2Beep.ctx = new AC()), o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.12);
  } catch (e) {}
}

/* ---------- 図 ---------- */
/* 時間の帯: 引き → 保持 → 離れ を 1 射ずつ。引き戻しは白抜き、数えていない候補は破線 */
function formV2TimelineSvg(model) {
  const w = formV2W(), h = 74, from = model.fromS || 0;
  const dur = model.toS == null ? Math.max(1, model.dur || 0, ...model.events.map((e) => e.tS + 1).filter(Number.isFinite)) : Math.max(1, model.toS - from), x = (t) => 4 + ((w - 8) * Math.min(dur, Math.max(0, t - from))) / dur;
  let g = `<path d="M0 46H${w}" stroke="var(--rule-strong)" stroke-width="1"/>`, lastLabel = -99;
  /* 番号は、前の番号に重なるときは省く（射の多い記録では、とびとびに出る） */
  const label = (cx, text, cls) => {
    const half = String(text).length * 4.6 + 2;
    if (cx - half < lastLabel + 3) return "";
    lastLabel = cx + half;
    return `<text x="${Math.min(w - 6, Math.max(6, cx)).toFixed(1)}" y="14" text-anchor="middle" class="${cls}">${text}</text>`;
  };
  for (const e of model.events) {
    if (e.kind === "cand") {
      const x1 = x(e.fromS == null ? e.tS - 2 : e.fromS), x2 = x(e.tS);
      g += `<rect x="${x1.toFixed(1)}" y="26.5" width="${Math.max(3, x2 - x1).toFixed(1)}" height="7" fill="${e.counted ? "var(--ink)" : "none"}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 2"/>`;
      g += label(e.counted ? x2 : (x1 + x2) / 2, e.counted ? e.n : "？", e.counted ? "axi" : "ax");
      continue;
    }
    const x2 = x(e.tS), x1 = x(e.tS - (e.holdS || 0)), x0 = x(e.tS - (e.holdS || 0) - (e.drawS || 0));
    g += `<path d="M${x0.toFixed(1)} 46L${x1.toFixed(1)} 30" stroke="var(--sub)" stroke-width="2" fill="none"/>`;
    if (e.counted) {
      g += `<rect x="${x1.toFixed(1)}" y="26" width="${Math.max(3, x2 - x1).toFixed(1)}" height="8" fill="var(--ink)"/><path d="M${x2.toFixed(1)} 20V46" stroke="var(--ink)" stroke-width="2"/>`;
      g += label(x2, e.n, "axi");
    } else {
      g += `<rect x="${x1.toFixed(1)}" y="26.5" width="${Math.max(3, x2 - x1).toFixed(1)}" height="7" fill="none" stroke="var(--sub)" stroke-width="1.5"/>`;
      g += label((x1 + x2) / 2, e.kind === "letdown" ? "戻" : "外", "ax");
    }
  }
  g += `<text x="0" y="66" class="ax">${formV2Mmss(from)}</text><text x="${w}" y="66" text-anchor="end" class="ax">${formV2Mmss(from + dur)}</text><text x="${w / 2}" y="66" text-anchor="middle" class="ax">時間</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="時間の帯。${model.count} 射、引き戻し ${model.letdowns} 回">${g}</svg>`;
}
/* 射の順の図: 帯 = 測定のゆれから出せる下限、破線 = 中央値、塗りつぶし = 違った射 */
function formV2RunChartHtml(model, cmp, key) {
  const ft = cmp.feat[key], meta = FormV2.META[key], w = formV2W(), h = 104, pt = 14, pb = 24, n = cmp.n;
  const ref = ft.median, vals = ft.vals.map((v) => FormV2.shown(key, v, ref)), ok = vals.filter(Number.isFinite);
  if (!ok.length) return `<div class="fv2Chart"><div class="fv2ChartH"><b>${esc(meta.name)}</b><span>—</span></div><p class="basis">この回では測れませんでした。</p></div>`;
  const m = FormV2.shown(key, ft.median, ref), lim = ft.limit == null ? null : FormV2.shownSize(key, ft.limit, ref), nz = FormV2.shownSize(key, ft.noise, ref);
  const lo = Math.min(...ok, lim == null ? m : m - lim), hi = Math.max(...ok, lim == null ? m : m + lim), pad = (hi - lo) * 0.16 || 1;
  const y = (v) => pt + (h - pt - pb) * (1 - (v - (lo - pad)) / (hi + pad - (lo - pad))), x = (i) => 4 + ((w - 8) * (i + 0.5)) / n;
  const flagged = new Set(cmp.flags.filter((f) => f.key === key).map((f) => f.row));
  let g = lim == null ? "" : `<rect x="0" y="${y(m + lim).toFixed(1)}" width="${w}" height="${(y(m - lim) - y(m + lim)).toFixed(1)}" fill="var(--raised)"/>`;
  g += `<path d="M0 ${y(m).toFixed(1)}H${w}" stroke="var(--sub)" stroke-width="1" stroke-dasharray="4 4"/>`;
  vals.forEach((v, i) => {
    const d = flagged.has(i), num = model.compared[i].n;
    if (Number.isFinite(v)) {
      g += d
        ? `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="7" fill="var(--info)"/><text x="${(i >= n / 2 ? x(i) - 12 : x(i) + 12).toFixed(1)}" y="${(y(v) + 5).toFixed(1)}" text-anchor="${i >= n / 2 ? "end" : "start"}" class="axi">${FormV2.fmt(key, v)}</text>`
        : `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="5.5" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`;
    }
    if (n <= 12 || i % 2 === 0) g += `<text x="${x(i).toFixed(1)}" y="${h - 5}" text-anchor="middle" class="${d ? "axi" : "ax"}">${num}</text>`;
  });
  const u = (v) => FormV2.fmt(key, v, { dp: Math.max(1, meta.dp) }), iv = FormV2.sdInterval(ok.length);
  const spread = FormV2.shownSize(key, ft.spread, ref);
  let note;
  if (ft.limit == null) note = n < 4 ? "4 射に満たないので、違いの印は出していません。" : "この項目は測定のゆれを見積もれなかったので、違いの印は出していません。";
  else if (ft.indistinct) note = `ばらつきは測定のゆれ（±${u(nz)}）と区別できません。`;
  else note = `ばらつき ±${u(spread)}（${ok.length} 射。射数が少ないので ${iv.lo.toFixed(1)}〜${iv.hi.toFixed(1)} 倍の幅で不確かです）。測定のゆれは ±${u(nz)}。`;
  const cm = FormV2.cmText(key, m, formV2Height());
  const head = meta.rel ? "この回の中央値を 100%" : `中央値 ${formV2ValHtml(key, m, cm)}`;
  return `<div class="fv2Chart" data-key="${key}"><div class="fv2ChartH"><b>${esc(meta.name)}</b><span>${head}</span></div><svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(meta.name)}。射の順">${g}</svg><p class="basis">${note}</p></div>`;
}
/* 姿の図。pose = 18 個の整数（9 点 × (x, y)、0.01 胴、原点 = 両肩の中点、弓の向きが x 正、上が y 正）。見えない点は null */
function formV2PosePath(pose, m, o) {
  if (!Array.isArray(pose)) return "";
  const P = (i) => (Number.isFinite(pose[i * 2]) && Number.isFinite(pose[i * 2 + 1]) ? [m.ox + (pose[i * 2] / 100) * m.s, m.oy - (pose[i * 2 + 1] / 100) * m.s] : null);
  let d = "";
  for (const [a, b] of [[2, 1], [1, 3], [3, 5], [2, 4], [4, 6], [1, 7], [2, 8], [8, 7]]) {
    const p = P(a), q = P(b);
    if (p && q) d += `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  }
  const nose = P(0);
  return (d ? `<path d="${d}" fill="none" stroke="${o.c}" stroke-width="${o.w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o.op || 1}"/>` : "")
    + (nose ? `<circle cx="${nose[0].toFixed(1)}" cy="${nose[1].toFixed(1)}" r="${(0.16 * m.s).toFixed(1)}" fill="none" stroke="${o.c}" stroke-width="${o.w}" opacity="${o.op || 1}"/>` : "");
}
function formV2MedianPose(poses) {
  const out = [];
  for (let i = 0; i < 18; i++) {
    const v = FormV2.median(poses.map((p) => (Array.isArray(p) ? p[i] : NaN)));
    out.push(Number.isFinite(v) ? v : null);
  }
  return out;
}
/* 重ね図。hi = 色を変える射（比べる射の中の番号）、only = true なら「この射」と「ほかの射の中央」だけ */
function formV2OverlayHtml(model, phase, hi, only) {
  const w = formV2W() - 2, h = Math.round(w * 0.62), m = { ox: w * 0.4, oy: h * 0.36, s: w / 3.05 };
  const poses = model.compared.map((e) => (phase === "rel" ? e.pr : e.ps));
  if (!poses.some(Array.isArray)) return `<p class="basis">${phase === "rel" ? "離れのあとの姿" : "保持の姿"}は、この記録にはありません。</p>`;
  let g = "";
  if (only) g += formV2PosePath(formV2MedianPose(poses.filter((_, i) => i !== hi)), m, { c: "var(--sub)", w: 2 });
  else poses.forEach((p, i) => { if (i !== hi) g += formV2PosePath(p, m, { c: "var(--sub)", w: 1.5, op: 0.75 }); });
  if (hi != null && hi >= 0) g += formV2PosePath(poses[hi], m, { c: "var(--info)", w: 3 });
  return `<div class="fv2Ov"><svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="骨格の重ね図（${phase === "rel" ? "離れのあと" : "保持"}）">${g}</svg></div>`;
}
/* 「胴の 33.2%（約 16cm）」を、かっこの途中で折り返さない形にする（値と cm の目安を、それぞれひとかたまりにする） */
function formV2ValHtml(key, x, cm) {
  const m = FormV2.META[key], b = m.unit === "b" && !m.rel ? "胴の " : "";
  return `<span class="fv2Nw">${b}${FormV2.fmt(key, x)}</span>${cm ? `<wbr><span class="fv2Nw">（${cm}）</span>` : ""}`;
}
function formV2SegHtml(name, cur, opts) {
  return `<div class="seg" role="group" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-val="${v}" aria-pressed="${cur === v}">${l}</button>`).join("")}</div>`;
}

/* ---------- 分析 > 射型 のカード ---------- */
function formV2RecordLine(rec) {
  const m = FormV2.read(rec), hold = FormV2.median(m.compared.map((e) => e.vals.holdMs));
  const part = m.part ? `。${m.part.of} つに分けた記録の ${m.part.k} つめ（${m.offset + 1} 射目から）` : "";
  return { m, title: `${fmtMDW(rec.date)}\u3000${m.count} 射${Number.isFinite(hold) ? `\u3000保持 ${(hold / 1000).toFixed(1)} 秒` : ""}`, sub: `${formV2ViewText(rec.v2.view)}${m.letdowns ? `。引き戻し ${m.letdowns} 回` : ""}${rec.cap.src === "replay" ? "。保存した動画" : ""}${part}` };
}
/* ---------- 推移（design.md 2.9・5.4）: 項目を選ぶ。比べてよい回だけを描く ---------- */
let formV2TrendKey = "holdMs"; // 選んでいる項目（画面の状態。保存しない）
let formV2ListAll = false; // 記録の一覧を全部出すか
function formV2TrendKeys() {
  return FormAnalyze.DEFAULT_KEYS.filter((k) => FormV2.META[k]);
}
/* 軸の目盛り（3〜4 本）。lo〜hi を切りのよい間隔で割る */
function formV2Ticks(lo, hi) {
  const raw = (hi - lo) / 3 || 1, p = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 5, 10].map((m) => m * p).find((v) => v >= raw) || raw;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return { out, dp: Math.max(0, -Math.floor(Math.log10(step) + 1e-9)) };
}
function formV2TrendCond(t, key) {
  const ref = t.ref, kind = FormV2.META[key].kind, view = (ref && ref.v2.view) || {}, side = view.side === "b" ? "背中側" : "胸側";
  const hand = ref && ref.cap.hand === "left" ? "左利き" : "右利き";
  if (kind === "t") return `${hand}の記録（時間の項目は、置き方が違っても比べます）`;
  if (kind === "h") return `${hand}・${side}で、真横かやや斜めの記録（高さの項目）`;
  return `${hand}・${side}で真横、腕の写る長さの差が 6% 以内の記録（面内の項目）`;
}
function formV2TrendWhy(t) {
  const list = Object.keys(t.why).map((k) => `${k}（${t.why[k]} 回）`);
  return list.length ? `入れていない回: ${list.join("、")}。` : "";
}
function formV2TrendHtml(records) {
  const keys = formV2TrendKeys(), key = keys.includes(formV2TrendKey) ? formV2TrendKey : keys[0];
  const t = FormV2.trend(records, key), pts = t.points, meta = FormV2.META[key], body = meta.unit === "b" && !meta.rel ? "胴の " : "";
  if (!t.ref) return "";
  const picker = `<label class="lrow fv2Pick"><span class="lk">項目</span><select class="pick" id="fv2TrendKey" data-testid="form-v2-trend-key" aria-label="推移の項目">${keys.map((k) => `<option value="${k}"${k === key ? " selected" : ""}>${esc(FormV2.META[k].name)}</option>`).join("")}</select></label>`;
  const wrap = (inner) => `<div class="fv2Sub" data-testid="form-v2-trend" data-key="${key}" data-points="${pts.length}" data-excluded="${t.excluded}"><div class="fv2ChartH"><b>推移</b><span>${pts.length >= 3 ? `${pts.length} 回` : "比べてよい回だけ"}</span></div>${picker}${inner}</div>`;
  if (t.refUnmeasured) return wrap(`<p class="basis" data-testid="form-v2-trend-note">いちばん新しい記録の置き方（${esc(formV2ViewText(t.ref.v2.view))}）では「${esc(meta.name)}」を測れないので、この項目の推移は出していません。</p>`);
  if (pts.length < 3) return wrap(`<p class="basis" data-testid="form-v2-trend-note">「${esc(meta.name)}」を比べてよい記録は、まだ ${pts.length} 回です。3 回になると推移を出します。対象は、いちばん新しい記録と同じ条件: ${esc(formV2TrendCond(t, key))}。${esc(formV2TrendWhy(t))}</p>`);
  const ref = meta.rel ? pts[0].med : NaN, sh = (v) => FormV2.shown(key, v, ref);
  const rows = pts.map((p) => { const a = sh(p.q1), b = sh(p.q3); return { p, med: sh(p.med), lo: Math.min(a, b), hi: Math.max(a, b) }; });
  const w = formV2W(), h = 150, pt = 12, pb = 26, left = 58;
  const lo0 = Math.min(...rows.map((r) => r.lo)), hi0 = Math.max(...rows.map((r) => r.hi)), pad = Math.max((hi0 - lo0) * 0.2, meta.unit === "s" ? 0.3 : 1);
  const lo = lo0 - pad, hi = hi0 + pad, y = (v) => pt + (h - pt - pb) * (1 - (v - lo) / (hi - lo)), x = (i) => left + ((w - left - 20) * i) / (rows.length - 1);
  const ticks = formV2Ticks(lo0 - pad * 0.5, hi0 + pad * 0.5);
  let g = "";
  for (const v of ticks.out) g += `<path d="M0 ${y(v).toFixed(1)}H${w}" stroke="var(--rule)" stroke-width="1"/><text x="0" y="${(y(v) - 4).toFixed(1)}" class="ax">${FormV2.fmt(key, v, { dp: ticks.dp })}</text>`;
  rows.forEach((r, i) => {
    if (r.p.gear) g += `<path d="M${x(i).toFixed(1)} ${pt}V${h - pb}" stroke="var(--info)" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    g += `<path d="M${x(i).toFixed(1)} ${y(r.lo).toFixed(1)}V${y(r.hi).toFixed(1)}" stroke="var(--rule-strong)" stroke-width="5"/><circle cx="${x(i).toFixed(1)}" cy="${y(r.med).toFixed(1)}" r="5" fill="${i === rows.length - 1 ? "var(--accent)" : "var(--ink)"}"/>`;
    if (i === 0 || i === rows.length - 1) g += `<text x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="${i ? "end" : "start"}" class="ax">${fmtMD(r.p.date)}</text>`;
  });
  const dp = Math.max(1, meta.dp), f = (v, o) => FormV2.fmt(key, v, Object.assign({ dp }, o || {}));
  const last = rows.slice(-5).map((r) => r.med), ns = pts.map((p) => p.n), shots = ns.reduce((n, v) => n + v, 0);
  const unc = t.unc == null ? null : FormV2.shownSize(key, t.unc, ref), range = FormV2.shownSize(key, t.range, ref);
  const cmA = FormV2.cmText(key, Math.min(...last), formV2Height()), cmB = FormV2.cmText(key, Math.max(...last), formV2Height());
  const cm = cmA && cmB ? `${cmA.replace("cm", "")}〜${cmB.replace("約 ", "")}` : "";
  let doubt = "各回の射が少ないので、中央値の不確かさは見積もれていません。";
  if (unc != null) {
    doubt = `各回の中央値には、射どうしの幅（四分位）から見て ±${f(unc)} ほどの不確かさがあります（95% の目安）。`
      + (range <= 2 * unc ? `回どうしの中央値の差（いちばん離れた 2 回で ${f(range)}）は、この不確かさと区別できません。` : `中央値がいちばん離れた 2 回の差は ${f(range)} で、この不確かさより大きい違いです。`);
  }
  if (meta.kind !== "t") doubt += "台の位置や向きが変わると、回ごとに一定のずれが乗ります。その大きさは見積もれていません。";
  return wrap(`<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(meta.name)}の推移。${pts.length} 回">${g}</svg>
    <div class="fv2Legend"><span><i class="k7"></i>各回の中央値</span><span><i class="k8"></i>射どうしの幅（四分位）</span>${rows.some((r) => r.p.gear) ? `<span><i class="k9"></i>弓具が前の回と違う</span>` : ""}</div>
    <p class="fact" data-testid="form-v2-trend-fact">直近 ${last.length} 回の中央値は ${body}${f(Math.min(...last), { bare: true })}〜${f(Math.max(...last))}${/[%°]$/.test(f(1)) ? " " : ""}でした${cm ? `（${cm}）` : ""}。</p>
    <p class="basis" data-testid="form-v2-trend-basis">対象: ${esc(formV2TrendCond(t, key))}。${pts.length} 回（${fmtMD(pts[0].date)}〜${fmtMD(pts[pts.length - 1].date)}）、計 ${shots} 射、各 ${Math.min(...ns)}${Math.min(...ns) === Math.max(...ns) ? "" : `〜${Math.max(...ns)}`} 射。測れなかった値（—）は数えていません。${meta.rel ? "最初の回の中央値を 100% としています。" : ""}${esc(formV2TrendWhy(t))}</p>
    <p class="basis" data-testid="form-v2-trend-doubt">${doubt}</p>`);
}
/* 切のとき: その場で入にできる（design.md 2.1） */
function formTrackingOffCard() {
  return `<section class="vsec" data-testid="analysis-form-off">
    <div class="vsecH"><h2>射型の記録</h2><span class="aside">試験中・切</span></div>
    <p class="fact">iPhone を台に置いて 1 エンドを撮ると、射数、保持の時間、ほかと違った射を記録します。</p>
    <div class="lrow"><span class="lk">映像</span><span class="lv">保存しません<small>解析は端末の中だけで行い、外へ送りません</small></span></div>
    <div class="lrow"><span class="lk">残るもの</span><span class="lv">射ごとの数値<small>1 回 約 2KB</small></span></div>
    <div class="lrow"><span class="lk">初回</span><span class="lv">約 15.5MB を取り込みます<small>次からは圏外でも使えます</small></span></div>
    <div class="lrow"><span class="lk">対応</span><span class="lv">iOS 16.4 以降</span></div>
    <div class="btnRow"><button type="button" class="btn fv2Tall" id="formEnable" data-testid="form-v2-enable">入にする</button></div>
    <p class="basis">設定 &gt; 記録 の「射型の記録（試験中）」と同じ切り替えです。切に戻しても、記録は消えません。</p>
  </section>`;
}
function formTrackingCard(records = db.formAnalyses || []) {
  if (!formTrackingEnabled()) return "";
  const all = [...records].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const v2 = all.filter(FormV2.isV2), legacy = all.filter((r) => !FormV2.isV2(r));
  const total = (db.formAnalyses || []).length;
  const debug = db.settings.formDebug === true;
  let latest = "";
  if (v2.length) {
    const rec = v2[0], line = formV2RecordLine(rec), cmp = FormV2.compare(line.m, FormAnalyze);
    latest = `<div class="fv2Sub" data-testid="form-v2-latest"><div class="fv2ChartH"><b>直近の記録</b><span>${fmtMDW(rec.date)}${line.m.part ? `・${esc(String(line.m.part.of))} つに分けた ${esc(String(line.m.part.k))} つめ` : ""}</span></div>
      <p class="fact">${esc(FormV2.summary(line.m, cmp, formV2Height()).text)}</p>
      <p class="basis">${line.m.count} 射${line.m.letdowns ? `、引き戻し ${line.m.letdowns} 回` : ""}。${esc(formV2ViewText(rec.v2.view))}、${rec.cap.o === "l" ? "横向き" : rec.cap.o === "p" ? "縦向き" : "正方形"}。</p></div>`;
  }
  const skipped = new Set(FormV2.trend(v2, formV2TrendKeys().includes(formV2TrendKey) ? formV2TrendKey : "holdMs").skipped);
  const shownRows = formV2ListAll ? v2 : v2.slice(0, 8);
  const rows = shownRows.map((rec) => {
    const line = formV2RecordLine(rec);
    return `<div class="formAnalysisRow">
      <button class="lrow link fv2Item" data-form-v2-id="${esc(rec.id)}" type="button"><span class="lmain"><b>${esc(line.title)}</b><span>${esc(line.sub)}${skipped.has(rec.id) ? "。選んだ項目の推移には入れていません" : ""}</span></span>${FORM_V2_GO}</button>
      <button class="btn sm ghost histDelBtn" data-del-form="${esc(rec.id)}" type="button" aria-label="${esc(fmtMDW(rec.date))}の射型記録を削除">${icon("del")}</button>
    </div>`;
  }).join("");
  const empty = !all.length
    ? `<div class="empty">${total ? "この条件に合う射型の記録は 0件です。弓具・距離・期間の選択を広げると表示されます。" : "射型の記録はまだありません。台に置いて 1 エンドを撮ると、ここに並びます。"}</div>`
    : "";
  return `<section class="vsec analysisFormCard" data-testid="analysis-form-card"><div class="vsecH"><h2>射型の記録</h2><span class="aside">試験中${v2.length ? `・${v2.length}件` : ""}</span></div>
    <div class="btnRow"><button type="button" class="btn fv2Tall" id="formStart" data-testid="form-v2-start">${icon("camera")} 撮影して記録する</button></div>
    <div class="btnRow fv2Tight"><button type="button" class="btn sec" id="formReplay" data-testid="form-v2-replay">保存した動画を解析する</button></div>
    ${debug ? `<p class="basis" data-testid="form-v2-debug-note">「検証用の診断データ」が入です。撮影の画面と数え方はふだんと同じで、保存する記録に解析器の中の値（数値だけ）を付けます。書き出しは、結果の画面か 設定 &gt; 記録 から行います。</p>` : ""}
    ${latest}${formV2TrendHtml(v2)}
    ${rows ? `<div class="fv2Sub"><div class="fv2ChartH"><b>記録</b><span>${v2.length}件${v2.length > 8 && !formV2ListAll ? "・新しい8件を表示" : ""}</span></div><div class="formRecordList" data-testid="form-v2-list">${rows}</div>
      ${v2.length > 8 ? `<div class="btnRow fv2Tight"><button type="button" class="btn sec" id="fv2ListAll" data-testid="form-v2-list-all">${formV2ListAll ? "新しい 8 件だけにする" : `${v2.length} 件すべてを表示`}</button></div>` : ""}
      <p class="basis">映像は残していません。数値だけを、この端末の中に保存しています。期間は撮影日、弓具・距離は紐づけた練習の条件で選んでいます。</p></div>` : ""}
    ${empty}
    ${legacy.length ? formLegacyRecordsHtml(legacy) : ""}
  </section>`;
}
function bindFormV2Card() {
  const enable = $("#formEnable");
  if (enable) enable.onclick = () => {
    db.settings.formTrackingEnabled = true;
    save();
    render();
    toast("射型の記録を入にしました");
    const start = $("#formStart");
    if (start) start.focus({ preventScroll: true });
  };
  const key = $("#fv2TrendKey");
  if (key) key.onchange = () => {
    formV2TrendKey = key.value;
    render();
    const again = $("#fv2TrendKey");
    if (again) again.focus({ preventScroll: true });
  };
  const all = $("#fv2ListAll");
  if (all) all.onclick = () => { formV2ListAll = !formV2ListAll; render(); };
  document.querySelectorAll("[data-form-v2-id]").forEach((b) => (b.onclick = () => {
    const rec = (db.formAnalyses || []).find((r) => r && r.id === b.dataset.formV2Id);
    if (rec) formV2OpenRecord(rec);
  }));
}

/* ---------- 全画面の流れ ---------- */
function formV2Shell(testid) {
  const ovl = document.createElement("div");
  ovl.className = "ovl resultOvl";
  ovl.innerHTML = `<div class="sheet resultScreen noteScreen fv2Screen" data-testid="${testid}"></div>`;
  return ovl;
}
function formV2NewState(src) {
  const S = {
    src, stage: "", ovl: formV2Shell("form-v2-screen"), hand: db.settings.formHandedness === "left" ? "left" : "right",
    sound: db.settings.formCountSound === true, keepVideo: false, facing: "environment",
    video: document.createElement("video"), stream: null, landmarker: null, source: null, running: false,
    buffer: null, live: null, times: [], fps: 0, mem: {}, t0: NaN, lastT: -Infinity, lastUi: -Infinity, noPoseSince: NaN, lastLms: null,
    recorder: null, recLast: null, recBlob: null, recStart: NaN, recMime: "",
    recEnd: NaN, review: null, urls: [], place: null,
    result: null, records: [], pi: 0, saved: false, savedBytes: 0, overlay: "hold", shot: null, closed: false, startedAt: 0, fileName: "", notice: "",
  };
  /* 36 射を超えた撮影は、いくつかの記録に分かれる（FormV2.buildRecords）。S.record = いま見ている 1 件 */
  Object.defineProperty(S, "record", { get: () => S.records[S.pi] || null, set: (v) => { if (v) S.records[S.pi] = v; else { S.records = []; S.pi = 0; } } });
  S.root = S.ovl.querySelector(".sheet");
  S.video.playsInline = true;
  S.video.muted = true;
  S.video.setAttribute("playsinline", "");
  S.video.className = "fv2Video";
  S.video.dataset.testid = "form-v2-video";
  return S;
}
function formV2Close(S) {
  if (S.closed) return;
  S.closed = true;
  formV2StopCapture(S);
  formV2EndReview(S);
  /* 映像の URL とメモリの中の動画・点の列を手放す（アプリの中には何も残さない） */
  for (const u of S.urls.splice(0)) URL.revokeObjectURL(u);
  if (S.fileUrl) { URL.revokeObjectURL(S.fileUrl); S.fileUrl = null; }
  try { S.video.removeAttribute("src"); S.video.load(); } catch (e) {}
  S.recLast = null;
  if (S.onResize) window.removeEventListener("resize", S.onResize);
  if (S.onHide) document.removeEventListener("visibilitychange", S.onHide);
  S.buffer = null;
  S.result = null;
  S.recBlob = null;
  if (S.workflow) { S.workflow = false; endActiveWorkflow(); }
  if (db.active) wakeLock.acquire(); else wakeLock.release();
  closeModal(S.ovl);
  render();
}
function formV2StopCapture(S) {
  S.running = false;
  if (S.source) { S.source.stop(); S.source = null; }
  formV2StopRec(S);
  const st = S.stream;
  S.stream = null;
  try { if (st) st.getTracks().forEach((t) => t.stop()); } catch (e) {}
  try { S.video.pause(); } catch (e) {}
  S.video.srcObject = null;
}
function formV2Paint(S, stage, html, bind) {
  S.stage = stage;
  S.root.dataset.stage = stage;
  S.root.innerHTML = html;
  S.root.scrollTop = 0;
  if (bind) bind();
}
function formV2TopHtml(label, title, right) {
  return `<div class="subTop fv2Top"><button type="button" class="backBtn" id="fv2Back" data-testid="form-v2-back">${REC_CHEVRON}${esc(label)}</button>${title ? `<span class="fv2Ttl">${title}</span>` : ""}${right || ""}</div>`;
}

/* ---- 困ったとき（design.md 2.11）。生の例外の文は出さない ---- */
const FORM_V2_ERRORS = {
  insecure: ["この開き方ではカメラを使えません。", "カメラは https で開いたときだけ使えます。保存した動画の解析は、この開き方でも使えます。", ["replay", "close"]],
  nocamera: ["カメラが見つかりませんでした。", "この端末かブラウザでは、カメラを使えません。保存した動画の解析は使えます。", ["retry", "replay", "close"]],
  permission: ["カメラを使う許可がありません。", "設定 > Safari > カメラ で「許可」にすると撮影できます。保存した動画の解析は、許可がなくても使えます。", ["retry", "replay", "close"]],
  busy: ["カメラを始められませんでした。", "ほかのアプリがカメラを使っていると始められません。閉じてから、もう一度試してください。", ["retry", "replay", "close"]],
  unsupported: ["この端末では動きません。", "解析の部品が動く条件（iOS 16.4 以降。WebAssembly と SIMD）を満たしていません。記録や設定は変わっていません。", ["close"]],
  model: ["解析の部品（約 15.5MB）を読み込めませんでした。", "通信できる場所で一度開くと、次からは圏外でも使えます。記録や設定は変わっていません。", ["retry", "close"]],
  file: ["動画を読み込めませんでした。", "対応していない形式の可能性があります。写真アプリで撮った動画（mp4・mov）を選んでください。", ["replay", "close"]],
  detect: ["解析が途中で止まりました。", "解析の部品が応答しなくなりました。ここまでに読み込んだぶんは解析できます。", ["analyze", "close"]],
  interrupted: ["撮影が中断されました。", "アプリが裏へ回ったため、カメラが止まりました。", ["analyze", "close"]],
  readStopped: ["動画の読み取りが止まりました。", "アプリが裏へ回ったか、動画の再生が止まりました。", ["analyze", "retry", "close"]],
  analyze: ["解析できませんでした。", "解析の途中で問題が起きました。読み取った点の列は、この画面を閉じるまで残っています。記録や設定は変わっていません。", ["analyze", "close"]],
};
const FORM_V2_STOPPED = ["interrupted", "detect", "readStopped", "analyze"]; // 途中まで読み取ったものが残りうる止まり方
/* 保存していない結果や、まだ解析していない読み取りを捨てる前に確かめる（design.md 2.6）。捨ててよければ true */
async function formV2ConfirmLeave(S) {
  if (S.saved || S.closed) return true;
  if (S.records.length) {
    const tot = formV2Totals(S);
    if (!tot.shots && !tot.events) return true;
    return appConfirm(`${tot.shots} 射の結果を保存せずに閉じますか？`, { danger: true, okLabel: "閉じる" });
  }
  if (!S.buffer || S.buffer.n < 10) return true;
  return appConfirm(`ここまでに読み取った ${formV2Dur(S.buffer.durationMs / 1000)}ぶんを、解析せずに捨てますか？`, { danger: true, okLabel: "捨てる" });
}
function formV2ShowError(S, kind, extra) {
  formV2StopCapture(S);
  const e = FORM_V2_ERRORS[kind] || FORM_V2_ERRORS.busy, has = S.buffer && S.buffer.n >= 10;
  const part = kind === "interrupted" || kind === "readStopped";
  const btn = { retry: [kind === "readStopped" ? "最初から読み直す" : "もう一度試す", "fv2Retry"], replay: ["保存した動画を解析する", "fv2ToReplay"], analyze: [part ? "ここまでを解析する" : kind === "analyze" ? "もう一度解析する" : "解析する", "fv2Analyze"], close: [(part || kind === "analyze") && has ? "捨てる" : "閉じる", "fv2ErrClose"] };
  const acts = e[2].filter((a) => a !== "analyze" || has);
  formV2Paint(S, "error", `${formV2TopHtml("射型", "")}
    <header class="subHead"><h3>射型の記録</h3></header>
    <section class="vsec fv2Err" data-testid="form-v2-error" data-kind="${kind}" role="alert">
      <div class="vsecH"><h2>${kind === "analyze" ? "解析" : FORM_V2_STOPPED.includes(kind) ? "中断" : "始められません"}</h2></div>
      <p class="fact">${esc(e[0])}</p>
      <p class="basis">${esc(e[1])}${extra ? esc(extra) : ""}</p>
      ${acts.map((a, i) => `<div class="btnRow${i ? " fv2Tight" : ""}"><button type="button" class="btn${i ? " sec" : ""}" id="${btn[a][1]}">${btn[a][0]}</button></div>`).join("")}
    </section>`, () => {
    const on = (id, fn) => { const b = S.root.querySelector("#" + id); if (b) b.onclick = fn; };
    const leave = async () => { if (await formV2ConfirmLeave(S)) formV2Close(S); };
    on("fv2Back", leave);
    on("fv2ErrClose", leave);
    /* 保存した動画の解析でつまずいたときは、同じ動画でやり直す（カメラは開かない） */
    on("fv2Retry", () => (S.src === "replay" ? formV2BeginReplay(S) : formV2BeginLive(S)));
    on("fv2ToReplay", () => { formV2Close(S); formV2PickReplay(); });
    on("fv2Analyze", () => formV2Analyze(S));
  });
}
function formV2CameraErrorKind(e) {
  const n = e && e.name;
  if (n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError") return "permission";
  if (n === "NotFoundError" || n === "OverconstrainedError" || n === "DevicesNotFoundError") return "nocamera";
  return "busy";
}

/* ---- 撮影: 入口 ---- */
function formV2StartLive() {
  const S = formV2NewState("live");
  openModal(S.ovl, { escapeTarget: "#fv2Back", swipe: false });
  S.workflow = true;
  beginActiveWorkflow();
  S.onResize = () => { if (S.stage === "result" || S.stage === "shot") formV2Rerender(S); };
  window.addEventListener("resize", S.onResize);
  /* アプリが裏へ回るとカメラが止まる。ここまでのぶんを残して知らせる */
  S.onHide = () => {
    if (document.hidden && S.stage === "capture" && S.running) {
      const sec = S.buffer ? S.buffer.durationMs / 1000 : 0;
      formV2ShowError(S, "interrupted", `ここまでの ${formV2Dur(sec)}は残っています。`);
    }
  };
  document.addEventListener("visibilitychange", S.onHide);
  formV2BeginLive(S);
  return S;
}
function formV2BeginLive(S) {
  if (window.isSecureContext !== true) return formV2ShowError(S, "insecure");
  if (formV2Unsupported()) return formV2ShowError(S, "unsupported");
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") return formV2ShowError(S, "nocamera");
  formV2PaintPlace(S, "解析の部品を読み込んでいます（初回だけ約 15.5MB）。");
  const token = (S.token = {});
  loadFormPose().then((lm) => {
    if (S.closed || S.token !== token) return null;
    S.landmarker = lm;
    formV2SetPlaceNote(S, "カメラを始めています。");
    return formV2StartCamera(S, token);
  }, () => { if (!S.closed && S.token === token) formV2ShowError(S, "model"); });
}
async function formV2StartCamera(S, token) {
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: S.facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    if (S.closed || S.token !== token) { stream.getTracks().forEach((t) => t.stop()); return; }
    S.stream = stream;
    S.video.srcObject = stream;
    await S.video.play();
    if (S.closed || S.token !== token) return;
  } catch (e) {
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    if (S.closed || S.token !== token) return;
    S.stream = null;
    formV2ShowError(S, formV2CameraErrorKind(e));
    return;
  }
  wakeLock.acquire();
  S.running = true;
  S.times = [];
  S.mem = {};
  formV2SetPlaceNote(S, "");
  const start = S.root.querySelector("#fv2Begin");
  if (start) start.disabled = false;
  /* 新しい映像は、コマの時刻が 0 から始まり直す。前の映像の時刻と比べて、コマを捨てたり表示を止めたりしない */
  S.lastT = -Infinity;
  S.lastUi = -Infinity;
  S.source = formV2FrameSource(S.video, false);
  S.source.start((t) => formV2OnFrame(S, t));
}
/* 1 コマ: 姿勢推定 → 置き方の確認、または バッファへ足す */
function formV2OnFrame(S, tMs) {
  if (!S.running || !S.landmarker || !(tMs > S.lastT)) return;
  const v = S.video, vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh || v.readyState < 2) return;
  let res;
  try { res = S.landmarker.detectForVideo(v, performance.now()); } catch (e) { formV2ShowError(S, "detect"); return; }
  S.lastT = tMs;
  const lms = res && res.landmarks && res.landmarks[0] ? res.landmarks[0] : null;
  S.lastLms = lms;
  S.times.push(tMs);
  if (S.times.length > 30) S.times.shift();
  if (S.times.length >= 5) S.fps = ((S.times.length - 1) * 1000) / (S.times[S.times.length - 1] - S.times[0]);
  if (S.stage === "place") { formV2PlaceFrame(S, lms, vw, vh, tMs); return; }
  if (S.stage !== "capture" && S.stage !== "reading") return;
  if (!Number.isFinite(S.t0)) S.t0 = tMs;
  const rel = tMs - S.t0;
  S.buffer.push(rel, lms, vw, vh);
  if (lms) S.noPoseSince = NaN; else if (!Number.isFinite(S.noPoseSince)) S.noPoseSince = rel;
  if (S.stage === "reading") { if (rel - S.lastUi >= 500) { S.lastUi = rel; formV2ReadingTick(S, rel); } return; }
  if (S.live.due(rel)) {
    const before = S.live.shots, r = S.live.update(S.buffer, S.hand, S.fps);
    if (r.shots !== before) { formV2CaptureCount(S); if (S.sound) formV2Beep(); nativePulse("light"); }
  }
  if (S.recorder && rel - S.recStart >= FormV2.LIMITS.VIDEO_MS) { formV2StopRec(S); S.notice = "動画は 10 分になったので止めました。解析は続けています。"; formV2RecButton(S); }
  if (rel - S.lastUi >= 500) { S.lastUi = rel; formV2CaptureTick(S, rel, lms); }
  if (rel >= FormV2.LIMITS.MAX_MS || S.buffer.full) { S.limitHit = true; formV2Analyze(S); }
}

/* ---- 置き方を確かめる（design.md 2.3） ---- */
function formV2PaintPlace(S, note) {
  const row = (r) => `<div class="lrow fv2Chk${r.state === "warn" ? " bad" : ""}" data-row="${r.k}" data-state="${r.state}"><span class="lk">${r.k}</span><span class="lv">${esc(r.text)}</span><span class="pill fv2Pill ${r.state}">${{ ok: "通過", warn: "注意", info: "案内", wait: "確認中" }[r.state]}</span></div>`;
  const rows = FormV2.placement(null, { w: 0, h: 0 }, S.hand, 0, {}).rows.map((r) => ({ ...r, state: "wait", text: "カメラが始まると測ります" }));
  formV2Paint(S, "place", `${formV2TopHtml("やめる", "置き方を確かめる")}
    <div class="fv2Cam bleed" id="fv2Cam"><canvas id="fv2Canvas" aria-hidden="true"></canvas><span class="fv2Tag" id="fv2Tag"></span></div>
    <p class="basis fv2Note" id="fv2Note" role="status">${esc(note || "")}</p>
    <div class="fv2Rows" id="fv2Rows" data-testid="form-v2-checks">${rows.map(row).join("")}</div>
    <section class="vsec"><div class="vsecH"><h2>撮り方</h2><span class="aside">変えなければこのまま</span></div>
      <div class="fv2Opt"><div><b>利き手</b><span>引く手</span></div>${formV2SegHtml("hand", S.hand, [["right", "右"], ["left", "左"]])}</div>
      <div class="fv2Opt"><div><b>数えた合図の音</b><span>1 射ごとに短い音</span></div>${formV2SegHtml("sound", S.sound ? "on" : "off", [["off", "切"], ["on", "入"]])}</div>
      <div class="fv2Opt"><div><b>動画も残す</b><span>最長 10 分。端末に保存するまで残りません</span></div>${formV2SegHtml("video", S.keepVideo ? "on" : "off", [["off", "切"], ["on", "入"]])}</div>
      <div class="fv2Opt"><div><b>カメラ</b><span>背面が既定です</span></div>${formV2SegHtml("facing", S.facing, [["environment", "背面"], ["user", "前面"]])}</div>
      <p class="basis">台は胸の高さ、射線の真横、約 3m（縦向きは約 2.6m）が目安です。縦向きでも横向きでも、測る値は同じです。置いたあと一度、弓を上げて引く形をすると、余白と向きを確かめられます。</p>
    </section>
    <div class="actbar"><button type="button" class="btn pri" id="fv2Begin" data-testid="form-v2-begin" ${S.running ? "" : "disabled"}>記録を始める</button></div>`, () => {
    S.root.querySelector("#fv2Cam").prepend(S.video);
    S.rowHtml = row;
    S.root.querySelector("#fv2Back").onclick = () => formV2Close(S);
    S.root.querySelector("#fv2Begin").onclick = () => formV2BeginCapture(S);
    S.root.querySelectorAll("[data-seg] button").forEach((b) => (b.onclick = () => {
      const name = b.parentElement.dataset.seg, val = b.dataset.val;
      b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      if (name === "hand") { S.hand = val; S.mem = {}; db.settings.formHandedness = val; save(); }
      if (name === "sound") { S.sound = val === "on"; db.settings.formCountSound = S.sound; save(); if (S.sound) formV2Beep(); }
      if (name === "video") S.keepVideo = val === "on";
      if (name === "facing" && S.facing !== val) { S.facing = val; S.mem = {}; formV2StopCapture(S); formV2BeginLive(S); }
    }));
  });
}
function formV2SetPlaceNote(S, text) {
  const n = S.root.querySelector("#fv2Note");
  if (n) n.textContent = text;
}
function formV2PlaceFrame(S, lms, vw, vh, tMs) {
  const cv = S.root.querySelector("#fv2Canvas");
  if (cv) {
    if (cv.width !== vw || cv.height !== vh) { cv.width = vw; cv.height = vh; }
    const ctx = cv.getContext("2d"), mx = vw * 0.06;
    ctx.clearRect(0, 0, vw, vh);
    ctx.strokeStyle = "rgba(223,229,234,.8)";
    ctx.lineWidth = Math.max(2, vw / 240);
    ctx.setLineDash([vw / 60, vw / 60]);
    ctx.strokeRect(mx, vh * 0.04, vw - 2 * mx, vh * 0.92);
    ctx.setLineDash([]);
    if (lms) {
      ctx.strokeStyle = "#a8c7ac";
      ctx.fillStyle = "#a8c7ac";
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const [a, b] of [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]]) {
        const p = lms[a], q = lms[b];
        if (p && q) { ctx.moveTo(p.x * vw, p.y * vh); ctx.lineTo(q.x * vw, q.y * vh); }
      }
      ctx.stroke();
      for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24]) { const p = lms[i]; if (p) { ctx.beginPath(); ctx.arc(p.x * vw, p.y * vh, Math.max(4, vw / 120), 0, Math.PI * 2); ctx.fill(); } }
    }
  }
  if (tMs - S.lastUi < 250) return;
  S.lastUi = tMs;
  const p = FormV2.placement(lms, { w: vw, h: vh }, S.hand, S.fps, S.mem), box = S.root.querySelector("#fv2Rows"), tag = S.root.querySelector("#fv2Tag");
  S.place = { rows: p.rows, tpx: p.tpx, left: S.mem.left, right: S.mem.right, rho: S.mem.rho }; // 始めたときの確認の結果（検証用の診断に入れる）
  if (box) box.innerHTML = p.rows.map(S.rowHtml).join("");
  if (tag) tag.textContent = `${vw < vh ? "縦向き" : vw > vh ? "横向き" : "正方形"} ${vw}×${vh}`;
}

/* ---- 撮る（design.md 2.4）: 大きな射数だけ ---- */
function formV2BeginCapture(S) {
  S.buffer = FormV2.makeBuffer();
  S.live = FormV2.makeLiveCounter(FormAnalyze);
  S.t0 = NaN;
  S.lastUi = -Infinity;
  S.noPoseSince = NaN;
  S.startedAt = Date.now();
  S.notice = "";
  S.limitHit = false;
  formV2Paint(S, "capture", `<div class="subTop fv2Top"><button type="button" class="backBtn" id="fv2Back" data-testid="form-v2-cancel">${REC_CHEVRON}取り消す</button><span class="fv2Ttl" id="fv2Clock" data-testid="form-v2-clock">記録中 0:00</span>
      <button type="button" class="fv2RecBtn" id="fv2Rec" data-testid="form-v2-rec" aria-pressed="false"></button></div>
    <div class="fv2Count" data-testid="form-v2-count" aria-live="polite"><span class="lab">数えた射（目安）</span><span class="num" id="fv2Num">0</span><span class="sub" id="fv2Ld"></span></div>
    <div class="fv2Thumb" id="fv2Thumb" aria-hidden="true"></div>
    <div class="fv2State" id="fv2State" data-testid="form-v2-state" role="status">体を探しています。</div>
    <p class="basis">数は離れの 4〜5 秒あとに増えます。終わったあと、全体を見直して数え直します。射の最中に読む表示は出しません。</p>
    <div class="actbar"><button type="button" class="btn pri" id="fv2Finish" data-testid="form-v2-finish">終わって結果を見る</button></div>`, () => {
    S.root.querySelector("#fv2Thumb").appendChild(S.video);
    S.root.querySelector("#fv2Back").onclick = async () => {
      if (await appConfirm("この撮影を取り消しますか？何も残りません。", { danger: true, okLabel: "取り消す", cancelLabel: "続ける" })) formV2Close(S);
    };
    S.root.querySelector("#fv2Finish").onclick = () => formV2Analyze(S);
    S.root.querySelector("#fv2Rec").onclick = () => {
      if (S.recorder) { formV2StopRec(S); S.notice = "動画を止めました。結果の画面から端末に保存できます。"; } else if (!formV2StartRec(S)) S.notice = "この端末では動画を残せません。";
      formV2RecButton(S);
      nativePulse("light");
    };
    if (S.keepVideo) formV2StartRec(S);
    formV2RecButton(S);
  });
}
function formV2CaptureCount(S) {
  const num = S.root.querySelector("#fv2Num"), ld = S.root.querySelector("#fv2Ld");
  if (num) num.textContent = S.live.shots;
  if (ld) ld.textContent = S.live.letdowns ? `引き戻し ${S.live.letdowns} 回` : "";
}
function formV2CaptureTick(S, rel, lms) {
  const clock = S.root.querySelector("#fv2Clock"), state = S.root.querySelector("#fv2State");
  if (clock) clock.textContent = `記録中 ${formV2Mmss(rel / 1000)}`;
  if (!state) return;
  const st = FormV2.captureState(lms, S.fps, Number.isFinite(S.noPoseSince) ? rel - S.noPoseSince : 0);
  let text = st.text, warn = st.warn;
  if (rel >= FormV2.LIMITS.WARN_MS) { text = "あと 1 分で 30 分の上限です。上限になると、撮影を止めて解析へ進みます。"; warn = true; } else if (!warn) {
    if (S.recorder) text += `動画は残り ${formV2Dur((FormV2.LIMITS.VIDEO_MS - (rel - S.recStart)) / 1000)}。`;
    if (S.notice) text += S.notice;
  }
  state.textContent = text;
  state.classList.toggle("warn", warn);
}
/* 動画（design.md 2.10）: 撮りながらメモリにためる。アプリの中には保存しない */
function formV2StartRec(S) {
  if (S.recorder || !S.stream || typeof MediaRecorder === "undefined") return false;
  const mime = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
  try {
    const rec = new MediaRecorder(S.stream, { mimeType: mime, videoBitsPerSecond: 1500000 });
    /* かたまりは録画ごとに別の配列へためる。前の録画の止まる合図があとから届いても、次の録画の先頭（ヘッダ）を消さない */
    const chunks = [];
    S.recBlob = null;
    S.recMime = mime;
    S.recLast = rec;
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      if (S.closed || S.recLast !== rec) return; // 取り直したあとに届いた、前の録画
      if (chunks.length) S.recBlob = new Blob(chunks, { type: mime });
      if (S.stage === "result") formV2Rerender(S);
    };
    rec.start(1000);
    S.recorder = rec;
    S.recStart = Number.isFinite(S.t0) ? S.lastT - S.t0 : 0;
    return true;
  } catch (e) {
    S.recorder = null;
    return false;
  }
}
function formV2StopRec(S) {
  const r = S.recorder;
  if (r) S.recEnd = Number.isFinite(S.t0) ? S.lastT - S.t0 : 0;
  S.recorder = null;
  try { if (r && r.state !== "inactive") r.stop(); } catch (e) {}
}
function formV2RecButton(S) {
  const b = S.root.querySelector("#fv2Rec");
  if (!b) return;
  const on = !!S.recorder;
  b.setAttribute("aria-pressed", String(on));
  b.classList.toggle("on", on);
  b.innerHTML = `<i aria-hidden="true"></i>${on ? "録画を止める" : S.recBlob ? "もう一度録画" : "動画を残す"}`;
}
async function formV2ShareVideo(S) {
  const blob = S.recBlob;
  if (!blob) return;
  const ext = blob.type.includes("mp4") ? "mp4" : "webm", file = new File([blob], `archery-form-${S.record ? S.record.date : today()}.${ext}`, { type: blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
    else {
      const u = URL.createObjectURL(blob), a = document.createElement("a");
      S.urls.push(u);
      a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => { const i = S.urls.indexOf(u); if (i >= 0) { S.urls.splice(i, 1); URL.revokeObjectURL(u); } }, 1000);
      toast("動画を書き出しました");
    }
  } catch (e) { if (!e || e.name !== "AbortError") toast("動画を書き出せませんでした", 4000); }
}

/* ---- 保存した動画を解析する（design.md 2.10）: 同じバッファ → 同じ解析器 ---- */
function formV2PickReplay() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "video/*";
  input.onchange = () => { const f = input.files[0]; if (f) formV2StartReplay(f); };
  input.click();
}
function formV2StartReplay(file) {
  const S = formV2NewState("replay");
  openModal(S.ovl, { escapeTarget: "#fv2Back", swipe: false });
  S.workflow = true;
  beginActiveWorkflow();
  S.onResize = () => { if (S.stage === "result" || S.stage === "shot") formV2Rerender(S); };
  window.addEventListener("resize", S.onResize);
  /* アプリが裏へ回ると動画の再生が止まる。ここまでに読み取ったぶんを残して知らせる */
  S.onHide = () => { if (document.hidden && S.stage === "reading" && S.running) formV2ReadStopped(S); };
  document.addEventListener("visibilitychange", S.onHide);
  S.fileName = file.name || "";
  /* 日付は動画のファイルから（lastModified）。結果の画面で変えられる。今日の練習には紐づけない */
  const d = new Date(Number.isFinite(file.lastModified) && file.lastModified > 0 ? file.lastModified : Date.now());
  S.fileTs = d.getTime();
  S.fileDate = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  S.fileUrl = URL.createObjectURL(file);
  formV2BeginReplay(S);
  return S;
}
function formV2ReadStopped(S) {
  const has = S.buffer && S.buffer.n >= 10;
  formV2ShowError(S, "readStopped", has ? `ここまでの ${formV2Dur(S.buffer.durationMs / 1000)}は残っています。` : "");
}
/* 動画を最初から読み取る。部品の読み込みに失敗したあとや、読み取りが止まったあとのやり直しも、同じ動画でここから始める */
function formV2BeginReplay(S) {
  if (formV2Unsupported()) { formV2ShowError(S, "unsupported"); return; }
  formV2StopCapture(S);
  S.buffer = null;
  S.result = null;
  S.record = null;
  S.times = [];
  S.fps = 0;
  S.noPoseSince = NaN;
  formV2Paint(S, "reading", `${formV2TopHtml("やめる", "動画を読み込む")}
    <div class="fv2Cam bleed" id="fv2Cam"></div>
    <section class="vsec"><div class="vsecH"><h2>読み込んでいます</h2><span class="aside" id="fv2ReadPos" data-testid="form-v2-read-pos">0:00</span></div>
      <p class="fact" id="fv2ReadFact" role="status">解析の部品を読み込んでいます（初回だけ約 15.5MB）。</p>
      <p class="basis">動画を最後まで再生しながら、体の点を読み取ります。動画はこの端末の中だけで扱い、アプリの中には保存しません。利き手: ${S.hand === "left" ? "左" : "右"}（撮影の「撮り方」で変えられます）。</p>
    </section>`, () => {
    S.root.querySelector("#fv2Cam").appendChild(S.video);
    S.root.querySelector("#fv2Back").onclick = () => formV2Close(S);
  });
  const token = (S.token = {});
  loadFormPose().then((lm) => {
    if (S.closed || S.token !== token) return;
    S.landmarker = lm;
    S.buffer = FormV2.makeBuffer();
    S.t0 = 0;
    S.lastT = -Infinity;
    S.lastUi = -Infinity;
    S.startedAt = S.fileTs;
    const v = S.video;
    v.preload = "auto";
    v.onerror = () => { if (!S.closed && S.stage === "reading") formV2ShowError(S, "file"); };
    /* 読み取りの途中で再生が止まった（最後まで行ったときの pause は除く）。読み取れたぶんを解析できるようにする */
    v.onpause = () => { if (!S.closed && S.stage === "reading" && S.running && !v.ended) formV2ReadStopped(S); };
    v.onloadeddata = () => {
      if (S.closed || S.stage !== "reading" || S.token !== token || S.running) return;
      wakeLock.acquire(); // 読み取りのあいだ、画面を消さない（閉じるときに手放す）
      S.running = true;
      S.source = formV2FrameSource(v, true);
      S.source.start((t) => formV2OnFrame(S, t), () => formV2Analyze(S));
      const fact = S.root.querySelector("#fv2ReadFact");
      if (fact) fact.textContent = "体の点を読み取っています。";
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => { if (!S.closed && S.stage === "reading") formV2ShowError(S, "file"); });
    };
    v.src = S.fileUrl;
    v.load();
  }, () => { if (!S.closed && S.token === token) formV2ShowError(S, "model"); });
}
function formV2ReadingTick(S, rel) {
  const pos = S.root.querySelector("#fv2ReadPos"), d = S.video.duration;
  if (pos) pos.textContent = Number.isFinite(d) && d > 0 ? `${formV2Mmss(rel / 1000)} / ${formV2Mmss(d)}` : formV2Mmss(rel / 1000);
}

/* ---- 解析する（design.md 2.5） ---- */
function formV2RhoRef(hand) {
  const rhos = (db.formAnalyses || []).filter((r) => FormV2.isV2(r) && r.cap.hand === hand && r.v2.view && r.v2.view.rho > 0).map((r) => r.v2.view.rho / 1000);
  return rhos.length >= 3 ? Math.max(...rhos) : undefined;
}
function formV2Analyze(S) {
  if (S.stage === "analyzing" || !S.buffer) return;
  const frame = S.buffer.frame, fpsSeen = S.fps;
  formV2StopCapture(S);
  const step = (b, s, done) => `<div class="lrow"><span class="lmain"><b>${b}</b><span>${s}</span></span><span class="pill fv2Pill ${done ? "ok" : ""}">${done ? "済" : "計算中"}</span></div>`;
  const dur = S.buffer.durationMs / 1000, n = S.buffer.n;
  const head = `${formV2TopHtml("やめる", "")}<header class="subHead"><h3>解析しています</h3></header>`;
  const read = `${formV2Dur(dur)}、${n.toLocaleString("ja-JP")} コマ${dur > 0 ? `（毎秒 ${Math.round(n / dur)} コマ）` : ""}`;
  formV2Paint(S, "analyzing", `${head}<div class="fv2Steps" data-testid="form-v2-steps">${step("記録を読み込む", read, true)}${step("射を探す", "…", false)}${step("射ごとの値を測る", "…", false)}${step("測定のゆれを見積もる", "…", false)}</div>
    <p class="basis">映像は保存していません。解析に使った点の列は、結果の画面を閉じると消えます。</p>`, () => {
    S.root.querySelector("#fv2Back").onclick = async () => { if (await formV2ConfirmLeave(S)) formV2Close(S); };
  });
  /* 解析や記録の組み立てで例外が起きても「計算中」のまま止まらない。点の列を残して、やり直せる画面を出す */
  const failed = (e) => {
    if (e) console.error(e);
    S.result = null;
    S.record = null;
    formV2ShowError(S, "analyze");
  };
  setTimeout(() => {
    if (S.closed) return;
    try { run(); } catch (e) { failed(e); }
  }, 30);
  function run() {
    const diag = db.settings.formDebug === true; // 検証用: 解析器の中の値も受け取る（数え方は変わらない）
    const result = FormAnalyze.analyzePacked(S.buffer.pack(S.hand), { handedness: S.hand, fps: fpsSeen || 30, rhoRef: formV2RhoRef(S.hand), debug: diag });
    if (!result || !result.quality || (result.quality.warnings || []).includes("internalError")) { failed(null); return; }
    S.result = result;
    const replay = S.src === "replay";
    const date = replay ? S.fileDate : today();
    const linked = replay ? null : db.sessions.filter((s) => s && s.date === date).slice(-1)[0] || null;
    const nShots = result.shots.filter((x) => x.kind === "shot").length, nParts = Math.max(1, Math.ceil(nShots / FormV2.LIMITS.MAX_SHOTS));
    S.pi = 0;
    S.records = FormV2.buildRecords(result, {
      id: uid(), ids: Array.from({ length: nParts - 1 }, () => uid()), date, ts: S.startedAt || Date.now(), sessionId: linked ? linked.id : null, setupId: linked ? linked.setupId || null : null,
      appVer: APP_VER, modelVer: FORM_V2_MODEL, frame, facing: replay ? null : S.facing, hand: S.hand, src: S.src,
      note: replay ? "(保存済み動画から解析)" : "", diag, placement: replay ? null : S.place,
    });
    const tot = formV2Totals(S), m = FormV2.read(S.record), q = result.quality, shots = tot.shots, df = Math.max(0, ...FormV2.COLS.map((k) => (FormV2.META[k].unit === "s" ? 0 : m.df[k] || 0)));
    const found = `${shots} 射、引き戻し ${tot.letdowns} 回。${tot.openCands ? `離れがはっきり写らなかった保持 ${tot.openCands} 回` : "離れがはっきり写らなかった保持 なし"}${S.records.length > 1 ? `。1 つの記録は ${FormV2.LIMITS.MAX_SHOTS} 射までなので、${S.records.length} つの記録に分けます` : ""}`;
    const vals = shots ? `${shots} 射 × ${FormV2.keysFor(S.record).length} 項目。${formV2ViewText(S.record.v2.view)}` : "射が無いので測っていません";
    const noise = df ? `保持の中の区間どうしの差 ${df} 個から` : "見積もれる保持がありませんでした";
    const any = tot.events > 0;
    const warns = q.warnings || [];
    const why = warns.includes("tooShort") ? "記録が短すぎました（10 コマ未満）。"
      : warns.includes("noBody") ? "体の点が取れませんでした。上半身と両腕が入る向きに置いてください。"
        : warns.includes("noFullDraw") ? "引き切った区間が見つかりませんでした。射線の真後ろや真上から撮ると、引き尺が写りません。置き方を確かめてください。"
          : "引いて保持した区間はありましたが、射として数えられる離れは見つかりませんでした。";
    const zero = !shots;
    formV2Paint(S, "analyzing", `${head.replace("解析しています", zero ? "射が見つかりませんでした" : "解析が終わりました")}
      ${S.limitHit ? `<p class="fact" data-testid="form-v2-limit">30 分（またはコマ数の上限）になったので、撮影を止めました。</p>` : ""}
      <div class="fv2Steps" data-testid="form-v2-steps">${step("記録を読み込む", read, true)}${step("射を探す", found, true)}${step("射ごとの値を測る", vals, true)}${step("測定のゆれを見積もる", noise, true)}</div>
      ${zero ? `<section class="vsec" data-testid="form-v2-zero"><div class="vsecH"><h2>考えられる理由</h2></div><p class="fact">射として数えた区間は 0 回でした。</p><p class="basis">${why}</p>
        ${S.src === "live" ? `<div class="btnRow"><button type="button" class="btn" id="fv2Again">置き方を確かめる</button></div>` : ""}
        ${any ? `<div class="btnRow fv2Tight"><button type="button" class="btn sec" id="fv2Show">見つけた区間を見る</button></div>` : ""}
        <div class="btnRow fv2Tight"><button type="button" class="btn sec" id="fv2ZeroClose">閉じる</button></div></section>` : ""}
      <p class="basis">映像は保存していません。解析に使った点の列は、結果の画面を閉じると消えます。</p>
      ${zero ? "" : `<div class="actbar"><button type="button" class="btn pri" id="fv2Show" data-testid="form-v2-show">結果を見る</button></div>`}`, () => {
      const on = (id, fn) => { const b = S.root.querySelector("#" + id); if (b) b.onclick = fn; };
      const leave = async () => { if (await formV2ConfirmLeave(S)) formV2Close(S); };
      on("fv2Back", leave);
      on("fv2ZeroClose", leave);
      on("fv2Show", () => formV2PaintResult(S));
      on("fv2Again", () => { S.buffer = null; S.result = null; S.record = null; S.recBlob = null; formV2BeginLive(S); });
    });
  }
}

/* この撮影の全部の記録を合わせた数 */
function formV2Totals(S) {
  const t = { shots: 0, letdowns: 0, openCands: 0, events: 0 };
  for (const r of S.records) { const m = FormV2.read(r); t.shots += m.count; t.letdowns += m.letdowns; t.openCands += m.openCands; t.events += m.events.length; }
  return t;
}

/* ---- 結果（design.md 2.6） ---- */
function formV2OpenRecord(rec) {
  const S = formV2NewState(rec.cap && rec.cap.src === "replay" ? "replay" : "live");
  /* 36 射を超えて分けた記録は、同じ撮影のほかの記録も読み、行き来できるようにする */
  const cid = rec.v2 && rec.v2.cid, sibs = cid ? (db.formAnalyses || []).filter((r) => FormV2.isV2(r) && r.v2.cid === cid).sort((a, b) => (a.v2.part ? a.v2.part[0] : 0) - (b.v2.part ? b.v2.part[0] : 0)) : [rec];
  S.records = cloneData(sibs.length ? sibs : [rec]);
  S.pi = Math.max(0, S.records.findIndex((r) => r.id === rec.id));
  S.saved = true;
  S.stored = true; // 一覧から開いた保存済みの記録
  openModal(S.ovl, { escapeTarget: "#fv2Back", swipe: false });
  S.onResize = () => formV2Rerender(S);
  window.addEventListener("resize", S.onResize);
  formV2PaintResult(S);
  return S;
}
function formV2Rerender(S) {
  if (S.stage === "review") return;
  const top = S.root.scrollTop;
  if (S.stage === "shot") formV2PaintShot(S, S.shot); else formV2PaintResult(S);
  S.root.scrollTop = top;
}
function formV2SessionLabel(s) {
  const arrows = (s.ends || []).reduce((n, e) => n + (Array.isArray(e) ? e.length : 0), 0);
  return `${fmtMD(s.date)} ${s.dist ? s.dist + "m" : ""}・${arrows}射`;
}
function formV2PaintResult(S) {
  const rec = S.record, model = FormV2.read(rec), cmp = FormV2.compare(model, FormAnalyze), height = formV2Height(), v = rec.v2;
  const sum = FormV2.summary(model, cmp, height), first = cmp.flags[0] || null;
  const mine = first ? cmp.flags.filter((f) => f.n === first.n) : [];
  const others = [...new Set(cmp.flags.map((f) => f.n))].filter((n) => !first || n !== first.n);
  const time = new Date(rec.ts || Date.now()), hhmm = `${time.getHours()}:${String(time.getMinutes()).padStart(2, "0")}`;
  const valText = (f) => {
    const ref = cmp.feat[f.key].median, x = FormV2.shown(f.key, f.value, ref), o = f.others.map((t) => FormV2.shown(f.key, t, ref)).filter(Number.isFinite), cm = FormV2.cmText(f.key, x, height), b = FormV2.META[f.key].unit === "b" && !FormV2.META[f.key].rel ? "胴の " : "";
    return `<div class="lrow"><span class="lk">${esc(FormV2.META[f.key].name)}</span><span class="lv">${formV2ValHtml(f.key, x, cm)}<small>ほかの ${o.length} 射 ${b}${FormV2.fmt(f.key, Math.min(...o), { bare: true })}〜${FormV2.fmt(f.key, Math.max(...o))}</small></span></div>`;
  };
  let basis = "";
  if (first) {
    const ft = cmp.feat[first.key], ref = ft.median, k = first.key, dp = Math.max(1, FormV2.META[k].dp);
    const d = FormV2.shown(k, first.value, ref) - FormV2.median(first.others.map((t) => FormV2.shown(k, t, ref)));
    basis = `ほかの ${first.others.length} 射の中央値との差は ${FormV2.fmt(k, d, { sign: true, dp })}、この回の測定のゆれ（±${FormV2.fmt(k, FormV2.shownSize(k, ft.noise, ref), { dp })}）から出せる下限は ${FormV2.fmt(k, FormV2.shownSize(k, ft.limit, ref), { dp })} です。`;
  }
  const lowConf = model.events.filter((e) => e.kind === "shot" && e.counted && e.conf < 6).map((e) => e.n);
  const keys = FormV2.keysFor(rec, FormAnalyze.DEFAULT_KEYS);
  const hiRow = first ? first.row : -1;
  const sessions = (db.sessions || []).filter((s) => s && s.date === rec.date);
  const linkOpts = `<option value="">紐づけない</option>${sessions.map((s) => `<option value="${esc(s.id)}"${s.id === rec.sessionId ? " selected" : ""}>${esc(formV2SessionLabel(s))}</option>`).join("")}`;
  const warnText = { small: "体が小さく写っていました（胴の長さ 100px 未満）。位置の項目は粗くなります。", lowFps: "毎秒 15 コマ未満でした。離れの時刻は粗くなります。", gappy: "姿勢が取れなかったコマが 2 割を超えました。値が欠けた射があります。", steep: "弓手の腕がかなり上を向いていました（長い距離）。検出の境目に近い置き方です。", timeGap: "コマの時刻が 5 秒より大きく飛んだ所がありました。その前後は、つながっていない区間として解析しています。", truncated: "記録が長すぎたので、終わりの部分は解析していません。" };
  const warns = (v.w || []).filter((w) => warnText[w]).map((w) => `<p class="basis">${warnText[w]}</p>`).join("");
  const bytes = S.records.reduce((n, r) => n + JSON.stringify(r).length, 0);
  const mb = S.recBlob ? Math.max(0.1, S.recBlob.size / 1e6) : 0;
  const many = S.records.length > 1, tot = formV2Totals(S), review = formV2CanReview(S), diag = db.settings.formDebug === true;
  const partsHtml = many ? `<section class="vsec" data-testid="form-v2-parts"><div class="vsecH"><h2>分けた記録</h2><span class="aside">${S.pi + 1} / ${S.records.length}</span></div>
      <p class="basis">この撮影は ${tot.shots} 射でした。1 つの記録に入るのは ${FormV2.LIMITS.MAX_SHOTS} 射までなので、${S.records.length} つの記録に分けてあります。どの射も入っています。射の番号は撮影の通し番号で、射どうしを比べるのは、それぞれの記録の中です。</p>
      <div class="fv2SegRow">${formV2SegHtml("part", String(S.pi), S.records.map((r, i) => { const pm = FormV2.read(r); return [String(i), pm.count ? `${pm.offset + 1}〜${pm.offset + pm.count}` : `${i + 1} つめ`]; }))}</div></section>` : "";
  formV2Paint(S, "result", `${formV2TopHtml("射型", "")}
    <header class="subHead fv2Head"><h3>${fmtMDW(rec.date)}の記録</h3><span class="viewDate">${hhmm}〜<br>${formV2Dur(model.dur)}</span></header>
    ${partsHtml}
    <section class="vsec" data-testid="form-v2-summary"><div class="vsecH"><h2>この回</h2>${S.saved ? `<span class="aside">${rec.cap.src === "replay" ? "保存した動画" : "撮影"}</span>` : `<button type="button" class="txtBtn fv2FixBtn" id="fv2Fix" data-testid="form-v2-fix-open">射数を直す</button>`}</div>
      <div class="figs two"><div class="fig"><div class="l">射</div><div class="n" data-testid="form-v2-shots">${model.count}<small>射</small></div><div class="d">${model.added || model.removed ? `直した数: 足した ${model.added}・外した ${model.removed}` : `離れがはっきり写った射 ${model.count}`}</div></div>
        <div class="fig"><div class="l">引き戻し</div><div class="n" data-testid="form-v2-letdowns">${model.letdowns}<small>回</small></div><div class="d">射に数えていません</div></div></div>
      <div class="fv2Chart fv2Timeline">${formV2TimelineSvg(model)}</div>
      <div class="fv2Legend"><span><i class="k1"></i>保持</span><span><i class="k2"></i>離れ</span><span><i class="k3"></i>戻 = 引き戻し</span>${model.openCands ? `<span><i class="k4"></i>？ = 数えていない保持</span>` : ""}${model.removed ? `<span><i class="k3"></i>外 = 外した射</span>` : ""}</div>
      ${model.openCands ? `<p class="basis" data-testid="form-v2-cand-note">離れがはっきり写らなかった保持が ${model.openCands} 回あります。射かもしれませんが、数には入れていません。${S.saved ? "" : "「射数を直す」で足せます。"}</p>` : ""}
      ${lowConf.length ? `<p class="basis">${lowConf.join("・")} 射目は、離れの位置の決め手が弱めでした。数には入れています。動画があれば確かめてください。</p>` : ""}
    </section>
    <section class="vsec" data-testid="form-v2-diff"><div class="vsecH"><h2>ほかと違った射</h2><span class="aside">${first ? `${first.n} 射目` : "なし"}</span></div>
      <p class="fact" data-testid="form-v2-sentence">${esc(sum.text)}</p>
      ${mine.length > 1 ? `<p class="basis fv2Gap">同じ射で、ほかにも ${mine.length - 1} 項目が違いました。</p>${mine.slice(1).map(valText).join("")}` : ""}
      ${others.length ? `<p class="basis fv2Gap">${others.join("・")} 射目にも、下限を超えた違いがあります。射の詳細で見られます。</p>` : ""}
      ${cmp.n >= 4 ? `<p class="basis fv2Gap">${basis}${first ? "どれも" : "違いの印は、"}この回の測定のゆれから出せる下限を超えた${first ? "違いです" : "ときだけ出します"}。測定のゆれだけでこの欄に何か出る確率は、1 回の記録につき約 5% に抑えています。良し悪しの判定ではありません。</p>` : ""}
      ${model.compared.length ? `<button type="button" class="lrow link" id="fv2ToShot" data-testid="form-v2-to-shot"><span class="lmain"><b>${first ? `${first.n} 射目を見る` : "射ごとの値を見る"}</b><span>ほかの射の中央と重ねて比べます</span></span>${FORM_V2_GO}</button>` : ""}
    </section>
    ${model.compared.length ? `<section class="vsec" data-testid="form-v2-charts"><div class="vsecH"><h2>そろい方</h2><span class="aside">${cmp.n} 射・射の順</span></div>
      <div class="fv2Legend"><span><i class="k5"></i>この幅の中は、違いと言えません</span><span><i class="k6"></i>違った射</span></div>
      ${keys.map((k) => formV2RunChartHtml(model, cmp, k)).join("")}
      <p class="basis fv2Gap">位置の項目のゆれは、保持の中の区間どうしの差から見積もりました。時間の項目のゆれは、アンカーの決め方のあいまいさ（±0.1 秒）と離れの時刻の不確かさから置いた値です。${height ? `cm は身長 ${height}cm から出した目安で、±5% ほどの幅があります。` : "身長を設定すると、胴の長さに対する割合のとなりに cm の目安を出します（設定 &gt; 記録）。"}</p>
    </section>
    <section class="vsec" data-testid="form-v2-overlay"><div class="vsecH"><h2>重ね図</h2><span class="aside">${first ? `青 = ${first.n} 射目` : `${cmp.n} 射`}</span></div>
      ${formV2OverlayHtml(model, S.overlay, hiRow, false)}
      <div class="fv2SegRow">${formV2SegHtml("overlay", S.overlay, [["hold", "保持"], ["rel", "離れの 0.25 秒あと"]])}</div>
      <p class="basis">射ごとの、その時刻の姿（9 点）を、両肩の中点を合わせて重ねています。2〜3cm より細かい違いは出せません。</p>
    </section>` : ""}
    <section class="vsec" data-testid="form-v2-conditions"><div class="vsecH"><h2>この記録の条件</h2><span class="aside">比べるときの区切り</span></div>
      <div class="lrow"><span class="lk">置き方</span><span class="lv">${esc(formV2ViewText(v.view))}<small>${esc(formV2ViewNote(v.view))}</small></span></div>
      <div class="lrow"><span class="lk">写り</span><span class="lv">${rec.cap.o === "l" ? "横向き" : rec.cap.o === "p" ? "縦向き" : rec.cap.o === "s" ? "正方形" : "向きは不明"}${model.tpx ? `、胴の長さ ${esc(String(model.tpx))}px` : ""}<small>${rec.fps > 0 ? `毎秒 ${Math.round(rec.fps)} コマ、` : ""}姿勢が取れたコマ ${model.cov == null ? "—" : esc(String(model.cov))}%${rec.cap.src === "replay" ? "、保存した動画" : ""}</small></span></div>
      ${rec.cap.src === "replay" && !S.saved ? `<label class="lrow fv2Pick"><span class="lk">撮影日</span><input type="date" class="inp" id="fv2Date" data-testid="form-v2-date" value="${esc(rec.date)}" max="${today()}"></label>` : ""}
      <label class="lrow fv2Pick"><span class="lk">練習</span><select class="pick" id="fv2Link" data-testid="form-v2-link" aria-label="紐づける練習">${linkOpts}</select></label>
      ${warns}
      <details class="fv2More"><summary>一台のカメラでは見えないもの</summary><ul>${FORM_V2_UNSEEN.map((t) => `<li>${t}</li>`).join("")}</ul></details>
      ${review ? `<div class="btnRow"><button type="button" class="btn sec" id="fv2Review" data-testid="form-v2-review">動画で確かめる</button></div>` : ""}
      ${S.recBlob ? `<div class="btnRow${review ? " fv2Tight" : ""}"><button type="button" class="btn sec" id="fv2Video" data-testid="form-v2-video-save">動画を端末に保存（${mb.toFixed(mb < 10 ? 1 : 0)}MB）</button></div>
        <p class="basis">この動画はアプリの中には保存されません。この画面を閉じると消えます。残すときは「端末に保存」で写真かファイルへ書き出してください。</p>` : review ? `<p class="basis">選んだ動画に、読み取った点を重ねて見られます。動画はアプリの中には保存されません。</p>` : ""}
      ${diag ? `<div class="btnRow"><button type="button" class="btn sec" id="fv2Diag" data-testid="form-v2-diag-export">検証用の診断を書き出す</button></div>
        <p class="basis" data-testid="form-v2-diag-note">「検証用の診断データ」が入です。${rec.v2.dg ? "この記録には、解析器の中の値（数値だけ）が付いています。" : "この記録は設定が切のあいだに保存したので、解析器の中の値は付いていません。記録の数値だけを書き出します。"}映像・画像・日付・メモは入りません。${S.buffer && db.settings.formDebugLandmarks === true ? "「体の点の列も含める」が入なので、体の 9 点の位置の列も入ります。" : ""}</p>` : ""}
      ${S.saved ? "" : `<div class="btnRow"><button type="button" class="btn sec" id="fv2Discard" data-testid="form-v2-discard">保存せずに閉じる</button></div>`}
    </section>
    <div class="actbar" data-testid="form-v2-actbar">${S.saveError ? `<div class="fv2Saved err" role="alert">記録を保存できませんでした。端末の保存領域が足りません。結果はこの画面に残っています。設定 &gt; データ でバックアップを書き出してから、もう一度試してください。</div>` : ""}${S.saved && !S.stored ? `<div class="fv2Saved" data-testid="form-v2-saved" role="status">保存しました。数値だけを残しました（${many ? `${S.records.length} つの記録、` : ""}${(S.savedBytes / 1000).toFixed(1)}KB）。</div>` : ""}
      <button type="button" class="btn pri" id="fv2Save" data-testid="form-v2-save">${S.saved ? "射型へ戻る" : S.saveError ? "もう一度試す" : "記録を保存する"}</button></div>`, () => {
    const on = (id, fn) => { const b = S.root.querySelector("#" + id); if (b) b.onclick = fn; };
    const leave = async () => {
      if (S.saved || (await appConfirm(`${formV2Totals(S).shots} 射の結果を保存せずに閉じますか？`, { danger: true, okLabel: "閉じる" }))) formV2Close(S);
    };
    on("fv2Back", leave);
    on("fv2Discard", leave);
    on("fv2Fix", () => formV2OpenFix(S));
    on("fv2ToShot", () => formV2PaintShot(S, first ? first.row : 0));
    on("fv2Video", () => formV2ShareVideo(S));
    on("fv2Review", () => formV2PaintReview(S));
    on("fv2Diag", () => formV2ExportDiagnostics(S.records, S.stored ? null : S.buffer));
    S.root.querySelectorAll('[data-seg="part"] button').forEach((b) => (b.onclick = () => { S.pi = +b.dataset.val; S.shot = null; formV2PaintResult(S); }));
    on("fv2Save", async () => {
      if (S.saved) { formV2Close(S); return; }
      if (S.saving) return;
      /* 件数の目安（1,000 件）を超えるときは、保存の前に知らせて、利用者が決める。読み込みのときに黙って捨てることも、自動で消すこともしない */
      const have = (db.formAnalyses || []).length, limit = IMPORT_LIMITS.formAnalyses;
      if (have + S.records.length > limit) {
        S.saving = true;
        const go = await appConfirm(`射型の記録が ${have.toLocaleString("ja-JP")} 件あります（目安の上限は ${limit.toLocaleString("ja-JP")} 件）。このまま保存できますが、端末の保存領域が足りなくなることがあります。古い記録は 分析 > 射型 の一覧から 1 件ずつ削除できます（自動では消しません）。先に 設定 > データ でバックアップを書き出しておくと安心です。`, { title: "記録が多くなっています", okLabel: "このまま保存する", cancelLabel: "やめる" });
        S.saving = false;
        if (!go || S.closed || S.saved) return;
      }
      /* 分けた記録は、全部を 1 回で保存する（途中までだけ残ることがない） */
      const out = cloneData(S.records), done = commitFormDiagnosticDbCandidate(db, { formAnalyses: (db.formAnalyses || []).concat(out) }, { reason: "form-analysis" }, save);
      S.saveError = !done.ok;
      if (done.ok) { S.saved = true; S.savedBytes = bytes; nativePulse("success"); }
      formV2PaintResult(S);
    });
    S.root.querySelectorAll('[data-seg="overlay"] button').forEach((b) => (b.onclick = () => { S.overlay = b.dataset.val; formV2Rerender(S); }));
    const link = S.root.querySelector("#fv2Link");
    if (link) link.onchange = () => {
      const s = sessions.find((x) => x.id === link.value) || null;
      for (const r of S.records) { r.sessionId = s ? s.id : null; r.setupId = s ? s.setupId || null : null; }
      if (S.saved) {
        /* 保存済みの記録は、紐づけだけを書き換える（分けた記録は全部） */
        let touched = false;
        for (const r of S.records) {
          const cur = (db.formAnalyses || []).find((x) => x && x.id === r.id);
          if (cur) { cur.sessionId = r.sessionId; cur.setupId = r.setupId; touched = true; }
        }
        if (touched) save({ reason: "form-analysis-link" });
      }
    };
    const date = S.root.querySelector("#fv2Date");
    if (date) date.onchange = () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value) || date.value > today()) { date.value = S.record.date; return; }
      /* 日付を変えたら、時刻（ts）もその日へ移す（時分秒はそのまま）。並び順と「いちばん新しい記録」が、撮影日に合う。
         別の日の練習との紐づけは外す */
      const [y, mo, d] = date.value.split("-").map(Number), first = S.records[0], old = new Date(first.ts || Date.now());
      const shift = new Date(y, mo - 1, d, old.getHours(), old.getMinutes(), old.getSeconds(), old.getMilliseconds()).getTime() - old.getTime();
      for (const r of S.records) { r.date = date.value; r.ts = (r.ts || old.getTime()) + shift; r.sessionId = null; r.setupId = null; }
      formV2Rerender(S);
    };
  });
}

/* ---- 射数を直す（design.md 2.8）: 見つけた区間の一覧。記録の印だけを切り替える ---- */
function formV2OpenFix(S) {
  let draft = cloneData(S.record);
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  const paint = () => {
    const m = FormV2.read(draft);
    const rows = m.events.map((e) => {
      const at = formV2Mmss(e.tS);
      let t, s;
      if (e.kind === "shot") { t = e.counted ? `${e.n} 射目` : "外した射"; s = `${at}、保持 ${e.holdS == null ? "—" : e.holdS.toFixed(1) + " 秒"}`; }
      else if (e.kind === "letdown") { t = e.counted ? `${e.n} 射目（引き戻しを射に数えています）` : "引き戻し"; s = `${at}、保持 ${e.holdS == null ? "—" : e.holdS.toFixed(1) + " 秒"}。手が前へ戻りました`; }
      else { t = e.counted ? `${e.n} 射目（足した射）` : e.likely ? "射かもしれません（ほかの射に似た動き）" : "射かもしれません"; s = `${at} ごろ（±${(e.uncS == null ? 0.5 : e.uncS).toFixed(1)} 秒）。${FORM_V2_REASON_TEXT[e.reason] || "離れがはっきり写りませんでした"}。値は測れていません`; }
      return `<div class="fv2FixRow" data-kind="${e.kind}"><div><b>${esc(t)}</b><span>${esc(s)}</span></div><button type="button" class="fv2Tog" data-src="${e.src}" data-i="${e.i}" aria-pressed="${e.counted}">${e.counted ? "射に数える" : "数えない"}</button></div>`;
    }).join("");
    ovl.innerHTML = `<div class="sheet fv2FixSheet" data-testid="form-v2-fix"><h3>射数を直す</h3>
      <p class="basis">見つけた区間の一覧です。違っていれば切り替えてください。外した射と、足した射（値を測れていません）は、比べる対象に入りません。見つけていない時刻へ射を足すことはできません。</p>
      ${rows || `<p class="fact">見つけた区間はありません。</p>`}
      <p class="fact" data-testid="form-v2-fix-count"><b>${m.count} 射</b>として記録します。</p>
      <div class="btnRow"><button type="button" class="btn sec" id="fv2FixCancel">やめる</button><button type="button" class="btn" id="fv2FixOk" data-testid="form-v2-fix-ok">この数にする</button></div></div>`;
    ovl.querySelectorAll(".fv2Tog").forEach((b) => (b.onclick = () => {
      const key = `${b.dataset.src}:${b.dataset.i}`;
      draft = FormV2.setCounted(draft, b.dataset.src, +b.dataset.i, b.getAttribute("aria-pressed") !== "true");
      paint();
      const again = [...ovl.querySelectorAll(".fv2Tog")].find((x) => `${x.dataset.src}:${x.dataset.i}` === key);
      if (again) again.focus({ preventScroll: true });
    }));
    ovl.querySelector("#fv2FixCancel").onclick = () => closeModal(ovl);
    /* 分けた記録は、この記録の射数が変わると、うしろの記録の通し番号も変わる。全部の記録で合わせ直す */
    ovl.querySelector("#fv2FixOk").onclick = () => { S.record = draft; S.records = FormV2.renumber(S.records); closeModal(ovl); formV2Rerender(S); };
  };
  paint();
  openModal(ovl, { escapeTarget: "#fv2FixCancel" });
}

/* ---- 射の詳細（design.md 2.7）: 保存する形（S.record）だけから描く ---- */
function formV2PaintShot(S, row) {
  const rec = S.record, model = FormV2.read(rec), keys = FormV2.keysFor(rec), cmp = FormV2.compare(model, FormAnalyze), height = formV2Height();
  const n = model.compared.length, i = Math.min(n - 1, Math.max(0, row | 0)), e = model.compared[i];
  if (!e) { formV2PaintResult(S); return; }
  S.shot = i;
  const flagged = new Set(cmp.flags.filter((f) => f.row === i).map((f) => f.key));
  const rest = (k) => model.compared.filter((_, j) => j !== i).map((x) => x.vals[k]);
  const bar = (k, l) => {
    const v = e.vals[k], o = FormV2.median(rest(k)), mx = Math.max(6000, ...model.compared.map((x) => x.vals[k] || 0)) * 1.05, w = 120;
    const x = Number.isFinite(v) ? (v / mx) * w : 0, mk = Number.isFinite(o) ? (o / mx) * w : -9;
    return `<div class="fv2Bar"><span class="k">${l}</span><svg viewBox="0 0 ${w} 22" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="6" width="${w}" height="10" fill="var(--raised)"/><rect x="0" y="6" width="${x.toFixed(1)}" height="10" fill="${flagged.has(k) ? "var(--info)" : "var(--ink)"}"/><path d="M${mk.toFixed(1)} 1V21" stroke="var(--sub)" stroke-width="2"/></svg><span class="v">${Number.isFinite(v) ? (v / 1000).toFixed(1) + " 秒" : "—"}<small>ほか ${Number.isFinite(o) ? (o / 1000).toFixed(1) + " 秒" : "—"}</small></span></div>`;
  };
  const tr = (k) => {
    const ref = cmp.feat[k].median, a = FormV2.shown(k, e.vals[k], ref), b = FormV2.median(rest(k).map((t) => FormV2.shown(k, t, ref))), d = Number.isFinite(a) && Number.isFinite(b) ? a - b : NaN;
    return `<div class="fv2Tr${flagged.has(k) ? " dif" : ""}" data-key="${k}"><span>${esc(FormV2.META[k].name)}</span><span>${FormV2.fmt(k, a)}</span><span>${FormV2.fmt(k, b)}</span><span>${FormV2.fmt(k, d, { sign: true })}</span></div>`;
  };
  const pct = height ? `（身長 ${height}cm なら 1% は約 ${((FormV2.TORSO_PER_HEIGHT * height) / 100).toFixed(1)}cm。目安です）` : "";
  formV2Paint(S, "shot", `${formV2TopHtml("結果", "")}
    <header class="subHead fv2Head"><h3>${e.n} 射目</h3><span class="viewDate">${formV2Mmss(e.tS)}<br>${model.count === n ? `${n} 射中` : `値を測れた ${n} 射中`}</span></header>
    <section class="vsec" data-testid="form-v2-shot-time"><div class="vsecH"><h2>時間</h2><span class="aside">縦線 = ほかの ${n - 1} 射の中央値</span></div>
      <div class="fv2Bars">${[["drawMs", "引き"], ["holdMs", "保持"], ["followMs", "弓手を上げていた"]].map(([k, l]) => bar(k, l)).join("")}</div></section>
    <section class="vsec" data-testid="form-v2-shot-overlay"><div class="vsecH"><h2>重ね図</h2><span class="aside">青 = この射、灰 = ほかの中央</span></div>
      ${formV2OverlayHtml(model, S.overlay, i, true)}<div class="fv2SegRow">${formV2SegHtml("overlay", S.overlay, [["hold", "保持"], ["rel", "離れの 0.25 秒あと"]])}</div>
      <p class="basis">灰色は、ほかの ${n - 1} 射の点ごとの中央値です。保存した姿（9 点）から描いています。</p></section>
    <section class="vsec" data-testid="form-v2-shot-table"><div class="vsecH"><h2>射ごとの値</h2><span class="aside">${flagged.size ? `${flagged.size} 項目で違い` : "違いなし"}</span></div>
      <div class="fv2Tbl"><div class="fv2Tr h"><span>項目</span><span>この射</span><span>ほか ${n - 1} 射</span><span>差</span></div>${keys.map(tr).join("")}</div>
      ${model.count === n ? "" : `<p class="basis" data-testid="form-v2-shot-count-note">この記録の射数は ${model.count} 射です。足した ${model.added} 射は値を測れていないので、ここで比べているのは ${n} 射です。</p>`}
      <p class="basis">色の付いた行は、差が測定のゆれから出せる下限を超えています。% は胴の長さに対する割合です${pct}。引き尺の目安は、この回の中央値を 100% としています。「—」は測れなかった値です。</p>
      <div class="btnRow"><button type="button" class="btn sec" id="fv2Prev" data-testid="form-v2-prev">前の射</button><button type="button" class="btn sec" id="fv2Next" data-testid="form-v2-next">次の射</button></div>
    </section>`, () => {
    S.root.querySelector("#fv2Back").onclick = () => formV2PaintResult(S);
    S.root.querySelector("#fv2Prev").onclick = () => formV2PaintShot(S, (i + n - 1) % n);
    S.root.querySelector("#fv2Next").onclick = () => formV2PaintShot(S, (i + 1) % n);
    S.root.querySelectorAll('[data-seg="overlay"] button').forEach((b) => (b.onclick = () => { S.overlay = b.dataset.val; formV2Rerender(S); }));
  });
}

/* ---- 動画で確かめる（design.md 2.10）----
   撮りながら残した動画（S.recBlob）か、選んだ動画（S.fileUrl）を再生し、メモリにある点の列（S.buffer）から骨格を重ねる。再推論はしない。
   射の区間では、ほかの射の中央の姿（保存する 9 点 = ps・pr）を白い線で重ねる。動画も点の列も、アプリの中には保存しない。
   上限: 撮りながら残す動画は 10 分・約 1.5Mbps（約 110MB）。点の列は 30 分で約 6〜13MB。画面を閉じると、どちらも手放す */
function formV2CanReview(S) {
  return !!(S.buffer && S.buffer.n > 1 && !S.stored && (S.recBlob || (S.src === "replay" && S.fileUrl)));
}
function formV2EndReview(S) {
  const R = S.review;
  if (!R) return;
  S.review = null;
  R.on = false;
  try { R.video.pause(); } catch (e) {}
  try { if (R.vfc && typeof R.video.cancelVideoFrameCallback === "function") R.video.cancelVideoFrameCallback(R.vfc); } catch (e) {}
  try { R.video.removeAttribute("src"); R.video.load(); } catch (e) {}
  if (R.ownUrl) {
    const i = S.urls.indexOf(R.url);
    if (i >= 0) S.urls.splice(i, 1);
    URL.revokeObjectURL(R.url);
  }
}
/* 射の区間（引き始め〜離れの 0.8 秒あと）と、そこに重ねる「ほかの射の中央の姿」 */
function formV2ReviewShots(S) {
  const out = [];
  for (const rec of S.records) {
    const m = FormV2.read(rec), view = rec.v2.view || {};
    const dir = (view.side === "b" ? -1 : 1) * (rec.cap.hand === "left" ? -1 : 1);
    m.events.forEach((e) => {
      if (e.kind === "cand") { out.push({ kind: "cand", n: e.n, tMs: e.tS * 1000, fromMs: e.tS * 1000 - 3000, toMs: e.tS * 1000 + 800, label: e.counted ? String(e.n) : "？", dir }); return; }
      const others = m.compared.filter((x) => x !== e);
      out.push({
        kind: e.kind, n: e.n, tMs: e.tS * 1000, fromMs: (e.tS - (e.holdS || 0) - (e.drawS || 0)) * 1000, toMs: e.tS * 1000 + 800, dir, tpx: rec.v2.tpx,
        label: e.counted ? String(e.n) : e.kind === "letdown" ? "戻" : "外",
        hold: e.kind === "shot" && others.length ? formV2MedianPose(others.map((x) => x.ps)) : null,
        rel: e.kind === "shot" && others.length ? formV2MedianPose(others.map((x) => x.pr)) : null,
        others: others.length,
      });
    });
  }
  return out.sort((a, b) => a.tMs - b.tMs);
}
function formV2PaintReview(S) {
  if (!formV2CanReview(S)) return;
  formV2EndReview(S);
  const live = S.src !== "replay", fr = S.buffer.frame;
  const R = (S.review = {
    on: true, video: document.createElement("video"), url: "", ownUrl: false, vfc: 0,
    /* 動画の 0 秒が、撮影の何 ms にあたるか。撮りながら残した動画は、録画を始めた時刻から */
    from: live ? (Number.isFinite(S.recStart) ? S.recStart : 0) : 0,
    dur: 0, pos: 0, rate: 1, skel: true, ghost: true, playing: false, shots: formV2ReviewShots(S),
  });
  R.dur = Math.max(0, (live ? (Number.isFinite(S.recEnd) ? S.recEnd : S.buffer.lastMs) : S.buffer.lastMs) - R.from);
  R.pos = R.from;
  if (live) { R.url = URL.createObjectURL(S.recBlob); R.ownUrl = true; S.urls.push(R.url); } else R.url = S.fileUrl;
  const v = R.video;
  v.playsInline = true;
  v.muted = true;
  v.preload = "auto";
  v.setAttribute("playsinline", "");
  v.className = "fv2Video";
  v.dataset.testid = "form-v2-review-video";
  const inRange = (t) => t >= R.from - 1 && t <= R.from + R.dur + 1;
  const chips = R.shots.map((e, i) => `<button type="button" class="fv2Chip" data-shot="${i}" aria-pressed="false" ${inRange(e.tMs) ? "" : "disabled"} aria-label="${e.kind === "shot" && e.n ? `${e.n} 射目へ` : e.kind === "letdown" ? "引き戻しへ" : e.kind === "cand" ? "数えていない保持へ" : "外した射へ"}">${e.label}</button>`).join("");
  const mb = S.recBlob ? Math.max(0.1, S.recBlob.size / 1e6) : 0;
  const cut = live && R.shots.some((e) => !inRange(e.tMs));
  formV2Paint(S, "review", `${formV2TopHtml("結果", "動画で確かめる")}
    <div class="fv2Cam bleed fv2Rev" id="fv2RevCam" data-testid="form-v2-review-cam"><canvas id="fv2RevCanvas" data-testid="form-v2-review-canvas" aria-hidden="true"></canvas><span class="fv2Tag" id="fv2RevTag" data-testid="form-v2-review-tag"></span></div>
    <div class="fv2Chips" data-testid="form-v2-review-shots" role="group" aria-label="射の頭出し">${chips || `<span class="basis">見つけた射はありません。</span>`}</div>
    <div class="fv2Scrub"><input type="range" id="fv2RevPos" data-testid="form-v2-review-pos" min="0" max="${Math.max(1, Math.round(R.dur))}" step="10" value="0" aria-label="再生位置"><div class="t"><span id="fv2RevNow">${formV2Mmss(R.from / 1000)}</span><span>${formV2Mmss((R.from + R.dur) / 1000)}</span></div></div>
    <section class="vsec fv2RevCtl">
      <div class="btnRow"><button type="button" class="btn sec" id="fv2RevBack1" data-testid="form-v2-review-prev">前のコマ</button><button type="button" class="btn" id="fv2RevPlay" data-testid="form-v2-review-play">再生</button><button type="button" class="btn sec" id="fv2RevFwd1" data-testid="form-v2-review-next">次のコマ</button></div>
      <div class="fv2Opt w3"><div><b>速さ</b><span>再生の倍率</span></div>${formV2SegHtml("rate", "1", [["0.25", "0.25"], ["0.5", "0.5"], ["1", "1"]])}</div>
      <div class="fv2Opt"><div><b>骨格</b><span>読み取った点と線</span></div>${formV2SegHtml("skel", "on", [["on", "入"], ["off", "切"]])}</div>
      <div class="fv2Opt"><div><b>ほかの射を重ねる</b><span>白 = ほかの射の中央の姿</span></div>${formV2SegHtml("ghost", "on", [["on", "入"], ["off", "切"]])}</div>
      ${S.recBlob ? `<div class="btnRow"><button type="button" class="btn sec" id="fv2RevSave" data-testid="form-v2-review-save">動画を端末に保存（${mb.toFixed(mb < 10 ? 1 : 0)}MB）</button></div>` : ""}
      <p class="basis">骨格は、${live ? "撮影のときに" : "解析のときに"}読み取った点を、動画の時刻に合わせて描いています（もう一度読み取ってはいません。1 コマほどずれることがあります）。白い線は、その射を除いた射の、点ごとの中央の姿です。保持のあいだは保持の姿、離れのあとは離れの 0.25 秒あとの姿を重ねます。</p>
      ${cut ? `<p class="basis" data-testid="form-v2-review-cut">動画に入っていない時刻の射は、番号を押せません（動画を残したのは ${formV2Mmss(R.from / 1000)}〜${formV2Mmss((R.from + R.dur) / 1000)}）。</p>` : ""}
      <p class="basis" data-testid="form-v2-review-limits">${live ? "撮りながら残す動画は、最長 10 分・約 1.5Mbps（約 110MB まで）です。" : "選んだ動画は、もとのファイルをそのまま再生しています。"}動画も点の列も、アプリの中には保存されません。この画面と結果の画面を閉じると消えます。${live ? "残すときは「端末に保存」で写真かファイルへ書き出してください。" : ""}</p>
    </section>`, () => {
    const root = S.root, cam = root.querySelector("#fv2RevCam"), cv = root.querySelector("#fv2RevCanvas"), tag = root.querySelector("#fv2RevTag");
    const pos = root.querySelector("#fv2RevPos"), now = root.querySelector("#fv2RevNow"), play = root.querySelector("#fv2RevPlay");
    cam.prepend(v);
    const mapGhost = (pose, f, e) => {
      /* 保存した姿（両肩の中点が原点、弓の向きが x 正、上が y 正、0.01 胴）を、いまのコマの肩の位置と胴の長さで画面へ戻す */
      const a = f.pts[1], b = f.pts[2], ha = f.pts[7], hb = f.pts[8];
      if (!Array.isArray(pose) || !Number.isFinite(a[0]) || !Number.isFinite(b[0])) return null;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const T = Number.isFinite(ha[0]) && Number.isFinite(hb[0]) ? Math.hypot(mx - (ha[0] + hb[0]) / 2, my - (ha[1] + hb[1]) / 2) : e.tpx;
      if (!(T > 0)) return null;
      return (i) => (Number.isFinite(pose[i * 2]) && Number.isFinite(pose[i * 2 + 1]) ? [mx + (e.dir * pose[i * 2] * T) / 100, my - (pose[i * 2 + 1] * T) / 100] : null);
    };
    const draw = () => {
      if (!R.on) return;
      const w = fr.w || v.videoWidth || 720, h = fr.h || v.videoHeight || 1280;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const ctx = cv.getContext("2d"), f = S.buffer.at(R.pos), lw = Math.max(3, w / 180);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const near = f && Math.abs(f.t - R.pos) <= 250 && f.pose;
      const e = R.shots.find((x) => R.pos >= x.fromMs && R.pos <= x.toMs) || null;
      let ghost = false, skel = false;
      if (R.ghost && near && e && e.kind === "shot") {
        const P = mapGhost(R.pos <= e.tMs ? e.hold : e.rel, f, e);
        if (P) {
          ctx.strokeStyle = "rgba(255,255,255,.9)";
          ctx.lineWidth = lw * 0.75;
          ctx.beginPath();
          for (const [a, b] of [[2, 1], [1, 3], [3, 5], [2, 4], [4, 6], [1, 7], [2, 8], [8, 7]]) { const p = P(a), q = P(b); if (p && q) { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ghost = true; } }
          ctx.stroke();
        }
      }
      if (R.skel && near) {
        ctx.strokeStyle = "#a8c7ac";
        ctx.fillStyle = "#a8c7ac";
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (const [a, b] of [[1, 2], [1, 3], [3, 5], [2, 4], [4, 6], [1, 7], [2, 8], [7, 8]]) {
          const p = f.pts[a], q = f.pts[b];
          if (Number.isFinite(p[0]) && Number.isFinite(q[0])) { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); skel = true; }
        }
        ctx.stroke();
        for (const p of f.pts) if (Number.isFinite(p[0])) { ctx.beginPath(); ctx.arc(p[0], p[1], lw * 1.3, 0, Math.PI * 2); ctx.fill(); }
      }
      const what = !e ? "" : e.kind === "shot" && e.n ? `${e.n} 射目` : e.kind === "letdown" ? "引き戻し" : e.kind === "cand" ? "数えていない保持" : "外した射";
      tag.textContent = `${formV2Mmss(R.pos / 1000)}${what ? `\u3000${what}\u3000${R.pos <= e.tMs ? "離れの前" : "離れのあと"}` : ""}`;
      now.textContent = formV2Mmss(R.pos / 1000);
      if (root.ownerDocument.activeElement !== pos) pos.value = String(Math.round(R.pos - R.from));
      const cur = e ? R.shots.indexOf(e) : -1;
      root.querySelectorAll(".fv2Chip").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.shot === cur)));
      /* 検査から見える印: いまの位置（撮影の ms）、骨格と白い線を描いたか */
      cam.dataset.pos = String(Math.round(R.pos));
      cam.dataset.skel = skel ? "1" : "0";
      cam.dataset.ghost = ghost ? "1" : "0";
    };
    const seek = (ms) => {
      R.pos = Math.min(R.from + R.dur, Math.max(R.from, ms));
      try { v.currentTime = (R.pos - R.from) / 1000; } catch (e) {}
      draw();
    };
    const setPlaying = (on) => { R.playing = on; play.textContent = on ? "止める" : "再生"; play.setAttribute("aria-pressed", String(on)); };
    const tick = (nowMs, meta) => {
      if (!R.on) return;
      if (R.playing) { R.pos = Math.min(R.from + R.dur, R.from + (meta && Number.isFinite(meta.mediaTime) ? meta.mediaTime : v.currentTime) * 1000); draw(); }
      if (typeof v.requestVideoFrameCallback === "function") R.vfc = v.requestVideoFrameCallback(tick);
    };
    if (typeof v.requestVideoFrameCallback === "function") R.vfc = v.requestVideoFrameCallback(tick);
    else v.ontimeupdate = () => tick(0, null);
    v.onseeked = () => draw();
    v.onloadeddata = () => draw();
    v.onended = () => setPlaying(false);
    v.onpause = () => setPlaying(false);
    v.onerror = () => { tag.textContent = "この動画は、この端末では再生できません。骨格だけを表示します。"; };
    v.src = R.url;
    v.load();
    root.querySelector("#fv2Back").onclick = () => { formV2EndReview(S); formV2PaintResult(S); };
    play.onclick = () => {
      if (R.playing) { v.pause(); return; }
      if (R.pos >= R.from + R.dur - 50) seek(R.from);
      v.playbackRate = R.rate;
      setPlaying(true);
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => setPlaying(false));
    };
    const stepBy = (d) => {
      v.pause();
      const f = S.buffer.at(R.pos), g = f ? S.buffer.frameAt(f.i + d) : null;
      if (g) seek(g.t);
    };
    root.querySelector("#fv2RevBack1").onclick = () => stepBy(-1);
    root.querySelector("#fv2RevFwd1").onclick = () => stepBy(1);
    pos.oninput = () => { v.pause(); seek(R.from + +pos.value); };
    root.querySelectorAll(".fv2Chip").forEach((b) => (b.onclick = () => {
      /* 頭出し: 離れの 0.5 秒前（保持の終わり）。そこから再生すると離れが見える */
      const e = R.shots[+b.dataset.shot];
      v.pause();
      seek(e.tMs - 500);
    }));
    root.querySelectorAll("[data-seg] button").forEach((b) => (b.onclick = () => {
      const name = b.parentElement.dataset.seg, val = b.dataset.val;
      b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      if (name === "rate") { R.rate = +val; v.playbackRate = R.rate; }
      if (name === "skel") R.skel = val === "on";
      if (name === "ghost") R.ghost = val === "on";
      draw();
    }));
    const saveBtn = root.querySelector("#fv2RevSave");
    if (saveBtn) saveBtn.onclick = () => formV2ShareVideo(S);
    draw();
  });
}

/* ---- 検証用の診断の書き出し（design.md 6.3）----
   設定「検証用の診断データ」が入のときだけ。数値だけを JSON にして、共有シートかダウンロードへ渡す（アプリからどこかへ送ることはしない）。
   buffer = 撮った直後のメモリの中の点の列。2 つめの設定「体の点の列も含める」が入のときだけ、書き出しに入れる */
const FORM_V2_DIAG_CONFIRM = "検証用の診断を書き出します。入るのは数値だけです: 射と引き戻しの時刻と確かさ、数えなかった保持とその理由、射ごとの値、測定のゆれ、置き方の判定、毎秒コマ数と画面の大きさ、アプリと解析器の版。映像、画像、日付、メモ、練習や弓具との紐づけ、端末の中の ID は入りません。共有先は自分で確かめてください。";
function formV2DiagRecords() {
  return (db.formAnalyses || []).filter((r) => FormV2.isV2(r) && r.v2.dg).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 12);
}
async function formV2ExportDiagnostics(records, buffer) {
  if (db.settings.formDebug !== true) { toast("「検証用の診断データ」を入にしてください"); return "debug-disabled"; }
  const list = (records || []).filter(FormV2.isV2);
  if (!list.length) { toast("書き出せる記録がありません"); return "empty"; }
  const withLm = !!(buffer && buffer.n && db.settings.formDebugLandmarks === true);
  const extra = withLm ? `\n\n「体の点の列も含める」が入なので、この撮影の体の 9 点（鼻・肩・肘・手首・腰）の位置の列も入ります（${buffer.n.toLocaleString("ja-JP")} コマ、約 ${Math.max(0.1, (buffer.n * 170) / 1e6).toFixed(1)}MB）。映像や画像ではありませんが、体の動きそのものの記録です。` : "";
  if (!(await appConfirm(FORM_V2_DIAG_CONFIRM + extra, { okLabel: "書き出す" }))) return "canceled";
  if (db.settings.formDebug !== true) { toast("「検証用の診断データ」を入にしてください"); return "debug-disabled"; }
  let json;
  try {
    const first = list.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0))[0];
    json = JSON.stringify(FormV2.diagnostics(list, { appVer: APP_VER, landmarks: withLm ? { [first.id]: FormV2.landmarkDump(buffer) } : null }));
  } catch (e) { toast("診断を書き出せませんでした。もう一度お試しください。", 4000); return "failed"; }
  const res = await shareFormDiagnosticsJson(json);
  if (res.cleanupFailed) toast("診断の一時ファイルを削除できませんでした。端末のキャッシュに診断の数値が残っている可能性があります。", 6000);
  else if (res.status === "shared") toast("診断を共有しました");
  else if (res.status === "downloaded") toast("診断を書き出しました");
  else if (res.status !== "canceled") toast("診断を書き出せませんでした。もう一度お試しください。", 4000);
  return res.status;
}
