# サイト値0を概要と校正で残す — AN091

基点b63bc68b6708badbf0ac82703fdbf463656ffbde、公開123/source4b07d14eaa9a48bc21546722561021904f5365ab。前turnはAN090公開/全336/CI成功で進捗。所有worktree/合成fixture、費用/個人情報不使用、全承認/UI自由を継続。

## 設計

AN089でnumeric0がrecordSetupSnapshotの||で—、校正prefillの||で空欄、実input/台帳/補間には0と再現。legacy数値を文字へ移行、共通format関数へ統一、該当4式で0だけを明示保持する3案から最後を選ぶ。移行不要、既存の空/null/false/負数/非数値文字/escapeを変えず表示境界を直す。用具/サイト/練習/校正の接続、過去値を正確に振り返ること、完全local、毎日の入力の4gatesを考慮。

value === 0 ? 0 : value || fallbackとする。snapshotはfallback—、校正は空文字。文字0は既存通りtruthy。save handlersは既存のinput.trim/string保存のままで、0を手入力し直さず校正保存できる。画面/色/レイアウト/数学/保存形式/日時順序は変更しない。

## 実施と受入

1. 新6回帰を実123でred確認。320375900で上下左右0/台帳/snapshot/練習input/校正cancel/旧6/reload、値matrix、校正save/reload、練習start0/native1本finish保存/scoreを検証。
2. scripts50のsnapshot2式、60の校正prefill2式だけ変更。旧90/acceptance/sharedlock、全他source/math/scoring/storage/handlers/CSS/deps/SWactivationをguard。
3. ChromeWK320375明暗900のbefore/after/final/public各8で—/空欄→0の差、他サイト/分析HTML・latest/補間/校正計算と旧6fields/reload/errors0を比較、375原寸。checkall/lint/format/全生成E2E、独立readonlyreview。
4. 正本bump124/候補freeze、final124native8/104、承認済push/cleanCI/実Linux-public25/frozen19+6LF/同じ元public123page更新保留→finish/banner124→新記録/offlineSWreload。
5. 原red/最終raw/原寸PNG/hashをbyte保持archive、証拠後だけtaskpass+evidence/progress/history/localnotescommit、大目標active。物理phone/VoiceOver/fieldINP/実射は未証明。

自己review: 0と空欄を分離、曖昧日時/finite補間/全legacy shapeを勝手に再保存しない。brainstormingの比較からwriting-plansの手順を記録。

## 受入結果

AN091完了、公開v124/source17760d5370021124d4383941fd4033bc41ada5ed、branch codex/sight-zero-values。数値0のサイト値を練習開始snapshotと校正prefillで保持し、上下/左右とも—/空欄→0。50/60の4式だけnumeric0を明示し、文字0/null/empty/欠落/false/負数/文字/escapeは従来通り。校正保存は旧全marks prefix/他5fieldsを保持して新string0を追加、reload/練習snapshot0。practice start0→native1本finish→新session両軸string0/score/旧全件/reload保持。保存handler/schema/日時選択/補間は不変、全markers124一括。14scripts/全CSS・数学・採点半径・保存/handlers/依存/SWactivationは4式/版以外exact。ChromeWK320375明暗900のbefore/after/final/public各8で他record/sight/analysisHTML/latest/interp/regression/calibrationexact、snapshot/prefillの0だけ変化、旧6fields/reload/errors0/overflowなし/校正button44以上/実input可視を確認。corrected旧123red6→green6 passed (21.4s)、checkall/lint/公式format成功、local342 passed (3.9m)、CI38422877986 clean checks/validate/deploy/Linux342 passed (6.0m)。final124native8/104は旧3+新記録/nudge0.6/undo/score/reloadexact/errors0。独立readonlyreview Critical/Important0、各engine上下異なる型12組（±0/文字0/null/undefined/false/NaN/負数/text/HTML/Infinity/空白）で基点比較とcancel配列/保存不変。Minor文書方向表記は受入notesで訂正。実Linux/public25byte、frozen19byte+6allowlistedLF、held first15/canonical14一致。同じ元public123page/contextで記録中更新保留→finish4/banner124/旧全件→320新native/nudge3/解除/次矢2/offlineSWreload/finish5/結果分析履歴/reload/errors0。docs/codex/evidence/sight-zero-values-v124へ原helper/red失敗/訂正/最終raw/原寸PNG/source/hashをbyte保持archive。旧90tasks/acceptance/sharedhiddenlock保持、費用/個人情報不使用、大目標active。物理phone/VoiceOver/fieldINP/実射/WKstrictOfflineは未証明。

初plan helperはMarkdown backtickをJS template内でescapeせずSyntaxError、後続gitaddはpath不存在/commitはnothing、app編集前に停止。元start-initial-output保持、文字引用を訂正して設計commit後に実装。初red6のmatrixはglobalThis.dbがglobal lexical let dbへ届かずTypeErrorでも失敗、原log/context/testを保持。dbを明示globalcommentで参照しcorrected red6が本来の0差で失敗、green6/全342成功。追加欠落caseでは実property削除も検証。after/greenはbump前123、final/native/publicは124。計画書0→空欄は方向逆というMinorを—/空欄→0へnotes訂正。日時曖昧な最新/finite補間の値の由来、他legacy数値の意味は未変更の別課題。
