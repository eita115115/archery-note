# Field Instrument UI統合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Record開始画面を、ターゲット中心・条件ログ・静かな開始の3方向を統合した、鮮やかで統一感のあるiPhone-first UIへ更新する。

**Architecture:** 既存の \`renderRecord()\`、イベントID、\`data-testid\`、ローカルDB、採点処理を保持し、表示用の小さなHTMLヘルパーと静的CSSだけを更新する。ターゲットプレビューは既存の \`targetMarkup()\` を表示専用に再利用し、選択変更時に同じDOM領域を再描画する。履歴・分析・サイト・用具はこの基盤を使う別タスクへ分離する。

**Tech Stack:** Vanilla JavaScript、既存の \`style.css\` / \`style.min.css\`、Playwright smoke/E2E、既存のNodeチェック。

## Global Constraints

- 採点、線切り、矢印円半径、保存／復元、バックアップ／インポート、Service Worker、PWA更新、バージョン、依存関係は変更しない。
- 既存の \`#quickStart\`、\`#quickHistory\`、\`#fStart\`、\`#fDistChips\`、\`#fFace\`、\`#fArrows\`、\`#fSetup\` と関連 \`data-testid\` を維持する。
- 金色の塗り、グラデーション、ガラス面、pill、999pxの角丸、カード内カードを追加しない。金は2px以下の線・ドット・小面積の文字色だけにする。
- タップ領域は44px以上、本文は14–16px、ラベルは11–12px、角丸は6pxまたは8px、縦リズムは8pxの倍数にする。
- ターゲットの青・赤・黄はデータ色として残し、鮮やかさはターゲットと緑／青緑の状態色で出す。CTAは墨面＋白文字のままにする。
- \`prefers-reduced-motion\` の既存挙動を壊さず、追加モーションは因果・状態のフィードバックだけにする。
- 変更はクリーンな \`codex/ui-field-instrument\` ワークツリー内で行い、既存のメイン作業ツリーの未コミット変更をステージしない。

## Files and Responsibilities

- Modify: \`scripts/50-record-view.js\` — Record開始の表示構造、表示専用ターゲットプレビュー、前回操作の静かな表示。イベント契約と保存処理は維持する。
- Modify: \`style.css\` — Record開始用の静的レイアウト、色、余白、フォーカス、狭幅対応。既存の共通トークンを再利用する。
- Generate: \`style.min.css\` — \`npm run build:web-assets\` で \`style.css\` から生成する。
- Modify: \`tools/check-ui.js\` — Record開始の構造・アクセシビリティ・主CTA一つの静的回帰ガード。
- Verify only: \`tests/\`、既存E2Eシナリオ — 既存の開始／距離変更／的変更／本数変更／詳細／前回操作を壊していないことを確認する。

## Task 1: 回帰ガードを先に追加する

**Files:**
- Modify: \`tools/check-ui.js\`（\`recordSurface\` に対する静的チェックの近く）
- Test: \`npm run check:ui\`

**Interfaces:**
- Consumes: \`scripts/50-record-view.js\` のRecord開始HTML文字列。
- Produces: 実装前には失敗し、実装後にはターゲットプレビュー、主CTA、条件レールの契約を固定するチェック。

- [ ] **Step 1: 実装前のベースラインを確認する**

\`\`\`powershell
Set-Location 'C:\\Users\\eita2\\Projects\\archery-note\\.worktrees\\ui-field-instrument'
npm run check:ui
\`\`\`

Expected: 現行ブランチの \`UI smoke checks OK\`。この時点では新しいアサーションはまだない。

- [ ] **Step 2: 新しい構造アサーションを追加する**

\`staticUiChecks()\` 内のRecord面チェック付近に、次のアサーションを追加する。

\`\`\`js
  assert(
    recordSurface.includes('data-testid="record-target-preview"') &&
      recordSurface.includes('role="img"') &&
      recordSurface.includes('id="recordTargetPreview"') &&
      recordSurface.includes('id="record-start"') &&
      recordSurface.includes('data-testid="record-condition-rail"'),
    "record start surface must expose a named target preview, one primary start CTA, and a condition rail",
  );
  assert(
    (recordSurface.match(/data-testid="record-start"/g) || []).length === 1 &&
      recordSurface.includes('id="quickStart"') &&
      recordSurface.includes('id="quickHistory"'),
    "record start surface must have exactly one primary start CTA while preserving quick actions",
  );
\`\`\`

- [ ] **Step 3: 新しいチェックが現行コードで失敗することを確認する**

\`\`\`powershell
npm run check:ui
\`\`\`

Expected: FAIL with the new \`record start surface must expose a named target preview, one primary start CTA, and a condition rail\` message。失敗を確認してから実装へ進む。

- [ ] **Step 4: 回帰ガードだけをコミットする**

\`\`\`powershell
git add tools/check-ui.js
git commit -m "test(ui): guard field instrument record start structure"
\`\`\`

## Task 2: Record開始HTMLを3方向の統合構造へ置き換える

**Files:**
- Modify: \`scripts/50-record-view.js:118-175\` — 表示専用ヘルパーと前回操作。
- Modify: \`scripts/50-record-view.js:495-570\` — \`renderRecord()\` の開始面。
- Test: \`tools/check-ui.js\` のTask 1アサーション、既存Recordイベント。

**Interfaces:**
- Consumes: \`last\`、\`defSetup\`、\`defDist\`、\`defFace\`、\`defPerEnd\`、\`mode\`、\`targetMarkup()\`、\`recordSetupSnapshot()\`、既存のDOM ID。
- Produces: \`data-testid="record-target-preview"\` を持つ表示専用ターゲット、\`data-testid="record-condition-rail"\` の条件値、\`#fStart\`だけが主CTAの開始面、既存イベントに再接続された \`updateRecordTargetPreview()\`。

- [ ] **Step 1: 表示専用ターゲットプレビューのヘルパーを追加する**

\`recordSetupSnapshot()\` の直前に、次の関数を追加する。 \`parseFaceChoice()\` と \`targetMarkup()\` は既存関数を再利用し、計算や保存を行わない。

\`\`\`js
function recordTargetPreviewHtml(faceValue, dist) {
  const face = parseFaceChoice(faceValue);
  const label = \`\${dist || "—"}m・\${actionFaceLabel(faceValue)}の的\`;
  return \`<div class="recordTargetPreview" id="recordTargetPreview" data-testid="record-target-preview" role="img" aria-label="\${esc(label)}">
    \${targetMarkup(face.faceD, "recordPreview", face.faceType)}
  </div>\`;
}
\`\`\`

\`role="img"\` はターゲットの操作を開始しないプレビューに限定し、\`aria-label\` は現在の距離・的を反映する。

- [ ] **Step 2: 前回操作を静かな1行へ整理する**

\`recordFastActionsHtml()\` の返却HTMLを次の契約にする。 \`#quickStart\` と \`#quickHistory\` は残し、黒い2分割CTAは作らない。

\`\`\`js
  return \`<section class="recordQuickBar" aria-label="すぐ使う">
    <button class="recordQuickRepeat" id="quickStart" type="button">
      <span class="repeatEyebrow">\${esc(lastTitle)}</span>
      <b id="quickStartMeta">\${esc(currentLabel)}</b>
      <span class="repeatSub">\${esc(lastLabel)}</span>
    </button>
    <button class="recordQuickHistory" id="quickHistory" type="button" aria-label="履歴と分析を開く">履歴・分析&nbsp;→</button>
  </section>\`;
\`\`\`

初回（\`!last\`）は従来どおり空文字を返し、開始面の主CTAだけを表示する。

- [ ] **Step 3: \`renderRecord()\` の静的順序を置き換える**

\`m.innerHTML\` を次の順序にする。フォームの各ID、選択肢、詳細項目、校正モードの文言は現行をそのまま引き継ぐ。

\`\`\`js
  m.innerHTML = \`
  \${recordFastActionsHtml(last, defDist, defFace)}
  <section class="recordStartSurface" data-testid="record-start-surface">
    <div class="recordStartKicker">\${mode === "calibration" ? "サイト値を残す" : "記録を開始"}</div>
    <div class="recordStartTitleRow">
      <h2>\${mode === "calibration" ? "サイト値つきで始める" : "今日の射ちを記録する"}</h2>
      <button class="tinyAction" id="jumpGear" type="button">用具</button>
    </div>
    \${recordTargetPreviewHtml(defFace, defDist)}
    <div class="recordConditionRail" data-testid="record-condition-rail" aria-label="開始条件">
      <div class="recordConditionField">
        <label class="f" for="fDistChips">距離</label>
        <div class="chips quickDists" id="fDistChips">
          \${[70, 50, 30, 18].map((d) => \`<button type="button" class="chip \${d === defDist ? "on" : ""}" aria-pressed="\${d === defDist}" data-d="\${d}">\${d}m</button>\`).join("")}
          <button type="button" class="chip" aria-pressed="false" data-d="custom">カスタム</button>
        </div>
      </div>
      <div class="recordConditionPair">
        <div><label class="f" for="fFace">的</label><select class="inp" id="fFace">
          <optgroup label="ターゲット">
            \${[122, 80, 60, 40].map((f) => \`<option value="\${f}" \${String(defFace) === String(f) ? "selected" : ""}>\${f}cm</option>\`).join("")}
            <option value="T40" \${defFace === "T40" ? "selected" : ""}>40cm 三つ目（縦）</option>
          </optgroup>
          <optgroup label="フィールド">
            \${FIELD_FACE_SIZES.map((f) => \`<option value="F\${f}" \${defFace === \`F\${f}\` ? "selected" : ""}>\${f}cm フィールド</option>\`).join("")}
          </optgroup>
        </select></div>
        <div><label class="f" for="fArrows">1エンドの本数</label><select class="inp" id="fArrows">\${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => \`<option value="\${n}" \${n === defPerEnd ? "selected" : ""}>\${n}本</option>\`).join("")}</select></div>
      </div>
    </div>
    <div class="recordStartAction">
      <button class="btn startPrimary" id="fStart" data-testid="record-start">\${mode === "calibration" ? "サイト値つきで開始" : "この条件で開始"}</button>
    </div>
    <div class="sessionCondition">\${recordSetupSnapshot(defSetup, defDist)}</div>
    <details class="adv recordDetails" \${mode === "calibration" ? "open" : ""}>
      <summary>詳しく残す</summary>
      <div class="fieldBand">
        <div><label class="f">用具セッティング</label><select class="inp" id="fSetup">\${setupOptions(defSetup)}</select></div>
      </div>
      <label class="f">日付</label><input class="inp" type="date" id="fDate" value="\${today()}">
      <label class="f">ラウンド</label><select class="inp" id="fRound">
        \${ROUND_TYPES.map((r) => \`<option value="\${r.id}">\${r.label}</option>\`).join("")}
        <optgroup label="多距離ラウンド">
          \${multiRoundDefs().map((r) => \`<option value="\${esc(r.id)}">\${esc(r.label)}</option>\`).join("")}
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
        <input class="inp" id="fNote" placeholder="\${mode === "calibration" ? "例: サイト1目盛り確認" : "メモ（任意）"}" value="\${mode === "calibration" ? "サイト値確認" : ""}">
      </div>
      <div class="row">
        <div><label class="f">風向</label><select class="inp" id="fWindDir"><option value="">—</option><option>向かい風</option><option>追い風</option><option>左から</option><option>右から</option><option>巻き風</option></select></div>
        <div><label class="f">風速 (m/s)</label><input class="inp" id="fWindSpeed" inputmode="decimal" placeholder="例: 2.5"></div>
      </div>
    </details>
  </section>\`;
\`\`\`

距離チップ、的選択肢、本数選択肢、校正文言、詳細フィールドは上記の式をそのまま使用する。実装時は既存イベントが参照するIDを変えず、外側のラッパーとclassだけを移動する。 \`featureHintHtml()\` は開始面の下へ置くか、既存の返却位置を維持してもよいが、主CTAと同格の面にしない。

- [ ] **Step 4: プレビュー更新を既存イベントへ接続する**

\`renderRecord()\` 内に次の関数を追加し、\`faceSel.onchange\`、距離チップのクリック処理、カスタム距離入力の変更処理の末尾から呼び出す。

\`\`\`js
  function updateRecordTargetPreview() {
    const host = $("#recordTargetPreview");
    if (!host || !faceSel) return;
    const face = parseFaceChoice(faceSel.value);
    host.setAttribute("aria-label", \`\${distState.d || "—"}m・\${actionFaceLabel(faceSel.value)}の的\`);
    host.innerHTML = targetMarkup(face.faceD, "recordPreview", face.faceType);
  }
\`\`\`

距離チップの既存処理で \`distState.d\` を更新した後に \`updateRecordTargetPreview()\` を呼ぶ。 \`#fStart\` の作成、\`db.active\`、\`save()\`、採点関数は変更しない。

- [ ] **Step 5: 構造チェックを通す**

\`\`\`powershell
npm run check:ui
npm run check:app
\`\`\`

Expected: Task 1のアサーションを含めて PASS。失敗時はイベントIDとテンプレートの閉じタグだけを確認し、ロジックを変更しない。

- [ ] **Step 6: 構造変更をコミットする**

\`\`\`powershell
git add scripts/50-record-view.js
git commit -m "feat(ui): unify record start around target and conditions"
\`\`\`

## Task 3: Field Instrumentの静的CSSと鮮やかさを実装する

**Files:**
- Modify: \`style.css\`（Record開始用の既存セレクタと近接する範囲）
- Generate: \`style.min.css\`
- Test: \`npm run build:web-assets\`、\`npm run check:ui\`

**Interfaces:**
- Consumes: Task 2の \`.recordStartSurface\`、\`.recordTargetPreview\`、\`.recordConditionRail\`、\`.recordQuickBar\`、\`.recordQuickRepeat\`、\`.recordQuickHistory\`、\`.recordStartAction\`。
- Produces: 390px／360px／デスクトップで同じ視線順になる静的レイアウト。色と角丸を既存トークンに限定する。

- [ ] **Step 1: 前回操作を静かなバーへ置換する**

\`style.css\` に次を追加し、既存の強い \`.recordRepeatBand\` / \`.repeatMain\` の表示を新クラスで上書きする。

\`\`\`css
.recordQuickBar{
  display:flex; align-items:center; gap:12px; margin:0 0 16px;
  border-bottom:1px solid var(--line2); padding:0 0 10px;
}
.recordQuickRepeat{
  min-height:48px; flex:1; min-width:0; padding:7px 0; border:0;
  background:transparent; color:var(--ink); text-align:left; cursor:pointer;
}
.recordQuickRepeat .repeatEyebrow{display:block; color:var(--sub); font-size:11px; letter-spacing:.08em;}
.recordQuickRepeat b{display:block; margin-top:2px; color:var(--ink); font-size:15px; font-variant-numeric:tabular-nums;}
.recordQuickRepeat .repeatSub{display:block; margin-top:2px; color:var(--sub); font-size:11px;}
.recordQuickHistory{
  min-height:44px; padding:8px 0; border:0; background:transparent;
  color:var(--sub); font-size:12px; white-space:nowrap; cursor:pointer;
}
.recordQuickRepeat:focus-visible,.recordQuickHistory:focus-visible{outline:2px solid var(--accent); outline-offset:3px;}
\`\`\`

- [ ] **Step 2: ターゲットを視覚アンカーにする**

\`\`\`css
.recordStartSurface{border-top:2px solid var(--accent); padding-top:16px; margin-bottom:24px;}
.recordStartKicker{font-size:11px; letter-spacing:.12em; color:var(--sub);}
.recordStartTitleRow{display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:8px;}
.recordStartTitleRow h2{margin:0; color:var(--ink); font-size:20px; line-height:1.25; font-weight:var(--fw-emphasis);}
.recordTargetPreview{display:grid; place-items:center; min-height:214px; margin:16px 0; background:var(--target-surface-a); border:1px solid var(--line2); border-radius:8px; overflow:hidden;}
.recordTargetPreview svg.main{width:min(100%,210px); height:210px; display:block;}
.recordConditionRail{border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:12px 0;}
.recordConditionField .f,.recordConditionPair .f{margin-top:0;}
.recordConditionPair{display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;}
.recordStartAction{margin-top:16px;}
.recordStartAction .startPrimary{min-height:56px;}
.recordStartSurface .sessionCondition{margin-top:12px;}
\`\`\`

背景面を増やさず、ターゲットのデータ色だけを鮮やかに見せる。CTAは既存の墨面を再利用し、金色背景を作らない。

- [ ] **Step 3: 狭幅とテーマを定義する**

\`\`\`css
@media (max-width:360px){
  .recordStartTitleRow h2{font-size:18px;}
  .recordTargetPreview{min-height:184px; margin:12px 0;}
  .recordTargetPreview svg.main{width:180px; height:180px;}
  .recordConditionPair{grid-template-columns:1fr;}
  .recordQuickBar{gap:8px;}
  .recordQuickHistory{font-size:11px;}
}
html.dark .recordTargetPreview,html.auto .recordTargetPreview{background:var(--target-surface-b);}
\`\`\`

既存のdark/auto変数を再利用し、\`body\`の強制ズーム禁止やユーザー選択制御は変更しない。

- [ ] **Step 4: CSSを生成して静的チェックを通す**

\`\`\`powershell
npm run build:web-assets
npm run check:ui
git diff --check
\`\`\`

Expected: \`Web assets ready\`、\`UI smoke checks OK\`、diff checkは無出力。

- [ ] **Step 5: CSS変更をコミットする**

\`\`\`powershell
git add style.css style.min.css
git commit -m "style(ui): sharpen field instrument record surface"
\`\`\`

## Task 4: 実機に近い幅で検証する

**Files:**
- Verify: \`scripts/50-record-view.js\`, \`style.css\`, \`style.min.css\`
- Artifacts: \`artifacts/ui-smoke/iphone-390.png\`, \`artifacts/ui-smoke/small-360.png\`, \`artifacts/ui-smoke/desktop-1280.png\`

**Interfaces:**
- Consumes: Task 2–3のRecord開始面。
- Produces: レイアウト崩れ、CTA競合、既存イベント破壊がないことの証拠。

- [ ] **Step 1: UI smokeを実行する**

\`\`\`powershell
npm run check:ui
\`\`\`

Expected: 390×844、360×780、1280×800のPNGが生成され、\`UI smoke checks OK\`。

- [ ] **Step 2: E2Eと全体チェックを実行する**

\`\`\`powershell
npm run test:e2e
npm run check:all
npm run lint
\`\`\`

Expected: 既存E2E、全チェック、lintがすべてPASS。失敗時はRecord開始の表示変更だけを調査し、保存・採点へ変更を広げない。

- [ ] **Step 3: 手動確認項目を実行する**

390pxと360pxで次を確認する。

\`\`\`text
- 初回（履歴なし）: 主CTAが1つ、ターゲット名が読み上げ可能
- 履歴あり: 前回と同じ／履歴・分析が補助行として静かに表示される
- 距離変更: ターゲットプレビューのサイズ・aria-label・距離表示が更新される
- 的変更: single / triple / field のSVGが崩れず更新される
- 本数変更: 既存セレクトの値が保持される
- 詳しく残す: 開閉と既存フィールド入力が動作する
- 開始: #fStartから記録中へ遷移し、既存の保存・採点フローが変わらない
- dark / auto: 墨・紙・ターゲット色のコントラストが保たれる
- reduced motion: 既存の静止表示が保たれる
\`\`\`

- [ ] **Step 4: 最終状態を確認する**

\`\`\`powershell
git status --short
git diff HEAD~3 --stat
\`\`\`

Expected: 意図した3ファイル（\`scripts/50-record-view.js\`、\`style.css\`、\`style.min.css\`）と回帰ガード／計画・設計ドキュメントだけが変更され、storage/PWA/version/dependencyファイルが含まれない。

実行したPNGは \`artifacts/ui-smoke/\` に生成されるが、同ディレクトリは \`.gitignore\` 対象のためコミットしない。コマンド出力と手動確認結果を作業報告へ記録する。

## 次の画面単位（この計画の完了後）

履歴・分析・サイト・用具は、このRecord開始面で確定したトークンと主役ルールを使って別の設計／実装計画にする。今回の計画へ同時に混ぜず、各画面で \`check:ui\` とモバイル幅の証拠を残す。
