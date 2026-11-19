# End-to-end tests

`apps/e2e` holds the persona flows of [../product/flows.md](../product/flows.md) as executable tests
(Playwright Test 1.58): HTTP-level contracts (`*.api.spec.ts`) and **user journeys driven through the web app**
(`*.ui.spec.ts`: each persona in its own browser context, clicking through the back office, the client portal, the
platform console and an embedded form on a separate website). Tests of flows that are not built yet **fail on
purpose**: the suite is also the backlog in executable form. [flow-status.md](flow-status.md) shows where each flow
stands (`flow-status` also updates the status column of the flow catalogue).

## Running the suite

One command, from the repository root:

```sh
bun e2e                                     # make the suite happen: stack, headed/headless, run, flow-status
bun e2e --grep @FIA-04                      # any Playwright argument: a flow…
bun e2e tests/clients/uploads.api.spec.ts   # …a file, --project=api, --retries=1, --list…
bun e2e --headed | --headless               # choose instead of letting it decide
bun e2e --attach                            # only use the running stack (never start anything)
bun e2e --force                             # stop the stack and whatever holds its ports, start it again, run
bun e2e --keep                              # leave a stack this run started running afterwards
bun e2e --help
```

What `bun e2e` does (`scripts/e2e.ts`), printing each decision as it goes (`e2e ›` info, `e2e ⚠` warnings):

| The stack when you run it | What happens |
| --- | --- |
| every service of the e2e profile answers | **attaches** to it (what `--attach` asks for explicitly) |
| nothing answers | starts the whole stack in the background, runs, **stops it afterwards** (`--keep` leaves it) |
| the stack supervisor is still starting services (or restarting a crashed one) | waits for it (90 s for a restart) |
| **partially up** (some services answer, others do not) | **stops with an error** listing what is up and down: it will not guess whether to start the rest next to them or to restart everything. Start the whole stack yourself (`bun run stack --detach`, which reuses what is up; or `bun run stack:stop && bun run stack --detach` when a partial supervisor runs) and re-run, or run `bun e2e --force` |
| `--force` | stops the stack and every process still listening on its ports (dev/ports.json), starts it again from scratch, runs |
| `--attach` and the stack is not fully up | error: start it first (or drop `--attach`) |

- **Headed or headless**: decided for this machine (see [Watching the tests](#watching-the-tests)): visible windows
  when there is a display and a browser with a UI, headless otherwise (CI, SSH, containers). `--headed` insists (and
  fails with the reason when it cannot), `--headless` never opens windows. A run of API tests only (`--project=api`,
  `*.api.spec.ts` files) needs no browser. The decision is handed to Playwright, so it is made once.
- **Warnings** before the run: no Playwright Chromium installed, a busy machine (load above 1.5 per core: consider
  `E2E_WORKERS=2` or `--retries=1`), `E2E_START_STACK` set (ignored).
- **Flow status**: a full run rewrites [flow-status.md](flow-status.md); runs that select tests (files, folders,
  `--grep`, `--project`, `--last-failed`…) leave it alone. Options that only change how tests run (`--retries=1`,
  `--workers`, `--reporter`) keep a run full.
- The exit code is Playwright's. `bun run stack:test`, `bun run e2e:watch` (= `--headed`) and `bun run e2e:headless`
  (= `--headless`) are aliases.

Plain Playwright, against a stack you manage yourself (what `bun e2e` runs underneath):

```sh
bun run --cwd apps/e2e test                 # everything (api + ui projects)
bun run --cwd apps/e2e test:api             # HTTP-level flows only (no browser)
bun run --cwd apps/e2e test --grep @FIA-04  # one flow
bun run --cwd apps/e2e flow-status          # rewrite docs/testing/flow-status.md from the last run
bun run --cwd apps/e2e report               # HTML report with traces of failures
```

- Browsers: `bunx playwright install chromium` once, or point `PLAYWRIGHT_BROWSERS_PATH` at pre-installed browsers
  (offline machines: Playwright 1.58 uses Chromium build 1208). `E2E_CHROMIUM_PATH` overrides the executable.
- **Browser tests run in visible windows when the machine has a screen** (see [Watching the tests](#watching-the-tests));
  otherwise (CI, SSH without a display, `E2E_VISUAL=0`) they run headless exactly as before.
- `E2E_START_STACK=1` (plain Playwright only) makes Playwright start the stack itself (reusing running services).
- The global setup fails fast with instructions when the API, Restate or the seeded staff account is missing, and
  creates the external "core banking" database used as a tenant data source.
- Point the suite elsewhere with `E2E_API_URL`, `E2E_WEB_URL`, `E2E_BASE_DOMAIN`, `E2E_OUTBOX_DIR`, … (`support/env.ts`).
- Timers stall after an overload (timeouts, webhook retries never fire): `bun run stack:restart restate`.

## Watching the tests

When the suite can open browser windows, it does, so a person can follow every journey as it happens. The decision is
made once at the start of the run and printed first:

```
e2e visual mode: on — browser tests run in visible windows (DISPLAY=:1, 1400×814 work area).
  browser Playwright Chromium (/opt/pw-browsers/chromium-1208/chrome-linux64/chrome)
  2×2 tiles at 48% · 1 UI test(s) at a time · 350 ms highlight before each action · slowMo 120 ms · overlay on · run monitor in the last tile
```

```sh
bun e2e                         # auto: headed when possible, headless otherwise
bun e2e --headed                # insist on visible windows (fails with the reason when it cannot)
bun e2e --headless              # never open windows
bun e2e tests/scenarios/suspicious-activity.ui.spec.ts   # watch one journey
bun run stack:doctor            # says whether this machine would run the browser tests headed, and why
```

**When it turns on** (`E2E_VISUAL=auto`, the default): a `test` run that includes the `ui` project, not in CI (`CI`
set) and not in Playwright's own `--ui`/`--debug` modes; a display (Windows and macOS desktops; on Linux `DISPLAY`
with a reachable X server, or `WAYLAND_DISPLAY`); and a browser with a UI: `E2E_CHROMIUM_PATH`, Playwright's
Chromium (not the headless shell), or an installed Chrome/Chromium/Edge. A short probe actually opens a window
off-screen, which catches broken X authorisation or missing GUI libraries; on failure the run stays headless and
says why. `--headed` on the command line behaves like `E2E_VISUAL=1`.

**What you see**

- **One window per persona**, tiled on the screen (2×2 by default, scaled so they fit: on a 1400×850 screen they are
  drawn at ~48%, on 1920×1080 at ~62%). Pages still have the same 1280×720 CSS viewport as headless runs (Chromium's
  `--force-device-scale-factor`), so layouts, breakpoints and locators behave identically. With more personas than
  tiles, windows cascade sideways and the one being used comes to the front. When a worker moves on to the next spec
  file, the windows the previous file left open (persona contexts of beforeAll hooks) are closed.
- **The window in use** has an indigo frame and a heads-up display: spec file and describe, test title, the step
  about to run (`▶ Click getByRole('button', { name: 'Claim' })`, `▶ Fill getByLabel('Email') "ada@…"`, passwords
  and codes masked) and who is signed in there (`👤 reviewer · analyst.1a2b@e2e-….example`). The other windows only
  show who is signed in. The display moves to another corner when the test is about to use what is under it.
- **Before each action** (click, fill, check, select, press, upload, hover…) the target is highlighted with
  Playwright's locator highlight and the run pauses `E2E_VISUAL_DELAY` ms; a red cursor follows the mouse, ripples on
  each press, and fields glow green as they are filled.
- **The run monitor** (last tile): progress of the *whole* run, including the API tests that have no window — what
  each worker is running with its latest step, results as they arrive, failures pinned with their first error line.

**Tuning**

| Variable | Default | Effect |
| --- | --- | --- |
| `E2E_VISUAL` | `auto` | `1` insist (fail with the reason if impossible), `0` headless |
| `E2E_VISUAL_DELAY` | `350` | ms each action's target stays highlighted before the action (0 = no pause) |
| `E2E_VISUAL_SLOWMO` | `120` | Playwright `slowMo`: ms after each click/check/select, to see the result |
| `E2E_VISUAL_WORKERS` | `1` | UI tests at the same time (each gets its own tiles); API tests keep `E2E_WORKERS` |
| `E2E_VISUAL_GRID` / `E2E_VISUAL_SCALE` | fit 4 windows | e.g. `1x1` and `1` for one full-size window at a time |
| `E2E_VISUAL_HUD` | on | `0`: no overlay in the pages |
| `E2E_VISUAL_MONITOR` | on | `0`: no run monitor window; `E2E_VISUAL_MONITOR_HOLD` ms it stays up after the run (4000) |

A watched run is slower: UI tests run one at a time and each action pauses. The full suite takes 8–9 minutes
instead of 3–6 here (API tests run alongside); watched UI tests get twice their usual timeout. Without a GPU the
windows are rendered in software, which is why the overlay avoids blur and endless animations and polls the runner
slowly in the windows not in use.

**What it does not change**: viewport, device scale seen by pages, locators, assertions, auto-waiting and the DOM the
app owns. The overlay lives in a closed shadow root outside `<body>` with `pointer-events: none` (invisible to
locators, focus traps and hit-testing) and is styled through CSSOM, which strict CSPs allow. Calls made only for the
show (highlight, window placement, bring to front) are internal, so reports and traces are the same as a headless
run. Failure screenshots include the overlay.

**Watching a machine without a desktop**: give it a virtual display and look at it remotely, e.g.
`Xvfb :99 -screen 0 1920x1080x24 & x11vnc -display :99 -forever -nopw &` then `DISPLAY=:99 bun e2e` and connect a
VNC viewer to port 5900 (keep it on a trusted network or tunnel it over SSH).

**How it works** (`apps/e2e/support/visual`): `detect.ts` decides in the runner and hands the settings to the workers
through an environment variable; `probe.mjs` is the headed launch probe; `runtime.ts` instruments every browser
context a test creates (the `page` fixture, persona contexts, beforeAll hooks), places windows and previews actions;
`overlay.ts` is the in-page overlay; `monitor.ts` + `monitor-page.ts` are the run monitor (a reporter). Specs import
`test`/`expect` from `support/test.ts`, which adds these fixtures; they do nothing when visual mode is off.
Verified on Linux/X11 (Xvfb + mutter). On macOS and Windows the detection and window placement use the same
Chromium/CDP paths but have not been run here.

## Layout and conventions

```
apps/e2e
├── playwright.config.ts      projects: api (*.api.spec.ts), ui (*.ui.spec.ts, Chromium; headed when watchable)
├── fixtures/workflows        workflow definitions of the banking scenarios (target component names)
├── support                   api client, factories, mailbox, scenario helpers, fakes, totp, catalog,
│                             ui (persona pages, queue/decision helpers, embedded forms), website (fake bank site),
│                             client-app (banking template, API clients, banking customers, journeys, fake IdP tokens),
│                             test.ts (the suite's test/expect), visual/ (watching the tests)
└── tests
    ├── staff/                STAFF-*
    ├── fi-admin/             FIA-*
    ├── fi-roles/             DES-*, REV-*, SUP-*, CMP-*, RM-*, AGT-*, INT-*, AUD-*, authorization matrix (X-02)
    ├── clients/              CLI-*
    ├── client-app/           APP-* (the client app: studio, banking app journeys, identity, SDK embedding)
    ├── back-office/          BOA-* (the institution's own back office: studio mode, gating, actions, staff screens)
    ├── automation/           AUT-* (stages, functions, signals, connectors, events by business key, polling)
    ├── live/                 LIVE-* (live updates: streams, who may listen, workflows' messages)
    ├── cross-cutting/        X-*
    └── scenarios/            SCN-* (banking stories across personas)
```

- Specs import `test` and `expect` from `support/test.ts`, not from `@playwright/test`: it is Playwright's, plus the
  fixtures of the visual mode (a spec importing Playwright's directly still opens headed windows, but they are not
  tiled and have no overlay).
- Every `describe` carries its flow id as a tag (`{ tag: ['@reviewer', '@REV-01'] }`); a test may carry several ids.
- Tests are **black-box**: they go through the public API/UI like the personas would. The owner database connection
  is only used to prepare the environment and for white-box *security* assertions (grants on the audit table,
  secrets not stored in clear text). `support/catalog.ts` restates the authorization spec instead of importing the
  implementation, so docs/code drift shows up as failures.
- Isolation: each file onboards its own institution through the real staff flow (`createTenant`) and deletes it at the
  end (suspend, then delete). Files run in parallel (4 workers); tests in a file run in order.
- E-mail is read from the outbox (`EMAIL_PROVIDER=outbox`) with `waitForEmail`; links and one-time codes are taken
  from the message like a person would.
- Contracts the tests use that do not exist yet are listed in the architecture docs (API tables); they are the
  target, and can be changed together with the tests.
- When MFA becomes mandatory by default (FIA-08), the factories will enrol TOTP for the accounts they create.

### UI journeys

- `personaPage(browser, tenant, session, path)` opens a separate browser context per persona (sessions are injected:
  only tests about signing in use the sign-in form). Locators are user-facing (roles, labels, visible text);
  `data-testid` is used for rows and values (`task-row`, `case-status`, `timeline`…).
- `FakeWebsite` (`support/website.ts`) is a real HTTP server on another loopback origin that serves the institution's
  website with the embed snippet pasted in, so browsers apply their real cross-origin rules (CSP `frame-ancestors`,
  private network access) — `page.route` would not.
- Multi-persona journeys are serial within a file and get a 120 s timeout (several contexts; slower when the whole
  suite runs in parallel). Asynchronous work (durable executions, e-mails) is awaited through the UI (auto-refreshing
  lists) or `waitForEmail`, never with fixed sleeps.

## Expected failures

A failing test must fail **for the reason it describes** (missing endpoint, rule not enforced, fake not running),
never because of the harness. Typical messages today:

| Message | Meaning |
| --- | --- |
| `HTTP 404: Cannot POST /integrations` | endpoint not built |
| `Fake "didit" is not running at http://localhost:9401` | the local fake for that vendor is not built yet |
| `HTTP 200` where `403` was expected | a rule (authorization, SoD, escalation) is not enforced yet |

## Fakes

External systems are replaced by local fakes that follow the vendors' contracts: `fake-services/<name>`, small Bun
servers built on `packages/fake-kit`, started by `bun run stack` (ports in `dev/ports.json`). Each has:

- `GET /__health`, `GET /__control/requests`, `POST /__control/reset`,
- `/__control/*` to set the next outcome and read what it received (`support/fakes.ts`: `requireFake`,
  `controlFake`, `fakeRecords`),
- the vendor-facing API the platform (or a connector) calls, and the webhooks/callbacks the vendor would send.

| Fake | Port | Used by | Contract and controls |
| --- | --- | --- | --- |
| Mailbox | 8025 (SMTP 1025) | every e-mail; INT-04 (as the bank's SMTP server) | `smtp-server` + web inbox; `GET /api/messages?to=`; the password `wrong` is refused |
| WorkOS emulator | 9300 | FIA-06, FIA-07, staff SSO | organizations, domains (DNS TXT via `/__control/dns`), Admin Portal pages, SSO authorize/token, SCIM directories, events; the real `@workos-inc/node` SDK talks to it |
| OIDC identity provider | 9400 | SSO | discovery, JWKS, login form (`login`/`password`), RS256 ID tokens with `groups`/`amr`; `/__control/clients`, `/__control/users` |
| Didit | 9401 | SCN-01/02/03/07/09, CLI-04, CLI-08 | sessions, decisions, hosted page speaking the web SDK's postMessage protocol, signed webhooks; `/__control/decisions` per applicant e-mail (`Approved`, `Declined`, `In Review`, `Abandoned` = never completes) |
| Documenso | 9402 | SCN-01, CLI-06 | v2 API subset from `docs/vendor-api/documenso-openapi-v2.json`, signing page, webhooks; `/__control/signatures` per signer |
| Webhook receiver | 9404 | X-07, WH-01/02 | records deliveries per path, verifies Standard Webhooks signatures (`/__control/secrets`), `/__control/fail-next`, `/__control/respond` |
| Screening | 9407 | SCN-05, CMP-01 | `POST /v1/searches`; `/__control/results` per subject name |
| DNS | 9408 | FIA-03 | DNS-over-HTTPS JSON `/resolve`; `/__control/records` |
| LLM | 9409 | AUT-05, SCN-12 | OpenAI-compatible `/v1/chat/completions`, `/v1/models`; structured extraction reads `Label: value` lines (deterministic); keys ending in `invalid` refused; `/` lists completions |
| LoanPro | 9410 | AUT-06, SCN-12 | OData-style `Customers`, `Loans` (create, activate, payments, `$expand`); signed webhooks (`X-LoanPro-Signature`); `/__control/webhooks`, `/__control/loans/:id/pay \| delinquent \| payoff`, `/__control/loans`; `/` with buttons per loan |
| QuickBooks Online | 9411 | SCN-12 | per company (realm): `query` (vendors), `vendor`, `bill`, `billpayment`; `/__control/companies/:realm`; `/` shows the books |
| Google Sheets | 9412 | AUT-04, SCN-12 | `values:append`, `values` read; `/__control/spreadsheets/:id`; `/` shows every sheet |
| Malware scanner | 9501 | UPL-02 | flags the EICAR test string; `/__control/fail-next` |
| Sanitiser | 9502 | UPL-04 | rebuilds PDFs without active content, strips image metadata; `/__control/fail-next` |

The external **core banking database** is real: `fi_core_banking` on the embedded Postgres with tables `customers`,
`accounts`, `credit_scores` and a read-only login `core_banking_reader` (created by `support/global-setup.ts`), used
through the `postgres-datasource` connector. Connectors (`integrations/*`) run as real services against these fakes.

## Tooling decisions

| Need | Choice | Why |
| --- | --- | --- |
| e2e runner | Playwright Test | one runner for API and browser flows, traces, tags, parallelism; industry default |
| Browser | Chromium (Desktop Chrome profile) | Firefox/WebKit can be added as projects later |
| TOTP in tests | `support/totp.ts` (RFC 6238, 20 lines) | avoids a dependency for code generation |
| Passkeys in tests | Chromium virtual authenticator (CDP `WebAuthn.addVirtualAuthenticator`) | no hardware needed |
| SSO in tests | WorkOS emulator + a small OIDC IdP fake (SAML fake planned) | offline, same SDK as production, no Keycloak/containers |
| E-mail in tests | the local mailbox (SMTP + REST) | the API sends real SMTP; tests read `GET /api/messages` |
| Second factors | the suite enrols TOTP like a person and computes codes; one staff session per run (`.auth/`) | codes are single-use per 30 s window |
