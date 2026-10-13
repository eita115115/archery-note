const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto'),root='artifacts/sight-summary-recency',base=JSON.parse(fs.readFileSync(root+'/base.json')).base,read=f=>fs.readFileSync(f,'utf8').replaceAll('\r\n','\n'),old=f=>cp.execFileSync('git',['show',base+':'+f],{encoding:'utf8',maxBuffer:20e6}).replaceAll('\r\n','\n');
const injection=`    const prior = current.latest && current.latest.row;
    const stamp = Number(row.ts),
      priorStamp = Number(prior && prior.ts);
    const datedMarks =
      prior &&
      row.source === "台帳" &&
      prior.source === "台帳" &&
      date.sort &&
      String(row.date || "").trim() === date.sort &&
      String(prior.date || "").trim() === date.sort &&
      Number.isFinite(stamp) &&
      stamp > 0 &&
      Number.isFinite(priorStamp) &&
      priorStamp > 0;
`;const newIf=`(date.sort === current.latest.date.sort &&
        row.source === "台帳" &&
        (!datedMarks || stamp >= priorStamp))`,oldIf='(date.sort === current.latest.date.sort && row.source === "台帳")';let count=0;for(const f of cp.execFileSync('git',['ls-tree','-r','--name-only',base,'scripts'],{encoding:'utf8'}).trim().split('\n')){let b=read(f).replace('const APP_VER=123;','const APP_VER=122;');if(f.endsWith('50-record-view.js')){assert(b.includes(injection)&&b.includes(newIf));b=b.replace(injection,'').replace(newIf,oldIf);}assert.equal(b,old(f),f);count++;}for(const f of ['index.html','style.css','style.min.css','sw.js','package.json','package-lock.json'])assert.equal(read(f).replaceAll('0.123.0','0.122.0').replace('archery-note-v123','archery-note-v122'),old(f),f);assert.deepEqual({...JSON.parse(read('version.json')),v:122},JSON.parse(old('version.json')));assert.deepEqual(JSON.parse(read('tasks.json')).slice(0,89),JSON.parse(read(root+'/old-tasks.json')));assert.equal(read('evals/acceptance.md'),old('evals/acceptance.md'));assert.equal(crypto.createHash('sha256').update(fs.readFileSync('C:/Users/eita2/Projects/archery-note/node_modules/.package-lock.json')).digest('hex').toUpperCase(),'16F9BA6219DA31278CED98C0C742013B4A5AAEA63059E4702E86756702A23309');
const before=JSON.parse(read(root+'/before-complete/results.json')),after=JSON.parse(read(root+'/'+(process.argv[2]||'after')+'/results.json'));assert.equal(before.length,24);assert.equal(after.length,24);for(let i=0;i<24;i++){for(const k of ['engine','width','theme','id','latest','predictionText','other'])assert.deepEqual(after[i][k],before[i][k],i+':'+k);assert(after[i].old6Exact&&after[i].reloadExact&&!after[i].errors.length&&after[i].hit.hit);if(after[i].id==='unique-ts-reverse'){assert.deepEqual(before[i].analysisText,['80 / 左右0.4']);assert.deepEqual(after[i].analysisText,['90 / 左右0.4']);}else assert.deepEqual(after[i].analysisText,before[i].analysisText);}
console.log('PASS '+count+' scripts exact except summary selection17lines/version; CSS/math/scoring/storage/handlers/deps/SWactivation exact;24 other analysisHTML/latest/interpolation/regression/calibration exact; only clear-ts latest80→90; old89/acceptance/sharedlock exact');
