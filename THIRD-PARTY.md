# Third-party software

The repository is MIT-licensed (see LICENSE), except for the following, which keeps its own license:

- `vendor/restate/`: the Restate server binary (1.8.1, linux-x64), Business Source License 1.1, copyright Restate Software, Inc., Restate GmbH. See `vendor/restate/README.md`, `vendor/restate/LICENSE` and `vendor/restate/NOTICE`. The MIT license does not apply to it.

npm dependencies keep their own licenses (installed, not vendored).

## Restate server: licence finding

Source of the text: the LICENSE file in npm package `@restatedev/restate-server-linux-x64@1.8.1`, byte-identical
(SHA256 `ea4fd504...1e0f02`) to `LICENSE` at tag `v1.8.1` of https://github.com/restatedev/restate. Business Source
License 1.1; Licensor: Restate Software, Inc., Restate GmbH; Licensed Work: Restate, (c) 2023 - 2026.

- Redistribution is permitted: "The Licensor hereby grants you the right to copy, modify, create derivative works,
  redistribute, and make non-production use of the Licensed Work."
- Condition: "You must conspicuously display this License on each original or modified copy of the Licensed Work."
  and "All copies of the original and modified Licensed Work, and derivative works of the Licensed Work, are subject
  to this License." Hence `vendor/restate/LICENSE` and `NOTICE` ship with the unmodified binary.
- Additional Use Grant: "You may make use of the Licensed Work, provided that you may not use the Licensed Work for
  a Public Restate Platform Service" (a managed service letting third parties register their own service
  deployments and invoke them). Production deployments running the licensee's own services, and internal
  deployments, are explicitly permitted. Lintelia runs its own workflows and is not such a service.
- Change Date / Change License: "4 years after release" / Apache License, Version 2.0.
- No trademark or logo rights are granted.

Conclusion: redistributing the unmodified binary in this public repository, with the licence text, is allowed. The
vendored folder stays under this licence, not MIT.
