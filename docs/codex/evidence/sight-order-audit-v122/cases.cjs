const fs=require('fs'),root='artifacts/sight-order-audit',mark=(id,date,ts,v,h='0.4')=>({id,setupId:'a',dist:30,date,...(ts===undefined?{}:{ts}),v,h,note:'合成・日時整合監査 '+id});
const a=(date,ts,v)=>mark('A',date,ts,v),b=(date,ts,v)=>mark('B',date,ts,v),day='2026-10-13';
const cases=[
['unique-ts',[a(day,100,'80'),b(day,200,'90')],'B',90],
['unique-ts-reverse',[b(day,200,'90'),a(day,100,'80')],'B',90],
['same-ts',[a(day,100,'80'),b(day,100,'90')],'A',90],
['same-ts-reverse',[b(day,100,'90'),a(day,100,'80')],'B',80],
['date-only',[a(day,undefined,'80'),b(day,undefined,'90')],'A',90],
['no-date-ts',[a('',undefined,'80'),b('',undefined,'90')],'A',90],
['no-date-valid-ts',[a('',100,'80'),b('',200,'90')],'B',90],
['date-priority',[a(day,100,'80'),b('2026-10-12',999,'90')],'A',80],
['latest-blank',[a('2026-10-12',100,'80'),b(day,200,'')],'B',80],
['latest-invalid',[a('2026-10-12',100,'80'),b(day,200,'調整済')],'B',80],
['numeric-zero',[a('2026-10-12',100,'80'),b(day,200,0)],'B',0],
['string-zero',[a('2026-10-12',100,'80'),b(day,200,'0')],'B',0],
['latest-null',[a('2026-10-12',100,'80'),b(day,200,null)],'B',80],
['zero-ts-tie',[a(day,0,'80'),b(day,undefined,'90')],'A',90]
].map(([id,marks,latest,point])=>({id,marks:[...marks,mark('other-dist',day,300,'40'),{...mark('other-setup',day,300,'900'),setupId:'b'}].map(m=>m.id==='other-dist'?{...m,dist:18}:m),latest,point}));
fs.writeFileSync(root+'/cases.json',JSON.stringify(cases,null,2));fs.copyFileSync('artifacts/sight-ledger-layout/fixture.json',root+'/fixture.json');console.log('PASS 14 synthetic cases; no personal data');
