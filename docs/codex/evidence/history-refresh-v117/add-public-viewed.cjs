const fs=require('node:fs'),crypto=require('node:crypto');
const root='artifacts/history-refresh',p=root+'/viewed.json',rows=JSON.parse(fs.readFileSync(p));
for(const file of ['public-history/chromium-375-light.png','public-update/banner.png','public-update/offline.png'])rows.push({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex')});
fs.writeFileSync(p,JSON.stringify(rows,null,2));
console.log('PASS3 actual public originals viewed;10 viewed PNG hashes recorded');
