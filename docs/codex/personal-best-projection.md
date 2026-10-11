# 自己ベストの換算値を達成後も明示する — AN076

前回AN075は公開111と保存/UI/CIの証拠を完成した進捗。基点local49bb1d46d5c2f67b99ba613ebc9cc3b2c6c35f64、公開source97e89934953e4ed6224664c40d49eddaddd99645/v111。今回の一小タスクは、AN074で再現したPB換算到達後の注記欠落。包括承認継続、無料の既存PUBLIC Pages/所有架空fixtureだけを使い、費用・個人情報は使わない。

## 設計

原因は50-record-viewのtodaysResultPersonalBestRowHtmlで、推定・本数換算の注記が未達成のelse分岐にのみあること。49のcomputePersonalBestDistanceはmethod/bestTotal/todayArrowsをすべて返しており、計算側の欠落ではない。

1. **rendererで比較方法を全結果に表示する（採用）**。avg-projectedの主文を「自己ベストの換算値まで／に並びました／を上回りました」にし、詳細に「推定・○本換算 ○点（日付）・ 今日／この日 ○点」を常に出す。pace近いの説明は未到達時だけ既存どおり。exact-countのHTMLは現状と同一に保つ。
2. 到達時にも末尾へ注記を足すだけ。換算なのに主文の「自己ベスト更新」が実記録更新と混同されるため不採用。
3. PBを同本数だけに制限する。既存の比較/計算/母集団を変えてしまうため不採用。

得点と過去記録を結び比較方法を明示する、成長の誤読を防ぐ、完全local、日々の結果を理解できる、の4product gatesを確認。archery-note/brainstorming/writing-plans/systematic-debugging/TDD/verificationを適用。ユーザーの全承認の範囲にある最小表示修正で、追加の設計承認やvisual質問は不要。自分で仕様を確認し、比較method/本数/日付/値/今日とこの日の扱いに未定義やplaceholderがないことを確認した。

## 順序と受入

1. 旧111の計算とrendererを使い、換算/同本数×未達/並ぶ/超える、今日/この日、近いpace/日付/数値/非破壊のfocused回帰を追加し、本来の注記欠落でredにする。計算・exact-count HTMLは旧111と一致を確認する。
2. 変更は50の上記rendererだけ。49/PB計算/条件/score/rawstats/座標/保存/cache/schema/handlers/style/layout/依存/SWactivationを保つ。markersは現版を確認し一括bumpする。
3. Chrome/WK320/375明暗×換算/同本数×3結果の24条件ずつ、終了→summary→履歴→reloadで旧3/座標/採点一致/errors0と実表示JSONを保存。native320/375の新開始→中心arrow→終了→history/reloadも別確認。375前後代表画像を原寸表示、コピー同byteを確認。該当行をscrollして読み、横overflowやfooterの重なりを確認する。
4. check:todays-result/checkall/lint/format/生成全E2E、immutable差分の独立review。全markers整合。承認済みpush/CI実Linuxartifact/public25byte/元所有111contextの記録中update保留→終了banner→112更新/旧記録保持/offline/新native換算結果を検証する。
5. 公開後のみAN076done/pass＋非空evidence。旧75taskobject/全acceptance/共有hiddenlockを保ち、progress/ledgerへ変更ファイル/失敗も含む検証/限界/nextを書く。

大目標active。最低座標資格を統計的有意性としない。実iPhone/VoiceOver/fullmotion/INP/GPU/実射/巨大履歴/WKstrictOffline/旧閉鎖profile回復をdesktop証拠から主張しない。所有process/contextの観測timeoutだけでrestartしない。
