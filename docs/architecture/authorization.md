# Authorization model

Status: **implemented** for tenant and platform permissions, system and custom roles, escalation prevention, case
scope, segregation of duties, authority and four-eyes (see [0003](../changes/0003-case-engine-and-journeys.md)).
Still planned: teams, support-access grants, API clients, the generic `authorize()` decision function (checks are
`@Require`/`@RequirePlatform` guards plus service rules today). The catalogue lives in
`packages/fintivio/src/schemas/authorization.schema.ts` (shared by API and web app).

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
