# screening connector

Sanctions, PEP and adverse media screening (CMP-01). Component `connector:screening/screening.check` (sync; events
`clear`, `potential_match`); writes a `screening_result` record with the potential matches, which compliance
adjudicates in a review step. Locally it talks to `fake-services/screening` (presets per name via
`/__control/results`). The vendor API shape is generic (`POST /v1/searches`); adapting to a real vendor
(ComplyAdvantage, Dow Jones, LexisNexis…) is done inside this connector.
