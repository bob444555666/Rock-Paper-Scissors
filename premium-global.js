/* Shared Premium appearance for every page outside the main game page.
   premium.js owns the main game page; this file mirrors its visual preferences elsewhere. */
(() => {
  if (document.getElementById('prem-style')) return;
  const API = 'https://rps-server.heyboernathan.workers.dev';
  const CACHE = 'premiumPrefsCache';
  const token = () => { try { return localStorage.getItem('token'); } catch (e) { return null; } };
  const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { return null; } };
  const titleOriginal = new Map();
  const style = document.createElement('style');
  style.id = 'prem-global-style';
  document.head.appendChild(style);

  // A shared, accessible slide-out menu keeps navigation tidy across pages.
  function installSiteMenu() {
    if (document.getElementById('rps-menu-toggle') || !document.body) return;
    const navCss = document.createElement('style');
    navCss.id = 'rps-menu-css';
    navCss.textContent = \`
      #rps-menu-toggle{position:fixed;top:calc(14px + env(safe-area-inset-top));right:14px;z-index:1200;display:flex;align-items:center;gap:9px;padding:11px 15px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(14,13,24,.9);color:#f7f6ff;font:700 14px system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.28);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);transition:transform .18s,border-color .18s}
      #rps-menu-toggle:hover{transform:translateY(-1px);border-color:var(--green,#22f5a0)}
      #rps-menu-toggle .rps-menu-glyph{font-size:18px;line-height:1}
      #rps-menu-scrim{position:fixed;inset:0;z-index:1201;background:rgba(3,3,10,.64);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;pointer-events:none;transition:opacity .22s}
      #rps-menu-scrim.open{opacity:1;pointer-events:auto}
      #rps-menu-drawer{position:fixed;top:0;right:0;bottom:0;z-index:1202;width:min(360px,88vw);padding:calc(22px + env(safe-area-inset-top)) 20px calc(22px + env(safe-area-inset-bottom));overflow-y:auto;background:linear-gradient(160deg,rgba(24,21,42,.99),rgba(8,10,22,.99));border-left:1px solid rgba(255,255,255,.12);box-shadow:-24px 0 70px rgba(0,0,0,.45);transform:translateX(105%);visibility:hidden;transition:transform .24s ease,visibility .24s}
      #rps-menu-drawer.open{transform:translateX(0);visibility:visible}
      .rps-menu-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px}
      .rps-menu-brand{font-size:19px;font-weight:850;color:#fff}
      .rps-menu-sub{margin:0 0 20px;color:rgba(255,255,255,.56);font-size:11px;letter-spacing:1.6px;text-transform:uppercase}
      #rps-menu-close{width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;font-size:22px;cursor:pointer}
      .rps-menu-links{display:grid;gap:7px}
      .rps-menu-link{display:flex;align-items:center;gap:12px;min-height:48px;padding:11px 13px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:rgba(255,255,255,.035);color:#f4f2ff;text-decoration:none;font:600 14px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;transition:background .16s,border-color .16s,transform .16s}
      .rps-menu-link:hover,.rps-menu-link:focus-visible{background:rgba(255,255,255,.085);border-color:rgba(34,245,160,.42);transform:translateX(-2px);outline:none}
      .rps-menu-emoji{display:grid;place-items:center;width:30px;height:30px;flex:none;border-radius:10px;background:rgba(168,85,247,.15);font-size:16px}
      #rps-menu-account{margin:0 0 15px}
      #rps-menu-account .ui-fab{position:static!important;display:block;width:100%;max-width:none;text-align:left;margin:0 0 8px;padding:12px 14px;font-size:14px;box-shadow:none!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:13px;background:rgba(255,255,255,.055)!important}
      #rps-menu-account #user-chip[hidden]{display:none!important}
      body.rps-menu-open{overflow:hidden}
      @media(max-width:480px){#rps-menu-toggle{top:calc(10px + env(safe-area-inset-top));right:10px;padding:10px 12px}#rps-menu-drawer{width:min(340px,90vw)}}
      @media(prefers-reduced-motion:reduce){#rps-menu-toggle,#rps-menu-scrim,#rps-menu-drawer,.rps-menu-link{transition:none}}
    \`;
    document.head.appendChild(navCss);
    const toggle = document.createElement('button');
    toggle.id = 'rps-menu-toggle'; toggle.type = 'button';
    toggle.setAttribute('aria-label','Open navigation menu');
    toggle.setAttribute('aria-controls','rps-menu-drawer');
    toggle.setAttribute('aria-expanded','false');
    toggle.innerHTML = '<span class="rps-menu-glyph" aria-hidden="true">☰</span><span>Menu</span>';
    const scrim = document.createElement('div');
    scrim.id = 'rps-menu-scrim'; scrim.setAttribute('aria-hidden','true');
    const drawer = document.createElement('aside');
    drawer.id = 'rps-menu-drawer'; drawer.setAttribute('aria-label','Site navigation'); drawer.setAttribute('aria-hidden','true');
    drawer.innerHTML = \`
      <div class="rps-menu-head"><div class="rps-menu-brand">✊ Stone Paper Scissors</div><button id="rps-menu-close" type="button" aria-label="Close menu">×</button></div>
      <p class="rps-menu-sub">Jump to a section</p>
      <div id="rps-menu-account"></div>
      <nav class="rps-menu-links">
        <a class="rps-menu-link" href="/"><span class="rps-menu-emoji">🎮</span><span>Play the game</span></a>
        <a class="rps-menu-link" href="/leaderboard.html"><span class="rps-menu-emoji">🏆</span><span>Leaderboard</span></a>
        <a class="rps-menu-link" href="/multiplayer.html"><span class="rps-menu-emoji">👥</span><span>3–4 Player Rooms</span></a>
        <a class="rps-menu-link" href="/arcade-hub.html"><span class="rps-menu-emoji">🕹️</span><span>Arcade Hub</span></a>
        <a class="rps-menu-link" href="/quests.html"><span class="rps-menu-emoji">🎯</span><span>Quests</span></a>
        <a class="rps-menu-link" href="/achievements.html"><span class="rps-menu-emoji">🏅</span><span>Achievements</span></a>
        <a class="rps-menu-link" href="/vault.html"><span class="rps-menu-emoji">🎨</span><span>Style Vault</span></a>
        <a class="rps-menu-link" href="/subscribe.html"><span class="rps-menu-emoji">⭐</span><span>Premium</span></a>
        <a class="rps-menu-link" href="/privacy.html"><span class="rps-menu-emoji">🔒</span><span>Privacy Policy</span></a>
      </nav>\`;
    document.body.append(toggle, scrim, drawer);
    const account = drawer.querySelector('#rps-menu-account');
    const userChip = document.getElementById('user-chip');
    if (userChip) account.appendChild(userChip);
    ['lb-btn','mp-btn','arcade-hub-btn','premium-subscribe-btn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.setProperty('display','none','important');
    });
    const open = () => {
      drawer.classList.add('open'); scrim.classList.add('open'); document.body.classList.add('rps-menu-open');
      toggle.setAttribute('aria-expanded','true'); toggle.setAttribute('aria-label','Close navigation menu');
      drawer.setAttribute('aria-hidden','false'); scrim.setAttribute('aria-hidden','false');
      drawer.querySelector('#rps-menu-close').focus();
    };
    const close = () => {
      drawer.classList.remove('open'); scrim.classList.remove('open'); document.body.classList.remove('rps-menu-open');
      toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-label','Open navigation menu');
      drawer.setAttribute('aria-hidden','true'); scrim.setAttribute('aria-hidden','true'); toggle.focus();
    };
    toggle.addEventListener('click', () => drawer.classList.contains('open') ? close() : open());
    drawer.querySelector('#rps-menu-close').addEventListener('click', close);
    scrim.addEventListener('click', close);
    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      drawer.classList.remove('open'); scrim.classList.remove('open'); document.body.classList.remove('rps-menu-open');
    }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) close(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installSiteMenu, { once: true });
  else installSiteMenu();

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
