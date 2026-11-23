# Running Lintelia on Ubuntu (submission review)

## Prerequisites

- Ubuntu 22.04/24.04 (x64), a normal non-root user, `curl`, `unzip`, `tar`.
- Bun 1.3.14: `curl -fsSL https://bun.sh/install | bash -s bun-v1.3.14` (or `npm i -g bun@1.3.14`).
- No Docker, Postgres or Restate install: Postgres (embedded), Redis and the fake vendors run as local processes.

## Quick start

```sh
bun install
bun run stack            # Postgres, Restate, API, web, connectors, fakes; migrates and seeds
bun run stack:status
bun e2e                  # optional: end-to-end suite (UI tests need `bunx playwright install chromium`)
```

Accounts and URLs: see the readme and [TESTING.md](../TESTING.md).

## Vendored Restate engine

Restate (durable execution server) normally comes from the npm package `@restatedev/restate-server` (installed by
`bun install`). So that review does not depend on that download, the repo also carries the linux-x64 binary of
version 1.8.1 under `vendor/restate/linux-x64/`: the npm tarball as published (83 MB) plus the upstream `LICENSE` and
`NOTICE` (in `vendor/restate/`). Its SHA256 is in `vendor/SHA256SUMS`; the npm registry's integrity for the same file is
`sha512-ArtX7BcCwWfrKg+JYk2xVvAdU/zhAj/I/ZWATJe1YgadqJ4ynT0w7D/6wtmg0vDfA/9aRXD3yuQ5c1J7O2ZxVQ==`.

`apps/core/scripts/restate.ts` (`bun run restate:serve`, used by the stack) picks the binary:

1. the one in `node_modules/.bin`, if present;
2. otherwise the vendored one: verified against `vendor/SHA256SUMS`, extracted into `.data/restate-bin/` and run;
3. `RESTATE_USE_VENDORED=1` prefers the vendored one even when `node_modules` has one.

Only linux-x64 is vendored; other platforms use the npm package.

Licence: Restate is under the Business Source License 1.1 (becomes Apache-2.0 four years after each release). It
permits copying, redistribution and non-production use, and production use except as a public Restate platform
service, which Lintelia is not. The licence text must stay with the binary, hence `LICENSE` and `NOTICE` next to it.
The repository's MIT licence does not apply to `vendor/restate/`.

## Known limits

- Restate is vendored for linux-x64 only.
- Browser (UI) e2e tests need Playwright Chromium and its system libraries.
- Verified on Ubuntu 24.04 (Docker, Bun 1.3.14, Restate absent from `node_modules`): `bun ./scripts/restate.ts serve`
  extracts the vendored binary, reports `restate-server 1.8.1` and the admin API answers 200 on :9070. The full stack
  and e2e suite were not re-run for this change.

## Rollback

Delete `vendor/restate/` (and its lines in `vendor/SHA256SUMS`), or `git revert` the commit, or reset to tag
`pre-vendor-submission`. The script then falls back to the npm package.
