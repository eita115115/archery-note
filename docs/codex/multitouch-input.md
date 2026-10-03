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
temporary document touch listenersはtouchの間だけ保持し、終了/取消時に解除する。旧SVGが離脱した場合も、その後の全指離脱イベントで旧dragとlistenerを片付ける（即時のDOM監視ではない）。
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

## 実受入 — 公開v102 / 2026-10-04

source d668965470070262c239e58752ed461fbd5e6d44; CI37161897520 validate/deploy success, actual Linux github-pages artifact11288286391, all25 public bytes/held first-document15/canonical14 match. Owned local check:all/lint/format success, focused native regression red expected0/got1 then 8 passed (27.7s), generated139 passed (1.7m). Actual held public101→102 realbanner within 424855ms normal HTTPcache600, first-document102/cache102only/practice5 exact, native target multitouch partial/all-end no arrow, single tap recovery/undo, 6-arrow correction/end/next/settings CDPswipe/history scale unchanged/browser offline SWreload/history5/active1/errors0. Fresh public375 same guard/record/offline success. Chrome native and WebKit synthetic multitouch+native single tap at320/375; WebKit actual-origin-stop offline succeeds, setOffline internal error on both101/102 retained. Scoring/schema/dependency graph/activation flags unchanged. docs/codex/multitouch-input.md; artifacts/release-v102. Physical iPhone multitouch/VoiceOver/INP not verified.

公開CI: [37161897520](https://github.com/eita115115/archery-note/actions/runs/37161897520)。Linux出力は ci-linux.txt、終端成功は ci-watch.txt/ci-status.json。下記は実owned wrapper経由の npm scripts の出力で、共有junctionにはinstallしない。

```text
Archery Note checks OK (v102)
check-globals OK (14 files, 1233 unresolved refs all accounted for)
Analysis core characterization checks OK
Robust median reuse checks OK
Form core checks OK
Form metric fixture checks OK
Form diagnostic checks OK
Gamification pure-function checks OK (streak / 12 badges / backfill / goals)
Todays-result pure-function checks OK (weeklyDiff / stabilityTrend / personalBest / growthStreaks)
Security regression: all 38 checks passed
UI smoke checks OK (chrome.exe)
PWA asset checks OK
PWA update flow checks OK
Storage contract checks OK
Storage round-trip checks OK
Save debounce checks OK
Version alignment checks OK
Distribution checks passed:14 structures/names/order/source/regeneration; gzip JS 196305→139117 bytes; cross-script fixtures
139 passed (1.7m)
All matched files use Prettier code style!
lint: exit 0 (lint-final.txt)
```

Linux CIの実出力も `139 passed (2.6m)`、Node `v22.23.3`、`found 0 vulnerabilities`。validate/deploy双方successで、同じsourceの配信artifactを照合した。

375px前画像 artifacts/release-v101/deployed-active.png、後画像 artifacts/release-v102/deployed-active.png を目視し、的/得点/確定ボタンとnavの配置を保持。今回見た目の追加変更はない。

失敗を消さず保持: native回帰red expected0/got1。driverのrecordtab待ち/所有port競合/partial-touch指定誤り/lint globals宣言を修正したログ、WebKit TouchEvent constructor failure と generic synthetic event の区別、旧版新版とも setOffline internal error、origin停止probeの意図的uncachedfetchによるnullresponse/pageerror。最終4行は mobile-matrix.json/mobile-transport.txt（terminal0）、リハーサルは rehearsal/complete-update.json、実公開は live/immediate-update.json/live/complete-update.json/fresh-deployed.json/live-parity.json。リハーサルを実公開とは扱わない。

read-only reviewでP1/P2なし。listener lifetimeは前記の終了イベント時の意味。実iPhoneでのnative multitouch、VoiceOver、実利用INPは未確認。次は公開版の記録から履歴へのUX監査で、根拠のある一件を選ぶ。

完了記録のformatter起動は一度exeをJSとして渡す指定誤りで失敗した。notes-format-invocation-failure.txtに保持し、所有Node実行ファイルを直接起動して修正。notes-format.txtはAll matched files use Prettier code style、notes-audit.txtは全60acceptance不変/AN060だけ更新/25候補bytesと共有lock不変を確認。アプリ変更はない。
