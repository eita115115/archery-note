# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- 公開アプリv94。AN-036既存3依存更新は承認後main反映・CI/Pages/配信物/警告確認まで完了。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/analysis-filter-focus。
- 分析フィルタ実装268b7967/検証記録15e2292へ公開記録e1ec1fe6を合流。AN-041公開候補検証中。
- 元checkout/shared node_modules保全、費用・個人情報の使用なし。

## 検証済み

- AN-040: 分析の用具/距離ラベルを関連付け、選択前にfocusがあった場合だけrender後に復帰。外部変更でfocusを奪わない。
- 修正前4failed、両engine関連20 passed (15.0s)、記録/設定/タッチ32 passed (42.9s)。app/UI/lint/storage成功、375px前後画像、独立静的review指摘なし。
- AN-036: main de1e3a95、CI36856786262/Pages36856785707成功、Linux110 passed (1.2m)。公開v94全21assets不変、設定touch/履歴/分析/offline架空記録保持成功。GitHub14件fixed、ZIP13/27だけopen。
- 詳細: docs/codex/analysis-filter-focus.md、dependency-publication.md。両branchの履歴と既存task acceptanceを保持して整合。

## 次と未解決

- 今回AN-041: 次版候補を版整合/全体check/E2E/実SW更新/架空記録保持/配信物/reviewまで検証。公開承認は完成後に求める。
- AN-038 major/28新package追加には専用承認なし。既存3件pushの承認はその追加やUI公開を含めない。
- root node_modulesは元checkoutへのjunction、install/update/ci禁止。owned sandboxの更新installedは再利用、sourceを候補へ同期して検証する。
- fullaudit high4packages/exit1はZIP2advisoryと親chain。仮major audit0は実適用ではない。
- 実機iPhone操作感/VoiceOverとAN-001実射判定は未検証。arrowCheck昇格/追加センシング条件未達。
- 目標はactive、広い愛用目標を達成済みとは扱わない。
