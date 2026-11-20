# Plan 17 — Live data and events: outside data reaching running workflows, screens that update by themselves

Status: **first iteration built** ([changes/0014](../changes/0014-live-data-and-events.md)) — milestones 17.1–17.3 and
the spikes (findings in §5, what was built and what is left in §9); decisions in §8. 17.4 (streams, market data) stays
an illustration; 17.5 later. This document framed the problem and proposed the direction the spikes confirmed. It uses the access rules of
[15](15-access-and-roles.md) and provides the live widgets of [16](16-back-office-app.md) and of the client app.

## 1. What was asked

Two directions, one question each:

1. **Into workflows**: data arrives from outside *without* naming a workflow instance (a payment for loan 123, a price
   change, a document signed somewhere). How does it reach the running instance(s) it concerns and make something
   happen there? Both **push** (webhooks) and **polling** are acceptable.
2. **Out to screens**: how does a UI react when something changes — a balance that must be real-time, stock prices
   later, notifications as they arrive — whoever the user is (a client, any member of the team) and wherever they are
   (the client app, the back office, a custom screen, the institution's own site)? Two shapes were suggested:
   *select an existing listener and push to it*, or *hand the UI an address to listen to beforehand*.

## 2. What exists

| Direction | Today | Limits |
| --- | --- | --- |
| Outside → a known case | `webhook.wait` step + the case's signed hook URL (`POST /hooks/cases/:id/:name?token=…`) or `POST /cases/:id/signals/:name` (`cases:signal`); early signals are kept; deadlines (`case_signals`, AUT-03) | the sender must know **the case** (its URL or id) |
| Outside → new cases | `POST /events` (`api:<type>`), connector events (`connector:<id>/<type>`), platform events (`client.flagged`, `client.registered`) start every workflow whose `startOn` lists them | events only **start** cases: one case per event (e.g. dealer finance opens a *Payment received* case per LoanPro payment); nothing reaches a case already running |
| Workflow → outside systems | outbound webhooks (Standard Webhooks, outbox + Restate dispatcher, retries, delivery log) for a fixed catalogue (`case.*`, `task.*`, `record.updated`…); the HTTP connector calls any API | subscriptions are institution-wide by event type; a workflow cannot send *its own* message to a listener |
| Screens | polling: the client app refetches its data every 15 s (`useAppData`); the back office refetches lists; journeys wait for the next screen by **polling the database every 150 ms for up to 5 s** on the server (`client-apps/runtime.service.ts`) | no push anywhere (no SSE, no WebSocket); "real time" is at best 15 s |
| Infrastructure | Redis (sessions, dedupe), Postgres, Restate; Bun with `idleTimeout: 255` s | — |

## 3. Part A — outside data reaching running workflows

### 3.1 Three ways in, all standard

| Pattern | When | Status |
| --- | --- | --- |
| **Address the instance** (callback URL / signal by case id) | the sender was told about the case (we registered the callback) | exists (`webhook.wait`) |
| **Correlate by business key** (the event names *what it is about*, e.g. `loanId`; the platform finds the instances waiting for it) | events from systems that know nothing about our cases: core banking, LoanPro, card processors, market data | **new** |
| **The workflow polls** (ask the other system every N minutes until a condition holds) | systems without webhooks (a bureau report being prepared, a legacy status API) | **new** (possible today only with a hand-made loop of `wait` + connector + `conditional`) |

Precedents: BPMN message correlation (Camunda 8/Zeebe: message name + correlation key, buffered with a TTL; message
start events), Temporal (signals to a workflow id; `signalWithStart`; workflow id = business key), AWS Step Functions
(task tokens; EventBridge rules), Azure Durable Functions (external events; entities), Restate (awakeables; virtual
objects keyed by business key — our engine already runs on it).

### 3.2 Correlation keys on cases

```yaml
name: Loan servicing
correlation:                      # business keys of the case, indexed while it is open
  loan: "= steps.board.loanId"    # may be set later: keys are (re)computed when the case data changes
  client: "= case.applicant.id"
```

`case_keys (tenant_id, case_id, name, value)` with an index on `(tenant_id, name, value)`; rows removed when the case
ends. `case.update` can add keys explicitly (`keys: { loan: "= …" }`).

### 3.3 `event.wait` — wait for an event about this case

```yaml
- id: first_payment
  type: event.wait
  config:
    event: "connector:loanpro/payment.posted"     # or api:<type>, or a platform event (record.updated, client.profile_updated…)
    match: { loan: "= data.loanId" }              # correlation key of the case ← value in the event
    filter: "data.amount > 0"                     # optional JSONata over the event
    timeout: P40D
    accept: after_start                           # or buffered: an event that arrived up to `buffer` before the step waits counts
  events: [{ name: received, next: [thank_you] }, { name: timeout, next: [chase] }]
```

The event's data becomes `steps.first_payment.*`. It is built on what `case_signals` already does (registration,
early arrival, one lock per case and name, never lost, never twice).

### 3.4 One router for every incoming event

Every event — `POST /events`, connector events, platform events, data changes — goes through one router:

1. **Deliver** to open cases whose waits match (type + key value + filter). Default: every matching case (broadcast);
   `consume: true` on the wait: the first one only (work-queue semantics).
2. **Start** the workflows whose `startOn` lists the type (today's behaviour).
3. **Start or deliver** (`startOn: [{ event: "connector:loanpro/payment.posted", correlate: loan }]`): if an open case
   of this workflow has that key, the event is delivered to it; otherwise a case starts. One servicing case per loan
   instead of one case per payment (Temporal's `signalWithStart`, BPMN message start events with correlation).
4. **Buffer** unmatched events for the longest `buffer` any published wait declares for that type (TTL), so an event
   arriving a second before the case reaches its wait is not lost.

Semantics: at-least-once in (senders retry; events carry an `id`, deduplicated per tenant as today), exactly once into
each case (per-case dedupe by event id), ordered per key by arrival. The router is a Restate service (durable retries,
no lost deliveries on a crash) called by the API after authentication.

### 3.5 Long-lived cases that react to every event (later)

A loan's servicing case lives for years and should react to *each* payment, not wait for one. BPMN calls this a
non-interrupting **event sub-process**:

```yaml
on:
  - event: "connector:loanpro/payment.posted"
    match: { loan: "= data.loanId" }
    next: [receipt]            # a branch that runs for each event, while the main flow continues
```

Needs handlers running concurrently with the main flow of one case (on Restate: a handler per event on the case's
virtual object). Kept for after 3.2–3.4 prove themselves.

### 3.6 `poll` — the workflow asks until a condition holds

```yaml
- id: report_ready
  type: poll
  config:
    every: PT10M                                   # durable timer between attempts (backoff allowed)
    call: { type: "connector:http/request", config: { method: GET, path: "/reports/{{steps.order.id}}" } }
    until: "status = 'ready'"                      # JSONata over the call's result
    timeout: P2D
  events: [{ name: done, next: [read] }, { name: timeout, next: [fallback] }, { name: failed, next: [fallback] }]
```

Any connector step can be the call. The loop runs in the engine (durable timers), not in a connector.

### 3.7 Who may send events

- API clients: a new permission `events:publish` (today `POST /events` needs `cases:create`, which also lets the
  client start any workflow); custom permissions (plan 15) may restrict which event types a client publishes.
- Connectors: their installation token, their own namespace only (as today).
- Unauthenticated callers: only through a capability URL (hook URL) that names one case and one signal (as today).
- Correlation never crosses institutions (RLS), and clients never address cases by business key.
- UIs (a client app button, a back-office action) send **signals to the case in context** through the API
  (plan 16 §5.6), authorised like any action.

## 4. Part B — screens that update by themselves

### 4.1 What "real time" means for each use case

| Use case | Who | Latency | Shape | Volume |
| --- | --- | --- | --- | --- |
| Account balance, transactions | a client (and members looking at that client) | ~1 s | the data changed → show the new value | low per client |
| Notifications | a client; a member (task assigned) | ~1 s, **never missed** | ordered list, replayable | low |
| Journey progress ("checking your ID… done") | the client or member running it | sub-second | ordered messages of one case | a few per case |
| Task queues, case page, pipeline | members | ~1 s | the data changed → refetch | medium |
| Team dashboards | members | seconds, throttled | recompute | medium |
| Market data (stock, FX quotes) | clients and members entitled to it | sub-second | **latest value only** per instrument | high, shared by many |

Three topic kinds cover all of them:

- **invalidate** — "this changed": the UI refetches through the normal, authorised data endpoint (thin event).
- **log** — ordered messages with a sequence, kept for a while, replayable from the last one seen.
- **state** — the latest value; slow subscribers get the newest value only (conflation).

### 4.2 The key choice: notify, then fetch

For anything that contains client or case data, the live message says only **what changed** (`client/42/records/
accounts changed`); the screen refetches it through `/me/app/data` or the back-office data endpoint, which already
apply the allow-lists, scopes and access rules. There is no second data path to secure and keep consistent. Full
payloads travel only on channels a workflow or a connector publishes **on purpose** (progress messages, quotes), and
are authorised when the subscription is made. (Stripe thin events and Firebase/Supabase listeners run into exactly
this: fat payloads duplicate the authorization model.)

### 4.3 Topics and who may listen

| Topic | Published by | Who may subscribe |
| --- | --- | --- |
| `client/{id}/records/{collection}` | records API, connectors, `client.record` | the client; members with `clients:read` and that client in scope |
| `client/{id}/notifications` | `client.notify`, decisions | the client |
| `client/{id}/profile` | profile updates | the client; members as above |
| `case/{id}` | case changes (status, stage, tasks, signals, screens) | the applicant when the case is client-visible; members with case scope (+ `access.cases`) |
| `case/{id}/channel/{name}` | `live.publish` in the workflow | as `case/{id}`, or a capability URL (§4.6) |
| `member/{id}` | tasks assigned, mentions | the member |
| `queue/{role}` | tasks created / claimed in a role's queue | holders of the role |
| `stream/{name}` | connectors, the institution's systems (`POST /streams/{name}/messages`), workflows | per the stream's `access` rule (plan 15; clients: a segment rule) — e.g. market data entitlements |

Subscriptions are authorised when made, again on every reconnect, and closed when the session ends or is revoked.

### 4.4 Publishing

- **Data changes** are published after commit by the services that write them (records, notifications, tasks, cases,
  signals), next to the audit writer that already feeds the webhook outbox in the same transaction.
- **`live.publish`** (workflow step): `to: case | client | member | role | stream | webhook`, `channel`, `payload`,
  `kind: log | state`. `to: webhook` sends the message to **an existing webhook subscription chosen in the editor**
  (Standard Webhooks signature, retries, delivery log): this is the *select an existing listener and push to it*
  option, for systems.
- **Streams**: institution systems (API clients with a new `streams:publish` permission, optionally narrowed to some
  streams by custom permissions) and connectors (their installation token) push to named streams (a market-data
  connector at 1–5 Hz; a fake `market` vendor locally).

### 4.5 Transport

| Option | Verdict |
| --- | --- |
| **Server-Sent Events**, one multiplexed connection per tab: `GET /live?topics=…` | **recommended**: one-way fits every use case above (writes use normal HTTP), works over HTTP/1.1 and 2 and through proxies, reconnects by itself, resumes with `Last-Event-ID` |
| Long polling `GET /live/poll?topics=…&cursor=…` (25 s) | fallback where streaming is blocked; same topics and cursors |
| Periodic refetch (today) | last resort, and what the UI does while it reconnects |
| WebSocket | not needed for one-way updates; revisit for two-way, high-frequency use (trading) |
| Postgres `LISTEN/NOTIFY` as the bus | fine on one node, but 8 KB payloads and a connection per listener; Redis is already here |

Details the spikes must settle:

- **Auth**: `EventSource` cannot send an `Authorization` header. The web app streams with `fetch` (headers allowed);
  the SDK and embedded app use a **single-use, short-lived ticket** (`POST /live/tickets` → `?ticket=`), like the
  client-session secret. Access tokens live 15 minutes: the stream ends with the token and the client reconnects with a
  fresh one (subscriptions re-authorised).
- **Keep-alive**: a comment line every ~20 s (Bun closes idle connections after `idleTimeout`, at most 255 s; proxies
  earlier).
- **Fan-out**: each API process holds its connections and subscribes to Redis pub/sub per tenant; log topics kept in
  Redis Streams (bounded length, e.g. 7 days) for replay; state topics as the last value in Redis. Notifications stay
  durable in Postgres as today (the topic only says "new notification").
- **Limits**: connections per user, topics per connection, messages per second per stream (conflation for state).
- **Port**: a `LiveBus` interface, so a managed hub can replace our endpoint later (AWS AppSync Events / API Gateway
  WebSockets, Azure Web PubSub, Ably, Pusher, or self-hosted Centrifugo / Mercure — whose JWT subscription tokens our
  tickets already mimic). Plan 10 gets a row per provider.

### 4.6 Listening from the start: addresses handed out in advance

This is the *promote the URL beforehand* idea, and it also removes the race between "start" and "listen":

- Starting something from a UI (a journey, a back-office action, `POST /workflows/:id/executions`) answers with the
  case's topics: `live: { topics: ["case/…", "case/…/channel/progress"], url, ticket }`. The UI subscribes
  immediately. Log topics keep their messages, so nothing published before the subscription is lost.
- For UIs we do not serve (the institution's website, a partner portal, a kiosk), the workflow has
  **`case.live.<channel>`**: a capability URL (signed, expiring, read-only, one topic), the mirror of
  `case.hooks.<name>`. The workflow hands it over (HTTP connector, e-mail, the start response of an API call), and
  whoever holds it can listen to that channel and nothing else.

### 4.7 What the screens get

- **Client app**: widgets bound to `records:*`, `notifications`, `cases`, `requests` subscribe to their topics and
  refetch on change (live by default, polling as fallback). The balance updates about a second after the core banking
  system writes it. The notification bell and toasts arrive as they happen. Journeys follow their case topic instead of
  polling the database.
- **Back office**: tasks, queue counters, the case page and the pipeline refresh live; plan 16 adds `live-feed` (a log
  channel) and `live-value` (a state stream, e.g. a quote with its change).
- **SDK** (`@lintelia/client-sdk`): `live.subscribe(topic, handler)` for institutions that build their own UI on the
  headless API.

### 4.8 Two walk-throughs

*Real-time balance.* Core banking → `PUT /clients/{id}/records/accounts/{key}` (exists) → record written, committed →
`client/{id}/records/accounts` invalidated → the open app refetches `/me/app/data` → the new balance shows. No new
data path, no new permission.

*Stock quotes (later).* A market-data connector (fake `market` vendor locally) pushes `stream/quotes/AAPL` several
times a second (`kind: state`). The stream's access rule requires `custom:market.data` (members) or segment
`investor` (clients): exchange data is licensed per user, so entitlement and an audit of subscriptions are part of
the feature, not extras. A `live-value` widget shows the last price; slow connections get the latest value only.

## 5. Spikes (what this exploratory phase did before committing)

| # | Spike | Finding | Kept as |
| --- | --- | --- | --- |
| S1 | SSE through NestJS on Hono on Bun | a `ReadableStream` response streams fine through the Hono adapter and CORS; keep-alive comments keep a stream open past Bun's `idleTimeout` (held 295 s with pings every ~6 s locally); `fetch` streaming carries the `Authorization` header; single-use tickets for `EventSource`; revocation (sign-out) ends the stream within `LIVE_REVALIDATE_MS` | `tests/live/live.api.spec.ts` (LIVE-04) |
| S2 | Live balance | records write → trigger → `NOTIFY` → stream → the banking app refetches: the new balance on screen in about a second, with polling at two minutes | `tests/live/live.ui.spec.ts` (LIVE-01) |
| S3 | Correlation | keys, buffering, dedupe, work-queue delivery, start-or-deliver with events arriving while the case is busy | `tests/automation/events.api.spec.ts` (AUT-08, AUT-09) |
| S4 | Progress channel | `live.publish` from a journey, topics in the start answer, a late listener replays in order; the capability URL | LIVE-03 (API and UI) |
| S5 | Load (one process) | `bun run --cwd apps/core live:load`: 1,000 streams ≈ 10 kB each (5,000: ≈ 4 kB); 100 messages/s fanned out to 1,000 streams (100,000 deliveries/s): p50 47 ms, p95 166 ms; 20/s to 5,000 streams: p50 60 ms, p95 132 ms; ≈ 18 µs of CPU per delivery — the readers' parsing included, HTTP excluded | `apps/core/scripts/live-load.ts` |

## 6. Flows (proposed ids)

| Id | Flow |
| --- | --- |
| AUT-08 | An event about a loan reaches the running servicing case waiting for it (correlation key), early events are buffered, duplicates ignored |
| AUT-09 | Start or deliver: one case per loan receives every payment |
| AUT-10 | A workflow polls a system until a condition holds, with a deadline |
| LIVE-01 | The client app updates balances and notifications as they happen (no reload, polling off) |
| LIVE-02 | The back office's tasks and case page update as the case moves |
| LIVE-03 | A journey shows the progress its workflow publishes; the UI listens from the start |
| LIVE-04 | Who may listen: a client cannot subscribe to another client's topics; a member only to what is in scope; capability URLs give one channel, read-only, until they expire; revocation ends streams |
| LIVE-05 | A workflow message delivered to an existing webhook subscription |
| LIVE-06 | (not built: market data was an illustration) Streams: market data to entitled users only |

## 7. Milestones (after the spikes)

| M | Content |
| --- | --- |
| 17.0 | spikes S1–S5 |
| 17.1 (M) | live invalidation: transport, topics for records / notifications / cases / tasks, client app and back office subscribe; journeys stop polling the database |
| 17.2 (M) | correlation keys, `event.wait`, the router, start-or-deliver, `events:publish`; `poll` step |
| 17.3 (S–M) | `live.publish` (case channels, client, member, role, webhook), topics in start responses, `case.live.*` capability URLs, SDK subscribe |
| 17.4 (M) | streams: publishing API, connector streams, fake market vendor, `live-value` widget, entitlements |
| 17.5 (L) | event handlers in long-lived cases (event sub-processes) |

## 8. Decisions and open questions

1. **Transport**: SSE with long-poll fallback (recommended), or WebSockets from the start?
2. **Thin events by default** for client and case data (recommended), fat payloads only on deliberate channels?
3. **Self-hosted vs managed** fan-out when deployed: keep our endpoint behind `LiveBus` (recommended until the cloud is
   chosen, plans/README decision 4)?
4. **First real-time use case** to build after the spikes: balances and notifications in the client app (recommended:
   visible, low risk, exercises the whole chain), or the back office's queues?
5. **Market data**: a real near-term need (then 17.4 moves up and the licensing questions need an owner), or a
   "later" illustration?
6. **Events from the institution's systems**: move `POST /events` to the new `events:publish` permission (a breaking
   change for existing API clients, with a deprecation period)?

### Decisions (recorded)

| # | Question | Decision |
| --- | --- | --- |
| 1 | Transport | **Server-Sent Events**; polling remains the fallback while a stream is down (no separate long-poll endpoint yet) |
| 2 | Thin events | **yes**: client and case data only say "changed"; payloads only on deliberate channels (`live.publish`) |
| 3 | Self-hosted vs managed | self-hosted behind `LiveHub` for now — the bus is **Postgres `NOTIFY`** (after commit, from triggers) and the messages a table, instead of Redis pub/sub and streams: one dependency less, commit order for free; a managed hub or Redis can replace it behind the same endpoint |
| 4 | First real-time use case | **notifications** (client app and back office) as they arrive; balances, queues, tasks and journeys ride the same chain and were done too |
| 5 | Market data | an **illustration**: 17.4 (streams, entitlements, `live-value`) is not built |
| 6 | `events:publish` | **now, no deprecation period** (not in production): `POST /events` needs `events:publish` — the industry-standard dedicated scope (publishing events no longer implies starting any case) |
| — | Spikes | run as part of the build; each kept as an e2e test or a script (§5) |
| — | Query functions (plan 16 §5.5) | not needed early: generic building blocks first |

## 9. What was built (first iteration) and what is left

Built (docs/changes/0014):

- **Into workflows (17.2)**: `correlation:` keys of open cases (`case_keys`; `case.update` `keys:`), `event.wait`
  (type, keys, filter, timeout, `buffer`, `consume`), one router for API, connector and platform events
  (`inbound_events`, dedupe, delivery exactly once per case, kept for a case until it waits: `case_events`),
  start-or-deliver (`startOn: [{ event, correlate }]`), `poll`, `events:publish`; waits and events on the case page.
- **Out to screens (17.1, 17.3)**: `GET /live` (SSE, one multiplexed stream, tickets for `EventSource`, keep-alive,
  end with the token, revocation, limits), topics and who may listen (§4.3), triggers on records, notifications,
  profiles, cases and tasks; `live.publish` to a case channel, the applicant, a member, a role, a webhook
  subscription (`case.message`); start responses with `live` topics (journeys, back-office actions,
  `/workflows/:id/executions`, `POST /cases`); `case.live.<channel>` capability URLs; the web app (back office: tasks,
  queues, dashboard, case and task pages, cases lists, member and role messages; client app: records, notifications
  as toasts, applications, journeys with their progress; a "Live" indicator) with polling only as a fallback; the
  journeys' and actions' server-side wait for the next screen woken by the case changing; SDK `client.subscribe`.

Left:

1. Event sub-processes in long-lived cases (§3.5, 17.5): today a loop `event.wait → … → event.wait` with events kept
   for the case does the job.
2. Streams and market data (17.4), a `live-feed` / `live-value` widget for the back office and the client app.
3. A long-poll endpoint for networks that block streaming (the web app polls instead meanwhile).
4. Custom permissions narrowing which event types an API client may publish; rate limits per event type.
5. The dealer-finance solution moved to start-or-deliver (one servicing case per loan) — its current one-case-per-
   payment design keeps working.
6. Per-topic replay cursors in the web client (it resumes after the highest sequence seen: a message committed late
   with a lower number is caught by the refetch of the screen, not replayed).
