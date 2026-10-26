# Stripe checkout and membership setup

## Current live catalog

- Stripe account: **R-P-S** (live mode)
- Checkout: hosted Stripe Checkout
- Payment Worker: `paymentsystem`
- Checkout route: `POST /account/stripe-checkout`
- Webhook route: `POST /stripe/webhook`
- Site origin: `https://www.stone-paper-scissors.com`

| Plan | Monthly | Annual | Trial |
|---|---:|---:|---|
| Free | $0 | $0 | None |
| Plus | $3.99 CAD | $39.90 CAD | 7 days |
| Pro | $7.99 CAD | $79.90 CAD | 7 days |
| Legend | $14.99 CAD | $149.90 CAD | None |

Extra accounts: Plus $3/month or $30/year; Pro $5/month or $50/year; Legend $7/month or $70/year. One account is included in every paid plan. Annual prices save 16.7% against monthly billing.

The active live price IDs are documented in [PREMIUM-PLANS.md](PREMIUM-PLANS.md). The Worker uses those IDs for new checkouts. Older prices remain active for historical subscriptions; existing subscriptions are not automatically cancelled or repriced.

## Current deployment and bindings

Cloudflare confirmed that the deployed `paymentsystem` Worker has these bindings:
- `RPS_SERVER` service binding to `rps-server`
- `STRIPE_SECRET_KEY` secret
- `STRIPE_WEBHOOK_SECRET` secret
- `PAYMENT_SYNC_SECRET` secret

The deployed `rps-server` Worker also has its existing `PAYMENT_SYNC_SECRET`, session secrets, AI bindings, and Durable Object namespace. Binding presence is verified, but secret values are not readable through deployment metadata. Ensure the Stripe secret and webhook signing secret belong to the same live R-P-S Stripe account, and ensure `PAYMENT_SYNC_SECRET` matches between both Workers.

The webhook verifies the Stripe signature before syncing subscription state. Checkout's success redirect does not itself grant membership. The live webhook endpoint is expected to be `https://paymentsystem.heyboernathan.workers.dev/stripe/webhook`; verify its active status and subscribed events in the Stripe Dashboard before announcing live checkout as fully end-to-end tested.

## Membership mapping

The public names are mapped to existing server entitlement keys to preserve current account data:
- Plus → `individual`
- Pro → `duo`
- Legend → `family`

Plus and Pro checkout sessions get a 7-day trial; Legend has no trial. The game server's AI Chat permission check allows Pro and Legend; AI Coach is available to all paid plans. Promo-code entry is disabled.

## Security and testing

- Never put Stripe secret keys or webhook signing secrets in HTML, JavaScript, GitHub, or chat.
- Never mix test-mode prices or secrets into the live Worker.
- Use a separate test-mode Stripe account/configuration for safe end-to-end test transactions.
- Confirm live webhook events and subscription synchronization with a logged-in test account before publicly announcing the entire checkout flow as end-to-end verified.
- Review applicable GST/HST and other tax obligations before enabling tax collection.
