@AGENTS.md

# Claude 専用ルール

- 大きな作業は最初に `an-planner` でタスク分解する
- 実装は1回1タスク（`an-implementer`）。完了報告は `an-verifier` で独立検証してから受理する
- 完了を宣言する前に `evals/acceptance.md` の該当行を確認する
- 現在地は `progress.md` が正本。`docs/codex/codex-progress.md` は履歴台帳
- 公開（push ／ GitHub Pages 反映 ／ リリース）はユーザーの承認を得る
