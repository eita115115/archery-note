"use strict";

const fs = require("fs");
const path = require("path");
const CleanCSS = require("clean-css");

const root = path.resolve(__dirname, "..");
const input = fs.readFileSync(path.join(root, "style.css"), "utf8");
const result = new CleanCSS({ level: 2 }).minify(input);

if (result.errors.length) throw new Error(`CSS minification failed: ${result.errors.join("; ")}`);

fs.writeFileSync(path.join(root, "style.min.css"), `${result.styles}\n`);
console.log(`Web assets ready: style.min.css (${Buffer.byteLength(result.styles)} bytes)`);
