# Server audit: приватний Searchfloor OPDS поруч із Warsaw Beer Bot

Дата завершення перевірок: **2026-10-04 20:14:21 UTC / 2026-10-04 22:14:21 Europe/Warsaw (CEST, UTC+02:00)**.
Основне ресурсне вимірювання: **20:11:19–20:11:23 UTC**; решта перевірок — до 20:14:21 UTC.

## Висновок

Сервер умовно придатний для малого сервісу на одного користувача: є вільний loopback-порт, близько 6.0 GiB доступної RAM та 34 GiB диска; Searchfloor повертає реальні картки й ZIP Content-Type для HEAD. Це достатньо для наступного етапу проєктування, але не для твердження про гарантований запас у пікові години. Найбільший спостережений споживач — code-server: systemd MemoryPeak близько 5.9 GiB при 7.6 GiB RAM хоста.

Розгортання потребує окремого bootstrap оператором. У цьому середовищі немає доступного sudo; Cloudflare dashboard та доступ до майбутнього приватного OPDS-репозиторію не перевірені. Семантика completed-filter у пошуку і фактичне передавання FB2 ZIP залишаються непідтвердженими.

Ціль: один користувач, OPDS 1.2, останні завершені книги, upstream-пошук, SQLite-кеш і передавання FB2 ZIP на вимогу. Без повного локального індексу, зберігання бібліотеки книг, конвертації або спільної БД з ботом. Кеш не потребує бекапу.

## Перевірка → факт → доказ → висновок/невідоме

| Перевірка | Факт | Доказ | Висновок / невідоме |
|---|---|---|---|
| Інструкції | Прочитано кореневий AGENTS.md, бриф, релевантні розділи spec.md та deployment docs | `AGENTS.md`, `tmp/codex-cli-server-audit.md`, `spec.md` §5.9, `/health`, tunnel; `deploy/README.md`, `deploy/deploy.sh`, `deploy/autodeploy.sh`, unit/timer, rsync-filter, категорії sudoers | Виконано лише аудит; скрипти deployment не запускалися |
| Платформа | Hetzner vServer; Ubuntu 24.04.4 LTS; kernel 6.8.0-90-generic | DMI sys_vendor/product_name, `/etc/os-release`, `uname -r` | Перевірки виконувалися на цільовому хості; вихідну публічну IP окремо не визначали |
| Runtime | Node v24.19.0, npm 12.0.2, Python 3.12.3, Node `/usr/bin/node` | `node --version`, `npm --version`, `python3 --version`, `command -v node` | Runtime не змінювався |
| Вимоги Node | spec ≥20; checkout і deployed package.json ≥24; deploy README встановлює Node 24 | `spec.md:52,2712`, поле engines обох package.json, `deploy/README.md:34` | Фактична версія відповідає поточним пакетам; мінімум у spec ширший |
| Runtime юнітів | warsaw-beer-bot та 48-hours-trip мають ExecStart executable `/usr/bin/node` | Вибіркове читання лише executable з unit-файлів | Runtime узгоджений із системним Node; версію вже запущеного процесу окремо не перевірено через ізоляцію /proc |
| CPU | 4 CPU; load 0.41 / 0.19 / 0.11; uptime 165 днів | `nproc`, `uptime` | Низьке навантаження у момент перевірки |
| CPU, коротке вікно | Інтервальні рядки vmstat: idle 89–95%, iowait 0–3%, steal 0%; swap-in 0–92 KiB/s, swap-out 0 | `vmstat 1 5`, приблизно 4 секунди інтервальних даних | Перший рядок — середні з часу boot, не поточний інтервал; піковий запас не доведено |
| RAM / swap | RAM 7.6 GiB total, 1.6 GiB used, 524 MiB free, 5.8 GiB buff/cache, 6.0 GiB available; swap 4.0 GiB, зайнято 1.0 GiB | `free -h` | Оцінювати available, а не лише free; зайнятий swap сам по собі не доводить поточний дефіцит |
| Диск | `/dev/sda1`: 75 GiB total, 39 GiB used, 34 GiB available, 54% used | `df -h /` | Для обмеженого кешу запас є; весь диск не обходився |
| Inodes | 4,862,256 total; 2,767,269 used; 2,094,987 free; 57% used | `df -i /` | Поточний запас достатній; не створювати необмежену кількість release/build-файлів |
| Resource monitor | Свіжий snapshot 20:10:01.896 UTC, вік на час читання 167 с; bytes_available 35,818,192,896; inodes_free 2,095,130; pending_runs 0; inventory available | `/var/tmp/wbb-resource-monitor/summary.json`, version 1, UID/GID 1000/1000, mode 0644 | Snapshot узгоджується з df; це не історія навантаження і не доказ відсутності піків |
| Видимість процесів | ps бачить лише codex та процеси перевірки; /proc має приблизно 3 видимі PID, PID 1 — codex | `ps -eo comm,rss,%cpu --sort=-rss`, `/proc/1/comm`, NSpid | Це ізольований process namespace. Не використовувати ps як повний інвентар процесів хоста; systemd дає додаткові host-метрики |
| Бот | active/running, NRestarts=0; loopback `/health` HTTP 200, JSON `ok: true` | `systemctl show` дозволених полів; `GET http://127.0.0.1:3000/health` | Мінімальний health baseline є; endpoint не доводить здоров'я всіх jobs або зовнішніх інтеграцій |
| Tunnel | cloudflared active/running; unit executable `/usr/bin/cloudflared`, містить token flag | Вибіркове визначення token-managed без виводу аргументів чи токена | Token-managed підтверджено; hostname mapping у dashboard не перевірено |
| Локальний tunnel config | `/etc/cloudflared` та config.yml/config.yaml не знайдено | Перевірки конкретних шляхів | Узгоджується з token-managed; не доводить відсутності інших конфігів |
| Storage layout | Наявні `/opt`, `/etc`, `/var/lib` та окремі каталоги warsaw-beer-bot; сервісний користувач warsaw-beer-bot існує | stat каталогів; getent з виводом лише факту існування; User/Group unit | Схему можна повторити з новими шляхами. UID/GID 65534 у частини stat — відображення sandbox, не доказ неправильного ownership хоста |
| sudo оператора | `sudo -n -l` відхилено через no-new-privileges | Код завершення 1, без виводу всього sudoers | Фактичний installed sudo allowlist не перевірено; escalation не робилась |
| Sudoers у repo | Є scoped bot paths, pinned rsync, systemctl та run-as-bot; searchfloor-команд немає | Вибірковий аналіз `deploy/sudoers.d/warsaw-beer-bot` | Repo-фрагмент не доводить installed-права; його не можна використовувати для нового сервісу без окремого bootstrap |
| Pull-autodeploy tools | git 2.43.0 та gh доступні; існуючий приватний клон WBB і installed deployer читаються | command lookup, stat; `git ls-remote ... refs/heads/main` exit 0 | Читання поточного публічного repo працює; майбутній приватний repo та deploy-user не перевірені |
| CI API | Читання check-runs поточного repo успішне | `gh api repos/ysilvestrov/warsaw-beer-bot/commits/main/check-runs` exit 0, виводився лише факт доступу | Перевірено API-доступ, не зелений CI майбутнього OPDS і не доступ із середовища його systemd unit |
| Timer | wbb-autodeploy.timer active/waiting; service inactive/dead у момент перевірки, User=ysi | Дозволені поля `systemctl show`, repo timer | Systemd timer механізм на хості працює; inactive oneshot між тиками очікуваний |

## Сервіси і зайняті порти

Значення systemd — snapshots, а MemoryPeak — максимум cgroup з моменту його обліку, не вимір пікового навантаження за цей аудит.

| Unit | Active / Sub | MemoryCurrent | MemoryPeak | MemoryMax | CPUQuotaPerSecUSec | NRestarts | User / Group | WorkingDirectory |
|---|---|---:|---:|---|---|---:|---|---|
| warsaw-beer-bot | active / running | 160,616,448 B (~153 MiB) | 609,947,648 B (~582 MiB) | infinity | infinity | 0 | warsaw-beer-bot / warsaw-beer-bot | /opt/warsaw-beer-bot |
| cloudflared | active / running | 31,207,424 B (~30 MiB) | 46,387,200 B (~44 MiB) | infinity | infinity | 0 | поля порожні, явного User/Group немає | порожнє |
| 48-hours-trip | active / running | 27,381,760 B (~26 MiB) | 46,829,568 B (~45 MiB) | infinity | infinity | 0 | 48-hours-trip / 48-hours-trip | /opt/48-hours-trip |
| code-server@ysi | active / running | 1,993,383,936 B (~1.86 GiB) | 6,343,524,352 B (~5.91 GiB) | 6,442,450,944 B (6 GiB) | infinity | 1 | ysi / поле Group порожнє | порожнє |

Ці показники й free читалися в різні моменти; підсумовувати їх як синхронний баланс RAM не слід. Ізольований ps не дозволяє гарантувати, що знайдено кожен Node-процес. `/opt/48-hours-trip` недоступний для читання; його package.json не перевірено.

`ss -ltn` показав TCP listeners:

- `127.0.0.1:3000` — bot health підтверджено;
- `127.0.0.1:8080`;
- `127.0.0.1:20242`;
- `127.0.0.1:33317`;
- `127.0.0.1:40011`;
- `127.0.0.53%lo:53`, `127.0.0.54:53`;
- `0.0.0.0:22`, `[::]:22`.

Належність решти портів конкретним процесам не встановлювалася. **Пропозиція: `127.0.0.1:8787`** — не зайнятий у цьому snapshot. Це кандидат, не резервування; повторно перевірити перед bootstrap. Bind має бути лише на loopback.

Інвентар назв active services:

```text
48-hours-trip.service, apparmor.service, apport.service, atd.service,
blk-availability.service, cloud-config.service, cloud-final.service,
cloud-init-local.service, cloud-init.service, cloudflared.service,
code-server@ysi.service, console-setup.service, cron.service, dbus.service,
finalrd.service, getty@tty1.service, keyboard-setup.service,
kmod-static-nodes.service, litestream.service, lvm2-monitor.service,
multipathd.service, plymouth-quit-wait.service, plymouth-quit.service,
plymouth-read-write.service, polkit.service, qemu-guest-agent.service,
rsyslog.service, serial-getty@ttyS0.service, setvtrgb.service,
snapd.apparmor.service, snapd.seeded.service, ssh.service, sysstat.service,
systemd-binfmt.service,
systemd-fsck@dev-disk-by\x2duuid-452C\x2d085F.service,
systemd-journal-flush.service, systemd-journald.service,
systemd-logind.service, systemd-machine-id-commit.service,
systemd-modules-load.service, systemd-networkd-wait-online.service,
systemd-networkd.service, systemd-random-seed.service,
systemd-remount-fs.service, systemd-resolved.service, systemd-sysctl.service,
systemd-timesyncd.service, systemd-tmpfiles-setup-dev-early.service,
systemd-tmpfiles-setup-dev.service, systemd-tmpfiles-setup.service,
systemd-udev-trigger.service, systemd-udevd.service,
systemd-update-utmp.service, systemd-user-sessions.service,
ufw.service, unattended-upgrades.service, warsaw-beer-bot.service
```

## Searchfloor: рівно п'ять HTTP-запитів

Запити виконано послідовно з хоста, без налаштованого HTTP proxy, timeout 20 с, паузи між запитами щонайменше 2 с, User-Agent `server-audit/1.0`. Redirect-follow вимкнено, щоб не перевищити п'ять upstream-запитів; редиректів не отримано. Книги не завантажувалися. Сайт доступний на момент перевірки; це не гарантія постійної доступності IP або майбутніх rate limits.

Для `q` використано назву першої картки завершеного списку: **«Становление мага постапокалипсиса. 1.3. Башня испытаний»**, параметр закодовано через urlencode.

| Запит | HTTP | Content-Type | Фінальний host | Картки / Download | Статуси та challenge/login |
|---|---:|---|---|---|---|
| GET `https://searchfloor.org/?status=is_finished` | 200 | text/html; charset=utf-8 | searchfloor.org | 20 / 20 | 20 × «весь текст»; active filter «Завершено»; challenge немає; є звичайне посилання входу |
| GET `https://searchfloor.org/search?q={encoded title}` | 200 | text/html; charset=utf-8 | searchfloor.org | 1 / 1 | 1 × «весь текст»; challenge немає; є посилання входу |
| GET `https://searchfloor.org/search?q={encoded title}&status=is_finished` | 200 | text/html; charset=utf-8 | searchfloor.org | 1 / 1 | 1 × «весь текст»; active status filter не знайдено; challenge немає; є посилання входу |
| GET `https://searchfloor.org/?status=is_finished&page=2` | 200 | text/html; charset=utf-8 | searchfloor.org | 20 / 20 | 20 × «весь текст»; challenge немає; посилання входу у відповіді не знайдено |
| HEAD `https://searchfloor.org/book/25415` | 200 | application/zip | searchfloor.org | тіло не читалося | ID взято з `.download-btn[data-url]` першого списку; challenge/login у тілі HEAD не оцінювалися |

Картки рахувалися за title-параграфами `p.fw-medium`, Download — за `.download-btn`; статус — за badge текстом. Наявність link «Войти» не означає login wall: у відповідях були реальні картки й Download. Другий список повертає картки без повної навігації, тож парсер майбутнього сервісу має приймати обидві форми відповіді.

**Completed-filter у пошуку: неперевірений семантично.** Запит з параметром приймається і повертає завершену книгу, проте така сама завершена книга є й без параметра. Це не доводить, що upstream застосовує фільтр або відсікає незавершені результати. Для окремої майбутньої перевірки потрібен запит із відомими змішаними статусами. У цьому аудиті шостого запиту не було.

**Download: частково підтверджено.** HEAD реального `/book/25415` повернув ZIP MIME, але HEAD може відрізнятися від GET. Не перевірені FB2-вміст архіву, авторизація при GET, streaming, розміри та розриви передачі; завантаження не виконувалося.

## Пропозиція ізоляції й початкових лімітів

Усе нижче — пропозиції, нічого не створено:

| Елемент | Пропозиція | Підстава |
|---|---|---|
| Runtime service-user | `searchfloor-opds`, system user, nologin | Такого користувача зараз немає; жодного спільного run-as-bot |
| Deploy-user | `searchfloor-deploy`, окремий account для pull/build/release | Такого користувача зараз немає; його GitHub-доступ і точні права встановлює оператор |
| Код | `/opt/searchfloor-opds/releases/<sha>/`, `staging/<sha>/`, `current` → release | Runtime читає release; deploy-user пише тільки власне дерево; секретів і кешу в ньому немає |
| Секрети | `/etc/searchfloor-opds/`, файл mode 0600, вибір ownership відповідно до способу читання unit | Окремо від коду, cache і deployment-state |
| SQLite-кеш | `/var/lib/searchfloor-opds/cache/cache.sqlite` | Нова БД; обмежений кеш останніх завершених книг і результатів upstream-пошуку, перебудова на вимогу |
| Deployment-state / lock | `/var/lib/searchfloor-opds-deploy/state/`, `/var/lib/searchfloor-opds-deploy/lock` | Окремо від cache, bot state і bot lock; writable лише deploy-user |
| Listener | `127.0.0.1:8787` | Порт вільний у snapshot; повторити перевірку перед запуском |
| Tunnel-route | **Пропонований, не створений** `opds.ysilvestrov-ai.uk` → `http://127.0.0.1:8787` | Наявний token-managed tunnel може бути використаний після перевірки dashboard-повноважень. Існування/вільність hostname не перевірялися; beer-api route зберегти |
| Приватний доступ | Окрема автентифікація, сумісна з конкретним OPDS-клієнтом | Публічний hostname сам по собі не робить OPDS приватним; придатність інтерактивного Cloudflare Access до клієнта не встановлена |
| MemoryHigh / MemoryMax | 256 MiB / 384 MiB для runtime | Консервативний старт для одного користувача і streaming без буферизації книг. Через історичний code-server peak не виділяти великі необмежені heaps; виміряти реальний runtime перед затвердженням |
| CPUQuota | 50% для runtime | Це максимум половини одного CPU, не половина всього 4-CPU хоста; старт для малої concurrency, коригувати за latency |
| TasksMax / concurrency | TasksMax=64; початково одна одночасна Download-передача | Обмежити фон і буфери; ліміти — гіпотези, потрібна перевірка реальним клієнтом |
| Кеш і releases | Початковий application cache budget 256 MiB; latest + previous settled release | df/inodes дають запас, але кеш і build-дерева не повинні рости без межі. Cache budget не є filesystem quota |

Memory/CPU ліміти runtime не захищають від окремого build. Bootstrap має задати й окремий бюджет deployer/build, наприклад MemoryMax=768 MiB, CPUQuota=100%, concurrency 1, і перевірити, що обраний build уміщується. Це стартова пропозиція, не вимір потреб майбутнього коду. Спільний Node не оновлювати заради OPDS без окремого узгодженого процесу.

## Deployment: що адаптувати, що розділити

Поточний WBB deploy: rsync із `--delete --delete-excluded` та repo allowlist до `/opt/warsaw-beer-bot`, install/build/prune, встановлення unit і явний restart. Merge-deploy має приватний clone, спільний із ручним deploy lock, 10-хвилинне quiet window, ancestry/hold/CI gates на exact SHA, перевірку здоров'я та NRestarts. Перед deploy він робить bot DB snapshot і trial migrations; rollback повертає код **і bot DB**.

Можна адаптувати принципи: timer, read-only fetch main, CI gate на конкретному SHA, serial lock, hold для bootstrap/root змін, health window, exact release identity, pause marker та явний retry. Git і GitHub API вже доступні поточному оператору, timer працює.

Не можна запускати bot deploy для OPDS або перевикористати його production-шляхи: pinned rsync/delete, allowlist, sudoers, unit, repo URL, state/lock, DB snapshot/rollback та merge-deploy прив'язані до бота. Не підкладати OPDS у `/opt/warsaw-beer-bot`: наступний rsync може видалити його як excluded. Не читати bot `.env` для OPDS; не використовувати bot Telegram credentials або DB. Litestream/R2 для нового кешу не потрібні й не досліджувалися.

## Придатність окремого pull-autodeploy

Механізм придатний після bootstrap, але повноваження нового deploy-user ще не підтверджені. Запропонований потік:

1. Окремий systemd timer запускає root-owned installed deployer як `searchfloor-deploy`; timer і script не належать runtime-user.
2. Deployer перевіряє власний PAUSED, бере власний lock, читає main з окремого repo. Через GitHub API перевіряє завершений успішний required CI **саме на SHA кандидата**; відсутні/pending checks блокують deploy, transport failures дають bounded backoff/retry.
3. SHA кандидата фіксується: build у власному staging без змін current. Робота з Git/build можлива лише в OPDS дереві. Перед активацією перевірити, що main досі вказує на кандидата; інакше відкласти і перевірити нового кандидата.
4. Успішний staging переноситься в immutable release, current атомарно перемикається, вузький helper рестартує лише OPDS. Unit і runtime не мають прав міняти installed deployer, bot чи секрети інших сервісів.
5. Лише після health перевірки й вікна спостереження записати DEPLOYED_SHA як підтверджений settled release. Failed candidate SHA зберегти окремо; він не означає live SHA.
6. На невдалому старті переключити current назад, зупинити OPDS перед видаленням/інвалідацією **лише його кешу**, запустити старий код із перебудовою кешу на вимогу. Не відновлювати bot DB і не торкатися інших state. Сумісність старого коду з новим кешем не припускати.
7. PAUSED зупиняє наступні ticks; активний deploy має визначену recovery-поведінку. Retry transient/API failures автоматичний із backoff; повтор build/runtime-failure того самого SHA — через явне re-arm або новий SHA. Окремий operator stop timer лишається запасним гальмом.

Це схема, не реалізація. Доступ поточного `gh` до WBB не переноситься автоматично на приватний OPDS repo чи новий service-user. Факт доступу треба перевірити в реальному середовищі нового timer без виводу credentials.

### Одноразові operator-кроки

- Погодити OPDS-клієнт, приватну автентифікацію і hostname; перевірити Cloudflare dashboard та можливість додати окремий route.
- Створити незалежні runtime/deploy accounts і каталоги з вузьким ownership; runtime читає код та пише лише cache, deploy-user керує releases і власним state.
- Надати новому deploy-user read-only доступ до приватного repo і CI API без повторного використання секретів бота.
- Встановити root-owned OPDS unit, deployer service/timer та narrowly scoped restart helper/sudoers: лише зафіксований OPDS unit, без довільних shell/root команд. Installed sudoers перевіряє оператор; аудит його не змінював.
- Налаштувати початкові runtime/build limits, loopback listener та окремі health endpoints; повторно перевірити порт 8787 і ресурси під типовим навантаженням code-server.
- Додати новий tunnel hostname → loopback, залишивши beer-api route без змін; перевірити приватний доступ з потрібного OPDS-клієнта.
- Виконати окремий перший release, перевірити baseline, pause/retry та code rollback із cache rebuild; потім увімкнути timer для main + green CI на одному SHA.

## Blockers і прогалини

1. У sandbox `sudo` блокує no-new-privileges: installed narrow commands і можливість створення accounts/unit не підтверджені. Усуває оператор під час окремого bootstrap, не цей аудит.
2. Dashboard mapping, вільність нового hostname і повноваження Cloudflare не перевірені. Наявність token-managed tunnel не доводить право додати route.
3. completed-filter у пошуку може ігноруватися: нинішня вибірка не розрізняє застосований і незастосований фільтр.
4. GET Download, FB2 ZIP вміст та клієнтська auth/streaming сумісність не перевірені за межами дозволеного HEAD.
5. Піковий ресурсний запас не встановлено; MemoryPeak code-server майже 6 GiB. Snapshot monitor не є історичним профілем.
6. Новий приватний repo, required CI check, новий deploy-user і narrow OPDS restart поки відсутні або не перевірені.
7. Ізольований /proc не дає повного host-process inventory; runtime живих процесів і ownership хоста не можна повністю встановити з namespace-view.

## Підтвердження незмінності production

Production не змінювався: не змінено systemd, cron, firewall, DNS, Cloudflare routes, sudoers, Node, Litestream, production DB або checkout. Не запускалися deployment, міграції, тести бота, cleanup чи restart. `bot.db` не читався. Секретні env, токени, cookies, паролі, process args та unit Environment не друкувалися. Немає нового сервісу, користувача, route або інсталяції.

Єдині створені файли — звіт `/tmp/server-audit.md` та діагностичні `/tmp/searchfloor-audit-list.html`, `/tmp/searchfloor-audit-results.json`. Початковий checkout був чистий; записи до нього не виконувалися. Діагностичні файли не видалялися, відповідно до заборони cleanup.
