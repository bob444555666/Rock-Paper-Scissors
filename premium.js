/* Premium (v2). Premium is won in a tournament that has Premium as the prize, or given by the staff.
   Perks:
     ⭐ gold star next to your name on the leaderboard (switch on/off in your profile)
     🎨 colour themes for the whole game
     👁️ Peek: in "Play Computer" you can see what the computer will play before you choose.
         (Peeked rounds are practice and do not count on the computer leaderboard.)
     🔎 Scout: in tournaments you see how your opponent has played so far (done in tournament.js)
   Self-contained: it cannot break the main game. */
(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev'
  const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' }
  const THEMES = {
    neon:   { name: 'Neon',   vars: null },
    gold:   { name: 'Gold',   vars: { '--green': '#fbbf24', '--blue': '#f59e0b', '--purple': '#fcd34d' } },
    ocean:  { name: 'Ocean',  vars: { '--green': '#38bdf8', '--blue': '#2563eb', '--purple': '#22d3ee' } },
    sunset: { name: 'Sunset', vars: { '--green': '#fb923c', '--blue': '#f43f5e', '--purple': '#ec4899' } },
    forest: { name: 'Forest', vars: { '--green': '#4ade80', '--blue': '#16a34a', '--purple': '#a3e635' } },
    ice:    { name: 'Ice',    vars: { '--green': '#e0f2fe', '--blue': '#7dd3fc', '--purple': '#a5b4fc' } }
  }
  const VARS = ['--green', '--blue', '--purple']

  let status = null // null until the server answered
  let lastToken = null

  const session = () => { try { return localStorage.getItem('token') } catch (error) { return null } }
  const read = k => { try { return localStorage.getItem(k) } catch (error) { return null } }
  const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch (error) {} }

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

  // ---------- themes ----------
  function applyTheme(id) {
    const root = document.documentElement.style
    const t = THEMES[id]
    VARS.forEach(v => root.removeProperty(v))
    if (t && t.vars) Object.entries(t.vars).forEach(([k, v]) => root.setProperty(k, v))
  }

  function currentTheme() {
    const id = read('premiumTheme')
    return THEMES[id] ? id : 'neon'
  }

  // ---------- profile section ----------
  const layer = document.querySelector('#profile-layer')
  const anchor = document.querySelector('#pf-logout')
  let info, badgeBtn, note, themeRow

  if (layer && anchor) {
    const head = make('h3', { textContent: 'Premium' })
    info = make('p', { className: 'auth-sub' })
    badgeBtn = make('button', { className: 'big', type: 'button', textContent: '⭐ Premium' })
    themeRow = make('div', { className: 'tabs' })
    note = make('p', { className: 'msg' })
    ;[head, info, badgeBtn, themeRow, note].forEach(n => anchor.parentNode.insertBefore(n, anchor))

    badgeBtn.addEventListener('click', async () => {
      if (!status || !status.premium) return
      badgeBtn.disabled = true
      const r = await call('/account/premium-badge', { on: !status.badge })
      if (r.ok) status.badge = r.data.badge
      showProfile()
      note.textContent = r.ok ? '' : (r.data.error || 'Could not change that.')
    })

    new MutationObserver(() => { if (!layer.hidden) refresh() }).observe(layer, { attributes: true, attributeFilter: ['hidden'] })
  }

  function showProfile() {
    if (!info) return
    note.textContent = ''
    themeRow.textContent = ''
    if (!status) { info.textContent = session() ? 'Loading...' : 'Log in to see your Premium status.'; badgeBtn.disabled = true; return }

    if (!status.premium) {
      info.textContent = '🔒 Locked. Win a tournament that has Premium as the prize to unlock themes, Peek, Scout and the ⭐ badge.'
      badgeBtn.disabled = true
      badgeBtn.textContent = '⭐ Premium (locked)'
      return
    }

    info.textContent = `⭐ You have Premium (${status.source === 'tournament' ? 'won in a tournament' : 'given by the staff'}). Perks: themes, 👁️ Peek in Play Computer, 🔎 Scout in tournaments.`
    badgeBtn.disabled = false
    badgeBtn.textContent = status.badge ? '⭐ Leaderboard badge: ON (tap to hide)' : '⭐ Leaderboard badge: OFF (tap to show)'
    Object.entries(THEMES).forEach(([id, t]) => {
      const b = make('button', { className: 'tab' + (currentTheme() === id ? ' on' : ''), type: 'button', textContent: '🎨 ' + t.name })
      b.addEventListener('click', () => { write('premiumTheme', id); applyTheme(id); showProfile() })
      themeRow.append(b)
    })
  }

  // ---------- Peek ----------
  const style = document.createElement('style')
  style.textContent = `
    #peek-btn { top: auto; bottom: calc(14px + env(safe-area-inset-bottom)); left: 50%; right: auto; transform: translateX(-50%); border-color: #a855f7; box-shadow: 0 0 14px rgba(168, 85, 247, 0.7); }
    #peek-toast { position: fixed; z-index: 55; left: 50%; bottom: calc(62px + env(safe-area-inset-bottom)); transform: translateX(-50%); max-width: 90vw; padding: 10px 16px; font-size: 16px; font-weight: bold; text-align: center; color: white; background: rgba(0, 0, 0, 0.85); border: 2px solid #a855f7; border-radius: 14px; box-shadow: 0 0 16px rgba(168, 85, 247, 0.7); }
  `
  document.head.appendChild(style)

  const peekBtn = make('button', { id: 'peek-btn', className: 'ui-fab', type: 'button', textContent: '👁️ Peek' })
  const toast = make('div', { id: 'peek-toast' })
  peekBtn.hidden = true
  toast.hidden = true
  document.body.append(peekBtn, toast)

  let toastTimer = null
  function say(text, ms) {
    toast.textContent = text
    toast.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toast.hidden = true }, ms || 10000)
  }

  peekBtn.addEventListener('click', async () => {
    const level = read('level') || 'easy'
    peekBtn.disabled = true
    const r = await call('/account/peek', { level })
    peekBtn.disabled = false
    if (!r.ok) { say(r.data.error || 'Peek is not available right now.', 4000); return }
    say(`👁️ The computer will play ${EMOJI[r.data.move] || r.data.move}. Now pick your move! (practice round, not on the leaderboard)`, 15000)
  })

  // hide the hint once you actually play
  document.addEventListener('click', e => {
    const t = e.target
    if (t && t.closest && t.closest('.move-button')) toast.hidden = true
  })

  function inComputerMode() {
    const b = document.querySelector('#mode-computer')
    return !!(b && b.classList.contains('active'))
  }

  function updatePeek() {
    const show = !!(status && status.premium && session() && inComputerMode())
    peekBtn.hidden = !show
    if (!show) toast.hidden = true
  }

  // ---------- status ----------
  async function refresh() {
    lastToken = session()
    if (!lastToken) {
      status = null
      applyTheme('neon')
      showProfile()
      updatePeek()
      return
    }
    const r = await call('/account/premium', {})
    status = r.ok ? r.data : null
    if (r.status === 401) status = null
    applyTheme(status && status.premium ? currentTheme() : 'neon')
    showProfile()
    updatePeek()
  }

  refresh()
  setInterval(() => { if (session() !== lastToken) refresh(); else updatePeek() }, 1500) // log in/out, mode switches
  setInterval(refresh, 5 * 60 * 1000) // premium given or removed
})()
