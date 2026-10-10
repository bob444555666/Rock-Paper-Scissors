# Premium plans and billing

## Plans

All amounts are CAD and billed monthly.

| Plan | Price | Members included | Trial |
| --- | ---: | ---: | --- |
| Individual | $9.99/month | 1 total | 7 days |
| Duo | $11.99/month | 2 total (owner + 1) | None |
| Family | $31.99/month | 10 total (owner + up to 9) | None |

## Current Stripe test-mode catalog

These objects were created in the connected Stripe sandbox. They are for testing only and do not collect live payments.

- Individual product: `prod_VPhVP1JAHjxtL9`
- Individual price: `price_1UOs6G3FalmEL64xoVuwHt5f`
- Duo product: `prod_VPtpcMm1ZiqnpL`
- Duo price: `price_1UP41i3FalmEL64xou8zpVa1`
- Family product: `prod_VPtpt40smt3dTy`
- Family price: `price_1UP41m3FalmEL64xUg05vCS5`

The test-mode webhook is configured at `https://rps-server.heyboernathan.workers.dev/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and the subscription created/updated/deleted events.

## Worker behavior

- `POST /account/stripe-checkout` accepts `plan: "individual" | "duo" | "family"`. Only Individual receives the 7-day trial.
- Signed Stripe webhook events sync the owner's subscription status and plan.
- `POST /account/premium` returns current Premium status and whether the account can manage group members.
- `POST /account/premium-members` lists group members for an active Duo or Family owner.
- `POST /account/premium-invite` accepts `{ username }` to add an existing account, or `{ username, action: "remove" }` to remove it. The Worker enforces plan limits and prevents an account with its own active Stripe subscription from being added.
- When a group subscription becomes inactive, group-member Premium entitlements are removed.

## Before taking real payments

The connected Stripe account used for this setup is a **test-mode sandbox**. Before launch, connect/select the live Stripe account, create live-mode products and monthly CAD prices for Duo and Family, update the two price IDs in the Worker checkout route, configure the live webhook for the same URL and required events, and set the Worker's `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the live account's corresponding secrets. Do not use test-mode price IDs with a live secret key.

Review applicable GST/HST and other tax obligations and configure Stripe Tax only after the appropriate tax registrations/settings are in place.

## Maintenance note

The deployed Worker was updated directly through Cloudflare because its original source file was not present in this repository. Recover and version the original Worker source before the next full Worker rebuild/deploy, or these changes could be overwritten by an older bundle.
