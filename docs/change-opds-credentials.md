# Власний логін і пароль OPDS

**Виконано та прийнято 2026-10-06:** owner-selected credentials і вхід у FBReader
підтверджено в `change-opds-credentials-report.md` (eaf3837). Нижче — процедура
для майбутньої свідомої ротації; повторний запуск зараз не потрібен.

AUTH-001/002, CONFIG-001, DEPLOY-002, OPS-002. Погоджений bounded design:
2026-10-06. Зміна credentials виконується оператором у приватному терміналі
сервера. WebShare/GitHub token не змінюються.

Серверний Claude/Codex: отримати reviewed main у чистому OPDS checkout;
не скидати dirty checkout, не повторювати bootstrap/rollout. Перевірити hash
команди зі злитим PR і показати власнику одну команду в цьому checkout:

```bash
bash deploy/change-opds-credentials.sh
```

Виконати без sudo prefix у приватному інтерактивному терміналі. Ввести sudo
password, новий OPDS логін і новий пароль двічі. Пароль прихований; не вставляти
його в чат, аргументи команд, URL або agent reports. Можна вибрати пароль із
кількох запам'ятовуваних слів, зручний для введення на телефоні. Не використовувати
пароль іншого сервісу. Username без двокрапки; порожні/control values відхиляються.

Команда бере deploy-lock, відмовляє при active/pending deployment або попередньому
pending credential change. Якщо busy — зачекати завершення tick і повторити;
не зупиняти deploy-service вручну. Таймер тимчасово stop/disable, OPDS briefly
stop/start; логін/пароль узгоджено записуються до runtime.env і deploy.env.
На успіху перевіряються readiness/static OPDS locally/HTTPS і відхилення старої
пари; відновлюється попередній стан таймера. Source/book requests не виконуються.
Однакові старі/нові credentials — no-op. Runtime cache/current/state не змінюються.

Після успіху: у FBReader після restart ввести нові credentials. При потребі
переконатися, що username у діалозі теж замінено. Повторний prompt після наступного
restart допустимий за рішенням власника; це не обіцянка reader persistence.
Повернути лише sanitized JSON команди, OPDS/timer/bot status і факт device login.
Не передавати env/private backups чи відбитки credentials. Не робити додаткових
book downloads. Файл/папка backup залишаються приватними root-only поза Git.

## Якщо операція перервалася

Звичайна помилка автоматично повертає обидва початкові файли та перевіряє старий
login. При hard kill/reboot або rollback failure команда не обіцяє автоматичного
відновлення. Таймер має залишитися disabled; повторна команда відхилить pending.
Оператор під тим самим deploy-lock перевіряє marker
`/etc/searchfloor-opds/credentials-rotation-pending`, private backup і deployment
state. Не видаляти marker просто для повторного запуску, не запускати timer поверх
змішаних конфігів. Під lock/inactive deploy-service: stop лише OPDS, відновити
**обидва** env із указаного приватного backup (root:root0600), start/verify старий
Basic locally/HTTPS. Потім прибрати marker і повернути зафіксований попередній
timer state із root-only `recovery.json` у backup. Нічого не записувати в
deployment state/current або bot paths.
Потрібен operator root; агент не запитує секретів і не друкує backup contents.
