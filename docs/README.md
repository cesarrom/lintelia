# Documentation

| Area | Document |
| --- | --- |
| Who uses the platform | [product/personas.md](product/personas.md) |
| What they do (flow catalogue with ids) | [product/flows.md](product/flows.md) |
| Authorization (permissions, roles, conditions, support access) | [architecture/authorization.md](architecture/authorization.md) |
| Identity (sessions, MFA, SSO, SCIM, clients, machines, workflow identity) | [architecture/identity.md](architecture/identity.md) |
| Cases, tasks and workflows (lifecycle, routing, public forms, API contract) | [architecture/cases-and-workflows.md](architecture/cases-and-workflows.md) |
| Integrations: connectors, API clients, webhooks, files | [architecture/integrations.md](architecture/integrations.md) |
| How to test the system locally (start, credentials, commands, journeys) | [../TESTING.md](../TESTING.md) |
| End-to-end tests, fakes, conventions, watching the tests | [testing/e2e.md](testing/e2e.md) |
| Design system (tokens, type, layout, components, brand assets) | [design/README.md](design/README.md) |
| Where each flow stands (generated) | [testing/flow-status.md](testing/flow-status.md) |
| Change log | [changes/](changes/) |
| Vendor API contracts available offline | [vendor-api/](vendor-api/) |

Architecture documents say what is implemented and what is **planned**; planned behaviour is encoded in the e2e
suite, which fails until it is built. Latest batches: [changes/0005](changes/0005-visual-e2e.md) (watching the e2e tests), [changes/0006](changes/0006-ui-redesign.md) (UI redesign), [changes/0007](changes/0007-client-apps.md) (client apps: studio, banking app, SDK), [changes/0008](changes/0008-dealer-finance.md) (dealer finance; stages, functions, signals, HTTP/AI/LoanPro connectors), [changes/0009](changes/0009-experience-map.md) (the experience map), [changes/0010](changes/0010-bun-e2e.md) (`bun e2e`), [changes/0011](changes/0011-ui-building-blocks.md) (UI building blocks: overlays, scanner, auto-submit, branding), [changes/0012](changes/0012-access-control.md) (who sees what: custom permissions, gated workflows, roles from the IdP, change control), [changes/0013](changes/0013-back-office.md) (the institution's own back office: pages, actions with staff screens, additions to built-in pages, all gated), [changes/0014](changes/0014-live-data-and-events.md) (live data and events: events by business key into running cases, pages that update by themselves); roadmap and
its status: [plans/](plans/README.md).
