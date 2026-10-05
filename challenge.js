/* Challenge mode. Self-contained: builds its own button and window, so it cannot break the main game.
   Join with a Challenge ID + password made in the server admin panel.
   Win 3 rounds to clear a stage, clear all stages to win the prize. */
(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev'
  const KEY = 'challengeToken'
  const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' }

  let token = null
  let state = null
  let busy = false

  try { token = localStorage.getItem(KEY) } catch (error) {}

  // ---------- styles ----------
  const style = document.createElement('style')
  style.textContent = `
    #ch-btn { top: auto; bottom: calc(14px + env(safe-area-inset-bottom)); left: 12px; border-color: #fbbf24; box-shadow: 0 0 14px rgba(251, 191, 36, 0.6); }
    #ch-layer { z-index: 60; }
    #ch-layer .ch-line { margin: 4px 0; font-size: 15px; }
    #ch-layer .ch-stage { font-size: 18px; font-weight: bold; color: #fbbf24; }
    #ch-layer .ch-pips { font-size: 22px; letter-spacing: 4px; margin: 6px 0; }
    #ch-layer .ch-moves { display: flex; gap: 10px; justify-content: center; margin: 14px 0; }
    #ch-layer .ch-move { font-size: 36px; padding: 10px 16px; cursor: pointer; background: rgba(0, 0, 0, 0.6); border: 2px solid var(--blue); border-radius: 14px; }
    #ch-layer .ch-move:disabled { opacity: 0.4; cursor: default; }
    #ch-layer .ch-move:active:not(:disabled) { transform: scale(0.94); }
    #ch-layer .ch-last { min-height: 2.6em; font-size: 15px; }
    #ch-layer .ch-prize { margin: 12px 0; padding: 14px; font-size: 18px; font-weight: bold; word-break: break-word; color: #07060d; background: #fbbf24; border-radius: 12px; }
    #ch-layer .ch-time { font-size: 13px; color: rgba(255, 255, 255, 0.6); }
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
  const joinBox = make('div', {}, idInput, pwInput, goBtn)

  const who = make('p', { className: 'ch-line' })
  const stageLine = make('p', { className: 'ch-line ch-stage' })
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
  const playBox = make('div', {}, who, stageLine, pips, timeLine, moves, lastLine)

  const endMsg = make('p', { className: 'ch-line' })
  const prizeBox = make('div', { className: 'ch-prize' })
  const newBtn = make('button', { className: 'big alt', type: 'button', textContent: 'Join a different challenge' })
  const endBox = make('div', {}, endMsg, prizeBox, newBtn)

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

  function ended(text) {
    saveToken(null)
    state = null
    title.textContent = 'Challenge over'
    endMsg.textContent = text
    prizeBox.hidden = true
    showOnly(endBox)
  }

  function render(s, note) {
    state = s
    msg.textContent = ''

    if (s.status === 'won') {
      title.textContent = '🏆 You won!'
      endMsg.textContent = 'You beat every stage. Your prize:'
      prizeBox.textContent = s.prize || 'Congratulations, you completed the challenge!'
      prizeBox.hidden = false
      showOnly(endBox)
      return
    }

    if (s.status === 'lost') {
      title.textContent = 'Challenge failed'
      endMsg.textContent = `You lost ${s.lossLimit} rounds on stage ${s.stage}. Better luck next time!`
      prizeBox.hidden = true
      showOnly(endBox)
      return
    }

    if (s.expired) {
      title.textContent = 'Time is up'
      endMsg.textContent = 'This challenge has expired.'
      prizeBox.hidden = true
      showOnly(endBox)
      return
    }

    title.textContent = 'Challenge'
    who.textContent = `Player: ${s.username}`
    stageLine.textContent = `Stage ${s.stage} of ${s.totalStages} · ${s.level[0].toUpperCase() + s.level.slice(1)}`
    pips.textContent = '🟢'.repeat(s.roundsWon) + '⚪'.repeat(s.winsNeeded - s.roundsWon)
      + '   ' + '🔴'.repeat(s.roundsLost) + '⚫'.repeat(s.lossLimit - s.roundsLost)
    updateTime()
    if (note !== undefined) lastLine.textContent = note
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

    if (!token) {
      title.textContent = 'Challenge'
      showOnly(joinBox)
      return
    }

    title.textContent = 'Challenge'
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
    busy = true
    msg.textContent = 'Please wait...'
    const r = await call('/challenge/join', { id, password: pwInput.value })
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
      lastLine.textContent = r.data.error || 'Something went wrong. Try again.'
      return
    }
    render(r.data.state, lastText(r.data.state))
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

  lastLine.style.whiteSpace = 'pre-line'
  showOnly(joinBox)
})()
