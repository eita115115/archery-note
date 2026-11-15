"use strict";
/* 言葉づかいの検査（docs/design/voice.md）。npm run check:voice（check:all に入っている）。
   画面に出る文（scripts/*.js と index.html の文字列）に、使わないと決めた言葉が無いことを確かめる。

   1. どこにも書かない言葉（たたんだ中でも）: この回・測定のゆれ・判定できない・セッション・破棄・紐付け・ストリーク・
      離れ（リリースのこと）・弓手・保持（フルドローのこと）・着弾・台帳・寄り / ずれ / 不確かさ / 当てはまり / まとまり方（名詞）など。
   2. 本文には書かない統計の言葉: 95%区間・標準偏差・標準誤差・中央値・決定係数・RMS・外れ値候補・σ。
      「詳しく」「計算の内訳」などのたたんだ中では使ってよい。たたんだ中の文は、ソースで
        voice:fold-begin … voice:fold-end の印（コメント）で囲むか、同じ文字列の中の <details>…</details> に書く。
      その文が本当にたたんだ中に出ることは、画面を組み立てる検査（check-analysis-view・check-gear-sight-view）と
      e2e（analysis-figures・gear-sight-settings・form-v2）が確かめている。
   3. 用語の決定（2026-11-15）: 分析のタブ名は「グルーピング」（data-an="impact" と data-testid は変えない）。

   保存してある値（外れた理由の印・天気・弓具の選択肢・保存した記録のメモ）と、画面に出ない文は、理由を書いて外してある。 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const files = fs
  .readdirSync(path.join(root, "scripts"))
  .filter((f) => f.endsWith(".js"))
  .sort()
  .map((f) => `scripts/${f}`);

/* ---- 画面に出ない所（理由つき）。start から end の手前までを検査から外す ---- */
const NOT_RENDERED = [
  {
    file: "scripts/40-analysis-physics.js",
    start: "function gearVariation(setup){",
    end: "function roundProgressHtml(sess){",
    why: "サイトの目安の計算。notes・text・lines の文はどの画面にも出ない（画面は sightAdviceModel が label と軸だけを読む）",
  },
  {
    file: "scripts/46-form-core.js",
    start: null,
    end: null,
    why: "以前の実時間の検出器。文は以前の撮影画面（どの画面からも開けない）と、呼び出しの無い formRecordInsights にだけある",
  },
  {
    file: "scripts/47-form-view.js",
    start: "function openFormCapture(){",
    end: null,
    why: "以前の撮影画面。どの画面からも開けない（check-ui.js が確かめている）",
  },
];
/* ---- そのまま残す文字列（理由つき） ---- */
const KEEP = [
  { re: /^(良射|押し手|リリース|クリッカー|風|狙いミス|矢が怪しい|不明)$/, why: "外れた理由の印（保存する値）" },
  { re: /^(右寄り|左寄り|縦散り|横散り|硬め傾向|柔らかめ傾向|距離別サイト校正)$/, why: "弓具の選択肢（保存する値）。画面には gearOptionLabel で言い換えて出す" },
  { re: /^(柔らかめ寄り|硬め寄り|アルミ番手|概ね候補域|候補を表示|保留|風を考慮)$/, why: "計算の中の状態名（比べるだけで、画面には出さない）" },
  { re: /^\(保存済み動画から解析\)$/, why: "射型の記録に保存するメモ（これまでの記録と同じ値）" },
  { re: /^\[(kind 0=射|時刻 0\.01s|リリースの不確かさ)/, why: "検証用の診断ファイルの列の説明（開発者向けの書き出し）" },
];

/* ---- ソースからコメントを除き、文字列だけを取り出す ---- */
function literals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  let fold = false;
  const push = (text, at) => out.push({ text, line: src.slice(0, at).split("\n").length, fold });
  while (i < n) {
    const c = src[i],
      d = src[i + 1];
    if (c === "/" && d === "*") {
      const e = src.indexOf("*/", i + 2);
      const body = src.slice(i, e < 0 ? n : e + 2);
      if (/voice:fold-begin/.test(body)) fold = true;
      if (/voice:fold-end/.test(body)) fold = false;
      i += body.length;
      continue;
    }
    if (c === "/" && d === "/" && (i === 0 || /[\s;,{}()]/.test(src[i - 1]))) {
      const e = src.indexOf("\n", i);
      i = e < 0 ? n : e;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      push(src.slice(i + 1, j), i);
      i = j + 1;
      continue;
    }
    if (c === "`") {
      /* テンプレート: ${…} の中の式は別に読む（入れ子の文字列を取り出す）。地の文は 1つにつなぐ */
      let j = i + 1,
        text = "";
      const start = i;
      while (j < n && src[j] !== "`") {
        if (src[j] === "\\") {
          text += src.slice(j, j + 2);
          j += 2;
        } else if (src[j] === "$" && src[j + 1] === "{") {
          let depth = 1,
            k = j + 2;
          while (k < n && depth) {
            if (src[k] === "`") {
              /* 入れ子のテンプレートを読み飛ばす（中身は下の再帰で読む） */
              let m = k + 1,
                dd = 0;
              while (m < n && (src[m] !== "`" || dd)) {
                if (src[m] === "\\") m++;
                else if (src[m] === "$" && src[m + 1] === "{") dd++;
                else if (src[m] === "}" && dd) dd--;
                m++;
              }
              k = m + 1;
              continue;
            }
            if (src[k] === '"' || src[k] === "'") {
              const q = src[k];
              k++;
              while (k < n && src[k] !== q) k += src[k] === "\\" ? 2 : 1;
              k++;
              continue;
            }
            if (src[k] === "{") depth++;
            else if (src[k] === "}") depth--;
            k++;
          }
          const inner = src.slice(j + 2, k - 1);
          const keep = fold;
          for (const lit of literals(inner)) out.push({ text: lit.text, line: src.slice(0, j).split("\n").length, fold: keep || lit.fold });
          fold = keep;
          text += "\u0001";
          j = k;
        } else text += src[j++];
      }
      push(text, start);
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}
const hasJa = (s) => /[぀-ヿ一-鿿]/.test(s);
const visibleHtmlText = (html) =>
  html
    .replace(/<!DOCTYPE[^>]*>/i, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ");

/* ---- 1. どこにも書かない言葉 ---- */
const ALWAYS = [
  [/この回/, "この回 → この練習・この撮影・この日"],
  [/測定のゆれ/, "測定のゆれ → カメラで測るときのぶれ"],
  [/判定できない/, "判定できない → まだ分かりません"],
  [/セッション/, "セッション → 練習・記録"],
  [/破棄/, "破棄 → 保存せずに閉じる・やめて消す"],
  [/紐付|紐づ/, "紐付け → 練習とつなぐ"],
  [/ストリーク/, "ストリーク → 連続記録"],
  [/離れ(?![たてるまずなよ方])/, "離れ → リリース"],
  [/弓手|弓側/, "弓手 → 押し手"],
  [/保持/, "保持 → フルドロー"],
  [/ホールド|レットダウン/, "ホールド・レットダウン → フルドロー・引き戻し"],
  [/着弾/, "着弾 → 矢の位置・矢の中心・グルーピング（分析のタブ名は「グルーピング」）"],
  [/台帳/, "サイト台帳 → サイトの記録"],
  [/校正する|物理校正/, "校正する → サイト合わせ"],
  [/ステージ/, "ステージ → 距離（○距離目）"],
  [/番手/, "番手 → スパイン ○番"],
  [/(?<![最年])寄り(?![添かそ])/, "寄り（名詞）→ 「矢が右に集まっています」のように動詞で言う"],
  [/ずれ(?![てたるまなれ込])|ズレ/, "ずれ（名詞）→ 「右に 2cm ずれています」のように動詞で言う"],
  [/不確かさ/, "不確かさ → 「±○ ほどの幅があります」"],
  [/当てはまり/, "当てはまり → 「実測と合っているか」"],
  [/まとまり方/, "まとまり方 → 「矢がどれだけまとまったか」"],
  [/ふだんの上下|上下の中|上下より大き/, "上下（名詞）→ 「ふだん ±○ 点ほど上下します」"],
  [/しましょう/, "〜しましょう は使わない"],
  [/[！!](?![=])/, "感嘆符は使わない"],
  [/公式|公認/, "公式・公認 と言わない（WA のルールでは、と出どころを言う）"],
  [/この調子|ナイス|おめでとう|がんばり|頑張|おつかれ|お疲れ|すばらしい|素晴らし|絶好調/, "うそのほめ言葉・応援を書かない"],
  [/キャンセル/, "キャンセル → やめる"],
];
/* ---- 2. 本文には書かない統計の言葉（たたんだ中では使ってよい） ---- */
const MAIN_ONLY = [
  [/95\s*%\s*区間|信頼区間/, "95%区間 → 「±○ ほどの幅があります」。数字は「詳しく」へ"],
  [/標準偏差/, "標準偏差 → 「ふだんは ±○ 点ほど上下します」"],
  [/標準誤差/, "標準誤差 → 「詳しく」へ"],
  [/中央値/, "中央値 → まん中の値・「ふつうは ○ 秒」"],
  [/決定係数/, "決定係数 → 「詳しく」「予測の計算方法」へ"],
  [/RMS|ロバスト/, "RMS → グルーピングの大きさ（半径）"],
  [/外れ値/, "外れ値候補 → 大きく外れた矢"],
  [/σ/, "σ → ±○ ほど"],
  [/同時の検定|有意/, "検定の言葉 → 「詳しく」へ"],
];

let checked = 0;
const problems = [];
const foldUsed = new Set();
for (const file of [...files, "index.html"]) {
  let src = read(file);
  let skipAll = false;
  for (const r of NOT_RENDERED.filter((x) => x.file === file)) {
    if (r.start == null) {
      skipAll = true;
      continue;
    }
    const a = src.indexOf(r.start);
    assert(a >= 0, `${file}: marker "${r.start}" not found (update NOT_RENDERED in tools/check-voice.js)`);
    const b = r.end == null ? src.length : src.indexOf(r.end, a);
    assert(b > a, `${file}: marker "${r.end}" not found after "${r.start}"`);
    /* 行番号を保つため、外した所は改行だけ残す */
    src = src.slice(0, a) + src.slice(a, b).replace(/[^\n]/g, "") + src.slice(b);
  }
  if (skipAll) continue;
  const lits =
    file === "index.html"
      ? [{ text: visibleHtmlText(src), line: 0, fold: false }]
      : literals(src).filter((l) => hasJa(l.text));
  for (const lit of lits) {
    if (KEEP.some((k) => k.re.test(lit.text.trim()))) continue;
    checked++;
    for (const [re, hint] of ALWAYS) {
      const m = re.exec(lit.text);
      if (m) problems.push(`${file}:${lit.line}: 「${m[0]}」 ${hint}\n      ${lit.text.trim().slice(0, 110)}`);
    }
    /* 同じ文字列の中の <details>…</details> は、たたんだ中 */
    const main = lit.fold ? "" : lit.text.replace(/<details[\s\S]*?<\/details>/g, " ");
    if (lit.fold && MAIN_ONLY.some(([re]) => re.test(lit.text))) foldUsed.add(file);
    for (const [re, hint] of MAIN_ONLY) {
      const m = re.exec(main);
      if (m) problems.push(`${file}:${lit.line}: 本文に「${m[0]}」 ${hint}\n      ${lit.text.trim().slice(0, 110)}`);
    }
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`check-voice: ${problems.length} problem(s). 決まりは docs/design/voice.md。`);
  process.exit(1);
}

/* ---- たたんだ中の印が、開いたまま終わっていない ---- */
for (const file of files) {
  const src = read(file);
  const begins = (src.match(/voice:fold-begin/g) || []).length,
    ends = (src.match(/voice:fold-end/g) || []).length;
  assert.equal(begins, ends, `${file}: voice:fold-begin (${begins}) and voice:fold-end (${ends}) must pair`);
}
/* 統計の数字は消さずに、たたんだ中へ移した（消していないことの確認） */
for (const f of ["scripts/47-form-v2-view.js", "scripts/50-record-view.js", "scripts/60-history-sight-view.js", "scripts/40-analysis-physics.js"])
  assert(foldUsed.has(f), `${f}: the statistics (95%区間 など) must stay inside a fold, not be deleted`);

/* ---- 画面に出ないと言った所が、本当に読まれていない ---- */
const views = ["scripts/50-record-view.js", "scripts/60-history-sight-view.js", "scripts/70-gear-settings.js", "scripts/47-form-v2-view.js"]
  .map(read)
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");
assert(!/\b(adv|advice|judgement|md\.j|j)\.(text|notes)\b/.test(views), "advice notes / judgement text must stay unrendered (see NOT_RENDERED)");
assert(!/\badv\.lines\.map\(|\bl\.html\b/.test(views), "advice lines' html must stay unrendered (see NOT_RENDERED)");
const all = files.map(read).join("\n");
assert.equal((all.match(/formRecordInsights\(/g) || []).length, 1, "formRecordInsights must have no caller (see NOT_RENDERED)");

/* ---- 3. 用語の決定（2026-11-15） ---- */
const html = read("index.html");
assert(/data-an="impact" data-testid="analysis-tab-impact">グルーピング<\/button>/.test(html), "analysis tab label is グルーピング; data-an and data-testid are unchanged");
assert(/impact: "グルーピング"/.test(read("scripts/50-record-view.js")), "the screen-reader heading of the tab says グルーピング");
const v2 = read("scripts/44-form-record.js");
for (const name of ["フルドローの時間", "押し手を残した時間", "押し手の下がり", "リリースの後ろへの動き"])
  assert(v2.includes(`name: "${name}"`), `form item name "${name}"`);
assert(read("scripts/50-record-view.js").includes(">線かみ<") || /"線かみ"/.test(read("scripts/50-record-view.js")), "線かみ is kept");
assert(/GEAR_OPTION_LABELS/.test(read("scripts/70-gear-settings.js")) && /"右寄り",/.test(read("scripts/70-gear-settings.js")), "gear option values stay as saved; only the display is mapped");

console.log(
  `Voice checks OK (${checked} strings; ${ALWAYS.length} phrases banned everywhere, ${MAIN_ONLY.length} statistics words banned outside folds; ${NOT_RENDERED.length} unrendered regions and ${KEEP.length} stored-value patterns exempt with reasons)`,
);
