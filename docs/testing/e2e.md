# End-to-end tests

`apps/e2e` holds the persona flows of [../product/flows.md](../product/flows.md) as executable tests
(Playwright Test 1.58): HTTP-level contracts (`*.api.spec.ts`) and **user journeys driven through the web app**
(`*.ui.spec.ts`: each persona in its own browser context, clicking through the back office, the client portal, the
platform console and an embedded form on a separate website). Tests of flows that are not built yet **fail on
purpose**: the suite is also the backlog in executable form. [flow-status.md](flow-status.md) shows where each flow
stands (`flow-status` also updates the status column of the flow catalogue).

## Running

```sh
bun run stack:test                          # starts the stack if needed, runs everything, updates flow-status
# or, with the stack running (bun run stack --detach):
bun run --cwd apps/e2e test                 # everything (api + ui projects)
bun run --cwd apps/e2e test:api             # HTTP-level flows only (no browser)
bun run --cwd apps/e2e test --grep @FIA-04  # one flow
bun run --cwd apps/e2e test --grep @client  # one persona
bun run --cwd apps/e2e flow-status          # rewrite docs/testing/flow-status.md from the last run
bun run --cwd apps/e2e report               # HTML report with traces of failures
```

- Browsers: `bunx playwright install chromium` once, or point `PLAYWRIGHT_BROWSERS_PATH` at pre-installed browsers
  (offline machines: Playwright 1.58 uses Chromium build 1208). `E2E_CHROMIUM_PATH` overrides the executable.
- `E2E_START_STACK=1` makes Playwright start Postgres, Restate and the dev servers itself (reusing running ones).
- The global setup fails fast with instructions when the API, Restate or the seeded staff account is missing, and
  creates the external "core banking" database used as a tenant data source.
- Point the suite elsewhere with `E2E_API_URL`, `E2E_WEB_URL`, `E2E_BASE_DOMAIN`, `E2E_OUTBOX_DIR`, … (`support/env.ts`).

## Layout and conventions

```
apps/e2e
├── playwright.config.ts      projects: api (*.api.spec.ts), ui (*.ui.spec.ts, Chromium)
├── fixtures/workflows        workflow definitions of the banking scenarios (target component names)
├── support                   api client, factories, mailbox, scenario helpers, fakes, totp, catalog,
│                             ui (persona pages, queue/decision helpers, embedded forms), website (fake bank site)
└── tests
    ├── staff/                STAFF-*
    ├── fi-admin/             FIA-*
    ├── fi-roles/             DES-*, REV-*, SUP-*, CMP-*, RM-*, AGT-*, INT-*, AUD-*, authorization matrix (X-02)
    ├── clients/              CLI-*
    ├── cross-cutting/        X-*
    └── scenarios/            SCN-* (banking stories across personas)
```

- Every `describe` carries its flow id as a tag (`{ tag: ['@reviewer', '@REV-01'] }`); a test may carry several ids.
- Tests are **black-box**: they go through the public API/UI like the personas would. The owner database connection
  is only used to prepare the environment and for white-box *security* assertions (grants on the audit table,
  secrets not stored in clear text). `support/catalog.ts` restates the authorization spec instead of importing the
  implementation, so docs/code drift shows up as failures.
- Isolation: each file onboards its own institution through the real staff flow (`createTenant`) and deletes it at the
  end (suspend, then delete). Files run in parallel (4 workers); tests in a file run in order.
- E-mail is read from the outbox (`EMAIL_PROVIDER=outbox`) with `waitForEmail`; links and one-time codes are taken
  from the message like a person would.
- Contracts the tests use that do not exist yet are listed in the architecture docs (API tables); they are the
  target, and can be changed together with the tests.
- When MFA becomes mandatory by default (FIA-08), the factories will enrol TOTP for the accounts they create.

### UI journeys

- `personaPage(browser, tenant, session, path)` opens a separate browser context per persona (sessions are injected:
  only tests about signing in use the sign-in form). Locators are user-facing (roles, labels, visible text);
  `data-testid` is used for rows and values (`task-row`, `case-status`, `timeline`…).
- `FakeWebsite` (`support/website.ts`) is a real HTTP server on another loopback origin that serves the institution's
  website with the embed snippet pasted in, so browsers apply their real cross-origin rules (CSP `frame-ancestors`,
  private network access) — `page.route` would not.
- Multi-persona journeys are serial within a file and get a 120 s timeout (several contexts; slower when the whole
  suite runs in parallel). Asynchronous work (durable executions, e-mails) is awaited through the UI (auto-refreshing
  lists) or `waitForEmail`, never with fixed sleeps.

## Expected failures

A failing test must fail **for the reason it describes** (missing endpoint, rule not enforced, fake not running),
never because of the harness. Typical messages today:

| Message | Meaning |
| --- | --- |
| `HTTP 404: Cannot POST /integrations` | endpoint not built |
| `Fake "didit" is not running at http://localhost:9401` | the local fake for that vendor is not built yet |
| `HTTP 200` where `403` was expected | a rule (authorization, SoD, escalation) is not enforced yet |

## Fakes

External systems are replaced by local fakes that follow the vendors' contracts: `fake-services/<name>`, small Bun
servers built on `packages/fake-kit`, started by `bun run stack` (ports in `dev/ports.json`). Each has:

- `GET /__health`, `GET /__control/requests`, `POST /__control/reset`,
- `/__control/*` to set the next outcome and read what it received (`support/fakes.ts`: `requireFake`,
  `controlFake`, `fakeRecords`),
- the vendor-facing API the platform (or a connector) calls, and the webhooks/callbacks the vendor would send.

| Fake | Port | Used by | Contract and controls |
| --- | --- | --- | --- |
| Mailbox | 8025 (SMTP 1025) | every e-mail; INT-04 (as the bank's SMTP server) | `smtp-server` + web inbox; `GET /api/messages?to=`; the password `wrong` is refused |
| WorkOS emulator | 9300 | FIA-06, FIA-07, staff SSO | organizations, domains (DNS TXT via `/__control/dns`), Admin Portal pages, SSO authorize/token, SCIM directories, events; the real `@workos-inc/node` SDK talks to it |
| OIDC identity provider | 9400 | SSO | discovery, JWKS, login form (`login`/`password`), RS256 ID tokens with `groups`/`amr`; `/__control/clients`, `/__control/users` |
| Didit | 9401 | SCN-01/02/03/07/09, CLI-04, CLI-08 | sessions, decisions, hosted page speaking the web SDK's postMessage protocol, signed webhooks; `/__control/decisions` per applicant e-mail (`Approved`, `Declined`, `In Review`, `Abandoned` = never completes) |
| Documenso | 9402 | SCN-01, CLI-06 | v2 API subset from `docs/vendor-api/documenso-openapi-v2.json`, signing page, webhooks; `/__control/signatures` per signer |
| Webhook receiver | 9404 | X-07, WH-01/02 | records deliveries per path, verifies Standard Webhooks signatures (`/__control/secrets`), `/__control/fail-next`, `/__control/respond` |
| Screening | 9407 | SCN-05, CMP-01 | `POST /v1/searches`; `/__control/results` per subject name |
| DNS | 9408 | FIA-03 | DNS-over-HTTPS JSON `/resolve`; `/__control/records` |
| Malware scanner | 9501 | UPL-02 | flags the EICAR test string; `/__control/fail-next` |
| Sanitiser | 9502 | UPL-04 | rebuilds PDFs without active content, strips image metadata; `/__control/fail-next` |

The external **core banking database** is real: `fi_core_banking` on the embedded Postgres with tables `customers`,
`accounts`, `credit_scores` and a read-only login `core_banking_reader` (created by `support/global-setup.ts`), used
through the `postgres-datasource` connector. Connectors (`integrations/*`) run as real services against these fakes.

## Tooling decisions

| Need | Choice | Why |
| --- | --- | --- |
| e2e runner | Playwright Test | one runner for API and browser flows, traces, tags, parallelism; industry default |
| Browser | Chromium (Desktop Chrome profile) | Firefox/WebKit can be added as projects later |
| TOTP in tests | `support/totp.ts` (RFC 6238, 20 lines) | avoids a dependency for code generation |
| Passkeys in tests | Chromium virtual authenticator (CDP `WebAuthn.addVirtualAuthenticator`) | no hardware needed |
| SSO in tests | WorkOS emulator + a small OIDC IdP fake (SAML fake planned) | offline, same SDK as production, no Keycloak/containers |
| E-mail in tests | the local mailbox (SMTP + REST) | the API sends real SMTP; tests read `GET /api/messages` |
| Second factors | the suite enrols TOTP like a person and computes codes; one staff session per run (`.auth/`) | codes are single-use per 30 s window |
