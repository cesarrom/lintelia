# 0003 — Case engine, per-role journeys and UI-level e2e

## What this batch adds

**Infrastructure**
- **Redis** (`bun run redis:start`, `:6380`; a system `redis-server` or a prebuilt binary fetched once into
  `apps/core/.data/bin`): server-side sessions, rotating refresh tokens, one-time codes and secrets, rate limits.
- Migrations `0003`–`0008`: `workflow_versions`, `cases`, `tasks`, `audit_events` (append-only, hash-chained),
  `cases.client_visibility`, `cases.consents`, `data_requests`, `public_form_keys`, `platform_audit_events`,
  `support_grants`, `roles.is_system`, `platform_users.roles` and the `invited` staff status. Every tenant table has
  forced RLS and explicit grants; platform tables are only reachable by `lintelia_platform`.

**Identity and authorization** ([identity.md](../architecture/identity.md), [authorization.md](../architecture/authorization.md))
- 15-minute access tokens bound to Redis sessions, rotating refresh tokens with reuse detection, logout/deactivation/
  password change revoke at once, lockout after 5 failures, e-mailed one-time codes for clients, password reset.
- Permission catalogue (39 tenant permissions, 8 platform permissions), 9 system roles + custom roles, 4 platform
  roles; deny-by-default route guard (`@Require`, `@RequirePlatform`, `@Access`, `@Public`); escalation prevention,
  last-admin protection, no self role changes; case scope, segregation of duties, authority and four-eyes.
- New permission `cases:lookup` (support agents find any client-facing application, never investigations).

**Case engine** ([cases-and-workflows.md](../architecture/cases-and-workflows.md))
- `caseRun` (Restate workflow) executes published versions: calculations and conditions in JSONata, reviews routed to
  roles with SLA escalation, client requests with reminders/expiry, case updates and decisions, branded e-mails.
- Workflow lifecycle: drafts, validation, immutable published versions, templates (loan pre-approval, suspicious
  activity investigation, account opening).
- Cases start from published embedded forms (draft until the applicant confirms the e-mailed code), the API
  (`POST /workflows/:id/executions`), assisted applications (`POST /cases`, confirmed by the client with consent) and
  events (`client.flagged`). The API drives the engine with HMAC-signed calls: no user token reaches Restate.
- `clientVisibility: requests_only` for investigations: the client only ever sees neutral information requests.
- Data-rights requests (export, erasure with legal-retention refusal), consents recorded on cases.

**Platform operations**
- Staff management with platform roles and e-mailed staff invitations, the platform audit log (tenant created,
  suspended, reactivated, deleted; staff invited; support access), two-step offboarding (suspend before delete).
- Support access (Customer Lockbox style): staff request read-only, time-bound access; the institution's
  administrators are e-mailed, approve/deny/revoke; every use is written to the institution's audit log.

**Web app** (everything below is driven by the e2e suite through the browser)
- Session handling (refresh before expiry and after `401`, server logout), "Email me a code" sign-in, password reset
  page, `?next=` return links for clients, toasts (no `Toaster` was mounted before: no toast ever showed).
- Permission-driven navigation; back office: Tasks inbox (my tasks / team queue / all), task page (case data,
  calculations, decisions with reasons, four-eyes, client answers, reassignment), Cases and case page (decisions,
  tasks, hash-chained timeline, evidence export), Clients (flag suspicious activity, start an assisted application),
  Team, Roles (system vs custom, catalogue), Audit log, Data requests, Support access.
- Form builder: click-to-add fields (drag and drop still works), live changes, wider dialog; "Publish & embed" dialog
  (workflow, allowed sites, script/iframe snippets). Workflows: template gallery, publish with validation errors,
  version badges, "start a case".
- Hosted/embeddable form `/embed/forms/:key` + `public/embed.js` (iframe, auto-height, `lintelia:*` DOM events),
  `frame-ancestors` CSP from the API (Vite plugin locally).
- Client portal: my applications, confirm an assisted application with consent, requests (answer), privacy (data
  requests, export download).
- Platform console: institutions (onboard, suspend, reactivate), staff, platform audit log, support access.

## Journeys covered by UI tests (`apps/e2e`, project `ui`)

| Spec | Journey |
| --- | --- |
| `scenarios/loan-pre-approval.ui.spec.ts` (SCN-10) | designer builds the form in the builder, creates the workflow from the template, publishes both, embeds the form on the bank's website (a real server on another origin); the form refuses to render on a site that was not allowed; applicants apply and confirm by code; small loan auto pre-approved and tracked in the portal; mid-size loan approved by a reviewer; > 50,000 needs two senior reviewers (the first cannot give the second approval); unaffordable loan declined |
| `scenarios/suspicious-activity.ui.spec.ts` (SCN-11) | RM flags a client → L1 triage false positive (no e-mail to the client); structuring alert escalated → investigator asks the client for documents (neutral e-mail, nothing in "My applications") → client answers in the portal → referred to the MLRO → SAR filed (high authority), no further e-mail to the client; exit-the-relationship outcome reviewed read-only by the auditor; the flagger cannot see the investigation |
| `fi-roles/assisted-application.ui.spec.ts` (RM-01) | RM prepares a loan application → client follows the e-mail link, signs in with a code, confirms with consent → reviewer approves → RM sees the outcome and the consent in the timeline |
| `fi-roles/reviewer-inbox.ui.spec.ts` (REV-01/02) | claim from the team queue, reason required to reject, approve |
| `clients/apply-embedded.ui.spec.ts`, `clients/sign-in.ui.spec.ts`, `clients/data-rights.ui.spec.ts` (CLI-01/02/03/10, CMP-03) | embedded application, registration, sign-in by code, data export and erasure (declined while an application is open) |
| `fi-admin/team-and-roles.ui.spec.ts` (FIA-04/05) | custom role from the catalogue, invite a reviewer who sees only reviewer areas, deactivation revokes sessions, change a role |
| `staff/platform-console.ui.spec.ts` (STAFF-01/02/03/05/06) | staff sign-in, onboarding, suspend/reactivate, staff invitation with limited roles, support access request → approval → read-only use → revocation → audit |

Results and per-flow status: [../testing/flow-status.md](../testing/flow-status.md).

## Findings fixed along the way

| Finding | Effect | Fix |
| --- | --- | --- |
| `FormsService.list` filtered with `ilike '%undefined%'` when no search was given | the Forms page was always empty | filter only when searching |
| Number fields stored strings while the values schema expected numbers | every form with a number field failed validation ("Expected number, received string") | store numbers |
| No `<Toaster />` mounted | no success/error message was ever shown in the app | mounted in the providers |
| `PUT /roles/:id` required `{ data }`, `PUT /workflows/:id` crashed on workflows without triggers (`values()` with an empty list) | role edits and workflow edits failed (500) | both shapes accepted; empty trigger lists handled |
| Refresh returned the same JWT when called within the same second | refresh tokens rotated but the access token did not change | unique `jti` per token |
| The legacy node engine (`workflow.start/trigger/resume`) journals bearer tokens (request headers and payloads) | session tokens persisted in Restate's journal | `workflow.start` made ingress-private (cases start through the API); `trigger/resume` remain for log-pattern triggers until that engine is retired; the case engine never sees a token |
| Browsers block a public page from loading the hosted form when the page is served from a "public" address and the form from loopback (Private Network Access) | embedding looked broken in tests using `page.route` | the e2e "bank website" is a real local HTTP server (`support/website.ts`) |
| An e-mail belonging to a member could be turned into a client by a form submission or an assisted application | mixed realms | refused (`400`) |

## Security notes

- Clients never see task titles, assignees, internal notes or investigations; the portal shows workflow step names.
- The relationship manager who flags a client does not get to read the investigation (need-to-know); support agents
  look up applications but never investigations; erasure is refused while records must be retained and the client is
  not told why (no tipping-off).
- Public form endpoints: origin allow-list (`X-Embed-Origin` from the iframe, or the caller's `Origin`), CSP
  `frame-ancestors`, rate limiting per form and client address, e-mail confirmation before any workflow runs.
- Both audit trails (institution, platform) are append-only for the application roles and hash-chained.

## Not done yet (next batches)

- **MFA** (TOTP/passkeys for staff and members, FIA-08, STAFF-01 second factor) and **SSO/SCIM** (FIA-06/07): to be
  discussed together (see [identity.md](../architecture/identity.md)).
- **Integrations** (INT-*): connectors, encrypted connections, workflow components (databases, e-mail/SMS providers,
  Didit KYC with the official `@didit-protocol/sdk-web` + session API, Documenso, screening); API clients and signed
  webhooks (FIA-10, X-07); custom domains with ownership verification (FIA-03); related parties (CLI-08/09).
- Support-mode browsing in the web app (today support access works through the API; the console only requests it).
- Retire the legacy node engine (and with it the last tokens in the Restate journal).
- Attachments in client requests (today text answers only).
