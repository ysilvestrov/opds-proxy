# Related author and series links implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the owner's preserved native execution choice. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open completed author/series books from a book's Related links inside
FBReader Android3.8.31, using bounded server-side Searchfloor access.

**Architecture:** Parse verified source references from ordinary book HTML and
render Basic-protected related acquisition links on full entries. Fetch one
compact author/series document through the existing source transport, parse
completed rows, and cache a snapshot independently of Book/details/artwork.
Slice snapshots locally into20-book acquisition pages, without per-book fetching.

**Tech Stack:** Existing Node24.19/TypeScript strict, Cheerio, Hono, SQLite,
Vitest, Pino; no new dependencies or infrastructure.

**Spec:** Root spec.md0.8.0, owner approved afterad101ee2026-10-07;
OPDS-007/SOURCE-005 plus SPEC-001, ARCH-001, SOURCE-001/002/003,
OPDS-001/002/003/004/005/006, AUTH-001/003, CACHE-001/002/003,
DOWNLOAD-001/002, OPS-001, DEPLOY-001 and ACCEPT-001.
This plan awaits owner review; no product implementation is authorized by
the existence of the plan alone. Native execution/current checkout/no worktree
already selected; preserve those choices rather than asking again.

## Global Constraints

- V1 only searchfloor; routes `/opds/{name}/authors/{authorKey}` and
  `/opds/{name}/series/{seriesKey}`; no global author/series/genre indexes.
- Keys canonical unpadded base64url UTF-8 JSON: `[1,"author",slug]` or
  `[1,"series",seriesName,authorSelector]`; strings trimmed NFC, nonempty,
  at most200 Unicode code points, no control characters; key at most4096 ASCII
  characters. Require byte-for-byte re-encoding of JSON.stringify(tuple).
- Recognized compact rows: matching numeric `/b/{id}` and `/book/{id}` Download,
  no status badges or exactly one `весь текст`; reject `в процессе`, any other
  badge including empty, duplicates and conflicting same-ID completion.
- Ordinary list/search/full-card parser retains explicit `весь текст`.
- Entity request: one HTML document at most2MiB,15s; concurrency1, spacing1s,
  queue20/wait30s; existing redirects/retry/cooldown/dedicated OPDS proxy.
- Explicit unsupported upstream pagination/load-more or unknown layout is502;
  valid recognized empty results are distinct from malformed/error pages.
- Snapshot TTL15min, stale at most24h;20 books per local page; page1..10000.
  Preserve source order and accept composition changes across snapshot refresh.
- Related snapshots do not overwrite Book/details/cover or refresh completion.
  Existing lookup/Download15min completion guard and resource TTLs remain.
- AUTH-003 scope unchanged; related feeds Basic-only, no sig in related URLs.
  Logs contain route classes/status/timing, not entity keys/names/query/headers.
- Current checkout codex/related-links-spec; preserve owner untracked artifacts.
  Fixtures/mocks for tests, only bounded public source discovery for fixtures;
  no books/secrets/raw authentication/signatures committed, no live test crawl.
- No env/dependency/DB schema/unit/bot/Cloudflare changes, warmup/cache flush.
- Final fresh-context read-only reviewer; exact-head CI and exact-main native
  artifact gate normal timer deployment; actual reader acceptance is separate.

## Review Focus

1. Nested/coauthor sections must not borrow Download/status/metadata (Task2).
2. Same-name series and non-ASCII selectors need stable distinct identity (Task1/4).
3. A changed layout or added pagination must not silently truncate books (Task2/3).
4. Snapshot refresh and errors must not replace richer cache or extend Download
   eligibility; concurrent reads must share one upstream operation (Task3).
5. FBReader may handle related Atom links differently from valid XML; pin link
   type/title/auth in tests, then collect phone results (Task4/5).

## File map

- Create src/domain/related.ts: RelatedTarget/RelatedSnapshot and pure key codec.
- Modify src/domain/book.ts: optional seriesRef; existing authorRefs reused.
- Create src/sources/searchfloor/references.ts: scoped source-reference extraction.
- Modify src/sources/searchfloor/parse.ts: populate verified refs without extra I/O.
- Create src/sources/searchfloor/related.ts: pure recognized compact parser.
- Modify src/sources/searchfloor/client.ts: listRelated through existing bounded run.
- Modify src/catalog.ts: independent related snapshot cache/coalescing/local slicing.
- Modify src/opds/feed.ts: related links plus shared related acquisition rendering.
- Modify src/api/app.ts and src/api/access-log.ts: routes/validation/safe route classes.
- Create tests/related-keys.test.ts, tests/related-parse.test.ts,
  tests/related-client.test.ts, tests/related-catalog.test.ts,
  tests/related-feed.test.ts and tests/related-api.test.ts.
- Modify tests/access-log.test.ts and add sanitized author/series HTML fixtures.
- Create docs/related-links-acceptance.md; update spec/backlog/source evidence/plan.

## Task1: Stable targets, reference parsing and keys

**Interfaces:** src/domain/related.ts exports:
`RelatedTarget = {kind:'author';slug:string} | {kind:'series';name:string;authors:string}`;
`RelatedSnapshot = {books:Book[];observedAt:string}`;
`encodeRelatedKey(target:RelatedTarget):string` (throws on invalid target);
`decodeRelatedKey(key:string,kind:RelatedTarget['kind']):RelatedTarget|null`.
Book adds optional `seriesRef:{name:string;authors:string}`.
src/sources/searchfloor/references.ts exports
`parseReferences(html:string,bookId:string):Pick<Book,'authorRefs'|'seriesRef'>`;
it scopes to the exact ordinary book container, excluding nested book containers.

- [ ] Write key tests: Cyrillic tuple round-trip; same series/different authors
  distinct keys; wrong kind/version/shape, invalid UTF-8/base64, padding, alternate
  JSON whitespace, non-NFC/controls,201 code points and4097-char key rejected.
- [ ] Write refs tests using book27047 and small cards: author Алексей Котов,
  series Асмодей+selector; dedup refs, two coauthors, foreign origin/query/hash,
  malformed percent encoding, duplicate authors parameter, ambiguous series,
  nested second-book refs; legacy fields remain optional.
- [ ] Run `node node_modules/vitest/vitest.mjs run tests/related-keys.test.ts tests/related-parse.test.ts`;
  record RED for missing public interfaces/fields, not tool/environment errors.
- [ ] Implement codec, optional type and scoped extraction. Integrate once into
  parseObservedPage's per-card path; no source calls or wholesale parser rewrite.
- [ ] Run the above plus tests/parse.test.ts and tests/genre-volume-parse.test.ts;
  expect all passing and unchanged strict completion/genre/volume behavior.
- [ ] Commit exact Task1 product/tests files: `feat: parse author and series references`.

## Task2: Compact author/series parser and source fixtures

**Interfaces:** src/sources/searchfloor/related.ts exports
`parseRelatedPage(html:string,target:RelatedTarget,observedAt:string):RelatedSnapshot`;
throws existing ParseError for unknown layout/unsupported pagination.
Uses Book output with sourceName searchfloor, numeric id, verified row title,
authors/series from verified context, sourceUrl/downloadPath, complete/observedAt;
missing optional metadata stays absent. No network or global time reads.

- [ ] Obtain and sanitize one known author and one known series HTML with bounded
  normal GETs using the existing caps/timeouts; retain row/section markup, remove
  scripts/styles/tracking/user controls. Record actual author/standalone/series
  selectors and provenance in docs/related-links-source-evidence.md; no invented
  source markup as the sole contract fixture. If layout exceeds approved bounds,
  stop that implementation and revise written spec before broadening it.
- [ ] Write fixture tests:27047 accepted,27484 ongoing rejected, valid author
  rows across series/standalone sections retain source order; coauthor contexts
  and optional volume isolation. Add synthetic recognized-row modifications for
  ongoing+Download, absent status/no Download, empty/unknown/duplicate badges,
  foreign/mismatched href/Download ID, nested rows, conflicting duplicate IDs,
  all-rejected valid empty, explicit pagination and unknown/challenge HTML.
- [ ] Run `node node_modules/vitest/vitest.mjs run tests/related-parse.test.ts`;
  record RED for compact parser assertions.
- [ ] Implement isolated row parsing against observed selectors; reject unknown
  structure before using absence-of-status completion, dedup conflicting IDs
  conservatively, reuse pure optional field helpers when doing so preserves
  existing OPDS-006 behavior. Never call getBook per row.
- [ ] Run related-parse plus existing parse/genre-volume tests; expect GREEN,
  including ordinary pages still requiring explicit `весь текст`.
- [ ] Commit exact Task2 files/fixtures/evidence: `feat: parse compact related book lists`.

## Task3: Bounded transport, isolated snapshots and local pages

**Interfaces:** SearchfloorClient adds
`listRelated(target:RelatedTarget,signal?:AbortSignal):Promise<RelatedSnapshot>`;
Catalog Client dependency adds optional matching listRelated method;
Catalog adds `related(target:RelatedTarget,page:number,signal?:AbortSignal):Promise<CatalogPage>`.
It uses an independently versioned entity cache key, no Book/resource writes,
and calculates nextPage from snapshot length with20-book slices.

- [ ] Write mocked transport tests asserting one fixed encoded `/a/...` or
  `/s/...?authors=...` request (two different authors selectors stay separate),
  no per-ID lookups;200 parse, unexpected404/nonempty404 rejection, recognized
  empty404 handling,2MiB limit, timeout, foreign redirect and unsupported pagination.
  Reuse existing transport fixtures for request caps and queue/cooldown coverage.
- [ ] Write real in-memory Cache/counting-client tests:21 books gives20+1 with
  one source call across page1/2;40 gives next only on first page;0/all-rejected
  and out-of-range empty; concurrent calls share one operation; one caller abort
  does not cancel another; refresh after15min; stale <=24h only; errors not empty.
  Seed rich Book/details/cover records and assert values/observedAt unchanged;
  call existing Catalog.book after expired completion and assert getBook occurs.
- [ ] Run `node node_modules/vitest/vitest.mjs run tests/related-client.test.ts tests/related-catalog.test.ts`;
  record RED for new methods and behavioral assertions.
- [ ] Implement listRelated using existing request/run/readLimited and typed
  validated paths; implement snapshot cache/shared reads/local slices in Catalog.
  Do not cache rendered links or alter existing ordinary page/book paths.
- [ ] Run new tests plus tests/client.test.ts, tests/catalog.test.ts,
  tests/details.test.ts and tests/cache.test.ts; expect GREEN with prior guards intact.
- [ ] Commit exact Task3 files: `feat: cache bounded author and series snapshots`.

## Task4: OPDS rendering, Basic-only routes and sanitized logs

**Interfaces:** feed.ts exports
`renderRelatedFeed(data:CatalogPage,target:RelatedTarget,baseUrl:string,page:number):string`;
renderBookEntry signature unchanged; it derives related URLs from valid optional
refs using Task1 codec. Share acquisition entry rendering internally with renderFeed,
preserving current ordinary feed output. createApp's Catalog dependency additionally
supports optional related; absent capability returns404 for valid related routes.

- [ ] Write XML tests asserting related rel/title/acquisition MIME and absolute
  PUBLIC_BASE_URL href, no sig, two authors and series link, escaped labels;
  no refs yields no invented links. Assert entity/page-specific feed IDs/title,
  self/start/up, next only when present and same target key; entry urn/card/
  acquisition unchanged, no covers/hydration added to lists, synopsis then volume.
- [ ] Write Hono tests: Basic success; no Basic or only card sig gives401 and
  zero related calls; wrong source404; invalid kind/key/page400 with zero source
  calls; unsupported optional capability404; route errors preserve source status.
  Existing Basic or signed book-card/cover paths remain valid; Download Basic-only.
- [ ] Add access-log tests: author_feed/series_feed route classes; generated keys,
  names, query, Authorization and sig absent from serialized log output.
- [ ] Run `node node_modules/vitest/vitest.mjs run tests/related-feed.test.ts tests/related-api.test.ts tests/access-log.test.ts`;
  record RED for missing renderer/routes/classification.
- [ ] Implement routes with validated keys/page before Catalog; shared feed rendering
  and full-entry related links; classify entity paths without retaining raw keys.
- [ ] Run new tests plus tests/feed.test.ts, tests/app.test.ts,
  tests/signed-card.test.ts and tests/genre-volume-api.test.ts; expect GREEN.
- [ ] Commit exact Task4 files: `feat: expose private related OPDS navigation`.

## Task5: Branch validation, review, normal deployment and reader acceptance

**Interfaces:** docs/related-links-acceptance.md records separate fixture/CI,
installed SHA, source availability and owner reader results; no fabricated gates.

- [ ] Prepare owner acceptance checklist: reopen/refreshed book with refs; verify
  Related link titles and open author/series without browser; page2; completed-only
  known mixed series; ordinary card/annotation/volume-after-annotation/cover/Download.
  Record cache-fresh legacy book may lack links until its normal refresh; do not
  force production cache flush or source warmup. Cold source failure remains explicit.
- [ ] Run full `node node_modules/vitest/vitest.mjs run`,
  `node node_modules/typescript/bin/tsc --noEmit`, and
  `node node_modules/typescript/bin/tsc -p tsconfig.build.json`; record actual
  pass/fail/skip counts. Use bundled Node executable if PATH lacks node/npm;
  environment/approval failures are not RED product tests. Existing Python
  deployment regression suite runs in WSL or Linux CI, not mocked as passed.
- [ ] Run git diff --check; self-check coverage against requirements and the five
  Review Focus conditions. Update spec/backlog/plan with verified implementation
  status while retaining unobserved source/device gates.
- [ ] Request one fresh-context read-only whole-branch reviewer per preserved
  native workflow, covering requirement IDs, parser isolation, request counts,
  key/auth boundaries, cache guards and prior book flow. Resolve actionable
  findings with regression tests and repeat affected checks only.
- [ ] Push branch, create/attach PR with spec IDs and actual checks; require green
  exact-head CI, merge through normal repository flow. Await exact-main native
  artifact and enabled deploy timer; confirm public health installed exact SHA.
  Do not change server/bot/Cloudflare/timer config for this feature.
- [ ] Collect owner's FBReader outcomes; if links do not display/open despite
  valid XML, gather reader/server evidence before revising rel/type/auth mapping.
  Keep incomplete edge gates open. Commit/push release and acceptance evidence.

## Plan self-review

Coverage: Task1 owns keys/refs/identity; Task2 owns SOURCE-005 completion/layout;
Task3 owns transport/cache/page limits and isolation; Task4 owns OPDS/API/auth/logs;
Task5 owns exact-release and phone acceptance. Existing ordinary source/download,
signed-card, metadata and cache regression tests cover preserved requirements.
The new names/signatures match across tasks. Review Focus inputs each have tests
assigned above. Fixture discovery and actual author selectors precede compact
parser implementation; reader mapping and production availability remain evidence
gates, not conclusions inferred from fixtures. No competing normative spec exists.

**Execution handoff:** Await owner plan review, then continue native implementation
in this checkout with the existing separate branch; no execution-method question.
