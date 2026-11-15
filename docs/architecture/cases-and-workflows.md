# Cases, tasks and workflows

Status: **implemented (case engine)**, with the legacy node engine still present. The case engine
(`apps/core/src/engine`) runs published workflow versions durably on Restate (`caseRun`), creates human tasks routed
to roles, requests to clients, and records every step in the audit trail. The legacy node engine
(`services/restate/workflow.ts`: forms, decision tables, e-mail, proof of life… driven by log-pattern triggers) still
exists for the old nodes; new business flows use the case engine.

## Vocabulary (aligned with BPM/case-management products: Camunda, Pega, Fenergo)

| Term | Meaning |
| --- | --- |
| **Workflow** | a flow definition (YAML). The draft (`sys_workflows.yaml`) is edited freely; publishing freezes it as the next immutable version (`workflow_versions`) |
| **Template** | a ready-made workflow (loan pre-approval, suspicious-activity investigation, account opening) an institution copies as a draft and adapts |
| **Case** | the business object an execution works on: an application or an investigation, with its applicant/subject, data, calculations, tasks, decisions, risk, flags and status. One durable execution per case (execution id = case id) |
| **Task** | a human step: a review routed to members (`audience: member`), or a request to the client (`audience: client`: information, confirmation) |
| **Trigger** | what starts a case: published form submission, API/manual start (`POST /workflows/:id/executions`), assisted application (`POST /cases`), platform event (`startOn: [client.flagged]`) |

## Workflow definition (YAML)

Same shape the workflow editor produces (`steps[].events[].next`), plus case-engine fields:

```yaml
name: Personal loan pre-approval
caseTitle: "Loan pre-approval: {{input.fullName}} ({{input.amount}})"
startOn: []                   # platform events that start it, e.g. [client.flagged]
clientVisibility: full        # or requests_only: the client never sees the case, only neutral requests (investigations)
inputs:
  - { id: amount, name: amount, label: Loan amount, type: number, required: true }
steps:
  - id: estimate
    type: calculate
    config:
      outputs:
        maxAmount: "$round($number(input.annualIncome) * 0.8)"       # JSONata
  - id: credit_review
    type: review
    config:
      title: "Credit review: {{input.fullName}} requests {{input.amount}}"
      assignTo: { role: "= $number(input.amount) > 50000 ? 'senior_reviewer' : 'reviewer'" }
      authority: "= $number(input.amount) > 50000 ? 'high' : 'standard'"
      sla: PT24H
      escalateTo: { role: senior_reviewer }
      outcomes: [...]          # optional custom outcomes; default approve / reject / request_info
```

Expressions: `{{path}}` interpolates (`input.*`, `steps.<id>.*`, `case.*`); a string starting with `=` is a JSONata
expression. Step types come from the **component catalogue** (`GET /workflow-components`; definitions in
`apps/core/src/engine/components`), shared by the editor (palette, generated configuration forms, event handles), the
publish validation and the engine:

| Group | Components |
| --- | --- |
| Flow | `start`, `end`, `conditional`, `wait`, `foreach` (a sub-workflow per item, child cases), `workflow.call` (one child case) |
| Data | `calculate`, `data.map` |
| People | `review` (decisions with authority, SLA, escalation, four-eyes), `task` (work items; `sameAssigneeAs: siblings`), `parties.wait`, `parties.update` |
| Client | `client.request` (text and `file` items; files go through the upload intake), `form.request` (one of the institution's forms, to the applicant or a party), `parties.collect` |
| Case | `case.update` (risk, flags, title), `case.decision` (final status + outcome, applicant notification unless `notifyApplicant: false` or the case is `requests_only`) |
| Communication | `email` (platform mailer) |
| Connectors | `connector:<id>/<key>` from the institution's active connections, e.g. `connector:didit/kyc.verify`, `connector:documenso/signature.request`, `connector:postgres-datasource/query.run`, `connector:smtp-mailer/email.send`, `connector:screening/screening.check` ([integrations.md](integrations.md)) |

Publishing refuses unknown step types, invalid configurations, events a component never emits, unknown roles and
connector steps whose connection is missing or not set up.

## Lifecycle rules

- **Versioning**: `POST /workflows` creates a draft (`status: draft, version: 1`); `POST /workflows/:id/publish`
  validates it (known step types, existing next steps, one start, roles that exist) and freezes it as the next
  version, or answers `422 { errors }`. Running cases keep their version; new cases use the active version.
- **Starting**: always through the API, which authorises the caller, creates the case and calls the engine with an
  HMAC-signed request (`x-fintivio-signature`, no user token — nothing sensitive in the Restate journal). Browsers never
  call the Restate ingress; `caseRun` refuses unsigned calls.
- **Routing and queues**: `assignTo.role` puts the task in that role's queue (claimable by members holding the role).
  High-authority tasks are also open to every member with `cases:approve_high_risk`. Second approvals (four-eyes) are
  offered to every holder of `cases:approve_high_risk` except the first approver. `tasks:assign` holders see all open
  tasks (`view=all`) and reassign.
- **Decisions** (`POST /tasks/:id/decision { outcome|decision, reason }`), enforced by `TasksService`:
  - segregation of duties: whoever started a case cannot decide its tasks;
  - authority: `high` tasks need `cases:approve_high_risk`;
  - four-eyes: outcomes marked `needsSecondApproval` (default `approve`) of `high` tasks need a second, different
    approver; the first one is recorded (`pending_second_approval`);
  - outcomes with `requiresReason` are refused without a reason;
  - `request_info` creates a client task (neutral title, the reviewer's question), parks the review in
    `pending_client` and e-mails the client; the answer sends the review back to the reviewer with the response.
- **SLAs**: a review with `sla` + `escalateTo` escalates when the SLA passes (re-queued to the escalation role,
  audited); client requests can remind and expire (`remindAfter`, `expiresAfter`).
- **Case statuses**: `draft` (public form submitted, e-mail not confirmed), `pending_client` (waiting for the client:
  confirmation of an assisted application or requested information), `submitted`, `in_progress`, `in_review`,
  `approved`, `rejected`, `closed`, `expired`, `withdrawn`, `failed`. `outcome` carries the business result
  (`pre_approved`, `sar_filed`, `false_positive`, …); `riskLevel` and `flags` are set by `case.update`/`case.decision`.

## Who sees a case

| Caller | Scope |
| --- | --- |
| `cases:read_all` (compliance, senior reviewers, auditors, admins) | every case |
| `cases:lookup` (support agents) | any client-facing application (`clientVisibility: full` with an applicant), never investigations |
| `cases:read` | cases they started — except those opened by an event they raised (a relationship manager who flags a client does not follow the investigation: need-to-know) — and cases with a task assigned to them, decided by them or queued for one of their roles |
| client | own applications (`clientVisibility: full`): status, workflow step names, their answers and consents, requests addressed to them. `requests_only` cases (investigations) are invisible: the client only sees neutral requests in `/me/requests`, with no case reference, and gets no decision e-mail (no tipping-off) |

Task titles, notes, assignees and decisions are never shown to clients.

## Public (embedded) forms

- `POST /forms/:id/publish { workflowId, allowedOrigins }` (the workflow must be published) returns a public key and
  embed snippets: a script tag (`/embed.js` mounts an iframe of the hosted form and sizes it) and a plain iframe.
- The hosted form (`/embed/forms/:publicKey`) is served with `Content-Security-Policy: frame-ancestors 'self'
  <allowedOrigins>` (Vite plugin locally, the web server/CDN in production), so other sites cannot frame it. It
  reports the embedding site to the API (`X-Embed-Origin`, from `location.ancestorOrigins`/referrer); the API also
  checks a caller's `Origin`. Other pages of the app are only frameable by the app itself.
- `POST /public/forms/:key/submissions { email, answers }` (rate limited per form and client address) creates or
  matches the client by e-mail, opens a `draft` case and e-mails a one-time code. Confirming the code
  (`POST /public/forms/:key/verify`, or signing in with the code in the portal) submits the draft and starts the
  workflow. `answers.consent.privacyNotice` is recorded in `cases.consents`.

## Assisted applications

`POST /cases { workflowId, client: { email, name }, inputs }` (`cases:create`): the case waits in `pending_client`
with a confirmation task; the client gets an e-mail link (`/portal/cases/:id?case=:id`), signs in with a code,
reviews the prepared data and confirms with consent (`POST /me/cases/:id/confirm { consent: true }`); the consent is
recorded and the workflow starts. Without a client, `POST /cases` starts the workflow at once.

## Events

`EventsService.emit(event, payload)` starts every active workflow version whose `startOn` lists the event.
Today: `client.flagged` (`POST /clients/:id/flags { category, reason }`, `clients:update`), used by the
suspicious-activity template: L1 triage (reviewer: false positive / escalate) → investigation (senior reviewer: ask
the client for documents / close / refer to the MLRO) → MLRO decision (compliance, high authority: file a SAR / exit
the relationship / no action).

## Data-rights requests

Clients file `export` or `erasure` requests (`/me/data-requests`); compliance (`data_requests:manage`) completes them
(`/data-requests/:id/complete`). An export gathers the client's profile, applications, answers, consents and
requests (never investigations) for download in the portal. An erasure anonymises the profile and closes the
account, unless records must be kept (an open application or any investigation), in which case it is declined with a
neutral explanation.

## API

| Method | Path | Who | Result |
| --- | --- | --- | --- |
| GET | `/workflow-templates` | `workflows:read` | ready-made workflows |
| POST | `/workflow-templates/:id/use` | `workflows:manage` | `201` draft workflow from the template |
| POST | `/workflows` | `workflows:manage` | `201 { id, status: 'draft', version }` |
| GET | `/workflows` | `workflows:read` | drafts with `activeVersion`, `startOn` |
| GET | `/workflows/:id/validation` | `workflows:read` | `{ errors }` of the draft |
| POST | `/workflows/:id/publish` | `workflows:publish` | `200 { id, version, status: 'active' }` or `422 { errors }` |
| GET | `/workflows/:id/versions` | `workflows:read` | versions with status (and the pending draft) |
| GET | `/workflows/startable` | `cases:create` | published workflows that can be started by hand, with their inputs |
| POST | `/workflows/:id/executions` | `cases:create` | `202 { caseId, executionId, reference }`; `409` without a published version. An `email` input identifies the applicant |
| POST | `/cases` | `cases:create` | assisted application `{ workflowId, client, inputs }` → `201` case in `pending_client` |
| GET | `/cases?status=&search=&workflowId=` | `cases:read` (scope) | cases visible to the caller |
| GET | `/cases/:id` | `cases:read` (scope) | case with data, calculations, tasks, decisions, consents |
| GET | `/cases/:id/timeline` | `cases:read` (scope) | audit entries of the case, in order |
| GET | `/cases/:id/export` | `cases:read` + `cases:export` | evidence pack (audited) |
| POST | `/cases/:id/resend-link` | `clients:update` (scope) | `202`, e-mails the applicant the link again |
| GET | `/tasks?view=mine\|queue\|all` | `tasks:work` (`all`: `tasks:assign`) | tasks assigned to me / in my queues / all open |
| GET | `/tasks/:id` | `cases:read` (visibility) | task with case data and calculations |
| POST | `/tasks/:id/claim` | `tasks:work` | assigned to the caller; `409` if taken |
| POST | `/tasks/:id/assign` | `tasks:assign` | `{ assigneeId }` |
| POST | `/tasks/:id/decision` | `tasks:work` (+ rules above) | `{ outcome, reason }` |
| GET | `/clients`, `/clients/:id` | `clients:read` | clients with their cases in scope |
| POST | `/clients/:id/flags` | `clients:update` | `201 { flagged, investigationsOpened }` (no case reference: need-to-know) |
| POST | `/forms/:id/publish`, `/forms/:id/unpublish`, GET `/forms/:id/publication` | `forms:publish` / `forms:read` | public key and embed snippets |
| GET | `/public/forms/:key`, `/public/forms/:key/embed-policy` | anyone (allowed origins) | what renders the form; frame ancestors |
| POST | `/public/forms/:key/submissions`, `/public/forms/:key/verify` | anyone (rate limited) | draft case + code; confirmation → client session |
| GET | `/me/cases`, `/me/cases/:id` | client | own applications |
| POST | `/me/cases/:id/confirm` | client | confirm an assisted application with consent |
| GET | `/me/requests`; POST `/me/requests/:id/respond`, `/me/cases/:id/requests/:taskId/respond` | client | requests addressed to me |
| POST/GET | `/me/data-requests`, GET `/me/data-requests/:id/export` | client | data-rights requests |
| GET | `/data-requests`; POST `/data-requests/:id/complete` | `data_requests:manage` | handle them |
| GET | `/audit`, `/audit/export` | `audit:read` / `audit:export` | append-only, hash-chained audit log |

Not built yet (contract in the e2e suite): related parties (`/me/cases/:id/parties`), `GET /executions/:id`,
document uploads in client requests, connectors (Didit, Documenso, databases, screening) as workflow steps.

## Audit log

`audit_events` is append-only for the application role (INSERT/SELECT grants only, forced RLS). Each entry: sequence
number per tenant, time, actor (member/client/staff/workflow/public), action (`member.invited`, `role.created`,
`case.created`, `task.decided`, `task.first_approval`, `client.flagged`, `data_request.completed`, …), target, case,
details, and the hash of the previous entry (tamper evidence). Case timelines are the entries of a case.
