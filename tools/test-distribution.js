"use strict";

const cp = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
cp.execFileSync(process.execPath, [path.join(__dirname, "build-native-web.js")], {
  stdio: "inherit",
});
// Never reuse a source server when validating generated distribution assets.
const child = cp.spawn(
  process.execPath,
  [require.resolve("@playwright/test/cli"), "test", ...process.argv.slice(2)],
  {
    cwd: root,
    env: { ...process.env, E2E_DISTRIBUTION: "1", CI: "1" },
    stdio: "inherit",
    windowsHide: true,
  },
);
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
