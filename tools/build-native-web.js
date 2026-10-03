const fs = require("fs");
const path = require("path");
const { compactScript } = require("./compact-script.js");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist", "native");
const appScripts = [
  "scripts/00-compat.js",
  "scripts/10-storage-native.js",
  "scripts/20-scoring.js",
  "scripts/30-target-svg.js",
  "scripts/40-analysis-physics.js",
  "scripts/45-analysis-core.js",
  "scripts/46-form-core.js",
  "scripts/47-form-view.js",
  "scripts/48-gamification.js",
  "scripts/49-todays-result.js",
  "scripts/50-record-view.js",
  "scripts/60-history-sight-view.js",
  "scripts/70-gear-settings.js",
  "scripts/90-init.js",
];
const files = [
  "index.html",
  "style.min.css",
  ...appScripts,
  "manifest.json",
  "sw.js",
  "icon.svg",
  "apple-touch-icon.png",
  "version.json",
  // Existing lazily loaded form runtime/model; copied unchanged, never preloaded.
  "assets/pose/vision_bundle.mjs",
  "assets/pose/vision_wasm_internal.js",
  "assets/pose/vision_wasm_internal.wasm",
  "assets/pose/pose_landmarker_lite.task",
];

function assertInsideRoot(target) {
  const full = path.resolve(target);
  if (!(full === root || full.startsWith(root + path.sep))) {
    throw new Error(`Refusing to write outside project: ${full}`);
  }
  return full;
}

function readVersion() {
  const appJs = fs.readFileSync(path.join(root, "scripts", "10-storage-native.js"), "utf8");
  const appVer = /const APP_VER=(\d+)/.exec(appJs)?.[1];
  const jsonVer = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).v;
  if (!appVer || +appVer !== +jsonVer) {
    throw new Error(`Version mismatch before native build: app=${appVer} json=${jsonVer}`);
  }
  return +appVer;
}

async function main() {
  const version = readVersion();
  assertInsideRoot(outDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const file of files) {
    const src = path.join(root, file);
    if (!fs.existsSync(src)) throw new Error(`Missing native asset: ${file}`);
    const dest = path.join(outDir, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (file === "index.html") {
      let html = fs.readFileSync(src, "utf8");
      // Existing pages only refresh the document URL. Release-specific URLs also
      // bypass their still-fresh HTTP script/CSS entries on the first navigation.
      for (const asset of [...appScripts, "style.min.css"]) {
        const attr = asset.endsWith(".css") ? "href" : "src";
        const reference = `${attr}="${asset}"`;
        if (!html.includes(reference)) throw new Error(`Missing release asset: ${asset}`);
        html = html.replace(reference, `${attr}="${asset}?v=${version}"`);
      }
      fs.writeFileSync(dest, html);
    } else if (appScripts.includes(file)) {
      fs.writeFileSync(dest, await compactScript(fs.readFileSync(src, "utf8")));
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  fs.writeFileSync(
    path.join(outDir, "native-readiness.json"),
    JSON.stringify({
      app: "Archery Note",
      version,
      generatedAt: new Date().toISOString(),
      runtime: "capacitor-web-assets",
      notes: [
        "Web assets are isolated for Capacitor webDir.",
        "Native storage and platform plugins can be added without changing scoring data shape.",
        "The PWA remains the fastest preview and fallback channel.",
      ],
    }, null, 2) + "\n"
  );

  console.log(`Native web assets ready: ${path.relative(root, outDir)} (v${version})`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
