# Capacitorのnative proxy修正 — AN086

基点a6ff8b71acd405106c72f31371fc852e33abe221、公開v120/sourceafe4f1b91d4bbc8a46bc3fdd475b25acfb493dda。既存の全承認を継続し、費用・個人情報を使わず、所有worktree/Node22/新しい非junction sandboxだけで依存を更新する。共有node_modulesとhidden lockは変更しない。

## 根拠と範囲

GitHubのopen #36/#37は@capacitor/androidと@capacitor/iosの8.4.0に対するGHSA-rvm3-566m-v7fv。公式は8.4.3を修正版として公開している。[公式advisory](https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv)、[8.4.3release](https://github.com/ionic-team/capacitor/releases/tag/8.4.3)。main/subframeの内部proxy pathへのnavigationと、無効時/document requestのproxy提供を制限するnative層の修正。

既存package.json/package-lock.jsonの対象2件だけを8.4.3へ更新する。範囲は~8.4.3とし、現在のminor内の修正版を下限にする。core/CLI/plugins/他locknodesは保持し、registryの実peer条件を確認する。feature追加ではなく、既存のlocal記録とnative能力を保護するmaintenance。4 product gatesへの影響は、既存の記録・分析連携/成長表示/全local/日常使用をすべて保持するもの。

Android projectはnode_modules/@capacitor/android/capacitorを参照している。iOS projectは現repoにない。native APK/IPAのbuild・sync・配布は今回の受入に含めず、既に配布されたbinaryが直ったとは主張しない。公式も修正版へ更新後の再build/再配布を必要としている。

## 順序と受入

1. 旧85tasks、package/lock、open alerts、registryの旧/新metadataを所有artifacts/native-proxy-patchへ保存。新しい空sandboxへtracked sourceをcopyし、既存node_modulesへのjunctionがないことをassert。npm lock-onlyをignore-scripts/所有cacheで実行し、2件とroot rangesだけが変わったことを確認してから正本へ反映する。
2. そのlockで独立npm ci --ignore-scriptsを行い、実package version/integrity/peer tree、全advisory範囲の非該当、配布native sourceに公式guard修正が含まれることを確認する。これはnative実機でのexploit再現/修正確認の代用とはしない。
3. 更新depsの同sandboxでcheck:all、lint、format:checkを完了してから全生成E2E317を単独で実行する。同じserved distの生成を並行しない。全生成PWA25資産は旧v120候補とbyte一致。全app/CSS/数学/保存/採点/半径/handlers/SW/版markers120/他依存/旧85tasks/acceptance/共有hidden lockがexactであることを確認する。依存更新だけのためversion bump/更新banner変更は不要。
4. 独立readonlyreview後に承認済push。CIのclean install/checks/lint/format/全E2E、実Linux25資産と旧Linux120/publicのbyte一致、GitHub #36/#37が自動fixedになることを確認する。手動dismissはしない。
5. 元失敗も含むraw evidenceをbyte保持してarchiveし、全受入成功後にだけAN086pass+evidence/progress/ledgerを更新。公開後notesはlocalcommit。大目標はactiveのまま。nativebinaryの再build/再配布/実機remediationは未証明として残す。次は射形トラッキングの比較scopeとUIの長文説明を確認する。
