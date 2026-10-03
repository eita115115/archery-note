/* global db, scoreAt, lineCutRadius, document, window, visualViewport */
const { test, expect } = require("@playwright/test");

test.use({ hasTouch: true, isMobile: true });

async function gesture(cdp, type, points = []) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
}

async function count(page) {
  return page.evaluate(() => db.active.cur.length);
}

async function points(page) {
  const r = await page.locator("#tgsvg").evaluate((svg) => {
    const r = svg.getBoundingClientRect();
    const top = Math.max(
      r.top,
      document.querySelector("header.app").getBoundingClientRect().bottom + 8,
    );
    const bottom = Math.min(
      r.bottom,
      document.querySelector("#activeActionDock").getBoundingClientRect().top - 8,
    );
    return { x: r.x + r.width / 2, y: (top + bottom) / 2, height: bottom - top };
  });
  expect(r.height).toBeGreaterThan(50);
  return [
    { id: 0, x: r.x - 25, y: r.y },
    { id: 1, x: r.x + 25, y: r.y },
  ];
}

for (const width of [320, 375]) {
  for (const fallback of [false, true]) {
    for (const scenario of ["simultaneous", "added outside after fine"]) {
      test(`target cancels ${scenario} fingers (${width}, ${fallback ? "touch fallback" : "pointer"})`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        if (fallback)
          await page.addInitScript(() => {
            Object.defineProperty(window, "PointerEvent", { value: undefined });
          });
        await page.addInitScript(() => {
          globalThis.touchEndCounts = [];
          document.addEventListener(
            "touchend",
            (e) => {
              globalThis.touchEndCounts.push({ touches: e.touches.length, trusted: e.isTrusted });
            },
            true,
          );
        });
        await page.goto("/");
        await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
        await page.locator('#tabs [data-v="record"]').click();
        await page.getByRole("combobox", { name: "1エンドの本数", exact: true }).selectOption("6");
        await page.getByTestId("record-start").click();
        const sessions = await page.evaluate(() => JSON.parse(JSON.stringify(db.sessions)));
        const cdp = await context.newCDPSession(page);
        const [a, b] = await points(page);
        const scale = await page.evaluate(() => visualViewport.scale);
        if (scenario === "simultaneous") {
          await gesture(cdp, "touchStart", [a, b]);
        } else {
          await gesture(cdp, "touchStart", [a]);
          await expect(page.locator("#lens")).toHaveClass(/fine/);
          // A second finger outside the SVG must cancel the active target gesture too.
          b.x = width - 5;
          b.y = 90;
          await gesture(cdp, "touchStart", [a, b]);
        }
        await gesture(cdp, "touchMove", [
          { ...a, x: a.x - 8 },
          { ...b, x: b.x + (scenario === "simultaneous" ? 8 : -2) },
        ]);
        // The installed Chromium backend accepts explicit changed points for a
        // partial end. Assert its trusted touchend with one finger remaining.
        await gesture(cdp, "touchEnd", [b]);
        expect(
          await page.evaluate(() =>
            globalThis.touchEndCounts.some((e) => e.touches === 1 && e.trusted),
          ),
        ).toBe(true);
        await gesture(cdp, "touchEnd");
        expect(await count(page)).toBe(0);
        await expect(page.locator("#lens")).toBeHidden();
        await expect(page.locator("#lensTag")).toBeHidden();
        expect(await page.locator("#tgcur").textContent()).toBe("");
        expect(await page.evaluate(() => visualViewport.scale)).toBe(scale);

        await gesture(cdp, "touchStart", [a, b]);
        await gesture(cdp, "touchCancel");
        expect(await count(page)).toBe(0);
        await expect(page.locator("#lens")).toBeHidden();

        // All fingers released: ordinary tap and long-press fine drag recover.
        await page.touchscreen.tap(a.x, a.y);
        await expect.poll(() => count(page)).toBe(1);
        const [single] = await points(page);
        await gesture(cdp, "touchStart", [single]);
        await gesture(cdp, "touchMove", [{ ...single, x: single.x + 20 }]);
        await gesture(cdp, "touchEnd");
        await expect.poll(() => count(page)).toBe(2);
        const [fine] = await points(page);
        await gesture(cdp, "touchStart", [fine]);
        await expect(page.locator("#lens")).toHaveClass(/fine/);
        await gesture(cdp, "touchMove", [{ ...fine, x: fine.x + 20 }]);
        await gesture(cdp, "touchEnd");
        await expect.poll(() => count(page)).toBe(3);
        expect(await page.evaluate(() => db.active.cur[1].x)).toBeGreaterThan(
          await page.evaluate(() => db.active.cur[2].x),
        );
        const result = await page.evaluate(() => {
          const a = db.active.cur[2];
          return {
            arrow: a,
            hit: scoreAt(
              a.x,
              a.y,
              db.active.faceD,
              db.active.faceType,
              lineCutRadius(db.active.faceD, db.active.faceType),
            ),
          };
        });
        expect(result.arrow.s).toBe(result.hit.s);
        expect(result.arrow.X).toBe(result.hit.X);
        await gesture(cdp, "touchStart", [single]);
        await gesture(cdp, "touchCancel");
        expect(await count(page)).toBe(3);
        await expect(page.locator("#lens")).toBeHidden();
        await page.touchscreen.tap(single.x, single.y);
        await expect.poll(() => count(page)).toBe(4);
        await expect
          .poll(() =>
            page.evaluate(
              () => JSON.parse(localStorage.getItem("archeryNote.v1")).active.cur.length,
            ),
          )
          .toBe(4);
        expect(await page.evaluate(() => db.sessions)).toEqual(sessions);
        await page.reload();
        expect(await count(page)).toBe(4);
        expect(await page.evaluate(() => db.sessions)).toEqual(sessions);
        await cdp.detach();
      });
    }
  }
}
