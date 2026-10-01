# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- 公開v95、main97945e17、runtime7039fcea。今回push/deployなし。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/score-trend-performance。
- AN-044実装bd36e8cb・AN-046診断・AN-045候補受入は完了。次版markers96の候補a877c4337cfcae4e4b9da52058a44c1ca8c58a6fは公開承認待ち。AN-047はneeds-user/passesfalse。
- 元checkout/共有node_modules保全、費用・個人情報の使用なし。

## 今回の検証

- version:bumpで5markers96整合。workerはcache番号だけ、dependency tree/scoring/storage戦略の変更なし。
- owned sandbox check:all/lint/format成功、116 passed (1.1m)。native21asset bytes/readiness96一致、依存tree/shared hidden lock不変。
- normalをexplicit expect.pollへ直して両engine320light/375darkの4実SW95→96更新を再検証。cache96のみ/active activated/controller一致を別assertし、banner/履歴5件・HTML同一・focus/visible bounds/履歴19合計・更新後active1/server-stop/ECONNREFUSED/fromSW保持/pageerror0成功。旧normal出力と画像は保存し、新出力はcorrected別名。予行も7asset/期間/44px/設定touch swipe/架空記録保持/pageerror0成功。
- AN-046: installed Playwright1.61.1のwaitForFunction(async predicate)はPromiseをtruthy扱いし、falseに解決しても再pollしない。旧helperは戻り値をassertせず、更新完了を待っていなかった。最小seamはfalse1call、正しいexpect.pollは3callsでtrue。controller世代のMessageChannel診断も旧gate直後95を確認。
- explicit expect.pollで元の追加routeは両engine320light/375darkの4cases成功。tracked tools/diagnostics/verify-v96-worker-update.cjsでも独立4contexts成功。guard/更新前active1・履歴5・HTML同一、追加active2/server-stop/ECONNREFUSED/fromSW/記録保持/focus bounds/pageerror0。不必要なアプリ・worker変更なし。
- minimalの古いHTML結果、CSP違反の診断helper、updatedAt/launchCountを含めた誤比較、初期helper無期限ready待機を記録・保存。最終比較は練習データに限定。所有helper停止確認後はbounded wait/finally cleanup。
- AN-046のread-only review messageは原因/seam/4+4を確認したが当時の最終docs reviewはusage limitで未完。今回AN-045の最終read-only reviewは完了し、normal gate/4JSON・active証拠・acceptance不変・未公開の区別を確認、P1/P2なし。
- PWA/format/diagnostic個別format/syntax成功。current source101filesはowned sandbox一致、native21bytes/readiness96・依存tree/共有hidden lock不変、候補runtime差分なし。全体116-testは同じ候補の既存成功結果を保持し、記録変更だけで繰り返さない。
- 最終record auditは既存acceptance維持・normal4のreadiness別assert・active4の保持scope・AN-045完了/AN-047承認待ちを確認。375dark normal画像も目視確認、可視focus/期間と横はみ出し問題なし。今回の変更はCHANGELOG/release-v96/progress/tasks/historyの記録のみ。

## 次と未解決

- AN-047: v96公開への人間承認後にmainを再照合してpushし、source指定CI/Pages・公開96全21asset bytes・375主要操作とオフライン架空記録保持を確認する。今のremote mainは97945e17。公開helper予行はlive96証拠ではない。
- 実機を含む任意の更新タイミング保証は未証明。過去の失敗を保存し、検証待機の修正をアプリ修正と混同しない。AGENTS.mdのL3規則に従い、v96公開だけを確認する。
- v95承認は次版公開・AN-038 Lighthouse major/28新依存を含まない。ZIP13/27、fullaudit high4packages/exit1は未解決。
- root node_modulesは元checkoutへのjunction、install/update/ci禁止。owned sandboxは候補96source、installedは公開済み3更新済み版。
- 実iPhone/VoiceOver/5000実保存/INP、AN-001実射とarrowCheck追加センシング条件未達。目標active。
