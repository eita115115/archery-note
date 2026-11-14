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
   opts: { gumError: "NotAllowedError" など, modelFail: true, placeFrame: 置き方の確認で流す姿の番号, pauseAt: この番号で列を止める } */
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
        if (opts.modelFail) return Promise.reject(new Error("synthetic model failure"));
        return Promise.resolve({
          detectForVideo() {
            const l = lmsAt(st.mode === "place" ? st.placeFrame : st.i);
            return { landmarks: l ? [l] : [] };
          },
        });
      };
      const cv = document.createElement("canvas");
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
            const stage = () => {
              const el = document.querySelector('[data-testid="form-v2-screen"]');
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
    { stream: { w: stream.w, h: stream.h, frames: stream.frames, restIndex: stream.restIndex }, opts },
  );
}

module.exports = { formV2Stream, installFormV2Stub, SIX_SHOTS };
