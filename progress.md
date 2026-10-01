# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

最終更新: 2026-10-01

## 現在地

- 公開アプリv94。人間がAN-036既存3依存更新のmain反映を承認、公開検証中。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/app-quality。
- 分析フィルタ修正268b7967と記録15e2292はcodex/analysis-filter-focusに保全、この公開に含めない。
- 元checkoutの未コミット変更・共有node_modulesは保全。費用・個人情報の使用なし。

## 今回の公開対象

- AN-035で検証した既存3間接依存のみ。279entries追加削除0、package.json/runtime/versionはremote d734ea21と不変。
- 隔離sourceを公開ブランチへ再同期、更新installedとの一致/consumer比較成功。plist2/SOCKS6/glob3920/brace6の結果一致。
- check:all/lint/format成功、全体E2E110 passed (1.3m)。詳細: docs/codex/dependency-publication.md。
- Fresh公開前警告16件。保存14advisoryの範囲非該当はlocal結果で、remote解消は公開後に確認する。ZIP2件は未解決。

## 次と未解決

- AN-036: 承認範囲を維持してcommit/push、source指定CI/Pages、公開v94全asset不変とfresh警告を確認する。
- 分析修正の次版候補検証AN-041は修正branchのtasks/progressに記録。このbranchのAN-040 openは公開前の旧記録。合流時に証拠を保って整合する。
- AN-038: Lighthouse major/28新package追加には専用承認なし。既存3件push承認をその追加へ拡張しない。
- root node_modulesは元checkoutへのjunction、install/update/ci禁止。隔離installedはartifacts/dependency-update/sandbox。
- fullaudit high4packages/exit1はZIP2advisoryと親chain。仮majorのaudit0を実候補やremote解消と扱わない。
- 実機iPhoneでの操作感/VoiceOverは未検証。AN-001実射判定は未完了、arrowCheck昇格/追加センシング条件未達。
- 目標はactive。「界隈で最も愛されるアプリ」を達成したとは判定しない。
