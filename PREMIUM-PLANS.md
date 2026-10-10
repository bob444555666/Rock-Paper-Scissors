# Premium membership plans and billing

All amounts are CAD and billed monthly. The public-facing names are Premium, Ultra, and Ultra Plus. The existing internal Stripe/Worker plan keys remain `individual`, `duo`, and `family` so current checkout and member entitlements continue to work.

## Public plan lineup

| Public plan | Internal key | Price | Accounts included | Trial |
| --- | --- | ---: | ---: | --- |
| Premium | `individual` | $9.99/month | 1 total | 7 days |
| Ultra | `duo` | $11.99/month | 2 total (owner + 1) | None |
| Ultra Plus | `family` | $31.99/month | 10 total (owner + up to 9) | None |

## Benefits shown on the plan page

- **Premium:** premium arcade modes and challenges, exclusive skins/themes, personal match stats and streaks, ranked-match access, private rooms, friend rematches, profile badge and emotes.
- **Ultra:** everything in Premium; one additional account; advanced stats and match history; expanded cosmetics and victory animations; custom private-room settings; priority matchmaking; friend challenges; seasonal rewards and Ultra badge.
- **Ultra Plus:** everything in Premium and Ultra; up to nine additional accounts; larger private rooms and group challenges; advanced leaderboard/performance breakdowns; exclusive frames, skins and effects; private tournaments; VIP status and top-tier customization.

Important: these are the intended tier benefits displayed to customers. A benefit only works in gameplay after its actual game UI, service logic, and server-side entitlement checks are implemented. The existing subscription backend handles plan billing, Premium status, and group-member limits; do not treat the feature list alone as proof that ranked matchmaking, video chat, tournaments, or every cosmetic feature has been shipped.

## Current Stripe test-mode catalog

These objects were created in the connected Stripe sandbox. They are for testing only and do not collect live payments. Product names in Stripe may still use the previous names; the website shows the new public-facing names.

- Premium / individual product: `prod_VPhVP1JAHjxtL9`
- Premium / individual price: `price_1UOs6G3FalmEL64xoVuwHt5f`
- Ultra / duo product: `prod_VPtpcMm1ZiqnpL`
- Ultra / duo price: `price_1UP41i3FalmEL64xou8zpVa1`
- Ultra Plus / family product: `prod_VPtpt40smt3dTy`
- Ultra Plus / family price: `price_1UP41m3FalmEL64xUg05vCS5`

The test-mode webhook is configured at `https://rps-server.heyboernathan.workers.dev/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and the subscription created/updated/deleted events.

## Worker behavior

- `POST /account/stripe-checkout` accepts `plan: "individual" | "duo" | "family"`. Only `individual` receives the 7-day trial. The public labels are mapped to these existing keys in the browser.
- Signed Stripe webhook events sync the owner's subscription status and plan.
- `POST /account/premium` returns current Premium status and whether the account can manage group members.
- `POST /account/premium-members` lists group members for an active Ultra/Ultra Plus owner.
- `POST /account/premium-invite` accepts `{ username }` to add an existing account, or `{ username, action: "remove" }` to remove it. The Worker enforces plan limits and prevents an account with its own active Stripe subscription from being added.
- When a group subscription becomes inactive, group-member Premium entitlements are removed.

## Before taking real payments

The connected Stripe account used for this setup is a **test-mode sandbox**. Before launch, create matching live-mode monthly CAD prices, update the price IDs in the Worker checkout route, configure the live webhook for the same URL and required events, and set the Worker's `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the live account's corresponding secrets. Do not use test-mode price IDs with a live secret key.

Review applicable GST/HST and other tax obligations and configure Stripe Tax only after the appropriate tax registrations/settings are in place.

## Maintenance note

The deployed Worker was updated directly through Cloudflare because its original source file was not present in this repository. Recover and version the original Worker source before the next full Worker rebuild/deploy, or these changes could be overwritten by an older bundle.
