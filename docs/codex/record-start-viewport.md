# 記録開始直後の的の表示位置

AN068。AN067で通常の320px条件指定開始後、的の上端が-91.33pxに残る問題を観測した。開始前後の位置をnative touchで採取し、原因を確認してから修正する。

- 条件指定・前回条件・初回セットアップを320/375、通常/抑制モーションで検証。開始ボタンだけを事前に表示し、開始後の復帰スクロールやlocator自動スクロールで問題を隠さない。
- 的全体がheaderと固定dockの間に収まり、最初のnative中心tapで矢が増えること、旧履歴とreload後のactive保持を確認する。既存の解除/確定・通常更新・タブ復帰の検証も実行する。
- 原因が開始境界の位置保持なら既存revealActiveTargetを新規開始にだけ適用する。採点・保存・通常renderを変えない。
- 375px前後画像、red/green、必須チェック、読取専用review、承認済み公開更新の証拠を残す。

記録→履歴→集計→サイト判断へつなぐ入口を直し、見える的への入力から成長の材料を作る。端末内保存を保ち、日々の記録開始の手戻りを一つ減らす。四つのproduct gatesに合う小さな修正である。

## 原因と修正

native開始clickのcapture/bubble観測で、320条件指定の開始前後ともscrollY417。通常motionで的上端はhandler直後-84、静止後-92px（高さ204.47）、dock上端386。抑制motionでも同じ最終位置で失敗する。位置を引き継ぐrenderと、新規開始境界で的を表示しないことが原因。

既存revealActiveTargetをfStart/onboarding-startのrender後に追加。前回条件はfStartを使う。最初の修正だけでは通常motionの的上端が8→0へ移動し、一件失敗。style.cssのmain.viewEnter .cardに8pxのitemRevealが適用されるため、新規開始のrender直前にviewEnterを外してから位置を測る。最終320は同じcapture417→bubble317、的上端8/下端212.47、dock386。位置はanimation後も同じ。通常render・再開・タブ復帰・保存・採点・次距離処理を変更しない。

## 検証経過

- 初回12件は4 failed / 8 passed。一件目/四件目が位置失敗、onboardingの2件はまだ保存されていないblank stateをテストが読んだnullエラー。fixture読取を空履歴として修正し、失敗出力/画像はinitial-redへ保持。
- 修正前の正しいredは2 failed / 10 passed (33.2s)。320条件指定の通常/抑制が-92pxで失敗。他の入口・375は元から成功する対照。
- helperだけ追加した中間runは1 failed / 19 passed (1.5m)。既存解除/確定/位置保持4件と条件表示4件は成功、通常motionの8pxが最終0となるケースだけ失敗。intermediate-resultsとgreen.txtに保持。
- 新規開始のmotionを外した最終runは12 passed (33.4s)。各ケースで回復scrollなし・native中心tap一回・旧履歴一致・reload後active全field一致・pageerror空。
- 全出力・各ケースのgeometry/trace/実画像はartifacts/record-start-v106。リリース検証はこの後追記する。

## 保存・表示して確認した前後画像

同じ320/375・通常motion・条件指定の実テスト画像。fix前/後のownedプレビューであり、版bump前に採取した。375は両方とも的が全体表示される対照。画面の字形・date描画を比較する検証ではない。コピー後に原寸で4枚表示・目視した。

![320 修正前](../screenshots/record-start-v106/320-red.png)

![320 修正後](../screenshots/record-start-v106/320-green.png)

![375 修正前](../screenshots/record-start-v106/375-red.png)

![375 修正後](../screenshots/record-start-v106/375-green.png)

実iPhone/VoiceOver/実INP、旧公開更新profile失敗、ガイドcopy/320微調整下端/RMS少数矢の表示信頼性はこの修正の証拠範囲に含めない。
