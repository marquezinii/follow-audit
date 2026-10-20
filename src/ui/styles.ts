import fontUrl from '../assets/manrope-latin.woff2';

/** Panel styles. Everything lives inside the Shadow DOM, so platform CSS cannot leak in or out. */
export const styles = `
@font-face{font-family:FollowAudit;src:url("${fontUrl}") format("woff2");font-weight:200 800;font-display:swap}
:host{all:initial;position:fixed;z-index:2147483647;top:0;right:0;bottom:0;display:block;width:min(440px,100vw);
  --ground:#f7f8fb;--raised:#fff;--hover:#eef1f6;--ink:#172235;--muted:#566276;--quiet:#5f6b7e;--rule:#e2e6ee;--rule-strong:#c9d1dd;
  --blue:#0a5cff;--blue-text:#0a52e6;--blue-solid:#0a5cff;--blue-solid-hover:#0047d6;--blue-soft:rgba(10,92,255,.08);
  --teal:#0a7d72;--teal-soft:rgba(18,199,180,.14);--danger:#c8323a;--danger-solid:#d93a3f;--danger-solid-hover:#bf2d32;--danger-soft:rgba(217,58,63,.09);
  --axis:linear-gradient(180deg,#0a5cff,#0aa3ec 55%,#12c7b4);--ring:0 0 0 3px rgba(10,92,255,.35);
  --edge:-1px 0 0 var(--rule),-28px 0 60px -36px rgba(23,34,53,.45);--float:0 24px 60px -24px rgba(23,34,53,.45),0 2px 6px rgba(23,34,53,.08);
  color-scheme:light;font:14px/1.5 FollowAudit,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
:host([data-theme=dark]){--ground:#0b1220;--raised:#111a2b;--hover:#16213a;--ink:#f2f5fa;--muted:#a9b4c6;--quiet:#8794ab;--rule:#1e2a40;--rule-strong:#2f3f5c;
  --blue:#6198ff;--blue-text:#7aa8ff;--blue-solid:#1f5fff;--blue-solid-hover:#1648d6;--blue-soft:rgba(61,130,255,.15);
  --teal:#2fd3bf;--teal-soft:rgba(38,205,185,.14);--danger:#ff7b7f;--danger-solid:#d93a3f;--danger-solid-hover:#e5484d;--danger-soft:rgba(255,107,110,.13);
  --ring:0 0 0 3px rgba(97,152,255,.5);--edge:-1px 0 0 var(--rule),-28px 0 60px -30px rgba(0,0,0,.7);--float:0 24px 60px -20px rgba(0,0,0,.65),0 2px 6px rgba(0,0,0,.35);color-scheme:dark}
:host([data-minimized]){top:auto;left:auto;right:20px;bottom:20px;width:auto}
*,*::before,*::after{box-sizing:border-box}[hidden]{display:none!important}
button,input{font:inherit;color:inherit;letter-spacing:inherit}button{cursor:pointer;-webkit-tap-highlight-color:transparent}button:disabled{cursor:not-allowed;opacity:.42}
:focus-visible{outline:none;box-shadow:var(--ring)}::selection{color:#fff;background:var(--blue-solid)}
svg{width:18px;height:18px;flex:0 0 auto}h1,h2,p{margin:0}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.mark{display:inline-grid;width:28px;height:28px}.mark svg{width:100%;height:100%}.mark-dark{display:none}
:host([data-theme=dark]) .mark-light{display:none}:host([data-theme=dark]) .mark-dark{display:inline-grid}
.icon-sun,.icon-moon{display:inline-grid}:host([data-theme=dark]) .icon-moon,:host(:not([data-theme=dark])) .icon-sun{display:none}

.app{position:absolute;inset:0;display:grid;grid-template-rows:auto 2px minmax(0,1fr) auto;overflow:hidden;color:var(--ink);background:var(--ground);box-shadow:var(--edge)}
.body{min-height:0;container-type:inline-size;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--rule-strong) transparent}
.view{padding:22px 22px 28px;animation:enter .22s cubic-bezier(.2,.8,.2,1)}

/* Bar */
.bar{display:flex;align-items:center;gap:6px;min-height:56px;padding:0 10px 0 16px;border-bottom:1px solid var(--rule)}
.brand{display:flex;align-items:center;gap:8px;min-width:0;margin-right:auto}
.logo{display:block;width:124px}.logo svg{display:block;width:100%;height:auto}.logo-dark{display:none}:host([data-theme=dark]) .logo-light{display:none}:host([data-theme=dark]) .logo-dark{display:block}
.bar-actions{display:flex;align-items:center;gap:2px}
.icon-button{display:inline-grid;place-items:center;min-width:36px;height:36px;border:0;border-radius:10px;padding:0;color:var(--muted);background:transparent;transition:color .15s,background .15s}
.icon-button:hover:not(:disabled){color:var(--ink);background:var(--hover)}
.icon-button.text{padding:0 8px;font-size:12px;font-weight:800;letter-spacing:.04em}
.icon-button.outlined{width:40px;height:40px;border:1px solid var(--rule);background:var(--raised)}
#back{margin-left:-6px}
.language-menu{position:relative}.language-menu summary{list-style:none;cursor:pointer}.language-menu summary::-webkit-details-marker{display:none}
.popover{position:absolute;z-index:5;top:calc(100% + 6px);right:0;width:208px;padding:6px;border:1px solid var(--rule);border-radius:14px;background:var(--raised);box-shadow:var(--float);animation:enter .16s ease}
.popover p{margin:6px 10px;color:var(--quiet);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.popover button{display:grid;grid-template-columns:30px 1fr 18px;align-items:center;width:100%;min-height:40px;border:0;border-radius:9px;padding:0 10px;background:transparent;text-align:left}
.popover button:hover{background:var(--hover)}.popover button>span{color:var(--quiet);font-size:11px;font-weight:800}.popover button>strong{font-weight:600}
.popover button svg{visibility:hidden;color:var(--blue-text)}.popover button[aria-checked=true]{color:var(--blue-text);background:var(--blue-soft)}.popover button[aria-checked=true] svg{visibility:visible}

.progress{position:relative;overflow:hidden}.progress span{position:absolute;inset:0;background:linear-gradient(90deg,#0a5cff,#0aa3ec 55%,#12c7b4);transform:scaleX(0);transform-origin:left;transition:transform .3s ease}
.progress[data-state=indeterminate] span{right:auto;width:40%;transform:none;transition:none;animation:sweep 1.15s cubic-bezier(.45,0,.2,1) infinite}

/* Report: the versus axis */
.versus{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;padding:6px 0 4px}
.side{display:grid;gap:2px;min-width:0}.side:first-child{text-align:right}
.side strong{font-size:68px;font-weight:800;line-height:.95;letter-spacing:-.04em;white-space:nowrap}.versus[data-digits=m] .side strong{font-size:52px}.versus[data-digits=l] .side strong{font-size:40px}
.side span{color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.axis{position:relative;display:grid;place-items:center;width:48px;height:120px}
.axis::before{content:"";position:absolute;inset:0 auto 0 50%;width:2px;margin-left:-1px;border-radius:2px;background:var(--axis)}
.axis-mark{position:relative;display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:var(--ground);box-shadow:0 0 0 4px var(--ground)}
.axis-mark .mark{width:44px;height:44px}
.app[data-state=idle] .side strong{color:var(--quiet)}
.mutual{margin-top:10px;color:var(--muted);font-size:13px;font-weight:650;text-align:center}
.session{display:flex;align-items:center;justify-content:center;gap:8px;min-height:20px;margin-top:10px;color:var(--quiet);font-size:12.5px;text-align:center}
#status-dot{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:var(--teal);box-shadow:0 0 0 3px var(--teal-soft)}
#status-dot[data-mode=scanning],#status-dot[data-mode=running]{background:var(--blue);box-shadow:0 0 0 3px var(--blue-soft);animation:pulse 1.3s ease-in-out infinite}
#status-dot[data-mode=error]{background:var(--danger);box-shadow:0 0 0 3px var(--danger-soft)}
.app[data-mode=error] #status{color:var(--danger)}
.report-actions{display:grid;gap:6px;margin-top:16px}

.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;border:1px solid transparent;border-radius:12px;padding:0 18px;font-weight:750;white-space:nowrap;text-decoration:none;transition:background .15s,border-color .15s,color .15s,transform .15s}
.button:active:not(:disabled){transform:translateY(1px)}
.primary{color:#fff;background:var(--blue-solid);box-shadow:0 8px 20px -12px rgba(10,92,255,.8),inset 0 1px 0 rgba(255,255,255,.14)}.primary:hover:not(:disabled){background:var(--blue-solid-hover)}
.danger{color:#fff;background:var(--danger-solid)}.danger:hover:not(:disabled){background:var(--danger-solid-hover)}
.quiet{color:var(--muted);background:transparent}.quiet:hover:not(:disabled){color:var(--ink);background:var(--hover)}
.danger-text{color:var(--danger)}

.intro{margin-top:26px;padding-top:22px;border-top:1px solid var(--rule)}
.intro h2{font-size:19px;font-weight:800;line-height:1.25;letter-spacing:-.025em}
.intro p{margin-top:8px;color:var(--muted)}
.assurance{display:flex;align-items:center;gap:8px;margin-top:16px!important;color:var(--teal)!important;font-size:13px;font-weight:700}.assurance svg{width:16px;height:16px}

.changes{display:flex;align-items:center;gap:10px;width:100%;margin-top:22px;padding:12px 14px;border:0;border-radius:12px;color:var(--ink);background:var(--blue-soft);font-size:13px;font-weight:650;text-align:left}
.changes svg{color:var(--blue-text)}.changes:hover:not([aria-disabled=true]){background:color-mix(in srgb,var(--blue-soft) 100%,var(--blue) 6%)}.changes[aria-disabled=true]{cursor:default}

/* Segments: ranked like a fight card undercard */
.segments{display:grid;margin-top:22px;border-top:1.5px solid var(--ink)}
.segment{display:grid;grid-template-columns:minmax(0,1fr) auto 18px;align-items:center;gap:12px;width:100%;border:0;border-bottom:1px solid var(--rule);padding:0 2px;background:transparent;text-align:left;transition:background .15s}
.segment:hover:not(:disabled){background:var(--hover)}
.segment.major{min-height:66px}.segment.minor{min-height:48px}
.segment-text{display:grid;gap:1px;min-width:0}
.segment strong{font-size:15px;font-weight:750;letter-spacing:-.01em}.segment.minor strong{font-size:13.5px;font-weight:650}
.segment small{color:var(--quiet);font-size:12.5px}
.segment-count{font-size:24px;font-weight:800;letter-spacing:-.035em}.segment.minor .segment-count{font-size:15px;font-weight:750;color:var(--muted)}
.segment>svg{color:var(--quiet)}
.segment[data-segment=lost][data-nonzero=true] .segment-count{color:var(--danger)}
.segment[data-segment=nonfollowers] .segment-count{color:var(--blue-text)}

/* Lists */
.list-head h1{font-size:22px;font-weight:800;line-height:1.2;letter-spacing:-.03em}
.list-head p{margin-top:4px;color:var(--muted);font-size:13.5px}
.toolbar{position:sticky;z-index:2;top:-22px;display:flex;gap:6px;margin:16px -22px 0;padding:10px 22px;background:var(--ground)}
.search{position:relative;display:flex;align-items:center;flex:1;min-width:0}
.search>svg{position:absolute;left:12px;color:var(--quiet);pointer-events:none}
.search input{width:100%;height:40px;caret-color:var(--blue);border:1px solid var(--rule);border-radius:11px;padding:0 36px 0 38px;background:var(--raised);transition:border-color .15s}
.search input:hover{border-color:var(--rule-strong)}.search input:focus{border-color:var(--blue)}.search input::placeholder{color:var(--quiet)}
.search input::-webkit-search-cancel-button{display:none}
.search kbd{position:absolute;right:9px;display:grid;place-items:center;min-width:20px;height:20px;border:1px solid var(--rule);border-radius:6px;color:var(--quiet);font:700 11px/1 FollowAudit,ui-sans-serif,system-ui,sans-serif}
.search input:focus+kbd,.search input:not(:placeholder-shown)+kbd{display:none}
.accounts{margin:4px -22px 0}
.row{display:grid;grid-template-columns:24px 40px minmax(0,1fr) 36px;align-items:center;gap:12px;min-height:64px;padding:8px 18px 8px 22px;border-bottom:1px solid var(--rule);content-visibility:auto;contain-intrinsic-size:auto 64px;transition:background .12s}
.app[data-platform=tiktok] .row,.row.readonly{grid-template-columns:40px minmax(0,1fr) 36px}
.row:hover{background:var(--hover)}.row[data-selected=true]{background:var(--blue-soft)}
.row[data-result=ok]{opacity:.55}.row[data-result=error] .name{color:var(--danger)}
.check{position:relative;display:inline-grid;place-items:center;width:24px;height:24px}
.check input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}.check input:disabled{cursor:not-allowed}
.check span{display:grid;place-items:center;width:20px;height:20px;border:1.5px solid var(--rule-strong);border-radius:6px;background:var(--raised);transition:background .12s,border-color .12s}
.check input:hover:not(:disabled)+span{border-color:var(--blue)}
.check input:checked+span{border-color:var(--blue-solid);background:var(--blue-solid)}
.check input:checked+span::after{content:"";width:9px;height:5px;border:solid #fff;border-width:0 0 2px 2px;transform:translateY(-1px) rotate(-45deg)}
.check input:disabled+span{opacity:.35}.check input:focus-visible+span{box-shadow:var(--ring)}
.avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;background:var(--hover)}
.identity{min-width:0;display:grid}
.identity a,.identity span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.name{width:fit-content;max-width:100%;color:var(--ink);font-weight:750;text-decoration:none;border-radius:4px}.name:hover{color:var(--blue-text);text-decoration:underline;text-underline-offset:3px}
.handle{color:var(--muted);font-size:12.5px}
.meta{display:flex;flex-wrap:wrap;gap:2px 10px;font-size:12px;color:var(--quiet)}.meta:empty{display:none}
.tag{font-weight:700}.tag.ok{color:var(--teal)}.tag.bad{color:var(--danger)}.tag.info{color:var(--blue-text)}
.protect{display:inline-grid;place-items:center;width:36px;height:36px;border:1px solid transparent;border-radius:50%;color:var(--quiet);background:transparent;transition:color .15s,background .15s,border-color .15s}
.protect:hover:not(:disabled){color:var(--ink);border-color:var(--rule)}
.protect[aria-pressed=true]{color:var(--teal);background:var(--teal-soft)}
.more{display:flex;justify-content:center;padding:14px}
.more .button{min-height:38px;border-color:var(--rule);background:var(--raised);color:var(--ink)}
.empty{display:grid;justify-items:center;gap:6px;padding:48px 28px;text-align:center}
.empty svg{width:28px;height:28px;margin-bottom:8px;color:var(--teal)}
.empty h2{font-size:17px;font-weight:800;letter-spacing:-.02em}.empty p{max-width:320px;color:var(--muted);font-size:13.5px}
.skeleton{height:64px;border-bottom:1px solid var(--rule);background:linear-gradient(90deg,transparent,var(--hover),transparent) 0 0/200% 100%;animation:shimmer 1.2s linear infinite}

/* Action bar */
.actionbar{display:flex;align-items:center;gap:12px;padding:12px 16px 12px 22px;border-top:1px solid var(--rule);background:var(--raised)}
.selection{display:grid;min-width:0;margin-right:auto}.selection strong{font-size:13.5px;font-weight:750;white-space:nowrap}.selection span{display:none}.app[data-platform=tiktok] .selection span{display:block;color:var(--muted);font-size:12px}
.actionbar .button{flex:0 1 auto;min-width:0}.actionbar .button span{overflow:hidden;text-overflow:ellipsis}

/* Settings */
.settings-group{margin-top:22px;padding-top:18px;border-top:1px solid var(--rule)}
.settings-group h2{margin-bottom:4px;color:var(--quiet);font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.settings-hint{color:var(--muted);font-size:13px}
.setting-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:58px;border-bottom:1px solid var(--rule)}
.setting-row label{font-weight:650}.field{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13px}
.field input{width:64px;height:38px;border:1px solid var(--rule);border-radius:10px;background:var(--raised);text-align:center;font-weight:750}
.field input:focus{border-color:var(--blue)}
.note{display:flex;gap:10px;margin-top:14px!important;color:var(--muted);font-size:12.5px}.note svg{width:16px;height:16px;margin-top:2px;color:var(--blue-text)}
.settings-actions{display:grid;margin-top:10px;border-top:1px solid var(--rule)}
.row-button{display:flex;align-items:center;gap:12px;min-height:50px;border:0;border-bottom:1px solid var(--rule);padding:0 2px;background:transparent;font-weight:650;text-align:left}
.row-button:hover{background:var(--hover)}.row-button svg{color:var(--quiet)}.row-button.danger-text svg{color:var(--danger)}
.settings-feedback{min-height:20px;margin-top:12px!important;color:var(--teal);font-size:13px;font-weight:700}.settings-feedback[data-tone=error]{color:var(--danger)}

/* Dialogs */
.dialog{width:min(420px,calc(100vw - 32px));max-height:calc(100vh - 32px);margin:auto;border:0;padding:0;color:var(--ink);background:transparent;overflow:visible}
.dialog[open]{animation:enter .2s cubic-bezier(.2,.8,.2,1)}.dialog::backdrop{background:rgba(8,14,26,.5);backdrop-filter:blur(2px)}
.dialog-panel{max-height:calc(100vh - 32px);overflow:auto;border:1px solid var(--rule);border-radius:18px;padding:24px;background:var(--raised);box-shadow:var(--float)}
.dialog-panel h2{margin-top:14px;font-size:20px;font-weight:800;line-height:1.25;letter-spacing:-.025em}
.dialog-panel>p{margin-top:6px;color:var(--muted)}
.dialog-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;color:var(--blue-text);background:var(--blue-soft)}.dialog-icon svg{width:22px;height:22px}
#confirm-dialog .dialog-icon{color:var(--danger);background:var(--danger-soft)}
.list-label{margin-top:20px!important;margin-bottom:8px;color:var(--quiet)!important;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.confirm-accounts{max-height:240px;overflow:auto;border-block:1px solid var(--rule)}
.confirm-account{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:48px;border-bottom:1px solid var(--rule)}
.confirm-account:last-child{border-bottom:0}.confirm-account img{width:30px;height:30px;border-radius:50%;object-fit:cover;background:var(--hover)}
.confirm-account span{overflow:hidden;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.confirm-account small{color:var(--muted)}
.confirm-more{padding:10px 0;color:var(--muted);font-size:13px}
.dialog footer{display:flex;justify-content:flex-end;gap:8px;margin-top:22px}
.guided-account{display:grid;gap:12px;margin-top:4px;padding:18px;border:1px solid var(--rule);border-radius:14px;background:var(--ground)}
.guided-account strong{font-size:21px;font-weight:800;letter-spacing:-.025em;overflow-wrap:anywhere}.guided-account .button{justify-self:start}

/* Minimized pill */
.pill{display:flex;align-items:center;gap:10px;height:50px;border:1px solid var(--rule);border-radius:99px;padding:0 18px 0 10px;color:var(--ink);background:var(--raised);box-shadow:var(--float);font-weight:700;animation:enter .2s ease}
.pill:hover{border-color:var(--rule-strong)}#pill-status{max-width:240px;overflow:hidden;font-size:13px;text-overflow:ellipsis;white-space:nowrap}

@keyframes enter{from{opacity:0;transform:translateY(6px)}}
@keyframes sweep{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
@keyframes pulse{50%{opacity:.4}}
@keyframes shimmer{to{background-position:-200% 0}}
@media(max-width:480px){.view{padding-inline:16px}.accounts,.toolbar{margin-inline:-16px}.toolbar{padding-inline:16px}.row{padding-left:16px;padding-right:12px}.actionbar{padding-left:16px}.logo{width:104px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
@media(forced-colors:active){.primary,.danger{border:2px solid ButtonText}.axis::before{background:CanvasText}}
`;
