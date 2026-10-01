# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- 公開アプリv94、main e1ec1fe6。依存3件のAN-036は公開・CI/Pages・配信物・警告確認済み。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/analysis-filter-focus。
- AN-041完了、v95候補のruntime7039fcea9e84806b2c6aa852b9a90aa1e438e295。ローカル未公開、AN-042の人間承認を受領して公開作業中。
- 元checkout/共有node_modules保全、費用・個人情報の使用なし。

## 今回完了

- 分析の用具/距離を名前で操作可能にし、focused選択/解除後のfocus保持を改善。期間chipも含め、先行カードの高さを確定して固定ナビに隠れない分だけ位置調整。
- 版マーカー95はversion:bumpで整合、SWはcache番号だけ、依存treeは公開済み版と同一。
- 最初の114緑では可視性を保証できず画像で問題発見。境界テスト3failed/1passedを確認して7039fceaで修正、旧d4c3結果は最終成功に流用しない。
- 最終check:all/lint/format成功、116 passed (1.4m)、両engineフィルタ/タブ16 passed (15.9s)、通常motion4ケースの用具/距離/期間可視性成功。
- 実SW94→95更新、旧cache削除、架空履歴5件保持が両engine320/375の4ケース成功。その後入力したactive1本をserver停止/接続拒否/SW offline再表示でも保持、修正controlの名前/focus/境界も成功。
- native-web21asset byte一致、最終source/test/version/dependency一致、共有hidden lock不変。preview予行は7assets/設定touch/履歴/分析/開始/44px/offline保持/pageerror0成功。
- 独立静的review7039fcea指摘なし。375px画像保存・確認、docs/codex/release-v95.mdに結果/初期不具合/検証helper待機修正/限界を記録。
- 変更: 版マーカー5ファイル、scripts/50-record-view.js、分析回帰テスト、release-v95/focus-doc、375画像、CHANGELOG/progress/tasks/台帳。

## 次と未解決

- AN-042: v95への人間の公開承認を受領。remote main=e1ec1fe6を照合済み。main反映・CI/Pages・公開95/asset/分析control/主要操作/データ保持を確認中。
- AN-043完了: 固定v94/v95・14contexts/420samples、候補5000件全距離median Chromium172.8ms/WebKit295ms。期待件数/可視性/保存不変/入力hash一致、独立review指摘なし。詳細と限界はdocs/codex/analysis-filter-performance.md。
- 次はAN-044: 空記録を飛ばした先頭8件の分析カード集計を絞る。v95公開候補とは別のbranchで、HTML互換/入力不変/読取上限と性能を確認する。
- AN-038 Lighthouse major/28新packageには専用承認なし。ZIP13/27は未解決、fullaudit high4packages/exit1を0と扱わない。
- root node_modulesは元checkoutへのjunction、install/update/ci禁止。owned sandbox sourceは最終95候補、installedは公開済み3更新済み版。
- 実機iPhone操作感/VoiceOver、AN-001実射判定は未検証。active1本の今回証拠は更新後offline保持であり、更新前active保持の証明ではない。
- arrowCheck昇格/追加センシング条件未達。目標はactive、界隈で最も愛されるアプリを達成済みとは扱わない。
