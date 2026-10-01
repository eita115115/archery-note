# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- v93公開済み。承認後5c6ecea9e51cb932a0dbbfe17f4e0ba07811fc97をmainへpush。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/app-quality。
- 元の作業場所の未コミット変更は保全。費用・個人情報の使用なし。

## 完了

- 大量履歴高速化、履歴・記録開始・44px操作領域・HUD改善。
- v89: シートのスワイプ閉じ。v90: タブ別閲覧位置保持。
- v91: エンド確定固定・ページ拡大抑制。v92: 初回ガイドを記録操作の下へ移動。
- v93: 得点分布を一度で集計。カード中央値25.8→8.0ms（架空1000件・CPU4倍減速）、HTML1000例完全一致。
- 変更: scripts/60-history-sight-view.js、tools/check-app.js、版マーカー5ファイル、作業記録。

## 検証

- CI36821316579成功: `106 passed (59.0s)`、check:all/lint/format成功。
- Pages36821315831成功。公開93と7candidate asset一致。
- 公開Chromium: 得点分布・架空履歴/記録開始・設定タッチスワイプ・offline/データ保持・pageerror0成功。
- 公開WebKit320/375px: 分析の全件/距離絞込/解除の矢数・保存不変・オンラインpageerror0成功。
- WebKit offline reloadは内部エラーで失敗。immutable旧92でも同条件で再現し、controllerとshell cacheを確認。原因未確定、AN-030へ記録。
- 実SW v92→93更新/データ保持成功。21配信物byte一致。独立レビュー指摘なし。
- 詳細: docs/codex/release-v93.md、score-distribution-performance.md。

## 次と未解決

- 次: AN-030でWebKit内部エラーを最小SW/HTMLと比較して切り分ける。証拠なくSW動作は変更しない。
- v93公開承認の停止条件は解消。目標はactive、完了扱いにしない。
- 実機iPhoneの記録・確定・拡大抑制・設定スワイプ・offline操作感は未確認。v92のエンド確定について質問済み、回答待ち。
- 実射の射形判定・保存の受入AN-001は未完了。
- arrowCheck昇格・追加センシングはロードマップの条件未達。
- 依存アラートは初回静的確認のみ、実害確定・更新は未実施。
