# Independent OPDS Source Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement sequentially in this session. Preserve the previously selected
> current-folder/separate-branch workflow; no subagent implementation delegation.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore server-side Searchfloor access through an independent OPDS
WebShare sub-user while preserving private OPDS, source limits and streamed ZIP.

**Architecture:** Composition root owns an explicit source-only dispatcher;
configured HTTP(S) proxy uses one reusable undici ProxyAgent injected into
SearchfloorClient for both HTML and Download. No global proxy setting/direct
fallback on failure; deployer/GitHub requests are independent.

**Tech Stack:** Node24/TypeScript strict, Node24-compatible pinned undici,
existing Hono/SQLite/Vitest, local CONNECT proxy/upstream mocks, Python3.12+ verifier.

**Spec:** root `spec.md`0.4.5; SOURCE-002/003, ARCH-001, CONFIG-001,
DOWNLOAD-001/002, AUTH-001, OPS-001/002, DEPLOY-001/002, ACCEPT-001, COST-001.
**Status:** OWNER SPEC APPROVED 2026-10-05; PLAN READY FOR OWNER REVIEW.
No source transport implementation or server activation performed by this plan.

## Global Constraints

- Current Hetzner host beside the bot; migration is a separate project.
- Runtime/credentials/cache/releases/units independent; no bot env on startup.
- HTML cap2MiB/15s, concurrency1, start spacing>=1s, queue<=20/wait<=30s;
  HTTPS same-origin redirects<=3, one429/5xx retry<=10s, longer Retry-After cooldown.
- 403/challenge never causes retry/rotation; proxy407/connect failure503.
- Download sniff<=4KiB, size<=20MiB, deadline60s, one active stream;
  backpressure, disconnect abort and ZIP validation; no book stored/full buffer.
- SIGTERM drains<=15s then aborts; whole shutdown fits TimeoutStopSec25s.
- Basic HTTPS on OPDS/acquisition; proxy secrets never in URL/headers to reader,
  argv/logs/errors/Git/artifact/cache. No provider management API credential.
- Owner-created OPDS sub-user: provider ceiling1GB accepted. Shared-plan accounting,
  dashboard authority, no app monthly hard cap/top-up/paid upgrade in v1.
- No live source calls from tests/CI. Server runs ready exact-SHA Linux artifact,
  never npm install/build. Cloudflare Free/tunnel/bot remain unchanged.
- Installed prototype/current/config already exist; never rerun installer --apply.
  Production/timer off until existing acceptance/rollback gates pass.

## Review Focus

1. Proxy407/connect failure: no direct retry and503 (Task1).
2. Secret-bearing bad config/network error: field-only/sanitized output (Task1/3).
3. Slow/disconnected reader: bounded proxy stream, abort, freed slot (Task2).
4. Active stream during shutdown: bounded drain/abort and closed dispatcher (Task1/2).
5. Live503 during validation: earlier HTTP evidence survives; no reinstall (Task3).

## File map and interfaces

- `src/sources/transport.ts`: source transport lifecycle only.
  Export `SourceFetch = (input: string | URL, init?: RequestInit) => Promise<Response>`
  and `createSourceTransport(proxyUrl?: string): { fetch: SourceFetch; close(): Promise<void> }`.
  Only explicit source config controls routing; unset means direct, independent
  of ambient proxy env. No mutation of process-global dispatcher.
- `src/config.ts`: `Config.OPDS_SOURCE_PROXY_URL?: string`; absolute HTTP(S),
  path empty or `/`, no query/fragment. Invalid nonempty config fails startup
  with field name only. Absent preserves direct; empty string is invalid.
- `src/index.ts`: creates/injects/closes transport, retains bounded shutdown.
- `tests/helpers/connect-proxy.ts`: disposable loopback CONNECT/upstream fixture.
  `createConnectProxyFixture(): Promise<{ proxyUrl: string; upstreamUrl: string;
  proxyConnects: number; upstreamRequests: number; abortedUpstreams: number;
  close(): Promise<void> }>`; live counters observed through this returned object.
  Every test closes sockets/listeners. HTTP loopback fixtures are test-only;
  production Searchfloor origin/HTTPS validation remain unchanged.
- `scripts/verify-existing-prototype.py`: root-only OPDS config reader/HTTP verifier,
  no service/start/install/config mutation; `--expect-sha SHA`, optional `--live`.
  Writes sanitized JSONL to stdout for an unprivileged durable recorder.
- `scripts/diagnostics/record-jsonl.py`: selected reviewed server recorder import;
  `record(lines: Iterable[str], output: Path) -> None`, fresh0600 file, flush/fsync.

## Task1: Explicit source transport, config and lifecycle

**Modify:** src/config.ts, src/index.ts, package.json, package-lock.json,
.env.example, tests/runtime.test.ts.
**Create:** src/sources/transport.ts, tests/config.test.ts,
tests/transport.test.ts, tests/helpers/connect-proxy.ts.

- [ ] Write config tests: absent direct; HTTP(S) valid; empty/socks/file/path/query/
  fragment invalid; failure contains OPDS_SOURCE_PROXY_URL but no userinfo/URL.
- [ ] Write actual local CONNECT tests: configured request reaches proxy/upstream;
  two requests reuse the same transport;407/connection failure has zero direct
  upstream requests; diagnostics never contain fixture password/endpoint.
- [ ] Write runtime fixture test: injected source dispatcher closes after abort/
  drain and process exits within25s; global fetch/ambient proxy env not changed.
- [ ] Run `node node_modules/vitest/vitest.mjs run tests/config.test.ts tests/transport.test.ts tests/runtime.test.ts`;
  observe missing transport/config assertions fail before implementation.
- [ ] Pin a compatible undici dependency/lockfile in development. Implement exact
  interface above; adapt dispatcher init without weakening strict TypeScript.
  Wire transport once into existing SearchfloorClient; close it after cancellation
  within existing shutdown deadline. Sanitize errors rather than log causes/URLs.
- [ ] Run the same targeted tests GREEN, then
  `node node_modules/tsc/bin/tsc --noEmit`; commit Task1 owned files.

## Task2: Proxy streaming and source limits

**Modify:** tests/client.test.ts, tests/download.test.ts, helper from Task1;
implementation only for defects against approved requirements.
**Consumes:** Task1 SourceFetch and loopback CONNECT fixture;
existing SearchfloorClient/list/getBook/openDownload and Downloads.streamBook.

- [ ] Add proxy-backed tests: forbidden redirect rejected before another origin;
 403 has exactly one upstream request/no agent replacement; Retry-After60s
 establishes full cooldown;2MiB cap/15s deadline remain enforced.
- [ ] Add real proxy-stream tests: ZIP prefix replay byte-for-byte,20MiB cap,
 slow consumer doesn't consume full upstream early, cancellation closes tunnel,
 slot becomes available, shutdown aborts remaining transfer. Use synthetic ZIP
 bytes and local mocks; tests can shorten injected clocks/timeouts appropriately.
- [ ] Run `node node_modules/vitest/vitest.mjs run tests/transport.test.ts tests/client.test.ts tests/download.test.ts tests/runtime.test.ts`;
 record actual new boundary results. Already-passing integration tests need no
 implementation change. If a boundary fails, preserve that RED before fixing it.
 Do not duplicate existing unit checks merely to increase count.
- [ ] Fix only demonstrated transport/boundary defects; same targeted command GREEN.
 Run test/typecheck/build and Linux native-load CI after changes; commit Task2.

## Task3: Durable existing-installation verification and operator files

**Modify:** deploy/prototype.env.example, deploy/runtime.env.example, deploy/README.md.
**Create:** scripts/verify-existing-prototype.py, tests/prototype_resume_test.py.
**Selectively import/review from cffb346:** scripts/diagnostics/record-jsonl.py,
its regression coverage, curl CONNECT diagnostic fix/coverage. Do not cherry-pick
unreviewed installer/spec or copy its historical Basic/secret output into reports.

- [ ] Review selected changes against root spec; run their offline tests in WSL/Linux.
 If installer safety tests run as root, do not count root-guard rejection as proof
 of later collision guards. Keep installer separate; existing validation won't use it.
- [ ] Add resume verifier tests: existing installed SHA/config accepted; wrong SHA,
401/MIME/XML/live503 fails with earlier rows retained; fixture secrets/query text
absent from stdout/argv; zero bootstrap, env writes, pointer switches or unit changes.
- [ ] Run `python3 -m unittest discover -s tests -p '*resume_test.py'` RED;
implement verify-existing-prototype.py and reviewed recorder pipeline. Credentials
remain in OPDS root-only env, read in memory; normal-user recorder receives only
sanitized rows. Live source checks require explicit --live; no book download here.
- [ ] Add optional proxy entry to separate OPDS env examples with a clearly fake
placeholder; document private operator input, unchanged Basic credentials,
provider usage scope/cycle baseline and session limits for60s transfer.
- [ ] Run resume/selected recorder/curl tests GREEN plus shell/Python syntax checks;
commit reviewed Task3 changes. No new sudoers privilege or infrastructure auto-update.

## Task4: Exact-SHA artifact and private prototype acceptance

**Modify/create operator evidence:** docs/prototype-report.md,
docs/fbreader-acceptance.md, docs/runtime-measurements.md,
docs/codex-cli-proxy-prototype-update.md (concrete operator procedure).
**Consumes:** Task1/2 tested source transport, Task3 verifier/recorder,
existing safe artifact extraction/manifest checks and manual prototype unit.

- [ ] Push implementation; require successful test/typecheck/build/package on exact
SHA. Record workflow/run/artifact/digests; package includes Linux native dependencies.
- [ ] Prepare concrete operator procedure before host action: verify bot/units/port,
new artifact/source identities; preserve old immutable code and pointer, use fresh
immutable SHA directory, privately add OPDS proxy config without replacing Basic
credentials. Document rollback pointer/config, stopping prototype on any failure.
No installer --apply, production current/state, timer or bot resource changes.
- [ ] Before activation, verify dedicated OPDS credentials with one bounded source
GET; record sanitized status/parser counts, provider scope/cycle/remaining budget.
Earlier bot-proxy diagnostic success is not proof for this new sub-user.
- [ ] Operator reviews the prepared files and activates only manual prototype from
new reviewed exact-SHA artifact. Run verifier with expected SHA and --live:
health/local+HTTPS Basic/static XML, one completed/search page, <=one next page.
- [ ] Test <=one completed Download: ZIP/FB2 validated in memory,20MiB/60s bounds,
cancellation; record durable per-request status/bytes, never book contents.
Measure runtime RSS/CPU/cache+WAL and provider before/after usage (billing authority).
- [ ] Owner tests FBReader Android3.8.31 Basic acquisition/ZIP open/pagination and
protected empty-page fixture under existing acceptance plan. Record real results.
Stop manual prototype after testing; production/timer remain off for later gates.

## Handoff and self-review

Spec approved; owner plan review is the remaining pre-code gate. Preserve inline
sequential execution in current folder/feat branch. No new worktree or server move.

Coverage: Task1 implements ARCH-001/CONFIG-001 and bounded OPS-001 lifecycle;
Task2 verifies SOURCE-002/DOWNLOAD-001/002; Task3 implements ACCEPT-001 durable
operator evidence and OPS-002 config separation; Task4 establishes DEPLOY/ACCEPT
and SOURCE-003 provider budget evidence. AUTH/OPDS public contract unchanged.

The plan adds no browser, provider API, monthly counter, new source or public route.
No claim of installed proxy integration until Task4 evidence exists. Changes in
server cffb346 not selected above remain preserved for separate review.
