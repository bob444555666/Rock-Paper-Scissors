(() => {
  'use strict';

  const API = 'https://rps-server.heyboernathan.workers.dev';
  const statusEl = document.getElementById('status');
  const subscribe = document.getElementById('subscribe');
  const refresh = document.getElementById('refresh');
  const duoPlan = document.getElementById('duo-plan');
  const familyPlan = document.getElementById('family-plan');
  const memberManager = document.getElementById('member-manager');
  const memberUsername = document.getElementById('member-username');
  const addMember = document.getElementById('add-member');
  const memberList = document.getElementById('member-list');
  const memberHelp = document.getElementById('member-help');
  const extraSeats = document.getElementById('extra-seats');
  const seatPrice = document.getElementById('seat-price');
  const planButtons = [subscribe, duoPlan, familyPlan].filter(Boolean);
  const BASE_PRICES = { individual: 9.99, duo: 14.99, family: 31.99 };
  const EXTRA_ACCOUNT_PRICES = { individual: 3, duo: 5, family: 7 };
  let checkoutBusy = false;
  let selectedPlan = 'individual';

  const money = value => '$' + value.toFixed(2) + ' CAD/month';
  const token = () => {
    try { return localStorage.getItem('token'); } catch { return null; }
  };
  const say = message => {
    if (statusEl) statusEl.textContent = message;
  };

  async function call(path, body = {}) {
    const res = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, token: token() })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed. Please try again.');
    return data;
  }

  function getExtraSeatCount() {
    if (!extraSeats) return 0;
    const value = Number(extraSeats.value);
    const count = Number.isFinite(value) ? Math.max(0, Math.min(99, Math.floor(value))) : 0;
    extraSeats.value = String(count);
    return count;
  }

  function updateSeatEstimate(plan = selectedPlan) {
    selectedPlan = BASE_PRICES[plan] === undefined ? 'individual' : plan;
    if (!seatPrice) return;
    const count = getExtraSeatCount();
    const perAccount = EXTRA_ACCOUNT_PRICES[selectedPlan];
    const total = BASE_PRICES[selectedPlan] + count * perAccount;
    seatPrice.textContent = 'Estimated total: ' + money(total) +
      ' (' + count + ' extra account' + (count === 1 ? '' : 's') + ' at 
  }

  async function refreshMembers() {
    if (!memberList || !memberHelp) return;
    try {
      const result = await call('/account/premium-members');
      memberList.replaceChildren();
      const totalLimit = result.plan === 'duo' ? 2 : 10;
      memberHelp.textContent = result.plan === 'duo'
        ? 'Ultra includes you plus one member. Add an existing game account by username.'
        : 'Ultra Plus includes you plus up to nine members. Add existing game accounts by username.';
      if (!result.members.length) {
        const empty = document.createElement('li');
        empty.textContent = 'No members added yet.';
        memberList.appendChild(empty);
      } else {
        for (const member of result.members) {
          const item = document.createElement('li');
          const name = document.createElement('span');
          name.textContent = member.username;
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'remove-member';
          remove.textContent = 'Remove';
          remove.addEventListener('click', async () => {
            remove.disabled = true;
            try {
              await call('/account/premium-invite', { username: member.username, action: 'remove' });
              say(member.username + ' was removed from your plan.');
              await refreshMembers();
            } catch (error) {
              say(error.message);
              remove.disabled = false;
            }
          });
          item.append(name, remove);
          memberList.appendChild(item);
        }
      }
      memberHelp.textContent += ' ' + (result.members.length + 1) + ' of ' + totalLimit +
        ' total accounts currently on your plan.';
    } catch (error) {
      say(error.message);
    }
  }

  async function checkStatus() {
    if (!token()) {
      if (memberManager) memberManager.hidden = true;
      say('Log in to your game account first, then return here to subscribe.');
      return;
    }
    try {
      const result = await call('/account/premium');
      if (result.premium) {
        planButtons.forEach(button => { button.disabled = false; });
        if (subscribe) subscribe.textContent = 'Start 7-day free trial';
        if (duoPlan) duoPlan.textContent = 'Choose Ultra';
        if (familyPlan) familyPlan.textContent = 'Choose Ultra Plus';
        if (result.canManageMembers && memberManager) {
          memberManager.hidden = false;
          say('Your ' + (result.plan === 'duo' ? 'Ultra' : 'Ultra Plus') +
            ' plan is active. Manage members below.');
          await refreshMembers();
        } else {
          if (memberManager) memberManager.hidden = true;
          say(result.source === 'group'
            ? 'Your Premium access is included in a ' + (result.plan || 'group') + ' plan.'
            : 'Your account already has Premium. Enjoy the game!');
        }
      } else {
        planButtons.forEach(button => { button.disabled = false; });
        if (memberManager) memberManager.hidden = true;
        const checkout = new URLSearchParams(location.search).get('checkout');
        say(checkout === 'success'
          ? 'Stripe returned successfully. Premium activates after the signed webhook confirms your subscription; check again in a few seconds.'
          : checkout === 'cancelled'
            ? 'Checkout was cancelled. You have not been charged.'
            : 'No active Premium membership was found for this account.');
      }
    } catch (error) {
      say(error.message);
    }
  }

  async function startCheckout(plan) {
    updateSeatEstimate(plan);
    const requestedExtraSeats = getExtraSeatCount();
    if (requestedExtraSeats > 0) {
      say('Extra-account checkout is not enabled on the subscription server yet. Set extra accounts to 0 so you are not charged the wrong amount. Rates shown: Premium $3, Ultra $5, Ultra Plus $7 CAD per extra account monthly.');
      return;
    }
    if (!token()) {
      say('Please log in to your game account first, then return here.');
      return;
    }
    if (checkoutBusy) return;
    checkoutBusy = true;
    planButtons.forEach(button => { button.disabled = true; });
    say('Connecting securely to Stripe…');
    try {
      const result = await call('/account/stripe-checkout', { plan });
      if (!result.url || !/^https:\/\/checkout\.stripe\.com\//.test(result.url)) {
        throw new Error('Stripe did not return a valid checkout link.');
      }
      window.location.assign(result.url);
    } catch (error) {
      say(error.message);
      checkoutBusy = false;
      planButtons.forEach(button => { button.disabled = false; });
    }
  }

  if (subscribe) subscribe.addEventListener('click', () => startCheckout('individual'));
  if (duoPlan) duoPlan.addEventListener('click', () => startCheckout('duo'));
  if (familyPlan) familyPlan.addEventListener('click', () => startCheckout('family'));
  if (extraSeats) extraSeats.addEventListener('input', () => updateSeatEstimate());

  if (addMember && memberUsername) {
    addMember.addEventListener('click', async () => {
      const username = memberUsername.value.trim();
      if (!username) {
        say('Enter the username of the account you want to add.');
        memberUsername.focus();
        return;
      }
      addMember.disabled = true;
      try {
        await call('/account/premium-invite', { username });
        memberUsername.value = '';
        say(username + ' was added to your plan.');
        await refreshMembers();
      } catch (error) {
        say(error.message);
      } finally {
        addMember.disabled = false;
      }
    });
    memberUsername.addEventListener('keydown', event => {
      if (event.key === 'Enter') addMember.click();
    });
  }

  if (refresh) refresh.addEventListener('click', checkStatus);
  const params = new URLSearchParams(location.search);
  if (params.get('checkout') === 'success') say('Checkout returned successfully. Checking your Premium status…');
  if (params.get('checkout') === 'cancelled') say('Checkout was cancelled. You have not been charged.');
  updateSeatEstimate('individual');
  checkStatus();
})();
 + perAccount.toFixed(2) + ' each).';
  }

  async function refreshMembers() {
    if (!memberList || !memberHelp) return;
    try {
      const result = await call('/account/premium-members');
      memberList.replaceChildren();
      const totalLimit = result.plan === 'duo' ? 2 : 10;
      memberHelp.textContent = result.plan === 'duo'
        ? 'Ultra includes you plus one member. Add an existing game account by username.'
        : 'Ultra Plus includes you plus up to nine members. Add existing game accounts by username.';
      if (!result.members.length) {
        const empty = document.createElement('li');
        empty.textContent = 'No members added yet.';
        memberList.appendChild(empty);
      } else {
        for (const member of result.members) {
          const item = document.createElement('li');
          const name = document.createElement('span');
          name.textContent = member.username;
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'remove-member';
          remove.textContent = 'Remove';
          remove.addEventListener('click', async () => {
            remove.disabled = true;
            try {
              await call('/account/premium-invite', { username: member.username, action: 'remove' });
              say(member.username + ' was removed from your plan.');
              await refreshMembers();
            } catch (error) {
              say(error.message);
              remove.disabled = false;
            }
          });
          item.append(name, remove);
          memberList.appendChild(item);
        }
      }
      memberHelp.textContent += ' ' + (result.members.length + 1) + ' of ' + totalLimit +
        ' total accounts currently on your plan.';
    } catch (error) {
      say(error.message);
    }
  }

  async function checkStatus() {
    if (!token()) {
      if (memberManager) memberManager.hidden = true;
      say('Log in to your game account first, then return here to subscribe.');
      return;
    }
    try {
      const result = await call('/account/premium');
      if (result.premium) {
        planButtons.forEach(button => { button.disabled = false; });
        if (subscribe) subscribe.textContent = 'Start 7-day free trial';
        if (duoPlan) duoPlan.textContent = 'Choose Ultra';
        if (familyPlan) familyPlan.textContent = 'Choose Ultra Plus';
        if (result.canManageMembers && memberManager) {
          memberManager.hidden = false;
          say('Your ' + (result.plan === 'duo' ? 'Ultra' : 'Ultra Plus') +
            ' plan is active. Manage members below.');
          await refreshMembers();
        } else {
          if (memberManager) memberManager.hidden = true;
          say(result.source === 'group'
            ? 'Your Premium access is included in a ' + (result.plan || 'group') + ' plan.'
            : 'Your account already has Premium. Enjoy the game!');
        }
      } else {
        planButtons.forEach(button => { button.disabled = false; });
        if (memberManager) memberManager.hidden = true;
        const checkout = new URLSearchParams(location.search).get('checkout');
        say(checkout === 'success'
          ? 'Stripe returned successfully. Premium activates after the signed webhook confirms your subscription; check again in a few seconds.'
          : checkout === 'cancelled'
            ? 'Checkout was cancelled. You have not been charged.'
            : 'No active Premium membership was found for this account.');
      }
    } catch (error) {
      say(error.message);
    }
  }

  async function startCheckout(plan) {
    updateSeatEstimate(plan);
    const requestedExtraSeats = getExtraSeatCount();
    if (requestedExtraSeats > 0) {
      say('Extra-account checkout is not enabled on the subscription server yet. Set extra accounts to 0 so you are not charged the wrong amount.');
      return;
    }
    if (!token()) {
      say('Please log in to your game account first, then return here.');
      return;
    }
    if (checkoutBusy) return;
    checkoutBusy = true;
    planButtons.forEach(button => { button.disabled = true; });
    say('Connecting securely to Stripe…');
    try {
      const result = await call('/account/stripe-checkout', { plan });
      if (!result.url || !/^https:\/\/checkout\.stripe\.com\//.test(result.url)) {
        throw new Error('Stripe did not return a valid checkout link.');
      }
      window.location.assign(result.url);
    } catch (error) {
      say(error.message);
      checkoutBusy = false;
      planButtons.forEach(button => { button.disabled = false; });
    }
  }

  if (subscribe) subscribe.addEventListener('click', () => startCheckout('individual'));
  if (duoPlan) duoPlan.addEventListener('click', () => startCheckout('duo'));
  if (familyPlan) familyPlan.addEventListener('click', () => startCheckout('family'));
  if (extraSeats) extraSeats.addEventListener('input', () => updateSeatEstimate());

  if (addMember && memberUsername) {
    addMember.addEventListener('click', async () => {
      const username = memberUsername.value.trim();
      if (!username) {
        say('Enter the username of the account you want to add.');
        memberUsername.focus();
        return;
      }
      addMember.disabled = true;
      try {
        await call('/account/premium-invite', { username });
        memberUsername.value = '';
        say(username + ' was added to your plan.');
        await refreshMembers();
      } catch (error) {
        say(error.message);
      } finally {
        addMember.disabled = false;
      }
    });
    memberUsername.addEventListener('keydown', event => {
      if (event.key === 'Enter') addMember.click();
    });
  }

  if (refresh) refresh.addEventListener('click', checkStatus);
  const params = new URLSearchParams(location.search);
  if (params.get('checkout') === 'success') say('Checkout returned successfully. Checking your Premium status…');
  if (params.get('checkout') === 'cancelled') say('Checkout was cancelled. You have not been charged.');
  updateSeatEstimate('individual');
  checkStatus();
})();
