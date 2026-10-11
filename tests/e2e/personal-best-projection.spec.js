"use strict";
const fs = require("node:fs");
const { test, expect } = require("@playwright/test");
const fixtures = require("../../docs/codex/evidence/analysis-evidence-v110/fixtures.json");
test.use({ hasTouch: true, isMobile: true });
test.describe.configure({ mode: "parallel" });
async function settled(page) {
  await page.evaluate(async () => {
    await globalThis.document.fonts.ready;
    await Promise.all(
      globalThis.document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect.getTiming().iterations))
        .map((a) => a.finished.catch(() => {})),
    );
    await new Promise((r) =>
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(r)),
    );
  });
}
async function tap(page, selector) {
  await settled(page);
  const p = await page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2;
    return { x, y, clear: el.contains(globalThis.document.elementFromPoint(x, y)) };
  });
  expect(p.clear).toBe(true);
  await page.touchscreen.tap(p.x, p.y);
}
async function stored(page) {
  return page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")));
}
function preserve(info, name, value) {
  fs.writeFileSync(info.outputPath(name + ".json"), JSON.stringify(value, null, 2));
}
async function readRow(page, info, name, width) {
  const row = page.getByTestId("todays-result-personal-best");
  await row.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await settled(page);
  const observed = await row.evaluate((el) => {
    const r = el.getBoundingClientRect(),
      overlay = el.closest(".ovl"),
      footer = overlay.querySelector(".histDetailActions");
    return {
      text: el.innerText,
      primary: el.querySelector(".todaysResultPrimary").innerText,
      detail: el.querySelector(".todaysResultDetail").innerText,
      rect: r.toJSON(),
      footer: footer?.getBoundingClientRect().toJSON(),
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      clear: [
        [r.x + r.width / 2, r.y + r.height / 2],
        [r.left + 5, r.top + 5],
        [r.right - 5, r.bottom - 5],
      ].every(([x, y]) => el.contains(globalThis.document.elementFromPoint(x, y))),
    };
  });
  await page.screenshot({ path: info.outputPath(name + ".png") });
  preserve(info, name, observed);
  expect(observed.rect.left).toBeGreaterThanOrEqual(0);
  expect(observed.rect.right).toBeLessThanOrEqual(width);
  expect(observed.scrollWidth).toBeLessThanOrEqual(observed.clientWidth + 1);
  expect(observed.clear).toBe(true);
  if (observed.footer) expect(observed.rect.bottom).toBeLessThanOrEqual(observed.footer.top);
  return observed;
}
function assertCopy(row, projected, relation, n, label, total, bestTotal) {
  expect(row.detail).toContain(`${label} ${total}点`);
  expect(row.detail).toContain(`${bestTotal}点`);
  expect(row.detail).toContain("2026/10/2");
  if (projected) {
    expect(row.primary).toContain("自己ベストの換算値");
    expect(row.detail).toContain(`推定・${n}本換算`);
    expect(row.primary).not.toContain("更新");
    if (relation === "above") expect(row.primary).toContain("上回りました");
  } else {
    expect(row.text).not.toContain("換算");
    expect(row.text).not.toContain("推定");
    if (relation === "above") expect(row.primary).toContain("更新");
  }
  if (relation === "tie") expect(row.primary).toContain("並びました");
  if (relation === "below") expect(row.primary).toContain(`あと${bestTotal - total}点`);
}
async function seed(page, theme, active) {
  await page.addInitScript(
    (data) => {
      if (!globalThis.localStorage.getItem("archeryNote.v1"))
        globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(data));
    },
    {
      schema: 5,
      settings: { onboardingSeen: true, activeGuideSeen: true, theme, launchCount: 10 },
      sessions: fixtures.old,
      active,
    },
  );
}
for (const width of [320, 375])
  for (const theme of ["light", "dark"])
    for (const n of [1, 6])
      for (const relation of ["below", "tie", "above"]) {
        test(`PB projection (${width}, ${theme}, ${n}, ${relation})`, async ({ page }, info) => {
          const errors = [];
          page.on("pageerror", (e) => errors.push(e.message));
          await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
          await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
          const x = { below: 8, tie: 3.2, above: 0 }[relation],
            s = { below: 7, tie: 9, above: 10 }[relation];
          const arrows = Array.from({ length: n }, () => ({ x, y: 0, s, X: relation === "above" }));
          const active = {
            ...fixtures.old[0],
            id: `owned-pb-${width}-${theme}-${n}-${relation}`,
            date: "2026-10-12",
            startedAt: 1,
            ends: [],
            cur: arrows,
            sel: -1,
          };
          await seed(page, theme, active);
          await page.goto("/");
          await tap(page, "#bFinish");
          const saved = await stored(page),
            current = saved.sessions.at(-1);
          expect(saved.sessions.slice(0, 3)).toEqual(fixtures.old);
          expect(current.ends).toEqual([arrows]);
          const pb = await page.evaluate(
            (id) =>
              globalThis.computePersonalBestDistance(
                JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).sessions,
                id,
              ),
            current.id,
          );
          expect(pb.method).toBe(n === 1 ? "avg-projected" : "exact-count");
          expect(pb.bestTotal).toBe(9 * n);
          expect(pb.todayTotal).toBe(s * n);
          const scores = await page.evaluate(
            (session) =>
              session.ends.flat().map((a) => ({
                saved: a,
                calculated: globalThis.scoreAt(
                  a.x,
                  a.y,
                  session.faceD,
                  session.faceType,
                  globalThis.lineCutRadius(session.faceD, session.faceType),
                ),
              })),
            current,
          );
          for (const p of scores) {
            expect(p.saved.s).toBe(p.calculated.s);
            expect(p.saved.X).toBe(p.calculated.X);
          }
          const summary = await readRow(page, info, "summary", width);
          assertCopy(summary, n === 1, relation, n, "今日", s * n, 9 * n);
          await page.locator("#sumClose").scrollIntoViewIfNeeded();
          await tap(page, "#sumClose");
          await tap(page, '#tabs [data-v="history"]');
          await page.locator(`.historyRow[data-id="${current.id}"]`).click();
          const history = await readRow(page, info, "history", width);
          assertCopy(history, n === 1, relation, n, "この日", s * n, 9 * n);
          await tap(page, "#hClose");
          await page.reload();
          expect((await stored(page)).sessions).toEqual(saved.sessions);
          expect(errors).toEqual([]);
          preserve(info, "complete", {
            width,
            theme,
            n,
            relation,
            pb,
            summary,
            history,
            oldRecordsExact: true,
            reloadExact: true,
            scores,
            errors,
          });
        });
      }
for (const width of [320, 375])
  test(`native PB projection after one-arrow finish (${width})`, async ({ page }, info) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page, "light", null);
    await page.goto("/");
    await tap(page, "#quickStart");
    await settled(page);
    const point = await page.locator("#tgsvg").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.touchscreen.tap(point.x, point.y);
    await expect.poll(async () => (await stored(page)).active.cur.length).toBe(1);
    const active = (await stored(page)).active;
    expect(active.cur[0].s).toBe(10);
    await tap(page, "#bFinish");
    const summary = await readRow(page, info, "native-summary", width);
    assertCopy(summary, true, "above", 1, "今日", 10, 9);
    await page.locator("#sumClose").scrollIntoViewIfNeeded();
    await tap(page, "#sumClose");
    const saved = await stored(page),
      current = saved.sessions.at(-1);
    expect(saved.sessions.slice(0, 3)).toEqual(fixtures.old);
    expect(current.ends).toEqual([active.cur]);
    await tap(page, '#tabs [data-v="history"]');
    await page.locator(`.historyRow[data-id="${current.id}"]`).click();
    const history = await readRow(page, info, "native-history", width);
    assertCopy(history, true, "above", 1, "この日", 10, 9);
    await tap(page, "#hClose");
    await page.reload();
    expect((await stored(page)).sessions).toEqual(saved.sessions);
    expect(errors).toEqual([]);
    preserve(info, "native-complete", { width, active, saved, summary, history, errors });
  });
