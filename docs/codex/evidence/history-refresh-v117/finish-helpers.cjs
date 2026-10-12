const fs=require('node:fs'),assert=require('node:assert/strict');
const p='artifacts/history-refresh/capture.cjs';let s=fs.readFileSync(p,'utf8');
const before="await page.goto('http://127.0.0.1:'+server.address().port);";
assert(s.includes(before));s=s.replace(before,"await page.goto(process.env.HISTORY_BASE||('http://127.0.0.1:'+server.address().port));");
fs.writeFileSync(p,s);
fs.writeFileSync('artifacts/history-refresh/review-supplement.json',JSON.stringify({source:'3a1e6d0598c10dd022353ee15cf5f2b284cd51b7',critical:[],important:[],minor:[],staticMerge:true,verified:'test-only 6 insertions/3 deletions: fmtD zero padding and independent visible date/accessible name/distance checks; original full299pass3fail aligns with old expectations; final full pending at review'},null,2));
fs.writeFileSync('artifacts/history-refresh/helper-errors.txt','Initial read used tests/history paths and Windows scripts globs; corrected to tests/e2e and rg scripts. One optional old error-context read guessed a nonexistent path; original failure output retained. A PowerShell parser rejected the attempted capture helper edit before any command ran; corrected using apply_patch. No app state changed by these helper errors.\n');
console.log('PASS public-history helper ready; review and helper errors retained');
