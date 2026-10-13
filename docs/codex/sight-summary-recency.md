# 分析の最新サイト値を記録時刻へ揃える — AN090

基点661bee90ed6e824d27e8b846e7c2e25b869566e8、公開122/source2ce72647d10f2b1088ab7ea957e190b7a0139871。前turnはAN089の監査で不整合を実表示/復元まで特定した進捗。所有worktree/合成fixture、費用/個人情報不使用、既存全承認/UI自由を継続。

## 設計

分析summaryは同日台帳の後勝ちでtsを無視し、逆配列で台帳/prefill/補間90対分析80。共有coreの全順序統一、常にappend順へ統一、分析表示内だけ明確な時刻を比較する3案から最後を選ぶ。保存/復元/補間/台帳を推測で変えず、明確な日時の信頼を回復する。用具・練習・分析の接続、過去値の振り返り、完全local、日々の入力の4gatesを満たす。

比較は既存date.sort優先。同じ日付の台帳同士で両方の明示dateがsortと一致し、tsがfinite正数なら小さいtsで上書きしない。同tsは従来通り後勝ち。日時なし/一方欠落/不正ts/tsだけの日付fallback/台帳対練習は既存分岐へ戻る。未知日時が混ざる群全体の絶対的な最新を証明する変更ではない。空上下はrowとして最新を保持し、finiteな上下実測点の選別へ変えない。numeric0校正/snapshotは別タスク。CSS/markup/レイアウトは不変。

## 実施と受入

1. 新6回帰で通常/逆順/date優先/同時刻・欠落/不正/空値0/台帳対練習/用具距離/period/native削除復元を検証し、実122で意図したredを保存。
2. scripts/50-record-view.js のsightSummaryHtml内の候補選択だけ変更。全他node/他scripts/CSS/数学/採点/保存/handlers/deps/SWactivationをguard、旧89/acceptance/sharedhiddenlockを保持。
3. 実Linux122beforeと候補after、ChromeWK320375明暗900でanalysisの値・台帳/latest/prefill/補間/他分析HTML・旧6fields/reload/errors0を比較、375原寸を保存。checkall/lint/format/全生成E2Eと独立readonlyreview。
4. 正本version:bumpで123を一括、候補freeze後checkall/全生成E2E、final UI/native8/104、承認済push/clean CI/実Linux-public25/frozen19+6LF/同じ元public122page更新保留→finish/banner123→新記録/offlineSWreload。
5. 原失敗/最終raw/原寸PNG/hashをbyte保持archive。証拠後だけtaskpass+evidence/progress/history/localnotescommit、大目標active。物理phone/VoiceOver/fieldINP/実射は未証明。

自己review: 曖昧な旧記録の時刻を捏造せず、今回直す比較条件と残すfallbackを分離。計算・保存・UI刷新を混ぜない。brainstormingの比較を踏まえwriting-plansの手順をここへ保存。
