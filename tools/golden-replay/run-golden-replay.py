#!/usr/bin/env python3
"""Archery Note ゴールデン再生ハーネス。

保存済み動画解析（scripts/47-form-view.js の startFormReplay）に実映像を投入し、
検出結果（射数・角度・保持時間・release 安定性など）を baseline JSON として記録する。

仕組み:
  1. リポジトリを http.server でローカルサーブ（読み取りのみ、リポジトリへの書き込みなし）
  2. headless Chromium でアプリを開く（MediaPipe pose は assets/pose/ から自己ホスト）
  3. 動画は同じローカルサーバの /__golden__/<name> パスから配信（同一オリジン化で
     CSP: media-src 'self' を満たす。リポジトリに動画は置かない。Range 対応）
     ※ Playwright の page.route は <video> のメディア要求を横取りできないことがあるため
       サーバ側で配信する方式を採用
  4. page.evaluate で startFormReplay('/__golden__/video.mp4') を直接呼ぶ
     （UI の file input と等価: openFormReplay は同関数に objectURL を渡すだけ）
  5. #frPhase が「完了」になるまで待機 → #frSave をクリックして db.formAnalyses に保存
     → 最新レコードを page.evaluate で取得
  6. コンソールエラー・ページエラーも全件記録

使用例（リポジトリ直下から。--repo / --out-dir は省略時 tools/golden-replay/ 基準の既定値を使う）:
  python tools/golden-replay/run-golden-replay.py tools/golden-replay/videos/*.mp4
  python tools/golden-replay/run-golden-replay.py --handedness left --headed \
      tools/golden-replay/videos/pixabay-43254-archery-woman.mp4
  python tools/golden-replay/run-golden-replay.py --repo C:/other/archery-note \
      --out-dir ./baselines video1.mp4 video2.mp4
"""

import argparse
import http.server
import json
import mimetypes
import socket
import sys
import threading
import time
from datetime import datetime, timezone
from functools import partial
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

GOLDEN_PREFIX = "/__golden__/"

# MediaPipe WASM 読み込み + モデル初期化の猶予
LANDMARKER_LOAD_TIMEOUT_MS = 120_000
# 解析は実時間再生なので 動画長 * 係数 + 固定猶予 で待つ
ANALYSIS_TIMEOUT_FACTOR = 3.0
ANALYSIS_TIMEOUT_BASE_MS = 60_000


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class HarnessHandler(http.server.SimpleHTTPRequestHandler):
    """リポジトリを読み取り専用でサーブしつつ、/__golden__/<name> で動画を配信する。

    <video> 要素は Range 要求を出すため、動画パスのみ簡易 Range (206) に対応。
    golden_videos: {配信名: Path} はサーバインスタンス側に持たせる。
    """

    def log_message(self, *args):  # サーブログは不要
        pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.startswith(GOLDEN_PREFIX):
            self._serve_golden(path[len(GOLDEN_PREFIX):])
        else:
            super().do_GET()

    def do_HEAD(self):
        path = self.path.split("?", 1)[0]
        if path.startswith(GOLDEN_PREFIX):
            self._serve_golden(path[len(GOLDEN_PREFIX):], head=True)
        else:
            super().do_HEAD()

    def _serve_golden(self, name: str, head: bool = False):
        video = self.server.golden_videos.get(name)
        if not video or not video.exists():
            self.send_error(404, "golden video not registered")
            return
        size = video.stat().st_size
        ctype = mimetypes.guess_type(video.name)[0] or "video/mp4"
        start, end = 0, size - 1
        rng = self.headers.get("Range")
        is_partial = False
        if rng and rng.startswith("bytes="):
            try:
                spec = rng[len("bytes="):].split(",")[0].strip()
                s, _, e = spec.partition("-")
                start = int(s) if s else max(0, size - int(e))
                end = int(e) if (s and e) else size - 1
                end = min(end, size - 1)
                if start <= end:
                    is_partial = True
            except ValueError:
                start, end = 0, size - 1
        length = end - start + 1
        self.send_response(206 if is_partial else 200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if is_partial:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        if head:
            return
        with open(video, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (ConnectionAbortedError, BrokenPipeError):
                    return
                remaining -= len(chunk)


def serve_repo(repo: Path, port: int) -> http.server.ThreadingHTTPServer:
    handler = partial(HarnessHandler, directory=str(repo))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    httpd.golden_videos = {}
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def analyze_video(page, httpd, video_path: Path, handedness: str,
                  playback_rate: float = 0.25, delegate: str = "CPU") -> dict:
    """1本の動画をリプレイ解析し、結果 dict を返す。

    playback_rate: 再生速度。アプリの位相判定は video.currentTime 基準（動画時間軸）
    のため、遅く再生しても保持時間・角度などの意味は変わらず、headless の遅い
    推論でも動画時間あたりのサンプル数を稼げる。
    リリース判定（stepFormPhase）は 250ms 窓内に「アンカー圏2フレーム + 瞬間速度
    スパイク」を要求するため、動画時間1秒あたり20サンプル以上が望ましい。

    delegate: MediaPipe の推論デリゲート。アプリ本体は GPU 固定だが、headless の
    SwiftShader GPU は極端に遅い（〜2fps）ため、既定で CPU (XNNPACK) を使う。
    """
    result = {
        "video": video_path.name,
        "videoBytes": video_path.stat().st_size,
        "handedness": handedness,
        "playbackRate": playback_rate,
        "delegate": delegate,
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "status": "unknown",
        "consoleErrors": [],
        "pageErrors": [],
        "hudTimeline": [],
    }

    console_errors = []
    page_errors = []

    def on_console(msg):
        if msg.type in ("error", "warning"):
            console_errors.append({"type": msg.type, "text": msg.text})

    def on_pageerror(err):
        page_errors.append(str(err))

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)

    # 同一オリジンの配信パスとして登録（CSP media-src 'self' を満たす）
    httpd.golden_videos[video_path.name] = video_path
    golden_url = GOLDEN_PREFIX + video_path.name

    try:
        # ランドマーカーをハーネス側で先に生成し（delegate 選択可能）、
        # detectForVideo に計測シムを噛ませてから、アプリの loadFormPose() が
        # 返すグローバル formPosePromise に注入する。
        #   - delegate: アプリ本体は GPU 固定。headless では CPU が数倍速い
        #   - タイムスタンプ重複ガード: startFormReplay は video.currentTime*1000 を
        #     そのまま渡すため、同一 μs に丸まるフレームで MediaPipe の
        #     CalculatorGraph が "Packet timestamp mismatch" で恒久クラッシュする
        #     （実バグ。ハーネス側では整数 ms + 厳密単調増加を保証し dupTs 計上）
        #   - 検出統計: 呼び出し数 / ランドマークが取れたフレーム数
        page.evaluate(
            """async (delegate) => {
                const base = new URL('assets/pose/', location.href);
                const mod = await import(new URL('vision_bundle.mjs', base).href);
                const fileset = await mod.FilesetResolver.forVisionTasks(base.href.replace(/\\/$/, ''));
                const lm = await mod.PoseLandmarker.createFromOptions(fileset, {
                    baseOptions: {
                        modelAssetPath: new URL('pose_landmarker_lite.task', base).href,
                        delegate: delegate,
                    },
                    runningMode: 'VIDEO', numPoses: 1,
                });
                const orig = lm.detectForVideo.bind(lm);
                let last = -1;
                window.__goldenStats = { calls: 0, landmarkFrames: 0, dupTs: 0 };
                lm.detectForVideo = (video, ts) => {
                    const s = window.__goldenStats;
                    s.calls++;
                    // MediaPipe 内部は μs 精度。ms の小数が同一 μs に丸まって
                    // "Packet timestamp mismatch" になるため、整数 ms + 厳密単調増加を保証する
                    const t = Math.ceil(ts);
                    if (t <= last) { s.dupTs++; last = last + 1; }
                    else { last = t; }
                    const res = orig(video, last);
                    if (res && res.landmarks && res.landmarks[0]) s.landmarkFrames++;
                    return res;
                };
                // アプリの loadFormPose() はこの promise を返すようになる（同一グローバル束縛）
                formPosePromise = Promise.resolve(lm);

                // フレームトレース: 位相判定の内部量（速度・アンカー距離・位相）を記録。
                // computeFormVelocity / stepFormPhase はグローバル関数なので包める
                window.__goldenTrace = [];
                const origVel = computeFormVelocity;
                let lastVel = 0;
                computeFormVelocity = (h, raw, now) => {
                    lastVel = origVel(h, raw, now);
                    return lastVel;
                };
                const origStep = stepFormPhase;
                stepFormPhase = (st, raw, history, sens, now) => {
                    const r = origStep(st, raw, history, sens, now);
                    window.__goldenTrace.push({
                        t: Math.round(now),
                        v: +lastVel.toFixed(2),
                        an: raw ? +raw.anchorNorm.toFixed(3) : null,
                        ph: r.phase,
                        rel: r.released || undefined,
                        cancel: r.canceled || undefined,
                        // Plan-0 (release-detection-triage-2026-07-13): 非発火/取消パスにも
                        // 返るようになった debug をトレースに載せる。0射のケースでも
                        // per-frame の maxV / anchorNorm / closeFrames / hasNullGap /
                        // refractoryRemaining が取れて、支配的根因の判定に使う。
                        dbg: r.debug || undefined,
                    });
                    return r;
                };
            }""",
            delegate,
        )

        # 利き手設定を反映してからリプレイ開始
        page.evaluate(
            """([handedness, url]) => {
                db.settings.formHandedness = handedness;
                db.settings.formTrackingEnabled = true;
                startFormReplay(url);
            }""",
            [handedness, golden_url],
        )

        # 再生速度を落とす（動画時間軸の解析には影響しない。上記 docstring 参照）
        page.wait_for_selector("#frVideo", timeout=10_000)
        page.evaluate(
            """(rate) => {
                const v = document.querySelector('#frVideo');
                v.defaultPlaybackRate = rate;
                v.playbackRate = rate;
            }""",
            playback_rate,
        )

        # 解析ループ開始（phase が「読込中」から変わる）か、失敗メッセージを待つ
        page.wait_for_function(
            """() => {
                const ph = document.querySelector('#frPhase');
                const hud = document.querySelector('#frHud');
                if (!ph || !hud) return false;
                const t = hud.textContent || '';
                return ph.textContent !== '読込中' ||
                       t.includes('できませんでした') || t.includes('失敗');
            }""",
            timeout=LANDMARKER_LOAD_TIMEOUT_MS,
        )
        hud0 = page.eval_on_selector("#frHud", "el => el.textContent")
        result["hudTimeline"].append({"t": "after-load", "hud": hud0})
        if "できませんでした" in hud0 or "失敗" in hud0:
            result["status"] = "load-failed"
            result["error"] = hud0
            return result

        # 動画メタデータ
        meta = page.evaluate(
            """() => {
                const v = document.querySelector('#frVideo');
                return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
            }"""
        )
        result["videoMeta"] = meta
        duration = meta.get("duration") or 60

        # 解析完了（phase=完了）まで 2 秒間隔でポーリング。
        # ページ内クラッシュ（detectForVideo 例外で loop 停止）は
        # 「currentTime が進まない + pageerror あり」で検出して早期終了する。
        deadline = time.monotonic() \
            + (duration / playback_rate) * ANALYSIS_TIMEOUT_FACTOR \
            + ANALYSIS_TIMEOUT_BASE_MS / 1000
        prev_time, stalled_polls = -1.0, 0
        status = None
        while True:
            state = page.evaluate(
                """() => {
                    const ph = document.querySelector('#frPhase');
                    const hud = document.querySelector('#frHud');
                    const v = document.querySelector('#frVideo');
                    return { phase: ph && ph.textContent, hud: hud && hud.textContent,
                             t: v && v.currentTime, ended: v && v.ended };
                }"""
            )
            hud1 = state.get("hud") or ""
            if state.get("phase") == "完了":
                status = "completed"
                break
            if "失敗" in hud1 or "できませんでした" in hud1:
                result["status"] = "analysis-failed"
                result["error"] = hud1
                result["hudTimeline"].append({"t": "after-analysis", "hud": hud1})
                return result
            cur = state.get("t") or 0
            stalled_polls = stalled_polls + 1 if cur == prev_time else 0
            prev_time = cur
            if stalled_polls >= 3 and page_errors:
                result["status"] = "crashed"
                result["error"] = page_errors[-1].splitlines()[0]
                result["videoTimeAtCrash"] = cur
                result["hudTimeline"].append({"t": "on-crash", "hud": hud1,
                                              "phase": state.get("phase")})
                return result
            if time.monotonic() > deadline:
                result["status"] = "timeout"
                result["hudTimeline"].append({"t": "on-timeout", "hud": hud1,
                                              "phase": state.get("phase")})
                return result
            time.sleep(2)

        hud1 = page.eval_on_selector("#frHud", "el => el.textContent")
        result["hudTimeline"].append({"t": "after-analysis", "hud": hud1})

        # 画面上の検出射数（保存前の一次情報）と検出統計
        shots_on_screen = page.evaluate(
            "() => document.querySelectorAll('#frShots [data-shot-id]').length"
        )
        result["detectedShots"] = shots_on_screen
        result["detectStats"] = page.evaluate("() => window.__goldenStats || null")
        result["trace"] = page.evaluate("() => window.__goldenTrace || null")

        if shots_on_screen > 0:
            # 保存して db.formAnalyses から特徴量一式を取得
            page.click("#frSave")
            page.wait_for_function(
                "() => !document.querySelector('#frVideo')", timeout=10_000
            )
            record = page.evaluate(
                """() => {
                    const r = (db.formAnalyses || []).slice(-1)[0] || null;
                    return r ? JSON.parse(JSON.stringify(r)) : null;
                }"""
            )
            result["formAnalysis"] = record
            result["status"] = "ok"
        else:
            # 0射: 保存ボタンは無効なので閉じる（確認ダイアログは0射なら出ない）
            page.click("#frClose")
            page.wait_for_function(
                "() => !document.querySelector('#frVideo')", timeout=10_000
            )
            result["formAnalysis"] = None
            result["status"] = "ok-no-shots"

    except PWTimeout as e:
        result["status"] = "timeout"
        result["error"] = str(e).splitlines()[0]
        try:
            result["hudTimeline"].append({
                "t": "on-timeout",
                "hud": page.eval_on_selector("#frHud", "el => el.textContent"),
                "phase": page.eval_on_selector("#frPhase", "el => el.textContent"),
            })
        except Exception:
            pass
    finally:
        result["consoleErrors"] = console_errors
        result["pageErrors"] = page_errors
        result["finishedAt"] = datetime.now(timezone.utc).isoformat()
        if "detectStats" not in result:
            try:
                result["detectStats"] = page.evaluate("() => window.__goldenStats || null")
            except Exception:
                result["detectStats"] = None
        httpd.golden_videos.pop(video_path.name, None)
        page.remove_listener("console", on_console)
        page.remove_listener("pageerror", on_pageerror)

    return result


def main() -> int:
    # このスクリプトは <repo>/tools/golden-replay/run-golden-replay.py に配置される前提。
    # --repo / --out-dir 未指定時はリポジトリ相対のパスへ既定値を解決する
    # （どの作業ディレクトリから呼んでも動くよう __file__ 基準にする）。
    script_dir = Path(__file__).resolve().parent
    default_repo = script_dir.parent.parent
    default_out_dir = script_dir / "out"

    ap = argparse.ArgumentParser(description="Archery Note golden replay harness")
    ap.add_argument("videos", nargs="+", help="解析する動画ファイル（複数可。例: tools/golden-replay/videos/*.mp4）")
    ap.add_argument("--repo", default=str(default_repo),
                    help=f"archery-note リポジトリのパス（読み取りのみ。既定: {default_repo}）")
    ap.add_argument("--out-dir", default=str(default_out_dir),
                    help=f"baseline-*.json の出力先（既定: {default_out_dir}。"
                         "確定した基準値は手動で baselines/ にコピーする）")
    ap.add_argument("--handedness", choices=["right", "left"], default="right")
    ap.add_argument("--playback-rate", type=float, default=0.25,
                    help="再生速度（既定0.25。遅いほど動画時間あたりの推論サンプルが増える）")
    ap.add_argument("--delegate", choices=["CPU", "GPU"], default="CPU",
                    help="MediaPipe デリゲート（既定CPU。headless では GPU=SwiftShader が極端に遅い）")
    ap.add_argument("--headed", action="store_true", help="ブラウザを表示して実行")
    ap.add_argument("--port", type=int, default=0, help="ローカルサーブのポート（0=自動）")
    args = ap.parse_args()

    repo = Path(args.repo).resolve()
    if not (repo / "index.html").exists():
        print(f"ERROR: {repo} に index.html がありません", file=sys.stderr)
        return 2
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    videos = [Path(v).resolve() for v in args.videos]
    missing = [v for v in videos if not v.exists()]
    if missing:
        for v in missing:
            print(f"ERROR: 動画が見つかりません: {v}", file=sys.stderr)
        return 2

    port = args.port or free_port()
    httpd = serve_repo(repo, port)
    app_url = f"http://127.0.0.1:{port}/index.html"
    print(f"serving {repo} at {app_url}")

    exit_code = 0
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=not args.headed,
                args=[
                    "--autoplay-policy=no-user-gesture-required",
                    # headless で WebGL (SwiftShader) を許可: MediaPipe GPU delegate 用
                    "--enable-unsafe-swiftshader",
                ],
            )
            for video in videos:
                name = video.stem
                print(f"\n=== {name} ===")
                # 動画ごとに独立コンテキスト（localStorage 汚染を避け、毎回まっさらな db）
                context = browser.new_context(viewport={"width": 480, "height": 900})
                page = context.new_page()
                page.goto(app_url, wait_until="load")
                # アプリ本体の起動（render 完了 = タブが存在）を待つ
                page.wait_for_selector("nav.tabs", timeout=15_000)

                t0 = time.monotonic()
                result = analyze_video(page, httpd, video, args.handedness,
                                       playback_rate=args.playback_rate,
                                       delegate=args.delegate)
                result["wallSeconds"] = round(time.monotonic() - t0, 1)

                out_file = out_dir / f"baseline-{name}.json"
                out_file.write_text(
                    json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                shots = result.get("detectedShots", "?")
                print(f"status={result['status']} shots={shots} "
                      f"wall={result['wallSeconds']}s errors="
                      f"{len(result['consoleErrors'])}c/{len(result['pageErrors'])}p")
                print(f"-> {out_file}")
                if result["status"] not in ("ok", "ok-no-shots"):
                    exit_code = 1
                context.close()
            browser.close()
    finally:
        httpd.shutdown()

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
