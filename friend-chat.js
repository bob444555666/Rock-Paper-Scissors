/* Chat with Friends — authenticated text chat and cross-platform WebRTC audio/video calls. */
(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev';
  const token = () => { try { return localStorage.getItem('token') || ''; } catch { return ''; } };
  const myUserId = () => { try { const p=token().split('.')[0].replace(/-/g,'+').replace(/_/g,'/'); return JSON.parse(atob(p)).sub || ''; } catch { return ''; } };
  const el = (tag, props={}, ...children) => { const n=document.createElement(tag); Object.assign(n,props); children.forEach(c=>n.append(c)); return n; };
  const style=el('style');
  style.textContent=`
    #friend-chat-screen{position:fixed;inset:0;z-index:2147483100;display:flex;flex-direction:column;color:#f5f8ff;background:radial-gradient(ellipse at 15% 0%,#183c55 0,transparent 42%),radial-gradient(ellipse at 100% 100%,#34235a 0,transparent 45%),#080e19;font:14px Inter,system-ui,sans-serif}
    #friend-chat-screen[hidden]{display:none}
    #friend-chat-screen *{box-sizing:border-box}
    .fc-top{display:flex;align-items:center;gap:12px;padding:calc(14px + env(safe-area-inset-top)) 18px 14px;border-bottom:1px solid #ffffff1c;background:#09111dcc;backdrop-filter:blur(16px)}
    .fc-back{border:1px solid #ffffff30;border-radius:12px;padding:9px 12px;color:white;background:#ffffff0d;cursor:pointer}
    .fc-brand{font-size:17px;font-weight:900;letter-spacing:.02em}.fc-brand small{display:block;color:#91a8c3;font-size:11px;font-weight:500}
    .fc-layout{display:grid;grid-template-columns:minmax(210px,300px) 1fr;gap:16px;min-height:0;flex:1;padding:16px;max-width:1200px;width:100%;margin:auto}
    .fc-side,.fc-main{min-height:0;border:1px solid #ffffff1c;border-radius:20px;background:#111d2dcc;box-shadow:0 20px 60px #0005;overflow:hidden}
    .fc-side{display:flex;flex-direction:column}.fc-side h3{margin:0;padding:18px 16px 10px;color:#9db3cd;font-size:11px;letter-spacing:.16em;text-transform:uppercase}
    .fc-discover{display:flex;flex-direction:column;min-height:0;border-top:1px solid #ffffff18}.fc-discover h3{padding-top:14px}
    .fc-discover-search{padding:0 12px 9px}.fc-discover-search input{width:100%;background:#08121f;border:1px solid #45617c;border-radius:11px;padding:10px;color:white}
    .fc-directory{overflow:auto;max-height:34vh;padding:0 9px 12px}.fc-directory-person{display:flex;align-items:center;gap:8px;padding:8px 9px;border-radius:10px;color:#eaf2ff}
    .fc-directory-person span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.fc-directory-person button{border:1px solid #63d9e8;border-radius:9px;background:#173b4b;color:#a9f7ff;padding:6px 9px;font-weight:800;cursor:pointer}
    .fc-notify{margin-left:auto;border:1px solid #ffffff30;border-radius:10px;padding:8px 10px;background:#ffffff10;color:#e8f5ff;cursor:pointer;font-size:12px}
    .fc-top{flex-wrap:wrap}.fc-top .fc-notify{margin-left:auto}
    .fc-directory-empty{padding:10px;color:#8fa7c0;font-size:12px}
    .fc-add{display:flex;gap:7px;padding:0 12px 12px}.fc-add input,.fc-compose input{min-width:0;flex:1;background:#08121f;border:1px solid #45617c;border-radius:11px;padding:11px;color:white}
    .fc-add button,.fc-action{border:1px solid #63d9e8;background:linear-gradient(135deg,#48d9e9,#7c9dff);color:#06121c;font-weight:850;border-radius:11px;padding:10px 13px;cursor:pointer}
    .fc-list{overflow:auto;padding:4px 9px 14px}.fc-person{display:flex;align-items:center;gap:10px;width:100%;padding:12px;border:1px solid transparent;border-radius:13px;background:transparent;color:white;text-align:left;cursor:pointer}
    .fc-person.active{background:#40d6e51c;border-color:#4ed7e766}.fc-avatar{display:grid;place-items:center;flex:none;width:38px;height:38px;border-radius:13px;background:linear-gradient(135deg,#35d6d5,#866bff);font-weight:900;color:#071321}.fc-person small{display:block;color:#8fa7c0;margin-top:3px}
    .fc-main{display:flex;flex-direction:column}.fc-empty{margin:auto;text-align:center;padding:30px;color:#a8bbd1}.fc-empty strong{display:block;font-size:22px;color:white;margin-bottom:8px}
    .fc-convo-head{display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid #ffffff16}.fc-convo-head>div:nth-child(2){flex:1}.fc-convo-head small{display:block;color:#93a9c2;margin-top:3px}
    .fc-call-actions{display:flex;gap:7px}.fc-call-actions button{border:1px solid #ffffff30;border-radius:12px;padding:10px 12px;background:#ffffff10;color:white;cursor:pointer}
    .fc-messages{flex:1;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:9px}.fc-bubble{max-width:min(78%,560px);padding:11px 14px;border-radius:16px;background:#ffffff12;line-height:1.45;overflow-wrap:anywhere}.fc-bubble.mine{align-self:flex-end;background:linear-gradient(135deg,#245b83,#4b54a0)}.fc-bubble small{display:block;color:#b3c8dd;font-size:10px;margin-top:5px}
    .fc-compose{display:flex;gap:8px;padding:12px;border-top:1px solid #ffffff18}.fc-compose button{border:0;border-radius:12px;padding:0 18px;background:#55d9df;color:#06121c;font-weight:900;cursor:pointer}
    .fc-status{padding:6px 14px;color:#8da6c0;font-size:11px;min-height:24px}
    .fc-call{position:fixed;inset:0;z-index:2147483200;background:radial-gradient(ellipse at center,#25375d,#080d17 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:22px;gap:14px}
    .fc-call[hidden]{display:none}.fc-call video{max-width:min(90vw,850px);max-height:55vh;border-radius:18px;background:#000;box-shadow:0 20px 60px #0009}.fc-call .fc-self{position:absolute;right:22px;bottom:110px;width:min(25vw,190px);max-height:24vh;border:1px solid #ffffff55}.fc-call-title{font-size:22px;font-weight:850}.fc-call-buttons{display:flex;gap:12px}.fc-call-buttons button{padding:13px 20px;border:0;border-radius:999px;font-weight:850;cursor:pointer}.fc-answer{background:#55db9b;color:#06150e}.fc-hang{background:#ff5268;color:white}
    @media(max-width:720px){.fc-layout{grid-template-columns:1fr;grid-template-rows:minmax(130px,30%) 1fr;padding:9px;gap:9px}.fc-side{min-height:0}.fc-side h3{padding:10px 12px 6px}.fc-add{padding:0 9px 6px}.fc-list{display:flex;overflow-x:auto;gap:5px;padding:2px 8px 8px}.fc-person{min-width:125px;width:auto;padding:8px}.fc-main{min-height:0}.fc-convo-head{padding:10px}.fc-call-actions button{padding:9px}.fc-bubble{max-width:88%}}
  `;
  document.head.append(style);
  const screen=el('section',{id:'friend-chat-screen',hidden:true});
  const back=el('button',{className:'fc-back',textContent:'← Back'});
  const top=el('header',{className:'fc-top'},back,el('div',{className:'fc-brand',textContent:'CHAT WITH FRIENDS'},el('small',{textContent:'Your people. Your conversations. Any device.'})),notifyBtn);
  const addInput=el('input',{placeholder:"Add by username",maxLength:16,autocomplete:'off'});
  const addBtn=el('button',{textContent:'Add'});
  const addRow=el('div',{className:'fc-add'},addInput,addBtn);
  const discoverTitle=el('h3',{textContent:'Find players'});
  const discoverSearch=el('input',{placeholder:'Search all usernames…',autocomplete:'off',maxLength:16});
  const discoverWrap=el('div',{className:'fc-discover-search'},discoverSearch);
  const directoryList=el('div',{className:'fc-directory'});
  const discover=el('section',{className:'fc-discover'},discoverTitle,discoverWrap,directoryList);
  const notifyBtn=el('button',{className:'fc-notify',textContent:'🔔 Enable notifications',type:'button'});
  const friendList=el('div',{className:'fc-list'});
  const side=el('aside',{className:'fc-side'},el('h3',{textContent:'Your friends'}),addRow,friendList,discover);
  const empty=el('div',{className:'fc-empty'},el('strong',{textContent:'Your conversations start here'}),el('span',{textContent:'Choose a friend to message, or start an audio or video call.'}));
  const messages=el('div',{className:'fc-messages'});
  const convoTitle=el('strong',{textContent:'Select a friend'});
  const convoSub=el('small',{textContent:'Private conversation'});
  const voice=el('button',{textContent:'☎ Audio'});
  const video=el('button',{textContent:'▣ Video'});
  const callActions=el('div',{className:'fc-call-actions'},voice,video);
  const head=el('div',{className:'fc-convo-head'},el('span',{className:'fc-avatar',textContent:'✦'}),el('div',{},convoTitle,convoSub),callActions);
  const composeInput=el('input',{placeholder:'Write a message…',maxLength:2000});
  const send=el('button',{textContent:'Send'});
  const compose=el('div',{className:'fc-compose'},composeInput,send);
  const status=el('div',{className:'fc-status',textContent:'Messages are delivered through your signed-in account.'});
  const main=el('main',{className:'fc-main'},empty,head,messages,status,compose);
  const layout=el('div',{className:'fc-layout'},side,main);
  screen.append(top,layout);
  const call=el('section',{className:'fc-call',hidden:true});
  const callTitle=el('div',{className:'fc-call-title',textContent:'Connecting…'});
  const remote=el('video',{autoplay:true,playsInline:true});
  const local=el('video',{autoplay:true,playsInline:true,muted:true,className:'fc-self'});
  const answer=el('button',{className:'fc-answer',textContent:'Answer'});
  const hang=el('button',{className:'fc-hang',textContent:'End call'});
  const callBtns=el('div',{className:'fc-call-buttons'},answer,hang);
  call.append(callTitle,remote,local,callBtns);
  document.body.append(screen,call);
  let friends=[], directory=[], selected='', poller=null, peer=null, localStream=null, incoming=null, seen=new Set(), callKind='video', notificationReady=false;
  const api=async(body)=>{const r=await fetch(API+'/account/friend-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token(),...body})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d;};
  const account=async(path,body={})=>{const r=await fetch(API+'/account/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token(),...body})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d;};
  const signal=(type,payload={})=>api({username:selected,action:'signal',signalType:type,payload}).catch(e=>setStatus(e.message));
  const setStatus=t=>status.textContent=t;
  const addMessage=(text,mine,at=Date.now())=>{const b=el('div',{className:'fc-bubble'+(mine?' mine':'')},document.createTextNode(text),el('small',{textContent:new Date(at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}));messages.append(b);messages.scrollTop=messages.scrollHeight;};
  const choose=name=>{selected=name;const f=friends.find(x=>x.name===name);convoTitle.textContent=name;convoSub.textContent='Friend · cross-platform chat';head.children[0].textContent=(name[0]||'?').toUpperCase();empty.hidden=true;head.hidden=false;messages.hidden=false;compose.hidden=false;voice.disabled=video.disabled=false;[...friendList.children].forEach(n=>n.classList.toggle('active',n.dataset.name===name));messages.textContent='';setStatus('Loading conversation…');api({username:name,action:'history'}).then(d=>{if(selected!==name)return;messages.textContent='';(d.messages||[]).forEach(m=>addMessage(m.message,m.from===myUserId(),m.at));setStatus('Your conversation is saved to your account.');}).catch(e=>setStatus(e.message));};
  head.hidden=true;messages.hidden=true;compose.hidden=true;
  async function loadFriends(){try{const d=await account('friends');friends=d.friends||[];friendList.textContent='';if(!friends.length)friendList.append(el('div',{className:'fc-empty',textContent:'No friends yet. Add someone above.'}));friends.forEach(f=>{const b=el('button',{className:'fc-person'+(selected===f.name?' active':'')},el('span',{className:'fc-avatar',textContent:f.name[0].toUpperCase()}),el('span',{},el('strong',{textContent:f.name}),el('small',{textContent:'Friend'})));b.dataset.name=f.name;b.addEventListener('click',()=>choose(f.name));friendList.append(b);});if(selected&&!friends.some(f=>f.name===selected))selected='';renderDirectory();}catch(e){setStatus(e.message);}}
  function renderDirectory(){const q=discoverSearch.value.trim().toLowerCase();directoryList.textContent='';const existing=new Set(friends.map(x=>x.name.toLowerCase()));const matches=directory.filter(x=>!existing.has(x.name.toLowerCase())&&x.name.toLowerCase().includes(q));if(!matches.length){directoryList.append(el('div',{className:'fc-directory-empty',textContent:q?'No matching players.':'No other player accounts found.'}));return;}matches.forEach(p=>{const row=el('div',{className:'fc-directory-person'},el('span',{textContent:p.name}));const wasRequested=requestedUsers.has(p.name.toLowerCase());const add=el('button',{textContent:wasRequested?'Requested':'Add',type:'button',disabled:wasRequested});add.addEventListener('click',()=>addFriend(p.name,add));row.append(add);directoryList.append(row);});}
  async function loadDirectory(){try{const d=await account('user-directory');directory=(d.users||[]).slice().sort((x,y)=>x.name.localeCompare(y.name,undefined,{sensitivity:'base'}));renderDirectory();}catch(e){directoryList.textContent='Could not load player list: '+e.message;}}
  const requestedUsers=new Set();
  async function addFriend(username,button){try{button.disabled=true;button.textContent='Sending…';const d=await account('friend-add',{username});requestedUsers.add(username.toLowerCase());setStatus(d.message||'Friend request sent.');await loadFriends();renderDirectory();}catch(e){setStatus(e.message);}finally{button.disabled=false;button.textContent='Add';}}
  discoverSearch.addEventListener('input',renderDirectory);
  async function sendText(){const text=composeInput.value.trim();if(!selected||!text)return;try{await account('friend-chat',{username:selected,action:'send',message:text});addMessage(text,true);composeInput.value='';}catch(e){setStatus(e.message);}}
  addBtn.addEventListener('click',async()=>{const username=addInput.value.trim();if(!username)return;await addFriend(username,addBtn);addInput.value='';});
  addInput.addEventListener('keydown',e=>{if(e.key==='Enter')addBtn.click();});
  notifyBtn.addEventListener('click',async()=>{if(!('Notification'in window)){setStatus('This browser does not support notifications.');return;}const permission=await Notification.requestPermission();notificationReady=permission==='granted';notifyBtn.textContent=notificationReady?'🔔 Notifications on':'🔕 Notifications off';setStatus(notificationReady?'You will be notified about new messages while this page is running in the background.':'Notifications were not enabled.');});
  send.addEventListener('click',sendText);composeInput.addEventListener('keydown',e=>{if(e.key==='Enter')sendText();});
  async function startCall(kind){if(!selected)return;callKind=kind;try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Calls need a secure HTTPS browser with microphone/camera support.');call.hidden=false;callTitle.textContent='Requesting '+(kind==='video'?'camera and microphone':'microphone')+' permission…';localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'});local.srcObject=localStream;peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});localStream.getTracks().forEach(t=>peer.addTrack(t,localStream));peer.ontrack=e=>{remote.srcObject=e.streams[0];};peer.onicecandidate=e=>{if(e.candidate)signal('ice',e.candidate.toJSON());};peer.onconnectionstatechange=()=>{callTitle.textContent=peer.connectionState==='connected'?'Connected':peer.connectionState;};const offer=await peer.createOffer();await peer.setLocalDescription(offer);await signal('ring',{kind});await signal('offer',offer);callTitle.textContent='Calling '+selected+'…';answer.hidden=true;hang.hidden=false;}catch(e){setStatus(e.message);await endCall(false);}}
  async function acceptCall(){if(!incoming)return;try{const kind=incoming.kind||'video';callKind=kind;call.hidden=false;callTitle.textContent='Requesting '+(kind==='video'?'camera and microphone':'microphone')+' permission…';localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'});local.srcObject=localStream;peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});localStream.getTracks().forEach(t=>peer.addTrack(t,localStream));peer.ontrack=e=>remote.srcObject=e.streams[0];peer.onicecandidate=e=>{if(e.candidate)signal('ice',e.candidate.toJSON());};await peer.setRemoteDescription(incoming.offer);const ans=await peer.createAnswer();await peer.setLocalDescription(ans);await signal('answer',ans);callTitle.textContent='Connecting to '+selected;answer.hidden=true;incoming=null;}catch(e){setStatus(e.message);await endCall(false);}}
  async function endCall(sendSignal=true){if(sendSignal&&selected)await signal('hangup');if(peer){peer.close();peer=null;}if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}remote.srcObject=null;local.srcObject=null;call.hidden=true;incoming=null;}
  async function handle(m){if(seen.has(m.id))return;seen.add(m.id);if(seen.size>500)seen=new Set([...seen].slice(-250));if(m.type==='text'){addMessage(m.message,false,m.at);if(document.hidden&&notificationReady){const title='Message from '+m.fromName;try{if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.ready;await reg.showNotification(title,{body:m.message,icon:'/favicon-192.png',tag:'rps-chat-'+m.fromName,data:{url:'/'}});}else new Notification(title,{body:m.message});}catch{}}return;}if(m.type==='ring'){selected=m.fromName;callKind=m.payload?.kind||'video';await loadFriends();choose(selected);setStatus('Incoming '+(callKind==='video'?'video':'audio')+' call…');return;}if(m.type==='offer'){selected=m.fromName;await loadFriends();choose(selected);incoming={offer:m.payload,kind:callKind};call.hidden=false;callTitle.textContent=m.fromName+' is calling';answer.hidden=false;hang.hidden=false;answer.onclick=acceptCall;return;}if(m.type==='answer'&&peer){await peer.setRemoteDescription(m.payload);callTitle.textContent='Connecting…';return;}if(m.type==='ice'&&peer){try{await peer.addIceCandidate(m.payload);}catch{}return;}if(m.type==='reject'||m.type==='hangup'){setStatus(m.fromName+' ended the call.');await endCall(false);}}
  async function poll(){if(!token()||!friends.length)return;for(const f of friends){try{const d=await api({username:f.name,action:'poll'});for(const m of d.messages||[])await handle(m);}catch(e){if(screen.hidden===false)setStatus(e.message);}}}
  async function open(){if(!token()){alert('Please sign in to chat with friends.');return;}screen.hidden=false;await loadFriends();await loadDirectory();if(poller)clearInterval(poller);poller=setInterval(poll,1400);poll();}
  document.addEventListener('visibilitychange',()=>{if(!screen.hidden&&!document.hidden)poll();});
  function close(){screen.hidden=true;if(poller)clearInterval(poller);poller=null;endCall();}
  back.addEventListener('click',close);voice.addEventListener('click',()=>startCall('audio'));video.addEventListener('click',()=>startCall('video'));hang.addEventListener('click',()=>endCall());answer.addEventListener('click',acceptCall);
  window.openFriendsChat=open;
  document.getElementById('chat-with-friends-nav')?.addEventListener('click',open);
})();