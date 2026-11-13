"use strict";
/* Archery Note: history and sight-adjustment views */

/* 練習曜日のクイック設定シート。record タブの feature hint（practiceDays）と
   結果の画面の「練習曜日を設定」から呼ばれる（ノートの上部にあったリングと設定の入口は v5 段 6 で廃止）。月水金土をプリセレクトするが、あくまで
   タップで開いた時だけの提案であり自動ポップアップはしない（既定曜日の押し付け禁止）。
   スキップも設定も同じ重みのボタンとして扱う */
function openPracticeDaysSheet() {
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];
  const sel = new Set([1, 3, 5, 6]);
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  ovl.innerHTML = `<div class="sheet">
    <h3>${icon("fire")} 練習曜日を設定</h3>
    <p class="note">練習する曜日を選ぶと、ストリーク（連続記録）が始まります。あとで設定タブでも変更できます。</p>
    <div class="gamifyDayChips" id="pdChips" data-testid="practice-days-sheet-chips">
      ${DOW.map((lb, i) => `<button type="button" class="gamifyDayChip ${sel.has(i) ? "on" : ""}" aria-pressed="${sel.has(i)}" data-d="${i}">${lb}</button>`).join("")}
    </div>
    <div class="btnrow"><button type="button" class="btn" id="pdSave">設定する</button></div>
    <button type="button" class="onboardSkip" id="pdSkip">あとで</button>
  </div>`;
  openModal(ovl, { escapeTarget: "#pdSkip" });
  ovl.querySelectorAll("#pdChips .gamifyDayChip").forEach(
    (c) =>
      (c.onclick = () => {
        const d = +c.dataset.d;
        if (sel.has(d)) sel.delete(d);
        else sel.add(d);
        const on = sel.has(d);
        c.classList.toggle("on", on);
        c.setAttribute("aria-pressed", String(on));
      }),
  );
  ovl.querySelector("#pdSave").onclick = () => {
    db.settings.gamification.practiceDays = sel.size ? [...sel].sort((a, b) => a - b) : null;
    save({ reason: "gamification-practice-days" });
    closeModal(ovl);
    toast(sel.size ? "練習曜日を設定しました" : "練習曜日を未設定に戻しました");
    render();
  };
  ovl.querySelector("#pdSkip").onclick = () => closeModal(ovl);
}

/* ============ ノート（履歴＋メモ。docs/design/v5/design.md 4.6・試作 #notes） ============
   練習1回＝1項目、メモだけの日（db.notes）も同じ並びに入る。日付の新しい順、同じ日は書いた時刻の新しい順。
   冒頭の励ましの文・数値枠・目標のリングは置かない（設定で入のときだけ、目標と連続記録を1行）。 */
const NOTE_TAGS = ["射型", "風", "サイト", "弓具"];
const NOTE_GO =
  '<svg class="go chev" viewBox="0 0 10 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 1l6 7-6 7"/></svg>';
function noteDateOk(iso) {
  return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso);
}
/* 並べ替え用の時刻。メモは ts。練習は ts を持たないので、uid()（先頭が開始時刻の36進数）の id から読む。
   読めないとき（取り込んだデータなど）は 0 で、保存の並びの新しい順になる */
function noteSortTs(x) {
  const t = Number(x && x.ts);
  if (Number.isFinite(t) && t > 0) return t;
  const id = x && typeof x.id === "string" ? x.id : "";
  if (/^[0-9a-z]{13}$/.test(id)) {
    const v = parseInt(id.slice(0, 8), 36);
    if (v > 1.4e12 && v < Date.now() + 864e5) return v;
  }
  return 0;
}
/* ノートの項目（練習とメモ）を新しい順に並べる。保存の並び・保存レコードは変えない */
function noteItems() {
  const items = [];
  (db.sessions || []).forEach((s, i) => {
    if (s && typeof s === "object") items.push({ kind: "session", s, date: String(s.date || ""), ts: noteSortTs(s), i });
  });
  (db.notes || []).forEach((n, i) => {
    if (n && typeof n === "object") items.push({ kind: "memo", n, date: String(n.date || ""), ts: noteSortTs(n), i });
  });
  return items.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.ts - a.ts ||
      (a.kind === b.kind ? b.i - a.i : a.kind === "session" ? -1 : 1),
  );
}
function noteItemHasMemo(it) {
  return it.kind === "memo" ? true : !!(it.s.note && String(it.s.note).trim());
}
/* その日の弓具の変更（セッティングの変更履歴）とサイトの記録（サイト台帳）。日付 → 文の配列 */
function noteDayChanges() {
  const by = new Map();
  const add = (date, text) => {
    if (!noteDateOk(date)) return;
    if (!by.has(date)) by.set(date, []);
    by.get(date).push(text);
  };
  (db.setups || []).forEach((setup) => {
    (Array.isArray(setup.history) ? setup.history : []).forEach((h) => {
      const changes = h && Array.isArray(h.changes) ? h.changes : [];
      if (!changes.length) return;
      add(
        h.date,
        `弓具の変更: ${setup.name}（${changes.map((c) => `${c.label} ${c.from || "未設定"} → ${c.to || "削除"}`).join("、")}）`,
      );
    });
  });
  (db.sightMarks || []).forEach((mk) => {
    if (!mk || typeof mk !== "object") return;
    const has = (v) => v != null && v !== "";
    if (!has(mk.v) && !has(mk.h)) return;
    add(
      mk.date,
      `サイトの記録: ${historyDistanceLabel(mk.dist)} 上下 ${has(mk.v) ? mk.v : "—"}・左右 ${has(mk.h) ? mk.h : "—"}`,
    );
  });
  return by;
}
function noteDayCellHtml(iso) {
  const p = dateParts(iso);
  return p
    ? `<span class="day"><span class="srOnly">${fmtD(iso)} </span>${p.d}<small>${p.w}曜</small></span>`
    : `<span class="day nodate">—<small>日付なし</small></span>`;
}
function noteChangesHtml(changes) {
  return (changes || []).map((c) => `<span class="chg">${esc(c)}</span>`).join("");
}
/* 練習の項目。日・曜日 / 距離・射数と合計 / 的・弓具・天気・「点数だけ」 / メモ2行 / その日の弓具変更 */
function historyRowHtml(s, changes) {
  const all = sessionArrows(s);
  const total = sumScores(all);
  const setup = db.setups.find((x) => x.id === s.setupId);
  /* ラウンド名は、見出し（距離・射数）と同じ内容（「70m 72射」など）なら繰り返さない */
  const roundName = s.round && s.round !== "free" ? roundLabel(s.round) : "";
  const round = s.roundGroup
    ? `${roundName} ${(Number(s.roundGroup.stage) || 0) + 1}/${s.roundGroup.stageCount}`
    : roundName.replace(/\s+/g, "") === `${historyDistanceLabel(s.dist)}${all.length}射`
      ? ""
      : roundName;
  const meta = [faceLabel(s), setup && setup.name, round, s.wx];
  if (all.length && !sessionHasPos(s)) meta.push("点数だけ");
  const note = s.note ? String(s.note).trim() : "";
  return `<button type="button" class="entry noteEntry historyRow" data-kind="session" data-id="${esc(s.id)}" data-testid="history-row">
    ${noteDayCellHtml(s.date)}
    <span class="entryBody">
      <span class="hd"><b>${historyDistanceLabel(s.dist)}・${all.length}射</b><span class="sc1">${total}<small>点</small></span></span>
      <span class="meta">${esc(meta.filter(Boolean).join("・"))}</span>
      ${note ? `<span class="txt">${esc(note)}</span>` : ""}
      ${noteChangesHtml(changes)}
    </span>
  </button>`;
}
/* メモだけの項目 */
function memoRowHtml(n, changes) {
  const tags = Array.isArray(n.tags) ? n.tags : [];
  const text = String(n.text || "").trim();
  return `<button type="button" class="entry noteEntry memoRow" data-kind="memo" data-id="${esc(n.id)}" data-testid="notes-memo-row">
    ${noteDayCellHtml(n.date)}
    <span class="entryBody">
      <span class="hd"><b>メモ</b></span>
      ${tags.length ? `<span class="meta">${esc(tags.join("・"))}</span>` : ""}
      <span class="txt${text ? "" : " none"}">${text ? esc(text) : "本文はありません"}</span>
      ${noteChangesHtml(changes)}
    </span>
  </button>`;
}
/* ページ分割前に同 gid の記録（多距離ラウンドのステージ）をまとめる。元配列・保存レコードは変更しない。 */
function historyListEntries(items) {
  const groups = new Map();
  const entries = [];
  items.forEach((it) => {
    const s = it.kind === "session" ? it.s : null;
    const gid = s && s.roundGroup && s.roundGroup.gid;
    if (typeof gid !== "string" || !gid) {
      entries.push({ items: [it], gid: "", date: it.date });
      return;
    }
    let entry = groups.get(gid);
    if (!entry) {
      entry = { items: [], gid, date: it.date };
      groups.set(gid, entry);
      entries.push(entry);
    }
    entry.items.push(it);
  });
  return entries;
}
function historyRoundHtml(entry, filtered, changesFor) {
  const stages = entry.items
    .map((it) => it.s)
    .sort((a, b) => (Number(a.roundGroup.stage) || 0) - (Number(b.roundGroup.stage) || 0));
  let total = 0, arrows = 0;
  stages.forEach((s) => { const all = sessionArrows(s); total += sumScores(all); arrows += all.length; });
  const rg = stages[0].roundGroup;
  const count = Number(rg.stageCount);
  const stageLabel = Number.isInteger(count) && count > 0 ? `${stages.length}/${count}ステージ` : `${stages.length}ステージ`;
  const distances = stages.map((s) => historyDistanceLabel(s.dist)).join("・");
  return `<details class="historyRound" data-testid="history-round" data-gid="${esc(entry.gid)}" ${ui.histRoundOpen && ui.histRoundOpen.has(entry.gid) ? "open" : ""}>
    <summary class="historyRoundSummary">
      <span class="historyRoundMain"><span class="historyRoundTitle">${esc(roundLabel(rg.roundId))}</span>
      <span class="historyRoundMeta">${stageLabel}・${arrows}射</span><span class="historyRoundMeta">${distances}</span></span>
      <span class="historyRoundTotal">${total}<small>${filtered ? "表示分の合計" : "合計"}</small></span>
    </summary>
    <div class="historyRoundStages">${stages.map((s) => historyRowHtml(s, changesFor(s.date))).join("")}</div>
  </details>`;
}
/* 月の見出し（その月の練習回数つき）→ 項目。monthCounts は絞り込み後の全項目から数える（ページ分割に左右されない） */
function noteListHtml(entries, monthCounts, filtered) {
  const dayChanges = noteDayChanges();
  const used = new Set();
  /* その日の変更は、その日の最初の項目にだけ付ける */
  const changesFor = (date) => {
    if (!dayChanges.has(date) || used.has(date)) return null;
    used.add(date);
    return dayChanges.get(date);
  };
  let prevMonth = null;
  const parts = [];
  entries.forEach((entry) => {
    const month = noteDateOk(entry.date) ? entry.date.slice(0, 7) : "";
    if (month !== prevMonth) {
      prevMonth = month;
      const label = month ? `${+month.slice(0, 4)}年${+month.slice(5, 7)}月` : "日付なし";
      parts.push(
        `<h2 class="noteMonth" data-testid="notes-month" data-month="${month}"><span>${label}</span><span class="cnt">練習 ${monthCounts.get(month) || 0}回</span></h2>`,
      );
    }
    if (entry.gid && entry.items.length > 1) parts.push(historyRoundHtml(entry, filtered, changesFor));
    else {
      const it = entry.items[0];
      parts.push(
        it.kind === "session" ? historyRowHtml(it.s, changesFor(it.date)) : memoRowHtml(it.n, changesFor(it.date)),
      );
    }
  });
  return parts.join("");
}
/* 練習の目標と連続記録（設定で入のときだけ）。ノートには事実を1行だけ。バッジは設定・分析の側 */
function notesGoalLineHtml() {
  const g = db.settings.gamification;
  if (!g || !g.enabled) return "";
  const goals = calcGoalProgress(db.sessions, g.goals, today());
  const streak = computeStreak(db.sessions, g.practiceDays, today());
  const parts = [
    `今週 ${goals.weekly.current}回 / 目標 ${goals.weekly.target}回`,
    `今月 ${goals.monthly.current}射 / 目標 ${goals.monthly.target}射`,
  ];
  if (streak.configured) parts.push(`連続 <b data-testid="streak-current">${streak.current}</b>日`);
  return `<p class="basis homeGoalLine notesGoalLine" data-testid="notes-goal-line">${parts.map((t) => `<span>${t}</span>`).join("・")}</p>`;
}
function renderHistory(m) {
  const all = noteItems();
  if (!ui.histFilter) ui.histFilter = { setupId: "", dist: "", round: "", kind: "all" };
  const hf = ui.histFilter;
  if (hf.kind !== "rec" && hf.kind !== "memo") hf.kind = "all";
  const sessions = all.filter((it) => it.kind === "session").map((it) => it.s);
  const dists = [...new Set(sessions.map((s) => s.dist).filter(Boolean))].sort((a, b) => b - a);
  const rounds = [...new Set(sessions.map((s) => s.round || "free"))];
  /* 距離・弓具・ラウンドは練習だけが持つ条件。どれかを選ぶと、メモだけの項目は外れる */
  const sessionOnly = !!(hf.setupId || hf.dist || hf.round);
  const sessionOk = (s) =>
    (!hf.setupId || (hf.setupId === "__none" ? !s.setupId : s.setupId === hf.setupId)) &&
    (!hf.dist || String(s.dist) === String(hf.dist)) &&
    (!hf.round || (s.round || "free") === hf.round);
  const items = all.filter((it) => {
    if (it.kind === "memo") return !sessionOnly && hf.kind !== "rec";
    if (hf.kind === "memo" && !noteItemHasMemo(it)) return false;
    return sessionOk(it.s);
  });
  const detailCount = [hf.setupId, hf.round].filter(Boolean).length;
  const filtered = sessionOnly || hf.kind !== "all";
  const monthCounts = new Map();
  items.forEach((it) => {
    if (it.kind !== "session") return;
    const month = noteDateOk(it.date) ? it.date.slice(0, 7) : "";
    monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
  });
  const entries = historyListEntries(items);
  const limit = ui._histLimit || 50;
  const seg = (kind, label) =>
    `<button type="button" data-kind="${kind}" aria-pressed="${!hf.dist && hf.kind === kind}">${label}</button>`;
  const trashCount = (db.trash || []).length;
  m.innerHTML = `${notesGoalLineHtml()}
  <div class="historyRecords" data-testid="notes-list">
    <div class="seg noteSeg" id="noteSeg" role="group" aria-label="表示する項目" data-testid="notes-filter">
      ${seg("all", "すべて")}${seg("rec", "練習")}${seg("memo", "メモあり")}
      <span class="segPick${hf.dist ? " on" : ""}"><select id="histDist" aria-label="距離" data-testid="notes-filter-dist"${dists.length ? "" : " disabled"}><option value="">距離</option>${dists.map((d) => `<option value="${esc(d)}" ${String(hf.dist) === String(d) ? "selected" : ""}>${historyDistanceLabel(d)}</option>`).join("")}</select></span>
    </div>
    <details class="historyFilters" data-testid="history-filters" ${detailCount ? "open" : ""}>
    <summary data-testid="history-filter-toggle">弓具・ラウンドで絞り込む <span>${detailCount ? `${detailCount}条件` : "すべて"}</span></summary>
    <div class="row">
      <div><label class="f" for="histSetup">弓具</label><select class="inp" id="histSetup"><option value="">すべて</option><option value="__none" ${hf.setupId === "__none" ? "selected" : ""}>未指定</option>${db.setups.map((s) => `<option value="${esc(s.id)}" ${hf.setupId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
      <div><label class="f" for="histRound">ラウンド</label><select class="inp" id="histRound"><option value="">すべて</option>${rounds.map((r) => `<option value="${esc(r)}" ${hf.round === r ? "selected" : ""}>${esc(roundLabel(r))}</option>`).join("")}</select></div>
    </div>
    <div class="btnrow"><button type="button" class="btn ghost" id="histClear">絞り込みを解除</button></div>
    </details>
    <div id="histList">
    ${
      items.length
        ? noteListHtml(entries.slice(0, limit), monthCounts, filtered) +
          (entries.length > limit ? `<div class="btnrow"><button type="button" class="btn ghost" id="histMore">さらに表示（残り${entries.length - limit}件）</button></div>` : "")
        : all.length
          ? `<div class="empty" data-testid="notes-no-match"><b>該当する記録はありません</b>絞り込みの条件を変えると表示されます。</div>`
          : `<div class="empty historyEmpty" data-testid="history-empty">
        <b>ノートはまだ空です</b>
        <p>練習を記録して終了すると、日付の順にここへ並びます。練習のない日は「メモを書く」で書き残せます。</p>
        <button type="button" class="btn" id="histEmptyCta">記録タブへ</button>
      </div>`
    }
    </div>
    <button type="button" class="lrow link noteTrashLink" id="notesTrash" data-testid="notes-trash"><span class="lmain"><b>ゴミ箱（${trashCount}件）</b><span>${trashCount ? "ここから元に戻せます" : "ゴミ箱へ移した記録とメモが、ここに入ります"}</span></span>${NOTE_GO}</button>
  </div>`;
  const rerender = (focusSel) => {
    ui._histLimit = 0;
    render();
    const el = focusSel && $(focusSel);
    if (el) el.focus({ preventScroll: true });
  };
  m.querySelectorAll("#noteSeg button").forEach(
    (b) =>
      (b.onclick = () => {
        hf.kind = b.dataset.kind;
        hf.dist = "";
        rerender(`#noteSeg button[data-kind="${b.dataset.kind}"]`);
      }),
  );
  $("#histDist").onchange = (e) => {
    hf.dist = e.target.value;
    hf.kind = "all";
    rerender("#histDist");
  };
  $("#histSetup").onchange = (e) => {
    hf.setupId = e.target.value;
    rerender(e.target.value ? "#histSetup" : ".historyFilters summary");
  };
  $("#histRound").onchange = (e) => {
    hf.round = e.target.value;
    rerender(e.target.value ? "#histRound" : ".historyFilters summary");
  };
  $("#histClear").onclick = () => {
    ui.histFilter = { setupId: "", dist: "", round: "", kind: "all" };
    rerender(".historyFilters summary");
  };
  const more = $("#histMore");
  if (more) more.onclick = () => { ui._histLimit = (ui._histLimit || 50) + 50; render(); };
  if (!ui.histRoundOpen) ui.histRoundOpen = new Set();
  m.querySelectorAll("#histList .historyRound").forEach((group) => {
    group.ontoggle = () => {
      if (!group.isConnected) return;
      if (group.open) ui.histRoundOpen.add(group.dataset.gid);
      else ui.histRoundOpen.delete(group.dataset.gid);
    };
  });
  m.querySelectorAll("#histList .noteEntry").forEach(
    (li) =>
      (li.onclick = () =>
        li.dataset.kind === "memo" ? openMemoDetail(li.dataset.id) : openHistDetail(li.dataset.id)),
  );
  const cta = $("#histEmptyCta");
  if (cta) cta.onclick = () => showView("record");
  $("#notesTrash").onclick = () => openTrashSheet();
}
/* ゴミ箱（ノートの一番下から開く。設定 > データにも同じ中身がある）。練習・メモ・弓具・サイト値を元に戻せる */
function openTrashSheet() {
  const items = db.trash || [];
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  ovl.innerHTML = `<div class="sheet trashSheet" data-testid="trash-sheet">
    <h3>ゴミ箱（${items.length}件）</h3>
    <p class="basis">ゴミ箱へ移した順に、新しい${TRASH_LIMIT}件までを残しています。「元に戻す」で、元の場所へ戻ります。</p>
    ${
      items.length
        ? items
            .map(
              (it) => `<div class="lrow trashRow" data-testid="trash-row" data-type="${esc(it.type)}">
        <span class="lmain"><b>${esc(it.label)}</b><span>${esc(trashTypeLabel(it.type))}${fmtD(it.date) ? `・${fmtD(it.date)} にゴミ箱へ` : ""}</span></span>
        <button type="button" class="txtBtn" data-restore-trash="${esc(it.id)}" aria-label="${esc(it.label)} を元に戻す">元に戻す</button>
      </div>`,
            )
            .join("")
        : `<div class="empty"><b>ゴミ箱は空です</b>ゴミ箱へ移した記録とメモが、ここに入ります。</div>`
    }
    <div class="btnrow"><button type="button" class="btn ghost" id="trashClose">閉じる</button></div>
  </div>`;
  openModal(ovl, { escapeTarget: "#trashClose" });
  ovl.querySelector("#trashClose").onclick = () => closeModal(ovl);
  ovl.querySelectorAll("[data-restore-trash]").forEach(
    (b) =>
      (b.onclick = () => {
        /* 元に戻している間は、更新の再読み込みを待たせる（設定のゴミ箱もこの一覧を使う） */
        beginActiveWorkflow();
        try {
          if (!restoreTrash(b.dataset.restoreTrash)) return;
          closeModal(ovl);
          render();
          if ((db.trash || []).length) openTrashSheet();
          toast("元に戻しました");
        } finally {
          endActiveWorkflow();
        }
      }),
  );
}
function sessionGroupPoint(s) {
  const m = sessionMetrics(s);
  if (m.all.length < 3) return null;
  const st = m.st;
  if (!st || st.n < 3) return null;
  /* サイト中心の履歴は外れ値候補を除いた中心（B）、半径・ばらつきは全射（A） */
  const sc = sightStats(st);
  const setup = db.setups.find((x) => x.id === s.setupId);
  return {
    id: s.id,
    date: s.date || "",
    setupId: s.setupId || "none",
    setupName: setup ? setup.name : "未指定",
    dist: s.dist,
    faceD: s.faceD,
    faceType: s.faceType || "single",
    mx: sc.mx,
    my: sc.my,
    rr: st.rr,
    sx: st.sx,
    sy: st.sy,
    major: st.major,
    minor: st.minor,
    n: st.n,
    total: m.total,
    avg: m.avg,
  };
}
function historyDistanceLabel(dist) {
  const n = Number(dist);
  if (Number.isFinite(n) && n > 0) {
    const rounded = Math.round(n * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}m`;
  }
  return "距離未設定";
}
function driftText(dx, dy) {
  const parts = [];
  if (Math.abs(dx) >= 0.2)
    parts.push(dx > 0 ? `右${Math.abs(dx).toFixed(1)}cm` : `左${Math.abs(dx).toFixed(1)}cm`);
  if (Math.abs(dy) >= 0.2)
    parts.push(dy > 0 ? `上${Math.abs(dy).toFixed(1)}cm` : `下${Math.abs(dy).toFixed(1)}cm`);
  return parts.length ? parts.join(" / ") : "ほぼ変化なし";
}
function scoreDistCard(ss) {
  /* 各得点の件数と最初の的種を一度で集計。空の得点行の色探しで全矢を再走査しない。 */
  const cnt = Object.create(null), firstFace = Object.create(null);
  let count = 0, fieldOnly = true;
  (ss || db.sessions).forEach((s) => {
    const faceType = s.faceType || "single";
    s.ends.flat().forEach((a) => {
      count++;
      if (faceType !== "field") fieldOnly = false;
      const key = a.s === 0 ? "M" : a.X ? "X" : String(a.s);
      cnt[key] = (cnt[key] || 0) + 1;
      if (firstFace[key] === undefined) firstFace[key] = faceType;
    });
  });
  if (count < 12) return "";
  const keys = fieldOnly
    ? ["6", "5", "4", "3", "2", "1", "M"]
    : ["X", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "M"];
  const max = Math.max(...keys.map((k) => cnt[k] || 0)) || 1;
  return (
    `<section class="vsec" data-testid="analysis-score-dist"><div class="vsecH"><h2>得点の内訳</h2><span class="aside">全${count}射</span></div>` +
    keys
      .filter((k) => cnt[k] > 0 || (!fieldOnly && ["X", "10", "9", "8", "7"].includes(k)))
      .map((k) => {
        const sNum = k === "X" ? 10 : k === "M" ? 0 : +k;
        const z = zoneStyle(sNum, k === "X", firstFace[k]);
        const n = cnt[k] || 0;
        return `<div class="histScoreRow">
        <div class="histScoreLabel" style="background:${z.bg};color:${z.fg}">${k}</div>
        <div class="histScoreTrack"><div class="histScoreFill" style="width:${((n / max) * 100).toFixed(1)}%"></div></div>
        <div class="histScoreCount">${n}射 (${((n / count) * 100).toFixed(0)}%)</div>
      </div>`;
      })
      .join("") +
    `<p class="basis">上の対象の全${count}射を、保存された点数で数えています。</p></section>`
  );
}
function monthlyCard(ss) {
  const src = ss || db.sessions;
  if (!src.length) return "";
  const m = {};
  src.forEach((s) => {
    const k = (s.date || "").slice(0, 7);
    if (!k) return;
    const all = s.ends.flat();
    m[k] = m[k] || { c: 0, n: 0, sum: 0 };
    m[k].c++;
    m[k].n += all.length;
    m[k].sum += all.reduce((a, x) => a + x.s, 0);
  });
  const keys = Object.keys(m).sort().reverse().slice(0, 6);
  if (!keys.length) return "";
  return (
    `<section class="vsec" data-testid="analysis-monthly"><div class="vsecH"><h2>月ごとのまとめ</h2><span class="aside">${keys.length}か月</span></div><table class="tbl anMonthTbl"><tr><th>月</th><th class="right">練習</th><th class="right">射数</th><th class="right">1射平均</th></tr>` +
    keys
      .map(
        (k) =>
          `<tr><td>${k.replace("-", "/")}</td><td class="right">${m[k].c}回</td><td class="right">${m[k].n}射</td><td class="right"><b>${m[k].n ? (m[k].sum / m[k].n).toFixed(2) : "—"}</b></td></tr>`,
      )
      .join("") +
    `</table><p class="basis">弓具と期間の選択に合う、すべての条件の記録です（新しい月から6か月まで）。</p></section>`
  );
}
/* 多距離ラウンド（IMP-09）: 履歴詳細に同 gid の他ステージ一覧とラウンド合計を出す。
   roundGroup の無いセッションでは空文字（既存表示不変）。ステージ行の「開く」で該当詳細へ移動 */
function histRoundGroupHtml(sess) {
  const rg = sess && sess.roundGroup;
  if (!rg || !rg.gid) return "";
  const stages = db.sessions
    .filter((x) => x && x.roundGroup && x.roundGroup.gid === rg.gid)
    .sort((a, b) => (Number(a.roundGroup.stage) || 0) - (Number(b.roundGroup.stage) || 0));
  if (!stages.length) return "";
  const maxDist = Math.max(...stages.map((x) => Number(x.dist) || 0), 1);
  let total = 0,
    arrows = 0;
  const rows = stages
    .map((x) => {
      const all = x.ends.flat(),
        t = all.reduce((a, c) => a + c.s, 0);
      total += t;
      arrows += all.length;
      const cur = x.id === sess.id;
      const d = Number(x.dist) || 0;
      return `<tr class="${cur ? "stageRowCur" : ""}">
      <td><span class="stageTick" style="width:${8 + Math.round((d / maxDist) * 22)}px"></span>ステージ${(Number(x.roundGroup.stage) || 0) + 1} ・ ${historyDistanceLabel(x.dist)}</td>
      <td class="right">${all.length}射</td>
      <td class="right"><b>${t}</b></td>
      <td class="right">${cur ? `<span class="mini">（表示中）</span>` : `<button type="button" class="btn sm ghost" data-stage-jump="${esc(x.id)}">開く</button>`}</td>
    </tr>`;
    })
    .join("");
  return `<div class="mt10" data-testid="history-stage-table">
    <div class="subNote">${esc(roundLabel(rg.roundId))} のステージ（行程表）</div>
    <table class="tbl mt8 stageTable"><tr><th>ステージ</th><th class="right">本数</th><th class="right">得点</th><th class="right"></th></tr>${rows}
    <tr class="stageTotalRow"><td><b>ラウンド合計</b>${stages.length === Number(rg.stageCount) ? "" : ` <span class="mini">(${stages.length}/${rg.stageCount}ステージ)</span>`}</td><td class="right">${arrows}射</td><td class="right"><b>${total}</b></td><td class="right"></td></tr>
    </table>
  </div>`;
}
/* 旧判定（矢円=的の直径÷85）で記録した回は、保存された点数を変えずに実寸判定の点数を並べて示す。
   新しい判定で記録した回（arrowR を保存済み）は記録時の点数がそのまま実寸判定なので何も出さない */
function legacyRescoreHtml(sess, setup, total) {
  if (!sess || validArrowR(sess.arrowR)) return "";
  const arrowR = sessionArrowR(sess, setup);
  const r = sessionRescore(sess, arrowR);
  if (!r.scored || r.total === total) return "";
  const enteredDia = parseFloat(setup && setup.arrowDia);
  const entered = Number.isFinite(enteredDia) && enteredDia >= ARROW_DIA_MM_MIN && enteredDia <= ARROW_DIA_MM_MAX;
  const dia = (arrowR * 20).toFixed(1);
  const diff = r.total - total;
  return `<div class="hint histRescore" data-testid="history-rescore">実寸判定（${entered ? `矢径 ${dia}mm` : `矢径未入力のため ${dia}mm`}）では <b>${r.total}点</b>（記録時 ${total}点・差 ${diff > 0 ? "+" : ""}${diff}点・${r.changed}本）。保存された点数と着弾図の円は記録時の判定のままです。</div>`;
}
/* 詳細を閉じたあと一覧を描き直したとき、開いていた項目へフォーカスを戻す */
function focusNoteEntry(id) {
  const el = [...document.querySelectorAll("#histList .noteEntry")].find((x) => x.dataset.id === id);
  if (el) el.focus({ preventScroll: true });
}
/* タグ（射型・風・サイト・弓具）の切り替え。練習は sess.tags、メモは note.tags に文字列の配列で持つ。
   データにある見本以外のタグも、外せるように並べる */
function noteTagsHtml(tags) {
  const cur = Array.isArray(tags) ? tags : [];
  const list = [...NOTE_TAGS, ...cur.filter((t) => !NOTE_TAGS.includes(t))];
  return `<div class="ntags noteTagRow" role="group" aria-label="タグ" data-testid="note-tags">${list
    .map(
      (t) =>
        `<button type="button" class="ntag" data-tag="${esc(t)}" aria-pressed="${cur.includes(t)}">${esc(t)}</button>`,
    )
    .join("")}</div>`;
}
function bindNoteTags(root, target, onChange) {
  root.querySelectorAll(".noteTagRow .ntag").forEach(
    (b) =>
      (b.onclick = () => {
        const cur = Array.isArray(target.tags) ? target.tags : [];
        const tag = b.dataset.tag;
        const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
        if (next.length) target.tags = next;
        else delete target.tags;
        b.setAttribute("aria-pressed", String(next.includes(tag)));
        onChange();
      }),
  );
}
function noteCondRowHtml(k, v, sub) {
  return `<div class="lrow"><span class="lk">${k}</span><span class="lv">${v}${sub ? `<small>${sub}</small>` : ""}</span></div>`;
}
/* 条件（ラウンド・弓具・サイト・天気と風・入力）。記録に残っている値だけを書く */
function noteConditionsHtml(sess, setup) {
  const all = sessionArrows(sess);
  const plan = scorecardPlan(sess);
  const pos = all.filter(arrowHasPos).length;
  const stored = validArrowR(sess.arrowR);
  const dia = (sessionScoringRadius(sess, setup) * 20).toFixed(1);
  const round = sess.round && sess.round !== "free" ? roundLabel(sess.round) : "";
  const sight =
    sess.sightV || sess.sightH
      ? `上下 ${esc(sess.sightV || "—")}・左右 ${esc(sess.sightH || "—")}`
      : "記録なし";
  const input = !all.length
    ? "記録なし"
    : !pos
      ? "点数だけ"
      : pos < all.length
        ? "的面に打つ"
        : sessionInputMode(sess) === "score"
          ? "点数だけ"
          : "的面に打つ";
  return `<section class="vsec" data-testid="note-conditions">
    <div class="vsecH"><h2>条件</h2></div>
    ${noteCondRowHtml("ラウンド", `${historyDistanceLabel(sess.dist)}・${esc(faceLabel(sess))}`, `${round ? esc(round) + "・" : ""}${plan.per}射 × ${sess.ends.length}エンド`)}
    ${noteCondRowHtml("弓具", setup ? esc(setup.name) : "未指定", stored ? `矢の外径 ${dia}mm で判定` : `記録時の判定の円（直径 ${dia}mm）で採点`)}
    ${noteCondRowHtml("サイト", sight)}
    ${noteCondRowHtml("天気・風", windText(sess) ? esc(windText(sess)) : "記録なし")}
    ${noteCondRowHtml("入力", input, pos && pos < all.length ? `位置なし ${all.length - pos}射` : "")}
  </section>`;
}
/* ---------- ノートの詳細（全画面。試作 #note/<id>）----------
   上から: 日付・距離と合計 → メモとタグ → 数値 → 同じ条件との比較（「この回」）→ スコア表 → 着弾 → 条件 →
   サイト調整の目安と詳しい根拠 → この記録の操作（直す・画像で保存・分析で見る・ゴミ箱へ移す）。
   保存された点数はここで書き換えない。メモとタグだけが、この画面からその記録に書き込まれる */
function openHistDetail(id) {
  const sess = db.sessions.find((s) => s.id === id);
  if (!sess) return;
  const ovl = document.createElement("div");
  ovl.className = "ovl resultOvl noteOvl";
  const all = sess.ends.flat();
  const total = all.reduce((a, x) => a + x.s, 0);
  const setup = db.setups.find((x) => x.id === sess.setupId);
  const st = sessionMetrics(sess).st;
  /* 位置のある矢が1本もない記録（点数だけの入力）: 着弾の数値・信頼度・次のアクションは出さない */
  const hasImpact = !!st;
  const posCount = all.filter(arrowHasPos).length;
  const adv = adviceFor(sess, setup);
  /* この日の時点までのデータだけで computeTodaysResult を再現する（未来のセッションを
     「前回」等に混入させないよう、当日以前に絞った母集団を渡す）。文言は「今回」→「この回」に切替 */
  const histAsOfDate = sess.date || today();
  const histSessions = db.sessions.filter((x) => x && x.date && x.date <= histAsOfDate);
  const histTodaysResult = computeTodaysResult(histSessions, sess.id, sessionMetrics, {
    formAnalyses: db.formAnalyses,
  });
  const histComparison = computeConditionComparison(histSessions, sess.id, scorecardPlan(sess).quota);
  const p = dateParts(sess.date);
  const counts = scorecardCountCols(sess);
  const quota = scorecardPlan(sess).quota;
  const rescore = legacyRescoreHtml(sess, setup, total);
  const op = (opId, title, sub) =>
    `<button type="button" class="lrow link" id="${opId}"><span class="lmain"><b>${title}</b><span>${sub}</span></span>${NOTE_GO}</button>`;
  const detailNumbersHtml = `${hasImpact ? groupSummaryHtml(st, { withConfidenceNote: true }) : `<div class="kv"><span>グルーピング</span><span>着弾データなし</span></div>`}
    ${sess.sightV || sess.sightH ? `<div class="kv"><span>使用サイト</span><span>上下 ${esc(sess.sightV || "—")} / 左右 ${esc(sess.sightH || "—")}</span></div>` : ""}
    ${hasImpact ? trustHtml(sess, setup, st) : ""}
    ${arrowMetaSummaryHtml(sess)}`;
  ovl.innerHTML = `<div class="sheet resultScreen noteScreen histDetailSheet" data-testid="note-detail" data-id="${esc(sess.id)}">
    <div class="subTop"><button type="button" class="backBtn" id="hClose" data-testid="note-back">${REC_CHEVRON}${view === "history" ? "ノート" : "戻る"}</button></div>
    <header class="subHead noteHead">
      <div>
        <div class="viewDate">${p ? `${p.y}年` : "日付なし"}</div>
        <h3>${p ? `${fmtMDW(sess.date)}&emsp;` : ""}${historyDistanceLabel(sess.dist)}<span class="srOnly">（${fmtD(sess.date)}・${esc(faceLabel(sess))}）</span></h3>
      </div>
      <div class="bigNum noteTotal" data-testid="note-total" aria-label="合計 ${total}点">${total}</div>
    </header>
    <p class="basis noteCond" data-testid="note-condition">${esc([faceLabel(sess), setup ? setup.name : "弓具未指定", sess.round && sess.round !== "free" ? roundLabel(sess.round) : "", windText(sess)].filter(Boolean).join("・"))}</p>
    <section class="vsec">
      <div class="vsecH"><h2><label for="hNote">メモ</label></h2><span class="aside">書くと保存されます</span></div>
      <textarea class="noteBox" id="hNote" data-testid="note-memo" placeholder="感覚、気づいたこと、次に確かめること">${esc(sess.note || "")}</textarea>
      ${noteTagsHtml(sess.tags)}
    </section>
    <section class="vsec" data-testid="history-detail-stats">
      <div class="vsecH"><h2>合計の内訳</h2><span class="aside">${all.length}射・1射平均 ${all.length ? (total / all.length).toFixed(2) : "—"}${quota ? `・満点 ${quota * perfectScoreValue(sess)}` : ""}</span></div>
      ${sessionFigsHtml(sess, "ends")}
    </section>
    ${todaysResultHtml(histTodaysResult, sess, { dayLabel: "この日", comparison: histComparison })}
    ${histRoundGroupHtml(sess)}
    <section class="vsec"><div class="vsecH"><h2>スコア表</h2><span class="aside">${counts.map((c) => `${c.sub} ${c.count(all)}`).join("・")}</span></div></section>
    <div class="bleed" data-testid="history-end-table">${scorecardHtml(sess, { final: true })}</div>
    ${all.some((a) => a.manual === true) ? `<p class="basis" data-testid="history-manual-note">* は手で直した点数です（位置からの採点とは違う点を、記録中に選んでいます）。</p>` : ""}
    <section class="vsec"><div class="vsecH"><h2>着弾</h2><span class="aside">${posCount ? `${posCount}射の位置` : "位置の記録なし"}</span></div></section>
    <div id="hPlot" class="recordSummaryPlot${posCount ? " bleed" : ""}"></div>
    ${resultImpactFigsHtml(st)}
    ${noteConditionsHtml(sess, setup)}
    <details class="adv summaryDetails histDetailNumbers" data-testid="note-sight-details">
      <summary>サイト調整の目安と詳しい根拠</summary>
      ${
        adv
          ? `<div class="advice"><div class="subNote">${icon("tool")} この回からのサイト調整提案</div>${adv.lines.map((l) => `<div class="dir">${l.html}</div>`).join("")}${judgementHtml(adv, sess)}${shapeNote(adv.st)}${adv.notes
              .slice(0, 3)
              .map((n) => `<div class="note">・${n}</div>`)
              .join("")}</div>`
          : ""
      }
      ${personalModelHtml(adv, sess, setup)}
      ${roundProgressHtml(sess)}
      ${conditionHtml(sess, st, setup)}
      ${hasImpact ? nextActionHtml(sess, adv, setup) : ""}
      <div data-testid="history-detail-numbers">${detailNumbersHtml}</div>
    </details>
    <section class="vsec histDetailActions" data-testid="note-ops">
      <div class="vsecH"><h2>この記録の操作</h2></div>
      ${op("hEdit", "点数や位置を直す", "記録中と同じ画面で直します。直した矢には印が付きます")}
      ${op("hCard", "スコア表を画像で保存", "共有の画面が出る端末では、そこから送れます")}
      ${op("hAnalysis", "分析で見る", "分析タブへ移ります")}
      ${rescore}
      <div class="btnRow"><button type="button" class="btn danger" id="hDel">ゴミ箱へ移す</button></div>
      <p class="basis">ゴミ箱に移した記録は、ノートの一番下から元に戻せます。</p>
    </section>
  </div>`;
  openModal(ovl, { escapeTarget: "#hClose", swipe: false });
  plotSession(sess, ovl.querySelector("#hPlot"));
  /* メモとタグはこの記録に書く。入力のたびに保存を予約し、欄を離れるとき・閉じるときに書き込む */
  const note = ovl.querySelector("#hNote");
  let edited = false;
  const syncNote = () => {
    const v = note.value.trim();
    if ((sess.note || "") === v) return;
    sess.note = v;
    edited = true;
    scheduleSave("note-memo");
  };
  note.oninput = syncNote;
  note.onblur = () => {
    syncNote();
    flushPendingSave();
  };
  /* タグは押した時点で書き込む（本文と違い、続けて何度も変わる入力ではない） */
  bindNoteTags(ovl, sess, () => {
    edited = true;
    scheduleSave("note-tags");
    flushPendingSave();
  });
  const close = () => {
    syncNote();
    flushPendingSave();
    closeModal(ovl);
    if (edited) {
      render();
      focusNoteEntry(sess.id);
    }
  };
  ovl.querySelectorAll("[data-stage-jump]").forEach(
    (b) =>
      (b.onclick = () => {
        close();
        openHistDetail(b.dataset.stageJump);
      }),
  );
  ovl.querySelector("#hClose").onclick = close;
  ovl.querySelector("#hEdit").onclick = () => {
    if (db.active) {
      toast("記録の途中のものがあります。先に終了してください");
      return;
    }
    syncNote();
    const cp = JSON.parse(JSON.stringify(sess));
    cp.cur = [];
    cp._edit = true;
    db.active = cp;
    save();
    closeModal(ovl);
    if (view === "record") render();
    else showView("record");
    toast("過去の記録を編集中。メニューの「編集を終了して保存する」で上書きします");
  };
  ovl.querySelector("#hCard").onclick = () => exportScorecardImage(sess);
  ovl.querySelector("#hAnalysis").onclick = () => {
    close();
    openAnalysisFor(sess);
  };
  ovl.querySelector("#hDel").onclick = async () => {
    if (
      await appConfirm("この練習の記録をゴミ箱へ移しますか？ ノートの一番下のゴミ箱から元に戻せます。", {
        danger: true,
        okLabel: "ゴミ箱へ移す",
      })
    ) {
      syncNote();
      trashItem("session", `${fmtD(sess.date)} ${historyDistanceLabel(sess.dist)}`, sess);
      db.sessions = db.sessions.filter((s) => s.id !== id);
      save({ reason: "delete-session", forceSnapshot: true });
      closeModal(ovl);
      render();
      toast("ゴミ箱へ移しました。ノートの一番下から元に戻せます");
    }
  };
}
/* ---------- メモだけのノート（db.notes）: 書く・読む・直す・ゴミ箱へ移す ----------
   id が無ければ今日の日付で新しく書く。新しいメモは本文を書いた時点でノートに入り、入力のたびに保存を予約する。
   欄を離れるとき・閉じるとき（戻る・Esc）に書き込む。本文が空のままの新しいメモは残さない */
function openMemoDetail(id) {
  if (!Array.isArray(db.notes)) db.notes = [];
  const existing = id ? db.notes.find((n) => n.id === id) : null;
  if (id && !existing) return;
  const isNew = !existing;
  const note = existing || { id: uid(), date: today(), ts: Date.now(), text: "" };
  let stored = !isNew,
    edited = false;
  const ovl = document.createElement("div");
  ovl.className = "ovl resultOvl noteOvl";
  ovl.innerHTML = `<div class="sheet resultScreen noteScreen memoScreen" data-testid="memo-detail" data-id="${esc(note.id)}">
    <div class="subTop"><button type="button" class="backBtn" id="nClose" data-testid="memo-back">${REC_CHEVRON}${view === "history" ? "ノート" : "戻る"}</button></div>
    <header class="subHead">
      <div class="viewDate" id="nDateLabel"></div>
      <h3>${isNew ? "メモを書く" : "メモ"}</h3>
    </header>
    <section class="vsec">
      <div class="vsecH"><h2><label for="nDate">日付</label></h2><span class="aside">ノートに並ぶ日</span></div>
      <input type="date" class="inp" id="nDate" data-testid="memo-date" value="${noteDateOk(note.date) ? note.date : ""}">
    </section>
    <section class="vsec">
      <div class="vsecH"><h2><label for="nText">本文</label></h2><span class="aside">書くと保存されます</span></div>
      <textarea class="noteBox memoBox" id="nText" data-testid="memo-text" placeholder="練習のない日の気づき、素引きや筋トレの内容、次に確かめること">${esc(note.text || "")}</textarea>
      ${noteTagsHtml(note.tags)}
    </section>
    ${
      isNew
        ? `<p class="basis">本文を書くと、ノートに1項目として入ります。本文が空のまま戻ると、何も残りません。</p>`
        : `<section class="vsec histDetailActions" data-testid="memo-ops">
      <div class="vsecH"><h2>このメモの操作</h2></div>
      <div class="btnRow"><button type="button" class="btn danger" id="nDel">ゴミ箱へ移す</button></div>
      <p class="basis">ゴミ箱に移したメモは、ノートの一番下から元に戻せます。</p>
    </section>`
    }
  </div>`;
  openModal(ovl, { escapeTarget: "#nClose", swipe: false });
  const text = ovl.querySelector("#nText"),
    date = ovl.querySelector("#nDate"),
    label = ovl.querySelector("#nDateLabel");
  const showDate = () => {
    const p = dateParts(note.date);
    label.textContent = p ? `${p.y}年 ${fmtMDW(note.date)}` : "日付なし";
  };
  showDate();
  const changed = (reason) => {
    edited = true;
    if (!stored && String(note.text || "").trim()) {
      db.notes.push(note);
      stored = true;
    }
    if (stored) scheduleSave(reason);
  };
  const syncText = () => {
    if ((note.text || "") === text.value) return;
    note.text = text.value;
    changed("memo-text");
  };
  text.oninput = syncText;
  text.onblur = () => {
    syncText();
    flushPendingSave();
  };
  date.onchange = () => {
    /* 空・読めない日付は受け取らず、元の日付のままにする */
    if (!noteDateOk(date.value)) {
      date.value = noteDateOk(note.date) ? note.date : "";
      return;
    }
    if (note.date === date.value) return;
    note.date = date.value;
    showDate();
    changed("memo-date");
  };
  bindNoteTags(ovl, note, () => {
    changed("memo-tags");
    flushPendingSave();
  });
  const close = () => {
    syncText();
    if (isNew && stored && !String(note.text || "").trim()) {
      /* 書いてから全部消した新しいメモは、項目ごと取り下げる（本文は空なので失うものは無い） */
      db.notes = db.notes.filter((n) => n !== note);
      stored = false;
      scheduleSave("memo-empty");
    }
    flushPendingSave();
    closeModal(ovl);
    if (edited) {
      render();
      focusNoteEntry(note.id);
    }
  };
  ovl.querySelector("#nClose").onclick = close;
  const del = ovl.querySelector("#nDel");
  if (del)
    del.onclick = async () => {
      if (
        await appConfirm("このメモをゴミ箱へ移しますか？ ノートの一番下のゴミ箱から元に戻せます。", {
          danger: true,
          okLabel: "ゴミ箱へ移す",
        })
      ) {
        syncText();
        const head = String(note.text || "").trim().replace(/\s+/g, " ");
        trashItem(
          "note",
          `メモ ${fmtD(note.date) || "日付なし"}${head ? ` ${head.slice(0, 24)}${head.length > 24 ? "…" : ""}` : ""}`,
          note,
        );
        db.notes = db.notes.filter((n) => n.id !== note.id);
        save({ reason: "delete-note", forceSnapshot: true });
        closeModal(ovl);
        render();
        toast("ゴミ箱へ移しました。ノートの一番下から元に戻せます");
      }
    };
  if (isNew) text.focus({ preventScroll: true });
}

/* ---------- サイト ---------- */
function sightRecordOrder(marks) {
  if (marks.some((m) => typeof m.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)))
    return { label: "順序未確定", note: "日付不明の記録を含みます。" };
  const first = marks[0];
  if (!first) return { label: "", note: "" };
  const sameDay = marks.filter((m) => m.date === first.date);
  if (sameDay.length > 1) {
    if (sameDay.some((m) => !Number.isFinite(Number(m.ts)) || Number(m.ts) <= 0))
      return { label: "同日・時刻不明", note: "同日の記録時刻が不足しています。" };
    if (sameDay.filter((m) => Number(m.ts) === Number(first.ts)).length > 1)
      return { label: "同日時の記録あり", note: "同じ日時の候補が複数あります。" };
  }
  return { label: "最新", note: "" };
}
/* 予測の出どころ: どの実測（距離・値・日付）から計算したかを必ず添える */
function sightPredictionHtml(interp, marks) {
  const groups = new Map();
  marks.forEach((m) => {
    const key = String(m.dist);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });
  const status = new Map();
  groups.forEach((rows, key) => {
    rows.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.ts || 0) - (a.ts || 0));
    status.set(key, { first: rows[0], order: sightRecordOrder(rows) });
  });
  const predictions = [18, 30, 50, 70].filter((d) => !interp.have.includes(d));
  const sources = interp.pts.map((point, i) => {
    const mark = interp.sources[i], info = status.get(String(mark.dist));
    const notes = [];
    if (info.order.note) notes.push(info.order.note);
    if (info.first !== mark && !isFinite(parseFloat(info.first.v))) {
      const dated = typeof mark.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(mark.date) && typeof info.first.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(info.first.date);
      const newerDate = dated && info.first.date > mark.date;
      const newerTime = dated && info.first.date === mark.date && Number.isFinite(Number(mark.ts)) && Number(mark.ts) > 0 && Number.isFinite(Number(info.first.ts)) && Number(info.first.ts) > Number(mark.ts);
      notes.push(newerDate || newerTime ? "新しい記録に数値なし" : "数値のある記録から採用");
    }
    return `<li data-source-id="${esc(mark.id)}"><div><b>${esc(point[0])}m</b><div class="sightSourceDate">${esc(fmtD(mark.date) || "日付不明")}</div></div><strong>${esc(point[1])}</strong>${notes.length ? `<p class="sightSourceNote">${esc(notes.join(" "))}</p>` : ""}</li>`;
  }).join("");
  const from = `実測 ${interp.pts.length}点（${interp.pts.map((p) => `${esc(p[0])}m`).join("・")}）から`;
  const model =
    interp.model === "physics"
      ? `弾道の計算（初速 ${Math.round(interp.speedFps)}fps・${interp.speedSource === "measured" ? "実測" : interp.speedSource === "fitted" ? "台帳から推定" : "弓具から推定"}）に、上下の実測 ${interp.pts.length}点を当てはめた値です。`
      : `上下の実測 ${interp.pts.length}点を直線で結んだ値です。`;
  const fit =
    interp.pts.length <= 2
      ? "実測が2点のため、当てはまりは確かめられません（2点は必ず通ります）。初速の仮定で値が変わります。"
      : `実測との当てはまり（決定係数）は ${pct(interp.r2 || 0)} です。`;
  return `<section class="vsec sightPrediction" data-testid="sight-prediction">
    <div class="vsecH"><h2>記録していない距離の予測</h2><span class="aside">上下の値</span></div>
    ${predictions.length ? `<dl class="sightPredictionRows">${predictions.map((d) => `<div class="lrow" data-predict-dist="${d}"><dt class="lk">${d}m<span>予測・${from}</span></dt><dd class="lv">${interp.est(d).toFixed(1)}<small>目盛り</small></dd></div>`).join("")}</dl>` : `<p class="basis">定番の距離（18・30・50・70m）は、すべて実測の記録があります。</p>`}
    <p class="basis sightPredictionMeta">${model}${fit}左右は予測しません。</p>
    <details class="sightSources"><summary>計算に使った実測 ${interp.pts.length}件</summary><ul class="sightSourceList">${sources}</ul></details>
    <details class="sightPredictionHelp"><summary>予測の計算方法</summary><p>上下が数値で入力された記録だけを使います。距離ごとに最も新しい数値を採り、新しい記録の上下が未入力なら、それより前の数値を使います。</p><p>2距離以上あるとき、矢の弾道（重力・空気抵抗・目と矢と的の高さの差）から計算した照準角にサイト値を当てはめます。5距離以上で、初速を変えた方が統計的に有意に当てはまる場合は、初速も台帳から推定します。</p></details>
  </section>`;
}
function sightLedgerHtml(marks) {
  const value = (v) => (v == null || v === "" ? "—" : String(v));
  const order = sightRecordOrder(marks);
  return `${order.note ? `<p class="sightLedgerOrderNote">${esc(order.note)}</p>` : ""}<ol class="sightLedgerList" data-testid="sight-ledger" aria-label="サイト記録">${marks
    .map((mk, i) => {
      const date = fmtD(mk.date) || "日付不明";
      return `<li class="sightLedgerRecord" data-sight-id="${esc(mk.id)}">
        <div class="sightMarkHead">
          <div class="sightMarkDate">${esc(date)}${i === 0 ? `<span class="sightMarkLatest${order.note ? " uncertain" : ""}">${esc(order.label)}</span>` : ""}</div>
          <button class="btn sm ghost histDelBtn" type="button" data-del="${esc(mk.id)}" aria-label="${esc(date)}のサイト値をゴミ箱へ移す">${icon("del")}</button>
        </div>
        <dl class="sightMarkValues"><div><dt>上下</dt><dd>${esc(value(mk.v))}</dd></div><div><dt>左右</dt><dd>${esc(value(mk.h))}</dd></div></dl>
        ${mk.note ? `<details class="sightMarkNote"><summary>メモ</summary><p>${esc(mk.note)}</p></details>` : ""}
      </li>`;
    })
    .join("")}</ol>`;
}
/* 「サイト値の記録」「サイト値のまとめ」（v5 段 7 で分析から移した。段 8 で罫線の行に作り直し）。
   対象は、この画面で選んでいるセッティングの記録（すべての距離・期間）。セッティングが1つも無いときは、すべての記録 */
function sightRecordsOverviewHtml(setupId) {
  const own = (x) => !setupId || (x && x.setupId === setupId);
  const ss = sessionsByDateDesc().filter((s) => Array.isArray(s.ends) && own(s));
  const marks = (Array.isArray(db.sightMarks) ? db.sightMarks : []).filter(own);
  const body = `${sightHistoryCard(ss, marks)}${sightSummaryHtml(historySessionRows(ss), { setupId: "", dist: "" }, marks)}`;
  return body ? `<div class="sightRecordsOverview" data-testid="sight-records-overview">${body}</div>` : "";
}
/* ---------- 弓具 > サイト（v5 段 8。docs/design/v5/design.md 4.7） ----------
   セッティングの選択 → サイト台帳（目盛りの図と距離ごとの最新値。行を押すと距離を選ぶ）→ 選んだ距離の記録 →
   調整の目安 → 記録していない距離の予測 → サイト値の記録（全距離）。
   計算（sightDecision・sightInterp ほか 20-・40-）は変えず、結果の出し方だけを作り直している。 */
/* 距離ごとの最新の記録。図と値に使うのは、上下が数値で入っている最も新しい記録（sightInterp と同じ採り方） */
function sightDistRows(sid, dists, interp) {
  return dists.map((d) => {
    const all = db.sightMarks
      .filter((x) => x.setupId === sid && x.dist === d)
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.ts || 0) - (a.ts || 0));
    const numeric = all.find((x) => hasSightInput(x.v) && Number.isFinite(Number(String(x.v).trim())));
    if (numeric) return { dist: d, kind: "rec", v: Number(String(numeric.v).trim()), text: sightValueText(numeric.v), h: numeric.h, mark: numeric, count: all.length };
    if (interp && !interp.have.includes(d)) {
      const est = interp.est(d);
      if (Number.isFinite(est)) return { dist: d, kind: "pred", v: est, text: est.toFixed(1), count: all.length, n: interp.pts.length };
    }
    return { dist: d, kind: "none", v: null, text: "—", count: all.length };
  });
}
/* 目盛りの刻み: 範囲に合わせて 1・2・5×10^k の主目盛り（4〜8本）と、その 1/5 の副目盛り */
function sightScaleTicks(lo, hi) {
  let span = hi - lo;
  if (!(span > 0)) {
    span = Math.max(1, Math.abs(lo) * 0.1);
    lo -= span / 2;
    hi += span / 2;
    span = hi - lo;
  }
  const raw = span / 5,
    pow = Math.pow(10, Math.floor(Math.log10(raw))),
    f = raw / pow;
  const major = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
  const a = Math.floor(lo / major + 1e-9) * major,
    b = Math.ceil(hi / major - 1e-9) * major;
  return { lo: a, hi: b, major, minor: major / 5, dec: Math.max(0, -Math.floor(Math.log10(major) + 1e-9)) };
}
/* 目盛りの図: 縦の目盛りに、距離ごとの値を矢印で置く。実測＝実線、予測＝破線。数値は右の表にも同じ値を出す */
function sightScaleSvg(rows) {
  const pts = rows.filter((r) => r.kind !== "none" && Number.isFinite(r.v));
  if (!pts.length) return "";
  const t = sightScaleTicks(Math.min(...pts.map((r) => r.v)), Math.max(...pts.map((r) => r.v)));
  const W = 112, H = 330, T = 16, B = 16;
  const Y = (v) => T + ((v - t.lo) / (t.hi - t.lo)) * (H - T - B);
  const fmt = (v) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(Math.min(t.dec, 3));
  let h = `<path d="M40 ${T}V${H - B}" stroke="var(--ink)" stroke-width="2"/>`;
  const nMinor = Math.round((t.hi - t.lo) / t.minor);
  for (let i = 0; i <= nMinor; i++) {
    const v = t.lo + i * t.minor;
    const isMajor = i % 5 === 0;
    h += `<path d="M40 ${Y(v).toFixed(1)}h${isMajor ? -12 : -6}" stroke="var(${isMajor ? "--ink" : "--rule-strong"})" stroke-width="${isMajor ? 1.5 : 1}"/>`;
    if (isMajor) h += `<text class="ax" x="24" y="${(Y(v) + 4.5).toFixed(1)}" text-anchor="end" font-size="13" fill="var(--sub)">${fmt(v)}</text>`;
  }
  /* 近い値の名札は重ならないよう、上から順に 17px 以上あける（矢印の位置は動かさない） */
  const marks = pts.map((r) => ({ r, y: Y(r.v), ly: Y(r.v) })).sort((a, b) => a.y - b.y);
  marks.forEach((mk, i) => {
    if (i > 0 && mk.ly < marks[i - 1].ly + 17) mk.ly = marks[i - 1].ly + 17;
  });
  for (let i = marks.length - 1; i >= 0; i--) {
    const max = i === marks.length - 1 ? H - 6 : marks[i + 1].ly - 17;
    if (marks[i].ly > max) marks[i].ly = max;
  }
  marks.forEach((mk) => {
    const p = mk.r.kind === "pred", col = `var(${p ? "--sub" : "--accent"})`;
    h += `<g data-scale-dist="${esc(mk.r.dist)}" data-scale-kind="${mk.r.kind}" data-scale-v="${esc(mk.r.text)}"><path d="M40 ${mk.y.toFixed(1)}H58" stroke="${col}" stroke-width="2"${p ? ' stroke-dasharray="4 3"' : ""}/><path d="M42 ${mk.y.toFixed(1)}l8 -5v10z" fill="${col}"/>${Math.abs(mk.ly - mk.y) > 0.5 ? `<path d="M58 ${mk.y.toFixed(1)}L64 ${mk.ly.toFixed(1)}" stroke="${col}" stroke-width="1"/>` : ""}<text x="66" y="${(mk.ly + 5).toFixed(1)}" font-size="14" font-weight="700" fill="var(--ink)">${esc(mk.r.dist)}m</text></g>`;
  });
  const label = `サイトの目盛り（上下の値）。${pts.map((r) => `${r.dist}m ${r.text}${r.kind === "pred" ? "（予測）" : ""}`).join("、")}`;
  return `<svg class="sightScale" data-testid="sight-scale" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">${h}</svg>`;
}
function sightDistRowHtml(r, cur) {
  const sub =
    r.kind === "rec"
      ? `${fmtMD(r.mark.date) || "日付不明"} 実測`
      : r.kind === "pred"
        ? `予測（実測${r.n}点から）`
        : r.count
          ? "上下の数値なし"
          : "記録なし";
  return `<button type="button" class="lrow sightDistRow${cur ? " is-cur" : ""}" data-d="${esc(r.dist)}" data-kind="${r.kind}" aria-pressed="${cur}"><span class="lk">${esc(r.dist)}m</span><span class="lv${r.kind === "rec" ? "" : " est"}">${esc(r.text)}<small>${esc(sub)}</small></span></button>`;
}
function sightHorizontalNoteHtml(rows) {
  const rec = rows.filter((r) => r.kind === "rec");
  if (!rec.length) return "";
  const vals = rec.map((r) => sightValueText(r.h));
  if (vals.every((v) => v === vals[0])) return `<p class="basis" data-testid="sight-h-note">左右は${rec.length > 1 ? "全距離" : ""} ${esc(vals[0] === "—" ? "未入力" : vals[0])} です。</p>`;
  return `<p class="basis" data-testid="sight-h-note">左右: ${rec.map((r, i) => `${esc(r.dist)}m ${esc(vals[i])}`).join("・")}</p>`;
}
/* 調整の目安（表示用）。量と方向は adviceFor / sightDecision の結果を読むだけで、計算し直さない。
   動かす: 同時の検定で 5% 未満、かつその軸の 95% 区間が 0 を含まず、補正量がリング幅の 1/10 以上（sightDecision）。
   保留: 動かす条件を満たすが、同じサイト値の過去の傾向と逆（judgementFor「保留」）か、風の記録があり左右だけがずれている（「風を考慮」）。
   区間がリング幅の半分より広い軸は「判定できない」（中心がまだ定まっていない） */
function sightAdviceModel(sess, setup, adv) {
  if (!adv || !adv.decision) return null;
  const d = adv.decision, ss = sightStats(adv.st);
  const j = judgementFor(adv, sess);
  const moves = adv.lines.filter((l) => l.axis !== "-").map((l) => l.axis);
  const holdAll = moves.length && j && j.label === "保留";
  const holdWind = j && j.label === "風を考慮";
  const axis = (k) => {
    const a = d[k];
    const dirWord = k === "v" ? (a.m > 0 ? "上" : "下") : a.m > 0 ? "右" : "左";
    const out = { key: k, name: k === "v" ? "上下" : "左右", m: a.m, ci: a.ci, shrink: a.shrink, dirWord, state: "none", big: "動かさない", amount: "" };
    if (a.move) {
      const adj = Math.abs(a.adj);
      const mm = adj * (k === "v" ? adv.traj.mmPerCmV : adv.traj.mmPerCmH);
      const ck = sightClickText(adj, sess.dist, setup, adv.pcal, k);
      out.mm = mm;
      out.adj = adj;
      out.clicks = ck ? Math.abs(ck.clicks) : null;
      out.clickKind = ck ? (ck.label === "クリック" ? "set" : "est") : "";
      out.amount = ck ? `${Math.abs(ck.clicks).toFixed(1)}${ck.label === "クリック" ? "クリック" : "目盛り"}` : `${mm.toFixed(1)}mm`;
      if (holdAll || (holdWind && k === "h")) {
        out.state = "hold";
        out.big = "保留";
      } else {
        out.state = "move";
        out.big = `${dirWord}へ ${out.amount}`;
      }
    } else if (!(a.ci <= d.w / 2)) {
      out.state = "open";
      out.big = "判定できない";
    } else if (holdWind && k === "h") {
      out.state = "hold";
      out.big = "保留";
    }
    return out;
  };
  return { d, ss, j, h: axis("h"), v: axis("v"), excluded: (adv.st.excluded || []).length, total: adv.st.n };
}
function sightOffsetWord(v, k) {
  const a = Math.abs(v).toFixed(1);
  if (k === "h") return `${v > 0 ? "右" : v < 0 ? "左" : "左右"} ${a}cm`;
  return `${v > 0 ? "上" : v < 0 ? "下" : "上下"} ${a}cm`;
}
/* 外れ値候補を除いた中心（B）の移り変わり。同じセッティング・距離・的の直近の記録を、古い順に番号で置く。
   サイトの判断は B の中心で行うので、ここ（判断の根拠）にだけ出す。正式な値（全射の A）は 分析 > 着弾 にある */
const SIGHT_DRIFT_MAX = 8;
function sightCentreRows(sess) {
  return sessionsByDateDesc()
    .filter((s) => (s.setupId || "") === (sess.setupId || "") && s.dist === sess.dist && s.faceD === sess.faceD && (s.faceType || "single") === (sess.faceType || "single") && (s.date || "") <= (sess.date || "") && sessionHasPos(s))
    .slice(0, SIGHT_DRIFT_MAX)
    .map((s) => {
      const st = sightStats(sessionMetrics(s).st);
      return st && st.n >= 3 && Number.isFinite(st.mx) && Number.isFinite(st.my) ? { s, mx: st.mx, my: st.my, n: st.n } : null;
    })
    .filter(Boolean)
    .reverse();
}
function sightCentreDriftHtml(sess) {
  const rows = sightCentreRows(sess);
  if (rows.length < 2) return "";
  const w = ringW(sess.faceD, sess.faceType);
  /* 点が重ならないよう、いちばん外の中心が枠の 7割に来る倍率にする（リング幅の円は、枠に入るときだけ描く） */
  const span = Math.max(w / 4, ...rows.map((r) => Math.max(Math.abs(r.mx), Math.abs(r.my)))) / 0.7;
  const S = 200, c = S / 2, k = (c - 14) / span;
  const X = (v) => (c + v * k).toFixed(1), Yp = (v) => (c - v * k).toFixed(1);
  const path = rows.map((r, i) => `${i ? "L" : "M"}${X(r.mx)} ${Yp(r.my)}`).join("");
  const dots = rows
    .map((r, i) => {
      const last = i === rows.length - 1;
      return `<circle cx="${X(r.mx)}" cy="${Yp(r.my)}" r="${last ? 5 : 3.5}" fill="var(${last ? "--accent" : "--surface"})" stroke="var(${last ? "--accent" : "--ink"})" stroke-width="1.5"/><text x="${(+X(r.mx) + 7).toFixed(1)}" y="${(+Yp(r.my) - 5).toFixed(1)}" font-size="13" font-weight="${last ? 700 : 400}" fill="var(--ink)">${i + 1}</text>`;
    })
    .join("");
  return `<div class="sightDrift" data-testid="sight-centre-drift">
    <p class="fact">外れ値候補を除いた中心（${esc(sess.dist)}m・${esc(faceLabel(sess))}・直近 ${rows.length}回）</p>
    <svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="外れ値候補を除いた中心の位置。古い順に 1 から ${rows.length} の番号"><rect x="1" y="1" width="${S - 2}" height="${S - 2}" fill="none" stroke="var(--rule)"/><path d="M${c} 6V${S - 6}M6 ${c}H${S - 6}" stroke="var(--rule-strong)" stroke-width="1"/>${w <= span ? `<circle cx="${c}" cy="${c}" r="${(w * k).toFixed(1)}" fill="none" stroke="var(--rule-strong)" stroke-dasharray="3 3"/>` : ""}<path d="${path}" fill="none" stroke="var(--sub)" stroke-width="1"/>${dots}</svg>
    <p class="basis">十字が的の中心。枠の端は中心から ${span.toFixed(1)}cm です（リング幅は ${w.toFixed(1)}cm${w <= span ? "。破線の円の半径" : ""}）。番号は古い順で、塗った点がこの記録です。</p>
    <table class="tbl sightDriftTbl"><tr><th>番号・日付</th><th>左右</th><th>上下</th><th>射数</th></tr>${rows.map((r, i) => `<tr><td>${i + 1}・${esc(fmtMD(r.s.date) || "日付なし")}</td><td>${sightOffsetWord(r.mx, "h")}</td><td>${sightOffsetWord(r.my, "v")}</td><td>${r.n}</td></tr>`).join("")}</table>
    <p class="basis">正式な集計（全射）は 分析 &gt; 着弾 にあります。ここは、サイトの判断に使う値（外れ値候補を除く）です。</p>
  </div>`;
}
function sightAdviceHtml(sess, setup, adv, opts) {
  const o = opts || {};
  const md = sightAdviceModel(sess, setup, adv);
  if (!md) return "";
  const d = md.d, ss = md.ss;
  const fig = (a) => `<div class="fig" data-axis="${a.key}" data-state="${a.state}"><div class="l">${a.name}</div><div class="n sightAdvN">${esc(a.big)}</div><div class="d">着弾中心 ${sightOffsetWord(a.m, a.key)}</div></div>`;
  const nText = md.excluded ? `位置のある ${md.total}射のうち、外れ値候補 ${md.excluded}射を除いた ${ss.n}射` : `位置のある ${ss.n}射`;
  const basis = [];
  basis.push("同時の検定で 5% 未満になり、その方向の 95%区間が 0 を含まず、補正量がリング幅の 1/10 以上のときだけ「動かす」としています。");
  [md.h, md.v].forEach((a) => {
    if (a.state === "move" || (a.state === "hold" && a.amount)) {
      const conv = a.clickKind === "set" ? `登録した換算（70m で 1クリック = ${esc(a.key === "v" ? setup.calibV70 : setup.calibH70)}cm）` : a.clickKind === "est" ? "過去の記録から推定した 1目盛りの大きさ" : `アイ〜サイト距離 ${db.settings.eyeSight || 850}mm と弾道の計算`;
      basis.push(`${a.name}の量は、ずれ ${Math.abs(a.m).toFixed(1)}cm から誤差の分を差し引いた ${a.adj.toFixed(1)}cm${a.clicks != null ? `（サイトで約 ${a.mm.toFixed(1)}mm）` : ""}を、${conv}で換算した値です。`);
    }
    if (a.state === "open") basis.push(`${a.name}は 95%区間（±${a.ci.toFixed(1)}cm）がリング幅の半分（${(d.w / 2).toFixed(1)}cm）より広く、中心がまだ定まっていません。`);
  });
  if (md.h.state === "hold" || md.v.state === "hold") {
    if (md.j && md.j.label === "保留" && adv.personal && Number.isFinite(adv.personal.mx))
      basis.push(`同じサイト値の過去 ${adv.personal.sample}回の中心（${sightOffsetWord(adv.personal.mx, "h")}・${sightOffsetWord(adv.personal.my, "v")}）と今回の向きが逆のため、保留としています。`);
    else if (d.windAccounted) basis.push(`横風の記録があり、推定の横流れ ${Math.abs(d.windCm).toFixed(1)}cm を左右の誤差に加えています。風上へねらいを直したかどうかは記録に無いため、左右は保留としています。`);
    else basis.push("風の記録があり、左右のずれに風の影響が含まれる可能性があるため、左右は保留としています。");
  } else if (d.windAccounted) basis.push(`横風の記録があるため、推定の横流れ ${Math.abs(d.windCm).toFixed(1)}cm を左右の誤差に加えています。`);
  else if (d.windUnknown) basis.push("風向の記録がないため、風の横流れは見込んでいません。");
  if (sess.sightV || sess.sightH) basis.push(`この記録のサイト値は 上下 ${esc(sightValueText(sess.sightV))}・左右 ${esc(sightValueText(sess.sightH))} です。`);
  return `<div class="sightAdvice" data-testid="sight-advice">
    <div class="figs two">${fig(md.h)}${fig(md.v)}</div>
    <p class="fact" data-testid="sight-advice-fact">着弾中心は ${sightOffsetWord(ss.mx, "h")}・${sightOffsetWord(ss.my, "v")} です（${nText}）。95%区間は 左右 ±${d.h.ci.toFixed(1)}cm・上下 ±${d.v.ci.toFixed(1)}cm、中心が的の中心にあるとしたときにこれだけずれる確率は ${fmtChance(d.test.p)} です。</p>
    <p class="basis" data-testid="sight-advice-basis">${basis.join("")}</p>
    ${o.drift === false ? "" : sightCentreDriftHtml(sess)}
  </div>`;
}
/* 計算の内訳（折りたたみ）: 弾道の前提、同じサイト値の過去の記録、サイト値とずれの回帰、履歴からの換算。数値と件数だけを書く */
function sightBasisRowsHtml(sess, setup, adv, sid, dist) {
  const rows = [];
  const row = (k, v, sub) => rows.push(`<div class="lrow sightBasisRow"><span class="lk">${k}</span><span class="lv">${v}${sub ? `<small>${sub}</small>` : ""}</span></div>`);
  if (adv && adv.traj) {
    const ph = adv.traj.phys;
    row("初速", `${ph.speedFps.toFixed(0)}fps`, ph.measuredSpeed ? "実測の入力" : "弓具の入力からの推定");
    row("矢の重さ", `${ph.massGr.toFixed(0)}グレイン`, `飛行時間 ${adv.traj.tof.toFixed(2)}秒`);
  }
  if (adv && adv.personal && adv.personal.sample >= 2 && Number.isFinite(adv.personal.mx))
    row("同じサイト値の過去の中心", `${sightOffsetWord(adv.personal.mx, "h")}・${sightOffsetWord(adv.personal.my, "v")}`, `${adv.personal.sample}回の記録`);
  const reg = sid ? regressionAdvice(sid, dist) : {};
  [["v", "上下"], ["h", "左右"]].forEach(([k, name]) => {
    const r = reg[k];
    if (r) row(`ずれが 0 になる${name}の値`, r.zero.toFixed(1), `サイト値とずれの回帰・${r.n}回・決定係数 ${pct(r.r2 || 0)}`);
  });
  const pc = sid ? personalPhysicsCalibration(sid) : null;
  if (pc && pc.click && (pc.click.v70 || pc.click.h70))
    row("履歴から推定した 1目盛り（70m）", `${pc.click.v70 ? `上下 ${pc.click.v70.toFixed(1)}cm` : ""}${pc.click.v70 && pc.click.h70 ? "・" : ""}${pc.click.h70 ? `左右 ${pc.click.h70.toFixed(1)}cm` : ""}`, `サイト値 ${pc.sight.n}点・有効な練習 ${pc.usable}回`);
  return rows.join("");
}
function renderSight(m) {
  if (!ui.sightSel.setupId && db.setups[0]) ui.sightSel.setupId = db.setups[0].id;
  if (ui.sightSel.setupId && !db.setups.some((x) => x.id === ui.sightSel.setupId)) ui.sightSel.setupId = db.setups[0] ? db.setups[0].id : null;
  const sid = ui.sightSel.setupId;
  const setup = db.setups.find((x) => x.id === sid);
  if (!setup) {
    m.innerHTML = `<div class="sightView"><div class="empty" data-testid="sight-empty"><b>セッティングがありません</b>サイト台帳はセッティングごとに分かれます。先に「セッティング」で登録してください。</div>${sightRecordsOverviewHtml(sid)}</div>`;
    return;
  }
  // 距離候補: 台帳・セッションにある距離 + 定番
  const dset = new Set([70, 50, 30, 18]);
  db.sightMarks.filter((x) => x.setupId === sid).forEach((x) => dset.add(x.dist));
  db.sessions.filter((x) => x.setupId === sid).forEach((x) => dset.add(x.dist));
  const dists = [...dset].sort((a, b) => b - a);
  if (!dists.includes(ui.sightSel.dist)) ui.sightSel.dist = dists[0];
  const dist = ui.sightSel.dist;
  const marks = db.sightMarks
    .filter((x) => x.setupId === sid && x.dist === dist)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.ts || 0) - (a.ts || 0));
  /* 最新の記録（同じセッティング・距離）。位置のある矢が1本もない記録（点数だけの入力）は着弾中心を出せないので、その前の記録を使う */
  const lastSess = sessionsByDateDesc().find((s) => s.setupId === sid && s.dist === dist && sessionHasPos(s));
  const adv = lastSess ? adviceFor(lastSess, setup) : null;
  const interp = sightInterp(sid);
  const rows = sightDistRows(sid, dists, interp);
  const scale = sightScaleSvg(rows);
  const hasAnySess = db.sessions.some((s) => s.setupId === sid && s.dist === dist);
  const adviceEmpty = !lastSess
    ? hasAnySess
      ? "着弾データなし。この距離の練習は点数だけの記録のため、着弾中心からの目安は出せません。"
      : "この距離の練習の記録がないため、着弾中心からの目安は出せません。"
    : "位置のある矢が 3射に満たないため、目安は出していません。";
  const basisRows = sightBasisRowsHtml(lastSess, setup, adv, sid, dist);
  m.innerHTML = `<div class="sightView">
  <div class="cond one"><label><span>セッティング</span><select class="pick" id="sgSetup" data-testid="sight-setup">${db.setups.map((s) => `<option value="${esc(s.id)}" ${s.id === sid ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label></div>
  <section class="vsec sightLedgerSec" data-testid="sight-ledger-section">
    <div class="vsecH"><h2>サイト台帳</h2><span class="aside">上下の値・距離を押して選ぶ</span></div>
    <div class="sightGrid${scale ? "" : " noScale"}">
      ${scale ? `<div class="sightScaleCol">${scale}</div>` : ""}
      <div><div id="sgDistChips" role="group" aria-label="距離">${rows.map((r) => sightDistRowHtml(r, r.dist === dist)).join("")}</div>
      ${sightHorizontalNoteHtml(rows)}
      ${scale ? `<p class="basis">図の実線は実測、破線は予測です。</p>` : `<p class="basis">上下を数値で記録すると、目盛りの図に並びます。</p>`}</div>
    </div>
    <div class="btnRow"><button type="button" class="btn pri" id="sgAdd" data-testid="sight-add" aria-label="${esc(dist)}m のサイト値を記録">サイト値を記録</button><button type="button" class="btn sec" id="sgCalMode" data-testid="sight-calibrate">校正する</button></div>
  </section>
  <section class="vsec" data-testid="sight-dist-records">
    <div class="vsecH"><h2>${esc(dist)}m の記録</h2><span class="aside">${marks.length}件・新しい順</span></div>
    ${marks.length ? sightLedgerHtml(marks) : `<p class="basis" data-testid="sight-ledger-empty">この距離の記録はまだありません。</p>`}
  </section>
  <section class="vsec" data-testid="sight-advice-section">
    <div class="vsecH"><h2>調整の目安</h2><span class="aside">${adv ? `${esc(dist)}m・${fmtMDW(lastSess.date)}の記録` : `${esc(dist)}m`}</span></div>
    ${adv ? sightAdviceHtml(lastSess, setup, adv) : `<p class="basis" data-testid="sight-advice-empty">${adviceEmpty}</p>`}
    ${basisRows ? `<details class="gearMore" data-testid="sight-basis-fold"><summary>計算の内訳</summary>${basisRows}<p class="basis">弾道は 3次元の空気抵抗つきの数値計算（RK4）です。未入力の項目は一般的な値で代用しています。</p></details>` : ""}
    <details class="gearMore" data-testid="sight-click-fold">
      <summary>クリック換算の設定</summary>
      <div class="row">
        <div><label class="f" for="sgCalV">上下 1クリックで動く量 (cm・70m)</label><input class="inp" id="sgCalV" inputmode="decimal" value="${esc(setup.calibV70 || "")}" placeholder="例: 4"></div>
        <div><label class="f" for="sgCalH">左右 1クリックで動く量 (cm・70m)</label><input class="inp" id="sgCalH" inputmode="decimal" value="${esc(setup.calibH70 || "")}" placeholder="例: 4"></div>
      </div>
      <p class="basis">サイトを 1クリック動かしたとき、70m で着弾が動く量です。入れると、目安をクリック数で出します（ほかの距離へは距離の比で換算）。未入力のときは mm で出します。アイ〜サイト距離は 設定 &gt; 記録 にあります。</p>
    </details>
  </section>
  ${interp ? sightPredictionHtml(interp, db.sightMarks.filter((mk) => mk.setupId === sid)) : `<section class="vsec" data-testid="sight-prediction-empty"><div class="vsecH"><h2>記録していない距離の予測</h2></div><p class="basis">上下を数値で記録した距離が 2つ以上あると、ほかの距離の値を計算します。</p></section>`}
  ${sightRecordsOverviewHtml(sid)}
  </div>`;
  const sgSetup = $("#sgSetup");
  if (sgSetup)
    sgSetup.onchange = (e) => {
      ui.sightSel.setupId = e.target.value;
      render();
    };
  document.querySelectorAll("#sgDistChips [data-d]").forEach(
    (c) =>
      (c.onclick = () => {
        const hadFocus = !!(
          document.activeElement &&
          document.activeElement.closest &&
          document.activeElement.closest("#sgDistChips")
        );
        ui.sightSel.dist = +c.dataset.d;
        render();
        if (hadFocus) {
          const chip = document.querySelector(`#sgDistChips [data-d="${c.dataset.d}"]`);
          if (chip) chip.focus({ preventScroll: true });
        }
      }),
  );
  const add = $("#sgAdd");
  if (add) add.onclick = () => openMarkForm(sid, dist);
  const calMode = $("#sgCalMode");
  if (calMode) calMode.onclick = () => openCalibrationWizard(sid);
  document.querySelectorAll("[data-del]").forEach(
    (b) =>
      (b.onclick = async () => {
        const mk = db.sightMarks.find((x) => x.id === b.dataset.del);
        if (await appConfirm("このサイト値をゴミ箱へ移しますか？", { danger: true, okLabel: "ゴミ箱へ移す" })) {
          if (mk) trashItem("sightMark", `${mk.dist}m サイト値`, mk);
          db.sightMarks = db.sightMarks.filter((x) => x.id !== b.dataset.del);
          save({ reason: "delete-sight-mark", forceSnapshot: true });
          render();
          toast("ゴミ箱へ移しました。設定 > データ のゴミ箱から元に戻せます", 4000);
        }
      }),
  );
  const cv = $("#sgCalV"),
    ch = $("#sgCalH");
  if (cv)
    cv.onchange = (e) => {
      setup.calibV70 = parseFloat(e.target.value) || null;
      save();
      render();
    };
  if (ch)
    ch.onchange = (e) => {
      setup.calibH70 = parseFloat(e.target.value) || null;
      save();
      render();
    };
}
function openMarkForm(setupId, dist) {
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  ovl.innerHTML = `<div class="sheet"><h3>サイト値を記録（${dist}m）</h3>
    <label class="f">日付</label><input class="inp" type="date" id="mkDate" value="${today()}">
    <div class="row">
      <div><label class="f">上下</label><input class="inp" id="mkV" inputmode="decimal"></div>
      <div><label class="f">左右</label><input class="inp" id="mkH" inputmode="decimal"></div>
    </div>
    <label class="f" for="mkNote">メモ</label><input class="inp" id="mkNote" placeholder="例: 無風・36射で確認">
    <div class="btnrow"><button class="btn ghost" id="mkCancel">キャンセル</button><button class="btn" id="mkSave">保存</button></div>
  </div>`;
  openModal(ovl, { escapeTarget: "#mkCancel" });
  ovl.querySelector("#mkCancel").onclick = () => closeModal(ovl);
  ovl.querySelector("#mkSave").onclick = () => {
    db.sightMarks.push({
      id: uid(),
      setupId,
      dist,
      v: ovl.querySelector("#mkV").value.trim(),
      h: ovl.querySelector("#mkH").value.trim(),
      date: ovl.querySelector("#mkDate").value || today(),
      ts: Date.now(),
      note: ovl.querySelector("#mkNote").value.trim(),
    });
    save();
    closeModal(ovl);
    render();
    toast("台帳に記録しました");
  };
}
function openCalibrationWizard(setupId) {
  const setup = db.setups.find((s) => s.id === setupId);
  if (!setup) {
    toast("セッティングを選んでください");
    return;
  }
  const dists = [70, 50, 30, 18];
  const ovl = document.createElement("div");
  ovl.className = "ovl";
  ovl.innerHTML = `<div class="sheet" data-testid="sight-calibration"><h3>校正する（${esc(setup.name)}）</h3>
    <p class="basis">実射で確かめた距離だけ入れてください。入れた値は、この日付の記録として台帳に追加します（前の記録は残ります）。欄には、いまの台帳の最新の値を入れてあります。</p>
    <label class="f">日付</label><input class="inp" type="date" id="calDate" value="${today()}">
    ${dists
      .map((d) => {
        const mk = latestMark(setupId, d) || {};
        return `<div class="row">
        <div><label class="f">${d}m 上下</label><input class="inp" id="calV_${d}" inputmode="decimal" value="${esc(mk.v === 0 ? 0 : mk.v || "")}"></div>
        <div><label class="f">${d}m 左右</label><input class="inp" id="calH_${d}" inputmode="decimal" value="${esc(mk.h === 0 ? 0 : mk.h || "")}"></div>
      </div>`;
      })
      .join("")}
    <label class="f" for="calNote">メモ</label><input class="inp" id="calNote" placeholder="例: 無風・70m は 36射で確認">
    <div class="btnrow"><button class="btn ghost" id="calCancel">キャンセル</button><button class="btn" id="calSave">台帳に記録</button></div>
  </div>`;
  openModal(ovl, { escapeTarget: "#calCancel" });
  ovl.querySelector("#calCancel").onclick = () => closeModal(ovl);
  ovl.querySelector("#calSave").onclick = () => {
    const date = ovl.querySelector("#calDate").value || today();
    const note = ovl.querySelector("#calNote").value.trim() || "校正";
    let n = 0;
    dists.forEach((d) => {
      const v = ovl.querySelector(`#calV_${d}`).value.trim(),
        h = ovl.querySelector(`#calH_${d}`).value.trim();
      if (v || h) {
        db.sightMarks.push({ id: uid(), setupId, dist: d, v, h, date, ts: Date.now(), note });
        n++;
      }
    });
    if (!n) {
      toast("1つ以上入力してください");
      return;
    }
    save({ reason: "calibration", forceSnapshot: true });
    closeModal(ovl);
    render();
    toast(`${n}距離の値を台帳に記録しました`);
  };
}

/* ---------- 弓具 ---------- */
