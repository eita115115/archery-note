# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- 公開v93、remote main8d4bafb。新しいv94は未公開、承認待ち。
- 履歴ラウンド折りたたみ実装1e95918、公開候補5abc0ba008eb0f42d12d455cc177caafe8a7f0e2。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/app-quality。
- 元の作業場所の未コミット変更を保全。費用・個人情報の使用なし。

## 今回完了

- AN-032: v94公開候補を作成し全体回帰・配信物・実更新・オフライン保持・独立レビューを検証。
- 変更は5版マーカーファイルと作業記録。履歴の実装内容はAN-031から変更していない。
- 公開確認helperも固定candidateで予行済み。保存・採点・SW戦略・依存は変更していない。

## 検証

- check:all/lint/format成功。全体Chromium `110 passed (1.3m)`。コピー21ファイルのbyte一致。
- 実SW v93→94更新: Chromium/WebKit320/375pxの4ケースでバナー・cache切替と旧cache削除・架空5記録/用具/サイト/カスタムラウンド保持成功。
- 更新後のラウンド合計19・各stage表示を確認。記録中1本を置いて配信server停止、ECONNREFUSEDを確認し、SWからoffline再表示・矢/履歴保持・pageerror0成功。
- 公開確認のローカル予行: 7asset一致、ラウンド開閉・得点分布・開始・44px操作領域/HUD・設定タッチスワイプ・offline保持成功。公開サイトのv94確認と混同しない。
- 独立レビュー指摘なし、版整合/PWAチェック独立再確認。前の実装検証は両エンジン32成功＋最終focused8成功、375px前後/dark画像あり。
- 詳細: docs/codex/release-v94.md、history-round-collapse.md、artifacts/release-v94/。

## 次と未解決

- 次: v94公開承認。承認後remoteを再確認してpush、CI/Pages完了を待ち公開94/配信物/動作を確認。既存v93公開承認を新しい公開に流用しない。
- 未承認のためpushしていない。公開確認とAN-001実射受入は未完了。
- 実機iPhoneの記録・確定・拡大抑制・設定スワイプ・offline操作感は未確認。エンド確定について質問済み、回答待ち。
- arrowCheck昇格・追加センシングは条件未達。依存アラートは初回静的確認のみ、実害確定・更新は未実施。
- 目標はactive。「界隈で最も愛されるアプリ」を達成したとは判定しない。
