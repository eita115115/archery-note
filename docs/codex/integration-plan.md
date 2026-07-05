# Archery Note Integration Plan

Source PDF: `C:\Users\eita2\Downloads\archery-note 統合実装の Codex 指図書.pdf`
Extracted on: 2026-06-29
Pages: 24

This file is the durable implementation brief for integrating the stronger parts of `archery-master` into `archery-note` while keeping `archery-note` as the public product and preserving existing user data.

## Codex Working Summary

- Keep `archery-note` as the single target repository and public brand.
- Preserve existing local data. Migrations must be idempotent and must not delete legacy data on failure.
- Do the work in small, reviewable steps. After each step, run the narrowest useful validation and update `docs/codex/codex-progress.md`.
- Keep the web/PWA surface first. Treat Android/Capacitor work as secondary unless requested.
- Keep OCR, pose, AI, and third-party model assets default-off until provenance and redistribution terms are documented.
- Avoid sibling-repository assumptions in README, docs, and runtime behavior.
- When changing PWA update behavior, avoid immediate forced replacement. Prefer explicit update notification and staged activation.
- Keep this loop executable by low-cost models. Per-task recipes with validation and stop conditions live in the `$archery-note` skill (`references/recipes.md`); when the running model is weak or context is lost, follow the recipe literally and stop at its stop conditions.

## Non-Negotiable Rules For Implementation

- Do not lose existing Archery Note user records.
- Do not remove legacy storage data during migration failure handling.
- Do not merge large unrelated refactors into feature commits.
- Do not make the primary iPhone workflow crowded. Hide advanced or rare controls behind secondary UI.
- Do not treat extracted command snippets below as copy-paste safe until they are checked against the current repository.

## Full Extracted Brief

The text below is extracted from the PDF. Some line breaks, citation tokens, and command spacing may reflect PDF extraction artifacts. Prefer the working summary above and the current repository state when they conflict.

## Page 1

archery-note 統合実装の Codex 指図書
Executive summary
結論は明確です。提出対象は archery-note に⼀本化し、archery-master の強い実装を段階的に吸収するの
が最も安全です。現在の archery-note は、公開 URL、README、PWA としての配布形態、記録‧履歴‧サ
イト調整‧⽤具という利⽤者向けの筋が通っています。⼀⽅の archery-master は、 .github/workflows 、
ui 、 app-scripts.json 、より厚い check:* 群、 check:all 、manifest 駆動寄りの Service Worker、追
加画⾯、 pose_landmarker_lite.task などを持ち、技術基盤としては⼀段強いです。ただし、 Archery-
master / ARCHERY MASTER / 「的ノート」などのブランド混在や sibling repo 前提の README は、審査‧公
開 OSS の両⾯でノイズになります。したがって、顔は archery-note、⾻格は archery-master から移植が正
解です。 1
現在の公開実装では、 archery-note は manifest.json の名称‧説明‧タイトルが Archery Note で揃っ
ており、 check:app / check:ui と Android 同期系スクリプトを持ちます。対して archery-master は
check:integration 、 check:ocr 、 check:form 、 check:decision 、 simulate:* 、 check:all を持ち、
GitHub Pages デプロイ workflow で npm ci 、 check-beta.js --prep 、 check-integration.js の成功後
に publish する構成です。この差分はそのまま「移植候補⼀覧」になります。 2
また、両リポジトリとも meta viewport に maximum-scale=1, user-scalable=no を含んでおり、これは
MDN が弱視ユーザーの読みやすさを損なうとして警告している設定です。Service Worker についても、
archery-note は固定アセット配列＋即時 skipWaiting() / clients.claim() 、 archery-master は app-
scripts.json を読んでキャッシュ対象を決め、 version.json を no-store とし、AI 系 CDN を別バケット
に分ける実装です。更新反映とキャッシュ整合性を壊さずに強化するには、manifest 駆動‧段階更新‧待機
中 SW の明⽰通知に寄せるべきです。 3
この⽅針は、会話に添付された監査報告の推奨とも⼀致しています。fileciteturn(cid:63153)file(cid:63153)
現状診断と前提
明⽰的な前提
この指図書は、
「archery-master in my workspace」= 公開リポジトリ eita115115/archery-master を参照元とする とい
う前提で書いています。プロンプト内にローカル filesystem path や monorepo の相対パスが⽰されていない
ためです。もし実際には別パスの workspace copy があり、public repo と差分があるなら、Codex は最初
に inventory を実⾏して public とローカルの差分を列挙してから作業開始してください。
もうひとつ重要な前提があります。 archery-note の既存ストレージは互換性維持が最優先ですが、今回の
公開ブラウズでは storage 実装本体の全⽂取得には限界がありました。そのため、移⾏コードは「現物の
storage helper から legacy key 名‧JSON 形状を最初に抽出する」前提の adapter-first 設計で書いていま
す。つまり、以下の移⾏スニペットはそのままコピペするのではなく、最初に localStorage / IndexedDB /
backup JSON の実 key を grep してから埋める仕様です。
1

## Page 2

現在と⽬標のファイル⽐較
以下の⽐較表は、公開リポジトリのトップレベル、主要 HTML/manifest/package/service worker、GitHub
Actions 公開情報をもとにしたものです。 archery-note には android , docs , scripts , tools ,
index.html , manifest.json , sw.js , package.json が⾒え、 archery-master にはそれに加えて
.github/workflows , ui , app-scripts.json , beta.json , pose_landmarker_lite.task が⾒えます。
archery-note の package scripts は check:app / check:ui 中⼼ですが、 archery-master は
check:integration など複数の検証を束ねた check:all を持ちます。さらに、 archery-note の manifest
は Archery Note で統⼀されている⼀⽅、 archery-master は manifest‧OG‧title‧header で Archery-
master / ARCHERY MASTER が混在しています。 4
現在の archery-
項⽬ 現在の archery-master ⽬標状態
note
提出対 公開 URL と
技術的に厚いがブランド混在 archery-note に⼀本化
象 README の筋がある
ブラン Archery Note で⽐ Archery-master / ARCHERY MASTER / すべて Archery Note に
ド 較的⼀貫 「的ノート」混在 統⼀
Pages build runs は ci.yml + deploy-
.github/workflows/deploy-pages.yml
CI あるが custom CI は pages.yml を archery-
がある
⾒えにくい note に追加
check:app , check:all , check:integration ,
note 側に alias と統合検
scripts check:ui , native check:ocr , check:decision ,
証を追加
sync/build simulate:*
app-scripts.json 駆動、
固定 asset 配列、即 manifest ⽣成 + 待機更
SW version.json no-store、AI cache 分
時 activate 新通知 + 段階 activate
離
viewport 修正、toast/
nav/gear には aria
a(cid:63154)(cid:63154)y toast role などは強いが zoom 禁⽌ status 強化、200%
があるが zoom 禁⽌
zoom 対応
追加機 記録 / 履歴 / サイト 分析 / 統計 / OCR / form / vision / AI 資
安全な機能から段階統合
能 調整 / ⽤具 産
第三者 THIRD_PARTY.md と
出⾃⽂書が⾒えない pose_landmarker_lite.task が visible
資産 NOTICE 作成
現状アーキテクチャの要点
archery-note の index.html は Archery Note タイトル、 og:url 、 nav aria-label="主な画⾯(cid:63263) 、
bootFallback 、 updBar を持ち、画⾯は 記録 / 履歴 / サイト調整 / ⽤具 の構成です。 archery-master は
同様の shell を持ちながら、 Home / Record / Analysis / History / Stats のタブ、 role="status" aria-
live="polite" を持つ toast、より厚い UI CSS を備えています。統合のコアは、note の配布⾯を維持しつ
つ、master の shell と検証‧分析導線を背⾯から吸収することです。 5
2

## Page 3

既存データ互換
archery-note
公開URL/PWA/
既存データ
ArcheryNote
統合先 更新しやすいPWA
単一リポジトリ
archery-master
CI/統計/分析/
app-scripts/UIshell
CodexforOSS
向け公開体裁
統合⽅針と優先順位
統合の原則
今回の統合は「全部マージ」ではありません。互換性維持‧公開ブランド維持‧PWA 安定性維持を優先し、
その範囲で archery-master の強みを吸う設計にします。GitHub Docs は README‧LICENSE‧
CODE_OF_CONDUCT‧CONTRIBUTING などの community health files を public repository の community
profile で明⽰的に評価しており、CONTRIBUTING は root / .github / docs のいずれかに置くことで
discoverability が上がります。SECURITY.md には supported versions と脆弱性報告⽅法を書くのが推奨さ
れています。したがって、Phase (cid:63154) は機能追加よりも公開 OSS としての⼟台の整備が先です。 6
優先バックログ
機能統合の優先度は、壊れにくく、価値説明しやすく、既存データ構造を⼤きく変えないものを最上位に置
きます。逆に、OCR‧pose‧AI 採点‧外部モデルは、 pose_landmarker_lite.task のような第三者資産の
出所‧再配布条件‧更新⼿順が未整理な限り、即時統合ではなく experimental または roadmap 扱いにす
べきです。 7
優先
統合対象 理由 実装⽅針
度
CI / check:all / deploy
A 壊れにくく、審査にも効く archery-note に即投⼊
workflow
toast/status / update UX と a(cid:63154)(cid:63154)y 改善、互換性リスク HTML/CSS/初期化 JS に
A
banner / shell 低 限定
archery-master の強みを visible 既存 record/history の上
A 分析‧統計導線
にできる に追加
app-scripts ⽅式の asset
A SW 保守性が上がる ⽣成ファイル導⼊
inventory
価値が⾼いがデータ項⽬差分に
B サイト判断ロジックの強化 adapter 層を置いて移植
注意
既存 schema に additive
B ⽤具カタログ拡張 既存 Gear と相性が良い
追加
B ⾵補正 / 物理計算 強いが責務が増える analysis 配下に隔離
3

## Page 4

優先
統合対象 理由 実装⽅針
度
C OCR / 写真 AI / pose 出⾃整理と容量‧法務確認が先 今回は default off
C sibling repo 依存機能 公開 repo の完結性を落とす README 本体から外す
⼩さなコミットで進める運⽤
GitHub Docs も CONTRIBUTING discoverability と well-formed PR の重要性を強調しているので、Codex に
は⼩さなコミット単位を厳守させるべきです。 README + LICENSE 、 community files 、 viewport/a11y 、
CI 、 SW refactor 、 storage migration 、 analysis integration を分けるのが安全です。 8
上限の
コミット単位 直後に必須の確認 例
⽬安
docs / health (cid:63154)(cid:63153) files Markdown レンダリ chore(oss): add license and community
files 前後 ング health files
5‒15 rg で旧名が残って chore(brand): unify app name as Archery
brand 統⼀
files いないか Note
3‒10 ⼿動 200% zoom / fix(a11y): remove zoom restrictions and
a(cid:63154)(cid:63154)y / shell
files keyboard add live regions
ci: add pull-request checks and pages
CI (cid:63155)‒(cid:63157) files workflow YAML lint
deploy workflow
offline / update feat(pwa): introduce manifest-driven
SW / versioning (cid:63156)‒(cid:63161) files
banner cache versioning
storage feat(storage): add v2 schema migration
(cid:63156)‒(cid:63161) files 旧データ読み込み
migration with rollback snapshot
analysis 5‒20 既存⼊⼒フロー non- feat(analysis): integrate stats and
integration files regression decision helpers
Codex に貼る実装指図書
⽬的
archery-note を提出対象リポジトリとして強化する。 archery-master の強い部分を archery-note に統
合するが、既存の archery-note ローカルデータ互換性と既存の PWA 挙動は壊さない。ブランド名はすべて
Archery Note に統⼀する。現在の archery-note は Archery Note タイトル‧manifest‧PWA シェルを持
ち、 archery-master は check:all 、 check:integration 、 deploy-pages.yml 、分析タブ、stats タブ、
manifest 駆動の Service Worker を持つ。これを前提に統合する。 9
⾮交渉ルール
• 既存 archery-note ユーザーの保存データを失わせない。
• migration は idempotent にする。
• migration 失敗時は legacy データを削除しない。
• Service Worker は即時上書きで壊す⽅針を取らない。待機中更新を UI で知らせる。
4

## Page 5

• archery-master 由来の OCR / pose / AI / 外部モデルは、第三者資産の出所整理が終わるまで
default off にする。
• README 本体から sibling repo 前提の説明を外す。
• 1コミットごとに検証する。
最初に実⾏する inventory コマンド
gitcheckout-bcodex/archery-note-integration
gitstatus
gitls-files>.codex-filelist.txt
rg-n"Archery-master|ARCHERY MASTER|的ノート|archery-master|user-scalable|maximum-scale|
skipWaiting|clients\\.claim|localStorage|indexedDB|version\\.json|app-scripts|check:all|check:ui|
check:integration".
node-v
npm-v
npminstall
npmruncheck:app
npmruncheck:ui
archery-note では check:app と check:ui が既に存在し、 archery-master では check:integration
を含む複数検証が check:all に束ねられている。これを確認してから統合作業に⼊ること。 10
初期 OSS 整備
Phase (cid:63154)。 最初に追加‧再構成するファイルは以下。
LICENSE
CONTRIBUTING.md
SECURITY.md
CODE_OF_CONDUCT.md
CHANGELOG.md
THIRD_PARTY.md
NOTICE
docs/development.md
docs/architecture.md
docs/data-model.md
docs/pwa-update.md
docs/codex/codex-for-oss.md
.github/ISSUE_TEMPLATE/bug_report.md
.github/ISSUE_TEMPLATE/feature_request.md
.github/PULL_REQUEST_TEMPLATE.md
.github/workflows/ci.yml
.github/workflows/deploy-pages.yml
GitHub の community profile は README / LICENSE / CODE_OF_CONDUCT / CONTRIBUTING / issue
template / security policy などを評価対象にしている。CONTRIBUTING は root / .github / docs に置け、
SECURITY.md には supported versions と脆弱性報告⽅法を書く。 6
5

## Page 6

推奨コミット
gitaddLICENSEREADME.mdCONTRIBUTING.mdSECURITY.mdCODE_OF_CONDUCT.md.githubdocs
gitcommit-m"chore(oss): add license, README, and community health files"
ブランド統⼀
Phase (cid:63155)。 以下をすべて Archery Note に統⼀する。
• index.html の <title> 、 og:title 、 h1
• manifest.json の name と short_name
• package description
• update banner / install prompt 周辺の表⽰名
• README ⾒出し
• GitHub Pages / Release / docs の名称
archery-note の manifest はすでに Archery Note で揃っている⼀⽅、 archery-master は manifest で
Archery-master — アーチェリー練習ノート 、title / OG で Archery-master — 練習ノート 、header で
ARCHERY MASTER を使っている。README 冒頭にも「的ノート」や「App Store版 Archery Note の体験を参
考」といった記述があるため、移植時は master 側を note ブランドへ寄せる。 11
検索と置換
rg-n"Archery-master|ARCHERY MASTER|的ノート|旧統合ベース|App Store版(cid:63110).
最⼩ diff 例

- <meta property="og:title" content="Archery-master — 練習ノート(cid:63110)>
- <title>Archery-master — 練習ノート</title>
- <div class="appIdentity"><h(cid:63154)>ARCHERY MASTER</h(cid:63154)><div class="sub">練習ノート</div></div>

* <meta property="og:title" content="Archery Note — 練習記録と分析(cid:63110)>
* <title>Archery Note — 練習記録と分析</title>
* <div class="appIdentity"><h(cid:63154)>Archery Note</h(cid:63154)><div class="sub">練習記録と分析</div></div>

CI と GitHub Pages の統合
Phase (cid:63156)。 archery-master の deploy workflow は npm ci 、 node tools/check-beta.js --prep 、 node
tools/check-integration.js 成功後に dist/native を Pages に上げている。GitHub Docs の custom
workflow guidance では、 actions/upload-pages-artifact と actions/deploy-pages を使い、deploy
job に pages: write と id-token: write 、 needs: build 、 environment: github-pages を与えるのが
基本形である。 12
追加する ci.yml 例
name:CI
on:
6

## Page 7

pull_request:
push:
branches:[main]
jobs:
validate:
runs-on:ubuntu-latest
steps:
-name:Checkout
uses:actions/checkout@v(cid:63157)
-name:Setup Node
uses:actions/setup-node@v(cid:63157)
with:
node-version:22
cache:npm
-name:Install
run:npm ci
-name:App checks
run:npm run check:app
-name:UI checks
run:npm run check:ui
-name:Integration checks
run:npm run check:integration
continue-on-error:false
-name:Smoke tests
run:npm run test:smoke
-name:Lint
run:npm run lint
-name:Format check
run:npm run format:check
追加する deploy-pages.yml 例
name:Deploy Pages
on:
push:
branches:[main]
workflow_dispatch:
permissions:
contents:read
7

## Page 8

pages:write
id-token:write
concurrency:
group:pages
cancel-in-progress:true
jobs:
build:
runs-on:ubuntu-latest
steps:
-name:Checkout
uses:actions/checkout@v(cid:63157)
-name:Configure Pages
uses:actions/configure-pages@v(cid:63158)
-name:Setup Node
uses:actions/setup-node@v(cid:63157)
with:
node-version:22
cache:npm
-name:Install
run:npm ci
-name:Validate
run:npm run check:all
-name:Build page artifact
run:npm run build:pages
-name:Upload artifact
uses:actions/upload-pages-artifact@v(cid:63157)
with:
path:dist/pages
deploy:
environment:
name:github-pages
url:${{ steps.deployment.outputs.page_url }}
runs-on:ubuntu-latest
needs:build
steps:
-name:Deploy to GitHub Pages
id:deployment
uses:actions/deploy-pages@v(cid:63157)
package.json の scripts 追加例
8

## Page 9

現在の archery-note は check:app と check:ui があるので、それを壊さず、archery-master 由来の検証
名を aliased に⾜す。 archery-master の check:all はかなり重いので、最初は note に⼊る実装範囲に応
じて束ね直す。 10
{
"scripts": {

- "check:all": "npm run check:app && npm run check:ui && npm run check:integration && npm run
  test:smoke",
  "check:app": "node tools/check-app.js",
  "check:ui": "node tools/check-ui.js",
- "check:integration": "node tools/check-integration.js",
- "test:smoke": "node tools/check-smoke.js",
- "lint": "eslint . && stylelint \"**/\*.css\" && markdownlint-cli(cid:63155) \"**/*.md\"",
- "format:check": "prettier -c .",
- "build:pages": "node tools/build-pages.js",
  "version:bump": "node tools/bump-version.js"
  }
  }
  依存追加例
  npminstall-Deslint@eslint/jsprettierstylelintstylelint-config-standardmarkdownlint-cli2
  htmlhint@playwright/test
  アクセシビリティと HTML shell
  Phase (cid:63157)。 現在の archery-note と archery-master の両⽅で viewport に maximum-scale=1, user-
  scalable=no が⼊っている。MDN ⽇本語版は、 user-scalable=no が弱視ユーザーの読み取りを妨げ、
  WCAG では少なくとも 2 倍、推奨として 5 倍ズームを妨げないべきだと警告している。したがって、この修
  正は必須。 13
  最⼩変更

* <meta name="viewport" content="width=device-width, initial-scale=(cid:63154), maximum-scale=(cid:63154), user-
  scalable=no, viewport-fit=cover">

- <meta name="viewport" content="width=device-width, initial-scale=(cid:63154), viewport-fit=cover">

もし safe area が未使⽤なら、さらに単純化してよい。

- <meta name="viewport" content="width=device-width, initial-scale=(cid:63154), viewport-fit=cover">

* <meta name="viewport" content="width=device-width, initial-scale=(cid:63154)">

archery-master の toast は role="status" aria-live="polite" aria-atomic="true" を持つ。 archery-
note の toast は role が⾒えていないので、note 側へ移植する。update bar も div より button
type="button" にした⽅が操作しやすい。 14
9

## Page 10

- <div class="updbar" id="updBar" hidden>新しい版があります。タップで更新</div>
- <div class="toast" id="toast"></div>

* <button type="button" class="updbar" id="updBar" hidden aria-live="polite">新しい版がありま
  す。タップで更新</button>
* <div class="toast" id="toast" role="status" aria-live="polite" aria-atomic="true"></div>

アクセシビリティ確認チェック
項⽬ 確認内容
zoom iOS Safari / Chrome Android で 200% 以上拡⼤可能
keyboard tab / shift+tab / enter / space で主要操作到達
live region 保存成功 / 失敗 / 更新待機が screen reader で読まれる
nav aria-label="主な画⾯(cid:63263) 維持
icon only 設定ボタン、更新ボタン、メニュー系に aria-label
contrast テキスト / ボタン / updBar のコントラスト確認
reflow (cid:63156)(cid:63155)(cid:63153)px 幅‧200% zoom で横スクロール強制にならない
Service Worker と更新戦略
Phase (cid:63158)。 archery-note の現⾏ SW は const CACHE = "archery-note-v54" 、固定の APP_SCRIPTS 配
列、install 時 cache.addAll() 、直後 self.skipWaiting() 、activate 時 clients.claim() 、network-first
fallback です。 archery-master は app-scripts.json を fetch して asset list を組み⽴て、 version.json
を no-store 、AI 系 CDN を matonote-ai-prep へ分離しています。MDN は install/activate で
event.waitUntil() を使って cache populate と old cache cleanup を⾏うパターンを⽰しており、web.dev
は新しい SW が通常は waiting に⼊ること、 skipWaiting() は互換性を壊しうるので慎重に使うべきこ
と、 controllerchange を使って更新反映を扱うべきことを説明しています。 15
したがって、即時 skipWaiting() 常⽤をやめ、待機中 SW を UI で通知して、ユーザー操作で activate に変
える。さらに、⼿書き APP_SCRIPTS ではなく⽣成 manifest に寄せる。
新しい cache naming 例
constAPP_VERSION="(cid:63154).(cid:63153).(cid:63153)-beta";
constCACHE_NS="archery-note";
constCACHE_APP=`${CACHE_NS}:app:${APP_VERSION}`;
constCACHE_RUNTIME=`${CACHE_NS}:runtime:${APP_VERSION}`;
constCACHE_AI=`${CACHE_NS}:ai:${APP_VERSION}`;
constIMMUTABLE_CACHES=[CACHE_APP,CACHE_RUNTIME,CACHE_AI];
⽣成 manifest ⽅針
• tools/generate-app-assets.js を作る
• scripts/ , style.css , manifest.json , icons, version.json を⾛査
• 出⼒先: app-assets.generated.json
10

## Page 11

• build:pages の前に⽣成する
SW 実装パターン例
self.addEventListener("install",(event)=>{
event.waitUntil((async()=>{
constres=awaitfetch("./app-assets.generated.json",{cache:"no-store"});
constmanifest=awaitres.json();
constcache=awaitcaches.open(CACHE_APP);
awaitcache.addAll(manifest.appShell);
})());
});
self.addEventListener("activate",(event)=>{
event.waitUntil((async()=>{
constkeys=awaitcaches.keys();
awaitPromise.all(
keys
.filter((key)=>key.startsWith("archery-note:")&&!IMMUTABLE_CACHES.includes(key))
.map((key)=>caches.delete(key))
);
awaitself.clients.claim();
})());
});
self.addEventListener("message",(event)=>{
if(event.data?.type==="SKIP_WAITING"){
self.skipWaiting();
}
});
self.addEventListener("fetch",(event)=>{
if(event.request.method!=="GET")return;
consturl=newURL(event.request.url);
if(/\/version\.json(?:\?|$)/.test(url.pathname+url.search)){
event.respondWith(fetch(event.request,{cache:"no-store"}));
return;
}
if(event.request.mode==="navigate"){
event.respondWith((async()=>{
try{
constresponse=awaitfetch(event.request);
construntime=awaitcaches.open(CACHE_RUNTIME);
runtime.put(event.request,response.clone());
returnresponse;
}catch{
return(awaitcaches.match("./index.html"))||Response.error();
}
11

## Page 12

})());
return;
}
event.respondWith((async()=>{
try{
constresponse=awaitfetch(event.request);
constbucket=/mediapipe|tesseract\.js/.test(url.hostname+url.pathname)?CACHE_AI:
CACHE_RUNTIME;
constcache=awaitcaches.open(bucket);
cache.put(event.request,response.clone());
returnresponse;
}catch{
return(awaitcaches.match(event.request,{ignoreSearch:true}))||Response.error();
}
})());
});
ページ側 update banner のパターン例
exportasyncfunctionregisterAppServiceWorker(){
if(!("serviceWorker"innavigator))return;
constreg=awaitnavigator.serviceWorker.register("./sw.js");
functionshowUpdateReady(waitingWorker){
constbar=document.getElementById("updBar");
if(!bar)return;
bar.hidden=false;
constonClick=()=>{
waitingWorker.postMessage({type:"SKIP_WAITING"});
bar.disabled=true;
};
bar.addEventListener("click",onClick,{once:true});
}
if(reg.waiting)showUpdateReady(reg.waiting);
reg.addEventListener("updatefound",()=>{
constnewSW=reg.installing;
if(!newSW)return;
newSW.addEventListener("statechange",()=>{
if(newSW.state==="installed"&&navigator.serviceWorker.controller){
showUpdateReady(newSW);
}
});
});
navigator.serviceWorker.addEventListener("controllerchange",()=>{
window.location.reload();
12

## Page 13

});
}
ストレージ移⾏と後⽅互換
Phase (cid:63159)。 これは最重要です。 archery-note は既存ローカル保存互換を守る必要があります。したがって、
変更は schema wrap + read-time migration + rollback snapshot に限定する。legacy key を消すのは、
少なくとも 1 リリース後。export/import では旧 JSON も読めるようにする。MDN は Service Worker 更新時
に旧キャッシュを残しつつ activate で掃除する pattern を⽰しており、同じ考え⽅を storage migration にも
適⽤できます。つまり、旧データはすぐに捨てず、新 schema が安定してから掃除です。 16
やること
• まず
rg -n "localStorage|indexedDB|backup|restore|JSON.parse|JSON.stringify" scripts tools を
実⾏して、現⾏ key 名と export/import 形式を抽出。
• docs/data-model.md に legacy key と new envelope を明記。
• 新 schema は additive にする。既存 field 名の rename は原則禁⽌。
• 読み込み順は new primary → legacy primary → latest backup snapshot → empty default 。
• migration は⼀度成功しても再実⾏で壊れないようにする。
推奨 key 設計
constSTORAGE_KEYS={
PRIMARY_V(cid:63155):"archery-note:data:v(cid:63155)",
MIGRATION_META:"archery-note:migration-meta",
ROLLBACK_SNAPSHOT:"archery-note:rollback-snapshot",
LAST_GOOD_EXPORT:"archery-note:last-good-export",
// TODO: 実装時に既存 key 名へ置換
LEGACY_CANDIDATES:[
"LEGACY_PRIMARY_KEY",
"LEGACY_APP_STATE_KEY",
"LEGACY_BACKUP_KEY"
]
};
読み込みの主関数例
exportasyncfunctionloadCompatibleState(storage){
constcurrent=awaitstorage.getJSON(STORAGE_KEYS.PRIMARY_V(cid:63155));
if(current?.schemaVersion===2)returncurrent;
constlegacy=awaitdetectLegacyState(storage);
if(!legacy)returncreateEmptyStateV(cid:63155)();
awaitstorage.setJSON(STORAGE_KEYS.ROLLBACK_SNAPSHOT,{
savedAt:newDate().toISOString(),
payload:legacy
13

## Page 14

});
constmigrated=migrateUnknownLegacyToV(cid:63155)(legacy);
constvalidation=validateStateV(cid:63155)(migrated);
if(!validation.ok){
return{
...createEmptyStateV(cid:63155)(),
recovery:{
mode:"read-only",
reason:"migration-failed",
errors:validation.errors
}
};
}
awaitstorage.setJSON(STORAGE_KEYS.PRIMARY_V(cid:63155),migrated);
awaitstorage.setJSON(STORAGE_KEYS.MIGRATION_META,{
fromVersion:inferLegacyVersion(legacy),
toVersion:2,
migratedAt:newDate().toISOString()
});
returnmigrated;
}
legacy 検出例
asyncfunctiondetectLegacyState(storage){
for(constkeyofSTORAGE_KEYS.LEGACY_CANDIDATES){
constvalue=awaitstorage.getJSON(key);
if(value)returnvalue;
}
returnnull;
}
functioninferLegacyVersion(raw){
if(typeofraw?.schemaVersion==="number")returnraw.schemaVersion;
if(Array.isArray(raw?.sessions)&&Array.isArray(raw?.gear))return1;
if(Array.isArray(raw))return0;
return0;
}
移⾏例
functionmigrateUnknownLegacyToV(cid:63155)(raw){
constbase=createEmptyStateV(cid:63155)();
constsessions=Array.isArray(raw?.sessions)
14

## Page 15

?raw.sessions.map(normalizeSession)
:Array.isArray(raw)
?raw.map(normalizeSession)
:[];
constsights=Array.isArray(raw?.sights??raw?.sightMarks)
?(raw.sights??raw.sightMarks).map(normalizeSightMark)
:[];
constgear=Array.isArray(raw?.gear??raw?.equipment)
?(raw.gear??raw.equipment).map(normalizeGear)
:[];
return{
...base,
schemaVersion:2,
sessions,
sights,
gear,
analysisPrefs:normalizeAnalysisPrefs(raw?.analysisPrefs),
migratedFrom:inferLegacyVersion(raw)
};
}
validation 例
functionvalidateStateV(cid:63155)(state){
consterrors=[];
if(!Array.isArray(state.sessions))errors.push("sessions must be array");
if(!Array.isArray(state.sights))errors.push("sights must be array");
if(!Array.isArray(state.gear))errors.push("gear must be array");
for(constsofstate.sessions??[]){
if(!s.id)errors.push("session missing id");
if(!Array.isArray(s.ends))errors.push(`session ${s.id} missing ends`);
}
return{ok:errors.length===0,errors};
}
fallback ⽅針
• migration 失敗時は legacy key を消さない
• app を read-only recovery mode で開く
• restore from backup と download raw snapshot を UI に出す
• telemetry を外送しない
• user が明⽰操作しない限り destructive write しない
import/export ⽅針
15

## Page 16

exportfunctionimportAnyBackup(json){
constraw=JSON.parse(json);
if(raw?.schemaVersion===2){
returnvalidateStateV(cid:63155)(raw).ok?raw:null;
}
returnmigrateUnknownLegacyToV(cid:63155)(raw);
}
exportfunctionexportBackup(state,format="v(cid:63155)"){
if(format==="legacy"){
returnJSON.stringify(downgradeToLegacyCompatibleShape(state),null,2);
}
returnJSON.stringify(state,null,2);
}
shell‧分析‧統計の段階統合
Phase (cid:63160)。 archery-master の Home / Analysis / Stats を(cid:63132)⼀気に(cid:63133) note に⼊れるのではなく、既存 note の
record/history/sight/gear を中⼼に、analysis/stats を追加タブまたは history 内サブビューとして段階
搭載する。 archery-master には analysis と stats の⼊⼝が既にあり、README でも RK(cid:63157)-(cid:63156)D 弾道、⾵補
正、判断⽀援、⽤具台帳、AI 採点等が前⾯に出ている。だが、公開 repo の完結性を下げる sibling project 依
存説明もあるため、まずは ⾃⼰完結する分析‧統計‧判断⽀援だけを統合する。 17
実装順序は以下。

1. history に統計カードを追加
2. analysis view を feature flag 付きで追加
3. 既存 session データから計算できる指標だけを接続
4. RK(cid:63157)/⾵補正は analysis/physics へ隔離
5. OCR / photo / pose は experimental に退避
   第三者資産の整理
   Phase (cid:63161)。 archery-master のトップレベルには pose_landmarker_lite.task が⾒えている。再配布条件‧
   取得元‧更新⽅法が README からは明確でないため、 THIRD_PARTY.md と NOTICE を先に整備する。
   Apache-(cid:63155).(cid:63153) は著作権表⽰‧LICENSE 表⽰‧変更明⽰‧NOTICE 扱いにルールがあり、Choose a License も
   NOTICE と変更表⽰の条件、明⽰的 patent grant を説明している。したがって、第三者資産を扱うなら
   NOTICE は省かない⽅がよい。 7
   THIRD_PARTY.md の表テンプレート

# Third-party notices

| Name                      | Source               | License                     | Redistributable | Used in           | Version / Hash | Notes |
| ------------------------- | -------------------- | --------------------------- | --------------- | ----------------- | -------------- | ----- |
| pose_landmarker_lite.task | [URL or vendor page] | [license]                   | yes/no          | experimental pose |
| analysis                  | [hash]               | verify redistribution terms |
| 16                        |

## Page 17

| tesseract.js | [source] | [license] | yes/no | OCR | [version] | load from CDN or vendor |
| icons.svg / png assets | [source] | [license] | yes/no | app shell | [version] |
attribution location |
NOTICE 最低雛形
Archery Note includes third-party software and assets.
See THIRD_PARTY.md for names, sources, licenses, and attribution details.
Additional notices required by upstream licenses will be listed here.
検証計画と受け⼊れ基準
⾃動テストと⼿動確認
GitHub Actions とローカル確認の両輪で回す。GitHub Pages custom workflow は build / upload / deploy
の分離、 pages: write と id-token: write 、 needs: build 、 environment: github-pages が重要であ
り、Service Worker は install / activate / waiting / controllerchange のライフサイクルを意識してテストす
べきです。 18
Release
種別 コマンド / ⼿順 Pass 条件
blocker
install npm ci lockfile から再現可能に install yes
app check npm run check:app 既存 app validation が通る yes
UI check npm run check:ui 既存 UI validation が通る yes
npm run
integration note + master 統合部が通る yes
check:integration
起動‧保存‧履歴‧⽤具の最短
smoke npm run test:smoke yes
導線が通る
lint npm run lint JS/CSS/MD lint クリア no
format npm run format:check format drift なし no
e(cid:63155)e npm run test:e2e 主要回帰なし recommended
manual storage 旧データを読み込む 件数‧主要項⽬が保持 yes
manual import/ 旧 JSON / 新 JSON 双⽅読
⽋損なく復元 yes
export 込
manual offline offline で reload アプリ shell が起動 yes
manual update waiting SW→更新 ボタン押下後に 1 回で反映 yes
manual a(cid:63154)(cid:63154)y (cid:63155)(cid:63153)(cid:63153)% zoom / keyboard 主要⼊⼒可能 yes
⼿動マトリクス
17

## Page 18

環境:

- iPhone Safari
- Android Chrome
- Desktop Chrome
- Desktop Edge
  確認:
- 初回起動
- 再起動
- 更新通知
- オフライン再読込
- 記録作成
- 着弾⼊⼒
- サイト調整保存
- ⽤具選択
- 履歴閲覧
- CSV export
- JSON backup/restore
- 旧バックアップ import
- 200% zoom
- keyboard-only navigation
  受け⼊れ基準
  以下を全部満たしたら完了。
  • archery-note が唯⼀の提出対象 repo になっている
  • 旧ブランド⽂字列が public UI / README / manifest / title から消えている
  • LICENSE が追加されている
  • README.md が public OSS 向けに再設計されている
  • CONTRIBUTING.md / SECURITY.md / CODE_OF_CONDUCT.md がある
  • issue template と PR template がある
  • THIRD_PARTY.md と NOTICE がある
  • custom ci.yml と deploy-pages.yml がある
  • package.json に check:all / check:integration / test:smoke / lint / format:check がある
  • viewport から maximum-scale=1 と user-scalable=no が除去されている
  • toast/update banner に live region と button semantics が付いている
  • Service Worker が manifest 駆動化され、waiting update を UI で反映できる
  • existing archery-note data を migration 付きで読める
  • migration 失敗時に rollback snapshot と recovery path がある
  • JSON import/export が旧新両⽅に対応している
  • offline reload が壊れていない
  • npm run check:all が通る
  • release ⽤ CHANGELOG と docs がある
  18

## Page 19

実⾏タイムライン
ArcheryNote統合の短期タイムライン
土台 inventoryと現状差分整理 LICENSE/README/healthfiles
brand統一
品質 CI/packagescripts
a11y/shell修正
PWA SWmanifest化 updatebanner/waitingSW
互換 sto i r m ag p e or i t n / v e e x n p t o o r r t y 回 と 帰 m 確 ig 認 ration
機能統合 analysis/stats統合 docs/release/finalpolish
06/27 06/28 06/29 06/30 07/01 07/02 07/03 07/04 07/05 07/06 07/07 07/08 07/09
追加ドキュメントとリリース雛形
追加する docs とサンプル内容
README は短く、 docs に詳細を逃がす。GitHub Docs も README はプロジェクト理解の⼊⼝、
CONTRIBUTING は PR/Issue 作成時の discoverability 向上に効くとしている。 19
docs/development.md

# Development

## Setup

````bash
npm install
npm run check:all
Local preview
powershell-NoProfile-ExecutionPolicyBypass-Fileserve.ps1
Validation
• npm run check:app
• npm run check:ui
• npm run check:integration
• npm run test:smoke
Rules
• storage を壊さない
• PWA update flow を壊さない
• UI 変更時はスクリーンショット添付
**`docs/data-model.md`**
```md
19

## Page 20

# Data model
## Legacy keys
- TODO: fill from current storage module
## Current schema
- schemaVersion: 2
- sessions[]
- sights[]
- gear[]
- analysisPrefs
## Migration policy
- read-time migration
- rollback snapshot
- no destructive delete on first successful migration
docs/pwa-update.md
# PWA update policy
-Service worker updates install in background
-New versions wait before activation
-Update banner appears when a waiting worker exists
-User action triggers `SKIP_WAITING`
-`controllerchange` reloads once
docs/codex/codex-for-oss.md
# Codex for OSS usage plan
Archery Note is an offline-first OSS PWA for archery practice records, sight adjustment,
equipment notes, and training history analysis.
## Maintenance tasks
-issue triage
-regression checks
-release notes
-docs updates
-accessibility improvements
-data migration review
RELEASE / CHANGELOG 雛形
Choose a License は Apache-(cid:63155).(cid:63153) が permissive で、著作権表⽰‧ライセンス表⽰‧変更明⽰‧特許許諾を含
むことを説明している。今回のように将来の分析ロジックや AI 補助を視野に⼊れるなら、
LICENSE + NOTICE + CHANGELOG の3点セットが相性がよい。 20
20

## Page 21

CHANGELOG.md
# Changelog
## v(cid:63154).(cid:63153).(cid:63153)-beta
### Added
-Apache-2.0 license
-CONTRIBUTING / SECURITY / CODE_OF_CONDUCT
-Issue and PR templates
-CI and GitHub Pages workflows
-schema migration with rollback snapshot
-manifest-driven PWA asset inventory
### Changed
-unified branding under Archery Note
-improved README for public OSS users
-improved update banner and service-worker lifecycle
-improved accessibility and zoom support
### Fixed
-reduced stale cache risk
-improved offline fallback behavior
-preserved legacy data loading path
GitHub Release 本⽂テンプレート
## Summary
This release prepares Archery Note as a public-maintained OSS PWA and integrates selected
strengths from archery-master.
## Highlights
-unified Archery Note branding
-new CI and Pages workflows
-safer service worker update flow
-storage migration with rollback
-improved accessibility
## Compatibility
-Existing archery-note local data is preserved through read-time migration.
-Legacy JSON backups remain importable.
## Known limitations
-OCR / pose / photo AI remain experimental and are not enabled by default.
21

## Page 22

最終報告テンプレート
最後に Codex へ出させる報告は、変更ファイル列挙だけでなく、何を archery-master から取り込んだか、
互換性リスクをどう抑えたか、残課題は何かを⾒える化する形にする。
# 作業報告
## Summary
-archery-note を提出対象として整理し、archery-master の強い部分を段階統合しました。
-既存データ互換性と PWA 更新導線を維持しつつ、CI‧ドキュメント‧a11y‧SW を改善しました。
## Assumptions used
-"archery-master in workspace" は public repo を参照元としました。
-実 storage key 名は現⾏ storage module から抽出して migration に反映しました。
## Changed files
-
## New files
-
## Integrated from archery-master
-CI / deploy workflow
-analysis / stats shell
-toast / update banner semantics
-manifest-driven asset cache ideas
-selective validation scripts
## Storage compatibility
-legacy key inventory:
-migration path:
-rollback snapshot key:
-import/export compatibility:
## Accessibility improvements
-removed zoom lock
-added status live region
-verified keyboard flow
-verified 200% zoom
## PWA / Service Worker improvements
-generated asset manifest
-waiting update banner
-`controllerchange` reload
-versioned caches
-old cache cleanup
## Validation
- [ ] npm ci
- [ ] npm run check:app
22

## Page 23

- [ ] npm run check:ui
- [ ] npm run check:integration
- [ ] npm run test:smoke
- [ ] npm run lint
- [ ] npm run format:check
- [ ] manual legacy data load
- [ ] manual backup restore
- [ ] manual offline reload
- [ ] manual update flow
- [ ] manual 200% zoom
## Remaining risks
-
-
## Recommended follow-up
-add Playwright E2E
-promote analysis stats from beta to default
-document third-party model provenance in more detail
この指図書の要点は、archery-note の公開⾯を守りながら、archery-master の CI‧検証‧shell‧SW 管理
を移植し、ストレージは adapter-first migration で保護することです。GitHub Docs の community
profile / contributor guidelines / security policy guidance、MDN と web.dev の viewport‧Service Worker
ライフサイクル、そして現⾏ 2 リポジトリの実ファイル差分から⾒て、この順序が最も事故が少なく、Codex
for OSS 向けの公開体裁にも直結します。 21
1 4 GitHub - eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-note: Archery score tracking & sight adjustment app · GitHub
https://github.com/eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-note
2 11 archery-note/manifest.json at main · eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-note · GitHub
https://github.com/eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-note/blob/main/manifest.json
3 5 9 13 archery-note/index.html at main · eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-note · GitHub
https://github.com/eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-note/blob/main/index.html
6 19 21 About community profiles for public repositories - GitHub Docs
https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-
public-repositories
7 GitHub - eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-master: Archery-master — practice notebook PWA (beta) · GitHub
https://github.com/eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-master
8 Setting guidelines for repository contributors - GitHub Docs
https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-
contributors
10 archery-note/package.json at main · eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-note · GitHub
https://github.com/eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-note/blob/main/package.json
12 archery-master/.github/workflows/deploy-pages.yml at main · eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-master · GitHub
https://github.com/eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-master/blob/main/.github/workflows/deploy-pages.yml
23

## Page 24

14 17 archery-master/index.html at main · eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-master · GitHub
https://github.com/eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-master/blob/main/index.html
15 archery-note/sw.js at main · eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-note · GitHub
https://github.com/eita(cid:63154)(cid:63154)(cid:63158)(cid:63154)(cid:63154)(cid:63158)/archery-note/blob/main/sw.js
16 サービスワーカーの使⽤ - Web API | MDN
https://developer.mozilla.org/ja/docs/Web/API/Service_Worker_API/Using_Service_Workers
18 Using custom workflows with GitHub Pages - GitHub Docs
https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
20 Apache License (cid:63155).(cid:63153) | Choose a License
https://choosealicense.com/licenses/apache-(cid:63155).(cid:63153)/
24
````
