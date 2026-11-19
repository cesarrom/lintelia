# 0012 — Who sees what: custom permissions, gated workflows, roles from the identity provider, change control

Design, decisions and what is left: [../plans/15-access-and-roles.md](../plans/15-access-and-roles.md) (decisions in §13,
change control and recovery in §14). Architecture: [../architecture/authorization.md](../architecture/authorization.md#who-sees-what-docsplans15).
Also in this batch: the repository now lives at the root of the workspace (the `fintivio/` folder is gone; history kept
as renames).

## For administrators of an institution

- **Custom permissions** (*Roles → New permission*, *Custom permissions* tab): name your own capabilities (“Waive
  fees”). Nobody holds a new one until you put it in a role; archiving revokes it everywhere at once.
- **Extend system roles** (*Extend* on a system role): add your own permissions to Reviewer, Relationship manager…
  without cloning them; their platform permissions stay and keep evolving with Fintivio.
- **See who sees what**: the roles × permissions **matrix**; each role's page with its **members** (and how each got the
  role: by hand, from the identity provider's groups, by default, restored by support), **what it opens** (task queues,
  escalations, workflows its holders may start); **who holds a permission** (roles, members, API clients, workflows
  requiring it); each member's **Access** (roles, permissions, what they may start, their queues, cases hidden from
  them); **Export assignments** (CSV for access reviews, audited).
- **Roles from your identity provider** (*Settings → Security*): as soon as single sign-on is linked (a verified
  domain), roles of people of that domain come from your IdP's groups — no switch. Map groups to roles (before linking,
  too) and preview what every member holds. From their first sign-in through the IdP (and as SCIM groups change) they
  get exactly the roles of their groups and cannot be given roles by hand; local accounts (emergency administrators,
  consultants) still can. Without single sign-on, roles are managed in Fintivio. Fintivio keeps the Administrator role
  while no group maps to it and never removes your last administrator, and tells you when it had to keep one.
- **Member attributes** (*Team → Member attributes*): branch, region, licences… set by hand or read from your IdP (a
  claim of the SSO sign-in or a directory attribute); conditions use them (`member.attributes.region = 'EU'`).
- **Time-bound roles** (*Team → Edit roles / More…*): a role until a date (holiday cover, contractors).
- **Access changes** (new page): every privileged change with who asked, who approved and when it took effect.
  Privileged changes are **e-mailed** to the administrators (and extra addresses, e.g. the security team). Optional
  **second administrator** (*Settings → Security → Access changes*): changes that grant access wait for another
  administrator, who cannot be the requester nor approve their own elevation; removing access never waits; switching
  the second approver off needs a second administrator too. Any change can take effect **from a date** (cancellable
  until then).

## For designers

- *Workflow settings → Who may use it*: who may **start** the workflow (by hand, by API; instead of everyone holding
  `cases:create`) and who may **see its cases** (on top of case scope, also for those who see every case), by
  permission (recommended: the Roles page then decides who holds it), role or condition. Designers can create the
  permission they need from there. Publishing such a change **waits for an administrator**.

## For platform staff

- *Platform → Institutions → Restore access* (`platform.tenants:recover`, platform administrators): invite an
  administrator into an institution that locked itself out, after verifying the request (ticket recorded in both audit
  logs; the institution's administrators are e-mailed). Staff still never see institution data.

## Under the hood

| Where | What |
| --- | --- |
| `packages/fintivio/src/schemas/authorization.schema.ts` | custom permission keys, `resolvePermissions` with custom keys and system-role extensions (`allCustomPermissions` for admin), access rules (`AccessRule`, `WorkflowAccess`, static check, errors), `platform.tenants:recover` |
| `packages/fintivio/src/entities` | `custom_permissions`, `role_mappings`, `member_attribute_definitions`, `access_changes`; `users.idp_groups`, `users.attributes`; `user_roles.source/groups/expires_at/granted_by_email`; `workflow_versions.access`; `tenant_security_policies.access_approval/access_notify`; (migrations `0022_access_control.sql`, `0023_sso_linked_roles.sql`; RLS forced) |
| `apps/core/src/access/catalog.ts` | the institution's catalogue, per-request member access (active assignments, custom keys), members holding a permission |
| `apps/core/src/access/rules.ts` | access rules with JSONata conditions, workflows hidden from a member, start rules, publication checks |
| `apps/core/src/access/changes.ts`, `change-kinds.ts` | change control engine (submit / approve / reject / cancel, scheduling, expiry, time-bound roles, notifications) and its kinds: roles, member roles and invitations, IdP mappings, workflow publication, the approval policy |
| `apps/core/src/access/role-sync.ts` | roles from IdP groups, simulation, last-administrator guard |
| `apps/core/src/access/attributes.ts`, `queries.service.ts`, `custom-permissions.service.ts`, `recovery.ts`, `notify.ts` | attributes, “who sees what” answers and export, custom permissions, staff recovery, e-mails to administrators |
| `apps/core/src/services/{roles,users,cases,tasks,workflow-lifecycle}.service.ts`, `workflow-publish.ts` | roles and assignments through change control; case scope and task visibility narrowed by workflow rules; start rules; publication of access changes |
| `apps/core/src/auth/sso/*` | groups and attributes from SSO sign-ins and directory events (`dsync.group.*`, user groups re-read from the broker) |
| `fake-services/workos` | SCIM Groups (create, membership patches, delete), `dsync.group.*` events, `GET /directory_groups?user=`; user raw attributes kept |
| `fake-services/idp-oidc` | extra ID token claims per user (`claims`) |
| `apps/web/src/app/modules/private/roles` | Roles page (roles, matrix, custom permissions), role page, “who can”, role and permission dialogs |
| `apps/web/src/app/modules/private/access`, `settings/components/access-settings.tsx`, `users/*` | Access changes; approval policy and IdP roles cards; Team (sources, time-bound roles, member access, attributes) |
| `apps/web/src/components/access` | `AccessRuleEditor` (reused by the back-office screens of plans/16), `EffectiveDate` |
| `apps/web/src/lib/auth/AuthContext.tsx` | permissions follow `GET /auth/me` (every minute, on focus, after access changes), no longer only what was true at sign-in |

## Tests

| Id | Where | What |
| --- | --- | --- |
| FIA-13, FIA-14 | `tests/fi-admin/custom-access.api.spec.ts` | custom permissions, extensions, archive/restore; gated workflows through every entry point, the designer's publication approved by an administrator, API clients |
| FIA-15, FIA-17, FIA-18, STAFF-08 | `tests/fi-admin/who-sees-what.api.spec.ts` | matrix, members, usage, who can, member access, export; attributes by hand and from SSO claims, a condition on them; time-bound roles; staff recovery |
| FIA-16 | `tests/fi-admin/idp-roles.api.spec.ts` | manual until linked, linking told to administrators, mappings and preview, the first SSO sign-in replacing hand-given roles, groups at every sign-in, SCIM groups, manual assignment and invitations with roles refused for the domain, both Administrator guards |
| FIA-19 | `tests/fi-admin/access-changes.api.spec.ts` | notifications, second approver, self-approval refused, revocations at once, scheduling and cancelling, protected policy, no approver left |
| FIA-13/14/15/16/19, STAFF-08 | `tests/fi-admin/access.ui.spec.ts` | the same through the UI: Roles page and extension, the editor's *Who may use it* and the approval, the IdP roles card, a second administrator approving a role, *Restore access* |
| — | `apps/core/test/access.test.ts` | resolution, rules and conditions, group mapping, attribute types, role routing in expressions, effective dates |

## Also

- `bun run --cwd apps/e2e screens` shows the new screens (roles, matrix, custom permissions, role, who can, access
  changes, member access, security settings).
- Designers keep their YAML: `access` round-trips through the workflow editor; the old, never enforced `allowedRoles`
  stays ignored.
- Left for later (plans/15): access-review campaigns (the CSV export is there), requesting elevated access as a
  workflow, teams, SCIM-driven attribute tests beyond the fake's raw attributes, and **API clients through change
  control** (creating one with permissions is a grant too, but its secret is shown once: approving it later needs the
  secret to be revealed to the requester after approval — designed, not built). Attribute values set by hand are
  audited but not change-controlled: when conditions depend on them, prefer attributes from the identity provider.
