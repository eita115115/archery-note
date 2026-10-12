# 分析のサイト欄を比較条件に揃える — AN084

基点541cf5e0、公開v118/sourcebcaf4932。前回AN083は公開まで進捗あり。全承認/UI制約なし/通常公開の承認を継続。所有worktree・Node22・sandboxだけを使い、共有依存のinstall/ci/update禁止、費用と個人情報を使わない。

## 確認と設計

実Linux118、Chrome/WebKit320/375明暗/900の8contextで、用具A/30m/7日にも他用具18m・10日前・日付なし・用具未指定の台帳が混ざることを再現。練習データのssは既にfilterAnalysisRowsを通るが、sightHistoryCardとsightSummaryHtmlはdb.sightMarksを全件読む。該当練習0件にも全台帳が表示される。

採用: 分析の台帳もfilterAnalysisRowsで同じ用具・距離・期間・round条件へ絞り、既存2rendererへ渡す。日付は既存sightDateInfoの日付/tsフォールバックを使う。期間指定中の日付不明は除き、全期間では残す。roundを指定した場合はround不明の台帳を混ぜない。各markを包んだ表示用rowで絞り、保存したmark自体は変更しない。

別案は全件台帳へ別見出しを付けることだが、先頭の比較条件と異なる母集団が同じ分析に並ぶ。全件台帳を削る案も既存の使い道を失うため採らない。履歴など他の呼び出しは従来の全件/default仕様を保つ。

Product gate: 得点・用具・サイトの比較条件を結ぶ、成長の比較を同条件へ揃える、全local、毎回の振り返りで条件を信頼できる。採点/半径/数値計算/保存schema/依存/SWactivationは保持。射形トラッキングは独立収集の全記録表示で別途scopeを明示する必要があり、今回の変更には混ぜない。

## 実装と受入

1. 50に表示用analysisSightMarksを追加。renderAnalysisから絞ったmark配列をsightHistoryCard/sightSummaryHtmlへ渡し、両rendererは省略時の既存db.sightMarks仕様を保持。全条件解除時は表示全文が実118と一致。CSS/数学/保存/採点/他runtime/全handlersを保持。
2. UI回帰で用具/距離/未指定、7/30/90日の下限内外、ts日付、日付不明、該当なし、全期間復帰、旧sessions/setups/sightMarks/active/customRoundsのreload一致/errors0を確認。実118red→green。ChromeWK320375明暗900の前後/最終/公開と375原寸、計算/KPI一致。native8/104、checkall/lint/format/全生成E2E/独立readonlyreview。
3. markers119をversion:bumpで一括、承認済公開CIと実Linux/public25一致、元118context記録中更新保留→終了banner→旧記録保持→新native/offlineを確認。
4. 旧83taskobjects/acceptance/sharedhiddenlockを保持し、証拠後だけAN084pass+evidence/progress/ledger。大目標active。物理iPhone/VoiceOver/fieldINP/WKstrictOffline未証明。

初probeの訂正: chromium320の結果1件後、375の条件解除でrecord空を検出した。各select後のfocus scroll/animationを待つ前に次のtapを送るharnessの競合を疑い、settleを各操作の間へ追加し、disclosure開閉に依存しないtextContentへ訂正。元失敗出力/結果/画像を保持し、別before-corrected8contextで全条件復帰・旧5fields/reload/errors0を確認。元失敗の直接のhit先は未記録で、原因は断定しない。skillが参照する旧docs/ui-design-language.mdは不存在、rgで現在のdocs/design/ui-design-language.mdを発見しv3を確認。
