const { chromium } = require('playwright');
/* 試作の画面写真を撮る: node docs/design/v5/shoot.js [画面名,...]（Playwright の Chromium が必要。この環境では executablePath を指定） */
const path = require('path');
const OUT = path.join(__dirname, 'shots') + path.sep;
const FILE = 'file://' + path.join(__dirname, 'prototype.html');
const only = process.argv[2] ? process.argv[2].split(',') : null;
const screens = ['home', 'start', 'record-target', 'record-score', 'result', 'analysis-score', 'analysis-impact', 'analysis-compare', 'analysis-form', 'notes', 'note/a7', 'gear', 'sight', 'settings'];
const long = { home: 1, result: 2, 'analysis-score': 1, 'analysis-impact': 1, 'analysis-compare': 1, 'note/a7': 1, sight: 1 };
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  async function page(w, h, theme, hash, extra = '') {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: false });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(hash + ' ' + theme + ': ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(hash + ' console: ' + m.text()); });
    await p.goto(FILE + '?theme=' + theme + extra + '#' + hash);
    await p.waitForTimeout(150);
    return { p, ctx };
  }
  const want = (n) => !only || only.some((o) => n.includes(o));
  for (const theme of ['dark', 'light']) {
    for (const s of screens) {
      const name = s.replace('/a7', '');
      if (!want(name)) continue;
      const { p, ctx } = await page(375, 812, theme, s);
      await p.screenshot({ path: OUT + `${name}-${theme}.png` });
      for (let i = 1; i <= (long[s] || 0); i++) {
        await p.evaluate((y) => window.scrollTo(0, y), 700 * i);
        await p.waitForTimeout(80);
        await p.screenshot({ path: OUT + `${name}-${theme}-scroll${i}.png` });
      }
      // overflow check
      const ov = await p.evaluate(() => {
        const bad = [];
        const W = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth > W) bad.push('page-x-scroll ' + document.documentElement.scrollWidth);
        document.querySelectorAll('#app *').forEach((e) => {
          const cs = getComputedStyle(e);
          const fs = parseFloat(cs.fontSize);
          if (e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && fs < 13 && !e.closest('svg')) bad.push('font<13 ' + e.className + ' ' + fs);
          const r = e.getBoundingClientRect();
          if (r.width && (r.right > W + 0.5 || r.left < -0.5) && !e.closest('svg') && !e.closest('.lens')) bad.push('x-overflow ' + e.tagName + '.' + e.className + ' ' + Math.round(r.left) + '-' + Math.round(r.right));
          if ((e.tagName === 'BUTTON' || e.tagName === 'SELECT') && r.width && (r.height < 43.5) && !e.closest('.secH')) bad.push('tap<44 ' + e.tagName + '.' + e.className + ' "' + e.textContent.trim().slice(0, 10) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height));
          if (e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== 'visible' && e.tagName !== 'SELECT' && e.tagName !== 'TEXTAREA') bad.push('clipped ' + e.tagName + '.' + e.className + ' "' + e.textContent.trim().slice(0, 12) + '"');
        });
        document.querySelectorAll('#app svg text').forEach((t) => { const r = t.getBoundingClientRect(); const fs = parseFloat(getComputedStyle(t).fontSize) * (t.getBoundingClientRect().height ? 1 : 1); const svg = t.ownerSVGElement; const sc = svg.getBoundingClientRect().width / (svg.viewBox.baseVal.width || 1); if (fs * sc < 12.9) bad.push('svgtext<13 ' + (fs * sc).toFixed(1) + ' ' + t.textContent); });
        return [...new Set(bad)].slice(0, 14);
      });
      if (ov.length) console.log(`[${name} ${theme}]`, ov.join(' | '));
      await ctx.close();
    }
    if (want('record')) {
      // interactive states
      for (const [w, h] of [[375, 812], [320, 640]]) {
        const sfx = w === 375 ? '' : '-320';
        let { p, ctx } = await page(w, h, theme, 'record-target');
        if (w === 320) await p.screenshot({ path: OUT + `record-target-${theme}-320.png` });
        const box = await p.locator('#tg').boundingBox();
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        // long-press with lens
        await p.mouse.move(cx + box.width * 0.07, cy + box.width * 0.05);
        await p.mouse.down();
        await p.waitForTimeout(520);
        await p.mouse.move(cx + box.width * 0.07 + 14, cy + box.width * 0.05 - 9, { steps: 4 });
        await p.waitForTimeout(80);
        await p.screenshot({ path: OUT + `record-target-lens-${theme}${sfx}.png` });
        await p.mouse.up();
        // quick taps to fill the end
        await p.mouse.click(cx - 6, cy - 3);
        await p.mouse.click(cx + 3, cy + 5);
        await p.waitForTimeout(80);
        await p.screenshot({ path: OUT + `record-target-full-${theme}${sfx}.png` });
        await p.locator('[data-slot="2"]').click();
        await p.waitForTimeout(60);
        await p.screenshot({ path: OUT + `record-target-edit-${theme}${sfx}.png` });
        if (w === 375) {
          await p.locator('#eDone').click();
          await p.locator('#bZoom').click();
          await p.waitForTimeout(60);
          await p.screenshot({ path: OUT + `record-target-zoom-${theme}.png` });
          await p.locator('#btnMenu').click();
          await p.waitForTimeout(60);
          await p.screenshot({ path: OUT + `record-menu-${theme}.png` });
        }
        await ctx.close();
        ({ p, ctx } = await page(w, h, theme, 'record-score'));
        if (w === 320) await p.screenshot({ path: OUT + `record-score-${theme}-320.png` });
        await p.locator('[data-key="1"]').click();
        await p.locator('[data-key="3"]').click();
        await p.waitForTimeout(60);
        await p.screenshot({ path: OUT + `record-score-full-${theme}${sfx}.png` });
        await p.locator('[data-erow="1"]').click();
        await p.locator('[data-slot="2"]').click();
        await p.waitForTimeout(60);
        await p.screenshot({ path: OUT + `record-score-replace-${theme}${sfx}.png` });
        await ctx.close();
      }
    }
  }
  if (want('field')) {
    for (const theme of ['dark', 'light']) {
      const { p, ctx } = await page(375, 812, theme, 'record-score', '&field=1');
      await p.screenshot({ path: OUT + `field-record-score-${theme}.png` });
      await ctx.close();
    }
  }
  if (want('impact-none')) {
    const { p, ctx } = await page(375, 812, 'dark', 'analysis-impact');
    await p.selectOption('#anImpact', 'a6');
    await p.waitForTimeout(80);
    await p.screenshot({ path: OUT + 'analysis-impact-nodata-dark.png' });
    await ctx.close();
  }
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
