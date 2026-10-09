/* AI Coach (v1). Replaces the old player-to-player chat.
   A moving, color-changing orb in the bottom-right corner opens a chat with an AI that helps with strategy.
   Type the secret code into the chat box to open the Voice Control panel (the code is checked by the server,
   it is NOT stored in this file).
   Self-contained: builds its own button and panel, so it cannot break the main game. */
(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev'
  const COLOR_KEY = 'aiOrbColor'
  const COLORS = [
    ['Green', '#22f5a0'], ['Blue', '#3b82f6'], ['Purple', '#a855f7'], ['Pink', '#ff4fa3'],
    ['Gold', '#fbbf24'], ['Red', '#ff5a5a'], ['Cyan', '#22d3ee'], ['White', '#e5e7eb']
  ]

  let color = COLORS[0][1]
  try { color = localStorage.getItem(COLOR_KEY) || color } catch (error) {}
  let busy = false
  let thinking = false
  let history = []        // what we send to the AI: [{ role, content }]
  let panelCode = null    // the secret code, kept in memory only while Voice Control is open
  let settings = null

  const session = () => { try { return localStorage.getItem('token') } catch (error) { return null } }

  // ---------- styles ----------
  const style = document.createElement('style')
  style.textContent = `
    #ai-btn { top: auto; bottom: calc(10px + env(safe-area-inset-bottom)); right: 8px; width: 76px; height: 76px; padding: 0; background: transparent; border: 0; border-radius: 50%; box-shadow: none; animation: ai-bob 4.5s ease-in-out infinite; }
    #ai-btn canvas { display: block; width: 100%; height: 100%; pointer-events: none; }
    #ai-btn:active { transform: scale(0.92); }
    @keyframes ai-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    @media (prefers-reduced-motion: reduce) { #ai-btn { animation: none; } }
    #ai-panel { position: fixed; top: 0; right: 0; bottom: 0; z-index: 45; display: flex; flex-direction: column; width: min(340px, 92vw); padding: calc(10px + env(safe-area-inset-top)) 12px calc(10px + env(safe-area-inset-bottom)); background: rgba(7, 6, 13, 0.97); border-left: 2px solid var(--ai, #22f5a0); box-shadow: -8px 0 30px rgba(0, 0, 0, 0.6); }
    #ai-panel .ai-head { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; }
    #ai-panel .ai-head canvas { width: 54px; height: 54px; flex: none; }
    #ai-panel .ai-title { flex: 1; min-width: 0; font-weight: bold; color: var(--ai, #22f5a0); }
    #ai-panel .ai-title small { display: block; font-weight: normal; font-size: 12px; color: rgba(255, 255, 255, 0.55); }
    #ai-panel .ai-x { padding: 4px 9px; font-family: inherit; font-weight: bold; color: white; cursor: pointer; background: transparent; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 10px; }
    #ai-panel .ai-colors { display: flex; gap: 7px; flex-wrap: wrap; padding: 4px 0 8px; }
    #ai-panel .ai-sw { width: 24px; height: 24px; padding: 0; cursor: pointer; border: 2px solid rgba(255, 255, 255, 0.25); border-radius: 50%; }
    #ai-panel .ai-sw.on { border-color: white; box-shadow: 0 0 8px currentColor; }
    #ai-panel .ai-sw.custom { position: relative; overflow: hidden; background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red); }
    #ai-panel .ai-sw.custom input { position: absolute; inset: -6px; width: 40px; height: 40px; opacity: 0; cursor: pointer; }
    #ai-log { flex: 1; overflow-y: auto; padding: 6px 2px; }
    .ai-msg { display: block; width: fit-content; max-width: 88%; margin: 0 0 8px; padding: 8px 11px; text-align: left; white-space: pre-wrap; word-break: break-word; line-height: 1.4; font-size: 14px; border-radius: 12px; -webkit-user-select: text; user-select: text; }
    .ai-msg.me { margin-left: auto; background: rgba(59, 130, 246, 0.35); }
    .ai-msg.bot { margin-right: auto; background: rgba(255, 255, 255, 0.09); }
    .ai-msg.err { margin-right: auto; color: #ff9b9b; background: rgba(255, 90, 90, 0.15); }
    .ai-dots span { display: inline-block; width: 7px; height: 7px; margin: 0 2px; background: white; border-radius: 50%; opacity: 0.4; animation: ai-dot 1s infinite; }
    .ai-dots span:nth-child(2) { animation-delay: 0.15s; } .ai-dots span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes ai-dot { 0%, 100% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
    #ai-panel .ai-chips { display: flex; gap: 6px; flex-wrap: wrap; padding: 4px 0; }
    #ai-panel .ai-chip { padding: 6px 10px; font-family: inherit; font-size: 12px; color: white; cursor: pointer; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 14px; }
    #ai-panel .ai-send { display: flex; gap: 6px; padding-top: 8px; }
    #ai-input { flex: 1; min-width: 0; padding: 10px; font-size: 16px; font-family: inherit; color: white; outline: none; background: rgba(0, 0, 0, 0.6); border: 2px solid var(--ai, #22f5a0); border-radius: 10px; -webkit-user-select: text; user-select: text; }
    #ai-go { padding: 0 14px; font-family: inherit; font-size: 14px; font-weight: bold; color: #07060d; cursor: pointer; background: var(--ai, #22f5a0); border: 0; border-radius: 10px; }
    #ai-go:disabled { opacity: 0.5; }

    #ai-ctl { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; gap: 10px; padding: calc(12px + env(safe-area-inset-top)) 14px calc(12px + env(safe-area-inset-bottom)); overflow-y: auto; text-align: left; background: rgba(7, 6, 13, 0.99); }
    #ai-ctl h2 { margin: 0; font-size: 18px; color: #fbbf24; }
    #ai-ctl .ai-sub { margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.55); }
    #ai-ctl label { display: block; font-size: 14px; }
    #ai-ctl label b { float: right; font-weight: normal; color: #fbbf24; }
    #ai-ctl input[type=range] { width: 100%; margin: 6px 0 2px; accent-color: #fbbf24; }
    #ai-ctl select { width: 100%; padding: 9px; font-size: 15px; font-family: inherit; color: white; background: rgba(0, 0, 0, 0.6); border: 2px solid #fbbf24; border-radius: 10px; }
    #ai-ctl .ai-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; }
    #ai-ctl .ai-row input { width: 22px; height: 22px; accent-color: #fbbf24; }
    #ai-ctl .ai-fade { opacity: 0.4; pointer-events: none; }
    #ai-ctl .ai-btns { display: flex; gap: 8px; margin-top: 4px; }
    #ai-ctl .ai-btns button { flex: 1; padding: 11px; font-family: inherit; font-size: 15px; font-weight: bold; color: white; cursor: pointer; background: #16a34a; border: 0; border-radius: 10px; }
    #ai-ctl .ai-btns button.alt { background: rgba(255, 255, 255, 0.14); }
    #ai-ctl .ai-note { min-height: 1.3em; margin: 0; font-size: 13px; color: #22f5a0; }
  `
  document.head.appendChild(style)

  // ---------- tiny helpers ----------
  function make(tag, props = {}, ...kids) {
    const el = document.createElement(tag)
    Object.assign(el, props)
    kids.forEach(k => el.append(k))
    return el
  }

  const hexToRgb = hex => {
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const mix = (rgb, to, t) => rgb.map((v, i) => Math.round(v + (to[i] - v) * t))
  const css = rgb => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`

  // ---------- the moving orb ----------
  function drawOrb(canvas, t, energy) {
    const g = canvas.getContext('2d')
    const w = canvas.width
    const c = w / 2
    const base = w * 0.31
    const rgb = hexToRgb(color)
    g.clearRect(0, 0, w, w)

    g.beginPath()
    const steps = 72
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2
      const wob = Math.sin(a * 3 + t * 1.7) * 0.07 + Math.sin(a * 5 - t * 2.3) * 0.045 + Math.sin(a * 2 + t * 0.9) * 0.06
      const r = base * (1 + wob * (0.7 + energy * 1.6))
      const x = c + Math.cos(a) * r
      const y = c + Math.sin(a) * r
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.closePath()

    const gx = c + Math.cos(t * 0.8) * base * 0.38
    const gy = c + Math.sin(t * 1.1) * base * 0.38
    const fill = g.createRadialGradient(gx, gy, base * 0.08, c, c, base * 1.25)
    fill.addColorStop(0, css(mix(rgb, [255, 255, 255], 0.75)))
    fill.addColorStop(0.45, css(rgb))
    fill.addColorStop(1, css(mix(rgb, [0, 0, 0], 0.55)))
    g.shadowColor = color
    g.shadowBlur = w * (0.12 + energy * 0.12)
    g.fillStyle = fill
    g.fill()

    // a small bright dot orbiting the orb
    g.shadowBlur = 0
    const oa = t * (1.2 + energy * 2)
    g.beginPath()
    g.arc(c + Math.cos(oa) * base * 1.32, c + Math.sin(oa) * base * 1.32, w * 0.028, 0, Math.PI * 2)
    g.fillStyle = css(mix(rgb, [255, 255, 255], 0.5))
    g.fill()
  }

  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches
  let energy = 0
  function frame(ms) {
    requestAnimationFrame(frame)
    if (document.hidden) return
    const target = thinking ? 1 : 0
    energy += (target - energy) * 0.08
    const t = (ms / 1000) * (reduced ? 0.2 : 1)
    drawOrb(btnCanvas, t, energy)
    if (!panel.hidden) drawOrb(headCanvas, t, energy)
  }

  // ---------- page elements ----------
  const btnCanvas = make('canvas', { width: 152, height: 152 })
  const btn = make('button', { id: 'ai-btn', className: 'ui-fab', type: 'button', title: 'AI Coach' }, btnCanvas)
  btn.setAttribute('aria-label', 'Open the AI coach')

  const headCanvas = make('canvas', { width: 108, height: 108 })
  const titleBox = make('div', { className: 'ai-title', textContent: 'AI Coach' }, make('small', { textContent: 'Ask me about strategy' }))
  const closeBtn = make('button', { className: 'ai-x', type: 'button', textContent: '✕' })
  const head = make('div', { className: 'ai-head' }, headCanvas, titleBox, closeBtn)

  const colorRow = make('div', { className: 'ai-colors' })
  const swatches = COLORS.map(([name, hex]) => {
    const b = make('button', { className: 'ai-sw', type: 'button', title: name })
    b.style.background = hex
    b.style.color = hex
    b.addEventListener('click', () => setColor(hex))
    colorRow.append(b)
    return { b, hex }
  })
  const customInput = make('input', { type: 'color', value: color })
  customInput.addEventListener('input', () => setColor(customInput.value))
  colorRow.append(make('span', { className: 'ai-sw custom', title: 'Pick any color' }, customInput))

  const log = make('div', { id: 'ai-log' })
  const chips = make('div', { className: 'ai-chips' })
  ;['Give me strategy tips', 'How do I beat Insane?', 'Look at my last moves'].forEach(text => {
    const c = make('button', { className: 'ai-chip', type: 'button', textContent: text })
    c.addEventListener('click', () => send(text))
    chips.append(c)
  })
  const input = make('input', { id: 'ai-input', type: 'text', maxLength: 400, placeholder: 'Ask the coach...', autocomplete: 'off' })
  const goBtn = make('button', { id: 'ai-go', type: 'button', textContent: 'Send' })
  const sendRow = make('div', { className: 'ai-send' }, input, goBtn)
  const panel = make('div', { id: 'ai-panel' }, head, colorRow, log, chips, sendRow)
  panel.hidden = true

  document.body.append(btn, panel)

  function setColor(hex) {
    color = hex
    try { localStorage.setItem(COLOR_KEY, hex) } catch (error) {}
    panel.style.setProperty('--ai', hex)
    customInput.value = hex
    swatches.forEach(s => s.b.classList.toggle('on', s.hex.toLowerCase() === hex.toLowerCase()))
  }
  setColor(color)

  // ---------- chat ----------
  function addMsg(who, text) {
    const m = make('div', { className: 'ai-msg ' + who, textContent: text })
    log.append(m)
    while (log.children.length > 80) log.firstChild.remove()
    log.scrollTop = log.scrollHeight
    return m
  }

  function setBusy(on) {
    busy = on
    thinking = on
    goBtn.disabled = on
  }

  // "make it red", "turn the orb purple" ... handled here, no AI needed
  const colorWords = {
    green: '#22f5a0', blue: '#3b82f6', purple: '#a855f7', pink: '#ff4fa3', gold: '#fbbf24', yellow: '#fbbf24',
    orange: '#fb923c', red: '#ff5a5a', cyan: '#22d3ee', white: '#e5e7eb', teal: '#14b8a6', violet: '#8b5cf6'
  }
  function colorCommand(text) {
    const t = text.toLowerCase()
    if (!/(color|colour|orb|circle|turn|make|change|switch)/.test(t)) return null
    for (const [word, hex] of Object.entries(colorWords)) {
      if (new RegExp('\\b' + word + '\\b').test(t)) return { word, hex }
    }
    if (/random/.test(t)) {
      const all = Object.entries(colorWords)
      const [word, hex] = all[Math.floor(Math.random() * all.length)]
      return { word, hex }
    }
    return null
  }

  // what the coach is allowed to see about your games (nothing private)
  function gameContext() {
    const c = {}
    try { c.mode = typeof mode === 'string' ? mode : '' } catch (error) {}
    try { c.level = c.mode === 'computer' && typeof level === 'string' ? level : '' } catch (error) {}
    try {
      const sc = scores[c.mode]
      c.score = { wins: sc.wins, losses: sc.losses, ties: sc.ties }
    } catch (error) {}
    c.rounds = (window.rpsLog || []).filter(r => r.mode === c.mode).slice(-20).map(r => ({ you: r.you, opp: r.opp, result: r.result }))
    return c
  }

  async function call(path, body) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 30000)
    try {
      const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal
      })
      let data = {}
      try { data = await res.json() } catch (error) {}
      return { ok: res.ok, status: res.status, data }
    } catch (error) {
      return { ok: false, status: 0, data: { error: 'Could not reach the server. Try again.' } }
    } finally {
      clearTimeout(timer)
    }
  }

  async function send(raw) {
    const text = String(raw || '').trim()
    if (!text || busy) return
    input.value = ''
    chips.hidden = true

    // secret code? the server decides if it is right
    if (/^\d{6}$/.test(text)) {
      setBusy(true)
      const r = await call('/ai/panel-open', { code: text })
      setBusy(false)
      if (r.ok) {
        panelCode = text
        settings = r.data.settings
        openControl()
        return
      }
      if (r.status === 429) {
        addMsg('err', r.data.error || 'Too many tries.')
        return
      }
      // wrong code: just treat it as a normal message
    }

    addMsg('me', text)

    const cmd = colorCommand(text)
    if (cmd) {
      setColor(cmd.hex)
      addMsg('bot', `Done, the orb is ${cmd.word} now.`)
      return
    }

    history.push({ role: 'user', content: text })
    history = history.slice(-12)

    const dots = make('div', { className: 'ai-msg bot ai-dots' }, make('span'), make('span'), make('span'))
    log.append(dots)
    log.scrollTop = log.scrollHeight
    setBusy(true)
    const r = await call('/ai/chat', { token: session(), messages: history, context: gameContext() })
    setBusy(false)
    dots.remove()

    if (!r.ok) {
      history.pop()
      addMsg('err', r.status === 401 ? 'Your login expired. Log in again, then ask me.' : (r.data.error || 'The coach could not answer. Try again.'))
      return
    }
    const reply = String(r.data.reply || '').trim() || '...'
    history.push({ role: 'assistant', content: reply })
    history = history.slice(-12)
    addMsg('bot', reply)
  }

  // ---------- secret Voice Control panel ----------
  const ctl = make('div', { id: 'ai-ctl' })
  ctl.hidden = true
  panel.append(ctl)

  const wordFor = (v, list) => list.find(([max]) => v <= max)[1]
  const RUDE = [[0, 'Kind'], [39, 'Cheeky'], [69, 'Rude'], [100, 'Savage']]
  const SARC = [[0, 'None'], [39, 'A touch'], [69, 'Sarcastic'], [100, 'Dripping']]
  const SWEAR = [[33, 'Mild'], [66, 'Regular'], [100, 'Heavy']]
  const HUMAN = [[24, 'Formal assistant'], [59, 'Friendly'], [100, 'Like a real person']]

  function openControl() {
    ctl.textContent = ''
    const s = settings || {}

    function slider(label, key, words) {
      const val = make('b')
      const range = make('input', { type: 'range', min: 0, max: 100, step: 1, value: s[key] ?? 0 })
      const upd = () => { val.textContent = `${range.value} · ${wordFor(Number(range.value), words)}` }
      range.addEventListener('input', upd)
      upd()
      return { range, el: make('label', { textContent: label + ' ' }, val, range) }
    }

    const rude = slider('😠 Rudeness', 'rude', RUDE)
    const sarc = slider('😏 Sarcasm', 'sarcasm', SARC)
    const swearAmt = slider('🤬 How much profanity', 'swearAmount', SWEAR)
    const human = slider('🗣️ Talks like a person', 'human', HUMAN)

    const swearOn = make('input', { type: 'checkbox', checked: !!s.swear })
    const swearRow = make('label', { className: 'ai-row' }, make('span', { textContent: '🤬 Allow profanity' }), swearOn)
    const fade = () => swearAmt.el.classList.toggle('ai-fade', !swearOn.checked)
    swearOn.addEventListener('change', fade)
    fade()

    const lengthSel = make('select')
    ;[['short', 'Short (1-2 sentences)'], ['normal', 'Normal (2-4 sentences)'], ['long', 'Long (detailed)']].forEach(([v, t]) => {
      lengthSel.append(make('option', { value: v, textContent: t, selected: (s.length || 'normal') === v }))
    })

    const note = make('p', { className: 'ai-note' })
    const read = () => ({
      rude: Number(rude.range.value),
      sarcasm: Number(sarc.range.value),
      swear: swearOn.checked,
      swearAmount: Number(swearAmt.range.value),
      human: Number(human.range.value),
      length: lengthSel.value
    })

    const save = make('button', { type: 'button', textContent: 'Save' })
    save.addEventListener('click', async () => {
      note.textContent = 'Saving...'
      const r = await call('/ai/panel-save', { code: panelCode, settings: read() })
      if (r.ok) { settings = r.data.settings; note.textContent = 'Saved. Everyone now gets this voice.' }
      else note.textContent = r.data.error || 'Could not save.'
    })
    const reset = make('button', { className: 'alt', type: 'button', textContent: 'Defaults' })
    reset.addEventListener('click', () => {
      settings = { rude: 0, sarcasm: 0, swear: false, swearAmount: 30, human: 50, length: 'normal' }
      openControl()
    })
    const close = make('button', { className: 'alt', type: 'button', textContent: 'Close' })
    close.addEventListener('click', closeControl)

    ctl.append(
      make('h2', { textContent: '🎛️ Voice Control' }),
      make('p', { className: 'ai-sub', textContent: 'Staff only. These settings are saved on the server and change how the coach talks to every player.' }),
      rude.el, sarc.el, swearRow, swearAmt.el, human.el,
      make('label', { textContent: '📏 Reply length' }, lengthSel),
      note,
      make('div', { className: 'ai-btns' }, save, reset, close)
    )
    ctl.hidden = false
  }

  function closeControl() {
    ctl.hidden = true
    ctl.textContent = ''
    panelCode = null // forget the code as soon as the panel closes
  }

  // ---------- open / close ----------
  function openPanel() {
    panel.hidden = false
    if (!log.children.length) {
      addMsg('bot', 'Hey! I\'m your RPS coach. Ask me how to beat the computer, how to read an opponent, or what your last moves say about you. You can also tell me to change my color.')
    }
    input.focus()
  }

  btn.addEventListener('click', () => { panel.hidden ? openPanel() : (panel.hidden = true) })
  closeBtn.addEventListener('click', () => { panel.hidden = true; closeControl() })
  goBtn.addEventListener('click', () => send(input.value))
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(input.value) })

  requestAnimationFrame(frame)
})()
