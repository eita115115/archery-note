# 現在の状態

> 現在地の正本。長い経緯は `docs/codex/codex-progress.md`。

最終更新: 2026-09-30

## 現在地

- 公開版はv89（実装cb7e091、公開承認後ca31b8e3をmainへpush）。
- 作業場所: `C:/Users/eita2/.codex/worktrees/app-quality/archery-note`
- ブランチ: `codex/app-quality`。元の作業場所の未コミット変更は保全。
- 費用・個人情報は明示承認なしに使用しない。検証は架空データのみ。

## 完了したこと

- 大量履歴の再表示高速化、初回統計の重複計算削減。
- 履歴フィルタ・記録開始表示・44px操作領域・練習HUD3列を改善し公開。
- ユーザー希望のスワイプ閉じるを実装。上端ハンドル、短いドラッグ取消、既存の閉じる処理を再利用。
- 長い設定でもハンドルを上端に維持。確認画面ではキャンセル、カメラ画面は除外。

## 検証

- v89: check:all / lint / format成功、Chromium E2E100件成功。
- WebKitスワイプ2件成功、CDPタッチ1件は対象外。Chromiumは実タッチ中断/完了も成功。
- 実SW v88→89更新、架空履歴3件保持、オフライン再表示成功。
- 公開確認: Pages36707080253 / CI36707081098成功、Linux E2E `100 passed (55.6s)`。公開7ファイル一致、タッチスワイプ・データ保持・offline成功。
- 詳細: `docs/codex/modal-swipe.md`、比較画像: `docs/screenshots/modal-swipe/`。

## 次にやること

- 次: 検証済みv90（21a8d73）の公開承認後、push・Pages/CI・公開サイト確認。
- 実機でハンドルを引く操作と、実際の練習での使い勝手を確認。

## 未解決

- 実射の射形判定・保存・自動スクロール受入（AN-001）。
- WebKitのフォーカス復帰テスト2件はキーボード起点に修正。UX22件成功、CDP専用1件skip。アプリ側変更なし。
- 依存アラートの初回静的確認はneeds_review。実害確定・更新は未実施。
- ロードマップ更新（AN-002）完了。既存判断と現行実装を区別。

## 今回の検証整備

- tests/e2e/app-smoke.spec.js: フォーカス復帰をキーボードで開く操作に統一。
- WebKit `22 passed (16.7s)` / Chromium smoke `8 passed (11.9s)`、lint成功。
- 初回の書式検証失敗は改行整形後に解消。ローカルのみ、公開版v89の動作変更なし。

## タブ移動の調査

- Chromium/WebKitで履歴1400px→分析初回1400px→履歴0pxを再現。
- 復帰候補3案は検証不合格のためアプリ側変更を撤回。公開v89維持。
- 再現手順・失敗と次の調査を docs/codex/tab-scroll-investigation.md に保存。

## 閲覧位置の修正（ローカル）

- scripts/50-record-view.js: タブ別に位置をメモリ保持し、復帰時の仮カード高さによる位置消失を修正。
- tests/e2e/tab-scroll.spec.js追加。Chromium2件/WebKit2件成功、check:ui/check:app/lint/書式成功。
- 375px前後画像と検証詳細: docs/codex/tab-scroll-investigation.md。公開はv89のまま。

## v90公開候補

- check:all/lint/format成功、Chromium `102 passed (1.0m)`。
- 実SW v89→90の更新・履歴保持・offline成功。独立レビュー指摘なし。
- 詳細: docs/codex/release-v90.md。未公開、費用・個人情報の使用なし。

## 公開待ちの案内整備

- CHANGELOG.md の Unreleased にv90の閲覧位置保持と再読み込み時の挙動を記載。実機未確認・未公開を明記。
- アプリ変更なし。次はv90の公開承認後に配信確認。

## 診断テストの版固定値（AN-004）

- 84は単体テスト内の合成現行版、83は旧版拒否用と確認し、tools/check-form-diagnostics.jsへコメント追加。
- 現行リリース版はE2Eがversion.jsonから取得。診断単体検証と対象eslint成功。アプリ動作変更なし。

## 2026-10-01 ロードマップ照合

- docs/roadmap.mdに既存各項目の状態と根拠を追加。旧本文は履歴として保持。
- AN-002完了。v90は未公開、実射受入AN-001と公開承認が残る。
