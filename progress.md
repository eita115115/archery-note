# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

## 現在地

- 公開v96、初回公開source85a52fc5、runtimea877c433。AN-047公開確認完了。CI36943369425/Pages36943368347成功、116 passed (1.3m)。全21配信物byte一致、fresh375主要操作/実SW offline架空履歴5件+active保持/pageerror0。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/phone-end-flow-audit。公開branch codex/score-trend-performanceは85a52fcで固定。
- AN-044/045/046完了。候補runtime a877c433、全check/lint/format・116 passed (1.1m)、両engine320/375のnormal4/active4実SW95→96更新と架空記録/offline保持の証拠を再利用できる同一source。詳細docs/codex/release-v96.md。
- 元checkout/共有node_modules保全。費用・個人情報の使用なし。

## 今回完了 — AN-048

- 読み取り専用の6本記録フローを点検。Chrome/WK320/375・normal motion・70m122cm/6本、undo/微調整/2エンド保存、既存架空3件不変・reload保持・pageerror0。手動scroll相当の回復を含む結果であり、scrollなし合格ではない。
- 全4casesで的/本数selectorの名前欠落と得点通知によるエンド文字の視覚重なり。WK375では微調整から戻って第1end確定後、次end0本の的が画面外。immutable95の対照1caseでも同じ位置、v96最適化の新規回帰とは示されない。
- 現行画像3枚/ARIA/raw JSON・失敗helperを保持、独立reviewでscopeを確認。アプリ/版/依存変更なし。変更はaudit doc/画像/tasks/progress/台帳。
- 記録auditは過去tasks/acceptance不変、候補85/source固定、4+1caseの保存scopeと3PNG同一を確認。書式/共有source照合の結果はaudit doc末尾。

## 次と未解決

- AN-047完了。公開記録と調査記録を保管し、次はAN-049の小さな修正。実機の確認は引き続き未確認。
- AN-049: 微調整後の次の的への戻りを原因確定・失敗regressionから修正。通知配置AN-050、入力label AN-051は別task。
- 「すべて承認」を受領。既存AN-038 major依存も実行可能だが、この公開に混ぜず別taskで互換性/監査を確認する。ZIP13/27とfullaudit high4packagesは未解決。
- root node_modulesは元checkoutへのjunction、install/update/ci禁止。owned sandboxのみ使用。
- 実iPhone/VoiceOver/5000実保存/INP、AN-001実射は未確認。今回はheadless touchscreenとprogrammatic scroll、全保存領域/採点境界/実機gestureの保証ではない。目標active。
