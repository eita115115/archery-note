const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='artifacts/history-refresh';
for(const phase of ['before','after','release','long-text']){const rows=JSON.parse(fs.readFileSync(root+'/'+phase+'/results.json'));assert.equal(rows.length,8);for(const r of rows){assert(r.oldAllExact&&r.reloadExact&&r.detail&&r.filter&&r.round);assert.deepEqual(r.errors,[]);assert(r.geometry.every(g=>!g.overflow),phase+' '+r.id);}}
const meta=JSON.parse(fs.readFileSync(root+'/candidate.json'));for(const [f,sha] of Object.entries(meta.hashes)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join('artifacts/compact-js/sandbox/dist/native',f))).digest('hex');assert.equal(actual,sha,f);}
const reviewed=['before/chromium-375-light.png','after/chromium-375-light.png','after/webkit-320-light-expanded.png','after/webkit-375-dark.png','after/chromium-900-light.png','release/chromium-375-light.png','long-text/chromium-320-light.png'];
fs.writeFileSync(root+'/viewed.json',JSON.stringify(reviewed.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex')})),null,2));
console.log('PASS32 history contexts/old7/filter/detail/round/reload/errors0/no row overflow; final source assets equal frozen25; viewed originals SHA recorded');
