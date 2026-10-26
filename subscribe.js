(() => {
  'use strict';

  const API = 'https://rps-server.heyboernathan.workers.dev';
  const PAYMENT_API = 'https://paymentsystem.heyboernathan.workers.dev';
  const statusEl = document.getElementById('status');
  const subscribe = document.getElementById('subscribe');
  const refresh = document.getElementById('refresh');
  const duoPlan = document.getElementById('pro-plan');
  const familyPlan = document.getElementById('legend-plan');
  const memberManager = document.getElementById('member-manager');
  const memberUsername = document.getElementById('member-username');
  const addMember = document.getElementById('add-member');
  const memberList = document.getElementById('member-list');
  const memberHelp = document.getElementById('member-help');
  const extraSeats = document.getElementById('extra-seats');
  const seatPrice = document.getElementById('seat-price');
  const planButtons = [subscribe, duoPlan, familyPlan].filter(Boolean);
  const plansSection = document.querySelector('.plans');
  const pricingSections = document.querySelectorAll('main > .member-manager[aria-label="Additional account pricing"], main > .trial');
  const BASE_PRICES = { plus: 3.99, pro: 7.99, legend: 14.99 };
  const ANNUAL_BASE_PRICES = { plus: 39.90, pro: 79.90, legend: 149.90 };
  const EXTRA_ACCOUNT_PRICES = { plus: 3, pro: 5, legend: 7 };
  let checkoutBusy = false;
  let hasActiveMembership = false;
  let selectedPlan = 'plus';
  let billingPeriod = 'month';
  const ashtonManager = document.createElement('section');
  ashtonManager.id = 'ashton-plan-manager';
  ashtonManager.hidden = true;
  ashtonManager.style.cssText = 'margin:18px 0;padding:18px;border:1px solid rgba(251,191,36,.45);border-radius:18px;background:linear-gradient(135deg,rgba(20,20,35,.98),rgba(35,26,12,.96));color:#fff;box-shadow:0 14px 35px rgba(0,0,0,.2)';
  const mainEl = document.querySelector('main');
  if (mainEl) mainEl.insertBefore(ashtonManager, plansSection || null);

  async function cancelAshtonSubscriptions() {
    const response = await fetch(PAYMENT_API + '/account/ashton-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not cancel subscriptions.');
    return data;
  }

  function ashtonButton(label, action, danger = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;margin:5px;padding:11px 14px;border-radius:11px;border:1px solid ' + (danger ? '#f87171' : 'rgba(255,255,255,.2)') + ';background:' + (danger ? 'rgba(127,29,29,.8)' : 'rgba(255,255,255,.08)') + ';color:#fff;font:600 13px system-ui;cursor:pointer';
    button.addEventListener('click', async () => {
      if (!token()) { say('Log in to your Ashton account first.'); return; }
      const labelBefore = button.textContent;
      button.disabled = true;
      button.textContent = 'Working…';
      try {
        if (action.kind === 'free') {
          if (!confirm('Cancel every active Stripe subscription for Ashton and set this account to ' + action.label + '?')) return;
          await cancelAshtonSubscriptions();
          await call('/account/ashton-plan', { action: 'choose-free', plan: action.plan });
          say('Ashton is now set to ' + action.label + (action.plan === 'free' ? '.' : ' for free, for life.'));
          await checkStatus();
        } else if (action.kind === 'cancel') {
          if (!confirm('Cancel every active Stripe subscription belonging to Ashton immediately and remove the current membership? This can end paid access right away.')) return;
          const result = await cancelAshtonSubscriptions();
          hasActiveMembership = false;
          say('Cancelled ' + Number(result.cancelled || 0) + ' subscription(s). Ashton can now choose a free plan or start a new paid plan.');
          await checkStatus();
        } else if (action.kind === 'paid') {
          if (!confirm('Cancel any existing Stripe subscriptions for Ashton before starting a new paid ' + action.label + ' checkout?')) return;
          await cancelAshtonSubscriptions();
          hasActiveMembership = false;
          await startCheckout(({ individual: 'plus', duo: 'pro', family: 'legend' })[action.plan] || action.plan);
        }
      } catch (error) {
        say(error.message || 'That plan change failed. Please try again.');
      } finally {
        button.disabled = false;
        button.textContent = labelBefore;
      }
    });
    return button;
  }

  async function refreshAshtonManager() {
    if (!token()) { ashtonManager.hidden = true; return false; }
    try {
      const info = await call('/account/ashton-plan', { action: 'status' });
      if (String(info.username || '').trim().toLowerCase() !== 'ashton') { ashtonManager.hidden = true; return false; }
      ashtonManager.hidden = false;
      ashtonManager.textContent = '';
      const title = document.createElement('h2');
      title.textContent = 'Ashton · Plan Control';
      title.style.cssText = 'margin:0 0 8px;font-size:20px';
      const current = document.createElement('p');
      const currentName = ({ free: 'Free', individual: 'Plus', duo: 'Pro', family: 'Legend' })[info.plan] || 'Free';
      current.textContent = 'Current plan: ' + currentName + (info.lifetime ? ' · free for life' : '') + '. This private control only works for the Ashton account.';
      current.style.cssText = 'margin:0 0 12px;color:rgba(255,255,255,.78);font-size:13px;line-height:1.5';
      const cancelTitle = document.createElement('h3');
      cancelTitle.textContent = 'Subscriptions';
      cancelTitle.style.cssText = 'margin:12px 0 5px;font-size:15px';
      const cancelHelp = document.createElement('p');
      cancelHelp.textContent = 'Cancel all active Stripe subscriptions immediately and reset the account to Free before choosing another plan.';
      cancelHelp.style.cssText = 'margin:0 0 8px;color:rgba(255,255,255,.65);font-size:12px';
      ashtonManager.append(title, current, cancelTitle, cancelHelp, ashtonButton('Cancel all subscriptions', { kind: 'cancel' }, true));
      const freeTitle = document.createElement('h3');
      freeTitle.textContent = 'Choose a plan for free';
      freeTitle.style.cssText = 'margin:12px 0 5px;font-size:15px';
      ashtonManager.append(freeTitle,
        ashtonButton('Free · no membership', { kind: 'free', plan: 'free', label: 'Free' }),
        ashtonButton('Plus · free for life', { kind: 'free', plan: 'individual', label: 'Plus' }),
        ashtonButton('Pro · free for life', { kind: 'free', plan: 'duo', label: 'Pro' }),
        ashtonButton('Legend · free for life', { kind: 'free', plan: 'family', label: 'Legend' }));
      const paidTitle = document.createElement('h3');
      paidTitle.textContent = 'Choose a paid plan';
      paidTitle.style.cssText = 'margin:12px 0 5px;font-size:15px';
      const paidHelp = document.createElement('p');
      paidHelp.textContent = 'Paid options open the normal secure Stripe checkout. Existing Ashton subscriptions are cancelled first to avoid overlapping plans.';
      paidHelp.style.cssText = 'margin:0 0 8px;color:rgba(255,255,255,.65);font-size:12px';
      ashtonManager.append(paidTitle, paidHelp,
        ashtonButton('Pay for Plus', { kind: 'paid', plan: 'plus', label: 'Plus' }),
        ashtonButton('Pay for Pro', { kind: 'paid', plan: 'pro', label: 'Pro' }),
        ashtonButton('Pay for Legend', { kind: 'paid', plan: 'legend', label: 'Legend' }));
      return true;
    } catch (error) {
      ashtonManager.hidden = true;
      return false;
    }
  }


  const money = value => '$' + value.toFixed(2) + ' CAD/' + (billingPeriod === 'year' ? 'year' : 'month');
  const token = () => {
    try { return localStorage.getItem('token'); } catch { return null; }
  };
  const say = message => {
    if (statusEl) statusEl.textContent = message;
  };
  const planName = plan => ({ individual: 'Plus', premium: 'Plus', duo: 'Pro', ultra: 'Pro', family: 'Legend', 'ultra plus': 'Legend' }[String(plan || '').trim().toLowerCase()] || 'Plus');

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
    const currentPlan = planName(result.plan || result.premiumPlan || (result.source === 'group' ? result.groupPlan : 'individual'));
    let message;
    if (result.plan === 'family') {
      message = result.lifetime
        ? 'You have Legend for life — no expiry. It includes everything in Pro and Plus, plus all Legend features. Plan purchase buttons are locked while your membership is active.'
        : 'You have Legend! It includes everything in Pro and Plus, plus all Legend features. Plan purchase buttons are locked while your membership is active.';
    } else if (result.plan === 'duo') {
      message = 'You have Pro! It includes everything in Plus, plus all Pro features. Plan purchase buttons are locked while your membership is active.';
    } else {
      message = 'You have Plus! Your Plus membership is active. Plan purchase buttons are locked while your membership is active.';
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
    selectedPlan = Object.prototype.hasOwnProperty.call(BASE_PRICES, plan) ? plan : 'plus';
    if (!seatPrice) return;
    const count = getExtraSeatCount();
    const perAccount = EXTRA_ACCOUNT_PRICES[selectedPlan];
    const total = (billingPeriod === 'year' ? ANNUAL_BASE_PRICES[selectedPlan] : BASE_PRICES[selectedPlan]) + count * perAccount * (billingPeriod === 'year' ? 12 : 1);
    seatPrice.textContent = 'Estimated total: ' + money(total) +
      ' (' + count + ' extra account' + (count === 1 ? '' : 's') +
      ' at $' + (perAccount * (billingPeriod === 'year' ? 12 : 1)).toFixed(2) + ' each per ' + (billingPeriod === 'year' ? 'year' : 'month') + ').';
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
      if (ashtonManager) ashtonManager.hidden = true;
      if (plansSection) plansSection.hidden = false;
      pricingSections.forEach(section => { section.hidden = false; });
      planButtons.forEach(button => { button.disabled = false; });
      say('Log in to your game account first, then return here to subscribe.');
      return;
    }
    try {
      const result = await call('/account/premium');
      await refreshAshtonManager();
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
          ? 'Stripe returned successfully. Your selected plan activates after the signed webhook confirms your subscription; check again in a few seconds.'
          : checkout === 'cancelled'
            ? 'Checkout was cancelled. You have not been charged.'
            : 'No active paid membership was found for this account.');
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
    say('Connecting securely to Stripe…');
    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(PAYMENT_API + '/account/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ token: token(), plan, extraAccounts: requestedExtraSeats, billingPeriod })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not start checkout. Please try again.');
      if (!result.url || !/^https:\/\/checkout\.stripe\.com\//.test(result.url)) {
        throw new Error('Stripe did not return a valid checkout link.');
      }
      window.location.assign(result.url);
    } catch (error) {
      const message = error.name === 'AbortError'
        ? 'Checkout took too long. Please try again.'
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
  if (subscribe) subscribe.onclick = event => { event.preventDefault(); startCheckout('plus'); };
  if (duoPlan) duoPlan.onclick = event => { event.preventDefault(); startCheckout('pro'); };
  if (familyPlan) familyPlan.onclick = event => { event.preventDefault(); startCheckout('legend'); };

  // Make script/runtime failures visible instead of leaving the page appearing inert.
  window.addEventListener('error', event => {
    if (event && event.message) say('Page script error: ' + event.message.slice(0, 160));
  });

  if (extraSeats) extraSeats.addEventListener('input', () => updateSeatEstimate());

  function setBillingPeriod(period) {
    billingPeriod = period === 'year' ? 'year' : 'month';
    const monthlyButton = document.getElementById('billing-monthly');
    const annualButton = document.getElementById('billing-annual');
    if (monthlyButton) { monthlyButton.setAttribute('aria-pressed', String(billingPeriod === 'month')); monthlyButton.classList.toggle('selected', billingPeriod === 'month'); }
    if (annualButton) { annualButton.setAttribute('aria-pressed', String(billingPeriod === 'year')); annualButton.classList.toggle('selected', billingPeriod === 'year'); }
    const prices = { plus: billingPeriod === 'year' ? 39.90 : 3.99, pro: billingPeriod === 'year' ? 79.90 : 7.99, legend: billingPeriod === 'year' ? 149.90 : 14.99 };
    document.querySelectorAll('[data-plan-price]').forEach(el => {
      const plan = el.getAttribute('data-plan-price');
      if (prices[plan] !== undefined) el.innerHTML = '$' + prices[plan].toFixed(2) + ' <small>CAD / ' + (billingPeriod === 'year' ? 'year' : 'month') + '</small>';
    });
    const trial = document.querySelector('.trial');
    if (trial) trial.innerHTML = billingPeriod === 'year'
      ? '<strong>Annual billing selected</strong><br><span>Annual plans are charged once per year and save 16.7% versus monthly billing. Plus and Pro include a 7-day trial. Extra accounts are billed annually at a discounted rate.</span>'
      : '<strong>7-day free trial with Plus and Pro</strong><br><span>Plus and Pro include a 7-day free trial. Legend has no trial. Every paid plan includes one account. Extra accounts cost $3/month on Plus, $5/month on Pro, and $7/month on Legend.</span>';
    updateSeatEstimate();
  }
  const monthlyBillingButton = document.getElementById('billing-monthly');
  const annualBillingButton = document.getElementById('billing-annual');
  if (monthlyBillingButton) monthlyBillingButton.addEventListener('click', () => setBillingPeriod('month'));
  if (annualBillingButton) annualBillingButton.addEventListener('click', () => setBillingPeriod('year'));


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
  if (params.get('checkout') === 'success') say('Checkout returned successfully. Checking your Plus status…');
  if (params.get('checkout') === 'cancelled') say('Checkout was cancelled. You have not been charged.');
  updateSeatEstimate('plus');
  checkStatus();
})();