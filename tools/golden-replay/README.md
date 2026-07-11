# ゴールデン再生ハーネス

保存済み動画からの射形解析（`scripts/47-form-view.js` の `startFormReplay` /
`scripts/46-form-core.js` の `stepFormPhase`）に、フリーライセンスの実写映像を
headless Chromium で流し込み、検出結果（射数・角度・保持時間など）が
基準値（baseline）から回帰していないかを確認するツールです。

`npm run check:all` には含まれません（映像ファイルと Python 環境が前提の
オンデマンドツールのため）。射形検出ロジックを変更したときに手動で実行してください。

## 前提

- Python 3.11 以降
- `pip install playwright`
- `python -m playwright install chromium`

映像ファイル自体はリポジトリにコミットしません（`tools/golden-replay/videos/` は
`.gitignore` 対象）。`fetch-videos.py` で毎回取得してください。

## 実行手順

```bash
# 1. 映像を取得（初回のみ。tools/golden-replay/videos/ に保存される）
python tools/golden-replay/fetch-videos.py

# 2. ハーネスを実行（リポジトリ直下から。--repo / --out-dir は省略可）
npm run golden:replay -- tools/golden-replay/videos/*.mp4
# または直接:
python tools/golden-replay/run-golden-replay.py tools/golden-replay/videos/*.mp4

# 1本だけ試す場合
python tools/golden-replay/run-golden-replay.py \
    tools/golden-replay/videos/pixabay-43254-archery-woman.mp4
```

結果は既定で `tools/golden-replay/out/baseline-<動画名>.json` に書き出されます
（この `out/` は `.gitignore` 対象で、確定した基準値だけを手動で `baselines/` に
コピーする運用です）。

主なオプション（`python tools/golden-replay/run-golden-replay.py --help` も参照）:

- `--handedness right|left`（既定 right）
- `--playback-rate`（既定 0.25。動画を遅回しして headless の遅い推論でも
  動画時間あたりのサンプル数を確保する。上げすぎると検出漏れが起きうる）
- `--delegate CPU|GPU`（既定 CPU。headless の GPU は SwiftShader 経由でごく遅い）
- `--headed`（ブラウザを表示して実行。デバッグ用）

## 動画の仕組み

`startFormReplay` は file input から受け取った動画の objectURL を直接呼ぶだけの
関数なので、ハーネスはリポジトリを `http.server` でローカルサーブしつつ、動画も
同じサーバの `/__golden__/<name>` から配信します（`<video>` の CSP
`media-src 'self'` を満たすため。Playwright の `page.route` は `<video>` の
メディア要求を横取りできないため、サーバ側配信が必須）。リポジトリへの書き込みは
一切行いません。

## 基準値（baseline-*.json）の意味

各 JSON は1本の動画に対する実行結果一式です。回帰確認でまず見るべきは

- `status`: `ok`（射を検出して保存まで到達） / `ok-no-shots`（0射で正常完了） /
  `crashed` / `timeout` / `analysis-failed` / `load-failed`
- `detectedShots`: 検出射数。`sources.md` の「検出期待値」と一致するかどうかが
  第一の回帰判定基準

角度・保持時間などの `formAnalysis` は撮影角度に依存するため真値ではなく、
「同一映像・同一設定での再現性の基準値」として二次的に見ます（許容幅は
sources.md 各項目の記述を参照）。

`trace` 配列（フレームごとの速度・アンカー距離・位相）はリポジトリ容量のため
間引いて保存しています（`released`/`canceled` が立ったフレームは全件保持、
それ以外は5フレームに1つ）。0射だったときに「なぜ発火しなかったか」を
閾値と突き合わせて説明する材料として使えます。

`43254`（正例）の1射は「released 7回発火 → CONFIRM_MS の自己修復で4回取消 →
最終1射」という境界的な検出です。閾値を変更する PR ではこの映像の結果が
最も敏感に変わるため、変更時は基準値の更新をレビューで明示してください。

## 基準値の更新手順

1. `python tools/golden-replay/fetch-videos.py` で映像を用意する。
2. `python tools/golden-replay/run-golden-replay.py tools/golden-replay/videos/*.mp4`
   を実行し、`tools/golden-replay/out/baseline-*.json` を確認する。
3. 意図した挙動変化であることを確認した上で、`out/` の該当ファイルを
   `tools/golden-replay/baselines/` に上書きコピーする。
4. 何が・なぜ変わったか（しきい値変更、検出ロジック変更など）を
   コミットメッセージ / PR 説明に明記する。

## 出典・ライセンス

`sources.md` を参照。すべて Pixabay Content License / Mixkit License の
フリーライセンス映像で、YouTube など利用規約で保護された映像は使用していません。

## 既知の制約

- 実写の「複数射」映像が見つかっておらず、検出射数が2以上になるケースは
  未検証です。横向き・全身・複数射の練習動画を1本 `videos/` に追加すれば
  最も価値の高いゴールデンケースになります。
- 等倍速・GPU delegate では headless の推論が遅すぎて意味のある基準値に
  ならないため、既定は 0.25倍速・CPU delegate に固定しています。実機
  （iPhone）との数値差は撮影モードの違いも含め、このハーネスの対象外です。
