"use strict";
/* Archery Note: 分析コア（純関数のみ）
   ここの関数は db / ui / DOM を参照せず、引数だけに依存する。
   単位: 座標・半径・ズレは cm、得点は点、距離は m。 */

/* セッション配列を分析用の正規化行へ変換する。metricsFn には sessionMetrics を渡す
   （テストでは robustStats ベースの代替を注入できる） */
function buildAnalysisRows(sessions, setups, metricsFn){
  const byId={};
  (setups||[]).forEach(s=>{ if(s&&s.id) byId[s.id]=s; });
  return (sessions||[]).map(s=>{
    if(!s || !Array.isArray(s.ends)) return null;
    const m=metricsFn(s);
    const setup=s.setupId?byId[s.setupId]||null:null;
    const distNum=Number(s.dist);
    return {
      s,
      id:s.id||"",
      date:s.date||"",
      setupId:s.setupId||"",
      setupName:setup?setup.name||"":"",
      dist:Number.isFinite(distNum)&&distNum>0?distNum:null,
      faceD:s.faceD,
      faceType:s.faceType||"single",
      round:s.round||"free",
      n:m.all.length,
      total:m.total,
      avg:m.avg,
      st:m.st
    };
  }).filter(Boolean);
}

/* フィルタ: setupId（"__none"=用具未指定のみ）/ dist / round / period("all"|"3m"|"1m")
   period 判定には filter.today（"YYYY-MM-DD"）が必要 */
function filterAnalysisRows(rows, filter){
  const f=filter||{};
  let minDate="";
  if(f.today && (f.period==="3m"||f.period==="1m")){
    const d=new Date(f.today+"T00:00:00");
    if(Number.isFinite(d.getTime())){
      d.setMonth(d.getMonth()-(f.period==="3m"?3:1));
      minDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }
  }
  return (rows||[]).filter(r=>
    (!f.setupId || (f.setupId==="__none"?!r.setupId:r.setupId===f.setupId)) &&
    (!f.dist || String(r.dist)===String(f.dist)) &&
    (!f.round || r.round===f.round) &&
    (!minDate || (r.date && r.date>=minDate))
  );
}

/* ISO週キー "YYYY-Www"。不正な日付は "" */
function isoWeekKey(dateIso){
  const d=new Date(String(dateIso||"")+"T00:00:00Z");
  if(!Number.isFinite(d.getTime())) return "";
  const day=(d.getUTCDay()+6)%7;
  d.setUTCDate(d.getUTCDate()-day+3);
  const year=d.getUTCFullYear();
  const jan4=new Date(Date.UTC(year,0,4));
  const week=1+Math.round(((d-jan4)/86400000-3+((jan4.getUTCDay()+6)%7))/7);
  return `${year}-W${String(week).padStart(2,"0")}`;
}

/* 週("week")または月("month")バケットで回数・本数・平均点・平均RMS・最高合計を集計 */
function aggregateByPeriod(rows, unit){
  const by=new Map();
  (rows||[]).forEach(r=>{
    if(!r || !r.date) return;
    const key=unit==="week"?isoWeekKey(r.date):r.date.slice(0,7);
    if(!key) return;
    const g=by.get(key)||{key,sessions:0,arrows:0,total:0,best:null,rrSum:0,rrCount:0};
    g.sessions++;
    g.arrows+=r.n||0;
    g.total+=r.total||0;
    if(r.n && (!g.best || r.total>g.best.total)) g.best={total:r.total,date:r.date,arrows:r.n};
    if(r.st && Number.isFinite(r.st.rr)){ g.rrSum+=r.st.rr; g.rrCount++; }
    by.set(key,g);
  });
  return [...by.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(g=>({
    key:g.key,
    sessions:g.sessions,
    arrows:g.arrows,
    avg:g.arrows?g.total/g.arrows:null,
    avgRms:g.rrCount?g.rrSum/g.rrCount:null,
    best:g.best
  }));
}

/* 単純移動平均。先頭 k 未満はそこまでの平均。非数値は 0 扱いにせず null を返す */
function movingAverage(values, k){
  const win=Math.max(1,k||5);
  const vals=(values||[]).map(Number);
  const out=[];
  let sum=0, bad=0;
  for(let i=0;i<vals.length;i++){
    if(Number.isFinite(vals[i])) sum+=vals[i]; else bad++;
    if(i>=win){
      if(Number.isFinite(vals[i-win])) sum-=vals[i-win]; else bad--;
    }
    const len=Math.min(i+1,win);
    out.push(bad>0?null:sum/len);
  }
  return out;
}

/* (round×距離) ごとの自己ベスト（最高合計・最高平均とその日付） */
function personalBests(rows){
  const by=new Map();
  (rows||[]).forEach(r=>{
    if(!r || !r.n) return;
    const key=[r.round,r.dist==null?"":r.dist].join("|");
    const g=by.get(key)||{round:r.round,dist:r.dist,sessions:0,bestTotal:null,bestAvg:null};
    g.sessions++;
    if(!g.bestTotal || r.total>g.bestTotal.total || (r.total===g.bestTotal.total && r.date>g.bestTotal.date)){
      g.bestTotal={total:r.total,arrows:r.n,date:r.date};
    }
    if(!g.bestAvg || r.avg>g.bestAvg.avg){
      g.bestAvg={avg:r.avg,arrows:r.n,date:r.date};
    }
    by.set(key,g);
  });
  return [...by.values()].sort((a,b)=>((b.dist==null?-1:b.dist)-(a.dist==null?-1:a.dist)) || b.sessions-a.sessions);
}

/* 風あり/なしの成績比較。isWindyFn にはアプリの isWindy を注入する */
function conditionSplit(rows, isWindyFn){
  const make=label=>({label,sessions:0,arrows:0,total:0,rrSum:0,rrCount:0,mxSum:0,mxCount:0});
  const windy=make("風あり"), calm=make("風なし・弱風");
  (rows||[]).forEach(r=>{
    if(!r) return;
    const g=isWindyFn(r.s)?windy:calm;
    g.sessions++;
    g.arrows+=r.n||0;
    g.total+=r.total||0;
    if(r.st && Number.isFinite(r.st.rr)){ g.rrSum+=r.st.rr; g.rrCount++; }
    if(r.st && Number.isFinite(r.st.mx)){ g.mxSum+=r.st.mx; g.mxCount++; }
  });
  const fin=g=>({
    label:g.label,
    sessions:g.sessions,
    arrows:g.arrows,
    avg:g.arrows?g.total/g.arrows:null,
    avgRms:g.rrCount?g.rrSum/g.rrCount:null,
    biasX:g.mxCount?g.mxSum/g.mxCount:null
  });
  return {windy:fin(windy), calm:fin(calm)};
}

/* arrow.reason タグ別の本数・平均点・平均ズレ方向(cm) */
function reasonBreakdown(rows){
  const by=new Map();
  let tagged=0;
  (rows||[]).forEach(r=>{
    if(!r || !r.s || !Array.isArray(r.s.ends)) return;
    r.s.ends.forEach(end=>(Array.isArray(end)?end:[]).forEach(a=>{
      if(!a || !a.reason) return;
      tagged++;
      const g=by.get(a.reason)||{reason:a.reason,count:0,total:0,xSum:0,ySum:0};
      g.count++;
      g.total+=Number.isFinite(Number(a.s))?Number(a.s):0;
      if(Number.isFinite(a.x)) g.xSum+=a.x;
      if(Number.isFinite(a.y)) g.ySum+=a.y;
      by.set(a.reason,g);
    }));
  });
  return {
    tagged,
    items:[...by.values()].sort((a,b)=>b.count-a.count).map(g=>({
      reason:g.reason,
      count:g.count,
      avg:g.count?g.total/g.count:null,
      mx:g.count?g.xSum/g.count:null,
      my:g.count?g.ySum/g.count:null
    }))
  };
}
