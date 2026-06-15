const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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
  assert(/<meta name="viewport"[^>]*maximum-scale=1/.test(html), "Viewport zoom guard missing");
  assert(/<nav class="tabs" id="tabs">/.test(html), "Tab bar missing");
  const tabMatches = [...html.matchAll(/<button data-v="([^"]+)">[\s\S]*?<\/button>/g)].map(m => m[1]);
  assert(tabMatches.join(",") === "record,history,sight,gear", `Unexpected tabs: ${tabMatches.join(",")}`);
  assert(html.includes("記録") && html.includes("履歴") && html.includes("サイト") && html.includes("用具"), "Tab labels missing");
  assert(/@media \(max-width:360px\)/.test(html), "Small-screen media query missing");
  assert(/\.row\{flex-direction:column;\}/.test(html), "Small-screen row stacking missing");
  assert(html.includes("データで育つ記録アプリ") && html.includes("点取りから調整提案へ") && html.includes("足りない材料を見る"), "systematic onboarding UI missing");
  assert(html.includes("判断信頼度") && html.includes("個人モデル") && html.includes("次のアクション") && html.includes("個人データ準備度") && html.includes("スパイン初期候補") && html.includes("RK4-3D") && html.includes("物理校正"), "analysis cards missing");
  assert(html.includes("シャフト銘柄") && html.includes("番手/スパイン") && html.includes("HOYT Grand Prix XCEED 2 H25"), "separated gear fields missing");
  assert(html.includes("EASTON X10 ProTour") && html.includes("SHIBUYA ULTIMA RC IV 520 Carbon") && html.includes("RAMRODS VEKTOR") && html.includes("GAS Bowstrings Ghost XV"), "expanded gear knowledge missing");
  assert(html.includes("choicePick") && html.includes("候補にないので手入力") && html.includes("確認したチューニング"), "gear dropdown/tuning UI missing");
}

function screenshot(browser, view) {
  const profile = path.join(outDir, `.profile-${view.name}`);
  const shot = path.join(outDir, `${view.name}.png`);
  fs.mkdirSync(profile, { recursive: true });
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
    `--user-data-dir=${profile}`,
    `--screenshot=${shot}`,
    `--window-size=${view.width},${view.height}`,
    `${appUrl}?uiSmoke=${Date.now()}-${view.name}`,
  ];
  const res = spawnSync(browser, args, { encoding: "utf8", timeout: 30000 });
  const text = `${res.stdout || ""}\n${res.stderr || ""}`;
  try {
    assert(!res.error, res.error && res.error.message);
    assert(res.status === 0, `Browser exited with ${res.status}\n${text}`);
    assert(fs.existsSync(shot), `Screenshot was not created: ${shot}`);
    const size = pngSize(shot);
    assert(size.width === view.width && size.height === view.height, `Unexpected screenshot size for ${view.name}: ${size.width}x${size.height}`);
    assert(size.bytes > 12000, `Screenshot too small for ${view.name}: ${size.bytes} bytes`);
    return { file: shot, ...size };
  } finally {
    const full = ensureInsideRoot(profile);
    if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
  }
}

function main() {
  cleanDir(outDir);
  staticUiChecks();
  const browser = findBrowser();
  const views = [
    { name: "iphone-390", width: 390, height: 844 },
    { name: "small-360", width: 360, height: 780 },
    { name: "desktop-1280", width: 1280, height: 800 },
  ];
  const shots = views.map(v => screenshot(browser, v));
  console.log(`UI smoke checks OK (${path.basename(browser)})`);
  shots.forEach(s => console.log(`${path.relative(root, s.file)} ${s.width}x${s.height} ${s.bytes} bytes`));
}

main();
