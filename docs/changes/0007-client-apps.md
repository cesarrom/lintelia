# 0007 — Client apps: an app builder for institutions' clients

Institutions can now give their clients a real app — sign up, sign in, see their products and data, and *do* things
(open an account, move money, freeze a card, apply for a loan, change their address, message the bank) — built
without code in a **studio**, run by their **workflows**, on their own domain, inside their own site or mobile app.
Plan and decisions: [../plans/11-client-experience-builder.md](../plans/11-client-experience-builder.md) (option C,
journeys first; §13 records the decisions). The reference app is a **banking app** (template), which Demo Bank has
published in the local stack.

## Try it (local stack)

| What | Where |
| --- | --- |
| The banking app as an existing customer (accounts, cards, two months of transactions, budgets) | `http://demo-bank.localhost:3001/portal` as `client@demo-bank.test` / `fintivio-dev-password` |
| The studio | `http://demo-bank.localhost:3001/app/experience` as `designer@demo-bank.test` (or `admin@`) |
| Embedded in the bank's own site with the SDK (switch between an existing and a new customer) | `http://localhost:4000/online-banking` (demo site) |
| A new client | sign up on `http://demo-bank.localhost:3001/sign-on?client=1` → "Create account" (terms and privacy notice), then "Open your first account"; approve the KYC review as `analyst@demo-bank.test` |

## What an app is

One **client app** per institution (`client_apps`), edited as a draft and published as immutable versions
(`client_app_versions`; publish, roll back, load a version back into the draft). The definition
(`packages/fintivio/src/schemas/client-app.schema.ts`, shared by API, runtime and studio):

- **pages** made of **widgets** (tree, sections hold children), each with props and an optional `visibleIf` rule;
  a **navigation** (label, icon, `visibleIf`) and a home page;
- **journeys**: a workflow, title, icon, category, **eligibility** (JSONata over the client's profile), **inputs**
  a button may pass, **stages** shown to the client, `hidden` (started by buttons only), a page to show at the end;
- **collections** the screens may read (`records:<key>`), with documented fields;
- the **profile** fields (editable or not by the client), **sign-up** (enabled, methods, fields, consents with
  versions), **identity** (linking by e-mail, the mapping, token exchange), **theme** (primary colour, corners, menu
  style, logo) and **embedding** (allowed sites).

### Widget catalogue (25)

| Group | Widgets |
| --- | --- |
| Layout | section (stack, 2–4 columns, card) |
| Content | hero (greeting, headline figure, illustration), heading, text (bold, links, lists), callout (with a button), image, questions and answers |
| Data | figure, list, table, details (profile, or the record named by the page parameter), chart (doughnut / bars, grouped totals), progress bars (budgets, goals) |
| Banking | account cards, transactions (grouped by day, category icons), payment cards (freeze / unfreeze, report lost) |
| Journeys and requests | quick actions, journey launcher (eligibility applied), button, my applications (stage, progress), requests, notifications |
| Profile | personal details (editable fields), sign-in and security, privacy and data (consents, copy, erasure) |
| Your own content | embedded page (sandboxed iframe, https only) |

Values are literals, `{{ templates }}` (with `| money`, `| number`, `| date`) or `= JSONata`; page expressions read
`me`, `records`, `cases`, `requests`, `notifications`, `journeys`, `params`; item expressions (filters, item titles)
read the item, with `$records`, `$me`, `$params` bound.

## How it runs

- **Runtime** (`apps/web/src/client-app`): one renderer for the live app, the embedded app and the studio's preview.
  When an institution published an app, `/portal` becomes the app (its shell: sidebar on computers, tab bar and "More"
  on phones, notifications bell); without one the classic portal stays. Pages `/portal/p/:page?key=…`, journeys
  `/portal/journeys/:caseId`; the classic case, requests and privacy pages still work inside the app.
- **Data**: `POST /me/app/data { sources }` resolves, for the signed-in client only, the sources the published app
  declares (`me`, `records:<collection>`, `cases`, `requests`, `notifications`, `journeys`); anything else is refused.
  **Client records** (`client_records`, RLS like every tenant table) are written by the institution's systems (records
  API), by workflows (`client.record`) and later by connectors — no synchronous call to the core system at page load.
- **Journeys**: started by `POST /me/app/journeys/:key/start` (eligibility checked by the API, only declared inputs
  kept, `source: client:<key>`); each `client.screen` step becomes a screen (fields: text, e-mail, phone, number,
  money, date, select, choice cards, checkbox, long text, file with the upload intake; options from the client's
  records; prefilled answers); the chosen button is the workflow's next event; answers are checked per field (422
  with field errors) and merged into `input.*` and the case data. Reviews, client requests and connector actions
  (identity verification, signature) work inside journeys; the client sees "we are on it" while the team checks, then
  the result and the journey's last message. Journey cases are ordinary cases in the back office.
- **New workflow components**: `client.screen`, `client.data`, `client.record` (upsert / merge, atomic), `client.profile`
  (attributes, segments, atomic), `client.notify` (in-app notification, optional e-mail).
- **Banking template** (`apps/core/src/client-apps/templates`): nine workflows (welcome on `client.registered`, open a
  first account with ID upload and KYC review, open a savings account, move money with balance checks, freeze /
  unfreeze a card, report a lost card, personal loan with an offer and a review above £10,000, change of address with a
  proof and a review, secure message answered by the team) and the app (home, accounts, account detail, cards,
  insights, open & apply, activity, profile, help).

## Identity

Three ways a client is known, one profile (`client_profiles`: external id and source, attributes, segments, consents)
— details in [../architecture/identity.md](../architecture/identity.md):

- **hosted accounts**: sign-up asks the app's profile fields and consents (enforced, recorded with their version);
- **server-created sessions**: `POST /client-sessions` (API client, `clients:provision`) → single-use, 5-minute
  `clientSecret` → `POST /auth/client/session` (the SDK does it);
- **token exchange**: a JWT of the institution's identity provider (JWKS, issuer, audience) → `POST /auth/client/token`.

A JSONata **mapping** turns the payload or the claims into the profile; a new client emits `client.registered`.
Clients who signed in without the sign-up form (code, the institution's systems, its identity provider) — and
everybody after a new version of the terms — accept the app's required consents in the app before anything else.
The records API (`/clients/:client/records…`, `:client` = id or `ext:<externalId>`) pushes data per client.

## Embedding: `@fintivio/client-sdk`

`packages/client-sdk` (unit tests with jsdom: `bun test`):

- `mount(element, { appUrl, fetchClientSecret | fetchSubjectToken, page, chrome: 'full' | 'none', onEvent, … })`:
  the app in an iframe at `<appUrl>/embed/app`; returns `navigate(page)`, `startJourney(key, input)`,
  `refreshSession()`, `destroy()`. Events: `journey.started`, `journey.completed`, `page.viewed`, `signed-out`.
  `chrome: 'none'` shows content only and sizes the frame to it.
- `@fintivio/client-sdk/react`: `<FintivioApp>`, `<FintivioProvider>`, `useAppData`, `useJourney`.
- `@fintivio/client-sdk/react-native`: `<FintivioAppView>` (WebView bridge).
- headless `createClient({ apiUrl, tenant, fetchClientSecret })` for teams that build their own screens (tokens in
  memory, refreshed; a revoked session signs in again).
- script tag: `<script src="https://<institution host>/fintivio-client.js">` then `FintivioClient.mount(...)` (built
  from the package by the web app).

Security: the app only talks to a host the institution allowed (the same list feeds `frame-ancestors` of
`/embed/app` — served by the Vite dev server locally from `GET /auth/client/embed-policy`; the production web server
or CDN sets the same header, as for hosted forms), checks the sender of every message, keeps its session in the tab's
`sessionStorage`, and asks the host for a new secret when the session ends. The institution's own domain (Settings → Domains: TXT proof + CNAME to
`CUSTOM_DOMAIN_TARGET`) serves the app and the embed.

## Studio (`/app/experience`)

Pages (list, add, rename with reference updates, home, menu entry with icon, label, order and rule) and the widget
outline (select, move in and out of sections, duplicate, remove, add from the searchable catalogue); an inspector
generated from each widget's JSON schema with pickers for pages, journeys, data sources and icons, and the
`Show only when` rule; journeys, data collections and settings (appearance, profile, sign-up, identity, embedding with
the SDK snippet). The **live preview** is the real app in a frame (computer, tablet, phone), with sample data or **as a
real client** (needs `clients:read`, audited); clicking a widget selects it. Validation runs as you type (unknown
pages, journeys and collections, unpublished workflows, JSONata syntax, e.g. `not(…)` instead of `$not(…)`) and
blocks publication; the draft saves itself. Templates: banking, blank.

## Permissions

`experience:read|manage|publish` (flow designer, admin; read for integration managers and auditors),
`clients:provision` and `clients:records` (integration managers, admin). Previewing as a client also needs
`clients:read`. See [../architecture/authorization.md](../architecture/authorization.md).

## Also changed

- Back office client page: "In the client app" card (segments, attributes, consents, records by collection).
- Client tasks carry their `kind`; app screens can only be answered through the app.
- Workflow templates may format values (`{{ x | money }}`); the API route guard gained `@RequireAny`.
- The case engine stops retrying a case whose institution was deleted while it ran (its durable actions fail for
  good instead of retrying forever).
- Profile and record updates are atomic in SQL (attributes merged, segments added/removed, record fields merged):
  workflows, the institution's systems and the client may write at the same time.
- Demo site: `/online-banking` embeds the banking app with the SDK (its backend uses the seeded API client
  `fc_demo_site`); the seed keeps Demo Bank's app up to date with the template while nobody edited it.
- Screenshot tool: the app pages (computer and phone), the studio and the client page with app data.
- Institution colours follow the theme: `brandProps()` gives light and dark values (a dark brand colour is lifted in
  the dark theme, soft tints turn dark) for the sign-on pages, the portal, the client app and embedded forms.

## Tests

New flows `APP-01` … `APP-10` ([../product/flows.md](../product/flows.md)), in `apps/e2e/tests/client-app`:
studio lifecycle and validation, permissions and audited preview (API); data allow-list and isolation, the transfer
journey with field errors and branching, one-tap card freeze, eligibility, onboarding with an ID upload and a review
(API); sign-up with consents, client sessions (single use, per institution, linking by e-mail), records API, token
exchange with the fake OIDC provider (API); the newcomer's onboarding and the customer's everyday banking on a
computer and a phone, the studio end to end, the SDK embed on another site, content-only mode and a refused site (UI).

## Verified

- e2e: 436 passed headless (5.3 min) and 436 passed in the watched visual mode (18.9 min: the studio, the banking
  app on a computer and a phone, the embed on another site, in visible windows), including the 32 new client-app
  tests; flow status: 94 flows, all working ([../testing/flow-status.md](../testing/flow-status.md)).
- `bun test` in `apps/core` (57, of which 16 new: the banking workflows are valid, the banking app validates, app validation,
  template formats) and in `packages/client-sdk` (11: embed protocol, headless client).
- `tsc`: core and e2e clean; web at its previous baseline (203, all in legacy screens); `vite build` emits
  `fintivio-client.js`.

## Not in this version

Business clients (several users per company), passkeys and step-up, live data sources through connectors,
connector-contributed widgets, per-language texts, a journey keeping the app version it started with (it uses the
active definition), drag and drop in the studio (the outline moves widgets).
