# 記録中の操作名を一行で読む — AN081

基点704c1321、公開v115/source20f19429609d1c6a0445ee5d6b63d2ec9a095e0c。前AN080は公開と容量案内改善を完了した進捗。所有worktree/Node22/sandboxを継続、共有node_modulesへinstallしない。ユーザーのUI制約なし/全承認を継続し、費用と個人情報は使わない。

## 根拠と設計

実Linux115でChrome/WebKitの320/375/900を撮影。320だけ「1本取消」が2行、幅84.140625pxに左右16pxのpaddingで文字が収まらない。375/900は1行。6contextのbaseline.jsonとPNGを保持、pageerror0。skillの旧docs/ui-design-language.mdは不存在、docs/designの旧v2とdocs/codex/ui-refresh.mdの現行v3方針を確認した。

採用は左右の補助操作を内容に必要な幅へ、中央のエンド確定を残り幅へ配分する配置。ドック内側10px、gap6px、ボタンの横padding8px、48px以上のhit領域、nowrapで一行とする。文言と15pxの文字サイズは変えない。20pxの文字でも320に収まるか実測し、結果を見て必要なら配置を訂正する。文言短縮は意味の手掛かりを減らし、アイコンだけの案は初回認識を難しくするため今回採らない。

Product gate: 記録から成長比較への毎日の入力を保ち、結果の情報を変えず、全local、操作の識別を速める。既存3操作の表示だけが対象。ユーザーの全承認に基づき設計・実装・公開を継続する。追加承認待ちは置かない。

## 手順と受入

1. baseline6の実値と前画像を保存。所有CSS一時overrideで配置と20px文字を実測する。
2. style.cssのv3ドック区画と生成style.min.cssのみ変更。ボタンの順序/文字/handler/target/score/数学/保存/schema/依存/SWactivationは不変。
3. Chrome/WebKit320/375/900と320の20px文字をnative開始→矢→取消→矢→選択/nudge→解除→次矢→エンド→次エンド→終了で確認。一行/文字containment/48px/five-hit/非重複、旧3+新矢座標score/reloadexact/errors0、原寸375前後を保存。既存関連E2Eとcheckall/lint/format/全生成E2E、固定差分の独立readonly review。見た目を写す新規specは追加しない。
4. 全markerをversion:bumpで一括更新し専用commit。承認済みpush/公開CI、実Linux/public25資産一致、元115contextで記録中更新保留→finish/banner→旧記録保持→新native/offlineを確認する。
5. 旧80taskobjects/全acceptance/sharedhiddenlockを保持し、公開成功証拠後だけAN081pass/非空evidenceとprogress/ledger更新。公開後notesはlocalcommitのみ。

自己review: 一タスクの範囲と受入は明確、placeholderなし。文字の切り捨てや縮小で達成したとしない。物理iPhone/VoiceOver/fieldINP/WKstrictOffline、全画面の情報設計は未証明のまま。大目標を今回だけでcompleteにしない。

## 実装中の検証

所有CSS overrideの8表示で通常15px/320の20pxとも一行。実装はv3のdock規則とbutton規則だけ。初nativeは最初のエンド確定後の寸法assertで停止、元page/processを保持して再計測した時点では48px。最初の矩形を保存できておらず、元failの原因を断定しない。訂正後の別caseでは既存pressed feedbackのscale(.982)でheight47.136/layout48/pressed trueを記録した。48pxは通常のborder-box/layout、押下feedback中は既存44px最低hitとfive-hitを確認する。文字containment/一行/旧記録/座標/採点のassertは保持した。

元pageは既に最初の2本をエンド確定済みだった。初inspector回復ではactive.cur0だけから初期と誤認し、新しい次エンドの2本と最後1本を追加した後、既存確定エンドを期待配列へ含めずassert失敗（-0のJSON表現差も元出力に保持）。同じpageの保存状態を元failure.liveと照合し、旧3全件/元確定2本をそのまま保持、新追加3本/score/reloadexactを確認して所有browser/server閉鎖。reset/reseed/既存矢の変更なし、元fullerrorcollectorは取得不可、reloadErrors0だけを主張する。元exit1・初回回復失敗は保存し成功へすり替えない。別fixture訂正native8/104は全旧3+新3本/nudge0.6/undo/score/reloadexact/errors0、一行/15pxと20px/通常48px/押下44px/fivehit/非重複成功。functions orchestrationのquote構文失敗1回はtool実行前でfiles/browser変更なし。
