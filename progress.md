# 現在の状態

> 現在地の正本。長い経緯は `docs/codex/codex-progress.md`。

最終更新: 2026-09-28

## 現在地

- 性能・見た目改善の委任を受け、`main` の `66eb29bf`（v85）から開始。
- 管理worktree: `C:/Users/eita2/.codex/worktrees/app-quality/archery-note`
- ブランチ: `codex/app-quality`。元の作業フォルダの変更は保全。
- 金銭・個人情報は明示承認なしに使用しない。確認用データは架空のみ。

## 完了したこと

- 実装と古い進捗表を照合し、改善順序を整理。
- 変更: `docs/codex/app-quality-baseline.md`、本書、`tasks.json`、履歴台帳。
- 元のv84では `check:all` 成功、375pxの初期画面を保存。
- `tools/check-form-core.js` の読み込み時に改行を正規化し、新規Windows環境の誤検知を修正。

## 検証

- v85: `check:all` / `lint` 成功。LF・CRLFの正常ソースは成功、壊した停止判定は両方拒否。
- 修正前の失敗: `Error: replay pose continuation cannot restart after freeze or close`
- 証拠: `artifacts/improvement-baseline/check-all-after.txt`、`newline-matrix.txt`、`lint.txt`
- アプリの挙動・保存形式・バージョンは変更していない。

## 次にやること

- LF/CRLFで失敗を再現し、検証コードの改行依存を修正する。
- その後、起動・タブ切替を測定し、375pxの実画面を改善する。

## 未解決

- 実射での射形判定・保存・自動スクロールの受入確認。
- ロードマップ全面更新（AN-002）、診断テストの版固定値（AN-004）。
- 元checkoutには9月4日付のGitロックが残る。削除していない。
