# LINKS-01 source evidence — 2026-10-07

Evidence and design context only; root spec.md is the sole normative document.
Owner chose author/series acquisition feeds inside FBReader Android3.8.31,
then approved using the compact-page contract: no status badge plus matching
Download qualifies; explicit ongoing status excludes. No product code or
production changes have been made for this feature.

## Observed source contract

Existing sanitized book27047 fixture contains:
- author `/a/Алексей Котов` (URL-encoded in HTML);
- series `/s/Асмодей?authors=Алексей Котов` (URL-encoded);
- series label alone is insufficient identity: preserve authors selector.

Bounded direct GETs from this PC, normal Node fetch/Cheerio, no credentials,
JS execution, challenge bypass, book downloads or crawl:

| Document | HTTP | HTML bytes | Book divs | Download buttons | next marker |
|---|---|---|---|---|---|
| author Алексей Котов |200|309592|0|46|absent|
| series Асмодей, author Алексей Котов |200|29144|0|1|absent|

Series has2 book links. For27047, `p.fw-medium > a[href=/b/27047]` is inside
`.series-content` / `.series-item`; same content contains Download
`data-url=/book/27047` and no status badge. For27484, content has exact status
`в процессе` and no Download, showing subscription access instead.
Author page also has no `div#book{id}`; existing ordinary-page parser cannot
parse these documents unchanged. Author rows, including standalone books, use
`.card-body > .series-item` and direct child `.series-content`. Section headers
carry source author/series links; standalone books use verified page context.
Page title and `.card-body > p.fs-5` author/series heading identify the entity.
Real sanitized fixtures are related-author.html and related-series.html under
tests/fixtures/searchfloor. Generic body `data-page=""` is not pagination;
explicit next/nonempty page controls remain unsupported.

Public `/static/js/series-1.0.js` fetched and read without execution:200,2718B.
It handles authenticated user follow/exclude interactions, not book pagination.
No tracking endpoint was called. Website pages include third-party scripts;
none were executed. One earlier web-tool author result was a seven-month-old
crawl and is not used as current source-contract proof.

No observed `#btn-next-page` does not prove pagination never exists for other
authors. Initial design rejects explicit unsupported pagination rather than
claiming completeness or introducing an unbounded crawl. Unknown layout fails
closed. Server-proxy and actual Related link handling remain unverified.

## Design conclusions to review in root spec

- Dedicated pure compact parser; no per-book HTTP hydration for entity feeds.
- Preserve strict `весь текст` rule for ordinary list/search/card parser.
- One15min entity snapshot, local20-book pages, existing global cache budgets.
- Entity rows do not overwrite richer Book/details/cover cache records.
- Book/card/Download remain existing Catalog paths and completion guards.
- Canonical source-name based keys; series includes the author selector.
- Basic-only related feeds; signed book-card grant scope is unchanged.
- No author/genre index, bot, Cloudflare, secrets, deployment or DB migration.

Required validation: scoped rows, explicit ongoing with Download, absent status
without Download, unknown/malformed status/layout, duplicate conflicting IDs,
foreign URLs, same-name series/different authors, coauthors, UTF-8/key validation,
empty/local pagination, cache/stale/coalescing/request counts, unchanged auth
and Download guards. Sanitized fixture tests precede product implementation;
FBReader navigation is a separate owner acceptance step.
