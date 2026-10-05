# OPDS proxy

Private OPDS 1.2 catalog for completed Searchfloor books. Browse `/opds`, then
`/opds/searchfloor`. Upstream search/pagination and on-demand FB2 ZIP downloads;
disposable metadata cache, no stored book files. Authors/genres reserved in v1.

[`spec.md`](spec.md) is the normative architecture/behavior contract. Read it
before changing behavior; update specification, implementation and tests together.

Node 24 required. `npm ci`, `npm test`, `npm run typecheck`.
Build with `npm run build`, start with `npm start`. Tests build first.
Supply dedicated credentials and settings from `.env.example` through environment
or Node `--env-file`. Config validation never prints values. Runtime binds only
`127.0.0.1:8787`; use HTTPS in front. OPDS requires Basic auth; `/health` exposes
only readiness and release SHA.

Lists can fall back to data observed in the past 24 hours. Download requires
completion evidence newer than 15 minutes. Transfers validate MIME/ZIP signature
and use backpressure: one transfer, 20 MiB cap, 60 second deadline, cancellation
on disconnect. No Range support.

Fixtures/mocks never crawl Searchfloor. Evidence: `docs/source-contract.md`.
Actual FBReader acceptance remains pending in `docs/fbreader-acceptance.md`;
automated tests do not prove reader compatibility. Host installation is separate
from prepared deployment files.
