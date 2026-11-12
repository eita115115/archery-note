"use strict";
/* Archery Note: target drawing and plots */
/* ============ target SVG ============ */
function targetMarkup(faceD, idPrefix, faceType){
  const w=ringW(faceD,faceType);
  /* 境界線は高得点側ゾーンに属する（WA規則）。線の外縁が公称半径に来るよう半径を線幅の半分だけ内側へ寄せる */
  const inset=(r,sw)=>Math.max(0,r-sw/2);
  const spotG=(cx,cy)=>{
    let h="";
    const sw=w/16;
    [[6,"#37a6e0"],[7,"#f23b3b"],[8,"#f23b3b"],[9,"#ffe14d"],[10,"#ffe14d"]].forEach(([sc,fill])=>{
      h+=`<circle cx="${cx}" cy="${cy}" r="${inset((11-sc)*w,sw)}" fill="${fill}" stroke="#1c1e1c" stroke-width="${sw}"/>`;
    });
    h+=`<circle cx="${cx}" cy="${cy}" r="${inset(w/2,sw)}" fill="none" stroke="#1c1e1c" stroke-width="${sw}"/>`;
    h+=`<line x1="${cx-w/6}" y1="${cy}" x2="${cx+w/6}" y2="${cy}" stroke="#1c1e1c" stroke-width="${w/16}"/>`;
    h+=`<line x1="${cx}" y1="${cy-w/6}" x2="${cx}" y2="${cy+w/6}" stroke="#1c1e1c" stroke-width="${w/16}"/>`;
    return h;
  };
  if(faceType==="triple"){
    let g=`<rect x="-14" y="-36" width="28" height="72" rx="1.5" fill="#f7f6f0" stroke="#bbb" stroke-width="0.2"/>`;
    SPOT_Y.forEach(c=>{ g+=spotG(0,-c); });
    return `<svg class="main triple" id="${idPrefix}svg" viewBox="-15 -37.5 30 75" xmlns="http://www.w3.org/2000/svg">
    <g id="${idPrefix}main"><g>${g}</g><g id="${idPrefix}marks"></g><g id="${idPrefix}cur"></g></g>
  </svg>`;
  }
  if(faceType==="spot"){
    const M=5*w*1.25;
    return `<svg class="main" id="${idPrefix}svg" viewBox="${-M} ${-M} ${2*M} ${2*M}" xmlns="http://www.w3.org/2000/svg">
    <g id="${idPrefix}main"><g>${spotG(0,0)}</g><g id="${idPrefix}marks"></g><g id="${idPrefix}cur"></g></g>
  </svg>`;
  }
  if(isFieldFace(faceType)){
    const R=faceD/2, M=R*1.18;
    const line=targetLineHalfWidth(faceD,faceType)*2;
    const zones=[
      [6,"#1c1e1c"],[5,"#1c1e1c"],[4,"#1c1e1c"],[3,"#1c1e1c"],
      [2,"#ffe14d"],[1,"#ffe14d"]
    ];
    let g="";
    zones.forEach(([k,fill])=>{
      g+=`<circle cx="0" cy="0" r="${inset(k*w,line)}" fill="${fill}" stroke="${fill==="#1c1e1c"?"#f0f1ec":"#1c1e1c"}" stroke-width="${line}"/>`;
    });
    g+=`<line x1="${-w/6}" y1="0" x2="${w/6}" y2="0" stroke="#1c1e1c" stroke-width="${line}"/>`;
    g+=`<line x1="0" y1="${-w/6}" x2="0" y2="${w/6}" stroke="#1c1e1c" stroke-width="${line}"/>`;
    return `<svg class="main field" id="${idPrefix}svg" viewBox="${-M} ${-M} ${2*M} ${2*M}" xmlns="http://www.w3.org/2000/svg">
    <g id="${idPrefix}main"><g>${g}</g><g id="${idPrefix}marks"></g><g id="${idPrefix}cur"></g></g>
  </svg>`;
  }
  const R=faceD/2, M=R*1.18;
  const zones=[ [10,"#fff"],[9,"#fff"],[8,"#1c1e1c"],[7,"#1c1e1c"],[6,"#37a6e0"],[5,"#37a6e0"],[4,"#f23b3b"],[3,"#f23b3b"],[2,"#ffe14d"],[1,"#ffe14d"] ];
  let g="";
  zones.forEach(([k,fill])=>{ g+=`<circle cx="0" cy="0" r="${inset(k*w,R/300)}" fill="${fill}" stroke="${fill==="#1c1e1c"?"#e9ebe6":"#1c1e1c"}" stroke-width="${R/300}"/>`; });
  g+=`<circle cx="0" cy="0" r="${inset(w/2,R/300)}" fill="none" stroke="#1c1e1c" stroke-width="${R/300}"/>`;
  g+=`<line x1="${-w/6}" y1="0" x2="${w/6}" y2="0" stroke="#1c1e1c" stroke-width="${R/300}"/>`;
  g+=`<line x1="0" y1="${-w/6}" x2="0" y2="${w/6}" stroke="#1c1e1c" stroke-width="${R/300}"/>`;
  return `<svg class="main" id="${idPrefix}svg" viewBox="${-M} ${-M} ${2*M} ${2*M}" xmlns="http://www.w3.org/2000/svg">
    <g id="${idPrefix}main"><g>${g}</g><g id="${idPrefix}marks"></g><g id="${idPrefix}cur"></g></g>
  </svg>`;
}
/* 矢の印: 実寸の矢円（判定と同じ半径・白い実線の縁）＋ 位置を探すための半透明の目印（白い破線の縁・判定には使わない）。
   arrowR は矢の半径(cm)。目印は fill-opacity で薄くし、着弾アニメの opacity とは掛け合わせで効く */
function markCircle(a, faceD, color, label, cls, arrowR){
  const r=arrowMarkRadius(faceD, arrowR);
  const loc=Math.max(arrowLocatorRadius(faceD), r);
  const klass=cls?` class="${cls}"`:"";
  return `<g${klass}>`+
    (loc>r*1.05?`<circle class="arrowLocator" cx="${a.x}" cy="${-a.y}" r="${loc}" fill="${color}" fill-opacity=".42" stroke="#fff" stroke-width="${loc/6}" stroke-dasharray="${loc*.45} ${loc*.3}"/>`:"")+
    `<circle class="arrowFoot" cx="${a.x}" cy="${-a.y}" r="${r}" fill="${color}" stroke="#fff" stroke-width="${r/3}"/>`+
    /* 番号は実寸の矢円に重ならないよう目印の上寄りに置く（目印が実寸と同じ大きさなら中央） */
    (label?`<text x="${a.x}" y="${-a.y-(loc>r*1.05?loc*.4:0)}" font-size="${loc*(loc>r*1.05?1:1.2)}" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="${loc*.12}" paint-order="stroke" text-anchor="middle" dominant-baseline="central" font-weight="bold">${esc(label)}</text>`:"")+`</g>`;
}
/* static plot for history/summary */
function plotSession(sess, container){
  const faceD=sess.faceD;
  const ft=sess.faceType==="triple"?"spot":sess.faceType;
  container.innerHTML=`<div class="tgWrap">${targetMarkup(faceD,"pl",ft)}</div>`+
    (sess.faceType==="triple"?`<div class="hint" style="text-align:center">三つ目的：3スポットを1つに重ねて表示しています</div>`:"");
  const marks=$("#plmarks");
  let html="";
  const arrowR=sessionArrowR(sess, db.setups.find(x=>x.id===sess.setupId));
  sess.ends.forEach((end,ei)=>{ end.forEach(a=>{ html+=markCircle(a,faceD,ENDCOLORS[ei%ENDCOLORS.length],"","",arrowR); }); });
  const st=sessionMetrics(sess).st;
  if(st){
    const w=ringW(faceD,ft);
    st.excluded.forEach(a=>{
      const r=faceD/70;
      html+=`<g><line x1="${a.x-r}" y1="${-a.y-r}" x2="${a.x+r}" y2="${-a.y+r}" stroke="#000" stroke-width="${faceD/300}"/>`+
        `<line x1="${a.x-r}" y1="${-a.y+r}" x2="${a.x+r}" y2="${-a.y-r}" stroke="#000" stroke-width="${faceD/300}"/></g>`;
    });
    html+=`<g><line x1="${st.mx-w*0.8}" y1="${-st.my}" x2="${st.mx+w*0.8}" y2="${-st.my}" stroke="#000" stroke-width="${faceD/400}"/>`+
      `<line x1="${st.mx}" y1="${-st.my-w*0.8}" x2="${st.mx}" y2="${-st.my+w*0.8}" stroke="#000" stroke-width="${faceD/400}"/>`+
      `<circle cx="${st.mx}" cy="${-st.my}" r="${st.rr}" fill="none" stroke="#000" stroke-dasharray="${faceD/60} ${faceD/120}" stroke-width="${faceD/400}"/></g>`;
    if(st.major!=null && st.minor!=null){
      html+=`<ellipse cx="${st.mx}" cy="${-st.my}" rx="${st.major}" ry="${st.minor}" transform="rotate(${-st.angleDeg} ${st.mx} ${-st.my})" fill="none" stroke="var(--status-ok)" stroke-dasharray="${faceD/90} ${faceD/160}" stroke-width="${faceD/380}"/>`;
    }
  }
  marks.innerHTML=html;
}
