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
assert(!/user-scalable\s*=\s*no|maximum-scale\s*=/.test(html), "Viewport must allow user zoom");
assert(html.includes("window.PointerEvent") && html.includes("touchstart") && html.includes("mousedown"), "Input fallback handlers missing");
assert(html.includes("createSVGPoint()"), "SVG coordinate fallback missing");
assert(html.includes("Array.prototype.flat") && html.includes("Object.values") && html.includes("Math.hypot"), "Compatibility polyfills missing");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
new Function(sw);
assert(sw.includes('e.request.mode === "navigate"') && sw.includes('caches.match("./index.html")'), "Service worker navigation fallback missing");

const storageApi = new Function(section("const KEY=", "function uid") + "\nreturn {normalizeDb,blankDb,dataCounts,hashText,snapshotLabel};")();
const normalized = storageApi.normalizeDb({sessions:[{id:"s"}], settings:{eyeSight:900}});
assert(normalized.schema >= 2 && normalized.sessions.length === 1 && normalized.settings.eyeSight === 900, "Storage normalization failed");
assert(storageApi.dataCounts({sessions:[1,2],setups:[1],sightMarks:[1,2,3]}).marks === 3, "Data counts failed");
assert(storageApi.hashText("abc") === storageApi.hashText("abc"), "Hash stability failed");
assert(storageApi.snapshotLabel({ts:Date.now(),counts:{sessions:2,setups:1,marks:3}}).includes("練習2"), "Snapshot label failed");

const statsApi = new Function(section("function clamp", "/* ============ target SVG") + "\nreturn {robustStats,groupStats};")();
const arrows = [
  {x:1,y:1},{x:2,y:1.5},{x:0,y:.5},{x:1.2,y:1.7},{x:.8,y:.9},{x:1.5,y:1.1},
  {x:2.1,y:2.0},{x:1.7,y:1.6},{x:28,y:-20}
];
const st = statsApi.robustStats(arrows);
assert(st && st.excluded.length === 1 && st.method === "ellipse-biweight", "Robust grouping failed");

const normGearText = s => String(s || "").normalize("NFKC").toUpperCase().replace(/[・_/]+/g, " ").replace(/\s+/g, " ").trim();
const physicsApi = new Function("normGearText", section("function clamp", "function simulateArrow") + "\nreturn {physicsProfile};")(normGearText);
const phys = physicsApi.physicsProfile({
  poundage:"38", drawLength:"28.5", shaftGpi:"6.8", arrowLength:"29", pointWeight:"110", arrowDia:"5.5",
  vane:"Spin Wing", vaneHeight:"2.0", temperature:"30", altitude:"500", humidity:"70",
  shaftSetWeightSpread:"4", shaftStraightness:"0.003", foc:"13"
});
assert(phys.speedFps > 150 && phys.speedFps < 260, "Physics speed out of range");
assert(phys.rho > .9 && phys.rho < 1.25, "Air density out of range");
assert(phys.cd > 1.1 && phys.cd < 1.3, "Arrow Cd out of range");
assert(phys.variation.confidenceFactor < 1, "Gear variation did not apply");

const gearApi = new Function(
  "clamp","num","esc",
  section("const CATALOG_SHAFTS=", "function renderGear") + "\nreturn {inferCatalogGear,gearSectionHtml,gearPrecisionProfile,GEAR_SECTIONS,GEAR_FIELDS};"
)(
  (v,a,b)=>Math.max(a,Math.min(b,v)),
  v=>{ const n=parseFloat(v); return Number.isFinite(n)?n:null; },
  s=>String(s == null ? "" : s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))
);
const inf = gearApi.inferCatalogGear({arrow:"EASTON X10 650 29inch 110gr", notes:"", shaftSpine:"", arrowLength:"", pointWeight:""});
assert(inf && inf.spine === 650 && Math.round(inf.total) === 334, "Catalog inference failed");
const formHtml = gearApi.GEAR_SECTIONS.map(sec => gearApi.gearSectionHtml(sec, {bow:"HOYT GMX3"})).join("");
assert(formHtml.includes("<details class=\"adv\"><summary>矢の実測・精密データ</summary>"), "Gear section UI missing");
assert(gearApi.GEAR_FIELDS.length >= 30, "Gear fields unexpectedly small");

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
