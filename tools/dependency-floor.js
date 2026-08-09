"use strict";

const fs = require("node:fs");

function parseVersion(version) {
  if (typeof version !== "string") return null;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function readPackageLock(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!parsed || typeof parsed !== "object" || !parsed.packages) {
    throw new Error("package-lock.json must contain a packages object");
  }
  return parsed;
}

function packageEntryNames(packages, name) {
  const prefix = `node_modules/${name}`;
  return Object.keys(packages).filter(
    (entry) => entry === prefix || entry.endsWith(`/node_modules/${name}`),
  );
}

function checkDependencyFloors(lock, floors) {
  const packages = lock && lock.packages;
  const errors = [];
  const checked = [];
  if (!packages || typeof packages !== "object") {
    return { ok: false, errors: ["package-lock packages object is missing"], checked };
  }

  for (const [name, minimum] of Object.entries(floors || {})) {
    const minimumParsed = parseVersion(minimum);
    if (!minimumParsed) {
      errors.push(`${name}: invalid minimum version ${minimum}`);
      continue;
    }
    const entries = packageEntryNames(packages, name);
    if (entries.length === 0) {
      errors.push(`${name}: package-lock entry is missing`);
      continue;
    }
    checked.push(name);
    for (const entry of entries) {
      const actual = packages[entry] && packages[entry].version;
      const comparison = compareVersions(actual, minimum);
      if (comparison === null) {
        errors.push(`${name}: ${entry} has an invalid version ${actual}`);
      } else if (comparison < 0) {
        errors.push(`${name}: ${entry} is ${actual}, below ${minimum}`);
      }
    }
  }
  return { ok: errors.length === 0, errors, checked };
}

module.exports = { checkDependencyFloors, compareVersions, parseVersion, readPackageLock };
