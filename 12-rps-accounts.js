(() => {
const $ = s => document.querySelector(s)
const g = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const sv = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const GOAL = { easy: 500, medium: 1500, hard: 2000, insane: 5000 }, LV = Object.keys(GOAL)
const sum = o => Object.values(o).reduce((a, b) => a + b, 0)
const mk = h => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild }
const hash = async t => { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('') } catch { return btoa(t) } }
let users = g('rps_users', {}), me = g('rps_me', null), pick = null
const put = () => sv('rps_users', users)
const lv0 = () => ({ easy: 0, medium: 0, hard: 0, insane: 0 })

document.body.append(
  mk('<div id="auth" class="ui-layer" hidden></div>'),
  mk('<button id="menu-btn" class="ui-fab" data-a="menu" hidden>☰ Menu<i id="badge" hidden></i></button>'),
  mk('<button id="owner-btn" class="ui-fab" data-a="own" data-t="theme" hidden>👑 Owner Dashboard</button>'),
  mk('<div id="panel" class="ui-layer" hidden><div class="card"><button class="x" data-a="close">✕</button><div id="pbody"></div></div></div>'))

const theme = () => { const t = g('rps_theme', {}); for (const k of ['purple', 'blue', 'green', 'black']) if (t[k]) document.documentElement.style.setProperty('--' + k, t[k]); if (t.title) $('.title').textContent = t.title }
const open = h => { $('#pbody').innerHTML = h; $('#panel').hidden = false }
const badge = () => { const n = me && users[me] ? users[me].notes.filter(x => !x.r).length : 0; $('#badge').hidden = !n; $('#badge').textContent = n }

function auth(mode = 'login', msg = '') {
  const r = mode === 'reg'
  $('#auth').innerHTML = `<div class="card"><h2>${r ? 'Create account' : 'Log in'}</h2>
  <input id="u" placeholder="Username" maxlength="14" autocapitalize="none"><input id="p" type="password" placeholder="Password">
  <p class="msg">${msg}</p><button class="big" data-a="${r ? 'register' : 'login'}">${r ? 'Register' : 'Log in'}</button>
  <button class="icon" data-a="${r ? 'tologin' : 'toreg'}">${r ? '⬅️' : '👤➕'}</button><small>${r ? 'Back to login' : 'New here? Tap to register'}</small></div>`
  $('#auth').hidden = false
}
function enter() {
  $('#auth').hidden = true; $('#menu-btn').hidden = false
  $('#owner-btn').hidden = me !== 'owner'; badge()
}

const menu = () => open(`<h2>Menu</h2><button class="big" data-a="lb" data-k="pc" data-b="w">🏆 Leaderboard</button>
  <button class="big" data-a="chal" data-s="main">⚔️ Challenge</button>
  <button class="big" data-a="notes">🔔 Notifications</button><button class="big alt" data-a="logout">🚪 Log out</button>`)

function lb(k, b) {
  const r = Object.entries(users).map(([n, u]) => ({ n, v: k === 'pc' ? sum(b === 'w' ? u.cw : u.cl) : (b === 'w' ? u.pw : u.pl) })).sort((x, y) => y.v - x.v || x.n.localeCompare(y.n))
  const row = (x, j) => `<div class="row${x.n === me ? ' me' : ''}"><b>${j + 1}</b><span>${x.n}</span><em>${x.v}</em></div>`
  const i = r.findIndex(x => x.n === me), st = Math.max(3, i - 1)
  let h = r.slice(0, 3).map((x, j) => row(x, j)).join('')
  if (i > 2) h += '<div class="dots">⋯</div>' + r.slice(st, i + 2).map((x, j) => row(x, st + j)).join('')
  const t = (a, l, on) => `<button class="tab${on ? ' on' : ''}" data-a="lb" data-k="${a[0]}" data-b="${a[1]}">${l}</button>`
  open(`<h2>Leaderboard</h2><div class="tabs">${t(['pc', b], '🤖 Computer', k === 'pc')}${t(['pp', b], '👥 People', k === 'pp')}</div>
  <div class="tabs">${t([k, 'w'], 'Most wins', b === 'w')}${t([k, 'l'], 'Most losses', b === 'l')}</div>${h || '<p>No players yet.</p>'}`)
}

function chal(s, c) {
  if (s === 'cpu') return open(`<h2>vs Computer</h2>${LV.map(l => `<button class="big lv-${l}" data-a="cpu" data-l="${l}">${l[0].toUpperCase() + l.slice(1)}</button>`).join('')}<button class="tab" data-a="chal" data-s="main">⬅ Back</button>`)
  if (s === 'ppl') return open(`<h2>vs Person</h2><button class="big" data-a="create">🎮 Create a game</button><button class="big" data-a="join" data-c="RANDOM">🎲 Join random game</button>
    <input id="jc" placeholder="Room code" maxlength="10"><button class="big alt" data-a="joincode">🔑 Join with code</button><button class="tab" data-a="chal" data-s="main">⬅ Back</button>`)
  if (s === 'made') return open(`<h2>Your room code</h2><p class="code">${c}</p><p>Share this so a friend can join.</p><button class="big" data-a="join" data-c="${c}">▶ Start</button>`)
  open(`<h2>Challenge</h2><button class="big" data-a="chal" data-s="cpu">🤖 vs Computer</button><button class="big" data-a="chal" data-s="ppl">👥 vs Person</button>`)
}
const go = c => { $('#panel').hidden = true; $('#mode-online').click(); $('#room-code').value = c; $('#join-button').click() }

function notes() {
  const u = users[me]; const h = u.notes.slice().reverse().map(n => `<div class="row"><span>${n.t}</span></div>`).join('')
  u.notes.forEach(n => n.r = 1); put(); badge(); open(`<h2>Notifications</h2>${h || '<p>Nothing yet.</p>'}`)
}

const cands = k => Object.entries(users).flatMap(([n, u]) => k === 'ppl' ? (u.pw >= 100 && !u.won.ppl ? [{ n, key: 'ppl', t: `${u.pw} wins vs people` }] : []) : LV.filter(l => u.cw[l] >= GOAL[l] && !u.won[l]).map(l => ({ n, key: l, t: `${u.cw[l]} ${l} wins` })))
function own(t) {
  const th = g('rps_theme', {}), tab = (k, l) => `<button class="tab${t === k ? ' on' : ''}" data-a="own" data-t="${k}">${l}</button>`
  let b
  if (t === 'theme') b = ['purple', 'blue', 'green', 'black'].map(k => `<label class="row"><span>${k}</span><input class="tc" type="color" data-k="${k}" value="${th[k] || { purple: '#a855f7', blue: '#3b82f6', green: '#22f5a0', black: '#07060d' }[k]}"></label>`).join('') + `<input class="tc" data-k="title" placeholder="Game title" value="${th.title || ''}">`
  else { const c = cands(t); pick = null; b = `<p>${t === 'ppl' ? '100 wins vs people' : 'Easy 500 · Medium 1500 · Hard 2000 · Insane 5000'}</p>${c.map(x => `<div class="row"><span>${x.n}</span><em>${x.t}</em></div>`).join('') || '<p>No winners yet.</p>'}
    ${c.length ? `<div id="wheel"></div><button class="big" data-a="spin" data-t="${t}">🎡 Spin the wheel</button>` : ''}<p id="pickout"></p><input id="prize" placeholder="Prize" hidden><button class="big" id="sendp" data-a="send" data-t="${t}" hidden>🎁 Send prize</button>` }
  open(`<h2>👑 Owner Dashboard</h2><div class="tabs">${tab('theme', '🎨 Theme')}${tab('ppl', '👥 People')}${tab('cpu', '🤖 Computer')}</div>${b}`)
}

document.addEventListener('input', e => { const i = e.target.closest('.tc'); if (!i) return; const t = g('rps_theme', {}); t[i.dataset.k] = i.value; sv('rps_theme', t); theme() })
addEventListener('rps-result', e => {
  if (!me || !users[me]) return
  const { which, result, level } = e.detail; if (result === 'tie') return
  const u = users[me], w = result === 'win'
  if (which === 'online') w ? u.pw++ : u.pl++; else (w ? u.cw : u.cl)[level]++
  put()
})

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b) return
  const d = b.dataset, A = {
    close: () => $('#panel').hidden = true, menu, lb: () => lb(d.k, d.b), chal: () => chal(d.s), notes, own: () => own(d.t),
    cpu: () => { $('#panel').hidden = true; $('#mode-computer').click(); $(`.level-button[data-level="${d.l}"]`).click() },
    create: () => chal('made', Math.random().toString(36).slice(2, 7).toUpperCase()), join: () => go(d.c),
    joincode: () => $('#jc').value.trim() && go($('#jc').value.trim()),
    logout: () => { me = null; sv('rps_me', null); $('#panel').hidden = true; $('#menu-btn').hidden = $('#owner-btn').hidden = true; auth() },
    toreg: () => auth('reg'), tologin: () => auth('login'),
    login: async () => { const n = $('#u').value.trim().toLowerCase(); if (users[n] && users[n].h === await hash($('#p').value)) { me = n; sv('rps_me', n); enter() } else auth('login', 'Wrong username or password.') },
    register: async () => {
      const n = $('#u').value.trim().toLowerCase(), p = $('#p').value
      if (n.length < 3 || p.length < 4) return auth('reg', 'Name 3+ letters, password 4+ characters.')
      if (users[n]) return auth('reg', 'That name is taken.')
      users[n] = { h: await hash(p), pw: 0, pl: 0, cw: lv0(), cl: lv0(), won: {}, notes: [] }; put(); auth('login', 'Account created! Now log in.')
    },
    spin: () => {
      const c = cands(d.t); pick = c[Math.floor(Math.random() * c.length)]
      const w = $('#wheel'); w.style.transform = `rotate(${1440 + Math.random() * 360}deg)`
      setTimeout(() => { $('#pickout').textContent = `🎉 ${pick.n} (${pick.t})`; $('#prize').hidden = $('#sendp').hidden = false }, 3100)
    },
    send: () => {
      const p = $('#prize').value.trim(); if (!pick || !p) return
      const u = users[pick.n]; u.notes.push({ t: `🎁 You won a prize: ${p}!`, r: 0 }); u.won[pick.key] = true; put(); own(d.t)
    }
  }
  if (A[d.a]) A[d.a]()
})

theme()
me && users[me] ? enter() : auth()
})()
