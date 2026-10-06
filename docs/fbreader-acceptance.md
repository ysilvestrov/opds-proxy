# FBReader acceptance — baseline accepted

Production continuation, 2026-10-05: main CI/release identity and isolated
deployment rollback verifier passed. Root production activation/timer await
operator `deploy/production-rollout.sh`; evidence is in
`docs/production-rollout-report.md`. Reader baseline acceptance is retained.

Власник 2026-10-05 явно підтвердив: завантажується список книг, можна побачити
базову інформацію і завантажити книгу. Поточний стан погоджено як baseline.
Target: FBReader for Android3.8.31; installed prototype c22ac2e6edafeba1563d88363326b2bd19cbb097.
Root spec.md0.4.8 / ACCEPT-001 фіксує це приймання та перенесення крайових
device-сценаріїв у docs/backlog.md. Production deployment/rollback gates окремі.

| Сценарій | Фактичний результат |
|---|---|
| Каталог і список книг | PASS — підтверджено власником |
| Базова інформація про книгу | PASS — підтверджено власником |
| Книга пропонує Download і завантажується | PASS — підтверджено власником після MIME correction |
| Приватний HTTPS/Basic і acquisition links | Server PASS; окремі device auth prompts не описані |
| Відкриття FB2 ZIP після download | Не підтверджено окремо; READ-04 |
| Search і next зі збереженням query | Device pending; READ-01 |
| Empty filtered page with next | Device pending; READ-02, protected fixture |
| Переривання й повторне завантаження | Device pending; READ-03 |

Owner confirmation не підміняє неперевірені рядки автоматичним Pass.
Core flow прийнято; ці device edge cases не блокують baseline promotion за
рішенням власника. Source limits, ZIP cap, deadline, cancellation й auth
залишаються чинними й покриті fixture/local CONNECT tests.

Серверні докази: docs/proxy-prototype-update-report.md (dedicated OPDS proxy,
HTTPS/search/one next та435050B ZIP/FB2 in-memory), docs/fbreader-mime-update-report.md,
docs/fbreader-mime-acceptance-passed.jsonl і docs/fbreader-mime-cleanup.json.
Application MIME correction: acquisition application/fb2+zip; raw HTTP application/zip.
Раніше відсутній Download виправлено на c22ac2e, користувацьке приймання закрито
поточним повідомленням власника. Попередні installation/403/MIME failed стани
зберігаються як історія в перелічених reports і не описують поточну базу.

Endpoint: https://opds.ysilvestrov-ai.uk/opds. Використовувати наявні окремі
Basic credentials без паролів у URL/чаті/reports. Переходячи у production,
зберегти hostname, credentials і provider transport; cache можна перебудувати.

Production promotion завершено2026-10-06: main d66216c, наявні hostname/Basic/
незалежний provider proxy збережено. Local/HTTPS auth/static, справжній
deployment/60s observation, same-main noop/lock і автоматичний timer підтверджено
в docs/production-rollout-report.md. Це серверні докази; відкладені device
сценарії вище залишаються pending і не позначаються Pass.

2026-10-06: після зміни єдиної OPDS Basic пари власник підтвердив
«все працює» у відповідь на перевірку входу у FBReader з новими credentials.
Device login прийнято; credentials не передавалися в чат/Git. Звіт:
docs/change-opds-credentials-report.md. Persistence між наступними restart
та раніше відкладені edge cases цим підтвердженням не перевірені.
