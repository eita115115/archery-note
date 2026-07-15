"use strict";
/* Archery Note: 分析コア（純関数のみ）
   ここの関数は db / ui / DOM を参照せず、引数だけに依存する。
   単位: 座標・半径・ズレは cm、得点は点、距離は m。 */

/* セッション配列を分析用の正規化行へ変換する。metricsFn には sessionMetrics を渡す
   （テストでは robustStats ベースの代替を注入できる） */
function buildAnalysisRows(sessions, setups, metricsFn) {
  const byId = {};
  (setups || []).forEach((s) => {
    if (s && s.id) byId[s.id] = s;
  });
  return (sessions || [])
    .map((s) => {
      if (!s || !Array.isArray(s.ends)) return null;
      const m = metricsFn(s);
      const setup = s.setupId ? byId[s.setupId] || null : null;
      const distNum = Number(s.dist);
      return {
        s,
        id: s.id || "",
        date: s.date || "",
        setupId: s.setupId || "",
        setupName: setup ? setup.name || "" : "",
        dist: Number.isFinite(distNum) && distNum > 0 ? distNum : null,
        faceD: s.faceD,
        faceType: s.faceType || "single",
        round: s.round || "free",
        roundGroup: s.roundGroup || null,
        n: m.all.length,
        total: m.total,
        avg: m.avg,
        st: m.st,
      };
    })
    .filter(Boolean);
}

/* フィルタ: setupId（"__none"=用具未指定のみ）/ dist / round / period("all"|"3m"|"1m")
   period 判定には filter.today（"YYYY-MM-DD"）が必要 */
function filterAnalysisRows(rows, filter) {
  const f = filter || {};
  let minDate = "";
  const dayWindows = { "7d": 7, "30d": 30, "90d": 90 };
  if (f.today && dayWindows[f.period]) {
    const d = new Date(f.today + "T00:00:00Z");
    if (Number.isFinite(d.getTime())) {
      d.setUTCDate(d.getUTCDate() - (dayWindows[f.period] - 1));
      minDate = d.toISOString().slice(0, 10);
    }
  }
  if (f.today && (f.period === "3m" || f.period === "1m")) {
    const d = new Date(f.today + "T00:00:00");
    if (Number.isFinite(d.getTime())) {
      d.setMonth(d.getMonth() - (f.period === "3m" ? 3 : 1));
      minDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  return (rows || []).filter(
    (r) =>
      (!f.setupId || (f.setupId === "__none" ? !r.setupId : r.setupId === f.setupId)) &&
      (!f.dist || String(r.dist) === String(f.dist)) &&
      (!f.round || r.round === f.round) &&
      (!minDate || (r.date && r.date >= minDate)),
  );
}

function validGrowthRows(rows) {
  return (rows || [])
    .filter((r) => r && r.n > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(r.date || "")))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
}

/* Read-only growth summary. Deltas compare the latest practice with the previous
   practice, so the result remains meaningful for beginners at any absolute level. */
function growthDashboard(rows, todayIso) {
  const sorted = validGrowthRows(rows),
    latest = sorted[sorted.length - 1] || null,
    prev = sorted[sorted.length - 2] || null;
  const todayDate = new Date(String(todayIso || "") + "T00:00:00Z");
  const day = Number.isFinite(todayDate.getTime()) ? (todayDate.getUTCDay() + 6) % 7 : 0;
  if (Number.isFinite(todayDate.getTime())) todayDate.setUTCDate(todayDate.getUTCDate() - day);
  const weekStart = Number.isFinite(todayDate.getTime())
    ? todayDate.toISOString().slice(0, 10)
    : "";
  const week = sorted.filter((r) => !weekStart || r.date >= weekStart);
  const recent = sorted.slice(-5),
    recentArrows = recent.reduce((n, r) => n + r.n, 0);
  const recentAverage = recentArrows
    ? recent.reduce((n, r) => n + r.total, 0) / recentArrows
    : null;
  const grouping = recent.filter((r) => r.st && Number.isFinite(r.st.rr));
  const confidenceValue = Math.min(
    1,
    Math.max(0, (recent.length / 5) * 0.55 + (Math.min(recentArrows, 60) / 60) * 0.45),
  );
  return {
    lastPracticeDate: latest ? latest.date : null,
    weekSessions: week.length,
    weekArrows: week.reduce((n, r) => n + r.n, 0),
    recentAverage,
    scoreDelta:
      latest && prev && Number.isFinite(latest.avg) && Number.isFinite(prev.avg)
        ? latest.avg - prev.avg
        : null,
    groupingDelta:
      latest &&
      prev &&
      latest.st &&
      prev.st &&
      Number.isFinite(latest.st.rr) &&
      Number.isFinite(prev.st.rr)
        ? latest.st.rr - prev.st.rr
        : null,
    formStability:
      latest && latest.s && Number.isFinite(Number(latest.s.formStability))
        ? Number(latest.s.formStability)
        : null,
    confidence: {
      value: confidenceValue,
      label: confidenceValue >= 0.75 ? "高" : confidenceValue >= 0.45 ? "中" : "参考",
    },
    groupingSamples: grouping.length,
  };
}

/* Deterministic, evidence-bearing practice suggestions. No diagnosis is made;
   each rule names only the recorded pattern that triggered it. */
function nextPracticeSuggestions(rows, todayIso) {
  const sorted = validGrowthRows(rows),
    latest = sorted[sorted.length - 1];
  if (!latest)
    return [
      {
        id: "collect-baseline",
        title: "まず1回記録する",
        reason: "比較できる練習記録がまだありません。",
      },
    ];
  const out = [],
    st = latest.st || {};
  if (Number.isFinite(st.sy) && Number.isFinite(st.sx) && st.sy >= st.sx * 1.3) {
    out.push({
      id: "vertical-spread",
      title: "上下のまとまりを確認",
      reason: `最新記録は上下±${st.sy.toFixed(1)}cmで、左右±${st.sx.toFixed(1)}cmより広がっています。`,
    });
  } else if (Number.isFinite(st.sx) && Number.isFinite(st.sy) && st.sx >= st.sy * 1.3) {
    out.push({
      id: "horizontal-spread",
      title: "左右のまとまりを確認",
      reason: `最新記録は左右±${st.sx.toFixed(1)}cmで、上下±${st.sy.toFixed(1)}cmより広がっています。`,
    });
  }
  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2];
    if (Number.isFinite(latest.avg) && Number.isFinite(prev.avg) && latest.avg < prev.avg - 0.2)
      out.push({
        id: "score-drop",
        title: "前回と同じ条件で短く確認",
        reason: `1本平均が前回より${(prev.avg - latest.avg).toFixed(2)}点下がっています。`,
      });
  }
  const now = new Date(String(todayIso || "") + "T00:00:00Z"),
    last = new Date(latest.date + "T00:00:00Z");
  const gap = (now - last) / 86400000;
  if (Number.isFinite(gap) && gap >= 7)
    out.push({
      id: "practice-gap",
      title: "軽い確認練習から再開",
      reason: `最後の記録から${Math.floor(gap)}日空いています。`,
    });
  if (!out.length)
    out.push({
      id: "repeat-baseline",
      title: "同じ条件でもう1回記録",
      reason: "大きな変化は未検出です。同条件の記録を増やすと比較の信頼度が上がります。",
    });
  return out.slice(0, 3);
}

/* ISO週キー "YYYY-Www"。不正な日付は "" */
function isoWeekKey(dateIso) {
  const d = new Date(String(dateIso || "") + "T00:00:00Z");
  if (!Number.isFinite(d.getTime())) return "";
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/* 週("week")または月("month")バケットで回数・本数・平均点・平均RMS・最高合計を集計 */
function aggregateByPeriod(rows, unit) {
  const by = new Map();
  (rows || []).forEach((r) => {
    if (!r || !r.date) return;
    const key = unit === "week" ? isoWeekKey(r.date) : r.date.slice(0, 7);
    if (!key) return;
    const g = by.get(key) || {
      key,
      sessions: 0,
      arrows: 0,
      total: 0,
      best: null,
      rrSum: 0,
      rrCount: 0,
    };
    g.sessions++;
    g.arrows += r.n || 0;
    g.total += r.total || 0;
    if (r.n && (!g.best || r.total > g.best.total))
      g.best = { total: r.total, date: r.date, arrows: r.n };
    if (r.st && Number.isFinite(r.st.rr)) {
      g.rrSum += r.st.rr;
      g.rrCount++;
    }
    by.set(key, g);
  });
  return [...by.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((g) => ({
      key: g.key,
      sessions: g.sessions,
      arrows: g.arrows,
      avg: g.arrows ? g.total / g.arrows : null,
      avgRms: g.rrCount ? g.rrSum / g.rrCount : null,
      best: g.best,
    }));
}

/* 単純移動平均。先頭 k 未満はそこまでの平均。非数値は 0 扱いにせず null を返す */
function movingAverage(values, k) {
  const win = Math.max(1, k || 5);
  const vals = (values || []).map(Number);
  const out = [];
  let sum = 0,
    bad = 0;
  for (let i = 0; i < vals.length; i++) {
    if (Number.isFinite(vals[i])) sum += vals[i];
    else bad++;
    if (i >= win) {
      if (Number.isFinite(vals[i - win])) sum -= vals[i - win];
      else bad--;
    }
    const len = Math.min(i + 1, win);
    out.push(bad > 0 ? null : sum / len);
  }
  return out;
}

/* (round×距離) ごとの自己ベスト（最高合計・最高平均とその日付） */
function personalBests(rows) {
  const by = new Map();
  (rows || []).forEach((r) => {
    if (!r || !r.n) return;
    const key = [r.round, r.dist == null ? "" : r.dist].join("|");
    const g = by.get(key) || {
      round: r.round,
      dist: r.dist,
      sessions: 0,
      bestTotal: null,
      bestAvg: null,
    };
    g.sessions++;
    if (
      !g.bestTotal ||
      r.total > g.bestTotal.total ||
      (r.total === g.bestTotal.total && r.date > g.bestTotal.date)
    ) {
      g.bestTotal = { total: r.total, arrows: r.n, date: r.date };
    }
    if (!g.bestAvg || r.avg > g.bestAvg.avg) {
      g.bestAvg = { avg: r.avg, arrows: r.n, date: r.date };
    }
    by.set(key, g);
  });
  return [...by.values()].sort(
    (a, b) =>
      (b.dist == null ? -1 : b.dist) - (a.dist == null ? -1 : a.dist) || b.sessions - a.sessions,
  );
}

/* 多距離ラウンド集計（IMP-09）: roundGroup 付きの行を gid で束ね、1グループ=ラウンド1回分にする。
   roundGroup の無い行（従来セッション）は集計に含めない。
   stages は roundGroup.stage 昇順、date はグループ内の最も早い日付、
   complete は stageCount 分の「異なる stage」が揃っているか（同 stage の重複行では完了扱いにしない） */
function aggregateRoundGroups(rows) {
  const by = new Map();
  (rows || []).forEach((r) => {
    const rg = r && r.roundGroup;
    if (!rg || !rg.gid) return;
    const g = by.get(rg.gid) || {
      gid: rg.gid,
      roundId: rg.roundId || "",
      date: "",
      stageCount: 0,
      items: [],
    };
    if (!g.roundId && rg.roundId) g.roundId = rg.roundId;
    const sc = Number(rg.stageCount);
    if (Number.isFinite(sc) && sc > g.stageCount) g.stageCount = sc;
    if (r.date && (!g.date || r.date < g.date)) g.date = r.date;
    const st = Number(rg.stage);
    g.items.push({
      stage: Number.isFinite(st) ? st : 0,
      dist: r.dist,
      total: r.total || 0,
      n: r.n || 0,
    });
    by.set(rg.gid, g);
  });
  return [...by.values()]
    .map((g) => {
      const items = g.items.slice().sort((a, b) => a.stage - b.stage);
      return {
        gid: g.gid,
        roundId: g.roundId,
        date: g.date,
        stages: items.map((it) => ({ dist: it.dist, total: it.total, n: it.n })),
        total: items.reduce((a, it) => a + it.total, 0),
        arrows: items.reduce((a, it) => a + it.n, 0),
        complete: g.stageCount > 0 && new Set(items.map((it) => it.stage)).size === g.stageCount,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* roundId ごとの自己ベスト: complete なグループのみ対象。同点は新しい日付を採用 */
function roundGroupBests(groups) {
  const by = new Map();
  (groups || []).forEach((g) => {
    if (!g || !g.complete || !g.roundId) return;
    const cur = by.get(g.roundId);
    if (!cur || g.total > cur.total || (g.total === cur.total && g.date > cur.date)) {
      by.set(g.roundId, { roundId: g.roundId, total: g.total, arrows: g.arrows, date: g.date });
    }
  });
  return [...by.values()];
}

/* 風あり/なしの成績比較。isWindyFn にはアプリの isWindy を注入する */
function conditionSplit(rows, isWindyFn) {
  const make = (label) => ({
    label,
    sessions: 0,
    arrows: 0,
    total: 0,
    rrSum: 0,
    rrCount: 0,
    mxSum: 0,
    mxCount: 0,
  });
  const windy = make("風あり"),
    calm = make("風なし・弱風");
  (rows || []).forEach((r) => {
    if (!r) return;
    const g = isWindyFn(r.s) ? windy : calm;
    g.sessions++;
    g.arrows += r.n || 0;
    g.total += r.total || 0;
    if (r.st && Number.isFinite(r.st.rr)) {
      g.rrSum += r.st.rr;
      g.rrCount++;
    }
    if (r.st && Number.isFinite(r.st.mx)) {
      g.mxSum += r.st.mx;
      g.mxCount++;
    }
  });
  const fin = (g) => ({
    label: g.label,
    sessions: g.sessions,
    arrows: g.arrows,
    avg: g.arrows ? g.total / g.arrows : null,
    avgRms: g.rrCount ? g.rrSum / g.rrCount : null,
    biasX: g.mxCount ? g.mxSum / g.mxCount : null,
  });
  return { windy: fin(windy), calm: fin(calm) };
}

/* 「今日の結論」1文を選ぶ。新しい統計計算はしない — 既存の analysisKpiHtml / groupingTrendItem が
   使っているのと同じ値（scored行の avg・移動平均・robustStats の rr/mx/my）だけを読み、
   意味を日本語1文へ言い換えるだけの純関数。db/DOM 非依存、rows は buildAnalysisRows の出力。
   戻り値: {kind, text} kind は表示側の見た目分岐用（テストでも確認する） */
function todayConclusion(rows) {
  const scored = (rows || []).filter((r) => r && r.n && r.st);
  // しきい値1: 判定に十分なセッション数（2回未満は傾向を語れない = データ不足扱い）
  const MIN_SESSIONS = 2;
  if (scored.length < MIN_SESSIONS) {
    return { kind: "few", text: "記録を数回続けると、今日の一言がここに出ます。" };
  }
  const sorted = [...scored].sort(
    (a, b) => (a.date || "").localeCompare(b.date || "") || (a.id > b.id ? 1 : -1),
  );
  const latest = sorted[sorted.length - 1];

  // グルーピング（矢の集まり）判定: 最新RMSと全体平均RMSを比較する
  const rrRows = sorted.filter((r) => r.st && Number.isFinite(r.st.rr));
  const latestRr = latest.st && Number.isFinite(latest.st.rr) ? latest.st.rr : null;
  const avgRr = rrRows.length ? rrRows.reduce((a, r) => a + r.st.rr, 0) / rrRows.length : null;
  // しきい値2: 最新RMSが全体平均より 0.3cm 以上締まっていれば「安定/締まってきた」扱い
  const RR_TIGHT_DELTA = 0.3;
  const groupingTight = latestRr != null && avgRr != null && avgRr - latestRr >= RR_TIGHT_DELTA;
  // しきい値3: 中心オフセットが 1.0cm 以上ズレていれば「まだ中心が寄っている」扱い
  const OFFSET_THRESHOLD = 1.0;
  const mx = latest.st && Number.isFinite(latest.st.mx) ? latest.st.mx : 0;
  const my = latest.st && Number.isFinite(latest.st.my) ? latest.st.my : 0;
  const offCenter = Math.max(Math.abs(mx), Math.abs(my)) >= OFFSET_THRESHOLD;
  if (groupingTight && offCenter) {
    const dir = Math.abs(my) >= Math.abs(mx) ? (my > 0 ? "上" : "下") : mx > 0 ? "右" : "左";
    const axisWord = Math.abs(my) >= Math.abs(mx) ? "上下" : "左右";
    return {
      kind: "grouping-tight-offcenter",
      text: `グルーピング安定、${axisWord}のズレ（${dir}寄り）だけ直しましょう。`,
    };
  }

  // 平均点の調子判定: analysisKpiHtml と同じ移動平均（直近5回）と同じ横ばいしきい値(0.02)を使う
  const ma = movingAverage(
    sorted.map((r) => r.avg),
    5,
  );
  const latestMa = ma.length ? ma[ma.length - 1] : null;
  const prevMa = ma.length > 1 ? ma[ma.length - 2] : null;
  const delta = latestMa != null && prevMa != null ? latestMa - prevMa : null;
  const TREND_FLAT = 0.02;
  if (delta != null && delta > TREND_FLAT) {
    return { kind: "trend-up", text: `平均点が上向き、この調子を続けましょう。` };
  }
  if (delta != null && delta < -TREND_FLAT) {
    return { kind: "trend-down", text: `平均点がやや下がり気味、本数を安定させましょう。` };
  }
  if (groupingTight) {
    return { kind: "grouping-tight", text: "グルーピングは安定、この調子を保ちましょう。" };
  }
  return { kind: "steady", text: "崩れなく安定して練習できています。" };
}

/* arrow.reason タグ別の本数・平均点・平均ズレ方向(cm) */
function reasonBreakdown(rows) {
  const by = new Map();
  let tagged = 0;
  (rows || []).forEach((r) => {
    if (!r || !r.s || !Array.isArray(r.s.ends)) return;
    r.s.ends.forEach((end) =>
      (Array.isArray(end) ? end : []).forEach((a) => {
        if (!a || !a.reason) return;
        tagged++;
        const g = by.get(a.reason) || { reason: a.reason, count: 0, total: 0, xSum: 0, ySum: 0 };
        g.count++;
        g.total += Number.isFinite(Number(a.s)) ? Number(a.s) : 0;
        if (Number.isFinite(a.x)) g.xSum += a.x;
        if (Number.isFinite(a.y)) g.ySum += a.y;
        by.set(a.reason, g);
      }),
    );
  });
  return {
    tagged,
    items: [...by.values()]
      .sort((a, b) => b.count - a.count)
      .map((g) => ({
        reason: g.reason,
        count: g.count,
        avg: g.count ? g.total / g.count : null,
        mx: g.count ? g.xSum / g.count : null,
        my: g.count ? g.ySum / g.count : null,
      })),
  };
}
