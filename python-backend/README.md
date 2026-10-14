# Stone Paper Scissors — Python API

This is an **additive** Python Worker for the existing game. It runs on the same Cloudflare account as the current site and Workers; no additional hosting provider is required.

## Routes

- `GET /health` — runtime health check.
- `GET /v1/rules` — game rules and supported difficulty levels.
- `GET /v1/daily-challenge` — deterministic UTC daily challenge.
- `POST /v1/round` — play a classic round using the Python game engine. JSON body: `{"move":"rock","level":"medium","history":["paper","rock"]}`.
- `POST /v1/custom-round` — play a validated classic or Rock Paper Scissors Lizard Spock round. Accepts `move`, `variant`, `level`, `history`, and `style` (`random`, `counter`, `copy`, or `chaos`).

## Local development

Install [uv](https://docs.astral.sh/uv/) and Node.js, then run:

```sh
uv sync
uv run pywrangler dev
```

Deploy with `uv run pywrangler deploy` after verifying the local tests.

## Safety boundaries

This service does not replace or modify the existing `rps-server` or `paymentsystem` Workers. Account sessions, Google/email authentication, Durable Object multiplayer, subscription checks, Stripe Checkout, and signed Stripe webhooks remain owned by the existing services. Do not route those endpoints here without a separately tested migration plan.

The daily challenge is date-based and stateless. It is not a trusted competitive leaderboard or account-synced progression store.
