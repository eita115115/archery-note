# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

## 現在地

- 公開v97、main dd3cda12b304e0991c611789674183c4ef9fa6e2、runtime58c411e。CI36947646285/Pages36947645601成功、120 passed (1.5m)。全21配信一致/公開375主要操作/offline架空保持完了。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/correction-return。AN-049実装とAN-052公開検証完了。公開後の記録更新はローカルcommitに保存。
- 人間「すべて承認します」は継続する局所改善/次版公開と既存AN-038追加依存に適用済み。費用/個人情報使用は禁止。元checkout/共有node_modulesを保全。

## 今回完了 — AN-052

- AN-049の微調整閉鎖/成功したエンド確定後の的への復帰をv97公開。版以外の追加runtime変更なし、採点/保存/依存/worker activation戦略は変更なし。
- 全check/lint/format・local120passed(1.2m)、native21/readiness97・source102/共有lock一致。実SW96→97 active4cases（reduce/custom viewport）とbanner4cases（normal/mobiletouch）でcache切替・記録保持・配信停止offline/error0を確認。
- 捕捉animation finished Promiseが未解決でも観測playStateがfinishedになる待機問題を診断。helperだけを現在状態の2s期限pollに変更、失敗ログ保持。独立review P1/P2なし。geometry読み取りを含む検証のため描画性能/任意の遅延移動保証ではない。
- 承認済み公開、source指定CI/Pages成功。全21公開bytes一致、fresh375で6矢/修正/解除/確定後の的全体と次矢、設定CDP touch swipe、history5/activeのoffline保持/pageerror0。公開画像目視。
- 変更: markers5ファイル（58c411e）、docs/codex/release-v97.md、CHANGELOG/progress/tasks/履歴台帳。詳細/失敗と成功の出力はrelease doc。

## 次と未解決

- 次の小taskはAN-050: 記録通知がエンド確定の文字に重なる問題。AN-051: 開始selectorの名前付けは別task。AN-038major隔離検証は承認済み未実装、既存ZIP13/27とaudit high4packagesは未解決。
- root node_modulesは元checkoutへのjunction、install/update/ci禁止。owned sandboxを使用。
- 実iPhone/keyboard/VoiceOver/5000実保存/INP、AN-001実射は未確認。headless touchとprogrammatic correction scrollであり実gesture保証ではない。大目標はactive。
