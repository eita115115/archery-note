const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const cssPath = path.join(root, "style.css");
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";
const appScripts = [
  "scripts/00-compat.js",
  "scripts/10-storage-native.js",
  "scripts/20-scoring.js",
  "scripts/30-target-svg.js",
  "scripts/40-analysis-physics.js",
  "scripts/45-analysis-core.js",
  "scripts/46-form-core.js",
  "scripts/47-form-view.js",
  "scripts/50-record-view.js",
  "scripts/60-history-sight-view.js",
  "scripts/70-gear-settings.js",
  "scripts/90-init.js",
];
const appJs = appScripts.map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
const surface = `${html}\n${css}\n${appJs}`;
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const scripts = appJs;

function assert(ok, msg) {
  if (!ok) throw new Error(msg);
}
function section(start, end) {
  const a = scripts.indexOf(start);
  const b = scripts.indexOf(end);
  assert(a >= 0, `Missing start marker: ${start}`);
  assert(b > a, `Missing end marker: ${end}`);
  return scripts.slice(a, b);
}

new Function(scripts);

assert(appScripts.every(file => new RegExp(`<script\\b[^>]*\\bdefer\\b[^>]*\\bsrc=["']${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*><\\/script>`).test(html)) && inlineScripts.length === 0 && scripts.includes("const APP_VER="), "Deferred external app scripts missing");
assert(!fs.existsSync(path.join(root, "app.js")), "Legacy app.js should not remain after script split");
const appVer = /const APP_VER=(\d+)/.exec(scripts)?.[1];
const version = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).v;
const swVer = /archery-note-v(\d+)/.exec(fs.readFileSync(path.join(root, "sw.js"), "utf8"))?.[1];
assert(+appVer === version && +swVer === version, `Version mismatch app=${appVer} json=${version} sw=${swVer}`);
assert(html.includes('<link rel="stylesheet" href="style.min.css">') && css.includes(".startBand"), "Minified production stylesheet missing");
assert(html.includes('name="description"') && html.includes('property="og:description"'), "Share/SEO metadata missing");
assert(!/user-scalable\s*=\s*no/i.test(html), "Viewport must not disable user scaling");
assert(!/maximum-scale\s*=\s*1/i.test(html), "Viewport must not lock maximum scale to 1");
assert(/id="updBar" hidden[^>]*aria-live="polite"/.test(html), "Update banner should announce available updates politely");
assert(/id="toast" role="status" aria-live="polite" aria-atomic="true"/.test(html), "Toast should be exposed as a polite status live region");
assert(css.includes("touch-action:manipulation") && css.includes("--chrome-bg") && css.includes("min-height:48px"), "Native-feel touch/chrome styling missing");
assert(!surface.includes("@keyframes appRise") && !surface.includes("primaryPulse") && surface.includes("scorePop") && surface.includes("markPop") && surface.includes("impactFlash") && surface.includes("shotNew") && surface.includes("freshArrow") && surface.includes("prefers-reduced-motion") && html.includes("ic-record") && html.includes("ic-gear"), "Minimal recording feedback, tab icons, and reduced-motion guard missing");
// アイコンの刻印規律（v2 5節）: タブは 24px グリッドのインライン SVG＋butt cap、icon() セットも 24 グリッドで round cap 禁止
assert(html.includes('class="ic ic-record"') && html.includes('viewBox="0 0 24 24"') && html.includes('stroke-linecap="butt"') && !css.includes(".ic-record::before"), "Tab icons must be inline 24px-grid SVGs with butt caps (no CSS pseudo icons)");
assert(scripts.includes('class="icoInline" viewBox="0 0 24 24"') && !/class="icoInline"[^>]*stroke-linecap="round"/.test(scripts), "icon() set must use the 24px grid with butt caps");
// v5: 下端に付く平らな4タブ。選択中は上辺の線で示し、動く下線（--active-tab）は使わない。サイトは弓具の中の下線タブ
assert(/nav\.tabs button\.on,nav\.tabs button\[aria-current=page\]\{[^}]*border-top-color:var\(--accent\)/.test(css), "Flat tab bar selected state (top rule) missing");
assert(!scripts.includes('setProperty("--active-tab"') && !/<button data-v="sight"/.test(html) && html.includes('data-testid="gear-subtab-sight"') && !/<header\b/.test(html), "v5 skeleton (4 tabs, sight under gear, no header band) missing");
assert(!surface.includes("targetImpact") && !surface.includes("screenIn") && !surface.includes("triggerReleaseMotion") && !surface.includes("arrowFlight"), "Overdone transition/target animation should not return");
// v5 段 4: 記録タブの待機画面（帯）と記録の条件（全画面）
assert(surface.includes("この条件で記録を始める") && surface.includes("条件を変える") && surface.includes("記録の条件") && surface.includes("renderRecordConditions") && surface.includes("html.subscreen"), "record conditions screen missing");
assert(surface.includes("読み込みに時間がかかっています") && surface.includes("bootFallback") && surface.includes("bootFallbackDelay") && html.includes('id="updBar" hidden'), "startup/update fallback should be calm and initially hidden");
assert(surface.includes("前回と同じ条件") && surface.includes("記録の途中です") && surface.includes("最初の条件を選ぶ") && surface.includes("homeStartBandHtml") && surface.includes("quickStart") && surface.includes("quickStartMeta") && surface.includes("beginRecording") && !surface.includes("今の条件で開始") && surface.includes("recordSetupSnapshot") && !surface.includes("gearHeroHtml"), "record tab home (start band) missing");
assert(scripts.includes('class="recScreen') && !scripts.includes("compactHud") && !surface.includes("まず今日の記録を始める。詳しい材料") && !surface.includes("距離・的サイズはこの画面で変更できます") && !surface.includes("タップ＆ドラッグで確定"), "Record screen should stay compact and low-noise");
assert(surface.includes("levelFromScore") && surface.includes("function sessionSightFoldHtml") && !surface.includes("summarySightDialHtml") && !surface.includes("summaryDecisionHtml"), "record UI helpers missing");
assert(surface.includes("activeGuideHtml") && surface.includes("初回の操作ガイド") && surface.includes("activeGuideSeen"), "First-run active recording guide missing");
assert(surface.includes("SHOT_REASON_TAGS") && surface.includes("外れ理由") && surface.includes("矢番号") && surface.includes("arrowMetaSummaryHtml"), "Shot reason and arrow-number note UI missing");
assert(surface.includes("window.PointerEvent") && surface.includes("touchstart") && surface.includes("mousedown"), "Input fallback handlers missing");
assert(surface.includes("createSVGPoint()"), "SVG coordinate fallback missing");
assert(surface.includes("Array.prototype.flat") && surface.includes("Object.values") && surface.includes("Math.hypot"), "Compatibility polyfills missing");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
new Function(sw);
assert(sw.includes('e.request.mode === "navigate"') && sw.includes('caches.match("./index.html")') && sw.includes("./style.min.css") && appScripts.every(file => sw.includes(`./${file}`)), "Service worker navigation fallback missing");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const cap = JSON.parse(fs.readFileSync(path.join(root, "capacitor.config.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
assert(manifest.description && manifest.description.includes("サイト調整"), "Manifest description missing");
assert(pkg.version === `0.${version}.0` && packageLock.version === pkg.version && packageLock.packages[""].version === pkg.version, "Package version mismatch");
assert(pkg.scripts["build:native-web"] && pkg.scripts["native:sync"], "Native build scripts missing");
assert(pkg.scripts["version:bump"], "Version bump script missing");
assert(pkg.dependencies && pkg.dependencies["@capacitor/haptics"] && pkg.dependencies["@capacitor/share"] && pkg.dependencies["@capacitor/filesystem"], "Native haptics/share/filesystem plugins missing");
assert(cap.appId === "com.eita.archerynote" && cap.webDir === "dist/native", "Capacitor config mismatch");
assert(fs.existsSync(path.join(root, "tools", "build-native-web.js")) && fs.existsSync(path.join(root, "docs", "features", "native-transition.md")), "Native transition files missing");
assert(surface.includes("nativeReadinessHtml") && surface.includes("アプリ情報・保存状態") && surface.includes("RK4-3D JS core"), "Native readiness UI missing");
/* v5 段 8: 弓具（仕様表・変更の履歴）、サイト（目盛りの図・調整の目安）、設定（全画面・4つの組） */
assert(!surface.includes("pageHeroHtml") && !surface.includes("いつものセッティングを残す") && surface.includes("function gearSpecRows") && surface.includes("function gearHistoryEntries") && surface.includes("function recordingSetupId") && surface.includes("function sightScaleSvg") && surface.includes("function sightAdviceModel") && surface.includes('data-testid="settings-screen"') && ["display","record","data","app"].every(g => surface.includes(`data-testid="settings-group-${g}"`)), "v5 gear / sight / settings surfaces missing");
/* v5 段 6: ノート（履歴＋メモ）。冒頭の励ましの文・数値枠・目標のリングを置かず、メモだけのノートとゴミ箱の入口を持つ */
assert(!surface.includes("history-hero") && !surface.includes("historyHero") && !surface.includes("gamificationHeroHtml") && !surface.includes("gamGoalRingHtml"), "Notes tab must not bring back the history hero or the goal rings");
assert(surface.includes("function noteItems") && surface.includes("function openMemoDetail") && surface.includes("function openTrashSheet") && surface.includes("notes-goal-line") && surface.includes('data-testid="notes-trash"'), "Notes tab surfaces missing");
assert(surface.includes('trashItem(\n          "note"') || /trashItem\(\s*"note"/.test(surface), "Deleting a memo note must go through the trash");
assert(/else if\(item\.type==="note"\)/.test(surface), "restoreTrash must restore memo notes");
assert(surface.includes("nativePulse") && surface.includes("shareOrDownloadText") && surface.includes("capPlugin") && surface.includes("updateAppChrome") && surface.includes("freshReload"), "Native interaction layer missing");
assert(surface.includes("storageGetItem") && surface.includes("storageSetItem") && surface.includes("storageDriverProfile"), "Storage adapter missing");
assert(surface.includes("scheduleSafetySnapshot") && surface.includes("flushSafetySnapshot") && surface.includes("requestIdleCallback"), "Deferred snapshot saving missing");
assert(surface.includes("自動バックアップ") && surface.includes("いま控えを残す") && surface.includes("控えの内容に戻しました") && !surface.includes("\u81ea\u52d5\u9000\u907f") && !surface.includes("\u9000\u907f\u30c7\u30fc\u30bf"), "Backup settings copy should be user-facing");
assert(surface.includes("ArcheryPhysicsCore") && surface.includes("window.ArcheryPhysicsCore"), "Physics core interface missing");

const storageApi = new Function(section("const KEY=", "function uid") + "\nreturn {normalizeDb,blankDb,dataCounts,hashText,snapshotLabel,storageGetItem,storageSetItem,storageDriverProfile};")();
const normalized = storageApi.normalizeDb({sessions:[{id:"s"}], settings:{eyeSight:900}});
assert(normalized.schema >= 3 && normalized.sessions.length === 1 && normalized.settings.eyeSight === 900 && Array.isArray(normalized.trash), "Storage normalization failed");
assert(storageApi.dataCounts({sessions:[1,2],setups:[1],sightMarks:[1,2,3]}).marks === 3, "Data counts failed");
assert(storageApi.hashText("abc") === storageApi.hashText("abc"), "Hash stability failed");
assert(storageApi.snapshotLabel({ts:Date.now(),counts:{sessions:2,setups:1,marks:3}}).includes("練習2"), "Snapshot label failed");
assert(storageApi.storageGetItem("__missing__") == null && storageApi.storageSetItem("__test__", "1") === false && storageApi.storageDriverProfile().id === "localStorage", "Storage adapter fallback failed");
assert(surface.includes("TRASH_LIMIT") && surface.includes("restoreTrash") && surface.includes("function openTrashSheet") && !surface.includes("trashSettingsHtml"), "Trash/restore support missing");
assert(surface.includes("openSetupWizard") && surface.includes("openCalibrationWizard"), "Wizard/calibration flows missing");
assert(surface.includes("sessionsCsv") && surface.includes("scorecardSvg"), "Export flows missing");
assert(surface.includes("judgementFor") && !surface.includes("conditionInsights"), "Analysis judgement flows missing");
assert(surface.includes("histFilter") && surface.includes("histSetup"), "History filters missing");
assert(surface.includes("ROUND_TYPES") && surface.includes("roundProgressHtml"), "Round scoring support missing");
assert(surface.includes("FIELD_FACE_SIZES") && surface.includes("cm フィールド") && surface.includes("フィールド 24標的/72射"), "Field target setup UI missing");
assert(!surface.includes("校正用") && !surface.includes("状態確認"), "Record mode labels should be user-facing");
assert(surface.includes("personalModel") && surface.includes("sessionQuality") && !surface.includes("nextActionPlan") && !surface.includes("次のアクション"), "Personal decision model missing");
assert(surface.includes("SESSION_METRIC_CACHE") && surface.includes("sessionMetricSignature"), "Session metric cache missing");
assert(surface.includes("decision_quality") && surface.includes("personal_model"), "CSV decision columns missing");
assert(surface.includes("robustWeightedLine") && !surface.includes("modelReadinessProfile") && !surface.includes("個人データ準備度"), "v19 weighted regression missing or old readiness panel left");
assert(surface.includes("spineGuidance") && surface.includes("スパインの初期候補") && surface.includes("stabilizer"), "v20 gear guidance missing");
assert(surface.includes("RK4-3D") && surface.includes("windModel") && surface.includes("横流れ推定"), "v21 physics engine missing");
assert(surface.includes("personalPhysicsCalibration") && !surface.includes("物理校正:") && surface.includes("履歴推定"), "v22 personal physics calibration missing");
assert(fs.existsSync(path.join(root, "tools", "extract-catalog.py")), "Catalog extraction tool missing");
const trashDb = {sessions:[],setups:[],sightMarks:[],trash:[]};
let trashSaved = 0;
const trashApi = new Function("db","save","uid","today","TRASH_LIMIT", section("function cloneData", "/* ============ scoring") + "\nreturn {trashItem,restoreTrash,roundLabel};")(
  trashDb,
  () => { trashSaved++; },
  () => `id${trashSaved + trashDb.trash.length + 1}`,
  () => "2026-06-14",
  50
);
const deletedSession = {id:"sess1",date:"2026-06-14",dist:70,ends:[[]]};
const trashEntry = trashApi.trashItem("session","test session",deletedSession);
assert(trashDb.trash.length === 1 && trashEntry.label === "test session", "Trash insert failed");
assert(trashApi.restoreTrash(trashEntry.id) && trashDb.sessions[0].id === "sess1" && trashDb.trash.length === 0, "Trash restore failed");
assert(trashApi.roundLabel("70m72") === "70m 72射", "Round label failed");

/* IMP-09 多距離ラウンド定義ヘルパー: roundLabel の未知IDフォールバック / findRoundDef / sessionStageDef */
const roundDb = {customRounds:[{id:"cr-custom",label:"カスタム60/30",stages:[
  {dist:60,faceD:122,faceType:"single",arrows:36,perEnd:6},
  {dist:30,faceD:80,faceType:"single",arrows:36,perEnd:3}
]}]};
const roundApi = new Function("db", section("const ROUND_TYPES=", "/* Archery Note: scoring") + "\nreturn {ROUND_TYPES,MULTI_ROUND_PRESETS,multiRoundDefs,findRoundDef,roundLabel,sessionStageDef};")(roundDb);
assert(roundApi.roundLabel("wa1440_men") === "WA1440 男子", "Multi-round preset label failed");
assert(roundApi.roundLabel("cr-custom") === "カスタム60/30", "Custom round label failed");
assert(roundApi.roundLabel("__unknown__") === "自由練習", "Unknown round id must fall back to free label");
assert(roundApi.roundLabel() === "自由練習", "Empty round id must fall back to free label");
const waWomen = roundApi.findRoundDef("wa1440_women");
assert(waWomen && waWomen.stages.length === 4 && waWomen.stages[0].dist === 70 && waWomen.stages[3].dist === 30, "Preset findRoundDef failed");
assert(roundApi.findRoundDef("cr-custom").stages[1].dist === 30 && roundApi.findRoundDef("__unknown__") === null, "Custom/unknown findRoundDef failed");
const presetStage = roundApi.sessionStageDef({roundGroup:{gid:"g1",roundId:"wa1440_men",stage:1,stageCount:4}});
assert(presetStage && presetStage.dist === 70 && presetStage.faceD === 122 && presetStage.arrows === 36 && presetStage.perEnd === 6, "sessionStageDef preset stage failed");
const customStage = roundApi.sessionStageDef({roundGroup:{gid:"g2",roundId:"cr-custom",stage:1,stageCount:2}});
assert(customStage && customStage.dist === 30 && customStage.faceD === 80 && customStage.perEnd === 3, "sessionStageDef custom stage failed");
assert(roundApi.sessionStageDef({round:"free"}) === null, "sessionStageDef without roundGroup must be null");
assert(roundApi.sessionStageDef(null) === null, "sessionStageDef null session must be null");
assert(roundApi.sessionStageDef({roundGroup:{gid:"g3",roundId:"wa1440_men",stage:9,stageCount:4}}) === null, "sessionStageDef out-of-range stage must be null");
assert(roundApi.sessionStageDef({roundGroup:{gid:"g4",roundId:"__unknown__",stage:0,stageCount:1}}) === null, "sessionStageDef unknown round must be null");

const faceApi = new Function(section("function uid", "function cloneData") + "\nreturn {FIELD_FACE_SIZES,parseFaceChoice,faceLabel,perfectScoreValue,perfectScoreLabel,perfectScoreCount,secondaryScoreLabel,secondaryScoreCount};")();
const f40 = faceApi.parseFaceChoice("F40");
assert(f40.faceD === 40 && f40.faceType === "field" && faceApi.faceLabel(f40) === "40cmフィールド", "Field face parsing failed");
assert(faceApi.FIELD_FACE_SIZES.join(",") === "80,60,40,20", "Field face sizes changed unexpectedly");
const fieldHits = [{s:6},{s:5},{s:4},{s:6}];
assert(faceApi.perfectScoreLabel(f40) === "6点" && faceApi.perfectScoreCount(fieldHits,f40) === 2, "Field perfect score helpers failed");
assert(faceApi.secondaryScoreLabel(f40) === "5点以上" && faceApi.secondaryScoreCount(fieldHits,f40) === 3, "Field secondary score helpers failed");

const scoreApi = new Function(section("function isFieldFace", "function momentStats") + "\nreturn {isFieldFace,ringW,arrowMarkRadius,arrowLocatorRadius,arrowRadiusFromDiaMm,sessionArrowR,sessionScoringRadius,sessionRescore,arrowHasPos,sessionHasPos,DEFAULT_ARROW_R,targetLineHalfWidth,lineCutRadius,scoreAt,isLineCutting,isLineCuttingFromGlobal,hitFromGlobal,zoneStyle,SPOT_Y};")();
const fieldD = 80;
const fw = scoreApi.ringW(fieldD, "field");
const fieldTouch = scoreApi.lineCutRadius(fieldD, "field");
assert(scoreApi.isFieldFace("field") && fw === fieldD / 12, "Field ring width failed");
assert(scoreApi.scoreAt(0,0,fieldD,"field",0).s === 6, "Field center score failed");
assert(scoreApi.scoreAt(fw*1.5,0,fieldD,"field",0).s === 5, "Field 5-ring score failed");
assert(scoreApi.scoreAt(fw*3.5,0,fieldD,"field",0).s === 3, "Field black-ring score failed");
assert(scoreApi.scoreAt(fw*5.5,0,fieldD,"field",0).s === 1, "Field outer-ring score failed");
assert(scoreApi.scoreAt(fw*6.05,0,fieldD,"field",0).s === 0, "Field miss score failed");
assert(scoreApi.scoreAt(fw+fieldTouch*.8,0,fieldD,"field",fieldTouch).s === 6, "Field line-cutter inner score failed");
assert(scoreApi.scoreAt(fw+fieldTouch*1.2,0,fieldD,"field",fieldTouch).s === 5, "Field line-cutter outer score failed");
assert(scoreApi.hitFromGlobal(fw*2.4,0,fieldD,"field",fieldTouch).s === 4, "Field global hit score failed");
/* 得点チップは帯色の変数（style.css の --z-*）。フィールド的は 6・5 が金、4〜1 が黒 */
assert(scoreApi.zoneStyle(5,false,"field").bg === "var(--z-gold)" && scoreApi.zoneStyle(4,false,"field").bg === "var(--z-black)" && scoreApi.zoneStyle(4,false,"field").fg === "var(--z-black-fg)", "Field score chip colors failed");
assert(scoreApi.zoneStyle(8,false,"single").bg === "var(--z-red)" && scoreApi.zoneStyle(0,false,"single").bg === "var(--z-miss)", "Target score chip colors failed");

/* Triple (vertical 3-spot) regression. Expected values derived from ring geometry, not from the implementation. */
const tripleD = 40; // 標準的な40cm三つ目的
const tw = scoreApi.ringW(tripleD, "triple"); // ringW = faceD/20 = 40/20 = 2cm
const tripleTouch = scoreApi.lineCutRadius(tripleD, "triple"); // 矢の実寸の半径（既定矢径5.7mm → 0.285cm）。境界線は高得点側なので線幅は足さない
assert(tw === tripleD / 20, "Triple ring width failed");
assert(Math.abs(tripleTouch - 0.285) < 1e-12, "Triple line-cut radius failed");
/* 通常採点（touch=0 の純幾何）: Xリングは r<=w/2=1cm、n点リング境界は r=(11-n)*2cm */
const tripleCenter = scoreApi.scoreAt(0,0,tripleD,"triple",0); // r=0 <= 1cm → X(10)
assert(tripleCenter.s === 10 && tripleCenter.X === true, "Triple center X failed");
const triple10 = scoreApi.scoreAt(tw*0.75,0,tripleD,"triple",0); // r=1.5cm: Xリング外(>1)かつ10リング内(<=2) → 10(Xなし)
assert(triple10.s === 10 && triple10.X === false, "Triple 10-ring score failed");
assert(scoreApi.scoreAt(tw*1.5,0,tripleD,"triple",0).s === 9, "Triple 9-ring score failed"); // r=3cm: 2<r<=4 → 9
assert(scoreApi.scoreAt(tw*2.5,0,tripleD,"triple",0).s === 8, "Triple 8-ring score failed"); // r=5cm: 4<r<=6 → 8
assert(scoreApi.scoreAt(tw*3.5,0,tripleD,"triple",0).s === 7, "Triple 7-ring score failed"); // r=7cm: 6<r<=8 → 7
assert(scoreApi.scoreAt(tw*4.5,0,tripleD,"triple",0).s === 6, "Triple 6-ring score failed"); // r=9cm: 8<r<=10 → 6
/* 「6未満はM」境界: 6リング外縁は r=10cm。single なら5点になる位置が triple では 0(M) */
assert(scoreApi.scoreAt(tw*5,0,tripleD,"triple",0).s === 6, "Triple 6-ring edge score failed"); // r=10cm ちょうど → 6
assert(scoreApi.scoreAt(tw*5.05,0,tripleD,"triple",0).s === 0, "Triple just-outside-6 must be M"); // r=10.1cm → s=5 → M
assert(scoreApi.scoreAt(tw*5.5,0,tripleD,"single",0).s === 5, "Single 5-ring sanity failed"); // r=11cm は single だと5点
assert(scoreApi.scoreAt(tw*5.5,0,tripleD,"triple",0).s === 0, "Triple 5-ring position must be M"); // 同じ r=11cm が triple では M
/* ラインカッター境界: 実寸の矢(半径0.285cm)が6リング外縁に触れる条件は 中心距離 <= 10cm + tripleTouch */
assert(scoreApi.scoreAt(tw*5+tripleTouch*.8,0,tripleD,"triple",tripleTouch).s === 6, "Triple line-cutter inner score failed"); // 10+0.8*touch: 円が6リングに接触 → 6
assert(scoreApi.scoreAt(tw*5+tripleTouch*1.2,0,tripleD,"triple",tripleTouch).s === 0, "Triple line-cutter outer must be M"); // 10+1.2*touch: 届かない → M
/* hitFromGlobal のスポット割当: SPOT_Y=[22,0,-22]（上・中・下, cm, y上向き）。局所座標 = (gx, gy-SPOT_Y[spot]) */
assert(scoreApi.SPOT_Y.join(",") === "22,0,-22", "Triple spot geometry changed unexpectedly");
const topHit = scoreApi.hitFromGlobal(0,22,tripleD,"triple",tripleTouch); // gy=22 は上スポット中心 → spot=0, 局所(0,0) → X
assert(topHit.spot === 0 && topHit.x === 0 && topHit.y === 0 && topHit.s === 10 && topHit.X === true, "Triple top spot assignment failed");
const bottomHit = scoreApi.hitFromGlobal(3,-21,tripleD,"triple",tripleTouch); // 下スポット(-22)まで√(9+1)≈3.16cm、中(0)まで21.2cm → spot=2, 局所(3,1), r=3.1623-0.285=2.877cm → 9
assert(bottomHit.spot === 2 && bottomHit.x === 3 && bottomHit.y === 1 && bottomHit.s === 9, "Triple bottom spot local coords failed");
const upperHit = scoreApi.hitFromGlobal(0,13,tripleD,"triple",tripleTouch); // 上(22)まで9cm < 中(0)まで13cm → spot=0, 局所y=-9, r=9-0.285=8.715cm → 6
assert(upperHit.spot === 0 && upperHit.y === -9 && upperHit.s === 6, "Triple upper-half spot assignment failed");
const midHit = scoreApi.hitFromGlobal(0,11,tripleD,"triple",tripleTouch); // gy=11 は上下等距離(11cm)。現実装は先着(小さい index=上)を採用 → spot=0, 局所y=-11 → M
// タイブレークの固定は WA 規則由来ではなく、保存データ(spot/局所座標)の無断変化を検知するための回帰固定。意図的に仕様を変える場合はこのテストを更新すること。
assert(midHit.spot === 0 && midHit.y === -11 && midHit.s === 0, "Triple midpoint tie should pick top spot");
const nearMidHit = scoreApi.hitFromGlobal(0,10.9,tripleD,"triple",tripleTouch); // 中(0)まで10.9cm < 上(22)まで11.1cm → spot=1, 局所y=10.9 → M
assert(nearMidHit.spot === 1 && nearMidHit.y === 10.9 && nearMidHit.s === 0, "Triple below-midpoint should pick middle spot");
/* isLineCuttingFromGlobal: ドラッグ中のカッター表示が使う経路。スポット選択+局所化の後に isLineCutting と同じ判定になること */
assert(scoreApi.isLineCuttingFromGlobal(0, 22 + tw*5 + tripleTouch*.8, tripleD, "triple") === true, "Triple global line-cutter true case failed"); // 上スポット局所r=10+0.8*touch: 素の採点はM、カッター込みで6 → true
assert(scoreApi.isLineCuttingFromGlobal(0, 33, tripleD, "triple") === false, "Triple global line-cutter false case failed"); // 上スポット局所r=11cm: カッター込みでも r-touch>10 で M のまま → false
/* 実寸判定（WA: 矢のシャフトが線に触れれば高得点。矢の太さは的の大きさと無関係）
   旧実装は矢円半径を faceD/85 としていたため 122cm 的では 1.44cm の太さで線かみを判定していた */
assert(scoreApi.lineCutRadius(122, "single") === scoreApi.lineCutRadius(40, "single"), "Arrow radius must not scale with face size");
assert(Math.abs(scoreApi.arrowRadiusFromDiaMm(5.7) - 0.285) < 1e-12 && Math.abs(scoreApi.arrowRadiusFromDiaMm("9.3") - 0.465) < 1e-12, "Arrow diameter mm→radius cm failed");
assert(scoreApi.arrowRadiusFromDiaMm("") === scoreApi.DEFAULT_ARROW_R && scoreApi.arrowRadiusFromDiaMm(55) === scoreApi.DEFAULT_ARROW_R, "Invalid arrow diameter must fall back to default");
assert(scoreApi.sessionArrowR({arrowR:0.4},{arrowDia:"5"}) === 0.4, "Stored session arrow radius must win");
/* 旧判定の記録は、記録・編集・着弾図とも旧半径のまま（保存された点数と矢円を一致させる） */
assert(scoreApi.sessionScoringRadius({ends:[], arrowR:0.3}, null) === 0.3, "New sessions score with the stored real radius");
assert(scoreApi.sessionScoringRadius({ends:[], faceD:122, shaft:1.537}, {arrowDia:"5"}) === 1.537, "Legacy sessions keep their stored radius");
assert(Math.abs(scoreApi.sessionScoringRadius({ends:[], faceD:122, faceType:"single"}, null) - (122/85 + 122/1200)) < 1e-12, "Legacy sessions without shaft use the old formula");
assert(scoreApi.arrowMarkRadius(122, 1.537) === 1.537, "Legacy circles are drawn at the legacy radius");
assert(scoreApi.sessionScoringRadius({ends:[], faceD:122, shaft:1.537, arrowR:"0.285"}, null) === 0.285, "A numeric-string arrowR (import) is a stored real radius, not legacy");
assert(Math.abs(scoreApi.sessionArrowR({},{arrowDia:"5.0"}) - 0.25) < 1e-12, "Setup arrow diameter must be used for legacy sessions");
assert(scoreApi.scoreAt(6.1+0.28,0,122,"single").s === 10 && scoreApi.scoreAt(6.1+0.29,0,122,"single").s === 9, "122cm 10-ring line-cut boundary must use the real arrow radius");
assert(scoreApi.scoreAt(7.6,0,122,"single").s === 9, "Arrow 1.5cm outside the 10 ring must not be promoted");
assert(scoreApi.scoreAt(2+0.465,0,40,"single",0.465).s === 10 && scoreApi.scoreAt(2+0.47,0,40,"single",0.465).s === 9, "Fat indoor arrow (9.3mm) line-cut boundary failed");
assert(scoreApi.scoreAt(18.3,0,122,"single",0).s === 8, "Exact ring boundary must stay in the higher zone despite float error");
assert(scoreApi.arrowMarkRadius(122) === scoreApi.lineCutRadius(122,"single"), "Displayed arrow circle must equal the scoring radius");
assert(scoreApi.arrowLocatorRadius(122) > scoreApi.arrowMarkRadius(122), "Locator halo is larger than the real arrow on big faces");
{
  const legacy = {faceD:122, faceType:"single", ends:[[{x:7.6,y:0,s:10,X:false},{x:0,y:0,s:10,X:true},{s:7}]]};
  const before = JSON.stringify(legacy);
  const r = scoreApi.sessionRescore(legacy, 0.285);
  assert(r.stored === 27 && r.total === 26 && r.changed === 1 && r.skipped === 1 && r.scored === 2, "Legacy rescore totals failed");
  assert(JSON.stringify(legacy) === before, "Legacy rescore must not mutate stored scores");
}

const targetApi = new Function(
  "ringW","isFieldFace","targetLineHalfWidth","SPOT_Y",
  section("function targetMarkup", "function markCircle") + "\nreturn {targetMarkup};"
)(
  scoreApi.ringW,
  scoreApi.isFieldFace,
  scoreApi.targetLineHalfWidth,
  scoreApi.SPOT_Y
);
const fieldSvg = targetApi.targetMarkup(80, "tf", "field");
assert(fieldSvg.includes('class="main field"') && fieldSvg.includes("#ffe14d") && fieldSvg.includes("#1c1e1c"), "Field target SVG failed");

/* v5 段 2: 記録中は没入画面（タブと画面名の行を隠す）。ズームは1ボタン、終了はメニュー、記録のトーストなし */
assert(css.includes("html.recording #viewTop") && scripts.includes('classList.toggle("recording", recordingShown)') && scripts.includes("if (!recordingShown) teardownTargetInput();") && scripts.includes("recordPaused()") && scripts.includes('data-testid="record-resume"'), "Immersive recording screen (html.recording / pause and resume) missing");
assert(scripts.includes('data-testid="active-menu"') && scripts.includes('data-testid="active-finish"') && scripts.includes("pick(\"#mSettings\", openSettings)") && scripts.includes("openSessionMetaSheet"), "Recording menu (finish / settings / weather and note) missing");
assert(scripts.includes("中心を拡大") && scripts.includes("全体に戻す") && !scripts.includes("zoomChips") && !scripts.includes('data-z="'), "Target zoom must be the single centre-zoom button");
assert(!/toast\(`エンド\$\{[^`]*確定/.test(scripts) && scripts.includes('id="arrowAnnounce" aria-live="polite"') && scripts.includes('id="recMsg" aria-live="polite"'), "Recording feedback must use the status row and aria-live, not toasts");
assert(scripts.includes('id="curChips" data-testid="active-arrow-chips"') && scripts.includes('data-i="${i}"') && scripts.includes("NUDGE_STEP_CM = 0.1") && scripts.includes("選択中の矢を${name}に微調整") && scripts.includes("選択中の矢を削除"), "Current-end slots and 1mm correction bar missing");
assert(scripts.includes("drag.out || outsideTarget(cp)") && scripts.includes("離すと記録しません"), "Releasing outside the target must cancel the arrow");
assert(scripts.includes("scoreAt(a.x, a.y, s.faceD, s.faceType, activeArrowR(s))") && scripts.includes("scoreAt(rec.x, rec.y, s.faceD, s.faceType, arrowR)"), "Corrections must re-score with the drawn arrow radius");

/* スコア表: 表示は高い点から（X → 10 → … → M）、保存は打った順のまま。計・累計・数える列・小計は保存された点数から数える */
{
  const cardApi = new Function(
    "scoreRank","isFieldFace","sessionStageDef","ROUND_TYPES","esc","scoreLabel","arrowHasPos",
    section("/* ============ スコア表", "/* ============ 記録中（没入画面）") +
      "\nreturn {scoreSortedArrows,scoreZoneClass,isIndoorShortFace,scorecardCountCols,scorecardPlan,scorecardHtml,curRowHtml,sessionInputMode,scoreKeyDefs,applyScoreKey,clearManualScore};"
  )(
    (hit) => hit.s * 2 + (hit.X ? 1 : 0),
    scoreApi.isFieldFace,
    roundApi.sessionStageDef,
    roundApi.ROUND_TYPES,
    (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]),
    (a) => (a.s === 0 ? "M" : a.X ? "X" : String(a.s)),
    scoreApi.arrowHasPos
  );
  const A = (s, X) => ({ x: 0, y: 0, s, X: !!X });
  const shot = [A(0), A(10), A(7), A(10, true), A(9), A(10)];
  const before = JSON.stringify(shot);
  const order = cardApi.scoreSortedArrows(shot).map((a) => (a.s === 0 ? "M" : a.X ? "X" : String(a.s))).join(" ");
  assert(order === "X 10 10 9 7 M" && JSON.stringify(shot) === before, `Scorecard display order failed: ${order}`);
  assert(cardApi.scoreSortedArrows(shot)[1] === shot[1] && cardApi.scoreSortedArrows(shot)[2] === shot[5], "Scorecard sort must be stable for equal scores");
  const plan = (o) => cardApi.scorecardPlan(Object.assign({ ends: [] }, o));
  assert(plan({ round: "70m72", perEnd: 6 }).blockEnds === 6 && plan({ round: "70m72", perEnd: 6 }).planEnds === 12, "72-arrow round must subtotal every 36 arrows");
  assert(plan({ round: "18m60", perEnd: 3 }).blockEnds === 10 && plan({ round: "18m60", perEnd: 3 }).planEnds === 20, "60-arrow round must subtotal every 30 arrows");
  assert(plan({ round: "30m36", perEnd: 6 }).blockEnds === null && plan({ round: "30m36", perEnd: 6 }).planEnds === 6, "36-arrow round has a total only");
  assert(plan({ round: "free", perEnd: 6 }).blockEnds === 6 && plan({ round: "free", perEnd: 3 }).blockEnds === 10 && plan({ round: "free", perEnd: 6 }).quota === null, "Free practice subtotals every 36 (6-arrow ends) / 30 (3-arrow ends) arrows");
  assert(cardApi.isIndoorShortFace({ dist: 18, faceD: 40, faceType: "single" }) && cardApi.isIndoorShortFace({ dist: 25, faceD: 60, faceType: "single" }) && cardApi.isIndoorShortFace({ dist: 18, faceD: 40, faceType: "triple" }) && !cardApi.isIndoorShortFace({ dist: 30, faceD: 80, faceType: "single" }) && !cardApi.isIndoorShortFace({ dist: 70, faceD: 122, faceType: "single" }) && !cardApi.isIndoorShortFace({ dist: 18, faceD: 40, faceType: "field" }), "Indoor short-distance face detection failed");
  const heads = (o) => cardApi.scorecardCountCols(o).map((c) => c.head).join("/");
  assert(heads({ dist: 70, faceD: 122, faceType: "single" }) === "10/X" && heads({ dist: 18, faceD: 40, faceType: "single" }) === "10/9" && heads({ dist: 30, faceD: 40, faceType: "field" }) === "6/5", "Scorecard count columns failed");
  const outdoor = cardApi.scorecardCountCols({ dist: 70, faceD: 122, faceType: "single" });
  assert(outdoor[0].count(shot) === 3 && outdoor[1].count(shot) === 1 && outdoor[0].name === "10点数（X含む）", "10 column must count X too");
  const end = (vals) => vals.map((v) => (v === "X" ? A(10, true) : A(v)));
  const sess = { dist: 70, faceD: 122, faceType: "single", round: "70m72", perEnd: 6, ends: Array.from({ length: 7 }, (_, i) => end([i === 0 ? 0 : 9, 10, "X", 9, 8, 7])) };
  const stored = JSON.stringify(sess);
  const card = cardApi.scorecardHtml(sess, { rowButtons: true, editEnd: 2 });
  assert(JSON.stringify(sess) === stored, "Scorecard rendering must not change stored ends");
  assert((card.match(/class="scRow[ "]/g) || []).length === 8 && (card.match(/data-sub="block"/g) || []).length === 1 && !card.includes('data-sub="total"'), "Scorecard rows / half subtotal failed");
  assert(card.indexOf('data-sub="block"') > card.indexOf('data-end="5"') && card.indexOf('data-sub="block"') < card.indexOf('data-end="6"'), "Half subtotal must follow the 6th end");
  assert(card.includes('前半 36射</span><span role="cell">10+X<b>12</b></span><span role="cell">X<b>6</b></span><span class="tot" role="cell">309</span>'), "Half subtotal values failed");
  assert(/data-end="0">.*?>X<\/div>.*?>10<\/div>.*?>9<\/div>.*?>8<\/div>.*?>7<\/div>.*?>M<\/div>.*?class="endTot" role="cell">44<\/div><div class="runTot" role="cell">44<\/div><div class="cnt" role="cell">2<\/div><div class="cnt" role="cell">1<\/div>/.test(card), "Scorecard first row (sorted, M last, totals) failed");
  assert(card.includes('<div class="scRow is-edit" role="row" data-end="2">') && card.includes('data-erow="2" aria-pressed="true" aria-label="第3エンドを直す（計53点）"') && card.includes('aria-label="10点数（X含む）"') && card.includes("p6") && card.includes('class="gapCol"'), "Scorecard row buttons / headers failed");
  const full = Object.assign({}, sess, { ends: Array.from({ length: 12 }, () => end([10, 10, 9, 9, 8, 8])) });
  const fullCard = cardApi.scorecardHtml(full);
  assert((fullCard.match(/data-sub="block"/g) || []).length === 2 && fullCard.includes("後半 36射") && fullCard.includes('合計 72射</span><span role="cell">10+X<b>24</b></span><span role="cell">X<b>0</b></span><span class="tot" role="cell">648</span>') && !fullCard.includes("scRowBtn"), "Completed round subtotal / total rows failed");
  const indoor = cardApi.scorecardHtml({ dist: 18, faceD: 40, faceType: "single", round: "18m60", perEnd: 3, ends: Array.from({ length: 10 }, () => end(["X", 9, 10])) });
  assert(indoor.includes("p3") && indoor.includes('aria-label="9点数"') && indoor.includes('前半 30射</span><span role="cell">10点<b>20</b></span><span role="cell">9点<b>10</b></span><span class="tot" role="cell">290</span>') && !indoor.includes("X数"), "Indoor scorecard must count 10s and 9s");
  const free = cardApi.scorecardHtml({ dist: 70, faceD: 122, faceType: "single", round: "free", perEnd: 6, ends: Array.from({ length: 6 }, () => end([9, 9, 9, 9, 9, 9])) }, { final: true });
  assert(free.includes("小計 1〜36射") && free.includes("合計 36射"), "Free-practice subtotal / final total failed");
  const row = cardApi.curRowHtml(shot.slice(0, 4), 6, 3, 1, { faceType: "single" });
  assert((row.match(/data-i="/g) || []).length === 4 && /data-i="0"[^>]*aria-label="1射目 M"/.test(row) && /data-i="1" aria-pressed="true"/.test(row) && row.includes("is-next") && />27<\/div><\/div>$/.test(row), "Current-end slot row (shot order) failed");
  assert(!/公式|公認/.test(card + fullCard + indoor + free), "Scorecard must not call itself official");
  /* 段 3: 得点キーはその的で付く点だけ。点数だけ直すと manual / auto が付き、自動採点と同じ点を選ぶか動かすと外れる */
  const ids = (ft) => cardApi.scoreKeyDefs(ft).map((k) => k.id).join(" ");
  assert(ids("single") === "X 10 9 8 7 6 5 4 3 2 1 M" && ids("triple") === "X 10 9 8 7 6 M" && ids("field") === "6 5 4 3 2 1 M", "Score keys must match the face's score set");
  for (const ft of ["single", "triple", "field"]) {
    const reachable = new Set();
    for (let r = 0; r <= 70; r += 0.05) { const h = scoreApi.scoreAt(r, 0, ft === "single" ? 122 : ft === "triple" ? 40 : 80, ft, 0); reachable.add(h.s === 0 ? "M" : h.X ? "X" : String(h.s)); }
    assert([...reachable].sort().join(" ") === cardApi.scoreKeyDefs(ft).map((k) => k.id).sort().join(" "), `Score keys for ${ft} must equal the values scoreAt can return`);
  }
  assert(cardApi.sessionInputMode({ inputMode: "score" }) === "score" && cardApi.sessionInputMode({}) === "target" && cardApi.sessionInputMode({ inputMode: "x" }) === "target", "Input mode must default to target");
  const keyOf = (id) => cardApi.scoreKeyDefs("single").find((k) => k.id === id);
  const placed = { x: 3, y: 4, s: 9, X: false };
  cardApi.applyScoreKey(placed, keyOf("10"));
  assert(placed.s === 10 && placed.manual === true && placed.auto.s === 9 && placed.x === 3 && placed.y === 4, "Score override must keep the position and the automatic score");
  cardApi.applyScoreKey(placed, keyOf("X"));
  assert(placed.s === 10 && placed.X === true && placed.auto.s === 9 && placed.auto.X === false, "A second override must keep the first automatic score");
  assert(/class="man" role="img" aria-label="手で修正"/.test(cardApi.scorecardHtml({ dist: 70, faceD: 122, faceType: "single", round: "free", perEnd: 6, ends: [[placed]] })) && /aria-label="1射目 X 手で修正"/.test(cardApi.curRowHtml([placed], 6, 1, -1, { faceType: "single" })), "Manual override must be marked in the scorecard and the slot");
  cardApi.applyScoreKey(placed, keyOf("9"));
  assert(placed.s === 9 && !("manual" in placed) && !("auto" in placed), "Choosing the automatic score must clear the override");
  const keyArrow = { s: 0, X: false, src: "key" };
  cardApi.applyScoreKey(keyArrow, keyOf("X"));
  assert(keyArrow.s === 10 && keyArrow.X === true && !("x" in keyArrow) && !("manual" in keyArrow), "Key arrows are replaced without coordinates or a manual flag");
  const noposRow = cardApi.curRowHtml([{ s: 0, X: false, src: "key" }], 6, 1, -1, { faceType: "single" });
  assert(/aria-label="1射目 M 位置なし"/.test(noposRow) && noposRow.includes('class="nopos"') && !cardApi.curRowHtml([{ s: 0, X: false, src: "key" }], 6, 1, -1, { faceType: "single", scoreMode: true }).includes("nopos"), "Coordinate-less arrow slot label failed");
}

/* 矢番号の吹き出し: 画面上 13px の文字・直径 22px を保ち、重なった矢でも互いに離れ、表示範囲に収まる */
const labelApi = new Function(section("function layoutArrowLabels", "function arrowLabelSvg") + "\nreturn {layoutArrowLabels};")();
{
  const pxPerCm = 3; // 122cm 的を 375px 幅で全体表示したときの目安
  const box = { x: -72, y: -72, width: 144, height: 144 };
  const same = Array.from({ length: 6 }, () => ({ x: 0.2, y: -0.1 }));
  const lay = labelApi.layoutArrowLabels([...same, null], pxPerCm, box);
  assert(Math.abs(lay.r * pxPerCm - 11) < 1e-9 && Math.abs(lay.font * pxPerCm - 13) < 1e-9, "Arrow label must stay 22px / 13px on screen");
  assert(lay.labels[6] === null, "Arrow label skips arrows without coordinates");
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    const d = Math.hypot(lay.labels[i].x - lay.labels[j].x, lay.labels[i].y - lay.labels[j].y);
    assert(d >= 2 * lay.r * 0.99, `Arrow labels ${i + 1} and ${j + 1} overlap (${(d * pxPerCm).toFixed(1)}px)`);
  }
  for (let i = 0; i < 6; i++) {
    const d = Math.hypot(lay.labels[i].x - same[0].x, lay.labels[i].y - same[0].y);
    assert(d >= lay.r * 1.2, `Arrow label ${i + 1} covers an arrow (${(d * pxPerCm).toFixed(1)}px)`);
  }
  const edge = labelApi.layoutArrowLabels([{ x: 71, y: 71 }], pxPerCm, box).labels[0];
  assert(edge.x <= box.x + box.width - lay.r + 1e-9 && -edge.y >= box.y + lay.r - 1e-9, "Arrow label must stay inside the target view");
  const again = labelApi.layoutArrowLabels([...same], pxPerCm, box);
  assert(JSON.stringify(again.labels) === JSON.stringify(lay.labels.slice(0, 6)), "Arrow label layout must be deterministic");
}

const statsApi = new Function(section("function clamp", "/* ============ target SVG") + "\nreturn {robustStats,groupStats,centerOffsetTest,axisCorrection,probWithin,fmtChance,tCrit975,sightStats};")();
const arrows = [
  {x:1,y:1},{x:2,y:1.5},{x:0,y:.5},{x:1.2,y:1.7},{x:.8,y:.9},{x:1.5,y:1.1},
  {x:2.1,y:2.0},{x:1.7,y:1.6},{x:28,y:-20}
];
const st = statsApi.robustStats(arrows);
/* grouping-v3: 最上位は全射（A）。外れ値候補は excluded、サイト判断用の統計は excl（B）、ロバスト推定は robust（C） */
assert(st && st.excluded.length === 1 && st.excluded[0].x === 28 && st.n === arrows.length && st.excl.n === arrows.length - 1 && st.robust && st.version === "grouping-v3", "Robust grouping failed");
/* 新しい統計: 残りの矢の標本平均・不偏標準偏差・中心の標準誤差と95%区間（t分布） */
{
  const pts = [{x:-1,y:0},{x:1,y:0},{x:0,y:-1},{x:0,y:1},{x:0,y:0}];
  const s5 = statsApi.robustStats(pts);
  assert(s5.method === "mean" && s5.mx === 0 && s5.my === 0, "Plain mean failed");
  assert(Math.abs(s5.sx - Math.sqrt(0.5)) < 1e-12 && Math.abs(s5.seX - Math.sqrt(0.5 / 5)) < 1e-12, "Sample SD / SE failed");
  assert(Math.abs(s5.ciX - 2.776 * s5.seX) < 1e-12, "95% t interval failed");
  const one = statsApi.robustStats([{x:2,y:3}]);
  assert(one.n === 1 && one.mx === 2 && one.seX === Infinity && one.rr === 0, "Single arrow stats failed");
  /* 旧版は円周上に並ぶ6本で RMS 0.0cm を返す不具合があった */
  const ring = Array.from({length:6}, (_, j) => ({x:Math.cos(j/6*Math.PI*2)*3.9, y:Math.sin(j/6*Math.PI*2)*3.9}));
  assert(Math.abs(statsApi.robustStats(ring).rr - 3.9 * Math.sqrt(6/5)) < 1e-9, "Ring RMS must not collapse");
}
const lineApi = new Function(section("function clamp", "function regressionAdvice") + "\nreturn {robustWeightedLine};")();
const wr = lineApi.robustWeightedLine([[5,3,1],[6,1.5,1],[7,0.2,1],[8,-1.1,1],[9,-2.6,1],[12,20,0.05]]);
assert(wr && wr.kind === "weighted-robust" && wr.zero > 6.8 && wr.zero < 7.5 && wr.quality > .4, "Weighted robust sight regression failed");

const analysisDb = {sessions:[]};
const analysisApi = new Function(
  "db","robustStats","ringW","clamp","num","gearPrecisionProfile","pct","cmOffsetText","esc","groupStats","probWithin","fmtChance","tCrit975","sightStats","arrowHasPos",
  section("function windText", "function roundProgressHtml") + "\nreturn {sessionQuality,personalModel,judgementFor};"
)(
  analysisDb,
  statsApi.robustStats,
  f=>f/20,
  (v,a,b)=>Math.max(a,Math.min(b,v)),
  v=>{ const n=parseFloat(v); return Number.isFinite(n)?n:null; },
  () => ({score:.85,missing:[]}),
  v=>`${Math.round(v*100)}%`,
  (v,axis)=>`${axis}:${v.toFixed(1)}`,
  s=>String(s == null ? "" : s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])),
  statsApi.groupStats,
  statsApi.probWithin,
  statsApi.fmtChance,
  statsApi.tCrit975,
  statsApi.sightStats,
  scoreApi.arrowHasPos
);
const sessAt = (id,cx,cy) => ({id,date:`2026-06-${id}`,setupId:"main",dist:70,faceD:122,faceType:"single",wx:"晴れ",ends:[[
  {x:cx-0.5,y:cy,s:9},{x:cx+0.3,y:cy+0.2,s:9},{x:cx,y:cy-0.4,s:10},
  {x:cx+0.4,y:cy+0.4,s:9},{x:cx-0.2,y:cy-0.1,s:10},{x:cx+0.1,y:cy+0.3,s:9}
],[
  {x:cx-0.4,y:cy+0.1,s:9},{x:cx+0.2,y:cy-0.2,s:10},{x:cx+0.5,y:cy+0.1,s:9},
  {x:cx-0.1,y:cy+0.4,s:9},{x:cx+0.2,y:cy+0.2,s:10},{x:cx-0.3,y:cy-0.3,s:9}
]]});
analysisDb.sessions.push(sessAt("01",2,1), sessAt("02",2.4,1.2));
const current = sessAt("03",2.8,1.3);
const curSt = statsApi.robustStats(current.ends.flat());
const q = analysisApi.sessionQuality(current,{id:"main"});
/* 2本では標準誤差そのものが不確かなので判断信頼度は「高」にならない */
const q2 = analysisApi.sessionQuality({...current, id:"two", ends:[[{x:1,y:1,s:10},{x:1.1,y:1,s:10}]]},{id:"main"});
assert(q2.label !== "高", `Two arrows must not give high decision quality (${q2.score})`);
const q3 = analysisApi.sessionQuality({...current, id:"three", faceD:40, ends:[[{x:0.1,y:0,s:10},{x:0,y:0.1,s:10},{x:-0.1,y:0,s:10}]]},{id:"main"});
// ばらつきの下限（リング幅の1/4）と t 補正で、3本のまとまりを「ほぼ確実」とはしない（旧下限 w/10 では 0.998）
assert(q3.score < 0.85, `Three tight arrows must not look near-certain (${q3.score})`);
const pm = analysisApi.personalModel(current,{id:"main"},curSt);
assert(q.score > .45 && ["中","高"].includes(q.label), "Session quality failed");
assert(pm && pm.sample === 2 && pm.state === "過去と一致", "Personal model failed");
const judgement = analysisApi.judgementFor({st:curSt,confidence:.7,lines:[{axis:"h"}],personal:pm},current);
assert(judgement && judgement.label === "動かす", "Personal judgement failed");

/* 矢径の妥当範囲（20-scoring.js の定数）。物理の矢径チェックが採点と同じ範囲を使うため、物理を切り出す枠に足す */
const arrowDiaConsts = section("const DEFAULT_ARROW_DIA_MM", "const SCORE_EPS");
const normGearText = s => String(s || "").normalize("NFKC").toUpperCase().replace(/[・_/]+/g, " ").replace(/\s+/g, " ").trim();

/* サイト調整の判定（統計）: 中心のズレを Hotelling T² で検定し、量は縮小推定 m·(1−SE²/m²) */
{
  const decisionApi = new Function("normGearText","ringW", arrowDiaConsts + section("function clamp", "function adviceModel") + "\nreturn {sightDecision,robustStats};")(normGearText, scoreApi.ringW);
  const grid = (cx, cy) => [-1, 0, 1].flatMap(i => [-1, 0, 1].map(j => ({x:cx + i*2, y:cy + j*2})));
  const sess = {faceD:122, faceType:"single"};
  let d = decisionApi.sightDecision(sess, decisionApi.robustStats(grid(0.3, -0.2)), null, null);
  assert(!d.significant && !d.h.move && !d.v.move, "Centered group must not move the sight");
  d = decisionApi.sightDecision(sess, decisionApi.robustStats(grid(4, 0)), null, null);
  // 9本・σ=√3: SE=√(3/9)=0.577、縮小率 1−(1/3)/16=0.979 → 補正 3.92cm
  assert(d.significant && d.h.move && !d.v.move && Math.abs(d.h.adj - 4 * (1 - (1/3)/16)) < 1e-9, "Offset group must move horizontally with shrinkage");
  /* 横風: 風上へのねらい修正の有無が分からないので、推定横流れは差し引かずに左右の誤差として扱う */
  const windTraj = {wind:{speed:4, known:true, side:4, label:"左から"}, windDriftCm:4, windUncertaintyCm:0.5};
  d = decisionApi.sightDecision(Object.assign({windSpeed:"4"}, sess), decisionApi.robustStats(grid(4, 0)), windTraj, null);
  assert(d.windAccounted && !d.h.move, "Crosswind drift must count as left/right uncertainty");
  const bigWind = {wind:{speed:3, known:true, side:3, label:"左から"}, windDriftCm:24.6, windUncertaintyCm:4.8};
  d = decisionApi.sightDecision(Object.assign({windSpeed:"3"}, sess), decisionApi.robustStats(grid(0, 0)), bigWind, null);
  assert(!d.h.move && !d.v.move, "An archer who aimed off into the wind must not be told to move the sight upwind");
  /* 判定中の回を含む風係数は使わない（自分自身で校正すると左右の提案が消える） */
  const selfCal = {wind:{factor:0.2, sample:1, items:[{v:0.2, w:1, id:"cur", date:"2026-11-01"}]}};
  d = decisionApi.sightDecision(Object.assign({id:"cur", date:"2026-11-01", windSpeed:"3"}, sess), decisionApi.robustStats(grid(0, 0)), bigWind, selfCal);
  assert(d.windFactor === 1, "Wind factor must exclude the session being judged");
  /* 閉検定: 横だけずれた群れで、合っている上下は動かさない */
  d = decisionApi.sightDecision(sess, decisionApi.robustStats([...grid(6, 0.3), ...grid(6, -0.3)]), null, null);
  assert(d.h.move && !d.v.move, "Closed testing must keep a centred axis still");
  /* 中心が合っている6本の群れで「動かせ」と出る割合（旧版は約9割） */
  let seed = 4242;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const gauss = () => { let u = 0; while (!u) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); };
  let moved = 0;
  for (let t = 0; t < 2000; t++) {
    const st = decisionApi.robustStats(Array.from({length:6}, () => ({x:gauss()*4, y:gauss()*4})));
    const dd = decisionApi.sightDecision(sess, st, null, null);
    if (dd.h.move || dd.v.move) moved++;
  }
  assert(moved / 2000 < 0.08, `False sight-move rate too high: ${moved / 2000}`);
}
const physicsApi = new Function("normGearText", arrowDiaConsts + section("function clamp", "function adviceModel") + "\nreturn {physicsProfile,trajectoryModel,windModel,ArcheryPhysicsCore};")(normGearText);
const phys = physicsApi.physicsProfile({
  poundage:"38", drawLength:"28.5", shaftGpi:"6.8", arrowLength:"29", pointWeight:"110", arrowDia:"5.5",
  vane:"Spin Wing", vaneHeight:"2.0", temperature:"30", altitude:"500", humidity:"70",
  shaftSetWeightSpread:"4", shaftStraightness:"0.003", foc:"13"
});
assert(phys.speedFps > 150 && phys.speedFps < 260, "Physics speed out of range");
assert(phys.rho > .9 && phys.rho < 1.25, "Air density out of range");
/* 前面積基準の Cd: φ5.6mm・29inch で 2.6（Park 2011 の乱流・ポイント付き実測）を基準に 長さ/直径 に比例。
   5.5mm・29inch・Spin Wing(×1.05)・ベイン高2.0(×1.006) → 2.6×(5.6/5.5)×1.05×1.006 ≈ 2.80 */
assert(Math.abs(phys.cd - 2.6 * (5.6 / 5.5) * 1.05 * 1.006) < 1e-9, "Arrow Cd out of range");
{
  /* 細い矢ほど前面積基準の Cd は大きい（表面摩擦が支配的）。旧版は逆向きだった */
  assert(physicsApi.physicsProfile({arrowDia:"23"}).diaMm === 5.7 && physicsApi.physicsProfile({arrowDia:"0.2"}).diaMm === 5.7, "Physics must apply the same arrow-diameter range as scoring");
  const thin = physicsApi.physicsProfile({arrowDia:"4.6", arrowLength:"29"});
  const fat = physicsApi.physicsProfile({arrowDia:"9.3", arrowLength:"29"});
  assert(thin.cd > fat.cd, "Thin arrows must have the larger frontal-area Cd");
  /* 初速: パワーストローク（引き尺−1.75−ブレースハイト）と仮想質量。40lb/28in/BH8.75/320gr → 約198fps */
  const v40 = physicsApi.physicsProfile({poundage:"40", drawLength:"28", brace:"8.75 inch", arrowWeight:"320"});
  assert(v40.speedFps > 190 && v40.speedFps < 206 && Math.abs(v40.braceIn - 8.75) < 1e-12, "Power-stroke speed estimate failed");
  const heavy = physicsApi.physicsProfile({poundage:"40", drawLength:"28", arrowWeight:"420"});
  const kinetic = (pp) => 0.5 * pp.massKg * pp.speedMps * pp.speedMps;
  assert(heavy.speedFps < v40.speedFps && kinetic(heavy) > kinetic(v40), "Heavier arrows must be slower but take more energy");
  const longBrace = physicsApi.physicsProfile({poundage:"40", drawLength:"28", brace:"9.5", arrowWeight:"320"});
  assert(longBrace.speedFps < v40.speedFps, "A higher brace height shortens the power stroke");
  assert(Math.abs(physicsApi.physicsProfile({brace:"22.2"}).braceIn - 22.2 / 2.54) < 1e-12, "Brace height in cm must be converted");
}
assert(phys.variation.confidenceFactor < 1, "Gear variation did not apply");
const calmTraj = physicsApi.trajectoryModel({dist:70}, {
  poundage:"38", drawLength:"28.5", shaftGpi:"6.8", arrowLength:"29", pointWeight:"110", arrowDia:"5.5",
  vane:"Spin Wing", temperature:"30", altitude:"500", humidity:"70"
}, 850);
const windTraj = physicsApi.trajectoryModel({dist:70, windDir:"左から", windSpeed:"4"}, {
  poundage:"38", drawLength:"28.5", shaftGpi:"6.8", arrowLength:"29", pointWeight:"110", arrowDia:"5.5",
  vane:"Spin Wing", temperature:"30", altitude:"500", humidity:"70"
}, 850);
assert(calmTraj.engine === "RK4-3D" && calmTraj.tof > .6 && calmTraj.tof < 1.5, "RK4 trajectory failed");
assert(windTraj.wind.side > 0 && windTraj.windDriftCm > 0 && windTraj.windUncertaintyCm > 0, "Wind drift model failed");
assert(physicsApi.ArcheryPhysicsCore && physicsApi.ArcheryPhysicsCore.trajectory({dist:70}, {poundage:"38"}, 850).engine === "RK4-3D", "Physics core facade failed");
/* 距離別サイト値の予測: 弾道から計算した照準角 tan(α) にサイト値を線形回帰する。
   前提と異なる「真の値」（目と矢の高低差12cm・的との高低差25cm・Cd2.0・初速58m/s）から作った台帳でも、
   実測範囲の外（18m・70m・90m）を1mm前後で当てる。旧版の一次/二次近似は 2〜9mm ずれていた */
{
  const sightDb = {settings:{eyeSight:850}, setups:[{id:"s", poundage:"40", drawLength:"28", arrowWeight:"320", arrowDia:"5.5"}], sightMarks:[], sessions:[]};
  const sightApi = new Function("normGearText","db", arrowDiaConsts + section("function clamp", "function latestMark") + "\nreturn {physicsProfile,solveZeroAngle,sightInterp,sightAngleFeature};")(normGearText, sightDb);
  const truth = Object.assign({}, sightApi.physicsProfile(sightDb.setups[0]), {speedMps:58, cd:2.0});
  const mark = (D) => { const th = sightApi.solveZeroAngle(D, truth, null, -0.12, -0.25); return 100 - 850 * Math.tan(th - Math.atan2(-0.25, D)); };
  sightDb.sightMarks = [30, 50].map((d, i) => ({id:"m" + i, setupId:"s", dist:d, v:mark(d).toFixed(2), date:"2026-01-0" + (i + 1)}));
  const it = sightApi.sightInterp("s");
  assert(it && it.model === "physics" && it.speedSource === "estimated", "Physics sight model missing");
  for (const d of [18, 70, 90]) assert(Math.abs(it.est(d) - mark(d)) < (d === 90 ? 1.5 : 0.8), `Sight prediction at ${d}m off by ${Math.abs(it.est(d) - mark(d))}`);
  assert(Math.abs(it.est(30) - mark(30)) < 0.01 && Math.abs(it.est(50) - mark(50)) < 0.01, "Two-mark fit must pass through the marks");
  /* 近距離ほど 1/距離 の項（目と矢の高低差）が効き、照準角は距離に対して直線にならない */
  const ph = sightApi.physicsProfile(sightDb.setups[0]);
  const f = [18, 30, 50, 70].map((d) => sightApi.sightAngleFeature(d, ph));
  assert(f[0] < f[1] && f[1] < f[2] && f[2] < f[3], "Sight angle must grow with distance");
  assert((f[1] - f[0]) / 12 < (f[3] - f[2]) / 20, "Sight angle curvature (drag) missing");
  /* 4距離では自由度1で初速の当てはめが不安定なので当てはめない（用具からの推定のまま） */
  sightDb.sightMarks = [18, 30, 50, 70].map((d, i) => ({id:"m" + i, setupId:"s", dist:d, v:mark(d).toFixed(2), date:"2026-01-0" + (i + 1)}));
  const it4 = sightApi.sightInterp("s");
  assert(it4.speedSource === "estimated" && Math.abs(it4.est(90) - mark(90)) < 1.5, "Four marks must not fit the launch speed");
  const it5marks = [18, 30, 40, 50, 60, 70];
  sightDb.sightMarks = it5marks.map((d, i) => ({id:"m" + i, setupId:"s", dist:d, v:mark(d).toFixed(2), date:"2026-01-0" + (i + 1)}));
  const it6 = sightApi.sightInterp("s");
  assert(it6.r2 > 0.9999 && Math.abs(it6.est(90) - mark(90)) < 1.5, `Six-mark prediction failed (${it6.speedSource})`);
}
const calibDb = {
  setups:[{id:"main",poundage:"38",drawLength:"28.5",shaftGpi:"6.8",arrowLength:"29",pointWeight:"110",arrowDia:"5.5",arrowWeight:"334",vane:"Spin Wing",temperature:"30",altitude:"500",humidity:"70"}],
  sessions:[],
  sightMarks:[{setupId:"main",dist:30,v:"4.2"},{setupId:"main",dist:50,v:"5.6"},{setupId:"main",dist:70,v:"6.8"}],
  settings:{eyeSight:850}
};
const windDrift70 = physicsApi.trajectoryModel({dist:70, windDir:"左から", windSpeed:"4"}, calibDb.setups[0], 850).windDriftCm;
assert(windDrift70 > 24 && windDrift70 < 40, `70m crosswind drift out of the published range: ${windDrift70}`);
const calibSess = (id, sightV, cx, cy, windDir="", windSpeed="") => ({
  id, date:`2026-05-${id}`, setupId:"main", dist:70, faceD:122, faceType:"single", sightV:String(sightV), windDir, windSpeed,
  ends:[[0,1,2,3,4,5].map(i=>({x:cx+(i%3-1)*.2,y:cy+(Math.floor(i/3)-.5)*.2,s:9}))]
});
calibDb.sessions.push(
  calibSess("01",5,0,2),
  calibSess("02",6,0,0),
  calibSess("03",7,0,-2),
  /* 風の回の左右ズレはモデルの横流れの95%/90%（70m・横風4m/sで約29cm。WAの研究では3m/sでリング4本超） */
  calibSess("04",6,windDrift70*.95,0,"左から","4"),
  calibSess("05",6,windDrift70*.9,0,"左から","4")
);
const calibApi = new Function(
  "db","normGearText","robustStats","sessionQuality","ringW","isWindy","pct","esc","sessionHasPos",
  arrowDiaConsts + section("function clamp", "function adviceModel") + section("function regress", "function latestMark") + "\nreturn {personalPhysicsCalibration};"
)(
  calibDb,
  normGearText,
  statsApi.robustStats,
  (s,setup,st) => ({score:.82, metrics:{st:st||statsApi.robustStats(s.ends.flat()), all:s.ends.flat(), avg:9}}),
  f=>f/20,
  s=>!!(s.windSpeed && +s.windSpeed>=3.5),
  v=>`${Math.round(v*100)}%`,
  s=>String(s == null ? "" : s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])),
  scoreApi.sessionHasPos
);
const pcal = calibApi.personalPhysicsCalibration("main");
assert(pcal && pcal.click.v70 > 1.5 && pcal.click.v70 < 2.5 && pcal.wind.sample >= 2 && pcal.wind.factor > .7 && pcal.score > .25, "Personal physics calibration failed");

const gearApi = new Function(
  "clamp","num","esc","DEFAULT_ARROW_DIA_MM",
  section("const CATALOG_SHAFTS", "function renderGear") + "\nreturn {inferCatalogGear,gearSectionHtml,gearPrecisionProfile,gearPrecisionHtml,spineGuidance,GEAR_SECTIONS,GEAR_FIELDS,GEAR_SUGGESTIONS};"
)(
  (v,a,b)=>Math.max(a,Math.min(b,v)),
  v=>{ const n=parseFloat(v); return Number.isFinite(n)?n:null; },
  s=>String(s == null ? "" : s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])),
  5.7
);
const inf = gearApi.inferCatalogGear({arrow:"EASTON X10", notes:"", shaftSpine:"650", arrowLength:"29", pointWeight:"110"});
assert(inf && inf.spine === 650 && Math.round(inf.total) === 334, "Catalog inference failed");
const protour = gearApi.inferCatalogGear({arrow:"EASTON X10 ProTour", notes:"", shaftSpine:"670", arrowLength:"29", pointWeight:"110"});
assert(protour && protour.fam.id === "x10-protour" && protour.gpi === 6.5 && protour.dia < 4.8, "X10 ProTour inference failed");
const unlistedProtour = gearApi.inferCatalogGear({arrow:"EASTON X10 ProTour", notes:"", shaftSpine:"650", arrowLength:"29", pointWeight:"110"});
assert(unlistedProtour && unlistedProtour.notes.some(n => n.includes("未確認")), "Unlisted spine warning missing");
const missingInf = gearApi.inferCatalogGear({arrow:"EASTON X10", notes:"", shaftSpine:"", arrowLength:"29", pointWeight:"110"});
assert(missingInf && missingInf.missing === "spine", "Separated shaft/spine inference failed");
const formHtml = gearApi.GEAR_SECTIONS.map(sec => gearApi.gearSectionHtml(sec, {bow:"HOYT GMX3"})).join("");
assert(formHtml.includes("<details class=\"adv\"><summary>矢の実測・精密データ</summary>"), "Gear section UI missing");
assert(formHtml.includes("シャフト銘柄") && formHtml.includes("HOYT Grand Prix XCEED 2 H25"), "Separated gear model UI missing");
assert(formHtml.includes("SHIBUYA ULTIMA RC IV 520 Carbon") && formHtml.includes("RAMRODS VEKTOR") && formHtml.includes("GAS Bowstrings Ghost XV") && formHtml.includes("ANGEL Tab 2 Plus Cordovan"), "Expanded gear knowledge missing");
assert(formHtml.includes("choicePick") && formHtml.includes("候補にないので手入力"), "Gear dropdown/manual UI missing");
const bowKeys = gearApi.GEAR_SUGGESTIONS.bow.map(normGearText);
const limbKeys = gearApi.GEAR_SUGGESTIONS.limbs.map(normGearText);
assert(!limbKeys.some(v => /FORMULA SR|FORMULA XD/.test(v)), "Handle-only HOYT risers leaked into limbs");
assert(!bowKeys.some(v => /MK KOREA MK XD|MK XD|MK KOREA ZEST/.test(v)), "Limb-only MK entries leaked into bow");
assert(!limbKeys.some(v => v === "HOYT RCRV PODIUM" || v === "HOYT RCRV COMP"), "Ambiguous HOYT limb labels missing limb context");
assert(!limbKeys.some(v => v.includes("SKADI-CX")), "Stabilizer leaked into limbs");
assert(!bowKeys.some(v => limbKeys.includes(v)), "Handle/limb dropdown overlap");
assert(gearApi.GEAR_SUGGESTIONS.stabilizer.some(v => normGearText(v).includes("SKADI-CX")), "Known stabilizer entry missing from stabilizer list");
assert(!gearApi.GEAR_SUGGESTIONS.stabilizer.some(v => /LIMBS|リム/.test(normGearText(v))), "Limb entries leaked into stabilizer dropdown");
assert(!gearApi.GEAR_SUGGESTIONS.sight.some(v => /LIMBS|リム|H25/.test(normGearText(v))), "Bow/limb entries leaked into sight dropdown");
assert(formHtml.includes("ハンドル/弓本体") && formHtml.includes("HOYT Formula RCRV PODIUM Limbs"), "Separated handle/limb labels missing");
assert(gearApi.GEAR_FIELDS.length >= 32, "Gear fields unexpectedly small");
assert(gearApi.GEAR_FIELDS.some(([k]) => k === "stabilizer") && gearApi.GEAR_FIELDS.some(([k]) => k === "tab"), "New gear fields missing");
assert(gearApi.GEAR_FIELDS.some(([k]) => k === "tuningMethod") && gearApi.GEAR_FIELDS.some(([k]) => k === "tuningResult"), "Tuning practice fields missing");
const sp = gearApi.spineGuidance({poundage:"38", drawLength:"28.5", arrowLength:"29", pointWeight:"110", shaftSpine:"660"});
assert(sp && sp.ready && sp.candidates.includes(660) && ["概ね候補域","候補を表示"].includes(sp.state), "Spine guidance failed");
assert(gearApi.gearPrecisionHtml({poundage:"38", drawLength:"28.5", arrowLength:"29", pointWeight:"110", shaftSpine:"660"}).includes("スパインの初期候補"), "Spine guidance UI missing");

const historyApi = new Function(
  "db","robustStats","sessionMetrics","ringW","groupStats","faceLabel","fmtD","cmOffsetText","esc","zoneStyle","sightStats",
  section("function sessionGroupPoint", "function monthlyCard") + "\nreturn {sessionGroupPoint,scoreDistCard};"
)(
  {setups:[{id:"main",name:"Main setup"}]},
  statsApi.robustStats,
  s => { const all = s.ends.flat(); const total = all.reduce((a,x)=>a+x.s,0); return {all, total, avg: all.length ? total/all.length : 0, st: statsApi.robustStats(all)}; },
  scoreApi.ringW,
  statsApi.groupStats,
  faceApi.faceLabel,
  iso=>iso,
  (v,axis)=>`${axis}:${v.toFixed(1)}`,
  s=>String(s == null ? "" : s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])),
  scoreApi.zoneStyle,
  statsApi.sightStats
);
const sampleSessions = [
  {id:"b",date:"2026-02-01",setupId:"main",dist:70,faceD:122,faceType:"single",ends:[[{x:2,y:1,s:9},{x:3,y:2,s:9},{x:1,y:1,s:10},{x:2,y:0,s:10},{x:3,y:1,s:9},{x:2,y:2,s:9}]]},
  {id:"a",date:"2026-01-01",setupId:"main",dist:70,faceD:122,faceType:"single",ends:[[{x:-1,y:0,s:10},{x:0,y:1,s:10},{x:-2,y:0,s:9},{x:-1,y:-1,s:10},{x:0,y:0,s:10},{x:-1,y:1,s:10}]]}
];
/* 「矢の集まり具合の推移」のカードは v5 段 7 で 分析 > 着弾 の「グループRMSの推移」（全射の値の表）に置き換えた。
   回ごとの中心と半径を出す sessionGroupPoint は残してあるので、ここではその値だけを確かめる */
const trendPoint = historyApi.sessionGroupPoint(sampleSessions[0]);
assert(trendPoint && trendPoint.setupName === "Main setup" && trendPoint.n === 6 && Number.isFinite(trendPoint.rr), "Session group point failed");
const fieldDistHtml = historyApi.scoreDistCard([{id:"field",date:"2026-03-01",dist:30,faceD:40,faceType:"field",ends:[[
  {s:6},{s:5},{s:4},{s:3},{s:2},{s:1},{s:6},{s:5},{s:4},{s:3},{s:2},{s:0}
]]}]);
assert(fieldDistHtml.includes("得点の内訳") && fieldDistHtml.includes(">6</div>") && !fieldDistHtml.includes(">10</div>") && !fieldDistHtml.includes(">X</div>"), "Field score distribution failed");

/* 得点分布は矢を何度も走査しない。時間の揺れによらず大量履歴での読み取り量を検証する。 */
let distributionScoreReads = 0;
const distributionSessions = Array.from({length:1000}, () => ({
  faceType:"single",
  ends:[Array.from({length:36}, () => ({get s(){ distributionScoreReads++; return 9; }, X:false}))]
}));
const largeDistributionHtml = historyApi.scoreDistCard(distributionSessions);
assert(largeDistributionHtml.includes("全36000射") && largeDistributionHtml.includes("36000射 (100%)"), "Large score distribution totals changed");
assert(distributionScoreReads <= 36000 * 2 + 128, `Score distribution repeatedly scans arrows: ${distributionScoreReads} reads`);
const fieldWithEmptySingle = historyApi.scoreDistCard([{faceType:"single",ends:[]}, {faceType:"field",ends:[Array.from({length:12},()=>({s:6}))]}]);
assert(fieldWithEmptySingle.includes(">6</div>") && !fieldWithEmptySingle.includes(">X</div>"), "Empty sessions changed field-only score buckets");
console.log(`Score distribution: 36000 arrows, ${distributionScoreReads} score reads`);

console.log(`Archery Note checks OK (v${version})`);
console.log(`Robust grouping: used=${st.n}, excluded=${st.excluded.length}, confidence=${Math.round(st.confidence*100)}%`);
console.log(`Physics: ${phys.speedFps.toFixed(0)}fps, rho=${phys.rho.toFixed(2)}, Cd=${phys.cd.toFixed(2)}`);
