/* Employee portal entry button for the signed-in RPS account. */
(() => {
  'use strict';
  const API = 'https://rps-server.heyboernathan.workers.dev';
  const profile = document.getElementById('profile-layer');
  if (!profile) return;
  const accountHeading = Array.from(profile.querySelectorAll('h3')).find(el => (el.textContent || '').trim().toLowerCase() === 'account');
  if (!accountHeading) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'rps-staff-member';
  button.className = 'big alt';
  button.textContent = 'Staff Member';
  button.hidden = true;
  button.style.cssText = 'margin:10px 0;border:1px solid #8b5cf6;background:linear-gradient(110deg,#312e81,#581c87);color:#fff';
  button.addEventListener('click', () => { window.location.href = '/staff-portal.html'; });
  profile.insertBefore(button, accountHeading);
  let lastToken = null;
  async function check() {
    let token = '';
    try { token = localStorage.getItem('token') || ''; } catch (_) {}
    lastToken = token;
    if (!token) { button.hidden = true; return; }
    try {
      const response = await fetch(API + '/staff/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        cache: 'no-store'
      });
      const data = await response.json();
      button.hidden = !(response.ok && data.staff === true);
    } catch (_) { button.hidden = true; }
  }
  check();
  window.setInterval(() => {
    let token = '';
    try { token = localStorage.getItem('token') || ''; } catch (_) {}
    if (token !== lastToken) check();
  }, 1500);
  window.setInterval(check, 30000);
})();
