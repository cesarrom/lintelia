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
startOn: []                   # platform events that start it, e.g. [client.flagged], [connector:loanpro/payment.posted]
clientVisibility: full        # or requests_only: the client never sees the case, only neutral requests (investigations)
stages:                       # business stages (case page, pipeline board, client journeys); case.update moves the case
  - { key: underwriting, label: Underwriting }
  - { key: declined, label: Declined, exit: true }   # off the main path: shown only when the case takes it
function: false               # true: other workflows use it as a step (function:<workflow id>)
outputs:                      # what the case gives back to its caller when it ends (JSONata)
  maxAmount: "= steps.estimate.maxAmount"
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
| Flow | `start`, `end`, `conditional`, `wait`, `foreach` (a sub-workflow per item, child cases), `workflow.call` (one child case; `wait: false` starts it and carries on), `webhook.wait` (wait for a signal from another system, with a deadline) |
| Data | `calculate`, `data.map` |
| People | `review` (decisions with authority, SLA, escalation, four-eyes), `task` (work items; `sameAssigneeAs: siblings`), `parties.wait`, `parties.update` |
| Client | `client.request` (text and `file` items; files go through the upload intake), `form.request` (one of the institution's forms, to the applicant or a party), `parties.collect` |
| Client app | `client.screen` (a screen of a journey: fields, text, buttons — each button an event; answers become `input.<key>`), `client.data` (read the client's records), `client.record` (write one: upsert or merge), `client.profile` (attributes, segments), `client.notify` (a notification in the app, optionally by e-mail), `client.upsert` (create or find a client by e-mail / external id, segments, attributes, invitation) — docs/plans/11, 12. `client.data/record/profile/notify` act on the applicant, or on another client given in `client` (e.g. the borrower a dealer's deal created) |
| Case | `case.update` (stage, data saved on the case, risk, flags, title), `case.decision` (final status + outcome, applicant notification unless `notifyApplicant: false` or the case is `requests_only`) |
| Functions | `function:<workflow id>`: a published workflow with `function: true`, its inputs as the step's fields, its `outputs` as the step's result (events `completed` / `failed`); listed under "Your functions" in the palette |
| Communication | `email` (platform mailer) |
| Connectors | `connector:<id>/<key>` from the institution's active connections, e.g. `connector:didit/kyc.verify`, `connector:documenso/signature.request`, `connector:postgres-datasource/query.run`, `connector:smtp-mailer/email.send`, `connector:screening/screening.check`, `connector:http/request`, `connector:ai/document.extract`, `connector:loanpro/loan.board` ([integrations.md](integrations.md)) |

Publishing refuses unknown step types, invalid configurations, events a component never emits, unknown roles,
connector steps whose connection is missing or not set up, moves to stages the workflow does not declare, and function
steps whose target is not a published function (or is the workflow itself). Branches may use a component's short
outcome names (`approve` / `reject` for a review's `review_approved` / `review_rejected`).

Variables: `input.*` (the case data), `steps.<id>.*` (results), `case.id`, `case.reference`, `case.title`,
`case.applicant.{id,email,name}`, `case.hooks.<name>` (the signed URL of each `webhook.wait` signal, to give to the
system that will call back).

### Signals (`webhook.wait`)

A case waits for another system by name (`title_received`): that system calls the case's **hook URL**
(`POST /hooks/cases/:caseId/:name?tenant=…&token=…`, an HMAC of tenant, case and name: no account needed, nothing else
reachable with it) or the institution's systems call **the API** (`POST /cases/:id/signals/:name`, `cases:signal`).
The JSON body becomes the step's result (`steps.<id>.*`, with `signal.source`). A signal arriving before the step
waits is kept (`pending`) and delivered when it does; a deadline (`timeout`) takes the `timeout` branch. Waits and
signals are `case_signals` rows (per-case advisory lock: never lost, never delivered twice), listed on the case page
(`GET /cases/:id/signals`) where members with `cases:signal` can record one by hand. Audited:
`case.waiting_for_signal`, `case.signal_received`, `case.signal_timed_out`.

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
- **Decisions** (`POST /tasks/:id/decision { outcome|decision, reason, items? }`), enforced by `TasksService`:
  - segregation of duties: whoever started a case cannot decide its tasks;
  - authority: `high` tasks need `cases:approve_high_risk`;
  - four-eyes: outcomes marked `needsSecondApproval` (default `approve`) of `high` tasks need a second, different
    approver; the first one is recorded (`pending_second_approval`);
  - outcomes with `requiresReason` are refused without a reason;
  - `request_info` creates a client task (neutral title, the reviewer's question; `items` ask for uploads instead of a
    written answer), parks the review in `pending_client` and e-mails the client; the answer sends the review back to
    the reviewer with the response. It can be repeated as often as needed (stipulations in dealer finance).
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

## Client app journeys

A client app (docs/plans/11, [0007](../changes/0007-client-apps.md)) declares **journeys**: a workflow, a title,
**eligibility** (JSONata over the client's profile, checked by the API), **inputs** a button may pass (anything else
is dropped) and the **stages** the client sees. `POST /me/app/journeys/:key/start` starts the workflow's active
version with the client as applicant and `source: client:<key>`; the answer waits briefly for the first screen, so
the client goes straight to it. `client.screen` steps create a client task of kind `screen` carrying the resolved
screen (options from the client's records, prefilled values, the stage); `POST /me/app/cases/:id/screens/:task
{ event, values }` validates every field (422 with `errors: [{ field, message }]`), verifies uploaded files and
signals the workflow with the button as the event. `GET /me/app/cases/:id/journey` tells where the journey stands:
`screen`, `request` (a `client.request` or connector action), `waiting` (the team's review), `working` or `done`
(with the journey's last `client.notify` message). Journey cases are ordinary cases in the back office.

Screen fields (docs/plans/14): `text`, `email`, `phone`, `number`, `money`, `date`, `select`, `choice`, `checkbox`,
`textarea`, `file` (with `capture` for the phone's camera), `scan` (QR / barcodes; with `parse: emv | epc | url | json |
auto` the API reads the code again and adds `input.<key>Details` — payee, amount, currency, account, reference…;
invalid codes are refused), `signature` (a PNG through the upload intake), `otp` (`length`), `slider` (`min`, `max`,
`step`), `display` (a calculated value, JSONata over the answers, never kept). Any field may be shown on a condition
(`visibleIf`, JSONata over the answers: hidden fields are neither required nor kept — the API evaluates it too),
carry format rules (`pattern` + `patternMessage`, `check: iban | luhn | email`) and sit half-width (`width: half`).
`autoSubmit: { button, when: complete | expression, expression, delay }` makes the app press a button by itself once
the screen is valid (and the rule holds), after a countdown the client can stop.

Templates may format values: `{{ steps.offer.monthly | money }}` (`money`, `number`, `date`, `upper`).

## Events

`EventsService.emit(event, payload)` starts every active workflow version whose `startOn` lists the event.
`client.registered` (a new client: self sign-up on the app, `POST /client-sessions`, token exchange) starts
onboarding or welcome workflows. `client.flagged` (`POST /clients/:id/flags { category, reason }`, `clients:update`), used by the
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
| GET | `/cases?status=&search=&workflowId=` | `cases:read` (scope) | cases visible to the caller (with their `stage`) |
| GET | `/cases/pipelines` | `cases:read` | published workflows with stages (the pipeline board), busiest first |
| GET | `/cases/:id` | `cases:read` (scope) | case with stage and the workflow's stages, data, calculations, tasks, decisions, consents, records, files |
| GET | `/cases/:id/signals` | `cases:read` (scope) | what the case waits for from other systems, and what arrived; the hook URL of waiting signals for holders of `cases:signal` |
| POST | `/cases/:id/signals/:name` | `cases:signal` | `202 { delivered, queued }`; `409` when the case is finished; body ≤ 64 kB |
| POST | `/hooks/cases/:id/:name?tenant=&token=` | anyone with the signed URL | `202`; `403` for a wrong token |
| GET | `/cases/:id/timeline` | `cases:read` (scope) | audit entries of the case, in order |
| GET | `/cases/:id/export` | `cases:read` + `cases:export` | evidence pack (audited) |
| POST | `/cases/:id/resend-link` | `clients:update` (scope) | `202`, e-mails the applicant the link again |
| GET | `/tasks?view=mine\|queue\|all` | `tasks:work` (`all`: `tasks:assign`) | tasks assigned to me / in my queues / all open |
| GET | `/tasks/:id` | `cases:read` (visibility) | task with case data, calculations and the case's files |
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
| GET | `/client-apps/current` | `experience:read` | draft (a blank one on first visit), versions, problems, workflows |
| PUT | `/client-apps/current/draft` | `experience:manage` | save the draft `{ definition }` |
| POST | `/client-apps/current/validate`, `/publish`, `/activate { version }` | `experience:read` / `experience:publish` | `{ errors }`; publish (422 with errors); roll back |
| GET | `/client-apps/templates`; POST `/client-apps/current/template { template, connections?, parameters? }` | `experience:read` / `experience:manage` (+ `workflows:manage`; `workflows:publish` for templates with functions) | templates (with the connections and settings they need); load one into the draft (creates its workflows) |
| POST | `/client-apps/current/preview { clientId, sources }` | `experience:read` + `clients:read` | a real client's data as the app would read it (audited) |
| GET | `/experience-map` | `experience:read` or `workflows:read` | the app's draft, each workflow's map view (touchpoints, flow, calls, triggers…), forms, connections (docs/plans/13) |
| GET | `/me/app`; POST `/me/app/data { sources }` | client | the published app; data of declared sources only |
| POST | `/me/app/journeys/:key/start`, `/me/app/cases/:id/screens/:task`; GET `/me/app/cases/:id/journey` | client | journeys |
| PATCH | `/me/app/profile`; POST `/me/app/consents`, `/me/app/notifications/read` | client | editable profile fields, consents, notifications |
| POST | `/client-sessions` | `clients:provision` | `201 { clientId, created, clientSecret, expiresAt }` |
| POST | `/auth/client/session { clientSecret }`, `/auth/client/token { subjectToken }` | anyone (tenant) | client session |
| GET/PATCH | `/clients/:client/profile` | `clients:read` or `clients:provision` / `clients:provision` | `:client` is an id or `ext:<externalId>` |
| GET/PUT/DELETE | `/clients/:client/records[/:collection[/:key]]` | `clients:read` or `clients:records` / `clients:records` | records shown in the app (`{ data, merge }`, bulk `{ records, replace }`) |

Not built yet (contract in the e2e suite): related parties (`/me/cases/:id/parties`), `GET /executions/:id`,
document uploads in client requests, connectors (Didit, Documenso, databases, screening) as workflow steps.

## Audit log

`audit_events` is append-only for the application role (INSERT/SELECT grants only, forced RLS). Each entry: sequence
number per tenant, time, actor (member/client/staff/workflow/public), action (`member.invited`, `role.created`,
`case.created`, `task.decided`, `task.first_approval`, `client.flagged`, `data_request.completed`, …), target, case,
details, and the hash of the previous entry (tamper evidence). Case timelines are the entries of a case.
