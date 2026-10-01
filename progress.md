# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- v92公開済み。ユーザー承認後ae97bf617da289998ab395946476cb5f671cde92をmainへpush。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/app-quality。
- 元の作業場所の未コミット変更は保全。費用・個人情報の使用なし。

## 完了

- 大量履歴高速化、履歴・記録開始・44px操作領域・HUD改善。
- v89: シートをスワイプで閉じる。v90: タブ別閲覧位置保持。
- v91: エンド確定を画面下部に固定。ページ全体の拡大を抑制し、スクロールと的の倍率操作を維持。
- v92: 初回ガイドをチップ・微調整操作の下へ移動。短い画面で連続記録時に的が画面外へ押し出される問題を修正。
- 変更: scripts/50-record-view.js、tests/e2e/end-sequence.spec.js、版マーカー・生成物、375px前後画像、作業記録。

## 検証

- check:all/lint/format成功。Linux CI36796668313: `106 passed (1.1m)`。
- Pages36796667134成功。公開版92と7ファイル一致。
- 公開Chromium/WebKit320×568・375×812: `4 passed (20.5s)`。初回ガイドを開いたまま、画面座標操作で6本記録・2エンド確定。
- 公開設定タッチスワイプ、架空履歴保持、offline再読込、pageerror0確認。
- 実SW v91→92更新保持成功。独立レビュー指摘なし。
- 詳細: docs/codex/release-v92.md。画像: docs/screenshots/end-sequence/。
- 追加の終了フロー点検AN-026: Chromium/WebKit320/375pxの4ケース成功。未確定1本も保存し、結果を閉じて履歴確認・再読み込み後保持。詳細docs/codex/finish-flow-audit.md。実装変更なし。

## 次と未解決

- 実機iPhoneで連続記録・エンド確定位置・ズーム抑止・設定スワイプの操作感を確認。v92のエンド確定が解消したか質問済み、回答待ち。
- 実射の射形判定・保存の受入AN-001は未完了。
- arrowCheck昇格と追加センシングはロードマップの条件未達。
- 依存アラートは初回静的確認のみ、実害確定・更新は未実施。
