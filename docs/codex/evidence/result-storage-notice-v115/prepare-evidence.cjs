const fs=require('node:fs'),root='artifacts/result-storage-notice';
fs.writeFileSync(root+'/extract.py',fs.readFileSync('artifacts/ui-refresh/extract.py','utf8').replaceAll('artifacts/ui-refresh',root));
let parity=fs.readFileSync('artifacts/ui-refresh/parity.cjs','utf8').replaceAll('artifacts/ui-refresh',root).replaceAll('public-resumed','public-update').replaceAll('artifacts/release-v105/candidate.json',root+'/candidate.json').replaceAll('version:114','version:115').replaceAll('Linux/public114','Linux/public115');
parity=parity.replace('assert(proof.public);','assert(proof.public&&proof.version===115);const candidateMeta=JSON.parse(fs.readFileSync("'+root+'/candidate.json"));assert.equal(candidateMeta.source,process.env.SOURCE_HEAD);assert.equal(candidateMeta.version,115);');
fs.writeFileSync(root+'/parity.cjs',parity);
console.log('PASS prepared scoped Linux extraction and candidate/public parity helpers');
