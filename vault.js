(() => {
  'use strict';
  const API = 'https://rps-style-vault-api.heyboernathan.workers.dev';
  const $ = id => document.getElementById(id);
  const cards = [...document.querySelectorAll('[data-style]')];
  const ranks = { free: 0, plus: 1, pro: 2, legend: 3 };
  const labels = { plus: 'Plus', pro: 'Pro', legend: 'Legend' };
  let token = '';
  let tier = 'free';
  let isMember = false;
  let equippedId = 'neon-challenger';

  function styleFromCard(card) {
    const colors = (card.dataset.colors || '#22f5a0,#3b82f6').split(',');
    return {
      id: card.dataset.style,
      name: card.querySelector('h3')?.textContent || card.dataset.style,
      icon: card.dataset.icon || '⚡',
      effect: card.dataset.effect || 'Pulse',
      tier: card.dataset.tier || 'plus',
      colors
    };
  }

  function paint(style) {
    if (!style) return;
    const card = cards.find(c => c.dataset.style === style.id);
    const data = card ? styleFromCard(card) : style;
    const colors = data.colors || ['#22f5a0', '#3b82f6'];
    $('preview').style.setProperty('--a', colors[0]);
    $('preview').style.setProperty('--b', colors[1] || colors[0]);
    $('preview').dataset.style = data.id;
    $('avatar').textContent = data.icon || '⚡';
    $('title-preview').textContent = data.name || 'Neon Challenger';
    $('effect-preview').textContent = 'Victory effect: ' + (data.effect || 'Pulse');
    $('tier-preview').textContent = (data.tier || 'plus').toUpperCase() + ' STYLE';
  }

  function showMessage(message, error = false) {
    $('message').textContent = message;
    $('message').classList.toggle('error', error);
  }

  function updateCards() {
    cards.forEach(card => {
      const required = card.dataset.tier || 'plus';
      const allowed = isMember && ranks[tier] >= ranks[required];
      const button = card.querySelector('.equip-btn');
      const active = card.dataset.style === equippedId && isMember;
      card.classList.toggle('equipped', active);
      button.disabled = !allowed;
      button.textContent = active ? 'Equipped ✓' : !token ? 'Sign in to equip' : !isMember ? 'Membership required' : allowed ? 'Equip' : 'Unlock with ' + labels[required];
    });
    $('equipped-copy').textContent = isMember
      ? 'Currently equipped: ' + (cards.find(c => c.dataset.style === equippedId)?.querySelector('h3')?.textContent || 'Neon Challenger') + '. This selection is saved to your account.'
      : 'Preview styles freely. Sign in with a paid membership to equip and save one to your account.';
  }

  async function request(action, extra = {}) {
    const response = await fetch(API + '/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, ...extra }),
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'The Style Vault request failed.');
    return data;
  }

  async function load() {
    try { token = localStorage.getItem('token') || ''; } catch { token = ''; }
    if (!token) {
      updateCards();
      paint(styleFromCard(cards[0]));
      showMessage('You can preview every style. Sign in with a paid membership to equip one.');
      return;
    }
    try {
      const data = await request('load');
      isMember = data.premium === true;
      tier = data.tier || 'plus';
      equippedId = data.styleId || 'neon-challenger';
      const selected = cards.find(c => c.dataset.style === equippedId);
      paint(selected ? styleFromCard(selected) : styleFromCard(cards[0]));
      updateCards();
      showMessage('Your saved style is loaded from your account.');
    } catch (error) {
      isMember = false;
      tier = 'free';
      updateCards();
      paint(styleFromCard(cards[0]));
      showMessage(error.message + ' Previews are still available.', true);
    }
  }

  async function equip(card) {
    if (!token || !isMember) {
      showMessage('Sign in with a paid membership to equip and save a style.', true);
      return;
    }
    const id = card.dataset.style;
    try {
      const data = await request('save', { styleId: id });
      equippedId = data.styleId || id;
      tier = data.tier || tier;
      isMember = data.premium === true;
      paint(styleFromCard(card));
      updateCards();
      showMessage(data.style.name + ' is now equipped and saved to your account.');
      window.dispatchEvent(new CustomEvent('rps-vault-style-updated', { detail: { styleId: equippedId } }));
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  cards.forEach(card => {
    card.querySelector('.preview-btn').addEventListener('click', () => {
      paint(styleFromCard(card));
      showMessage('Previewing ' + styleFromCard(card).name + '. Equip it to save it to your account.');
    });
    card.querySelector('.equip-btn').addEventListener('click', () => equip(card));
  });

  $('reset').addEventListener('click', async () => {
    if (!token || !isMember) {
      showMessage('Sign in with a paid membership to equip the default style.', true);
      return;
    }
    try {
      const data = await request('reset');
      equippedId = data.styleId || 'neon-challenger';
      paint(styleFromCard(cards[0]));
      updateCards();
      showMessage('Neon Challenger is equipped as your default style.');
      window.dispatchEvent(new CustomEvent('rps-vault-style-updated', { detail: { styleId: equippedId } }));
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  load();
})();