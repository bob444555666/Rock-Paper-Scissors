# Stripe Premium setup

The subscription integration is implemented in the Cloudflare Worker and the game repository.

## Live subscription catalog
- Stripe account: **R-P-S** (live mode)
- Checkout: Stripe Checkout (hosted)
- Worker checkout route: `POST /account/stripe-checkout`
- Worker webhook route: `POST /stripe/webhook`
- Premium: CAD $9.99/month or $99.99/year; 7-day trial on monthly Premium only
- Ultra: CAD $14.99/month or $149.99/year
- Ultra Plus: CAD $19.99/month or $199.99/year
- Extra accounts: Premium $3/month or $36/year; Ultra $5/month or $60/year; Ultra Plus $7/month or $84/year. One account is included in every tier.

## Live setup status and remaining verification

The new live monthly/annual price catalog has been created and the `paymentsystem` Worker was uploaded successfully with the matching price IDs. Cloudflare confirmed the existing `RPS_SERVER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `PAYMENT_SYNC_SECRET` bindings were preserved. The live Stripe webhook endpoint is configured for the **R-P-S** account:
- Endpoint: `https://paymentsystem.heyboernathan.workers.dev/stripe/webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`

Before treating real checkout as fully verified, confirm in Cloudflare Workers & Pages → `paymentsystem` → Settings → Variables and Secrets that `STRIPE_WEBHOOK_SECRET` is the signing secret for the live webhook endpoint above and `STRIPE_SECRET_KEY` belongs to the same live R-P-S Stripe account that owns the listed price IDs. The values are secrets and should not be copied into GitHub or chat. Confirm `PAYMENT_SYNC_SECRET` matches between `paymentsystem` and `rps-server`, and that the `RPS_SERVER` binding targets `rps-server`. Cloudflare confirmed the bindings are present, but secret values cannot be verified from the deployment metadata alone.

For a separate test-mode run, use a test-mode Stripe secret key, test-mode prices, and a separate test webhook endpoint/signing secret. Do not mix test-mode keys or webhook secrets with the live endpoint.
 
## Security notes
- Never put Stripe secret keys in HTML, JavaScript, GitHub, or chat.
- Premium is activated only by a verified Stripe webhook; the browser's success redirect does not grant it.
- Checkout uses the logged-in account's server-verified session.
- The monthly Premium trial is 7 days and then renews at CAD $9.99/month unless cancelled. Annual Premium is CAD $99.99/year and does not use the monthly trial.

The live webhook endpoint has been created in Stripe for `paymentsystem` and is subscribed to the five events listed above. Its signing secret still needs to be saved as `STRIPE_WEBHOOK_SECRET` on `paymentsystem` before live membership activation will work. Do not add Stripe keys or the webhook signing secret to `rps-server`; it only needs `SESSION_SECRET`, `PAYMENT_SYNC_SECRET`, and its existing account/Durable Object bindings. If checkout fails, verify `STRIPE_SECRET_KEY` on `paymentsystem` is a live-mode secret key for the same Stripe account that owns the configured `price_...` IDs.