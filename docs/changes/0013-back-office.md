# 0013 — The institution's own back office: pages, menu items, buttons, tabs and actions, gated by access

Design, decisions and what is left: [../plans/16-back-office-app.md](../plans/16-back-office-app.md) (decisions in §11,
what was built in §12). Architecture: [../architecture/authorization.md](../architecture/authorization.md#the-institutions-own-back-office-docsplans16).
Builds on [0012](0012-access-control.md): every item of the back office carries the same access rules (permission —
built-in or the institution's own —, roles, condition).

## For designers (Build → Back office)

- A **Back office** mode of the studio (switch between *Client app* and *Back office* at the top when you may build
  both): the institution's own screens for its team.
  - **Pages** of widgets (the client app's widgets that mean the same for a team: figures, lists, tables, details,
    charts, callouts, buttons, embeds), reading the team's data: `member`, `cases`, `tasks`, `metrics`, and clients'
    records (`records:<collection>`, across clients or for the client of the page). A page is on its own (in the menu,
    `/app/x/<page>`) or **about one client / one case** (a tab of the built-in client or case page, with that record).
  - **Actions**: a button or menu item that **starts a workflow** with the client or case of the page (inputs by
    templates such as `{{client.email}}`; values from a button only for the keys the action allows). The workflow's
    new **`team.screen`** steps are screens for the member — they open over the page in a dialog or a sheet, one after
    the other (a wizard), with the same fields, checks and buttons as client screens. A `team.screen` can also go to a
    role's queue (`to: { role }`): its members fill it from the task page.
  - **Additions to built-in pages** (never replacements): buttons and tabs on the client and case pages, widgets on the
    dashboard. **Menu items** in the existing sections or new ones; **homes** (where members land after signing in).
  - **Who gets it** on every item (page, widget, action, menu item, button, tab, home): every member, or holders of
    permissions / roles / a condition on their attributes. Create the permission you need from there.
  - **Preview as** any role on the canvas, and **Who gets what**: per role, the menu, pages, actions, buttons, tabs and
    dashboard widgets its holders get, widgets they would see empty (a source they cannot read), actions their
    workflow excludes, permissions nobody holds yet.
  - **Templates**: *Fee waivers (servicing desk)* — the reference example, using every piece: the custom permission
    *Waive fees*, the members' *authority limit* attribute, a workflow (published through an administrator's approval:
    it says who may start it) with a staff screen and a senior reviewer's approval above the member's limit, a
    *Servicing desk* page in the menu, a *Waive a fee* button and a *Servicing* tab on the client page, a dashboard
    widget. The refund and a notification appear in the client's app.
  - Draft saved as you go, problems listed before publishing, versions and rollback (as the client app).

## For the team

- What the institution built appears where it belongs: menu items, the client and case pages' buttons and tabs (their
  own content stays in *Overview*), the dashboard — only what the member's access allows (the API sends nothing else).
- Actions open their screens over the page; what happens next is shown (done, waiting for someone's approval).
- A screen left half-way waits: **Waiting for you** on the dashboard and **Continue** on the case page.

## For administrators

- The template's next steps say what only you decide: who holds *Waive fees* (Roles → Extend), each member's authority
  limit (Team → Access → Attributes), and the workflow's publication (Access changes).
- *Settings → Security → Who looked at which client*: off by default; on, every client page of the back office a member
  opens is recorded (`client.viewed`, with the page).

## Under the hood

| Where | What |
| --- | --- |
| `packages/lintelia/src/schemas/back-office.schema.ts` | the definition (navigation, pages with context, actions, slots, homes), its widgets (`BACK_OFFICE_WIDGETS`), sources and the permissions they need, validation; permissions `backoffice:read/manage/publish` (flow designers all three, auditors read) |
| `apps/core/src/back-office/store.ts` | stored as a second app of the institution (`client_apps` key `backoffice`, same versions), pruning per member (rules, workflows they may not start, references to pruned items) |
| `apps/core/src/back-office/studio.service.ts` | draft, validation, publication, versions, templates, preview as roles, the access report |
| `apps/core/src/back-office/runtime.service.ts` | the pruned app, page data under the member's rights (only what the page reads; read auditing), actions (the action's rule and the workflow's start rule), staff screens and where a case stands for the member, the member's pending screens |
| `apps/core/src/back-office/templates` | the *Fee waivers* template (workflow YAML, definition, permission, attribute) |
| `apps/core/src/engine/components/client-app.ts` | `team.screen` (shares `buildScreen` with `client.screen`); answers checked by `client-apps/screen-answers.ts` |
| `apps/core/src/handlers/back-office.controller.ts` | `/backoffice/*` (studio and runtime) |
| `apps/core/scripts/seed.ts` | Demo Bank gets the *Fee waivers* back office published; relationship managers and senior reviewers hold *Waive fees* |
| `apps/web/src/back-office` | runtime: provider, action runner (dialog / sheet), pages `/app/x/:page`, slots in the client, case and dashboard pages, homes, pending screens, sample data for the studio |
| `apps/web/src/app/modules/private/experience/back-office` | the studio's back-office mode (lists, canvas with selection and preview as a role, inspectors with *Who gets it*, access report, templates) |
| `apps/web/src/app/modules/private/experience/studio-chrome.tsx` | pieces shared by both modes (mode switch, save state, problems, versions) |

## Tests

| Id | Where | What |
| --- | --- | --- |
| BOA-01…05, 07, 08 | `tests/back-office/back-office.api.spec.ts` | template and publication, validation, pruning per member and refusals on use, the action with a staff screen and an approval above the limit, pending screens, page data under the member's rights, access report and preview, versions, read auditing |
| BOA-01, 02, 03, 05, 06 | `tests/back-office/back-office.ui.spec.ts` | the studio (template, publish, canvas and inspector, a page from scratch restricted to a role), who gets the desk / tab / button, the action's dialog, resuming a screen from the dashboard and the case page, preview as a role and the access report, homes |

## Also

- `bun run --cwd apps/e2e screens --only bo-desk,bo-dashboard,bo-client-tab,bo-studio,bo-studio-client,bo-studio-preview,bo-studio-widget,bo-studio-action,bo-studio-menu,bo-studio-report,settings-read-audit`.
- Left for later (plan 16 §12): built-in pages placed or hidden in the menu, panels (only buttons and tabs for now),
  team-specific widgets (task queue, case pipeline, client search — lists and tables over `cases` / `tasks` do it
  today), actions that signal a running case or open a URL, query functions as live data sources, preview with attributes in the studio (the API takes
  them), the publish diff, rate limits per member, the back office on the experience map, live widgets (plan 17).
