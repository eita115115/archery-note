# Archery Note

Archery Noteは、アーチェリー競技者向けのオフライン対応OSS練習記録PWAです。得点、着弾位置、サイト値、用具、履歴を一元管理できます。

## Demo

- Web: https://eita115115.github.io/archery-note/

## Screenshots

The screenshots below are captured from the public demo with sample local data in a temporary browser profile.

### Practice records

練習条件を選び、得点・着弾・メモを記録し始める画面です。

![Practice records](docs/screenshots/practice-records.png)

### History

過去の練習、平均点、距離・用具別の傾向を確認する画面です。

![History](docs/screenshots/history.png)

### Sight adjustment

距離別サイト値と、動かすか保留するかの判断材料を確認する画面です。

![Sight adjustment](docs/screenshots/sight-adjustment.png)

### Equipment

弓、矢、サイト、チューニング情報をまとめて管理する画面です。

![Equipment](docs/screenshots/equipment.png)

## Why This Project Exists

アーチェリーの練習記録は、紙、メモアプリ、表計算で管理されがちです。しかし、得点、着弾位置、サイト調整、用具情報、練習履歴を一つの流れで扱うには、競技特化のworkflowが必要です。

Archery Noteは、競技者が練習場でも使いやすいように、オフライン対応と端末内保存を重視した公開OSSとして開発しています。最初は点取りだけで使え、必要に応じてサイト値、風、用具情報を追加できます。

## Features

- 得点記録
- 着弾位置記録
- サイト調整記録
- 用具管理
- 練習履歴
- JSONバックアップ/復元
- CSV出力
- PWA / offline support
- Capacitor native-ready shell

## Data And Privacy

- 練習データは原則として端末内に保存されます。
- GitHub Pagesはアプリ本体を配信するだけで、練習データを保存しません。
- JSONバックアップ/復元とCSV出力に対応しています。
- ブラウザや端末のストレージを消すと、未バックアップの記録が失われる可能性があります。

## Quick Start

```bash
npm install
npm run check:app
npm run check:ui
```

ローカル確認用サーバー:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

## Project Structure

- `index.html` - アプリのHTMLシェル
- `style.css` - 画面スタイル
- `scripts/` - 保存、採点、分析、画面描画、用具、設定、起動処理
- `manifest.json` / `sw.js` / `icon.svg` - PWA用ファイル
- `tools/check-app.js` - 構文、公開番号、代表演算の検証
- `tools/check-ui.js` - Chrome/Edgeを使ったスマホ幅・PC幅のUIスモーク検査
- `tools/bump-version.js` - 公開番号を関連ファイルへ一括反映
- `tools/build-native-web.js` - Capacitorへ渡すWeb資産を `dist/native` に生成
- `docs/native-transition.md` - PWAからnative-ready shellへ進める方針

## Development Notes

公開番号は `APP_VER`、`version.json`、`sw.js` のキャッシュ名、`package.json` / `package-lock.json` のバージョンを揃えます。

```powershell
npm run version:bump
```

UIや保存に関わる変更をした場合は、少なくとも以下を確認してください。

```bash
npm run check:app
npm run check:ui
```

## Contributing

貢献方法は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## Security

脆弱性報告は [SECURITY.md](SECURITY.md) を参照してください。公開Issueには脆弱性の詳細を書かないでください。

## License

Apache License 2.0. See [LICENSE](LICENSE).
