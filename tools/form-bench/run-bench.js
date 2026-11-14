#!/usr/bin/env node
"use strict";
/* Form-tracking benchmark runner.

   node tools/form-bench/run-bench.js [options]      (npm run bench:form -- [options])
     --adapter <name|path>  detector: "current" (default), "truth-oracle", or a module path that
                            exports {name, provides, analyze(frames, meta)}; see README.md
     --scenario a,b         only these scenario ids (default: all)
     --group core,...       only these groups: reference, core, sensitivity (default: all)
     --seeds 5 | 1,2,7      number of seeds (1..N) or an explicit list (default: 1,2,3,4,5)
     --out <file>           JSON results (default: <os tmpdir>/archery-note-form-bench/<adapter>.json)
     --quiet                no per-scenario progress lines

   Synthetic data only: no footage is read or written, and nothing is written inside the repo
   unless --out points there. */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { simulateSession } = require("./simulator");
const { renderSession } = require("./noise");
const { computeTruth } = require("./truth");
const { scoreSession, aggregate, featureSummary, measurementRows } = require("./metrics");
const { SCENARIOS, resolveScenario, DEFAULT_SEEDS } = require("./scenarios");

const ADAPTERS = {
  current: () => require("./adapters/current-pipeline"),
  "truth-oracle": () => require("./adapters/truth-oracle"),
};

function parseArgs(argv) {
  const o = {
    adapter: "current",
    scenarios: null,
    groups: null,
    seeds: DEFAULT_SEEDS,
    out: null,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "--adapter") o.adapter = val();
    else if (a === "--scenario") o.scenarios = val().split(",").filter(Boolean);
    else if (a === "--group") o.groups = val().split(",").filter(Boolean);
    else if (a === "--seeds") {
      const v = val();
      o.seeds = v.includes(",")
        ? v.split(",").map(Number)
        : Array.from({ length: Number(v) }, (_, k) => k + 1);
      if (!o.seeds.length || o.seeds.some((s) => !Number.isInteger(s)))
        throw new Error(`bad --seeds ${v}`);
    } else if (a === "--out") o.out = val();
    else if (a === "--quiet") o.quiet = true;
    else if (a === "--help" || a === "-h") o.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  return o;
}

function loadAdapter(spec) {
  if (ADAPTERS[spec]) return ADAPTERS[spec]();
  const mod = require(path.resolve(spec));
  if (!mod || typeof mod.analyze !== "function")
    throw new Error(`${spec} does not export analyze()`);
  return mod;
}

const r1 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : v);
const r3 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);
function roundFeatures(f) {
  const out = {};
  for (const [k, v] of Object.entries(f || {})) out[k] = r3(v);
  return out;
}

/* Simulate, render, analyze and score one session. Exported for tests. */
function runSession(cfg, seed, adapter) {
  const sess = simulateSession(cfg.sim, seed);
  const rend = renderSession(sess, cfg.camera, cfg.noise, cfg.timing, seed);
  const truth = computeTruth(sess, rend.camera);
  const meta = { frame: rend.frame, handedness: sess.handedness, fps: cfg.timing.fps };
  if (adapter.needsTruth) meta.truth = truth;
  const res = adapter.analyze(rend.frames, meta);
  const scored = scoreSession(truth, res, adapter.provides, sess.activityAt);
  /* optional measurement probe: the adapter measures features at the TRUE anchor/release times */
  let measuredRows = null;
  if (typeof adapter.measure === "function") {
    const windows = truth.shots.map((t) => ({ anchorStartMs: t.anchorMs, releaseMs: t.releaseMs }));
    measuredRows = measurementRows(
      truth,
      adapter.measure(rend.frames, meta, windows),
      adapter.provides,
    );
  }
  return { sess, rend, truth, res, scored, measuredRows };
}

function runScenario(scn, seeds, adapter) {
  const cfg = resolveScenario(scn);
  const sessions = [];
  for (const seed of seeds) {
    const { sess, rend, truth, res, scored, measuredRows } = runSession(cfg, seed, adapter);
    sessions.push({
      seed,
      scored,
      measuredRows,
      json: {
        seed,
        durationMs: Math.round(sess.durationMs),
        heightM: r3(sess.body.H),
        camera: rend.camera.describe(),
        render: rend.stats,
        truth: {
          shots: truth.shots.map((s) => ({
            releaseMs: r1(s.releaseMs),
            anchorMs: r1(s.anchorMs),
            holdMs: Math.round(s.holdMs),
            drawMs: Math.round(s.drawMs),
            peakSpeedMs: s.release.peakSpeedMs,
            peakSpeedTorsoPerS: s.release.peakSpeedTorsoPerS,
            t2: roundFeatures(s.t2),
            t3: roundFeatures(s.t3),
          })),
          letdowns: truth.letdowns.map((c) => ({
            anchorMs: r1(c.anchorMs),
            letdownStartMs: r1(c.letdownStartMs),
            letdownEndMs: r1(c.letdownEndMs),
          })),
          walks: truth.intervals
            .filter((iv) => iv.kind === "walk")
            .map((iv) => ({ startMs: r1(iv.startMs), endMs: r1(iv.endMs) })),
        },
        detections: (res.shots || []).map((d) => ({
          releaseMs: r1(d.releaseMs),
          anchorStartMs: r1(d.anchorStartMs),
          holdMs: r1(d.holdMs),
          features: roundFeatures(d.features),
          extra: d.extra || undefined,
        })),
        fp: scored.fp.map((f) => ({ ...f, tMs: r1(f.tMs), nearestTrueMs: r1(f.nearestTrueMs) })),
        missed: scored.missed.map((m) => ({ ...m, trueReleaseMs: r1(m.trueReleaseMs) })),
        releaseErrMs: scored.tp.map((p) => r1(p.dtMs)),
        quality: res.quality || null,
        trace: res.trace
          ? {
              fires: (res.trace.fires || []).map((f) => ({
                ...f,
                tMs: r1(f.tMs),
                anchorNorm: r3(f.anchorNorm),
              })),
              cancels: (res.trace.cancels || []).map((c) => ({ ...c, tMs: r1(c.tMs) })),
            }
          : undefined,
      },
    });
  }
  return {
    id: cfg.id,
    group: cfg.group,
    desc: cfg.desc,
    config: { sim: cfg.sim, camera: cfg.camera, noise: cfg.noise, timing: cfg.timing },
    summary: aggregate(
      sessions.map((s) => s.scored),
      adapter.provides,
    ),
    measurement:
      sessions[0] && sessions[0].measuredRows
        ? featureSummary(
            sessions.flatMap((s) => s.measuredRows),
            adapter.provides,
          )
        : null,
    scored: sessions.map((s) => s.scored),
    measuredRows: sessions.map((s) => s.measuredRows),
    sessions: sessions.map((s) => s.json),
  };
}

/* second table: feature errors when the detector is told the true anchor/release times */
function measurementTable(results) {
  const head = [
    "scenario (true timing)",
    "shots",
    "anchor e2D/e3D",
    "bowEl e2D/3D",
    "drawEl e2D/3D",
    "bowSh e2D",
    "drawDrift e2D",
    "n/a anchor/bow/draw",
  ];
  const cell = (f, space, d) => (f && f[space] ? fmt(f[space].medAbs, d) : "—");
  const rows = results
    .filter((r) => r.measurement)
    .map(({ id, measurement: m }) => [
      id,
      String(m.anchorDist ? m.anchorDist.n : 0),
      `${cell(m.anchorDist, "vs2d", 3)}/${cell(m.anchorDist, "vs3d", 3)}`,
      `${cell(m.bowElbow, "vs2d", 1)}/${cell(m.bowElbow, "vs3d", 1)}`,
      `${cell(m.drawElbow, "vs2d", 1)}/${cell(m.drawElbow, "vs3d", 1)}`,
      cell(m.bowShoulderElev, "vs2d", 3),
      cell(m.drawDrift, "vs2d", 3),
      ["anchorDist", "bowElbow", "drawElbow"]
        .map((k) => (m[k] ? pct(m[k].unavailable) : "n/p"))
        .join("/"),
    ]);
  if (!rows.length) return [];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
  return [line(head), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)];
}

/* ---------- table ---------- */

const fmt = (v, d) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d == null ? 2 : d));
const pct = (v) => (v == null || !Number.isFinite(v) ? "—" : `${Math.round(v * 100)}%`);
function featCell(s, key, space, digits) {
  const f = s.features[key];
  if (!f) return "n/p";
  const e = f[space];
  return e ? fmt(e.medAbs, digits) : "—";
}
function tableRows(results) {
  const head = [
    "scenario",
    "shots",
    "P",
    "R",
    "F1",
    "LD-FP",
    "FP",
    "rel |e| med/p90 ms",
    "rel bias",
    "hold |e| ms",
    "anchor e2D/e3D",
    "bowEl e2D/3D",
    "drawEl e2D/3D",
    "n/a bow/draw/hold",
  ];
  const rows = results.map(({ id, summary: s }) => {
    const rel = s.releaseErrMs;
    const hold = s.holdErrMs;
    const na = (k) => (s.features[k] ? pct(s.features[k].unavailable) : "n/p");
    return [
      id,
      `${s.tp}/${s.trueShots}`,
      fmt(s.precision),
      fmt(s.recall),
      fmt(s.f1),
      `${s.letdownFp}/${s.letdowns}`,
      String(s.fp - s.letdownFp),
      rel ? `${fmt(rel.medAbs, 0)}/${fmt(rel.p90Abs, 0)}` : "—",
      rel ? fmt(rel.bias, 0) : "—",
      hold ? fmt(hold.medAbs, 0) : "—",
      `${featCell(s, "anchorDist", "vs2d", 3)}/${featCell(s, "anchorDist", "vs3d", 3)}`,
      `${featCell(s, "bowElbow", "vs2d", 1)}/${featCell(s, "bowElbow", "vs3d", 1)}`,
      `${featCell(s, "drawElbow", "vs2d", 1)}/${featCell(s, "drawElbow", "vs3d", 1)}`,
      `${na("bowElbow")}/${na("drawElbow")}/${pct(s.holdUnavailable)}`,
    ];
  });
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
  return [line(head), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)];
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    return 2;
  }
  if (opts.help) {
    console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
    return 0;
  }
  const adapter = loadAdapter(opts.adapter);
  let list = SCENARIOS;
  if (opts.scenarios) {
    const unknown = opts.scenarios.filter((id) => !SCENARIOS.some((s) => s.id === id));
    if (unknown.length) {
      console.error(`unknown scenario(s): ${unknown.join(", ")}`);
      return 2;
    }
    list = list.filter((s) => opts.scenarios.includes(s.id));
  }
  if (opts.groups) list = list.filter((s) => opts.groups.includes(s.group));
  const out =
    opts.out ||
    path.join(os.tmpdir(), "archery-note-form-bench", `${adapter.name || "adapter"}.json`);
  const t0 = Date.now();
  const results = [];
  for (const scn of list) {
    const ts = Date.now();
    const r = runScenario(scn, opts.seeds, adapter);
    results.push(r);
    if (!opts.quiet) {
      const s = r.summary;
      console.log(
        `  ${scn.id.padEnd(20)} ${s.tp}/${s.trueShots} shots, ${s.fp} FP, ${((Date.now() - ts) / 1000).toFixed(1)} s`,
      );
    }
  }
  const pool = (group) => {
    const rs = results.filter((r) => r.group === group);
    return rs.length
      ? aggregate(
          rs.flatMap((r) => r.scored),
          adapter.provides,
        )
      : null;
  };
  const overall = {
    core: pool("core"),
    reference: pool("reference"),
    sensitivity: pool("sensitivity"),
  };
  console.log(
    `\nForm-tracking benchmark — adapter "${adapter.name}" — seeds ${opts.seeds.join(",")}`,
  );
  console.log(
    "P/R/F1: release matched within ±150 ms. LD-FP: detections during let-downs / let-downs.",
  );
  console.log("FP: other false detections. Errors are median |detected - truth| on matched shots;");
  console.log(
    "e2D = vs noise-free image truth (square px), e3D = vs true 3D; anchor in torso lengths,",
  );
  console.log("angles in degrees. n/a = matched shots without the value; n/p = not provided.\n");
  const rows = results.map((r) => ({ id: r.id, summary: r.summary }));
  if (overall.core) rows.push({ id: "OVERALL (core)", summary: overall.core });
  for (const l of tableRows(rows)) console.log(l);
  const coreMeasured = results.filter((r) => r.group === "core" && r.measurement);
  if (coreMeasured.length) {
    overall.coreMeasurement = featureSummary(
      coreMeasured.flatMap((r) => r.measuredRows.flat()),
      adapter.provides,
    );
    console.log(
      "\nMeasurement with true segmentation (adapter.measure at the true anchor/release times):",
    );
    const mrows = results.concat([{ id: "OVERALL (core)", measurement: overall.coreMeasurement }]);
    for (const l of measurementTable(mrows)) console.log(l);
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const json = {
    bench: "archery-note form-bench v1",
    generated: new Date().toISOString(),
    adapter: { name: adapter.name, description: adapter.description, provides: adapter.provides },
    seeds: opts.seeds,
    matchMs: 150,
    overall,
    scenarios: results.map((r) => {
      const copy = { ...r };
      delete copy.scored;
      delete copy.measuredRows;
      return copy;
    }),
    runtimeS: (Date.now() - t0) / 1000,
  };
  fs.writeFileSync(out, JSON.stringify(json, null, 1));
  console.log(`\nJSON: ${path.resolve(out)}  (${json.runtimeS.toFixed(1)} s)`);
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { runSession, runScenario, loadAdapter, parseArgs, tableRows, measurementTable };
