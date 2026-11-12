const { test, expect } = require("@playwright/test");
for (const width of [360, 375])
  for (const theme of ["light", "dark"]) {
    test(`secondary touch controls remain usable (${width}, ${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/");
      await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
      await page.locator('#tabs [data-v="record"]').click();
      const tappable = async (selectors) => {
        for (const selector of selectors) {
          const rect = await page.locator(selector).boundingBox();
          expect(rect.width, selector).toBeGreaterThanOrEqual(44);
          expect(rect.height, selector).toBeGreaterThanOrEqual(44);
        }
      };
      // v5: 待機画面の操作 → 記録の条件の操作（弓具を開く・日付などの折りたたみ・戻る）
      await tappable([
        "#btnSettings",
        "#recConditions",
        "#quickStart",
        '[data-testid="start-input-target"]',
        '[data-testid="start-input-score"]',
        "#homeLastOpen",
        "#homeNotes",
      ]);
      await page.locator("#recConditions").click();
      await tappable(["#condBack", "#jumpGear", ".recordDetails summary", "#fStart"]);
      await page.locator(".recordDetails summary").click({ position: { x: 3, y: 3 } });
      await expect(page.locator(".recordDetails")).toHaveAttribute("open", "");
      await page.locator("#condBack").click({ position: { x: 3, y: 3 } });
      await page.locator("#quickStart").click();
      // v5: 記録中の副操作は 中断・メニュー・中心を拡大。どれも 44px 以上で、端をタップしても反応する
      for (const selector of ["#bPause", "#bMenu", "#bZoom"]) {
        const rect = await page.locator(selector).boundingBox();
        expect(rect.width, selector).toBeGreaterThanOrEqual(44);
        expect(rect.height, selector).toBeGreaterThanOrEqual(44);
      }
      // 状態行: 第Nエンドと合計が同じ行に並ぶ
      const stat = await page.evaluate(() =>
        ["#recEndN", "#hudTotal"].map((s) => {
          const r = globalThis.document.querySelector(s).getBoundingClientRect();
          return { top: r.top, bottom: r.bottom };
        }),
      );
      expect(stat[1].top).toBeLessThan(stat[0].bottom);
      expect(stat[0].top).toBeLessThan(stat[1].bottom);
      await page.locator("#bZoom").click({ position: { x: 3, y: 3 } });
      await expect(page.locator("#bZoom")).toHaveAttribute("aria-pressed", "true");
      expect(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        ),
      ).toBe(false);
      await page.locator("#bMenu").click({ position: { x: 3, y: 3 } });
      await expect(page.getByTestId("active-menu-sheet")).toBeVisible();
      await page.locator("#mSettings").click();
      await expect(page.locator("#setClose")).toBeVisible();
    });
  }
for (const width of [360, 375]) {
  test(`visible target above fixed actions accepts one arrow (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
    await page.locator('#tabs [data-v="record"]').click();
    await page.locator("#quickStart").click();
    await page.evaluate(() => globalThis.scrollTo(0, 0));
    const target = page.locator("#tgWrap svg").first();
    const box = await target.boundingBox();
    const dock = await page.locator("#activeActionDock").boundingBox();
    const x = box.x + box.width / 2;
    // v5: 的は操作列に隠れない。的の下端ぎりぎり（下端から 12px）でも1本記録できる
    expect(box.y + box.height).toBeLessThanOrEqual(dock.y);
    const y = box.y + box.height - 12;
    expect(y).toBeGreaterThan(box.y);
    expect(y).toBeLessThan(dock.y);
    expect(
      await page.evaluate(
        ({ x, y }) => !!globalThis.document.elementFromPoint(x, y)?.closest("#tgWrap"),
        { x, y },
      ),
    ).toBe(true);
    await page.mouse.click(x, y);
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active.cur.length,
        ),
      )
      .toBe(1);
    await page.locator("#activeActionDock").getByRole("button", { name: "取消" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(globalThis.localStorage.getItem("archeryNote.v1")).active.cur.length,
        ),
      )
      .toBe(0);
  });
}
