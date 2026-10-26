/* Sunburst Pop: accessible, local-first enhancements that do not replace existing game logic. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const safeGet = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } };
  const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  const mascots = [
    {name:'Rocky the Boulder', emoji:'🪨', line:'I am emotionally unavailable. And extremely solid.'},
    {name:'Paige the Paper Plane', emoji:'🛩️', line:'Catch me if you can. Actually, please do not.'},
    {name:'Snip the Scissors', emoji:'✂️', line:'I came. I snipped. I overreacted.'},
    {name:'Lizzy the Lizard', emoji:'🦎', line:'Tiny arms. Massive confidence.'},
    {name:'Spocky', emoji:'🖖', line:'The odds are illogical. I like those odds.'},
    {name:'Boulderina', emoji:'🪨', line:'My dance moves are legally considered geology.'},
    {name:'Captain Crinkle', emoji:'📄', line:'Freshly folded. Deeply dramatic.'},
    {name:'DJ Snips', emoji:'🎧', line:'Drop the beat. Then the scissors.'}
  ];
  const facts = [
    'Rock Paper Scissors has been used to settle decisions for centuries.',
    'A fair random strategy chooses rock, paper and scissors about one-third of the time each.',
    'In a tie, neither player wins. The rematch is the real main event.',
    'Rock Paper Scissors Lizard Spock adds two extra moves to the classic triangle.'
  ];
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let soundOn = safeGet('sp-sound','off') === 'on';
  let drawTimer = null, drawStarted = 0, drawReady = false;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function sound(freq, duration) {
    if (!soundOn) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.09, ctx.currentTime + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + duration);
      osc.onended = () => ctx.close();
    } catch (_) {}
  }
  function announce(text) {
    let live = $('#sp-live');
    if (!live) { live = element('div',''); live.id = 'sp-live'; live.setAttribute('aria-live','polite'); live.setAttribute('role','status'); live.style.cssText='position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0'; document.body.appendChild(live); }
    live.textContent = text;
  }
  function showBurst(word) {
    if (reduced) return;
    const old = $('.sp-burst'); if (old) old.remove();
    const burst = element('div','sp-burst',word); burst.setAttribute('aria-hidden','true');
    document.body.appendChild(burst);
    window.setTimeout(() => burst.remove(), 850);
  }
  function build() {
    const title = $('.title');
    if (!title || $('#sp-header')) return;
    const header = element('header','sp-header'); header.id='sp-header';
    const brand = element('a','sp-brand'); brand.href='/'; brand.setAttribute('aria-label','Stone Paper Scissors home');
    brand.append(element('span','sp-brand-mark','✊'), element('span','', 'STONE PAPER SCISSORS'));
    const nav = element('nav','sp-nav'); nav.setAttribute('aria-label','Game navigation');
    [['🃏 Collection','/achievements.html'],['🧪 Arena Lab','/game-lab.html'],['⭐ Upgrade','/subscribe.html']].forEach(item => {
      const a = element('a','',item[0]); a.href=item[1]; nav.appendChild(a);
    });
    const theme = element('button','', safeGet('sp-theme','sunburst') === 'midnight' ? '🌙 Midnight Pop' : '☀️ Sunburst Pop');
    theme.type='button'; theme.id='sp-theme-toggle'; theme.setAttribute('aria-pressed',String(safeGet('sp-theme','sunburst') === 'midnight'));
    theme.addEventListener('click', () => {
      const next = document.body.dataset.theme === 'midnight' ? 'sunburst' : 'midnight';
      if (next === 'midnight') document.body.dataset.theme='midnight'; else delete document.body.dataset.theme;
      safeSet('sp-theme',next); theme.textContent = next === 'midnight' ? '🌙 Midnight Pop' : '☀️ Sunburst Pop';
      theme.setAttribute('aria-pressed',String(next === 'midnight')); sound(420,.07);
    });
    nav.appendChild(theme); header.append(brand,nav); title.before(header);
    const storedMascot = safeGet('sp-mascot','0');
    const initial = Math.max(0,Math.min(mascots.length-1,Number(storedMascot)||0));
    const companion = element('section','sp-companion'); companion.id='sp-companion';
    companion.setAttribute('aria-label','Mascot companion');
    const avatar = element('div','sp-mascot',mascots[initial].emoji); avatar.id='sp-mascot-avatar'; avatar.setAttribute('aria-hidden','true');
    const copy = element('div',''); const name = element('strong','',mascots[initial].name); name.id='sp-mascot-name';
    const line = element('p','',mascots[initial].line); line.id='sp-mascot-line'; copy.append(name,line);
    const select = element('select',''); select.id='sp-mascot-select'; select.setAttribute('aria-label','Choose your mascot companion');
    mascots.forEach((m,i)=>{ const option=element('option','',m.emoji+' '+m.name); option.value=String(i); if(i===initial) option.selected=true; select.appendChild(option); });
    select.addEventListener('change',()=>{ const m=mascots[Number(select.value)]||mascots[0]; avatar.textContent=m.emoji; name.textContent=m.name; line.textContent=m.line; safeSet('sp-mascot',select.value); announce(m.name+' is now your companion.'); sound(620,.08); });
    companion.append(avatar,copy,select); title.after(companion);
    const games = element('section','sp-mini-games'); games.setAttribute('aria-label','Free mini games');
    const quick = miniCard('⚡ Quick Draw','Test your reaction speed.','Start Quick Draw');
    const coin = miniCard('🪙 Coin Flip','A quick, fair local tiebreaker.','Flip coin');
    const fact = miniCard('💡 Did You Know?','Tiny facts from the hand-game universe.','Show a fact');
    games.append(quick.card,coin.card,fact.card);
    const result = $('.js-result');
    const score = $('.js-score');
    if (score) score.after(games); else if (result) result.after(games); else companion.after(games);
    const overlay = element('div','sp-overlay'); overlay.id='sp-overlay'; overlay.hidden=true;
    const dialog = element('div','sp-dialog'); dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true'); dialog.setAttribute('aria-labelledby','sp-dialog-title');
    const dialogTitle=element('h2','', 'Quick Draw!'); dialogTitle.id='sp-dialog-title';
    const message=element('p','','Press start, wait for GO!, then tap as quickly as you can. False starts count!'); message.id='sp-draw-message';
    const start=element('button','','Start test'); start.type='button'; start.id='sp-draw-start';
    const close=element('button','','Close'); close.type='button'; close.addEventListener('click',closeDraw);
    start.addEventListener('click',startDraw);
    dialog.append(dialogTitle,message,start,close); overlay.appendChild(dialog); document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{ if(e.target===overlay) closeDraw(); });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden) closeDraw();});
    quick.button.addEventListener('click',()=>{ overlay.hidden=false; message.textContent='Press start, wait for GO!, then tap as quickly as you can. False starts count!'; start.textContent='Start test'; start.disabled=false; start.focus(); });
    coin.button.addEventListener('click',()=>{ const resultText=Math.random()<.5?'🪙 HEADS!':'🪙 TAILS!'; coin.button.textContent=resultText; coin.description.textContent='Fair local coin flip — no coins or rewards are spent.'; announce(resultText); sound(520,.12); });
    fact.button.addEventListener('click',()=>{ const f=facts[Math.floor(Math.random()*facts.length)]; fact.description.textContent=f; announce(f); sound(680,.08); });
    if (safeGet('sp-theme','sunburst') === 'midnight') { document.body.dataset.theme='midnight'; theme.textContent='🌙 Midnight Pop'; theme.setAttribute('aria-pressed','true'); }
    const settings = element('button','sp-chip',soundOn?'🔊 Sound on':'🔇 Sound off'); settings.type='button'; settings.id='sp-sound-toggle'; settings.setAttribute('aria-pressed',String(soundOn));
    settings.addEventListener('click',()=>{soundOn=!soundOn; safeSet('sp-sound',soundOn?'on':'off'); settings.textContent=soundOn?'🔊 Sound on':'🔇 Sound off'; settings.setAttribute('aria-pressed',String(soundOn)); if(soundOn)sound(600,.08);});
    const reduce = element('button','sp-chip',reduced?'♿ Reduced motion: system':'♿ Reduce motion'); reduce.type='button'; reduce.id='sp-motion-toggle'; reduce.setAttribute('aria-pressed','false');
    let userReduced=safeGet('sp-reduced-motion','off')==='on';
    function applyMotion(){document.body.classList.toggle('sp-reduced-motion',reduced||userReduced); reduce.textContent=userReduced?'♿ Reduced motion on':'♿ Reduce motion'; reduce.setAttribute('aria-pressed',String(userReduced));}
    reduce.addEventListener('click',()=>{userReduced=!userReduced;safeSet('sp-reduced-motion',userReduced?'on':'off');applyMotion();announce(userReduced?'Reduced motion enabled.':'Reduced motion disabled.');});
    applyMotion();
    nav.append(settings,reduce);
    const observer = new MutationObserver(() => {
      const text = (result && result.textContent || '').toLowerCase();
      if (!text.trim()) return;
      if (/you win|you won|you win!|victory|winner|won the round/.test(text)) { avatar.textContent=mascots[Number(select.value)||0].emoji; line.textContent='POW! That one goes in the highlight reel!'; showBurst('POW!'); sound(740,.13); }
      else if (/tie|draw/.test(text)) { line.textContent='A tie! The universe demands a rematch.'; sound(390,.08); }
      else if (/you lose|you lost|defeat|lost the round/.test(text)) { line.textContent='Oof. Shake it off — legends lose rounds too.'; sound(230,.12); }
      else return;
      announce(line.textContent);
    });
    if(result) observer.observe(result,{childList:true,subtree:true,characterData:true});
  }
  function miniCard(heading,description,buttonText) {
    const card=element('article','sp-mini-card'); const title=element('strong','',heading);
    const desc=element('p','',description); const button=element('button','',buttonText); button.type='button';
    card.append(title,desc,button); return {card,description:desc,button};
  }
  function closeDraw(){ const overlay=$('#sp-overlay'); if(overlay)overlay.hidden=true; if(drawTimer)window.clearTimeout(drawTimer);drawTimer=null;drawReady=false; }
  function startDraw(){
    const message=$('#sp-draw-message'), start=$('#sp-draw-start'); if(!message||!start)return;
    if(drawTimer)window.clearTimeout(drawTimer);
    drawReady=false; start.disabled=true; start.textContent='Wait for GO…'; message.textContent='Hold it… not yet!';
    const delay=1200+Math.random()*2600;
    drawTimer=window.setTimeout(()=>{drawReady=true;drawStarted=performance.now();message.textContent='GO! TAP THE BUTTON!';start.textContent='TAP NOW!';start.disabled=false;sound(880,.09);},delay);
    start.onclick=()=>{
      if(!drawReady){if(drawTimer)window.clearTimeout(drawTimer);drawTimer=null;message.textContent='FALSE START! Try again after the signal.';start.textContent='Try again';start.disabled=false;sound(180,.14);start.onclick=startDraw;return;}
      const ms=Math.round(performance.now()-drawStarted);message.textContent='Your reaction time: '+ms+' ms. '+(ms<250?'Lightning fast!':ms<400?'Quick hands!':'Keep practicing!');start.textContent='Run it again';start.disabled=false;drawReady=false;sound(ms<250?900:500,.12);start.onclick=startDraw;
    };
  }
  function watchMoveButtons(){
    document.querySelectorAll('.move-button').forEach(button=>button.addEventListener('click',()=>{sound(340,.055);if(!reduced&&!document.body.classList.contains('sp-reduced-motion')){button.animate([{transform:'scale(1)'},{transform:'scale(.91)'},{transform:'scale(1.04)'},{transform:'scale(1)'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});}}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{build();watchMoveButtons();});else{build();watchMoveButtons();}
})();