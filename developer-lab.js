(() => {
'use strict';
const API='https://rps-server.heyboernathan.workers.dev';
const $=id=>document.getElementById(id);
const token=()=>localStorage.getItem('token')||'';
async function post(path,body={}){const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,token:token()}),cache:'no-store'});const d=await r.json().catch(()=>({error:'Server response could not be read.'}));if(!r.ok)throw new Error(d.error||'Request failed.');return d;}
function show(id){['loading','apply','pending','revoked','lab'].forEach(x=>$(x).classList.toggle('hidden',x!==id));}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const examples={
infinite_xp:'// Security test: try to grant XP from the browser\nconst player = { xp: 0 };\nplayer.xp = 999999; // This must not change server-side XP',
unlock_all:'// Security test: try to unlock a paid item in the browser\nconst inventory = { premiumSkin: false };\ninventory.premiumSkin = true; // Client-only change must not grant entitlement',
score_tamper:'// Security test: try to submit a fake match result\nfetch("/api/match/result", {\n  method: "POST",\n  body: JSON.stringify({ result: "win", xp: 50000 })\n}); // Server must validate the match'
};
async function history(){const d=await post('/developer/history');const rows=d.submissions||[];$('history').innerHTML=rows.length?rows.map(x=>'<div class="sim" style="margin:8px 0"><strong>'+esc(x.title)+'</strong><p class="code-note">'+esc(x.created_at)+' · '+esc(x.detected_type)+'</p><p>'+esc(x.defence_result)+'</p></div>').join(''):'No tests submitted yet.';}
async function boot(){if(!token()){show('apply');$('apply-msg').textContent='Sign in to your normal game account first, then request developer access.';$('apply-btn').disabled=true;return;}try{const d=await post('/developer/me');if(d.status==='approved'){show('lab');await history();}else if(d.status==='pending')show('pending');else if(d.status==='revoked')show('revoked');else show('apply');}catch(e){show('apply');$('apply-msg').textContent=e.message;}}
$('apply-btn').onclick=async()=>{try{$('apply-btn').disabled=true;await post('/developer/apply');$('apply-msg').textContent='Request sent. Waiting for owner approval.';show('pending');}catch(e){$('apply-msg').textContent=e.message;$('apply-btn').disabled=false;}};
document.querySelectorAll('.example').forEach(b=>b.onclick=()=>{$('hack-title').value=({infinite_xp:'Infinite XP attempt',unlock_all:'Unlock-all attempt',score_tamper:'Fake match result'})[b.dataset.kind];$('hack-code').value=examples[b.dataset.kind];$('hack-code').focus();});
$('submit-hack').onclick=async()=>{const title=$('hack-title').value.trim(),code=$('hack-code').value;if(!title||!code.trim()){$('submit-msg').textContent='Add a title and some test code first.';return;}try{$('submit-hack').disabled=true;$('submit-msg').textContent='Analysing test…';const d=await post('/developer/submit',{title,code});$('result').classList.remove('hidden');$('result').textContent='DEFENCE SIMULATION: '+d.defence.status+'\nTest type: '+d.defence.detectedType+'\nDecoy generated: '+d.defence.decoyId+'\n\n'+d.defence.message;$('submit-msg').textContent='Test saved to your developer history.';await history();}catch(e){$('submit-msg').textContent=e.message;}finally{$('submit-hack').disabled=false;}};
boot();
})();