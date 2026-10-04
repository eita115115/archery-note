# 微調整後の操作性 — AN072（2026-10-05）

前回AN071公開109は進捗。基点81fb97bd。全承認/無料既存Pages/所有架空fixtureだけで一小タスク。archery-note/systematic-debugging/brainstorming/writing-plans/test-driven-developmentの流れで診断を先にする。現在旧IABframe19の下端重なりは未確定で、直す前に実旧版と現在版を対照する。

## 診断と3案

1. 毎回nudge後にスクロールする: メタ入力や連続操作が跳ねる。重なりが再現しない段階では採用しない。
2. **対照診断を完了し、実操作後の回帰を補う**: 既存testは70m122cm6本で初期padだけ確認、3回後はscroll/座標/得点だけ。まず18m40cm3本と反復後五ボタンのhit/画像を確認し、再現した原因があれば小修正、既に通るならその事実を記録して次のUX対象へ進む。
3. パッドをfixedにする/縮める: 的と操作列を再配置し、意味のない広い変更になるため採用しない。

選択は2。再現しない失敗へapp修正を足さない。今回のdiagnosticは実Linux109をコピーするstatic preview、Chrome/WebKit320×568/375×812、明暗/通常抑制、18/40/3と70/122/6。過去の所有架空5件からstartしてnative矢2本、chip選択、native上へ3回、locator上へ1回の対照、五点hit/rect/scroll/scoreAt一致を記録。各選択後と反復後28rAFのsample計112/caseを調べる。最初のtouchの全フレームを捕捉するものではなくsampled inspection。matrixは初期/反復後/locator/失敗sample/countを保存し、全caseの全sample dumpを保存するとはしない。最後のcaseの全112sampleはlatest.jsonに保存。

現109は32case成功、native/locatorともscroll変化0、five-hit pad clear、bad sampled frames0。旧105も同じ32case成功。両版nativeの座標/得点とscroll一致。32pairのnudge3後pixelは28完全一致、4差分は下部nav領域内でpadの重なりではない。差分の原因を断定しない。旧IABtabはAN067で閉じた。新しい成功がその旧contextの回復や元rootcause証明ではない。IABのlogical320とencoded310pxの差も再現していない。

## Product gatesとscope

1. 矢の座標修正→得点/履歴比較の関係を保つ。2. 成長比較の元になる矢を正しく保存する。3. 完全local。4. 射場の反復操作が跳ねず押せることを日常回帰で守る。いずれも別の新機能を増やさない。Field Instrument正本も確認、見た目/操作/採点/schemaの変更は原因が確認されるまで行わない。

## 実行計画

1. 旧105/current109の32case診断、原画像とhit/traceを残す。旧frame19も原寸表示。
2. 実際の重なりが両方で再現しなければapp/markersを保ち、既存correction-entry.spec.jsへ18/40/3と反復後五点hit/座標/saveを補う。初期passをredと偽らない。375前後（app無変更）は同byte画像との比較を別に確認。
3. checkall/lint/format/全generated E2E、read-only immutable review。承認済みcommit/pushとCI、実Linux/public/旧109の25appbyte同一を検証。testsだけならversion bump不要、公開109維持。
4. matching AN072だけpass/evidenceを実検証後更新。progress/ledgerへ失敗/未確定/次を保存。全71oldtasksとacceptanceを保持。大目標active。

新依存/費用/個人情報なし。PhysicaliPhone/VoiceOver/全motionframes/旧閉鎖IAB・公開98→99等の失敗回復は未確認。新たに原因が見つかれば計画を更新してから、既に全承認のscopeで小修正する。

## 結果と次の判断

旧105/current109それぞれ32case、64case全てでnative3nudge後とlocator click後の五ボタンclear、scroll変化0、座標とscoreAt一致/errors0。各case112 sampled framesにbad0。ただしmatrixはbadのsampleとcount、latestは最後のcaseの全112を保持する方式で、全7168rAFのrawを全部保存したという主張はしない。旧IABframe19は原寸表示し、今回のnative結果へ言い換えない。根本原因は未確定、本経路で再現しなかったため新app修正は行わない。

回帰補強は既存`correction-entry.spec.js`だけ。18m40cm3本の8caseを追加し、70m122cm6本の8caseと合わせ16。5point hit/各nudge後pad/3後pixel・JSONを追加。これまでのタグ/番号/解除/確定/次矢/採点円/save/reload/旧3保持も残す。旧105と109は最初からpassするケースでred→greenと偽らない。focused出力は`16 passed (2.4m)`。続いて全体206とcheckall/lint/format/独立reviewを検証する。

old/currentの320/375明暗・18m・抑制motionの8代表画像を保存・原寸表示/copy完全一致。これら4pairもbyte-identical。全320stage画像を全部目視したとはしない（entry/nudge3/locator計5×64=320画像を保存）。旧資料frame19は別画像として表示。

実画像には別のUX課題がある。`選択解除`は`shotMeta`（矢番号/理由）より下で、320/375とも初期の調整状態に見えない。既存testが`revealSecondary`で手動scrollして解除することも一致。得点chipの再tapで解除できるが、操作名のある戻りbuttonが下に隠れる負担は残る。次の小タスクは`選択解除`を調整button直下に出す案を評価する。今taskでその新UXを完了/修正扱いしない。

公開/CI/全体受入は未完了、task passesfalse。全app/markers109保持、新依存なし。
