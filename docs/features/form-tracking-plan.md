# 実装プラン: 射形トラッキング分析の前段 (2026-07-03)

Codex / Claude 向け指図書。長期目標「スマホでの射形（フォーム）トラッキング分析」へ
向けて、phase3 計画で delayed 指定されている pose / モデル資産のゲートを、安全に
開けるための設計と手順を定義する。`docs/features/tracking-analysis-plan.md`（v1.1.0 で完了）の
続編にあたる。

## 要件

iPhone のカメラで射形を撮影し、オンデバイスの姿勢推定（MediaPipe Pose Landmarker）
から射形の特徴量（関節角度・フェーズ時間）を抽出して、練習記録と並べて振り返れる
ようにする。本プランはその**前段**として、(A) ライセンス/資産方針の確定、
(B) `formAnalyses` を持つ schema 4 の移行設計、(C) 実現可能性プロトタイプ、
(D) 純関数の form コアまでを扱う。カメラ UI 本体と分析カードは後続プランで行う。

## 非目標

- クラウド送信・外部 API。**姿勢推定は 100% オンデバイス**とする
- 動画やランドマーク生ストリームの永続保存（保存するのは派生特徴量のみ）
- schema 4 移行の**実装**を本プランの docs タスクと同一 PR で行うこと
- Service Worker 更新戦略の変更（モデル資産のキャッシュ方針は決めるが、
  skipWaiting/claim には触れない）
- 複数人検出・動画アップロード解析・コーチング LLM 連携（将来検討）

## 前提（調査結果: 2026-07-03 確認）

- **モデルライセンス**: Pose Landmarker のモデル（BlazePose GHUM 3D）は
  モデルカードで **Apache License 2.0** と明記されている。本リポジトリも
  Apache-2.0 のため、モデルファイルの同梱・再配布はライセンス互換。
  - モデルカード: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf
  - 公式ガイド: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- **ランタイム**: `@mediapipe/tasks-vision`（npm, Apache-2.0）の WASM +
  `pose_landmarker_lite.task`（約 5〜6MB、float16）。lite/full/heavy の 3 種が
  あり、モバイルのリアルタイム用途は lite から始める
- 出力は 33 点の 3D ランドマーク。単一人物・オンデバイス・リアルタイム前提で、
  フィットネス用途が想定ユースケースに含まれる（射形解析はこの範囲）
- OSS 審査対応: 同梱時は `THIRD_PARTY.md` に出所 URL・バージョン・ライセンス・
  SHA-256 を記録すること（phase3 の provenance 要件）

## Open decisions（既定値で解決済み）

1. **姿勢推定エンジン** — MediaPipe Pose Landmarker (lite)。理由: Apache-2.0 で
   同梱可、オンデバイス、ブラウザ(WASM)/Capacitor 両対応、33 点で射形角度に十分。
   TensorFlow.js MoveNet は 17 点で肘・手首の向き解析に不足。
2. **資産の配置** — CDN 禁止（既存ルール）のため `assets/pose/` に自己ホスト。
   **SW の precache には入れない**（初回ロードを重くしない）。ランタイム
   キャッシュは現行 SW の「同一オリジン・クエリなし GET」規則で自然に
   キャッシュされる = 一度使えばオフラインでも動く。射場での利用に合致する
   ためこの挙動を意図として採用し、設定画面のストレージ表示に模型サイズを明記。
   2026-07-04 更新: 専用 POSE_CACHE（`archery-note-pose-v1`、cache-first、
   activate の旧バージョン掃除を生存）に変更。資産差し替え時は
   `archery-note-pose-v2` へ世代を上げる運用。
3. **保存するデータ** — 派生特徴量のみ（下記 formAnalysis 形状）。生動画・
   全フレームランドマークは保存しない。localStorage 容量（A-8 監視項目）を
   悪化させないため、1 記録あたり上限 2KB 目安に設計。
4. **機能フラグ** — `settings.formTrackingEnabled`（既定 false）。設定画面の
   詳細セクションから有効化。デフォルトの主フローは一切変えない。
5. **schema 4 の互換戦略** — 追加的変更のみ（`formAnalyses: []` の追加 +
   `SCHEMA_VER=4`）。旧アプリ(schema 3)が v4 バックアップを読んでも
   `normalizeDb` の `Object.assign` が未知フィールドを保持するため
   **後方互換・前方互換とも破壊なし**であることをフィクスチャで証明する。

## formAnalysis データ設計（schema 4 で追加）

```
db.formAnalyses: [
  {
    id: string,            // uid()
    date: "YYYY-MM-DD",
    ts: number,            // 記録時刻 (epoch ms)
    sessionId: string|null,// 紐付く練習セッション（任意）
    setupId: string|null,
    shots: number,         // 解析した射数
    modelVer: string,      // 例 "pose_landmarker_lite v1"
    appVer: number,        // 解析時の APP_VER
    fps: number,           // 実効フレームレート（品質指標）
    // 射ごとの派生特徴量（各射 ~10 数値、上限 24 射/記録）
    features: [{
      phase: {drawMs, anchorMs, releaseToFollowMs},  // フェーズ時間
      angles: {bowShoulder, bowElbow, drawElbow, drawShoulder,
               torsoLean, headTilt},                  // アンカー時の角度(度)
      release: {drawHandSpeed, elbowLineDeg},         // リリース品質指標
      confidence: number                              // ランドマーク可視性平均
    }],
    note: string
  }
]
```

- 角度は「アンカー静止区間の中央値」。フェーズ分割は手首/肘の軌跡速度から
  純関数で判定（form コアの責務）
- CSV 出力・JSON バックアップの**既存形式は不変**。formAnalyses は JSON
  バックアップに自然に含まれる（トップレベル配列が増えるだけ）

## アーキテクチャ

```
[カメラ] → [MediaPipe Pose (WASM, lazy-load)] → 33ランドマーク列（メモリ内のみ）
    → [scripts/46-form-core.js 純関数] フェーズ分割・角度抽出・要約
    → [formAnalysis レコード] → db.formAnalyses (schema 4)
    → [分析タブ: 射形カード]（後続プラン）
```

- `46-form-core.js` は 45-analysis-core.js と同じ規約: db/DOM 非依存・引数のみ・
  単位明記（度・ms）・Node 単体テスト可能
- MediaPipe のロードは動的 `import()`/script 注入で **フラグ有効時のみ**。
  起動バンドルと check-app の `new Function(scripts)` 検査を汚さない

## タスク一覧

依存: F1 → F2 →（F3 ‖ F4）→ F5。F0 は本ドキュメント（完了）。
F3 は資産追加のため、F5 はカメラ UI のため、それぞれ着手前ユーザー確認ゲート。

### Task F1: 実現可能性プロトタイプ（リポジトリ外・使い捨て）

- 対象: リポジトリ外の作業フォルダ（例 `~/Projects/pose-prototype/`）。
  リポジトリには成果レポート `docs/features/form-tracking-feasibility.md` のみ追加
- 変更範囲: 単一 HTML + `@mediapipe/tasks-vision`（プロトタイプに限り CDN 可）で
  iPhone Safari 実機を検証: ①横向き全身でのランドマーク安定性（弓・矢による
  隠れの影響）②実効 fps（15fps 以上か）③アンカー/リリースの識別可能性
  ④lite で足りるか full が要るか
- 完了条件: 上記 4 点の実測結果と GO/NO-GO 判定がレポートに残る
- 検証: iPhone 実機（LAN 経由、serve-iphone.ps1 の方式を流用）
- Stop conditions: NO-GO（fps<10 または弓による隠れで肘/手首が取れない）なら
  以降のタスクを保留しユーザーへ報告
- 依存: なし

### Task F2: schema 4 移行の設計とテスト先行（test/docs-only、実装なし）

- 対象ファイル: `docs/infra/storage-schema4-design.md`（新規）、
  `tests/fixtures/storage/archery-note-v1-form-analyses.json`（新規: schema 3 の
  データに未知フィールドとして formAnalyses を持たせた前方互換フィクスチャ）、
  `tools/check-storage-contract.js` / `check-storage-roundtrip.js`（フィクスチャ追加）
- 変更範囲: 設計 doc に「normalizeDb への formAnalyses:[] 追加」「SCHEMA_VER 4」
  「v3→v4 が冪等」「v4 バックアップを schema 3 実装が読んでも formAnalyses が
  保持される」ことの証明計画を書き、未知フィールド保持のテストを先に固定する。
  **アプリコードの schema 変更はしない**
- 完了条件: `npm run check:storage` pass。設計 doc が
  `docs/infra/storage-migration-safety-checklist.md` の全ゲートに1対1で答えている
- 検証: `npm run check:storage` / `npm run check:all` / `npm run format:check`
- Stop conditions: 既存フィクスチャの期待値を変えないと通らない場合は停止
- 依存: F1 が GO であること

### Task F3【ユーザー確認ゲート】: pose 資産の同梱と provenance 文書化

- 対象ファイル: `assets/pose/`（`pose_landmarker_lite.task` + tasks-vision の
  WASM/JS）、`THIRD_PARTY.md`（出所 URL・バージョン・Apache-2.0・SHA-256 追記）、
  `docs/features/form-tracking-assets.md`（取得手順の再現メモ）
- 変更範囲: 資産の追加と文書化のみ。ロジックなし。sw.js の ASSETS(precache) には
  **追加しない**
- 完了条件: `npm run check:all` pass、THIRD_PARTY.md に SHA-256 付きで記録、
  リポジトリサイズ増（~10MB）を PR 本文に明記
- Stop conditions: **着手前にユーザー承認必須**（リポジトリへの資産追加のため）。
  npm 依存を package.json に追加する必要が出たら停止（WASM/JS は静的コピーが正）
- 依存: F2

### Task F4: scripts/46-form-core.js 純関数 + テスト（カメラなし）

- 対象ファイル: 新規 `scripts/46-form-core.js`（＋5 マニフェスト登録:
  index.html / sw.js APP_SCRIPTS / check-app / check-ui / build-native-web）、
  `tools/check-analysis-core.js` または新規 `tools/check-form-core.js`
- 変更範囲: `landmarksToAngles(frame)`（33 点→関節角度）、
  `segmentPhases(series)`（速度ベースのフェーズ分割）、
  `summarizeShot(series)`（formAnalysis.features 1 射分）、
  `formQuality(features)`（confidence 集計）。すべて固定ランドマーク配列での
  単体テスト付き（実カメラ不要）
- 完了条件: 各関数に正常系 + 欠損系テストがあり pass。db/DOM 参照ゼロ
- 検証: `node tools/check-form-core.js` / `npm run check:all` / `npm run lint`
- Stop conditions: MediaPipe 本体の import が必要に見えたら停止
  （コアは純幾何のみが正）
- 依存: F1（角度定義の実測根拠）。F3 と並行可

### Task F5【ユーザー確認ゲート・後続プランで詳細化】: 撮影 UI + schema 4 実装

- 概要のみ: settings.formTrackingEnabled フラグ、カメラ許可フロー、
  ライブオーバーレイ、schema 4 移行実装（F2 の設計に従う）、分析タブの射形カード。
  F1〜F4 の結果を踏まえて `docs/features/tracking-analysis-plan.md` と同形式の
  タスク分解を別途作成する
- Stop conditions: 着手前にユーザー承認必須（カメラ許可 UI とストレージ移行実装）

## リスクと順序の根拠

- F1 を最初に置くのは、**弓と弦による上半身の隠れ**が pose モデルの学習分布外
  である可能性が唯一の技術的不確実性だから。ここが NO-GO なら以降の投資を
  すべて止められる
- F2（テスト先行の移行設計）を資産追加より先に置くのは、データ保全が
  このプロジェクトの最上位不変条件であり、schema 4 の互換性証明は
  カメラ機能と独立に進められるから
- 資産追加（F3）とストレージ実装（F5）は失敗時の影響が大きい順にゲートを付け、
  機能タスクと混ぜない（tracking-analysis-plan と同じ規律）
- プライバシー原則（動画非保存・オンデバイス処理・派生値のみ永続化）は
  すべてのタスクの stop condition に優先する
