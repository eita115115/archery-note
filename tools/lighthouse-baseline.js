"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const host = process.env.LIGHTHOUSE_HOST || "127.0.0.1";
const port = Number(process.env.LIGHTHOUSE_PORT || 4174);
const url = process.env.LIGHTHOUSE_URL || `http://${host}:${port}`;
const reportDir = path.join(rootDir, "artifacts", "lighthouse");
const reportBase = path.join(reportDir, "index");
const jsonReport = `${reportBase}.report.json`;
const htmlReport = `${reportBase}.report.html`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestLocalUrl(targetUrl) {
  return new Promise((resolve) => {
    const request = http.get(targetUrl, (response) => {
      response.resume();
      resolve(response.statusCode && response.statusCode < 500);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(targetUrl) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await requestLocalUrl(targetUrl)) return;
    await wait(250);
  }
  throw new Error(`Local server did not respond at ${targetUrl}`);
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`${command} exited with code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function formatScore(category) {
  if (!category || typeof category.score !== "number") return "n/a";
  return category.score.toFixed(2);
}

function printSummary(lhr) {
  const categories = lhr.categories || {};
  console.log("Lighthouse baseline complete");
  console.log(`URL: ${lhr.finalDisplayedUrl || lhr.finalUrl || url}`);
  console.log(`Performance: ${formatScore(categories.performance)}`);
  console.log(`Accessibility: ${formatScore(categories.accessibility)}`);
  console.log(`Best Practices: ${formatScore(categories["best-practices"])}`);
  console.log(`SEO: ${formatScore(categories.seo)}`);
  console.log(`PWA: ${formatScore(categories.pwa)}`);
  console.log(`Report: ${path.relative(rootDir, htmlReport)}`);
  console.log(`JSON: ${path.relative(rootDir, jsonReport)}`);
}

async function main() {
  fs.rmSync(reportDir, { force: true, recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });

  const server = spawn(process.execPath, [path.join("tools", "e2e-server.js")], {
    cwd: rootDir,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverOutput = "";
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk;
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk;
  });

  try {
    await waitForServer(url);

    const lighthouseCli = require.resolve("lighthouse/cli/index.js");
    try {
      await runCommand(
        process.execPath,
        [
          lighthouseCli,
          url,
          "--quiet",
          "--output=json",
          "--output=html",
          `--output-path=${reportBase}`,
          "--chrome-flags=--headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage",
        ],
        { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const errorText = `${error.message}\n${error.stderr || ""}`;
      const isCleanupError = /EPERM/i.test(errorText) && /lighthouse/i.test(errorText);
      if (!isCleanupError || !fs.existsSync(jsonReport)) {
        throw error;
      }
      console.warn("Lighthouse completed, but Chrome profile cleanup reported EPERM.");
    }

    const lhr = JSON.parse(fs.readFileSync(jsonReport, "utf8"));
    printSummary(lhr);
  } catch (error) {
    if (serverOutput.trim()) {
      console.error(serverOutput.trim());
    }
    if (error.stdout?.trim()) {
      console.error(error.stdout.trim());
    }
    if (error.stderr?.trim()) {
      console.error(error.stderr.trim());
    }
    throw error;
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
