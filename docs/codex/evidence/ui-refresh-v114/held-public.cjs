const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { chromium, expect } = require('../compact-js/sandbox/node_modules/@playwright/test');
const out = path.resolve(process.env.PROOF_DIR || 'artifacts/ui-refresh/'+(process.env.REHEARSAL?'local-update':'public-update'));
fs.mkdirSync(out, {recursive:true});
let base = 'https://eita115115.github.io/archery-note/', server, switched=false;
const oldDir = path.resolve('artifacts/finish-metrics-v113/linux-dist');
const files = Object.keys(JSON.parse(fs.readFileSync('artifacts/release-v105/candidate.json')).hashes);
const warmFiles = files.filter(f => f.startsWith('scripts/') || f === 'style.min.css');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const write = (name,value) => fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2));
const log = s => { fs.appendFileSync(path.join(out,'progress.txt'),s+'\n'); console.log(s); };
const practice = d => ({sessions:d.sessions,active:d.active,setups:d.setups,sightMarks:d.sightMarks,customRounds:d.customRounds});
let ownedServer, browser, context, page, stage='starting', before, warmedAt;
const errors=[],loaded=[],jobs=[];
async function dbState(){ return page.evaluate(()=>JSON.parse(localStorage.getItem('archeryNote.v1'))); }
async function settle(){await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect.getTiming().iterations)).map(a=>a.finished.catch(()=>{}))));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function tap(selector){await settle();const r=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el}});assert(r.hit,selector);await page.touchscreen.tap(r.x,r.y);}
const arm=async function arm(page) {
  return page.evaluate(() => {
    const d = JSON.parse(globalThis.localStorage.getItem("archeryNote.v1"));
    const current = structuredClone(d.active);
    if (current.cur.length) current.ends.push(current.cur);
    const edit = !!current._edit;
    delete current.cur;
    delete current.editIndex;
    delete current._edit;
    const population = d.sessions.filter((s) => s && s.date && s.date <= current.date);
    population.push(current);
    const expected = edit
      ? { result: null, before: null }
      : {
          result: globalThis.computeTodaysResult(
            population,
            current.id,
            globalThis.sessionMetrics,
            {
              formAnalyses: d.formAnalyses,
            },
          ),
          before: globalThis.trGrowthBeforeFor(current, population, globalThis.sessionMetrics),
        };
    const original = {
      metrics: globalThis.sessionMetrics,
      result: globalThis.computeTodaysResult,
      before: globalThis.trGrowthBeforeFor,
      summary: globalThis.openSummary,
    };
    let phase = null;
    const counts = new Map(),
      visits = [];
    globalThis.sessionMetrics = function (s) {
      if (phase) {
        counts.set(s, (counts.get(s) || 0) + 1);
        visits.push({ id: s.id, date: s.date, phase });
      }
      return original.metrics(s);
    };
    for (const [key, name] of [
      ["result", "computeTodaysResult"],
      ["before", "trGrowthBeforeFor"],
    ])
      globalThis[name] = function (...args) {
        phase = key;
        try {
          return original[key](...args);
        } finally {
          phase = null;
        }
      };
    globalThis.__finishMetricsEvidence = { expected, current, edit, visits };
    globalThis.openSummary = function (s, isNew, gam, result, before) {
      Object.assign(globalThis.__finishMetricsEvidence, {
        actual: { result, before },
        computations: [...counts].map(([s, calls]) => ({ id: s.id, date: s.date, calls })),
      });
      return original.summary(s, isNew, gam, result, before);
    };
    globalThis.__restoreFinishMetrics = () => {
      globalThis.sessionMetrics = original.metrics;
      globalThis.computeTodaysResult = original.result;
      globalThis.trGrowthBeforeFor = original.before;
      globalThis.openSummary = original.summary;
    };
    return { old: d.sessions, current, expected, edit };
  });
};
(async()=>{
 if(process.env.REHEARSAL){const http=require('node:http');server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.replace(/^\/archery-note\//,'')||'index.html';if(!files.includes(name)){res.writeHead(404);res.end();return;}const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream','Cache-Control':'public,max-age=600'});res.end(fs.readFileSync(path.join(switched?'artifacts/compact-js/sandbox/dist/native':oldDir,name)));});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/archery-note/`;}
 ownedServer=await chromium.launchServer();write('owned-browser',{endpoint:ownedServer.wsEndpoint()});browser=await chromium.connect(ownedServer.wsEndpoint());context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true,reducedMotion:'reduce'});page=await context.newPage();globalThis.ownedUIRefreshFixture={page,context,browser,errors,loaded,jobs,getStage:()=>stage,getBefore:()=>before};page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{const f=new URL(r.url()).pathname.split('/archery-note/')[1];if(stage==='update'&&warmFiles.includes(f))jobs.push(r.body().then(b=>loaded.push({file:f,sha256:sha(b),status:r.status(),url:r.url()})));});
 await page.goto(base);assert.equal(await page.evaluate(()=>APP_VER),113);
 await page.getByRole('button',{name:'架空のデモデータで試す'}).click();
 await expect.poll(()=>page.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state),{timeout:20000}).toBe('activated');
 await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.locator('#tabs [data-v="record"]').click();await page.locator('#quickStart').click();await settle();
 const r=await page.locator('#tgsvg').boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);await expect.poll(async()=>(await dbState()).active.cur.length).toBe(1);
 before=practice(await dbState());assert.equal(before.sessions.length,3);
 const warm=await page.evaluate(async files=>Promise.all(files.map(async file=>{const r=await fetch(file,{cache:'reload'});return{file,body:await r.text(),headers:Object.fromEntries(r.headers.entries())};})),warmFiles);
 for(const row of warm)assert.equal(sha(row.body),sha(fs.readFileSync(path.join(oldDir,row.file))),row.file+' real113');
 warmedAt=Date.now();write('baseline',{from:113,to:114,before,warmedAt,warm:warm.map(({file,body,headers})=>({file,hash:sha(body),headers}))});
 stage='waiting';log('BASELINE_READY public113 / 15 warm old bodies / active1 and old3 / same context retained');
 if(server)switched=true;
 await expect.poll(async()=>{const r=await context.request.get(base+'version.json?verify='+Date.now());return r.ok()?(await r.json()).v:0;},{timeout:600000,intervals:[3000]}).toBe(114);
 const publicationMs=Date.now()-warmedAt;
 const remaining=Math.min(...warm.map(r=>{const m=/max-age=(\d+)/.exec(r.headers['cache-control']||'');assert(m,r.file);return(Number(m[1])-Number(r.headers.age||0))*1000;}));assert(publicationMs<remaining,'publication while warmed entries fresh');
 stage='active-update-block';await page.evaluate(()=>checkUpdate());await expect(page.locator('#updBar')).toBeHidden();assert.deepEqual(practice(await dbState()),before);
 await tap('#bFinish');await page.locator('#sumPlot').waitFor();await page.locator('#sumClose').scrollIntoViewIfNeeded();await tap('#sumClose');
 const beforeUpdate=practice(await dbState());assert.equal(beforeUpdate.sessions.length,4);assert.equal(beforeUpdate.active,null);assert.deepEqual(beforeUpdate.sessions.slice(0,3),before.sessions);assert.deepEqual(beforeUpdate.sessions[3].ends[0],before.active.cur);
 stage='update';await page.locator('#updBar').waitFor({state:'visible',timeout:20000});await page.screenshot({path:path.join(out,'banner.png')});await page.locator('#updBar').click();await page.waitForFunction(()=>typeof APP_VER!=="undefined"&&APP_VER===114);
 await expect.poll(()=>page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration(),k=await caches.keys();return k.includes('archery-note-v114')&&!k.includes('archery-note-v113')&&navigator.serviceWorker.controller===r?.active&&r?.active?.state==='activated';}),{timeout:20000}).toBe(true);
 await Promise.all(jobs);assert.deepEqual(practice(await dbState()),beforeUpdate);
 const canonical=await page.evaluate(async()=>{const c=await caches.open('archery-note-v114'),rows=[];for(const req of await c.keys()){const file=new URL(req.url).pathname.split('/archery-note/')[1];if(file?.startsWith('scripts/'))rows.push({file,body:await(await c.match(req)).text()});}return rows;});assert.equal(canonical.length,14);const canonicalHashes=Object.fromEntries(canonical.map(r=>[r.file,sha(r.body)]));for(const [file,hash]of Object.entries(canonicalHashes))assert.equal(hash,sha(fs.readFileSync(path.join('artifacts/compact-js/sandbox/dist/native',file))));
 write('after-update',{publicationMs,updateMs:Date.now()-warmedAt,before,beforeUpdate,after:practice(await dbState()),loaded,canonicalHashes});log('UPDATED public114 / finished1 and old3 exact / cache114 only');
 stage='recording';
 assert.equal((await dbState()).sessions.length,4);assert.deepEqual((await dbState()).sessions.slice(0,3),before.sessions);
 await page.setViewportSize({width:320,height:568});await page.locator('#fStart').scrollIntoViewIfNeeded();await tap('#fStart');await settle();
 const g=await page.locator('#tgsvg').evaluate(el=>{const r=el.getBoundingClientRect();return{rect:r.toJSON(),top:Math.max(0,document.querySelector('header.app').getBoundingClientRect().bottom),bottom:document.querySelector('#activeActionDock').getBoundingClientRect().top,scrollY};});
 assert(g.rect.y>=g.top+7&&g.rect.bottom<=g.bottom-7,JSON.stringify(g));await page.screenshot({path:path.join(out,'first-target320.png')});await page.touchscreen.tap(g.rect.x+g.rect.width/2,g.rect.y+g.rect.height/2);await expect.poll(async()=>(await dbState()).active.cur.length).toBe(1);

 await tap('#curChips [data-i="0"]');await settle();
 async function controls(){return page.evaluate(()=>{const h=document.querySelector('header.app').getBoundingClientRect(),d=document.querySelector('#activeActionDock').getBoundingClientRect();return [...document.querySelectorAll('#nudge .npad button, #nudgeDone')].map(el=>{const r=el.getBoundingClientRect(),pts=[[r.x+r.width/2,r.y+r.height/2],[r.left+8,r.top+8],[r.right-8,r.top+8],[r.left+8,r.bottom-8],[r.right-8,r.bottom-8]];return{id:el.id||el.dataset.n,rect:r.toJSON(),clear:pts.every(([x,y])=>el.contains(document.elementFromPoint(x,y))),above:h.bottom,below:d.top,scrollY};});});}
 const entry=await controls(),curBefore=(await dbState()).active.cur;for(const p of entry){assert(p.clear);assert(p.rect.top>=p.above+7&&p.rect.bottom<=p.below-7);assert(p.rect.width>=44&&p.rect.height>=44);}
 await page.screenshot({path:path.join(out,'correction-entry320.png')});
 for(let i=0;i<3;i++){await tap('#nudge [data-n="r"]');await settle();const ps=await controls();for(const p of ps){assert(p.clear);assert(p.rect.top>=p.above+7&&p.rect.bottom<=p.below-7);assert.equal(p.scrollY,entry[0].scrollY);}}
 await expect.poll(async()=> (await dbState()).active.cur[0].x).toBeCloseTo(curBefore[0].x+3*(await dbState()).active.faceD/200);
 const corrected=(await dbState()).active.cur;assert(Math.abs(corrected[0].x-curBefore[0].x-3*(await dbState()).active.faceD/200)<1e-8);
 const exitGeometry=await controls();write('correction-geometry',{entry,exitGeometry,curBefore,corrected});await page.screenshot({path:path.join(out,'correction-exit320.png')});
 await tap('#nudgeDone');await settle();assert(!await page.locator('#nudge').evaluate(el=>el.classList.contains('on')));assert.deepEqual((await dbState()).active.cur,corrected);
 const next=await page.locator('#tgsvg').evaluate(el=>{const r=el.getBoundingClientRect(),h=document.querySelector('header.app').getBoundingClientRect(),d=document.querySelector('#activeActionDock').getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,clear:el.contains(document.elementFromPoint(x,y)),above:h.bottom,below:d.top,rect:r.toJSON()};});assert(next.clear&&next.rect.top>=next.above+7&&next.rect.bottom<=next.below-7);await page.touchscreen.tap(next.x,next.y);await expect.poll(async()=>(await dbState()).active.cur.length).toBe(2);assert.deepEqual((await dbState()).active.cur.slice(0,1),corrected);
 const checkpoint=practice(await dbState());await context.setOffline(true);await page.reload();await page.waitForFunction(()=>typeof APP_VER!=="undefined"&&APP_VER===114);assert.deepEqual(practice(await dbState()),checkpoint);await page.screenshot({path:path.join(out,'offline.png')});await context.setOffline(false);
 assert.deepEqual(checkpoint.sessions.slice(0,3),before.sessions);assert.equal(checkpoint.active.cur.length,2);assert.deepEqual(errors,[]);
 stage='few-arrow-result';const metricsBaseline=await arm(page);await tap('#bFinish');await page.locator('#sumPlot').waitFor();const metricsTrace=await page.evaluate(()=>{const trace=globalThis.__finishMetricsEvidence;globalThis.__restoreFinishMetrics();return trace;});assert.deepEqual(metricsTrace.actual,metricsBaseline.expected);assert(metricsTrace.computations.length>0);assert(metricsTrace.computations.every(r=>r.calls===1));write('metrics-trace',{baseline:metricsBaseline,trace:metricsTrace});
 await expect(page.getByTestId('todays-result-stability-pending')).toContainText('2本の座標');await expect(page.getByTestId('todays-result-stability')).toHaveCount(0);await expect(page.getByTestId('todays-result-streak-stability')).toHaveCount(0);
 
 async function checkProjected(name){
  const row=page.getByTestId('todays-result-personal-best');await row.evaluate(el=>el.scrollIntoView({block:'center'}));await settle();
  const observed=await row.evaluate(el=>({text:el.innerText,primary:el.querySelector('.todaysResultPrimary').innerText,detail:el.querySelector('.todaysResultDetail').innerText,rect:el.getBoundingClientRect().toJSON(),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
  assert(observed.primary.includes('自己ベストの換算値'));assert(observed.detail.includes('推定・2本換算'));assert(!observed.primary.includes('更新'));assert(observed.scrollWidth<=observed.clientWidth+1);
  const result=await page.evaluate(()=>computePersonalBestDistance(db.sessions,db.sessions.at(-1).id));assert.equal(result.method,'avg-projected');assert.equal(result.todayArrows,2);assert(result.achieved);
  write(name,{observed,result});await page.screenshot({path:path.join(out,name+'.png')});
 }
 await checkProjected('projected-summary');
 const pendingText=await page.getByTestId('todays-result-stability-pending').innerText();await page.screenshot({path:path.join(out,'pending-summary.png')});
 const finished=practice(await dbState());assert.equal(finished.sessions.length,5);assert.equal(finished.active,null);assert.deepEqual(finished.sessions.slice(0,4),checkpoint.sessions);assert.deepEqual(finished.sessions[4].ends[0],checkpoint.active.cur);
 await page.locator('#sumClose').scrollIntoViewIfNeeded();await tap('#sumClose');
 await tap('#tabs [data-v="analysis"]');await settle();await expect(page.locator('.insightStrip').first()).toContainText('比較待ち');
 const analysis=await page.evaluate(()=>{const rows=buildAnalysisRows(db.sessions,db.setups,sessionMetrics);return {dashboard:growthDashboard(rows,today()),conclusion:todayConclusion(rows),suggestions:nextPracticeSuggestions(rows,today()),kpi:document.querySelector('.insightStrip').innerText,text:document.querySelector('.todayConclusionText').innerText};});
 assert.equal(analysis.dashboard.groupingDelta,null);assert(['grouping-pending','trend-up','trend-down'].includes(analysis.conclusion.kind));assert(analysis.suggestions.some(s=>s.id==='collect-coordinates'));assert(!analysis.suggestions.some(s=>s.id.endsWith('spread')));assert(analysis.kpi.includes('比較待ち'));await page.screenshot({path:path.join(out,'pending-analysis.png')});write('analysis',analysis);
 await page.locator('#tabs [data-v="history"]').click();await page.locator('.historyRow[data-id="'+finished.sessions[4].id+'"]').click();await expect(page.getByTestId('todays-result-stability-pending')).toHaveText(pendingText);assert(!(await page.locator('.ovl').last().innerText()).includes('グルーピングは良好'));await settle();const historyGeometry=await page.getByTestId('todays-result-stability-pending').evaluate(el=>{const r=el.getBoundingClientRect(),a=document.querySelector('.histDetailActions').getBoundingClientRect(),pts=[[r.x+r.width/2,r.y+r.height/2],[r.left+10,r.top+10],[r.right-10,r.top+10],[r.left+10,r.bottom-10],[r.right-10,r.bottom-10]];return {row:r.toJSON(),footer:a.toJSON(),clear:pts.every(([x,y])=>el.contains(document.elementFromPoint(x,y)))};});assert(historyGeometry.clear);assert(historyGeometry.row.bottom<=historyGeometry.footer.y);write('history-geometry',historyGeometry);await page.screenshot({path:path.join(out,'pending-history.png')});await checkProjected('projected-history');await page.locator('#hClose').click();await page.reload();assert.deepEqual(practice(await dbState()),finished);assert.deepEqual(errors,[]);

 write('complete',{public:!server,version:114,publicationMs,updateMs:Date.now()-warmedAt,geometry:g,baseline:before,beforeUpdate,checkpoint,finished,pendingText,groupingPending:true,projectedCountNote:true,metricsSharedOnce:true,metricsTrace,loaded,canonicalHashes,errors,activeUpdateBlocked:true,offlineReload:true});log('PASS: same '+(server?'local':'real public')+'113→114 context, active update blocked/native finish/old4 retained, 320 newstart first native arrow/correction/native exit/next arrow, offline SWreload exact / two-arrow pending in summary+history / old4 and finish5 exact');
 await context.close();await browser.close();await ownedServer.close();
 if(server)await new Promise(r=>server.close(r));
})().catch(async e=>{write('failure',{stage,message:e.stack,before,warmedAt,errors,loaded});console.error(e);if(page){try{await page.screenshot({path:path.join(out,'failure.png')});write('failure-state',{stage,stored:await dbState(),url:page.url(),version:await page.evaluate(()=>typeof APP_VER==='undefined'?null:APP_VER)});}catch{} }console.error('Failure context retained for investigation; no reset or substitute context.');process.exitCode=1;});
