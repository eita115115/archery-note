# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- 公開v95、main97945e17。公開runtime7039fcea、AN-042完了。公開記録CI36864216210/Pages36864214685も成功。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/score-trend-performance。元v95 branchを保持して別branchで局所改善。
- AN-044完了、実装bd36e8cb60db4367dc58aab59d94832841593bc9。ローカルのみ・版95のまま、AN-045公開候補準備が次。
- 元checkout/共有node_modules保全、費用・個人情報の使用なし。

## 今回完了

- 直近得点は既存集計関数を使い、空記録を飛ばした8件が揃った時点で停止。formatter/score coercion/orderは変更なし。
- red36000!==288/exit1→green288reads、1000seeded/empty/sparse/coercion/overflowでHTML同一・入力不変・8非空後tail未読。check:appに恒久回帰checkを接続。
- app/analysis/UI/globals/lint成功、両engine分析focus/履歴layout/タブ20 passed (8.8s)。375px前後画像保存/確認・PNG bytes同一。
- 固定v95/修正ref、14contexts420filter samples、七card batches×20calls。5000card median Chromium4.475→0.030ms/WebKit4.350→0.050ms。全分析の差は小さく、遅くなる条件もあり一律高速化を主張しない。
- inputhash/serialized size/HTML同一、期待件数/両ref focus/visible bounds/memory/demo保存不変、overflow/pageerror0。独立code/evidence review指摘なし。詳細/出力/限界はdocs/codex/score-trend-performance.md。
- 変更: scripts/50-record-view.js、tools/check-app.js/check-score-trend.js、性能doc、375前後画像、CHANGELOG/progress/tasks/台帳。

## 次と未解決

- AN-045: 次版markers/全体E2E/check/lint/format/実SW更新と記録保持/配信物・主要操作を検証して公開前候補を作る。v95承認は次版公開を含まない。
- 原則publish前は別の人間承認。現在公開v95、今回の局所改善は未公開・SW/version/依存変更なし。
- AN-038 Lighthouse major/28新packageには専用承認なし。ZIP13/27未解決、fullaudit high4packages/exit1を0と扱わない。
- root node_modulesは元checkoutへのjunction、install/update/ci禁止。owned sandbox sourceは今回候補、installedは公開済み3依存更新。
- 実機iPhone/VoiceOver、AN-001実射判定未検証。大量fixtureはmemoryのみ、5000件実保存/INP/normal-motion performance/少数非空の大量履歴は未測定。
- arrowCheck昇格/追加センシング条件未達。目標active、界隈で最も愛されるアプリを達成済みとは扱わない。
