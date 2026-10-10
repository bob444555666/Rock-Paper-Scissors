/* Shared Premium appearance for every page outside the main game page.
   premium.js owns the main game page; this file mirrors its visual preferences elsewhere. */
(() => {
  if (document.getElementById('prem-global-style')) return;
  const API = 'https://rps-server.heyboernathan.workers.dev';
  const CACHE = 'premiumPrefsCache';
  const token = () => { try { return localStorage.getItem('token'); } catch (e) { return null; } };
  const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { return null; } };
  const titleOriginal = new Map();
  const style = document.createElement('style');
  style.id = 'prem-global-style';
  document.head.appendChild(style);

  // Left-side hamburger drawer for every site destination and header action.
  function installSiteNav() {
    if (document.getElementById('rps-site-nav') || !document.body) return;
    const css = document.createElement('style');
    css.id = 'rps-site-nav-css';
    css.textContent = `
      #rps-menu-toggle{position:fixed;top:14px;left:14px;z-index:1402;width:48px;height:48px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.16);border-radius:15px;background:rgba(10,10,22,.94);color:#fff;box-shadow:0 8px 28px rgba(0,0,0,.3);cursor:pointer;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);transition:transform .18s,border-color .18s,background .18s}
      #rps-menu-toggle:hover{transform:translateY(-1px);border-color:rgba(34,245,160,.6);background:#151526}
      #rps-menu-toggle svg{width:23px;height:23px}
      #rps-menu-backdrop{position:fixed;inset:0;z-index:1400;background:rgba(3,4,12,.68);opacity:0;visibility:hidden;transition:opacity .22s,visibility .22s;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
      #rps-menu-backdrop.is-open{opacity:1;visibility:visible}
      #rps-site-nav{position:fixed;z-index:1401;inset:0 auto 0 0;width:min(340px,88vw);box-sizing:border-box;display:flex;flex-direction:column;gap:0;padding:22px 16px 18px;background:linear-gradient(180deg,rgba(16,16,32,.99),rgba(7,8,18,.99));border-right:1px solid rgba(255,255,255,.12);box-shadow:20px 0 70px rgba(0,0,0,.45);transform:translateX(-105%);visibility:hidden;transition:transform .25s cubic-bezier(.2,.8,.2,1),visibility .25s;color:#fff;overflow-y:auto;overscroll-behavior:contain}
      #rps-site-nav.is-open{transform:translateX(0);visibility:visible}
      #rps-site-nav .rps-nav-head{display:flex;align-items:center;gap:11px;padding:8px 5px 22px;border-bottom:1px solid rgba(255,255,255,.1)}
      #rps-site-nav .rps-nav-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(135deg,var(--green,#22f5a0),#a855f7);color:#080812;font-size:22px;flex:none}
      #rps-site-nav .rps-nav-brand{font:700 15px/1.25 system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff;text-decoration:none}
      #rps-site-nav .rps-nav-subtitle{display:block;margin-top:4px;color:rgba(235,234,255,.5);font:400 11px/1.2 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase}
      #rps-site-nav .rps-nav-close{margin-left:auto;width:36px;height:36px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#fff;font-size:21px;cursor:pointer}
      #rps-site-nav .rps-nav-label{margin:20px 9px 8px;color:rgba(221,221,245,.46);font:600 10px/1.2 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase}
      #rps-site-nav .rps-nav-links,#rps-site-nav .rps-nav-actions{display:flex;flex-direction:column;gap:5px}
      #rps-site-nav .rps-nav-link,#rps-site-nav .rps-nav-actions button,#rps-site-nav .rps-nav-actions a{box-sizing:border-box;width:100%;min-height:44px;display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid transparent;border-radius:12px;background:transparent;color:rgba(246,245,255,.82);text-decoration:none;text-align:left;font:500 13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}
      #rps-site-nav .rps-nav-link:hover,#rps-site-nav .rps-nav-actions button:hover,#rps-site-nav .rps-nav-actions a:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.09);color:#fff}
      #rps-site-nav .rps-nav-link[aria-current="page"]{background:rgba(34,245,160,.09);border-color:rgba(34,245,160,.22);color:var(--green,#22f5a0)}
      #rps-site-nav .rps-nav-icon{width:24px;display:inline-grid;place-items:center;font-size:17px;flex:none}
      #rps-site-nav .rps-nav-actions{padding-bottom:14px}
      #rps-site-nav #user-chip{position:static!important;inset:auto!important;display:flex!important;align-items:center;justify-content:flex-start;width:100%;min-height:44px;box-sizing:border-box;margin:0!important;padding:11px 13px!important;border:1px solid rgba(34,245,160,.25)!important;border-radius:12px!important;background:rgba(34,245,160,.08)!important;color:#eafff5!important;box-shadow:none!important;text-align:left;font:550 13px/1.35 system-ui,sans-serif!important;cursor:pointer}
      #rps-site-nav #user-chip[hidden]{display:none!important}
      #rps-site-nav .rps-account-fallback{width:100%;min-height:44px;display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid rgba(34,245,160,.25);border-radius:12px;background:rgba(34,245,160,.08);color:#eafff5;text-decoration:none;font:700 13px/1.25 system-ui,sans-serif}
      #rps-site-nav .rps-nav-footer{margin-top:auto;padding:16px 8px 2px;color:rgba(221,221,245,.35);font:500 10px/1.4 system-ui,sans-serif}
      body.rps-drawer-open{overflow:hidden}
      @media(prefers-reduced-motion:reduce){#rps-menu-toggle,#rps-menu-backdrop,#rps-site-nav{transition:none!important}}
    `;
    document.head.appendChild(css);
    const toggle = document.createElement('button');
    toggle.id = 'rps-menu-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label','Open navigation menu');
    toggle.setAttribute('aria-controls','rps-site-nav');
    toggle.setAttribute('aria-expanded','false');
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    const backdrop = document.createElement('div');
    backdrop.id = 'rps-menu-backdrop';
    backdrop.setAttribute('aria-hidden','true');
    const drawer = document.createElement('aside');
    drawer.id = 'rps-site-nav';
    drawer.setAttribute('aria-label','Site navigation');
    drawer.setAttribute('aria-hidden','true');
    drawer.innerHTML = `
      <div class="rps-nav-head">
        <span class="rps-nav-mark" aria-hidden="true">✊</span>
        <a class="rps-nav-brand" href="/">Stone Paper Scissors<span class="rps-nav-subtitle">Choose your next move</span></a>
        <button class="rps-nav-close" type="button" aria-label="Close navigation">×</button>
      </div>
      <div class="rps-nav-label">Explore</div>
      <nav class="rps-nav-links" aria-label="Site pages">
        <a class="rps-nav-link" href="/"><span class="rps-nav-icon">🎮</span>Play</a>
        <a class="rps-nav-link" href="/leaderboard.html"><span class="rps-nav-icon">🏆</span>Leaderboard</a>
        <a class="rps-nav-link" href="/multiplayer.html"><span class="rps-nav-icon">👥</span>3–4 Player Rooms</a>
        <a class="rps-nav-link" href="/arcade-hub.html"><span class="rps-nav-icon">🕹️</span>Arcade Hub</a>
        <a class="rps-nav-link" href="/quests.html"><span class="rps-nav-icon">🎯</span>Quests</a>
        <a class="rps-nav-link" href="/achievements.html"><span class="rps-nav-icon">🏅</span>Achievements</a>
        <a class="rps-nav-link" href="/vault.html"><span class="rps-nav-icon">🎨</span>Style Vault</a>
        <a class="rps-nav-link" href="/subscribe.html"><span class="rps-nav-icon">⭐</span>Subscription / Premium</a>
        <a class="rps-nav-link" href="/privacy.html"><span class="rps-nav-icon">🔒</span>Privacy Policy</a>
      </nav>
      <div class="rps-nav-label">Your account</div>
      <div class="rps-nav-actions" id="rps-nav-account-actions"></div>
      <div class="rps-nav-label" id="rps-nav-tools-label">Quick actions</div>
      <div class="rps-nav-actions" id="rps-nav-quick-actions"></div>
      <div class="rps-nav-footer">Stone Paper Scissors · Play fair. Make your move.</div>`;
    document.body.insertBefore(backdrop, document.body.firstChild);
    document.body.insertBefore(drawer, document.body.firstChild);
    document.body.insertBefore(toggle, document.body.firstChild);
    const closeButton = drawer.querySelector('.rps-nav-close');
    const openMenu = () => {
      drawer.classList.add('is-open'); backdrop.classList.add('is-open');
      drawer.setAttribute('aria-hidden','false'); backdrop.setAttribute('aria-hidden','false');
      toggle.setAttribute('aria-expanded','true'); toggle.setAttribute('aria-label','Close navigation');
      document.body.classList.add('rps-drawer-open'); closeButton.focus();
    };
    const closeMenu = () => {
      drawer.classList.remove('is-open'); backdrop.classList.remove('is-open');
      drawer.setAttribute('aria-hidden','true'); backdrop.setAttribute('aria-hidden','true');
      toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-label','Open navigation');
      document.body.classList.remove('rps-drawer-open'); toggle.focus();
    };
    toggle.addEventListener('click', () => drawer.classList.contains('is-open') ? closeMenu() : openMenu());
    closeButton.addEventListener('click', closeMenu);
    backdrop.addEventListener('click', closeMenu);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && drawer.classList.contains('is-open')) closeMenu(); });
    drawer.querySelectorAll('.rps-nav-link').forEach(link => {
      const rawPath = window.location.pathname;
      const path = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0,-1) : rawPath;
      const targetPath = new URL(link.href, window.location.origin).pathname;
      const target = targetPath.length > 1 && targetPath.endsWith('/') ? targetPath.slice(0,-1) : targetPath;
      if (target === path) link.setAttribute('aria-current','page');
      link.addEventListener('click', closeMenu);
    });
    const accountActions = drawer.querySelector('#rps-nav-account-actions');
    const quickActions = drawer.querySelector('#rps-nav-quick-actions');
    const userChip = document.getElementById('user-chip');
    if (userChip) {
      accountActions.appendChild(userChip);
      const profileFallback = document.createElement('a');
      profileFallback.className = 'rps-account-fallback';
      profileFallback.href = '/';
      profileFallback.innerHTML = '<span class="rps-nav-icon">👤</span>Profile / Sign in';
      profileFallback.addEventListener('click', event => {
        if (!userChip.hidden) { event.preventDefault(); userChip.click(); }
      });
      accountActions.appendChild(profileFallback);
      const syncProfile = () => { profileFallback.hidden = !userChip.hidden; };
      syncProfile();
      new MutationObserver(syncProfile).observe(userChip, {attributes:true,attributeFilter:['hidden']});
    } else {
      const profileFallback = document.createElement('a');
      profileFallback.className = 'rps-account-fallback'; profileFallback.href = '/';
      profileFallback.innerHTML = '<span class="rps-nav-icon">👤</span>Profile / Sign in';
      accountActions.appendChild(profileFallback);
    }
    const quickIds = ['lb-btn','mp-btn','arcade-hub-btn','premium-subscribe-btn','friends-btn','ch-btn','to-btn','control-panel-btn'];
    quickIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && !drawer.contains(el)) {
        el.classList.add('rps-nav-moved-action');
        quickActions.appendChild(el);
      }
    });
    // Move only header-level controls related to tournaments, subscription, or profile.
    const moveHeaderActions = () => {
      document.querySelectorAll('button,a').forEach(el => {
        if (drawer.contains(el) || el.id === 'rps-menu-toggle' || el.closest('[role="dialog"],.modal,#profile-layer,#auth-layer,#prem-layer,#ch-layer,#to-layer')) return;
        const label = (el.innerText || el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
        const isControlPanel = /control\\s*panel|premium options|settings panel/.test(label);
        const isChallenge = /challenge/.test(label) || el.id === 'ch-btn';
        const isTournament = /tournament/.test(label) || el.id === 'to-btn';
        const isKnownAction = ['ch-btn','to-btn','control-panel-btn'].includes(el.id);
        if (!isControlPanel && !isChallenge && !isTournament && !isKnownAction) return;
        if (el.closest('header,nav,.top-bar,.topbar,.toolbar,.header-actions,.ui-actions') || el.classList.contains('ui-fab') || isKnownAction) {
          quickActions.appendChild(el);
          el.classList.add('rps-nav-moved-action');
          el.style.setProperty('width','100%');
          el.style.setProperty('box-sizing','border-box');
        }
      });
    };
    moveHeaderActions();
    // Challenge, tournament, and premium/control-panel buttons may be created after this script runs.
    new MutationObserver(() => moveHeaderActions()).observe(document.body, { childList:true, subtree:true });
    [accountActions,quickActions].forEach(group => {
      group.querySelectorAll('button,a').forEach(el => {
        if (el.id === 'user-chip') return;
        el.style.setProperty('width','100%');
        el.style.setProperty('box-sizing','border-box');
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installSiteNav, { once: true });
  else installSiteNav();

  const THEMES = {
    neon: ['#22f5a0', '#3b82f6', '#a855f7'], gold: ['#fbbf24', '#f59e0b', '#fcd34d'],
    ocean: ['#38bdf8', '#2563eb', '#22d3ee'], sunset: ['#fb923c', '#f43f5e', '#ec4899'],
    forest: ['#4ade80', '#16a34a', '#a3e635'], ice: ['#e0f2fe', '#7dd3fc', '#a5b4fc'],
    candy: ['#f472b6', '#c084fc', '#fb7185'], mono: ['#e5e7eb', '#9ca3af', '#d1d5db']
  };
  const BACKGROUNDS = {
    amoled: '#000', aurora: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
    sunset: 'linear-gradient(160deg, #1a0b2e, #6a1b4d, #ff7e5f)',
    ocean: 'linear-gradient(180deg, #001f3f, #0b4f8a, #0e7490)',
    forest: 'linear-gradient(180deg, #06140c, #14532d, #1b5e20)',
    galaxy: 'radial-gradient(ellipse at top, #24304a, #090a0f 70%)',
    lava: 'linear-gradient(180deg, #1a0000, #7f1d1d, #f97316)',
    candy: 'linear-gradient(135deg, #3b0a45, #c026d3, #f472b6)'
  };
  const FONTS = {
    rounded: "'Trebuchet MS', 'Arial Rounded MT Bold', system-ui, sans-serif",
    mono: "'Courier New', ui-monospace, monospace",
    serif: "Georgia, 'Times New Roman', serif",
    fun: "'Comic Sans MS', 'Comic Sans', cursive"
  };
  const RINGS = { green: '#22f5a0', gold: '#fbbf24', pink: '#f472b6', blue: '#3b82f6', red: '#ef4444' };
  const valid = (v, values, fallback) => values.includes(v) ? v : fallback;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const particleCanvas = document.createElement('canvas');
  particleCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none';
  document.body.appendChild(particleCanvas);
  const pctx = particleCanvas.getContext ? particleCanvas.getContext('2d') : null;
  let particleMode = 'none', particles = [], particleFrame = 0, sparkleOn = false, sparkleAt = 0;

  function startParticles(mode) {
    if (!pctx || reduced) mode = 'none';
    particleMode = mode || 'none';
    cancelAnimationFrame(particleFrame);
    if (pctx) pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    if (particleMode === 'none') return;
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
    const count = particleMode === 'stars' ? 70 : 42;
    particles = Array.from({length: count}, () => ({
      x: Math.random() * particleCanvas.width, y: Math.random() * particleCanvas.height,
      r: particleMode === 'bubbles' ? 3 + Math.random() * 8 : .7 + Math.random() * 2,
      speed: .3 + Math.random() * 1.2, phase: Math.random() * 6.28
    }));
    drawParticles();
  }

  function drawParticles() {
    if (!pctx || particleMode === 'none') return;
    const w = particleCanvas.width, h = particleCanvas.height, t = Date.now() / 1000;
    pctx.clearRect(0, 0, w, h);
    for (const q of particles) {
      if (particleMode === 'stars') {
        pctx.globalAlpha = .3 + .7 * Math.abs(Math.sin(t * q.speed + q.phase));
        pctx.fillStyle = '#fff';
      } else if (particleMode === 'bubbles') {
        q.y -= q.speed * .6; q.x += Math.sin(t + q.phase) * .3;
        pctx.globalAlpha = .35; pctx.strokeStyle = '#bfe9ff'; pctx.lineWidth = 1.5;
        pctx.beginPath(); pctx.arc(q.x, q.y, q.r, 0, 6.28); pctx.stroke();
      } else if (particleMode === 'snow') {
        q.y += q.speed * .8; q.x += Math.sin(t + q.phase) * .4;
        pctx.globalAlpha = .85; pctx.fillStyle = '#fff';
      } else {
        q.y -= q.speed * 1.4; q.x += Math.sin(t * 2 + q.phase) * .5;
        pctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * 3 + q.phase)); pctx.fillStyle = '#fb923c';
      }
      if (particleMode !== 'bubbles') { pctx.beginPath(); pctx.arc(q.x, q.y, q.r, 0, 6.28); pctx.fill(); }
      if (q.y < -12) { q.y = h + 10; q.x = Math.random() * w; }
      if (q.y > h + 12) { q.y = -10; q.x = Math.random() * w; }
    }
    pctx.globalAlpha = 1;
    particleFrame = requestAnimationFrame(drawParticles);
  }
  window.addEventListener('resize', () => { if (particleMode !== 'none') startParticles(particleMode); });
  document.addEventListener('pointermove', e => {
    if (!sparkleOn || reduced || Date.now() - sparkleAt < 45) return;
    sparkleAt = Date.now();
    const s = document.createElement('span');
    s.textContent = '✦';
    s.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:96;pointer-events:none;color:var(--green);font-size:${10 + Math.random() * 12}px;transition:transform .7s,opacity .7s`;
    document.body.appendChild(s);
    requestAnimationFrame(() => { s.style.transform = `translate(${(Math.random() - .5) * 30}px,24px)`; s.style.opacity = '0'; });
    setTimeout(() => s.remove(), 750);
  });

  function apply(prefs, premium) {
    if (!premium) { style.textContent = ''; startParticles('none'); sparkleOn = false; const title = document.querySelector('.title'); if (title && titleOriginal.has(title)) title.textContent = titleOriginal.get(title); document.documentElement.removeAttribute('data-premium-look'); return; }
    const p = prefs || {};
    const get = (key, choices, fallback) => valid(p[key], choices, fallback);
    const css = [];
    const theme = THEMES[get('theme', Object.keys(THEMES), 'neon')];
    css.push(`:root { --green:${theme[0]}; --blue:${theme[1]}; --purple:${theme[2]}; }`);

    const bg = get('bg', ['default','amoled','aurora','sunset','ocean','forest','galaxy','lava','candy','grid'], 'default');
    if (bg === 'default') {
      // Leave each page's own default background intact.
    } else if (bg === 'grid') {
      css.push('html, body { background-color:#07060d !important; background-image:linear-gradient(rgba(34,245,160,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(34,245,160,.09) 1px,transparent 1px) !important; background-size:34px 34px !important; background-attachment:fixed !important; min-height:100%; }');
    } else {
      const value = BACKGROUNDS[bg] || '#000';
      css.push(`html, body { background:${value} !important; background-image:${value.startsWith('linear-gradient') || value.startsWith('radial-gradient') ? value : 'none'} !important; background-attachment:fixed !important; min-height:100%; }`);
    }

    const font = FONTS[get('font', ['default', ...Object.keys(FONTS)], 'default')];
    if (font) css.push(`body, button, input, select, textarea { font-family:${font} !important; }`);
    const size = get('size', ['small','normal','large'], 'normal');
    if (size === 'small') css.push('body { zoom:.92; }');
    if (size === 'large') css.push('body { zoom:1.12; }');

    const all = 'button, .tab, .ui-fab, .lb-back';
    const shape = get('shape', ['default','pill','square'], 'default');
    if (shape === 'pill') css.push(`${all} { border-radius:999px !important; }`);
    if (shape === 'square') css.push(`${all} { border-radius:4px !important; }`);
    const glow = get('glow', ['off','normal','extra'], 'normal');
    if (glow === 'off') css.push('button { box-shadow:none !important; }');
    if (glow === 'extra') css.push('button { filter:drop-shadow(0 0 8px var(--green)); }');
    const glass = get('glass', ['solid','normal','glass'], 'normal');
    if (glass === 'solid') css.push(':root { --panel:rgba(18,16,30,.96) !important; }');
    if (glass === 'glass') css.push(':root { --panel:rgba(255,255,255,.14) !important; } .card,.seo-text,.lb-page { backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); }');
    const ring = RINGS[get('ring', ['none', ...Object.keys(RINGS)], 'none')];
    if (ring) css.push(`.lb-pic { box-shadow:0 0 0 3px ${ring}, 0 0 14px ${ring} !important; }`);
    if (p.rainbow === true) css.push('.title { background:linear-gradient(90deg,#f87171,#fbbf24,#4ade80,#38bdf8,#a78bfa,#f472b6,#f87171); background-size:300% 100%; -webkit-background-clip:text; background-clip:text; color:transparent !important; -webkit-text-fill-color:transparent; animation:prem-global-shift 6s linear infinite; } @keyframes prem-global-shift { to { background-position:300% 0; } }');
    style.textContent = css.join('\n');

    const title = document.querySelector('.title');
    if (title) {
      if (!titleOriginal.has(title)) titleOriginal.set(title, title.textContent);
      title.textContent = typeof p.title === 'string' && p.title.trim() ? p.title.trim().slice(0, 24) : titleOriginal.get(title);
    }
    startParticles(get('particles', ['none','stars','bubbles','snow','embers'], 'none'));
    sparkleOn = p.sparkle === true;
    document.documentElement.setAttribute('data-premium-look', 'on');
  }

  async function refresh() {
    const t = token();
    if (!t) { apply({}, false); return; }
    try {
      const res = await fetch(API + '/account/premium', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }), cache: 'no-store'
      });
      if (!res.ok) { apply({}, false); return; }
      const data = await res.json();
      apply(data.prefs || {}, data.premium === true);
      try {
        if (data.premium) localStorage.setItem(CACHE, JSON.stringify({ premium: true, prefs: data.prefs || {} }));
        else localStorage.removeItem(CACHE);
      } catch (e) {}
    } catch (e) {
      const cached = readCache();
      if (cached && cached.premium && token()) apply(cached.prefs || {}, true);
    }
  }

  const cached = readCache();
  if (cached && cached.premium && token()) apply(cached.prefs || {}, true);
  refresh();
  let lastToken = token();
  setInterval(() => { if (token() !== lastToken) { lastToken = token(); refresh(); } }, 1500);
})();
