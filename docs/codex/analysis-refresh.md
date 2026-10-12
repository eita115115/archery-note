# 分析の入口を整える — AN083

基点0e83dea7、公開v117/source3a1e6d05。前回は履歴UIを公開して進捗あり。UI制約なし/全承認/通常公開の承認を継続。所有worktreeで一タスク、費用・個人情報不使用。

## デザイン

実Linux117・Chrome/WebKitの320/375明暗/900で、6つの数値が結論より先に並び、用具/距離/期間は画面下に隠れることを確認。条件を先に示し、傾向→次の練習→数値へ読む順を採用。折りたたみフィルタ案は条件を見失いやすく、数値中心案は現状の迷いを残す。

比較条件カードを先頭へ。用具/距離/期間の操作と値は同じで、見出し「比較する条件」、期間のgroup名を付ける。「今日の結論」は選択期間に対応する「練習の傾向」へ。傾向を大きい本文と淡い面、次回試すことを読みやすい本文、詳細数値を後続へ。growthカードの見出しは「練習のまとめ／数値で振り返る」。数値6項目は削らず既存値のまま。

WebKitの微小な負差で「改善0.0cm」と出ることを保存済みbeforeで確認。グルーピング変化の方向ラベルだけを表示精度（0.1cm）に合わせ、丸めた表示が0.0なら横ばいとする。nullは比較待ち、元のdelta/RMS/計算/保存は不変。

Product gate: 得点/座標/用具/既存の次回提案を同じ順で結ぶ、成長比較を保つ、全local、毎日の振り返りを短くする。新指標/外部通信/依存追加なし。

## 手順と受入

1. 50の分析markup/順序とstyle.cssの分析専用規則を変更。handlers/focus/keyboard/period/filter/数学/保存schema/採点/依存/SWactivation保持。0表示の方向の境界回帰と、375/320で条件と傾向が見える回帰を追加。
2. ChromeWK320/375明暗/900の前後/最終版、条件/期間変更・該当なし・旧全件reload/errors0、既存計算値の前後一致、375原寸。条件なしの空データも確認。記録native/backupの既存全回帰と全生成E2E、checkall/lint/format/独立readonlyreview。
3. 全markers一括118を専用commit。承認済みCI、実Linux/public25資産一致と元117context記録中更新保留→banner→旧記録保持→新native/offlineを確認。所有native証拠と分析captureは別directoryで保存する。
4. 旧82taskobjects/全acceptance/sharedlock保持。成功証拠後だけAN083pass+evidence/progress/ledger。大目標active。物理iPhone/VoiceOver/fieldINP/WKstrictOfflineは未証明。

自己レビュー: 今回は分析入口の情報階層。グラフ以下の全カードや分析ロジックの再設計は別タスク。既存承認があるため追加確認待ちは置かない。

空画面の補足: 既存の記録CTAが詳細数値より後にあるため、同じid/handler/文言を「次回試すこと」直後へ移す。二重idを避けるため旧fallback内からは除く。記録ありの該当なしでは出さない。初helperの「既存CTAなし」は誤りで、実117では1個あり、訂正4contextに位置と往復を保存。初empty E2Eはdemo後にlocalStorageだけを書き換え、起動時pending saveで元の架空3件へ戻ったfixture不備。新規所有contextのguard付き初期化へ訂正後、CTAが画面下で見えないredを確認。保存やスナップショット機構の障害ではない。

## 結果

AN083完了、公開v118/sourcebcaf493223c5545d93ed3f7878709bf5e4436af1、branch codex/analysis-refresh。分析入口を比較条件→練習の傾向→次回試すこと→6数値へ整理、期間group/keyboard/focus/handlers保持。0.0cmへ丸める変化は横ばい、null比較待ち、元delta/数学/保存/採点は不変。空画面の既存記録CTAを初期viewportへ移し二重idなし。50の5rendererと分析専用CSS/生成CSSのみ、他94top-levelnodes/全runtime/version以外/SWactivationexact、CSSappend-only。境界red3/51→51checks、emptyの訂正red1→focused32passed23.8s、local全305passed3.8m/checkall/lint/format、lint1件document未修飾をtestだけglobalThisへ訂正後9passed8.0s。ChromeWK320375明暗900のbefore/after/final118/public計32analysiscontextはfilter/period/no-match/旧全件reload/errors0、raw計算+KPI全一致、別contrast8の全対象>=4.5。empty訂正before/after/final各4はCTA1/route/旧全件reload/errors0、finalはnav上へcontain。final118native8/104は旧3+新3/nudge0.6/undo/score/reloadexact/errors0。独立readonlyreview指摘なし（初review時点full/final118/public未確認、後続test1行静的reviewのみ）。CI38240705693 validate/deploy成功/Linux305 passed (5.8m)、実Linux/public25byte・frozen19byte+6LF・first15/canonical14一致。元public117context publication470208ms、active更新保留→finish4/banner118/旧4exact→320新native/nudge3/解除/次矢2/offlineSWreload/finish5/結果分析履歴/reload/errors0。docs/codex/evidence/analysis-refresh-v118へraw失敗/訂正/最終/原寸PNGをSHA一致copy。旧82tasks/全acceptance/sharedlock保持、費用個人情報不使用、大目標active。物理phone/VoiceOver/fieldINP/WKstrictOfflineは未証明。

検証の訂正: 初empty helperは既存CTAなしと誤って期待しactual1でfail、訂正before4で既存CTA位置と往復を保存。初empty E2Eはdemo後localStorageだけ変更してpending saveに上書きされたfixture不備、fresh所有context/guard付き初期化で訂正し実際のviewport不可をred確認。保存・snapshotの障害とは扱わない。初lintは追加testのdocument未修飾1件、globalThis修飾のみでassert/app資産不変、全305は修飾前同一appに対する証拠、修飾後focused9と公開Linux全305で確認。各失敗の元出力を保持。capture出力のold7fieldsはラベル誤記で、実際の比較はsessions全件/setups/sightMarks/activeの4top-levelfields。公開更新proofはcustomRoundsを含む5fields、nativeはsessions全件と新座標得点を比較。
