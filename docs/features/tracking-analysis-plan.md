# 実装プラン: 全体改善 + トラッキング分析機能 (2026-07-02)

Codex 向け指図書。Claude (Fable 5) がリポジトリ全体（scripts/ 全9ファイル、sw.js、
index.html、tools/、docs/ の各計画書）を読んだ上で作成した。
実行は 1 タスク = 1 Codex run。各タスク末尾の `/goal` をそのまま貼って使う。

## 要件

現在の Archery Note（v1.0.0 / APP_VER 64 / schema:3）を全体レビューし、
(A) 品質・性能・データ保全の改善点を修正タスク化し、
(B) 分析タブを「カードの寄せ集め」から「フィルタ付きの時系列トラッキング分析」へ
発展させる設計図とタスク列を定義する。
`docs/infra/phase3-read-only-analysis-integration-plan.md` の制約に従い、
第一段階はすべて read-only（`archeryNote.v1` / schema:3 / 既存データ形状を変更しない）。

## 非目標

- ストレージ schema 変更・新永続フィールド（目標設定、`statsFilter` 永続化などは
  設計メモに留め、実装しない）
- IndexedDB 移行、OCR / pose / AI 資産、外部 CDN、archery-master の直接マージ
- Service Worker の更新戦略変更（skipWaiting 見直しは Phase 6 の別枠。
  本プランで触る SW はキャッシュ肥大バグの最小修正のみ、かつユーザー確認ゲート付き）
- 大規模 UI リデザイン（分析タブ内の再構成に限定）

## Open decisions（既定値で解決済み）

1. **「トラッキング分析」の定義** — 射位置トラッキング（カメラ等）ではなく、
   「時系列の成績トラッキング」：スコア/グルーピング/サイト値の推移、自己ベスト、
   条件別比較を、用具×距離×期間フィルタで見る機能とする。
   根拠: 既存データ（ends の着弾座標、sightMarks、wx/windDir、arrow.reason タグ）で
   read-only 実現でき、phase3 計画の安全候補リストと一致するため。
2. **新規計算コードの置き場** — 新ファイル `scripts/45-analysis-core.js`（純関数のみ、
   DOM/db グローバル直接参照なし）。40-analysis-physics.js は既に 880 行で
   計算と HTML が混在しており、これ以上足さない。
   新ファイル追加は index.html / sw.js / tools 3 種のマニフェスト更新を伴うため、
   登録だけの独立タスク（Task 2）に分離する。
3. **フィルタ状態** — `ui.analysisFilter` としてメモリ内のみ（phase3 で
   `settings.statsFilter` 永続化は delayed 指定のため）。
4. **リリース（version:bump）** — 機能タスクに混ぜない。ユーザー可視の変更が
   まとまった時点で `references/recipes.md` のリリース手順を別 run で実施。

## 現状確認（2026-07-02 に実施した調査）

- ブランチ: `wip/ui-history-sight-inline-styles`（main と同一コミット c3b7f130）。
- dirty: `tools/check-ui.js` に未コミット変更。`AGENTS.md` / `CLAUDE.md` /
  `docs/codex/codex-progress.md` / `docs/codex/integration-plan.md` / `docs/codex/codex-continue-prompt.md`
  は untracked（ledger の「committed」記述と食い違い → Task 0 で整合）。
- 構成: モジュールなしの連結スクリプト 9 本。グローバル `db` / `ui` / `view` を共有。
  分析タブは `renderAnalysis()`（50-record-view.js:402）が履歴系カード 8 枚を
  無フィルタで並べるだけ。
- 計算資産: `robustStats` / `momentStats`（20-scoring.js）、`trajectoryModel`(RK4) /
  `regressionAdvice` / `personalModel` / `sessionQuality` / `sessionMetrics`(キャッシュ付き)
  （40-analysis-physics.js）。`regress()` 等の回帰ヘルパーも既存。
- 検証コマンド: `npm run check:app` / `check:ui` / `check:pwa` / `check:storage` /
  `check:version` / `check:all` / `lint` / `format:check` / `test:e2e`。
- スクリプト一覧のハードコード箇所（新ファイル追加時に全部更新が必要）:
  `index.html`、`sw.js` の `APP_SCRIPTS`、`tools/check-app.js`、`tools/check-ui.js`、
  `tools/build-native-web.js`。
- 不変条件（AGENTS.md）: 矢円と線かみ判定の一致 / ユーザーデータ不削除 /
  iPhone 主フローの単純さ。

## Part A: 全体レビューで見つかった改善点

重要度順。それぞれ対応タスクを併記。

### A-1. [バグ・要ゲート] SW キャッシュの無制限肥大 → Task 8

`sw.js` の fetch ハンドラは成功した **すべての GET** を `cache.put` する。
`90-init.js` の更新チェックは `version.json?ts=<Date.now()>`、更新リロードは
`index.html?appv=<Date.now()>` と毎回ユニークな URL を作るため、キャッシュ
エントリが起動・更新のたびに 1 件ずつ無限に増える。長期利用端末でストレージを
浪費し、いずれ quota に影響する。修正は「検索クエリ付き、または ASSETS 外の
リクエストは put しない」の最小変更。SW は配信基盤なのでユーザー確認ゲート付き。

### A-2. [性能] robustStats / RK4 の重複再計算 → Task 6

`SESSION_METRIC_CACHE`（40-analysis-physics.js:505）があるのに、
`personalPhysicsCalibration`・`regressionAdvice`・`sessionGroupPoint`・
`openHistDetail`・`adviceFor`・`sessionsCsv` は `robustStats(s.ends.flat())` を
直接呼び、キャッシュを素通りしている。さらに `renderSight` → `adviceFor` →
`adviceModel` → `personalPhysicsCalibration` の連鎖で、セッション数×RK4
シミュレーション（最大5000ステップ）が 1 回の描画で走る。記録が 100 回を
超えると iPhone でタブ切替が目に見えて重くなる構造。分析タブ拡張の前提として
統計取得を `sessionMetrics()` 経由に統一し、`personalPhysicsCalibration` を
setupId + `db.updatedAt` でメモ化する。

### A-3. [テスト欠落] 数理コアのユニットテスト不在 → Task 1

検証は静的チェッカーと e2e スモーク 1 本のみで、`scoreAt`（線かみ）、
`robustStats`、`regress` 系、`windModel` に入出力テストがない。スコアリングは
このアプリの不変条件そのものであり、A-2 のリファクタや分析拡張の前に
「現在の出力を固定する」特性テスト（characterization test）を Node 製チェッカー
として追加する（依存追加なし、tools/ の既存パターンに合わせる）。

### A-4. [構造] 計算と HTML 生成の混在 → Task 2, 3

40-analysis-physics.js は純計算（`trajectoryModel` 等）と HTML 文字列生成
（`physicsCalibrationHtml` 等）が同居し、テストも再利用も難しい。新規の分析
計算は純関数専用の `scripts/45-analysis-core.js` に置き、`(rows, filter) → 数値`
の形に統一する。既存コードの移設は行わない（差分を小さく保つ）。

### A-5. [小バグ] サイトタブのヒーロー表示 → Task 7

`pageHeroHtml("sight")`（50-record-view.js:380）が `adv.lines[0].text` を参照して
いるが、`adviceFor` の lines は `html` プロパティしか持たないため、提案がある
場合も常にフォールバック文字列「調整あり」になる。方向（上下/左右）を要約した
プレーンテキストを出すよう修正。

### A-6. [データ保全・小] load() のガードが厳しすぎる → Task 9（任意・要ゲート）

`load()`（10-storage-native.js:25）は `d.sessions` が truthy の時だけ
`normalizeDb` に渡す。`sessions` キーを欠くが `setups` を持つ JSON（部分復元や
手編集バックアップ）が丸ごと破棄され blankDb になる。`normalizeDb` は欠損配列を
補うので、ガードを「オブジェクトであること」に緩められる。ストレージ読取経路
なのでフィクスチャ追加とセットで、独立タスクとして慎重に行う。

### A-7. [運用] 進行台帳の失整合 → Task 0

`docs/codex/codex-progress.md` 自身が「ledger は現状と乖離、要再整合」と宣言している。
また untracked の AGENTS.md 等を「committed」と記述しており事実と異なる。
どのタスクより先に docs-only で直す。

### A-8. [監視項目・タスク化しない] localStorage 容量

スナップショット 6 世代 + 本体で実質データの約 7 倍を localStorage に保持する。
現状の記録量では問題ないが、着弾座標付き記録が数百回規模になったら IndexedDB
移行（phase3 で delayed 指定）を再検討する。今は quota 失敗時のフォールバック
（snaps.pop() リトライ + toast）が機能していることを確認済み。

## Part B: トラッキング分析機能の設計図

### 全体像

```
[既存データ (schema:3, 変更なし)]
 sessions(ends[].{x,y,s,X,spot,reason,no}) / sightMarks / setups / settings
        │ read-only
        ▼
[Layer 1: 分析コア]  scripts/45-analysis-core.js（純関数・DOM/db 非依存）
  buildAnalysisRows(db)     … セッション → 正規化行（sessionMetrics 経由の st を含む）
  filterAnalysisRows(rows,f)… 用具×距離×ラウンド×期間
  aggregateByPeriod(rows,u) … 週/月バケット {回数, 本数, 平均, 平均RMS, 最高}
  movingAverage(pts,k)      … 移動平均（k=5 既定）
  personalBests(rows)       … (round×距離) 毎の最高合計/最高平均/X・10率と達成日
  conditionSplit(rows)      … 風あり/なし別の平均・中心バイアス・RMS
  reasonBreakdown(rows)     … arrow.reason タグ別の本数・平均点・平均ズレ
        │
        ▼
[Layer 2: 分析タブ UI]  renderAnalysis() 再構成（50-record-view.js）
  ① フィルタ帯（用具/距離/期間: 全期間・3ヶ月・1ヶ月）ui.analysisFilter（メモリ内のみ）
  ② KPI ストリップ（平均点+トレンド矢印 / 最新RMS / 自己ベスト）
  ③ スコア推移チャート（セッション平均の点列 + 移動平均線、既存スパークライン様式の SVG）
  ④ 自己ベストカード ⑤ 条件比較カード ⑥ 外れ理由タグ分析カード
  ⑦ 既存カード（グルーピング推移・得点分布・月間）をフィルタ連動に
        │
        ▼
[Layer 3: 将来・ゲート付き（本プランでは実装しない）]
  目標トラッキング（goals 永続化 = schema 4 移行設計が先）
  statsFilter 永続化 / CSV への分析列追加（CSV 契約テスト更新が先）
```

### 設計原則

- 派生値は描画時計算のみ。db への書き込みは一切なし（phase3 契約準拠）。
- 45-analysis-core.js の関数は `db` グローバルを読まず、引数で受ける。
  例外として `sessionMetrics()`（キャッシュ）は関数注入で受け取り、
  テスト時は素の `robustStats` を注入できる形にする。
- 1 画面 = iPhone 縦持ち・片手。フィルタはチップ UI（サイトタブの距離チップと同型）。
  詳細は `<details class="adv">` に畳む（既存の主フロー単純化ルール踏襲）。
- 空データ時は各カードが自然に消え、既存の empty 文言が出ること。

## タスク一覧

依存関係: 0 → 1 → 2 → 3 → 4 → 5、6 は 1 の後ならいつでも、7 は独立、
8・9 はゲート付きで最後。

### Task 0: 進行台帳の再整合（docs-only）

- 対象ファイル: `docs/codex/codex-progress.md`
- 変更範囲: Current Status / Phase Ledger / Next Task Detail を現リポジトリ
  （v1.0.0、APP_VER 64、untracked ファイルの実態、本プランの存在）に合わせ書き直し。
  Next task を本プランの Task 1 に設定。
- 範囲外: アプリコード、他 docs。
- 完了条件: git status の実態と台帳の記述が一致。本プランへの参照が入る。
- 検証: `npm run format:check`
- Stop conditions: アプリコードの変更が必要になったら停止。
- 依存: なし

### Task 1: 数理コアの特性テスト追加（test-only）

- 対象ファイル: 新規 `tools/check-analysis-core.js`、`package.json`（scripts に
  `check:analysis` 追加、`check:all` へ連結）
- 変更範囲: Node 単体で `scripts/20-scoring.js` と `scripts/40-analysis-physics.js` の
  純関数を読み込み（`check-storage-roundtrip.js` の既存ロード方式を踏襲）、
  以下を固定値アサート: `scoreAt`（線かみ境界: 円が線に触れる/触れない座標、
  triple の 6 点切り捨て、field の 6 点）、`robustStats`（外れ値 1 本を除外する
  既知データ、5 本未満の simple フォールバック）、`regress`/`robustLine`/
  `robustWeightedLine`（既知直線 + ノイズ）、`windModel`（向かい/追い/左から/巻き）、
  `sessionMetricSignature`（キャッシュキーの安定性）。期待値は**現在の実装の出力**を
  正とする（振る舞い固定が目的、仕様変更ではない）。
- 範囲外: scripts/ 本体の変更は一切なし。
- 完了条件: `npm run check:analysis` が pass。全アサートに失敗時メッセージがある。
- 検証: `npm run check:analysis` / `npm run check:all` / `npm run lint`
- Stop conditions: テストを書く過程で現行実装の明白なバグを見つけたら、
  修正せずテストを現行出力に合わせた上で報告のみ（修正は別タスク）。
- 依存: Task 0

### Task 2: scripts/45-analysis-core.js の登録（infra-only）

- 対象ファイル: 新規 `scripts/45-analysis-core.js`（"use strict" とファイルヘッダ
  コメントのみのほぼ空ファイル）、`index.html`、`sw.js`（APP_SCRIPTS）、
  `tools/check-app.js`、`tools/check-ui.js`、`tools/build-native-web.js`
- 変更範囲: 6 ファイルすべてのスクリプト一覧に 40 と 50 の間として追記。ロジックなし。
- 範囲外: sw.js のキャッシュ戦略・CACHE 名・その他の行。version:bump（リリース時に別途）。
- 完了条件: `check:all` が pass し、ローカルプレビュー（port 8741）でアプリが
  従来どおり起動する。
- 検証: `npm run check:all` / `npm run test:e2e`
- Stop conditions: sw.js で APP_SCRIPTS 配列以外の行を触る必要が出たら停止。
  tools/check-ui.js に未コミットのローカル変更があるため、`git status --short` で
  差分内容を確認し、無関係な変更は保持したまま一覧のみ追記。衝突する場合は停止して報告。
- 依存: Task 1

### Task 3: 分析コア純関数の実装（logic-only、UI 変更なし）

- 対象ファイル: `scripts/45-analysis-core.js`、`tools/check-analysis-core.js`（テスト追記）
- 変更範囲: 設計図 Layer 1 の 7 関数を実装。シグネチャ例:
  `buildAnalysisRows(sessions, setups, metricsFn)`（metricsFn には本番で
  `sessionMetrics` を渡す）、`filterAnalysisRows(rows, {setupId, dist, round, period, today})`、
  `aggregateByPeriod(rows, "week"|"month")`、`movingAverage(values, k=5)`、
  `personalBests(rows)`、`conditionSplit(rows, isWindyFn)`、`reasonBreakdown(rows)`。
  すべて引数のみに依存し、`db`/`ui`/DOM を参照しない。HTML を返さない。
  各関数に日本語 1 行コメントで役割と単位（cm / 点）を明記。
- 範囲外: renderAnalysis と既存カードの変更。CSV 出力。
- 完了条件: 各関数に最低 2 ケース（正常 + 空/欠損データ）のテストがあり pass。
  空配列・dist 未設定・faceType 混在で例外を投げない。
- 検証: `npm run check:analysis` / `npm run check:all` / `npm run lint`
- Stop conditions: 既存関数（robustStats 等）の変更が必要に見えたら停止
  （注入で回避するのが正）。
- 依存: Task 2

### Task 4: 分析タブ再構成 — フィルタ帯 + KPI + スコア推移チャート

- 対象ファイル: `scripts/50-record-view.js`（renderAnalysis と pageHeroHtml("analysis")）、
  `style.css`（必要最小のクラス追加）
- 変更範囲: `ui.analysisFilter={setupId:"",dist:"",round:"",period:"all"}` を ui に追加
  （メモリ内のみ・保存しない）。renderAnalysis を「フィルタ帯（チップ UI）→
  KPI ストリップ（平均点 + 直近5回移動平均との差の矢印 / 最新 RMS / 自己ベスト）→
  スコア推移チャート（セッション平均の点列 + 移動平均線、distTrendCard の SVG 様式を流用）→
  既存カード群（フィルタ後の ss を渡す）」へ再構成。計算はすべて Task 3 の関数を使う。
- 範囲外: 履歴タブ・サイトタブ。既存カードの内部実装。新カード（PB/条件/タグは Task 5）。
- 完了条件: フィルタ変更で全カードが連動。データ 0 件時に empty 表示。
  iPhone 幅（390px）で横スクロールが発生しない。既存カードの表示内容は
  フィルタ「すべて」の時に従来と同一。
- 検証: `npm run check:ui` / `npm run check:all` / `npm run test:e2e`、
  ローカルプレビュー（port 8741、モバイル幅）で目視確認
- Stop conditions: db への書き込みが必要に見えたら停止（フィルタ永続化は非目標）。
- 依存: Task 3

### Task 5: 自己ベスト・条件比較・外れ理由タグの各カード追加

- 対象ファイル: `scripts/50-record-view.js`（renderAnalysis 内のカード関数追加）、
  `style.css`（最小限）
- 変更範囲: ③自己ベストカード（round×距離毎: 最高合計・最高平均・X/10率・達成日、
  直近更新があれば強調）、④条件比較カード（風あり/なし: 回数・平均点・平均 RMS・
  中心バイアス差。どちらか 2 回未満なら非表示）、⑤外れ理由タグカード
  （`arrow.reason` 集計: タグ別本数・平均点・平均ズレ方向。タグ 5 本未満なら非表示）。
  すべて Task 3 の純関数を呼ぶだけの薄い HTML 層にする。
- 範囲外: 記録タブのタグ入力 UI。新しい永続フィールド。
- 完了条件: 各カードがフィルタ連動し、データ不足時は静かに消える。
  数値は cm/点の単位付き日本語表記（既存の `cmOffsetText` 様式）。
- 検証: `npm run check:ui` / `npm run check:all` / `npm run test:e2e`、モバイル幅目視
- Stop conditions: 表示に新しい永続データが必要だと判明したら停止。
- 依存: Task 4

### Task 6: 統計キャッシュの一本化とメモ化（性能）

- 対象ファイル: `scripts/40-analysis-physics.js`、`scripts/60-history-sight-view.js`
- 変更範囲: `robustStats(s.ends.flat())` を直接呼んでいる箇所
  （`personalPhysicsCalibration`・`regressionAdvice`・`adviceFor`・`sessionsCsv`・
  `sessionGroupPoint`・`openHistDetail`）を `sessionMetrics(s).st` 経由に統一。
  `personalPhysicsCalibration` の結果を `setupId + db.updatedAt` キーの Map で
  メモ化（上限 8 件）。出力値は変えない（純粋な計算経路の変更）。
- 範囲外: robustStats 自体のアルゴリズム。UI。CSV の列構成。
- 完了条件: Task 1 のテストが無変更で pass（= 出力不変の証明）。
  CSV 出力が変更前後で同一（手元で 1 回出力して diff）。
- 検証: `npm run check:analysis` / `npm run check:all` / `npm run test:e2e`
- Stop conditions: sessionMetrics のシグネチャ変更が必要になったら停止。
  出力が 1 箇所でも変わるならその場で停止し原因を報告。
- 依存: Task 1（テストがあること）。Task 2〜5 と並行可。

### Task 7: サイトタブのヒーロー提案テキスト修正（小バグ）

- 対象ファイル: `scripts/50-record-view.js`（pageHeroHtml の "sight" 分岐、380 行付近）
- 変更範囲: `adv.lines[0].text`（存在しないプロパティ）参照を廃止し、
  `adv.lines` の axis（"v"/"h"/"-"）から「上下調整あり」「左右調整あり」
  「上下・左右調整」「調整不要」のプレーンテキストを組み立てる。
- 範囲外: adviceFor 本体、他のヒーロー分岐。
- 完了条件: 提案がある時に方向入りの要約、提案なしの時「調整不要」が表示される。
- 検証: `npm run check:ui` / `npm run check:all`、プレビューで目視
- Stop conditions: なし（標準ルールのみ）
- 依存: なし（いつでも実行可）

### Task 8: SW キャッシュ肥大の最小修正【ゲート: 実装前にユーザー確認必須】

- 対象ファイル: `sw.js`（fetch ハンドラのみ）、`tools/check-pwa-update-flow.js`
  （必要なら期待値の追従）
- 変更範囲: `cache.put` の前に「同一オリジン かつ `url.search === ""` の GET のみ
  キャッシュする」ガードを追加。`version.json?ts=...` と `index.html?appv=...` の
  ユニーク URL 蓄積を止める。オフライン時のフォールバック
  （`caches.match(..., {ignoreSearch:true})`）は既にクエリ無視なので挙動維持。
- 範囲外: install/activate、skipWaiting/clients.claim 戦略（Phase 6 の別議題）、
  CACHE 名、version:bump（この修正を配布する時に別 run で実施）。
- 完了条件: 修正後もオフラインで起動できる（プレビューで SW 登録 → オフライン切替 →
  リロードで index.html が返る）。`check:pwa` pass。
- 検証: `npm run check:pwa` / `npm run check:all` / `npm run test:e2e` + 上記手動確認
- Stop conditions: **着手前にユーザーへこの変更の要旨を提示し承認を得る**
  （AGENTS.md: SW 変更は要確認）。fetch ハンドラ以外の変更が必要になったら停止。
- 依存: なし（ただし最後に回す。配布には version:bump run が別途必要）

### Task 9（任意）: load() ガード緩和 + フィクスチャ【ゲート: 実装前にユーザー確認必須】

- 対象ファイル: `scripts/10-storage-native.js`（load のみ）、
  `tests/fixtures/storage/`（sessions キー欠落フィクスチャ追加)、
  `tools/check-storage-roundtrip.js`（フィクスチャ検証の追従）
- 変更範囲: `if(d && d.sessions)` を `if(d && typeof d==="object" && !Array.isArray(d))`
  へ緩和し、normalizeDb に欠損補完を任せる。壊れた JSON・null・配列は従来どおり
  blankDb。sessions 欠落 + setups あり JSON が setups を保持することをフィクスチャで固定。
- 範囲外: save / normalizeDb / スナップショット / schema。
- 完了条件: 新フィクスチャ含め `check:storage` pass。既存フィクスチャの結果不変。
- 検証: `npm run check:storage` / `npm run check:all`
- Stop conditions: **着手前にユーザー承認を得る**（ストレージ読取経路のため）。
  normalizeDb 側の変更が必要になったら停止。
- 依存: Task 1 推奨

## リスクと順序の根拠

- 最初に Task 1（特性テスト）を置くのは、Task 6 の計算経路変更と Task 3 以降の
  分析拡張の両方が「現在の数理出力が正」という前提に立つため。テストなしで
  リファクタすると、スコアリング不変条件（矢円と線かみの一致）の破壊に気づけない。
- Task 2 を独立させるのは、スクリプト一覧が 6 ファイルにハードコードされており、
  登録漏れが「本番だけ白画面」という最悪の壊れ方をするため。ロジックゼロの diff で
  登録だけを検証する。
- Task 8（SW）と Task 9（ストレージ読取）は影響面が配信・データ保全そのものなので
  ゲート付きで最後。どちらも失敗時の被害が機能バグと桁違いのため、機能タスクと
  絶対に混ぜない。
- 各タスクはどこで止めてもアプリは出荷可能（Task 2 は空ファイル追加、Task 4 は
  フィルタ「すべて」で従来表示と同一、が保証点）。
- リリース: ユーザー可視の変更（Task 4/5/7 あたり）がまとまったら、別 run で
  `npm run version:bump` → `npm run check:version` → 公開確認（recipes.md のリリース手順）。

---

## Codex 貼り付け用 /goal 一覧

実行順: Goal 0 → 1 → 2 → 3 → 4 → 5 →（6, 7 は随時）→ 8, 9 はユーザー承認後。

```text
/goal
Task 0: docs/codex/codex-progress.md を現リポジトリ状態へ再整合する

Repo: C:\Users\eita2\Projects\archery-note
Read first: $archery-note を使用。AGENTS.md、docs/codex/codex-progress.md、
docs/features/tracking-analysis-plan.md（本プラン）、git log --oneline -10 の結果。

Requirement:
進行台帳 docs/codex/codex-progress.md が実態（v1.0.0 リリース済み、APP_VER 64、
AGENTS.md 等が untracked、Phase Ledger の古い記述）と乖離している。
Current Status / Phase Ledger / Next Task Detail を現状に合わせて書き直し、
Next task を docs/features/tracking-analysis-plan.md の Task 1 に設定する。

Change scope:
- docs/codex/codex-progress.md: 全面的な記述更新（docs-only）
Out of scope: アプリコード、他の docs、git commit の実施可否はユーザー指示に従う。

Done when:
- git status --short の実態と台帳の記述が一致している
- docs/features/tracking-analysis-plan.md への参照と Next task 設定が入っている

Validate:
npm run format:check

Stop and ask if:
- アプリコードの変更が必要になった場合
- The change requires edits not named above to storage schemas, migrations,
  backup formats, or the project's deployment-critical infrastructure.

Rules:
- Start with git status --short; preserve unrelated changes.
- Smallest useful diff; no unrelated refactors or formatting sweeps.
- Report honestly: what changed, validation pass/fail per command, risks,
  and what remains.
```

```text
/goal
Task 1: 数理コアの特性テスト tools/check-analysis-core.js を追加する

Repo: C:\Users\eita2\Projects\archery-note
Read first: $archery-note を使用。docs/features/tracking-analysis-plan.md の Task 1、
scripts/20-scoring.js、scripts/40-analysis-physics.js、
tools/check-storage-roundtrip.js（スクリプトの Node ロード方式の参考）。

Requirement:
scoring/分析の純関数に入出力テストがない。現在の実装の出力を「正」として固定する
特性テストを Node 製チェッカーとして追加する（依存追加なし）。対象:
scoreAt（線かみ境界・triple の 6 点未満切り捨て・field）、robustStats（外れ値除外と
5 本未満フォールバック）、regress / robustLine / robustWeightedLine、windModel
（向かい/追い/左から/巻き）、sessionMetricSignature。

Change scope:
- tools/check-analysis-core.js: 新規作成
- package.json: scripts に "check:analysis" を追加し check:all へ連結
Out of scope: scripts/ 本体の変更は一切禁止。

Done when:
- npm run check:analysis が pass し、各アサートに失敗時メッセージがある
- 期待値が現在の実装出力と一致している（仕様変更なし）

Validate:
npm run check:analysis
npm run check:all
npm run lint

Stop and ask if:
- 現行実装の明白なバグを見つけた場合（修正せず、現行出力でテストを固定して報告のみ）
- The change requires edits not named above to storage schemas, migrations,
  backup formats, or the project's deployment-critical infrastructure.
- A needed dependency is not already installed.

Rules:
- Start with git status --short; preserve unrelated changes.
- Smallest useful diff; no unrelated refactors or formatting sweeps.
- Report honestly: what changed, validation pass/fail per command, risks,
  and what remains.
```

```text
/goal
Task 2: scripts/45-analysis-core.js を作成し全マニフェストへ登録する（ロジックなし）

Repo: C:\Users\eita2\Projects\archery-note
Read first: $archery-note を使用。docs/features/tracking-analysis-plan.md の Task 2、
index.html、sw.js、tools/check-app.js、tools/check-ui.js、tools/build-native-web.js。

Requirement:
今後の分析純関数の置き場として scripts/45-analysis-core.js（"use strict" と
ヘッダコメントのみ）を作り、スクリプト一覧をハードコードしている 5 箇所すべてに
40 と 50 の間として登録する。ロジックは一切書かない。

Change scope:
- scripts/45-analysis-core.js: 新規（ほぼ空）
- index.html: script タグ追加（40 の後、50 の前）
- sw.js: APP_SCRIPTS 配列へ 1 行追加のみ
- tools/check-app.js / tools/check-ui.js / tools/build-native-web.js: 一覧へ追加
Out of scope: sw.js の他の行（キャッシュ戦略・CACHE 名）、version:bump。

Done when:
- npm run check:all が pass
- ローカルプレビュー（port 8741）でアプリが従来どおり起動する

Validate:
npm run check:all
npm run test:e2e

Stop and ask if:
- sw.js で APP_SCRIPTS 配列以外を変更する必要が出た場合
- tools/check-ui.js の既存ローカル変更と編集が衝突する場合（無関係な変更は保持する）
- The change requires edits not named above to storage schemas, migrations,
  backup formats, or the project's deployment-critical infrastructure.

Rules:
- Start with git status --short; preserve unrelated changes.
- Smallest useful diff; no unrelated refactors or formatting sweeps.
- Report honestly: what changed, validation pass/fail per command, risks,
  and what remains.
```

```text
/goal
Task 3: 分析コア純関数を scripts/45-analysis-core.js に実装する（UI 変更なし）

Repo: C:\Users\eita2\Projects\archery-note
Read first: $archery-note を使用。docs/features/tracking-analysis-plan.md の設計図 Layer 1 と
Task 3、scripts/40-analysis-physics.js（sessionMetrics / isWindy / regress）、
scripts/20-scoring.js（robustStats）。

Requirement:
read-only トラッキング分析の計算層として以下の純関数を実装する。すべて引数のみに
依存し、db / ui / DOM を参照せず、HTML を返さない:
buildAnalysisRows(sessions, setups, metricsFn) / filterAnalysisRows(rows, filter) /
aggregateByPeriod(rows, unit) / movingAverage(values, k=5) / personalBests(rows) /
conditionSplit(rows, isWindyFn) / reasonBreakdown(rows)。
metricsFn には本番で sessionMetrics を渡す想定（テストでは代替を注入）。

Change scope:
- scripts/45-analysis-core.js: 関数実装（単位: cm / 点を関数コメントに明記）
- tools/check-analysis-core.js: 各関数のテスト追記（正常 + 空/欠損の最低 2 ケース）
Out of scope: renderAnalysis と既存カード、CSV 出力、db への書き込み。

Done when:
- 全関数がテスト付きで npm run check:analysis pass
- 空配列・dist 未設定・faceType 混在入力で例外を投げない

Validate:
npm run check:analysis
npm run check:all
npm run lint

Stop and ask if:
- 既存関数（robustStats / sessionMetrics 等）の変更が必要に見えた場合（注入で回避が正）
- The change requires edits not named above to storage schemas, migrations,
  backup formats, or the project's deployment-critical infrastructure.

Rules:
- Start with git status --short; preserve unrelated changes.
- Smallest useful diff; no unrelated refactors or formatting sweeps.
- Report honestly: what changed, validation pass/fail per command, risks,
  and what remains.
```

```text
/goal
Task 4: 分析タブをフィルタ帯 + KPI + スコア推移チャートへ再構成する

Repo: C:\Users\eita2\Projects\archery-note
Read first: $archery-note と $frontend-design を使用。
docs/features/tracking-analysis-plan.md の設計図 Layer 2 と Task 4、
scripts/50-record-view.js の renderAnalysis / pageHeroHtml("analysis") /
distTrendCard（SVG 様式の参考）、scripts/60-history-sight-view.js の距離チップ UI。

Requirement:
分析タブを「フィルタ付き時系列トラッキング」へ再構成する。
ui.analysisFilter={setupId:"",dist:"",round:"",period:"all"} をメモリ内のみで追加し、
renderAnalysis を①フィルタ帯（チップ UI: 用具/距離/期間 全期間・3ヶ月・1ヶ月）
②KPI ストリップ（平均点+移動平均との差の矢印 / 最新RMS / 自己ベスト）
③スコア推移チャート（セッション平均の点列+移動平均線の SVG）
④既存カード群（フィルタ後の ss を渡す）の順に組み直す。
計算はすべて scripts/45-analysis-core.js の関数を使う。

Change scope:
- scripts/50-record-view.js: renderAnalysis 再構成、ui への analysisFilter 追加
- style.css: 必要最小のクラス追加
Out of scope: 履歴タブ・サイトタブ、既存カード関数の内部、フィルタの永続化
（db.settings へ書かない）、新カード（自己ベスト等は次タスク）。

Done when:
- フィルタ変更で全カードが連動し、0 件時は empty 表示になる
- フィルタ「すべて」時の既存カード表示が従来と同一
- iPhone 幅 390px で横スクロールが発生しない

Validate:
npm run check:ui
npm run check:all
npm run test:e2e
（ローカルプレビュー port 8741 をモバイル幅で目視確認）

Stop and ask if:
- db への書き込みが必要に見えた場合（read-only 契約違反）
- The change requires edits not named above to storage schemas, migrations,
  backup formats, or the project's deployment-critical infrastructure.

Rules:
- Start with git status --short; preserve unrelated changes.
- Smallest useful diff; no unrelated refactors or formatting sweeps.
- Report honestly: what changed, validation pass/fail per command, risks,
  and what remains.
```

```text
/goal
Task 5: 自己ベスト・条件比較・外れ理由タグの分析カードを追加する

Repo: C:\Users\eita2\Projects\archery-note
Read first: $archery-note を使用。docs/features/tracking-analysis-plan.md の Task 5、
scripts/45-analysis-core.js（personalBests / conditionSplit / reasonBreakdown）、
scripts/50-record-view.js の renderAnalysis（Task 4 適用済みであること）。

Requirement:
分析タブに 3 カードを追加する（すべて分析コア純関数を呼ぶ薄い HTML 層）:
①自己ベスト（round×距離毎の最高合計・最高平均・X/10 率・達成日）
②条件比較（風あり/なしの回数・平均点・平均 RMS・中心バイアス差。片側 2 回未満なら非表示）
③外れ理由タグ（arrow.reason 別の本数・平均点・平均ズレ方向。合計 5 本未満なら非表示）。
すべて ui.analysisFilter に連動させる。

Change scope:
- scripts/50-record-view.js: カード関数 3 つ追加、renderAnalysis の cards へ組み込み
- style.css: 必要最小のクラス追加
Out of scope: 記録タブのタグ入力 UI、新しい永続フィールド、CSV。

Done when:
- 各カードがフィルタ連動し、データ不足時は表示されない
- 数値表記が既存様式（cmOffsetText 等の日本語・単位付き）と揃っている

Validate:
npm run check:ui
npm run check:all
npm run test:e2e
（ローカルプレビュー port 8741 をモバイル幅で目視確認）

Stop and ask if:
- 表示のために新しい永続データが必要だと判明した場合
- The change requires edits not named above to storage schemas, migrations,
  backup formats, or the project's deployment-critical infrastructure.

Rules:
- Start with git status --short; preserve unrelated changes.
- Smallest useful diff; no unrelated refactors or formatting sweeps.
- Report honestly: what changed, validation pass/fail per command, risks,
  and what remains.
```

```text
/goal
Task 6: 統計計算を sessionMetrics キャッシュへ一本化しメモ化する（出力不変）

Repo: C:\Users\eita2\Projects\archery-note
Read first: $archery-note を使用。docs/features/tracking-analysis-plan.md の A-2 と Task 6、
scripts/40-analysis-physics.js（SESSION_METRIC_CACHE / sessionMetrics /
personalPhysicsCalibration / regressionAdvice / adviceFor / sessionsCsv）、
scripts/60-history-sight-view.js（sessionGroupPoint / openHistDetail）。

Requirement:
robustStats(s.ends.flat()) を直接呼んでいる箇所を sessionMetrics(s).st 経由へ統一し、
personalPhysicsCalibration の結果を setupId + db.updatedAt キーの Map でメモ化する
（上限 8 件）。目的は描画時の重複再計算（RK4 連鎖含む）の削減。
出力値は 1 箇所も変えないこと。

Change scope:
- scripts/40-analysis-physics.js: 呼び出し経路の置換とメモ化追加
- scripts/60-history-sight-view.js: sessionGroupPoint / openHistDetail の置換
Out of scope: robustStats のアルゴリズム、UI、CSV の列構成、sessionMetrics の
シグネチャ変更。

Done when:
- npm run check:analysis（特性テスト）が無変更で pass する
- CSV 出力（sessionsCsv）が変更前後で同一（手元データで 1 回 diff 確認）

Validate:
npm run check:analysis
npm run check:all
npm run test:e2e

Stop and ask if:
- 出力が 1 箇所でも変わる場合（その場で停止し原因を報告）
- sessionMetrics のシグネチャ変更が必要になった場合
- The change requires edits not named above to storage schemas, migrations,
  backup formats, or the project's deployment-critical infrastructure.

Rules:
- Start with git status --short; preserve unrelated changes.
- Smallest useful diff; no unrelated refactors or formatting sweeps.
- Report honestly: what changed, validation pass/fail per command, risks,
  and what remains.
```

```text
/goal
Task 7: サイトタブのヒーロー提案テキスト（存在しない .text 参照）を修正する

Repo: C:\Users\eita2\Projects\archery-note
Read first: $archery-note を使用。scripts/50-record-view.js の pageHeroHtml("sight")
（380 行付近）と scripts/40-analysis-physics.js の adviceFor（lines の形状確認）。

Requirement:
pageHeroHtml("sight") が adv.lines[0].text を参照しているが、adviceFor の lines は
{axis, html} しか持たないため常にフォールバック「調整あり」になる。
lines の axis（"v"/"h"/"-"）から「上下調整あり」「左右調整あり」「上下・左右調整」
「調整不要」のプレーンテキストを組み立てて表示する（HTML を innerHTML 由来で
流用しないこと）。

Change scope:
- scripts/50-record-view.js: pageHeroHtml の "sight" 分岐のみ
Out of scope: adviceFor 本体、他のヒーロー分岐。

Done when:
- 提案がある時に方向入りの要約、提案なし時「調整不要」がヒーローに表示される

Validate:
npm run check:ui
npm run check:all
（ローカルプレビュー port 8741 で目視確認）

Stop and ask if:
- The change requires edits not named above to storage schemas, migrations,
  backup formats, or the project's deployment-critical infrastructure.

Rules:
- Start with git status --short; preserve unrelated changes.
- Smallest useful diff; no unrelated refactors or formatting sweeps.
- Report honestly: what changed, validation pass/fail per command, risks,
  and what remains.
```

```text
/goal
Task 8【着手前にユーザー承認必須】: sw.js のキャッシュ無制限肥大を最小修正する

Repo: C:\Users\eita2\Projects\archery-note
Read first: $archery-note を使用。docs/features/tracking-analysis-plan.md の A-1 と Task 8、
sw.js、scripts/90-init.js（version.json?ts= と index.html?appv= の生成箇所)、
tools/check-pwa-update-flow.js、docs/infra/pwa-update-safety-checklist.md。

Requirement:
sw.js の fetch ハンドラが成功した全 GET を cache.put するため、
version.json?ts=<unix> や index.html?appv=<unix> のユニーク URL がキャッシュに
無限蓄積する。cache.put の前に「同一オリジン かつ url.search が空 の GET のみ
キャッシュする」ガードを追加する。オフラインフォールバックは既に
ignoreSearch:true なので挙動を変えないこと。

Change scope:
- sw.js: fetch ハンドラ内のキャッシュ保存条件のみ
- tools/check-pwa-update-flow.js: 期待値の追従が必要な場合のみ最小変更
Out of scope: install/activate、skipWaiting/clients.claim、CACHE 名、version:bump
（配布時に別 run で実施）。

Done when:
- ローカルプレビューで SW 登録 → オフライン切替 → リロードで index.html が返る
- npm run check:pwa が pass

Validate:
npm run check:pwa
npm run check:all
npm run test:e2e
（上記オフライン手動確認を含めて報告）

Stop and ask if:
- ★このタスクは着手前にユーザーへ変更要旨を提示し承認を得ること（SW 変更のため）
- fetch ハンドラ以外の変更が必要になった場合
- The change requires edits not named above to storage schemas, migrations,
  backup formats, or the project's deployment-critical infrastructure.

Rules:
- Start with git status --short; preserve unrelated changes.
- Smallest useful diff; no unrelated refactors or formatting sweeps.
- Report honestly: what changed, validation pass/fail per command, risks,
  and what remains.
```

```text
/goal
Task 9【着手前にユーザー承認必須・任意】: load() のガードを緩和し欠損キー
バックアップの取り込みを保護する

Repo: C:\Users\eita2\Projects\archery-note
Read first: $archery-note を使用。docs/features/tracking-analysis-plan.md の A-6 と Task 9、
scripts/10-storage-native.js の load / normalizeDb、tests/fixtures/storage/、
tools/check-storage-roundtrip.js、docs/infra/storage-migration-safety-checklist.md。

Requirement:
load() は d.sessions が truthy の時だけ normalizeDb に渡すため、sessions キーを
欠くが setups 等を持つ正当な JSON が blankDb に置き換わり実質破棄される。
ガードを「非 null オブジェクトかつ非配列」へ緩和し、欠損配列の補完は
normalizeDb に任せる。壊れた JSON・null・配列・プリミティブは従来どおり blankDb。

Change scope:
- scripts/10-storage-native.js: load() の条件のみ
- tests/fixtures/storage/: sessions キー欠落 + setups ありのフィクスチャ追加
- tools/check-storage-roundtrip.js: 新フィクスチャの検証追加
Out of scope: save / normalizeDb / スナップショット / SCHEMA_VER。

Done when:
- 新フィクスチャで setups が保持されることをチェッカーが検証して pass
- 既存フィクスチャの結果が不変

Validate:
npm run check:storage
npm run check:all

Stop and ask if:
- ★このタスクは着手前にユーザー承認を得ること（ストレージ読取経路のため）
- normalizeDb 側の変更が必要になった場合
- The change requires edits not named above to storage schemas, migrations,
  backup formats, or the project's deployment-critical infrastructure.

Rules:
- Start with git status --short; preserve unrelated changes.
- Smallest useful diff; no unrelated refactors or formatting sweeps.
- Report honestly: what changed, validation pass/fail per command, risks,
  and what remains.
```
