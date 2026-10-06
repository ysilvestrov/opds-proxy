# OPDS Proxy — OpenSpec

**Статус:** BASELINE ACCEPTED / PRODUCTION ACTIVE.
Власник підтвердив список книг, metadata та завантаження у FBReader на c22ac2e
і погодив фіналізацію бази та налаштування deployment. Production activation,
same-main noop, lock contention і автоматичний timer підтверджено operator-
доказами в docs/production-rollout-report.md; бот працює без рестартів.
**Версія:** 0.6.0 PROPOSED: owner-approved card-resource signed-link design;
AUTH-003 written requirements9c619ff and implementation plan
docs/superpowers/plans/2026-10-06-signed-card-access.md approved by owner;
Local implementation and independent review complete; 111 Node tests pass,
2 Windows-only skips, 57 WSL Python tests pass, build/typecheck pass.
Linux CI, release and device acceptance remain pending.
Installed production remains f76bfac8 with Basic-only card resources.
META-01 design, письмова специфікація та implementation plan
погоджені в чаті. Metadata routes/cache реалізовані локально, findings незалежного
review виправлені з RED/GREEN доказами; Linux CI та server probe пройшли,
device acceptance залишається FAILED (docs/metadata-acceptance.md). Main a553346 CI/package
та production HTTPS health підтверджено; owner META-01 device check FAILED:
десятки секунд на картку, частково відсутній анонс, жодної cover у10 картках.
Скріншоти27223/27505 показують stale, тобто повна Atom-картка відкривається,
але є optional-resource error. Це evidence, не нова норма чи доведена причина;
Серверний probe 2026-10-06 на a553346 підтвердив анонси, image links та
authenticated HTTPS JPEG для27223/27505; докази в docs/metadata-server-diagnostics.md.
Після probe власник підтвердив швидкі картки й анонси, але cover досі відсутня.
META-01 не прийнято; фактичний phone cover request/status ще невідомий.
Read-only observation заблоковано preflight c8a196b: HTTP decoder не встановлено,
capture не запускався; docs/reader-cover-observation-report.md. Запропоновано
Власник погодив постійний sanitized OPDS access log із journal rotation;
попередній default-off180s дизайн замінено цим рішенням (OPS-001).
Access log f76bfac8 встановлено; Linux CI, journal persistence/size-bounded
rotation та phone observation підтверджено operator evidence40436fc.
Картки27223/27505:401→200; усі18 cover requests:401 без200 retry.
Verified boundary: Basic rejection перед cover handler; відсутні/неправильні
credentials журнали не розрізняють. Власник погодив signed links та розширив їх
на всю картку/опис/cover: мета контролю доступу — використання OPDS/proxy traffic,
а не секретність доступних на Searchfloor metadata. AUTH-003 нижче описує
погоджену норму; локальна реалізація перевірена, deployment ще не підтверджено. Серверний200
не доводить доставку чи показ JPEG на телефоні; production не змінено.
Independent source proxy та базовий reader flow прийнято;
розширені device/edge сценарії перенесено в backlog за рішенням власника.
**Дата:** 2026-10-06.
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
`complete`, `observedAt`. META-01 додає окрему модель `BookDetails`:
sourceName/id, optional plain-text summary, optional cover reference з MIME,
`observedAt` для деталей; вона не замінює completion evidence у `Book`.
`EntityRef` має `name` та optional source-local `id`;
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

#### Approved architecture — independent source proxy

Evidence: server branch `codex/server-source-diagnostics`, commit `cffb346`;
`docs/server-source-resolution.md` and server JSONL. Actual Node adapter direct
отримав 403/challenge, через existing WebShare proxy — 200, 20 книг, next=2.
Direct urllib теж отримав 200: blanket VPS-IP ban не доведений. Search і Download
через нові OPDS credentials ще не перевірені. Власник погодив цю модель
та bandwidth policy відповіддю `ok` після review версії0.4.4. Це нормативний
контракт подальшої реалізації, не твердження про вже встановлений transport.

Власник створив окремий WebShare sub-user і має незалежні OPDS credentials.
За повідомленням власника нижчий provider limit ніж 1 GB недоступний. Наданий
екран показує 1.0 GB, actual 5.41 MB і projected 14.69 MB; область статистики
(main account чи sub-user) не встановлена. Ці значення — snapshot, не прогноз
майбутніх OPDS downloads. Proxy secrets у spec/репозиторій не додаються.

Нормативні вимоги source-proxy реалізації (SHALL):
- SOURCE-002 / CONFIG-001: optional `OPDS_SOURCE_PROXY_URL`, лише absolute
  HTTP(S) URL з path empty або `/`, без query/fragment; некоректне задане значення
  відхиляє startup без друку URL/userinfo. Unset зберігає direct для local/tests.
  Поточний VPS deployment конфігурує proxy явно через окремий OPDS env.
- ARCH-001: composition root створює один власний undici ProxyAgent, інжектує
  transport тільки в SearchfloorClient для HTML/Download та META-01 annotation/cover.
  Без global dispatcher,
  HTTP_PROXY на весь процес, впливу на GitHub/deployer чи startup читання bot env.
  ProxyAgent повторно використовується й закривається після bounded shutdown.
- SOURCE-002 / DOWNLOAD-001/002: залишаються всі source queue/spacing/redirect/
  retry/cooldown, HTML/ZIP caps, deadlines, backpressure та cancellation.
  Proxy407/connect failure повертає availability503; без direct fallback,
  cookies, browser, stealth або rotation-on-denial. Провайдер може сам призначати
  exit адреси між з'єднаннями; сервіс не підбирає нову адресу після denial.
- CONFIG-001 / OPS-002: proxy credentials тільки окремого OPDS sub-user у
  root-only prototype/runtime env; не bot credentials. Endpoint/userinfo/password
  не потрапляють у argv, errors/logs, artifacts, Git або кеш. Не потрібен WebShare
  management API key. Bot settings, shared plan і Cloudflare Free не змінюються.
- ACCEPT-001: local mock CONNECT/proxy auth/stream/cancel tests, новий exact-SHA
  Linux artifact і reviewed existing-installation update/rollback; installer
  --apply не повторюється. Спершу окремі credentials перевіряються одним bounded
  GET, потім private prototype search/pagination/one Download/resources/FBReader.
  Production/timer залишаються off до всіх чинних gates.

Сценарії source-proxy контракту (SOURCE-002 / CONFIG-001 / DOWNLOAD-002):

#### Scenario: Configured proxy is unavailable
- **WHEN** configured proxy returns407 or connection fails
- **THEN** the request returns availability503 or eligible stale catalog
- **AND** no direct retry or dispatcher replacement occurs.

#### Scenario: Invalid proxy configuration
- **WHEN** OPDS_SOURCE_PROXY_URL has unsupported scheme, path, query or fragment
- **THEN** startup fails with the field name only
- **AND** endpoint/userinfo/password never enter error output.

#### Scenario: Download through private proxy
- **WHEN** an authenticated reader starts a valid completed-book Download
- **THEN** proxy streaming preserves <=4KiB sniff, <=20MiB/60s limits and backpressure
- **AND** disconnect aborts upstream, releases the slot and sends no proxy credentials to FBReader.

Implementation plan (pending owner plan review): `docs/superpowers/plans/2026-10-05-source-proxy.md`.
Owner spec review completed; implementation/installed behavior remain pending.

#### Scenario: Owner-approved comparison through the existing proxy
- **WHEN** direct-запит серверного клієнта відхилений, а власник погодив proxy experiment
- **THEN** той самий обмежений запит можна виконати через наявний проксі бота
- **AND** звіт містить status/CF-Ray і proxyUsed, без endpoint/credentials
- **AND** успіх не оголошує конкретну WAF-політику чи production-ready proxy integration.


#### Scenario: Source throttles the service
- **WHEN** Searchfloor повертає 429 із Retry-After 60 s
- **THEN** сервіс не робить повтор через 10 s
- **AND** зберігає cooldown на 60 s і повертає доступний stale-кеш або 503.

### Requirement: SOURCE-003 — Provider bandwidth policy

Цю вимогу погодив власник 2026-10-05; реалізація ще не розгорнута.
Provider sub-user ceiling **1 GB** SHALL бути прийнятним
для v1. Це не окремий резерв bandwidth: WebShare враховує трафік у загальному
plan budget. Сервіс SHALL NOT мати власний monthly hard cap/автоматичне
поповнення/paid upgrade/provider management API key у v1.
Provider dashboard SHALL бути authority для billed usage; operator SHALL
зафіксувати scope/cycle/remaining shared і sub-user budget під час prototype
acceptance та перед production. Власник контролює dashboard під час користування.
Cache/one-user/no-crawl/on-demand acquisition залишаються межами навантаження.
Локальні payload bytes MUST NOT оголошуватися точним billing measurement.

#### Scenario: Shared provider quota is exhausted
- **WHEN** WebShare припиняє source access через вичерпання quota
- **THEN** сервіс повертає придатний stale-кеш за CACHE-002 або503
- **AND** Download не робить direct fallback/auto top-up/підбір іншого proxy
- **AND** static OPDS та readiness залишаються незалежними від upstream.

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

Acquisition link type SHALL бути `application/fb2+zip`, щоб FBReader розпізнавав
повний FB2 ZIP як книгу. Download HTTP Content-Type лишається `application/zip`
для raw ZIP payload; filename — `.fb2.zip`. Власник погодив цю зміну 2026-10-05
після скріншотів відсутнього Download: первинний generic ZIP link type не
визначає формат книги для FBReader. Докази: `docs/fbreader-download-diagnosis.md`.
Feed content type:
`application/atom+xml;profile=opds-catalog;kind=acquisition` або `kind=navigation`.
OpenSearch MIME — `application/opensearchdescription+xml`. MIME MUST NOT
стверджувати EPUB. Серія/номер — metadata; окремий browser серій не обов'язковий.

#### Scenario: FBReader recognizes a completed book acquisition
- **WHEN** FBReader відкриває entry завершеної книги
- **THEN** acquisition link має type `application/fb2+zip` і пропонує Download;
  acquisition надсилає private Basic auth, а завантажений ZIP відкривається як FB2.
- **AND** device results записуються окремо від fixture/HTTP перевірок.

#### Scenario: A book title contains XML characters
- **WHEN** title містить кирилицю, `&`, `<` чи лапки
- **THEN** feed є валідним UTF-8 XML і показує вихідний title без XML injection.

### Requirement: OPDS-005 — On-demand complete book entries and artwork

META-01 SHALL додати `/opds/{name}/books/{id}` — standalone Atom entry,
Content-Type `application/atom+xml;type=entry;profile=opds-catalog`.
Listing entry SHALL посилатися на нього через `rel="alternate"` з цим type,
зберігаючи наявний HTML alternate та acquisition. Повна картка SHALL мати
той самий urn ID, title/authors, доступні series metadata, self/start links
та наявний private acquisition. Анонс SHALL бути XML-escaped plain text у
`summary` та `content` з `type="text"`, зі збереженням абзаців; HTML/JS із
джерела не виконується. Порожній анонс не підмінюється site meta description.

Список/пошук SHALL NOT завантажувати деталі кожної книги або запускати фонове
збагачення. Відкриття повної картки MAY отримати базову source card, анонс
і одну обкладинку на cache miss; спільні запити coalesce за source/id/resource.
Попередньо кешовані деталі MAY додаватися до listing без upstream-запитів.
Обкладинки у listing не рекламуватимуться до окремого перегляду eager-fetch
поведінки reader; перша реалізація показує їх через повну картку.

Картка SHALL рекламувати перевірену кешовану обкладинку через
`http://opds-spec.org/image` і `http://opds-spec.org/image/thumbnail`, із
фактичним MIME та HTTPS href `/opds/{name}/books/{id}/cover` із scoped grant
за AUTH-003. Авторизована Basic картка SHALL видавати signed self link та
image/thumbnail links з тим самим book-card grant. Опис уже включений у
summary/content; окремий HTTP endpoint анонсу в цій зміні не додається.
Listing full-entry alternate SHALL залишатися без grant та вимагати Basic:
перше відкриття видає signed links без eager hydration решти списку.
Acquisition, start і решта links SHALL залишатися без metadata grant.
Одна source обкладинка MAY використовуватися для обох relations без resizing;
це не твердження про окрему upstream thumbnail. Cover route SHALL віддавати
JPEG/PNG/GIF з фактичним Content-Type, `X-Content-Type-Options: nosniff`
і `Cache-Control: private, max-age=0, must-revalidate`; public/shared HTTP
кешування авторизованих відповідей заборонене. Кеш сервісу визначає CACHE-003.

Для authorized numeric id (Basic або AUTH-003 grant), відсутнього в базовому кеші,
SHALL виконуватися bounded lookup
картки. Unknown/incomplete/no-Download книга SHALL давати404 без анонсу/cover.
Відомі complete metadata не старші24h MAY використовуватися для відображення;
це не дозвіл завантажити книгу без свіжої перевірки за SOURCE-001.
Виявлена зміна completion SHALL прибрати доступні details/cover для цієї книги.
Помилка необов'язкового ресурсу SHALL пропускати відповідне поле та зберігати
базову картку й acquisition; помилка lookup без придатної бази дає503.
Відомо відсутня cover повертає404; timeout/denial/invalid body дають503/502,
без placeholder bytes або HTML під image MIME. Stale metadata при outage
SHALL явно позначатися в plain-text content і не подовжувати Download eligibility.

#### Scenario: A reader opens an uncached complete entry
- **WHEN** FBReader переходить за Atom alternate зі списку до повної картки
- **THEN** сервіс отримує лише ресурси вибраної книги, показує доступний анонс
  і private image links, не збагачує решту сторінки
- **AND** image запит приймає scoped signed grant без Basic за AUTH-003;
  фактичне відображення перевіряється
  у FBReader Android3.8.31, а не виводиться з валідності XML.

#### Scenario: Optional source metadata is unavailable
- **WHEN** анонс порожній/404 або cover відсутня/невалідна/недоступна
- **THEN** базова картка залишається доступною без відповідного optional поля
- **AND** acquisition і його окрема перевірка завершеності не змінюються.

#### Scenario: Invalid or unknown source-specific metadata request
- **WHEN** source name невідомий або id не відповідає numeric book ID
- **THEN** API повертає404/400 відповідно без довільного URL чи upstream-запиту.

### Requirement: SOURCE-004 — Bounded annotation and cover transport

Searchfloor SHALL використовувати фіксовані same-origin шляхи
`/api/annotation/{id}` та `/cover/{id}` для перевіреного numeric ID.
Card MAY містити inline анонс; за його наявності окремий annotation request
не потрібен. Card selector `#annotation`/`data-url` SHALL перевірятися без
виконання script; довільний data-url не дозволений. Generic meta description
не є анонсом. Ресурси SHALL використовувати той самий окремий source proxy,
queue/concurrency/spacing, redirects/retry/cooldown за SOURCE-002; без
browser automation, JS execution, external image origins чи proxy fallback.

Annotation cap SHALL бути64KiB decoded response bytes, timeout15s;
API annotation SHALL мати text/plain та валідний UTF-8. Inline text extraction
SHALL зберігати абзаци та не включати scripts/styles. Cover cap SHALL бути2MiB
decoded bytes, timeout15s; Content-Type і JPEG/PNG/GIF signature MUST збігатися.
HTML/challenge, SVG та непідтримувані формати відхиляються. Ліміти SHALL
перевірятися під час читання, навіть без Content-Length; body при перевищенні
скасовується. Source cookies/userinfo/довільні клієнтські URL не додаються.

Evidence 2026-10-06: bounded PC GET `/b/27047` та публічних scripts без execution
показав annotation data-url і inline `bookCoverImage.src = "/cover/27047"`;
GET annotation повернув200 text/plain,745B; HEAD cover —200 image/jpeg,46924B.
Це evidence одного ID/локального direct доступу, не гарантія всіх книг,
signature validation, server-proxy доступу або сумісності з reader.

#### Scenario: Source serves HTML instead of artwork
- **WHEN** cover response має image MIME, але body містить HTML/challenge
- **THEN** body не кешується і не віддається як обкладинка
- **AND** базова картка залишається доступною без image links.

#### Scenario: Source redirects an optional resource outside Searchfloor
- **WHEN** annotation або cover перенаправляє на інший origin
- **THEN** запит відхиляється за SOURCE-002 без надсилання proxy/source secrets.

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
поверх HTTPS. Full-entry/cover SHALL приймати валідний Basic або scoped signed
book-card grant за AUTH-003. Якщо обидва механізми невалідні/відсутні,
response SHALL давати401 і Basic challenge без source/cache-resource access.
Config без пароля або username MUST завершувати startup з помилкою.
Порівняння credentials SHALL бути constant-time за fixed-length digests.
Пароль MUST NOT потрапляти в URL, logs, fixtures, spec, artifact або кеш.
Cloudflare browser-login не SHALL вважатися сумісним без перевірки.
Інший fallback auth не впроваджується без окремого рішення власника.
Власник2026-10-06 погодив signed URLs для всіх ресурсів картки: metadata є
публічними на джерелі, а мета gateway auth — контроль використання трафіку.

#### Scenario: FBReader uses acquisition separately from catalog browsing
- **WHEN** користувач запускає Download після успішного перегляду каталогу
- **THEN** Download також проходить auth
- **AND** acceptance підтверджує передавання credentials конкретною версією FBReader.

### Requirement: AUTH-003 — Password-revoked signed access to book-card resources

Full-entry та cover GET/HEAD SHALL підтримувати signed grant без HTTP Basic.
Grant scope SHALL бути одна книга конкретного source та лише exact paths
`/opds/{name}/books/{id}` і `/opds/{name}/books/{id}/cover`. Source v1 SHALL
бути тільки searchfloor; canonical positive numeric id SHALL відповідати
`[1-9][0-9]{0,19}` (без leading zero).
Grant SHALL NOT авторизувати root/feed/search/OpenSearch/Download, іншу книгу,
інший source, довільний URL чи майбутній resource route автоматично.

Авторизований Basic full-entry response SHALL видавати grant без time expiry.
Grant SHALL бути HMAC-SHA256 signature versioned, unambiguous tuple
`[1,"book-card",source,id]`. Signing key SHALL бути domain-separated від Basic
credential comparison та derived як HMAC-SHA256(current password UTF-8,
fixed purpose label `opds-book-card-key-v1`). Нова env-secret/dependency не потрібна.
HTTPS URL SHALL мати один `sig` query parameter: canonical unpadded base64url
32-byte signature (43 characters). Duplicate/malformed/noncanonical/tampered
signature SHALL відхилятися до доступу до ресурсів; порівняння fixed-length
signature bytes SHALL бути constant-time. Expiry/issuance parameters та
server-side grant/session storage не потрібні.

Валідний Basic зберігає current bounded lookup/resource-fetch behavior.
Без валідного Basic валідний grant SHALL працювати навіть за наявності
невірного Basic header. Grant-authorized requests SHALL використовувати той
самий Catalog/details/cover flow, cache freshness, completion validation,
bounded upstream fetch/retry/concurrency/queue/cooldown/proxy та resource budgets,
що й Basic-authorized requests за SOURCE-001/002/003/004 і CACHE-001/002/003.
Cache miss/expiry/eviction MAY отримувати ресурси тільки цієї книги із джерела;
це не authorization для crawl/search/list чи довільного URL. Опис SHALL бути
включений у full-entry summary/content без додаткового Basic. Unknown/incomplete
book, optional absence та source errors SHALL мати звичайні OPDS-005 status/
stale semantics; cache miss сам по собі не SHALL давати404 або вимагати Basic
для відновлення кешу. Signing validity не змінює metadata TTL<=24h чи budget.

Full-entry SHALL використовувати поточний book-card signature у self/image links.
Grant SHALL працювати без часу expiry до зміни password; restart, cache clear
чи username-only change за незмінного password SHALL не анулювати його.
Password change SHALL анулювати всі попередні grants після runtime activation
нового password, без окремого списку revoked links. Повернення до старого
password відновлює відповідні старі signatures — це deterministic password-
derived design без окремого generation secret; operator rollback не приховує це.
Валідний grant не SHALL змінювати book completion/Download freshness.
Basic та valid grant відкриття картки MAY заповнити bounded cache. Невалідний
grant після password change потребує fresh Basic відкриття для нових links.

Basic password MUST NOT бути в URL. Signed URLs є scoped bearer permission,
і доступ отримувача посилання до цієї картки до password change прийнятий власником.
Grant/raw query MUST NOT потрапляти в app logs, errors, Git, receipts чи cache;
cache зберігає ресурси, а не serialized signed responses. Full-entry SHALL
мати private,no-store та Referrer-Policy:no-referrer; image headers OPDS-005
зберігаються. Це не гарантія відсутності URL у reader/intermediary storage.
Нових Cloudflare features, платних сервісів чи bot-resource changes немає.

#### Scenario: Reader image client fails to authenticate with Basic
- **WHEN** FBReader відкриває Basic-authorized card та запитує її signed cover
  без валідного Basic credentials
- **THEN** valid grant авторизує cover handler без Basic challenge і може
  отримати missing cover через звичайний bounded Catalog flow
- **AND** device artwork display перевіряється окремо від HTTP200.

#### Scenario: A shared card URL includes its description and artwork
- **WHEN** GET/HEAD full-entry містить valid book-card grant без Basic
- **THEN** card metadata/summary та signed image links видаються через Catalog flow
- **AND** Download/root/search не авторизуються цим grant; time expiry немає.

#### Scenario: A signed resource was evicted from cache
- **WHEN** request має valid signature, але card/artwork ще не cached або expired/evicted
- **THEN** Catalog виконує bounded lookup/resource fetch для цієї книги без Basic
- **AND** source outage/unknown/incomplete/optional absence зберігає OPDS-005 semantics.

#### Scenario: Password rotates or a grant is changed
- **WHEN** signature/book/source змінено або password changed і activated
- **THEN** без independently valid Basic request отримує401 до resource access
- **AND** restart/username-only change за незмінного password зберігають grant validity.

#### Scenario: An old password is restored during rollback
- **WHEN** operator активує попередній password замість нового
- **THEN** signatures цього password знову valid за deterministic key derivation
- **AND** post-change permanent revocation потребує нового password, а не rollback.

### Requirement: AUTH-002 — Owner-selected single-user credentials

Власник SHALL мати приватну інтерактивну operator-команду для зміни логіна
й пароля єдиного Basic користувача. Це не реєстрація додаткових акаунтів
і не зміна протоколу AUTH-001. Пароль вводиться приховано двічі; credentials
MUST NOT передаватися через argv/URL/чат чи потрапляти в stdout/logs/Git.
Логін/пароль відповідають чинним CONFIG-001 межам; control characters не
приймаються через формат EnvironmentFile. Запам'ятовування credentials між
перезапусками FBReader не гарантується сервером; власник прийняв restart prompt.

Operator SHALL змінювати лише OPDS_USERNAME/OPDS_PASSWORD у root-only
mode0600 runtime.env та deploy.env, зберігаючи інші значення (зокрема proxy/token).
Зміна SHALL вимагати idle settled production, inactive deploy-service і deploy
lock; конфігурація не змінюється під час pending deployment/recovery.
Таймер зупиняється й persistently disables до завершення; попередній enabled/
active стан повертається після успіху або перевіреного rollback. Лише OPDS
перезапускається. Readiness/static Basic XML перевіряються locally/HTTPS без
upstream/book requests; старі credentials після успіху SHALL давати401.

До запису SHALL створюватися приватна root-only резервна копія обох файлів
і маркер pending. При помилці обидва файли відновлюються, OPDS перезапускається
та перевіряється зі старими credentials. Невдалий rollback залишає таймер
вимкненим і backup/marker для оператора. Hard crash не обіцяє automatic recovery;
повторна ротація з pending marker MUST бути відхилена до operator recovery.
Deployment state/current/cache, prototype credentials, бот і Cloudflare не змінюються.

#### Scenario: New credentials work while provider/deploy secrets stay unchanged
- **WHEN** власник вводить власні Basic username/password у приватному терміналі
- **THEN** runtime/deploy Basic пара узгоджена, новий login працює, старий відхиляється
- **AND** proxy/token та інша конфігурація зберігаються; timer повертається до попереднього стану.

#### Scenario: Second config write or post-restart check fails
- **WHEN** конфіги частково записано або новий login не проходить перевірку
- **THEN** обидва початкові файли відновлюються й старий login перевіряється
- **AND** timer відновлюється лише після успішного rollback; pending deployment не переривається.

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

SQLite SHALL містити лише відновлювані metadata/query results та cover cache
за CACHE-003, без повних книг,
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

### Requirement: CACHE-003 — Separate detail freshness and bounded artwork cache

BookDetails та covers SHALL кешуватися окремими versioned source/id/resource
keys у наявній OPDS SQLite, TTL24h від фактичного отримання. List refresh
MUST NOT перезаписувати багатші details чи їх observedAt; metadata refresh
MUST NOT оновлювати completion observedAt. Cover JSON MAY містити base64
і MIME; це recoverable artwork, не файл книги. Не вводяться нові writable
шляхи, systemd permissions, env secrets, backup чи cache warmup.

Cover values SHALL мати окремий LRU бюджет64MiB serialized values, включений
у загальні128MiB/10,000keys CACHE-001; base64 overhead SHALL враховуватися.
DB+WAL target256MiB не збільшується. Одна cover decoded<=2MiB. Cache reset
та rollback SHALL працювати за CACHE-002; несумісний кеш перебудовується.
Evicted cover MAY бути отримана на вимогу без збагачення списку.

SQLite user_version SHALL залишатися1; початкова п'ятиколонкова `cache`
таблиця сумісна зі старим runtime. Artwork membership SHALL зберігатися в
auxiliary таблиці з pruning orphan keys; бюджети рахують лише live cache rows.
Package manifest cacheSchemaVersion залишається1 і відповідає runtime.
Evidence/reason: review META-01 виявив, що схема2 суперечила manifest1 та
installed deployer, який приймає лише1. Це сумісне розширення дозволяє
ordinary app update/rollback без ручної зміни deployer. Validated inline
annotation при card lookup SHALL зберігатися в resource cache навіть коли
перший запит був cover; наступна картка не губить анонс через API404.

Успішні empty annotation і source404 optional ресурсу SHALL кешуватися як
явна відсутність на15min, окремо від неперевіреного ресурсу. Timeout/403/429/
5xx/invalid body SHALL NOT кешуватися як відсутність. Придатні details/cover
не старші24h MAY використовуватися при outage; старші SHALL не віддаватися.
Після optional error базова картка MAY повернутися негайно; наступний явний
запит повторює лише відсутній ресурс через чинні queue/cooldown limits.

#### Scenario: List refresh follows detail enrichment
- **WHEN** книга має кешований анонс і cover, а список оновлює її базові поля
- **THEN** details/cover та їх TTL зберігаються до expiry/eviction
- **AND** timestamp деталей не робить прострочений Download дозволеним.

#### Scenario: Artwork reaches its budget
- **WHEN** нова cover перевищує64MiB serialized cover budget або загальний limit
- **THEN** LRU eviction зберігає обидва бюджети; базовий каталог може
  перебудуватися на вимогу без завантаження всіх covers.

#### Scenario: Several readers request the same uncached cover
- **WHEN** active callers одночасно запитують ту саму source/id cover
- **THEN** виконується один bounded upstream fetch; cancel одного caller
  не скасовує операцію для інших, shutdown залишається bounded.

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
Кожен OPDS request SHALL створювати один structured access event після
завершення application handler, включно з Basic401,404 та error responses.
Event SHALL містити лише фіксовану назву, allowlisted method/route, numeric
book ID довжиною<=20 за наявності, HTTP status, elapsed milliseconds та
outcome response_created/aborted. Невідомі routes/methods SHALL використовувати
фіксовані unknown/OTHER, а не raw strings. Pino timestamp додає час події.
Headers, URLs/query, usernames/IP/User-Agent, arbitrary exceptions та payloads
MUST NOT логуватися. Handler timing/status не SHALL означати завершення
передавання body або отримання/показ image на телефоні. Request logging SHALL
бути постійним без activation flag, packet capture або нових dependencies.
Storage/rotation SHALL використовувати наявний stdout/journald; оператор MUST
перевірити фактичні retention/disk limits та persistence. Глобальні journal
settings, vacuum й ресурси/логи бота MUST NOT змінюватися в рамках цього кроку.
Непідтверджені journal limits SHALL залишатися явним operator-pending gate.

#### Scenario: Reader artwork receives an authentication challenge
- **WHEN** cover request отримує401, а retry отримує200
- **THEN** кожна відповідь має окремий access event з тим самим book ID/route
- **AND** жодні credentials/headers/image bytes не записані.

#### Scenario: Request contains sensitive or unrecognised input
- **WHEN** query, header, method чи path містить довільний приватний текст
- **THEN** access event містить лише allowlisted fields і fixed fallback labels
- **AND** raw input і exception messages не потрапляють у logs.

#### Scenario: Origin responds but reader still does not show artwork
- **WHEN** cover access event має status200 та outcome response_created
- **THEN** підтверджено відповідь application handler, а не body delivery/decoding
- **AND** phone attribution потребує узгодженого owner-only observation window.
SIGTERM SHALL stop accepting, cancel queued work, drain active transfers
до 15 s, потім abort і close SQLite; TimeoutStopSec — 25 s.

#### Scenario: Searchfloor is unavailable during deploy health check
- **WHEN** source недоступне, але root/static XML та локальний cache працюють
- **THEN** readiness успішна і deployer не відкочує працездатний реліз лише через source outage.

### Requirement: DEPLOY-001 — Exact-SHA artifact release

Окремий pull timer SHALL перевіряти main кожні 5 min.
Перший запуск SHALL плануватися через 2 min після активації самого timer
(`OnActiveSec=2min`), наступні — через 5 min після завершення deploy-service
(`OnUnitInactiveSec=5min`), з randomized delay до 15 s. Повторне ввімкнення
timer після зупинки SHALL створювати наступну подію навіть за наявності
persisted trigger timestamp і відсутності inactive timestamp deploy-service.
Main після green CI означає дозвіл на звичайний application release. До activation MUST
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

#### Scenario: Operator repeats completed or pending initial rollout
- **WHEN** production active/settled або deployment pending
- **THEN** initial rollout helper refuses before mutating the existing timer.

#### Scenario: Operator interrupts the systemctl deployment client
- **WHEN** the client stops but its deploy-service may still be running
- **THEN** prototype restoration requires a nonblocking deploy lock and inactive deploy-service
- **AND** the state/port decision and restoration remain under that lock; busy/active deployment is preserved.

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
Для початкової baseline власник 2026-10-05 явно прийняв робочий flow:
список книг → базова інформація → завантаження у FBReader Android3.8.31.
Це закриває базовий reader gate для першого production release. Search/next,
empty-page-with-next, interruption/retry та окреме file-open спостереження
SHALL залишатися явно неперевіреними device-сценаріями в `docs/backlog.md`;
вони не блокують baseline promotion за уточненим рішенням власника. Source/
Download caps, приватна авторизація й автоматичні regressions не послаблюються.
CI MUST NOT масово опитувати Searchfloor. Owner acceptance SHALL фіксувати
OS/version, дату, фактично перевірені сценарії й відкладені перевірки,
без паролів/тексту книг. Bootstrap/автодеплой
SHALL мати окремі фактичні докази; unit tests не є доказом встановлення.
Виміри RSS/CPU/cache+WAL/two releases SHALL бути збережені для поточного
capacity check і майбутнього окремого переїзду.

#### Scenario: Tests pass but reader or bootstrap has not been checked
- **WHEN** автоматичні перевірки успішні, а клієнтський тест чи встановлення не виконано
- **THEN** звіт називає відповідну частину неперевіреною/підготовленою
- **AND** не стверджує, що сервіс працює у FBReader або на сервері.

#### Scenario: META-01 reader acceptance remains unverified
- **WHEN** fixture/mock tests підтвердили full-entry/summary/images/auth/cache,
  але власник ще не відкрив реальну повну картку у FBReader Android3.8.31
- **THEN** META-01 залишається device-pending; базове приймання не означає
  підтримки нового Atom alternate або Basic forwarding для cover
- **AND** потрібні bounded server-proxy annotation/cover probe та device check
  анонсу, обкладинки, повторного відкриття, книги без optional полів і Download;
  failure не обходиться публічним image URL або eager hydration без нового review.

#### Scenario: Owner accepts the initial working baseline
- **WHEN** власник підтверджує список, metadata та завантаження і просить
  вважати поточний стан базою, а крайові сценарії додати до наступного плану
- **THEN** базовий reader gate прийнято, а відкладені device-сценарії залишаються
  відкритими в backlog без вигаданих Pass
- **AND** production timer вмикається лише після green-main artifact,
  фактичного deployment/rollback evidence та production health перевірки.

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

### Additional acceptance evidence, 2026-10-05 13:59 UTC

Exact e57f0a6 proxy artifact locally passed readiness/Basic/static XML. First
public urllib check returned403; finite own-host diagnostics reproduced
Cloudflare1010 for genuine urllib versus502 for genuine curl at the stopped
origin. This concerns inbound operator-client acceptance, not source transport.
Rollback restored16cc521/pre-proxy env; production/timer and bot preserved.
Future operator verification explicitly selects genuine system curl, without
UA spoofing, automatic fallback or Cloudflare changes. Requirements unchanged;
Searchfloor dedicated GET previously passed, Download/reader still pending.
Evidence: docs/proxy-prototype-update-report.md and associated JSONL.

### Latest server acceptance evidence, 2026-10-05 14:19UTC

Exact e57f0a6 passed dedicated sub-user GET and subsequent operator private
local/public Basic/XML/OpenSearch, completed/search/one next, one435050B ZIP/FB2
in-memory validation. Full-file branch only; live cancellation/FBReader/protected
empty-page fixture pending. New prototype current/config retained, unit stopped;
production/timer off, bot healthy/NRestarts0. Raw measurements and independent
final-state evidence are in docs/proxy-prototype-update-report.md. Dashboard
actual usage after remains pending. No app source, limits or requirements changed.

Main dashboard usage after:5.88MB (prior5.41MB); main delta не доводить окремий
OPDS billing. Separate sub-user usage after не надана. Тимчасове artifact staging
прибрано після перевіреного запуску; immutable code/evidence/unmerged work збережено.

### Credential customization acceptance, 2026-10-06

AUTH-001/002 operator rotation and owner FBReader login passed on b15970c.
Evidence: docs/change-opds-credentials-report.md, server commit eaf3837.
Runtime/deploy Basic pair changed privately; old-pair401/local/HTTPS/static checks
passed, timer restored. Bot PID/NRestarts unchanged; OPDS restarted once as
expected for rotation. No credentials or credential fingerprints in Git/chat.
This closes credential usability acceptance, not persistence after reader restart
or the postponed device edge scenarios. No normative requirement changed.
