# http connector

Any HTTP API, without a dedicated connector (docs/plans/12):

- **Connections** — one per API: base address, authentication (none, API key header, bearer token, basic, OAuth 2.0
  client credentials with token caching), headers for every call, a test path. Secrets live in this connector
  (SecretStore); workflows only reference the connection.
- **Component** `connector:http/request` (sync): method; inputs `path` (relative to the base address — other hosts are
  refused), `query`, `headers`, `body` (objects through expressions). Result: `status`, `ok`, `body` (parsed JSON),
  `headers`, `durationMs`. Events `succeeded` (2xx) / `failed` (anything else, network errors included).
- **Inbound webhooks** — `POST /hooks/<connection>/<key>` with `X-Webhook-Secret: <secret>` or
  `X-Signature: sha256=<HMAC-SHA256 hex of the body>` publishes `connector:http/webhook.<key>` (deduplicated on
  `webhook-id` / `X-Event-Id` / the body): every published workflow with that event in `startOn` starts, with the body
  in `input.body`.
- **Production** — https only, private addresses refused (no credentials sent to internal services by mistake).

Pair it with **functions** (a workflow with `function: true`, used as a step by other workflows) to build a reusable
connector of your own: e.g. "Pay the dealer in QuickBooks" = find the vendor, create it if needed, create the bill,
pay it — four HTTP steps and two conditions, called from any workflow with its inputs.
