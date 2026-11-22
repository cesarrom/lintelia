# 06 — Co-applicants, guarantors, UBOs: parties and fan-out components

Agreed direction: related parties are a **workflow pattern**, not a hard-coded feature. A workflow collects the list
of people, then for each one sends them a form (and e.g. an identity verification) and routes work to the bank's
staff. What is missing are the components and a small data model.

## Prior art

BPMN **multi-instance activities** (parallel/sequential, completion condition) and **call activities** (Camunda),
Pega **child cases** and "wait for child cases", Fenergo/nCino **related parties** with per-party KYC requirements,
Temporal/Restate **fan-out/fan-in** of child workflows.

## Data model

- `case_parties` (tenant, RLS): `id`, `case_id`, `person_id` (a client user, created/matched by e-mail when invited),
  `role` (`applicant`, `co_applicant`, `guarantor`, `director`, `ubo`, `signatory`, or tenant-defined), `status`
  (`invited`, `in_progress`, `completed`, `declined`, `removed`), `data` (what they submitted), `share` (e.g. ownership %
  for UBOs), `invited_by`, timestamps. The applicant is a party too (the existing `applicant_*` columns become a
  convenience view over the applicant party).
- `cases.parent_case_id` + `parent_step_id` for **child cases** (one per party when a sub-workflow runs per party).
- **Access** (relationship-based): a client sees a case when they are its applicant **or one of its parties**; as a
  party they see only their own tasks, their own submitted data and the case status the workflow exposes to parties
  (`partyVisibility: status_only | own_part`), never other parties' data (the e2e contract CLI-09 already asserts this:
  no other party's e-mail, no `answers`). Enforced in `ClientTasksService`; later a candidate for OpenFGA (authorization.md).
- **Party invitations**: single-use, party-bound links (Redis one-time secrets, like staff invitations) landing in the
  portal; sign-in with the e-mailed code creates the client if needed.

## New components

| Component | Kind | What it does |
| --- | --- | --- |
| `form.request` | client | sends a published form to a **person** (a party, the applicant or an e-mail expression), creates a form instance + client task with a link, reminders/expiry; output = the validated answers (and uploaded file ids, 07). Replaces the legacy `form` and `wizard` nodes |
| `parties.add` | automatic | creates or matches parties from a list expression (`= input.coApplicants`), with role and data; output = party ids |
| `parties.update` | automatic | sets party status/data (e.g. after their verification) |
| `foreach` | container | multi-instance over a list expression: `mode: parallel | sequential`, `maxConcurrency`, `completion: all | any | count(n) | expression`, `onItemFailure: fail | continue`. Body = **one `workflow.call`** (child case per item) in v1; inline bodies of automatic steps in v2. Output = array of body outputs with item keys |
| `workflow.call` | automatic (waits) | starts a published workflow as a **child case** with mapped inputs (e.g. the party), waits for its end; output = child outcome, status and selected results. Usable on its own (reusable sub-processes) |
| `task` | human | a generic work task (not a decision): title, instructions, checklist, attachments, `assignTo` strategy: `role` (queue), `sameAssigneeAs: <stepId>` (sticky: one rep handles all items of a foreach), `member: = expression`, `caseOwner`; outcomes default `done`; SLA/escalation like reviews. For "send a task to a rep by role, or all of them to one rep" |
| `data.map` | automatic | JSONata transformation into named outputs (clearer name for what `calculate` does; `calculate` stays as an alias) |
| `wait.until` | timer | waits for a date expression or an event (`party.completed`, connector events), with timeout |
| `case.notify` | automatic | e-mails/portal notification to parties or members by role, with templates |

Engine notes (Restate): `foreach` starts child cases through the same signed engine client and waits on one durable
promise per child (children signal the parent on completion); the completion condition is evaluated as children finish,
and remaining children are cancelled when `any/count` is satisfied. Child cases have their own tasks, timeline and
audit and appear under the parent on the case page ("Parties" tab). Restate journals only ids.

## Example: loan with co-applicants and guarantors

```yaml
name: Personal loan with co-applicants
inputs:
  - { id: parties, name: parties, type: array }        # [{ name, email, role: co_applicant|guarantor }] from the form's repeatable section
steps:
  - id: add_parties
    type: parties.add
    config: { from: "= input.parties", role: "= role", match: email }
    events: [{ name: done, next: [each_party] }]
  - id: each_party
    type: foreach
    config:
      items: "= steps.add_parties.parties"
      mode: parallel
      completion: all
      body:
        type: workflow.call
        config: { workflow: party-onboarding, inputs: { partyId: "= item.id", role: "= item.role" } }
    events: [{ name: completed, next: [credit_review] }, { name: failed, next: [decline] }]
  - id: credit_review
    type: review
    config: { assignTo: { role: reviewer }, title: "Credit review with {{$count(steps.each_party.items)}} parties" }
    ...
```

`party-onboarding` (a published workflow of its own):

```yaml
steps:
  - { id: details, type: form.request, config: { form: co-applicant-details, to: "= input.partyId" } }
  - { id: kyc, type: didit.kyc.verify, config: { connection: didit-prod, person: "= input.partyId" } }   # connector client step (05)
  - id: branch
    type: conditional
    config: { expression: "steps.kyc.status = 'approved'" }
    events: [{ name: "true", next: [done] }, { name: "false", next: [manual] }]
  - { id: manual, type: task, config: { title: "Check {{input.role}} identity", assignTo: { role: reviewer }, sameAssigneeAs: parent } }
  - { id: done, type: parties.update, config: { party: "= input.partyId", status: completed } }
```

KYB with UBOs (SCN-09) is the same shape with `role: ubo` and the list coming from the business registry connector or
the applicant's form; CMP-01 screening runs per party inside the sub-workflow.

## UI

- Form builder: **repeatable sections** ("add another co-applicant") producing arrays — needed by the example.
- Editor: `foreach` as a container node (React Flow group) showing the body; `workflow.call` shows the called
  workflow and version with a link.
- Back office case page: Parties tab (status per party, their child case, their tasks); task inbox groups tasks by
  parent case.
- Portal: "You were added as co-applicant to Ada's application" with only the party's own steps.

## e2e

- CLI-09 (exists, contract adjusted to the component design): the applicant lists a co-applicant and a guarantor; each
  receives their own link, fills their form and verifies their identity (fake Didit); neither sees the other's data; the
  case continues when both finish; a guarantor who declines sends the case to manual review.
- New **PTY-01 One rep handles every party**: `task` with `sameAssigneeAs` routes all party checks to whoever claimed the first.
- SCN-09 (exists): two UBOs verify themselves; the review starts only after both.

## Gaps

- Person matching across cases (same e-mail = same client) is fine for individuals; organisations need a
  `client_organisations` model (KYB) with members — the ReBAC case for OpenFGA noted in authorization.md.
- Consent per party (each party accepts the privacy notice themselves; recorded on their party record).
