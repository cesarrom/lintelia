# Plan 11 — Client experience builder (screens for institutions' end users)

Status: **v1 shipped** (decisions recorded in §13; what v1 ships is in [../changes/0007](../changes/0007-client-apps.md)).
Building blocks added since (how journeys open, scanner and other fields, auto-submit, branding): [14](14-ui-building-blocks.md).

Goal: an institution builds, without code, what its clients see and do on its own domain — register, sign in, apply,
answer requests, follow statuses, see their products, do self-service (update details, upload a document, ask for a
card) — and every screen is wired to the institution's workflows, data and connectors, with the same guarantees as
the back office (isolation, audit, four-eyes where needed, no data leaks).

This document: what exists to build on (§1), the concepts every option needs (§2), three ways to build it (§3), a
recommendation with milestones (§4), then the details (§5–§11) and the decisions we need from you (§12).

---

## 1. What we build on (today)

| Piece | Today | Gap for a client-app builder |
| --- | --- | --- |
| **Forms** | `FormConfig` (≈20 field types, variables, page separators, options from variables), builder, `FormViewer`, hosted/embeddable forms (`/embed/forms/:publicKey`, allowed origins, e-mail confirmation), `form.request` sends a form to a client inside a workflow | a form is one screen of inputs; no layout, no read-only content, no data display, no navigation |
| **Client identity** | own realm: e-mail one-time code, password, self-registration, party invitation links, password reset, sessions; data-rights requests | no tenant-defined profile fields, no verified phone, no passkeys/step-up, no business (multi-user) clients, no consents/T&C versions, no notification inbox |
| **Workflows ↔ clients** | `client.request` (text/file), `form.request`, `parties.collect`, connector client actions (Didit, Documenso in a dialog), `case.decision` notifies, `clientVisibility: requests_only` hides investigations | the workflow cannot *show* a designed screen, declare client-facing stages, or be started by a client action other than a form submission |
| **Portal** | hand-coded pages (`/portal`, case, requests, privacy) over `GET/POST /me/*` (10 endpoints), institution colours | fixed: every institution gets the same three pages |
| **Triggers** | form submission, API (`POST /events`, OAuth clients), manual/assisted, platform events (`startOn: [client.flagged]`) | no "client pressed a button" trigger with eligibility rules |
| **Data** | case data, calculations, canonical records from connectors; `postgres-datasource` runs parameterised queries | no client-safe way to expose data ("my accounts", "my balance") to a screen |
| **Platform** | RLS per institution, hash-chained audit, signed webhooks, custom domains (TXT verified), branding (`brandStyle`), connectors as separate services with their own UI pages (iframe + signed hand-off) | reuse as is |

The good news: the engine, the identity realm, the connector model and the UI primitives already exist. What is
missing is a **model of screens** and a **safe contract between screens and the backend**.

---

## 2. Concepts every option needs

Whichever option we choose, these pieces are needed; the options differ in how they are arranged and edited.

### 2.1 Client app (one per institution, versioned like workflows)

A JSON/YAML document edited in the back office and published as immutable versions (draft → validate → publish →
rollback), exactly like workflows. It holds: theme (colours, logo, fonts within our design system), navigation,
pages, journeys, registration/sign-in settings, texts (per language). Clients always get the active version; a
running journey keeps the version it started with.

### 2.2 Screens are made of widgets

A screen is a tree of **widgets** (blocks): layout (section, columns, tabs, card), content (heading, rich text,
image, callout), inputs (every form field we already have), data (list, table, key/values, metric, status pill),
process (case list, progress tracker, request inbox, document uploader, "verify my identity"), actions (button, menu).
The form builder's component registry (`editor` / `viewer` / `properties` / `schema` per component) is the pattern to
extend: one registry, one renderer shared by the builder preview, the portal and the embed.

### 2.3 Bindings: data in, actions out — always through the server

The browser never talks to workflows, Restate or connectors. Every screen talks to two server endpoints:

- **Data sources** (read): `me` (profile, KYC level, segments), `myCases`, `case(id)` (client view only),
  `myRequests`, `journey(id)`, workflow **client views** (see 2.4), connector **queries** the institution exposes
  to clients (e.g. `accounts.list` from the core-banking data source, with the client id injected server-side, never
  from the browser). A widget binds to `source.path` and the server resolves it under the client's identity.
- **Actions** (write): `start journey`, `submit screen`, `respond to request`, `run connector action` (whitelisted),
  `update profile field`, `navigate`, `sign out`. The server checks eligibility, validates input against the
  screen's schema, audits, and starts or resumes the workflow.

This is the security backbone: a published app declares which data and actions it uses; anything else is refused
(allow-list, checked at publish time and at run time).

### 2.4 Workflow side

- **Client stages**: a workflow declares the milestones a client sees (`Application received → Identity check →
  Review → Decision`) and steps map to them (`stage: identity`). The progress widget and notifications use them; the
  internal steps, queues, risk and notes stay hidden (we already do a weaker version: `steps` in `/me/cases/:id`).
- **Client view**: a whitelisted projection of case data for the client (`clientView: { amount: input.amount,
  offer: steps.estimate.maxAmount }`). Screens can only show what the view exposes — never raw case data (tipping-off
  rules of investigations keep working because `requests_only` workflows expose nothing).
- **New components**: `client.screen` (show a designed screen, wait for submission; its buttons are the step's
  events), `client.notify` (in-app + e-mail notification), `client.profile.update` (write profile attributes after
  KYC), `client.entitlement` (grant/revoke a segment, e.g. `verified`, `has_loan`).
- **New trigger**: `startOn: client:<journey>` with an **eligibility rule** (JSONata over the client profile, e.g.
  `kycLevel >= 2 and not('has_loan' in segments)`), so "Apply for a loan" only shows — and only works — for eligible
  clients.

### 2.5 Client identity features

Registration designed by the institution (which fields, e-mail and/or phone verification, T&C and privacy consents
with versions), sign-in methods (code, password, passkeys), step-up for sensitive actions (signing, changing contact
details), a **profile schema** per institution (typed attributes the workflows can write: KYC level, customer number,
segments), business clients (an organisation with several users and delegated rights, needed for KYB), sessions and
devices, an in-app inbox, languages. Details in §7.

### 2.6 Custom widgets

Three tiers (details in §8): configured built-ins → reusable composites saved by the institution → code widgets in
sandboxed iframes with a small SDK, shipped by connectors and approved by platform staff, like connectors today.

---

## 3. Three ways to build it

### Option A — "Portal pages": a page builder on top of the portal

Institutions compose **pages** (home, "my applications", "my accounts", "help", profile) from widgets in a visual
editor, bind widgets to data sources, and wire buttons to actions ("start *Personal loan* journey", "open request").
Journeys stay what they are today: a form starts a workflow; the workflow asks for more through requests and form
requests.

```
Client app = navigation + pages(widgets, bindings)      Workflows (unchanged + client stages/views)
     │  "Apply" button ──── action: start workflow ───▶  case ── client.request / form.request ──▶ inbox widget
     └─ progress widget ◀── data source: myCases ◀────── client stages
```

- **Builds on**: form builder, portal, `/me/*`, form submission trigger.
- **Pros**: fastest (the runtime is a renderer over config), safest, reuses almost everything; pages are easy to
  reason about; good for dashboards and self-service.
- **Cons**: two editors that must be kept in sync by hand (pages here, workflow there); multi-screen processes are
  still "one form + requests", which feels like e-mail ping-pong; no precise control of the screen sequence.
- **Fits**: institutions whose journeys are short (apply → wait → decision) and who mostly want a branded portal.
- **Size**: M (≈ 6–8 weeks for a solid v1).

### Option B — "Journeys": screens as steps of the workflow (server-driven UI)

The workflow **is** the journey. A new `client.screen` step shows a screen designed in a screen editor (opened from
the workflow node, like the configuration dialog today); the engine decides what comes next (conditions, connector
calls, reviews) and the client app is a runner that asks the server "what is my next screen?". Statuses come for
free (the engine knows where the client is).

```
Workflow:  start(client:open_account) → screen:Personal details → connector:screening → conditional
             → screen:Upload ID → connector:didit/kyc.verify → review (analyst) → screen:Your offer → decision
Client:    runner  GET /me/journeys/:id/screen → render → POST submit → (engine runs) → next screen / waiting state
```

- **Builds on**: the case engine (durable waits per screen are natural on Restate), `form.request` (already a
  screen-in-a-workflow), connector client actions, clientVisibility.
- **Pros**: one source of truth; the flow, the screens and the statuses are versioned together; branching, resume on
  any device, timeouts and reminders are the engine's job; designers think in journeys, which is how onboarding and
  lending are designed in banks (Backbase, Temenos Journey Manager, Unqork, Camunda user tasks).
- **Cons**: a round trip per screen (needs a fast path so the next screen appears in < 300 ms); not suited to free
  navigation (home, profile, products); the workflow editor grows a second editor (screens).
- **Fits**: onboarding, KYC/KYB, lending, claims — multi-step, branching, regulated processes.
- **Size**: M–L (≈ 8–10 weeks v1): screen model + editor, `client.screen`, runner, fast path, stages.

### Option C — "Client App Studio": a complete app builder (A + B in one model)

One versioned **client app** with two kinds of content: **pages** (free navigation: home, products, profile,
help — Option A) and **journeys** (workflow-driven sequences — Option B), one widget catalogue, one data/action
contract, shared theme, texts, languages, registration settings and custom widgets; a studio with preview per
persona/device, publish and rollback; optional custom domain per app.

- **Pros**: the complete answer to "clients register and do stuff through the platform"; one place to design the
  whole client experience; grows into a product on its own (comparable to Backbase/Unqork for this domain).
- **Cons**: the largest investment; risk of building a generic app builder instead of a banking one — needs a sharp
  widget catalogue and strong defaults (templates) to stay easy.
- **Size**: L (≈ 4–6 months to a mature v1 with a small team), best delivered incrementally.

### Comparison

| | A Portal pages | B Journeys | C Studio |
| --- | --- | --- | --- |
| Time to first value | **fastest** | medium | slow if big-bang, medium if incremental |
| Workflow ↔ UI integration | loose (actions + statuses) | **tight** (screens are steps) | tight |
| Free navigation, dashboards, products | **yes** | no | **yes** |
| Multi-step branching processes | weak | **strong** | **strong** |
| Statuses / progress | via client stages | **automatic** | automatic |
| Editors to learn | page editor + workflow editor | workflow editor (+ screen editor inside) | one studio (+ workflow editor) |
| Reuse of existing code | **high** | high | high |
| Risk | low | medium (latency, editor UX) | higher (scope) |

---

## 4. Recommendation: C as the target, built B-first

Build the shared foundation once (§2), then **journeys first** (they carry the regulated processes and the
"register and do stuff" promise), then **pages** (home, products, profile), then **custom widgets**. Each milestone
ships something usable and keeps today's portal working until an institution publishes its own app.

| Milestone | Content | Shippable result |
| --- | --- | --- |
| **M1 Foundation** (3–4 w) | client app model + versions; widget registry extracted from the form builder (renderer shared by builder, portal, embed); data-source and action endpoints with allow-lists; client stages and client views in workflows; profile schema v1 | today's portal rendered from a default app definition (no visible change, proves the runtime) |
| **M2 Journeys** (5–6 w) | `client.screen` component; screen editor opened from the workflow node (widgets, validation, buttons = events); runner (`/me/journeys`), fast path, resume/save-for-later, waiting states; `startOn: client:<journey>` with eligibility; progress widget; templates: account opening, loan application | an institution designs a multi-screen onboarding with branching, KYC and signature, fully tested in e2e |
| **M3 Registration & identity** (3–4 w) | registration designer (fields, consents with versions, e-mail/phone verification), profile attributes written by workflows (`client.profile.update`), segments/entitlements, step-up, passkeys, in-app inbox + `client.notify` | "sign up → verify → onboard → see my status" without a line of code |
| **M4 Pages** (4–5 w) | page editor (home, products, profile, help), navigation, data widgets bound to connector queries (e.g. accounts from `postgres-datasource`), action buttons (start journey, run whitelisted connector action), languages | a branded client app with a dashboard and self-service |
| **M5 Studio** (3–4 w) | one studio for pages + journeys, preview as persona and on mobile, diff, publish checks, rollback, `experience:*` permissions and a new *Experience designer* role | the full builder |
| **M6 Custom widgets** (4–6 w) | composites library; code widgets: iframe sandbox + `@lintelia/widget-sdk`, `contributes.widgets` in connector manifests, staff approval; business clients (organisations, delegates) | partners and institutions extend the catalogue safely |

If time to market matters more than integration depth, swap M2 and M4 (Option A first): pages are quicker, but
journeys would then be retrofitted onto a page model, which usually costs more later.

---

## 5. The client app definition (sketch)

```yaml
schemaVersion: "1"
name: Demo Bank app
theme: { primary: "#0b3d91", logo: asset:logo.svg, radius: rounded, density: comfortable }
languages: [en, es]
registration:
  methods: [email_code, password, passkey]
  fields: [fullName, phone, dateOfBirth]        # from the profile schema
  verify: [email, phone]
  consents: [{ id: terms, version: "2026-03" }, { id: privacy, version: "2026-01" }]
navigation:
  - { page: home, label: Home, icon: home }
  - { page: products, label: My products, icon: wallet, visibleIf: "'customer' in me.segments" }
  - { page: requests, label: Requests, badge: "= $count(myRequests[status='open'])" }
pages:
  home:
    title: "Hello {{me.firstName}}"
    widgets:
      - { type: hero, text: "What would you like to do?" }
      - type: action-grid
        actions:
          - { label: Open an account, journey: account_opening, visibleIf: "me.kycLevel < 2" }
          - { label: Apply for a loan, journey: personal_loan }   # eligibility is also checked server-side
      - { type: case-list, source: myCases, show: [title, stage, updatedAt] }
  products:
    widgets:
      - type: table
        source: connector:core-banking/accounts.list         # exposed query; client id injected by the server
        columns: [{ field: iban, label: IBAN }, { field: balance, label: Balance, format: money }]
journeys:
  account_opening: { workflow: retail-account-opening, entry: home }   # screens live in the workflow's client.screen steps
```

Workflow side (new fields in the existing YAML):

```yaml
startOn: [client:account_opening]
eligibility: "me.kycLevel < 2"
clientStages: [{ id: details, label: Your details }, { id: identity, label: Identity check }, { id: review, label: Review }, { id: decision, label: Decision }]
clientView: { product: input.product, offer: steps.estimate.maxAmount }
steps:
  - id: details
    type: client.screen
    stage: details
    config:
      screen:                      # designed in the screen editor (stored here, versioned with the workflow)
        title: Tell us about you
        widgets: [{ type: text-input, bind: fullName, required: true }, { type: date, bind: dateOfBirth }]
        buttons: [{ event: continue, label: Continue, primary: true }, { event: save_for_later, label: Finish later }]
    events: [{ name: continue, next: [screening] }, { name: save_for_later, next: [details] }]
```

---

## 6. Runtime architecture

```
Browser (tenant domain)                    API (NestJS)                               Engine / systems
┌───────────────────────┐  GET /me/app     ┌────────────────────────────┐
│ Client app runner     │ ───────────────▶ │ ClientAppService           │  active version, theme, texts, nav
│ (renderer + widgets)  │  GET /me/data/*  │ DataSourceResolver         │──▶ cases, profile, connector queries
│                       │ ───────────────▶ │  (allow-list, scoping)     │
│                       │  POST /me/actions│ ActionGateway              │──▶ start/resume case (signed, as today)
│                       │ ───────────────▶ │  (eligibility, validation, │──▶ connector actions (whitelisted)
│                       │  GET /me/journeys│   audit, rate limits)      │
│                       │  SSE /me/events  │ JourneyService (screens)   │◀── case engine emits "screen ready"
└───────────────────────┘ ◀─────────────── └────────────────────────────┘
```

- **Where it runs**: inside today's web app (`/portal/*`) for M1–M4 (shares the design system and auth); consider a
  separate lean bundle (`apps/client`) later if bundle size or isolation matters (clients should not download the
  back office code; today they do — a lazy route split is enough at first).
- **Fast path for journeys**: when a screen is submitted, the API waits up to ~2 s for the engine to reach the next
  `client.screen` or a waiting state and answers with it; otherwise the runner shows a waiting state and listens on
  SSE. Server-side work between screens (screening, data lookups) stays durable.
- **Save for later / resume**: the case is the journey's state; signing in on another device resumes at the current
  screen (the case id is the journey id).
- **Drafts before sign-up**: anonymous journeys (like today's embedded form) create a draft confirmed by e-mail code,
  then the client account is created — we already do this for forms.

---

## 7. Client identity and account features (checklist)

| Feature | Notes | Milestone |
| --- | --- | --- |
| Registration designed per institution | fields from the profile schema, verification of e-mail and/or phone (SMS fake needed), consents with versions (re-consent on new version) | M3 |
| Sign-in methods | e-mail code (exists), password (exists), passkeys (WebAuthn; virtual authenticator in e2e), social/enterprise SSO for business clients (WorkOS, later) | M3 / M6 |
| Step-up | fresh code before signing, changing e-mail/phone/IBAN; configurable per action | M3 |
| Profile schema | typed attributes (KYC level, customer number, segments, address…), who may write them (client vs workflow only), audit of changes | M1 / M3 |
| Segments and entitlements | drive navigation, eligibility and data access (`verified`, `customer`, `has_loan`) | M3 |
| Inbox and notifications | in-app inbox + e-mail (exists) + SMS later; `client.notify`; preferences | M3 |
| Business clients | organisation, members, roles (owner, signatory, viewer), delegated access, invitations; KYB journeys per organisation | M6 |
| Sessions and devices | list, revoke; new-device alert | M3 |
| Data rights | exists (copy, erasure) — surfaced as a page widget | M4 |
| Languages and accessibility | texts per language in the app definition; WCAG 2.2 AA for every widget | M4 |

---

## 8. Custom widgets

| Tier | What | Who builds | Safety |
| --- | --- | --- | --- |
| 1. Built-ins | ~30 widgets covering content, inputs, data, process, actions | us | reviewed code |
| 2. Composites | an institution saves a group of widgets with parameters as its own widget ("Loan offer card") | institution, in the studio | same as built-ins (config only) |
| 3. Code widgets | HTML/JS served by a connector (or a widget package), rendered in a **sandboxed iframe on its own origin**; the `@lintelia/widget-sdk` passes props, theme, bound data and language in, and sends declared actions and resize events out (postMessage) | partners, vendors, institutions' developers | declared in a manifest (`contributes.widgets`: props schema, data it needs, actions it may call), approved by platform staff like connector versions, CSP, never gets the client's token; data only through bindings the studio shows |

We already run third-party UI this way (connector settings pages and vendor steps in iframes with signed hand-offs),
so tier 3 reuses the connector registry, approval and signing. Web components loaded into our own page are **not**
recommended: same origin, access to the session.

---

## 9. Builder experience (studio)

- Left: pages and journeys (tree); centre: canvas with device switch (mobile / desktop) and live data from a
  **test persona** (a sandbox client with chosen profile/segments and sample cases); right: properties, bindings
  (picker over the allowed data sources, with types), visibility rules, texts per language.
- Journeys: the workflow editor stays the place for the flow; a `client.screen` node opens the screen editor; the
  studio shows journeys as a storyboard (screens in order, branches as arrows) generated from the workflow.
- Publish checks: every binding resolves against a declared source, every action is allowed, journeys point to
  active workflow versions, texts exist in every language, widgets pass accessibility checks (labels, contrast).
- Permissions: `experience:read`, `experience:manage`, `experience:publish` and a new system role *Experience
  designer*; publishing can require a second approval (four-eyes) like high-risk decisions.
- Templates: "Retail onboarding", "Business onboarding (KYB)", "Personal loan", "Document collection", "Customer
  dashboard" — most institutions should start from one.

---

## 10. Testing and operations

- Every widget: unit-rendered in light/dark and on mobile; the screenshot tool (`bun run --cwd apps/e2e screens`)
  gets a "client app" gallery.
- E2E (existing suite style, runnable in the visual mode): register → verify → journey with branches → KYC and
  signature on the fakes → review in the back office → status and decision in the app → self-service action.
- Contract tests: the app definition schema, the data-source allow-list (a screen cannot read what it did not
  declare), eligibility enforced server-side (calling the action directly is refused), `requests_only` workflows
  expose nothing.
- Observability: per-journey funnel (screen reached, abandoned, completed), time per screen, errors per widget.

---

## 11. Risks and how we contain them

| Risk | Mitigation |
| --- | --- |
| Building a generic app builder instead of a banking one | banking-specific widgets and templates first; no arbitrary code outside tier 3 |
| Data leaks through bindings | server-side resolution only, allow-lists per published version, client views instead of case data, e2e contract tests |
| Journey latency (a round trip per screen) | fast path (wait for the next screen), SSE, client-side validation before submit |
| Versions drifting (app vs workflow) | journeys pin the workflow version they start; publish checks; running journeys keep their screens |
| Editor complexity | screen editor reuses the form builder's patterns; storyboard view; templates; preview with personas |
| Accessibility and languages added late | part of the widget contract and publish checks from M1 |

---

## 12. Decisions we need from you

1. **Which option**: C built B-first (recommended), A-first (faster portal, looser integration), or only A or only B?
2. **First journeys to ship as templates** (two or three): e.g. retail account opening, personal loan, document
   collection, address change, card request?
3. **Business clients** (several users per client company, delegates) in scope for v1, or after?
4. **Custom code widgets** (tier 3) wanted, or are built-ins + composites enough for the first year?
5. **Channels**: web only, or also native mobile apps later (the server-driven journey model suits both; pages too)?
6. **Data from the institution's systems** on client screens (accounts, balances, transactions) — via connectors
   (recommended) or via the institution's API pushing data to us?
7. **Languages** needed at launch?
8. **Separate client bundle/domain per app** now, or later?

---

## 13. Decisions (recorded)

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| 1 | Option | **C**, journeys first (foundation → journeys → identity → pages → studio → embedding) | product owner |
| 2 | What to ship first | a **customer banking / money-management app** as the reference app and template: home with balances, accounts and transactions, cards (freeze, report lost), insights (spending by category, budgets), move money between own accounts, open a savings account, apply for a personal loan, update address, contact the bank, applications and requests, notifications, profile, security and privacy | what a bank's customer expects from "the app"; it exercises every piece (pages, journeys, data, actions, reviews, notifications) |
| 3 | Embedding and identity | three ways a client is known, all landing on one client profile: **(a) hosted accounts** (our sign-up/sign-in, as today); **(b) server-created sessions**: the institution's backend (API client, permission `clients:provision`) upserts the client by its own `externalId` and gets a short-lived, single-use `clientSecret` its front end hands to our SDK (the Stripe *AccountSession* / Plaid *link_token* pattern); **(c) token exchange**: the institution's own identity provider issues a JWT for the signed-in customer; we verify it against the issuer's JWKS and map its claims (RFC 8693 style). A **mapping** (JSONata per profile field) turns any input — API payload or token claims — into our profile; matching is by `(source, externalId)`, optionally by verified e-mail. A new profile emits `client.registered`, which starts any workflow with `startOn: [client.registered]` (welcome, KYC). Business clients (several users per company) are **deferred** | industry standard for embedded financial UIs; keeps the institution's identity provider as the source of truth when it has one, and works without one |
| 3b | Embedded UI | **embedded components in an iframe** on the institution's (or our) domain, driven by an SDK: `@lintelia/client-sdk` (vanilla), `/react` and `/react-native` (WebView) entry points, plus a **headless** API client for teams that build their own UI | Stripe Connect embedded components, Plaid Link, Persona: isolation of our session from the host page, one rendering for web and native |
| 4 | Custom widgets | industry standard is a **built-in catalogue + configuration** first (Backbase, Unqork, Retool), **code extensions only in sandboxed iframes** (Shopify app extensions, Salesforce Lightning, Retool custom components). v1: built-ins + an *embedded page* widget (sandboxed iframe limited to allowed origins); SDK-contributed widgets from connectors later | security (no third-party code in our origin), low effort for institutions |
| 5 | Channels | web, hosted by us; native apps only through the React Native SDK (embedding) | product owner |
| 6 | Institution data on client screens | **client records**: a per-client store of typed collections (accounts, transactions, cards, budgets…) fed by the institution's API (push), by workflows (`client.record`) and by connectors; screens read only the collections the published app declares | no synchronous dependency on the core banking system at page load, one security model, auditable, works offline in this environment; live queries through connectors can be added later as a data source |
| 7 | Languages | English | product owner |
| 8 | Domains | yes: the institution proves ownership with a TXT record (exists) and points its chosen host name with a **CNAME to our edge host** (`EDGE_CNAME_TARGET`); the address is shown in *Settings → Domains* | standard for hosted portals (Shopify, Webflow, Zendesk) |
