# Identity and authentication

Status: local provider with server-side sessions in Redis (implemented, see
[0003](../changes/0003-case-engine-and-journeys.md)): passwords, short-lived access tokens with rotating refresh
tokens, revocation, lockout, e-mailed one-time codes for clients, password reset. Everything marked **planned** is
target design, covered by failing e2e tests.

## Realms

Platform staff, FI members and clients are separate identity realms (see [personas](../product/personas.md)). A token
always names its realm (`kind`) and, for FI members and clients, its tenant; it is refused anywhere else (done).

## Sessions (implemented)

`apps/core/src/auth/identity.service.ts`, `session.store.ts` (Redis, `REDIS_URL`; `bun run redis:start` locally).

| Aspect | Implementation | Standard |
| --- | --- | --- |
| Access token | HS256 JWT, 15 min (`AUTH_ACCESS_TTL_SECONDS`), carries `sid` (session id) and a unique `jti`; every request checks that the session still exists | OWASP ASVS V3 |
| Refresh | rotating refresh token (`POST /auth/refresh`, body or `HttpOnly; SameSite=Lax` cookie `fintivio_refresh`); reusing a rotated token revokes the session (theft detection); session lifetime `AUTH_SESSION_TTL_SECONDS` | OAuth 2.0 for Browser-Based Apps (BCP) |
| Revocation | `POST /auth/logout`, member deactivation, password change/reset and tenant suspension end sessions at once | OWASP ASVS V3 |
| Brute force | throttling per account; 5 failures lock sign-in temporarily (`429`); same error for unknown user / wrong password | NIST SP 800-63B §5.2.2 |
| Web app | keeps the session in `localStorage`, refreshes one minute before expiry or after a `401` (one refresh at a time, across tabs) | |

Still planned: asymmetric signing (EdDSA/ES256) with a JWKS for other services; breached-password checks
(NIST 800-63B §5.1.1); moving the refresh token out of `localStorage` (cookie-only) once the web app and API share a
site.

## Multi-factor authentication (implemented: TOTP; passkeys planned)

- **TOTP** (RFC 6238, SHA-1/30 s/6 digits, ±1 step, a code is accepted once: the last used step is stored) with 10
  hashed **recovery codes** shown once at enrolment (`apps/core/src/auth/mfa.ts`). Secrets are encrypted with the data
  encryption key and bound to the account (AAD).
- **Platform staff**: always. **Members**: when the institution's policy `requireMfa` is on (default for new
  institutions; `GET/PUT /security/policy`, `security:manage`, *Settings → Security*). Clients use e-mailed codes.
- The password step answers `{ mfaRequired, mfaToken }` (5 minutes, 5 attempts) or `{ mfaEnrollmentRequired,
  enrollmentToken }` (15 minutes) instead of a session — for sign-in and when accepting an invitation:
  `POST /auth/mfa/verify` (code or recovery code), `POST /auth/mfa/totp/enroll` → secret + `otpauth://` URI,
  `POST /auth/mfa/totp/confirm` → session + recovery codes. The web sign-in page walks through both.
- SSO sign-ins rely on the IdP's MFA (we record the IdP's `amr` on the audit entry); step-up for sensitive actions
  and passkeys (`@simplewebauthn/server`) are planned (SEC-01/02 in plans/02).
- Local development: the seeded staff account has a development TOTP secret; `bun run totp` prints the code. The e2e
  suite enrols and computes codes itself (`apps/e2e/support/factories.ts`, `support/totp.ts`).

## Single sign-on for institutions (implemented through the SSO broker)

Institutions bring their workforce IdP through **WorkOS as SSO broker** (decision in plans/02): the institution's IT
configures the connection and verifies its e-mail domains in the broker's **Admin Portal**, opened from
*Settings → Security* (`POST /sso/setup-link`). Fintivio never sees the IdP's secrets.

- Port `SsoBroker`, one adapter `WorkOsSsoBroker` (`@workos-inc/node` 11, `apps/core/src/auth/sso/broker.ts`);
  locally it points at the **WorkOS emulator** (`fake-services/workos`: organizations, domains with DNS TXT
  verification, OIDC connections, Admin Portal pages, `/sso/authorize`, `/sso/token`) which talks real OIDC to the
  **fake IdP** (`fake-services/idp-oidc`: discovery, JWKS, login page, RS256 ID tokens with `groups` and `amr`).
- **Home realm discovery**: `GET /auth/sso/discover?email=`; the sign-in page is e-mail first and sends addresses of
  a verified domain to `/auth/sso/start` → broker → IdP → `/auth/sso/callback` → the web app receives a one-time
  hand-off code (`/sign-on?sso=`) exchanged at `POST /auth/sso/exchange` (no tokens in URLs).
- Checks at callback: state (Redis, 10 minutes), profile organization = the institution's, e-mail domain verified.
- **Enforcement** (`PUT /sso/settings { enforce }`): only with an active connection and a verified domain; password
  sign-in is then refused for those domains (`403 sso_required`).
- **Just-in-time accounts** with default roles; existing members are linked on first use (`sso_identities`).
- **Directory sync** (FIA-07): the IdP provisions members by SCIM into the broker's directory (Admin Portal, intent
  `dsync`); `DirectorySync` polls the broker's events (`dsync.user.created|updated|deleted`, cursor per institution,
  Redis lock per organization) and creates, updates or deactivates members — deactivation revokes their sessions.
- **Platform staff** sign in through the company IdP the same way (`/platform/sso`, *Platform → Staff*); staff
  accounts are only created by invitation; enforcement refuses staff passwords for the company domain except for the
  break-glass accounts (`STAFF_BREAK_GLASS_EMAILS`, password + TOTP).
- *Planned*: IdP group → role mapping, SAML IdP fake, deleting the broker organization when an institution is
  deleted, running directory sync as a Restate workflow per organization.

## Client (end-user) authentication

- **Passwordless e-mail one-time code** (6 digits, 10 min, single use, throttled): `POST /auth/otp/start`,
  `POST /auth/otp/verify` (implemented; "Email me a code" on the sign-in page). Creates the client on first use so an
  application can be resumed from any device; confirming the code also submits the client's draft applications.
- Password (implemented) and **passkeys** (planned) as options the FI can enable.
- **Step-up** (planned): signing documents or changing contact details after KYC can require a fresh OTP.
- **Invitation links** for related parties (UBO, co-applicant, guarantor) carry a single-use token bound to that party
  (`POST /auth/party-invitations/accept`); the party only sees their own part of the case.
- Self-service password reset for every realm (implemented): `POST /auth/password/forgot` (always 202, no account
  enumeration), `POST /auth/password/reset` (page `/reset-password?token=`).

### Clients known to the institution's systems (client app, docs/plans/11 §13)

Three ways a client is known, all landing on one **client profile** (`client_profiles`: external id and source,
attributes, segments, consents):

- **Hosted accounts**: sign-up / sign-in above. When the institution published a client app, sign-up asks the
  profile fields and consents the app declares (`GET /auth/client/registration`); required consents are enforced
  (`POST /auth/register` answers 400 without them; 403 when the app closed sign-up) and recorded with their version.
- **Server-created sessions** (the Stripe *AccountSession* / Plaid *link_token* pattern): the institution's backend
  (API client with `clients:provision`) calls `POST /client-sessions` with its customer (`externalId`, e-mail, name,
  attributes). The client is found by `(source, externalId)`, else by e-mail when the app links by e-mail, else
  created. The answer carries a **single-use `clientSecret`** (random, stored hashed in Redis, 5 minutes) that the
  institution's front end hands to `@fintivio/client-sdk`; the embedded app exchanges it at
  `POST /auth/client/session` (tenant from `X-Tenant` / the host) for a normal client session. A secret of another
  institution, a used or an expired one is refused.
- **Token exchange** (RFC 8693 style): when the app enables it (issuer, JWKS address, audience), a JWT of the
  institution's own identity provider is exchanged at `POST /auth/client/token`: signature checked against the JWKS
  (cached), issuer and audience checked, claims mapped.

The app's **identity mapping** (one JSONata expression per field: `externalId`, `email`, `name`, `attributes`,
`segments`) turns the API payload or the token claims into the profile. Segments from the mapping are only added
(workflows and the team add their own, e.g. `customer`). A new client emits **`client.registered`**, which starts
the workflows with `startOn: [client.registered]` (welcome, KYC) and is audited.

Required consents are checked by the app itself as well: a client without the current version of a required consent
(signed in by code, by the institution's systems or its identity provider, or after a new version) accepts it
before anything else (`POST /me/app/consents`, versions recorded).

The embedded app keeps its session in the tab's `sessionStorage` (never the full site's `localStorage`), only talks
to the host page the institution allowed (embedding settings; the same list feeds the `frame-ancestors` policy of
`/embed/app`) and asks the host for a new secret when its session ends.

## Machine identities

- **API clients** (implemented): OAuth 2.0 client credentials at `POST /oauth/token`; explicit permission list (subset
  of the creator's); 15-minute tokens (principal kind `api_client`, checked against the client on every request, so
  revocation is immediate); secret shown once, stored hashed; rotation with overlap.
- **Connectors** (implemented): `private_key_jwt` at `/connector-api/oauth/token`, installation tokens (integrations.md).
- **Inbound webhooks from vendors**: received and verified by the connectors (Didit HMAC signature, Documenso secret).
- **Outbound webhooks to institutions** (implemented): Standard Webhooks signatures.
- **Restate**: the `/restate` endpoint only accepts requests signed by the Restate server (`RESTATE_IDENTITY_KEYS`).

## Durable workflow identity

Implemented for the case engine: cases start through the API (`POST /workflows/:id/executions`, `POST /cases`, form
submissions, events), which authorises the caller, records `initiatedBy` on the case and calls `caseRun` with an
HMAC signature (`x-fintivio-signature`, `auth/internal-signature.ts`) instead of a user token. Human tasks are
completed through the API, authorised at that moment. Nothing sensitive enters the Restate journal (X-05 checks the
`caseRun` journal), and deactivating the initiator does not break running cases.

The legacy node engine is no longer reachable: its `workflow.trigger/resume` handlers (which carried a session token
into the Restate journal) are not ingress-public any more, and log-pattern system triggers start cases on the case
engine instead. Its code (`apps/core/src/services/restate/*`, the legacy editor nodes) is dead and slated for deletion.
Deployed environments must keep the Restate ingress private (only the API calls it): whatever reaches an ingress is
journaled.

## Secrets

- Vendor credentials live in the connectors (their SecretStore, per-connector KEK): see integrations.md.
- The core encrypts the few secrets it must use itself (webhook signing secrets, TOTP secrets) with AES-256-GCM under
  `DATA_ENCRYPTION_KEY` (generated into `.data/keys/` locally; a KMS-backed key in deployed environments), bound to
  their row (AAD). API client secrets and recovery codes are only stored as hashes.
- The core's signing key (Ed25519, connectors and callback tokens) comes from `CORE_SIGNING_JWK` or `.data/keys/`.
