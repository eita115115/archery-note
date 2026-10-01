# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- v94公開済み。承認後e4ec1abe6dd78aa18ccae703be2beee65988c2f5をmainへpush。
- 履歴ラウンド折りたたみ実装1e95918、公開候補5abc0baとruntime同一。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/app-quality。
- 元の作業場所の未コミット変更を保全。費用・個人情報の使用なし。

## 今回完了

- AN-037: 残るZIP2警告へのLighthouse13.5.0案を仮lock解決/公式sourceで調査。仮graphにextract-zipなし、監査0。
- ただし43entry追加/61削除/21変更、28新package名を含むmajor更新。Node>=22.19、CLI/reportingの実行検証が必要。承認前の適用・installはしていない。
- 変更: lighthouse-upgrade-review.md、dependency-updateへの追記、progress/tasks、履歴台帳のみ。実候補4f81bb0cのpackage*.json・shared環境・公開v94は不変。
- 実候補はAN-035の既存3件だけ。隔離installedはartifacts/dependency-update/sandbox、rootのshared installedは旧lockのまま。

## 検証

- 仮13.5.0解決はextract-zip不在、audit0/exit0、28新nameと43/61/21entry差分を確認。仮dirにnode_modulesなし、actual lock/shared hidden hash不変。
- 公式sourceでは現helperのCLI flagsとreport filenameを維持。13.5.0でのChrome起動・レポート・cleanup・最低Node実行は未検証。reportingは明示無効化が必要。
- 詳細: docs/codex/lighthouse-upgrade-review.md、artifacts/lighthouse-review/。書式・独立レビュー結果を同文書に記録。
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

- 次: AN-036。既存3件の依存更新をmainへpushする承認待ち。質問済み、返答なし。承認後remote再照合・CI/Pages・配信物不変・fresh警告状態を確認する。
- AN-038: major/28新dependency案は別の専用承認が必要。AN-036のpush承認をこの追加承認へ拡張しない。
- このworktreeのnode_modulesは元checkoutへのjunction。ここでinstall/update/ciを実行して共有先を変更しない。新規依存追加・新しい公開は承認条件を維持。
- 記録・確定・ページ拡大抑制・設定スワイプ・offlineの実機操作感は未確認。エンド確定について質問済み、回答待ち。
- 実射の射形判定・保存のAN-001は未完了。arrowCheck昇格・追加センシングは条件未達。
- actual/remoteのZIP2件は未解決。仮major案のaudit0を実候補の0やremote解消と扱わない。悪用再現やnative実行はしていない。
- 目標はactive。「界隈で最も愛されるアプリ」を達成したとは判定しない。
