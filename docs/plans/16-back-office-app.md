# Plan 16 — The institution's own back office: custom pages, widgets, menu items and actions, gated by access

Status: **first iteration done** ([changes/0013](../changes/0013-back-office.md)) — decisions recorded in §11, what was
built and what is left in §12. Depends on [15](15-access-and-roles.md) (custom permissions and access rules);
uses [17](17-live-data-and-events.md) for live widgets once it exists.

## 1. What was asked

Designers of an institution **create custom screens for the institution's own UI** (the back office its team uses):
custom pages, buttons, widgets and menu items. Screens and workflows can be **gated to a set of roles**, and
everything plays well with permissions.

Out of scope: the client app (what the institution's customers use) — it already has its studio (plan 11, 14) and
stays as it is, although both share building blocks (§5.9).

## 2. Why institutions want their own back-office screens

The built-in back office covers the generic work: tasks, cases, clients, building, administration. What each
institution does *around* it is specific, and today either happens in another tool or does not happen:

| Use case | What it looks like | Who should (not) see it, and why |
| --- | --- | --- |
| **Operational consoles** | *Collections*: delinquent loans, promises to pay, "log a call", "offer a plan"; *Funding*: deals ready to fund | collections team only (need-to-know on delinquency data); funding separate from underwriting (SoD) |
| **Customer 360 extensions** | a *Loans* tab on the client page (from LoanPro), a *Cards* tab, a *KYC summary* panel | tellers and RMs; the *AML* panel only for compliance (tipping-off) |
| **Quick actions on a record** | on a client: *Reissue card*, *Waive fee*, *Change limit*, *Request a document*; on a case: *Request payoff quote*, *Escalate to legal* | by authority and licence: waive up to an amount; limits only by credit officers |
| **Internal requests** | "Open a business account for a walk-in client", "Report an incident", "Request a limit increase" — a form that starts a workflow with approvals | often everyone (a request form), while *approving* stays restricted |
| **Team dashboards** | KPIs of a team: SLA breaches, pipeline by stage, my queue, today's payments | team leads and their teams; branch managers see their branch (attribute condition) |
| **Lookups** | credit bureau pull, sanctions re-check, a core-banking balance | permissible purpose (FCRA): only roles with the licence, every pull audited |
| **Pilots** | a new onboarding console tried by one team | a pilot group first (presentation, not a control) |
| **External tools in context** | a vendor's page (fraud tool, document viewer) embedded next to the case | who holds the vendor licence (often per seat) |

The pattern behind every row: **a menu entry or a slot in an existing page → a page of widgets showing data the
member may see → buttons that start workflows (often with a short form and an approval) or signal running ones**. The
gating reasons are those of plan 15 §3.

## 3. How others do it (the standard we align with)

| Product | Structure | Gating |
| --- | --- | --- |
| Salesforce Lightning App Builder | apps (navigation) · app/home/record pages · quick actions running flows · components | page assignment by app, record type and profile; component visibility filters by permission (custom permissions) |
| ServiceNow UI Builder / Workspaces | workspaces · pages with variants · declarative actions | roles on pages, variants and actions; ACLs on data |
| Microsoft Power Apps (model-driven) | apps · forms · views · command bar buttons | apps and forms assigned to security roles; data by table privileges |
| Pega | portals · case types · harnesses | access groups select the portal; access roles and privileges |
| Retool / Appsmith | internal apps · queries · components | app-level permission groups; queries run server-side with resource permissions |

Common ground, which this plan follows: **navigation + pages + record-context pages + actions that run flows**;
**visibility per item by permission**; **data always through the server under the user's rights**; **custom code only
in sandboxed frames**.

## 4. What exists to build on

- **Client app** (plans 11, 14): versioned definition (draft → validate → publish → rollback), pages of widgets, a
  widget catalogue with JSON-schema props (`CLIENT_WIDGETS`), data sources resolved on the server with an allow-list,
  journeys run by workflows with `client.screen` steps (fields, buttons as events, auto-submit, how they open: page,
  dialog, sheet, full screen), the studio with live preview, the experience map.
- **Back office**: hand-coded React pages; navigation from a static list filtered by permissions
  (`apps/web/src/lib/routes/routes.ts`); tasks (`review`, `task`) rendered by the built-in task UI.
- **Workflows**: everything actions need (approvals, four-eyes, connectors, functions, signals).
- **Plan 15**: custom permissions and `access` rules.

Missing: a definition for the team's side, staff-facing screens inside workflows, data sources for members,
extension points in built-in pages, and gating per item.

## 5. The design

### 5.1 The back-office app definition

One per institution, versioned exactly like the client app (same tables with `kind: member`, same publish,
rollback and audit; permissions `backoffice:read`, `backoffice:manage`, `backoffice:publish`).

```yaml
schemaVersion: "1"
kind: member
navigation:
  - section: Servicing
    items:
      - { page: collections, label: Collections, icon: phone-call, access: { permissions: [custom:collections.console] } }
      - { page: funding, label: Funding, icon: banknote, access: { roles: [senior_reviewer] } }
  - section: Work
    items:
      - { builtin: tasks }                 # built-in pages can be placed and ordered, never granted (their permissions stay)
      - { builtin: cases }
      - { action: internal_request, label: New request, icon: plus }
homes:                                     # first match is the member's landing page
  - { page: collections, access: { permissions: [custom:collections.console] } }
  - { builtin: dashboard }
pages:
  collections:
    title: Collections
    widgets:
      - { type: metric, props: { label: Promises due today, source: "records:promises", aggregate: count, filter: "dueDate = $today()" } }
      - type: table
        props:
          source: "records:loans"
          filter: "status = 'delinquent' and branch = member.attributes.branch"
          columns: [{ field: client.name, label: Borrower }, { field: daysPastDue, label: DPD }, { field: balance, label: Balance, format: money }]
          rowAction: { page: client-collections, params: { client: "{{item.clientId}}" } }
  client-collections:
    context: client                        # opened with a client; every source is scoped to it and re-authorised
    title: "Collections: {{client.name}}"
    widgets:
      - { type: client-records, props: { collection: loans } }
      - { type: case-list, props: { workflow: promise-to-pay, status: open } }
      - { type: action-bar, props: { actions: [log_promise, waive_fee] } }
actions:
  log_promise:  { label: Log a promise to pay, workflow: promise-to-pay, input: { client: "{{client.id}}" }, presentation: { mode: sheet } }
  waive_fee:
    label: Waive a fee
    workflow: waive-fee
    access: { permissions: [custom:fees.waive], when: "member.attributes.authorityLimit > 0" }
  internal_request: { label: New internal request, workflow: internal-request, presentation: { mode: dialog } }
slots:                                     # extension points in built-in pages
  client.actions: [waive_fee]              # buttons on the built-in client page
  client.tabs: [{ page: client-collections, label: Collections, access: { permissions: [custom:collections.console] } }]
  case.actions: []
  dashboard.widgets: []
```

### 5.2 Navigation, homes and built-in pages

- The sidebar is the published navigation: custom pages, actions and **built-in pages** placed where the institution
  wants them. Built-in pages keep their built-in permissions (placing them never grants them; hiding them is
  presentation only, and the studio says so).
- Built-in pages not placed anywhere are appended in their default section, so a new platform page is never lost.
- No published back-office app = today's navigation exactly (no migration needed).
- `homes`: the landing page per audience ("collections agents land on Collections").

### 5.3 Pages and record context

- A page has `context: none | client | case`. A context page is opened with the record's id (`/app/x/<page>?client=…`
  or as a tab of the built-in client/case page). The API first checks the member may see that record (client scope,
  case scope and the workflow's `access.cases`), then resolves the page's sources for it.
- Widgets with `visibleIf` (JSONata over member, context and data) for presentation, and `access` for control.

### 5.4 Widgets

Shared with the client app where the meaning is the same (one renderer, two themes): `section`, `heading`, `text`,
`callout`, `metric`, `key-values`, `list`, `table`, `button`, `link`, `embed` (sandboxed frame, allowed origins).

Team-specific:

| Widget | Shows |
| --- | --- |
| `task-queue` | tasks of my queues, filtered (queue, workflow, SLA) — claim and open as in *Tasks* |
| `case-list` / `case-pipeline` | cases in scope, filters (workflow, stage, status, attribute), as a list or a board |
| `client-search` | search clients in scope; opens a page or the client |
| `client-summary`, `client-records` | the client in context: profile, segments, a records collection |
| `case-data`, `case-timeline`, `case-signals` | the case in context |
| `action-bar` | the page's actions (each filtered by its own access) |
| `live-feed`, `live-value` | messages and values from a live channel (plan 17) |

Custom code widgets stay out of v1 (decision 4 of plan 11: built-ins + a sandboxed embed).

### 5.5 Data sources (always resolved by the API under the member)

| Source | Needs | Returns |
| --- | --- | --- |
| `member` | — | me: name, roles, attributes (never permissions of others) |
| `tasks` | `tasks:work` or `tasks:assign` | my queues, as *Tasks* |
| `cases` | `cases:read` | cases in scope ∩ each workflow's `access.cases`; filters by workflow, stage, status, data fields |
| `case` (context) | `cases:read` + scope | the case, data, stage, tasks, signals |
| `client` (context) | `clients:read` + scope | the client's profile |
| `records:<collection>` | `clients:read` | in a client context: that client's records; otherwise across clients in scope (filters, limits, paging) |
| `metrics` | per underlying source | counts and sums (cases by stage, tasks by SLA, records aggregate) |

- The published definition declares what it reads (allow-list computed at publish, like the client app); the runtime
  refuses anything else.
- A widget shows nothing — never an error page — when the member lacks its source's permission, and the studio warns
  at publish (§5.8).
- Filters are JSONata evaluated on the server, with limits (rows, time), never SQL from the definition.
- **Later**: *query functions* — a published function workflow marked `query: true` (read-only, no human steps,
  time-limited) run synchronously as a data source, e.g. a live balance from core banking or a bureau pull. Needs an
  execution mode without a case per call; kept for a second iteration (§10).
- Reads of client data through custom pages are audited (`client.viewed`, page and member) when the institution turns
  on *read auditing* — the usual control against employees browsing accounts they have no reason to open.

### 5.6 Actions and staff screens in workflows

- An action = a gated, named entry point: **start a workflow** (inputs from the context, allow-listed like client
  journeys), **signal a running case** (plan 17, AUT-03 signals from a button), **open a page**, **open a URL**.
- Both gates apply to a workflow action: the action's `access` **and** the workflow's `access.start` (plan 15). The
  studio shows the effective audience (the intersection).
- New component **`team.screen`**: a screen for a member inside a workflow, reusing `client.screen`'s definition
  (fields, buttons as events, auto-submit, presentation). `to: initiator` (default) makes a wizard: the member who
  pressed the button fills it at once in a dialog, sheet or page (the same fast path as client journeys); `to: { role }`
  makes it a form task in that role's queue. Answers become `input.<key>`; audited as task decisions.
- Example *Waive a fee*: `team.screen` (fee, amount, reason) → `conditional` (amount above the member's
  `authorityLimit` → `review` by `senior_reviewer`) → connector step (core banking) → `team.screen` (done) → `client.notify`.
- `POST /backoffice/actions/:key` checks access (action + workflow), validates inputs, starts the case with
  `initiatedBy` the member and `source: backoffice:<action>`, answers with the first screen if there is one.

### 5.7 Slots in built-in pages

Named extension points rendered by the built-in pages: `dashboard.widgets`, `client.actions`, `client.tabs`,
`client.panels`, `case.actions`, `case.tabs`, `case.panels`, `task.panels`. Each entry is filtered by its `access`.
Slots keep the built-in pages the platform's (they evolve with releases) while institutions add what they need next
to them, which is how Salesforce record pages and Power Apps forms stay upgradable.

### 5.8 Gating, end to end

1. **Serving**: `GET /backoffice/app` returns the published definition **pruned for the member**: items, pages,
   widgets, actions and slot entries outside the member's access are removed on the server (their names and
   configuration never reach the browser).
2. **Using**: every data request and action is re-checked (access rule, source permission, record scope, workflow
   `access.start`). Hidden ≠ protected, so nothing relies on step 1.
3. **Publishing**: the studio computes an **access report** per role: pages, menu items and actions each role gets;
   widgets that would be empty for a role that sees the page (missing source permission); actions whose workflow
   excludes part of the page's audience; custom permissions nobody holds yet ("this page is visible to nobody but
   administrators until someone grants *Collections console*"). Access changes are shown as a diff and follow plan 15
   decision 2.
4. **Previewing**: *Preview as* (roles + attributes) in the studio, structure and sample data only.
5. **Auditing**: `backoffice.published` (with the access diff), `backoffice.action_run`, `client.viewed` (optional).

### 5.9 The studio

The client-app studio's shell (palette, canvas, properties generated from JSON schema, versions, publish checks)
with a **Back office** mode: pages, navigation, actions, slots and homes; an access panel on every item (permission
picker with "create a custom permission" inline, roles shorthand, condition); preview as roles; the access report.
Designers with `backoffice:manage` build; `flow_designer` gets `backoffice:read/manage/publish`, `auditor`
`backoffice:read`, `admin` everything. The experience map (plan 13) later shows the back office next to the client app
(pages → actions → workflows).

## 6. Security and privacy

- Same guarantees as the client app: server-side resolution, allow-lists, declared inputs only, limits, no code from
  the definition (JSONata only, evaluated with timeouts), sandboxed embeds with allowed origins and CSP.
- A definition cannot raise privileges: it can only show what the member could already read and start what the
  member is allowed to start. The only grant is a workflow's `access.start`, which is an access decision (plan 15 §5.3).
- Rate limits on actions and sources per member.
- Support access (staff, read-only) sees the back office as an auditor would; actions refused.

## 7. API (sketch)

| Route | Permission |
| --- | --- |
| `GET /backoffice/current`, `PUT /backoffice/current/draft`, `POST …/validate`, `…/publish`, `…/activate`, `GET …/versions/:v` | `backoffice:read` / `manage` / `publish` |
| `POST /backoffice/current/access-report`, `POST /backoffice/current/preview` | `backoffice:read` (+ `roles:read`) |
| `GET /backoffice/app` | any member (pruned) |
| `POST /backoffice/data` `{ page, sources, context }` | any member (per source) |
| `POST /backoffice/actions/:key` `{ context, input }` | any member (action + workflow access) |
| `GET /backoffice/cases/:id/screen`, `POST …/screens/:taskId` | the member the screen is for |

## 8. Tests

| Id | Flow |
| --- | --- |
| BOA-01 | A designer builds a page with widgets and a menu item, previews it, publishes; members see it in the sidebar |
| BOA-02 | Gating: a page, a menu item, a widget and a button each restricted by a custom permission; an administrator grants it to a role; members without it never receive the item (pruned) and get 403 through the API |
| BOA-03 | An action starts a workflow with a `team.screen` wizard (dialog), an approval above the member's authority, and a result screen |
| BOA-04 | Context pages and slots: a *Collections* tab on the client page and a *Waive fee* button; record scope is enforced (a client outside scope → 404) |
| BOA-05 | Data sources: cases, tasks, records across clients with filters; a member without `clients:read` sees empty widgets, never data |
| BOA-06 | Homes per role; built-in pages placed and hidden (presentation) while their permissions still apply |
| BOA-07 | Access report and publish diff; versions and rollback |
| BOA-08 | Read auditing: opening a client context page is in the audit log |

Plus the Dealer-finance solution gains a *Funding* console and a *Collections* page as a reference institution setup
(like the banking template did for the client app).

## 9. Milestones

| M | Content |
| --- | --- |
| 16.1 (M) | definition, versions, publish, pruned serving, sidebar from the definition, pages with shared widgets, `member` / `cases` / `tasks` sources |
| 16.2 (M) | actions (start workflow, open page, signal), `team.screen` with presentations, effective-audience checks |
| 16.3 (M) | context pages, slots in the client / case / dashboard pages, records and client sources, team widgets |
| 16.4 (M) | studio back-office mode: access panel, preview as, access report, diff; homes |
| 16.5 (S–M) | read auditing, experience map, dealer-finance reference consoles |
| later | query functions as data sources, live widgets (17), code widgets in sandboxed frames |

## 10. Open questions and decisions we need

1. **Slots vs replacing built-in pages**: slots only (recommended: the built-in pages keep evolving), or may an
   institution replace a built-in page with its own?
2. **One studio or two**: the back office as a mode of the existing studio (recommended) or a separate *Back-office
   builder*?
3. **Data from the institution's systems**: are client records (pushed) enough for v1, or are synchronous *query
   functions* (live lookups through connectors) needed early? They are the most expensive item here.
4. **Read auditing** (`client.viewed`): off by default, on per institution (recommended)?
5. **Reference consoles**: which first — *Collections* (Demo Auto), *Funding* (Demo Auto), or a branch *Customer
   360* (Demo Bank)?

## 11. Decisions (recorded)

| # | Question | Decision |
| --- | --- | --- |
| 1 | Built-in pages | institutions **add brand-new pages** and **edit built-in pages** by adding to them (slots: buttons, tabs, panels, dashboard widgets; menu placement), but **never replace** a built-in page |
| 2 | Where designers build | a **Back office** mode of the existing studio |
| 3 | Data from the institution's systems | generic building blocks only; institutions implement their own use cases (no bespoke consoles in the platform) |
| 4 | Read auditing | off by default, on per institution (*Settings → Security*) |
| 5 | Example | yes: a meaningful reference setup that uses every piece (custom permission, gated menu item and page, a button on a built-in page starting a workflow with staff screens and an approval above the member's authority, a dashboard widget) |
| — | Second administrator by default (plan 15) | no |

## 12. What was built (first iteration) and what is left

Built (milestones 16.1–16.4 and read auditing of 16.5), with the *Fee waivers* template as the reference example
(decision 5):

- The definition (§5.1) stored as a second app of the institution (same versions, publication, rollback and audit),
  served **pruned per member** (§5.8 step 1): pages, widgets, actions, menu items, buttons, tabs and homes outside the
  member's rule, actions whose workflow the member may not start, and references to pruned items never reach the
  browser. Every use is re-checked (step 2).
- Pages with `context: none | client | case`; the sources `member`, `cases`, `tasks`, `metrics`, `client`, `case`,
  `records:<collection>` (the page's client, the case's applicant, or across clients), resolved under the member's
  permissions, case scope and workflow rules, only what the page reads.
- Widgets: the client app's widgets that mean the same for a team (`section`, `heading`, `text`, `callout`, `image`,
  `stat`, `list`, `table`, `details`, `chart`, `progress-list`, `button`, `embed`), one renderer.
- Actions that start a workflow (both rules apply), inputs from the context by templates and from buttons by
  allow-list; **`team.screen`** (to the member who ran the action — a wizard in a dialog or a sheet — or to a role's
  queue); where a case stands for the member (screen, waiting for someone, done); the member's pending screens
  (dashboard, case page).
- Slots: `client.actions`, `client.tabs`, `case.actions`, `case.tabs`, `dashboard`; menu items in existing or new
  sections; homes.
- The studio's **Back office** mode (§5.9): lists of pages, additions, actions, menu and homes; a canvas with the
  back office's renderer and sample data, selection of widgets, **preview as a role** (pruned by the API); inspectors
  with *Who gets it* on every item; the **access report** (§5.8 step 3: per role, empty widgets, actions excluded by
  their workflow, permissions nobody holds); templates; versions.
- Read auditing (decision 4): *Settings → Security*, `client.viewed` with the page.

Left (in rough order of value):

1. Built-in pages placed, ordered or hidden in the menu (§5.2; presentation only) and panels (`client.panels`,
   `case.panels`, `task.panels`).
2. Actions that signal a running case, open a page or a URL (§5.6) — signalling belongs with plan 17.
3. Team widgets (`task-queue` with claim, `case-pipeline`, `client-search`); lists and tables over `cases` / `tasks`
   cover the basics today.
4. The publish diff of access (§5.8 step 3) and preview with attributes in the studio (the API accepts them).
5. Rate limits per member on actions and sources; the back office on the experience map.
6. Query functions (live lookups through connectors) and live widgets (plan 17).
