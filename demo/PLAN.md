# Lintelia sales video kit: production plan

Date: 2026-11-21. Repository: fintivio-nx, branch rebrand/lintelia. Written by the planner; the producing agent records and composes from this file and from `demo/plan.json`.
The product name is only **Lintelia**. Everything here is derived from the repository (readme, docs/, apps/web, the 84 e2e spec files, the finished kits of cleude and flow-mind). Nothing was run: no stack, no OpenRouter, no git changes, no .env touched.

## 0. Decisions in one screen

- **Make 13 videos, each in English and in Latin American Spanish (26 files):** the pitch reel, nine product stories and three short clips. One voice per video, sixty to one hundred English words per story, about 120 words a minute.
- **Estimated new spend: 1.04 USD** (0.84 narration, 0.06 speech-to-text check, 0.14 reserve for retakes). The envelope is 1.8 USD; 0.3788 USD was already spent on draft narration (sunk), so the ceiling for new spend is 1.42 USD. Ledger: 11.9645 of 15 USD used before this plan. Headroom of about 0.39 USD pays for the stretch videos S5 and S8 (about 0.16 USD together).
- **Tiers:** P1 the reel (L01) and tenant onboarding (L02); P2 customer onboarding (L03) and the reviewer's KYC decision (L04); P3 roles and four-eyes (L05), audit and evidence (L06), automatic versus manual (L07); P4 institution admin (L08), workflow design (L09), customer app (L10); P5 three edge-case clips (C1 to C3).
- **Reuse before recording:** six demo specs already exist (d01 to d07) and cover L02, L03, L05, L07, L09 and C3. Six new demo specs are needed (d08 to d13, all short). The reel needs no recording: it is cut from the others.
- **Cut, with reasons (section 2.3):** the loan-based reviewer video (replaced by the KYC one), dealer finance (seven minutes, five simulated systems), every API-only spec (51 files, cannot be shown on screen), and the UI specs whose pictures are weak (SSO, webhooks, integrations, embedded app, support access).
- **Honest limits are non-negotiable** (section 1.4): demo data, simulated providers, no regulatory claims, no invented numbers, no URL.

## 1. Audience and message

### 1.1 Who watches

| Audience | Role | What they want to know | Which videos |
|---|---|---|---|
| Buyers (primary) | Heads of operations, compliance, product and IT at banks, credit unions, lenders and fintechs in Latin America and beyond | Can this onboard customers without paper, keep a person in charge of hard cases, and let me prove what happened afterwards? | L01 first, then L03, L04, L05, L06 by interest |
| Buyers (platform) | IT and security leads, institution administrators | How is a new institution set up, who gets which access, who approves sensitive changes? | L02, L08, L09 |
| Investors (secondary) | Angels and funds looking at a multi-institution platform | Is it real, and is it more than a form? One minute, problem first, only what the repository proves | L01 only |

### 1.2 Three jobs the buyer is hiring the product for

1. **Onboard customers.** Take a person from application to an approved account: identity check, signature, decision, with no paper and no chasing. (L03, L09, L10)
2. **Decide with control.** Decide automatically where the case is clear, route the rest to the right person, require a reason, and require two different approvers when the amount is large. (L04, L05, L07)
3. **Show your work.** Answer compliance and auditors: who did what, when, under which role, with evidence per case. (L06, L08, L02)

The platform side (L02, L08, L09) answers a fourth, smaller question: the institution runs it on its own, without the vendor.

### 1.3 One-sentence promise

> **EN:** Lintelia runs customer onboarding and KYC for a financial institution as one workflow: an identity check, a signature, automatic decisions where the case is clear, a person where it is not, and a complete audit trail.
>
> **ES:** Lintelia gestiona la incorporación de clientes y el KYC de una institución financiera como un solo flujo: verificación de identidad, firma, decisiones automáticas cuando el caso es claro, una persona cuando no lo es, y un registro de auditoría completo.

The reel says it in pictures; no video reads this sentence aloud word for word. It is the test for every line: if a line does not serve one of the three jobs, cut it.

### 1.4 Honest limits (apply to every video)

| Rule | How it shows up |
|---|---|
| Demo data only | Northwind Bank and invented people. Every video carries the standing note: `Demo data · identity check, e-signature and e-mail are simulated · interface in English`. |
| Providers are simulated | Identity verification (Didit), e-signature (Documenso), e-mail, SMS and screening run as local fake services. Say "simulated" in the caption of the provider scene (L03, L04) and in the closing card of the reel. Do not borrow the vendors' own marketing claims. |
| No regulatory claims | No GDPR, SOC 2, ISO, PSD2, "bank-grade", "compliant", "certified". Say what the product does (append-only, tamper-evident, role-based), never what it is certified for. |
| No invented numbers | On-screen numbers are demo data. The fifty-thousand limit in L05 is the example workflow's setting and is said as an example. No speed claims ("in minutes"), no customer counts, no market size, no uptime. The repository's test counts are not quoted: they change with every run. |
| Name | Only "Lintelia". No URL on any card (no trademark clearance, and lintelia.com is held by someone else, docs/REBRAND.md). Never show the old name: check page titles, e-mail templates and the embed snippet (`data-lintelia-form=`). |
| No hype | No seamless, powerful, effortless, revolutionary, cutting-edge. No AI claims: the product has an AI connector, but no recorded story uses it. |
| Language | The interface stays English; the Spanish videos narrate over it and say so in the note. Spoken forms (memory: Spanish as spoken): "veinticuatro horas", "cincuenta mil", no digits, no "h". Neutral Latin American Spanish, "tú" when addressing the viewer. KYC is written `K Y C` in narration so the voice spells it. |

### 1.5 Style rules for the producing agent

- Pace about 120 words a minute: one idea per line, 6 to 18 words per line, sixty to one hundred English words per story (the reel and L02 about one hundred, clips twenty to forty).
- One voice per video; the five voices (Brian, Bella, Adam, Daniel, Sarah) rotate so neighbouring videos differ. English and Spanish of one video use the same voice.
- Zoom on the important region while it is spoken about (focus() spotlight in the spec, composer zoom up to 1.7), then leave a digest pause before the next scene (section 4.5).
- Names exactly as the interface shows them (Sofia, Mia); same cast in every video (section 4.3).

## 2. Inventory of candidate stories

### 2.1 Recommended (thirteen videos)

| Id | Working title | Audience | E2E specs reused | Capability proved | Visual (1-5) | Est. length | Tier | Languages | Voice | Est. USD (EN+ES, with check) |
|---|---|---|---|---|---|---|---|---|---|---|
| L01 | Pitch reel: one workflow from onboarding to audit | Buyers (heads of operations, compliance, product at banks, lenders, fintechs) and investors | demo/d01-tenant-onboarding; demo/d02-customer-kyc; demo/d08-kyc-manual-review; demo/d05-automation-paths; demo/d04-roles-audit-automation; demo/d09-audit-evidence | The whole product in 80 seconds: onboard an institution, verify and sign, human review when needed, automatic decisions, two approvers, audit trail | 5 | 92 s | P1 | EN + ES | Brian | 0.12 |
| L02 | Onboarding an institution, end to end | Heads of IT and operations at banks and lenders; investors (multi-tenant platform) | staff/platform-console.ui; fi-admin/first-sign-in.ui; fi-admin/access.ui (roles page); demo/d01-tenant-onboarding | Multi-tenant onboarding: staff create a workspace, the administrator is invited, sets a password, enrols a second factor and lands in a ready workspace with system roles; the platform audit log records it | 4 | 105 s | P1 | EN + ES | Daniel | 0.11 |
| L03 | A customer opens an account: apply, verify, sign, approved | Product and onboarding leads at banks, lenders and fintechs | clients/apply-embedded.ui; clients/verify-and-sign.ui; demo/d02-customer-kyc | Client journey: apply on the institution's own website, confirm the e-mail, verify identity and sign inside the portal, get approved, while the team sees verification, signature and signed file | 5 | 84 s | P2 | EN + ES | Bella | 0.08 |
| L04 | When the identity check is inconclusive, a person decides | Compliance officers, operations leads, risk owners | fi-roles/reviewer-inbox.ui; scenarios/retail-account-opening.api (SCN-03 as the outline); demo/d03-reviewer-decision (retired: fallback) | Manual review of an inconclusive KYC result: the case lands in the team queue, a reviewer claims it, reads the evidence, cannot reject without a reason, approves with a reason, the workflow moves on to signature | 4 | 80 s | P2 | EN + ES | Adam | 0.08 |
| L05 | Who can do what: roles and the two-approver rule | Compliance, risk and internal audit; heads of operations | scenarios/loan-pre-approval.ui; fi-roles/reviewer-inbox.ui; fi-admin/access.ui (roles page and matrix); demo/d04-roles-audit-automation (scenes 1-5, 7-8 of the old file) | Role-based visibility and segregation of duties: a first-line reviewer does not see a large loan, a senior gives the first approval, the same person cannot give the second, a different senior does; the roles page and matrix show the model | 4 | 91 s | P3 | EN + ES | Sarah | 0.08 |
| L06 | The audit trail and the evidence pack | Compliance officers, internal and external auditors, risk owners | fi-admin/audit.api (claims); fi-roles/compliance.api (claims); scenarios/retail-account-opening.api SCN-08; fi-admin/access.ui; demo/d09-audit-evidence (new) | Evidence and audit: a hash-chained case timeline, a per-case evidence pack export, the institution audit log and its JSON Lines export | 4 | 68 s | P3 | EN + ES | Brian | 0.07 |
| L07 | Automatic when it is clear, a person when it is not | Heads of operations, credit and product; buyers who ask how much stays manual | scenarios/loan-pre-approval.ui; scenarios/loan-origination.api (rules); fi-roles/workflow-editor.ui; demo/d05 (second test of the old d04 file) | Rules-driven routing: a small affordable loan is approved automatically, an unaffordable one declined with an e-mail, a mid-size one waits for a reviewer; the rules live in an editable, versioned workflow | 3 | 69 s | P3 | EN + ES | Bella | 0.07 |
| L08 | The institution's administrator: team, roles and second approval | Institution administrators, security and IT leads | fi-admin/team-and-roles.ui; fi-admin/access.ui; fi-admin/team.api; fi-admin/access-changes.api | Team administration: invite a reviewer, the reviewer's reduced menu, privileged changes that wait for a second administrator, all logged | 3 | 63 s | P4 | EN + ES | Adam | 0.06 |
| L09 | Build a form and a workflow, and embed it on the bank's site | Product owners and flow designers; partners who integrate | scenarios/loan-pre-approval.ui; fi-roles/workflow-editor.ui; fi-roles/flow-designer.api (claims); demo/d06-workflow-config | No-code design: a form built on a canvas, a workflow from a template, publish, and one snippet to embed the form on the institution's website | 4 | 93 s | P4 | EN + ES | Daniel | 0.07 |
| L10 | The bank's own customer app, built in a studio | Product and digital leads at banks and credit unions | client-app/studio.ui; client-app/banking-app.ui; client-app/map.ui | Client app studio: template, live preview, publish; the customer app on a phone (accounts, move money, freeze card); the experience map | 5 | 73 s | P4 | EN + ES | Sarah | 0.06 |
| C1 | Clip: a file with a virus is refused, a clean one reaches the case | Operations and security reviewers | clients/uploads.ui; clients/uploads.api (claims) | Document intake: malware refused in the portal, a clean statement accepted, the team sees it scanned and downloads it | 4 | 37 s | P5 | EN + ES | Sarah | 0.03 |
| C2 | Clip: a customer asks for their data and for erasure | Compliance and privacy officers | clients/data-rights.ui; clients/privacy.api (claims); fi-roles/compliance.api (claims) | Data-rights requests: the customer asks for a copy and for erasure; the compliance team completes them on the request | 3 | 27 s | P5 | EN + ES | Bella | 0.02 |
| C3 | Clip: suspend and reactivate an institution | Platform operators; risk and procurement | staff/platform-console.ui; staff/tenants.api (claims); demo/d07-suspend-reactivate | Lifecycle control: staff suspend an institution, its sign-in page no longer knows it, staff reactivate it | 3 | 32 s | P5 | EN + ES | Brian | 0.03 |

Total estimated narration and checking: **0.90 USD**; with reserve **1.04 USD**.

Why each one makes the cut:

- **L01** (P1): First thing a buyer or investor opens. Problem first, then proof in six shots. It costs no recording because it is cut from the other stories.
- **L02** (P1): Proves the platform side of the sale: a new bank is live in a few clicks, with security on by default. Strongest P1 story after the reel.
- **L03** (P2): The core buyer job (onboard customers quickly and safely) shown the way the customer lives it. The phone parts give visual variety.
- **L04** (P2): Shows the human-in-the-loop half of KYC: the part that regulators and risk teams ask about. Replaces the loan-based d03 because it is the same product story as L03.
- **L05** (P3): The question every risk owner asks is who can do what. Segregation of duties is visible and unambiguous on screen.
- **L06** (P3): Audit is the sentence that closes a compliance buyer. Each claim is backed by an API spec or by the product's own wording.
- **L07** (P3): Answers the first objection ('will this replace my analysts?'): it automates the clear cases and keeps people on the rest.
- **L08** (P4): Security buyers want to see access control as a working screen, not a claim. Short, and cheap to record.
- **L09** (P4): Shows self-service: the bank's designer does this, not Lintelia staff. The embedded result closes the loop with L03.
- **L10** (P4): The most visual story in the set, and the one that makes a lender picture their own app. Last of the ten main videos because its footage is the least rehearsed.
- **C1** (P5): A concrete, visible safety feature in 35 seconds. Cheap: about 40 words.
- **C2** (P5): Privacy officers look for this. Two lines of narration, about 25 words.
- **C3** (P5): Footage already exists; costs about 20 words.

### 2.2 Stretch (add only if the stop-lines of section 5.3 leave room)

| Id | Working title | Audience | E2E specs | Capability | Visual | Est. length | Tier | Languages | Voice | Why stretch, not now |
|---|---|---|---|---|---|---|---|---|---|---|
| S5 | Suspicious activity: flag, investigate, MLRO decision, client not told | MLRO, compliance | scenarios/suspicious-activity.ui; fi-roles/compliance.api | Relationship manager flags a client, triage, investigation, MLRO decision, the client is never told, auditor read-only | 4 | 75 s | P5 | EN + ES | - | Strongest unused story (visible UI, clear outcome) and the first to add if the budget stays under the stop-line. Estimated 0.09 USD, 4 personas, needs its own rehearsal. |
| S6 | Business onboarding: every owner must verify | Business lenders | clients/related-parties.ui; scenarios/kyb.api | KYB: owner invited, verifies, review starts | 3 | 70 s | P5 | EN + ES | - | Good second vertical, but it repeats L03 with an extra person; add only after S5. |
| S7 | Assisted application by a relationship manager | Branch-based lenders | fi-roles/assisted-application.ui; fi-roles/relationship-manager.api | RM starts the loan for the customer, who confirms by link and code, reviewer decides | 3 | 70 s | P5 | EN + ES | - | Useful for branch-led banks; overlaps L04. |
| S8 | Sign-up and ID upload inside the client app | Digital leads | client-app/banking-app.ui (APP-03/04) | Consents, ID upload journey checked by the team | 4 | 60 s | P5 | EN + ES | - | Fits after L10; its scenes can be cut from the same d11 recording session. |
| S9 | Back-office studio: the institution's own screens | Operations leads | back-office/back-office.ui; back-office.api | Per-role home screens, fee waiver within and above an authority limit | 4 | 100 s | P5 | EN + ES | - | Impressive, but long and needs a fee-waiver data set; later. |
| S10 | Pay with a QR code | Payments teams | client-app/pay-with-qr.ui; ui-blocks.api | Full-screen scanner, countdown, branding presets | 4 | 40 s | P5 | EN + ES | - | Visual, but a different product conversation (payments); only if a payments buyer asks. |
| S11 | Live updates: a balance changes when the core system writes it | Digital leads | live/live.ui; live.api | Balance changes on screen without reload; queue fills | 3 | 40 s | P5 | EN + ES | - | Nice 40 seconds, but depends on the simulated core system, which invites over-claiming. |

Order of addition: S5 first (strongest), then S8 (same recording session as L10), then S6, S7, S9. Each is about 0.08 to 0.10 USD.

### 2.3 Not worth making (and why)

| Id | Candidate | E2E specs | Visual | Reason |
|---|---|---|---|---|
| S12 | Dealer finance end to end | scenarios/dealer-finance.ui; dealer-finance.api | 5 | Seven minutes, five simulated systems and four personas: a project of its own, far above 0.10 USD and above the recording risk this plan accepts. |
| X1 | Embedded client app in a bank website | client-app/embedded.ui | 2 | An iframe on a plain page; a developer detail with little visual outcome. |
| X2 | API clients and webhooks | fi-admin/api-clients-webhooks.ui; .api; webhooks.api | 2 | Secrets on screen, developer audience; it belongs in documentation. |
| X3 | Connect an integration (SMTP) | fi-admin/integrations.ui; fi-roles/integrations.api | 2 | Configuration screens with no business outcome. |
| X4 | Single sign-on and SCIM | fi-admin/sso.ui; sso-scim.api; idp-roles.api; staff-sso.api | 1 | Redirects through a fake identity provider: weak picture, claims better made in text. |
| X5 | Time-bound support access | staff/platform-console.ui; support-access.api | 2 | Two-realm approval is hard to follow in 60 seconds; security buyers read it in documentation. Revisit if a buyer asks. |
| X6 | Security assurance: isolation, sessions, authorization matrix | cross-cutting/*.api; fi-roles/authorization-matrix.api | 1 | Cannot be shown honestly on screen; no video and no number in any narration. |
| X7 | Reminders, expiry, SLA escalation; AML screening adjudication | scenarios/timeouts.api; scenarios/aml-screening.api | 1 | Time-based (nothing to watch) and screening has no UI test: showing it would need new product work. |
| L-old | Loan applicant and reviewer decision (d03) | demo/d03-reviewer-decision | 4 | Retired as a video: L04 tells the same human-review story on the account-opening journey, so the set has one product story (identity) instead of two. Kept as the fallback for L04 (section 3). |

Also not made: **every API-only spec** (51 of 84 files, listed in Appendix A). They back claims (isolation, sessions, hash chain, webhooks, SSO) but there is nothing to film; where a claim is made in narration, an API spec proves it, and where none does, the claim is not made.

## 3. Shot lists

Conventions. **Spec / test** names the demo spec and the `scene()` number it produces (section 4.1); **Zoom** is the UI region the composer should enlarge and why; **Footage** is the minimum seconds the spec must hold the scene so the composer never freezes a frame (lead, longest of the two narrations at 120 words a minute, breath and digest); **Digest** is the quiet time after the line. Captions are the on-screen text of the line (EN / ES). Phone scenes use the portrait bezel centred in the 16:9 frame (section 4.5). Narration is written as spoken; English and Spanish line numbers match scene numbers.

### L01. Pitch reel: one workflow from onboarding to audit

- **Tier P1**, voice **Brian**, estimated length **92 s**, narration **101 English words / 119 Spanish words**, estimated cost **0.12 USD**. File names: `videos/01-pitch-reel-en.mp4`, `videos/01-pitch-reel-es.mp4`.
- **Audience:** Buyers (heads of operations, compliance, product at banks, lenders, fintechs) and investors.
- **Capability:** The whole product in 80 seconds: onboard an institution, verify and sign, human review when needed, automatic decisions, two approvers, audit trail.
- **Source:** Re-uses the footage of L02, L03, L04, L07, L05 and L06 (no new recording); composed last.
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| card | no spec | Title card: THE PROBLEM / Opening an account is more than a form / An identity check, a signature, a person who decides | - | - | 4.5 | - | - | Spoken card |
| 2 | d01 step 2 | Staff console, Onboard institution dialog filled in (Northwind Bank, workspace key, administrator e-mail) | Dialog fields: the three inputs show how little it takes | Dialog already open from L02 footage | 13 | 1.5 | One workspace per institution / Un espacio por institución | - |
| 4 | d02 step 4 | Phone: provider page, then signature, then Approved | Phone frame, centred bezel; caption column right | Approve, Sign (taps from L03 footage) | 10 | 1.5 | Verify and sign on a phone / Verificar y firmar desde el teléfono | - |
| 3 | d08 step 3 | Reviewer reads the inconclusive verification (warning: Document photo is blurry) | task-row evidence block | From L04 footage | 12 | 1.5 | A person decides, with a reason / Una persona decide, con una razón | - |
| 2 | d05 step 2 | Case page, status Approved, no task | case-status badge | From L07 footage | 8 | 1.5 | Automatic when the case is clear / Automático cuando el caso es claro | - |
| 5 | d04 step 5 | Case with two decisions by two different seniors | decision blocks | From L05 footage | 10 | 1.5 | Two different approvers / Dos aprobadores distintos | - |
| 2 | d09 step 2 | Case timeline with the footer 'Tamper-evident: every entry is hash-chained to the previous one' | Timeline footer plus last entries | From L06 footage | 13 | 2.0 | Append-only audit trail / Auditoría solo de adición | - |
| card | no spec | Title card: LINTELIA / Lintelia / Onboarding and KYC workflows for financial institutions | - | - | 4.0 | - | - | Spoken card |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| card | Opening an account is more than a form. There is an identity check, a signature, and a person who decides. | Abrir una cuenta es más que un formulario. Hay una verificación de identidad, una firma y una persona que decide. |
| d01 step 2 | Staff onboard each new institution into its own workspace, from one console. | El personal incorpora cada institución nueva en su propio espacio de trabajo, desde una sola consola. |
| d02 step 4 | Customers verify their identity and sign from their phone. | Los clientes verifican su identidad y firman desde el teléfono. |
| d08 step 3 | When a check is inconclusive, a reviewer decides and has to give a reason. | Cuando una verificación no es concluyente, un revisor decide y debe dar una razón. |
| d05 step 2 | Clear-cut cases are decided automatically. | Los casos claros se deciden automáticamente. |
| d04 step 5 | Large decisions can require two different senior approvers. | Las decisiones grandes pueden exigir a dos aprobadores senior distintos. |
| d09 step 2 | And every action lands in an append-only, tamper-evident audit trail. | Y cada acción queda en un registro de auditoría solo de adición, con evidencia de manipulación. |
| card | Lintelia. Onboarding and K Y C workflows for financial institutions. Everything you saw is demo data, with simulated identity, signature and e-mail providers. | Lintelia. Flujos de incorporación y K Y C para instituciones financieras. Todo lo que viste son datos de demostración, con proveedores simulados de identidad, firma y correo. |

Words: 101 EN, 119 ES; characters 642 / 744; at 120 words a minute about 50 s of speech in English.

Assembly: The reel is assembled from other stories' footage. Its step numbers refer to those specs' scene numbering (section 4), so those numbers must not change after recording.

Risks:

- Depends on five other recordings: compose it last, and re-check the step numbers if any spec changes.
- Investor angle: only the closing card is about the company. No market size, customer or revenue claims; none exist in the repository.
- No URL on the closing card: the name has no trademark clearance and lintelia.com is held by someone else (docs/REBRAND.md).

### L02. Onboarding an institution, end to end

- **Tier P1**, voice **Daniel**, estimated length **105 s**, narration **102 English words / 119 Spanish words**, estimated cost **0.11 USD**. File names: `videos/02-tenant-onboarding-en.mp4`, `videos/02-tenant-onboarding-es.mp4`.
- **Audience:** Heads of IT and operations at banks and lenders; investors (multi-tenant platform).
- **Capability:** Multi-tenant onboarding: staff create a workspace, the administrator is invited, sets a password, enrols a second factor and lands in a ready workspace with system roles; the platform audit log records it.
- **Source:** Revise d01 (recorded once already; scenes 1-7 exist, add the Roles scene, fix names).
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 1 | d01 test, scene 1 (platform-console STAFF-01/02) | Operator console, Institutions list: Acme Credit Union, Demo Auto Finance, Demo Bank, all Active | institution-row region of the first row plus the table header: shows 'many institutions, one console' | Mouse rests on the table; slow hover over the first row | 13 | 2.0 | One console, one workspace per institution / Una consola, un espacio por institución | Seed the three list rows once (acme-credit, demo-auto, demo-bank exist in the seed). Warm the page before the scene so no skeleton shows. |
| 2 | d01 scene 2 | Onboard institution dialog: name Northwind Bank, workspace key, administrator e-mail olivia.owner@... | Dialog body (three fields) so the viewer can read what is asked | Click Onboard institution; type name and e-mail with typeSlow 70 ms | 15 | 2.0 | Name, workspace key, administrator / Nombre, clave de espacio, administradora | Slow the typing (70 ms) and keep the dialog open 2 s before submit. Use the fixed address olivia.owner@northwind.example style, not a random suffix. |
| 3 | d01 scene 3 | List again with Northwind Bank at the top, status Invited | The new row (focus() already spotlights it) | Click the submit button, then rest | 11 | 2.0 | Workspace created, invitation sent / Espacio creado, invitación enviada | Check the status chip reads Invited (not a spinner) before the beat. |
| 4 | d01 scene 4 | Local mailbox page with the invitation e-mail open | Message header and the Accept button area | Open the message; no click on the link until scene 5 | 10 | 1.5 | E-mail (simulated) / Correo (simulado) | Mailbox page must show a clean message list; delete other test mail before recording. |
| 5 | d01 scene 5 (first-sign-in FIA-01) | Activation page: choose a password | Password form card | Type password with typeSlow; click Activate | 9 | 1.5 | Choose a password / Elegir una contraseña | Mask the password field (it is dots by default). Hold 1 s on the filled form. |
| 6 | d01 scene 6 (fi-admin/security-policy: MFA on by default) | Second-factor enrolment: QR code and six-digit field | QR plus code field | Type the current code; Confirm | 13 | 2.0 | Second factor required by default / Segundo factor obligatorio por defecto | The QR holds a throw-away secret: fine on screen. Do not show the plain-text secret field if it appears. |
| 7 | d01 scene 7 | Northwind Bank back office: Dashboard (sidebar Work, Build, Administration) | Sidebar plus dashboard header | Rest; no click | 8 | 1.5 | A ready workspace / Un espacio listo | Dashboard must not be empty-looking: seed nothing fake, but wait for the 'Live' chip to be green. Sidebar shows the person's name, not admin.<hex>@: create the admin as Olivia Owner. |
| 8 | d01 scene 8 (new; access.ui roles page) | Administration, Roles: Custom roles (none yet) and system roles Administrator and Auditor with their permission chips | The Administrator card: 49 permissions as chips | Click Roles in the sidebar; slow scroll 200 px | 13 | 2.0 | System roles, custom roles / Roles del sistema y propios | New scene: the old d01 only showed the users list. The screens/admin-roles.png still is exactly this view. |
| 9 | d01 scene 9 (staff-management STAFF-06) | Platform console, Audit log: onboarding and activation rows | Top three rows of the log | Switch to the staff window; click Audit log | 13 | 2.0 | Platform audit log / Auditoría de la plataforma | - |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 1 | Each institution gets its own workspace. Staff see them all in one console. | Cada institución tiene su propio espacio de trabajo. El personal las ve todas en una consola. |
| 2 | To add a bank, staff type its name, a workspace key and its administrator's e-mail. | Para sumar un banco, el personal escribe su nombre, una clave de espacio y el correo de su administradora. |
| 3 | The workspace exists at once, and the invitation goes out. | El espacio queda creado al instante y la invitación sale por correo. |
| 4 | The invitation arrives by e-mail. This mailbox is a local simulation. | La invitación llega por correo. Este buzón es una simulación local. |
| 5 | She follows the link and chooses a password. | Ella abre el enlace y elige una contraseña. |
| 6 | Every new institution must use a second factor, so she enrols an authenticator app. | Toda institución nueva debe usar un segundo factor, así que ella registra una aplicación de autenticación. |
| 7 | Her workspace is ready. | Su espacio de trabajo está listo. |
| 8 | Roles are already in place, from administrator to auditor, and she can add her own. | Los roles ya están definidos, de administrador a auditor, y ella puede añadir los suyos. |
| 9 | Back in the console, every step is in the platform audit log. | De vuelta en la consola, cada paso queda en el registro de auditoría de la plataforma. |

Words: 102 EN, 119 ES; characters 579 / 690; at 120 words a minute about 51 s of speech in English.

Layout: One test, nine scenes, three windows (staff, mailbox, administrator).

Risks:

- Second-factor step depends on the TOTP helper timing (codes are one-time): record scene 6 early in a 30 s window.
- The workspace key and e-mail domain carry a random suffix in the current helper (demoTenant): fix the suffix to a stable one before recording.
- Mailbox page is a simulation of e-mail; the caption says so.

### L03. A customer opens an account: apply, verify, sign, approved

- **Tier P2**, voice **Bella**, estimated length **84 s**, narration **86 English words / 94 Spanish words**, estimated cost **0.08 USD**. File names: `videos/03-customer-onboarding-en.mp4`, `videos/03-customer-onboarding-es.mp4`.
- **Audience:** Product and onboarding leads at banks, lenders and fintechs.
- **Capability:** Client journey: apply on the institution's own website, confirm the e-mail, verify identity and sign inside the portal, get approved, while the team sees verification, signature and signed file.
- **Source:** Rewrite d02 to start on the bank's website; scenes 3-7 are the existing d02 steps.
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 1 | d02 scene 1 (apply-embedded CLI-03) | Bank's own website (styled page, brand colours) with the account-opening form embedded | The embedded form card | Type name and e-mail with typeSlow 70 ms; click Continue | 14 | 2.0 | On the bank's website / En el sitio web del banco | The draft FakeWebsite is a bare Times-font page: style it (logo, heading, one hero line, colours of Northwind Bank). New helper accountInstitution() mirroring loanInstitution() with the retail-account-opening workflow and a two-field form. |
| 2 | d02 scene 2 | Confirm-your-e-mail step of the form (six-digit code field), step 2 of 3 | The step indicator and the code field | Type the code taken from the simulated mailbox (read it with waitForEmail) | 11 | 1.5 | E-mail confirmed first / Primero se confirma el correo | If the account-opening form has no e-mail step, drop scenes 1-2 and open on scene 3 (fallback, saves 25 words). |
| 3 | d02 scene 3 (verify-and-sign) | Phone: customer portal case page listing 'Verify your identity' and 'Sign your agreement' | client-request list (first card) | Rest; no touch | 11 | 2.0 | What the bank needs / Lo que el banco necesita | Phone window 390x844 inside the centred bezel. |
| 4 | d02 scene 4 | Phone: verification page of the simulated provider, outcome button Approve | Provider iframe (whole phone screen) | Tap Approve | 12 | 2.0 | Identity check (simulated provider) / Verificación de identidad (proveedor simulado) | Wait for the iframe's Approve button to be visible and rest 3.5 s before tapping: no loader on screen. |
| 5 | d02 scene 5 | Phone: Retail account agreement in the signature provider (simulated) | Agreement title and the Sign button | Tap Sign | 11 | 2.0 | E-signature (simulated provider) / Firma electrónica (proveedor simulado) | - |
| 6 | d02 scene 6 | Phone: case page with status Approved | Status line and approval message | Rest | 11 | 2.5 | Approved, customer told / Aprobado, la clienta informada | - |
| 7 | d02 scene 7 | Team web window: case page, Connected systems (Verification approved, Signature signed), Files (signed-<n>.pdf scanned clean), timeline | The 'Connected systems' card with both green chips, then the file row | Switch to the team window; scroll 150 px | 14 | 2.5 | One case, full record / Un caso, el registro completo | screens/team-case-record.png is exactly this state. Make sure the case reference is shown, not a UUID. |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 1 | Ada opens an account from her bank's own website, with a form that Lintelia serves. | Ada abre una cuenta desde el sitio web de su banco, con un formulario que sirve Lintelia. |
| 2 | Nothing is submitted until she confirms her e-mail with a code. | No se envía nada hasta que ella confirma su correo con un código. |
| 3 | On her phone she sees exactly what the bank needs from her. | En su teléfono ve exactamente lo que el banco necesita de ella. |
| 4 | She verifies her identity on the provider page. Here the provider is simulated. | Ella verifica su identidad en la página del proveedor. Aquí el proveedor es simulado. |
| 5 | Then she signs the account agreement in the same flow. | Después firma el contrato de la cuenta dentro del mismo flujo. |
| 6 | The account is approved, and she sees it at once. | La cuenta queda aprobada y ella lo ve al instante. |
| 7 | The bank's team sees the verification, the signature and the signed file on one case. | El equipo del banco ve la verificación, la firma y el archivo firmado en un solo caso. |

Words: 86 EN, 94 ES; characters 472 / 500; at 120 words a minute about 43 s of speech in English.

Layout: Seven scenes, three windows: bank website, phone, team.

Risks:

- Scenes 1-2 need a new helper (account-opening form on the fake site). Fallback above.
- Provider pages are simulations of Didit and Documenso: the caption says 'simulated', never the vendor's marketing claims.
- Portal must not flash the 'Loading' skeleton when the phone window opens: warm it with ready().

### L04. When the identity check is inconclusive, a person decides

- **Tier P2**, voice **Adam**, estimated length **80 s**, narration **89 English words / 92 Spanish words**, estimated cost **0.08 USD**. File names: `videos/04-kyc-review-en.mp4`, `videos/04-kyc-review-es.mp4`.
- **Audience:** Compliance officers, operations leads, risk owners.
- **Capability:** Manual review of an inconclusive KYC result: the case lands in the team queue, a reviewer claims it, reads the evidence, cannot reject without a reason, approves with a reason, the workflow moves on to signature.
- **Source:** New spec d08 on the retail-account-opening workflow; the simulated provider's 'Send to manual review' button produces the inconclusive result.
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 1 | d08 scene 1 | Phone: simulated provider page with outcome buttons; the customer picks 'Send to manual review' | The outcome buttons row | Tap Send to manual review | 15 | 2.0 | Inconclusive result (simulated) / Resultado no concluyente (simulado) | Confirm in the first run what the phone shows afterwards (a 'we are reviewing' message); if it only shows a spinner, cut to scene 2 right after the tap. |
| 2 | d08 scene 2 (reviewer-inbox REV-01) | Reviewer window, Tasks, tab Team queue: task 'Inconclusive identity verification' for the case | task-row for the case: title, SLA, reference | Click the Team queue tab; hover the row | 14 | 2.0 | Team queue, twenty-four hour SLA / Cola del equipo, plazo de veinticuatro horas | Workflow sets SLA PT24H: the row should show it; if it does not, drop 'with a deadline...' from the line. |
| 3 | d08 scene 3 | Task page: applicant data, verification record 'In review', warning 'Document photo is blurry' | The verification record card with the warning line | Click Claim; scroll 120 px | 14 | 3.0 | The reviewer reads the evidence / La revisora lee la evidencia | - |
| 4 | d08 scene 4 | Reject clicked: the dialog asks for a reason, Confirm disabled until text is typed | The reason field with its requirement | Click Reject, rest 2.5 s, then Cancel | 11 | 2.0 | A reason is required / La razón es obligatoria | - |
| 5 | d08 scene 5 | Approve dialog: reason typed (Name, date of birth and face match the passport), Confirm decision | Reason field while typing; then the decision toast | Click Approve; typeSlow 70 ms; Confirm decision | 13 | 2.0 | Approved, with a reason / Aprobado, con una razón | Reason copy is demo text, not an invented policy. Keep it under 90 characters. |
| 6 | d08 scene 6 | Case page: Decisions block (approve, reviewer, reason) and timeline showing 'Sign your agreement' sent to the client | decision block, then the timeline entries below it | Click Open case | 14 | 3.0 | Decision on the record / Decisión registrada | Do not wait for the customer to sign: end here (saves a window). |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 1 | Noa's identity check comes back inconclusive. The provider here is simulated, so we choose that outcome. | La verificación de identidad de Noa no es concluyente. Aquí el proveedor es simulado, así que elegimos ese resultado. |
| 2 | The case does not stop. It lands in the team queue, with a deadline of twenty-four hours. | El caso no se detiene. Llega a la cola del equipo, con un plazo de veinticuatro horas. |
| 3 | A reviewer, Amara, claims it and reads the evidence: the document photo is blurry. | Una revisora, Amara, lo toma y lee la evidencia: la foto del documento está borrosa. |
| 4 | Rejecting is not possible without a reason. The system asks for one. | No se puede rechazar sin dar una razón. El sistema la exige. |
| 5 | She approves, and writes down why. Her name and the reason stay on the case. | Ella aprueba y escribe por qué. Su nombre y la razón quedan en el caso. |
| 6 | The case records who decided and when, and the workflow moves on to the signature. | El caso registra quién decidió y cuándo, y el flujo sigue hacia la firma. |

Fallback narration if d03 (loan variant) has to be recorded instead of d08 (not counted in the cost):

| Step | English | Español (latam, as spoken) |
|---|---|---|
| d03 step 3 | Mia applied for a loan on the bank's website. The case lands in the team queue. | Mia pidió un préstamo en el sitio web del banco. El caso llega a la cola del equipo. |
| d03 step 4 | A reviewer, Amara, claims it and reads the case, with the repayment calculation. | Una revisora, Amara, lo toma y lee el caso, con el cálculo de la cuota. |
| d03 step 5 | Rejecting needs a reason. She approves, and writes down why. | Rechazar exige una razón. Ella aprueba y escribe por qué. |
| d03 step 6 | The case records who decided and when. | El caso registra quién decidió y cuándo. |
| d03 step 7 | And the customer sees the decision in her portal. | Y la clienta ve la decisión en su portal. |

Words: 89 EN, 92 ES; characters 501 / 491; at 120 words a minute about 44 s of speech in English.

Layout: Six scenes, three windows (customer phone, reviewer, case view in the reviewer window).

Risks:

- The 'Send to manual review' route has been exercised by the API spec (SCN-03), not through the UI iframe: run scene 1 once as a dry run before the full take.
- Fallback: if the provider page cannot be driven, record the retired d03 (loan, reviewer approves) and swap the narration to the loan wording in section 3.
- Confirm the review task routes to the reviewer role as the workflow file says (assignTo role reviewer, SLA PT24H), so Amara sees it in the team queue and a senior does not.

### L05. Who can do what: roles and the two-approver rule

- **Tier P3**, voice **Sarah**, estimated length **91 s**, narration **83 English words / 92 Spanish words**, estimated cost **0.08 USD**. File names: `videos/05-roles-four-eyes-en.mp4`, `videos/05-roles-four-eyes-es.mp4`.
- **Audience:** Compliance, risk and internal audit; heads of operations.
- **Capability:** Role-based visibility and segregation of duties: a first-line reviewer does not see a large loan, a senior gives the first approval, the same person cannot give the second, a different senior does; the roles page and matrix show the model.
- **Source:** Revise d04 (recorded once): trim to five approval scenes, add the Roles page and Matrix tab, move the audit scene to d09.
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 1 | d04 scene 1 | Amara's Tasks page, Team queue tab: the large loan is not listed | The Team queue tab and the empty/short list | Click Team queue; rest | 19 | 2.5 | First-line reviewers do not see it / La primera línea no lo ve | Show the queue with at least one other, smaller task so it does not look empty. Bo Big (sixty thousand, income two hundred thousand) is the applicant. |
| 2 | d04 scene 2 | Luis (senior reviewer): claims the task, case shows 'first approval' recorded | first-approval block | Click Claim, Approve, type reason with typeSlow, Confirm | 11 | 2.5 | First approval / Primera aprobación | - |
| 3 | d04 scene 3 | Luis tries to approve again: refused with a clear message | The message next to the Approve button | Click Approve a second time; rest on the message | 13 | 2.5 | Same person cannot approve twice / La misma persona no puede aprobar dos veces | - |
| 4 | d04 scene 4 | Sofia (second senior): task row, then Approve with a reason | task-row, then reason field | Switch to Sofia's window; Claim, Approve, Confirm | 10 | 2.0 | A different senior approves / Otra revisora senior aprueba | - |
| 5 | d04 scene 5 | Case page: Decisions list with two entries (Luis, Sofia) and status Approved | decision blocks (both) | Click Open case; rest | 10 | 3.0 | Both approvers on record / Los dos aprobadores quedan registrados | - |
| 6 | d04 scene 6 (new view of old scene 7; access.ui FIA-05) | Olivia's Administration, Roles: system roles with permission chips | One role card (Auditor: 14 permissions) so the chips are readable | Click Roles; slow scroll | 14 | 2.0 | Roles are permission lists / Los roles son listas de permisos | screens/admin-roles.png is this view. |
| 7 | d04 scene 7 (new; FIA-15 matrix) | Roles page, tab Matrix: roles against permissions | Top-left 8x8 cells of the matrix | Click the Matrix tab; rest | 10 | 2.5 | The matrix / La matriz | Verify the Matrix tab has data on a fresh tenant; if not, end the video on scene 6. |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 1 | A loan of sixty thousand is above the fifty-thousand limit for first-line reviewers, so it is not in Amara's queue. | Un préstamo de sesenta mil supera el límite de cincuenta mil de los revisores de primera línea, así que no aparece en la cola de Amara. |
| 2 | Luis, a senior reviewer, claims it and gives the first approval. | Luis, un revisor senior, lo toma y da la primera aprobación. |
| 3 | He cannot give the second one himself. The same person cannot approve twice. | Él no puede dar la segunda. La misma persona no puede aprobar dos veces. |
| 4 | Sofia, a different senior reviewer, gives the second approval. | Sofia, otra revisora senior, da la segunda aprobación. |
| 5 | The case records both approvers. | El caso registra a los dos aprobadores. |
| 6 | Roles decide who can see and do what. Each role is a clear list of permissions. | Los roles deciden quién puede ver y hacer qué. Cada rol es una lista clara de permisos. |
| 7 | The matrix shows the whole model at a glance. | La matriz muestra todo el modelo de un vistazo. |

Words: 83 EN, 92 ES; characters 473 / 494; at 120 words a minute about 42 s of speech in English.

Layout: Seven scenes, four windows (Amara, Luis, Sofia, Olivia).

Risks:

- The fifty-thousand limit is the demo workflow's setting, not a product constant: say it as the example it is.
- Several personas log in: seed all with fixed names and keep window order identical on every take.

### L06. The audit trail and the evidence pack

- **Tier P3**, voice **Brian**, estimated length **68 s**, narration **69 English words / 76 Spanish words**, estimated cost **0.07 USD**. File names: `videos/06-audit-evidence-en.mp4`, `videos/06-audit-evidence-es.mp4`.
- **Audience:** Compliance officers, internal and external auditors, risk owners.
- **Capability:** Evidence and audit: a hash-chained case timeline, a per-case evidence pack export, the institution audit log and its JSON Lines export.
- **Source:** New spec d09: builds one approved account-opening case through the API (unrecorded), then records the team's view.
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 1 | d09 scene 1 | Case page: timeline of requests, connector steps, files and decision, with who and when | Timeline column (right) | Open the case; slow scroll the timeline | 15 | 2.5 | Case timeline / Línea de tiempo del caso | screens/team-case-record.png is this view. |
| 2 | d09 scene 2 | Timeline footer: 'Tamper-evident: every entry is hash-chained to the previous one' | The footer text and the last two entries | Scroll to the end of the timeline; rest | 12 | 2.5 | Hash-chained, tamper-evident / Encadenado, con evidencia de manipulación | - |
| 3 | d09 scene 3 | Case header: button Export evidence, toast 'Evidence pack exported' | The button and the toast | Click Export evidence | 13 | 2.5 | Evidence pack per case / Paquete de evidencia por caso | Needs the cases:export permission: the admin has it. Do not open the downloaded file on camera. |
| 4 | d09 scene 4 | Administration, Audit log: rows with actor, action, target, time | Top five rows | Click Audit log in the sidebar | 14 | 2.5 | Institution audit log / Registro de auditoría de la institución | Seed the case run only; avoid a page of near-identical rows. |
| 5 | d09 scene 5 | Audit log header: Export (JSON Lines) | The Export button | Click Export (JSON Lines) | 13 | 2.5 | Export for the archive / Exportación para el archivo | - |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 1 | Every case has a timeline: each request, each check and each decision, with who and when. | Cada caso tiene una línea de tiempo: cada solicitud, cada verificación y cada decisión, con quién y cuándo. |
| 2 | Each entry is chained to the one before it, so any tampering shows. | Cada entrada está encadenada a la anterior, así que cualquier manipulación se nota. |
| 3 | A compliance officer can export an evidence pack for a single case. | Un oficial de cumplimiento puede exportar un paquete de evidencia de un solo caso. |
| 4 | At institution level, the audit log lists who did what, to what, and when. | A nivel de institución, el registro de auditoría muestra quién hizo qué, sobre qué y cuándo. |
| 5 | And it exports as JSON Lines, for the bank's own archive or its auditors. | Y se exporta como JSON Lines, para el archivo del banco o para sus auditores. |

Words: 69 EN, 76 ES; characters 370 / 441; at 120 words a minute about 34 s of speech in English.

Layout: Five scenes, one window (the administrator). Cheapest to record.

Risks:

- Say nothing about legal admissibility, retention periods or certifications: none are documented.
- The statement 'tamper-evident' repeats the product's own footer; keep it exactly that strong.

### L07. Automatic when it is clear, a person when it is not

- **Tier P3**, voice **Bella**, estimated length **69 s**, narration **75 English words / 78 Spanish words**, estimated cost **0.07 USD**. File names: `videos/07-automation-vs-manual-en.mp4`, `videos/07-automation-vs-manual-es.mp4`.
- **Audience:** Heads of operations, credit and product; buyers who ask how much stays manual.
- **Capability:** Rules-driven routing: a small affordable loan is approved automatically, an unaffordable one declined with an e-mail, a mid-size one waits for a reviewer; the rules live in an editable, versioned workflow.
- **Source:** Revise d05: move it into its own spec file (so the key d05 is unique), add the workflow canvas scene.
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 1 | d05 scene 1 | Cases list with three rows: Sam Small Approved, Una Upton Rejected, Mia Mid In review | The three rows with their status chips | Rest; focus() on the first row | 12 | 2.5 | Three applications, three paths / Tres solicitudes, tres caminos | The existing screens/cases-list.png shows random e-mail suffixes: use the fixed persona e-mails (sam.small@customers.example). |
| 2 | d05 scene 2 | Case of Sam: status Approved, no task, timeline without a person | case-status badge and the timeline | Click Sam's row | 14 | 2.5 | Approved automatically / Aprobado automáticamente | - |
| 3 | d05 scene 3 | Case of Una: status Rejected, e-mail 'not approved' in the timeline | case-status badge and the notification entry | Back to list; click Una's row | 14 | 2.5 | Declined automatically, with an e-mail / Rechazado automáticamente, con un correo | - |
| 4 | d05 scene 4 | Case of Mia: In review, task waiting in the team queue | Status chip and the waiting task | Back to list; click Mia's row | 15 | 2.5 | In between: a person decides / En el medio: decide una persona | - |
| 5 | d05 scene 5 (new; workflow-editor DES-06) | Workflows page, then the visual editor of Personal loan pre-approval: steps and branches | The canvas branches that split small, mid-size and unaffordable | Click the workflow; hover two steps | 13 | 2.5 | Rules are an editable workflow / Las reglas son un flujo editable | If the canvas needs a second to lay out, wait for the last step node before the beat. |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 1 | Three loan applications arrived at Northwind Bank. They take three different paths. | Llegaron tres solicitudes de préstamo a Northwind Bank. Siguen tres caminos distintos. |
| 2 | Sam asked for a small amount and earns enough. The workflow approved it, with no human step. | Sam pidió una cantidad pequeña y gana lo suficiente. El flujo lo aprobó, sin ningún paso humano. |
| 3 | Una asked for more than she can afford. It was declined automatically, with a polite e-mail. | Una pidió más de lo que puede pagar. Se rechazó automáticamente, con un correo amable. |
| 4 | Mia's request is in between, so it waits in the team queue for a person. | La solicitud de Mia está en el medio, así que espera en la cola del equipo a una persona. |
| 5 | These rules live in a workflow that the bank's own designer can edit and publish. | Estas reglas viven en un flujo que el diseñador del banco puede editar y publicar. |

Words: 75 EN, 78 ES; characters 420 / 439; at 120 words a minute about 38 s of speech in English.

Layout: Five scenes, one window. Three applications are created unrecorded first (applyQuietly).

Risks:

- Thresholds in the demo workflow are the example's; do not present them as lending policy.
- Visual strength is only 3 (lists and badges): the zoom on the status chips and the canvas carries it.

### L08. The institution's administrator: team, roles and second approval

- **Tier P4**, voice **Adam**, estimated length **63 s**, narration **61 English words / 65 Spanish words**, estimated cost **0.06 USD**. File names: `videos/08-team-and-access-en.mp4`, `videos/08-team-and-access-es.mp4`.
- **Audience:** Institution administrators, security and IT leads.
- **Capability:** Team administration: invite a reviewer, the reviewer's reduced menu, privileged changes that wait for a second administrator, all logged.
- **Source:** New spec d10 (compose two existing UI flows).
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 1 | d10 scene 1 | Administration, Team: members with roles (Olivia, Dana, Amara, Luis, Sofia) | Table of members and roles | Click Team in the sidebar | 13 | 2.0 | Team and roles / Equipo y roles | - |
| 2 | d10 scene 2 | Invite dialog: Ravi Reviewer, e-mail, role Reviewer | The dialog fields | Click Invite; type with typeSlow; Send | 8 | 2.0 | Invite a reviewer / Invitar a un revisor | - |
| 3 | d10 scene 3 | Two windows side by side: Olivia's full menu and Ravi's shorter menu (Work only) | Ravi's sidebar | Ravi accepts the invitation and signs in (unrecorded); then show his window | 15 | 2.5 | A reviewer sees less / Un revisor ve menos | Record Ravi's window as a separate take and cut the two together; the compose step handles a second window. |
| 4 | d10 scene 4 | Access changes page: a pending request to make a member administrator, waiting for approval | The pending row and its status | Make the change as Olivia; open Access changes | 12 | 2.5 | Sensitive changes need a second approver / Los cambios delicados necesitan un segundo aprobador | Needs two administrators on the tenant (second administrator is seeded). |
| 5 | d10 scene 5 | Second administrator approves; change applied; line in the audit log | Approval button, then the audit row | Switch window; click Approve | 12 | 2.5 | Approved, applied, logged / Aprobado, aplicado, registrado | - |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 1 | Olivia, the administrator, manages her team from one page. Each person has a role. | Olivia, la administradora, gestiona a su equipo desde una sola página. Cada persona tiene un rol. |
| 2 | She invites Ravi as a reviewer. | Ella invita a Ravi como revisor. |
| 3 | Ravi accepts and signs in. His menu is shorter: he only sees the work a reviewer needs. | Ravi acepta e inicia sesión. Su menú es más corto: solo ve el trabajo que necesita un revisor. |
| 4 | Some changes are sensitive. Making someone an administrator waits for a second administrator. | Algunos cambios son delicados. Hacer administrador a alguien espera a un segundo administrador. |
| 5 | The second administrator approves, and the change is applied and logged. | El segundo administrador aprueba, y el cambio se aplica y queda registrado. |

Words: 61 EN, 65 ES; characters 365 / 393; at 120 words a minute about 30 s of speech in English.

Layout: Five scenes, three windows (Olivia, Ravi, second administrator).

Risks:

- The access-changes flow is the least rehearsed UI in the set (FIA-19): dry run first, cut scenes 4-5 if not clean and keep the video at about 40 seconds.
- Do not show the invited person's activation link or token.

### L09. Build a form and a workflow, and embed it on the bank's site

- **Tier P4**, voice **Daniel**, estimated length **93 s**, narration **68 English words / 73 Spanish words**, estimated cost **0.07 USD**. File names: `videos/09-workflow-design-en.mp4`, `videos/09-workflow-design-es.mp4`.
- **Audience:** Product owners and flow designers; partners who integrate.
- **Capability:** No-code design: a form built on a canvas, a workflow from a template, publish, and one snippet to embed the form on the institution's website.
- **Source:** Extend d06 (recorded once): add the 'live on the bank's site' scene.
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 1 | d06 scene 1 | Forms page, Create form dialog: name Personal loan pre-approval | The dialog | Click Create Form; type name with typeSlow | 13 | 1.5 | Build a form / Crear un formulario | Narration line stays on screen through scene 2. |
| 2 | d06 scene 2 | Form canvas filling with four fields | Form canvas region (region 'Form canvas') | Add Text, Email, Number, Number; label each | 20 | 1.5 | Four fields / Cuatro campos | Silent step: footage continues under line 1 (the composer carries it). |
| 3 | d06 scene 3 | Workflows, New from template: template cards | Template card 'Personal loan pre-approval' | Click New from template | 13 | 2.5 | Start from a template / Partir de una plantilla | - |
| 4 | d06 scene 4 | Workflow row shows version v1 after Publish | workflow-version chip | Open Actions, click Publish | 8 | 2.0 | Publish: v1 / Publicar: v1 | - |
| 5 | d06 scene 5 | Publish and embed dialog: workflow selected, allowed website typed | Workflow dropdown and the website field | Pick the workflow; type the site; Publish | 12 | 2.0 | Publish and embed / Publicar e incrustar | - |
| 6 | d06 scene 6 | The embed script on screen | embed-script block | Rest | 11 | 2.0 | One snippet / Un solo fragmento | The snippet shows data-lintelia-form=... : confirm the new name, not the old Fintivio one. |
| 7 | d06 scene 7 (new) | The styled bank website with the form live in it (same page as L03 scene 1) | The embedded card | Switch to the site window; do not submit | 12 | 2.5 | Live on the website / Activo en el sitio web | Reuse the styled fake site built for L03. |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 1 | Dana builds a loan form by adding fields to a canvas: name, e-mail, amount and income. | Dana crea un formulario de préstamo añadiendo campos a un lienzo: nombre, correo, monto e ingresos. |
| 3 | She starts the workflow from a template, so the rules are already there. | Ella parte de una plantilla de flujo, así que las reglas ya están ahí. |
| 4 | She publishes it as version one. | Ella lo publica como versión uno. |
| 5 | Then she publishes the form and names the website that may embed it. | Luego publica el formulario e indica el sitio web que puede incrustarlo. |
| 6 | One snippet is all the bank's website needs. | Un solo fragmento es todo lo que el sitio del banco necesita. |
| 7 | And the form is live on the page, ready to take applications. | Y el formulario ya está activo en la página, listo para recibir solicitudes. |

Words: 68 EN, 73 ES; characters 363 / 411; at 120 words a minute about 34 s of speech in English.

Layout: Seven scenes, two windows (designer, bank website).

Risks:

- Drag and drop is replaced by the add buttons of the existing spec: nothing to fix.

### L10. The bank's own customer app, built in a studio

- **Tier P4**, voice **Sarah**, estimated length **73 s**, narration **66 English words / 71 Spanish words**, estimated cost **0.06 USD**. File names: `videos/10-client-app-en.mp4`, `videos/10-client-app-es.mp4`.
- **Audience:** Product and digital leads at banks and credit unions.
- **Capability:** Client app studio: template, live preview, publish; the customer app on a phone (accounts, move money, freeze card); the experience map.
- **Source:** New spec d11: composed from studio.ui, banking-app.ui and map.ui steps with demo pacing.
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 1 | d11 scene 1 (studio APP-01) | Client app studio: template chosen, live preview of the app next to the editor | Preview pane | Choose a template; rest | 16 | 2.5 | Studio with live preview / Estudio con vista previa | Remove invented copy from the template text (the draft had a rate claim): use neutral words. |
| 2 | d11 scene 2 (APP-02) | Phone view toggle in the studio, then Publish | Phone preview and the Publish button | Click Phone view; click Publish | 9 | 2.0 | Phone view, publish / Vista de teléfono, publicar | - |
| 3 | d11 scene 3 (APP-04) | Phone: home screen with accounts and balances (demo data) | Account cards | Rest | 11 | 2.5 | The customer app / La app del cliente | Balances are seeded demo data; say 'demo' in the note, no other claim. |
| 4 | d11 scene 4 (APP-05) | Phone: Move money between two accounts, confirmation | Transfer form, then the confirmation | Fill the amount with typeSlow; Confirm | 9 | 2.5 | Move money / Mover dinero | - |
| 5 | d11 scene 5 (APP-06) | Phone: card screen, Freeze toggled, status Frozen | The card and its toggle | Tap Freeze | 10 | 2.5 | Freeze the card / Congelar la tarjeta | - |
| 6 | d11 scene 6 (map APP-11) | Experience map: the whole app, journeys and workflows on one canvas | Canvas centre with the persona and layer controls | Open Map; toggle one layer | 15 | 3.0 | The experience map / El mapa de la experiencia | - |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 1 | The bank builds its customer app in a studio, starting from a template, with a live preview. | El banco construye su app para clientes en un estudio, partiendo de una plantilla y con vista previa en vivo. |
| 2 | It checks the phone view, then publishes. | Revisa la vista de teléfono y luego publica. |
| 3 | Ada opens the app on her phone and sees her accounts. | Ada abre la app en su teléfono y ve sus cuentas. |
| 4 | She moves money between her own accounts. | Ella mueve dinero entre sus propias cuentas. |
| 5 | And she freezes her card in one tap. | Y congela su tarjeta con un toque. |
| 6 | The map shows the whole app, its journeys and the workflows behind them, on one canvas. | El mapa muestra toda la app, sus recorridos y los flujos que hay detrás, en un solo lienzo. |

Words: 66 EN, 71 ES; characters 350 / 370; at 120 words a minute about 33 s of speech in English.

Layout: Six scenes, two windows (studio on the web, customer on a phone). Phone parts use the centred bezel.

Risks:

- Dropped first if the budget stop-line is reached.
- Balances and transfers are demo data: never imply a connection to a real core system.

### C1. Clip: a file with a virus is refused, a clean one reaches the case

- **Tier P5**, voice **Sarah**, estimated length **37 s**, narration **37 English words / 38 Spanish words**, estimated cost **0.03 USD**. File names: `videos/11-clip-uploads-en.mp4`, `videos/11-clip-uploads-es.mp4`.
- **Audience:** Operations and security reviewers.
- **Capability:** Document intake: malware refused in the portal, a clean statement accepted, the team sees it scanned and downloads it.
- **Source:** New spec d12 (short).
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 1 | d12 scene 1 (UPL-01) | Phone portal: upload field, a test-virus file is refused with a clear message | The refusal message | Choose the test file; rest on the message | 14 | 2.5 | Malware refused / Malware rechazado | The file is the standard harmless test string; name it test-virus.txt. |
| 2 | d12 scene 2 | Phone portal: a clean statement uploaded, success | Upload row with check mark | Choose statement.pdf | 8 | 2.0 | Clean file accepted / Archivo limpio aceptado | - |
| 3 | d12 scene 3 | Team web window: case Files card 'Checked for malware and sanitised before reaching the case' with Download | Files card | Switch to the team window; hover Download | 13 | 2.5 | Scanned clean, downloadable / Analizado y limpio, descargable | - |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 1 | A customer uploads a file that holds a test virus. It is refused, with a clear message. | Una clienta sube un archivo que contiene un virus de prueba. Se rechaza, con un mensaje claro. |
| 2 | A clean statement goes through. | Un extracto limpio pasa sin problema. |
| 3 | On the case, the team sees it marked as scanned clean, and can download it. | En el caso, el equipo lo ve marcado como analizado y limpio, y puede descargarlo. |

Words: 37 EN, 38 ES; characters 193 / 212; at 120 words a minute about 18 s of speech in English.

Layout: Three scenes, two windows (phone, team).

Risks:

- Do not claim a specific scanner or detection rate: the product text only says 'checked for malware and sanitised'.

### C2. Clip: a customer asks for their data and for erasure

- **Tier P5**, voice **Bella**, estimated length **27 s**, narration **25 English words / 25 Spanish words**, estimated cost **0.02 USD**. File names: `videos/12-clip-data-rights-en.mp4`, `videos/12-clip-data-rights-es.mp4`.
- **Audience:** Compliance and privacy officers.
- **Capability:** Data-rights requests: the customer asks for a copy and for erasure; the compliance team completes them on the request.
- **Source:** New spec d13 (short).
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 1 | d13 scene 1 (CLI-10) | Phone portal, Privacy: Request a copy of my data and Request erasure | The two request buttons | Tap each in turn | 14 | 2.5 | Data-rights requests / Solicitudes de derechos sobre datos | - |
| 2 | d13 scene 2 (CMP-03) | Team window: the request on the case, completed by a compliance user | Request row and its Completed status | Click Complete | 11 | 2.5 | Completed by compliance / Completada por cumplimiento | Silent third step (neutral decline while an application is open) is not shown: it needs explaining. |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 1 | A customer asks for a copy of her data, and for erasure, from her own portal. | Una clienta pide una copia de sus datos, y su eliminación, desde su propio portal. |
| 2 | The compliance team completes the request on the case. | El equipo de cumplimiento completa la solicitud en el caso. |

Words: 25 EN, 25 ES; characters 131 / 141; at 120 words a minute about 12 s of speech in English.

Layout: Two narrated scenes.

Risks:

- Never name a regulation (no GDPR, no CCPA): the product text does not.

### C3. Clip: suspend and reactivate an institution

- **Tier P5**, voice **Brian**, estimated length **32 s**, narration **23 English words / 28 Spanish words**, estimated cost **0.03 USD**. File names: `videos/13-clip-suspend-en.mp4`, `videos/13-clip-suspend-es.mp4`.
- **Audience:** Platform operators; risk and procurement.
- **Capability:** Lifecycle control: staff suspend an institution, its sign-in page no longer knows it, staff reactivate it.
- **Source:** d07 exists and is recorded; narration only.
- **Standing note (EN):** Demo data · identity check, e-signature and e-mail are simulated · interface in English
- **Standing note (ES):** Datos de demostración · verificación de identidad, firma y correo simulados · interfaz en inglés

| # | Spec / test and state | On screen | Zoom target and why | Cursor action | Footage (s) | Digest (s) | Caption EN / ES | Re-record / edit |
|---|---|---|---|---|---|---|---|---|
| 2 | d07 scene 2 | Console: Suspend clicked, row turns Suspended | The row and its status chip | Click Suspend, confirm | 10 | 2.0 | Suspend / Suspender | - |
| 3 | d07 scene 3 | The institution's sign-in page: workspace not found | The error text | Open the tenant URL | 10 | 2.0 | Sign-in page no longer knows it / La página de acceso ya no la reconoce | - |
| 4 | d07 scene 4 | Console: Restore access / Reactivate, row Active again | The row and its status chip | Click Reactivate | 10 | 2.0 | Reactivate / Reactivar | - |
| card | no spec | Closing card: Lintelia / Demo data · simulated providers | - | - | 3.0 | - | - | Silent (no TTS cost, no URL) |

Narration (as spoken):

| # | English | Español (latam, as spoken) |
|---|---|---|
| 2 | Platform staff can suspend an institution. | El personal de la plataforma puede suspender una institución. |
| 3 | Its sign-in page no longer knows it. | Su página de inicio de sesión ya no la reconoce. |
| 4 | And staff can reactivate it when the reason is gone. | Y puede reactivarla cuando el motivo ya no existe. |

Words: 23 EN, 28 ES; characters 130 / 159; at 120 words a minute about 12 s of speech in English.

Layout: Existing recording: steps 2-4 narrated, step 1 skipped.

Risks:

- Check the suspended state shows the institution's name nowhere on the public page (it must stay a plain error).

## 4. Recording plan

### 4.1 Demo specs: what to change

All recording happens through the existing `demo` Playwright project (`E2E_DEMO=1`). Each story is its own spec file with one test, so the composer key is simply the test number (`d01` to `d13`); the old d04 file holds two tests (d04 and d05) and must be split, otherwise both test folders match the key `d04`.

| Spec file (apps/e2e/tests/demo/) | Story | Status | Changes | Footage to produce |
|---|---|---|---|---|
| d01-tenant-onboarding | L02, L01 | Revise | Stable names (administrator Olivia Owner, fixed workspace key and e-mail suffix); slower beats; add scene 8 (Roles) and renumber the audit scene to 9; wait for Live chip before scene 7. | 9 scenes, about 75 s |
| d02-customer-kyc | L03, L01 | Rewrite | New helper `accountInstitution()` (like `loanInstitution()` but with the retail-account-opening workflow, a two-field form and the styled bank site); scenes 1 and 2 on the bank site, then the existing phone steps as scenes 3 to 6, team view scene 7. | 7 scenes, about 80 s |
| d03-reviewer-decision | - | Retire | Leave in the repository, remove from `DEMO_STORIES`; fallback for L04 only. | none |
| d04-roles-four-eyes | L05, L01 | Revise, split | Keep the test of d04 only; drop the old audit scene (moves to d09); add Roles page and Matrix tab scenes 6 and 7; fixed personas (Amara, Luis, Sofia, Bo Big). | 7 scenes, about 90 s |
| d05-automation-paths | L07, L01 | Split out of d04 | Move the second test into its own file; persona Una Upton instead of Una Affordable; fixed e-mails; add scene 5 (workflow canvas, `workflow-editor.ui` steps). | 5 scenes, about 55 s |
| d06-workflow-config | L09 | Extend | Add scene 7 (the form live on the styled bank site, not submitted); ensure the embed snippet shows `data-lintelia-form=`. | 7 scenes, about 70 s |
| d07-suspend-reactivate | C3 | Keep | No change except slower beats; already recorded. | 4 scenes |
| d08-kyc-manual-review | L04, L01 | New | `prepareInstitution` with didit and documenso, publish retail-account-opening, customer on the phone portal picks Send to manual review on the provider page, reviewer (Amara) claims and decides (reuse `claimFromQueue`, `decideTask`). | 6 scenes, about 70 s |
| d09-audit-evidence | L06, L01 | New | Build one approved account-opening case unrecorded (API), then record the administrator on the case page (timeline, footer, Export evidence) and on the audit log page. | 5 scenes, about 50 s |
| d10-team-and-access | L08 | New | Compose `team-and-roles.ui` (invite a reviewer, reduced menu) and `access.ui` (second administrator); second administrator is seeded. | 5 scenes, about 55 s |
| d11-client-app | L10 | New | Compose `studio.ui`, `banking-app.ui` (move money, freeze card) and `map.ui`; seed demo balances; neutral template copy. | 6 scenes, about 75 s |
| d12-uploads | C1 | New | Adapt `uploads.ui`: harmless test-virus file refused, clean statement, team sees it scanned clean. | 3 scenes, about 35 s |
| d13-data-rights | C2 | New | Adapt `data-rights.ui`: two requests from the portal, compliance completes one. | 2 scenes, about 25 s |

### 4.2 Pace and determinism changes (support/demo.ts)

- `beat(page, ms)` multiplies by `E2E_DEMO_PACE` (default 1.5 in demo mode); `typeSlow` default delay 70 ms (45 today); one `beat(page, 600)` after every click that opens a dialog.
- Every scene ends with a hold of at least the footage figure of its table row (section 3). Hold the final state, do not navigate away early.
- `ready()` of every `recordedContext` waits for the last element of the page, never for the network alone, so no skeleton or spinner is on screen when the scene starts; visit each route once before recording it (warm-up) so first-load compilation never shows.
- Random suffixes are removed from everything the viewer sees: the administrator is created with a fixed name and a fixed e-mail local part, and the tenant key suffix is stable per story. The draft footage showed `admin.d71c7f6b@nor...` in the sidebar and random references in the cases list.
- The fake bank website (`support/website.ts`) is currently a bare page in the browser's default serif font (screens/site-confirmation.png). Give it a header with the bank's initials, a hero line, the brand colour of Northwind Bank and a footer. Same page in L03 and L09.
- Remove invented copy from the template and the site (the draft had a rate claim): neutral words only.

### 4.3 Shared seed data and cast

| Who | Name | Role / realm | Used in |
|---|---|---|---|
| Platform staff | staff@lintelia.local (Platform admin) | Platform console | L02, C3 |
| Institution | Northwind Bank (workspace Northwind Bank, stable key) | One per spec, deleted after | all except L02/C3 start |
| Seeded institutions in the console | Acme Credit Union, Demo Auto Finance, Demo Bank | Visible in L02 scene 1 and C3 | L02, C3 |
| Administrator | Olivia Owner (olivia.owner@...) | Administrator | L02, L05, L06, L08 |
| Second administrator | Omar Owner | Administrator | L08 |
| Designer | Dana Designer | flow_designer | L09, setup of L05 and L07 |
| First-line reviewer | Amara Analyst | reviewer | L04, L05 |
| Senior reviewers | Luis Lead, Sofia Senior | senior_reviewer | L05 |
| New reviewer | Ravi Reviewer | reviewer (invited on screen) | L08 |
| Customers (@customers.example) | Ada Applicant (L03, L10), Noa Newcomer (L04) | Account opening, app | L03, L04, L10 |
| Loan applicants | Sam Small (five thousand), Una Upton (forty thousand, low income), Mia Mid (twenty thousand), Bo Big (sixty thousand) | Personal loan pre-approval | L05, L07, L09 |

Dates and times are the real run time (the interface prints them); do not crop them out, do not mention them in narration.

### 4.4 Order of recording (fewest restarts)

The stack is started **once** and kept up for the whole session; every spec creates and deletes its own institution, so no restart is needed between stories. Order by shared dependency, quick ones first so a broken stack shows itself early:

| Wave | Specs (in order) | Needs | Pre-flight check |
|---|---|---|---|
| 1 (P1 and P2: L02, L03, L04; C3 footage) | d01, d07, d02, d08 | Staff session, mailbox, didit and documenso fakes | Run d08 scene 1 as a dry run: pick Send to manual review on the provider page and see what the phone shows |
| 2 (P3 and the reel: L05, L06, L07, L01) | d09, d04, d05 | Account-opening case via API; loan institution and fake website | Matrix tab has data on a fresh tenant |
| 3 (L08, L09, C1, C2, C3) | d06, d10, d12, d13 | Loan institution, second administrator, uploads and data-rights flows | Access-changes page works with two administrators |
| 4 (L10, then stretch) | d11 | Client app, demo balances | Studio template text is neutral |

Per the workflow memory: record one or two specs at a time, review the footage, compose, then prune `test-results` and `.work` before the next (webm files are large). Pushes: one video per commit, each under about 7 MB.

### 4.5 Composer changes (demo/compose.py) to apply before the first compose

| Change | From | To | Why |
|---|---|---|---|
| Narration speed | SPEECH 0.92 | SPEECH 0.82 (about 120 words a minute for the five voices) | User feedback: slower pace |
| Lead before the voice | LEAD 0.6 | LEAD 1.0 | Time to look before listening |
| Quiet after a line | BREATH 1.1 | BREATH 1.8, plus per-line `hold` (seconds, default 0) added to it | Digest time; `hold` is longer on dense screens (tables, matrix, timeline) |
| Phone placement | `fx = 360` (left of centre) | `fx = (W - fw) // 2` (centred in the 16:9 frame); caption column starts at `fx + fw + 120` and is about 520 px wide; the actor tag and the note move to the left margin at the same height | Phone bezel centred; the column on the right keeps the caption beside the phone, never below |
| Closing card | spoken | silent unless `say` is present (already supported) | Saves cost; the standing note carries the disclosure |
| Zoom on dense pages | ZOOM_MAX 1.7 | unchanged; `zoomHint` documents the target but `focus()` in the spec does the work | Precedence: explicit zoom, then `focus()`, then automatic change box; do not set `zoom` in plan.json |
| Ledger tag | cleude | lintelia (already set in the draft) | OpenRouter spend ledger |

Unknown line keys (`hold`, `zoomHint`) are ignored by the current composer, so plan.json is already valid; `hold` takes effect once the second row is applied.

## 5. Production checklist

### 5.1 Steps

1. Branch and environment: confirm branch `rebrand/lintelia` (or `demo/sales-kit`) and a clean stack; **never move or edit .env files**; if one is needed, copy to a durable backup.
2. Start the e2e stack once (api, web, Restate, didit, documenso, mailbox, smtp fakes, postgres). Confirm the platform staff session works and the console lists Acme Credit Union, Demo Auto Finance, Demo Bank.
3. Apply section 4.2 (pace, fixed names, styled bank site) and section 4.5 (composer). Rename the draft `demo/script.json` to `script.draft.json` and copy `demo/plan.json` to `demo/script.json`.
4. Wave 1: record d01, d07, d02, d08 (`DEMO_STORIES="d01" demo/record.sh` style, one at a time). After each, open the webm and the `demo-timeline.json`, check the scene numbers against section 3 and that every scene is at least its footage figure long.
5. Review footage before any narration is generated. TTS is the only variable cost; rewrite a spec, not a line, when footage is wrong.
6. Source `~/code/or-ledger/env.sh` before every compose (it enforces the fifteen dollar cap). Compose one English video first (L02), listen, check the pace and the zoom, then compose its Spanish twin. Run `verify-narration.py` on both and read the report.
7. Compose in this order: L02, L03, L04, L05, L06, L07, then **the reel L01** (it needs their footage), then L08, L09, the clips C1, C2, C3, and L10 last.
8. After every video: check duration (target in section 2.1, tolerance 25 percent), file size (under about 7 MB), no loading screen, no UI text from the old name, captions readable at phone size, the note present, no URL.
9. Run the stop-lines of section 5.3 after each wave. Update the ledger entry for the session (cumulative new spend against the 1.42 USD ceiling).
10. Commit one video per commit (EN and ES together is acceptable), poster image included; do not commit `.work`, `.cache` or `test-results`.
11. Finish: delete temporary footage, write the final video list with durations and costs into the session report, note anything cut.

### 5.2 Per-video acceptance

- English and Spanish run within 10 percent of each other in length; the Spanish line never gets cut by the next scene.
- Every spoken sentence matches what is on screen at that moment (zoom on the region named in the shot list).
- No number is spoken that is not on screen or in the cast table; no claim outside section 1.4.
- No random-looking identifiers on screen (hex suffixes, UUIDs where a reference exists).
- Standing note visible for the whole video; closing card silent and without a URL.

### 5.3 Budget and stop-lines

| Id | Video | EN chars | ES chars | TTS USD | Check USD | Subtotal USD | Cumulative USD | Wave |
|---|---|---|---|---|---|---|---|---|
| L02 | Onboarding an institution, end to end | 579 | 690 | 0.10 | 0.01 | 0.11 | 0.11 | 1 |
| L03 | A customer opens an account: apply, verify, sign, approved | 472 | 500 | 0.08 | 0.01 | 0.08 | 0.19 | 1 |
| L04 | When the identity check is inconclusive, a person decides | 501 | 491 | 0.08 | 0.00 | 0.08 | 0.28 | 1 |
| L05 | Who can do what: roles and the two-approver rule | 473 | 494 | 0.08 | 0.01 | 0.08 | 0.36 | 2 |
| L06 | The audit trail and the evidence pack | 370 | 441 | 0.06 | 0.00 | 0.07 | 0.43 | 2 |
| L07 | Automatic when it is clear, a person when it is not | 420 | 439 | 0.07 | 0.00 | 0.07 | 0.50 | 2 |
| L01 | Pitch reel: one workflow from onboarding to audit | 642 | 744 | 0.11 | 0.01 | 0.12 | 0.62 | 2 |
| L08 | The institution's administrator: team, roles and second approval | 365 | 393 | 0.06 | 0.00 | 0.06 | 0.68 | 3 |
| L09 | Build a form and a workflow, and embed it on the bank's site | 363 | 411 | 0.06 | 0.00 | 0.07 | 0.75 | 3 |
| C1 | Clip: a file with a virus is refused, a clean one reaches the case | 193 | 212 | 0.03 | 0.00 | 0.03 | 0.78 | 3 |
| C2 | Clip: a customer asks for their data and for erasure | 131 | 141 | 0.02 | 0.00 | 0.02 | 0.81 | 3 |
| C3 | Clip: suspend and reactivate an institution | 130 | 159 | 0.02 | 0.00 | 0.03 | 0.83 | 3 |
| L10 | The bank's own customer app, built in a studio | 350 | 370 | 0.06 | 0.00 | 0.06 | 0.90 | 4 |

| Item | USD |
|---|---|
| Narration, 26 files (0.08 USD per thousand characters) | 0.84 |
| Speech-to-text check, 144 lines | 0.06 |
| Reserve (regenerate about one line in eight, re-verify after re-records) | 0.14 |
| **Estimated new spend** | **1.04** |
| Already spent on the draft narration (sunk, lines will not match the new scripts) | 0.38 |
| Envelope | 1.80 |
| Headroom under the envelope | 0.39 |
| Ledger before the plan: used / cap | 11.9645 / 15 |

| Stop-line | Rule |
|---|---|
| After wave 1 (L02, L03, L04) | Cumulative narration and check spend at most 0.35 USD (planned 0.28). If higher, the narration is running long: cut lines before continuing. |
| After wave 2 (L05, L06, L07 and the reel L01) | At most 0.80 USD (planned 0.74). |
| After wave 3 (L08, L09, C1 to C3) | At most 1.10 USD (planned 0.95). If over, skip the clips C1 to C3 (about 0.09 USD). |
| Wave 4 (L10, then stretch S5, S8) | Only while cumulative plus the reserve stays under 1.42 USD. L10 is dropped first if the stop-line is reached; S5 is added first if room remains. |
| Hard stop | 1.42 USD of new spend, and never above the 15 USD ledger cap. |

Cost model: about 0.001 USD per English word for an English plus Spanish pair, measured on the cleude and flow-mind kits; the build of this plan computes it from the characters actually written. Silent closing cards, one voice per video and cached lines (sha1 of model, voice and text) keep it down; the reel's footage is free.

### 5.4 What can go wrong (global)

- The Didit provider page may not be drivable in the browser for the manual-review outcome: fall back to d03 for L04 (loan wording, no other change in the plan).
- A one-time TOTP code can collide across windows: sign in the administrator once per spec, early in a 30 second window.
- Restate or fake services slow down on the first run after a restart: warm up, then record; never record on a cold stack.
- The reel depends on the step numbers of five specs: freeze section 3 after wave 2.
- If the budget stop-line trips, the cut order is L10, C2, C1, C3, L08; L01 to L07 and L09 are the core set.

## Appendix A. Coverage of all e2e spec files (84)

Verdict: **A** good on-screen story; **B** usable as a scene or short clip; **D** has a UI but a weak story; **C** no UI (API or assurance only).

| Spec file (apps/e2e/tests/) | Flows | Capability proved | Verdict | Where it is used |
|---|---|---|---|---|
| `automation/automation.api.spec.ts` | AUT-01..07 | Business stages, functions, signals, HTTP connector, AI and LoanPro connections, workflows that create clients | C | No video. Effects only show inside the dealer-finance solution (S12). |
| `automation/events.api.spec.ts` | AUT-08/09/10 | Events by business key, start-or-deliver, polling with a time limit | C | No video. |
| `automation/functions.ui.spec.ts` | AUT-01/02 | Stages and function outputs in the workflow settings dialog; function in the palette | D | No video: dense configuration dialog, no visible business outcome. |
| `back-office/back-office.api.spec.ts` | BOA-01..08 | Back-office studio, per-member pruning, actions with approval, versions | C | Backs S9 (stretch). |
| `back-office/back-office.ui.spec.ts` | BOA-01/02/03/05/06 | Institution designs its own staff screens; fee waiver within and above an authority limit; homes by role | A | S9 stretch (100 s). |
| `client-app/banking-app.ui.spec.ts` | APP-03/04/05/06 | Sign-up with consents, ID upload journey checked by the team, move money, freeze card, phone layout | A | L10 (move money, freeze card, phone) and S8 stretch (sign-up and KYC in the app). |
| `client-app/banking-journeys.api.spec.ts` | APP-04/05 | Open savings, personal loans, lost card, change of address, secure message (API) | C | Backs L10. |
| `client-app/embedded.ui.spec.ts` | APP-07/09 | App mounted in the bank's own site with the SDK; content-only mode; phishing site refused | D | Cut: iframe on a plain page, developer audience. |
| `client-app/identity.api.spec.ts` | APP-06/07/08 | Sign-up fields and consents, institution registers clients, ID-token exchange | C | No video. |
| `client-app/journeys.api.spec.ts` | APP-03/04/05 | Page data allow-list, journeys, onboarding with review (API) | C | Backs L10 and S8. |
| `client-app/map.ui.spec.ts` | APP-11 | Experience map: the whole app, journeys, workflows on one canvas; personas, layers, open editors | A | L10 scene 8 (20 s); too niche for its own video. |
| `client-app/pay-with-qr.ui.spec.ts` | APP-12 | Pay with a QR code: full-screen scanner, countdown, sheet, branding presets, sliders and signatures | A | S10 stretch (phone clip). Branding/field tests: no video. |
| `client-app/studio.api.spec.ts` | APP-01/02/10 | Template, publish, versions, rollback, who may build (API) | C | Backs L10. |
| `client-app/studio.ui.spec.ts` | APP-01/02 | Client-app studio: template, live preview, phone view, validation blocks publishing, publish | A | L10 scenes 1-4. |
| `client-app/ui-blocks.api.spec.ts` | APP-12 | QR payload and field rules checked by the API | C | No video. |
| `clients/application.api.spec.ts` | CLI-03/07 | Draft until e-mail confirmed, resume on another device, rate limit, tracking and decision e-mail | C | Backs L03. |
| `clients/apply-embedded.ui.spec.ts` | CLI-03, DES-01 | Apply from a form embedded on the bank's website; not submitted until e-mail confirmed | A | L03 scenes 1-2. |
| `clients/data-rights.ui.spec.ts` | CLI-10, CMP-03 | Customer asks for a copy of their data and for erasure; compliance completes; neutral decline while an application is open | A | C2 clip. |
| `clients/form-request.api.spec.ts` | CLI-05 | Customer fills a form the institution sends | C | No video. |
| `clients/isolation.api.spec.ts` | CLI-11 | Clients cannot use back-office endpoints or read others' cases | C | No video (assurance). |
| `clients/privacy.api.spec.ts` | CLI-10 | Privacy notice version recorded; copy and erasure requests | C | Backs C2. |
| `clients/related-parties.api.spec.ts` | CLI-09 | Co-applicant or guarantor joins with their own link | C | No video. |
| `clients/related-parties.ui.spec.ts` | CLI-08, SCN-09 | Business onboarding: owner invited in the portal, verifies, review starts | A | S6 stretch (KYB). |
| `clients/sign-in.ui.spec.ts` | CLI-01/02 | Create an account on the branded sign-on page; passwordless code sign-in | B | Portal sign-in appears inside L03/L04; no standalone video. |
| `clients/uploads.api.spec.ts` | UPL-01..04 | Document intake, malware refusal, type and size checks, sanitiser, quarantine (API) | C | Backs C1. |
| `clients/uploads.ui.spec.ts` | UPL-01/02, CLI-05 | Virus refused in the portal, clean statement sent, team finds it scanned clean and downloads it | A | C1 clip; also L04 scene 6. |
| `clients/verify-and-sign.ui.spec.ts` | CLI-04/06, SCN-01 | Identity verification and signature inside the portal; account approved; team sees records and signed file | A | L03 scenes 4-7; L04. |
| `cross-cutting/durable-identity.api.spec.ts` | X-05 | No session tokens in the workflow journal; case survives initiator deactivation | C | No video. |
| `cross-cutting/restate-ingress.api.spec.ts` | X-06 | Workflow engine ingress is not a way around authorization | C | No video. |
| `cross-cutting/sessions.api.spec.ts` | X-03 | Logout revocation, short-lived tokens, lockout, reset, password change | C | No video. |
| `cross-cutting/tenant-isolation.api.spec.ts` | X-01 | Tokens valid only for their institution; id guessing yields nothing; files isolated | C | No video (cannot be shown honestly on screen). |
| `demo/d01-tenant-onboarding.demo.spec.ts` | STAFF-02, FIA-01 | Recorded story: staff onboard an institution, administrator activates | A | Existing recording for L02 (and L01); revise: fixed names, Roles scene. |
| `demo/d02-customer-kyc.demo.spec.ts` | CLI-04/06, SCN-01 | Recorded story: customer verifies and signs on a phone; team sees the record | A | Existing recording; rewrite to start on the bank's website: L03 (and L01). |
| `demo/d03-reviewer-decision.demo.spec.ts` | REV-01/02, CLI-03 | Recorded story: loan applicant, reviewer queue, approve with a reason | A | Existing; retired. Kept as the fallback for L04 (loan wording) if the KYC variant cannot be driven. |
| `demo/d04-roles-audit-automation.demo.spec.ts` | SUP-01, FIA-12, SCN-10 | Recorded stories d04 (four-eyes, roles, audit) and d05 (three paths) | A | Existing recordings for L05 (d04) and L07 (d05, split into its own file); the audit scene moves to d09 (L06). Both feed L01. |
| `demo/d06-workflow-config.demo.spec.ts` | DES-01/02/05 | Recorded story: designer builds form and workflow, embeds on the site | A | Existing recording for L09; extend with the live-on-site scene. |
| `demo/d07-suspend-reactivate.demo.spec.ts` | STAFF-03 | Recorded story: suspend and reactivate an institution | B | C3 clip. |
| `fi-admin/access-changes.api.spec.ts` | FIA-19 | Privileged changes notified; second approver; scheduled changes | C | UI part is in access.ui; used in L08. |
| `fi-admin/access.ui.spec.ts` | FIA-13/14/15/16/19, STAFF-08 | Roles page and matrix, custom permission, gated workflow publish, IdP group mapping, second administrator, restore access | A | L05 scenes 6-7 (roles, matrix); L08 scenes 5-7 (second administrator). IdP mapping and restore access: no video. |
| `fi-admin/api-clients-webhooks.api.spec.ts` | FIA-10, X-07 | OAuth client credentials, idempotency, signed webhooks | C | No video. |
| `fi-admin/api-clients-webhooks.ui.spec.ts` | FIA-10, WH-01 | Create API client (secret shown once) and webhook (test delivered) | D | Cut: developer audience, secrets on screen. |
| `fi-admin/audit.api.spec.ts` | FIA-12, X-04 | Audit entries with actor and target; export; append-only; hash chain | C | Backs L06 claims (hash chain, append-only). |
| `fi-admin/custom-access.api.spec.ts` | FIA-13/14 | Custom permissions, gated workflows (API) | C | UI part in access.ui. |
| `fi-admin/first-sign-in.ui.spec.ts` | FIA-01 | Invitee chooses a password and lands in the workspace as administrator | A | L02 scenes 5-7. |
| `fi-admin/idp-roles.api.spec.ts` | FIA-16 | Roles from IdP groups, guards against lock-out | C | No video. |
| `fi-admin/integrations.ui.spec.ts` | CON-01, INT-04 | Connect the SMTP connector from the Integrations page: consent, connector's own page, active connection | D | Cut for now: developer/ops audience, mid visual. |
| `fi-admin/roles.api.spec.ts` | FIA-05 | Permission catalogue, system roles read-only, no privilege escalation | C | Backs L05. |
| `fi-admin/security-policy.api.spec.ts` | FIA-08 | MFA required by default for new institutions | C | Backs L02 narration (second factor). |
| `fi-admin/sso-scim.api.spec.ts` | FIA-06/07 | SSO enforcement, JIT, SCIM provisioning | C | No video. |
| `fi-admin/sso.ui.spec.ts` | FIA-06 | Sign in through the IdP (redirect and return) | D | Cut: redirect screens of a fake IdP, weak story. |
| `fi-admin/team-and-roles.ui.spec.ts` | FIA-04/05 | Invite a reviewer, activation, reviewer sees a reduced menu, deactivate; change role; custom role | A | L08 scenes 1-4, 8; L05 (custom role optional). |
| `fi-admin/team.api.spec.ts` | FIA-04 | Invite, change roles, deactivate revokes sessions, last admin protected | C | Backs L08. |
| `fi-admin/webhooks.api.spec.ts` | WH-01/02 | Retries, delivery log, secret rotation, 410 disable; bank system starts a workflow and hears back | C | No video. |
| `fi-admin/who-sees-what.api.spec.ts` | FIA-15/17/18, STAFF-08 | Matrix, role members and usage, who holds a permission, export, attributes, time-bound roles | C | Backs L05 (matrix). |
| `fi-admin/workspace.api.spec.ts` | FIA-02/03 | Institution profile and branding, custom domains with DNS verification | C | No video (no UI test). |
| `fi-roles/assisted-application.ui.spec.ts` | RM-01/02 | Relationship manager starts a loan application; customer confirms by link and code; reviewer decides | A | S7 stretch. |
| `fi-roles/authorization-matrix.api.spec.ts` | X-02 | Every system role against representative operations (227 generated checks) | C | Backs L05 (not shown). |
| `fi-roles/compliance.api.spec.ts` | CMP-02/03 | Case timeline, evidence export, data-rights completion | C | Backs L06 and C2. |
| `fi-roles/flow-designer.api.spec.ts` | DES-01..04 | Form publish and embed, versioned workflows, triggers, routing to roles | C | Backs L09. |
| `fi-roles/integrations.api.spec.ts` | INT-01..05 | Connector catalogue, secrets write-only, connected systems as components, data source queries, SMTP | C | No video. |
| `fi-roles/party-routing.api.spec.ts` | PTY-01 | One team member handles every party of an application | C | No video. |
| `fi-roles/relationship-manager.api.spec.ts` | RM-01/02 | Assisted application and scope (API) | C | Backs S7. |
| `fi-roles/reviewer-inbox.ui.spec.ts` | REV-01/02 | Reviewer claims from the team queue, reject needs a reason, approves with a reason | A | L04 scenes 2-4, 7. |
| `fi-roles/reviewer.api.spec.ts` | REV-01/02/04 | Queue routing, reason required, high authority refused, segregation of duties | C | Backs L04. |
| `fi-roles/senior-reviewer.api.spec.ts` | SUP-01/02 | Second, different approver; reassign tasks | C | Backs L05. |
| `fi-roles/support-agent.api.spec.ts` | AGT-01 | Support agent looks up status and resends links, cannot decide | C | No video. |
| `fi-roles/workflow-editor.ui.spec.ts` | DES-06 | Visual workflow editor: every step renders; configure a step, validate, publish | A | L09 scene 8; L07 scene 1 (canvas). |
| `live/live.api.spec.ts` | LIVE-01..05 | Live streams, who may listen, topics (API) | C | No video. |
| `live/live.ui.spec.ts` | LIVE-01/02/03 | Balance changes on screen when the core system writes it; queue fills without reload; progress messages | B | S11 stretch (40 s clip). |
| `scenarios/aml-screening.api.spec.ts` | SCN-05, CMP-01 | Screening hit adjudicated: false positive cleared, true positive rejected | C | No UI test: not producible without new UI work. |
| `scenarios/dealer-finance.api.spec.ts` | SCN-12 | Dealer finance solution through the API | C | Backs S12. |
| `scenarios/dealer-finance.ui.spec.ts` | SCN-12, AUT-01/03, APP-01 | Dealer finance end to end: AI reads stipulations, pipeline, signatures, funding, QuickBooks, LoanPro, buyer pays | A | S12: strongest vertical story but 7 minutes, five fakes, four personas. Not in budget. |
| `scenarios/kyb.api.spec.ts` | SCN-09 | Business onboarding waits for every owner to verify | C | Backs S6. |
| `scenarios/loan-origination.api.spec.ts` | SCN-04 | Credit score from the bank's database; low declined; large needs two approvers | C | Covered on screen by loan-pre-approval.ui (L05, L07). |
| `scenarios/loan-pre-approval.ui.spec.ts` | SCN-10, DES-01/02/05, SUP-01 | Designer builds form and workflow, embeds it; small loan automatic, mid-size to a reviewer, large needs two seniors, unaffordable declined | A | L05, L06, L07, L09, L01. |
| `scenarios/retail-account-opening.api.spec.ts` | SCN-01/02/03/06/08 | Verify and sign; declined; inconclusive to manual review; document resubmission; audit trail of a case | C | Outcomes shown on screen in L03 and L04 (new demo specs d02, d03). |
| `scenarios/suspicious-activity.ui.spec.ts` | SCN-11, RM-03, CMP-04, AUD-01 | RM flags a client; triage; investigation; MLRO decision; client never told; auditor read-only | A | S5 stretch (75 s): first to add if budget remains. |
| `scenarios/timeouts.api.spec.ts` | SCN-07 | Reminder then expiry; SLA breach escalates | C | No video: time-based, nothing to see without long waits. |
| `staff/connectors.api.spec.ts` | CON-04 | Staff register, approve, revoke connector versions | C | No video. |
| `staff/platform-console.ui.spec.ts` | STAFF-01/02/03/05/06, FIA-11 | Console sign-in, onboard institution, suspend and reactivate, invite staff, time-bound support access | A | L02 scenes 1-3 and 9; C3 clip (suspend). Staff invite: no video. |
| `staff/staff-management.api.spec.ts` | STAFF-01/06/07 | Platform roles, platform audit log, staff MFA | C | Backs L02 scene 9. |
| `staff/staff-sso.api.spec.ts` | STAFF-01 | Staff sign in through the company IdP | C | No video. |
| `staff/support-access.api.spec.ts` | STAFF-05 | Request, approval, read-only use, revocation, audit | C | Backs X5 (not made). |
| `staff/tenants.api.spec.ts` | STAFF-02/03/04 | Onboard, keys validated, every system role present, lifecycle, no data access by default | C | Backs L02 (system roles scene) and C3. |

Counts: A 25, B 3, D 5, C 51; total 84.

## Appendix B. Spec to story map

| Spec (as named in the stories) | Stories |
|---|---|
| `client-app/banking-app.ui` | L10 |
| `client-app/map.ui` | L10 |
| `client-app/studio.ui` | L10 |
| `clients/apply-embedded.ui` | L03 |
| `clients/data-rights.ui` | C2 |
| `clients/privacy.api (claims)` | C2 |
| `clients/uploads.api (claims)` | C1 |
| `clients/uploads.ui` | C1 |
| `clients/verify-and-sign.ui` | L03 |
| `demo/d01-tenant-onboarding` | L01, L02 |
| `demo/d02-customer-kyc` | L01, L03 |
| `demo/d03-reviewer-decision (retired: fallback)` | L04 |
| `demo/d04-roles-audit-automation` | L01 |
| `demo/d04-roles-audit-automation (scenes 1-5, 7-8 of the old file)` | L05 |
| `demo/d05 (second test of the old d04 file)` | L07 |
| `demo/d05-automation-paths` | L01 |
| `demo/d06-workflow-config` | L09 |
| `demo/d07-suspend-reactivate` | C3 |
| `demo/d08-kyc-manual-review` | L01 |
| `demo/d09-audit-evidence` | L01 |
| `demo/d09-audit-evidence (new)` | L06 |
| `fi-admin/access-changes.api` | L08 |
| `fi-admin/access.ui` | L06, L08 |
| `fi-admin/access.ui (roles page and matrix)` | L05 |
| `fi-admin/access.ui (roles page)` | L02 |
| `fi-admin/audit.api (claims)` | L06 |
| `fi-admin/first-sign-in.ui` | L02 |
| `fi-admin/team-and-roles.ui` | L08 |
| `fi-admin/team.api` | L08 |
| `fi-roles/compliance.api (claims)` | L06, C2 |
| `fi-roles/flow-designer.api (claims)` | L09 |
| `fi-roles/reviewer-inbox.ui` | L04, L05 |
| `fi-roles/workflow-editor.ui` | L07, L09 |
| `scenarios/loan-origination.api (rules)` | L07 |
| `scenarios/loan-pre-approval.ui` | L05, L07, L09 |
| `scenarios/retail-account-opening.api (SCN-03 as the outline)` | L04 |
| `scenarios/retail-account-opening.api SCN-08` | L06 |
| `staff/platform-console.ui` | L02, C3 |
| `staff/tenants.api (claims)` | C3 |

## Appendix C. plan.json

`demo/plan.json` has 26 entries (13 videos, each in English and Spanish) in the cleude and flow-mind schema: `project`, `voice`, `brand`, `actors{en,es}`, `videos[]` with `slug`, `voice`, `lang`, `note`, `parts[]` (`card` with `kicker`, `title`, `subtitle`, `say`, `seconds`; `scene` with `key`, `lines[]` of `step`, `text`, `say`, `to`). Two optional keys are added and ignored by the current composer: `lines[].hold` and `lines[].zoomHint`. Top-level `plan` and per-video `plan` hold the metadata (tier, estimated seconds, characters, order, stop-lines).
The brand colours are sampled from the product itself (primary `#6751e6`, from the interface screenshots and `--primary` 248 75 percent 58 percent in `apps/web/src/globals.css`) instead of the draft's teal.

