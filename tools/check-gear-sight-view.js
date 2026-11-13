"use strict";
/* 弓具（セッティング / サイト）と設定（UI v5 段 8）の文言と表示用の値の検査。
   - 仕様表・変更の履歴・目盛りの図・調整の目安・予測の HTML を見本データから実際に組み立て、
     使わない語（励まし・評価語・「信頼度」・感嘆符）と壊れた値（NaN・undefined・null）が無いことを確かめる
   - 仕様表は保存してある値をそのまま出す（データに無い項目の行は作らない）。矢の外径は線の判定に使う値
   - 目盛りの図の値は台帳の値と一致する
   - 調整の目安は、判断・着弾中心・射数・95%区間・確率を文に書く。量と方向は sightDecision の結果のまま
   - 設定の画面は、データを消す・置き換える操作の行に注意書きがある
   採点・統計・サイトの計算そのものの検査は tools/check-app.js と tools/check-grouping-stats.js。 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const { homeResultDb } = require("../tests/e2e/fixtures/home-result-db.js");
const view = read("scripts/50-record-view.js");
const hist = read("scripts/60-history-sight-view.js");
const gear = read("scripts/70-gear-settings.js");
const store = read("scripts/10-storage-native.js");
const cutFrom = (src, from, to) => {
  const a = src.indexOf(from),
    b = src.indexOf(to, a + from.length);
  assert(a >= 0 && b > a, `source marker missing: ${from} … ${to}`);
  return src.slice(a, b);
};
const TODAY = "2026-11-12";
const source = `
let DB_REV = 0;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const icon = () => "";
const today = () => "${TODAY}";
const fmtD = (iso) => { if (!iso || typeof iso !== "string" || !/^\\d{4}-\\d{2}-\\d{2}/.test(iso)) return ""; const [y, m, d] = iso.split("-"); return \`\${+y}/\${+m}/\${+d}\`; };
const faceLabel = (s) => (s.faceType === "triple" ? "40cm三つ目" : s.faceType === "field" ? \`\${+s.faceD || 0}cmフィールド\` : \`\${+s.faceD || 0}cm的\`);
const perfectScoreValue = (s) => (s && s.faceType === "field" ? 6 : 10);
const ROUND_TYPES = [{ id: "free", label: "自由練習" }, { id: "70m72", label: "70m 72射", arrows: 72 }, { id: "18m60", label: "18m 60射", arrows: 60 }];
const findRoundDef = () => null;
const selectedMultiRound = () => null;
const parseFaceChoice = (v) => ({ faceD: +v || 122, faceType: "single" });
const faceChoiceValue = (s) => String(s.faceD || 122);
const NOTE_GO = "";
${read("scripts/20-scoring.js")}
${read("scripts/40-analysis-physics.js")}
${cutFrom(view, "const WEEKDAY_JA", "function roundQuota(")}
${cutFrom(view, "function startConditionFrom(", "/* 記録を始める（待機画面の")}
${cutFrom(view, "function distanceLabel(", "function historyAnalysisDetailsHtml(")}
${cutFrom(view, "function sightValueText(", "function sightSummaryHtml(")}
${cutFrom(gear, "const CATALOG_SHAFTS", "function renderGear(")}
${cutFrom(hist, "function sightRecordOrder(", "/* 「サイト値の記録」「サイト値のまとめ」")}
${cutFrom(hist, "/* 距離ごとの最新の記録。", "function renderSight(")}
return {
  setDb: (d) => { db = d; DB_REV++; },
  ui,
  sessionMetrics, adviceFor, sightStats, sightInterp, judgementFor, arrowRadiusFromDiaMm,
  gearSpecRows, gearSpecOtherRows, gearSpecRowHtml, gearHistoryEntries, gearHistoryHtml, gearPrecisionHtml,
  recordingSetupId, gearViewSetup, GEAR_FIELDS,
  sightDistRows, sightScaleTicks, sightScaleSvg, sightDistRowHtml, sightHorizontalNoteHtml,
  sightAdviceModel, sightAdviceHtml, sightCentreRows, sightCentreDriftHtml, sightBasisRowsHtml,
  sightPredictionHtml, sightLedgerHtml,
};`;
const app = new Function("db", "ui", source)(null, {
  gearSel: null,
  sightSel: { setupId: null, dist: 70 },
});

/* 使わない語（docs/design/ui-redesign-plan.md 5章。分析の検査と同じ並びに、この画面で消した語を足す） */
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
  "おすすめ",
  "安心",
  "大丈夫",
  "良好",
  "精度が上がります",
  "強くなります",
  "いつものセッティング",
  "いまの提案",
  "用具",
  "射形",
  "！",
];
const textOf = (html) =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
let checks = 0;
const clean = (html, label) => {
  const text = textOf(html);
  for (const w of [...BANNED, "!"])
    assert(!text.includes(w), `${label}: banned phrase "${w}" in: ${text}`);
  assert(!/NaN|undefined|Infinity|\bnull\b/.test(html), `${label}: broken value in ${html}`);
  assert(
    !/[A-Z]{6,}/.test(text.replace(/EASTON|SHIBUYA|RAMRODS/g, "")),
    `${label}: decorative English heading`,
  );
  checks++;
  return text;
};
const ok = (cond, msg) => {
  assert(cond, msg);
  checks++;
};
const SETUP = {
  id: "s1",
  name: "架空のリカーブ",
  bow: "HOYT Formula XD 25",
  limbs: "架空のリム 68",
  poundage: "36.5",
  drawLength: "28.5",
  arrow: "EASTON X10",
  shaftSpine: "620",
  arrowLength: "28.5",
  arrowDia: "5.7",
  pointWeight: "100",
  brace: "22.3cm",
  tiller: "上 +3mm",
  nock: "+4mm",
  plunger: "中間",
  plungerTension: "ばね 中",
  stabilizer: "架空のスタビライザー",
  notes: "<b>架空</b>のメモ",
  history: [
    {
      date: "2026-10-14",
      changes: [{ label: "プランジャー硬さ/位置", from: "ばね 弱", to: "ばね 中" }],
    },
    { date: "2026-10-03", changes: [{ label: "ノック/ノッキングポイント", from: "", to: "+4mm" }] },
  ],
};
const MARKS = [
  { id: "m0", setupId: "s1", dist: 70, v: "5.00", h: "0", date: "2026-10-03", ts: 1 },
  {
    id: "m1",
    setupId: "s1",
    dist: 70,
    v: "5.20",
    h: "0",
    date: "2026-10-28",
    ts: 2,
    note: "<i>無風</i>",
  },
  { id: "m2", setupId: "s1", dist: 30, v: "2.60", h: "0", date: "2026-09-20", ts: 3 },
  { id: "m3", setupId: "s1", dist: 18, v: "1.85", h: "0.5", date: "2026-11-01", ts: 4 },
  { id: "mx", setupId: "s2", dist: 18, v: "9.99", h: "1", date: "2026-11-02", ts: 5 },
];
const load = (mutate) => {
  const d = homeResultDb();
  Object.assign(d.setups[0], JSON.parse(JSON.stringify(SETUP)));
  d.sightMarks = JSON.parse(JSON.stringify(MARKS));
  if (mutate) mutate(d);
  app.setDb(d);
  app.ui.gearSel = null;
  return d;
};

/* ---------- セッティング: 仕様表 ---------- */
{
  const d = load();
  const s = d.setups[0];
  const rows = app.gearSpecRows(s);
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  ok(
    by.bow.value === "HOYT Formula XD 25" && by.bow.label === "ハンドル",
    "handle row shows the stored value",
  );
  ok(
    by.limbs.value === "架空のリム 68・実測 36.5ポンド",
    `limb row joins limbs and measured poundage: ${by.limbs.value}`,
  );
  ok(by.arrow.value === "EASTON X10・620番・28.5インチ", `arrow row: ${by.arrow.value}`);
  ok(
    by.arrowDia.value === "5.7mm" && by.arrowDia.note === "線の判定に使います",
    "arrow diameter row states its use",
  );
  ok(
    by.pointWeight.value === "100グレイン" &&
      by.brace.value === "22.3cm" &&
      by.tiller.value === "上 +3mm",
    "units only on bare numbers",
  );
  ok(
    by.plunger.value === "中間・ばね 中" && by.nock.value === "+4mm",
    "plunger and nocking point rows",
  );
  ok(!by.sight, "a field the data does not have gets no row");
  const others = app.gearSpecOtherRows(s);
  ok(
    others.length === 1 && others[0].key === "stabilizer",
    "remaining filled fields go to the other-items fold",
  );
  const html = rows.map(app.gearSpecRowHtml).join("");
  clean(html, "spec table");
  /* 矢の外径: 未入力・範囲外は、線の判定に実際に使う既定値を出して、そのことを書く */
  const blank = app.gearSpecRows({ id: "x", name: "名前だけ" });
  ok(
    blank.length === 1 &&
      blank[0].key === "arrowDia" &&
      blank[0].value === "5.7mm" &&
      blank[0].note.includes("未入力"),
    "name-only setup shows only the diameter in use",
  );
  const odd = app
    .gearSpecRows({ id: "x", name: "n", arrowDia: "57" })
    .find((r) => r.key === "arrowDia");
  ok(
    odd.value === "5.7mm" && odd.note.includes("57") && odd.note.includes("標準の値"),
    "out-of-range diameter is reported with the value in use",
  );
  const big = app
    .gearSpecRows({ id: "x", name: "n", arrowDia: "9.3" })
    .find((r) => r.key === "arrowDia");
  ok(
    big.value === "9.3mm" && Math.abs(app.arrowRadiusFromDiaMm("9.3") * 20 - 9.3) < 1e-9,
    "diameter row equals the scoring footprint",
  );
  clean(app.gearPrecisionHtml(s), "inputs fold");
  clean(app.gearPrecisionHtml({ id: "x", name: "n" }), "inputs fold (empty)");
  const esc1 = app.gearSpecRowHtml({
    key: "bow",
    label: "ハンドル",
    value: '<img src=x onerror="1">',
  });
  ok(!esc1.includes("<img"), "spec values are escaped");
}

/* ---------- セッティング: 変更の履歴（弓具の編集とサイト台帳を日付順に） ---------- */
{
  const d = load();
  const list = app.gearHistoryEntries(d.setups[0]);
  ok(list.length === 6, `2 edits + 4 sight marks of this setup: ${list.length}`);
  ok(
    list.every((e, i) => i === 0 || list[i - 1].date >= e.date),
    "newest first",
  );
  const texts = list.map((e) => e.text);
  ok(
    texts.includes("サイト 70m 上下 5.00 → 5.20"),
    `sight change is written as a difference: ${texts.join(" | ")}`,
  );
  ok(
    texts.includes("サイト 70m 上下 5.00・左右 0 を記録") &&
      texts.includes("サイト 18m 上下 1.85・左右 0.5 を記録"),
    "first mark of a distance is a plain record",
  );
  ok(
    texts.includes("ノック/ノッキングポイント 未入力 → +4mm"),
    "empty previous value is written as 未入力",
  );
  ok(!texts.some((t) => t.includes("9.99")), "marks of another setup are not listed");
  clean(app.gearHistoryHtml(d.setups[0]), "history");
  clean(app.gearHistoryHtml({ id: "none", name: "n" }), "history (empty)");
  ok(
    JSON.stringify(d.setups[0].history) === JSON.stringify(SETUP.history),
    "history data is not rewritten",
  );
}

/* ---------- 記録に使用中 ---------- */
{
  const d = load();
  ok(app.recordingSetupId() === "s1", "the latest session's setup is the recording setup");
  d.active = { setupId: "s2", ends: [], cur: [] };
  ok(app.recordingSetupId() === "s2", "an active recording wins");
  d.active = null;
  d.sessions = [];
  ok(app.recordingSetupId() === "s1", "with no sessions the first setup starts the next recording");
  app.ui.gearSel = "s2";
  ok(app.gearViewSetup().id === "s2", "the viewed setup follows the selection");
  app.ui.gearSel = "gone";
  ok(app.gearViewSetup().id === "s1", "a stale selection falls back to the recording setup");
}

/* ---------- サイト: 目盛りの図と台帳の値 ---------- */
{
  const d = load();
  const interp = app.sightInterp("s1");
  const rows = app.sightDistRows("s1", [70, 50, 30, 18], interp);
  const by = Object.fromEntries(rows.map((r) => [r.dist, r]));
  ok(
    by[70].kind === "rec" && by[70].text === "5.20" && by[70].mark.id === "m1",
    "70m shows the newest numeric mark",
  );
  ok(by[30].text === "2.60" && by[18].text === "1.85", "30m / 18m marks");
  ok(
    by[50].kind === "pred" && by[50].text === interp.est(50).toFixed(1) && by[50].n === 3,
    "50m is a prediction from the three marks",
  );
  const svg = app.sightScaleSvg(rows);
  for (const r of rows)
    ok(
      svg.includes(
        `data-scale-dist="${r.dist}" data-scale-kind="${r.kind}" data-scale-v="${r.text}"`,
      ),
      `scale carries ${r.dist}m ${r.text}`,
    );
  ok((svg.match(/stroke-dasharray="4 3"/g) || []).length === 1, "only the prediction is dashed");
  ok(
    /aria-label="[^"]*70m 5\.20[^"]*50m [0-9.]+（予測）/.test(svg),
    "scale has a text alternative with the values",
  );
  ok(!/NaN|undefined/.test(svg), "scale has no broken numbers");
  const t = app.sightScaleTicks(1.85, 5.2);
  ok(
    t.lo <= 1.85 && t.hi >= 5.2 && t.major > 0 && Math.abs(t.minor * 5 - t.major) < 1e-12,
    "ticks cover the values",
  );
  for (const [lo, hi] of [
    [0, 0],
    [90, 900],
    [-3, 4],
    [5.2, 5.2],
    [0.01, 0.02],
    [0, 100],
  ]) {
    const k = app.sightScaleTicks(lo, hi);
    const n = Math.round((k.hi - k.lo) / k.major);
    ok(
      k.lo <= lo && k.hi >= hi && n >= 1 && n <= 12 && Number.isFinite(k.dec),
      `ticks for ${lo}..${hi}: ${JSON.stringify(k)}`,
    );
  }
  ok(app.sightScaleSvg(app.sightDistRows("s1", [60], null)) === "", "no numeric value, no figure");
  /* 値が同じ・近い距離でも名札は重ならない（17px 以上あける） */
  d.sightMarks = [18, 30, 50, 70].map((dist, i) => ({
    id: "c" + i,
    setupId: "s1",
    dist,
    v: "5.0",
    h: "0",
    date: "2026-10-01",
    ts: i + 1,
  }));
  app.setDb(d);
  const close = app.sightScaleSvg(app.sightDistRows("s1", [70, 50, 30, 18], null));
  const ys = [...close.matchAll(/<text x="66" y="([0-9.]+)"/g)]
    .map((m) => +m[1])
    .sort((a, b) => a - b);
  ok(
    ys.length === 4 && ys.every((y, i) => i === 0 || y - ys[i - 1] >= 16.9) && ys[3] <= 330,
    `labels are spaced: ${ys}`,
  );
  clean(
    rows.map((r) => app.sightDistRowHtml(r, r.dist === 70)).join("") +
      app.sightHorizontalNoteHtml(rows),
    "distance rows",
  );
  ok(
    app.sightHorizontalNoteHtml(rows).includes("左右: 70m 0・30m 0・18m 0.5"),
    "different left-right values are listed per distance",
  );
  /* 0 は値として扱う。数値でない上下は図に置かず、行に「上下の数値なし」と書く */
  d.sightMarks = [
    { id: "z", setupId: "s1", dist: 30, v: 0, h: 0, date: "2026-10-01", ts: 1 },
    { id: "t", setupId: "s1", dist: 18, v: "上から3", h: "", date: "2026-10-01", ts: 2 },
  ];
  app.setDb(d);
  const zr = app.sightDistRows("s1", [30, 18], null);
  ok(zr[0].kind === "rec" && zr[0].v === 0 && zr[0].text === "0", "zero is a recorded value");
  ok(
    zr[1].kind === "none" && app.sightDistRowHtml(zr[1], false).includes("上下の数値なし"),
    "non-numeric mark is not plotted",
  );
}

/* ---------- サイト: 台帳と予測の文 ---------- */
{
  const d = load();
  const marks = d.sightMarks.filter((m) => m.setupId === "s1");
  const ledger = app.sightLedgerHtml(marks.filter((m) => m.dist === 70).reverse());
  const lt = clean(ledger, "ledger");
  ok(
    lt.includes("5.20") &&
      lt.includes("5.00") &&
      !ledger.includes("<i>無風</i>") &&
      ledger.includes("&lt;i&gt;無風"),
    "ledger keeps values and escapes memos",
  );
  const pred = app.sightPredictionHtml(app.sightInterp("s1"), marks);
  const pt = clean(pred, "prediction");
  ok(
    pt.includes("記録していない距離の予測") && pt.includes("実測 3点（18m・30m・70m）から"),
    "prediction names the marks it comes from",
  );
  ok(
    pt.includes("決定係数") && pt.includes("左右は予測しません"),
    "prediction states the fit and its limit",
  );
  const two = marks.filter((m) => m.dist !== 18);
  d.sightMarks = two;
  app.setDb(d);
  const p2 = clean(app.sightPredictionHtml(app.sightInterp("s1"), two), "prediction (2 marks)");
  ok(
    p2.includes("実測が2点のため、当てはまりは確かめられません"),
    "two marks: the fit cannot be checked, and it says so",
  );
}

/* ---------- サイト: 調整の目安（判断・数値・射数・根拠） ---------- */
const adviceCase = (label, mutate) => {
  const d = load(mutate);
  const setup = d.setups[0];
  const sess = [...d.sessions]
    .filter((s) => s.setupId === "s1" && s.dist === 70 && s.ends.flat().some((a) => a.x != null))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const adv = app.adviceFor(sess, setup);
  assert(adv, `${label}: advice exists`);
  const md = app.sightAdviceModel(sess, setup, adv);
  const html = app.sightAdviceHtml(sess, setup, adv);
  const text = clean(html, label);
  const ss = app.sightStats(adv.st);
  ok(
    text.includes(`位置のある ${ss.n}射`) || text.includes(`除いた ${ss.n}射`),
    `${label}: n is stated`,
  );
  ok(
    text.includes(
      `左右 ±${adv.decision.h.ci.toFixed(1)}cm・上下 ±${adv.decision.v.ci.toFixed(1)}cm`,
    ),
    `${label}: 95% interval is stated`,
  );
  ok(/確率は [0-9.]+%(未満)? です/.test(text), `${label}: probability is stated`);
  ok(
    text.includes("同時の検定で 5% 未満") && text.includes("リング幅の 1/10 以上"),
    `${label}: the rule is stated`,
  );
  for (const k of ["h", "v"]) {
    const a = md[k],
      dec = adv.decision[k];
    /* 「動かす」は sightDecision が動かすと判定した軸だけ。量は補正量（縮小推定）からの換算 */
    ok(
      a.state !== "move" || dec.move === true,
      `${label}: ${k} moves only when the decision says so`,
    );
    ok(
      dec.move || a.state !== "hold" || md.j.label === "風を考慮",
      `${label}: ${k} hold has a reason`,
    );
    if (a.state === "move") {
      ok(
        a.big.startsWith(`${k === "v" ? (dec.m > 0 ? "上" : "下") : dec.m > 0 ? "右" : "左"}へ `),
        `${label}: ${k} direction follows the centre`,
      );
      ok(
        Math.abs(a.adj - Math.abs(dec.adj)) < 1e-12,
        `${label}: ${k} amount is the decision's amount`,
      );
      ok(
        text.includes(`${a.name}の量は、ずれ ${Math.abs(dec.m).toFixed(1)}cm`),
        `${label}: ${k} conversion is explained`,
      );
    }
    if (a.state === "none") ok(a.big === "動かさない", `${label}: ${k} says 動かさない`);
  }
  return { d, sess, adv, md, html, text };
};
{
  const base = adviceCase("advice (centred)");
  ok(
    base.md.h.state === "none" && base.md.v.state === "none",
    "fixture centre is within error: no move",
  );
  ok(
    base.text.includes("この記録のサイト値は 上下 5.2・左右 0 です。"),
    `the session's sight value is shown: ${base.text}`,
  );
  /* 中心を大きくずらすと「動かす」になり、量は換算の出どころと一緒に出る */
  const shift = (dx, dy) => (d) => {
    const s = d.sessions
      .filter((x) => x.setupId === "s1" && x.dist === 70 && x.ends.flat().some((a) => a.x != null))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    s.ends.forEach((e) =>
      e.forEach((a) => {
        a.x += dx;
        a.y += dy;
      }),
    );
  };
  const moved = adviceCase("advice (shifted)", shift(9, -7));
  ok(moved.md.h.state === "move" && moved.md.v.state === "move", "a large offset moves both axes");
  ok(
    moved.md.h.big.startsWith("右へ ") &&
      moved.md.v.big.startsWith("下へ ") &&
      moved.md.h.big.endsWith("mm"),
    `without a click setting the amount is in mm: ${moved.md.h.big} / ${moved.md.v.big}`,
  );
  ok(moved.text.includes("アイ〜サイト距離 850mm と弾道の計算"), "mm conversion names its basis");
  const clicks = adviceCase("advice (clicks)", (d) => {
    shift(9, -7)(d);
    d.setups[0].calibV70 = 4;
    d.setups[0].calibH70 = 5;
  });
  ok(
    clicks.md.v.big.endsWith("クリック") &&
      clicks.text.includes("70m で 1クリック = 4cm") &&
      clicks.text.includes("70m で 1クリック = 5cm"),
    "registered click size is used and stated",
  );
  ok(
    Math.abs(clicks.md.v.clicks - Math.abs(clicks.adv.decision.v.adj) / 4) < 1e-9,
    "click count is the amount divided by the registered size",
  );
  /* 風の記録（風向あり）は左右の誤差に加える。そのことを書く */
  const windy = adviceCase("advice (wind)", (d) => {
    const s = d.sessions
      .filter((x) => x.setupId === "s1" && x.dist === 70 && x.ends.flat().some((a) => a.x != null))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    s.windSpeed = "5";
    s.windDir = "右から";
  });
  ok(
    !windy.adv.decision.windAccounted || windy.text.includes("横流れ"),
    "wind handling is stated when it is applied",
  );
  /* 外れ値候補を除いた中心の推移: 同じ条件の記録が 2回以上あるときだけ。対象と番号を書く */
  const drift = app.sightCentreDriftHtml(base.sess);
  const rows = app.sightCentreRows(base.sess);
  ok(
    rows.length >= 2 && rows[rows.length - 1].s.id === base.sess.id,
    "drift rows end with this session",
  );
  const dt = clean(drift, "centre drift");
  ok(
    dt.includes(`外れ値候補を除いた中心（70m・122cm的・直近 ${rows.length}回）`) &&
      dt.includes("分析 > 着弾"),
    "drift plot is labelled as the outlier-excluded centre",
  );
  ok(
    rows.every((r) => {
      const st = app.sightStats(app.sessionMetrics(r.s).st);
      return r.mx === st.mx && r.my === st.my;
    }),
    "drift uses the same centre as the sight decision",
  );
  clean(app.sightBasisRowsHtml(base.sess, base.d.setups[0], base.adv, "s1", 70), "basis rows");
}

/* ---------- 設定: 文言（ソースの検査）。画面の実物は tests/e2e/gear-sight-settings.spec.js ---------- */
{
  const settingsSrc = [
    cutFrom(gear, "function customRoundsSettingsHtml()", "function openCustomRoundForm("),
    cutFrom(gear, "function gamifySettingsHtml()", "/* FORM_DIAGNOSTIC_SETTINGS_START */"),
    cutFrom(gear, "function settingsSegHtml(", "function openSetupWizard("),
    cutFrom(store, "function nativeReadinessHtml(){", "function hashText("),
  ].join("\n");
  for (const w of BANNED) ok(!settingsSrc.includes(w), `settings source: banned phrase "${w}"`);
  ok(!/>\s*(ON|OFF)\s*</.test(settingsSrc), "settings choices are 切 / 入, not ON / OFF");
  for (const g of ["display", "record", "data", "app"])
    ok(settingsSrc.includes(`data-testid="settings-group-${g}"`), `settings group ${g}`);
  /* データを消す・置き換える操作の注意書きは、その操作の行に書く（AGENTS.md） */
  const line = (id) => {
    const m = settingsSrc
      .split("\n")
      .find((l) => l.includes(`"${id}"`) && l.includes("settingsLinkHtml"));
    assert(m, `settings row ${id} missing`);
    return m;
  };
  ok(line("dImp").includes("すべて置き換わります"), "import row carries the replace warning");
  ok(line("dCsv").includes("元に戻すことはできません"), "CSV row says it cannot restore");
  ok(
    line("trashClear").includes("元に戻せません"),
    "empty-trash row carries the irreversible warning",
  );
  ok(line("dDemoRemove").includes("自分の記録は変わりません"), "demo removal row states its scope");
  const dataGroup = cutFrom(
    settingsSrc,
    'data-testid="settings-group-data"',
    'data-testid="settings-group-app"',
  );
  ok(
    dataGroup.indexOf('data-testid="settings-data-warning"') < dataGroup.indexOf('"dExp"') &&
      dataGroup.includes("記録もすべて消えます"),
    "browser-data warning sits above the backup rows",
  );
  ok(
    dataGroup.includes("いまのデータは控えの内容に置き換わります"),
    "snapshot restore carries the replace warning",
  );
}

console.log(`Gear / sight / settings copy and view-model checks OK (${checks} checks)`);
