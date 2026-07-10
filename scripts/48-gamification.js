"use strict";
/* Archery Note: ゲーミフィケーション（純関数のみ）
   最終設計書: .company/research/topics/gamification-final-design.md（Fableレビュー済み）準拠。
   ここの関数は db / ui / DOM を参照せず、引数だけに依存する。
   日付は全て「YYYY-MM-DD ローカル日」で扱う（UTC変換禁止）。
   ストリーク・目標進捗は永続化しない導出値（毎回全履歴から再計算）。
   Phase 3 の先行準備: UI・スキーマ（normalizeDb / openSummary 等）への統合は未実施。 */

/* ============ 内部ヘルパー（gam接頭辞: 45-analysis-core.js 等との名前衝突回避） ============ */

/* Date → "YYYY-MM-DD"（ローカル日基準。toISOString は使わない） */
function gamFmtDate(d){
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

/* セッションの全矢を平坦化 */
function gamAllArrows(s){
  return (s&&s.ends||[]).flat().filter(a=>a&&typeof a==="object");
}

/* 複数セッションの累計矢数 */
function gamTotalShots(ss){
  return (ss||[]).reduce((n,s)=>n+gamAllArrows(s).length,0);
}

/* 満点値（standard/triple:10, field:6） */
function gamPerfect(s){ return s&&s.faceType==="field"?6:10; }

/* リング幅(cm)。20-scoring.js の ringW と同一式のローカルコピー（自己完結・Nodeテスト可能性を優先） */
function gamRingW(s){ return s&&s.faceType==="field" ? (+s.faceD||40)/12 : (+s.faceD||122)/20; }

/* グルーピングRMS半径(cm)。座標が有限な矢のみで計算（robustStats とは独立の単純RMS） */
function gamGroupRms(arrows){
  const p=(arrows||[]).filter(a=>Number.isFinite(a.x)&&Number.isFinite(a.y));
  if(p.length<2) return null;
  const cx=p.reduce((s,a)=>s+a.x,0)/p.length;
  const cy=p.reduce((s,a)=>s+a.y,0)/p.length;
  return Math.sqrt(p.reduce((s,a)=>s+(a.x-cx)**2+(a.y-cy)**2,0)/p.length);
}

/* ISO週キー（45-analysis-core.js isoWeekKey のローカルコピー） */
function gamIsoWeek(iso){
  const d=new Date(String(iso||"")+"T00:00:00Z");
  if(!Number.isFinite(d.getTime())) return "";
  const day=(d.getUTCDay()+6)%7;
  d.setUTCDate(d.getUTCDate()-day+3);
  const y=d.getUTCFullYear(),j=new Date(Date.UTC(y,0,4));
  const w=1+Math.round(((d-j)/864e5-3+((j.getUTCDay()+6)%7))/7);
  return y+"-W"+String(w).padStart(2,"0");
}

/* ============ ストリーク（導出値・永続化しない） ============ */

/* computeStreak(sessions, practiceDays, todayStr)
   → { configured, current, best, freezeTokens(0..3), freezeUsedDates(直近30), lastPracticeDate }
   仕様（最終設計書 観点2/3/6）:
   - practiceDays 未設定（null/空配列）は configured:false で判定停止
   - 練習した日は曜日を問わず +1（非練習曜日の自主練も加算）
   - 欠席判定は practiceDays の曜日のみ。当日はまだ判定しない（iso !== todayStr）
   - current が7の倍数に達するたびにフリーズトークン+1（上限3）。欠席1日につき1個消費
   - 未来日付（todayStr 超過）と空セッション（矢0本）は無視 */
function computeStreak(sessions, practiceDays, todayStr){
  const configured = Array.isArray(practiceDays) && practiceDays.length > 0;
  const out = {configured, current:0, best:0, freezeTokens:0, freezeUsedDates:[], lastPracticeDate:null};
  const sd = new Set();
  (sessions||[]).forEach(s=>{ if(s && s.date && s.date <= todayStr && gamAllArrows(s).length > 0) sd.add(s.date); });
  if(!sd.size) return out;
  const dates = [...sd].sort();
  out.lastPracticeDate = dates[dates.length-1];
  if(!configured) return out;               /* 未設定: 判定停止（UIはCTA表示） */
  const pd = new Set(practiceDays);
  const cur = new Date(dates[0]+"T00:00:00");
  const end = new Date(todayStr+"T00:00:00");
  while(cur <= end){
    const iso = gamFmtDate(cur);
    if(sd.has(iso)){                        /* 練習した日は曜日を問わず +1 */
      out.current++;
      if(out.current % 7 === 0 && out.freezeTokens < 3) out.freezeTokens++;
    } else if(pd.has(cur.getDay()) && iso !== todayStr){  /* 当日は欠席判定しない */
      if(out.freezeTokens > 0){ out.freezeTokens--; out.freezeUsedDates.push(iso); }
      else out.current = 0;
    }
    if(out.current > out.best) out.best = out.current;
    cur.setDate(cur.getDate() + 1);
  }
  out.freezeUsedDates = out.freezeUsedDates.slice(-30);
  return out;
}

/* ============ バッジ（確定12種） ============ */

/* check(ss, cur, ctx): ss=全セッション（cur を含む）, cur=判定対象セッション,
   ctx={streak, nowIso}。DOM・Date.now() 非依存（テスト再現性のため new Date() を呼ばない） */
const BADGE_DEFS=[
  {id:"first_arrow",name:"初矢",cat:"reach",reason:"初セッション完了（矢1本以上）",
   check:function(ss,cur){ return gamAllArrows(cur).length>0; }},
  {id:"century",name:"百射",cat:"reach",reason:"累計100本達成",
   check:function(ss){ return gamTotalShots(ss)>=100; }},
  {id:"millennium",name:"千射",cat:"reach",reason:"累計1000本達成",
   check:function(ss){ return gamTotalShots(ss)>=1000; }},
  {id:"gold_end",name:"ゴールドエンド",cat:"accuracy",reason:"1エンド（3本以上）全矢が満点",
   check:function(ss,cur){
     return (cur.ends||[]).some(e=>Array.isArray(e)&&e.length>=3&&e.every(a=>a&&a.s===gamPerfect(cur)));
   }},
  {id:"perfect_end",name:"完璧なエンド",cat:"accuracy",reason:"1エンド（3本以上）全矢9点以上（field:5点以上）",
   check:function(ss,cur){
     const th=cur&&cur.faceType==="field"?5:9;
     return (cur.ends||[]).some(e=>Array.isArray(e)&&e.length>=3&&e.every(a=>a&&a.s>=th));
   }},
  {id:"tight_group",name:"鋼のグルーピング",cat:"accuracy",reason:"RMS ≤ 1.5×リング幅（座標入力10本以上）",
   check:function(ss,cur){
     const coords=gamAllArrows(cur).filter(a=>Number.isFinite(a.x)&&Number.isFinite(a.y));
     if(coords.length<10) return false;
     const rms=gamGroupRms(coords);
     return rms!==null&&rms<=gamRingW(cur)*1.5;
   }},
  {id:"pb_breaker",name:"自己ベスト更新",cat:"growth",reason:"同一 round・距離・的・本数（12本以上）で過去最高合計を超過",
   check:function(ss,cur){
     const arrs=gamAllArrows(cur);
     if(arrs.length<12) return false;
     const my=arrs.reduce((a,x)=>a+(x.s||0),0);
     if(!my) return false;
     const peers=(ss||[]).filter(s=>s&&s.id!==cur.id
       &&(s.round||"free")===(cur.round||"free")
       &&String(s.dist)===String(cur.dist)
       &&(s.faceType||"single")===(cur.faceType||"single")
       &&gamAllArrows(s).length===arrs.length);
     if(!peers.length) return false;
     const best=peers.reduce((mx,s)=>{
       const t=gamAllArrows(s).reduce((a,x)=>a+(x.s||0),0);
       return t>mx?t:mx;
     },0);
     return my>best;
   }},
  {id:"week_warrior",name:"週間戦士",cat:"consistency",reason:"1 ISO週に3セッション以上",
   check:function(ss,cur){
     if(!cur||!cur.date) return false;
     const wk=gamIsoWeek(cur.date);
     if(!wk) return false;
     return (ss||[]).filter(s=>s&&s.date&&gamIsoWeek(s.date)===wk).length>=3;
   }},
  {id:"month_master",name:"月間マスター",cat:"consistency",reason:"1暦月に10セッション以上",
   check:function(ss,cur){
     if(!cur||!cur.date) return false;
     const mo=cur.date.slice(0,7);
     return (ss||[]).filter(s=>s&&s.date&&s.date.slice(0,7)===mo).length>=10;
   }},
  {id:"streak_7",name:"継続の炎",cat:"consistency",reason:"ストリークのベストが7以上",
   check:function(ss,cur,ctx){ return !!(ctx&&ctx.streak&&ctx.streak.best>=7); }},
  {id:"distance_explorer",name:"距離探検家",cat:"diversity",reason:"3種以上の距離で記録",
   check:function(ss){
     const d=new Set();
     (ss||[]).forEach(s=>{ if(s&&s.dist!=null) d.add(String(s.dist)); });
     return d.size>=3;
   }},
  {id:"all_weather",name:"全天候射手",cat:"diversity",reason:"3種以上の天候条件で記録",
   check:function(ss){
     const w=new Set();
     (ss||[]).forEach(s=>{ if(s&&s.wx) w.add(s.wx); });
     return w.size>=3;
   }}
];

/* checkBadges(sessions, unlockedIds, currentSession, ctx)
   unlockedIds: Set<string> または string[] / ctx: { streak, nowIso }
   → [{id, unlockedAt, sessionId}]（name/icon/説明は返さない。BADGE_DEFS から引く） */
function checkBadges(sessions, unlockedIds, currentSession, ctx){
  const have=unlockedIds instanceof Set?unlockedIds:new Set(unlockedIds||[]);
  const nowIso=ctx&&ctx.nowIso?ctx.nowIso:"";
  return BADGE_DEFS
    .filter(b=>!have.has(b.id)&&b.check(sessions,currentSession,ctx))
    .map(b=>({id:b.id,unlockedAt:nowIso,sessionId:currentSession&&currentSession.id?currentSession.id:""}));
}

/* backfillBadges(sessions, nowIso) — 移行時一括付与。
   全履歴を日付昇順で走査し、各バッジについて最初に条件を満たしたセッションの id を記録する。
   累計系バッジは「その時点までの履歴（prefix）」で判定する。
   ctx.streak は渡さない（practiceDays 未設定の移行時点では streak_7 は付与しない。
   曜日設定後の checkBadges で解除される）。
   → [{id, unlockedAt: nowIso, sessionId, retro:true}] */
function backfillBadges(sessions, nowIso){
  const ordered=(sessions||[]).filter(s=>s&&typeof s==="object").slice()
    .sort((a,b)=>String(a.date||"")<String(b.date||"")?-1:String(a.date||"")>String(b.date||"")?1:0);
  const got=[];
  const have=new Set();
  const ctx={streak:null,nowIso:nowIso||""};
  for(let i=0;i<ordered.length;i++){
    const prefix=ordered.slice(0,i+1);
    const cur=ordered[i];
    for(const b of BADGE_DEFS){
      if(have.has(b.id)) continue;
      if(b.check(prefix,cur,ctx)){
        have.add(b.id);
        got.push({id:b.id,unlockedAt:nowIso||"",sessionId:cur.id||"",retro:true});
      }
    }
  }
  return got;
}

/* ============ 目標進捗（導出値・永続化しない） ============ */

/* calcGoalProgress(sessions, goals, todayStr)
   → {daily:{current,target}, weekly:{current,target}, monthly:{current,target}}
   daily/monthly は矢数、weekly はセッション数（空セッション=矢0本は週次カウントから除外）。
   週はISO週（月曜始まり）。 */
function calcGoalProgress(sessions, goals, todayStr){
  const g=goals||{};
  const mo=todayStr.slice(0,7);
  const td=new Date(todayStr+"T00:00:00");
  const dow=(td.getDay()+6)%7;
  const mon=new Date(td); mon.setDate(mon.getDate()-dow);
  const monStr=gamFmtDate(mon);
  const sun=new Date(mon); sun.setDate(sun.getDate()+6);
  const sunStr=gamFmtDate(sun);

  let dA=0,wS=0,mA=0;
  (sessions||[]).forEach(s=>{
    if(!s||!s.date) return;
    const n=gamAllArrows(s).length;
    if(s.date===todayStr) dA+=n;
    if(s.date>=monStr&&s.date<=sunStr&&n>0) wS++;   /* 空セッション除外 */
    if(s.date.slice(0,7)===mo) mA+=n;
  });

  return {
    daily:{current:dA,target:g.dailyArrows||36},
    weekly:{current:wS,target:g.weeklySessions||3},
    monthly:{current:mA,target:g.monthlyArrows||300}
  };
}

/* SVGリングの stroke-dashoffset 値。target<=0 は空リング（=circumference） */
function goalRingOffset(current, target, circumference){
  if(!target||target<=0) return circumference;
  return circumference*(1-Math.min(current/target,1));
}
