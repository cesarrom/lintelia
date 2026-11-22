# Plan 12 — Dealer finance (indirect auto lending), and what the platform needs for it

Status: **v1 shipped** ([../changes/0008-dealer-finance.md](../changes/0008-dealer-finance.md)). This document is the
analysis behind it: the business process, how it maps onto the platform, the decisions taken for the missing
capabilities, and what is deliberately left for later.

## 1. The business

A lender buys retail installment contracts from car dealers. The dealer's F&I manager structures the deal with the
buyer at the dealership and sends it to one or more lenders; the lender decides, the contract is signed, the dealer is
paid ("funded"), and the lender services the loan for years. The dealer wants a decision in hours and money in a day;
the lender wants nothing funded that does not match what was approved.

| Who | Wants | In Lintelia |
| --- | --- | --- |
| Dealer (F&I manager) | send deals fast, know where each one is, answer what is asked, get funded | a **client** with the `dealer` segment, using the institution's **client app** (dealer portal) |
| Buyer → borrower | a car; then pay, see the balance, get help, get the title back | a **client** created by the deal (`client.upsert`), same app with the `borrower` segment |
| Underwriter (credit analyst) | everything checked before they look; ask for more as often as needed; decide | **reviewer** role: review task with the AI's reading, numbers and flags |
| Funding team | fund only complete, consistent packages; pay dealers; release liens | **senior reviewer** role: funding audit, dealer approvals, lien releases |
| Servicing / collections | payments, delinquency, hardship | LoanPro (system of record) + servicing workflows and tasks |
| Operations | titles with the lien, chased when late | title tracking workflow, signals |
| Institution's systems | the LMS (LoanPro), accounting (QuickBooks), a spreadsheet (the deal log everybody still keeps), e-signature, an AI model, the title service / DMV | connectors, the HTTP connector, functions, signals |

### The deal, stage by stage

```
submitted ─▶ documents ─▶ underwriting ─┬▶ contracting ─▶ funding ─▶ funded ─▶ boarded
(deal form)  (stips)      (automation,   │  (buyer +       (package,   (dealer   (LoanPro,
                           then people)  │   dealer sign)   audit)      paid)     borrower app)
                                         ├▶ conditions ─▶ contracting   (approved with conditions, dealer accepts)
                                         ├▶ request info ↺ (as often as needed, the deal stays in underwriting)
                                         └▶ declined (exit: dealer told why, logged)
after boarding:  payments · delinquency · hardship · payoff → lien release · title perfected (signal)
```

1. **Deal submission** — buyer, vehicle (year, make, model, VIN), structure (sale price, down payment, amount financed,
   term, APR), declared income; **stipulations** ("stips"): pay stub, signed buyer's order, driver's licence.
2. **Automation before people** — read the documents (employer, gross monthly income; VIN, price and amount on the
   buyer's order); compute payment, payment-to-income (PTI), loan-to-value (LTV), the gap between declared and
   documented income, VIN and amount matches; raise **flags**; write a summary for the analyst; **log** the deal in the
   spreadsheet.
3. **Underwriting** — approve; approve with conditions (the dealer accepts or withdraws); **ask the dealer** (a written
   answer or a document, any number of times — stips are iterative); decline (reason to the dealer).
4. **Contracting** — the buyer signs the retail installment contract (at the dealership, on the dealer's screen); the
   dealer signs the assignment of the contract to the lender.
5. **Funding** — the dealer uploads the funding package (title application showing the lender as lienholder, proof of
   insurance); the funding team audits it (documents on the task) and funds: the dealer is paid the amount financed
   minus the acquisition fee (QuickBooks: vendor, bill, bill payment); the log says *Funded*.
6. **Boarding** — the loan is created and activated in LoanPro; the buyer becomes a client (invited by e-mail) and sees
   the loan in the app (balance, next payment, payments).
7. **Servicing** — payments from the app (posted in LoanPro) and from LoanPro's other channels; LoanPro's events
   (payment posted, loan delinquent, paid off) start workflows: receipts, past-due reminders and collection calls,
   congratulations and the lien release. Hardship requests from the app go to the team.
8. **Title** — after funding, a separate workflow waits (45 days) for the title showing the lien; the title service (or
   the DMV's electronic lien and title system, or a person who received it by mail) signals it; late titles are
   chased by a person.

## 2. How it maps onto the platform

Everything is configuration on top of generic capabilities: **11 workflows** (2 of them functions), **one client app**,
**5 connections** — installed together as the *Dealer & borrower portal* template
(`apps/core/src/solutions/dealer-finance/*.yaml`, `index.ts`).

| Piece | Workflow (file) | Components it uses |
| --- | --- | --- |
| Dealer onboarding | *Dealer: become a partner* (`dealer-signup.yaml`) | `client.screen` (dealership, licence, W-9, agreement), `review` (senior reviewer; ask for more), `client.profile` (segment `dealer`, attributes), `client.notify` |
| The deal | *Dealer: deal* (`deal.yaml`) | `client.screen` ×2, `case.update` (stages, title, data), `connector:ai/document.extract` ×2, `calculate`, `connector:ai/text.generate`, `function:<log>`, `review` (underwriting; custom outcomes), `client.screen` (conditions), `connector:documenso/signature.request` ×2, `client.request` (funding package), `review` (funding audit), `function:<pay dealer>`, `task` (manual fallbacks), `client.upsert` (the borrower), `connector:loanpro/loan.board`, `client.notify` (to the borrower and to the dealer), `workflow.call` (`wait: false`), `case.decision` |
| Deal log | *Function: log a deal to the spreadsheet* (`log-deal.yaml`) | `connector:http/request` (Sheets `values:append`) |
| Dealer payment | *Function: pay the dealer in QuickBooks* (`pay-dealer.yaml`) | `connector:http/request` ×4 (query vendor, create vendor, bill, bill payment), `conditional`, `calculate` |
| Title | *Dealer: title tracking* (`title-tracking.yaml`) | `webhook.wait` (`title_received`, 45 days, then 30 after a chase), `task`, `case.update` |
| Servicing | *Servicing: payment received / missed payment / loan paid off* | `startOn: connector:loanpro/<event>`, `client.notify`, `task`, `client.profile` |
| Borrower journeys | *Borrower: make a payment / payoff quote / payment difficulty* | `client.data`, `client.screen`, `connector:loanpro/payment.create`, `loan.get`, `review` |
| The app | *Dealer & borrower portal* | one app, pages shown by segment (`visibleIf`): dealers get *Deals* (journey with the deal's stages, requests), borrowers *My loan* (`records:loans`, `records:payments` written by the LoanPro connector) |

## 3. What was missing, and the decisions

### 3.1 Business stages (AUT-01)

Case *status* is technical (in progress, in review, pending client…); the business follows **stages** (underwriting,
funding…). A workflow now declares `stages` (key, label, optional client label, `exit` for off-path ones such as
*declined*); `case.update { stage }` moves the case (audited `case.stage_changed`; publication refuses undeclared
literal stages). Shown on the case page (stage bar), in the case list, on a **pipeline board** (*Cases → Pipeline*: one
column per stage of a workflow, the busiest workflow first) and to clients (journey stages take the case's stage when
the journey declares it). `case.update { data }` saves values on the case (the loan id, the funded amount, the title
number) for people and later steps.

### 3.2 Functions: workflows as the institution's own connectors (AUT-02)

Question asked: *one generic HTTP component + webhooks, or many connectors?* Both, with a rule (§3.3) — and a way for
institutions to **package** a sequence of steps into a reusable block without writing a connector: a **function** is a
published workflow marked `function: true`. Other workflows use it as a step `function:<workflow id>`: its inputs become
the step's fields (labels, required), its `outputs` (JSONata evaluated when it ends) the step's result; events
`completed` / `failed`. It appears in the editor's palette under *Your functions*. Runs are child cases (visible,
audited, retried like any case).

Decisions:

- **A workflow, not a new artefact**: versioning, publication, validation, the editor, the engine's durability, audit
  — all reused. A function is called by id and runs its *active version*: fixing a function fixes every caller.
- **Published functions only, no recursion**: publication refuses calls to drafts, to non-functions and to itself.
- **Function or sub-workflow?** `workflow.call` stays for sub-processes that are part of *this* process (a party's
  verification); functions are reusable building blocks with a contract (inputs → outputs). `workflow.call` gained
  `wait: false` to start a process that lives on its own (the title tracking) and carry on.
- Considered and rejected for now: a "connector builder" (declarative HTTP connectors with their own manifest) — more
  power than institutions need today, and a second way to do what functions + the HTTP connector do.

### 3.3 The HTTP connector, and when to write a dedicated connector (AUT-04)

**Rule**: a dedicated connector when the system has *depth* — a state machine on the vendor side, client steps
(signing, identity verification), signed webhooks with their own semantics, a data model the app shows (LoanPro's
loans and payments), or secrets that need special handling. Everything else through the **HTTP connector**: one
*connection* per API (base address; none / API key header / bearer / basic / OAuth 2.0 client credentials; fixed
headers; a test path), credentials stored in the connector (never in workflows), `connector:http/request` with a path
*relative to the base address* (other hosts refused; https and public addresses only in production). Its **inbound
webhooks** (`POST /hooks/<connection>/<key>`, shared secret or HMAC signature, deduplicated) publish
`connector:http/webhook.<key>`, which starts workflows like any connector event.

In the solution, Google Sheets (the deal log) and QuickBooks (dealer payments) are HTTP connections used by functions:
the institution's own "connectors", made of HTTP steps.

### 3.4 Signals: other systems calling a case back (AUT-03)

Long waits on the outside world (the title, a bank transfer confirmation, a dealer management system) are **signals**
(message correlation): `webhook.wait { name, timeout }` pauses the case until a signal of that name arrives by

- the case's **hook URL** (`{{case.hooks.<name>}}`, `POST /hooks/cases/:id/:name?tenant&token`): an HMAC of tenant,
  case and name — no account, good for one case and one name only; the workflow gives it to the other system (an HTTP
  step, a message), and members with `cases:signal` can copy it from the case page; or
- **the API** (`POST /cases/:id/signals/:name`, permission `cases:signal`: integration managers, administrators, API
  clients), or by hand on the case page (*Signals → Record it*) when the news came by mail.

The body becomes the step's result. A signal that arrives *before* the case waits is kept; the deadline takes the
`timeout` branch (chase the title). Waits and signals are `case_signals` rows serialised by a per-case advisory lock
(never lost, never delivered twice); the Restate promise carries the payload to the step.

### 3.5 AI reading documents (AUT-05)

`connector:ai/document.extract` (any OpenAI-compatible API: OpenAI, Azure OpenAI, Mistral, a gateway, a hosted model):
fields to extract (name, description, type) → values + `missing`; events `extracted` / `incomplete` / `failed`; a
`document` record on the case. The connector reads the file through the connector API (`files:read`: only files of the
step's case or its parents, proven by the step's callback token, audited), extracts the PDF's text itself
(`pdf-text.ts`, no dependency) and, optionally, sends the file (scans). `text.generate` writes summaries for
reviewers.

Decisions: **AI never decides** — it fills fields and flags that a person sees, and every branch has a path for
`incomplete` / `failed` (the deal falls back to the declared figures, the analyst sees "—"). Documents leave the
platform to the provider the institution chose (data class `identity`, `financial` in the manifest; shown at consent).
Locally a deterministic fake model reads `Label: value` lines, so tests are stable.

### 3.6 LoanPro (AUT-06)

`loan.board` (customer, loan with collateral, activation; returns ids, payment, first due date), `payment.create`,
`loan.get` (balance, next payment, days past due, payoff). LoanPro's webhooks (verified HMAC) update the borrower's app
(`loans`, `payments` collections through `PUT /connector-api/client-records`, scope `client-records:write`) and
publish `connector:loanpro/payment.posted | loan.delinquent | loan.paid_off` with the borrower as applicant, which
start the servicing workflows. API shapes are assumptions until checked against a sandbox
(`integrations/loanpro/docs/ASSUMPTIONS.md`).

### 3.7 Cases that create and serve other clients (AUT-07)

A deal belongs to the dealer, but it creates a borrower. `client.upsert` creates or finds a client (by external id +
source, else e-mail), sets segments and attributes, and invites *new* clients by e-mail; `client.data / record /
profile / notify` take an optional `client` (default: the applicant) to act on that other client. The dealer never
sees the borrower's app; the borrower never sees the dealer's case.

### 3.8 Solutions: templates wired to connections

A template may now *require* connections (by connector) and *parameters* (validated by pattern). The studio's
*Templates* dialog asks for them (preselecting the only connection of a kind, or the one whose name matches), the API
checks each connection's connector, fills the `${KEY}` placeholders of the YAML, creates the functions first (others
call them), publishes everything and loads the app into the draft. Installing requires `workflows:publish` (functions
must be published to be callable). Locally the stack installs it in *Demo Auto Finance*
(`apps/core/scripts/demo-auto-finance.ts`).

### 3.9 Smaller things the process needed

- Reviews: branches may use the short outcome names (`approve`, `reject`) — the validator already accepted them, the
  engine now follows them. Custom outcomes (*Approve with conditions*, *Fund the dealer*) keep their keys.
- *Ask the client/dealer* can ask for a **document** (an upload) instead of a written answer, from the task page.
- The task page lists the case's **documents** (the funding audit is a document check).
- Case data shows files by name and years without separators; the client app formats USD as `$1,234.50`;
  the *details* widget shows the first record on pages without a `key` (*My loan*).
- The workflow editor keeps `stages`, `function` and `outputs` through a save (they were dropped before) and edits them
  in *Workflow settings* (⚙); `version` and `triggers` are optional in hand-written YAML.
- The order of pages and journeys authored in an app survives publication (JSONB reorders keys).

## 4. Security and compliance notes

- **Isolation**: every new table (`case_signals`) has RLS forced; connector calls are scoped per installation; files
  readable by a connector are limited to the case chain of the step, with the step's callback token.
- **Hook URLs** are capabilities: HMAC-bound to tenant + case + name; they reveal nothing and open nothing else.
  They are shown (case page, signals API) only to members who may signal anyway (`cases:signal`); workflows hand them
  to the other system in a step, not in the case data. Rotate by changing the platform secret (all hook URLs change).
  Payloads ≤ 64 kB; signals to finished cases `409`.
- **Secrets** of HTTP APIs, AI providers and LoanPro live in their connectors (encrypted, write-only settings).
- **AI**: documents go to the provider the institution configured; the manifest declares the data classes. Outputs are
  advisory; people decide. Keep the provider's data-retention settings in mind (zero retention where available).
- **Lending regulation** (US): adverse action notices (ECOA/Reg B, FCRA) are not generated yet — the decline path only
  tells the dealer; a real deployment needs the notice to the applicant with the reasons and the bureau disclosure.
  Credit bureau pulls are not part of this version (see §6).
- **Audit**: stage changes, signals (waiting, received, timed out), client creation by workflows, connector file reads,
  client-record writes are all in the institution's audit log.

## 5. E-signature: Documenso, DocuSign, DocuSeal

- **Documenso** is integrated (`integrations/documenso`): templates, embedded signing as a client step, signed
  webhooks, the signed PDF attached to the case through the intake. The solution uses two templates (retail installment
  contract for the buyer, assignment for the dealer) with per-step titles and instructions.
- **DocuSign** and **DocuSeal** are **not integrated**. DocuSeal was removed in batch 0004 (plan 05). Either fits the
  same component contract — `signature.request` (`kind: client_step`, events `signed` / `declined` / `expired`,
  a `signature_request` record, the signed document into the case) — so a workflow switches provider by changing the
  step type. What each connector would need:
  - *DocuSign*: OAuth (JWT grant for the institution's integration user), envelopes from templates, **embedded signing**
    (recipient view URL, `clientUserId`) as the client action, **DocuSign Connect** webhooks (HMAC), combined document
    download. The local fake would mimic the eSignature REST API v2.1.
  - *DocuSeal* (open source, self-hostable): API token, submissions from templates, the embed form, webhooks; simplest
    of the three to fake.
- Dealers often contract through **RouteOne** or **Dealertrack** e-contracting instead; that is an integration with
  the dealer platforms themselves (see §6).

## 6. Not in this version (next steps, by value)

1. **Dealer organisations**: a dealership with several users (F&I managers, a principal), deals shared among them,
   per-dealer settings (fee, rate sheet, status). Today a dealer is one client with attributes.
2. **Deal intake from dealer platforms** (RouteOne, Dealertrack / DealerSocket credit application APIs) and
   **e-contracting** through them.
3. **Credit bureau pulls** (soft/hard), scorecards and a rules/pricing engine (rate sheets, tiers, max LTV by tier),
   **adverse action notices**.
4. **OAuth flows for the HTTP connector**: Google (service account JWT bearer) and Intuit (authorization code with
   refresh tokens) are what the real Sheets and QuickBooks APIs use; the HTTP connector has API key / bearer / basic /
   client credentials only. Until then: dedicated connectors for them, or a gateway. (The local fakes accept bearer
   tokens.)
5. **Electronic lien and title (ELT)** providers calling the title workflow's hook URL; lien release on payoff through
   them.
6. **Funding by ACH/RTP** through the institution's bank API (instead of, or with, QuickBooks) and reconciliation.
7. **Real sandboxes**: LoanPro, QuickBooks, Google Sheets, DocuSign — the connectors' `ASSUMPTIONS.md` lists what to
   check.
8. **Reporting**: stage durations (time in underwriting, time to fund), dealer performance, pull-through.
9. Editor: a visual designer for stages on the board (drag a case between stages with a rule), functions with
   connection parameters (today a function uses the connections it was written with).

## 7. Tests

| Flow | Test |
| --- | --- |
| AUT-01 stages, AUT-02 functions, AUT-03 signals, AUT-04 HTTP connector, AUT-05/06 AI and LoanPro settings and signatures, AUT-07 `client.upsert` | `apps/e2e/tests/automation/automation.api.spec.ts` |
| AUT-01/02 in the editor (settings dialog, *Your functions*) | `apps/e2e/tests/automation/functions.ui.spec.ts` |
| SCN-12 through the APIs: template install and its checks, dealer onboarding, a deal to a boarded loan (AI, numbers, log, questions, contracts, funding, QuickBooks, LoanPro, title by hook URL, borrower app, payments, delinquency, payoff), flags and a decline, an unreadable stipulation | `apps/e2e/tests/scenarios/dealer-finance.api.spec.ts` |
| SCN-12 in the browser, every persona in its window (`E2E_VISUAL=1`) | `apps/e2e/tests/scenarios/dealer-finance.ui.spec.ts` |
| Solution, signals, definitions (unit) | `apps/core/test/automation.test.ts`; PDF text extraction: `integrations/ai/src/pdf-text.test.ts` |
