/* Premium (v3): 20 options just for Premium members.
   Premium is won in a tournament that has Premium as the prize, or given by the staff.
   Open them from your profile: tap "Premium options". Your choices are saved on your account.
   Self-contained: it cannot break the main game. */
(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev'
  const CACHE = 'premiumPrefsCache'

  // ---------- the 20 options ----------
  const C = (id, label, choices, def) => ({ id, label, type: 'choice', choices, def })
  const T = (id, label, def) => ({ id, label, type: 'toggle', def })
  const OPTIONS = [
    { group: 'Look' },
    C('theme', '🎨 Color theme', [['neon', 'Neon'], ['gold', 'Gold'], ['ocean', 'Ocean'], ['sunset', 'Sunset'], ['forest', 'Forest'], ['ice', 'Ice'], ['candy', 'Candy'], ['mono', 'Mono']], 'neon'),
    C('bg', '🖼️ Change background', [['default', 'Default'], ['amoled', 'Black'], ['aurora', 'Aurora'], ['sunset', 'Sunset'], ['ocean', 'Ocean'], ['forest', 'Forest'], ['galaxy', 'Galaxy'], ['lava', 'Lava'], ['candy', 'Candy'], ['grid', 'Grid']], 'default'),
    C('particles', '✨ Floating effects', [['none', 'Off'], ['stars', 'Stars'], ['bubbles', 'Bubbles'], ['snow', 'Snow'], ['embers', 'Embers']], 'none'),
    C('font', '🔤 Font', [['default', 'Default'], ['rounded', 'Rounded'], ['mono', 'Mono'], ['serif', 'Serif'], ['fun', 'Fun']], 'default'),
    C('size', '🔎 Text size', [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']], 'normal'),
    C('shape', '🔘 Button shape', [['default', 'Default'], ['pill', 'Round'], ['square', 'Square']], 'default'),
    C('glow', '💡 Button glow', [['off', 'Off'], ['normal', 'Normal'], ['extra', 'Extra']], 'normal'),
    C('glass', '🪟 Panels', [['solid', 'Solid'], ['normal', 'Normal'], ['glass', 'Glass']], 'normal'),
    C('ring', '⭕ Avatar ring', [['none', 'None'], ['green', 'Green'], ['gold', 'Gold'], ['pink', 'Pink'], ['blue', 'Blue'], ['red', 'Red']], 'none'),
    { id: 'title', label: '✏️ Game title', type: 'text', def: '', placeholder: 'Rock Paper Scissors' },
    C('icons', '✊ Move icons', [['classic', 'Classic'], ['emoji', 'Emoji'], ['space', 'Space'], ['animals', 'Animals'], ['food', 'Food']], 'classic'),
    { group: 'Feel' },
    T('confetti', '🎉 Confetti when you win', false),
    T('sounds', '🔊 Win and lose sounds', false),
    T('haptics', '📳 Vibrate when you tap', false),
    T('flash', '⚡ Screen flash on win or lose', false),
    T('rainbow', '🌈 Rainbow title', false),
    T('sparkle', '✦ Sparkle trail', false),
    { group: 'Account' },
    { id: 'badge', label: '⭐ Leaderboard badge', type: 'toggle', def: true, server: true },
    T('crown', '👑 Crown on your name', false),
    T('scout', '🔎 Tournament scout stats', true)
  ].filter(Boolean)
  const REAL = OPTIONS.filter(o => o.id)

  const THEMES = {
    gold: ['#fbbf24', '#f59e0b', '#fcd34d'], ocean: ['#38bdf8', '#2563eb', '#22d3ee'], sunset: ['#fb923c', '#f43f5e', '#ec4899'],
    forest: ['#4ade80', '#16a34a', '#a3e635'], ice: ['#e0f2fe', '#7dd3fc', '#a5b4fc'], candy: ['#f472b6', '#c084fc', '#fb7185'], mono: ['#e5e7eb', '#9ca3af', '#d1d5db']
  }
  const BACKGROUNDS = {
    amoled: '#000',
    aurora: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
    sunset: 'linear-gradient(160deg, #1a0b2e, #6a1b4d, #ff7e5f)',
    ocean: 'linear-gradient(180deg, #001f3f, #0b4f8a, #0e7490)',
    forest: 'linear-gradient(180deg, #06140c, #14532d, #1b5e20)',
    galaxy: 'radial-gradient(ellipse at top, #24304a, #090a0f 70%)',
    lava: 'linear-gradient(180deg, #1a0000, #7f1d1d, #f97316)',
    candy: 'linear-gradient(135deg, #3b0a45, #c026d3, #f472b6)'
  }
  const FONTS = {
    rounded: "'Trebuchet MS', 'Arial Rounded MT Bold', system-ui, sans-serif",
    mono: "'Courier New', ui-monospace, monospace",
    serif: "Georgia, 'Times New Roman', serif",
    fun: "'Comic Sans MS', 'Comic Sans', cursive"
  }
  const RINGS = { green: '#22f5a0', gold: '#fbbf24', pink: '#f472b6', blue: '#3b82f6', red: '#ef4444' }
  const ICONS = { emoji: ['✊', '✋', '✌️'], space: ['🪐', '🛸', '☄️'], animals: ['🐻', '🦉', '🦈'], food: ['🍔', '🍟', '🍕'] }
  const ICON_SELECTORS = ['.js-rock-button .move-icon', '.js-paper-button .move-icon', '.js-scissors-button .move-icon']

  let status = null // server answer: { premium, source, badge, prefs }
  let prefs = {}
  let lastToken = null
  let saveTimer = null

  const session = () => { try { return localStorage.getItem('token') } catch (error) { return null } }
  const store = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch (error) {} }
  const load = k => { try { return localStorage.getItem(k) } catch (error) { return null } }

  async function call(path, data) {
    try {
      const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, token: session() })
      })
      let json = {}
      try { json = await res.json() } catch (error) {}
      return { ok: res.ok, status: res.status, data: json }
    } catch (error) {
      return { ok: false, status: 0, data: { error: 'Could not reach the server.' } }
    }
  }

  function make(tag, props = {}, ...kids) {
    const el = document.createElement(tag)
    Object.assign(el, props)
    kids.forEach(k => el.append(k))
    return el
  }

  // value of an option, always valid (unknown values fall back to the default)
  function get(id) {
    const o = REAL.find(x => x.id === id)
    const v = prefs[id]
    if (o.type === 'toggle') return o.id === 'badge' ? !!(status && status.badge) : v === undefined ? o.def : !!v
    if (o.type === 'text') return typeof v === 'string' ? v.slice(0, 24) : ''
    return o.choices.some(c => c[0] === v) ? v : o.def
  }

  // ---------- applying the options ----------
  const style = make('style', { id: 'prem-style' })
  document.head.appendChild(style)

  const titleEl = document.querySelector('.title')
  const titleOrig = titleEl ? titleEl.textContent : ''
  const iconOrig = new Map()

  function emojiUrl(e) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="76" font-size="72" text-anchor="middle">${e}</text></svg>`)
  }

  function apply() {
    const on = !!(status && status.premium)
    const g = id => (on ? get(id) : REAL.find(o => o.id === id).def)
    const css = []

    const th = THEMES[g('theme')]
    if (th) css.push(`:root { --green: ${th[0]}; --blue: ${th[1]}; --purple: ${th[2]}; }`)

    const bg = g('bg')
    if (BACKGROUNDS[bg]) css.push(`html, body { background: ${BACKGROUNDS[bg]} !important; background-image: ${BACKGROUNDS[bg].startsWith('linear-gradient') || BACKGROUNDS[bg].startsWith('radial-gradient') ? BACKGROUNDS[bg] : 'none'} !important; background-attachment: fixed !important; min-height: 100%; }`)
    if (bg === 'grid') css.push(`html, body { background-color: #07060d !important; background-image: linear-gradient(rgba(34, 245, 160, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 245, 160, 0.09) 1px, transparent 1px) !important; background-size: 34px 34px !important; background-attachment: fixed !important; }`)

    if (FONTS[g('font')]) css.push(`body, button, input, select, textarea { font-family: ${FONTS[g('font')]} !important; }`)
    if (g('size') === 'small') css.push('body { zoom: 0.92; }')
    if (g('size') === 'large') css.push('body { zoom: 1.12; }')

    const all = '.move-button, .level-button, .mode-button, #join-button, .big, .ui-fab, .reset-score-button, .tab'
    if (g('shape') === 'pill') css.push(`${all} { border-radius: 999px !important; } .move-button { border-radius: 36px !important; }`)
    if (g('shape') === 'square') css.push(`${all} { border-radius: 4px !important; }`)

    if (g('glow') === 'off') css.push('button { box-shadow: none !important; }')
    if (g('glow') === 'extra') css.push('button { filter: drop-shadow(0 0 8px var(--green)); }')

    if (g('glass') === 'solid') css.push(':root { --panel: rgba(18, 16, 30, 0.96); }')
    if (g('glass') === 'glass') css.push(':root { --panel: rgba(255, 255, 255, 0.14); } .card, .seo-text { backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }')

    if (RINGS[g('ring')]) css.push(`#pf-avatar { box-shadow: 0 0 0 4px ${RINGS[g('ring')]}, 0 0 18px ${RINGS[g('ring')]} !important; }`)
    if (g('crown')) css.push("#user-chip::before { content: '👑 '; }")
    if (g('rainbow')) {
      css.push(`.title { background: linear-gradient(90deg, #f87171, #fbbf24, #4ade80, #38bdf8, #a78bfa, #f472b6, #f87171); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent !important; -webkit-text-fill-color: transparent; text-shadow: none !important; animation: prem-shift 6s linear infinite; } @keyframes prem-shift { to { background-position: 300% 0; } }`)
    }
    style.textContent = css.join('\n')

    if (titleEl) titleEl.textContent = on && g('title').trim() ? g('title').trim().slice(0, 24) : titleOrig

    ICON_SELECTORS.forEach((sel, i) => {
      const img = document.querySelector(sel)
      if (!img) return
      if (!iconOrig.has(img)) iconOrig.set(img, img.getAttribute('src'))
      const pack = ICONS[g('icons')]
      img.src = pack ? emojiUrl(pack[i]) : iconOrig.get(img)
    })

    startParticles(on ? g('particles') : 'none')
    sparkleOn = on && g('sparkle')
  }

  // ---------- floating particles ----------
  const pc = make('canvas')
  pc.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none'
  document.body.append(pc)
  const pctx = pc.getContext ? pc.getContext('2d') : null
  let pmode = 'none'
  let parts = []
  let raf = 0
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function startParticles(mode) {
    if (!pctx || reduced) mode = 'none'
    pmode = mode
    cancelAnimationFrame(raf)
    if (pctx) pctx.clearRect(0, 0, pc.width, pc.height)
    if (mode === 'none') return
    pc.width = window.innerWidth
    pc.height = window.innerHeight
    const n = mode === 'stars' ? 70 : 45
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * pc.width, y: Math.random() * pc.height,
      r: mode === 'bubbles' ? 3 + Math.random() * 9 : 0.6 + Math.random() * 2,
      s: 0.3 + Math.random() * 1.2, p: Math.random() * 6.28
    }))
    loop()
  }

  function loop() {
    if (pmode === 'none') return
    const w = pc.width, h = pc.height, t = Date.now() / 1000
    pctx.clearRect(0, 0, w, h)
    for (const q of parts) {
      if (pmode === 'stars') {
        pctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * q.s + q.p))
        pctx.fillStyle = '#fff'
      } else if (pmode === 'bubbles') {
        q.y -= q.s * 0.6; q.x += Math.sin(t + q.p) * 0.3
        pctx.globalAlpha = 0.35
        pctx.strokeStyle = '#bfe9ff'
        pctx.lineWidth = 1.5
        pctx.beginPath(); pctx.arc(q.x, q.y, q.r, 0, 6.28); pctx.stroke()
      } else if (pmode === 'snow') {
        q.y += q.s * 0.8; q.x += Math.sin(t + q.p) * 0.4
        pctx.globalAlpha = 0.85
        pctx.fillStyle = '#fff'
      } else {
        q.y -= q.s * 1.4; q.x += Math.sin(t * 2 + q.p) * 0.5
        pctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + q.p))
        pctx.fillStyle = '#fb923c'
      }
      if (pmode !== 'bubbles') { pctx.beginPath(); pctx.arc(q.x, q.y, q.r, 0, 6.28); pctx.fill() }
      if (q.y < -12) { q.y = h + 10; q.x = Math.random() * w }
      if (q.y > h + 12) { q.y = -10; q.x = Math.random() * w }
    }
    pctx.globalAlpha = 1
    raf = requestAnimationFrame(loop)
  }
  window.addEventListener('resize', () => { if (pmode !== 'none') startParticles(pmode) })

  // ---------- feel: confetti, sounds, flash, vibration, sparkles ----------
  const cc = make('canvas')
  cc.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:95;pointer-events:none'
  document.body.append(cc)
  const cctx = cc.getContext ? cc.getContext('2d') : null

  function confetti() {
    if (!cctx || reduced) return
    cc.width = window.innerWidth
    cc.height = window.innerHeight
    const colors = ['#f87171', '#fbbf24', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6']
    const bits = Array.from({ length: 90 }, () => ({
      x: cc.width / 2, y: cc.height * 0.4, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 3,
      c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6, w: 5 + Math.random() * 5
    }))
    const start = Date.now()
    ;(function frame() {
      const age = Date.now() - start
      cctx.clearRect(0, 0, cc.width, cc.height)
      if (age > 1800) return
      bits.forEach(b => {
        b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.a += 0.2
        cctx.save(); cctx.globalAlpha = Math.max(0, 1 - age / 1800)
        cctx.translate(b.x, b.y); cctx.rotate(b.a); cctx.fillStyle = b.c; cctx.fillRect(-b.w / 2, -b.w / 4, b.w, b.w / 2); cctx.restore()
      })
      requestAnimationFrame(frame)
    })()
  }

  let audio = null
  function beep(freq, when, len, type) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)()
      const o = audio.createOscillator(), gain = audio.createGain()
      o.type = type || 'sine'
      o.frequency.value = freq
      gain.gain.setValueAtTime(0.12, audio.currentTime + when)
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + when + len)
      o.connect(gain); gain.connect(audio.destination)
      o.start(audio.currentTime + when); o.stop(audio.currentTime + when + len)
    } catch (error) {}
  }

  const flashEl = make('div')
  flashEl.style.cssText = 'position:fixed;inset:0;z-index:94;pointer-events:none;opacity:0'
  document.body.append(flashEl)
  function flash(color) {
    flashEl.style.transition = 'none'
    flashEl.style.background = color
    flashEl.style.opacity = '0.3'
    void flashEl.offsetWidth
    flashEl.style.transition = 'opacity 0.6s'
    flashEl.style.opacity = '0'
  }

  const premiumNow = () => !!(status && status.premium)

  function celebrate(result) {
    if (!premiumNow()) return
    if (result === 'win') {
      if (get('confetti')) confetti()
      if (get('sounds')) { beep(660, 0, 0.12); beep(880, 0.12, 0.2) }
      if (get('flash')) flash('#22f5a0')
    } else {
      if (get('sounds')) beep(200, 0, 0.3, 'sawtooth')
      if (get('flash')) flash('#ef4444')
    }
  }

  const resEl = document.querySelector('.js-result')
  let lastCelebrate = 0
  if (resEl) {
    new MutationObserver(() => {
      const t = resEl.textContent.trim()
      const now = Date.now()
      if (now - lastCelebrate < 300) return
      if (/^you win/i.test(t)) { lastCelebrate = now; celebrate('win') }
      else if (/^you lose/i.test(t)) { lastCelebrate = now; celebrate('loss') }
    }).observe(resEl, { childList: true, characterData: true, subtree: true })
  }

  document.addEventListener('click', e => {
    if (premiumNow() && get('haptics') && e.target && e.target.closest && e.target.closest('.move-button, .ch-move, .to-move') && navigator.vibrate) navigator.vibrate(18)
  })

  let sparkleOn = false
  let sparkleAt = 0
  document.addEventListener('pointermove', e => {
    if (!sparkleOn || reduced) return
    const now = Date.now()
    if (now - sparkleAt < 45) return
    sparkleAt = now
    const s = make('span', { textContent: '✦' })
    s.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:96;pointer-events:none;color:var(--green);font-size:${10 + Math.random() * 12}px;transition:transform .7s,opacity .7s;opacity:1`
    document.body.append(s)
    requestAnimationFrame(() => { s.style.transform = `translate(${(Math.random() - 0.5) * 30}px, 24px)`; s.style.opacity = '0' })
    setTimeout(() => s.remove(), 750)
  })

  // ---------- the options window ----------
  const panelStyle = make('style', { textContent: `
    #prem-layer { z-index: 90; align-items: flex-start; }
    #prem-layer .card { width: min(100%, 520px); max-height: 92vh; margin-top: 8px; text-align: left; }
    #prem-layer h2 { text-align: center; }
    #prem-layer .po { margin: 10px 0; padding: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; }
    #prem-layer .po b { display: block; margin-bottom: 6px; font-size: 14px; }
    #prem-layer .tabs { flex-wrap: wrap; gap: 6px; }
    #prem-layer .tab { flex: 0 0 auto; padding: 7px 10px; font-size: 13px; }
  ` })
  document.head.appendChild(panelStyle)

  const panelBody = make('div')
  const panelMsg = make('p', { className: 'msg' })
  const panelClose = make('button', { className: 'x', type: 'button', textContent: '✕' })
  const panelCard = make('div', { className: 'card' }, panelClose, make('h2', { textContent: '⭐ Premium options' }), panelBody, panelMsg)
  const panel = make('div', { id: 'prem-layer', className: 'ui-layer' }, panelCard)
  panel.hidden = true
  document.body.append(panel)
  panelClose.addEventListener('click', () => { panel.hidden = true })

  function persist() {
    store(CACHE, JSON.stringify({ premium: premiumNow(), prefs }))
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const r = await call('/account/premium-prefs', { prefs })
      panelMsg.textContent = r.ok ? '' : (r.data.error || 'Could not save your options.')
    }, 500)
  }

  async function setOption(o, value) {
    if (o.server) { // the leaderboard badge lives on the server
      const r = await call('/account/premium-badge', { on: value })
      if (r.ok) status.badge = r.data.badge
      else panelMsg.textContent = r.data.error || 'Could not change that.'
    } else {
      prefs = { ...prefs, [o.id]: value }
      persist()
    }
    apply()
    renderPanel()
  }

  function renderPanel() {
    panelBody.textContent = ''
    OPTIONS.forEach(o => {
      if (o.group) { panelBody.append(make('h3', { textContent: o.group })); return }
      const box = make('div', { className: 'po' }, make('b', { textContent: o.label }))
      if (o.type === 'choice') {
        const row = make('div', { className: 'tabs' })
        o.choices.forEach(([id, label]) => {
          const b = make('button', { className: 'tab' + (get(o.id) === id ? ' on' : ''), type: 'button', textContent: label })
          b.addEventListener('click', () => setOption(o, id))
          row.append(b)
        })
        box.append(row)
      } else if (o.type === 'toggle') {
        const row = make('div', { className: 'tabs' })
        ;[[true, 'On'], [false, 'Off']].forEach(([val, label]) => {
          const b = make('button', { className: 'tab' + (get(o.id) === val ? ' on' : ''), type: 'button', textContent: label })
          b.addEventListener('click', () => setOption(o, val))
          row.append(b)
        })
        box.append(row)
      } else {
        const input = make('input', { type: 'text', maxLength: 24, placeholder: o.placeholder, value: get(o.id) })
        input.addEventListener('input', () => { prefs = { ...prefs, [o.id]: input.value }; persist(); apply() })
        box.append(input)
      }
      panelBody.append(box)
    })
    const reset = make('button', { className: 'big danger', type: 'button', textContent: 'Reset all options' })
    reset.addEventListener('click', async () => {
      if (!confirm('Put every option back to the default?')) return
      prefs = {}
      persist()
      if (status && status.badge === false) await call('/account/premium-badge', { on: true }).then(r => { if (r.ok) status.badge = true })
      apply()
      renderPanel()
    })
    panelBody.append(reset)
  }

  // ---------- profile section ----------
  const layer = document.querySelector('#profile-layer')
  const anchor = document.querySelector('#pf-logout')
  let info, openBtn

  if (layer && anchor) {
    const head = make('h3', { textContent: 'Premium' })
    info = make('p', { className: 'auth-sub' })
    openBtn = make('button', { className: 'big', type: 'button', textContent: '⭐ Premium options' })
    ;[head, info, openBtn].forEach(n => anchor.parentNode.insertBefore(n, anchor))
    openBtn.addEventListener('click', () => { if (premiumNow()) { panelMsg.textContent = ''; renderPanel(); panel.hidden = false } })
    new MutationObserver(() => { if (!layer.hidden) refresh() }).observe(layer, { attributes: true, attributeFilter: ['hidden'] })
  }

  function showProfile() {
    if (!info) return
    if (!status) { info.textContent = session() ? 'Loading...' : 'Log in to see your Premium status.'; openBtn.disabled = true; return }
    if (!status.premium) {
      info.textContent = '🔒 Locked. Win a tournament that has Premium as the prize to unlock 20 options: backgrounds, themes, effects, sounds and more.'
      openBtn.disabled = true
      return
    }
    info.textContent = `⭐ You have Premium (${status.source === 'tournament' ? 'won in a tournament' : 'given by the staff'}). Tap below to change your background and 19 more options.`
    openBtn.disabled = false
  }

  // ---------- status ----------
  async function refresh() {
    lastToken = session()
    if (!lastToken) {
      status = null
      prefs = {}
      store(CACHE, null)
      apply(); showProfile()
      return
    }
    const r = await call('/account/premium', {})
    if (r.ok) {
      status = r.data
      prefs = status.premium && status.prefs ? status.prefs : {}
      store(CACHE, status.premium ? JSON.stringify({ premium: true, prefs }) : null)
    } else if (r.status === 401) {
      status = null
      prefs = {}
      store(CACHE, null)
    }
    apply()
    showProfile()
    if (!panel.hidden && !premiumNow()) panel.hidden = true
  }

  // show the saved look instantly while the server is being asked
  try {
    const cached = JSON.parse(load(CACHE) || 'null')
    if (cached && cached.premium && session()) {
      status = { premium: true, source: '', badge: true, prefs: cached.prefs || {} }
      prefs = cached.prefs || {}
      apply()
    }
  } catch (error) {}

  refresh()
  setInterval(() => { if (session() !== lastToken) refresh() }, 1500) // log in / out
  setInterval(refresh, 5 * 60 * 1000) // Premium given or removed
})()
