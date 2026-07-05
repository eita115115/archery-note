"use strict";
/* Archery Note: record and active-session views */
/* ============ views ============ */
let view = "record";
let ui = {
  selArrow: -1,
  sightSel: { setupId: null, dist: 70 },
  histOpen: null,
  histFilter: { setupId: "", dist: "", round: "" },
  analysisFilter: { setupId: "", dist: "", round: "", period: "all" },
  zoom: 1,
  recordMode: "practice",
  freshArrow: -1,
  freshTimer: 0,
};
function showView(v) {
  if (view === v) return;
  view = v;
  ui.selArrow = -1;
  nativePulse("light");
  render();
}
document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => showView(b.dataset.v)));

function render() {
  updateAppChrome();
  if (typeof syncUpdateBarVisibility === "function") syncUpdateBarVisibility();
  const tabs = Array.prototype.slice.call(document.querySelectorAll("#tabs button"));
  const activeIndex = Math.max(
    0,
    tabs.findIndex((b) => b.dataset.v === view),
  );
  const tabBar = $("#tabs");
  if (tabBar) {
    tabBar.style.setProperty("--active-tab", activeIndex);
    tabBar.style.setProperty("--tab-count", tabs.length || 1);
  }
  tabs.forEach((b) => {
    const on = b.dataset.v === view;
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  const m = $("#main");
  m.classList.remove("hasActiveDock");
  if (view === "record") renderRecord(m);
  else if (view === "history") renderHistory(m);
  else if (view === "analysis") renderAnalysis(m);
  else if (view === "sight") renderSight(m);
  else renderGear(m);
}

/* ---------- 記録 ---------- */
function setupOptions(sel) {
  return (
    `<option value="">（セッティング未指定）</option>` +
    db.setups
      .map(
        (s) => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${esc(s.name)}</option>`,
      )
      .join("")
  );
}
const RECORD_FLOW_MODES = [
  { id: "practice", icon: icon("target"), title: "練習記録", desc: "点取りから調整提案へ" },
  {
    id: "calibration",
    icon: icon("updown"),
    title: "サイト値を残す",
    desc: "サイト値・風メモも一緒に",
  },
  { id: "diagnosis", icon: icon("help"), title: "足りないデータを見る", desc: "提案の材料を確認" },
];
const RECORD_PHASES = ["準備", "記録", "確認", "蓄積"];
const SHOT_REASON_TAGS = [
  "良射",
  "押し手",
  "リリース",
  "クリッカー",
  "風",
  "狙いミス",
  "矢が怪しい",
  "不明",
];
function scorePct(v) {
  return Math.round(clamp(v || 0, 0, 1) * 100);
}
function readinessCellHtml(label, level, score) {
  return `<div class="readinessCell"><div class="k">${label}</div><b>${esc(level)}</b><div class="bar"><i style="width:${scorePct(score)}%"></i></div></div>`;
}
function recordPhaseArcHtml(step, subtitle) {
  const cur = Math.max(0, Math.min(RECORD_PHASES.length - 1, Math.round(step || 0)));
  const xs = [32, 130, 228, 326];
  const rails = xs
    .slice(0, -1)
    .map(
      (x, i) =>
        `<line class="seg ${i < cur ? "on" : ""} ${i === cur - 1 ? "cur" : ""}" x1="${x}" y1="18" x2="${xs[i + 1]}" y2="18"/>`,
    )
    .join("");
  const nodes = RECORD_PHASES.map(
    (label, i) => `<g>
      <circle class="node ${i <= cur ? "on" : ""} ${i === cur ? "cur" : ""}" cx="${xs[i]}" cy="18" r="10"/>
      <circle class="nodeCore" cx="${xs[i]}" cy="18" r="3.2"/>
      <text class="${i <= cur ? "on" : ""}" x="${xs[i]}" y="44" text-anchor="middle">${esc(label)}</text>
    </g>`,
  ).join("");
  return `<section class="phaseArc" aria-label="記録フロー">
    <svg viewBox="0 0 360 50" role="img" aria-hidden="true">
      <line class="rail" x1="32" y1="18" x2="326" y2="18"/>
      ${rails}
      ${nodes}
    </svg>
    ${subtitle ? `<div class="phaseSub">${esc(subtitle)}</div>` : ""}
  </section>`;
}
function recordCoachCardHtml() {
  return `<div class="coachCard">
    <img src="icon.svg" alt="">
    <div><b>3ステップで使います</b><span>条件を決める → 的でタップ → 結果で次の調整を見る</span></div>
  </div>`;
}
function recordIntroHtml(sys, mode) {
  const flow = RECORD_FLOW_MODES.map(
    (f) => `
      <button class="flowBtn ${mode === f.id ? "on" : ""}" data-mode="${f.id}"><span class="flowIcon">${f.icon}</span><span class="flowText"><b>${f.title}</b><span>${f.desc}</span></span></button>`,
  ).join("");
  const p = sys.profiles || {};
  const nf = nativeFeatureProfile();
  return `<section class="missionPanel convergeMission">
    <div class="missionTop">
      <img class="startLogoMark" src="icon.svg" alt="">
      <div>
        <div class="eyebrow">アーチェリー練習ノート</div>
        <h2>${mode === "calibration" ? "サイト値も残す" : "今日のズレを、次の一射へ。"}</h2>
      </div>
      <div class="readinessDial"><b>${scorePct(sys.score)}</b><span>${esc(sys.level)}</span></div>
    </div>
    <div class="simplePromise">記録する <span>→</span> ズレを見る <span>→</span> 次を決める</div>
    <details class="adv missionMore" ${mode === "calibration" ? "open" : ""}>
      <summary>詳しく使う</summary>
      <div class="readinessRail">
        ${readinessCellHtml("用具", p.gear ? p.gear.level : "低", p.gear ? p.gear.score : 0)}
        ${readinessCellHtml("履歴", p.model ? p.model.level : "データ蓄積中", p.model ? p.model.score : 0)}
        ${readinessCellHtml("物理校正", p.physics ? p.physics.level : "未校正", p.physics ? p.physics.score : 0)}
      </div>
      <div class="nativeSignal">
        <span class="on">${esc(nf.runtime.label)}</span>
        <span class="${nf.haptics ? "on" : ""}">触感${nf.haptics ? "ON" : "待ち"}</span>
        <span class="${nf.share ? "on" : ""}">共有${nf.share ? "ON" : "待ち"}</span>
      </div>
      <div class="missionFlow" id="flowMode">${flow}</div>
      <div class="missionNext"><b>次の材料</b><span>${esc(sys.next)} / ${sys.lines.map(esc).join(" / ")}</span></div>
    </details>
  </section>`;
}
function setupSystemSummary(setupId) {
  const setup = db.setups.find((s) => s.id === setupId);
  if (!setup)
    return {
      score: 0,
      level: "準備中",
      profiles: {},
      lines: ["用具セッティングを登録すると、サイト台帳・物理校正・個人モデルの材料が整います。"],
      next: "用具タブで初回セットアップ",
    };
  const gp = gearPrecisionProfile(setup),
    mp = modelReadinessProfile(setupId),
    pc = personalPhysicsCalibration(setupId),
    cp = calibrationProfile(setupId);
  const score = clamp(
    gp.score * 0.25 + mp.score * 0.25 + (pc ? pc.score * 0.28 : 0) + (cp ? cp.score * 0.22 : 0),
    0,
    1,
  );
  const level = levelFromScore(score, LEVELS.system);
  const next = [];
  if (gp.score < 0.65) next.push((gp.missing || [])[0] || "用具入力");
  if (mp.good < 5) next.push("6本以上の練習");
  if (cp.dists < 3) next.push("複数距離のサイト値");
  if (pc && pc.wind.sample < 2) next.push("横風メモつき練習");
  return {
    score,
    level,
    profiles: {
      gear: gp,
      model: mp,
      physics: pc || { score: 0, level: "未校正" },
      calibration: cp,
    },
    lines: [`用具 ${gp.level} / 履歴 ${mp.level} / 物理校正 ${pc ? pc.level : "未校正"}`],
    next: next.slice(0, 2).join("・") || "同条件で記録を重ねる",
  };
}
function recordSetupSnapshot(setupId, dist) {
  const setup = db.setups.find((s) => s.id === setupId);
  if (!setup)
    return `<div class="setupLens" id="setupLens">
    <div class="lensCard"><div class="k">セッティング</div><b>未指定</b></div>
    <div class="lensCard"><div class="k">サイト台帳</div><b>未接続</b></div>
  </div>`;
  const mk = dist ? latestMark(setupId, dist) : null;
  const markText = mk ? `上下 ${esc(mk.v || "—")} / 左右 ${esc(mk.h || "—")}` : "記録なし";
  return `<div class="setupLens" id="setupLens">
    <div class="lensCard"><div class="k">セッティング</div><b>${esc(setup.name)}</b></div>
    <div class="lensCard"><div class="k">${dist ? dist + "m サイト" : "サイト台帳"}</div><b>${markText}</b></div>
  </div>`;
}
function faceChoiceValue(sess) {
  if (!sess) return "122";
  if (sess.faceType === "triple") return "T40";
  if (sess.faceType === "field") return `F${sess.faceD || 80}`;
  return String(sess.faceD || 122);
}
function suggestedFaceValue(dist, last) {
  if (last && last.faceD) return faceChoiceValue(last);
  return String((dist || 70) >= 60 ? 122 : (dist || 70) <= 18 ? 40 : 80);
}
function actionFaceLabel(value) {
  const f = parseFaceChoice(value);
  if (f.faceType === "triple") return "40cm三つ目";
  if (f.faceType === "field") return `${f.faceD}cmフィールド`;
  return `${f.faceD}cm`;
}
function recordFastActionsHtml(last, dist, faceValue) {
  const currentLabel = `${dist}m / ${actionFaceLabel(faceValue)}`;
  /* 直前が多距離ラウンドのステージなら、押下時の挙動（ラウンドをステージ1から再開）に合わせたラベルにする */
  const lastRound = last && last.roundGroup ? roundLabel(last.roundGroup.roundId) : null;
  const lastTitle = lastRound ? `${lastRound}をもう一度` : "前回と同じ";
  const lastLabel = last
    ? lastRound
      ? "最初の距離から"
      : `${last.dist}m / ${actionFaceLabel(faceChoiceValue(last))}`
    : "なし";
  /* 金面はセッション票の「この条件で開始」1つだけに絞る（design-language: 金面は1画面1つ）。
     このバンドは墨面＋左に金アクセントバーの控えめな面。last が無い初回はセッション票の
     fStart だけが唯一のCTAになるようバンド自体を出さない */
  if (!last) return "";
  return `<section class="homeActions recordRepeatBand" aria-label="すぐ使う">
    <button class="homeAction repeatMain" id="quickStart" type="button">
      <span class="repeatEyebrow">${esc(lastTitle)}</span>
      <b id="quickStartMeta">${esc(currentLabel)}</b>
      <span class="repeatSub">${esc(lastLabel)}</span>
    </button>
    <button class="homeAction repeatHistory" id="quickHistory" type="button"><b>履歴</b><span>分析</span></button>
  </section>`;
}
/* 多距離ラウンド（IMP-09）: ラウンドIDが ROUND_TYPES に無く stages を持つ定義なら返す。それ以外は null */
function selectedMultiRound(roundId) {
  if (!roundId || ROUND_TYPES.some((r) => r.id === roundId)) return null;
  const def = findRoundDef(roundId);
  return def && Array.isArray(def.stages) && def.stages.length ? def : null;
}
/* 多距離ラウンドのステージ一覧を「計器の行程表」風に表示（目盛り＋距離降順の目盛り線）。
   当たり判定・記録ロジックには触れない、表示専用の集計 */
function multiRoundStageGaugeHtml(def) {
  const stages = def.stages;
  const maxDist = Math.max(...stages.map((st) => st.dist));
  const ticks = stages
    .map(
      (st, i) => `
    <div class="stageGaugeTick">
      <div class="stageGaugeMark" style="height:${8 + Math.round((st.dist / maxDist) * 18)}px"></div>
      <b>${st.dist}m</b><span>${st.arrows}射</span>
    </div>${i < stages.length - 1 ? `<div class="stageGaugeRail"></div>` : ""}`,
    )
    .join("");
  return `<div class="stageGauge" aria-label="${esc(def.label)}のステージ行程">${ticks}</div>`;
}
function renderRecord(m) {
  if (db.active) {
    renderActive(m);
    return;
  }
  const last = db.sessions[db.sessions.length - 1];
  const defSetup = last ? last.setupId : db.setups[0] ? db.setups[0].id : "";
  const defDist = last ? last.dist : 70;
  const mode = ui.recordMode || "practice";
  const defFace = suggestedFaceValue(defDist, last);
  const defPerEnd = last && last.perEnd ? last.perEnd : 6;
  m.innerHTML = `
  ${recordFastActionsHtml(last, defDist, defFace)}
  <section class="launchPanel convergeLaunch startFirst">
    <div class="launchHead">
      <div class="launchTitle"><div class="stepBadge">01</div><h2>${mode === "calibration" ? "サイト値を残す練習" : "条件を選ぶ"}</h2></div>
      <button class="tinyAction" id="jumpGear">用具</button>
    </div>
    <div class="launchBody">
    <label class="f">距離</label>
    <div class="chips quickDists" id="fDistChips">
      ${[70, 50, 30, 18].map((d) => `<button type="button" class="chip ${d === defDist ? "on" : ""}" aria-pressed="${d === defDist}" data-d="${d}">${d}m</button>`).join("")}
      <button type="button" class="chip" aria-pressed="false" data-d="custom">カスタム</button>
    </div>
    <div id="fDistCustomWrap" class="recordDistCustomWrap"><label class="f">距離 (m)</label><input class="inp" type="number" id="fDistCustom" min="5" max="90" step="1" placeholder="例: 60"></div>
    <div class="sessionCardRule" role="separator" aria-hidden="true"></div>
    <div class="quickSelects">
      <div><label class="f">的</label><select class="inp" id="fFace">
        <optgroup label="ターゲット">
          ${[122, 80, 60, 40].map((f) => `<option value="${f}" ${String(defFace) === String(f) ? "selected" : ""}>${f}cm</option>`).join("")}
          <option value="T40" ${defFace === "T40" ? "selected" : ""}>40cm 三つ目（縦）</option>
        </optgroup>
        <optgroup label="フィールド">
          ${FIELD_FACE_SIZES.map((f) => `<option value="F${f}" ${defFace === `F${f}` ? "selected" : ""}>${f}cm フィールド</option>`).join("")}
        </optgroup>
      </select></div>
      <div><label class="f">1エンドの本数</label><select class="inp" id="fArrows">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `<option value="${n}" ${n === defPerEnd ? "selected" : ""}>${n}本</option>`).join("")}</select></div>
    </div>
    <div class="sessionCardRule" role="separator" aria-hidden="true"></div>
    <div class="btnrow"><button class="btn startPrimary" id="fStart" data-testid="record-start">${mode === "calibration" ? "サイト値つきで開始" : "この条件で開始"}</button></div>
    <div class="sessionCondition">${recordSetupSnapshot(defSetup, defDist)}</div>
    <details class="adv recordDetails" ${mode === "calibration" ? "open" : ""}>
      <summary>詳しく残す</summary>
      <div class="fieldBand">
        <div><label class="f">用具セッティング</label><select class="inp" id="fSetup">${setupOptions(defSetup)}</select></div>
      </div>
      <label class="f">日付</label><input class="inp" type="date" id="fDate" value="${today()}">
      <label class="f">ラウンド</label><select class="inp" id="fRound">
        ${ROUND_TYPES.map((r) => `<option value="${r.id}">${r.label}</option>`).join("")}
        <optgroup label="多距離ラウンド">
          ${multiRoundDefs()
            .map((r) => `<option value="${r.id}">${esc(r.label)}</option>`)
            .join("")}
        </optgroup>
      </select>
      <div class="hint stageGaugeWrap" id="fRoundStages" style="display:none"></div>
      <div class="row">
        <div><label class="f">サイト 上下（目盛り）</label><input class="inp" id="fSightV" inputmode="decimal" placeholder="例: 5.4"></div>
        <div><label class="f">サイト 左右（目盛り）</label><input class="inp" id="fSightH" inputmode="decimal" placeholder="例: 2 / -1.5"></div>
      </div>
      <div class="hint">サイトの目盛りをそのまま記入（左右は<b>右なら 2、左なら -2</b>）。台帳に記録があれば自動入力されます。</div>
      <label class="f">天候・コンディション</label>
      <div class="row">
        <select class="inp" id="fWx"><option value="">—</option><option>晴れ</option><option>くもり</option><option>雨</option><option>風 弱</option><option>風 強</option><option>室内</option></select>
        <input class="inp" id="fNote" placeholder="${mode === "calibration" ? "例: サイト1目盛り確認" : "メモ（任意）"}" value="${mode === "calibration" ? "サイト値確認" : ""}">
      </div>
      <div class="row">
        <div><label class="f">風向</label><select class="inp" id="fWindDir"><option value="">—</option><option>向かい風</option><option>追い風</option><option>左から</option><option>右から</option><option>巻き風</option></select></div>
        <div><label class="f">風速 (m/s)</label><input class="inp" id="fWindSpeed" inputmode="decimal" placeholder="例: 2.5"></div>
      </div>
    </details>
    ${mode === "calibration" ? `<div class="advice recordNeutralAdvice"><div class="note"><b>サイト値を残すコツ</b> — サイト値を必ず入力し、風があれば風向/風速も残します。同じ距離で2回以上残ると履歴推定が強くなります。</div></div>` : ""}
    </div>
  </section>`;
  const distState = { d: defDist };
  const faceSel = $("#fFace");
  const suggestFace = (d) => {
    if (String(faceSel.value).startsWith("F")) return;
    faceSel.value = d >= 60 ? 122 : d <= 18 ? 40 : 80;
  };
  function updateQuickStartMeta() {
    const meta = $("#quickStartMeta");
    if (meta && distState.d)
      meta.textContent = `${distState.d}m / ${actionFaceLabel(faceSel.value)}`;
  }
  faceSel.onchange = () => {
    if (String(faceSel.value).startsWith("F") && $("#fArrows").value === "6")
      $("#fArrows").value = "3";
    updateQuickStartMeta();
  };
  /* 多距離ラウンド選択時: stage[0] の距離・的・本数へフォームを合わせ、ステージ一覧を1行表示する */
  function applyMultiRoundStage0(def) {
    const st0 = def.stages[0];
    distState.d = st0.dist;
    const known = [70, 50, 30, 18].includes(+st0.dist);
    const key = known ? String(st0.dist) : "custom";
    document.querySelectorAll("#fDistChips .chip").forEach((x) => {
      const on = String(x.dataset.d) === key;
      x.classList.toggle("on", on);
      x.setAttribute("aria-pressed", String(on));
    });
    $("#fDistCustomWrap").style.display = known ? "none" : "block";
    if (!known) $("#fDistCustom").value = st0.dist;
    faceSel.value =
      st0.faceType === "triple"
        ? "T40"
        : st0.faceType === "field"
          ? `F${st0.faceD}`
          : String(st0.faceD);
    $("#fArrows").value = st0.perEnd || 6;
    fillSight();
    refreshLens();
  }
  $("#fRound").onchange = (e) => {
    const def = selectedMultiRound(e.target.value);
    const stagesEl = $("#fRoundStages");
    if (def) {
      applyMultiRoundStage0(def);
      stagesEl.style.display = "block";
      stagesEl.innerHTML = `<div class="stageGaugeLabel">${esc(def.label)}</div>${multiRoundStageGaugeHtml(def)}`;
    } else {
      stagesEl.style.display = "none";
      stagesEl.textContent = "";
      if (e.target.value === "field72") {
        if (!String(faceSel.value).startsWith("F")) faceSel.value = "F80";
        $("#fArrows").value = "3";
      }
    }
    updateQuickStartMeta();
  };
  $("#jumpGear").onclick = () => showView("gear");
  const quickHistory = $("#quickHistory");
  if (quickHistory) quickHistory.onclick = () => showView("history");
  if (last) {
    /* 「前回と同じ」帯（quickStart, 元 quickRepeat）: 前回条件をフォームへ復元してから即開始する。
       金面は下のセッション票の fStart 1つだけに絞ったため、このボタン自体は墨面のまま */
    $("#quickStart").onclick = () => {
      distState.d = last.dist || defDist;
      const known = [70, 50, 30, 18].includes(+distState.d);
      const key = known ? String(distState.d) : "custom";
      document.querySelectorAll("#fDistChips .chip").forEach((x) => {
        const on = String(x.dataset.d) === key;
        x.classList.toggle("on", on);
        x.setAttribute("aria-pressed", String(on));
      });
      $("#fDistCustomWrap").style.display = known ? "none" : "block";
      if (!known) $("#fDistCustom").value = distState.d || "";
      faceSel.value = faceChoiceValue(last);
      $("#fArrows").value = last.perEnd || 6;
      $("#fSetup").value = last.setupId || "";
      $("#fRound").value = last.round || "free";
      fillSight();
      refreshLens();
      $("#fStart").click();
    };
  }
  document.querySelectorAll("#flowMode .flowBtn").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.mode === "diagnosis") {
          showView("sight");
          return;
        }
        ui.recordMode = b.dataset.mode;
        render();
      }),
  );
  function refreshLens() {
    const old = $("#setupLens");
    if (old) old.outerHTML = recordSetupSnapshot($("#fSetup").value, distState.d);
  }
  document.querySelectorAll("#fDistChips .chip").forEach(
    (c) =>
      (c.onclick = () => {
        document.querySelectorAll("#fDistChips .chip").forEach((x) => {
          x.classList.remove("on");
          x.setAttribute("aria-pressed", "false");
        });
        c.classList.add("on");
        c.setAttribute("aria-pressed", "true");
        if (c.dataset.d === "custom") {
          $("#fDistCustomWrap").style.display = "block";
          distState.d = null;
        } else {
          $("#fDistCustomWrap").style.display = "none";
          distState.d = +c.dataset.d;
          suggestFace(distState.d);
          fillSight();
        }
        updateQuickStartMeta();
        refreshLens();
      }),
  );
  $("#fDistCustom").oninput = (e) => {
    distState.d = +e.target.value || null;
    if (distState.d) {
      suggestFace(distState.d);
      fillSight();
    }
    updateQuickStartMeta();
    refreshLens();
  };
  function fillSight() {
    const sid = $("#fSetup").value,
      d = distState.d;
    if (!sid || !d) return;
    const mk = latestMark(sid, d);
    if (mk) {
      $("#fSightV").value = mk.v ?? "";
      $("#fSightH").value = mk.h ?? "";
    }
  }
  $("#fSetup").onchange = () => {
    fillSight();
    refreshLens();
  };
  fillSight();
  $("#fStart").onclick = () => {
    const roundId = $("#fRound").value || "free";
    const mdef = selectedMultiRound(roundId);
    const st0 = mdef ? mdef.stages[0] : null;
    const d = st0 ? st0.dist : distState.d;
    if (!d) {
      toast("距離を入力してください");
      return;
    }
    const fv = faceSel.value;
    /* 多距離ラウンドは dist/faceD/faceType/perEnd を stage[0] から採る */
    const face = st0
      ? { faceD: st0.faceD, faceType: st0.faceType || "single" }
      : parseFaceChoice(fv);
    db.active = {
      id: uid(),
      date: $("#fDate").value || today(),
      setupId: $("#fSetup").value || null,
      dist: d,
      faceD: face.faceD,
      faceType: face.faceType,
      perEnd: st0 ? st0.perEnd || 6 : +$("#fArrows").value,
      shaft: +lineCutRadius(face.faceD, face.faceType).toFixed(3),
      sightV: $("#fSightV").value.trim(),
      sightH: $("#fSightH").value.trim(),
      wx: $("#fWx").value,
      note: $("#fNote").value.trim(),
      windDir: $("#fWindDir").value,
      windSpeed: $("#fWindSpeed").value.trim(),
      round: roundId,
      purpose: ui.recordMode || "practice",
      ends: [],
      cur: [],
    };
    if (st0)
      db.active.roundGroup = { gid: uid(), roundId, stage: 0, stageCount: mdef.stages.length };
    nativePulse("success");
    save();
    render();
  };
}

function sessionArrows(sess) {
  return [...((sess && sess.ends) || []).flat(), ...((sess && sess.cur) || [])];
}
function arrowMetaSummaryHtml(sess) {
  const arrows = ((sess && sess.ends) || []).flat();
  const tagged = arrows.filter((a) => a && (a.reason || a.no));
  if (!tagged.length) return "";
  const reasons = {};
  const byNo = {};
  tagged.forEach((a) => {
    if (a.reason) reasons[a.reason] = (reasons[a.reason] || 0) + 1;
    if (a.no) {
      const k = String(a.no).trim();
      if (k) {
        const b = byNo[k] || (byNo[k] = { n: 0, x: 0, y: 0, score: 0, reasons: {} });
        b.n++;
        b.x += a.x || 0;
        b.y += a.y || 0;
        b.score += a.s || 0;
        if (a.reason) b.reasons[a.reason] = (b.reasons[a.reason] || 0) + 1;
      }
    }
  });
  const reasonLine = Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${esc(k)} ${v}本`)
    .join(" / ");
  const rows = Object.entries(byNo)
    .sort((a, b) => b[1].n - a[1].n || String(a[0]).localeCompare(String(b[0])))
    .slice(0, 6)
    .map(([no, b]) => {
      const rx = b.x / b.n,
        ry = b.y / b.n,
        avg = b.score / b.n;
      const topReason = Object.entries(b.reasons).sort((a, c) => c[1] - a[1])[0];
      return `<div class="note">#${esc(no)}: ${b.n}本 / 平均${avg.toFixed(1)} / ${cmOffsetText(rx, "x")}・${cmOffsetText(ry, "y")}${topReason ? ` / ${esc(topReason[0])} ${topReason[1]}本` : ""}</div>`;
    })
    .join("");
  return `<div class="advice recordNeutralAdvice">
    <div class="note"><b>矢番号・外れ理由メモ</b>${reasonLine ? ` — ${reasonLine}` : ""}</div>
    ${rows}
  </div>`;
}
function heroMetricHtml(k, b, span) {
  return `<div class="heroMetric"><div class="k">${esc(k)}</div><b>${esc(b)}</b><span>${esc(span || "")}</span></div>`;
}
function pageHeroHtml(type, ctx) {
  ctx = ctx || {};
  /* 分析タブにヒーローは置かない（結論→根拠→詳細の原則: 一等地は「今日の結論」カードが使う） */
  if (type === "history") {
    const src = ctx.ss || db.sessions || [];
    const sessionRows = historySessionRows(src);
    const arrows = sessionRows.flatMap((r) => r.arrows);
    const total = sessionRows.reduce((a, r) => a + r.total, 0);
    /* 結論→根拠: 説明文ではなく既存の todayConclusion() 計算をそのまま言い換えた1行だけを置く。
       新しい統計は作らない — 分析タブの「今日の結論」と同じ入力（buildAnalysisRows）を使う。
       数値枠は 練習・平均・最高合計 の3つに一本化（旧「記録サマリー」カードはここへ統合。
       「直近」はリスト先頭行が直近そのものなので数値枠には置かない） */
    const rows = ctx.rows || buildAnalysisRows(src, db.setups, sessionMetrics);
    const conclusion = todayConclusion(rows);
    const best = sessionRows
      .filter((r) => r.arrows.length)
      .sort(
        (a, b) =>
          b.total - a.total ||
          b.arrows.length - a.arrows.length ||
          (b.s.date || "").localeCompare(a.s.date || ""),
      )[0];
    const bestMeta = best
      ? [fmtD(best.s.date), distanceLabel(best.s.dist), `${best.arrows.length}本`]
          .filter(Boolean)
          .join(" / ")
      : "記録待ち";
    return `<section class="pageHero" data-testid="history-hero">
      <div class="kicker">履歴</div>
      <h2 class="pageHeroLead" data-testid="history-hero-trend">${esc(conclusion ? conclusion.text : "")}</h2>
      <div class="heroMetrics">
        ${heroMetricHtml("練習", `${src.length}回`, `${arrows.length}本を集計`)}
        ${heroMetricHtml("平均", arrows.length ? (total / arrows.length).toFixed(2) : "—", "フィルター後の平均点")}
        ${heroMetricHtml("最高合計", best ? `${best.total}` : "—", bestMeta)}
      </div>
    </section>`;
  }
  if (type === "sight") {
    const setup = ctx.setup,
      dist = ctx.dist,
      adv = ctx.adv,
      lastSess = ctx.lastSess;
    const sug = lastSess ? primarySightSuggestion(lastSess, setup, adv) : null;
    let body;
    if (!setup) {
      body = `<p class="pageHeroLead sightNowNote">用具セッティング未登録</p>`;
    } else if (!adv) {
      body = `<p class="pageHeroLead sightNowNote">この距離・用具の練習記録なし</p>`;
    } else if (!sug || sug.none) {
      body = `<div class="sightNow sightNowNeutral" data-testid="sight-now-suggestion">
        <div class="sightNowDir">${icon("target")}<span>調整不要</span></div>
        <p class="sightNowNote">グルーピング中心はほぼセンターです。今の設定のまま本数を重ねられます。</p>
      </div>`;
    } else {
      const arrowIcon = icon(sug.dir);
      const q = sessionQuality(lastSess, setup);
      body = `<div class="sightNow" data-testid="sight-now-suggestion">
        <div class="sightNowDir">${arrowIcon}<span>${sug.dirLabel}へ</span></div>
        <div class="sightNowAmount">${sug.clicks != null ? `${Math.abs(sug.clicks).toFixed(1)}<small>${esc(sug.clickLabel)}</small>` : `${sug.mm.toFixed(1)}<small>mm</small>`}</div>
        <p class="sightNowNote">${sug.clicks != null ? `目安 ${sug.mm.toFixed(1)}mm相当。` : ""}${sug.other ? " 上下・左右の両方に動きがあります（詳細は下）。" : ""} 信頼度 ${q.label}。</p>
      </div>`;
    }
    return `<section class="pageHero" data-testid="sight-hero">
      <div class="kicker">サイト調整</div>
      <h2 class="pageHeroLead">いまの提案</h2>
      ${body}
    </section>`;
  }
  return "";
}
function analysisFilterBarHtml(allRows, f) {
  const dists = [...new Set(allRows.map((r) => r.dist).filter(Boolean))].sort((a, b) => b - a);
  const periods = [
    ["all", "全期間"],
    ["3m", "3ヶ月"],
    ["1m", "1ヶ月"],
  ];
  return `<div class="card analysisFilterCard">
    <div class="row">
      <div><label class="f">用具</label><select class="inp" id="anSetup"><option value="">すべて</option><option value="__none" ${f.setupId === "__none" ? "selected" : ""}>未指定</option>${db.setups.map((s) => `<option value="${s.id}" ${f.setupId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
      <div><label class="f">距離</label><select class="inp" id="anDist"><option value="">すべて</option>${dists.map((d) => `<option value="${d}" ${String(f.dist) === String(d) ? "selected" : ""}>${d}m</option>`).join("")}</select></div>
    </div>
    <label class="f">期間</label>
    <div class="chips" id="anPeriods">${periods.map(([id, lb]) => `<button type="button" class="chip ${f.period === id ? "on" : ""}" aria-pressed="${f.period === id}" data-period="${id}">${lb}</button>`).join("")}</div>
  </div>`;
}
function analysisKpiHtml(rows) {
  const scored = rows.filter((r) => r.n);
  if (!scored.length) return "";
  const sorted = [...scored].sort(
    (a, b) => (a.date || "").localeCompare(b.date || "") || (a.id > b.id ? 1 : -1),
  );
  const arrows = scored.reduce((a, r) => a + r.n, 0);
  const avg = arrows ? scored.reduce((a, r) => a + r.total, 0) / arrows : 0;
  const ma = movingAverage(
    sorted.map((r) => r.avg),
    5,
  );
  const latestMa = ma.length ? ma[ma.length - 1] : null;
  const prevMa = ma.length > 1 ? ma[ma.length - 2] : null;
  const delta = latestMa != null && prevMa != null ? latestMa - prevMa : null;
  const trend =
    delta == null
      ? "—"
      : delta > 0.02
        ? `↑ +${delta.toFixed(2)}`
        : delta < -0.02
          ? `↓ ${delta.toFixed(2)}`
          : "→ 横ばい";
  const rrRows = sorted.filter((r) => r.st && Number.isFinite(r.st.rr));
  const latestRr = rrRows.length ? rrRows[rrRows.length - 1].st.rr : null;
  const bestRr = rrRows.length ? Math.min(...rrRows.map((r) => r.st.rr)) : null;
  const best = [...scored].sort(
    (a, b) => b.total - a.total || (b.date || "").localeCompare(a.date || ""),
  )[0];
  return `<div class="insightStrip">
    <div class="insightTile"><div class="k">平均点</div><b>${avg.toFixed(2)}</b><span>${scored.length}回 ${arrows}本 / 移動平均 ${trend}</span></div>
    <div class="insightTile"><div class="k">矢の集まり具合（グルーピング）</div><b>${latestRr != null ? latestRr.toFixed(1) + "cm" : "—"}</b><span>最新の半径(RMS) / 最小 ${bestRr != null ? bestRr.toFixed(1) + "cm" : "—"}</span></div>
    <div class="insightTile"><div class="k">最高合計</div><b>${best ? best.total : "—"}</b><span>${best ? [fmtD(best.date), best.dist ? `${best.dist}m` : "", `${best.n}本`].filter(Boolean).join(" / ") : "記録待ち"}</span></div>
  </div>`;
}
function analysisTrendChartHtml(rows) {
  const sorted = rows
    .filter((r) => r.n)
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.id > b.id ? 1 : -1));
  if (sorted.length < 3) return "";
  const avgs = sorted.map((r) => r.avg);
  const ma = movingAverage(avgs, 5).map((v, i) => (v == null ? avgs[i] : v));
  const W = 320,
    H = 96;
  const min = Math.min(...avgs, ...ma),
    max = Math.max(...avgs, ...ma),
    span = max - min || 1;
  const px = (i) => (i / (sorted.length - 1)) * W;
  const py = (v) => H - 10 - ((v - min) / span) * (H - 22);
  const maPath = ma
    .map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`)
    .join("");
  return `<div class="card"><h2>得点の推移 <span class="mini">${sorted.length}回 / 線は直近5回の移動平均</span></h2>
    <svg width="100%" viewBox="0 0 ${W} ${H}" style="max-height:${H + 20}px" role="img" aria-label="平均点（点/本）の推移">
      <title>得点推移チャート: ${sorted.length}回の練習、${min.toFixed(1)}〜${max.toFixed(1)}点/本</title>
      <text x="2" y="10" font-size="9" fill="var(--sub)">${max.toFixed(1)}点</text>
      <text x="2" y="${H - 2}" font-size="9" fill="var(--sub)">${min.toFixed(1)}点</text>
      ${sorted.map((r, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(r.avg).toFixed(1)}" r="3" fill="var(--green)" opacity=".5"/>`).join("")}
      <path d="${maPath}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linejoin="round"/>
    </svg>
    <div class="hint">丸は各練習の平均点（1本あたり）、線は移動平均です。用具・距離・期間で絞ると同条件の推移として読めます。</div>
  </div>`;
}
/* 多距離ラウンドの「ラウンド合計ベスト」行（IMP-09）: complete なグループのみ対象。
   roundGroup 付きの行が無ければ空文字（従来の自己ベスト表示は不変） */
function roundGroupBestRowsHtml(rows) {
  const bests = roundGroupBests(aggregateRoundGroups(rows));
  if (!bests.length) return "";
  return bests
    .sort((a, b) => b.total - a.total)
    .map(
      (b) => `<div class="listItem recordReadOnlyItem">
    <div><div class="t">${esc(roundLabel(b.roundId))} 合計</div><div class="d">完了ラウンドのベスト / ${fmtD(b.date)}</div></div>
    <div class="big">${b.total}<small> / ${b.arrows}射</small></div>
  </div>`,
    )
    .join("");
}
function personalBestCard(rows) {
  const pbs = personalBests(rows).slice(0, 6);
  const groupRows = roundGroupBestRowsHtml(rows);
  if (!pbs.length && !groupRows) return "";
  const body = pbs
    .map((g) => {
      const lb = [
        g.dist ? `${g.dist}m` : "距離未設定",
        g.round !== "free" ? roundLabel(g.round) : "自由練習",
      ].join(" ・ ");
      return `<div class="listItem recordReadOnlyItem">
      <div><div class="t">${esc(lb)}</div><div class="d">${g.sessions}回 / ベスト日 ${g.bestTotal ? fmtD(g.bestTotal.date) : "—"}${g.bestTotal ? ` / ${g.bestTotal.arrows}本` : ""}</div></div>
      <div class="big">${g.bestTotal ? g.bestTotal.total : "—"}<small> / 平均ベスト${g.bestAvg ? g.bestAvg.avg.toFixed(2) : "—"}</small></div>
    </div>`;
    })
    .join("");
  return `<div class="card"><h2>自己ベスト <span class="mini">距離×ラウンド別</span></h2>${body}${groupRows}</div>`;
}
function conditionSplitCard(rows) {
  const cs = conditionSplit(rows, isWindy);
  if (cs.windy.sessions < 2 || cs.calm.sessions < 2) return "";
  const line = (g) => `<div class="listItem recordReadOnlyItem">
    <div><div class="t">${esc(g.label)}</div><div class="d">${g.sessions}回 / ${g.arrows}本${g.biasX != null && Math.abs(g.biasX) >= 0.3 ? ` / 平均中心 ${cmOffsetText(g.biasX, "x")}` : ""}</div></div>
    <div class="big">${g.avg != null ? g.avg.toFixed(2) : "—"}<small> / 矢の集まり半径(RMS) ${g.avgRms != null ? g.avgRms.toFixed(1) + "cm" : "—"}</small></div>
  </div>`;
  return `<div class="card"><h2>風の有無で比べる <span class="mini">風あり vs 風なし</span></h2>${line(cs.calm)}${line(cs.windy)}
    <div class="hint">風の有無で平均点と矢の集まり方がどれだけ変わるかの俯瞰です。風ありの平均中心が横へ流れていれば、風待ちやエイムオフの効果を検討できます。</div></div>`;
}
function reasonBreakdownCard(rows) {
  const rb = reasonBreakdown(rows);
  if (rb.tagged < 5) return "";
  const body = rb.items
    .slice(0, 6)
    .map(
      (g) => `<div class="listItem recordReadOnlyItem">
    <div><div class="t">${esc(g.reason)}</div><div class="d">${g.count}本${Math.abs(g.mx || 0) >= 0.3 || Math.abs(g.my || 0) >= 0.3 ? ` / 平均ズレ ${driftText(g.mx || 0, g.my || 0)}` : ""}</div></div>
    <div class="big">${g.avg != null ? g.avg.toFixed(2) : "—"}<small> / 平均点</small></div>
  </div>`,
    )
    .join("");
  return `<div class="card"><h2>外れた理由の傾向 <span class="mini">${rb.tagged}本にタグ</span></h2>${body}
  <div class="hint">記録中に付けた理由タグ別の平均点と平均ズレ方向です。特定のタグが同じ方向へ寄っていれば、次の練習の重点候補になります。</div></div>`;
}
/* 「今日の結論」カード: 初心者文法の入口。既存の todayConclusion() の言い換え文をそのまま大きく出す。
   新しい統計計算はしない — 表示だけの薄いラッパー */
function todayConclusionCardHtml(rows) {
  const c = todayConclusion(rows);
  if (!c) return "";
  return `<div class="card todayConclusionCard" data-testid="today-conclusion">
    <div class="todayConclusionKicker">今日の結論</div>
    <p class="todayConclusionText">${esc(c.text)}</p>
  </div>`;
}
function renderAnalysis(m) {
  const f = ui.analysisFilter;
  const allRows = buildAnalysisRows(db.sessions, db.setups, sessionMetrics);
  const rows = filterAnalysisRows(allRows, {
    setupId: f.setupId,
    dist: f.dist,
    round: f.round,
    period: f.period,
    today: today(),
  });
  const ss = rows
    .map((r) => r.s)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id < a.id ? -1 : 1));
  const sessionRows = historySessionRows(ss);
  /* 全体構成（正本 5節）: 結論 → 得点の推移 → ばらつき(グルーピング) → サイト → 条件比較 → 月間 → その他。
     ロジックは変えず、既存カード関数の呼び出し順だけを並べ替える */
  const cards = [
    // 得点の推移
    analysisKpiHtml(rows),
    analysisTrendChartHtml(rows),
    scoreTrendCard(ss),
    // 矢の集まり具合（グルーピング＝ばらつき）
    groupingTrendCard(ss),
    groupingSummaryHtml(sessionRows),
    // サイト
    sightHistoryCard(ss),
    sightSummaryHtml(sessionRows, { setupId: "", dist: "" }),
    // 条件比較
    conditionSplitCard(rows),
    reasonBreakdownCard(rows),
    // 月間
    monthlyCard(ss),
    distTrendCard(ss),
    scoreDistCard(ss),
    // その他
    formTrackingCard(),
    personalBestCard(rows),
    setupPerformanceCard(ss),
    distanceSummaryHtml(sessionRows),
  ]
    .filter(Boolean)
    .join("");
  m.innerHTML = `${todayConclusionCardHtml(rows)}
  ${allRows.length ? analysisFilterBarHtml(allRows, f) : ""}
  ${cards || `<div class="card"><h2>分析</h2><div class="empty">${allRows.length ? "この絞り込みに合う記録がありません。フィルタを広げてください。" : `<p>記録が増えると、矢の集まり具合や月間まとめがここに表示されます。</p><button type="button" class="btn" id="anEmptyCta">記録タブへ</button>`}</div></div>`}`;
  const anSetup = $("#anSetup");
  if (anSetup)
    anSetup.onchange = (e) => {
      f.setupId = e.target.value;
      render();
    };
  const anDist = $("#anDist");
  if (anDist)
    anDist.onchange = (e) => {
      f.dist = e.target.value;
      render();
    };
  document.querySelectorAll("#anPeriods .chip[data-period]").forEach(
    (c) =>
      (c.onclick = () => {
        const hadFocus = !!(
          document.activeElement &&
          document.activeElement.closest &&
          document.activeElement.closest("#anPeriods")
        );
        f.period = c.dataset.period;
        render();
        if (hadFocus) {
          const chip = document.querySelector(`#anPeriods [data-period="${c.dataset.period}"]`);
          if (chip) chip.focus({ preventScroll: true });
        }
      }),
  );
  bindFormTrackingCard();
  const anCta = $("#anEmptyCta");
  if (anCta) anCta.onclick = () => showView("record");
}
/* HUD が使う3値（エンドn・合計・残り）と、折りたたみに回す詳細値をまとめて計算する。
   refreshActive() 側の状態モーション（数値ティック）も同じ計算を使う */
function liveHudMetrics(s) {
  const all = sessionArrows(s);
  const total = all.reduce((a, x) => a + x.s, 0);
  const avg = all.length ? (total / all.length).toFixed(2) : "—";
  const remain = Math.max(0, (s.perEnd || 6) - (s.cur || []).length);
  const r = ROUND_TYPES.find((x) => x.id === s.round);
  /* 多距離ラウンド中は「残り」をステージ規定射数（arrows）基準にする */
  const stageDef = sessionStageDef(s);
  const quota = stageDef && stageDef.arrows ? stageDef.arrows : r && r.arrows ? r.arrows : null;
  const roundRemain = quota ? Math.max(0, quota - all.length) : null;
  return {
    total,
    avg,
    endNo: s.ends.length + 1,
    remainText: roundRemain == null ? `${remain}` : String(roundRemain),
  };
}
function liveSessionHeroHtml(s, setup) {
  const hm = liveHudMetrics(s);
  const rg = s.roundGroup;
  /* 射場モードの「いま必要な3つ」= エンドn・合計・残り。用具名・平均・ステージ詳細は details へ畳む */
  return `<section class="liveHud compactHud" data-testid="active-hud" aria-label="記録中のスコア">
    <div class="liveContext">
      <span>${s._edit ? "過去記録の編集" : `${s.dist}m / ${faceLabel(s)}`}</span>
      <details class="liveHudMore"><summary>詳細</summary>
        <div class="liveHudMoreBody">
          <span>${setup ? esc(setup.name) : "用具未指定"}</span>
          <span>平均 ${hm.avg}</span>
          ${rg ? `<span>ステージ ${(+rg.stage || 0) + 1}/${rg.stageCount}・${s.dist}m</span>` : ""}
        </div>
      </details>
    </div>
    <div class="liveGrid liveGrid3" aria-live="polite" aria-atomic="true">
      <div class="liveCell"><div class="k">エンド</div><b class="tnum" id="hudEndNo">${hm.endNo}</b></div>
      <div class="liveCell"><div class="k">合計</div><b class="tnum" id="hudTotal">${hm.total}</b></div>
      <div class="liveCell"><div class="k">残り</div><b class="tnum" id="hudRemain">${hm.remainText}<small>本</small></b></div>
    </div>
  </section>`;
}
function activeGuideHtml() {
  if (db.settings.activeGuideSeen) return "";
  return `<details class="adv activeGuide" open>
    <summary>初回の操作ガイド</summary>
    <div class="guideLine"><b>記録</b><span>的をタップすると、その場所に1本入ります。少しずれたら矢チップを選びます。</span></div>
    <div class="guideLine"><b>精密モード</b><span>的を長押し（0.4秒）すると精密モードに切り替わり、指の移動量の1/4だけ矢が動きます。ルーペも表示されます。</span></div>
    <div class="guideLine"><b>微調整</b><span>選んだ矢だけ下の矢印で動かせます。押したままでも細かく合わせられます。</span></div>
    <div class="guideLine"><b>進行</b><span>${db.active && db.active.perEnd ? db.active.perEnd : 6}本入れたらエンド確定。最後はセッション終了で結果を見ます。</span></div>
    <button class="btn sm ghost activeGuideDone" id="activeGuideDone">次から表示しない</button>
  </details>`;
}
/* 多距離ラウンドの次ステージ定義。最終ステージ・編集モード・単一距離では null */
function nextStageDef(s) {
  const rg = s && s.roundGroup;
  if (!rg || s._edit) return null;
  const stage = Number(rg.stage) || 0;
  if (stage >= rg.stageCount - 1) return null;
  const def = findRoundDef(rg.roundId);
  return def && Array.isArray(def.stages) ? def.stages[stage + 1] || null : null;
}
function renderActive(m) {
  const s = db.active;
  const setup = db.setups.find((x) => x.id === s.setupId);
  const nextStage = nextStageDef(s);
  m.classList.add(
    "hasActiveDock",
  ); /* 固定操作列の高さ分、下部に呼吸を確保する（style.css: main.hasActiveDock） */
  m.innerHTML = `
  ${liveSessionHeroHtml(s, setup)}
  <div class="card targetFocusCard targetFocusWide">
    <div class="targetTools">
      <h2>記録中${s._edit ? "（過去記録の編集）" : ""} <span class="mini">${fmtD(s.date)} ・ ${s.dist}m ・ ${faceLabel(s)} ・ ${setup ? esc(setup.name) : "セッティング未指定"}</span></h2>
      ${
        s.faceType === "triple"
          ? ""
          : `<div class="chips" id="zoomChips">
        ${[
          [1, "全体"],
          [2, "×2"],
          [3, "×3"],
        ]
          .map(
            ([z, lb]) =>
              `<button type="button" class="chip ${(ui.zoom || 1) === z ? "on" : ""}" aria-pressed="${(ui.zoom || 1) === z}" data-z="${z}">${lb}</button>`,
          )
          .join("")}
      </div>`
      }
    </div>
    <div class="tgWrap tgWrapWide" id="tgWrap" data-testid="active-target">
      ${targetMarkup(s.faceD, "tg", s.faceType)}
      <div class="lens" id="lens"><svg id="lensSvg" width="122" height="122"><use href="#tgmain"/><g id="lensCross"></g></svg></div>
      <div class="lensTag" id="lensTag">微調整モード</div>
    </div>
    ${activeGuideHtml()}
    <div class="scoreChips" id="curChips" data-testid="active-arrow-chips"></div>
    <div class="nudge" id="nudge">
      <div class="recordNudgeHint">選択中の矢を微調整（1目盛 = ${(s.faceD / 200).toFixed(1)}cm）</div>
      <div class="npad">
        <span class="blank"></span><button data-n="u">▲</button><span class="blank"></span>
        <button data-n="l">◀</button><button class="recordNudgeDelete" data-n="del">${icon("trash")}</button><button data-n="r">▶</button>
        <span class="blank"></span><button data-n="d">▼</button><span class="blank"></span>
      </div>
      <div class="shotMeta" id="shotMeta"></div>
      <button class="btn sm ghost" id="nudgeDone">選択解除</button>
    </div>
    <details class="adv activeStatsMore"><summary>この練習の詳細</summary>
      <div class="statbar" id="statbar"></div>
    </details>
    ${nextStage ? `<div class="btnrow activeNextStageRow"><button class="btn sec" id="bNextStage">次の距離へ（${nextStage.dist}m）</button></div>` : ""}
  </div>
  <div class="card"><h2>エンド一覧</h2><div id="endsTbl"></div></div>
  <div class="activeActionDock" id="activeActionDock" data-testid="active-action-dock">
    <button class="btn ghost" id="bUndo" data-testid="active-undo">1本取消</button>
    <button class="btn sec" id="bEnd" data-testid="active-end">エンド確定</button>
    <button class="btn activeFinishBtn" id="bFinish" data-testid="active-finish">終了</button>
  </div>`;
  attachTargetInput(s);
  function applyZoom() {
    if (s.faceType === "triple") return;
    const M = ((s.faceD / 2) * 1.18) / (ui.zoom || 1);
    $("#tgsvg").setAttribute("viewBox", `${-M} ${-M} ${2 * M} ${2 * M}`);
  }
  document.querySelectorAll("#zoomChips .chip").forEach(
    (c) =>
      (c.onclick = () => {
        ui.zoom = +c.dataset.z;
        document.querySelectorAll("#zoomChips .chip").forEach((x) => {
          const on = x === c;
          x.classList.toggle("on", on);
          x.setAttribute("aria-pressed", String(on));
        });
        applyZoom();
      }),
  );
  applyZoom();
  $("#bUndo").onclick = () => {
    if (s.cur.length) {
      s.cur.pop();
      ui.selArrow = -1;
      nativePulse("light");
      save();
      refreshActive();
    } else toast("このエンドに矢がありません");
  };
  $("#bEnd").onclick = () => {
    if (!s.cur.length) {
      toast("矢を記録してください");
      return;
    }
    if (s.editIndex != null) {
      const at = Math.min(s.editIndex, s.ends.length);
      s.ends.splice(at, 0, s.cur);
      toast(`エンド${at + 1}を更新しました`);
      s.editIndex = null;
    } else {
      s.ends.push(s.cur);
      toast(`エンド${s.ends.length} 確定`);
    }
    s.cur = [];
    ui.selArrow = -1;
    nativePulse("success");
    save();
    refreshActive();
  };
  $("#bFinish").onclick = () => finishSession();
  const bNext = $("#bNextStage");
  if (bNext) bNext.onclick = () => advanceRoundStage();
  const guideDone = $("#activeGuideDone");
  if (guideDone)
    guideDone.onclick = () => {
      db.settings.activeGuideSeen = true;
      save("active-guide");
      render();
    };
  document
    .querySelectorAll("#nudge .npad button")
    .forEach((b) => (b.onclick = () => nudgeArrow(b.dataset.n)));
  $("#nudgeDone").onclick = () => {
    ui.selArrow = -1;
    refreshActive();
  };
  refreshActive();
}
function shotMetaHtml(a, index) {
  const tags = SHOT_REASON_TAGS.map(
    (tag) =>
      `<button type="button" class="reasonTag ${a.reason === tag ? "on" : ""}" aria-pressed="${a.reason === tag}" data-reason="${esc(tag)}">${esc(tag)}</button>`,
  ).join("");
  return `<div class="shotMetaGrid">
    <div>
      <label class="metaLabel" for="shotArrowNo">矢番号</label>
      <input class="inp" id="shotArrowNo" inputmode="numeric" maxlength="8" value="${esc(a.no || "")}" placeholder="${index + 1}">
    </div>
    <div>
      <span class="metaLabel">外れ理由</span>
      <div class="reasonTags" id="shotReasonTags">${tags}</div>
    </div>
  </div>`;
}
function bindShotMeta() {
  const s = db.active,
    a = s && s.cur && s.cur[ui.selArrow];
  if (!a) return;
  const no = $("#shotArrowNo");
  if (no)
    no.oninput = (e) => {
      a.no = e.target.value.trim();
      scheduleSave(
        "shot-meta",
      ); /* キーストロークごとの全量書き込みを避ける（flush は pagehide 等で保証） */
    };
  if (no) no.onchange = () => refreshActive();
  document.querySelectorAll("#shotReasonTags .reasonTag").forEach(
    (btn) =>
      (btn.onclick = () => {
        const reason = btn.dataset.reason;
        /* refreshActive() が #shotMeta を innerHTML で作り直すため、フォーカス中のタグを data-reason で復元する */
        const hadFocus = !!(
          document.activeElement &&
          document.activeElement.closest &&
          document.activeElement.closest("#shotReasonTags")
        );
        a.reason = a.reason === reason ? "" : reason;
        nativePulse("light");
        scheduleSave("shot-meta");
        refreshActive();
        if (hadFocus) {
          const back = document.querySelector(
            `#shotReasonTags .reasonTag[data-reason="${reason}"]`,
          );
          if (back) back.focus({ preventScroll: true });
        }
      }),
  );
}
/* motion:因果 — 矢の着弾座標（SVG座標系、yは上向き正）から4象限のどこから来たかを判定するだけの表示用ヘルパー。
   attachTargetInput の座標計算・当たり判定には一切関与しない */
function impactQuadrantClass(a) {
  const x = (a && a.x) || 0,
    y = (a && a.y) || 0;
  return `impactFrom-${y >= 0 ? "n" : "s"}${x >= 0 ? "e" : "w"}`;
}
/* motion:状態 — HUD の3値（エンド・合計・残り）が前回描画時と変わっていたら短いティッククラスを付ける。
   render() を跨いだ状態は #main の dataset に載せて持ち回す（DOM 再構築に強い） */
function updateHudMetrics(s) {
  const hud = $('[data-testid="active-hud"]');
  if (!hud) return;
  const hm = liveHudMetrics(s);
  const fields = [
    ["hudEndNo", String(hm.endNo)],
    ["hudTotal", String(hm.total)],
    ["hudRemain", hm.remainText],
  ];
  fields.forEach(([id, val]) => {
    const el = $("#" + id);
    if (!el) return;
    const prev = el.dataset.v;
    const textNode = el.firstChild;
    if (textNode && textNode.nodeType === 3) textNode.textContent = val;
    else el.textContent = val;
    if (prev != null && prev !== val) {
      el.classList.remove("tick");
      void el.offsetWidth;
      el.classList.add("tick");
    }
    el.dataset.v = val;
  });
}
/* 矢チップ列が固定操作列（activeActionDock）の裏に隠れていたら見える位置まで押し上げる。
   ドックは position:fixed のため通常の scrollIntoView はドックの高さを考慮しないので手計算する */
function revealChipsAboveDock(chipsBox, behavior) {
  const dock = $("#activeActionDock");
  if (!dock || !chipsBox) return;
  const dockTop = dock.getBoundingClientRect().top;
  const chipsBottom = chipsBox.getBoundingClientRect().bottom;
  const overlap = chipsBottom - dockTop;
  if (overlap > 0) window.scrollBy({ top: overlap + 12, behavior });
}
function refreshActive() {
  const s = db.active;
  if (!s) return;
  // markers
  let html = "";
  const gp = (a) => (s.faceType === "triple" ? { x: a.x, y: a.y + SPOT_Y[a.spot || 0] } : a);
  s.ends.forEach((end, ei) =>
    end.forEach((a) => {
      html += markCircle(gp(a), s.faceD, "rgba(60,60,60,.45)");
    }),
  );
  s.cur.forEach((a, i) => {
    html += markCircle(
      gp(a),
      s.faceD,
      i === ui.selArrow ? "#111" : "var(--green-l)",
      scoreLabel(a),
      i === ui.freshArrow ? "shotNew" : "",
    );
  });
  $("#tgmarks").innerHTML = html;
  // chips（innerHTML 全置換でフォーカス中のチップが消えるため、置換前に data-i を控えて復元する）
  const chipsBox = $("#curChips");
  const focused = document.activeElement;
  const focusI =
    focused && focused.classList && focused.classList.contains("sc") && chipsBox.contains(focused)
      ? focused.dataset.i
      : null;
  chipsBox.innerHTML =
    s.cur
      .map((a, i) => {
        const z = zoneStyle(a.s, a.X, s.faceType);
        /* motion:因果 — 的タップの着弾象限から得点チップが現れる方向を決める（表示のみ。当たり判定・座標計算は不変） */
        const fromCls = i === ui.freshArrow ? `fresh ${impactQuadrantClass(a)}` : "";
        return `<button type="button" class="sc ${i === ui.selArrow ? "sel" : ""} ${fromCls}" aria-pressed="${i === ui.selArrow}" data-i="${i}" style="background:${z.bg};color:${z.fg}"><span>${scoreLabel(a)}</span>${a.no ? `<small>#${esc(a.no)}</small>` : ""}</button>`;
      })
      .join("") ||
    `<span class="recordCurEmpty">エンド${s.ends.length + 1}：的をタップして記録</span>`;
  if (focusI != null) {
    const back = chipsBox.querySelector(`.sc[data-i="${focusI}"]`);
    if (back) back.focus({ preventScroll: true });
  }
  if (ui.freshArrow >= 0) {
    clearTimeout(ui.freshTimer);
    ui.freshTimer = setTimeout(() => {
      ui.freshArrow = -1;
      document
        .querySelectorAll(".shotNew,.sc.fresh")
        .forEach((el) => el.classList.remove("shotNew", "fresh"));
    }, 640);
    /* 記録直後は結果が動いたことが分かるよう滑らかに押し上げる */
    revealChipsAboveDock(chipsBox, "smooth");
  } else {
    /* 初期表示（再描画・タブ復帰含む）でもチップ行がドックの裏に隠れていたら、無演出で即座に押し上げる */
    revealChipsAboveDock(chipsBox, "instant");
  }
  document.querySelectorAll("#curChips .sc").forEach(
    (c) =>
      (c.onclick = () => {
        ui.selArrow = ui.selArrow === +c.dataset.i ? -1 : +c.dataset.i;
        nativePulse("light");
        refreshActive();
      }),
  );
  $("#nudge").classList.toggle("on", ui.selArrow >= 0);
  const meta = $("#shotMeta");
  if (meta) {
    const a = s.cur[ui.selArrow];
    meta.innerHTML = a ? shotMetaHtml(a, ui.selArrow) : "";
    if (a) bindShotMeta();
  }
  // stats
  const all = [...s.ends.flat(), ...s.cur];
  const total = all.reduce((a, x) => a + x.s, 0);
  $("#statbar").innerHTML = `
    <div class="stat"><b>${total}</b><span>合計</span></div>
    <div class="stat"><b>${all.length ? (total / all.length).toFixed(2) : "-"}</b><span>平均/本</span></div>
    <div class="stat"><b>${perfectScoreCount(all, s)}</b><span>${perfectScoreLabel(s)}</span></div>
    <div class="stat"><b>${secondaryScoreCount(all, s)}</b><span>${secondaryScoreLabel(s)}</span></div>`;
  /* motion:状態 — HUD の合計・残りが変わった時だけ短いティックを掛ける（値が同じなら再アニメしない） */
  updateHudMetrics(s);
  // ends table
  $("#endsTbl").innerHTML = s.ends.length
    ? `<table class="tbl"><tr><th>#</th><th>得点</th><th class="right">計</th><th></th></tr>` +
      s.ends
        .map((end, i) => {
          const sorted = [...end].sort((a, b) => b.s - a.s || (b.X ? 1 : 0) - (a.X ? 1 : 0));
          return `<tr><td><span class="histChip" style="background:${ENDCOLORS[i % ENDCOLORS.length]}"></span>${i + 1}</td>
        <td>${sorted.map(scoreLabel).join("・")}</td>
        <td class="right"><b>${end.reduce((a, x) => a + x.s, 0)}</b></td>
        <td class="right"><button class="btn sm ghost recordEndEditBtn" data-open="${i}">${icon("pencil")}</button></td></tr>`;
        })
        .join("") +
      `</table>`
    : `<div class="empty">確定したエンドはまだありません</div>`;
  document.querySelectorAll("#endsTbl [data-open]").forEach(
    (b) =>
      (b.onclick = () => {
        if (s.cur.length) {
          toast("先に現在のエンドを確定（または取消）してください");
          return;
        }
        s.editIndex = +b.dataset.open;
        s.cur = s.ends.splice(s.editIndex, 1)[0];
        ui.selArrow = -1;
        save();
        refreshActive();
        toast(`エンド${s.editIndex + 1}を編集中（確定で戻ります）`);
      }),
  );
}
function nudgeArrow(dirKey) {
  const s = db.active;
  if (!s || ui.selArrow < 0 || !s.cur[ui.selArrow]) return;
  if (dirKey === "del") {
    s.cur.splice(ui.selArrow, 1);
    ui.selArrow = -1;
    nativePulse("heavy");
    save();
    refreshActive();
    return;
  }
  const a = s.cur[ui.selArrow],
    step = s.faceD / 200;
  if (dirKey === "u") a.y += step;
  if (dirKey === "d") a.y -= step;
  if (dirKey === "l") a.x -= step;
  if (dirKey === "r") a.x += step;
  Object.assign(a, scoreAt(a.x, a.y, s.faceD, s.faceType, lineCutRadius(s.faceD, s.faceType)));
  nativePulse("light");
  scheduleSave("nudge");
  refreshActive();
}

/* target pointer input with long-press fine mode + lens */
function attachTargetInput(s) {
  const svg = $("#tgsvg"),
    lens = $("#lens"),
    lensSvg = $("#lensSvg"),
    lensTag = $("#lensTag"),
    cur = $("#tgcur");
  let drag = null,
    cursorFrame = 0,
    cursorPoint = null;
  const raf =
    window.requestAnimationFrame ||
    function (cb) {
      return setTimeout(cb, 16);
    };
  const caf = window.cancelAnimationFrame || clearTimeout;
  function clientPoint(e) {
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
    if (!t || t.clientX == null) return null;
    return {
      x: t.clientX,
      y: t.clientY,
      id: e.pointerId != null ? e.pointerId : t.identifier != null ? t.identifier : "mouse",
    };
  }
  function clientToSvg(x, y) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    if (window.DOMPoint) {
      const pt = new DOMPoint(x, y).matrixTransform(inv);
      return { x: pt.x, y: -pt.y };
    }
    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    const p = pt.matrixTransform(inv);
    return { x: p.x, y: -p.y };
  }
  function drawCursor(p) {
    const w = ringW(s.faceD, s.faceType);
    const fine = !!(drag && drag.fine);
    const cutting = fine && isLineCuttingFromGlobal(p.x, p.y, s.faceD, s.faceType);
    const c = fine ? (cutting ? "#0f9d58" : "#c62828") : "#111";
    lens.classList.toggle("cut", cutting);
    lens.classList.toggle("miss", fine && !cutting);
    lensTag.classList.toggle("cut", cutting);
    lensTag.classList.toggle("miss", fine && !cutting);
    if (fine) lensTag.textContent = cutting ? "線かみ" : "線なし";
    cur.innerHTML = `<g>
      <line x1="${p.x - w}" y1="${-p.y}" x2="${p.x + w}" y2="${-p.y}" stroke="${c}" stroke-width="${s.faceD / 500}"/>
      <line x1="${p.x}" y1="${-p.y - w}" x2="${p.x}" y2="${-p.y + w}" stroke="${c}" stroke-width="${s.faceD / 500}"/>
      <circle cx="${p.x}" cy="${-p.y}" r="${arrowMarkRadius(s.faceD)}" fill="none" stroke="${c}" stroke-width="${s.faceD / 400}"/>
    </g>`;
    const z = ringW(s.faceD, s.faceType) * 2.2;
    lensSvg.setAttribute("viewBox", `${p.x - z} ${-p.y - z} ${2 * z} ${2 * z}`);
    // lens位置: 指と重ならない側へ
    const half = p.x < 0;
    lens.style.left = half ? "auto" : "8px";
    lens.style.right = half ? "8px" : "auto";
    lensTag.style.left = half ? "auto" : "12px";
    lensTag.style.right = half ? "12px" : "auto";
  }
  function scheduleCursor(p) {
    cursorPoint = p;
    if (cursorFrame) return;
    cursorFrame = raf(() => {
      cursorFrame = 0;
      if (cursorPoint) drawCursor(cursorPoint);
    });
  }
  function resetDrag() {
    if (drag && drag.tm) clearTimeout(drag.tm);
    if (cursorFrame) {
      caf(cursorFrame);
      cursorFrame = 0;
    }
    cursorPoint = null;
    drag = null;
    cur.innerHTML = "";
    lens.style.display = "none";
    lens.classList.remove("fine", "cut", "miss");
    lensTag.classList.remove("fine", "cut", "miss");
    lensTag.style.display = "none";
  }
  svg.addEventListener("contextmenu", (e) => e.preventDefault());
  svg.addEventListener("selectstart", (e) => e.preventDefault());
  function down(e) {
    if (s.cur.length >= s.perEnd) {
      toast(`1エンド${s.perEnd}本です。「エンド確定」を押してください`);
      return;
    }
    const cp = clientPoint(e);
    if (!cp) return;
    e.preventDefault();
    if (e.pointerId != null && svg.setPointerCapture) {
      try {
        svg.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    const p = clientToSvg(cp.x, cp.y);
    drag = {
      p,
      raw: { x: cp.x, y: cp.y },
      fine: false,
      id: cp.id,
      tm: setTimeout(() => {
        if (drag) {
          drag.fine = true;
          lens.classList.add("fine");
          lensTag.classList.add("fine");
          lensTag.style.display = "block";
          scheduleCursor(drag.p);
        }
      }, 400),
    };
    lens.style.display = "block";
    lens.classList.remove("cut", "miss");
    lensTag.classList.remove("fine", "cut", "miss");
    lensTag.textContent = "位置調整中…";
    lensTag.style.display = "block";
    drawCursor(p);
  }
  function move(e) {
    const cp = clientPoint(e);
    if (!drag || !cp || cp.id !== drag.id) return;
    e.preventDefault();
    const a = clientToSvg(cp.x, cp.y);
    const b = clientToSvg(drag.raw.x, drag.raw.y);
    const k = drag.fine ? 0.25 : 1;
    drag.p = { x: drag.p.x + (a.x - b.x) * k, y: drag.p.y + (a.y - b.y) * k };
    drag.raw = { x: cp.x, y: cp.y };
    scheduleCursor(drag.p);
  }
  function up(e) {
    const cp = clientPoint(e);
    if (!drag || !cp || cp.id !== drag.id) return;
    e.preventDefault();
    clearTimeout(drag.tm);
    let MX = (s.faceD / 2) * 1.18,
      MY = MX;
    if (s.faceType === "triple") {
      MX = 14;
      MY = 36;
    }
    const p = {
      x: Math.max(-MX, Math.min(MX, drag.p.x)),
      y: Math.max(-MY, Math.min(MY, drag.p.y)),
    };
    resetDrag();
    const hit = hitFromGlobal(p.x, p.y, s.faceD, s.faceType, lineCutRadius(s.faceD, s.faceType));
    const rec = { x: +hit.x.toFixed(2), y: +hit.y.toFixed(2), s: hit.s, X: hit.X };
    if (hit.spot != null) rec.spot = hit.spot;
    s.cur.push(rec);
    ui.freshArrow = s.cur.length - 1;
    nativePulse(isLineCuttingFromGlobal(p.x, p.y, s.faceD, s.faceType) ? "success" : "light");
    scheduleSave("arrow-add");
    refreshActive();
    toast(`${scoreLabel(hit)} 点を記録`);
  }
  function cancel(e) {
    const cp = clientPoint(e);
    if (!drag || !cp || cp.id === drag.id) resetDrag();
  }
  if (window.PointerEvent) {
    svg.addEventListener("pointerdown", down);
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", cancel);
  } else {
    svg.addEventListener("touchstart", down, { passive: false });
    svg.addEventListener("touchmove", move, { passive: false });
    svg.addEventListener("touchend", up, { passive: false });
    svg.addEventListener("touchcancel", cancel, { passive: false });
    svg.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }
}

/* 多距離ラウンド: 現ステージを db.sessions へ確定し、次ステージの active を自動生成する（IMP-09）。
   ステージ確定は重要操作なので scheduleSave ではなく同期 save() を使う。サマリは挟まず toast のみ */
async function advanceRoundStage() {
  const s = db.active;
  const next = s ? nextStageDef(s) : null;
  if (!next) {
    toast("次のステージ定義が見つかりません");
    return;
  }
  const shot = s.ends.flat().length + s.cur.length;
  if (!shot) {
    toast("このステージの矢がまだありません");
    return;
  }
  const stageDef = sessionStageDef(s);
  if (
    stageDef &&
    stageDef.arrows &&
    shot < stageDef.arrows &&
    !(await appConfirm(
      `このステージは ${shot}/${stageDef.arrows} 射です。確定して次の距離へ進みますか？`,
      { okLabel: "次の距離へ" },
    ))
  )
    return;
  if (s.cur.length) {
    if (s.editIndex != null) s.ends.splice(Math.min(s.editIndex, s.ends.length), 0, s.cur);
    else s.ends.push(s.cur);
    s.cur = [];
  }
  delete s.cur;
  delete s.editIndex;
  db.sessions.push(s);
  const rg = s.roundGroup;
  const nextFaceType = next.faceType || "single";
  /* サイト値は次距離の台帳最新値からプリフィル（latestMark を再利用） */
  const mk = s.setupId ? latestMark(s.setupId, next.dist) : null;
  db.active = {
    id: uid(),
    date: s.date,
    setupId: s.setupId,
    dist: next.dist,
    faceD: next.faceD,
    faceType: nextFaceType,
    perEnd: next.perEnd || 6,
    shaft: +lineCutRadius(next.faceD, nextFaceType).toFixed(3),
    sightV: mk && mk.v != null ? String(mk.v).trim() : "",
    sightH: mk && mk.h != null ? String(mk.h).trim() : "",
    wx: s.wx,
    note: s.note,
    windDir: s.windDir,
    windSpeed: s.windSpeed,
    round: s.round,
    roundGroup: {
      gid: rg.gid,
      roundId: rg.roundId,
      stage: (Number(rg.stage) || 0) + 1,
      stageCount: rg.stageCount,
    },
    purpose: s.purpose,
    ends: [],
    cur: [],
  };
  ui.selArrow = -1;
  nativePulse("success");
  save();
  toast(`${next.dist}m を開始（ステージ ${(Number(rg.stage) || 0) + 2}/${rg.stageCount}）`);
  render();
}

async function finishSession() {
  const s = db.active;
  const shot = s.ends.flat().length + s.cur.length;
  const rg = s.roundGroup;
  if (!shot) {
    /* 多距離ラウンドで確定済みステージがあれば、破棄されるのが現ステージだけと分かる文言にする */
    const doneStages =
      rg && rg.gid
        ? db.sessions.filter((x) => x && x.roundGroup && x.roundGroup.gid === rg.gid).length
        : 0;
    const msg = doneStages
      ? `このステージを破棄しますか？（確定済みの ${doneStages} ステージは履歴に残ります）`
      : "矢が0本です。このセッションを破棄しますか？";
    if (await appConfirm(msg, { danger: true, okLabel: "破棄" })) {
      db.active = null;
      nativePulse("heavy");
      save();
      render();
    }
    return;
  }
  /* 多距離ラウンド途中（最終ステージ以外）の終了は appConfirm を挟む。編集モード・単一距離は従来どおり */
  if (
    rg &&
    !s._edit &&
    (Number(rg.stage) || 0) < rg.stageCount - 1 &&
    !(await appConfirm(
      `ラウンド途中です（${(Number(rg.stage) || 0) + 1}/${rg.stageCount}）。ここで終了すると残りのステージは記録できません。終了しますか？`,
      { okLabel: "終了する" },
    ))
  )
    return;
  if (s.cur.length) {
    if (s.editIndex != null) s.ends.splice(Math.min(s.editIndex, s.ends.length), 0, s.cur);
    else s.ends.push(s.cur);
    s.cur = [];
  }
  delete s.cur;
  delete s.editIndex;
  const isEdit = !!s._edit;
  delete s._edit;
  db.active = null;
  if (isEdit) {
    const i = db.sessions.findIndex((x) => x.id === s.id);
    if (i >= 0) db.sessions[i] = s;
    else db.sessions.push(s);
  } else {
    db.sessions.push(s);
  }
  nativePulse("success");
  save();
  openSummary(s, !isEdit);
}

/* ---------- summary modal ---------- */
/* 多距離ラウンドのラウンド合計ブロック: 同 gid の全ステージを aggregateRoundGroups で束ねる。
   roundGroup の無い単一距離セッションでは空文字（サマリ不変） */
function roundGroupSummaryHtml(sess) {
  const rg = sess && sess.roundGroup;
  if (!rg || !rg.gid) return "";
  const rows = buildAnalysisRows(
    db.sessions.filter((x) => x && x.roundGroup && x.roundGroup.gid === rg.gid),
    db.setups,
    sessionMetrics,
  );
  const g = aggregateRoundGroups(rows)[0];
  if (!g || !g.stages.length) return "";
  const breakdown = g.stages.map((st) => `${st.dist}m ${st.total}点`).join(" / ");
  return `<div class="advice recordNeutralAdvice">
    <div class="note"><b>${esc(roundLabel(rg.roundId))} 合計 ${g.total}</b> / ${g.arrows}射${g.complete ? "" : `（${g.stages.length}/${rg.stageCount}ステージ）`}</div>
    <div class="note">${esc(breakdown)}</div>
  </div>`;
}
function openSummary(sess, isNew) {
  const setup = db.setups.find((x) => x.id === sess.setupId);
  const m = sessionMetrics(sess);
  const all = m.all,
    total = m.total,
    st = m.st;
  const adv = adviceFor(sess, setup);
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  ovl.innerHTML = `<div class="sheet">
    <h3>${isNew ? "おつかれさまでした！" : ""} ${fmtD(sess.date)} ・ ${sess.dist}m</h3>
    ${summaryDecisionHtml(adv, sess)}
    <div class="statbar">
      <div class="stat"><b>${total}</b><span>合計 (${all.length}本)</span></div>
      <div class="stat"><b>${(total / all.length).toFixed(2)}</b><span>平均/本</span></div>
      <div class="stat"><b>${perfectScoreCount(all, sess)}</b><span>${perfectScoreLabel(sess)}</span></div>
      <div class="stat"><b>${secondaryScoreCount(all, sess)}</b><span>${secondaryScoreLabel(sess)}</span></div>
    </div>
    ${roundGroupSummaryHtml(sess)}
    <div id="sumPlot" class="recordSummaryPlot"></div>
    ${groupSummaryHtml(st)}
    ${summarySightDialHtml(sess, adv)}
    ${nextActionHtml(sess, adv, setup)}
    <details class="adv summaryDetails">
      <summary>詳しい根拠を見る</summary>
      ${confidenceNoteHtml("calc")}
      ${trustHtml(sess, setup, st)}
      ${roundProgressHtml(sess)}
      ${sess.sightV || sess.sightH ? `<div class="kv"><span>使用サイト</span><span>上下 ${esc(sess.sightV || "—")} / 左右 ${esc(sess.sightH || "—")}</span></div>` : ""}
      ${arrowMetaSummaryHtml(sess)}
      ${
        adv
          ? `<div class="advice"><div class="recordAdviceLabel">サイト調整の提案</div>${adv.lines.map((l) => `<div class="dir">${l.html}</div>`).join("")}
        ${judgementHtml(adv, sess)}
        ${shapeNote(adv.st)}
        ${adv.notes.map((n) => `<div class="note">・${n}</div>`).join("")}
        <div class="note">※「矢の集まった方向へサイトを動かす」が原則。mm目安はアイ〜サイト距離 ${db.settings.eyeSight || 850}mm と弾道モデルから計算した参考値です（サイトタブで変更可）。</div></div>`
          : ""
      }
      ${personalModelHtml(adv, sess, setup)}
      ${conditionHtml(sess, st, setup)}
    </details>
    ${sess.setupId && (sess.sightV || sess.sightH) ? `<div class="btnrow"><button class="btn sec" id="sumMark">${icon("ledger")} このサイト値を台帳に記録</button></div>` : ""}
    <div class="btnrow"><button class="btn sec" id="sumCard">画像保存</button><button class="btn ghost" id="sumClose">閉じる</button></div>
  </div>`;
  openModal(ovl, { escapeTarget: "#sumClose" });
  plotSession(sess, ovl.querySelector("#sumPlot"));
  const mk = ovl.querySelector("#sumMark");
  if (mk)
    mk.onclick = () => {
      db.sightMarks.push({
        id: uid(),
        setupId: sess.setupId,
        dist: sess.dist,
        v: sess.sightV,
        h: sess.sightH,
        date: sess.date,
        ts: Date.now(),
        note: `練習記録より（${all.length}本 / 平均${(total / all.length).toFixed(1)}）`,
      });
      save();
      toast("サイト台帳に記録しました");
      mk.disabled = true;
    };
  ovl.querySelector("#sumCard").onclick = () => exportScorecardImage(sess);
  ovl.querySelector("#sumClose").onclick = () => {
    closeModal(ovl);
    render();
  };
}

/* ---------- 履歴 ---------- */
function historySessionRows(src) {
  const rows = Array.isArray(src) ? src : [];
  const arrowsOf = (s) =>
    Array.isArray(s && s.ends) ? s.ends.flatMap((end) => (Array.isArray(end) ? end : [])) : [];
  const scoreOf = (a) => {
    const v = Number(a && a.s);
    return Number.isFinite(v) ? v : 0;
  };
  return rows.map((s) => {
    const arrows = arrowsOf(s);
    const total = arrows.reduce((a, x) => a + scoreOf(x), 0);
    return { s, arrows, total };
  });
}
function historySummaryDetailsHtml(sessionRows, filter) {
  return `${distanceSummaryHtml(sessionRows)}${sightSummaryHtml(sessionRows, filter)}${groupingSummaryHtml(sessionRows)}`;
}
function scoreTrendCard(ss) {
  const rows = historySessionRows(ss)
    .filter((r) => r.arrows.length)
    .slice(0, 8);
  if (!rows.length) return "";
  const body = rows
    .map((r) => {
      const avg = r.arrows.length ? r.total / r.arrows.length : null;
      const avgText = Number.isFinite(avg) ? avg.toFixed(2) : "—";
      const totalText = Number.isFinite(r.total) ? String(r.total) : "—";
      const date = r.s && r.s.date ? fmtD(r.s.date) : "日付未設定";
      const dist = distanceLabel(r.s && r.s.dist);
      return `<div class="listItem recordReadOnlyItem">
      <div><div class="t">${esc(date)}</div><div class="d">${esc(dist)} / ${r.arrows.length}本</div></div>
      <div class="big">${avgText}<small> / 合計${totalText}</small></div>
    </div>`;
    })
    .join("");
  return `<div class="card"><h2>直近の得点 <span class="mini">直近${rows.length}回</span></h2>${body}</div>`;
}
function setupPerformanceLabel(setupId) {
  if (!setupId) return { key: "setup:none", label: "セットアップ未設定" };
  const setup = (db.setups || []).find((s) => s.id === setupId);
  if (setup) return { key: `setup:${setup.id}`, label: setup.name || "名称未設定" };
  return { key: "setup:deleted", label: "削除済みセットアップ" };
}
function setupPerformanceCard(ss) {
  const rows = historySessionRows(ss);
  const groups = new Map();
  rows.forEach((r) => {
    const info = setupPerformanceLabel(r.s && r.s.setupId);
    const g = groups.get(info.key) || {
      label: info.label,
      sessions: 0,
      arrows: 0,
      total: 0,
      best: null,
      latestDate: "",
    };
    g.sessions++;
    g.arrows += r.arrows.length;
    g.total += r.total;
    const date = (r.s && r.s.date) || "";
    if (date > g.latestDate) g.latestDate = date;
    if (
      r.arrows.length &&
      (!g.best ||
        r.total > g.best.total ||
        (r.total === g.best.total && date > (g.best.date || "")))
    ) {
      g.best = { total: r.total, date, arrows: r.arrows.length };
    }
    groups.set(info.key, g);
  });
  const list = [...groups.values()]
    .filter((g) => g.sessions)
    .sort(
      (a, b) =>
        b.sessions - a.sessions ||
        (b.latestDate || "").localeCompare(a.latestDate || "") ||
        (b.arrows ? b.total / b.arrows : -1) - (a.arrows ? a.total / a.arrows : -1) ||
        a.label.localeCompare(b.label),
    );
  if (!list.length) return "";
  const body = list
    .map((g) => {
      const avg = g.arrows ? g.total / g.arrows : null;
      const avgText = Number.isFinite(avg) ? avg.toFixed(2) : "—";
      const bestText = g.best && Number.isFinite(g.best.total) ? String(g.best.total) : "—";
      const latest = g.latestDate ? fmtD(g.latestDate) : "—";
      return `<div class="listItem recordReadOnlyItem">
      <div><div class="t">${esc(g.label)}</div><div class="d">記録 ${g.sessions}回 / 矢数 ${g.arrows} / 最新 ${esc(latest)}</div></div>
      <div class="big">${avgText}<small> / 最高${bestText}</small></div>
    </div>`;
    })
    .join("");
  return `<div class="card"><h2>用具ごとの成績 <span class="mini">${list.length}件</span></h2>${body}</div>`;
}
function sightHistoryCard(ss) {
  const markRows = (Array.isArray(db.sightMarks) ? db.sightMarks : [])
    .filter((m) => hasSightInput(m && m.v) || hasSightInput(m && m.h))
    .map((m) => Object.assign({ source: "台帳" }, m));
  const sessionRows = (Array.isArray(ss) ? ss : [])
    .filter((s) => hasSightInput(s && s.sightV) || hasSightInput(s && s.sightH))
    .map((s) => ({
      source: "練習",
      setupId: s.setupId,
      dist: s.dist,
      v: s.sightV,
      h: s.sightH,
      date: s.date,
      ts: 0,
    }));
  const rows = [...markRows, ...sessionRows]
    .map((row) => {
      const date = sightDateInfo(row);
      const setup = setupPerformanceLabel(row.setupId);
      const distInfo = distanceBucketInfo(row.dist);
      return { row, date, setup, distInfo };
    })
    .sort(
      (a, b) =>
        (b.date.sort || "").localeCompare(a.date.sort || "") ||
        (b.distInfo.sort > 0 ? 1 : 0) - (a.distInfo.sort > 0 ? 1 : 0) ||
        (b.setup.key === "setup:none" ? 0 : 1) - (a.setup.key === "setup:none" ? 0 : 1) ||
        a.setup.label.localeCompare(b.setup.label),
    )
    .slice(0, 10);
  if (!rows.length) return "";
  const body = rows
    .map(({ row, date, setup, distInfo }) => {
      return `<div class="listItem recordReadOnlyItem">
      <div><div class="t">${esc(date.label)} ・ ${esc(distInfo.label)}</div><div class="d">${esc(setup.label)} / ${esc(row.source || "履歴")}</div></div>
      <div class="big">上下 ${esc(sightValueText(row.v))}<small> / 左右${esc(sightValueText(row.h))}</small></div>
    </div>`;
    })
    .join("");
  return `<div class="card"><h2>サイト値の記録 <span class="mini">直近${rows.length}件</span></h2>${body}</div>`;
}
/* 旧 historyOverviewHtml（記録サマリー insightStrip）は履歴ヒーローへ統合済み（UI-P3 差し戻し対応）。
   同種数値の二重掲示（練習回数・平均点の重複）を避けるため、履歴一覧の集計数値はヒーロー1箇所のみ */
function distanceLabel(dist) {
  return distanceBucketInfo(dist).label;
}
function distanceBucketInfo(dist) {
  const n = Number(dist);
  if (Number.isFinite(n) && n > 0) {
    const rounded = Math.round(n * 10) / 10;
    const label = `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}m`;
    return { key: `dist:${label}`, label, sort: rounded };
  }
  return { key: "dist:none", label: "距離未設定", sort: -1 };
}
function historyAnalysisDetailsHtml(title, meta, bodyHtml) {
  if (!bodyHtml) return "";
  return `<details class="adv historyAnalysisDetails">
    <summary>${esc(title)} <span class="mini">${esc(meta || "")}</span></summary>
    ${bodyHtml}
  </details>`;
}
function distanceSummaryHtml(sessionRows) {
  const byDist = new Map();
  sessionRows.forEach((r) => {
    const info = distanceBucketInfo(r.s && r.s.dist);
    const g = byDist.get(info.key) || {
      label: info.label,
      sort: info.sort,
      sessions: 0,
      arrows: 0,
      total: 0,
      best: null,
      latestDate: "",
    };
    g.sessions++;
    g.arrows += r.arrows.length;
    g.total += r.total;
    if (((r.s && r.s.date) || "") > g.latestDate) g.latestDate = r.s.date || "";
    if (
      r.arrows.length &&
      (!g.best ||
        r.total > g.best.total ||
        (r.total === g.best.total && ((r.s && r.s.date) || "") > (g.best.date || "")))
    ) {
      g.best = { total: r.total, date: (r.s && r.s.date) || "", arrows: r.arrows.length };
    }
    byDist.set(info.key, g);
  });
  const rows = [...byDist.values()].sort(
    (a, b) => b.sort - a.sort || b.sessions - a.sessions || a.label.localeCompare(b.label),
  );
  if (!rows.length) return "";
  const body = rows
    .map((g) => {
      const avg = g.arrows ? (g.total / g.arrows).toFixed(2) : "—";
      const latest = g.latestDate ? fmtD(g.latestDate) : "—";
      return `<div class="listItem recordReadOnlyItem">
        <div><div class="t">${esc(g.label)}</div><div class="d">${g.sessions}回 / ${g.arrows}本 / 最新 ${esc(latest)}</div></div>
        <div class="big">${avg}<small> / 最高${g.best ? g.best.total : "—"}</small></div>
      </div>`;
    })
    .join("");
  return historyAnalysisDetailsHtml("距離ごとのまとめ", `${rows.length}距離`, body);
}
function sightValueText(v) {
  const raw = String(v == null ? "" : v).trim();
  if (!raw) return "—";
  const n = Number(raw);
  return Number.isFinite(n) ? raw : "—";
}
function hasSightInput(v) {
  return v != null && String(v).trim() !== "";
}
function sightDateInfo(item) {
  const iso = String((item && item.date) || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { sort: iso, label: fmtD(iso) };
  const ts = Number(item && item.ts);
  if (Number.isFinite(ts) && ts > 0) {
    const d = new Date(ts);
    if (Number.isFinite(d.getTime())) {
      const y = d.getFullYear(),
        m = String(d.getMonth() + 1).padStart(2, "0"),
        day = String(d.getDate()).padStart(2, "0");
      const fallback = `${y}-${m}-${day}`;
      return { sort: fallback, label: fmtD(fallback) };
    }
  }
  return { sort: "", label: "—" };
}
function setupNameFor(id) {
  const setup = (db.setups || []).find((s) => s.id === id);
  return setup && setup.name ? setup.name : "用具未指定";
}
function sightSummaryHtml(sessionRows, filter) {
  const hf = filter || ui.histFilter || { setupId: "", dist: "" };
  const setupOk = (id) => !hf.setupId || (hf.setupId === "__none" ? !id : hf.setupId === id);
  const distOk = (dist) => !hf.dist || String(dist) === String(hf.dist);
  const markRows = (Array.isArray(db.sightMarks) ? db.sightMarks : [])
    .filter((m) => setupOk(m && m.setupId) && distOk(m && m.dist))
    .map((m) => Object.assign({ source: "台帳" }, m));
  const sessionSightRows = (sessionRows || [])
    .map((r) => r.s)
    .filter((s) => s && (hasSightInput(s.sightV) || hasSightInput(s.sightH)))
    .map((s) => ({
      source: "練習",
      setupId: s.setupId,
      dist: s.dist,
      v: s.sightV,
      h: s.sightH,
      date: s.date,
      ts: 0,
    }));
  const rows = [...markRows, ...sessionSightRows];
  if (!rows.length) return "";
  const byDist = new Map();
  rows.forEach((row) => {
    const info = distanceBucketInfo(row.dist);
    const date = sightDateInfo(row);
    const current = byDist.get(info.key) || {
      label: info.label,
      sort: info.sort,
      markCount: 0,
      sessionCount: 0,
      latest: null,
    };
    if (row.source === "台帳") current.markCount++;
    else current.sessionCount++;
    const candidate = { row, date, setupName: setupNameFor(row.setupId) };
    if (
      !current.latest ||
      date.sort > current.latest.date.sort ||
      (date.sort === current.latest.date.sort && row.source === "台帳")
    ) {
      current.latest = candidate;
    }
    byDist.set(info.key, current);
  });
  const groups = [...byDist.values()].sort(
    (a, b) =>
      b.sort - a.sort ||
      ((b.latest && b.latest.date.sort) || "").localeCompare(
        (a.latest && a.latest.date.sort) || "",
      ) ||
      a.label.localeCompare(b.label),
  );
  const totalMarks = markRows.length,
    totalSessions = sessionSightRows.length;
  const body = groups
    .map((g) => {
      const latest = g.latest || {};
      const row = latest.row || {};
      return `<div class="listItem recordReadOnlyItem">
        <div><div class="t">${esc(g.label)}</div><div class="d">${esc(latest.setupName || "用具未指定")} / 最新 ${esc(latest.date ? latest.date.label : "—")} / 台帳${g.markCount}・練習${g.sessionCount}</div></div>
        <div class="big">${esc(sightValueText(row.v))}<small> / 左右${esc(sightValueText(row.h))}</small></div>
      </div>`;
    })
    .join("");
  return historyAnalysisDetailsHtml(
    "サイト値のまとめ",
    `台帳${totalMarks}件 / 練習入力${totalSessions}回`,
    body,
  );
}
function groupingMetricNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function groupingMetricText(v) {
  const n = groupingMetricNumber(v);
  return n == null ? "—" : `${n.toFixed(1)}cm`;
}
function groupingSessionRow(row) {
  /* robustStats 直呼びはやめ、同じ Number 化＋有限フィルタ済みの sessionMetrics キャッシュを経由する */
  const st = row && row.s ? sessionMetrics(row.s).st : null;
  if (!st || st.total < 3 || st.n < 3) return null;
  const rr = groupingMetricNumber(st.rr);
  if (rr == null) return null;
  return {
    session: row.s,
    distInfo: distanceBucketInfo(row.s && row.s.dist),
    date: sightDateInfo(row.s || {}),
    rr,
    sx: groupingMetricNumber(st.sx),
    sy: groupingMetricNumber(st.sy),
    n: st.n,
  };
}
function groupingSummaryHtml(sessionRows) {
  const rows = (sessionRows || []).map(groupingSessionRow).filter(Boolean);
  if (!rows.length) return "";
  const avg = rows.reduce((a, r) => a + r.rr, 0) / rows.length;
  const best = [...rows].sort(
    (a, b) => a.rr - b.rr || (b.date.sort || "").localeCompare(a.date.sort || ""),
  )[0];
  const latest = [...rows].sort(
    (a, b) => (b.date.sort || "").localeCompare(a.date.sort || "") || b.rr - a.rr,
  )[0];
  const byDist = new Map();
  rows.forEach((r) => {
    const g = byDist.get(r.distInfo.key) || {
      label: r.distInfo.label,
      sort: r.distInfo.sort,
      sessions: 0,
      total: 0,
      best: null,
      latest: null,
    };
    g.sessions++;
    g.total += r.rr;
    if (!g.best || r.rr < g.best.rr) g.best = r;
    if (!g.latest || (r.date.sort || "") > (g.latest.date.sort || "")) g.latest = r;
    byDist.set(r.distInfo.key, g);
  });
  const groups = [...byDist.values()].sort(
    (a, b) => b.sort - a.sort || b.sessions - a.sessions || a.label.localeCompare(b.label),
  );
  const meta = (r) =>
    [r.distInfo.label, r.date.label].filter((x) => x && x !== "—").join(" / ") || "—";
  const body = `<div class="insightStrip">
      <div class="insightTile"><div class="k">平均の集まり半径(RMS)</div><b>${groupingMetricText(avg)}</b><span>${rows.length}セッションから集計</span></div>
      <div class="insightTile"><div class="k">最小の集まり半径(RMS)</div><b>${groupingMetricText(best && best.rr)}</b><span>${esc(best ? meta(best) : "—")}</span></div>
      <div class="insightTile"><div class="k">最新の集まり半径(RMS)</div><b>${groupingMetricText(latest && latest.rr)}</b><span>${esc(latest ? meta(latest) : "—")}</span></div>
    </div>
    ${groups
      .map((g) => {
        const distAvg = g.sessions ? g.total / g.sessions : null;
        const latest = g.latest && g.latest.date.label ? g.latest.date.label : "—";
        return `<div class="listItem recordReadOnlyItem">
        <div><div class="t">${esc(g.label)}</div><div class="d">${g.sessions}回 / 最新 ${esc(latest)}</div></div>
        <div class="big">${groupingMetricText(distAvg)}<small> / 最小${groupingMetricText(g.best && g.best.rr)}</small></div>
      </div>`;
      })
      .join("")}`;
  return historyAnalysisDetailsHtml(
    "矢の集まり具合のまとめ（グルーピングサマリー）",
    `対象${rows.length}回`,
    body,
  );
}
