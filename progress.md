# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- v94公開済み。承認後e4ec1abe6dd78aa18ccae703be2beee65988c2f5をmainへpush。
- 履歴ラウンド折りたたみ実装1e95918、公開候補5abc0baとruntime同一。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/app-quality。
- 元の作業場所の未コミット変更を保全。費用・個人情報の使用なし。

## 今回完了

- AN-034: 依存アラート16件の範囲を読み取り専用で確認。すべて開発用の間接依存、10 high/6 medium。
- PWA通常の記録・取込・履歴から対象4パッケージへの実行経路は見つからず。限定したコード/ビルド確認からの推論で、全体の安全性の証明ではない。
- native plist解析・SOCKS変換・browser ZIP展開・lint globの実callerと16件別の処置を記録。互換範囲の3パッケージ更新候補は14件に対応、extract-zipの2件は修正版報告なし。
- 変更: dependency-alert-exposure.md、既存intakeへの追記、progress/tasks、履歴台帳。公開v94・アプリ・保存・採点・SW・依存は変更していない。

## 検証

- `npm run check:security`: `Security regression: all 38 checks passed`。既存アプリ回帰であり上流ツールの脆弱性検証ではない。
- `npm audit --omit=dev --json`: exit0/0件。16件の開発用警告は解消していない。
- 保存API資料の16行・全development・installed/lock一致・PWA14script参照なし・node_modules追跡なしを検証。独立証拠レビューは指摘なし。
- `npm run format:check`: `All matched files use Prettier code style!`。git diff --check成功、passes:trueの全taskにevidenceあり。
- 詳細: docs/codex/dependency-alert-exposure.md、artifacts/dependency-alerts/。
- Pages36825162385/CI36825163421成功。Linux全体 `110 passed (1.2m)`、check:all/lint/format成功。
- 公開94/7candidate asset一致。Chromiumのラウンド開閉・得点分布・開始・44px/HUD・設定タッチスワイプ・offline保持/pageerror0成功。
- 公開Chromium/WebKit320/375pxの4ケースで合計34/stage順/詳細/絞込17/開閉保持/横はみ出しなし・架空7件と記録中1本のreload保持成功。公開画像を確認。
- 事前の実SW v93→94更新と配信server停止offlineは両ブラウザ320/375の4ケース成功。コピー21ファイルbyte一致、独立レビュー指摘なし。
- 詳細: docs/codex/release-v94.md、history-round-collapse.md、artifacts/release-v94/。

## 次と未解決

- 次: 既存3間接依存の互換更新をlockfile-onlyで準備し、隔離したインストールで確認。新パッケージ追加・無関係更新の混入を先に確認する。
- このworktreeのnode_modulesは元checkoutへのjunction。ここでinstall/update/ciを実行して共有先を変更しない。新規依存追加・新しい公開は承認条件を維持。
- 記録・確定・ページ拡大抑制・設定スワイプ・offlineの実機操作感は未確認。エンド確定について質問済み、回答待ち。
- 実射の射形判定・保存のAN-001は未完了。arrowCheck昇格・追加センシングは条件未達。
- 依存16件は未修正・未dismiss。ZIP2件は上流/installer経路の再評価が残る。悪用再現やnative実行はしていない。
- 目標はactive。「界隈で最も愛されるアプリ」を達成したとは判定しない。
