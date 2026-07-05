# Storage schema 4 設計 (formAnalyses) — Task F2 (2026-07-03)

`docs/features/form-tracking-plan.md` Task F2 の成果。**設計とテスト固定のみで、
本ドキュメントに対応する schema 4 の実装はまだ行わない**（実装は F5、
着手前にユーザー承認が必要）。`docs/infra/storage-migration-safety-checklist.md`
の各ゲートに 1 対 1 で答える。

## 変更内容（実装時）

schema 3 → 4 は**追加のみ**の移行とする:

1. `SCHEMA_VER` を 3 → 4（`scripts/10-storage-native.js`）
2. `blankDb()` に `formAnalyses: []` を追加
3. `normalizeDb()` の配列補完リストに `"formAnalyses"` を追加
   （`["setups","sightMarks","sessions","trash","formAnalyses"]`）
4. 変更はこの 3 点だけ。既存フィールドの形状・意味・削除は一切なし

レコード形状は `docs/features/form-tracking-plan.md` の formAnalysis データ設計に従う
（派生特徴量のみ・動画/生ランドマーク列は保存しない・1 記録 ~2KB 目安）。

## 安全チェックリストへの回答

| ゲート（safety-checklist）            | 回答                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 冪等性                                | `normalizeDb` は現在も冪等（`checkNormalizeIdempotency` が全フィクスチャで検証）。追加する処理は「配列がなければ `[]`」のみで、2 回適用しても結果は同一                                                                                                                                                                                               |
| 二重実行での破損・重複なし            | 変換処理を持たない（読み時補完のみ）。重複挿入の経路が存在しない                                                                                                                                                                                                                                                                                      |
| 失敗時にデータを消さない              | 破壊的変換ステップ自体がない。`load()` 失敗時は従来どおり blankDb フォールバック（元データは localStorage に残る）。インポート前の安全スナップショット（`writeSafetySnapshot("import-before")`）も従来どおり                                                                                                                                          |
| JSON バックアップ/インポート/復元互換 | v4 バックアップは v3 に formAnalyses が増えただけの JSON。**v3 実装が v4 バックアップを読んでも formAnalyses は未知フィールドとして保持される**（`normalizeDb` の `Object.assign` が未知トップレベルを保持。今回追加した `archery-note-v1-form-analyses.json` フィクスチャで固定済み）。v4 実装が v3 データを読むと formAnalyses は `[]` に補完される |
| 未知/レガシーフィールドを落とさない   | 既存の partial-legacy フィクスチャ + 今回のフィクスチャで固定                                                                                                                                                                                                                                                                                         |
| dangling setupId の保持               | formAnalyses の `setupId` / `sessionId` は参照であって所有ではない。dangling でも削除しない（既存の sessions と同じ方針）。表示側が「用具未指定」相当で吸収する                                                                                                                                                                                       |
| sightMarks / sightV / sightH の保持   | 触れない                                                                                                                                                                                                                                                                                                                                              |
| active セッションを自動確定しない     | 触れない                                                                                                                                                                                                                                                                                                                                              |
| trash の形状維持                      | 触れない。formAnalysis の削除 UI を作る場合は trash type `"formAnalysis"` を追加する（F5 で設計）                                                                                                                                                                                                                                                     |
| 既存ストレージキーの可読性維持        | キーは `archeryNote.v1` のまま変更しない。schema 番号のみ 4                                                                                                                                                                                                                                                                                           |

## 禁止事項の遵守

実装 PR は次と**混ぜない**（checklist の Prohibited 準拠）:
Service Worker 変更 / 依存追加 / UI 大改装 / CSV 形式変更 / 派生分析値の
新規永続化（formAnalyses は「ユーザーが明示的に保存した射形記録」であり、
render 時に再計算可能な派生値ではない）/ pose モデル資産の同梱（F3 で別 PR）。

## テスト計画（本 PR で固定した分 + 実装時に足す分）

本 PR（test/docs-only）で固定:

- フィクスチャ `archery-note-v1-form-analyses.json`（schema 3 + 未知フィールド
  としての formAnalyses）
- `check-storage-contract.js`: normalizeDb 後も formAnalyses が形状ごと残る、
  冪等性（既存の全フィクスチャ横断チェックに自動包含）
- `check-storage-roundtrip.js`: JSON 往復後も formAnalyses が残る、
  CSV 出力の行数・ヘッダが formAnalyses の有無に影響されない

実装 PR（F5）で追加必須:

- v3 フィクスチャ → v4 normalize で `formAnalyses: []` が補完される
- v4 フィクスチャ → v4 normalize が冪等
- v4 バックアップ → v3 セクション抽出実装で読み、formAnalyses が保持される
  （後方互換の回帰テスト）
- `schema` の期待値を 3 → 4 に更新するのは実装 PR と同時（それまで
  既存チェッカーの `schema: 3` 期待は変更しない）

## ロールバック

- 実装後に問題が出た場合: v4 データは v3 実装でもそのまま読める（上記の
  前方互換）ため、アプリを前バージョンへ戻すだけでよい。データ変換の
  巻き戻しは不要
- `archeryNote.snapshots.v1` の安全スナップショットは従来どおり動作する

## リリース

実装 PR とは別に、通常のリリース run（version:bump → check:all → 公開確認）
を行う。チェックリストの Release Check コマンド一式を実行すること。
