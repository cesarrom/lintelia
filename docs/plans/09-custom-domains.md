# 09 — Custom domains (deferred until the edge provider is chosen)

## What exists

`tenants.allowed_domains`, host-based tenant resolution, CORS for registered hosts, and DNS instructions (CNAME)
produced by `DomainsService` with a fake DNS. No ownership verification, no certificates, no activation state (flow
FIA-03 encodes the target and fails).

## Industry-standard flow (Shopify, Vercel, Zendesk, Intercom…)

1. The institution adds `onboarding.bank.com` in *Settings → Domains* (`domains:manage`).
2. We show the records to create: **ownership** (`TXT _fintivio-challenge.onboarding.bank.com = <token>`) and
   **routing** (`CNAME onboarding.bank.com → <tenant-edge-target>`), plus the certificate validation record when the
   provider uses DNS validation.
3. We poll (and offer "Verify now"); statuses: `pending_verification → verified → certificate_pending → active`
   (or `failed` with the reason: record missing, wrong value, CAA blocks the CA…).
4. On activation: the host resolves to the tenant, CORS/CSP allow it, embed snippets and e-mail links use it, SSO
   redirect URIs are registered with the broker, cookies (if any) are scoped to it.
5. **Continuous checks**: re-verify periodically; if the CNAME disappears, deactivate (prevents subdomain takeover via a
   dangling record); when a tenant removes a domain, remove it from the edge immediately.
6. Audit every step. One domain belongs to one tenant (unique constraint, already enforced by the e2e contract).

Not to be confused with **e-mail domain verification for SSO** (02), which proves the institution owns the domain of
its staff e-mail addresses; both use DNS TXT but are separate records and purposes.

## Per provider

| Edge provider | How certificates and routing work | What we build |
| --- | --- | --- |
| **Cloudflare for SaaS** (Custom Hostnames) | API creates a custom hostname; Cloudflare validates ownership (TXT or HTTP) and issues the certificate; the customer CNAMEs to our fallback origin | calls to the Custom Hostnames API, status polling; simplest option, includes WAF |
| **AWS CloudFront** | certificates from ACM (DNS validation: one CNAME per domain for the customer to add); alternate domain names per distribution are limited (quota, raise or shard distributions); newer CloudFront multi-tenant distributions ("SaaS Manager", distribution tenants with managed certificates) are designed for this — verify availability and limits when deciding | ACM request + validation record display, distribution/tenant update, Route 53 not needed for customer zones |
| **AWS ALB** (no CDN) | ACM certificates attached by SNI, quota on certificates per listener | as above, plus certificate rotation handling |
| **Azure Front Door** (Standard/Premium) | custom domain resource with Azure-managed certificate; validation TXT `_dnsauth.<domain>`; quotas per profile | ARM/SDK calls to create the domain and route, display the TXT |
| **GCP** | Certificate Manager with DNS authorizations and certificate maps on the external HTTPS load balancer | create DNS authorization (customer adds CNAME), certificate, map entry |
| **Vercel** (if the web app is hosted there) | Domains API with verification records | API calls; the API (`apps/core`) still needs its own edge |
| **Self-hosted** (Caddy/Traefik) | on-demand TLS via Let's Encrypt, with an `ask` endpoint that only allows registered, verified domains | the `ask` endpoint + ACME rate-limit awareness |

Implementation shape regardless of provider: a `DomainProvider` port (`register`, `status`, `remove`,
`instructions`) with one adapter per provider, a `domains` table (`tenant_id`, `hostname`, `status`, `verification
token`, `provider_ref`, `last_checked_at`, `failure_reason`), a Restate workflow per domain for verification and
periodic checks, and a fake DNS resolver + fake provider for local/e2e.

## Cross-cutting impacts to remember

- Per-form `frame-ancestors` and app-wide CSP must be produced by a server or edge function for every custom host (10).
- The web app's root host list (`VITE_ROOT_HOSTS`) and CORS allow-list become dynamic (already dynamic in the API).
- E-mails sent "from" the institution's domain (SPF/DKIM/DMARC) are a separate feature (10, e-mail).
