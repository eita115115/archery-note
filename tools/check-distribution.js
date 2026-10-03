"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const vm = require("node:vm");
const zlib = require("node:zlib");
const espree = require("espree");
const root = path.resolve(__dirname, "..");

function structure(value, tagged = false) {
  if (Array.isArray(value)) return value.map((item) => structure(item, tagged));
  if (value && typeof value === "object") {
    // Terser's printer uses expression arrows for a sole return (even without compress).
    if (
      value.type === "ArrowFunctionExpression" &&
      value.body.type === "BlockStatement" &&
      value.body.body.length === 1 &&
      value.body.body[0].type === "ReturnStatement"
    ) {
      const argument = value.body.body[0].argument;
      return structure(
        { ...value, expression: !!argument, body: argument || { ...value.body, body: [] } },
        tagged,
      );
    }
    // Untagged template raw text is not observable; tagged templates must retain it.
    if (value.type === "TemplateElement" && !tagged) {
      return structure({ ...value, value: { cooked: value.value.cooked } }, true);
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !["start", "end"].includes(key) && !(key === "raw" && value.type === "Literal"),
        )
        .map(([key, item]) => [
          key,
          structure(item, tagged || (value.type === "TaggedTemplateExpression" && key === "quasi")),
        ]),
    );
  }
  return value;
}

async function main() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script\b[^>]*src="(scripts\/[^"]+\.js)"[^>]*>/g)].map(
    (match) => match[1],
  );
  assert.equal(scripts.length, 14);
  const sources = scripts.map((file) => fs.readFileSync(path.join(root, file), "utf8"));
  cp.execFileSync(process.execPath, [path.join(__dirname, "build-native-web.js")], {
    stdio: "inherit",
  });
  let originalBytes = 0,
    deliveredBytes = 0;
  for (const [index, file] of scripts.entries()) {
    const delivered = fs.readFileSync(path.join(root, "dist/native", file), "utf8");
    assert.notEqual(delivered, sources[index], `${file}: distribution must be compact`);
    assert.deepEqual(
      structure(espree.parse(delivered, { ecmaVersion: "latest", sourceType: "script" })),
      structure(espree.parse(sources[index], { ecmaVersion: "latest", sourceType: "script" })),
      `${file}: parsed structure and names`,
    );
    assert.equal(
      fs.readFileSync(path.join(root, file), "utf8"),
      sources[index],
      `${file}: editable source preserved`,
    );
    originalBytes += zlib.gzipSync(sources[index], { level: 9 }).length;
    deliveredBytes += zlib.gzipSync(delivered, { level: 9 }).length;
  }
  assert.ok(deliveredBytes < originalBytes * 0.8, "gzip JS payload must shrink by at least20%");
  assert.equal(
    fs.readFileSync(path.join(root, "dist/native/index.html"), "utf8"),
    html,
    "script paths/order preserved",
  );
  for (const file of [
    "style.min.css",
    "manifest.json",
    "sw.js",
    "icon.svg",
    "apple-touch-icon.png",
    "version.json",
    "assets/pose/vision_bundle.mjs",
    "assets/pose/vision_wasm_internal.js",
    "assets/pose/vision_wasm_internal.wasm",
    "assets/pose/pose_landmarker_lite.task",
  ]) {
    assert.deepEqual(
      fs.readFileSync(path.join(root, "dist/native", file)),
      fs.readFileSync(path.join(root, file)),
      file,
    );
  }
  const { compactScript } = require("./compact-script.js");
  for (const [index, file] of scripts.entries())
    assert.equal(
      await compactScript(sources[index]),
      fs.readFileSync(path.join(root, "dist/native", file), "utf8"),
      `${file}: deterministic regeneration`,
    );
  const fixtures = [
    '"use strict";\nconst sharedName = 7;\nfunction scoreName(value) { return value + sharedName; }\n',
    '/* comment */\nconst exactText = `矢 ${scoreName(2)}\\n`;\nconst tagged = (strings) => strings.raw[0];\nconst rawText = tagged`\\n`;\nfunction asi() { return\n /x/.test("x"); }\nconst printerReturn=()=>{ return (scoreName(1),scoreName(4)); };\nconst emptyReturn=()=>{return;};\nconst pattern = /[\\/]/;\nglobalThis.result = [scoreName(3), exactText, rawText, asi(), pattern.test("/"), printerReturn(), emptyReturn()];\n',
  ];
  const run = (chunks) => {
    const context = vm.createContext({});
    chunks.forEach((chunk) => vm.runInContext(chunk, context));
    return JSON.stringify(context.result);
  };
  const compact = await Promise.all(fixtures.map(compactScript));
  assert.equal(run(compact), run(fixtures), "cross-script globals/ASI/regex/template runtime");
  console.log(
    `Distribution checks passed:14 structures/names/order/source/regeneration; gzip JS ${originalBytes}→${deliveredBytes} bytes; cross-script fixtures`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
