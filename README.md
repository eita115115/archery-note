# Archery Note 🏹

得点・着弾・用具をまとめて残せる、アーチェリー練習ノート。
記録した位置から、サイトを動かすか・保留するか・射形を見直すかの判断材料を見られます。

## 使い方

1. 距離・的サイズ・1エンドの本数を選ぶ
2. 的をタップして着弾位置を記録する
3. 結果で「動かす / 保留 / 射形優先」を確認する

サイト値、風、用具は分かる時だけ追加できます。最初は点取りだけで使えます。

スマホでは公開URLを開き、ブラウザのメニューから **「ホーム画面に追加」** するとアプリのように使えます。ローカルでは `index.html` をブラウザで開くだけでも動きます。

ローカルでの動作確認用サーバー:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
# → http://localhost:8741/
```

## 機能

- **記録**: 的をタップして着弾位置を入力。距離は70/50/30/18m＋自由設定、ターゲット的・三つ目的・フィールド的に対応。必要な矢だけ矢番号と外れ理由タグを残せます。
- **結果**: グルーピング中心、ばらつき、外れ値を見て、サイトを動かすか・保留するか・射形を優先するかを表示。
- **履歴**: 練習一覧、着弾プロット、距離別平均、過去中心の分布/偏移を確認。
- **サイト調整**: セッティング×距離ごとにサイト値を残し、最新の記録と見比べられます。
- **用具**: ハンドル、リム、矢、サイト、弦などをプルダウン中心で記録。候補にない用具だけ手入力できます。
- **データ保護**: 端末内保存、JSONバックアップ/復元、自動バックアップ、ゴミ箱復元、CSV出力に対応。

<details>
<summary>詳しい分析・用具・開発メモ</summary>

- 線かみ判定は、表示された矢円が線に少しでも触れていれば内側の点数になります。微調整モード中は線かみ時にカーソルが緑、線なし時に赤で表示されます。
- 結果画面では、明らかな外れ値を除いたグルーピング中心、RMS半径、上下/左右のばらつき、縦長・横長・斜め方向の傾向を見ます。
- 調整提案は、距離、的サイズ、サイト値、風、用具入力、矢重量、初速、過去データを参考にします。信頼度が低い時は、無理に動かさない判断も表示します。
- サイト値を複数距離で残すと、距離別サイト予測やクリック換算の材料になります。
- 用具入力では、シャフト銘柄・番手・矢尺・ポイント重量を分けて管理します。カタログ掲載シャフトは直径・GPI・総矢重量の推定に使えます。
- フィールド的は World Archery 式の80/60/40/20cmに対応します。黄は6・5点、黒は4・3・2・1点、外れはMとして採点します。
- 連続入力中の誤ズームを抑制し、PointerEvent非対応環境ではタッチ/マウス入力へフォールバックします。
- PWAを基本にしつつ、Capacitor向けWeb資産とAndroidプロジェクトも用意しています。ネイティブ化の方針は `docs/native-transition.md` を参照してください。
- 画面スタイルは `style.css`、アプリロジックは `scripts/` 配下の機能別ファイルに分離しています。

</details>

## 更新時の注意

公開番号は次のコマンドで一括更新します。`APP_VER`、`version.json`、`sw.js` のキャッシュ名、`package.json` / `package-lock.json` のバージョンを同じ番号に揃えます。

```powershell
npm run version:bump
# または番号を指定
node tools\bump-version.js 44
```

更新前の検証:

```powershell
& 'C:\Users\eita2\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\check-app.js
& 'C:\Users\eita2\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\check-ui.js
npm run build:native-web
git diff --check
```

`tools\check-ui.js` はローカルの Chrome/Edge を使って、スマホ幅・小型スマホ幅・PC幅のスクリーンショットを `artifacts\ui-smoke\` に生成します。生成物は `.gitignore` で除外されます。

カタログPDFから用具候補を下ごしらえする開発用ツール:

```powershell
.\.venv\Scripts\python.exe tools\extract-catalog.py artifacts\catalog\SBA2026_27.pdf
```

抽出結果とPDF本体は `artifacts\catalog\` に置き、Gitには含めません。アプリへ入れる候補は、人の目でノイズを落としてから `scripts/70-gear-settings.js` に反映します。

ネイティブ化の方針は `docs/native-transition.md` を参照してください。最初はPWAを維持しながら、CapacitorでiOS/Android配信用の土台を作り、保存層と物理コアを段階的に分離します。

Android開発環境:

```powershell
npm run native:sync:android
npm run native:open:android
npm run native:build:android
```

初回だけAndroid Studioのセットアップウィザードで Android SDK、Android SDK Platform 36、Android SDK Build-Tools、Android SDK Platform-Tools を入れてください。

このCodex環境から `.git` へ書き込めない場合は、最後のコミットだけPowerShellで実行してください。

## ファイル

- `index.html` — アプリのHTMLシェル
- `style.css` — 画面スタイル
- `scripts/` — アプリロジック（保存、採点、分析、画面描画、用具、設定、起動処理）
- `manifest.json` / `sw.js` / `icon.svg` — PWA用（ホーム画面追加・オフライン動作）
- `serve.ps1` — ローカル確認用の簡易サーバー
- `package.json` / `capacitor.config.json` — 将来のiOS/Androidアプリ化に向けたCapacitor準備
- `android/` — Capacitorで生成したAndroidネイティブプロジェクト
- `tools/check-app.js` — 構文・公開番号・代表演算の検証スクリプト
- `tools/check-ui.js` — Chrome/Edgeを使ったスマホ幅・PC幅のUIスモーク検査
- `tools/bump-version.js` — 公開番号を関連ファイルへ一括反映
- `tools/build-native-web.js` — Capacitorへ渡すWeb資産を `dist/native` に生成
- `tools/extract-catalog.py` — カタログPDFから用具名候補を抽出する開発補助ツール

## 関連アプリ

同じフォルダに **射形リアルタイム分析アプリ** `../archery-form/index.html` があります。
カメラで射形（フォーム）をリアルタイムに分析して日本語アドバイスを出します。
記録アプリと併用すると効果的です。
