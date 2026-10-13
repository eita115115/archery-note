# サイト予測と採用した実測を読む — AN092

基点8ab3de6375bb1d33c6a6fa159b2a186317274f25、公開124/source17760d5370021124d4383941fd4033bc41ada5ed。前turnはAN091公開/全342/CI成功の進捗。所有worktree/合成fixture、費用/個人情報不使用、全承認/UI自由を継続。

## 設計

旧画面は実測値・model・一致度の長い一行と予測chip、長い説明だけで、採用値の記録日が分からない。説明追加、全実測の常時展開、予測を先にして採用値をdetailsで確認する3案から最後を選ぶ。Practice Note v3の既存色/余白を使い、nested cardなし・平らな区切り/縦行とする。用具/台帳/練習の接続、過去値を正しく振り返ること、完全local、毎日の短い操作の4gatesを満たす。

予測は距離→目盛り値のread-only縦行、model/一致度/上下だけを短く表示。採用した実測detailsは初期閉、各距離の数値と実際のmarkの記録日を表示。新しい記録にfinite上下がない場合の過去値採用を明示。同日で時刻欠落/同日時/日付不明を含む場合の順序未確定も明示。予測の見方は別native detailsへ。summaryは44px以上、tap/Enter/Space/focus/reduced-motion/明暗/320px/長文字escapeを保持。

台帳のbadgeは日時が明確で最上位が一意なら最新。同日の時刻不足、最上位timestamp同率、日付不明を含む場合は同日・時刻不明/同日時の記録あり/順序未確定へ替える。並びや選択・保存値を変えず、理由を短い補足で示す。

core sightInterpは同じdate昇順+ts昇順・parseFloat有限値の最後の候補を維持する。sourceByDistをnull-prototype objectで記録し、元のraw distance keysを同じnumeric stable sortに通したkeysからptsとsourcesを対応させる。numeric30と文字030のような同じnumeric距離の別keyでも元identityを取り違えない。sourcesは元mark参照の表示用metadataだけ、保存しない。regress/quadraticFit/モデル選択/推定関数は変更なし。

表示側はraw distance keyで一度group化しstatusを計算、source各行で全marksを再filterするO(n×距離数)を避ける。既存parseFloatの数値採用規則を新しいvalidationへ置換しない。日時から実際の練習順を推測しない。

## 実施と受入

1. 新6回帰を実124でred確認。320375900の予測/実測date/0/過去採用/keyboard/旧6、metadata identity/leading-zero key/既存math、曖昧badge、用具距離/2未満/全定番/escape/追加校正cancelを確認。375原寸beforeを保存。
2. scripts40にmetadata、60に純表示helper/ledger badge/予測wrapper、scoped CSS/生成CSSだけ。数学の点列・model/r2/est・全他関数/採点半径/保存/handlers/deps/SWactivation、旧91/acceptance/sharedlockをguard。
3. ChromeWK320375明暗900で通常/最新上下blank/同日時/日時不明/全実測を前後比較し、生のpts/have/model/r2/est/latest/advice/regression/calibration・他HTML・旧6fields/reload/errors0を保持。初期閉/全文/44px/focus/overflow/重なりを確認。checkall/lint/format/全生成E2E、独立readonlyreview。
4. 正本bump125/候補freeze、final125UI/native8/104、承認済push/cleanCI/実Linux-public25/frozen19+6LF/同じ元public124page更新保留→finish/banner125→新記録/offlineSWreload。
5. 原red/訂正/最終raw・原寸PNG/hashをbyte保持archive、証拠後だけtaskpass+evidence/progress/history/localnotescommit、大目標active。物理phone/VoiceOver/fieldINP/実射は未証明。

自己review: source metadataは同じ実測採用iterationから取得して推測しない。値や計算を変えるtaskに広げず、日時不明は判断不能として示す。brainstormingの比較とwriting-plansの順序をここへ記録。
