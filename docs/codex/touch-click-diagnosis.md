# AN-066 — Native touchからclickが出ない経路を縮小する

前回AN065はv105公開、156テスト、実更新保持と結果画面の改善を完了したprogress。
今回の一小タスクは、所有local rehearsalで終了前にclickが出なかった原因の診断。
既存全承認で進め、架空profileと固定済み104/105の資産だけを使う。
公開やアプリ変更は、診断前に追加しない。

## 手順と受入

1. 元の更新→分析filter→履歴pinch→修正→設定swipe→offline reload→
   履歴→分析focus/select→record→終了を、Escapeなしで再現する。
   正しい終了button上のpointer/touchとclick欠落、保存不変を判定する。
   失敗contextはsnapshot/current livenessの後、明示abortで閉じる。
2. 確定したfeedback loopを縮小する。更新、gesture、offline、filter、focusを
   一変数ずつ取り除き、取消・focus・click・表示とdataを狙って観測する。
   仮説と予測を示してから対照検証する。
3. 原因がharnessなら、実際の入力境界の回帰で誤った操作を修正する。
   原因がappなら、適切なUI regressionのred→greenと元経路再実行が必要。
   元失敗を別contextの成功へ言い換えない。別runの対照は別証拠。
4. 診断と実変更に対応する検証だけ実行する。docsのみならformat:check。
   UIを変えた場合はacceptanceのUI/release行を適用する。
   旧65task/全acceptance、配信25資産、依存/共有lockを保持して記録する。

実iPhone/VoiceOver/INPや、未観測の旧profileの回復は証明しない。
前回の4failed rehearsalとfresh最小4成功を保ち、原因の証拠が揃うまで解決としない。
owned compact-js sandboxを使い、root/original node_modules junctionでinstall/ci/updateしない。
