const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root='artifacts/history-refresh',files=Object.keys(JSON.parse(fs.readFileSync('artifacts/readable-record-actions/candidate.json')).hashes),hashes={};
assert(!fs.existsSync(root+'/candidate-dist'));
for(const f of files){const b=fs.readFileSync(path.join('artifacts/compact-js/sandbox/dist/native',f)),dest=path.join(root+'/candidate-dist',f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b);hashes[f]=crypto.createHash('sha256').update(b).digest('hex');}
fs.writeFileSync(root+'/candidate.json',JSON.stringify({source:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),version:117,hashes},null,2));
let s=fs.readFileSync('artifacts/readable-record-actions/public-update.cjs','utf8');
s=s.replaceAll('eita115115','__OWNER__').replaceAll('115','__OLDVER__').replaceAll('116','117').replaceAll('__OLDVER__','116').replaceAll('__OWNER__','eita115115');
s=s.replace("const oldDir = path.resolve('artifacts/result-storage-notice/linux-dist')",'__OLD_DIR__').replaceAll('artifacts/readable-record-actions/','artifacts/history-refresh/').replace('__OLD_DIR__',"const oldDir = path.resolve('artifacts/readable-record-actions/linux-dist')");
assert(s.includes("const oldDir = path.resolve('artifacts/readable-record-actions/linux-dist')"));assert(s.includes('https://eita115115.github.io/archery-note/'));
fs.writeFileSync(root+'/public-update.cjs',s);
fs.writeFileSync(root+'/extract.py',fs.readFileSync('artifacts/readable-record-actions/extract.py','utf8').replaceAll('artifacts/readable-record-actions',root));
s=fs.readFileSync('artifacts/readable-record-actions/parity.cjs','utf8').replaceAll('116','117').replaceAll('artifacts/readable-record-actions',root);fs.writeFileSync(root+'/parity.cjs',s);
console.log('PASS frozen117 candidate25; real116 update/extraction/parity helpers prepared');
