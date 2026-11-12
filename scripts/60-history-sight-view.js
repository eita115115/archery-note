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
  /* 距離・用具・ラウンドは練習だけが持つ条件。どれかを選ぶと、メモだけの項目は外れる */
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
        if (!restoreTrash(b.dataset.restoreTrash)) return;
        closeModal(ovl);
        render();
        if ((db.trash || []).length) openTrashSheet();
        toast("元に戻しました");
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
function groupingTrendCard(ss) {
  const by = {};
  const recent = ss.slice(0, 120);
  [...recent].reverse().forEach((s) => {
    const p = sessionGroupPoint(s);
    if (!p) return;
    const key = [p.setupId, p.dist, p.faceD, p.faceType].join("|");
    (by[key] = by[key] || []).push(p);
  });
  const groups = Object.values(by)
    .filter((g) => g.length >= 2)
    .sort((a, b) => (b[b.length - 1].date || "").localeCompare(a[a.length - 1].date || ""))
    .slice(0, 4);
  if (!groups.length) return "";
  return (
    `<div class="card"><h2>矢の集まり具合の推移 <span class="mini">過去の中心の分布と偏移</span></h2>` +
    groups.map((g) => groupingTrendItem(g)).join("") +
    `<div class="hint">丸は各練習のグルーピング（矢の集まり）中心、線は時系列、緑の楕円は過去中心の分布です。的の中心からどちらへ偏り続けているか、直近でどちらへ流れているかを見るための俯瞰です。</div></div>`
  );
}
function groupingTrendItem(g) {
  const latest = g[g.length - 1],
    first = g[0],
    prev = g[g.length - 2];
  const centers = g.map((p) => ({ x: p.mx, y: p.my }));
  const cst = groupStats(centers);
  const w = ringW(latest.faceD, latest.faceType);
  const maxAbs = Math.max(
    w * 2.6,
    ...g.map((p) => Math.max(Math.abs(p.mx) + p.rr * 0.25, Math.abs(p.my) + p.rr * 0.25)),
    Math.abs(cst.mx) + (cst.major || 0) * 1.6,
    Math.abs(cst.my) + (cst.major || 0) * 1.6,
    4,
  );
  const M = Math.min((latest.faceD / 2) * 0.9, maxAbs * 1.25);
  const path = g.map((p, i) => `${i ? "L" : "M"}${p.mx},${-p.my}`).join("");
  const avgRr = g.reduce((a, p) => a + p.rr, 0) / g.length;
  const recentDx = latest.mx - prev.mx,
    recentDy = latest.my - prev.my;
  const allDx = latest.mx - first.mx,
    allDy = latest.my - first.my;
  const bias = Math.hypot(latest.mx, latest.my);
  const biasState = bias <= w * 0.25 ? "センター付近" : bias <= w * 0.75 ? "軽い偏り" : "偏り強め";
  const setup = esc(latest.setupName);
  return `<div class="histRecentBlock">
    <div class="histRecentHead">
      <svg viewBox="${-M} ${-M} ${2 * M} ${2 * M}" class="histRecentTarget">
        <circle cx="0" cy="0" r="${w / 2}" fill="none" stroke="var(--sub)" stroke-width="${M / 140}"/>
        <circle cx="0" cy="0" r="${w}" fill="none" stroke="var(--line)" stroke-width="${M / 160}"/>
        <line x1="${-M}" y1="0" x2="${M}" y2="0" stroke="var(--line)" stroke-width="${M / 150}"/>
        <line x1="0" y1="${-M}" x2="0" y2="${M}" stroke="var(--line)" stroke-width="${M / 150}"/>
        ${cst && cst.major != null ? `<ellipse cx="${cst.mx}" cy="${-cst.my}" rx="${Math.max(cst.major, 0.18)}" ry="${Math.max(cst.minor, 0.18)}" transform="rotate(${-cst.angleDeg} ${cst.mx} ${-cst.my})" fill="var(--status-ok)" fill-opacity="0.10" stroke="var(--status-ok)" stroke-width="${M / 95}"/>` : ""}
        <path d="${path}" fill="none" stroke="var(--blue)" stroke-width="${M / 75}" stroke-linecap="round" stroke-linejoin="round"/>
        ${g
          .map((p, i) => {
            const r = i === g.length - 1 ? M / 18 : M / 25;
            const fill = i === g.length - 1 ? "var(--status-ok)" : "var(--blue)";
            return `<circle cx="${p.mx}" cy="${-p.my}" r="${r}" fill="${fill}" opacity="${0.35 + (i / g.length) * 0.55}" stroke="#fff" stroke-width="${M / 120}"/>`;
          })
          .join("")}
      </svg>
      <div class="histRecentBody">
        <div class="t histRecentTitle">${setup} ・ ${historyDistanceLabel(latest.dist)} ・ ${esc(faceLabel(latest))}</div>
        <div class="d">${g.length}回 / ${fmtD(first.date)}〜${fmtD(latest.date)} / 平均の集まり半径(RMS) ${avgRr.toFixed(1)}cm</div>
        <div class="kv"><span>最新の中心</span><span>${cmOffsetText(latest.mx, "x")} / ${cmOffsetText(latest.my, "y")}（${biasState}）</span></div>
        <div class="kv"><span>前回から</span><span>${driftText(recentDx, recentDy)}</span></div>
        <div class="kv"><span>初回から</span><span>${driftText(allDx, allDy)}</span></div>
        <div class="kv"><span>過去中心の広がり</span><span>${cst.rr.toFixed(1)}cm${cst.major != null ? ` / 長軸${cst.major.toFixed(1)}cm` : ""}</span></div>
      </div>
    </div>
  </div>`;
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
    `<div class="card"><h2>得点の内訳 <span class="mini">全${count}本</span></h2>` +
    keys
      .filter((k) => cnt[k] > 0 || (!fieldOnly && ["X", "10", "9", "8", "7"].includes(k)))
      .map((k) => {
        const sNum = k === "X" ? 10 : k === "M" ? 0 : +k;
        const z = zoneStyle(sNum, k === "X", firstFace[k]);
        const n = cnt[k] || 0;
        return `<div class="histScoreRow">
        <div class="histScoreLabel" style="background:${z.bg};color:${z.fg}">${k}</div>
        <div class="histScoreTrack"><div class="histScoreFill" style="width:${((n / max) * 100).toFixed(1)}%"></div></div>
        <div class="histScoreCount">${n}本 (${((n / count) * 100).toFixed(0)}%)</div>
      </div>`;
      })
      .join("") +
    `</div>`
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
    `<div class="card"><h2>月ごとのまとめ <span class="mini">点/本</span></h2><table class="tbl"><tr><th>月</th><th class="right">練習</th><th class="right">本数</th><th class="right">平均点</th></tr>` +
    keys
      .map(
        (k) =>
          `<tr><td>${k.replace("-", "/")}</td><td class="right">${m[k].c}回</td><td class="right">${m[k].n}本</td><td class="right"><b>${m[k].n ? (m[k].sum / m[k].n).toFixed(2) : "-"}</b></td></tr>`,
      )
      .join("") +
    `</table></div>`
  );
}
function distTrendCard(ss) {
  // 距離別 平均点推移（簡易スパークライン）
  const byDist = {};
  [...ss].reverse().forEach((s) => {
    const all = s.ends.flat();
    if (!all.length) return;
    const info = {
      key: `dist:${historyDistanceLabel(s.dist)}`,
      label: historyDistanceLabel(s.dist),
      sort: Number(s.dist) || -1,
    };
    const g = (byDist[info.key] = byDist[info.key] || {
      label: info.label,
      sort: info.sort,
      pts: [],
    });
    g.pts.push(all.reduce((a, x) => a + x.s, 0) / all.length);
  });
  const groups = Object.values(byDist)
    .filter((g) => g.pts.length >= 2)
    .sort((a, b) => b.sort - a.sort || a.label.localeCompare(b.label));
  if (!groups.length) return "";
  return (
    `<div class="card"><h2>距離ごとの調子 <span class="mini">平均点(点/本)の推移</span></h2>` +
    groups
      .map((g) => {
        const pts = g.pts;
        const W = 300,
          H = 46;
        const min = Math.min(...pts),
          max = Math.max(...pts),
          span = max - min || 1;
        const path = pts
          .map(
            (v, i) =>
              `${i ? "L" : "M"}${(i / (pts.length - 1)) * W},${H - 4 - ((v - min) / span) * (H - 10)}`,
          )
          .join("");
        return `<div class="histTrendRow">
      <div class="histTrendLabel">${esc(g.label)}</div>
      <svg width="100%" viewBox="0 0 ${W} ${H}" class="histTrendChart" style="max-height:${H}px" role="img" aria-label="${esc(g.label)}の平均点（点/本）推移"><title>${esc(g.label)}: ${pts.length}回、最新${pts[pts.length - 1].toFixed(2)}点/本</title><path d="${path}" fill="none" stroke="var(--green)" stroke-width="2.5"/>
      ${pts.map((v, i) => `<circle cx="${(i / (pts.length - 1)) * W}" cy="${H - 4 - ((v - min) / span) * (H - 10)}" r="3" fill="var(--green)"/>`).join("")}</svg>
      <div class="histTrendValue"><b>${pts[pts.length - 1].toFixed(2)}</b><span class="histTrendSub">点/本 · 最新</span></div>
    </div>`;
      })
      .join("") +
    `</div>`
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
    <details class="adv summaryDetails histDetailNumbers" data-testid="history-detail-numbers">
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
      ${detailNumbersHtml}
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
  bindNoteTags(ovl, sess, () => {
    edited = true;
    scheduleSave("note-tags");
  });
  const close = () => {
    syncNote();
    flushPendingSave();
    closeModal(ovl);
    if (edited) render();
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
    if (view === "analysis") render();
    else showView("analysis");
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
  bindNoteTags(ovl, note, () => changed("memo-tags"));
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
    if (edited) render();
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
  return `<section class="sightPrediction" data-testid="sight-prediction">
    <h2><span class="h2Icon">${icon("ruler")} サイトマーク予測（上下）</span></h2>
    <div class="sightPredictionMeta">${interp.model === "physics" ? `弾道モデル（初速 ${Math.round(interp.speedFps)}fps・${interp.speedSource === "measured" ? "実測" : interp.speedSource === "fitted" ? "台帳から推定" : "用具から推定"}）` : "直線近似"} ・ 一致度${pct(interp.r2 || 0)} ・ 上下の目盛り</div>
    ${predictions.length ? `<dl class="sightPredictionRows">${predictions.map((d) => `<div data-predict-dist="${d}"><dt>${d}m <span>予測</span></dt><dd>${interp.est(d).toFixed(1)}<small>目盛り</small></dd></div>`).join("")}</dl>` : `<div class="hint">定番距離（18/30/50/70m）はすべて実測済みです</div>`}
    <details class="sightSources"><summary>採用した実測 ${interp.pts.length}件</summary><ul class="sightSourceList">${sources}</ul></details>
    <details class="sightPredictionHelp"><summary>予測の見方</summary><p>上下が数値で入力された記録から予測します。新しい記録の上下が未入力なら、以前の数値を使います。</p><p>2距離以上で、矢の弾道（重力・空気抵抗・目と矢と的の高低差）から計算した照準角にサイト値を当てはめます。5距離以上で、初速を変えた方が統計的に有意に当てはまる場合は、初速も台帳から推定します。左右は予測しません。</p></details>
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
          <button class="btn sm ghost histDelBtn" type="button" data-del="${esc(mk.id)}" aria-label="${esc(date)}のサイト値を削除">${icon("del")}</button>
        </div>
        <dl class="sightMarkValues"><div><dt>上下</dt><dd>${esc(value(mk.v))}</dd></div><div><dt>左右</dt><dd>${esc(value(mk.h))}</dd></div></dl>
        ${mk.note ? `<details class="sightMarkNote"><summary>メモ</summary><p>${esc(mk.note)}</p></details>` : ""}
      </li>`;
    })
    .join("")}</ol>`;
}
function renderSight(m) {
  if (!ui.sightSel.setupId && db.setups[0]) ui.sightSel.setupId = db.setups[0].id;
  const sid = ui.sightSel.setupId;
  const setup = db.setups.find((x) => x.id === sid);
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
  const cur = marks[0];
  // 最新セッション（同setup×距離）
  /* 位置のある矢が1本もない記録（点数だけの入力）は着弾傾向を出せないので、その前の記録を使う */
  const lastSess = [...db.sessions]
    .reverse()
    .find((s) => s.setupId === sid && s.dist === dist && sessionHasPos(s));
  const adv = lastSess ? adviceFor(lastSess, setup) : null;
  const reg = sid ? regressionAdvice(sid, dist) : {};
  const interp = sid ? sightInterp(sid) : null;
  const cal = sid ? calibrationProfile(sid) : null;
  const interpHtml = interp ? sightPredictionHtml(interp, db.sightMarks.filter((mk) => mk.setupId === sid)) : "";
  m.innerHTML = `${pageHeroHtml("sight", { setup, dist, marks, adv, lastSess })}
  <div class="card">
    <h2><span class="h2Icon">${icon("ledger")} サイト台帳</span></h2>
    ${
      db.setups.length
        ? `
    <label class="f">セッティング</label><select class="inp" id="sgSetup">${db.setups.map((s) => `<option value="${esc(s.id)}" ${s.id === sid ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
    <label class="f">距離</label>
    <div class="chips" id="sgDistChips">${dists.map((d) => `<button type="button" class="chip ${d === dist ? "on" : ""}" aria-pressed="${d === dist}" data-d="${d}">${d}m</button>`).join("")}</div>
    <div class="btnrow"><button class="btn sec sm" id="sgAdd">＋ このサイト値を台帳に記録</button><button class="btn sec sm" id="sgCalMode">校正モード</button></div>
    ${
      marks.length
        ? sightLedgerHtml(marks)
        : `<div class="empty">この距離の記録はまだありません</div>`
    }
    `
        : `<div class="empty">先に「弓具」タブの「セッティング」で登録してください。<br>サイト台帳はセッティングごとに管理されます。</div>`
    }
  </div>
  ${
    setup
      ? `
  <div class="card">
    <h2><span class="h2Icon">${icon("tool")} 詳しく</span> <span class="mini">${dist}m ・ ${esc(setup.name)}</span></h2>
    ${
      adv
        ? `<div class="subNote">最新の練習（${fmtD(lastSess.date)}・${adv.st.n}本${adv.st.excluded.length ? `、外れ値候補${adv.st.excluded.length}本はサイト判断から除く` : ""}）の着弾傾向：</div>`
        : `<div class="empty">${!lastSess && db.sessions.some((s) => s.setupId === sid && s.dist === dist) ? "着弾データなし。この距離の練習は点数だけの記録のため、着弾傾向からの提案はできません。" : "この距離の練習記録がまだないため、着弾傾向からの提案はできません。"}</div>`
    }
    <details class="adv" ${adv ? "" : "open"}>
      <summary>調整アドバイスの全体像</summary>
      ${
        adv
          ? `<div class="advice">${adv.lines.map((l) => `<div class="dir">${l.html}</div>`).join("")}
      ${judgementHtml(adv, lastSess)}
      ${shapeNote(adv.st)}
      ${adv.notes.map((n) => `<div class="note">・${n}</div>`).join("")}
      <div class="note">原則：<b>矢の集まった方向へサイトを動かす</b>。サイト判断の中心 ${cmOffsetText(sightStats(adv.st).mx, "x")} / ${cmOffsetText(sightStats(adv.st).my, "y")}${adv.st.excluded.length ? `（外れ値候補${adv.st.excluded.length}本を除く）` : ""}・全射の半径 ${adv.st.rr.toFixed(1)}cm</div></div>`
          : ""
      }
    </details>
    <details class="adv">
      <summary>判断の根拠</summary>
      ${adv ? trustHtml(lastSess, setup, adv.st) : ""}
      ${adv ? personalModelHtml(adv, lastSess, setup) : ""}
      ${adv ? conditionHtml(lastSess, adv.st, setup) : ""}
      ${adv ? nextActionHtml(lastSess, adv, setup) : ""}
    </details>
    <details class="adv">
      <summary>サイト値分析・予測</summary>
      ${
        reg.v || reg.h
          ? `<div class="advice">
        <div class="subNote">${icon("ruler")} 過去データの相関分析（サイト値 × 着弾ズレ の回帰）</div>
        ${reg.v ? `<div class="dir">上下サイトの推定最適値：<b>${reg.v.zero.toFixed(1)}</b> <span class="subNoteSm">(${reg.v.n}回分 / 一致度${pct(reg.v.r2 || 0)} / 品質${pct(reg.v.quality || 0)})</span></div>` : ""}
        ${reg.h ? `<div class="dir">左右サイトの推定最適値：<b>${reg.h.zero.toFixed(1)}</b> <span class="subNoteSm">(${reg.h.n}回分 / 一致度${pct(reg.h.r2 || 0)} / 品質${pct(reg.h.quality || 0)})</span></div>` : ""}
        <div class="note">サイト値を数値で記録した複数回の練習から「ズレが0になる値」を、練習信頼度・風・本数を加味した外れ値に強い推定で求めています。データが増えるほど精度が上がります。</div>
      </div>`
          : `<div class="hint">${icon("bulb")} 練習開始時にサイト値を<b>数値で</b>入力して回数を重ねると、ここに「サイト値と着弾ズレの相関」から推定した最適サイト値が表示されます。</div>`
      }
      ${interpHtml}
    </details>
    <details class="adv">
      <summary>モデル診断・校正状況</summary>
      ${
        cal
          ? `<div class="advice histAdviceCard mt10">
        <div class="kv"><span>個人補正データ</span><span><b>${cal.level}</b>（${Math.round(cal.score * 100)}%）</span></div>
        <div class="note">実測サイト距離 ${cal.dists}距離 / サイト値つき練習 ${cal.withSight}回 / 用具入力 ${cal.gearLevel}</div>
        ${cal.next.length ? `<div class="note">次に精度へ効く項目: ${esc(cal.next.slice(0, 3).join("・"))}</div>` : `<div class="note">個人補正に必要な主要データはかなり揃っています。</div>`}
      </div>`
          : ""
      }
      ${modelReadinessHtml(sid)}
      ${physicsCalibrationHtml(sid)}
    </details>
    <details class="adv">
      <summary>クリック換算の設定（任意）</summary>
      <div class="row">
        <div><label class="f">上下 1クリック=cm @70m</label><input class="inp" id="sgCalV" inputmode="decimal" value="${setup.calibV70 || ""}" placeholder="例: 4"></div>
        <div><label class="f">左右 1クリック=cm @70m</label><input class="inp" id="sgCalH" inputmode="decimal" value="${setup.calibH70 || ""}" placeholder="例: 4"></div>
      </div>
      <div class="hint">「サイトを1クリック動かすと70mで着弾が何cm動くか」。一度測って登録すると提案がクリック数でも出ます（他の距離へは自動換算）。アイ〜サイト距離は右上の設定から。</div>
    </details>
  </div>`
      : ""
  }`;
  const sgSetup = $("#sgSetup");
  if (sgSetup)
    sgSetup.onchange = (e) => {
      ui.sightSel.setupId = e.target.value;
      render();
    };
  document.querySelectorAll("#sgDistChips .chip[data-d]").forEach(
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
        if (await appConfirm("この記録を削除しますか？", { danger: true, okLabel: "削除" })) {
          if (mk) trashItem("sightMark", `${mk.dist}m サイト値`, mk);
          db.sightMarks = db.sightMarks.filter((x) => x.id !== b.dataset.del);
          save({ reason: "delete-sight-mark", forceSnapshot: true });
          render();
          toast("削除しました。設定から復元できます");
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
    <label class="f">メモ</label><input class="inp" id="mkNote" placeholder="例: 無風・ベスト調整">
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
  ovl.innerHTML = `<div class="sheet"><h3>校正モード — ${esc(setup.name)}</h3>
    <div class="hint">実測できている距離だけ入力してください。複数距離が揃うほど、距離別サイト予測と個人補正が強くなります。</div>
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
    <label class="f">メモ</label><input class="inp" id="calNote" placeholder="例: 校正日 / 無風 / ベスト確認">
    <div class="btnrow"><button class="btn ghost" id="calCancel">キャンセル</button><button class="btn" id="calSave">校正値を保存</button></div>
  </div>`;
  openModal(ovl, { escapeTarget: "#calCancel" });
  ovl.querySelector("#calCancel").onclick = () => closeModal(ovl);
  ovl.querySelector("#calSave").onclick = () => {
    const date = ovl.querySelector("#calDate").value || today();
    const note = ovl.querySelector("#calNote").value.trim() || "校正モード";
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
    toast(`${n}距離の校正値を保存しました`);
  };
}

/* ---------- 用具 ---------- */
