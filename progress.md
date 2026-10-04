# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

## 現在地

- 公開アプリはv105。main `06e27752a79ec28841dc5a4f03f0672b3dfb34a6`、CI37192326992 validate/deploy成功、実Linux artifact11299646439。公開/current Linux/前回accepted105のアプリ25資産は全byte exact一致。結果先行UIはAN065のまま、アプリsource/版/採点/保存schema/SW activation/依存変更なし。
- AN066完了: 自動検証のraw native swipeがChromium149のflingを起こし、次のtapを取消として抑制する原因をtrace/104・105対照/小HTML/入力間隔対照で特定。tests/e2e/native-touch.jsをpreventFling付きnative scroll gestureへ変更、tests/e2e/modal-swipe-followup.spec.jsが320/375で最初の終了touch一回・保存・旧データ保持・reloadを確認。
- raw入力red2 failed→controlled入力と既存modal green5 passed (4.9s)。check:all/lint/format成功。最初の全体runは1failed/157passedを保持、同じdistへの並行buildを避けた再実行158passed (2.0m)、Linux158passed (3.4m)。最初のタイムアウトを並行build原因と断定しない。
- 元104→105複合local経路を設定swipe入力だけ変更してEscapeなしで再実行。初回15body/canonical14/旧5件exact、native修正・確定・次矢/的guard/offline SWreload/分析focus・select/mouse record-tab/最初のnative終了tap/7矢保存・6履歴・active null/旧5exact/errors0。元の新失敗contextは保持してShift＋二回目tapで同context終了を記録、別対照で二回目tapだけでも成功。Shift単独の因果や実公開旧profile更新の新証拠とはしない。
- 診断/対照/出力は artifacts/touch-click-v105、説明は docs/codex/touch-click-diagnosis.md。検証入力の375前後画像2枚を保存・表示・byte同一copy。公開UIの変更前後ではない。読取専用review P1/P2なし。
- AN067完了（監査だけ）: 公開v105の既存所有架空IAB profileでガイド→矢→微調整→確定→終了を375/320で操作。22同run JPEGを保存bytesから表示・目視し、docs/screenshots/first-guide-v105へbyte同一copy。論理375×812/320×568に対して保存365×790/310×550。375は3本30点、320は1本10点を確定/終了。reload前後の履歴7回28本・リスト全文が一致。DOM14script URLs105、取得errorlogs空。docs/codex/first-record-guide-audit.md、artifacts/first-guide-v105。新規welcome/実機/物理/保存全field exact/offlineの証明ではない。
- 通常条件指定の320開始でscrollY416.67、的SVG上端-91.33/高さ204.48、的上半分が画面外。manual scroll後は入力成功。Home検査やviewport変更frameと別条件。source fStart active/save/renderに開始位置調整なし、revealActiveTargetは解除/確定後だけ。原因は次runの縮小/red対照で確認してから修正。ガイドの終了名不一致/解除・partial説明不足、320微調整後の下端dock重なり、1本RMS0の改善表示も別候補として保持。
- AN067検証: format:check「All matched files use Prettier code style!」、verify-audit.py成功（全67acceptance/既存66task、22JPEG/copy/埋込、320geometry、reload履歴、cleanup、runtime/共有lock不変）。変更ファイルは監査文書/22画像/progress/tasks/ledgerだけ。全アプリテストの新規実行や公開更新はなし。
- 所有worktree C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/first-record-guide-audit。owned sandbox/isolatedNode22.19。root/original node_modules junction install/ci/update禁止。共有hiddenlock SHA16F9BA6219DA31278CED98C0C742013B4A5AAEA63059E4702E86756702A23309保持。費用/個人情報不使用。

## 次と未解決

- 次の一小タスク: 条件を指定して開始した直後に、的を操作できる位置に戻す。開始前後のscroll/target/dockを縮小観測して原因を確認し、320/375のred→greenで新規開始各入口（条件指定/前回条件/onboarding）を検証する。既存revealActiveTargetの適用は候補で、通常render/タブ復帰/メタ入力の位置を一律resetしない。4product gatesは監査文書に記載。実装/公開は未着手、既存全承認、大目標active。
- AN065の4失敗local rehearsalは既にsnapshot/liveness後明示abort済み、今回回復したとは扱わない。今回の原因はChromium synthetic入力の診断。新回帰はChromium/reduced motionのみで、実iPhoneの速いswipe後の最初のtap/VoiceOver/Tab順序/keyboard/実INPの保証ではない。
- WK context.setOffline reload内部エラーはactual101/102双方で再現。実origin停止保持は確認、uncached browser fetch Returned response is null旧probe未解決。元public98→99/99→100失敗profile未復旧、WK初期strict lifecycle不明。実iPhone二本指/5000実保存/全normal-motionフレーム/posecamera・GPU/AN001実射未確認。
