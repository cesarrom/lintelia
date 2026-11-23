# Lintelia

Multi-tenant onboarding and KYC workflow platform for financial institutions.

- **Platform staff** (us) onboard financial institutions (tenants).
- **Tenants** configure their operation: flows (workflows), forms, roles, users, branding, domains.
- **Clients** (the institutions' end users) go through those flows.

| Path | What |
| --- | --- |
| `apps/core` | API: NestJS on Hono, served by Bun. Durable workflow execution on [Restate](RESTATE.md) (`/restate`). |
| `apps/web` | Vite + React app (platform staff app, tenant back-office, client-facing forms). |
| `packages/lintelia` | Shared Drizzle schema (entities + RLS policies), zod schemas, workflow utilities. |
| `packages/connector-sdk` | Build connectors: manifest, signed core requests, core client, encrypted secrets, settings pages. |
| `integrations/*` | Connectors (separate services with their own databases): smtp-mailer, postgres-datasource, didit, documenso, screening, http (any REST API + its webhooks), ai (document extraction, summaries), loanpro (loan servicing). |
| `fake-services/*` | Local stand-ins for vendors (WorkOS, OIDC IdP, Didit, Documenso, screening, LLM, LoanPro, QuickBooks, Google Sheets, mailbox, webhook receiver, DNS, scanner, sanitiser). |
| `apps/core/src/solutions` | Ready-made solutions (workflows, functions and a client app wired to the institution's connections): dealer finance. |
| `apps/e2e` | Playwright suite (API and UI journeys per persona and flow). |
| `dev/`, `scripts/stack.ts` | The one-command local stack. |

## Quick start

Requirements: [Bun](https://bun.sh) 1.3.x (`npm i -g bun@1.3.14` works offline against the npm registry), a normal
(non-root) user. No Docker: Postgres, Redis, Restate, the connectors and every fake vendor run as local processes.

```sh
bun install              # Ubuntu review guide: docs/SUBMISSION-RUN.md (Restate is also vendored under vendor/restate)
bun run stack            # installs, creates .env files, starts everything, migrates, seeds, registers connectors
```

`bun run stack --detach` runs it in the background; then `bun run stack:status`, `bun run stack:logs [service]`,
`bun run stack:restart <service>`, `bun run stack:stop`; `bun run stack:reset` wipes local state; `bun run stack:doctor`
checks the machine. **`bun e2e`** runs the end-to-end suite: it attaches to the running stack or starts it (a partially
up stack is refused: `bun e2e --force` restarts everything), and on a machine with a screen the browser tests run in
windows you can watch (`--headed` / `--headless` to choose; [docs/testing/e2e.md](docs/testing/e2e.md#running-the-suite)). Services, ports and
dependencies: [dev/stack.config.ts](dev/stack.config.ts), [dev/ports.json](dev/ports.json); logs in `.data/stack/logs/`.
Demo data helpers (`bun run demo:workflows`, `demo:case`, `demo:token`, `demo:files`) and every local credential are in
[TESTING.md](TESTING.md).

| Service | URL | What |
| --- | --- | --- |
| Back office, portal, platform console | http://localhost:3001, http://demo-bank.localhost:3001 | web app (Vite) |
| API | http://localhost:8000 | NestJS on Hono (Bun); Restate endpoint `/restate` |
| Mailbox | http://localhost:8025 | every e-mail the stack sends (SMTP :1025), with a REST API for tests |
| Connectors | :4101 smtp-mailer, :4102 didit, :4103 documenso, :4104 postgres-datasource, :4105 screening, :4106 http, :4107 ai, :4108 loanpro | separate services, own databases |
| Fakes | :9300 WorkOS, :9400 OIDC IdP, :9401 Didit, :9402 Documenso, :9404 webhook receiver, :9407 screening, :9408 DNS, :9409 LLM, :9410 LoanPro, :9411 QuickBooks, :9412 Google Sheets, :9501 scanner, :9502 sanitiser | vendors we cannot reach locally, same APIs |
| Demo Auto Finance | http://demo-auto.localhost:3001 | dealer finance: the dealer & borrower portal, wired to the fakes by the stack |
| Demo Bank website | http://localhost:4000 | the loan form embedded on a third-party site |
| Restate admin | http://localhost:9070 | durable executions |

Seeded accounts (password `lintelia-dev-password`, override with `SEED_PASSWORD`):

| Where | Account | Role |
| --- | --- | --- |
| http://localhost:3001/sign-on | `staff@lintelia.local` | platform staff (`platform_admin`). Staff always use a second factor: `bun run totp` prints the current code (development TOTP secret in `apps/core/scripts/seed.ts`) |
| http://demo-bank.localhost:3001/sign-on | `admin@demo-bank.test` | Demo Bank administrator |
| | `compliance@demo-bank.test` | compliance officer / MLRO |
| | `lead@demo-bank.test`, `senior@demo-bank.test` | senior reviewers (second approvals, investigations) |
| | `analyst@demo-bank.test` | reviewer (first-line queue) |
| | `rm@demo-bank.test` | relationship manager (assisted applications, flags clients, waives fees up to £50) |
| | `designer@demo-bank.test` | flow designer (forms, workflows, the client app and back-office studio) |
| | `integrations@demo-bank.test`, `support@demo-bank.test`, `auditor@demo-bank.test` | integration manager, support agent, auditor |
| | `client@demo-bank.test` | Chris Client, an existing Demo Bank customer: the banking app (accounts, cards, transactions) at `/portal` |
| http://acme-credit.localhost:3001/sign-on | `admin@acme-credit.test` | Acme Credit Union administrator |
| http://demo-auto.localhost:3001/sign-on | `underwriter@demo-auto.test`, `funding@demo-auto.test`, `admin@`, `designer@`, `integrations@demo-auto.test` | Demo Auto Finance: underwriting (reviewer), funding (senior reviewer), admin, designer, integrations |
| | `dealer@sunrise-motors.test` | a dealer (Sunrise Motors) in the dealer portal at `/portal` |

The seeded institutions do not require a second factor for their members (development convenience); new
institutions do (members enrol an authenticator app on first sign-in).

Try the journeys (each is an e2e test in `apps/e2e/tests`):

1. **The experience map** ([docs/changes/0009](docs/changes/0009-experience-map.md)): as `designer@demo-auto.test` or
   `designer@demo-bank.test`, *Build → Map* — the app's layout, pages, journeys with their screens and what happens
   in between, workflows, functions, forms and events on one canvas; click inside a frame to follow a link, *Edit* to
   open the right editor.

2. **Live data and events** ([docs/changes/0014](docs/changes/0014-live-data-and-events.md)): pages update by
   themselves (the **Live** dot in the top bar) — the banking app's balances and notifications, the team's queues and
   tasks, journeys' progress. Workflows wait for events *about* a case (`event.wait` by business key: a loan, a card),
   one case per loan receives every payment (start-or-deliver), `poll` asks a system until something holds, and
   `live.publish` tells a screen, the applicant, a member, a role or a webhook subscription as it happens.

3. **The institution's own back office** ([docs/changes/0013](docs/changes/0013-back-office.md)): as `rm@demo-bank.test`,
   *Servicing → Servicing desk* and, on *Clients → Chris Client*, *Waive a fee* (a staff screen in a dialog; above £50 a
   senior reviewer approves) and the *Servicing* tab. As `designer@demo-bank.test`, *Build → Back office*: pages, actions,
   buttons and tabs on the client and case pages, dashboard widgets, menu items — each with *Who gets it*; *Preview as* a
   role and *Who gets what*.

4. **Who sees what** ([docs/changes/0012](docs/changes/0012-access-control.md)): as `admin@demo-bank.test`,
   *Administration → Roles*: the matrix, a role's members and what it opens, *New permission* and *Extend* a system role;
   *Team → Access* on a member; *Settings → Security*: a second administrator for access changes and the mappings of
   your identity provider's groups to roles (used as soon as single sign-on is linked); *Access changes* lists what waits and what happened.
   As `designer@demo-bank.test`, a workflow's settings say who may start it (publishing such a change waits for an
   administrator).

5. **UI building blocks** ([docs/changes/0011](docs/changes/0011-ui-building-blocks.md)): as `client@demo-bank.test`,
   the amber **Pay** button opens *Pay with a QR code* full screen — scan a code from `bun run demo:files`
   (`.data/demo-files/pay-*.gif`: camera, photo or typed); codes with an amount continue by themselves after a
   countdown. *Pay with QR* in the quick actions opens it as a sheet. As `designer@demo-bank.test`, *Client app →
   Settings → Appearance*: presets, accent, fonts, button shapes, colours from the logo, a readability check.

6. **The banking app** (client apps, [docs/changes/0007](docs/changes/0007-client-apps.md)): sign in as `client` at
   http://demo-bank.localhost:3001/portal — balances, transactions, insights; *Move money*, freeze a card, apply for a
   loan. Sign up as a new client ("Create account") and *Open your first account* (upload any PDF; `analyst` approves the
   KYC review). As `designer`, *Build → Client app* is the studio (live preview, publish). The same app embedded in the
   bank's own site with the SDK: http://localhost:4000/online-banking.

7. **Dealer finance** ([docs/changes/0008](docs/changes/0008-dealer-finance.md), journey J19 in
   [TESTING.md](TESTING.md)): as `dealer@sunrise-motors.test` at http://demo-auto.localhost:3001/portal *Submit a deal*
   with the stipulations from `bun run demo:files`; `underwriter` sees the AI's reading and the numbers (*Cases →
   Pipeline*, *Tasks*), asks for more, approves; contracts are signed (Documenso), `funding` funds; QuickBooks
   (:9411), the deal log (:9412) and LoanPro (:9410) fill up; the buyer signs in to their new app and pays. Watch the
   whole story in browser windows: `bun e2e --headed tests/scenarios/dealer-finance.ui.spec.ts`.

8. **Loan pre-approval from the bank's website**: open http://localhost:4000 (Demo Bank's public site with the form
   embedded). Apply, confirm with the code e-mailed to you (open http://localhost:8025). Up to 10,000 and affordable:
   pre-approved at once; above: `analyst` decides in *Tasks*; above 50,000: `lead` **and** `senior` must both approve.
9. **Suspicious activity**: as `rm`, *Clients → Chris Client → Flag suspicious activity*; `analyst` triages, `lead`
   investigates (can ask the client for documents), `compliance` files the SAR / exits / closes. The client never sees
   the investigation.
10. **Connect a system**: as `integrations`, *Integrations → SMTP mailer → Connect*: you land on the connector's own page
   (host `localhost`, port `1025`, any user/password except `wrong`); back in Lintelia the connection is active and the
   workflow editor offers "Send e-mail (your server)". Didit, Documenso and PostgreSQL data sources work the same way.
11. **Identity verification and signature**: a workflow with `connector:didit/kyc.verify` and
   `connector:documenso/signature.request` steps (see `apps/e2e/fixtures/workflows/retail-account-opening.yaml`): the
   client verifies and signs inside the portal on the vendors' (fake) pages; decisions arrive by signed webhooks.
12. **Documents**: a `client.request` step with a `file` item: the client uploads in the portal; files are scanned
   (EICAR is refused), sanitised (PDF scripts removed) and only then reach the case.
13. **API clients and webhooks**: *API clients* (OAuth client credentials) and *Webhooks* (Standard Webhooks, retries,
   delivery log). Webhook deliveries can be watched at http://localhost:9404.
14. **Single sign-on**: *Settings → Security*: open the Admin Portal (WorkOS emulator), add a domain, "publish" its TXT
   record with `POST http://localhost:9300/__control/dns`, and connect the fake IdP (register a client with
   `POST http://localhost:9400/__control/clients`). The e2e helper `apps/e2e/support/sso.ts` does exactly this.

Each tenant is served on `<tenant>.<BASE_DOMAIN>` (`*.localhost` resolves to 127.0.0.1 in browsers) or on any custom
host listed in its `allowed_domains`. Server-side code uses `localhost:<port>` (Bun does not resolve `*.localhost`).

Without the stack script, the pieces still start one by one: `bun run db:start`, `bun run redis:start`,
`bun run restate:serve`, `bun run dev` (see `dev/stack.config.ts` for the commands of the connectors and fakes).

Other commands (run from the repository root or `apps/core`):

```sh
bun run db:reset        # drop + recreate the dev database, migrate, seed
bun run db:seed         # (re)seed development data, idempotent
bun run --cwd apps/core db:generate   # generate a migration after changing packages/lintelia/src/entities
bun run --cwd apps/core test          # RLS + authentication tests (needs db:start running)
bun run --cwd apps/core check-types
bun run totp            # current second-factor code of the seeded staff account
```

## Tenancy and security model (current)

- **One Postgres database** for platform and tenant data. Every tenant-owned table has a `tenant_id` and a row level
  security policy declared with Drizzle `pgPolicy` (`packages/lintelia/src/entities/rls.ts`).
- The API connects as two **restricted roles** (never a superuser, no `BYPASSRLS`):
  - `lintelia_app`: tenant data. Each statement runs in a transaction that first calls
    `set_config('app.tenant_id', <tenant>, true)`; without it the policies match nothing.
  - `lintelia_platform`: tenant directory and staff accounts only; no access to tenant data.
  The owner role is only used by `scripts/db.ts` to run migrations.
- Child rows reference parents through composite `(tenant_id, id)` foreign keys, because foreign key checks bypass RLS.
- **Authentication** is a local provider (`apps/core/src/auth`): users in Postgres, argon2id passwords, 15-minute
  access tokens backed by server-side sessions in Redis (rotating refresh tokens, revocation, lockout), e-mailed
  one-time codes for clients. A member/client token is pinned to its tenant; presenting it to another tenant makes the
  request anonymous. Staff tokens never carry a tenant. Second factor (TOTP + recovery codes) for staff always and for
  members when the institution requires it (default); single sign-on through the SSO broker (WorkOS; its emulator
  locally) with enforcement per verified domain and just-in-time accounts; OAuth client credentials for the
  institutions' systems. See [docs/architecture/identity.md](docs/architecture/identity.md).
- **Integrations** are connectors: separate services with their own databases and secrets, installed by institutions
  through the connectors' own pages, contributing workflow steps (docs/architecture/integrations.md).
- **Authorization**: permission catalogue, system and custom roles (`docs/architecture/authorization.md`). Every route
  declares `@Require(permission)`, `@RequirePlatform(permission)`, `@Access(kind)` or `@Public()`; undeclared routes
  are refused. Case scope, segregation of duties and four-eyes are enforced in the services.
- **Cases and workflows**: published workflow versions run durably on Restate (`caseRun`); see
  [docs/architecture/cases-and-workflows.md](docs/architecture/cases-and-workflows.md).
- `apps/core/test` proves the above against the restricted roles (`bun test`).

## Documentation

- [TESTING.md](TESTING.md): how to test everything locally — what changed, start the stack, credentials, validation
  commands, supporting/demo commands and step-by-step journeys
- [docs/README.md](docs/README.md): index (personas, flows, architecture, testing, change log)
- End-to-end suite: `bun e2e` (starts or attaches to the stack), progress per flow: `bun run e2e:status` →
  [docs/testing/flow-status.md](docs/testing/flow-status.md)

Third-party software: `vendor/restate/` holds the Restate server binary under Restate's own Business Source License 1.1, not this repository's MIT license ([THIRD-PARTY.md](THIRD-PARTY.md)).
