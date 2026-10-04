# 少数矢の「今日の結果」比較

## AN070 設計と計画（2026-10-05）

前回AN069は公開v107まで完了し、進捗を変更した。今回の対象はAN067で観察された、1本の結果にRMS0への改善を示す問題。基点fd38b6c8。全承認を引き継ぎ、費用・個人情報を使わず所有架空fixtureのみで進める。

### 調査で確認した原因

- `momentStats` は中心からの分散を使う。1本ならRMS0が正しい数学的結果であり、採点・統計計算を変える必要はない。
- `computeStabilityTrend` は有限のRMSだけを要求する。同条件3履歴があれば、今回1本でも比較・改善sparklineを返す。
- `computeGrowthStreaks` も有限RMSだけで日単位の安定性を比較する。比較行だけ隠すと「安定性の伸び」に同じ問題が残る。
- 履歴の `groupingSessionRow` は既存の統計total/nがともに3以上の記録を対象にする。少数でも数学の値は残し、解釈する場面の資格を揃える。

### 選択

1. 注意書きだけ追加: 改善の強調が残る。
2. 6本以上に変更: より慎重だが、既存の3本境界とずれ、新しい閾値を増やす。
3. **既存の3本境界を今日の結果へ適用**: 今回・比較元・日単位の安定性に同じ資格を使う。これを選ぶ。

3本はアプリの最低表示資格であり、統計的な有意差や上達の証明ではない。比較条件（距離/的サイズ/的種別）、3履歴、最大10履歴/5平均、0.3cm境界、得点/自己ベストの処理はそのまま。用具や風条件の一致、分析ダッシュボードなど他のRMS面の監査は別タスク。

### 表示と契約

- 今回の座標が1〜2本: RMS改善行/sparklineに替えて「グルーピングの比較は保留」、使用座標の本数と「3本以上の座標が必要です」を同じ既存行様式で表示。
- 比較元もtotal/n3以上の有限RMSだけを数える。足りない履歴を3件として扱わない。
- 安定性の伸びも同資格のセッションだけで集計する。最新練習日が資格不足なら安定性metricを unavailable にし、古い日の伸びや偽の「途切れました」を出さない。同日に十分な記録があればその分だけで集計する。
- 数学的RMS、合計/本数、保存済み記録、初回/得点/自己ベストの既存資格、主要入力操作を変更しない。既存行の静かな表示を再利用しCSS/アイコンを追加しない。

### Product gates / 設計レビュー

記録と過去の比較を結びつける、少数の値と成長の解釈を分ける、完全local処理、日々の練習で静かに不足理由を読める、の4gateを満たす。デザイン正本は `docs/design/ui-design-language.md`（skillにある旧パスは存在せず、検索で現行正本を読んだ）。未定義の外部サービス/保存schema/依存/新しい採点仕様はない。全承認済みのUX改善として実行する。

### 実装・検証計画

1. 所有生成v107で320/375・light/darkの1本終了を再現し画像/DOM/旧記録を保存。純関数と終了→履歴の回帰を先に追加し正しい失敗を記録。
2. `49-todays-result.js` に資格を共有する内部helperを追加しtrend/history/streakを修正。`50-record-view.js` の結果行で保留を表示。
3. 0/1/2/3本、欠損座標、十分な履歴に少数履歴を混ぜるケース、最終日不足/同日混在、得点保持、不変入力データをチェック。終了・履歴で同じ保留、3本で従来比較、reload旧履歴保持を検証。
4. 375前後画像を含む320/375 light/dark目視、check:all/lint/format/生成dist全E2E、読み取り専用レビュー。公開するときは4版markerを一括更新し、CI/公開資産/所有旧profile更新とofflineを確認。
5. tasks/progress/ledgerへ実際の出力、失敗、限界と次の一件を記録。

大目標はactive。実iPhone/VoiceOverや統計的有意性、他のRMS面の改善をこの一件から主張しない。

## 実行済みの診断と前後確認

- 実robustStatsの純関数red: `1 coordinates cannot imply stability improvement: expected false, got true`（exit1）。生成v107の操作回帰redは `8 failed / 4 passed (59.1s)`。1/2本の8件は比較行が残るため失敗、3本の4件は成功。元出力と画像を保存した。
- 修正後の純関数は0/1/2/3座標、得点だけの矢が多くても座標不足、少数履歴混入のbaseline/sparkline不変、最新日不足/同日混在、得点の集計維持、入力非破壊を確認。`Few-coordinate result evidence checks OK (0/1/2/3, baseline, daily streak, data preservation)`。
- 生成v107のfocused greenは `12 passed (12.1s)`。320/375 light/darkで1/2/3本のnative終了、同じ保留/比較の履歴再構成、旧3件と確定した矢の全field保持、reload保持、横overflowなし/errors0。
- 今回の座標が1/2本なら初回でも保留理由を示す。通常6本の初回コピーはそのまま。初回1/2の追加2caseを最終suiteに含める。
- 前後画像40枚（beforeのsummary12/history4、afterのsummary12/history12）を所有test-resultsから保存。うち1本の代表8枚を原寸表示・目視、以下のdocsコピーは元のPNGと同一。320/375双方で短い保留行が収まり、旧改善sparklineが消える。全40枚の目視、実iPhoneを確認したとはしない。

| 幅/theme  | 修正前                                                                 | 修正後                                                               |
| --------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 375/light | [before](../screenshots/grouping-evidence-v108/before-375-light-1.png) | [after](../screenshots/grouping-evidence-v108/after-375-light-1.png) |
| 375/dark  | [before](../screenshots/grouping-evidence-v108/before-375-dark-1.png)  | [after](../screenshots/grouping-evidence-v108/after-375-dark-1.png)  |
| 320/light | [before](../screenshots/grouping-evidence-v108/before-320-light-1.png) | [after](../screenshots/grouping-evidence-v108/after-320-light-1.png) |
| 320/dark  | [before](../screenshots/grouping-evidence-v108/before-320-dark-1.png)  | [after](../screenshots/grouping-evidence-v108/after-320-dark-1.png)  |

他のRMS面（growthDashboard/todayConclusion/analysisKpi/period集計など）は今回の結果パネルと別のconsumerである。少数や比較条件による解釈の監査はまだ残る。自己ベストの本数換算も本件で変更しない。実射/用具/風条件を用いた統計的有意性、身体フォームの診断、速度改善をこの修正の成果として扱わない。
