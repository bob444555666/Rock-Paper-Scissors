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
    if (!premium) { style.textContent = ''; startParticles('none'); sparkleOn = false; document.documentElement.removeAttribute('data-premium-look'); return; }
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
    startParticles(get('particles', ['none','stars','bubbles','snow','embers'], 'none'));\n    sparkleOn = p.sparkle === true;\n    document.documentElement.setAttribute('data-premium-look', 'on');
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
