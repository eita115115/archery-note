# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- v91公開済み。ユーザー承認後dbcb99f0をmainへpush。テスト調整9071e564も公開。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/app-quality。
- 元の作業場所の未コミット変更は保全。費用・個人情報の使用なし。

## 完了

- 大量履歴高速化、履歴・記録開始・44px操作領域・HUD改善。
- v89: シートをスワイプで閉じる。v90: タブ別閲覧位置保持。
- v91: タブ切り替え後もエンド確定を画面下部に固定。記録直後にスクロールせず確定できる。
- ページ全体のピンチ/連続タップ拡大を抑制。スクロールと的の倍率操作を維持。
- ロードマップ・診断テスト固定版・実機確認の版条件を整理。

## 検証

- check:all/lint/format成功。Linux CI36794033791:104 passed (1.1m)。
- 初回CI36793723675の履歴テスト描画待ち不足を修正。Chromium6回/WebKit2回成功後、CI全緑。
- Pages36793723110/36794033346成功。公開版91と7ファイル一致。
- 公開Chromium/WebKit操作4 passed (5.7s)。画面座標で矢記録/エンド確定、固定位置を確認。
- Chromium2本指拡大操作でscale1、設定スワイプ・offline保持・pageerror0確認。
- 実SW v90→91更新保持成功。独立レビュー指摘なし。
- 詳細: docs/codex/release-v91.md。画像: docs/screenshots/end-dock/。

## 次と未解決

- 実機iPhoneでエンド確定位置とズーム抑止の操作感を確認。
- 実射の射形判定・保存の受入AN-001は未完了。
- arrowCheck昇格と追加センシングはロードマップの条件未達。
- 依存アラートは初回静的確認のみ、実害確定・更新は未実施。

## 次のローカル改善

- 320×568で初回ガイドが的とチップ間に入り、連続記録時に的を画面外へ押し出す問題を再現。
- scripts/50-record-view.jsでガイドを記録操作の下へ移動。初回表示・次回非表示設定は維持。
- tests/e2e/end-sequence.spec.js: 2エンド6本をスクロールなしで確定、Chromium2件/WebKit2件成功。check:ui/check:app/lint成功。
- 詳細docs/codex/end-sequence.md。次: リリース全体検証。公開はv91、ユーザーの操作感回答待ち。
