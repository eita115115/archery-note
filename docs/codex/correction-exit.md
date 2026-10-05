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

## 最終候補の検証

候補/sourceは`f967d12e96bdb113c8e1747236dcd3394d53f42d`。所有sandbox/Node22.19、生成dist、実DOM hitを使う。変更後の再検証出力:

```text
check:all (exit0)
Archery Note checks OK (v110)
check-globals OK (14 files, 1244 unresolved refs all accounted for)
Analysis core characterization checks OK
Robust median reuse checks OK
Form core checks OK
Form metric fixture checks OK
Form diagnostic checks OK
Gamification pure-function checks OK (streak / 12 badges / backfill / goals)
Few-coordinate result evidence checks OK (0/1/2/3, baseline, daily streak, data preservation)
Todays-result pure-function checks OK (weeklyDiff / stabilityTrend / personalBest / growthStreaks)
Security regression: all 38 checks passed
UI smoke checks OK (chrome.exe)
PWA asset checks OK
PWA update flow checks OK
Storage contract checks OK
Storage round-trip checks OK
Save debounce checks OK
Version alignment checks OK
Distribution checks passed:14 structures/names/order/source/regeneration; gzip JS 197151→139638 bytes; cross-script fixtures
lint (exit0, no findings)
format:check (exit0)
All matched files use Prettier code style!
test:e2e:dist:225 passed (2.8m)
focused correction-entry+exit:35 passed (2.4m)
WebKit correction-entry+exit:35 passed (2.5m)
PASS:72 prior tasks/all acceptance exact; dependencies/SWactivation/shared hiddenlock unchanged
```

最初の全体8失敗/217成功を消さず、戻り範囲の修正後に全225を再実行して成功した。採点/他矢/メタ入力scroll/次矢/確定/旧3件/reloadも両engineの35経路で確認。320詳細入力後の別矢chipはy338.46875〜378.46875（docktop386）、nativehitがchip本人へ戻った。before-second-selection pixel/JSONは旧entry testの各出力に保存。

独立readonly reviewer`/root/review_correction_exit`は同じimmutableheadを確認しCritical/Importantなし、code ready。非blocking minorはtarget revealの`childElementCount`が空エンドhintも数えるため、start/確定後はそのhintも測定範囲へ入ること。変更せず通った候補を保持し、空欄hintを除外したという主張はしない。画面の利用可能高さより範囲が大きい場合は従来どおり上端合わせであり、全下端同時表示の保証ではない。

12枚copy byte一致・原寸確認。新8枚は最終候補focused結果の原画像とも一致（`image-candidate-parity-corrected.json`）。最初の比較はWindows separatorの変換漏れで旧green画像同士を比べており、最終候補一致の証拠にせず、正しい`focused-final-results`へ解決して比較し直した。

この候補段階では、sourceをmainへpush後もCIと公開検証が終わるまでAN073をin-progress/passfalseに保った。最終結果は以下の実公開受入へ記録する。

## 実公開の受入（完了）

- source/main `f967d12e96bdb113c8e1747236dcd3394d53f42d`、[CI37247118554](https://github.com/eita115115/archery-note/actions/runs/37247118554) validate/deploy success。Linux出力 `225 passed (5.3m)`、実artifact11319403251、26regularfiles/dirだけを所有root内へ安全抽出。
- 実公開元109profile/旧3架空記録/native1/15旧HTTP bodiesを保持。normal max-age600、publication422058ms < 最短freshness597000ms、update完了checkpoint428751ms。練習中updatebar非表示、native終了後旧4exact/通知pixel、更新後APP/cache110/旧4exact。
- 同じprofileで320新開始native1、3回右nudge/scroll0、全5padbuttonと解除の五点hit/rectclear。解除は78×48・y266.46875〜314.46875、docktop386。native解除→的をnative tapし次矢2（修正済み最初の矢exact）→保存checkpoint→SWoffline reload旧4+active2exact→native終了5件/旧4+両矢exact→少数本結果/history/reload、pageerrors0。成功browser/context閉鎖。local失敗profileの置換ではなく、別の実public検証として区別する。
- 実Linux/public25assets byte-identical、保持profile更新firstdocument15body/canonical14scriptも実Linux一致。

```text
PASS:actual Linux26 regular files extracted within owned proof directory/no links
225 passed (5.3m)
PASS:all25 actual Linux/public110 assets byte-identical; all15 held-update first-document warm bodies match Linux
PASS: same real public109→110 context, active update blocked/native finish/old4 retained, 320 newstart first native arrow/correction/native exit/next arrow, offline SWreload exact / two-arrow pending in summary+history / old4 and finish5 exact
```

public banner/correction-entry320/correction-exit320/offlineの4原画像を原寸表示して目視、docsへ加工なしでbyte一致copy。全16代表画像保存/表示と最終候補PNG一致、実publicDOM五点hitは別根拠。採点/座標/数学/schema/handlers/依存/SWactivation不変（版markers110とlockrootmetadata整合のみ）。旧72task objects/全acceptance/sharedhiddenlockのaudit後、AN073のみpassと非empty evidenceを同時記録。大目標はactive、次は少数本dashboardのRMS/PB解釈監査。

実iPhone/VoiceOver/全motionframe/巨大履歴/旧閉鎖failure/WK厳密offlineは未確認。現サイズでのtarget/chip/解除表示は確認したが、物理的に表示範囲がviewportより大きい場合の全button同時表示を保証しない。原IABframe19の未再現重なりを今回の解除hidden fixで回復済みとはしない。
