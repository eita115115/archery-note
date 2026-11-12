"use strict";
/* Archery Note: scoring and grouping math */
/* ============ scoring ============
   判定規則（World Archery 準拠。詳細は docs/design/math-core-rebuild.md）:
   - リングの公称半径 k*w は高得点側ゾーンの外縁。境界線は高得点側に属する（線幅は判定に足さない）。
   - 矢のシャフトが境界線に少しでも触れていれば高得点: 中心距離 − 矢の半径 ≤ 公称半径。
   - 矢の半径は的の大きさと無関係な実寸。用具の矢径(mm)、未入力なら DEFAULT_ARROW_DIA_MM。
   旧版は矢円半径を faceD/85（122cm的で1.44cm）としており、実寸の約5倍で線かみを過大判定していた。 */
function isFieldFace(faceType){ return faceType==="field"; }
function ringW(faceD,faceType){ return isFieldFace(faceType) ? faceD/12 : faceD/20; }
const SPOT_Y=[22,0,-22]; /* 三つ目的のスポット中心(上・中・下, cm, y上向き)。WA 40cm 縦3つ目は中心間 約22cm */
const DEFAULT_ARROW_DIA_MM=5.7; /* 矢径未入力時の既定（一般的なアウトドア用カーボン矢の太さ） */
const ARROW_DIA_MM_MIN=3, ARROW_DIA_MM_MAX=10; /* WA のシャフト上限 9.3mm を含む入力の妥当範囲 */
const SCORE_EPS=1e-9; /* 境界ちょうどの浮動小数誤差（例 18.3/6.1=3.0000000000000004）で低い点にしない */
function arrowRadiusFromDiaMm(diaMm){
  const d=typeof diaMm==="number"?diaMm:parseFloat(diaMm);
  const mm=Number.isFinite(d)&&d>=ARROW_DIA_MM_MIN&&d<=ARROW_DIA_MM_MAX?d:DEFAULT_ARROW_DIA_MM;
  return mm/20; /* 直径mm → 半径cm */
}
const DEFAULT_ARROW_R=arrowRadiusFromDiaMm(DEFAULT_ARROW_DIA_MM);
function validArrowR(r){ return typeof r==="number"&&Number.isFinite(r)&&r>=ARROW_DIA_MM_MIN/20&&r<=ARROW_DIA_MM_MAX/20; }
/* セッションの判定用矢半径(cm): 記録開始時に保存した arrowR → 用具の矢径 → 既定値 */
function sessionArrowR(sess, setup){
  if(sess&&validArrowR(sess.arrowR)) return sess.arrowR;
  return arrowRadiusFromDiaMm(setup&&setup.arrowDia);
}
/* 画面上の矢円 = 判定に使う矢の実寸の円（不変条件: 表示される矢円と線かみ判定が一致する） */
function arrowMarkRadius(faceD, arrowR){ return validArrowR(arrowR)?arrowR:DEFAULT_ARROW_R; }
/* 実寸の矢は122cm的では画面上1px前後しかないため、位置を探すための半透明の目印を別に描く。
   目印は判定に一切使わない（線に触れていても点数は上がらない）。 */
function arrowLocatorRadius(faceD){ return faceD/85; }
/* 的面の線の描画用の半幅（判定には使わない） */
function targetLineHalfWidth(faceD,faceType){
  if(isFieldFace(faceType)) return faceD/900;
  return faceType==="single" ? faceD/1200 : faceD/640;
}
/* 線かみ判定に使う半径 = 矢の実寸の半径。faceD/faceType は旧呼び出し互換のため受け取るだけ */
function lineCutRadius(faceD, faceType, arrowR){ return arrowMarkRadius(faceD, arrowR); }
/* arrowR: 矢の半径(cm)。省略時は既定の矢径。0 を渡すと矢の中心点だけで判定する */
function scoreAt(relX,relY,faceD,faceType,arrowR){
  const w=ringW(faceD,faceType);
  const touchCm=arrowR==null||!Number.isFinite(Number(arrowR)) ? DEFAULT_ARROW_R : Math.max(0,Number(arrowR));
  const r=Math.max(0, Math.hypot(relX,relY)-touchCm);
  const ring=Math.ceil(r/w-SCORE_EPS); /* 中心から数えて何番目のリング帯か（境界上は内側） */
  if(isFieldFace(faceType)){
    if(r>w*6*(1+SCORE_EPS)) return {s:0,X:false};
    if(ring<=1) return {s:6,X:false};
    return {s:Math.max(0,7-ring),X:false};
  }
  if(r<=w/2*(1+SCORE_EPS)) return {s:10,X:true};
  let s=11-ring;
  if(faceType==="triple" && s<6) s=0;
  if(s<1) s=0;
  return {s:Math.min(10,Math.max(0,s)),X:false};
}
function scoreRank(hit){ return hit.s*2+(hit.X?1:0); }
function isLineCutting(relX,relY,faceD,faceType,arrowR){
  const center=scoreAt(relX,relY,faceD,faceType,0);
  const cut=scoreAt(relX,relY,faceD,faceType,lineCutRadius(faceD,faceType,arrowR));
  return scoreRank(cut)>scoreRank(center);
}
function nearestSpot(gy){
  let spot=0,best=Infinity;
  SPOT_Y.forEach((c,i)=>{ const d=Math.abs(gy-c); if(d<best){best=d;spot=i;} });
  return spot;
}
function isLineCuttingFromGlobal(gx,gy,faceD,faceType,arrowR){
  if(faceType!=="triple") return isLineCutting(gx,gy,faceD,faceType,arrowR);
  return isLineCutting(gx,gy-SPOT_Y[nearestSpot(gy)],faceD,"triple",arrowR);
}
function hitFromGlobal(gx,gy,faceD,faceType,arrowR){
  if(faceType!=="triple"){ return Object.assign({x:gx,y:gy}, scoreAt(gx,gy,faceD,faceType,arrowR)); }
  const spot=nearestSpot(gy);
  const rx=gx, ry=gy-SPOT_Y[spot];
  return Object.assign({x:rx,y:ry,spot}, scoreAt(rx,ry,faceD,"triple",arrowR));
}
/* 記録済みの座標を実寸判定で採点し直す（表示専用。保存された点数は書き換えない）。
   三つ目的の矢座標はスポット中心基準で保存されているのでそのまま使える。座標のない矢は記録時の点数を使う。 */
function sessionRescore(sess, arrowR){
  const out={total:0,stored:0,changed:0,scored:0,skipped:0,arrowR};
  ((sess&&sess.ends)||[]).forEach(end=>(end||[]).forEach(a=>{
    const stored=Number(a&&a.s)||0;
    out.stored+=stored;
    const x=Number(a&&a.x), y=Number(a&&a.y);
    if(!Number.isFinite(x)||!Number.isFinite(y)){ out.total+=stored; out.skipped++; return; }
    const h=scoreAt(x,y,sess.faceD,sess.faceType,arrowR);
    out.total+=h.s; out.scored++;
    if(h.s!==stored||!!h.X!==!!(a&&a.X)) out.changed++;
  }));
  return out;
}
function zoneStyle(s,X,faceType){
  if(isFieldFace(faceType)){
    if(s>=5) return {bg:"var(--gold)",fg:"#1c1e1c"};
    if(s>=1) return {bg:"#222",fg:"#fff"};
    return {bg:"#888b85",fg:"#fff"};
  }
  if(s>=9) return {bg:"var(--gold)",fg:"#1c1e1c"};
  if(s>=7) return {bg:"var(--red)",fg:"#fff"};
  if(s>=5) return {bg:"var(--blue)",fg:"#fff"};
  if(s>=3) return {bg:"#222",fg:"#fff"};
  if(s>=1) return {bg:"#fff",fg:"#1c1e1c"};
  return {bg:"#888b85",fg:"#fff"};
}
function scoreLabel(a){ return a.s===0?"M":(a.X?"X":String(a.s)); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function median(vals){
  const a=vals.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length) return 0;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function momentStats(arrows, weights){
  const n=arrows.length;
  if(!n) return null;
  weights=weights||arrows.map(()=>1);
  const sw=weights.reduce((a,w)=>a+w,0);
  if(sw<=0) return momentStats(arrows);
  const mx=arrows.reduce((a,p,i)=>a+p.x*weights[i],0)/sw;
  const my=arrows.reduce((a,p,i)=>a+p.y*weights[i],0)/sw;
  let vx=0,vy=0,cov=0;
  arrows.forEach((p,i)=>{ const dx=p.x-mx, dy=p.y-my, w=weights[i]; vx+=w*dx*dx; vy+=w*dy*dy; cov+=w*dx*dy; });
  vx/=sw; vy/=sw; cov/=sw;
  const rr=Math.sqrt(Math.max(0,vx+vy));
  const sx=Math.sqrt(Math.max(0,vx)), sy=Math.sqrt(Math.max(0,vy));
  const disc=Math.sqrt(Math.max(0,(vx-vy)**2+4*cov*cov));
  const l1=Math.max(0,(vx+vy+disc)/2), l2=Math.max(0,(vx+vy-disc)/2);
  const major=Math.sqrt(l1), minor=Math.sqrt(l2);
  const angleDeg=(0.5*Math.atan2(2*cov,vx-vy))*180/Math.PI;
  const corr=(sx>0&&sy>0)?clamp(cov/(sx*sy),-1,1):0;
  const effN=sw*sw/weights.reduce((a,w)=>a+w*w,0);
  return {n,mx,my,rr,sx,sy,cov,corr,major,minor,angleDeg,effN};
}
function groupStats(arrows){ return momentStats(arrows); }
function weightedStats(arrows, weights){ return momentStats(arrows, weights); }
function robustScale(vals, center, fallback){
  const dev=vals.map(v=>Math.abs(v-center));
  return Math.max(1.4826*median(dev), fallback||0, 0.01);
}
/* 中央値/MAD・楕円距離・重み付き中心で、明らかな外れ値を除いたグルーピング統計 */
function robustStats(arrows){
  const total=arrows.length;
  if(!total) return null;
  if(total<5){
    const st=groupStats(arrows);
    return Object.assign(st,{used:arrows.slice(),excluded:[],total,method:"simple",confidence:total>=3?.55:.35});
  }
  const cx=median(arrows.map(a=>a.x)), cy=median(arrows.map(a=>a.y));
  const ds=arrows.map(a=>Math.hypot(a.x-cx,a.y-cy));
  const md=median(ds);
  const mad=median(ds.map(d=>Math.abs(d-md)));
  const base=groupStats(arrows);
  const sigma=Math.max(1.4826*mad, base.rr*.35, 0.01);
  const sx0=robustScale(arrows.map(a=>a.x), cx, base.sx*.45);
  const sy0=robustScale(arrows.map(a=>a.y), cy, base.sy*.45);
  const eds=arrows.map(a=>Math.hypot((a.x-cx)/sx0,(a.y-cy)/sy0));
  const em=median(eds), emad=median(eds.map(d=>Math.abs(d-em)));
  const limit=Math.max(md+3*sigma, md*2.2, base.rr*1.65);
  const eLimit=Math.max(3.15, em+3*Math.max(1.4826*emad,.35));
  let used=[], excluded=[];
  const maxExcluded=Math.floor(total*.25);
  arrows.forEach((a,i)=>{
    const radial=ds[i]>limit && ds[i]>md+2.4*sigma;
    const elliptical=eds[i]>eLimit && eds[i]>3.15;
    const obvious=(radial||elliptical) && excluded.length<maxExcluded;
    (obvious?excluded:used).push(a);
  });
  if(used.length<Math.max(3,total-excluded.length)){
    used=arrows.slice(); excluded=[];
  }
  const unchanged=excluded.length===0;
  const ux=unchanged?cx:median(used.map(a=>a.x)), uy=unchanged?cy:median(used.map(a=>a.y));
  const uds=unchanged?ds:used.map(a=>Math.hypot(a.x-ux,a.y-uy));
  const udm=unchanged?md:median(uds);
  const xScale=robustScale(used.map(a=>a.x), ux, base.sx*.55);
  const yScale=robustScale(used.map(a=>a.y), uy, base.sy*.55);
  const scale=Math.max(udm+3*(unchanged?mad:median(uds.map(d=>Math.abs(d-udm)))), base.rr, 0.01);
  const weights=used.map(a=>{
    const radialU=Math.hypot(a.x-ux,a.y-uy)/scale;
    const ellU=Math.hypot((a.x-ux)/xScale,(a.y-uy)/yScale)/3;
    const u=Math.max(radialU,ellU);
    return u>=1?0.05:(1-u*u)**2;
  });
  const st=weightedStats(used, weights);
  const outRate=excluded.length/total;
  const sample=clamp((st.effN-2)/10,.35,1);
  const outPenalty=clamp(1-outRate*1.6,.55,1);
  const skewPenalty=st.minor>0?clamp(st.minor/st.major+.35,.55,1):.7;
  return Object.assign(st,{used,excluded,total,method:"ellipse-biweight",confidence:sample*outPenalty*skewPenalty});
}
