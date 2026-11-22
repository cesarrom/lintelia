# Plan 15 — Who sees what: custom access, roles that follow the identity provider, gated workflows

Status: **implemented** ([../changes/0012-access-control.md](../changes/0012-access-control.md)) — decisions in §13, change control and recovery in §14. Left: access-review campaigns (§5.6; the CSV export exists), requesting elevated access as a workflow, teams. Part of the batch with [16](16-back-office-app.md) (the institution's own
screens) and [17](17-live-data-and-events.md) (live data and events, exploratory). This document is the foundation:
16 depends on it, 17 reuses its rules for who may listen to what.

## 1. What was asked

1. Polish role management so **the administrators of an institution decide who sees what**.
2. It must play well with the institution's **identity provider** (SSO, SCIM) and with **attributes** of its people.
3. It must be ready for the institution's **own screens, buttons, widgets and menu items** ([16](16-back-office-app.md))
   and for **workflows gated to a set of roles**.

Audience: the institution's team (the *members* realm). Lintelia staff and the institution's clients are out of scope:
staff have platform roles and support grants; clients have no roles (segments and eligibility rules, plan 11).

## 2. What exists (and what is missing)

| Piece | Today | Gap |
| --- | --- | --- |
| Permission catalogue | 45 tenant permissions `resource:action` in `packages/lintelia/src/schemas/authorization.schema.ts`, shared by API and web app | fixed: an institution cannot name a capability of its own ("may waive fees", "may see the collections console") |
| Roles | 9 immutable system roles + custom roles composed from the catalogue; escalation prevention (grant only what you hold, only admins assign `admin`, nobody edits their own roles, last admin kept) | custom roles are the only way to change anything, so "give reviewers one more thing" means cloning `reviewer` |
| Enforcement | every route declares `@Require` / `@RequireAny` / `@Access` / `@Public`; deny by default; permissions resolved per request (revocation is immediate) | nothing is gated per *item*: any member with `cases:create` may start **any** published workflow (`POST /workflows/:id/executions`, `GET /workflows/startable`) |
| Web app | navigation (`apps/web/src/lib/routes/routes.ts`) and buttons follow permissions (`hasPermission`, `PermissionGate`) | the Roles page lists cards of permission badges: no matrix, no members per role, no "what does this role get", no "who can do X" |
| SSO / SCIM | WorkOS broker: OIDC SSO with enforcement, JIT accounts with *default roles*, SCIM directory sync (create, update, deactivate) | **IdP groups are dropped** (`profile.groups` is read in `auth/sso/broker.ts` and never used); the WorkOS fake always emits `groups: []`; SCIM custom attributes are ignored |
| People | `users` rows: name, e-mail, status, roles | no attributes (department, branch, region, licence, cost centre), no teams |
| Oversight | append-only, hash-chained audit of every grant and role change | no access review (recertification), no time-bound assignments, no export of "who has what" |

## 3. Why institutions restrict access (the use cases we design for)

Hiding things is rarely cosmetic in a regulated institution. The reasons, each with who asks for it:

| Reason | Example | Driven by |
| --- | --- | --- |
| **Need-to-know / data minimisation** | the collections console lists delinquent borrowers with phone numbers: only the collections team | GDPR art. 5 and 25, GLBA Safeguards Rule, PCI DSS req. 7 |
| **Segregation of duties** | whoever approves a loan must not also have the "Disburse" button; whoever creates a payee must not release the payment | SOX, Basel operational risk, FFIEC, internal audit |
| **Tipping-off prohibition** | screens showing SAR investigations or AML alerts must not reach front-line staff who talk to the client | AMLD art. 39, US BSA (31 USC 5318(g)(2)) |
| **Licensing and competence** | only licensed loan officers quote rates (NMLS); only certified advisers see the advice screen (MiFID II knowledge and competence); only staff with a permissible purpose pull a credit report | NMLS / SAFE Act, MiFID II, FCRA §604 |
| **Information barriers** | corporate-finance and research teams do not see each other's client screens | MAR, "Chinese walls" |
| **Organisation and geography** | a branch sees its branch's clients; an EU subsidiary's staff do not see US cases; outsourced call-centre agents get a reduced console | data residency, outsourcing guidelines (EBA/GL/2019/02) |
| **Authority limits** | a teller can waive fees up to 50, a branch manager up to 500 | lending and operational authority matrices |
| **Staged rollout** | a new screen is piloted with one team before everyone gets it | change management; not a security control |
| **Focus** | each team's home shows its work; nobody wades through thirty menu items | UX; not a security control |
| **Oversight** | auditors and examiners read everything and change nothing | internal audit, regulators |

The opposite question matters just as much: **why would a screen be available to someone?** Because their job needs it
(operational consoles, customer 360 for a teller, KPI boards for a team lead, internal request forms everyone can
use, "quick actions" on a client such as reissue a card). The model has to make *granting* as explicit as *denying*.

Two consequences shape the design:

- Some restrictions are **security controls** (need-to-know, SoD, tipping-off, licensing, barriers) and must be
  enforced by the API. Others are **presentation** (focus, rollout) and may be UI-only. The product must say which is
  which, so nobody mistakes a hidden menu item for a control.
- Most restrictions follow the **job** (role), some follow **attributes** of the person (branch, region, licence) or of
  the thing (amount, client segment). Roles alone are not enough; attribute rules alone are not auditable enough. We
  need roles first, attributes as conditions on top: the NIST RBAC + ABAC layering the authorization model already
  states (docs/architecture/authorization.md).

## 4. Principles (industry baseline)

| Principle | Source | Here |
| --- | --- | --- |
| Enforce on the server; the UI only reflects | OWASP ASVS V4.1.1, OWASP Top 10 A01 | every screen, widget, button and workflow start is re-checked by the API; hidden ≠ protected |
| Deny by default, least privilege | NIST SP 800-53 AC-3, AC-6 | a new custom permission is held by nobody except `admin` until someone grants it |
| **Builders and access administrators are different people** | SoD; Salesforce *custom permissions*, ServiceNow roles on UI pages, Power Apps security roles | designers *declare* what a screen or workflow requires; administrators *decide* which roles hold it, on the Roles page. One place answers "who sees what" |
| Roles are the unit of assignment; permissions are the unit of checking | NIST RBAC (INCITS 359) | screens and workflows never name people; they name permissions (or, as a shorthand, roles) |
| The identity provider is the source of truth for joiners, movers, leavers | SCIM 2.0 (RFC 7643/7644), ISO 27001 A.5.18 | IdP groups map to roles; those assignments are *managed* (read-only in Lintelia), manual ones stay possible |
| Attribute conditions narrow, never widen | NIST SP 800-162 (ABAC), AWS IAM conditions, Cedar | a condition can only remove access a role gave |
| A screen is a lens, not a key | — | opening a screen never gives access to data the member could not read anyway; only **workflows** act with their own identity, so *who may start a workflow* is the real grant and is gated like a permission |
| Periodic review of access | SOX, SOC 2 CC6.2/CC6.3, FFIEC | access reviews with evidence; exports of who holds what |
| Everything audited | PCI DSS 10, SOC 2 CC7 | grants, mapping changes, reviews, denials of privileged actions |

## 5. The model

```
IdP groups ──mapping──▶ ┐
manual assignment ─────▶├─▶ role assignments ──▶ roles ──▶ permissions ──▶ checked by API routes,
time-bound assignment ─▶┘   (source, expiry)      │         (built-in +      workflow starts, screens,
                                                  │          custom)         widgets, buttons, menu items
SCIM / SSO claims / manual ─▶ member attributes ──┴──────────────────────▶ conditions (JSONata) on top
```

### 5.1 Custom permissions (capabilities the institution names)

An institution defines its own permissions next to the built-in catalogue:

```yaml
key: custom:fees.waive            # always prefixed custom: — cannot shadow or impersonate a built-in id
name: Waive fees
description: Waive account fees up to the member's authority (back-office action "Waive fee")
category: Servicing               # groups it on the Roles page
```

- Stored per tenant (`custom_permissions`: key, name, description, category, created by, archived); RLS like every
  tenant table. Archived (never hard-deleted while referenced) so audit entries keep their meaning.
- **Who creates them**: members with `roles:manage`, *and* designers with `backoffice:manage` or `workflows:manage`
  while they build ("this button requires a new permission *Waive fees*"). Creating a permission grants it to nobody.
- **Who grants them**: whoever may edit roles (`roles:manage`), with the existing escalation rule (you grant only what
  you hold). `admin` holds every custom permission automatically.
- **System roles can be extended with custom permissions only** ("role extensions"): the platform's permissions of
  `reviewer` stay immutable, but an institution may add `custom:fees.waive` to it. Without this, every institution
  that adds one capability clones half the system roles, and clones stop receiving platform updates.
- `resolvePermissions` takes the tenant's custom catalogue as a parameter; tokens still carry no permissions (resolved
  per request), so a grant or revocation takes effect on the next request.
- API clients may hold custom permissions too (an institution's system runs the "Waive fee" workflow by API).

### 5.2 Access rules on things (one shape everywhere)

Every gated thing (workflow start, back-office page, menu item, widget, button, slot action — plan 16) carries the same
rule:

```yaml
access:
  permissions: [custom:collections.console]   # all of these (built-in or custom)
  roles: [collections_agent]                  # optional shorthand: any of these roles
  when: "member.attributes.region = 'EU'"     # optional condition (JSONata over member, context)
```

- `permissions` is the recommended form (the administrator decides who holds it). `roles` exists because small
  institutions think in roles and because workflows already route tasks to roles; the studio shows a hint that
  `permissions` keeps the decision on the Roles page.
- No `access` means "every member" for presentation items and the built-in default for actions (for workflow starts:
  `cases:create`, today's behaviour, so nothing changes for existing institutions).
- `when` can only narrow. It is evaluated on the server with the member's attributes and the context (the client or
  case on screen). A failing or erroring condition denies.
- One evaluator (`authorizeAccess(member, rule, context)`) in the API, one in the web app for presentation, both from
  `packages/lintelia` so they cannot drift. This is the first piece of the `authorize()` decision function the
  authorization doc already plans (Cedar-shaped: principal, action, resource, context).

### 5.3 Gated workflows

```yaml
name: Waive a fee
access:
  start: { permissions: [custom:fees.waive] }         # who may start it by hand, from a button or by API
  cases: { permissions: [custom:fees.view] }          # optional: who may see its cases (on top of case scope)
```

- `start` replaces the blanket `cases:create` for this workflow: a collections agent can run *Log a promise to pay*
  without being allowed to open any application. Enforced in `POST /workflows/:id/executions`, `POST /cases`,
  back-office actions (16) and `GET /workflows/startable` (filters the list).
- `cases` narrows case visibility for sensitive workflows (investigations already use `clientVisibility`; this is the
  team-side equivalent): a member needs case scope **and** this rule to see the case, its tasks and its timeline.
- Routing tasks to roles (`assignTo.role`) is unchanged. Publishing warns when a task is routed to a role that cannot
  see the workflow's cases (a task nobody can open).
- Starts from platform events, forms, client journeys and connector events are not members acting: they keep their own
  rules (the workflow's `startOn`, form publication, client-app eligibility).
- **Changing `access` is an access decision.** Publishing a version whose `access` differs from the active version
  needs `workflows:publish` *and* `roles:manage`, or goes through an approval (four-eyes) when the institution turns
  that on. The publish dialog shows the difference ("now startable by: Collections agent, Team lead").

### 5.4 Roles that follow the identity provider

- **Group → role mappings** (`role_mappings`: source `sso` | `scim`, group id or name, role key), edited in
  *Settings → Security → Role mappings* by `security:manage` + the escalation rule (you may only map to roles you
  could assign yourself; only admins map to `admin`).
- `user_roles` gains `source` (`manual` | `idp` | `jit_default`) and `expires_at`. IdP-sourced assignments are
  recomputed at every SSO sign-in (from the ID token's `groups`) and on every directory event
  (`dsync.group.user_added` / `user_removed`, `dsync.user.updated`); they are read-only in the Team page ("managed by
  your identity provider"). Manual assignments stay editable and are not touched by sync.
- *(Decided, §13)*: no setting — as soon as single sign-on is linked, the IdP is authoritative for the people of its
  domains (manual assignment disabled for them: the joiner/mover/leaver evidence banks need).
- Every change says who or what made it: `member.role_assigned { source: 'idp', group }`.

### 5.5 Member attributes

- The institution declares its member attributes (like the client profile schema of plan 11): key, label, type
  (text, select, list), e.g. `branch`, `region`, `department`, `licences`, `costCentre`, `authorityLimit`.
- Sources per attribute: manual (Team page), SSO claim (JSONata over the ID token, e.g. `department`), SCIM attribute
  (core `title`, enterprise extension `department`, `costCenter`, `division`, custom attributes). IdP-sourced values
  are read-only, like roles.
- Used in `access.when`, in workflows (`initiator.attributes.*`, routing later) and in data filters of plan 16
  (`cases where branch = member.attributes.branch`).

### 5.6 Time-bound assignments and access reviews

- **Expiring assignments**: a role granted until a date (holiday cover, contractors, an incident). Ignored after expiry;
  a daily job removes them and audits `member.role_expired`. Later, *requesting* elevated access can itself be a
  workflow (request → approval task → time-bound grant): the engine already does approvals.
- **Access reviews** (recertification): an administrator opens a review (scope: all members, a role, or members holding
  a permission); reviewers (managers or admins) confirm or revoke each assignment; revocations apply at once; the
  result is exported (CSV/PDF) as audit evidence. IdP-managed assignments are reviewed at the source and shown for
  information only.

## 6. The administrator's experience (web app)

| Screen | What it does |
| --- | --- |
| **Roles** (redesigned) | list with members count; **matrix** view (roles × permissions, built-in and custom, by category, with a filter); clone a role (also from a system role); rename custom roles (the key stays); extend system roles with custom permissions |
| **Role detail** | permissions; members (and how they got it: manual, IdP group, expiring); **what it opens**: menu items and pages (16), workflows it may start, task queues that route to it, API clients holding it |
| **Permission detail** ("who can…") | for any built-in or custom permission: roles that hold it, members through each role, where it is used (workflows, pages, buttons); archive a custom permission |
| **Member access** (Team → member) | roles with their source and expiry, effective permissions, attributes; **"what can this person see and do"**: navigation, pages, startable workflows, queues |
| **Preview as** | render the back office's navigation and pages (16) as a chosen set of roles and attributes — structure only, no data of anyone else, no impersonation; audited |
| **Role mappings** (Settings → Security) | IdP groups → roles, whether SSO is linked, a preview of every member's roles |
| **Access reviews** | campaigns, progress, decisions, export |

Impersonation ("sign in as another member") is deliberately **not** offered: it breaks attribution in the audit
trail and is a common finding in bank audits. *Preview as* answers the same question without acting as anyone.

## 7. API (sketch)

| Route | Permission | Notes |
| --- | --- | --- |
| `GET /permissions` | any member | built-in **and** custom catalogue (custom marked `custom: true`) |
| `POST/PUT/DELETE /permissions/custom[/:key]` | `roles:manage`, or `backoffice:manage` / `workflows:manage` (create only) | delete = archive |
| `PUT /roles/:key` on a system role | `roles:manage` | only `customPermissions` may change |
| `GET /roles/:key/members`, `GET /roles/:key/usage` | `roles:read` + `members:read` | usage: workflows, pages, queues, API clients |
| `GET /access/who?permission=…` / `?workflow=…` / `?page=…` | `roles:read` + `members:read` | "who can" queries |
| `GET /users/:id/access` | `members:read` + `roles:read` | effective permissions, navigation, startable workflows |
| `POST /access/preview` | `roles:read` (+ `backoffice:read`) | navigation and pages for a role set |
| `GET/PUT /security/role-mappings` | `security:manage` (+ escalation rule) | |
| `GET/PUT /member-attributes` (schema), `PATCH /users/:id/attributes` | `members:update` | IdP-sourced values refused |
| `POST /access-reviews`, `…/decisions`, `…/export` | `members:update` (reviewers named per campaign) | |

Workflow YAML gains `access.start`, `access.cases`; validation refuses unknown permissions and roles.

## 8. Data model (sketch)

- `custom_permissions (tenant_id, key, name, description, category, archived_at, created_by, …)`
- `role_custom_permissions (tenant_id, role_id, permission_key)` — extensions of system roles (custom roles keep their
  `permissions` array, which may now contain `custom:*` keys)
- `user_roles` + `source`, `source_ref` (group), `expires_at`, `granted_by`
- `role_mappings (tenant_id, source, group_id, group_name, role_id)`; whether SSO is linked comes from the verified domains
- `member_attribute_definitions (tenant_id, key, label, type, source, mapping)`; `member_attributes (tenant_id, user_id, key, value jsonb, source)`
- `access_reviews`, `access_review_items`
- `workflow_versions` + `access jsonb` (copied from the YAML at publish, indexed for "startable" queries)

All with composite `(tenant_id, id)` foreign keys and RLS, as every tenant table.

## 9. Fakes and tests

- **WorkOS fake**: directory groups (`directory_groups`, `dsync.group.*` events, `groups` on directory users) and SSO
  profile groups; **OIDC fake**: already issues `groups` (`POST /__control/users { groups }`).
- e2e flows (new ids in `docs/product/flows.md`):

| Id | Flow |
| --- | --- |
| FIA-13 | Custom permissions: a designer creates *Waive fees*; nobody holds it until an administrator grants it to a role; it takes effect on the next request |
| FIA-14 | Gated workflows: only members holding the start rule see and start the workflow (list, UI, API); others get 403; the cases rule hides its cases even from `cases:read_all` holders |
| FIA-15 | Roles page: matrix, members per role, what a role opens, who can do X, extending a system role, cloning |
| FIA-16 | IdP groups become roles as soon as SSO is linked (SSO sign-in and SCIM group changes); managed assignments are read-only |
| FIA-17 | Member attributes from the IdP and by hand; a condition on a workflow start (`region`) |
| FIA-18 | Time-bound assignment expires; access review revokes and exports evidence |
| X-08 | The authorization matrix (X-02) extended: every gated item refuses members outside its rule through every entry point (UI, API, API client) |

Unit tests: the access evaluator (rules, conditions, errors deny), resolution with custom permissions and extensions,
escalation rules for mappings and extensions.

## 10. Milestones

| M | Content | Unblocks |
| --- | --- | --- |
| 15.1 (S–M) | custom permissions, system-role extensions, `access.start` / `access.cases` on workflows with enforcement, the shared evaluator | plan 16 |
| 15.2 (M) | Roles page redesign: matrix, role detail with members and usage, permission "who can", member access | the administrators' visibility |
| 15.3 (M) | IdP group → role mappings (SSO + SCIM) with the WorkOS fake extended; assignment sources | SSO-heavy institutions |
| 15.4 (S–M) | member attributes (manual, SSO claims, SCIM) and `when` conditions | branch/region rules |
| 15.5 (M) | time-bound assignments, access reviews, exports; *preview as* lands with plan 16 | oversight |

## 11. Alternatives considered

| Option | Verdict |
| --- | --- |
| Screens and workflows list **roles** only | simple, but every change of "who sees it" is a change of the screen (a designer's job, a new version) instead of the Roles page (an administrator's job); kept only as a shorthand |
| Make system roles editable | no: they would stop evolving with releases and the authorization matrix (X-02) would stop meaning anything; extensions with custom permissions get the benefit without the cost |
| Externalise to Cedar / OpenFGA now | not yet: the evaluator is shaped like a Cedar request so it can move there; revisit with teams, delegated access and KYB organisations |
| Teams (named groups of members with their own queues) | deferred: attributes (`team`) + conditions cover filtering; queues stay per role. Revisit if institutions need per-team queues |
| Impersonation for support and testing | no (audit attribution); *preview as* instead |

## 12. Decisions we need

1. **System-role extensions** with custom permissions (recommended) — or custom roles only?
2. **Publishing an access change** on a workflow or page: needs `roles:manage` as well (recommended), or a four-eyes
   approval, or `workflows:publish` is enough?
3. **Role sync default** for SSO institutions: additive (recommended for a start) or authoritative? → decided in §13: roles come from SSO as soon as it is linked.
4. **Attributes in v1** (15.4) or after the back-office app (16) ships?
5. **Access reviews** in this batch or later?

## 13. Decisions (recorded)

| # | Question | Decision | Consequences in the design |
| --- | --- | --- | --- |
| 1 | System-role extensions | **yes**, with custom permissions only; institutions decide their permissions freely as long as nobody can elevate themselves (escalation rules unchanged) and nothing reaches platform scope | soft-lock prevention (§14) and a **staff recovery** procedure for the rare case it happens anyway |
| 2 | Access changes | industry practice: **notify** administrators of every privileged change; **second approver** (maker-checker) as an institution policy; **effective dates** for any change | §14 *Change control*. Principle: *grants* may wait for approval, *revocations* never do (removing access must be fast); designers *propose* access rules on workflows, an administrator decides |
| 3 | Where roles come from | **the identity provider, as soon as single sign-on is linked — no switch, no exception**; single sign-on is optional for institutions, so without it roles are managed in the app *until SSO is linked*. Group membership is the IdP's (joiner/mover/leaver), the meaning of each role (its permissions) is decided in the app. Aligns with AWS IAM Identity Center (permission sets assigned to IdP groups), Okta/Entra group-based app roles, GitHub Enterprise Managed Users, Slack Enterprise Grid | linked = a verified SSO domain; people of that domain cannot get roles by hand; each member's roles follow their groups from the first time the IdP tells us about them (SSO sign-in, directory), so verifying a domain does not strip the team before anyone signed in; **local emergency accounts** outside the SSO domains keep manual roles (Microsoft's emergency-access guidance); guards: a sync never removes the Administrator role while no group maps to it, nor from the last administrator |
| 4 | Data for custom screens | generic building blocks; institutions implement their own use cases with them | plan 16: no bespoke consoles in the platform |
| 5 | First real-time use case | notifications | plan 17 |

## 14. Change control, soft-locks and recovery

**Privileged changes** are: role definitions (create, change permissions, delete, system-role extensions), member
role assignments and invitations with roles, IdP group → role mappings, and who may start or see a
workflow (`access`). Every privileged change:

- is **audited** with requester, approver and the before/after;
- **notifies** the institution's administrators (members holding `roles:manage` or `security:manage`) and the extra
  addresses of the security policy, by e-mail;
- may carry an **effective date** (`effectiveAt`): it waits as *scheduled* and can be cancelled until then;
- needs a **second approver** when the institution's policy says so (`approval: off | grants`, *Settings → Security*)
  **and** the change grants something (adds permissions to a role, assigns a role, maps a group, widens a workflow's
  access). Revocations apply at once (or at their date) with notification.
  The approver holds `roles:manage` (`security:manage` for SSO changes), is not the requester, and passes the
  escalation check for what is granted; pending changes expire after 7 days; when applied, the change is re-validated.
- Access rules of a workflow are always approved by someone holding `roles:manage`: a designer's publish that changes
  them waits for an administrator, whatever the policy.

**Soft-lock prevention**: the last active administrator cannot lose the role or be deactivated (by hand, by an IdP
sync or by a mapping change: the sync keeps it, audits `member.role_sync_blocked` and notifies); while no group maps to the
Administrator role, syncs keep that role on administrators; a mapping change whose simulated outcome leaves no active
administrator is refused;
approval cannot be required with fewer than two possible approvers (and when approvers drop below two, changes apply
with a notification instead of waiting forever).

**Staff recovery**: when an institution still locks itself out (its only administrators left, its IdP is gone), platform
staff holding `platform.tenants:recover` restore an administrator after verifying the request out of band (support
ticket): an invitation with the `admin` role as a local account, bypassing approvals, written to the platform audit and
to the institution's own audit log, and e-mailed to every administrator of the institution. Staff still never see
institution data.
