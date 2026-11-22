# LoanPro — assumptions to check against a sandbox

The connector targets LoanPro's OData API as we understand it from its public documentation; the fake
(`fake-services/loanpro`) implements these assumptions. Each one is checked by the e2e tests in
`apps/e2e/tests/dealer-finance` against the fake; a contract run against a LoanPro sandbox ticks them off.

- [ ] Base address `https://loanpro.simnang.com/api/public/api/1`, headers `Authorization: Bearer <token>` and
      `Autopal-Instance-Id: <tenant id>`; answers wrapped in `{ "d": … }`.
- [ ] `POST /odata.svc/Customers` with `firstName`, `lastName`, `email`, `primaryPhone`, `customId`.
- [ ] `POST /odata.svc/Loans` with `displayId`, `LoanSetup` (`loanAmount`, `loanRate`, `loanTerm`, `contractDate`,
      `firstPaymentDate`, `loanClass`, `paymentFrequency`), `Collateral`, `Customers.results[{ __id, customerRole }]`;
      the answer carries the computed `LoanSetup.payment` and `maturityDate`.
- [ ] Activation with `PUT /odata.svc/Loans(id)` and `LoanSetup.active: 1` (LoanPro's "activate loan").
- [ ] `GET /odata.svc/Loans(id)?$expand=LoanSetup,StatusArchive,Payments`; `StatusArchive.results[0]` has
      `principalBalance`, `nextPaymentDate`, `nextPaymentAmount`, `daysPastDue`, `payoff`, `loanStatusText`.
- [ ] A payment is logged with `POST /odata.svc/Loans(id)` and `Payments.results[{ amount, date, paymentTypeId,
      paymentMethodId }]`.
- [ ] Webhooks (LoanPro "event triggers" / webhooks): JSON `{ id, event, loanId, displayId, customerId, … }` with
      events `payment.posted`, `loan.delinquent`, `loan.paid_off`, signed `X-LoanPro-Signature: sha256=<HMAC-SHA256 hex
      of the body>` with the secret set in LoanPro. (In LoanPro this is configured per trigger; names may differ.)
