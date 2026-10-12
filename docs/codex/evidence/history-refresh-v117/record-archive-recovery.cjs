const fs=require('node:fs'),assert=require('node:assert/strict');
const root='artifacts/history-refresh',rows=JSON.parse(fs.readFileSync(root+'/native-final/results.json'));assert.equal(rows.length,8);assert(rows.every(r=>r.version===117&&r.oldAllExact&&r.newArrowsExact&&r.scoreAgreement&&r.reloadExact&&!r.errors.length));
const note='証拠保存の訂正: 初native8/104は成功出力と最後のgeometryを保存したが、release/results.jsonを後の履歴captureが同名保存先で上書きしたため初native全rawJSONは取得不可。archiveのschemaassertで検出し、後続addはpath不存在、verifyはmanifest不存在で失敗。アプリ/実記録には影響なし。別native-final保存先で最終117の8context/104操作を新規に再検証し全成功、これを最終raw証拠とする。元の成功JSONの復元とは扱わず、失敗説明と元出力/残存geometryも保持。';
const tasks=JSON.parse(fs.readFileSync('tasks.json'));assert.equal(tasks.at(-1).id,'AN-082');tasks.at(-1).evidence+=' '+note;fs.writeFileSync('tasks.json',JSON.stringify(tasks,null,2)+'\n');
for(const file of ['docs/codex/history-refresh.md','docs/codex/codex-progress.md'])fs.appendFileSync(file,'\n'+note+'\n');
let p=fs.readFileSync('progress.md','utf8');p=p.replace(/(- AN082完了[^\n]+)\n/,'$1\n\n- '+note+'\n');fs.writeFileSync('progress.md',p);
console.log('PASS separate final native8/104 verified; overwrite limitation and downstream archive failures retained');
