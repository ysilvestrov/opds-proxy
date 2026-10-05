# Independent OPDS source proxy implementation plan

> **For agentic workers:** Execute sequentially in the main thread using
> superpowers:executing-plans after owner spec and plan review. No delegation.

**Goal:** Use the verified server-side proxy candidate with independent OPDS
credentials, preserving source/privacy/streaming boundaries.

**Architecture:** One explicit undici ProxyAgent owned by the composition root;
inject its fetch transport into the existing SearchfloorClient. Reuse it for HTML
and downloads. Unset configuration retains direct transport; configured proxy
failure never falls back to direct or rotates agents to escape denial.

**Tech Stack:** Node 24, strict TypeScript, undici compatible with Node 24,
existing Hono/SQLite/Vitest, local mock HTTP proxy and upstream for tests.

**Spec:** root `spec.md` 0.4.4, proposed SOURCE-002 source-proxy delta.
**Status:** PENDING OWNER SPEC REVIEW, THEN PLAN REVIEW; no application changes
or deployment performed. Diagnostics established completed-page parsing, not
search/download/FBReader acceptance. Original installed SHA/config remain fixed.

## Global constraints

- ARCH-001: pure server-side operation, dedicated OPDS resources and config.
- SOURCE-002: HTML 2 MiB, 15 s, concurrency 1, >=1 s start gap; queue <=20,
  wait <=30 s; max one retry on 429/5xx, <=10 s, longer cooldown respected;
  HTTPS same-origin redirects <=3. No retry/rotation/challenge solving on 403.
- DOWNLOAD-001/002: sniff <=4 KiB, ZIP validation, <=20 MiB, 60 s total,
  one active transfer, backpressure and upstream abort on client disconnect.
- AUTH-001: private Basic over HTTPS on every catalog/acquisition route.
- OPS-002/ACCEPT-001: immutable exact-SHA Linux artifact; no server build,
  installer --apply rerun or mutation of bot resources; timer stays disabled.
- Do not copy bot proxy credentials into OPDS or read bot env at OPDS startup.
- No permanent proxy traffic until owner confirms budget, credentials and review.

## Review focus

1. Configured proxy407/connect error must fail closed without a direct retry.
2. Redirect validation applies to the source URL, never to an arbitrary client URL.
3. Proxy backpressure/disconnect must release download slot and abort source.
4. Provider idle/session expiry must not turn into hidden rotation-on-denial.
5. Failed HTTP checks must persist earlier evidence without logging credentials.

## Task 1: Explicit config and transport lifecycle

**Files:** `src/config.ts`, new `src/sources/transport.ts`, `src/index.ts`,
`package.json`, lockfile, `.env.example`, `tests/config.test.ts` (create if absent),
new `tests/transport.test.ts`.

**Interfaces:** `createSourceTransport(proxyUrl?: string): {fetch: typeof fetch;
close(): Promise<void>}`. `Config.OPDS_SOURCE_PROXY_URL?: string`.
Only HTTP(S) absolute URL, no query/fragment; credentials remain private config.
Current direct behavior is unchanged when unset.

- [ ] Add failing config tests: absent proxy accepted; http/https accepted;
  socks/file/invalid URL rejected; validation/log output never includes URL/userinfo.
- [ ] Add failing local-mock transport tests: configured requests use proxy;
  proxy407/connect failure makes no direct request; no cookie or rotation logic;
  two requests reuse one dispatcher; explicit close releases resources.
- [ ] Run targeted tests and observe RED.
- [ ] Pin a Node24-compatible undici version/lockfile on development/CI, not host.
  Implement explicit ProxyAgent fetch injection without global dispatcher mutation.
  Wire it once in composition root and close after active work drains on SIGTERM.
  Redact proxy-related error details/URL as well as Authorization.
- [ ] Run targeted tests GREEN, existing client tests and typecheck; commit owned files.

## Task 2: Streaming and source limits through proxy

**Files:** `tests/client.test.ts`, `tests/download.test.ts`, new local proxy fixture
utility under `tests/helpers/`; implementation changes only if tests show a defect
against the approved spec.

**Interfaces:** existing `SearchfloorClient({fetch})`, `list`, `getBook`,
`openDownload` and `Downloads.streamBook`. No new public OPDS API.

- [ ] Add failing proxy-backed tests for forbidden redirect, 403/challenge without
  retry, 429 long Retry-After/cooldown, HTML cap and timeout, proxy407 -> availability.
- [ ] Add failing stream tests: exact ZIP bytes, <=4 KiB sniff/replay,
  20 MiB cap with known/unknown size, 60 s deadline, slow consumer backpressure,
  downstream disconnect aborts proxy upstream and frees slot, no book file writes.
- [ ] Run targeted tests RED; implement only necessary transport boundary fixes.
- [ ] Run targeted tests GREEN and test/typecheck/build in CI with native load;
  do not install/build packages on the live host. Commit test/implementation files.

## Task 3: Independent operator config and reliable resume verification

**Files:** `deploy/prototype.env.example`, `deploy/runtime.env.example`,
`deploy/README.md`, new `scripts/verify-existing-prototype.py`, verification tests.
Keep prepared `deploy/start-prototype.sh` an installer, not a resume command.

**Interfaces:** resume verifier reads only root-only OPDS config, emits sanitized
per-request JSONL consumed by `scripts/diagnostics/record-jsonl.py` (flush/fsync).
It never installs, replaces current, regenerates credentials or enables timers.

- [ ] Owner confirms actual proxy plan, remaining bandwidth, session/idle and
  concurrency limits; allocate OPDS-only provider sub-user and explicit quota
  in the existing plan if an available included slot exists. No paid upgrade
  or bot-config change. Supply credentials via protected operator channel.
- [ ] Add failing offline tests: existing installation accepted by resume verifier;
  wrong health SHA/Basic/XML fails and retains earlier rows; credentials and
  proxy URL absent from output/argv; no bootstrap/config changes in resume path.
- [ ] Implement resume verifier and operator env instructions after tests RED.
  Set OPDS_SOURCE_PROXY_URL only in its own root-only config; do not read bot env.
- [ ] Run tests GREEN, inspect script/privilege diff, owner reviews concrete
  config/current-switch procedure before any host action. Commit owned files.

## Task 4: New artifact and controlled existing-installation acceptance

**Files:** `docs/prototype-report.md`, `docs/fbreader-acceptance.md`,
`docs/runtime-measurements.md`. This plan cannot authorize replacing the original
pin by inference; record and review the new exact application SHA/run/artifact.

- [ ] Produce a fresh successful feature push artifact in CI, verify workflow/jobs,
  digests/extractor/host manifest, then separately approve its prototype activation.
- [ ] Recheck bot health/NRestarts, unit states and free port. Operator installs
  only new immutable prototype code and changes its prototype pointer/config;
  preserve original code and credentials, production state/current remain untouched.
- [ ] Start only manual prototype and record health exact SHA, local/HTTPS Basic,
  static XML, one completed page, one search page and at most one next page if present.
- [ ] After transport/traffic review, perform at most one completed Download within
  20 MiB/60 s, validate ZIP/FB2 in memory, never persist book contents. Failure stops
  manual prototype; retain sanitized per-request status/bytes evidence.
- [ ] Measure runtime RSS/CPU/cache+WAL and before/after bot state; owner runs
  FBReader 3.8.31 including protected empty-page fixture, Basic acquisition/ZIP open.
- [ ] Stop manual prototype after controlled tests. Production/timer remain off;
  production enablement/rollback are later explicit stages.

## Decision and remaining prerequisites

The proxy Node adapter candidate is verified for completed-page parsing.
Root spec delta and this plan require owner review before retained application
code. Account-specific quota, available sub-user slot, dedicated credentials,
proxy download/session behavior and reader acceptance are still unverified.
No browser installation or source-admin contact is needed to proceed with this
selected design. Prefer sequential implementation in the main thread.
