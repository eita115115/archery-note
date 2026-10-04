# 小画面の履歴操作列

## AN071 設計と計画（2026-10-05）

前回AN070は公開v108まで進捗。基点514a59b8。全承認を継続し、所有架空fixture、無料の既存Pages、所有sandboxだけを使う。

### 原因と判断

実v108の320×568履歴詳細では、pending行がy376.8594〜431.5469、sticky操作列がy325〜568（高さ243）。幅360以下の汎用`.btnrow{flex-direction:column}`で4ボタンが縦に並び、比較行を覆う。DOM/toBeVisible/viewport内の条件では見逃すため、保存画像と要素のcenter/四隅hit、操作列rectも見る。

前回のsynthesizeScrollGesture失敗は旧contextを閉じており未回復。新しい独立診断で実Linux108・同じ架空5件/同じcontextを使い、元の開始座標、上部開始、逆方向の対照を記録した。いずれもpointermoveは来るがscrollTop0。アプリのないbare scrollerでも同入力は0、raw dispatchTouchEventは125px動く。アプリのgesture不具合と決めつけず、入力方式の限界と扱い、同じ旧108診断contextのraw touchをさらに確認する。以前閉じた失敗profileの回復とはしない。

### 3案

1. 固定をやめる: 結果は読みやすいが閉じる/編集が最下部まで遠くなる。
2. 常時ボタンを1つに減らす: メニュー操作が増え、既存の編集/画像保存の直接操作を変える。
3. **履歴の操作列だけ2段に保つ**: 編集/画像保存、閉じる/削除の既存の組を保ち、狭幅の汎用column指定を局所的に上書きする。これを採用。

端末が狭くても押せる48px以上の高さを保ち、静かな計器の見た目/破壊操作の区別を維持する。375/desktopの既存row配置も変わらない。新しい操作・アイコン・色・影・補助説明を加えない。ボタンを縮めて解決しない。長い条件文など全ての比較が初期画面に収まるとは保証せず、自然なタッチスクロール後にも全行と最下部を読めることを確認する。

### Product gatesと設計レビュー

記録と過去の比較の関係を読める、成長/不足理由を実際に読める、完全local、日々の振り返りと操作を短くする、の4gateを満たす。正本`docs/design/ui-design-language.md`とfrontend-designの運用UI方針に合わせ、既存操作列の方向だけの修正を選ぶ。CSS1画面に限定し、採点/統計/保存schema/handler/SW activation/依存を変えない。要件/設計/実行方法は全承認済みのUX改善の範囲で確定し、追加の承認を要求しない。

### 実装・検証計画

1. 実旧108の元座標とbare control/raw touchを診断し、初期重なりとスクロールを画像/rect/hit/入力traceで保存。
2. 320/375 light/dark、通常/抑制motion、desktopの旧生成版で回帰を先に追加しredを保持。fixtureは得点/座標の合う架空矢を使う。初期の代表比較行が操作列に覆われず、4ボタン48px以上/横overflowなし。native touch scroll/読み取り/close/削除cancel/edit entry/記録保持をチェック。
3. `style.css`の履歴操作列のrow方向だけ修正し、greenと375前後画像を残す。長い条件文/通常6本の履歴もスクロールして読めることを確認する。
4. check:all/lint/format/生成dist全E2E、read-onlyレビュー。公開版markersを一括bumpし、CI/実Linux-public25資産/旧所有profile更新とoffline、実public履歴の保存pixelとhitも確認する。
5. tasks/progress/ledgerへ結果・失敗・限界を保存。大目標active、実iPhone/VoiceOver/WKoffline/旧閉鎖失敗の回復、全分析のRMS解釈を証明したとはしない。
