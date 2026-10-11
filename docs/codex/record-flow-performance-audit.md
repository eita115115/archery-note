# 記録フローの性能と操作性を測る — AN077

前回AN076は公開112/source `6dabcff6ab73996e71693da348a271c9e1659cff` の表示修正と公開検証まで完了。今回の基点notes `4135db461f318bb56be7dcb2eca8f540868dbff5`、所有worktree/branch codex/record-flow-audit。一小タスクとして計測だけ行い、アプリの変更・版更新・再配信を混ぜない。全承認継続、費用・個人情報を使わない。

## 測定計画

実CI38158744620のLinux112配布物を所有HTTPプレビューで動かす。実公開25資産とのbyte一致を再確認する。所有架空履歴3件と5000件（6本/件）を用い、Chrome/WebKit ×320/375 ×通常/抑制motion ×履歴2条件を2回ずつ、計32経路を測る。追加でChrome375抑制motionをCPU4倍条件、公開Chrome320/375抑制motionの新contextでも確認する。CPU条件は物理iPhoneと同等としない。

操作はnative touchで開始→中心矢→選択→右微調整3回→解除→次矢→エンド確定→中心矢→終了。アプリの実handler、採点関数と同じラインカッター、保存済み座標/得点、旧履歴全件の一致とreloadを確認する。画面geometry/五点hit/横overflow、イベントから2回目rAFまでの時間、イベント処理とlong-task（対応engineのみ）、frame gapを採る。操作前の読み位置調整を記録し、測定値へ混ぜない。原寸代表320/375画像と生JSON/失敗出力を保存する。

2回目rAFは描画機会までの実験上の指標で、実際の画面描画やフィールドINPとは呼ばない。PerformanceObserver対応は実行時に判定し、未対応を0件と扱わない。直列測定にし、外部CPU負荷/OS/desktop engine/少数反復の限界を明記する。5000件は所有の架空データであり実ユーザーの履歴・保存容量の保証ではない。

## 判断と受入

根拠のない性能改修はしない。遅い操作があれば、履歴量/CPU/motionの差で再現範囲を絞り、別の診断probeでinclusive処理時間を取り（通常計測と混ぜない）、次の最小改善候補を示す。原寸画像で操作の重なりも確認する。アプリ/source/数学/保存schema/依存/SW/markers112/旧76taskobject/全acceptance/共有hiddenlockを保持する。

今回の変更は監査文書・架空の計測証拠だけ。既存同sourceのAN076全272 E2E/checkall/lint/CIを明示して再利用し、新しい全面テスト実行と呼ばない。新文書のformat:checkとinvariants、実測harnessを検証し、証拠を確認後だけAN077pass＋非空evidence、progress/ledgerを更新する。大目標active、実iPhone/VoiceOver/実射/フィールドINP/GPU/WKstrictOffline/旧閉鎖profile回復は未証明。
