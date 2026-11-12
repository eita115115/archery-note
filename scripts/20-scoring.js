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
/* 保存された矢半径(cm)を数値として読む（インポートで文字列になった値も受け付ける）。範囲外・不正は null */
function storedArrowR(r){
  const n=typeof r==="number"?r:typeof r==="string"&&r.trim()!==""?Number(r):NaN;
  return Number.isFinite(n)&&n>=ARROW_DIA_MM_MIN/20&&n<=ARROW_DIA_MM_MAX/20?n:null;
}
function validArrowR(r){ return storedArrowR(r)!=null; }
/* セッションの判定用矢半径(cm): 記録開始時に保存した arrowR → 用具の矢径 → 既定値 */
function sessionArrowR(sess, setup){
  const stored=sess?storedArrowR(sess.arrowR):null;
  if(stored!=null) return stored;
  return arrowRadiusFromDiaMm(setup&&setup.arrowDia);
}
/* 記録の判定に使う半径(cm)。新しい記録は保存済みの arrowR（矢の実寸）。arrowR を持たない旧判定の記録
   （記録途中・編集中を含む）は、保存された点数と矢円が食い違わないよう、そのセッション内では旧半径を保つ:
   保存された shaft、無ければ旧式（的の直径/85 + 線の半幅）。実寸での比較は sessionRescore で別に出す */
function sessionScoringRadius(sess, setup){
  const stored=sess?storedArrowR(sess.arrowR):null;
  if(stored!=null) return stored;
  if(sess&&typeof sess==="object"&&Array.isArray(sess.ends)){
    const shaft=Number(sess.shaft);
    if(Number.isFinite(shaft)&&shaft>0&&shaft<5) return shaft;
    const faceD=Number(sess.faceD);
    if(Number.isFinite(faceD)&&faceD>0) return faceD/85+targetLineHalfWidth(faceD,sess.faceType);
  }
  return arrowRadiusFromDiaMm(setup&&setup.arrowDia);
}
/* 画面上の矢円 = 判定に使う半径の円（不変条件: 表示される矢円と線かみ判定が一致する） */
function arrowMarkRadius(faceD, arrowR){ return Number.isFinite(arrowR)&&arrowR>0&&arrowR<5?arrowR:DEFAULT_ARROW_R; }
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
/* 得点チップ・キーの色。的面の色とは別に、文字との比を優先した帯色の変数（style.css の --z-*）を使う */
function zoneStyle(s,X,faceType){
  const z=k=>({bg:`var(--z-${k})`,fg:`var(--z-${k}-fg)`});
  if(isFieldFace(faceType)){
    if(s>=5) return z("gold");
    if(s>=1) return z("black");
    return z("miss");
  }
  if(s>=9) return z("gold");
  if(s>=7) return z("red");
  if(s>=5) return z("blue");
  if(s>=3) return z("black");
  if(s>=1) return z("white");
  return z("miss");
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
/* ============ グルーピング統計 grouping-v3（docs/design/grouping-stats-v3.md） ============
   A（正式）: 全射の標本統計。B（参考・サイト判断用）: MCD の順位と厳密 F 検定で外れ値候補を除いた標本統計。
   C（参考）: 再重み付け MCD による「まとまっている矢のばらつき」の推定。旧方式は legacyRobustStats に保持 */
/* 決定的な擬似乱数（MCD の開始点用。呼び出しごとに同じシードで初期化する） */
function splitmix32(seed){
  let s=seed>>>0;
  return function(){
    s=(s+0x9E3779B9)>>>0;
    let z=s;
    z=Math.imul(z^(z>>>16),0x85EBCA6B)>>>0;
    z=Math.imul(z^(z>>>13),0xC2B2AE35)>>>0;
    return (z^(z>>>16))>>>0;
  };
}
function xoshiro128ss(seed){
  const sm=splitmix32(seed);
  let a=sm(), b=sm(), c=sm(), d=sm();
  if(!(a|b|c|d)) a=1;
  const rotl=(x,k)=>(x<<k)|(x>>>(32-k));
  return function(){
    const r=Math.imul(rotl(Math.imul(b,5),7),9)>>>0;
    const t=b<<9;
    c^=a; d^=b; b^=c; a^=d; c^=t; d=rotl(d,11);
    return r/4294967296;
  };
}
/* χ² 分位点の Wilson–Hilferty 近似（z は標準正規の分位点） */
function chi2QuantileWH(nu, z){
  const k=2/(9*nu);
  return nu*Math.pow(1-k+z*Math.sqrt(k),3);
}
/* 全射 RMS の 95% 区間（2 変量正規。trace(S) を Satterthwaite の自由度 nu の尺度付き χ² で近似）。6 本以上 */
function rmsCi(st){
  if(!st || !(st.n>=6)) return null;
  const a=st.sx*st.sx, d=st.sy*st.sy, b=st.cov||0, tr=a+d, den=a*a+d*d+2*b*b;
  if(!(tr>0) || !(den>0) || !Number.isFinite(tr) || !Number.isFinite(den)) return null;
  const nu=(st.n-1)*tr*tr/den;
  const lo=st.rr*Math.sqrt(nu/chi2QuantileWH(nu,1.959964)), hi=st.rr*Math.sqrt(nu/chi2QuantileWH(nu,-1.959964));
  return Number.isFinite(lo)&&Number.isFinite(hi)?{lo,hi,df:nu}:null;
}
/* 2×2 共分散 (a,b;b,d) の楕円（1σ）と角度 */
function ellipseOfCov(a, b, d){
  const disc=Math.sqrt(Math.max(0,(a-d)**2+4*b*b));
  const l1=Math.max(0,(a+d+disc)/2), l2=Math.max(0,(a+d-disc)/2);
  return {major:Math.sqrt(l1), minor:Math.sqrt(l2), angleDeg:(0.5*Math.atan2(2*b,a-d))*180/Math.PI};
}
const MCD_MIN_N=6;
const MCD_ALPHA=0.75; /* h = ceil(0.75n)。効率と崩壊点の折り合い（Rousseeuw & Van Driessen 1999） */
const MCD_C75=0.75/(1-0.25*(1+Math.log(4))); /* 一貫性係数 c = a / F_χ²(4)(χ²(2) の a 分位点)（Croux & Haesbroeck 1999） */
const RMCD_Q=-2*Math.log(0.025); /* χ²(2) の 97.5% 点 */
const RMCD_C=0.975/(1-0.025*(1-Math.log(0.025)));
const MCD_SEED=0x4D434431;
const MCD_STARTS=24;
/* 小標本補正係数（tools/gen-mcd-tables.js で生成: n≤30 は20万回・それ以上は10万回、シード 20261112+n / +1000+n。表にない n は 1/n で線形補間、150 本超は (1/150, 値) と (0, 1) の間） */
/* 72 本までは 1 本刻み（h=ceil(0.75n) の切り上げで本数を 4 で割った余りごとに係数が上下するため、補間しない） */
const MCD_TABLE_N=[...Array.from({length:67},(_,i)=>i+6),84,96,108,120,144,150];
const MCD_MRAW=[0.8858,0.8382,0.9788,0.935,0.899,0.8694,0.9654,0.9367,0.9113,0.887,0.9635,0.9409,0.9197,0.9004,0.9637,0.9453,0.9277,0.9115,0.9643,0.9489,0.9342,0.9183,0.9656,0.9526,0.9389,0.9259,0.9673,0.9531,0.9442,0.9321,0.9681,0.9572,0.9476,0.9372,0.9697,0.9599,0.9501,0.9414,0.9715,0.9615,0.9528,0.9442,0.973,0.9636,0.9554,0.9481,0.9734,0.9656,0.9581,0.9507,0.9748,0.9675,0.9596,0.9521,0.9752,0.9684,0.9623,0.9548,0.9766,0.9701,0.9627,0.9576,0.9772,0.9713,0.9651,0.9591,0.9782,0.9817,0.9825,0.9835,0.9857,0.9877,0.9819];
const MCD_MRW=[1.158,1.1296,1.2818,1.2358,1.201,1.172,1.2523,1.2178,1.1897,1.1665,1.2139,1.1895,1.1706,1.1534,1.1827,1.166,1.151,1.1385,1.1598,1.148,1.1347,1.1251,1.1417,1.1306,1.1209,1.115,1.1256,1.1178,1.1105,1.1032,1.1129,1.1074,1.1022,1.0956,1.1045,1.0972,1.0922,1.0889,1.095,1.0906,1.0866,1.081,1.0874,1.0841,1.0817,1.077,1.0813,1.0786,1.075,1.0723,1.0762,1.0727,1.0712,1.0677,1.0729,1.0685,1.0672,1.0645,1.0671,1.0651,1.0637,1.0601,1.0636,1.0621,1.0604,1.0572,1.0601,1.0521,1.0461,1.0415,1.0368,1.0311,1.0298];
function mcdTableFactor(table, n){
  const N=MCD_TABLE_N, last=N.length-1;
  if(n<=N[0]) return table[0];
  if(n>N[last]) return 1+(table[last]-1)*(N[last]/n);
  for(let i=1;i<=last;i++){
    if(n<=N[i]){
      const x=1/n, x0=1/N[i-1], x1=1/N[i];
      return table[i-1]+(table[i]-table[i-1])*(x-x0)/(x1-x0);
    }
  }
  return 1;
}
/* 部分集合（mask）の平均と ML 共分散（座標は全体平均で中心化済みなので、1 回の走査の和から求めても桁落ちしない） */
function mcdSubsetFit(X, Y, mask){
  let c=0, sx=0, sy=0, sxx=0, syy=0, sxy=0;
  for(let i=0;i<X.length;i++){
    if(!mask[i]) continue;
    const x=X[i], y=Y[i];
    c++; sx+=x; sy+=y; sxx+=x*x; syy+=y*y; sxy+=x*y;
  }
  const mx=sx/c, my=sy/c;
  const a=Math.max(0,sxx/c-mx*mx), d=Math.max(0,syy/c-my*my), b=sxy/c-mx*my;
  return {mx, my, a, b, d, det:a*d-b*b};
}
/* (mx,my,a,b,d) に対するマハラノビス距離²（eps は逆行列のための対角の下駄） */
function mcdDistances(X, Y, f, eps, out){
  const a=f.a+eps, d=f.d+eps, b=f.b, det=a*d-b*b;
  for(let i=0;i<X.length;i++){
    const dx=X[i]-f.mx, dy=Y[i]-f.my;
    out[i]=det>0?(d*dx*dx-2*b*dx*dy+a*dy*dy)/det:Infinity;
  }
  return out;
}
/* C ステップ: 距離²の小さい h 点を選び直して当てはめる。h 番目の値をしきい値に、それ未満は全部、
   しきい値と同じ値は正準順の早い方から選ぶ（安定な並べ替えで先頭 h 点を取るのと同じ結果） */
function mcdCStep(X, Y, f, h, eps, d2, tmp){
  mcdDistances(X, Y, f, eps, d2);
  tmp.set(d2);
  tmp.sort();
  const t=tmp[h-1], n=X.length;
  const mask=new Uint8Array(n);
  let c=0;
  for(let i=0;i<n;i++) if(d2[i]<t){ mask[i]=1; c++; }
  for(let i=0;i<n && c<h;i++) if(d2[i]===t){ mask[i]=1; c++; }
  const g=mcdSubsetFit(X, Y, mask);
  g.mask=mask;
  return g;
}
/* 決定的で入力順に不変な MCD。n ≤ 16 は全組み合わせを列挙、それより多いと正準順の先頭 h 点と
   固定シードの 3 点の開始点から C ステップ。縮退（同一点・一直線）は null */
function mcdFit(points){
  const n=points.length;
  if(n<MCD_MIN_N) return null;
  let cx=0, cy=0;
  for(const p of points){ cx+=p.x; cy+=p.y; }
  cx/=n; cy/=n;
  let a0=0, b0=0, d0=0;
  for(const p of points){ const dx=p.x-cx, dy=p.y-cy; a0+=dx*dx; b0+=dx*dy; d0+=dy*dy; }
  a0/=n; b0/=n; d0/=n;
  const tr=a0+d0, detFloor=1e-12*(tr/2)*(tr/2);
  if(!(tr>0) || !(a0*d0-b0*b0>detFloor)) return null;
  /* 正準順: 古典的マハラノビス距離²の昇順、同値は x、y（アフィン変換と入力順に不変） */
  const cd2=points.map(p=>{ const dx=p.x-cx, dy=p.y-cy; return (d0*dx*dx-2*b0*dx*dy+a0*dy*dy)/(a0*d0-b0*b0); });
  const orig=Array.from({length:n},(_,i)=>i).sort((i,j)=>cd2[i]-cd2[j]||points[i].x-points[j].x||points[i].y-points[j].y);
  const X=new Float64Array(n), Y=new Float64Array(n);
  orig.forEach((o,i)=>{ X[i]=points[o].x-cx; Y[i]=points[o].y-cy; });
  const h=Math.ceil(MCD_ALPHA*n), k=n-h;
  let best=null;
  if(n<=16){
    let Sx=0, Sy=0, Sxx=0, Syy=0, Sxy=0;
    for(let i=0;i<n;i++){ Sx+=X[i]; Sy+=Y[i]; Sxx+=X[i]*X[i]; Syy+=Y[i]*Y[i]; Sxy+=X[i]*Y[i]; }
    const removed=new Int32Array(k);
    let bestDet=Infinity, bestRemoved=null;
    const rec=(start, depth, rx, ry, rxx, ryy, rxy)=>{
      if(depth===k){
        const mx=(Sx-rx)/h, my=(Sy-ry)/h;
        const a=(Sxx-rxx)/h-mx*mx, d=(Syy-ryy)/h-my*my, b=(Sxy-rxy)/h-mx*my;
        const det=a*d-b*b;
        if(det<bestDet){ bestDet=det; bestRemoved=Array.from(removed); }
        return;
      }
      for(let i=start;i<=n-(k-depth);i++){
        removed[depth]=i;
        rec(i+1, depth+1, rx+X[i], ry+Y[i], rxx+X[i]*X[i], ryy+Y[i]*Y[i], rxy+X[i]*Y[i]);
      }
    };
    rec(0, 0, 0, 0, 0, 0, 0);
    const mask=new Uint8Array(n).fill(1);
    bestRemoved.forEach(i=>{ mask[i]=0; });
    best=mcdSubsetFit(X, Y, mask);
    best.mask=mask;
  }else{
    const eps=1e-9*tr, d2=new Float64Array(n), tmp=new Float64Array(n);
    const rng=xoshiro128ss(MCD_SEED);
    const starts=[];
    const first=new Uint8Array(n);
    for(let i=0;i<h;i++) first[i]=1;
    starts.push(first);
    for(let s=0;s<MCD_STARTS;s++){
      const m=new Uint8Array(n);
      let c=0;
      while(c<3){ const i=Math.floor(rng()*n); if(!m[i]){ m[i]=1; c++; } }
      starts.push(m);
    }
    const cands=starts.map(m=>{
      let f=mcdSubsetFit(X, Y, m);
      for(let s=0;s<2;s++) f=mcdCStep(X, Y, f, h, eps, d2, tmp);
      return f;
    });
    const top=cands.map((f,i)=>[f.det,i]).sort((p,q)=>p[0]-q[0]||p[1]-q[1]).slice(0,3).map(p=>cands[p[1]]);
    top.forEach(f0=>{
      let f=f0;
      for(let it=0;it<50;it++){
        const g=mcdCStep(X, Y, f, h, eps, d2, tmp);
        if(!(g.det<f.det*(1-1e-12))) break;
        f=g;
      }
      if(!best || f.det<best.det) best=f;
    });
  }
  if(!best || !(best.det>detFloor)) return null;
  return {n, h, k, cx, cy, X, Y, orig, T0:{x:best.mx, y:best.my}, S0:{a:best.a, b:best.b, d:best.d}, mask:best.mask};
}
/* C: 再重み付け MCD。mraw/mrw は小標本補正（省略時は表） */
function rmcdFromFit(fit, mraw, mrw){
  const n=fit.n;
  const f=MCD_C75*(mraw==null?mcdTableFactor(MCD_MRAW,n):mraw);
  const raw={mx:fit.T0.x, my:fit.T0.y, a:fit.S0.a*f, b:fit.S0.b*f, d:fit.S0.d*f};
  if(!(raw.a*raw.d-raw.b*raw.b>0)) return null;
  const d2=mcdDistances(fit.X, fit.Y, raw, 0, new Float64Array(n));
  const w=new Uint8Array(n);
  let m=0;
  for(let i=0;i<n;i++) if(d2[i]<=RMCD_Q){ w[i]=1; m++; }
  if(m<3) return null;
  const g=mcdSubsetFit(fit.X, fit.Y, w);
  const s=RMCD_C*(mrw==null?mcdTableFactor(MCD_MRW,n):mrw)*m/(m-1); /* ML → 不偏（m−1）→ 補正 */
  const S={a:g.a*s, b:g.b*s, d:g.d*s};
  if(!(S.a*S.d-S.b*S.b>0)) return null;
  return {T:{x:g.mx, y:g.my}, S, w, m};
}
/* B: MCD の順位（C からの距離²の大きい順、同値は正準順）で最大 k 本を順に除きながら、各段で 1 本除外の厳密 F 検定。
   最後に有意だった段までを外れ値候補とする（Caroni & Prescott 1992 の逐次手順。まとまった外れ矢に隠されない） */
function mcdOutlierIndices(fit, rob){
  const n=fit.n;
  const d2=mcdDistances(fit.X, fit.Y, {mx:rob.T.x, my:rob.T.y, a:rob.S.a, b:rob.S.b, d:rob.S.d}, 0, new Float64Array(n));
  const order=Array.from({length:n},(_,i)=>i).sort((i,j)=>d2[j]-d2[i]||i-j);
  const sums={n:0, x:0, y:0, xx:0, yy:0, xy:0};
  for(let i=0;i<n;i++){ const x=fit.X[i], y=fit.Y[i]; sums.n++; sums.x+=x; sums.y+=y; sums.xx+=x*x; sums.yy+=y*y; sums.xy+=x*y; }
  let flaggedCount=0;
  for(let j=0;j<fit.k && sums.n>=6;j++){
    const i=order[j], pt={x:fit.X[i], y:fit.Y[i]};
    const pv=leaveOneOutPValue([pt], 0, sums);
    if(pv<OUTLIER_ALPHA/sums.n) flaggedCount=j+1;
    sums.n--; sums.x-=pt.x; sums.y-=pt.y; sums.xx-=pt.x*pt.x; sums.yy-=pt.y*pt.y; sums.xy-=pt.x*pt.y;
  }
  return order.slice(0, flaggedCount).map(i=>fit.orig[i]);
}
/* グルーピング統計。最上位は A（全射）。excl は B（サイト判断用、外れ値候補がなければ A と同じ値）、robust は C */
function robustStats(arrows){
  const total=arrows.length;
  if(!total) return null;
  const A=sampleStats(arrows);
  let robust=null, flaggedIdx=[];
  const fit=total>=MCD_MIN_N?mcdFit(arrows):null;
  if(fit){
    const r=rmcdFromFit(fit);
    if(r){
      const e=ellipseOfCov(r.S.a, r.S.b, r.S.d);
      robust={mx:r.T.x+fit.cx, my:r.T.y+fit.cy, sx:Math.sqrt(r.S.a), sy:Math.sqrt(r.S.d), cov:r.S.b,
        rr:Math.sqrt(r.S.a+r.S.d), major:e.major, minor:e.minor, angleDeg:e.angleDeg, nw:r.m, h:fit.h, method:"rmcd"};
      flaggedIdx=mcdOutlierIndices(fit, r).sort((p,q)=>p-q);
    }
  }
  const flagged=new Set(flaggedIdx);
  const excluded=flaggedIdx.map(i=>arrows[i]);
  const unflagged=flagged.size?arrows.filter((_,i)=>!flagged.has(i)):arrows.slice();
  const excl=Object.assign(flagged.size?sampleStats(unflagged):Object.assign({},A), {used:unflagged, excluded, total, method:"mcd-exclude"});
  excl.confidence=clamp(1-1/Math.sqrt(excl.n),0,1);
  /* 演算信頼度 = 1 − 1/√n: 中心の推定誤差（標準誤差）がグルーピングの広がりの何割か、の補数 */
  return Object.assign(A, {total, used:arrows.slice(), excluded, flagged:excluded, method:"mean",
    confidence:clamp(1-1/Math.sqrt(A.n),0,1), rrCi:rmsCi(A), version:"grouping-v3", excl, robust});
}
/* サイト判断に使う統計（外れ値候補を除いた B）。B を渡しても B を返す */
function sightStats(st){ return st&&st.excl?st.excl:st; }
/* ---- 旧方式（997db97 の robustStats をそのまま保持。既知の欠陥: 記録順依存・重みの不連続・
   RMS の過小評価・円周上6本で RMS 0。修正しないこと。研究用の比較として CSV 出力からだけ呼ぶ） ---- */
function legacyRobustStats(arrows){
  function legacyRobustScale(vals, center, fallback){
    const dev=vals.map(v=>Math.abs(v-center));
    return Math.max(1.4826*median(dev), fallback||0, 0.01);
  }
  function legacyWeightedStats(pts, weights){ return momentStats(pts, weights); }
  function original(arrows){
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
    const sx0=legacyRobustScale(arrows.map(a=>a.x), cx, base.sx*.45);
    const sy0=legacyRobustScale(arrows.map(a=>a.y), cy, base.sy*.45);
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
    const xScale=legacyRobustScale(used.map(a=>a.x), ux, base.sx*.55);
    const yScale=legacyRobustScale(used.map(a=>a.y), uy, base.sy*.55);
    const scale=Math.max(udm+3*(unchanged?mad:median(uds.map(d=>Math.abs(d-udm)))), base.rr, 0.01);
    const weights=used.map(a=>{
      const radialU=Math.hypot(a.x-ux,a.y-uy)/scale;
      const ellU=Math.hypot((a.x-ux)/xScale,(a.y-uy)/yScale)/3;
      const u=Math.max(radialU,ellU);
      return u>=1?0.05:(1-u*u)**2;
    });
    const st=legacyWeightedStats(used, weights);
    const outRate=excluded.length/total;
    const sample=clamp((st.effN-2)/10,.35,1);
    const outPenalty=clamp(1-outRate*1.6,.55,1);
    const skewPenalty=st.minor>0?clamp(st.minor/st.major+.35,.55,1):.7;
    return Object.assign(st,{used,excluded,total,method:"ellipse-biweight",confidence:sample*outPenalty*skewPenalty});
  }
  return original(arrows);
}
/* 誤差関数（Abramowitz–Stegun 7.1.26、絶対誤差 1.5e-7 以下） */
function erfApprox(x){
  const sg=x<0?-1:1, t=1/(1+0.3275911*Math.abs(x));
  const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);
  return sg*y;
}
/* 真の値が推定値の ±tol 以内にある確率（正規近似。標本の少なさは呼び出し側で se を t/1.96 倍して補う）。se=∞ は 0、se=0 は 1 */
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
