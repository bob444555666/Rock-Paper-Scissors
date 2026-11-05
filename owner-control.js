(() => {
'use strict';
const API='https://rps-server.heyboernathan.workers.dev';
const $=id=>document.getElementById(id);
let token=localStorage.getItem('token')||'',gateToken='',role='',panel={};
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labelRole=r=>({'staff':'Staff','manager':'Manager','co-owner':'Co-owner','owner':'Owner'}[r]||'');
const say=(el,msg,bad=false)=>{el.textContent=msg||'';el.className='msg'+(bad?' error':'');};
async function post(path,body={}) {
 const res=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,token,gate:gateToken}),cache:'no-store'});
 const data=await res.json().catch(()=>({error:'Unreadable server response.'}));
 if(!res.ok)throw new Error(data.error||'Request failed.');
 return data;
}
async function login(){
 const id=$('login-id').value.trim(),password=$('login-password').value;
 if(!password){say($('login-msg'),'Enter your account password.',true);return;}
 $('login-go').disabled=true;say($('login-msg'),'Verifying password…');
 try{
  token=localStorage.getItem('token')||token;
  if(!token){
   if(!id)throw new Error('Enter your username/email and password.');
   const auth=await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,password})});
   const signed=await auth.json();if(!auth.ok)throw new Error(signed.error||'Sign in failed.');
   token=signed.token;localStorage.setItem('token',token);
  }
  const res=await fetch(API+'/staff/reauth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password}),cache:'no-store'});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'Password verification failed.');
  gateToken=data.gate;$('login-password').value='';await boot();
 }catch(e){say($('login-msg'),e.message,true);}
 finally{$('login-go').disabled=false;}
}
async function boot(){
 token=localStorage.getItem('token')||token;
 $('app').classList.add('hidden');
 if(!token){$('login-card').classList.remove('hidden');say($('login-msg'),'Enter your RPS username and password to sign in, then verify your password for Owner Control.');return;}
 try{
  const me=await post('/staff/me');role=me.role||'';
  if(!['owner','co-owner'].includes(role))throw new Error('This account is not an owner or co-owner. Access denied.');
  $('login-id').value=me.username||'';
  if(!gateToken){$('login-card').classList.remove('hidden');say($('login-msg'),'Enter your password each time you open Owner Control.');return;}
  panel=await post('/staff/panel');
  $('login-card').classList.add('hidden');$('app').classList.remove('hidden');
  $('role-pill').textContent=labelRole(role);$('role-pill').classList.remove('hidden');
  $('role-name').textContent=labelRole(role);$('welcome').textContent='Welcome, '+(me.username||'administrator');
  buildTabs();render();
 }catch(e){gateToken='';$('login-card').classList.remove('hidden');$('app').classList.add('hidden');say($('login-msg'),e.message,true);}
}
let tab='overview';
function buildTabs(){
 const items=[['overview','Overview'],['employees','Employees & QR codes'],['accounts','Accounts'],['server','Server'],['challenges','Challenges'],['tournaments','Tournaments'],['plans','Plans']];
 $('tabs').innerHTML=items.map(([id,name])=>'<button data-tab="'+id+'" class="'+(tab===id?'active':'')+'">'+name+'</button>').join('');
 $('tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;buildTabs();render();});
}
async function reload(){panel=await post('/staff/panel');buildTabs();render();}
function render(){
 const root=$('workspace');$('work-msg').textContent='';
 if(tab==='overview'){
  root.innerHTML='<div class="grid"><article class="card"><h3>RPS server</h3><p class="status '+(panel.online?'on':'off')+'">'+(panel.online?'● ONLINE':'● OFFLINE')+'</p><p class="muted">Server status and operational controls.</p></article><article class="card"><h3>Administration</h3><p><span class="pill">'+labelRole(role)+'</span></p><p class="muted">You have access to employee management, account administration, server operations, tournaments and memberships.</p></article></div>';return;
 }
 if(tab==='server'){
  root.innerHTML='<article class="card"><h2>Server operations</h2><p class="status '+(panel.online?'on':'off')+'">'+(panel.online?'● SERVER ONLINE':'● SERVER OFFLINE')+'</p><button id="server-on" class="good">Turn server on</button><button id="server-off" class="danger">Turn server off</button></article>';
  $('server-on').onclick=()=>server(true);$('server-off').onclick=()=>server(false);return;
 }
 if(tab==='employees'){employees();return;}
 if(tab==='accounts'){accounts();return;}
 if(tab==='challenges'){
  root.innerHTML='<div class="grid"><article class="card"><h2>Create challenge</h2><input id="ch-user" placeholder="Challenge name / player label"><input id="ch-pass" type="password" placeholder="One-time password"><input id="ch-prize" placeholder="Prize (optional)"><select id="ch-hours">'+hours()+'</select><button id="ch-create">Create challenge</button></article><article class="card"><h2>Challenges</h2><div class="table-list">'+(panel.challenges||[]).map(chRow).join('')+'</div></article></div>';
  $('ch-create').onclick=()=>action('create',{username:$('ch-user').value,password:$('ch-pass').value,prize:$('ch-prize').value,hours:$('ch-hours').value},'Challenge created.');
  (panel.challenges||[]).forEach(c=>{const e=$('ch-ext-'+c.id),d=$('ch-del-'+c.id);if(e)e.onclick=()=>extend('extend',c.id);if(d)d.onclick=()=>remove('delete',c.id);});return;
 }
 if(tab==='tournaments'){
  root.innerHTML='<div class="grid"><article class="card"><h2>Create tournament</h2><input id="to-name" placeholder="Tournament name"><input id="to-prize" placeholder="Prize text (optional)"><select id="to-hours">'+hours()+'</select><button id="to-create">Create tournament</button></article><article class="card"><h2>Tournament rooms</h2><div class="table-list">'+(panel.tournaments||[]).map(toRow).join('')+'</div></article></div>';
  $('to-create').onclick=()=>action('tcreate',{name:$('to-name').value,prizeType:'text',prizeText:$('to-prize').value,hours:$('to-hours').value},'Tournament created.');
  (panel.tournaments||[]).forEach(t=>{const e=$('to-ext-'+t.id),d=$('to-del-'+t.id),a=$('to-add-'+t.id),s=$('to-start-'+t.id);if(e)e.onclick=()=>extend('textend',t.id);if(d)d.onclick=()=>remove('tdelete',t.id);if(a)a.onclick=()=>addPlayer(t.id);if(s)s.onclick=()=>action('tstart',{tid:t.id},'Tournament started.');});return;
 }
 if(tab==='plans'){
  const list=panel.premium||[];
  root.innerHTML='<div class="grid"><article class="card"><h2>Grant Plus / Pro / Legend</h2><input id="plan-user" placeholder="RPS username"><select id="plan-name"><option value="individual">Plus</option><option value="duo">Pro</option><option value="family">Legend</option></select><button id="plan-grant">Grant plan for life</button></article><article class="card"><h2>Current plan access ('+list.length+')</h2><div class="table-list">'+list.map(p=>'<div class="employee-row"><div><strong>'+esc(p.username)+'</strong><small>'+esc((p.lifetime?'Lifetime ':'')+({'individual':'Plus','duo':'Pro','family':'Legend'}[p.plan]||'Plus'))+'</small></div><button class="danger" data-rm-plan="'+esc(p.id)+'">Remove</button></div>').join('')+'</div></article></div>';
  $('plan-grant').onclick=()=>action('prem-plan',{username:$('plan-user').value,plan:$('plan-name').value,lifetime:true},'Plan granted.');
  root.querySelectorAll('[data-rm-plan]').forEach(b=>b.onclick=()=>action('prem-remove',{id:b.dataset.rmPlan},'Plan access removed.'));return;
 }
}
function hours(){return Array.from({length:20},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+' hour'+(i?'s':'')+'</option>').join('');}
function chRow(c){return '<div class="employee-row"><div><strong>'+esc(c.username)+' · '+esc(c.id)+'</strong><small>'+esc(c.status)+' · '+new Date(c.expiresAt).toLocaleString()+'</small></div><div><button class="secondary" id="ch-ext-'+esc(c.id)+'">Extend</button><button class="danger" id="ch-del-'+esc(c.id)+'">Delete</button></div></div>';}
function toRow(t){return '<div class="employee-row"><div><strong>'+esc(t.name||'Tournament')+'</strong><small>'+esc(t.status)+' · '+(t.players||[]).length+' players</small></div><div>'+(t.status==='setup'?'<button id="to-add-'+esc(t.id)+'">Add player</button><button id="to-start-'+esc(t.id)+'">Start</button>':'')+'<button class="secondary" id="to-ext-'+esc(t.id)+'">Extend</button><button class="danger" id="to-del-'+esc(t.id)+'">Delete</button></div></div>';}
async function action(act,body,msg){try{await post('/staff/'+act,body);say($('work-msg'),msg||'Saved.');await reload();}catch(e){say($('work-msg'),e.message,true);}}
async function server(on){if(!confirm(on?'Turn the server on?':'Turn the server off for everyone?'))return;await action('server',{on},on?'Server online.':'Server offline.');}
async function extend(act,id){await action(act,{id,tid:id,hours:1},'Expiry extended.');}
async function remove(act,id){if(!confirm('Delete this item?'))return;await action(act,{id,tid:id},'Deleted.');}
async function addPlayer(tid){const username=prompt('Player account username');if(!username)return;const password=prompt('Temporary tournament password (4+ characters)');if(!password)return;await action('tadd',{tid,username,password},'Player added.');}
async function employees(){
 const data=await post('/staff/role-list'),list=data.staff||[];
 $('workspace').innerHTML='<div class="grid"><article class="card"><h2>Assign employee permissions</h2><input id="emp-user" placeholder="Existing RPS username"><select id="emp-role"><option value="staff">Staff</option><option value="manager">Manager</option><option value="co-owner">Co-owner</option></select><button id="emp-assign">Assign role</button><p class="muted">The person must already have an RPS account. After assigning a role, generate a unique employee QR pass for them.</p></article><article class="card"><h2>Employee directory ('+list.length+')</h2><div class="table-list">'+list.map(e=>'<div class="employee-row"><div><strong>'+esc(e.username)+'</strong><small>'+esc(e.email||'')+' · '+esc(labelRole(e.role))+'</small></div><div><button data-make-qr="'+esc(e.username)+'">Generate QR</button><button class="danger" data-remove-role="'+esc(e.username)+'">Remove access</button></div></div>').join('')+'</div></article></div>';
 $('emp-assign').onclick=async()=>{try{await post('/staff/role-set',{username:$('emp-user').value,role:$('emp-role').value});say($('work-msg'),'Employee permissions saved.');employees();}catch(e){say($('work-msg'),e.message,true);}};
 $('workspace').querySelectorAll('[data-remove-role]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove employee access from '+b.dataset.removeRole+'?'))return;try{await post('/staff/role-set',{username:b.dataset.removeRole,role:''});say($('work-msg'),'Employee access removed.');employees();}catch(e){say($('work-msg'),e.message,true);}});
 $('workspace').querySelectorAll('[data-make-qr]').forEach(b=>b.onclick=()=>makeQr(b.dataset.makeQr));
}
function printQr(canvas,caption,url){
 const popup=window.open('','_blank');
 if(!popup){say($('work-msg'),'Your browser blocked the print window. Allow pop-ups for this site and try again.',true);return;}
 const image=canvas.toDataURL('image/png');
 popup.document.open();
 popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Employee QR pass</title><style>body{font:16px system-ui,sans-serif;text-align:center;color:#111;padding:32px}img{display:block;width:320px;height:320px;max-width:85vw;margin:24px auto}p{overflow-wrap:anywhere;color:#444}@media print{body{padding:12mm}img{width:75mm;height:75mm}}</style></head><body><h1>Employee QR pass</h1><h2>'+esc(caption)+'</h2><img src="'+image+'" alt="Scannable employee invitation QR code"><p>'+esc(url)+'</p><p>This invitation expires in 15 minutes and can only be used once.</p></body></html>');
 popup.document.close();
 popup.focus();
 window.setTimeout(()=>{if(!popup.closed)popup.print();},350);
}
async function makeQr(username){
 try{
  const data=await post('/staff/invite-create',{username});
  if(!data.token)throw new Error('The server did not return an invitation token. No QR code was created.');
  const url=new URL('/staff-portal.html',location.origin);url.searchParams.set('invite',data.token);
  const fullUrl=url.toString();
  const generated=await post('/staff/qr-generate',{invite:data.token});
  if(!generated.dataUrl||!generated.dataUrl.startsWith('data:image/'))throw new Error('OpenQR did not return a usable QR image.');
  const image=new Image();image.src=generated.dataUrl;
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('The generated QR image could not be loaded.'));});
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth||640;canvas.height=image.naturalHeight||640;
  const context=canvas.getContext('2d');if(!context)throw new Error('Your browser could not prepare the QR image for printing.');
  context.drawImage(image,0,0,canvas.width,canvas.height);
  $('qr-print-area').classList.remove('hidden');
  const caption=username+' · '+labelRole(data.role);
  $('qr-caption').textContent=caption+' · expires in 15 minutes';
  $('qr-url').textContent=fullUrl;
  $('qr-canvas').replaceChildren(canvas);
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Scannable employee invitation QR code for '+username);
  $('qr-print').disabled=false;
  $('qr-print').onclick=()=>printQr(canvas,caption,fullUrl);
  $('qr-print-area').scrollIntoView({behavior:'smooth',block:'center'});
 }catch(e){say($('work-msg'),e.message,true);}
}
async function accounts(){
 const data=await post('/staff/account-list'),list=data.users||[];
 $('workspace').innerHTML='<div class="grid"><article class="card"><h2>Create game account</h2><input id="new-user" placeholder="Username" maxlength="16"><input id="new-email" type="email" placeholder="Email"><input id="new-pass" type="password" placeholder="Temporary password (8+ characters)"><button id="create-account">Create account</button><p class="muted">Give the new employee their login credentials securely. They can change their password in their RPS profile.</p></article><article class="card"><h2>Game accounts ('+list.length+')</h2><div class="table-list">'+list.map(u=>'<div class="employee-row"><div><strong>'+esc(u.username)+'</strong><small>'+esc(u.email)+'</small></div><button class="danger" data-delete-account="'+esc(u.id)+'">Delete account</button></div>').join('')+'</div></article></div>';
 $('create-account').onclick=async()=>{try{const out=await post('/staff/account-create',{username:$('new-user').value,email:$('new-email').value,password:$('new-pass').value});say($('work-msg'),'Account created: '+out.username);accounts();}catch(e){say($('work-msg'),e.message,true);}};
 $('workspace').querySelectorAll('[data-delete-account]').forEach(b=>b.onclick=async()=>{if(!confirm('Permanently delete this account?'))return;try{await post('/staff/account-delete',{id:b.dataset.deleteAccount});say($('work-msg'),'Account deleted.');accounts();}catch(e){say($('work-msg'),e.message,true);}});
}
$('login-go').onclick=login;$('login-password').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
$('logout').onclick=()=>{gateToken='';$('login-password').value='';$('app').classList.add('hidden');$('login-card').classList.remove('hidden');say($('login-msg'),'Signed out.');};
boot();
})();