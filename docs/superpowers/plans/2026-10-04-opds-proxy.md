# OPDS Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Приватний OPDS-каталог завершених книг Searchfloor для FBReader,
поряд із Warsaw Beer Bot на чинному Hetzner-хості, з автодеплоєм.

**Architecture:** Окремий Hono-сервіс, upstream HTML adapter і SQLite-кеш.
OPDS 1.2 XML та пошук; FB2 ZIP передається потоком на вимогу.
Окремий systemd timer встановлює готовий Linux-артефакт після green CI на exact SHA.

**Tech Stack:** Node 24, TypeScript strict, Hono, cheerio, better-sqlite3,
p-queue, zod, pino, Vitest; Linux packaging; systemd, Cloudflare Tunnel.

**Spec:** Кореневий `spec.md` у форматі OpenSpec — єдине нормативне джерело
правди; створено в Task 0, власник погодив дизайн і продовження реалізації. Вхідні матеріали:
`docs/basic-plan.md` (погоджено користувачем 2026-10-04) та `docs/server-audit.md`.
Базовий план і цей implementation plan не є альтернативними специфікаціями.

## Global Constraints

- До кодування створити й погодити `spec.md`; перед кожним проектним рішенням
  прочитати відповідні вимоги. Зміни архітектури, поведінки, API, конфігурації
  чи deployment відобразити в специфікації та узгодити з планом і тестами.
- При зміні вимог оновлювати `spec.md` у тому самому PR/commit-наборі, що й код.
  При розбіжності spec/код/план визначити потрібний результат і виправити
  розбіжність; не трактувати випадкову поведінку коду як нову вимогу.
- Репозиторій `https://github.com/ysilvestrov/opds-proxy`; робоча гілка `feat/opds-v1`, draft PR #1.
- Ціль — чинний Hetzner, OPDS поряд із ботом. Спільний переїзд — окремий проєкт.
- Один користувач, лише завершені доступні книги; unknown не означає completed.
- Public namespace `/opds/{name}/...`, єдине v1 name — `searchfloor`.
  Автори/жанри мають зарезервовані entity routes, без реалізації browser у v1.
- Без повного індексу, архіву книг, EPUB-конвертера, Telegram та Litestream для кешу.
- Ні bot.db, ні .env/токени/lock/state/unit бота не використовуються OPDS.
- Node 24 хоста не змінювати. Native-залежності артефакту повинні бути Linux/CPU/ABI-compatible.
- Один одночасний Download; потік без накопичення всієї книги в RAM чи на диску.
- CI test/typecheck/build; не робити масові live-запити із CI.
- Bootstrap, DNS і tunnel route — окремі операторські кроки після огляду файлів.
- Cloudflare Free зберігається за COST-001: перед ймовірним збільшенням
  місячного рахунку отримати окремий дозвіл із поясненням платежів; безкоштовні
  погоджені операції не потребують нового billing approval.
- Не підміняти відсутній CI check успіхом; deployment перевіряє конкретний required workflow.

## Review Focus

- Searchfilter ігнорується джерелом: відсіювати неповні результати локально (Task 2/4).
- HTML 200 замість книги: не віддавати challenge/login як ZIP (Task 5).
- Порожній кеш і rollback нового формату: сервіс стартує без upstream і перебудовує кеш (Task 3/7).
- Пароль не передається клієнтом для acquisition: не оголошувати FBReader acceptance до ручного тесту (Task 6).
- Відсутній/підроблений/іншого SHA artifact і pending CI: current не змінюється (Task 7).

## File structure

`spec.md` — OpenSpec-вимоги, архітектура й інваріанти; `AGENTS.md` — обов'язок
читати специфікацію та підтримувати відповідність при кожній зміні.
`src/config.ts`, `src/index.ts` — конфігурація і composition root.
`src/domain/book.ts` — типи; `src/sources/searchfloor/{parse,client}.ts` — DOM/I/O.
`src/sources/registry.ts` — configured sourceName → adapter, у v1 лише searchfloor.
`src/storage/cache.ts` — витратний SQLite; `src/catalog.ts` — кеш+джерело.
`src/opds/{feed,search}.ts` — XML; `src/api/{app,auth,download}.ts` — HTTP.
`tests/fixtures/searchfloor/` — анонімізовані HTML, без книг і cookies.
`tests/{parse,client,cache,catalog,feed,auth,download,app}.test.ts`.
`scripts/{package-release,autodeploy}.mjs`, `tests/deploy.test.ts`.
`deploy/{searchfloor-opds.service,searchfloor-opds-deploy.service,searchfloor-opds-deploy.timer,bootstrap.sh,README.md}`.
`.github/workflows/ci.yml`, `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `README.md`.

## Task 0: Canonical OpenSpec specification

**Files:** Create `spec.md`, `AGENTS.md`; align `docs/basic-plan.md` and this plan.

**Interfaces:** Produces the single normative service specification read by
all later tasks. Assign stable requirement IDs (e.g. OPDS-CATALOG-001)
for references from design decisions, tests and PR descriptions.

- [x] Create root `spec.md` from the approved design and audit. Use OpenSpec
  Markdown requirements (`### Requirement: …`, normative SHALL/MUST)
  and concrete `#### Scenario: …` with WHEN/THEN, optionally GIVEN/AND.
  Root-file placement is the owner's choice; do not maintain a second normative
  copy under openspec/specs. No CLI installation required merely to author Markdown.
- [x] Include purpose/scope; architecture/component boundaries and interfaces;
  upstream contract; completed-only filtering; OPDS/search/pagination;
  Basic-auth compatibility gate; streaming; cache lifecycle/limits;
  config/defaults; errors/timeouts/backoff; deployment/artifact provenance;
  isolation from bot; operator bootstrap; acceptance and observability.
- [x] Distinguish current requirements, audit facts and unverified assumptions.
  Technical limits introduced by this plan become proposed spec values,
  not previously approved facts. Include scenarios for outage, unknown book
  status, lost cache, invalid ZIP, client disconnect and deployment rollback.
- [x] Add AGENTS instruction: read spec before design/code/review; check each
  decision against requirements; update spec when requirements change;
  update related tests/plans in the same change. PR must reference changed
  requirement IDs or explain why existing requirements remain satisfied.
- [x] Review for contradictions, omitted requirement scenarios, ambiguous
  interfaces, duplicate sources of truth and false claims of validated behavior.
- [ ] Owner reviews written spec and the aligned implementation plan before Task 2 service code.
  Task 1 read-only source verification may refine evidence and feed back into spec.
- [ ] After git setup in Task 1, commit spec/instructions and documentation
  together. Future architectural decisions first reconcile spec, then plan/code.

## Task 1: Repository and source contract evidence

**Files:** `docs/source-contract.md`, `tests/fixtures/searchfloor/*.html`,
`docs/basic-plan.md`; git setup only, no service code.

**Interfaces:** Produces documented source URLs, DOM selectors, page termination
signal, status mapping and actual ZIP/FB2 evidence consumed by Tasks 2/5.

- [ ] Inspect remote via `git ls-remote --symref https://github.com/ysilvestrov/opds-proxy.git HEAD`; inspect local/ancestor AGENTS.
- [ ] If remote has history, fetch/checkout without overwriting local docs; if empty, initialize main and set origin. Never force push. Preserve local reference material, keep it out of product commits unless intentionally selected.
- [ ] Fetch a bounded mixed-status search and its next page. Compare completed filter and no filter, record exact selectors/status text and end-of-pages behavior. Stop on 403/429/challenge; no bypass.
- [ ] Fetch one anonymous Download from a completed card with 20 MiB cap and 30 s deadline into a task-owned temp path. Inspect ZIP directory and FB2 XML; record MIME, filename, HTTP method, length and redirects without book text.
- [ ] Record fixture provenance/date and sanitize tracking identifiers/scripts/cookies. Do not commit the downloaded book; remove only the owned temporary book after inspection.
- [ ] Contract passes if one complete file is confirmed and source status/page semantics are explicit. If no usable GET, block download implementation pending a revised transport design, not a browser bypass.
- [ ] Commit contract docs and HTML fixtures after checking staged diff. Local git must exist before claiming a commit.

## Task 2: Typed Searchfloor adapter

**Files:** package/TS/Vitest configuration; `src/domain/book.ts`,
`src/sources/searchfloor/{parse,client}.ts`; `tests/{parse,client}.test.ts`.

**Interfaces:**
`EntityRef {name: string; id?: string}`;
`Book { sourceName: string; id: string; title: string; authors: string[];
authorRefs?: EntityRef[]; genres?: EntityRef[]; summary?: string; series?: string;
seriesPosition?: number; sourceUrl: string; downloadPath: string; complete: boolean;
observedAt: string }`.
`SourcePage { books: Book[]; nextPage: number | null; observedAt: string }`.
`parsePage(html: string, page: number, observedAt: string): SourcePage`;
`SearchfloorClient.list(query: string | null, page: number, signal?: AbortSignal): Promise<SourcePage>`;
`SearchfloorClient.getBook(id: string, signal?: AbortSignal): Promise<Book | null>`.

- [ ] Establish Node>=24, strict TypeScript, npm scripts test/typecheck/build; select compatible dependencies and commit lockfile. No bot test wrapper dependency.
- [ ] Write fixture tests: complete+Download retained; incomplete/unknown excluded; full document and page fragment parsed; duplicate ID deduplicated; malformed/challenge HTML is an error, legitimate empty result is empty. Include mixed-status search and Cyrillic author/title.
- [ ] Run `npm test -- tests/parse.test.ts` and confirm failure before parser implementation.
- [ ] Implement parser using Task 1 selectors, source ID rather than title as identity; accept only same-origin `/book/{numeric id}` Download routes. Determine completion and Download independently.
- [ ] Tag all adapter Books with sourceName=`searchfloor`; optional authorRefs/genres
  may remain absent. Registry maps only searchfloor to the Searchfloor adapter.
  Define `getSource(name: string): SearchfloorClient | null`; do not implement
  additional adapters/entity parsers. Test unknown name returns null.
- [ ] Write mocked client tests: encoded query, preserved page, timeout, 429 Retry-After, bounded retries, next=null only on established end signal, getBook status revalidation.
- [ ] Implement client per SOURCE-002: origin fixed, HTML cap 2 MiB, timeout 15 s,
  concurrency 1, 1 s minimum spacing, max 20 queued and 30 s queue deadline.
  At most one transient retry within 10 s; longer Retry-After establishes full
  cooldown without early retry. Max 3 manual same-origin HTTPS redirects.
  Test queue overload, cooldown and forbidden redirect alongside the earlier cases.
- [ ] Run parser/client tests and `npm run typecheck`; expected PASS. Commit adapter and setup.

## Task 3: Rebuildable cache and catalog pagination

**Files:** `src/storage/cache.ts`, `src/catalog.ts`, `tests/{cache,catalog}.test.ts`.

**Interfaces:** `Cache.get<T>(key: string, now: number): {value: T; expiresAt: number} | null`;
`Cache.set<T>(key: string, value: T, expiresAt: number): void`; `Cache.close(): void`.
`CatalogPage = SourcePage & {stale: boolean}`;
`Catalog.page(query: string | null, page: number, signal?: AbortSignal): Promise<CatalogPage>`;
`Catalog.book(id: string, signal?: AbortSignal): Promise<Book | null>`.
Inject Clock/client/cache; no deep process.env or real network in tests.

- [ ] Write tests: new empty DB works; cache hit avoids HTTP; TTL expiry fetches; Unicode query key is stable; same pending query coalesces; different pages don't collide; errors not cached as empty.
- [ ] Include sourceName in every book/page cache key; test that identical book IDs
  or queries under different test-only source names don't collide (no new live source).
- [ ] Write search test: local filtering does not remove nextPage when more upstream results exist. First version mirrors source pagination; empty filtered page may still have next link. No unbounded scanning/crawl.
- [ ] Write tests for schema-version change and corrupt file: startup closes old handles, quarantines only owned cache files, creates fresh cache, logs reset reason without personal data. Readiness succeeds with empty cache.
- [ ] Run `npm test -- tests/cache.test.ts tests/catalog.test.ts` expecting initial FAIL.
- [ ] Implement SQLite WAL cache, list TTL 15 min, book metadata TTL 24 h, LRU/expiry eviction; cap serialized live records at 128 MiB and max 10,000 keys. These logical limits do not equal disk quota; prune/checkpoint and measure DB+WAL against 256 MiB target. Keep at most one quarantined cache, never include secrets or release state.
- [ ] On upstream outage, allow cached page up to 24 h old and label stale in feed subtitle; never return cached negative completion as downloadable. Revalidate completion for Download after 15 min, even if metadata TTL is longer. No mass warmup.
- [ ] Run tests/typecheck; commit storage/catalog.

## Task 4: OPDS feeds and HTTP catalog

**Files:** `src/opds/{feed,search}.ts`, `src/api/app.ts`, `src/config.ts`,
`tests/{feed,app}.test.ts`, `.env.example`.

**Interfaces:** `renderFeed(page: SourcePage, context: {baseUrl: string; query: string | null;
sourceName: string; page: number; updated: string; stale: boolean}): string`;
`renderRoot(baseUrl: string, sources: {name: string; title: string}[]): string`;
`renderSourceRoot(baseUrl: string, sourceName: string): string`;
`renderOpenSearch(baseUrl: string, sourceName: string): string`.
`createApp(deps: {catalog: Catalog; config: Config; log: Logger}): Hono`.
Config validated once: PUBLIC_BASE_URL, PORT(default 8787), CACHE_PATH,
OPDS_USERNAME, OPDS_PASSWORD; fail startup on absent credentials.

- [ ] Write XML-parser tests for root/acquisition/OpenSearch namespaces, title/author escaping,
  stable `urn:opds:searchfloor:book:{id}`, absolute namespaced links, self/start/next,
  missing optional metadata, empty page with next and stale label. Global root
  lists only searchfloor; source root lists completed and search discovery.
- [ ] Write HTTP tests: root and search routes, UTF-8 headers, query trim/max 200 chars, integer pages 1..10000, invalid input 400, source unavailable without cache 503, parse error 502. Update timestamps derive from observed data, not current time on every cache hit.
- [ ] Run targeted tests expecting FAIL; implement renderers and Hono catalog routes.
- [ ] Routes: `/opds`, `/opds/searchfloor`, `/opds/searchfloor/completed`,
  `/opds/searchfloor/search`, `/opds/searchfloor/opensearch.xml` and acquisition
  `/opds/searchfloor/books/{id}/download.fb2.zip`. MIME `application/zip`;
  Task 6 is FBReader compatibility gate. Feed type
  `application/atom+xml;profile=opds-catalog;kind=acquisition`;
  OpenSearch MIME `application/opensearchdescription+xml`.
- [ ] Test unknown source returns 404 without client calls; reserved authors/genres
  index/entity routes return 404 and don't appear in rendered navigation.
- [ ] `/health` returns only process readiness and release SHA, no upstream call or secrets; no auth exemption for catalog. Root static XML must be available even when upstream is down.
- [ ] Run tests/typecheck/build; commit catalog.

## Task 5: Private auth and streaming acquisition

**Files:** `src/api/{auth,download}.ts`, `src/index.ts`,
`tests/{auth,download,app}.test.ts`, `README.md`.

**Interfaces:** Basic-auth middleware protects all OPDS/OpenSearch/download paths;
`streamBook(id: string, deps: {catalog: Catalog; client: SearchfloorClient}, signal: AbortSignal): Promise<Response>`.
Client adds `openDownload(book: Book, signal: AbortSignal): Promise<Response>`;
only the validated Book supplies upstream path.
- HTTP source resolution precedes Catalog calls; obtain the source-bound
  Catalog/client from registry. Namespaced acquisition cannot select another adapter.

- [ ] Write auth tests: missing/wrong/malformed credentials 401 with Basic challenge; valid credentials across feed/search/download; passwords don't enter logs. Constant-time compare fixed-length credential digests. Reject arbitrary download URL/path and unknown/incomplete book ID.
- [ ] Write streaming tests against local mock upstream: ZIP prefix passed byte-for-byte; HTML 200/challenge rejected before sending file headers; redirects checked at every hop; disconnect cancels upstream; 20 MiB cap and 60 s total deadline; only one download slot, second request gets 429. No full-body arrayBuffer()/blob().
- [ ] Define content sniff: buffer at most 4 KiB, require ZIP signature and permitted MIME from contract, then replay prefix plus stream. ZIP XML validity is proven by contract/client tests, not by unbounded parsing during each transfer. Empty/wrong payload 502; upstream denied 503; missing file 404. Once headers sent, stream errors terminate the transfer, never append JSON to ZIP.
- [ ] Run tests expecting FAIL; implement auth/download. Set sanitized filename with `.fb2.zip`, Content-Disposition filename plus UTF-8 filename*, Cache-Control private/no-store. Do not promise HTTP Range support; fresh GET is first-version behavior.
- [ ] Add graceful SIGTERM: stop accepting, cancel queued calls, drain active downloads for bounded 15 s then abort, close SQLite. Log to stdout for journald with credentials/header redaction.
- [ ] Run full test/typecheck/build; commit runtime. No external server modification yet.

## Task 6: FBReader acceptance prototype

Prototype preparation uses the approved feature branch's green-CI
`opds-prototype-{sha}` artifact and manual `searchfloor-opds-prototype.service`,
with independent prototype code/cache/config. Follow docs/codex-cli-prototype.md.
Production current/state/timer stay untouched. CI/deployer main-origin checks
continue to reject the non-main prototype artifact. This resolves the need to
obtain device evidence before production activation without a server-side build.

**Files:** `docs/fbreader-acceptance.md`, `docs/source-contract.md`.

**Interfaces:** Produces tested reader OS/version, successful acquisition MIME,
Basic auth behavior and a concrete bootstrap go/no-go result.

- [ ] Start implemented service in a controlled local/test environment using separate credentials. Ask owner for FBReader platform/version only if not already supplied. Do not expose plaintext credentials on a public HTTP listener.
- [ ] Owner tests add catalog → completed → search mixed statuses → next → download → open; verify Basic credentials work on acquisition too. Automated HTTP mocks cannot substitute for this step.
- [ ] Record whether ZIP acquisition MIME works. If needed test FB2 ZIP-specific MIME in an isolated variant and adjust feed+tests based on reader evidence.
- [ ] If Basic fails, stop server bootstrap and present concrete alternatives to owner; do not silently enable public access or URL-token auth.
- [ ] Record observed result, remaining failures, test date and OS/version, not passwords or book text. Commit acceptance evidence when actual test complete; no invented PASS.

## Task 7: Linux release artifacts and isolated autodeploy

**Files:** `.github/workflows/ci.yml`, `scripts/{package-release,autodeploy}.mjs`,
`tests/deploy.test.ts`, deploy service/timer, `deploy/README.md`.

**Interfaces:** Internal release identity `{sha,nodeMajor:24,platform:'linux',arch,libc,nodeAbi,cacheSchemaVersion}`;
external archive checksum plus trusted GitHub workflow/run identity. Hash never embedded in the archive it hashes.
`deployCandidate(deps: DeployDeps): Promise<'noop'|'deployed'|'rolled-back'|'held'>`;
deps inject CI/artifact fetch, filesystem, clock and fixed OPDS restart/health actions.
State tracks settledSHA, failedSHA, phase, previousSHA; separate lock and PAUSED.

- [ ] Configure Linux CI workflow with required jobs test/typecheck/build, plus exact-SHA packaging on main. Archive dist, production node_modules, package metadata and manifest. Match target CPU/libc/Node ABI verified at bootstrap; test better-sqlite3 loading on the compatible Linux environment before publishing artifact.
- [ ] Write deploy tests: missing/pending/wrong check blocks; wrong SHA/checksum/target blocks; changed main during staging defers; PAUSED and lock contention no-op; failed start rolls back only OPDS; crash after symlink switch reconciles state next tick; never record failed candidate as settled SHA; transient fetch errors bounded retry, build/runtime failure requires explicit rearm/new SHA.
- [ ] Include trusted workflow/run identity checks: arbitrary successful check
  or a replaced artifact with its own valid checksum cannot authorize deployment.
- [ ] Run `npm test -- tests/deploy.test.ts` expecting FAIL; implement deployment as a state machine with injected effects, no shell-string construction. Download archives with path traversal/symlink checks before extraction. Immutable releases; atomic current switch, verify local static XML and health independently of upstream; observe readiness/NRestarts for 60 s before settled.
- [ ] On incompatible cache rollback stop OPDS, invalidate only owned cache/WAL/SHM after process termination, restart previous release. First-release failure leaves no false healthy baseline. Never read/delete bot paths.
- [ ] Retain current+previous settled releases; staging bounded and cleanup restricted to validated own root. Installed deployer/unit root-owned; deploy-user cannot self-modify privileged helper. Timer every 5 min; constrained artifact/repo/CI read credentials separate from bot.
- [ ] Run deploy tests and full CI, review exact privilege boundaries. Commit deployer; no live unit installation from tests.

## Task 8: Reviewable bootstrap and deployment on current host

**Files:** `deploy/bootstrap.sh`, runtime unit, `deploy/README.md`,
`docs/bootstrap-checklist.md`, `docs/runtime-measurements.md`.

**Interfaces:** Runtime account `searchfloor-opds`; deploy account `searchfloor-deploy`;
paths `/opt/searchfloor-opds/{staging,releases,current}`, `/etc/searchfloor-opds`,
`/var/lib/searchfloor-opds/cache`, `/var/lib/searchfloor-opds-deploy/{state,lock}`.
Proposed route `opds.ysilvestrov-ai.uk` → `http://127.0.0.1:8787`; existence not confirmed.

- [ ] Produce exact idempotent bootstrap script and fixed-argument restart helper/sudoers; no broad sudo shell and no dependency on bot credentials. Document operator actions and rollback before asking to run them.
- [ ] Runtime unit: loopback only, MemoryHigh=256M/MemoryMax=384M, CPUQuota=50%, TasksMax=64, NoNewPrivileges, read-only code, write only cache. Initial deployer MemoryMax=768M/CPUQuota=100%, one deployment at a time; no compile on runtime host.
- [ ] Check script syntax (`bash -n deploy/bootstrap.sh`) and unit syntax in Linux test environment; inspect dry-run output for paths/users/restart target. No unit activation in CI.
- [ ] Present prepared bootstrap files for operator execution on current server; preserve existing bot/tunnel route. Verify free port, current baseline, compatible archive, required workflow and credentials from actual deploy-user environment.
- [ ] Create route and credentials through authorized operator workflow; first release, private FBReader test, then timer enable. Record actual actions separately from prepared code.
- [ ] Verify successful auto-release and deliberate failed release in isolated pre-production test service before relying on production rollback. Confirm bot health/NRestarts unchanged.
- [ ] Measure runtime RSS/CPU, DB+WAL and two releases during browse/search/download. Save exact date/window and propose limit adjustment only from data. No claim that a short snapshot proves all future peaks.
- [ ] Final verification: `npm test`, `npm run typecheck`, `npm run build`, compatible native artifact load, FBReader acceptance and actual auto-deploy evidence. Report any operator/client steps still pending; don't label them complete from unit tests.

## Execution handoff

### Implementation evidence, 2026-10-04

Tasks 0–5 are implemented locally on `feat/opds-v1`; Task 6 remains pending
HTTPS client acceptance on FBReader for Android 3.8.31 (owner supplied version
2026-10-04). Tasks 7–8
have reviewable code/infrastructure files, not installed infrastructure.
Final fresh review found startup-readiness and failed-release cleanup issues;
regressions were tested RED→GREEN. Source 404 handling now explicitly requires
the empty marker even when filtering has removed all cards.
Startup grace is 15s, followed by continuous 60s health/static XML observation;
failed/orphaned releases are pruned only after safe recovery or on idle ticks.
Linux CI/native packaging has now passed for the pinned prototype candidate;
see docs/linux-ci-evidence.md. Remaining installed permissions, actual deploy/rollback
and capacity evidence must not be inferred from Windows fixture/mock tests.

Server preparation report received 2026-10-05: docs/prototype-report.md.
Pinned artifact/host compatibility and infrastructure syntax/dry-run verified;
installation/startup blocked by sandbox sudo, HTTPS route unverified/NXDOMAIN.
Bot remained healthy with NRestarts=0. No OPDS units or credentials installed.
Continue Task 6 using docs/codex-cli-prototype-continuation.md; reader checks
remain pending. Staged empty-page XML has no serving route: protected fixture
serving is still an open implementation step before full ACCEPT-001.

Recommended: native execution in this chat via superpowers:executing-plans.
Tasks depend on the same adapter/catalog/HTTP interfaces; for a single-user
service this avoids repeated agent context. Subagent execution is optional
only if the owner explicitly chooses it. Review plan before implementation.
Server migration is excluded from every task; preserve measured artifacts
for that later project. Do not message the infrastructure chat without explicit authorization.

Self-review: design requirements mapped to Tasks 1–8; source evidence and
client acceptance distinguished from automated tests; bootstrap separate
from code; artifact-based autodeploy preserves current-server scope.
Task 0 establishes OpenSpec authority; every later task checks its signatures,
limits and scenarios against spec.md, updating requirements when evidence
changes a design decision.
