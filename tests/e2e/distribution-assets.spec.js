"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

test("form assets are available unchanged without loading them at startup", async ({
  page,
  request,
}) => {
  const requests = [],
    errors = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.includes("/assets/pose/")) requests.push(req.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("section.onboard")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);
  for (const [file, mime] of [
    ["vision_bundle.mjs", "text/javascript"],
    ["vision_wasm_internal.js", "text/javascript"],
    ["vision_wasm_internal.wasm", "application/wasm"],
    ["pose_landmarker_lite.task", "application/octet-stream"],
  ]) {
    const asset = `assets/pose/${file}`;
    const response = await request.get(`/${asset}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(mime);
    const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
    expect(hash(await response.body())).toBe(
      hash(fs.readFileSync(path.resolve(__dirname, "../..", asset))),
    );
  }
  expect(errors).toEqual([]);
});
