# Book metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Показати анонс і обкладинку вибраної завершеної Searchfloor книги у FBReader Android3.8.31.

**Architecture:** Listing посилається на приватний standalone Atom entry.
Catalog отримує optional ресурси лише для вибраної книги; SQLite зберігає
деталі й base64 artwork окремо від completion evidence. Усі source запити
використовують наявний обмежений client і незалежний OPDS proxy.

**Tech Stack:** Наявні Node24/TypeScript, Hono, cheerio, SQLite/WAL, undici, Vitest.

**Spec:** Root `spec.md`, погоджений власником commit46a6d4c:
OPDS-005, SOURCE-004, CACHE-003; також SOURCE-001/002/003, AUTH-001,
OPDS-001/003, CACHE-001/002, ARCH-001, ACCEPT-001. План не друга специфікація.

## Global Constraints

- Поточна папка, гілка `codex/book-metadata`; без worktree, ресурсів бота та переїзду VPS.
- No product code до review цього плану й вибору execution method.
- Єдине джерело `searchfloor`; маршрути `/opds/{name}/books/{id}` та `.../cover`.
- Entry MIME `application/atom+xml;type=entry;profile=opds-catalog`;
  Download link `application/fb2+zip`, raw ZIP `application/zip`.
- Annotation64KiB decoded bytes/15s, cover2MiB decoded bytes/15s, JPEG/PNG/GIF.
- Source queue concurrency1, spacing1s, queue20/wait30s, <=3 same-origin
  redirects, один retry429/5xx<=10s; denial без fallback/обходу.
- Details/cover TTL24h; empty/404 optional TTL15min; failures не negative-cache.
- Covers64MiB serialized у загальному128MiB/10,000keys; DB+WAL target256MiB.
- Completion evidence15min для Download не оновлюється optional metadata.
- Basic auth на всіх нових routes; no public images, credentials/книги у Git.
- Без нових env/units/directories/dependencies, платних Cloudflare змін,
  bulk crawl, фонового збагачення чи eager artwork у listing.
- Tests — fixtures/local mocks; live probes лише operator bounded acceptance.

## Review Focus

1. Listing refresh затирає enriched metadata — незалежні keys (Task3).
2. Image MIME приховує HTML або compressed body перевищує cap — streaming
   decoded limit і signature validation (Task1).
3. Optional timeout породжує false absence/поновлює completion — independent
   timestamps і negative state лише empty/404 (Task3).
4. Cache eviction залишає рекламовану cover, якої немає — on-demand refill,
   без усіх annotation запитів і без доступу до incomplete книги (Task3/4).
5. Reader не follows Atom alternate або не передає Basic для images — device
   gate, без зміни auth/eager hydration як прихованого fallback (Task5).

---

## File responsibilities and interfaces

- `src/domain/book.ts`: `BookDetails {sourceName,id,summary?,cover?:{mime:ArtworkMime},observedAt}`;
  `ArtworkMime = 'image/jpeg'|'image/png'|'image/gif'`;
  `Artwork {mime:ArtworkMime,bytes:Uint8Array,observedAt:string}`.
- `src/sources/searchfloor/metadata.ts` (new): pure
  `parseAnnotationCard(html:string,id:string): {inline?:string;api:boolean}`,
  `parseAnnotation(bytes:Uint8Array): string|null`,
  `validateArtwork(bytes:Uint8Array,contentType:string): ArtworkMime`.
- `client.ts`: add `getCard(id:string,signal?:AbortSignal):Promise<
  {book:Book;annotation:{inline?:string;api:boolean}}|null>`;
  existing getBook delegates to getCard and returns only book. Annotation hint
  is internal, not completion evidence.
  Add `getAnnotation(id:string,signal?:AbortSignal):Promise<string|null>` and
  `getCover(id:string,signal?:AbortSignal):Promise<Artwork|null>`; null only empty/404.
- `storage/cache.ts`: existing JSON cache plus `delete(key:string):void`,
  `set(..., group?:'artwork'):void`; artwork rows tracked for separate budget.
- `catalog.ts`: existing page/book Download contract retained. New
  `details(id:string,signal?:AbortSignal):Promise<{book:Book;details:BookDetails;stale:boolean}|null>`
  and `cover(id:string,signal?:AbortSignal):Promise<Artwork|null>`.
- `opds/feed.ts`: shared pure book-entry rendering and new
  `renderBookEntry(book:Book,details:BookDetails,baseUrl:string,stale:boolean):string`.
- `api/app.ts`: authenticate/validate/serve entry and binary cover; no I/O parsing.
- `index.ts`: composition remains one Cache, source transport/client and Catalog.

`parse.ts` adds `parseObservedPage(html,page,observedAt):SourcePage &
{rejectedIds:string[]}`; existing parsePage returns its public SourcePage subset.
Client.list returns the observation, Catalog consumes rejectedIds internally;
OPDS/public SourcePage never publishes these IDs. Do not persist DOM/source script.

## Task 1: Bounded optional source resources

**Files:** domain/book.ts, sources/searchfloor/metadata.ts and client.ts;
tests/metadata.test.ts (new), client.test.ts, fixtures/searchfloor/metadata-*.html (new).

**Interfaces:** Produces the domain types and pure parser/client methods above.

- [x] Write failing fixture tests: `inline_preserves_paragraphs` -> two `<p>`
  become two text paragraphs without script/style; `api_path_is_fixed` -> external
  data-url rejected, never followed; `empty_is_not_site_description` -> null.
- [x] Write failing transport tests: 404->null; empty annotation->null;
  malformed UTF-8/wrong MIME->502; 403->503; JPEG/PNG/GIF accepted only matching
  signature/MIME; HTML as JPEG/SVG rejected; no Content-Length cap+1 rejected
  and body canceled; cap exactly accepted;15s timeout/cancellation/shutdown bounded.
- [x] Run `node node_modules/vitest/vitest.mjs run tests/metadata.test.ts tests/client.test.ts`;
  confirm assertion/import failures for missing feature, not unrelated setup errors.
- [x] Implement pure functions and transport using existing `run/request/readLimited`.
  Parameterize Accept per resource; fixed paths, same source dispatcher/queue.
  Strict TextDecoder; do not execute JS or use generic description. If inline
  extraction reuses card, retain it without duplicate `/b/{id}` lookup.
- [x] Rerun focused tests, existing transport.test.ts and typecheck; commit files
  explicitly with `feat: fetch bounded Searchfloor annotations and covers`.

## Task 2: Artwork budget in disposable SQLite

**Files:** src/storage/cache.ts, tests/cache.test.ts.

**Interfaces:** Produces delete and artwork group set; get JSON contract unchanged.

- [x] Write `artwork_budget_includes_base64_overhead`: small injected cover/global
  budgets; eviction keeps serialized artwork<=group cap and all values<=global cap.
  `global_key_limit_includes_artwork` -> all kinds count; `overwrite_updates_group`
  -> totals correct; `reset_rollback_rebuilds` -> unsupported schema resets only OPDS DB.
- [x] Run cache.test.ts and confirm new assertions fail.
- [x] Add group accounting in an auxiliary membership table, retain schema1
  and original five-column cache table for manifest/installed deployer/rollback
  compatibility; prune orphan membership rows. LRU evicts artwork within64MiB
  then all rows within128MiB/10,000keys.
  Options permit reduced test limits; defaults remain spec values. Do not create
  a second DB. Include decoded2MiB validation before persisted base64.
- [x] Run cache.test.ts, typecheck and existing runtime.test.ts; commit
  `feat: bound recoverable artwork within the existing cache`.

## Task 3: Lazy metadata orchestration and independent freshness

**Files:** src/catalog.ts, tests/catalog.test.ts; client types from Task1.

**Interfaces:** Produces details/cover; consumes Task1 transport and Task2 cache.
Keys: `details:v1:{source}:{id}:annotation`, `details:v1:{source}:{id}:cover`.
Values discriminate `{state:'present',observedAt,value}` vs `{state:'absent',observedAt}`;
failed/unrequested resources have no successful cache value.

- [x] Write `list_does_not_fetch_details` and `list_refresh_preserves_enrichment`;
  client counters remain0 on page, previous summary/cover timestamps retained.
  `optional_refresh_does_not_allow_old_download` -> completion older15min still
  needs source confirmation, failure rejects Download.
- [x] Write `absence_expires_after_15min`, `failure_is_not_absence`,
  `expired_detail_is_not_served_after_24h`, `duplicate_reads_coalesce`,
  `cancel_one_keeps_other`, `incomplete_invalidates_details`.
  Cover eviction refills only cover; cold invalid/unknown/incomplete IDs never
  fetch annotation/cover. Basic cached base can survive optional failure.
- [x] Run catalog.test.ts and confirm failures for these new behaviors.
- [x] Implement details/cover via shared pending resource operations. Reuse base
  metadata <=24h for display, look up unknown/expired base; preserve existing
  book()15min Download check. Null/changed completion invalidates all resource keys;
  list-observed incomplete books invalidate too before completed filtering loses them.
  Add parseObservedPage in parse.ts and parser tests as defined above; exclude
  duplicates of an accepted ID from rejectedIds. Never include incomplete books
  in public SourcePage. Client.list/Catalog Client signatures carry the observation;
  fixtures/mocks supply rejectedIds (empty when none).
- [x] Fetch annotation then cover for selected detail only; optional errors omitted,
  never cached as absence; transient cover-only request propagates appropriate error.
  Cover link emitted only for available verified cached artwork. List hydration uses
  only existing valid details, no image links. Stale base labels remain explicit.
- [x] Run catalog/parse/download/cache tests and typecheck; commit
  `feat: resolve book metadata on demand without extending download freshness`.

## Task 4: Private Atom entries and artwork API

**Files:** src/opds/feed.ts, src/api/app.ts, tests/feed.test.ts, tests/app.test.ts.

**Interfaces:** Consumes Catalog.details/cover; produces renderBookEntry and routes.

- [x] Write XML tests: same urn; Atom alternate MIME; original HTML/acquisition
  retained; summary/content escaped and paragraphs preserved; both image relations
  with actual MIME/private absolute URL; unknown optional fields omitted;
  empty summary no generic description; stale warning; PUBLIC_BASE_URL beats Host.
- [x] Write HTTP tests: unauthenticated entry/cover401 with existing challenge;
  unknown source404 and invalid new route id400 before Catalog; missing book404;
  cover absent404/transient503/invalid502; correct bytes and MIME/nosniff/private
  headers; no-store full entry; list calls no details/cover. Regression: Download
  still authenticates and uses unchanged ZIP MIME, root/health remain source-independent.
- [x] Run feed/app tests and confirm new assertions fail.
- [x] Implement shared pure rendering, standalone entry namespace/self/start;
  routes under existing auth/source guard; response bytes via Uint8Array without
  HTML fallback; sanitized errors unchanged. Adapt mock Deps explicitly.
- [x] Run feed/app/auth/download tests plus typecheck; commit
  `feat: expose private complete OPDS entries and book artwork`.

## Task 5: Whole-change verification, release and reader acceptance

**Files:** docs/fbreader-acceptance.md, docs/backlog.md, spec.md status;
docs/metadata-acceptance.md (new operator/device checklist and evidence).

- [ ] Run `node node_modules/typescript/bin/tsc -p tsconfig.build.json`,
  `node node_modules/typescript/bin/tsc --noEmit`,
  `node node_modules/vitest/vitest.mjs run` and existing WSL Python unittest suite.
  Required result: exit0, no failures; no live source traffic from CI.
- [ ] Request one independent read-only whole-branch review against requirement IDs;
  fix blockers, rerun affected tests. Create/attach PR; require green exact-head
  Linux CI/native tests before main merge. Existing workflow packages only on
  main push: require its exact-SHA native-load/artifact job before deployment.
- [ ] Prepare operator bounded probe using full URLs
  `https://searchfloor.org/api/annotation/27047` and `https://searchfloor.org/cover/27047`
  through existing independent OPDS proxy; validate status/MIME/caps/signature
  in memory, sanitized counts only. No credentials in argv/chat/Git or bot env.
- [ ] Existing exact-SHA timer deploys approved main app artifact; do not reinstall
  bootstrap or change units. Record actual active SHA/local+HTTPS health,
  Basic401 and successful entry/cover checks, DB+WAL/RSS, bot PID/NRestarts unchanged.
  Roll back existing release if new behavior breaks baseline; disposable schema
  rollback covered in Task2. Production update is not device acceptance.
- [ ] Owner tests FBReader3.8.31: list -> full card -> annotation and cover;
  repeat opening; one known absent optional resource if available, otherwise local
  protected fixture; Download still works. If Atom alternate or cover auth fails,
  document evidence and return to design; never expose public covers or hydrate
  whole listing silently. Include READ-01/03 only if actually tested, not assumed.
- [ ] Record real results/date/SHA/reader version, resource deltas and pending cases;
  close META-01 only after acceptance. Remove draft status after implementation,
  keep device status truthful. No norm copy outside spec.md.

## Self-review and execution handoff

Coverage: SOURCE-004 ->Task1; CACHE-001/002/003 ->Task2/3;
SOURCE-001/002/003 ->Task1/3; OPDS-001/003/005 and AUTH-001 ->Task4;
ARCH-001/ACCEPT-001 ->Task5. Five Review Focus cases assigned above.
No new billing/config/server resource decisions. Spec46a6d4c approved in chat;
plan reviewed and native execution selected by owner. Native execution
in this session: five tasks share client/cache/Catalog interfaces, one whole-branch
independent reviewer before merge. Existing branch choice remains unchanged.
