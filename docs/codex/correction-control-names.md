# AN-063 — 微調整ボタンの操作名

前run AN062は公開103の微調整入口を修正したprogress。今回はAN061の
記号だけの方向/名前なし削除という観察を、現在のruntimeで確かめて一件直す。
既存の全承認で実装/公開まで進める。費用・個人情報は使わない。

## 設計と計画

現在sourceのnpadは▲/◀/▶/▼とtrash SVGだけ。方向の記号だけでは
読み上げ時に矢の修正操作と分からず、削除はaccessible nameがない。
既存の「選択中の矢を微調整」の文脈に合わせ、日本語のaria-labelを付ける。
五ボタンを「選択中の矢の微調整」というgroupにし、native button操作を保つ。
type=buttonを明示する。配置/寸法/見える記号/handler/scroll/保存/採点は変えない。

常時五つの長い文を表示すると小さい操作パッドが崩れる。titleだけでは
touchや読み上げで安定した操作名にならないので、aria-labelを採用する。
矢の番号や移動量を動的に名前へ含める変更は今回含めない。

4gate: 修正した記録を履歴/分析へ繋ぎ、成長データを保持し、local処理を保ち、
日々の修正を読み上げ/keyboardから理解しやすくする。新規独立機能はない。
既存全承認の範囲なので再承認は求めない。自己レビューで名前/動作/範囲を確認した。

1. 所有headless runtimeのAX snapshotで旧group/五ボタンの名前を保存する。
   名前によるlocatorを使う回帰を320/375で追加し、現行の失敗を確認する。
2. scripts/50-record-view.jsのnpad markupだけに操作名を付ける。
   四方向をkeyboard Enter/Spaceで操作し、座標/score/保存/選択中の矢の削除と
   他の矢/既存history保持を確認する。375前後画像/AXを保存する。
3. owned compact-js sandbox/isolatedNode22.19で全check/lint/format/生成E2E、
   Chrome/WebKit320/375記録/修正/確定/次矢/設定swipe/offline。root/original
   node_modules junctionにはinstall/ci/updateしない。read-only reviewで確認する。
4. markersを揃えた次版を公開する。driver/candidateを準備してから実公開103の
   normalcache600 profileを保持して通常push。realbanner初回15body/14cacheと
   practice exact、実操作/offlineを保存し、正確LinuxCI/25publicbytesを照合する。
5. 完了後のみAN063/progress/ledgerに証拠を追加する。既存task acceptanceは保つ。

受入はevals/acceptance.mdのUI/check:ui/lint/375前後、release全check/E2E/format/
version/PWA。実VoiceOver/物理iPhone/全motionフレーム/実INPは証明しない。
旧WK offline/lifecycle/失敗profileの限界は保全する。
