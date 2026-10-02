# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

## 現在地

- 公開v98、main0db834550a49352e21f420af7037d4c832e4b4e6、CI36995025215/Pages36995023628成功。今回開発ツール変更は未公開。
- 作業場所 C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/lighthouse-upgrade-validation。前goal turnはAN-053公開でprogress。今回AN-038完了、local2218a1b58e5fd2f25cc999f5e9f99d37fa30af6b。
- Lighthouse13.5.0 reviewed graph適用、fresh隔離install259/Node22.19 officialSHA検証、CLI reporting明示false/版表示。全check/lint/format、129 passed (1.8m)、audit0、21v98内容/native実bytes/readiness98/shared lock一致。独立review P1/P2なし。
- 実baseline単発mobile/simulated初回welcomeでperf81、LCP5.1648s/observed132ms。実iPhone/INPや旧版比改善の証拠ではない。CRLF検証helper失敗/修正と限界はdocs/codex/lighthouse-upgrade-validation.md。
- 変更: package/lock開発依存、baseline helper、CONTRIBUTING、改善doc/review追記、progress/tasks/台帳。採点/保存schema/画面/版markers/worker不変。
- 人間すべて承認は局所改善/依存更新/公開に継続。費用/個人情報不使用。root node_modulesは元checkoutjunction・旧Lighthouse12、install/update/ci禁止。owned新sandboxだけ使用。

## 次と未解決

- 次AN-054: 承認済み開発ツール候補を普通pushしLinuxCI/Pages/Node22/全21public98bytes/警告状態確認。追加版bump不要。publicZIP13/27は未解決、候補audit0と区別。
- 続くAN-055: 同じLH13版/sourceでcold-start反復しcritical loading経路を診断。単発スコアから原因断定せず局所改善へ。
- 実iPhone/keyboard/VoiceOver/5000実保存/INP、AN-001実射は未確認。大目標active。
