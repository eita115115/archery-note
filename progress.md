# 現在の状態

> 現在地の正本。長い経緯は `docs/codex/codex-progress.md`。

最終更新: 2026-09-28

## 現在地

- `main` の `66eb29bf`（v85）から性能・見た目を改善中。
- 作業場所: `C:/Users/eita2/.codex/worktrees/app-quality/archery-note`
- ブランチ: `codex/app-quality`。元の未コミット変更は保全。
- 費用・個人情報は明示承認なしに使用しない。テストは架空データのみ。

## 完了したこと

- Windows新規checkoutの改行依存テストを修正（37398f8）。
- 統計キャッシュを記録単位に変更し、800件超での再計算の繰り返しを解消。
- 変更: scripts/40-analysis-physics.js、tools/check-analysis-core.js、性能測定ツールと台帳。
- 1,000件/CPU4倍制限の再訪中央値: 履歴434→49ms、分析998→208ms。
- 詳細・再現手順: `docs/codex/session-cache-performance.md`。

## 検証

- `check:analysis` / `check:all` / `lint` 成功、E2E `83 passed (1.1m)`。
- 1,001件・編集・置換の回帰検証成功。独立レビューに要修正指摘なし。
- 全ログ: `artifacts/improvement-baseline/performance-*.txt`。
- 実機での速度は未測定。初回の統計計算時間は今回の改善対象外。

## 次にやること

- 375pxの記録・履歴・分析画面を確認し、見やすさと操作の反応を改善する。
- 起動時の射形コード読込と、初回統計計算の待ち時間は別途検討。

## 未解決

- 実射での射形判定・保存・自動スクロールの受入確認。
- ロードマップ全面更新（AN-002）、診断テストの版固定値（AN-004）。
- 公開未実施。リリース時は4箇所の版更新と受入条件の全検証が必要。
