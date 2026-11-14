"use strict";
/* 射型の記録 v2 の e2e 用: 合成の射手（tools/form-analyze-fixture.js。種で決まる乱数、実射の映像ではない）から
   ランドマークの列を作り、ページの中でカメラ・姿勢推定・コマの時刻の代わりをする。
   - 姿勢推定: loadFormPose を差し替える（既存の e2e と同じやり方）
   - カメラ: getUserMedia が canvas.captureStream() を返す（画面の大きさ = 合成の列の大きさ。縦向き・横向きを選べる）
   - コマの時刻: formV2FrameSource を差し替え、置き方の確認のあいだは 1 つの姿を流し、撮影が始まったら列を実時間より速く流す */
const FX = require("../../../tools/form-analyze-fixture.js");

const SLOT_ROLES = ["nose", "bSh", "dSh", "bEl", "dEl", "bWr", "dWr", "bHip", "dHip"];
/* 6 射 + 引き戻し 1 回 + 離れがはっきりしない保持 1 回（候補になる）。4 射目は保持が長く、アンカーが低い */
const SIX_SHOTS = [
  { kind: "shot", holdMs: 3400 },
  { kind: "shot", holdMs: 3100 },
  { kind: "shot", holdMs: 3600 },
  { kind: "letdown", holdMs: 4800 },
  { kind: "shot", holdMs: 5400, anchorDy: -0.09 },
  { kind: "shot", holdMs: 3200 },
  { kind: "shot", holdMs: 3000, back: 0.03 },
  { kind: "shot", holdMs: 3300 },
];

/* → { w, h, frames: [[tMs, [9 点 × (x, y, visibility)] | null], …], holdIndex, restIndex } */
function formV2Stream(opts = {}) {
  const w = opts.w || 720,
    h = opts.h || 1280;
  const cap = FX.makeCapture({
    seed: opts.seed || 7,
    events: opts.events || SIX_SHOTS,
    fps: opts.fps || 30,
    torsoPx: opts.torsoPx || 200,
    cx: opts.cx || 300,
    cy: opts.cy || (w < h ? 420 : 300),
  });
  const r3 = (v) => Math.round(v * 1e5) / 1e5;
  const frames = cap.poses.map((p) => [
    Math.round(p.tMs * 100) / 100,
    p.pts
      ? SLOT_ROLES.flatMap((role) => {
          const x = opts.mirror ? 600 - p.pts[role][0] : p.pts[role][0];
          return [r3(x / w), r3(p.pts[role][1] / h), p.vis[role]];
        })
      : null,
  ]);
  /* 保持の姿（1 射目の離れの 0.5 秒前）と、腕を下ろした姿 */
  const firstRelease = cap.truth.length ? cap.truth[0].releaseMs : 0;
  const holdIndex = Math.max(
    0,
    frames.findIndex((f) => f[0] >= firstRelease - 500),
  );
  return { w, h, frames, holdIndex, restIndex: 5, truth: cap.truth };
}

/* ページの中に代役を入れる。page.goto のあと（アプリのスクリプトが読み込まれたあと）に呼ぶ。
   opts: { gumError: "NotAllowedError" など, modelFail: true（__fv2.modelFail を false にすると、次から読み込める）,
           placeFrame: 置き方の確認で流す姿の番号, pauseAt: この番号で列を止める,
           restartClock: true = 映像を始め直すたびに、コマの時刻が最初へ戻る（本物のカメラの mediaTime と同じ） }
   __fv2.detects = 姿勢推定を呼んだ回数 */
async function installFormV2Stub(page, stream, opts = {}) {
  await page.evaluate(
    ({ stream, opts }) => {
      const st = (globalThis.__fv2 = {
        stream,
        i: -1,
        poseLoads: 0,
        gumCalls: 0,
        done: false,
        placeFrame: opts.placeFrame == null ? stream.restIndex : opts.placeFrame,
        mode: "place",
        clock: 1000,
        pauseAt: opts.pauseAt == null ? null : opts.pauseAt,
        modelFail: !!opts.modelFail,
        detects: 0,
      });
      const slots = [0, 11, 12, 13, 14, 15, 16, 23, 24];
      const lmsAt = (i) => {
        const f = stream.frames[i];
        if (!f || !f[1]) return null;
        const out = [];
        for (let k = 0; k < 33; k++) out.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.05 });
        slots.forEach((s, j) => {
          out[s] = { x: f[1][j * 3], y: f[1][j * 3 + 1], z: 0, visibility: f[1][j * 3 + 2] };
        });
        return out;
      };
      globalThis.loadFormPose = () => {
        st.poseLoads++;
        if (st.modelFail) return Promise.reject(new Error("synthetic model failure"));
        return Promise.resolve({
          detectForVideo() {
            st.detects++;
            const l = lmsAt(st.mode === "place" ? st.placeFrame : st.i);
            return { landmarks: l ? [l] : [] };
          },
        });
      };
      const cv = globalThis.document.createElement("canvas");
      cv.width = stream.w;
      cv.height = stream.h;
      const cx = cv.getContext("2d");
      let n = 0;
      const paint = () => {
        cx.fillStyle = `hsl(${(n += 7) % 360} 25% 28%)`;
        cx.fillRect(0, 0, cv.width, cv.height);
      };
      paint();
      setInterval(paint, 50);
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          async getUserMedia() {
            st.gumCalls++;
            if (opts.gumError) {
              const e = new Error("synthetic camera failure");
              e.name = opts.gumError;
              throw e;
            }
            return cv.captureStream(20);
          },
        },
      });
      globalThis.formV2FrameSource = (video, replay) => {
        let on = false,
          timer = 0;
        return {
          start(onFrame, onEnd) {
            on = true;
            if (opts.restartClock) st.clock = 1000;
            const stage = () => {
              const el = globalThis.document.querySelector('[data-testid="form-v2-screen"]');
              return el ? el.dataset.stage : "";
            };
            let base = NaN;
            const pump = () => {
              if (!on) return;
              const s = stage();
              if (s === "place") {
                st.mode = "place";
                st.clock += 34;
                onFrame(st.clock);
              } else if (s === "capture" || s === "reading") {
                st.mode = "run";
                if (!Number.isFinite(base)) base = replay ? 0 : st.clock + 34;
                for (let k = 0; k < 90 && on; k++) {
                  if (st.pauseAt != null && st.i >= st.pauseAt) break; // 撮影の途中の画面を見るための一時停止
                  if (st.i + 1 >= stream.frames.length) {
                    st.done = true;
                    if (replay && onEnd) onEnd();
                    break;
                  }
                  st.i++;
                  onFrame(base + stream.frames[st.i][0]);
                }
              }
              if (on) timer = setTimeout(pump, s === "place" ? 12 : 0);
            };
            pump();
          },
          stop() {
            on = false;
            clearTimeout(timer);
          },
        };
      };
    },
    {
      stream: { w: stream.w, h: stream.h, frames: stream.frames, restIndex: stream.restIndex },
      opts,
    },
  );
}

/* 保存済みの v2 の記録を、アプリと同じ解析器・同じ組み立てで作る（推移・検証用の書き出しの検査用。合成の射手）。
   opts: { id, date, ts, seed, events, diag（解析器の中の値を付ける）, edit（記録を直す関数）, sessionId, setupId }。→ 記録の配列（36 射を超えると複数） */
const FA = require("../../../tools/form-analyze-loader.js");
const FV = require("../../../tools/form-record-loader.js");
function formV2Records(opts = {}) {
  const w = opts.w || 720,
    h = opts.h || 1280;
  const cap = FX.makeCapture({
    seed: opts.seed || 7,
    events: opts.events || SIX_SHOTS,
    fps: 30,
    torsoPx: 200,
    cx: 300,
    cy: 420,
  });
  const buf = FV.makeBuffer();
  for (const f of FX.toFrames(cap.poses, { w, h })) buf.push(f.tMs, f.landmarks, w, h);
  const result = FA.analyzePacked(buf.pack("right"), {
    handedness: "right",
    fps: 30,
    debug: !!opts.diag,
  });
  const id = opts.id || "v2-rec";
  const recs = FV.buildRecords(result, {
    id,
    ids: ["b", "c", "d", "e", "f"].map((x) => `${id}-${x}`),
    date: opts.date || "2026-11-01",
    ts: opts.ts || 1793491200000,
    sessionId: opts.sessionId || null,
    setupId: opts.setupId || null,
    appVer: 128,
    modelVer: "pose_landmarker_lite v1 (tasks-vision 0.10.14)",
    frame: { w, h },
    facing: "environment",
    hand: "right",
    src: "live",
    diag: !!opts.diag,
  });
  for (const r of recs) {
    r.v2.view.cls = "s"; // 合成の射手は真横。腕の長さの基準が実物と違うので、検査では真横と決めておく
    if (opts.edit) opts.edit(r);
  }
  return recs;
}

/* 検証用の書き出し（FormV2.diagnostics）に入っていてはいけないものが無いことを確かめるための一覧 */
const DIAG_FORBIDDEN_KEYS = ["id", "date", "ts", "sessionId", "setupId", "note", "ps", "pr"];
function diagnosticKeyPaths(value, path = "", out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => diagnosticKeyPaths(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object")
    for (const k of Object.keys(value)) {
      out.push(`${path}.${k}`);
      diagnosticKeyPaths(value[k], `${path}.${k}`, out);
    }
  return out;
}

module.exports = {
  formV2Stream,
  installFormV2Stub,
  SIX_SHOTS,
  formV2Records,
  DIAG_FORBIDDEN_KEYS,
  diagnosticKeyPaths,
};

/* 画面の検査（試作の shoot.js と同じ項目）: 13px 未満の文字、44px 未満の押せる部品、横あふれ、NaN・undefined。
   いちばん手前の全画面（.ovl）か、無ければ #main を見る。問題の一覧を返す（無ければ空） */
async function auditFormV2Screen(page) {
  return page.evaluate(() => {
    const doc = globalThis.document;
    const overlays = [...doc.querySelectorAll("body > .ovl")];
    const root = overlays.length ? overlays[overlays.length - 1] : doc.querySelector("#main");
    const out = [],
      W = doc.documentElement.clientWidth;
    if (doc.documentElement.scrollWidth > W)
      out.push("page-x-scroll " + doc.documentElement.scrollWidth);
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && globalThis.getComputedStyle(e).visibility !== "hidden";
    };
    root.querySelectorAll("*").forEach((e) => {
      if (e.closest("svg") || e.closest(".srOnly") || !visible(e)) return;
      const cs = globalThis.getComputedStyle(e),
        size = parseFloat(cs.fontSize),
        r = e.getBoundingClientRect();
      const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const label = `${e.tagName}.${e.className} "${e.textContent.trim().slice(0, 14)}"`;
      if (hasText && size < 13) out.push(`font<13 ${label} ${size}`);
      if (r.right > W + 0.5 || r.left < -0.5)
        out.push(`x-overflow ${label} ${Math.round(r.left)}-${Math.round(r.right)}`);
      const tap = ["BUTTON", "SELECT", "INPUT", "SUMMARY"].includes(e.tagName);
      if (tap && (r.height < 43.5 || r.width < 43.5))
        out.push(`tap<44 ${label} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (
        e.scrollWidth > e.clientWidth + 1 &&
        cs.overflowX !== "visible" &&
        !["SELECT", "INPUT", "VIDEO"].includes(e.tagName)
      )
        out.push(`clipped ${label}`);
    });
    root.querySelectorAll("svg text").forEach((t) => {
      const svg = t.ownerSVGElement,
        box = svg.getBoundingClientRect();
      if (!box.width) return;
      const scale = box.width / (svg.viewBox.baseVal.width || box.width),
        size = parseFloat(globalThis.getComputedStyle(t).fontSize) * scale,
        r = t.getBoundingClientRect();
      if (size < 12.95) out.push(`svgtext<13 ${size.toFixed(1)} ${t.textContent}`);
      if (r.right > W + 0.5 || r.left < -0.5) out.push(`svgtext-overflow ${t.textContent}`);
    });
    const text = root.innerText;
    for (const bad of ["NaN", "undefined", "null", "Infinity"])
      if (text.includes(bad)) out.push(`text contains ${bad}`);
    return [...new Set(out)];
  });
}

module.exports.auditFormV2Screen = auditFormV2Screen;
