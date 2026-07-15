/*
 * check-globals.js — 未定義のクロスファイル参照を静的に検出する。
 *
 * 背景: eslint.config.mjs は scripts/** の no-undef を無効化している
 * （各ファイルがグローバル前提で連結される構成のため）。このチェックは
 * index.html のロード順で scripts/*.js を連結して 1 スクリプトとして解析し、
 * どのファイルのトップレベル宣言（function/const/let/var/class）にも
 * ブラウザ/DOM グローバルにも解決できない識別子参照を fail として報告する。
 * 関数名のタイポや削除済み関数の呼び出しを実行前に検知するのが目的。
 *
 * 実装: espree で AST を作り eslint-scope でスコープ解析する（どちらも
 * eslint 本体の依存として node_modules に常在。dependencies 追加なし）。
 *
 * 検出の限界（このチェックが「見ない」もの）:
 * - eval / new Function の文字列内コード
 * - 動的プロパティアクセス（window["na"+"me"] など）と文字列内の識別子
 * - onclick="..." など index.html 側インライン属性からの参照
 * - 存在しないグローバルへの「代入」（暗黙のグローバル定義として許容される。
 *   sloppy mode ではエラーにならず変数が生えるため。読み取りのみ検出対象）
 * - typeof ガード付き参照（typeof Foo !== "undefined" は未定義でも安全）
 * - 引数の数・型の不一致（識別子の解決可否のみを見る）
 */
const fs = require("fs");
const path = require("path");
const espree = require("espree");
const eslintScope = require("eslint-scope");

const root = path.resolve(__dirname, "..");

/*
 * ブラウザ/DOM/JS 標準グローバルの許可リスト。
 * scripts/*.js が新しいブラウザ API を使い始めてここで fail したら、
 * 本物のグローバルであることを確認してから 1 行追加する。
 */
const BROWSER_GLOBALS = new Set([
  // JS 言語コア
  "globalThis",
  "undefined",
  "NaN",
  "Infinity",
  "Object",
  "Array",
  "String",
  "Number",
  "Boolean",
  "Math",
  "Date",
  "JSON",
  "RegExp",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Promise",
  "Symbol",
  "Proxy",
  "Reflect",
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "Function",
  "parseFloat",
  "parseInt",
  "isNaN",
  "isFinite",
  "encodeURIComponent",
  "decodeURIComponent",
  "structuredClone",
  "Intl",
  "ArrayBuffer",
  "Uint8Array",
  // ブラウザ / DOM
  "window",
  "document",
  "navigator",
  "location",
  "history",
  "screen",
  "console",
  "alert",
  "confirm",
  "prompt",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "caches",
  "fetch",
  "Request",
  "Response",
  "Headers",
  "AbortController",
  "URL",
  "URLSearchParams",
  "Blob",
  "File",
  "MediaRecorder",
  "FileReader",
  "FormData",
  "Image",
  "Audio",
  "Event",
  "CustomEvent",
  "KeyboardEvent",
  "MouseEvent",
  "PointerEvent",
  "TouchEvent",
  "Node",
  "Element",
  "HTMLElement",
  "SVGElement",
  "DOMParser",
  "DOMPoint",
  "XMLSerializer",
  "MutationObserver",
  "ResizeObserver",
  "IntersectionObserver",
  "matchMedia",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "queueMicrotask",
  "atob",
  "btoa",
  "crypto",
  "performance",
  "devicePixelRatio",
  "innerWidth",
  "innerHeight",
  "scrollTo",
  "open",
  "close",
  "addEventListener",
  "removeEventListener",
  "dispatchEvent",
  "TextEncoder",
  "TextDecoder",
  "Notification",
  "visualViewport",
  "CSS",
  "Capacitor",
]);

function fail(msg) {
  console.error(`check-globals: ${msg}`);
  process.exitCode = 1;
}

/* index.html のロード順を正とする（check-app.js と同じ扱い） */
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appScripts = [
  ...html.matchAll(/<script\b[^>]*\bsrc="(scripts\/[^"]+)"[^>]*><\/script>/g),
].map((m) => m[1]);
if (appScripts.length === 0) throw new Error("No scripts found in index.html");

/* sw.js の APP_SCRIPTS と一致していること（順序含む）を確認 */
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const swList = /const APP_SCRIPTS = \[([\s\S]*?)\]/.exec(sw);
const swScripts = swList ? [...swList[1].matchAll(/"\.\/(scripts\/[^"]+)"/g)].map((m) => m[1]) : [];
if (swScripts.join(",") !== appScripts.join(",")) {
  fail(
    `index.html と sw.js APP_SCRIPTS のスクリプト一覧が一致しません\n  index.html: ${appScripts.join(", ")}\n  sw.js:      ${swScripts.join(", ")}`,
  );
  process.exit(1); // 前提が崩れているので以降の解析（と "OK" 出力）を行わない
}

/* ロード順に連結（連結後の行番号 → 元ファイル/行 のマップを作る） */
const chunks = [];
const lineMap = []; // lineMap[combinedLine - 1] = {file, line}
for (const file of appScripts) {
  const src = fs.readFileSync(path.join(root, file), "utf8");
  chunks.push(src);
  const lines = src.split("\n").length;
  for (let i = 1; i <= lines; i++) lineMap.push({ file, line: i });
}
const combined = chunks.join("\n");

const ast = espree.parse(combined, {
  ecmaVersion: "latest",
  sourceType: "script",
  loc: true,
  range: true,
});
const scopeManager = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: "script" });
const globalScope = scopeManager.globalScope;

/*
 * typeof ガード付き識別子（typeof Foo）は未定義でも ReferenceError に
 * ならないため除外する。AST を歩いて該当 Identifier の range を集める。
 */
const typeofGuarded = new Set();
(function walk(node) {
  if (!node || typeof node.type !== "string") return;
  if (
    node.type === "UnaryExpression" &&
    node.operator === "typeof" &&
    node.argument.type === "Identifier"
  ) {
    typeofGuarded.add(node.argument.range[0]);
  }
  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach(walk);
    else if (child && typeof child.type === "string") walk(child);
  }
})(ast);

/*
 * 暗黙のグローバル（宣言なしで `foo = ...` と代入されて生える変数）は
 * 定義済み扱いにする。読み取り時点で ReferenceError にならないため。
 */
const implicitGlobals = new Set(globalScope.implicit.variables.map((v) => v.name));

/* globalScope.through = どのスコープの宣言にも解決できなかった参照 */
const problems = [];
for (const ref of globalScope.through) {
  const name = ref.identifier.name;
  if (BROWSER_GLOBALS.has(name)) continue;
  if (implicitGlobals.has(name)) continue;
  if (!ref.isRead()) continue; // 書き込みのみ = 暗黙のグローバル定義
  if (typeofGuarded.has(ref.identifier.range[0])) continue;
  const loc = lineMap[ref.identifier.loc.start.line - 1];
  problems.push({ name, file: loc.file, line: loc.line });
}

if (problems.length > 0) {
  const byName = new Map();
  for (const p of problems) {
    if (!byName.has(p.name)) byName.set(p.name, []);
    byName.get(p.name).push(`${p.file}:${p.line}`);
  }
  fail(`未定義の参照が ${byName.size} 件あります（宣言にもブラウザグローバルにも解決できません）`);
  for (const [name, sites] of byName) {
    console.error(`  ${name}  →  ${sites.join(", ")}`);
  }
  console.error(
    "  本物のブラウザ API なら tools/check-globals.js の BROWSER_GLOBALS に追加してください。",
  );
} else {
  console.log(
    `check-globals OK (${appScripts.length} files, ${globalScope.through.length} unresolved refs all accounted for)`,
  );
}
