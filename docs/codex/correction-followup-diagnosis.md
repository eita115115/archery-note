# 微調整後の操作性 — AN072（2026-10-05）

前回AN071公開109は進捗。基点81fb97bd。全承認/無料既存Pages/所有架空fixtureだけで一小タスク。archery-note/systematic-debugging/brainstorming/writing-plans/test-driven-developmentの流れで診断を先にする。現在旧IABframe19の下端重なりは未確定で、直す前に実旧版と現在版を対照する。

## 診断と3案

1. 毎回nudge後にスクロールする: メタ入力や連続操作が跳ねる。重なりが再現しない段階では採用しない。
2. **対照診断を完了し、実操作後の回帰を補う**: 既存testは70m122cm6本で初期padだけ確認、3回後はscroll/座標/得点だけ。まず18m40cm3本と反復後五ボタンのhit/画像を確認し、再現した原因があれば小修正、既に通るならその事実を記録して次のUX対象へ進む。
3. パッドをfixedにする/縮める: 的と操作列を再配置し、意味のない広い変更になるため採用しない。

選択は2。再現しない失敗へapp修正を足さない。今回のdiagnosticは実Linux109をコピーするstatic preview、Chrome/WebKit320×568/375×812、明暗/通常抑制、18/40/3と70/122/6。過去の所有架空5件からstartしてnative矢2本、chip選択、native上へ3回、locator上へ1回の対照、五点hit/rect/scroll/scoreAt一致を記録。各選択後と反復後28rAFのsample計112/caseを調べる。最初のtouchの全フレームを捕捉するものではなくsampled inspection。matrixは初期/反復後/locator/失敗sample/countを保存し、全caseの全sample dumpを保存するとはしない。最後のcaseの全112sampleはlatest.jsonに保存。

現109は32case成功、native/locatorともscroll変化0、five-hit pad clear、bad sampled frames0。旧105で同じ独立対照を実行中。旧IABtabはAN067で閉じた。新しい成功がその旧contextの回復や元rootcause証明ではない。IABのlogical320とencoded310pxの差も再現していない。

## Product gatesとscope

1. 矢の座標修正→得点/履歴比較の関係を保つ。2. 成長比較の元になる矢を正しく保存する。3. 完全local。4. 射場の反復操作が跳ねず押せることを日常回帰で守る。いずれも別の新機能を増やさない。Field Instrument正本も確認、見た目/操作/採点/schemaの変更は原因が確認されるまで行わない。

## 実行計画

1. 旧105/current109の32case診断、原画像とhit/traceを残す。旧frame19も原寸表示。
2. 実際の重なりが両方で再現しなければapp/markersを保ち、既存correction-entry.spec.jsへ18/40/3と反復後五点hit/座標/saveを補う。初期passをredと偽らない。375前後（app無変更）は同byte画像との比較を別に確認。
3. checkall/lint/format/全generated E2E、read-only immutable review。承認済みcommit/pushとCI、実Linux/public/旧109の25appbyte同一を検証。testsだけならversion bump不要、公開109維持。
4. matching AN072だけpass/evidenceを実検証後更新。progress/ledgerへ失敗/未確定/次を保存。全71oldtasksとacceptanceを保持。大目標active。

新依存/費用/個人情報なし。PhysicaliPhone/VoiceOver/全motionframes/旧閉鎖IAB・公開98→99等の失敗回復は未確認。新たに原因が見つかれば計画を更新してから、既に全承認のscopeで小修正する。
