# 終了時の統計参照を一回の計算内で共有する — AN078

前回AN077は監査完了、基点82d4681e5cbe394129abea69fa68d059871f2753、公開source6dabcff6ab73996e71693da348a271c9e1659cff/v112。前runは進捗（38/418と別8profile、次の重複署名検査を特定）。所有worktree codex/finish-metrics-sharing、費用/個人情報不使用。全承認は継続し追加承認待ちを設けない。一小タスクは終了時のmetrics共有だけ。

## 設計・比較した選択肢

1. 採用: finishSessionの非編集・保存後の同期ブロック内だけ、sessionのオブジェクト同一性でWeakMapへ既存sessionMetricsの結果を保持し、computeTodaysResultとtrGrowthBeforeForへ同じ関数を渡す。終了すると参照を手放す。global cache/DB_REV/署名/数学はそのまま。目標は15018回のmetrics/署名参照の重複削減で、5001回の統計計算削減や改善幅を先に保証しない。
2. 恒久cacheのDB_REVを外す: 署名衝突や編集の再計算を損なうため不採用。
3. 履歴数を制限して計算する: 成長継続や同日/過去日比較の意味を変えるため不採用。

新しい機能ではなく、既存の得点・グルーピングの成長比較を速くする。product visionの4gateは既存分析の接続、成長の表示維持、完全local、普段の記録終了を速くする点で満たす。UI/操作数は増やさない。共有scope内は同期で、sessionもmetricsも変更しない。gamificationの追加saveやopenSummaryの前にscopeを終え、編集経路は現状どおり。エラーは既存と同じく伝播し、保存処理や失敗時処理を追加しない。

## 実装と受入の順序

- 実source112へ回帰を先に追加。実native finishで同一recordのmetrics実計算呼出はscope内一回、結果/growthBeforeは無共有の既存49/50計算とdeep equal。通常/同日/過去日未来除外/少数/座標なし/gamification/編集、同ID別object、次の終了後の再計算を確認。320/375明暗、旧全件/新矢/score/reload/errors0、375前後画像を保存。
- scripts/50-record-view.jsの非編集結果計算ブロックにのみ一時WeakMapを置く。49/40/採点/保存/schema/style/handlers/依存/SWactivationは変更しない。既存77taskobjectsと全acceptance、共有hiddenlockを保持する。
- check:todays-result、check:all/lint/format、生成全E2E、Chrome/WebKitのfocused実UIを検証。readonly独立reviewへimmutable差分を渡す。
- 原Linux112と候補生成物で同一fixture/11native操作/callback性能時計を用い、Chrome/WebKit375抑制motion×3/5000×2、追加ChromeCPU4×2のbefore/afterを直列測定する。別profileは回数検証として分離し、wrapper時間を速度改善へ混ぜない。全条件再監査/fieldINP改善とは呼ばない。
- 現markers読取後version:bumpで一括更新。承認済み公開ループを実行し、CI/実Linux-public25byte・元所有112context更新保留/banner/旧記録/新native/offlineを確認後だけAN078pass+非空evidence、progress/tasks/ledgerを更新。

今回、容量警告の重なりや結果画面DOMの計算は別タスクへ残す。物理iPhone/VoiceOver/実paint/fieldINP/GPU/実射/実巨大履歴/WKstrictOffline/旧閉鎖profiles回復は未証明。大目標active。

## 設計の自己検査

未定API・placeholderなし。object identity/scope/破棄時点を明示し、変更は一つの同期計算へ限定。既存署名・DB_REVや保存を保持する条件と、gamification後に共有を使わない条件に矛盾なし。受入は同条件before/afterと実結果一致を分け、測定だけで改善を断定しない。
