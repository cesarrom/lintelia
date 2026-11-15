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
| End-to-end tests, fakes, conventions | [testing/e2e.md](testing/e2e.md) |
| Where each flow stands (generated) | [testing/flow-status.md](testing/flow-status.md) |
| Change log | [changes/](changes/) |
| Vendor API contracts available offline | [vendor-api/](vendor-api/) |

Architecture documents say what is implemented and what is **planned**; planned behaviour is encoded in the e2e
suite, which fails until it is built. Latest batch: [changes/0004](changes/0004-platform-capabilities.md); roadmap and
its status: [plans/](plans/README.md).
