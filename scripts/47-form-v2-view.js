"use strict";
/* Archery Note: 射型の記録 v2 の画面（docs/design/form-v2/design.md 2 章、試作 prototype.html）。
   入にする → 置き方を確かめる → 撮る → 解析する → 結果（射数を直す・射の詳細）→ 保存。
   撮影中はランドマークをメモリのバッファ（FormV2.makeBuffer）にためるだけで、終わってから FormAnalyze.analyzePacked に渡す。
   実時間の状態機械（46-form-core.js の stepFormPhase など）は使わない。保存するのは FormV2.buildRecord の数値だけ。
   映像・画素・ランドマークの列は保存も送信もしない。動画は、利用者が「端末に保存」を押したときだけ端末へ書き出す。
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
  const w = formV2W(), h = 74, dur = Math.max(1, model.v.dur || 0, ...model.events.map((e) => e.tS + 1)), x = (t) => 4 + ((w - 8) * Math.max(0, t)) / dur;
  let g = `<path d="M0 46H${w}" stroke="var(--rule-strong)" stroke-width="1"/>`, lastLabel = -99;
  const label = (cx, text, cls) => {
    if (cx - lastLabel < 14) return "";
    lastLabel = cx;
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
  g += `<text x="0" y="66" class="ax">0:00</text><text x="${w}" y="66" text-anchor="end" class="ax">${formV2Mmss(dur)}</text><text x="${w / 2}" y="66" text-anchor="middle" class="ax">時間</text>`;
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
  const head = meta.rel ? "この回の中央値を 100%" : `中央値 ${meta.unit === "b" ? "胴の " : ""}${FormV2.fmt(key, m)}${cm ? `（${cm}）` : ""}`;
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
function formV2SegHtml(name, cur, opts) {
  return `<div class="seg" role="group" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-val="${v}" aria-pressed="${cur === v}">${l}</button>`).join("")}</div>`;
}

/* ---------- 分析 > 射型 のカード ---------- */
function formV2RecordLine(rec) {
  const m = FormV2.read(rec), hold = FormV2.median(m.compared.map((e) => e.vals.holdMs));
  return { m, title: `${fmtMDW(rec.date)}　${m.count} 射${Number.isFinite(hold) ? `　保持 ${(hold / 1000).toFixed(1)} 秒` : ""}`, sub: `${formV2ViewText(rec.v2.view)}${m.letdowns ? `。引き戻し ${m.letdowns} 回` : ""}${rec.cap.src === "replay" ? "。保存した動画" : ""}` };
}
/* 保持の時間の推移（比べてよい回が 3 回以上あるときだけ） */
function formV2TrendHtml(records) {
  const t = FormV2.trend(records, "holdMs"), pts = t.points;
  if (pts.length < 3) return pts.length ? `<p class="basis">保持の時間の推移は、比べてよい記録が 3 回になると出ます（いま ${pts.length} 回）。</p>` : "";
  const w = formV2W(), h = 118, pt = 12, pb = 26, s = (v) => v / 1000;
  const lo = Math.min(...pts.map((p) => s(p.q1))), hi = Math.max(...pts.map((p) => s(p.q3))), pad = Math.max(0.3, (hi - lo) * 0.2);
  const y = (v) => pt + (h - pt - pb) * (1 - (v - (lo - pad)) / (hi + pad - (lo - pad))), x = (i) => 56 + ((w - 76) * i) / (pts.length - 1);
  let g = "";
  for (let v = Math.ceil(lo - pad); v <= hi + pad; v++) g += `<path d="M0 ${y(v).toFixed(1)}H${w}" stroke="var(--rule)" stroke-width="1"/><text x="0" y="${(y(v) - 4).toFixed(1)}" class="ax">${v} 秒</text>`;
  pts.forEach((p, i) => {
    g += `<path d="M${x(i).toFixed(1)} ${y(s(p.q1)).toFixed(1)}V${y(s(p.q3)).toFixed(1)}" stroke="var(--rule-strong)" stroke-width="5"/><circle cx="${x(i).toFixed(1)}" cy="${y(s(p.med)).toFixed(1)}" r="5" fill="${i === pts.length - 1 ? "var(--accent)" : "var(--ink)"}"/>`;
    if (i === 0 || i === pts.length - 1) g += `<text x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="${i ? "end" : "start"}" class="ax">${fmtMD(p.date)}</text>`;
  });
  const meds = pts.slice(-5).map((p) => s(p.med)), shots = pts.reduce((n, p) => n + p.n, 0);
  return `<div class="fv2Sub" data-testid="form-v2-trend"><div class="fv2ChartH"><b>保持の時間の推移</b><span>${pts.length} 回</span></div>
    <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="保持の時間の推移。${pts.length} 回">${g}</svg>
    <p class="basis">直近 ${meds.length} 回の中央値は ${Math.min(...meds).toFixed(1)}〜${Math.max(...meds).toFixed(1)} 秒でした。点は各回の中央値、縦の線は射どうしの幅（四分位）。${pts.length} 回・計 ${shots} 射。保持の時間は置き方が違っても比べられます。${t.excluded ? `利き手や解析の版、写りが違う ${t.excluded} 回は入れていません。` : ""}</p></div>`;
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
    latest = `<div class="fv2Sub" data-testid="form-v2-latest"><div class="fv2ChartH"><b>直近の記録</b><span>${fmtMDW(rec.date)}</span></div>
      <p class="fact">${esc(FormV2.summary(line.m, cmp, formV2Height()).text)}</p>
      <p class="basis">${line.m.count} 射${line.m.letdowns ? `、引き戻し ${line.m.letdowns} 回` : ""}。${esc(formV2ViewText(rec.v2.view))}、${rec.cap.o === "l" ? "横向き" : rec.cap.o === "p" ? "縦向き" : "正方形"}。</p></div>`;
  }
  const rows = v2.slice(0, 8).map((rec) => {
    const line = formV2RecordLine(rec);
    return `<div class="formAnalysisRow">
      <button class="lrow link fv2Item" data-form-v2-id="${esc(rec.id)}" type="button"><span class="lmain"><b>${esc(line.title)}</b><span>${esc(line.sub)}</span></span>${FORM_V2_GO}</button>
      <button class="btn sm ghost histDelBtn" data-del-form="${esc(rec.id)}" type="button" aria-label="${esc(fmtMDW(rec.date))}の射型記録を削除">${icon("del")}</button>
    </div>`;
  }).join("");
  const empty = !all.length
    ? `<div class="empty">${total ? "この条件に合う射型の記録は 0件です。弓具・距離・期間の選択を広げると表示されます。" : "射型の記録はまだありません。台に置いて 1 エンドを撮ると、ここに並びます。"}</div>`
    : "";
  return `<section class="vsec analysisFormCard" data-testid="analysis-form-card"><div class="vsecH"><h2>射型の記録</h2><span class="aside">試験中${v2.length ? `・${v2.length}件` : ""}</span></div>
    <div class="btnRow"><button type="button" class="btn fv2Tall" id="formStart" data-testid="form-v2-start">${icon("camera")} 撮影して記録する</button></div>
    <div class="btnRow fv2Tight"><button type="button" class="btn sec" id="formReplay" data-testid="form-v2-replay">保存した動画を解析する</button></div>
    ${debug ? `<p class="basis" data-testid="form-v2-debug-note">「検証用の診断データ」が入のあいだは、診断を取るために以前の撮影画面（撮りながら数える方式）で開きます。設定 &gt; 記録 で切にすると、新しい記録の画面になります。</p>` : ""}
    ${latest}${formV2TrendHtml(v2)}
    ${rows ? `<div class="fv2Sub"><div class="fv2ChartH"><b>記録</b><span>${v2.length}件${v2.length > 8 ? "・新しい8件を表示" : ""}</span></div><div class="formRecordList" data-testid="form-v2-list">${rows}</div>
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
    recorder: null, recChunks: [], recBlob: null, recStart: NaN, recMime: "",
    result: null, record: null, saved: false, savedBytes: 0, overlay: "hold", shot: null, closed: false, startedAt: 0, fileName: "", notice: "",
  };
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
  if (S.fileUrl) { URL.revokeObjectURL(S.fileUrl); S.fileUrl = null; }
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
};
function formV2ShowError(S, kind, extra) {
  formV2StopCapture(S);
  const e = FORM_V2_ERRORS[kind] || FORM_V2_ERRORS.busy, has = S.buffer && S.buffer.n >= 10;
  const btn = { retry: ["もう一度試す", "fv2Retry"], replay: ["保存した動画を解析する", "fv2ToReplay"], analyze: [kind === "interrupted" ? "ここまでを解析する" : "解析する", "fv2Analyze"], close: [kind === "interrupted" ? "捨てる" : "閉じる", "fv2ErrClose"] };
  const acts = e[2].filter((a) => a !== "analyze" || has);
  formV2Paint(S, "error", `${formV2TopHtml("射型", "")}
    <header class="subHead"><h3>射型の記録</h3></header>
    <section class="vsec fv2Err" data-testid="form-v2-error" data-kind="${kind}" role="alert">
      <div class="vsecH"><h2>${kind === "interrupted" || kind === "detect" ? "中断" : "始められません"}</h2></div>
      <p class="fact">${esc(e[0])}</p>
      <p class="basis">${esc(e[1])}${extra ? esc(extra) : ""}</p>
      ${acts.map((a, i) => `<div class="btnRow${i ? " fv2Tight" : ""}"><button type="button" class="btn${i ? " sec" : ""}" id="${btn[a][1]}">${btn[a][0]}</button></div>`).join("")}
    </section>`, () => {
    const on = (id, fn) => { const b = S.root.querySelector("#" + id); if (b) b.onclick = fn; };
    on("fv2Back", () => formV2Close(S));
    on("fv2ErrClose", () => formV2Close(S));
    on("fv2Retry", () => formV2BeginLive(S));
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
    <p class="basis">数は離れの 2〜3 秒あとに増えます。終わったあと、全体を見直して数え直します。射の最中に読む表示は出しません。</p>
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
    S.recChunks = [];
    S.recBlob = null;
    S.recMime = mime;
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) S.recChunks.push(e.data); };
    rec.onstop = () => { if (S.recChunks.length) S.recBlob = new Blob(S.recChunks, { type: mime }); S.recChunks = []; if (S.stage === "result") formV2Rerender(S); };
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
    else { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); toast("動画を書き出しました"); }
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
  S.fileName = file.name || "";
  /* 日付は動画のファイルから（lastModified）。結果の画面で変えられる。今日の練習には紐づけない */
  const d = new Date(Number.isFinite(file.lastModified) && file.lastModified > 0 ? file.lastModified : Date.now());
  S.fileTs = d.getTime();
  S.fileDate = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  S.fileUrl = URL.createObjectURL(file);
  if (formV2Unsupported()) { formV2ShowError(S, "unsupported"); return S; }
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
    S.lastUi = -Infinity;
    S.startedAt = S.fileTs;
    const v = S.video;
    v.preload = "auto";
    v.onerror = () => { if (!S.closed && S.stage === "reading") formV2ShowError(S, "file"); };
    v.onloadeddata = () => {
      if (S.closed || S.stage !== "reading") return;
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
  return S;
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
    S.root.querySelector("#fv2Back").onclick = () => formV2Close(S);
  });
  setTimeout(() => {
    if (S.closed) return;
    const result = FormAnalyze.analyzePacked(S.buffer.pack(S.hand), { handedness: S.hand, fps: fpsSeen || 30, rhoRef: formV2RhoRef(S.hand) });
    S.result = result;
    const replay = S.src === "replay";
    const date = replay ? S.fileDate : today();
    const linked = replay ? null : db.sessions.filter((s) => s && s.date === date).slice(-1)[0] || null;
    S.record = FormV2.buildRecord(result, {
      id: uid(), date, ts: S.startedAt || Date.now(), sessionId: linked ? linked.id : null, setupId: linked ? linked.setupId || null : null,
      appVer: APP_VER, modelVer: FORM_V2_MODEL, frame, facing: replay ? null : S.facing, hand: S.hand, src: S.src,
      note: replay ? "(保存済み動画から解析)" : "",
    });
    const m = FormV2.read(S.record), q = result.quality, shots = m.count, df = Math.max(0, ...FormV2.COLS.map((k) => (FormV2.META[k].unit === "s" ? 0 : m.df[k] || 0)));
    const found = `${shots} 射、引き戻し ${m.letdowns} 回。${m.openCands ? `離れがはっきり写らなかった保持 ${m.openCands} 回` : "離れがはっきり写らなかった保持 なし"}`;
    const vals = shots ? `${shots} 射 × ${FormV2.keysFor(S.record).length} 項目。${formV2ViewText(S.record.v2.view)}` : "射が無いので測っていません";
    const noise = df ? `保持の中の区間どうしの差 ${df} 個から` : "見積もれる保持がありませんでした";
    const any = m.events.length > 0;
    const warns = q.warnings || [];
    const why = warns.includes("tooShort") ? "記録が短すぎました（10 コマ未満）。"
      : warns.includes("noBody") ? "体の点が取れませんでした。上半身と両腕が入る向きに置いてください。"
        : warns.includes("noFullDraw") ? "引き切った区間が見つかりませんでした。射線の真後ろや真上から撮ると、引き尺が写りません。置き方を確かめてください。"
          : "引いて保持した区間はありましたが、射として数えられる離れは見つかりませんでした。";
    const zero = !shots;
    formV2Paint(S, "analyzing", `${head.replace("解析しています", zero ? "射が見つかりませんでした" : "解析が終わりました")}
      ${S.limitHit ? `<p class="fact" data-testid="form-v2-limit">30 分（またはコマ数の上限）になったので、撮影を止めました。</p>` : ""}
      <div class="fv2Steps" data-testid="form-v2-steps">${step("記録を読み込む", read, true)}${step("射を探す", found, true)}${step("射ごとの値を測る", vals, true)}${step("測定のゆれを見積もる", noise, true)}</div>
      ${zero ? `<section class="vsec" data-testid="form-v2-zero"><div class="vsecH"><h2>射が見つかりませんでした</h2></div><p class="fact">射として数えた区間は 0 回でした。</p><p class="basis">${why}</p>
        ${S.src === "live" ? `<div class="btnRow"><button type="button" class="btn" id="fv2Again">置き方を確かめる</button></div>` : ""}
        ${any ? `<div class="btnRow fv2Tight"><button type="button" class="btn sec" id="fv2Show">見つけた区間を見る</button></div>` : ""}
        <div class="btnRow fv2Tight"><button type="button" class="btn sec" id="fv2ZeroClose">閉じる</button></div></section>` : ""}
      <p class="basis">映像は保存していません。解析に使った点の列は、結果の画面を閉じると消えます。</p>
      ${zero ? "" : `<div class="actbar"><button type="button" class="btn pri" id="fv2Show" data-testid="form-v2-show">結果を見る</button></div>`}`, () => {
      const on = (id, fn) => { const b = S.root.querySelector("#" + id); if (b) b.onclick = fn; };
      on("fv2Back", () => formV2Close(S));
      on("fv2ZeroClose", () => formV2Close(S));
      on("fv2Show", () => formV2PaintResult(S));
      on("fv2Again", () => { S.buffer = null; S.result = null; S.record = null; formV2BeginLive(S); });
    });
  }, 30);
}

/* ---- 結果（design.md 2.6） ---- */
function formV2OpenRecord(rec) {
  const S = formV2NewState(rec.cap && rec.cap.src === "replay" ? "replay" : "live");
  S.record = cloneData(rec);
  S.saved = true;
  S.stored = true; // 一覧から開いた保存済みの記録
  openModal(S.ovl, { escapeTarget: "#fv2Back", swipe: false });
  S.onResize = () => formV2Rerender(S);
  window.addEventListener("resize", S.onResize);
  formV2PaintResult(S);
  return S;
}
function formV2Rerender(S) {
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
    return `<div class="lrow"><span class="lk">${esc(FormV2.META[f.key].name)}</span><span class="lv">${b}${FormV2.fmt(f.key, x)}${cm ? `（${cm}）` : ""}<small>ほかの ${o.length} 射 ${b}${FormV2.fmt(f.key, Math.min(...o), { bare: true })}〜${FormV2.fmt(f.key, Math.max(...o))}</small></span></div>`;
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
  const warnText = { small: "体が小さく写っていました（胴の長さ 100px 未満）。位置の項目は粗くなります。", lowFps: "毎秒 15 コマ未満でした。離れの時刻は粗くなります。", gappy: "姿勢が取れなかったコマが 2 割を超えました。値が欠けた射があります。", steep: "弓手の腕がかなり上を向いていました（長い距離）。検出の境目に近い置き方です。" };
  const warns = (v.w || []).filter((w) => warnText[w]).map((w) => `<p class="basis">${warnText[w]}</p>`).join("");
  const bytes = JSON.stringify(rec).length;
  const mb = S.recBlob ? Math.max(0.1, S.recBlob.size / 1e6) : 0;
  formV2Paint(S, "result", `${formV2TopHtml("射型", "")}
    <header class="subHead fv2Head"><h3>${fmtMDW(rec.date)}の記録</h3><span class="viewDate">${hhmm}〜<br>${formV2Dur(v.dur)}</span></header>
    <section class="vsec" data-testid="form-v2-summary"><div class="vsecH"><h2>この回</h2>${S.stored ? `<span class="aside">${rec.cap.src === "replay" ? "保存した動画" : "撮影"}</span>` : `<button type="button" class="txtBtn fv2FixBtn" id="fv2Fix" data-testid="form-v2-fix-open">射数を直す</button>`}</div>
      <div class="figs two"><div class="fig"><div class="l">射</div><div class="n" data-testid="form-v2-shots">${model.count}<small>射</small></div><div class="d">${model.added || model.removed ? `直した数: 足した ${model.added}・外した ${model.removed}` : `離れがはっきり写った射 ${model.count}`}</div></div>
        <div class="fig"><div class="l">引き戻し</div><div class="n" data-testid="form-v2-letdowns">${model.letdowns}<small>回</small></div><div class="d">射に数えていません</div></div></div>
      <div class="fv2Chart fv2Timeline">${formV2TimelineSvg(model)}</div>
      <div class="fv2Legend"><span><i class="k1"></i>保持</span><span><i class="k2"></i>離れ</span><span><i class="k3"></i>戻 = 引き戻し</span>${model.openCands ? `<span><i class="k4"></i>？ = 数えていない保持</span>` : ""}${model.removed ? `<span><i class="k3"></i>外 = 外した射</span>` : ""}</div>
      ${model.openCands ? `<p class="basis" data-testid="form-v2-cand-note">離れがはっきり写らなかった保持が ${model.openCands} 回あります。射かもしれませんが、数には入れていません。${S.stored ? "" : "「射数を直す」で足せます。"}</p>` : ""}
      ${lowConf.length ? `<p class="basis">${lowConf.join("・")} 射目は、離れの位置の決め手が弱めでした。数には入れています。動画があれば確かめてください。</p>` : ""}
      ${v.over ? `<p class="basis">1 つの記録に入るのは ${FormV2.LIMITS.MAX_SHOTS} 射までです。それより後ろの ${v.over} 射は、この記録に入っていません。</p>` : ""}
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
      <div class="lrow"><span class="lk">写り</span><span class="lv">${rec.cap.o === "l" ? "横向き" : rec.cap.o === "p" ? "縦向き" : rec.cap.o === "s" ? "正方形" : "向きは不明"}${v.tpx ? `、胴の長さ ${v.tpx}px` : ""}<small>${rec.fps ? `毎秒 ${Math.round(rec.fps)} コマ、` : ""}姿勢が取れたコマ ${v.cov}%${rec.cap.src === "replay" ? "、保存した動画" : ""}</small></span></div>
      ${rec.cap.src === "replay" && !S.stored ? `<label class="lrow fv2Pick"><span class="lk">撮影日</span><input type="date" class="inp" id="fv2Date" data-testid="form-v2-date" value="${esc(rec.date)}" max="${today()}"></label>` : ""}
      <label class="lrow fv2Pick"><span class="lk">練習</span><select class="pick" id="fv2Link" data-testid="form-v2-link" aria-label="紐づける練習">${linkOpts}</select></label>
      ${warns}
      <details class="fv2More"><summary>一台のカメラでは見えないもの</summary><ul>${FORM_V2_UNSEEN.map((t) => `<li>${t}</li>`).join("")}</ul></details>
      ${S.recBlob ? `<div class="btnRow"><button type="button" class="btn sec" id="fv2Video" data-testid="form-v2-video-save">動画を端末に保存（${mb.toFixed(mb < 10 ? 1 : 0)}MB）</button></div>
        <p class="basis">この動画はアプリの中には保存されません。この画面を閉じると消えます。残すときは「端末に保存」で写真かファイルへ書き出してください。</p>` : ""}
      ${S.saved ? "" : `<div class="btnRow"><button type="button" class="btn sec" id="fv2Discard" data-testid="form-v2-discard">保存せずに閉じる</button></div>`}
    </section>
    <div class="actbar" data-testid="form-v2-actbar">${S.saveError ? `<div class="fv2Saved err" role="alert">記録を保存できませんでした。端末の保存領域が足りません。結果はこの画面に残っています。設定 &gt; データ でバックアップを書き出してから、もう一度試してください。</div>` : ""}${S.saved && !S.stored ? `<div class="fv2Saved" data-testid="form-v2-saved" role="status">保存しました。数値だけを残しました（${(S.savedBytes / 1000).toFixed(1)}KB）。</div>` : ""}
      <button type="button" class="btn pri" id="fv2Save" data-testid="form-v2-save">${S.saved ? "射型へ戻る" : S.saveError ? "もう一度試す" : "記録を保存する"}</button></div>`, () => {
    const on = (id, fn) => { const b = S.root.querySelector("#" + id); if (b) b.onclick = fn; };
    const leave = async () => {
      if (S.saved || (await appConfirm(`${model.count} 射の結果を保存せずに閉じますか？`, { danger: true, okLabel: "閉じる" }))) formV2Close(S);
    };
    on("fv2Back", leave);
    on("fv2Discard", leave);
    on("fv2Fix", () => formV2OpenFix(S));
    on("fv2ToShot", () => formV2PaintShot(S, first ? first.row : 0));
    on("fv2Video", () => formV2ShareVideo(S));
    on("fv2Save", () => {
      if (S.saved) { formV2Close(S); return; }
      const out = cloneData(S.record), done = commitFormDiagnosticDbCandidate(db, { formAnalyses: (db.formAnalyses || []).concat(out) }, { reason: "form-analysis" }, save);
      S.saveError = !done.ok;
      if (done.ok) { S.saved = true; S.savedBytes = bytes; nativePulse("success"); }
      formV2PaintResult(S);
    });
    S.root.querySelectorAll('[data-seg="overlay"] button').forEach((b) => (b.onclick = () => { S.overlay = b.dataset.val; formV2Rerender(S); }));
    const link = S.root.querySelector("#fv2Link");
    if (link) link.onchange = () => {
      const s = sessions.find((x) => x.id === link.value) || null;
      S.record.sessionId = s ? s.id : null;
      S.record.setupId = s ? s.setupId || null : null;
      if (S.saved) {
        /* 保存済みの記録は、紐づけだけを書き換える */
        const cur = (db.formAnalyses || []).find((r) => r && r.id === S.record.id);
        if (cur) { cur.sessionId = S.record.sessionId; cur.setupId = S.record.setupId; save({ reason: "form-analysis-link" }); }
      }
    };
    const date = S.root.querySelector("#fv2Date");
    if (date) date.onchange = () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value) || date.value > today()) { date.value = S.record.date; return; }
      S.record.date = date.value;
      S.record.sessionId = null;
      S.record.setupId = null;
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
    ovl.querySelector("#fv2FixOk").onclick = () => { S.record = draft; closeModal(ovl); formV2Rerender(S); };
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
    <header class="subHead fv2Head"><h3>${e.n} 射目</h3><span class="viewDate">${formV2Mmss(e.tS)}<br>${model.count} 射中</span></header>
    <section class="vsec" data-testid="form-v2-shot-time"><div class="vsecH"><h2>時間</h2><span class="aside">縦線 = ほかの ${n - 1} 射の中央値</span></div>
      <div class="fv2Bars">${[["drawMs", "引き"], ["holdMs", "保持"], ["followMs", "弓手を上げていた"]].map(([k, l]) => bar(k, l)).join("")}</div></section>
    <section class="vsec" data-testid="form-v2-shot-overlay"><div class="vsecH"><h2>重ね図</h2><span class="aside">青 = この射、灰 = ほかの中央</span></div>
      ${formV2OverlayHtml(model, S.overlay, i, true)}<div class="fv2SegRow">${formV2SegHtml("overlay", S.overlay, [["hold", "保持"], ["rel", "離れの 0.25 秒あと"]])}</div>
      <p class="basis">灰色は、ほかの ${n - 1} 射の点ごとの中央値です。保存した姿（9 点）から描いています。</p></section>
    <section class="vsec" data-testid="form-v2-shot-table"><div class="vsecH"><h2>射ごとの値</h2><span class="aside">${flagged.size ? `${flagged.size} 項目で違い` : "違いなし"}</span></div>
      <div class="fv2Tbl"><div class="fv2Tr h"><span>項目</span><span>この射</span><span>ほか ${n - 1} 射</span><span>差</span></div>${keys.map(tr).join("")}</div>
      <p class="basis">色の付いた行は、差が測定のゆれから出せる下限を超えています。% は胴の長さに対する割合です${pct}。引き尺の目安は、この回の中央値を 100% としています。「—」は測れなかった値です。</p>
      <div class="btnRow"><button type="button" class="btn sec" id="fv2Prev" data-testid="form-v2-prev">前の射</button><button type="button" class="btn sec" id="fv2Next" data-testid="form-v2-next">次の射</button></div>
    </section>`, () => {
    S.root.querySelector("#fv2Back").onclick = () => formV2PaintResult(S);
    S.root.querySelector("#fv2Prev").onclick = () => formV2PaintShot(S, (i + n - 1) % n);
    S.root.querySelector("#fv2Next").onclick = () => formV2PaintShot(S, (i + 1) % n);
    S.root.querySelectorAll('[data-seg="overlay"] button').forEach((b) => (b.onclick = () => { S.overlay = b.dataset.val; formV2Rerender(S); }));
  });
}
