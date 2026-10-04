# AN-065 — 終了結果を先に読む

前run AN064は実公開104で情報順序を監査したprogress。今回の一小タスクは
openSummaryのサイト判断を、既存数値/比較より後、plotより前へ移すこと。
既存全承認で実装・公開まで進める。費用・個人情報は使わない。

## 設計と受入

見出し→statbar→既存todaysResult/gamification/roundGroup→サイト判断→plotの順。
全関数/条件/内容/注意/計算/保存/close/画像保存を保ち、呼ぶ位置だけを変更する。
新しい色・カード・CSS・motion・storage・依存・SW activationは追加しない。
数値だけ先にする案と判断をdetailsへしまう案はAN064で比較済み。
履歴詳細と同じ数値/比較優先を採用し、判断は通常スクロールで読めるまま残す。

4gate: 記録→結果→履歴の繋がりと成長比較を読みやすくし、local処理を保ち、
毎日の結果確認を短くする。自己レビューで分岐/注意保持/小画面を確認した。
既存全承認は実装と公開を含むので再承認は求めない。

1. tests/e2e/summary-order.spec.jsを追加。320/375・light/darkで実終了を押し、
   数値/比較が判断より先、数値が初期viewport内で読めることをred→greenで示す。
   first/比較なし、gamification、roundGroup、編集分岐の保持も確認する。
   架空fixtureだけで保存/履歴/plot/閉じるを確認し375前後画像を保存する。
2. scripts/50-record-view.jsのsummaryDecisionHtmlの出力位置だけを移す。
3. owned compact-js sandbox/isolatedNode22.19でcheck:all/lint/format/生成E2E。
   Chrome/WebKit320/375記録/修正/確定/次矢/設定swipe/offline/結果順序を確認。
   root/original node_modules junctionのinstall/ci/updateは禁止。read-only review。
4. markersを揃えた次版をcandidate/driver準備後に承認済み通常pushする。
   実公開104をnormalcache600で保持しrealbanner初回15body/14cache/practice exactを
   保存。実操作/offline、正確source LinuxCI/25publicbytesを照合する。
5. 実受入後のみAN065/progress/ledgerを更新。全65task acceptanceを保つ。

UI/release受入はevals/acceptance.md。実iPhone/VoiceOver/INP/全motionフレームや
サイト/physicsの計算妥当性の新しい証明は対象外。旧WK/profile失敗を保持する。
