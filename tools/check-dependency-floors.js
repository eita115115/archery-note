"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { checkDependencyFloors, readPackageLock } = require("./dependency-floor");

const lock = readPackageLock(path.join(__dirname, "..", "package-lock.json"));
const result = checkDependencyFloors(lock, {
  "ip-address": "10.3.1",
  tar: "7.5.18",
  "brace-expansion": "5.0.7",
});

assert.equal(result.ok, true, result.errors.join("; "));
assert.deepEqual(result.checked.sort(), ["brace-expansion", "ip-address", "tar"]);

const belowFloor = checkDependencyFloors(
  { packages: { "node_modules/tar": { version: "7.5.17" } } },
  { tar: "7.5.18" },
);
assert.equal(belowFloor.ok, false);
assert.match(belowFloor.errors[0], /below 7\.5\.18/);

const nestedBelowFloor = checkDependencyFloors(
  {
    packages: {
      "node_modules/ip-address": { version: "10.4.0" },
      "node_modules/example/node_modules/ip-address": { version: "10.2.0" },
    },
  },
  { "ip-address": "10.3.1" },
);
assert.equal(nestedBelowFloor.ok, false);
assert.match(nestedBelowFloor.errors[0], /node_modules\/example\/node_modules\/ip-address/);

const malformed = checkDependencyFloors(
  { packages: { "node_modules/tar": { version: "7.5" } } },
  { tar: "7.5.18" },
);
assert.equal(malformed.ok, false);
assert.match(malformed.errors[0], /invalid version/);

console.log("Dependency floor checks OK");
