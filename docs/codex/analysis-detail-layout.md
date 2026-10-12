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

## 結果

AN085完了、公開v120/sourceafe4f1b91d4bbc8a46bc3fdd475b25acfb493dda、branch codex/analysis-detail-layout。分析下部の既存7cardを「条件と理由」「練習の内訳」「自己ベストと用具」の3native detailsへ整理。初期閉/空group省略/64px以上summary/tap-Enter-Space-focusを保持し、内側をflatにした。月別は平均点+点/本、距離は最新値+点/本・最新を一行へ。比較条件/結論/次回/6数値/推移/サイト/射形の全件scopeは保持。50のwrapper+純表示helper、60の2markup、scopedCSSと一括markers120だけ。その他99nodes/全計算/採点半径/保存/handlers/依存/SWactivationはversion以外exact、ChromeWK8x3statesのrawdashboard/conclusion/next/KPI/7card HTML+SVGは2単位markup以外exact。所有12記録の全cardlayout高さ375で4768→3767px（実paint/fieldINPではない）。旧119red1→新6を含むfocused23passed10.0s、最終local317 passed (3.9m)、checkall/lint/format、final120native8/104旧3+新3/nudge0.6/undo/score/reloadexact/errors0。ChromeWK320375明暗900のbefore/after/final/public各8で旧sessions/setups/sightMarks/active/customRounds/formAnalyses/reloadexact/errors0。独立readonlyreview指摘なし（review時点serial全317/publicは未確認）。CI38318744208 validate/deploy成功/Linux317 passed (5.4m)、実Linux/public25byte・frozen19byte+6LF・first15/canonical14一致。CI E2E開始後にwarmした同じ元public119page/contextでpublication329376ms、active更新保留→finish4/banner120/旧全件exact→320新native/nudge3/解除/次矢2/offlineSWreload/finish5/結果分析履歴/reload/errors0。docs/codex/evidence/analysis-detail-layout-v120へ元失敗/訂正/最終raw・原寸PNGをSHA一致copy。追加ChromeWK明暗4contextの3groups Enter/Space/focus-visible/旧6/errors0も成功。旧84tasks/全acceptance/sharedlock保持、費用/個人情報不使用、大目標active。物理phone/VoiceOver/fieldINP/WKstrictOfflineは未証明。

初local全317は315passed4.1m/起動待ち2timeout、両snapshotは記録UI前のloadingfallback。同じ配信distをcheckall/checkdistributionが同時再生成していたため、元errorcontext/出力を保持し、生成終了後にapp/全assert不変で単独全再実行。network traceがなく同時生成との因果は断定しない。初card invariant helperはr.sessionを誤参照しdate undefined、正本r.sと同じsortへ訂正した別before-invariants-corrected8で成功。初captureのplaceholderずれも元/訂正PNG保持。capture比較用だけ日付2026-10-12固定、host日付変化後の期間境界を一定にしユーザー時計は変更なし。初review agentはusage limitで終了、費用不使用のままhost日付進行後同reviewerを再実行し成功。

公開後notesの初formatは文書2件とraw error-context.md2件でfail。文書だけPrettier整形、raw2件は元bytesを変えず.md.txtへrenameしmanifestを更新。次formatはsyncが残した旧.mdコピー2件でfail、所有sandbox内/元bytes一致/正本不存在を確認してその2コピーだけ除去、最終format成功。原失敗出力も保持、runtime/public資産不変。
