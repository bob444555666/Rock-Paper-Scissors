(() => {
  'use strict';
  const KEY = 'rps.signup.game';
  const PENDING = 'rps.signup.game.pending';
  const selectedGame = () => document.querySelector('input[name="signup-game"]:checked')?.value || 'rps';

  document.querySelectorAll('input[name="signup-game"]').forEach(input => {
    input.addEventListener('change', () => {
      try { sessionStorage.setItem(KEY, selectedGame()); } catch (_) {}
    });
  });

  const registerButton = document.getElementById('reg-go');
  registerButton?.addEventListener('click', () => {
    try {
      sessionStorage.setItem(KEY, selectedGame());
      sessionStorage.setItem(PENDING, '1');
    } catch (_) {}
  });

  document.querySelectorAll('.tab[data-tab="login"]').forEach(button => {
    button.addEventListener('click', () => {
      try { sessionStorage.removeItem(PENDING); } catch (_) {}
    });
  });

  // Redirect only after the email-verification flow has actually completed and
  // the existing auth code has hidden the sign-in panel.
  const layer = document.getElementById('auth-layer');
  if (!layer) return;
  const observer = new MutationObserver(() => {
    if (!layer.hidden) return;
    let pending = false, game = 'rps';
    try {
      pending = sessionStorage.getItem(PENDING) === '1';
      game = sessionStorage.getItem(KEY) || 'rps';
    } catch (_) {}
    if (!pending) return;
    try { sessionStorage.removeItem(PENDING); } catch (_) {}
    if (game === 'dice') window.location.assign('/roll-dice.html');
  });
  observer.observe(layer, { attributes: true, attributeFilter: ['hidden'] });
})();