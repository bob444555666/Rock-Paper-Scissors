/* Staff Control Panel (v2). Self-contained and safe: the button only shows for accounts the owner gave access to.
   It talks to the server with the account's login, so nobody ever sees the admin key or a secret URL.
   Tabs: Server (on/off + winners), Challenges, Tournaments, Premium. */
(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev'
  const LEVELS = ['Easy', 'Medium', 'Hard', 'Insane']

  let lastToken = null
  let timer = null
  let tab = 'server'
  let data = null
  let newId = ''
  let newEntry = null
  const keep = {
    ch: { username: '', password: '', prize: '', hours: '1' },
    tour: { name: '', ptype: 'text', prize: '', hours: '3' },
    prem: { username: '' }
  }

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
    #staff-layer .st-grow small, #staff-layer .st-small { display: block; color: rgba(255, 255, 255, 0.6); word-break: break-word; font-size: 12px; }
    #staff-layer select { padding: 8px; font-size: 15px; color: white; background: #191919; border: 1px solid #555; border-radius: 8px; }
    #staff-layer .st-mini { padding: 8px 12px; font-size: 14px; font-weight: bold; font-family: inherit; color: white; cursor: pointer; border: 0; border-radius: 8px; background: #2563eb; }
    #staff-layer .st-mini.red { background: #dc2626; }
    #staff-layer .st-mini.green { background: #16a34a; }
    #staff-layer .st-id { margin: 10px 0 0; padding: 12px; text-align: center; background: #14532d; border-radius: 12px; }
    #staff-layer .st-id b { display: block; font-size: 30px; letter-spacing: 4px; margin: 4px 0; }
    #staff-layer .st-pic { display: flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; overflow: hidden; font-size: 13px; font-weight: bold; background: rgba(168, 85, 247, 0.4); border-radius: 50%; }
    #staff-layer .st-pic img { width: 100%; height: 100%; object-fit: cover; }
    #staff-layer .st-win { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
    #staff-layer .st-pl { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
    #staff-layer .st-pl .st-grow { flex: 1 1 auto; }
    #staff-layer label { font-size: 14px; }
    #staff-layer .tabs { flex-wrap: wrap; }
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
      let json = {}
      try { json = await res.json() } catch (error) {}
      return { ok: res.ok, status: res.status, data: json }
    } catch (error) {
      return { ok: false, status: 0, data: { error: 'Could not reach the server.' } }
    }
  }

  const fmtId = id => id.slice(0, 4) + '-' + id.slice(4)

  function left(ms) {
    if (ms <= 0) return 'EXPIRED'
    const m = Math.floor(ms / 60000)
    return `${Math.floor(m / 60)}h ${m % 60}m left`
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

  function hourSelect(def) {
    const sel = make('select')
    for (let h = 1; h <= 20; h++) sel.append(make('option', { value: String(h), textContent: h + 'h' }))
    sel.value = String(def || 1)
    return sel
  }

  function copyBox(label, id, hint) {
    const copy = make('button', { className: 'st-mini green', type: 'button', textContent: 'Copy ID' })
    copy.addEventListener('click', () => {
      try { navigator.clipboard.writeText(id); copy.textContent = 'Copied!' } catch (error) { copy.textContent = 'Copy not available' }
    })
    return make('div', { className: 'st-id' }, label, make('b', { textContent: fmtId(id) }), make('small', { textContent: hint }), copy)
  }

  // ---------- window ----------
  const btn = make('button', { id: 'staff-btn', className: 'ui-fab', type: 'button', textContent: '🛠️ Control Panel' })
  btn.hidden = true
  const tabsBox = make('div', { className: 'tabs' })
  const content = make('div')
  const msg = make('p', { className: 'msg' })
  const closeBtn = make('button', { className: 'x', type: 'button', textContent: '✕' })
  const card = make('div', { className: 'card' }, closeBtn, make('h2', { textContent: 'Control Panel' }), tabsBox, content, msg)
  const layer = make('div', { id: 'staff-layer', className: 'ui-layer' }, card)
  layer.hidden = true
  document.body.append(btn, layer)

  function renderTabs() {
    tabsBox.textContent = ''
    ;[['server', '🖥️ Server'], ['challenges', '🎯 Challenges'], ['tournaments', '🏟️ Tournaments'], ['premium', '⭐ Premium']].forEach(([id, label]) => {
      const t = make('button', { className: 'tab' + (tab === id ? ' on' : ''), type: 'button', textContent: label })
      t.addEventListener('click', () => { tab = id; msg.textContent = ''; render() })
      tabsBox.append(t)
    })
  }

  async function act(action, body, okText) {
    msg.textContent = 'Please wait...'
    const r = await api(action, body)
    msg.textContent = r.ok ? (okText || '') : (r.data.error || 'That did not work.')
    if (r.ok) await refresh(true) // on an error keep what was typed
    return r
  }

  // ---------- tab: server ----------
  function tabServer() {
    content.append(make('p', { className: 'st-status ' + (data.online ? 'on' : 'off'), textContent: data.online ? '🟢 SERVER ONLINE' : '🔴 SERVER OFFLINE' }))
    const onBtn = make('button', { className: 'big', type: 'button', textContent: 'Turn ON' })
    const offBtn = make('button', { className: 'big danger', type: 'button', textContent: 'Turn OFF' })
    onBtn.addEventListener('click', () => act('server', { on: true }, 'Server turned ON.'))
    offBtn.addEventListener('click', () => { if (confirm('Turn the server OFF? Nobody will be able to play online.')) act('server', { on: false }, 'Server turned OFF.') })
    content.append(make('div', { className: 'st-two' }, onBtn, offBtn))

    const won = (data.challenges || []).filter(c => c.status === 'won').map(c => ({ name: c.playerName, at: c.avatarAt, when: c.wonAt, what: 'Challenge' + (c.prize ? ' · ' + c.prize : '') }))
    const champs = (data.tournaments || []).filter(t => t.champion).map(t => ({ name: t.champion, at: t.championAvatarAt, when: t.wonAt, what: t.name + ' · ' + (t.prizeType === 'premium' ? '⭐ Premium' : t.prizeText || 'tournament') }))
    const all = [...won, ...champs].sort((a, b) => (b.when || 0) - (a.when || 0))
    content.append(make('h3', { textContent: `Who won (${all.length})` }))
    if (!all.length) content.append(make('p', { className: 'msg', textContent: 'Nobody has won yet.' }))
    all.forEach(w => {
      content.append(make('div', { className: 'st-win' }, pic(w.name, w.at),
        make('span', {}, make('b', { textContent: w.name || '?' }), make('small', { className: 'st-small', textContent: (w.when ? new Date(w.when).toLocaleString() + ' · ' : '') + w.what }))))
    })
  }

  // ---------- tab: challenges ----------
  function chStatus(c) {
    if (c.status === 'open') return 'Waiting for a player (ID not used yet)'
    if (c.status === 'active') return `${c.playerName || 'Someone'} is playing: stage ${c.stage + 1}/4 (${LEVELS[c.stage] || ''}), ${c.roundsWon}/3 wins`
    if (c.status === 'won') return 'WON 🏆 by ' + (c.playerName || '?')
    return (c.playerName || 'Player') + ' lost'
  }

  function tabChallenges() {
    const k = keep.ch
    const u = make('input', { type: 'text', placeholder: 'Username', maxLength: 30, autocomplete: 'off', value: k.username })
    const pw = make('input', { type: 'text', placeholder: 'Password (4+ characters)', maxLength: 60, autocomplete: 'off', value: k.password })
    const pz = make('input', { type: 'text', placeholder: 'Prize (shown to the winner)', maxLength: 300, autocomplete: 'off', value: k.prize })
    const hrs = hourSelect(k.hours)
    const save = () => { k.username = u.value; k.password = pw.value; k.prize = pz.value; k.hours = hrs.value }
    ;[u, pw, pz].forEach(i => i.addEventListener('input', save))
    hrs.addEventListener('change', save)
    const create = make('button', { className: 'big', type: 'button', textContent: 'Create challenge' })
    create.addEventListener('click', async () => {
      save()
      const r = await act('create', { username: u.value, password: pw.value, prize: pz.value, hours: hrs.value })
      if (r.ok) { newId = r.data.id; keep.ch = { username: '', password: '', prize: '', hours: k.hours }; render() }
    })
    content.append(make('h3', { textContent: 'New challenge' }), u, pw, pz, make('label', {}, 'Lasts ', hrs), create)
    if (newId) content.append(copyBox('Challenge ID', newId, 'Give this ID and the password to the player. It works once.'))

    const list = data.challenges || []
    content.append(make('h3', { textContent: `Challenges (${list.length})` }))
    if (!list.length) content.append(make('p', { className: 'msg', textContent: 'No challenges yet.' }))
    list.forEach(c => {
      const info = make('div', { className: 'st-grow' }, make('b', { textContent: fmtId(c.id) + ' · ' + c.username }),
        make('small', { textContent: chStatus(c) + ' · ' + left(c.expiresAt - Date.now()) }))
      if (c.prize) info.append(make('small', { textContent: 'Prize: ' + c.prize }))
      const sel = hourSelect(1)
      const ext = make('button', { className: 'st-mini', type: 'button', textContent: 'Extend' })
      ext.addEventListener('click', () => act('extend', { id: c.id, hours: Number(sel.value) }, `Added ${sel.value}h.`))
      const del = make('button', { className: 'st-mini red', type: 'button', textContent: 'Delete' })
      del.addEventListener('click', () => { if (confirm('Delete this challenge now? The player is kicked out.')) act('delete', { id: c.id }, 'Deleted.') })
      content.append(make('div', { className: 'st-box' }, make('div', { className: 'st-row' }, info, sel, ext, del)))
    })
  }

  // ---------- tab: tournaments ----------
  function tourStatus(t) {
    if (t.status === 'setup') return `Setting up · ${t.players.filter(p => p.joined).length}/${t.players.length} joined`
    return t.status === 'running' ? 'RUNNING' : 'FINISHED'
  }

  function tabTournaments() {
    const k = keep.tour
    const nm = make('input', { type: 'text', placeholder: 'Room name (optional)', maxLength: 40, autocomplete: 'off', value: k.name })
    const pt = make('select')
    pt.append(make('option', { value: 'text', textContent: 'Text prize' }), make('option', { value: 'premium', textContent: '⭐ Premium (winner gets it automatically)' }))
    pt.value = k.ptype
    const pz = make('input', { type: 'text', placeholder: 'Prize text (for a text prize)', maxLength: 300, autocomplete: 'off', value: k.prize })
    const hrs = hourSelect(k.hours)
    const save = () => { k.name = nm.value; k.ptype = pt.value; k.prize = pz.value; k.hours = hrs.value }
    ;[nm, pz].forEach(i => i.addEventListener('input', save))
    pt.addEventListener('change', save)
    hrs.addEventListener('change', save)
    const create = make('button', { className: 'big', type: 'button', textContent: 'Make tournament room' })
    create.addEventListener('click', async () => {
      save()
      const r = await act('tcreate', { name: nm.value, prizeType: pt.value, prizeText: pz.value, hours: hrs.value }, 'Room made. Now add the players.')
      if (r.ok) { keep.tour = { name: '', ptype: k.ptype, prize: '', hours: k.hours }; render() }
    })
    content.append(make('h3', { textContent: 'New tournament room' }), nm, make('label', {}, 'Prize ', pt), pz, make('label', {}, 'Lasts ', hrs), create)
    if (newEntry) content.append(copyBox(`Tournament ID for ${newEntry.user}`, newEntry.eid, 'Give this ID and the password to that player. It only works for their account.'))

    const list = data.tournaments || []
    content.append(make('h3', { textContent: `Tournaments (${list.length})` }))
    if (!list.length) content.append(make('p', { className: 'msg', textContent: 'No tournaments yet.' }))

    list.forEach(t => {
      const box = make('div', { className: 'st-box' })
      box.append(make('b', { textContent: `${t.name} · ${tourStatus(t)}` }),
        make('small', { className: 'st-small', textContent: `Prize: ${t.prizeType === 'premium' ? '⭐ Premium' : t.prizeText || '(none)'} · ${left(t.expiresAt - Date.now())}` }))
      if (t.champion) box.append(make('small', { className: 'st-small', textContent: '🏆 Winner: ' + t.champion }))
      t.live.forEach(m => box.append(make('small', { className: 'st-small', textContent: `${m.round}: ${m.a || '?'} vs ${m.b || '?'} (${m.wins[0]}-${m.wins[1]})` })))

      t.players.forEach(p => {
        const info = make('span', { className: 'st-grow' }, make('b', { textContent: p.username }),
          make('small', { textContent: `${fmtId(p.eid)} · ${p.joined ? 'joined' : 'not joined yet'}${t.status !== 'setup' ? (p.alive ? ' · still in' : ' · out') : ''}` }))
        const row = make('div', { className: 'st-pl' }, pic(p.username, p.avatarAt), info)
        if (t.status !== 'finished') {
          const rm = make('button', { className: 'st-mini red', type: 'button', textContent: 'Remove' })
          rm.addEventListener('click', () => { if (confirm(`Remove ${p.username}?`)) act('tkick', { tid: t.id, eid: p.eid }, 'Player removed.') })
          row.append(rm)
        }
        box.append(row)
      })

      if (t.status === 'setup') {
        const au = make('input', { type: 'text', placeholder: 'Their account username', maxLength: 16, autocomplete: 'off' })
        const ap = make('input', { type: 'text', placeholder: 'Password for them (4+ characters)', maxLength: 60, autocomplete: 'off' })
        const add = make('button', { className: 'big', type: 'button', textContent: `Add player (${t.players.length}/16)` })
        add.addEventListener('click', async () => {
          const r = await act('tadd', { tid: t.id, username: au.value, password: ap.value }, 'Player added.')
          if (r.ok) { newEntry = { eid: r.data.eid, user: au.value.trim() }; render() }
        })
        const start = make('button', { className: 'big alt', type: 'button', textContent: 'Start tournament' })
        start.addEventListener('click', () => { if (confirm('Start now? Players who have not joined yet are dropped.')) act('tstart', { tid: t.id }, 'Tournament started!') })
        box.append(au, ap, add, start)
      }

      const sel = hourSelect(1)
      const ext = make('button', { className: 'st-mini', type: 'button', textContent: 'Extend' })
      ext.addEventListener('click', () => act('textend', { tid: t.id, hours: Number(sel.value) }, `Added ${sel.value}h.`))
      const del = make('button', { className: 'st-mini red', type: 'button', textContent: 'Delete' })
      del.addEventListener('click', () => { if (confirm('Delete this tournament now?')) act('tdelete', { tid: t.id }, 'Deleted.') })
      box.append(make('div', { className: 'st-row' }, sel, ext, del))
      content.append(box)
    })
  }

  // ---------- tab: premium ----------
  function tabPremium() {
    const u = make('input', { type: 'text', placeholder: 'Account username', maxLength: 16, autocomplete: 'off', value: keep.prem.username })
    u.addEventListener('input', () => { keep.prem.username = u.value })
    const give = make('button', { className: 'big', type: 'button', textContent: 'Give Premium' })
    give.addEventListener('click', async () => {
      const r = await act('prem-add', { username: u.value }, 'Premium given.')
      if (r.ok) { keep.prem.username = ''; render() }
    })
    content.append(make('h3', { textContent: 'Give Premium' }),
      make('p', { className: 'st-small', textContent: 'Premium is also won automatically in tournaments that have Premium as the prize.' }), u, give)

    const list = data.premium || []
    content.append(make('h3', { textContent: `Premium members (${list.length})` }))
    if (!list.length) content.append(make('p', { className: 'msg', textContent: 'Nobody has Premium yet.' }))
    list.forEach(p => {
      const rm = make('button', { className: 'st-mini red', type: 'button', textContent: 'Remove' })
      rm.addEventListener('click', () => { if (confirm(`Remove Premium from ${p.username}?`)) act('prem-remove', { id: p.id }, 'Premium removed.') })
      content.append(make('div', { className: 'st-pl' }, pic(p.username, p.avatarAt),
        make('span', { className: 'st-grow' }, make('b', { textContent: p.username }), make('small', { textContent: p.source === 'tournament' ? 'won in a tournament' : 'given by staff' })), rm))
    })
  }

  function render() {
    renderTabs()
    content.textContent = ''
    if (!data) { content.append(make('p', { className: 'msg', textContent: 'Loading...' })); return }
    if (tab === 'server') tabServer()
    else if (tab === 'challenges') tabChallenges()
    else if (tab === 'tournaments') tabTournaments()
    else tabPremium()
  }

  async function refresh(force) {
    const r = await api('panel')
    if (r.status === 401 || r.status === 403) {
      btn.hidden = true
      layer.hidden = true
      return
    }
    if (!r.ok) { msg.textContent = r.data.error || 'Could not load the panel.'; return }
    data = r.data
    // do not wipe what you are typing while the panel refreshes by itself
    const typing = layer.contains(document.activeElement) && document.activeElement.tagName === 'INPUT'
    if (force || !typing) render()
  }

  function open() {
    layer.hidden = false
    msg.textContent = ''
    render()
    refresh()
    clearInterval(timer)
    timer = setInterval(() => { if (!layer.hidden) refresh() }, 15000)
  }

  async function check() {
    const t = session()
    lastToken = t
    if (!t) { btn.hidden = true; return }
    const r = await api('me')
    btn.hidden = !(r.ok && r.data.staff === true)
  }

  btn.addEventListener('click', open)
  closeBtn.addEventListener('click', () => { layer.hidden = true; clearInterval(timer) })

  check()
  // notice logging in / out, and access being given or removed
  setInterval(() => { if (session() !== lastToken) check() }, 3000)
  setInterval(check, 60000)
})()
