# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- v94公開済み。承認後e4ec1abe6dd78aa18ccae703be2beee65988c2f5をmainへpush。
- 履歴ラウンド折りたたみ実装1e95918、公開候補5abc0baとruntime同一。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/app-quality。
- 元の作業場所の未コミット変更を保全。費用・個人情報の使用なし。

## 今回完了

- AN-033: v94公開とCI/Pages/公開配信・実ブラウザ動作を確認。
- 同じ多距離ラウンドをまとめ、合計・本数・距離を表示。開くと各stageの詳細へ移動。絞り込みは表示分合計、ページ境界で分割せず開閉をメモリ保持。
- 変更: 公開承認・結果の作業記録、CHANGELOG、roadmap、progress/tasks。公開候補の実装は変更していない。
- 保存・採点・SW戦略・依存は変更していない。

## 検証

- Pages36825162385/CI36825163421成功。Linux全体 `110 passed (1.2m)`、check:all/lint/format成功。
- 公開94/7candidate asset一致。Chromiumのラウンド開閉・得点分布・開始・44px/HUD・設定タッチスワイプ・offline保持/pageerror0成功。
- 公開Chromium/WebKit320/375pxの4ケースで合計34/stage順/詳細/絞込17/開閉保持/横はみ出しなし・架空7件と記録中1本のreload保持成功。公開画像を確認。
- 事前の実SW v93→94更新と配信server停止offlineは両ブラウザ320/375の4ケース成功。コピー21ファイルbyte一致、独立レビュー指摘なし。
- 詳細: docs/codex/release-v94.md、history-round-collapse.md、artifacts/release-v94/。

## 次と未解決

- 次: 実機iPhoneのUXとAN-001実射の受入。公開承認・配信確認の条件は解消。
- 記録・確定・ページ拡大抑制・設定スワイプ・offlineの実機操作感は未確認。エンド確定について質問済み、回答待ち。
- 実射の射形判定・保存のAN-001は未完了。arrowCheck昇格・追加センシングは条件未達。
- 依存アラートは初回静的確認のみ。今回push時も16件(10 high/6 moderate)の通知あり、実害確定・更新は未実施。
- 目標はactive。「界隈で最も愛されるアプリ」を達成したとは判定しない。
