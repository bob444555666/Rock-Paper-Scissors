// Lets every player change their own username and password.
// Works with 12-rps-accounts.js (same saved accounts, same login session).
(() => {
const $ = s => document.querySelector(s)
const g = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const sv = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const hash = async t => { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('') } catch { return btoa(t) } }
const val = id => $(id).value

function view(msg = '', ok = false) {
  const me = g('rps_me', null)
  $('#pbody').innerHTML = `<h2>⚙️ Account</h2><p>Logged in as <b>${me}</b></p>
  <h3>Your current password</h3>
  <input id="as-cur" type="password" placeholder="Current password">
  <h3>Change username</h3>
  <input id="as-user" placeholder="New username" maxlength="14" autocapitalize="none">
  <button class="big" data-a="ch-user">Save username</button>
  <h3>Change password</h3>
  <input id="as-new" type="password" placeholder="New password">
  <input id="as-new2" type="password" placeholder="Repeat new password">
  <button class="big" data-a="ch-pass">Save password</button>
  <p class="msg" style="${ok ? '' : 'color:#ff6b8a'}">${msg}</p>`
  $('#panel').hidden = false
}

async function check() {
  const me = g('rps_me', null), users = g('rps_users', {}), u = users[me]
  if (!u) return { err: 'Please log in again.' }
  if (u.h !== await hash(val('#as-cur'))) return { err: 'Current password is wrong.' }
  return { me, users, u }
}

const done = () => dispatchEvent(new Event('rps-accounts-changed'))

const actions = {
  acct: () => view(),

  'ch-user': async () => {
    const c = await check(); if (c.err) return view(c.err)
    const name = val('#as-user').trim().toLowerCase()
    if (c.me === 'owner') return view("The owner username can't be changed.")
    if (!/^[a-z0-9_-]{3,14}$/.test(name)) return view('Username: 3-14 letters, numbers, _ or -.')
    if (name === 'owner') return view('That name is reserved.')
    if (c.users[name]) return view('That name is taken.')
    c.users[name] = c.u; delete c.users[c.me]
    sv('rps_users', c.users); sv('rps_me', name); done()
    view(`Username changed to ${name} ✅`, true)
  },

  'ch-pass': async () => {
    const c = await check(); if (c.err) return view(c.err)
    const p = val('#as-new')
    if (p.length < 4) return view('New password needs 4+ characters.')
    if (p !== val('#as-new2')) return view("The new passwords don't match.")
    c.u.h = await hash(p); sv('rps_users', c.users); done()
    view('Password changed ✅', true)
  }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]')
  if (b && actions[b.dataset.a]) actions[b.dataset.a]()
})
})()
