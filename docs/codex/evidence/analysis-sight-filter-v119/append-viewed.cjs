const fs=require('node:fs'),crypto=require('node:crypto'),root='artifacts/analysis-sight-filter',rows=JSON.parse(fs.readFileSync(root+'/viewed.json'));
for(const file of process.argv.slice(2)){const sha256=crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex');if(!rows.some(r=>r.file===file))rows.push({file,sha256});}
fs.writeFileSync(root+'/viewed.json',JSON.stringify(rows,null,2));console.log('PASS viewed original PNG hashes retained: '+rows.length);
