# Stripe Premium setup

The subscription integration is implemented in the Cloudflare Worker and the game repository.

## Plan configured in code
- Product: Rock Paper Scissors Premium
- Price: CAD $9.99 every month
- Trial: 7 days
- Checkout: Stripe Checkout (hosted)
- Worker checkout route: `POST /account/stripe-checkout`
- Worker webhook route: `POST /stripe/webhook`

## Finish setup in Stripe and Cloudflare

1. In Stripe, switch to **Test mode** first. Use your Stripe Dashboard at https://dashboard.stripe.com/.
2. In Cloudflare, open Workers & Pages → `paymentsystem` → Settings → Variables and Secrets. The checkout and Stripe webhook both run on this Worker; it forwards verified membership updates to `rps-server` using the `RPS_SERVER` service binding.
3. Add these as **Secrets** (not plain-text variables):
   - `STRIPE_SECRET_KEY`: your Stripe test secret key (starts with `sk_test_`).
   - `STRIPE_WEBHOOK_SECRET`: the signing secret for the webhook endpoint you create below (starts with `whsec_`).
4. In Stripe Dashboard → Developers → Webhooks, create an endpoint:
   `https://paymentsystem.heyboernathan.workers.dev/stripe/webhook`
5. Subscribe the endpoint to these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Copy the endpoint's signing secret into the `paymentsystem` Worker as the `STRIPE_WEBHOOK_SECRET` secret. Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on `paymentsystem` only. Set the same `PAYMENT_SYNC_SECRET` value on both `paymentsystem` and `rps-server`; the `RPS_SERVER` service binding on `paymentsystem` must target `rps-server`.
7. Test a new account using Stripe test card `4242 4242 4242 4242`, any future expiry, and any CVC. Confirm Premium activates after the webhook arrives and is removed when the subscription ends.
8. When testing passes, replace both secrets with their **live-mode** equivalents and create a separate live-mode webhook endpoint with the same URL and event list. Use its live signing secret.

## Security notes
- Never put Stripe secret keys in HTML, JavaScript, GitHub, or chat.
- Premium is activated only by a verified Stripe webhook; the browser's success redirect does not grant it.
- Checkout uses the logged-in account's server-verified session.
- The trial is 7 days and the subscription renews at CAD $9.99/month after the trial unless cancelled.

The live webhook endpoint has been created in Stripe for `paymentsystem` and is subscribed to the five events listed above. Its signing secret still needs to be saved as `STRIPE_WEBHOOK_SECRET` on `paymentsystem` before live membership activation will work. Do not add Stripe keys or the webhook signing secret to `rps-server`; it only needs `SESSION_SECRET`, `PAYMENT_SYNC_SECRET`, and its existing account/Durable Object bindings. If checkout fails, verify `STRIPE_SECRET_KEY` on `paymentsystem` is a live-mode secret key for the same Stripe account that owns the configured `price_...` IDs.