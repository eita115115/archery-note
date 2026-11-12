const { test, expect } = require("@playwright/test");
const { pauseRecording, resumeRecording } = require("./record-helpers");

test.use({ hasTouch: true, isMobile: true, serviceWorkers: "block" });

async function settle(page) {
  await page.evaluate(() =>
    Promise.all(
      globalThis.document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect.getTiming().iterations))
        .map((a) => a.finished.catch(() => {})),
    ),
  );
}

async function tap(page, locator) {
  await settle(page);
  const box = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      uncovered:
        globalThis.document
          .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
          ?.closest("button") === el,
      nav: globalThis.innerHeight, // v5: 記録中はタブが無い。画面の下端が基準
    };
  });
  expect(box.uncovered).toBe(true);
  expect(box.y).toBeGreaterThan(0);
  expect(box.y).toBeLessThan(box.nav);
  await page.touchscreen.tap(box.x, box.y);
}

async function revealCorrection(page, locator) {
  // v5: 修正の操作は画面の下端に出るので、探すためのスクロールは要らない。画面内にあることだけ確かめる
  await settle(page);
  const r = await locator.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, height: globalThis.innerHeight, y: globalThis.scrollY };
  });
  expect(r.top).toBeGreaterThanOrEqual(0);
  expect(r.bottom).toBeLessThanOrEqual(r.height);
  expect(r.y).toBe(0);
}

async function targetBounds(page) {
  await settle(page);
  return page.locator("#tgsvg").evaluate((el) => {
    const r = el.getBoundingClientRect();
    const h = { bottom: 0 };
    // 下の基準は見えている方（操作列、または矢を選んだときの修正バー）
    const d = (
      globalThis.document.querySelector("#nudge.on") ||
      globalThis.document.querySelector("#activeActionDock")
    ).getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      top: Math.max(0, h.bottom),
      bottom: d.top,
    };
  });
}

async function recordArrow(page, index) {
  const count = await page.evaluate(
    () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active.cur.length,
  );
  const r = await targetBounds(page);
  const top = Math.max(r.y, r.top + 8),
    bottom = Math.min(r.y + r.height, r.bottom - 8);
  expect(bottom - top).toBeGreaterThan(32);
  await page.touchscreen.tap(r.x + r.width / 2 + ((index % 3) - 1) * 14, (top + bottom) / 2);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active.cur.length,
      ),
    )
    .toBe(count + 1);
}

async function expectTargetVisible(page) {
  const r = await targetBounds(page);
  expect(r.y).toBeGreaterThanOrEqual(r.top + 7);
  expect(r.y + r.height).toBeLessThanOrEqual(r.bottom - 7);
}

for (const size of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
]) {
  for (const motion of ["no-preference", "reduce"]) {
    test(`correction returns to target and next end (${size.width}, ${motion})`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(size);
      await page.emulateMedia({
        reducedMotion: motion,
        colorScheme: size.width === 375 ? "dark" : "light",
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/");
      await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
      await page.locator('#tabs [data-v="record"]').click();
      await page.getByRole("button", { name: "70m", exact: true }).click();
      await page.locator("#fFace").selectOption("122");
      await page.locator("#fArrows").selectOption("6");
      const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")));
      const before = (await state()).sessions;
      await page.getByTestId("record-start").click();
      for (let n = 0; n < 6; n++) {
        await recordArrow(page, n);
        await expect.poll(async () => (await state()).active.cur.length).toBe(n + 1);
      }
      await tap(page, page.locator('#curChips [data-i="0"]'));
      const right = page.locator('#nudge [data-n="r"]');
      await revealCorrection(page, right);
      const original = (await state()).active.cur[0];
      await tap(page, right);
      await expect.poll(async () => (await state()).active.cur[0].x).toBeGreaterThan(original.x);
      await revealCorrection(page, page.locator("#nudgeDone"));
      const corrected = (await state()).active.cur;
      await tap(page, page.locator("#nudgeDone"));
      await page.screenshot({
        path: testInfo.outputPath("correction-return.png"),
        animations: "disabled",
      });
      await expectTargetVisible(page);
      expect((await state()).active.cur).toEqual(corrected);
      await tap(page, page.getByTestId("active-end"));
      await expect.poll(async () => (await state()).active.ends.length).toBe(1);
      expect((await state()).active.ends[0]).toEqual(corrected);
      await expectTargetVisible(page);
      await recordArrow(page, 0);
      await expect.poll(async () => (await state()).active.cur.length).toBe(1);
      // Ongoing correction and metadata updates must not jump back to the target.
      const chip = page.locator('#curChips [data-i="0"]');
      await tap(page, chip);
      await revealCorrection(page, right);
      let scroll = await page.evaluate(() => globalThis.scrollY);
      await tap(page, right);
      expect(
        Math.abs((await page.evaluate(() => globalThis.scrollY)) - scroll),
      ).toBeLessThanOrEqual(1);
      // v5: 理由タグは「理由・矢番号」のシートの中。閉じても修正バーは開いたまま
      await tap(page, page.locator("#shotMetaOpen"));
      const tag = page.locator("#shotReasonTags .reasonTag").first();
      scroll = await page.evaluate(() => globalThis.scrollY);
      await tap(page, tag);
      await expect.poll(async () => (await state()).active.cur[0].reason).toBeTruthy();
      await tap(page, page.locator("#shotMetaClose"));
      await expect(page.locator("#nudge")).toBeVisible();
      expect(
        Math.abs((await page.evaluate(() => globalThis.scrollY)) - scroll),
      ).toBeLessThanOrEqual(1);
      // 同じ枠をもう一度タップすると選択が外れ、操作列に戻る
      await tap(page, chip);
      await expect(page.locator("#nudge")).toBeHidden();
      await expectTargetVisible(page);
      // Delete also closes correction and returns to recording.
      await tap(page, chip);
      const remove = page.locator('#nudge [data-n="del"]');
      await revealCorrection(page, remove);
      await tap(page, remove);
      await expect.poll(async () => (await state()).active.cur.length).toBe(0);
      await expectTargetVisible(page);
      // v5: 修正バーが出ている間は操作列が隠れる。「完了」で閉じてからエンドを確定する
      await recordArrow(page, 0);
      await tap(page, chip);
      await revealCorrection(page, right);
      const second = (await state()).active.cur;
      await expect(page.getByTestId("active-end")).toBeHidden();
      await tap(page, page.locator("#nudgeDone"));
      await tap(page, page.getByTestId("active-end"));
      await expect.poll(async () => (await state()).active.ends.length).toBe(2);
      expect((await state()).active.ends[1]).toEqual(second);
      await expectTargetVisible(page);
      await recordArrow(page, 0);
      await expect.poll(async () => (await state()).active.cur.length).toBe(1);
      const active = (await state()).active;
      expect((await state()).sessions).toEqual(before);
      // v5: 記録中はタブが無い。「中断」で離れて別のタブを見ても、記録タブの「記録を再開する」で同じ状態に戻る
      await expect(page.locator("#tabs")).toBeHidden();
      await pauseRecording(page);
      await expect(page.locator("#tabs")).toBeVisible();
      await page.locator('#tabs [data-v="history"]').click();
      await page.locator('#tabs [data-v="record"]').click();
      await expect(page.getByTestId("record-paused")).toContainText("2エンド確定");
      await expect(page.getByTestId("record-start")).toHaveCount(0);
      await resumeRecording(page);
      await settle(page);
      await expectTargetVisible(page);
      await expect(page.locator("#curChips [data-i]")).toHaveCount(1);
      expect((await state()).active).toEqual(active);
      await page.reload();
      expect((await state()).active).toEqual(active);
      expect((await state()).sessions).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}
