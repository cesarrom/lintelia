# 0008 — Dealer finance, and the automation building blocks behind it

A lender that buys car loans from dealers can now run the whole business on Lintelia: dealers apply and send deals
with their stipulations from a **dealer portal**; **AI reads the documents**, the numbers and policy flags are computed
and the deal is **logged in a spreadsheet** before anyone looks; **underwriting** decides, asking the dealer for more as
often as needed; the buyer and the dealer **sign** (Documenso); the **funding package** is audited; the dealer is
**paid in QuickBooks**; the loan is **boarded in LoanPro**; the buyer becomes a client with an **app to follow and pay
their loan**; **LoanPro's servicing events** (payments, delinquency, payoff) keep running workflows; the **title**
arrives by a call-back from another system. Analysis, decisions and what is left:
[../plans/12-dealer-finance.md](../plans/12-dealer-finance.md).

Most of it is generic — any institution can use it for other processes:

| Building block | What it is |
| --- | --- |
| **Stages** | `stages` in a workflow, `case.update { stage, data }`; stage bar on the case, **pipeline board** (*Cases → Pipeline*), stages in the client's journey |
| **Functions** | a published workflow with `function: true` is a step of other workflows (`function:<id>`: inputs → `outputs`); *Your functions* in the editor's palette; `workflow.call { wait: false }` |
| **Signals** | `webhook.wait`: a case waits for another system to call it back — its signed **hook URL** or `POST /cases/:id/signals/:name` (`cases:signal`) — early signals kept, deadlines |
| **HTTP connector** | any REST API as a connection (API key, bearer, basic, OAuth client credentials; credentials in the connector) and its **inbound webhooks** starting workflows |
| **AI connector** | `document.extract` (fields from a document, or what is missing) and `text.generate`, with any OpenAI-compatible API |
| **LoanPro connector** | board loans, take payments, loan status; LoanPro webhooks update the borrower's app and start servicing workflows |
| **Clients created by workflows** | `client.upsert` (create/find, segments, invitation) and a `client` target on the client steps |
| **Solutions** | templates that require connections and parameters: the studio asks for them and wires the workflows |

## Try it (local stack)

`bun run stack` sets up **Demo Auto Finance** (`http://demo-auto.localhost:3001`): five connections to the local fakes
and the *Dealer & borrower portal* published. Step by step: [TESTING.md, journey J19](../../TESTING.md#j19--dealer-finance-from-the-deal-to-the-borrowers-payments).

| Who | Where |
| --- | --- |
| Dealer | `/portal` as `dealer@sunrise-motors.test` — *Submit a deal* (stipulations: `bun run demo:files` → `.data/demo-files/deal-*.pdf`) |
| Underwriter | `underwriter@demo-auto.test` — *Cases → Pipeline*, *Tasks* |
| Funding | `funding@demo-auto.test` — funding audits, dealer approvals, lien releases |
| Designer | `designer@demo-auto.test` — *Client app* (the portal), *Workflows* (the 11 workflows, functions, ⚙ settings) |
| The systems | LoanPro http://localhost:9410 (with *Post a payment*, *Missed payment*, *Pay off* buttons), QuickBooks :9411, Google Sheets :9412, LLM :9409, mailbox :8025 |
| Watch it all | `bun run --cwd apps/e2e test:watch tests/scenarios/dealer-finance.ui.spec.ts` (one window per person) |

## What changed

### Engine and API (`apps/core`)

- **Migration `0021_case_stages_signals`**: `cases.stage`; `case_signals` (waiting / pending / delivered / cancelled,
  RLS forced).
- **Definitions** (`engine/definition.ts`): `stages` (`key`, `label`, `clientLabel`, `exit`), `function`, `outputs`;
  inputs with labels. Validation refuses moves to undeclared stages and function steps whose target is not a published
  function (or the workflow itself).
- **Components**: `case.update` gains `stage` and `data`; `webhook.wait`; `client.upsert`; `client` target on
  `client.data / record / profile / notify`; `function:<workflow id>` (resolved from published functions, listed by
  `GET /workflow-components`); `workflow.call { wait: false }` (event `started`). Outputs of a case are evaluated at
  its end and returned to its caller. Variables: `case.hooks.<name>`, `case.applicant.id`.
- The engine follows a component's short event names in branches (`approve` / `reject` on reviews), as validation
  already allowed.
- **Routes**: `GET /cases/pipelines`; `GET /cases/:id/signals`; `POST /cases/:id/signals/:name` (`cases:signal`, new
  permission: admin, integration manager); public `POST /hooks/cases/:id/:name?tenant&token`. `GET /cases/:id` has
  `stage` and the workflow's `stages`; `GET /tasks/:id` has the case's files. Decisions accept `items` (ask for a
  document). Templates: `POST /client-apps/current/template { template, connections, parameters }`.
- **Connector API**: `GET /connector-api/files/:id?callbackToken=` (`files:read`), `PUT /connector-api/client-records`
  (`client-records:write`); SDK `core.documents.read`, `core.clientRecords.write`.
- **Solution**: `apps/core/src/solutions/dealer-finance` (11 workflow YAMLs, the portal, the installer).
- **Seed**: tenant *Demo Auto Finance* with its team and a dealer; stack task `demo-auto-finance`
  (`bun run demo:auto-finance`); `demo:files` writes a deal's stipulations.

### Connectors and fakes

- `integrations/http` (:4106), `integrations/ai` (:4107, with a dependency-free PDF text extractor),
  `integrations/loanpro` (:4108); Documenso steps accept a `title` and `instructions`, and the Documenso fake has the
  *Retail installment contract* and *Dealer assignment* templates.
- Fakes (each with a page showing what happened): `fake-services/llm` (:9409, OpenAI-compatible, deterministic),
  `loanpro` (:9410, with webhooks and back-office buttons), `quickbooks` (:9411), `sheets` (:9412).

### Web (`apps/web`)

- Case page: **stage bar**, **signals** card (*Record it* for `cases:signal`); cases list: stage; **pipeline board**.
- Task page: the case's **documents**; *Ask the client* can ask for a document.
- Workflow editor: **Workflow settings** (stages, function, outputs) and a summary under the title; *Your functions*
  in the palette; `stages` / `function` / `outputs` survive saving.
- Studio: templates that need connections open a **setup** step (connections, parameters).
- Client app: USD shown as `$1,234.50`; the *details* widget shows the first record on pages without a `key`; the
  authored order of pages and journeys survives publication. Case data shows file names and years as written.

## Tests

| | |
| --- | --- |
| New flows | AUT-01…AUT-07, SCN-12 ([docs/product/flows.md](../product/flows.md)) |
| New e2e files | `tests/automation/automation.api.spec.ts` (13), `tests/automation/functions.ui.spec.ts` (1), `tests/scenarios/dealer-finance.api.spec.ts` (5), `tests/scenarios/dealer-finance.ui.spec.ts` (1, multi-persona, best watched with `E2E_VISUAL=1`) |
| Unit | `apps/core/test/automation.test.ts` (20), `integrations/ai/src/pdf-text.test.ts` |
| Result | full suite **452 passed**, 102 flows work ([flow-status](../testing/flow-status.md)); the machine had heavy CPU steal during the final runs, so it ran with 3 workers and `--retries=1` (4 browser journeys passed on their retry: timing, not behaviour). SCN-12 watched in visual mode: passes in about 2 minutes. Core unit tests: 77 passing |

## Known limitations

See [plan 12 §6](../plans/12-dealer-finance.md#6-not-in-this-version-next-steps-by-value): dealer organisations with
several users, dealer platforms (RouteOne, Dealertrack), credit bureaus and adverse action notices, OAuth flows the
real Google and Intuit APIs need in the HTTP connector, ELT providers, ACH funding, real sandboxes for LoanPro /
QuickBooks / Sheets. DocuSign and DocuSeal are not integrated (Documenso is); plan 12 §5 says what each would take.
