# Searchfloor source contract

Перевірено 2026-10-04 із локального середовища; серверну доступність окремо
підтверджує server-audit.md. Live probes не є CI-тестами.

- Completed `/?status=is_finished`: 20 книг, усі «весь текст», next=2.
- Search `Инициация`: 14 карток, 12 «весь текст», 2 «в процессе»;
  той самий результат із `status=is_finished`. Фільтр пошуку ігнорується.
- Completed page=2: HTML-фрагмент, 20 completed, next=3.
- Empty search: HTTP 404, HTML має точне `Ничего не найдено 😔`;
  це валідний порожній результат, не будь-який довільний 404.
- Card `/b/27047`: HTTP 200, статус і Download у `div#book27047`;
  title у `p.fw-medium`, без link `/b/` на власній картці.
- GET `/book/27047`: 200 `application/zip`, без редиректу, 320612 bytes;
  один FB2, uncompressed 1017762 bytes, root FictionBook у FB2 namespace.
  Книга оброблена в пам'яті, текст/ZIP не збережено у repo.

DOM: `div[id^="book"]` із numeric suffix; title `p.fw-medium`,
author `a[href^="/a/"]`, status `[data-bs-title="Статус книги"]`,
download `.download-btn[data-url]` та ID, series `[data-bs-title="Серия"]`,
position `[data-bs-title="Номер в серии"]`; next `#btn-next-page[data-page]`.
Відсутній next на непорожній коректній page означає кінець. Порожня page
приймається лише з явним empty marker. Challenge markers самі по собі в
script не є challenge: сайт має Cloudflare scripts на нормальних сторінках.

Fixtures очищені від script/style/iframe і inline JS/tracking attributes.
Вони містять публічні metadata, без сесій, credentials чи тексту книги.
Повторні live-запити для tests не потрібні.
