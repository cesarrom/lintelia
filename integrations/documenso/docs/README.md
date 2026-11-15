# documenso connector

Electronic signatures with [Documenso](https://documenso.com) (docs/plans/05), on its v2 API
(`docs/vendor-api/documenso-openapi-v2.json`).

- **Component** `connector:documenso/signature.request`, a client step: creates a document from a template
  (`POST /template/use`, by template id or external id), the client signs it in the portal (embedded signing page);
  on `DOCUMENT_COMPLETED` the signed PDF is downloaded and attached to the case (kept byte-identical so the signature
  stays verifiable; still scanned), the `signature_request` record is updated and the step completes (`signed`,
  `declined`; `expired` from the core's expiry).
- **Dynamic options**: the team's templates (`templates`).
- **Settings**: API token and webhook secret (write-only, encrypted), API base URL (cloud or self-hosted). The settings
  page shows the webhook URL to add in Documenso.
- Assumptions: [ASSUMPTIONS.md](ASSUMPTIONS.md). Replaces the old DocuSeal integration.
