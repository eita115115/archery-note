# 終了時の統計参照を一回の計算内で共有する — AN078

前回AN077は監査完了、基点82d4681e5cbe394129abea69fa68d059871f2753、公開source6dabcff6ab73996e71693da348a271c9e1659cff/v112。前runは進捗（38/418と別8profile、次の重複署名検査を特定）。所有worktree codex/finish-metrics-sharing、費用/個人情報不使用。全承認は継続し追加承認待ちを設けない。一小タスクは終了時のmetrics共有だけ。

## 設計・比較した選択肢

1. 採用: finishSessionの非編集・保存後の同期ブロック内だけ、sessionのオブジェクト同一性でWeakMapへ既存sessionMetricsの結果を保持し、computeTodaysResultとtrGrowthBeforeForへ同じ関数を渡す。終了すると参照を手放す。global cache/DB_REV/署名/数学はそのまま。目標は15018回のmetrics/署名参照の重複削減で、5001回の統計計算削減や改善幅を先に保証しない。
2. 恒久cacheのDB_REVを外す: 署名衝突や編集の再計算を損なうため不採用。
3. 履歴数を制限して計算する: 成長継続や同日/過去日比較の意味を変えるため不採用。

新しい機能ではなく、既存の得点・グルーピングの成長比較を速くする。product visionの4gateは既存分析の接続、成長の表示維持、完全local、普段の記録終了を速くする点で満たす。UI/操作数は増やさない。共有scope内は同期で、sessionもmetricsも変更しない。gamificationの追加saveやopenSummaryの前にscopeを終え、編集経路は現状どおり。エラーは既存と同じく伝播し、保存処理や失敗時処理を追加しない。

## 実装と受入の順序

- 実source112へ回帰を先に追加。実native finishで同一recordのmetrics実計算呼出はscope内一回、結果/growthBeforeは無共有の既存49/50計算とdeep equal。通常/同日/過去日未来除外/少数/座標なし/gamification/編集、同ID別object、次の終了後の再計算を確認。320/375明暗、旧全件/新矢/score/reload/errors0、375前後画像を保存。
- scripts/50-record-view.jsの非編集結果計算ブロックにのみ一時WeakMapを置く。49/40/採点/保存/schema/style/handlers/依存/SWactivationは変更しない。既存77taskobjectsと全acceptance、共有hiddenlockを保持する。
- check:todays-result、check:all/lint/format、生成全E2E、Chrome/WebKitのfocused実UIを検証。readonly独立reviewへimmutable差分を渡す。
- 原Linux112と候補生成物で同一fixture/11native操作/callback性能時計を用い、Chrome/WebKit375抑制motion×3/5000×2、追加ChromeCPU4×2のbefore/afterを直列測定する。別profileは回数検証として分離し、wrapper時間を速度改善へ混ぜない。全条件再監査/fieldINP改善とは呼ばない。
- 現markers読取後version:bumpで一括更新。承認済み公開ループを実行し、CI/実Linux-public25byte・元所有112context更新保留/banner/旧記録/新native/offlineを確認後だけAN078pass+非空evidence、progress/tasks/ledgerを更新。

今回、容量警告の重なりや結果画面DOMの計算は別タスクへ残す。物理iPhone/VoiceOver/実paint/fieldINP/GPU/実射/実巨大履歴/WKstrictOffline/旧閉鎖profiles回復は未証明。大目標active。

## 設計の自己検査

未定API・placeholderなし。object identity/scope/破棄時点を明示し、変更は一つの同期計算へ限定。既存署名・DB_REVや保存を保持する条件と、gamification後に共有を使わない条件に矛盾なし。受入は同条件before/afterと実結果一致を分け、測定だけで改善を断定しない。

## 実装と初期検証

実装3ded730は50の非編集結果計算ブロック7行追加・引数2箇所の変更だけ。版113は別edd82b8で一括、3259d88はidentity回帰の強化だけでruntime同一。原112生成物の回帰は22failed/4passed37.2s、失敗はscope内同objectの実metrics呼出3（期待1）で、編集4条件は既存どおり成功。初期green26passed18.6s。次終了の回帰はsame-contextで履歴を変更→save→次の終了に強化し、古い計算の持越しを検査する。

生成全298passed3.1m/checkall/lint/format成功。全298の実行中にrootのidentityテストだけ強化したため全実行のsandboxは旧テストのまま保持し、終了後だけ同期。最終3259d88テストはChrome26passed18.3s/WebKit26passed19.3s。全体実行とfocusedのscopeを区別し、全体再実行と呼ばない。公開CIは最終テストを全実行する予定。

独立readonly reviewのImportantは同ID fixtureが同じmetricsでID-key cacheを検出しない点。2件目を6→3本にし、同ID別objectの計算entryが2件で各1回、保存ends不同を追加し解消。最終3259d88＋before-after/profile計測器はCritical/Important/Minorなし、実行による性能・公開証明は別。original sourceの40/49/採点/保存は不変、50も対象block以外exact、全依存/DB_REV/SWactivation/旧77tasks/acceptance/sharedlockのinvariants成功。

準備時の誤ったmetrics filename/旧workflow名/旧WKconfig名のreadは失敗し、rgで実名を確認。最初のtest-strengthening patchはPrettier後のcontextと一致せず適用失敗、部分変更なし。実ファイル読取後に訂正。回帰redとは区別し、アプリ障害と呼ばない。

## 同条件測定の結果

原Linux112とfrozen生成113の直列24経路・264native操作がexit0、旧全件/新3本座標/scoreX/reload/errors0、前後の保存endsも各条件exact。375/light/reduceのみ、各条件2回、rep1は前後順と履歴順を反転。captureから第2rAF callback内performance.nowまでの実験値であり、入力queue/実paint/fieldINPや実機改善の証明ではない。

| 終了条件               | 前中央値ms | 後中央値ms |     差 |
| ---------------------- | ---------: | ---------: | -----: |
| Chrome・履歴3・CPU1    |       47.0 |       47.4 |  +1.0% |
| Chrome・履歴3・CPU4    |      240.4 |      207.8 | -13.6% |
| Chrome・履歴5000・CPU1 |      230.4 |      224.3 |  -2.6% |
| Chrome・履歴5000・CPU4 |     1032.3 |     1043.4 |  +1.1% |
| WebKit・履歴3・CPU1    |       48.0 |       52.0 |  +8.3% |
| WebKit・履歴5000・CPU1 |      346.5 |      338.5 |  -2.3% |

通常CPUの5000件で小さな短縮を観測したが、CPU4/5000の後は931.6〜1155.2msと幅があり、全条件で一貫した速度改善とはしない。small-historyのWebKit増加も隠さない。EventTimingとlongtaskの対応判定は独立で、WebKitのlongtask未対応を0件と扱わない。2回の中央値・範囲はraw/summaryに保存し、percentileや広い端末性能へ外挿しない。

別の113 finish-only8profileがexit0。AN077の112 profile8を回数比較に明示再利用し、wrapper時間を今回native比較やspeedupへ混ぜない。sessionMetrics/署名の呼出は3件20→13、5000件15018→5017（8条件全て）、robustStatsは4/5001回のまま。実writeSafetySnapshot body/idle終了/旧全件新矢exact/errors0/wrappers復帰を確認、call数を実書込数とは呼ばない。今回実証したのは重複参照削減で、残る統計5001回・保存・DOMの負担を解消したとはしない。

最終test-only差分のlint/format成功。独立追補reviewでarchiveへのprofile-summary3点欠落を修正し、CI成功/source一致・8条件exact・原寸15パス/SHA閲覧manifestのgateを追加。最終静的reviewにCritical/Important/Minorなし。public5画像の未閲覧時点ではarchiveを実行しない。

承認済みpushは3259d88→main、CI38165314023進行中。元public112同contextの旧3件/active1/15旧body一致をBASELINE_READYとして保持してからpush。公開成功・旧記録保持・実Linux照合が終わるまでAN078は未合格。

push時GitHubが既存native依存のcritical2件を通知。APIで@capacitor/androidと@capacitor/ios（development）、修正版8.4.3、internal HTTP proxy経路に関する警告と確認。今回依存は不変、native shellは未使用で、修正やWeb/PWAへの到達性評価は今回のscope外。native作業前に別タスクで確認する。個人情報・秘密値は取得していない。

公開後に追加したWindows candidate25byte一致assertはindex.htmlでexit1。元出力を保持し、全25比較で19byte exact・6textだけCRLF/LF差を検出。core.autocrlf=true、buildのHTML書出/copy経路、sourceのruntime/test-only一致を確認。14app scripts/CSSはbyte exact。allowlist6（index/manifest/sw/icon.svg/poseの2JS）のパス集合exact＋改行正規化後text equalityへcandidate照合だけ訂正し、実Linux-public25byte厳密一致は維持。訂正版exit0/差分両SHAを保存。これをcandidate全25byte一致とは呼ばず、benchmarkをLinux後候補で再実行したとも呼ばない。改行以外のコード変更なしで、既存24測定をそのscopeで保持する。.gitattributes不存在のreadとinline patchのPowerShell quoting parser failureも準備失敗、部分変更なしで保存scriptへ訂正した。

## 公開後の確認

AN078完了、公開v113/source3259d88cb78e2fe6756f21089b894b4b7bc6f0f8、branch codex/finish-metrics-sharing。非編集finishの同じ同期計算内だけmetricsをobject identityで共有し、5000件の参照15018→5017、統計5001回は保持。計測24/264・別8profile・Chrome26/WK26・local全298（identity test強化前）・finalLinux全298/checkall/lint/format/独立review成功。通常CPU5000はChrome230.4→224.3ms/WK346.5→338.5ms、CPU4は1032.3→1043.4ms/n2で速度改善は限定的・fieldINP未証明。CI38165314023 validate/deploy成功、artifact11712575196/26safe、実Linux/public25byte/frozen19byte+6LF・first15/canonical14一致。元112context publication436454ms/active更新保留/finish4/banner113/旧4exact→320native/nudge3/解除/次矢2/offlineSWreload/finish5/metrics各1回/少数pending-PB注記/analysis-history/reload/errors0。docs/codex/finish-metrics-sharing.md/evidence/finish-metrics-v113、代表15原寸PNGcopySHAexact、旧77tasks/全acceptance/sharedlock保持。費用個人情報不使用・大目標active。今回変更は50の同期block・回帰test・一括markers113、保存/数学/採点/全他runtime保持。公開後notesはlocal commitのみ。

検証のコマンド出力はevidence/finish-metrics-v113/validation-output.json、実CIログも保存。AN078 pass/evidenceは公開とarchive成功後にだけ記入。旧77taskobjectと全acceptanceを保持し、最後にformat/invariants/archiveを再確認してlocal notes commitを残す。

終了整理中にユーザーが大目標へ「UIダサすぎるから一新したって言い」を追記。UI一新への承認として次runの優先を更新し、現行UI監査・具体案・mobile previewから進める。今回113は性能修正で、UI一新が完了したとは報告しない。広いUI変更を今回の小さい性能差分へ混ぜず、費用個人情報の除外と採点/旧データ/主要操作の不変条件を継続する。
