# 現在の状態

> **このファイルが現在地の正本。** 40行以内に保つ。
> 長い経緯は `docs/codex/codex-progress.md`（履歴台帳）へ。

最終更新: 2026-09-02

## 現在地

- `main`: `feat/adaptive-release-detection`（73コミット）を統合し、**v85 として公開**
  （`APP_VER` / `version.json` / `sw.js` の `archery-note-v85` / `package.json 0.85.0` の4箇所を bump）
- 中身は射形診断まわりが中心（fix 20 / feat 10 / test 7 / docs 33、51ファイル）

## 完了したこと

- 射形診断ハンドオフ・適応的リリース検出・フィールド計測モーションの一連の作業を main へ統合
- ハーネス整備（2026-09-02）: `CLAUDE.md` を `@AGENTS.md` 形式へ、`AGENTS.md` に
  Source Of Truth / Acceptance / Safety / Handoff を追加、`evals/acceptance.md` 新設、
  現在地の正本を本ファイルへ移設、`docs/codex/codex-progress.md` を履歴台帳へ降格
- 統合前の検証: `npm run check:all` 全緑 / `npm run test:e2e` 83 passed

## 次にやること

- `tasks.json` の `status:"open"` を参照
- 統合済みブランチ `feat/adaptive-release-detection` をローカルで削除するか判断する

## 未解決

- 射形トラッキングの実使用フィードバック（検出率50%・分析データ消失・記録画面の自動スクロール）が未クローズ
- `docs/roadmap.md` が 2026-07-08 で停止しており、ゴールの正本が古い
- `npm run format:check` が `docs/superpowers/specs/2026-08-29-oss-motion-adoption-design.md` で警告

## 注意

- `settings` マージバグ（`normalizeDb()` L44）は全新機能の前提条件
- このリポジトリは **PUBLIC**。`main` への push は **GitHub Pages への公開＝リリース**。
  コードを変えたら `npm run version:bump` で4箇所のマーカーを同時に上げる
