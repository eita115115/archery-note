async function pullSheetHandle(page, context) {
  const box = await page.locator(".modalSwipeHandle").boundingBox();
  if (!box) throw new Error("Sheet handle must be visible before a touch pull");
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const cdp = await context.newCDPSession(page);
  try {
    // Raw rapid touchMove packets can start a Chromium fling. The next tap then
    // stops momentum instead of clicking, even after an unrelated page reload.
    await cdp.send("Input.synthesizeScrollGesture", {
      x,
      y,
      yDistance: 110,
      gestureSourceType: "touch",
      speed: 800,
      preventFling: true,
    });
  } finally {
    await cdp.detach();
  }
}
module.exports = { pullSheetHandle };
