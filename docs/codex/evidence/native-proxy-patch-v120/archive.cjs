const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root='artifacts/native-proxy-patch',dest='docs/codex/evidence/native-proxy-patch-v120',read=f=>JSON.parse(fs.readFileSync(root+'/'+f)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ci=read('ci.json'),candidate=read('candidate.json'),parity=read('public-parity.json');
assert.equal(ci.headSha,candidate.source);assert.equal(ci.conclusion,'success');assert(ci.jobs.every(j=>j.conclusion==='success'));assert.equal(parity.rows.length,25);
for(const f of ['full-output.txt','ci-full-log.txt'])assert(fs.readFileSync(root+'/'+f,'utf8').includes('317 passed'));
assert(read('alert-state.json').every(r=>r.state==='fixed'&&r.fixed_at&&!r.dismissed_at));assert.equal(read('review.json').source,candidate.source);assert.equal(read('dependency-evidence.json').nativeRuntimeExploitTest,false);
fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(dest+'/.gitattributes','* binary\n');const files=[];
function copy(rel){const b=fs.readFileSync(root+'/'+rel),p=dest+'/'+rel;fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);assert.equal(sha(fs.readFileSync(p)),sha(b));files.push({file:rel,source:root+'/'+rel,bytes:b.length,sha256:sha(b)});}
for(const e of fs.readdirSync(root,{withFileTypes:true})){if(e.isFile()&&/\.(cjs|json|txt|py)$/.test(e.name)&&!/^(archive|verify-archive).*output\.txt$/.test(e.name))copy(e.name);}
function walk(rel){for(const e of fs.readdirSync(root+'/'+rel,{withFileTypes:true})){const f=rel+'/'+e.name;if(e.isDirectory())walk(f);else copy(f);}}walk('upstream-source');
fs.writeFileSync(dest+'/manifest.json',JSON.stringify({source:ci.headSha,version:120,ci:ci.databaseId,nativeBinaryRebuildOrRuntimeExploitVerified:false,files},null,2));console.log('PASS '+files.length+' raw evidence/source/CI/317/public25/alerts2 archive copies SHA exact; native binary remediation unverified');
