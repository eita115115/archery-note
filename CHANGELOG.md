# Changelog

## Unreleased

- **観測性**: form-phase 非発火・取消パスにも `debug` を返却、`rec.formPhaseDiag` に集約保存（diagnostics ON 時のみ）。判定ロジック非変更 — release detection triage 2026-07-13 Plan-0
- **検出**: form-phase self-cancel に 2連続フレーム要件を追加（`pendingCancelFrames >= 2`）。単発 blur artifact による誤取消を防ぐ — release detection triage 2026-07-13 Plan-B (§3.2, §7.5 実測 93.8%救済)

## v1.8.0 - 2026-07-12

### Summary

**「今日の結果」**を追加しました。セッションを終えるたびに、前回との差・グルーピングの変化・自己ベストまでの距離・伸びの続き具合を、その場で1枚のパネルにまとめて表示します。過去の練習を履歴から開くと「この日の結果」として同じ振り返りができます。新しいデータの入力は一切不要 — いま記録しているスコアと着弾から自動で導き出します。

### Added

- **今日の結果（セッション終了時）**: 終了サマリに、(1) 前回（同じ距離・的）との得点差 (2) グルーピング（RMS）が締まったか広がったか (3) 同条件の自己ベストまであと何点か・更新したか (4) 得点/安定性の伸びが何日続いているか — を最大5行で表示。データが少ないうちは出せる行だけを表示し、初回は「基準ができました」の1行から始まります
- **この日の結果（履歴）**: 履歴タブから過去のセッションを開くと、その日時点のデータだけで同じパネルを再構成。「あの日は前の週よりこう変わっていた」を後から振り返れます
- 開発者向け: 純関数モジュール `scripts/49-todays-result.js` と専用チェック `check:todays-result`、E2Eテスト4本（計39本）

### Fixed

- ゲーミフィケーションの既定 OFF 補完を、破損したインポート/バックアップ（`settings.gamification` が `null` や非オブジェクトのケース）でも徹底（v1.7.1修正の追い打ち。通常起動での挙動変更なし）

### Not Changed

- 採点ロジック・保存形式・バックアップ/CSV 互換性・射形トラッキングのリリース判定しきい値・Service Worker 更新戦略
- 保存データへの追加なし（「今日の結果」はすべて既存の記録からの導出値で、端末内でのみ計算されます）
- ゲーミフィケーション（既定OFF）とは独立に動作します

## v1.7.1 - 2026-07-12

### Summary

v1.7.0 のフォローアップ修正。ゲーミフィケーションの既定と、屋外射場モードのダーク/自動テーマでのコントラスト回帰を直しています。既存の記録・保存データはそのままです。

### Fixed

- **ゲーミフィケーションの既定が誤って ON になっていた問題を修正**: v1.7.0 のリリースノートで「既定 OFF」と案内していましたが、実際には ON で出荷されていました。この修正以降にインストール/更新するユーザーは既定 OFF になります。既に v1.7.0 で有効化した方の設定はそのまま保持されます
- **射場モード（設定＞表示）をダークテーマまたはシステム設定が dark の auto で使ったときに、コントラストが逆に悪化していた問題を修正**: 見出しやサブ文字がほぼ読めない状態になっていました。dark / auto 各テーマの高コントラスト値を維持したまま射場モードが働くようにしました

### Added

- **屋外射場モード（設定＞表示）**: 直射日光下でも読めるよう、文字と得点チップのコントラストを AAA 相当まで引き上げるトグル。既定 OFF、ON で即時反映

### Not Changed

- 採点ロジック・保存形式・バックアップ互換性・射形トラッキングのリリース判定しきい値

## v1.7.0 - 2026-07-11

### Summary

初回起動オンボーディングと、練習継続のためのゲーミフィケーション（練習日ストリーク・フリーズ・12種バッジ・日次/週次/月次ゴール）を追加。ストレージ運用の安全対策として使用容量メーター・早期警告・保存領域の保護要求も入れました。ゲーミフィケーションは既定 OFF、既存ユーザーの操作・保存データはそのままです。

### Added

- **オンボーディング**: 初めてアプリを開いたときにウェルカム画面と「距離を選ぶだけ」のクイック設定（2画面）。距離を選ぶと的サイズと1エンド本数（18mのみ3本、他は6本）が自動で決まり、そのまま最初のセッションが始まります。「あとで設定」で従来のデフォルト（70m/122cm/6本）から始めることもできます。既存の記録があるユーザーには表示されません
- **機能発見ヒント**: 記録タブの上部に、使い始めの段階に合わせて1件だけ小さな案内バナーを出します（用具登録・分析・サイト調整・射形トラッキング・ホーム画面追加の順）。閉じるか案内先に移動すると、その案内は二度と出ません
- **ゲーミフィケーション（既定OFF、設定＞ゲーミフィケーションで有効化）**: 練習曜日を基準にした継続ストリークとフリーズトークン、12種のバッジ、日次/週次/月次のゴールリング。履歴タブの上部にストリークとゴールリング、分析タブの末尾にバッジ一覧が並び、セッション終了サマリではストリーク推移・フリーズ消費・新規解除バッジをその場で振り返れます
- **保存容量メーター**: 設定＞データに、いま使っている端末保存容量の目安を表示。使用率が80%を超えると練習終了時に「バックアップ保存をおすすめします」を一度だけ表示します（従来の「保存容量が足りません」は満杯後の事後警告だったため、その手前で気づけるようにしました）
- ブラウザ実行時のバックアップ節に「7日間アプリを開かないと保存データが消える可能性」の案内と「ホーム画面に追加」の推奨（対応環境のみ、ホーム画面から起動すると自動的に消えます）

### Changed

- 端末側で保存領域の保護（`navigator.storage.persist()`）を起動時に要求するようにしました。対応環境では設定＞アプリ情報に「保護された保存: 有効/未確定」として控えめに表示します。保存の書き込み経路自体は従来どおりです
- 安全スナップショット（万一に備えた自動バックアップ世代）を6世代から4世代に減らし、代わりに時刻が近い隣接世代を優先的に間引く選別に変更しました。最新・最古は常に保護され、実効容量が約1.5倍に改善します

### Fixed

- ゲーミフィケーションの起動時初期化で日付フィールドが文字列でない古い/破損したデータがあると、その後の描画が止まる可能性があった問題を修正
- バッジ解除日時が UTC 表示になっていた問題を修正（他画面と同じローカル日時に統一）
- 練習曜日を非常に古い日付にした場合、履歴タブの再描画が数百 ms かかることがあった問題を修正（判定範囲を過去5年にクランプ）
- オンボーディング後、ビューを切り替えるだけの起動で保存が発生し、安全スナップショット枠が意図せず消費される可能性を抑止
- インポート直後にリロードせず記録を続けた場合、輸入元の履歴を無視して「初矢」等の新規解除演出が誤発火する問題を修正（インポート時に同期バックフィルを実行）
- 古いスナップショットを復元すると、その時点で未解除だったバッジがバックフィルされずに欠落する問題を修正

### Not Changed

- 採点ロジック・保存形式・バックアップ/CSV 互換性・射形トラッキングのリリース判定しきい値・Service Worker 更新戦略
- 既存ユーザーの動作: ゲーミフィケーションは既定 OFF。オンボーディングは記録が1件でもある端末には表示されません
- arrowCheck の扱い（引き続き注釈のみ、自動取消なし）

## v1.6.3 - 2026-07-11

### Summary

保存動画の解析（リプレイ）が特定条件で無反応になる問題の修正と、実射検証（7/10）を受けた射形検出の内部改善。

### Fixed

- **リプレイ解析の無言フリーズを修正**: 動画フレームのタイムスタンプが重複した場合に解析エンジンが恒久停止し、画面が無反応になる問題。重複フレームをスキップし、万一のエラー時は日本語メッセージを表示して安全に停止します
- 短いホールド（350ms未満）の射で、矢の有無チェック（arrowCheck）のリリース前検出と安定性判定が構造的に機能しなかった問題。アンカー保持を基準にした判定に変更

### Changed

- レットダウン（引き戻し）の誤カウント対策: 骨格検出が途切れた区間をまたぐリリース判定に時間上限（150ms）を導入。急な引き戻しが1射として誤記録されるケースを抑制
- 射形検出の将来調整に向けた内部構造の整備（速度フィルタ・信頼度ゲートの土台。現時点では無効で、検出挙動への影響はありません）

### Not Changed

- 採点ロジック・保存形式・バックアップ互換性・リリース判定のしきい値。arrowCheck は引き続き注釈のみ（自動取消なし）

## v1.6.2 - 2026-07-10

### Summary

屋外での視認性改善と、練習中の画面消灯防止。実射検証（射形トラッキング）用の診断データ保存も追加。

### Added

- Screen Wake Lock: 記録セッション中とカメラ射形解析中に画面が自動消灯しなくなりました（対応ブラウザのみ、非対応環境では従来どおり）
- 射形トラッキングの検証用診断データ保存（設定 > 射形トラッキング > 「検証用の診断データ保存」、既定OFF）。実射検証でフレームレートや検出内訳を記録できます
- カメラ解析中にフレームレートが低い端末（15fps未満）で精度低下の警告を表示

### Changed

- 屋外（直射日光下）での視認性を改善: 矢マーカーの白縁を太く、得点チップの赤/青を濃く（白文字のコントラスト確保）、ミスチップ・矢番号・ライブ合計の色を調整

### Fixed

- 保存データの正規化で、新しい設定項目の既定値が既存ユーザーに補完されない問題を修正（今後の新機能の前提となる修正）

### Not Changed

- 採点ロジック・保存形式・バックアップ互換性。射形のリリース判定しきい値も変更ありません

## v1.6.1 - 2026-07-05

### Summary

射形トラッキング（ベータ）に「矢の有無」による発射/引き戻しの確認機能をシャドーモードで追加。

### Added

- リリース検出時に、両手首の間の矢の線をカメラ映像から検出し「矢: 発射と一致」「引き戻しの疑い（要確認）」の注釈を各射に表示（機械学習不要の軽量方式、1フレーム1ms未満）。この段階では表示のみで、射の記録を自動で消すことはありません。実射での検証後に自動取消へ昇格予定 (#111)

### Not Changed

- 射の検出・角度計算・保存形式。矢の判定が不確かな場合は注釈を出しません（誤った注釈より安全）

## v1.6.0 - 2026-07-05

### Summary

実機フィードバックへの対応と、射形トラッキング（ベータ）の作り直し。妥当性監査で見つかった問題を修正し、「自分基準の記録ツール」として再出発します。

### Changed

- **射形トラッキングを再設計**（ベータ・引き続き既定OFF）: エイミングから引き戻した動作（レットダウン）が1射として誤カウントされる問題を修正（リリース判定を瞬間速度ベースに変更、100ms〜2秒の引き戻しで誤検出ゼロを検証済み）。誤検出時の自動取消と、射ごとの手動削除ボタンを追加 (#109)
- 射形の評価を「エリート基準との比較採点」から「自分の記録との比較」に変更。撮影角度による測定誤差の限界を明記し、毎回同じ角度で撮ることを案内 (#109)
- 「信頼度」の表記を整理: 射形の骨格検出は「検出の鮮明さ」に改称し、グルーピングの演算/判断信頼度には算出根拠の注記を追加 (#108)
- タブや見出しの文字の太さを全画面で統一 (#108)
- ホーム画面アイコンをレティクル意匠に刷新 (#108)

### Fixed

- 得点記入中の連続タップで画面が拡大してしまう問題を修正 (#108)

### Not Changed

- 採点ロジック・保存形式・バックアップ互換性・Service Worker。射形の保存済みデータもそのまま残ります

## v1.5.1 - 2026-07-05

### Summary

デザイン言語 v2 による洗練アップデート。機能・データは一切変わりません。

### Changed

- 配色を刷新: 強調は黒/白の反転に統一し、金は下線やドットなど細部のアクセントだけに（黄土色っぽさを解消）(#104)
- 角丸を全体に引き締め、丸型（pill）ボタンを廃止。競技ツールらしい直線的なキレに (#104)
- タブや操作のアイコンを24pxグリッドの統一文法で全面再設計（レティクル・台帳・折れ線・サイトスケール・弓）(#105)
- 記録中の数値表示から黒いパネルを撤去し、画面の呼吸を改善 (#104)
- 見出しを小さなラベル様式に統一し、機能説明の文章を削減。各画面の主役（的・結論・提案数値など）が最初に目に入るよう調整 (#104, #106)

### Not Changed

- 全機能・操作・データ形式・採点ロジック・Service Worker

## v1.5.0 - 2026-07-05

### Summary

UI 全面リニューアル「Field Instrument」。射場に持ち込む精密な道具をコンセプトに、全5タブとモーダルを作り変えました。記録・採点・保存のロジックとデータ形式は一切変わりません。

### Changed

- **デザイン言語を刷新**: カーボン＋ゴールドの配色、計器風の数字表示（桁揃え）、スコアカード様式の罫線レイアウト。ライト/ダーク両対応 (#95)
- **記録画面**: 開始画面を「セッション票」に、記録中は的を最大化し、エンド・合計・残りの3値だけの大型表示に。操作ボタンは親指の届く画面下部へ。的タップの得点が着弾方向からエンド行に流れ込む演出を追加 (#97)
- **分析タブ**: 最上部に「今日の結論」— いま一番大事なことを平易な日本語で1行表示。各カードは「見出し→主数値→一言解釈→詳しく」の順で、専門語には必ず平易な言い換えを併記 (#98)
- **履歴**: 一覧を合計点が主役のスコアカード様式に。詳細は主役数値→着弾図→エンド表→分析→操作の順に整理 (#99)
- **サイト調整**: 「いまの提案」— 次に動かす方向とクリック数を最上部に大型表示。計算根拠は「詳しく」へ (#101)
- **用具・設定**: 機材台帳様式の一覧、設定は「アプリ情報/表示/データ/危険域」の4群に再編し、取り消せない操作を赤い区切りで隔離 (#100)
- 確認ダイアログをブラウザ標準からアプリ内デザインに統一、絵文字アイコンを専用 SVG アイコンに置換 (#96)

### Fixed

- モーダルを重ねて開いた際に Escape キーで背面のモーダルまで閉じてしまう問題を修正 (#96)
- 記録中に矢チップの列が下部の操作ボタンに隠れる問題を修正 (#102)

### Not Changed

- 採点ロジック・記録操作（1タップ記録・長押し微調整）・保存形式・バックアップ互換性・Service Worker

## v1.4.0 - 2026-07-04

### Summary

多距離ラウンド（WA1440・カスタムラウンド）対応と、記録操作の高速化・アクセシビリティ完成・データ品質強化をまとめた機能リリース。既存データはそのまま使えます。

### Added

- **多距離ラウンド**: WA1440（男子 90/70/50/30m・女子 70/60/50/30m）をラウンド選択から開始でき、「次の距離へ」でステージを進行（サイト値は台帳から自動プリフィル）。最終サマリと履歴・分析にラウンド合計・完了ラウンドの自己ベストを表示 (#93)
- **カスタムラウンド**: 設定から自分の練習ラウンド（距離・的・射数・エンド本数の組み合わせ）を定義可能 (#93)
- 未定義関数呼び出しを検出する静的チェック `check:globals`（開発者向け） (#87)

### Changed

- 記録操作（的タップ・微調整・理由タグ・矢番号入力）の保存を賢く間引き、記録が数百セッション溜まっていても1タップの重さを解消（画面を離れる時・アプリを閉じる時は必ず即保存） (#91)
- タップしにくかった小さなボタン（矢チップ・理由タグ・削除/編集ボタン）を44px基準に拡大 (#88)
- すべてのモーダル（結果・詳細・設定など）がスクリーンリーダーに正しく「ダイアログ」として伝わり、Escape キーで閉じ、背面に操作が抜けなくなりました (#92)
- 履歴・設定・射形画面のチップやリスト項目もキーボード・スクリーンリーダーで操作可能に (#90)

### Fixed

- バックアップ取込み時に混入し得る不正な座標データを取込み時点で正規化し、分析統計が壊れないよう防御を追加（既存の矢が消えることはありません） (#89)
- 分析タブのフィルタ操作のたびに全セッションの統計を再計算していた無駄を解消 (#89)

### Not Changed

- 採点ロジック（矢の円とラインカッター判定）、ストレージの保存形式・バックアップ互換性（新しいバックアップは古いバージョンのアプリでも読み込めます）

## v1.3.3 - 2026-07-04

### Summary

記録画面のアクセシビリティ改善。見た目・操作感の変更なし、schema・バックアップ形式の変更なし。

### Changed

- 記録画面の距離・期間・ズーム・矢のチップを本物のボタン要素に変更し、キーボードやスクリーンリーダー（VoiceOver 等）から操作可能に。タブバーとチップの選択状態も読み上げに対応（`aria-current` / `aria-pressed`）(#85)
- キーボード操作中に画面が再描画されてもフォーカス位置を維持（タッチ操作には影響なし）(#85)

### Not Changed

- 見た目はピクセル単位で従来と同一（変更前後のスクリーンショット一致を確認済み）
- タップ操作の挙動、ストレージ schema (v4) / バックアップ・CSV 形式、Service Worker

## v1.3.2 - 2026-07-04

### Summary

射形トラッキングの起動高速化。schema・バックアップ形式の変更なし。

### Changed

- 射形トラッキングの解析エンジン（約 15MB）を初回ダウンロード後は端末に保持し、2 回目以降の解析開始を高速化・通信量を削減（専用キャッシュ `archery-note-pose-v1`。アプリ更新後も保持される）(#83)

### Not Changed

- ストレージ schema (v4) / バックアップ・CSV 形式
- 射形トラッキング以外の通信・キャッシュ動作（本体はこれまでどおりネット優先で最新を取得）
- 射形トラッキング OFF のユーザーには何もダウンロードされない（従来どおり）

## v1.3.1 - 2026-07-04

### Summary

分析統計キャッシュの不具合修正と、三つ目的採点の回帰テスト拡充。schema・バックアップ形式の変更なし。

### Fixed

- 過去セッションの矢を編集した後も、分析・履歴・用具画面の統計が編集前の値のまま表示されることがある不具合を修正（座標合計が偶然一致するとキャッシュが更新されなかった。保存のたびに必ず再計算されるようにした）(#80)

### Added

- 三つ目的（縦 3 スポット）採点の回帰テスト: 「6 点未満は M」境界・ラインカッター・スポット割当・ドラッグ中のカッター表示経路をカバー。期待値は的の幾何から独立導出しており、現行の採点実装が正しいことの裏付けも兼ねる。採点ロジック自体の変更はなし (#81)

### Not Changed

- ストレージ schema (v4) / バックアップ・CSV 形式 / Service Worker の動作（キャッシュ名はバージョン更新のみ）

## v1.3.0 - 2026-07-04

### Summary

射形トラッキング（ベータ）の「活用」フェーズ第 1 弾。射形記録が、観測にもとづく日本語コーチングコメントと、練習得点との関係表示に変わる。schema・バックアップ形式の変更なし。

### Added

- 射形記録のコーチングコメント: 記録をタップすると「観測 → 原因候補 → 確認点 → 次の練習」の 4 区分コメントを表示（前回の記録との変化にも言及。断定を避けた表現）
- 射形×得点の関係カード: 射形記録を保存すると当日の練習セッションへ自動紐付けし、「リリース安定の日」と「ドリフト多めの日」の平均点差を表示
- 弓手肘トレンドのミニチャート（エリート基準 172° の参照線付き、3 記録以上で表示）
- 射形記録の詳細シート: 射ごとの角度・保持時間・リリース前ドリフトの ⚠ マーク、紐付いた練習の平均点

### Changed

- 射形コア `scripts/46-form-core.js` に純関数を追加: `formRecordStats` / `formRecordInsights` / `formTrendSeries` / `formScoreLink`(すべて単体テスト付き)

### Not Changed

- ストレージ schema (v4) / バックアップ / CSV 形式（自動紐付けは既存の `formAnalyses.sessionId` フィールドを使用）
- 射形トラッキング OFF 時の全動作、Service Worker

## v1.2.0 - 2026-07-03

### Summary

スマホカメラでの射形トラッキング（ベータ）を追加。姿勢推定は 100% 端末内で行い、映像・生ランドマークは保存せず、保存されるのは角度・保持時間などの派生特徴量のみ（ユーザーが明示的に保存した場合、1 記録あたり約 2KB）。機能フラグは既定 OFF で、有効化しない限り従来の動作は一切変わらない。

### Added

- 射形トラッキング（ベータ、設定から有効化）: カメラ + MediaPipe Pose Landmarker (lite) による骨格オーバーレイ、フェーズ表示（SETUP→DRAWING→ANCHORING→FULL_DRAW→RELEASE→FOLLOW）、リリース自動検出、1 射ごとの要約カード（弓手/引き手肘角度・保持時間・リリース前ドリフト）
- 分析タブの射形カード: 直近の射形記録（肘角度の中央値・保持・アンカー再現性）、記録の削除→ゴミ箱復元対応
- 純関数の射形コア `scripts/46-form-core.js`（実射検証済みの検出ロジック: 胴体長正規化・250ms 窓の離脱量ベースのリリース判定・ヒステリシス付きステートマシン）と単体テスト `npm run check:form`
- pose 資産の自己ホスト（`assets/pose/`、Apache-2.0、出所と SHA-256 は THIRD_PARTY.md / docs/form-tracking-assets.md に記録。CDN 不使用、機能有効時のみ遅延ロード）

### Changed

- ストレージ schema 3 → 4: `formAnalyses` 配列の追加のみ（docs/storage-schema4-design.md）。既存データの形状・意味は不変で、v4 のバックアップは旧バージョンのアプリでも読める（前方互換をフィクスチャで検証済み）
- 設定に「射形トラッキング（ベータ）」トグルを追加（既定 OFF）

### Not Changed

- ストレージキー `archeryNote.v1`、JSON バックアップ/復元、CSV 出力の形式
- Service Worker の更新戦略。pose 資産は precache に含めない（初回ロードを重くしない）
- 機能フラグ OFF 時の全動作

## v1.1.0 - 2026-07-03

### Summary

トラッキング分析の第一弾と、信頼性・性能の改善をまとめた最初の v1.x 機能リリース。分析タブが「用具 × 距離 × 期間」で絞り込めるトラッキング分析ビューになり、Service Worker のキャッシュ肥大とバックアップ読み込みのデータ保全バグを修正した。ストレージ契約は `archeryNote.v1` / `schema: 3` のまま変更なし。

### Added

- 分析タブのトラッキング分析ビュー: フィルタ帯（用具/距離/期間: 全期間・3ヶ月・1ヶ月）、KPI ストリップ（平均点 + 移動平均トレンド、最新/最小グルーピング RMS、最高合計）、直近 5 回移動平均つきスコア推移グラフ
- 新カード: 自己ベスト（距離 × ラウンド別）、条件比較（風あり vs 風なし）、外れ理由タグ分析（記録中のタグ別 平均点・平均ズレ方向）
- 純関数の分析コアモジュール `scripts/45-analysis-core.js`（db/DOM 非依存、単体テスト付き）
- 数理コアの特性テスト `tools/check-analysis-core.js` と `npm run check:analysis`（`check:all` に連結）: 線かみ境界、robustStats 外れ値除外、回帰、風モデル、統計キャッシュ署名を固定
- ストレージフィクスチャ `archery-note-v1-missing-sessions.json` と load() の不正入力チェック

### Fixed

- Service Worker が `version.json?ts=` / `index.html?appv=` などクエリ付きユニーク URL を毎回キャッシュに保存し、キャッシュが無制限に肥大する問題（同一オリジン・クエリなしの GET のみ保存するよう修正。オフライン動作は従来どおり）
- `sessions` キーを持たない正当なバックアップ JSON が読み込み時に破棄される問題（`load()` のガードを緩和し、欠損配列は normalizeDb が補完）
- サイト調整タブのヒーローが常に「調整あり」と表示され、提案方向（上下/左右/不要）が出ない問題

### Changed

- セッション統計の計算を `sessionMetrics` キャッシュ経由に一本化し、`personalPhysicsCalibration` をメモ化（履歴が多い端末でのタブ描画を軽量化。出力値は特性テストで不変を確認）
- 統計キャッシュの署名に座標和を追加し、矢の位置修正が確実にキャッシュを無効化するよう強化
- 既存の分析カード群（グルーピング推移・得点分布・月間サマリー等）が分析タブのフィルタに連動

### Not Changed

- ストレージ schema (`archeryNote.v1` / `schema: 3`)、JSON バックアップ/復元、CSV 出力の形式
- Service Worker の更新戦略（`skipWaiting()` / `clients.claim()`）

## v1.0.0 - 2026-07-02

### Summary

Archery Note の最初の安定公開版。v0.1.0 から v0.11.0 までの 11 回のチェックポイントで、OSS 品質基盤・CI・静的検査・分析ビュー・PWA 更新安全策・データ保護ガードを段階的に積み上げてきた成果を v1.0.0 として公開する。

### Highlights

- 得点・着弾・サイト調整・用具・履歴・分析を一つの PWA で管理
- オフライン対応、端末内保存、JSON バックアップ/復元、CSV 出力
- PWA 更新リロードは練習中・バックアップ/インポート/復元中に自動抑止
- ライト/ダーク/自動テーマ、モバイルファースト UI
- Apache-2.0 ライセンス、CONTRIBUTING/SECURITY/CODE_OF_CONDUCT 完備
- CI 品質ゲート: check:all (app/ui/pwa/storage/version)、lint、format、e2e、audit
- ストレージ互換性チェッカー (contract/round-trip) で既存データ保護を検証

### Journey (v0.1.0 → v1.0.0)

| Release | Milestone                                                    |
| ------- | ------------------------------------------------------------ |
| v0.1.0  | OSS readiness baseline                                       |
| v0.2.0  | Quality baseline (CI, lint, format, e2e, Lighthouse)         |
| v0.3.0  | Phase 3 safety baseline (storage contract/round-trip checks) |
| v0.4.0  | Read-only analysis baseline                                  |
| v0.4.1  | History/analysis UI organization                             |
| v0.5.0  | Analysis view baseline (dedicated tab)                       |
| v0.6.0  | Read-only score trend                                        |
| v0.7.0  | Read-only performance summaries                              |
| v0.8.0  | Storage migration safety (fixtures, checkers)                |
| v0.9.0  | PWA update safety (SW version/asset checks, cache cleanup)   |
| v0.10.0 | Safer update flow (isUpdateReloadBlocked, static checks)     |
| v0.11.0 | Active workflow guard (backup/import/restore busy guard)     |

### Not Changed

- No storage schema change from `archeryNote.v1` / `schema: 3`
- No backup/import/export/CSV format change
- No Service Worker strategy change
- No dependency changes beyond dev tooling
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

内部バージョン体系 (APP_VER / package.json) は PWA 更新検知用の連番であり、リリースタグのバージョンとは独立している。v1.0.0 以降の UI 改装は v1.1 以降で段階的に進める予定。

## v0.11.0-active-workflow-guard - 2026-07-02

### Summary

Closes the busy-guard gap left open by `v0.10.0-safer-update-flow`. The update banner and update reload path are now suppressed while a backup, export, import, restore, or trash-restore workflow is in progress, in addition to the existing active-session guard.

### Added

- Runtime-only active-workflow busy guard: `activeWorkflowCount`, `beginActiveWorkflow()`, `endActiveWorkflow()` in `scripts/90-init.js`
- Static checks in `tools/check-pwa-update-flow.js` for the new guard functions and for each guarded call site

### Changed

- `isUpdateReloadBlocked()` now returns true while `db.active` exists or `activeWorkflowCount>0`
- Backup/JSON export, CSV export, import, snapshot restore, and trash restore now call `beginActiveWorkflow()` / `endActiveWorkflow()` around their work
- `docs/pwa-safer-update-notification-flow.md` updated to describe the implemented guard and mark the busy-guard gap closed
- Bump app/package version markers to `63` / `0.63.0`

### Validation

- `node tools/check-version-alignment.js`
- `node tools/check-pwa-update-flow.js`
- `node tools/check-pwa-assets.js`
- `node tools/check-storage-contract.js`
- `node tools/check-storage-roundtrip.js`
- `npm run check:app`
- `npm run check:ui`
- `npm run check:pwa`
- `npm run check:version`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities
- Manual browser check: backup export click hides the update banner while the share/download is in flight and restores it once settled, with no console errors

### Not Changed

- No storage schema change, no new persisted fields (the busy flag is an in-memory counter only)
- No backup/import/export/CSV format change
- No Service Worker strategy change (`skipWaiting()`, `clients.claim()`, fetch strategy, `ASSETS`, cache marker format all untouched beyond the version-number bump)
- No waiting-worker or `controllerchange` UI
- No storage migration implementation
- No runtime app UI changes outside the update-banner suppression behavior
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

The busy guard is intentionally runtime-only (an in-memory counter, not persisted). A future storage migration implementation may reuse `beginActiveWorkflow()` / `endActiveWorkflow()` around its own work.

## v0.10.0-safer-update-flow - 2026-07-01

### Summary

Safer update flow release for Archery Note. This release documents the target update notification behavior, adds static checks for the current PWA update flow, and suppresses update prompts/reloads while an active session is present.

### Added

- Safer update notification flow documentation
- PWA update flow static checks
- Static checks for `version.json` no-store fetching, `APP_VER` comparison,
  `db.active` guarding, `registration.update()`, and `location.replace()` with
  `appv`
- Static checks that `controllerchange` / waiting-worker flow has not been
  introduced yet
- Static checks that `skipWaiting()` / `clients.claim()` remain present for the
  current release line

### Changed

- Centralize update reload blocking with `isUpdateReloadBlocked()`
- Keep update bar visibility gated by active workflow state
- Re-check update reload safety in the update click path before
  `registration.update()` or reload
- Prevent unsafe update clicks from reaching `registration.update()` or
  `location.replace()`
- Call `flushSafetySnapshot()` before the update reload path
- Bump app/package version markers to `62` / `0.62.0`

### Validation

- `node tools/check-version-alignment.js`
- `node tools/check-pwa-update-flow.js`
- `node tools/check-pwa-assets.js`
- `node tools/check-storage-contract.js`
- `node tools/check-storage-roundtrip.js`
- `npm run check:version`
- `npm run check:pwa`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No Service Worker implementation changes
- No `skipWaiting()` behavior change
- No `clients.claim()` behavior change
- No fetch strategy change
- No `ASSETS` change
- No cache cleanup logic change
- No waiting-worker update flow
- No `controllerchange` update UI
- No storage migration implementation
- No storage schema change
- No new persisted fields
- No localStorage or IndexedDB key changes
- No backup/import/export format change
- No runtime app UI changes
- No Analysis or History UI changes
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release keeps the existing PWA update mechanism but makes the reload path safer. The update prompt remains suppressed during active sessions, and update clicks now re-check safety before proceeding. Backup/export/import/restore-specific busy guards are not implemented in this release because there is no dedicated busy state yet.

## v0.9.0-pwa-update-safety - 2026-07-01

### Summary

PWA update safety release for Archery Note. This release documents PWA update safety requirements, strengthens Service Worker version and asset checks, and narrows cache cleanup behavior before changing the update notification flow.

### Added

- PWA update safety checklist documentation
- Service Worker version marker checks for package version, `APP_VER`, `version.json.v`, and `archery-note-vXX` cache marker alignment
- PWA asset list check for the hand-written Service Worker `ASSETS` list
- `npm run check:pwa`
- `check:pwa` integration into `check:all`
- Static guard for Archery Note cache prefix cleanup behavior

### Changed

- Narrow Service Worker activate-time cache cleanup to Archery Note-managed caches only
- Preserve unrelated caches during Service Worker activation
- Bump app/package version markers to `61` / `0.61.0`

### Validation

- `node tools/check-version-alignment.js`
- `node tools/check-pwa-assets.js`
- `node tools/check-storage-contract.js`
- `node tools/check-storage-roundtrip.js`
- `npm run check:version`
- `npm run check:pwa`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No PWA update notification flow change
- No `skipWaiting()` behavior change
- No `clients.claim()` behavior change
- No fetch strategy change
- No `ASSETS` change
- No storage migration implementation
- No storage schema change
- No new persisted fields
- No localStorage or IndexedDB key changes
- No backup/import/export format change
- No runtime app UI changes
- No Analysis or History UI changes
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release prepares the project for safer future PWA update changes. It does not change the update notification flow yet. The main runtime behavior change is limited to narrowing Service Worker cache cleanup so only Archery Note-managed caches are deleted during activation.

## v0.8.0-storage-migration-safety - 2026-07-01

### Summary

Storage migration safety release for Archery Note. This release strengthens
storage fixtures, round-trip checks, and migration readiness documentation
before implementing any storage migration.

### Added

- Storage fixture for sessions with dangling `setupId` references
- Storage fixture for `sightMarks` compatibility, including dangling setup
  references, missing distance, missing sight values, and session-side `sightV`
  / `sightH`
- Storage migration safety checklist documentation
- Normalize idempotency check across storage fixtures

### Changed

- Strengthen storage contract validation around dangling setup references
- Strengthen storage round-trip validation for sight marks and session sight
  values
- Bump app/package version markers to `60` / `0.60.0`

### Validation

- `node tools/check-version-alignment.js`
- `node tools/check-storage-contract.js`
- `node tools/check-storage-roundtrip.js`
- `npm run check:version`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No storage migration implementation
- No storage schema change
- No new persisted fields
- No localStorage or IndexedDB key changes
- No backup/import/export format change
- No runtime app code changes
- No Analysis or History UI changes
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release prepares the project for future storage migration work. It does
not implement migration behavior yet. The goal is to make future migration
changes safer by preserving existing data shapes, dangling references, sight
mark data, legacy fields, active sessions, and trash/restore behavior.

## v0.7.0-read-only-performance-summaries - 2026-06-30

### Summary

Read-only performance summaries release for Archery Note. This release adds
setup performance and sight history summaries to the Analysis view using
existing saved data only.

### Added

- Read-only `セットアップ別成績` card in the Analysis view
- Setup-based performance summary with record count, arrow count, average score,
  best total, and latest record date
- Read-only `サイト履歴` card in the Analysis view
- Recent sight history display with date, distance, vertical sight, horizontal
  sight, setup name, and source
- Safe handling for missing setup, deleted setup references, missing distance,
  and missing sight values

### Changed

- Continue separating History and Analysis responsibilities
- Keep History focused on lightweight record summary and practice history
- Keep Analysis focused on trend and performance summary reading
- Bump app/package version markers to `59` / `0.59.0`

### Validation

- `node tools/check-version-alignment.js`
- `npm run check:version`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No storage schema change
- No migration
- No new persisted fields
- No backup/import/export format change
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No docs other than this changelog entry
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

These summaries are read-only and use existing saved sessions, setup data, and
sight mark data only. They do not save derived analysis data or change
import/export compatibility.

## v0.6.0-read-only-score-trend - 2026-06-29

### Summary

Read-only score trend release for Archery Note. This release separates History
and Analysis responsibilities further and adds a small score trend card to the
Analysis view using existing saved session data only.

### Added

- Read-only `スコア推移` card in the Analysis view
- Recent saved-session trend display with date, average score, total score,
  distance, and arrow count
- Missing-distance handling as `距離未設定`

### Changed

- Move detailed distance, sight, and grouping summaries from History to Analysis
- Keep History focused on lightweight record summary and practice history
- Keep Analysis focused on trend and summary reading
- Bump app/package version markers to `58` / `0.58.0`

### Validation

- `node tools/check-version-alignment.js`
- `npm run check:version`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No storage schema change
- No migration
- No new persisted fields
- No backup/import/export format change
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No docs other than this changelog entry
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

The score trend is read-only and uses existing saved sessions only. It does not
save derived analysis data or change import/export compatibility.

## v0.5.0-analysis-view-baseline - 2026-06-29

### Summary

Analysis view baseline for Archery Note. This release introduces the first
dedicated Analysis view for read-only analysis navigation while preserving the
existing saved data format.

### Added

- Dedicated Analysis tab and view shell
- Analysis entry point in the bottom navigation
- App version marker bump to `57` / `0.57.0`

### Changed

- Move existing lower History analysis cards into the Analysis view:
  - Grouping trend
  - Distance average score trend
  - Score distribution
  - Monthly summary
- Keep History focused on practice summaries and the practice history list
- Update UI smoke checks for the five-tab bottom navigation

### Validation

- `npm run check:app`
- `npm run check:ui`
- `npm run check:storage`
- `npm run check:version`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No score trend addition
- No new analysis calculation
- No storage schema change
- No migration
- No new persisted fields
- No backup/import/export format change
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release is the first baseline for separating analysis from the History
screen. Future work should continue to add analysis features in small read-only
steps before any persisted data changes.

## v0.4.1-history-analysis-ui - 2026-06-29

### Summary

History analysis UI organization release. This release makes the read-only
analysis summaries added in `v0.4.0-read-only-analysis-baseline` easier to scan,
especially on mobile, without changing the saved data format.

### Changed

- Keep the main record/session summary visible in the initial History view
- Move distance, sight, and grouping summary details into a more
  compact/collapsible presentation
- Preserve existing read-only analysis values while reducing the amount of
  detail shown before the main practice history
- Align missing distance display around `距離未設定`
- Bump app version markers to `56` / `0.56.0`

### Validation

- `npm run check:app`
- `npm run check:ui`
- `npm run check:storage`
- `npm run check:version`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No new analysis feature
- No score trend addition
- No Analysis tab or subview
- No storage schema change
- No migration
- No new persisted fields
- No backup/import/export format change
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release is a small UI organization release after the read-only analysis
baseline. Future analysis work should decide whether to continue inside History
or move toward a dedicated Analysis tab/subview.

## v0.4.0-read-only-analysis-baseline - 2026-06-29

### Summary

Read-only analysis baseline for Archery Note. This release adds visible analysis
summaries based on existing session, distance, sight, and grouping data without
changing the saved data format.

### Added

- Read-only record/session summary
- Read-only distance summary
- Read-only sight summary
- Read-only grouping summary based on existing safe RMS values
- Viewport zoom policy documentation
- App version marker bump to `55` / `0.55.0`

### Analysis Details

- Session summary includes session count, arrow count, average score, latest
  record, and best total where safely available
- Distance summary includes distance, session count, arrow count, average score,
  best total, and latest record date
- Sight summary includes sight mark counts, practice sight value counts, latest
  sight values by distance, update date, vertical/horizontal sight values, and
  setup context where safely available
- Grouping summary includes target session count, average RMS, best RMS, latest
  RMS, and distance-level average RMS where safely available
- Missing or invalid distance values are grouped as `距離未設定`
- Missing or invalid values are safely displayed as `—`
- NaN and Infinity are guarded against

### Validation

- `npm run check:app`
- `npm run check:ui`
- `npm run check:storage`
- `npm run check:version`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No storage schema change
- No migration
- No new persisted fields
- No backup/import/export format change
- No Service Worker strategy change
- No dependency changes
- No CI workflow changes
- No archery-master direct merge
- No OCR / pose / AI / model files

### Notes

This release is the first visible read-only analysis baseline after the Phase 3
safety baseline. Future analysis work should continue to be split into small PRs
and should avoid persisted data changes unless covered by explicit migration
tests.

## v0.3.0-phase3-safety-baseline - 2026-06-28

### Summary

Phase 3 safety baseline for Archery Note. This release adds documentation and
automated checks that protect storage compatibility, backup/restore behavior,
CSV export behavior, and release/version marker alignment before future Service
Worker, storage migration, or archery-master integration work.

### Added

- Service Worker update strategy documentation
- Read-only analysis integration plan
- Storage contract fixtures for the current `archeryNote.v1` / `schema: 3`
- Storage contract checker
- Storage backup/restore/CSV round-trip checker
- Version marker alignment checker
- `check:storage`
- `check:version`
- `check:all` now runs app, UI, storage, and version checks

### Validation

- `npm run check:version`
- `npm run check:storage`
- `npm run check:all`
- `npm run format:check`
- `npm run lint`
- `npm run test:e2e`
- `npm audit --omit=dev`: 0 vulnerabilities

### Not Changed

- No storage schema change
- No Service Worker runtime change
- No app UI behavior change
- No version bump
- No package-lock change
- No archery-master merge
- No OCR / pose / AI / model files

### Notes For Future Integration

Future Service Worker, storage migration, analysis, or archery-master integration
work should build on these checks and remain split into small PRs.

## v0.2.0-quality-baseline - 2026-06-28

### Added

- README screenshots and asset provenance checks
- Local lint and format scripts:
  - `npm run lint`
  - `npm run format:check`
- Minimal Playwright smoke test with `npm run test:e2e`
- CI quality gates for:
  - `npm run check:app`
  - `npm run check:ui`
  - `npm run lint`
  - `npm run format:check`
  - `npm run test:e2e`
- Local Lighthouse baseline script with `npm run lighthouse:baseline`

### Baseline

- Current Lighthouse baseline:
  - Performance: 0.97
  - Accessibility: 0.93
  - Best Practices: 1.00
  - SEO: 1.00
  - PWA: n/a
- `npm audit --omit=dev`: 0 vulnerabilities
- Dev dependency audit warnings are known and limited to devDependencies.

### Not Changed

- No Service Worker update strategy change
- No storage migration
- No existing saved-data format change
- No archery-master integration
- No OCR, pose, AI, or model file changes

### Added

- Apache-2.0 license
- Community health files
- Minimal CI workflow
- Codex for OSS maintenance plan
- Third-party notices

### Changed

- README reorganized for public OSS users and contributors
- Viewport updated to allow browser zoom

### Fixed

- Accessibility checks reject zoom-disabling viewport settings
