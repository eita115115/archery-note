#!/usr/bin/env python3
"""ゴールデン再生ハーネス用のテスト映像を再取得する。

映像ファイルはリポジトリにコミットしない方針のため、このスクリプトで
原典 URL から都度ダウンロードする。PixabayはContent License、Mixkitの
720p版はRestricted / Personal Use onlyでローカル個人診断専用。出典・
ライセンスの詳細は sources.md を参照。

使用例（リポジトリ直下から。--out 省略時は tools/golden-replay/videos/ に保存）:
  python tools/golden-replay/fetch-videos.py
  python tools/golden-replay/fetch-videos.py --force
  # Restricted / Personal Use only のMixkit sourceをローカル個人診断用に含める場合だけ:
  python tools/golden-replay/fetch-videos.py --include-restricted-personal
"""

import argparse
import sys
import urllib.request
from pathlib import Path

DEFAULT_OUT = Path(__file__).resolve().parent / "videos"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

# 配信名 -> (直接URL, ライセンス, 出典ページ)
PUBLIC_VIDEOS = {
    "pixabay-43254-archery-woman.mp4": (
        "https://cdn.pixabay.com/video/2020/06/27/43254-435970559_large.mp4",
        "Pixabay Content License",
        "https://pixabay.com/videos/archery-woman-target-garden-nature-43254/",
    ),
    "pixabay-40769-archer.mp4": (
        "https://cdn.pixabay.com/video/2020/06/01/40769-426939441_large.mp4",
        "Pixabay Content License",
        "https://pixabay.com/videos/archer-archery-bow-arrow-bowman-40769/",
    ),
    "pixabay-150869-arrows-target.mp4": (
        "https://cdn.pixabay.com/video/2023/02/15/150869-799327585_large.mp4",
        "Pixabay Content License",
        "https://pixabay.com/videos/arrows-target-bow-and-arrow-sport-150869/",
    ),
}

RESTRICTED_PERSONAL_VIDEOS = {
    "mixkit-34710-female-archer.mp4": (
        "https://assets.mixkit.co/videos/34710/34710-720.mp4",
        "Mixkit Restricted License (720p, Personal Use only; verified 2026-07-26)",
        "https://mixkit.co/free-stock-video/female-archer-shooting-an-arrow-34710/",
    ),
    "mixkit-48725-closeup-firing.mp4": (
        "https://assets.mixkit.co/videos/48725/48725-720.mp4",
        "Mixkit Restricted License (720p, Personal Use only; verified 2026-07-26)",
        "https://mixkit.co/free-stock-video/close-up-of-a-person-firing-an-arrow-at-a-48725/",
    ),
}


def select_videos(include_restricted_personal=False):
    """既定は公開互換sourceだけを返し、Restricted sourceは明示opt-inする。"""

    selected = dict(PUBLIC_VIDEOS)
    if include_restricted_personal:
        selected.update(RESTRICTED_PERSONAL_VIDEOS)
    return selected


def main() -> int:
    ap = argparse.ArgumentParser(description="golden replay 用テスト映像の再取得")
    ap.add_argument("--out", default=str(DEFAULT_OUT),
                    help=f"保存先ディレクトリ（既定: {DEFAULT_OUT}）")
    ap.add_argument("--force", action="store_true", help="既存ファイルも再取得")
    ap.add_argument(
        "--include-restricted-personal",
        action="store_true",
        help=(
            "Mixkit Restricted Licenseの720p sourceを含める"
            "（Personal Use only・ローカル個人診断専用）"
        ),
    )
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    videos = select_videos(args.include_restricted_personal)
    if args.include_restricted_personal:
        print(
            "WARNING: Mixkit Restricted sources included: "
            "Personal Use only; local personal diagnostics only.",
            file=sys.stderr,
        )
    else:
        print("Restricted Personal Use sources are excluded by default.")
    failed = []
    for name, (url, license_, page) in videos.items():
        dest = out / name
        if dest.exists() and not args.force:
            print(f"skip (exists): {name}")
            continue
        print(f"fetch: {name}\n  from {url}\n  license: {license_}")
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
                while True:
                    chunk = r.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
            print(f"  -> {dest} ({dest.stat().st_size:,} bytes)")
        except Exception as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            failed.append(name)
            dest.unlink(missing_ok=True)
    if failed:
        print(f"\n{len(failed)} 件失敗: {failed}", file=sys.stderr)
        return 1
    print("\nすべて取得済み")
    return 0


if __name__ == "__main__":
    sys.exit(main())
