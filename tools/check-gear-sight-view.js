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
const MULTI_ROUND_PRESETS = [];
const selectedMultiRound = () => null;
const parseFaceChoice = (v) => ({ faceD: +v || 122, faceType: "single" });
const faceChoiceValue = (s) => String(s.faceD || 122);
const NOTE_GO = "";
${read("scripts/20-scoring.js")}
${read("scripts/40-analysis-physics.js")}
${cutFrom(view, "const WEEKDAY_JA", "function roundQuota(")}
${cutFrom(store, "function roundLabel(", "/* 記録セッション中の画面消灯")}
${cutFrom(view, "function startConditionFrom(", "/* 記録を始める（待機画面の")}
${cutFrom(view, "function arrowMetaSummaryHtml(", "/* ============ gamification: バッジ12種")}
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
  recordingSetupId, gearViewSetup, GEAR_FIELDS, GEAR_SUGGESTIONS, estimateArrowCd, personalPhysicsCalibration,
  sightDistRows, sightScaleTicks, sightScaleSvg, sightDistRowHtml, sightHorizontalNoteHtml,
  sightAdviceModel, sightAdviceHtml, sightCentreRows, sightCentreDriftHtml, sightBasisRowsHtml,
  sessionSightFoldHtml,
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
  "良好",
  "精度が上がります",
  "強くなります",
  "いつものセッティング",
  "いまの提案",
  "用具",
  "射形",
  /* AN-102（docs/design/voice.md）: どの画面にも書かない言葉。統計の言葉が本文に出ないことは、下の本文／たたんだ中の比べと tools/check-voice.js で見る */
  "この回",
  "測定のゆれ",
  "判定できない",
  "セッション",
  "破棄",
  "紐付",
  "紐づ",
  "ストリーク",
  "弓手",
  "着弾",
  "台帳",
  "！",
];
const textOf = (html) =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
let checks = 0;
/* 「大丈夫」は、オーナーが決めた言い方「サイトはそのままで大丈夫です」（docs/design/voice.md 5章。2026-11-15）の中でだけ使う。
   その文は「動かす条件を満たさず、中心も定まっている」軸（state: none）にしか出ない（下の adviceCase で確かめる） */
const OK_PHRASE = "そのままで大丈夫です";
const clean = (html, label) => {
  const text = textOf(html);
  assert(
    !text.split(OK_PHRASE).join("").includes("大丈夫"),
    `${label}: 「大丈夫」 outside the agreed sentence in: ${text}`,
  );
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
    pt.includes("記録していない距離の予測") && pt.includes("実測 3距離（18m・30m・70m）から"),
    "prediction names the marks it comes from",
  );
  ok(
    pt.includes("決定係数") && pt.includes("左右は予測しません"),
    "prediction states the fit and its limit",
  );
  {
    /* 決定係数は「予測の計算方法」の中だけ。本文（たたんでいない所）には出ない（docs/design/voice.md 4章） */
    const a = pred.indexOf('<details class="sightPredictionHelp"'),
      b = pred.indexOf("</details>", a);
    ok(a >= 0 && b > a, "prediction help fold exists");
    ok(/実測 3距離との合い方（決定係数）は [0-9.]+% です。/.test(textOf(pred.slice(a, b))), "the fit is stated inside the fold");
    const main = textOf(pred.slice(0, a) + pred.slice(b)).replace(/計算に使った実測[\s\S]*$/, "");
    ok(!/決定係数|当てはま/.test(main), `no fit jargon in the main text of the prediction: ${main}`);
  }
  const two = marks.filter((m) => m.dist !== 18);
  d.sightMarks = two;
  app.setDb(d);
  const p2 = clean(app.sightPredictionHtml(app.sightInterp("s1"), two), "prediction (2 marks)");
  ok(
    p2.includes("実測が 2距離だけなので、予測はまだ粗めです。もう 1距離記録すると、合っているか確かめられます。") &&
      p2.includes("合い方は確かめられません"),
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
  {
    /* 本文はふつうの言葉だけ。区間・確率・検定は「詳しく」の中（docs/design/voice.md 4章） */
    const a = html.indexOf('<details class="gearMore sightAdviceMore"'),
      b = html.indexOf("</details>", a);
    ok(a >= 0 && b > a, `${label}: the 詳しく fold exists`);
    const main = textOf(html.slice(0, a)),
      inside = textOf(html.slice(a, b));
    ok(!/95%区間|確率|検定|誤差|寄り|ずれ(?!て)|ズレ|着弾|外れ値/.test(main), `${label}: no statistics word or nominalisation in the main text: ${main}`);
    ok(/95%区間/.test(inside) && /確率は/.test(inside) && inside.includes("同時の検定"), `${label}: the statistics are kept inside the fold`);
    ok(/^.*矢は的の中心(より (右|左|上|下)に [0-9.]+cm(・(上|下)に [0-9.]+cm)? の所)?に集まっています（/.test(main.replace(/\s+/g, " ")), `${label}: the fact says where the arrows gathered, with a verb: ${main}`);
    const none = [md.h, md.v].filter((x) => x.state === "none");
    ok(main.includes(OK_PHRASE) === none.length > 0, `${label}: 「そのままで大丈夫です」 only when an axis is in state none`);
    ok(none.length !== 2 || main.includes("サイトはそのままで大丈夫です。"), `${label}: both axes none says the sight stays`);
    for (const x of [md.h, md.v]) {
      if (x.state === "move") ok(main.includes(`${x.name}は、矢が${x.dirWord}に ${Math.abs(x.m).toFixed(1)}cm ずれて集まっているので、サイトを${x.dirWord}へ ${x.amount} 動かす目安です。`), `${label}: ${x.key} move sentence carries the model's direction and amount`);
      if (x.state === "open") ok(x.big === "まだ分かりません" && main.includes("矢の中心がまだはっきりしません。サイトはそのままで"), `${label}: ${x.key} open says not yet known and to leave the sight`);
      if (x.state === "hold") ok(x.big === "まだ動かさない" && /まだ動かさず/.test(main), `${label}: ${x.key} hold says not to move yet`);
      if (x.state !== "move") ok(!new RegExp(`${x.name}は、矢が.に [0-9.]+cm ずれて集まっているので`).test(main), `${label}: ${x.key} has no move sentence unless the model moves`);
    }
  }
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
        text.includes(`${a.name}の量は、矢の中心までの ${Math.abs(dec.m).toFixed(1)}cm`),
        `${label}: ${k} conversion is explained`,
      );
    }
    if (a.state === "none") ok(a.big === "そのまま", `${label}: ${k} says そのまま`);
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
    base.text.includes("この記録のサイトは 上下 5.2・左右 0 です。"),
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
    dt.includes(`大きく外れた矢を除いた、矢の中心（70m・122cm的・直近 ${rows.length}回）`) &&
      dt.includes("分析 > グルーピング"),
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

/* ---------- 今日の結果・ノートの詳細: 折りたたみ「サイト調整の目安と詳しい根拠」（v5 段 9） ----------
   弓具 > サイト と同じ sightAdviceHtml を使う。旧い枠の語（判断信頼度・次のアクション など）は、どの記録でも出ない */
{
  const OLD_LABELS = [
    "判断信頼度",
    "演算信頼度",
    "次のアクション",
    "個人モデル",
    "個人補正",
    "準備度",
    "物理校正",
    "動かすべきか",
    "サイト調整の提案",
    "次の重点",
    "精度向上",
    "判断:",
    "公式",
    "公認",
  ];
  const foldCase = (label, sess, setup, testid) => {
    const html = app.sessionSightFoldHtml(sess, setup, { testid });
    const text = clean(html, label);
    for (const w of OLD_LABELS) ok(!text.includes(w), `${label}: old label "${w}" is gone`);
    ok(html.includes(`data-testid="${testid}"`), `${label}: test id`);
    ok(text.includes("サイトの目安と詳しい数字"), `${label}: fold title`);
    return { html, text };
  };
  const d = load((x) => {
    /* 矢番号と外れ理由のある記録でも、同じ語の決まりを満たす */
    const a = x.sessions.find((s) => s.id === "p6").ends[0];
    a[0].no = "3";
    a[0].reason = "リリース";
    a[1].no = "3";
  });
  const setup = d.setups[0];
  const pos = d.sessions.find((s) => s.id === "p6");
  for (const testid of ["result-sight-details", "note-sight-details"]) {
    const r = foldCase(`fold ${testid} (positions)`, pos, setup, testid);
    const adv = app.adviceFor(pos, setup);
    ok(
      r.html.includes(app.sightAdviceHtml(pos, setup, adv)),
      `${testid}: the advice block is the one the sight screen renders`,
    );
    ok(/矢は的の中心.*に集まっています（位置のある \d+射/.test(r.text), `${testid}: centre and n are stated`);
    ok(r.text.includes("グルーピング半径 (RMS・全射)"), `${testid}: all-arrow figures stay`);
    ok(r.text.includes("矢番号と外れた理由"), `${testid}: arrow notes stay`);
    ok(r.text.includes("ラウンドの進み"), `${testid}: round progress stays`);
  }
  /* 位置のある矢が1本もない記録（点数だけ）: 着弾の数値を出さない */
  const keyOnly = d.sessions.find((s) => s.id === "p5");
  for (const testid of ["result-sight-details", "note-sight-details"]) {
    const r = foldCase(`fold ${testid} (score only)`, keyOnly, setup, testid);
    ok(!r.html.includes('data-testid="sight-advice"'), `${testid}: no advice without positions`);
    ok(r.text.includes("矢の位置がない記録なので、サイトの目安は出ません。"), `${testid}: says there is no position data`);
    ok(
      !/\d(\.\d+)?\s?(cm|mm|クリック|目盛り)/.test(r.text.replace(/122cm的/g, "")),
      `${testid}: no impact or sight numbers without positions: ${r.text}`,
    );
  }
  /* 位置のある矢が 2射だけ: 目安は出さず、理由を書く */
  const two = JSON.parse(JSON.stringify(pos));
  two.id = "two";
  two.ends = [[pos.ends[0][0], pos.ends[0][1], { s: 9, X: false, src: "key" }]];
  if (process.argv.includes("--print-fold")) console.log(textOf(app.sessionSightFoldHtml(pos, setup, {})).replace(/\s+/g, " "));
  const r2 = foldCase("fold (2 positions)", two, setup, "note-sight-details");
  ok(!r2.html.includes('data-testid="sight-advice"'), "two positions: no advice");
  ok(r2.text.includes("位置のある矢が 3射になると、サイトの目安が出ます。"), "two positions: says when the advice appears");
  /* セッティングの無い記録でも落ちない */
  foldCase("fold (no setup)", { ...pos, setupId: "" }, undefined, "note-sight-details");
  /* 2つの画面とも、この関数だけを使う（旧い部品の名前がソースに残っていない） */
  const all = view + hist + read("scripts/40-analysis-physics.js");
  ok(
    cutFrom(view, "function openSummary(", "openModal(ovl").includes("sessionSightFoldHtml(sess, setup"),
    "result screen uses sessionSightFoldHtml",
  );
  ok(
    cutFrom(hist, "function openHistDetail(", "openModal(ovl").includes("sessionSightFoldHtml(sess, setup"),
    "note detail uses sessionSightFoldHtml",
  );
  for (const w of [
    "nextActionHtml",
    "trustHtml",
    "personalModelHtml",
    "summaryDecisionHtml",
    "summarySightDialHtml",
    "judgementHtml",
    "confidenceNoteHtml",
    "conditionHtml(",
    "modelReadinessHtml",
    "physicsCalibrationHtml",
    "primarySightSuggestion",
  ])
    ok(!all.includes(w), `removed part "${w}" is still in the sources`);
}


/* ---------- サイトの目安: 「同じサイトで打った前の練習」は、その記録より前の記録だけ ---------- */
/* 以前の記録のノートを開いたとき、あとの練習を「前の練習」に数えていた（中心が逆向きのあとの 3 回のせいで、
   その日は「右へ」だった目安が「まだ動かさない」に変わる）。数えるのは、日付が前の記録と、同じ日の先に保存した記録 */
{
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 4294967296);
  const gauss = () => {
    let u = 0;
    while (!u) u = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  };
  const sess = (id, date, cx) => ({
    id,
    date,
    setupId: "s1",
    dist: 70,
    faceD: 122,
    faceType: "single",
    perEnd: 6,
    arrowR: 0.285,
    round: "free",
    sightV: "5.2",
    sightH: "0",
    ends: Array.from({ length: 6 }, () =>
      Array.from({ length: 6 }, () => ({
        x: +(cx + gauss() * 4).toFixed(2),
        y: +(gauss() * 4).toFixed(2),
        s: 9,
        X: false,
      })),
    ),
  });
  const d = load((db) => {
    db.sessions = [
      sess("as-of-c", "2026-10-20", -6) /* 保存の並びは日付の順とは限らない */,
      sess("as-of-a", "2026-10-01", 6),
      sess("as-of-b1", "2026-10-10", -6),
      sess("as-of-b2", "2026-10-10", -6),
      sess("as-of-d", "2026-10-30", -6),
    ];
  });
  const setup = d.setups[0];
  const by = (id) => d.sessions.find((x) => x.id === id);
  const personal = (id) => app.adviceFor(by(id), setup).personal;
  ok(personal("as-of-a").sample === 0, "the oldest record has no earlier practice to compare with");
  ok(app.adviceFor(by("as-of-a"), setup).decision.h.move === true, "the oldest record keeps its own advice");
  ok(
    app.judgementFor(app.adviceFor(by("as-of-a"), setup), by("as-of-a")).label !== "保留",
    "later practice does not put the oldest record on hold",
  );
  ok(personal("as-of-b1").sample === 1, "same-day record saved first sees only the earlier date");
  ok(personal("as-of-b2").sample === 2, "same-day record saved later also sees the one saved before it");
  ok(personal("as-of-c").sample === 3, "a record sees every earlier date, whatever the stored order");
  ok(personal("as-of-d").sample === 4, "the newest record sees all the others");
  /* 記録中の回（db.sessions に無い）は、その日までの記録を全部使う。あとの日付の記録は使わない */
  const live = sess("as-of-live", "2026-10-10", -6);
  ok(app.adviceFor(live, setup).personal.sample === 3, "a session being recorded uses records up to its date");
}

/* ---------- 空気抵抗の係数の入力候補は、いまの計算の前提の中の値 ---------- */
/* 実測は約 1.5〜2.6（docs/design/math-core-rebuild.md 3章）。候補を選んだときの値が、空のままのとき（外径から出す値）と
   大きく離れないこと。以前の候補 0.90〜1.45 は古い前提の値で、標準の矢（5.6mm・29inch）の 2.6 の半分以下だった */
{
  const list = app.GEAR_SUGGESTIONS.arrowCd.map(Number);
  ok(list.length >= 3 && list.every((v) => v >= 1.5 && v <= 2.6), `Cd suggestions are inside 1.5–2.6: ${list}`);
  const standard = app.estimateArrowCd({ arrowLength: "29" }, 5.6);
  ok(Math.abs(standard - 2.6) < 1e-9, "the reference arrow estimates Cd 2.6");
  ok(list.includes(2.6), "the reference value is one of the suggestions");
  ok(app.estimateArrowCd({ arrowCd: String(list[0]) }, 5.6) === list[0], "a chosen suggestion is used as it is");
}

/* ---------- 距離の無いサイトの記録（以前の版・読み込んだデータ）があっても、予測は数のまま ---------- */
{
  const d = load((db) => {
    db.sightMarks.push({ id: "no-dist", setupId: "s1", dist: null, v: "4.1", h: "0", date: "2026-09-01", ts: 2 });
    db.sightMarks.push({ id: "str-dist", setupId: "s1", v: "3.9", h: "0", date: "2026-09-02", ts: 3 });
  });
  const interp = app.sightInterp("s1");
  ok(interp && interp.pts.every((p) => Number.isFinite(p[0]) && p[0] > 0), "marks without a distance are not used");
  ok(Number.isFinite(interp.predict ? interp.predict(30) : interp.pts[0][1]), "the prediction stays a number");
  const html = app.sightPredictionHtml(interp, d.sightMarks.filter((m) => m.setupId === "s1"));
  ok(!/NaN|nullm|undefined/.test(textOf(html)), `no broken value in the prediction: ${textOf(html).slice(0, 120)}`);
}

/* ---------- 個人の校正は、結果を変えるものが同じなら前の結果を使う ---------- */
{
  const d = load();
  const sess = d.sessions.find((s) => s.setupId === "s1" && s.ends.flat().some((a) => a.x != null));
  const first = app.personalPhysicsCalibration("s1");
  ok(first && app.personalPhysicsCalibration("s1") === first, "a second call reuses the result");
  /* メモや印の保存（db の世代は進む）では計算し直さない */
  sess.note = "架空のメモ";
  sess.ends[0][0].reason = "風";
  app.setDb(d);
  ok(app.personalPhysicsCalibration("s1") === first, "a memo or a reason mark does not recompute");
  /* 矢の位置・サイトの値・風・弓具の項目・サイトの記録が変わったら計算し直す */
  const changes = [
    () => { sess.ends[0][0].x += 1.5; },
    () => { sess.sightV = "5.6"; },
    () => { sess.windSpeed = "4"; sess.windDir = "左から"; },
    () => { d.setups[0].arrowSpeed = "200"; },
    () => { d.sightMarks.push({ id: "m-new", setupId: "s1", dist: 30, v: "3.1", h: "0", date: "2026-11-01", ts: 9 }); },
    () => { d.settings.eyeSight = 900; },
  ];
  let prev = first;
  changes.forEach((change, i) => {
    change();
    app.setDb(d);
    const next = app.personalPhysicsCalibration("s1");
    ok(next !== prev, `change ${i} recomputes the calibration`);
    prev = next;
  });
}

console.log(`Gear / sight / settings copy and view-model checks OK (${checks} checks)`);
