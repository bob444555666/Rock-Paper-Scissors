(() => {
  'use strict';
  const API = 'https://rps-server.heyboernathan.workers.dev';
  const OVERLAY_ID = 'rps-maintenance-overlay';
  const css = `
    #rps-maintenance-overlay{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 18% 0%,#17264b 0,transparent 46%),radial-gradient(ellipse at 90% 100%,#26153e 0,transparent 42%),#050813;color:#f4f7ff;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}
    #rps-maintenance-overlay .maintenance-card{width:min(100%,560px);padding:clamp(26px,6vw,48px);border:1px solid #39496e;border-radius:24px;background:linear-gradient(145deg,rgba(17,27,49,.98),rgba(8,13,27,.98));box-shadow:0 30px 100px #000a,0 0 55px #647dff1a}
    #rps-maintenance-overlay .maintenance-mark{width:64px;height:64px;margin:0 auto 22px;display:grid;place-items:center;border:1px solid #7187ff66;border-radius:20px;background:#26345d;color:#91a4ff;font-size:30px;box-shadow:0 0 30px #6179ff33}
    #rps-maintenance-overlay .maintenance-label{margin:0 0 10px;color:#91a4ff;font-size:11px;font-weight:900;letter-spacing:.2em;text-transform:uppercase}
    #rps-maintenance-overlay h1{margin:0;color:#fff;font-size:clamp(30px,7vw,44px);font-weight:950;letter-spacing:-.04em}
    #rps-maintenance-overlay p{margin:15px 0 0;color:#b5c0d9;font-size:15px;line-height:1.7}
    #rps-maintenance-overlay .maintenance-pulse{display:inline-block;width:7px;height:7px;margin-right:8px;border-radius:50%;background:#fbbf24;box-shadow:0 0 14px #fbbf24;vertical-align:middle}
  `;
  let style;
  function show(message) {
    if (!document.getElementById('rps-maintenance-style')) {
      style = document.createElement('style');
      style.id = 'rps-maintenance-style';
      style.textContent = css;
      document.head.appendChild(style);
    }
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.setAttribute('role', 'alertdialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'rps-maintenance-title');
      overlay.innerHTML = '<main class="maintenance-card"><div class="maintenance-mark" aria-hidden="true">✦</div><p class="maintenance-label"><span class="maintenance-pulse"></span>Stone Paper Scissors</p><h1 id="rps-maintenance-title">Temporarily Disabled</h1><p id="rps-maintenance-message"></p><p>We’ll be back as soon as maintenance is complete.</p></main>';
      document.body.appendChild(overlay);
    }
    const copy = overlay.querySelector('#rps-maintenance-message');
    if (copy) copy.textContent = message || 'The website is temporarily unavailable while we make improvements. Please check back soon.';
    document.documentElement.style.colorScheme = 'dark';
  }
  function hide() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
    const s = document.getElementById('rps-maintenance-style');
    if (s) s.remove();
  }
  async function check() {
    try {
      const response = await fetch(API + '/site/status', { method: 'GET', cache: 'no-store' });
      if (!response.ok) return;
      const state = await response.json();
      if (state.enabled === true) show(state.message);
      else hide();
    } catch (_) {
      // Keep the last confirmed state; the next poll will retry.
    }
  }
  function start() {
    check();
    window.setInterval(check, 10000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
