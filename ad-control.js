/* Membership-aware advertising.
   Pro and Legend members do not receive the site's in-page ad tags.
   Membership is verified by the RPS server; browser cache is not trusted. */
(() => {
  'use strict';
  const API = 'https://rps-server.heyboernathan.workers.dev';
  const PRO_PLANS = new Set(['pro', 'duo', 'ultra']);
  const LEGEND_PLANS = new Set(['legend', 'family', 'ultra plus']);
  let adsStarted = false;
  let lastToken = null;

  function getToken() {
    try { return localStorage.getItem('token') || ''; }
    catch (_) { return ''; }
  }

  function loadAds() {
    if (adsStarted) return;
    adsStarted = true;
    const tag = document.createElement('script');
    tag.src = 'https://quge5.com/88/tag.min.js';
    tag.async = true;
    tag.dataset.zone = '308913';
    tag.dataset.cfasync = 'false';
    document.head.appendChild(tag);

    const aclib = document.createElement('script');
    aclib.id = 'aclib';
    aclib.src = 'https://acscdn.com/script/aclib.js';
    aclib.async = true;
    aclib.onload = () => {
      if (window.aclib && typeof window.aclib.runAutoTag === 'function') {
        window.aclib.runAutoTag({ zoneId: 'yhcw4vckxp' });
      }
    };
    document.head.appendChild(aclib);
  }

  async function checkMembershipAndLoadAds() {
    const token = getToken();
    if (!token) { loadAds(); return; }
    try {
      const response = await fetch(API + '/account/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        cache: 'no-store'
      });
      if (response.status === 401) { loadAds(); return; }
      if (!response.ok) return; // Fail closed if a signed-in plan cannot be verified.
      const membership = await response.json();
      const plan = String(membership.plan || '').trim().toLowerCase();
      const adFree = membership.premium === true &&
        (PRO_PLANS.has(plan) || LEGEND_PLANS.has(plan));
      if (!adFree) loadAds();
    } catch (_) {
      // Fail closed for signed-in users when membership verification is unavailable.
    }
  }

  function refreshIfAccountChanged() {
    const token = getToken();
    if (token !== lastToken) {
      lastToken = token;
      checkMembershipAndLoadAds();
    }
  }

  lastToken = getToken();
  checkMembershipAndLoadAds();
  window.addEventListener('storage', refreshIfAccountChanged);
  window.setInterval(refreshIfAccountChanged, 3000);
})();
