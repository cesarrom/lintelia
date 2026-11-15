# Local development notes

Read this before running anything.

> **Status**: the project installs and runs offline; see the [readme](readme.md) for the commands (Postgres, Redis,
> Restate, dev servers). Done in [0001](docs/changes/0001-local-runtime.md): Bun 1.3.14, lockfile, Restate SDK 1.17.2 +
> server 1.7.12, one Postgres with Drizzle-managed RLS, local auth, local fakes for e-mail/storage/DNS. Done in
> [0002](docs/changes/0002-personas-flows-e2e.md): personas, flow catalogue, e2e suite. Done in
> [0003](docs/changes/0003-case-engine-and-journeys.md): Redis sessions, authorization model, case engine, loan and
> suspicious-activity journeys through the web app, platform staff operations. Still open: MFA/SSO, integrations
> (Didit KYC, Documenso, data sources), the DocuSeal -> Documenso move.

## The environment this copy was prepared for
- Linux x86_64 (Ubuntu 24.04), Node 22.21, npm 10.9, bun 1.3.14, 16 GB RAM, a normal non-root user.
- Only the npm registry (and PyPI) is reachable. Assume no Docker, no GitHub or CDN downloads, no Hugging Face, and no third-party APIs.
- The registry may not show every old version. Run `node check-registry.mjs` first. It lists lockfile pins the registry cannot serve. If many are missing, do not fight the lockfile: relax the ranges to what the registry shows, regenerate the lockfile and write down what changed.
- All secrets and personal data were removed or replaced with placeholders. Never add real credentials. Every outside service has to be replaced by a local fake or stub.
- Postgres refuses to run as root, so embedded Postgres has to be started by a normal user.

## What this is
A multi-tenant onboarding and KYC workflow engine. `apps/core` is NestJS on the Hono adapter. The durable workflow execution runs on Restate, with about 22 service files in `apps/core/src/services/restate` mounted through one `/restate` controller. `apps/web` is a Vite React app, and `packages/fintivio` holds the shared schemas, entities and events. It was last worked on in May and June 2025 and was never committed in this layout. There are no tests. Parts of the root README and package names are still the Turborepo starter template.

## Direction (where this is heading)
- **Away from Neon.** Today each tenant gets its own database, created through the Neon API (`neon.client.ts`, `connection.service.ts`, `@neondatabase/serverless`). The plan is one normal Postgres with row level security enforced: a `tenant_id` on tenant tables, a policy on each, and the tenant set per transaction with `set_config('app.tenant_id', ..., true)`. The two migration sets (`drizzle-global`, `drizzle-tenant`) merge into one.
- RLS only counts if tests connect as a restricted role. Superusers bypass it.
- Local Postgres comes from the `embedded-postgres` npm package.
- **Goal:** finish the workflow engine and test it end to end with realistic banking scenarios: account opening with KYC pass, fail and manual review, loan origination, an AML hit, document resubmission, timeouts and the audit trail. Real vendor sandboxes are not reachable, so the scenarios run against faithful fakes. Write the scenario catalog down as a deliverable.

## What will not work as is
- `apps/core/src/main.ts` signs in a developer through the Descope management API on startup, so the app cannot boot offline until auth is replaced with a local provider. It reads the user from `DEV_USER_EMAIL`.
- Outside services to fake or replace: Descope (auth), ComplyCube and Onfido (KYC), AWS (S3, SQS, DynamoDB, CloudFront domains), Neon, SMTP and Mailgun, OpenAI, Vercel Blob, Documenso (replacing DocuSeal, see below).
- `.env.example` lists every variable. Fill them with local values only.

## Restate
Read `RESTATE.md`. The code was built against SDK 1.6.0 and server 1.3.2, and `vendor/` holds the 1.3.2 Linux server. The container's registry showed SDK 1.17.2 and server 1.7.12 as the newest versions and hid 1.6.0 and 1.3.2. If that holds, move both to the versions the registry shows (they should be a matching pair), and prove it with a one-handler hello service before touching the workflow code. The vendored 1.3.2 server probably will not pair with a much newer SDK.

## Signing provider: moving from DocuSeal to Documenso
DocuSeal is being replaced by Documenso. The reason, as the owner remembers it: DocuSeal's free self-hosted edition does not give you the API, and this project needs to create templates dynamically through the API. DocuSeal's pricing page says API and embedding are part of its paid Pro plan (a license key from a Pro seat, plus per-document fees). Documenso's API can create templates directly. To my knowledge Documenso is AGPL licensed, so check its terms for how it will be deployed.

- The API contract is in `docs/vendor-api/`: `documenso-openapi-v2.json` (89 paths, including `POST /template/create`, `/template/use`, and template fields and recipients) and `documenso-openapi-v1.json` (13 paths, including `/api/v1/templates` and `/api/v1/templates/{templateId}/create-document`). They were downloaded from app.documenso.com on 2026-11-13 and are the only description of the API available offline. Build against them, not from memory.
- Neither DocuSeal nor Documenso can run in the container, because both are separate services. Put signing behind a provider interface: one Documenso adapter plus a local fake that follows the same spec (create a template, add fields and recipients, create a document from a template, signing status, a completion webhook).
- Remove the DocuSeal pieces as part of the move, including its environment variables, container definitions and fake data.

Where DocuSeal is used today:
- `apps/core/src/handlers/docuseal.controller.ts`, registered in `app.module.ts`, with constants in `constants.ts`.
- `packages/fintivio/src/schemas/dto.schema.ts` holds the DTOs.
- Web: `apps/web/src/lib/services/docuseal.hooks.ts` and the document template UI (`CreateTemplateDialog.tsx`). Dynamic template creation from the document screens is exactly the capability that needs the new provider.
