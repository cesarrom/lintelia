# 0004 — Platform capabilities: one-command stack, components, connectors, API/webhooks, files, identity, parties

Implements most of the plan in [../plans/README.md](../plans/README.md) (M0–M9). Test state at the end of the batch:
see [../testing/flow-status.md](../testing/flow-status.md) (regenerated from the last full e2e run).

## Local development (plan 08)

- **`bun run stack`**: one command starts Postgres, Redis, Restate, the API, the web app, the shared package watcher,
  every connector and every fake vendor; runs migrations, seeds, creates connector databases and registers the
  connectors. `--detach`, `stack:status|logs|restart <service>|stop|reset|doctor|test`. Declared in
  `dev/stack.config.ts`, ports in `dev/ports.json`, supervisor in `scripts/stack.ts` (process groups, restarts with a
  budget, reuse of services already running, logs in `.data/stack/logs`).
- `packages/fintivio` builds with `scripts/watch.ts` (builds in `.build/` and swaps files into `dist/`): `bunchee
  --watch` emptied `dist/` for ~50 s at every start, breaking everything importing it.
- Fake services (`fake-services/*`, on `packages/fake-kit`): **mailbox** (SMTP + web inbox + REST API, the missing
  verification e-mails), **webhook-receiver**, **scanner** (EICAR), **sanitizer** (PDF rebuild, image metadata),
  **didit**, **documenso**, **screening**, **workos** (emulator), **idp-oidc** (OpenID Connect IdP), **dns**.
- Deleting an institution kills its running case executions in Restate (they used to retry forever against deleted
  rows).

## Workflow components and editor (plan 01)

One **component catalogue** (`packages/fintivio/src/schemas/components.schema.ts`, `apps/core/src/engine/components`)
drives the editor (palette, generated configuration forms, event handles), validation at publish (including "this
step has an event its component never emits") and the engine. `GET /workflow-components` includes the components of
the institution's active connections. The editor renders every step, persists positions, tidies the layout (elk),
validates and publishes; configuration forms offer connections, dynamic options from connectors (e.g. Documenso
templates) and published workflows (sub-workflows).

## Integrations as connectors (plans 03, 05)

- Connectors are separate services with their own databases and secrets (`integrations/*`, SDK in
  `packages/connector-sdk`): **smtp-mailer**, **postgres-datasource**, **didit** (identity verification, client step),
  **documenso** (e-signature, client step; the signed PDF is attached to the case), **screening** (sanctions/PEP).
- Core: registry (staff register/approve/revoke versions: *Platform → Connectors*), installations (*Integrations*
  page: consent, the connector's own pages, settings embedded, removal blocked while published workflows use the
  connection), connector API (`private_key_jwt`, installation tokens, executions, records, files, events), signed
  core → connector requests, canonical case records shown on the case page.
- Client steps: the portal opens the vendor's page (Didit's verification, Documenso's signing) in a dialog; the core
  reminds and expires them; decisions arrive by the vendors' signed webhooks at the connectors.
- DocuSeal removed (controller, env, DTOs, web dialog, dependencies); the *Documents* page lists the templates of the
  Documenso connections. The old in-core `/integrations` API (connections with secrets in the core) is gone.

## API clients and webhooks (plan 04)

OAuth 2.0 client credentials (`/oauth/token`, *API clients* page) with the `api_client` principal, rate limits per
client and institution and `Idempotency-Key` replay on POST; `POST /events`
starts workflows subscribed with `startOn: api:<type>`; outbound **Standard Webhooks** with an outbox written in the
audit entry's transaction, a durable Restate dispatcher (retries, delivery log, resend, test events, rotation with
two signatures, disabling on 410), *Webhooks* page.

## Files (plan 07)

Upload intents, signed upload URLs into quarantine, the durable intake workflow (type sniffing, malware scan,
sanitisation, rescan), signed 60-second downloads, audit; the portal uploader for `file` items of client requests
(clients see "checking for viruses…", refused files), files on the case and in the reviewer's task.

## Identity (plan 02)

- **MFA** (TOTP + recovery codes): always for staff; for members when the institution's policy requires it (default
  for new institutions; *Settings → Security*). Enrolment and verification in the sign-in page, including invitation
  acceptance. `bun run totp` prints the seeded staff account's code.
- **Single sign-on through WorkOS** (SSO broker) for institutions (Admin Portal links, verified domains, enforcement,
  just-in-time accounts, e-mail-first sign-in, **directory sync** from the IdP's SCIM directory with deprovisioning) and
  for **platform staff** (company IdP, invitation-only accounts, break-glass accounts). Locally the real `@workos-inc/node` SDK talks to the WorkOS emulator, which talks real OIDC
  to the fake IdP.
- **Custom domains** with DNS TXT ownership verification (plan 09, first part); a host name serves one institution.

## Related parties (plan 06)

`parties.collect`, `parties.wait`, `parties.update`, `foreach`, `workflow.call`, `task` (work items with sticky
routing: one person handles every party) and `form.request` (one of the institution's forms sent to a person, filled in
the portal) components; party invitations with
single-use links; a party only sees their own part; the case page lists parties and their sub-cases. The KYB
scenario runs one sub-workflow per beneficial owner (each verifies with Didit) before the review.

## Legacy node engine removed

The node engine that ran the old editor's nodes (`apps/core/src/services/restate/*`: form, wizard, iterator,
identity validation (ComplyCube), proof of life, database, API, document extractor…) and its public Restate
handlers are gone: they carried user session tokens into the Restate journal and duplicated what the case engine and
connectors now do. Log-pattern system triggers start cases on the case engine. The editor lost the legacy node
renderers and trigger sidebar (every step comes from the component catalogue; its "Run" starts a case), and
ComplyCube was removed. The Restate endpoint now serves only `caseRun`, `webhooks` and `fileIntake`.

## Tests

New or rewritten e2e files: `fi-roles/integrations.api` (INT-01..05), `fi-admin/integrations.ui` (CON-01),
`staff/connectors.api` (CON-04), `fi-admin/webhooks.api` (WH-01, WH-02), `fi-admin/api-clients-webhooks.ui`,
`clients/uploads.api|ui` (UPL-01..04), `clients/verify-and-sign.ui` (CLI-04, CLI-06), `clients/related-parties.ui`
(CLI-08), `fi-roles/party-routing.api` (PTY-01), `fi-admin/sso-scim.api` + `sso.ui` (FIA-06, FIA-07 on the broker),
`staff/staff-sso.api`, custom domains in `fi-admin/workspace.api` (FIA-03), `scenarios/aml-screening` (screening
connector), MFA in
`security-policy.api` / `staff-management.api`, scenario fixtures moved to connector components. The suite signs in
with second factors like people do (`support/factories.ts`) and shares one staff session per run.

## Known gaps

Passkeys and step-up, legacy schemas still in `packages/fintivio` (node configs of the removed engine) and legacy
screens (database tables, logs, reviews), object store adapters for clouds, edge/TLS for custom
domains, connector SDK test kit. Web typecheck errors remain in legacy screens (database tables, logs, legacy nodes).
