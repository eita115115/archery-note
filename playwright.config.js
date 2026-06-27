"use strict";

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    screenshot: "off",
    trace: "off",
    video: "off",
    viewport: {
      height: 844,
      width: 390,
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command: "node tools/e2e-server.js",
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
    url: "http://127.0.0.1:4173",
  },
});
