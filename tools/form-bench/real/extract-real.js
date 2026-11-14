#!/usr/bin/env node
"use strict";
/* Extract per-frame MediaPipe Pose landmarks from licensed stock footage (Pixabay sources listed in
   tools/golden-replay/sources.md) and save compact landmark fixtures in tools/form-bench/real/.

   node tools/form-bench/real/extract-real.js --videos <dir> [--download] [--clip id,...]
                                              [--delegate CPU|GPU] [--out <dir>] [--verify]
                                              [--chromium <path>]

   - Videos live OUTSIDE the repo (--videos, default <os tmpdir>/archery-note-form-bench/videos).
     --download fetches the Pixabay files with curl; every file must match the SHA-256 recorded in
     tools/golden-replay/expectations.json. Videos are never written into the repo.
   - Inference uses the app's own self-hosted runtime and model (assets/pose/: tasks-vision 0.10.14
     + pose_landmarker_lite.task), created with the same options as loadFormPose() in
     scripts/47-form-view.js (runningMode VIDEO, numPoses 1). The delegate defaults to CPU, the
     golden-replay profile (the app itself asks for GPU; headless GPU is SwiftShader).
   - Frame stepping is deterministic: ffprobe lists every decoded frame's presentation time; the
     page seeks to the middle of each frame's display interval, waits for "seeked" and for
     requestVideoFrameCallback to report that exact frame, then calls detectForVideo(video, ms)
     with strictly increasing integer timestamps. Frames whose reported mediaTime differs from
     the expected one are counted (seekMismatch). Nothing is skipped.
   - Saved per frame: tMs (presentation time) and 13 landmarks (nose, ears, shoulders, elbows,
     wrists, hips, knees) as x, y (5 decimals), z, visibility (4 decimals). No pixels.
   Requires Playwright's Chromium (devDependency) and ffprobe on PATH. */

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const POSE_DIR = path.join(ROOT, "assets", "pose");
const EXPECTATIONS = path.join(ROOT, "tools", "golden-replay", "expectations.json");
const POINTS = Object.freeze([0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26]);

/* Pixabay sources only (Pixabay Content License). Mixkit sources are Restricted / Personal Use only
   and must not become tracked fixtures (tools/golden-replay/sources.md). visualShots and notes
   are the visual review recorded in sources.md. */
const CLIPS = Object.freeze({
  "pixabay-43254-archery-woman": {
    file: "pixabay-43254-archery-woman.mp4",
    url: "https://cdn.pixabay.com/video/2020/06/27/43254-435970559_large.mp4",
    page: "https://pixabay.com/videos/archery-woman-target-garden-nature-43254/",
    license: "Pixabay Content License",
    handedness: "right",
    visualShots: 1,
    visualNote:
      "One recurve shot in a garden range; the archer is small in frame (camera high and far, slightly behind). sources.md: release at about 4.43-4.44 s, bow lowered and archer leaves after 5 s, empty range after 9 s. Frame check for this benchmark (2026-11-14): raising/drawing at 1.5-2.4 s; empty, panning range at 12.9-13.6 s.",
  },
  "pixabay-40769-archer": {
    file: "pixabay-40769-archer.mp4",
    url: "https://cdn.pixabay.com/video/2020/06/01/40769-426939441_large.mp4",
    page: "https://pixabay.com/videos/archer-archery-bow-arrow-bowman-40769/",
    license: "Pixabay Content License",
    handedness: "right",
    /* sources.md counts one release in the first ~2.5 s; the frame check for this benchmark could
       not see one, so the visual count is recorded as unknown (null) */
    visualShots: null,
    visualNote:
      "Montage, waist up. Frame check for this benchmark (2026-11-14): 0-0.9 s fade-in while drawing; 0.9-2.8 s full draw (camera moving); 2.8-3.2 s cross-fade to a second full-draw scene; 4.1-4.4 s cross-fade to the target. No release is clearly visible (one may be hidden in a cross-fade). sources.md lists one release in the first ~2.5 s. Reviewed expectation: 0 detected shots.",
  },
  "pixabay-150869-arrows-target": {
    file: "pixabay-150869-arrows-target.mp4",
    url: "https://cdn.pixabay.com/video/2023/02/15/150869-799327585_large.mp4",
    page: "https://pixabay.com/videos/arrows-target-bow-and-arrow-sport-150869/",
    license: "Pixabay Content License",
    handedness: "right",
    visualShots: 0,
    visualNote: "Fixed close-up of a target face with arrows arriving; no person in frame.",
  },
});

function parseArgs(argv) {
  const o = {
    videos: path.join(os.tmpdir(), "archery-note-form-bench", "videos"),
    out: __dirname,
    download: false,
    clips: Object.keys(CLIPS),
    delegate: "CPU",
    verify: false,
    /* Playwright's Chromium; the pinned headless-shell build may be missing, so prefer an
       explicit executable when one is installed at the usual place */
    chromium:
      process.env.FORM_BENCH_CHROMIUM ||
      (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : null),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "--videos") o.videos = path.resolve(val());
    else if (a === "--out") o.out = path.resolve(val());
    else if (a === "--download") o.download = true;
    else if (a === "--clip") o.clips = val().split(",").filter(Boolean);
    else if (a === "--delegate") o.delegate = val().toUpperCase();
    else if (a === "--verify") o.verify = true;
    else if (a === "--chromium") o.chromium = path.resolve(val());
    else throw new Error(`unknown option ${a}`);
  }
  for (const c of o.clips) if (!CLIPS[c]) throw new Error(`unknown clip ${c}`);
  if (!["CPU", "GPU"].includes(o.delegate)) throw new Error("--delegate must be CPU or GPU");
  if (o.videos === ROOT || o.videos.startsWith(ROOT + path.sep))
    throw new Error("--videos must be outside the repository (videos are never committed)");
  return o;
}

const sha256File = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

function expectationFor(file) {
  const ex = JSON.parse(fs.readFileSync(EXPECTATIONS, "utf8"));
  const c = ex.cases.find((x) => x.video === file);
  if (!c) throw new Error(`${file} has no reviewed expectation`);
  return { profile: ex.profile, ...c };
}

function probe(file) {
  const info = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,r_frame_rate,nb_frames,duration,codec_name",
        "-of",
        "json",
        file,
      ],
      { encoding: "utf8" },
    ),
  ).streams[0];
  const times = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "frame=best_effort_timestamp_time",
      "-of",
      "csv=p=0",
      file,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  )
    .split(/\r?\n/)
    .map((s) => parseFloat(s))
    .filter(Number.isFinite);
  const [num, den] = String(info.r_frame_rate).split("/").map(Number);
  return { info, times, fps: den ? num / den : num };
}

/* local server: the repo's pose assets, an empty page, and range-served videos from outside the repo */
function startServer(videoDir) {
  const types = {
    ".mjs": "text/javascript",
    ".js": "text/javascript",
    ".wasm": "application/wasm",
    ".task": "application/octet-stream",
    ".mp4": "video/mp4",
  };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://127.0.0.1");
    if (u.pathname === "/" || u.pathname === "/index.html") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(
        '<!doctype html><html><head><meta charset="utf-8"><title>form-bench extract</title></head><body style="margin:0"></body></html>',
      );
      return;
    }
    let file = null;
    if (u.pathname.startsWith("/assets/pose/"))
      file = path.join(POSE_DIR, path.basename(u.pathname));
    else if (u.pathname.startsWith("/__video__/"))
      file = path.join(videoDir, path.basename(u.pathname));
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const size = fs.statSync(file).size;
    const type = types[path.extname(file)] || "application/octet-stream";
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      res.writeHead(206, {
        "content-type": type,
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${size}`,
        "content-length": end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "content-type": type,
        "accept-ranges": "bytes",
        "content-length": size,
      });
      fs.createReadStream(file).pipe(res);
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/* runs inside the page */
/* global location, document */
async function pageExtract({ videoUrl, times, delegate, points }) {
  const base = new URL("/assets/pose/", location.href);
  const mod = await import(new URL("vision_bundle.mjs", base).href);
  const fileset = await mod.FilesetResolver.forVisionTasks(base.href.replace(/\/$/, ""));
  const lm = await mod.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: new URL("pose_landmarker_lite.task", base).href, delegate },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.style.width = "320px";
  document.body.appendChild(v);
  await new Promise((resolve, reject) => {
    v.onloadeddata = resolve;
    v.onerror = () => reject(new Error("video failed to load"));
    v.src = videoUrl;
  });
  const frameShown = (timeoutMs) =>
    new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          resolve(null);
        }
      }, timeoutMs);
      v.requestVideoFrameCallback((now, meta) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(meta);
      });
    });
  const seekTo = (t) =>
    new Promise((resolve) => {
      const shown = frameShown(1500);
      v.addEventListener("seeked", () => shown.then(resolve), { once: true });
      v.currentTime = t;
    });
  const r = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
  const frames = [];
  const stats = { seekMismatch: 0, noFrameCallback: 0, withPose: 0 };
  let lastTs = -1;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const next = i + 1 < times.length ? times[i + 1] : t + (i > 0 ? t - times[i - 1] : 1 / 30);
    const meta = await seekTo(t + (next - t) / 2);
    if (!meta) stats.noFrameCallback++;
    else if (Math.abs(meta.mediaTime - t) > 0.002) stats.seekMismatch++;
    let ts = Math.round(t * 1000);
    if (ts <= lastTs) ts = lastTs + 1;
    lastTs = ts;
    const res = lm.detectForVideo(v, ts);
    const l = res && res.landmarks && res.landmarks[0];
    const row = [r(t * 1000, 3)];
    if (l) {
      stats.withPose++;
      for (const k of points) {
        const p = l[k];
        row.push(r(p.x, 5), r(p.y, 5), r(p.z, 4), r(p.visibility == null ? 0 : p.visibility, 4));
      }
    }
    frames.push(row);
  }
  lm.close();
  return { frames, stats, width: v.videoWidth, height: v.videoHeight };
}

async function extractClip(browser, server, id, clip, opts) {
  const file = path.join(opts.videos, clip.file);
  const expect = expectationFor(clip.file);
  const sha = sha256File(file);
  if (sha !== expect.sha256)
    throw new Error(`${clip.file}: SHA-256 ${sha} does not match ${expect.sha256}`);
  const { info, times, fps } = probe(file);
  const port = server.address().port;
  const run = async () => {
    const context = await browser.newContext({ viewport: { width: 640, height: 480 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    const t0 = Date.now();
    const out = await page.evaluate(pageExtract, {
      videoUrl: `/__video__/${clip.file}`,
      times,
      delegate: opts.delegate,
      points: POINTS,
    });
    out.wallS = (Date.now() - t0) / 1000;
    await context.close();
    return out;
  };
  const res = await run();
  let deterministic = null;
  if (opts.verify) {
    const again = await run();
    deterministic = JSON.stringify(again.frames) === JSON.stringify(res.frames);
  }
  const pkg = (rel) => sha256File(path.join(POSE_DIR, rel));
  const fixture = {
    schema: "form-bench-real-v1",
    clipId: id,
    source: { page: clip.page, url: clip.url, license: clip.license, file: clip.file },
    videoSha256: sha,
    video: {
      width: res.width,
      height: res.height,
      codec: info.codec_name,
      fps: +fps.toFixed(3),
      decodedFrames: times.length,
      durationMs: Math.round(parseFloat(info.duration) * 1000),
    },
    runtime: {
      tasksVision: "0.10.14",
      model: "pose_landmarker_lite.task (float16, v1)",
      poseModelSha256: pkg("pose_landmarker_lite.task"),
      visionBundleSha256: pkg("vision_bundle.mjs"),
      visionWasmJsSha256: pkg("vision_wasm_internal.js"),
      visionWasmSha256: pkg("vision_wasm_internal.wasm"),
      options: { runningMode: "VIDEO", numPoses: 1, delegate: opts.delegate },
      chromiumVersion: browser.version(),
      playwrightVersion: require(require.resolve("playwright/package.json", { paths: [ROOT] }))
        .version,
    },
    extraction: {
      method:
        "ffprobe best_effort_timestamp list; seek to the middle of each frame interval; await seeked + requestVideoFrameCallback; detectForVideo(video, round(pts ms), strictly increasing)",
      framesAnalyzed: res.frames.length,
      framesWithPose: res.stats.withPose,
      framesSkipped: times.length - res.frames.length,
      seekMismatch: res.stats.seekMismatch,
      noFrameCallback: res.stats.noFrameCallback,
      deterministicRerun: deterministic,
      wallSeconds: +res.wallS.toFixed(1),
      inferenceFps: +(res.frames.length / res.wallS).toFixed(1),
    },
    truth: {
      handedness: clip.handedness,
      visualShots: clip.visualShots,
      visualNote: clip.visualNote,
      reviewedExpectation: {
        source: "tools/golden-replay/expectations.json",
        expectedStatus: expect.expectedStatus,
        expectedDetectedShots: expect.expectedDetectedShots,
        acceptedReleaseWindowsMs: expect.retainedReleaseWindowsMs,
        profile: expect.profile,
      },
    },
    points: POINTS,
    columns:
      "tMs, then per point: x, y, z, visibility (normalized like MediaPipe); [tMs] alone = no pose",
    frames: res.frames,
  };
  const outFile = path.join(opts.out, `${id}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(fixture)}\n`);
  return { outFile, fixture };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(opts.videos, { recursive: true });
  for (const id of opts.clips) {
    const clip = CLIPS[id];
    const dest = path.join(opts.videos, clip.file);
    if (!fs.existsSync(dest)) {
      if (!opts.download) throw new Error(`${dest} missing (use --download)`);
      console.log(`download ${clip.url}`);
      execFileSync("curl", ["-sS", "-fL", "--max-time", "300", "-o", dest, clip.url], {
        stdio: "inherit",
      });
    }
  }
  const { chromium } = require(require.resolve("playwright", { paths: [ROOT] }));
  const server = await startServer(opts.videos);
  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(opts.chromium ? { executablePath: opts.chromium } : {}),
      args: ["--autoplay-policy=no-user-gesture-required", "--enable-unsafe-swiftshader"],
    });
    for (const id of opts.clips) {
      const { outFile, fixture } = await extractClip(browser, server, id, CLIPS[id], opts);
      const e = fixture.extraction;
      console.log(
        `${id}: ${e.framesAnalyzed}/${fixture.video.decodedFrames} frames, pose in ${e.framesWithPose}, seekMismatch ${e.seekMismatch}, noCallback ${e.noFrameCallback}, ${e.inferenceFps} fps` +
          (e.deterministicRerun == null ? "" : `, rerun identical: ${e.deterministicRerun}`) +
          ` -> ${path.relative(process.cwd(), outFile)} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`,
      );
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exitCode = 1;
  });
}

module.exports = { CLIPS, POINTS };
