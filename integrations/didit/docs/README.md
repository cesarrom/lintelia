# didit connector

Identity verification with [Didit](https://didit.me) (docs/plans/05): ID document + liveness + face match (+ AML when
the Didit workflow includes it).

- **Component** `connector:didit/kyc.verify`, a client step: the connector creates a Didit session; the core gives the
  client a "Verify your identity" task; the portal opens Didit's verification page (web SDK protocol); **the decision
  comes from Didit's signed webhook**, never from the browser. Events: `approved`, `declined`, `in_review`, `expired`
  (plus the core's reminder/expiry for client steps).
- **Records**: a canonical `verification` on the case (checks, extracted identity fields, warnings). Images and selfies
  stay at Didit.
- **Settings**: API key and webhook secret (write-only, encrypted), default workflow id, API base URL. The settings page
  shows the webhook URL to configure in the Didit console.
- **Dynamic options**: the Didit workflows of the account (`workflows`).
- Assumptions about Didit's API: [ASSUMPTIONS.md](ASSUMPTIONS.md).
