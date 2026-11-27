/* global db, ui, save, trashItem, restoreTrash, roundLabel */
"use strict";
const { test, expect } = require("@playwright/test");
const { homeResultDb } = require("./fixtures/home-result-db");
const { formV2Stream, installFormV2Stub } = require("./fixtures/form-v2-stream.js");

/* 2026-11 の見直しで見つけた、ノート・サイト・設定・射型の不具合の検査（直す前のスクリプトでは落ちる）。 */
test.use({ serviceWorkers: "block" });

const KEY = "archeryNote.v1";
async function open(page, data, opts) {
  const o = opts || {};
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (o.init) await page.addInitScript(o.init);
  await page.addInitScript(
    ([key, d]) => {
      if (!globalThis.localStorage.getItem(key))
        globalThis.localStorage.setItem(key, JSON.stringify(d));
    },
    [KEY, data],
  );
  await page.goto("/");
  await page.waitForSelector("#tabs", { state: "attached" });
  return errors;
}
const stored = (page) =>
  page.evaluate((key) => JSON.parse(globalThis.localStorage.getItem(key)), KEY);
async function toSight(page) {
  await page.locator('#tabs [data-v="gear"]').click();
  await page.locator('#gearSubTabs [data-sub="sight"]').click();
  await expect(page.getByTestId("sight-add")).toBeVisible();
}

test("sight: saving a mark with both values empty is refused and the latest mark stays", async ({
  page,
}) => {
  const errors = await open(page, homeResultDb());
  await toSight(page);
  const before = (await stored(page)).sightMarks.length;
  await page.getByTestId("sight-add").click();
  await page.locator("#mkSave").click();
  await expect(page.locator("#toast")).toHaveText("上下か左右の目盛りを入れてください");
  expect((await stored(page)).sightMarks.length).toBe(before);
  await page.locator("#mkV").fill("5.4");
  await page.locator("#mkSave").click();
  expect((await stored(page)).sightMarks.length).toBe(before + 1);
  expect(errors).toEqual([]);
});

test("sight: both click calibration fields can be filled one after the other, with comma and full-width digits", async ({
  page,
}) => {
  const errors = await open(page, homeResultDb());
  await toSight(page);
  await page.getByTestId("sight-click-fold").locator("summary").click();
  await page.locator("#sgCalV").click();
  await page.keyboard.type("4,5");
  await page.locator("#sgCalH").click();
  await expect(page.getByTestId("sight-click-fold")).toHaveAttribute("open", "");
  await expect(page.locator("#sgCalH")).toBeFocused();
  await page.keyboard.insertText("３");
  await page.keyboard.press("Tab");
  await expect.poll(async () => (await stored(page)).setups[0].calibH70).toBe(3);
  const s = (await stored(page)).setups[0];
  expect({ v: s.calibV70, h: s.calibH70 }).toEqual({ v: 4.5, h: 3 });
  await expect(page.getByTestId("sight-click-fold")).toHaveAttribute("open", "");
  expect(errors).toEqual([]);
});

test("notes: a deleted setup no longer filters the list, and 未指定 includes its records", async ({
  page,
}) => {
  const errors = await open(page, homeResultDb());
  await page.locator('#tabs [data-v="history"]').click();
  const toggle = page.getByTestId("history-filter-toggle");
  await toggle.click();
  await page.locator("#histSetup").selectOption("s2");
  const rows = () => page.locator("#histList [data-id]").count();
  expect(await rows()).toBe(1);
  await page.locator('#tabs [data-v="gear"]').click();
  await page.evaluate(() => {
    ui.gearSel = "s2";
    globalThis.render();
  });
  await page.getByTestId("gear-delete").click();
  await page.locator("#acOk").click();
  await page.locator('#tabs [data-v="history"]').click();
  await expect(page.locator("#histSetup")).toHaveValue("");
  expect(await rows()).toBe(9);
  await page.getByTestId("history-filter-toggle").click();
  await page.locator("#histSetup").selectOption("__none");
  expect(await rows()).toBe(1);
  expect(errors).toEqual([]);
});

test("trash: a restored practice goes back to its place by date and time", async ({ page }) => {
  const d = homeResultDb();
  /* 同じ日に 2 回（朝の 70m、午後の 18m）。保存の並びも朝 → 午後 */
  const morning = Object.assign(JSON.parse(JSON.stringify(d.sessions[6])), {
    id: "morning",
    date: "2026-11-11",
    ts: new Date("2026-11-11T09:00:00").getTime(),
  });
  const afternoon = Object.assign(JSON.parse(JSON.stringify(d.sessions[8])), {
    id: "afternoon",
    date: "2026-11-11",
    ts: new Date("2026-11-11T15:00:00").getTime(),
  });
  d.sessions.push(morning, afternoon);
  const errors = await open(page, d);
  const order = await page.evaluate(() => {
    const i = db.sessions.findIndex((s) => s.id === "morning");
    trashItem("session", "朝", db.sessions[i]);
    db.sessions.splice(i, 1);
    save();
    restoreTrash(db.trash[0].id);
    return db.sessions.map((s) => s.id);
  });
  expect(order.indexOf("morning")).toBeLessThan(order.indexOf("afternoon"));
  expect(order.filter((id) => id === "morning")).toHaveLength(1);
  /* 記録タブの「前回の練習」（日付の新しい順のいちばん上）は午後のまま */
  expect(await page.evaluate(() => globalThis.sessionsByDateDesc()[0].id)).toBe("afternoon");
  expect(errors).toEqual([]);
});

test("custom round: deleting or changing a round used by past practice keeps how that practice reads", async ({
  page,
}) => {
  const d = homeResultDb();
  d.customRounds = [
    {
      id: "cr-used",
      label: "架空の 50m+30m",
      stages: [
        { dist: 50, faceD: 80, faceType: "single", arrows: 36, perEnd: 6 },
        { dist: 30, faceD: 80, faceType: "single", arrows: 36, perEnd: 6 },
      ],
    },
    {
      id: "cr-unused",
      label: "架空の未使用",
      stages: [{ dist: 18, faceD: 40, faceType: "single", arrows: 30, perEnd: 3 }],
    },
  ];
  d.sessions.push(
    Object.assign(JSON.parse(JSON.stringify(d.sessions[0])), {
      id: "with-round",
      date: "2026-11-11",
      dist: 50,
      faceD: 80,
      round: "cr-used",
      roundGroup: { gid: "g1", roundId: "cr-used", stage: 0, stageCount: 2 },
    }),
  );
  const errors = await open(page, d);
  const del = async (id) => {
    await page.locator("#btnSettings").click();
    await page.locator(`[data-cr="${id}"]`).click();
    await page.locator("#crDel").click();
    await page.locator("#acOk").click();
    await page.locator("#setClose").click();
  };
  await del("cr-used");
  await del("cr-unused");
  const rounds = (await stored(page)).customRounds;
  expect(rounds.map((r) => [r.id, !!r.archived])).toEqual([["cr-used", true]]);
  expect(await page.evaluate(() => roundLabel("cr-used"))).toBe("架空の 50m+30m");
  /* 設定の一覧と記録の条件の選択肢には出さない */
  await page.locator("#btnSettings").click();
  await expect(page.locator('[data-cr="cr-used"]')).toHaveCount(0);
  await page.locator("#setClose").click();
  await page.getByTestId("record-conditions").click();
  await expect(page.locator('#fRound option[value="cr-used"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("import: when no copy of the current data can be kept, it asks first and cancelling keeps everything", async ({
  page,
}) => {
  const errors = await open(page, homeResultDb(), {
    init: () => {
      const original = globalThis.Storage.prototype.setItem;
      globalThis.Storage.prototype.setItem = function (key, value) {
        if (key === "archeryNote.snapshots.v1")
          throw new globalThis.DOMException("full", "QuotaExceededError");
        return original.call(this, key, value);
      };
    },
  });
  const backup = homeResultDb();
  backup.sessions = backup.sessions.slice(0, 1);
  await page.locator("#btnSettings").click();
  await page.locator("#dFile").setInputFiles({
    name: "archery-note-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.locator("#acOk").click(); // 読み込むと置き換わります
  await expect(page.locator(".confirmSheet")).toContainText("控えを残せません");
  await page.locator("#acCancel").click();
  expect((await stored(page)).sessions).toHaveLength(9);
  expect(await page.evaluate(() => db.sessions.length)).toBe(9);
  await expect(page.locator("#toast")).not.toHaveText("読み込みました");
  /* 控えなしで読み込むと選んだときだけ置き換える */
  await page.locator("#dFile").setInputFiles({
    name: "archery-note-backup-2.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.locator("#acOk").click();
  await page.locator("#acOk").click();
  await expect(page.locator("#toast")).toHaveText("読み込みました");
  expect((await stored(page)).sessions).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("two tabs: a save in one tab is picked up by the other, so the other does not overwrite it", async ({
  context,
}) => {
  const a = await context.newPage();
  const errorsA = await open(a, homeResultDb());
  const b = await context.newPage();
  await b.goto("/");
  await b.waitForSelector("#tabs", { state: "attached" });
  /* B で練習を 1 回足す */
  await b.evaluate(() => {
    const s = JSON.parse(JSON.stringify(db.sessions[0]));
    db.sessions.push(Object.assign(s, { id: "from-tab-b", date: "2026-11-12" }));
    save();
  });
  await expect(a.locator("#toast")).toHaveText("ほかの画面で保存された内容に合わせました");
  expect(await a.evaluate(() => db.sessions.some((s) => s.id === "from-tab-b"))).toBe(true);
  /* A で保存しても、B の練習は残る */
  await a.evaluate(() => {
    db.settings.eyeSight = 860;
    save();
  });
  const data = await a.evaluate((key) => JSON.parse(globalThis.localStorage.getItem(key)), KEY);
  expect(data.sessions.some((s) => s.id === "from-tab-b")).toBe(true);
  expect(data.settings.eyeSight).toBe(860);
  expect(errorsA).toEqual([]);
});

/* ---------- 射型の記録 v2 ---------- */
function formDb() {
  const d = homeResultDb();
  d.settings.formTrackingEnabled = true;
  d.formAnalyses = [];
  return d;
}
const screen = (page) => page.getByTestId("form-v2-screen");
async function toCapture(page, stubOpts) {
  await page.locator('#tabs [data-v="analysis"]').click();
  await page.locator('#analysisSubTabs [data-an="form"]').click();
  await installFormV2Stub(page, formV2Stream(), stubOpts);
  await page.locator("#formStart").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "place");
  await expect(page.getByTestId("form-v2-begin")).toBeEnabled();
}

test("form: a double tap on 記録を始める does not end the capture at once", async ({ page }) => {
  const errors = await open(page, formDb());
  await toCapture(page, { pauseAt: 5 });
  const box = await page.getByTestId("form-v2-begin").boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);
  await expect(screen(page)).toHaveAttribute("data-stage", "capture");
  /* 少し待てば、終わるボタンは効く */
  await page.waitForTimeout(500);
  await page.getByTestId("form-v2-finish").click();
  await expect(screen(page)).not.toHaveAttribute("data-stage", "capture");
  expect(errors).toEqual([]);
});

test("form: when the camera track ends during a capture, the screen says so and keeps what was read", async ({
  page,
}) => {
  const errors = await open(page, formDb());
  await toCapture(page, { pauseAt: 600 });
  await page.getByTestId("form-v2-begin").click();
  await expect(screen(page)).toHaveAttribute("data-stage", "capture");
  await page.waitForFunction(() => globalThis.__fv2.i >= 300);
  await page.evaluate(() => {
    const track = globalThis.document
      .querySelector("#fv2Thumb video")
      .srcObject.getVideoTracks()[0];
    track.stop();
    track.dispatchEvent(new globalThis.Event("ended"));
  });
  const err = page.getByTestId("form-v2-error");
  await expect(err).toHaveAttribute("data-kind", "cameraLost");
  await expect(err).toContainText("カメラが止まりました");
  await expect(err).toContainText("は残っています");
  expect(errors).toEqual([]);
});

test("form: right after stopping a recording the button offers もう一度録画, not 動画を残す", async ({
  page,
}) => {
  const errors = await open(page, formDb());
  await toCapture(page, { pauseAt: 600 });
  await page.evaluate(() => {
    globalThis.MediaRecorder = class {
      constructor() {
        this.state = "inactive";
      }
      static isTypeSupported() {
        return true;
      }
      start() {
        this.state = "recording";
        setTimeout(() => this.ondataavailable({ data: new globalThis.Blob(["H;"]) }), 0);
      }
      stop() {
        this.state = "inactive";
        setTimeout(() => {
          this.ondataavailable({ data: new globalThis.Blob(["T;"]) });
          this.onstop();
        }, 300);
      }
    };
  });
  await page.getByTestId("form-v2-begin").click();
  const rec = page.getByTestId("form-v2-rec");
  await rec.click();
  await expect(rec).toHaveText("録画を止める");
  await page.waitForTimeout(60);
  await rec.click();
  await expect(rec).toHaveText("もう一度録画");
  await page.waitForTimeout(500);
  await expect(rec).toHaveText("もう一度録画");
  expect(errors).toEqual([]);
});
