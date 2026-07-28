# ゴールデン再生ハーネス

保存済み動画からの射形解析（`scripts/47-form-view.js` の `startFormReplay` /
`scripts/46-form-core.js` の `stepFormPhase`）に、`sources.md`で利用条件を記録した映像を
headless Chromium で流し込み、検出結果（射数・角度・保持時間など）が
レビュー済み期待値（`expectations.json`）から回帰していないかを確認するツールです。
`baselines/` は過去の観測結果であり、合否の真値ではありません。

実映像runnerとsemantic acceptanceは`npm run check:all`に含まれません
（映像ファイルとPython環境、またはレビュー済み既知bugが前提のため）。
動画不要のNode fixture infrastructure testだけは`check:form`経由で含まれます。

## 前提

- Python 3.11 以降
- `pip install playwright`
- `python -m playwright install chromium`

映像ファイル自体はリポジトリにコミットしません（`tools/golden-replay/videos/` は
`.gitignore` 対象）。`fetch-videos.py`の既定実行はPixabayの公開互換sourceだけを
取得します。

動画や Playwright を使わない高速テスト:

```powershell
python -B tools/golden-replay/test_golden_expectations.py
npm run test:form-fixtures
```

現在はPython 28件、Node 13件の高速testです。Node fixture testは`npm run check:form`
にも含まれます。実映像とsemantic acceptanceは含まれません。

## 実行手順

```powershell
# 1. Pixabay映像を取得（初回のみ。tools/golden-replay/videos/ に保存される）
python tools/golden-replay/fetch-videos.py

# Restricted / Personal Use onlyのMixkit sourceをローカル個人診断用に含める場合だけ
python tools/golden-replay/fetch-videos.py --include-restricted-personal

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
- `--capture-derived-fixtures`（`--record-only` との併用時だけ、許可済みの公開stock映像
  2件からprivacy-boundedな派生metric候補を作る。private footageには絶対に使用しない）
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

## Privacy-bounded 派生 metric fixture

`metric-fixtures/` は、公開stock映像から一度だけ取り出した検出器入力をNodeで
決定論的に再生するためのfixtureです。映像そのものやMediaPipeの完全な33点
ランドマーク集合は追跡せず、次の固定列だけを保持します。

```text
[tMs, anchorNorm, drawArm, bodyScale, conf, dWx, dWy, dWVisibility]
```

姿勢を検出できなかったフレームは、`tMs` 以外をすべて明示的な`null`にします。
数値は丸めず、保存済み動画リプレイが`stepFormPhase`を呼ぶ境界で受け取った
動画時刻をそのまま使います。`dWx` / `dWy` / `dWVisibility`は、draw wrist 1点の
normalized x/y/visibility時系列です。つまりlandmarkを一切保持しないのではなく、
この1点だけをderived scalar群と一緒に保持します。fixtureには次の情報を含めません。

- pixel、映像、画像、完全な33点landmark集合、draw wrist以外の32点、z座標
- `bW`、`bowArm`、score、角度結果、HUD、出力trace
- file path、URL、取得日、device、ユーザー識別子、ログ、shot ID

metadataはsemanticな`caseId`、source video SHA-256、LF正規化した
`scripts/46-form-core.js`のSHA-256、`appBaseCommit`、pose modelとself-hosted
`vision_bundle.mjs` / `vision_wasm_internal.js` / `vision_wasm_internal.wasm`のSHA-256、
Python Playwright / Chromium version、固定runtime profile、`eosMs`、固定columnsだけです。
core text hashはUTF-8として読み、`CRLF`と単独`CR`を`LF`へ置換してから計算します。
`appBaseCommit`はcapture時にcheckoutされていたapp/coreのbase commitを示すだけで、
未commitのcapture harness自体を同定せず、exact recaptureを保証しません。

fixture loaderは`JSON.parse`前のraw property-key検査と、parse後のexact-key allowlistで
fail closedします。duplicate key、未知key、path/URL、完全なlandmark payload形状、
不正hash/profile、非有限数、非単調timestamp、不完全なnull行、256 KiBを超えるsource、
上限超過frame数を拒否します。映像名はfixture名や`caseId`に使わず、
レビュー済み期待値との対応はsource video SHA-256で行います。

Node replayはfixtureごとに新しいdetector、velocity source、history、active release一覧を
作ります。各フレームはproductionと同じ順番（velocity計算 → current frame push →
historyを200件へ制限 → `stepFormPhase(..., 1.0, tMs)`）で処理し、cancelをreleaseより先に
適用して最新のactive fireを外します。`summarizeFormShot`は呼ばず、EOF用の合成frameや
finalizerも追加しません。したがって、確認猶予中に映像が終わったケースは
`pendingAtEnd=true`として明示されます。

高速のfixture infrastructure test:

```powershell
npm run test:form-fixtures
# production form coreとfixture infrastructureを一緒に確認
npm run check:form
```

レビュー済み真値に対するacceptance（現行の既知bugを固定している間はexit `1`がRED）:

```powershell
node tools/golden-replay/replay-form-fixtures.js
```

終了コードは、真値一致のみ`0`、レビュー済みsemantic mismatchまたは
production replay / parity runtime failureは`1`、fixture/expectations/schema/profile/
allowlist/dependency/config不正は`2`です。このacceptanceは意図的に
`check:form` / `check:all`へ含めません。

### 公開映像からの候補capture

候補生成は次の2本のPixabay Content License sourceだけに限定されます。private/user practice footage、
個人の診断動画、限定公開映像には、たとえローカル処理でも絶対に使用しないでください。
Mixkit 34710/48725の720p版はRestricted / Personal Use onlyのため対象外です。

```powershell
python -B tools/golden-replay/run-golden-replay.py `
  --record-only --capture-derived-fixtures `
  tools/golden-replay/videos/pixabay-43254-archery-woman.mp4 `
  tools/golden-replay/videos/pixabay-40769-archer.mp4
```

capture modeでも`expectations.json`の固定profileとsource video SHA-256を検査します。
完成した全sessionのmetricだけをNode loaderへ渡し、schema/privacy検証と
browser↔Nodeのrelease/cancel順序・timestamp・label・retained count・最終phase・
pending boolean、さらにNode retained countと実画面のvisible shot countが
完全一致した後に限り、
`out/metric-fixture-candidates/<semantic-case>-<content-sha256>.json`へ新規作成します。
同名候補は上書きしません。baseline JSONには派生frameを混ぜません。

候補はMediaPipeのcanonical outputではありません。同期MediaPipe推論中に
`requestAnimationFrame`が観測した、scheduler-sensitiveな1つのsample scheduleです。
asset hashとPlaywright/Chromium versionは記録しますが、capture harness source自体は
fixture metadataへbindされていません。したがってexact MediaPipe recaptureは主張しません。
目的の既知failure classを再現する候補だけを選び、その正確なevent時刻・label・
browser↔Node parityをレビューした後、semantic名のtracked fixtureへ機械的にコピーします。
過去候補やbaselineの観測値を自動で真値へ昇格させてはいけません。

### 現在追跡する failing sample schedules

| Semantic case               | Frames | Retained release        | Final state              | レビュー済み真値との差                                                      |
| --------------------------- | -----: | ----------------------- | ------------------------ | --------------------------------------------------------------------------- |
| `oblique-single-release`    |    725 | `6742.088ms / close`    | `DRAWING`, pending=false | 真の1射は4300–4600ms。窓内を保持せず、後半のlegacy false positiveだけを保持 |
| `scene-cut-arrow-retrieval` |    535 | `9157.544ms / adaptive` | `DRAWING`, pending=false | 期待0射。矢を取りに行く編集後sceneでadaptive false positiveを保持           |

これらはcapture時にbrowser↔Node parityが一致した正確な観測値です。一方、同じ実映像を
繰り返したreal-video runnerの射数・event時刻はschedulerにより独立に変動しました。
選択済み2runのstdoutはいずれもvisible shot count 1 / Node retained count 1でしたが、
3-way parity gateは今後の候補生成へ適用するもので、過去captureを再実行したとは主張しません。
特に`oblique-single-release`は、過去に観測した「約1895msと約4356msの2件保持」を
このtracked fixtureが再現する、とは主張しません。固定するのは、同じレビュー済み真値に対する
現在のsemantic failure（窓内真陽性の欠落と窓外false positive）です。

## 基準値の更新手順

1. `python tools/golden-replay/fetch-videos.py`でPixabay映像を用意する。Mixkitの
   ローカル個人診断が明示的に必要な場合だけ`--include-restricted-personal`を付ける。
2. 調査中は `--record-only` で実行し、`tools/golden-replay/out/baseline-*.json`
   を確認する。
3. 意図した挙動変化であることを確認した上で、`out/` の該当ファイルを
   `tools/golden-replay/baselines/` に上書きコピーする。
4. 人が映像を再レビューした場合だけ `sources.md` と `expectations.json` を更新する。
   baseline の観測値を自動で真値にしない。
5. 通常モードで全件を再実行し、期待値照合が通ることを確認する。何が・なぜ
   変わったかをコミットメッセージ / PR 説明に明記する。

## 出典・ライセンス

`sources.md`を参照。tracked metric fixtureの2件はPixabay Content Licenseです。
Mixkit 34710/48725の720p版は2026-07-26時点でRestricted / Personal Use onlyであり、
ローカル個人診断に限定します。historical grantなしにtracked/public fixtureへ使用しません。

## 既知の制約

- 実写の「複数射」映像が見つかっておらず、検出射数が2以上になるケースは
  未検証です。横向き・全身・複数射の練習動画を1本 `videos/` に追加すれば
  最も価値の高いゴールデンケースになります。
- 等倍速・GPU delegate では headless の推論が遅すぎて意味のある基準値に
  ならないため、既定は 0.25倍速・CPU delegate に固定しています。実機
  （iPhone）との数値差は撮影モードの違いも含め、このハーネスの対象外です。
