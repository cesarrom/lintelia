# Integrations: connectors, API clients, webhooks, files

Status: **implemented** unless marked *planned*. Design rationale and the roadmap: [plans/03](../plans/03-integrations-architecture.md),
[plans/04](../plans/04-api-clients-and-webhooks.md), [plans/05](../plans/05-didit-and-documenso.md),
[plans/07](../plans/07-file-uploads.md).

## Connectors

A connector is a **separate service** (its own process, database and secrets) that integrates one vendor or system
and contributes workflow components. First-party only for now: platform staff register and approve versions.

| Piece | Where |
| --- | --- |
| Manifest (zod schema, scopes, component type `connector:<id>/<key>`) | `packages/fintivio/src/schemas/connectors.schema.ts` |
| SDK (manifest serving, JWKS, signed core requests, core client, SecretStore, idempotency, settings pages) | `packages/connector-sdk` |
| Registry (versions, approval, revocation; cache refreshed through Postgres `LISTEN/NOTIFY`) | `apps/core/src/integrations/registry.ts`, *Platform → Connectors* |
| Installations ("connections"), connect/settings hand-off, uninstall + lifecycle | `apps/core/src/integrations/installations.service.ts`, *Integrations* page |
| Connector API (token endpoint, installation, executions, records, files, events) | `apps/core/src/integrations/connector-api.service.ts` (`/connector-api/*`) |
| Engine side (invoke, async completion, client steps with reminder/expiry) | `apps/core/src/integrations/connector-invoker.ts`, `connector-components.ts` |
| Connectors | `integrations/smtp-mailer`, `integrations/postgres-datasource`, `integrations/didit`, `integrations/documenso` |

### Trust and protocol

- **Core → connector** (actions, options, lifecycle): POST with an EdDSA JWT signed by the core (JWKS at
  `/.well-known/jwks.json`), `aud` = connector id, `sub` = installation, 60 s, `jti` (replay-checked by the SDK), and a
  SHA-256 hash of the body. Idempotency keys per step execution; the SDK stores responses.
- **Connector → core**: OAuth 2.0 with `private_key_jwt` (RFC 7523; the connector's JWKS is in its manifest):
  `authorization_code` for the browser hand-off (single-use code, 2 minutes) and `client_credentials` +
  `installation_id` for server calls (the GitHub Apps model). Installation tokens live 15 minutes and carry the scopes
  granted at install (`installation:write`, `records:write`, `files:write`, `events:publish`).
- **Async steps** get a callback token (bound to tenant, case, step promise and installation); completing twice is
  refused; 4xx answers from a connector are terminal for the step, 5xx and network errors are retried by Restate.
- **Client steps** (`kind: client_step`): the connector returns a client action (URL + type `sdk`/`embed`/`redirect`);
  the core creates the client task, e-mails the client, reminds (`remindAfter`) and expires (`expiresAfter`) it; the
  portal opens the vendor page in a dialog (camera allowed). Decisions always arrive by the vendor's signed webhook at
  the connector, never from the browser.

### Secrets

Vendor secrets live **in the connector** (app-owned credentials): the SDK's `SecretStore` encrypts each value with
AES-256-GCM under a per-installation data key wrapped by the connector's key-encryption key (`CONNECTOR_KEK`; a KMS key
per connector in production). Settings pages are write-only for secrets ("set on …, leave empty to keep"); changes are
audited in the institution's log by name only; uninstalling deletes the data key (crypto-shredding). The core never
stores vendor secrets (e2e INT-05 scans every text column of the core database for the value).

### Canonical records

Connectors write `case_records` (`verification`, `signature_request`, `message`, `screening_result`, `document`),
idempotent on `(installation, type, external ref)` with a status history; the case page renders them generically.
Documents go through the same intake as uploads (`/connector-api/files`), byte-identical for signed PDFs.

### Local development

`bun run stack` creates one database and role per connector (`connector_<id>`), starts the connectors, and registers +
approves their manifests (`apps/core/scripts/connectors.ts`). Vendors are fakes with the vendors' APIs
(`fake-services/didit`, `fake-services/documenso`, the mailbox as SMTP server, a real Postgres database for the data
source); assumptions about vendor APIs are listed in each connector's `docs/ASSUMPTIONS.md`.

## API clients (inbound)

OAuth 2.0 client credentials (`POST /oauth/token`, `client_secret_basic` or `_post`): secrets shown once and stored as
SHA-256 hashes, rotation with a 24-hour overlap, immediate revocation (checked on every request), permissions a subset
of the creator's. Tokens are 15-minute JWTs with principal kind `api_client`; routes keep their `@Require`
permissions. Institutions' systems start workflows with `POST /events` (`startOn: api:<type>`, deduplicated by id).
Rate limits per client and per institution (`API_CLIENT_RATE_LIMIT`, `API_TENANT_RATE_LIMIT` per minute, `429` +
`Retry-After`) and `Idempotency-Key` on POST (first response kept 24 h and replayed; a different body is `422`)
(`apps/core/src/http/machine-traffic.ts`). *Planned*: the versioned `/v1` API with OpenAPI.

## Webhooks (outbound)

Standard Webhooks (`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<HMAC-SHA256>`, `whsec_` secrets; two
signatures during a rotation). Events are written to `event_outbox` **in the same transaction as their audit entry**
(only when someone subscribes to the type) and dispatched by a Restate service: one durable delivery per subscription
with retries (`WEBHOOK_RETRY_SCHEDULE`), a delivery log, resend, test events, and disabling on `410 Gone` or after
failing for `WEBHOOK_DISABLE_AFTER_SECONDS` (the creator is e-mailed). Payloads are thin (ids and status). Signing
secrets are encrypted with the data encryption key (`DATA_ENCRYPTION_KEY`). SSRF: HTTPS and public addresses only
outside local development. The `WebhookSender` port keeps the door open to Svix.

## Files

Uploads are intents (purpose, declared name/size/type/hash, authorised against the request item) → bytes to a
short-lived signed URL (quarantine) → `complete` → the durable intake (`fileIntake`): size/hash check, type sniffing
from the bytes, malware scan, sanitisation (content disarm and reconstruction), rescan, clean storage. Rejected files
never reach the case; downloads are 60-second signed links served as attachments, audited. Ports: `ObjectStore`
(local directory adapter; S3/Azure/GCS *planned*), `MalwareScanner`, `ContentSanitizer` (fakes locally:
`fake-services/scanner` flags EICAR, `fake-services/sanitizer` rebuilds PDFs and strips image metadata).
