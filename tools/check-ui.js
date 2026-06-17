const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const appUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;
const outDir = path.join(root, "artifacts", "ui-smoke");

function assert(ok, msg) {
  if (!ok) throw new Error(msg);
}

function browserCandidates() {
  return [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
}

function findBrowser() {
  const found = browserCandidates().find(p => fs.existsSync(p));
  assert(found, "Chrome/Edge was not found. Set CHROME_PATH or EDGE_PATH.");
  return found;
}

function ensureInsideRoot(p) {
  const full = path.resolve(p);
  assert(full === root || full.startsWith(root + path.sep), `Refusing path outside workspace: ${full}`);
  return full;
}

function cleanDir(dir) {
  const full = ensureInsideRoot(dir);
  if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
  fs.mkdirSync(full, { recursive: true });
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  assert(b.length > 24 && b.toString("ascii", 1, 4) === "PNG", `Not a PNG: ${file}`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}

function staticUiChecks() {
  const gearList = name => {
    const match = new RegExp(`\\n  ${name}:\\[([\\s\\S]*?)\\n  \\],`).exec(html);
    assert(match, `${name} gear list missing`);
    return match[1];
  };
  assert(/<meta name="viewport"[^>]*maximum-scale=1/.test(html), "Viewport zoom guard missing");
  assert(/<nav class="tabs" id="tabs">/.test(html), "Tab bar missing");
  const tabMatches = [...html.matchAll(/<button data-v="([^"]+)">[\s\S]*?<\/button>/g)].map(m => m[1]);
  assert(tabMatches.join(",") === "record,history,sight,gear", `Unexpected tabs: ${tabMatches.join(",")}`);
  assert(html.includes("記録") && html.includes("履歴") && html.includes("サイト") && html.includes("用具"), "Tab labels missing");
  assert(/@media \(max-width:360px\)/.test(html), "Small-screen media query missing");
  assert(/\.row\{flex-direction:column;\}/.test(html), "Small-screen row stacking missing");
  assert(html.includes("データで育つ記録アプリ") && html.includes("点取りから調整提案へ") && html.includes("足りない材料を見る"), "systematic onboarding UI missing");
  assert(html.includes("練習を始める") && html.includes("missionPanel") && html.includes("convergeMission") && html.includes("phaseArc") && html.includes("simplePromise") && html.includes("quickSelects") && html.includes("missionMore") && html.includes("summaryDecisionHtml") && html.includes("setupLens") && html.includes("insightStrip"), "lightweight record flow composition missing");
  assert(html.includes("pageHero") && html.includes("Growth map") && html.includes("Sight lab") && html.includes("Equipment lab") && html.includes("liveHud"), "reborn workspace surfaces missing");
  assert(html.includes("statusPill") && html.includes("nativeSignal") && html.includes("触感") && html.includes("共有"), "native-feel UI missing");
  assert(html.includes("判断信頼度") && html.includes("個人モデル") && html.includes("次のアクション") && html.includes("個人データ準備度") && html.includes("スパイン初期候補") && html.includes("RK4-3D") && html.includes("物理校正"), "analysis cards missing");
  assert(html.includes("アプリ基盤") && html.includes("nativeStack") && html.includes("PWA + Capacitor-ready") && html.includes("ブラウザ保存"), "native readiness UI missing");
  assert(html.includes("シャフト銘柄") && html.includes("番手/スパイン") && html.includes("ハンドル/弓本体") && html.includes("HOYT Grand Prix XCEED 2 H25") && html.includes("HOYT Formula RCRV PODIUM Limbs"), "separated gear fields missing");
  assert(html.includes("EASTON X10 ProTour") && html.includes("SHIBUYA ULTIMA RC IV 520 Carbon") && html.includes("RAMRODS VEKTOR") && html.includes("GAS Bowstrings Ghost XV"), "expanded gear knowledge missing");
  assert(html.includes("choicePick") && html.includes("候補にないので手入力") && html.includes("確認したチューニング"), "gear dropdown/tuning UI missing");
  const bowList = gearList("bow");
  const limbList = gearList("limbs");
  assert(!/Formula SR|Formula XD/.test(limbList), "handle names leaked into limb dropdown");
  assert(!/MK KOREA ZEST Limbs|MK XD Limbs/.test(bowList), "limb names leaked into handle dropdown");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function stopProcess(proc) {
  if (proc.exitCode !== null) return;
  const closed = new Promise(resolve => proc.once("close", resolve));
  proc.kill();
  await Promise.race([closed, sleep(1500)]);
}

async function rmDirWithRetry(dir) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt === 7) throw err;
      await sleep(160);
    }
  }
}

async function fetchJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    assert(res.ok, `HTTP ${res.status} from ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function waitForPageTarget(port) {
  const deadline = Date.now() + 10000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`, 1000);
      const page = targets.find(t => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch (err) {
      lastError = err.message;
    }
    await sleep(120);
  }
  throw new Error(`Timed out waiting for Chrome DevTools page target${lastError ? `: ${lastError}` : ""}`);
}

function createCdpClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const eventWaiters = [];
    const openTimer = setTimeout(() => reject(new Error("Timed out opening DevTools websocket")), 8000);

    ws.addEventListener("open", () => {
      clearTimeout(openTimer);
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { res, rej, method }));
        },
        waitEvent(method, timeoutMs = 5000) {
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              const idx = eventWaiters.findIndex(w => w.res === res);
              if (idx >= 0) eventWaiters.splice(idx, 1);
              rej(new Error(`Timed out waiting for ${method}`));
            }, timeoutMs);
            eventWaiters.push({ method, res, rej, timer });
          });
        },
        close() {
          ws.close();
        },
      });
    });

    ws.addEventListener("message", ev => {
      const raw = typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString("utf8");
      const msg = JSON.parse(raw);
      if (msg.id && pending.has(msg.id)) {
        const task = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) task.rej(new Error(`${task.method}: ${msg.error.message}`));
        else task.res(msg.result || {});
        return;
      }
      if (msg.method) {
        for (let i = eventWaiters.length - 1; i >= 0; i--) {
          const waiter = eventWaiters[i];
          if (waiter.method === msg.method) {
            eventWaiters.splice(i, 1);
            clearTimeout(waiter.timer);
            waiter.res(msg.params || {});
          }
        }
      }
    });

    ws.addEventListener("error", err => reject(new Error(`DevTools websocket error: ${err.message || err.type || err}`)));
  });
}

async function screenshot(browser, view) {
  const profile = path.join(outDir, `.profile-${view.name}`);
  const shot = path.join(outDir, `${view.name}.png`);
  fs.mkdirSync(profile, { recursive: true });
  const port = await freePort();
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-gpu-compositing",
    "--disable-software-rasterizer",
    "--disable-accelerated-2d-canvas",
    "--disable-dev-shm-usage",
    "--force-device-scale-factor=1",
    "--hide-scrollbars",
    "--disable-background-networking",
    "--allow-file-access-from-files",
    "--no-first-run",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ];
  const proc = spawn(browser, args, { stdio: ["ignore", "pipe", "pipe"] });
  let text = "";
  proc.stdout.on("data", d => { text += d.toString(); });
  proc.stderr.on("data", d => { text += d.toString(); });
  let client;
  try {
    const wsUrl = await waitForPageTarget(port);
    client = await createCdpClient(wsUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: view.width,
      height: view.height,
      deviceScaleFactor: 1,
      mobile: view.width <= 520,
    });
    await client.send("Emulation.setTouchEmulationEnabled", { enabled: view.width <= 520 });
    const load = client.waitEvent("Page.loadEventFired", 10000).catch(() => null);
    await client.send("Page.navigate", { url: `${appUrl}?uiSmoke=${Date.now()}-${view.name}` });
    await load;
    await client.send("Runtime.evaluate", {
      expression: "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
      awaitPromise: true,
    });
    const metrics = await client.send("Runtime.evaluate", {
      expression: `(() => {
        const vw = window.innerWidth;
        const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
        const gear = document.querySelector("#btnSettings")?.getBoundingClientRect();
        const tabs = [...document.querySelectorAll("nav.tabs button")].map(b => b.getBoundingClientRect());
        return {
          vw,
          overflow,
          gear: gear && { left: gear.left, right: gear.right, width: gear.width },
          tabs: tabs.map(t => ({ left: t.left, right: t.right, width: t.width })),
        };
      })()`,
      returnByValue: true,
    });
    const value = metrics.result.value;
    assert(value.overflow <= 1, `${view.name} has horizontal overflow: ${JSON.stringify(value)}`);
    assert(value.gear && value.gear.left >= 0 && value.gear.right <= value.vw + 1, `${view.name} settings button is clipped: ${JSON.stringify(value.gear)}`);
    assert(value.tabs.length === 4 && value.tabs.every(t => t.left >= -1 && t.right <= value.vw + 1 && t.width > 44), `${view.name} tab bar is clipped: ${JSON.stringify(value.tabs)}`);
    const capture = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    fs.writeFileSync(shot, Buffer.from(capture.data, "base64"));
    assert(fs.existsSync(shot), `Screenshot was not created: ${shot}`);
    const size = pngSize(shot);
    assert(size.width === view.width && size.height === view.height, `Unexpected screenshot size for ${view.name}: ${size.width}x${size.height}`);
    assert(size.bytes > 12000, `Screenshot too small for ${view.name}: ${size.bytes} bytes`);
    return { file: shot, ...size };
  } finally {
    if (client) client.close();
    await stopProcess(proc);
    const full = ensureInsideRoot(profile);
    await rmDirWithRetry(full);
  }
}

async function main() {
  cleanDir(outDir);
  staticUiChecks();
  const browser = findBrowser();
  const views = [
    { name: "iphone-390", width: 390, height: 844 },
    { name: "small-360", width: 360, height: 780 },
    { name: "desktop-1280", width: 1280, height: 800 },
  ];
  const shots = [];
  for (const view of views) {
    shots.push(await screenshot(browser, view));
  }
  console.log(`UI smoke checks OK (${path.basename(browser)})`);
  shots.forEach(s => console.log(`${path.relative(root, s.file)} ${s.width}x${s.height} ${s.bytes} bytes`));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
