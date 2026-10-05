# Продовження встановлення приватного прототипу

Стан за `docs/prototype-report.md`: артефакт перевірений і підготовлений,
але сервіс, credentials і HTTPS ще не встановлені. Перевірки відбулися
2026-10-04 22:17–22:19 UTC (2026-10-05 00:17–00:19 Europe/Warsaw).
Цей бріф продовжує Task 6, не дозволяє production activation чи ввімкнення timer.
Вимоги: ARCH-001, AUTH-001, CONFIG-001, DEPLOY-001, OPS-002, ACCEPT-001.

## Що потрібно від оператора

1. Сесія на сервері, у якій дозволене встановлення через sudo.
   Попередній CLI працював із `no new privileges`, тому повтор того самого
   `sudo` в тому самому sandbox нічого не встановить. Використати штатний
   механізм схвалення привілейованої команди, якщо середовище CLI його надає;
   інакше виконати підготовлені операторські кроки у звичайній SSH-сесії.
   Не змінювати захист sandbox чи системну sudo-конфігурацію для обходу обмеження.
2. Доступ власника до наявного Cloudflare Tunnel: перевірити колізії та додати
   лише `opds.ysilvestrov-ai.uk` → `http://127.0.0.1:8787`.
   Зберегти всі існуючі маршрути. Запити FBReader мають доходити до Basic auth
   сервісу без інтерактивного browser-login. NXDOMAIN не доводить відсутність
   маршруту в dashboard. Цей URL ще не є робочим каталогом.

## Бріф для серверного Codex CLI

Продовжуй із `/home/ysi/opds/opds-proxy-prototype`. Прочитай AGENTS.md, spec.md,
docs/prototype-report.md, docs/codex-cli-prototype.md і цей файл. Не повторюй
весь аудит: повтори перевірки, які можуть змінитися перед встановленням.

- Зафіксуй bot health/NRestarts, стан production OPDS/deployer/timer і порт 8787.
  Зупинись при колізії, активному production/deployer/timer або enabled timer.
  Prototype unit має Conflicts із production: не запускай його до цієї перевірки.
- Перевір операторські файли й dry-run; установи infrastructure через
  `sudo bash deploy/bootstrap.sh --apply`, тільки за наявності дозволеного sudo.
  Bootstrap нічого не запускає. Збережи наявні env-файли.
- Заново звір CI/run/artifact identity, expiry, обидва SHA256, safe extraction
  і host manifest за таблицею у prototype-report.md. Application SHA залишається
  `16cc521448bbb792aa74594cf7c1c1def5ae16f9`, artifact ID `11316800751`.
  Не підмінюй його поточним HEAD чи новим артефактом. Наявний staging:
  `/home/ysi/opds/prototype-staging-16cc521`; локальні файли можуть змінюватися.
- Виконай описане у звіті immutable встановлення лише в prototype/<sha>,
  root-owned/readable tree і атомарний prototype/current; відмовся від колізій
  та symlink targets. Не запускай код артефакту як root і не збирай його на хості.
- Підготуй лише root:root/0600 `/etc/searchfloor-opds/prototype.env` із
  HTTPS base URL, портом 8787, prototype-cache та окремими credentials.
  Створи й передай пароль власнику через захищений канал; не пиши його у
  звіт, URL, аргументи команд чи історію shell. Production env залишити як є.
- Після повторної перевірки колізій запусти вручну лише prototype unit.
  Перевір readiness exact SHA, локальні 401/Basic challenge, авторизовані
  XML/MIME/absolute links, native/cache startup; після маршруту Cloudflare
  повтори HTTP-перевірки через HTTPS. Credentials для перевірок читати в пам'ять,
  не передавати пароль через `curl -u` в argv. Пошук/completed перевірити обмежено.
- Запиши RSS/CPU/cache+WAL/SHM, bot before/after та фактичні HTTP результати
  у звіт. Лише після успіху надай власнику перевірений `/opds` URL і спосіб
  приватно отримати credentials для базових кроків FBReader acceptance.
- При відсутності sudo чи доступу до Tunnel зупини тільки залежні кроки та
  поверни конкретні команди/дію для оператора. Не оголошуй deployment успішним.
  Production/timer залишаються вимкненими; після контрольного тесту prototype
  зупиняється за наявним бріфом.

## Окремий незавершений пункт приймання

Підготовлені `reader-fixture/page-1.xml` і `page-2.xml` не обслуговуються
артефактом. `/reader-fixture/...` зараз не є робочим route. Не додавай для них
незахищений static origin чи маршрут Cloudflare навмання. Окреме захищене
обслуговування fixture ще треба реалізувати й перевірити до тесту
empty-page-with-next. Це не заважає запустити основний прототип і перевірити
навігацію, пошук та Download, але повне ACCEPT-001 поки залишається Pending.
