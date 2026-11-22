# Assumptions about Didit (to verify with sandbox access)

Each assumption is implemented by `fake-services/didit`; when sandbox access arrives, a contract test against the
sandbox ticks the box or fails.

- [ ] `POST /v2/session/` with header `x-api-key`, body `{ workflow_id, vendor_data, callback?, contact_details: { email } }`
      creates a session and answers `{ session_id, session_number, session_token, url, status }` (201).
- [ ] `GET /v2/session/{session_id}/decision/` answers the decision with `status` and `id_verification`, `liveness`,
      `face_match`, `aml` sections (`status` per section, extracted fields, `warnings[]`).
- [ ] `GET /v2/workflows/` lists the account's workflows (`workflow_id`, `workflow_label`); used to test the API key and
      for the workflow picker. *If no such endpoint exists, "Test connection" must use another cheap authenticated call.*
- [ ] Webhooks: JSON `{ session_id, status, webhook_type, vendor_data, created_at, timestamp }` POSTed to the URL set in
      the Didit console, signed with `X-Signature` = hex HMAC-SHA256(raw body, webhook secret) and `X-Timestamp` (unix
      seconds); Didit retries on non-2xx and may deliver the same status twice.
- [ ] Statuses: `Not Started`, `In Progress`, `Approved`, `Declined`, `In Review`, `Abandoned`, `Expired`.
- [ ] The web SDK (`@didit-protocol/sdk-web`) accepts postMessage events (`didit:ready`, `didit:started`,
      `didit:completed`) from the verification page's own origin, so the portal can embed the session URL.
- [ ] Deleting a session's data on erasure requests (endpoint unknown).

Tests depending on these: SCN-01, SCN-02, SCN-03, SCN-07, CLI-04, CON-02 (apps/e2e).
