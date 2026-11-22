# loanpro connector

LoanPro loan servicing (docs/plans/12): board funded loans, take payments, read a loan's status, and follow servicing
events. Components `connector:loanpro/loan.board` (`boarded` / `failed`), `payment.create` (`posted` / `failed`),
`loan.get` (`found` / `failed`). LoanPro webhooks update the borrower's app (collections `loans`, `payments`, through
`client-records:write`) and are published as `connector:loanpro/payment.posted`, `loan.delinquent`, `loan.paid_off`
with the borrower as the applicant of the workflows they start. Assumptions: `ASSUMPTIONS.md`.
