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
  await expect(page.getByTestId("growth-dashboard")).toBeVisible();
}

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

for (const [width, height, colorScheme] of [
  [320, 568, "light"],
  [375, 812, "dark"],
]) {
  test(`analysis filters are reachable by their visible labels (${width}/${colorScheme})`, async ({
    page,
  }) => {
    await seedAnalysis(page, width, height, colorScheme);
    const before = await practiceData(page);
    const setup = page.getByRole("combobox", { name: "用具", exact: true });
    const distance = page.getByRole("combobox", { name: "距離", exact: true });
    await expect(setup).toHaveCount(1);
    await expect(distance).toHaveCount(1);
    await distance.selectOption("70");
    await expect(page.locator(".insightStrip .insightTile").first()).toContainText("1回 6本");
    await distance.selectOption("");
    await setup.selectOption("analysis-b");
    await expect(page.locator(".insightStrip .insightTile").first()).toContainText("1回 6本");
    await setup.selectOption("__none");
    await expect(page.locator(".insightStrip .insightTile").first()).toContainText("1回 6本");
    await setup.selectOption("");
    await expect(page.locator(".insightStrip .insightTile").first()).toContainText("3回 18本");
    expect(await practiceData(page)).toEqual(before);
  });

  test(`analysis selections keep keyboard position and period navigation (${width}/${colorScheme})`, async ({
    page,
  }) => {
    await seedAnalysis(page, width, height, colorScheme);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const before = await practiceData(page);
    const distance = page.locator("#anDist");
    const setup = page.locator("#anSetup");
    await distance.focus();
    await distance.selectOption("70");
    await expect(distance).toBeFocused();
    await expect(distance).toHaveValue("70");
    await distance.selectOption("");
    await expect(distance).toBeFocused();
    await setup.focus();
    await setup.selectOption("analysis-b");
    await expect(setup).toBeFocused();
    await expect(setup).toHaveValue("analysis-b");
    await setup.selectOption("");
    await expect(setup).toBeFocused();
    // A replacement setup control must remain in the ordinary keyboard order.
    await page.keyboard.press("Tab");
    await expect(distance).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator('[data-period="all"]')).toBeFocused();
    await page.keyboard.press("Tab");
    const sevenDays = page.locator('[data-period="7d"]');
    await expect(sevenDays).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(sevenDays).toBeFocused();
    await expect(sevenDays).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".insightStrip .insightTile").first()).toContainText("1回 6本");
    // Changing a filter externally should not pull focus from another live control.
    await page.locator("#btnSettings").focus();
    await page.evaluate(() => {
      const select = globalThis.document.querySelector("#anDist");
      select.value = "70";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.locator("#btnSettings")).toBeFocused();
    expect(await practiceData(page)).toEqual(before);
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  });
}
