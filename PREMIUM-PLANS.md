# Membership plans and billing

All prices are in Canadian dollars (CAD). The public plan names are **Free**, **Plus**, **Pro**, and **Legend**. Existing game-server entitlement keys remain compatible with the older account model: Plus → `individual`, Pro → `duo`, and Legend → `family`.

## Public plan lineup

| Public plan | Monthly | Annual | Trial | Accounts included |
|---|---:|---:|---|---:|
| Free | $0 | $0 | None | 1 |
| Plus | $3.99/month | $39.90/year | 7 days | 1 |
| Pro | $7.99/month | $79.90/year | 7 days | 1 |
| Legend | $14.99/month | $149.90/year | None | 1 |

Annual billing is ten monthly payments, a 16.7% discount against paying month by month. Plus and Pro get a 7-day trial on monthly or annual checkout. Legend has no trial. Cancel before the trial ends to avoid the first charge.

## Additional accounts

Every paid plan includes one account. Additional accounts are optional:

| Plan | Monthly add-on | Annual add-on |
|---|---:|---:|
| Plus | $3.00/month | $30.00/year |
| Pro | $5.00/month | $50.00/year |
| Legend | $7.00/month | $70.00/year |

The checkout Worker adds the corresponding recurring Stripe price and quantity. The annual add-on prices also use ten monthly payments.

## Benefits shown on the plan page

- **Free:** core game, online rooms, Quick Play, computer opponents, friends, leaderboard, core match history, daily challenges, accessibility settings, and free progression.
- **Plus:** Free benefits, ad-free experience, additional themes and cosmetics, extra game modes, more practice settings, and expanded statistics.
- **Pro:** Plus benefits, advanced match formats, private lobbies, custom rules, spectator tools, full match history, AI Coach, adaptive practice, rating trends, and replay sharing.
- **Legend:** Plus and Pro benefits, creator and tournament tools, custom move sets, Theme Studio, opponent scouting, data export, Nemesis AI, streamer overlays, and priority support.

**Feature-status note:** A plan card is not proof that every roadmap benefit is implemented. Some advanced modes, tournament systems, analytics, and creator tools are still planned and must not be described as live until their UI, service logic, and server-side entitlements are implemented and tested.

## Current live Stripe catalog

These active live-mode recurring prices were verified in the connected R-P-S Stripe account. The deployed `paymentsystem` Worker uses these price IDs for new checkouts.

| Price | Amount | Stripe price ID |
|---|---:|---|
| Plus monthly | $3.99/month | `price_1UUhriKoGEk54c2MpTJE5ZeU` |
| Plus annual | $39.90/year | `price_1UUhsAKoGEk54c2MdGMZUy78` |
| Pro monthly | $7.99/month | `price_1UUhruKoGEk54c2MjOKQpnlJ` |
| Pro annual | $79.90/year | `price_1UUhsCKoGEk54c2M8idWNdBy` |
| Legend monthly | $14.99/month | `price_1UUhrwKoGEk54c2MQfCrqPfy` |
| Legend annual | $149.90/year | `price_1UUhsEKoGEk54c2MfZGTd6Gk` |
| Plus extra account monthly / annual | $3/month · $30/year | `price_1UUhryKoGEk54c2MKJ5gKIUL` / `price_1UUhsUKoGEk54c2Mgf1wIM4U` |
| Pro extra account monthly / annual | $5/month · $50/year | `price_1UUhs0KoGEk54c2MHTGrU9NW` / `price_1UUhsIKoGEk54c2MXTBM3sN9` |
| Legend extra account monthly / annual | $7/month · $70/year | `price_1UUhs3KoGEk54c2M78aYsY2S` / `price_1UUhsKKoGEk54c2M30bQsH5l` |

Older Stripe products and prices remain in the account for historical subscriptions. Existing subscriptions are not automatically cancelled or migrated; new checkout uses the price IDs above.

## Worker behavior and compatibility

- `POST /account/stripe-checkout` accepts `plan: "plus" | "pro" | "legend"`, billing period, and an optional extra-account quantity.
- Plus and Pro checkout sessions receive a 7-day subscription trial. Legend does not.
- The signed Stripe webhook synchronizes subscription status, plan, period end, and paid extra-account limits to `rps-server`.
- The payment Worker maps Plus → `individual`, Pro → `duo`, and Legend → `family` so the existing account storage and member-limit logic continue to work.
- AI Chat access now allows the Pro and Legend internal plan keys; AI Coach allows all three paid plans. Both the browser and server enforce the AI Chat gate.
- Promo-code entry is disabled in checkout.
- The checkout success redirect does not grant membership by itself; activation depends on the signed webhook.

## Operational notes

The deployed `paymentsystem` Worker retains the `RPS_SERVER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `PAYMENT_SYNC_SECRET` bindings. The deployed `rps-server` Worker retains its existing secrets, AI bindings, and Durable Object namespace. Secret values are intentionally not stored in this repository and cannot be verified from deployment metadata alone.

The original source for the deployed `rps-server` bundle was not present in this repository. The compatibility patch was applied directly to the deployed Worker; recover and version the canonical source before the next full server rebuild so that the AI Chat gate changes are not overwritten.
