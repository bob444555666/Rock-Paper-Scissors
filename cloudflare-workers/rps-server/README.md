# RPS Developer Studio worker update

This is the current Cloudflare Worker entry bundle for the existing rps-server Worker. Keep it synchronized with the deployed Worker when publishing backend changes.

The Developer Studio uses the existing RPS_DATABASE D1 binding and RPS_ROOM Durable Object namespace. Legend is represented by the existing family plan value.

- Legend membership is checked against the server-side account entitlement.
- Developer proposals are stored as pending records in D1.
- Submitted JavaScript is never executed. Optional CSS is stored for review and preview only.
- Owner approval publishes validated theme settings to developer_site_config; decline does not change the live configuration.
- The public game reads only the approved configuration from /developer/published-config.

The Pages deployment publishes the static UI. Deploy this Worker bundle to the existing Cloudflare Worker with its current bindings; do not replace the Worker or remove existing Durable Object/D1 bindings.
