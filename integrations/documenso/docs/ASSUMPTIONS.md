# Assumptions about Documenso (to verify against a Documenso team / sandbox)

From the OpenAPI file (verified by reading it): `GET /template`, `GET /template/{id}`, `POST /template/use`,
`GET /document/{id}`, `GET /document/{id}/download?version=signed`, `Authorization: <api token>` header.

Not in the OpenAPI file (assumed, implemented by `fake-services/documenso`):

- [ ] Webhooks are configured per team in Documenso's UI with a URL and a secret; requests carry the secret in
      `X-Documenso-Secret`; body `{ event, payload: <document>, createdAt, webhookEndpoint }`.
- [ ] Events `DOCUMENT_SIGNED` (a recipient signed), `DOCUMENT_COMPLETED` (everyone signed), `DOCUMENT_REJECTED`.
- [ ] Recipients sign at `<app origin>/sign/<recipient token>` and that page can be embedded (or we move to the
      embedding API: `/embedding/create-presign-token` + `@documenso/embed-react`).
- [ ] `template/use` remains available alongside the newer envelope API (`/envelope/use`), or we migrate.

Tests depending on these: SCN-01, CLI-06, CON-02 (apps/e2e).
