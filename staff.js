/* Put role-based portal shortcuts directly inside the Account section of the profile menu. */
(() => {
  'use strict';
  const API = 'https://rps-server.heyboernathan.workers.dev';
  const profile = document.getElementById('profile-layer');
  if (!profile) return;
  const accountHeading = Array.from(profile.querySelectorAll('h3')).find(el => (el.textContent || '').trim().toLowerCase() === 'account');
  if (!accountHeading) return;

  let lastToken = null;
  const portalGroup = document.createElement('div');
  portalGroup.id = 'rps-account-portals';
  portalGroup.style.cssText = 'display:grid;grid-template-columns:1fr;gap:9px;margin:10px 0 16px';
  accountHeading.insertAdjacentElement('afterend', portalGroup);

  const makeButton = (id, label, destination, accent) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.className = 'big alt';
    button.textContent = label;
    button.hidden = true;
    button.style.cssText = 'width:100%;margin:0;border:1px solid ' + accent + ';background:linear-gradient(110deg,#172554,#312e81);color:#fff';
    button.addEventListener('click', () => { window.location.href = destination; });
    portalGroup.appendChild(button);
    return button;
  };

  const ownerButton = makeButton('rps-owner-portal', '👑 Owner Portal', '/owner-control.html', '#38bdf8');
  const staffButton = makeButton('rps-staff-portal', '🛡️ Staff Portal', '/staff-portal.html', '#a78bfa');

  async function check() {
    let token = '';
    try { token = localStorage.getItem('token') || ''; } catch (_) {}
    lastToken = token;
    if (!token) {
      ownerButton.hidden = true;
      staffButton.hidden = true;
      portalGroup.hidden = true;
      return;
    }
    try {
      const response = await fetch(API + '/staff/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        cache: 'no-store'
      });
      const data = await response.json();
      const role = response.ok && data.staff === true ? String(data.role || 'staff').toLowerCase() : '';
      ownerButton.hidden = !['owner', 'co-owner'].includes(role);
      staffButton.hidden = !['staff', 'manager', 'co-owner', 'owner'].includes(role);
      portalGroup.hidden = ownerButton.hidden && staffButton.hidden;
    } catch (_) {
      ownerButton.hidden = true;
      staffButton.hidden = true;
      portalGroup.hidden = true;
    }
  }

  check();
  window.setInterval(() => {
    let token = '';
    try { token = localStorage.getItem('token') || ''; } catch (_) {}
    if (token !== lastToken) check();
  }, 1500);
  window.setInterval(check, 30000);
})();