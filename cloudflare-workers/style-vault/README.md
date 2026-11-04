# RPS Style Vault Worker

This Worker stores each paid member's equipped Style Vault item in the `RPS Style Vault` KV namespace. It verifies the submitted session against the existing `rps-server` `/account/premium` endpoint before reading or writing a style. The account session secret is never copied into this Worker.

## Routes

- `GET /health` — basic deployment health check.
- `POST /vault` with `{ "token": "...", "action": "load" }` — load the account's equipped style.
- `POST /vault` with `{ "token": "...", "action": "save", "styleId": "..." }` — equip a style after membership-tier validation.
- `POST /vault` with `{ "token": "...", "action": "reset" }` — reset to Neon Challenger.

The site calls `https://rps-style-vault-api.heyboernathan.workers.dev`. Keep the KV namespace ID in `wrangler.toml`; never put account secrets or session tokens in source control.

## Deploy

Run `npx wrangler deploy` from this directory after authenticating with the correct Cloudflare account.
