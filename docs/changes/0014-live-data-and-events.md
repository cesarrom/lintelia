# 0014 — Live data and events: outside data reaching running workflows, screens that update by themselves

Design, decisions, spike findings and what is left: [../plans/17-live-data-and-events.md](../plans/17-live-data-and-events.md)
(decisions in §8, spikes in §5, what was built in §9). Architecture:
[cases-and-workflows.md](../architecture/cases-and-workflows.md#events-about-a-case-correlation-eventwait-start-or-deliver--docsplans17-3),
[integrations.md](../architecture/integrations.md#live-updates-outbound-to-screens),
[authorization.md](../architecture/authorization.md#who-may-listen-live-updates-docsplans17).

## For designers (workflows)

- **Business keys** (`correlation:` in the workflow; `keys` in *Update case*): what the case is about — a loan, a card,
  a client. Events naming the same value reach the case while it is open.
- **Wait for an event** (`event.wait`): an event about this case (`match: { loan: "= data.loanId" }`), with a filter,
  a time limit, *accept events received up to … before* (`buffer`), and *one case only* (`consume`: a work queue).
  Events come from the institution's systems (`api:<type>`), connectors (`connector:<id>/<type>`) and the platform
  (`client.flagged`, `client.registered`).
- **Start or deliver** (`startOn: [{ event, correlate: { loan: "= data.loanId" } }]`): one case per loan receives every
  payment — the first opens it, the next go to it, even while it is busy.
- **Poll until** (`poll`): call a connector, a function or client data every so often until a condition holds, with a
  time limit — for systems that cannot call back.
- **Send a live message** (`live.publish`): what is happening now, to the screen that started the case (a channel of
  the case, e.g. `progress`: shown in journeys and back-office actions as they run), to the applicant, a member, a
  role's members, or one of the institution's **webhook subscriptions** (chosen in the step: *select an existing
  listener and push to it*). `{{case.live.<channel>}}` is a read-only, signed address of a channel for screens we do
  not serve (*hand the address out beforehand*).
- The case page lists the events a case waits for (and the keys they must name) next to its signals.

## For the institution's systems

- `POST /events` needs the new permission **`events:publish`** (no longer `cases:create`). The answer says which cases
  the event was delivered to and which it started. Same `id` twice: one event.
- Starting a case (`POST /workflows/:id/executions`, `POST /cases`) answers with `live: { topics, url }`: listen from
  the start (`GET /live?topics=…&since=0`); nothing published before is lost.
- `GET /live` streams Server-Sent Events (an API client may listen to cases with `cases:read`); `case.message`
  webhooks carry workflows' messages to one subscription.
- `@fintivio/client-sdk`: `client.subscribe(topics, onEvent)` for your own screens.

## For everyone using the web app

- Pages update by themselves: the banking app's balances and notifications (as toasts), applications and journeys
  (with the progress their workflow publishes); the back office's tasks, queues, dashboard, case and task pages, case
  lists, and messages workflows send to a member or a role. A **Live** dot in the top bar; while it reconnects, pages
  poll as before.

## Under the hood

| Where | What |
| --- | --- |
| `packages/fintivio/src/entities/tenant/events.entity.ts` | `inbound_events`, `case_keys`, `case_event_waits`, `case_events`, `live_messages` (migration `0025_live_events.sql`: RLS forced; triggers `NOTIFY fintivio_live` on client records, notifications, profiles, cases, tasks and live messages) |
| `apps/core/src/engine/events.ts` | keys, waits, deliveries (one advisory lock per event type; exactly once per case), buffers |
| `apps/core/src/services/event-router.ts` | the router: deliver, hand to start-or-deliver cases, start; retention |
| `apps/core/src/engine/components/events.ts` | `event.wait`, `poll`, `live.publish`; `case.update` `keys`; `case.live.<channel>` |
| `apps/core/src/live/{hub,access,topics}.ts`, `handlers/live.controller.ts` | the SSE hub (Postgres `LISTEN`, streams, coalescing, replay, keep-alive, expiry, revalidation, limits), who may listen, topics and capability URLs; `/live`, `/live/tickets`, `/live/cases/:id/channels/:name` |
| `apps/core/src/webhooks/webhook-store.ts` | `case.message` to one subscription |
| `apps/core/src/client-apps/runtime.service.ts`, `back-office/runtime.service.ts` | the wait for the next screen is woken by the case changing; `live` topics in journey and action states |
| `apps/core/scripts/live-load.ts` | `bun run --cwd apps/core live:load [streams] [messages] [rate]` (spike S5) |
| `apps/web/src/lib/live.tsx` | one stream per tab (`fetch` + `Authorization`), subscriptions, replay, `useLive`, `useLiveInvalidate`, `usePollInterval`, `useLiveStatus` (`<html data-live>`) |
| `apps/web/src/components/live/LiveTeam.tsx`, `client-app/live.tsx`, `client-app/JourneyRunner.tsx`, `back-office/runtime.tsx` | what the back office, the client app, journeys and actions listen to |
| `packages/client-sdk/src/client.ts` | `subscribe` |

## Tests

| Id | Where | What |
| --- | --- | --- |
| AUT-08, AUT-09, AUT-10 | `tests/automation/events.api.spec.ts` | events by business key, filter, dedupe, buffer, work queue, a platform event; `events:publish`; start-or-deliver with events while busy; polling until ready, and giving up |
| LIVE-01…05 | `tests/live/live.api.spec.ts` | records and notifications, queues and tasks, case channels replayed and the capability URL, who may listen (denials, tickets, keep-alive, sign-out), messages to a webhook, the applicant and a member |
| LIVE-01…03 | `tests/live/live.ui.spec.ts` | the banking app's balance and a notification, the task queue and a message to reviewers, a journey's progress — with polling at one to two minutes |
| X-02, WH-02 | authorization matrix, `tests/fi-admin/webhooks.api.spec.ts` | `events:publish` for every role; an API client with `cases:create` only is refused |
| — | `apps/core/test/live.test.ts`, `packages/client-sdk/test/client.test.ts` | topics, wildcards, capability tokens, matching, keys, `startOn` rules; the SDK's stream |

## Also

- Breaking: API clients that send events need `events:publish` (integration managers hold it).
- `bun run --cwd apps/e2e screens` no longer waits for "network idle" (pages keep their live stream open).
- Restate's timers stalled once on this machine during the work (cases waiting on `wait` steps never resumed until
  Restate was restarted: `bun run stack:restart restate`); unrelated to this change, worth watching if e2e tests with
  timers start failing together.
