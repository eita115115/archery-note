// Historical AN-046 regression: run from the repository root with existing Playwright installed.
// Serves immutable commits to fresh synthetic contexts; never contacts the deployed app.
const http = require("node:http"),
  cp = require("node:child_process"),
  path = require("node:path"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { chromium, webkit, expect } = require("@playwright/test");
const baseline = "97945e17dd1529a527be5f0750372378818b2a57";
const candidate = "a877c4337cfcae4e4b9da52058a44c1ca8c58a6f";

const prefix = "/archery-note/";
const output = "artifacts/offline-update-diagnosis/regression";
fs.mkdirSync(output, { recursive: true });
const types = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const rows = [];
// This deliberately demonstrates why an async predicate is not a polling loop.
async function verifyWaitSeam(page) {
  await page.evaluate(() => {
    window.workerWaitProbe = { calls: 0 };
  });
  const result = await (
    await page.waitForFunction(
      async () => {
        window.workerWaitProbe.calls++;
        return false;
      },
      {},
      { timeout: 1000 },
    )
  ).jsonValue();
  assert.equal(result, false);
  assert.equal(await page.evaluate(() => window.workerWaitProbe.calls), 1);
  await expect
    .poll(() => page.evaluate(async () => ++window.workerWaitProbe.calls >= 4))
    .toBe(true);
  assert.equal(await page.evaluate(() => window.workerWaitProbe.calls), 4);
  await page.evaluate(() => delete window.workerWaitProbe);
  console.log(
    "PASS: async waitForFunction returns false after one call; expect.poll waits for true across three calls",
  );
}
async function visibleControl(control) {
  await control.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const v = await control.evaluate((e) => {
    const r = e.getBoundingClientRect(),
      h = document.querySelector("header.app").getBoundingClientRect(),
      n = document.querySelector("#tabs").getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, header: Math.max(0, h.bottom), nav: n.top };
  });
  assert.ok(v.top >= v.header + 4 && v.bottom <= v.nav - 4, JSON.stringify(v));
}

function practiceData(d) {
  return {
    sessions: d.sessions,
    active: d.active,
    setups: d.setups,
    sightMarks: d.sightMarks,
    customRounds: d.customRounds,
  };
}
(async () => {
  for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch();
    try {
      for (const width of [320, 375]) {
        console.log("START active route", engineName, width);
        let revision = baseline;
        const server = http.createServer((req, res) => {
          const pathname = new URL(req.url, "http://localhost").pathname;
          if (!pathname.startsWith(prefix)) {
            res.writeHead(404);
            res.end();
            return;
          }
          const name = pathname.slice(prefix.length) || "index.html";
          if (name.includes("..")) {
            res.writeHead(400);
            res.end();
            return;
          }
          try {
            const body = cp.execFileSync("git", ["show", revision + ":" + name], {
              maxBuffer: 20 * 1024 * 1024,
              stdio: ["ignore", "pipe", "ignore"],
            });
            res.writeHead(200, {
              "Content-Type": types[path.extname(name)] || "application/octet-stream",
              "Cache-Control": "no-store",
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
          viewport: { width, height: width === 320 ? 568 : 812 },
        });
        const page = await context.newPage();
        await page.emulateMedia({
          colorScheme: width === 375 ? "dark" : "light",
          reducedMotion: "reduce",
        });
        const errors = [];
        const pending = new Set();
        page.on("request", (r) => pending.add(r.url()));
        page.on("requestfinished", (r) => pending.delete(r.url()));
        page.on("requestfailed", (r) => {
          pending.delete(r.url());
          console.log("requestfailed", r.url(), r.failure()?.errorText);
        });
        page.on("pageerror", (e) => errors.push(e.message));
        try {
          await page.goto(base);
          await verifyWaitSeam(page);
          await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
          await expect
            .poll(
              () =>
                page.evaluate(
                  async () => !!(await navigator.serviceWorker.getRegistration())?.active,
                ),
              { timeout: 15000 },
            )
            .toBe(true);
          await page.reload();
          await page.waitForFunction(() => !!navigator.serviceWorker.controller);
          assert.equal(await page.evaluate(() => APP_VER), 95);
          await page.evaluate(() => {
            const base = db.sessions[0];
            for (let stage = 0; stage < 2; stage++)
              db.sessions.push({
                ...base,
                id: "transition-stage-" + stage,
                round: "wa1440_men",
                dist: stage ? 70 : 90,
                roundGroup: {
                  gid: "transition-round",
                  roundId: "wa1440_men",
                  stage,
                  stageCount: 4,
                },
                ends: [[{ ...base.ends[0][0], s: stage ? 9 : 10, X: false }]],
              });
            save({ reason: "synthetic-transition-fixture" });
            render();
          });
          await page.locator('#tabs [data-v="record"]').click();
          await page.locator("#quickStart").click();
          await page.locator("#tgsvg").click();
          await expect
            .poll(() =>
              page.evaluate(
                () => JSON.parse(localStorage.getItem("archeryNote.v1")).active.cur.length,
              ),
            )
            .toBe(1);
          const beforeTrend = await page.evaluate(() => scoreTrendCard(db.sessions));
          const before = practiceData(
            await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1"))),
          );
          assert.equal(before.active.cur.length, 1);
          assert.equal(before.sessions.length, 5);
          revision = candidate;
          await page.evaluate(() => checkUpdate());
          await page.waitForFunction(() => updateAvailable);
          await expect(page.locator("#updBar")).toBeHidden();
          const heldLocation = page.url();
          await page.evaluate(() => freshReload());
          await page.evaluate(
            () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
          );
          assert.equal(page.url(), heldLocation);
          assert.equal(await page.evaluate(() => APP_VER), 95);
          assert.deepEqual(
            practiceData(
              await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1"))),
            ),
            before,
          );
          await page.screenshot({
            path: `artifacts/offline-update-diagnosis/regression/active-active-guard-${engineName}-${width}.png`,
            animations: "disabled",
          });
          await page.evaluate(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration) throw Error("No real worker registration");
            await registration.update();
          });
          await expect
            .poll(
              () =>
                page.evaluate(async () => {
                  const registration = await navigator.serviceWorker.getRegistration();
                  const keys = await caches.keys();
                  return (
                    keys.includes("archery-note-v96") &&
                    !keys.includes("archery-note-v95") &&
                    registration?.active?.state === "activated" &&
                    navigator.serviceWorker.controller === registration.active
                  );
                }),
              { timeout: 15000 },
            )
            .toBe(true);
          const browserReload = await page.reload({ timeout: 15000 });
          assert.equal(browserReload.fromServiceWorker(), true);
          await page.waitForFunction(() => APP_VER === 96);
          assert.deepEqual(
            practiceData(
              await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1"))),
            ),
            before,
          );
          assert.equal(await page.evaluate(() => scoreTrendCard(db.sessions)), beforeTrend);
          await page.getByTestId("active-target").waitFor();

          await page.locator('#tabs [data-v="analysis"]').click();
          const setup = page.getByRole("combobox", { name: "用具", exact: true }),
            distance = page.getByRole("combobox", { name: "距離", exact: true });
          await expect(setup).toHaveCount(1);
          await expect(distance).toHaveCount(1);
          await distance.focus();
          await distance.selectOption("70");
          await expect(distance).toBeFocused();
          await visibleControl(distance);
          await expect(distance).toHaveValue("70");
          await distance.selectOption("");
          await expect(distance).toBeFocused();
          await visibleControl(distance);
          await setup.focus();
          await setup.selectOption("__none");
          await expect(setup).toBeFocused();
          await visibleControl(setup);
          await setup.selectOption("");
          await expect(setup).toBeFocused();
          await visibleControl(setup);
          assert.deepEqual(
            practiceData(
              await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1"))),
            ),
            before,
          );
          await page.screenshot({
            path:
              "artifacts/offline-update-diagnosis/regression/active-active-updated-analysis-" +
              engineName +
              "-" +
              width +
              ".png",
            animations: "disabled",
          });
          await page.locator('#tabs [data-v="history"]').click();
          const group = page.getByTestId("history-round");
          await expect(group.locator("summary")).toContainText("2/4ステージ");
          await expect(group.locator(".historyRoundTotal")).toHaveText("19合計");
          await group.locator("summary").click();
          await expect(group.getByTestId("history-row")).toHaveCount(2);
          await page.locator('#tabs [data-v="record"]').click();
          await page.locator("#tgsvg").click();
          await expect
            .poll(() =>
              page.evaluate(
                () => JSON.parse(localStorage.getItem("archeryNote.v1")).active.cur.length,
              ),
            )
            .toBe(2);
          const inProgress = practiceData(
            await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1"))),
          );
          assert.deepEqual(inProgress.sessions, before.sessions);
          await new Promise((resolve) => {
            server.close(resolve);
            server.closeAllConnections();
          });
          let refused = false;
          try {
            await context.request.get(base, { timeout: 1500 });
          } catch (e) {
            refused = e.message.includes("ECONNREFUSED");
          }
          assert.equal(refused, true, "origin transport really unavailable");
          const response = await page.reload({ timeout: 15000 });
          assert.equal(response.fromServiceWorker(), true);
          assert.equal(await page.evaluate(() => APP_VER), 96);
          assert.deepEqual(
            practiceData(
              await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1"))),
            ),
            inProgress,
          );
          await page.getByTestId("active-target").waitFor();
          await page.locator('#tabs [data-v="history"]').click();
          await expect(page.getByTestId("history-round").locator(".historyRoundTotal")).toHaveText(
            "19合計",
          );

          await page.locator('#tabs [data-v="analysis"]').click();
          await distance.focus();
          await distance.selectOption("70");
          await expect(distance).toBeFocused();
          await visibleControl(distance);
          await setup.focus();
          await setup.selectOption("__none");
          await expect(setup).toBeFocused();
          await visibleControl(setup);
          assert.deepEqual(
            practiceData(
              await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1"))),
            ),
            inProgress,
          );
          assert.deepEqual(errors, []);
          rows.push({
            engine: engineName,
            width,
            baseline,
            candidate,
            from: 95,
            to: 96,
            route: "blocked-banner-registered-worker-browser-reload",
            inAppUpdateBlocked: true,
            sessions: before.sessions.length,
            preUpdateActiveArrows: before.active.cur.length,
            trendHtmlUnchanged: true,
            activeArrows: inProgress.active.cur.length,
            originRefused: true,
            fromWorker: response.fromServiceWorker(),
            errors,
          });
          console.log(
            `PASS ${engineName} ${width}px: active guard blocks in-app reload; registered-worker update + browser reload v95 → v96/cache switch; 5 synthetic records and pre-update active arrow unchanged; trend HTML identical; round subtotal19; stopped-origin offline reload keeps two active arrows/records and corrected named filter focus; no page errors`,
          );
        } catch (error) {
          console.error("DIAGNOSTIC", engineName, width, "pending", JSON.stringify([...pending]));
          try {
            console.error(
              "PAGESTATE",
              JSON.stringify(
                await Promise.race([
                  page.evaluate(async () => ({
                    version: APP_VER,
                    readyState: document.readyState,
                    url: location.href,
                    active: db.active?.cur?.length,
                    keys: await caches.keys(),
                  })),
                  new Promise((_, reject) =>
                    setTimeout(
                      () => reject(Error("bounded diagnostics: navigation context unavailable")),
                      1000,
                    ),
                  ),
                ]),
              ),
            );
          } catch (diag) {
            console.error("PAGESTATE unavailable", diag.message);
          }
          throw error;
        } finally {
          await context.close();
          if (server.listening)
            await new Promise((resolve) => {
              server.close(resolve);
              server.closeAllConnections();
            });
        }
      }
    } finally {
      await browser.close();
    }
  }
  fs.writeFileSync(
    "artifacts/offline-update-diagnosis/regression/active-active.json",
    JSON.stringify(rows, null, 2),
  );
  console.log("PASS: four immutable v95→v96 active-update/offline regressions");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
