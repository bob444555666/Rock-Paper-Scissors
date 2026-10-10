/* AI Coach (v8). Human-sounding voices: pick a girl or boy voice (made on the server), with the device voice as backup.
   v7 notes: Talking now also works in the iPhone home-screen app (records the mic, the server turns it into text).
   v6 notes: Players can now pick their own voice, speed and pitch (the Voice button).
   v5 notes: Voice now works on iPhone/iPad Safari too (see the iOS notes in the voice section).
   v4 notes:  Now with live voice: tap the mic to talk, or use Live talk for a hands-free back-and-forth.
   (Uses the browser's built-in speech recognition and speech synthesis. No extra server needed.)
   v3 notes:  Talks to the real AI on the server (/ai/chat), so the Voice Control settings really apply.
   Two tabs: Coach (strategy, everyone) and Chat (talk about anything, Premium only; the server checks this).
   Older note:  Replaces the old player-to-player chat.
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
  let aiMode = 'coach'     // 'coach' or 'chat'
  const histories = { coach: [], chat: [] } // what we send to the AI: [{ role, content }]
  let isPremium = false
  let premiumChecked = false
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
    #ai-panel .ai-tabs { display: flex; gap: 6px; padding-bottom: 6px; }
    #ai-panel .ai-tab { flex: 1; padding: 8px 4px; font-family: inherit; font-size: 13px; font-weight: bold; color: rgba(255, 255, 255, 0.7); cursor: pointer; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 10px; }
    #ai-panel .ai-tab.on { color: #07060d; background: var(--ai, #22f5a0); border-color: var(--ai, #22f5a0); }
    #ai-panel .ai-lock { margin: 4px 0; padding: 10px 12px; font-size: 13px; line-height: 1.4; color: #fbbf24; background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.5); border-radius: 10px; }
    .ai-log { flex: 1; overflow-y: auto; padding: 6px 2px; }
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
    #ai-panel, #ai-panel button, #ai-btn { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    @supports (height: 100dvh) { #ai-panel { height: 100dvh; bottom: auto; } }
    #ai-panel .ai-hint { flex: 1 1 100%; margin: 2px 0 0; font-size: 12px; line-height: 1.35; color: #fbbf24; }
    #ai-panel .ai-voice { flex-wrap: wrap; display: flex; gap: 6px; padding: 4px 0 0; }
    #ai-panel .ai-vbtn { flex: 1; min-height: 40px; padding: 6px 4px; font-family: inherit; font-size: 12px; font-weight: bold; color: white; cursor: pointer; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 12px; }
    #ai-panel .ai-vbtn.on { color: #07060d; background: var(--ai, #22f5a0); border-color: var(--ai, #22f5a0); }
    #ai-panel .ai-vbtn:disabled, #ai-mic:disabled { opacity: 0.4; cursor: default; }
    #ai-mic { width: 48px; min-height: 44px; padding: 0; font-size: 18px; color: white; cursor: pointer; background: rgba(255, 255, 255, 0.1); border: 2px solid var(--ai, #22f5a0); border-radius: 10px; }
    #ai-mic.on { background: #ff5a5a; border-color: #ff5a5a; animation: ai-pulse 1s infinite; }
    @keyframes ai-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255, 90, 90, 0.6); } 50% { box-shadow: 0 0 0 8px rgba(255, 90, 90, 0); } }

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
    const target = thinking || speaking ? 1 : listening ? 0.55 : 0
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

  const logs = { coach: make('div', { className: 'ai-log' }), chat: make('div', { className: 'ai-log' }) }
  logs.chat.hidden = true
  let log = logs.coach
  const lock = make('div', { className: 'ai-lock' })
  lock.hidden = true
  const chips = make('div', { className: 'ai-chips' })
  ;['Give me strategy tips', 'How do I beat Insane?', 'Look at my last moves'].forEach(text => {
    const c = make('button', { className: 'ai-chip', type: 'button', textContent: text })
    c.addEventListener('click', () => send(text))
    chips.append(c)
  })
  const tabCoach = make('button', { className: 'ai-tab on', type: 'button', textContent: '🎯 Coach' })
  const tabChat = make('button', { className: 'ai-tab', type: 'button', textContent: '💬 Chat ⭐' })
  const tabs = make('div', { className: 'ai-tabs' }, tabCoach, tabChat)
  const input = make('input', { id: 'ai-input', type: 'text', maxLength: 400, placeholder: 'Ask the coach...', autocomplete: 'off' })
  const goBtn = make('button', { id: 'ai-go', type: 'button', textContent: 'Send' })
  const micBtn = make('button', { id: 'ai-mic', type: 'button', textContent: '🎙️', title: 'Tap to talk' })
  const liveBtn = make('button', { className: 'ai-vbtn', type: 'button', textContent: '🎧 Live talk' })
  const speakBtn = make('button', { className: 'ai-vbtn', type: 'button', textContent: '🔇 Voice off' })
  const voiceRow = make('div', { className: 'ai-voice' }, liveBtn, speakBtn)
  const sendRow = make('div', { className: 'ai-send' }, micBtn, input, goBtn)
  const panel = make('div', { id: 'ai-panel' }, head, tabs, colorRow, logs.coach, logs.chat, lock, chips, voiceRow, sendRow)
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
    goBtn.disabled = on || (aiMode === 'chat' && !isPremium)
  }

  // "make it red", "turn the orb purple" ... handled here, no AI needed
  const colorWords = {
    green: '#22f5a0', blue: '#3b82f6', purple: '#a855f7', pink: '#ff4fa3', gold: '#fbbf24', yellow: '#fbbf24',
    orange: '#fb923c', red: '#ff5a5a', cyan: '#22d3ee', white: '#e5e7eb', teal: '#14b8a6', violet: '#8b5cf6'
  }
  function colorCommand(text) {
    const t = text.toLowerCase()
    if (!/\b(color|colour|orb|circle)\b/.test(t)) return null
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

  // ---------- Coach / Chat tabs ----------
  const INTRO = {
    coach: "Hey! I'm Coach. Ask me how to beat the computer, how to read an opponent, or what your last moves say about you. You can also tell me to change my orb color.",
    chat: "Premium chat is on. Talk to me about anything, game or not. What's up?"
  }

  function updateLock() {
    const locked = aiMode === 'chat' && !isPremium
    lock.hidden = !locked
    input.disabled = locked
    goBtn.disabled = locked || busy
    micBtn.disabled = locked
    liveBtn.disabled = locked
    if (locked) stopVoice()
    if (locked) {
      lock.textContent = session()
        ? '⭐ Chat mode is for Premium members. Coach mode is free for everyone. Premium is won in Premium tournaments.'
        : '⭐ Chat mode is for Premium members. Log in with a Premium account to chat about anything. Coach mode is free.'
    }
    const showChips = aiMode === 'coach' && !log.querySelector('.ai-msg.me')
    chips.hidden = !showChips
  }

  async function refreshPremium() {
    const token = session()
    if (!token) { isPremium = false; premiumChecked = true; return }
    const r = await call('/account/premium', { token })
    isPremium = !!(r.ok && r.data && r.data.premium)
    premiumChecked = true
  }

  async function setMode(m) {
    stopVoice()
    aiMode = m
    tabCoach.classList.toggle('on', m === 'coach')
    tabChat.classList.toggle('on', m === 'chat')
    logs.coach.hidden = m !== 'coach'
    logs.chat.hidden = m !== 'chat'
    log = logs[m]
    titleBox.firstChild.textContent = m === 'chat' ? 'AI Chat' : 'AI Coach'
    titleBox.querySelector('small').textContent = m === 'chat' ? 'Talk about anything' : 'Ask me about strategy'
    voiceUi()
    if (m === 'chat') await refreshPremium()
    if (m === 'chat' && isPremium && !log.children.length) addMsg('bot', INTRO.chat)
    if (m === 'coach' && !log.children.length) addMsg('bot', INTRO.coach)
    updateLock()
    log.scrollTop = log.scrollHeight
    if (!input.disabled) input.focus()
  }
  tabCoach.addEventListener('click', () => setMode('coach'))
  tabChat.addEventListener('click', () => setMode('chat'))

  // after the coach answers (or does a color change): speak it if needed, then listen again in Live mode
  function afterReply(text, willSpeak) {
    if (willSpeak && canSpeak) speak(text, () => { if (live) startListening() })
    else if (live) startListening()
  }

  async function send(raw, opts = {}) {
    const text = String(raw || '').trim()
    if (!text || busy) return
    const mode = aiMode
    if (mode === 'chat' && !isPremium) { updateLock(); return }
    unlockSpeech()
    const spoken = !!opts.voice
    const willSpeak = canSpeak && (speakOn || live || spoken)
    stopSpeaking()
    input.value = ''

    // secret code? the server decides if it is right (never accepted by voice)
    if (!spoken && /^\d{6}$/.test(text)) {
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
    updateLock()

    const cmd = colorCommand(text)
    if (cmd) {
      setColor(cmd.hex)
      const done = `Done, the orb is ${cmd.word} now.`
      addMsg('bot', done)
      afterReply(done, willSpeak)
      return
    }

    const hist = histories[mode]
    hist.push({ role: 'user', content: text })
    while (hist.length > 12) hist.shift()

    const dots = make('div', { className: 'ai-msg bot ai-dots' }, make('span'), make('span'), make('span'))
    log.append(dots)
    log.scrollTop = log.scrollHeight
    setBusy(true)
    const r = await call('/ai/chat', { token: session(), mode, voice: willSpeak, messages: hist, context: gameContext() })
    setBusy(false)
    dots.remove()

    if (!r.ok || !r.data.reply) {
      hist.pop() // the failed question is not part of the conversation
      live = false // do not loop on errors
      voiceUi()
      if (r.data && r.data.premiumRequired) { isPremium = false; updateLock() }
      addMsg('err', (r.data && r.data.error) || 'Something went wrong. Try again.')
      return
    }
    hist.push({ role: 'assistant', content: r.data.reply })
    while (hist.length > 12) hist.shift()
    addMsg('bot', r.data.reply)
    afterReply(r.data.reply, willSpeak)
  }

  // ---------- live voice (the browser's own speech recognition + speech synthesis) ----------
  // iOS notes: Safari on iPhone/iPad supports listening (needs iOS 14.5+ with Siri & Dictation switched on),
  // but the home-screen (standalone) app does not, so there we only offer spoken replies.
  const iosStandalone = navigator.standalone === true
  const SR = iosStandalone ? null : (window.SpeechRecognition || window.webkitSpeechRecognition)
  const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
  const SPEAK_KEY = 'aiSpeak'
  const VOICE_KEY = 'aiVoicePrefs'
  const vp = { name: '', rate: 1.05, pitch: 1, human: true, gender: 'girl', speaker: 'asteria' } // the player's own voice choices (saved on their device)
  // Human-sounding voices made on the server (Cloudflare Workers AI, Deepgram Aura). The device voice is the backup.
  const HUMAN_VOICES = {
    girl: [['asteria', 'Asteria · clear, confident'], ['luna', 'Luna · friendly, natural'], ['athena', 'Athena · British, calm'], ['hera', 'Hera · warm, smooth']],
    boy: [['orion', 'Orion · calm, polite'], ['arcas', 'Arcas · natural, smooth'], ['perseus', 'Perseus · confident'], ['angus', 'Angus · Irish, warm'], ['orpheus', 'Orpheus · clear, confident'], ['helios', 'Helios · British, polite'], ['zeus', 'Zeus · deep, trustworthy']]
  }
  const SILENT = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
  let player = null
  try { player = new Audio() } catch (error) {}
  let speakAbort = null
  try { Object.assign(vp, JSON.parse(localStorage.getItem(VOICE_KEY) || '{}')) } catch (error) {}
  if (!HUMAN_VOICES[vp.gender]) vp.gender = 'girl'
  if (!HUMAN_VOICES[vp.gender].some(v => v[0] === vp.speaker)) vp.speaker = HUMAN_VOICES[vp.gender][0][0]
  let speakOn = false
  try { speakOn = localStorage.getItem(SPEAK_KEY) === '1' } catch (error) {}
  let live = false       // hands-free conversation: listen, answer out loud, listen again
  let listening = false
  let speaking = false
  let rec = null
  let speakId = 0
  let idleTries = 0
  // Some browsers (the iPhone home-screen app) have no built-in speech recognition. There we record the
  // microphone ourselves and the server turns the recording into text.
  const useRec = !SR && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)
  let recorder = null
  let recStream = null
  let recTimer = null
  let audioCtx = null
  let analyser = null
  let transcribing = false
  let recRun = 0

  micBtn.hidden = !SR && !useRec
  liveBtn.hidden = !SR && !useRec
  speakBtn.hidden = !canSpeak
  if (iosStandalone && canSpeak && !useRec) {
    voiceRow.append(make('p', { className: 'ai-hint', textContent: '🎙️ Listening does not work in the home-screen app on iPhone. Open the site in Safari to talk to me. I can still read my answers out loud here.' }))
  } else if (!SR && !useRec && !canSpeak) {
    voiceRow.hidden = true
  }

  // iOS only lets speech start from a tap. Speaking one silent word on the first tap unlocks it for later replies.
  let speechUnlocked = false
  function unlockSpeech() {
    if (speechUnlocked || (!canSpeak && !player)) return
    speechUnlocked = true
    try { if (player) { player.src = SILENT; const pr = player.play(); if (pr && pr.then) pr.then(() => player.pause()).catch(() => {}) } } catch (error) {}
    try {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      speechSynthesis.speak(u)
    } catch (error) {}
  }

  function voiceUi() {
    micBtn.classList.toggle('on', listening)
    micBtn.textContent = listening ? '⏹' : '🎙️'
    liveBtn.classList.toggle('on', live)
    liveBtn.textContent = live ? '🎧 Live: on' : '🎧 Live talk'
    speakBtn.classList.toggle('on', speakOn)
    speakBtn.textContent = speakOn ? '🔊 Voice on' : '🔇 Voice off'
    input.placeholder = listening ? 'Listening...' : transcribing ? 'Working out what you said...' : aiMode === 'chat' ? 'Say anything...' : 'Ask the coach...'
  }

  const NOVELTY = /bahh|bells|boing|bubbles|cellos|deranged|good news|bad news|hysterical|organ|trinoids|whisper|zarvox|albert|jester|superstar|wobble|fred|junior|kathy|ralph|grandma|grandpa|rocko|shelley|flo|eddy|sandy|reed/i
  function pickVoice() {
    let voices = []
    try { voices = speechSynthesis.getVoices() || [] } catch (error) {}
    if (vp.name) { const chosen = voices.find(v => v.name === vp.name); if (chosen) return chosen }
    voices = voices.filter(v => !NOVELTY.test(v.name))
    if (!voices.length) return null
    const lang = (navigator.language || 'en-US').toLowerCase()
    const same = voices.filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(lang.slice(0, 2)))
    const pool = same.length ? same : voices
    const nice = pool.find(v => /enhanced|premium|natural|siri|google|samantha|ava|allison|daniel|karen|moira|aria|jenny/i.test(v.name))
    return nice || pool.find(v => v.lang && v.lang.replace('_', '-').toLowerCase() === lang) || pool[0]
  }

  function stopSpeaking() {
    speakId++
    speaking = false
    if (speakAbort) { try { speakAbort.abort() } catch (error) {} speakAbort = null }
    if (player) { player.onended = null; player.onerror = null; try { player.pause() } catch (error) {} }
    try { if (canSpeak) speechSynthesis.cancel() } catch (error) {}
  }

  function speak(text, done) {
    if (!vp.human || !player || typeof fetch !== 'function') { speakBrowser(text, done); return }
    stopSpeaking()
    let t = String(text || '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim()
    if (!t) { if (done) done(); return }
    if (t.length > 600) {
      const cut = t.slice(0, 600)
      const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
      t = i > 200 ? cut.slice(0, i + 1) : cut
    }
    const myId = speakId
    speaking = true
    voiceUi()
    const finish = () => {
      if (myId !== speakId) return
      speaking = false
      voiceUi()
      if (done) done()
    }
    const backup = () => { // the human voice did not work: use this device's voice instead
      if (myId !== speakId) return
      speaking = false
      if (canSpeak) speakBrowser(text, done)
      else finish()
    }
    setTimeout(() => { if (myId === speakId && speaking) finish() }, 20000 + t.length * 120)
    const ctl = new AbortController()
    speakAbort = ctl
    fetch(API + '/ai/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session(), text: t, speaker: vp.speaker }),
      signal: ctl.signal
    })
      .then(res => { if (!res.ok) throw new Error('tts ' + res.status); return res.blob() })
      .then(blob => {
        if (myId !== speakId) return
        if (!blob || !blob.size) throw new Error('empty audio')
        const url = URL.createObjectURL(blob)
        const clear = () => { try { URL.revokeObjectURL(url) } catch (error) {} }
        player.onended = () => { clear(); finish() }
        player.onerror = () => { clear(); backup() }
        player.src = url
        player.playbackRate = Math.min(1.5, Math.max(0.7, vp.rate / 1.05))
        return player.play()
      })
      .catch(err => { if (err && err.name === 'AbortError') return; backup() })
  }

  function speakBrowser(text, done) {
    if (!canSpeak) { if (done) done(); return }
    stopSpeaking()
    const clean = String(text || '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim()
    if (!clean) { if (done) done(); return }
    const parts = clean.match(/[^.!?]+[.!?]*\s*/g) || [clean] // short pieces keep Chrome from cutting long speech off
    const myId = speakId
    const voice = pickVoice()
    let left = parts.length
    speaking = true
    voiceUi()
    const finish = () => {
      if (myId !== speakId) return // interrupted or replaced
      speaking = false
      voiceUi()
      if (done) done()
    }
    setTimeout(() => { if (myId === speakId && speaking) finish() }, 2500 + clean.length * 95) // iOS sometimes never reports the end
    parts.forEach(p => {
      const u = new SpeechSynthesisUtterance(p)
      if (voice) { u.voice = voice; u.lang = voice.lang } else u.lang = navigator.language || 'en-US'
      u.rate = vp.rate
      u.pitch = vp.pitch
      u.onend = u.onerror = () => { if (--left <= 0) finish() }
      speechSynthesis.speak(u)
    })
  }

  // ----- listening by recording (iPhone home-screen app and other browsers without built-in recognition) -----
  const blobToBase64 = blob => new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = reject
    r.readAsDataURL(blob)
  })

  function releaseMic() {
    if (recTimer) { clearInterval(recTimer); recTimer = null }
    if (recStream) { try { recStream.getTracks().forEach(t => t.stop()) } catch (error) {} recStream = null }
    if (audioCtx) { try { audioCtx.close() } catch (error) {} audioCtx = null }
    analyser = null
  }

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') { try { recorder.stop() } catch (error) {} }
  }

  function finishHeard(text) {
    voiceUi()
    if (text) { idleTries = 0; send(text, { voice: true }); return }
    if (!live) return
    if (++idleTries >= 3) {
      live = false
      releaseMic()
      voiceUi()
      addMsg('bot', 'I did not hear anything, so I stopped listening. Tap Live talk to start again.')
    } else {
      setTimeout(() => { if (live) startListening() }, 300)
    }
  }

  async function startRecording() {
    if (aiMode === 'chat' && !isPremium) { live = false; voiceUi(); updateLock(); return }
    if (listening || busy || transcribing) return
    stopSpeaking()
    listening = true
    voiceUi()
    const myRun = ++recRun

    try {
      if (!recStream || !recStream.active) {
        recStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        const AC = window.AudioContext || window.webkitAudioContext
        if (AC) {
          try {
            audioCtx = new AC()
            analyser = audioCtx.createAnalyser()
            analyser.fftSize = 1024
            audioCtx.createMediaStreamSource(recStream).connect(analyser)
          } catch (error) { analyser = null }
        }
      }
      if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume()
    } catch (error) {
      listening = false
      live = false
      releaseMic()
      voiceUi()
      addMsg('err', 'The microphone is blocked. Allow it for this site (iPhone: Settings > Safari > Microphone, or tap the "aA" icon in the address bar > Website Settings), then try again.')
      return
    }
    if (myRun !== recRun) { listening = false; releaseMic(); voiceUi(); return } // stopped while the permission box was open

    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(t => {
      try { return MediaRecorder.isTypeSupported(t) } catch (error) { return false }
    }) || ''
    const chunks = []
    let mr
    try { mr = type ? new MediaRecorder(recStream, { mimeType: type }) : new MediaRecorder(recStream) }
    catch (error) {
      listening = false
      live = false
      releaseMic()
      voiceUi()
      addMsg('err', 'This device cannot record audio here.')
      return
    }
    recorder = mr

    let heard = !analyser // with no level meter we cannot tell, so just trust the tap
    let quiet = 0
    let ticks = 0
    const buf = analyser ? new Uint8Array(analyser.fftSize) : null
    const level = () => {
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
      return Math.sqrt(sum / buf.length)
    }

    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) }
    mr.onstop = async () => {
      if (recTimer) { clearInterval(recTimer); recTimer = null }
      recorder = null
      listening = false
      if (myRun !== recRun) return // cancelled
      const blob = new Blob(chunks, { type: mr.mimeType || type || 'audio/mp4' })
      if (!heard || blob.size < 1500) { if (!live) releaseMic(); finishHeard(''); return }
      transcribing = true
      voiceUi()
      let text = ''
      try {
        const audio = await blobToBase64(blob)
        const r = await call('/ai/transcribe', { token: session(), audio, mime: blob.type, lang: (navigator.language || 'en').slice(0, 2).toLowerCase() })
        if (r.ok) text = String((r.data && r.data.text) || '').trim()
        else { live = false; addMsg('err', (r.data && r.data.error) || 'I could not hear that. Try again.') }
      } catch (error) {
        live = false
        addMsg('err', 'I could not hear that. Try again.')
      }
      transcribing = false
      if (myRun !== recRun) return
      if (!live) releaseMic()
      finishHeard(text)
    }

    // stop by itself: a moment of quiet after you spoke, nothing heard for 7 seconds, or 25 seconds in total
    recTimer = setInterval(() => {
      ticks++
      if (analyser) {
        if (level() > 0.02) { heard = true; quiet = 0 } else if (heard) quiet++
      }
      if ((analyser && heard && quiet >= 14) || (analyser && !heard && ticks >= 70) || ticks >= 250) stopRecording()
    }, 100)

    try { mr.start() } catch (error) { listening = false; recorder = null; live = false; releaseMic(); voiceUi() }
  }

  function startListening() {
    if (!SR && !useRec) return
    if (!SR) { startRecording(); return }
    if (aiMode === 'chat' && !isPremium) { live = false; voiceUi(); updateLock(); return }
    if (listening || busy) return
    stopSpeaking()
    let finalText = ''
    let interim = ''
    try { rec = new SR() } catch (error) { rec = null; live = false; voiceUi(); return }
    rec.lang = navigator.language || 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    rec.onstart = () => { listening = true; voiceUi() }
    rec.onresult = e => {
      interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t
        else interim += t
      }
      input.value = (finalText + ' ' + interim).trim() // shows what you are saying as you say it
    }
    rec.onerror = e => {
      if (e.error === 'service-not-allowed') {
        live = false
        addMsg('err', 'Speech recognition is switched off. On iPhone: Settings > General > Keyboard > turn on Enable Dictation (and Siri). Then try again.')
      } else if (e.error === 'not-allowed') {
        live = false
        addMsg('err', 'The microphone is blocked. Allow it for this site (iPhone: Settings > Safari > Microphone, or tap the "aA" icon in the address bar > Website Settings), then try again.')
      } else if (e.error === 'audio-capture') {
        live = false
        addMsg('err', 'I could not find a microphone.')
      } else if (e.error === 'network') {
        live = false
        addMsg('err', 'Voice recognition needs an internet connection.')
      }
    }
    rec.onend = () => {
      listening = false
      rec = null
      const text = (finalText + ' ' + interim).trim()
      input.value = ''
      voiceUi()
      if (text) { idleTries = 0; send(text, { voice: true }); return }
      if (!live) return
      if (++idleTries >= 3) {
        live = false
        voiceUi()
        addMsg('bot', 'I did not hear anything, so I stopped listening. Tap Live talk to start again.')
      } else {
        setTimeout(() => { if (live) startListening() }, 300)
      }
    }
    try { rec.start() } catch (error) { listening = false; rec = null; voiceUi() }
  }

  function stopVoice() {
    live = false
    recRun++
    if (recorder) { recorder.onstop = null; try { recorder.stop() } catch (error) {} recorder = null }
    transcribing = false
    releaseMic()
    if (rec) { rec.onend = null; try { rec.abort() } catch (error) {} rec = null }
    listening = false
    stopSpeaking()
    if (typeof input !== 'undefined') input.value = ''
    voiceUi()
  }

  micBtn.addEventListener('click', () => {
    unlockSpeech()
    if (listening) { if (recorder) stopRecording(); else { try { rec.stop() } catch (error) {} } return } // stop and send what was heard
    live = false
    idleTries = 0
    startListening()
  })
  liveBtn.addEventListener('click', () => {
    unlockSpeech()
    if (live) { stopVoice(); return }
    live = true
    idleTries = 0
    voiceUi()
    startListening()
  })
  speakBtn.addEventListener('click', () => {
    unlockSpeech()
    speakOn = !speakOn
    try { localStorage.setItem(SPEAK_KEY, speakOn ? '1' : '0') } catch (error) {}
    if (!speakOn) stopSpeaking()
    voiceUi()
  })
  if (canSpeak) { try { speechSynthesis.getVoices(); speechSynthesis.addEventListener('voiceschanged', () => speechSynthesis.getVoices()) } catch (error) {} } // some browsers load voices lazily

  // ---------- voice settings the player can edit: which voice, how fast, how high ----------
  if (canSpeak) {
    const vstyle = document.createElement('style')
    vstyle.textContent = `
      #ai-panel .ai-vset { display: block; flex: 1 1 100%; padding: 8px 0 2px; font-size: 13px; }
      #ai-panel .ai-vset[hidden] { display: none; }
      #ai-panel .ai-vset label { display: block; margin: 6px 0; }
      #ai-panel .ai-vset label.ai-vrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      #ai-panel .ai-vset select, #ai-panel .ai-vset input[type=range] { display: block; width: 100%; margin-top: 4px; }
      #ai-panel .ai-vset select { padding: 8px; color: #fff; background: rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 8px; }
    `
    document.head.appendChild(vstyle)

    const vsBtn = make('button', { className: 'ai-vbtn', type: 'button', textContent: '⚙️ Voice' })
    const voiceSel = make('select')
    const rateVal = make('b')
    const pitchVal = make('b')
    const rateIn = make('input', { type: 'range', min: 0.7, max: 1.5, step: 0.05 })
    const pitchIn = make('input', { type: 'range', min: 0.6, max: 1.6, step: 0.05 })
    const testBtn = make('button', { className: 'ai-vbtn', type: 'button', textContent: '▶ Test voice' })
    const resetBtn = make('button', { className: 'ai-vbtn', type: 'button', textContent: 'Reset' })
    const humanOn = make('input', { type: 'checkbox', checked: vp.human !== false })
    const humanRow = make('label', { className: 'ai-vrow' }, make('span', { textContent: '🧑 Human voice (AI)' }), humanOn)
    const genderSel = make('select')
    ;[['girl', '👩 Girl'], ['boy', '👨 Boy']].forEach(([v, t]) => genderSel.append(make('option', { value: v, textContent: t })))
    const speakerSel = make('select')
    const box = make('div', { className: 'ai-vset' },
      humanRow,
      make('label', { textContent: 'Girl or boy' }, genderSel),
      make('label', { textContent: 'Which voice' }, speakerSel),
      make('label', { textContent: '⏩ Speed ' }, rateVal, rateIn),
      make('label', { textContent: '🗣️ Backup voice (this device, used if the human voice is unavailable)' }, voiceSel),
      make('label', { textContent: '🎚️ Backup pitch ' }, pitchVal, pitchIn),
      testBtn, resetBtn
    )
    box.hidden = true

    const savePrefs = () => { try { localStorage.setItem(VOICE_KEY, JSON.stringify(vp)) } catch (error) {} }
    function fillSpeakers() {
      speakerSel.textContent = ''
      HUMAN_VOICES[vp.gender].forEach(([v, t]) => speakerSel.append(make('option', { value: v, textContent: t, selected: v === vp.speaker })))
    }
    const syncSliders = () => {
      humanOn.checked = vp.human !== false
      genderSel.value = vp.gender
      fillSpeakers()
      speakerSel.disabled = genderSel.disabled = !humanOn.checked
      rateIn.value = vp.rate
      pitchIn.value = vp.pitch
      rateVal.textContent = Number(vp.rate).toFixed(2) + 'x'
      pitchVal.textContent = Number(vp.pitch).toFixed(2)
    }
    function fillVoices() {
      let list = []
      try { list = speechSynthesis.getVoices() || [] } catch (error) {}
      const lang = (navigator.language || 'en').slice(0, 2).toLowerCase()
      const mine = list.filter(v => !NOVELTY.test(v.name) && (v.lang || '').toLowerCase().startsWith(lang))
      voiceSel.textContent = ''
      voiceSel.append(make('option', { value: '', textContent: 'Automatic (best available)' }))
      ;(mine.length ? mine : list).forEach(v => {
        voiceSel.append(make('option', { value: v.name, textContent: v.name, selected: v.name === vp.name }))
      })
    }

    voiceSel.addEventListener('change', () => { vp.name = voiceSel.value; savePrefs() })
    humanOn.addEventListener('change', () => { vp.human = humanOn.checked; speakerSel.disabled = genderSel.disabled = !vp.human; savePrefs() })
    genderSel.addEventListener('change', () => { vp.gender = genderSel.value; vp.speaker = HUMAN_VOICES[vp.gender][0][0]; fillSpeakers(); savePrefs() })
    speakerSel.addEventListener('change', () => { vp.speaker = speakerSel.value; savePrefs() })
    rateIn.addEventListener('input', () => { vp.rate = Number(rateIn.value); syncSliders(); savePrefs() })
    pitchIn.addEventListener('input', () => { vp.pitch = Number(pitchIn.value); syncSliders(); savePrefs() })
    testBtn.addEventListener('click', () => { unlockSpeech(); speak('Hey, this is how I sound. Rock beats scissors, every time.') })
    resetBtn.addEventListener('click', () => { vp.name = ''; vp.rate = 1.05; vp.pitch = 1; vp.human = true; vp.gender = 'girl'; vp.speaker = 'asteria'; savePrefs(); fillVoices(); syncSliders() })
    vsBtn.addEventListener('click', () => {
      box.hidden = !box.hidden
      if (!box.hidden) { fillVoices(); syncSliders() }
    })
    try { speechSynthesis.addEventListener('voiceschanged', () => { if (!box.hidden) fillVoices() }) } catch (error) {}
    voiceRow.append(vsBtn, box)
  }
  voiceUi()

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
      if (r.ok) { settings = r.data.settings; note.textContent = 'Saved. Everyone gets this voice from their next message.' }
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
      make('p', { className: 'ai-sub', textContent: 'Staff only. Saved on the server. They change how the AI talks to every player, in both Coach and Chat.' }),
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
    if (!logs.coach.children.length) addMsg('bot', INTRO.coach)
    updateLock()
    if (!premiumChecked) refreshPremium().then(updateLock)
    if (!input.disabled) input.focus()
  }

  btn.addEventListener('click', () => { if (panel.hidden) openPanel(); else { panel.hidden = true; stopVoice() } })
  closeBtn.addEventListener('click', () => { panel.hidden = true; closeControl(); stopVoice() })
  goBtn.addEventListener('click', () => send(input.value))
  window.addEventListener('storage', e => { if (e.key === 'token') { premiumChecked = false; isPremium = false; updateLock() } })
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(input.value) })

  requestAnimationFrame(frame)
})()
