# 現在の状態

> 現在地の正本。履歴は docs/codex/codex-progress.md。

## 現在地

- 公開v97、main dd3cda12b304e0991c611789674183c4ef9fa6e2、runtime58c411e。公開CI36947646285/Pages36947645601成功・120passed(1.5m)と全21bytes/375操作/offline保持済み。
- 作業場所: C:/Users/eita2/.codex/worktrees/app-quality/archery-note、codex/record-toast。前のgoal turnはAN-052公開でprogress。今回AN-050通知修正はローカル検証完了、版97維持、未公開。
- 人間「すべて承認します」は局所改善/次版公開/既存AN-038依存に継続。費用/個人情報使用は禁止。元checkout/共有node_modulesを保全。

## 今回完了 — AN-050

- 記録toast固定92pxがdock文字に重なることをred12で再現。通知時にdock上端の実寸＋16pxを測り、active record・非modalだけ適用。show時resizeとtab復帰dock再生成でも再計測。内容/role/寿命/操作列layoutは維持。
- dark/auto-darkの旧背景overrideが暗文字と同色になる原因を画像とcontrastred2(1.107:1)で確認。paired inverse tokensへ戻し、contrast≥4.5を検証。
- 独立reviewのP2「新通知なしでtab復帰」red2を追加し修正。最終12 passed (2.5m)、関連10 passed (1.9m)。Chrome/WK320/375/900・normal/reduce、矢/capacity/end/undo/finish、toastrole/contrast/寿命、settings/results、tab/resize、点数/架空保存保持/error0。初期green12/中間12・related24は別段階としてdocに保持。
- UI/app/globals/lint/format/storage成功、375前後と320長文通知を目視。初回app slice/listener位置・testlint globals失敗は修正してログ保持。
- 変更: scripts/10-storage-native.js/50-record-view.js/90-init.js、style.css/min、record-toast.spec.js、改善doc/375前後画像、CHANGELOG/progress/tasks/台帳。採点/保存schema/版/worker/deps不変。

## 次と未解決

- 次AN-051: 開始の的・1エンド本数selectorを既存ラベルと結び付ける。完了後AN-053で通知と入力名を次版全体検証/承認済み公開。公開前にfull acceptance、追加承認質問不要。
- AN-038major隔離検証は承認済み未実装、既存ZIP13/27とaudit high4packages未解決。
- root node_modulesは元checkoutjunction、install/update/ci禁止。owned sandboxだけ使用。
- 実iPhone/keyboard/VoiceOver/5000実保存/INP、AN-001実射は未確認。headless touch/geometry読み取りとprogrammatic correction scrollの検証。大目標active。
