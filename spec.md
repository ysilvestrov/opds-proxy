# OPDS Proxy — OpenSpec

**Статус:** APPROVED DESIGN / IMPLEMENTATION IN PROGRESS — власник погодив
специфікацію з namespace searchfloor та продовження реалізації; prototype
встановлено й зупинено після upstream 403, production не активовано.
**Версія:** 0.4.4. **Дата:** 2026-10-05. Source-proxy delta нижче — pending review.
**Репозиторій:** https://github.com/ysilvestrov/opds-proxy.

## 1. Призначення та авторитет документа

Приватний OPDS-каталог для одного користувача FBReader: останні завершені
книги Searchfloor, upstream-пошук, пагінація й завантаження повного FB2 ZIP.
Сервіс розгортається поряд із Warsaw Beer Bot на чинному Hetzner-сервері.
Переїзд обох сервісів на новий VPS — окремий проєкт.

Цей кореневий файл є єдиною нормативною специфікацією. Формат адаптовано
до обраного власником одного `spec.md`: OpenSpec Markdown Requirements,
SHALL/MUST та перевірні WHEN/THEN сценарії. Це не твердження про наявність
CLI-layout `openspec/` або проходження OpenSpec CLI validation.
Ідентифікатори вимог зберігаються при редагуванні. Нові сценарії не замінюють старі.

Вхідні матеріали, які не дублюють нормативний авторитет:
- `docs/basic-plan.md` — погоджений дизайн і межі задачі;
- `docs/server-audit.md` — докази стану чинного сервера;
- `docs/superpowers/plans/2026-10-04-opds-proxy.md` — порядок реалізації;
- `docs/source-contract.md` і `docs/fbreader-acceptance.md` — майбутні результати перевірок.

### Requirement: SPEC-001 — Specification governs every change

Проєкт SHALL звіряти проектування, код, тести та deployment зі `spec.md`.
Зміна архітектури, зовнішньої поведінки, API, конфігурації або інваріантів
MUST оновлювати відповідні вимоги та сценарії в тому самому PR, що й код.
Плани й тести SHALL бути узгоджені з новою специфікацією. Розбіжність
із кодом не SHALL автоматично перетворюватися на нову вимогу.

#### Scenario: A design decision changes acquisition behavior
- **WHEN** нове рішення змінює формат, авторизацію або передавання книги
- **THEN** виконавець оновлює відповідні requirement IDs і сценарії до завершення зміни
- **AND** PR вказує ці IDs та докази відповідності; реалізація не спирається лише на історію чату.

## 2. Scope та архітектура

Поза поточним scope: повний локальний індекс, зберігання книг, EPUB-конвертація,
платна підписка, Telegram-інтерфейс, публічний каталог, Redis/Docker,
оновлення системного Node та перенесення бота.

Потік: `FBReader → HTTPS / Cloudflare Tunnel → Hono → Catalog → SQLite / Searchfloor`.
Acquisition проходить через той самий приватний HTTP-сервіс, але файл
передається потоком і не записується до кешу.

| Компонент | Відповідальність | Залежності |
|---|---|---|
| Composition root | Перевірка config, створення залежностей, запуск/зупинка | Config, logger, cache, client, API |
| Searchfloor parser | HTML → типізовані книги/next; без мережі | DOM, передані час і номер сторінки |
| Searchfloor client | HTTP, origin, ліміти, queue/backoff | Fetch, parser, clock |
| Catalog | Кеш запитів/книг, свіжість та придатність Download | Cache, client, clock |
| OPDS renderer | Root, acquisition XML, OpenSearch | Типізовані дані й зовнішній base URL |
| HTTP API | Auth, validation, маршрути, streaming, помилки | Catalog, renderer, client, config |
| Deployer | Exact-SHA artifact, activation, health, rollback | GitHub read access, filesystem, fixed restart helper |

### Requirement: ARCH-001 — Independent service boundaries

Сервіс SHALL працювати як окремий Node 24 / TypeScript strict процес,
із Hono, cheerio, SQLite/WAL, p-queue, zod, pino та Vitest.
I/O SHALL бути відокремлене від чистого парсингу/форматування; залежності
передаються з composition root. Config MUST читатися й валідуватися один раз.
OPDS MUST NOT використовувати процес, БД, секрети, lock/state або unit бота.
Каталог, пошук і acquisition SHALL виконуватися суто на сервері, без залежності
від увімкненого персонального ПК, домашнього агента чи ручного імпорту для
звичайного користування. Поточне місце — чинний Hetzner-хост; інший deployment
чи source transport потребує окремого перегляду цієї специфікації.

#### Scenario: OPDS fails or restarts
- **WHEN** OPDS завершується аварійно чи перезапускається
- **THEN** бот не перезапускається, його DB/state не змінюються
- **AND** усі writable шляхи OPDS належать його окремим каталогам.

#### Scenario: Personal computer is offline
- **WHEN** персональний ПК власника вимкнений або не має інтернету
- **THEN** це не впливає на роботу server-side каталогу, пошуку й acquisition
- **AND** доступність Searchfloor залишається окремою upstream-залежністю.

## 3. Джерело та моделі

Origin: `https://searchfloor.org`. Відомі маршрути: завершений список
`/?status=is_finished&page=N`, пошук `/search?q=Q&page=N`, Download `/book/{id}`,
картка `/b/{id}`. Download path береться з перевіреної картки, не з довільного
клієнтського URL. Query-фільтр пошуку `status=is_finished` не є доказом завершеності.
Контракт 2026-10-04 підтвердив, що цей фільтр ігнорується у mixed-status search.
HTTP 404 search SHALL трактуватися як порожній результат лише після перевірки
коректного HTML з явним marker `Ничего не найдено`; довільний 404 — помилка.
Card title може бути plain text без `/b/` link; див. docs/source-contract.md.

Модель `Book`: `sourceName`, `id`, `title`, `authors[]`, optional `summary`, `series`,
`seriesPosition`, `authorRefs[]`, `genres[]`; `sourceUrl`, `downloadPath`,
`complete`, `observedAt`. `EntityRef` має `name` та optional source-local `id`;
authorRefs/genres зарезервовані для майбутнього парсингу, їх наповнення у v1
не обов'язкове. Відсутні поля означають невідомі metadata, не відсутність автора/жанру.
ID — числовий ідентифікатор джерела як string, не назва.
`SourcePage`: `books[]`, `nextPage: number|null`, `observedAt`.
`CatalogPage`: SourcePage + `stale: boolean`; observedAt не змінюється на cache hit.

### Requirement: SOURCE-001 — Complete and downloadable books only

Сервіс SHALL показувати лише книги з явно встановленою завершеністю
та доступним Download. Unknown/«в процесі» MUST NOT трактуватися як complete.
Parser SHALL приймати повну сторінку та HTML-фрагмент пагінації,
дедуплікувати ID, розрізняти валідний порожній результат і помилку структури.
Перед Download статус SHALL бути повторно підтверджено, якщо остання
перевірка старша за 15 хвилин. Metadata TTL 24 год не подовжує це право.

#### Scenario: Search returns mixed statuses
- **WHEN** upstream повертає завершені, незавершені та невідомі статуси
- **THEN** каталог містить лише явно завершені книги з Download
- **AND** користувач не може завантажити відкинуту книгу через ручне введення ID.

#### Scenario: Old metadata during source outage
- **WHEN** completion evidence старша за 15 хвилин і джерело недоступне
- **THEN** stale-каталог може відображатися за CACHE-002
- **AND** Download повертає помилку доступності, не використовує прострочене підтвердження.

### Requirement: SOURCE-002 — Bounded source access

HTML-запити SHALL мати 2 MiB cap, 15 s timeout, concurrency 1 та мінімум
1 s між стартами запитів. Допускається максимум один retry на 429/5xx,
із затримкою не більш ніж 10 s, включно з Retry-After. Довший Retry-After
SHALL завершувати поточний запит і встановлювати cooldown, без раннього повтору.
403/challenge/login wall SHALL бути помилкою без автоматичного обходу.
Queue SHALL мати максимум 20 очікуваних запитів і 30 s wait deadline;
перевищення повертає 503. Redirect SHALL бути manual, максимум 3 hops,
тільки HTTPS і той самий origin; DNS/мережеві обмеження не обходяться.

Окремий diagnostic spike MAY порівняти direct-доступ із наявним проксі бота,
що власник явно погодив 2026-10-05. Використовуються тільки цей проксі та
звичайні HTTP-клієнти, без ротації адрес, stealth або challenge solving.
Proxy URL/credentials SHALL залишатися лише в пам'яті/приватному environment,
без argv, logs, Git чи звітів. Діагностика MAY використати тільки наявні
proxy connection settings; інші секрети/дані бота не читаються, його конфігурація
та процес не змінюються. Це вузький виняток для діагностики ARCH-001,
не дозвіл використовувати секрети бота у production OPDS. Production proxy
transport потребує окремої конфігурації/перегляду spec та deployment.

#### Proposed architecture delta — source proxy (awaiting owner review)

Докази 2026-10-05: `docs/source-experiments-server-http.jsonl` і
`docs/source-experiments-server-proxy.jsonl`. Actual Node adapter direct отримав
403/challenge, через погоджений existing proxy — 200 і parse 20 книг/next=2.
Direct urllib також отримав 200, тому blanket VPS-IP ban не встановлено.
Це перевірений diagnostic candidate, не deployed source transport.

**Наведене нижче є пропозицією для review, не чинним config/API contract.**
Після схвалення цього delta та implementation plan:

- SOURCE-002: optional `OPDS_SOURCE_PROXY_URL` дозволятиме лише явно
  configured HTTP(S) proxy. Один reuse dispatcher на процес для Searchfloor
  HTML і Download; без rotation-on-denial, automatic direct fallback, cookies,
  browser/stealth чи глобальної зміни fetch dispatcher. Усі поточні spacing,
  concurrency, queue, redirect/origin, retry/cooldown і cap/deadline зберігаються.
- CONFIG-001 / ARCH-001 / OPS-002: окремі OPDS proxy credentials у власному
  root-only env, ніколи bot env на startup; URL/endpoint/пароль не логуються.
  Operator спочатку перевіряє доступний provider budget та виділяє окремий
  sub-user/ліміт у наявному плані без зміни bot settings чи paid upgrade.
- DOWNLOAD-001/002: той самий dispatcher передає streaming Response з
  backpressure й AbortSignal; ZIP sniffing <=4 KiB, <=20 MiB і 60 s зберігаються.
  Proxy407/connect failure — source availability failure, без direct fallback.
  Денial/challenge зупиняє запит, не запускає пошук іншого exit IP.
- ACCEPT-001: потрібні local mock proxy/stream/cancel тести, exact-SHA Linux
  artifact, окремий operator review/config крок і existing-installation
  validation із per-request durable evidence до FBReader. Поточний installed
  pinned artifact/current/config не змінюються цією пропозицією.

Implementation plan: `docs/superpowers/plans/2026-10-05-source-proxy.md`.
До review немає дозволу на retained application implementation або
постійне використання bot proxy credentials. Budget/credentials і review —
конкретні невиконані prerequisites наступного етапу.

#### Scenario: Owner-approved comparison through the existing proxy
- **WHEN** direct-запит серверного клієнта відхилений, а власник погодив proxy experiment
- **THEN** той самий обмежений запит можна виконати через наявний проксі бота
- **AND** звіт містить status/CF-Ray і proxyUsed, без endpoint/credentials
- **AND** успіх не оголошує конкретну WAF-політику чи production-ready proxy integration.


#### Scenario: Source throttles the service
- **WHEN** Searchfloor повертає 429 із Retry-After 60 s
- **THEN** сервіс не робить повтор через 10 s
- **AND** зберігає cooldown на 60 s і повертає доступний stale-кеш або 503.

## 4. Каталог і протокол

### Requirement: OPDS-001 — Atom catalog and search discovery

Сервіс SHALL реалізувати OPDS 1.2 Atom XML, а не OPDS 2 JSON.
`/opds` — navigation root зі списком увімкнених джерел;
`/opds/{name}` — navigation root конкретного джерела;
`/opds/{name}/completed?page=N` та `/opds/{name}/search?q=Q&page=N` — acquisition feeds;
`/opds/{name}/opensearch.xml` — OpenSearch Description Document.
Feed SHALL мати id/title/updated, коректні XML namespaces і escaping,
self/start і next, коли він існує. Entry ID SHALL бути
`urn:opds:{name}:book:{id}`; acquisition href —
`/opds/{name}/books/{id}/download.fb2.zip`, rel — `http://opds-spec.org/acquisition`.
Посилання SHALL бути абсолютними від PUBLIC_BASE_URL, не від Host header.
Global start — `/opds`; source root доступний через collection/up navigation.

Acquisition MIME у першому прототипі — `application/zip`; зміна за доказом
FBReader потребує оновлення цієї вимоги. Feed content type:
`application/atom+xml;profile=opds-catalog;kind=acquisition` або `kind=navigation`.
OpenSearch MIME — `application/opensearchdescription+xml`. MIME MUST NOT
стверджувати EPUB. Серія/номер — metadata; окремий browser серій не обов'язковий.

#### Scenario: A book title contains XML characters
- **WHEN** title містить кирилицю, `&`, `<` чи лапки
- **THEN** feed є валідним UTF-8 XML і показує вихідний title без XML injection.

### Requirement: OPDS-003 — Source namespace and future adapters

Усі source-specific public routes SHALL мати префікс `/opds/{name}/`.
У v1 єдине name SHALL бути **`searchfloor`**, відповідно до назви сайту;
воно відображається на adapter для `https://searchfloor.org`.
Невідоме name SHALL давати 404, не довільне upstream URL і не fallback
до Searchfloor. Source registry SHALL зіставляти name з configured adapter,
не створювати adapter із клієнтського вводу. Інші джерела не реалізуються у v1.
Ідентичність книги, feed та cache keys MUST включати name, щоб source-local IDs
різних майбутніх джерел не конфліктували.

#### Scenario: Reader browses the v1 catalog
- **WHEN** клієнт відкриває `/opds`
- **THEN** отримує одне джерело з посиланням `/opds/searchfloor`
- **AND** його search/next/acquisition links зберігають цей namespace.

#### Scenario: Reader requests an unknown source
- **WHEN** клієнт відкриває `/opds/unknown/search?q=book`
- **THEN** отримує 404 без upstream-запиту та без доступу до Searchfloor-кешу.

### Requirement: OPDS-004 — Reserved author and genre discovery

Схема SHALL резервувати source-local entity IDs та наступні public маршрути:
`/opds/{name}/authors`, `/opds/{name}/authors/{authorId}`,
`/opds/{name}/genres`, `/opds/{name}/genres/{genreId}`.
Майбутня реалізація SHALL дозволяти adapter парсити entities і отримувати
завершені книги автора/жанру через той самий Catalog/OPDS path.
У v1 ці capabilities disabled: парсинг entity index, entity-фільтри та
публікація відповідних feeds не потрібні. Зарезервовані маршрути SHALL
повертати 404 та MUST NOT рекламуватися у feeds/OpenSearch як робочі.
Authors metadata у книгах залишається обов'язковою частиною доступних даних;
author browser не є умовою відображення author names.

#### Scenario: Author browsing is not yet implemented
- **WHEN** клієнт запитує `/opds/searchfloor/authors` або `/opds/searchfloor/genres/123`
- **THEN** отримує 404 без додаткового crawl
- **AND** джерело показує доступні каталоги v1 без неробочих navigation links.

### Requirement: OPDS-002 — Source pagination remains navigable

Query SHALL бути trimmed, максимум 200 Unicode code points; page — integer
1..10000. Некоректні параметри повертають 400. Source pagination SHALL
зберігатися після локального відсіювання; next URL MUST зберігати query.
Сервіс MUST NOT виконувати необмежений crawl для заповнення сторінки.

#### Scenario: A filtered search page has no complete books
- **WHEN** поточна upstream-сторінка містить лише неповні книги, але має next
- **THEN** feed може мати нуль entries, але зберігає next
- **AND** не позначає це як кінець результатів. Цей випадок входить у FBReader acceptance.

## 5. Приватність та acquisition

### Requirement: AUTH-001 — Private access on every acquisition path

Root/feed/search/OpenSearch/download SHALL вимагати окрему HTTP Basic auth
поверх HTTPS. Неправильні/відсутні credentials SHALL давати 401 і Basic challenge.
Config без пароля або username MUST завершувати startup з помилкою.
Порівняння credentials SHALL бути constant-time за fixed-length digests.
Пароль MUST NOT потрапляти в URL, logs, fixtures, spec, artifact або кеш.
Cloudflare browser-login не SHALL вважатися сумісним без перевірки.
Fallback auth не впроваджується без окремого рішення власника.

#### Scenario: FBReader uses acquisition separately from catalog browsing
- **WHEN** користувач запускає Download після успішного перегляду каталогу
- **THEN** Download також проходить auth
- **AND** acceptance підтверджує передавання credentials конкретною версією FBReader.

### Requirement: DOWNLOAD-001 — Validate before streaming

Сервіс SHALL приймати лише numeric book ID та перевірений same-origin
Download path для complete Book. Unknown ID/відсутній файл — 404;
неповна/недоступна книга — 404; неможлива перевірка джерела — 503.
Payload SHALL мати ZIP signature та сумісний MIME (ZIP або octet-stream,
якщо контракт підтвердить його). До відправлення файлових headers можна
буферизувати максимум 4 KiB для sniffing, зберігаючи всі bytes для передавання.
HTML/challenge/порожнє тіло SHALL давати 502, не файл книги.

#### Scenario: Download endpoint returns HTML 200
- **WHEN** upstream повертає challenge або сторінку замість ZIP
- **THEN** клієнт отримує 502 до файлових headers, а HTML не зберігається як книга.

### Requirement: DOWNLOAD-002 — Bounded streaming and cancellation

Download SHALL передаватися з backpressure без повного буфера/запису книги,
з максимумом 20 MiB, 60 s total deadline після початку upstream fetch та
однією одночасною передачею. Зайнятий slot — 429. Перевищення відомого
Content-Length відхиляється до початку; невідомий/занижений розмір контролюється
за отриманими bytes. Після початку потоку помилка SHALL переривати передачу,
не дописувати JSON у ZIP. Client disconnect SHALL abort upstream і звільняти slot.
Response SHALL мати `.fb2.zip` filename, безпечний Content-Disposition із
UTF-8 filename*, Cache-Control private/no-store. Range не підтримується:
запит із Range може отримати повний 200, без реклами Accept-Ranges.

#### Scenario: Reader disconnects halfway through a book
- **WHEN** клієнт закриває з'єднання
- **THEN** upstream скасовується і slot звільняється незалежно від завершення source response.

## 6. Кеш та конфігурація

### Requirement: CACHE-001 — Disposable bounded SQLite cache

SQLite SHALL містити лише відновлювані metadata/query results, без книг,
секретів і deployment-state. List/search TTL — 15 min, metadata TTL — 24 h.
Key SHALL включати sourceName, нормалізований query, page, filter і schema version.
Однакові concurrent reads SHALL coalesce; cancel одного caller не скасовує
операцію для інших активних callers. Помилки не кешуються як порожній список.
LRU/expiry SHALL обмежувати кеш 10,000 keys і 128 MiB serialized live values.
DB+WAL target — 256 MiB; це не жорстка filesystem quota. Pruning/checkpoint
SHALL обмежувати накопичення, а фактичний disk footprint вимірюється.

#### Scenario: Several readers request the same cold page
- **WHEN** запити з однаковим cache key виконуються одночасно
- **THEN** відбувається один upstream request, результат доступний усім active callers.

### Requirement: CACHE-002 — Rebuild and bounded stale results

Відсутній/несумісний/пошкоджений кеш SHALL перебудовуватися на вимогу, без
Litestream, backup restore чи масового warmup. Reset MUST закрити handles
і працювати лише з власними DB/WAL/SHM; максимум один quarantined cache.
Filesystem permission/full-disk errors не SHALL маскуватися повторними reset:
startup/readiness повідомляє несправність. Під час upstream outage page
не старша за 24 h від observedAt може повертатися зі stale subtitle.
Без придатного кешу — 503, не «книг немає».

#### Scenario: Cache is missing after restart
- **WHEN** процес стартує без DB
- **THEN** створюється порожня схема, root і health працюють без Searchfloor
- **AND** перший source-запит заповнює лише потрібну сторінку.

#### Scenario: Old release starts with incompatible cache
- **WHEN** код відкочено і cache schema не підтримується
- **THEN** власний кеш відкидається й перебудовується, без відновлення БД бота.

### Requirement: CONFIG-001 — Explicit configuration

Config SHALL валідуватися один раз і передаватися залежностями.
Обов'язкові: PUBLIC_BASE_URL (HTTPS зовнішній origin/base path),
OPDS_USERNAME, OPDS_PASSWORD, CACHE_PATH. PORT default — 8787;
listener MUST бути `127.0.0.1`. Secrets зберігаються окремо від releases/cache.
Timeout/size/cache значення цього spec є defaults, зміна їхньої семантики
або default SHALL відображатися тут. Unknown settings MUST NOT непомітно
розширювати права чи дозволені upstream origins.

#### Scenario: External base URL is absent or HTTP
- **WHEN** config не містить валідного HTTPS PUBLIC_BASE_URL
- **THEN** production startup завершується з повідомленням без секретів.

## 7. Операції та deployment

### Requirement: OPS-001 — Readiness, logging and bounded shutdown

`/health` SHALL повертати readiness та release SHA без секретів, auth не
обов'язкова для цього мінімального endpoint. Readiness означає валідний config,
відкритий writable cache та готовий HTTP; upstream outage не робить процес
несправним. Logs SHALL бути structured stdout/journald із redaction auth,
password/cookies; query text та повні source responses за замовчуванням не логуються.
SIGTERM SHALL stop accepting, cancel queued work, drain active transfers
до 15 s, потім abort і close SQLite; TimeoutStopSec — 25 s.

#### Scenario: Searchfloor is unavailable during deploy health check
- **WHEN** source недоступне, але root/static XML та локальний cache працюють
- **THEN** readiness успішна і deployer не відкочує працездатний реліз лише через source outage.

### Requirement: DEPLOY-001 — Exact-SHA artifact release

Окремий pull timer SHALL перевіряти main кожні 5 min. Main після green CI
означає дозвіл на звичайний application release. До activation MUST
перевірятися required CI workflow/jobs саме на candidate SHA; missing/pending/
failed checks блокують реліз. Workflow identity фіксується deployment config,
не вибирається за довільним green check. Ready Linux artifact SHALL містити
dist, production dependencies та внутрішню identity metadata для SHA,
Node major 24, CPU architecture/libc/ABI і cache schema version.
Checksum archive SHALL бути поза archive (без самопосилального hash).
Artifact/run origin і checksum SHALL перевірятися; checksum сам по собі
не замінює перевірку довіреного GitHub workflow/run.

Для ACCEPT-001 CI SHALL також робити artifact `opds-prototype-{sha}` після
усіх checks на push у погоджену робочу гілку `feat/opds-v1`. Production artifact
має ім'я `opds-release-{sha}` лише на main; production-deployer MUST NOT приймати
prototype artifact або non-main run. Prototype запускає оператор вручну з
перевіреного exact-SHA Linux artifact, без build/npm ci на сервері.

Production SHALL розпаковувати staging artifact без npm ci/build.
Installed deployer використовує Node 24 і Python >= 3.12 stdlib для безпечної
перевірки/розпакування ZIP-wrapper і tar; runtime Python не потребує.
Початковий CI target — Ubuntu 24.04 x64/glibc, Node 24.19.0. Host MUST
збігатися за CPU/Node ABI та мати glibc не старішу за artifact; невідповідність
блокує activation і потребує зміни CI target, не build на сервері.
Archive traversal/небезпечні links SHALL відхилятися. Перед activation
candidate SHA SHALL ще збігатися з main. Windows native build не придатний.

#### Scenario: Artifact and candidate disagree
- **WHEN** artifact має інший SHA/ABI/architecture або checksum не збігається
- **THEN** deployment завершується без зміни current і restart production.

### Requirement: DEPLOY-002 — Serialized activation and recovery

Deployer SHALL мати незалежні lock/state/PAUSED, immutable releases і atomic
current switch. Після restart він SHALL перевіряти health/static root XML
із початковим startup grace до 15 s, а потім спостерігати безперервні 60 s
успішних перевірок до settled SHA. Початковий connection refusal не означає
негайну невдачу; outage чи NRestarts change під час healthy window — невдача.
Зберігаються current і previous settled
release; невдалий кандидат не стає settled. Crash між switch/state update
SHALL бути reconciled наступним tick, без припущення про успішний реліз.
Rollback SHALL restart тільки OPDS; несумісний кеш очищається лише після
зупинки OPDS. First release без previous при невдачі залишається failed,
не позначається здоровим. Fetch errors мають bounded backoff;
runtime-failed SHA не повторюється без explicit rearm або нового SHA.
PAUSED зупиняє нові ticks, але не перериває незавершену recovery.
Невдалий rollback SHALL залишати phase=rollback для наступної recovery;
повернення до settled state потребує health/static XML перевірки baseline.
Deployer SHALL прибирати failed/orphaned releases після persisted rollback
і на idle ticks (під тим самим lock), зберігаючи settled/previous та не
видаляючи candidate під час pending activation/recovery.

#### Scenario: Candidate fails after current switch
- **WHEN** candidate не проходить startup/health window
- **THEN** попередній settled release відновлюється, failed SHA записується окремо
- **AND** бот не змінюється, а старий код працює з придатним чи новим порожнім кешем.

### Requirement: OPS-002 — Reviewed one-time host bootstrap

Bootstrap SHALL встановлювати окремі accounts `searchfloor-opds` (runtime)
і `searchfloor-deploy`, root-owned unit/deployer/helper та вузькі права restart
лише фіксованого OPDS unit. Runtime MUST NOT змінювати code/deployer/sudoers;
deploy-user MUST NOT змінювати privileged helper. Installed infrastructure
не оновлюється автоматично з application artifact. Secrets/config/unit/tunnel
зміни потребують operator-кроку із конкретними reviewable файлами.

Шляхи: `/opt/searchfloor-opds/{staging,releases,current}`,
`/etc/searchfloor-opds`, `/var/lib/searchfloor-opds/cache`,
`/var/lib/searchfloor-opds-deploy/{state,lock}`. Запропонований hostname
`opds.ysilvestrov-ai.uk` налаштовано 2026-10-05 у наявному тунелі
`hetzner-vps` → `http://127.0.0.1:8787`; API/DNS докази —
`docs/cloudflare-route-report.md`. Перед повторним налаштуванням перевірити
наявний mapping, перед запуском — порт 8787. Наявний beer-api route не змінюється.
Початкові unit budgets: runtime MemoryHigh=256M, MemoryMax=384M,
CPUQuota=50% одного CPU, TasksMax=64; deployer MemoryMax=768M,
CPUQuota=100%, concurrency 1. Це проектні defaults, не вимір потреб сервісу.
Ліміти SHALL переглядатися за runtime/latency вимірами зі зміною spec.

#### Scenario: Operator reviews deployment setup
- **WHEN** код і bootstrap готові до встановлення
- **THEN** оператор отримує конкретні unit/helper/права/route та rollback procedure
- **AND** встановлення не використовує широку sudo shell-команду чи секрети бота.

## 8. Приймання та фактичний стан

Latest operator evidence, 2026-10-05 09:07–09:10 UTC:
`docs/prototype-report.md`. Prototype code/current/config та infrastructure
встановлено оператором; exact-SHA readiness/native/cache startup відбулися.
Basic/static XML перевірки описані за порядком helper execution; незалежний
per-request JSON порожній, тому повного доказу приймання немає. Live completed
feed повернув 503. Один matching Node upstream GET 2026-10-05 09:08 UTC
підтвердив HTTP 403 та `CF-Mitigated: challenge` від Searchfloor Cloudflare.
Конкретне правило й причина його спрацювання невідомі; постійна заборона
автоматизованого доступу не доведена. Наш inbound tunnel/WAF це не виправляє.
Прототип зупинений; production/timer disabled, bot health 200/NRestarts=0
за звітом. Не повторювати install --apply. Наступні кроки: погоджений доступ
до джерела, виправлення збереження проміжних HTTP-доказів і окрема перевірка
вже встановленого прототипу; без обходу SOURCE-002.
`docs/source-access-request.md` — чернетка для власника, не надіслана.
Власник 2026-10-05 відхилив звернення й попросив інший шлях. Один matching
GET з desktop ПК о 09:26 UTC отримав HTTP 200 без challenge headers/маркерів
у перших 16 KiB. Повний парсинг/Download цим не доведені. Власник відхилив локальний deployment:
сервіс має працювати суто на сервері (ARCH-001). Звичайний серверний браузер
розглядається лише як діагностична гіпотеза; production transport не змінено.
Cloudflare не підтримує automated browsers для проходження production challenges;
успіх headless Chromium не припускається. Діагностичний кандидат описано в
`docs/codex-cli-server-browser-feasibility.md`.
Власник погодив локальні/WSL експерименти перед серверним продовженням.
2026-10-05 10:39–10:44 UTC: Windows і WSL Linux Node24 actual client,
Linux urllib/curl HTTP1.1/2 та Windows headless Chrome отримали 200.
Actual client розібрав 20 книг, next=2. Синтетичний upstream403 відтворює
client/API503 без повторів; реальна відмова VPS локально не відтворена.
Докази: `docs/local-source-experiments-20261005.md`. Це не доводить причину
WAF-рішення чи відновлення VPS. Наступна погоджена діагностика —
`docs/claude-server-source-experiments.md`; source transport не змінено.
Історичні статуси uninstalled нижче не описують останній operator result.

### Requirement: COST-001 — Preserve Cloudflare Free and approve bill increases

Проєкт SHALL зберігати поточний Cloudflare Free tier. Перед конфігурацією чи
операцією, яка з великою ймовірністю збільшить місячний рахунок Cloudflare,
виконавець MUST отримати окремий явний дозвіл власника та пояснити можливі
платежі: subscription, usage rates і відповідні ліміти. Ціни/ліміти SHALL
перевірятися за актуальними офіційними умовами конкретного сервісу.
Операції без оплати за умовами сервісу або з очевидно малим обсягом
трафіку/транзакцій у безкоштовному allowance можна виконувати в межах
погодженої специфікації без додаткового billing approval. Малий обсяг не
скасовує мінімальну плату за платну subscription. Безкоштовна операція не
скасовує інших обмежень щодо доступу, безпеки та ресурсів бота.

#### Scenario: Add the OPDS hostname to the existing free tunnel
- **WHEN** актуальні умови підтверджують безкоштовний Tunnel/hostname route
- **THEN** виконавець може налаштувати погоджений OPDS route без нового billing approval
- **AND** не вмикає платні add-ons чи upgrade плану в рамках цього кроку.

#### Scenario: A proposed Cloudflare change may increase the monthly bill
- **WHEN** зміна ймовірно додає subscription або usage charges
- **THEN** виконавець пояснює платежі та запитує окремий дозвіл до активації
- **AND** відсутність відповіді не означає згоду.

### Requirement: ACCEPT-001 — Evidence before completion

Початковий private HTTPS prototype SHALL передувати production activation.
Інфраструктуру для цього контрольованого тесту можна підготувати до успішного
FBReader acceptance: `searchfloor-opds-prototype.service`, read-only код у
`/opt/searchfloor-opds/prototype/{sha,current}`, writable
`/var/lib/searchfloor-opds/prototype-cache`, окремий root-only
`/etc/searchfloor-opds/prototype.env`. Prototype SHALL мати ті самі runtime
budgets/Basic/loopback-only поведінку, без timer/boot enablement, production
current/state та доступу до ресурсів бота. Port 8787 не SHALL використовуватися
двома OPDS units одночасно; оператор перевіряє їхній стан перед запуском.
Production timer MUST залишатися вимкненим до приймання та deployment evidence.

Release SHALL пройти test/typecheck/build, fixture/mock contract tests,
Linux native-module load check та клієнтський FBReader acceptance.
CI MUST NOT масово опитувати Searchfloor. Owner acceptance SHALL фіксувати
OS/version, дату, root/search/mixed statuses/empty page with next/Download/open,
Basic auth і MIME behavior, без паролів/тексту книг. Bootstrap/автодеплой
SHALL мати окремі фактичні докази; unit tests не є доказом встановлення.
Виміри RSS/CPU/cache+WAL/two releases SHALL бути збережені для поточного
capacity check і майбутнього окремого переїзду.

#### Scenario: Tests pass but reader or bootstrap has not been checked
- **WHEN** автоматичні перевірки успішні, а клієнтський тест чи встановлення не виконано
- **THEN** звіт називає відповідну частину неперевіреною/підготовленою
- **AND** не стверджує, що сервіс працює у FBReader або на сервері.

### Аудитні факти, не гарантії

За `docs/server-audit.md`, 2026-10-04 22:14 Europe/Warsaw: Ubuntu 24.04.4,
Node 24.19.0; 4 CPU, 7.6 GiB RAM; близько 6 GiB available RAM, 34 GiB disk,
2.09 млн free inode у короткому вимірі. Code-server MemoryPeak — 5.91 GiB.
Це не peak capacity proof. Port 8787 був вільний. Cloudflared token-managed
та bot health працювали. Searchfloor повертав реальні completed/search HTML,
HEAD одного Download — ZIP MIME. Аудит не змінював production.

За `docs/prototype-report.md`, 2026-10-04 22:17–22:19 UTC: exact-SHA
prototype artifact перевірено та staged; фактичні x64/glibc 2.39/Node ABI 137
сумісні з manifest. Infrastructure syntax/dry-run успішні. Встановлення
не виконано через sandbox sudo (`no new privileges`), DNS candidate hostname
повернув NXDOMAIN, tunnel mapping неперевірений. Bot health залишився 200,
NRestarts=0. Native runtime на хості, HTTPS і FBReader ще не перевірено.
Staged reader fixture XML не має serving route; його захищене обслуговування
залишається невиконаним кроком приймання. Ці факти не змінюють вимоги.

### Обов'язкові непідтверджені перевірки

1. Варіації MIME/розміру інших книг і серверний GET лишаються неперевіреними;
   один локальний GET ZIP/FB2 успішний, докази в docs/source-contract.md.
2. При зміні DOM потрібно нове evidence; mixed-status search, fragment,
   empty marker і одна картка підтверджені fixtures 2026-10-04.
3. Ціль від власника: FBReader for Android 3.8.31 (2026-10-04).
   Basic forwarding, ZIP MIME/open та empty-page next ще не перевірені;
   результати приймання фіксуються в docs/fbreader-acceptance.md.
4. Main отримано з origin; CI workflow ID 374905819 і exact-SHA Linux prototype
   artifact підтверджено в docs/linux-ci-evidence.md. Production-main artifact
   та доступ із серверного deploy-user ще не перевірені.
5. Встановлення bootstrap виконано оператором; root ownership не підтверджено
   незалежним stat із sandbox, який показує mapped ownership. Cloudflare route/DNS
   створено й перевірено 2026-10-05; external 401/authenticated XML після
   фактичного запуску залишаються неперевіреними (docs/cloudflare-route-report.md).
   Platform/ABI сумісність підтверджена звітом підготовки; перед фактичним
   запуском повторно перевіряються сумісність, стан units та вільний порт.

Ці перевірки не блокують огляд design, але блокують відповідні твердження
про готовність. Якщо доказ змінює вимогу — спочатку оновлюються spec і план.
