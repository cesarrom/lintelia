# 05 — Didit and Documenso connectors (best effort before sandbox access)

Both are built as connectors (03) with a matching fake service, so every flow runs locally today and can be pointed at
the real vendor later by changing the connector's base URL and credentials.

**Rule for unknown vendor details**: every assumption about a vendor API is written in the connector's
`docs/ASSUMPTIONS.md` with a checkbox and the test that depends on it; the fake implements the assumption; when sandbox
access arrives, a contract test run against the sandbox ticks the boxes or fails.

## Didit (identity verification, replaces ComplyCube/Onfido and the legacy `identityValidation`/`proofOfLife` nodes)

### What we know (from `@didit-protocol/sdk-web` 0.4.0 on npm, inspected)

- Two integration modes: a **UniLink** workflow URL, or (recommended) a **backend-created session** whose URL is passed
  to `DiditSdk.shared.startVerification({ url, configuration })` (modal or embedded in a container).
- Result callback: `completed` with `session.status` `Approved | Pending | Declined`, `cancelled`, `failed`
  (`sessionExpired | networkError | cameraAccessDenied | unknown`); granular `didit:*` events (`ready`, `started`,
  `step_*`, `verification_submitted`, `status_updated`, `completed`, `cancelled`, `error`…).
- The SDK accepts `postMessage` events from origins ending in `.didit.me` **or from the same host as the iframe URL**,
  so a fake verification page served from `didit.fake.localhost` works with the real SDK.
- Verification URLs live under `https://verification.didit.me` / `verify.didit.me`.

### Assumptions to verify with the sandbox

Session creation endpoint and payload (`POST /v2/session/` with `workflow_id`, `vendor_data`, `callback`, `x-api-key`
header — per Didit's public docs as we remember them), decision retrieval (`GET /v2/session/{id}/decision/`), webhook
signature (`X-Signature` HMAC-SHA256 of the raw body with the webhook secret, plus `X-Timestamp`), status values
(`Approved`, `Declined`, `In Review`, `Abandoned`, `Expired`), and the decision payload fields (ID document data, face
match, liveness, AML). Also whether one Didit "workflow" maps to one of our component configs (we assume yes).

### Connector `integrations/didit`

- **Audience** tenant. **Setup page**: API key, webhook secret, default Didit workflow id, sandbox/production toggle;
  "Test connection" calls a cheap authenticated endpoint.
- **Component** `kyc.verify` (client step, async, timeout configurable, default 7 days):
  1. `invoke`: creates a Didit session with `vendor_data` = opaque callback reference (never our case id or names
     unless required) and the person's name/e-mail only if the Didit workflow needs prefill; stores
     `session_id → callback` in its DB; returns `clientAction { type: 'sdk', sdk: 'didit-web', url }`.
  2. The core creates a client task "Verify your identity"; the **portal** (and the embedded application form, when
     the step runs right after submission) launches the Didit web SDK with the URL; the SDK's `completed` event only
     updates the UI ("we are checking your documents") — **the decision comes from the webhook**, never from the browser.
  3. Webhook (Didit → connector): verify signature, dedupe, fetch the decision, store the raw decision (encrypted,
     retention per manifest), upsert a canonical `verification` (kind identity; checks: document, liveness, face
     match, AML if enabled; extracted identity fields the institution needs; evidence files pushed as `document`s via
     the core files API (07)), complete the step with outcome `approved | declined | in_review`.
  4. `In Review`/`Pending` at Didit → outcome `in_review`: the workflow routes to a human review (SCN-03), the case
     page shows the verification card with Didit's details (UI extension), and a later webhook can update the
     verification (the step is already done; an event `verification.updated` lets workflows react).
  5. Abandoned/expired → `expired` event (SCN-07 timeouts).
- **Erasure/export**: lifecycle `data.erasure_requested` deletes stored decisions and calls Didit's deletion endpoint
  (assumption to verify).
- Replaces: legacy `identityValidation`, `proofOfLife` nodes and their services (01 inventory), the old KYC service.

### Fake `fake-services/didit` (`:9401`, host `didit.fake.localhost`)

- Implements the assumed session and decision APIs and signed webhooks to the callback URL.
- Serves a **hosted verification page** that speaks the SDK's `postMessage` protocol (`didit:ready`, `didit:started`,
  `didit:completed` with status) with big buttons: "Approve", "Decline", "Send to review", "Abandon" — usable by people
  and Playwright alike.
- `/__control`: preset the outcome per applicant e-mail, delay the webhook, send duplicate or badly signed webhooks,
  list received requests.

## Documenso (e-signature, replaces DocuSeal)

### What we know

`docs/vendor-api/documenso-openapi-v2.json` (v2 API, `Authorization: <api key>`): templates (`GET /template`,
`/template/{id}`, `/template/create`, `/template/use`, recipients/fields), envelopes and documents
(`/envelope/use`, `/envelope/distribute`, `/document/{id}/download`, `/envelope/{id}/certificate/download`,
audit log download), **embedding** (`/embedding/create-presign-token`, `/embedding/verify-presign-token`), and the
`@documenso/embed-react` package for embedded signing.

### Assumptions to verify

Webhook events and their authentication (Documenso webhooks are configured per team in its UI; we assume events
`DOCUMENT_SIGNED`, `DOCUMENT_COMPLETED`, `DOCUMENT_REJECTED`, `DOCUMENT_CANCELLED` and a shared-secret header
`X-Documenso-Secret` — not in the OpenAPI file), whether `template/use` vs `envelope/use` is the right call for our
case (v2 moved to envelopes), embedded-signing token flow details, and licensing (AGPL for self-hosting, per
LOCAL-DEV-NOTES) — the connector targets Documenso's hosted API, so our code is not a derivative work; confirm with
counsel if we ever self-host.

### Connector `integrations/documenso`

- **Setup page**: API key, base URL (cloud or self-hosted Documenso), webhook secret; shows the webhook URL to paste in
  Documenso.
- **Dynamic options**: the template list (`GET /template`) for the step configuration.
- **Component** `signature.request` (client step, async):
  1. `invoke` with the template id, signers (from case parties: applicant, co-applicants — 06) and prefill values
     mapped from the case; creates the document from the template, distributes it (or creates an embedded signing
     token), returns `clientAction { type: 'embed', url }` for signing inside the portal (or relies on Documenso's
     e-mail when configured that way).
  2. Webhooks update the canonical `signature_request` per signer; on completion the connector downloads the signed PDF
     and the completion certificate, uploads both to the core as `document`s (07) attached to the case, and completes
     the step (`signed | declined | expired`).
- **Template management** (what DocuSeal was meant for: creating templates dynamically) lives in the connector's setup
  UI or is done in Documenso itself; the core only references template ids.
- **DocuSeal removal**: `handlers/docuseal.controller.ts`, constants, DTOs in `packages/lintelia`, `web/.../docuseal.hooks.ts`,
  `CreateTemplateDialog.tsx`, document template UI and env variables.

### Fake `fake-services/documenso` (`:9402`)

Built from the OpenAPI file (the paths the connector uses), stores templates/documents in memory or SQLite, renders a
signing page with "Sign" / "Decline" buttons, produces a small generated PDF as the "signed" document, sends webhooks
with the assumed header; `/__control` to preload templates and force outcomes.

## Flows unlocked (existing ids)

SCN-01 (account opening: verified, signed, approved automatically), SCN-02 (declined), SCN-03 (in review → human),
SCN-07 (abandoned → reminder → expiry), SCN-09 (KYB with UBOs, with 06), CLI-04 (verify my identity), CLI-06 (sign my
agreement), CMP-02 evidence export including verification and signature artefacts.

## Gaps

| Gap | Note |
| --- | --- |
| Vendor API references | Didit: not in `docs/vendor-api`; add the OpenAPI/reference when access is granted. Documenso webhooks: not in the OpenAPI file |
| Biometric data | ID images and selfies are special-category data (GDPR art. 9): retention, encryption, access only for reviewers of that case, DPIA required |
| Vendor regions | confirm Didit/Documenso processing regions for EU institutions; DORA register entries |
| Liveness in embedded forms on third-party sites | camera permissions inside nested iframes need `allow="camera"` on both our embed iframe and Didit's; plan the embed snippet accordingly |
