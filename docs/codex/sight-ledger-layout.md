# サイト台帳をスマホで読む — AN088

基点42e11058、公開v121/sourcee57893001888fa4ab5c4b97087c1084a34d4c034。前turnはAN087公開・全324・CI成功の進捗。所有worktreeと合成fixtureで進め、費用/個人情報は使わない。既存の全承認とUI自由を継続し、brainstormingの追加承認は求めない。

## 設計

実v121のサイト台帳は5列。合成の長い通常メモでChrome320pxの一行615px、375px270pxまで伸び、数値がメモの中間に埋まる。横スクロール表、メモ別行の表、日付/値/メモの縦一覧の3案を比較し、縦一覧を選ぶ。既存の用具・サイト・練習との接続、成長を振り返る過去値の読み取り、完全local、日々の短い操作の4gatesを満たす。Practice Note v3の色と余白を継承する。

一覧は日付と「最新」、削除action、上下/左右のラベル付き値、メモの順。メモはnative detailsで初期閉、必要時に全文を開く。空メモには空の操作を出さない。値の単位を推測せず、0と空欄を区別する。最新は既存のdate sortの先頭と同じ意味で、実際の使用中とは断定しない。追加/校正/距離/用具/削除確認/ごみ箱の既存handlerとidは保持する。全保存形式・物理/補間/調整/分析の計算は変更しない。

## 順序と受入

1. 実v121のChrome/WebKit320/375明暗/900のbeforeと合成fixtureを保存。旧87tasksとacceptance/shared hiddenlockを保持。
2. renderSight内の台帳markupだけを純表示helperへ移し、scoped CSSと生成CSSを揃える。新回帰は320/375/900、短/長/空メモ・0/空値・escape・最新/sort・用具/距離切替・追加/校正入口・詳細tap/keyboard/focus・削除cancel/confirm/gomi復元・reload/旧6fields/errors0。red→greenで機能を検証。
3. 375原寸の前後と8contextの最終表示を保存。全文を開いても横overflow/重なりなし、閉状態の行がメモ量に依存せず、操作は44px以上。台帳以外の表示/計算と他runtime関数/採点半径/保存/handlers/依存/SWactivationを保持。checkall/lint/format/全生成E2E、独立readonlyreview。
4. 正本version:bumpで122へ全markersを揃える。候補freeze後に承認済push、clean CI/全E2E、実Linux-public25/frozen19byte+6LF一致、同じ元public121pageで記録中更新保留→終了/banner122/旧全件→新記録/offlineSWreload確認。
5. 原失敗/訂正/最終証拠をbyte保持archive。受入後のみAN088pass+evidence、progress/ledger更新、公開後notesはlocalcommit。物理phone/VoiceOver/fieldINP/実射は未証明として大目標active。

自己review: 日付の意味と0/空欄を明確化、初期閉/空メモ非表示/全文keyboardを指定。placeholderなし、保存や調整計算へ範囲を広げない。

## 受入結果

AN088完了、公開v122/source2ce72647d10f2b1088ab7ea957e190b7a0139871、branch codex/sight-ledger-layout。サイト台帳を日付/最新→上下・左右のラベル値→必要時に全文を開くnativeメモdetailsの縦一覧へ。0/空欄を区別、空メモ操作なし、escape/keyboard/focus/44pxを保持。実v121の長い通常メモはChrome320で一行615px、375で270px、final/publicの閉じた各行は220px未満。全体高さが全幅で減ったとの主張ではない。60の純表示helper+台帳markup、12scopedCSS/生成CSSと一括122のみ。他21nodes/全他scripts・数学・採点半径・保存/handlers/依存/SWactivationは版以外exact。ChromeWK8x5statesで用具/距離/該当なし/復帰と他HTML/advice/regression/interpolation/calibration/選択ID一致。旧121でlist回帰1failed→新6 passed (14.1s)、final checkall/lint/format成功、local330 passed (3.9m)、CI38326751775 clean checks/validate/deploy/Linux330 passed (6.3m)。final122 native8/104は旧3+新記録/nudge0.6/undo/score/reloadexact/errors0。ChromeWK320375明暗900のbefore/after/final/public各8、メモ全文/tap/Enter/Space/削除cancel/追加校正cancel/旧6fields/reload/errors0、削除confirm・ごみ箱復元は新回帰で保持。独立readonlyreview Critical/Important/Minor0。実Linux/public25byte、frozen19byte+6allowlistedLF、held first15/canonical14一致。同じ元public121page/contextで記録中更新保留→finish4/banner122/旧全件→320新native/nudge3/解除/次矢2/offlineSWreload/finish5/結果分析履歴/reload/errors0。docs/codex/evidence/sight-ledger-layout-v122へ原失敗/訂正/最終raw・原寸PNG・metadata/hashをbyte保持archive。旧87tasks/acceptance/sharedhiddenlock保持、費用/個人情報不使用、大目標active。物理phone/VoiceOver/fieldINP/実射/WKstrictOfflineは未証明。

初start helperは旧全tasksのpassを誤要求し既存AN001実射openで停止、直前依存AN087だけへ訂正し旧87は変更なし。初capture helperは存在しないsimpleAdviceを呼びbefore失敗、正本adviceForへ訂正したbefore8で比較成功。初lintはtest内document/innerWidth未修飾3件、globalThis修飾のみでassert/app不変、final lint/全330成功。旧tableに新listのIDを要求したred1を保存、実UXのbeforeは615px行で別に示す。after/greenはbump前v121、final/native/publicは122として区別。whole-card画像の一部にfixed bottom navが途中へ写る撮影制約があるためviewport/幾何/native操作を併用。sortは既存date降順+ts降順を保持。日時とも同じ/欠落の旧記録tieと補間の後勝ちの意味は既存の別task候補、今回の計算変更なし。
