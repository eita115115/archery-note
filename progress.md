# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- v90公開済み。ユーザー承認後012e6ac1をmainへpush。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/app-quality。
- 元の作業場所の未コミット変更は保全。費用・個人情報の使用なし。

## 完了

- 大量履歴の再表示高速化、履歴・記録開始・44px操作領域・HUD3列改善。
- v89: 設定などの上端ハンドルを下へスワイプして閉じる。
- v90: タブ別閲覧位置を保持。初回は先頭、再読み込みで位置をリセット。
- WebKitのキーボードフォーカス検証、診断テスト固定版の意図、ロードマップを整理。

## 検証

- check:all/lint/format成功。Linux CI36790779831: 102 passed (1.0m)。
- Pages36790778468成功。公開7ファイル一致・タブ位置復帰・タッチスワイプ成功。
- 架空データで記録開始・履歴保持・offline再表示・pageerror0を確認。
- v89→90の実SW更新保持成功。WebKit閲覧位置2件成功。独立レビュー指摘なし。
- 詳細: docs/codex/release-v90.md、docs/codex/tab-scroll-investigation.md。

## 次と未解決

- 実機iPhoneでスワイプと閲覧位置復帰の操作感を確認。
- 実射の射形判定・保存の受入（AN-001）は未完了。
- arrowCheck昇格は実射基準未達。追加センシング等はロードマップの保留方針を維持。
- 依存アラートは初回静的確認のみ、実害確定・更新は未実施。

## 実機確認の準備

- v90のスワイプ・閲覧位置復帰についてユーザーへ操作感を質問済み、回答待ち。
- docs/form-diagnostic-field-acceptance.mdの旧v84固定条件を配信確認済みの版・commit/tree記録へ修正。合格基準は維持、実射未確認。
