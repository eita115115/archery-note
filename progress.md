# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- 公開アプリはv94。既存3件の依存更新AN-036に人間の公開承認が到着、反映を進める。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note。
- 分析修正はcodex/analysis-filter-focus、実装268b7967。依存公開用codex/app-quality=1d9c9ad1を保全。
- 元checkoutの未コミット変更・共有node_modulesを保全。費用・個人情報の使用なし。

## 今回完了

- AN-040: 分析の用具/距離ラベルを関連付け、選択前にfocusがあった場合だけrender後に復帰。外部変更ではfocusを奪わない。
- scripts/50-record-view.js、tests/e2e/analysis-filter-focus.spec.js、375px画像、analysis-filter-focus.md、CHANGELOG、progress/tasks/ledger。
- 修正前4failed。両engineの関連20 passed (15.0s)、記録/エンド/設定/タッチ32 passed (42.9s)。app/UI/lint/storage成功、独立静的レビュー指摘なし。
- 名前で到達・両フィルタ解除・実集計件数・Tab順/期間選択・保存不変・overflow/pageerror0を確認。実機iPhone/VoiceOver未検証。
- docs/codex/analysis-filter-focus.mdに出力・setup失敗と修正・画像・隔離範囲を記録。UI修正はローカルのみ、版更新と全体リリース検証は次。

## 次と未解決

- AN-036: 承認済みの既存3間接依存だけをmainへ反映する。codex/app-qualityでremote再照合・CI/Pages・配信物不変・fresh警告を確認。分析修正をこの承認に混ぜない。
- AN-041: 分析修正を次版候補にする。版整合、全体check/E2E、実更新/架空記録保持、配信物とレビューを揃えてから公開承認を求める。
- AN-038: Lighthouse major/28新package追加への専用承認なし。既存3件の承認を追加承認へ拡張しない。
- root node_modulesは元checkoutへのjunction。ここでinstall/update/ci禁止。隔離installedはartifacts/dependency-update/sandbox、現在source/testは分析修正入り。
- dependency候補4f81bb0cは3entriesだけ。14保存advisory範囲非該当、ZIP2件残りfullaudit high4packages/exit1。remote解消は公開後の確認が必要。
- 仮major解決はextract-zip不在/audit0だがinstall/実行未検証。実候補の解決済みとは扱わない。
- 公開v94のCI110テスト、公開両engine320/375の履歴ラウンド/架空7記録/記録中1本reload保持は成功。実SW93→94とserver停止offlineも成功。docs/codex/release-v94.md。
- 設定スワイプ・記録/エンド確定・ページ拡大抑制の実機操作感は未確認。AN-001実射判定も未完了、arrowCheck昇格/追加センシング条件未達。
- 目標はactive。「界隈で最も愛されるアプリ」を達成したとは判定しない。
