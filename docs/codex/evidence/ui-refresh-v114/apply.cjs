const fs=require('node:fs'),assert=require('node:assert/strict');let css=fs.readFileSync('style.css','utf8');const light={green:'#0b765d','green-l':'#0b765d',bg:'#f2f5f4',card:'#ffffff',ink:'#182722',sub:'#5b7065',line:'#dce5e0',line2:'#e8eeea',soft:'#edf3ef',inpBg:'#f3f6f4',hdr:'#182722',title:'#182722',advBg:'#edf3ef',advLine:'#dce5e0',accent:'#0b765d','accent-strong':'#075b46','invert-bg':'#0b765d','invert-fg':'#ffffff',paper:'#ffffff',paper2:'#edf3ef',ink2:'#182722',mint:'#edf3ef','chrome-bg':'rgba(255,255,255,.97)','chrome-border':'rgba(24,39,34,.10)','page-top':'#f2f5f4','page-mid':'#f2f5f4','logo-surface-a':'#ffffff','logo-surface-b':'#ffffff','target-surface-a':'#ffffff','target-surface-b':'#edf3ef','radius-card':'20px','radius-panel':'20px','radius-control':'12px','shadow-raised':'0 8px 28px rgba(24,39,34,.08)'};const rootEnd=css.indexOf('\n}');let root=css.slice(0,rootEnd);for(const[k,v]of Object.entries(light)){const re=new RegExp('--'+k+':[^;]+;');assert(re.test(root),k);root=root.replace(re,'--'+k+':'+v+';');}root=root.replace('Field Instrument v2 — light: 墨とインクの精密な計器。金は糸だけ','Practice Note v3 — light: 白い操作面と深いグリーン');css=root+css.slice(rootEnd);
const dark={bg:'#101a17',card:'#17241f',ink:'#edf5ef',sub:'#a2b6aa',line:'#344b3f',line2:'#293e33',soft:'#22342c',inpBg:'#1e3028',hdr:'#edf5ef',title:'#edf5ef',advBg:'#22342c',advLine:'#344b3f',green:'#94e3bf','green-l':'#94e3bf',accent:'#94e3bf','accent-strong':'#b8f2d4','invert-bg':'#94e3bf','invert-fg':'#143326',paper:'#17241f',paper2:'#22342c',ink2:'#edf5ef',teal:'#64d3bf',amber:'#f0b35a',navy:'#78aee8',mint:'#22342c',danger:'#ff8a80','status-ok':'#4ade80','status-warn':'#ff8a80','status-hold':'#e7c776','shadow-raised':'0 10px 30px rgba(0,0,0,.24)','chrome-bg':'rgba(23,36,31,.97)','chrome-border':'rgba(237,245,239,.12)','page-top':'#101a17','page-mid':'#101a17','logo-surface-a':'#17241f','logo-surface-b':'#17241f','target-surface-a':'#17241f','target-surface-b':'#22342c'};for(const selector of ['html.dark{','html.auto{']){const start=css.indexOf(selector);assert(start>0);const end=css.indexOf(selector==='html.dark{'?'\n}':'\n  }',start);assert(end>start);const tail=selector==='html.dark{'?'\n}':'\n  }';css=css.slice(0,start)+selector+'\n  '+Object.entries(dark).map(([k,v])=>'--'+k+':'+v+';').join('\n  ')+tail+css.slice(end+tail.length);}
css+=`\n\n/* Practice Note v3 — approved UI refresh. Geometry and score-zone colors remain separate. */
body{font-family:"Yu Gothic UI",-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans CJK JP",Meiryo,sans-serif;letter-spacing:.01em;}
button,input,select,textarea{font-family:inherit;}
header.app{background:var(--card);border-bottom:0;box-shadow:0 1px 0 var(--line2);}
header.app h1{font-size:18px;font-weight:750;letter-spacing:-.045em;color:var(--ink);}
header.app .appLogo{border:0;border-radius:10px;background:transparent;}
header.app .gear{border:0;border-radius:50%;background:var(--soft);}
.card{background:var(--card);border:1px solid var(--line2);border-radius:20px;padding:16px;box-shadow:none;}
.card h2{font-size:14px;font-weight:650;letter-spacing:0;color:var(--ink);}
.btn{border-radius:14px;font-weight:700;letter-spacing:.015em;}
.btn.sm{border-radius:10px;}
.btn.sec{background:var(--soft);border:1px solid transparent;color:var(--ink);}
.btn.ghost{background:var(--soft);border:1px solid transparent;}
.btn.danger{background:transparent;border-color:var(--danger);color:var(--danger);}
.inp,select.inp,textarea.inp{border-color:var(--line2);border-radius:12px;background-color:var(--inpBg);font-weight:500;}
.inp:focus:not(:focus-visible){border-color:var(--accent);box-shadow:0 0 0 3px rgba(11,118,93,.12);}
.chip{border-radius:12px;border-color:transparent;background:var(--soft);font-weight:600;}
.chip.on{background:var(--invert-bg);color:var(--invert-fg);border-color:transparent;}
.tinyAction{border-radius:10px;}
.practiceHeading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:18px 6px 16px;}
.practiceHeading h2{margin:0;font-size:25px;line-height:1.3;letter-spacing:-.045em;font-weight:750;}
.practiceHeading>span{color:var(--sub);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap;}
.recordRepeatBand{margin:0 4px 16px;gap:8px;}
.repeatMain,.repeatHistory{border:0;border-radius:12px;background:var(--card);}
.repeatMain{padding:10px 14px;}
.repeatMain .repeatEyebrow{font-weight:650;}
.repeatHistory{color:var(--accent-strong);}
.launchPanel.convergeLaunch{border:1px solid var(--line2);border-radius:22px;background:var(--card);}
.startFirst .launchHead{border-bottom:0;padding:16px 16px 4px;}
.startFirst .launchHead h2{font-size:15px;font-weight:700;letter-spacing:0;color:var(--ink);}
.convergeLaunch .launchBody{padding:8px 16px 16px;}
.quickDists .chip{border-radius:12px;min-height:46px;font-size:14px;}
.sessionCardRule{margin:14px 0;background:var(--line2);}
.startPrimary{border-radius:14px;font-size:16px;min-height:56px;}
.sessionCondition .lensCard{border:0;border-radius:0;background:transparent;padding:8px 2px;}
.sessionCondition .lensCard b{font-size:12px;}
.recordDetails summary{color:var(--accent-strong);}
.compactHud{padding:8px 6px;}
.liveContext{font-size:13px;font-weight:650;}
.liveHudMore summary{border:0;border-radius:10px;background:var(--soft);color:var(--sub);}
.liveGrid3 .liveCell b{font-size:26px;line-height:1.1;letter-spacing:-.03em;}
.liveGrid3 .liveCell:nth-child(2) b{color:var(--accent-strong);}
.targetFocusCard.targetFocusWide{padding:12px 6px;border:1px solid var(--line2);border-radius:20px;}
.targetFocusCard h2{font-size:12px;font-weight:650;}
.targetFocusCard .tgWrap svg.main{background:var(--card);border-radius:14px;}
.targetTools .chip{border-radius:10px;}
.nudge{border-radius:18px;background:var(--soft);}
.npad button{border:0;border-radius:12px;background:var(--card);}
.activeActionDock{border:1px solid var(--line2);border-radius:18px;background:var(--card);box-shadow:0 6px 24px rgba(24,39,34,.08);}
.activeActionDock #bEnd{background:var(--invert-bg);color:var(--invert-fg);border-color:transparent;}
.activeActionDock .activeFinishBtn{background:transparent;border:1px solid var(--line);color:var(--sub);}
nav.tabs{bottom:0;width:100%;border:0;border-top:1px solid var(--line2);border-radius:20px 20px 0 0;background:var(--card);box-shadow:0 -4px 24px rgba(24,39,34,.04);padding-bottom:max(6px,env(safe-area-inset-bottom));}
nav.tabs::before{display:none;}
nav.tabs button{border-radius:14px;font-weight:650;}
nav.tabs button.on{color:var(--accent-strong);}
nav.tabs button .ic{width:42px;border-radius:10px;}
nav.tabs button.on .ic{background:var(--soft);color:var(--accent-strong);}
.sheet{border-radius:26px 26px 0 0;background:var(--card);}
.sheet h3{font-size:18px;letter-spacing:-.025em;font-weight:750;}
.confirmSheet{border-radius:20px;}
.modalSwipeHandle::before{width:36px;background:var(--sub);opacity:.5;}
.stat{background:var(--soft);border-radius:14px;padding:11px 4px;}
.stat b{font-size:20px;letter-spacing:-.03em;}
.decisionCard{border-radius:16px;border-color:var(--line2);}
.settingsGroupTitle{font-size:12px;font-weight:650;letter-spacing:.03em;}
details.adv{border-radius:14px;}
.growthDashboard{background:var(--card);border:1px solid var(--line2);border-radius:20px;}
html.field{--sub:#354e41;--accent:#07533d;--accent-strong:#07533d;}
html.dark.field{--sub:#c1d4c8;--accent:#a2edc9;--accent-strong:#b8f2d4;}
@media(prefers-color-scheme:dark){html.auto.field{--sub:#c1d4c8;--accent:#a2edc9;--accent-strong:#b8f2d4;}}
@media(min-width:820px){.practiceHeading{margin-top:24px;}.practiceHeading h2{font-size:28px;}}
`;fs.writeFileSync('style.css',css);let js=fs.readFileSync('scripts/50-record-view.js','utf8');const needle='  m.innerHTML = `\n  ${featureHintHtml()}\n  ${recordFastActionsHtml(last)}';assert(js.includes(needle));js=js.replace(needle,'  m.innerHTML = `\n  <div class="practiceHeading"><h2>練習を記録</h2><span>${fmtD(today())}</span></div>\n  ${featureHintHtml()}\n  ${recordFastActionsHtml(last)}');fs.writeFileSync('scripts/50-record-view.js',js);console.log('PASS applied v3 visual tokens/components;50 adds idle heading only');
