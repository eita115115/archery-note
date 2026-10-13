# サイト記録の日時と最新値を監査する — AN089

基点258fa0bf90d1d3b922bdf1632279ace613f41c8d、公開v122/source2ce72647d10f2b1088ab7ea957e190b7a0139871。前turnはAN088公開・local330/CI330・更新offline検証の進捗。所有worktree/合成fixtureのみ、費用/個人情報不使用。今回の一タスクは監査、runtimeや保存形式を変更しない。

## 設計と判断

現行latestMark/台帳はdate降順+ts降順の先頭、補間はdate昇順+ts昇順の最後のfinite上下値。等しい日時ではstable sortの配列先頭/末尾が逆になり得る。即座にappend順へ統一、曖昧時に計算を保留、先に画面と全入力経路の証拠を採る3案を比較し、今回は証拠を採る。復元は末尾pushなのでappend順だけでは撮影/使用の新しさを推測できない。空欄は上下の未計測、左右だけの記録もあるため、全rowとfinite上下点の違いを分ける。

用具/練習開始/校正/予測の接続、過去値を信頼して振り返ること、完全local、日々の入力の4gatesを考慮。既存全承認/UI自由により追加承認は不要。brainstormingの設計比較を経てwriting-plansで以下を定義する。

## 実施と受入

1. 公開25資産と実Linux122のbyte一致を再確認、runtimeの正本を固定。台帳/latestMark/sightInterp/分析/全書込・復元入口をsourceで追う。
2. 同日別ts、同date/ts、日付だけ、日時なし、配列逆順、date優先、最新上下空欄/非数値/数値0/文字0、別用具/距離の合成caseを実アプリ関数で照合。計算結果と元配列不変を保存。
3. Chrome/WebKit320/375明暗/900で通常・同日時・欠落・最新上下空欄・0を描画。native入力/校正prefill、予測実測点、最新ラベル、旧6fields/reload/errors0、375原寸を保存。記録add/削除cancelも所有fixtureのみで確認。
4. 根本原因、正常との差、曖昧な履歴で推測できないこと、次の実装案/判断を文書化。app/CSS/数学/保存/採点/schema/deps/SW/tests/全markersが基点exact、旧88/acceptance/sharedhiddenlockをguard。今回のチェックはdocs format、同sourceCI330/更新offline証拠の再利用と新しい監査の区別を明記。raw/原寸PNGをbyte保持archive、受入後taskpass+evidence/progress/history/localcommit。

自己review: 計算修正/値の再保存/移行/新公開を含まない。timestamp欠落を絶対的な新旧へ推測しない。audit結果が次の一タスクを決める。

## 結果と根本原因

実Linux122/public25資産は今回の照合でもbyte一致。Chrome/WebKit各14case、48画面context、補足24の実表示context、復元/通常追加2context、可視0入力2contextを所有合成fixtureで確認した。通常画面48と実表示24は旧sessions/setups/sightMarks/active/customRounds/formAnalysesの6fieldsとreloadがexact、pageerror0。復元はmarksの配列順が変わるため、他5fieldsとmarksの全内容multisetを比較し、配列exactとは称さない。

| 条件                          | 台帳の最新 / 練習prefill | 補間の30m実測点 | 分析「最新」 | 判断                                                     |
| ----------------------------- | ------------------------ | --------------- | ------------ | -------------------------------------------------------- |
| 同日、A(ts100)=80→B(ts200)=90 | B / 90                   | 90              | 90           | 一致                                                     |
| 同日、B(ts200)=90→A(ts100)=80 | B / 90                   | 90              | 80           | 新旧が明確なのに分析がtsを無視                           |
| date/tsとも同じ、A80→B90      | A / 80                   | 90              | 90           | 新旧を決める情報が不足、stable sortの先頭/末尾が分かれる |
| date/tsとも欠落、A80→B90      | A / 80                   | 90              | 90           | 日付不明にも「最新」が出る。絶対的な新旧は不明           |
| 最新Bの上下が空欄、以前A80    | B / 空欄                 | 80              | 空欄         | 全記録の最新とfinite上下の最終実測は別の概念             |
| 最新Bが数値0                  | B / 0                    | 0               | 0            | 校正prefillは空、開始snapshotは「上下 —」になる          |

`renderSight`と`latestMark`はdate降順→ts降順の先頭。`sightInterp`は逆順に並べ、finiteな上下だけを距離別の辞書へ上書きする。同率ではstable sortが配列順を保つため先頭/末尾が逆になる。`sightSummaryHtml`は同日で「台帳」なら後の行を選び、tsを比較しない。こちらは日時が明確でも古い値を「最新」と表示する、再現可能な不具合。

native削除→設定から復元ではA80の内容をそのまま末尾へpushする。同日時の元[A80,B90]は台帳A80/補間90、復元後[B90,A80]は台帳B90/補間80へ変わる。記録の内容は全部同じ、両browserで再現。append順やUIDの文字順を実際の使用時刻と決めつける修正はできない。

通常の台帳追加・校正wizard・練習結果からの台帳追加・初期セットアップの4入口はいずれもdate/tsを保存し、restoreは元値のまま末尾push。normalizeDbはlegacyの欠落日時へ時刻を捏造しない。通常add95のnative保存では台帳/latestMark/補間が95で一致し、旧全marks/他5fieldsとreloadを保持した。

数値0は`openCalibrationWizard`の`mk.v || ""`と`recordSetupSnapshot`の`mk.v || "—"`で失われる。練習inputは`??`なので0を維持する。文字列"0"はtruthyなので校正にも残る。補足の実入力0はscrollして可視確認し、元のprefill viewport画像にはfieldが下に隠れている撮影制約と区別した。上下空欄・非数値から補間が過去のfinite値を使うことは今回「修正すべき全不整合」とは扱わず、その値の由来を利用者へ説明する設計判断を分ける。

## 検証と限界

原`rendered`はChrome12とWK320の2case成功後、numeric-zeroのanalysis visibilityで失敗して終了。元log/14結果/画像を保持。閉鎖済の元contextの回復とは扱わず、原因を断定しない。別`rendered-visible`は事前scroll/settle、実hit、閉状態→tap→open待機→値へscroll、厳密な80/90/0比較を追加し、全24完走。アプリ変更なし。

独立reviewで原matrixの同参照比較ではin-place mutationを見逃すと指摘。原28結果を保持し、別`matrix-corrected`の28caseでは代入前のJSON文字列と入力・一時db・元dbを比較して全て不変。48画面内のprobeは元から事前文字列比較だった。失敗や弱い証拠を成功した新証拠へ置き換えて隠さない。

今回runtime・CSS・数学・採点半径・保存/schema・SW・全markers122・依存・testsは基点258fa0bとexact。全330E2E/CI38326751775・更新/offlineは前AN088の同source2ce72647の証拠を再利用し、今回再実行したとはしない。今回の新しい必須commandはdocsのformat:check、加えてimmutable/source/旧88/acceptance/sharedlockのguard。物理phone/VoiceOver/実射/fieldINP/全入力バックアップ形状の網羅は未証明。

## 次の一タスク

まず分析「最新」が、同日でtimestampの新しい値を選ぶようにする。新旧が明確な逆配列/復元/異用具距離と通常順を回帰にし、台帳・prefill・補間と一致することを確認する。既存の同率/欠落・上下空欄の仕様はそのタスクで推測して書き換えない。その後に日時曖昧時のラベルと実測点の由来、数値0の校正/開始snapshotを別の範囲で改善する。監査は完了しても、発見した不具合は未修正、公開はv122のまま。

## 受入記録

AN089監査完了、branch codex/sight-order-audit、基点258fa0bf90d1d3b922bdf1632279ace613f41c8d、公開v122/source2ce72647d10f2b1088ab7ea957e190b7a0139871不変。実Linux/public25byte再一致。台帳/latestMarkはdate↓ts↓先頭、補間はdate↑ts↑の最後のfinite上下、分析summaryは同日台帳の後勝ちでtsを無視。同日別tsの逆配列で台帳/prefill/補間90に対し分析最新80を実表示で再現。同日時/日時なしでは台帳80対補間90、native削除復元でmarks内容multisetを保持したまま配列順と選択が反転。numeric0は実input/台帳/補間0だが校正空・開始snapshot—、文字0は保持。上下空欄/非数値の最新rowと古いfinite測定点の違いは別仕様と区別。通常4書込入口はdate/ts保存、restoreは末尾push、normaladd95はlatest/補間一致・旧5fields+旧marks/reload保持。ChromeWK14cases各28matrix、UI48、別可視24、restore-add2、visiblezero2でerrors0。通常UI48/可視24は旧6/reloadexact、復元はmarks順exactとは称さずmultiset+他5exact。独立readonlyreview Critical/Important/Minor0、app/CSS/数学/採点半径/保存/schema/deps/SW/版122/testsは基点exact、旧88tasks/acceptance/sharedhiddenlock保持。formatcheck成功。同sourceAN088の全330/CI38326751775/更新offlineは明示再利用、今回新実行としない。docs/codex/evidence/sight-order-audit-v122へ原失敗/補強raw/原寸PNG/viewed8/source/hashをbyte保持archive。費用/個人情報不使用、大目標active、local監査notesのみ。物理phone/VoiceOver/fieldINP/実射は未証明、発見不具合は未修正。

原renderedはChrome12+WK2成功後numeric-zero analysis visibility fail、元context閉鎖済/原因未断定、raw保持。別可視24は事前scroll/settle・実hit/open待ち・厳密80/90/0assertで成功、app変更なし。原matrixの同参照比較はin-place変化を見逃すと独立review指摘、原28を保持し別補強28は代入前JSON文字列/入力/一時db/元dbの不変を確認。prefill原viewportはfieldが下に隠れ、別2はscrollしinput0とsnapshot—を可視確認。source探索で存在しない旧physics/checkファイル名を一度参照したが現正本へ解決しapp変更なし。
