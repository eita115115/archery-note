const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root='docs/codex/evidence/analysis-refresh-v118',manifest=JSON.parse(fs.readFileSync(root+'/manifest.json')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const row of manifest.files){const local=fs.readFileSync(root+'/'+row.file),staged=cp.execFileSync('git',['show',':'+root+'/'+row.file],{maxBuffer:30000000});assert.equal(local.length,row.bytes,row.file);assert.equal(sha(local),row.sha256,row.file);assert.equal(sha(staged),row.sha256,'staged '+row.file);}
for(const f of ['manifest.json','.gitattributes'])assert.deepEqual(cp.execFileSync('git',['show',':'+root+'/'+f],{maxBuffer:30000000}),fs.readFileSync(root+'/'+f));
cp.execFileSync('git',['diff','--cached','--check'],{stdio:'inherit'});
console.log('PASS '+manifest.files.length+' archived original/local/staged SHA exact; '+manifest.imagesViewed+' viewed original screenshots; raw CRLF retained; diff-check clean');
