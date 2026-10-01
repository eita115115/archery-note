# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- 公開v93。承認後5c6ecea9をmainへpush、CI/Pages/公開配信確認済み。
- AN-031: 履歴ラウンドの折りたたみをローカル実装・関連検証済み。未公開、版更新は次。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/app-quality。
- 元の作業場所の未コミット変更を保全。費用・個人情報の使用なし。

## 今回完了

- 同じ多距離ラウンドをまとめ、閉じた状態で合計・本数・距離・記録ステージ数を表示。
- 展開して各ステージの詳細へ移動。絞込後は表示分合計。ページ境界でラウンドを分割せず、開閉をメモリで保持。
- 変更: scripts/60-history-sight-view.js、style.css/style.min.css、tests/e2e/history-round-collapse.spec.jsとapp-smoke.spec.js、375px画像、作業記録。
- 保存データ・採点・SW・依存は変更していない。

## 検証

- 新規回帰は実装前に2件が目的どおり失敗。
- 最初の両エンジン実行は28成功/4失敗。閉じた行を直接押す旧テストと反映されないfixture差替えを修正し、`32 passed (31.5s)`。
- 最終focused `8 passed (11.2s)`。320/375px、dark/light、1280px、合計・stage順・フィルタ・境界・開閉保持・詳細遷移・架空保存不変。
- check:ui/app/globals/lint/format成功。独立静的レビュー指摘なし。375px前後/dark/展開画像確認。
- 詳細: docs/codex/history-round-collapse.md、artifacts/history-round/。
- 公開v93のCI `106 passed (59.0s)`。WebKitオフライン模擬の内部エラーはAN-030で切り分け済み。実配信サーバー停止では両ブラウザ320/375pxの4ケースで再表示・データ保持成功。

## 次と未解決

- 次: 今回の変更の版更新・全体E2E・実SW更新とデータ保持のリリース検証。材料を揃えてから公開承認を求める。既存v93公開承認を新しい公開に流用しない。
- 実機iPhoneの記録・確定・拡大抑制・設定スワイプ・offline操作感は未確認。エンド確定について質問済み、回答待ち。
- 実射の射形判定・保存の受入AN-001は未完了。arrowCheck昇格・追加センシングは条件未達。
- 依存アラートは初回静的確認のみ、実害確定・更新は未実施。
- 目標はactive。「界隈で最も愛されるアプリ」を達成したとは判定しない。
