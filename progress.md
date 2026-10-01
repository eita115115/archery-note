# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- 公開アプリv95、公開source0618b37bf5d1af0222c7d23b2fa7eb4a236a6989、runtime7039fcea。AN-042は人間承認後の公開・CI/Pages・配信・操作確認まで完了。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/analysis-filter-focus。
- 元checkout/共有node_modules保全、費用・個人情報の使用なし。

## 今回完了

- v95の分析用具/距離を名前で操作でき、選択/解除/期間変更後もfocusを保って固定ナビに隠れない位置へ最小調整。検証済みruntimeを公開。
- CI36863682859/Pages36863680921が公開sourceで成功。Linux/Node22 clean npm ci/check:all/lint/format、116 passed (1.1m)。公開前のowned sandbox check:all/lint、formatも成功。
- 公開95全21asset byte一致。fresh375px Chromiumで用具/距離/期間7dのfocus/両可視境界、履歴group/分布/開始/44px/settings実touch swipe、実SW offline再表示で架空履歴5件とactive保持、pageerror0。分析画像を確認。詳細・出力はdocs/codex/release-v95.md。
- source/test/dependency99filesとowned sandbox一致、共有hidden lock不変。実SW94→95の両engine320/375更新・保存証拠は候補runtimeと同一。
- AN-043性能調査完了: 固定v94/v95、14contexts/420samples、候補5000件全距離median Chromium172.8ms/WebKit295ms。入力hash/期待件数/可視性/保存不変、独立review指摘なし。高速化の証拠ではない。詳細はdocs/codex/analysis-filter-performance.md。
- 変更: release-v95/performance-doc、progress/tasks/台帳、公開履歴。アプリコード・版・依存は検証済み候補から変更なし。

## 次と未解決

- AN-044: scoreTrendCardの空記録を飛ばした先頭8件だけを集計する。別branchでHTML互換/数値変換/入力不変/読取上限、代表性能と関連app/UI/lintを確認。効果は未測定。
- AN-038 Lighthouse major/28新packageには専用承認なし。ZIP13/27未解決、fullaudit high4packages/exit1を0と扱わない。
- root node_modulesは元checkoutへのjunction、install/update/ci禁止。owned sandboxは検証済み95候補sourceと公開済み3依存更新。
- 実機iPhone操作感/VoiceOver、AN-001実射判定は未検証。大量履歴はmemoryのみ、5000件実保存/INP/実機性能は未検証。
- arrowCheck昇格/追加センシング条件未達。目標はactive、界隈で最も愛されるアプリを達成済みとは扱わない。
