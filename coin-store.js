(()=>{'use strict';
const API='https://rps-server.heyboernathan.workers.dev';
const $=id=>document.getElementById(id);
const items=[
 {id:'title_champion',name:'🏆 Champion Title',description:'A permanent title for your player profile.',price:100,group:'titles'},
 {id:'badge_veteran',name:'🛡️ Veteran Badge',description:'A permanent badge for your profile identity.',price:75,group:'badges'},
 {id:'powerup_shield',name:'⚡ Shield Card',description:'A permanent power-up card unlock for supported game modes.',price:150,group:'powerups'}
];
let token='';let state={walletBalance:0,inventory:{titles:[],badges:[],powerups:[]}};
try{token=localStorage.getItem('token')||''}catch(_){}
async function call(path,body){const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,token})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'The server rejected the request.');return d}
function owned(item){return (state.inventory[item.group]||[]).includes(item.id)}
function render(){ $('wallet-balance').textContent=Number(state.walletBalance||0).toLocaleString()+' $CR';$('store-items').innerHTML=items.map(item=>{const has=owned(item);return '<article class="item"><h2>'+item.name+'</h2><p>'+item.description+'</p><div class="price">'+item.price+' $CR</div>'+(has?'<div class="owned">✓ OWNED</div>':'<button class="btn" data-buy="'+item.id+'" '+(state.walletBalance<item.price?'disabled':'')+'>Purchase</button>')+'</article>'}).join('');document.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',()=>buy(b.dataset.buy)))}
async function refresh(){if(!token)throw new Error('Please sign in to your game account first.');const d=await call('/account/wallet',{action:'load'});state=d;render()}
async function buy(id){const b=document.querySelector('[data-buy="'+id+'"]');if(b)b.disabled=true;try{state=await call('/account/wallet',{action:'buy',item:id});render();$('store-message').textContent='Purchase successful. Your item is saved to your account.'}catch(e){$('store-message').textContent=e.message; if(b)b.disabled=false}}
async function developer(){try{const d=await call('/account/developer-status',{});$('developer-terminal').hidden=!d.approved}catch(_){$('developer-terminal').hidden=true}}
$('developer-run').addEventListener('click',async()=>{const command=$('developer-command').value.trim();if(!command)return;const out=$('developer-log');out.textContent='Executing…';try{const d=await call('/account/developer-command',{command});out.textContent=d.message;state.walletBalance=d.walletBalance;state.inventory=d.inventory||state.inventory;render()}catch(e){out.textContent=e.message}});
$('developer-command').addEventListener('keydown',e=>{if(e.key==='Enter')$('developer-run').click()});
refresh().then(()=>{ $('store-status').textContent='Wallet synchronized with your account.';developer()}).catch(e=>{$('store-status').textContent=e.message;$('store-message').textContent=e.message});
})();