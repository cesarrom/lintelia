# Local development notes

Read this before running anything.

> **Status**: the project installs and runs offline. See the [readme](readme.md) for the commands and
> [TESTING.md](TESTING.md) for the local stack, seeded accounts and the e2e suite. Twelve batches are done, each with a
> change log in `docs/changes/`: [0001](docs/changes/0001-local-runtime.md) to [0004](docs/changes/0004-platform-capabilities.md)
> (Bun, Restate, one Postgres with Drizzle-managed RLS, local auth, case engine, one-command local stack with fake
> vendors, connectors, API clients, webhooks, TOTP MFA and SSO, related parties), then
> [0005](docs/changes/0005-visual-e2e.md) (visual e2e mode), [0006](docs/changes/0006-ui-redesign.md) (UI redesign),
> [0007](docs/changes/0007-client-apps.md) (client apps and the studio), [0008](docs/changes/0008-dealer-finance.md)
> (dealer finance solution with fake LoanPro, QuickBooks, Sheets and LLM services),
> [0009](docs/changes/0009-experience-map.md) (experience map), [0010](docs/changes/0010-bun-e2e.md) (`bun e2e`) and
> [0011](docs/changes/0011-ui-building-blocks.md) (UI building blocks), then [0012](docs/changes/0012-access-control.md) (who sees what: custom permissions, gated workflows, roles from the identity provider, change control). The roadmap is in `docs/plans/`.

## The environment this copy was prepared for
- Linux x86_64 (Ubuntu 24.04), Node 22.21, npm 10.9, bun 1.3.14, 16 GB RAM, a normal non-root user.
- Only the npm registry (and PyPI) is reachable. Assume no Docker, no GitHub or CDN downloads, no Hugging Face, and no third-party APIs.
- The registry may not show every old version. Run `node check-registry.mjs` first. It lists lockfile pins the registry cannot serve. If many are missing, do not fight the lockfile: relax the ranges to what the registry shows, regenerate the lockfile and write down what changed.
- All secrets and personal data were removed or replaced with placeholders. Never add real credentials. Every outside service has to be replaced by a local fake or stub.
- Postgres refuses to run as root, so embedded Postgres has to be started by a normal user.

## What this is
A multi-tenant onboarding and KYC workflow engine. `apps/core` is NestJS on the Hono adapter. Durable workflow execution runs on Restate, mounted through one `/restate` controller. `apps/web` is a Vite React app, `apps/e2e` holds the Playwright suite, `integrations/` holds the connector services, `fake-services/` holds the local vendor fakes and `packages/fintivio` holds the shared schemas, entities and events, `packages/client-sdk` the client app SDK and `apps/core/src/solutions` ready-made solutions. The original code dates from May and June 2025.

## Where things stand
- **Database:** one Postgres with row-level security enforced. Neon and the per-tenant databases are gone. RLS only counts when the app connects as a restricted role, because superusers bypass it. Local Postgres comes from the `embedded-postgres` npm package.
- **Auth:** a local identity provider backed by Postgres replaces Descope. WorkOS and an OIDC provider are emulated for SSO tests. Staff always need a TOTP second factor.
- **Vendors:** every outside service the platform talks to (WorkOS, an identity provider, Didit, Documenso, a screening vendor, SMTP, DNS, a malware scanner, a content sanitiser) is a local fake that follows the vendor's API shape. `docs/vendor-api/` holds the Documenso OpenAPI specs the fake follows. DocuSeal and ComplyCube were removed.
- **Restate:** read `RESTATE.md`. The pair is server 1.7.12 with SDK 1.17.2, both from the npm registry. `vendor/` still holds the old 1.3.2 Linux server tarball as an unused fallback.
- **Tests:** the change logs report the last full e2e run as 466 passing tests over 104 flows and 89 core unit tests (`docs/changes/0011-ui-building-blocks.md`). `TESTING.md` still quotes older numbers from batch 0004. All of this was reported by the previous iteration and not re-run here. Run the suites before trusting it.

## Known gaps
- Passkeys and step-up authentication, object-store adapters for real clouds, edge and TLS for custom domains, and a connector SDK test kit (`docs/changes/0004-platform-capabilities.md`, `docs/plans/10-infrastructure-gaps.md`).
- Legacy schemas of the removed node engine remain in `packages/fintivio`, and the web app has type errors in legacy screens (database tables, logs, legacy nodes).
- The e2e browser tests need Chromium for Playwright (`bunx playwright install chromium`, or `PLAYWRIGHT_BROWSERS_PATH`). The Playwright CDN download may be blocked in a registry-only environment.
- `.env.example` files list every variable. Fill them with local values only.

## Goal
Finish the workflow engine and test it end to end with realistic banking scenarios: account opening with KYC pass, fail and manual review, loan origination, an AML hit, document resubmission, timeouts and the audit trail. Note what is verified by tests and what is only documented.
