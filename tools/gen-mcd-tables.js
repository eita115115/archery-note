"use strict";
/* MCD の小標本補正係数 MCD_MRAW / MCD_MRW を生成する（docs/design/grouping-stats-v3.md §3）。
   2 変量標準正規 N(0, I) の点から mcdFit と rmcdFromFit を実行し、trace の期待値が 2 になる係数を求める。
     mraw(n) = 2 / (C75 · mean(trace S0))
     mrw(n)  = 2 / (CRW · mean(trace S1))   （mraw 適用後の再重み付け）
   乱数: xoshiro128**（splitmix32 でシード 20261112+n と 20261112+1000+n）、正規乱数は Marsaglia の極座標法。
   使い方: node tools/gen-mcd-tables.js [小さい n の試行回数=200000] [大きい n の試行回数=100000]
   出力の JS リテラルを scripts/20-scoring.js の MCD_MRAW / MCD_MRW に貼る。 */
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "20-scoring.js"), "utf8");
const api = new Function(
  `${src}\nreturn {mcdFit, rmcdFromFit, xoshiro128ss, MCD_TABLE_N, MCD_C75};`,
)();

function normalPair(rng) {
  for (;;) {
    const u = 2 * rng() - 1;
    const v = 2 * rng() - 1;
    const s = u * u + v * v;
    if (s > 0 && s < 1) {
      const f = Math.sqrt((-2 * Math.log(s)) / s);
      return [u * f, v * f];
    }
  }
}
function sample(rng, n) {
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const [x, y] = normalPair(rng);
    pts[i] = { x, y };
  }
  return pts;
}
const small = Number(process.argv[2] || 200000);
const large = Number(process.argv[3] || 100000);
const mraw = [];
const mrw = [];
const started = Date.now();
for (const n of api.MCD_TABLE_N) {
  const trials = n <= 30 ? small : large;
  let rng = api.xoshiro128ss(20261112 + n);
  let sum = 0;
  let count = 0;
  for (let t = 0; t < trials; t++) {
    const fit = api.mcdFit(sample(rng, n));
    if (!fit) continue;
    sum += fit.S0.a + fit.S0.d;
    count++;
  }
  const raw = 2 / (api.MCD_C75 * (sum / count));
  rng = api.xoshiro128ss(20261112 + 1000 + n);
  let sum2 = 0;
  let count2 = 0;
  for (let t = 0; t < trials; t++) {
    const fit = api.mcdFit(sample(rng, n));
    if (!fit) continue;
    const r = api.rmcdFromFit(fit, raw, 1);
    if (!r) continue;
    sum2 += r.S.a + r.S.d;
    count2++;
  }
  const rw = 2 / (sum2 / count2);
  mraw.push(+raw.toFixed(4));
  mrw.push(+rw.toFixed(4));
  process.stderr.write(
    `n=${n} trials=${trials} mraw=${raw.toFixed(4)} mrw=${rw.toFixed(4)} (${((Date.now() - started) / 1000).toFixed(0)}s)\n`,
  );
}
console.log(`const MCD_MRAW=[${mraw.join(",")}];`);
console.log(`const MCD_MRW=[${mrw.join(",")}];`);
