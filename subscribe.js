(() => {
  const API = 'https://rps-server.heyboernathan.workers.dev';
  const statusEl = document.getElementById('status');
  const subscribe = document.getElementById('subscribe');
  const refresh = document.getElementById('refresh');
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
  async function checkStatus() {
    if (!token()) { say('Log in to your game account first, then return here to subscribe.'); return; }
    try {
      const result = await call('/account/premium');
      if (result.premium) {
        say('Your account already has Premium. Enjoy the game!');
        subscribe.textContent = 'Premium is active';
        subscribe.disabled = true;
      } else {
        say('No active Premium membership was found for this account.');
      }
    } catch (error) { say(error.message); }
  }
  subscribe.addEventListener('click', async () => {
    if (!token()) { say('Please log in to your game account first, then return here.'); return; }
    subscribe.disabled = true;
    say('Connecting securely to Stripe…');
    try {
      const result = await call('/account/stripe-checkout');
      if (!result.url || !/^https:\/\/checkout\.stripe\.com\//.test(result.url)) throw new Error('Stripe did not return a valid checkout link.');
      window.location.assign(result.url);
    } catch (error) {
      say(error.message);
      subscribe.disabled = false;
    }
  });
  refresh.addEventListener('click', checkStatus);
  const params = new URLSearchParams(location.search);
  if (params.get('checkout') === 'success') say('Checkout returned successfully. Checking your Premium status…');
  if (params.get('checkout') === 'cancelled') say('Checkout was cancelled. You have not been charged.');
  checkStatus();
})();