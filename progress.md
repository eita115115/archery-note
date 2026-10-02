# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

## 現在地

- 公開v96、main85a52fc5、runtimea877c433。公開CI36943369425/Pages36943368347・116 passed (1.3m)と全21配信一致/主要操作/offline架空保持は完了。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/correction-return。AN-049の的への復帰改善はローカル検証完了、未公開。markersは96のまま。公開branch85は保持。
- 人間「すべて承認します」を受領済み。継続する局所改善/次版公開と既存AN-038追加依存も承認済み、費用/個人情報使用は禁止。元checkout/共有node_modules保全。

## 今回完了 — AN-049

- 前のgoal turnはv96公開/AN-048調査と記録完了でprogress。current source/acceptance/brief/台帳/skillを再確認。
- 微調整欄の閉鎖後に下方scrollが残る原因をtraceで確認。的への復帰処理がなく、chips処理は下側の重なりしか扱わない。ブラウザー内部の原因は断定しない。
- 微調整終了と成功したエンド確定時だけ、現在のheader/dock境界内へ的を最小移動。target cardを実寸で保持、同期処理でfocusを奪わない。点数/保存/版/依存の変更なし。
- red6failed/2passed、初期green8passed、最終 8 passed (1.7m)。Chrome/WK320/375・normal/reduce、解除/chip/delete/選択中確定・継続nudge/reason即時非移動・active tab120復帰・修正矢と既存3件/reload保持/pageerror0。関連20passed再利用。同じruntimeのapp/UI/globals/lint/format成功。
- 375前後PNGを目視。helper相対path誤りと保存待機race2箇所を保持し、全placementにcount gate。read-only reviewのP2待機指摘に対応、最終review/record auditはdoc末尾。詳細docs/codex/correction-return.md。
- 変更: scripts/50-record-view.js、tests/e2e/correction-return.spec.js、改善doc/前後画像、CHANGELOG/progress/tasks/台帳。

## 次と未解決

- AN-052: 次版markers/全check/E2E/実更新・offline保持→承認済み公開/CI/Pages/21bytes/375live復帰。検証前に公開しない。新しい承認質問は不要。
- AN-050通知重なり、AN-051開始selector名は別の小task。AN-038major隔離検証は承認済み未実装、既存ZIP13/27とaudit high4packagesは未解決。
- root node_modulesは元checkoutへのjunction、install/update/ci禁止。owned sandboxを使用。
- 実iPhone/keyboard/VoiceOver/5000実保存/INP、AN-001実射未確認。headless touch・programmatic correction scrollであり実gesture保証ではない。目標active。
