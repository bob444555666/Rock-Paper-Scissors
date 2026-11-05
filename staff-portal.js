(() => {
'use strict';
const API='https://rps-server.heyboernathan.workers.dev';
const $=id=>document.getElementById(id);
const gate=$('gate'), dashboard=$('dashboard'), gateMsg=$('gate-msg'), workMsg=$('work-msg');
let invite=sessionStorage.getItem('rps-staff-invite')||new URLSearchParams(location.search).get('invite')||'';
let token=localStorage.getItem('token')||'';
let role='', gateToken='', panel={}, activeTab='overview', scanner=null, qrTimer=null;
const roles=['staff','manager','co-owner','owner'];
const labelRole=r=>({'staff':'Staff','manager':'Manager','co-owner':'Co-owner','owner':'Owner'}[r]||'');
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=(el,msg,bad=false)=>{el.textContent=msg||'';el.className='msg'+(bad?' error':'');};
async function post(path,body={}) {
  const res=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,token,gate:gateToken}),cache:'no-store'});
  const data=await res.json().catch(()=>({error:'The server returned an unreadable response.'}));
  if(!res.ok) throw new Error(data.error||'Request failed.');
  return data;
}
function extractInvite(value) {
  const v=String(value||'').trim();
  if(!v)return '';
  try { const u=new URL(v); return u.searchParams.get('invite')||''; } catch(_) {}
  return v.replace(/[^A-Za-z0-9_-]/g,'').slice(0,100);
}
function showLogin() {
  $('login-box').classList.remove('hidden');
  $('gate-title').textContent='Employee sign in';
  $('gate-copy').textContent='Your QR pass has been recognized. Sign in with the RPS account assigned to this employee pass.';
  $('manual-invite').classList.add('hidden');
  $('manual-go').classList.add('hidden');
  $('scan-start').classList.add('hidden');
  $('scan-stop').classList.add('hidden');
}
async function stopScanner() {
  if(scanner) { try { await scanner.stop(); await scanner.clear(); } catch(_) {} scanner=null; }
  $('scan-stop').classList.add('hidden');
  $('scan-start').classList.remove('hidden');
}
async function setInvite(value) {
  const found=extractInvite(value);
  if(!found) { say(gateMsg,'That does not look like a valid employee QR code.',true); return; }
  invite=found;
  sessionStorage.setItem('rps-staff-invite',invite);
  await stopScanner();
  showLogin();
  say(gateMsg,'QR code recognized. Sign in to verify the assigned employee account.');
  token=localStorage.getItem('token')||'';
  // Do not consume a single-use invite until the employee signs in with the assigned account.

}
async function claim() {
  if(!invite||!token)return;
  try {
    const data=await post('/staff/claim',{invite});
    role=data.role;
    sessionStorage.removeItem('rps-staff-invite');
    history.replaceState({},'',location.pathname);
    invite='';
    return true;
  } catch(e) { say(gateMsg,e.message,true); return false; }
}
async function startScanner() {
  if(!window.Html5Qrcode) { say(gateMsg,'Camera scanning is unavailable in this browser. Paste the QR link or code instead.',true); return; }
  try {
    scanner=new Html5Qrcode('qr-reader');
    $('scan-start').classList.add('hidden'); $('scan-stop').classList.remove('hidden');
    await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:240}},decoded=>setInvite(decoded));
  } catch(e) { scanner=null; $('scan-start').classList.remove('hidden'); $('scan-stop').classList.add('hidden'); say(gateMsg,'Could not open the camera. Check camera permission or paste the code manually.',true); }
}
async function login() {
  const id=$('login-id').value.trim(), password=$('login-password').value;
  if(!password) { say(gateMsg,'Enter your account password.',true); return; }
  $('login-go').disabled=true; say(gateMsg,'Verifying your password…');
  try {
    if(invite) {
      if(!id) throw new Error('Enter your username/email for the employee QR pass.');
      const res=await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,password})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'Sign in failed.');
      token=data.token; localStorage.setItem('token',token);
      const claimed=await claim();
      if(!claimed) return;
    } else {
      token=localStorage.getItem('token')||token;
      if(!token) throw new Error('Scan your employee QR pass and sign in first.');
    }
    const verify=await fetch(API+'/staff/reauth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password}),cache:'no-store'});
    const verified=await verify.json();
    if(!verify.ok) throw new Error(verified.error||'Password verification failed.');
    gateToken=verified.gate;
    $('login-password').value='';
    await openDashboard();
  } catch(e) { say(gateMsg,e.message,true); }
  finally { $('login-go').disabled=false; }
}
async function openDashboard() {
  try {
    token=localStorage.getItem('token')||token;
    if(!token) throw new Error('Sign in to continue.');
    if(!gateToken) { dashboard.classList.add('hidden'); gate.classList.remove('hidden'); showLogin(); say(gateMsg,'Enter your password to open the Staff Portal.'); return; }
    panel=await post('/staff/panel');
    role=panel.role||role;
    gate.classList.add('hidden'); dashboard.classList.remove('hidden');
    $('role-pill').textContent=labelRole(role); $('role-pill').classList.remove('hidden');
    $('welcome-title').textContent='Welcome, '+(panel.username||'team member');
    $('welcome-copy').textContent='You are signed in as '+labelRole(role)+'. Staff actions are protected by your account permissions.';
    $('owner-link').classList.toggle('hidden',!['owner','co-owner'].includes(role));
    buildTabs(); renderTab();
  } catch(e) {
    dashboard.classList.add('hidden'); gate.classList.remove('hidden');
    say(gateMsg,e.message,true);
  }
}
function buildTabs() {
  const tabs=[['overview','Overview'],['challenges','Challenges'],['tournaments','Tournaments']];
  if(['manager','co-owner','owner'].includes(role)) tabs.push(['server','Server'],['plans','Plans'],['employees','Employees']);
  if(['co-owner','owner'].includes(role)) tabs.push(['accounts','Accounts']);
  $('tabs').innerHTML=tabs.map(([id,name])=>'<button type="button" data-tab="'+id+'" class="'+(activeTab===id?'active':'')+'">'+name+'</button>').join('');
  $('tabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.tab;buildTabs();renderTab();}));
}
function renderTab() {
  const root=$('workspace'); workMsg.textContent='';
  if(activeTab==='overview') {
    root.innerHTML='<div class="grid"><article class="card"><h3>Server status</h3><p class="status '+(panel.online?'on':'off')+'">'+(panel.online?'● ONLINE':'● OFFLINE')+'</p><p class="muted">Live status from the RPS server.</p></article><article class="card"><h3>Your permissions</h3><p><span class="tag">'+labelRole(role)+'</span></p><p class="muted">'+(role==='staff'?'You can run challenges and tournaments.':role==='manager'?'You have full staff controls, but cannot add or delete accounts.':role==='co-owner'?'You have owner-level controls, but the owner account is protected.':'You have full owner control.')+'</p></article></div>';
    return;
  }
  if(activeTab==='server') {
    root.innerHTML='<article class="card"><h2>RPS Server</h2><p class="status '+(panel.online?'on':'off')+'">'+(panel.online?'● SERVER ONLINE':'● SERVER OFFLINE')+'</p><button id="server-on" class="good">Turn server on</button><button id="server-off" class="danger">Turn server off</button></article>';
    $('server-on').onclick=()=>server(true); $('server-off').onclick=()=>server(false); return;
  }
  if(activeTab==='challenges') {
    root.innerHTML='<div class="grid"><article class="card"><h2>Create challenge</h2><input id="ch-user" placeholder="Challenge name / player label"><input id="ch-pass" placeholder="One-time challenge password" type="password"><input id="ch-prize" placeholder="Prize (optional)"><label class="muted">Expires after</label><select id="ch-hours">'+hours()+'</select><button id="ch-create">Create challenge</button></article><article class="card"><h2>Current challenges</h2><div id="ch-list" class="table-list">'+(panel.challenges||[]).map(challengeRow).join('')+'</div></article></div>';
    $('ch-create').onclick=createChallenge;
    (panel.challenges||[]).forEach(c=>{const ex=$('ch-ext-'+c.id),del=$('ch-del-'+c.id);if(ex)ex.onclick=()=>extend('extend',c.id);if(del)del.onclick=()=>remove('delete',c.id);}); return;
  }
  if(activeTab==='tournaments') {
    root.innerHTML='<div class="grid"><article class="card"><h2>Create tournament</h2><input id="to-name" placeholder="Tournament name"><input id="to-prize" placeholder="Prize text (optional)"><label class="muted">Room duration</label><select id="to-hours">'+hours()+'</select><button id="to-create">Create tournament</button></article><article class="card"><h2>Tournament rooms</h2><div id="to-list" class="table-list">'+(panel.tournaments||[]).map(tournamentRow).join('')+'</div></article></div>';
    $('to-create').onclick=createTournament;
    (panel.tournaments||[]).forEach(t=>{const ex=$('to-ext-'+t.id),del=$('to-del-'+t.id),add=$('to-add-'+t.id),start=$('to-start-'+t.id);if(ex)ex.onclick=()=>extend('textend',t.id);if(del)del.onclick=()=>remove('tdelete',t.id);if(add)add.onclick=()=>addPlayer(t.id);if(start)start.onclick=()=>action('tstart',{tid:t.id},'Tournament started.');}); return;
  }
  if(activeTab==='plans') {
    const plans=panel.premium||[];
    root.innerHTML='<div class="grid"><article class="card"><h2>Grant a plan</h2><input id="plan-user" placeholder="RPS username"><select id="plan-name"><option value="individual">Plus</option><option value="duo">Pro</option><option value="family">Legend</option></select><button id="plan-grant">Grant selected plan for life</button></article><article class="card"><h2>Plan access ('+plans.length+')</h2><div class="table-list">'+plans.map(p=>'<div class="employee-row"><div><strong>'+esc(p.username)+'</strong><small>'+esc((p.lifetime?'Lifetime ':'')+({'individual':'Plus','duo':'Pro','family':'Legend'}[p.plan]||'Plus'))+'</small></div><button class="danger" data-remove-plan="'+esc(p.id)+'">Remove</button></div>').join('')+'</div></article></div>';
    $('plan-grant').onclick=()=>action('prem-plan',{username:$('plan-user').value,plan:$('plan-name').value,lifetime:true},'Plan granted.');
    root.querySelectorAll('[data-remove-plan]').forEach(b=>b.onclick=()=>action('prem-remove',{id:b.dataset.removePlan},'Plan access removed.')); return;
  }
  if(activeTab==='employees') { renderEmployees(); return; }
  if(activeTab==='accounts') { renderAccounts(); return; }
}
function hours(){return Array.from({length:20},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+' hour'+(i?'s':'')+'</option>').join('');}
function challengeRow(c){return '<div class="employee-row"><div><strong>'+esc(c.username)+' · '+esc(c.id)+'</strong><small>'+esc(c.status)+' · '+new Date(c.expiresAt).toLocaleString()+'</small></div><div class="actions"><button class="secondary" id="ch-ext-'+esc(c.id)+'">Extend</button><button class="danger" id="ch-del-'+esc(c.id)+'">Delete</button></div></div>';}
function tournamentRow(t){return '<div class="employee-row"><div><strong>'+esc(t.name||'Tournament')+'</strong><small>'+esc(t.status)+' · '+(t.players||[]).length+' players</small></div><div class="actions">'+(t.status==='setup'?'<button class="secondary" id="to-add-'+esc(t.id)+'">Add player</button><button id="to-start-'+esc(t.id)+'">Start</button>':'')+'<button class="secondary" id="to-ext-'+esc(t.id)+'">Extend</button><button class="danger" id="to-del-'+esc(t.id)+'">Delete</button></div></div>';}
async function action(act,body,msg){try{await post('/staff/'+act,body);say(workMsg,msg||'Saved.');await reloadPanel();}catch(e){say(workMsg,e.message,true);}}
async function reloadPanel(){panel=await post('/staff/panel');role=panel.role||role;buildTabs();renderTab();}
async function server(on){if(!confirm(on?'Turn the RPS server on?':'Turn the RPS server off for everyone?'))return;await action('server',{on},on?'Server is online.':'Server is offline.');}
async function createChallenge(){await action('create',{username:$('ch-user').value,password:$('ch-pass').value,prize:$('ch-prize').value,hours:$('ch-hours').value},'Challenge created.');}
async function extend(act,id){await action(act,{id:id,tid:id,hours:1},'Expiry extended.');}
async function remove(act,id){if(!confirm('Delete this item?'))return;await action(act,{id:id,tid:id},'Deleted.');}
async function createTournament(){await action('tcreate',{name:$('to-name').value,prizeType:'text',prizeText:$('to-prize').value,hours:$('to-hours').value},'Tournament created.');}
async function addPlayer(tid){const username=prompt('Player account username');if(!username)return;const password=prompt('Temporary tournament password (4+ characters)');if(!password)return;await action('tadd',{tid,username,password},'Player added.');}
async function renderEmployees(){
  const data=await post('/staff/role-list'); const list=data.staff||[];
  const opts=role==='manager'?'<option value="staff">Staff</option>':'<option value="staff">Staff</option><option value="manager">Manager</option><option value="co-owner">Co-owner</option>';
  $('workspace').innerHTML='<div class="grid"><article class="card"><h2>Assign employee access</h2><input id="emp-user" placeholder="Existing RPS username"><select id="emp-role">'+opts+'</select><button id="emp-add">Assign role</button><p class="muted">The employee must have an existing RPS account. Generate a one-time QR pass after assigning their role.</p></article><article class="card"><h2>Team members ('+list.length+')</h2><div class="table-list">'+list.map(e=>'<div class="employee-row"><div><strong>'+esc(e.username)+'</strong><small>'+esc(labelRole(e.role))+'</small></div><div class="actions"><button data-qr="'+esc(e.username)+'">Create QR pass</button><button class="danger" data-remove-employee="'+esc(e.username)+'">Remove</button></div></div>').join('')+'</div></article></div><article id="qr-output" class="card hidden"><div class="section-title"><div><h2>Employee QR pass</h2><p id="qr-caption" class="muted"></p></div><button id="qr-print">Print QR code</button></div><div id="qr-canvas" class="center"></div><p id="qr-url" class="muted"></p></article>';
  $('emp-add').onclick=async()=>{try{await post('/staff/role-set',{username:$('emp-user').value,role:$('emp-role').value});say(workMsg,'Employee role assigned.');renderEmployees();}catch(e){say(workMsg,e.message,true);}};
  $('workspace').querySelectorAll('[data-remove-employee]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove staff access from '+b.dataset.removeEmployee+'?'))return;try{await post('/staff/role-set',{username:b.dataset.removeEmployee,role:''});say(workMsg,'Employee access removed.');renderEmployees();}catch(e){say(workMsg,e.message,true);}});
  $('workspace').querySelectorAll('[data-qr]').forEach(b=>b.onclick=()=>makeQr(b.dataset.qr));
}
function printQr(canvas,caption,url){
  const popup=window.open('','_blank');
  if(!popup){say(workMsg,'Your browser blocked the print window. Allow pop-ups for this site and try again.',true);return;}
  const image=canvas.toDataURL('image/png');
  popup.document.open();
  popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Employee QR pass</title><style>body{font:16px system-ui,sans-serif;text-align:center;color:#111;padding:32px}img{display:block;width:320px;height:320px;max-width:85vw;margin:24px auto}p{overflow-wrap:anywhere;color:#444}@media print{body{padding:12mm}img{width:75mm;height:75mm}}</style></head><body><h1>Employee QR pass</h1><h2>'+esc(caption)+'</h2><img src="'+image+'" alt="Scannable employee invitation QR code"><p>'+esc(url)+'</p><p>This invitation expires in 15 minutes and can only be used once.</p></body></html>');
  popup.document.close();
  popup.focus();
  popup.onload=()=>popup.print();
}
async function makeQr(username){
  try{
    const data=await post('/staff/invite-create',{username});
    if(!data.token)throw new Error('The server did not return an invitation token. No QR code was created.');
    if(!window.QRCode||typeof QRCode.toCanvas!=='function')throw new Error('The QR generator did not load. Refresh the page and try again.');
    const target=new URL('/staff-portal.html',location.origin);target.searchParams.set('invite',data.token);
    const url=target.toString();
    const canvas=await QRCode.toCanvas(url,{width:320,margin:3,errorCorrectionLevel:'H'});
    if(!canvas||!canvas.toDataURL)throw new Error('The QR generator did not return a printable image.');
    $('qr-output').classList.remove('hidden');
    const caption=username+' · '+labelRole(data.role);
    $('qr-caption').textContent=caption+' · expires in 15 minutes';
    $('qr-url').textContent=url;
    $('qr-canvas').replaceChildren(canvas);
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Scannable employee invitation QR code for '+username);
    $('qr-print').disabled=false;
    $('qr-print').onclick=()=>printQr(canvas,caption,url);
  }catch(e){say(workMsg,e.message,true);}
}
async function renderAccounts(){
  const data=await post('/staff/account-list');const list=data.users||[];
  $('workspace').innerHTML='<div class="grid"><article class="card"><h2>Create RPS account</h2><input id="new-user" placeholder="Username" maxlength="16"><input id="new-email" type="email" placeholder="Email address"><input id="new-pass" type="password" placeholder="Temporary password (8+ characters)"><button id="account-create">Create account</button><p class="muted">Give the employee their username and temporary password securely. They can change the password in their game profile.</p></article><article class="card"><h2>Accounts ('+list.length+')</h2><div class="table-list">'+list.map(u=>'<div class="employee-row"><div><strong>'+esc(u.username)+'</strong><small>'+esc(u.email)+'</small></div><button class="danger" data-delete-account="'+esc(u.id)+'">Delete account</button></div>').join('')+'</div></article></div>';
  $('account-create').onclick=async()=>{try{const out=await post('/staff/account-create',{username:$('new-user').value,email:$('new-email').value,password:$('new-pass').value});say(workMsg,'Account created for '+out.username+'.');renderAccounts();}catch(e){say(workMsg,e.message,true);}};
  $('workspace').querySelectorAll('[data-delete-account]').forEach(b=>b.onclick=async()=>{if(!confirm('Permanently delete this account? This cannot be undone.'))return;try{await post('/staff/account-delete',{id:b.dataset.deleteAccount});say(workMsg,'Account deleted.');renderAccounts();}catch(e){say(workMsg,e.message,true);}});
}
$('scan-start').addEventListener('click',startScanner);
$('scan-stop').addEventListener('click',stopScanner);
$('manual-go').addEventListener('click',()=>setInvite($('manual-invite').value));
$('login-go').addEventListener('click',login);
$('login-password').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
$('logout').addEventListener('click',()=>{gateToken='';sessionStorage.removeItem('rps-staff-verified');location.href='/';});
window.addEventListener('beforeunload',()=>{if(scanner)scanner.stop().catch(()=>{});});
if(invite){sessionStorage.setItem('rps-staff-invite',invite);showLogin();}
else if(token){post('/staff/me').then(me=>{if(me.staff){role=me.role;showLogin();$('gate-title').textContent='Staff Portal sign in';$('gate-copy').textContent='Enter your password every time you open the Staff Portal.';}}).catch(()=>{});}
})();
