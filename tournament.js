/* Tournament mode. Self-contained: builds its own button and window, so it cannot break the main game.
   Up to 16 real players in a room, 1 vs 1 knockout matches, first to 3 round wins moves on.
   You must be logged in with a profile picture, and join with the tournament ID + password the staff gave you. */
(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev'
  const KEY = 'tournamentToken'
  const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' }

  let token = null
  let view = null
  let busy = false
  let pollTimer = null

  try { token = localStorage.getItem(KEY) } catch (error) {}
  const session = () => { try { return localStorage.getItem('token') } catch (error) { return null } }

  // ---------- styles ----------
  const style = document.createElement('style')
  style.textContent = `
    #to-btn { top: auto; bottom: calc(110px + env(safe-area-inset-bottom)); left: 12px; border-color: #22f5a0; box-shadow: 0 0 14px rgba(34, 245, 160, 0.6); }
    #to-layer { z-index: 60; align-items: flex-start; }
    #to-layer .card { margin-top: 8px; max-height: 92vh; }
    #to-layer .to-line { margin: 4px 0; font-size: 15px; }
    #to-layer .to-note { margin: 0 0 10px; font-size: 13px; color: rgba(255, 255, 255, 0.65); }
    #to-layer .to-round { font-size: 18px; font-weight: bold; color: #22f5a0; margin: 2px 0 8px; }
    #to-layer .to-vs { display: flex; align-items: center; justify-content: space-around; gap: 6px; margin: 8px 0; }
    #to-layer .to-side { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; flex: 1; font-weight: bold; font-size: 14px; overflow-wrap: anywhere; }
    #to-layer .to-score { font-size: 30px; font-weight: 800; white-space: nowrap; }
    #to-layer .to-pic { display: flex; align-items: center; justify-content: center; flex: none; width: 44px; height: 44px; overflow: hidden; font-weight: bold; background: rgba(168, 85, 247, 0.4); border: 2px solid #22f5a0; border-radius: 50%; }
    #to-layer .to-pic.sm { width: 26px; height: 26px; font-size: 12px; border-width: 1px; }
    #to-layer .to-pic img { width: 100%; height: 100%; object-fit: cover; }
    #to-layer .to-moves { display: flex; gap: 10px; justify-content: center; margin: 12px 0; }
    #to-layer .to-move { font-size: 36px; padding: 10px 16px; cursor: pointer; background: rgba(0, 0, 0, 0.6); border: 2px solid var(--blue); border-radius: 14px; }
    #to-layer .to-move:disabled { opacity: 0.35; cursor: default; }
    #to-layer .to-move:active:not(:disabled) { transform: scale(0.94); }
    #to-layer .to-last { min-height: 2.8em; font-size: 15px; white-space: pre-line; }
    #to-layer .to-last.win { color: #22f5a0; }
    #to-layer .to-last.loss { color: #ff6b6b; }
    #to-layer .to-timer { font-size: 14px; color: #fbbf24; min-height: 1.3em; }
    #to-layer .to-list { margin: 6px 0; text-align: left; }
    #to-layer .to-p { display: flex; align-items: center; gap: 8px; margin: 4px 0; font-size: 14px; }
    #to-layer .to-p.out { opacity: 0.45; text-decoration: line-through; }
    #to-layer .to-br { margin: 8px 0; text-align: left; font-size: 13px; }
    #to-layer .to-br b { display: block; margin: 8px 0 2px; color: #22f5a0; }
    #to-layer .to-br div { padding: 2px 0; color: rgba(255, 255, 255, 0.8); }
    #to-layer .to-br .live { color: #fbbf24; }
    #to-layer .to-br .me { font-weight: bold; color: white; }
    #to-layer .to-prize { margin: 12px 0; padding: 14px; font-size: 18px; font-weight: bold; word-break: break-word; color: #07060d; background: #fbbf24; border-radius: 12px; }
    #to-layer .to-trophy { font-size: 54px; margin: 0; }
  `
  document.head.appendChild(style)

  // ---------- page elements ----------
  function make(tag, props = {}, ...kids) {
    const el = document.createElement(tag)
    Object.assign(el, props)
    kids.forEach(k => el.append(k))
    return el
  }

  const btn = make('button', { id: 'to-btn', className: 'ui-fab', type: 'button', textContent: '🏟️ Tournament' })

  const idInput = make('input', { type: 'text', placeholder: 'Tournament ID', maxLength: 12, autocomplete: 'off' })
  idInput.setAttribute('autocapitalize', 'characters')
  const pwInput = make('input', { type: 'password', placeholder: 'Password', maxLength: 60, autocomplete: 'off' })
  const goBtn = make('button', { className: 'big', type: 'button', textContent: 'Join tournament' })
  const joinBox = make('div', {},
    make('p', { className: 'to-note', textContent: 'You need to be logged in and have a profile picture. Enter the tournament ID and password you were given. The ID only works for your own account.' }),
    idInput, pwInput, goBtn)

  const body = make('div')
  const msg = make('p', { className: 'msg' })
  const closeBtn = make('button', { className: 'x', type: 'button', textContent: '✕' })
  const title = make('h2', { textContent: 'Tournament' })
  const card = make('div', { className: 'card' }, closeBtn, title, joinBox, body, msg)
  const layer = make('div', { id: 'to-layer', className: 'ui-layer' }, card)
  layer.hidden = true
  document.body.append(btn, layer)

  // ---------- helpers ----------
  function saveToken(t) {
    token = t
    try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) } catch (error) {}
  }

  async function call(path, data) {
    try {
      const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      let json = {}
      try { json = await res.json() } catch (error) {}
      return { ok: res.ok, status: res.status, data: json }
    } catch (error) {
      return { ok: false, status: 0, data: { error: 'Could not reach the server. Try again.' } }
    }
  }

  function pic(name, at, small) {
    const box = make('span', { className: 'to-pic' + (small ? ' sm' : ''), textContent: (name || '?')[0].toUpperCase() })
    if (name) {
      const img = document.createElement('img')
      img.alt = ''
      img.onload = () => { box.textContent = ''; box.append(img) }
      img.src = `${API}/avatar/${encodeURIComponent(name)}?v=${at || 0}`
    }
    return box
  }

  function side(name, at) {
    return make('span', { className: 'to-side' }, pic(name, at), make('span', { textContent: name || 'Waiting...' }))
  }

  function showJoin(note) {
    stopPoll()
    view = null
    title.textContent = 'Tournament'
    joinBox.hidden = false
    body.textContent = ''
    msg.textContent = note || ''
  }

  function bracket(v) {
    const box = make('div', { className: 'to-br' })
    v.rounds.forEach(r => {
      box.append(make('b', { textContent: r.name }))
      r.matches.forEach(m => {
        const text = `${m.a || '...'} vs ${m.b || '...'}` + (m.winner ? `  →  ${m.winner}` : m.live ? `  (${m.wins[0]}-${m.wins[1]})` : '')
        const mine = m.a === v.you.name || m.b === v.you.name
        box.append(make('div', { className: (m.live ? 'live ' : '') + (mine ? 'me' : ''), textContent: text }))
      })
    })
    return box
  }

  function playerList(v) {
    const box = make('div', { className: 'to-list' })
    v.players.forEach(p => {
      box.append(make('div', { className: 'to-p' + (p.alive ? '' : ' out') }, pic(p.name, p.avatarAt, true),
        make('span', { textContent: p.name + (p.joined ? '' : ' (not here yet)') })))
    })
    return box
  }

  // Premium only: how your opponent has played so far in this tournament (never their current hidden pick)
  function scoutBox(m) {
    const sc = m.scout
    const box = make('div', { className: 'to-note' })
    if (!sc.total) {
      box.textContent = `🔎 Scout: ${m.opp} has not played a round yet.`
      return box
    }
    const parts = ['rock', 'paper', 'scissors'].map(k => `${EMOJI[k]} ${Math.round((sc.counts[k] / sc.total) * 100)}%`).join('   ')
    const top = ['rock', 'paper', 'scissors'].sort((a, b) => sc.counts[b] - sc.counts[a])[0]
    box.textContent = `🔎 Scout: ${m.opp} played ${parts} (${sc.total} rounds). Favourite: ${EMOJI[top]}. Recent: ${sc.recent.map(x => EMOJI[x]).join(' ')}`
    return box
  }

  // Premium option "Tournament scout stats" (on unless the player switched it off)
  function scoutWanted() {
    try {
      const c = JSON.parse(localStorage.getItem('premiumPrefsCache') || 'null')
      return !(c && c.prefs && c.prefs.scout === false)
    } catch (error) { return true }
  }

  function timerText(m) {
    if (!m.deadline) return ''
    const s = Math.max(0, Math.ceil((m.deadline - Date.now()) / 1000))
    return m.youMoved ? `Your opponent has ${s}s to move` : `Move now! ${s}s left`
  }

  // ---------- rendering ----------
  const moveButtons = Object.keys(EMOJI).map(m => {
    const b = make('button', { className: 'to-move', type: 'button', textContent: EMOJI[m] })
    b.setAttribute('aria-label', m)
    b.addEventListener('click', () => play(m))
    return b
  })
  const timerLine = make('p', { className: 'to-timer' })
  let lastShown = 0

  function render(v) {
    view = v
    joinBox.hidden = true
    msg.textContent = ''
    body.textContent = ''
    title.textContent = v.name

    if (v.status === 'finished') {
      stopPoll()
      if (v.won) {
        body.append(make('p', { className: 'to-trophy', textContent: '🏆' }), make('p', { className: 'to-round', textContent: 'You won the tournament!' }))
        body.append(make('div', { className: 'to-prize', textContent: v.prizeType === 'premium' ? '⭐ Premium unlocked! Check your profile.' : (v.prize || 'Congratulations!') }))
      } else {
        body.append(make('p', { className: 'to-trophy', textContent: '🏁' }), make('p', { className: 'to-round', textContent: 'Tournament finished' }))
        if (v.champion) body.append(make('div', { className: 'to-vs' }, side(v.champion.name, v.champion.avatarAt)), make('p', { className: 'to-line', textContent: 'is the champion!' }))
        if (v.out) body.append(make('p', { className: 'to-note', textContent: `You went out in the ${v.out.round}.` }))
      }
      body.append(bracket(v), newBtn())
      return
    }

    if (v.expired) {
      stopPoll()
      body.append(make('p', { className: 'to-trophy', textContent: '⏰' }), make('p', { className: 'to-line', textContent: 'This tournament has expired.' }), newBtn())
      return
    }

    if (v.status === 'setup') {
      body.append(
        make('p', { className: 'to-round', textContent: 'Waiting for the host to start...' }),
        make('p', { className: 'to-line', textContent: `Prize: ${v.prize || '—'}` }),
        make('p', { className: 'to-note', textContent: `${v.players.filter(p => p.joined).length} of ${v.players.length} players are here. The tournament starts when the host presses start.` }),
        playerList(v))
      schedule(3000)
      return
    }

    // running
    if (!v.you.alive) {
      body.append(
        make('p', { className: 'to-trophy', textContent: '💥' }),
        make('p', { className: 'to-round', textContent: 'You are out' }),
        make('p', { className: 'to-line', textContent: v.out && v.out.opp ? `You lost to ${v.out.opp} (${v.out.wins[0]}-${v.out.wins[1]}) in the ${v.out.round}.` : 'You were removed from the tournament.' }),
        make('p', { className: 'to-note', textContent: 'You can keep watching the bracket.' }),
        bracket(v), newBtn())
      schedule(5000)
      return
    }

    const m = v.match
    if (!m || !m.playing) {
      body.append(
        make('p', { className: 'to-round', textContent: m ? m.round : 'Next round' }),
        make('p', { className: 'to-line', textContent: m && m.opp ? `You will face ${m.opp}.` : '✓ You moved on! Waiting for your next opponent...' }),
        bracket(v))
      schedule(2500)
      return
    }

    // a live match
    body.append(
      make('p', { className: 'to-round', textContent: `${m.round} · first to ${v.winsNeeded}` }),
      make('div', { className: 'to-vs' },
        side(v.you.name, (v.players.find(p => p.name === v.you.name) || {}).avatarAt || 0),
        make('span', { className: 'to-score', textContent: `${m.wins[0]} - ${m.wins[1]}` }),
        side(m.opp, m.oppAvatarAt)),
      timerLine)
    timerLine.textContent = timerText(m)
    const movesBox = make('div', { className: 'to-moves' })
    moveButtons.forEach(b => { b.disabled = m.youMoved; movesBox.append(b) })
    body.append(movesBox)

    let text = m.youMoved ? 'Move sent. Waiting for your opponent...' : 'Pick your move!'
    let cls = ''
    if (m.last) {
      const word = m.last.result === 'win' ? 'You won the last round!' : m.last.result === 'loss' ? 'You lost the last round.' : 'Last round was a tie.'
      text = `Last round: You ${EMOJI[m.last.you] || ''}  vs  ${m.opp} ${EMOJI[m.last.opp] || ''}\n${word}` + (m.youMoved ? '\nMove sent. Waiting for your opponent...' : '')
      cls = m.last.result
    }
    if (m.scout && scoutWanted()) body.append(scoutBox(m)) // Premium option
    body.append(make('p', { className: 'to-line to-last ' + cls, textContent: text }), bracket(v))
    schedule(1200)
  }

  function newBtn() {
    const b = make('button', { className: 'big alt', type: 'button', textContent: 'Join a different tournament' })
    b.addEventListener('click', () => { saveToken(null); showJoin() })
    return b
  }

  // ---------- polling ----------
  function stopPoll() { clearTimeout(pollTimer); pollTimer = null }

  function schedule(ms) {
    stopPoll()
    pollTimer = setTimeout(refresh, ms)
  }

  async function refresh() {
    if (layer.hidden || !token) return
    const r = await call('/tournament/state', { token })
    if (layer.hidden) return
    if (r.ok) return render(r.data.state)
    if (r.status === 404) { saveToken(null); return showJoin('That tournament was ended. Join a new one.') }
    msg.textContent = r.data.error || 'Connection problem. Retrying...'
    schedule(3000)
  }

  setInterval(() => { // keep the countdown moving between polls
    if (!layer.hidden && view && view.match && view.match.playing) timerLine.textContent = timerText(view.match)
  }, 500)

  // ---------- actions ----------
  async function open() {
    layer.hidden = false
    msg.textContent = ''
    if (!token) {
      showJoin(session() ? '' : 'Log in to your account first (close this window and log in).')
      return
    }
    joinBox.hidden = true
    title.textContent = 'Tournament'
    msg.textContent = 'Loading...'
    refresh()
  }

  async function join() {
    if (busy) return
    const id = idInput.value.trim()
    if (!id || !pwInput.value) { msg.textContent = 'Enter the tournament ID and the password.'; return }
    if (!session()) { msg.textContent = 'Log in to your account first (close this window and log in).'; return }
    busy = true
    msg.textContent = 'Please wait...'
    const r = await call('/tournament/join', { id, password: pwInput.value, session: session() })
    busy = false
    if (!r.ok) { msg.textContent = r.data.error || 'Could not join.'; return }
    pwInput.value = ''
    idInput.value = ''
    saveToken(r.data.token)
    render(r.data.state)
  }

  async function play(move) {
    if (busy || !token) return
    busy = true
    moveButtons.forEach(b => { b.disabled = true })
    const r = await call('/tournament/move', { token, move })
    busy = false
    if (r.status === 404) { saveToken(null); return showJoin('That tournament was ended.') }
    if (r.status === 410) return refresh()
    if (!r.ok) {
      msg.textContent = r.data.error || 'Something went wrong. Try again.'
      moveButtons.forEach(b => { b.disabled = false })
      return
    }
    render(r.data.state)
  }

  btn.addEventListener('click', open)
  closeBtn.addEventListener('click', () => { layer.hidden = true; stopPoll() })
  goBtn.addEventListener('click', join)
  pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') join() })
  idInput.addEventListener('keydown', e => { if (e.key === 'Enter') pwInput.focus() })
})()
