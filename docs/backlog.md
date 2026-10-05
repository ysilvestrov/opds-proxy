# Backlog після приймання бази

База: поточний c22ac2e prototype; власник підтвердив список книг, інформацію
та завантаження у FBReader Android3.8.31. Root spec.md лишається єдиною
нормативною специфікацією. Цей backlog — черга для обговорення, не дозвіл
на реалізацію кожної ідеї й не друга spec. Пріоритети технічних пунктів попередні.

| ID | Пріоритет | Робота | Критерій готовності |
|---|---|---|---|
| DEP-01 | P0 зараз | Фіналізувати baseline, main release та production автодеплой | Green exact-SHA main artifact; one-time activation; timer enabled після deployment/rollback evidence |
| READ-01 | P1 | Пошук і query-preserving next у FBReader | Реальні device результати search/next, без повного crawl |
| READ-02 | P1 | Порожня відфільтрована сторінка з next | Protected fixture навігується у FBReader, немає public test route |
| READ-03 | P1 | Перервати Download і виконати fresh GET | Тунель/слот звільняються, повторне завантаження працює |
| READ-04 | P1 | Окремо зафіксувати відкриття FB2 ZIP та auth prompts | Device evidence; не виводити це лише з download success |
| OPS-01 | P1 | Спостереження ресурсів під звичайним користуванням | RSS/CPU/cache/WAL, shared-plan та sub-user usage; не прирівнювати ZIP bytes до billing |
| AUTH-01 | P1 до публічного розширення | Оцінити throttling невдалого Basic auth | Перевірити фактичний front-end захист; не припускати Cloudflare rate limit; design/spec перед зміною |
| UX-01 | P2 | Зрозумілі повідомлення для 404/429/502 | Коди незмінні, тексти без секретів; окрема погоджена зміна |
| OPS-02 | P2 | Розрізняти безпечні abort/timeout diagnostics | Зберегти sanitization; не пропускати native socket/endpoint causes |
| DOC-01 | P2 | Скоротити HTML fixtures та історичні reports | Зберегти contract cases й provenance, не переписувати artifact history |
| IDEAS | Не визначено | Ідеї/зауваження власника | Спершу зібрати список, потім узгодити порядок та критерії |

P0 — завершення поточного етапу. P1 — наступна надійність/приймання.
P2 — невеликі покращення, які не блокують погоджену базу.
Автори/жанри зарезервовані в архітектурі, але автоматично не додаються до
scope наступного релізу. Нові джерела та спільний переїзд VPS — окремі рішення.

Review PR1: no blocking runtime findings. Abort/deadline suggestions не
вимагають повернення raw errors; `/health` без auth відповідає OPS-001;
порожній OPDS_SOURCE_PROXY_URL навмисно invalid (прибрати рядок для direct).
