const fs=require('node:fs'),assert=require('node:assert/strict');
let s=fs.readFileSync('artifacts/ui-refresh/held-public.cjs','utf8');
s=s.replace("const out = path.resolve(process.env.PROOF_DIR || 'artifacts/ui-refresh/'+(process.env.REHEARSAL?'local-update':'public-update'));", "const out = path.resolve('artifacts/ui-refresh/public-resumed');");
s=s.replace("console.log(s); };", "fs.appendFileSync('artifacts/ui-refresh/public-resumed-output.txt',s+'\\n'); console.log(s); };");
const start=s.indexOf(' if(process.env.REHEARSAL)'),end=s.indexOf(' const warm=await page.evaluate',start);assert(start>0&&end>start);
const bootstrap=` const owner=globalThis.ownedUIRefreshFixture;assert(owner,'original context exists');browser=owner.browser;context=owner.context;page=owner.page;before=practice(await dbState());assert.deepEqual(before,JSON.parse(fs.readFileSync('artifacts/ui-refresh/public-update/baseline.json')).before);assert.equal(await page.evaluate(()=>APP_VER),113);assert.deepEqual(owner.errors,[]);globalThis.ownedUIRefreshResume={page,context,browser,errors,getStage:()=>stage,getBefore:()=>before};page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{const f=new URL(r.url()).pathname.split('/archery-note/')[1];if(stage==='update'&&warmFiles.includes(f))jobs.push(r.body().then(b=>loaded.push({file:f,sha256:sha(b),status:r.status(),url:r.url()})));});
 write('identity',{samePage:page===owner.page,sameContext:context===owner.context,sameBrowser:browser===owner.browser,url:page.url(),originalFailure:'public-update/failure.json',originalActiveID:before.active.id,originalSessionIDs:before.sessions.map(s=>s.id),newContextCreated:false,newSeed:false,newArrow:false});
`;
s=s.slice(0,start)+bootstrap+s.slice(end);s=s.replace('await context.close();await browser.close();await ownedServer.close();','await context.close();await browser.close();');
assert(!s.includes('newContext(')&&!s.includes('page.goto(')&&!s.includes('quickStart')&&!s.includes('launchServer('));fs.writeFileSync('artifacts/ui-refresh/resume-public.cjs',s);
for(const f of ['archive.cjs','finish.cjs','parity.cjs']){let t=fs.readFileSync('artifacts/ui-refresh/'+f,'utf8').replaceAll('91ce18e0f331f9dcf3a301c9eb0046938763750c','95b9bcc734b07c749523434986f05e0f318f9d13').replaceAll('public-update/','public-resumed/');fs.writeFileSync('artifacts/ui-refresh/'+f,t);}
