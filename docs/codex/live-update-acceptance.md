# AN-059 — 実公開更新の記録保持を検証する

## 範囲と準備

既存の全承認の範囲で、AN-058の未完了だった公開更新検証を完了する。
費用・個人情報は使用しない。所有worktreeと隔離sandboxだけを使い、検証browserは新規contextと架空デモデータだけとする。

アプリ変更は `f8c9d5037f6b01c95e80d1546a8678be904b8c8b` の100→101版markersだけ。
採点・保存schema・SW activation flags・依存graph・UIは変えない。
公開直前に実v100を保持し、通常HTTPcacheの15旧bodyが実Linux100artifactと一致することを確認する。
候補25生成物・14canonical hash・全driverを公開前に確定し、更新後に未入手Linuxartifactを待たない。

実banner更新の初回文書で15JS/CSS応答body・14canonical cache hash・practice equalityを確認して即時保存する。
その後に6矢修正/確定/次矢・named filters・設定の実touch swipe・履歴画面の倍率不変・実network offline再開を確認する。
公開後の実Linuxartifactと全25公開bytes、保存した15/14hashを照合する。
全失敗段階をouter catchでsnapshotし、元contextは明示的な所有abortまで閉じない。

## 公開前の証拠

所有 `artifacts/release-v101/` にraw log・JSON・PNG・driverを保持した。

```text
node artifacts/compact-js/run.cjs run check:all
Storage contract checks OK
Storage round-trip checks OK
Save debounce checks OK
Version alignment checks OK
Distribution checks passed:14 structures/names/order/source/regeneration;
gzip JS 195931→138825 bytes; cross-script fixtures

node artifacts/compact-js/run.cjs run lint
exit 0

node artifacts/compact-js/run.cjs run format:check
All matched files use Prettier code style!

node artifacts/compact-js/run.cjs run test:e2e:dist
131 passed (1.9m)

node artifacts/release-v101/verify-source.cjs
PASS:immutable Git/source/sandbox 323 files; 25 generated candidate hashes;
version-only dependency lock change; shared hidden lock preserved

REHEARSAL=1 PROOF_DIR=artifacts/release-v101/rehearsal-scoped
node artifacts/release-v101/verify-held-update.cjs
IMMEDIATE_PASS first document101/15 loaded body hashes/14 canonical hashes/
5 sessions and practice exactly unchanged; proof persisted before later UI
PASS: held actual100→101 banner; first-document code/cache/practice;
correction/end/next; settings touch-swipe/pinch; real offline reload retains
5 histories/6 completed arrows/active1; pageerror0
exit 0
```

rehearsalは実Linux100artifact→実101候補、`max-age=600` のloopbackである。
公開実証とは区別する。過去AN-058の実98/99→100 Chrome/WebKit320/375のfunctional証拠も保持し、
今回の版markersだけの変更で同じアプリロジックを使う。WKの初期strict lifecycle未解明を消さない。

## 失敗と修正、証拠の限界

- 最初のcheck:allとretryは所有ui-smokeの古いLOCK/Account Web Dataに対するEBUSYで失敗した。
  所有の絶対pathを確認して一時dirを退避し、cleanのcheck:allはexit0。ユーザーbrowserを終了・変更せず、アプリ変更なし。
- warm後throwの意図的注入はURL/100/worker/cache14/practice5と元contextLiveを保存した。
  inspection後だけ明示abortし、terminal1を通常成功として扱わない。
- reviewerのP2: response.body()のPromiseを後で合流するまで放置するとunhandled rejectionになる。
  生成直後catchしてresponseBodyErrorsへ記録し、合流点の明示throwでouter catchへ渡す。
  最終body注入で101/activated/cache101/架空practice5/元contextLiveを保持し、inspection後abort、terminal1。
- 最初のrehearsalは旧100controllerのactivatedを早期に合格とした。
  keys100+101/activatingで失敗し元contextを保持した。readinessに101存在・100不在を加えた後、通常scoped rehearsalは成功。
- 的上の二本指probeでは倍率不変でも余分な矢が入った。debounced save後のoffline reloadでcur2/期待1が確認された。
  sourceのdownは二本目のpointerを拒否せずdragを置換する。既知P2としてAN-060で局所修正する。
  失敗 `rehearsal-final` は保持し、今回の倍率成功は**履歴画面のみ**。的上multitouchの解決とは言わない。
- fresh helper生成の最初のnode-eはPowerShell quoteでSyntaxError。ファイルdriverへ直してsyntax0、アプリ失敗ではない。
- AN-057実98→99 APP99 timeout、AN-058実99→100の後続local artifact待ちtimeoutは歴史として残す。
  閉じたprofileを復旧済みとしない。実100→101は別の生きた旧profileで証明する。

独立read-only reviewは最終driver/source/scoped rehearsalについて追加P1/P2なし。
既知の的上multitouch P2と実機/VoiceOver/INP等の未確認点を受入の範囲から隠さない。

## 公開状態

通常push `5d6e16b3..f8c9d503`、Pages workflow/HTTPSを保持。
実public100の所有profileはpush直前warm済み、15旧hash一致、header max-age600/Age最大2秒。
source指定CIは [37159445088](https://github.com/eita115115/archery-note/actions/runs/37159445088)。
source指定CIのvalidate/deployは成功。実UbuntuNode22.23.3/clean npmci0、全check/lint/format、`131 passed (2.7m)`。
Pages deployは2026-10-03 22:48 UTC（JST 10月4日）に成功した。
workflow actionのNode20強制24とubuntu-latest移行の既存annotationもraw logに保持し、アプリ検証Node22と区別する。

```text
node artifacts/release-v101/verify-held-update.cjs
IMMEDIATE_PASS first document101/15 loaded body hashes/14 canonical hashes/
5 sessions and practice exactly unchanged; proof persisted before later UI
PASS: held actual100→101 banner; first-document code/cache/practice;
correction/end/next; settings touch-swipe/pinch; real offline reload retains
5 histories/6 completed arrows/active1; pageerror0
exit 0

python artifacts/release-v101/extract-artifact.py
PASS:actual Linux artifact extracted within owned release directory;
26 regular files/no links

node artifacts/release-v101/verify-parity.cjs
PASS:all25 public101 assets byte-identical to actual Linux artifact;
saved actual held100→101 first-document15 and canonical14 hashes match Linux
exit 0

node artifacts/release-v101/verify-deployed.cjs
PASS: deployed touch swipe dismisses settings and retains sessions
PASS: deployed v101, actual checked compact distribution, round collapse/expansion
and score distribution, synthetic history/start, offline reload, data retention,
no page errors
exit 0
```

`live/warm-baseline.json` は実public100の15旧hash/max-age600/Age最大2秒と5架空historyを保存。
`live/immediate-update.json` は新しい初回文書の15応答bodyと14canonical hash、版101/cache101のみ/activated/controller同一とpractice一致を操作前に保存。
更新まで264728msで、Age込みでも旧HTTPcacheのfreshness期間内。cache無効化・追加オンラインreload・late artifact待ちは使わない。
`live/complete-update.json` はその同じprofileで修正/確定/次矢・group19/filterfocus・設定touch swipe・履歴倍率不変と実network offline/fromSW reload後の5history/6確定矢/active1保持/errors0を証明する。
実Linuxartifact `11287052421` の26regular filesを安全に抽出し、全25publicbytesおよび保存した15/14hashを照合した。
fresh375は別の新規contextで同じ主要操作/offline保持を確認し、公開active画像を目視した。
freshの最初のMODULE_NOT_FOUNDはhelperのpath置換順だけを直し、失敗log `fresh-deployed.txt` と成功 `fresh-deployed-final.txt` を分けて保持した。

AN-057/058の局所修正・軽量配信の総合受入は、この修正済み実公開更新と既存の98/99互換functional証拠を合わせて判定する。
古い実98→99と実99→100の失敗profile自体は復旧していない。初期WKstrict lifecycle、的上二本指P2、実iPhone/keyboard/VoiceOver/INP/5000実保存/posecamera/AN001実射等は未確認または未修正として残す。
次はAN-060の二本指誤入力を一小タスクで修正する。大目標はactiveのまま。

独立した公開後のread-only受入監査も、AN057/058/059を是正証拠の組合せで閉じてよいと判断した。
acceptance本文は59既存taskすべて保持した。057/058/059だけ具体的証拠とdoneを付け、AN060はopen/falseとして追加した。

```text
node artifacts/compact-js/run.cjs run format:check
All matched files use Prettier code style!
exit 0

node artifacts/release-v101/final-record-audit.cjs
PASS:60 task IDs/59 old acceptance preserved;
057/058/059 done with actual public evidence;060 unresolved;
post-release runtime/deps and25 candidate bytes unchanged/shared lock preserved
exit 0
```
