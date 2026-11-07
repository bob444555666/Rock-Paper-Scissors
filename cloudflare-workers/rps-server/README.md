# RPS server staff system

The staff API is implemented in the Cloudflare Worker named `rps-server` and uses its existing `RPS_ROOM` Durable Object namespace. The frontend pages in this repository call that API; browser-only role flags are never trusted for authorization.

## Websites

- Staff Portal: `/staff-portal.html`
- Owner Control Centre: `/owner-control.html`

## Roles

- **Staff:** employee access to challenges and tournaments.
- **Manager:** staff operations, server controls, membership controls, and staff assignment; cannot create or delete game accounts.
- **Co-owner:** owner-level controls, including account creation and deletion; cannot delete the protected owner account.
- **Owner:** primary owner account with full control. The primary owner is protected from role changes and self-deletion.

The primary owner is bootstrapped from the pre-existing owner account during its first authenticated staff check.

## Employee QR passes

The Owner Control Centre assigns a role to an existing RPS username and can generate a QR pass for that account. Each pass:
- uses a cryptographically random token;
- is linked to one exact account ID;
- expires after 15 minutes;
- can be claimed only once;
- still requires the employee to sign in with their own RPS credentials.

A copied QR code cannot be used by a different account.

## Server-side API

Authenticated POST routes under `/staff/` include:
- `me`, `claim`, and `panel`;
- `role-list`, `role-set`, and `invite-create`;
- `account-list`, `account-create`, and `account-delete`;
- the existing challenge, tournament, server, and membership operations, with role checks.

The old key-protected `/admin` staff-add/remove controls are disabled. Employee access is managed through the Owner Control Centre.

## Cloudflare preservation

The deployed `rps-server` Worker uses an existing Durable Object namespace and Cloudflare-only secrets. Preserve the existing `RPS_ROOM` binding and all current secret bindings when publishing Worker changes. No passwords, session tokens, or secret values belong in GitHub.

## Legend Developer Studio

The Legend-only Developer Studio is available at `/developer-lab.html`. It uses the same game page in an embedded preview and allows Legend members to adjust supported appearance settings and submit optional CSS proposals. The Owner reviews proposals in the Developer Lab tab in Owner Control Centre.

Approved settings are served from the D1 `developer_site_config` row and loaded by `/developer/published-config`. Declined proposals are retained for review but do not update the published row. Submitted JavaScript is never executed; only Owner-approved, validated CSS and supported settings are published.
