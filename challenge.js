/* Challenge mode (v2). Self-contained: builds its own button and window, so it cannot break the main game.
   You must be logged in AND have a profile picture. Join with a Challenge ID + password from the staff.
   Win 3 rounds to clear a stage, clear all 4 stages to win the prize. */
(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev'
  const KEY = 'challengeToken'
  const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' }
  const LEVELS = ['Easy', 'Medium', 'Hard', 'Insane']

  let token = null
  let state = null
  let busy = false

  try { token = localStorage.getItem(KEY) } catch (error) {}
  const session = () => { try { return localStorage.getItem('token') } catch (error) { return null } }

  // ---------- styles ----------
  const style = document.createElement('style')
  style.textContent = `
    #ch-btn { top: auto; bottom: calc(14px + env(safe-area-inset-bottom)); left: 12px; border-color: #fbbf24; box-shadow: 0 0 14px rgba(251, 191, 36, 0.6); }
    #ch-layer { z-index: 60; }
    #ch-layer .ch-line { margin: 4px 0; font-size: 15px; }
    #ch-layer .ch-note { margin: 0 0 10px; font-size: 13px; color: rgba(255, 255, 255, 0.65); }
    #ch-layer .ch-who { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 0 0 8px; font-weight: bold; }
    #ch-layer .ch-pic { display: flex; align-items: center; justify-content: center; flex: none; width: 44px; height: 44px; overflow: hidden; font-weight: bold; background: rgba(168, 85, 247, 0.4); border: 2px solid #fbbf24; border-radius: 50%; }
    #ch-layer .ch-pic img { width: 100%; height: 100%; object-fit: cover; }
    #ch-layer .ch-track { display: flex; gap: 6px; margin: 8px 0; }
    #ch-layer .ch-step { flex: 1; padding: 6px 2px; font-size: 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.55); }
    #ch-layer .ch-step.done { background: rgba(34, 245, 160, 0.18); border-color: #22f5a0; color: #22f5a0; }
    #ch-layer .ch-step.now { background: rgba(251, 191, 36, 0.2); border-color: #fbbf24; color: #fbbf24; font-weight: bold; }
    #ch-layer .ch-pips { font-size: 22px; letter-spacing: 3px; margin: 6px 0; }
    #ch-layer .ch-moves { display: flex; gap: 10px; justify-content: center; margin: 14px 0; }
    #ch-layer .ch-move { font-size: 36px; padding: 10px 16px; cursor: pointer; background: rgba(0, 0, 0, 0.6); border: 2px solid var(--blue); border-radius: 14px; }
    #ch-layer .ch-move:disabled { opacity: 0.4; cursor: default; }
    #ch-layer .ch-move:active:not(:disabled) { transform: scale(0.94); }
    #ch-layer .ch-last { min-height: 3.2em; font-size: 15px; white-space: pre-line; }
    #ch-layer .ch-last.win { color: #22f5a0; }
    #ch-layer .ch-last.loss { color: #ff6b6b; }
    #ch-layer .ch-last.pop { animation: ch-pop 0.35s ease; }
    @keyframes ch-pop { 0% { transform: scale(0.85); opacity: 0.3; } 100% { transform: scale(1); opacity: 1; } }
    #ch-layer .ch-prize { margin: 12px 0; padding: 14px; font-size: 18px; font-weight: bold; word-break: break-word; color: #07060d; background: #fbbf24; border-radius: 12px; }
    #ch-layer .ch-time { font-size: 13px; color: rgba(255, 255, 255, 0.6); }
    #ch-layer .ch-trophy { font-size: 54px; margin: 0; }
  `
  document.head.appendChild(style)

  // ---------- page elements ----------
  function make(tag, props = {}, ...kids) {
    const el = document.createElement(tag)
    Object.assign(el, props)
    kids.forEach(k => el.append(k))
    return el
  }

  const btn = make('button', { id: 'ch-btn', className: 'ui-fab', type: 'button', textContent: '🎯 Challenge' })

  const idInput = make('input', { id: 'ch-id', type: 'text', placeholder: 'Challenge ID', maxLength: 12, autocomplete: 'off' })
  idInput.setAttribute('autocapitalize', 'characters')
  const pwInput = make('input', { id: 'ch-pw', type: 'password', placeholder: 'Password', maxLength: 60, autocomplete: 'off' })
  const goBtn = make('button', { className: 'big', type: 'button', textContent: 'Join challenge' })
  const joinNote = make('p', { className: 'ch-note', textContent: 'You need to be logged in and have a profile picture. Enter the challenge ID and password you were given. An ID only works once.' })
  const joinBox = make('div', {}, joinNote, idInput, pwInput, goBtn)

  const whoPic = make('span', { className: 'ch-pic' })
  const whoName = make('span')
  const who = make('p', { className: 'ch-who' }, whoPic, whoName)
  const track = make('div', { className: 'ch-track' })
  const pips = make('p', { className: 'ch-pips' })
  const timeLine = make('p', { className: 'ch-line ch-time' })
  const moves = make('div', { className: 'ch-moves' })
  const moveButtons = Object.keys(EMOJI).map(m => {
    const b = make('button', { className: 'ch-move', type: 'button', textContent: EMOJI[m] })
    b.setAttribute('aria-label', m)
    b.addEventListener('click', () => play(m))
    moves.append(b)
    return b
  })
  const lastLine = make('p', { className: 'ch-line ch-last' })
  const playBox = make('div', {}, who, track, pips, timeLine, moves, lastLine)

  const trophy = make('p', { className: 'ch-trophy' })
  const endMsg = make('p', { className: 'ch-line' })
  const prizeBox = make('div', { className: 'ch-prize' })
  const newBtn = make('button', { className: 'big alt', type: 'button', textContent: 'Join a different challenge' })
  const endBox = make('div', {}, trophy, endMsg, prizeBox, newBtn)

  const msg = make('p', { className: 'msg' })
  const closeBtn = make('button', { className: 'x', type: 'button', textContent: '✕' })
  const title = make('h2', { textContent: 'Challenge' })
  const card = make('div', { className: 'card' }, closeBtn, title, joinBox, playBox, endBox, msg)
  const layer = make('div', { id: 'ch-layer', className: 'ui-layer' }, card)
  layer.hidden = true

  document.body.append(btn, layer)

  // ---------- helpers ----------
  function showOnly(box) {
    joinBox.hidden = box !== joinBox
    playBox.hidden = box !== playBox
    endBox.hidden = box !== endBox
  }

  function saveToken(t) {
    token = t
    try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) } catch (error) {}
  }

  function timeText(ms) {
    if (ms <= 0) return 'Time is up'
    const m = Math.floor(ms / 60000)
    const h = Math.floor(m / 60)
    return `Time left: ${h ? h + 'h ' : ''}${m % 60}m`
  }

  async function call(path, body) {
    try {
      const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      let data = {}
      try { data = await res.json() } catch (error) {}
      return { ok: res.ok, status: res.status, data }
    } catch (error) {
      return { ok: false, status: 0, data: { error: 'Could not reach the server. Try again.' } }
    }
  }

  function setPic(name, at) {
    whoPic.textContent = (name || '?')[0].toUpperCase()
    if (!name) return
    const img = document.createElement('img')
    img.alt = ''
    img.onload = () => { whoPic.textContent = ''; whoPic.append(img) }
    img.src = `${API}/avatar/${encodeURIComponent(name)}?v=${at || 0}`
  }

  function ended(text) {
    saveToken(null)
    state = null
    title.textContent = 'Challenge over'
    trophy.textContent = ''
    endMsg.textContent = text
    prizeBox.hidden = true
    showOnly(endBox)
  }

  function render(s, note, noteClass) {
    state = s
    msg.textContent = ''

    if (s.status === 'won') {
      title.textContent = 'You won!'
      trophy.textContent = '🏆'
      endMsg.textContent = 'You beat every stage. Your prize:'
      prizeBox.textContent = s.prize || 'Congratulations, you completed the challenge!'
      prizeBox.hidden = false
      showOnly(endBox)
      return
    }

    if (s.status === 'lost') {
      title.textContent = 'Challenge failed'
      trophy.textContent = '💥'
      endMsg.textContent = `You lost ${s.lossLimit} rounds on stage ${s.stage}. Better luck next time!`
      prizeBox.hidden = true
      showOnly(endBox)
      return
    }

    if (s.expired) {
      title.textContent = 'Time is up'
      trophy.textContent = '⏰'
      endMsg.textContent = 'This challenge has expired.'
      prizeBox.hidden = true
      showOnly(endBox)
      return
    }

    title.textContent = 'Challenge'
    whoName.textContent = s.player || 'Player'
    setPic(s.player, s.avatarAt)

    track.textContent = ''
    for (let i = 0; i < s.totalStages; i++) {
      const cls = i + 1 < s.stage ? 'done' : i + 1 === s.stage ? 'now' : ''
      track.append(make('span', { className: 'ch-step ' + cls, textContent: (i + 1 < s.stage ? '✓ ' : '') + (LEVELS[i] || 'Stage ' + (i + 1)) }))
    }

    pips.textContent = '🟢'.repeat(s.roundsWon) + '⚪'.repeat(s.winsNeeded - s.roundsWon)
      + '   ' + '🔴'.repeat(s.roundsLost) + '⚫'.repeat(s.lossLimit - s.roundsLost)
    updateTime()

    if (note !== undefined) {
      lastLine.textContent = note
      lastLine.className = 'ch-line ch-last ' + (noteClass || '')
      void lastLine.offsetWidth
      lastLine.classList.add('pop')
    }
    moveButtons.forEach(b => { b.disabled = false })
    showOnly(playBox)
  }

  function updateTime() {
    if (state && state.status === 'active' && !layer.hidden) {
      timeLine.textContent = timeText(state.expiresAt - Date.now())
    }
  }
  setInterval(updateTime, 1000)

  function lastText(s) {
    const l = s.last
    if (!l) return ''
    const line = `You ${EMOJI[l.yourMove]}  vs  Computer ${EMOJI[l.computerMove]}`
    const word = l.result === 'win' ? 'You win this round!' : l.result === 'loss' ? 'You lose this round.' : 'Tie. Go again.'
    const extra = l.outcome === 'stage' ? '\nStage cleared! On to the next one.' : ''
    return `${line}\n${word}${extra}`
  }

  // ---------- actions ----------
  async function open() {
    layer.hidden = false
    msg.textContent = ''
    lastLine.textContent = ''
    title.textContent = 'Challenge'

    if (!token) {
      showOnly(joinBox)
      if (!session()) msg.textContent = 'Log in to your account first (close this window and log in).'
      return
    }

    msg.textContent = 'Loading...'
    const r = await call('/challenge/state', { token })
    if (r.ok) {
      render(r.data.state)
    } else if (r.status === 404) {
      saveToken(null)
      showOnly(joinBox)
      msg.textContent = 'That challenge was ended. Join a new one.'
    } else {
      showOnly(joinBox)
      msg.textContent = r.data.error || 'Could not load the challenge.'
    }
  }

  async function join() {
    if (busy) return
    const id = idInput.value.trim()
    if (!id || !pwInput.value) {
      msg.textContent = 'Enter the challenge ID and the password.'
      return
    }
    if (!session()) {
      msg.textContent = 'Log in to your account first (close this window and log in).'
      return
    }
    busy = true
    msg.textContent = 'Please wait...'
    const r = await call('/challenge/join', { id, password: pwInput.value, session: session() })
    busy = false
    if (!r.ok) {
      msg.textContent = r.data.error || 'Could not join.'
      return
    }
    pwInput.value = ''
    idInput.value = ''
    saveToken(r.data.token)
    render(r.data.state, 'Win 3 rounds to clear each stage. Pick your move!')
  }

  async function play(move) {
    if (busy || !token) return
    busy = true
    moveButtons.forEach(b => { b.disabled = true })
    const r = await call('/challenge/play', { token, move })
    busy = false

    if (r.status === 410) return ended('This challenge has expired.')
    if (r.status === 404) return ended('This challenge was ended by the server.')
    if (!r.ok) {
      moveButtons.forEach(b => { b.disabled = false })
      lastLine.className = 'ch-line ch-last loss'
      lastLine.textContent = r.data.error || 'Something went wrong. Try again.'
      return
    }
    const l = r.data.state.last
    render(r.data.state, lastText(r.data.state), l ? l.result : '')
  }

  btn.addEventListener('click', open)
  closeBtn.addEventListener('click', () => { layer.hidden = true })
  goBtn.addEventListener('click', join)
  pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') join() })
  idInput.addEventListener('keydown', e => { if (e.key === 'Enter') pwInput.focus() })
  newBtn.addEventListener('click', () => {
    saveToken(null)
    state = null
    title.textContent = 'Challenge'
    msg.textContent = ''
    showOnly(joinBox)
  })

  showOnly(joinBox)
})()
