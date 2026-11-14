"use strict";
/* scripts/44-form-record.js（アプリのスクリプト。モジュールではない）を Node から読むための薄い入口。
   検査（tools/check-form-record.js）と e2e の合成データ作り（tests/e2e/fixtures/form-v2-stream.js）が使う。 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "scripts", "44-form-record.js");
const source = fs.readFileSync(file, "utf8");
module.exports = new Function(`${source}\nreturn FormV2;`)();
