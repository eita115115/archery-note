# AN-060 — 的上の二本指を矢として記録しない

## 設計と範囲

前runは実public100→101の記録保持を受入できたためprogressである。
今回も既存の全承認に基づく一小タスク。料金・個人情報は使わない。
現行 `attachTargetInput` のdownは二本目でもdragを置換し、upで矢を保存する。
前runの実二本指probeはdebounced save/offline reloadでcur2/期待1だった。

二本目だけ無視する案では一本目の離脱時に意図しない矢を記録し得る。
イベントを全画面で常時監視する案は不要なlistener lifetimeを増やす。
選ぶのは、対象のtouch操作中だけ複数指を検出し、そのgesture全体を取り消す方式。
二本目が的の外でも取消し、全ての指が離れるまで新たな矢を記録しない。
全指離脱後の普通の一本指入力は直ちに復帰する。

PointerEventとtouch fallback双方で二本目の同時/途中追加・片指離脱・cancelを扱う。
取消時は400msのfine timerとcursor rAF、lensを片付ける。
temporary document touch listenersはtouchの間だけ保持し、終了/取消/旧SVG離脱時に解除する。
単指tap/drag/長押しfine・マウス・採点/表示円/保存schema・既存practiceを保つ。
全体UI/倍率設定/ボタン/コピー/依存/SW activationは変更しない。

この修正は記録→修正→保存→履歴を安全に繋ぎ、成長データを誤入力で汚さず、全処理がlocalで、日々の操作を増やさない。
プロダクトの接続・成長・local・日常利用の4gateを考慮した。
設計のself-reviewで範囲・取消条件・復帰条件・listener lifetimeを確認済み。
既存の全承認に含まれる局所修正なので追加承認を求めず進める。

## 実装と受入の順序

1. `tests/e2e/target-multitouch.spec.js` にnative CDP二本指で誤記録する失敗を保持する。
   320/375、pointer/touch fallback、同時/途中追加/的外/取消/復帰と単指tap/drag/fineを観察する。
2. `scripts/50-record-view.js` の入力開始・gesture cancellationだけを局所修正する。
   `arrowMarkRadius`/`lineCutRadius`/`scoreAt`/`hitFromGlobal`/`markCircle` の共有半径は読んで保持する。
3. 生成物でfocused red→green、既存doubletap/correction/end sequence、全check/lint/format/生成E2Eを確認する。
   375前後画像、320/375主要操作/設定swipe/offline、採点・架空記録保持を確認する。
4. 独立read-only review後、markersを揃えた版を公開する。
   事前candidate/driverを備え、実公開旧profileのbanner更新後のcode/hash/practiceを即時保存する。
   Linux正確sourceCI/25publicbytesと二本指guard/単指記録再開/offlineを確認する。
5. 証拠が揃ってからAN060のstatus/evidenceとprogress/historyを更新する。
   旧公開失敗・WK初期strict不明・実機iPhone/VoiceOver/INP未確認は保持する。

ownedcompact-js sandbox/isolatedNode22.19のみ。root/original node_modules junctionのinstall/ci/update禁止。
共有hidden lock SHA256 `16F9BA6219DA31278CED98C0C742013B4A5AAEA63059E4702E86756702A23309` を保持する。
