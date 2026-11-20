# Rebrand: Fintivio → Lintelia

The product name changed from **Fintivio** to **Lintelia**. Name only: no colours, logo, typography or behaviour changed.
This file records how the name was chosen, what was renamed, what was kept, and the exact mapping, so people and tools
that still hold the old name (docs, demo kits, the company site) can follow it.

## The name

**Lintelia** (say *lin-TEL-ee-ah*): from *lintel*, the beam over a doorway, plus the Latin-style ending *-ia*. A lintel
is the piece every person passes under to get in, which is what an onboarding and KYC workflow platform is for.
It is short, reads the same in English and Spanish (Spanish *dintel*, so the idea carries), and has no meaning of its
own that we found in English, Spanish or Portuguese that works against a financial product.

**Runner-up: Kyclo** (KYC + cycle). It is more literal and its `.com` shows no records at all, but it ties the brand to
one acronym while the product is a wider onboarding workflow engine. If Lintelia hits a legal problem, switch to Kyclo
(or Vinculia) and re-run the same mapping.

### Shortlist and checks

Dictionary words (Umbral, Atrio, Alta, Portico, Cauce, Hito, Garita, Tamiz, Zaguán…) were tried first and dropped:
every one has `.com`, `.io`, `.app` and `.co` registered. The shortlist is therefore coined or compound names.

| Candidate | Idea | Web search (standard mode) for the name as a fintech / KYC / software company | `.com` | `.io` | `.app` | `.co` |
| --- | --- | --- | --- | --- | --- | --- |
| **Lintelia** | lintel (doorway beam) + -ia | no company found | registered, resolves to an address, no site served | no records | no records | no records |
| Vinculia | *vínculo*, a bond or link | no company found | registered (serves 404) | no records | no records | no records |
| Kyclo | KYC + cycle | no company found | no records at all | no records | registered | no records |
| Umbrio | *umbral*, threshold | no company found | registered | no records | no records | no records |
| Ingresia | *ingresar*, to enter | no company found | registered | no records | no records | no records |
| Admitia | *admitir*, to admit | no company found | registered | no records | no records | no records |
| Acogida | *acogida*, welcome | no company found | registered | no records | no records | no records |
| Bienvenia | *bienvenida*, welcome | no company found | registered | no records | no records | no records |

How to read this: "no records" means `dig NS` returned nothing on 2026-11-20. That is a hint that a domain may be free,
**not** proof. Check a registrar before buying anything. A web search that finds nothing also proves little for a
short coined word.

### What this does not establish

- **No trademark clearance.** Nobody searched trademark registers (USPTO, EUIPO, INPI Argentina, Brazil, Mexico and others),
  and the class for software and financial services needs a real search by a trademark professional before the name
  is used publicly or on a contract.
- `lintelia.com` is already registered by someone else (it resolves, but no site answered). Domain strategy is open:
  contact the holder, or use another TLD.
- The name must not clash with the other products (deseo, Cleude, GuideOn, Visitr, Loretia, Laburauto, Flow Mind,
  Wonder Scribe, Car Empower, Quick Response, ASKN) or with Didit. It does not.

## Mapping (old → new)

| Old | New | Notes |
| --- | --- | --- |
| `Fintivio` | `Lintelia` | UI strings, titles, emails, docs, class and type names (`FintivioClient` → `LinteliaClient`, `FintivioApiError` → `LinteliaApiError`, `useFintivio` → `useLintelia`, …) |
| `fintivio` | `lintelia` | identifiers, paths, keys, storage keys (`fintivio.sidebar.collapsed` → `lintelia.sidebar.collapsed`) |
| `FINTIVIO` | `LINTELIA` | env vars (`FINTIVIO_API`, `FINTIVIO_STACK_DETACHED`), the development TOTP secret (`LINTELIADEVSTAFFSECRETAAAAAAAAAA`, still 32 base32 characters) |
| `packages/fintivio` | `packages/lintelia` | directory moved with `git mv` (70 files, history kept) |
| `@repo/fintivio/*` | `@repo/lintelia/*` | workspace package and its subpath exports |
| `@fintivio/client-sdk`, `@fintivio/widget-sdk` | `@lintelia/client-sdk`, `@lintelia/widget-sdk` | |
| `fintivio-client.js` | `lintelia-client.js` | embeddable script |
| `/.well-known/fintivio-connector.json` | `/.well-known/lintelia-connector.json` | connector manifest path |
| `x-fintivio-signature`, `x-fintivio-tenant`, `X-Fintivio-Case`, `Fintivio-Webhooks/1.0` | `x-lintelia-*`, `Lintelia-Webhooks/1.0` | HTTP header and user-agent names |
| `data-fintivio-app`, `data-fintivio-host`, `data-fintivio-form`, `window.fintivioApp` | `data-lintelia-*`, `window.linteliaApp` | embed attributes |
| `fintivio_app`, `fintivio_platform` | `lintelia_app`, `lintelia_platform` | PostgreSQL roles, also in migrations (see below) |
| `fintivio_app_local`, `fintivio_platform_local` | `lintelia_app_local`, `lintelia_platform_local` | local development database and role names |
| `staff@fintivio.local`, `no-reply@fintivio.local`, `fintivio.local` | `…@lintelia.local` | seeded local accounts and hosts |
| `fintivio.dev`, `api.fintivio.com`, `fintivio.demo` (incl. `uk.`, `us.` subdomains), `didit.connectors.fintivio.dev` | `lintelia.example` (same subdomains) | made-up domains became `.example`; no real domain was invented |
| `fintivio-usercontent.com` | `lintelia-usercontent.example` | |
| `fintivio-dev-password` | `lintelia-dev-password` | password of every seeded development account |
| `Fintivio-Admins` | `Lintelia-Admins` | seeded directory group name |

## What was renamed

523 files were edited (about 1,840 lines) and 70 files moved with the package directory. By area:

| Area | Files edited |
| --- | ---: |
| `apps/web` (UI, titles, storage keys, hooks) | 242 |
| `apps/core` API, scripts and tests | 129 |
| connectors, fake services, other `packages/*` | 107 |
| SQL migrations (`apps/core/drizzle`) | 43 |
| Markdown docs and notes (readme, TESTING, LOCAL-DEV-NOTES, docs/…) | 35 |
| `apps/e2e` | 23 |
| root files (`package.json`, `bun.lock`) and other | 5 |

`git grep -il fintivio` returns only this file. The lockfile was updated by the package manager (`bun install` accepted it
unchanged). The three local, git-ignored `.env` files were updated the same way on the machine that did the rename;
copy the same substitution into any other `.env` you keep.

## Kept on purpose

- **The checkout folder** `~/code/fintivio-nx` and the **git remotes** (`origin` = `cesarrom/fintivio`, `fintivio-banking`).
  Renaming a repository is a separate, reversible step on GitHub; nothing here depends on it.
- **Git history.** Old commits still say Fintivio.

## Things that behave differently because the name is part of them

None of these has a deployed counterpart in this repository, but anyone outside it would notice:

- **Database roles.** Migration `0000_bootstrap.sql` and the following ones create and grant `lintelia_app` and
  `lintelia_platform`. A development database created earlier keeps the old role names. Reset it
  (`bun run db:reset`), or rename the roles once before migrating:
  `ALTER ROLE fintivio_app RENAME TO lintelia_app; ALTER ROLE fintivio_platform RENAME TO lintelia_platform;`.
  Any real environment that already ran the old migrations must do that rename (or keep the old identifiers) before
  deploying this branch. There is none documented in the repository.
- **Webhook and API names.** Integrations that read `x-fintivio-signature` or fetch `fintivio-connector.json` must
  switch to the new names.
- **Browser storage keys** (for example the sidebar state) restart empty once.
- **Local seeded password** is now `lintelia-dev-password`; the staff TOTP development secret changed (run `bun run totp`).

## Verification

See the pull request or the report that came with this branch for what was run. Known pre-existing issues, unrelated to
the rename: `packages/lintelia` reports 20 TypeScript errors about iteration targets (same 20 before the rename) and
`apps/web` reports about 200 type errors in legacy screens, as `LOCAL-DEV-NOTES.md` says.
