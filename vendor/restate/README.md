# Restate server (third-party software)

This folder contains third-party software, not Lintelia code. The repository's MIT license does **not** apply to it.

- Software: Restate server `restate-server` 1.8.1, linux-x64 (`linux-x64/restate-server-linux-x64-1.8.1.tgz`, the npm package `@restatedev/restate-server-linux-x64` as published).
- Copyright: Restate Software, Inc., Restate GmbH.
- License: Business Source License 1.1 (Change License Apache-2.0, four years after release); text in [LICENSE](LICENSE), third-party notices in [NOTICE](NOTICE). Keep both with the binary.
- Source: https://github.com/restatedev/restate
- SHA256 (also in `../SHA256SUMS`):
  - `efe1e2f53dd4ecb52ec72d14a4bcd8af01518639eb4c94fdd48de4e1649e61ab` restate-server-linux-x64-1.8.1.tgz
  - `ea4fd504ffe508ce7ece0727a714a4fffc7208ad5a9618ae33f794d713450f02` LICENSE
  - `8866d808298f7f4b3b48f6ff86b117ff53c7dbe7b3fcfabd48b9fb93497ae3b9` NOTICE
- Used by `apps/core/scripts/restate.ts` when `node_modules` has no Restate binary (see docs/SUBMISSION-RUN.md).
