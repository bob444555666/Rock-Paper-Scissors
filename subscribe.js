(() => {
  'use strict';

  const API = 'https://rps-server.heyboernathan.workers.dev';
  const PAYMENT_API = 'https://paymentsystem.heyboernathan.workers.dev';
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
  const promoCodeInput = document.getElementById('promo-code');
  const planButtons = [subscribe, duoPlan, familyPlan].filter(Boolean);
  const plansSection = document.querySelector('.plans');
  const pricingSections = document.querySelectorAll('main > .member-manager[aria-label="Additional account pricing"], main > .member-manager[aria-label="Promo code"], main > .trial');
  const BASE_PRICES = { individual: 9.99, duo: 14.99, family: 31.99 };
  const EXTRA_ACCOUNT_PRICES = { individual: 3, duo: 5, family: 7 };
  let checkoutBusy = false;
  let hasActiveMembership = false;
  let selectedPlan = 'individual';

  const money = value => '$' + value.toFixed(2) + ' CAD/month';
  const token = () => {
    try { return localStorage.getItem('token'); } catch { return null; }
  };
  const say = message => {
    if (statusEl) statusEl.textContent = message;
  };
  const planName = plan => ({ individual: 'Premium', duo: 'Ultra', family: 'Ultra Plus' }[plan] || 'Premium');

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

  async function showActivePlan(result) {
    hasActiveMembership = true;
    if (plansSection) plansSection.hidden = true;
    pricingSections.forEach(section => { section.hidden = true; });
    planButtons.forEach(button => { button.disabled = true; });
    if (subscribe) subscribe.textContent = 'Membership already active';
    if (duoPlan) duoPlan.textContent = 'Membership already active';
    if (familyPlan) familyPlan.textContent = 'Membership already active';
    const currentPlan = planName(result.plan);
    let message;
    if (result.plan === 'family') {
      message = 'You have Ultra Plus! It includes everything in Ultra and Premium, plus all Ultra Plus features. Plan purchase buttons are locked while your membership is active.';
    } else if (result.plan === 'duo') {
      message = 'You have Ultra! It includes everything in Premium, plus all Ultra features. Plan purchase buttons are locked while your membership is active.';
    } else {
      message = 'You have Premium! Your Premium membership is active. Plan purchase buttons are locked while your membership is active.';
    }
    if (result.source === 'group') message = 'Your access is included in a ' + currentPlan + ' membership. ' + message;
    if (result.canManageMembers && memberManager) {
      memberManager.hidden = false;
      say(message + ' You can manage your extra accounts below.');
      await refreshMembers();
    } else {
      if (memberManager) memberManager.hidden = true;
      say(message);
    }
  }

  function updateSeatEstimate(plan = selectedPlan) {
    selectedPlan = Object.prototype.hasOwnProperty.call(BASE_PRICES, plan) ? plan : 'individual';
    if (!seatPrice) return;
    const count = getExtraSeatCount();
    const perAccount = EXTRA_ACCOUNT_PRICES[selectedPlan];
    const total = BASE_PRICES[selectedPlan] + count * perAccount;
    seatPrice.textContent = 'Estimated total: ' + money(total) +
      ' (' + count + ' extra account' + (count === 1 ? '' : 's') +
      ' at $' + perAccount.toFixed(2) + ' each).';
  }

  function getExtraSeatCount() {
    if (!extraSeats) return 0;
    const value = Number(extraSeats.value);
    const count = Number.isFinite(value) ? Math.max(0, Math.min(99, Math.floor(value))) : 0;
    extraSeats.value = String(count);
    return count;
  }

  async function refreshMembers() {
    if (!memberList || !memberHelp) return;
    try {
      const result = await call('/account/premium-members');
      memberList.replaceChildren();
      const totalLimit = 1 + Number(result.memberLimit || 0);
      memberHelp.textContent = 'Your ' + planName(result.plan) + ' plan includes one account plus ' + Number(result.memberLimit || 0) + ' paid extra account(s). Add existing game accounts by username.';
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
      hasActiveMembership = false;
      if (memberManager) memberManager.hidden = true;
      if (plansSection) plansSection.hidden = false;
      pricingSections.forEach(section => { section.hidden = false; });
      planButtons.forEach(button => { button.disabled = false; });
      say('Log in to your game account first, then return here to subscribe.');
      return;
    }
    try {
      const result = await call('/account/premium');
      if (result.premium) {
        await showActivePlan(result);
      } else {
        hasActiveMembership = false;
        if (plansSection) plansSection.hidden = false;
        pricingSections.forEach(section => { section.hidden = false; });
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
    if (hasActiveMembership) {
      say('You already have an active membership. Plan checkout is locked while it is active.');
      return;
    }
    updateSeatEstimate(plan);
    const requestedExtraSeats = getExtraSeatCount();
    if (!token()) {
      say('Please log in to your game account first, then return here.');
      return;
    }
    if (checkoutBusy) return;
    checkoutBusy = true;
    planButtons.forEach(button => { button.disabled = true; });
    const enteredPromo = promoCodeInput ? promoCodeInput.value.trim() : '';
    say(enteredPromo
      ? 'Checking promo code and connecting securely to Stripe…'
      : 'Connecting securely to Stripe…');
    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(PAYMENT_API + '/account/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ token: token(), plan, extraAccounts: requestedExtraSeats, promoCode: enteredPromo })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not start checkout. Please try again.');
      if (!result.url || !/^https:\/\/checkout\.stripe\.com\//.test(result.url)) {
        throw new Error('Stripe did not return a valid checkout link.');
      }
      window.location.assign(result.url);
    } catch (error) {
      const message = error.name === 'AbortError'
        ? 'Checkout took too long. You can try again; promo codes can be submitted repeatedly.'
        : (error.message || 'Checkout failed. You can try again.');
      say(message);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      checkoutBusy = false;
      if (!hasActiveMembership) planButtons.forEach(button => { button.disabled = false; });
    }
  }

  // Assign direct handlers so plan buttons remain clickable even if another script
  // has attached unrelated listeners to the page.
  if (subscribe) subscribe.onclick = event => { event.preventDefault(); startCheckout('individual'); };
  if (duoPlan) duoPlan.onclick = event => { event.preventDefault(); startCheckout('duo'); };
  if (familyPlan) familyPlan.onclick = event => { event.preventDefault(); startCheckout('family'); };

  // Make script/runtime failures visible instead of leaving the page appearing inert.
  window.addEventListener('error', event => {
    if (event && event.message) say('Page script error: ' + event.message.slice(0, 160));
  });
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