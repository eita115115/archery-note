# 結果の容量警告を読める案内へ — AN080

基点3443bd9d、公開v114/source95b9bcc。前turnはv114公開で進捗あり。ユーザーのUI制約なし/全承認を継続、費用個人情報不使用。owned worktree/Node22/sandboxのみ。共有node_modulesへのinstall禁止。

## 確認した問題と設計

実Linux114と架空5000件でnative開始→1本→終了。320で5秒の容量toastが「推定・1本換算…今日10点」と的に、375で的に重なる（usage100%、pageerror0）。baseline helper/結果/画像をartifacts/result-storage-noticeへ保持。初検索の古い00-core等path/Windowsglobは現在のrg --filesで訂正した。

選択は結果statbar直後の通常flowに残る容量案内と「バックアップ設定を開く」。比較・成長・的を覆わず、閉じるまで読める。設定は結果の上に重ね、データ管理のbackup操作を表示。自動exportや削除は行わず、設定を閉じれば結果へ戻る。他案の画面上部toastは別内容を覆い、通知を短く/遅らせる案は警告を見逃すため採用しない。

Product gate: 記録→成長の結果→backup保全を結ぶ、比較文を読める、完全local、毎日の終了操作を増やさない。今回は容量警告の表示とbackup導線の一タスク。ドックlabel折返し/他toast/履歴分析の情報設計は次。閾値0.8/容量計測/保存失敗警告/保存schema/採点半径/数学/依存/SWactivationを保持。

## 実装と検証

1. summary-storage-notice.spec.jsを先に追加。320light/375dark/900light、低容量非表示→閾値0.8で表示、結果との非重複、backup設定の表示/戻る/旧全件+新座標/得点/reloadを確認。境界testは容量計測だけ明示stubし、別native harnessで実5000件の本物の容量を確認。現行のredを保持する。
2. 10の終了用toast helperをstorage warning HTMLへ、50のfinishから旧toast呼び出しを外し、openSummaryのstatbar後へ案内を配置。backupボタンで既存openSettingsとdExpへのscrollだけ。CSSは案内の面/文字/44px以上のボタン。通常容量は案内なし。
3. root build:web-assets→sandbox sync。focused red/green、既存toast/modal/summary/backup関連、checkall/lint/format/全生成E2E。Chrome/WebKit320375明暗で実5000件と通常3件、native finish/旧全件座標得点/reload/backup設定/非重複/原寸画像。独立readonly review。
4. markersを専用commitで一括bump。既存承認でpush/公開CI成功、実公開version/資産と更新時データ保持を確認。公開証拠後だけAN080 pass/evidence、progress/tasks/ledger更新。大目標はactive。

## 自己レビュー

範囲/警告文/場所/閾値/CTA動作/検証が具体的、placeholderなし。警告の撤去や保存の変更ではなく、同じリスクを読める表示にする。save failure時の既存toastは撤去しない。実iPhone/VoiceOver/fieldINPは別未証明。ユーザーの継続承認内で実装する。

## 実装中の検証記録

初baselineの375画像はhelperがSVGのMIMEをapplication/octet-streamとして返しlogoが欠けた。アプリ障害ではなく、SVG/PNG MIMEを直した別before-correctedで同じ重なり/旧5000nativeを再確認、元画像/出力は保持。現行版redは3failed（案内が存在しない）。初green3failedはglobal .statbarが背面の記録画面を参照していたため、同じsheet内へscopeを限定。次green3failedは容量stubがratioだけを返し、設定meterのmb.toFixedで例外になる契約欠落。mb/capMb/percentを実APIと同じ形で返すよう訂正し、green3passed24.6s。幾何/0.8閾値/持続/保存/戻るの合格基準は弱めていない。

apply_patchはstyleとformat済testの古いneedleで2回atomic検証失敗（source変更なし）。formatterの50への無関係な整形はpatchとして保持後、HEADへ同じ3箇所だけ適用し直してdiffを9行へ限定した。容量notice/helper・通常flow・CTA以外の数学/採点/保存実装は保持する。

## 最終検証と公開

AN080完了、公開v115/source20f19429609d1c6a0445ee5d6b63d2ec9a095e0c、branch codex/result-storage-notice。結果に重なる容量toastをstatbar直後の持続案内へ移し、「バックアップ設定を開く」で既存設定のbackup操作を表示、閉じて結果へ戻る。自動exportなし、閾値0.8/容量計測/保存失敗toast/保存schema/採点半径/数学/全他runtime/依存/SWactivation保持、CSS4rulesとmarkers一括115。境界3red→3green24.6s、最終local全301passed3.8m/checkall/lint/format成功、ChromeWK320375明暗×通常3/実高容量5000のnative8は旧全件+新矢座標得点/reloadexact/errors0/非重複/設定往復/no download。初WK5000は実ratio.784で案内なしが正しくharness誤判定、元pageを保持して旧5000+新1/reloadexact回復、元fullerrorcollectorは取得不可を明記。別synthetic padding fixtureの訂正8は実ratio>=.8をassert。独立readonlyreview指摘なし（review時点full/native/public未確認）。CI38200540609 validate/deploy success/Linux301passed5.9m、実artifact11726175058/26safe、実Linux-public25byte/frozen19byte+6LF/first15-canonical14一致。元public114context publication462061ms、記録中更新保留→finish4/banner115/旧4exact→320native1/nudge3/解除/次矢2/offlineSWreload/finish5/result-analysis-history/reload/errors0。docs/codex/evidence/result-storage-notice-v115/代表13原寸PNGcopySHAexact、旧79tasks/全acceptance/sharedlock保持。費用個人情報不使用・大目標active。小画面dockラベル/履歴分析の情報設計/物理phone/VoiceOver/fieldINP/WKstrictOfflineは未完。

初lintはbrowser callbackの未修飾global4件で失敗、globalThisのみ訂正した最終20f1942が成功。初nativeはChrome4/WK通常1の5case成功後、WK3205000を件数だけで高容量と仮定し失敗。元所有process/pageを保持し、inspector経由で実usage3.92MB/ratio.784/snapshotなし/旧5000+新1保存を確認。NodeREPL接続timeoutでkernelがresetしたがbrowser/processはresetなし。初internal module不存在/cache経路の調査失敗を経て元livepageを取得、記録のretap/seed/resetなしでscore/旧全件/reloadexactへ回復。inspectorの観測timeout後も処理継続しdurable recovery JSONを確認、reloadErrors0だけを主張し元fullerrorcollector取得不可を保持、元exit1は訂正成功へ置換しない。所有browser/serverを閉鎖後、架空noteだけを追加した別fixtureで実ratio>=.8をassertする訂正8caseが成功。初invariants helperは一般のnativePulse/save地点へ旧blockを戻す誤needleで文字列比較失敗、finish固有の次commentまで限定して成功、app変更なし。

raw red/green/stub契約/初MIME/無関係format patch/lint/native/invariants失敗、元page検査・回復、最終全301・native8・実CI・公開更新・画像を docs/codex/evidence/result-storage-notice-v115 へ保存。検証出力はvalidation-output.jsonとlogsに保持。archive内だけの.gitattributesでraw CRLFを正規化せずSHA一致コピー。公開後notesはlocal commitのみ。今回公開更新は通常容量の架空3件、実高容量noticeは最終native8と公開資産byte一致で証明し、同じpublic update profileで容量警告を試したとはしない。
