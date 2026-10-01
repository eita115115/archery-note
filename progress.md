# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- 公開v95、main97945e17、runtime7039fcea。今回push/deployなし。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/score-trend-performance。
- AN-044実装bd36e8cbは完了。次版markers96の候補a877c4337cfcae4e4b9da52058a44c1ca8c58a6fを検証中。AN-045はin-progress/passesfalse、公開準備完了ではない。
- 元checkout/共有node_modules保全、費用・個人情報の使用なし。

## 今回の検証

- version:bumpで5markers96整合。workerはcache番号だけ、dependency tree/scoring/storage戦略の変更なし。
- owned sandbox check:all/lint/format成功、116 passed (1.1m)。native21asset bytes/readiness96一致、依存tree/shared hidden lock不変。
- normal両engine320light/375darkの4実SW95→96更新banner/cache切替/履歴5件・HTML同一・focus/visible bounds/履歴19合計、更新後active1本/server-stop/offline保持成功。予行も7asset/期間/44px/設定touch swipe/架空記録保持/pageerror0成功。
- 追加routeの初期失敗は練習中更新guardの見落とし。正常な抑止をassertしたうえで登録worker更新→browser reloadへ分離し、更新前active1保持まで確認。しかしactive2本でserver-stop後offline reloadがChromium320で15s timeout再現。
- baseline-only95 controlは同一URLの再読み込み/active2/offlineが成功（1case）。activation/controller待ちや旧worker fetch書込無効化experimentでも追加route解消せず。両cache95/96のstorage scriptは96、controller/active activated、index cacheあり。原因/データ消失は未確定。
- 初期helper timeout・bounded診断/helper syntax/API失敗・誤labelのbaseline metadataを保存し、final controlのlabel/count/imageパス修正。診断で待機した所有helper PIDを確認して停止、後続はbounded evaluation/finally cleanup。
- 独立release/diagnostic reviewはnormal4casesの証拠を認め、追加route未解決を確認。詳細・出力・失敗・未確認条件はdocs/codex/release-v96.md。

## 次と未解決

- AN-046を先に進める: active worker-update/offline routeを最小再現し、fetch/worker lifecycle/URL/cacheとbrowser差を観測して原因を絞る。アプリ由来かhelper/browser由来か未確定、仮説だけで修正しない。
- 原因/修正/検証制約が確定したらAN-045の候補受入へ戻る。失敗routeを削除して公開準備完了と扱わない。公開承認の質問はまだしない。
- v95承認は次版公開・AN-038 Lighthouse major/28新依存を含まない。ZIP13/27、fullaudit high4packages/exit1は未解決。
- root node_modulesは元checkoutへのjunction、install/update/ci禁止。owned sandboxは候補96source、installedは公開済み3更新済み版。
- 実iPhone/VoiceOver/5000実保存/INP、AN-001実射とarrowCheck追加センシング条件未達。目標active。
