const { test, expect } = require("@playwright/test");

async function seedAnalysis(page, width, height, colorScheme) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "架空のデモデータで試す" }).click();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("archeryNote.v1"));
    data.setups = [
      { id: "analysis-a", name: "用具A", type: "recurve" },
      { id: "analysis-b", name: "用具B", type: "recurve" },
    ];
    data.sessions[0].setupId = "analysis-a";
    data.sessions[0].dist = 70;
    data.sessions[0].faceD = 122;
    data.sessions[1].setupId = "analysis-b";
    localStorage.setItem("archeryNote.v1", JSON.stringify(data));
  });
  await page.reload();
  await page.locator('#tabs [data-v="analysis"]').click();
  await expect(page.getByTestId("analysis-score")).toBeVisible();
}
/* v5 段 7: 絞り込みは 分析 > スコア の3つの欄（条件・弓具・期間）。デモの3回は 18m・40cm的・6射で、
   seedAnalysis が1回を 70m・122cm的に変える（用具A）。もう1回は用具B、残りは用具なし */
const target = (page) => page.getByTestId("analysis-target");

async function practiceData(page) {
  return page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("archeryNote.v1"));
    return {
      sessions: data.sessions,
      setups: data.setups,
      sightMarks: data.sightMarks,
      active: data.active,
    };
  });
}

async function expectWithinAppChrome(control) {
  await control.evaluate(
    () =>
      new Promise((resolve) =>
        globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
      ),
  );
  await expect
    .poll(() =>
      control.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const header = { bottom: 0 }; // v5: 上に固定の帯は無い（画面の上端が基準）
        const tabs = globalThis.document.querySelector("#tabs").getBoundingClientRect();
        return rect.top >= Math.max(0, header.bottom) + 4 && rect.bottom <= tabs.top - 4;
      }),
    )
    .toBe(true);
}

test("empty analysis offers a direct route to the first practice without changing records", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.addInitScript(() => {
    if (!localStorage.getItem("archeryNote.v1"))
      localStorage.setItem(
        "archeryNote.v1",
        JSON.stringify({
          schema: 5,
          sessions: [],
          setups: [],
          active: null,
          settings: { onboardingSeen: true, launchCount: 10 },
        }),
      );
  });
  await page.goto("/");
  const before = await practiceData(page);
  await page.locator('#tabs [data-v="analysis"]').click();
  await expect(page.locator("#anSetup")).toHaveCount(0);
  const start = page.getByRole("button", { name: "記録タブへ", exact: true });
  await expect(start).toHaveCount(1);
  await expectWithinAppChrome(start);
  await start.click();
  await expect(page.getByTestId("record-start")).toBeVisible();
  expect(await practiceData(page)).toEqual(before);
});

for (const [width, height, colorScheme] of [
  [320, 568, "light"],
  [375, 812, "dark"],
]) {
  test(`analysis opens with its conditions and the target line readable (${width}/${colorScheme})`, async ({
    page,
  }) => {
    await seedAnalysis(page, width, height, colorScheme);
    await expectWithinAppChrome(page.getByRole("combobox", { name: "条件", exact: true }));
    await expectWithinAppChrome(page.getByRole("combobox", { name: "弓具", exact: true }));
    await expectWithinAppChrome(page.getByRole("combobox", { name: "期間", exact: true }));
    await expect(target(page)).toContainText("対象: ");
    await expect(page.getByTestId("today-conclusion")).toHaveCount(0);
  });

  test(`changed analysis selections remain visible above fixed navigation (${width}/${colorScheme})`, async ({
    page,
  }) => {
    await seedAnalysis(page, width, height, colorScheme);
    const before = await practiceData(page);
    for (const [name, values] of [
      ["弓具", ["__none", ""]],
      ["期間", ["7d", "all"]],
    ]) {
      const control = page.getByRole("combobox", { name, exact: true });
      await control.focus();
      for (const v of values) {
        await control.selectOption(v);
        await expect(control).toBeFocused();
        await expectWithinAppChrome(control);
      }
    }
    const cond = page.getByRole("combobox", { name: "条件", exact: true });
    const options = await cond.locator("option").evaluateAll((els) => els.map((o) => o.value));
    expect(options.length).toBe(2);
    await cond.focus();
    for (const v of [options[1], options[0]]) {
      await cond.selectOption(v);
      await expect(cond).toBeFocused();
      await expect(cond).toHaveValue(v);
      await expectWithinAppChrome(cond);
    }
    expect(await practiceData(page)).toEqual(before);
  });

  test(`analysis selections are reachable by their visible labels and state n (${width}/${colorScheme})`, async ({
    page,
  }) => {
    await seedAnalysis(page, width, height, colorScheme);
    const before = await practiceData(page);
    const cond = page.getByRole("combobox", { name: "条件", exact: true });
    const setup = page.getByRole("combobox", { name: "弓具", exact: true });
    await expect(cond).toHaveCount(1);
    await expect(setup).toHaveCount(1);
    await cond.selectOption({ label: "70m・122cm的・6射" });
    await expect(target(page)).toContainText("70m・122cm的・6射、1回・6射");
    await cond.selectOption({ label: "18m・40cm的・6射" });
    await expect(target(page)).toContainText("18m・40cm的・6射、2回・12射");
    await setup.selectOption("analysis-b");
    await expect(target(page)).toContainText("1回・6射");
    await expect(target(page)).toContainText("弓具は 用具B");
    await setup.selectOption("__none");
    await expect(target(page)).toContainText("1回・6射");
    await expect(target(page)).toContainText("弓具は未指定の記録");
    await setup.selectOption("");
    await expect(target(page)).toContainText("2回・12射");
    expect(await practiceData(page)).toEqual(before);
  });

  test(`analysis selections keep keyboard position and order (${width}/${colorScheme})`, async ({
    page,
  }) => {
    await seedAnalysis(page, width, height, colorScheme);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const before = await practiceData(page);
    const cond = page.locator("#anCond");
    const setup = page.locator("#anSetup");
    const period = page.locator("#anPeriod");
    await setup.focus();
    await setup.selectOption("analysis-b");
    await expect(setup).toBeFocused();
    await expect(setup).toHaveValue("analysis-b");
    await setup.selectOption("");
    await expect(setup).toBeFocused();
    // A replacement control must remain in the ordinary keyboard order.
    await page.keyboard.press("Tab");
    await expect(period).toBeFocused();
    await period.selectOption("7d");
    await expect(period).toBeFocused();
    await expect(period).toHaveValue("7d");
    await page.keyboard.press("Shift+Tab");
    await expect(setup).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(cond).toBeFocused();
    // Changing a selection externally should not pull focus from another live control.
    const otherControl = page.locator('#tabs [data-v="analysis"]');
    await otherControl.focus();
    await page.evaluate(() => {
      const select = globalThis.document.querySelector("#anPeriod");
      select.value = "all";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(otherControl).toBeFocused();
    await expect(period).toHaveValue("all");
    expect(await practiceData(page)).toEqual(before);
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  });
}
