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
/* 両側95%の t 分布臨界値（自由度1〜30は表、31以上は 1.96+2.4/df で誤差0.003以内） */
const T975 = [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
function tCrit975(df) {
  if (!(df >= 1)) return Infinity;
  return df <= 30 ? T975[Math.floor(df)] : 1.96 + 2.4 / df;
}
/* 標本平均・不偏共分散（n−1）と楕円。n=1 は広がり0・標準誤差∞ */
function sampleStats(arrows) {
  const n = arrows.length;
  if (!n) return null;
  const mx = arrows.reduce((a, p) => a + p.x, 0) / n;
  const my = arrows.reduce((a, p) => a + p.y, 0) / n;
  let vx = 0, vy = 0, cov = 0;
  arrows.forEach((p) => { const dx = p.x - mx, dy = p.y - my; vx += dx * dx; vy += dy * dy; cov += dx * dy; });
  const df = n - 1;
  if (df > 0) { vx /= df; vy /= df; cov /= df; } else { vx = vy = cov = 0; }
  const sx = Math.sqrt(Math.max(0, vx)), sy = Math.sqrt(Math.max(0, vy));
  const disc = Math.sqrt(Math.max(0, (vx - vy) ** 2 + 4 * cov * cov));
  const l1 = Math.max(0, (vx + vy + disc) / 2), l2 = Math.max(0, (vx + vy - disc) / 2);
  const se = (s) => (df > 0 ? s / Math.sqrt(n) : Infinity);
  const t = tCrit975(df);
  return {
    n, mx, my, sx, sy, cov,
    rr: Math.sqrt(Math.max(0, vx + vy)),
    corr: sx > 0 && sy > 0 ? clamp(cov / (sx * sy), -1, 1) : 0,
    major: Math.sqrt(l1), minor: Math.sqrt(l2),
    angleDeg: (0.5 * Math.atan2(2 * cov, vx - vy)) * 180 / Math.PI,
    effN: n, df, seX: se(sx), seY: se(sy), tcrit: t, ciX: t * se(sx), ciY: t * se(sy),
  };
}
/* 1本を除いた残り m 本の平均・不偏共分散から見た、その矢のマハラノビス距離による外れ値の p 値。
   新しい観測の T² = m/(m+1)·d² は (2(m−1)/(m−2))·F(2, m−2) に従い、2次元では F の上側確率が
   (1 + 2F/k)^(−k/2)（k=m−2）と閉じた式になる。縮退（全矢同一点・一直線）は共分散に微小な下駄を足す */
function leaveOneOutPValue(arrows, i, sums) {
  const p = arrows[i], m = sums.n - 1;
  if (m < 4) return 1;
  const sx = sums.x - p.x, sy = sums.y - p.y;
  const mx = sx / m, my = sy / m;
  const vx = (sums.xx - p.x * p.x - m * mx * mx) / (m - 1);
  const vy = (sums.yy - p.y * p.y - m * my * my) / (m - 1);
  const cv = (sums.xy - p.x * p.y - m * mx * my) / (m - 1);
  const eps = Math.max(1e-6, (Math.max(0, vx) + Math.max(0, vy)) * 1e-6);
  const a = Math.max(0, vx) + eps, d = Math.max(0, vy) + eps;
  const det = a * d - cv * cv;
  if (!(det > 0)) return 1;
  const dx = p.x - mx, dy = p.y - my;
  const d2 = (d * dx * dx - 2 * cv * dx * dy + a * dy * dy) / det;
  const k = m - 2, F = ((m / (m + 1)) * d2 * k) / (2 * (m - 1));
  return Math.pow(1 + (2 * F) / k, -k / 2);
}
const OUTLIER_ALPHA = 0.01; /* 1セッション全体で正常な矢を誤って除外する確率の上限（ボンフェローニ補正） */
/* 外れ値を除いたグルーピング統計:
   1) 6本以上のとき、各矢を「残りの矢から見て統計的にあり得ないか」で検定（上の p 値 < α/n）。
      最も極端な1本ずつ除き、最大で全体の20%まで繰り返す
   2) 残りの矢の標本平均・不偏共分散から中心・ばらつき・中心の標準誤差・95%区間を出す */
function robustStats(arrows) {
  const total = arrows.length;
  if (!total) return null;
  let used = arrows.slice();
  const excluded = [];
  const limit = total >= 6 ? Math.floor(total * 0.2) : 0;
  while (excluded.length < limit) {
    const sums = used.reduce((s, a) => ({ n: s.n + 1, x: s.x + a.x, y: s.y + a.y, xx: s.xx + a.x * a.x, yy: s.yy + a.y * a.y, xy: s.xy + a.x * a.y }), { n: 0, x: 0, y: 0, xx: 0, yy: 0, xy: 0 });
    let worst = -1, worstP = 1;
    for (let i = 0; i < used.length; i++) {
      const pv = leaveOneOutPValue(used, i, sums);
      if (pv < worstP) { worstP = pv; worst = i; }
    }
    if (worst < 0 || worstP >= OUTLIER_ALPHA / used.length) break;
    excluded.push(used[worst]);
    used = used.filter((_, i) => i !== worst);
  }
  const st = sampleStats(used);
  /* 演算信頼度 = 1 − 1/√n: 中心の推定誤差（標準誤差）がグルーピングの広がりの何割か、の補数 */
  const confidence = clamp(1 - 1 / Math.sqrt(st.n), 0, 1);
  return Object.assign(st, { used, excluded, total, method: excluded.length ? "mean+outlier" : "mean", confidence });
}
/* 誤差関数（Abramowitz–Stegun 7.1.26、絶対誤差 1.5e-7 以下） */
function erfApprox(x){
  const sg=x<0?-1:1, t=1/(1+0.3275911*Math.abs(x));
  const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);
  return sg*y;
}
/* 真の値が推定値の ±tol 以内にある確率（正規近似）。se=∞ は 0、se=0 は 1 */
function probWithin(tol, se){
  if(!(se>=0)) return 0;
  if(se===0) return 1;
  if(!Number.isFinite(se)) return 0;
  return erfApprox(tol/(Math.SQRT2*se));
}
/* グルーピング中心が的中心(0,0)からずれているかの同時検定（Hotelling T²）。
   2次元では F(2,n−2) の上側確率が (1+2F/k)^(−k/2) と閉じた式になる。
   offX/offY は検定するズレ（風補正後など）、extraVarX は中心の左右に足す分散（風の不確かさ²） */
function centerOffsetTest(st, offX, offY, extraVarX){
  const n=st&&st.n;
  if(!(n>=3)) return {p:1,testable:false};
  const vx=st.sx*st.sx+n*(extraVarX||0), vy=st.sy*st.sy, cv=st.cov||0;
  const eps=Math.max(1e-6,(vx+vy)*1e-6);
  const a=vx+eps, d=vy+eps, det=a*d-cv*cv;
  if(!(det>0)) return {p:1,testable:false};
  const d2=(d*offX*offX-2*cv*offX*offY+a*offY*offY)/det;
  const k=n-2, F=(n*d2*k)/(2*(n-1));
  return {p:Math.pow(1+2*F/k,-k/2),testable:true,T2:n*d2};
}
/* 確率の表示（0.1%未満は丸める） */
function fmtChance(p){
  if(!(p>=0)) return "—";
  if(p<.001) return "0.1%未満";
  return `${(p*100).toFixed(p<.1?1:0)}%`;
}
/* 1軸の補正量。経験ベイズの縮小推定 adj = m·max(0, 1 − SE²/m²)：
   ズレの推定誤差が大きいほど控えめに動かす（偶然のズレを追いかけない）。ci は95%区間の半幅 */
function axisCorrection(m, se, df){
  const t=tCrit975(df);
  const shrink=Number.isFinite(se)&&Math.abs(m)>0?Math.max(0,1-(se*se)/(m*m)):0;
  return {m, se, ci:t*se, shrink, adj:m*shrink};
}
