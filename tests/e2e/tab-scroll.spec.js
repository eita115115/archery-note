const { test, expect } = require("@playwright/test");
for (const motion of ["reduce", "no-preference"]) {
  test(`tabs retain their own reading position without changing practice data (${motion})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto("/");
    await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("archeryNote.v1"));
      data.sessions = Array.from({ length: 60 }, (_, i) => ({
        ...data.sessions[0],
        id: `scroll-demo-${i}`,
      }));
      localStorage.setItem("archeryNote.v1", JSON.stringify(data));
    });
    await page.reload();
    const before = await page.evaluate(
      () => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions,
    );
    const positions = [];
    const sample = async (stage) => {
      positions.push({
        stage,
        ...(await page.evaluate(() => ({
          y: globalThis.scrollY,
          height: globalThis.document.documentElement.scrollHeight,
          time: globalThis.performance.now(),
        }))),
      });
    };
    const tab = async (v) => {
      await sample(`before ${v}`);
      await page.locator(`#tabs [data-v="${v}"]`).click();
      await sample(`after ${v}`);
    };
    try {
      await tab("history");
      await expect
        .poll(() =>
          page.locator(".historyRecords").evaluate((el) => el.getBoundingClientRect().height),
        )
        .toBeGreaterThan(2000);
      await page.evaluate(() => globalThis.scrollTo(0, 1400));
      await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(1400);
      await tab("analysis");
      await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(0);
      await page.evaluate(() => globalThis.scrollTo(0, 600));
      await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(600);
      await tab("history");
      await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(1400);
      await tab("record");
      await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(0);
      await tab("analysis");
      await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(600);
      expect(
        await page.evaluate(() => JSON.parse(localStorage.getItem("archeryNote.v1")).sessions),
      ).toEqual(before);
    } finally {
      await sample("final");
      const body = JSON.stringify(positions, null, 2);
      await testInfo.attach("tab-scroll-positions", { body, contentType: "application/json" });
      console.log(`tab-scroll positions (${motion}): ${body}`);
    }
  });
}
