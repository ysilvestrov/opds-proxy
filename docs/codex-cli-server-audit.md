# Бріф для Codex CLI на Hetzner

Мета: read-only перевірка можливості розмістити приватний Searchfloor OPDS
поряд із Warsaw Beer Bot. Не реалізовуй і не деплой новий сервіс.
Спочатку прочитай застосовні AGENTS.md і фактичні deployment docs.

Репозиторій нового сервісу: **https://github.com/ysilvestrov/opds-proxy**.
Git URL: `https://github.com/ysilvestrov/opds-proxy.git`.
Це окремий проєкт від `ysilvestrov/warsaw-beer-bot`. У межах аудиту перевір
read-only доступ, фактичну default branch, наявність `main` та CI workflows.
Якщо репозиторій порожній або CI ще немає — зазнач потрібне налаштування,
не вважай це збоєм сервера. Не клонуй у production-каталоги й не змінюй repo.

## Межі роботи

Не змінюй systemd, cron, firewall, DNS, Cloudflare routes, sudoers, Node,
Litestream, production DB або checkout. Не запускай deployment, міграції,
тести бота, cleanup або restart. Не друкуй `.env`, токени cloudflared,
Telegram, API, R2, паролі, cookies чи повні командні рядки процесів.
Не використовуй `systemctl show Environment` або `ps ... args`.
Конфігурації читай вибірково й у звіт винось тільки безпечні параметри.
Якщо потрібний read вимагає недоступних прав — зазнач прогалину.

## Перевірки

1. ОС і runtime: `uname -r`, `cat /etc/os-release`, `node --version`,
   `npm --version`, `command -v node`, `python3 --version`.
   Звір поточні `package.json` та deploy/README із runtime юнітів.
   Spec має ≥20, поточний репозиторій — ≥24; не виправляй runtime в аудиті.

2. Ресурсний запас: `nproc`, `free -h`, `uptime`, `df -h /`, `df -i /`,
   `vmstat 1 5`, `ps -eo comm,rss,%cpu --sort=-rss`.
   Вкажи коротке вікно вимірювання; snapshot не доводить запас у пікові години.
   Прочитай безпечний `/var/tmp/wbb-resource-monitor/summary.json`, якщо є.
   Не обходь увесь диск і не скануй production DB.

3. Сервіси й порти: інвентар назв active services; для warsaw-beer-bot,
   cloudflared та інших Node-сервісів читати тільки ActiveState/SubState,
   MemoryCurrent/MemoryPeak/MemoryMax/CPUQuotaPerSecUSec/NRestarts,
   User/Group/WorkingDirectory, якщо доступні. `ss -ltn` для зайнятих портів.
   Знайди кандидат вільного loopback-порту. Unit/config можуть містити секрети:
   не виводь їх цілком, навіть у diagnostic log.

4. Tunnel: чи cloudflared active, token-managed чи config-managed,
   чи можливо додати окремий hostname → loopback-порт. Якщо mapping живе
   лише в Cloudflare dashboard і доступу немає — познач як неперевірене.
   Не витягуй tunnel token. Не змінюй існуючий beer-api route.

5. Storage: підтвердити наявність окремих `/opt`, `/etc`, `/var/lib`
   схем розміщення і сервісних користувачів. Не читай bot.db.
   Перевір доступний оператору механізм вузьких sudo-команд; не розширюй права.
   Кеш OPDS перебудовується на вимогу, його бекап не потрібен; інтеграцію
   з Litestream/R2 не досліджуй і не налаштовуй. Секрети й deployment-state
   мають жити окремо від кешу.

6. Джерело з IP Hetzner: базова адреса **https://searchfloor.org/**.
   Виконай до 5 послідовних HTTP-запитів із паузами та timeout 20 с:
   - завершений список: `https://searchfloor.org/?status=is_finished`;
   - пошук: `https://searchfloor.org/search?q={query}` — для query візьми
     назву книги з отриманого списку й закодуй як URL query parameter;
   - той самий пошук із фільтром:
     `https://searchfloor.org/search?q={query}&status=is_finished`;
   - наступна сторінка завершеного списку:
     `https://searchfloor.org/?status=is_finished&page=2`;
   - HEAD одного Download: знайди `.download-btn` у завершеному списку,
     прочитай `data-url` і перетвори відносну адресу на абсолютну щодо
     `https://searchfloor.org/` (очікуваний маршрут `/book/{id}`).
     Не вигадуй ID; якщо кнопки немає, зазнач це й пропусти HEAD.
   Записати статус, Content-Type, фінальний host без query-токенів,
   кількість карток/Download, наявність статусів та challenge/login.
   HTML 200 не означає успішну видачу. HEAD може не відповідати GET.
   Не качай книги, не роби масовий crawl і не обходь блокування.
   При 403/429/challenge зупини запити й повідом стан.

7. Deployment: переглянь поточний механізм бота без запуску. Визнач,
   що можна адаптувати для окремого repo/unit/DB/lock/state, і що прив'язане
   до бота. Зокрема rsync delete/allowlist, sudoers, rollback БД та
   merge-deploy не можна перевикористати з тими самими шляхами.
   Визнач read-only health baseline бота, якщо доступний на loopback.
   Для окремого pull-autodeployer перевір доступність git, systemd timer,
   читання `ysilvestrov/opds-proxy` та його CI status, можливість окремого deploy-user і вузького
   restart OPDS. Повідом тільки факт доступу, не credentials. Запропонуй
   одноразовий bootstrap, staging release/current, окремі lock/state,
   rollback коду з перебудовою кешу та pause/retry. Нічого не встановлюй.

## Формат результату

Поверни `server-audit.md` із датою та часом UTC і Europe/Warsaw:
- таблиця «перевірка → факт → доказ → висновок/невідоме»;
- фактичний runtime, зайняті порти, пропозиція вільного порту;
- RAM/CPU/disk/inode snapshot і придатність для малого сервісу;
- доступність Searchfloor і чи працює completed-filter у пошуку;
- пропозиція service-user, каталогів, tunnel-route, початкових resource limits
  із поясненням за вимірами; новий hostname познач як пропозицію;
- що вже можна перевикористати та які одноразові зміни знадобляться;
- придатність pull-autodeploy і перелік одноразових operator-кроків;
- список blockers, без їх самостійного усунення;
- підтвердження, що production не змінювався.

Цільова система: один користувач, OPDS 1.2, останні завершені книги,
пошук upstream, SQLite-кеш, передавання FB2 ZIP на вимогу. Без повного
локального індексу, бібліотеки файлів, конвертації та спільної БД із ботом.
Кеш без бекапу; автодеплой після merge у main та успішного CI на тому самому SHA.
