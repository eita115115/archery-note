const fs=require('node:fs'),cp=require('node:child_process');
const root='artifacts/analysis-sight-filter';
fs.writeFileSync(root+'/ci-initial-failed.json',cp.execFileSync('gh',['run','view','38243603273','--json','databaseId,headSha,status,conclusion,jobs,url'],{encoding:'utf8'}));
fs.writeFileSync(root+'/ci-initial-full-log.txt',cp.execFileSync('gh',['run','view','38243603273','--log'],{encoding:'utf8',maxBuffer:30000000}));
let s=fs.readFileSync(root+'/repro-tab-scroll.cjs','utf8');
s=s.replace('await page.goto(',"const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:8});await page.goto(");
s=s.replace('const observed=await page.evaluate',"await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const observed=await page.evaluate");
fs.writeFileSync(root+'/repro-tab-scroll-cpu.cjs',s);
