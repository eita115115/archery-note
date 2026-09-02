# 現在の状態

> **このファイルが現在地の正本。** 40行以内に保つ。
> 長い経緯は `docs/codex/codex-progress.md`（履歴台帳）へ。

最終更新: 2026-09-02

## 現在地

- `main`: `3b4f3b22`（PR #133 / Build Week growth coach をマージ済み）
- **作業の本体は手元のブランチ `feat/adaptive-release-detection` にあり、`main` より 73 コミット先行**。
  このブランチは origin に無く、公開もしていない。統合の可否は未判断

## 完了したこと

- ハーネス整備（2026-09-02）: `CLAUDE.md` を `@AGENTS.md` 形式へ（散文の委譲は実際には
  読み込まれていなかった）、`AGENTS.md` に Source Of Truth / Acceptance / Safety / Handoff を追加、
  `evals/acceptance.md` を新設、現在地の正本を本ファイルへ移設、
  `docs/codex/codex-progress.md` を履歴台帳へ降格

## 次にやること

- `tasks.json` の `status:"open"` を参照

## 未解決

- `feat/adaptive-release-detection`（73 コミット）を `main` へ統合するか未判断（`tasks.json` AN-003）
- `docs/roadmap.md` が 2026-07-08 で停止しており、ゴールの正本が古い
- 射形フェーズ判定の実射体感検証が未実施（v1.10.0 で根本修正済み）

## 注意

- `settings` マージバグ（`normalizeDb()` L44）は全新機能の前提条件
- このリポジトリは **PUBLIC**。push / GitHub Pages 反映 / リリースはユーザー承認が必要
