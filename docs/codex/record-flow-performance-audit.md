# 記録フローの性能と操作性を測る — AN077

前回AN076は公開112/source `6dabcff6ab73996e71693da348a271c9e1659cff` の表示修正と公開検証まで完了。今回の基点notes `4135db461f318bb56be7dcb2eca8f540868dbff5`、所有worktree/branch codex/record-flow-audit。一小タスクとして計測だけ行い、アプリの変更・版更新・再配信を混ぜない。全承認継続、費用・個人情報を使わない。

## 測定計画

実CI38158744620のLinux112配布物を所有HTTPプレビューで動かす。実公開25資産とのbyte一致を再確認する。所有架空履歴3件と5000件（6本/件）を用い、Chrome/WebKit ×320/375 ×通常/抑制motion ×履歴2条件を2回ずつ、計32経路を測る。追加でChrome375抑制motionをCPU4倍条件、公開Chrome320/375抑制motionの新contextでも確認する。CPU条件は物理iPhoneと同等としない。

操作はnative touchで開始→中心矢→選択→右微調整3回→解除→次矢→エンド確定→中心矢→終了。アプリの実handler、採点関数と同じラインカッター、保存済み座標/得点、旧履歴全件の一致とreloadを確認する。画面geometry/五点hit/横overflow、イベントから2回目rAFまでの時間、イベント処理とlong-task（対応engineのみ）、frame gapを採る。操作前の読み位置調整を記録し、測定値へ混ぜない。原寸代表320/375画像と生JSON/失敗出力を保存する。

2回目rAFは描画機会までの実験上の指標で、実際の画面描画やフィールドINPとは呼ばない。PerformanceObserver対応は実行時に判定し、未対応を0件と扱わない。直列測定にし、外部CPU負荷/OS/desktop engine/少数反復の限界を明記する。5000件は所有の架空データであり実ユーザーの履歴・保存容量の保証ではない。

## 判断と受入

根拠のない性能改修はしない。遅い操作があれば、履歴量/CPU/motionの差で再現範囲を絞り、別の診断probeでinclusive処理時間を取り（通常計測と混ぜない）、次の最小改善候補を示す。原寸画像で操作の重なりも確認する。アプリ/source/数学/保存schema/依存/SW/markers112/旧76taskobject/全acceptance/共有hiddenlockを保持する。

今回の変更は監査文書・架空の計測証拠だけ。既存同sourceのAN076全272 E2E/checkall/lint/CIを明示して再利用し、新しい全面テスト実行と呼ばない。新文書のformat:checkとinvariants、実測harnessを検証し、証拠を確認後だけAN077pass＋非空evidence、progress/ledgerを更新する。大目標active、実iPhone/VoiceOver/実射/フィールドINP/GPU/WKstrictOffline/旧閉鎖profile回復は未証明。

## 初期観測と診断の予測

最初のChrome320通常motionは終了のtrusted click capture時刻とrAF callback引数の差が履歴3件45.5ms、5000件227.9ms、後者の終了windowに234ms long task。このclock差は後でelapsedとして不適切と分かったため、正値も含めて経過時間の比較から除外する。元rawを改変せず保持し、下記予測を立てた経緯としてのみ残す。

1. 終了時のPB/成長/当日結果の履歴走査。予測: 同履歴量の開始/エンド確定より終了が遅く、別profileで当日結果計算とその子のinclusive時間が増える。
2. 同期の全DB保存・安全snapshot。予測: 履歴量を増やすと終了以外の同期save操作も遅くなり、writeDbNow/保存子処理が大部分を占める。
3. 結果HTML/DOM配置とmotion。予測: 計算よりrender/openModal/layout側の時間が増え、通常/抑制motionでframe gapや2回目rAFが大きく変わる。

matrixは無改造handlerで先に完走させる。profileは別所有contextで一つずつ関数を包んだinclusive時間（親子は重複する）を測り、matrixの絶対時間やspeedupへ混ぜない。app改修は別runへ回す。

## 計測器のレビューと時計の訂正

requesting-code-reviewに従うreadonly reviewerは固定review-bundle.jsonの4本を検査。Criticalなし、Important: profileのpushSafetySnapshotは存在せずidle実行のwriteSafetySnapshotを計測できない。実行前に実名へ修正、全required関数をassertし、snapshotPending/jobが完了して本体calls>0まで観測する。Minor: 起点はtrustedイベントのcapture開始で入力待ち時間を含まない。入力座標は観測値の保存/reloadとnudgeのx差+0.6の証拠に限定し、中心精度/y不変の独立証明としない。

元CPU4-r1のarrow1/arrow3の非primary clickでsupplied timestamp差が-8.8/-0.7ms。採用pointerupは非負でも、callback引数は実行時の時計と同じではないため元の正値もelapsed比較へ使わない。reviewerの追加検査もこの扱いを支持。元38を完走・保存し、全38同条件を別corrected directoryでcallback内performance.nowによる非負elapsedへ訂正して再測定する。補足だけで全条件測定を完了扱いしない。元run/原データを置換せず、観測timeoutで再起動したのでもない。

訂正後のelapsedもcapture開始→第2rAF callback実行で、入力待ち/実paint/フィールドINPではない。Chromium EventTimingは同名かつstartTimeとnative eventTimeが2ms以内のentryだけを照合し、threshold16msでentryなしを0msとはしない。関数profileはさらに別実行に分ける。アプリ自体は変更しない。

## 原寸画像で確認した表示の問題

訂正後のChrome5000件、320/375・通常/抑制motion各summary/PBの8枚を原寸で確認した。容量警告は320の初期summaryでPB文に重なり、PBへ読み位置を動かすと助言文に重なる。375ではPB文は読めるが、警告が的へ重なる。原runの320画像も保持し、再測定で元の問題を消した扱いにしない。警告は架空5000件で発生したもの。警告の必要性や容量保護を撤去する根拠ではない。

`finishSession` は `maybeWarnStorageNearFull` を `openSummary` より先に呼ぶ。これが位置の問題へ寄与する可能性はあるが、今回の画像だけでは原因を確定しない。表示位置・表示先を絞った別修正候補として扱う。測定中に表示修正は入れない。

## 訂正後の測定結果

Chromium 149.0.7827.55 / WebKit 26.5、lightテーマ。訂正後38経路・418操作はすべて成功。各操作のgeometry/五点hit/横overflow、score/X、観測座標保存と右微調整+0.6、旧全件と新3本の保存/reload一致、pageerrorなし。操作前のquickStart読取位置調整はrawのrevealedへ記録している。全操作の時間は [summary.json](evidence/record-flow-v112/summary.json)、イベントとframe生値は [matrix.json](evidence/record-flow-v112/matrix.json)。

次は375px・抑制motionでの終了。時間はcapture→第2rAF callback実行の中央値（最小〜最大、ms）、各localセル2回。公開は1回の別probeで、localの反復に合算しない。

| 条件          | 履歴3件               | 履歴5000件             |
| ------------- | --------------------- | ---------------------- |
| Chromium CPU1 | 47.6（47.5〜47.7）    | 227.0（225.7〜228.4）  |
| Chromium CPU4 | 239.5（231.5〜247.4） | 998.5（985.0〜1012.1） |
| WebKit CPU1   | 50.0（47.0〜53.0）    | 348.0（330.0〜366.0）  |

同じChromium375抑制motion/5000/CPU1の開始48.2ms・エンド確定45.8ms、その他の矢/選択/微調整/解除の中央値27.0〜31.6msに対し、終了は227.0ms。対応clickのEventTiming処理部分は3件45.0ms→5000件223.8ms、終了windowのlong taskは5000件で223〜226ms（2件）。CPU4/5000のlong taskは981〜1002ms（2件）。WebKitはEventTimingを取得でき、処理部分26.5→287.5ms、longtask APIは未対応。未対応やthreshold16ms未満のentryなしを0msと扱わない。engine間の差を実iPhone性能差とはしない。

公開375/3件の終了49.9ms、実Linux/public25資産byte一致。公開320/375のsummary/PB画像4枚も原寸確認し、3件では容量警告の重なりはない。訂正後代表12枚＋元320代表2枚をそのまま保存する。通常/抑制motionや幅320/375の全条件はrawに残し、上の一条件の表を全端末や全画面へ一般化しない。

## 別実行の処理内訳と次の最小候補

matrix完了後だけ、同じ3本の終了直前状態を所有contextへseedし、Chromium375抑制motion ×3/5000件 ×CPU1/4 ×2反復の8profileを実行、旧全件/新3本exact・errors0、wrapper復帰とcontext閉鎖まで成功した。これは11操作のmatrixとは別のfinish-only診断で、関数wrapperの負担もある。絶対時間をmatrixへ混ぜず、改修のspeedupとは呼ばない。

次の値はCPU1の各関数の1run合計時間の中央値（ms）。inclusiveには子が重複するため各行を足さない。snapshotはfinish後のidle仕事も含む別windowの値で、finishの内訳へ足さない。

| 関数                          | 3件 inclusive / self | 5000件 inclusive / self | 5000件calls / run |
| ----------------------------- | -------------------- | ----------------------- | ----------------- |
| finishSession                 | 49.9 / 0.5           | 297.9 / 1.0             | 1                 |
| computeTodaysResult           | 14.5 / 0.2           | 195.7 / 0.9             | 1                 |
| computeStabilityTrend         | —                    | 116.7 / 24.9            | 1                 |
| sessionMetrics                | 2.5 / 0.6            | 114.2 / 20.6            | 15018             |
| sessionMetricSignature        | 0.9 / 0.9            | 29.7 / 29.7             | 15018             |
| robustStats                   | 1.1 / 1.1            | 63.9 / 63.9             | 5001              |
| computeGrowthStreaks          | 0.6 / 0.3            | 49.7 / 16.3             | 2                 |
| writeDbNow                    | 0.9 / 0.5            | 36.4 / 26.0             | 1                 |
| openSummary                   | 33.6 / 1.6           | 39.1 / 2.1              | 1                 |
| writeSafetySnapshot（別idle） | 1.6 / 1.0            | 35.6 / 16.8             | 1                 |

CPU4/5000でも当日結果847.8ms、sessionMetrics486.7ms（15018calls）・署名129.9ms、robustStats263.4ms（5001calls）、save159.9ms、summary178.3msとなった。処理内訳は [profile.json](evidence/record-flow-v112/profile.json)。writeSafetySnapshotは本体の実行完了とstorageSetItem呼出keyを記録したが、本体callをsnapshotの実書込成功と同一視しない。

予測1の履歴計算増加を支持する。保存も増えるが、profileでは当日結果計算195.7msがsave36.4msより大きい。summaryは3件33.6→5000件39.1msで、履歴に伴う増分の主因をDOMだけとはしない。一方、少ない履歴/CPU4ではsummaryの比重も大きく、全遅延を履歴計算だけでは説明しない。

次の一小タスク候補は、終了時の同じ同期計算内で当日結果とgrowthBeforeが参照する同一sessionのmetricsを一時共有し、重複した署名検査を減らすこと。実sourceではcomputeStabilityTrendと2回のcomputeGrowthStreaksから反復参照する。既存のglobal DB_REV署名/cacheを削除したり、履歴件数を切ったりせず、計算結果・同日/過去日/編集/成長/少数資格を維持する範囲を先に定義する。これは未実装で、5001回の統計計算・保存・DOMの負担まで消えるとはしない。容量警告の重なり修正は別タスク。

## 検証と限界

原run38は成功したがelapsed解釈を撤回し [original-frame-clock-matrix.json](evidence/record-flow-v112/original-frame-clock-matrix.json) に保持。計測器の準備失敗・訂正・readonly reviewは [measurement-corrections.json](evidence/record-flow-v112/measurement-corrections.json)。最終harnessのsnapshot、fixtureのhash/再現元、代表14PNGのSHA/copy一致、各コマンド出力を evidence/record-flow-v112 に残す。

今回実行の出力は次のとおり。format/invariants/archiveの最終結果は同directoryのvalidation-output.jsonへ保存する。同じアプリsourceのAN076 checkall/lint/全272passed3.7m、CI38158744620/Linux272passed5.7mは再利用で、今回の再実行と呼ばない。

```text
PASS 38 native flows / 32 base+4 CPU4+2 public / old all and new3 exact/reload/scoring/errors0
PASS 38 flows/418 actions;actual trusted events/geometry/scoring/old all/reload exact/errors0;unsupported APIs explicit
PASS 8 separate diagnostic profiles;wrappers restored;inclusive nesting/self limits;owned records exact/errors0
All matched files use Prettier code style!
PASS all non-doc tracked Git content exact;no new untracked runtime;old76 taskobjects/allacceptance/sharedhiddenlock exact;app/math/storage/deps/SW/version112 unchanged
PASS archived original38+corrected38/418 actions/8 separate profiles/public25/14 SHA-exact representative images/source snapshots/command outputs;app112 unchanged
```

最終readonly reviewは訂正38/418・別8profile・主要数値/処理回数を照合し、Critical/Importantなし。次候補はsessionのオブジェクト同一性で一時共有し、初回は既存sessionMetricsを呼び、同期計算終了時に破棄する範囲が妥当。scope内のsession/metrics不変と既存DB_REV/署名cache保持が実装条件。reviewerはテスト/browser/network/build/editを実行していない。結果は [final-review.json](evidence/record-flow-v112/final-review.json)。

headless desktop/少数反復/observerやwrapper負担/外部OS負荷/全lightテーマの実験で、物理iPhone・VoiceOver・実paint・フィールドINP・GPU・実射・実ユーザー巨大履歴の性能保証はしない。serviceWorkers:blockの監査なのでSW更新/offlineの再証明ではなく、WKstrictOffline/旧閉鎖profile回復も未証明。公開112・アプリsource・数学/採点・保存schema・依存・SWは不変。大目標active、費用/個人情報不使用。
