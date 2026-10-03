"use strict";

const { minify } = require("terser");

// Classic scripts share globals. Only print compactly; never rename or optimize logic.
async function compactScript(source) {
  const result = await minify(source, {
    compress: false,
    mangle: false,
    module: false,
    keep_fnames: true,
    keep_classnames: true,
    format: { comments: "some", ecma: 2020 },
  });
  if (typeof result.code !== "string" || !result.code.trim()) {
    throw new Error("JavaScript compaction produced no code");
  }
  return `${result.code}\n`;
}

module.exports = { compactScript };
