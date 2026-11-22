# Plan: next batches (after 0003)

Written from the review of batch 0003 ([../changes/0003-case-engine-and-journeys.md](../changes/0003-case-engine-and-journeys.md)).
Each document lists what to build, the decisions it depends on, how it is tested (e2e flows) and the gaps per
infrastructure choice. **Batch 0004 implemented most of M0–M9** ([../changes/0004-platform-capabilities.md](../changes/0004-platform-capabilities.md));
the status column below says what is left.

| # | Document | Topic | Status after 0004 |
| --- | --- | --- | --- |
| 01 | [01-workflow-editor-and-components.md](01-workflow-editor-and-components.md) | why nodes render empty in the editor; one component catalogue shared by editor, engine and connectors; retiring the legacy engine | done; legacy node engine removed (its schemas in packages/lintelia remain) |
| 02 | [02-identity-sso-mfa.md](02-identity-sso-mfa.md) | SSO for staff and institutions through WorkOS, with a local WorkOS-compatible emulator; MFA; SCIM | SSO (institutions + staff), directory sync (SCIM), TOTP MFA, policy done; left: passkeys, step-up, SAML fake, group → role mapping |
| 03 | [03-integrations-architecture.md](03-integrations-architecture.md) | connectors as separate services: manifests, registry, connect/setup flows, SDK, workflow components, events, canonical entities | done; left: SDK test kit, UI bridge session tokens, lifecycle events beyond `uninstalled`, client-audience connectors |
| 04 | [04-api-clients-and-webhooks.md](04-api-clients-and-webhooks.md) | OAuth client credentials for institutions' systems, outbound signed webhooks, inbound webhooks | done (incl. rate limits, Idempotency-Key); left: `/v1` + OpenAPI, replay of a time range |
| 05 | [05-didit-and-documenso.md](05-didit-and-documenso.md) | the first two vendor connectors and their fake services (best effort until sandbox access) | done (against fakes; ASSUMPTIONS.md per connector); DocuSeal removed |
| 06 | [06-parties-and-fan-out-components.md](06-parties-and-fan-out-components.md) | co-applicants, guarantors, UBOs as workflow patterns: form requests, iteration, sub-workflows, tasks | parties.collect/wait/update, foreach, workflow.call, task (sticky routing), form.request done; left: repeatable form sections, editor container node for foreach |
| 07 | [07-file-uploads.md](07-file-uploads.md) | uploads in client requests and forms: presigned/resumable uploads, quarantine, malware scanning, downloads | done with the local object store; left: S3/Azure/GCS adapters, tus/resumable uploads, thumbnails |
| 08 | [08-local-development-and-fake-services.md](08-local-development-and-fake-services.md) | local mailbox (the missing verification e-mail), `fake-services/*`, one command to run the stack | done |
| 09 | [09-custom-domains.md](09-custom-domains.md) | deferred: what custom domains need per edge provider | ownership verification done (TXT, fake DNS); left: edge provider (TLS, routing), periodic re-checks |
| 10 | [10-infrastructure-gaps.md](10-infrastructure-gaps.md) | "if AWS then …, if Azure then …, if GCP then …" for every piece of the platform | reference |
| 11 | [11-client-experience-builder.md](11-client-experience-builder.md) | institutions build their clients' app: registration, journeys (screens as workflow steps), pages, data and actions, custom widgets | v1 shipped ([0007](../changes/0007-client-apps.md)) |
| 12 | [12-dealer-finance.md](12-dealer-finance.md) | dealer finance (indirect auto lending) end to end, and what the platform needed for it: stages, functions, signals, a generic HTTP connector, AI, LoanPro, workflows that create clients | v1 shipped ([0008](../changes/0008-dealer-finance.md)) |
| 13 | [13-experience-map.md](13-experience-map.md) | a Figma-like map of everything built: layout, pages, journeys and their screens, workflows, functions, forms, events — navigable, each frame opening its editor | v1 shipped as an experiment ([0009](../changes/0009-experience-map.md)) |
| 14 | [14-ui-building-blocks.md](14-ui-building-blocks.md) | cheap, high-leverage building blocks for designers: how journeys open (dialog, sheet, full screen, FAB, deep links), scanner / signature / OTP / slider / calculated and conditional fields, screens that continue by themselves, branding (presets, accent, fonts, shapes, logo colours, readability), region | v1 shipped ([0011](../changes/0011-ui-building-blocks.md)); catalogue of what is left |
| 15 | [15-access-and-roles.md](15-access-and-roles.md) | who sees what: custom permissions the institution names, system roles extended with them, access rules on workflows (start, cases) and on everything of 16, roles page (matrix, members, usage, "who can"), IdP groups → roles, member attributes and conditions, time-bound roles, access reviews | implemented ([0012](../changes/0012-access-control.md)); left: access-review campaigns |
| 16 | [16-back-office-app.md](16-back-office-app.md) | the institution's own back office: custom pages, widgets, menu items, homes per role, actions that start workflows with staff screens (`team.screen`), slots in the built-in client / case / dashboard pages; served pruned per member, re-checked on use, access report at publish | first iteration shipped ([0013](../changes/0013-back-office.md)); left in §12 |
| 17 | [17-live-data-and-events.md](17-live-data-and-events.md) | exploratory: outside events reaching running workflows (correlation keys, `event.wait`, start-or-deliver, `poll`) and screens that update by themselves (SSE topics, notify-then-fetch, workflow channels, addresses handed out in advance, streams such as market data) | first iteration shipped ([0014](../changes/0014-live-data-and-events.md)); left in §9 |

## Batch 15 → 16 → 17 (done; what is left is in each plan's last section)

```
15.1  custom permissions, system-role extensions, gated workflows (access.start / access.cases)   ── foundation of 16
15.2  roles page: matrix, role detail (members, what it opens), "who can", member access
16.1  back-office app: definition, versions, pruned serving, sidebar, pages, member/cases/tasks sources
16.2  actions and team.screen (staff wizards and form tasks)
15.3  IdP groups → roles (SSO + SCIM; WorkOS fake emits groups)                                   ── can run in parallel with 16
16.3  context pages and slots (client, case, dashboard), records sources, team widgets
16.4  studio back-office mode: access panel, preview as, access report
15.4  member attributes and conditions · 15.5 time-bound roles, access reviews
17.0  spikes S1–S5 (SSE on our stack, live balance, correlation, progress channel, load)          ── can start any time
17.1+ as decided after the spikes
```

Each step ships with its e2e flows (ids proposed in each document) and a change log in `docs/changes/`. The decisions
each document needs are in its last section.

## Proposed order of plans 01–09 (after 0003; done in 0004)

```
M0  quick fixes            editor renders every step (01 §Quick fix) · local mailbox UI (08) · `bun run stack` (08)
M1  component catalogue    01: catalogue API, generic nodes/config forms, editor ⇄ engine parity, legacy engine inventory
M2  integrations core      03: registry, manifests, OAuth server for connectors, connect/setup flows, action/trigger
                           protocol, SDK, first connector (SMTP mailer) + reference data-source connector
M3  API clients & webhooks 04 (reuses M2's OAuth server and event outbox)      ── can run in parallel with M4
M4  SSO                    02: fake WorkOS + WorkOS adapter, staff SSO, institution SSO/SCIM, MFA for password users
M5  uploads                07 (Documenso needs documents; client requests need files)
M6  Didit                  05 + 03 client steps; canonical verification results
M7  Documenso              05; DocuSeal removed
M8  parties & fan-out      06: co-applicant/guarantor/UBO templates (uses Didit per party)
M9  custom domains         09, once the edge provider is chosen
```

## Decisions (recorded 2026-11-14)

| # | Topic | Decision | Where it changes the plan |
| --- | --- | --- | --- |
| 1 | WorkOS | **SSO broker** (+ Directory Sync, Admin Portal). In production we connect our company IdP for staff; each bank connects its own IdP for its staff. Clients are out of scope | [02](02-identity-sso-mfa.md) |
| 2 | Connectors | **First-party only** at first; the manifest/registry contract stays third-party-ready | [03](03-integrations-architecture.md) §Trust model |
| 3 | Vendor secrets | **In each connector** (app-owned credentials). This is the standard for app platforms whose integrations run as separate services (Slack, Shopify, Atlassian apps); the alternative standard (a central credential vault: Zapier, n8n, Nango, Merge) fits platforms that run integration code themselves. Rationale and guard-rails in 03 | [03](03-integrations-architecture.md) §Where vendor secrets live |
| 4 | Cloud provider | **Unknown**: everything stays behind ports/adapters; [10](10-infrastructure-gaps.md) lists per-provider work | 10 |
| 5 | Webhooks | **Build our own** on Restate, Standard Webhooks format, designed so a later move to Svix (or similar) is a swap of the sender | [04](04-api-clients-and-webhooks.md) §Migrating to Svix later |
| 6 | Uploads | limits and types decided in 07; **sanitisation (CDR) required**, emulated locally by `fake-services/sanitizer` | [07](07-file-uploads.md) |
| 7 | Data residency | single region now, **ready to split into regional cells** when needed: rules to follow from now on | [10](10-infrastructure-gaps.md) §10 |
| — | Local stack | **one command** (`bun run stack`) starts everything, with status, logs, reset and stop; first item of M0 | [08](08-local-development-and-fake-services.md) §One command |
