"use strict";
const { expect } = require("@playwright/test");
const { homeResultDb } = require("./fixtures/home-result-db");

/* 分析タブ（v5 段 7）の検査で共通に使う道具。期待値は見本データの保存値から検査の中で数える。 */
const sum = (arr) => arr.reduce((n, a) => n + a.s, 0);
const totalOf = (s) => sum(s.ends.flat());
const mean = (v) => v.reduce((t, x) => t + x, 0) / v.length;
const sd = (v) => {
  const m = mean(v);
  return Math.sqrt(v.reduce((t, x) => t + (x - m) ** 2, 0) / (v.length - 1));
};
const signed = (v, d) => {
  const r = +(+v).toFixed(d || 0);
  return r === 0 ? "±0" : (r > 0 ? "+" : "−") + Math.abs(r).toFixed(d || 0);
};
/* 小数1桁で表示した値どうしの差（画面の anDiff1 と同じ決め方） */
const diff1 = (b, a) => +(+b.toFixed(1) - +a.toFixed(1)).toFixed(1);
const md = (iso) => {
  const [, m, d] = iso.split("-");
  return `${+m}/${+d}`;
};

function formRecord(id, date, sessionId, bowArm) {
  return {
    id,
    date,
    ts: new Date(date + "T10:00:00").getTime(),
    sessionId,
    setupId: "s1",
    shots: 3,
    modelVer: "synthetic-only",
    features: [0, 1, 2].map((i) => ({
      angles: { bowArm: bowArm + i, drawArm: 140 + i },
      phase: { anchorMs: 2100 + i * 100 },
      anchorNorm: 0.1 + i * 0.01,
      release: { stable: true },
    })),
  };
}
/* 4つのタブすべてに中身が出る見本: 射型の記録3件、外れた理由の印、風の強い日2回、弓具の変更1件、メモ2件 */
function richAnalysisDb(opts) {
  const d = homeResultDb(opts);
  d.settings.formTrackingEnabled = true;
  d.formAnalyses = [
    formRecord("f1", "2026-11-10", "p6", 168),
    formRecord("f2", "2026-10-21", "p3", 166),
    formRecord("f3", "2026-10-03", null, 165),
  ];
  d.setups[0].history = [
    { date: "2026-11-02", changes: [{ label: "プランジャー", from: "中", to: "やや硬め" }] },
  ];
  d.sessions[4].note = "架空のメモ。後半に押し手が流れました。";
  const reasons = ["リリース", "リリース", "押し手", "風", "リリース", "押し手"];
  d.sessions[6].ends[2].forEach((a, i) => (a.reason = reasons[i]));
  d.sessions[3].ends[1].forEach((a, i) => (a.reason = reasons[(i + 2) % 6]));
  d.sessions[1].windSpeed = "4";
  d.sessions[2].windSpeed = "5";
  return d;
}

async function openAnalysis(page, database, size) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.setViewportSize(size || { width: 375, height: 812 });
  await page.clock.setFixedTime(new Date("2026-11-12T10:00:00"));
  await page.addInitScript((d) => {
    if (globalThis.sessionStorage.getItem("__seeded")) return;
    globalThis.sessionStorage.setItem("__seeded", "1");
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(d));
  }, database);
  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await page.locator('#tabs [data-v="analysis"]').click();
  await expect(page.getByTestId("analysis-view")).toBeVisible();
  return errors;
}
const subTab = (page, id) => page.locator(`#analysisSubTabs [data-an="${id}"]`);
async function gotoSubTab(page, id) {
  await subTab(page, id).click();
  await expect(page.getByTestId("analysis-view")).toHaveAttribute("data-tab", id);
}
const stored = (page) =>
  page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));

/* 使わない語（docs/design/ui-redesign-plan.md 5章、tools/check-analysis-view.js と同じ並び） */
const BANNED = [
  "この調子",
  "信頼度",
  "しましょう",
  "頑張",
  "がんば",
  "おつかれ",
  "お疲れ",
  "ナイス",
  "おめでとう",
  "すばらしい",
  "素晴らし",
  "絶好調",
  "好調",
  "上向き",
  "下がり気味",
  "次回試す",
  "比較待ち",
  "!",
  "！",
];

module.exports = {
  BANNED,
  diff1,
  gotoSubTab,
  homeResultDb,
  md,
  mean,
  openAnalysis,
  richAnalysisDb,
  sd,
  signed,
  stored,
  subTab,
  sum,
  totalOf,
};
