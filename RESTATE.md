# Running Restate locally

Versions: server **1.7.12** (`@restatedev/restate-server`) with SDK **1.17.2** (`@restatedev/restate-sdk`,
`@restatedev/restate-sdk-clients`). The code was originally written against SDK 1.6.0 / server 1.3.2, which the npm
registry no longer serves; the pair was upgraded together and verified with a one-handler service (a service with
`ctx.run`, a virtual object with state, ingress headers visible through `ctx.request().headers`) before the workflow
code was touched. Both are npm dependencies of `apps/core`, so `bun install` provides them. No Docker needed.

    bun run db:start          # Postgres (the API needs it)
    bun run restate:serve     # ingress :8080, admin :9070, data in apps/core/.data/restate
    bun run dev               # the API serves the endpoint at /restate and registers it on startup

`bun run restate:register` (re)registers `${HOST}/restate` manually (POSTs
`{"uri": "http://localhost:8000/restate", "use_http_11": true, "force": true}` to the admin API).
Set `RESTATE_AUTO_REGISTER=false` to skip registration on API startup.

## How invocations are authenticated

The endpoint is built once (`apps/core/src/handlers/restate.controller.ts`). For every invocation it builds a request
from the invocation headers (`Authorization: Bearer <session token>`, `X-Tenant`, which callers send to the Restate
ingress) or, for calls between services, from the `token`/`domain` fields carried in the input, resolves identity and
tenant with the same rules as HTTP requests, and then resolves the request-scoped service for that invocation.
Authorization/validation errors (HTTP 4xx, 501) become `TerminalError`s so Restate does not retry them forever.

**Ingress exposure**: every handler is `ingressPrivate` (callable only by other Restate services) except
`workflow.start` (members), `workflow.trigger` and `workflow.resume` (members and clients), which check the caller in
`RestateHandler` (`INGRESS_PUBLIC`). Before this, any signed-in user, clients included, could call administrative
handlers such as `roles/createRole` through the ingress (see docs/changes/0002). The ingress should still not be
internet-facing; starting executions will move behind the API.

The `/restate` HTTP route must only be reachable by the Restate server. Outside local development set
`RESTATE_IDENTITY_KEYS` (request signing public keys) so unsigned requests are rejected.

Known limitation: workflow payloads carry the caller's session token to downstream nodes; executions resumed after the
token expired (e.g. a review finished the next day) lose their identity. Durable executions need a service identity
recorded at start; this belongs to the auth/permissions design.

## Vendored 1.3.2 server

`vendor/restate-server-linux-x64-1.3.2.tgz` is the server the code was originally built against. It is no longer used
(the 1.17 SDK is paired with the 1.7.12 server from npm); it can be deleted once nobody needs to reproduce the old
setup. License: Business Source License (see the `LICENSE` file inside the tarball).
