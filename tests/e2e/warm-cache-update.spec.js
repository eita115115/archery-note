/* global APP_VER, checkUpdate, caches */
const { test, expect } = require("@playwright/test");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

test("warm HTTP cache updates generated code and canonical offline cache together", async ({
  browser,
}) => {
  test.setTimeout(60000);
  const root = path.resolve(__dirname, "../..");
  const version = JSON.parse(fs.readFileSync(path.join(root, "version.json"))).v;
  const previous = version - 1;
  const sourceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const oldWorker = sourceWorker
    .replace(`archery-note-v${version}`, `archery-note-v${previous}`)
    .replace(
      /c\.addAll\(ASSETS\.map\(asset => new Request\(asset, \{ cache: "reload" \}\)\)\)/,
      "c.addAll(ASSETS)",
    );
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  };
  let current = false;
  const prefix = "/archery-note/";
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const name = url.pathname.slice(prefix.length) || "index.html";
    if (!url.pathname.startsWith(prefix) || name.includes("..")) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      let body = fs.readFileSync(path.join(root, current ? "dist/native" : "", name));
      if (!current && name === "sw.js") body = Buffer.from(oldWorker);
      if (!current && name === "version.json") body = Buffer.from(JSON.stringify({ v: previous }));
      if (!current && name === "scripts/10-storage-native.js")
        body = Buffer.from(
          body.toString().replace(`const APP_VER=${version};`, `const APP_VER=${previous};`),
        );
      res.writeHead(200, {
        "Content-Type": types[path.extname(name)] || "application/octet-stream",
        "Cache-Control": "public,max-age=600",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(base);
    await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    expect(await page.evaluate(() => APP_VER)).toBe(previous);
    const before = await page.evaluate(
      () => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions,
    );
    current = true;
    await page.evaluate(() => checkUpdate());
    await expect(page.locator("#updBar")).toBeVisible();
    await page.locator("#updBar").click();
    await page.waitForURL(/appv=/);
    await expect.poll(() => page.evaluate(() => APP_VER), { timeout: 10000 }).toBe(version);
    await expect
      .poll(() =>
        page.evaluate(async (version) => {
          const keys = await caches.keys();
          const cache = await caches.open(`archery-note-v${version}`);
          const response = await cache.match("./scripts/10-storage-native.js");
          return (
            keys.length === 1 && response && (await response.text()).includes(`APP_VER=${version}`)
          );
        }, version),
      )
      .toBe(true);
    await context.setOffline(true);
    const response = await page.reload();
    expect(response.fromServiceWorker()).toBe(true);
    expect(await page.evaluate(() => APP_VER)).toBe(version);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions),
    ).toEqual(before);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
});
