# Прямий Atom search link для FBReader — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FBReader отримує template пошуку Searchfloor прямо з authenticated feed, без окремого запиту `opensearch.xml`, який він не авторизує.

**Architecture:** Розширити наявний helper `discovery(base,name)` у `src/opds/feed.ts`: перед OpenSearch link видавати direct `rel="search"` Atom acquisition template. Helper уже використовують root (лише з увімкненим Searchfloor), source root, acquisition і related feeds, тож зміна одна. API, auth, source client, cache, OpenSearch document не змінюються.

**Tech Stack:** Node24, TypeScript, Hono, Vitest, fast-xml-parser; без нових залежностей.

**Spec:** spec.md 0.8.3 OPDS-001 (запропоновано, очікує погодження власника); також OPDS-002, AUTH-001, SOURCE-001, DEPLOY-001, ACCEPT-001. Evidence: docs/search-direct-link-diagnostics-20261126.md.

## Global Constraints

- Template рівно `{PUBLIC_BASE_URL}/opds/searchfloor/search?q={searchTerms}&page=1`; у XML `&` escaped як `&amp;`, `{`/`}` не percent-encoded. Type `application/atom+xml;profile=opds-catalog;kind=acquisition` (константа ACQ).
- Порядок: direct link перед OpenSearch link у кожному feed з discovery. Рівно два search links; root без Searchfloor — жодного.
- `opensearch.xml`, `/opds`, search лишаються під Basic за AUTH-001; book-card grant їх не авторизує.
- Discovery без source I/O. Без змін parser/filtering/page validation/logging/unit/env/бота.
- Робоча копія: `/home/ysi/opds/production-rollout`, гілка `codex/fbreader-direct-search` від origin/main 6b80216.

## Review Focus

1. Direct link перший і має правильний type/template у root, source root, acquisition та related feeds.
2. Path prefix та spoofed Host не змінюють URL; XML валідний, template не escaped у `%7B`.
3. Підстановка `{searchTerms}` за FBReaderJ (`makeQuery`) у direct template веде до authenticated search з page=1 і query-preserving next.
4. Auth не послаблено, discovery не викликає джерело.

## Task 1: Direct search link

**Files:** Modify src/opds/feed.ts, tests/feed.test.ts, tests/search-discovery-api.test.ts.

- [x] Записати BASE=`git rev-parse HEAD`; Node24, `npm ci --no-audit --no-fund`.
- [x] RED renderer тест у tests/feed.test.ts: для root зі Searchfloor, source root, renderFeed (completed і search) та renderRelatedFeed search links дорівнюють `[direct, opensearch]` у цьому порядку; direct href = `https://opds.example/proxy/opds/searchfloor/search?q={searchTerms}&page=1`, type = ACQ. Root з `[]`/unknown — без `rel="search"`. Оновити наявний тест, що очікує один root search link.
- [x] RED API тест у tests/search-discovery-api.test.ts: з authenticated root (spoofed Host) взяти перший search link, переконатися, що це direct Atom template, замінити `{searchTerms}` на encodeURIComponent(query) і пройти search → next з наявними fixtures для «стоев», «за последним порогом», `А & Б 100% ё`; до search-запиту source fetch не викликався. Наявний OpenSearch шлях зберегти, але шукати link за type, а не першим.
- [x] Запустити focused tests, зафіксувати RED через відсутній direct link, а не setup failure.
- [x] У `discovery()` додати `link("search", absolute(base, \`/opds/${name}/search?q={searchTerms}&page=1\`), ACQ)` перед OpenSearch link. Інших змін немає.
- [x] Focused GREEN; `npm run typecheck`, `npm run build`, `npm test`, Python deployment regressions (`python3 -m unittest discover -s tests -p '*_test.py'`), `git diff --check`. Записати фактичні counts/skips і версію Node. Commit: `fix: publish direct Searchfloor search template for FBReader`.

## Task 2: Review, release та phone acceptance

**Files:** Update spec.md status, docs/backlog.md READ-01; create docs/search-direct-link-acceptance.md.

- [ ] Незалежне review гілки; підтверджені findings — з регресійним тестом.
- [ ] Push, PR з OPDS-001/002, AUTH-001 і доказами; exact-head CI GREEN; merge лише з дозволу власника; звичайний artifact/timer rollout без ручних рестартів.
- [ ] Перевірити installed SHA/ready через local/public health.
- [ ] Власник редагує й зберігає (або видаляє й додає знову) каталог у FBReader, шукає «стоев» і «за последним порогом», відкриває наступну сторінку. PASS лише коли access log має route `search` (і `search` з page=2 для next) та картка має Catalogue: Searchfloor.
- [ ] Якщо `search` у логах так і не з'являється, записати це як evidence і окремо розглянути anonymous OpenSearch (зміна AUTH-001) — не робити її без нового погодження.

## Self-review

OPDS-001 direct/OpenSearch порядок, prefix, Host → Task1 renderer; OPDS-002 query/next → Task1 API; AUTH-001 → наявний auth тест лишається; ACCEPT-001/phone → Task2. Одна зміна helper, без рефакторингу. Висновок про FBReader Android3.8.31 — inference з FBReaderJ і логів, phone gate явний.

## Task 1 execution record (2026-11-26)

BASE f357672. Node v24.22.3, Linux. RED: 5 focused failures, all from the missing
direct link (renderer: root has only OpenSearch; API: first search link type was
opensearchdescription). GREEN after one `discovery()` change: typecheck exit0;
`npm test` (build + vitest) 34 files, 178 passed, 0 skipped; Python deployment
regressions 57 OK; `git diff --check` exit0.
