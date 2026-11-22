# postgres-datasource connector

Parameterised queries against the institution's own PostgreSQL database (docs/plans/03 §First connectors).

- **Component** `connector:postgres-datasource/query.run` (sync; events `success`, `failed`). Config: `query` with
  named parameters (`:customerId`), `params` (templates, e.g. `{{input.customerId}}`), `maxRows`. Output: `rows`,
  `rowCount`, `truncated`.
- **Safety**: values are always bound parameters; every query runs in a `READ ONLY` transaction unless the connection
  allows changes; 10 s statement timeout; at most 1000 rows.
- **Settings**: host, port, database, user, password (write-only, encrypted), TLS, allow changes. Checked with
  `select 1` before saving.
