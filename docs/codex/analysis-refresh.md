# 分析の入口を整える — AN083

基点0e83dea7、公開v117/source3a1e6d05。前回は履歴UIを公開して進捗あり。UI制約なし/全承認/通常公開の承認を継続。所有worktreeで一タスク、費用・個人情報不使用。

## デザイン

実Linux117・Chrome/WebKitの320/375明暗/900で、6つの数値が結論より先に並び、用具/距離/期間は画面下に隠れることを確認。条件を先に示し、傾向→次の練習→数値へ読む順を採用。折りたたみフィルタ案は条件を見失いやすく、数値中心案は現状の迷いを残す。

比較条件カードを先頭へ。用具/距離/期間の操作と値は同じで、見出し「比較する条件」、期間のgroup名を付ける。「今日の結論」は選択期間に対応する「練習の傾向」へ。傾向を大きい本文と淡い面、次回試すことを読みやすい本文、詳細数値を後続へ。growthカードの見出しは「練習のまとめ／数値で振り返る」。数値6項目は削らず既存値のまま。

WebKitの微小な負差で「改善0.0cm」と出ることを保存済みbeforeで確認。グルーピング変化の方向ラベルだけを表示精度（0.1cm）に合わせ、丸めた表示が0.0なら横ばいとする。nullは比較待ち、元のdelta/RMS/計算/保存は不変。

Product gate: 得点/座標/用具/既存の次回提案を同じ順で結ぶ、成長比較を保つ、全local、毎日の振り返りを短くする。新指標/外部通信/依存追加なし。

## 手順と受入

1. 50の分析markup/順序とstyle.cssの分析専用規則を変更。handlers/focus/keyboard/period/filter/数学/保存schema/採点/依存/SWactivation保持。0表示の方向の境界回帰と、375/320で条件と傾向が見える回帰を追加。
2. ChromeWK320/375明暗/900の前後/最終版、条件/期間変更・該当なし・旧全件reload/errors0、既存計算値の前後一致、375原寸。条件なしの空データも確認。記録native/backupの既存全回帰と全生成E2E、checkall/lint/format/独立readonlyreview。
3. 全markers一括118を専用commit。承認済みCI、実Linux/public25資産一致と元117context記録中更新保留→banner→旧記録保持→新native/offlineを確認。所有native証拠と分析captureは別directoryで保存する。
4. 旧82taskobjects/全acceptance/sharedlock保持。成功証拠後だけAN083pass+evidence/progress/ledger。大目標active。物理iPhone/VoiceOver/fieldINP/WKstrictOfflineは未証明。

自己レビュー: 今回は分析入口の情報階層。グラフ以下の全カードや分析ロジックの再設計は別タスク。既存承認があるため追加確認待ちは置かない。
