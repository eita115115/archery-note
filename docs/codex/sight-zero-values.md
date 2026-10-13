# サイト値0を概要と校正で残す — AN091

基点b63bc68b6708badbf0ac82703fdbf463656ffbde、公開123/source4b07d14eaa9a48bc21546722561021904f5365ab。前turnはAN090公開/全336/CI成功で進捗。所有worktree/合成fixture、費用/個人情報不使用、全承認/UI自由を継続。

## 設計

AN089でnumeric0がrecordSetupSnapshotの||で—、校正prefillの||で空欄、実input/台帳/補間には0と再現。legacy数値を文字へ移行、共通format関数へ統一、該当4式で0だけを明示保持する3案から最後を選ぶ。移行不要、既存の空/null/false/負数/非数値文字/escapeを変えず表示境界を直す。用具/サイト/練習/校正の接続、過去値を正確に振り返ること、完全local、毎日の入力の4gatesを考慮。

value === 0 ? 0 : value || fallbackとする。snapshotはfallback—、校正は空文字。文字0は既存通りtruthy。save handlersは既存のinput.trim/string保存のままで、0を手入力し直さず校正保存できる。画面/色/レイアウト/数学/保存形式/日時順序は変更しない。

## 実施と受入

1. 新6回帰を実123でred確認。320375900で上下左右0/台帳/snapshot/練習input/校正cancel/旧6/reload、値matrix、校正save/reload、練習start0/native1本finish保存/scoreを検証。
2. scripts50のsnapshot2式、60の校正prefill2式だけ変更。旧90/acceptance/sharedlock、全他source/math/scoring/storage/handlers/CSS/deps/SWactivationをguard。
3. ChromeWK320375明暗900のbefore/after/final/public各8で0→空欄の差、他サイト/分析HTML・latest/補間/校正計算と旧6fields/reload/errors0を比較、375原寸。checkall/lint/format/全生成E2E、独立readonlyreview。
4. 正本bump124/候補freeze、final124native8/104、承認済push/cleanCI/実Linux-public25/frozen19+6LF/同じ元public123page更新保留→finish/banner124→新記録/offlineSWreload。
5. 原red/最終raw/原寸PNG/hashをbyte保持archive、証拠後だけtaskpass+evidence/progress/history/localnotescommit、大目標active。物理phone/VoiceOver/fieldINP/実射は未証明。

自己review: 0と空欄を分離、曖昧日時/finite補間/全legacy shapeを勝手に再保存しない。brainstormingの比較からwriting-plansの手順を記録。
