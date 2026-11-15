# 08 — Local development: mailbox, fake services, one command

## The verification e-mail you did not see

E-mails are written as JSON files to `apps/core/.data/outbox/<tenant>/` (`EMAIL_PROVIDER=outbox`); nothing shows them
in a browser, so the embedded-form flow stopped at "enter the code". Fix (M0):

- `fake-services/mailbox`: an SMTP server (`smtp-server` + `mailparser`, `:1025`) and a web inbox (`:8025`, all
  messages, per-recipient filter, HTML/text views, clickable links, "copy code" for one-time codes) plus a REST API
  (`/api/messages?to=`) that replaces the e2e suite's outbox reader. **MailDev** (npm, SMTP + web UI + REST) is a
  ready-made alternative that works today; the in-house version adds our `/__control` conventions (fail the next
  send, delay) used by connector tests.
- Core in development sends through SMTP to it (`EMAIL_PROVIDER=smtp`, `SMTP_URL=smtp://localhost:1025`), exactly
  like production sends to a real provider; the file outbox stays as a fallback for tests without the stack.
- The web app shows a small development banner "Open local mailbox" (only when `VITE_LOCAL_MAILBOX_URL` is set).

## `fake-services/*`

Every external system is emulated by a service that follows the real contract, so the same adapters/connectors run
locally and in production, and **incoming and outgoing webhooks are tested for real**.

| Fake | Port | Emulates | Used by |
| --- | --- | --- | --- |
| `mailbox` | 1025/8025 | SMTP providers, institution mail servers | core mailer, `smtp-mailer` connector |
| `workos` | 9300 | WorkOS SSO, Admin Portal, Directory Sync, Events (02) | core SSO broker |
| `idp-oidc` | 9400 | Okta/Entra/Google over OIDC (`oidc-provider`) | `workos` fake |
| `idp-saml` | 9410 | ADFS/Entra over SAML (`samlify`) | `workos` fake |
| `didit` | 9401 | Didit sessions, hosted verification page, signed webhooks (05) | `didit` connector |
| `documenso` | 9402 | Documenso v2 API subset, signing page, webhooks (05) | `documenso` connector |
| `core-banking-api` | 9403 | an institution's REST API | `rest-api` connector |
| `webhook-receiver` | 9404 | an institution's webhook endpoint (04) | outbound webhooks tests |
| `sms` | 9406 | Twilio-compatible Messages API | SMS connector |
| `screening` | 9407 | sanctions/PEP/adverse-media screening | screening connector (CMP-01) |
| `open-banking` | 9408 | AIS provider with consent redirect | open-banking connector (client audience) |
| `object-store` | 9500 | S3 (s3rver) (07) | files |
| `scanner` | 9501 | malware scanner (EICAR) (07) | file intake |
| `sanitizer` | 9502 | content disarm and reconstruction (07) | file intake |

Conventions (already in docs/testing/e2e.md): `GET /__health`, `/__control/*` to preset outcomes and read what was
received, a minimal UI where a human makes choices (approve/decline buttons), host names `<name>.fake.localhost`.
Each fake is a small Bun + Hono app with its own package; shared helpers (control API, request log, webhook signing)
live in `packages/fake-kit`.

## One command (decided; first item of M0)

Goal: on a fresh clone, one command brings up **everything** (infrastructure, fake services, connectors, core, web,
demo data) and tells you where to click; the same command is what the e2e suite runs against.

### Commands (root `package.json`)

| Command | What it does |
| --- | --- |
| `bun run stack` | first-run setup if needed, then start everything in dependency order, wait for health, seed, print the URL table; `Ctrl-C` stops everything cleanly |
| `bun run stack --profile <name>` | subsets: `core` (Postgres, Redis, Restate, mailbox, API, web), `full` (default: + all fake services and connectors), `e2e` (full, no browser-facing extras, fixed ports for the suite) |
| `bun run stack --only api,web` / `--skip didit` | fine-grained selection (dependencies are started automatically) |
| `bun run stack:status` | health table of every service (port, pid, up/down, last error) — works from another terminal |
| `bun run stack:logs [service]` | tail the combined or one service's log (`.data/stack/logs/<service>.log`) |
| `bun run stack:stop` | stop a stack started in the background (`bun run stack --detach`) |
| `bun run stack:reset` | stop, wipe all local state (core and connector databases, Redis, Restate, object store, mailbox), start again and seed |
| `bun run stack:doctor` | checks prerequisites and explains fixes: Bun version, non-root user (Postgres), free ports, `.env` files, Playwright browsers, disk space |
| `bun run stack:test` | `stack --profile e2e --detach`, wait, run the e2e suite, write the flow status, stop (unless `--keep`) |

### What `stack` does, in order

1. **Doctor checks** (fail fast with the fix to apply).
2. **First-run setup**: create `apps/core/.env`, `apps/web/.env`, `integrations/*/.env` from their examples with
   generated development secrets (JWT secret, KEKs, connector keys), unless they exist; install dependencies if
   `node_modules` is missing.
3. **Infrastructure**: Postgres (embedded, `:5433`) → create/migrate the core database, the test database and **one
   database + role per connector**; Redis (`:6380`); Restate (`:8080/:9070`).
4. **Fake services** (`fake-services/*`, ports in `dev/ports.json`), each until `GET /__health` answers.
5. **Core API** (registers with Restate), **connectors** (each migrates its own database on start), then **registry
   sync**: every `integrations/*/manifest.json` is registered and auto-approved (development only).
6. **Web app** (Vite) and the **demo bank website** (`:4000`).
7. **Seed** (idempotent): tenants, one member per role, demo workflows and forms, connections to the fake vendors
   (Didit, Documenso, SMTP), fake IdP users for SSO (a staff user and a bank IT user), so every journey works at once.
8. **Print** the table below and keep streaming prefixed logs (`[api]`, `[web]`, `[didit]`…), errors highlighted.

```
Fintivio local stack — all 23 services healthy (41 s)

  Back office (Demo Bank)   http://demo-bank.localhost:3001      analyst@demo-bank.test / fintivio-dev-password
  Platform console          http://localhost:3001               staff SSO: staff@fintivio.local (fake IdP, password "staff")
  Client portal             http://demo-bank.localhost:3001/portal   client@demo-bank.test (or "Email me a code")
  Bank website (embedded)   http://localhost:4000
  Mailbox (all e-mails)     http://localhost:8025
  Fake IdP / WorkOS         http://idp.fake.localhost:9400  ·  http://workos.fake.localhost:9300
  Fake Didit / Documenso    http://didit.fake.localhost:9401  ·  http://documenso.fake.localhost:9402
  Restate admin             http://localhost:9070
  Logs: bun run stack:logs   Status: bun run stack:status   Stop: Ctrl-C
```

### Implementation

- `scripts/stack.ts` (Bun, no extra dependency): a small supervisor with a declarative service list
  (`dev/stack.config.ts`: name, command, cwd, env, port, health check, depends on, profile tags), topological start,
  health polling with timeouts, restart-on-crash with backoff for dev servers, graceful shutdown (SIGTERM children,
  then SIGKILL after 10 s), a pid/state file for `status`/`stop`, logs to files + prefixed console.
- Each package keeps its own `dev` script; the supervisor only orchestrates (turbo remains for builds/tests).
  Alternative considered: `turbo run dev` (today) — it stops every task when one crashes and has no health/ordering
  notion; `docker compose` — not available offline here and heavier on laptops.
- `dev/ports.json` is the single source of ports and host names; `support/env.ts` in the e2e suite, connectors and
  fake services read it (overridable by environment variables).
- Works offline (no downloads after the first install), as a normal user, on Linux and macOS; Windows via WSL.
- CI uses `bun run stack:test`.

## Demo data

The seed keeps publishing the demo workflows and the embeddable loan form (0003) and will add: an installed
`smtp-mailer` connection to the fake mailbox, a Didit connection to the fake Didit, a Documenso connection with one
agreement template, and an account-opening workflow using both — so the full retail onboarding can be clicked through
right after `bun run stack`.
