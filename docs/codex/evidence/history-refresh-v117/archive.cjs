const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root='artifacts/history-refresh',dest='docs/codex/evidence/history-refresh-v117',read=f=>JSON.parse(fs.readFileSync(root+'/'+f)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ci=read('ci.json'),proof=read('public-update/complete.json'),parity=read('parity.json'),candidate=read('candidate.json'),native=read('native-final/results.json');
assert.equal(ci.headSha,candidate.source);assert.equal(ci.conclusion,'success');assert(ci.jobs.every(j=>j.conclusion==='success'));assert.equal(parity.source,ci.headSha);assert.equal(parity.rows.length,25);assert(proof.public&&proof.version===117&&proof.activeUpdateBlocked&&proof.offlineReload);assert.deepEqual(proof.errors,[]);assert.equal(native.length,8);assert(native.every(r=>r.version===117&&r.oldAllExact&&r.newArrowsExact&&r.scoreAgreement&&r.reloadExact&&!r.errors.length));assert(fs.readFileSync(root+'/final-full-output.txt','utf8').includes('302 passed'));
fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(dest+'/.gitattributes','* binary\n');const files=[];
function copy(file,to=file){const b=fs.readFileSync(root+'/'+file),p=dest+'/'+to;fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);assert.equal(sha(fs.readFileSync(p)),sha(b));files.push({file:to,source:root+'/'+file,bytes:b.length,sha256:sha(b)});}
for(const f of fs.readdirSync(root)){if(/\.(cjs|json|txt|py)$/.test(f)&&!['archive-output.txt','verify-archive-output.txt'].includes(f)&&fs.statSync(root+'/'+f).isFile())copy(f);}
for(const phase of ['before','after','release','long-text','public-history']){const rows=read(phase+'/results.json');assert.equal(rows.length,8);assert(rows.every(r=>r.oldAllExact&&r.reloadExact&&r.detail&&r.filter&&r.round&&!r.errors.length&&r.geometry.every(g=>!g.overflow)));if(['release','long-text','public-history'].includes(phase))assert(rows.every(r=>r.version===117));copy(phase+'/results.json');}
copy('native-final/results.json');copy('native-final/last-geometry.json');
copy('release/last-geometry.json','diagnostic/original-native-last-geometry.json');
for(const f of fs.readdirSync(root+'/public-update'))if(/\.(json|txt)$/.test(f)&&f!=='owned-browser.json')copy('public-update/'+f);
for(const f of read('viewed.json')){const b=fs.readFileSync(root+'/'+f.file);assert.equal(sha(b),f.sha256);copy(f.file,'screenshots/'+f.file.replaceAll('/','-'));}
fs.writeFileSync(dest+'/manifest.json',JSON.stringify({source:ci.headSha,version:117,ci:ci.databaseId,imagesViewed:read('viewed.json').length,files},null,2));
console.log('PASS archive final117/CI/public/25 parity/native8/full302; raw failures retained; viewed original PNGs copy SHA exact');
