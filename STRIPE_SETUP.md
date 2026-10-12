# Stripe Premium setup

The subscription integration is implemented in the Cloudflare Worker and the game repository.

## Plan configured in code
- Product: Rock Paper Scissors Premium
- Price: CAD $9.99 every month
- Trial: 7 days
- Checkout: Stripe Checkout (hosted)
- Worker checkout route: `POST /account/stripe-checkout`
- Worker webhook route: `POST /stripe/webhook`

## Live setup status and remaining step

The live Stripe webhook endpoint has already been created for the **R-P-S** live account:
- Endpoint: `https://paymentsystem.heyboernathan.workers.dev/stripe/webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`

To finish live Premium activation:

1. In Cloudflare, open Workers & Pages → `paymentsystem` → Settings → Variables and Secrets.
2. Set `STRIPE_WEBHOOK_SECRET` to the signing secret for the live webhook endpoint above (Stripe Dashboard → Developers → Webhooks → select this endpoint → reveal signing secret). Save it as a **Secret**, not a plain-text variable.
3. Confirm `STRIPE_SECRET_KEY` on `paymentsystem` is the live-mode secret key for the same Stripe account that owns the `price_...` IDs in the payment Worker.
4. Confirm `PAYMENT_SYNC_SECRET` is set to the **same value** on both `paymentsystem` and `rps-server`.
5. Confirm the `RPS_SERVER` service binding on `paymentsystem` targets the `rps-server` Worker.
6. Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on `paymentsystem` only. The existing `rps-server` Worker handles account sessions and Premium membership storage; the payment Worker sends verified membership updates to it.

For a separate test-mode run, use a test-mode Stripe secret key, test-mode prices, and a separate test webhook endpoint/signing secret. Do not mix test-mode keys or webhook secrets with the live endpoint.
 
## Security notes
- Never put Stripe secret keys in HTML, JavaScript, GitHub, or chat.
- Premium is activated only by a verified Stripe webhook; the browser's success redirect does not grant it.
- Checkout uses the logged-in account's server-verified session.
- The trial is 7 days and the subscription renews at CAD $9.99/month after the trial unless cancelled.

The live webhook endpoint has been created in Stripe for `paymentsystem` and is subscribed to the five events listed above. Its signing secret still needs to be saved as `STRIPE_WEBHOOK_SECRET` on `paymentsystem` before live membership activation will work. Do not add Stripe keys or the webhook signing secret to `rps-server`; it only needs `SESSION_SECRET`, `PAYMENT_SYNC_SECRET`, and its existing account/Durable Object bindings. If checkout fails, verify `STRIPE_SECRET_KEY` on `paymentsystem` is a live-mode secret key for the same Stripe account that owns the configured `price_...` IDs.