const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");

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

const appVer = /const APP_VER=(\d+)/.exec(html)?.[1];
const version = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).v;
const swVer = /archery-note-v(\d+)/.exec(fs.readFileSync(path.join(root, "sw.js"), "utf8"))?.[1];
assert(+appVer === version && +swVer === version, `Version mismatch app=${appVer} json=${version} sw=${swVer}`);
assert(/maximum-scale\s*=\s*1/.test(html) && /user-scalable\s*=\s*no/.test(html), "Viewport must suppress accidental zoom during scoring");
assert(html.includes("データで育つ記録アプリ") && html.includes("点取りから調整提案へ") && html.includes("足りない材料を見る"), "onboarding UI missing");
assert(html.includes("今日の作戦盤") && html.includes("missionPanel") && html.includes("recordSetupSnapshot") && html.includes("gearWorkbenchHtml"), "v30 cockpit UI missing");
assert(html.includes("levelFromScore") && html.includes("RECORD_FLOW_MODES") && html.includes("recordIntroHtml"), "record UI helpers missing");
assert(html.includes("window.PointerEvent") && html.includes("touchstart") && html.includes("mousedown"), "Input fallback handlers missing");
assert(html.includes("createSVGPoint()"), "SVG coordinate fallback missing");
assert(html.includes("Array.prototype.flat") && html.includes("Object.values") && html.includes("Math.hypot"), "Compatibility polyfills missing");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
new Function(sw);
assert(sw.includes('e.request.mode === "navigate"') && sw.includes('caches.match("./index.html")'), "Service worker navigation fallback missing");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const cap = JSON.parse(fs.readFileSync(path.join(root, "capacitor.config.json"), "utf8"));
assert(pkg.scripts["build:native-web"] && pkg.scripts["native:sync"], "Native build scripts missing");
assert(cap.appId === "com.eita.archerynote" && cap.webDir === "dist/native", "Capacitor config mismatch");
assert(fs.existsSync(path.join(root, "tools", "build-native-web.js")) && fs.existsSync(path.join(root, "docs", "native-transition.md")), "Native transition files missing");
assert(html.includes("nativeReadinessHtml") && html.includes("アプリ基盤") && html.includes("RK4-3D JS core"), "Native readiness UI missing");
assert(html.includes("storageGetItem") && html.includes("storageSetItem") && html.includes("storageDriverProfile"), "Storage adapter missing");
assert(html.includes("ArcheryPhysicsCore") && html.includes("window.ArcheryPhysicsCore"), "Physics core interface missing");

const storageApi = new Function(section("const KEY=", "function uid") + "\nreturn {normalizeDb,blankDb,dataCounts,hashText,snapshotLabel,storageGetItem,storageSetItem,storageDriverProfile};")();
const normalized = storageApi.normalizeDb({sessions:[{id:"s"}], settings:{eyeSight:900}});
assert(normalized.schema >= 3 && normalized.sessions.length === 1 && normalized.settings.eyeSight === 900 && Array.isArray(normalized.trash), "Storage normalization failed");
assert(storageApi.dataCounts({sessions:[1,2],setups:[1],sightMarks:[1,2,3]}).marks === 3, "Data counts failed");
assert(storageApi.hashText("abc") === storageApi.hashText("abc"), "Hash stability failed");
assert(storageApi.snapshotLabel({ts:Date.now(),counts:{sessions:2,setups:1,marks:3}}).includes("練習2"), "Snapshot label failed");
assert(storageApi.storageGetItem("__missing__") == null && storageApi.storageSetItem("__test__", "1") === false && storageApi.storageDriverProfile().id === "localStorage", "Storage adapter fallback failed");
assert(html.includes("TRASH_LIMIT") && html.includes("restoreTrash") && html.includes("trashSettingsHtml"), "Trash/restore support missing");
assert(html.includes("openSetupWizard") && html.includes("openCalibrationWizard"), "Wizard/calibration flows missing");
assert(html.includes("sessionsCsv") && html.includes("scorecardSvg"), "Export flows missing");
assert(html.includes("judgementFor") && html.includes("conditionInsights"), "Analysis judgement flows missing");
assert(html.includes("histFilter") && html.includes("histSetup"), "History filters missing");
assert(html.includes("ROUND_TYPES") && html.includes("roundProgressHtml"), "Round scoring support missing");
assert(html.includes("personalModel") && html.includes("sessionQuality") && html.includes("nextActionPlan"), "Personal decision model missing");
assert(html.includes("decision_quality") && html.includes("personal_model"), "CSV decision columns missing");
assert(html.includes("robustWeightedLine") && html.includes("modelReadinessProfile") && html.includes("個人データ準備度"), "v19 weighted model readiness missing");
assert(html.includes("spineGuidance") && html.includes("スパイン初期候補") && html.includes("stabilizer"), "v20 gear guidance missing");
assert(html.includes("RK4-3D") && html.includes("windModel") && html.includes("横流れ推定"), "v21 physics engine missing");
assert(html.includes("personalPhysicsCalibration") && html.includes("物理校正") && html.includes("履歴推定"), "v22 personal physics calibration missing");
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

const statsApi = new Function(section("function clamp", "/* ============ target SVG") + "\nreturn {robustStats,groupStats};")();
const arrows = [
  {x:1,y:1},{x:2,y:1.5},{x:0,y:.5},{x:1.2,y:1.7},{x:.8,y:.9},{x:1.5,y:1.1},
  {x:2.1,y:2.0},{x:1.7,y:1.6},{x:28,y:-20}
];
const st = statsApi.robustStats(arrows);
assert(st && st.excluded.length === 1 && st.method === "ellipse-biweight", "Robust grouping failed");
const lineApi = new Function(section("function clamp", "function solve3") + "\nreturn {robustWeightedLine};")();
const wr = lineApi.robustWeightedLine([[5,3,1],[6,1.5,1],[7,0.2,1],[8,-1.1,1],[9,-2.6,1],[12,20,0.05]]);
assert(wr && wr.kind === "weighted-robust" && wr.zero > 6.8 && wr.zero < 7.5 && wr.quality > .4, "Weighted robust sight regression failed");

const analysisDb = {sessions:[]};
const analysisApi = new Function(
  "db","robustStats","ringW","clamp","num","gearPrecisionProfile","pct","cmOffsetText","esc","groupStats",
  section("function windText", "function roundProgressHtml") + "\nreturn {sessionQuality,personalModel,judgementFor,nextActionPlan};"
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
  statsApi.groupStats
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
const pm = analysisApi.personalModel(current,{id:"main"},curSt);
assert(q.score > .45 && ["中","高"].includes(q.label), "Session quality failed");
assert(pm && pm.sample === 2 && pm.state === "過去と一致", "Personal model failed");
const judgement = analysisApi.judgementFor({st:curSt,confidence:.7,lines:[{axis:"h"}],personal:pm},current);
assert(judgement && judgement.label === "動かす", "Personal judgement failed");
assert(analysisApi.nextActionPlan(current,{st:curSt,confidence:.7,lines:[{axis:"h"}],personal:pm},{id:"main"}).length > 0, "Next action plan failed");

const normGearText = s => String(s || "").normalize("NFKC").toUpperCase().replace(/[・_/]+/g, " ").replace(/\s+/g, " ").trim();
const physicsApi = new Function("normGearText", section("function clamp", "function adviceModel") + "\nreturn {physicsProfile,trajectoryModel,windModel,ArcheryPhysicsCore};")(normGearText);
const phys = physicsApi.physicsProfile({
  poundage:"38", drawLength:"28.5", shaftGpi:"6.8", arrowLength:"29", pointWeight:"110", arrowDia:"5.5",
  vane:"Spin Wing", vaneHeight:"2.0", temperature:"30", altitude:"500", humidity:"70",
  shaftSetWeightSpread:"4", shaftStraightness:"0.003", foc:"13"
});
assert(phys.speedFps > 150 && phys.speedFps < 260, "Physics speed out of range");
assert(phys.rho > .9 && phys.rho < 1.25, "Air density out of range");
assert(phys.cd > 1.1 && phys.cd < 1.3, "Arrow Cd out of range");
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
const calibDb = {
  setups:[{id:"main",poundage:"38",drawLength:"28.5",shaftGpi:"6.8",arrowLength:"29",pointWeight:"110",arrowDia:"5.5",arrowWeight:"334",vane:"Spin Wing",temperature:"30",altitude:"500",humidity:"70"}],
  sessions:[],
  sightMarks:[{setupId:"main",dist:30,v:"4.2"},{setupId:"main",dist:50,v:"5.6"},{setupId:"main",dist:70,v:"6.8"}],
  settings:{eyeSight:850}
};
const calibSess = (id, sightV, cx, cy, windDir="", windSpeed="") => ({
  id, date:`2026-05-${id}`, setupId:"main", dist:70, faceD:122, faceType:"single", sightV:String(sightV), windDir, windSpeed,
  ends:[[0,1,2,3,4,5].map(i=>({x:cx+(i%3-1)*.2,y:cy+(Math.floor(i/3)-.5)*.2,s:9}))]
});
calibDb.sessions.push(
  calibSess("01",5,0,2),
  calibSess("02",6,0,0),
  calibSess("03",7,0,-2),
  calibSess("04",6,11,0,"左から","4"),
  calibSess("05",6,10.5,0,"左から","4")
);
const calibApi = new Function(
  "db","normGearText","robustStats","sessionQuality","ringW","isWindy","pct","esc",
  section("function clamp", "function adviceModel") + section("function regress", "function calibrationProfile") + "\nreturn {personalPhysicsCalibration,physicsCalibrationHtml};"
)(
  calibDb,
  normGearText,
  statsApi.robustStats,
  (s,setup,st) => ({score:.82, metrics:{st:st||statsApi.robustStats(s.ends.flat()), all:s.ends.flat(), avg:9}}),
  f=>f/20,
  s=>!!(s.windSpeed && +s.windSpeed>=3.5),
  v=>`${Math.round(v*100)}%`,
  s=>String(s == null ? "" : s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))
);
const pcal = calibApi.personalPhysicsCalibration("main");
assert(pcal && pcal.click.v70 > 1.5 && pcal.click.v70 < 2.5 && pcal.wind.sample >= 2 && pcal.wind.factor > .7 && pcal.score > .25, "Personal physics calibration failed");
assert(calibApi.physicsCalibrationHtml("main").includes("物理校正"), "Physics calibration UI failed");

const gearApi = new Function(
  "clamp","num","esc",
  section("const CATALOG_SHAFTS=", "function renderGear") + "\nreturn {inferCatalogGear,gearSectionHtml,gearPrecisionProfile,gearPrecisionHtml,spineGuidance,GEAR_SECTIONS,GEAR_FIELDS,GEAR_SUGGESTIONS};"
)(
  (v,a,b)=>Math.max(a,Math.min(b,v)),
  v=>{ const n=parseFloat(v); return Number.isFinite(n)?n:null; },
  s=>String(s == null ? "" : s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))
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
assert(gearApi.gearPrecisionHtml({poundage:"38", drawLength:"28.5", arrowLength:"29", pointWeight:"110", shaftSpine:"660"}).includes("スパイン初期候補"), "Spine guidance UI missing");

const historyApi = new Function(
  "db","robustStats","ringW","groupStats","faceLabel","fmtD","cmOffsetText","esc",
  section("function sessionGroupPoint", "function scoreDistCard") + "\nreturn {groupingTrendCard};"
)(
  {setups:[{id:"main",name:"Main setup"}]},
  statsApi.robustStats,
  f=>f/20,
  statsApi.groupStats,
  s=>s.faceType==="triple" ? "40cm三つ目" : `${s.faceD}cm的`,
  iso=>iso,
  (v,axis)=>`${axis}:${v.toFixed(1)}`,
  s=>String(s == null ? "" : s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))
);
const sampleSessions = [
  {id:"b",date:"2026-02-01",setupId:"main",dist:70,faceD:122,faceType:"single",ends:[[{x:2,y:1,s:9},{x:3,y:2,s:9},{x:1,y:1,s:10},{x:2,y:0,s:10},{x:3,y:1,s:9},{x:2,y:2,s:9}]]},
  {id:"a",date:"2026-01-01",setupId:"main",dist:70,faceD:122,faceType:"single",ends:[[{x:-1,y:0,s:10},{x:0,y:1,s:10},{x:-2,y:0,s:9},{x:-1,y:-1,s:10},{x:0,y:0,s:10},{x:-1,y:1,s:10}]]}
];
const trendHtml = historyApi.groupingTrendCard(sampleSessions);
assert(trendHtml.includes("グルーピング推移") && trendHtml.includes("Main setup"), "Grouping trend card failed");

console.log(`Archery Note checks OK (v${version})`);
console.log(`Robust grouping: used=${st.n}, excluded=${st.excluded.length}, confidence=${Math.round(st.confidence*100)}%`);
console.log(`Physics: ${phys.speedFps.toFixed(0)}fps, rho=${phys.rho.toFixed(2)}, Cd=${phys.cd.toFixed(2)}`);
