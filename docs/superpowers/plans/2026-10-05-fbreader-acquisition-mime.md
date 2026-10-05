# FBReader acquisition MIME correction

Status: owner approved specification delta and implementation plan on 2026-10-05.
Application correction merged as c22ac2e; CI/artifact verified.
Terminal update installed c22ac2e; runtime/HTTPS verified.
Owner confirms missing Download resolved; remaining individual reader checks pending.
Results: `docs/fbreader-mime-update-report.md`.
Evidence: `docs/fbreader-download-diagnosis.md`.
Requirements: SPEC-001, OPDS-001, DOWNLOAD-001/002, AUTH-001.

## Proposed root specification delta

Replace OPDS-001's first-prototype `application/zip` acquisition MIME paragraph
with:

> Acquisition link type SHALL be `application/fb2+zip`, identifying a full FB2
> ZIP book to FBReader. Download HTTP Content-Type remains `application/zip` for
> the raw ZIP payload. The filename remains `.fb2.zip`. This corrects the original
> generic ZIP link type after observed missing Download on 2026-10-05; public
> FBReader source distinguishes FB2 ZIP from an unsupported generic ZIP archive.

Retain feed/OpenSearch types and the EPUB prohibition. Add OPDS-001 scenario:

> WHEN FBReader opens a completed book entry, THEN its acquisition link advertises
> `application/fb2+zip` and offers Download; acquisition sends private Basic auth
> and the downloaded ZIP opens as FB2. Device results must be recorded separately
> from fixture/HTTP checks.

## Implementation after review

1. Update root specification with the approved delta. Update the existing
   `tests/feed.test.ts` acquisition-type assertion to `application/fb2+zip` and
   confirm it fails against the old renderer. Preserve relation, absolute URL,
   escaping and next-link assertions. HTTP download tests keep generic ZIP.
2. Change only acquisition link MIME in `src/opds/feed.ts`. Run feed/download
   regression tests, full CI tests/typecheck/build/package in CI or development
   environment, never install/build application dependencies on this host.
   Record that unit tests do not prove Premium device compatibility.
3. Publish application changes via Git for feature review/integration. Obtain a
   new successful feature push CI artifact pinned to the approved application
   SHA, exact workflow/run/jobs/artifact/digests and expiry. Never patch installed
   immutable code or reuse e57f0a6 as though it contained this correction.
4. Prepare a bounded operator update helper for the existing e57f0a6 baseline,
   preserving root-only proxy/Basic config and rollback release. Existing
   stage/acceptance helpers hard-code older identities; revise their guards
   explicitly rather than rerunning them unchanged. Stop prototype through the
   operator before installation, verify bot health and disabled production timer,
   validate new artifact/native module, then switch only prototype current.
5. Verify private HTTPS feed MIME from parsed XML without storing book metadata;
   then owner refreshes/re-adds catalog if cached and checks Download visibility,
   downloads at most one listed book within existing limits and opens FB2.
   Record separate auth prompt/status, actual device version and provider usage.
   If Download stays absent, retain the failure and investigate device behavior;
   do not introduce alternate formats/auth fallback automatically.

Streaming, backpressure, cancellation, 20 MiB/60-second bounds, route, independent
proxy, production timer and bot resources remain governed by the existing spec.
Production stays deferred until required device acceptance passes.
