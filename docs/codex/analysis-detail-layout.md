# 分析の詳細を選んで読む — AN085

基点1c8d06e98190e597365d4bf071593cc78189c65b、公開v119/source554892bccf962c30596d53b100940c069e69893f。前goal turnはAN084の実装・公開・更新/offline・証拠保存を完了した進捗。UI制約なし/全承認/通常公開の承認を継続し、所有worktree/Node22/sandboxだけを使う。費用/個人情報/外部font/依存追加なし。

## 確認と選択

実Linux119の所有12練習fixtureをChrome/WebKit320/375明暗/900の8contextで確認。先頭の比較条件/結論/次回/数値から、推移・サイト・理由・月別・距離別・得点内訳・PB・用具へ続き、全カードをlayoutした高さは4403〜5196px。375の距離グラフでは「最新平均/本」が複数行になる。データ計算を変えず情報の選び方と単位を整える。

採用: 下部の関連カードを3つのnative detailsへまとめる。「条件と理由」は風と理由、「練習の内訳」は月/距離/得点、「自己ベストと用具」はPB/用具。カード本体の既存HTML/計算/出現条件を保持し、開いた中は平らな区切りにする。内容がないgroupは出さない。初期は閉、summaryは64px以上でnative Enter/Space/tapと既存focus/reduced-motionを使う。既存の距離まとめ/サイトまとめ等はそのまま、二重accordionへ移さない。射形トラッキングは既存位置/全件仕様を保持し、scope整理は別タスク。

別案の横スクロール切替は内容を探す動線と状態管理を増やす。全カードを小さく詰める案は小画面の読みやすさを下げるため採らない。既存の比較条件/結論/次回/6数値/推移/サイトは常時見える。月別の平均列は「平均点」、見出しに「点/本」。距離グラフは最新値と「点/本・最新」を一まとまりにして改行を抑える。SVGのpath/circle/title/数値は保持。

Product gate: 得点・条件・用具を同じ振り返りへ結ぶ、変化とPBを見つけやすくする、全local、日々の詳細確認を短くする。brainstormingの再承認は既存の全承認/UI自由が優先、writing-plansへ進む。spec自己確認: 保存/計算/handlers/SWを変えず3groupと単位表示だけ、出現条件/空/期間変更/keyboardを受入へ含め、未決の実装判断なし。

## 順序と受入

1. 50に空bodyを除く純表示group helperを追加、renderAnalysisの既存7card呼出しを3groupへ入れる。各rendererの計算/出力は不変。60のmonthlyCard/distTrendCardは単位markupだけ変更。CSSはanalysis groupに限定、カード内をflatにする。
2. 所有UI回帰: 320/375/900、初期閉/内容保有/タップ開閉、空groupなし、条件/7日/該当なし/解除、Enter/Space/focus、単位が一行/横overflowなし、旧全sessions/setups/sightMarks/active/customRounds/formAnalyses/reload/errors0。旧119red→green、checkall/lint/format/全生成E2E、375前後原寸、ChromeWK8前後/最終/公開、raw計算/KPI/既存card本文/グラフSVG一致、native8/104、独立readonlyreview。
3. markers120をversion:bumpで一括、承認済CI/実Linux-public25一致、元119所有pageの記録中更新保留→終了banner→旧全件→新native/offline。CIのE2E開始後に旧資産15をwarmし、元pageを保持して鮮度内の更新を確認。
4. 旧84taskobjects/acceptance/sharedhiddenlock保持。成功証拠後だけAN085pass+evidence/progress/ledger。大目標active、物理iPhone/VoiceOver/fieldINP/WKstrictOffline未証明。公開後notesはlocalcommit。

## 最初のcapture訂正

初before8はデータ/条件/reload成功だが、content-visibilityのplaceholderへscrollした後に高さが変わり、月別を撮る意図のPNGが理由欄だった。元出力/PNG/JSONを保持。snapshot用だけでmainの先行カードをlayoutしてからscrollするようhelperを訂正し、別before-corrected8の375画像で月別表を確認。初defaultHeightも保存し、全カードlayout高さを実paint/fieldINPとは扱わない。`.claude/launch.json`は所有worktreeに不存在、所有static serverを使う。
