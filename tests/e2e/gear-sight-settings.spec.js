"use strict";
/* global db, ui */
const { test, expect } = require("@playwright/test");
const { BANNED, homeResultDb, stored } = require("./analysis-helpers");

/* v5 段 8: 弓具（セッティング / サイト）と設定。docs/design/v5/design.md 4.7 */
test.use({ hasTouch: true, isMobile: true, serviceWorkers: "block" });

const MAIN = {
  name: "架空のメインリカーブ",
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
  notes: "架空のメモ <b>太字ではない</b>",
  history: [
    {
      date: "2026-10-14",
      changes: [{ label: "プランジャー硬さ/位置", from: "ばね 弱", to: "ばね 中" }],
    },
  ],
};
function gearDb(opts) {
  const d = homeResultDb(opts);
  Object.assign(d.setups[0], JSON.parse(JSON.stringify(MAIN)));
  Object.assign(d.setups[1], { bow: "架空のハンドル 23", limbs: "架空のリム 66" });
  d.sightMarks = [
    { id: "m0", setupId: "s1", dist: 70, v: "5.00", h: "0", date: "2026-10-03", ts: 1 },
    {
      id: "m1",
      setupId: "s1",
      dist: 70,
      v: "5.20",
      h: "0",
      date: "2026-10-28",
      ts: 2,
      note: "無風",
    },
    { id: "m2", setupId: "s1", dist: 30, v: "2.60", h: "0", date: "2026-09-20", ts: 3 },
    { id: "m3", setupId: "s1", dist: 18, v: "1.85", h: "0", date: "2026-11-01", ts: 4 },
    { id: "mx", setupId: "s2", dist: 18, v: "9.99", h: "1", date: "2026-11-02", ts: 5 },
  ];
  return d;
}
async function open(page, database, size) {
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
  return errors;
}
const gotoGear = async (page) => {
  await page.locator('#tabs [data-v="gear"]').click();
  await expect(page.getByTestId("gear-subtab-setup")).toHaveAttribute("aria-current", "page");
};
const gotoSight = async (page) => {
  await page.locator('#tabs [data-v="gear"]').click();
  await page.getByTestId("gear-subtab-sight").click();
  await expect(page.getByTestId("sight-ledger-section")).toBeVisible();
};
const spec = (page, key) =>
  page.locator(`[data-testid="gear-spec-sheet"] [data-spec="${key}"] .lv`);
/* 画面に出ている文（図の中の文字は除く）に、使わない語と壊れた値が無いこと */
async function expectCleanCopy(locator, label) {
  const text = await locator.evaluate((el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll("svg, option, input, textarea").forEach((n) => n.remove());
    return c.textContent;
  });
  for (const w of [...BANNED, "おすすめ", "安心", "大丈夫", "用具", "射形"])
    expect(text, `${label}: "${w}"`).not.toContain(w);
  expect(text, label).not.toMatch(/NaN|undefined|Infinity|\bnull\b/);
  return text;
}
/* 横にはみ出さない・13px 未満の文字が無い・押せるものは 44px 以上 */
async function expectFit(page, root, label) {
  const r = await page.evaluate((sel) => {
    const el = globalThis.document.querySelector(sel);
    const small = [],
      taps = [];
    const tw = globalThis.document.createTreeWalker(el, globalThis.NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      const t = n.textContent.trim(),
        p = n.parentElement;
      if (!t || !p.getClientRects().length) continue;
      const fs = parseFloat(globalThis.getComputedStyle(p).fontSize);
      if (fs < 13) small.push(`${t.slice(0, 16)}:${fs}`);
    }
    el.querySelectorAll(
      "button, select, summary, input:not([type=file]):not([type=hidden])",
    ).forEach((b) => {
      if (!b.getClientRects().length) return;
      const q = b.getBoundingClientRect();
      if (q.width < 43.5 || q.height < 43.5)
        taps.push(`${(b.id || b.textContent || "").trim().slice(0, 14)}:${q.width}x${q.height}`);
    });
    return {
      small,
      taps,
      overflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
      inner: el.scrollWidth > el.clientWidth + 1,
    };
  }, root);
  expect(r, label).toEqual({ small: [], taps: [], overflow: false, inner: false });
}

test("setup spec table shows the stored values, the recording pill, other setups and the history", async ({
  page,
}) => {
  const data = gearDb();
  const errors = await open(page, data);
  await gotoGear(page);
  await expect(page.getByTestId("gear-active-name")).toHaveText(MAIN.name);
  await expect(page.getByTestId("gear-active").getByTestId("gear-recording-pill")).toHaveText(
    "記録に使用中",
  );
  await expect(spec(page, "bow")).toHaveText(MAIN.bow);
  await expect(spec(page, "limbs")).toHaveText("架空のリム 68・実測 36.5ポンド");
  await expect(spec(page, "drawLength")).toHaveText("28.5インチ");
  await expect(spec(page, "arrow")).toHaveText("EASTON X10・620番・28.5インチ");
  await expect(spec(page, "arrowDia")).toHaveText("5.7mm線の判定に使います");
  await expect(spec(page, "pointWeight")).toHaveText("100グレイン");
  await expect(spec(page, "brace")).toHaveText("22.3cm");
  await expect(spec(page, "tiller")).toHaveText("上 +3mm");
  await expect(spec(page, "nock")).toHaveText("+4mm");
  await expect(spec(page, "plunger")).toHaveText("中間・ばね 中");
  /* データに無い項目（サイトの銘柄）は行を作らない。残りの入力済み項目は「ほかの項目」 */
  await expect(page.locator('[data-testid="gear-spec-sheet"] [data-spec="sight"]')).toHaveCount(0);
  const more = page.getByTestId("gear-spec-more");
  await expect(more.locator("summary")).toHaveText("ほかの項目（1件）");
  await more.locator("summary").click();
  await expect(more.locator('[data-spec="stabilizer"] .lv')).toHaveText("架空のスタビライザー");
  await expect(page.getByTestId("gear-spec-notes").locator("p")).toHaveText(MAIN.notes);
  await expect(page.getByTestId("gear-spec-notes").locator("b")).toHaveCount(0);
  /* 変更の履歴: 弓具の編集 1件と、このセッティングのサイト台帳 4件。新しい順 */
  const hist = page.getByTestId("gear-history-row");
  await expect(hist).toHaveCount(5);
  await expect(hist.locator(".lv")).toHaveText([
    "サイト 18m 上下 1.85・左右 0 を記録",
    "サイト 70m 上下 5.00 → 5.20",
    "プランジャー硬さ/位置 ばね 弱 → ばね 中",
    "サイト 70m 上下 5.00・左右 0 を記録",
    "サイト 30m 上下 2.60・左右 0 を記録",
  ]);
  await expect(hist.first().locator(".lk")).toHaveText("11/1（日）");
  /* ほかのセッティング */
  const others = page.getByTestId("gear-ledger-item");
  await expect(others).toHaveCount(1);
  await expect(others).toContainText("架空のインドア用");
  const s2Count = data.sessions.filter((x) => x.setupId === "s2").length;
  await expect(others).toContainText(`架空のハンドル 23・架空のリム 66・練習${s2Count}回`);
  await expectCleanCopy(page.locator("#main"), "gear");
  expect(await stored(page)).toMatchObject({ setups: data.setups, sightMarks: data.sightMarks });
  expect(errors).toEqual([]);
});

test("the viewed setup switches from the list; the pill stays on the setup used for recording", async ({
  page,
}) => {
  const data = gearDb();
  const errors = await open(page, data);
  await gotoGear(page);
  await page.getByTestId("gear-ledger-item").click();
  await expect(page.getByTestId("gear-active-name")).toHaveText("架空のインドア用");
  await expect(page.getByTestId("gear-active").getByTestId("gear-recording-pill")).toHaveCount(0);
  await expect(spec(page, "arrowDia")).toHaveText("9.3mm線の判定に使います");
  await expect(page.getByTestId("gear-history-row").locator(".lv")).toHaveText([
    "サイト 18m 上下 9.99・左右 1 を記録",
  ]);
  const others = page.getByTestId("gear-ledger-item");
  await expect(others).toHaveCount(1);
  await expect(others).toContainText(MAIN.name);
  await expect(others.getByTestId("gear-recording-pill")).toHaveText("記録に使用中");
  /* 表示を切り替えただけでは、保存してあるデータも記録の条件も変わらない */
  expect((await stored(page)).sessions).toEqual(data.sessions);
  await page.locator('#tabs [data-v="record"]').click();
  await expect(page.locator("#main")).toContainText(MAIN.name);
  /* 記録の途中は、その記録のセッティングに付く */
  await page.evaluate(() => {
    db.active = Object.assign(JSON.parse(JSON.stringify(db.sessions[0])), {
      id: "active-x",
      setupId: "s2",
      ends: [],
      cur: [],
    });
    ui.recPausedId = "active-x";
    globalThis.render();
  });
  await gotoGear(page);
  await expect(page.getByTestId("gear-active-name")).toHaveText("架空のインドア用");
  await expect(page.getByTestId("gear-active").getByTestId("gear-recording-pill")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("editing the arrow diameter changes new recordings only", async ({ page }) => {
  const data = gearDb();
  const errors = await open(page, data);
  await gotoGear(page);
  await page.getByTestId("gear-edit").click();
  const form = page.getByTestId("gear-form");
  await expect(form).toBeVisible();
  await expect(form.locator(".modalSwipeHandle")).toHaveCount(0);
  const dia = form.locator("#gf_arrowDia");
  await expect(dia).toBeVisible(); // 基本の欄に出ている（折りたたみの中ではない）
  await expect(dia).toHaveValue("5.7");
  await expect(form.getByTestId("gear-form-dia-note")).toContainText(
    "保存済みの記録の点数と円は変わりません",
  );
  await dia.fill("6.5");
  await page.getByTestId("gear-form-save").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  await expect(spec(page, "arrowDia")).toHaveText("6.5mm線の判定に使います");
  await expect(page.getByTestId("gear-history-row").first().locator(".lv")).toHaveText(
    "矢の外径 (mm) 5.7 → 6.5",
  );
  const after = await stored(page);
  /* 保存済みの記録は、点数も判定の半径（arrowR）もそのまま */
  expect(after.sessions).toEqual(data.sessions);
  expect(after.sessions.every((s) => s.arrowR === 0.285)).toBe(true);
  expect(after.setups[0].arrowDia).toBe("6.5");
  expect(after.setups[0].history.at(-1)).toEqual({
    date: "2026-11-12",
    changes: [{ label: "矢の外径 (mm)", from: "5.7", to: "6.5" }],
  });
  /* これから始める記録は、新しい外径の半径（6.5mm → 0.325cm）で判定する。画面の円も同じ半径 */
  await page.locator('#tabs [data-v="record"]').click();
  await page.getByTestId("record-start").click();
  await expect.poll(async () => (await stored(page)).active?.arrowR).toBe(0.325);
  expect(await page.evaluate(() => globalThis.activeArrowR(db.active))).toBe(0.325);
  expect((await stored(page)).sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("a setup moves to the trash with its sight marks and comes back from settings", async ({
  page,
}) => {
  const data = gearDb();
  const errors = await open(page, data);
  await gotoGear(page);
  await page.getByTestId("gear-ledger-item").click();
  await page.getByTestId("gear-delete").click();
  await expect(page.locator(".confirmSheet")).toContainText("練習の記録は消えません");
  await page.locator("#acCancel").click();
  expect((await stored(page)).setups).toEqual(data.setups);
  await page.getByTestId("gear-delete").click();
  await page.locator("#acOk").click();
  await expect(page.getByTestId("gear-active-name")).toHaveText(MAIN.name);
  let now = await stored(page);
  expect(now.setups.map((s) => s.id)).toEqual(["s1"]);
  expect(now.sightMarks.some((m) => m.setupId === "s2")).toBe(false);
  expect(now.sessions).toEqual(data.sessions);
  expect(now.trash).toHaveLength(1);
  await page.locator('#tabs [data-v="record"]').click();
  await page.locator("#btnSettings").click();
  const trash = page.getByTestId("settings-trash");
  await expect(trash).toContainText("1件");
  await trash.click();
  await page.locator("[data-restore-trash]").click();
  await expect(page.getByTestId("trash-sheet")).toHaveCount(0);
  await expect(page.getByTestId("settings-trash")).toContainText("0件");
  now = await stored(page);
  expect(now.setups.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
  expect([...now.sightMarks].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
    [...data.sightMarks].sort((a, b) => a.id.localeCompare(b.id)),
  );
  expect(now.trash).toEqual([]);
  expect(errors).toEqual([]);
});

test("the sight scale figure and the distance rows show the ledger values", async ({ page }) => {
  const data = gearDb();
  const errors = await open(page, data);
  await gotoSight(page);
  const scale = page.getByTestId("sight-scale");
  await expect(scale).toBeVisible();
  const marks = () =>
    scale
      .locator("[data-scale-dist]")
      .evaluateAll((els) =>
        els
          .map((e) => [e.dataset.scaleDist, e.dataset.scaleKind, e.dataset.scaleV].join(":"))
          .sort(),
      );
  const pred50 = await page.evaluate(() => globalThis.sightInterp("s1").est(50).toFixed(1));
  expect(await marks()).toEqual(["18:rec:1.85", "30:rec:2.60", `50:pred:${pred50}`, "70:rec:5.20"]);
  await expect(scale).toHaveAttribute(
    "aria-label",
    /70m 5\.20、50m [0-9.]+（予測）、30m 2\.60、18m 1\.85/,
  );
  const rows = page.locator("#sgDistChips [data-d]");
  await expect(rows).toHaveCount(4);
  await expect(rows.locator(".lv")).toHaveText([
    "5.2010/28 実測",
    `${pred50}予測（実測3点から）`,
    "2.609/20 実測",
    "1.8511/1 実測",
  ]);
  await expect(page.getByTestId("sight-h-note")).toHaveText("左右は全距離 0 です。");
  /* 距離の行を押すと、その距離の記録（新しい順）に切り替わる */
  await expect(page.locator('#sgDistChips [aria-pressed="true"]')).toHaveAttribute("data-d", "70");
  await expect(page.locator("[data-sight-id]")).toHaveCount(2);
  await expect(page.locator("[data-sight-id]").first()).toHaveAttribute("data-sight-id", "m1");
  await page.locator('#sgDistChips [data-d="30"]').click();
  await expect(page.locator('#sgDistChips [aria-pressed="true"]')).toHaveAttribute("data-d", "30");
  await expect(page.getByTestId("sight-dist-records").getByRole("heading")).toHaveText(
    "30m の記録",
  );
  await expect(page.locator("[data-sight-id]")).toHaveCount(1);
  /* 記録すると、図と行が新しい値になる。前の記録は残る */
  await page.locator('#sgDistChips [data-d="50"]').click();
  await expect(page.getByTestId("sight-ledger-empty")).toBeVisible();
  await page.getByTestId("sight-add").click();
  await page.locator("#mkV").fill("3.90");
  await page.locator("#mkH").fill("0");
  await page.locator("#mkSave").click();
  expect(await marks()).toEqual(["18:rec:1.85", "30:rec:2.60", "50:rec:3.90", "70:rec:5.20"]);
  await expect(scale.locator('[stroke-dasharray="4 3"]')).toHaveCount(0);
  const after = await stored(page);
  expect(after.sightMarks.slice(0, data.sightMarks.length)).toEqual(data.sightMarks);
  expect(after.sightMarks.at(-1)).toMatchObject({ setupId: "s1", dist: 50, v: "3.90", h: "0" });
  /* セッティングを替えると、そのセッティングの値だけになる */
  await page.locator("#sgSetup").selectOption("s2");
  expect(await marks()).toEqual(["18:rec:9.99"]);
  /* 校正する: いまの最新の値が欄に入っていて、取り消せば何も変わらない */
  await page.locator("#sgSetup").selectOption("s1");
  await page.getByTestId("sight-calibrate").click();
  await expect(page.getByTestId("sight-calibration")).toContainText("前の記録は残ります");
  await expect(page.locator("#calV_70")).toHaveValue("5.20");
  await expect(page.locator("#calV_50")).toHaveValue("3.90");
  await page.locator("#calCancel").click();
  expect((await stored(page)).sightMarks).toEqual(after.sightMarks);
  expect(errors).toEqual([]);
});

test("a sight value written with a comma or full-width digits is read the same in the ledger and the prediction", async ({
  page,
}) => {
  // 「5,2」「４．５」も、台帳・目盛りの図・予測で同じ数として読む（以前は台帳では数値なし、予測では 5）
  const data = gearDb();
  const m70 = data.sightMarks.find((m) => m.setupId === "s1" && m.dist === 70 && m.id === "m1");
  m70.v = "5,2";
  data.sightMarks.push({
    id: "mfw",
    setupId: "s1",
    dist: 18,
    v: "１．９",
    h: "0",
    date: "2026-11-11",
    ts: 1794200000000,
  });
  const errors = await open(page, data);
  await gotoSight(page);
  const scale = page.getByTestId("sight-scale");
  const marks = await scale
    .locator("[data-scale-dist]")
    .evaluateAll((els) =>
      els.map((e) => [e.dataset.scaleDist, e.dataset.scaleKind, e.dataset.scaleV].join(":")).sort(),
    );
  expect(marks).toContain("70:rec:5.2");
  expect(marks).toContain("18:rec:1.9");
  const used = await page.evaluate(() => {
    const it = globalThis.sightInterp("s1");
    return it.pts.map((p) => p.join(":")).sort();
  });
  expect(used).toContain("70:5.2");
  expect(used).toContain("18:1.9");
  // 保存された文字はそのまま
  const after = await stored(page);
  expect(after.sightMarks.find((m) => m.id === "m1").v).toBe("5,2");
  expect(after.sightMarks.find((m) => m.id === "mfw").v).toBe("１．９");
  expect(errors).toEqual([]);
});

test("the adjustment guide states the decision, the numbers, n and its basis in plain copy", async ({
  page,
}) => {
  const data = gearDb();
  const errors = await open(page, data);
  await gotoSight(page);
  const sec = page.getByTestId("sight-advice-section");
  await expect(sec.getByRole("heading", { name: "調整の目安" })).toBeVisible();
  await expect(sec.locator(".vsecH .aside")).toHaveText("70m・11/10（火）の記録");
  const model = await page.evaluate(() => {
    const sess = db.sessions.find((s) => s.id === "p6");
    const setup = db.setups[0];
    const adv = globalThis.adviceFor(sess, setup);
    const ss = globalThis.sightStats(adv.st);
    return {
      n: ss.n,
      mx: ss.mx,
      my: ss.my,
      ciH: adv.decision.h.ci.toFixed(1),
      ciV: adv.decision.v.ci.toFixed(1),
      moveH: adv.decision.h.move,
      moveV: adv.decision.v.move,
    };
  });
  const figs = sec.locator(".fig");
  await expect(figs).toHaveCount(2);
  await expect(figs.nth(0).locator(".l")).toHaveText("左右");
  await expect(figs.nth(1).locator(".l")).toHaveText("上下");
  expect(model.moveH || model.moveV).toBe(false);
  await expect(figs.locator(".n")).toHaveText(["動かさない", "動かさない"]);
  const word = (v, pos, neg) => `${v > 0 ? pos : neg} ${Math.abs(v).toFixed(1)}cm`;
  await expect(figs.nth(0).locator(".d")).toHaveText(`着弾中心 ${word(model.mx, "右", "左")}`);
  await expect(figs.nth(1).locator(".d")).toHaveText(`着弾中心 ${word(model.my, "上", "下")}`);
  const fact = sec.getByTestId("sight-advice-fact");
  await expect(fact).toContainText(`位置のある ${model.n}射`);
  await expect(fact).toContainText(`95%区間は 左右 ±${model.ciH}cm・上下 ±${model.ciV}cm`);
  await expect(fact).toHaveText(/確率は [0-9.]+% です。$/);
  await expect(sec.getByTestId("sight-advice-basis")).toContainText(
    "同時の検定で 5% 未満になり、その方向の 95%区間が 0 を含まず、補正量がリング幅の 1/10 以上のときだけ",
  );
  /* 外れ値候補を除いた中心の移り変わり（サイトの判断に使う値）。対象を見出しに書く */
  const drift = sec.getByTestId("sight-centre-drift");
  await expect(drift).toContainText("外れ値候補を除いた中心（70m・122cm的・直近 6回）");
  await expect(drift.locator("table tr")).toHaveCount(7);
  await expect(drift.locator("svg")).toHaveAttribute("role", "img");
  /* 計算の内訳は折りたたみ。数値と件数だけ */
  const fold = sec.getByTestId("sight-basis-fold");
  await fold.locator("summary").click();
  await expect(fold).toContainText("初速");
  await expect(fold).toContainText("fps");
  /* 中心を大きくずらした記録では、方向と量、換算の出どころが出る */
  await page.evaluate(() => {
    const s = db.sessions.find((x) => x.id === "p6");
    s.ends.forEach((e) =>
      e.forEach((a) => {
        a.x += 9;
        a.y -= 7;
      }),
    );
    db.setups[0].calibV70 = 4;
    globalThis.save();
    globalThis.render();
  });
  await expect(figs.nth(0).locator(".n")).toHaveText(/^右へ [0-9.]+mm$/);
  await expect(figs.nth(1).locator(".n")).toHaveText(/^下へ [0-9.]+クリック$/);
  await expect(sec.getByTestId("sight-advice-basis")).toContainText("70m で 1クリック = 4cm");
  await expect(sec.getByTestId("sight-advice-basis")).toContainText("アイ〜サイト距離 850mm");
  /* 着弾の無い距離は、その理由を書く（数値を作らない） */
  await page.locator('#sgDistChips [data-d="30"]').click();
  await expect(page.getByTestId("sight-advice-empty")).toHaveText(
    "この距離の練習の記録がないため、着弾中心からの目安は出せません。",
  );
  await page.locator('#sgDistChips [data-d="70"]').click();
  const text = await expectCleanCopy(page.locator("#main"), "sight");
  for (const w of ["いまの提案", "判断保留", "調整不要", "次のアクション", "個人補正", "準備度"])
    expect(text).not.toContain(w);
  await expect(page.getByTestId("sight-hero")).toHaveCount(0);
  expect(errors).toEqual([]);
});

/* v5 段 9: 今日の結果とノートの詳細の折りたたみも、サイトの画面と同じ調整の目安を出す */
const OLD_ADVICE_LABELS = [
  "判断信頼度",
  "演算信頼度",
  "次のアクション",
  "個人モデル",
  "動かすべきか",
  "サイト調整の提案",
  "次の重点",
  "精度向上",
  "公式",
];
for (const size of [
  { width: 375, height: 812 },
  { width: 320, height: 640 },
])
  test(`result and note detail use the sight screen's adjustment guide (${size.width})`, async ({
    page,
  }) => {
    const data = gearDb();
    const errors = await open(page, data, size);
    await gotoSight(page);
    const sightFact = await page.getByTestId("sight-advice-fact").textContent();
    for (const [surface, testid, show] of [
      [
        "note detail",
        "note-sight-details",
        (id) => page.evaluate((i) => globalThis.openHistDetail(i), id),
      ],
      [
        "result",
        "result-sight-details",
        (id) =>
          page.evaluate(
            (i) =>
              globalThis.openSummary(
                db.sessions.find((s) => s.id === i),
                false,
              ),
            id,
          ),
      ],
    ]) {
      /* 位置のある記録: 同じ文（着弾中心・射数・95%区間・確率） */
      await show("p6");
      const fold = page.getByTestId(testid);
      await fold.locator("summary").click();
      await expect(fold.getByTestId("sight-advice-fact")).toHaveText(sightFact);
      await expect(fold.locator(".sightAdvice .fig .n")).toHaveText(["動かさない", "動かさない"]);
      await expect(fold.locator(".foldH")).toHaveText("着弾の数値");
      let text = await expectCleanCopy(fold, surface);
      for (const w of OLD_ADVICE_LABELS) expect(text, `${surface}: "${w}"`).not.toContain(w);
      const fit = await fold.evaluate((el) => ({
        over: el.scrollWidth > el.clientWidth + 1,
        small: [...el.querySelectorAll("*")].filter(
          (e) =>
            e.getClientRects().length &&
            !e.closest("svg") &&
            [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) &&
            parseFloat(globalThis.getComputedStyle(e).fontSize) < 13,
        ).length,
        summaryH: el.querySelector("summary").getBoundingClientRect().height,
      }));
      expect(fit.over, `${surface}: no horizontal overflow`).toBe(false);
      expect(fit.small, `${surface}: no text under 13px`).toBe(0);
      expect(fit.summaryH).toBeGreaterThanOrEqual(44);
      await page.evaluate(() =>
        globalThis.document.querySelectorAll(".ovl").forEach((o) => globalThis.closeModal(o)),
      );
      await expect(page.locator(".ovl")).toHaveCount(0);
      /* 点数だけの記録: 目安も着弾の数値も出さない */
      await show("p5");
      await fold.locator("summary").click();
      await expect(fold.getByTestId("sight-advice")).toHaveCount(0);
      await expect(fold.getByTestId("session-sight-empty")).toHaveText(
        "着弾データなし。位置のある矢がない記録のため、着弾中心からの目安は出せません。",
      );
      text = await expectCleanCopy(fold, `${surface} (score only)`);
      for (const w of OLD_ADVICE_LABELS) expect(text, `${surface}: "${w}"`).not.toContain(w);
      expect(text).not.toMatch(/\d(\.\d+)?\s?(cm|mm|クリック|目盛り)/);
      await page.evaluate(() =>
        globalThis.document.querySelectorAll(".ovl").forEach((o) => globalThis.closeModal(o)),
      );
      await expect(page.locator(".ovl")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

test("settings opens full-screen from the record title row and from the recording menu", async ({
  page,
}) => {
  const data = gearDb();
  const errors = await open(page, data);
  await page.locator("#btnSettings").click();
  const screen = page.getByTestId("settings-screen");
  await expect(screen).toBeVisible();
  await expect(screen.getByRole("heading", { name: "設定", exact: true })).toBeVisible();
  await expect(screen.locator(".modalSwipeHandle")).toHaveCount(0);
  const box = await screen.boundingBox();
  expect(box.y).toBeLessThanOrEqual(0);
  expect(box.height).toBeGreaterThanOrEqual(812);
  await expect(screen.locator(".vsecH h2")).toHaveText(["表示", "記録", "データ", "アプリ"]);
  for (const g of ["display", "record", "data", "app"])
    await expect(screen.getByTestId(`settings-group-${g}`)).toHaveCount(1);
  await expect(page.getByTestId("settings-back")).toHaveText("記録");
  /* 各組の中身 */
  for (const id of [
    "settings-theme-chips",
    "settings-field-mode-chips",
    "settings-lens-side-chips",
  ])
    await expect(screen.getByTestId("settings-group-display").getByTestId(id)).toHaveCount(1);
  for (const id of [
    "settings-custom-rounds",
    "settings-eye-sight",
    "settings-form-tracking-chips",
    "gamify-toggle",
  ])
    await expect(screen.getByTestId("settings-group-record").getByTestId(id)).toHaveCount(1);
  for (const id of [
    "settings-storage-meter",
    "settings-export",
    "settings-import",
    "settings-csv",
    "settings-snapshots",
    "settings-trash",
  ])
    await expect(screen.getByTestId("settings-group-data").getByTestId(id)).toHaveCount(1);
  for (const id of [
    "settings-add-home",
    "settings-version",
    "settings-license",
    "settings-app-info",
  ])
    await expect(screen.getByTestId("settings-group-app").getByTestId(id)).toHaveCount(1);
  await expect(screen.getByTestId("settings-version")).toContainText(/Archery Note v\d+/);
  await expect(screen.getByTestId("settings-license")).toContainText(
    "PolyForm Noncommercial 1.0.0",
  );
  await expectCleanCopy(screen, "settings");
  /* バッジは、目標と連続記録を入にしたときだけ（読んでいた位置は保つ） */
  await expect(screen.getByTestId("badge-section")).toHaveCount(0);
  await screen.getByTestId("gamify-toggle").scrollIntoViewIfNeeded();
  const before = await screen.evaluate((el) => el.scrollTop);
  await screen.getByTestId("gamify-toggle").locator('[data-gm="1"]').click();
  await expect(page.getByTestId("settings-screen").getByTestId("badge-section")).toBeVisible();
  expect(await page.getByTestId("settings-screen").evaluate((el) => el.scrollTop)).toBe(before);
  await expectCleanCopy(page.getByTestId("settings-screen"), "settings (goals on)");
  await page.getByTestId("gamify-toggle").locator('[data-gm="0"]').click();
  await expect(page.getByTestId("badge-section")).toHaveCount(0);
  await page.getByTestId("settings-add-home").click();
  await expect(page.locator(".ovl")).toHaveCount(2);
  await page.locator("#a2hClose").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".ovl")).toHaveCount(0);
  /* 記録中: メニュー → 設定。閉じると記録の画面に戻る */
  await page.getByTestId("record-start").click();
  await expect(page.locator("#btnSettings")).toBeHidden();
  await page.getByTestId("active-menu").click();
  await page.locator("#mSettings").click();
  await expect(page.getByTestId("settings-screen")).toBeVisible();
  await expect(page.getByTestId("settings-back")).toHaveText("戻る");
  await expect(page.getByTestId("settings-screen").locator(".vsecH h2")).toHaveText([
    "表示",
    "記録",
    "データ",
    "アプリ",
  ]);
  await page.getByTestId("settings-back").click();
  await expect(page.locator(".ovl")).toHaveCount(0);
  await expect(page.getByTestId("active-menu")).toBeVisible();
  expect((await stored(page)).sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("data-loss warnings sit next to export, import, restore and the irreversible actions", async ({
  page,
}) => {
  const data = gearDb();
  data.trash = [
    {
      id: "t1",
      type: "note",
      label: "架空のメモ",
      data: { id: "n9", date: "2026-11-01", ts: 1, text: "x" },
      date: "2026-11-05",
      ts: 5,
    },
  ];
  data.settings.lastBackupAt = "2026-11-10T03:00:00.000Z";
  const errors = await open(page, data);
  await page.locator("#btnSettings").click();
  const group = page.getByTestId("settings-group-data");
  const warn = group.getByTestId("settings-data-warning");
  await expect(warn).toContainText("記録は、この端末のブラウザの中だけにあります");
  await expect(warn).toContainText("このアプリの記録もすべて消えます");
  await expect(warn).toContainText("バックアップを書き出してください");
  /* 並び: 注意書き → 書き出す → 読み込む → CSV → 自動バックアップ → ゴミ箱 → ゴミ箱を空にする */
  const order = await group.evaluate((el) =>
    [...el.querySelectorAll("[data-testid]")]
      .map((n) => n.dataset.testid)
      .filter((id) => id.startsWith("settings-")),
  );
  expect(order).toEqual([
    "settings-data-warning",
    "settings-storage-meter",
    "settings-export",
    "settings-import",
    "settings-csv",
    "settings-snapshots",
    "settings-snapshot-now",
    "settings-snapshot-restore",
    "settings-trash",
    "settings-trash-clear",
  ]);
  await expect(group.getByTestId("settings-export")).toContainText("最後の書き出し: 2026/11/10");
  await expect(group.getByTestId("settings-import")).toContainText(
    "いまのデータは、読み込んだ内容にすべて置き換わります。",
  );
  await expect(group.getByTestId("settings-import")).toContainText("自動バックアップに残します");
  await expect(group.getByTestId("settings-csv")).toContainText(
    "このファイルから元に戻すことはできません",
  );
  await expect(group.getByTestId("settings-snapshots")).toContainText(
    "いまのデータは控えの内容に置き換わります。",
  );
  await expect(group.getByTestId("settings-snapshots")).toContainText(
    "ブラウザのデータを消すと、控えも一緒に消えます",
  );
  await expect(group.getByTestId("settings-trash-clear")).toContainText("元に戻せません");
  /* 読み込みは、置き換えの確認を経る。取り消せば何も変わらない */
  const backup = gearDb();
  backup.sessions = backup.sessions.slice(0, 2);
  await page.locator("#dFile").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  const confirm = page.locator(".confirmSheet");
  await expect(confirm).toContainText("いまのデータは読み込んだ内容にすべて置き換わります");
  await expect(confirm).toContainText("練習2回");
  await page.locator("#acCancel").click();
  expect((await stored(page)).sessions).toEqual(data.sessions);
  /* ゴミ箱を空にする: 確認に「元に戻せません」。取り消せば残る */
  await group.getByTestId("settings-trash-clear").click();
  await expect(page.locator(".confirmSheet")).toContainText("元に戻せません");
  await page.locator("#acCancel").click();
  expect((await stored(page)).trash).toHaveLength(1);
  await group.getByTestId("settings-trash-clear").click();
  await page.locator("#acOk").click();
  await expect(page.getByTestId("settings-trash-clear")).toHaveCount(0);
  await expect(page.getByTestId("settings-trash")).toContainText("0件");
  const after = await stored(page);
  expect(after.trash).toEqual([]);
  expect(after.sessions).toEqual(data.sessions);
  expect(errors).toEqual([]);
});

test("theme, field mode and lens side still apply and persist", async ({ page }) => {
  const data = gearDb({ theme: "light" });
  const errors = await open(page, data);
  await page.locator("#btnSettings").click();
  const html = page.locator("html");
  const pressed = (id) => page.locator(`#${id} [aria-pressed="true"]`);
  await expect(pressed("thChips")).toHaveAttribute("data-th", "light");
  await expect(page.locator("#thChips button")).toHaveText(["自動", "ライト", "ダーク"]);
  await page.locator('#thChips [data-th="dark"]').click();
  await expect(html).toHaveClass(/(^| )dark( |$)/);
  await expect(pressed("thChips")).toHaveCount(1);
  await expect(pressed("thChips")).toHaveAttribute("data-th", "dark");
  await page.locator('#thChips [data-th="auto"]').click();
  await expect(html).toHaveClass(/(^| )auto( |$)/);
  await expect(page.locator("#fmChips button")).toHaveText(["切", "入"]);
  await page.locator('#fmChips [data-fm="1"]').click();
  await expect(html).toHaveClass(/field/);
  await expect(html).toHaveClass(/auto/);
  await expect(pressed("fmChips")).toHaveAttribute("data-fm", "1");
  await expect(pressed("lsChips")).toHaveAttribute("data-ls", "right");
  await page.locator('#lsChips [data-ls="left"]').click();
  await expect(pressed("lsChips")).toHaveAttribute("data-ls", "left");
  await page.locator("#setEye").fill("870");
  await page.locator("#setEye").blur();
  let s = (await stored(page)).settings;
  expect(s).toMatchObject({ theme: "auto", fieldMode: true, lensSide: "left", eyeSight: 870 });
  await page.reload();
  await expect(page.locator("#bootFallback")).toBeHidden();
  await expect(html).toHaveClass(/field/);
  await page.locator("#btnSettings").click();
  await expect(pressed("thChips")).toHaveAttribute("data-th", "auto");
  await expect(pressed("lsChips")).toHaveAttribute("data-ls", "left");
  await expect(page.locator("#setEye")).toHaveValue("870");
  /* 拡大鏡は、記録中に左上へ出る */
  await page.locator("#setClose").click();
  await page.getByTestId("record-start").click();
  await expect(page.locator(".lensLayer, #lensLayer, .lens").first()).toHaveCount(1);
  expect(await page.evaluate(() => db.settings.lensSide)).toBe("left");
  s = (await stored(page)).settings;
  expect(s.lensSide).toBe("left");
  expect(errors).toEqual([]);
});

for (const colorScheme of ["light", "dark"]) {
  test(`gear, sight and settings fit a 320×640 screen (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    const data = gearDb({ theme: colorScheme });
    data.trash = [
      {
        id: "t1",
        type: "note",
        label: "架空のメモ",
        data: { id: "n9", date: "2026-11-01", ts: 1, text: "x" },
        date: "2026-11-05",
        ts: 5,
      },
    ];
    data.setups[0].name = "とても長い名前の架空のセッティング 70m 屋外の試合用";
    const errors = await open(page, data, { width: 320, height: 640 });
    await gotoGear(page);
    await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));
    await expectFit(page, "#main", "gear");
    await page.getByTestId("gear-inputs-fold").locator("summary").click();
    await expectFit(page, "#main", "gear (fold open)");
    await page.getByTestId("gear-edit").click();
    await expectFit(page, ".ovl .sheet", "gear form");
    await page.getByTestId("gear-form-back").click();
    await gotoSight(page);
    await expectFit(page, "#main", "sight");
    const grid = await page.evaluate(() => {
      const s = globalThis.document
        .querySelector('[data-testid="sight-scale"]')
        .getBoundingClientRect();
      const r = globalThis.document.querySelector("#sgDistChips").getBoundingClientRect();
      return {
        scaleRight: s.right,
        rowsLeft: r.left,
        rowsRight: r.right,
        width: globalThis.innerWidth,
      };
    });
    expect(grid.scaleRight).toBeLessThanOrEqual(grid.rowsLeft + 1);
    expect(grid.rowsRight).toBeLessThanOrEqual(grid.width);
    await page.getByTestId("sight-basis-fold").locator("summary").click();
    await page.getByTestId("sight-click-fold").locator("summary").click();
    await page.locator(".sightPrediction details summary").first().click();
    await expectFit(page, "#main", "sight (folds open)");
    await page.getByTestId("sight-calibrate").click();
    await expectFit(page, ".ovl .sheet", "calibration");
    await page.locator("#calCancel").click();
    await page.locator('#tabs [data-v="record"]').click();
    await page.locator("#btnSettings").click();
    await expectFit(page, ".ovl .sheet", "settings");
    await page.getByTestId("gamify-toggle").locator('[data-gm="1"]').click();
    await page.getByTestId("settings-app-info").locator("summary").click();
    await expectFit(page, ".ovl .sheet", "settings (goals on)");
    expect(errors).toEqual([]);
  });
}

test("after writing a backup, restoring the selected snapshot restores that one, and CSV does not count as a backup", async ({
  page,
}) => {
  const data = gearDb();
  data.settings.lastBackupAt = null;
  await page.addInitScript((d) => {
    if (globalThis.sessionStorage.getItem("__snapSeeded")) return;
    globalThis.sessionStorage.setItem("__snapSeeded", "1");
    const mk = (date, n) => ({
      ts: date.getTime(),
      reason: "test",
      hash: `h${n}`,
      counts: { sessions: n, setups: 1, marks: 0 },
      data: { ...d, sessions: d.sessions.slice(0, n) },
    });
    globalThis.localStorage.setItem(
      "archeryNote.snapshots.v1",
      JSON.stringify([mk(new Date(2026, 10, 11, 10, 0), 2), mk(new Date(2026, 10, 10, 9, 0), 1)]),
    );
  }, data);
  const errors = await open(page, data);
  await page.locator("#btnSettings").click();
  const sel = page.locator("#dSnapSel");
  await sel.selectOption({ label: "2026/11/11 10:00" });
  await expect(page.getByTestId("settings-snapshot-info")).toHaveText(
    "この控えの中身: 練習2・セッティング1・サイト0",
  );
  /* CSV は元に戻せないので「最後の書き出し」は変わらない */
  const csv = page.waitForEvent("download");
  await page.getByTestId("settings-csv").click();
  await csv;
  expect((await stored(page)).settings.lastBackupAt).toBeNull();
  /* 書き出すと新しい控えが先頭に入る。選んでいた控えはそのまま */
  const json = page.waitForEvent("download");
  await page.getByTestId("settings-export").click();
  await json;
  expect((await stored(page)).settings.lastBackupAt).not.toBeNull();
  await page.getByTestId("settings-snapshot-restore").click();
  await expect(page.locator(".confirmSheet")).toContainText(
    "2026/11/11 10:00（練習2・セッティング1・サイト0） の控えに戻します",
  );
  await page.locator("#acCancel").click();
  expect(errors).toEqual([]);
});
