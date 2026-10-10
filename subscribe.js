(() => {
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
  const planButtons = [subscribe, duoPlan, familyPlan];
  let checkoutBusy = false;
  let selectedPlan = 'individual';
  const extraSeats = document.getElementById('extra-seats');
  const seatPrice = document.getElementById('seat-price');
  const BASE_PRICES = { individual: 9.99, duo: 14.99, family: 31.99 };
  const money = value => '
  const token = () => { try { return localStorage.getItem('token'); } catch { return null; } };
  const say = (message) => { statusEl.textContent = message; };
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
  async function refreshMembers() {
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
              say(member.username + ' was removed from your Premium plan.');
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
      const count = result.members.length + 1;
      memberHelp.textContent += ' ' + count + ' of ' + totalLimit + ' total accounts currently on your plan.';
    } catch (error) {
      say(error.message);
    }
  }
  async function checkStatus() {
    if (!token()) {
      memberManager.hidden = true;
      say('Log in to your game account first, then return here to subscribe.');
      return;
    }
    try {
      const result = await call('/account/premium');
      if (result.premium) {
        // Keep plan choices tappable on mobile. The Worker remains the authority
        // for whether an account can start or change a subscription.
        planButtons.forEach((button) => { button.disabled = false; });
        subscribe.textContent = 'Start 7-day free trial';
        duoPlan.textContent = 'Choose Ultra';
        familyPlan.textContent = 'Choose Ultra Plus';
        if (result.canManageMembers) {
          memberManager.hidden = false;
          say('Your ' + (result.plan === 'duo' ? 'Ultra' : 'Ultra Plus') + ' plan is active. Manage members below.');
          await refreshMembers();
        } else {
          memberManager.hidden = true;
          say(result.source === 'group'
            ? 'Your Premium access is included in a ' + (result.plan || 'group') + ' plan.'
            : 'Your account already has Premium. Enjoy the game!');
        }
      } else {
        planButtons.forEach((button) => { button.disabled = false; });
        memberManager.hidden = true;
        const checkout = new URLSearchParams(location.search).get('checkout');
        say(checkout === 'success'
          ? 'Stripe returned successfully. Premium activates after the signed webhook confirms your subscription; check again in a few seconds.'
          : checkout === 'cancelled'
            ? 'Checkout was cancelled. You have not been charged.'
            : 'No active Premium membership was found for this account.');
      }
    } catch (error) { say(error.message); }
  }
  async function startCheckout(plan, button) {
    updateSeatEstimate(plan);
    const requestedExtraSeats = extraSeats ? Number(extraSeats.value) || 0 : 0;
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
    planButtons.forEach((item) => { item.disabled = true; });
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
      planButtons.forEach((item) => { item.disabled = false; });
    }
  }
  subscribe.addEventListener('click', () => startCheckout('individual', subscribe));
  duoPlan.addEventListener('click', () => startCheckout('duo', duoPlan));
  familyPlan.addEventListener('click', () => startCheckout('family', familyPlan));
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
      say(username + ' was added to your Premium plan.');
      await refreshMembers();
    } catch (error) {
      say(error.message);
    } finally {
      addMember.disabled = false;
    }
  });
  memberUsername.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addMember.click();
  });
  refresh.addEventListener('click', checkStatus);
  const params = new URLSearchParams(location.search);
  if (params.get('checkout') === 'success') say('Checkout returned successfully. Checking your Premium status…');
  if (params.get('checkout') === 'cancelled') say('Checkout was cancelled. You have not been charged.');
  checkStatus();
})(); + value.toFixed(2) + ' CAD/month';
  function updateSeatEstimate(plan = selectedPlan) {
    selectedPlan = plan;
    if (!extraSeats || !seatPrice) return;
    const raw = Number(extraSeats.value);
    const count = Number.isFinite(raw) ? Math.max(0, Math.min(99, Math.floor(raw))) : 0;
    extraSeats.value = String(count);
    seatPrice.textContent = 'Estimated total: ' + money(BASE_PRICES[plan] + count * 3) + ' (' + count + ' extra account' + (count === 1 ? '' : 's') + ').';
  }
  if (extraSeats) extraSeats.addEventListener('input', () => updateSeatEstimate());
  updateSeatEstimate();
  const token = () => { try { return localStorage.getItem('token'); } catch { return null; } };
  const say = (message) => { statusEl.textContent = message; };
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
  async function refreshMembers() {
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
              say(member.username + ' was removed from your Premium plan.');
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
      const count = result.members.length + 1;
      memberHelp.textContent += ' ' + count + ' of ' + totalLimit + ' total accounts currently on your plan.';
    } catch (error) {
      say(error.message);
    }
  }
  async function checkStatus() {
    if (!token()) {
      memberManager.hidden = true;
      say('Log in to your game account first, then return here to subscribe.');
      return;
    }
    try {
      const result = await call('/account/premium');
      if (result.premium) {
        // Keep plan choices tappable on mobile. The Worker remains the authority
        // for whether an account can start or change a subscription.
        planButtons.forEach((button) => { button.disabled = false; });
        subscribe.textContent = 'Start 7-day free trial';
        duoPlan.textContent = 'Choose Ultra';
        familyPlan.textContent = 'Choose Ultra Plus';
        if (result.canManageMembers) {
          memberManager.hidden = false;
          say('Your ' + (result.plan === 'duo' ? 'Ultra' : 'Ultra Plus') + ' plan is active. Manage members below.');
          await refreshMembers();
        } else {
          memberManager.hidden = true;
          say(result.source === 'group'
            ? 'Your Premium access is included in a ' + (result.plan || 'group') + ' plan.'
            : 'Your account already has Premium. Enjoy the game!');
        }
      } else {
        planButtons.forEach((button) => { button.disabled = false; });
        memberManager.hidden = true;
        const checkout = new URLSearchParams(location.search).get('checkout');
        say(checkout === 'success'
          ? 'Stripe returned successfully. Premium activates after the signed webhook confirms your subscription; check again in a few seconds.'
          : checkout === 'cancelled'
            ? 'Checkout was cancelled. You have not been charged.'
            : 'No active Premium membership was found for this account.');
      }
    } catch (error) { say(error.message); }
  }
  async function startCheckout(plan, button) {
    if (!token()) {
      say('Please log in to your game account first, then return here.');
      return;
    }
    if (checkoutBusy) return;
    checkoutBusy = true;
    planButtons.forEach((item) => { item.disabled = true; });
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
      planButtons.forEach((item) => { item.disabled = false; });
    }
  }
  subscribe.addEventListener('click', () => startCheckout('individual', subscribe));
  duoPlan.addEventListener('click', () => startCheckout('duo', duoPlan));
  familyPlan.addEventListener('click', () => startCheckout('family', familyPlan));
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
      say(username + ' was added to your Premium plan.');
      await refreshMembers();
    } catch (error) {
      say(error.message);
    } finally {
      addMember.disabled = false;
    }
  });
  memberUsername.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addMember.click();
  });
  refresh.addEventListener('click', checkStatus);
  const params = new URLSearchParams(location.search);
  if (params.get('checkout') === 'success') say('Checkout returned successfully. Checking your Premium status…');
  if (params.get('checkout') === 'cancelled') say('Checkout was cancelled. You have not been charged.');
  checkStatus();
})();