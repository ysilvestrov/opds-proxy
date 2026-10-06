# Genres and text volume implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the owner's preserved native execution choice. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Show genres and source-reported work length in FBReader, with compact
character counts such as10.5К знаків, so the owner can judge how long a work is.

**Architecture:** Extend optional Book JSON metadata in the existing HTML parser.
Render genre categories in list/full entries and a volume line in full-entry
summary/content. Reuse the existing Catalog/cache/auth/source flow unchanged.

**Tech Stack:** Existing Node24.19, TypeScript, Cheerio, Hono, SQLite and Vitest;
no new dependency or infrastructure.

**Spec:** Root spec.md proposed0.7.0, OPDS-006 approved by owner aftera979a83;
also OPDS-001/004/005, SOURCE-001/002/003/004, CACHE-001/002/003,
AUTH-001/003, OPS-001, DEPLOY-001, ARCH-001 and ACCEPT-001.
Spec is normative; owner approved this plan afterbee8baa before product code.

## Global constraints

- Source v1 only searchfloor; existing `/opds/{name}/...` namespace unchanged.
- Genres come from same-origin `/popular?include_genres={id}` links inside one
  book card. No genre discovery links/routes; OPDS-004 remains reserved.
- characterCount is a positive safe integer; authorSheets is positive finite,
  source decimal with at most2 fractional digits. Never derive one from another.
- Display characters as decimal thousands, fixed1 fractional digit, decimal
  point, CyrillicК:10500 ->10.5К;10000 ->10.0К;511195 ->511.2К.
- Preserve exact integer in model/cache. Below1000 uses the same display rule.
- Full entry plain-text summary/content contains volume after existing synopsis;
  stale notice remains explicit. No invented synopsis, pages, ZIP length or labels
  such as novel/short story; no extra source requests or listing hydration.
- Existing list15min/book24h/detail24h/known absence15min cache behavior and
  Download completion15min remain unchanged. No SQLite schema bump/rebuild.
- Existing source concurrency1/spacing1s/queue20/wait30s, retries/cooldown and
  dedicated OPDS proxy remain authoritative. No live mass crawl/source fallback.
- All tests use local fixtures/mocks. No source credentials, books, signatures or
  raw requests in Git/receipts. No bot/env/unit/Cloudflare/provider changes.
- Continue current checkout on codex/genre-text-volume, no worktree; preserve
  user untracked files. Native implementer plus one final read-only reviewer.
- Green exact-head Linux CI then green exact-main native artifact for normal
  timer release; reader display needs owner evidence, not just valid XML.

## File map

- Modify src/domain/book.ts: optional characterCount?:number, authorSheets?:number;
  existing genres?:EntityRef[] reused, no new details/resource model.
- Modify src/sources/searchfloor/parse.ts: parse optional fields inside its
  existing per-card loop. Public parsePage/parseObservedPage signatures unchanged.
- Create tests/genre-volume-parse.test.ts: fixtures and small synthetic cards.
- Create src/opds/text-volume.ts and tests/text-volume.test.ts: pure formatting.
- Modify src/opds/feed.ts: shared genre categories and full-entry volume prose.
- Create tests/genre-volume-api.test.ts: real Catalog/Cache plus counting mocks.
- Modify tests/feed.test.ts for renderer assertions; existing regression tests
  continue to cover signed access, completion, source caps and old behavior.
- Create docs/genre-volume-acceptance.md; update spec.md/backlog/plan status.
- No product change expected in Catalog, source client, auth or cache modules.

## Review focus

1. Bad/duplicate badges must not turn optional metadata into parser failure (Task1).
2. Foreign/multi-ID genres or fields from another card must not leak across books (Task1).
3. Small values rounding to0.0К are known values; .05 ties round upward (Task2).
4. Fresh legacy cache must not trigger enrichment-only source calls (Task3).
5. Volume-only entry must remain useful without breaking paragraphs/stale/signed
   cover/acquisition, and list must not gain volume summaries or hydration (Task2/3).

## Task1: Parse optional genres and source volume

**Interfaces:** Book adds characterCount?:number and authorSheets?:number;
genres retains EntityRef[] with source-local id/name. parsePage(html,page,at)
and parseObservedPage(html,page,at) remain unchanged. Private helpers may live
in parse.ts; do not expose a second HTML-fetch/parser workflow.

- [x] Write fixture regression: book27047 yields genres IDs76/28/39 in source
  order, exact names, characterCount511195, authorSheets12.78. Compare the same
  book in completed/fragment HTML; existing complete filter/next links stay valid.
- [x] Add synthetic two-card tests with a complete status and matching Download.
  Assert genre ID deduplication, empty labels ignored; foreign origins, userinfo,
  fragments, duplicate query keys, additional query parameters, multi-ID/non-numeric
  values and unrelated paths ignored. Relative and exact same-origin absolute
  links accepted. Only one include_genres parameter; numeric ID is positive.
- [x] Test badge units and grouping:511195/511 195/511\u00a0195/511\u202f195
  plus exactзн. accepted;12.78/12,78 а.л. accepted. Wrong grouping such as
  51 1195, partial1e6, negative/zero, NaN, Infinity, unsafe9007199254740992,
  unitsKB,3 fractional sheet digits, and missing fields omitted individually.
  More than one badge for a field is ambiguous and omitted; other fields survive.
- [x] Run `node node_modules/vitest/vitest.mjs run tests/genre-volume-parse.test.ts`;
  observe RED for missing fields before product code.
- [x] Extend Book and implement bounded per-card parsing. Anchor entire badge
  text after trim; recognize proper digit grouping and units, not parseFloat prefix.
  Use Number.isSafeInteger/finite positivity. Omit absent properties rather than
  storing zero or fabricated values. Genre collection uses the existing loaded
  Cheerio tree and scoped card.find; malformed URL parsing cannot throw the page.
- [x] Run new parser tests and tests/parse.test.ts; run typecheck. Require GREEN
  and unchanged pagination/completion results. Commit `feat: parse book genres and text volume`.

## Task2: Render compact volume and OPDS genres

**Interfaces:** export formatTextVolume(book:Pick<Book,'characterCount'|'authorSheets'>):
string|undefined from src/opds/text-volume.ts. Existing renderBookEntry/renderFeed
signatures and signed link inputs unchanged.

- [x] Write format tests:10500 ->`Обсяг: 10.5К знаків`;10000 ->10.0К;
  511195 ->511.2К;10549 ->10.5К;10550 ->10.6К;1 ->0.0К;999 ->1.0К.
  Both fields yield`Обсяг: 511.2К знаків · 12,78 авторських аркушів`;
  sheets-only12 ->`Обсяг: 12 авторських аркушів`; absent/invalid fields omitted,
  no NaN/Infinity/undefined or empty volume line. Input integer remains unchanged.
- [x] Add parsed-XML renderer assertions: list and full entry have genres with
  schemeurn:opds:searchfloor:genre, term IDs, XML-escaped labels, series category
  retained. Full summary is original synopsis + blank line + volume; content
  keeps stale notice first, then synopsis/volume. Without synopsis, volume alone
  appears in both. Without volume, exact previous summary/content remains.
  Listing has no synthetic volume summary, image link or genre navigation link.
  Acquisition link has no character-count length attribute.
- [x] Run formatter/feed tests and observe RED.
- [x] Implement pure formatting with defensive numeric validation for optional
  legacy cache data. Round count to nearest100 characters, half upward using
  integer quotient/remainder, then render thousands with fixed1 decimal point;
  do not rely on floating division at .05 ties. Sheets use comma and at most2
  decimals without grouping or invented trailing digits. Join present components
  only; prefix once. Feed renderer XML-escapes the resulting plain text.
- [x] Add genre categories to shared bookMetadata, separate from series. Compose
  synopsis+volume once for full summary/content; retain existing stale placement,
  image/self grants, alternate/start and acquisition behavior. No raw source HTML.
- [x] Run formatter/feed/parser plus tests/metadata-api.test.ts and
  tests/signed-card.test.ts; require GREEN/typecheck. Commit
  `feat: display genres and compact work length in OPDS cards`.

## Task3: Cache compatibility, release and phone acceptance

**Interfaces:** unchanged Catalog/Cache and createApp dependencies; test counting
local clients supply parsed Book and existing annotation/artwork methods.

- [x] Write integration tests with Cache(':memory:') and controlled clock: seed
  fresh legacy Book without new fields, fresh annotation and cover resource records
  using existing key contracts; details returns old data with no metadata-enrichment
  source call. Ordinary expiry/list refresh introduces new fields and preserves
  exact characterCount. Repeated warm reads do not refetch. Close caches in finally.
- [x] Compare two otherwise identical counting mock flows with and without new
  fields: upstream call counts match for list/full card/cover; download-confirmation
  observedAt stays independent. Source lookup for expired completion follows the
  existing rules, not a new refresh mechanism for optional metadata.
- [x] Exercise createApp: Basic full entry and emitted signed entry both include
  identical genre/volume/synopsis; valid signed cover still200, unsigned catalogue
  and signature-only Download still401. Old optional fields absent do not500.
- [x] Run integration RED where new XML is asserted before implementing any needed
  integration fix; if no Catalog change is needed, keep it unchanged and record
  these as compatibility tests rather than artificial RED claims.
- [x] Write docs/genre-volume-acceptance.md: exact-SHA expected release and normal
  timer/health check; owner opens an already known completed book, confirms genre
  tags and compact volume alongside synopsis/cover. Existing cache may lack fields
  until ordinary refresh (up to24h for base metadata); never clear production cache
  or mass-open books solely to force enrichment. No new server diagnostic program.
  Record actual phone result; collect minimal evidence if genres are not visible
  before altering mapping. No assumption that valid categories prove display.
- [x] Run `node node_modules/typescript/bin/tsc -p tsconfig.build.json`,
  `node node_modules/typescript/bin/tsc --noEmit`, full Vitest and
  `wsl -d Ubuntu --exec python3 -m unittest discover -s /mnt/c/Projects/search-floor-opds/tests -p '*_test.py'`.
  Require exit0; Windows Linux-only skips documented, Linux CI must run them.
- [x] Request one independent read-only whole-change review. Fix findings and
  rerun affected checks. Update spec/backlog/plan with actual evidence; commit
  `test: verify genre volume compatibility and reader acceptance`.
- [x] Create/attach PR identifying OPDS-006 and preserved invariants. Require green
  exact-head test/typecheck/build, merge via approved normal workflow and require
  green exact-main native package. Verify actual health SHA after timer installs.
- [ ] Ask owner for actual genre/volume display result; close only observed gates,
  preserve untested reader edge backlog and installed/proxy traffic evidence limits.

## Self-review and handoff

OPDS-006 extraction/optional errors ->Task1; categories/format/scenarios ->Task2;
old cache/no extra traffic and AUTH/SOURCE/CACHE invariants ->Task3. All five
review-focus classes have explicit tests. No new endpoints/dependency/schema.
Existing spec AUTH-003 self/image signatures and OPDS-004 reserved routes remain.
Author-sheet display stays source-derived; no inferred size or pages.

Owner approved written specificationa979a83. Owner approved planbee8baa before execution;
preserve current-folder/native implementation choice rather than asking again
for worktree or per-task agents. Code has not started.

Owner2026-10-07 accepted visible genres/volume/artwork via screenshot and explicitly requested volume after synopsis. This bounded layout amendment updates the composition above; rerun existing renderer/API ordering tests RED/GREEN, build/typecheck and Linux CI, then normal release. No parser/cache/auth/source change.
