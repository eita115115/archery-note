"use strict";

const { expect, test } = require("@playwright/test");

/* 屋外（直射日光下）視認性向上（CHANGELOG v1.6.2「得点チップの赤/青を濃く」「矢マーカーの白縁を太く」）
   の回帰検証。この改善はトグル式の「屋外モード」ではなく常時適用の色調整として出荷済みのため、
   ここでは現行の scripts/20-scoring.js zoneStyle() と scripts/30-target-svg.js markCircle() が
   実際にレンダリングする色・線幅を検証する（アプリ内に "outdoor mode" 相当のUIは存在しない）。 */

const emptySetupDb = {
  schema: 3,
  setups: [
    {
      id: "e2e-setup",
      name: "E2E recurve setup",
      bow: "Recurve",
      limbs: "Sample limbs",
      poundage: 38,
      history: [],
    },
  ],
  sightMarks: [],
  sessions: [],
  trash: [],
  formAnalyses: [],
  customRounds: [],
  settings: {
    eyeSight: 850,
    theme: "auto",
    lastBackupAt: null,
    activeGuideSeen: true,
    /* 将来のオンボーディング機能が既存ユーザー扱いでスキップするための先回りシード(現状は未使用キー) */
    onboardingSeen: true,
  },
  active: null,
};

function collectUnexpectedErrors(page) {
  const unexpectedErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") unexpectedErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    unexpectedErrors.push(error.message);
  });
  return unexpectedErrors;
}

async function seedDb(page, database) {
  await page.addInitScript((db) => {
    globalThis.localStorage.setItem("archeryNote.v1", JSON.stringify(db));
  }, database);
}

/* WCAG 2.x 相対輝度・コントラスト比。getComputedStyle() が返す rgb()/rgba() 文字列から算出する */
function parseRgb(value) {
  const m = /rgba?\(([^)]+)\)/.exec(value || "");
  if (!m) throw new Error(`unrecognized color: ${value}`);
  const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
  return { r: parts[0], g: parts[1], b: parts[2] };
}
function relativeLuminance({ r, g, b }) {
  const lin = (c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(colorA, colorB) {
  const la = relativeLuminance(parseRgb(colorA));
  const lb = relativeLuminance(parseRgb(colorB));
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/* faceD=122cm・faceType="single"（既定の70m開始条件）の的中心から、指定のリング数(ringMultiple×w)
   に相当するオフセットをタップし、そのスコアチップを狙う。
   scoreAt() は line-cutter 許容(touchCm = arrowMarkRadius+targetLineHalfWidth)だけ内側に
   ずれるため、狙うリング帯の中央値へ touchCm を加算したオフセットでタップし、
   リング境界ぎりぎりを避けてフレーク耐性を確保する。 */
async function tapAtRingOffset(target, ringMultiple) {
  const box = await target.boundingBox();
  const faceD = 122;
  const M = (faceD / 2) * 1.035; // v5: 記録中の的の表示範囲（50-record-view.js activeViewHalf）
  const w = faceD / 20; // ringW(122,"single")
  const touchCm = faceD / 85 + faceD / 1200; // arrowMarkRadius(122) + targetLineHalfWidth(122,"single")
  const offsetCm = w * ringMultiple + touchCm;
  const pxPerCm = box.width / (2 * M);
  await target.click({
    position: { x: box.width / 2 + offsetCm * pxPerCm, y: box.height / 2 },
  });
}

test("red-zone score chip (7-8 points) meets WCAG AA contrast against its text", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(page, emptySetupDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await page.getByTestId("record-start").click();

  const target = page.getByTestId("active-target").locator("#tgsvg");
  await tapAtRingOffset(target, 2.5); // (2w,3w] の中央 -> 8点（zoneStyle: s>=7 は var(--red)）
  // v5: 入力中エンドの枠は罫線の面（帯の色）に文字色。的の色は枠の下線だけに使い、文字には使わない
  const chip = page.locator('[data-testid="active-arrow-chips"] .slot[data-i]');
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveAttribute("aria-label", "1射目 8");
  await expect(chip).toHaveClass(/\bzr\b/);

  const colors = await chip.evaluate((el) => {
    const cs = globalThis.getComputedStyle(el);
    return {
      bg: globalThis.getComputedStyle(el.closest(".curEnd")).backgroundColor,
      own: cs.backgroundColor,
      fg: cs.color,
      line: globalThis.getComputedStyle(el, "::after").backgroundColor,
      size: parseFloat(cs.fontSize),
    };
  });
  expect(colors.own).toBe("rgba(0, 0, 0, 0)");
  expect(contrastRatio(colors.bg, colors.fg)).toBeGreaterThanOrEqual(4.5);
  expect(colors.size).toBeGreaterThanOrEqual(24);
  expect(colors.line).toBe("rgb(242, 59, 59)");
  expect(unexpectedErrors).toEqual([]);
});

test("blue-zone score chip (5-6 points) meets WCAG AA contrast against its text", async ({
  page,
}) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(page, emptySetupDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await page.getByTestId("record-start").click();

  const target = page.getByTestId("active-target").locator("#tgsvg");
  await tapAtRingOffset(target, 4.5); // (4w,5w] の中央 -> 6点（zoneStyle: s>=5 は var(--blue)）
  // v5: 入力中エンドの枠は罫線の面（帯の色）に文字色。的の色は枠の下線だけに使い、文字には使わない
  const chip = page.locator('[data-testid="active-arrow-chips"] .slot[data-i]');
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveAttribute("aria-label", "1射目 6");
  await expect(chip).toHaveClass(/\bzb\b/);

  const colors = await chip.evaluate((el) => {
    const cs = globalThis.getComputedStyle(el);
    return {
      bg: globalThis.getComputedStyle(el.closest(".curEnd")).backgroundColor,
      own: cs.backgroundColor,
      fg: cs.color,
      line: globalThis.getComputedStyle(el, "::after").backgroundColor,
      size: parseFloat(cs.fontSize),
    };
  });
  expect(colors.own).toBe("rgba(0, 0, 0, 0)");
  expect(contrastRatio(colors.bg, colors.fg)).toBeGreaterThanOrEqual(4.5);
  expect(colors.size).toBeGreaterThanOrEqual(24);
  expect(colors.line).toBe("rgb(55, 166, 224)");
  expect(unexpectedErrors).toEqual([]);
});

test("arrow marker keeps a thick white outline for outdoor glare readability", async ({ page }) => {
  const unexpectedErrors = collectUnexpectedErrors(page);
  await seedDb(page, emptySetupDb);

  await page.goto("/");
  await expect(page.locator("#bootFallback")).toBeHidden();
  await page.getByTestId("record-start").click();

  const target = page.getByTestId("active-target").locator("#tgsvg");
  await target.click(); // 中央タップで矢マークを1つ生成
  // 実寸の矢円（判定と同じ半径）と、位置を探すための目印（判定には使わない）の2つを描く
  const mark = page.locator("#tgmarks circle.arrowFoot").first();
  await expect(mark).toHaveCount(1);
  const locator = page.locator("#tgmarks circle.arrowLocator").first();
  await expect(locator).toBeVisible();

  const attrs = await mark.evaluate((el) => ({
    stroke: el.getAttribute("stroke"),
    strokeWidth: parseFloat(el.getAttribute("stroke-width")),
    r: parseFloat(el.getAttribute("r")),
  }));
  expect(attrs.stroke).toBe("#fff");
  // 白縁の外縁が矢円の半径: 円は 5r/6 に描き、縁の太さは r/3（白縁を太くする現行仕様）
  const outer = attrs.r + attrs.strokeWidth / 2;
  expect(attrs.strokeWidth / outer).toBeCloseTo(1 / 3, 5);
  // 表示される矢円の外縁 = 線かみ判定の半径（既定矢径 5.7mm → 0.285cm）。的の大きさに依存しない
  expect(outer).toBeCloseTo(0.285, 6);
  const loc = await locator.evaluate((el) => ({
    stroke: el.getAttribute("stroke"),
    dash: el.getAttribute("stroke-dasharray"),
  }));
  expect(loc.stroke).toBe("#fff");
  expect(loc.dash).toBeTruthy();
  expect(unexpectedErrors).toEqual([]);
});
