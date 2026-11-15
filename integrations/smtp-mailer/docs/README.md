# smtp-mailer connector

Sends workflow e-mails through the institution's own SMTP server (docs/plans/03 §First connectors).

- **Audience**: institutions (`tenant`).
- **Scopes**: `installation:write` (report status and a non-secret summary), `records:write` (a `message` record per e-mail).
- **Component**: `connector:smtp-mailer/email.send` (sync action; events `sent`, `failed`). Config: subject, message,
  reply-to; input: `to`.
- **Settings**: host, port, TLS, username, password (write-only, encrypted with the connector's key), from address/name.
  The connection is checked (`SMTP verify`) before saving.
- **Data handling**: stores the SMTP settings and the encrypted password; deleted (crypto-shredded) when the connection
  is removed. Message bodies are not stored by the connector.

Local development: `bun run stack` starts it on http://localhost:4101 with its own database `connector_smtp_mailer`.
Point it at the local mailbox: host `localhost`, port `1025`, no TLS (any username/password works, except the password
`wrong`, which the mailbox rejects).
