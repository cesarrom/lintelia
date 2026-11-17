# Testing Fintivio locally

This guide covers testing the platform on your own machine:

1. [What changed](#1-what-changed) in the latest batch (0004) and where it lives.
2. [How to start the local server](#2-start-the-local-server): one command, plus the ports, URLs and reset options.
3. [Local credentials](#3-local-credentials): seeded accounts, second factors, connector settings, fake vendors.
4. [Commands to validate the implementation](#4-validate-the-implementation-automated): the e2e suite, unit tests,
   type checks, migrations.
5. [Supporting commands](#5-supporting-commands): demo helpers, the mailbox, TOTP codes, the fakes' control APIs,
   logs and Restate.
6. [Journeys to test by hand](#6-journeys-to-test-by-hand): for each one, who signs in, what to run first, the steps,
   what to expect and which e2e test covers it.
7. [Troubleshooting](#7-troubleshooting).

Everything runs offline: no Docker and no cloud accounts. The vendors the platform talks to (WorkOS, an identity
provider, Didit, Documenso, a screening vendor, an SMTP server, DNS, a malware scanner, a content sanitiser) are
local fakes that use the vendors' API shapes.

---

## 1. What changed

Latest batches (details in `docs/changes/`):

| Batch | What | Try it |
| --- | --- | --- |
| [0011](docs/changes/0011-ui-building-blocks.md) | **UI building blocks**: journeys open as a dialog, a sheet or full screen (floating button, quick actions, deep links); QR / barcode **scanner** reading payment codes; screens that **continue by themselves**; signature, one-time code, slider, calculated and conditional fields, format rules; **branding** (presets, accent, fonts, button shapes, light/dark, colours from the logo, readability) and region. Banking app: **Pay with a QR code** | journey [J21](#j21--pay-with-a-qr-code-and-brand-the-app) |
| [0010](docs/changes/0010-bun-e2e.md) | **`bun e2e`** runs the end-to-end suite in one command: attaches to the stack or starts it (refuses a partially up stack unless `--force`), decides headed or headless, runs, updates flow-status | `bun e2e` (§4) |
| [0009](docs/changes/0009-experience-map.md) | **Experience map** (experiment): the layout, pages, journeys with their screens and what happens in between, workflows, functions, forms and events on one Figma-like canvas; follow links, personas, layers, open each editor and come back | *Build → Map*, journey [J20](#j20--the-experience-map) |
| [0008](docs/changes/0008-dealer-finance.md) | **Dealer finance** (indirect auto lending) and the automation building blocks behind it: business **stages** and a pipeline board, **functions** (workflows used as steps), **signals** (other systems call a case back), the generic **HTTP connector**, an **AI** connector (document extraction, summaries), **LoanPro**, workflows that create clients (`client.upsert`); fakes for LoanPro, QuickBooks, Google Sheets and an LLM | journey [J19](#j19--dealer-finance-from-the-deal-to-the-borrowers-payments); `http://demo-auto.localhost:3001` |
| [0007](docs/changes/0007-client-apps.md) | **Client apps**: a studio to build the institution's app for its clients (pages of widgets, journeys run by workflows), the banking template, the client SDK (embedded app) | `http://demo-bank.localhost:3001/portal` as `client@demo-bank.test` |
| [0006](docs/changes/0006-ui-redesign.md) | UI redesign (back office, portal, dark mode) | — |
| [0005](docs/changes/0005-visual-e2e.md) | **Visual e2e**: watch the browser journeys in real windows when a display is available | `bun e2e` (headed when possible) |

Batch 0004 implemented most of the roadmap in `docs/plans/` (M0–M9). The detailed change log is
[docs/changes/0004-platform-capabilities.md](docs/changes/0004-platform-capabilities.md).

| Area | What changed | Where |
| --- | --- | --- |
| **Local stack** | `bun run stack` starts everything with one command: Postgres, Redis, Restate, API, web, the shared package watcher, 5 connectors and 11 fake vendors. It also migrates, seeds, creates the connector databases and a sample "core banking" database, and registers the connectors. Subcommands: `status`, `logs`, `restart`, `stop`, `reset`, `doctor`, `test`. | `scripts/stack.ts`, `dev/stack.config.ts`, `dev/ports.json` |
| **Fake vendors** | Mailbox (SMTP + web inbox + REST), WorkOS emulator, OIDC identity provider, Didit, Documenso, screening, webhook receiver, DNS, malware scanner, sanitiser. | `fake-services/*`, `packages/fake-kit` |
| **Workflow components** | One component catalogue shared by the editor (palette, generated config forms, event handles), publish validation and the engine. New components: `task`, `form.request`, `parties.collect`, `parties.wait`, `parties.update`, `foreach`, `workflow.call`, plus `connector:<id>/<key>` components from connections. | `apps/core/src/engine/components`, `apps/web/.../workflows/components/catalog` |
| **Connectors** | Integrations are separate services, each with its own database and its own encrypted secrets: **smtp-mailer**, **postgres-datasource**, **didit** (identity verification), **documenso** (e-signature), **screening** (AML). The core adds a registry (staff approve or revoke versions), installations (the *Integrations* page, consent, the connector's own settings pages), the connector API (`private_key_jwt`, installation tokens, async completion, case records, documents, events) and client steps in the portal. | `integrations/*`, `packages/connector-sdk`, `apps/core/src/integrations` |
| **API clients and webhooks** | OAuth client credentials (`/oauth/token`) with rate limits and `Idempotency-Key`. `POST /events` starts workflows (`startOn: api:<type>`). Signed outbound webhooks (Standard Webhooks) with durable retries, a delivery log, resend, secret rotation and disabling. | `apps/core/src/api-clients`, `apps/core/src/webhooks`, *API clients* and *Webhooks* pages |
| **File uploads** | Upload intents, signed upload URLs into quarantine, and a durable intake (type sniffing → malware scan → sanitisation → rescan). Signed 60-second downloads. A portal uploader; files shown on the case and in tasks. | `apps/core/src/files` |
| **Identity** | TOTP second factor with recovery codes: always for staff, and for members when the institution requires it (the default). Single sign-on through WorkOS for institutions and for staff (Admin Portal, verified domains, enforcement, just-in-time accounts). Directory sync (SCIM). Custom domains proven by DNS TXT. | `apps/core/src/auth`, *Settings → Security*, *Platform → Staff* |
| **Related parties** | Co-applicants, guarantors and beneficial owners get single-use invitation links and see only their own part. A sub-workflow runs per party. Sticky task routing lets one person handle every party. | `apps/core/src/engine/components/parties.ts`, `apps/core/src/services/parties.service.ts` |
| **Removed** | The legacy node engine (its public Restate handlers carried user tokens into the journal), DocuSeal, ComplyCube. | — |
| **Testing helpers** | `bun run demo:workflows`, `demo:case`, `demo:token`, `demo:files`, `totp`; the sample core banking database created by the stack. | `apps/core/scripts/demo.ts`, `apps/core/scripts/connectors.ts` |

State of the suite at the end of the batch: **404 e2e tests, all passing**, covering 84 flows
([docs/testing/flow-status.md](docs/testing/flow-status.md)). Core unit tests: 41 passing.

---

## 2. Start the local server

### Requirements

- [Bun](https://bun.sh) **1.3.x**. `npm i -g bun@1.3.14` works, including against an offline npm mirror.
- A normal (non-root) user: the embedded Postgres refuses to run as root.
- About 2 GB of free disk.
- For the e2e browser tests only: Chromium for Playwright. Run `bunx playwright install chromium` once, or set
  `PLAYWRIGHT_BROWSERS_PATH` to pre-installed browsers (Playwright 1.58 expects Chromium build 1208).

### One command

```sh
bun run stack                 # foreground: colour-prefixed logs; Ctrl-C stops everything it started
# or
bun run stack --detach        # background; returns when every service is healthy (about 25 s warm, a few minutes the first time)
```

The first run installs dependencies and creates `apps/core/.env` and `apps/web/.env` from their `.env.example` files,
generating a development `AUTH_JWT_SECRET`. It then initialises Postgres, migrates the dev and test databases, seeds
them, builds the shared package, creates one database per connector plus the sample `fi_core_banking` database, and
registers and approves the connectors.

| Command | What it does |
| --- | --- |
| `bun run stack:status` | one line per service: up/down, health check, pid |
| `bun run stack:logs [service]` | tails `.data/stack/logs/<service>.log` (all services without an argument) |
| `bun run stack:restart <service> [...]` | restarts services of the running stack (e.g. `api`, `workos`, `connector-didit`) |
| `bun run stack:stop` | stops what the stack started |
| `bun run stack:reset` | stops, **wipes local state** (databases, Redis, Restate, fakes, connectors), starts again; add `--no-start` to only wipe |
| `bun run stack:doctor` | checks Bun version, root user, disk space, busy ports, missing `.env` files |
| `bun e2e [--attach\|--force] [--headed\|--headless] [--keep] [playwright args]` | the e2e suite: attaches to the stack or starts it (refuses a partially up stack unless `--force`), decides headed/headless, runs, regenerates flow-status (§4) |
| `bun run stack --profile core` | only what the back office needs (no connectors, no third-party fakes, no demo site) |
| `bun run stack --only api,web` / `--skip demo-site` | choose services (dependencies are added automatically) |

Services that are already running and healthy (started another way) are reused, not started twice.

### URLs and ports

| Service | URL | Notes |
| --- | --- | --- |
| Platform console (staff) | http://localhost:3001 | the platform host (no institution) |
| Demo Bank back office and client portal | http://demo-bank.localhost:3001 (`/app/...`, `/portal`) | each institution is served on `<key>.localhost:3001` |
| Acme Credit Union | http://acme-credit.localhost:3001 | second seeded institution |
| Demo Auto Finance (dealer finance) | http://demo-auto.localhost:3001 (`/app/...` back office, `/portal` dealer & borrower portal) | connected to the fakes and set up by the stack (`demo-auto-finance` task) |
| API | http://localhost:8000 | `GET /health`; Restate endpoint at `/restate`; core JWKS at `/.well-known/jwks.json` |
| Mailbox (every e-mail sent) | http://localhost:8025 | SMTP on `localhost:1025`; REST `GET /api/messages?to=` |
| Demo Bank public website | http://localhost:4000 | the loan form embedded on a third-party site; `/online-banking`: the banking app embedded with `@fintivio/client-sdk` |
| Restate | ingress http://localhost:8080, admin http://localhost:9070, UI http://localhost:9070/ui/ | durable executions (`caseRun`, `webhooks`, `fileIntake`) |
| Postgres | `localhost:5433` (owner `postgres` / `postgres`) | databases `fintivio`, `fintivio_test`, `connector_*`, `fi_core_banking` |
| Redis | `localhost:6380` | sessions, one-time codes, rate limits |
| Connectors | smtp-mailer :4101, didit :4102, documenso :4103, postgres-datasource :4104, screening :4105, http :4106, ai :4107, loanpro :4108 | each serves `/.well-known/fintivio-connector.json` and `/health` |
| Fakes | WorkOS :9300, OIDC IdP :9400, Didit :9401, Documenso :9402, webhook receiver :9404, screening :9407, DNS :9408, LLM :9409, LoanPro :9410, QuickBooks :9411, Google Sheets :9412, scanner :9501, sanitiser :9502 | each has `/__health` and `/__control/*`; LLM, LoanPro, QuickBooks and Sheets show what happened at `/` |

Browsers resolve `*.localhost` to 127.0.0.1; server-side code always uses `localhost:<port>` because Bun does not.
The first page you open after a start can take 20–30 seconds while Vite compiles it.

### Without the stack script

The pieces can still be started one by one, in separate terminals:

```sh
bun install
cp apps/core/.env.example apps/core/.env    # set AUTH_JWT_SECRET (32+ characters)
cp apps/web/.env.example apps/web/.env
bun run db:start         # embedded Postgres :5433 (creates, migrates, seeds on first run)
bun run redis:start      # Redis :6380
bun run restate:serve    # Restate :8080/:9070
bun run dev              # shared package watcher, API :8000, web :3001
bun run demo:site        # Demo Bank website :4000 (optional)
```

For the commands of the connectors and fakes, see `dev/stack.config.ts`: `bun src/index.ts` in each
`fake-services/<name>` and `integrations/<name>` directory. Then run `bun run --cwd apps/core connectors:databases`
and `bun run connectors:register`.

### Local state

Everything lives in `.data/` (stack logs, fakes' state, connectors' keys) and `apps/core/.data/` (Postgres, Redis,
Restate, local object store, signing and encryption keys). `bun run stack:reset` wipes it, except the core's keys.

---

## 3. Local credentials

### Seeded accounts

Password for every seeded account: **`fintivio-dev-password`** (override with `SEED_PASSWORD`).

| Where to sign in | Account | Role / what it is for |
| --- | --- | --- |
| http://localhost:3001/sign-on | `staff@fintivio.local` | platform staff (`platform_admin`). **Second factor required**: the code comes from `bun run totp`. Break-glass account: keeps password + TOTP even when staff SSO is enforced |
| http://demo-bank.localhost:3001/sign-on | `admin@demo-bank.test` (Dana Admin) | administrator: team, roles, security, domains, API clients, webhooks, audit |
| | `compliance@demo-bank.test` (Morgan MLRO) | compliance officer / MLRO: screening hits, investigations, data requests |
| | `lead@demo-bank.test` (Lee Lead), `senior@demo-bank.test` (Jordan Senior) | senior reviewers: high-authority approvals (four-eyes), escalations |
| | `analyst@demo-bank.test` (Alex Analyst) | reviewer: first-line queue |
| | `rm@demo-bank.test` (Riley Relationship) | relationship manager: assisted applications, flags clients |
| | `designer@demo-bank.test` (Devon Designer) | flow designer: forms, workflows, editor |
| | `integrations@demo-bank.test` (Ira Integrations) | integration manager: connections, API clients, webhooks |
| | `support@demo-bank.test`, `auditor@demo-bank.test` | support agent, auditor (read-only oversight) |
| | `client@demo-bank.test` (Chris Client) | a client: the portal at `/portal`. Clients can also use "Email me a code" (any e-mail address creates a client) |
| http://acme-credit.localhost:3001/sign-on | `admin@acme-credit.test` | Acme Credit Union administrator (tenant isolation checks) |
| http://demo-auto.localhost:3001/sign-on | `underwriter@demo-auto.test` (Uma Underwriter) | reviewer: credit decisions on deals |
| | `funding@demo-auto.test` (Frank Funding) | senior reviewer: funding audits, dealer approvals, lien releases |
| | `admin@demo-auto.test`, `designer@demo-auto.test`, `integrations@demo-auto.test` | administrator, flow designer (studio, workflows), integration manager |
| | `dealer@sunrise-motors.test` (Sam Sunrise) | a dealer (client with the `dealer` segment): the dealer portal at `/portal` |

The seeded institutions **do not require** a second factor for members, for convenience. Institutions you create
**do**: their members enrol an authenticator app when they activate their account.

### Second factors (TOTP)

| Need | How |
| --- | --- |
| Code for `staff@fintivio.local` | `bun run totp` prints the current code and the next one. Development secret: `FINTIVIODEVSTAFFSECRETAAAAAAAAAA` (base32; add it to any authenticator app if you prefer) |
| Code for an account you enrolled | the enrolment screen shows the secret (`data-testid="totp-secret"`); `bun run totp <SECRET>` prints its code |
| Lost device | one of the 10 recovery codes shown once after enrolment (each works once) |

A code is accepted only once: within the same 30-second window a second sign-in with the same code is refused, so wait
for the next code.

### Connector settings (what to type on each connector's page)

Connect them as `integrations@demo-bank.test`: *Integrations → Connect*. You continue on the connector's own page;
fill in the values below and click **Test and connect**.

| Connector | Values | Notes |
| --- | --- | --- |
| **SMTP mailer** | host `localhost`, port `1025`, TLS off, username `demo`, password anything **except `wrong`**, from address `no-reply@demo-bank.test`, from name `Demo Bank` | the local mailbox plays the bank's SMTP server; the password `wrong` is refused (shows the credential check) |
| **PostgreSQL data source** | host `localhost`, port `5433`, database `fi_core_banking`, user `core_banking_reader`, password `core-banking-reader-pw`, TLS off, "allow changes" off | sample customers `C-1001` (score 780), `C-1002` (820), `C-1003` (540) |
| **Didit** | API key: any text except `invalid` (e.g. `demo-bank-didit-key`; **use a different key per institution**), webhook secret: any text, workflow id `kyc-standard`, base URL `http://localhost:9401` (default) | the fake routes webhooks by API key, like the Didit console per account |
| **Documenso** | API token: any text except `invalid` (unique per institution), webhook secret: any text, base URL `http://localhost:9402/api/v2` (default) | templates: `Retail account agreement` (id 101, `retail-account-agreement`), `Loan agreement` (102) |
| **AML screening** | API key: any text except `invalid`, base URL `http://localhost:9407` (default) | results are preset per name (see §5) |
| **HTTP API** (Google Sheets) | name `Deal log (Google Sheets)`, base address `http://localhost:9412`, authentication *Bearer token*, token: any text except `invalid` | one connection per API; optional test path, webhook secret (inbound webhooks) |
| **HTTP API** (QuickBooks) | name `QuickBooks Online`, base address `http://localhost:9411`, *Bearer token*, any token except `invalid` | the company (realm) is part of the paths the workflows call |
| **AI assistant** | API base address `http://localhost:9409/v1` (default), API key: any text except one ending in `invalid`, model `fake-extractor-1` | any OpenAI-compatible API in production |
| **LoanPro** | API base address `http://localhost:9410/api/public/api/1` (default), tenant id: any (**unique per institution**), API token: any except `invalid`, webhook secret: any | saving registers the webhook at the fake |

Demo Auto Finance gets these five connections from the stack (`bun run demo:auto-finance` does it again if needed).

When the local fakes are used, saving Didit or Documenso settings also registers the connector's webhook URL at the
fake, as an admin would do in the vendor's console. The settings page shows that URL.

### Other local credentials

| What | Value |
| --- | --- |
| Postgres owner | `postgres://postgres:postgres@localhost:5433/fintivio` (migrations, inspection; the API never uses it) |
| API roles | `fintivio_app` / `fintivio_app_local` (tenant data, row level security), `fintivio_platform` / `fintivio_platform_local` |
| Connector databases | role = database = password = `connector_<id>` (e.g. `connector_didit`) |
| Sample system of record | `core_banking_reader` / `core-banking-reader-pw` on `fi_core_banking` |
| WorkOS emulator API key | anything starting with `sk_` (the API uses `sk_test_local_emulator`) |
| Fake IdP users | created with `POST http://localhost:9400/__control/users` (§5); the e2e helpers use password `idp-password-1` |

---

## 4. Validate the implementation (automated)

`bun e2e` takes care of the stack; the other commands below need it up (`bun run stack --detach`).

### End-to-end suite (Playwright, `apps/e2e`)

```sh
bun e2e                                              # everything: attaches to the stack or starts it, headed when
                                                     # this machine has a screen, then rewrites docs/testing/flow-status.md
bun e2e --headed | --headless                        # choose instead (bun run e2e:watch / e2e:headless are aliases)
bun e2e --force                                      # restart the whole stack first (also the way out of a partially up stack)
bun e2e --attach                                     # only ever use the running stack
bun e2e --grep @FIA-06                               # one flow (tags: @<FLOW-ID>, see docs/product/flows.md)
bun e2e --grep @client                               # one persona (@staff @fi-admin @reviewer @client @scenario …)
bun e2e tests/clients/uploads.api.spec.ts            # one file (any Playwright argument works)
bun e2e --project=api                                # HTTP-level flows only (fast, no browser)
bun run --cwd apps/e2e screens [--dark]              # screenshots of ~30 screens as the seeded personas (docs/design)
bun run e2e:status                                   # rewrite docs/testing/flow-status.md from the last run
bun run --cwd apps/e2e report                        # HTML report with traces of failures
```

What `bun e2e` decides, and says so before the run (`e2e ›` lines, `e2e ⚠` warnings):

- **Every service up** → it attaches. **Nothing up** → it starts the whole stack in the background and stops it after
  the run (`--keep` leaves it running). **Partially up** (some services answer, others do not) → it stops with an error
  listing them: start the whole stack yourself (`bun run stack --detach` reuses what is up) and re-run, or run
  `bun e2e --force`, which stops the stack and anything on its ports, starts everything again and runs. A supervisor
  still starting services is waited for.
- **Headed or headless** from this machine (display + a browser with a UI → windows), unless `--headed` / `--headless`.
- **Warnings**: Playwright's Chromium missing, a busy machine (consider `E2E_WORKERS=2` or `--retries=1`).
- A full run rewrites docs/testing/flow-status.md; a filtered one does not. Details: [docs/testing/e2e.md](docs/testing/e2e.md#running-the-suite).

- Expect **458 passed** (103 flows) in about 6–9 minutes with 4 workers (`E2E_WORKERS`); on a busy machine use
  `E2E_WORKERS=2` or `--retries=1`.
- `PLAYWRIGHT_BROWSERS_PATH` or `E2E_CHROMIUM_PATH` point at the browsers.
- **Visual mode**: when the machine has a screen (a desktop, or `DISPLAY`/`WAYLAND_DISPLAY` on Linux) and a Chromium or
  Chrome with a UI, the browser journeys run in visible windows you can watch: one window per persona tiled on the
  screen, the step about to run highlighted and narrated, plus a run monitor window with the progress of every test
  (API tests included). UI tests then run one at a time (a full run takes 8–9 minutes instead of 3–6 here). CI, no
  display or `E2E_VISUAL=0` run headless as before; the choice and its reason are printed first, and
  `bun run stack:doctor` tells in advance. Details and tuning: [docs/testing/e2e.md](docs/testing/e2e.md#watching-the-tests).
- Plain Playwright (`bun run --cwd apps/e2e test …`) runs against a stack you started; `E2E_START_STACK=1` lets it start the stack itself.
- Point the suite elsewhere with `E2E_API_URL`, `E2E_WEB_URL`, `E2E_BASE_DOMAIN`, `E2E_MAILBOX_URL`,
  `E2E_FAKE_*_URL`, `E2E_CONNECTOR_*_URL` (see `apps/e2e/support/env.ts`).
- The global setup checks the API, Restate, the mailbox and the seeded staff account, signs the staff in once
  (password + TOTP) and shares that session with the workers through `apps/e2e/.auth/`.
- A run that starts right after the stack may spend up to 30 seconds waiting for a fresh staff TOTP window, and the
  first UI test may wait for Vite to compile.
- Tests create their own institutions (`e2e-…`) and delete them at the end, and never touch Demo Bank.

### Unit and integration tests of the core

```sh
bun run --cwd apps/core test          # RLS isolation of every table, authentication, MFA, case engine definitions, client apps, automation (dealer finance)
```

These need Postgres and Redis (the stack) and use the `fintivio_test` database.

### Type checks

```sh
bun run --cwd apps/core check-types                   # expected: no errors
bunx tsc --noEmit -p apps/e2e                         # expected: no errors
bunx tsc --noEmit -p packages/connector-sdk           # expected: no errors
for c in integrations/*; do bunx tsc --noEmit -p "$c"; done   # every connector: no errors
bunx tsc --noEmit -p apps/web                         # ~205 errors remain, all in legacy screens (database tables, logs, reviews, form builder)
```

### Database

```sh
bun run db:migrate                                    # apply migrations to fintivio and fintivio_test (idempotent)
bun run --cwd apps/core db:generate                   # after changing packages/fintivio/src/entities (then append GRANT/FORCE RLS lines)
bun run db:reset                                      # drop + recreate the dev database, migrate, seed
bun run db:seed                                       # (re)seed, idempotent
bun run --cwd apps/core connectors:databases          # connector databases + the sample fi_core_banking database
bun run connectors:register                           # register + approve the local connectors' manifests
```

### Quick health checks

```sh
bun run stack:status                                            # every service "up"
curl -s localhost:8000/health                                   # {"status":"ok"}
curl -s localhost:8000/.well-known/jwks.json                    # the core's Ed25519 public key
curl -s localhost:4102/.well-known/fintivio-connector.json      # a connector manifest (Didit)
grep -h "registered and approved" .data/stack/logs/register-connectors.log   # 5 connectors
grep Registered .data/stack/logs/api.log | tail -1              # "Registered … with Restate (3 services)"
```

---

## 5. Supporting commands

### Demo Bank helpers (manual testing)

```sh
bun run demo:workflows                 # publish example workflows that use Demo Bank's active connections (re-run after connecting more)
bun run demo:case "<workflow name>" key=value …   # start a case as admin@demo-bank.test; prints the case link and how the client signs in
bun run demo:token [email]             # access token for curl (default admin@demo-bank.test; Demo Bank members need no second factor)
bun run demo:files                     # sample upload files in .data/demo-files (clean, with JavaScript, infected, renamed executable)
bun run totp [SECRET]                  # current TOTP code (default: the seeded staff account)
bun run demo:auto-finance              # Demo Auto Finance: connections to the fakes + the dealer & borrower portal (the stack runs it)
DEMO_TENANT=demo-auto bun run --silent demo:token underwriter@demo-auto.test   # tokens for another institution
```

`demo:workflows` publishes these workflows. Workflows whose connector is not connected yet are skipped with a hint.

| Workflow | Needs | Start it with |
| --- | --- | --- |
| Demo: welcome e-mail (your server) | smtp-mailer | `bun run demo:case "Demo: welcome e-mail (your server)" fullName=Ada email=ada@customers.example` |
| Demo: credit lookup | postgres-datasource | `bun run demo:case "Demo: credit lookup" customerId=C-1001` (or `C-1003` for a low score → review) |
| Demo: retail account opening | didit + documenso | `bun run demo:case "Demo: retail account opening" fullName="Ada Lovelace" email=ada@customers.example` |
| Demo: party identity verification | didit | started by the next one, once per party |
| Demo: business onboarding | didit | `bun run demo:case "Demo: business onboarding" companyName="Widgets Ltd" email=owner@widgets.example` |
| Demo: AML screening | screening | `bun run demo:case "Demo: AML screening" fullName="John Smith" email=john@customers.example` |
| Demo: document request | — | `bun run demo:case "Demo: document request" email=client@demo-bank.test` |
| Demo: decision from the bank system | — | `POST /events` with type `loan.requested` (journey J14) |
| Demo: party check call | — | started by the next one, once per co-applicant |
| Demo: joint application | — | `bun run demo:case "Demo: joint application" email=client@demo-bank.test` |

The seed also publishes **Personal loan pre-approval** (embedded on http://localhost:4000) and **Suspicious activity
investigation** (started by flagging a client).

### Mailbox

- Web inbox: http://localhost:8025. It shows every e-mail: invitations, sign-in codes, requests, decisions, and
  e-mails sent through the bank's own SMTP connector.
- API: `curl -s "localhost:8025/api/messages?to=ada@customers.example"`, with filters `tenant=`, `since=` (ISO date)
  and `subject=`.
- `POST localhost:8025/__control/fail-next` refuses the next message(s) (`{"count": 1}`).

### Fakes' control APIs

Every fake accepts `GET /__health`, `GET /__control/requests?path=` (what it received) and `POST /__control/reset`.
Resetting Didit or Documenso forgets the webhook URLs registered by the connectors, so re-save those connections'
settings afterwards. Presets are stored per e-mail address or name and persist across restarts: prefer new addresses
to resetting.

```sh
# Didit: preset the outcome for an applicant e-mail (completes automatically after the session starts).
# "Abandoned" never completes, which tests reminders and expiry.
curl -X POST localhost:9401/__control/decisions -H 'content-type: application/json' \
  -d '{"email":"ada@customers.example","decision":"Approved"}'          # Approved | Declined | In Review | Abandoned
curl -s "localhost:9401/__control/sessions?email=ada@customers.example"  # sessions of that person
curl -X POST localhost:9401/__control/webhook-mode -H 'content-type: application/json' -d '{"mode":"duplicate"}'   # normal | duplicate | bad-signature

# Documenso: preset the signing outcome per signer
curl -X POST localhost:9402/__control/signatures -H 'content-type: application/json' \
  -d '{"email":"ada@customers.example","outcome":"signed"}'             # signed | declined | none (= wait for the person)
curl -s "localhost:9402/__control/documents?email=ada@customers.example"

# Screening: what a name returns (default: clear)
curl -X POST localhost:9407/__control/results -H 'content-type: application/json' \
  -d '{"name":"John Smith","result":"potential_match","matches":[{"list":"sanctions","name":"John Smyth","score":0.86}]}'
curl -X POST localhost:9407/__control/results -H 'content-type: application/json' -d '{"name":"Clear Customer","result":"clear"}'

# Webhook receiver: deliveries (also at http://localhost:9404), failures, signature verification
curl -s "localhost:9404/__control/deliveries?path=/hooks/demo-bank"
curl -X POST localhost:9404/__control/fail-next -H 'content-type: application/json' -d '{"path":"/hooks/demo-bank","count":3,"status":503}'
curl -X POST localhost:9404/__control/respond -H 'content-type: application/json' -d '{"path":"/hooks/demo-bank","status":410}'
curl -X POST localhost:9404/__control/secrets -H 'content-type: application/json' -d '{"path":"/hooks/demo-bank","secret":"whsec_…"}'

# Fake IdP (OIDC): a client for the broker, and people
curl -X POST localhost:9400/__control/clients -H 'content-type: application/json' \
  -d '{"redirectUris":["http://localhost:9300/sso/oidc/callback"]}'     # → clientId, clientSecret
curl -X POST localhost:9400/__control/users -H 'content-type: application/json' \
  -d '{"email":"jane@demo-bank.corp.example","password":"idp-password-1","name":"Jane Doe","mfa":true}'

# WorkOS emulator: "publish" a DNS TXT record for domain verification, inspect organizations
curl -X POST localhost:9300/__control/dns -H 'content-type: application/json' \
  -d '{"name":"workos-domain-verification.demo-bank.corp.example","txt":"<token shown in the Admin Portal>"}'
curl -s localhost:9300/__control/organizations

# DNS (custom domains)
curl -X POST localhost:9408/__control/records -H 'content-type: application/json' \
  -d '{"name":"_fintivio-challenge.onboarding.demo-bank.example","type":"TXT","value":"fintivio-verify=…"}'
curl -s "localhost:9408/resolve?name=_fintivio-challenge.onboarding.demo-bank.example&type=TXT"

# LoanPro (servicing): the back office's own channels — a payment by phone, a missed payment, a payoff.
# Each sends the signed webhook to the connector, which updates the borrower's app and starts servicing workflows.
# The page http://localhost:9410 has the same buttons per loan.
curl -s localhost:9410/__control/loans                                   # every loan (all tenants)
curl -X POST localhost:9410/__control/loans/<id>/pay -H 'content-type: application/json' -d '{"amount":450}'
curl -X POST localhost:9410/__control/loans/<id>/delinquent -H 'content-type: application/json' -d '{"daysPastDue":15}'
curl -X POST localhost:9410/__control/loans/<id>/payoff

# QuickBooks and Google Sheets: what the workflows wrote (also at http://localhost:9411 and http://localhost:9412)
curl -s localhost:9411/__control/companies/9130350000000001             # vendors, bills, bill payments of a company
curl -s localhost:9412/__control/spreadsheets/demo-auto-deal-log         # rows of a spreadsheet

# LLM: the last completions (prompts and answers) at http://localhost:9409. Extraction reads "Label: value" lines.

# Scanner and sanitiser: make them fail (the intake then refuses files as processing_failed)
curl -X POST localhost:9501/__control/fail-next -H 'content-type: application/json' -d '{"count":5}'
curl -X POST localhost:9502/__control/fail-next -H 'content-type: application/json' -d '{"count":5}'
curl -X POST localhost:9502/__control/fail-next -H 'content-type: application/json' -d '{"count":0}'   # back to normal
```

### Calling the API with curl

```sh
T=$(bun run --silent demo:token)                         # admin@demo-bank.test
curl -s localhost:8000/cases -H "Authorization: Bearer $T" -H 'X-Tenant: demo-bank'
curl -s localhost:8000/audit -H "Authorization: Bearer $T" -H 'X-Tenant: demo-bank'
```

Every request needs `Authorization: Bearer <token>` and `X-Tenant: <institution key>`. Staff calls have no
`X-Tenant`.

### Logs, Restate, database

```sh
bun run stack:logs api                     # or connector-didit, workos, mailbox, …
bun run stack:restart api                  # after changing env variables (code changes reload by themselves)
curl -s -X POST localhost:9070/query -H 'content-type: application/json' -H 'accept: application/json' \
  -d "{\"query\":\"select id, target_service_name, status from sys_invocation order by created_at desc limit 10\"}"
psql postgres://postgres:postgres@localhost:5433/fintivio -c "select action, actor_email, at from audit_events order by at desc limit 20"
```

---

## 6. Journeys to test by hand

Conventions for every journey below:

- "Back office" means `http://demo-bank.localhost:3001`; the sign-in page is `/sign-on`.
- Codes and links always arrive in the mailbox (http://localhost:8025).
- Each journey names the e2e test that automates it, so you can run it with `bun e2e <file>`.

**One-time preparation for the connector journeys (J5–J14):**

1. Sign in as `integrations@demo-bank.test`.
2. Connect the five connectors with the values in §3.
3. Run `bun run demo:workflows`.

### J1 — Staff console, onboarding an institution, first sign-in with a second factor
*Staff, new institution admin. Tests: `staff/platform-console.ui`, `fi-admin/first-sign-in.ui`, `fi-admin/security-policy.api`, `staff/staff-management.api`.*

1. Open http://localhost:3001/sign-on and sign in as `staff@fintivio.local` with the password.
2. At the code step, enter the output of `bun run totp`. You land on *Institutions*. The navigation shows
   Institutions, Support access, Connectors, Staff and Audit log.
3. Click **Onboard institution**. Enter a name, a workspace key (e.g. `test-bank`) and an administrator e-mail
   (e.g. `owner@test-bank.example`), then click **Create workspace**.
4. In the mailbox, open the invitation and follow the link. It goes to `http://test-bank.localhost:3001/sign-on?invitation=…`.
5. Choose a name and a password (10+ characters) and click **Activate account**. The **second factor enrolment**
   appears, because new institutions require it.
6. Copy the secret, run `bun run totp <SECRET>`, enter the code and click **Confirm**.
7. The 10 recovery codes are shown once. Click **I saved them, continue**. You land on the dashboard as
   administrator.
8. Sign out and sign in again. The code step appears. A code already used in the same 30 seconds is refused;
   a recovery code works once.
9. *Settings → Security*: turn off **Require a second factor for password sign-ins**. The audit log gets
   `security.policy_changed`.
10. Back in the console: **Suspend** the institution. Its sign-in page then shows "Unknown institution". **Reactivate**
    it. *Audit log* lists what staff did.

### J2 — Loan pre-approval from the bank's website
*Client, reviewers, senior reviewers. Test: `scenarios/loan-pre-approval.ui`.*

1. Open http://localhost:4000 (Demo Bank's public site with the form embedded).
2. Apply with your e-mail, an amount and an annual income, then confirm with the 6-digit code from the mailbox.
3. Expected outcome by amount:

   | Amount | What happens |
   | --- | --- |
   | ≤ 10,000 and affordable | pre-approved at once; e-mail "pre-approved" |
   | Not affordable | declined politely |
   | Between 10,000 and 50,000 | `analyst@demo-bank.test` sees it in *Tasks*: **Claim this task**, decide with a reason |
   | Above 50,000 | `lead@demo-bank.test` **and** `senior@demo-bank.test` must both approve (four-eyes; the same person cannot approve twice) |
4. Follow the application as the client at `/portal` (sign in with "Email me a code").

### J3 — Suspicious activity investigation (no tipping-off)
*RM, reviewer, senior reviewer, MLRO, client. Test: `scenarios/suspicious-activity.ui`.*

1. As `rm@demo-bank.test`: *Clients → Chris Client → Flag suspicious activity* (category + observation).
2. As `analyst@demo-bank.test`, triage in *Tasks*: false positive (closed) or escalate.
3. As `lead@demo-bank.test`, investigate. You can ask the client for documents: `client@demo-bank.test` sees a
   neutral request in the portal under *Requests*, never the investigation.
4. As `compliance@demo-bank.test`, decide: file a SAR, exit the relationship, or no action.

### J4 — Assisted application by a relationship manager
*RM, client, reviewer. Tests: `fi-roles/assisted-application.ui`, `fi-roles/relationship-manager.api`.*

1. As `rm@demo-bank.test`: *Clients → (client) → Start application*.
2. The client gets an e-mail, signs in to the portal, reviews and **confirms with consent**. Only then does the
   workflow start.
3. A reviewer decides. The RM sees only their own clients' cases.

### J5 — Connect a system: consent, the connector's own pages, settings, removal
*Integration manager, staff. Tests: `fi-admin/integrations.ui` (CON-01), `fi-roles/integrations.api` (INT-01..05, CON-02/03), `staff/connectors.api` (CON-04).*

1. As `integrations@demo-bank.test`: *Integrations* lists the approved connectors.
2. Click **Connect** on *SMTP mailer*. A consent dialog lists what the connector may do. Click **Continue to SMTP mailer**.
3. You are on `localhost:4101/connect`, branded for Demo Bank. Enter the SMTP values from §3 with password `wrong`:
   "Invalid username or password". Enter another password: you return to *Integrations* and the connection is
   **Active**, with a summary (host, from address) but never the password.
4. Click **Settings**. The connector page opens inside a dialog, and the password field shows "Unchanged". Change
   the from name and save: the dialog closes.
5. Secrets never reach the core:
   `psql …/fintivio -c "select count(*) from connector_installations where config_summary::text like '%your-password%'"`
   returns 0. In the connector's database (`connector_smtp_mailer`), `sdk_secrets` holds ciphertext only.
6. Removal: a connection used by a published workflow cannot be removed (409). After removal, its components disappear
   from the editor palette and the connector deletes its secrets (its `sdk_installations` row is gone).
7. As `staff@fintivio.local`: *Platform → Connectors* lists the versions. **Revoke** a connector (e.g. screening):
   it disappears from every institution's catalogue. **Reinstate** it afterwards.

### J6 — Workflow editor
*Flow designer. Tests: `fi-roles/workflow-editor.ui` (DES-06), `fi-roles/flow-designer.api`.*

1. As `designer@demo-bank.test`: open *Workflows → Suspicious activity investigation* (or any "Demo:" workflow).
2. Every step renders with its summary; connector steps show their connection.
3. Double-click a step: the configuration form is generated from the component's schema.
   - Connector fields offer the institution's connections.
   - Documenso's **Template** lists the templates fetched from Documenso.
   - *For each* / *Run a sub-workflow* list the published workflows; *Send a form* lists the forms.
4. Drag components from the palette, connect their event handles, **Tidy up**, **Validate** (e.g. an unknown role or an
   event a component never emits is reported), save, **Publish** (a new immutable version), **Run** (starts a case).

### J7 — E-mail through the bank's own mail server
*Test: `fi-roles/integrations.api` (INT-04).*

1. `bun run demo:case "Demo: welcome e-mail (your server)" fullName=Ada email=ada@customers.example`
2. The mailbox shows "Welcome Ada" **from `no-reply@demo-bank.test`**, sent through the connector.
3. On the case page (the link printed by the command), *Connected systems* shows a `message` record with status `sent`.

### J8 — Using the institution's own data
*Tests: `fi-roles/integrations.api` (INT-03), `scenarios/loan-origination.api` (SCN-04).*

1. `bun run demo:case "Demo: credit lookup" customerId=C-1001`: approved automatically. The case page shows the looked-up
   row (score 780) with the calculations.
2. `customerId=C-1003` (score 540): a review task for `analyst@demo-bank.test`.
3. Injection attempts (`customerId="x' or '1'='1"`) return no rows, because values are bound parameters.
   Queries run read-only unless the connection allows changes.

### J9 — Retail account opening: identity verification and e-signature in the portal
*Client, reviewer. Tests: `clients/verify-and-sign.ui` (CLI-04, CLI-06), `scenarios/retail-account-opening.api` (SCN-01/02/03/06/08), `scenarios/timeouts.api` (SCN-07).*

1. `bun run demo:case "Demo: retail account opening" fullName="Ada Lovelace" email=ada.<something>@customers.example`.
   Use a fresh address, so no preset applies.
2. The client signs in at http://demo-bank.localhost:3001/portal with "Email me a code". The case shows
   **Verify your identity**: click it and Didit's page opens in a dialog.
3. Choose **Approve**. The dialog says the result is being checked: the decision arrives by Didit's signed webhook at
   the connector, never from the browser.
4. **Sign your agreement** appears: Documenso's page opens, click **Sign**. The case is **approved**.
5. As `admin@demo-bank.test`, on the case page:
   - *Connected systems* shows `verification: approved` and `signature_request: signed`.
   - *Files* shows the signed PDF, scanned and kept byte-identical.
6. Variants (preset outcomes with the Didit/Documenso commands in §5 before starting, or click another button):

   | Choice | Result |
   | --- | --- |
   | **Decline** | case rejected; the client is told, without details of the checks |
   | **Send to manual review** | a KYC review task for `analyst@demo-bank.test` with the verification warnings |
   | **Abandon** / nothing | reminder e-mail after `remindAfter` (10 minutes in the demo workflow); expiry after 7 days |

### J10 — Documents: upload, malware, sanitisation
*Client, reviewer. Tests: `clients/uploads.ui` (UPL-01/02), `clients/uploads.api` (UPL-01..04).*

1. `bun run demo:files`, then `bun run demo:case "Demo: document request" email=client@demo-bank.test`.
2. As `client@demo-bank.test` in the portal, open the request **Please send a proof of address** and choose files from
   `.data/demo-files/`:

   | File | Result |
   | --- | --- |
   | `infected-invoice.pdf` | "checking for viruses…", then **refused: malware detected** |
   | `program-renamed.pdf` | refused: not an accepted type (sniffed from the bytes) |
   | `statement-with-javascript.pdf` | accepted after sanitisation |
   | `utility-bill.pdf` | accepted |
3. **Send answer**. As `analyst@demo-bank.test`, the review task shows the files as download links (60-second signed
   URLs, always downloaded as attachments). The case *Files* card shows "scanned clean" and, for the statement,
   "Sanitised: removed JavaScript…". The timeline records `file.uploaded`, `file.accepted`, `file.rejected` and
   `file.downloaded`.
4. Outage: make the sanitiser fail (`curl -X POST localhost:9502/__control/fail-next -d '{"count":10}' -H 'content-type: application/json'`).
   Uploads are refused as `processing_failed` and never reach the case. Reset it with `{"count":0}`.

### J11 — AML screening and compliance adjudication
*MLRO. Test: `scenarios/aml-screening.api` (SCN-05, CMP-01).*

1. Preset a hit for "John Smith" (command in §5), then run
   `bun run demo:case "Demo: AML screening" fullName="John Smith" email=john.<x>@customers.example`.
2. `compliance@demo-bank.test` gets a *Potential screening match* task. Reviewers do not see it. The case shows the
   `screening_result` record with the matches.
3. Approve it (false positive, with a rationale) and the case is approved. Reject it and the case is rejected and
   flagged `suspicious_activity_report`.
4. A name preset as `clear` is approved without any task.

### J12 — Business onboarding: beneficial owners verify themselves
*Client, related parties, reviewer. Tests: `clients/related-parties.ui` (CLI-08), `scenarios/kyb.api` (SCN-09), `clients/related-parties.api` (CLI-09).*

1. `bun run demo:case "Demo: business onboarding" companyName="Widgets Ltd" email=owner.<x>@widgets.example`
2. The applicant signs in to the portal. On the request **Tell us who owns and runs the company**:
   - Add a beneficial owner (role, name, e-mail) and click **Invite**.
   - At least one beneficial owner is required.
   - Click **That's everyone**.
3. The owner's invitation is in the mailbox. The link `/join?party=…` signs them in and opens their part only: no
   applicant details, no answers, no other party.
4. They click **Verify your identity** and choose **Approve** on Didit's page. You can also preset their e-mail with
   `Approved`: the verification then completes as soon as they join.
5. The case page (admin) lists *Related parties* with `identity approved` and a link to each party's sub-case. The
   **KYB review** task reaches `analyst@demo-bank.test` only once every party is done.

### J13 — Joint application: one team member handles every co-applicant
*Test: `fi-roles/party-routing.api` (PTY-01).*

1. `bun run demo:case "Demo: joint application" email=client@demo-bank.test`
2. As the client, add **two** co-applicants, then click **That's everyone**. With only one, you get "Add at least 2".
3. Two tasks *Call the co_applicant* appear for the reviewers. Claim one as `analyst@demo-bank.test`: the other
   co-applicant's task is **assigned to the same person** at once.
4. Complete both with **Done**: the application completes.

### J14 — The bank's systems: API clients, events, webhooks
*Admin. Tests: `fi-admin/api-clients-webhooks.api|ui` (FIA-10, X-07), `fi-admin/webhooks.api` (WH-01, WH-02).*

In the UI:

1. As `admin@demo-bank.test`, open *API clients → New API client*, choose permissions (you can only grant what you
   hold) and copy the client id and secret. The secret is shown once.
2. *Webhooks → New webhook*:
   - URL `http://localhost:9404/hooks/demo-bank`, events `case.decided` and `case.created`.
   - Copy the `whsec_…` secret, then click **Test**.
   - The row's deliveries show `delivered`; http://localhost:9404 shows the request with a valid signature (after
     `__control/secrets`).

With curl (the round trip without any UI):

```sh
T=$(bun run --silent demo:token)
curl -s -X POST localhost:8000/api-clients -H "Authorization: Bearer $T" -H 'X-Tenant: demo-bank' -H 'content-type: application/json' \
  -d '{"name":"Core banking","permissions":["cases:create","cases:read"]}'           # → clientId, clientSecret
AT=$(curl -s -X POST localhost:8000/oauth/token -u '<clientId>:<clientSecret>' -d grant_type=client_credentials \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s -X POST localhost:8000/events -H "Authorization: Bearer $AT" -H 'X-Tenant: demo-bank' -H 'content-type: application/json' \
  -H 'Idempotency-Key: evt-1001' -d '{"id":"evt-1001","type":"loan.requested","data":{"amount":500}}'
```

- **Expected**: "Demo: decision from the bank system" starts and approves the case (amounts above 1,000 are rejected),
  and the webhook receiver gets `case.decided` with the reference.
- **Retrying** the same request returns the first answer (`Idempotent-Replayed: true`); the same key with a different
  body returns 422; the same event `id` is not processed twice.
- **Retries**: make the endpoint fail 3 times (`__control/fail-next`). Deliveries are retried after 2, 4 and 8
  seconds locally (`WEBHOOK_RETRY_SCHEDULE`), the log shows 4 attempts, and **Resend** works.
- **Disabling**: an endpoint answering 410 is disabled.
- **Rotation**: **Rotate secret** sends two signatures for 24 hours.

### J15 — Single sign-on for the institution, enforcement, directory sync
*Admin, IT team, member. Tests: `fi-admin/sso.ui` + `fi-admin/sso-scim.api` (FIA-06, FIA-07). The helper `apps/e2e/support/sso.ts` scripts the same steps.*

1. As `admin@demo-bank.test`: *Settings → Security → Configure the identity provider*. The WorkOS Admin Portal
   (emulator) opens in a new tab.
2. **Add domain** `demo-bank.corp.example`. The portal shows the record to create, e.g.
   `workos-domain-verification.demo-bank.corp.example TXT "abc123…"`. Publish it with the `__control/dns` command in §5,
   then click **Verify**: the domain becomes verified.
3. Register a client at the IdP: `curl -X POST localhost:9400/__control/clients … {"redirectUris":["http://localhost:9300/sso/oidc/callback"]}`.
4. In the portal, enter issuer `http://localhost:9400` and the client id and secret, then click **Save connection**.
   The connection is active. Back in *Security*, click **Refresh status**.
5. Turn on **Create accounts on first sign-in** and tick *Reviewer*. Create an IdP user
   (`__control/users`, e.g. `jane@demo-bank.corp.example` / `idp-password-1`).
6. Sign out. At http://demo-bank.localhost:3001/sign-on, type `jane@demo-bank.corp.example` and leave the password
   **empty**, then click **Sign in**. You go to the IdP's login page; sign in there and you land on the dashboard as a
   reviewer.
7. Turn on **Require single sign-on for verified domains**. A password sign-in for `…@demo-bank.corp.example` is now
   refused (`sso_required`).
8. Directory sync: click **Directory sync (SCIM)** and then **Set up a directory** in the portal. It shows a SCIM base
   URL and a token. Within about 3 seconds of each call below, the member appears in *Team*, then becomes disabled
   with their sessions ended:

   ```sh
   curl -X POST '<SCIM base URL>/Users' -H 'Authorization: Bearer <token>' -H 'content-type: application/scim+json' \
     -d '{"schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],"userName":"new.hire@demo-bank.corp.example","name":{"givenName":"New","familyName":"Hire"},"emails":[{"value":"new.hire@demo-bank.corp.example","primary":true}],"active":true}'
   curl -X PATCH '<SCIM base URL>/Users/<id>' -H 'Authorization: Bearer <token>' -H 'content-type: application/scim+json' \
     -d '{"schemas":["urn:ietf:params:scim:api:messages:2.0:PatchOp"],"Operations":[{"op":"replace","value":{"active":false}}]}'
   ```

### J16 — Staff sign in with the company IdP
*Staff. Test: `staff/staff-sso.api`.*

1. As `staff@fintivio.local`: *Platform → Staff → Company single sign-on*. Do the same as J15 steps 1–4 with a company
   domain (e.g. `fintivio-corp.example`).
2. Invite a staff member with an address in that domain. Create them at the IdP.
3. At http://localhost:3001/sign-on, type their e-mail with an empty password. You go to the IdP and back into the
   console. No second factor is asked: MFA is the IdP's job.
4. People of the domain without a staff account are refused, because staff are never created just-in-time.
5. With **Refuse staff passwords** on, passwords are refused for that domain. `staff@fintivio.local` (break-glass)
   still signs in with password + TOTP.
6. Turn it off again if you share the machine.

### J17 — Custom domain
*Admin. Test: `fi-admin/workspace.api` (FIA-02, FIA-03).*

1. As `admin@demo-bank.test`: *Settings → Tenant Settings → Custom domains*. Add `onboarding.demo-bank.example`. The
   card shows the TXT and CNAME records; **Verify now** fails while the TXT record is missing.
2. Publish the TXT record (`localhost:9408/__control/records`, command in §5). **Verify now** then shows **Active**.
3. `curl -s "localhost:8000/auth/tenant?domain=onboarding.demo-bank.example"` returns Demo Bank's branding.
4. The same host cannot be added by Acme Credit Union (409).
5. Browsing to the custom host needs real DNS, so it is not possible locally.

### J18 — Team, roles, audit, support access, data rights
*Tests: `fi-admin/team-and-roles.ui`, `fi-admin/team.api`, `fi-admin/roles.api`, `fi-admin/audit.api`, `staff/support-access.api`, `clients/data-rights.ui`, `fi-roles/compliance.api`, `fi-roles/authorization-matrix.api`, `cross-cutting/*`.*

- **Team and roles**:
  - Invite members and change their roles.
  - Compose custom roles from the permission catalogue: you cannot grant what you do not hold, and system roles are
    read-only.
  - Deactivate a member: their sessions end.
- **Audit log**: every action is recorded in a hash-chained, append-only trail. Compliance can export a case with its
  timeline.
- **Support access**:
  1. Staff request time-bound, read-only access to an institution (*Platform → Support access*).
  2. `admin@demo-bank.test` approves it under *Support access*.
  3. Every page staff open is in the institution's audit log.
- **Data rights**: a client asks for a copy or erasure of their data under *Privacy* in the portal, and
  `compliance@demo-bank.test` processes it under *Data requests*. Erasure is declined while an application is open.
- **Isolation**:
  - Tokens are pinned to their institution.
  - Clients only see their own data.
  - Row level security is enforced for every table (`bun run --cwd apps/core test`).

---

### J19 — Dealer finance: from the deal to the borrower's payments
*Dealer, underwriter, funding team, borrower. Tests: `scenarios/dealer-finance.ui` (watch it with `bun e2e --headed tests/scenarios/dealer-finance.ui.spec.ts`),
`scenarios/dealer-finance.api`, `automation/automation.api`, `automation/functions.ui` (SCN-12, AUT-01…07).*

Everything is ready in **Demo Auto Finance** (`http://demo-auto.localhost:3001`); keep the fakes' pages open to watch
them fill up: LoanPro http://localhost:9410, QuickBooks http://localhost:9411, Sheets http://localhost:9412, LLM
http://localhost:9409, mailbox http://localhost:8025.

1. **Dealer** — sign in to `/portal` as `dealer@sunrise-motors.test` (password or e-mailed code). *Submit a deal*:
   buyer (use a new e-mail address, e.g. `jamie.1@buyers.example`), vehicle, structure (e.g. 21,000 financed over
   60 months at 8.9%, declared income 5,500, VIN `1HGCV1F30LA012345`, sale price 24,500, buyer Jamie Rivera). Upload
   the stipulations written by `bun run demo:files` to `.data/demo-files`: `deal-pay-stub.pdf`,
   `deal-buyers-order.pdf`, `deal-drivers-license.pdf` (the AI reads their `Label: value` lines; change the VIN or the
   income to see flags). The journey shows *Underwriting*.
2. **Underwriter** — sign in as `underwriter@demo-auto.test`. *Cases → Pipeline* shows the deal under *Underwriting*.
   *Tasks → Team queue → Claim*: the AI summary, payment, PTI, LTV, what the pay stub and buyer's order said, and
   flags. Choose *Ask the dealer*, tick "They answer with a document", write what you need → the dealer sees it under
   *Waiting for you* and uploads it; the task comes back. *Approve* (or *Approve with conditions*: the dealer accepts
   them first; *Decline*: the dealer is told why, the deal log says so).
3. **Contracts** — the dealer opens the deal: "The buyer signs the retail installment contract" (Documenso, at the
   dealership), then "Sign the assignment of the contract".
4. **Funding package** — the dealer uploads the title application and proof of insurance. `funding@demo-auto.test`
   claims the *Funding audit* (documents listed on the task) and chooses *Fund the dealer*.
5. **Watch** — QuickBooks: vendor *Sunrise Motors*, a bill and its payment (amount financed − 395). Sheets: two rows
   (*In underwriting*, *Funded*). LoanPro: the loan, *Open*. The case page shows the stage bar at *Boarded*; the
   mailbox has the buyer's invitation.
6. **Borrower** — sign in to `/portal` with the buyer's e-mail (code), accept the terms: the loan balance, next payment,
   *Make a payment* (posted in LoanPro), *Payoff quote*, *Need help?* (a hardship request for the underwriters).
7. **Servicing** — on the LoanPro page, *Missed payment* → the borrower gets a past-due notice, the underwriters a
   collections task; *Pay off* → congratulations in the app, a lien release task for funding.
8. **Title** — as `admin@demo-auto.test`, open the *Title: <VIN>* case (search the deal reference): *Signals* shows
   `title_received` waiting; *Record it* with `{"titleNumber":"TX-1","state":"TX"}` → *Lien perfected*. The title
   service would call the case back instead: *Copy the call-back address* (shown to members who may signal) and
   `curl -X POST '<address>' -H 'content-type: application/json' -d '{"titleNumber":"TX-2"}'`.

Also: *Client app* (studio) as `designer@demo-auto.test` shows the portal; *Templates → Dealer & borrower portal*
installs it in any institution once its connections exist. *Workflows* shows the functions (*Function: …*) and, in
the editor, *Your functions* in the palette and the ⚙ settings (stages, function, outputs).

### J20 — The experience map
*Designer. Test: `client-app/map.ui` (APP-11).*

1. Sign in as `designer@demo-auto.test` (or `designer@demo-bank.test` for the banking app) → *Build → Map*.
2. Top row: the **layout** (menu, sign-up, theme) and every **page** drawn with a sample client; arrows from the menu
   and from widgets. Hover the quick actions on *Home*: their arrows light up. Click *Submit a deal* inside the Home
   frame: the map flies to the journey (*Back* returns).
3. Below: one row per **journey** — its screens and requests in order, *Behind the scenes* nodes (AI, reviews, functions,
   LoanPro…), the outcomes, and the workflow under the journey card. Click a screen's button to follow the flow.
4. *As a “dealer” / “borrower”* fades what that client would not see. *Layers* hides the journey screens or the
   automations. Search jumps anywhere.
5. *Edit* on a frame (or double-click): a page opens in the studio, a screen opens its step in the workflow editor with
   the configuration open, a form opens the form editor; *Back to the map* returns to the same view.
6. At the bottom, **automations**: LoanPro events → servicing workflows, functions used by the deal, the title
   tracking.

### J21 — Pay with a QR code, and brand the app
*Client and designer. Tests: `client-app/pay-with-qr.ui`, `client-app/ui-blocks.api` (APP-12).*

1. `bun run demo:files` writes payment QR codes to `.data/demo-files`: `pay-corner-cafe.gif` (£12.50),
   `pay-market-stall.gif` (any amount), `pay-nyc-deli-usd.gif` (refused: another currency), and their text in
   `payment-codes.txt`. Open one on screen to scan it with a phone, or use the file as the photo.
2. As `client@demo-bank.test` at http://demo-bank.localhost:3001/portal: the amber **Pay** button (bottom right) opens
   *Pay with a QR code* **full screen**. *Scan the QR code* (the camera), *Use a photo*, or *Type the code instead*.
   A code with an amount shows the payee and amount and **continues by itself** after a 2-second countdown (*Stop*
   holds it); without an amount, the app asks for one. Confirm → *Pay now* → the accounts page with the payment.
3. *Pay with QR* in the quick actions opens the same journey as a **bottom sheet**; close it half-way and *Waiting for
   you → Continue* reopens it where it was. http://demo-bank.localhost:3001/portal/start/pay_qr?presentation=dialog
   opens it in a dialog.
4. As `designer@demo-bank.test`, *Build → Client app → Settings → Appearance*: a **preset** (Neo bank: pill buttons,
   geometric font, tinted background), an accent colour, *Colours from your logo*, and the **Readability** check;
   *Region*: the currency. *Journeys → Pay with a QR code → How it opens*. In a workflow's `client.screen` step, the
   new field types (scanner, signature, one-time code, slider, calculated value), *Shown when*, format rules and
   *Continue by itself*.
5. Watch it: `bun e2e --headed tests/client-app/pay-with-qr.ui.spec.ts` (the camera test films a generated code).

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `bun run stack` says a port is busy | `bun run stack:doctor` lists the ports in use. The stack reuses its own healthy services; stop foreign processes on those ports |
| A service is `down` in `stack:status` | `bun run stack:logs <service>`, then `bun run stack:restart <service>`. The supervisor restarts crashed services up to 5 times |
| Embedded Postgres refuses to start | do not run as root; check `apps/core/.data/postgres` permissions; `bun run stack:reset` as a last resort |
| "Registered … with Restate" missing, cases do not advance | `bun run stack:restart api` (it re-registers with Restate); check http://localhost:9070/ui/ |
| Timers do not fire: webhook retries, reminders, SLA escalations or expiries are late; `sys_invocation` shows invocations `suspended` on a `Sleep` whose wake-up time has passed | Restate stalled after an overload (its log says "Severe lag … detected"): `bun run stack:restart restate`; the overdue timers fire at once |
| A connector step fails with "Connection … is pending" | finish the connector's settings (*Integrations → Finish setup*) |
| Didit/Documenso decisions never arrive | the connection's webhook URL is registered at the fake when its settings are saved. After resetting the fake, re-save the settings. Use a different API key per institution |
| Integrations catalogue empty | `bun run connectors:register` (the API refreshes its registry through Postgres `NOTIFY`) |
| Staff sign-in code refused | each TOTP code works once; wait for the next one (`bun run totp` shows how long the current one lasts) |
| The web app shows "Loading…" for a while after a start | Vite compiles on first request; wait 20–30 seconds |
| The e2e run starts slowly | the global setup may wait up to 30 seconds for a fresh staff TOTP window |
| A shared Didit/screening preset changes your result | presets are per e-mail/name and persist: use a new address or name |
| Start from scratch | `bun run stack:reset` (wipes databases, Redis, Restate, fakes and connectors, then starts again) |

Known limitations of the local setup:

- No real vendor sandboxes: Didit and Documenso assumptions are listed in `integrations/*/docs/ASSUMPTIONS.md`.
- No TLS or edge routing for custom domains.
- The local object store is a directory.
- Web typecheck errors remain in legacy screens.
