"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const baseline = JSON.parse(read("docs/codex/evidence/personal-best-v112/baseline-functions.json"));
const tr = new Function(
  read("scripts/49-todays-result.js") + "\nreturn computePersonalBestDistance;",
)();
const view = read("scripts/50-record-view.js");
const row = view.slice(
  view.indexOf("function todaysResultRowHtml("),
  view.indexOf("/* 安定性行の任意スパークライン"),
);
const pb = view.slice(
  view.indexOf("function todaysResultPersonalBestRowHtml("),
  view.indexOf("/* 項目4:"),
);
const render = new Function(
  "distanceLabel",
  "fmtD",
  "icon",
  row + pb + "return todaysResultPersonalBestRowHtml;",
)(
  (d) => d + "m",
  (d) => d,
  () => "<target>",
);
let checks = 0;
for (const fixture of baseline.rows) {
  const before = JSON.stringify(fixture.sessions);
  const result = tr(fixture.sessions, fixture.current.id);
  assert.deepEqual(result, fixture.pb, "PB computation unchanged");
  const html = render(result, fixture.current, fixture.dayLabel);
  if (result.method === "exact-count")
    assert.equal(html, fixture.html, "same-count HTML unchanged");
  else {
    assert(
      html.includes("自己ベストの換算値"),
      fixture.relation + ": projected comparison must say converted value",
    );
    assert(
      html.includes("推定・1本換算"),
      fixture.relation + ": method/count note remains visible",
    );
    assert(!html.includes("<b>更新</b>"), "projection is not an actual total-record update");
    if (fixture.relation === "above") assert(html.includes("上回りました"));
    if (fixture.relation === "tie") assert(html.includes("並びました"));
    if (fixture.relation === "below") assert(html.includes("あと2点"));
  }
  assert(html.includes(fixture.dayLabel + " " + result.todayTotal + "点"));
  assert(html.includes(result.bestDate));
  assert.equal(JSON.stringify(fixture.sessions), before, "non-mutating calculation/render");
  checks++;
}
const fixture = baseline.rows.find((r) => r.n === 1 && r.relation === "below");
const close = { ...fixture.pb, pace: "close" };
assert(render(close, fixture.current, "今日").includes("ペースは近い"));
assert(render(close, fixture.current, "今日").includes("推定・1本換算"));
console.log(
  `Personal best copy checks OK (${checks} real computed cases; exact-count HTML/calculation preserved; projection and pace notes)`,
);
