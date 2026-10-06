/* Premium button inside your profile settings.
   Premium is won by winning a tournament whose prize is Premium, or given by the staff.
   It adds a gold star next to your name on the leaderboard, which you can switch on or off here. */
(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev'
  const layer = document.querySelector('#profile-layer')
  const anchor = document.querySelector('#pf-logout')
  if (!layer || !anchor) return

  const session = () => { try { return localStorage.getItem('token') } catch (error) { return null } }

  const head = document.createElement('h3')
  head.textContent = 'Premium'
  const info = document.createElement('p')
  info.className = 'auth-sub'
  const btn = document.createElement('button')
  btn.className = 'big'
  btn.type = 'button'
  btn.textContent = '⭐ Premium'
  const note = document.createElement('p')
  note.className = 'msg'
  anchor.parentNode.insertBefore(head, anchor)
  anchor.parentNode.insertBefore(info, anchor)
  anchor.parentNode.insertBefore(btn, anchor)
  anchor.parentNode.insertBefore(note, anchor)

  let status = null

  async function call(path, data) {
    try {
      const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, token: session() })
      })
      let json = {}
      try { json = await res.json() } catch (error) {}
      return { ok: res.ok, data: json }
    } catch (error) {
      return { ok: false, data: { error: 'Could not reach the server.' } }
    }
  }

  function show() {
    note.textContent = ''
    if (!status) { info.textContent = 'Loading...'; btn.disabled = true; return }
    if (status.premium) {
      const how = status.source === 'tournament' ? 'You won it in a tournament.' : 'The staff gave it to you.'
      info.textContent = `⭐ You have Premium. ${how}`
      btn.disabled = false
      btn.textContent = status.badge ? '⭐ Premium badge: ON (tap to hide)' : '⭐ Premium badge: OFF (tap to show)'
    } else {
      info.textContent = '🔒 Locked. Win a tournament that has Premium as the prize to unlock it.'
      btn.disabled = true
      btn.textContent = '⭐ Premium (locked)'
    }
  }

  async function refresh() {
    if (!session()) { status = null; info.textContent = 'Log in to see your Premium status.'; btn.disabled = true; return }
    const r = await call('/account/premium', {})
    status = r.ok ? r.data : null
    if (!r.ok) { info.textContent = r.data.error || 'Could not load Premium status.'; btn.disabled = true; return }
    show()
  }

  btn.addEventListener('click', async () => {
    if (!status || !status.premium) return
    btn.disabled = true
    const r = await call('/account/premium-badge', { on: !status.badge })
    if (r.ok) status.badge = r.data.badge
    show()
    note.textContent = r.ok ? '' : (r.data.error || 'Could not change that.')
  })

  new MutationObserver(() => { if (!layer.hidden) { status = null; show(); refresh() } })
    .observe(layer, { attributes: true, attributeFilter: ['hidden'] })
  if (!layer.hidden) refresh()
})()
