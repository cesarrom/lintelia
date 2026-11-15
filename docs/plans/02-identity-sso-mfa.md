# 02 — SSO for staff and institutions (WorkOS), MFA, SCIM

**Decision (2026-11-14)**: WorkOS is the **SSO broker**. In production, Fintivio connects its company IdP (for platform
staff) and each bank connects its own IdP (for its staff) through WorkOS Admin Portal links. Sessions, permissions,
MFA for password users and client authentication stay in Fintivio. Locally, `fake-services/workos` stands in for WorkOS.

## Who signs in how

| Population | Today | Target |
| --- | --- | --- |
| Platform staff | password (local) | **SSO only**, through our company IdP (Google Workspace/Okta/Entra) via the SSO broker; one break-glass account per environment with password + mandatory passkey/TOTP, alerting on use |
| Institution members | password | **SSO when the institution configures it** (enforceable per verified e-mail domain); password + our own MFA otherwise; SCIM provisioning optional |
| Clients (end users) | e-mail code or password | unchanged: e-mail one-time code, password, later passkeys; never SSO through the broker |

## Does SSO enforce MFA?

With SSO, **authentication — including MFA — happens at the institution's IdP**, under the institution's policy
(Conditional Access in Entra, Okta sign-on policies). We cannot make their IdP ask for a second factor; industry
practice (and WorkOS's model) is to trust the IdP and make it a contractual requirement. What we can add:

1. **Evidence, where the IdP provides it**: OIDC `amr`/`acr` claims (`mfa`, `otp`, `hwk`…) and SAML
   `AuthnContextClassRef` / Entra's `authnmethodsreferences` claim. A tenant policy "require MFA evidence from the IdP"
   refuses (or steps up, below) sign-ins without it. Availability through WorkOS is via the profile's raw attributes and
   varies per IdP — to be verified in the WorkOS sandbox; do not promise it until then.
2. **Step-up for sensitive actions**, independent of SSO: re-authenticate with a passkey (WebAuthn) or TOTP enrolled in
   Fintivio before filing a SAR, changing roles, approving support access, rotating API secrets (FFIEC/EBA-style
   "strong authentication for critical operations"). Alternatively force a fresh IdP login (`prompt=login`/`max_age`),
   which WorkOS supports per request for OIDC connections only — so our own step-up factor is the portable option.
3. **Password users** (institutions without SSO, break-glass staff): our own MFA (below), enforced by tenant policy
   (`requireMfa`, default on — flow FIA-08) and always for staff.

So: SSO *delegates* MFA to the IdP; our MFA covers everyone who does not use SSO and high-risk actions.

## Architecture: an SSO broker port, WorkOS in production, a WorkOS emulator locally

```
web sign-in ──▶ core /auth/sso/start ──▶ SsoBroker.authorizationUrl(org|connection|domain)
                                               │ (WorkOS in prod, fake WorkOS locally: same SDK, same code path)
browser ◀── redirect to broker ──▶ IdP (Okta/Entra/Google…, or fake IdPs locally) ──▶ broker ──▶ core /auth/sso/callback?code
core: SsoBroker.profile(code) → link/JIT member → our Redis session + our permission model (unchanged)
```

- **Port** `SsoBroker` in `apps/core/src/auth/sso/`: `authorizationUrl({ organizationId | connectionId | domainHint,
  state, redirectUri })`, `profile(code)` (id, email, names, organization, connection, raw attributes, groups),
  `setupLink(organizationId, intent: 'sso' | 'dsync' | 'domain_verification' | 'audit_logs')`,
  `verifyWebhook(rawBody, headers)`, `listEvents(cursor)`.
- **Only one adapter**: `WorkOsSsoBroker` (`@workos-inc/node` 11.x, SSO + Directory Sync + Admin Portal + Domain
  Verification + Events). Its constructor accepts `apiHostname`, `https` and `port` — locally it points at
  `fake-services/workos` (below). No second adapter, no "local mode" branches in the core.
- **WorkOS AuthKit (User Management) is not used** (decided): our sessions, lockout, permission model and client
  authentication stay ours; WorkOS is the broker for enterprise connections only.
- **Going live with WorkOS**: create the production WorkOS environment, register redirect URIs
  (`https://<platform host>/auth/sso/callback` and each tenant host / custom domain), create the "Fintivio staff"
  organization and connect our IdP, configure the events webhook, set `SSO_BROKER=workos` with the API key and client
  id in the secret manager; staff password sign-in is then disabled except break-glass. Banks are onboarded by sending
  them an Admin Portal link from *Settings → Security → Single sign-on*.

### Mapping

| Fintivio | WorkOS |
| --- | --- |
| tenant (institution) | Organization (`tenants.workos_organization_id`, created when SSO is first enabled) |
| the platform (staff) | one Organization "Fintivio staff" with our company IdP connection |
| institution e-mail domains allowed for SSO | Organization domains, **verified** through Admin Portal domain verification (DNS TXT) before SSO can be enforced for them (prevents claiming someone else's domain) |
| SSO configuration by the bank's IT | Admin Portal link (`intent: sso`), opened from *Settings → Security → Single sign-on* (permission `security:manage`) |
| SCIM / Google directory | Directory Sync (`intent: dsync`); events `dsync.user.created/updated/deleted`, `dsync.group.*` |
| groups → roles | per-tenant mapping table `sso_role_mappings(group, role_key)`; JIT default role per connection |

### Flows

1. **Home-realm discovery**: the sign-in page asks for the e-mail first; `GET /auth/sso/discover?email=` answers
   `{ sso: true, enforce }` when the domain belongs to a verified domain of an organization with an active connection.
   Enforced → password sign-in refused (flow FIA-06).
2. **Sign-in**: `POST /auth/sso/start { email }` → `state` (random, stored in Redis with tenant, PKCE verifier, return
   path, 10 min) → broker URL. Callback exchanges the code, checks `state`, that the profile's organization is the
   tenant's and that the e-mail domain is verified, then:
   - existing member with that e-mail → link `sso_identities(provider, idp_id, user_id)` on first use;
   - none → JIT create with the connection's default role and group mappings (if JIT is enabled), audit `member.jit_provisioned`.
   Our session is issued (same as password sign-in); `amr` evidence recorded on the session for policy checks.
3. **Staff**: the platform host shows only "Sign in with company SSO" (plus break-glass link hidden behind a flag).
4. **Directory Sync**: WorkOS events (webhook with `WorkOS-Signature` verification, or the Events API with a cursor —
   WorkOS recommends polling for reliability; we run it as a Restate workflow per organization) → create/update/
   deactivate members, revoke sessions on deactivation, apply group mappings; audit each change with actor
   `directory`.
5. **Offboarding an institution**: delete the WorkOS organization when the tenant is deleted.

## Local alternative: `fake-services/workos`

A WorkOS-API-compatible emulator for the subset we call, so dev and e2e run the production adapter unchanged.

| Emulated WorkOS API | Behaviour locally |
| --- | --- |
| `GET /sso/authorize` (organization / connection / domain hint, state, redirect_uri) | redirects to the organization's connection at a **fake IdP**, then back with a code |
| `POST /sso/token` | returns the profile (from the fake IdP's ID token / SAML assertion) |
| `POST /portal/generate_link` | link to the emulator's own minimal Admin Portal pages (configure OIDC or SAML connection, verify a domain, set up SCIM) |
| organizations, organization domains, connections | stored in the emulator's own SQLite/Postgres database |
| Directory Sync: SCIM 2.0 endpoint per directory, `directory_users`, `directory_groups` | SCIM requests from a fake IdP (or tests) become `dsync.*` events |
| `GET /events`, webhooks with `WorkOS-Signature` | same shapes and signature scheme |

Protocol handling inside the emulator is real, not mocked: **SAML** via BoxyHQ `@boxyhq/saml-jackson` (26.x on npm,
Apache-2.0, the engine behind Ory Polis — itself an open-source WorkOS alternative) and **OIDC** via
`openid-client`. The IdPs are fakes too:

| Fake IdP (`fake-services/idp-*`) | Built with | Emulates |
| --- | --- | --- |
| `idp-oidc` (`:9400`) | `oidc-provider` (panva, OpenID-certified) | Okta / Entra ID / Google Workspace over OIDC: users, groups claim, `amr`, MFA toggle per user, `prompt=login` |
| `idp-saml` (`:9410`) | `samlify` as IdP | ADFS / Entra over SAML: signed assertions, AuthnContextClassRef, group attributes |

Both have login pages a Playwright test can fill and `/__control` APIs to create users/groups and set "next login
uses MFA: yes/no". Keycloak was considered and rejected for local use (Java, containers).

**Drift risk**: the emulator can drift from WorkOS. Mitigation: a contract test suite (`fake-services/workos/contract`)
runs the same scenarios against the WorkOS **staging** environment (self-serve, free) in CI when `WORKOS_API_KEY` is set,
and against the emulator always.

## Our own MFA (password users, step-up)

- **Passkeys (WebAuthn)** with `@simplewebauthn/server` 14.x — phishing-resistant, preferred.
- **TOTP** (RFC 6238) with `otplib` 13.x — fallback; secrets encrypted with the KEK (see 10), 10 recovery codes (hashed).
- Sign-in returns `{ mfaRequired, mfaToken }` or `{ mfaEnrollmentRequired, enrollmentToken }` (contract already in the
  e2e suite, FIA-08/STAFF-01); `POST /auth/mfa/verify`, `/auth/mfa/totp/enroll|confirm`, `/auth/mfa/webauthn/*`.
- Tenant security policy (`/security/policy`, `security:manage`): `requireMfa` (default true), `enforceSso` per verified
  domain, session lifetime, idle timeout, `requireIdpMfaEvidence`, step-up actions list.
- Factories in the e2e suite enrol TOTP automatically (the helper `support/totp.ts` exists).

## Data model

`sso_identities(tenant_id?, user_id | staff_id, provider, organization_id, connection_id, idp_id, last_login_at)`,
`tenant_security_policies`, `mfa_factors(user kind, user id, type, secret_ciphertext | credential_id + public_key,
counter, created_at, last_used_at)`, `mfa_recovery_codes`, `sso_role_mappings`. Columns on `tenants`:
`workos_organization_id`.

## e2e

- FIA-06 (exists): e-mail first, redirect to the fake IdP, back in the workspace with the mapped role; enforced SSO
  refuses passwords; a domain not verified cannot be enforced.
- FIA-07 (exists): SCIM creates, updates, deactivates members (sessions revoked).
- FIA-08 (exists): MFA policy for password users.
- STAFF-01 (exists): staff sign in through company SSO; break-glass requires a passkey.
- New **SEC-01 Step-up**: filing a SAR asks for a passkey even after SSO (Chromium virtual authenticator).
- New **SEC-02 IdP MFA evidence**: with the policy on, a fake-IdP login without `amr=mfa` is stepped up / refused.

## Gaps and decisions

| Topic | Gap / decision |
| --- | --- |
| WorkOS region | confirm data residency options (EU institutions may require EU processing) and add WorkOS to the DORA/GDPR subprocessor register |
| WorkOS pricing | per SSO/SCIM connection; decide whether it is passed through to institutions |
| Alternatives if WorkOS is rejected | Ory Polis (self-hosted Jackson — the emulator's engine, so the port already fits), Stytch B2B, Auth0 Organizations, Descope (previously used); each needs its own adapter behind the same port |
| Sessions after SSO | keep ours (Redis); IdP logout (SLO) is not propagated by WorkOS — document that deprovisioning goes through SCIM |
| Clients | out of scope for the broker; passkeys for clients later |
