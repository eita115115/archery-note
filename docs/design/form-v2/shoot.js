/* 試作の画面写真を撮り、文字・押せる大きさ・あふれを検査する。
   node docs/design/form-v2/shoot.js [出力先のフォルダ]（既定は docs/design/form-v2/shots）
   Playwright の Chromium が要る（この環境では /opt/pw-browsers/chromium）。 */
const path = require("path");
const fs = require("fs");
const { chromium } = require(path.join(__dirname, "../../../node_modules/playwright"));
const OUT = path.resolve(process.argv[2] || path.join(__dirname, "shots"));
const FILE = "file://" + path.join(__dirname, "prototype.html");
const screens = ["off", "home", "place", "place/far", "capture", "capture/warn", "analyzing", "result", "fix", "shot/4", "history", "video", "errors"];
const long = { home: 1, place: 1, result: 3, "shot/4": 2, history: 2, video: 1, errors: 2 };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const problems = [];
  let shots = 0;
  for (const [w, h] of [[375, 812], [320, 640]]) {
    for (const theme of ["dark", "light"]) {
      for (const s of screens) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
        const p = await ctx.newPage();
        const errs = [];
        p.on("pageerror", (e) => errs.push("pageerror " + e.message));
        p.on("console", (m) => { if (m.type() === "error") errs.push("console " + m.text()); });
        p.on("request", (r) => { if (!r.url().startsWith("file://")) errs.push("external request " + r.url()); });
        await p.goto(FILE + "?theme=" + theme + "#" + s);
        await p.waitForTimeout(120);
        const name = `${s.replace("/", "-")}-${w}-${theme}`;
        await p.screenshot({ path: path.join(OUT, name + ".png") });
        shots++;
        const pageH = await p.evaluate(() => document.documentElement.scrollHeight);
        for (let i = 1; i <= (long[s] || 0) && i * (h - 120) < pageH - 40; i++) {
          await p.evaluate((y) => window.scrollTo(0, y), i * (h - 120));
          await p.waitForTimeout(60);
          await p.screenshot({ path: path.join(OUT, `${name}-scroll${i}.png`) });
          shots++;
        }
        const bad = await p.evaluate(() => {
          const out = [], W = document.documentElement.clientWidth;
          if (document.documentElement.scrollWidth > W) out.push("page-x-scroll " + document.documentElement.scrollWidth);
          document.querySelectorAll("#app *").forEach((e) => {
            if (e.closest("svg")) return;
            const cs = getComputedStyle(e), fs = parseFloat(cs.fontSize), r = e.getBoundingClientRect();
            const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
            if (hasText && fs < 13) out.push("font<13 " + e.tagName + "." + e.className + " " + fs);
            if (r.width && (r.right > W + 0.5 || r.left < -0.5)) out.push("x-overflow " + e.tagName + "." + e.className + " " + Math.round(r.left) + "-" + Math.round(r.right));
            const tap = e.tagName === "BUTTON" || e.tagName === "SELECT" || e.tagName === "INPUT" || e.tagName === "SUMMARY";
            if (tap && r.width && (r.height < 43.5 || r.width < 43.5)) out.push("tap<44 " + e.tagName + "." + e.className + ' "' + e.textContent.trim().slice(0, 10) + '" ' + Math.round(r.width) + "x" + Math.round(r.height));
            if (e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== "visible" && e.tagName !== "SELECT" && e.tagName !== "INPUT") out.push("clipped " + e.tagName + "." + e.className + ' "' + e.textContent.trim().slice(0, 12) + '"');
          });
          document.querySelectorAll("#app svg text").forEach((t) => {
            const svg = t.ownerSVGElement, sc = svg.getBoundingClientRect().width / (svg.viewBox.baseVal.width || 1), fs = parseFloat(getComputedStyle(t).fontSize) * sc, r = t.getBoundingClientRect();
            if (fs < 12.95) out.push("svgtext<13 " + fs.toFixed(1) + " " + t.textContent);
            if (r.right > W + 0.5 || r.left < -0.5) out.push("svgtext-overflow " + t.textContent + " " + Math.round(r.left) + "-" + Math.round(r.right));
          });
          return [...new Set(out)];
        });
        for (const b of [...bad, ...errs]) problems.push(`[${s} ${w} ${theme}] ${b}`);
        await ctx.close();
      }
    }
  }
  await browser.close();
  console.log(`${shots} 枚を ${OUT} に保存`);
  console.log(problems.length ? problems.join("\n") : "検査: 13px 未満の文字、44px 未満の操作部品、横あふれ、切り取り、外部への通信、スクリプトのエラーは 0 件");
  process.exit(problems.length ? 1 : 0);
})();
