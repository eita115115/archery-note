# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- 公開v95、main97945e17、runtime7039fcea。今回push/deployなし。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/score-trend-performance。
- AN-044実装bd36e8cbとAN-046検証待機の診断は完了。次版markers96の候補a877c4337cfcae4e4b9da52058a44c1ca8c58a6fを検証中。AN-045はin-progress/passesfalse、公開準備完了ではない。
- 元checkout/共有node_modules保全、費用・個人情報の使用なし。

## 今回の検証

- version:bumpで5markers96整合。workerはcache番号だけ、dependency tree/scoring/storage戦略の変更なし。
- owned sandbox check:all/lint/format成功、116 passed (1.1m)。native21asset bytes/readiness96一致、依存tree/shared hidden lock不変。
- normal両engine320light/375darkの4実SW95→96更新banner/cache切替/履歴5件・HTML同一・focus/visible bounds/履歴19合計、更新後active1本/server-stop/offline保持成功。予行も7asset/期間/44px/設定touch swipe/架空記録保持/pageerror0成功。
- AN-046: installed Playwright1.61.1のwaitForFunction(async predicate)はPromiseをtruthy扱いし、falseに解決しても再pollしない。旧helperは戻り値をassertせず、更新完了を待っていなかった。最小seamはfalse1call、正しいexpect.pollは3callsでtrue。controller世代のMessageChannel診断も旧gate直後95を確認。
- explicit expect.pollで元の追加routeは両engine320light/375darkの4cases成功。tracked tools/diagnostics/verify-v96-worker-update.cjsでも独立4contexts成功。guard/更新前active1・履歴5・HTML同一、追加active2/server-stop/ECONNREFUSED/fromSW/記録保持/focus bounds/pageerror0。不必要なアプリ・worker変更なし。
- minimalの古いHTML結果、CSP違反の診断helper、updatedAt/launchCountを含めた誤比較、初期helper無期限ready待機を記録・保存。最終比較は練習データに限定。所有helper停止確認後はbounded wait/finally cleanup。
- read-only review messageは原因とcorrected4/regression4/seamを確認しP1/P2なし。最終turnはusage limitで終了し、最終docs review未完。primaryが記録を検証。詳細はdocs/codex/offline-worker-update-diagnosis.md。
- 最終PWA/format/diagnostic個別format/syntax成功。acceptance不変・AN-046 evidenceとAN-045未完・4+4/seam scopeを検証。current source101filesはowned sandbox一致、共有hidden lock不変、候補runtime差分なし、所有diagnostic Node helper残存なし。

## 次と未解決

- AN-045へ戻る: normal clickable-banner helperにも同じasync cache waitがあるためexplicit pollへ直して4casesを再検証する。旧normal offline/保持成功は事実だが旧gateだけではcache95不在を証明できない。再検証後に候補記録・公開reviewを完了する。
- 実機を含む任意の更新タイミング保証は未証明。過去の失敗を保存し、検証待機の修正をアプリ修正と混同しない。公開承認の質問はまだしない。
- v95承認は次版公開・AN-038 Lighthouse major/28新依存を含まない。ZIP13/27、fullaudit high4packages/exit1は未解決。
- root node_modulesは元checkoutへのjunction、install/update/ci禁止。owned sandboxは候補96source、installedは公開済み3更新済み版。
- 実iPhone/VoiceOver/5000実保存/INP、AN-001実射とarrowCheck追加センシング条件未達。目標active。
