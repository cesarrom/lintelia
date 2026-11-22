# Lintelia: platform or KYC product? Evidence and positioning

Date: 2026-11-21. Branch: demo/sales-kit. Read-only investigation of the repository (no stack run, no spend, no git changes). "Works" means the e2e flow passed in the last recorded run (`docs/testing/flow-status.md`: 564 tests passed, 128 flows, 2026-11-18; 90 spec files under `apps/e2e/tests`). Every vendor in that run is a local fake.

## 0. Verdict in ten lines

1. The hypothesis is largely right about the engine: it is a generic, tenant-configurable workflow and case engine, not a KYC engine. KYC is one of at least nine business processes the repo runs on the same mechanisms.
2. "Enterprise n8n" is the wrong comparison. n8n automates app-to-app triggers and actions. Lintelia runs long-lived cases with people in them (queues, authority, four-eyes, client requests, audit). The right neighbours are Camunda/Pega/Appian-style case management (the repo's own docs say so, `docs/architecture/cases-and-workflows.md`), with Restate (a Temporal peer) underneath.
3. Workflows, steps, routing, authority, SLAs, forms, roles, permissions, access rules, e-mail templates, the customer app and the back-office screens are data per tenant, edited in the UI or API and published as versions without a deploy.
4. An engineer must still code: connectors (first-party only), new built-in step types, client-app and back-office widgets, "solution" installers, and several fixed-function services (data rights, access changes, file intake, webhooks).
5. Decision policies are JSONata expressions inside steps. There is no decision-table or rules/pricing engine (`apps/core/src/utils/dmn.ts` is a stub).
6. Every outward surface frames the product as one narrow use case (`readme.md` tagline, `demo/PLAN.md` promise, `lib/products.ts` kind and logline). The code supports a wider claim.
7. Supportable today: (b) "workflow and case platform for regulated customer operations, onboarding as the flagship". (a) is true but under-sells. (c) is not supportable.
8. Weak spots to stay honest about: every vendor integration is proven only against fakes; no deployment artefacts (no Dockerfile, IaC or license file); no connector catalogue, marketplace or code node; no scheduled (cron) start found in the engine.
9. Cheapest proof of the platform angle: the same engine running a second, non-onboarding workflow (suspicious-activity investigation, `scenarios/suspicious-activity.ui.spec.ts`) and a designer changing a workflow on the canvas.
10. Dealer finance is the strongest platform proof (11 workflows, 5 systems) but is a project of its own to film. Use stills and one sentence now.

---

## 1. How generic is the engine?

### 1.1 The runtime

- One generic durable workflow, `caseRun`, a Restate workflow keyed by case id: `apps/core/src/engine/case-runner.ts` (212 lines, `restate.workflow({...})` at line 193). It loads the published YAML of the case's workflow version, interprets it step by step (`getComponent(step.type)`, `executeStep`, follow `step.events[].next`), journals every result and finishes the case. There is no per-use-case branch in the engine; the only mentions of dealer, loan or KYC under `apps/core/src/engine` are example strings in descriptions.
- Signed start: the API creates the case, then calls the engine with an HMAC signature (`apps/core/src/auth/internal-signature.ts`), so no user token enters the journal (flows X-05, X-06).
- Waiting is durable: human tasks, client requests, signals, events and timers are Restate promises and timers (`engine/signals.ts`, `engine/events.ts`, `engine/components/*`). Reminders, expiry and SLA escalation are step settings (`remindAfter`, `expiresAfter`, `sla` + `escalateTo`), proved by `scenarios/timeouts.api.spec.ts`.
- The legacy node engine (decision tables, proof of life, etc.) was removed (`docs/plans/README.md` row 01). Only its zod schemas remain in `packages/lintelia`.

### 1.2 Data model (Postgres, Drizzle, RLS on every tenant table)

`packages/lintelia/src/entities/{tenant,global}/*.ts`: about 70 tables; each tenant table has `tenant_id` plus `tenantIsolationPolicy` (`entities/rls.ts`), restricted DB roles, composite `(tenant_id, id)` foreign keys.

| What the institution defines (data) | Tables |
| --- | --- |
| Workflow draft and published versions | `sys_workflows` (draft YAML), `workflow_versions` (immutable YAML, `start_on`, `access` rules, status) in `workflow.entity.ts`, `case.entity.ts` |
| Forms and embeds | `sys_forms`, `sys_form_instances`, `sys_form_answers`, `public_form_keys` |
| Roles and permissions | `roles`, `user_roles` (time-bound), `custom_permissions`, `role_mappings` (IdP groups), `member_attribute_definitions`, `access_changes` |
| Notifications | `sys_email_templates`, `client_notifications`, `live_messages` |
| Connections to systems | `connector_installations` (secrets stay inside the connector) |
| Customer app and staff back office | `client_apps`, `client_app_versions` (journeys are workflows, pages are JSON) |
| Machine access | `api_clients`, `webhook_subscriptions`, `webhook_deliveries`, `event_outbox`, `inbound_events` |
| What the runtime produces | `cases` (status, outcome, stage, risk, flags, applicant, consents), `tasks`, `case_signals`, `case_events`, `case_keys`, `case_parties`, `case_records` (verification, signature, screening, document, message), `case_files`, `uploads`, `audit_events` (hash-chained) |
| Policy | `tenant_security_policies`, `tenant_sso_settings`, `custom_domains` |

### 1.3 Step (node) types: one registry, declared as data

Registry: `apps/core/src/engine/components/index.ts`. Each component is a JSON-Schema `configSchema` plus an executor, served to the editor at `GET /workflow-components`. Publishing validates every step against its schema, the roles, connections, stages and function targets (`docs/architecture/cases-and-workflows.md`).

| Group | Step types |
| --- | --- |
| Flow | `start`, `end`, `conditional`, `wait`, `foreach` (child case per item), `workflow.call`, `webhook.wait`, `event.wait`, `poll` |
| Data | `calculate`, `data.map` (JSONata) |
| People | `review` (assignTo role, authority standard or high, SLA, escalateTo, custom outcomes, reason required, four-eyes), `task`, `parties.collect`, `parties.wait`, `parties.update` |
| Client | `client.request` (text and file items), `form.request`, `client.screen` (fields: text, money, date, select, file, scan with EMV/EPC parsing, signature, otp, slider, calculated), `client.data`, `client.record`, `client.profile`, `client.notify`, `client.upsert` |
| Case | `case.update` (stage, data, risk, flags, business keys), `case.decision` (status, outcome, notification) |
| Comms | `email`, `live.publish` (case channel, applicant, member, role, webhook) |
| Functions | `function:<workflow id>`: any published workflow marked `function: true` becomes a step with inputs and outputs |
| Connectors | `connector:<id>/<key>`: `didit/kyc.verify`, `documenso/signature.request`, `screening/screening.check`, `postgres-datasource/query.run`, `smtp-mailer/email.send`, `http/request` (any REST API), `ai/document.extract`, `ai/text.generate`, `loanpro/loan.board`, `loanpro/payment.create`, `loanpro/loan.get` |

Expression language: JSONata (`= expr`) and `{{template}}` in any field marked `x-expression`. Branching, routing (`assignTo.role: "= amount > 50000 ? 'senior_reviewer' : 'reviewer'"`), authority and calculations are all data.

### 1.4 How a new workflow is created

1. A designer (`workflows:manage`) opens Workflows and starts blank, from a template (`GET/POST /workflow-templates`; `apps/core/src/engine/templates/`: account-opening, loan-pre-approval, suspicious-activity) or by pasting YAML.
2. Edits on the React Flow canvas, with a palette generated from the component catalogue and a config dialog generated from each `configSchema` (`apps/web/src/app/modules/private/workflows/components/WorkflowEditor.tsx`, `catalog/Palette.tsx`, `catalog/ComponentNode.tsx`; spec `fi-roles/workflow-editor.ui.spec.ts`, DES-06), or edits the YAML (`yaml/YamlActions.tsx`).
3. `GET /workflows/:id/validation`, then `POST /workflows/:id/publish` (`workflows:publish`) freezes an immutable version. Running cases keep their version (DES-02). If the change alters who may start the workflow, publication waits for an administrator (FIA-14).
4. Triggers: published form submission, API (`POST /workflows/:id/executions`), assisted application (`POST /cases`), platform, connector or API events (`startOn`, `POST /events`), a client-app journey button, a back-office action.
5. No deploy at any point.

### 1.5 What a tenant configures, and what needs an engineer

| Tenant side, no deploy (UI or API) | Needs a Lintelia engineer |
| --- | --- |
| Workflows, versions, functions, stages, outputs, who may start and who may see cases (`access` rules with JSONata conditions) | A new built-in step type (`engine/components/*.ts`) |
| Forms and public embeds with an origin allow-list | A new connector (separate service, `packages/connector-sdk`). First-party only today: staff register and approve versions (`docs/architecture/integrations.md`) |
| Custom roles, custom permissions, member attributes, IdP group mappings, time-bound roles, second-approver policy | A new client-app or back-office widget kind (the catalogue is in code) |
| E-mail templates, branding, custom domains, security policy (MFA, sessions) | A new "solution" installer: dealer finance has a TypeScript installer with `DEALER_FINANCE_REQUIRES` (`solutions/dealer-finance/index.ts`) and a one-line special case in `client-apps/studio.service.ts:125` |
| Connections to the systems the connectors cover; any REST API through the HTTP connector (API key, bearer, basic, OAuth client credentials) | Real vendor sandboxes and assumptions (`integrations/*/docs/ASSUMPTIONS.md`) |
| Customer app: pages, journeys (screens), eligibility, branding (studio, versions, rollback) | Fixed-function services that are not workflows: data-rights requests, access-change control, invitations, file intake, tenant lifecycle, webhook dispatcher |
| Back-office pages, buttons, tabs, actions that start workflows, role homes (BOA-01..08) | OAuth flows Google and Intuit need (plan 12 section 6.4) |
| API clients, outbound webhooks, SSO and SCIM | Decision tables, pricing and rules engine (not built) |

### 1.6 Every business use case the repo demonstrates

All rows run on the same `caseRun` engine, the same component registry and the same tenant model. "Bespoke" means code outside those generic mechanisms.

| # | Business use case | Definition (data) | Specs | On generic mechanisms? | Bespoke code involved |
| --- | --- | --- | --- | --- | --- |
| 1 | Retail account opening with KYC (identity check, e-signature, automatic decision) | `apps/e2e/fixtures/workflows/retail-account-opening.yaml`; template `engine/templates/account-opening.yaml` | `scenarios/retail-account-opening.api`, `clients/verify-and-sign.ui`, `clients/apply-embedded.ui`, `demo/d02`, `d08` | Yes | Didit and Documenso connectors |
| 2 | Manual review of an inconclusive identity check | same workflow, `review` step | `fi-roles/reviewer-inbox.ui`, `demo/d08` | Yes | none |
| 3 | Loan pre-approval from an embedded website form (auto approve, reviewer, four-eyes above 50,000, auto decline) | template `loan-pre-approval.yaml` | `scenarios/loan-pre-approval.ui` (SCN-10), `demo/d04`, `d05` | Yes | none |
| 4 | Loan origination with a credit score read from the bank's own database | `fixtures/workflows/loan-origination.yaml` | `scenarios/loan-origination.api` (SCN-04) | Yes | postgres-datasource connector |
| 5 | AML, sanctions and PEP screening adjudicated by compliance | `fixtures/workflows/aml-screening.yaml` | `scenarios/aml-screening.api` (SCN-05) | Yes | screening connector (fake only) |
| 6 | Business onboarding (KYB), each owner verifies themselves | `kyb.yaml`, `party-verification.yaml`, `party-check.yaml` (`foreach`, `parties.*`) | `scenarios/kyb.api`, `clients/related-parties.ui` | Yes | none beyond Didit |
| 7 | Co-applicant or guarantor | `co-applicants.yaml` | `clients/related-parties.*`, `fi-roles/party-routing.api` | Yes | none |
| 8 | Assisted application: RM prepares, client confirms with consent | `POST /cases` | `fi-roles/assisted-application.ui`, `relationship-manager.api` | Yes | none |
| 9 | Suspicious-activity investigation: triage, investigation, MLRO decision, no tipping-off (`clientVisibility: requests_only`) | template `suspicious-activity.yaml`, started by event `client.flagged` | `scenarios/suspicious-activity.ui` (SCN-11), `fi-roles/compliance.api` | Yes | none |
| 10 | Dealer finance (indirect auto lending): dealer portal, AI document reading, underwriting with repeated "ask for more", contracts signed, dealer paid in QuickBooks, deal logged in Sheets, loan boarded in LoanPro, borrower app, servicing events, hardship, payoff, title by signal | 11 workflows in `apps/core/src/solutions/dealer-finance/*.yaml` (`deal.yaml` alone has 64 steps) plus a client-app template | `scenarios/dealer-finance.api` (5 tests), `dealer-finance.ui`, `automation/automation.api` (AUT-01..07), `automation/functions.ui` | Yes (workflows, functions, signals, events, HTTP connector) | AI and LoanPro connectors, a TS installer for the solution, five fakes |
| 11 | Servicing events reaching running cases by business key | `startOn: [{event, correlate}]`, `event.wait`, `poll` | `automation/events.api`, `live/live.api` (AUT-08..10, LIVE-05) | Yes | none |
| 12 | Customer banking app journeys: move money, freeze a card, open savings, pay with QR, onboarding from the app | client-app template; journeys are workflows (`client.screen`, `client.record`) | `client-app/banking-journeys.api`, `banking-app.ui`, `pay-with-qr.ui` | Yes. Caveat: money movement is a record write on demo data, not a payment rail | Banking template is a TS object (`client-apps/templates/index.ts`) |
| 13 | Staff fee waiver with an authority limit (within it refunded at once, above it a senior approves) | back-office template plus a workflow with a start rule | `back-office/back-office.api`, `.ui` (BOA-03) | Yes | none |
| 14 | Reminders, client expiry, reviewer SLA escalation | step settings | `scenarios/timeouts.api` | Yes | none |
| 15 | Data-rights requests (export, erasure) | `data_requests` table and service | `clients/data-rights.ui`, `privacy.api` | **No: fixed-function code**, not a workflow | `services/data-requests.service.ts` |
| 16 | Tenant onboarding, suspend, reactivate, support access (platform staff) | `tenants`, `support_grants` | `staff/*`, `demo/d01`, `d07` | **No: platform code** | `services/tenants.service.ts`, `support-access.service.ts` |
| 17 | Access change control with a second administrator | `access_changes` | `fi-admin/access-changes.api` (FIA-19) | **No: platform code** | `services/roles.service.ts`, `access/` |

Rows 1 to 14 are configuration on the generic engine. Rows 15 to 17 are platform governance features, part of the "regulated operations" half of the pitch rather than use cases.

### 1.7 Limits of the generality (honest)

- The case is person-centred: `cases.applicantId/Email/Name`, client profiles, a client portal, `client.*` steps, statuses like approved and rejected. Internal processes (procurement, HR, IT tickets) would fit technically (API or event start, no applicant) but nothing in the repo demonstrates one. Do not claim them.
- Decision policy is JSONata inside `conditional`, `calculate`, `assignTo` and `authority`. No decision tables, no versioned rule sets, no pricing or scorecard engine (plan 12 section 6.3 lists them as missing; `apps/core/src/utils/dmn.ts` has its evaluator commented out and returns `{}`).
- Scheduled start (cron): `docs/product/flows.md` DES-03 mentions "schedule", but I found no cron or scheduled-start code in `engine/` or `services/system-triggers.service.ts`. Timers exist inside a case (`wait`, `poll`, `buffer`, SLA). Verify before claiming scheduled workflows.
- No code node. Custom logic means JSONata, an HTTP call, or a connector we build.
- Fan-out exists (`foreach` child cases, `workflow.call`). I did not verify general parallel branches inside one case.

---

## 2. Compared with workflow tools

### 2.1 What Lintelia ships that n8n, Temporal and Camunda-style tools do not, out of the box

| Capability | Evidence |
| --- | --- |
| Human work as a first-class step: role queues, claim, authority levels, SLA and escalation, custom outcomes, reason required | `review`, `task` in `engine/components/builtin.ts`; REV-01..04, SUP-02 |
| Four-eyes and segregation of duties enforced in the service (the starter cannot decide; the second approver differs from the first) | `services/tasks.service.ts`; `fi-roles/senior-reviewer.api`, `reviewer.api`; `demo/d04` |
| Customer-facing journeys and a white-label portal, embeddable in the institution's site or app (SDK) | `client-app/*`, `packages/client-sdk`, `clients/apply-embedded.ui`, `client-app/embedded.ui` |
| A staff back-office builder with per-role pruning (menus, buttons, tabs, widgets removed server-side) | BOA-01..08, `back-office/*.spec.ts` |
| Multi-tenant isolation enforced in Postgres (RLS, restricted roles, composite FKs), proved through the API | `cross-cutting/tenant-isolation.api`, `clients/isolation.api`, `apps/core/test` |
| Platform staff cannot read tenant data; support access is time-bound and tenant-approved | STAFF-04, STAFF-05 |
| Hash-chained append-only audit and a per-case evidence pack export | `services/audit.writer.ts`; `GET /cases/:id/export`; AUD-01, SCN-08, `fi-admin/audit.api`, `demo/d09` |
| Role model: custom permissions, IdP group to role mapping, SCIM, time-bound roles, "who can" reports, second-administrator approval of grants | FIA-05, 13..19; `fi-admin/sso-scim.api`, `custom-access.api` |
| Vendor patterns done properly: signed webhooks in, Standard Webhooks out, per-installation encrypted secrets, crypto-shredding on uninstall | `docs/architecture/integrations.md`; INT-05, WH-01, CON-01..04 |
| Identity, signature and screening results as canonical records on the case | `case_records`; Didit, Documenso, screening connectors |
| File intake: type sniffing, malware scan, sanitisation before a file reaches a case | UPL-01..04; `clients/uploads.ui` |
| Consent, data-rights requests, no-tipping-off visibility | CLI-10, CMP-03, CMP-04 |
| Live updates to screens and to the institution's systems | LIVE-01..05, `/live` (SSE) |
| Business stages, pipeline board, one map of layout, journeys, workflows, forms, events | AUT-01, APP-11 |

### 2.2 What those tools have that Lintelia lacks

| Gap | State |
| --- | --- |
| Connector catalogue (n8n 400+, Camunda connectors) | 8 first-party connectors, all exercised against local fakes only; no tenant-built or third-party connectors; staff approve each version |
| Marketplace or template exchange | None. 3 workflow templates and 2 app templates ship in the repo |
| Code nodes (JS, Python) | None; JSONata only |
| Mature visual designer (sub-flows, BPMN, DMN, simulation, time-travel debugging) | A React Flow canvas with generated palette and dialogs works (DES-06). The `foreach` container node and a stage designer are listed as not built (plans 06, 12) |
| Decision tables and rules | Not built (1.7) |
| Self-host story | No Dockerfile, Helm chart, Terraform or license file at the repo root. `docs/plans/10-infrastructure-gaps.md` is an AWS, Azure and GCP gap matrix, not an implementation. The Restate server is BSL licensed (`RESTATE.md`) |
| Scale and reliability evidence | One load script for the live stream (`apps/core/scripts/live-load.ts`); no case-throughput numbers; no production deployment recorded |
| Operator observability (metrics, traces, run replay) | Restate admin only; the case timeline and audit log are the user-facing record |
| Public `/v1` API with OpenAPI | Planned (`docs/plans/README.md` row 04) |
| Scheduled start | Not found (1.7) |
| S3, Azure, GCS object stores | Local-directory adapter only (plan 07) |

### 2.3 Where n8n is the wrong comparison

- n8n's unit of work is a stateless run (trigger, nodes, done), usually short, owned by one team on its own data. Lintelia's unit is a case that lives for days or weeks, waits on people and customers, and belongs to one of many isolated institutions. Nothing in n8n maps to roles, authority, four-eyes, RLS tenancy, evidence packs or a customer portal.
- n8n's strengths (connector breadth, community, one-container self-host, fair-code licence) are exactly what Lintelia lacks. A buyer who hears "enterprise n8n" will ask for them first.
- Closer comparisons: Camunda 8 with Tasklist (BPMN plus human tasks), Pega and Appian (case management, the repo's own vocabulary note), Fenergo (KYC and CLM, a vertical product), Temporal and Restate (durable execution, code-first, no UI). Lintelia is a vertical-ready case platform that already ships the regulated-operations layer those engines leave to the buyer.
- It is also not an identity-verification vendor: it orchestrates Didit, Documenso and screening providers. Say it that way; swapping vendors per institution is a feature.

---

## 3. Which positioning the code supports

| Claim | Verdict | Why |
| --- | --- | --- |
| (a) "KYC and onboarding software" | Supportable, too small | True for rows 1 to 8 of 1.6. It hides rows 9 to 14 and invites comparison with Didit, Sumsub or Onfido, which Lintelia is not |
| (b) "Workflow and case platform for regulated customer operations, onboarding is the flagship" | **Supportable today** | Nine distinct processes on one engine, tenant-editable definitions, human tasks, roles, audit, customer and staff apps |
| (c) "Enterprise n8n" | Not supportable | Wrong category, and the three things an n8n buyer checks first (connector breadth, code nodes, self-host) are the gaps |

Safe claims (each has a passing spec):

- Institutions design, version and publish their own workflows and forms without a code change (DES-01, 02, 06).
- The same platform ran account opening, loan approval, business onboarding, suspicious-activity review and dealer finance in our tests, on simulated systems.
- Cases route to people by role with authority levels, SLAs, escalation and a two-approver rule (SUP-01).
- Each institution is isolated at the database level; platform staff need the institution's approval to look (X-01, STAFF-04, 05).
- Append-only, hash-chained audit trail and a per-case export.
- The institution can give its customers an app and its team a back office, both built in studios.
- Any REST API can be called from a workflow with credentials held outside the core (AUT-04).

Not yet, and the evidence that would unlock each:

| Claim | Evidence that unlocks it |
| --- | --- |
| "Works with Didit, Documenso, LoanPro, QuickBooks" as live integrations | One run against each vendor's real sandbox, with `ASSUMPTIONS.md` checked off |
| "Self-hostable", "deploy in your cloud" | A container build, a deployment guide and a recorded deploy |
| "Enterprise-ready", "scales", "bank-grade", "compliant", "certified" | A load test with numbers, a penetration test or audit report, a production tenant. The kit already bans these words (`demo/PLAN.md` 1.4) |
| "Connector marketplace", "build your own connectors" | A released connector SDK with docs and one connector built by someone else |
| "Rules engine", "decision tables", "pricing engine" | A decision-table step plus a worked example (rate sheet or scorecard) with a spec |
| "Scheduled workflows" | A cron start with a spec (or proof that one exists; I did not find it) |
| "Any process, not only customer ones" | One non-customer workflow (an internal approval started by API) shown running |
| "AI" beyond "AI reads documents in the dealer-finance example" | A recorded story using the AI connector against a real model |
| Customer counts, volumes, speed | None exist; do not invent them |

---

## 4. Recommendations

### 4.1 One-sentence positioning

- EN: **Lintelia is a workflow and case platform for regulated customer operations: each institution designs its own flows, forms, roles and customer app, with a person on the hard cases and a record of everything; onboarding and KYC is where it starts.**
- ES latam: **Lintelia es una plataforma de flujos y casos para operaciones reguladas con clientes: cada institución diseña sus propios flujos, formularios, roles y app para sus clientes, con una persona en los casos difíciles y un registro de todo; el alta de clientes y el KYC es donde empieza.**

No numbers, no customers, no certifications. "Where it starts" keeps onboarding as the flagship without making it the ceiling.

### 4.2 Changes to `askn-us/lib/products.ts` (Lintelia entry, lines 160 to 173)

The first four rows need no new footage.

| Field | Now | Change |
| --- | --- | --- |
| `kind` | "Customer onboarding and KYC for financial institutions" | EN: "Workflow and case platform for financial institutions". ES: "Plataforma de flujos y casos para instituciones financieras" |
| `logline` | "One workflow from application to approved account, with a person on the hard cases and a record of everything." | EN: "Institutions design their own workflows, forms and customer apps on one platform. Onboarding is the first one." ES: "Las instituciones diseñan sus propios flujos, formularios y apps para clientes en una sola plataforma. El alta de clientes es el primero." |
| `about` | Opens with onboarding mechanics | Reorder into four sentences: (1) each institution gets an isolated workspace and designs flows, forms, roles and a customer app without a code change; (2) work moves through rules, people by role and two-approver steps, and customers are served in the institution's own portal and site; (3) the same engine ran account opening and KYC, loan approval, business onboarding and suspicious-activity review (add "and dealer finance" only if a film or still shows it); (4) every case keeps a tamper-evident timeline and an evidence pack. Keep the existing honesty paragraph (demo data, simulated providers, English interface, no certification) and add "Integrations to identity, signature and accounting providers are shown against simulated services." |
| `category` | `FinanceApplication` | Keep |
| Phrase "Customer onboarding and KYC" | the product's identity | Keep only inside the onboarding film titles |

Also update: `demo/PLAN.md` section 1.3 (the one-sentence promise), the reel's closing card ("Onboarding and KYC workflows for financial institutions" to "Workflows and cases for financial institutions"), and `readme.md` line 3 ("Multi-tenant onboarding and KYC workflow platform for financial institutions" to "Multi-tenant workflow and case platform for financial institutions; onboarding and KYC is the flagship use case").

### 4.3 Retitles in `askn-us/content/videos.json` (EN and ES)

Footage stays; titles, descriptions and the reel's first and last cards change.

| Id | Now | Retitle to | Reason |
| --- | --- | --- | --- |
| lintelia-01 pitch reel | "Opening an account, from application to audit" | "One platform for regulated customer operations, with onboarding as the example". Change the opening card "Opening an account is more than a form" to a platform line; closing card per 4.2 | The reel is the entry point for the narrow frame |
| 02 tenant onboarding | "Onboarding a new institution" | "A new institution gets its own workspace" | "Onboarding" collides with customer onboarding; this is the multi-tenancy proof |
| 03 customer onboarding | "A customer opens an account: apply, verify, sign" | Keep | Flagship use case |
| 04 kyc review | "When the identity check is inconclusive, a person decides" | Keep | Human-in-the-loop proof |
| 05 roles four eyes | "Who can do what: roles and two approvers" | Keep | Governance |
| 07 automation vs manual | "Automatic when it is clear, a person when it is not" | Keep; add "The rules live in an editable workflow" to the description | Rules are data |
| 09 workflow design | "Build a form and a workflow, and embed it" | "The institution builds its own workflow, without code" | Strongest existing platform proof; lead with it |

Suggested order on the product page: reel, 09, 03, 04, 07, 05, 06, 02, 08, clips.

### 4.4 New videos that prove the platform angle

Existing footage: no raw recordings survive (a search for `*.webm` in the repo found none), so every new film needs a fresh recording. Only specs and still screens in `demo/screens` exist. Same kit rules apply (demo data, simulated providers, no claims).

**N1. "Same platform, a different job: a suspicious-activity investigation" (about 75 s)**
- Proves the engine that onboarded customers also runs a compliance investigation with different roles, outcomes and visibility rules (the client is never told).
- Reuses `apps/e2e/tests/scenarios/suspicious-activity.ui.spec.ts` (SCN-11; personas rm, analyst, investigator, mlro, auditor), `fi-roles/compliance.api.spec.ts` for claims, and the template `engine/templates/suspicious-activity.yaml`.
- Footage: none. It is stretch S5 in `demo/PLAN.md` ("strongest unused story"). It needs a new demo wrapper spec using `support/demo.ts` (`scene`, `focus`) over the existing steps; estimated 0.09 USD narration.
- Spine: an RM flags a client; a case opens for compliance; triage, escalation, a request to the client (the only thing the client sees), the MLRO decides; the audit shows everything; closing line "same engine as the account-opening workflow".

**N2. "The institution changes its own workflow, without code" (about 80 s)**
- Proves the institution, not the vendor, owns the business logic. A designer opens a template on the canvas, changes a review's authority threshold or adds a step, publishes version 2, and a new case follows the new path.
- Reuses `fi-roles/workflow-editor.ui.spec.ts` (DES-06 edits a template step and publishes), `demo/d06-workflow-config.demo.spec.ts` (the existing L09 recording) and `scenarios/loan-pre-approval.ui.spec.ts` for the run.
- Footage: partial. The L09 film (`demo/videos/09-workflow-design-*.mp4`) and stills `demo/screens/workflow-canvas.png` and `designer-templates.png` exist, but L09 shows form and embed, not step editing. About 60 s of new recording is needed (canvas, edit, publish v2, run a case).

**N3. "One engine, three workflows: account, loan, investigation" (about 60 s montage)**
- Proves breadth at a glance: each workflow's canvas beside its case page, same chrome, different roles and outcomes.
- Reuses the three templates through `POST /workflow-templates/:id/use`, and run states cut from L03, L05, L07 plus N1.
- Footage: partial. Account and loan case pages exist inside L03, L05 and L07; the investigation and the three canvases need recording. Depends on N1 and N2, so make it last.

Not recommended yet: a dealer-finance film (`scenarios/dealer-finance.ui.spec.ts`; seven minutes, five simulated systems; `demo/PLAN.md` S12). Use two or three stills and one sentence in the product `about`, for example "a second kind of lender, indirect auto finance, ran on the same engine in our tests" (safe: AUT-01..07 and SCN-12 pass). If budget allows later, a 90-second cut is the single strongest platform proof.

### 4.5 Order of work

1. Copy only, zero spend: `products.ts`, `readme.md` tagline, `demo/PLAN.md` promise, reel cards, video titles.
2. N2 then N1. Together they answer the hypothesis directly on screen.
3. N3 last.
4. Close evidence gaps in this order of value for a platform pitch: one real-sandbox run of one connector (Didit or Documenso), a container build with a deploy note, a decision-table step, a scheduled start.

---

## 5. Evidence index

| Topic | Path |
| --- | --- |
| Runtime | `apps/core/src/engine/case-runner.ts`, `engine/components/index.ts`, `builtin.ts`, `client-app.ts`, `events.ts`, `integration.ts`, `parties.ts`; `engine/events.ts`, `engine/signals.ts` |
| Contract docs | `docs/architecture/cases-and-workflows.md`, `integrations.md`, `authorization.md`, `identity.md`; `docs/product/flows.md`; `docs/testing/flow-status.md` |
| Schema | `packages/lintelia/src/entities/rls.ts`, `entities/tenant/*.ts`, `entities/global/*.ts` |
| Editor | `apps/web/src/app/modules/private/workflows/components/WorkflowEditor.tsx`, `catalog/*`, `yaml/YamlActions.tsx`; `apps/e2e/tests/fi-roles/workflow-editor.ui.spec.ts` |
| Workflows as data | `apps/core/src/engine/templates/*.yaml`, `apps/e2e/fixtures/workflows/*.yaml`, `apps/core/src/solutions/dealer-finance/*.yaml` |
| Dealer finance | `docs/changes/0008-dealer-finance.md`, `docs/plans/12-dealer-finance.md`, `apps/e2e/tests/scenarios/dealer-finance.*.spec.ts` |
| Gaps | `docs/plans/README.md`, `docs/plans/10-infrastructure-gaps.md`, `apps/core/src/utils/dmn.ts`, `integrations/*/docs/ASSUMPTIONS.md` |
| Current framing | `readme.md` line 3, `demo/PLAN.md` section 1.3, `demo/PRIORITY.md`, `askn-us/lib/products.ts` lines 160 to 173, `askn-us/content/videos.json` |
