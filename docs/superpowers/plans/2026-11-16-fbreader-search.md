# Пошук Searchfloor у FBReader — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the owner's preserved native execution choice. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FBReader знаходить пошук Searchfloor через доданий `/opds`, а початковий запит не утворює порожній page.

**Architecture:** Додати наявний OpenSearch discovery link до global root, коли Searchfloor увімкнений; зафіксувати page=1 в OpenSearch template. Зберегти чинні API, upstream search, фільтрацію завершеності, кеш і next. Один behavior PR без рефакторингу, нових підсистем чи окремого harness.

**Tech Stack:** Node24, TypeScript, Hono, Vitest, fast-xml-parser та наявні SQLite/Cheerio; без нових залежностей.

**Spec:** Кореневий spec.md, уточнення0.8.2 OPDS-001 погоджене післяd45aa38; також OPDS-002, SOURCE-001/002, AUTH-001/003, OPS-001, DEPLOY-001, ACCEPT-001. Власник погодив цей план після29e626d2026-11-17; native виконання у відновленій копії.

## Global Constraints

- V1 тільки searchfloor. Root має рівно один search link лише якщо джерело увімкнене; source/acquisition/related discovery зберігається.
- OpenSearch MIME application/opensearchdescription+xml; results MIME application/atom+xml;profile=opds-catalog;kind=acquisition. Template: `{PUBLIC_BASE_URL}/opds/searchfloor/search?q={searchTerms}&page=1` із XML escaping.
- PUBLIC_BASE_URL визначає URLs, включно з path prefix; Host header їх не змінює. Query trimmed/NFC, максимум200 Unicode code points; page integer1..10000. Відсутній page=1; явний порожній page лишається400.
- Basic потрібний для root/OpenSearch/search; book-card grant не авторизує їх. Лише завершені книги з Download, source порядок/пагінація зберігаються; next не губить query. Без crawl для заповнення відфільтрованої сторінки.
- Робоча копія: `C:/Projects/search-floor-opds/.superpowers/source-inspection-20261116`, гілка codex/fbreader-search-discovery. Початкова неповна папка не ремонтується цією задачею. Native виконання, без нового worktree.
- Тести offline fixtures/mocks. Discovery не робить source I/O. Немає змін бот/Cloudflare/env/schema/unit/transport/dependency manifest чи нового логування query.
- Чинний Node24 потрібний для build/native SQLite та повного gate. Раніший діагностичний replay на Node26 не є production validation.

## Review Focus

1. Root без увімкненого Searchfloor не рекламує його пошук — Task1 XML test.
2. Кирилиця, пробіли, `&`, `%` і NFC не ламають підстановку/next — Task1 інтеграційний тест.
3. Path prefix і spoofed Host не змінюють configured URL — Task1 renderer/API тести.
4. Discovery не викликає джерело і не послаблює Basic/grant scopes — Task1 API тест.
5. Порожня після фільтрації сторінка з next не завершує пошук — Task1 fixture regression; Task2 phone acceptance окремо від HTTP.

## Task 1: Discovery та початковий пошуковий запит

**Files:** Modify src/opds/feed.ts, src/opds/search.ts, tests/feed.test.ts. Create tests/search-discovery-api.test.ts. Використати чинні tests/fixtures/searchfloor/mixed-search.html, filtered-search.html, fragment.html; не додавати raw live HTML.

**Interfaces:** renderRoot(base, sources):string і renderOpenSearch(base, name):string зберігають сигнатури. Використати наявні discovery(base,name), absolute, xml, ACQ. createApp/Catalog/SearchfloorClient не потребують production змін; у тесті ін’єктувати fetch і in-memory Cache після Node24 npm ci.

- [ ] Перед змінами записати BASE=git rev-parse HEAD. Підготувати Node24 та залежності; Node24 runtime prefix у PATH і Node24 запуск npm-cli.js для сумісного native SQLite. Не змінювати lockfile для виправлення локального середовища.
- [ ] Написати RED renderer тести: root зі Searchfloor містить рівно один rel=search з правильними href/type; порожній/unknown-only sources не містить searchfloor OpenSearch. Source/feed/related discovery лишається чинним. Розпарсований template точно дорівнює `https://opds.example/proxy/opds/searchfloor/search?q={searchTerms}&page=1`, без startPage; XML валідний.
- [ ] Написати API integration: authenticated root → OpenSearch → заміна лише searchTerms через encodeURIComponent → acquisition feed → next. Для query «стоев», «за последним порогом» та `А & Б 100% е\u0308` перевірити upstream q після чинної trim/NFC, page1/2, один GET на source page, відсутність дублювання percent encoding. Prefix перевіряти renderer-ом; API requests виконувати на фактичних internal paths без `/proxy` prefix, як reverse proxy routing.
- [ ] У цьому тесті discovery не викликає fetch/Catalog.page; root/OpenSearch/search без Basic або з book-card grant мають401. Перевірити spoofed Host: URLs лише від config. Відсутній page викликає page1; page=,page=0,page=1.5 і page=10001 дають400 без source I/O.
- [ ] Fixtures: mixed search відсіює незавершені книги, зберігає completed IDs і source order; filtered page лишає next навіть без entries; проходження next зберігає query. Не фіксувати17/13 як незмінні live counts.
- [ ] Запустити focused tests до коду й зафіксувати RED через відсутній root discovery/optional template, а не setup/import failure. Для незмінної валідації/auth очікувати GREEN уже до виправлення.
- [ ] У renderRoot додати `discovery(base,'searchfloor')` лише за sources.some(s=>s.name==='searchfloor'). У renderOpenSearch замінити тільки optional page placeholder на literal1; залишити MIME/XML escaping. Без рефакторингу інших renderer/API/source функцій.
- [ ] Focused GREEN; typecheck, build, full Node suite та WSL Python deployment regressions. git diff --check; записати фактичні pass/skip counts і Node версію. Commit: `fix: expose Searchfloor search to FBReader`.

## Task 2: Review, release та phone acceptance

**Files:** Update spec.md status, docs/backlog.md READ-01, docs/fbreader-acceptance.md. Create docs/search-discovery-acceptance.md. No new production code.

**Interfaces:** Task1 зберігає всі публічні сигнатури; цей task використовує лише його перевірений commit і звичайний deployment pipeline.

- [ ] Записати локальне evidence за requirement IDs і провести незалежне whole-branch review згідно з preserved native workflow. Виправити підтверджені findings із відповідною регресією; не називати owner-confirmed foreign-catalogue results доказом server bug.
- [ ] Перед PR виконати застосовний detent-cross-review skill; repo наразі не має detent.json. Не додавати runtime/project policy конфігурацію мовчки заради review tool; якщо CLI потребує окремої конфігурації, зафіксувати limitation та запропонувати конкретний варіант, не вважати review виконаним. Наявний незалежний review лишається окремим gate.
- [ ] Fetch актуальний main, перевірити відсутність неоглянутих змін. Push branch/PR з OPDS-001/002, SOURCE-001, AUTH-001/003 і доказами. Exact-head CI GREEN → звичайний merge/main artifact/timer rollout. Ніяких ручних рестартів, source cache flush чи змін бота.
- [ ] Перевірити actual installed SHA/ready та зберегти точні CI/artifact/release докази. Authenticated root/OpenSearch HTTP evidence отримувати тільки з уже доступними приватними operator credentials, не виводити їх; без доступу чесно лишити цей пункт pending. Один неавторизований401 не доводить коректність XML.
- [ ] Власник оновлює каталог у FBReader і повторює обидва запити. Записати Catalogue: Searchfloor у перевіреній картці, автора/серію та результат. Phone пошук/next позначати PASS лише за фактичним спостереженням; кешований опис каталогу може потребувати refresh/re-add, але не оголошувати це обов’язковим без evidence.
- [ ] Якщо Searchfloor усе ще не бере участі або дає іншу видачу, зіставити фактичний HTTP boundary з sanitized access logs і bounded authenticated server probes. Не міняти source parser/filtering за здогадом і не логувати credentials/query. Зафіксувати неперевірені operator/phone gates окремо від готовності коду.

## Commands and expected results

Команди виконуються з робочої копії під Node24; за відсутності сумісного runtime спочатку розв’язати environment setup, не ослаблювати engines.

- `npm ci --no-audit --no-fund` — exit0 і працездатний native SQLite під Node24.
- `npm run build` та `npm run typecheck` — exit0.
- `node node_modules/vitest/vitest.mjs run tests/feed.test.ts tests/search-discovery-api.test.ts` — RED до виправлення, GREEN після.
- `npm test` — повний suite без failures, counts/skips записані.
- `wsl -d Ubuntu --exec python3 -m unittest discover -s /mnt/c/Projects/search-floor-opds/.superpowers/source-inspection-20261116/tests -p '*_test.py'` — exit0.
- `git diff --check` — exit0.

## Self-review

OPDS-001 discovery/template/URL scenarios → Task1; OPDS-002 query/next/strict page → Task1; SOURCE-001 filtering → existing fixtures; AUTH-001/003 → Task1 auth regression; actual catalogue identity/READ-01/DEPLOY-001 → Task2. Один невеликий behavior PR без супутнього рефакторингу, дві задачі, окремий harness не потрібний. Detent не сконфігурований: project paths і українська мова відповідають AGENTS.md та поточній роботі. Усі п’ять Review Focus мають перевірку. Root spec є єдиною нормативною специфікацією. План погоджений після29e626d; спосіб виконання збережено.
