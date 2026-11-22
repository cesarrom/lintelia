# 04 — API clients and webhooks

Institutions connect their own systems (core banking, CRM, data warehouse) to Lintelia: **inbound** through API
clients, **outbound** through signed webhooks. Flows FIA-10 and X-07 already encode the contract in the e2e suite.

## API clients (OAuth 2.0 client credentials)

- **Who**: members with `api_clients:manage` (admin, integration manager) create them under *Integrations → API
  clients*.
- **Model** `api_clients` (tenant, RLS): `id`, `name`, `client_id` (`fc_…`), secret hashes (SHA-256 of high-entropy
  secrets; up to two active for rotation), `permissions[]` (subset of the creator's permissions — same escalation rule
  as roles), `allowed_ips` (optional CIDRs), `expires_at`, `status`, `created_by`, `last_used_at`, `last_used_ip`.
- **Token endpoint** `POST /oauth/token` (`grant_type=client_credentials`, `client_secret_basic` or
  `client_secret_post`; later `private_key_jwt` for institutions that prefer keys): JWT access token, 15 min,
  `kind: 'api_client'`, `tid`, `sub` = client id, `scope` = permissions. The access guard gets a new principal kind
  (`api_client`) whose permissions are the client's; route decorators stay the same.
- **Secret shown once**; rotation creates a second secret, the old one expires after a grace period; revocation is
  immediate (token introspection via a Redis deny-list keyed by client id + issued-before timestamp).
- **Audit**: actor `api_client:<name>`; every write audited like a member's.
- **Rate limits** per client and per tenant (Redis token bucket), `429` with `Retry-After`; limits visible in the UI.
- **Idempotency**: `Idempotency-Key` header on POST (Stripe pattern): response cached 24 h in Redis per client + key;
  a different body with the same key is `422`.
- **Versioned public API**: `/v1/...` aliases for the routes institutions may use (cases, executions, clients,
  documents, events); OpenAPI 3.1 generated from the route metadata + zod schemas, published at `/v1/openapi.json`
  with a docs page; breaking changes only in a new version; deprecation headers (`Deprecation`, `Sunset`).
- The same OAuth server issues **connector** tokens (03, authorization-code grant); one implementation.

## Outbound webhooks

### Format

[Standard Webhooks](https://www.standardwebhooks.com) (headers `webhook-id`, `webhook-timestamp`,
`webhook-signature: v1,<base64 HMAC-SHA256>`, secrets `whsec_…`; the `standardwebhooks` npm library verifies on the
receiving side). Payload envelope:

```json
{ "id": "evt_…", "type": "case.decided", "time": "2026-11-14T10:00:00Z", "tenant": "demo-bank",
  "data": { "caseId": "…", "reference": "C-2026-…", "workflow": { "id": "…", "version": 2 }, "status": "approved", "outcome": "pre_approved" } }
```

Payloads carry ids and business status, not personal data by default ("thin events"); receivers fetch details with
an API client. A subscription can opt into "fat" payloads per event type (e.g. include applicant name) when the
institution accepts it.

### Event catalogue (first set)

`case.created`, `case.submitted`, `case.status_changed`, `case.decided`, `task.created`, `task.completed`,
`client.created`, `client.flagged` (internal subscribers only — never to connectors of the client audience),
`form.submitted`, `verification.completed`, `signature.completed`, `document.created`, `data_request.created`,
`data_request.completed`, `member.invited`, `member.deactivated`. Each with a versioned JSON Schema
(`case.decided@1`) listed at `GET /v1/webhook-events`.

### Delivery

1. **Outbox**: the service that changes state writes the event into `event_outbox` (tenant, RLS) **in the same
   transaction** (no lost or phantom events).
2. **Dispatcher**: a Restate service reads new outbox rows (or is invoked after commit with the row id) and starts one
   durable **delivery** per matching subscription: POST with a 10 s timeout; retries with exponential backoff and
   jitter (e.g. 5 s, 1 min, 5 min, 30 min, 2 h, 5 h, 10 h… for up to 3 days) using `ctx.sleep`; 2xx = delivered;
   410 = subscription disabled.
3. **Delivery log** `webhook_deliveries` (attempts, status code, latency, response excerpt ≤ 1 KB, next attempt); UI to
   inspect, **resend** one delivery, **replay** a time range, **send a test event**.
4. **Health**: a subscription failing continuously for 24 h is disabled and admins are e-mailed.
5. **Ordering**: not guaranteed (industry norm); each event carries `time` and resource `version` so receivers can
   discard stale updates.
6. **Security**: HTTPS only outside local development; DNS resolution + private-range blocking at send time (SSRF);
   egress from fixed IPs published for allow-listing (10); secrets rotatable with overlap (two signatures in the header
   during rotation, which Standard Webhooks supports).

**Build vs buy (decided: build now, keep the door open for Svix)**: building on Restate reuses our durable execution
and keeps data in our perimeter. Svix (hosted or self-hosted) uses the same Standard Webhooks format, so receivers
would not notice a switch; self-hosting Svix needs its Rust server + Postgres + Redis (not available offline here).

### Migrating to Svix later (design constraints from day one)

- A `WebhookSender` port with two operations, `upsertEndpoint(tenant, subscription)` and `send(tenant, event)`; our
  Restate dispatcher is the first adapter, a Svix adapter the second. The outbox, event catalogue and subscriptions API
  stay ours.
- Model mapping chosen to match Svix: tenant → Svix *application* (`uid` = tenant id), subscription → *endpoint*
  (`uid` = subscription id, `filterTypes` = event types), event → *message* (`eventId` = our `evt_…` id, used by Svix
  for idempotency), event types registered with their JSON Schemas.
- Signing secrets in `whsec_` format from the start, so endpoints keep their secret when moved (Svix accepts custom
  secrets on endpoint creation).
- Delivery history is not migrated (receivers keep working; old logs stay readable in our tables until retention ends).
- Svix also offers an embeddable consumer portal; our *Webhooks* page can link to it after a move, or keep ours via the
  Svix API.

### Subscriptions API

`GET/POST/PUT/DELETE /webhooks` (`webhooks:manage`): `{ url, description, eventTypes[], enabled }` → secret shown once;
`POST /webhooks/:id/rotate-secret`, `POST /webhooks/:id/test`, `GET /webhooks/:id/deliveries`,
`POST /webhooks/deliveries/:id/resend`.

## Inbound webhooks

| Source | Receiver | Verification |
| --- | --- | --- |
| Vendors (Didit, Documenso, …) | the **connector**, never the core | vendor scheme (HMAC, shared secret header…) |
| Connectors → core | `/connector-api/events` (03) | installation token |
| WorkOS → core | `/auth/sso/webhooks` (02) | `WorkOS-Signature` |
| Institutions' systems → core | API clients (`POST /v1/events` to start workflows with `startOn`) | OAuth token |

Common handling: verify the signature on the **raw body**, reject old timestamps (±5 min), store in an `inbox` table
deduplicated by event id, answer 2xx immediately, process asynchronously (Restate) with retries.

## Fake services

- `fake-services/webhook-receiver` (`:9404`): endpoints that record deliveries (headers + raw body), verify Standard
  Webhooks signatures when given the secret, and can be told to fail the next *n* deliveries or answer slowly —
  tests retries and disabling.
- API clients are exercised directly by the tests (no fake needed).

## e2e

- FIA-10 (exists): create a client, token, allowed/forbidden calls, secret shown once, rotation, revocation.
- X-07 (exists): subscribed events delivered with a verifiable signature.
- New **WH-01 Retries and replay**: the receiver fails 3 times then succeeds; delivery log shows 4 attempts; resend
  works; a subscription failing for the configured window is disabled and the admin is e-mailed.
- New **WH-02 Start a workflow from the bank's system**: an API client posts an event that starts a published workflow
  (`startOn`), and the bank receives `case.decided` when it ends — a full round trip without the UI.
- UI: *Integrations → API clients* and *Webhooks* pages covered by a journey test for the integration manager.
