# Premium membership plans and billing

All amounts are CAD. Monthly plans renew monthly; annual plans are charged once per year. Public plan names are Premium, Ultra, and Ultra Plus. Internal Stripe/Worker keys remain `individual`, `duo`, and `family`. The public-facing names are Premium, Ultra, and Ultra Plus. The existing internal Stripe/Worker plan keys remain `individual`, `duo`, and `family` so current checkout and member entitlements continue to work.

## Public plan lineup

| Public plan | Internal key | Price | Accounts included | Trial |
| --- | --- | ---: | ---: | --- |
| Premium | `individual` | $9.99/month or $99.99/year + $3/month or $36/year per extra account | 1 total included | 7 days on monthly only |
| Ultra | `duo` | $14.99/month or $149.99/year + $5/month or $60/year per extra account | 1 total included | None |
| Ultra Plus | `family` | $19.99/month or $199.99/year + $7/month or $84/year per extra account | 1 total included | None |

## Per-account pricing change requested

The intended policy is that every tier includes only the subscribing account. Each additional account costs CAD $3/month on Premium, $5/month on Ultra, and $7/month on Ultra Plus, added to the selected tier's base price. There is no tier-specific default allowance for multiple accounts under the new policy.

The live `paymentsystem` Worker now accepts `billingPeriod: "month" | "year"`, adds the selected base price and optional extra-account recurring price to Checkout, stores `extraAccounts` and `billingPeriod` in subscription metadata, and syncs purchased extra-account limits to the game Worker. Annual extra-account prices are the monthly add-on amount multiplied by 12; the base annual prices include roughly two months of savings. Premium's 7-day trial applies only to monthly Premium checkout.

## Benefits shown on the plan page

- **Premium (existing benefits):** exclusive themes, backgrounds and move styles; win animations, confetti and sound options; personal match history, win rate and streak records; profile badge/emotes; custom button, font and interface styling. Planned practical additions: detailed move-by-move win-rate breakdowns, searchable match history, weekly improvement goals, and adjustable AI practice.
- **Ultra:** everything in Premium; extra accounts at $5 CAD per account per month; planned competitive leagues and seasonal leaderboards, analytics by move/opponent/game mode, custom match formats, private challenges and custom room rules, daily missions and seasonal trophies; existing Ultra profile effects.
- **Ultra Plus:** everything in Premium and Ultra; extra accounts at $7 CAD per account per month; planned private tournaments, team competitions, multi-stage brackets, downloadable match reports, advanced league administration and adjustable AI practice; existing monthly collectibles and profile effects. Priority support is planned, not currently available.

Implementation status: the plan page now presents a deduplicated benefits list, but the list is not proof that every benefit is live in gameplay. The existing Worker currently handles checkout, subscription status, and group-member limits. New competitive leagues, detailed analytics, custom match lengths, adjustable AI practice, tournament hosting, monthly rewards, ad-free enforcement, and priority support still need their respective game UI/service logic and server-side entitlement checks before being advertised as active. Existing Premium cosmetics should be reused rather than duplicated.

## Live Stripe catalog

The following live-mode CAD recurring prices are active in the connected R-P-S Stripe account. The old Ultra Plus $31.99 monthly price remains active in Stripe for historical subscriptions, but new checkout uses the replacement $19.99 monthly price.

| Price | Amount | Stripe price ID |
| --- | ---: | --- |
| Premium monthly | $9.99/month | `price_1UPeYnKoGEk54c2MML5uP6Tr` |
| Premium annual | $99.99/year | `price_1UTtM0KoGEk54c2MSGrYV31P` |
| Ultra monthly | $14.99/month | `price_1UPeYpKoGEk54c2McDPgvx5H` |
| Ultra annual | $149.99/year | `price_1UTtM2KoGEk54c2MDpbayI6Z` |
| Ultra Plus monthly | $19.99/month | `price_1UTtLvKoGEk54c2MVlbAgfuF` |
| Ultra Plus annual | $199.99/year | `price_1UTtM3KoGEk54c2Md1jGFbOp` |
| Premium extra account monthly / annual | $3/month · $36/year | `price_1UTtNkKoGEk54c2Mgi3ce0BV` / `price_1UTtO5KoGEk54c2MtfiMOz4F` |
| Ultra extra account monthly / annual | $5/month · $60/year | `price_1UTtNmKoGEk54c2MfvngWiM4` / `price_1UTtO7KoGEk54c2MOvz02aX7` |
| Ultra Plus extra account monthly / annual | $7/month · $84/year | `price_1UTtNoKoGEk54c2MGoiqPq09` / `price_1UTtO9KoGEk54c2M8X7SXuGT` |

The live webhook endpoint is configured at `https://paymentsystem.heyboernathan.workers.dev/stripe/webhook`. Verify its signing secret is set on the Worker before relying on live membership activation.

## Historical Stripe test-mode catalog

These objects were created in the connected Stripe sandbox. They are for testing only and do not collect live payments. The Stripe test-mode product names have also been updated to Premium, Ultra, and Ultra Plus.

- Premium / individual product: `prod_VPhVP1JAHjxtL9`
- Premium / individual price: `price_1UOs6G3FalmEL64xoVuwHt5f`
- Ultra / duo product: `prod_VPtpcMm1ZiqnpL`
- Ultra / duo price: `price_1UP41i3FalmEL64xou8zpVa1`
- Ultra Plus / family product: `prod_VPtpt40smt3dTy`
- Ultra Plus / family price: `price_1UP41m3FalmEL64xUg05vCS5`

The test-mode webhook is configured at `https://rps-server.heyboernathan.workers.dev/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and the subscription created/updated/deleted events.

## Worker behavior

- `POST /account/stripe-checkout` accepts `plan: "individual" | "duo" | "family"` and `extraAccounts` (0–99). Only `individual` receives the 7-day trial. The Worker selects the plan-specific recurring add-on price and sets its quantity server-side.
- Signed Stripe webhook events sync the owner's subscription status, plan, and purchased extra-account count.
- `POST /account/premium` returns current Premium status and whether the account can manage purchased extra accounts.
- `POST /account/premium-members` lists member accounts and returns the paid member limit for an active subscriber.
- `POST /account/premium-invite` accepts `{ username }` to add an existing account, or `{ username, action: "remove" }` to remove it. The Worker enforces the purchased quantity and prevents an account with its own active Stripe subscription from being added.
- When a subscription becomes inactive, group-member Premium entitlements are removed.

## Before taking real payments

The connected Stripe account used for this update is the **R-P-S live-mode account**. The Worker was deployed with the live price IDs. Confirm the live webhook signing secret and account session synchronization in Cloudflare before announcing the full live purchase flow as end-to-end verified. Do not mix test-mode prices or secrets into this Worker.

Review applicable GST/HST and other tax obligations and configure Stripe Tax only after the appropriate tax registrations/settings are in place.

## Maintenance note

The deployed Worker was updated directly through Cloudflare because its original source file was not present in this repository. Recover and version the original Worker source before the next full Worker rebuild/deploy, or these changes could be overwritten by an older bundle.
