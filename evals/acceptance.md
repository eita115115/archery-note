# 受入条件 — 「完了」と言ってよい条件

**AI の「できました」は合格理由にならない。** 下表のコマンド出力を証拠として残す。
検証コマンドの一覧は `package.json` の `scripts` が正本。ドリフトしたらこの表を直す。

## 変更種別ごとの必須コマンド

| 変更種別 | 必須コマンド | 追加の証拠 |
|---|---|---|
| 採点・物理 | `npm run check:app` `npm run check:analysis` | 表示される矢円と採点結果が一致すること（ラインカッター含む） |
| 射形解析 | `npm run check:form` | golden replay の差分（`npm run golden:form-fixtures`） |
| ゲーミフィケーション | `npm run check:gamification` | — |
| 今日の結果 | `npm run check:todays-result` | — |
| UI・インタラクション | `npm run check:ui` `npm run lint` | 375px 幅のスクリーンショット（変更前後） |
| グローバル参照 | `npm run check:globals` | 未定義参照が0件 |
| ストレージ | `npm run check:storage` | 既存データが失われないこと（往復テストの出力） |
| セキュリティ | `npm run check:security` | — |
| PWA・Service Worker | `npm run check:pwa` | 更新バナーが出ること（実機またはプレビュー） |
| リリース・バージョン | `npm run check:version` | 4箇所のバージョンマーカーが一致（`npm run version:bump` 後） |
| 広い変更・リリース前 | `npm run check:all` `npm run test:e2e` | 全緑の出力 |
| 書式 | `npm run format:check` | — |

## 不変条件（どの変更でも壊してはならない）

`AGENTS.md` の「Low-Cost Model / Fallback Mode」と同じ3点。

1. 表示される矢円とラインカッター採点が一致する
2. 既存ユーザーの練習データを削除しない（データ損失警告はバックアップ・インポート・エクスポート・ストレージリセットの近くに置く）
3. iPhone の主要フローが単純なまま保たれる（高度な操作は設定・折りたたみ・副画面へ）

## 禁止

- 検証を飛ばして「完了」と書かない
- 失敗したコマンドの出力を省略しない
- タスク外の改善を混ぜない（`git status --short` で確認してから編集する）
- 記憶していた行番号・バージョン番号を確認せずに使わない

## 完了の記録

検証が通ったら `progress.md` を更新する（完了したこと／変更したファイル／検品結果／次にやること／未解決）。
`tasks.json` の該当タスクは `passes: true` と `evidence`（コマンド出力かコミットハッシュ）を同時に書く。
