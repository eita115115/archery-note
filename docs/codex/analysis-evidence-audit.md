# 少数記録の分析表示を監査する — AN074

前回AN073は実公開110/更新/記録保持まで進捗。基点`9c6fc088c652a94e11759667bf966ecc21c08af9`、公開runtime/source`f967d12e96bdb113c8e1747236dcd3394d53f42d`。継続する大目標は、信頼できて日々使いたくなるアプリ。全承認継続、費用/個人情報不使用、所有架空fixtureのみ。

## 選択と範囲

1. **実Linux110の数値・表示・UIの経路を対照して優先修正点を決める**。採点と保存が一致するfixtureを使い、異なる画面が同じ記録をどう解釈しているかを比較する。採用。
2. dashboardのRMSだけを先に隠す。その他の結論や次回提案が同じ少数値を読む可能性を残すため、先に利用箇所を調べる。
3. 分析全体を作り直す。現在の計算/蓄積データ/利用経路を広く変えるため今回の範囲に入れない。

brainstorming/writing-plans/archery-note/diagnose/verificationを適用。Product gates: 得点・座標・履歴・分析のつながり、成長を誤読しないこと、完全local、毎回の判断に使えることを確認。ユーザーの包括承認に基づき再承認を要求しない。今回は一小タスクの監査であり、未再現の原因からruntimeを変更しない。

## 手順と完了条件

1. 現在のsource/版/acceptance/brief/currentprogress/history/continueとconsumerを読む。`sessionMetrics/robustStats`の値、`trHasGroupingEvidence/groupingSessionRow`の資格、dashboard/KPI/結論/提案/period/condition比較、PBの`avg-projected`/`exact-count`とrendererを対象にする。
2. 実CI110配布物（artifact11319403251）をlocal previewする。既存採点でscore/Xを生成した同条件旧3回を基準とし、新0/1/2/3/6本をChrome/WebKit320/375明暗で40ケース比較する。effective座標不足/数値文字列も補助観測に含め、旧履歴3件と数値を保つ。
3. 本数換算のbelow/tie/aboveと同本数の比較を実関数/rendererで分けて記録。値の丸めと文言を区別し、「推定の比較」を実記録更新と表示していないかを見る。
4. 少なくとも代表320/375明暗の実UIと、旧3履歴→native記録開始→1本入力/終了→結果→分析の経路を確認。raw tapはhit/rectを測り、score・座標・保存/reload・旧3を検証。DOMテキスト/pixel/数値のJSONを保存し代表画像を原寸表示する。
5. 失敗があれば元process/contextと観測を保持し、別成功へ置換しない。再現した不整合ごとに根拠/consumer/最小修正候補/必要回帰を記録する。3本は既存最低資格との整合であり統計的有意性の保証ではない。
6. 全app/scoring/math/UI/style/handlers/schema/deps/SWactivation/markers110不変、旧73task/allacceptance/sharedlockを確認。アプリ資産の実Linux/public25bytesを再照合する。docs/tasks/currentprogress/historyを更新し、format:check・独立readonly証拠レビュー後に監査だけを完了とする。runtime未変更なので新更新banner/新version/不必要なreleaseは作らない。修正とそのred→green受入は次の一小タスク。

実iPhone/VoiceOver/fullmotion/INP/GPU/巨大実履歴や未回復closedprofileの改善をこの監査から主張しない。監査出力は候補の根拠であって、未実装の修正の成功証拠ではない。

結果は実行後に追記する。
