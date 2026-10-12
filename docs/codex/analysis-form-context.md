# 分析の条件で射形を振り返る — AN087

基点0347bd10、公開v120/sourcebc51abc8。ユーザーのUI制約なし・全承認を継続し、費用/個人情報を使わない。所有worktreeと合成fixtureだけを使う。

## 設計

現在の射形cardは期間・用具・距離に関係なく全記録を使い、角度と長い自己比較labelを横並びにしている。案は共通filterを適用する、全記録と明記する、別画面へ分離するの3つ。既存機能の連携・同じ条件の成長・完全local・日常の短い操作という4 gatesから共通filterを採る。brainstormingの設計確認には既存の全承認を適用する。

射形の期間は撮影日のdate、なければ既存の日付helperのts fallback。日付不明は全期間だけ。用具/距離/roundは紐付いた練習の現条件を使い、練習がないとき用具だけは保存されたsetupIdを使う。距離不明を特定距離へ混ぜない。未指定は既存filterと同じ意味。保存内容は書き換えない。射形だけある場合も共通期間filterを出す。

一覧・弓手肘推移・自己比較・射形と得点の関係へ同じ選択済み配列を渡す。数学・推定・保存・撮影処理は変更しない。引数省略時は全記録を保持し、詳細sheetの従来比較も保持する。

見た目は既存Practice Noteの色を使い、件数→記録/動画action→推移→最新5件→得点の関係の順。日付/射数、弓手と引き手、保持/アンカーを縦の階層へ分けて320pxでも読めるようにする。長い説明は「比較の見方」detailsへ移し、絞り込みの根拠を読めるようにする。未記録と条件一致なしは分ける。同じid/handlersで詳細と削除確認へ進む。

## 順序と受入

1. 旧86tasksと実120のbefore Chrome/WebKit320/375明暗/900、条件変更時の漏れ、旧6fields/reload/errorsを保存する。
2. 50の表示filter adapterと47のcard/renderer引数、scoped CSSだけ変更。新回帰で期間7/30/90境界、用具/距離/未指定/孤立記録/ts/date不明/全解除/射形だけ/disabled、同じ母集団のグラフ・自己比較・scorelinkを確認する。
3. 変更前red→green、前後8contextと375原寸、詳細open/close・削除cancel・旧6fields/reload/errors0、他分析raw/KPI/数学/採点/保存/依存/SWactivation保持を確認。checkall/lint/format、check:formとgolden:form-fixtures、全生成E2E、独立readonly review。
4. 正本version:bumpで全markersを揃え、最終生成物をfreeze。承認済push、clean CI/全E2E、実Linux-public25/frozen19byte+6LF、同じ旧120pageで記録中更新保留→終了/banner→新記録/保存/offlineを確認する。
5. raw evidenceをbyte保持archiveし、受入後にのみAN087pass+evidence、progress/ledgerを更新。公開後notesはlocalcommit。物理phone/VoiceOver/fieldINP/実射は未証明として大目標activeを保つ。

自己review: placeholderなし、公開範囲/日付/孤立記録の扱いを明記。保存や解析を変えず、分析内の射形の条件と可読性を一タスクとして扱う。
