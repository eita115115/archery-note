# 履歴一覧の情報階層 — AN082

基点86f3d937、公開v116/source3688a3b3。UI制約なし・全承認・通常公開の承認を継続。費用と個人情報は使わない。所有worktreeで一タスクだけ進める。

## デザイン

実Linux116の架空7記録でChrome/WebKitの320/375明暗/900を確認。日付が見出しと各行で重複し、得点と平均が横一列、用具と天気が小さいbadgeに詰まる。375前画像を保存した。

日付でまとまるスポーツノートの一覧を採用。行の左は距離と的、下は本数・用具・天気、右は合計点と平均の上下配置、末尾に詳細への矢印。月と日付を明瞭にし、通常行の日付重複を除く。行の読み上げ名には日付を残す。複数日にまたがるラウンドの各ステージには個別日付を残す。0本は平均を「—」とし、NaNを見せない。通常の集計値は同じ式。長い用具名は省略せず折り返す。

他案は記録ごとのカード（縦の密度を下げる）、グラフ中心（練習を探す目的から逸れる）。今回は既存の月/日/ラウンド構造を生かす。Product gate: 得点/用具/既存成長の連携、比較表示を保持、全local、毎日探しやすい一覧。新指標は作らない。

## 手順と受入

1. scripts/60-history-sight-view.jsの行markupとstyle.cssの履歴規則だけを変更する。絞り込み/詳細/ラウンド/50件paging/キーボード操作/保存は保持。
2. 320/375明暗/900のChrome/WebKitで前後原寸、詳細往復・絞り込み・ラウンド展開・全旧記録reload一致・errors0を確認。0本と複数日stageの日付/平均の回帰を追加。既存historyと記録/backupを含む全E2Eを使う。
3. check:all/lint/format/全生成E2E、独立readonlyreview。全versionmarkersを一括117へ、別commit。通常公開CIと公開資産/更新バナーを検証する。採点/半径/物理/保存schema/依存/SW activationは不変。
4. 旧81taskobjects/全acceptance/共有hiddenlockを保持。成功証拠後だけAN082passと非空evidence、progress/ledgerへ記録。大目標はactiveのまま。

自己レビュー: 見た目の対象は履歴一覧だけ。成長の計算や詳細画面へ広げない。物理iPhone/VoiceOver/fieldINPは今回証明しない。UI承認の再要求はしない。

## 結果

AN082完了、公開v117/source3a1e6d0598c10dd022353ee15cf5f2b284cd51b7、branch codex/history-refresh。履歴の通常行は重複日付を除きaria-labelへ残す、距離/的/本数/用具/天気と合計点/平均の上下を整理。stage個別日付は保持、0本平均NaNを—へ。60のrow markupと履歴CSS/生成CSSのみ、全他runtimeはversion以外exact、group/filter/detail/paging/採点/半径/数学/保存schema/依存/SWactivation保持。平均境界red1→focused7passed11.6s、初全299pass3fail3.8mはstage日付ゼロ埋めexpect2件と旧smoke連続文字expect1件、テストだけ訂正。最終local302passed3.8m/checkall/lint/format、ChromeWK320375明暗900の前後/最終117/長文32履歴contextは旧7+detail/filter/round/reloadexact/errors0/rowoverflowなし、最終117 native8/104は旧3+新3/nudge0.6/undo/score/reloadexact/errors0。独立readonlyreview指摘なし、レビュー時点full/native/publicは未確認、test訂正追加reviewも指摘なし。CI38237202858 validate/deploy成功/Linux302 passed (5.9m)、実Linux/public25byte・frozen19byte+6LF・first15/canonical14一致。元public116context publication463183ms、active更新保留→finish4/banner117/旧4exact→320新native/nudge3/解除/次矢2/offlineSWreload/finish5/結果分析履歴/reload/errors0。別の所有public-history8contextも保存/詳細/filter/round/errors0。docs/codex/evidence/history-refresh-v117へrawと原寸表示PNGをSHA一致copy。旧81tasks/全acceptance/sharedlock保持、費用個人情報不使用、大目標active。物理phone/VoiceOver/fieldINP/WKstrictOfflineは未証明。

元3失敗の出力は保持し、訂正後成功と区別。PowerShell helper編集のparser拒否は実行前、apply_patchで訂正。初期の読取path/globの誤りは訂正済み。採点/保存障害ではない。375前後原寸と実公開画面は証拠内。v117へ反映したのはこの一タスクであり、アプリ全体の大目標は未完。

証拠保存の訂正: 初native8/104は成功出力と最後のgeometryを保存したが、release/results.jsonを後の履歴captureが同名保存先で上書きしたため初native全rawJSONは取得不可。archiveのschemaassertで検出し、後続addはpath不存在、verifyはmanifest不存在で失敗。アプリ/実記録には影響なし。別native-final保存先で最終117の8context/104操作を新規に再検証し全成功、これを最終raw証拠とする。元の成功JSONの復元とは扱わず、失敗説明と元出力/残存geometryも保持。
