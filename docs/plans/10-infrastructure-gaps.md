# 10 — Infrastructure gaps: "if AWS then …, if Azure then …, if GCP then …"

The code runs locally with embedded Postgres, Redis, Restate, file outboxes and local disk. This document lists, for
each piece, what has to exist in a deployed environment and what work each provider choice implies. Ports/adapters
already in the code are marked ✔; ones to add are marked ✚.

## Summary matrix

| Piece | Local today | AWS | Azure | GCP | Provider-neutral / other |
| --- | --- | --- | --- | --- | --- |
| Postgres 17 with RLS, restricted roles | embedded-postgres | RDS / Aurora PostgreSQL | Database for PostgreSQL Flexible Server | Cloud SQL / AlloyDB | Crunchy, Neon (dropped), self-managed |
| Redis (sessions, codes, rate limits, idempotency) | redis-server 6.2 | ElastiCache (Valkey/Redis OSS) | Azure Managed Redis / Cache for Redis | Memorystore | Upstash, Redis Cloud |
| Durable execution | restate-server | Restate Cloud, or self-hosted cluster on EKS/ECS | Restate Cloud, or AKS | Restate Cloud, or GKE | Restate Cloud |
| Object storage (07) | local disk / s3rver | S3 | Blob Storage | Cloud Storage | R2, MinIO |
| Malware scanning (07) | fake (EICAR) | GuardDuty Malware Protection for S3 | Defender for Storage | ClamAV on Cloud Run | ClamAV |
| Key management (KEK, BYOK) | `SECRETS_KEK` env | KMS | Key Vault (keys) | Cloud KMS | HashiCorp Vault Transit |
| Secrets for the apps | `.env` | Secrets Manager / SSM | Key Vault (secrets) | Secret Manager | Vault, Doppler |
| Platform e-mail | outbox / fake SMTP | SES | Azure Communication Services Email | no native: SendGrid/Postmark/Mailgun | Postmark, SendGrid |
| Compute (core, connectors, fakes not deployed) | bun processes | ECS Fargate / EKS | Container Apps / AKS | Cloud Run / GKE | Fly.io, Kubernetes |
| Web app + embed pages | Vite dev | S3 + CloudFront (+ functions for CSP) | Static Web Apps / Front Door | Cloud Storage + Cloud CDN / Firebase Hosting | Vercel, Cloudflare Pages |
| Edge, WAF, rate limits | none | CloudFront + AWS WAF | Front Door + WAF | Cloud Armor + LB | Cloudflare |
| Custom domains (09) | fake DNS | ACM + CloudFront | Front Door managed certs | Certificate Manager | Cloudflare for SaaS |
| SSO broker (02) | fake WorkOS | WorkOS (SaaS) | WorkOS | WorkOS | Ory Polis self-hosted |
| Storage events (07) | `/complete` call | EventBridge | Event Grid | Pub/Sub | — |
| Observability | console logs | CloudWatch + X-Ray / OTel collector | Azure Monitor / App Insights | Cloud Logging / Trace | OpenTelemetry → Grafana/Datadog |
| IaC | scripts | Terraform/OpenTofu AWS modules | Terraform/Bicep | Terraform | — |

## Piece by piece

### 1. Postgres with row level security

Requirements we rely on: Postgres ≥ 15 (we use 17), three roles (owner for migrations, `fintivio_app`,
`fintivio_platform`) that are **not superusers and have no BYPASSRLS**, `set_config('app.tenant_id', …, true)` per
transaction, composite foreign keys, append-only grants on audit tables.

- **AWS (RDS/Aurora)**: the master user is `rds_superuser`-like — use it only for migrations (CI job), create the two
  app roles via migration/IaC; IAM database authentication optional. **RDS Proxy**: works with our transaction-scoped
  settings (no session pinning from `SET LOCAL`-style `set_config(..., true)`), verify pinning metrics. Backups/PITR,
  KMS encryption, Multi-AZ.
- **Azure (Flexible Server)**: admin is `azure_pg_admin` member; same role creation; PgBouncer built in (transaction
  mode is compatible). Entra authentication optional.
- **GCP (Cloud SQL/AlloyDB)**: `cloudsqlsuperuser` for migrations; Cloud SQL Auth Proxy/connector; AlloyDB if analytics
  on the same data grows.
- Gap for all: a reporting replica (read-only role with RLS) and per-tenant exports; connection pooling sized for
  Restate handler concurrency; the `fintivio_test` database never exists in deployed environments.

### 2. Redis

TLS (`rediss://`) and AUTH/ACL users; Bun's built-in client supports TLS — verify cluster mode if the provider enforces
it (ElastiCache cluster mode disabled is simplest). Persistence is **not** required for correctness except for
sessions (loss = everyone signs in again); choose a Multi-AZ tier. Keys are namespaced by purpose; no tenant data
besides ids and hashes.

### 3. Restate

- **Restate Cloud** (managed): simplest; register the core's deployment URL; enable request signing (identity keys,
  `RESTATE_IDENTITY_KEYS`) — mandatory because `/restate` is reachable by the Restate servers only. Check region options
  (EU data residency: the journal holds case ids and step outputs).
- **Self-hosted**: Restate server cluster (replicated log, object-store snapshots on S3/compatible), persistent volumes,
  ingress **private** (the API is the only caller; the public ingress must not be exposed — today only `caseRun` and
  legacy `workflow.trigger/resume` are public and guarded). Upgrades require the SDK/server version pairing (RESTATE.md).
- Journal retention must follow case data retention (DORA/GDPR).

### 4. Object storage, scanning, downloads — see [07](07-file-uploads.md)

Extra gaps: a separate user-content domain for downloads; lifecycle rules for quarantine (delete after 1 day) and
retention/legal hold for evidence (S3 Object Lock / Azure immutable blobs / GCS bucket lock).

### 5. Keys and secrets

- Core secrets to encrypt: MFA TOTP secrets, webhook signing secrets, SSO state, any remaining in-core credentials.
  Envelope encryption: data keys (AES-256-GCM) wrapped by a KEK in **KMS (AWS) / Key Vault (Azure) / Cloud KMS (GCP)**;
  locally `SECRETS_KEK`. Connectors do the same with their own keys (03).
- JWT/JWKS signing keys for sessions, connector requests and session tokens: move from HS256 secrets to asymmetric keys
  stored in KMS (sign via KMS APIs, or keys in the secret manager loaded at start) with rotation.
- BYOK per institution (some banks require it): per-tenant KMS keys for files and encrypted columns — design the key id
  in the schema now, implement later.

### 6. E-mail

- Platform mail (codes, invitations, decisions): **SES** (verify our sending domain, DKIM, DMARC, configuration set with
  bounce/complaint notifications via SNS → suppress addresses) / **Azure Communication Services Email** / a third-party
  provider on GCP. Bounces should flag clients' e-mails in the portal/back office.
- Sending **as the institution** (`noreply@bank.com`): per-tenant sender identities (DKIM records for their domain,
  like custom domains) or via the institution's own SMTP through the `smtp-mailer` connector. Gap: neither exists.

### 7. Compute and networking

- Core API, connectors, web server for dynamic headers: containers (ECS Fargate / Container Apps / Cloud Run).
  Restate handlers run in the core container (it serves `/restate`); sizing for long-held invocation requests (Bun
  `idleTimeout` is set to 255 s).
- **Dynamic response headers**: the hosted form needs a per-form `frame-ancestors` CSP. Pure static hosting cannot do
  it: serve `/embed/*` from the core (or a small web server), or compute it at the edge (CloudFront Functions/Lambda@Edge,
  Front Door rules engine + origin, Cloudflare Workers) with a cached call to `/public/forms/:key/embed-policy`.
- Egress: fixed public IPs (NAT gateway / Azure NAT / Cloud NAT) for webhooks and calls to institutions' systems, which
  allow-list them; private connectivity to first-party connectors (service discovery + mTLS or signed requests only).
- Institutions' private systems (core banking databases) usually need **private connectivity**: AWS PrivateLink / VPN,
  Azure Private Link / VPN Gateway, GCP Private Service Connect / Cloud VPN — or an agent the institution runs
  (outbound-only connector agent, like the Retool/Airbyte agents). Gap: decide per connector category.

### 8. Edge and abuse protection

WAF rules (OWASP core rule set), bot protection on public form submissions (Turnstile/hCaptcha or the provider's bot
control), rate limiting at the edge in addition to Redis limits, DDoS protection (Shield/Front Door/Cloud Armor).

### 9. Observability and audit export

OpenTelemetry traces and metrics from core, connectors and Restate (trace id propagated to connectors); logs without
personal data; alerting on webhook failures, Restate backlogs, scan failures, login anomalies. Institutions will ask
for **audit log streaming to their SIEM** (WorkOS offers log streams for its own events; ours needs an export: S3/Blob
delivery or HTTPS stream) — gap.

### 10. Data residency and tenancy topology (decided: one region now, ready to split)

Today: one region, one database. The target when an institution requires it: **regional cells** — each cell has its
own database, Redis, Restate, object storage, KMS keys, connectors and e-mail sending; a small **global directory**
knows which cell serves which tenant and routes requests. Moving later is cheap only if the code follows these rules
from now on (to add to the contribution guide and check in reviews):

1. **Every tenant-owned row, object, key and message carries the tenant id** (already true for tables via RLS; also
   for storage keys, Redis keys, Restate workflow keys, outbox events, audit entries, connector installations).
2. **No cross-tenant queries in the request path** — only platform operations (directory, staff console) read across
   tenants, through the platform connection, and they must work against a global directory instead of joins.
3. **Globally unique ids** (UUIDs, already) so tenants can move between cells without id clashes.
4. **Tenant → region attribute** on the tenant record (`region`, default the single region) and a `CellRouter` used by
   the API, web (API base URL per tenant) and connectors to reach "the cell of this tenant" — trivial while there is
   one cell.
5. **Platform data stays minimal and global** (tenant directory, staff, connector registry, platform audit); nothing
   about institutions' clients or cases outside their cell.
6. **Per-tenant export/import** scripts (everything keyed by tenant id: rows, files, Redis state is disposable,
   Restate executions drained first) — the mechanism to move a tenant between cells, tested in CI with a fake second
   cell.
7. **Vendors per region**: connector installations point at regional vendor endpoints (Didit/Documenso regions),
   WorkOS region, e-mail region; record the region in the DORA/GDPR registers.
8. **Configuration per cell**, not global constants (URLs, keys, limits), so a new cell is a new configuration.

When the first requirement appears: stand up a second cell from the same IaC, add the routing layer (edge/API gateway
by host → cell), move the tenant with the export/import tooling.

### 11. Compliance (financial institutions as customers)

- **DORA** (EU) ICT third-party risk: register of subcontractors per service (cloud provider, WorkOS, Didit,
  Documenso, e-mail provider), exit strategies, incident reporting timelines, resilience testing.
- **GDPR**: DPIA for biometric KYC data (05), records of processing, data-rights handling across connectors (03).
- **SOC 2 / ISO 27001** evidence: access reviews (roles export), change management, backup/restore tests.
- AML record keeping (5+ years) vs erasure: retention rules per case type (already reflected in erasure refusals).

### 12. CI/CD

Migrations as a separate job with the owner role; connectors deployed independently with their own migrations;
manifests published to the registry on deploy (staff approval in production); e2e suite against an ephemeral
environment with all fake services (the same `fake-services/*` images).

## What to decide first

1. Cloud provider (or Cloudflare + a container platform) — unblocks 4–9 concretely.
2. Restate Cloud vs self-hosted.
3. Data residency model (single region vs cells).
4. Edge provider (custom domains, CSP at the edge, WAF).
