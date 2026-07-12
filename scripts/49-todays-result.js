"use strict";
/* Archery Note: 「今日の結果」統合パネル（純関数のみ）
   設計書: .company/research/topics/todays-result-integration-design.md
   （Fable裁定 §11・ユーザー確定 §12）準拠。
   ここの関数は db / ui / DOM を参照せず、引数だけに依存する。
   日付は全て「YYYY-MM-DD ローカル日」で扱う（UTC変換禁止）。
   何もキャッシュ・永続化しない導出値（毎回 sessions から再計算）。
   48-gamification.js が確立した設計規律（tr接頭辞のローカルヘルパー・保存値でなく導出値・
   wall-clock非依存＝new Date()を計算の起点にしない）をそのまま踏襲する。 */

/* ============ 内部ヘルパー（tr接頭辞: 45-analysis-core.js / 48-gamification.js との名前衝突回避） ============ */

/* セッションの全矢を平坦化（48-gamification.js の gamAllArrows と同一式のローカルコピー。
   自己完結・Nodeテスト可能性を優先する既存規律を踏襲） */
function trAllArrows(s){ return (s&&s.ends||[]).flat().filter(a=>a&&typeof a==="object"); }

/* "YYYY-MM-DD" 文字列に日数を加算してローカル日で返す（gamFmtDate と同じローカル日規律） */
function trAddDays(dateStr, days){
  const d=new Date(dateStr+"T00:00:00");
  d.setDate(d.getDate()+days);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

/* 「同条件」= 距離(dist)+的サイズ(faceD)+的種別(faceType) が一致。matchArrows=true で本数(n)も要求。
   round は意図的に含めない（項目1・3のユーザー確定文言が「距離+的サイズ(+本数)」であり round を
   挙げていないため。48-gamification.js の pb_breaker バッジは round を使っており定義が異なる点は
   設計書 §8 ユーザー判断メモ3・Fable裁定 §11-3 で現状維持と確定済み） */
function trSameCondition(a, b, opts){
  if(!a || !b) return false;
  if(String(a.dist)!==String(b.dist)) return false;
  if(Number(a.faceD)!==Number(b.faceD)) return false;
  if((a.faceType||"single")!==(b.faceType||"single")) return false;
  if(opts && opts.matchArrows && trAllArrows(a).length!==trAllArrows(b).length) return false;
  return true;
}

/* ============ 3.1 前回・先週差 ============ */
/* computeWeeklyDiff(sessions, currentSessionId, todayStr)
   同条件（距離+的サイズ+本数=同一）セッションのうち「前回」を優先し、なければ「先週同曜日平均」
   （todayStrの7日前・14日前）にフォールバックする（Fable裁定 §11-1で承認済み）。
   両方とも無ければ available:false（=この条件での初回） */
function computeWeeklyDiff(sessions, currentSessionId, todayStr){
  const all=(sessions||[]).filter(s=>s&&typeof s==="object");
  const cur=all.find(s=>s.id===currentSessionId);
  if(!cur) return {available:false, reason:"no-current-session"};
  const curArrows=trAllArrows(cur);
  if(!curArrows.length) return {available:false, reason:"empty-session"};
  const curTotal=curArrows.reduce((a,x)=>a+(x.s||0),0);

  const peers=all.filter(s=>s.id!==cur.id && trSameCondition(s,cur,{matchArrows:true}) && trAllArrows(s).length>0)
    .sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.id>a.id?1:-1));
  const prev=peers[0]||null;

  const d7=trAddDays(todayStr,-7), d14=trAddDays(todayStr,-14);
  const weekPeers=all.filter(s=>s.id!==cur.id && trSameCondition(s,cur,{matchArrows:true})
    && (s.date===d7||s.date===d14) && trAllArrows(s).length>0);
  const weeklyAvg = weekPeers.length ? {
    value: weekPeers.reduce((a,s)=>a+trAllArrows(s).reduce((x,y)=>x+(y.s||0),0),0)/weekPeers.length,
    n: weekPeers.length,
    dates: [...new Set(weekPeers.map(s=>s.date))].sort()
  } : null;

  if(!prev && !weeklyAvg) return {available:false, reason:"no-history", todayTotal:curTotal};

  if(prev){
    const prevTotal=trAllArrows(prev).reduce((a,x)=>a+(x.s||0),0);
    return {available:true, kind:"previous", todayTotal:curTotal, compareValue:prevTotal,
      deltaPoints:curTotal-prevTotal, compareDate:prev.date, compareArrows:trAllArrows(prev).length,
      weeklyAvg /* 参照用。detail 行の併記に使ってよい */};
  }
  return {available:true, kind:"weekly-avg", todayTotal:curTotal, compareValue:weeklyAvg.value,
    deltaPoints:curTotal-weeklyAvg.value, compareDates:weeklyAvg.dates, compareCount:weeklyAvg.n};
}

/* ============ 3.2 安定性の変化 ============ */
/* computeStabilityTrend(sessions, currentSessionId, metricsFn, opts)
   主軸: グルーピング半径RMS（metricsFn(s).st.rr）。表示値（groupSummaryHtml 等）との一致を
   構造的に保証するため sessionMetrics/robustStats を関数注入で使う（buildAnalysisRows と同じ契約）。
   副軸（任意）: opts.formAnalyses が渡され、紐付けレコードがあるときだけ anchorNorm 連携を追加する
   （射形トラッキングは既定OFFのベータ機能で母集団が薄いため v1 は省略可。Fable裁定 §11-4） */
function computeStabilityTrend(sessions, currentSessionId, metricsFn, opts){
  opts=opts||{};
  const STABILITY_TIGHT_DELTA=0.3; /* 45-analysis-core.js todayConclusion() の RR_TIGHT_DELTA と同一値 */
  const MIN_HISTORY=3;
  const all=(sessions||[]).filter(s=>s&&typeof s==="object");
  const cur=all.find(s=>s.id===currentSessionId);
  if(!cur) return {available:false, reason:"no-current-session"};
  const curM=metricsFn(cur);
  if(!curM || !curM.st || !Number.isFinite(curM.st.rr)) return {available:false, reason:"no-coords"};

  const peers=all.filter(s=>s.id!==cur.id && trSameCondition(s,cur,{matchArrows:false}))
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.id>b.id?1:-1))
    .map(s=>({s,m:metricsFn(s)}))
    .filter(x=>x.m && x.m.st && Number.isFinite(x.m.st.rr));

  if(peers.length<MIN_HISTORY) return {available:false, reason:"insufficient-history", sampleCount:peers.length};

  const history=peers.slice(-10);
  const ma=movingAverage(history.map(p=>p.m.st.rr), 5);
  const baseline=ma[ma.length-1];
  const latest=curM.st.rr;
  const delta=baseline-latest;          /* 正 = RMSが縮んだ = 安定した */
  const direction = delta>=STABILITY_TIGHT_DELTA ? "tight" : delta<=-STABILITY_TIGHT_DELTA ? "loose" : "flat";

  const result={available:true, primaryMetric:"rms", direction, deltaCm:delta,
    latestValue:latest, baselineValue:baseline, sampleCount:history.length,
    sparkline:history.map(p=>+p.m.st.rr.toFixed(2)).concat([+latest.toFixed(2)])};

  /* secondary（任意・射形トラッキング連携。formAnalyses が渡され紐付けレコードがあるときだけ算出） */
  if(opts.formAnalyses && opts.formAnalyses.length){
    result.secondary = trAnchorSecondary(cur, opts.formAnalyses);
  }
  return result;
}

/* アンカー位置のセッション内標準偏差（46-form-core.js formAnchorVariation と同じ式のローカル複製。
   自己完結のため 46-form-core.js への依存を作らない） */
function trAnchorStd(record){
  const vals=(record&&Array.isArray(record.features)?record.features:[])
    .map(f=>f&&f.anchorNorm).filter(Number.isFinite);
  if(vals.length<2) return null;
  const mean=vals.reduce((a,x)=>a+x,0)/vals.length;
  return Math.sqrt(vals.reduce((a,x)=>a+(x-mean)**2,0)/vals.length);
}
function trAnchorSecondary(cur, formAnalyses){
  const ANCHOR_SECONDARY_DELTA=0.01; /* std は 0〜0.3 程度のオーダー。第2回実射データ後に再校正前提 */
  const linked=formAnalyses.find(f=>f&&f.sessionId===cur.id);
  if(!linked) return null;
  const latest=trAnchorStd(linked);
  if(latest==null) return null;
  const priorStds=formAnalyses.filter(f=>f&&f.sessionId && f.sessionId!==cur.id && f.date && f.date<=cur.date)
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"")).slice(-10)
    .map(trAnchorStd).filter(Number.isFinite);
  if(priorStds.length<3) return null;
  const ma=movingAverage(priorStds,5);
  const baseline=ma[ma.length-1];
  const direction=(baseline-latest)>=ANCHOR_SECONDARY_DELTA?"tight":(baseline-latest)<=-ANCHOR_SECONDARY_DELTA?"loose":"flat";
  return {metric:"anchorNorm-std", latestValue:latest, baselineValue:baseline, direction};
}

/* ============ 3.3 自己ベストとの距離 ============ */
/* computePersonalBestDistance(sessions, currentSessionId)
   同条件フィルタ = 距離+的サイズ（round・本数は問わない。personalBests() とはキー粒度が異なるため
   意図的に再利用しない。設計書 §3.3・Fable裁定 §11-3）。
   本数一致ピアがあれば厳密比較（method:"exact-count"）、無ければ平均点/本を今回の本数に換算
   （method:"avg-projected"）。paceRatio>=1 は remaining<=0 と代数的に同値なので pace は未到達時のみ意味を持つ */
function computePersonalBestDistance(sessions, currentSessionId){
  const PACE_CLOSE=0.9; /* 暫定値。第2回実射検証データ後に再校正前提（Fable裁定 §11-2） */
  const all=(sessions||[]).filter(s=>s&&typeof s==="object");
  const cur=all.find(s=>s.id===currentSessionId);
  if(!cur) return {available:false, reason:"no-current-session"};
  const curArrows=trAllArrows(cur);
  if(!curArrows.length) return {available:false, reason:"empty-session"};
  const curTotal=curArrows.reduce((a,x)=>a+(x.s||0),0);
  const curN=curArrows.length;

  const peers=all.filter(s=>s.id!==cur.id && trSameCondition(s,cur,{matchArrows:false}) && trAllArrows(s).length>0);
  if(!peers.length) return {available:false, reason:"no-history", todayTotal:curTotal, todayArrows:curN};

  const exactPeers=peers.filter(s=>trAllArrows(s).length===curN);
  let bestTotal, bestDate, method;
  if(exactPeers.length){
    const best=exactPeers.reduce((mx,s)=>{
      const t=trAllArrows(s).reduce((a,x)=>a+(x.s||0),0);
      return (!mx||t>mx.t)?{t,date:s.date}:mx;
    },null);
    bestTotal=best.t; bestDate=best.date; method="exact-count";
  } else {
    const bestAvgPeer=peers.reduce((mx,s)=>{
      const arrs=trAllArrows(s); const avg=arrs.reduce((a,x)=>a+(x.s||0),0)/arrs.length;
      return (!mx||avg>mx.avg)?{avg,date:s.date}:mx;
    },null);
    bestTotal=Math.round(bestAvgPeer.avg*curN); bestDate=bestAvgPeer.date; method="avg-projected";
  }

  const remaining=bestTotal-curTotal;
  const requiredAvg=bestTotal/curN;
  const todayAvg=curTotal/curN;
  const paceRatio=requiredAvg>0?todayAvg/requiredAvg:1;
  const pace = paceRatio>=1 ? "reached" : paceRatio>=PACE_CLOSE ? "close" : "tracking";

  return {available:true, method, bestTotal, bestDate, todayTotal:curTotal, todayArrows:curN,
    remaining, achieved:remaining<=0, pace, paceRatio, requiredAvg, todayAvg};
}

/* ============ 3.4 伸びの継続日数 ============ */
/* computeGrowthStreaks(sessions, todayStr, metricsFn)
   得点（1本あたり平均点、大きいほど良い）と安定性（RMS、小さいほど良い）の2指標。
   同日複数セッションは合算（得点は加重平均、RMSは矢数加重平均）。各日、直前最大5日の単純平均を
   ベースラインとし diff>=epsilon なら「伸びた日」。連続日数は直近の練習日から遡って数える。
   epsilon は暫定値（得点0.15点/本・安定性0.15cm。第2回実射検証データ後に再校正前提。Fable裁定 §11-2） */
function computeGrowthStreaks(sessions, todayStr, metricsFn){
  const GROWTH_EPSILON_SCORE=0.15;
  const GROWTH_EPSILON_STABILITY=0.15;
  const BASELINE_WINDOW=5, MIN_BASELINE=3;

  const all=(sessions||[]).filter(s=>s&&typeof s==="object" && s.date && s.date<=todayStr && trAllArrows(s).length>0);
  if(!all.length) return {available:false, reason:"no-data"};

  const byDate=new Map();
  all.forEach(s=>{
    const arrs=trAllArrows(s);
    const g=byDate.get(s.date)||{date:s.date,arrows:0,total:0,rmsSum:0,rmsW:0};
    g.arrows+=arrs.length; g.total+=arrs.reduce((a,x)=>a+(x.s||0),0);
    const m=metricsFn(s);
    if(m && m.st && Number.isFinite(m.st.rr)){ g.rmsSum+=m.st.rr*arrs.length; g.rmsW+=arrs.length; }
    byDate.set(s.date,g);
  });
  const days=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(g=>({
    date:g.date, avg:g.arrows?g.total/g.arrows:null, rms:g.rmsW?g.rmsSum/g.rmsW:null
  }));

  const METRICS=[
    {key:"score", better:"higher", epsilon:GROWTH_EPSILON_SCORE, valueOf:d=>d.avg},
    {key:"stability", better:"lower", epsilon:GROWTH_EPSILON_STABILITY, valueOf:d=>d.rms}
  ];

  const metrics=METRICS.map(spec=>{
    const validDays=days.filter(d=>Number.isFinite(spec.valueOf(d)));
    if(validDays.length<MIN_BASELINE+1) return {key:spec.key, available:false, streakDays:0};
    const improved=validDays.map((d,i)=>{
      if(i<MIN_BASELINE) return null;
      const win=validDays.slice(Math.max(0,i-BASELINE_WINDOW),i).map(spec.valueOf);
      const baseline=win.reduce((a,x)=>a+x,0)/win.length;
      const v=spec.valueOf(d);
      const diff=spec.better==="higher"?v-baseline:baseline-v;
      return diff>=spec.epsilon;
    });
    let streak=0;
    for(let i=improved.length-1;i>=0;i--){ if(improved[i]===true) streak++; else break; }
    return {key:spec.key, available:true, streakDays:streak};
  });

  return {available:true, metrics};
}

/* ============ 3.5 オーケストレータ ============ */
/* computeTodaysResult(sessions, currentSessionId, metricsFn, opts)
   opts = { formAnalyses } (任意)。todayStr はセッション自身の date から導出する
   （new Date()/today() を関数内で呼ばない。過去日付編集でも矛盾なく動作する） */
function computeTodaysResult(sessions, currentSessionId, metricsFn, opts){
  opts=opts||{};
  const all=(sessions||[]).filter(s=>s&&typeof s==="object");
  const cur=all.find(s=>s.id===currentSessionId);
  if(!cur || !cur.date){
    return {available:false, reason:"no-current-session",
      weeklyDiff:{available:false}, stabilityTrend:{available:false},
      personalBestDistance:{available:false}, growthStreaks:{available:false}};
  }
  const todayStr=cur.date;
  return {
    available:true, todayStr,
    weeklyDiff: computeWeeklyDiff(all, currentSessionId, todayStr),
    stabilityTrend: computeStabilityTrend(all, currentSessionId, metricsFn, opts),
    personalBestDistance: computePersonalBestDistance(all, currentSessionId),
    growthStreaks: computeGrowthStreaks(all, todayStr, metricsFn)
  };
}
