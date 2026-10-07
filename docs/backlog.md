# Backlog після приймання бази

База: поточний c22ac2e prototype; власник підтвердив список книг, інформацію
та завантаження у FBReader Android3.8.31. Root spec.md лишається єдиною
нормативною специфікацією. Цей backlog — черга для обговорення, не дозвіл
на реалізацію кожної ідеї й не друга spec. Пріоритети технічних пунктів попередні.

| ID | Пріоритет | Робота | Критерій готовності |
|---|---|---|---|
| DEP-01 | Завершено 2026-10-06 | Baseline, main release та production автодеплой | Exact-SHA d66216c; deployment/rollback/lock evidence; timer enabled, 14 automatic noop без runtime/bot рестартів; docs/production-rollout-report.md |
| AUTH-02 | Завершено 2026-10-06 | Власні Basic логін/пароль, зручні для введення на телефоні | Rotation і FBReader login прийнято; timer restored, бот без рестартів; docs/change-opds-credentials-report.md, eaf3837. Restart prompt лишається прийнятним |
| META-01 | Основний флоу підтверджено; edge checks відкриті | Анонс і обкладинка з картки книги | OPDS-005/AUTH-001/003;1a3781a installed, owner confirms visible/loading covers; earlier fast cards/annotations confirmed; independent review and CI passed; separate signed HTTP receipts, cold-cache/restart and other unobserved edge gates remain open; docs/metadata-acceptance.md |
| META-02 | Основний флоу прийнято; layout розгорнуто | Жанри та обсяг тексту | Owner/screenshot2026-10-07 confirms genre tags, compact volume, synopsis and cover on3e660df; volume after annotation installed as5efa8ef, health ready; OPDS-006 updated; new position phone result and unobserved reader edges remain open |
| LINKS-01 | Реалізовано локально; release/reader gates відкриті | Related links на автора та серію | Owner approved spec afterad101ee and plan afterd1b4d1e;154 Node tests pass,2 skips. Single-page snapshots, compact completion, local pages/cache, Basic-only feeds. Review/CI/install/FBReader outcomes remain separate; docs/related-links-acceptance.md |
| READ-01 | P1 | Пошук і query-preserving next у FBReader | Реальні device результати search/next, без повного crawl |
| READ-02 | P1 | Порожня відфільтрована сторінка з next | Protected fixture навігується у FBReader, немає public test route |
| READ-03 | P1 | Перервати Download і виконати fresh GET | Тунель/слот звільняються, повторне завантаження працює |
| READ-04 | P1 | Окремо зафіксувати відкриття FB2 ZIP та auth prompts | Device evidence; не виводити це лише з download success |
| OPS-01 | P1 | Спостереження ресурсів під звичайним користуванням | RSS/CPU/cache/WAL, shared-plan та sub-user usage; не прирівнювати ZIP bytes до billing |
| AUTH-01 | P1 до публічного розширення | Оцінити throttling невдалого Basic auth | Перевірити фактичний front-end захист; не припускати Cloudflare rate limit; design/spec перед зміною |
| UX-01 | P2 | Зрозумілі повідомлення для 404/429/502 | Коди незмінні, тексти без секретів; окрема погоджена зміна |
| OPS-02 | P2 | Розрізняти безпечні abort/timeout diagnostics | Зберегти sanitization; не пропускати native socket/endpoint causes |
| DOC-01 | P2 | Скоротити HTML fixtures та історичні reports | Зберегти contract cases й provenance, не переписувати artifact history |

DEP-01 закрито за operator receipts 725051f. P1 — наступна надійність/приймання.
P2 — невеликі покращення, які не блокують погоджену базу.
AUTH-02/META-01/META-02/LINKS-01 записані зі слів власника 2026-10-05;
причини та джерело полів ще не перевірені. Пропонований порядок після DEP-01:
META-01, META-02, LINKS-01 (AUTH-02 завершено); edge checks READ-01–04 виконувати поряд
із відповідними змінами. Це план обговорення, не підтвердження причин проблем.
Власник підтвердив, що зазначені metadata/related fields відображаються на
Флібусті: це reader reference для OPDS mapping, а не доказ полів Searchfloor.
LINKS-01 проєктує переходи на конкретного автора/серію; загальні author/genre
indexes залишаються reserved/disabled. Нові джерела та спільний переїзд VPS — окремі рішення.

Review PR1: no blocking runtime findings. Abort/deadline suggestions не
вимагають повернення raw errors; `/health` без auth відповідає OPS-001;
порожній OPDS_SOURCE_PROXY_URL навмисно invalid (прибрати рядок для direct).
