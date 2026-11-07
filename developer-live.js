(() => {
'use strict';
const API='https://rps-server.heyboernathan.workers.dev';
const safeHex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:null;
const state=window.__RPS_DEV_MATCH_STATE||(window.__RPS_DEV_MATCH_STATE={format:1,wins:0,losses:0,ties:0,finished:false,bar:null});
function renderMatch(){
 if(!state.format||state.format<=1){if(state.bar)state.bar.remove();state.bar=null;return;}
 if(!state.bar){
  const bar=document.createElement('aside');bar.id='rps-developer-match';
  bar.style.cssText='position:fixed;right:14px;bottom:14px;z-index:9998;max-width:min(330px,calc(100vw - 28px));padding:12px 15px;border:1px solid var(--accent,#6bdcff);border-radius:14px;background:var(--panel,#111a2d);color:var(--text,#f5f7ff);box-shadow:0 12px 35px #0008;font:600 13px/1.45 system-ui,sans-serif';
  document.body.appendChild(bar);state.bar=bar;
 }
 const target=Math.ceil(state.format/2);
 const label=state.finished?(state.wins>=target?'MATCH WON':'MATCH LOST'):'BEST OF '+state.format;
 state.bar.innerHTML='<strong>'+label+'</strong><div style="margin-top:4px">Wins: '+state.wins+'/'+target+' · Losses: '+state.losses+'/'+target+' · Ties: '+state.ties+'</div>'+(state.finished?'<button type="button" id="rps-dev-new-match" style="margin-top:8px;padding:7px 11px;border:0;border-radius:8px;background:var(--button-bg,#49368f);color:inherit;font-weight:800;cursor:pointer">Start new match</button>':'');
 const button=state.bar.querySelector('#rps-dev-new-match');if(button)button.addEventListener('click',()=>{state.wins=0;state.losses=0;state.ties=0;state.finished=false;renderMatch();});
}
function setConfig(c){
 if(!c||typeof c!=='object')return;
 const root=document.documentElement;
 const page=safeHex(c.pageBg),panel=safeHex(c.panelBg),accent=safeHex(c.accent),text=safeHex(c.textColour),button=safeHex(c.buttonBg);
 if(page)root.style.setProperty('--bg',page);
 if(panel)root.style.setProperty('--panel',panel);
 if(accent){root.style.setProperty('--blue',accent);root.style.setProperty('--green',accent);root.style.setProperty('--accent',accent);}
 if(text)root.style.setProperty('--text',text);
 if(button)root.style.setProperty('--button-bg',button);
 const radius=Number(c.radius);
 if(Number.isFinite(radius)&&radius>=4&&radius<=28){
  root.style.setProperty('--dev-button-radius',radius+'px');
  let style=document.getElementById('rps-dev-approved-radius');
  if(!style){style=document.createElement('style');style.id='rps-dev-approved-radius';document.head.appendChild(style);}
  style.textContent='button,.big,.mode-button,.move-button,.level-button{border-radius:var(--dev-button-radius)!important;background-color:var(--button-bg)!important}';
 }
 const css=typeof c.customCss==='string'?c.customCss:'';
 if(css&&!/@import|url\s*\(|expression\s*\(|javascript:/i.test(css)){
  let style=document.getElementById('owner-approved-developer-css');
  if(!style){style=document.createElement('style');style.id='owner-approved-developer-css';document.head.appendChild(style);}
  style.textContent=css;
 }
 const difficulty=['easy','medium','hard','insane'].includes(c.difficulty)?c.difficulty:'medium';
 const levelButton=document.querySelector('.level-button[data-level="'+difficulty+'"]');
 if(levelButton&&!levelButton.classList.contains('active'))levelButton.click();
 state.format=[1,3,5,7].includes(Number(c.format))?Number(c.format):1;
 state.wins=0;state.losses=0;state.ties=0;state.finished=false;
 window.RPS_APPROVED_DEVELOPER_CONFIG=Object.freeze({...c});
 renderMatch();
}
if(!window.__RPS_DEV_MATCH_LISTENER){
 window.__RPS_DEV_MATCH_LISTENER=true;
 window.addEventListener('rps-result',event=>{
  const d=event.detail||{};
  if(state.format<=1||state.finished||!['win','loss','tie'].includes(d.result))return;
  if(d.which!=='computer'&&d.which!=='online')return;
  if(d.result==='win')state.wins++;else if(d.result==='loss')state.losses++;else state.ties++;
  const target=Math.ceil(state.format/2);
  if(state.wins>=target||state.losses>=target)state.finished=true;
  renderMatch();
 });
 window.addEventListener('rps-dev-config',event=>setConfig(event.detail));
}
fetch(API+'/developer/published-config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(data&&data.config)setConfig(data.config);}).catch(()=>{});
})();