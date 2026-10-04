# 小画面の履歴操作列

## AN071 設計と計画（2026-10-05）

前回AN070は公開v108まで進捗。基点514a59b8。全承認を継続し、所有架空fixture、無料の既存Pages、所有sandboxだけを使う。

### 原因と判断

実v108の320×568履歴詳細では、pending行がy376.8594〜431.5469、sticky操作列がy325〜568（高さ243）。幅360以下の汎用`.btnrow{flex-direction:column}`で4ボタンが縦に並び、比較行を覆う。DOM/toBeVisible/viewport内の条件では見逃すため、保存画像と要素のcenter/四隅hit、操作列rectも見る。

前回のsynthesizeScrollGesture失敗は旧contextを閉じており未回復。新しい独立診断で実Linux108・同じ架空5件/同じcontextを使い、元の開始座標、上部開始、逆方向の対照を記録した。いずれもpointermoveは来るがscrollTop0。アプリのないbare scrollerでも同入力は0、raw dispatchTouchEventは125px動く。アプリのgesture不具合と決めつけず、入力方式の限界と扱い、同じ旧108診断contextでraw touchはscrollTop125px、pending中心hitはclearとなった。以前閉じた失敗profileの回復とはしない。

### 3案

1. 固定をやめる: 結果は読みやすいが閉じる/編集が最下部まで遠くなる。
2. 常時ボタンを1つに減らす: メニュー操作が増え、既存の編集/画像保存の直接操作を変える。
3. **履歴の操作列だけ2段に保つ**: 編集/画像保存、閉じる/削除の既存の組を保ち、狭幅の汎用column指定を局所的に上書きする。これを採用。

端末が狭くても押せる48px以上の高さを保ち、静かな計器の見た目/破壊操作の区別を維持する。375/desktopの既存row配置も変わらない。新しい操作・アイコン・色・影・補助説明を加えない。ボタンを縮めて解決しない。長い条件文など全ての比較が初期画面に収まるとは保証せず、タッチスクロール後にも比較の最後の行を読めることを確認する。下の的・全エンド表の最下部までの読取りは本回帰で主張しない。

### Product gatesと設計レビュー

記録と過去の比較の関係を読める、成長/不足理由を実際に読める、完全local、日々の振り返りと操作を短くする、の4gateを満たす。正本`docs/design/ui-design-language.md`とfrontend-designの運用UI方針に合わせ、既存操作列の方向だけの修正を選ぶ。CSS1画面に限定し、採点/統計/保存schema/handler/SW activation/依存を変えない。要件/設計/実行方法は全承認済みのUX改善の範囲で確定し、追加の承認を要求しない。

### 実装・検証計画

1. 実旧108の元座標とbare control/raw touchを診断し、初期重なりとスクロールを画像/rect/hit/入力traceで保存。
2. 320/375 light/dark、通常/抑制motion、desktopの旧生成版で回帰を先に追加しredを保持。fixtureは得点/座標の合う架空矢を使う。初期の代表比較行が操作列に覆われず、4ボタン48px以上/横overflowなし。native touch scroll/読み取り/close/削除cancel/edit entry/記録保持をチェック。
3. `style.css`の履歴操作列のrow方向だけ修正し、greenと375前後画像を残す。長い条件文/通常6本の履歴もスクロールして読めることを確認する。
4. check:all/lint/format/生成dist全E2E、read-onlyレビュー。公開版markersを一括bumpし、CI/実Linux-public25資産/旧所有profile更新とoffline、実public履歴の保存pixelとhitも確認する。
5. tasks/progress/ledgerへ結果・失敗・限界を保存。大目標active、実iPhone/VoiceOver/WKoffline/旧閉鎖失敗の回復、全分析のRMS解釈を証明したとはしない。

### 実装とローカル証拠

実装は`@media(max-width:360px)`内に`.histDetailActions .btnrow{flex-direction:row;}`の1宣言だけ。生成CSSを更新し、version markersを108→109へ一括更新。アプリの全JS、操作handler、採点/統計/保存schema、依存、Service Worker activationは不変（APP_VER/cache名のみ更新）。所有共有hiddenlockも不変。

生成distの14ケースを先に追加。初回は320のfooter高さと他幅のnative scroll開始位置で14failed。開始位置が`touch-action:none`の的に掛かっていたため、アプリを変更せずstatbar起点へ訂正すると5failed/9passed(37.3s)、失敗は320の高さ243のみになった。CSS候補の2回の試行も5failed/9passed。後で配布ビルドが圧縮CSSをコピーするだけと分かり、再生成不足を訂正した。source specificity/gestureの不具合を証明した試行ではない。全失敗logと画像を保持し、省略しない。

`build:web-assets`後のfocused14passed(39.2s)。320のfooter高さは243→129px、y325→439。pending行はy376.8594〜431.5469のままで全5hit点clear、footerより上。4ボタンは48px以上/横文字overflowなし。375の前後は同じ2段、明暗それぞれの320/375前後8画像とlong native reading2画像を原寸目視し、コピー一致を確認した。

14ケースは320/375/1024×明暗×通常/抑制motionと320/375長文条件+6本。実得点/座標の一致する架空fixtureのみ、native tap/raw native touch、close/削除cancel/edit/reload、旧5件exact保存、pageerror0を検証。画像保存ボタンは寸法とhitのみで、画像exportを実行したとはしない。比較の最後の行もnative scrollで確認する回帰を加え、公開候補v109の全体198passed(2.4m)。最初のlong reading画像に加え、last-resultの320/375画像も保存・原寸目視した。

`check:all`成功（UI/PWA/storage/version/distributionを含む）、`lint`exit0、`format:check`は`All matched files use Prettier code style!`。raw証拠は`artifacts/history-actions-v109`、所有sandbox+Node22.19。元AN070閉鎖profileの回復を主張しない。新独立108診断は同context対照として完了後に閉じた。

全体回帰と独立immutableレビューは完了、blocking/actionable指摘なし。実公開検証まで完了し、以下の証拠と共にAN071を受入。

### 実公開v109と受入（2026-10-05）

source/main `ea175f16fe01a216641a886ea15ed04909955985`。CI[37227457676](https://github.com/eita115115/archery-note/actions/runs/37227457676)はvalidate/deploy成功、Linux `198 passed (3.7m)`。実Pages artifact11313315036の26regularfilesを所有dirにpath検証/no linksで抽出。実Linux/public25資産byte一致、保持更新のfirst-document15body/canonical14も実Linuxと一致。local予行は別でpublic:false、実公開の証明へ混ぜない。

元の所有public108 contextを更新前から保持。架空old3+native1を保存し、15資産を実旧108body/normalmax-age600でwarm。freshness内publication316712ms、update321676ms。入力中は更新通知を遮断、native終了で旧3を完全保持して4件。実bannerから109へ更新、cache109のみ/controlleractive、旧4exact。320の新規開始で的が操作dock間に入り最初のnative中心tap1回、SWoffline reloadは旧4+active1完全一致。さらにnative終了5件、旧4/新矢exact、summaryとhistoryのpendingDOM一致、reloadもexact、errors0。成功後context/browser閉鎖、途中でreset/再生成/retrytapはない。

**実public320の初期履歴**もpending行y376.859375〜431.546875、操作列y439/high129、center+四隅5点clear。保存`pending-history.png`を原寸目視し、実際に保留理由が読める。raw `history-geometry.json`とpixelの両方を保持。public summary/offlineの2画像も原寸目視。before/after8+long4+public3＝15コピーbyte一致。375 light/dark前後はbyte-identicalで既存配置維持。

出力抜粋（全rawは`artifacts/history-actions-v109`）:

```text
# red-neutral.txt / exit1（修正前、保持）
5 failed
9 passed (37.3s)
# green.txt / green-media.txt / exit1（圧縮CSS再生成不足、保持）
5 failed / 9 passed (37.4s)
5 failed / 9 passed (36.9s)
# green-built.txt / exit0
14 passed (39.2s)
# e2e.txt / exit0
198 passed (2.4m)
# ci.log
198 passed (3.7m)
# check-all.txt / exit0
Archery Note checks OK (v109)
UI smoke checks OK (chrome.exe)
PWA asset checks OK
PWA update flow checks OK
Storage contract checks OK
Storage round-trip checks OK
Save debounce checks OK
Version alignment checks OK
Distribution checks passed:14 structures/names/order/source/regeneration; gzip JS 197003→139525 bytes; cross-script fixtures
# lint-final.txt / exit0
# format.txt / exit0
All matched files use Prettier code style!
# parity.txt / exit0
PASS:all25 actual Linux/public109 assets byte-identical; all15 held-update first-document warm bodies match Linux
```

初回red.txtの14failed（footer/的上の入力開始）も保存。2回の失敗は圧縮CSSが旧bodyのままの試行で、CSS cascade/minifier不具合を証明したとはしない。readonly reviewerは生成CSSから新1宣言を除くと旧CSS完全一致、全JS(APP_VER除く)/handlers/schema/scoring/deps/SW activation不変、旧70task/全acceptance保持を確認。

変更ファイル: `style.css`/生成`style.min.css`、alignedversion4箇所+lockrootversion、14回帰、設計・画像・tasks/progress/ledger。画像例: [320修正後](../screenshots/history-actions-v109/after-320-light.png)、[375修正前](../screenshots/history-actions-v109/before-375-light.png)、[375修正後](../screenshots/history-actions-v109/after-375-light.png)、[実公開320](../screenshots/history-actions-v109/public320-pending-history.png)。

今回の受入は履歴footerに限定。実iPhone/VoiceOver/Tab/allmotionframes/実INP/GPU/5000records、画像export、全エンド表最下部、WKoffline、AN070の閉鎖native-scroll失敗profile、さらに古い公開失敗profilesの回復は未確認。別独立旧108rawtouch成功を元閉鎖contextの回復にしない。新依存・費用・個人情報不使用。大目標active。

次の一小タスクはAN067で残った320の微調整後dock重なりの診断・修正候補。各dashboardの少数RMS/PB本数換算の解釈も別候補として残す。
