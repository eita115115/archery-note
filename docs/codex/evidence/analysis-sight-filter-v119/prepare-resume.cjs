const fs=require('node:fs'),assert=require('node:assert/strict');const root='artifacts/analysis-sight-filter';
let s=fs.readFileSync(root+'/public-update.cjs','utf8');
s=s.replace("const out = path.resolve(process.env.PROOF_DIR || 'artifacts/analysis-sight-filter/'+(process.env.REHEARSAL?'local-update':'public-update'));", "const out = path.resolve('artifacts/analysis-sight-filter/public-resumed');");
s=s.replace('console.log(s); };',"fs.appendFileSync('artifacts/analysis-sight-filter/public-resumed-output.txt',s+'\\n');console.log(s); };");
const start=s.indexOf(' if(process.env.REHEARSAL)'),end=s.indexOf(' const warm=await page.evaluate',start);assert(start>0&&end>start);
const bootstrap=` const owner=globalThis.ownedReadableActionsFixture;assert(owner,'original context exists');browser=owner.browser;context=owner.context;page=owner.page;assert(!page.isClosed());before=practice(await dbState());assert.deepEqual(before,JSON.parse(fs.readFileSync('artifacts/analysis-sight-filter/public-update/baseline.json')).before);assert.equal(await page.evaluate(()=>APP_VER),118);assert.deepEqual(owner.errors,[]);globalThis.ownedSightFilterResume={page,context,browser,errors,getStage:()=>stage,getBefore:()=>before};page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{const f=new URL(r.url()).pathname.split('/archery-note/')[1];if(stage==='update'&&warmFiles.includes(f))jobs.push(r.body().then(b=>loaded.push({file:f,sha256:sha(b),status:r.status(),url:r.url()})));});
 write('identity',{samePage:page===owner.page,sameContext:context===owner.context,sameBrowser:browser===owner.browser,url:page.url(),originalFailure:'public-update/failure.json',originalActiveID:before.active.id,originalSessionIDs:before.sessions.map(s=>s.id),newContextCreated:false,newSeed:false,newArrow:false});
`;
s=s.slice(0,start)+bootstrap+s.slice(end);
s=s.replace('await context.close();await browser.close();await ownedServer.close();','await context.close();await browser.close();process.exitCode=0;');
assert(!s.includes('newContext(')&&!s.includes('page.goto(')&&!s.includes('quickStart')&&!s.includes('launchServer('));
fs.writeFileSync(root+'/resume-public.cjs',s);
for(const f of ['archive.cjs','finish-notes.cjs','parity.cjs']){let t=fs.readFileSync(root+'/'+f,'utf8').replaceAll('public-update/complete.json','public-resumed/complete.json').replaceAll('public-update/after-update.json','public-resumed/after-update.json');if(f==='archive.cjs')t=t.replace("'native-final','public-update'","'native-final','public-update','public-resumed','tab-scroll-diagnosis','tab-scroll-cpu'");fs.writeFileSync(root+'/'+f,t);}
console.log('PASS same owned page/browser/context resume prepared; original failure retained');
