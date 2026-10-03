# AN-062 — 矢を選んだら微調整をすぐ使える

前run AN061は実公開のUX監査で新しい摩擦を確認したprogress。
今回は既存の全承認に基づき一件だけ直す。料金・個人情報は使わない。
正本の記録/初回ガイド/終了結果の構成は広く書き換えない。

## 設計

選択した矢の微調整パッドを、そのチップを押した時だけ見える位置へ出す。
既存の `refreshActive` がパッドとタグを表示した後に位置を測る。
通常の矢入力、連続nudge、理由タグ、矢番号の入力には新しいscrollを入れない。
選択解除/削除/確定後の `revealActiveTarget` は保全する。

操作パッドの五つのボタンがヘッダーとドックの間に収まるよう必要量だけ
instant scrollする。既存のパッド入場モーション6pxも見越して16px余白を取る。
収まっていれば動かさない。small phoneでも150pxパッドを押せる。
content-visibilityによる仮の位置を測らないよう、対象カードを測定前にレイアウトする。
新しいモーション・listener・timer・永続キーは追加しない。

監査で検討した常設位置の変更は通常の的を狭め、理由を折りたたむだけでは
パッドの上端がドック下にある問題を解決しない。選択時だけ出す案を採用する。
チップ選択による視点移動はあるが、必要な操作へすぐ届く。

4gate: 修正した記録が履歴/分析へ繋がり、成長データを正しく残し、処理はlocal、
毎日の修正に追加操作を求めない。self-reviewで契機/位置/動かさない条件を確認した。
既存の承認が実装・公開を含むため、同じ承認を再度求めず進める。

## 実装と受入の順序

1. `tests/e2e/correction-entry.spec.js`: 320/375、light/dark、normal/reducedで
   チップをnative touchで選択し、五ボタンの位置とhit-testをscrollなしで検証する。
   現行版でドックに隠れるredを残し、単なるPlaywright自動scrollで合格にしない。
2. `scripts/50-record-view.js`: チップ選択handlerだけから必要な表示位置調整を呼ぶ。
   nudge/タグ/番号入力中のscroll保持、採点円、解除/確定/次矢、架空保存を回帰で確認する。
3. 所有compact-js sandbox/isolatedNode22.19で全check/lint/format/実生成物E2E。
   nativeChrome/WebKit320/375の主要操作/設定swipe/offlineを確認し、375前後画像を表示する。
   root/original node_modules junctionのinstall/ci/updateは禁止。
4. read-only review、揃えた版markers、事前候補/driver準備後に通常承認済みpush。
   実保持公開旧profileのrealbanner初回code/15body/14cache/practiceを即時保存し、
   追加scroll不要の修正/確定/次矢/設定swipe/実offlineを確認する。
   正確source LinuxCI/25publicbytesと保存hashを照合する。
5. 全証拠が揃ってからAN062/progress/ledgerを更新する。既存task acceptanceは変えない。
   WebKit合成複数指、旧offline/lifecycle失敗、実iPhone/VoiceOver/INP未確認は維持する。

採点の円とscore、既存practice、保存schema、依存graph、SW activationは変更しない。
共有hiddenlock SHA256 `16F9BA6219DA31278CED98C0C742013B4A5AAEA63059E4702E86756702A23309` を保持する。
