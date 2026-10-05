# 微調整からすぐ戻る — AN073（2026-10-05）

AN072は診断/回帰補強まで進捗。基点6954f2ad50780c0ecf2ee4f26758b6541c07ea37、公開app109。全承認継続、費用/個人情報不使用。archery-note/brainstorming/writing-plans/frontend-design/test-driven-development/verificationで一小タスクを実装する。

## 問題と選択

現109のnative3nudge後、320の解除y549.46875〜597.46875（viewport568）、375y766.3125〜814.3125（viewport812）で中心hitfalse。sourceはnpad→shotMeta→nudgeDone、entry revealはnpadだけ。名前付き戻り操作を矢番号/理由より先に出す。

1. **既存解除buttonをnpad直下/meta前へ移し、selection-entry revealのnpadと解除の範囲を含める**。同じラベル/48pxbutton/handlerで操作完了後の次矢へ戻る。採用。
2. メタを別画面にする: 大きい構造変更が必要、今の編集経路を変える。
3. 毎nudge後に再scroll: 連続操作/番号や理由入力を跳ねさせるため採用しない。

的を主役に保つField Instrument既存ghostボタンをそのまま使用。新しい固定列/色/説明/縮小は加えない。調整の終了を近くへまとめ、詳細メタは下に保つ。Product gates: 座標修正から得点/履歴の関係を保持、成長比較の元データを確実に保存、完全local、日々の反復操作を一手減らす。既存handler/採点/schema/依存/SWactivation変更は不要。

## 計画と受入

1. 新しいcorrection-exit regressionを先に加え、old109の初期native chip選択/3回後の戻り5hit/rect/pixelのredを保存。320/375 light-dark/normal-reduce ×40cm3/122cm6、通知fixture、desktop。
2. テンプレートの2行順を入替、revealActiveCorrectionでパッドと解除の上下unionだけを測る。既存header/dock/toast境界と16pxmotion余白/instant scroll/呼出条件を保ち、nudge/meta/通常renderへ新scrollを追加しない。
3. Greenでnative解除→的→次矢→確定/終了・保存/reload旧履歴/座標を確認、反復/metadata入力中scroll保持。前後375原画像と代表320/明暗を表示しcopy一致、Chrome/WebKitも確認。
4. checkall/lint/format/全generated E2E・独立immutable review。版markers109→110一括、実公開旧profile保持更新banner/offline、新native解除のhit/rect/保存pixel、CI/実Linux-public25bytes/firstdocument15/canonical14を確認。
5. AN073だけpassと非empty evidenceを実公開後に記録。72oldtasks/acceptanceを保持しprogress/ledger更新、大目標active。

設計self-review: 既存ID/label/handler/dataのみ、採点半径/数学変更なし、詳細入力のscroll保持を旧回帰で検証。所有sandbox/Node22.19以外のinstallなし。全承認に基づくUX小修正、再承認要求なし。実iPhone/VoiceOver/全motionframes/閉鎖oldIAB等の回復は主張しない。

## 実装中に見つかった戻り経路

旧109 sourceの生成25資産は実CI Linux109と全byte一致（`artifacts/correction-exit-v110/baseline-parity.json`）。新exit testは初期選択後19/19で解除五点hitfalseをredとして保存した。3回後の旧native解除hiddenはAN072の2ケース観測が別証拠であり、新19redが3回後まで進んだとは扱わない。

最初の小修正ではexit19、WebKit19が通ったが、全体は`8 failed / 217 passed (2.8m)`。既存entry testの詳細入力→解除→別矢選択で320の8条件が失敗した。fresh診断JSONでは的y174〜378.46875、矢チップ388.46875〜428.46875、dock386〜480で、次矢chipの中心が取消buttonへhitした。元失敗browserは通常Playwright終了済み、このfresh診断を元context回復とはしない。

解除を詳細より前に移したことで、詳細入力後に解除へ戻るときのscroll方向が変わった。既存`revealActiveTarget`の的だけの下端合わせではチップが隠れるため、**同じ呼出・同じ境界の測定範囲を的と残存チップのunionへ広げる**。本タスク内の戻り操作の退行修正で、handlerや通常renderへのscroll追加はない。これを計画2に追加し、既存entryの全assert（メタ入力位置/得点/保存/次矢/エンド）を残して再検証する。診断pixelとJSONもtestへ残した。

最初のlintは所有一時WebKit configがrootの`*.js`へ入り4件no-undefで失敗した。所有configを`.cjs`へ移して、app/config変更なしでlint成功。元出力も保持する。

## 更新リハーサルの保持と回復

所有local109→110の更新・旧4件保持までは通ったが、追加した調整検証がdebounce前のlocalStorageを読んで座標assert失敗。元browser/contextを保持したまま、所有Node inspectorで読み取り確認するとmemoryと保存の両方がx0.6000000000000001、5ボタンと解除centerclear。初回resumeはmodule相対pathの誤りでUI操作前に失敗し、pathを修正して同じcontextへ再接続した。

矢調整の再tap・データreset・新contextへの置換をせず、元contextでnative解除→native次矢2本→SW offline reload→終了5件/旧4件exact→少数本結果と履歴→reloadまで回復した。元commandはexit1のまま、回復は別`local-update/recovery-complete.json`/`local-recovery.txt`として記録する。公開用の所有harnessは保存されたxをpollしてから検証する。appのdebounce/schemaは変えない。

## 画像

375/320明暗の旧初期選択・新初期選択・新3回調整後を12枚、加工せずbyte一致で保存/原寸表示した（`docs/screenshots/correction-exit-v110/`、source/hashは`artifacts/correction-exit-v110/images.json`）。戻りボタンが調整の直下にあり、dock/通知の上で押せる配置を確認した。全motion frame・実iPhone/VoiceOverを視認した証拠ではない。

公開/最終検証の結果は実行後に追記する。AN073はまだin-progress。
