const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");

const root = path.resolve(__dirname, "..");
const appUrl = `file:///${path.join(root, "index.html").replace(/\\/g, "/")}`;
const outDir = path.join(root, "docs", "screenshots");
const WIDTH = 390, HEIGHT = 844;

const DEMO_DB = JSON.stringify({
  schema: 8,
  settings: { eyeSight: 850, theme: "auto", lastBackupAt: "2026-07-06T12:00:00Z", activeGuideSeen: true, formTrackingEnabled: false },
  setups: [{
    id: "s1", name: "メインセッティング",
    bow: "HOYT Formula XI 25", limbs: "HOYT Velos 38L", poundage: "38",
    arrow: "EASTON X10", spine: "600", arrowLength: 720, pointWeight: 120,
    nock: "BEITER Pin Nock", vane: "SPIN WING",
    sight: "SHIBUYA ULTIMA RC II 520 Carbon", stab: "FIVICS CEX2000 30in",
    rest: "SHIBUYA ULTIMA", plunger: "BEITER",
    drawLength: 28.5, arrowWeight: 330, arrowDia: 4.0, arrowSpeed: 58,
    createdAt: "2026-03-01", history: []
  }],
  sightMarks: [
    { id: "m1", setupId: "s1", dist: 70, value: 3.82, note: "", date: "2026-07-06" },
    { id: "m2", setupId: "s1", dist: 50, value: 4.95, note: "", date: "2026-07-05" },
    { id: "m3", setupId: "s1", dist: 30, value: 6.10, note: "", date: "2026-07-04" },
    { id: "m4", setupId: "s1", dist: 18, value: 6.85, note: "", date: "2026-07-03" },
  ],
  sessions: makeSessions(),
  trash: [], formAnalyses: [], customRounds: [], active: null
});

function makeSessions() {
  const sessions = [];
  const dates = ["2026-07-06","2026-07-05","2026-07-03","2026-07-01","2026-06-28","2026-06-25"];
  const dists = [70, 50, 70, 30, 50, 70];
  const avgScores = [
    [9,8,10,9,8,9, 10,9,8,9,10,8, 9,9,8,10,9,8, 8,9,10,9,8,9, 9,10,9,8,9,8, 10,9,8,9,9,8],
    [9,10,9,10,9,8, 10,9,10,9,8,9, 9,10,9,9,10,8, 10,9,9,10,9,8, 9,10,10,9,8,9, 10,9,9,10,9,9],
    [8,9,9,10,8,9, 9,8,10,9,9,8, 10,9,8,8,9,9, 9,10,9,8,8,9, 8,9,10,9,9,8, 9,9,8,10,9,8],
    [10,10,9,10,10,9, 10,9,10,10,9,10, 10,10,10,9,9,10, 9,10,10,10,9,10, 10,10,9,10,10,9, 10,10,10,9,10,10],
    [9,9,10,9,8,9, 10,9,9,8,9,10, 9,9,10,9,8,9, 9,10,9,9,8,9, 10,9,9,10,9,8, 9,9,10,9,9,8],
    [8,9,8,9,10,8, 9,8,9,10,8,9, 8,9,9,8,10,9, 9,8,8,9,10,8, 8,9,9,8,9,10, 9,8,9,8,9,9],
  ];
  for (let i = 0; i < dates.length; i++) {
    const arrows = avgScores[i];
    const perEnd = 6;
    const ends = [];
    for (let e = 0; e < arrows.length; e += perEnd) {
      const chunk = arrows.slice(e, e + perEnd);
      ends.push(chunk.map((s, j) => {
        const r = (10 - s) / 10 * 50;
        const angle = (e + j * 137.5) * Math.PI / 180;
        return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, s };
      }));
    }
    sessions.push({
      id: `sess-${i+1}`, date: dates[i], dist: dists[i], faceD: dists[i] >= 50 ? 122 : 80,
      faceType: "single", perEnd, ends, setupId: "s1", round: "", notes: ""
    });
  }
  return sessions;
}

function assert(ok, msg) { if (!ok) throw new Error(msg); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function stopProcess(proc) {
  if (proc.exitCode !== null) return;
  const closed = new Promise(r => proc.once("close", r));
  proc.kill();
  await Promise.race([closed, sleep(1500)]);
}
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => { const p = server.address().port; server.close(() => resolve(p)); });
  });
}
async function fetchJson(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000);
  try { const r = await fetch(url, { signal: c.signal }); return await r.json(); } finally { clearTimeout(t); }
}
async function waitTarget(port) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const ts = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const p = ts.find(t => t.type === "page" && t.webSocketDebuggerUrl);
      if (p) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(120);
  }
  throw new Error("Chrome timed out");
}
function createCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1; const pending = new Map(); const waiters = [];
    const timer = setTimeout(() => reject(new Error("WS timeout")), 8000);
    ws.addEventListener("open", () => { clearTimeout(timer); resolve({
      send(m, p = {}) { const id = nextId++; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); },
      waitEvent(m, ms = 10000) { return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${m}`)), ms); waiters.push({ method: m, res, rej, timer: t }); }); },
      close() { ws.close(); }
    }); });
    ws.addEventListener("message", ev => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString("utf8"));
      if (msg.id && pending.has(msg.id)) { const t = pending.get(msg.id); pending.delete(msg.id); msg.error ? t.rej(new Error(msg.error.message)) : t.res(msg.result || {}); }
      if (msg.method) waiters.filter(w => w.method === msg.method).forEach(w => { clearTimeout(w.timer); w.res(msg.params || {}); waiters.splice(waiters.indexOf(w), 1); });
    });
    ws.addEventListener("error", e => reject(new Error(`WS error: ${e.message || e.type}`)));
  });
}

function findBrowser() {
  return ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
    process.env.CHROME_PATH, process.env.EDGE_PATH
  ].filter(Boolean).find(p => fs.existsSync(p));
}

async function main() {
  const browser = findBrowser();
  assert(browser, "Chrome not found");
  const profile = path.join(outDir, ".profile");
  if (fs.existsSync(profile)) fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(profile, { recursive: true });
  const port = await freePort();
  const proc = spawn(browser, [
    "--headless=new","--no-sandbox","--disable-gpu","--disable-gpu-compositing",
    "--disable-software-rasterizer","--force-device-scale-factor=2",
    "--hide-scrollbars","--allow-file-access-from-files","--no-first-run",
    `--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"about:blank"
  ], { stdio: ["ignore","ignore","pipe"] });

  try {
    const wsUrl = await waitTarget(port);
    const client = await createCdp(wsUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true });
    await client.send("Emulation.setTouchEmulationEnabled", { enabled: true });

    const load = client.waitEvent("Page.loadEventFired", 15000).catch(() => null);
    await client.send("Page.navigate", { url: `${appUrl}?demo=${Date.now()}` });
    await load;

    await client.send("Runtime.evaluate", { expression: `localStorage.setItem("archeryNote.v1", ${JSON.stringify(DEMO_DB)})`, returnByValue: true });
    const reload = client.waitEvent("Page.loadEventFired", 15000).catch(() => null);
    await client.send("Page.navigate", { url: `${appUrl}?demo=${Date.now()}` });
    await reload;
    await sleep(600);

    const views = [
      { name: "practice-records", tab: null },
      { name: "history", tab: 1 },
      { name: "sight-adjustment", tab: 3 },
      { name: "equipment", tab: 4 },
    ];

    for (const view of views) {
      if (view.tab !== null) {
        await client.send("Runtime.evaluate", {
          expression: `document.querySelectorAll("nav.tabs button")[${view.tab}].click()`,
          returnByValue: true
        });
        await sleep(500);
      }
      const capture = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      const outFile = path.join(outDir, `${view.name}.png`);
      fs.writeFileSync(outFile, Buffer.from(capture.data, "base64"));
      const size = fs.statSync(outFile).size;
      console.log(`${view.name}.png ${size} bytes`);
    }

    client.close();
  } finally {
    await stopProcess(proc);
    for (let i = 0; i < 5; i++) {
      try { if (fs.existsSync(profile)) fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(200); }
    }
  }
  console.log("Screenshots generated OK");
}

main().catch(e => { console.error(e.message); process.exit(1); });
