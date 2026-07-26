# ゴールデン再生ハーネス

保存済み動画からの射形解析（`scripts/47-form-view.js` の `startFormReplay` /
`scripts/46-form-core.js` の `stepFormPhase`）に、フリーライセンスの実写映像を
headless Chromium で流し込み、検出結果（射数・角度・保持時間など）が
レビュー済み期待値（`expectations.json`）から回帰していないかを確認するツールです。
`baselines/` は過去の観測結果であり、合否の真値ではありません。

`npm run check:all` には含まれません（映像ファイルと Python 環境が前提の
オンデマンドツールのため）。射形検出ロジックを変更したときに手動で実行してください。

## 前提

- Python 3.11 以降
- `pip install playwright`
- `python -m playwright install chromium`

映像ファイル自体はリポジトリにコミットしません（`tools/golden-replay/videos/` は
`.gitignore` 対象）。`fetch-videos.py` で毎回取得してください。

動画や Playwright を使わない高速テスト:

```powershell
python -B tools/golden-replay/test_golden_expectations.py
```

## 実行手順

```powershell
# 1. 映像を取得（初回のみ。tools/golden-replay/videos/ に保存される）
python tools/golden-replay/fetch-videos.py

# 2. ハーネスを実行（リポジトリ直下から。--repo / --out-dir は省略可）
npm run golden:replay -- tools/golden-replay/videos/*.mp4
# または直接:
python tools/golden-replay/run-golden-replay.py tools/golden-replay/videos/*.mp4

# 1本だけ試す場合
python tools/golden-replay/run-golden-replay.py tools/golden-replay/videos/pixabay-43254-archery-woman.mp4

# 期待値照合をせず、調査用の観測結果だけを記録
python tools/golden-replay/run-golden-replay.py --record-only tools/golden-replay/videos/pixabay-43254-archery-woman.mp4
```

PowerShell が `*.mp4` を展開しない場合も、runner が glob を安定した名前順で
展開します。1件も一致しないパターンは、明確な「動画が見つかりません」エラーに
するため文字列のまま検査します。

結果は既定で `tools/golden-replay/out/baseline-<動画名>.json` に書き出されます
（この `out/` は `.gitignore` 対象で、確定した基準値だけを手動で `baselines/` に
コピーする運用です）。通常実行は期待値不一致または解析失敗で終了コード `1`、
manifest・実行 profile・動画 SHA-256 の不一致で `2` を返します。

主なオプション（`python tools/golden-replay/run-golden-replay.py --help` も参照）:

- `--handedness right|left`（既定 right）
- `--playback-rate`（既定 0.25。動画を遅回しして headless の遅い推論でも
  動画時間あたりのサンプル数を確保する。有限の正数のみ。上げすぎると検出漏れが起きうる）
- `--delegate CPU|GPU`（既定 CPU。headless の GPU は SwiftShader 経由でごく遅い）
- `--record-only`（期待値照合を省略し、`verification=SKIPPED` と明示して観測のみ記録）
- `--headed`（ブラウザを表示して実行。デバッグ用）

## 動画の仕組み

`startFormReplay` は file input から受け取った動画の objectURL を直接呼ぶだけの
関数なので、ハーネスはリポジトリを `http.server` でローカルサーブしつつ、動画も
同じサーバの `/__golden__/<name>` から配信します（`<video>` の CSP
`media-src 'self'` を満たすため。Playwright の `page.route` は `<video>` の
メディア要求を横取りできないため、サーバ側配信が必須）。リポジトリへの書き込みは
一切行いません。

## レビュー済み期待値と baseline の意味

`expectations.json` が合否判定のレビュー済み真値です。動画 basename と
SHA-256、固定 profile、期待 status・射数・保持された release の許容時間窓を
機械照合します。一次判定は次の3点です。

- `status`: `ok`（射を検出して保存まで到達） / `ok-no-shots`（0射で正常完了） /
  `crashed` / `timeout` / `analysis-failed` / `load-failed`
- `detectedShots`: `sources.md` で目視レビューした検出期待射数
- `formPhaseDiag`: `releaseFires` から `canceledEvents` と同じ `shotId` を除いた
  保持 release 数が `detectedShots` と一致し、各 timestamp が許容時間窓内か

正例 `43254` の許容時間窓 `[4300, 4600]` ms は、映像の目視リリース時刻と
検出イベントの揺らぎをレビューして定めた許容範囲です。単なる射数一致でも、
保持イベントがこの窓を外れれば失敗します。

`baselines/baseline-*.json` と実行ごとの `out/baseline-*.json` は診断用の
観測スナップショットです。角度・保持時間などは撮影角度や推論サンプルに依存する
ため真値ではなく、二次的な比較材料として扱います。

`trace` 配列（フレームごとの速度・アンカー距離・位相）はリポジトリ容量のため
間引いて保存しています（`released`/`canceled` が立ったフレームは全件保持、
それ以外は5フレームに1つ）。0射だったときに「なぜ発火しなかったか」を
閾値と突き合わせて説明する材料として使えます。

## 基準値の更新手順

1. `python tools/golden-replay/fetch-videos.py` で映像を用意する。
2. 調査中は `--record-only` で実行し、`tools/golden-replay/out/baseline-*.json`
   を確認する。
3. 意図した挙動変化であることを確認した上で、`out/` の該当ファイルを
   `tools/golden-replay/baselines/` に上書きコピーする。
4. 人が映像を再レビューした場合だけ `sources.md` と `expectations.json` を更新する。
   baseline の観測値を自動で真値にしない。
5. 通常モードで全件を再実行し、期待値照合が通ることを確認する。何が・なぜ
   変わったかをコミットメッセージ / PR 説明に明記する。

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
