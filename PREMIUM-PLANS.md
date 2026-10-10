# Premium membership plans and billing

All amounts are CAD and billed monthly. The public-facing names are Premium, Ultra, and Ultra Plus. The existing internal Stripe/Worker plan keys remain `individual`, `duo`, and `family` so current checkout and member entitlements continue to work.

## Public plan lineup

| Public plan | Internal key | Price | Accounts included | Trial |
| --- | --- | ---: | ---: | --- |
| Premium | `individual` | $9.99/month base + $3/month per extra account | 1 total included | 7 days |
| Ultra | `duo` | $14.99/month base + $3/month per extra account | 1 total included | None |
| Ultra Plus | `family` | $31.99/month base + $3/month per extra account | 1 total included | None |

## Per-account pricing change requested

The intended policy is that every tier includes only the subscribing account. Each additional account costs CAD $3 per month, added to the selected tier's base price. There is no tier-specific default allowance for multiple accounts under the new policy.

The plan page now displays the intended policy and estimates the total, but it deliberately blocks checkout when extra accounts are selected. This is a safety guard: the current Worker checkout and entitlement endpoints still use the older `duo` limit of 2 accounts and `family` limit of 10 accounts, and do not yet calculate or collect the $3 per-account recurring add-on. Do not remove that guard until the Worker validates the requested seat count, creates a Stripe subscription with the correct recurring add-on quantity, and enforces the purchased account limit server-side. The add-on recurring Stripe Price must be created in both test and live modes before enabling it.

## Benefits shown on the plan page

- **Premium:** ad-free play; exclusive themes, backgrounds and move styles; win animations, confetti and sound options; personal match history, win rate and streak records; profile badge/emotes; custom button, font and interface styling.
- **Ultra:** everything in Premium; one additional account; competitive leagues and seasonal leaderboards; analytics by move, opponent and game mode; best-of-5/best-of-7/custom formats; friend challenges and custom room rules; daily missions, seasonal trophies, and exclusive Ultra profile effects.
- **Ultra Plus:** everything in Premium and Ultra; up to nine additional accounts; private tournaments and larger group competitions; adjustable AI practice opponents; long-term performance trends; monthly cosmetics and rare collectibles; elite crown/name effects; priority support.

Implementation status: the plan page now presents a deduplicated benefits list, but the list is not proof that every benefit is live in gameplay. The existing Worker currently handles checkout, subscription status, and group-member limits. New competitive leagues, detailed analytics, custom match lengths, adjustable AI practice, tournament hosting, monthly rewards, ad-free enforcement, and priority support still need their respective game UI/service logic and server-side entitlement checks before being advertised as active. Existing Premium cosmetics should be reused rather than duplicated.

## Current Stripe test-mode catalog

These objects were created in the connected Stripe sandbox. They are for testing only and do not collect live payments. The Stripe test-mode product names have also been updated to Premium, Ultra, and Ultra Plus.

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
