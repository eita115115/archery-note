# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

## 現在地

- 公開v98、main29979e261e93ffdfcdce224293283764e5641b7b。開発Lighthouse13.5.0更新を公開。CI36997200642/Pages36997199129成功、LinuxNode22.23.3、129 passed (2.8m)。全21appbytes/3toolfilesが承認sourceと一致。
- 作業場所 C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/cold-start-diagnosis。前goal turnはAN-054公開受入でprogress。今回AN-055起動診断: 同一tool/sourceのcold24reports完了、公開版/appbytesは不変。記録はローカルcommit。
- GitHubopen依存警告0、ZIP13/27はfixed（2026-10-02T10:45:08Z）、dismissなし。candidate audit0とCI cleaninstall found0も確認。一般的な安全性や攻撃検証を主張しない。
- 変更: docs/codex/cold-start-diagnosis.md、progress/tasks/台帳。24reportsの同条件/14script requests/errors/warnings、21input hashes/Git appcontent、14prototype AST/size/共有hiddenlock照合成功。診断helper/raw evidenceはartifacts/cold-start。アプリ/依存/版/worker変更なし。format:check `All matched files use Prettier code style!`、独立read-only review noP1/P2。AN-055done/evidence、55既存task IDs/acceptance保持。
- root node_modulesは元checkoutjunction/旧Lighthouse12、root install/update/ci禁止。owned lighthouse-upgrade sandboxに13.5。minimumWindows22.19の実LH baseline成功、LinuxCIは全check/E2EでLH benchmark未実行。
- 人間すべて承認は局所改善/依存更新/公開に継続。費用/個人情報不使用、採点/保存schema/画面/版markers/worker保全。詳細docs/codex/lighthouse-upgrade-publication.md。

## 次と未解決

- 次AN-056: 14scriptsの名前/順序/globalsを保つ配信用JS生成を実装し、生成物で全体/更新/offline/架空データ/mobile回帰と同条件gzip測定を確認する。元sourceは編集可能に保つ。診断試作はgzip body50887bytes (25.97%)減、interleaved3pairs LCP98.489–109.508ms減だが実iPhone/公開速度の保証なし。
- AN-055: 元localhelperのsimulated LCP中央値5173.879msとunthrottled observed117msを区別。Pagesは既にgzipで、raw→gzipは公開改善ではない。gzip→compact simulated448.669ms予測、DevTools blocked92.072ms/interleaved98.489ms中央値差を分離。14defer→90init render→onboarding経路を確認。n3/順序/WindowsHTTP1/CPU限界、ASTだけではapp回帰証明にならないことを記録。
- 実iPhone/keyboard/VoiceOver/5000実保存/INP、AN-001実射は未確認。LinuxLH実benchmarkも未確認。大目標active。
