(() => {
  const boot = () => {
    if (document.body.classList.contains('rps-game-ui')) return;
    document.body.classList.add('rps-game-ui');
    const $ = (s) => document.querySelector(s);
    const make = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n; };
    const shell=make('main','rps-shell'); shell.id='rps-arena-shell';
    const header=make('header','rps-topbar');
    const brand=make('a','rps-brand'); brand.href='/'; brand.innerHTML='<span class="rps-brand-mark">✦</span><span>STONE / PAPER / SCISSORS</span>';
    const nav=make('nav','rps-nav'); nav.setAttribute('aria-label','Main navigation');
    [['PLAY','#gameplay'],['ARENA','#arena-room'],['LEADERBOARD','/leaderboard.html'],['PROFILE','#profile'],['UPGRADE','/subscribe.html']].forEach(([label,href])=>{
      const a=make('a','',label); a.href=href;
      if(label==='PROFILE') a.addEventListener('click',e=>{e.preventDefault();const chip=$('#user-chip');if(chip&&!chip.hidden)chip.click();else{const auth=$('#auth-layer');if(auth)auth.hidden=false;}});
      nav.append(a);
    });
    const account=make('button','rps-account');account.type='button';account.setAttribute('aria-label','Open player profile');account.append(make('span','rps-avatar-dot'));account.append(make('span','rps-account-name','PLAYER'));account.addEventListener('click',()=>{const chip=$('#user-chip');if(chip&&!chip.hidden)chip.click();else{const auth=$('#auth-layer');if(auth)auth.hidden=false;}});
    header.append(brand,nav,account);
    const hero=make('section','rps-hero');hero.id='home';
    const copy=make('div','');
    copy.append(make('p','rps-kicker','SEASON / LIVE MATCHMAKING'),make('h1','', 'MAKE YOUR\nNEXT MOVE.'),make('p','rps-hero-copy','Challenge the arena. Outsmart your rivals. Climb the ranks.'));
    const actions=make('div','rps-hero-actions');
    const play=make('a','rps-action','PLAY NOW');play.href='#gameplay';
    const room=make('a','rps-action secondary','CREATE A ROOM');room.href='#arena-room';room.addEventListener('click',()=>setTimeout(()=>$('#room-code')?.focus(),0));
    actions.append(play,room);copy.append(actions);
    const live=make('aside','rps-live-card');live.append(make('p','rps-live-label','YOUR ROOM'),make('p','rps-live-number','0/2'),make('p','rps-live-caption','PLAYERS IN ROOM'));
    const status=make('div','rps-connection-slot');status.id='rps-live-status';live.append(status);
    hero.append(copy,live);
    const gameSection=make('section','rps-game-layout');gameSection.id='gameplay';
    const playPanel=make('section','rps-panel');playPanel.append(make('h2','','CHOOSE YOUR MODE'),make('p','panel-note','Play online with friends or practice against the computer.'));
    const mode=$('.mode-switch'), computer=$('#computer-box'), moves=$('.move-row'), result=$('.js-result'), roundMoves=$('.js-moves'), scoreLabel=$('.js-score-label'), score=$('.js-score'), reset=$('#reset-button'), seo=$('.seo-text');
    [mode,computer,moves,result,roundMoves,scoreLabel,score,reset].forEach(n=>{if(n)playPanel.append(n);});
    const roomPanel=make('section','rps-panel');roomPanel.id='arena-room';roomPanel.append(make('h2','','THE ARENA LOBBY'),make('p','panel-note','Create a room, join a friend, or find an opponent instantly.'));
    const online=$('#online-box');if(online)roomPanel.append(online);
    const side=make('div','');side.append(roomPanel);
    gameSection.append(playPanel,side);
    shell.append(header,hero,make('div','rps-section-head'));
    const sectionHead=shell.querySelector('.rps-section-head');sectionHead.append(make('p','rps-section-kicker','MATCH / PRACTICE'),make('h2','rps-section-title','ENTER THE ARENA'),make('p','rps-section-sub','Your existing account, room, and score systems are connected below.'));
    shell.append(gameSection);
    if(seo)shell.append(seo);
    document.body.insertBefore(shell,document.body.firstChild);
    const liveStatus=$('#connection-status'), playerCount=$('#player-count');
    const liveNumber=live.querySelector('.rps-live-number');
    const sync=()=>{status.textContent=liveStatus?.textContent?.trim()||'Status unavailable';const count=playerCount?.textContent?.match(/\d+\s*\/\s*\d+/);if(liveNumber)liveNumber.textContent=count?count[0].replace(/\s/g,''):'—';};
    sync(); if(liveStatus)new MutationObserver(sync).observe(liveStatus,{childList:true,subtree:true,characterData:true});
    if(playerCount)new MutationObserver(sync).observe(playerCount,{childList:true,subtree:true,characterData:true});
    const scoreText=$('.js-score'); if(scoreText){const syncScore=()=>{};new MutationObserver(syncScore).observe(scoreText,{childList:true,subtree:true,characterData:true});}
    const chip=$('#user-chip'); if(chip){const update=()=>{account.querySelector('.rps-account-name').textContent=chip.hidden?'PLAYER':chip.textContent.trim().toUpperCase()||'PLAYER';};update();new MutationObserver(update).observe(chip,{attributes:true,childList:true,subtree:true});}
    const lb=$('#lb-btn'); if(lb)lb.hidden=true;
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();