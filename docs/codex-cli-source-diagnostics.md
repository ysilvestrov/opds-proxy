# Бріф: діагностика Searchfloor 403 після встановлення прототипу

Контекст: latest operator result у `docs/prototype-report.md`,
2026-10-05 08:50–08:51 UTC. Prototype встановлений, але зупинений після live
feed 503; прямий Node-запит до Searchfloor отримав 403. Інсталяцію не повторювати.
Вимоги: SOURCE-002, CACHE-002, AUTH-001, ARCH-001, ACCEPT-001, COST-001.

Прочитай AGENTS.md, spec.md, latest section звіту, source-contract.md і
фактичний `deploy/start-prototype.sh`. Працюй у наявному серверному checkout.
Це діагностика, не виправлення або дозвіл на обхід upstream-захисту.

## 1. Зберегти фактичний стан

- Не запускай `start-prototype.sh --apply`, bootstrap, нову інсталяцію чи
  регенерацію credentials: code/current/config вже існують.
- Не перезапускай прототип, production або timer. Не читай env/credentials,
  bot DB/state/секрети. Можна перевірити unit state і мінімальний bot health.
- Переглянь наявний приватний terminal trace і helper без секретів у виводі.
  Укажи порядок успішних перевірок до першого live assertion, але відрізни
  висновок за порядком виконання від збережених per-request доказів.
- Helper і його нові тести відсутні в desktop-копії репозиторію. Поверни їх
  разом із sanitized diff/звітом для огляду та включення до спільного PR;
  не змінюй helper чи pinned application artifact у цьому діагностичному кроці.

## 2. Один bounded запит із точними headers клієнта

Попередня діагностика скасувала body 403, тому причина за ним невідома.
Потрібен один запит із того самого хоста; без retries, redirect following,
cookies, browser-UA підміни, proxies, challenge solving чи різних комбінацій
headers. Не завантажуй книги. Запиши тільки дозволені response headers і
наявність діагностичних маркерів; raw HTML не зберігати й не друкувати.

```sh
/usr/bin/node --input-type=module <<'NODE'
const signal = AbortSignal.timeout(15000);
const url = 'https://searchfloor.org/?page=1&status=is_finished';
try {
  const response = await fetch(url, {
    signal, redirect: 'manual',
    headers: {'User-Agent':'opds-proxy/0.1', Accept:'text/html,application/zip'}
  });
  const reader = response.body?.getReader();
  const parts = [];
  let bytes = 0;
  try {
    while (reader && bytes < 16384) {
      const {done, value} = await reader.read();
      if (done) break;
      const part = value.slice(0, 16384 - bytes);
      parts.push(part); bytes += part.length;
    }
  } finally {
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  const body = Buffer.concat(parts.map(p => Buffer.from(p))).toString('utf8');
  const markers = {
    error1010: /error\s*(?:code\s*)?:?\s*1010\b/i.test(body),
    error1015: /error\s*(?:code\s*)?:?\s*1015\b/i.test(body),
    challengeTitle: /<title[^>]*>\s*(?:Just a moment|Attention Required)/i.test(body),
    explicitAccessDenied: /access denied|request blocked|forbidden/i.test(body)
  };
  let location;
  if (response.headers.has('location')) {
    try {
      const next = new URL(response.headers.get('location'), url);
      location = {origin:next.origin, pathname:next.pathname};
    } catch { location = {invalid:true}; }
  }
  console.log(JSON.stringify({
    date:new Date().toISOString(), status:response.status,
    headers:Object.fromEntries(['server','content-type','cf-ray','cf-mitigated',
      'retry-after'].map(name => [name,response.headers.get(name)])),
    location, inspectedBytes:bytes, markers
  }, null, 2));
} catch (error) {
  console.log(JSON.stringify({date:new Date().toISOString(),
    failure:error.name, code:error.cause?.code || null}));
  process.exitCode = 1;
}
NODE
```

Маркер не доводить конкретну політику блокування; це лише підстава для
подальшої перевірки. Якщо відповідь 200 — зафіксуй відновлення upstream-доступу,
але не стартуй прототип і не оголошуй каталог прийнятим лише на цій підставі.

## 3. Результат

Додай latest diagnostic section до `docs/prototype-report.md`: час, status,
sanitized headers/markers, стан units/bot і що лишилося неперевіреним.
Якщо причина не встановлена — так і напиши. Не рекомендуй UA spoofing,
проксі/зміну IP чи challenge bypass як автоматичне виправлення.

Цей Cloudflare акаунт контролює наш inbound OPDS hostname, а не захист
`searchfloor.org`. Зміни нашого тунелю/WAF не виправляють upstream 403.
Якщо потрібен дозволений автоматизований доступ або allowlist джерела,
спочатку підготуй конкретний запит до адміністратора Searchfloor для власника;
не надсилай його сам. Зміни архітектури/авторизації — окреме рішення після доказів.

Після відновлення доступу наступний етап — перевірка **наявної** інсталяції
з надійним записом кожної HTTP-перевірки, ручний prototype start і контрольний
live test. Production/timer залишаються off до повного приймання.
