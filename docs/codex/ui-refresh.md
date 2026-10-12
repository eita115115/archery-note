# UI刷新 — AN079

基点65a22c4c、公開main/source3259d88/v113。前AN078は性能修正と公開検証を完了した進捗。ユーザーはUI一新・UIには制約なしと明示し、全承認と費用/個人情報不使用を継続。旧v2の紙色/金線/8px角丸/見出しサイズ制限は今回の判断を拘束しない。追加承認待ちは置かない。

## デザインと比較

採用は白い面と深いグリーンのスポーツノート。冷たい灰緑の地、白い操作面、濃い文字、緑の選択/主操作、丸い入力部品、端に揃えたナビで構成する。明るい画面でも読め、記録/結果/設定が一つのアプリとして見える。dark/auto/射場モードも同じ階層と高いコントラストを持つ。

他案は墨と紙色を磨く案（変更少だがユーザーの一新の要求に弱い）、全面darkの競技計器案（個性は強いが日中の練習とlight設定を損なう）。主役は開始時の開始操作、記録中の的、結果の数値。装飾写真や外部font、依存追加はしない。

Product gate: 得点/座標/用具/成長比較の既存情報を同じ視覚階層で結ぶ、結果と成長の表示を維持、全local、毎日の入力を読みやすくする。新しい分析や機能追加はなく、日常の操作数は増やさない。

## 今回の一タスクと実装手順

1. 現行main/clean worktreeを確認し、原Linux113の375前画像（開始/記録中/結果/設定）を所有架空データで撮影する。旧design言語の正本はdocs/designにありskillの旧pathは不存在、rgで発見した。初rg scripts/*.jsのWindowsglob失敗も検索訂正で解決、アプリ障害ではない。
2. style.cssの視覚tokenをlight/dark/auto/fieldで揃え、共通header/nav/button/input/card/sheetと記録開始/HUD/target/調整パッドを刷新する。既存CSSへ一つの明確なv3区画を置き、機能ロジックへ手を広げない。50は記録開始の見出しmarkupだけ、indexはchromeの視覚/metadata整合だけを必要に応じて変更。動的な座標/色/拡大倍率styleは保持する。
3. 375/320とdesktopで実画面を見て、同じ操作で前後を比較する。意味のある既存viewport/contrast/record/modal回帰と全生成E2Eを使う。新規の見た目だけを写すテストは作らない。Chrome/WebKitのnative開始→矢→選択→微調整→解除→次矢→エンド→undo/終了、旧全件/score/座標/reload、設定/backup経路の既存回帰を確認する。
4. check:all/lint/format/全E2E、独立readonly差分review。版markersは公開直前に一括bumpし別commit、承認済み公開CIと実Linux/public資産一致、同じ旧113contextでactive更新保留→banner→旧記録保持→新native/offlineを確認する。
5. 旧78taskobjects/全acceptance/共有hiddenlockを保持し、公開証拠後だけAN079 pass+evidence、progress/ledger更新。費用/個人情報不使用、大目標active。

## 受入と境界

これは共通視覚基盤と記録画面の刷新という一タスク。全画面の情報設計を完了したとは呼ばない。採点/半径/物理/数学/cache/保存/schema/handlers/SW activation/依存/CIは不変。backup/import/destructive操作の警告を残す。target・ドック・ナビ・選択解除が狭い画面で重ならず操作できること、明暗とfieldの文字コントラスト、旧記録と新入力の保存一致を検証する。

旧容量警告のsummaryへの重なりは現行baselineを保持し、UIを変えたことで直ったと未検証で主張しない。必要な位置修正は別タスク。実iPhone/VoiceOver/fieldINP/GPU/WKstrictOffline/既存native依存critical2件/旧閉鎖profile回復は未証明。

自己review: placeholderなし。静的な見た目と動的な採点styleを区別。ユーザーの制約なしはデータ削除/費用利用の許可ではない。広いUI一新の最初の視覚基盤を、残る各画面の情報設計完了へすり替えない。既存の全承認に基づき設計から実装まで続行する。

## 初期実装の検証経過

beforeは実Linux113/375明暗・320・desktopの4contextでnative3本→終了/旧3件+新1/reload/errors0、375開始/記録/結果/設定原寸を保存。初実装helperはstyleを書いた後、50のCRLFでheading置換assert失敗。Node24のerror formatterがacorn Unicode escape SyntaxErrorを出し元assertを隠したが、helper自体のnode --checkは成功、50がCRLF2789個・LF正規化後needle一致を確認。styleだけ適用された状態で、50 headingはapply_patchで追加。元helperを再実行してCSS重複を増やしていない。

初afterはnative-web buildが既存style.min.cssをcopyするため旧CSSのまま。beforeの回復/新UI検証と呼ばない。rootで既存build:web-assetsを実行してからsandbox sync/build、別candidate1へ4contextを再実行し成功。候補375light idle/active/settings・dark active・320activeを原寸表示し、更新配色/部品/headingの実反映を確認。初after rawと出力は保存して区別する。

focused生成E2Eはviewport/contrast/modalの18passed36.3s。追加native helper初回は3nudge後のlocalStorage値を2rAFだけで読み600ms debounce前の旧値をassertして失敗。元failure/outputを保存し元owned processを停止、timeout起因の再起動ではない。保存実装は不変、訂正版helperはhasPendingSaveがfalseになる実条件を待ち、Chrome/WebKit320375明暗8context/104native actions、nudge0.6cm/undo/score/旧3+新/reload/errors0でexit0。結果light/dark設定/desktop原寸も閲覧、darkのheroMetricが参照するglass tokenだけ新暗色へ整合した。

immutable9d7a11のfull生成回帰は20件のanalysis nav four-corner判定に失敗し、44件までの元出力/error-contextを保存して原因確定後に停止した（全298完走/成功とは呼ばない、timeoutでの再起動ではない）。8theme/field contextの実computed contrastは全7対象4.5以上・field補助文字7以上、同時にnav右下4pxのhit falseを実測。14px角の中心(14,14)から(4,4)までsqrt200>14で外になることを独立reviewも確認し、同じbtn/開始/ナビの角を12pxへ揃えた。角の検査点やテストは弱めていない。元contrast.json/outputを保持し、訂正後は別出力へ再検査する。

5017965の全298は294passed/4failed8.1m、4件は360/375明暗のtouch-controls最終設定tap(position3,3)でheader intercept。gearの新50%角丸が3px点を円の外へ切るためで、テストtimeoutだが単なるtimeout起因restartをせず原因修正へ。元full出力と4error-contextを保持。円形の塗りはradial-gradientへ移し、button自体はradius0の矩形44pxを保つ。handler/test/labelを変更せず、smallphone edge tapを守る。全チェックと全生成E2Eを別release出力へ再実行する。
