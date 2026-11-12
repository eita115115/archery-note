"use strict";
/* Archery Note: record and active-session views */
/* ============ views ============ */
let view = "record";
let ui = {
  scrollByView: {},
  selArrow: -1,
  editEnd: -1 /* 記録中: 開いて直している確定済みエンド（-1 = なし） */,
  recPausedId: null /* 「中断」で離れた記録の id。再読み込みで消え、記録画面へ戻る */,
  recMsg: "",
  sightSel: { setupId: null, dist: 70 },
  histOpen: null,
  histFilter: { setupId: "", dist: "", round: "", kind: "all" } /* kind: "all" | "rec" | "memo" */,
  analysisFilter: { setupId: "", dist: "", round: "", period: "all" },
  zoom: 1,
  recordMode: "practice",
  freshArrow: -1,
  freshTimer: 0,
  recScreen: "home" /* 記録タブ（記録していないとき）: "home" 待機画面 / "conditions" 記録の条件 */,
  startMode: null /* 待機画面と記録の条件で選んでいる入力方法。null は settings.lastInputMode */,
};
function showView(v) {
  if (view === v) return;
  const m = $("#main");
  ui.scrollByView[view] = Math.max(0, window.scrollY);
  view = v;
  ui.selArrow = -1;
  ui.editEnd = -1;
  ui.recScreen = "home";
  nativePulse("light");
  render();
  m.classList.remove("viewEnter");
  void m.offsetWidth;
  m.classList.add("viewEnter");
  const top = ui.scrollByView[v] || 0;
  // A restored view needs real card heights, not content-visibility placeholders.
  // Keep these nodes laid out until the next render; no delayed scroll can fight input.
  if (top > 0) Array.from(m.children).forEach((card) => { card.style.contentVisibility = "visible"; });
  window.scrollTo({ top, left: 0, behavior: "instant" });
}
document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => showView(b.dataset.v)));
document.querySelectorAll("#gearSubTabs button").forEach((b) => (b.onclick = () => showView(b.dataset.sub)));
/* 画面名。サイトは弓具タブの中の画面（下線タブで切り替える）なので、タブも画面名も「弓具」になる */
const VIEW_TITLES = { record: "記録", history: "ノート", analysis: "分析", gear: "弓具", sight: "弓具" };
function markCurrent(b, on) {
  b.classList.toggle("on", on);
  if (on) b.setAttribute("aria-current", "page");
  else b.removeAttribute("aria-current");
}
/* 画面名の行・下部タブ・弓具内の下線タブを現在の画面に合わせる。設定の入口は記録タブだけに出す */
function syncViewChrome() {
  const tabView = view === "sight" ? "gear" : view;
  document.querySelectorAll("#tabs button").forEach((b) => markCurrent(b, b.dataset.v === tabView));
  const title = $("#viewTitle");
  if (title) title.textContent = VIEW_TITLES[view] || "";
  const date = $("#viewDate");
  const dp = view === "record" ? dateParts(today()) : null;
  if (date) date.textContent = dp ? `${dp.mo}月${dp.d}日（${dp.w}）` : "";
  const settings = $("#btnSettings");
  if (settings) settings.hidden = view !== "record";
  const memo = $("#btnNewMemo");
  if (memo) memo.hidden = view !== "history";
  const sub = $("#gearSubTabs");
  if (sub) {
    sub.hidden = tabView !== "gear";
    sub.querySelectorAll("button").forEach((b) => markCurrent(b, b.dataset.sub === view));
  }
}

function render() {
  updateAppChrome();
  if (typeof syncUpdateBarVisibility === "function") syncUpdateBarVisibility();
  syncViewChrome();
  const m = $("#main");
  /* 記録中は没入画面: 画面名の行とタブを隠す（style.css: html.recording） */
  document.documentElement.classList.toggle(
    "recording",
    view === "record" && !!db.active && !recordPaused(),
  );
  /* 記録の条件は全画面: 画面名の行とタブを隠す（style.css: html.subscreen） */
  document.documentElement.classList.toggle(
    "subscreen",
    view === "record" && !db.active && ui.recScreen === "conditions",
  );
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
        (s) =>
          `<option value="${esc(s.id)}" ${s.id === sel ? "selected" : ""}>${esc(s.name)}</option>`,
      )
      .join("")
  );
}
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
function setupSystemSummary(setupId) {
  const setup = db.setups.find((s) => s.id === setupId);
  if (!setup)
    return {
      score: 0,
      level: "準備中",
      profiles: {},
      lines: ["用具セッティングを登録すると、サイト台帳・物理校正・個人モデルの材料が整います。"],
      next: "弓具タブで初回セットアップ",
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
  const markText = mk ? `上下 ${esc(mk.v === 0 ? 0 : mk.v || "—")} / 左右 ${esc(mk.h === 0 ? 0 : mk.h || "—")}` : "記録なし";
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
/* ---------- 初回（記録も弓具も無い） ----------
   v5: 専用の画面は持たない。記録タブの帯が「最初の条件を選ぶ」になり、記録の条件へ進む
   （homeFirstRunBandHtml）。記録を始めるかデモデータを入れると onboardingSeen を立てる。 */
function shouldShowOnboarding() {
  return (
    !db.settings.onboardingSeen && !db.active && db.sessions.length === 0 && db.setups.length === 0
  ); // 用具だけ登録済みの既存ユーザーには出さない
}
/* 距離から的サイズ・1エンド本数を決める（suggestedFaceValue と同じ規則。18m だけ 3射エンド）。
   記録の条件で、初回に距離を選んだときと、距離の決まったラウンドを選んだときに使う */
function onboardDerived(d) {
  const faceD = d >= 60 ? 122 : d <= 18 ? 40 : 80;
  const perEnd = d <= 18 ? 3 : 6;
  return { faceD, perEnd };
}
const DEMO_ID_PREFIX = "build-week-demo:";
function demoSession(id, date, offset, spread, score) {
  const pts = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-0.7, 0.7],
    [0.7, -0.7],
  ];
  return {
    id: DEMO_ID_PREFIX + id,
    date,
    setupId: null,
    dist: 18,
    faceD: 40,
    faceType: "single",
    perEnd: 3,
    round: "free",
    purpose: "practice",
    note: "架空のデモデータ",
    arrowR: DEFAULT_ARROW_R,
    ends: [
      pts
        .slice(0, 3)
        .map((p, i) => ({
          x: offset + p[0] * spread,
          y: p[1] * spread,
          s: score + (i === 1 ? -1 : 0),
        })),
      pts
        .slice(3)
        .map((p, i) => ({
          x: offset + p[0] * spread,
          y: p[1] * spread,
          s: score + (i === 1 ? -1 : 0),
        })),
    ],
  };
}
function installDemoData() {
  const dates = [-20, -8, -1].map((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  db.sessions = db.sessions.filter((s) => !String(s.id || "").startsWith(DEMO_ID_PREFIX));
  db.sessions.push(
    demoSession("1", dates[0], 1.4, 3.2, 8),
    demoSession("2", dates[1], 0.8, 2.4, 9),
    demoSession("3", dates[2], 0.3, 1.7, 9),
  );
  db.settings.onboardingSeen = true;
  save({ reason: "demo-install", forceSnapshot: true });
}
function removeDemoData() {
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((s) => !String(s.id || "").startsWith(DEMO_ID_PREFIX));
  if (db.sessions.length !== before) save({ reason: "demo-remove", forceSnapshot: true });
  return before - db.sessions.length;
}

/* ---------- 段階的機能発見ヒント（記録タブ上部のみ・常に最大1枚。onboarding-final-design.md 観点4） ----------
   優先度順に評価し、最初に条件が成立した1件だけを表示する。オンボーディング表示中・
   セッション記録中は renderRecord の早期 return により自然に非表示になる。 */
const FEATURE_HINTS = [
  {
    key: "gearSetup",
    ico: "tool",
    html: "<strong>用具を登録</strong>するとサイト台帳と自動でつながります",
    act: "設定する",
    when: () => db.sessions.length >= 1 && db.setups.length === 0,
    go: () => showView("gear"),
  },
  {
    key: "practiceDays",
    ico: "fire",
    html: "<strong>練習曜日</strong>を設定すると、連続記録（ストリーク）が始まります",
    act: "設定する",
    when: () => {
      const g = db.settings.gamification;
      return !!(g && g.enabled && g.practiceDays === null && db.sessions.length >= 1);
    },
    go: () => openPracticeDaysSheet(),
  },
  {
    key: "analysis",
    ico: "book",
    html: "3回分たまりました。<strong>分析タブ</strong>で傾向が見えます",
    act: "見る",
    when: () => db.sessions.length >= 3,
    go: () => showView("analysis"),
  },
  {
    key: "sightAdjust",
    ico: "target",
    html: "2距離のサイト値が揃いました。<strong>サイト調整</strong>が使えます",
    act: "開く",
    when: () => new Set(db.sightMarks.map((x) => x.dist)).size >= 2,
    go: () => showView("sight"),
  },
  {
    key: "formTracking",
    ico: "camera",
    html: "カメラで<strong>射形トラッキング</strong>も記録できます",
    act: "試す",
    when: () => db.sessions.length >= 5,
    go: () => showView("analysis"),
  },
  {
    key: "addToHome",
    ico: "down",
    html: "<strong>ホーム画面に追加</strong>すると全画面で開けます",
    act: "方法を見る",
    when: () => db.settings.launchCount >= 2 && runtimeKind().kind === "Web",
    go: () => openAddToHomeSheet(),
  },
];
function pendingFeatureHint() {
  const fh = db.settings.featureHints || {};
  return FEATURE_HINTS.find((h) => !fh[h.key] && h.when()) || null;
}
function featureHintHtml() {
  const h = pendingFeatureHint();
  if (!h) return "";
  return `<div class="hintBanner" data-testid="feature-hint" data-hint="${h.key}">
    <span class="hintBannerIcon" aria-hidden="true">${icon(h.ico)}</span>
    <span class="hintBannerText">${h.html}</span>
    <button type="button" class="hintBannerAction" id="hintAction">${esc(h.act)}</button>
    <button type="button" class="hintBannerClose" id="hintClose" aria-label="閉じる">${icon("del")}</button>
  </div>`;
}
function dismissFeatureHint(key) {
  db.settings.featureHints = db.settings.featureHints || {};
  db.settings.featureHints[key] = true;
  save("hint-dismiss"); // 閉じる/アクションとも同じ案内を二度見せないため即時保存
}
function bindFeatureHint() {
  const h = pendingFeatureHint();
  if (!h) return;
  const actBtn = $("#hintAction");
  if (actBtn)
    actBtn.onclick = () => {
      dismissFeatureHint(h.key);
      h.go();
      if (view === "record") render(); // go() がタブ遷移しない場合（addToHome）はここで消す
    };
  const closeBtn = $("#hintClose");
  if (closeBtn)
    closeBtn.onclick = () => {
      dismissFeatureHint(h.key);
      render();
    };
}
/* ブラウザからのワンタップ追加はできないため、共有→ホーム画面に追加の手順を示すだけの小シート */
function openAddToHomeSheet() {
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  ovl.innerHTML = `<div class="sheet">
    <h3>ホーム画面に追加</h3>
    <div class="note">1. 共有ボタン（またはブラウザメニュー）をタップ</div>
    <div class="note">2. 「ホーム画面に追加」を選ぶ</div>
    <div class="hint">ホーム画面から開くと、アドレスバーのない全画面表示になります。</div>
    <div class="btnrow"><button type="button" class="btn" id="a2hClose">閉じる</button></div>
  </div>`;
  openModal(ovl, { escapeTarget: "#a2hClose" });
  ovl.querySelector("#a2hClose").onclick = () => closeModal(ovl);
}
/* ---------- 記録タブの待機画面（ホームを兼ねる。docs/design/v5/design.md 4.1） ----------
   上から: 開始の帯（前回と同じ条件・入力方法・条件を変える・記録を始める）→ 前回の練習 →
   同じ条件の推移 → 最近の練習。記録の途中なら帯は「記録の途中です」だけになり、
   新しい記録を始める入口は出さない（上書きで消さないため）。 */
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];
function dateParts(iso) {
  if (!iso || typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, mo, d] = iso.split("-").map((v) => parseInt(v, 10));
  return { y, mo, d, w: WEEKDAY_JA[new Date(y, mo - 1, d).getDay()] };
}
function fmtMD(iso) {
  const p = dateParts(iso);
  return p ? `${p.mo}/${p.d}` : "";
}
function fmtMDW(iso) {
  const p = dateParts(iso);
  return p ? `${p.mo}/${p.d}（${p.w}）` : "";
}
/* 期間の表記。年をまたぐときだけ年を付ける */
function fmtDateRange(a, b) {
  const pa = dateParts(a),
    pb = dateParts(b);
  if (!pa || !pb) return "";
  if (a === b) return fmtMD(a);
  return pa.y === pb.y ? `${fmtMD(a)}〜${fmtMD(b)}` : `${fmtD(a)}〜${fmtD(b)}`;
}
function sampleSd(vals) {
  if (!Array.isArray(vals) || vals.length < 2) return 0;
  const m = vals.reduce((t, v) => t + v, 0) / vals.length;
  return Math.sqrt(vals.reduce((t, v) => t + (v - m) ** 2, 0) / (vals.length - 1));
}
/* 日付の新しい順（同じ日は後から保存したものが先）。保存の並びは変えない */
function sessionsByDateDesc() {
  return db.sessions
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s && typeof x.s === "object")
    .sort((a, b) => String(b.s.date || "").localeCompare(String(a.s.date || "")) || b.i - a.i)
    .map((x) => x.s);
}
function roundQuota(roundId) {
  const r = ROUND_TYPES.find((x) => x.id === roundId);
  return r && r.arrows ? r.arrows : null;
}
/* 「前回と同じ条件」で始めるときの条件。多距離ラウンドは最初の距離から始める。
   記録が無いときは 70m・122cm的・6射の自由練習 */
function startConditionFrom(last) {
  if (!last)
    return {
      dist: 70,
      faceD: 122,
      faceType: "single",
      perEnd: 6,
      setupId: db.setups[0] ? db.setups[0].id : null,
      round: "free",
      mdef: null,
    };
  const known = ROUND_TYPES.some((r) => r.id === last.round) || !!findRoundDef(last.round);
  const round = known ? last.round : "free";
  const mdef = selectedMultiRound(round);
  const st0 = mdef ? mdef.stages[0] : null;
  const setupId = db.setups.some((x) => x.id === last.setupId) ? last.setupId : null;
  if (st0)
    return {
      dist: st0.dist,
      faceD: st0.faceD,
      faceType: st0.faceType || "single",
      perEnd: st0.perEnd || 6,
      setupId,
      round,
      mdef,
    };
  const face = parseFaceChoice(faceChoiceValue(last));
  return {
    dist: last.dist,
    faceD: face.faceD,
    faceType: face.faceType,
    perEnd: last.perEnd || 6,
    setupId,
    round,
    mdef: null,
  };
}
/* 記録を始める（待機画面の「記録を始める」と、記録の条件の「この条件で記録を始める」の共通の出口） */
function beginRecording(c) {
  if (db.active) return; /* 記録の途中に別の記録で上書きしない */
  const firstRun = shouldShowOnboarding();
  const setup = db.setups.find((x) => x.id === c.setupId);
  const inputMode = c.inputMode === "score" ? "score" : "target";
  db.active = {
    id: uid(),
    date: c.date || today(),
    setupId: c.setupId || null,
    dist: c.dist,
    faceD: c.faceD,
    faceType: c.faceType || "single",
    perEnd: c.perEnd,
    arrowR: +sessionArrowR(null, setup).toFixed(4),
    sightV: c.sightV || "",
    sightH: c.sightH || "",
    wx: c.wx || "",
    note: c.note || "",
    windDir: c.windDir || "",
    windSpeed: c.windSpeed || "",
    round: c.round || "free",
    purpose: ui.recordMode || "practice",
    inputMode,
    ends: [],
    cur: [],
  };
  db.settings.lastInputMode = inputMode;
  if (firstRun) db.settings.onboardingSeen = true;
  if (c.mdef)
    db.active.roundGroup = {
      gid: uid(),
      roundId: c.round,
      stage: 0,
      stageCount: c.mdef.stages.length,
    };
  ui.recScreen = "home";
  ui.startMode = null;
  nativePulse("success");
  wakeLock.acquire();
  save();
  $("#main").classList.remove("viewEnter");
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  render();
}
function currentStartMode() {
  if (ui.startMode !== "score" && ui.startMode !== "target")
    ui.startMode = db.settings.lastInputMode === "score" ? "score" : "target";
  return ui.startMode;
}
function inputModeSegHtml(id, mode) {
  return `<div class="seg" id="${id}" role="group" aria-label="入力方法" data-testid="start-input-mode">
    <button type="button" data-mode="target" data-testid="start-input-target" aria-pressed="${mode === "target"}">的面に打つ</button>
    <button type="button" data-mode="score" data-testid="start-input-score" aria-pressed="${mode === "score"}">点数だけ</button>
  </div>`;
}
function bindInputModeSeg(id, onChange) {
  document.querySelectorAll(`#${id} [data-mode]`).forEach(
    (b) =>
      (b.onclick = () => {
        ui.startMode = b.dataset.mode === "score" ? "score" : "target";
        document
          .querySelectorAll(`#${id} [data-mode]`)
          .forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.mode === ui.startMode)));
        if (onChange) onChange(ui.startMode);
      }),
  );
}
/* 開始の帯。last が無ければ既定の条件を出す */
function homeStartBandHtml(last) {
  const c = startConditionFrom(last);
  const setup = db.setups.find((x) => x.id === c.setupId);
  const quota = c.mdef ? null : roundQuota(c.round);
  const mk = setup ? latestMark(setup.id, c.dist) : null;
  const label = !last ? "記録の条件" : c.mdef ? "前回と同じラウンド" : "前回と同じ条件";
  const cond = c.mdef
    ? esc(c.mdef.label)
    : `${esc(c.dist)}m・${esc(faceLabel(c))}${quota ? `・${quota}射` : ""}`;
  const parts = [];
  if (c.mdef) parts.push(`最初の距離 ${esc(c.dist)}m・${esc(faceLabel(c))}から`);
  else if (quota) parts.push(`${c.perEnd}射×${Math.ceil(quota / c.perEnd)}エンド`);
  else parts.push(`自由練習・1エンド ${c.perEnd}射`);
  parts.push(setup ? esc(setup.name) : "弓具 未指定");
  if (setup) parts.push(mk && hasSightInput(mk.v) ? `サイト ${esc(sightValueText(mk.v))}` : "サイト 記録なし");
  return `<section class="band startBand" data-testid="home-start-band" aria-label="記録を始める">
    <div class="l">${label}</div>
    <div class="c" id="quickStartMeta">${cond}</div>
    <div class="m">${parts.join("・")}</div>
    ${inputModeSegHtml("homeInputMode", currentStartMode())}
    <div class="btnRow">
      <button type="button" class="btn sec" id="recConditions" data-testid="record-conditions">条件を変える</button>
      <button type="button" class="btn pri" id="quickStart" data-testid="record-start">記録を始める</button>
    </div>
  </section>`;
}
/* 記録の途中（「中断」で離れた記録、または編集の途中）。再開だけを出す */
function homePausedBandHtml(s) {
  const all = sessionArrows(s);
  const quota = scorecardPlan(s).quota;
  return `<section class="band startBand" data-testid="record-paused" aria-label="記録の途中">
    <div class="l">${s._edit ? "編集の途中です" : "記録の途中です"}</div>
    <div class="c">${esc(s.dist)}m・${esc(faceLabel(s))}${quota ? `・${quota}射` : ""}</div>
    <div class="m">${fmtMDW(s.date)}・${s.ends.length}エンド確定・${all.length}射・${sumScores(all)}点。1射ごとに保存しています。</div>
    <div class="btnRow"><button type="button" class="btn pri" id="recResume" data-testid="record-resume">記録を再開する</button></div>
    <p class="basis">記録の途中は、新しい記録を始められません。再開して終了すると、次の記録を始められます。</p>
  </section>`;
}
/* 初回（記録も弓具も無く、まだ条件を選んでいない）。帯が「最初の条件を選ぶ」になる */
function homeFirstRunBandHtml() {
  return `<section class="band startBand onboard" data-testid="onboard-welcome" aria-label="最初の条件を選ぶ">
    <div class="l">最初の条件を選ぶ</div>
    <div class="c">距離と的を選んで記録を始めます</div>
    <div class="m">的をタップした位置、または点数だけで記録できます。記録はこの端末の中だけに保存されます。</div>
    <div class="btnRow">
      <button type="button" class="btn sec" id="obDemo">架空のデモデータで試す</button>
      <button type="button" class="btn pri" id="obStart" data-testid="record-conditions">条件を選ぶ</button>
    </div>
    <p class="basis">デモデータは架空の練習3回ぶんです。設定の「データ」から消せます。</p>
  </section>`;
}
/* 前半 / 後半の合計。規定射数が 60 以上で、両方の半分を打ち終えた記録だけ（スコア表の小計と同じ区切り） */
function sessionHalves(sess) {
  const plan = scorecardPlan(sess);
  const ends = (sess && sess.ends) || [];
  if (!plan.quota || !plan.blockEnds || ends.length < plan.blockEnds * 2) return null;
  return [
    sumScores(ends.slice(0, plan.blockEnds).flat()),
    sumScores(ends.slice(plan.blockEnds, plan.blockEnds * 2).flat()),
  ];
}
/* 数値の組: 前半 / 後半（無ければ fallback）と、スコア表の右端2列と同じ数える点 */
function sessionFigsHtml(sess, fallback) {
  const ends = (sess && sess.ends) || [];
  const all = ends.flat();
  const halves = sessionHalves(sess);
  const first = halves
    ? `<div class="fig" data-fig="halves"><div class="l">前半 / 後半</div><div class="n halves">${halves[0]}<small>/</small> ${halves[1]}</div></div>`
    : fallback === "ends"
      ? `<div class="fig" data-fig="ends"><div class="l">エンド</div><div class="n">${ends.length}</div></div>`
      : `<div class="fig" data-fig="avg"><div class="l">1射平均</div><div class="n">${all.length ? (sumScores(all) / all.length).toFixed(2) : "—"}</div></div>`;
  return `<div class="figs">${first}${scorecardCountCols(sess)
    .map(
      (c, i) =>
        `<div class="fig" data-fig="count${i}"><div class="l">${c.sub}</div><div class="n">${c.count(all)}</div></div>`,
    )
    .join("")}</div>`;
}
/* 合計の大きな数字。規定射数のあるラウンドだけ満点を添える */
function sessionBigTotalHtml(sess, cls) {
  const quota = scorecardPlan(sess).quota;
  const total = sumScores(((sess && sess.ends) || []).flat());
  return `<div class="bigNum${cls ? " " + cls : ""}" data-testid="session-total">${total}${quota ? `<small>/ ${quota * perfectScoreValue(sess)}</small>` : ""}</div>`;
}
/* エンドごとの合計の棒。最も高いエンドに色を付ける。13エンド以上は2段以上に分ける */
function endStripHtml(sess) {
  const tots = ((sess && sess.ends) || []).map(sumScores);
  if (!tots.length) return "";
  const lo = Math.min(...tots),
    hi = Math.max(...tots);
  const rows = Math.ceil(tots.length / 12);
  const per = Math.ceil(tots.length / rows);
  const cell = (v, i) =>
    `<div${v === hi ? ' class="hi"' : ""} data-end="${i}"><b>${v}</b><i style="height:${Math.round(8 + ((v - lo) / (hi - lo || 1)) * 30)}px"></i><span>${i + 1}</span></div>`;
  let h = "";
  for (let r = 0; r * per < tots.length; r++)
    h += `<div class="strip" style="grid-template-columns:repeat(${per},1fr)">${tots
      .slice(r * per, (r + 1) * per)
      .map((v, i) => cell(v, r * per + i))
      .join("")}</div>`;
  return `<div data-testid="end-strip" role="group" aria-label="エンドごとの合計">${h}</div>`;
}
/* 合計点の推移（折れ線）。破線は平均。幅は画面に合わせて決め、文字は 13px のまま縮めない */
function totalsLineChartHtml(vals, labels, meanVal) {
  const gut = window.innerWidth <= 340 ? 12 : 16;
  const W = Math.max(240, Math.min(window.innerWidth, 480) - gut * 2),
    H = 176,
    L = 42,
    R = 24,
    T = 26,
    B = 28;
  const step = 10;
  let lo = Math.floor((Math.min(...vals) - 5) / step) * step,
    hi = Math.ceil((Math.max(...vals) + 2) / step) * step;
  if (hi === lo) hi += step;
  const n = vals.length;
  const gap = n === 1 ? 0 : (W - L - R - 14) / (n - 1);
  const X = (i) => L + 14 + (n === 1 ? (W - L - R - 14) / 2 : i * gap);
  const Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const lines = Math.min(4, (hi - lo) / step);
  let h = `<svg class="lineChart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="合計点の推移: ${vals.map((v, i) => `${labels[i]} ${v}点`).join("、")}">`;
  for (let k = 0; k <= lines; k++) {
    const v = lo + ((hi - lo) / lines) * k;
    h += `<path d="M${L} ${Y(v).toFixed(1)}H${W - R + 10}" stroke="var(--rule)"/><text class="ax" x="${L - 8}" y="${(Y(v) + 4.5).toFixed(1)}" text-anchor="end">${Math.round(v)}</text>`;
  }
  if (Number.isFinite(meanVal))
    h += `<path d="M${L} ${Y(meanVal).toFixed(1)}H${W - R + 10}" stroke="var(--sub)" stroke-dasharray="5 4"/>`;
  h += `<path d="${vals.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join("")}" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
  /* 日付のラベルは 40px より詰まるときは1つおき（最後の回は必ず出す） */
  const everyOther = n > 1 && gap < 40;
  vals.forEach((v, i) => {
    const last = i === n - 1;
    const nb = [vals[i - 1], vals[i + 1]].filter((x) => x != null);
    const below = nb.length && v < nb.reduce((t, x) => t + x, 0) / nb.length;
    h += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${last ? 5 : 4}" fill="${last ? "var(--accent)" : "var(--bg)"}" stroke="${last ? "var(--accent)" : "var(--ink)"}" stroke-width="2"/>`;
    h += `<text x="${X(i).toFixed(1)}" y="${(below ? Y(v) + 20 : Y(v) - 10).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="${last ? 700 : 500}" fill="var(--ink)" stroke="var(--bg)" stroke-width="4" paint-order="stroke">${v}</text>`;
    if (!everyOther || (n - 1 - i) % 2 === 0)
      h += `<text class="ax" x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>`;
  });
  return h + "</svg>";
}
const HOME_TREND_MAX = 7;
/* 同じ条件（距離・的・射数）の合計点の推移。ref を含む。直近 HOME_TREND_MAX 回まで */
function homeTrendHtml(ref) {
  const n = ((ref && ref.ends) || []).flat().length;
  if (!n) return "";
  const cond = `${esc(ref.dist)}m・${esc(faceLabel(ref))}・${n}射`;
  const same = sessionsByDateDesc()
    .filter((s) => trSameCondition(s, ref, { matchArrows: true }))
    .reverse();
  const shown = same.slice(-HOME_TREND_MAX);
  const head = `<div class="vsecH"><h2>${esc(ref.dist)}m・${n}射の推移</h2><span class="aside">${same.length}回</span></div>`;
  if (shown.length < 2)
    return `<section class="vsec" data-testid="home-trend">${head}
      <p class="fact">同じ条件（${cond}）の記録は1回です。2回目から推移を表示します。</p></section>`;
  const tv = shown.map((s) => sumScores(s.ends.flat()));
  const m = tv.reduce((t, v) => t + v, 0) / tv.length;
  const sd = sampleSd(tv);
  const scope =
    same.length > shown.length ? `直近${shown.length}回（全${same.length}回のうち）` : `${shown.length}回`;
  return `<section class="vsec" data-testid="home-trend">${head}
    ${totalsLineChartHtml(tv, shown.map((s) => fmtMD(s.date)), m)}
    <p class="fact">${scope}の平均は ${m.toFixed(1)} 点、回ごとの標準偏差は ${sd.toFixed(1)} 点です。</p>
    <p class="basis">対象: ${fmtDateRange(shown[0].date, shown[shown.length - 1].date)}、${cond}。破線は平均です。${shown.length < 8 ? "回数が少ないため、上向き・下向きの判定はしていません。" : ""}</p>
  </section>`;
}
function homeLastPracticeHtml(ref) {
  const all = ref.ends.flat();
  const per = scorecardPlan(ref).per;
  return `<section class="vsec" data-testid="home-last">
    <div class="vsecH"><h2>前回の練習</h2><span class="aside">${fmtMDW(ref.date)}・${esc(ref.dist)}m・${all.length}射</span></div>
    <div class="bigRow">${sessionBigTotalHtml(ref)}<button type="button" class="txtBtn" id="homeLastOpen" data-testid="home-last-open">スコア表を見る</button></div>
    ${sessionFigsHtml(ref, "avg")}
    ${endStripHtml(ref)}
    <p class="basis">エンドごとの合計（${per}射、${per * perfectScoreValue(ref)}点満点）。最も高いエンドに色を付けています。${sessionHasPos(ref) ? "" : "点数だけの記録です。"}</p>
  </section>`;
}
function homeRecentRowHtml(s) {
  const p = dateParts(s.date);
  const all = (s.ends || []).flat();
  const setup = db.setups.find((x) => x.id === s.setupId);
  const meta = [faceLabel(s)];
  if (setup) meta.push(setup.name);
  if (s.wx) meta.push(s.wx);
  if (!sessionHasPos(s)) meta.push("点数だけ");
  return `<button type="button" class="entry homeEntry" data-testid="home-recent-row" data-id="${esc(s.id)}" aria-label="${p ? `${p.mo}月${p.d}日` : ""} ${esc(s.dist)}m ${all.length}射 ${sumScores(all)}点の記録を開く">
    <span class="day">${p ? `${p.mo}/${p.d}` : "—"}<small>${p ? p.w + "曜" : ""}</small></span>
    <span class="entryBody">
      <span class="hd"><b>${esc(s.dist)}m・${all.length}射</b><span class="sc1">${sumScores(all)}<small>点</small></span></span>
      <span class="meta">${esc(meta.join("・"))}</span>
      ${s.note ? `<span class="txt">${esc(s.note)}</span>` : ""}
    </span>
  </button>`;
}
/* 練習の目標と連続記録（設定で入にしたときだけ）。1行の事実だけを出す。バッジは設定・分析の側 */
function homeGoalLineHtml() {
  const g = db.settings.gamification;
  if (!g || !g.enabled) return "";
  const goals = calcGoalProgress(db.sessions, g.goals, today());
  const streak = computeStreak(db.sessions, g.practiceDays, today());
  const parts = [
    `今週 ${goals.weekly.current}回 / 目標 ${goals.weekly.target}回`,
    `今月 ${goals.monthly.current}射 / 目標 ${goals.monthly.target}射`,
  ];
  if (streak.configured) parts.push(`連続 ${streak.current}日`);
  return `<p class="basis homeGoalLine" data-testid="home-goal-line">${parts.map((t) => `<span>${t}</span>`).join("・")}</p>`;
}
function renderRecordHome(m) {
  const paused = !!db.active;
  const firstRun = !paused && shouldShowOnboarding();
  const recent = sessionsByDateDesc();
  const ref = recent.find((s) => (s.ends || []).flat().length > 0) || null;
  const band = paused
    ? homePausedBandHtml(db.active)
    : firstRun
      ? homeFirstRunBandHtml()
      : homeStartBandHtml(recent[0] || null);
  const history = ref
    ? `${homeLastPracticeHtml(ref)}
      ${homeTrendHtml(ref)}
      <section class="vsec" data-testid="home-recent">
        <div class="vsecH"><h2>最近の練習</h2><button type="button" class="txtBtn" id="homeNotes">ノートで見る</button></div>
        ${recent.slice(0, 3).map(homeRecentRowHtml).join("")}
      </section>`
    : `<section class="vsec" data-testid="home-empty">
        <div class="vsecH"><h2>前回の練習</h2><span class="aside">0回</span></div>
        <div class="empty"><b>練習の記録はまだありません</b>1回記録して終了すると、ここに合計・エンドごとの点数・同じ条件の推移が出ます。</div>
      </section>`;
  m.innerHTML = `${band}${homeGoalLineHtml()}${paused || firstRun ? "" : featureHintHtml()}${history}`;
  if (!paused && !firstRun) bindFeatureHint();
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.onclick = fn;
  };
  on("#recResume", () => {
    ui.recPausedId = null;
    render();
  });
  const openConditions = () => {
    ui.recScreen = "conditions";
    nativePulse("light");
    render();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };
  on("#recConditions", openConditions);
  on("#obStart", openConditions);
  on("#obDemo", () => {
    installDemoData();
    showView("analysis");
  });
  bindInputModeSeg("homeInputMode");
  on("#quickStart", () => {
    const c = startConditionFrom(recent[0] || null);
    const mk = c.setupId ? latestMark(c.setupId, c.dist) : null;
    beginRecording(
      Object.assign(c, {
        inputMode: currentStartMode(),
        sightV: mk ? String(mk.v ?? "").trim() : "",
        sightH: mk ? String(mk.h ?? "").trim() : "",
      }),
    );
  });
  on("#homeLastOpen", () => ref && openHistDetail(ref.id));
  on("#homeNotes", () => showView("history"));
  document
    .querySelectorAll('[data-testid="home-recent-row"]')
    .forEach((b) => (b.onclick = () => openHistDetail(b.dataset.id)));
}
/* ---------- 記録の条件（全画面。docs/design/v5/design.md 4.1・試作 #start） ----------
   記録タブの「条件を変える」から開く。タブと画面名の行は隠す（style.css: html.subscreen）。
   ラウンド → 距離と的 → 入力の方法 → 弓具とサイト → 日付・天気・風・メモ → 下端に「この条件で記録を始める」 */
const INPUT_MODE_NOTE = {
  target: "的をタップした位置を記録します。着弾の分布とサイト調整の目安に使えます。",
  score: "点数キーで記録します。着弾位置は残らないため、着弾の分析には使えません。",
};
function renderRecordConditions(m) {
  const firstRun = shouldShowOnboarding();
  const last = sessionsByDateDesc()[0] || null;
  const def = startConditionFrom(last);
  const defSetup = def.setupId || "";
  const defDist = def.dist;
  const defFace = faceChoiceValue(def);
  const defRound = def.round || "free";
  const knownDist = [70, 50, 30, 18].includes(+defDist);
  m.innerHTML = `
  <div class="subTop"><button type="button" class="backBtn" id="condBack" data-testid="conditions-back">${REC_CHEVRON}記録</button></div>
  <header class="subHead"><h1 id="condTitle">記録の条件</h1></header>
  <section class="vsec condSec" aria-labelledby="condRoundH">
    <div class="vsecH"><h2 id="condRoundH">ラウンド</h2><span class="aside" id="fRoundInfo"></span></div>
    <label class="f" for="fRound">ラウンド</label>
    <select class="inp" id="fRound">
      ${ROUND_TYPES.map((r) => `<option value="${r.id}" ${r.id === defRound ? "selected" : ""}>${r.label}</option>`).join("")}
      <optgroup label="多距離ラウンド">
        ${multiRoundDefs()
          .map(
            (r) =>
              `<option value="${esc(r.id)}" ${r.id === defRound ? "selected" : ""}>${esc(r.label)}</option>`,
          )
          .join("")}
      </optgroup>
    </select>
    <div class="hint stageGaugeWrap" id="fRoundStages" style="display:none"></div>
    <p class="basis">規定の射数の途中でも終了できます。自作のラウンドは、設定の「カスタムラウンド」で登録します。</p>
  </section>
  <section class="vsec condSec" aria-labelledby="condDistH">
    <div class="vsecH"><h2 id="condDistH">距離と的</h2></div>
    <div class="seg distSeg" id="fDistChips" role="group" aria-label="距離">
      ${[70, 50, 30, 18].map((d) => `<button type="button" class="distOpt" aria-pressed="${knownDist && d === +defDist}" data-d="${d}">${d}m</button>`).join("")}
      <button type="button" class="distOpt" aria-pressed="${!knownDist}" data-d="custom">カスタム</button>
    </div>
    <div id="fDistCustomWrap" class="recordDistCustomWrap" style="display:${knownDist ? "none" : "block"}"><label class="f" for="fDistCustom">距離 (m)</label><input class="inp" type="number" id="fDistCustom" min="5" max="90" step="1" placeholder="例: 60" value="${knownDist ? "" : esc(defDist)}"></div>
    <div class="row">
      <div><label class="f" for="fFace">的</label><select class="inp" id="fFace">
        <optgroup label="ターゲット">
          ${[122, 80, 60, 40].map((f) => `<option value="${f}" ${String(defFace) === String(f) ? "selected" : ""}>${f}cm</option>`).join("")}
          <option value="T40" ${defFace === "T40" ? "selected" : ""}>40cm 三つ目（縦）</option>
        </optgroup>
        <optgroup label="フィールド">
          ${FIELD_FACE_SIZES.map((f) => `<option value="F${f}" ${defFace === `F${f}` ? "selected" : ""}>${f}cm フィールド</option>`).join("")}
        </optgroup>
      </select></div>
      <div><label class="f" for="fArrows">1エンドの本数</label><select class="inp" id="fArrows">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `<option value="${n}" ${n === def.perEnd ? "selected" : ""}>${n}本</option>`).join("")}</select></div>
    </div>
  </section>
  <section class="vsec condSec" aria-labelledby="fInputModeLabel">
    <div class="vsecH"><h2 id="fInputModeLabel">入力の方法</h2></div>
    ${inputModeSegHtml("fInputMode", currentStartMode())}
    <p class="basis"><span id="fInputModeNote">${INPUT_MODE_NOTE[currentStartMode()]}</span>記録の途中でも切り替えられます。</p>
  </section>
  <section class="vsec condSec" aria-labelledby="condGearH">
    <div class="vsecH"><h2 id="condGearH">弓具とサイト</h2><button type="button" class="txtBtn" id="jumpGear">弓具を開く</button></div>
    <label class="f" for="fSetup">弓具（セッティング）</label><select class="inp" id="fSetup">${setupOptions(defSetup)}</select>
    <div class="sessionCondition">${recordSetupSnapshot(defSetup, defDist)}</div>
    <div class="row">
      <div><label class="f" for="fSightV">サイト 上下（目盛り）</label><input class="inp" id="fSightV" inputmode="decimal" placeholder="例: 5.4"></div>
      <div><label class="f" for="fSightH">サイト 左右（目盛り）</label><input class="inp" id="fSightH" inputmode="decimal" placeholder="例: 2 / -1.5"></div>
    </div>
    <p class="basis">サイトの目盛りをそのまま書きます（左右は右なら 2、左なら -2）。弓具と距離が同じ記録が台帳にあれば、その値が入ります。</p>
  </section>
  <details class="adv recordDetails">
    <summary>日付・天気・風・メモ<span class="sumNote">必要なときだけ入力します</span></summary>
    <label class="f" for="fDate">日付</label><input class="inp" type="date" id="fDate" value="${today()}">
    <div class="row">
      <div><label class="f" for="fWx">天候</label><select class="inp" id="fWx"><option value="">—</option><option>晴れ</option><option>くもり</option><option>雨</option><option>風 弱</option><option>風 強</option><option>室内</option></select></div>
      <div><label class="f" for="fWindDir">風向</label><select class="inp" id="fWindDir"><option value="">—</option><option>向かい風</option><option>追い風</option><option>左から</option><option>右から</option><option>巻き風</option></select></div>
    </div>
    <label class="f" for="fWindSpeed">風速 (m/s)</label><input class="inp" id="fWindSpeed" inputmode="decimal" placeholder="例: 2.5">
    <label class="f" for="fNote">メモ</label><input class="inp" id="fNote" placeholder="メモ（任意）">
  </details>
  <div class="actbar"><button type="button" class="btn pri startPrimary" id="fStart" data-testid="record-start">この条件で記録を始める</button></div>`;
  const distState = { d: defDist };
  const faceSel = $("#fFace");
  bindInputModeSeg("fInputMode", (mode) => {
    $("#fInputModeNote").textContent = INPUT_MODE_NOTE[mode];
  });
  $("#condBack").onclick = () => {
    ui.recScreen = "home";
    render();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };
  const suggestFace = (d) => {
    if (String(faceSel.value).startsWith("F")) return;
    faceSel.value = d >= 60 ? 122 : d <= 18 ? 40 : 80;
  };
  faceSel.onchange = () => {
    if (String(faceSel.value).startsWith("F") && $("#fArrows").value === "6")
      $("#fArrows").value = "3";
    refreshRoundInfo();
  };
  $("#fArrows").onchange = () => refreshRoundInfo();
  function setDistChip(d) {
    distState.d = d;
    const known = [70, 50, 30, 18].includes(+d);
    const key = known ? String(d) : "custom";
    document
      .querySelectorAll("#fDistChips [data-d]")
      .forEach((x) => x.setAttribute("aria-pressed", String(String(x.dataset.d) === key)));
    $("#fDistCustomWrap").style.display = known ? "none" : "block";
    if (!known) $("#fDistCustom").value = d || "";
  }
  /* 見出しの右に、いま選んでいる条件を1行で出す（規定射数とエンド数） */
  function refreshRoundInfo() {
    const roundId = $("#fRound").value || "free";
    const mdef = selectedMultiRound(roundId);
    const quota = roundQuota(roundId);
    const per = +$("#fArrows").value || 6;
    $("#fRoundInfo").textContent = mdef
      ? `${mdef.stages.length}距離・合計 ${mdef.stages.reduce((t, st) => t + (st.arrows || 0), 0)}射`
      : quota
        ? `${quota}射（${per}射×${Math.ceil(quota / per)}エンド）`
        : "射数は決めません";
  }
  /* 多距離ラウンド選択時: stage[0] の距離・的・本数へフォームを合わせ、ステージ一覧を1行表示する */
  function applyMultiRoundStage0(mdef) {
    const st0 = mdef.stages[0];
    setDistChip(st0.dist);
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
  function showRoundStages(mdef) {
    const stagesEl = $("#fRoundStages");
    if (mdef) {
      stagesEl.style.display = "block";
      stagesEl.innerHTML = `<div class="stageGaugeLabel">${esc(mdef.label)}</div>${multiRoundStageGaugeHtml(mdef)}`;
    } else {
      stagesEl.style.display = "none";
      stagesEl.textContent = "";
    }
  }
  $("#fRound").onchange = (e) => {
    const mdef = selectedMultiRound(e.target.value);
    showRoundStages(mdef);
    if (mdef) applyMultiRoundStage0(mdef);
    else if (e.target.value === "field72") {
      if (!String(faceSel.value).startsWith("F")) faceSel.value = "F80";
      $("#fArrows").value = "3";
    } else {
      /* 距離の決まったラウンド（70m 72射 など）は、距離・的・1エンドの本数をそのラウンドに合わせる */
      const r = ROUND_TYPES.find((x) => x.id === e.target.value);
      if (r && r.dist) {
        setDistChip(r.dist);
        const dv = onboardDerived(r.dist);
        faceSel.value = String(dv.faceD);
        $("#fArrows").value = String(dv.perEnd);
        fillSight();
        refreshLens();
      }
    }
    refreshRoundInfo();
  };
  $("#jumpGear").onclick = () => showView("gear");
  function refreshLens() {
    const old = $("#setupLens");
    if (old) old.outerHTML = recordSetupSnapshot($("#fSetup").value, distState.d);
  }
  document.querySelectorAll("#fDistChips [data-d]").forEach(
    (c) =>
      (c.onclick = () => {
        if (c.dataset.d === "custom") {
          setDistChip(null);
          $("#fDistCustom").value = "";
        } else {
          setDistChip(+c.dataset.d);
          suggestFace(distState.d);
          /* 初回だけ、18m は 3射エンドを初期値にする（2回目からは前回の本数を保つ） */
          if (firstRun) $("#fArrows").value = String(onboardDerived(distState.d).perEnd);
          fillSight();
        }
        refreshLens();
        refreshRoundInfo();
      }),
  );
  $("#fDistCustom").oninput = (e) => {
    distState.d = +e.target.value || null;
    if (distState.d) {
      suggestFace(distState.d);
      fillSight();
    }
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
  showRoundStages(selectedMultiRound(defRound));
  refreshRoundInfo();
  $("#fStart").onclick = () => {
    const roundId = $("#fRound").value || "free";
    const mdef = selectedMultiRound(roundId);
    const st0 = mdef ? mdef.stages[0] : null;
    const d = st0 ? st0.dist : distState.d;
    if (!d) {
      toast("距離を入力してください");
      return;
    }
    /* 多距離ラウンドは dist/faceD/faceType/perEnd を stage[0] から採る */
    const face = st0
      ? { faceD: st0.faceD, faceType: st0.faceType || "single" }
      : parseFaceChoice(faceSel.value);
    beginRecording({
      date: $("#fDate").value || today(),
      setupId: $("#fSetup").value || null,
      dist: d,
      faceD: face.faceD,
      faceType: face.faceType,
      perEnd: st0 ? st0.perEnd || 6 : +$("#fArrows").value,
      sightV: $("#fSightV").value.trim(),
      sightH: $("#fSightH").value.trim(),
      wx: $("#fWx").value,
      note: $("#fNote").value.trim(),
      windDir: $("#fWindDir").value,
      windSpeed: $("#fWindSpeed").value.trim(),
      round: roundId,
      inputMode: currentStartMode(),
      mdef: st0 ? mdef : null,
    });
  };
}
function renderRecord(m) {
  if (db.active && !recordPaused()) {
    renderActive(m);
    return;
  }
  if (!db.active && ui.recScreen === "conditions") {
    renderRecordConditions(m);
    return;
  }
  renderRecordHome(m);
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
        const b = byNo[k] || (byNo[k] = { n: 0, pos: 0, x: 0, y: 0, score: 0, reasons: {} });
        b.n++;
        /* ずれの平均は位置のある矢だけで出す（点数だけの入力・「M 位置なし」は本数と平均点にだけ入る） */
        if (arrowHasPos(a)) {
          b.pos++;
          b.x += Number(a.x) || 0;
          b.y += Number(a.y) || 0;
        }
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
      const avg = b.score / b.n;
      const offset = b.pos
        ? `${cmOffsetText(b.x / b.pos, "x")}・${cmOffsetText(b.y / b.pos, "y")}${b.pos < b.n ? `（位置のある${b.pos}本）` : ""}`
        : "着弾データなし";
      const topReason = Object.entries(b.reasons).sort((a, c) => c[1] - a[1])[0];
      return `<div class="note">#${esc(no)}: ${b.n}本 / 平均${avg.toFixed(1)} / ${offset}${topReason ? ` / ${esc(topReason[0])} ${topReason[1]}本` : ""}</div>`;
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
  /* 分析タブにヒーローは置かない。ノート（旧・履歴）の冒頭にあった励ましの文と数値枠は v5 段 6 で廃止 */
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
      /* 「中心が合っている」と「まだ判定できない」を区別する（統計的に誤差の範囲内でも、区間が広ければ保留） */
      const reason = (sug && sug.reason) || "centered";
      const heroNote = {
        centered: "グルーピング中心は誤差の範囲内でセンターです。今の設定のまま本数を重ねられます。",
        uncertain: "ズレは誤差の範囲ですが、まだ中心を絞り込めていません。同じ狙いで本数を重ねてから判断します。",
        wind: "左右のズレに横風の影響が混ざっています。風上へのねらい修正の有無が分からないため、左右は風待ちで確認します。",
        history: "同じサイト設定の過去の傾向と今回の中心が逆方向です。追加エンドで再現するか確認してから動かします。",
      }[reason];
      body = `<div class="sightNow sightNowNeutral" data-testid="sight-now-suggestion">
        <div class="sightNowDir">${icon("target")}<span>${reason === "centered" ? "調整不要" : "判断保留"}</span></div>
        <p class="sightNowNote">${heroNote}</p>
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
function focusAnalysisFilterControl(control) {
  if (!control) return;
  const card = control.closest(".analysisFilterCard");
  // Replacement cards lose their measured content-visibility heights. Lay out
  // the cards above this control before restoring focus or measuring its position.
  for (const child of Array.from($("#main").children)) {
    child.style.contentVisibility = "visible";
    if (child === card) break;
  }
  control.focus({ preventScroll: true });
  const rect = control.getBoundingClientRect();
  const tabs = $("#tabs");
  // 上には固定の帯が無い（v5）。画面の上端から 12px を空ける。
  const top = 12;
  const bottom = (tabs ? tabs.getBoundingClientRect().top : window.innerHeight) - 12;
  if (rect.bottom > bottom) window.scrollBy({ top: rect.bottom - bottom, behavior: "instant" });
  else if (rect.top < top) window.scrollBy({ top: rect.top - top, behavior: "instant" });
}
function analysisFilterBarHtml(allRows, f) {
  const dists = [...new Set(allRows.map((r) => r.dist).filter(Boolean))];
  const selectedDist = Number(f.dist);
  // 最後の練習を削除した後も、選択中の条件を表示して解除できるようにする。
  if (Number.isFinite(selectedDist) && selectedDist > 0 && !dists.some((d) => String(d) === String(f.dist)))
    dists.push(selectedDist);
  dists.sort((a, b) => b - a);
  const periods = [
    ["all", "全期間"],
    ["7d", "7日"],
    ["30d", "30日"],
    ["90d", "90日"],
  ];
  return `<div class="card analysisFilterCard">
    <h2>比較する条件</h2>
    <div class="row">
      <div><label class="f" for="anSetup">用具</label><select class="inp" id="anSetup"><option value="">すべて</option><option value="__none" ${f.setupId === "__none" ? "selected" : ""}>未指定</option>${db.setups.map((s) => `<option value="${esc(s.id)}" ${f.setupId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
      <div><label class="f" for="anDist">距離</label><select class="inp" id="anDist"><option value="">すべて</option>${dists.map((d) => `<option value="${d}" ${String(f.dist) === String(d) ? "selected" : ""}>${d}m</option>`).join("")}</select></div>
    </div>
    <label class="f">期間</label>
    <div class="chips" id="anPeriods" role="group" aria-label="期間">${periods.map(([id, lb]) => `<button type="button" class="chip ${f.period === id ? "on" : ""}" aria-pressed="${f.period === id}" data-period="${id}">${lb}</button>`).join("")}</div>
  </div>`;
}
function growthDashboardHtml(rows) {
  const d = growthDashboard(rows, today());
  const delta = (v, suffix) =>
    v == null ? "比較待ち" : `${v > 0 ? "+" : ""}${v.toFixed(2)}${suffix}`;
  const visibleGroupingDelta = d.groupingDelta == null ? null : Number(d.groupingDelta.toFixed(1));
  const group =
    visibleGroupingDelta == null
      ? "比較待ち"
      : `${visibleGroupingDelta < 0 ? "改善 " : visibleGroupingDelta > 0 ? "拡大 " : "横ばい "}${Math.abs(visibleGroupingDelta).toFixed(1)}cm`;
  return `<section class="growthDashboard" data-testid="growth-dashboard" aria-labelledby="growth-title">
    <div class="growthHead"><div><div class="kicker">練習のまとめ</div><h2 id="growth-title">数値で振り返る</h2></div><span class="growthConfidence">信頼度 ${esc(d.confidence.label)}</span></div>
    <div class="growthMetrics">
      <div><span>最終練習</span><b>${d.lastPracticeDate ? esc(fmtD(d.lastPracticeDate)) : "—"}</b></div>
      <div><span>今週</span><b>${d.weekSessions}回 / ${d.weekArrows}射</b></div>
      <div><span>直近平均</span><b>${d.recentAverage == null ? "—" : d.recentAverage.toFixed(2)}</b></div>
      <div><span>前回から</span><b>${delta(d.scoreDelta, "点")}</b></div>
      <div><span>グルーピング</span><b>${group}</b></div>
      <div><span>フォーム</span><b>${d.formStability == null ? "記録待ち" : `${Math.round(d.formStability)}%`}</b></div>
    </div>
  </section>`;
}
function nextPracticeCardHtml(rows, showRecordCta = false) {
  const items = nextPracticeSuggestions(rows, today());
  return `<section class="card nextPractice" data-testid="next-practice"><h2>次回試すこと</h2>${items.map((s, i) => `<div class="nextPracticeItem"><span aria-hidden="true">${i + 1}</span><div><b>${esc(s.title)}</b><p>${esc(s.reason)}</p></div></div>`).join("")}${showRecordCta ? `<button type="button" class="btn" id="anEmptyCta">記録タブへ</button>` : ""}</section>`;
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
  const rrRows = sorted.filter((r) => analysisHasGroupingEvidence(r.st));
  const latestStats = sorted[sorted.length - 1].st;
  const latestRr = analysisHasGroupingEvidence(latestStats) ? latestStats.rr : null;
  const bestRr = rrRows.length ? Math.min(...rrRows.map((r) => r.st.rr)) : null;
  const best = [...scored].sort(
    (a, b) => b.total - a.total || (b.date || "").localeCompare(a.date || ""),
  )[0];
  return `<div class="insightStrip">
    <div class="insightTile"><div class="k">平均点</div><b>${avg.toFixed(2)}</b><span>${scored.length}回 ${arrows}本 / 移動平均 ${trend}</span></div>
    <div class="insightTile"><div class="k">矢の集まり具合（グルーピング）</div><b>${latestRr != null ? latestRr.toFixed(1) + "cm" : "比較待ち"}</b><span>${latestRr != null ? "最新の半径(RMS)" : "最新は座標3本以上で比較"} / 最小 ${bestRr != null ? bestRr.toFixed(1) + "cm" : "—"}</span></div>
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
        g.round !== "free" ? esc(roundLabel(g.round)) : "自由練習",
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
    <div class="todayConclusionKicker">練習の傾向</div>
    <p class="todayConclusionText">${esc(c.text)}</p>
  </div>`;
}

/* ============ gamification: バッジ12種の線画SVG + 分析タブ末尾のバッジ一覧 ============
   ICONS規約準拠（10-storage-native.js ICONS 同様: 24pxグリッド・currentColor・視覚的に3要素以内）。
   絵文字は使わない（gamification-final-design.md 観点5 確定）。48-gamification.js の
   BADGE_DEFS と id を1対1対応させる。ここは表示専用データなので純関数ファイルには置かない。 */
const BADGE_ICONS = {
  first_arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><path d="M5 19 17 7"/><path d="M11.5 7H17v5.5"/></svg>',
  century:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><path d="M8 6.5v11M12 5.5v13M16 6.5v11"/><path d="M6 9.5h12"/></svg>',
  millennium:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><path d="M8 5.5v9M12 4.5v11M16 5.5v9"/><path d="M6 8.5h12"/><circle cx="12" cy="18.2" r="1.7"/></svg>',
  gold_end:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>',
  perfect_end:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="7.4"/><circle cx="10.3" cy="11.1" r="0.9" fill="currentColor" stroke="none"/><circle cx="13.7" cy="13.1" r="0.9" fill="currentColor" stroke="none"/></svg>',
  tight_group:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><circle cx="11.2" cy="11.5" r="0.85" fill="currentColor" stroke="none"/><circle cx="13" cy="11.8" r="0.85" fill="currentColor" stroke="none"/><circle cx="12" cy="13.1" r="0.85" fill="currentColor" stroke="none"/></svg>',
  pb_breaker:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter"><path d="M4.5 19h15"/><path d="M7 19v-6M12 19V8.5M17 19v-3.5"/><path d="M14.3 4.7 17 2l2.5 2.6"/></svg>',
  week_warrior:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter"><rect x="3.5" y="5" width="17" height="15"/><path d="M3.5 9.5h17"/><circle cx="8.2" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.8" cy="14.5" r="1" fill="currentColor" stroke="none"/></svg>',
  month_master:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter"><rect x="3.5" y="5" width="17" height="15"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>',
  streak_7:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><path d="M12 21c-3.6 0-6-2.4-6-5.7 0-2.6 1.5-4.4 2.6-6.2.4 1.6 1 2.6 1.9 3.1-.5-2.8.4-5.6 3-7.7.4 2.9 2.1 4.4 3.4 6.2.9 1.3 1.1 2.6 1.1 4.6 0 3.3-2.4 5.7-6 5.7z"/></svg>',
  distance_explorer:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3.5 19 12 4.5 20.5 19"/><path d="M7.2 19h9.6"/></svg>',
  all_weather:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt"><path d="M7.5 17.5a4 4 0 0 1 .3-8 5 5 0 0 1 9.6 1.4A3.3 3.3 0 0 1 17 17.5z"/><path d="M9 8.2A4.4 4.4 0 0 1 12.6 3"/></svg>',
};
/* 分析タブ末尾のバッジ一覧（実績グリッド）。enabled=false では何も描画しない。
   解除済み=accent 1px枠+アイコンaccent色、未解除=line2枠+opacity.45（絵文字前提のgrayscaleフィルタは使わない） */
function gamificationBadgesCardHtml() {
  const g = db.settings.gamification;
  if (!g || !g.enabled) return "";
  /* BADGE_DEFS に存在する id のみを解除数として数える（strict-review minor③付随）。
     未来バージョンの未知バッジ id が破損/旧バージョン混在インポートで混入しても「13/12」のような
     数え違いにならない */
  const knownIds = new Set(BADGE_DEFS.map((b) => b.id));
  const unlocked = new Map(
    (db.gamification.badges || []).filter((b) => knownIds.has(b.id)).map((b) => [b.id, b]),
  );
  const cards = BADGE_DEFS.map((b) => {
    const u = unlocked.get(b.id);
    /* 解除日はローカル日で表示する（strict-review minor④）。unlockedAt は ISO のまま保存し、
       表示だけを today() と同じローカル日基準に揃える（UTC slice だと朝練の解除が前日表示になる）。
       Invalid Date は gamFmtDate→fmtD の正規表現ガードで自動的に空表示になる */
    return `<div class="badgeCard ${u ? "" : "locked"}" data-testid="badge-card" data-badge="${b.id}">
      <span class="ico" aria-hidden="true">${BADGE_ICONS[b.id] || ""}</span>
      <span class="nm">${esc(b.name)}</span>
      <span class="dt">${u ? esc(fmtD(gamFmtDate(new Date(u.unlockedAt)))) : ""}</span>
    </div>`;
  }).join("");
  const total = BADGE_DEFS.length;
  const rate = total ? Math.round((unlocked.size / total) * 100) : 0;
  return `<section class="badgeSection" data-testid="badge-section">
    <h2>実績 <span class="mini">${unlocked.size}/${total}</span></h2>
    <div class="badgeGrid">${cards}</div>
    <div class="badgeRate">
      <div class="badgeRateTrack"><div class="badgeRateFill" style="width:${rate}%"></div></div>
      <div class="badgeRateLabel">${unlocked.size}/${total}</div>
    </div>
  </section>`;
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
  const sightMarks = analysisSightMarks(f);
  const formRecords = analysisFormRecords(f);
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
    sightHistoryCard(ss, sightMarks),
    sightSummaryHtml(sessionRows, f, sightMarks),
    analysisDetailsGroupHtml("analysis-condition-details", "条件と理由", "風・理由タグ", [
      conditionSplitCard(rows),
      reasonBreakdownCard(rows),
    ]),
    analysisDetailsGroupHtml("analysis-breakdown-details", "練習の内訳", "月・距離・得点", [
      monthlyCard(ss),
      distTrendCard(ss),
      scoreDistCard(ss),
    ]),
    // その他
    formTrackingCard(formRecords),
    analysisDetailsGroupHtml("analysis-personal-details", "自己ベストと用具", "", [
      personalBestCard(rows),
      setupPerformanceCard(ss),
    ]),
    distanceSummaryHtml(sessionRows),
  ]
    .filter(Boolean)
    .join("");
  m.innerHTML = `${allRows.length || (formTrackingEnabled() && Array.isArray(db.formAnalyses) && db.formAnalyses.some(Boolean)) ? analysisFilterBarHtml(allRows, f) : ""}
  ${todayConclusionCardHtml(rows)}
  ${nextPracticeCardHtml(rows, !allRows.length)}
  ${growthDashboardHtml(rows)}
  ${cards || `<div class="card"><h2>分析</h2><div class="empty">${allRows.length ? "この絞り込みに合う記録がありません。フィルタを広げてください。" : `<p>記録が増えると、矢の集まり具合や月間まとめがここに表示されます。</p>`}</div></div>`}
  ${gamificationBadgesCardHtml()}`;
  const anSetup = $("#anSetup");
  if (anSetup)
    anSetup.onchange = (e) => {
      const hadFocus = document.activeElement === e.target;
      f.setupId = e.target.value;
      render();
      const next = $("#anSetup");
      if (hadFocus) focusAnalysisFilterControl(next);
    };
  const anDist = $("#anDist");
  if (anDist)
    anDist.onchange = (e) => {
      const hadFocus = document.activeElement === e.target;
      f.dist = e.target.value;
      render();
      const next = $("#anDist");
      if (hadFocus) focusAnalysisFilterControl(next);
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
          focusAnalysisFilterControl(chip);
        }
      }),
  );
  bindFormTrackingCard();
  const anCta = $("#anEmptyCta");
  if (anCta) anCta.onclick = () => showView("record");
}
/* 撮影日で期間を、紐付いた練習で用具/距離を揃える表示用adapter。
   孤立した記録は保存用具だけ利用し、距離は推測しない。元recordを返し保存はしない。 */
function analysisFormRecords(filter) {
  const sessions = new Map((db.sessions || []).filter(Boolean).map((s) => [s.id, s]));
  const rows = (Array.isArray(db.formAnalyses) ? db.formAnalyses : [])
    .filter(Boolean)
    .map((record) => {
      const session = sessions.get(record.sessionId);
      return {
        record,
        date: sightDateInfo(record).sort,
        setupId: session ? session.setupId : record.setupId,
        dist: session ? session.dist : null,
        round: session ? session.round : "",
      };
    });
  return filterAnalysisRows(rows, { ...filter, today: today() }).map((r) => r.record);
}
function analysisDetailsGroupHtml(id, title, meta, cards) {
  const body = cards.filter(Boolean).join("");
  if (!body) return "";
  return `<details class="adv analysisDetailsGroup" data-testid="${esc(id)}">
    <summary><span>${esc(title)}</span>${meta ? `<span class="analysisDetailsMeta">${esc(meta)}</span>` : ""}</summary>
    <div class="analysisDetailsBody">${body}</div>
  </details>`;
}
/* ============ スコア表（確定済みエンドの表示） ============
   並びは 回 | 矢 | 計 | 累計 | 10 | X（docs/design/v5/design.md 4.3）。保存された s / X をそのまま数える。
   点数の計算し直しはしない。段 3 で点数入力と一緒に別ファイルへ分ける候補 */
/* 表示用の並び: 高い点から（X → 10 → … → 1 → M）。保存は打った順のまま変えない */
function scoreSortedArrows(end) {
  return (end || [])
    .map((a, i) => ({ a, i }))
    .sort((p, q) => scoreRank(q.a) - scoreRank(p.a) || p.i - q.i)
    .map((x) => x.a);
}
/* 入力方法。点数だけの記録は inputMode:"score"、それ以外（旧記録を含む）は的面に打つ */
function sessionInputMode(sess) {
  return sess && sess.inputMode === "score" ? "score" : "target";
}
/* 得点キー。その的で付く点だけを並べる（scoreAt が返す値の集合）:
   通常の的は X・10〜1・M、三つ目的は X・10〜6・M、フィールド的は 6〜1・M */
function scoreKeyDefs(faceType) {
  const num = (v) => ({ id: String(v), label: String(v), name: `${v}点`, s: v, X: false });
  const miss = { id: "M", label: "M", name: "ミス（M）", s: 0, X: false };
  if (isFieldFace(faceType)) return [6, 5, 4, 3, 2, 1].map(num).concat(miss);
  const x = { id: "X", label: "X", name: "X（10点）", s: 10, X: true };
  const low = faceType === "triple" ? 6 : 1;
  const nums = [];
  for (let v = 10; v >= low; v--) nums.push(num(v));
  return [x, ...nums, miss];
}
/* 手で直した点数の印（スコア表のセルと枠）。色だけに頼らず、読み上げ用の名前も付ける */
const MANUAL_MARK_HTML = '<span class="man" role="img" aria-label="手で修正">*</span>';
const arrowIsManual = (a) => !!a && a.manual === true;
/* キーで選んだ点数を矢に入れる。
   位置のある矢は「点数だけ直す」: 自動採点（位置から決まる点）を auto に残し、manual:true にする。
   自動採点と同じ点を選んだら手修正を外す。位置のない矢は点数を入れ替えるだけ（src:"key"） */
function applyScoreKey(a, def) {
  if (!arrowHasPos(a)) {
    a.s = def.s;
    a.X = def.X;
    a.src = "key";
    delete a.manual;
    delete a.auto;
    return;
  }
  const auto =
    arrowIsManual(a) && a.auto && typeof a.auto.s === "number"
      ? { s: a.auto.s, X: !!a.auto.X }
      : { s: +a.s || 0, X: !!a.X };
  a.s = def.s;
  a.X = def.X;
  if (auto.s === def.s && auto.X === def.X) {
    delete a.manual;
    delete a.auto;
  } else {
    a.manual = true;
    a.auto = auto;
  }
}
/* 置き直し・1mm 移動のあとは位置から採点し直すので、手修正を外す（描かれる矢円と点数をそろえる）。
   外したら true */
function clearManualScore(a) {
  const had = arrowIsManual(a);
  delete a.manual;
  delete a.auto;
  return had;
}
/* セルと枠の下線に使う的の色（文字色には使わない） */
function scoreZoneClass(a, faceType) {
  const s = +(a && a.s) || 0;
  if (isFieldFace(faceType)) return s >= 5 ? "zg" : s >= 1 ? "zk" : "zm";
  return s >= 9 ? "zg" : s >= 7 ? "zr" : s >= 5 ? "zb" : s >= 3 ? "zk" : s >= 1 ? "zw" : "zm";
}
/* インドアの短距離（40cm・60cm 的で 18m・25m）。スコア表の右2列を「10・9」にする */
function isIndoorShortFace(sess) {
  if (!sess || isFieldFace(sess.faceType)) return false;
  const faceD = +sess.faceD,
    dist = +sess.dist;
  return (faceD === 40 || faceD === 60) && (dist === 18 || dist === 25);
}
/* 右端の2列（数える点）。アウトドアは 10（X を含む）と X、インドア短距離は 10 と 9、フィールドは 6 と 5 */
function scorecardCountCols(sess) {
  const eq = (v) => (arr) => arr.filter((a) => a.s === v).length;
  if (isFieldFace(sess.faceType))
    return [
      { head: "6", name: "6点数", sub: "6点", count: eq(6) },
      { head: "5", name: "5点数", sub: "5点", count: eq(5) },
    ];
  if (isIndoorShortFace(sess))
    return [
      { head: "10", name: "10点数（X含む）", sub: "10点", count: eq(10) },
      { head: "9", name: "9点数", sub: "9点", count: eq(9) },
    ];
  return [
    { head: "10", name: "10点数（X含む）", sub: "10+X", count: eq(10) },
    { head: "X", name: "X数", sub: "X", count: (arr) => arr.filter((a) => a.X).length },
  ];
}
/* ラウンドの計画: 規定射数（自由練習は null）、計画エンド数、小計を入れる区切り（エンド数）。
   72射・60射のラウンドは半分（36射・30射）ごと。36射のラウンドは小計なしで合計だけ。
   自由練習は 6射エンドなら 36射ごと、3射エンドなら 30射ごと（ほかの本数は 36射に近い区切り） */
function scorecardPlan(sess) {
  const per = Math.max(1, +(sess && sess.perEnd) || 6);
  const stageDef = sessionStageDef(sess);
  const r = ROUND_TYPES.find((x) => x.id === (sess && sess.round));
  const quota = stageDef && stageDef.arrows ? stageDef.arrows : r && r.arrows ? r.arrows : null;
  let blockArrows;
  if (quota) blockArrows = quota >= 60 && (quota / 2) % per === 0 ? quota / 2 : null;
  else blockArrows = per === 3 ? 30 : 36 % per === 0 ? 36 : per * 6;
  return {
    per,
    quota,
    planEnds: quota ? Math.ceil(quota / per) : null,
    blockEnds: blockArrows ? blockArrows / per : null,
  };
}
/* 矢の列の並べ方。6射は 3射ずつ隙間を空け、7射以上は2段に折り返す */
function scoreGridLayout(cols) {
  const wrap = cols > 6;
  const line = wrap ? Math.ceil(cols / 2) : cols;
  const cls = cols === 6 ? "p6" : cols === 3 ? "p3" : wrap ? "pn wrap2" : "pn";
  return { cls, line, wrap, style: cols === 6 || cols === 3 ? "" : ` style="--sc-cols:${line}"` };
}
const sumScores = (arr) => arr.reduce((n, a) => n + (+a.s || 0), 0);
/* opts.rowButtons: 行を「このエンドを直す」ボタンにする / opts.editEnd: 直している行 /
   opts.skipIndex: 旧版の「開いて直す」で一時的に抜けているエンドの位置（番号だけ合わせる）/
   opts.final: 規定射数に届いていなくても合計行を出す（結果の表示用） */
function scorecardHtml(sess, opts) {
  const o = opts || {};
  const plan = scorecardPlan(sess);
  const ends = (sess && sess.ends) || [];
  const cols = Math.max(plan.per, ...ends.map((e) => e.length));
  const lay = scoreGridLayout(cols);
  const counts = scorecardCountCols(sess);
  const skip = Number.isInteger(o.skipIndex) ? o.skipIndex : -1;
  const withGap = (cells) => {
    if (cols === 6) cells.splice(3, 0, '<div class="gapCol" role="presentation"></div>');
    return cells.join("");
  };
  const subRow = (name, arr, cls) =>
    `<div class="scSub${cls ? " " + cls : ""}" role="row" data-sub="${cls || "block"}"><span class="name" role="rowheader">${name}</span>` +
    counts.map((c) => `<span role="cell">${c.sub}<b>${c.count(arr)}</b></span>`).join("") +
    `<span class="tot" role="cell">${sumScores(arr)}</span></div>`;
  let h =
    `<div class="scard ${lay.cls}${o.rowButtons ? " is-edit" : ""}"${lay.style} role="table" aria-label="スコア表" data-testid="scorecard">` +
    `<div class="scRow scHead" role="row"><div class="endNo" role="columnheader" aria-label="エンド">回</div>` +
    withGap(
      Array.from({ length: cols }, (_, i) => `<div role="columnheader">${i + 1}</div>`),
    ) +
    `<div class="endTot" role="columnheader" aria-label="エンドの計">計</div><div class="runTot" role="columnheader">累計</div>` +
    counts
      .map((c) => `<div class="cnt" role="columnheader" aria-label="${c.name}" title="${c.name}">${c.head}</div>`)
      .join("") +
    `</div>`;
  let run = 0,
    shot = 0;
  ends.forEach((end, e) => {
    const no = skip >= 0 && e >= skip ? e + 2 : e + 1;
    const sorted = scoreSortedArrows(end);
    const tot = sumScores(end);
    run += tot;
    const editing = o.editEnd === e;
    const cells = Array.from({ length: cols }, (_, i) => {
      const a = sorted[i];
      return a
        ? `<div class="cell ${scoreZoneClass(a, sess.faceType)}${arrowIsManual(a) ? " is-manual" : ""}" role="cell">${esc(scoreLabel(a))}${arrowIsManual(a) ? MANUAL_MARK_HTML : ""}</div>`
        : `<div class="cell" role="cell"></div>`;
    });
    const head = o.rowButtons
      ? `<button type="button" class="scRowBtn" data-erow="${e}" aria-pressed="${editing}" aria-label="第${no}エンドを直す（計${tot}点）">${no}</button>`
      : String(no);
    h +=
      `<div class="scRow${editing ? " is-edit" : ""}" role="row" data-end="${e}"><div class="endNo" role="rowheader">${head}</div>` +
      withGap(cells) +
      `<div class="endTot" role="cell">${tot}</div><div class="runTot" role="cell">${run}</div>` +
      counts.map((c) => `<div class="cnt" role="cell">${c.count(end)}</div>`).join("") +
      `</div>`;
    shot += end.length;
    if (skip < 0 && plan.blockEnds && (e + 1) % plan.blockEnds === 0) {
      const b = (e + 1) / plan.blockEnds - 1;
      const block = ends.slice(e + 1 - plan.blockEnds, e + 1).flat();
      if (!plan.quota) h += subRow(`小計 ${shot - block.length + 1}〜${shot}射`, block, "");
      else if (b < 2) h += subRow(`${b === 0 ? "前半" : "後半"} ${block.length}射`, block, "");
    }
  });
  const complete = !!plan.planEnds && skip < 0 && ends.length >= plan.planEnds;
  if (ends.length && (o.final || complete)) h += subRow(`合計 ${shot}射`, ends.flat(), "total");
  return h + "</div>";
}
/* 入力中（または直しているエンド）の枠。打った順・番号つき。data-i は矢の位置（打った順） */
function curRowHtml(arr, per, endNo, sel, o) {
  const opt = o || {};
  const cols = Math.max(per, arr.length);
  const lay = scoreGridLayout(cols);
  const cells = Array.from({ length: cols }, (_, i) => {
    const a = arr[i];
    if (!a)
      return `<div class="slot${i === arr.length && !opt.locked ? " is-next" : ""}"><span class="ord" aria-hidden="true">${i + 1}</span></div>`;
    const placed = arrowHasPos(a);
    const manual = arrowIsManual(a);
    /* 位置のない矢は右上に「なし」（枠が狭く「位置なし」は入らない。読み上げは「位置なし」）。
       点数だけの入力ではすべての枠に位置がないので出さない */
    const nopos = !placed && !opt.scoreMode;
    return (
      `<button type="button" class="slot ${scoreZoneClass(a, opt.faceType)}${sel === i ? " is-sel" : ""}${manual ? " is-manual" : ""}" data-i="${i}" aria-pressed="${sel === i}" aria-label="${i + 1}射目 ${esc(scoreLabel(a))}${manual ? " 手で修正" : ""}${nopos ? " 位置なし" : ""}">` +
      `<span class="ord" aria-hidden="true">${i + 1}</span>${esc(scoreLabel(a))}` +
      (manual ? `<span class="man" aria-hidden="true">*</span>` : "") +
      (a.no && !nopos ? `<small class="arrowNo">#${esc(a.no)}</small>` : "") +
      (nopos ? `<span class="nopos" aria-hidden="true">なし</span>` : "") +
      `</button>`
    );
  });
  if (cols === 6) cells.splice(3, 0, '<div class="gapCol"></div>');
  return (
    `<div class="curRow ${lay.cls}"${lay.style}><div class="curNo" aria-label="第${endNo}エンド">${endNo}</div>${cells.join("")}` +
    `<div class="sum" aria-label="このエンドの計">${arr.length ? sumScores(arr) : ""}</div></div>`
  );
}

/* ============ 記録中（没入画面） ============ */
/* 「中断」で記録画面を離れている間は、記録タブに再開の帯だけを出す。記録そのものは db.active に残る */
function recordPaused() {
  return !!(db.active && ui.recPausedId != null && ui.recPausedId === db.active.id);
}
/* 直している矢の並び: 確定済みエンドを開いていればそのエンド、そうでなければ入力中のエンド */
function activeEditEnd(s) {
  return Number.isInteger(ui.editEnd) && ui.editEnd >= 0 && ui.editEnd < s.ends.length
    ? ui.editEnd
    : -1;
}
function activeEditArr(s) {
  const e = activeEditEnd(s);
  return e >= 0 ? s.ends[e] : s.cur;
}
/* 状態行・目盛り・操作列が使う値をまとめて計算する */
function activeStatus(s) {
  const plan = scorecardPlan(s);
  /* 旧版の「エンドを開いて直す」の途中（エンドを s.cur に移してある）で再開した記録 */
  const pulled = s.editIndex != null;
  const doneArrows = s.ends.reduce((n, e) => n + e.length, 0);
  const allDone = !!plan.quota && !pulled && !s.cur.length && doneArrows >= plan.quota;
  return {
    plan,
    pulled,
    doneArrows,
    allDone,
    endNo: pulled ? Math.min(s.editIndex, s.ends.length) + 1 : s.ends.length + 1,
    total: sumScores(sessionArrows(s)),
    full: s.cur.length >= plan.per,
  };
}
function activeGuideHtml(scoreMode) {
  if (scoreMode) {
    const lead = "下のキーで1射ずつ点数を入れます。エンドの本数がそろったら「エンド確定」を押します。";
    if (db.settings.activeGuideSeen) return `<div class="miniEmpty">${lead}</div>`;
    return `<div class="miniEmpty activeGuide" data-testid="active-guide">
    <b>初回の操作ガイド</b>
    <span>${lead}</span>
    <span>下の枠をタップしてからキーを押すと、その矢の点数を置き換えます。確定したエンドは行をタップして直します。</span>
    <button type="button" class="txtBtn activeGuideDone" id="activeGuideDone">次から表示しない</button>
  </div>`;
  }
  if (db.settings.activeGuideSeen)
    return `<div class="miniEmpty">的をタップするとその位置を1射として記録します。長く押すと拡大鏡が出て、指を離した位置で記録します。</div>`;
  return `<div class="miniEmpty activeGuide" data-testid="active-guide">
    <b>初回の操作ガイド</b>
    <span>的をタップするとその位置を1射として記録します。長く押すと拡大鏡が出て、指を離した位置で記録します（0.4秒で微調整）。的の外で指を離すと取消です。</span>
    <span>下の枠をタップすると、その矢を置き直し・1mm ずつ移動・削除できます。確定したエンドは行をタップして直します。</span>
    <button type="button" class="txtBtn activeGuideDone" id="activeGuideDone">次から表示しない</button>
  </div>`;
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
const REC_CHEVRON =
  '<svg viewBox="0 0 10 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 1 2 8l6 7"/></svg>';
/* 的の表示範囲。三つ目的は縦長のまま。それ以外は的がほぼ幅いっぱい、「中心を拡大」で 6点帯の内側まで寄る */
function activeViewHalf(s) {
  return (s.faceD / 2) * ((ui.zoom || 1) > 1 ? 0.47 : 1.035);
}
function applyActiveZoom(s) {
  const tg = $("#tgsvg");
  if (!tg || s.faceType === "triple") return;
  const M = activeViewHalf(s);
  tg.setAttribute("viewBox", `${-M} ${-M} ${2 * M} ${2 * M}`);
  const b = $("#bZoom");
  if (b) {
    const on = (ui.zoom || 1) > 1;
    b.textContent = on ? "全体に戻す" : "中心を拡大";
    b.setAttribute("aria-pressed", String(on));
  }
}
function renderActive(m) {
  const s = db.active;
  const rg = s.roundGroup;
  const per = Math.max(1, +s.perEnd || 6);
  const scoreMode = sessionInputMode(s) === "score";
  const cond = s._edit
    ? `過去記録の編集・${s.dist}m`
    : `${s.dist}m・${esc(faceLabel(s))}${rg ? `（${(+rg.stage || 0) + 1}/${rg.stageCount}）` : ""}`;
  const step = [
    ["l", "←", "左"],
    ["u", "↑", "上"],
    ["d", "↓", "下"],
    ["r", "→", "右"],
  ];
  /* 的面に打つ: 的 → スコア表 → 枠 → 操作列。点数だけ: スコア表 → 枠 → 得点キー → 操作列（的は出さない）。
     的の大きさは「画面の高さ − 固定の帯」。7射以上のエンドは入力中の枠が2段になるぶんを引く */
  const targetHtml = scoreMode
    ? ""
    : `<div class="recTarget" id="tgWrap" data-testid="active-target">
      ${targetMarkup(s.faceD, "tg", s.faceType)}
      ${s.faceType === "triple" ? "" : `<button type="button" class="zoomBtn" id="bZoom" data-testid="active-zoom" aria-pressed="false">中心を拡大</button>`}
      <div class="lens" id="lens"><svg id="lensSvg" width="122" height="122"><use href="#tgmain"/><g id="lensCross"></g></svg></div>
      <div class="lensTag" id="lensTag">微調整モード</div>
    </div>`;
  const keysHtml = scoreMode
    ? `<div class="keys" id="scoreKeys" data-testid="score-keys" role="group" aria-label="得点キー">${scoreKeyDefs(
        s.faceType,
      )
        .map(
          (k) =>
            `<button type="button" class="key ${scoreZoneClass(k, s.faceType)}${k.id === "M" ? " is-miss" : ""}" data-key="${k.id}" data-testid="score-key-${k.id}" aria-label="${k.name}">${k.label}</button>`,
        )
        .join("")}</div>`
    : "";
  m.innerHTML = `
  <div class="recScreen${s.faceType === "triple" ? " is-triple" : ""}${scoreMode ? " is-score" : ""}" id="recScreen" data-input-mode="${scoreMode ? "score" : "target"}"${per > 6 ? ' style="--rec-fixed:372px"' : ""}>
    <header class="recTop">
      <button type="button" class="txtBtn" id="bPause" data-testid="active-pause" aria-label="記録を中断して戻る">${REC_CHEVRON}中断</button>
      <div class="condT">${cond}</div>
      <button type="button" class="txtBtn" id="bMenu" data-testid="active-menu" aria-haspopup="dialog">メニュー</button>
    </header>
    <section class="recStat" data-testid="active-hud" aria-label="記録中のスコア">
      <div class="recStatMain"><div class="endN" id="recEndN"></div><div class="msg" id="recMsg" aria-live="polite" aria-atomic="true"></div></div>
      <div class="tot"><span>合計</span><b class="tnum" id="hudTotal"></b></div>
    </section>
    <div class="ruler" id="recRuler" aria-hidden="true"></div>
    ${targetHtml}
    <div class="miniCard" id="recCard" data-testid="active-scorecard"></div>
    <div class="srOnly" id="arrowAnnounce" aria-live="polite" aria-atomic="true" data-testid="active-announce"></div>
    <div class="curEnd">
      <div class="curCap" id="curCap" hidden></div>
      <div id="curChips" data-testid="active-arrow-chips" role="group" aria-label="入力中のエンド（打った順）"></div>
    </div>
    <div class="editBar" id="nudge">
      <div class="ttl"><span id="nudgeTitle"></span><span class="desc" id="nudgeDesc"></span></div>
      <div class="editLinks">
        <button type="button" class="txtBtn" id="scoreOnlyOpen" data-testid="active-score-override" aria-haspopup="dialog">点数だけ直す</button>
        <button type="button" class="txtBtn" id="shotMetaOpen" aria-haspopup="dialog">理由・矢番号</button>
      </div>
      <div class="nudgeRow">
        <div class="nudgeKeys" role="group" aria-label="選択中の矢の微調整">
          ${step.map(([k, g, name]) => `<button type="button" class="btn ghost" data-n="${k}" aria-label="選択中の矢を${name}に微調整">${g}</button>`).join("")}
          <button type="button" class="btn danger" data-n="del" aria-label="選択中の矢を削除">削除</button>
        </div>
        <button type="button" class="btn" id="nudgeDone">完了</button>
      </div>
    </div>
    ${keysHtml}
    <div class="dockRow t2" id="activeActionDock" data-testid="active-action-dock"></div>
  </div>`;
  if (scoreMode) {
    /* 的がないので拡大鏡の固定レイヤーは片づけるだけ */
    mountLensLayer();
    document
      .querySelectorAll("#scoreKeys [data-key]")
      .forEach((b) => (b.onclick = () => pressScoreKey(b.dataset.key)));
  } else attachTargetInput(s);
  applyActiveZoom(s);
  const zoomBtn = $("#bZoom");
  if (zoomBtn)
    zoomBtn.onclick = () => {
      ui.zoom = (ui.zoom || 1) > 1 ? 1 : 2;
      applyActiveZoom(s);
      /* 拡大すると画面上の倍率が変わるので、矢番号の吹き出しを描き直す */
      refreshActive();
    };
  $("#bPause").onclick = () => {
    flushPendingSave();
    ui.recPausedId = s.id;
    ui.selArrow = -1;
    ui.editEnd = -1;
    render();
  };
  $("#bMenu").onclick = () => openActiveMenu();
  $("#shotMetaOpen").onclick = () => openShotMetaSheet();
  $("#scoreOnlyOpen").onclick = () => openScoreOverrideSheet();
  document
    .querySelectorAll("#nudge [data-n]")
    .forEach((b) => (b.onclick = () => nudgeArrow(b.dataset.n)));
  $("#nudgeDone").onclick = () => {
    ui.selArrow = -1;
    refreshActive();
  };
  refreshActive();
}
/* エンド確定。旧版の「開いて直す」途中（editIndex）の記録は元の位置へ戻す */
function confirmActiveEnd() {
  const s = db.active;
  if (!s || !s.cur.length) return;
  if (s.editIndex != null) {
    s.ends.splice(Math.min(s.editIndex, s.ends.length), 0, s.cur);
    s.editIndex = null;
  } else s.ends.push(s.cur);
  s.cur = [];
  ui.selArrow = -1;
  nativePulse("success");
  save();
  refreshActive();
}
function undoActiveArrow() {
  const s = db.active;
  if (!s || !s.cur.length) return;
  s.cur.pop();
  ui.selArrow = -1;
  nativePulse("light");
  save();
  refreshActive();
}
/* 位置のない矢を足せるか。入力中のエンドは本数がそろうまで、開いているエンドは本数が足りないときだけ */
function activeCanAppend(s, st) {
  if (activeEditEnd(s) >= 0) return activeEditArr(s).length < st.plan.per;
  return !st.allDone && !st.full;
}
/* 位置を作らずに1射を足す（得点キーと「M 位置なし」）。座標は持たせない */
function appendKeyArrow(def) {
  const s = db.active;
  if (!s) return;
  const st = activeStatus(s);
  if (!activeCanAppend(s, st)) {
    activeNotice(
      activeEditEnd(s) >= 0
        ? "直す矢を選んでください"
        : st.allDone
          ? "全エンドを記録済みです"
          : "エンドを確定してください",
    );
    return;
  }
  const arr = activeEditArr(s);
  const rec = { s: def.s, X: def.X, src: "key" };
  arr.push(rec);
  if (arr === s.cur) ui.freshArrow = arr.length - 1;
  nativePulse("light");
  scheduleSave("arrow-add");
  refreshActive();
  announceArrow(arr.length, rec);
}
/* 得点キー。枠を選んでいればその矢の点数を置き換え、選んでいなければ1射を足す */
function pressScoreKey(id) {
  const s = db.active;
  if (!s) return;
  const def = scoreKeyDefs(s.faceType).find((k) => k.id === id);
  if (!def) return;
  const arr = activeEditArr(s);
  const a = ui.selArrow >= 0 ? arr[ui.selArrow] : null;
  if (!a) {
    appendKeyArrow(def);
    return;
  }
  const n = ui.selArrow + 1;
  applyScoreKey(a, def);
  ui.selArrow = -1;
  nativePulse("light");
  scheduleSave("score-replace");
  refreshActive();
  announceArrow(n, a);
}
/* 下端の操作列。
   的面に打つ: 取消 / M 位置なし / エンド確定。点数だけ: 取消 / エンド確定（枠を選んでいる間は 削除 / 選択解除 / 確定）。
   規定の射数を終えたら主ボタンが「終了」（多距離の途中は「次の距離へ」）。
   確定済みエンドを開いているあいだは「修正を終える」（的面で矢が足りなければ M 位置なし も） */
function renderActiveDock(s, st) {
  const dock = $("#activeActionDock");
  const next = nextStageDef(s);
  const left = Math.max(0, st.plan.per - s.cur.length);
  const scoreMode = sessionInputMode(s) === "score";
  const editing = activeEditEnd(s) >= 0;
  const canAppend = activeCanAppend(s, st);
  const missBtn = `<button type="button" class="btn ghost col" id="bMiss" data-testid="active-miss" aria-label="ミス（M）を位置なしで記録"${canAppend ? "" : " disabled"}>M<small>位置なし</small></button>`;
  const endBtn = `<button type="button" class="btn col${st.full ? "" : " ghost"}" id="bEnd" data-testid="active-end"${s.cur.length ? "" : " disabled"}>エンド確定${st.full ? "" : `<small>あと${left}射</small>`}</button>`;
  const editDoneBtn = `<button type="button" class="btn" id="bEditDone" data-testid="active-edit-done">修正を終える</button>`;
  const finishBtn = next
    ? `<button type="button" class="btn" id="bNextStage">次の距離へ（${next.dist}m）</button>`
    : `<button type="button" class="btn" id="bFinishMain" data-testid="active-finish-primary">${s._edit ? "編集を保存して結果を見る" : "記録を終了して結果を見る"}</button>`;
  let html, cls;
  if (scoreMode && ui.selArrow >= 0) {
    /* 点数だけ: 枠を選んでいる間はキーが「置き換え」になる。操作列は 削除 / 選択解除 / 主ボタン */
    cls = "t3";
    html =
      `<button type="button" class="btn danger" id="bSlotDel" data-testid="active-slot-delete" aria-label="選択中の矢を削除">削除</button>` +
      `<button type="button" class="btn ghost" id="bDeselect" data-testid="active-deselect">選択解除</button>` +
      (editing ? editDoneBtn : st.allDone ? finishBtn : endBtn);
  } else if (editing) {
    cls = scoreMode || !canAppend ? "t1" : "t2";
    html = (cls === "t2" ? missBtn : "") + editDoneBtn;
  } else if (st.allDone) {
    cls = "t2";
    html = `<button type="button" class="btn ghost" id="bUndo" data-testid="active-undo" disabled>取消</button>` + finishBtn;
  } else {
    cls = scoreMode ? "t2" : "t3";
    html =
      `<button type="button" class="btn ghost" id="bUndo" data-testid="active-undo"${s.cur.length ? "" : " disabled"}>取消</button>` +
      (scoreMode ? "" : missBtn) +
      endBtn;
  }
  dock.className = `dockRow ${cls}`;
  dock.innerHTML = html;
  const on = (id, fn) => {
    const b = $("#" + id);
    if (b) b.onclick = fn;
  };
  on("bUndo", undoActiveArrow);
  on("bEnd", confirmActiveEnd);
  on("bMiss", () => appendKeyArrow({ s: 0, X: false }));
  on("bSlotDel", () => nudgeArrow("del"));
  on("bDeselect", () => {
    ui.selArrow = -1;
    refreshActive();
  });
  on("bFinishMain", () => finishSession());
  on("bNextStage", () => advanceRoundStage());
  on("bEditDone", () => {
    ui.editEnd = -1;
    ui.selArrow = -1;
    refreshActive();
  });
}
/* ---------- 記録のメニュー ---------- */
function openActiveMenu() {
  const s = db.active;
  if (!s) return;
  const setup = db.setups.find((x) => x.id === s.setupId);
  const all = sessionArrows(s);
  const total = sumScores(all);
  const next = nextStageDef(s);
  const counts = scorecardCountCols(s);
  const scoreMode = sessionInputMode(s) === "score";
  const go =
    '<svg class="go chev" viewBox="0 0 10 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 1l6 7-6 7"/></svg>';
  const item = (id, title, sub, attr) =>
    `<button type="button" class="lrow link" id="${id}"${attr || ""}><span class="lmain"><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</span>${go}</button>`;
  const meta = [s.wx, s.windDir, s.windSpeed ? `${s.windSpeed}m/s` : "", s.note]
    .filter(Boolean)
    .map(esc)
    .join("・");
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  ovl.innerHTML = `<div class="sheet recMenu" data-testid="active-menu-sheet">
    <h3>記録のメニュー</h3>
    <p class="basis">${fmtD(s.date)}・${s.dist}m・${esc(faceLabel(s))}・${setup ? esc(setup.name) : "セッティング未指定"}</p>
    <div class="figs recMenuFigs">
      <div class="fig"><div class="l">合計（${all.length}射）</div><div class="n">${total}</div></div>
      <div class="fig"><div class="l">平均/射</div><div class="n">${all.length ? (total / all.length).toFixed(2) : "—"}</div></div>
      <div class="fig"><div class="l">${counts.map((c) => c.sub).join(" / ")}</div><div class="n">${counts.map((c) => c.count(all)).join("<small>/</small>")}</div></div>
    </div>
    <div class="lrow recMenuMode">
      <span class="lmain"><b id="mModeLabel">入力方法</b><span>${scoreMode ? "点数をキーで入れます。的の図と着弾の統計は、位置のある矢だけで作ります。" : "的をタップして位置と点数を記録します。"}</span></span>
      <div class="seg" role="group" aria-labelledby="mModeLabel" data-testid="input-mode">
        <button type="button" data-mode="target" data-testid="input-mode-target" aria-pressed="${!scoreMode}">的面に打つ</button>
        <button type="button" data-mode="score" data-testid="input-mode-score" aria-pressed="${scoreMode}">点数だけ</button>
      </div>
    </div>
    ${item("mMeta", "天気・風・メモを書く", meta || "必要なときだけ入力します")}
    ${next ? item("mNextStage", `次の距離へ（${next.dist}m）`, "このステージを確定して次へ進みます") : ""}
    ${item("mSettings", "設定", "表示・拡大鏡の位置など")}
    ${item(
      "bFinish",
      s._edit ? "編集を終了して保存する" : "ここで記録を終了する",
      all.length ? `${all.length}射まで保存して結果を表示します` : "矢がまだありません。記録を破棄できます",
      ' data-testid="active-finish"',
    )}
    <div class="btnRow"><button type="button" class="btn ghost" id="mClose">閉じる</button></div>
  </div>`;
  openModal(ovl, { escapeTarget: "#mClose" });
  /* 入力方法の切り替え。矢はそのまま残す（位置のない矢は、的面ではスコア表と枠にだけ出る） */
  ovl.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        const mode = b.dataset.mode === "score" ? "score" : "target";
        closeModal(ovl);
        if (mode === sessionInputMode(s)) return;
        s.inputMode = mode;
        db.settings.lastInputMode = mode;
        ui.selArrow = -1;
        ui.zoom = 1;
        save("input-mode");
        render();
      }),
  );
  const pick = (sel, fn) => {
    const b = ovl.querySelector(sel);
    if (b)
      b.onclick = () => {
        closeModal(ovl);
        fn();
      };
  };
  ovl.querySelector("#mClose").onclick = () => closeModal(ovl);
  pick("#mMeta", openSessionMetaSheet);
  pick("#mNextStage", () => advanceRoundStage());
  pick("#mSettings", openSettings);
  pick("#bFinish", () => finishSession());
}
/* 天気・風・メモ（記録開始時の「詳しく残す」と同じ項目を、記録の途中で書き足す） */
function openSessionMetaSheet() {
  const s = db.active;
  if (!s) return;
  const opts = (list, cur) =>
    [""]
      .concat(list, cur && !list.includes(cur) ? [cur] : [])
      .map((v) => `<option value="${esc(v)}"${v === (cur || "") ? " selected" : ""}>${v ? esc(v) : "—"}</option>`)
      .join("");
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  ovl.innerHTML = `<div class="sheet" data-testid="active-meta-sheet">
    <h3>天気・風・メモ</h3>
    <label class="f" for="amWx">天候・コンディション</label>
    <select class="inp" id="amWx">${opts(["晴れ", "くもり", "雨", "風 弱", "風 強", "室内"], s.wx)}</select>
    <div class="row">
      <div><label class="f" for="amWindDir">風向</label><select class="inp" id="amWindDir">${opts(["向かい風", "追い風", "左から", "右から", "巻き風"], s.windDir)}</select></div>
      <div><label class="f" for="amWindSpeed">風速 (m/s)</label><input class="inp" id="amWindSpeed" inputmode="decimal" placeholder="例: 2.5" value="${esc(s.windSpeed || "")}"></div>
    </div>
    <label class="f" for="amNote">メモ</label>
    <textarea class="noteBox" id="amNote" rows="3" placeholder="メモ（任意）">${esc(s.note || "")}</textarea>
    <div class="btnRow"><button type="button" class="btn ghost" id="amCancel">やめる</button><button type="button" class="btn" id="amSave">保存</button></div>
  </div>`;
  openModal(ovl, { escapeTarget: "#amCancel" });
  ovl.querySelector("#amCancel").onclick = () => closeModal(ovl);
  ovl.querySelector("#amSave").onclick = () => {
    s.wx = ovl.querySelector("#amWx").value;
    s.windDir = ovl.querySelector("#amWindDir").value;
    s.windSpeed = ovl.querySelector("#amWindSpeed").value.trim();
    s.note = ovl.querySelector("#amNote").value.trim();
    save();
    closeModal(ovl);
  };
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
/* 選択中の矢の理由タグと矢番号（任意の記録）。修正バーの「理由・矢番号」から開く */
function openShotMetaSheet() {
  const s = db.active,
    a = s && activeEditArr(s)[ui.selArrow];
  if (!a) return;
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  ovl.innerHTML = `<div class="sheet" data-testid="shot-meta-sheet">
    <h3>${ui.selArrow + 1}射目の理由・矢番号</h3>
    <div class="shotMeta" id="shotMeta">${shotMetaHtml(a, ui.selArrow)}</div>
    <div class="btnRow"><button type="button" class="btn" id="shotMetaClose">閉じる</button></div>
  </div>`;
  openModal(ovl, { escapeTarget: "#shotMetaClose" });
  ovl.querySelector("#shotMetaClose").onclick = () => closeModal(ovl);
  bindShotMeta(ovl, a);
}
function bindShotMeta(root, a) {
  const no = root.querySelector("#shotArrowNo");
  if (no) {
    no.oninput = (e) => {
      a.no = e.target.value.trim();
      /* キーストロークごとの全量書き込みを避ける（flush は pagehide 等で保証） */
      scheduleSave("shot-meta");
    };
    no.onchange = () => refreshActive();
  }
  root.querySelectorAll("#shotReasonTags .reasonTag").forEach(
    (btn) =>
      (btn.onclick = () => {
        const reason = btn.dataset.reason;
        a.reason = a.reason === reason ? "" : reason;
        root.querySelectorAll("#shotReasonTags .reasonTag").forEach((x) => {
          const on = x.dataset.reason === a.reason;
          x.classList.toggle("on", on);
          x.setAttribute("aria-pressed", String(on));
        });
        nativePulse("light");
        scheduleSave("shot-meta");
      }),
  );
}
/* 矢を記録したことは画面では枠の出現で示し、トーストは出さない（入力の邪魔をしない）。
   画面読み上げには「3射目 9点」を知らせる */
function announceArrow(n, a) {
  const el = $("#arrowAnnounce");
  if (el)
    el.textContent = `${n}射目 ${a.s === 0 ? "ミス" : `${scoreLabel(a)}点`}${arrowIsManual(a) ? " 手で修正" : ""}`;
}
/* 状態行の一時的な案内（6射を入力済み、など）。次の操作で消える */
function activeNotice(msg) {
  ui.recMsg = msg;
  refreshActive();
}
/* 「点数だけ直す」: 位置はそのままで、選んだ矢の点数だけを置き換える小さなキーの画面。
   自動採点（位置から決まる点）と違う点を選ぶと manual:true になり、スコア表と枠に * の印が付く */
function openScoreOverrideSheet() {
  const s = db.active,
    a = s && activeEditArr(s)[ui.selArrow];
  if (!a) return;
  const n = ui.selArrow + 1;
  const placed = arrowHasPos(a);
  const manual = arrowIsManual(a) && a.auto && typeof a.auto.s === "number";
  const autoText = (h) => (h.s === 0 ? "M" : `${scoreLabel(h)}${h.X ? "" : "点"}`);
  const basis = !placed
    ? "位置のない矢です。点数を選ぶと置き換わります。"
    : manual
      ? `いまは手で直した ${autoText(a)} です（位置からの採点は ${autoText(a.auto)}）。位置は変わりません。`
      : `位置からの採点は ${autoText(a)} です。違う点を選ぶと、手で直した印（*）が付きます。位置は変わりません。`;
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  ovl.innerHTML = `<div class="sheet scoreOverride" data-testid="score-override-sheet">
    <h3>${n}射目の点数だけ直す</h3>
    <p class="basis">${basis}</p>
    <div class="keys sheetKeys" role="group" aria-label="得点キー">${scoreKeyDefs(s.faceType)
      .map(
        (k) =>
          `<button type="button" class="key ${scoreZoneClass(k, s.faceType)}${k.id === "M" ? " is-miss" : ""}" data-key="${k.id}" data-testid="override-key-${k.id}" aria-label="${k.name}">${k.label}</button>`,
      )
      .join("")}</div>
    <div class="btnRow">
      ${manual ? `<button type="button" class="btn ghost" id="soAuto" data-testid="score-override-auto">自動採点に戻す</button>` : ""}
      <button type="button" class="btn ghost" id="soCancel">やめる</button>
    </div>
  </div>`;
  openModal(ovl, { escapeTarget: "#soCancel" });
  const apply = (def) => {
    applyScoreKey(a, def);
    closeModal(ovl);
    nativePulse("light");
    scheduleSave("score-override");
    refreshActive();
    announceArrow(n, a);
  };
  ovl.querySelector("#soCancel").onclick = () => closeModal(ovl);
  const back = ovl.querySelector("#soAuto");
  if (back) back.onclick = () => apply({ s: a.auto.s, X: !!a.auto.X });
  ovl.querySelectorAll("[data-key]").forEach(
    (b) =>
      (b.onclick = () => {
        const def = scoreKeyDefs(s.faceType).find((k) => k.id === b.dataset.key);
        if (def) apply(def);
      }),
  );
}
/* 記録中セッションの判定用半径(cm)。記録開始時の arrowR。旧判定で始まった記録・旧記録の編集は旧半径のまま
   （20-scoring.js sessionScoringRadius）。保存された点数と矢円と新しい矢の判定をセッション内で揃える */
function activeArrowR(s) {
  return sessionScoringRadius(s, s && db.setups.find((x) => x.id === s.setupId));
}
/* 記録中の的の印（矢円と矢番号の吹き出し）を描く。吹き出しの大きさは画面上の倍率で決まるため、
   画面の幅が変わったときもこれだけを描き直す。
   番号を付けるのは入力中のエンド（確定済みエンドを開いているときはそのエンド）。ほかのエンドは薄く、番号なし */
function drawActiveMarks(s) {
  if (!s || !$("#tgmarks")) return;
  let html = "";
  const placed = arrowHasPos;
  const gp = (a) => (s.faceType === "triple" ? { x: a.x, y: a.y + SPOT_Y[a.spot || 0] } : a);
  const arrowR = activeArrowR(s);
  const focus = activeEditArr(s);
  /* 座標のない矢（座標なしの M など）は描かない */
  [...s.ends, s.cur].forEach((end) => {
    if (end === focus) return;
    end.forEach((a) => {
      if (placed(a)) html += markCircle(gp(a), s.faceD, "rgba(60,60,60,.45)", "", "", arrowR);
    });
  });
  focus.forEach((a, i) => {
    if (!placed(a)) return;
    html += markCircle(
      gp(a),
      s.faceD,
      i === ui.selArrow ? "#111" : "var(--green-l)",
      "",
      focus === s.cur && i === ui.freshArrow ? "shotNew" : "",
      arrowR,
    );
  });
  /* 矢番号（射った順）を画面上で読める大きさの吹き出しにし、重なりを避けて引き出し線で結ぶ */
  const tg = $("#tgsvg");
  const vb = tg && tg.viewBox && tg.viewBox.baseVal;
  const pxPerCm = tg && vb && vb.width > 0 ? tg.getBoundingClientRect().width / vb.width : 0;
  if (pxPerCm > 0) {
    const pts = focus.map((a) => (placed(a) ? gp(a) : null));
    const lay = layoutArrowLabels(pts, pxPerCm, vb);
    pts.forEach((p, i) => {
      html += arrowLabelSvg(p, lay.labels[i], lay.r, lay.font, String(i + 1), i === ui.selArrow);
    });
  }
  $("#tgmarks").innerHTML = html;
}
function refreshActive() {
  const s = db.active;
  const chipsBox = $("#curChips");
  if (!s || !chipsBox) return;
  ui.editEnd = activeEditEnd(s);
  const arr = activeEditArr(s);
  if (!(ui.selArrow >= 0 && arr[ui.selArrow])) ui.selArrow = -1;
  const st = activeStatus(s);
  const per = st.plan.per;
  const editing = ui.editEnd >= 0;
  const sel = ui.selArrow;
  const scoreMode = sessionInputMode(s) === "score";
  drawActiveMarks(s);
  /* 状態行: 第Nエンド・何射目・合計 */
  $("#recEndN").textContent = st.allDone
    ? "全エンド確定"
    : st.pulled
      ? `第${st.endNo}エンドを修正中`
      : `第${st.endNo}エンド`;
  const first = st.doneArrows + 1;
  const range = per > 1 ? `${first}〜${first + per - 1}射目` : `${first}射目`;
  const notice = ui.recMsg || "";
  ui.recMsg = "";
  const msg = $("#recMsg");
  msg.textContent =
    notice ||
    (st.allDone
      ? `${st.doneArrows}射を記録しました`
      : st.pulled
        ? "確定で元の位置に戻ります"
        : `${range}・${st.plan.quota ? `全${st.plan.quota}射` : "自由練習"}`);
  msg.classList.toggle("is-warn", !!notice);
  $("#hudTotal").textContent = String(st.total);
  /* エンドの目盛り。規定のあるラウンドは計画エンド数、自由練習は小計の区切りごとに延ばす */
  const block = st.plan.blockEnds || 6;
  const shown = s.ends.length + (st.pulled ? 1 : 0);
  const segs = Math.max(
    st.plan.planEnds || Math.ceil((shown + 1) / block) * block,
    shown + (st.allDone ? 0 : 1),
  );
  $("#recRuler").innerHTML = Array.from(
    { length: segs },
    (_, i) =>
      `<i class="${i < shown && !(st.pulled && i === st.endNo - 1) ? "is-done" : i === st.endNo - 1 && !st.allDone ? "is-cur" : ""}"></i>`,
  ).join("");
  /* 確定済みエンドのスコア表（高い点から表示）。行をタップするとそのエンドを下の枠に開く */
  const card = $("#recCard");
  const focused = document.activeElement;
  const rowFocus =
    focused && focused.dataset && focused.dataset.erow != null && card.contains(focused)
      ? focused.dataset.erow
      : null;
  card.innerHTML = s.ends.length
    ? scorecardHtml(s, {
        rowButtons: !st.pulled,
        editEnd: editing ? ui.editEnd : -1,
        skipIndex: st.pulled ? Math.min(s.editIndex, s.ends.length) : null,
      })
    : activeGuideHtml(scoreMode);
  card.querySelectorAll("[data-erow]").forEach(
    (b) =>
      (b.onclick = () => {
        const e = +b.dataset.erow;
        ui.editEnd = ui.editEnd === e ? -1 : e;
        ui.selArrow = -1;
        nativePulse("light");
        refreshActive();
      }),
  );
  const guideDone = $("#activeGuideDone");
  if (guideDone)
    guideDone.onclick = () => {
      db.settings.activeGuideSeen = true;
      save("active-guide");
      refreshActive();
    };
  if (rowFocus != null) {
    const back = card.querySelector(`[data-erow="${rowFocus}"]`);
    if (back) back.focus({ preventScroll: true });
  }
  /* 入力中（または直している）エンドの枠。innerHTML の置き換えでフォーカスが消えるので data-i で戻す */
  const focusI =
    focused && focused.dataset && focused.dataset.i != null && chipsBox.contains(focused)
      ? focused.dataset.i
      : null;
  const cap = $("#curCap");
  /* 的面: 見出しは矢を選ぶ前だけ（選んだあとは修正バーの見出しがエンド名を兼ねる。短い画面で高さを空ける）。
     点数だけ: 修正バーが無いので、選んでいる矢の案内と「理由・矢番号」をここに出す */
  cap.hidden = scoreMode ? !editing && sel < 0 : !editing || sel >= 0;
  cap.classList.toggle("has-act", scoreMode && sel >= 0);
  cap.innerHTML =
    scoreMode && sel >= 0
      ? `<div class="capMain"><b>${editing ? `第${ui.editEnd + 1}エンド ` : ""}${sel + 1}射目を選択中</b><span>キーを押すと置き換わります</span></div><button type="button" class="txtBtn" id="capMeta" aria-haspopup="dialog">理由・矢番号</button>`
      : editing
        ? `<b>第${ui.editEnd + 1}エンドを修正中</b><span>${arr.length < per ? `矢を選ぶか、${scoreMode ? "キー" : "的をタップ"}で追加` : "直す矢を選んでください"}</span>`
        : "";
  const capMeta = $("#capMeta");
  if (capMeta) capMeta.onclick = () => openShotMetaSheet();
  const rowNo = editing ? ui.editEnd + 1 : st.allDone ? Math.min(st.endNo, st.plan.planEnds) : st.endNo;
  chipsBox.innerHTML = curRowHtml(st.allDone && !editing ? [] : arr, per, rowNo, sel, {
    faceType: s.faceType,
    locked: st.allDone && !editing,
    scoreMode,
  });
  chipsBox.querySelectorAll(".slot[data-i]").forEach(
    (c) =>
      (c.onclick = () => {
        ui.selArrow = ui.selArrow === +c.dataset.i ? -1 : +c.dataset.i;
        nativePulse("light");
        refreshActive();
      }),
  );
  if (focusI != null) {
    const back = chipsBox.querySelector(`.slot[data-i="${focusI}"]`);
    if (back) back.focus({ preventScroll: true });
  }
  if (ui.freshArrow >= 0) {
    clearTimeout(ui.freshTimer);
    ui.freshTimer = setTimeout(() => {
      ui.freshArrow = -1;
      document.querySelectorAll(".shotNew").forEach((el) => el.classList.remove("shotNew"));
    }, 640);
  }
  /* 的面: 矢を選ぶと、操作列の代わりに修正バー（置き直し・1mm 移動・削除・点数だけ直す）を出す。
     点数だけ: 修正バーは出さず、得点キーが「選んだ矢の置き換え」になる */
  const bar = $("#nudge");
  bar.classList.toggle("on", !scoreMode && sel >= 0);
  if (!scoreMode && sel >= 0) {
    const a = arr[sel];
    const placed = arrowHasPos(a);
    $("#nudgeTitle").textContent =
      `${editing ? `第${ui.editEnd + 1}エンド ` : ""}${sel + 1}射目を修正（${scoreLabel(a)}${a.s === 0 || a.X ? "" : "点"}${arrowIsManual(a) ? "・手で修正" : ""}）`;
    $("#nudgeDesc").textContent = placed
      ? "的をタップで置き直し・矢印は1mmずつ"
      : "位置なし・的をタップで位置を付ける";
    bar.querySelectorAll("[data-n]").forEach((b) => {
      if (b.dataset.n !== "del") b.disabled = !placed;
    });
  }
  /* 操作列は状態に合わせて作り直す。キーボード操作のフォーカスは同じ id のボタンへ戻す */
  const dock = $("#activeActionDock");
  const dockFocus = focused && dock.contains(focused) ? focused.id : "";
  dock.hidden = !scoreMode && sel >= 0;
  renderActiveDock(s, st);
  /* 得点キー: 枠を選んでいれば置き換えに使える。選んでいなければ、足せるときだけ押せる */
  const keys = $("#scoreKeys");
  if (keys) {
    const off = !(sel >= 0 || activeCanAppend(s, st));
    keys.classList.toggle("is-replace", sel >= 0);
    keys.querySelectorAll(".key").forEach((b) => (b.disabled = off));
  }
  const dockBack = dockFocus ? document.getElementById(dockFocus) : null;
  if (dockBack && !dockBack.disabled) dockBack.focus({ preventScroll: true });
  /* 新しいエンドが見える位置へ。開いているエンドがあればその行を見える範囲に入れる */
  const row = editing ? card.querySelector(`.scRow[data-end="${ui.editEnd}"]`) : null;
  if (row) {
    const top = row.offsetTop - card.offsetTop,
      bottom = top + row.offsetHeight;
    if (top < card.scrollTop) card.scrollTop = top;
    else if (bottom > card.scrollTop + card.clientHeight) card.scrollTop = bottom - card.clientHeight;
  } else card.scrollTop = card.scrollHeight;
  const t = $("#toast");
  if (t && t.classList.contains("show")) positionToast(t);
}
/* 選択中の矢を 1mm 動かす（または削除する）。動かしたあとは、描かれる矢円と同じ半径で採点し直す */
const NUDGE_STEP_CM = 0.1;
function nudgeArrow(dirKey) {
  const s = db.active;
  if (!s) return;
  const arr = activeEditArr(s);
  if (ui.selArrow < 0 || !arr[ui.selArrow]) return;
  if (dirKey === "del") {
    arr.splice(ui.selArrow, 1);
    /* 確定済みエンドの矢がすべて無くなったら、そのエンド自体を外す */
    if (arr !== s.cur && !arr.length) {
      s.ends.splice(ui.editEnd, 1);
      ui.editEnd = -1;
    }
    ui.selArrow = -1;
    nativePulse("heavy");
    save();
    refreshActive();
    return;
  }
  const a = arr[ui.selArrow],
    step = NUDGE_STEP_CM;
  if (!arrowHasPos(a)) {
    activeNotice("位置のない矢は動かせません");
    return;
  }
  /* 配置と同じく 0.01cm に丸めた座標を保存して採点する */
  if (dirKey === "u") a.y = +(a.y + step).toFixed(2) || 0;
  if (dirKey === "d") a.y = +(a.y - step).toFixed(2) || 0;
  if (dirKey === "l") a.x = +(a.x - step).toFixed(2) || 0;
  if (dirKey === "r") a.x = +(a.x + step).toFixed(2) || 0;
  Object.assign(a, scoreAt(a.x, a.y, s.faceD, s.faceType, activeArrowR(s)));
  /* 動かしたら位置から採点し直す。手で直した点数は外す（矢円と点数をそろえる） */
  if (clearManualScore(a)) ui.recMsg = "手修正を外して採点しました";
  nativePulse("light");
  scheduleSave("nudge");
  refreshActive();
}

/* target pointer input with long-press fine mode + lens */
/* ルーペ（拡大鏡）は的の外、ヘッダー直下の右（設定で左）に画面固定し、入力中は動かさない（中身だけ指に追従）。
   的のカードの中に置くと親要素の影響で固定できないため、ページ直下の固定レイヤーへ移す。
   <use href="#tgmain"> で的を参照するので場所を移しても描画できる。再描画のたびに古いレイヤーは捨てる */
function mountLensLayer() {
  document.querySelectorAll("body > .lensLayer").forEach((n) => n.remove());
  const lens = $("#lens"),
    lensTag = $("#lensTag");
  if (!lens || !lensTag) return;
  const layer = document.createElement("div");
  layer.className = "lensLayer";
  layer.append(lens, lensTag);
  document.body.append(layer);
}
function attachTargetInput(s) {
  mountLensLayer();
  const svg = $("#tgsvg"),
    lens = $("#lens"),
    lensSvg = $("#lensSvg"),
    lensTag = $("#lensTag"),
    cur = $("#tgcur");
  /* ルーペを出す条件: 150ms 以上押し続けるか、6px 以上動かしたとき。短いタップでは出さない。
     400ms 押し続けて動きが 10px 未満なら精密モード（移動量 1/4） */
  const LENS_SHOW_MS = 150,
    LENS_SHOW_MOVE_PX = 6,
    FINE_MS = 400,
    FINE_MAX_MOVE_PX = 10;
  let drag = null,
    cursorFrame = 0,
    cursorPoint = null,
    touchBlocked = false,
    touchGuard = false;
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
  /* 指が的の枠の外に出ているか（外で離すと取消） */
  function outsideTarget(cp) {
    const r = svg.getBoundingClientRect();
    return cp.x < r.left || cp.x > r.right || cp.y < r.top || cp.y > r.bottom;
  }
  function drawCursor(p) {
    const w = ringW(s.faceD, s.faceType);
    const fine = !!(drag && drag.fine);
    const arrowR = activeArrowR(s);
    /* 確定時と同じく 0.01cm に丸めた位置で線かみを判定する */
    const cutting = fine && isLineCuttingFromGlobal(+p.x.toFixed(2), +p.y.toFixed(2), s.faceD, s.faceType, arrowR);
    const cursorStroke = Math.min(s.faceD / 400, arrowR / 2.5);
    const c = fine ? (cutting ? "var(--status-ok)" : "var(--status-warn)") : "#111";
    lens.classList.toggle("cut", cutting);
    lens.classList.toggle("miss", fine && !cutting);
    lensTag.classList.toggle("cut", cutting);
    lensTag.classList.toggle("miss", fine && !cutting);
    /* ルーペの下に、離したときの得点（大きく）と線かみの状態を出す */
    const hit = hitFromGlobal(+p.x.toFixed(2), +p.y.toFixed(2), s.faceD, s.faceType, arrowR);
    const out = !!(drag && drag.out);
    lensTag.classList.toggle("is-cancel", out);
    lensTag.innerHTML = out
      ? `<b>取消</b><span>離すと記録しません</span>`
      : `<b>${esc(scoreLabel(hit))}</b><span>${fine ? (cutting ? "線かみ" : "線なし") : "点"}</span>`;
    cur.innerHTML = `<g>
      <line x1="${p.x - w}" y1="${-p.y}" x2="${p.x + w}" y2="${-p.y}" stroke="${c}" stroke-width="${s.faceD / 500}"/>
      <line x1="${p.x}" y1="${-p.y - w}" x2="${p.x}" y2="${-p.y + w}" stroke="${c}" stroke-width="${s.faceD / 500}"/>
      <circle cx="${p.x}" cy="${-p.y}" r="${arrowMarkRadius(s.faceD, arrowR) - cursorStroke / 2}" fill="none" stroke="${c}" stroke-width="${cursorStroke}"/>
    </g>`;
    /* 微調整モードでは実寸の矢円が見える倍率まで寄せる（線かみの目視確認用） */
    const z = fine ? clamp(arrowR * 12, w * 0.6, w * 2.2) : w * 2.2;
    lensSvg.setAttribute("viewBox", `${p.x - z} ${-p.y - z} ${2 * z} ${2 * z}`);
  }
  /* ルーペの固定位置（画面座標）。表示するときに1回だけ決め、入力中は動かさない */
  function placeLens() {
    const left = db.settings.lensSide === "left";
    for (const el of [lens, lensTag]) {
      el.style.left = left ? "12px" : "auto";
      el.style.right = left ? "auto" : "12px";
    }
    /* 上端は CSS（.lens の top＝安全域＋8px）が決める。ヘッダー帯は無い（v5）。ラベルはその直下 */
    lensTag.style.top = `${Math.round(lens.getBoundingClientRect().bottom + 6)}px`;
  }
  function showLens() {
    if (!drag || drag.shown) return;
    drag.shown = true;
    lens.style.display = "block";
    lens.classList.remove("cut", "miss");
    lensTag.classList.remove("fine", "cut", "miss");
    lensTag.style.display = "flex";
    placeLens();
    drawCursor(drag.p);
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
    if (drag && drag.showTm) clearTimeout(drag.showTm);
    if (cursorFrame) {
      caf(cursorFrame);
      cursorFrame = 0;
    }
    cursorPoint = null;
    drag = null;
    cur.innerHTML = "";
    lens.style.display = "none";
    lens.classList.remove("fine", "cut", "miss");
    lensTag.classList.remove("fine", "cut", "miss", "is-cancel");
    lensTag.style.display = "none";
    if (!touchBlocked) stopTouchGuard();
  }
  function stopTouchGuard() {
    if (!touchGuard) return;
    touchGuard = false;
    document.removeEventListener("touchstart", touchStart, true);
    document.removeEventListener("touchend", touchEnd, true);
    document.removeEventListener("touchcancel", touchEnd, true);
  }
  function watchTouch() {
    if (touchGuard) return;
    touchGuard = true;
    // Watch only this gesture, including a second finger outside the SVG.
    document.addEventListener("touchstart", touchStart, true);
    document.addEventListener("touchend", touchEnd, true);
    document.addEventListener("touchcancel", touchEnd, true);
  }
  function blockTouch() {
    touchBlocked = true;
    resetDrag();
    watchTouch();
  }
  function touchStart(e) {
    if (e.touches.length > 1) blockTouch();
  }
  function touchEnd(e) {
    if (e.touches.length) return;
    touchBlocked = false;
    stopTouchGuard();
    if (!svg.isConnected) resetDrag();
  }
  svg.addEventListener("contextmenu", (e) => e.preventDefault());
  svg.addEventListener("selectstart", (e) => e.preventDefault());
  function down(e) {
    const cp = clientPoint(e);
    if (!cp) return;
    const touching = e.pointerType === "touch" || !!e.touches;
    if (touchBlocked || (touching && (e.isPrimary === false || e.touches?.length > 1 || (drag && cp.id !== drag.id)))) {
      e.preventDefault();
      blockTouch();
      return;
    }
    /* 矢を選んでいるときのタップは置き直し。選んでいないときは、枠が埋まっていれば受け付けず状態行で知らせる */
    if (ui.selArrow < 0) {
      const st = activeStatus(s);
      const blocked =
        activeEditEnd(s) >= 0
          ? activeEditArr(s).length >= st.plan.per
            ? "直す矢を選んでください"
            : ""
          : st.allDone
            ? "全エンドを記録済みです"
            : st.full
              ? "エンドを確定してください"
              : "";
      if (blocked) {
        e.preventDefault();
        activeNotice(blocked);
        return;
      }
    }
    e.preventDefault();
    resetDrag();
    if (touching) watchTouch();
    if (e.pointerId != null && svg.setPointerCapture) {
      try {
        svg.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    const p = clientToSvg(cp.x, cp.y);
    drag = {
      p,
      raw: { x: cp.x, y: cp.y },
      start: { x: cp.x, y: cp.y },
      out: false,
      moved: 0,
      fine: false,
      shown: false,
      id: cp.id,
      showTm: setTimeout(showLens, LENS_SHOW_MS),
      tm: setTimeout(() => {
        if (drag && drag.moved < FINE_MAX_MOVE_PX) {
          showLens();
          drag.fine = true;
          lens.classList.add("fine");
          lensTag.classList.add("fine");
          /* 精密モードに入ったことを触覚（ネイティブ版・対応端末）と枠の太さで知らせる */
          nativePulse("medium");
          scheduleCursor(drag.p);
        }
      }, FINE_MS),
    };
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
    drag.moved = Math.max(drag.moved, Math.hypot(cp.x - drag.start.x, cp.y - drag.start.y));
    drag.out = outsideTarget(cp);
    if (!drag.shown && drag.moved >= LENS_SHOW_MOVE_PX) showLens();
    if (drag.shown) scheduleCursor(drag.p);
  }
  function up(e) {
    const cp = clientPoint(e);
    if (!drag || !cp || cp.id !== drag.id) return;
    e.preventDefault();
    clearTimeout(drag.tm);
    clearTimeout(drag.showTm);
    /* 指を的の外へ出して離したら記録しない */
    if (drag.out || outsideTarget(cp)) {
      resetDrag();
      return;
    }
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
    const arrowR = activeArrowR(s);
    const hit = hitFromGlobal(p.x, p.y, s.faceD, s.faceType, arrowR);
    /* 保存する丸め後の座標で採点する（表示される矢円の位置と点数を一致させる） */
    /* -0 は保存（JSON）で 0 になるので、ここで 0 に揃える */
    const rec = { x: +hit.x.toFixed(2) || 0, y: +hit.y.toFixed(2) || 0 };
    Object.assign(rec, scoreAt(rec.x, rec.y, s.faceD, s.faceType, arrowR), { src: "pos" });
    if (hit.spot != null) rec.spot = hit.spot;
    const arr = activeEditArr(s);
    const target = ui.selArrow >= 0 ? arr[ui.selArrow] : null;
    nativePulse(isLineCutting(rec.x, rec.y, s.faceD, s.faceType, arrowR) ? "success" : "light");
    if (target) {
      /* 置き直し: 位置と点数だけ入れ替える（矢番号・理由はそのまま）。選択は保ち、続けて 1mm 動かせる。
         位置から採点し直すので、手で直した点数は外す。位置のなかった矢はここで位置のある矢になる */
      Object.assign(target, { x: rec.x, y: rec.y, s: rec.s, X: rec.X, src: "pos" });
      if (clearManualScore(target)) ui.recMsg = "手修正を外して採点しました";
      if (rec.spot != null) target.spot = rec.spot;
      else delete target.spot;
      scheduleSave("arrow-move");
      refreshActive();
      announceArrow(ui.selArrow + 1, target);
      return;
    }
    arr.push(rec);
    if (arr === s.cur) ui.freshArrow = arr.length - 1;
    scheduleSave("arrow-add");
    refreshActive();
    announceArrow(arr.length, rec);
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
    /* 次のステージは新しい記録なので、矢の実寸で判定する */
    arrowR: +sessionArrowR(null, db.setups.find((x) => x.id === s.setupId)).toFixed(4),
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
    inputMode: sessionInputMode(s),
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
      wakeLock.release();
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
  wakeLock.release();
  if (isEdit) {
    const i = db.sessions.findIndex((x) => x.id === s.id);
    if (i >= 0) db.sessions[i] = s;
    else db.sessions.push(s);
  } else {
    db.sessions.push(s);
  }
  nativePulse("success");
  save();
  /* ゲーミフィケーション: セッション終了の表出点（gamification-final-design.md §5）。
     ストリーク・目標は導出値なので保存前後の2回 computeStreak を呼ぶだけで済む。
     編集モード（isEdit）は対象外——過去記録の書き換えでストリークや実績を騒がせない */
  /* 「今日の結果」統合パネル（todays-result-integration-design.md §2・§9）:
     gamification.enabled の値に一切依存せず常に計算する。編集モード（isEdit）は対象外
     （過去記録の書き換えで「今日の結果」を騒がせない。既存 .summaryGamification と同じ扱い）。
     母集団は履歴詳細シート（T6）と同じ「当日以前」フィルタで揃える（strict-review minor②）:
     fDate バックデート記録時に未来のセッションが「前回」「自己ベスト」や growthBefore の
     基準日へ混入するのを防ぎ、後日同じセッションを履歴から開いたときの再構成と一致させる */
  let todaysResult = null;
  let growthBefore = null;
  if (!isEdit) {
    const trSessions = db.sessions.filter((x) => x && x.date && x.date <= s.date);
    /* 同じ同期計算内の再参照だけを共有する。session/metricsはここでは変更せず、
       既存のDB_REV署名cacheは初回に必ず通す。後のsave/summaryへ持ち越さない。 */
    const resultMetrics = new WeakMap();
    const metricsForResult = (session) => {
      if (!resultMetrics.has(session)) resultMetrics.set(session, sessionMetrics(session));
      return resultMetrics.get(session);
    };
    todaysResult = computeTodaysResult(trSessions, s.id, metricsForResult, {
      formAnalyses: db.formAnalyses,
    });
    if (todaysResult.available) growthBefore = trGrowthBeforeFor(s, trSessions, metricsForResult);
  }
  const g = db.settings.gamification;
  if (g && g.enabled && !isEdit) {
    const streakBefore = computeStreak(
      db.sessions.filter((x) => x.id !== s.id),
      g.practiceDays,
      today(),
    );
    const streakAfter = computeStreak(db.sessions, g.practiceDays, today());
    const nowIso = new Date().toISOString();
    const newBadges = checkBadges(
      db.sessions,
      (db.gamification.badges || []).map((b) => b.id),
      s,
      {
        streak: streakAfter,
        nowIso,
      },
    );
    if (newBadges.length) {
      db.gamification.badges.push(...newBadges);
      save({ reason: "gamification-badges" });
    }
    openSummary(s, !isEdit, { streakBefore, streakAfter, newBadges }, todaysResult, growthBefore);
  } else {
    openSummary(s, !isEdit, null, todaysResult, growthBefore);
  }
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
/* ---------- 「今日の結果」統合パネル ---------- */
/* todays-result-integration-design.md §3.4 の「途切れました」検出に使う before/after パターン。
   今回のセッションを除いた直前の練習日を基準にした computeGrowthStreaks を計算する。
   finishSession・履歴詳細シート（60-history-sight-view.js）の両方とも「当日以前」に絞った
   同一定義の母集団を渡す（strict-review minor②: 経路間の非対称を禁止。バックデート記録でも
   before/after が同じ as-of 母集団で比較され、偽の「途切れました」が出ない） */
function trGrowthBeforeFor(sess, allSessions, metricsFn) {
  const priorSessions = (allSessions || []).filter((x) => x && x.id !== sess.id);
  const priorLastDate = priorSessions.length
    ? priorSessions
        .map((x) => x.date)
        .filter(Boolean)
        .sort()
        .slice(-1)[0]
    : null;
  if (!priorLastDate) return null;
  return computeGrowthStreaks(priorSessions, priorLastDate, metricsFn);
}

/* 1行の骨格: 事実（.fact）→ 対象と条件（.basis）。励まし・評価語・感嘆符は書かない（ui-redesign-plan.md 5章） */
function todaysResultRowHtml(kind, factHtml, basisText) {
  return `<div class="todaysResultRow" data-testid="todays-result-${kind}">
    <p class="fact">${factHtml}</p>
    ${basisText ? `<p class="basis">${basisText}</p>` : ""}
  </div>`;
}
/* 差の表記: +5.7 / −5.7 / ±0 */
function signedText(v, dec) {
  const r = +(+v).toFixed(dec || 0);
  if (r === 0) return "±0";
  return (r > 0 ? "+" : "−") + Math.abs(r).toFixed(dec || 0);
}
/* 文中の日付。記録と同じ年なら月日だけ */
function refDateText(iso, sess) {
  const a = dateParts(iso),
    b = dateParts(sess && sess.date);
  return a && b && a.y === b.y ? fmtMD(iso) : fmtD(iso);
}
function sessionConditionText(sess) {
  return `${sess.dist}m・${faceLabel(sess)}・${((sess && sess.ends) || []).flat().length}射`;
}
/* 同じ条件（距離・的・射数）の過去の平均との差。3回未満・途中終了は、比べていないことと理由を書く */
function todaysResultComparisonRowHtml(cmp, sess, word) {
  if (!cmp) return "";
  if (cmp.available)
    return todaysResultRowHtml(
      "comparison",
      `同じ条件の過去${cmp.sampleCount}回の平均 ${cmp.mean.toFixed(1)} 点との差は <b>${signedText(cmp.diff, 1)} 点</b>です。`,
      `対象: ${fmtDateRange(cmp.firstDate, cmp.lastDate)}、${esc(sessionConditionText(sess))}。過去の回ごとの標準偏差は ${cmp.sd.toFixed(1)} 点で、${word}の差は${cmp.withinSd ? "その範囲内" : "それより大きい値"}です。`,
    );
  if (cmp.reason === "partial")
    return todaysResultRowHtml(
      "comparison",
      `${cmp.todayArrows}射で終了した記録です。射数が違うため、過去の ${cmp.quota}射の合計とは比べていません。`,
      "",
    );
  if (cmp.reason === "insufficient-history")
    return todaysResultRowHtml(
      "comparison",
      cmp.sampleCount
        ? `同じ条件の過去の記録が${cmp.sampleCount}回のため、平均との比較は表示していません。`
        : `同じ条件の過去の記録がないため、平均との比較は表示していません。`,
      `条件: ${esc(sessionConditionText(sess))}。${cmp.minSessions}回以上あるときに、平均と回ごとの標準偏差を表示します。`,
    );
  return "";
}
/* 前回（同じ条件の直近1回）との差 */
function todaysResultWeeklyRowHtml(wd, sess, word) {
  return todaysResultRowHtml(
    "weekly",
    `同じ条件の前回（${refDateText(wd.compareDate, sess)}）は ${Math.round(wd.compareValue)} 点で、${word}との差は <b>${signedText(wd.deltaPoints, 0)} 点</b>です。`,
    "",
  );
}
/* グループ RMS と、同じ距離・的の直近の平均 */
function todaysResultStabilityRowHtml(st, word) {
  const n = Math.min(5, st.sampleCount);
  return todaysResultRowHtml(
    "stability",
    `${word}のグループ RMS は ${st.latestValue.toFixed(1)}cm です。同じ距離・的の直近${n}回の平均は ${st.baselineValue.toFixed(1)}cm で、差は ${signedText(st.latestValue - st.baselineValue, 1)}cm です。`,
    "位置のある矢だけで計算しています。値が小さいほど矢が集まっています。",
  );
}
/* これまでの最高との関係。同じ射数の記録があればその合計、無ければ1射平均の最も高い回を今回の射数に換算する */
function todaysResultPersonalBestRowHtml(pb, sess, word) {
  const bestDate = refDateText(pb.bestDate, sess);
  const best = `${pb.bestTotal} 点、${bestDate}`;
  if (pb.method === "avg-projected") {
    const rel =
      pb.remaining < 0
        ? `${word}はそれより ${Math.abs(Math.round(pb.remaining))} 点高い値です`
        : pb.remaining === 0
          ? `${word}と同じです`
          : `${word}との差は −${Math.round(pb.remaining)} 点です`;
    return todaysResultRowHtml(
      "personal-best",
      `この距離・的で1射平均が最も高い回（${bestDate}）を ${pb.todayArrows}射に換算すると ${pb.bestTotal} 点で、${rel}。`,
      `同じ射数の記録がないため、1射平均からの換算値（推定）で比べています。実際の合計の最高ではありません。`,
    );
  }
  const fact =
    pb.remaining < 0
      ? `この距離・的・射数で<b>最高です</b>（これまで ${best}）。`
      : pb.remaining === 0
        ? `この距離・的・射数のこれまでの最高（${best}）と同じです。`
        : `この距離・的・射数の最高は ${best} で、${word}との差は −${Math.round(pb.remaining)} 点です。`;
  return todaysResultRowHtml(
    "personal-best",
    fact,
    `対象: ${esc(sessionConditionText(sess))}の、この日までの記録。`,
  );
}
/* computeTodaysResult() と computeConditionComparison() の結果を、事実と根拠の行にする。
   opts.comparison: 同じ条件の平均との比較 / opts.dayLabel: 「今日」（結果の画面）か「この日」（ノートの詳細）。
   伸びの継続日数（growthStreaks）は表示しない: しきい値が暫定で、根拠を1行で示せないため（v5 段 5） */
function todaysResultHtml(result, sess, opts) {
  opts = opts || {};
  if (!result || !result.available) return "";
  const retro = !!opts.dayLabel && opts.dayLabel !== "今日";
  const word = retro ? "この回" : "今回";
  const cmp = opts.comparison || null;
  const rows = [];
  if (result.weeklyDiff && result.weeklyDiff.available)
    rows.push(todaysResultWeeklyRowHtml(result.weeklyDiff, sess, word));
  if (result.personalBestDistance && result.personalBestDistance.available)
    rows.push(todaysResultPersonalBestRowHtml(result.personalBestDistance, sess, word));
  if (result.stabilityTrend && result.stabilityTrend.available)
    rows.push(todaysResultStabilityRowHtml(result.stabilityTrend, word));
  else if (result.stabilityTrend && result.stabilityTrend.reason === "insufficient-arrows")
    rows.push(
      todaysResultRowHtml(
        "stability-pending",
        `位置のある矢が${result.stabilityTrend.coordinateCount}射のため、グループ RMS は比べていません。`,
        "3射以上の位置があるときに計算します。",
      ),
    );
  if (!rows.length && (!cmp || (cmp.reason === "insufficient-history" && !cmp.sampleCount))) {
    /* 比べる過去の記録が1つも無い: 最初の記録か、この条件で最初の記録か */
    const condFirst = `この条件（${esc(sessionConditionText(sess))}）では最初の記録です。`;
    const msg = result.firstEver
      ? retro
        ? "最初の記録です。この日より前の記録はありません。"
        : "最初の記録です。比べる過去の記録はありません。"
      : retro
        ? condFirst
        : `${condFirst}同じ条件の記録が3回以上になると、平均との比較を表示します。`;
    return `<div class="summaryTodaysResult todaysResultEmpty" data-testid="todays-result-empty"><p class="fact">${msg}</p></div>`;
  }
  return `<div class="summaryTodaysResult" data-testid="todays-result">${todaysResultComparisonRowHtml(cmp, sess, word)}${rows.join("")}</div>`;
}

/* 練習の目標と連続記録（設定で入にしたときだけ）。結果の画面には事実を1〜2行だけ出す */
function summaryGamificationHtml(gam) {
  const streakBefore = gam.streakBefore,
    streakAfter = gam.streakAfter,
    newBadges = gam.newBadges || [];
  let streakPart;
  if (streakAfter.configured) {
    /* 前回練習日より後に消費されたフリーズだけを今回分として表示する */
    const freezeUsed = streakAfter.freezeUsedDates.filter(
      (d) => streakBefore.lastPracticeDate && d > streakBefore.lastPracticeDate,
    );
    streakPart = `<p class="fact">連続記録は <b data-testid="summary-streak-num">${streakAfter.current}</b> 日です（この記録の前は ${streakBefore.current} 日）。${freezeUsed.length ? `フリーズを${freezeUsed.length}個使いました。` : ""}</p>`;
  } else {
    streakPart = `<p class="fact">練習曜日が未設定のため、連続記録は数えていません。</p>
      <button type="button" class="btn sm sec" id="sumStreakSetup" data-testid="summary-streak-setup">練習曜日を設定</button>`;
  }
  let badgesPart = "";
  if (newBadges.length) {
    const names = newBadges.map((nb) => {
      const def = BADGE_DEFS.find((b) => b.id === nb.id);
      return def ? `「${esc(def.name)}」（${esc(def.reason)}）` : "";
    });
    badgesPart = `<p class="basis" data-testid="summary-badges">この記録で条件を満たしたバッジ: ${names.filter(Boolean).join("、")}</p>`;
  }
  return `<div class="summaryGamification" data-testid="summary-gamification">${streakPart}${badgesPart}</div>`;
}
/* 着弾の数値（グループ RMS と着弾中心のずれ）。位置のある矢の統計が無ければ空 */
function resultImpactFigsHtml(st) {
  if (!st) return "";
  const ci = st.rrCi ? `95%区間 ${st.rrCi.lo.toFixed(1)}〜${st.rrCi.hi.toFixed(1)}` : `${st.n}射`;
  return `<div class="figs two resultImpactFigs" data-testid="result-impact-figs">
    <div class="fig"><div class="l">グループRMS（全射）</div><div class="n">${st.rr.toFixed(1)}<small>cm</small></div><div class="d">${ci}</div></div>
    <div class="fig"><div class="l">着弾中心のずれ</div><div class="n offs">${cmOffsetText(st.mx, "x")}<br>${cmOffsetText(st.my, "y")}</div></div>
  </div>`;
}
/* ---------- 今日の結果（全画面。docs/design/v5/design.md 4.4・試作 #result） ----------
   記録を終了した直後に出す。合計 → 前後半・数える点 → 同じ条件との比較（根拠つき）→ スコア表 →
   着弾 → サイト調整の目安と根拠（既存の内容。作り直しは段 8）→ メモ → 分析で見る / 保存して閉じる */
function openSummary(sess, isNew, gam, todaysResult, growthBefore) {
  void growthBefore; /* 伸びの継続日数は表示しない（todaysResultHtml の説明を参照） */
  const setup = db.setups.find((x) => x.id === sess.setupId);
  const m = sessionMetrics(sess);
  const all = m.all,
    total = m.total,
    st = m.st;
  const adv = adviceFor(sess, setup);
  const posCount = all.filter(arrowHasPos).length;
  const comparison =
    isNew && todaysResult
      ? computeConditionComparison(
          db.sessions.filter((x) => x && x.date && x.date <= sess.date),
          sess.id,
          scorecardPlan(sess).quota,
        )
      : null;
  const title = isNew && sess.date === today() ? "今日の結果" : "記録の結果";
  const ovl = document.createElement("div");
  ovl.className = "ovl resultOvl";
  ovl.innerHTML = `<div class="sheet resultScreen" data-testid="result-screen">
    <header class="subHead">
      <div class="viewDate" data-testid="result-condition">${fmtMDW(sess.date)}・${esc(sess.dist)}m・${esc(faceLabel(sess))}${setup ? "・" + esc(setup.name) : ""}</div>
      <h3>${title}</h3>
    </header>
    <section class="vsec resultTotalSec" data-testid="result-total">
      <div class="vsecH"><h2>合計</h2><span class="aside">${all.length}射・1射平均 ${(total / all.length).toFixed(2)}</span></div>
      <div class="bigRow">${sessionBigTotalHtml(sess, "resultTotal")}</div>
      ${sessionFigsHtml(sess, "ends")}
    </section>
    ${summaryStorageNoticeHtml()}
    ${isNew && todaysResult ? todaysResultHtml(todaysResult, sess, { comparison }) : ""}
    ${isNew && gam ? summaryGamificationHtml(gam) : ""}
    ${roundGroupSummaryHtml(sess)}
    <section class="vsec"><div class="vsecH"><h2>スコア表</h2><span class="aside">高い点から表示</span></div></section>
    <div class="bleed">${scorecardHtml(sess, { final: true })}</div>
    ${all.some(arrowIsManual) ? `<p class="basis">* は手で直した点数です（位置からの採点とは違う点を選んだ矢）。</p>` : ""}
    <section class="vsec"><div class="vsecH"><h2>着弾</h2><span class="aside">${posCount ? `${posCount}射の位置` : "位置の記録なし"}</span></div></section>
    <div id="sumPlot" class="recordSummaryPlot${posCount ? " bleed" : ""}"></div>
    ${resultImpactFigsHtml(st)}
    <details class="adv summaryDetails">
      <summary>サイト調整の目安と詳しい根拠</summary>
      ${summaryDecisionHtml(adv, sess)}
      ${groupSummaryHtml(st)}
      ${summarySightDialHtml(sess, adv)}
      ${st ? nextActionHtml(sess, adv, setup) : ""}
      ${st ? confidenceNoteHtml("calc") : `<div class="kv"><span>グルーピング</span><span>着弾データなし</span></div>`}
      ${st ? trustHtml(sess, setup, st) : ""}
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
    <section class="vsec">
      <div class="vsecH"><h2><label for="sumNote">${title === "今日の結果" ? "今日のメモ" : "この記録のメモ"}</label></h2><span class="aside">ノートに残ります</span></div>
      <textarea class="noteBox" id="sumNote" data-testid="result-note" placeholder="感覚、気づいたこと、次に確かめること">${esc(sess.note || "")}</textarea>
    </section>
    <div class="btnrow"><button class="btn sec" id="sumCard">スコア表を画像で保存</button></div>
    <div class="actbar two">
      <button type="button" class="btn sec" id="sumAnalysis" data-testid="result-analysis">分析で見る</button>
      <button type="button" class="btn pri" id="sumClose">保存して閉じる</button>
    </div>
  </div>`;
  openModal(ovl, { escapeTarget: "#sumClose", swipe: false });
  const backupSettings = ovl.querySelector("#sumBackupSettings");
  if (backupSettings) backupSettings.onclick = () => {
    openSettings();
    $("#dExp").scrollIntoView({ block: "center" });
  };
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
  /* メモはこの記録の note に書く（記録の条件・記録中のメニューと同じ項目）。入力のたびに保存を予約する */
  const note = ovl.querySelector("#sumNote");
  const noteChanged = () => (sess.note || "") !== note.value.trim();
  note.oninput = () => {
    if (!noteChanged()) return;
    sess.note = note.value.trim();
    scheduleSave("result-note");
  };
  ovl.querySelector("#sumCard").onclick = () => exportScorecardImage(sess);
  const close = () => {
    if (noteChanged()) sess.note = note.value.trim();
    if (hasPendingSave()) save({ reason: "result-note" });
    closeModal(ovl);
  };
  ovl.querySelector("#sumClose").onclick = () => {
    close();
    render();
  };
  ovl.querySelector("#sumAnalysis").onclick = () => {
    close();
    if (view === "analysis") render();
    else showView("analysis");
  };
  const sumStreakSetup = ovl.querySelector("#sumStreakSetup");
  if (sumStreakSetup) sumStreakSetup.onclick = () => openPracticeDaysSheet();
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
  const rows = [];
  for (const session of Array.isArray(ss) ? ss : []) {
    const row = historySessionRows([session])[0];
    if (row.arrows.length) rows.push(row);
    if (rows.length === 8) break;
  }
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
function analysisSightMarks(filter) {
  const rows = (Array.isArray(db.sightMarks) ? db.sightMarks : [])
    .filter(Boolean)
    .map((mark) => ({
      mark,
      setupId: mark.setupId,
      dist: mark.dist,
      round: mark.round || "",
      date: sightDateInfo(mark).sort,
    }));
  return filterAnalysisRows(rows, { ...filter, today: today() }).map((r) => r.mark);
}
function sightHistoryCard(ss, sightMarks = db.sightMarks) {
  const markRows = (Array.isArray(sightMarks) ? sightMarks : [])
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
function sightSummaryHtml(sessionRows, filter, sightMarks = db.sightMarks) {
  const hf = filter || ui.histFilter || { setupId: "", dist: "" };
  const setupOk = (id) => !hf.setupId || (hf.setupId === "__none" ? !id : hf.setupId === id);
  const distOk = (dist) => !hf.dist || String(dist) === String(hf.dist);
  const markRows = (Array.isArray(sightMarks) ? sightMarks : [])
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
    const prior = current.latest && current.latest.row;
    const stamp = Number(row.ts),
      priorStamp = Number(prior && prior.ts);
    const datedMarks =
      prior &&
      row.source === "台帳" &&
      prior.source === "台帳" &&
      date.sort &&
      String(row.date || "").trim() === date.sort &&
      String(prior.date || "").trim() === date.sort &&
      Number.isFinite(stamp) &&
      stamp > 0 &&
      Number.isFinite(priorStamp) &&
      priorStamp > 0;
    if (
      !current.latest ||
      date.sort > current.latest.date.sort ||
      (date.sort === current.latest.date.sort &&
        row.source === "台帳" &&
        (!datedMarks || stamp >= priorStamp))
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
  if (!analysisHasGroupingEvidence(st)) return null;
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
/* 対象の記録に、位置のある矢が3本以上ある回がないとき（点数だけの記録を選んだとき）に出す。
   位置のある矢だけで記録してきた従来のデータでは出ない */
function impactNoDataHtml(sessionRows) {
  const list = (sessionRows || []).filter((r) => r && r.s);
  let arrows = 0,
    positioned = 0;
  list.forEach((r) => {
    const m = sessionMetrics(r.s);
    arrows += m.all.length;
    positioned += m.pts.length;
  });
  if (!list.length || positioned >= arrows) return "";
  return `<div class="card noImpactCard" data-testid="analysis-no-impact"><h2>矢の集まり具合 <span class="mini">対象${list.length}回</span></h2>
    <div class="noImpact"><b>着弾データなし</b><span>対象の${list.length}回・${arrows}射のうち、位置のある矢は${positioned}射です。集まり具合（グルーピング）は、位置のある矢が3本以上ある回から計算します。得点の集計は点数だけの記録も含みます。</span></div></div>`;
}
function groupingSummaryHtml(sessionRows) {
  const rows = (sessionRows || []).map(groupingSessionRow).filter(Boolean);
  if (!rows.length) return impactNoDataHtml(sessionRows);
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
