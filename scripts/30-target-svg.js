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
    /* 白縁(太さ r/3)の外縁がちょうど判定半径 r になるよう、円は内側 5r/6 に描く */
    `<circle class="arrowFoot" cx="${a.x}" cy="${-a.y}" r="${r*5/6}" fill="${color}" stroke="#fff" stroke-width="${r/3}"/>`+
    /* 番号は実寸の矢円に重ならないよう目印の上寄りに置く（目印が実寸と同じ大きさなら中央） */
    (label?`<text x="${a.x}" y="${-a.y-(loc>r*1.05?loc*.4:0)}" font-size="${loc*(loc>r*1.05?1:1.2)}" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="${loc*.12}" paint-order="stroke" text-anchor="middle" dominant-baseline="central" font-weight="bold">${esc(label)}</text>`:"")+`</g>`;
}
/* 記録中のエンドの矢番号（射った順）を、画面上の実寸で読める吹き出しにする。
   吹き出しは矢から北東へずらし、重なるときは互いに押し出して引き出し線で結ぶ（決定的な反復）。
   pxPerCm は的の SVG の画面上の倍率。吹き出しは直径 22px・文字 13px 相当で、実寸の矢円（arrowFoot）には触れない */
function layoutArrowLabels(points, pxPerCm, box){
  const r=11/pxPerCm, minD=2*r*1.08, off=r*1.75;
  /* box は SVG の viewBox（x, y, width, height）。吹き出しは的の表示範囲からはみ出さない */
  const clamp=(l)=>{
    if(!box) return l;
    const x=Math.min(Math.max(l.x, box.x+r), box.x+box.width-r);
    const sy=Math.min(Math.max(-l.y, box.y+r), box.y+box.height-r);
    return {x, y:-sy};
  };
  const L=points.map(p=>p?clamp({x:p.x+off*Math.SQRT1_2,y:p.y+off*Math.SQRT1_2}):null);
  for(let it=0;it<80;it++){
    let moved=false;
    for(let i=0;i<L.length;i++){
      if(!L[i]) continue;
      for(let j=i+1;j<L.length;j++){
        if(!L[j]) continue;
        const d=Math.hypot(L[j].x-L[i].x, L[j].y-L[i].y);
        if(d>=minD) continue;
        /* 完全に重なったときは番号ごとに決まった向き（黄金角）へ離す */
        const ang=(j*2.399963)%(2*Math.PI);
        const ux=d>1e-9?(L[j].x-L[i].x)/d:Math.cos(ang), uy=d>1e-9?(L[j].y-L[i].y)/d:Math.sin(ang);
        const push=(minD-d)/2;
        L[i]=clamp({x:L[i].x-ux*push,y:L[i].y-uy*push});
        L[j]=clamp({x:L[j].x+ux*push,y:L[j].y+uy*push});
        moved=true;
      }
      /* 吹き出しが矢そのもの（自分以外の矢も含む）を隠さないよう、矢の位置からも離す */
      for(let k=0;k<points.length;k++){
        const p=points[k];
        if(!p) continue;
        const d=Math.hypot(L[i].x-p.x, L[i].y-p.y), minA=r*1.3;
        if(d>=minA) continue;
        const ang=((i+1)*2.399963)%(2*Math.PI);
        const ux=d>1e-9?(L[i].x-p.x)/d:Math.cos(ang), uy=d>1e-9?(L[i].y-p.y)/d:Math.sin(ang);
        L[i]=clamp({x:L[i].x+ux*(minA-d),y:L[i].y+uy*(minA-d)});
        moved=true;
      }
    }
    if(!moved) break;
  }
  return {labels:L, r, font:13/pxPerCm};
}
function arrowLabelSvg(p, l, r, font, label, selected){
  if(!p||!l) return "";
  const fill=selected?"var(--ink)":"var(--invert-bg)", fg=selected?"var(--bg)":"var(--invert-fg)";
  return `<g class="arrowLabel"><line x1="${p.x}" y1="${-p.y}" x2="${l.x}" y2="${-l.y}" stroke="${fill}" stroke-width="${r/7}"/>`+
    `<circle cx="${l.x}" cy="${-l.y}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="${r/9}"/>`+
    `<text x="${l.x}" y="${-l.y}" font-size="${font}" fill="${fg}" text-anchor="middle" dominant-baseline="central" font-weight="700">${esc(label)}</text></g>`;
}
/* static plot for history/summary */
/* 位置のある矢が1本もない記録（点数だけの入力）に出す表示。的の図・統計・サイトの目安は作らない */
function noImpactHtml(sess){
  const n=((sess&&sess.ends)||[]).flat().length;
  return `<div class="noImpact" data-testid="no-impact"><b>着弾データなし</b><span>${n}射すべて位置のない記録です（点数だけの入力）。合計・平均・10/X の数は点数から数えています。的の図・集まり具合・サイトの目安は、位置のある矢がある記録だけで作ります。</span></div>`;
}
function plotSession(sess, container){
  const faceD=sess.faceD;
  const allArrows=((sess&&sess.ends)||[]).flat();
  const posCount=allArrows.filter(arrowHasPos).length;
  if(!posCount){ container.innerHTML=noImpactHtml(sess); return; }
  const ft=sess.faceType==="triple"?"spot":sess.faceType;
  container.innerHTML=`<div class="tgWrap">${targetMarkup(faceD,"pl",ft)}</div>`+
    (sess.faceType==="triple"?`<div class="hint" style="text-align:center">三つ目的：3スポットを1つに重ねて表示しています</div>`:"")+
    (posCount<allArrows.length?`<div class="hint plotPosNote" data-testid="plot-position-note">位置のある ${posCount}射を表示しています（位置なし ${allArrows.length-posCount}射は、図と着弾の統計に入れていません）。</div>`:"");
  const marks=$("#plmarks");
  let html="";
  /* 記録時の判定の半径で描く（旧判定の記録は旧半径。保存された点数と矢円を一致させる） */
  const arrowR=sessionScoringRadius(sess, db.setups.find(x=>x.id===sess.setupId));
  /* 座標のない矢（点数だけの記録・座標なしの M）は描かない */
  sess.ends.forEach((end,ei)=>{ end.forEach(a=>{ if(arrowHasPos(a)) html+=markCircle(a,faceD,ENDCOLORS[ei%ENDCOLORS.length],"","",arrowR); }); });
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
