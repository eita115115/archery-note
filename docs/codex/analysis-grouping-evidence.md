# 分析と履歴のグルーピング判断を揃える — AN075

前回AN074は監査の進捗。基点local2aeda7c0bec1b4fa87d9c476c9cc2af351b3f440、公開110/sourcef967d12e96bdb113c8e1747236dcd3394d53f42d。実Linux110の40UI/実public25byte、架空旧3＋native保存と独立reviewを根拠に、一小タスクとして誤解釈を修正する。全承認継続、費用/個人情報不使用。

## 設計と選択

1. **共通の最低座標資格をconsumerで確認する**。生のRMS/score/cache/座標は保ち、最新と前回が比較可能なときだけ改善を語る。採用。
2. dashboard表示だけを隠す。集計値・KPI・結論・履歴助言の矛盾が残るため不採用。
3. RMS数学や全分析行を変更する。正しいraw値/score母集団まで変わるため不採用。

brainstorming/writing-plans/archery-note/test-driven-development/verificationを適用。得点・座標・履歴・分析を結ぶ、成長を誤読させない、完全local、毎回の判断を助ける4product gatesを確認。包括承認の範囲で設計と実装を続ける。新しいlayout/機能追加ではなく既存解釈の整合であり、追加のvisual質問/再承認は不要。

純関数を40-analysis-physics.jsの説明consumerより前に置き、45/49/50の共通資格は`total>=3 && n>=3 && finite(rr)`とする。trの既存APIをwrapperとして保ち、履歴comparisonも共通化。資格は既存最低本数であって有意性の保証ではない。方向は各既存比率1.3/1.35を保ち、有限・非負・表示1桁で違いが読めるときだけ提示する。

最新少数座標のdashboardは比較待ち、KPIは最新比較待ち＋過去の資格ある最小、結論はscoreの上/下傾向があるならそれを保ち、それ以外は座標不足を明示。次回提案に3本以上の座標を集める具体的理由を出す。period/conditionはRMS/中心の母集団だけ資格を揃え、回数/本数/平均点/最高合計を維持。履歴conditionInsights/shapeNoteの良好・方向・中心の助言も資格/可読精度を守るが、風の物理推定/条件memo/用具情報は保つ。

PB換算達成の注記は次の別タスク。採点/数学、sessionMetrics/cache、round/同条件、保存/schema、style/layout/handlers、依存、SWactivationは変更しない。公開時だけ版markersを現行から一括更新する。

## 実装順と受入

1. 実40/45/49/50の関数を読む。実robustStats/scoreAt生成の0/1/2/3/6本、座標欠損/数値文字列、少数最新/前回、得点変化/valid3+・方向ゼロ/正差、period/condition score保持をregressionでredにする。旧synthetic unitstatsに実契約n/totalが欠ける場合はfixtureにその契約だけ明記する。
2. 上記pure資格/可読方向をconsumerへ適用。得点行/rawstatsはそのまま保持。focused regressionと既存check:analysis/check:todays-resultでgreenにし、失敗は元出力を残して原因を直す。
3. 320/375明暗Chrome/WebKitの実UI、native記録→終了→結果→分析→履歴→保存reloadを検証。全40countcasesの数値/文言、代表375前後画像、旧3/座標/score一致/errors0を保存する。元110のredを新成功へ置き換えない。
4. checkall/lint/format/生成全E2E、最低座標資格とscore母集団の独立readonlyレビュー。現版と次版を確認しversion:bump/check:version、最終資産で検証後commit/push、既存無料Pages CI/実Linuxartifact/実public25byte/所有旧110context更新banner/記録保存/offlineと新実native分析を確認する。
5. 公開確認後だけAN075pass＋非空evidence。旧74task/全acceptance/共有hiddenlock保持、docs/progress/historyに失敗/成功/限界/nextを記録する。

大目標active。実iPhone/VoiceOver/統計的有意性/fullmotion/INP/GPU/実射/巨大履歴/WKstrictOffline/旧閉鎖profileの回復を今回のdesktop証拠から主張しない。失敗したownedprocess/contextは原因と元状態を保ち、観測timeoutだけでrestartしない。
