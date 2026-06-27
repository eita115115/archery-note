# Contributing

Archery Noteへの貢献ありがとうございます。このアプリは、練習場で使うアーチェリー記録PWAです。変更は小さく、既存データを壊さない形でお願いします。

## Development Setup

```bash
npm install
npm run check:app
npm run check:ui
```

## Pull Request Rules

- 変更範囲は小さくしてください。
- UI変更がある場合はスクリーンショットを添付してください。
- 保存データ、バックアップ、復元、CSV出力に関わる変更は慎重に扱ってください。
- 既存のローカルデータ互換性を壊さないでください。
- PR前に `npm run check:app` と `npm run check:ui` を実行してください。

## Data Safety

Archery Noteは端末内保存を重視しています。storage schemaを変更する場合は、migrationとrollback方針をPRで説明してください。既存キーや旧バックアップ形式を削除する変更は、段階的な移行計画なしに入れないでください。

## Accessibility

モバイル利用、キーボード操作、ブラウザズームを妨げない設計を優先してください。スコア入力の主導線は、屋外で片手でも扱いやすい簡潔さを保ってください。
