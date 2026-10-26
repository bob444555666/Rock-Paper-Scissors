# Membership plan migration

The deployed `paymentsystem` Worker now accepts the four plan choices in the redesign brief.

## Customer-facing plans

| Plan | Monthly CAD | Annual CAD | Trial |
|---|---:|---:|---|
| Free | $0 | $0 | None |
| Plus | $3.99 | $39.90 | 7 days |
| Pro | $7.99 | $79.90 | 7 days |
| Legend | $14.99 | $149.90 | None |

Annual billing is 10 monthly payments (16.7% off the monthly equivalent). Plus and Pro trials apply to monthly and annual checkout.

## Additional accounts

| Paid plan | Monthly add-on | Annual add-on |
|---|---:|---:|
| Plus | $3.00 | $30.00 |
| Pro | $5.00 | $50.00 |
| Legend | $7.00 | $70.00 |

## Backward compatibility

The existing `rps-server` stores legacy membership values. The payment Worker maps Plus → `individual`, Pro → `duo`, and Legend → `family` when synchronizing membership, so current server-side entitlement checks continue to work. Existing subscriptions keep their original Stripe price and are not cancelled or automatically migrated. New checkouts use the new Stripe products and price IDs in `worker.js`.

Promo-code entry is disabled in checkout, per the site's existing direction to remove promo codes. The signed Stripe webhook and `RPS_SERVER` service binding remain in place.

## Deployment

`worker.js` is the currently deployed module bundle for the Cloudflare `paymentsystem` Worker. Update this file alongside Worker changes so the repository reflects the deployed mapping. Keep all secrets in Cloudflare bindings; never commit secret values.
