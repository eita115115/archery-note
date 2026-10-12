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
