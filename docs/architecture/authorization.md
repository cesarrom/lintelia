# Authorization model

Status: **implemented** for tenant and platform permissions, system and custom roles, escalation prevention, case
scope, segregation of duties, authority and four-eyes (see [0003](../changes/0003-case-engine-and-journeys.md)), and
since [0012](../changes/0012-access-control.md): the institution's **custom permissions** and system-role extensions,
**access rules** on workflows (who may start them, who may see their cases), **roles from the identity provider**,
**member attributes** and conditions, **time-bound roles**, **change control** (notifications, a second approver,
effective dates) and **staff recovery** — see [§ Who sees what](#who-sees-what-docsplans15). Still planned: teams,
access-review campaigns (the export exists), the back-office screens of plans/16 using the same rules. The catalogue
lives in `packages/fintivio/src/schemas/authorization.schema.ts` (shared by API and web app).

## Principles (industry baseline)

| Principle | Source / precedent | What it means here |
| --- | --- | --- |
| Deny by default | OWASP ASVS V4, NIST SP 800-53 AC-3 | every route and Restate handler declares the permission it needs; undeclared = refused |
| Least privilege | NIST AC-6, ISO 27001 A.5.15 | system roles grant only what the job needs; admin is for administration |
| Role-based access with fine-grained permissions | NIST RBAC (INCITS 359), GCP IAM / Auth0 / Okta custom roles | permissions are `resource:action`; roles are named sets of permissions; users get roles |
| Attribute conditions on top of roles | NIST ABAC (SP 800-162), AWS IAM conditions, Cedar | case scope (mine/team/all), risk level, amount, who initiated a case |
| Segregation of duties, four-eyes (maker-checker) | Basel operational risk, FFIEC, SOX, EBA guidelines | no one approves their own work; high-risk decisions need a second, different approver |
| No privilege escalation | Kubernetes RBAC escalation prevention, AWS permission boundaries | you can only grant permissions you hold; only admins assign `admin` |
| Separate tenant boundary enforcement | defence in depth | tenant isolation stays in Postgres row level security; permissions are checked in the API on top |
| Customer-approved operator access | Microsoft Customer Lockbox, Google Access Approval | platform staff see tenant data only through an approved, time-bound, audited support grant |
| Everything auditable | PCI DSS 10, SOC 2 CC7 | grants, denials of privileged actions and every decision land in the append-only audit log |

## Model

```
principal ──has──▶ role assignments ──▶ roles ──▶ permissions (resource:action)
    │                                                   │
    └── attributes (kind, tenant, teams)                └── checked with conditions on the resource
                                                           (case scope, initiator, risk, amount, state)
```

- **Principals**: platform staff, FI members, clients, API clients (machine credentials), workflow executions.
- **Scopes**: permissions are either *platform* (`platform.*`, only for staff) or *tenant* (everything else, only
  inside one tenant). A role can never mix both.
- **Roles**: *system roles* are defined by the platform, cannot be edited or deleted, and evolve with releases
  (like GCP predefined roles). *Custom roles* are defined by an FI from the tenant catalogue. Role keys are stable
  identifiers used by workflows (`assignTo: { role: reviewer }`) and SSO/SCIM group mappings.
- **Decision API**: one function, `authorize(principal, action, resource?, context?)`, shaped like Cedar/AWS Verified
  Permissions requests (principal, action, resource, context) so the engine can be externalised later without
  changing call sites.

### Tenant permission catalogue

| Permission | Allows |
| --- | --- |
| `workspace:read` | see the institution profile, branding and settings |
| `workspace:update` | change profile, branding, working hours |
| `domains:manage` | add/verify/remove custom domains |
| `security:manage` | SSO connections, MFA and session policy, SCIM tokens |
| `members:read` | list members and their roles |
| `members:invite` | invite members |
| `members:update` | change members' details and role assignments (subject to escalation rules) |
| `members:deactivate` | deactivate/reactivate members, reset their credentials |
| `roles:read` | see roles and the permission catalogue |
| `roles:manage` | create, change and delete custom roles |
| `clients:read` | see client profiles (PII) in scope |
| `clients:update` | contact notes, resend links, update contact details |
| `clients:provision` | register clients from the institution's systems and open their sessions for the embedded app (`POST /client-sessions`), update their app profile |
| `clients:records` | write the records clients see in the client app (`PUT /clients/:client/records/…`) |
| `experience:read` / `experience:manage` / `experience:publish` | see / edit the draft / publish and roll back the client app (studio, docs/plans/11) |
| `backoffice:read` / `backoffice:manage` / `backoffice:publish` | see / edit the draft / publish and roll back the institution's own back office (studio's back-office mode, docs/plans/16) |
| `forms:read` / `forms:manage` / `forms:publish` | see / edit / publish and embed forms |
| `workflows:read` / `workflows:manage` / `workflows:publish` | see / edit drafts / publish versions of workflows |
| `templates:manage` | e-mail and document templates |
| `variables:read` / `variables:manage` | workspace variables |
| `integrations:read` | see connections (never secrets) |
| `integrations:manage` | create/update/delete connections and their secrets (write-only) |
| `integrations:use` | reference connections in workflows |
| `api_clients:manage` | create/revoke API client credentials |
| `webhooks:manage` | outbound webhook subscriptions |
| `cases:read` | see cases in scope (assigned to me, in my queues, or that I started) |
| `cases:read_all` | see every case of the institution |
| `cases:lookup` | look up any client-facing application (never investigations) to help the client, e.g. support agents |
| `cases:create` | start an application on behalf of a client (assisted onboarding) |
| `cases:signal` | signal a running case from the institution's systems (`POST /cases/:id/signals/:name`: a `webhook.wait` step continues) |
| `events:publish` | send events from the institution's systems (`POST /events`): they reach the cases waiting for them and start the workflows listening to them (docs/plans/17) |
| `tasks:work` | claim and decide tasks routed to me: approve / reject / request information, within authority |
| `tasks:assign` | reassign tasks, manage queues |
| `cases:approve_high_risk` | decisions above the authority threshold and second approvals |
| `screening:adjudicate` | resolve AML/sanctions/PEP screening hits |
| `cases:export` | export a case evidence pack |
| `audit:read` / `audit:export` | read / export the audit log |
| `data_requests:manage` | handle clients' data-export and erasure requests |
| `support_access:approve` | approve or revoke platform support-access requests |

### System roles (tenant)

✓ = granted. `admin` holds every tenant permission.

| Permission | admin | compliance_officer | senior_reviewer | reviewer | relationship_manager | flow_designer | integration_manager | support_agent | auditor |
|---|---|---|---|---|---|---|---|---|---|
| workspace:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| workspace:update | ✓ | | | | | | | | |
| domains:manage, security:manage | ✓ | | | | | | | | |
| members:read | ✓ | ✓ | ✓ | | | ✓ | | | ✓ |
| members:invite, members:update, members:deactivate | ✓ | | | | | | | | |
| roles:read | ✓ | ✓ | | | | ✓ | | | ✓ |
| roles:manage | ✓ | | | | | | | | |
| clients:read | ✓ | ✓ | ✓ | ✓ | ✓ (own) | | | ✓ | ✓ |
| clients:update | ✓ | ✓ | | | ✓ (own) | | | ✓ | |
| clients:provision, clients:records | ✓ | | | | | | ✓ | | |
| experience:read | ✓ | | | | | ✓ | ✓ | | ✓ |
| experience:manage, experience:publish | ✓ | | | | | ✓ | | | |
| backoffice:read | ✓ | | | | | ✓ | | | ✓ |
| backoffice:manage, backoffice:publish | ✓ | | | | | ✓ | | | |
| forms:read | ✓ | ✓ | ✓ | ✓ | | ✓ | | | ✓ |
| forms:manage, forms:publish | ✓ | | | | | ✓ | | | |
| workflows:read | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | | ✓ |
| workflows:manage | ✓ | | | | | ✓ | | | |
| workflows:publish | ✓ | ✓ | | | | ✓ | | | |
| templates:manage | ✓ | | | | | ✓ | | | |
| variables:read | ✓ | | | | | ✓ | ✓ | | ✓ |
| variables:manage | ✓ | | | | | ✓ | | | |
| integrations:read | ✓ | ✓ | | | | ✓ | ✓ | | ✓ |
| integrations:manage | ✓ | | | | | | ✓ | | |
| integrations:use | ✓ | | | | | ✓ | ✓ | | |
| api_clients:manage, webhooks:manage | ✓ | | | | | | ✓ | | |
| cases:read | ✓ | ✓ | ✓ | ✓ | ✓ (own) | | | ✓ | ✓ |
| cases:read_all | ✓ | ✓ | ✓ | | | | | | ✓ |
| cases:lookup | ✓ | | | | | | | ✓ | |
| cases:create | ✓ | ✓ | | | ✓ | | | | |
| cases:signal | ✓ | | | | | | ✓ | | |
| events:publish | ✓ | | | | | | ✓ | | |
| tasks:work | ✓ | ✓ | ✓ | ✓ | | | | | |
| tasks:assign | ✓ | ✓ | ✓ | | | | | | |
| cases:approve_high_risk | ✓ | ✓ | ✓ | | | | | | |
| screening:adjudicate | ✓ | ✓ | | | | | | | |
| cases:export | ✓ | ✓ | | | | | | | |
| audit:read | ✓ | ✓ | | | | | | | ✓ |
| audit:export | ✓ | ✓ | | | | | | | ✓ |
| data_requests:manage | ✓ | ✓ | | | | | | | |
| support_access:approve | ✓ | | | | | | | | |

The migration renames today's permission ids (`workflows:view` → `workflows:read`, `users:*` → `members:*`,
`reviews:*` → `tasks:*`/`cases:*`, `logs:view` → `audit:read`) and drops the pseudo-permissions `admin` and
`super_admin` (replaced by the `admin` system role and the platform scope).

### Platform permissions and roles

| Permission | platform_admin | customer_success | support | platform_auditor |
|---|---|---|---|---|
| platform.tenants:read | ✓ | ✓ | ✓ | ✓ |
| platform.tenants:create, platform.tenants:update | ✓ | ✓ | | |
| platform.tenants:delete | ✓ | | | |
| platform.staff:manage | ✓ | | | |
| platform.support_access:request | ✓ | | ✓ | |
| platform.audit:read | ✓ | | | ✓ |
| platform.connectors:manage | ✓ | | | |
| platform.tenants:recover | ✓ | | | |

Routes that accept either of two permissions use `@RequireAny(...)` — e.g. reading a client's app records needs
`clients:read` (the team) or `clients:records` (the system that writes them). Previewing the client app as a real
client needs `clients:read` on top of `experience:read` and is audited (`client_app.previewed`).

## Who sees what (docs/plans/15)

Implemented in `apps/core/src/access/` ([0012](../changes/0012-access-control.md)).

| Piece | Rule |
| --- | --- |
| Custom permissions | `custom:<key>` (never shadows a built-in id), created by `roles:manage` or `workflows:manage` holders, held by nobody but `admin` until a role holds it; archived (never deleted): archiving removes it from every role and API client at once |
| System-role extensions | system roles keep the catalogue's permissions (immutable, evolve with releases) and may add custom permissions; the Administrator role holds every custom permission and cannot be extended |
| Resolution | per request: active assignments (`expires_at` in the future or none) → roles → catalogue + extensions + active custom permissions; API clients lose archived custom permissions at once |
| Access rules | `{ permissions (all of), roles (one of), when (JSONata over member and context) }`; a failing or erroring condition denies; one evaluator (`access/rules.ts`, static part shared in `packages/fintivio`) |
| Workflow access | `access.start` replaces `cases:create` for that workflow (routes `@Access('member','api_client')` + the rule in the service: startable list, executions, assisted cases); `access.cases` narrows case scope (also for `cases:read_all`) and hides the cases' tasks; governed by the latest published version; publishing a change of it is an access change an administrator decides |
| Roles from the IdP | as soon as single sign-on is linked (a verified domain), people of that domain hold exactly the roles their groups map to (`group name → role`, case-insensitive, SSO ID-token groups and SCIM directory groups; the just-in-time default roles when none maps), from the first time the IdP tells us about them; manual assignment and invitations with roles are refused for that domain; without single sign-on, roles are managed in the app; members outside the SSO domains (emergency administrators, consultants) keep manual roles; assignments record their `source` (`manual`, `idp`, `default`, `recovery`) and groups |
| Member attributes | declared per institution (text, number, select, list), set by hand or read from the IdP (JSONata over SSO claims / SCIM attributes, read-only in the app); conditions read `member.attributes.*` |
| Time-bound roles | `expires` per assignment; ignored after the date, removed and audited (`member.role_expired`) by the periodic job |
| Change control | privileged changes (role definitions, role assignments and invitations with roles, IdP mappings, workflow access, the approval policy) are `access_changes`: audited, e-mailed to administrators when they matter, optionally scheduled (`effectiveAt`), and — with `accessApproval: grants` — grants wait for a second administrator (7 days), who must pass the same checks as if making the change (no self-approval, no approving one's own elevation); revocations never wait; re-validated as the requester when applied |
| Soft-lock guards | last active admin kept (by hand, by mappings, by syncs: kept + `member.role_sync_blocked` + e-mail); syncs keep the Administrator role while no group maps to it; a mapping change leaving no active admin is refused; a second approver needs two possible approvers (and applies with a notice when none is left); staff recovery as the last resort |

| Route | Permission |
| --- | --- |
| `GET /permissions` | any member (built-in + custom, archived marked) |
| `POST /permissions/custom`, `PUT/DELETE /permissions/custom/:key`, `POST …/restore` | `roles:manage` or `workflows:manage` (create); `roles:manage` |
| `PUT /roles/:key` with `customPermissions` on system roles | `roles:manage` |
| `GET /roles/:key/members`, `/roles/:key/usage`, `/access/matrix`, `/access/who`, `/users/:id/access`, `/access/export` | `roles:read` (+ `members:read`) |
| `GET /access-changes`, `/access-changes/:id`; `POST …/approve`, `…/reject`, `…/cancel` | `roles:read`, `security:manage` or `audit:read`; deciding: the kind's approver permission (`roles:manage`, `security:manage` for SSO and the policy) |
| `GET/PUT /sso/role-mappings`, `POST /sso/role-mappings/preview` | `security:manage` (mappings: only roles the editor could assign) |
| `GET/PUT /member-attributes`, `PATCH /users/:id/attributes` | `members:read` / `members:update` |
| `PUT /security/policy` `{ accessApproval, accessNotify }` | `security:manage` (switching approval off waits for a second administrator) |
| `POST /platform/tenants/:key/recover-access` | staff with `platform.tenants:recover` |

Change-controlled routes answer as before when the change applies at once, and `202 { pending, status, change }` when it
waits for an approver or its date.

## The institution's own back office (docs/plans/16)

Implemented in `apps/core/src/back-office/` ([0013](../changes/0013-back-office.md)). Every item of the definition —
page, widget, action, menu item, button or tab on a built-in page, home — may carry an access rule (same evaluator as
above; the member, and the client or case of the page, in the condition's scope).

| Step | Rule |
| --- | --- |
| Serving | `GET /backoffice/app` is the published definition **pruned for the member**: items whose rule fails, actions whose workflow the member may not start (`access.start`), and every reference to a pruned item are removed on the server; their names never reach the browser |
| Data | `POST /backoffice/data` resolves only the sources the page reads (computed from its widgets), each under the member's permissions (`cases` → `cases:read` and case scope ∩ workflow `access.cases`; `tasks` → `tasks:work` / `tasks:assign`; `client`, `records:*` → `clients:read`); a source the member cannot read is left out (the widget is empty), never an error; a page about a client or a case first checks that record |
| Actions | `POST /backoffice/actions/:key`: the action's rule with the page's record in scope, then the workflow's start rule; inputs from the context by the action's templates, from the button only for the keys it allows; the case records `initiatedBy` the member and `source: backoffice:<action>` |
| Staff screens | `team.screen` to the member who ran the action (only they may send it) or to a role's queue (members of that role who see the case); answers checked as client screens; recorded as task decisions |
| Studio | `backoffice:read` sees the draft, the access report and previews as roles (`roles:read` too); `backoffice:manage` edits; `backoffice:publish` publishes and rolls back; a template that creates a workflow needs `workflows:manage`, and the workflow's publication is an access change |
| Read auditing | optional (`tenant_security_policies.read_audit`, *Settings → Security*): each page about a client a member opens adds `client.viewed` |

A definition cannot raise privileges: it shows what the member could already read and starts what they could already
start; the only grant involved is a workflow's `access.start`, decided by an administrator.

## Who may listen (live updates, docs/plans/17)

Decided when a stream opens (and again at every reconnection; a stream ends with its token and when its session is
revoked). Listening never carries data the listener could not fetch: changes are thin, messages are what a workflow
chose to send to that audience.

| Topic | Who |
| --- | --- |
| `client/{id}/records/…`, `/profile`, `/cases` | the client; members and API clients with `clients:read` |
| `client/{id}/notifications`, `/messages` | the client only |
| `case/{id}`, `case/{id}/channel/{name}` | the applicant when the workflow shows the case to clients (`clientVisibility: full`); members who may see the case (case scope and the workflow's `access.cases`) or who started it; API clients with `cases:read`; a channel's signed address (read-only, one channel, until it expires) |
| `member/{id}`, `member/{id}/messages` | that member |
| `queue/{role}`, `queue/{role}/messages` | members holding the role |
| `cases` | members with `cases:read` (something changed: lists refetch in scope) |

## Conditions (the attribute layer)

| Rule | Applies to | Behaviour |
| --- | --- | --- |
| Case scope | `cases:read` | without `cases:read_all`: cases assigned to me, decided by me, in a queue of one of my roles, or that I started (not those opened by an event I raised, e.g. the investigation after I flagged a client: need-to-know); with `cases:lookup`: any client-facing application, never investigations |
| Self-approval ban | `tasks:work` decisions | the member who started a case cannot decide its tasks (maker ≠ checker) |
| Four-eyes | positive outcomes of tasks with `authority: high` (set by the workflow, e.g. `amount > 50000`) | first approval moves the task to `pending_second_approval`; the second approver must hold `cases:approve_high_risk` and be a different user (second approvals are offered to all such members) |
| Authority limit | `tasks:work` | decisions above the task's authority level need `cases:approve_high_risk` |
| Escalation prevention | `roles:manage`, `members:update` | a role may only contain permissions the editor holds; only holders of every permission of a role can assign it; only admins assign `admin`; nobody changes their own roles |
| Last admin | `members:deactivate`, `members:update` | the last active admin cannot be removed or downgraded |
| Secrets are write-only | `integrations:*` | nobody, admins included, can read connection secrets back |

## Clients

Clients have no roles in the FI's catalogue. They act on **their own** resources, identified by relationship:
applicant of a case, party of a case (director, UBO, co-applicant, guarantor: only their own part), member of a
client organisation (KYB). This is relationship-based access (ReBAC, as in Google Zanzibar/OpenFGA); it is
implemented with ownership columns and checks for now, and is the main reason to consider OpenFGA later.

## Machine principals

- **API clients** (OAuth 2.0 client credentials): hold an explicit permission list, a subset of the permissions of
  the member who created them; tokens are short-lived; secrets shown once.
- **Workflow executions** run as the workflow, not as a user: the published version declares what it may do (like
  GitHub Actions `permissions:` or an AWS execution role); the initiating user is recorded as `initiatedBy`, never
  impersonated. Human tasks are authorised against the member who acts on them. See [identity.md](identity.md).

## Platform support access (break-glass)

1. Staff with `platform.support_access:request` request access to a tenant: reason, scope (read-only), duration
   (≤ 8 hours).
2. The institution is notified; a member with `support_access:approve` approves or denies.
3. While active, the staff member acts in the tenant with a read-only grant; writes are refused.
4. Every request made under the grant is written to the **tenant's** audit log; the grant can be revoked any time and
   expires automatically.

## Enforcement points

| Layer | Enforces |
| --- | --- |
| Postgres RLS (`fintivio_app`) | tenant boundary (done) |
| API route guard `@Require(permission)` / `@RequirePlatform` / `@Access(kind)` / `@Public()` (`auth/access.ts`) | permission present; routes without a declaration are refused (deny by default) |
| Restate ingress | every handler is `ingressPrivate` except the case engine (`caseRun`, which only accepts API calls signed with `x-fintivio-signature`) and the legacy `workflow.trigger/resume` |
| Services / queries | conditions (scope filters, SoD, four-eyes, escalation) |
| Web app | navigation and actions follow the user's effective permissions (`user.permissions` from sign-in, `GET /auth/me`); never the only check |

Permissions are resolved per request from role assignments (not baked into tokens) so revocation is immediate.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Keep role names as permissions (today) | no: no least privilege, no custom roles worth the name |
| Cedar (AWS Verified Permissions) | good fit for conditions; adopt if the condition layer grows; the decision API is shaped for it |
| OpenFGA / SpiceDB (Zanzibar ReBAC) | strongest for client organisations, delegated access and sharing; revisit with KYB organisations and intermediaries |
| OPA/Rego | powerful but a separate policy language for a small team; no |
