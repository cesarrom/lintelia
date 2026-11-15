# Personas

Who uses Fintivio and what they are trying to get done. Flows for each persona are in [flows.md](flows.md);
the permissions behind the roles are in [../architecture/authorization.md](../architecture/authorization.md).

The platform has three audiences, each with its own identity realm:

| Realm | Who | Signs in at | Identity source |
| --- | --- | --- | --- |
| **Platform** | Fintivio staff ("us") | platform console (`app.<base domain>`, locally `localhost:3001`) | Fintivio accounts; later the company IdP (SSO) |
| **Institution (FI)** | employees of a financial institution | the FI's workspace (`<fi>.<base domain>` or a custom domain) | FI accounts or the FI's own IdP (OIDC/SAML SSO, SCIM) |
| **Client** | the FI's customers and related parties | the FI's branded portal / embedded forms | passwordless e-mail, password, passkeys; never the FI's IdP |

Identities never cross realms: a platform account is not an FI member, and an FI employee who is also a customer of
that FI has two separate identities. This mirrors how B2B2C platforms separate workforce and customer identity
(e.g. Auth0 Organizations vs. customer tenants, Okta Workforce vs. Customer Identity).

---

## Platform staff (Fintivio)

Operate the platform; they are a service provider to regulated institutions, so by default they **must not see FI
customer data**. Reference: SaaS operator models in regulated industries (Microsoft Customer Lockbox, Google Access
Approval, Salesforce "grant login access").

| Role | Wants to | Must not |
| --- | --- | --- |
| **Platform administrator** | manage staff accounts and platform roles, platform configuration, connector catalogue | read FI customer data without an approved support-access grant |
| **Customer success / onboarding** | onboard institutions, manage their lifecycle (suspend, reactivate, offboard), see health/usage | change an institution's flows or decide cases |
| **Support engineer** | troubleshoot an institution's configuration and failed executions, request time-bound access when the FI approves | act on cases, export data, keep access after the grant expires |
| **Platform auditor / security** | review the platform audit log (who onboarded/suspended what, support-access grants) | modify anything |

## Financial institution (tenant)

A bank, credit union, lender, broker, wealth manager or fintech that uses Fintivio to onboard and serve clients.
Roles are modelled on the job functions in KYC/onboarding operations at regulated institutions and on case-management
products used there (e.g. Fenergo, Pega KYC, Alloy, ComplyAdvantage): first-line operations, second-line compliance,
builders, and read-only oversight. Institutions can also define **custom roles** from the permission catalogue.

| Role (system role key) | Who in a bank | Wants to |
| --- | --- | --- |
| **Administrator** (`admin`) | head of digital / IT owner of the workspace | set up the workspace: branding, domains, SSO and security policy, members and roles, integrations, API credentials |
| **Compliance officer / MLRO** (`compliance_officer`) | second line of defence, money laundering reporting officer | own KYC/AML policy, adjudicate screening hits, approve high-risk clients, see the full audit trail, handle data-rights requests |
| **Senior reviewer / team lead** (`senior_reviewer`) | onboarding team lead, "checker" | give second approvals (four-eyes), reassign work, watch queues and SLAs |
| **Reviewer / KYC analyst** (`reviewer`) | first-line onboarding analyst, "maker" | work a queue of cases routed to them, review evidence, request more information, approve or reject within their authority |
| **Relationship manager** (`relationship_manager`) | branch or RM staff, loan officer | start assisted applications for their clients, follow their clients' progress, nudge clients |
| **Flow designer** (`flow_designer`) | product/operations analyst | build forms and workflows, configure triggers and routing, publish versions, embed forms on the FI's sites |
| **Integration manager** (`integration_manager`) | developer / IT integration engineer | connect the FI's systems (databases, APIs, e-mail/SMS, open banking), manage API credentials and webhooks |
| **Support agent** (`support_agent`) | contact centre | look up a client's application status, resend links, record contact notes; no decisions |
| **Auditor** (`auditor`) | internal audit, external auditor, regulator on-site | read everything relevant (cases, flows, audit log) without changing anything |

One person can hold several roles (small institutions often have one admin doing everything); the platform
enforces **segregation of duties** on the actions that matter (nobody approves their own work, see authorization.md).

## Clients (the institution's customers), as broad as it gets

Clients never see Fintivio; they see the institution's brand. A client identity belongs to one institution.

| Client persona | Situation | Wants to |
| --- | --- | --- |
| **Prospective retail customer** | opening an account, applying for a card or loan from the FI's website (embedded form) | start without creating a password, finish on another device, verify identity once, know what is missing and how long it takes |
| **Existing customer** | periodic KYC refresh, product upgrade, address change | reuse what the FI already knows, only provide what changed |
| **Business applicant (KYB)** | opening a business account on behalf of a company | describe the company and its owners, invite directors/UBOs to verify themselves, track everyone's progress |
| **Related party** | director, ultimate beneficial owner (UBO), authorised signatory, co-applicant, guarantor | complete only their own part (identity, signature) from an invitation, without seeing the whole application |
| **Assisted applicant** | onboarded by a relationship manager in a branch or by phone | confirm data entered on their behalf, give consent, sign |
| **Intermediary** (later) | broker or introducer applying on behalf of clients | submit and track applications for the clients they represent (delegated access) |

Rights every client has regardless of the flow: see the status of their own applications, respond to requests for
information, receive notifications, give and withdraw consent, request a copy or erasure of their data (GDPR/CCPA
data-subject rights), and never see another client's data.
