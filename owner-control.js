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
 const items=[['overview','Overview'],['employees','Employees & Passwords'],['accounts','Accounts'],['server','Server'],['challenges','Challenges'],['tournaments','Tournaments'],['plans','Plans'],['developers','Developer Lab']];
 if(role==='owner')items.push(['firewall','Firewall']);
 $('tabs').innerHTML=items.map(([id,name])=>'<button data-tab="'+id+'" class="'+(tab===id?'active':'')+'">'+name+'</button>').join('');
 $('tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;buildTabs();render();});
}
async function reload(){panel=await post('/staff/panel');buildTabs();render();}
async function firewall(){
 const root=$('workspace');
 root.innerHTML='<article class="card"><div class="section-title"><div><div class="eyebrow">Server-side protection</div><h2>Firewall Control Centre</h2></div><span class="tag">OWNER ONLY</span></div><p class="muted">These controls are enforced by the RPS Cloudflare Worker. Rate-limit events store categories and timestamps, not raw IP addresses.</p><div id="fw-status" class="notice">Loading firewall status…</div><div id="fw-controls" class="grid"></div></article><article class="card"><div class="section-title"><h2>Blocked activity</h2><button id="fw-clear" class="secondary">Clear log</button></div><div id="fw-events" class="table-list muted">Loading…</div></article>';
 try{
  const data=await post('/staff/firewall',{action:'get'});
  const config=data.config||{enabled:true,login:true,api:true,ai:true,bot:true};
  const keys=[['enabled','Firewall master switch','Enables or disables all application firewall checks.'],['login','Login protection','Limits repeated sign-in and owner reauthentication attempts to 8 per 10 minutes per IP.'],['api','API rate limiting','Limits POST API traffic to 240 requests per minute per IP.'],['ai','AI abuse protection','Limits AI endpoints to 30 requests per minute per IP.'],['bot','Large-payload screening','Rejects POST payloads larger than 12 MB.']];
  $('fw-status').innerHTML='<strong class="'+(config.enabled?'success':'error')+'">'+(config.enabled?'● FIREWALL ACTIVE':'● FIREWALL DISABLED')+'</strong><br><span class="muted">The protection is enforced at the game Worker, not just in this panel.</span>';
  $('fw-controls').innerHTML=keys.map(([key,name,desc])=>'<article class="card"><div class="section-title"><h3>'+name+'</h3><button data-fw="'+key+'" class="'+(config[key]?'good':'secondary')+'">'+(config[key]?'ON':'OFF')+'</button></div><p class="muted">'+desc+'</p></article>').join('');
  $('fw-controls').querySelectorAll('[data-fw]').forEach(button=>button.onclick=async()=>{const key=button.dataset.fw;const next={...config,[key]:!config[key]};button.disabled=true;try{await post('/staff/firewall',{action:'set',config:next});await firewall();say($('work-msg'),'Firewall settings saved on the server.');}catch(e){say($('work-msg'),e.message,true);button.disabled=false;}});
  const events=data.events||[];
  $('fw-events').innerHTML=events.length?events.map(e=>'<div class="employee-row"><div><strong>'+esc(e.category||'request')+' · '+esc(e.reason||'Blocked')+'</strong><small>'+esc(new Date(e.at).toLocaleString())+'</small></div><span class="tag">BLOCKED</span></div>').join(''):'No blocked requests have been recorded yet.';
  $('fw-clear').onclick=async()=>{if(!confirm('Clear the firewall event log?'))return;try{await post('/staff/firewall',{action:'clear-events'});await firewall();say($('work-msg'),'Firewall log cleared.');}catch(e){say($('work-msg'),e.message,true);}};
 }catch(e){$('fw-status').textContent='Could not load firewall: '+e.message;$('fw-status').className='notice error';}
}
async function developers(){
 const root=$('workspace');root.innerHTML='<article class="card"><h2>Website change proposals</h2><p class="muted">Review Legend developer submissions. Approval publishes validated theme settings. Submitted JavaScript is never executed.</p><div id="dev-proposals" class="table-list">Loading proposals…</div></article><article class="card"><h2>Legacy developer accounts</h2><div id="dev-accounts" class="table-list">Loading…</div></article><article class="card"><h2>Security test submissions</h2><div id="dev-submissions" class="table-list">Loading…</div></article>';
 try{
  const data=await post('/developer/admin',{action:'list'});
  const proposals=data.proposals||[];
  $('dev-proposals').innerHTML='<div class="section-title"><p class="muted">Revoke restores the settings saved immediately before the approval. Older approvals made before rollback history was added are marked as legacy.</p><button id="dev-revoke-all" class="danger" '+(proposals.some(p=>p.rollback_status==='active')?'':'disabled')+'>Revoke All</button></div>'+(proposals.length?proposals.map(p=>{let cfg={};try{cfg=JSON.parse(p.config_json||'{}');}catch{}const canRevoke=p.status==='approved'&&p.rollback_status==='active';const legacy=p.status==='approved'&&!p.rollback_status;return '<article class="card"><div class="section-title"><div><h3>'+esc(p.title)+'</h3><p class="muted">'+esc(p.username)+' · '+esc(p.created_at)+' · '+esc(p.status)+'</p></div><span class="tag">'+esc(p.status)+'</span></div><p class="muted">Settings: '+esc(JSON.stringify(cfg))+'</p>'+(legacy?'<p class="msg">Legacy approval — no saved rollback snapshot.</p>':'')+'<details><summary>Review submitted CSS / code</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;background:#080f1e;border:1px solid #344462;border-radius:10px;padding:14px;max-height:420px;overflow:auto">'+esc(p.source_code)+'</pre></details><div class="actions">'+(p.status==='pending'?'<button class="good" data-proposal-action="approved" data-proposal-id="'+esc(p.id)+'">Approve & publish</button><button class="danger" data-proposal-action="declined" data-proposal-id="'+esc(p.id)+'">Decline</button>':'')+(canRevoke?'<button class="danger" data-proposal-revoke="'+esc(p.id)+'">Revoke</button>':'')+'</div></article>';}).join(''):'No website proposals yet.');
  const revokeAll=$('dev-revoke-all');if(revokeAll)revokeAll.onclick=async()=>{if(!confirm('Revoke all tracked active approvals and restore the previous website settings?'))return;revokeAll.disabled=true;try{const result=await post('/developer/admin',{action:'revoke-all'});await developers();say($('work-msg'),result.revoked+' approved change(s) revoked. Previous settings restored.');}catch(e){say($('work-msg'),e.message,true);revokeAll.disabled=false;}};
  $('dev-proposals').querySelectorAll('[data-proposal-revoke]').forEach(b=>b.onclick=async()=>{if(!confirm('Revoke this approved change and restore the previous settings?'))return;b.disabled=true;try{await post('/developer/admin',{action:'revoke-proposal',proposalId:b.dataset.proposalRevoke});await developers();say($('work-msg'),'Approved change revoked. Previous settings restored.');}catch(e){say($('work-msg'),e.message,true);b.disabled=false;}});
  $('dev-accounts').innerHTML=(data.developers||[]).length?(data.developers||[]).map(d=>'<div class="employee-row"><div><strong>'+esc(d.username)+'</strong><small>'+esc(d.account_id)+' · '+esc(d.created_at)+'</small><div class="tag">'+esc(d.status)+'</div></div><div class="actions">'+(d.status!=='approved'?'<button class="good" data-dev-status="approved" data-dev-id="'+esc(d.account_id)+'">Approve</button>':'')+(d.status!=='revoked'?'<button class="danger" data-dev-status="revoked" data-dev-id="'+esc(d.account_id)+'">Revoke</button>':'')+'</div></div>').join(''):'No legacy developer accounts.';
  $('dev-submissions').innerHTML=(data.submissions||[]).length?(data.submissions||[]).map(s=>'<article class="card"><h3>'+esc(s.title)+'</h3><p class="muted">'+esc(s.username)+' · '+esc(s.created_at)+' · '+esc(s.detected_type)+'</p><p>'+esc(s.defence_result)+'</p><details><summary>View submitted code</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(s.submitted_code)+'</pre></details></article>').join(''):'No security tests.';
  $('dev-proposals').querySelectorAll('[data-proposal-action]').forEach(b=>b.onclick=async()=>{const status=b.dataset.proposalAction;if(!confirm((status==='approved'?'Approve and publish':'Decline')+' this proposal?'))return;try{await post('/developer/admin',{action:'review-proposal',proposalId:b.dataset.proposalId,status,note:status==='approved'?'Approved by Owner':'Declined by Owner'});await developers();say($('work-msg'),status==='approved'?'Approved settings are now published to the live website.':'Proposal declined. The live website was not changed.');}catch(e){say($('work-msg'),e.message,true);}});
  $('dev-accounts').querySelectorAll('[data-dev-status]').forEach(b=>b.onclick=async()=>{if(!confirm((b.dataset.devStatus==='approved'?'Approve':'Revoke')+' developer access for this account?'))return;try{await post('/developer/admin',{action:'set-status',accountId:b.dataset.devId,status:b.dataset.devStatus});await developers();say($('work-msg'),'Developer access updated.');}catch(e){say($('work-msg'),e.message,true);}});
 }catch(e){root.innerHTML='<article class="card"><h2>Developer management unavailable</h2><p class="msg error">'+esc(e.message)+'</p></article>';}
}
function render(){
 const root=$('workspace');$('work-msg').textContent='';
 if(tab==='firewall'){firewall();return;}
 if(tab==='developers'){developers();return;}
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
 const [data,accountData]=await Promise.all([post('/staff/role-list'),post('/staff/account-list')]);
 const list=data.staff||[],accountsByUsername=new Map((accountData.users||[]).map(u=>[String(u.username||'').toLowerCase(),u]));
 $('workspace').innerHTML='<div class="grid"><article class="card"><h2>Assign employee permissions</h2><input id="emp-user" placeholder="Existing RPS username"><select id="emp-role"><option value="staff">Staff</option><option value="manager">Manager</option><option value="co-owner">Co-owner</option></select><button id="emp-assign">Assign role</button><p class="muted">The person must already have an RPS account. After assigning a role, generate a unique employee QR pass for them.</p></article><article class="card"><h2>Employee directory ('+list.length+')</h2><div class="table-list">'+list.map(e=>'<div class="employee-row"><div><strong>'+esc(e.username)+'</strong><small>'+esc(e.email||'')+' · '+esc(labelRole(e.role))+'</small></div><div><button class="secondary" data-reset-staff="'+esc((accountsByUsername.get(String(e.username||'').toLowerCase())||{}).id||'')+'" data-staff-name="'+esc(e.username)+'">Change password</button><button data-make-qr="'+esc(e.username)+'">Generate QR</button><button class="danger" data-remove-role="'+esc(e.username)+'">Remove access</button></div></div>').join('')+'</div></article></div>';
 $('emp-assign').onclick=async()=>{try{await post('/staff/role-set',{username:$('emp-user').value,role:$('emp-role').value});say($('work-msg'),'Employee permissions saved.');employees();}catch(e){say($('work-msg'),e.message,true);}};
 $('workspace').querySelectorAll('[data-remove-role]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove employee access from '+b.dataset.removeRole+'?'))return;try{await post('/staff/role-set',{username:b.dataset.removeRole,role:''});say($('work-msg'),'Employee access removed.');employees();}catch(e){say($('work-msg'),e.message,true);}});
 $('workspace').querySelectorAll('[data-reset-staff]').forEach(b=>b.onclick=()=>resetAccountPassword(b.dataset.resetStaff,b.dataset.staffName));
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
async function resetAccountPassword(id,username){
 if(!id){say($('work-msg'),'Could not match this staff member to a game account. Refresh the page and try again.',true);return;}
 const password=prompt('Set a new password for '+username+' (8-128 characters). Existing passwords cannot be viewed.');
 if(password===null)return;
 if(password.length<8||password.length>128){say($('work-msg'),'Password must be 8-128 characters.',true);return;}
 const confirmPassword=prompt('Enter the new password again.');
 if(confirmPassword===null)return;
 if(password!==confirmPassword){say($('work-msg'),'The passwords do not match.',true);return;}
 if(!confirm('Change the password for '+username+'?'))return;
 try{await post('/staff/account-password-reset',{id,password});say($('work-msg'),'Password changed successfully for '+username+'.');}
 catch(e){say($('work-msg'),e.message,true);}
}
async function accounts(){
 const data=await post('/staff/account-list'),list=data.users||[];
 $('workspace').innerHTML='<div class="grid"><article class="card"><h2>Create game account</h2><input id="new-user" placeholder="Username" maxlength="16"><input id="new-email" type="email" placeholder="Email"><input id="new-pass" type="password" placeholder="Temporary password (8+ characters)"><button id="create-account">Create account</button><p class="muted">Passwords are securely hashed and cannot be viewed. Use Reset password to set a new password for a non-owner account.</p></article><article class="card"><h2>Game accounts ('+list.length+')</h2><div class="table-list">'+list.map(u=>'<div class="employee-row"><div><strong>'+esc(u.username)+'</strong><small>'+esc(u.email)+'</small></div><button class="secondary" data-reset-account="'+esc(u.id)+'">Reset password</button><button class="danger" data-delete-account="'+esc(u.id)+'">Delete account</button></div>').join('')+'</div></article></div>';
 $('create-account').onclick=async()=>{try{const out=await post('/staff/account-create',{username:$('new-user').value,email:$('new-email').value,password:$('new-pass').value});say($('work-msg'),'Account created: '+out.username);accounts();}catch(e){say($('work-msg'),e.message,true);}};
 $('workspace').querySelectorAll('[data-delete-account]').forEach(b=>b.onclick=async()=>{if(!confirm('Permanently delete this account?'))return;try{await post('/staff/account-delete',{id:b.dataset.deleteAccount});say($('work-msg'),'Account deleted.');accounts();}catch(e){say($('work-msg'),e.message,true);}});
 $('workspace').querySelectorAll('[data-reset-account]').forEach(b=>b.onclick=async()=>{const password=prompt('Enter a new password (8-128 characters). Existing passwords cannot be viewed.');if(password===null)return;if(password.length<8||password.length>128){say($('work-msg'),'Password must be 8-128 characters.',true);return;}const confirmPassword=prompt('Enter the new password again.');if(confirmPassword===null)return;if(password!==confirmPassword){say($('work-msg'),'The passwords do not match.',true);return;}if(!confirm('Reset this account password?'))return;try{await post('/staff/account-password-reset',{id:b.dataset.resetAccount,password});say($('work-msg'),'Password reset successfully.');}catch(e){say($('work-msg'),e.message,true);}});
}
$('login-go').onclick=login;$('login-password').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
$('logout').onclick=()=>{gateToken='';$('login-password').value='';$('app').classList.add('hidden');$('login-card').classList.remove('hidden');say($('login-msg'),'Signed out.');};
boot();
})();