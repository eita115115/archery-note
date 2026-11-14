"use strict";
/* scripts/44-form-analyze.js（アプリのスクリプト。モジュールではない）を Node から読むための薄い入口。
   検査（tools/check-form-analyze.js）とベンチマークの橋渡し（tools/form-bench/adapters/v2-analyzer.js）が使う。 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "scripts", "44-form-analyze.js");
const source = fs.readFileSync(file, "utf8");
module.exports = new Function(`${source}\nreturn FormAnalyze;`)();
