(() => {
'use strict';
const API='https://rps-server.heyboernathan.workers.dev';
fetch(API+'/developer/published-config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{
 const c=data&&data.config;if(!c)return;
 const hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:null;
 const root=document.documentElement;
 const page=hex(c.pageBg),panel=hex(c.panelBg),accent=hex(c.accent),text=hex(c.textColour);
 if(page)root.style.setProperty('--bg',page);
 if(panel)root.style.setProperty('--panel',panel);
 if(accent){root.style.setProperty('--blue',accent);root.style.setProperty('--green',accent);root.style.setProperty('--accent',accent);}
 if(text)root.style.setProperty('--text',text);
 const radius=Number(c.radius);
 if(Number.isFinite(radius)&&radius>=4&&radius<=28){
  root.style.setProperty('--dev-button-radius',radius+'px');
  const style=document.createElement('style');
  style.textContent='button,.big,.mode-button,.move-button,.level-button{border-radius:var(--dev-button-radius)!important}';
  document.head.appendChild(style);
 }
 window.RPS_APPROVED_DEVELOPER_CONFIG=Object.freeze({...c});
 document.body.classList.add('owner-approved-developer-theme');
}).catch(()=>{});
})();