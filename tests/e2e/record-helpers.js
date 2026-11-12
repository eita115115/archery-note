"use strict";
/* v5 の記録画面（没入画面）で使う共通操作。終了はメニューの中、タブは「中断」で戻ってから使う */
async function finishFromMenu(page) {
  await page.getByTestId("active-menu").click();
  await page.getByTestId("active-finish").click();
}
async function pauseRecording(page) {
  await page.getByTestId("active-pause").click();
}
async function resumeRecording(page) {
  await page.getByTestId("record-resume").click();
}
module.exports = { finishFromMenu, pauseRecording, resumeRecording };
