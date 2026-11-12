"use strict";
/* Archery Note: sight advice, physics, summaries */
/* Interpretation qualification only; retain raw statistics and scored arrows. */
function analysisHasGroupingEvidence(st){
  return !!st && st.total>=3 && st.n>=3 && Number.isFinite(st.rr);
}
/* A direction must remain distinguishable at the displayed 0.1cm precision.
   散り方の診断は外れ値候補を除いた統計（B）で行う（外れ矢1本で「縦長」などの助言にしない） */
function analysisSpreadDirection(st,ratio,strict){
  st=sightStats(st);
  if(!analysisHasGroupingEvidence(st) || !Number.isFinite(st.sx) || !Number.isFinite(st.sy) || st.sx<0 || st.sy<0) return null;
  const x=Number(st.sx.toFixed(1)), y=Number(st.sy.toFixed(1));
  if(y>x && (strict ? st.sy>st.sx*ratio : st.sy>=st.sx*ratio)) return "vertical";
  if(x>y && (strict ? st.sx>st.sy*ratio : st.sx>=st.sy*ratio)) return "horizontal";
  return null;
}
/* ============ sight advice ============ */
function shapeNote(st){
  const flagged=((st&&st.excluded)||[]).length;
  st=sightStats(st); /* 散り方の形は外れ値候補を除いた統計（B）で診断する */
  if(!analysisHasGroupingEvidence(st) || st.n<6) return "";
  const basis=flagged?`、外れ値候補${flagged}本を除く`:"";
  const tilt=Math.abs(st.angleDeg||0);
  const tilted=st.major&&st.minor&&st.major>st.minor*1.45&&Number(st.major.toFixed(1))>Number(st.minor.toFixed(1))&&tilt>15&&tilt<75;
  if(tilted) return `<div class="note">${icon("ruler")} <b>斜め方向に伸びたグルーピング</b>です（長軸${st.major.toFixed(1)}cm／短軸${st.minor.toFixed(1)}cm、角度${st.angleDeg.toFixed(0)}°${basis}）。照準の流れ、リリース方向、押し手の入り方を同じリズムで確認すると原因を絞りやすいです。</div>`;
  if(analysisSpreadDirection(st,1.3,true)==="vertical") return `<div class="note">${icon("ruler")} <b>縦長のグルーピング</b>です（上下±${st.sy.toFixed(1)}cm／左右±${st.sx.toFixed(1)}cm${basis}）。上下ブレはリリースの強弱・引き尺・プレッシャーポイントの上下、または矢の重量差が原因になりやすいです。</div>`;
  if(analysisSpreadDirection(st,1.3,true)==="horizontal") return `<div class="note">${icon("ruler")} <b>横長のグルーピング</b>です（左右±${st.sx.toFixed(1)}cm／上下±${st.sy.toFixed(1)}cm${basis}）。左右ブレは風・エイミング・ボウハンド、センターショットやプランジャー由来が多いです。</div>`;
  return "";
}
/* 信頼度の算出根拠1行注記。v2の説明文禁止に抵触しないよう「詳しく」details 内でのみ表示する */
function confidenceNoteHtml(kind){
  return kind==="calc"
    ? `<div class="subNoteSm">演算信頼度は 1−1/√(使用本数)。中心の推定誤差がグルーピングの広がりに比べてどれだけ小さいかを表します。</div>`
    : `<div class="subNoteSm">判断信頼度は、グルーピング中心が真の中心からリング幅の半分以内に入っている確率（左右×上下）です。</div>`;
}
/* グルーピングの数値。正式な値は全射（A）。外れ値候補を除いた RMS（B）とロバスト RMS（C）は参考として並べる
   （docs/design/grouping-stats-v3.md）。B は除いた分だけ小さく出るので正式な値には使わない */
function groupSummaryHtml(st, opts){
  if(!st) return "";
  const ci=st.n>=2&&Number.isFinite(st.ciX)?`<div class="kv"><span>中心の誤差（95%区間）</span><span>左右 ±${st.ciX.toFixed(1)}cm ・ 上下 ±${st.ciY.toFixed(1)}cm</span></div>`:"";
  const ex=st.excl, rob=st.robust, nFlag=(st.excluded||[]).length;
  const refRows=st.n>=MCD_MIN_N
    ? `<div class="kv"><span>全射RMSの95%区間</span><span>${st.rrCi?`${st.rrCi.lo.toFixed(1)}–${st.rrCi.hi.toFixed(1)} cm（正規分布を仮定）`:"—"}</span></div>
    <div class="kv"><span>外れ値候補を除いたRMS（参考）</span><span>${ex?`${ex.rr.toFixed(1)} cm（${st.total}本中${nFlag}本を除く）`:"—"}</span></div>
    <div class="subNoteSm">外れ値候補はMCD法の順位と検定で判定。除くと実力より小さく出るため、公式の値には使いません。</div>
    <div class="kv"><span>ロバストRMS（参考）</span><span>${rob?`${rob.rr.toFixed(1)} cm`:"—"}</span></div>
    <div class="subNoteSm">極端な着弾の影響を抑えた、まとまっている矢のばらつきの推定（再重み付けMCD）。</div>`
    : `<div class="kv"><span>外れ値候補を除いたRMS・ロバストRMS（参考）</span><span>6本以上で計算します</span></div>`;
  return `<div class="kv"><span>グルーピング中心</span><span>${cmOffsetText(st.mx,"x")} / ${cmOffsetText(st.my,"y")}</span></div>
    ${ci}
    <div class="kv"><span>グルーピング半径 (RMS・全射)</span><span>${st.rr.toFixed(1)} cm</span></div>
    <div class="kv"><span>ばらつき（±1σ）</span><span>左右 ${st.sx.toFixed(1)}cm ・ 上下 ${st.sy.toFixed(1)}cm</span></div>
    ${st.major!=null?`<div class="kv"><span>グルーピング楕円</span><span>長軸 ${st.major.toFixed(1)}cm ・ 短軸 ${st.minor.toFixed(1)}cm ・ 角度 ${st.angleDeg.toFixed(0)}°</span></div>`:""}
    <div class="kv"><span>演算信頼度</span><span>${pct(st.confidence||0)} / 全射</span></div>
    ${opts&&opts.withConfidenceNote?confidenceNoteHtml("calc"):""}
    ${refRows}
    ${nFlag?`<div class="kv"><span>外れ値候補</span><span>${nFlag}本（図の×印。全射RMSには含み、サイト判断でのみ除外）</span></div>
    <div class="kv"><span>サイト判断の中心（外れ値候補を除く）</span><span>${cmOffsetText(ex.mx,"x")} / ${cmOffsetText(ex.my,"y")}</span></div>`:""}`;
}
function cmOffsetText(v, axis){
  const a=Math.abs(v).toFixed(1);
  if(axis==="x") return v>0?`右に ${a}cm`:`左に ${a}cm`;
  return v>0?`上に ${a}cm`:`下に ${a}cm`;
}
function pct(v){ return `${Math.round(v*100)}%`; }
function num(v){ const n=parseFloat(v); return isFinite(n)?n:null; }
function estimatedTotalArrowWeight(setup){
  const explicit=num(setup&&setup.arrowWeight);
  if(explicit!=null) return explicit;
  const gpi=num(setup&&setup.shaftGpi), len=num(setup&&setup.arrowLength);
  if(gpi==null || len==null) return null;
  const point=num(setup&&setup.pointWeight)||100;
  return gpi*len+point+27;
}
function airDensity(setup){
  const temp=num(setup&&setup.temperature);
  const tC=temp==null?15:temp;
  const tK=tC+273.15;
  const alt=clamp(num(setup&&setup.altitude)||0,-200,4000);
  const hum=clamp((num(setup&&setup.humidity)==null?50:num(setup&&setup.humidity))/100,0,1);
  const pressure=101325*Math.pow(Math.max(0.2,1-2.25577e-5*alt),5.25588);
  const sat=610.94*Math.exp((17.625*tC)/(tC+243.04));
  const vapor=clamp(hum*sat,0,pressure*.08);
  const dry=pressure-vapor;
  return clamp(dry/(287.05*tK)+vapor/(461.495*tK),.82,1.32);
}
/* 矢の抗力係数（前面積基準）。矢の抗力はシャフト表面の摩擦が支配的で（Park 2011）、前面積基準の Cd は
   長さ/直径に比例して大きくなる。基準値は φ5.6mm・29inch の矢で Cd≈2.6（乱流境界層・ポイント付きの実測、
   層流なら約1.5）。旧版は 1.0〜1.3 で、細い矢ほど小さくしていた（物理的に逆向き）ため抗力を過小評価していた */
const ARROW_CD_REF=2.6, ARROW_CD_REF_DIA_MM=5.6, ARROW_CD_REF_LEN_IN=29;
function estimateArrowCd(setup, diaMm){
  const explicit=num(setup&&setup.arrowCd);
  if(explicit!=null) return clamp(explicit,.8,4.5);
  const len=clamp(num(setup&&setup.arrowLength)||ARROW_CD_REF_LEN_IN,20,34);
  let cd=ARROW_CD_REF*(ARROW_CD_REF_DIA_MM/clamp(diaMm,3,10))*(len/ARROW_CD_REF_LEN_IN);
  const vane=normGearText(setup&&setup.vane);
  if(/FEATHER|羽根|ナチュラル/.test(vane)) cd*=1.10;
  else if(/SPIN|WING|XS|GAS PRO|KURLY|ELIVANES/.test(vane)) cd*=1.05;
  else if(/LOW|TINY|1\.5|1 5/.test(vane)) cd*=.98;
  const vh=num(setup&&setup.vaneHeight);
  if(vh!=null) cd*=1+clamp((vh-1.8)*.03,-.04,.08);
  return clamp(cd,.8,4.5);
}
function gearVariation(setup){
  const spread=num(setup&&setup.shaftSetWeightSpread);
  const straight=num(setup&&setup.shaftStraightness);
  const foc=num(setup&&setup.foc);
  const nock=normGearText(setup&&setup.nockFit);
  let penalty=0, notes=[];
  if(spread!=null){
    const p=clamp(spread/10,0,.16); penalty+=p;
    if(spread>=4) notes.push(`矢セット重量差 ${spread}gr は上下散りの要因になり得ます。`);
  }
  if(straight!=null){
    const p=straight<=.002?.01:straight<=.004?.025:.055; penalty+=p;
    if(straight>.004) notes.push(`シャフト真直度 ${straight}inch はグルーピング評価の不確かさとして扱います。`);
  }
  if(foc!=null && (foc<9 || foc>18)){
    penalty+=.025;
    notes.push(`FOC ${foc}% は一般的なターゲット矢の中心域（9〜18%）から外れています。`);
  }
  if(/ゆる|LOOSE/.test(nock)){ penalty+=.035; notes.push("ノックフィットが緩めです。左右/上下の再現性に影響することがあります。"); }
  if(/きつ|TIGHT/.test(nock)){ penalty+=.02; notes.push("ノックフィットがきつめです。リリース時の離れに影響することがあります。"); }
  return {penalty:clamp(penalty,0,.28), confidenceFactor:clamp(1-penalty,.72,1), notes};
}
/* ブレースハイト(inch)。"8.75 inch" のような文字列も読む。15〜30 は cm 入力とみなして換算 */
function braceInches(setup){
  const b=num(setup&&setup.brace);
  if(b==null) return 8.75;
  if(b>=15&&b<=30) return b/2.54;
  return clamp(b,6,11);
}
/* 初速の推定（実測がないとき）:
   蓄積エネルギー E = q × 最大引き重量 × パワーストローク（引き尺 − 1.75inch − ブレースハイト）、
   初速 v = √(2E / (m_矢 + m_仮想))（Hickman の仮想質量モデル。重い矢ほど効率が上がる）。
   q=0.6・仮想質量 5.2g はリカーブで 40lb/28inch/320gr → 約200fps になる値。旧版は引き尺全体を
   パワーストロークとして使い（ブレースハイトを無視）、効率を固定していた。弓効率(%)の入力があればそれを使う */
const POWER_STROKE_Q=0.6, BOW_VIRTUAL_MASS_KG=0.0052;
function physicsProfile(setup){
  const p=num(setup&&setup.poundage);
  const drawIn=num(setup&&setup.drawLength)||28;
  const massGr=estimatedTotalArrowWeight(setup) || (p?clamp(p*8.4,260,520):330);
  const diaIn=num(setup&&setup.arrowDia);
  const diaMm=diaIn!=null&&diaIn>=ARROW_DIA_MM_MIN&&diaIn<=ARROW_DIA_MM_MAX?diaIn:DEFAULT_ARROW_DIA_MM;
  const speedRaw=num(setup&&setup.arrowSpeed);
  const measuredSpeed=speedRaw!=null;
  const massKg=massGr*0.00006479891;
  const braceIn=braceInches(setup);
  let speedMps;
  if(measuredSpeed){
    speedMps=speedRaw>100 ? speedRaw*0.3048 : speedRaw;
  }else{
    const drawN=(p||36)*4.44822;
    const strokeM=Math.max(.2,(drawIn-1.75-braceIn)*0.0254);
    const stored=POWER_STROKE_Q*drawN*strokeM;
    const explicitEff=num(setup&&setup.bowEfficiency);
    speedMps=explicitEff!=null
      ? Math.sqrt(2*stored*clamp(explicitEff/100,.55,.92)/massKg)
      : Math.sqrt(2*stored/(massKg+BOW_VIRTUAL_MASS_KG));
  }
  speedMps=clamp(speedMps,35,95);
  const cd=estimateArrowCd(setup||{}, diaMm);
  const area=Math.PI*(diaMm/1000/2)**2;
  const rho=airDensity(setup||{});
  const variation=gearVariation(setup||{});
  return {pound:p||null, drawIn, braceIn, massGr, diaMm, speedMps, speedFps:speedMps/0.3048, measuredSpeed, cd, area, massKg, rho, variation};
}
function sessionWindSpeed(sess){
  const v=num(sess&&sess.windSpeed);
  if(v!=null) return clamp(v,0,18);
  const wx=String(sess&&sess.wx||"");
  if(/風\s*強|強風/.test(wx)) return 5;
  if(/風\s*弱|弱風/.test(wx)) return 2;
  return sess&&sess.windDir?2.5:0;
}
function windModel(sess){
  const speed=sessionWindSpeed(sess);
  const dir=String(sess&&sess.windDir||"");
  if(speed<=0) return {speed:0,down:0,side:0,variability:0,known:false,label:"無風扱い"};
  let down=0, side=0, variability=.18, known=true, label=dir||"風向未指定";
  if(/向かい/.test(dir)){ down=-speed; label="向かい風"; }
  else if(/追い/.test(dir)){ down=speed; label="追い風"; }
  else if(/左から/.test(dir)){ side=speed; label="左から"; }
  else if(/右から/.test(dir)){ side=-speed; label="右から"; }
  else if(/巻き/.test(dir)){ side=speed*.55; down=-speed*.2; variability=.55; label="巻き風"; }
  else{ side=speed*.35; variability=.45; known=false; }
  return {speed,down,side,variability,known,label};
}
function windDriftText(cm){
  const a=Math.abs(cm).toFixed(1);
  return cm>0?`右へ${a}cm`:cm<0?`左へ${a}cm`:`0.0cm`;
}
/* 照準の幾何（既定値）: アンカー時に目は矢より約10cm上、目の高さ(約1.6m)は的中心(1.3m)より約30cm上。
   近距離のサイト値はこの高低差の影響が大きい（距離に反比例する項）。 */
const EYE_ABOVE_ARROW_M=0.10, EYE_ABOVE_TARGET_M=0.30;
/* 点質量 + 相対風に対する2次抗力の3次元弾道を RK4 で積分。y0 は発射点の高さ(m) */
function simulateArrow(distM, angle, phys, wind, y0){
  wind=wind||{down:0,side:0};
  const k=0.5*phys.rho*phys.cd*phys.area/phys.massKg, dt=0.006, g=9.80665;
  let s={x:0,y:y0||0,z:0,t:0,vx:phys.speedMps*Math.cos(angle),vy:phys.speedMps*Math.sin(angle),vz:0};
  const deriv=a=>{
    const rx=a.vx-(wind.down||0), ry=a.vy, rz=a.vz-(wind.side||0);
    const rv=Math.hypot(rx,ry,rz);
    return {x:a.vx,y:a.vy,z:a.vz,t:1,vx:-k*rv*rx,vy:-g-k*rv*ry,vz:-k*rv*rz};
  };
  const add=(a,d,h)=>({x:a.x+d.x*h,y:a.y+d.y*h,z:a.z+d.z*h,t:a.t+d.t*h,vx:a.vx+d.vx*h,vy:a.vy+d.vy*h,vz:a.vz+d.vz*h});
  const mix=(a,k1,k2,k3,k4)=>{
    const h=dt/6;
    return {x:a.x+h*(k1.x+2*k2.x+2*k3.x+k4.x),y:a.y+h*(k1.y+2*k2.y+2*k3.y+k4.y),z:a.z+h*(k1.z+2*k2.z+2*k3.z+k4.z),t:a.t+dt,
      vx:a.vx+h*(k1.vx+2*k2.vx+2*k3.vx+k4.vx),vy:a.vy+h*(k1.vy+2*k2.vy+2*k3.vy+k4.vy),vz:a.vz+h*(k1.vz+2*k2.vz+2*k3.vz+k4.vz)};
  };
  let prev=s;
  for(let i=0;i<5000 && s.x<distM && s.y>-100;i++){
    prev=s;
    const k1=deriv(s), k2=deriv(add(s,k1,dt/2)), k3=deriv(add(s,k2,dt/2)), k4=deriv(add(s,k3,dt));
    s=mix(s,k1,k2,k3,k4);
  }
  if(s.x>=distM && s.x!==prev.x){
    const q=(distM-prev.x)/(s.x-prev.x);
    s={x:distM,y:prev.y+(s.y-prev.y)*q,z:prev.z+(s.z-prev.z)*q,t:prev.t+(s.t-prev.t)*q,
      vx:prev.vx+(s.vx-prev.vx)*q,vy:prev.vy+(s.vy-prev.vy)*q,vz:prev.vz+(s.vz-prev.vz)*q};
  }
  return {y:s.y,z:s.z,t:s.t,speed:Math.hypot(s.vx,s.vy,s.vz),state:s};
}
/* 距離 distM で高さ yT に当たる発射角（y0 から発射）。二分法、括れない場合は真空近似 */
function solveZeroAngle(distM, phys, wind, y0, yT){
  y0=y0||0; yT=yT||0;
  let lo=-0.05, hi=0.7;
  let yl=simulateArrow(distM,lo,phys,wind,y0).y-yT, yh=simulateArrow(distM,hi,phys,wind,y0).y-yT;
  if(!(yl<=0 && yh>=0)){
    const v=phys.speedMps, g=9.80665;
    const sn=clamp(g*distM/(v*v),-.95,.95);
    return 0.5*Math.asin(sn)+Math.atan2(yT-y0,distM);
  }
  for(let i=0;i<32;i++){
    const mid=(lo+hi)/2, ym=simulateArrow(distM,mid,phys,wind,y0).y-yT;
    if(ym>=0) hi=mid; else lo=mid;
  }
  return (lo+hi)/2;
}
/* サイトピンの位置を決める角度: 矢の発射方向と照準線（目→的中心）の角度差 α の tan。
   ピンの目盛りは s = a + b·tan(α) と線形に対応する（a,b は目盛りの原点と単位・向き。アイ〜サイト距離は b に吸収） */
function sightAngleFeature(distM, phys){
  const y0=-EYE_ABOVE_ARROW_M, yT=-EYE_ABOVE_TARGET_M;
  const th=solveZeroAngle(distM, phys, null, y0, yT);
  return Math.tan(th-Math.atan2(yT,distM));
}
function trajectoryModel(sess, setup, eyeMm){
  const distM=Math.max(5, sess.dist||70);
  const phys=physicsProfile(setup||{});
  const wind=windModel(sess||{});
  const y0=-EYE_ABOVE_ARROW_M, yT=-EYE_ABOVE_TARGET_M;
  const angle=solveZeroAngle(distM, phys, wind, y0, yT);
  const base=simulateArrow(distM, angle, phys, wind, y0);
  const dth=0.0015;
  const up=simulateArrow(distM, angle+dth, phys, wind, y0);
  const dn=simulateArrow(distM, angle-dth, phys, wind, y0);
  const sens=Math.max(distM*.55, (up.y-dn.y)/(2*dth));
  const mmPerCmV=(0.01/sens)*eyeMm;
  const mmPerCmH=(0.01/distM)*eyeMm;
  const windDriftCm=base.z*100;
  const windUncertaintyCm=Math.abs(windDriftCm)*(wind.variability||0) + (wind.speed?0.35:0);
  const has=k=>String((setup||{})[k]||"").trim();
  const modelScore=clamp(
    (phys.measuredSpeed ? .20 : .08) +
    (has("arrowWeight") ? .13 : .06) +
    (has("arrowDia") ? .11 : .05) +
    (has("arrowCd") ? .10 : .04) +
    (has("temperature") ? .07 : .03) +
    (has("altitude") ? .06 : .02) +
    (has("humidity") ? .05 : .02) +
    (wind.speed ? (wind.known ? .12 : .06) : .08),
    0,1
  );
  return {phys, wind, angle, tof:base.t, impactSpeed:base.speed, sens, mmPerCmV, mmPerCmH, windDriftCm, windUncertaintyCm, modelScore, engine:"RK4-3D"};
}
const ArcheryPhysicsCore=Object.freeze({
  version:"RK4-3D JS core",
  trajectory:trajectoryModel,
  physicsProfile,
  windModel,
  robustStats,
  groupStats
});
if(typeof window!=="undefined") window.ArcheryPhysicsCore=ArcheryPhysicsCore;
function weightedMedian(items, fallback){
  const a=items.filter(x=>x&&isFinite(x.v)&&isFinite(x.w)&&x.w>0).sort((x,y)=>x.v-y.v);
  if(!a.length) return fallback==null?null:fallback;
  const half=a.reduce((s,x)=>s+x.w,0)/2;
  let c=0;
  for(const x of a){ c+=x.w; if(c>=half) return x.v; }
  return a[a.length-1].v;
}
function levelFromScore(score, tiers){
  const s=clamp(score||0,0,1);
  return tiers.find(t=>s>=t.min).label;
}
const LEVELS={
  physics:[{min:.72,label:"校正安定"},{min:.45,label:"データ充実"},{min:.22,label:"データ蓄積中"},{min:0,label:"未校正"}],
  data:[{min:.72,label:"高"},{min:.45,label:"中"},{min:0,label:"データ蓄積中"}],
  calibration:[{min:.72,label:"高"},{min:.42,label:"中"},{min:0,label:"データ蓄積中"}],
  system:[{min:.72,label:"提案安定"},{min:.45,label:"データ充実"},{min:.22,label:"データ蓄積中"},{min:0,label:"準備中"}]
};
const PCAL_CACHE=new Map();
/* 校正はセッション横断のRK4連鎖を含み重いので、db更新時刻をキーにメモ化する */
function personalPhysicsCalibration(setupId){
  if(!setupId) return null;
  const key=[setupId,db.updatedAt||"",db.sessions.length,db.sightMarks.length].join("|");
  if(PCAL_CACHE.has(key)) return PCAL_CACHE.get(key);
  const out=computePersonalPhysicsCalibration(setupId);
  PCAL_CACHE.set(key,out);
  if(PCAL_CACHE.size>8) PCAL_CACHE.delete(PCAL_CACHE.keys().next().value);
  return out;
}
function computePersonalPhysicsCalibration(setupId){
  const setup=db.setups.find(s=>s.id===setupId);
  if(!setup) return null;
  const eye=db.settings.eyeSight||850;
  /* 位置のある矢が1本もない記録（点数だけの入力）は、校正の対象にも新しさの順位にも入れない */
  const sessions=db.sessions.filter(s=>s.setupId===setupId && sessionHasPos(s))
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.id>b.id?1:-1));
  const usable=sessions.map((s,i)=>{
    const q=sessionQuality(s,setup);
    const st=q&&q.metrics?sightStats(q.metrics.st):null;
    if(!st || st.n<6) return null;
    const recency=.72+(i+1)/Math.max(1,sessions.length)*.28;
    return {s,st,q,w:clamp(q.score*recency,.05,1)};
  }).filter(Boolean);
  const windRatios=[], windConflicts=[];
  const trajMemo=new Map(); /* 同じ距離・風の記録は弾道を1回だけ計算する */
  usable.forEach(it=>{
    const wm=windModel(it.s);
    if(!wm.speed || !wm.side) return;
    const tk=[it.s.dist,it.s.windSpeed,it.s.windDir,it.s.wx].join("|");
    if(!trajMemo.has(tk)) trajMemo.set(tk, trajectoryModel(it.s,setup,eye));
    const traj=trajMemo.get(tk);
    /* 70mでは横風3m/sでも横流れがリング4本分を超えるため、リング幅ではなく観測/予測の比で外れを除く */
    if(Math.abs(traj.windDriftCm)<.6) return;
    const ratio=it.st.mx/traj.windDriftCm;
    if(ratio>0 && ratio<2.6) windRatios.push({v:ratio,w:it.w,id:it.s.id,date:it.s.date});
    else if(Math.abs(it.st.mx)>ringW(it.s.faceD,it.s.faceType)*.35) windConflicts.push(it);
  });
  const clickV=[], clickH=[];
  [...new Set(sessions.map(s=>s.dist).filter(Boolean))].forEach(d=>{
    const r=regressionAdvice(setupId,d);
    if(r.v && isFinite(r.v.slope) && Math.abs(r.v.slope)>.05) clickV.push({v:Math.abs(r.v.slope)*70/d,w:clamp(r.v.quality||r.v.r2||.2,.05,1)});
    if(r.h && isFinite(r.h.slope) && Math.abs(r.h.slope)>.05) clickH.push({v:Math.abs(r.h.slope)*70/d,w:clamp(r.h.quality||r.h.r2||.2,.05,1)});
  });
  const sightMarks=db.sightMarks.filter(m=>m.setupId===setupId && isFinite(parseFloat(m.v)));
  const markPts=sightMarks.map(m=>[m.dist, parseFloat(m.v)]).filter(p=>isFinite(p[0])&&isFinite(p[1]));
  const sightFit=markPts.length>=2 ? robustLine(markPts) : null;
  const windFactor=weightedMedian(windRatios,1);
  const v70=weightedMedian(clickV,null), h70=weightedMedian(clickH,null);
  const hasSetup=k=>String((setup||{})[k]||"").trim();
  const score=clamp(
    Math.min(usable.length,12)*.035 +
    Math.min(windRatios.length,6)*.055 +
    Math.min(clickV.length+clickH.length,8)*.045 +
    Math.min(new Set(markPts.map(p=>p[0])).size,5)*.055 +
    (hasSetup("arrowSpeed") ? .12 : .03) +
    (hasSetup("arrowWeight") ? .08 : .03),
    0,1
  );
  const level=levelFromScore(score, LEVELS.physics);
  const notes=[];
  if(windRatios.length) notes.push(`風効き ${windFactor.toFixed(2)}倍（横風${windRatios.length}回）`);
  if(v70!=null||h70!=null) notes.push(`目盛り効き ${v70!=null?`上下${v70.toFixed(1)}cm@70m`:""}${v70!=null&&h70!=null?" / ":""}${h70!=null?`左右${h70.toFixed(1)}cm@70m`:""}`);
  if(sightFit) notes.push(`距離別サイト値 ${markPts.length}点 / 一致度${pct(sightFit.r2||0)}`);
  if(!notes.length) notes.push("サイト値つき練習・横風メモ・複数距離の台帳が増えるほど校正されます。");
  return {score,level,usable:usable.length,wind:{factor:windFactor,sample:windRatios.length,conflicts:windConflicts.length,items:windRatios},click:{v70,h70,vSample:clickV.length,hSample:clickH.length},sight:{n:markPts.length,r2:sightFit?sightFit.r2:0},notes};
}
function physicsCalibrationHtml(setupId){
  const c=personalPhysicsCalibration(setupId);
  if(!c) return "";
  const color=c.level==="校正安定"?"var(--status-ok)":c.level==="未校正"?"var(--status-hold)":"var(--blue)";
  return `<div class="advice analysisAdviceCard">
    <div class="note"><b style="color:${color}">物理校正: ${c.level}</b>（${pct(c.score)}）</div>
    <div class="kv"><span>校正材料</span><span>有効練習 ${c.usable}回 / 風 ${c.wind.sample}回 / サイト値 ${c.sight.n}点</span></div>
    ${c.notes.map(n=>`<div class="note">・${esc(n)}</div>`).join("")}
  </div>`;
}
/* サイト調整の判定（統計）。旧版の「しきい値=リング幅/8 と RMS の10%」は本数を無視しており、
   中心が合っていても6本で約9割「動かせ」と出ていた。ここでは:
   1) 中心のズレを Hotelling T² で同時検定し（偶然でこれだけずれる確率 p < 5%）、さらに軸ごとに
      95%区間がゼロを含まない軸だけを動かす（閉検定。合っている軸を巻き添えで動かさない）
   2) 動かす量は軸ごとの縮小推定 adj = m·(1 − SE²/m²)（誤差の大きいズレほど控えめ）
   3) リング幅の1/10未満の補正は実用上動かさない
   4) 横風（風向と風速が分かるとき）は、風上へねらいを修正したかが記録から分からないため推定横流れを
      差し引かず、横流れの大きさ全体を左右の誤差として加える（風の日は左右を動かしにくくする）。
      個人の風係数は、判定中の回と同じ日を除いた3回以上の横風の記録があるときだけ使う */
/* 個人の風係数（観測横ズレ/予測横流れの加重中央値）。判定・表示している回と同じ日の記録は除き、
   残りが3回以上あるときだけ使う（自分自身で校正しない） */
function personalWindFactor(sess, pcal){
  const others=((pcal&&pcal.wind&&pcal.wind.items)||[]).filter(r=>r.id!==(sess&&sess.id) && r.date!==(sess&&sess.date));
  return others.length>=3?weightedMedian(others,1):1;
}
function sightDecision(sess, st, traj, pcal){
  st=sightStats(st); /* 外れ値候補を除いた統計（B）。外れ矢でサイトを動かさない */
  const w=ringW(sess.faceD,sess.faceType);
  const th=w/10;
  let windCm=0, windUnc=0, windAccounted=false, windFactor=1;
  const wind=traj&&traj.wind;
  if(wind && wind.speed && wind.known && wind.side){
    windFactor=personalWindFactor(sess, pcal);
    windCm=traj.windDriftCm*windFactor;
    windUnc=Math.hypot(windCm, traj.windUncertaintyCm);
    windAccounted=true;
  }
  const test=centerOffsetTest(st, st.mx, st.my, windUnc*windUnc);
  const seX=Math.sqrt(st.seX*st.seX+windUnc*windUnc);
  const h=axisCorrection(st.mx, seX, st.df), v=axisCorrection(st.my, st.seY, st.df);
  const significant=!!(test.testable && test.p<.05);
  h.move=significant && Math.abs(h.m)>h.ci && Math.abs(h.adj)>=th;
  v.move=significant && Math.abs(v.m)>v.ci && Math.abs(v.adj)>=th;
  const precise=Number.isFinite(h.ci)&&Number.isFinite(v.ci)&&h.ci<=w/2&&v.ci<=w/2;
  return {h, v, test, significant, precise, th, w, windCm, windUnc, windAccounted, windFactor,
    windUnknown:!!(wind && wind.speed && !wind.known)};
}
function adviceModel(sess, setup, st){
  const eye=(db.settings.eyeSight||850);
  const traj=trajectoryModel(sess, setup, eye);
  const pcal=personalPhysicsCalibration(setup&&setup.id);
  const decision=sightDecision(sess, st, traj, pcal);
  const gear=gearVariation(setup||{});
  const notes=[];
  const ss=sightStats(st);
  notes.push(`サイト判断の中心は${cmOffsetText(ss.mx,"x")}（±${decision.h.ci.toFixed(1)}cm）・${cmOffsetText(ss.my,"y")}（±${decision.v.ci.toFixed(1)}cm）、95%区間。${ss.n}本使用${st.excluded.length?` / 外れ値候補${st.excluded.length}本を除く`:""}。偶然でこれだけずれる確率は ${fmtChance(decision.test.p)}。`);
  if(decision.windAccounted) notes.push(`風: ${traj.wind.label} ${traj.wind.speed.toFixed(1)}m/sで横流れ推定 ${windDriftText(decision.windCm)}${decision.windFactor!==1?`（個人係数${decision.windFactor.toFixed(2)}倍）`:""}。風上へのねらい修正の有無が分からないため、この大きさを左右の誤差として扱っています。`);
  else if(decision.windUnknown) notes.push("風向が分からないため、風の横流れは見込んでいません。左右の判断は風待ちで再確認すると確実です。");
  notes.push(`物理エンジン: ${traj.engine}（3D空気抵抗/RK4）。初速 ${traj.phys.speedFps.toFixed(0)}fps${traj.phys.measuredSpeed?"（実測）":"（推定）"}、矢重量 ${traj.phys.massGr.toFixed(0)}gr、Cd ${traj.phys.cd.toFixed(2)}、空気密度 ${traj.phys.rho.toFixed(2)}kg/m³、飛翔 ${traj.tof.toFixed(2)}秒。mm換算はアイ〜サイト ${eye}mm と弾道の感度から計算。`);
  if(pcal && pcal.score>.2) notes.push(`個人校正: ${pcal.level}（${pct(pcal.score)}）。${pcal.notes.slice(0,2).join(" / ")}`);
  if(setup&&setup.id){
    /* 過去のサイト値と着弾中心の回帰（逆分散加重）で推定した「ズレ0になるサイト値」。参考表示のみで補正量には掛けない */
    const reg=regressionAdvice(setup.id, sess.dist);
    [["v","上下",num(sess.sightV)],["h","左右",num(sess.sightH)]].forEach(([k,label,cur])=>{
      const r=reg[k];
      if(r) notes.push(`過去${r.n}回のサイト値とズレの回帰では、${label}サイト ${r.zero.toFixed(1)} でズレ0${cur!=null?`（現在との差 ${(r.zero-cur).toFixed(1)}）`:""}。一致度 ${pct(r.r2||0)}。`);
    });
  }
  gear.notes.forEach(n=>notes.push(n));
  if(st.n<6) notes.push("本数が少ないため誤差の幅が大きく、動かす判定が出にくくなっています。");
  if(st.major && st.minor>0 && st.major>st.minor*1.7) notes.push(`楕円長軸が短軸の ${(st.major/st.minor).toFixed(1)}倍あります。中心の補正とは別に、散る方向の原因も確認してください。`);
  return {decision, notes, traj, pcal};
}
function sightClickText(adj, dist, setup, pcal, axis){
  const calib=axis==="v"?num(setup&&setup.calibV70):num(setup&&setup.calibH70);
  if(calib) return {clicks:adj/(calib*dist/70), label:"クリック"};
  const est=pcal&&pcal.click&&(axis==="v"?pcal.click.v70:pcal.click.h70);
  if(est) return {clicks:adj/(est*dist/70), label:"目盛り（履歴推定）"};
  return null;
}
function adviceFor(sess, setup){
  const st=sessionMetrics(sess).st;
  if(!st || st.n<3) return null;
  const dist=sess.dist;
  const model=adviceModel(sess, setup, st);
  const d=model.decision;
  const personal=personalModel(sess, setup, st);
  const quality=sessionQuality(sess, setup, st);
  const out={st, lines:[], notes:model.notes, confidence:quality.score, personal, quality, pcal:model.pcal, decision:d, traj:model.traj};
  if(personal && personal.sample>=2) out.notes.unshift(`個人モデル: ${personal.state}（同じサイト設定 ${personal.sample}回 / 安定度${pct(personal.stability||0)}）。`);
  if(quality.score<.48) out.notes.unshift(`この回の判断信頼度は${quality.label}です。${quality.reasons.join("・")}。`);
  const axisLine=(axis)=>{
    const a=d[axis];
    const adj=Math.abs(a.adj);
    const mm=adj*(axis==="v"?model.traj.mmPerCmV:model.traj.mmPerCmH);
    const dir=axis==="v"?(a.m>0?"上":"下"):(a.m>0?"右":"左");
    const off=axis==="v"?cmOffsetText(a.m,"y"):cmOffsetText(a.m,"x");
    const subject="中心は";
    let l=`サイトを<b>${dir}</b>へ（${subject}${off} ±${a.ci.toFixed(1)}cm${a.shrink<.95?`、誤差を見込みズレの${pct(a.shrink)}で計算`:""}） — 目安 ${mm.toFixed(1)}mm`;
    const ck=sightClickText(adj, dist, setup, model.pcal, axis);
    if(ck) l+=` ≒ ${ck.clicks.toFixed(1)}${ck.label}`;
    const cur=axis==="v"?sess.sightV:sess.sightH;
    if(cur) l+=` <span class="subNoteSm">現在 ${esc(cur)}</span>`;
    return {axis, html:l};
  };
  if(d.v.move) out.lines.push(axisLine("v"));
  if(d.h.move) out.lines.push(axisLine("h"));
  if(!out.lines.length){
    out.lines.push({axis:"-", html:d.precise
      ? (d.significant?"中心のズレは小さく（リング幅の1/10未満）、<b>サイト調整は不要</b>です。":"グルーピング中心は誤差の範囲内でセンターです。<b>サイト調整は不要</b>です。")
      : `ズレはまだ誤差の範囲です（95%区間 左右±${d.h.ci.toFixed(1)}cm・上下±${d.v.ci.toFixed(1)}cm）。<b>サイトは触らず</b>本数を重ねて確認します。`});
  }
  return out;
}
/* サイトタブの「いまの提案」表示専用の整形（adviceFor の判定結果を読むだけ。量・方向は再計算しない）。
   上下と左右の両方に動きがある場合は補正量の大きい軸を主提案に選ぶ */
function primarySightSuggestion(sess, setup, adv){
  if(!adv) return null;
  const d=adv.decision;
  const moves=adv.lines.filter(l=>l.axis!=="-").map(l=>l.axis);
  if(!moves.length || !d){
    const j0=d?judgementFor(adv, sess):null;
    if(j0 && j0.label==="風を考慮") return {axis:"-", none:true, reason:"wind"};
    return {axis:"-", none:true, reason:d&&!d.precise?"uncertain":"centered"};
  }
  const j=judgementFor(adv, sess);
  if(j && j.label==="風を考慮") return {axis:"-", none:true, reason:"wind"};
  if(j && j.label==="保留") return {axis:"-", none:true, reason:adv.personal&&adv.personal.state==="今回だけの可能性"?"history":"uncertain"};
  const axis=moves.length>1?(Math.abs(d.v.adj)>=Math.abs(d.h.adj)?"v":"h"):moves[0];
  const a=d[axis], adj=Math.abs(a.adj);
  const mm=adj*(axis==="v"?adv.traj.mmPerCmV:adv.traj.mmPerCmH);
  const ck=sightClickText(adj, sess.dist, setup, adv.pcal, axis);
  const clickLabel=ck?(ck.label==="クリック"?"クリック":"目盛り（推定）"):null;
  if(axis==="v") return {axis, dir:a.m>0?"up":"down", dirLabel:a.m>0?"上":"下", mm, clicks:ck?ck.clicks:null, clickLabel, other:moves.length>1};
  return {axis, dir:a.m>0?"right":"left", dirLabel:a.m>0?"右":"左", mm, clicks:ck?ck.clicks:null, clickLabel, other:moves.length>1};
}
function summarySightDialHtml(sess, adv){
  if(!adv || !adv.st) return "";
  const st=sightStats(adv.st);
  const span=Math.max(ringW(sess.faceD,sess.faceType)*2.4, st.rr*1.4, 6);
  const dx=clamp(st.mx/span,-1,1)*36;
  const dy=clamp(-st.my/span,-1,1)*36;
  const move=adv.lines.some(l=>l.axis!=="-");
  const label=`${cmOffsetText(st.mx,"x")} / ${cmOffsetText(st.my,"y")}`;
  return `<div class="sightMiniDial">
    <div class="dialGrid">
      <svg viewBox="0 0 110 110" aria-hidden="true">
        <circle class="ring" cx="55" cy="55" r="48"/>
        <circle class="ring dialRingInner" cx="55" cy="55" r="30"/>
        <line class="axis" x1="10" y1="55" x2="100" y2="55"/>
        <line class="axis" x1="55" y1="10" x2="55" y2="100"/>
        <line class="vector" x1="55" y1="55" x2="${(55+dx).toFixed(1)}" y2="${(55+dy).toFixed(1)}"/>
        <circle class="originDot" cx="55" cy="55" r="3.5"/>
        <circle class="groupDot" cx="${(55+dx).toFixed(1)}" cy="${(55+dy).toFixed(1)}" r="7"/>
      </svg>
      <div>
        <b>${move?"中心ズレからサイト方向を読む":"中心はほぼ合っています"}</b>
        <span>緑の点が今回のグルーピング中心です。${label}。判断信頼度は ${pct(adv.confidence||0)}、外れ値候補を除いた中心を使っています。</span>
      </div>
    </div>
  </div>`;
}
function windText(sess){
  const parts=[];
  if(sess.wx) parts.push(sess.wx);
  if(sess.windDir) parts.push(sess.windDir);
  if(sess.windSpeed) parts.push(`${sess.windSpeed}m/s`);
  return parts.join(" / ");
}
function isWindy(sess){
  const ws=num(sess&&sess.windSpeed);
  return /風 強/.test(sess&&sess.wx||"") || (ws!=null && ws>=3.5);
}
function judgementFor(adv,sess){
  if(!adv) return null;
  const st=adv.st, w=ringW(sess.faceD,sess.faceType);
  const d=adv.decision;
  const moves=adv.lines.filter(l=>l.axis!=="-");
  const ciText=d?`95%区間 左右±${d.h.ci.toFixed(1)}cm・上下±${d.v.ci.toFixed(1)}cm`:"";
  if(!moves.length){
    if(d && d.windAccounted && !d.precise && Math.abs(d.windCm)>w*.25) return {label:"風を考慮",tone:"hold",text:`横風で約${Math.abs(d.windCm).toFixed(0)}cm流れる条件です。風上へのねらい修正の有無が記録から分からないため、左右のサイトは動かさず、風待ちか無風の日に確認します。`};
    if(!d || d.precise) return {label:"維持",tone:"ok",text:d&&d.significant?`中心のズレは小さく（リング幅の1/10未満、${ciText}）、サイトは触らずに本数を重ねられます。`:`中心のズレは誤差の範囲内です${ciText?`（${ciText}）`:""}。サイトは触らず、この基準で本数を重ねられます。`};
    return {label:"保留",tone:"hold",text:`中心をまだ絞り込めていません（${ciText}）。同じ狙いで1〜2エンド追加してから判断します。`};
  }
  if(adv.personal && adv.personal.state==="今回だけの可能性" && (adv.personal.stability||0)>.45) return {label:"保留",tone:"hold",text:"同じサイト設定の過去の傾向と今回の中心が逆方向です。まず追加エンドで再現性を確認します。"};
  if(st.rr>w*2.8) return {label:"射形優先",tone:"warn",text:"中心のズレは読めますが散りが大きめです。サイトは提案量だけにとどめ、リリース・押し手・照準の再現性を先に見ます。"};
  if(isWindy(sess) && d && !d.windAccounted && moves.some(l=>l.axis==="h") && !moves.some(l=>l.axis==="v")) return {label:"風を考慮",tone:"hold",text:"左右のズレに風の影響が混ざっている可能性があります。風向・風速を記録するか、無風・風待ちで再確認すると精度が上がります。"};
  if(adv.personal && adv.personal.state==="過去と一致") return {label:"動かす",tone:"ok",text:"今回の中心と、同じサイト設定の過去の傾向が一致しています。提案量を目安に動かす根拠があります。"};
  const shrinks=d?moves.map(l=>d[l.axis].shrink):[1];
  if(Math.min(...shrinks)>=.85) return {label:"動かす",tone:"ok",text:`中心のズレが誤差を超えています（偶然でこれだけずれる確率 ${fmtChance(d?d.test.p:NaN)}）。提案量を目安に動かせます。`};
  return {label:"少量調整",tone:"mid",text:"ズレは誤差を超えていますが、推定にまだ幅があります。提案量は誤差を見込んで控えめに計算済みなので、その量で動かして次のエンドで確認します。"};
}
function judgementHtml(adv,sess){
  const j=judgementFor(adv,sess);
  if(!j) return "";
  const color=j.tone==="ok"?"var(--status-ok)":j.tone==="warn"?"var(--status-warn)":"var(--status-hold)";
  return `<div class="note analysisMt6"><b style="color:${color}">判断: ${j.label}</b> — ${esc(j.text)}</div>`;
}
function summaryDecisionHtml(adv,sess){
  const j=judgementFor(adv,sess);
  if(!j) return "";
  const tone=j.tone==="ok"?"ok":j.tone==="warn"?"warn":"hold";
  const move=adv && adv.lines ? adv.lines.filter(l=>l.axis!=="-").length : 0;
  const reason=move
    ? "方向と量は下に出ます。先に、動かす根拠が十分かを確認します。"
    : "動かさない理由を先に見て、同じ条件で本数を重ねます。";
  return `<div class="decisionCard ${tone}">
    <div class="k">動かすべきか</div>
    <span class="decisionQuestion">サイトを触る前の判断</span>
    <b>${esc(j.label)}</b>
    <p>${esc(j.text)}</p>
    <span>${reason}</span>
  </div>`;
}
function conditionInsights(sess,st,setup){
  const out=[];
  const wind=windText(sess);
  if(wind) out.push(`条件メモ: ${esc(wind)}${sess.note?` / ${esc(sess.note)}`:""}`);
  if(setup && (setup.tuningMethod||setup.tuningResult)){
    out.push(`チューニング記録: ${esc([setup.tuningMethod,setup.tuningResult].filter(Boolean).join(" / "))}`);
  }
  if(st){
    const wm=windModel(sess||{});
    if(wm.speed){
      const traj=trajectoryModel(sess,setup||{},db.settings.eyeSight||850);
      const pc=personalPhysicsCalibration(setup&&setup.id);
      const wf=personalWindFactor(sess, pc);
      out.push(`風の物理推定: ${wm.label} ${wm.speed.toFixed(1)}m/sで、横流れは${windDriftText(traj.windDriftCm*wf)}前後（±${traj.windUncertaintyCm.toFixed(1)}cm${wf!==1?` / 個人係数${wf.toFixed(2)}倍`:""}）として扱います。`);
    }
    if(analysisHasGroupingEvidence(st)){
      if(isWindy(sess) && Math.abs(st.mx)>ringW(sess.faceD,sess.faceType)*.35) out.push("風のある回なので、左右ズレはサイトだけでなく風待ち・エイミング時間も一緒に記録してください。");
      const direction=analysisSpreadDirection(st,1.35,true);
      if(direction==="vertical") out.push("次の重点: 上下の再現性。引き尺、アンカーの高さ、リリース圧の変化を1項目ずつ確認。");
      else if(direction==="horizontal") out.push("次の重点: 左右の再現性。風、ボウハンド、プランジャー、センターショットの順に切り分け。");
      else if(st.rr<ringW(sess.faceD,sess.faceType)*1.2) out.push("次の重点: グルーピングは良好。中心ズレだけを小さく補正し、同じ条件で再確認。");
    }
    if(setup && !setup.arrowSpeed) out.push("精度向上: 実測初速を入れると、上下サイトのmm換算と距離別予測が安定します。");
    if(setup && !setup.shaftSetWeightSpread) out.push("精度向上: 矢セット重量差を入れると、上下散りの信頼度判定が強くなります。");
    const sp=setup?spineGuidance(setup):null;
    if(sp && sp.ready && (sp.state==="柔らかめ寄り" || sp.state==="硬め寄り")) out.push(`用具確認: スパインが${sp.state}です。候補 ${sp.candidates.slice(0,3).join(" / ")} と矢飛びを比較してください。`);
  }
  if(sess.round && sess.round!=="free") out.push(`ラウンド: ${esc(roundLabel(sess.round))} の途中/結果として扱っています。`);
  return out;
}
function conditionHtml(sess,st,setup){
  const notes=conditionInsights(sess,st,setup).slice(0,4);
  return notes.length?`<div class="advice analysisAdviceCard">${notes.map(n=>`<div class="note">・${n}</div>`).join("")}</div>`:"";
}
/* 記録ごとに最新結果だけを保持。長い履歴の巡回で固定件数キャッシュが全件ミスに
   なるのを防ぎ、削除・置換された記録は WeakMap により回収可能にする。 */
const SESSION_METRIC_CACHE=new WeakMap();
function sessionMetricSignature(sess){
  const ends=(sess&&sess.ends)||[];
  let n=0,total=0,xs=0,ys=0,last="";
  ends.forEach((end,ei)=>end.forEach((a,ai)=>{
    /* 入力防御: 文字列座標/点数が混じっても文字列連結で署名生成が壊れないよう Number 化 */
    n++; total+=Number(a&&a.s)||0; xs+=Number(a&&a.x)||0; ys+=Number(a&&a.y)||0;
    if(ei===ends.length-1 && ai===end.length-1) last=[a.x,a.y,a.s,a.X?1:0,a.spot==null?"":a.spot].join(":");
  }));
  /* DB_REV: db変異（save/scheduleSave）ごとに増える世代カウンタ。署名衝突（例: 2本を逆方向に同距離ナッジ）でも編集保存後に必ず再計算させる */
  return [typeof DB_REV==="number"?DB_REV:0,sess&&sess.id||"",sess&&sess.date||"",sess&&sess.dist||"",sess&&sess.faceD||"",sess&&sess.faceType||"single",ends.length,n,total,xs.toFixed(2),ys.toFixed(2),last].join("|");
}
function sessionMetrics(sess){
  const sig=sessionMetricSignature(sess||{});
  const cached=SESSION_METRIC_CACHE.get(sess);
  if(cached && cached.signature===sig) return cached.metrics;
  const all=(sess.ends||[]).flat();
  const total=all.reduce((a,x)=>a+x.s,0);
  /* 統計入力の防御: groupingSessionRow と同じ Number 化＋有限フィルタ（total/avg は従来どおり s ベース） */
  /* 座標のない矢（点数だけの入力・「M 位置なし」。x/y が無いか null）は統計に入れない。null を 0 と読まない */
  const pts=all.filter(arrowHasPos).map(a=>({x:Number(a.x),y:Number(a.y)})).filter(a=>Number.isFinite(a.x)&&Number.isFinite(a.y));
  const st=robustStats(pts);
  const metrics={all,total,avg:all.length?total/all.length:0,st,pts};
  SESSION_METRIC_CACHE.set(sess,{signature:sig,metrics});
  return metrics;
}
/* 判断信頼度: グルーピング中心の推定値が真の中心からリング幅の半分以内にある確率（左右×上下）。
   旧版は信頼度・本数・広さの重み付き和に経験的な掛け目を重ねたもので、統計的な意味がなかった。
   理由（風・外れ値・広さ・本数）は説明として並べるだけで、数値に掛け目はかけない */
function sessionQuality(sess, setup, st){
  const m=sessionMetrics(sess);
  st=st||m.st;
  if(!st || !(st.n>=2)) return {score:.05,label:"低",tone:"warn",reasons:["矢数が不足"],metrics:m};
  const all=st;
  st=sightStats(st); /* 中心の精度は外れ値候補を除いた統計（B）、「広め」の理由は全射（A） */
  const w=ringW(sess.faceD,sess.faceType);
  const tol=w/2;
  /* 標本が少ないと標準誤差そのものが不確かなので t/1.96 倍で補い、全矢同一点などで広がりが0にならないよう
     ばらつきの下限をリング幅の1/4（上級者でも±1σがリング半分程度）とする（少数のまとまった矢で100%「高」などを防ぐ） */
  const k=tCrit975(st.df)/1.96, floorSe=(w/4)/Math.sqrt(st.n);
  const score=clamp(probWithin(tol, Math.max(st.seX,floorSe)*k)*probWithin(tol, Math.max(st.seY,floorSe)*k),0,1);
  const outRate=all.total?(all.excluded||[]).length/all.total:0;
  const reasons=[];
  if(st.n<6) reasons.push("本数少なめ");
  if(all.rr>w*2.6) reasons.push("グルーピング広め");
  if(outRate>.18) reasons.push("外れ値が多め");
  if(isWindy(sess)) reasons.push("風の影響あり");
  const label=score>=.72?"高":score>=.48?"中":"低";
  const tone=score>=.72?"ok":score>=.48?"mid":"warn";
  if(!reasons.length) reasons.push("判断材料は良好");
  return {score,label,tone,reasons,metrics:m};
}
function dirAlign(ax,ay,bx,by){
  const am=Math.hypot(ax,ay), bm=Math.hypot(bx,by);
  if(am<.01||bm<.01) return 0;
  return clamp((ax*bx+ay*by)/(am*bm),-1,1);
}
/* 回ごとの中心を、回の中の誤差（標準誤差）と日ごとのばらつき τ² の両方で重み付けして平均する
   （DerSimonian–Laird のランダム効果モデル）。回の中の誤差だけで重み付けすると、日ごとに中心が揺れる
   アーチャーで過去の傾向を「有意」と誤判定する */
function pooledRandomEffects(vals, ses){
  const w=ses.map(s=>1/Math.max(1e-4,s*s));
  const sw=w.reduce((a,b)=>a+b,0);
  const fixed=vals.reduce((a,v,i)=>a+v*w[i],0)/sw;
  const q=vals.reduce((a,v,i)=>a+w[i]*(v-fixed)**2,0);
  const c=sw-w.reduce((a,b)=>a+b*b,0)/sw;
  const tau2=c>0?Math.max(0,(q-(vals.length-1))/c):0;
  const ws=ses.map(s=>1/(Math.max(1e-4,s*s)+tau2));
  const sws=ws.reduce((a,b)=>a+b,0);
  return {mean:vals.reduce((a,v,i)=>a+v*ws[i],0)/sws, se:Math.sqrt(1/sws), tau2};
}
/* 同じサイト設定どうしの比較。サイトを動かした前後の着弾中心は比べられないため、
   上下・左右のサイト値の記録が今回と同じ（どちらも未記録を含む）過去の同条件セッションだけを使う */
function sightKey(v){ return String(v==null?"":v).normalize("NFKC").replace(/\s+/g,"").trim(); }
function personalModel(sess,setup,currentSt){
  if(!sess || !currentSt) return null;
  currentSt=sightStats(currentSt);
  const sv=sightKey(sess.sightV), sh=sightKey(sess.sightH);
  const same=db.sessions.filter(s=>s.id!==sess.id && (s.setupId||"")==(sess.setupId||"") && s.dist===sess.dist && s.faceD===sess.faceD && (s.faceType||"single")===(sess.faceType||"single") && sightKey(s.sightV)===sv && sightKey(s.sightH)===sh)
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.id>b.id?1:-1))
    .slice(-10);
  const items=same.map(s=>{
    const all=sessionMetrics(s).st, st=sightStats(all);
    return st && st.n>=3 && Number.isFinite(st.seX) && Number.isFinite(st.seY) ? {sess:s,st,all} : null;
  }).filter(Boolean);
  const sightNote=sv||sh?"同じサイト値":"サイト値未記録どうし";
  if(items.length<2) return {sample:items.length,state:"データ蓄積中",text:`${sightNote}の同条件データがまだ少ないため、今回の記録を個人モデルの材料として蓄積します。`};
  const px=pooledRandomEffects(items.map(it=>it.st.mx), items.map(it=>it.st.seX));
  const py=pooledRandomEffects(items.map(it=>it.st.my), items.map(it=>it.st.seY));
  const mx=px.mean, my=py.mean, seMx=px.se, seMy=py.se;
  const rr=items.reduce((a,it)=>a+it.all.rr,0)/items.length;
  const avg=items.reduce((a,it)=>a+sessionMetrics(it.sess).avg,0)/items.length;
  const centers=items.map(it=>({x:it.st.mx,y:it.st.my}));
  const spread=groupStats(centers);
  const ring=ringW(sess.faceD,sess.faceType);
  const histMag=Math.hypot(mx,my), curMag=Math.hypot(currentSt.mx,currentSt.my);
  const align=dirAlign(mx,my,currentSt.mx,currentSt.my);
  const stability=spread?clamp(1-spread.rr/(ring*2.4),0,1):.5;
  /* 過去平均のズレが自身の誤差の2倍を超え（有意）、今回も同じ向きなら「一致」 */
  const histSignificant=Math.hypot(mx/seMx,my/seMy)>2.45;
  const curMeaningful=curMag>ring*.1;
  const support=histSignificant && curMeaningful && align>.42;
  const conflict=histSignificant && curMeaningful && align<-.25;
  const state=support?"過去と一致":conflict?"今回だけの可能性":"観察継続";
  let text;
  if(support) text=`${sightNote}の過去の同条件でも同じ方向へ寄っています。サイト調整の根拠が強くなります。`;
  else if(conflict) text=`${sightNote}の過去の偏りと今回の中心が逆方向です。風や射形の一時要因を疑い、追加エンドで確認する価値があります。`;
  else text="過去傾向はまだ決定的ではありません。今回の中心とグルーピング形状を主材料にします。";
  return {sample:items.length,state,text,mx,my,seMx,seMy,rr,avg,align,stability,spread,histMag,curMag};
}
function personalModelHtml(adv,sess,setup){
  if(!adv || !adv.personal) return "";
  const p=adv.personal;
  const tone=p.state==="過去と一致"?"var(--status-ok)":p.state==="今回だけの可能性"?"var(--status-warn)":"var(--status-hold)";
  if(p.sample<2) return `<div class="advice analysisAdviceCard"><div class="note"><b>個人モデル: データ蓄積中</b> — ${esc(p.text)}</div></div>`;
  return `<div class="advice analysisAdviceCard">
    <div class="note"><b style="color:${tone}">個人モデル: ${p.state}</b> — ${esc(p.text)}</div>
    <div class="kv"><span>過去の加重中心</span><span>${cmOffsetText(p.mx,"x")} / ${cmOffsetText(p.my,"y")}</span></div>
    <div class="kv"><span>同条件データ</span><span>${p.sample}回 / 安定度 ${pct(p.stability)}</span></div>
  </div>`;
}
function trustHtml(sess,setup,st){
  const q=sessionQuality(sess,setup,st);
  const color=q.tone==="ok"?"var(--status-ok)":q.tone==="warn"?"var(--status-warn)":"var(--status-hold)";
  /* trustHtml は全呼び出し箇所が details（詳しく/詳しい根拠/判断の根拠）内のため、注記を常設できる */
  return `<div class="kv"><span>判断信頼度</span><span><b style="color:${color}">${q.label}</b>（${pct(q.score)} / ${q.reasons.map(esc).join("・")}）</span></div>
    ${confidenceNoteHtml("judge")}`;
}
function nextActionPlan(sess,adv,setup){
  const plan=[];
  const q=sessionQuality(sess,setup,adv&&adv.st);
  const j=judgementFor(adv,sess);
  if(!adv){ return ["6本以上を記録して、中心とばらつきを出す。"]; }
  if(j && j.label==="動かす") plan.push("提案方向へサイトを動かし、次の1エンドは同じ狙い方で確認する。");
  else if(j && j.label==="少量調整") plan.push("提案量（誤差を見込んで控えめに計算済み）だけ動かし、中心が戻るか確認する。");
  else if(j && (j.label==="保留" || j.label==="風を考慮")) plan.push("サイトは触らず、同条件で1〜2エンド追加して中心が再現するか見る。");
  else if(j && j.label==="射形優先") plan.push("サイト調整は控えめにして、リリース・押し手・照準時間の再現性を先に整える。");
  if(adv.personal && adv.personal.state==="今回だけの可能性") plan.push("過去傾向と逆なので、風向/射形メモを残して次回の同距離データと比較する。");
  if(adv.personal && adv.personal.state==="過去と一致") plan.push("調整後の中心が過去平均との差から縮むかを、履歴フィルタで同条件比較する。");
  if(q.score<.48) plan.push("この回は信頼度が低め。判断材料として残しつつ、強い結論は次回へ送る。");
  const st=adv.st;
  if(st.sy>st.sx*1.35) plan.push("上下散りが強いので、アンカー高・引き尺・リリース圧を1項目ずつ固定して確認する。");
  else if(st.sx>st.sy*1.35) plan.push("左右散りが強いので、風待ち・ボウハンド・プランジャーの順で切り分ける。");
  if(setup){
    const gp=gearPrecisionProfile(setup);
    if(gp.missing.length) plan.push(`精度を上げる追加データ: ${esc(gp.missing.slice(0,2).join("・"))}`);
  }
  return plan.slice(0,4);
}
function nextActionHtml(sess,adv,setup){
  const plan=nextActionPlan(sess,adv,setup);
  return plan.length?`<div class="advice analysisAdviceCard"><div class="note"><b>次のアクション</b></div>${plan.map((p,i)=>`<div class="note">${i+1}. ${p}</div>`).join("")}</div>`:"";
}
function roundProgressHtml(sess){
  const r=ROUND_TYPES.find(x=>x.id===sess.round);
  /* ROUND_TYPES に無い id は多距離ラウンド: 現在ステージ定義の arrows で進捗を出す（IMP-09） */
  const stage=r?null:sessionStageDef(sess);
  const arrows=r&&r.arrows?r.arrows:(stage&&stage.arrows?stage.arrows:null);
  if(!arrows) return "";
  const rg=sess.roundGroup;
  const stageInfo=stage&&rg?` ステージ${(Number(rg.stage)||0)+1}/${rg.stageCount}`:"";
  const all=sess.ends.flat(), total=all.reduce((a,x)=>a+x.s,0);
  const shot=all.length, remain=Math.max(0,arrows-shot);
  const pace=shot?total/shot*arrows:0;
  return `<div class="kv"><span>ラウンド進捗</span><span>${esc(roundLabel(sess.round))}${stageInfo} / ${shot}/${arrows}射 / 現在${total}点${shot&&remain?` / 予測${pace.toFixed(0)}点`:""}</span></div>`;
}
function sessionsCsv(){
  /* 既存の列の位置は変えない。group_* と sigma_* は全射（A）、excluded は外れ値候補の本数。研究用の比較列は末尾に追加 */
  const head=["date","setup","distance_m","round","face","arrows","total","avg","x_or_5plus","ten_or_6","group_x_cm","group_y_cm","group_rms_cm","sigma_x_cm","sigma_y_cm","confidence","decision_quality","personal_model","excluded","sight_v","sight_h","condition","note",
    "group_n","rms_ci95_lo_cm","rms_ci95_hi_cm","rms_df_eff","excl_n_flagged","excl_x_cm","excl_y_cm","excl_rms_cm","robust_x_cm","robust_y_cm","robust_rms_cm","robust_n_weighted","legacy_x_cm","legacy_y_cm","legacy_rms_cm","legacy_excluded","legacy_method","stats_version",
    "group_cov_cm2","excl_sigma_x_cm","excl_sigma_y_cm","robust_sigma_x_cm","robust_sigma_y_cm"];
  const f2=v=>Number.isFinite(v)?v.toFixed(2):"";
  const rows=[head];
  db.sessions.forEach(s=>{
    const m=sessionMetrics(s), all=m.all, st=m.st, total=m.total, setup=db.setups.find(x=>x.id===s.setupId);
    const q=sessionQuality(s,setup,st);
    const p=personalModel(s,setup,st);
    rows.push([s.date,setup?setup.name:"",s.dist,roundLabel(s.round),faceLabel(s),all.length,total,all.length?(total/all.length).toFixed(3):"",
      secondaryScoreCount(all,s),perfectScoreCount(all,s),st?st.mx.toFixed(2):"",st?st.my.toFixed(2):"",st?st.rr.toFixed(2):"",
      st?st.sx.toFixed(2):"",st?st.sy.toFixed(2):"",st?pct(st.confidence||0):"",q.label,p?p.state:"",st?st.excluded.length:"",
      s.sightV||"",s.sightH||"",windText(s),s.note||"",
      ...csvGroupingResearchColumns(m.pts, st, f2)]);
  });
  return "\ufeff"+rows.map(r=>r.map(csvCell).join(",")).join("\n");
}
/* 研究用の比較列（全射RMSの区間・外れ値候補を除いた統計・ロバスト統計・旧方式）。旧方式は CSV だけで計算する */
function csvGroupingResearchColumns(pts, st, f2){
  if(!st) return Array(23).fill("");
  const ex=st.excl, rob=st.robust, ci=st.rrCi;
  const legacy=pts&&pts.length?legacyRobustStats(pts):null;
  return [st.n, ci?f2(ci.lo):"", ci?f2(ci.hi):"", ci?f2(ci.df):"", (st.excluded||[]).length,
    ex?f2(ex.mx):"", ex?f2(ex.my):"", ex?f2(ex.rr):"", rob?f2(rob.mx):"", rob?f2(rob.my):"", rob?f2(rob.rr):"", rob?rob.nw:"",
    legacy?f2(legacy.mx):"", legacy?f2(legacy.my):"", legacy?f2(legacy.rr):"", legacy?legacy.excluded.length:"", legacy?legacy.method:"", st.version||"",
    f2(st.cov), ex?f2(ex.sx):"", ex?f2(ex.sy):"", rob?f2(rob.sx):"", rob?f2(rob.sy):""];
}
function exportSessionsCsv(){
  beginActiveWorkflow();
  shareOrDownloadText(`archery-note-sessions-${today()}.csv`,sessionsCsv(),"text/csv;charset=utf-8","Archery Note CSV").finally(endActiveWorkflow);
  db.settings.lastBackupAt=new Date().toISOString();
  save("csv-export");
}
function scorecardSvg(sess){
  const all=sess.ends.flat(), total=all.reduce((a,x)=>a+x.s,0), setup=db.setups.find(x=>x.id===sess.setupId);
  const rows=sess.ends.map((end,i)=>({i:i+1, scores:end.map(a=>scoreLabel(a)+(a.manual===true?"*":"")).join("  "), sum:end.reduce((a,x)=>a+x.s,0)}));
  const h=210+rows.length*34;
  const title=`${fmtD(sess.date)} ${sess.dist}m ${esc(roundLabel(sess.round))}`;
  const bg="#f7f8f4", ink="#1c1e1c", green="#1a5c3a";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${h}" viewBox="0 0 900 ${h}">
  <rect width="900" height="${h}" fill="${bg}"/>
  <text x="48" y="62" font-family="sans-serif" font-size="34" font-weight="700" fill="${green}">Archery Note Scorecard</text>
  <text x="48" y="102" font-family="sans-serif" font-size="22" fill="${ink}">${esc(title)}</text>
  <text x="48" y="134" font-family="sans-serif" font-size="18" fill="#667064">${esc(setup?setup.name:"セッティング未指定")} / ${esc(faceLabel(sess))} / ${all.length}射</text>
  <text x="650" y="92" font-family="sans-serif" font-size="48" font-weight="800" fill="${green}" text-anchor="end">${total}</text>
  <text x="666" y="92" font-family="sans-serif" font-size="18" fill="#667064">点</text>
  <text x="650" y="124" font-family="sans-serif" font-size="18" fill="#667064" text-anchor="end">平均 ${all.length?(total/all.length).toFixed(2):"-"} / ${esc(secondaryScoreLabel(sess))} ${secondaryScoreCount(all,sess)}</text>
  <rect x="48" y="160" width="804" height="34" rx="6" fill="#dde7dc"/>
  <text x="70" y="183" font-family="sans-serif" font-size="15" font-weight="700" fill="${ink}">End</text>
  <text x="150" y="183" font-family="sans-serif" font-size="15" font-weight="700" fill="${ink}">Scores</text>
  <text x="808" y="183" font-family="sans-serif" font-size="15" font-weight="700" fill="${ink}" text-anchor="end">Sum</text>
  ${rows.map((r,i)=>`<g transform="translate(0 ${202+i*34})">
    <rect x="48" y="0" width="804" height="28" rx="5" fill="${i%2?"#ffffff":"#eef1ec"}"/>
    <text x="78" y="20" font-family="sans-serif" font-size="17" fill="${ink}" text-anchor="middle">${r.i}</text>
    <text x="150" y="20" font-family="sans-serif" font-size="17" fill="${ink}">${esc(r.scores)}</text>
    <text x="808" y="20" font-family="sans-serif" font-size="17" font-weight="700" fill="${green}" text-anchor="end">${r.sum}</text>
  </g>`).join("")}
  ${sess.note||windText(sess)?`<text x="48" y="${h-32}" font-family="sans-serif" font-size="16" fill="#667064">${esc([windText(sess),sess.note].filter(Boolean).join(" / "))}</text>`:""}
</svg>`;
}
function exportScorecardImage(sess){
  shareOrDownloadText(`archery-scorecard-${sess.date||today()}-${sess.dist}m.svg`,scorecardSvg(sess),"image/svg+xml;charset=utf-8","Archery Note Scorecard");
}
function backupReminderHtml(){
  if(db.sessions.length<3) return "";
  const t=db.settings.lastBackupAt?Date.parse(db.settings.lastBackupAt):0;
  const days=t?Math.floor((Date.now()-t)/(24*60*60*1000)):999;
  if(days<30) return `<div class="hint">最終バックアップ/CSV出力: ${new Date(t).toLocaleDateString()}。月1回の保存ペースは良好です。</div>`;
  return `<div class="advice analysisAdviceCard"><div class="note"><b>バックアップ推奨</b> — 練習記録が${db.sessions.length}回あります。端末トラブルに備えて、JSONバックアップを保存しておくと安心です。</div></div>`;
}
/* S4（ストレージ守りタスク・OPFS移行裁定 §4／§5-観点5）: 7日ITP対策の案内。
   ブラウザのタブ・ブックマークのまま使い続ける（ホーム画面未追加の）利用者は、Safari の ITP により
   7日間サイトを開かないと localStorage ごと消去される場合がある。これは OPFS へ移行しても解決しない
   （裁定書§5参照）ため、バックアップ節で運用対策として案内する。runtimeKind() が "Web"（ネイティブ
   でもホーム画面PWAでもない）のときだけ表示する。記録タブの featureHints.addToHome（一度見たら
   消える発見ヒント）とは独立: こちらは「今も非standalone実行中」というライブ状態が理由なので、
   既読フラグで恒久的に消してはいけない（ホーム画面に追加すれば runtimeKind() 自体が変わり自然に消える） */
function webStorageRiskHtml(){
  if(runtimeKind().kind!=="Web") return "";
  return `<div class="hint">ブラウザで開いたままだと、7日間操作がないとデータが失われる場合があります。<b>ホーム画面に追加</b>すると安全性が上がります。</div>`;
}
/* ゴミ箱の一覧+復元は「データ」節、全消去ボタンは危険域へ分離して表示する（表示のみの分割。
   #trashClear の挙動・確認ダイアログの有無は変えない） */
function trashSettingsHtml(){
  const items=(db.trash||[]).slice(0,8);
  if(!items.length) return `<h3 class="trashH3">ゴミ箱</h3><div class="empty">削除したデータはありません。</div>`;
  return `<h3 class="trashH3">ゴミ箱 <span class="subNoteSm">最新${items.length}/${(db.trash||[]).length}件</span></h3>
    <table class="tbl"><tr><th>種類</th><th>内容</th><th>削除日</th><th></th></tr>
    ${items.map(it=>`<tr><td>${trashTypeLabel(it.type)}</td><td>${esc(it.label)}</td><td>${fmtD(it.date)}</td><td class="right"><button class="btn sm ghost trashRestoreBtn" data-restore-trash="${esc(it.id)}">復元</button></td></tr>`).join("")}</table>`;
}
function trashClearButtonHtml(){
  const items=(db.trash||[]).slice(0,8);
  if(!items.length) return "";
  return `<div class="settingsActionHint">ゴミ箱の中身を完全に削除します。元に戻せません。</div>
    <div class="btnrow"><button class="btn danger" id="trashClear" data-testid="settings-trash-clear">ゴミ箱を空にする</button></div>`;
}
function regress(pts){
  const n=pts.length; if(n<2) return null;
  const xb=pts.reduce((a,p)=>a+p[0],0)/n, yb=pts.reduce((a,p)=>a+p[1],0)/n;
  let vx=0,cv=0; pts.forEach(p=>{vx+=(p[0]-xb)**2; cv+=(p[0]-xb)*(p[1]-yb);});
  if(vx<1e-9) return null;
  const b=cv/vx, a=yb-b*xb;
  let ss=0,se=0; pts.forEach(p=>{ ss+=(p[1]-yb)**2; se+=(p[1]-(a+b*p[0]))**2; });
  return {a,b,zero: Math.abs(b)>1e-9? -a/b : null,r2:ss>1e-9?clamp(1-se/ss,0,1):0,kind:"linear",est:d=>a+b*d};
}
function robustLine(pts){
  if(pts.length<2) return null;
  const slopes=[];
  for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
    const dx=pts[j][0]-pts[i][0];
    if(Math.abs(dx)>1e-9) slopes.push((pts[j][1]-pts[i][1])/dx);
  }
  if(!slopes.length) return null;
  const b=median(slopes);
  const a=median(pts.map(p=>p[1]-b*p[0]));
  const yb=pts.reduce((s,p)=>s+p[1],0)/pts.length;
  let ss=0,se=0; pts.forEach(p=>{ ss+=(p[1]-yb)**2; se+=(p[1]-(a+b*p[0]))**2; });
  return {a,b,zero:Math.abs(b)>1e-9?-a/b:null,r2:ss>1e-9?clamp(1-se/ss,0,1):0};
}
function weightedLineFit(pts){
  const clean=pts.map(p=>({x:+p[0],y:+p[1],w:clamp(+p[2]||1,.02,2)}))
    .filter(p=>isFinite(p.x)&&isFinite(p.y)&&isFinite(p.w)&&p.w>0);
  if(clean.length<2) return null;
  const sw=clean.reduce((a,p)=>a+p.w,0);
  const xb=clean.reduce((a,p)=>a+p.x*p.w,0)/sw;
  const yb=clean.reduce((a,p)=>a+p.y*p.w,0)/sw;
  let vx=0,cv=0;
  clean.forEach(p=>{ vx+=(p.x-xb)*(p.x-xb)*p.w; cv+=(p.x-xb)*(p.y-yb)*p.w; });
  if(Math.abs(vx)<1e-9) return null;
  const b=cv/vx, a=yb-b*xb;
  let ss=0,se=0;
  clean.forEach(p=>{ const e=a+b*p.x; ss+=(p.y-yb)*(p.y-yb)*p.w; se+=(p.y-e)*(p.y-e)*p.w; });
  const scatter=Math.sqrt(Math.max(0,se/sw));
  return {a,b,zero:Math.abs(b)>1e-9?-a/b:null,r2:ss>1e-9?clamp(1-se/ss,0,1):0,n:clean.length,weight:sw,scatter,kind:"weighted"};
}
function robustWeightedLine(pts){
  if(pts.length<2) return null;
  const base=robustLine(pts.map(p=>[p[0],p[1]]));
  if(!base) return null;
  const residuals=pts.map(p=>p[1]-(base.a+base.b*p[0]));
  const center=median(residuals);
  const scale=Math.max(1.4826*median(residuals.map(r=>Math.abs(r-center))), .05);
  const weighted=pts.map((p,i)=>{
    const u=Math.abs(residuals[i]-center)/(scale*2.5);
    const rw=u>=1?.08:(1-u*u)**2;
    return [p[0],p[1],(+p[2]||1)*rw];
  });
  const fit=weightedLineFit(weighted);
  if(!fit || fit.zero==null || !isFinite(fit.zero)) return null;
  const avgW=fit.weight/Math.max(1,fit.n);
  fit.kind="weighted-robust";
  fit.quality=clamp((fit.r2||0)*.5 + clamp((fit.n-1)/5,0,1)*.28 + clamp(avgW,.1,1)*.22,0,1);
  fit.base=base;
  return fit;
}
function solve3(A,b){
  const m=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<3;c++){
    let piv=c; for(let r=c+1;r<3;r++) if(Math.abs(m[r][c])>Math.abs(m[piv][c])) piv=r;
    if(Math.abs(m[piv][c])<1e-9) return null;
    [m[c],m[piv]]=[m[piv],m[c]];
    const div=m[c][c]; for(let k=c;k<4;k++) m[c][k]/=div;
    for(let r=0;r<3;r++) if(r!==c){ const f=m[r][c]; for(let k=c;k<4;k++) m[r][k]-=f*m[c][k]; }
  }
  return [m[0][3],m[1][3],m[2][3]];
}
function quadraticFit(pts){
  if(pts.length<4) return null;
  const sx=[0,0,0,0,0], sy=[0,0,0];
  pts.forEach(([x,y])=>{ let p=1; for(let i=0;i<5;i++){ sx[i]+=p; p*=x; } sy[0]+=y; sy[1]+=x*y; sy[2]+=x*x*y; });
  const coef=solve3([[sx[0],sx[1],sx[2]],[sx[1],sx[2],sx[3]],[sx[2],sx[3],sx[4]]],sy);
  if(!coef) return null;
  const [a,b,c]=coef, yb=pts.reduce((s,p)=>s+p[1],0)/pts.length;
  let ss=0,se=0; pts.forEach(([x,y])=>{ const e=a+b*x+c*x*x; ss+=(y-yb)**2; se+=(y-e)**2; });
  return {a,b,c,kind:"curve",r2:ss>1e-9?clamp(1-se/ss,0,1):0,est:d=>a+b*d+c*d*d};
}
/* setup+distance のセッション群から「ズレ0になるサイト値」を回帰推定 */
function regressionAdvice(setupId, dist){
  const setup=db.setups.find(s=>s.id===setupId);
  const ss=db.sessions.filter(s=>s.setupId===setupId && s.dist===dist)
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.id>b.id?1:-1));
  const res={};
  [["sightV","my","v"],["sightH","mx","h"]].forEach(([key,axis,tag])=>{
    const pts=[];
    /* 重み = 各回の中心の逆分散（1/SE²）を最大1に正規化。風の回は左右の誤差が読めないので左右の重みを半分にする */
    const raw=[];
    ss.forEach(s=>{
      const v=parseFloat(s[key]);
      const q=sessionQuality(s,setup);
      const st=q&&q.metrics?sightStats(q.metrics.st):null;
      const se=st?(axis==="my"?st.seY:st.seX):NaN;
      if(isFinite(v) && st && st.n>=6 && Number.isFinite(se)){
        const windFactor=axis==="mx"&&isWindy(s)?.5:1;
        raw.push([v, st[axis], windFactor/Math.max(.01,se*se)]);
      }
    });
    const wmax=raw.reduce((a,p)=>Math.max(a,p[2]),0);
    raw.forEach(p=>pts.push([p[0],p[1],wmax>0?clamp(p[2]/wmax,.02,1):1]));
    const uniq=new Set(pts.map(p=>p[0]));
    if(pts.length>=2 && uniq.size>=2){
      const r=robustWeightedLine(pts) || robustLine(pts);
      if(r && r.zero!=null && isFinite(r.zero)){
        res[tag]={zero:r.zero, n:pts.length, r2:r.r2, slope:r.b, quality:r.quality||r.r2||0, scatter:r.scatter||0, model:r.kind||"robust"};
      }
    }
  });
  return res;
}
/* 距離→サイト値（上下）の予測。旧版は距離の一次式/二次式で近似しており、近距離の照準幾何（1/距離の項）や
   空気抵抗による曲がりを表せなかった。ここでは弾道から計算した照準角の特徴量 f(距離)=tan(α) に
   サイト値を線形回帰する（s = a + b·f）。4距離以上の実測があれば、残差が最小になる初速も当てはめる。 */
const SIGHT_INTERP_CACHE=new Map();
function sightFitAtSpeed(pts, phys, speedMps){
  const ph=Object.assign({}, phys, {speedMps});
  const fs=pts.map(p=>sightAngleFeature(p[0], ph));
  const n=pts.length, fb=fs.reduce((a,f)=>a+f,0)/n, yb=pts.reduce((a,p)=>a+p[1],0)/n;
  let sff=0,sfy=0; fs.forEach((f,i)=>{ sff+=(f-fb)**2; sfy+=(f-fb)*(pts[i][1]-yb); });
  if(sff<1e-14) return null;
  const b=sfy/sff, a=yb-b*fb;
  let sse=0,sst=0; fs.forEach((f,i)=>{ sse+=(pts[i][1]-(a+b*f))**2; sst+=(pts[i][1]-yb)**2; });
  return {a,b,sse,r2:sst>1e-12?clamp(1-sse/sst,0,1):0,ph};
}
function sightInterp(setupId){
  const byDist={}, sourceByDist=Object.create(null);
  [...db.sightMarks].filter(m=>m.setupId===setupId)
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.ts||0)-(b.ts||0))
    .forEach(m=>{ const v=parseFloat(m.v); if(isFinite(v)){ byDist[m.dist]=v; sourceByDist[m.dist]=m; } });
  const keys=Object.keys(byDist).sort((a,b)=>+a-+b);
  const pts=keys.map(d=>[+d, byDist[d]]);
  if(pts.length<2) return null;
  const setup=db.setups.find(x=>x.id===setupId)||{};
  const phys=physicsProfile(setup);
  const cacheKey=JSON.stringify([pts,phys.speedMps,phys.cd,phys.rho,phys.massKg,phys.area]);
  let fit=SIGHT_INTERP_CACHE.get(cacheKey);
  if(!fit){
    fit=sightFitAtSpeed(pts, phys, phys.speedMps);
    let fitted=false;
    if(fit && pts.length>=5){
      /* 初速の当てはめ（黄金分割探索、35〜95 m/s）。4点では自由度1で不安定なので5距離以上に限る。
         実測初速の入力があれば当てはめない（実測のまま） */
      if(!phys.measuredSpeed){
        let lo=35, hi=95;
        const gr=(Math.sqrt(5)-1)/2;
        const sse=v=>{ const f=sightFitAtSpeed(pts, phys, v); return f?f.sse:Infinity; };
        let c=hi-gr*(hi-lo), d=lo+gr*(hi-lo), fc=sse(c), fd=sse(d);
        for(let i=0;i<28;i++){
          if(fc<fd){ hi=d; d=c; fd=fc; c=hi-gr*(hi-lo); fc=sse(c); }
          else{ lo=c; c=d; fc=fd; d=lo+gr*(hi-lo); fd=sse(d); }
        }
        /* 探索範囲の端に張り付いた当てはめは台帳の矛盾（記録違い・別の用具）を示すので採らない */
        const vBest=(lo+hi)/2;
        const best=vBest>35.5&&vBest<94.5?sightFitAtSpeed(pts, phys, vBest):null;
        /* 入れ子モデルの F 検定（自由度 1, n−3、5%）で、初速を加えた改善が偶然を超えるときだけ採る */
        const df2=pts.length-3, F95=[NaN,161.4,18.51,10.13,7.71,6.61,5.99,5.59,5.32,5.12,4.96];
        const fcrit=df2<=10?F95[df2]:3.84+8/df2;
        if(best && best.sse<fit.sse && (fit.sse-best.sse)/Math.max(best.sse/df2,1e-12)>fcrit){ fit=best; fitted=true; }
      }
    }
    if(fit) fit.fitted=fitted;
    SIGHT_INTERP_CACHE.set(cacheKey, fit||false);
    if(SIGHT_INTERP_CACHE.size>16) SIGHT_INTERP_CACHE.delete(SIGHT_INTERP_CACHE.keys().next().value);
  }
  const sources=keys.map(d=>sourceByDist[d]);
  if(!fit){
    const line=regress(pts);
    if(!line) return null;
    return {pts, have:pts.map(p=>p[0]), model:"linear", r2:line.r2, est:line.est, sources};
  }
  const f=fit;
  return {pts, have:pts.map(p=>p[0]), model:"physics", r2:f.r2, est:d=>f.a+f.b*sightAngleFeature(d, f.ph), sources,
    speedFps:f.ph.speedMps/0.3048, speedSource:phys.measuredSpeed?"measured":f.fitted?"fitted":"estimated"};
}
function calibrationProfile(setupId){
  const setup=db.setups.find(x=>x.id===setupId)||{};
  const dists=new Set(db.sightMarks.filter(m=>m.setupId===setupId && isFinite(parseFloat(m.v))).map(m=>m.dist));
  const sess=db.sessions.filter(s=>s.setupId===setupId);
  const withSight=sess.filter(s=>isFinite(parseFloat(s.sightV))||isFinite(parseFloat(s.sightH))).length;
  const rich=gearPrecisionProfile(setup);
  const score=clamp(dists.size*.12 + Math.min(withSight,10)*.035 + rich.score*.32 + (String(setup.arrowSpeed||"").trim()?0.14:0),0,1);
  const level=levelFromScore(score, LEVELS.calibration);
  const next=[];
  if(dists.size<3) next.push("異なる距離のサイト値");
  if(withSight<5) next.push("練習開始時のサイト値");
  if(!setup.arrowSpeed) next.push("実測初速");
  if(rich.score<.65) next.push("矢重量/FOC/ベイン");
  return {score,level,dists:dists.size,withSight,gearLevel:rich.level,next};
}
const _MODEL_READINESS_CACHE=new Map();
function modelReadinessProfile(setupId){
  const cacheKey=setupId+"|"+DB_REV;
  const hit=_MODEL_READINESS_CACHE.get(cacheKey);
  if(hit) return hit;
  const setup=db.setups.find(x=>x.id===setupId)||{};
  const sess=db.sessions.filter(s=>s.setupId===setupId);
  const usable=sess.map(s=>({s,q:sessionQuality(s,setup)}))
    .filter(x=>x.q.metrics.st && x.q.metrics.st.n>=6);
  const good=usable.filter(x=>x.q.score>=.48);
  const byKey={};
  good.forEach(x=>{
    const s=x.s;
    const k=[s.dist,s.faceD,s.faceType||"single"].join("|");
    (byKey[k]=byKey[k]||[]).push(x);
  });
  const repeatGroups=Object.values(byKey).filter(g=>g.length>=2).length;
  const withSight=sess.filter(s=>isFinite(parseFloat(s.sightV))||isFinite(parseFloat(s.sightH))).length;
  const sightDists=new Set(db.sightMarks.filter(m=>m.setupId===setupId && isFinite(parseFloat(m.v))).map(m=>m.dist)).size;
  const gp=gearPrecisionProfile(setup);
  const score=clamp(good.length*.035 + repeatGroups*.13 + Math.min(withSight,10)*.035 + sightDists*.06 + gp.score*.24,0,1);
  const level=levelFromScore(score, LEVELS.data);
  const next=[];
  if(good.length<5) next.push("6本以上の練習記録");
  if(repeatGroups<2) next.push("同じ距離/的での反復");
  if(withSight<4) next.push("練習開始時のサイト値");
  if(sightDists<3) next.push("複数距離のサイト台帳");
  if(gp.score<.65) next.push("矢重量・矢径・実測初速");
  const result={score,level,total:sess.length,usable:usable.length,good:good.length,repeatGroups,withSight,sightDists,gearLevel:gp.level,next};
  _MODEL_READINESS_CACHE.set(cacheKey,result);
  if(_MODEL_READINESS_CACHE.size>20) _MODEL_READINESS_CACHE.delete(_MODEL_READINESS_CACHE.keys().next().value);
  return result;
}
function modelReadinessHtml(setupId){
  if(!setupId) return "";
  const p=modelReadinessProfile(setupId);
  return `<div class="advice analysisAdviceCard">
    <div class="note"><b>個人データ準備度: ${p.level}</b>（${pct(p.score)}）</div>
    <div class="kv"><span>使える練習</span><span>${p.good}回 / 同条件反復 ${p.repeatGroups}組</span></div>
    <div class="kv"><span>サイト校正材料</span><span>サイト値つき練習 ${p.withSight}回 / 台帳 ${p.sightDists}距離</span></div>
    ${p.next.length?`<div class="note">次に効くデータ: ${esc(p.next.slice(0,3).join("・"))}</div>`:`<div class="note">履歴・サイト値・用具入力の土台がかなり揃っています。</div>`}
  </div>`;
}
function latestMark(setupId, dist){
  const ms=db.sightMarks.filter(m=>m.setupId===setupId && m.dist===dist).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.ts||0)-(a.ts||0));
  return ms[0]||null;
}
