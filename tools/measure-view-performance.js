"use strict";
/* global db: writable, robustStats: writable, blankDb, render, showView */
/* Synthetic records only, in a fresh Playwright context. Timings include synchronous
   view rendering and forced layout, not network or subsequent paint. */
const { chromium } = require("@playwright/test");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch();
  const results = [];
  const output = process.argv[2] || "artifacts/performance/views.json";
  fs.mkdirSync(require("path").dirname(output), { recursive: true });
  try {
    for (const count of [100, 1000]) {
      const context = await browser.newContext({
        viewport: { width: 375, height: 812 },
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      await page.goto(process.env.BENCH_URL || "http://127.0.0.1:4175");
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.evaluate((count) => {
        db = blankDb();
        db.settings.onboardingSeen = true;
        db.settings.activeGuideSeen = true;
        db.sessions = Array.from({ length: count }, (_, i) => ({
          id: "synthetic-" + i,
          date: new Date(Date.UTC(2026, 8, 28) - i * 86400000).toISOString().slice(0, 10),
          dist: i % 2 ? 70 : 30,
          faceD: 122,
          faceType: "single",
          round: "free",
          perEnd: 6,
          setupId: "",
          ends: Array.from({ length: 6 }, (_, e) =>
            Array.from({ length: 6 }, (_, a) => ({
              x: (((i + a * 7 + e * 3) % 21) - 10) / 2,
              y: (((i + a * 3 + e * 7) % 19) - 9) / 2,
              s: 9,
              X: false,
            })),
          ),
        }));
        render();
      }, count);
      const timings = await page.evaluate(() => {
        const rows = [];
        const original = robustStats;
        let calls = 0;
        robustStats = function (...args) {
          calls++;
          return original(...args);
        };
        for (let run = 0; run < 4; run++)
          for (const target of ["history", "analysis", "record"]) {
            calls = 0;
            const start = performance.now();
            showView(target);
            rows.push({
              run,
              target,
              ms: Math.round((performance.now() - start) * 10) / 10,
              robustCalls: calls,
            });
          }
        robustStats = original;
        return rows;
      });
      results.push({ sessions: count, timings });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(output, JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
