# 0002 — Personas, flows, authorization/identity design and the e2e suite

## What this batch adds

- **Product**: [personas](../product/personas.md) (platform staff, institution roles, clients) and a
  [flow catalogue](../product/flows.md) of 67 flows with ids, acceptance criteria and the tech each relies on,
  including the banking scenarios (account opening with KYC pass/fail/manual review, loan origination, AML hit,
  document resubmission, timeouts, audit trail, KYB).
- **Architecture (target design)**: [authorization](../architecture/authorization.md),
  [identity](../architecture/identity.md), [cases and workflows](../architecture/cases-and-workflows.md),
  [integrations and external data sources](../architecture/integrations.md).
- **E2E suite** `apps/e2e` (Playwright): 342 tests over 37 files, tagged by flow id, running against the real stack,
  plus `flow-status` to track progress ([testing/e2e.md](../testing/e2e.md),
  [testing/flow-status.md](../testing/flow-status.md)).
- **Code changes** (small, found while writing the suite): `GET /health`; the Restate ingress lock-down and
  `workflow.start` fixes below; invitation validation errors answer `400` instead of `500`; a tenant update with no
  editable field is a no-op instead of a `500`.

## Decisions (from the 0001 review)

1. **External data sources instead of tenant tables**: connectors (platform) → connections (institution, encrypted
   write-only secrets) → workflow components bound to a connection; parameterised, read-only-by-default queries.
2. **Authorization**: RBAC with `resource:action` permissions, system roles (9 for institutions, 4 for the platform)
   plus custom roles, an attribute layer for case scope, segregation of duties, four-eyes and authority limits,
   privilege-escalation prevention, institution-approved time-bound support access for staff; one decision API shaped
   like Cedar so the engine can be externalised.
3. **Machine and workflow identity**: OAuth 2.0 client credentials for integrations; durable executions run as the
   workflow (execution record with `initiatedBy`), never with a user's bearer token; Standard Webhooks signing.

Also decided, with the dependencies to introduce: OIDC SSO (`openid-client`) and SAML through BoxyHQ SAML Jackson,
SCIM 2.0, TOTP (`otplib`) and passkeys (`@simplewebauthn/server`), passwordless e-mail codes for clients, short-lived
access tokens + HttpOnly refresh cookie, append-only hash-chained audit events, envelope encryption for secrets.
Local test doubles: `oidc-provider` as IdP, fakes for Didit, Documenso, screening, SMTP, SMS, webhooks; a real
external Postgres database as the institution's core banking system.

## Findings

### Critical, fixed in this batch

| Finding | Evidence | Fix |
| --- | --- | --- |
| The Restate ingress was a second, unguarded API: any signed-in user, **clients included**, could call administrative handlers | a client created a role `pwned via restate` with permission `admin` through `POST :8080/roles/x/createRole` and listed the staff with `users/getUsers` | every handler is `ingressPrivate` except `workflow.start` (members) and `workflow.trigger`/`resume` (members, clients), which are checked in `RestateHandler`; e2e X-06 |
| `workflow.start` authorised against the YAML sent by the caller, so `allowedRoles` could be bypassed | code review, reproduced in X-06 | the stored definition is loaded and used |
| Access denial in `workflow.start` was a plain `Error`, retried by Restate forever (the caller hangs) | X-06 hung until the invocation was killed | `TerminalError` 403 |

Correction to 0001: "everything requires a session unless marked public" held for HTTP routes only; the Restate
path was unguarded until now.

### High, open (covered by failing tests)

| Finding | Evidence | Flow |
| --- | --- | --- |
| User session tokens are persisted in Restate's journal (copied into workflow payloads) | 4 journal entries contained JWTs (`sys_journal`) | X-05 |
| Domain takeover: any institution can list any host name in `allowedDomains`, no ownership check | FIA-03 test: a second tenant claimed the first tenant's host (`200`) | FIA-03 |
| No permission enforcement inside an institution: any member manages members and roles | authorization matrix (X-02) | X-02, FIA-04/05 |
| Custom roles accept invented permissions and any holder of role management can escalate | `POST /roles` with `bank:rob` and `integrations:manage` → `201` | FIA-05 |
| The last administrator can be deactivated or demoted; members can change their own roles | `200` on both | FIA-04 |
| Sessions: 12 h bearer tokens in `localStorage`, no server-side revocation, no sign-in throttling | X-03 | X-03 |
| The browser talks to the Restate ingress; `trigger`/`resume` stay public and clients can trigger a workflow by id (residual risk until executions are started through the API) | code review | X-05, DES-03 |
| Active institutions are deleted in one step | `DELETE` → `204` | STAFF-03 |

### Medium

- Any plain `Error` thrown in a Restate handler (not found, assertion) is retried forever; the dispatcher now makes
  4xx-status errors terminal, but services mostly throw untyped errors. Needs a bounded retry policy and error
  classification.
- No first-class case/execution model: execution state is JSON in `sys_key_values`, `sys_workflow_executions` is
  unused. Queues, client status pages, timelines and four-eyes need cases and tasks (cases-and-workflows.md).
- Review settings exist but are not enforced: `assignToRoles` (no routing), `timeoutInHours` (only a due date),
  `requireCommentOnReject`; anyone can approve any review.
- The audit log is the debug log table (`sys_logs`), mutable and also used as the trigger source.
- Clients are sent to the institution's back office after signing in (`/app/dashboard`); the API blocks the data
  but the portal experience does not exist (CLI-01).
- `services/restate/api.ts` builds a callback URL to a Restate object `resolvable` that does not exist.
- The old permission list mixes permissions with pseudo-roles (`admin`, `super_admin`).

## Assumptions

- Didit's API reference is not in `docs/vendor-api`; the Didit fake and `kyc.verify` contract (sessions, decision
  values `Approved`/`Declined`/`In Review`, signed webhooks) must be confirmed against Didit's documentation.
- New institutions will require MFA for members by default; the e2e factories will then enrol TOTP themselves.
- Institutions are served on `<key>.<base domain>`; custom domains only after TXT verification.
- Playwright is pinned to 1.58.2 because its Chromium build (1208) is the newest one installed offline here.
- Contracts used by the tests (paths, payloads, status codes) are proposals; change them together with the tests.

## First run of the suite

342 tests: 47 pass, 86 fail, 209 do not run because their setup fails (mostly: system roles such as `reviewer`
do not exist yet). Flows: 4 work (STAFF-04, FIA-01, X-01, X-06), 10 partial, 53 planned. Every failure is for the
reason the test describes (missing endpoint, rule not enforced, fake not built); none comes from the harness.

## Suggested order to make the suite pass

1. Permission catalogue, system roles, route/handler guards, escalation rules (unblocks most not-run tests; X-02,
   FIA-02/04/05, AUD-01).
2. Cases, tasks and executions started through the API, with the execution principal (X-05, REV-*, SUP-*, DES-04,
   RM-*, AGT-01).
3. Workflow versions and publishing, public forms, e-mail codes for clients, client portal (DES-01/02/03,
   CLI-01/02/03/07).
4. Integrations framework, secrets vault, data-source component, then vendor fakes and connectors (INT-*, SCN-*).
5. Audit events (FIA-12, X-04, STAFF-07, CMP-02, SCN-08).
6. Sessions hardening, MFA, SSO with the `oidc-provider` fake, SCIM (X-03, FIA-06/07/08, STAFF-01).
7. Platform staff roles and support access (STAFF-05/06).
