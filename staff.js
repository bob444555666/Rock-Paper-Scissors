/* Staff Control Panel. Self-contained and safe: the button only shows for accounts the owner gave access to.
   It talks to the server with the account's login, so nobody ever sees the admin key or a secret URL.
   Staff can: turn the server on/off, make/extend/delete challenges, and see who won. */
(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev'
  const LEVELS = ['Easy', 'Medium', 'Hard', 'Insane']

  let isStaff = false
  let lastToken = null
  let timer = null

  const session = () => { try { return localStorage.getItem('token') } catch (error) { return null } }

  // ---------- styles ----------
  const style = document.createElement('style')
  style.textContent = `
    #staff-btn { top: auto; bottom: calc(62px + env(safe-area-inset-bottom)); left: 12px; border-color: #a855f7; box-shadow: 0 0 14px rgba(168, 85, 247, 0.7); }
    #staff-layer { z-index: 70; align-items: flex-start; }
    #staff-layer .card { width: min(100%, 520px); max-height: 92vh; margin-top: 8px; text-align: left; }
    #staff-layer h2 { text-align: center; }
    #staff-layer .st-status { text-align: center; font-size: 20px; font-weight: bold; margin: 6px 0 10px; }
    #staff-layer .st-status.on { color: #22f5a0; }
    #staff-layer .st-status.off { color: #ff6b6b; }
    #staff-layer .st-two { display: flex; gap: 8px; }
    #staff-layer .st-two .big { flex: 1; margin: 4px 0; }
    #staff-layer .st-box { margin: 8px 0; padding: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; }
    #staff-layer .st-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    #staff-layer .st-grow { flex: 1 1 100%; min-width: 0; }
    #staff-layer .st-grow small { display: block; color: rgba(255, 255, 255, 0.6); word-break: break-word; }
    #staff-layer select { padding: 8px; font-size: 15px; color: white; background: #191919; border: 1px solid #555; border-radius: 8px; }
    #staff-layer .st-mini { padding: 8px 12px; font-size: 14px; font-weight: bold; font-family: inherit; color: white; cursor: pointer; border: 0; border-radius: 8px; background: #2563eb; }
    #staff-layer .st-mini.red { background: #dc2626; }
    #staff-layer .st-mini.green { background: #16a34a; }
    #staff-layer .st-id { margin: 10px 0 0; padding: 12px; text-align: center; background: #14532d; border-radius: 12px; }
    #staff-layer .st-id b { display: block; font-size: 30px; letter-spacing: 4px; margin: 4px 0; }
    #staff-layer .st-pic { display: flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; overflow: hidden; font-size: 13px; font-weight: bold; background: rgba(168, 85, 247, 0.4); border-radius: 50%; }
    #staff-layer .st-pic img { width: 100%; height: 100%; object-fit: cover; }
    #staff-layer .st-win { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
    #staff-layer label { font-size: 14px; }
  `
  document.head.appendChild(style)

  // ---------- helpers ----------
  function make(tag, props = {}, ...kids) {
    const el = document.createElement(tag)
    Object.assign(el, props)
    kids.forEach(k => el.append(k))
    return el
  }

  async function api(action, body = {}) {
    try {
      const res = await fetch(`${API}/staff/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, token: session() })
      })
      let data = {}
      try { data = await res.json() } catch (error) {}
      return { ok: res.ok, status: res.status, data }
    } catch (error) {
      return { ok: false, status: 0, data: { error: 'Could not reach the server.' } }
    }
  }

  function fmtId(id) { return id.slice(0, 4) + '-' + id.slice(4) }

  function left(ms) {
    if (ms <= 0) return 'EXPIRED'
    const m = Math.floor(ms / 60000)
    return `${Math.floor(m / 60)}h ${m % 60}m left`
  }

  function statusText(c) {
    if (c.status === 'open') return 'Waiting for a player (ID not used yet)'
    if (c.status === 'active') return `${c.playerName || 'Someone'} is playing: stage ${c.stage + 1}/4 (${LEVELS[c.stage] || ''}), ${c.roundsWon}/3 wins`
    if (c.status === 'won') return 'WON 🏆 by ' + (c.playerName || '?')
    return (c.playerName || 'Player') + ' lost'
  }

  function pic(name, at) {
    const box = make('span', { className: 'st-pic', textContent: (name || '?')[0].toUpperCase() })
    if (name) {
      const img = document.createElement('img')
      img.alt = ''
      img.onload = () => { box.textContent = ''; box.append(img) }
      img.src = `${API}/avatar/${encodeURIComponent(name)}?v=${at || 0}`
    }
    return box
  }

  function hourSelect() {
    const sel = make('select')
    for (let h = 1; h <= 20; h++) sel.append(make('option', { value: String(h), textContent: h + 'h' }))
    return sel
  }

  // ---------- window ----------
  const btn = make('button', { id: 'staff-btn', className: 'ui-fab', type: 'button', textContent: '🛠️ Control Panel' })
  btn.hidden = true

  const content = make('div')
  const msg = make('p', { className: 'msg' })
  const closeBtn = make('button', { className: 'x', type: 'button', textContent: '✕' })
  const card = make('div', { className: 'card' }, closeBtn, make('h2', { textContent: 'Control Panel' }), content, msg)
  const layer = make('div', { id: 'staff-layer', className: 'ui-layer' }, card)
  layer.hidden = true

  document.body.append(btn, layer)

  let newId = ''
  let formKeep = { username: '', password: '', prize: '', hours: '1' }

  function render(data) {
    content.textContent = ''

    // server on / off
    const status = make('p', { className: 'st-status ' + (data.online ? 'on' : 'off'), textContent: data.online ? '🟢 SERVER ONLINE' : '🔴 SERVER OFFLINE' })
    const onBtn = make('button', { className: 'big', type: 'button', textContent: 'Turn ON' })
    const offBtn = make('button', { className: 'big danger', type: 'button', textContent: 'Turn OFF' })
    onBtn.addEventListener('click', () => setServer(true))
    offBtn.addEventListener('click', () => { if (confirm('Turn the server OFF? Nobody will be able to play online.')) setServer(false) })
    content.append(status, make('div', { className: 'st-two' }, onBtn, offBtn))

    // winners
    const challenges = data.challenges || []
    const winners = challenges.filter(c => c.status === 'won').sort((a, b) => (b.wonAt || 0) - (a.wonAt || 0))
    content.append(make('h3', { textContent: `Who won (${winners.length})` }))
    if (!winners.length) content.append(make('p', { className: 'msg', textContent: 'Nobody has won yet.' }))
    winners.forEach(c => {
      const when = c.wonAt ? new Date(c.wonAt).toLocaleString() : ''
      const info = make('span', {}, make('b', { textContent: c.playerName || '?' }), make('small', { textContent: when + (c.prize ? ' · Prize: ' + c.prize : '') }))
      content.append(make('div', { className: 'st-win' }, pic(c.playerName, c.avatarAt), info))
    })

    // new challenge
    content.append(make('h3', { textContent: 'New challenge' }))
    const u = make('input', { type: 'text', placeholder: 'Username', maxLength: 30, autocomplete: 'off', value: formKeep.username })
    const pw = make('input', { type: 'text', placeholder: 'Password (4+ characters)', maxLength: 60, autocomplete: 'off', value: formKeep.password })
    const pz = make('input', { type: 'text', placeholder: 'Prize (shown to the winner)', maxLength: 300, autocomplete: 'off', value: formKeep.prize })
    const hrs = hourSelect()
    hrs.value = formKeep.hours
    const create = make('button', { className: 'big', type: 'button', textContent: 'Create challenge' })
    const keep = () => { formKeep = { username: u.value, password: pw.value, prize: pz.value, hours: hrs.value } }
    ;[u, pw, pz].forEach(i => i.addEventListener('input', keep))
    hrs.addEventListener('change', keep)
    create.addEventListener('click', async () => {
      keep()
      msg.textContent = 'Creating...'
      const r = await api('create', { username: u.value, password: pw.value, prize: pz.value, hours: hrs.value })
      if (!r.ok) { msg.textContent = r.data.error || 'Could not create.'; return }
      newId = r.data.id
      formKeep = { username: '', password: '', prize: '', hours: formKeep.hours }
      msg.textContent = ''
      refresh()
    })
    content.append(u, pw, pz, make('label', {}, 'Lasts ', hrs), create)

    if (newId) {
      const copy = make('button', { className: 'st-mini green', type: 'button', textContent: 'Copy ID' })
      copy.addEventListener('click', () => {
        try { navigator.clipboard.writeText(newId); copy.textContent = 'Copied!' } catch (error) { copy.textContent = 'Copy not available' }
      })
      content.append(make('div', { className: 'st-id' },
        'Challenge ID', make('b', { textContent: fmtId(newId) }),
        make('small', { textContent: 'Give this ID and the password to the player. It works once.' }), copy))
    }

    // challenge list
    content.append(make('h3', { textContent: `Challenges (${challenges.length})` }))
    if (!challenges.length) content.append(make('p', { className: 'msg', textContent: 'No challenges yet.' }))
    challenges.forEach(c => {
      const info = make('div', { className: 'st-grow' },
        make('b', { textContent: fmtId(c.id) + ' · ' + c.username }),
        make('small', { textContent: statusText(c) + ' · ' + left(c.expiresAt - Date.now()) }))
      if (c.prize) info.append(make('small', { textContent: 'Prize: ' + c.prize }))

      const sel = hourSelect()
      const ext = make('button', { className: 'st-mini', type: 'button', textContent: 'Extend' })
      ext.addEventListener('click', async () => {
        const r = await api('extend', { id: c.id, hours: Number(sel.value) })
        msg.textContent = r.ok ? `Added ${sel.value}h.` : (r.data.error || 'Could not extend.')
        refresh()
      })
      const del = make('button', { className: 'st-mini red', type: 'button', textContent: 'Delete' })
      del.addEventListener('click', async () => {
        if (!confirm('Delete this challenge now? The player is kicked out.')) return
        const r = await api('delete', { id: c.id })
        msg.textContent = r.ok ? 'Deleted.' : (r.data.error || 'Could not delete.')
        refresh()
      })
      content.append(make('div', { className: 'st-box' }, make('div', { className: 'st-row' }, info, sel, ext, del)))
    })
  }

  async function setServer(on) {
    msg.textContent = 'Please wait...'
    const r = await api('server', { on })
    msg.textContent = r.ok ? (on ? 'Server turned ON.' : 'Server turned OFF.') : (r.data.error || 'Could not change the server.')
    refresh()
  }

  async function refresh() {
    const r = await api('panel')
    if (r.status === 401 || r.status === 403) {
      setStaff(false)
      layer.hidden = true
      return
    }
    if (!r.ok) { msg.textContent = r.data.error || 'Could not load the panel.'; return }
    // do not wipe what you are typing while the panel refreshes by itself
    const typing = layer.contains(document.activeElement) && document.activeElement.tagName === 'INPUT'
    if (!typing) render(r.data)
  }

  function open() {
    layer.hidden = false
    msg.textContent = 'Loading...'
    refresh().then(() => { if (msg.textContent === 'Loading...') msg.textContent = '' })
    clearInterval(timer)
    timer = setInterval(() => { if (!layer.hidden) refresh() }, 15000)
  }

  function setStaff(v) {
    isStaff = v
    btn.hidden = !v
  }

  async function check() {
    const t = session()
    lastToken = t
    if (!t) { setStaff(false); return }
    const r = await api('me')
    setStaff(r.ok && r.data.staff === true)
  }

  btn.addEventListener('click', open)
  closeBtn.addEventListener('click', () => { layer.hidden = true; clearInterval(timer) })

  check()
  // notice logging in / out, and access being given or removed
  setInterval(() => { if (session() !== lastToken) check() }, 3000)
  setInterval(check, 60000)
})()
