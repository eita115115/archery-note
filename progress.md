# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- v94公開済み。承認後e4ec1abe6dd78aa18ccae703be2beee65988c2f5をmainへpush。
- 履歴ラウンド折りたたみ実装1e95918、公開候補5abc0baとruntime同一。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/app-quality。
- 元の作業場所の未コミット変更を保全。費用・個人情報の使用なし。

## 今回完了

- AN-035: 既存3間接依存の互換更新を隔離環境で準備・検証。xmldom0.9.12、brace-expansion5.0.12、ip-address10.7.2。
- lock279entriesの追加削除0、3entriesのversion/resolved/integrityだけ変更。package.json・親依存は不変。保存済み16advisoryの14件は候補版の対象範囲から外れる。
- 変更: package-lock.json、dependency-update.md、CHANGELOG、progress/tasks、履歴台帳。ローカルのみ、公開v94・アプリ・保存・採点・SWは不変。
- 共有node_modulesの対象版本・hidden lock hash不変。候補のinstalledはartifacts/dependency-update/sandboxに隔離したためrootのinstalledは旧lockのまま。

## 検証

- 隔離npm ci成功。3件のconsumer範囲内・registry integrity・installed/lock一致、plist2/SOCKS6/glob3850/brace6の旧新比較一致。
- 隔離check:all/lint成功、`Security regression: all 38 checks passed`、E2E `110 passed (1.1m)`、native-web21assetはアプリsourceとbyte一致。独立レビュー指摘なし。
- full npm auditはexit1/high4packages。ZIP2advisoryと親chain3件の影響を残す。major親Lighthouse13.5.0案は未検証・未実施。
- `npm run format:check`: `All matched files use Prettier code style!`、git diff --check成功。詳細: docs/codex/dependency-update.md、artifacts/dependency-update/。
- Pages36825162385/CI36825163421成功。Linux全体 `110 passed (1.2m)`、check:all/lint/format成功。
- 公開94/7candidate asset一致。Chromiumのラウンド開閉・得点分布・開始・44px/HUD・設定タッチスワイプ・offline保持/pageerror0成功。
- 公開Chromium/WebKit320/375pxの4ケースで合計34/stage順/詳細/絞込17/開閉保持/横はみ出しなし・架空7件と記録中1本のreload保持成功。公開画像を確認。
- 事前の実SW v93→94更新と配信server停止offlineは両ブラウザ320/375の4ケース成功。コピー21ファイルbyte一致、独立レビュー指摘なし。
- 詳細: docs/codex/release-v94.md、history-round-collapse.md、artifacts/release-v94/。

## 次と未解決

- 次: AN-036。今回の依存更新をmainへpushする承認後、remote再照合・CI/Pages・配信物不変・fresh警告状態を確認する。
- このworktreeのnode_modulesは元checkoutへのjunction。ここでinstall/update/ciを実行して共有先を変更しない。新規依存追加・新しい公開は承認条件を維持。
- 記録・確定・ページ拡大抑制・設定スワイプ・offlineの実機操作感は未確認。エンド確定について質問済み、回答待ち。
- 実射の射形判定・保存のAN-001は未完了。arrowCheck昇格・追加センシングは条件未達。
- remote警告はまだ未変更。ZIP2件は未解決、上流/installer経路または親major更新の再評価が残る。悪用再現やnative実行はしていない。
- 目標はactive。「界隈で最も愛されるアプリ」を達成したとは判定しない。
