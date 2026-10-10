(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev';
  const $ = id => document.getElementById(id);
  const setup = $('setup'), game = $('game'), countSelect = $('player-count-select');
  const setupMsg = $('setup-msg'), gameStatus = $('game-status'), playersBox = $('players');
  const resultBox = $('round-result'), codeDisplay = $('room-code-display');
  const moveButtons = [...document.querySelectorAll('[data-move]')];
  let ws = null, room = '', size = 3, myId = '', picked = false, connected = false, playerNames = [];
  const token = () => { try { return localStorage.getItem('token'); } catch (_) { return null; } };
  async function premiumCheck() {
    const t = token();
    if (!t) throw new Error('Log in on the main game page first. 3–4 player mode is Premium-only.');
    const res = await fetch(API + '/account/premium', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t}),cache:'no-store'});
    const data = await res.json().catch(()=>({}));
    if (!res.ok || data.premium !== true) throw new Error('3–4 player games are for Premium members only.');
  }
  function code() { return Math.random().toString(36).slice(2,8).toUpperCase(); }
  function showSetup(message='') { closeSocket(); setup.classList.remove('hidden'); game.classList.add('hidden'); setupMsg.textContent=message; }
  function closeSocket() { if (ws) { const old=ws; ws=null; old.close(); } connected=false; picked=false; }
  function renderPlayers(names, count, max) {
    playerNames = names || [];
    playersBox.replaceChildren();
    for (let i=0;i<max;i++) {
      const p=playerNames[i];
      const card=document.createElement('div'); card.className='player';
      const name=document.createElement('strong'); name.textContent=p ? p.name : 'Waiting for player…';
      const status=document.createElement('small'); status.textContent=p ? (p.id===myId?'You':'Connected') : 'Open seat';
      card.append(name,status); playersBox.append(card);
    }
    gameStatus.textContent = 'Players connected: ' + count + '/' + max;
    moveButtons.forEach(b=>b.disabled=!(connected && count===max && !picked));
  }
  function joinRoom(roomCode, playerSize) {
    closeSocket();
    room=roomCode.toUpperCase(); size=playerSize; picked=false;
    setup.classList.add('hidden'); game.classList.remove('hidden');
    codeDisplay.textContent=room; resultBox.textContent='Connecting to room…'; gameStatus.textContent='Checking Premium access…';
    const t=token();
    ws = new WebSocket('wss://rps-server.heyboernathan.workers.dev/multi-room?room='+encodeURIComponent(room)+'&size='+size+'&token='+encodeURIComponent(t||''));
    const own=ws;
    own.addEventListener('open',()=>{if(ws!==own)return;connected=true;gameStatus.textContent='Connected. Waiting for players…';});
    own.addEventListener('message',ev=>{
      if(ws!==own)return;
      let d;try{d=JSON.parse(ev.data)}catch(_){return}
      if(d.type==='welcome'){myId=d.playerId;}
      if(d.type==='players'){
        const names=(d.names||[]).map(n=>typeof n==='string'?{name:n}:n);
        renderPlayers(names,d.count,d.max||size);
        if(d.count===size) resultBox.textContent=picked?'Your move is locked in. Waiting for everyone…':'Everyone is here. Choose your move.';
      }
      if(d.type==='move-status'){resultBox.textContent='Moves submitted: '+d.count+'/'+size+'. Your move stays hidden.';}
      if(d.type==='result'){
        picked=false; moveButtons.forEach(b=>b.classList.remove('selected'));
        const lines=(d.players||[]).map(p=>p.name+': '+p.move+' — '+p.result);
        resultBox.textContent=(d.result==='win'?'You won the round!':d.result==='loss'?'You lost the round.':'Round tied.')+'\n'+lines.join('\n');
        moveButtons.forEach(b=>b.disabled=!(connected && playerNames.length===size));
      }
      if(d.type==='error'){gameStatus.textContent=d.message||'Room error.';moveButtons.forEach(b=>b.disabled=true);}
      if(d.type==='offline'){gameStatus.textContent='The game server is offline.';moveButtons.forEach(b=>b.disabled=true);}
    });
    own.addEventListener('close',()=>{if(ws!==own)return;connected=false;moveButtons.forEach(b=>b.disabled=true);gameStatus.textContent='Disconnected. Go back and reconnect to the room.';});
    own.addEventListener('error',()=>{if(ws===own)gameStatus.textContent='Could not connect. Check the room code and try again.';});
  }
  async function start(mode) {
    try {
      setupMsg.textContent='Checking Premium…';
      await premiumCheck();
      const selected=Number(countSelect.value);
      const roomCode=mode==='create'?code():$('room-code-input').value.trim().toUpperCase();
      if(!roomCode || !/^[A-Z0-9]{4,8}$/.test(roomCode)) throw new Error('Enter a valid 4–8 character room code.');
      joinRoom(roomCode,selected);
    } catch(e) { setupMsg.textContent=e.message||'Could not open 3–4 player mode.'; }
  }
  $('create-btn').addEventListener('click',()=>start('create'));
  $('join-mode-btn').addEventListener('click',()=>{$('join-controls').classList.toggle('hidden');setupMsg.textContent='Choose the same player count as the room host.';});
  $('join-btn').addEventListener('click',()=>start('join'));
  $('copy-btn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(room);$('copy-btn').textContent='Copied!';setTimeout(()=>$('copy-btn').textContent='Copy code',1200);}catch(_){resultBox.textContent='Room code: '+room;}});
  moveButtons.forEach(b=>b.addEventListener('click',()=>{
    if(!ws||!connected||picked||playerNames.length!==size)return;
    picked=true;moveButtons.forEach(x=>{x.disabled=true;x.classList.toggle('selected',x===b);});
    resultBox.textContent='You chose '+b.dataset.move+'. Waiting for the other players…';
    ws.send(JSON.stringify({type:'move',move:b.dataset.move}));
  }));
  $('leave-btn').addEventListener('click',()=>showSetup('You left the room. Create or join another one.'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&ws&&ws.readyState===WebSocket.OPEN){/* Keep the room connected while briefly switching apps. */}});
  premiumCheck().catch(e=>{setupMsg.textContent=e.message||'Premium verification required.';});
})();