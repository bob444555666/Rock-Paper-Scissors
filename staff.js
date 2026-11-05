/* Separate profile shortcuts for the owner and QR-authenticated employees. */
(() => {
  'use strict';
  const API = 'https://rps-server.heyboernathan.workers.dev';
  const profile = document.getElementById('profile-layer');
  if (!profile) return;
  const accountHeading = Array.from(profile.querySelectorAll('h3')).find(el => (el.textContent || '').trim().toLowerCase() === 'account');
  if (!accountHeading) return;

  let currentRole = '';
  const makeButton = (id, label, destination, color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.className = 'big alt';
    button.textContent = label;
    button.hidden = true;
    button.style.cssText = 'margin:10px 8px 10px 0;border:1px solid ' + color + ';background:linear-gradient(110deg,#172554,#312e81);color:#fff';
    button.addEventListener('click', () => { window.location.href = destination; });
    profile.insertBefore(button, accountHeading);
    return button;
  };

  const staffButton = makeButton('rps-staff-portal', 'Staff Portal · QR Login', '/staff-portal.html', '#8b5cf6');
  const ownerButton = makeButton('rps-owner-portal', 'Owner Portal · Secure Login', '/owner-control.html', '#38bdf8');
  let lastToken = null;

  async function check() {
    let token = '';
    try { token = localStorage.getItem('token') || ''; } catch (_) {}
    lastToken = token;
    if (!token) {
      currentRole = '';
      staffButton.hidden = true;
      ownerButton.hidden = true;
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
      currentRole = response.ok && data.staff === true ? (data.role || 'staff') : '';
      // Only the primary Owner bypasses the employee QR flow.
      ownerButton.hidden = currentRole !== 'owner';
      staffButton.hidden = !['staff', 'manager', 'co-owner'].includes(currentRole);
    } catch (_) {
      currentRole = '';
      staffButton.hidden = true;
      ownerButton.hidden = true;
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
