# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

## 現在地

- 公開アプリはv105。main `06e27752a79ec28841dc5a4f03f0672b3dfb34a6`、CI37192326992 validate/deploy成功、実Linux artifact11299646439。公開/current Linux/前回accepted105のアプリ25資産は全byte exact一致。結果先行UIはAN065のまま、アプリsource/版/採点/保存schema/SW activation/依存変更なし。
- AN066完了: 自動検証のraw native swipeがChromium149のflingを起こし、次のtapを取消として抑制する原因をtrace/104・105対照/小HTML/入力間隔対照で特定。tests/e2e/native-touch.jsをpreventFling付きnative scroll gestureへ変更、tests/e2e/modal-swipe-followup.spec.jsが320/375で最初の終了touch一回・保存・旧データ保持・reloadを確認。
- raw入力red2 failed→controlled入力と既存modal green5 passed (4.9s)。check:all/lint/format成功。最初の全体runは1failed/157passedを保持、同じdistへの並行buildを避けた再実行158passed (2.0m)、Linux158passed (3.4m)。最初のタイムアウトを並行build原因と断定しない。
- 元104→105複合local経路を設定swipe入力だけ変更してEscapeなしで再実行。初回15body/canonical14/旧5件exact、native修正・確定・次矢/的guard/offline SWreload/分析focus・select/mouse record-tab/最初のnative終了tap/7矢保存・6履歴・active null/旧5exact/errors0。元の新失敗contextは保持してShift＋二回目tapで同context終了を記録、別対照で二回目tapだけでも成功。Shift単独の因果や実公開旧profile更新の新証拠とはしない。
- 診断/対照/出力は artifacts/touch-click-v105、説明は docs/codex/touch-click-diagnosis.md。検証入力の375前後画像2枚を保存・表示・byte同一copy。公開UIの変更前後ではない。読取専用review P1/P2なし。
- 所有worktree C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/touch-click-diagnosis。owned sandbox/isolatedNode22.19。root/original node_modules junction install/ci/update禁止。共有hiddenlock SHA16F9BA6219DA31278CED98C0C742013B4A5AAEA63059E4702E86756702A23309保持。費用/個人情報不使用。

## 次と未解決

- 次の一小タスク: 公開版の初回記録ガイドを所有架空profileで320/375監査し、最初の矢→微調整→エンド確定→終了を迷わず進められる説明か確認。current activeGuideHtmlと実画面に結びつけ、必要なら一件だけ改善候補を選ぶ。新しい実装は次runで決める。既存全承認、大目標active。
- AN065の4失敗local rehearsalは既にsnapshot/liveness後明示abort済み、今回回復したとは扱わない。今回の原因はChromium synthetic入力の診断。新回帰はChromium/reduced motionのみで、実iPhoneの速いswipe後の最初のtap/VoiceOver/Tab順序/keyboard/実INPの保証ではない。
- WK context.setOffline reload内部エラーはactual101/102双方で再現。実origin停止保持は確認、uncached browser fetch Returned response is null旧probe未解決。元public98→99/99→100失敗profile未復旧、WK初期strict lifecycle不明。実iPhone二本指/5000実保存/全normal-motionフレーム/posecamera・GPU/AN001実射未確認。
