# 0001 — Run locally: one Postgres with RLS, local auth, Restate 1.17

Goal of this batch: the project installs and runs end to end on a machine with only the npm registry (no Docker, no
vendor APIs), on the target architecture where that was a prerequisite (single Postgres with row level security).

## How it was verified

- `bun install` from a clean tree; `node check-registry.mjs --all`: 1537 pins, 0 missing (before: 23 missing pins and
  `@kiyasov/platform-hono` returning 404).
- `bun run db:start`, `bun run restate:serve`, `bun run dev`: database created/migrated/seeded through the restricted
  roles, API boots and registers 23 Restate objects, web app serves.
- `bun test` in `apps/core`: 27 tests (row level security through the restricted roles, authentication/tenant binding).
- `tsc --noEmit`: `apps/core` 0 errors (was 33 once its tsconfig was fixed), `packages/fintivio` 0 errors (was 42).
- Manually over HTTP/Restate: sign-in for staff, members and clients; cross-tenant token rejected; staff onboarding a
  tenant with an invited admin; invitation accepted through the e-mail link; client self-registration; tenant-scoped
  file upload/download; a workflow (start -> e-mail node -> end) executed durably through the Restate ingress.
- In Chromium (Playwright): tenant sign-in and back-office pages, route guard, staff onboarding form, full invitation
  journey on a freshly created tenant's sub-domain.
- Clean-room run: a copy of the repository without `node_modules`, `.env`, `.data` or build output, following the
  readme (`bun install --frozen-lockfile`, env files, `db:start`, `restate:serve`, `dev`), then all of the above.
  It caught two first-run problems, now fixed: seeding needed the shared package's `dist/` (the API and scripts now
  import `packages/fintivio` from source through `paths` in `apps/core/tsconfig.json`, so no build step is needed for
  them), and a failed first seed was never retried (`db:start` now seeds whenever the database is empty).

## Dependencies and tooling

- Package manager: Bun **1.3.14** (`packageManager` was `bun@1.2.11`; Bun was not installed in the environment).
- Lockfile regenerated with non-frozen `bun install` (unchanged ranges kept their locked versions).
- Restate: SDK `1.6.0` -> **`1.17.2`**, server/CLI `1.3.2` -> **`1.7.12`** (matched pair; see RESTATE.md).
- Drizzle: `drizzle-orm` `0.43` -> **`0.45.4`**, `drizzle-kit` -> `0.31.11` (RLS via `pgPolicy`/`pgRole`).
- `@kiyasov/platform-hono` (404 on the registry) replaced by an in-repo adapter: `apps/core/src/http/hono-adapter.ts`.
- Added: `embedded-postgres` 17.10 (dev), `jose` (JWT), `rxjs` (Nest peer, was only hoisted from web),
  `@types/js-cookie`. `trustedDependencies` lets the embedded-postgres binary package run its postinstall
  (re-creates library symlinks; local only).
- `@kie-tools/*` `10.0.0` -> `10.1.0` (10.0.0 no longer on the registry).
- Removed unused or replaced packages from `apps/core`: Descope, Neon (`@neondatabase/*`), AWS SDK v2 and unused v3
  clients, Mailgun, Elysia, Express/body-parser/cookie-parser/cors/compression/method-override/passport/
  express-session, socket.io, face-api.js, onfido-sdk-ui, axios, form-data, handlebars, node-fetch, pg, dotenv-flow,
  dotenv-expand, jest/supertest/ts-node/tsup/@nestjs/cli and friends. From `apps/web`: `@descope/react-sdk`,
  `@nestjs/platform-express`, `@repo/ui`.
- Removed `packages/ui` (an older copy of `packages/fintivio`, not imported anywhere) and TsED/Docker template
  leftovers in `apps/core` (`Dockerfile`, `docker-compose.yml`, `processes.config.cjs`, `src/config`, nest-cli files;
  they referenced files that do not exist, e.g. `bun.lockb`, `dist/index.js`).
- `apps/core` tests use `bun test` (there were no tests before).
- `apps/core` resolves `@repo/fintivio/*` to the package **source** (tsconfig `paths`, honoured by Bun at runtime and
  by `tsc`); the web app keeps using the built `dist/` through the package exports.

## Database: one Postgres, row level security managed by Drizzle

- The old migrations (`drizzle-global`, `drizzle-tenant`) were fully commented-out introspection output of a TypeORM
  schema and created nothing; they were deleted. One migration history now lives in `apps/core/drizzle`:
  `0000_bootstrap` (roles, schema privileges, hand-written), `0001_schema` (generated from the entities: tables, enums,
  `ENABLE ROW LEVEL SECURITY`, policies), `0002_grants` (table grants + `FORCE ROW LEVEL SECURITY`, hand-written
  because drizzle-kit does not manage grants). One config: `apps/core/drizzle.config.ts`.
- Schema source of truth stays in `packages/fintivio/src/entities`:
  - `rls.ts`: roles (`fintivio_app`, `fintivio_platform`, declared `.existing()`), `tenant_id` column defaulting to
    `current_setting('app.tenant_id')`, the tenant isolation policy.
  - Platform tables: `tenants` (uuid ids; Neon `database_*` columns removed; `status`; `domain` remains the tenant
    key) and `platform_users` (staff). The `environments` table (CloudFront ARNs) was dropped with the AWS code.
  - Every tenant table (`sys_*`) got `tenant_id`, a `(tenant_id, id)` unique key, composite foreign keys for children
    and tenant-scoped unique indexes (invitation e-mail, system variable name).
  - New tenant tables replacing Descope: `users` (members and clients), `roles`, `user_roles`.
- Connection handling (`apps/core/src/clients/database.client.ts`): a drizzle client per tenant whose driver runs every
  statement in a short transaction starting with `set_config('app.tenant_id', …, true)`. The API never uses the owner
  role; migrations run from `scripts/db.ts`.
- Tenant provisioning (`src/tenancy/provisioning.ts`) replaces "create a Neon database": a `tenants` row plus default
  roles (`admin`, `user`) written through the new tenant's RLS context. Deleting a tenant cascades to its data.
- Local Postgres: `embedded-postgres`, data in `apps/core/.data/postgres`, databases `fintivio` and `fintivio_test`.

## Authentication (Descope replaced by a local provider)

- `apps/core/src/auth`: `IdentityService` (sign-in, client registration, invitations, per-request resolution),
  argon2id passwords (Bun built-in), HS256 session tokens (`jose`), `AccessGuard` + `@Access()`/`@Public()`.
- Endpoints: `POST /auth/login` (tenant from `X-Tenant`; none = staff), `POST /auth/register` (clients),
  `POST /auth/invitations/accept`, `GET /auth/tenant` (public branding), `GET /auth/me`, `GET /auth/roles`,
  `POST /auth/after-login`.
- The app no longer signs a developer in through the Descope management API at startup.
- Web: `src/lib/auth/session.tsx` replaces `@descope/react-sdk` (same hook shapes); requests send
  `Authorization: Bearer` + `X-Tenant` instead of a base64 token in the idempotency key; new sign-on page (sign-in,
  client registration, invitation acceptance); route guard on the private layouts. The Descope widgets were replaced by
  small pages: Users (list/invite/activate/deactivate/reset), Roles (list/create/delete), Profile; API keys shows
  "not available yet"; the Logs "Audit" tab was removed (security events are in the tenant logs).

## Restate

- Upgraded (see above). `/restate` now builds the endpoint once and resolves the request-scoped service per
  invocation from the invocation's headers/input (previously a new endpoint with all 22 services was built for every
  HTTP request and the tenant/token were regex-scraped from the raw protocol bytes).
- Client-side errors become `TerminalError`s. `RESTATE_IDENTITY_KEYS` enables request-signature verification.
- Registration no longer sends a user token (`register-key` header removed).

## External services

| Service | Now |
| --- | --- |
| Descope | local provider (above) |
| Neon | single Postgres + RLS (above) |
| Mailgun/SMTP | `EmailProvider`: `outbox` (JSON files in `.data/outbox/<tenant>`, default) or `smtp` (nodemailer) |
| S3 | `StorageProvider`: local disk (`.data/files`); keys namespaced per tenant; server-generated upload keys |
| Route53/CloudFront/ACM | `DomainsService` returns the CNAME records to create; nothing is provisioned |
| OpenAI, ComplyCube, DocuSeal | created lazily; features fail with "not configured" instead of breaking startup |

## Bugs found and fixed on the way

- Cross-tenant access: the tenant came from client-supplied `domain`/`tenant` values and was never checked against
  the token, so any valid token could act on any tenant. Now the token pins the tenant.
- Most HTTP endpoints had no authentication check at all. Now everything requires a session unless marked public,
  and defaults to tenant members (clients only where allowed: forms they were issued, proof of life, files).
- Storage keys were client file names shared by all tenants (overwrites, cross-tenant reads).
- `files.controller` was never registered and was mounted at `/files` while the web calls `/object`.
- `GET /logs/:logId` shadowed `/logs/analytics`, `/top-users`, `/top-sources`, `/trends`.
- `reviews.list()` filtered on non-existent columns (`assignedTo`, `createdAt`).
- Undefined `req` in the proof-of-life and tenant update handlers; `webService.mockDomain` did not exist.
- Web tenant hooks called `PUT/DELETE /tenants` while the API only had `/:domain` variants.
- The image form field stored a different key than the one it uploaded.
- `packages/fintivio` event types declared `tenantId` as `number` in the base type and `string` everywhere else.
- The users service could mint a session for any user by e-mail (`loginByEmail`, unused) — removed.

## Deliberately disabled: tenant custom tables ("Database" section and `database` workflow node)

They executed tenant-supplied SQL (CREATE TABLE, free-text WHERE clauses, arbitrary table names). In a shared
database that would let a tenant read other tables in its scope (e.g. password hashes in `users`), change
`app.tenant_id` from inside a WHERE clause, or create tables without RLS. Every operation now returns
**501 Not Implemented** (`services/database.service.ts`; old code in git history). Needs a redesign — see decisions.

## Known gaps (not done in this batch)

- **Authorization is coarse**: routes distinguish staff / member / client, but any member (e.g. an analyst) can call
  administrative endpoints (users, roles). Role permissions are stored but not enforced. -> permissions model.
- Durable workflows carry the caller's session token; long-running executions break when it expires (12h). System
  triggers reuse the acting user's token. -> service identities.
- No SSO (per-tenant OIDC/SAML), no MFA, no password reset for staff, no rate limiting on sign-in.
- API access keys (previously Descope) are not implemented.
- KYC still uses ComplyCube (Didit migration pending); DocuSeal is still in place (Documenso migration pending, see
  LOCAL-DEV-NOTES.md and `docs/vendor-api`); no S3 or DNS provider implementation yet.
- `apps/web` `tsc --noEmit` reports 317 pre-existing errors (unused variables, pages ported from Next.js that import
  `next/*` and are not routed: reviews, proof of life). `vite build` succeeds. None are in files changed here.
- The dashboard shows hard-coded sample figures; the onboarding form has pre-existing React key/nesting warnings.

## Decisions needed

1. Tenant custom tables: redesign as tenant-defined collections (rows in a shared RLS table + structured filter DSL),
   or drop the feature?
2. Permissions model: permission catalogue, enforcement point (guards per route/handler), per-step routing of flow
   tasks to staff, and whether platform staff may ever read tenant data (break-glass/impersonation with audit).
3. SSO: per-tenant OIDC/SAML configuration and how identities link to `users` (JIT provisioning, domain claims).
4. E2E tests: scenario catalogue (account opening with KYC pass/fail/manual review, loan origination, AML hit,
   document resubmission, timeouts, audit trail) against faithful vendor fakes.
