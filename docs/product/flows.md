# Flow catalogue

Every flow has an id used as a tag in the e2e suite (`apps/e2e`, e.g. `@FIA-04`), so
`bun e2e --grep @FIA-04` runs it and `bun run --cwd apps/e2e flow-status` reports progress.
Personas are described in [personas.md](personas.md); contracts in
[../architecture/cases-and-workflows.md](../architecture/cases-and-workflows.md),
[../architecture/authorization.md](../architecture/authorization.md),
[../architecture/identity.md](../architecture/identity.md) and
[../architecture/integrations.md](../architecture/integrations.md).

Status legend (from the first run of the suite, see [../testing/flow-status.md](../testing/flow-status.md)):
**works**: all tests pass · **partial**: some pass · **planned**: nothing implemented yet.

Tech legend: what each flow relies on, including dependencies not in the project yet.

---

## Platform staff (STAFF)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| STAFF-01 | Sign in to the platform console, with MFA | works | local auth; TOTP (`otplib`), WebAuthn (`@simplewebauthn/server`); later company SSO |
| STAFF-02 | Onboard a financial institution | works | tenant provisioning, invitations (e-mail), DNS instructions |
| STAFF-03 | Manage an institution's lifecycle (suspend, reactivate, offboard) | works | platform connection, identity checks |
| STAFF-04 | No access to institution data by default | works | RLS + realm separation |
| STAFF-05 | Time-bound, institution-approved support access | works | support grants, audit |
| STAFF-06 | Manage platform staff and their roles | works | platform roles |
| STAFF-07 | Platform audit log | works | audit events |

**STAFF-01 Sign in to the platform console.** Staff open the platform host, sign in with e-mail and password and a
second factor. *Accept*: staff land on the console (tenant management), never inside a tenant; a staff account
without MFA must enrol before doing anything else.

**STAFF-02 Onboard a financial institution.** Staff fill the institution form (legal name, key, address, branding,
custom domains, first administrators) → the tenant is created with the system roles, invitations are e-mailed, DNS
records are shown for custom domains. *Accept*: invalid keys `400`, duplicate keys `409`; the tenant has every system
role of the catalogue; the invitee becomes administrator through the e-mail link; members of other tenants and
clients cannot create tenants.

**STAFF-03 Manage an institution's lifecycle.** Suspend (members and clients are locked out immediately, data kept),
reactivate, offboard. *Accept*: suspension takes effect on existing sessions; only staff can change status; deleting
an **active** institution is refused (`409`): it must be suspended first (two-step deletion).

**STAFF-04 No access to institution data by default.** *Accept*: staff tokens get `403` on tenant endpoints (members,
forms, workflows, logs) whatever tenant they name.

**STAFF-05 Support access.** Support staff request access to an institution (reason, read-only, ≤ 8 h); an FI admin
approves; the grant allows reads only, expires, can be revoked; every use is in the institution's audit log.
*Accept*: no access before approval, reads allowed during the grant, writes `403`, no access after revocation, audit
entries attributed to the staff member.

**STAFF-06 Manage platform staff.** Platform admins invite staff with platform roles (`platform_admin`,
`customer_success`, `support`, `platform_auditor`). *Accept*: invitation e-mail to the platform mailbox; a support
engineer cannot create tenants; customer success can.

**STAFF-07 Platform audit log.** *Accept*: creating, suspending and deleting tenants and support grants appear in
`GET /platform/audit` with the acting staff member.

## Financial institution administrator (FIA)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| FIA-01 | Accept the invitation and sign in for the first time | works | invitations, local auth |
| FIA-02 | Maintain the institution profile and branding | works | tenant self-update through RLS |
| FIA-03 | Custom domains with ownership verification | works | DNS TXT verification (fake resolver), TLS at the edge |
| FIA-04 | Manage the team (invite, roles, deactivate) | works | users, roles, invitations |
| FIA-05 | Define custom roles from the permission catalogue | works | authorization model |
| FIA-06 | Configure SSO (OIDC/SAML) with enforcement and JIT provisioning | works | `openid-client`, `@boxyhq/saml-jackson`; fake IdP `oidc-provider` |
| FIA-07 | Provision members from the IdP (SCIM 2.0) | works | broker Directory Sync (SCIM), events polling |
| FIA-08 | Security policy (MFA requirement, session lifetime) | works | MFA |
| FIA-10 | API credentials and outbound webhooks | works | OAuth client credentials, Standard Webhooks (`standardwebhooks`) |
| FIA-11 | Approve or revoke platform support access | works | see STAFF-05 |
| FIA-12 | Review and export the audit log | works | audit events |

**FIA-01** The invitee opens the e-mail link on the institution's host, chooses a password, lands on the dashboard
with the administrator role. *Accept*: the link works once, only on its institution.

**FIA-02** *Accept*: admins change name, logo, palette, working hours; members without `workspace:update` get `403`;
nobody can change another institution's profile.

**FIA-03** Admin adds `onboarding.bank.example` → gets a TXT challenge and a CNAME target → after DNS verification the
host serves the institution. *Accept*: an unverified host does not resolve to the institution; a host already claimed
by another institution is refused (`409`) (today any tenant can claim any host name: domain takeover risk).

**FIA-04** *Accept*: invite with a role (e-mail, link), change roles, deactivate (existing sessions stop working at
once), reactivate, reset password (e-mail); the last admin cannot be deactivated; nobody changes their own roles.

**FIA-05** *Accept*: `GET /permissions` lists the catalogue; system roles are listed with `isSystem` and cannot be
changed or deleted; custom roles only accept catalogue permissions; a member who may manage roles cannot create or
assign a role with permissions they do not hold.

**FIA-06** Admin registers the IdP (issuer, client id/secret, e-mail domains, default roles), tests it, enables
enforcement. Members typing an address of that domain are redirected to the IdP; first sign-in creates the member
(JIT). *Accept*: password sign-in refused for enforced domains (`sso_required`); IdP-authenticated members land in the
workspace with the default roles; a user from another domain cannot use the connection.

**FIA-07** *Accept*: with a SCIM token the IdP creates a member (`201`), the member appears in the team; deactivating
in the IdP (`active: false`) revokes access.

**FIA-08** *Accept*: with `requireMfa`, members must enrol TOTP before using the workspace; sign-in then requires a
code.

**FIA-10** *Accept*: an API client gets an explicit permission list, a secret shown once, short-lived tokens from
`POST /oauth/token`; calls outside its permissions are `403`; webhook deliveries for subscribed events are signed
(Standard Webhooks) and verifiable with the subscription secret.

**FIA-12** *Accept*: invitations, role changes, deactivations, integration changes and case decisions appear in
`GET /audit` with actor and target; entries cannot be changed or deleted (not even by the database role the app uses).

## Roles inside the institution

### Flow designer (DES)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| DES-01 | Build, publish and embed a form | works | public forms, origin allow-list, CSP `frame-ancestors` |
| DES-02 | Build, validate and publish versioned workflows | works | workflow versions |
| DES-03 | Trigger workflows (form submission, API, event, schedule) | works | triggers, API clients |
| DES-04 | Route human steps to roles with SLAs and escalation | works | tasks, timers (Restate) |
| DES-05 | Start from a workflow template (loan pre-approval, suspicious activity, account opening) | works | templates |

**DES-01** *Accept*: a published form has a public key and embed snippet; the public endpoint only answers allowed
origins and exposes no internal data; unpublished forms are `404`; only `forms:publish` holders publish.

**DES-02** *Accept*: new workflows are drafts; publishing creates an immutable version; invalid definitions (unknown
component, missing connection) are refused with errors; editing a published workflow creates a new draft while the
published version keeps running; only `workflows:publish` holders publish; executions cannot start without a
published version.

**DES-03** *Accept*: a submission of a published form starts the linked workflow; an API client with `cases:create`
starts a workflow over HTTP.

**DES-04** *Accept*: a review step routed to `reviewer` is visible to reviewers and not to other roles; a breached SLA
escalates to `senior_reviewer`.

**DES-05** *Accept*: the template gallery creates a draft copy of a ready-made workflow, which publishes as version 1.

**DES-01 in the UI**: the designer builds the form by clicking (or dragging) fields in the form builder and setting
their labels and property names, then "Publish & embed": chooses the published workflow and the websites allowed to
embed it, and copies the script snippet.

### Reviewer / KYC analyst (REV)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| REV-01 | Work my queue (see, claim) | works | tasks |
| REV-02 | Decide a case within my authority | works | tasks, conditions |
| REV-03 | Ask the client for more information | works | client tasks, notifications |
| REV-04 | Segregation of duties | works | conditions |

**REV-01** *Accept*: the queue lists tasks routed to my roles; claiming assigns me; tasks of other queues are not
visible. **REV-02** *Accept*: approve/reject with a reason moves the case on; a reject without reason is refused when
the step requires it; high-authority decisions are refused without `cases:approve_high_risk`. **REV-03** *Accept*: a
request creates a client task and e-mail; the client's answer reopens the review. **REV-04** *Accept*: a member who
started a case (assisted) cannot decide its tasks.

### Senior reviewer / team lead (SUP)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| SUP-01 | Four-eyes approval of high-risk cases | works | conditions |
| SUP-02 | Reassign work and handle SLA breaches | works | tasks |

**SUP-01** *Accept*: the first approval of a high-risk task leaves it `pending_second_approval`; the same user cannot
give the second approval; a different senior reviewer completes it. **SUP-02** *Accept*: `tasks:assign` holders
reassign tasks; reviewers cannot.

### Compliance officer / MLRO (CMP)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| CMP-01 | Adjudicate AML/sanctions/PEP screening hits | works | screening connector (fake) |
| CMP-02 | Case timeline and evidence export | works | audit events |
| CMP-03 | Handle clients' data-rights requests | works | data requests |
| CMP-04 | Decide on suspicious activity (file a SAR, exit the relationship, no action) without tipping off the client | works | event-started investigations, `clientVisibility: requests_only` |

**CMP-04** *Accept*: the MLRO decision is a high-authority task; the outcome (`sar_filed`, `relationship_exited`,
`no_action`) closes the case with flags and risk; the client is never told about the investigation or its outcome
(only neutral requests for information reach them).
### Relationship manager (RM)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| RM-01 | Start an assisted application for a client | works | cases, client invitations |
| RM-02 | Follow only my clients | works | case scope conditions |
| RM-03 | Flag a client's suspicious activity | works | `client.flagged` event → investigation workflow |

**RM-01** *Accept*: the RM prepares the application for an existing or new client; it waits for the client, who
follows the e-mail link, signs in with a code, reviews the data and confirms with consent; only then does the workflow
start. **RM-03** *Accept*: flagging (category, observation) opens an investigation case for the compliance team; the
flagger is told that the team was alerted but does not see the investigation.
### Support agent (AGT)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| AGT-01 | Look up a client's application and resend their link, without deciding | works | case scope, notifications |

### Integration manager (INT)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| INT-01 | Connect an external data source and test it | works | `postgres-datasource` connector, connector pages |
| INT-02 | Connected systems become workflow components | works | component registry, connector manifests |
| INT-03 | Use the institution's data in a workflow (parameterised, read-only) | works | `postgres-datasource` connector, Restate |
| INT-04 | Send e-mail/SMS through the institution's own providers | works | `smtp-mailer` connector, local mailbox |
| INT-05 | Secrets are write-only and encrypted at rest | works | connector SecretStore (AES-256-GCM envelope, per-connector KEK) |

### Connectors (CON)

Connectors are separate services with their own database (docs/plans/03). These flows cover the contract between the
core and any connector; the INT flows above cover the first-party connectors.

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| CON-01 | Connect a connector: consent, the connector's own pages, an active connection | works | exchange code, `private_key_jwt`, installation tokens |
| CON-02 | Use a connector step in a workflow (result and record on the case) | works | signed core → connector requests, case records |
| CON-03 | Disconnect: blocked while published workflows use it; the connector deletes its secrets | works | lifecycle events, crypto-shredding |
| CON-04 | Staff register, approve and revoke connector versions | works | connector registry |

### Auditor (AUD)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| AUD-01 | Read-only oversight of cases, flows and the audit log | works | authorization model |

## Clients (CLI)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| CLI-01 | Create an account and sign in on the institution's portal | works | local auth |
| CLI-02 | Passwordless sign-in with an e-mailed code | works | e-mail OTP |
| CLI-03 | Apply from the institution's website (embedded form), save and resume | works | public forms, OTP |
| CLI-04 | Verify my identity (document + liveness) | works | Didit connector + fake |
| CLI-05 | Answer a request for more information / resubmit a document | works | client tasks, uploads |
| CLI-06 | Sign my agreement electronically | works | Documenso connector + fake |
| CLI-07 | Track my application and get notified | works | `/me/cases`, notifications |
| CLI-08 | Business onboarding: invite directors/UBOs who verify themselves | works | related parties, KYB |
| CLI-09 | Invite a co-applicant or guarantor | works | related parties |
| CLI-10 | Give consent and exercise data rights (export, erasure) | works | consent records, data requests |
| CLI-11 | See only my own data | works | ownership checks |
| UPL-01 | Upload a requested document; the team downloads it through a short-lived link | works | upload intents, signed URLs, intake workflow |
| UPL-02 | Malware is refused and the rejection audited | works | scanner port (EICAR fake) |
| UPL-03 | Wrong types and sizes are refused (declared, and sniffed from the bytes) | works | upload policy, `file-type` |
| UPL-04 | Files are sanitised before use (PDF rebuilt without scripts; outages keep files out) | works | sanitiser port (CDR fake) |

Acceptance for the client flows is spelled out in the scenario tests below and in `apps/e2e/tests/clients`.

## Client apps (APP)

What an institution's clients see and do in the institution's own app, built in the studio (docs/plans/11,
[0007](../changes/0007-client-apps.md)).

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| APP-01 | Build the client app in the studio: template, pages of widgets, live preview (computer, phone) | works | client app definition, widget catalogue, preview frame |
| APP-02 | Publish, version and roll back the app; broken apps are not published | works | validation (references, data sources, JSONata syntax) |
| APP-03 | Clients read their own data, only what the app declares | works | `/me/app/data` allow-list, client records |
| APP-04 | Run a journey: screens, checks, branching, records and messages (move money, freeze a card) | works | `client.screen`, `client.record`, `client.notify` |
| APP-05 | Onboarding from the app: details, identity document, the team's check, account and card created | works | journeys with reviews, uploads, `client.profile` |
| APP-06 | Sign up on the app with profile fields and consents; welcome workflow | works | registration settings, `client.registered` |
| APP-07 | The institution's systems register clients, open their sessions and push their data | works | `POST /client-sessions`, records API, API clients |
| APP-08 | Sign in with the institution's identity provider (token exchange) | works | JWKS verification, identity mapping |
| APP-09 | Embed the app in the institution's site or mobile app | works | `@fintivio/client-sdk`, `/embed/app`, frame-ancestors |
| APP-10 | Who may build, publish and preview the app | works | `experience:*`, audited preview as a client |
| APP-11 | See and navigate everything built on one map: layout, pages, journeys with their screens and what happens in between, workflows, functions, forms, events; follow links, personas, layers, open each editor and come back | works | `GET /experience-map`, React Flow canvas, client-app runtime frames ([0009](../changes/0009-experience-map.md)) |
| APP-12 | UI building blocks: journeys that open as a dialog, a sheet or full screen (floating button, quick action, deep link); a QR / barcode scanner that reads payment codes; screens that continue by themselves after a countdown; signatures, one-time codes, sliders, calculated and conditional fields, format rules; branding (presets, accent, fonts, button shapes, light/dark, colours from the logo, readability) and region | works | `client.screen` field types and `autoSubmit`, journey `presentation`, `fab` / `qr-code` widgets, theme and region ([0011](../changes/0011-ui-building-blocks.md)) |

## Automation building blocks (AUT)

What workflows use to reach other systems and each other, beyond dedicated connectors (docs/plans/12,
[0008](../changes/0008-dealer-finance.md)).

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| AUT-01 | Business stages: a workflow declares its stages, `case.update` moves the case; the case page, the pipeline board and clients show them | works | `stages`, `case.update.stage`, `/cases/pipelines` |
| AUT-02 | Functions: a published workflow marked `function: true` is a step of other workflows (inputs → outputs); start a workflow without waiting | works | `function:<workflow id>`, `outputs`, `workflow.call wait: false` |
| AUT-03 | Signals: a case waits for another system (title service, bank, DMS) to call it back on its signed hook URL or the API; early signals kept; deadline | works | `webhook.wait`, `case_signals`, `POST /cases/:id/signals/:name`, `/hooks/cases/...` |
| AUT-04 | Any REST API with the HTTP connector (credentials kept in the connector), and that system's webhooks start workflows | works | `connector:http/request`, `connector:http/webhook.<key>` |
| AUT-05 | AI reads documents into fields (or says what is missing) and writes summaries for reviewers | works | `connector:ai/document.extract`, `text.generate`, OpenAI-compatible API |
| AUT-06 | Loan servicing in LoanPro: boarding, payments from the app, servicing events (payment, delinquency, payoff) start workflows | works | `connector:loanpro/*`, signed LoanPro webhooks, client records |
| AUT-07 | Workflows create clients (a borrower from a deal), invite them and serve their app | works | `client.upsert`, `client` target on client steps |

## Cross-cutting (X)

| Id | Flow | Status | Tech |
| --- | --- | --- | --- |
| X-01 | Tenant isolation through the API | works | RLS, tenant-pinned tokens |
| X-02 | Authorization matrix: every system role × representative operation | works | authorization model |
| X-03 | Session security (logout revocation, lockout, short-lived tokens, refresh, reset) | works | sessions |
| X-04 | Append-only, complete audit trail | works | audit events |
| X-05 | Durable workflow identity (no tokens in the journal, survives initiator changes) | works | execution principal |
| X-06 | The Restate ingress is not a way around authorization | works | `ingressPrivate` handlers, guarded public handlers |
| X-07 | Signed outbound webhooks | works | Standard Webhooks |
| WH-01 | Webhook retries, delivery log, resend, secret rotation, disabling on 410 | works | Restate dispatcher, outbox, webhook-receiver fake |
| WH-02 | The bank's system starts a workflow with an event and hears back by webhook | works | API clients, `startOn: api:*`, `case.decided` |

## Banking scenarios (SCN)

End-to-end stories combining the flows above, run against local fakes (from LOCAL-DEV-NOTES "realistic banking
scenarios"). Workflow definitions live in `apps/e2e/fixtures/workflows` and use the target component names.

| Id | Scenario | Flows involved |
| --- | --- | --- |
| SCN-01 | Retail account opening, identity verified, agreement signed, approved automatically | CLI-03/04/06/07, DES-01/02/03, INT-02 |
| SCN-02 | Identity verification declined: case rejected, client told | CLI-04/07 |
| SCN-03 | Identity verification inconclusive: manual review by a reviewer, approved | REV-01/02, CLI-04 |
| SCN-04 | Loan origination: credit score from the institution's database; large loans need four-eyes | INT-03, SUP-01, REV-02 |
| SCN-05 | AML screening hit: compliance adjudicates a false positive (approved) and a true positive (rejected) | CMP-01 |
| SCN-06 | Document resubmission: reviewer asks for a new proof of address, client uploads it, approved | REV-03, CLI-05 |
| SCN-07 | Timeouts: client abandons (reminder, then expiry); reviewer SLA breach escalates | DES-04, SUP-02 |
| SCN-08 | Audit trail of a complete case, exported by compliance | CMP-02, X-04 |
| SCN-09 | Business onboarding with two UBOs who verify themselves | CLI-08, CMP-01 |
| SCN-10 | Loan pre-approval from a form embedded on the bank's website: automatic pre-approval of small affordable loans, reviewer approval of mid-size loans, four-eyes above 50,000, automatic decline when unaffordable; applicants follow in the portal (UI) | DES-01/02/03/05, CLI-03/07, REV-01/02, SUP-01 |
| SCN-11 | Suspicious activity: an RM flags a client → L1 triage (false positive / escalate) → investigation with a request to the client → MLRO decision (SAR / exit / no action), without tipping off the client (UI) | RM-03, REV-02/03, CMP-04, CLI-05, AUD-01 |
| SCN-12 | Dealer finance (indirect auto lending): a dealer applies and submits deals with stipulations; AI reads them, the numbers and flags are computed, the deal is logged (Google Sheets); underwriting asks the dealer for more as often as needed, then decides; buyer and dealer sign (Documenso); the funding package is audited; the dealer is paid (QuickBooks, through a function of HTTP steps); the loan is boarded in LoanPro; the buyer becomes a client, pays from their app; LoanPro servicing events reach them; the title arrives by signal (API and UI) | AUT-01…07, APP-01/04, REV-02/03, SUP-01, CLI-05/06 |
