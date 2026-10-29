(() => {
  'use strict';
  const API = 'https://rps-server.heyboernathan.workers.dev';
  const $ = id => document.getElementById(id);
  const status = $('dice-account-status');
  const friendsArea = $('dice-friends-area');
  const friendsList = $('dice-friends-list');
  const link = $('dice-account-link');
  const account = { token: null, user: null, profile: null, friends: [], ready: false };
  window.diceAccount = account;

  function say(message) { if (status) status.textContent = message; }
  async function post(path, body = {}) {
    const response = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, token: account.token })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not load your account.');
    return data;
  }

  function showFriends(friends) {
    if (!friendsArea || !friendsList) return;
    friendsArea.hidden = false;
    friendsList.replaceChildren();
    if (!friends.length) {
      friendsList.textContent = 'No friends added yet. Add friends from your main game profile.';
      return;
    }
    friends.forEach(friend => {
      const row = document.createElement('span');
      row.textContent = friend.name + (friend.online ? ' · Online' : '');
      row.style.cssText = 'display:inline-block;margin:4px;padding:8px 12px;border:1px solid var(--line);border-radius:20px;background:#17223a';
      friendsList.append(row);
    });
  }

  async function init() {
    try { account.token = localStorage.getItem('token') || ''; } catch (_) {}
    if (!account.token) {
      say('You are not logged in. Sign in on the main game to use your account and online features.');
      link.textContent = 'Sign in / Create account';
      link.href = '/';
      return;
    }
    try {
      const meResponse = await fetch(API + '/me?token=' + encodeURIComponent(account.token), { cache: 'no-store' });
      const me = await meResponse.json().catch(() => ({}));
      if (!meResponse.ok || !me.user) throw new Error('Your login expired. Sign in again on the main game.');
      account.user = me.user;
      account.profile = await post('/account/profile');
      const friends = await post('/account/friends');
      account.friends = Array.isArray(friends.friends) ? friends.friends : [];
      account.ready = true;
      say('Signed in as ' + account.user.name + ' · Your main game account is connected.');
      link.textContent = 'Profile: ' + account.user.name;
      link.href = '/?openProfile=1';
      showFriends(account.friends);
      window.dispatchEvent(new CustomEvent('dice-account-ready', { detail: { name: account.user.name } }));
    } catch (error) {
      account.ready = false;
      say(error.message || 'Could not connect to your account.');
      link.textContent = 'Sign in again';
      link.href = '/';
    }
  }

  window.addEventListener('storage', event => {
    if (event.key === 'token') location.reload();
  });
  init();
})();