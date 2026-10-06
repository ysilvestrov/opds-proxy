# Signed book-card access implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (owner's existing native execution choice) or superpowers:subagent-driven-development if the owner changes that choice. Steps use checkbox syntax for tracking.

**Goal:** Make FBReader card/description/cover requests work with scoped signed
URLs until the password changes, including ordinary cache-miss fetching.

**Architecture:** Pure password-derived HMAC signer plus exact-path request
authorizer, used as an additional check by existing Basic middleware. Full-entry
rendering receives signed self/image hrefs; listing and acquisition stay as they
are. Authorized requests reuse Catalog unchanged, including all cache/source caps.

**Tech stack:** Existing Node24.19, TypeScript, node:crypto, Hono, Cheerio,
Pino, SQLite and Vitest; no new dependency, env secret, session or unit.

**Spec:** root spec.md v0.6.0, approved by owner after9c619ff; AUTH-003,
AUTH-001/002, OPDS-005, SOURCE-001/002/003/004, CACHE-001/002/003,
OPS-001, DEPLOY-001, ARCH-001 and ACCEPT-001. Owner approved the plan; native implementation and independent review complete.

## Global constraints

- Signature scope: exact GET/HEAD entry or cover for searchfloor and positive
  numeric ID matching `[1-9][0-9]{0,19}`. No root/search/list/Download grant.
- Password-derived HMAC key with purpose `opds-book-card-key-v1`; sign UTF-8
  JSON.stringify([1,"book-card",source,id]); one canonical43-character `sig`.
- No expiry. Restart/cache reset/username-only change preserves grants; password
  change invalidates them. Restoring an old password restores its old signatures.
- Grant-only misses use the existing bounded Catalog flow, not a second cache or
  queue. Metadata TTL24h; known-absence TTL15min; Download confirmation15min;
  source concurrency1/spacing1s/queue20/wait30s; cover2MiB/15s. All existing
  retry/cooldown/proxy/provider budgets remain authoritative and unchanged.
- Source-only dedicated OPDS proxy; no fallback/rotation/challenge bypass/crawl.
- No password, grant, raw URL/query/header/body or arbitrary exception in logs,
  Git or receipts. Resource cache contains no signed serialized responses.
- Work in the current checkout on a codex/ branch, as already selected; preserve
  user untracked files. No bot, global journal, Cloudflare or bootstrap changes.
- Normal reviewed main exact-SHA artifact/timer release; installed state requires
  actual server evidence. HTTP200 alone does not prove FBReader display.

## File map and review focus

- Create src/api/card-grant.ts: pure signing, validation and request scope.
- Modify src/api/auth.ts: optional additional authorizer after Basic fails.
- Modify src/api/app.ts: wire signer/authorizer; signed entry links and referrer header.
- Modify src/opds/feed.ts: accept explicit self/image hrefs in full-entry rendering.
- Create tests/card-grant.test.ts and tests/signed-card.test.ts; update
  tests/auth.test.ts, tests/metadata-api.test.ts and tests/access-log.test.ts as needed.
- Create scripts/diagnostics/signed-card.mjs, tests/signed-card-diagnostics.test.ts
  and docs/signed-card-acceptance.md; update existing acceptance/backlog/spec status.
- Catalog/source/cache/deploy runtime modules require no product changes.

Review focus (tests assigned below):
1. Noncanonical base64url pad bits can decode to the same bytes: reject them (Task1).
2. Encoded/duplicate query keys, escaped path components, prefix/suffix routes or
   non-GET methods cannot expand scope (Task1/2).
3. Invalid Basic plus valid grant succeeds; valid Basic plus bad grant keeps Basic
   behavior; absent/bad both yields401 before Catalog (Task2).
4. Cold/evicted state under a valid grant still loads one book; metadata fetch
   cannot extend Download eligibility or hydrate listings (Task2).
5. Rotation/rollback, error paths and operator receipt generation cannot leak
   tokens or claim image delivery from handler200 (Task1/2/3).

## Task 1: Stateless grant and exact resource scope

**Files:** src/api/card-grant.ts (new), tests/card-grant.test.ts (new).

**Interfaces:** export interface BookCardSigner with sign(source:string,id:string):string
and verify(source:string,id:string,signature:string):boolean. Export
createBookCardSigner(password:string):BookCardSigner and
isSignedBookCardRequest(request:Request,signer:BookCardSigner):boolean.
Signer exposes no key/password. sign rejects invalid source/ID with fixed error;
verify/authorizer return false for malformed input rather than arbitrary errors.

- [x] Write failing tests with synthetic password and independently computed
  expected HMAC: key=createHmac('sha256',password).update('opds-book-card-key-v1').digest();
  message=JSON.stringify([1,'book-card','searchfloor','27223']); output base64url.
  Assert43 characters, same value across signer instances and time changes,
  changed password rejects, restored password accepts, different source/ID rejects.

  ```ts
  const signer = createBookCardSigner('fixture-password');
  const sig = signer.sign('searchfloor', '27223');
  expect(sig).toBe(expectedHmacFromIndependentNodeCrypto);
  expect(sig).toHaveLength(43);
  expect(signer.verify('searchfloor', '27223', sig)).toBe(true);
  expect(createBookCardSigner('changed').verify('searchfloor', '27223', sig)).toBe(false);
  ```
- [x] Test empty/oversized/padded/non-base64 signatures and an alternate final
  base64url character with unchanged decoded bytes. Assert reject despite
  Buffer equality for that alternate; test leading-zero/zero/21-digit IDs.
- [x] Test request matrix: entry/cover GET/HEAD accepted, download/root/list/search,
  authors/genres, other sources/IDs, suffix/trailing slash, encoded `%31` ID,
  POST and duplicate `sig` (including `%73ig`) rejected. No token returns false.
- [x] Run `node node_modules/vitest/vitest.mjs run tests/card-grant.test.ts`;
  observe RED for missing module/behavior.
- [x] Implement interfaces with node:crypto. Verify43-character alphabet, decoded
  length32 and exact base64url re-encoding before timingSafeEqual. Parse URL once,
  use literal pathname exact regex and searchParams.getAll('sig').length===1;
  do not echo parser errors. Do not use input origin/Referer/UA for authorization.
- [x] Run focused tests plus `node node_modules/typescript/bin/tsc --noEmit`;
  require GREEN/exit0. Commit `feat: sign password-revoked book-card grants`.

## Task 2: Authorization, signed Atom links and cache-miss integration

**Files:** src/api/auth.ts, src/api/app.ts, src/opds/feed.ts;
tests/auth.test.ts, tests/metadata-api.test.ts, tests/access-log.test.ts;
tests/signed-card.test.ts (new).

**Interfaces:** extend privateAuth(username:string,password:string,
allowAdditional?:(request:Request)=>boolean):MiddlewareHandler. Existing callers
without the third argument retain current behavior. createApp constructs one
signer from OPDS_PASSWORD and passes the request authorizer to both auth mounts.
Extend renderBookEntry(book,details,baseUrl,stale,links?:{self:string;cover:string}):string;
legacy pure renderer callers may omit links, but production always supplies
signed URLs for canonical source books. Signed link construction lives in app,
not domain data/cache; renderer remains pure XML escaping.

- [x] Write failing HTTP tests: unsigned401; Basic entry200; extract self/image/
  thumbnail URLs from XML with Cheerio; same `sig`, same source/ID, no password
  or expiry. Follow signed entry/cover without Authorization and expect200;
  verify summary and actual image MIME/bytes, HEAD200, no challenge on success.

  ```ts
  // href comes from the Basic-authorized entry's XML, never a public test token.
  expect((await app.request(signedCoverHref)).status).toBe(200);
  expect((await app.request(signedEntryHref)).status).toBe(200);
  expect((await app.request('/opds/searchfloor/search?q=x&sig=' + sig)).status).toBe(401);
  expect((await app.request('/opds/searchfloor/books/27223/download.fb2.zip?sig=' + sig)).status).toBe(401);
  ```
- [x] Assert root/start/list/search/OpenSearch/Download cannot be accessed using
  this token alone; no unauthorized Catalog/download call. Valid Basic with bad
  token remains accepted. Invalid/malformed Basic with valid token is accepted
  only on exact allowed route; invalid both401 with unchanged challenge.
- [x] Assert POST, duplicate query, wrong-source/wrong-book token, encoded path,
  overlong/zero-padded ID and tampered token reject before dependency calls.
  Existing Basic invalid-id/unknown-source behavior is preserved.
- [x] Write local integration with real Catalog and Cache(':memory:') plus
  counting source mock: signed cold entry invokes normal getCard/annotation/cover,
  warm repeat does not refetch; new empty Cache with same password still accepts
  old token and refills one book. No extra listing hydration. Advance controllable
  clock beyond24h to prove token remains valid while expired resources refresh.
  Reuse existing Download freshness regression and assert token does not authorize
  its route or change eligibility. Close each test cache in finally.
- [x] Test unknown/incomplete404 and source-error503/502/no-leaked-message with a
  valid token; preserve optional/stale behavior. New app with changed password
  rejects old token; username-only change accepts it; original password restores
  it. Test actual emitted access/warn output lacks token, Basic, query and body.
- [x] Assert full entry private,no-store and Referrer-Policy:no-referrer; covers
  retain private cache/nosniff headers. Self/image hrefs use PUBLIC_BASE_URL;
  acquisition/start/HTML alternate remain unsigned; listing alternate remains
  unsigned and listing has no image links/details/source hydration.
- [x] Run focused tests and observe RED, then implement optional authorization
  fallback only when existing constant-time Basic check fails. Keep accessLog
  first, source guard next, and unchanged Catalog calls. No public cover bypass.
- [x] Supply signed self/cover links from app using `?sig=` plus canonical signer
  output; renderer escapes the full href. Add referrer header only to full entry.
  Unsupported noncanonical returned Book IDs must not gain grant permission;
  retain Basic-only legacy rendering for those instead of issuing an invalid grant.
- [x] Run `node node_modules/vitest/vitest.mjs run tests/card-grant.test.ts tests/auth.test.ts tests/signed-card.test.ts tests/metadata-api.test.ts tests/access-log.test.ts tests/details.test.ts tests/download.test.ts`
  and typecheck; require all PASS. Commit `feat: authorize signed card resources and artwork`.

## Task 3: Bounded operator probe, whole-change review and device gate

**Files:** scripts/diagnostics/signed-card.mjs (new),
tests/signed-card-diagnostics.test.ts (new), docs/signed-card-acceptance.md (new),
docs/metadata-acceptance.md, docs/backlog.md and spec.md status.

**Interfaces:** probe export diagnoseSignedCard({fetch,parseEntry,username,password,
publicBaseUrl,ids,emit,signal}):Promise<void>; injected fetch and XML parser allow
offline tests. Main loads root-only OPDS env through Node --env-file and XML parser
from the actual installed release dependencies (createRequire at installed
package.json); validates config with installed dist/config.js. No direct source
client/proxy calls; URLs/auth stay in memory. Fixed IDs27223/27505, <=2 IDs.

- [x] Write probe tests: mock authenticated entry supplies signed self/image;
  next GETs omit Authorization. Emit only fixed ID/stage/status/allowlisted MIME/
  elapsedMs/byte count/summary or link presence, never token/URL/header/XML/body
  or exception. Failed/no image is reported honestly, not synthesized.
- [x] Test malicious XML link host/path/source/ID, redirect, fake token in
  exception/body, stalled body and oversized response. Reject unexpected links
  before follow: exact configured HTTPS origin/entry or cover for current ID,
  one canonical sig, no userinfo/hash. No attacker-directed requests. No book URL.
- [x] Run new tests RED; implement <=240s total,65s per-request,2MiB body limit,
  manual redirect policy and cancellation including stalled read. Per ID only
  Basic entry, signed entry and signed cover; do not run the former direct-source
  diagnostic matrix. Optional one bounded tamper401 check stays outside the phone
  window. Probe status200 is not image display acceptance. Run GREEN and syntax check.
- [x] Write concrete operator commands to fetch/extract the probe from Git and
  run `sudo /usr/bin/node --env-file=/etc/searchfloor-opds/runtime.env <probe>`.
  Paths contain no secret; private root workspace/receipt review; no bot env.
  Record expected SHA/health, OPDS/bot PID/restarts before/after; timer/env/unit
  unchanged. No installed-code claim from merely preparing the probe.
- [x] Run build, typecheck, full Vitest and existing WSL Python suite; require
  exit0 and no failures. Tests stay offline. Request one independent read-only
  whole-change review of AUTH-003 boundary/privacy/cache integration; fix blockers
  and rerun affected tests. No per-task implementation agents unless owner changes
  native execution selection. Commit `test: verify signed card access and reader handoff`.
- [x] Create/attach PR with requirement IDs. Require green exact-head Linux
  test/typecheck/build; merge through existing approved release workflow and
  require exact-main native package artifact success before claiming releasable.
- [ ] Verify actual deployed SHA via existing health and operator source/private
  HTTP receipts. No new secret, schema, bootstrap, unit, Cloudflare or global
  journal settings. If rollout fails, existing rollback applies; returning to
  Basic-only runtime reintroduces the known cover401 behavior, not an auth bypass.
- [ ] Coordinate a fresh phone window after probes stop: owner reopens27223/27505,
  confirms description/artwork, repeat and restart. Existing journal helper emits
  sanitized entry/cover access events, not query. Old unsigned phone-cached links
  may still401; reopen the authenticated entry to obtain current signed links,
  never clear all phone data or expose a public route. Record actual owner actions.
- [ ] Close cover auth/device acceptance only after both cover200 and owner-visible
  artwork. Keep other META-01 edge tests unverified unless observed. Test password
  rotation/restart/rollback offline; do not rotate production password just for
  diagnostics. Preserve resource traffic deltas as measured, not guessed billing.

## Self-review and execution handoff

Coverage: AUTH-003 signing/scope/rotation ->Task1/2; AUTH-001/002 invariants ->Task2;
OPDS-005 links/description/headers ->Task2; CACHE/SOURCE reuse ->Task2 integration;
OPS-001 privacy ->Task2/3; DEPLOY-001/ARCH-001/ACCEPT-001 ->Task3. All five review
focus cases have explicit test owners. No secret/config/database migration.

Ruling: preserve Basic behavior for noncanonical legacy IDs, but issue grants
only for canonical spec IDs; a grant can never authorize a noncanonical path.
This prevents the new signer from breaking a previously valid Basic-only response.
If source fixtures show canonicalization differs, reconcile it with root spec
before implementation rather than silently widening signed scope.

Owner has approved written spec9c619ff. Owner approved this plan before code. Existing current-folder/native execution choice remains in effect; do not
ask again to create a worktree or choose implementers.

Execution evidence: commits636103f/536d772; final local validation111 Node passed,2 Windows skips,57 WSL Python passed, typecheck/build/syntax/diff checks passed. Read-only reviewer findings on mandatory global deadline and malicious-link test reachability resolved with regression evidence. Release/operator/device gates below remain open.
