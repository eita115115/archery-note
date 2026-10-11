"use strict";
/* global db */
const fs = require("node:fs");
const { test, expect } = require("@playwright/test");
const { old } = require("../../docs/codex/evidence/analysis-evidence-v110/fixtures.json");
test.use({ hasTouch: true, isMobile: true });
test.describe.configure({ mode: "parallel" });
function dataFor(kind, theme) {
  const sessions = Array.from({ length: 32 }, (_, i) => ({
    ...structuredClone(old[i % 3]),
    id: `owned-metrics-${i}`,
    date: `2026-10-${String(1 + Math.floor(i / 3)).padStart(2, "0")}`,
    dist: i % 5 === 0 ? 30 : 18,
  }));
  if (kind === "sparse")
    sessions.forEach((s, i) => {
      if (i % 3 < 2) s.ends = [s.ends[0].slice(0, (i % 3) + 1)];
    });
  if (kind === "identity") sessions[1].id = sessions[0].id;
  const n = kind === "sparse" ? 1 : 3;
  const cur = Array.from({ length: n }, (_, i) =>
    kind === "score-only" ? { s: 9, X: false } : { x: (i - 1) * 0.4, y: 0, s: 10, X: true },
  );
  const active = {
    ...structuredClone(old[0]),
    id: kind === "edit" ? sessions[0].id : `owned-finish-${kind}`,
    date: kind === "backdated" ? "2026-10-06" : "2026-10-12",
    ends: [],
    cur,
    startedAt: 1,
    sel: -1,
    ...(kind === "edit" ? { _edit: true } : {}),
  };
  return {
    schema: 5,
    settings: {
      theme,
      onboardingSeen: true,
      activeGuideSeen: true,
      launchCount: 10,
      gamification: { enabled: kind === "gamification", practiceDays: [1, 2, 3, 4, 5] },
    },
    sessions,
    active,
  };
}
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
async function arm(page) {
  return page.evaluate(() => {
    const d = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
    const current = structuredClone(d.active);
    if (current.cur.length) current.ends.push(current.cur);
    const edit = !!current._edit;
    delete current.cur;
    delete current.editIndex;
    delete current._edit;
    const population = d.sessions.filter((s) => s && s.date && s.date <= current.date);
    population.push(current);
    const expected = edit
      ? { result: null, before: null }
      : {
          result: globalThis.computeTodaysResult(
            population,
            current.id,
            globalThis.sessionMetrics,
            {
              formAnalyses: d.formAnalyses,
            },
          ),
          before: globalThis.trGrowthBeforeFor(current, population, globalThis.sessionMetrics),
        };
    const original = {
      metrics: globalThis.sessionMetrics,
      result: globalThis.computeTodaysResult,
      before: globalThis.trGrowthBeforeFor,
      summary: globalThis.openSummary,
    };
    let phase = null;
    const counts = new Map(),
      visits = [];
    globalThis.sessionMetrics = function (s) {
      if (phase) {
        counts.set(s, (counts.get(s) || 0) + 1);
        visits.push({ id: s.id, date: s.date, phase });
      }
      return original.metrics(s);
    };
    for (const [key, name] of [
      ["result", "computeTodaysResult"],
      ["before", "trGrowthBeforeFor"],
    ])
      globalThis[name] = function (...args) {
        phase = key;
        try {
          return original[key](...args);
        } finally {
          phase = null;
        }
      };
    globalThis.__finishMetricsEvidence = { expected, current, edit, visits };
    globalThis.openSummary = function (s, isNew, gam, result, before) {
      Object.assign(globalThis.__finishMetricsEvidence, {
        actual: { result, before },
        computations: [...counts].map(([s, calls]) => ({ id: s.id, date: s.date, calls })),
      });
      return original.summary(s, isNew, gam, result, before);
    };
    globalThis.__restoreFinishMetrics = () => {
      globalThis.sessionMetrics = original.metrics;
      globalThis.computeTodaysResult = original.result;
      globalThis.trGrowthBeforeFor = original.before;
      globalThis.openSummary = original.summary;
    };
    return { old: d.sessions, current, expected, edit };
  });
}
async function finish(page, info, label, kind, reload = true) {
  const baseline = await arm(page);
  await settled(page);
  const p = await page.locator("#bFinish").evaluate((el) => {
    const r = el.getBoundingClientRect(),
      x = r.x + r.width / 2,
      y = r.y + r.height / 2;
    return { x, y, clear: el.contains(globalThis.document.elementFromPoint(x, y)) };
  });
  expect(p.clear).toBe(true);
  await page.touchscreen.tap(p.x, p.y);
  await page.locator("#sumPlot").waitFor();
  await settled(page);
  const observed = await page.evaluate(() => {
    const data = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
    const evidence = globalThis.__finishMetricsEvidence;
    globalThis.__restoreFinishMetrics();
    return { data, evidence };
  });
  fs.writeFileSync(
    info.outputPath(label + ".json"),
    JSON.stringify({ baseline, observed }, null, 2),
  );
  await page.screenshot({ path: info.outputPath(label + ".png") });
  expect(observed.evidence.actual).toEqual(baseline.expected);
  expect(observed.data.active).toBeNull();
  if (baseline.edit) {
    expect(observed.data.sessions[0]).toEqual(baseline.current);
    expect(observed.data.sessions.slice(1)).toEqual(baseline.old.slice(1));
    expect(observed.evidence.computations).toEqual([]);
  } else {
    expect(observed.data.sessions.slice(0, baseline.old.length)).toEqual(baseline.old);
    expect(observed.data.sessions.at(-1)).toEqual(baseline.current);
    expect(observed.evidence.computations.length).toBeGreaterThan(0);
    expect(Math.max(...observed.evidence.computations.map((r) => r.calls))).toBe(1);
  }
  if (kind === "backdated")
    expect(observed.evidence.visits.every((r) => r.date <= baseline.current.date)).toBe(true);
  const calculated = await page.evaluate(
    (s) =>
      s.ends
        .flat()
        .filter((a) => Number.isFinite(a.x) && Number.isFinite(a.y))
        .map((a) => ({
          saved: a,
          score: globalThis.scoreAt(
            a.x,
            a.y,
            s.faceD,
            s.faceType,
            globalThis.lineCutRadius(s.faceD, s.faceType),
          ),
        })),
    baseline.current,
  );
  for (const a of calculated) {
    expect(a.score.s).toBe(a.saved.s);
    expect(a.score.X).toBe(a.saved.X);
  }
  const saved = observed.data.sessions;
  if (reload) {
    await page.reload();
    expect(
      await page.evaluate(
        () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).sessions,
      ),
    ).toEqual(saved);
  }
  return observed;
}
async function setup(page, kind, theme, width) {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
  await page.addInitScript(
    (data) => {
      if (!globalThis.localStorage.getItem("archeryNote.v1"))
        globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(data));
    },
    dataFor(kind, theme),
  );
  await page.goto("/");
}
for (const width of [320, 375])
  for (const theme of ["light", "dark"])
    for (const kind of ["daily", "backdated", "sparse", "score-only", "gamification", "edit"])
      test(`finish metrics (${width}, ${theme}, ${kind})`, async ({ page }, info) => {
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await setup(page, kind, theme, width);
        await finish(page, info, "finish", kind);
        expect(errors).toEqual([]);
      });
test("same id distinct records retain distinct metrics", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page, "identity", "light", 375);
  await finish(page, info, "identity", "identity");
  expect(errors).toEqual([]);
});
test("next finish recomputes changed history after save", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page, "daily", "light", 320);
  const first = await finish(page, info, "first", "daily", false);
  const mutation = await page.evaluate(() => {
    for (const overlay of globalThis.document.querySelectorAll(".ovl"))
      globalThis.closeModal(overlay);
    const prior = db.sessions[31];
    const before = globalThis.sessionMetrics(prior).st.rr;
    prior.ends[0][0].x += 0.05;
    prior.ends[0][1].x -= 0.05;
    for (const a of prior.ends[0]) {
      const score = globalThis.scoreAt(
        a.x,
        a.y,
        prior.faceD,
        prior.faceType,
        globalThis.lineCutRadius(prior.faceD, prior.faceType),
      );
      a.s = score.s;
      a.X = score.X;
    }
    const current = structuredClone(db.sessions.at(-1));
    current.id = "owned-next-finish";
    current.ends = [];
    current.cur = [
      { x: 0, y: 0, s: 10, X: true },
      { x: 0.4, y: 0, s: 10, X: true },
      { x: -0.4, y: 0, s: 10, X: true },
    ];
    current.sel = -1;
    db.active = current;
    globalThis.save();
    const after = globalThis.sessionMetrics(prior).st.rr;
    globalThis.render();
    return { before, after };
  });
  expect(mutation.after).not.toBe(mutation.before);
  const second = await finish(page, info, "second", "daily");
  expect(second.data.sessions.length).toBe(first.data.sessions.length + 1);
  expect(second.data.sessions[31].ends[0][0].x).toBe(first.data.sessions[31].ends[0][0].x + 0.05);
  expect(errors).toEqual([]);
});
